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
const IDEVICE_WEIGHT_EXTENSION = 'https://exelearning.net/xapi/extensions/idevice-weight';
const IDEVICE_CENSUS_EXTENSION = 'https://exelearning.net/xapi/extensions/idevice-census';
const PAGE_COUNT_EXTENSION = 'https://exelearning.net/xapi/extensions/page-count';
const PAGE_ID_EXTENSION = 'https://exelearning.net/xapi/extensions/page-id';
const INITIALIZED_VERB = 'http://adlnet.gov/expapi/verbs/initialized';
const TERMINATED_VERB = 'http://adlnet.gov/expapi/verbs/terminated';

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

/**
 * Declare gradable iDevices from inside the preview through the SHIPPED forwarder, the
 * same one `registerActivity` calls for every gradable iDevice as a page initializes.
 */
async function registerEvaluablesInPreview(
    page: Page,
    evaluables: Array<{ ideviceId: string; ideviceNumber: number; title: string; weight: number }>,
): Promise<void> {
    await page.evaluate(payload => {
        const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
        const previewWindow = iframe?.contentWindow as any;
        const register = previewWindow?.$exeDevices?.iDevice?.gamification?.registerEvaluable;
        if (typeof register !== 'function') throw new Error('Preview evaluable registry is not available');
        for (const item of payload) {
            register({
                ideviceId: item.ideviceId,
                ideviceNumber: item.ideviceNumber,
                title: item.title,
                weighted: item.weight,
            });
        }
    }, evaluables);
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

/**
 * Consumer-side reconstruction of the package result.
 *
 * It does exactly what doc/elpx-format/tracking-emission.md tells a consumer to
 * do: keep the latest answer per stable iDevice id, sort by the emitted
 * package-global `idevice-order`, then run the SHIPPED aggregator. The
 * aggregator is called inside the preview document rather than re-implemented
 * here, so a change to the normalization in common.js fails this test instead
 * of silently drifting away from the published contract.
 */
async function reconstructLatestScore(page: Page, statements: XapiStatement[]): Promise<number> {
    const latest = new Map<string, { score: number; weight: number; order: number }>();
    for (const statement of statements) {
        if (statement.verb.id !== ANSWERED_VERB) continue;
        const extensions = statement.context?.extensions || {};
        // A scoring statement without an order cannot be placed in the package,
        // and `undefined - undefined` would silently degrade the sort to NaN.
        expect(typeof extensions[IDEVICE_ORDER_EXTENSION]).toBe('number');
        latest.set(String(extensions[IDEVICE_ID_EXTENSION]), {
            score: Number(statement.result?.score?.raw || 0) * 10,
            weight: Number(extensions[IDEVICE_WEIGHT_EXTENSION]),
            order: Number(extensions[IDEVICE_ORDER_EXTENSION]),
        });
    }

    const ordered = [...latest.values()].sort((a, b) => a.order - b.order);
    return page.evaluate(records => {
        const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
        const getFinalScore = (iframe?.contentWindow as any)?.$exeDevices?.iDevice?.gamification?.scorm?.getFinalScore;
        if (typeof getFinalScore !== 'function') throw new Error('Shipped package aggregator is not available');
        // Non-numeric keys so Object.keys() preserves the package order the
        // largest-remainder tie-break depends on.
        const lmsData: Record<string, { score: number; weighted: number }> = {};
        records.forEach((record, index) => {
            lmsData[`idevice-${index}`] = { score: record.score, weighted: record.weight };
        });
        return getFinalScore(lmsData) as number;
    }, ordered);
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

            // Page one carries TWO components so the exported order offset for page two
            // is 2, and page two's first iDevice is package-global number 3. With one
            // component per page the offset would be 1 and the composition would be
            // indistinguishable from a plain page index.
            for (const [pageId, componentId, text] of [
                [firstPageId, 'xapi-page-one-content', 'Weighted page one'],
                [firstPageId, 'xapi-page-one-second', 'Weighted page one, second'],
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

        // Both gradable iDevices of page 1 declare themselves as the page initializes,
        // which is what lets a consumer know the denominator before anything is answered.
        await registerEvaluablesInPreview(page, [
            { ideviceId: 'weighted-device-a', ideviceNumber: 1, title: 'Weighted device A', weight: 25 },
            { ideviceId: 'page-one-unanswered', ideviceNumber: 2, title: 'Never answered', weight: 10 },
        ]);
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
        // Both gradable iDevices of the page are in the aggregate: the answered one and
        // the one seeded at 0 by its registration. Normalising over the answered subset
        // alone is what used to inflate a partial attempt.
        expect(await getPreviewStateKeys(page)).toEqual(['1', '2']);

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
        // A fresh document: the page-local aggregate starts empty again.
        expect(await getPreviewStateKeys(page)).toEqual([]);

        await registerEvaluablesInPreview(page, [
            { ideviceId: 'weighted-device-b', ideviceNumber: 1, title: 'Weighted device B', weight: 75 },
        ]);
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
            answeredVerb =>
                ((window as any).__capturedXapiStatements || []).filter(
                    (statement: XapiStatement) => statement.verb.id === answeredVerb,
                ).length === 2,
            ANSWERED_VERB,
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
        expect(answered.map(statement => statement.context?.extensions?.[IDEVICE_WEIGHT_EXTENSION])).toEqual([25, 75]);
        // The offset composes across pages: page two's first iDevice is package-global
        // number 3, not number 1 of its own document.
        expect(answered.map(statement => statement.context?.extensions?.[IDEVICE_ORDER_EXTENSION])).toEqual([1, 3]);
        expect(answered[0].object.id).not.toBe(answered[1].object.id);

        // The learner scored 100 at weight 25 and 40 at weight 75 -> 55, a value
        // neither page could compute on its own. Only the per-iDevice stream,
        // ordered by idevice-order, carries enough to rebuild it.
        expect(await reconstructLatestScore(page, answered)).toBe(55);

        // And no page claims a package verdict of its own: page 1 would have
        // reported "passed" with raw 100 and page 2 "failed" with raw 40 for the
        // same Activity IRI in the same attempt (#2302).
        // Each page announces itself with its own identity and the package size, all
        // of it injected by the exporter — the runtime tracker supplies none of it.
        const initialized = statements.filter(statement => statement.verb.id === INITIALIZED_VERB);
        expect(initialized).toHaveLength(2);
        expect(initialized.map(s => s.context?.extensions?.[PAGE_COUNT_EXTENSION])).toEqual([2, 2]);
        const pageIds = initialized.map(s => s.context?.extensions?.[PAGE_ID_EXTENSION]);
        expect(pageIds.every(id => typeof id === 'string' && id.length > 0)).toBe(true);
        expect(new Set(pageIds).size).toBe(2);
        // `initialized` is flushed on a macrotask right after DOM-ready, before this
        // test can drive any registration, so its census is legitimately empty here.
        // A real iDevice registers from a jQuery ready handler, which runs inside the
        // same DOMContentLoaded dispatch and therefore lands before that macrotask.
        expect(initialized.every(s => Array.isArray(s.context?.extensions?.[IDEVICE_CENSUS_EXTENSION]))).toBe(true);

        // The page-unload copy is the complete one, and it is what proves the census
        // survives a late registration. Page one's census carries the iDevice that is
        // never answered — the record no `answered` statement could ever provide, and
        // the reason a partial attempt can be scored at all.
        const terminated = statements.filter(statement => statement.verb.id === TERMINATED_VERB);
        expect(terminated).toHaveLength(1);
        expect(terminated[0].context?.extensions?.[IDEVICE_CENSUS_EXTENSION]).toEqual([
            { 'idevice-id': 'weighted-device-a', 'idevice-weight': 25, 'idevice-order': 1 },
            { 'idevice-id': 'page-one-unanswered', 'idevice-weight': 10, 'idevice-order': 2 },
        ]);
        expect(terminated[0].result).toBeUndefined();

        expect(statements.filter(statement => statement.verb.id === COMPLETED_VERB)).toHaveLength(0);
        expect(statements.filter(statement => statement.verb.id === PASSED_VERB)).toHaveLength(0);
        expect(statements.filter(statement => statement.verb.id === FAILED_VERB)).toHaveLength(0);
    });
});
