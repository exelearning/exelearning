import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, waitForServiceWorker, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * E2E: Teacher Mode visibility is driven entirely by the ?exe-teacher URL parameter on the
 * rendered package — no host-injected CSS/JS.
 *
 * eXeLearning's own authoring preview reveals Teacher Mode BY DEFAULT (the author is the
 * teacher), so the preview panel appends ?exe-teacher=1 to the viewer URL. The parameter
 * still controls visibility: ?exe-teacher=0 forces the student view. Exported packages stay
 * hidden by default (covered by test/integration/teacher-mode-toggle.spec.ts and the Vitest
 * bootstrap tests).
 *
 * The runtime applies the `mode-teacher` class on <html> early (in <head>); base.css hides
 * `.teacher-only` content unless that class is present.
 */
test.describe('Teacher Mode URL parameter (preview/export runtime)', () => {
    test('preview reveals Teacher Mode by default and the URL parameter controls it', async ({
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
        // The authoring preview reveals Teacher Mode by default (panel appends ?exe-teacher=1).
        await expect(html).toHaveClass(/\bmode-teacher\b/, { timeout: 15000 });

        // ?exe-teacher=0 forces the student view (the parameter controls visibility).
        await page.evaluate(() => {
            const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
            iframe.contentWindow!.location.search = '?exe-teacher=0';
        });
        await expect(html).not.toHaveClass(/\bmode-teacher\b/, { timeout: 15000 });

        // Re-revealing via the parameter restores the teacher view — no injected CSS/JS.
        await page.evaluate(() => {
            const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
            iframe.contentWindow!.location.search = '?exe-teacher=1';
        });
        await expect(html).toHaveClass(/\bmode-teacher\b/, { timeout: 15000 });
    });
});
