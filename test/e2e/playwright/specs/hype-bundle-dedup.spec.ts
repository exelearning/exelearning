/**
 * E2E regression test for self-contained HTML bundle de-duplication (#1951 / PR #1954).
 *
 * Self-contained HTML bundles (e.g. Tumult Hype exports) ship the SAME runtime file
 * byte-for-byte under different relative paths:
 *
 *   bundle-a/index.html
 *   bundle-a/index.hyperesources/HYPE-runtime.js   <- byte-identical to bundle-b's
 *   bundle-b/index.html
 *   bundle-b/index.hyperesources/HYPE-runtime.js   <- byte-identical to bundle-a's
 *
 * eXeLearning stores assets content-addressed (assetId = hashToUUID(hash)). Without the
 * fix, the second byte-identical HYPE-runtime.js collapsed onto the first asset and
 * overwrote its folderPath, so one bundle's relative <script src> link 404'd.
 *
 * PR #1954 + the #1951 follow-ups make the ZIP-extraction and upload paths opt out of
 * content-hash dedup (forceNewId / per-import duplicate detection) so byte-identical
 * files at distinct relative paths stay distinct assets, each keeping its own folderPath.
 *
 * This spec drives the File Manager through the real user flow:
 *   File Manager -> Upload a synthetic 2-bundle ZIP -> More -> Extract ZIP -> confirm,
 * then asserts both bundle-a and bundle-b still own their HYPE-runtime.js (distinct asset
 * IDs, identical bytes, distinct folderPaths) — i.e. neither bundle's runtime was lost.
 */

import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { zipSync } from 'fflate';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';

// Byte-identical runtime shared by both bundles (no copyrighted content — dummy JS).
const HYPE_RUNTIME_JS =
    '// dummy HYPE runtime\nwindow.HYPE = window.HYPE || {};\nHYPE.bootstrap = function () { return 42; };\n';

/**
 * Open the File Manager modal via the Utilities menu (works without an editable
 * iDevice selected, which keeps the test independent of TinyMCE state).
 */
async function openFileManager(page: Page): Promise<void> {
    await page.locator('#dropdownUtilities').click();
    await page.locator('#navbar-button-filemanager').click();
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });
    // Wait for the grid to be ready (empty grid is fine).
    await page.waitForSelector('#modalFileManager .media-library-grid', { state: 'attached', timeout: 10000 });
}

/**
 * Build the synthetic two-bundle ZIP on disk and return its absolute path.
 * The HYPE-runtime.js content is identical in both bundles (same bytes -> same hash).
 */
function buildHypeBundleZip(tempDir: string): string {
    const runtimeBytes = new TextEncoder().encode(HYPE_RUNTIME_JS);
    const htmlA = new TextEncoder().encode(
        '<!doctype html><html><head><script src="index.hyperesources/HYPE-runtime.js"></script></head><body>A</body></html>',
    );
    const htmlB = new TextEncoder().encode(
        '<!doctype html><html><head><script src="index.hyperesources/HYPE-runtime.js"></script></head><body>B</body></html>',
    );

    const zipped = zipSync({
        'bundle-a/index.html': htmlA,
        'bundle-a/index.hyperesources/HYPE-runtime.js': runtimeBytes,
        'bundle-b/index.html': htmlB,
        'bundle-b/index.hyperesources/HYPE-runtime.js': runtimeBytes,
    });

    const zipPath = path.join(tempDir, 'hype-bundles.zip');
    fs.writeFileSync(zipPath, zipped);
    return zipPath;
}

test.describe('Hype bundle de-duplication (#1951 / #1954)', () => {
    let tempDir: string;

    test.beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exe-hype-dedup-'));
    });

    test.afterAll(() => {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('extracting a ZIP with byte-identical bundle runtimes keeps both bundles intact', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        // Extraction + per-asset inspection relies on the online AssetManager/IndexedDB flow.
        skipInStaticMode(test, testInfo, 'Hype bundle ZIP extraction de-dup');

        const page = authenticatedPage;

        // 1. Create and open a fresh project (online-mode aware helper).
        const projectUuid = await createProject(page, 'Hype Bundle Dedup Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Build the synthetic two-bundle ZIP (byte-identical HYPE-runtime.js in both).
        const zipPath = buildHypeBundleZip(tempDir);

        // 2. Open File Manager.
        await openFileManager(page);

        // 3. Upload the synthetic ZIP via the hidden upload input.
        const uploadInput = page.locator('#modalFileManager .media-library-upload-input');
        await uploadInput.setInputFiles(zipPath);

        // 4. Verify the ZIP appears as a single file item in the grid.
        const zipItem = page.locator(
            '#modalFileManager .media-library-item[data-filename$=".zip"]:not(.media-library-folder)',
        );
        await expect(zipItem).toHaveCount(1, { timeout: 15000 });

        // 5. Select the ZIP item (single click selects it for the footer actions).
        await zipItem.first().click();

        // The Extract option is only enabled/visible for a selected ZIP file.
        await page.waitForFunction(
            () => {
                const btn = document.querySelector('#modalFileManager .media-library-extract-btn');
                return btn instanceof HTMLElement && !btn.classList.contains('d-none');
            },
            undefined,
            { timeout: 10000 },
        );

        // 6. Open the More (three-dots) dropdown in the footer.
        const moreBtn = page.locator('#modalFileManager .media-library-more-btn');
        await expect(moreBtn).toBeEnabled({ timeout: 10000 });
        await moreBtn.click();

        // 7. Click the "Extract ZIP" option.
        const extractBtn = page.locator('#modalFileManager .media-library-extract-btn');
        await extractBtn.waitFor({ state: 'visible', timeout: 10000 });
        await extractBtn.click();

        // 8. The extract dialog reuses the rename dialog — accept the suggested folder name.
        const extractDialog = page.locator('#modalFileManager .media-library-rename-dialog');
        await extractDialog.waitFor({ state: 'visible', timeout: 10000 });
        await page.locator('#modalFileManager .rename-dialog-confirm').click();

        // 9. Wait for extraction to complete: both bundle-a and bundle-b folders must appear at root.
        await page.waitForFunction(
            () => {
                const folders = Array.from(
                    document.querySelectorAll('#modalFileManager .media-library-folder[data-folder-name]'),
                ).map(el => (el as HTMLElement).dataset.folderName);
                return folders.includes('hype-bundles');
            },
            undefined,
            { timeout: 20000 },
        );

        // 10. The ZIP extracted into a folder named after the archive ("hype-bundles").
        //     Navigate into it; bundle-a and bundle-b should both be present.
        const rootFolder = page.locator('#modalFileManager .media-library-folder[data-folder-name="hype-bundles"]');
        await rootFolder.dblclick();

        await page.waitForFunction(
            () => {
                const folders = Array.from(
                    document.querySelectorAll('#modalFileManager .media-library-folder[data-folder-name]'),
                ).map(el => (el as HTMLElement).dataset.folderName);
                return folders.includes('bundle-a') && folders.includes('bundle-b');
            },
            undefined,
            { timeout: 15000 },
        );

        const bundleA = page.locator('#modalFileManager .media-library-folder[data-folder-name="bundle-a"]');
        const bundleB = page.locator('#modalFileManager .media-library-folder[data-folder-name="bundle-b"]');
        await expect(bundleA).toHaveCount(1);
        await expect(bundleB).toHaveCount(1);

        // 11. THE FIX: inspect the stored assets directly. Both bundles must keep their own
        //     HYPE-runtime.js — two assets, distinct ids, distinct folderPaths, identical bytes.
        const runtimeAssets = await page.evaluate(async () => {
            const assetManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.assetManager;
            if (!assetManager) return { error: 'No assetManager' };

            const metadata = assetManager.getAllAssetsMetadata() as Array<{
                id: string;
                filename?: string;
                folderPath?: string;
            }>;

            const runtimeMeta = metadata.filter(m => m.filename === 'HYPE-runtime.js');

            const results: Array<{ id: string; folderPath: string; bytes: number[] }> = [];
            for (const meta of runtimeMeta) {
                const asset = await assetManager.getAsset(meta.id);
                const buf = asset?.blob ? new Uint8Array(await asset.blob.arrayBuffer()) : new Uint8Array();
                results.push({
                    id: meta.id,
                    folderPath: meta.folderPath || '',
                    bytes: Array.from(buf),
                });
            }
            return { results };
        });

        expect('error' in runtimeAssets ? runtimeAssets.error : null).toBeNull();
        const results = (runtimeAssets as { results: Array<{ id: string; folderPath: string; bytes: number[] }> })
            .results;

        // Exactly two HYPE-runtime.js assets survived (one per bundle).
        expect(results).toHaveLength(2);

        // They have DISTINCT asset ids (forceNewId / per-import dedup opt-out worked).
        expect(results[0].id).not.toBe(results[1].id);

        // Each retains its own bundle folderPath (neither overwrote the other).
        const folderPaths = results.map(r => r.folderPath).sort();
        expect(folderPaths).toEqual([
            'hype-bundles/bundle-a/index.hyperesources',
            'hype-bundles/bundle-b/index.hyperesources',
        ]);

        // Their bytes are still identical (we only de-duplicated identity, not content).
        expect(results[0].bytes).toEqual(results[1].bytes);
        const expectedBytes = Array.from(new TextEncoder().encode(HYPE_RUNTIME_JS));
        expect(results[0].bytes).toEqual(expectedBytes);
    });
});
