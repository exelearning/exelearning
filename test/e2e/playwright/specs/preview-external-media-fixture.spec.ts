import { test, expect } from '../fixtures/auth.fixture';
import { skipInStaticMode } from '../fixtures/auth.fixture';
import { getPreviewFrame, openElpFile, openPreviewPanel, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Validates the committed demo fixture `external-media-demo.elpx`: importing it
 * yields the 6 media pages, the default filtered preview raises the
 * active-content indicator (the external iframes are author active content),
 * and enabling switches to the opaque capability-URL preview where the
 * YouTube/Vimeo embeds become the "open in a new tab" placeholder. It also
 * asserts the filtered-vs-opaque contrast on the author `<script>` page. This
 * is the fixture attached to the PR for manual testing, kept honest here.
 */
const AUTHOR_SCRIPT_MARKER = "getElementById('exe-js-demo')";
test.describe('External media demo fixture', () => {
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Opaque snapshot needs the server capability routes');
    });

    test('imports 6 pages, raises the active-content warning, and isolates on enable', async ({
        authenticatedPage,
    }) => {
        const page = authenticatedPage;
        await page.goto('/workarea');
        await waitForAppReady(page);
        await openElpFile(page, 'test/fixtures/external-media-demo.elpx', 6);

        // Six pages imported.
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).eXeLearning.app.project._yjsBridge.documentManager.getNavigation().length,
                ),
            )
            .toBe(6);

        // Filtered-vs-opaque contrast on the author <script> page: the filtered
        // generation strips it; the report-only (opaque) generation keeps it.
        const contrast = await page.evaluate(async marker => {
            const app = (window as any).eXeLearning.app;
            const panel = app.interface?.previewButton?.getPanel?.();
            const hasMarker = (result: any) =>
                Object.values(result.files || {}).some((c: any) => {
                    const text = typeof c === 'string' ? c : new TextDecoder().decode(c);
                    return text.includes(marker);
                });
            const filtered = await panel._generatePreviewFiles();
            const opaque = await panel._generatePreviewFiles({ forOpaqueSnapshot: true });
            return { filteredHasScript: hasMarker(filtered), opaqueHasScript: hasMarker(opaque) };
        }, AUTHOR_SCRIPT_MARKER);
        expect(contrast.filteredHasScript).toBe(false);
        expect(contrast.opaqueHasScript).toBe(true);

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
