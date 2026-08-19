import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import {
    addPage,
    getPreviewFrame,
    gotoWorkarea,
    openPreviewPanel,
    selectFirstPage,
    waitForAppReady,
} from '../helpers/workarea-helpers';

const ANSWERED_VERB = 'http://adlnet.gov/expapi/verbs/answered';
const COMPLETED_VERB = 'http://adlnet.gov/expapi/verbs/completed';
const PASSED_VERB = 'http://adlnet.gov/expapi/verbs/passed';
const FAILED_VERB = 'http://adlnet.gov/expapi/verbs/failed';
const IDEVICE_ID_EXTENSION = 'https://exelearning.net/xapi/extensions/idevice-id';
const IDEVICE_ORDER_EXTENSION = 'https://exelearning.net/xapi/extensions/idevice-order';
const WEIGHT_EXTENSION = 'https://exelearning.net/xapi/extensions/weight';

type XapiStatement = {
    verb: { id: string };
    object: { id: string };
    result?: { score?: { raw?: number } };
    context?: {
        contextActivities?: { parent?: Array<{ id: string }> };
        extensions?: Record<string, unknown>;
    };
};

async function installStatementCollector(page: Page): Promise<void> {
    await page.evaluate(() => {
        const host = window as any;
        host.__capturedXapiStatements = [];
        window.addEventListener('message', event => {
            if (event.data?.type === 'exe-xapi-statement' && event.data.statement) {
                host.__capturedXapiStatements.push(event.data.statement);
            }
        });
    });
}

async function emitFromPreview(
    page: Page,
    event: { ideviceId: string; ideviceNumber: number; title: string; score: number; weight: number },
): Promise<void> {
    await page.evaluate(payload => {
        const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
        const previewWindow = iframe?.contentWindow as any;
        const track = previewWindow?.$exeDevices?.iDevice?.gamification?.track;
        if (typeof track !== 'function') throw new Error('Preview gamification tracker is not available');
        track('answered', {
            ideviceId: payload.ideviceId,
            ideviceType: 'trueorfalse',
            ideviceNumber: payload.ideviceNumber,
            title: payload.title,
            scorerp: payload.score,
            weighted: payload.weight,
        });
    }, event);
}

async function getPreviewStateKeys(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
        const previewWindow = iframe?.contentWindow as any;
        return Object.keys(previewWindow?.$exeDevices?.iDevice?.xapi?._state || {});
    });
}

async function getCapturedStatements(page: Page): Promise<XapiStatement[]> {
    return page.evaluate(() => (window as any).__capturedXapiStatements || []);
}

function reconstructLatestScore(statements: XapiStatement[]): number {
    const latest = new Map<string, { score: number; weight: number }>();
    for (const statement of statements) {
        if (statement.verb.id !== ANSWERED_VERB) continue;
        const extensions = statement.context?.extensions || {};
        latest.set(String(extensions[IDEVICE_ID_EXTENSION]), {
            score: Number(statement.result?.score?.raw || 0) * 10,
            weight: Number(extensions[WEIGHT_EXTENSION]),
        });
    }

    const values = [...latest.values()];
    const totalWeight = values.reduce((sum, value) => sum + value.weight, 0);
    const weightedTotal = values.reduce((sum, value) => sum + value.score * value.weight, 0);
    return Math.round((weightedTotal / totalWeight) * 100) / 100;
}

test.describe('xAPI weighted scoring across preview pages', () => {
    test('per-iDevice statements remain independently aggregatable after page navigation', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(90_000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'xAPI weighted multipage');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        const secondPageId = await addPage(page, 'Weighted page 2');
        await page.evaluate(targetPageId => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const navigation = bridge?.documentManager?.getNavigation();
            const firstPageId = navigation?.get(0)?.get('id');
            if (!firstPageId || !bridge?.structureBinding) {
                throw new Error('Yjs project structure is not available');
            }

            for (const [pageId, componentId, text] of [
                [firstPageId, 'xapi-page-one-content', 'Weighted page one'],
                [targetPageId, 'xapi-page-two-content', 'Weighted page two'],
            ]) {
                const blockId = bridge.structureBinding.createBlock(pageId, text);
                bridge.structureBinding.createComponent(pageId, blockId, 'text', {
                    id: componentId,
                    htmlContent: `<p>${text}</p>`,
                    jsonProperties: '{}',
                });
            }
        }, secondPageId);
        await selectFirstPage(page);
        await installStatementCollector(page);

        // The preview side panel is an off-canvas element that Playwright can
        // report as visible before it is opened, so trigger it explicitly and
        // then use the shared helper for readiness checks.
        await page.locator('#head-bottom-preview').click();
        await openPreviewPanel(page);
        const preview = getPreviewFrame(page);
        await expect(preview.locator('body')).toBeVisible({ timeout: 15_000 });
        await expect
            .poll(
                () =>
                    page.evaluate(() => {
                        const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
                        const previewWindow = iframe?.contentWindow as any;
                        return {
                            href: previewWindow?.location?.href || '',
                            readyState: previewWindow?.document?.readyState || '',
                            hasTracker: typeof previewWindow?.$exeDevices?.iDevice?.gamification?.track === 'function',
                            xapiInitialised: previewWindow?.$exeDevices?.iDevice?.xapi?._initialised === true,
                        };
                    }),
                { timeout: 15_000 },
            )
            .toMatchObject({
                href: expect.stringContaining('/viewer/'),
                readyState: 'complete',
                hasTracker: true,
                xapiInitialised: true,
            });

        const initialStatements = await getCapturedStatements(page);
        expect(initialStatements.filter(statement => statement.verb.id === ANSWERED_VERB)).toHaveLength(0);

        await emitFromPreview(page, {
            ideviceId: 'weighted-device-a',
            ideviceNumber: 1,
            title: 'Weighted device A',
            score: 10,
            weight: 25,
        });
        await page.waitForFunction(
            answeredVerb =>
                ((window as any).__capturedXapiStatements || []).filter(
                    (statement: XapiStatement) => statement.verb.id === answeredVerb,
                ).length === 1,
            ANSWERED_VERB,
        );
        expect(await getPreviewStateKeys(page)).toEqual(['1']);

        const previousUrl = await page.evaluate(() => {
            const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
            return iframe.contentWindow?.location.href || '';
        });
        const secondPageLink = preview.locator('#siteNav a, nav a').filter({ hasText: 'Weighted page 2' }).first();
        await expect(secondPageLink).toBeVisible({ timeout: 15_000 });
        await secondPageLink.click();
        await page.waitForFunction(
            oldUrl => {
                const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
                const previewWindow = iframe?.contentWindow as any;
                return (
                    previewWindow?.location?.href !== oldUrl &&
                    previewWindow?.document?.readyState === 'complete' &&
                    previewWindow?.$exeDevices?.iDevice?.xapi?._initialised === true
                );
            },
            previousUrl,
            { timeout: 15_000 },
        );

        // Each exported page loads a new exe_xapi.js instance. Page 2 has no
        // knowledge of page 1's contribution, but its statements remain complete.
        expect(await getPreviewStateKeys(page)).toEqual([]);

        await emitFromPreview(page, {
            ideviceId: 'weighted-device-b',
            // Page-local numbering restarts on the second HTML document. The
            // injected export offset turns this into package-global order 2.
            ideviceNumber: 1,
            title: 'Weighted device B',
            score: 4,
            weight: 75,
        });
        await page.waitForFunction(
            ({ answered, completed, passed, failed }) => {
                const verbs = ((window as any).__capturedXapiStatements || []).map(
                    (statement: XapiStatement) => statement.verb.id,
                );
                return (
                    verbs.filter((verb: string) => verb === answered).length === 2 &&
                    verbs.includes(completed) &&
                    verbs.includes(passed) &&
                    verbs.includes(failed)
                );
            },
            { answered: ANSWERED_VERB, completed: COMPLETED_VERB, passed: PASSED_VERB, failed: FAILED_VERB },
            { timeout: 15_000 },
        );
        expect(await getPreviewStateKeys(page)).toEqual(['1']);

        const statements = await getCapturedStatements(page);
        const answered = statements.filter(statement => statement.verb.id === ANSWERED_VERB);
        expect(answered).toHaveLength(2);
        expect(answered.map(statement => statement.context?.extensions?.[IDEVICE_ID_EXTENSION])).toEqual([
            'weighted-device-a',
            'weighted-device-b',
        ]);
        expect(answered.map(statement => statement.context?.extensions?.[WEIGHT_EXTENSION])).toEqual([25, 75]);
        expect(answered.map(statement => statement.context?.extensions?.[IDEVICE_ORDER_EXTENSION])).toEqual([1, 2]);
        expect(answered[0].object.id).not.toBe(answered[1].object.id);
        expect(reconstructLatestScore(answered)).toBe(55);

        const completedScores = statements
            .filter(statement => statement.verb.id === COMPLETED_VERB)
            .map(statement => statement.result?.score?.raw);
        expect(completedScores).toEqual([100, 40]);
        expect(statements.find(statement => statement.verb.id === PASSED_VERB)?.result?.score?.raw).toBe(100);
        expect(statements.find(statement => statement.verb.id === FAILED_VERB)?.result?.score?.raw).toBe(40);
    });
});
