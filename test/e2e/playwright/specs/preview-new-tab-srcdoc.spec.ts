import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import { waitForAppReady, gotoWorkarea, openElpFile, openPreviewPanel } from '../helpers/workarea-helpers';

/**
 * Static/PWA (and embedded) use the srcdoc transport: the preview has no server URL,
 * so "open in new tab" opens the same-origin preview-host page (preview-tab.html) and
 * the editor pushes the rendered page HTML to it over postMessage. The host page frames
 * that HTML in an opaque iframe and runs the embed relay, so external video plays in the
 * new tab — the whole point, since a bare srcdoc has no way to open in a tab at all.
 *
 * Static-only: in server mode the HTTP transport uses ?session instead (covered by
 * preview-external-media-relay.spec.ts).
 */
test.describe('Static preview opens in a new tab via the host page (srcdoc handoff)', () => {
    test.skip(
        ({ baseURL }) => !baseURL || !baseURL.includes('3002'),
        'srcdoc handoff is the static/embedded transport',
    );

    test('pushes rendered HTML to the host tab and plays the video there', async ({ page, createProject, context }) => {
        const uuid = await createProject(page, 'New tab srcdoc');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await openElpFile(page, path.join(process.cwd(), 'test/fixtures/opaque-preview-external-media.elpx'));
        await page.waitForTimeout(2000);
        await openPreviewPanel(page);

        const popupPromise = context.waitForEvent('page');
        await page.locator('#preview-extract-button').click();
        const popup = await popupPromise;
        await popup.waitForLoadState('domcontentloaded');
        // The host page, not the raw content: srcdoc has no capability URL.
        expect(popup.url()).toContain('/preview-tab');
        expect(popup.url()).not.toContain('?session=');

        // The editor handed the rendered page HTML to the host tab (srcdoc set)...
        await expect
            .poll(async () => (await popup.locator('#exe-preview-host').getAttribute('srcdoc'))?.length ?? 0, {
                timeout: 15000,
            })
            .toBeGreaterThan(0);
        // ...and the relay overlaid the real player in-place — no click.
        await expect
            .poll(async () => popup.locator('.exe-embed-overlay iframe[src*="youtube"]').count(), { timeout: 15000 })
            .toBeGreaterThan(0);
        // The framed content is opaque (isolated from the host page).
        const framed = popup.frameLocator('#exe-preview-host');
        expect(await framed.locator('body').evaluate(() => String(window.origin))).toBe('null');
    });
});
