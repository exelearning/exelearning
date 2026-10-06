import { test, expect, skipInStaticMode } from '../fixtures/collaboration.fixture';
import { waitForYjsSync } from '../helpers/sync-helpers';
import { waitForAppReady, gotoWorkarea, selectFirstPage, addIdevice, saveIdevice } from '../helpers/workarea-helpers';

/**
 * E2E Tests for the project-wide pass score (pp_passScore)
 *
 * The pass score is the mark out of 10 an activity needs to be passed. It is
 * authored once in the project properties and inherited live by every iDevice
 * that does not define its own, which means the value has to reach the rendered
 * page — the editor writing it into the Y.Doc is only half the journey.
 *
 * These tests walk that journey end to end: the field in the Export options tab,
 * the Y.Doc, and the META tag the preview page carries for the runtime to read.
 */

const PASS_SCORE_META = 'meta[name="exe-pass-score"]';
const EVERY_ACTIVITY_META = 'meta[name="exe-pass-score-every-activity"]';

/**
 * Open the project properties panel on the Export options tab.
 */
async function openExportOptions(page: import('@playwright/test').Page): Promise<void> {
    await page.locator('#head-top-settings-button').click();

    const exportTab = page.getByRole('tab', { name: /Export options|Opciones de exportación/i }).first();
    await exportTab.waitFor({ state: 'visible', timeout: 10000 });
    if ((await exportTab.getAttribute('aria-selected')) !== 'true') {
        await exportTab.click();
    }
}

/**
 * Read a project property stored in the live Y.Doc.
 */
function readStoredMetadata(page: import('@playwright/test').Page, key: string): Promise<unknown> {
    return page.evaluate(metadataKey => {
        const bridge = (window as any).eXeLearning.app.project._yjsBridge;
        return bridge.getDocumentManager().getMetadata().get(metadataKey);
    }, key);
}

/**
 * Read the pass score stored in the live Y.Doc.
 */
function readStoredPassScore(page: import('@playwright/test').Page): Promise<unknown> {
    return readStoredMetadata(page, 'passScore');
}

test.describe('Project pass score', () => {
    test('defaults to 5 and stores what the author types', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Pass Score Default');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openExportOptions(page);

        const field = page.locator('input[property="pp_passScore"]');
        await field.waitFor({ state: 'visible', timeout: 10000 });

        // A brand-new project has never been given a value, so the field shows
        // the default rather than an empty box.
        await expect(field).toHaveValue('5');
        await expect(field).toHaveAttribute('type', 'number');
        await expect(field).toHaveAttribute('min', '0');
        await expect(field).toHaveAttribute('max', '10');

        await field.fill('7.5');
        await field.blur();

        await expect
            .poll(() => readStoredPassScore(page), { timeout: 10000 })
            // Stored as a number, not as the '7.5' string the DOM hands back.
            .toBe(7.5);
    });

    test('reaches the previewed page as a META the runtime can read', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Pass Score Preview');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openExportOptions(page);

        const field = page.locator('input[property="pp_passScore"]');
        await field.waitFor({ state: 'visible', timeout: 10000 });
        await field.fill('7.5');
        await field.blur();

        await expect.poll(() => readStoredPassScore(page), { timeout: 10000 }).toBe(7.5);

        await page.click('#head-bottom-preview');
        await page.locator('#previewsidenav').waitFor({ state: 'visible', timeout: 15000 });

        const previewMeta = page.frameLocator('#preview-iframe').locator(PASS_SCORE_META);
        await previewMeta.waitFor({ state: 'attached', timeout: 30000 });
        await expect(previewMeta).toHaveAttribute('content', '7.5');

        // $exe.passScore reads that META, so the runtime accessor agrees with it.
        const runtimeValue = await page
            .frameLocator('#preview-iframe')
            .locator('body')
            .evaluate(() => (window as any).$exe.passScore.get());
        expect(runtimeValue).toBe(7.5);
    });

    test('clamps a value typed outside the 0-10 range', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Pass Score Clamp');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openExportOptions(page);

        const field = page.locator('input[property="pp_passScore"]');
        await field.waitFor({ state: 'visible', timeout: 10000 });
        await field.fill('42');
        await field.blur();

        await expect.poll(() => readStoredPassScore(page), { timeout: 10000 }).toBe(10);
        // The field is repainted from the stored value, so the author sees what
        // was actually kept rather than the 42 they typed.
        await expect(field).toHaveValue('10');
    });

    test('the every-activity rule is off by default and, once checked, reaches the previewed page', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Pass Score Every Activity');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openExportOptions(page);

        const checkbox = page.locator('input[property="pp_passScoreEveryActivity"]');
        await checkbox.scrollIntoViewIfNeeded({ timeout: 10000 });
        // Off by default, so an existing course keeps the weighted-mean rule.
        await expect(checkbox).not.toBeChecked();

        // Its help icon sits beside the label, on the same line, like the
        // other export toggles (assets/styles/pages/_properties.scss).
        const row = page.locator('.property-row[property="pp_passScoreEveryActivity"]');
        const label = (await row.locator('label').boundingBox())!;
        const icon = (await row.locator('.form-help-exe-icon').boundingBox())!;
        expect(icon.y + icon.height / 2).toBeGreaterThan(label.y);
        expect(icon.y + icon.height / 2).toBeLessThan(label.y + label.height);
        expect(icon.x).toBeGreaterThan(label.x + label.width - 4);

        // The checkbox is drawn as a toggle; click what the author sees.
        await page.locator('.toggle-item').filter({ has: checkbox }).first().click();
        await expect(checkbox).toBeChecked();
        await expect.poll(() => readStoredMetadata(page, 'passScoreEveryActivity'), { timeout: 10000 }).toBe('true');

        await page.click('#head-bottom-preview');
        await page.locator('#previewsidenav').waitFor({ state: 'visible', timeout: 15000 });

        const previewMeta = page.frameLocator('#preview-iframe').locator(EVERY_ACTIVITY_META);
        await previewMeta.waitFor({ state: 'attached', timeout: 30000 });
        await expect(previewMeta).toHaveAttribute('content', 'true');

        // $exe.passScore reads that META, so the runtime accessor agrees with it.
        const runtimeValue = await page
            .frameLocator('#preview-iframe')
            .locator('body')
            .evaluate(() => (window as any).$exe.passScore.requiresEveryActivity());
        expect(runtimeValue).toBe(true);
    });

    test.describe('with a collaborator', () => {
        // Project sharing needs the server's WebSocket rooms, which a static
        // build does not have. The skip has to run in a hook: the second
        // client's fixture is set up before the test body, and in a static
        // build it waits for a workarea that never comes.
        test.beforeEach(async ({}, testInfo) => {
            skipInStaticMode(test, testInfo, 'Requires WebSocket project sharing');
        });

        test('updates inherited notices after a collaborator changes the mark without resetting answers', async ({
            authenticatedPage: page,
            secondAuthenticatedPage: peer,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            test.setTimeout(120000);
            const uuid = await createProject(page, 'Live pass score notice');
            await gotoWorkarea(page, uuid);
            await waitForAppReady(page);
            await selectFirstPage(page);
            await addIdevice(page, 'rubric');
            await page.locator('#ri_CreateNewRubric').click();
            const rubric = page.locator('#node-content .idevice_node.rubric');
            const rubricId = (await rubric.getAttribute('id'))!;
            await page
                .locator('.exe-form-tabs a')
                .filter({ hasText: /^Grading$/ })
                .click();
            await page.locator('#eXeProgressReport').check();
            await saveIdevice(page, rubricId);

            await joinSharedProject(peer, await getShareUrl(page));
            await waitForYjsSync(page);
            await waitForYjsSync(peer);
            await openExportOptions(peer);
            const field = peer.locator('input[property="pp_passScore"]');
            await expect(field).toHaveValue('5');
            const notice = rubric.locator('.exe-pass-score-notice');
            await expect(notice).toHaveCount(0);

            const answer = rubric.locator('tbody input[type="checkbox"]').first();
            await answer.check();
            const originalActivity = await rubric.elementHandle();
            const readProgress = () =>
                page.evaluate(id => {
                    const game = (window as any).$rubric.options.find(
                        (data: any) => data.scormGame?.main === id,
                    ).scormGame;
                    return { score: game.scorerp, started: game.gameStarted, completed: game.gameOver };
                }, rubricId);
            const progress = await readProgress();

            for (const mark of [3, 9, 5, 7.5]) {
                await field.fill(String(mark));
                await field.blur();
                await expect.poll(() => readStoredPassScore(page)).toBe(mark);
                if (mark === 5) {
                    await expect(notice).toHaveCount(0);
                } else {
                    await expect(notice).toHaveText(`Minimum score needed to pass this activity: ${mark}`);
                    await expect(notice).toHaveCount(1);
                }
                await expect(answer).toBeChecked();
                expect(await originalActivity!.evaluate(element => element.isConnected)).toBe(true);
                expect(await readProgress()).toEqual(progress);
            }
            await originalActivity!.dispose();
        });
    });
});
