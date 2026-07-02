import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import { waitForAppReady, openElpFile, openPreviewPanel, getPreviewFrame } from '../helpers/workarea-helpers';

/**
 * External media in the opaque preview must play by being relayed to the trusted
 * PARENT (editor) and overlaid in-place — automatically, with NO click — exactly like
 * the host plugins. The embed shim (exe_embed_shim.js) runs inside the opaque preview
 * iframe and replaces each cross-origin embed with a geometry placeholder; the editor-side
 * relay (exe_embed_relay.js) overlays the real player positioned over that placeholder.
 *
 * Server-only: the shim ships in the HTTP-served preview content. The fixture carries a
 * cross-origin YouTube embed in its content.xml (so it survives import into the Y.Doc).
 */
test.describe('Opaque preview relays external media to the parent (no click)', () => {
    test.skip(({ baseURL }) => !!baseURL && baseURL.includes('3002'), 'HTTP preview session requires the server');

    test('promotes the embed out of the opaque frame and overlays the player in-place, no click', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Media relay');
        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);
        await openElpFile(page, path.join(process.cwd(), 'test/fixtures/opaque-preview-external-media.elpx'));
        await page.waitForTimeout(1500);

        await openPreviewPanel(page);
        const frame = getPreviewFrame(page);

        // Inside the opaque frame: the shim promoted the cross-origin embed to a geometry
        // placeholder; no raw external iframe, and no click-to-open placeholder remains.
        await expect
            .poll(async () => frame.locator('[data-exe-embed-id]').count(), { timeout: 15000 })
            .toBeGreaterThan(0);
        expect(await frame.locator('iframe[src*="youtube"]').count()).toBe(0);
        expect(await frame.locator('.exe-external-media').count()).toBe(0);

        // The frame is opaque (isolated from the editor).
        const origin = await frame.locator('body').evaluate(() => String(window.origin));
        expect(origin).toBe('null');

        // In the editor (parent): the relay overlaid the REAL player in-place, with no click.
        await expect
            .poll(async () => page.locator('.exe-embed-overlay iframe[src*="youtube"]').count(), { timeout: 15000 })
            .toBeGreaterThan(0);

        // Closing the preview must tear the overlay down — no video left floating over the editor.
        await page.locator('#previewsidenavclose').click();
        await expect.poll(async () => page.locator('.exe-embed-overlay iframe').count(), { timeout: 10000 }).toBe(0);

        // Reopening rebuilds the overlay (the iframe reloads → shim re-reports).
        await openPreviewPanel(page);
        await expect
            .poll(async () => page.locator('.exe-embed-overlay iframe[src*="youtube"]').count(), { timeout: 15000 })
            .toBeGreaterThan(0);
    });
});
