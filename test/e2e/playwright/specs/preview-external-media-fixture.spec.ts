import { test, expect } from '../fixtures/auth.fixture';
import { skipInStaticMode } from '../fixtures/auth.fixture';
import { getPreviewFrame, openElpFile, openPreviewPanel, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Validates the committed demo fixture `external-media-demo.elpx`: importing it
 * yields the 5 media pages, the default filtered preview raises the
 * active-content indicator (the external iframes are author active content),
 * and enabling switches to the opaque capability-URL preview where the
 * YouTube/Vimeo embeds become the "open in a new tab" placeholder. This is the
 * fixture attached to the PR for manual testing, kept honest by a regression.
 */
test.describe('External media demo fixture', () => {
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Opaque snapshot needs the server capability routes');
    });

    test('imports 5 pages, raises the active-content warning, and isolates on enable', async ({
        authenticatedPage,
    }) => {
        const page = authenticatedPage;
        await page.goto('/workarea');
        await waitForAppReady(page);
        await openElpFile(page, 'test/fixtures/external-media-demo.elpx', 5);

        // Five pages imported.
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).eXeLearning.app.project._yjsBridge.documentManager.getNavigation().length,
                ),
            )
            .toBe(5);

        // Default filtered preview: the external YouTube/Vimeo iframes are author
        // active content, so the indicator is shown and disabled by default.
        await page.locator('#head-bottom-preview').click();
        await openPreviewPanel(page);
        const warning = page.locator('#preview-active-content-button');
        await expect(warning).toBeVisible();
        await expect(warning).toHaveAttribute('aria-pressed', 'false');

        // Enable → opaque capability-URL preview.
        await warning.click();
        const modal = page.locator('#modalConfirm');
        await expect(modal).toContainText('isolated context');
        await modal.getByRole('button', { name: 'Enable custom JavaScript for this preview' }).click();
        await expect(warning).toHaveAttribute('aria-pressed', 'true');

        const iframe = page.locator('#preview-iframe');
        await expect.poll(async () => (await iframe.getAttribute('src')) ?? '').toContain('/preview-snapshot/');
        const sandbox = await iframe.getAttribute('sandbox');
        expect(sandbox).not.toContain('allow-same-origin');

        // The external embeds became accessible "open in a new tab" placeholders,
        // while the local <video> is retained (it is not active content).
        const frame = getPreviewFrame(page);
        await expect.poll(() => frame.locator('.exe-external-media-fallback').count()).toBeGreaterThan(0);
    });
});
