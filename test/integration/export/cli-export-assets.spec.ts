/**
 * CLI Export Assets Integration Test
 *
 * Tests that CLI export correctly includes assets (images, audio, etc.)
 * from the content/resources/ directory of ELP files.
 *
 * This test validates that the FileSystemAssetProvider correctly
 * extracts asset UUIDs from paths like content/resources/{uuid}/{filename}
 * so they can be mapped and included in the export.
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

// Expected assets in the fixture (based on structure analysis)
const EXPECTED_ASSETS = [
    { id: '20251009090601DKVACR', files: ['01.jpg', 'colegio.mp3'] },
    { id: '20251009090601IYVTRY', files: ['image001.jpg'] },
    { id: '20251009090601ROYVYO', files: ['sq01.jpg', 'sq02.jpg', 'sq03.jpg'] },
    { id: '20251009090601SQPBIF', files: ['00.jpg'] },
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

        it('should extract folderPath from content/resources/{folder}/{filename}', async () => {
            const assetProvider = new FileSystemAssetProvider(extractedPath);
            const assets = await assetProvider.getAllAssets();

            // Find an asset from the expected list
            const expectedFolder = EXPECTED_ASSETS[0].id; // 20251009090601DKVACR (just a folder name)
            const expectedFile = EXPECTED_ASSETS[0].files[0]; // 01.jpg

            // Asset ID should be folder/filename for uniqueness
            const foundAsset = assets.find(a => a.id === `${expectedFolder}/${expectedFile}`);

            // The asset should have folderPath set to the folder name
            expect(foundAsset).toBeDefined();
            expect(foundAsset?.folderPath).toBe(expectedFolder);
            expect(foundAsset?.filename).toBe(expectedFile);
            // ID should not contain the full 'content/resources/' prefix
            expect(foundAsset?.id).not.toContain('content/resources/');

            console.log(`[Test] Asset ID: ${foundAsset?.id}`);
            console.log(`[Test] Asset folderPath: ${foundAsset?.folderPath}`);
            console.log(`[Test] Asset filename: ${foundAsset?.filename}`);
        });

        it('should find all expected asset files', async () => {
            const assetProvider = new FileSystemAssetProvider(extractedPath);
            const assets = await assetProvider.getAllAssets();

            // For each expected folder, check that all files are found
            for (const expected of EXPECTED_ASSETS) {
                for (const filename of expected.files) {
                    // Asset ID format: folder/filename
                    const expectedId = `${expected.id}/${filename}`;
                    const foundAsset = assets.find(a => a.id === expectedId);

                    expect(foundAsset).toBeDefined();
                    if (!foundAsset) {
                        console.error(`[Test] Missing asset: ${expectedId}`);
                    }
                }
            }
        });

        it('should have unique IDs for files in same folder', async () => {
            const assetProvider = new FileSystemAssetProvider(extractedPath);
            const assets = await assetProvider.getAllAssets();

            // The folder 20251009090601DKVACR has two files: 01.jpg and colegio.mp3
            // They should have different IDs
            const folder = '20251009090601DKVACR';
            const jpg = assets.find(a => a.id === `${folder}/01.jpg`);
            const mp3 = assets.find(a => a.id === `${folder}/colegio.mp3`);

            expect(jpg).toBeDefined();
            expect(mp3).toBeDefined();
            expect(jpg?.id).not.toBe(mp3?.id);
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

            // Check that asset files are included
            // Expected paths: content/resources/{uuid}/{filename}
            for (const expected of EXPECTED_ASSETS) {
                for (const filename of expected.files) {
                    const expectedPath = `content/resources/${expected.id}/${filename}`;
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

            // Extract and compare asset structure
            const zipBuffer = result.data!;
            const unzipped = fflate.unzipSync(new Uint8Array(zipBuffer));
            const zipFiles = Object.keys(unzipped);

            // Get expected asset files from reference
            const expectedAssetsDir = path.join(EXPECTED_EXPORT_DIR, 'content/resources');
            if (await fs.pathExists(expectedAssetsDir)) {
                const expectedDirs = await fs.readdir(expectedAssetsDir);

                for (const assetId of expectedDirs) {
                    const assetDir = path.join(expectedAssetsDir, assetId);
                    const stat = await fs.stat(assetDir);

                    if (stat.isDirectory()) {
                        const files = await fs.readdir(assetDir);
                        for (const file of files) {
                            const expectedPath = `content/resources/${assetId}/${file}`;
                            const found = zipFiles.includes(expectedPath);

                            expect(found).toBe(true);
                            if (!found) {
                                console.error(`[Test] Reference asset missing in export: ${expectedPath}`);
                            }
                        }
                    }
                }
            }
        });
    });
});
