import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';

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
 * Read the pass score stored in the live Y.Doc.
 */
function readStoredPassScore(page: import('@playwright/test').Page): Promise<unknown> {
    return page.evaluate(() => {
        const bridge = (window as any).eXeLearning.app.project._yjsBridge;
        return bridge.getDocumentManager().getMetadata().get('passScore');
    });
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
});
