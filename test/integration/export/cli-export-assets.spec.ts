/**
 * CLI Export Assets Integration Test
 *
 * Tests that CLI export correctly includes assets (images, audio, etc.)
 * from the content/resources/ directory of ELP files.
 *
 * Since the v4 fixture layout, every asset lives directly under
 * `content/resources/<filename>` (no per-asset UUID subfolder). The
 * `FileSystemAssetProvider` therefore exposes each asset with `id` ==
 * `filename` and an empty `folderPath`. This test validates that flat
 * structure round-trips correctly through the export pipeline.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as fflate from 'fflate';

import {
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    Html5Exporter,
} from '../../../src/shared/export';

import { createDocumentFromElpFile, type DocumentFromElpResult } from '../../helpers/document-test-utils';

// Fixture with images
const FIXTURE_PATH = path.join(
    __dirname,
    '../../fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx',
);

// Expected assets in the fixture, flattened under content/resources/.
// Sourced by listing the fixture's `content/resources/` directory.
const EXPECTED_ASSETS: string[] = [
    '01.jpg',
    'colegio.mp3',
    'image001.jpg',
    'sq01.jpg',
    'sq02.jpg',
    'sq03.jpg',
    '00.jpg',
];

// Reference export fixture path
const EXPECTED_EXPORT_DIR = path.join(
    __dirname,
    '../../fixtures/export/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion_web',
);

describe('CLI Export Assets', () => {
    let documentResult: DocumentFromElpResult;
    let extractedPath: string;

    beforeAll(async () => {
        // Verify fixture exists
        const fixtureExists = await fs.pathExists(FIXTURE_PATH);
        if (!fixtureExists) {
            throw new Error(`Fixture not found: ${FIXTURE_PATH}`);
        }

        // Load the document
        documentResult = await createDocumentFromElpFile(FIXTURE_PATH);
        extractedPath = documentResult.extractedPath;
    });

    afterAll(async () => {
        // Clean up extracted directory
        await documentResult?.cleanup();
    });

    describe('FileSystemAssetProvider', () => {
        it('should find assets in content/resources/ directory', async () => {
            const assetProvider = new FileSystemAssetProvider(extractedPath);
            const assets = await assetProvider.getAllAssets();

            // Should find assets
            expect(assets.length).toBeGreaterThan(0);
            console.log(`[Test] Found ${assets.length} assets`);
        });

        it('should expose flat asset id/filename for each resource', async () => {
            const assetProvider = new FileSystemAssetProvider(extractedPath);
            const assets = await assetProvider.getAllAssets();

            const expectedFile = EXPECTED_ASSETS[0]; // '01.jpg'
            const foundAsset = assets.find(a => a.id === expectedFile);

            // v4 assets are flat: id == filename, no folderPath
            expect(foundAsset).toBeDefined();
            expect(foundAsset?.filename).toBe(expectedFile);
            expect(foundAsset?.folderPath ?? '').toBe('');
            expect(foundAsset?.id).not.toContain('content/resources/');
            expect(foundAsset?.id).not.toContain('/');

            console.log(`[Test] Asset ID: ${foundAsset?.id}`);
            console.log(`[Test] Asset filename: ${foundAsset?.filename}`);
        });

        it('should find every expected asset file by flat id', async () => {
            const assetProvider = new FileSystemAssetProvider(extractedPath);
            const assets = await assetProvider.getAllAssets();

            for (const filename of EXPECTED_ASSETS) {
                const foundAsset = assets.find(a => a.id === filename);
                expect(foundAsset).toBeDefined();
                if (!foundAsset) {
                    console.error(`[Test] Missing asset: ${filename}`);
                }
            }
        });

        it('should yield unique ids across the resources directory', async () => {
            const assetProvider = new FileSystemAssetProvider(extractedPath);
            const assets = await assetProvider.getAllAssets();

            const ids = assets.map(a => a.id);
            const unique = new Set(ids);
            expect(unique.size).toBe(ids.length);
        });
    });

    describe('HTML5 Export with Assets', () => {
        it('should include assets in the exported ZIP', async () => {
            const publicDir = path.resolve(process.cwd(), 'public');
            const resourceProvider = new FileSystemResourceProvider(publicDir);
            const assetProvider = new FileSystemAssetProvider(extractedPath);
            const zipProvider = new FflateZipProvider();

            const exporter = new Html5Exporter(documentResult.document, resourceProvider, assetProvider, zipProvider);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Extract the ZIP and check for assets
            const zipBuffer = result.data!;
            const unzipped = fflate.unzipSync(new Uint8Array(zipBuffer));

            const zipFiles = Object.keys(unzipped);

            // Expected paths are flat: content/resources/{filename}
            for (const filename of EXPECTED_ASSETS) {
                const expectedPath = `content/resources/${filename}`;
                const found = zipFiles.some(f => f === expectedPath);

                expect(found).toBe(true);
                if (!found) {
                    console.error(`[Test] Missing asset: ${expectedPath}`);
                    console.error(
                        `[Test] Available paths with resources:`,
                        zipFiles.filter(f => f.includes('resources')),
                    );
                }
            }
        });

        it('should match reference export structure for assets', async () => {
            // Skip if reference export doesn't exist
            const refExists = await fs.pathExists(EXPECTED_EXPORT_DIR);
            if (!refExists) {
                console.log('[Test] Skipping reference comparison - fixture not found');
                return;
            }

            const publicDir = path.resolve(process.cwd(), 'public');
            const resourceProvider = new FileSystemResourceProvider(publicDir);
            const assetProvider = new FileSystemAssetProvider(extractedPath);
            const zipProvider = new FflateZipProvider();

            const exporter = new Html5Exporter(documentResult.document, resourceProvider, assetProvider, zipProvider);
            const result = await exporter.export();

            expect(result.success).toBe(true);

            // Extract and compare asset filenames (the reference export may still
            // use the legacy UUID-folder layout, so compare by filename only).
            const zipBuffer = result.data!;
            const unzipped = fflate.unzipSync(new Uint8Array(zipBuffer));
            const zipFilenames = new Set(
                Object.keys(unzipped)
                    .filter(p => p.startsWith('content/resources/'))
                    .map(p => path.basename(p)),
            );

            const expectedAssetsDir = path.join(EXPECTED_EXPORT_DIR, 'content/resources');
            if (await fs.pathExists(expectedAssetsDir)) {
                const referenceFilenames = new Set<string>();
                const walk = async (dir: string) => {
                    for (const entry of await fs.readdir(dir)) {
                        const full = path.join(dir, entry);
                        const stat = await fs.stat(full);
                        if (stat.isDirectory()) {
                            await walk(full);
                        } else {
                            referenceFilenames.add(entry);
                        }
                    }
                };
                await walk(expectedAssetsDir);

                for (const filename of referenceFilenames) {
                    expect(zipFilenames.has(filename)).toBe(true);
                    if (!zipFilenames.has(filename)) {
                        console.error(`[Test] Reference filename missing in export: ${filename}`);
                    }
                }
            }
        });
    });
});
