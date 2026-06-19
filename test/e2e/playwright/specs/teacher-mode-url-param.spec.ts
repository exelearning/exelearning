import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, waitForServiceWorker, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * E2E: Teacher Mode is driven by the ?exe-teacher URL parameter on the rendered package,
 * with no host-injected CSS/JS.
 *
 * Contract: ?exe-teacher=1 makes the in-page self-serve toggle AVAILABLE (it never reveals
 * content on its own — the viewer activates the toggle, OFF by default). Without the
 * parameter there is no toggle and teacher content stays hidden. eXeLearning's own authoring
 * preview loads the viewer with ?exe-teacher=1, so the toggle is available in the preview.
 *
 * This spec verifies that real-browser wiring through the SW-served preview: the runtime
 * reads the parameter and decides whether the toggle is available. The toggle's DOM, its
 * OFF-by-default state, and reveal-on-click are unit-tested in
 * public/app/common/exe_export.test.js; `.teacher-only` markup + the hide rule in
 * test/integration/teacher-mode-toggle.spec.ts.
 */
test.describe('Teacher Mode toggle (preview/export runtime)', () => {
    test('the preview makes the Teacher Mode toggle available only via ?exe-teacher=1', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const uuid = await createProject(page, 'Teacher Mode Toggle Test');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await waitForServiceWorker(page);

        await page.locator('#head-bottom-preview').click();
        await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('#preview-iframe')).toBeVisible({ timeout: 10000 });

        // The preview loads the viewer with ?exe-teacher=1, so the runtime makes the
        // self-serve toggle available (the parameter never reveals content on its own).
        await page.waitForFunction(
            () => {
                const w = (document.querySelector('#preview-iframe') as HTMLIFrameElement)?.contentWindow as any;
                return w?.$exeExport?.teacherMode?._showToggler === true;
            },
            undefined,
            { timeout: 15000 },
        );

        // Loading the same viewer WITHOUT the parameter leaves the toggle unavailable (student view).
        await page.evaluate(() => {
            (document.querySelector('#preview-iframe') as HTMLIFrameElement).contentWindow!.location.search = '';
        });
        await page.waitForFunction(
            () => {
                const w = (document.querySelector('#preview-iframe') as HTMLIFrameElement)?.contentWindow as any;
                return w?.$exeExport?.teacherMode?._showToggler === false;
            },
            undefined,
            { timeout: 15000 },
        );
    });
});
