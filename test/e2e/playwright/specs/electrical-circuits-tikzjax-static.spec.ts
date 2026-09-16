import { test, expect } from '../fixtures/auth.fixture';
import { addIdevice, editIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Static-dist regression for the TikZJax repack (scripts/static-bundle/repack-tikzjax.ts).
 *
 * The static build strips the 214 base64 gzip data URIs out of the vendored
 * edition/tikzjax.js into tikzjax-payload.bin.zst and packs the 140 BaKoMa
 * TTFs into fonts.pack.zst. This spec exercises the real dist in a real
 * browser: the served shell must contain no embedded URIs, the asset hook
 * must resolve payload bytes through fetch + fzstd, and loadTikzFont must
 * parse a real font out of the pack.
 *
 * The `-static` suffix keeps this out of the dynamic (server-mode) projects,
 * where the pristine vendored file and loose TTFs are still served.
 */
test.describe('electrical-circuits TikZJax repack (static dist)', () => {
    test('resolves TeX assets and fonts from the zstd sidecars', async ({ page }) => {
        await gotoWorkarea(page);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await addIdevice(page, 'electrical-circuits');

        const node = page.locator('#node-content article .idevice_node.electrical-circuits').first();
        const nodeId = await node.getAttribute('id');
        await editIdevice(page, nodeId!);

        // Entering edit mode loads editionJs, including the repacked shell,
        // which installs the asset hook.
        await page.waitForFunction(() => typeof (globalThis as any).__exeTikzAsset === 'function', undefined, {
            timeout: 30000,
        });

        // The served shell carries no embedded payloads anymore.
        const tikzResponse = await page.request.get('/files/perm/idevices/base/electrical-circuits/edition/tikzjax.js');
        expect(tikzResponse.ok()).toBeTruthy();
        expect(await tikzResponse.text()).not.toContain('data:application/gzip;base64');

        // A real TeX asset resolves through fetch + fzstd + header slicing.
        const assetLength = await page.evaluate(async () => {
            const bytes = await (globalThis as any).__exeTikzAsset(0);
            return bytes ? bytes.length : 0;
        });
        expect(assetLength).toBeGreaterThan(0);

        // The font pack resolves and the custom TTF parser accepts the bytes.
        const font = await page.evaluate(async () => {
            const device = (window as any).$exeDevice;
            const parsed = await device.loadTikzFont('cmr10');
            return parsed ? { unitsPerEm: parsed.unitsPerEm } : null;
        });
        expect(font).not.toBeNull();
        expect(font!.unitsPerEm).toBeGreaterThan(0);
    });
});
