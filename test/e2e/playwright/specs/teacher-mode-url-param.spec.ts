import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, waitForServiceWorker, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * E2E: Teacher Mode is revealed in the rendered package only via the ?exe-teacher=1 URL
 * parameter — with no host-injected CSS/JS.
 *
 * Exercises the real browser/preview path (Service-Worker-served viewer), which loads the
 * same base.css + exe_export.js runtime as the HTML5/SCORM/IMS exports. The runtime applies
 * the `mode-teacher` class on <html> early (in <head>); base.css hides `.teacher-only`
 * content unless that class is present.
 *
 * The `.teacher-only` markup + hide rule are covered by
 * test/integration/teacher-mode-toggle.spec.ts; the bootstrap logic by
 * public/app/common/exe_export.test.js. This spec verifies the end-to-end browser wiring:
 * the URL parameter (and only the URL parameter) toggles `mode-teacher` on the viewer root.
 */
test.describe('Teacher Mode URL parameter (preview/export runtime)', () => {
    test('toggles mode-teacher on the viewer only via the URL parameter', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const uuid = await createProject(page, 'Teacher Mode URL Param Test');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await waitForServiceWorker(page);

        // Open the preview panel (same pattern as preview-page-updates.spec.ts).
        await page.locator('#head-bottom-preview').click();
        await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('#preview-iframe')).toBeVisible({ timeout: 10000 });

        const html = page.frameLocator('#preview-iframe').locator('html');

        // Meaningful "viewer has loaded" signal: the early <head> script tags <html> with `js`.
        await expect(html).toHaveClass(/\bjs\b/, { timeout: 15000 });
        // Default = student view: not in teacher mode.
        await expect(html).not.toHaveClass(/\bmode-teacher\b/);

        // Reveal: the host only appends ?exe-teacher=1 to the iframe URL — no injected CSS/JS.
        await page.evaluate(() => {
            const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
            iframe.contentWindow!.location.search = '?exe-teacher=1';
        });
        await expect(html).toHaveClass(/\bmode-teacher\b/, { timeout: 15000 });

        // ?exe-teacher=0 forces the student view again.
        await page.evaluate(() => {
            const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
            iframe.contentWindow!.location.search = '?exe-teacher=0';
        });
        await expect(html).not.toHaveClass(/\bmode-teacher\b/, { timeout: 15000 });
    });
});
