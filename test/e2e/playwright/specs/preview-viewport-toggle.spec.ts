import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * E2E Tests for the preview viewport toggle (issue #1837).
 *
 * The preview toolbar has a mobile/desktop toggle button. Clicking it should
 * constrain the preview iframe to a phone-sized width (centered) and mark the
 * button as active; clicking again restores the full-width desktop view.
 */

test.describe('Preview viewport toggle', () => {
    test('should toggle the preview between mobile and desktop viewports', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Preview Viewport Toggle Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Open the preview panel and wait until it is actually slid in (active),
        // otherwise its toolbar sits off-screen behind the translateX transform.
        const panel = page.locator('#previewsidenav');
        await page.locator('#head-bottom-preview').click();
        await expect(panel).toHaveClass(/active/, { timeout: 15000 });
        await page.locator('#preview-iframe').waitFor({ state: 'attached', timeout: 10000 });

        const mobileButton = page.locator('#preview-mobile-button');
        const panelBody = page.locator('#previewsidenav .preview-panel-body');

        // Default: desktop viewport.
        await expect(mobileButton).toHaveAttribute('aria-pressed', 'false');
        await expect(panelBody).not.toHaveClass(/preview-mobile-viewport/);

        // Switch to mobile.
        await mobileButton.click();
        await expect(mobileButton).toHaveAttribute('aria-pressed', 'true');
        await expect(panelBody).toHaveClass(/preview-mobile-viewport/);

        // Iframe is constrained to a phone-sized width.
        const iframeWidth = await page.locator('#preview-iframe').evaluate(el => el.getBoundingClientRect().width);
        expect(iframeWidth).toBeLessThanOrEqual(420);

        // Switch back to desktop.
        await mobileButton.click();
        await expect(mobileButton).toHaveAttribute('aria-pressed', 'false');
        await expect(panelBody).not.toHaveClass(/preview-mobile-viewport/);
    });
});
