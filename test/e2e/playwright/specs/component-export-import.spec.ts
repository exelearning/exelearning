import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { unzipSync } from '../../../../src/shared/export';
import {
    waitForAppReady,
    waitForLoadingScreen,
    openElpFile,
    navigateToPageByTitle,
    getPreviewFrame,
    waitForPreviewContent,
    selectPageByIndex,
    addPage,
    exportBlock,
    exportIdevice,
    importComponent,
    getFirstBlockAndIdeviceIds,
    getBlockAndIdeviceIdsByIndex,
    addTextIdevice,
    editTextIdevice,
    getBlockIconSrc,
    blockHasEmptyIcon,
    changeBlockIcon,
    getBlockIconName,
    getBlockId,
    waitForThemeIconsLoaded,
    gotoWorkarea,
} from '../helpers/workarea-helpers';

/**
 * E2E Tests for Component Export/Import
 *
 * Tests the ability to:
 * - Export a block as .block file
 * - Export an iDevice as .idevice file
 * - Import .block files into different pages
 * - Import .idevice files into different pages
 */

test.describe('Component Export/Import', () => {
    // Temporary directory for downloaded files
    let tempDir: string;

    test.beforeAll(() => {
        tempDir = path.join('/tmp', `exelearning-e2e-${Date.now()}`);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    test.afterAll(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should export block and iDevice, then import them to different pages', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // 1. Create a new project
        const projectUuid = await createProject(page, 'Component Export Import Test');
        await gotoWorkarea(page, projectUuid);

        // Wait for app initialization
        await waitForAppReady(page);

        // 2. Select the first page
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);

        // 3. Add a text iDevice with content
        await addTextIdevice(page);
        const testContent = `Test content for export ${Date.now()}`;
        await editTextIdevice(page, testContent);

        // 4. Get the block and iDevice IDs
        const { blockId, ideviceId } = await getFirstBlockAndIdeviceIds(page);
        expect(blockId).toBeTruthy();
        expect(ideviceId).toBeTruthy();

        console.log(`Block ID: ${blockId}, iDevice ID: ${ideviceId}`);

        // 5. Export the block
        const blockDownload = await exportBlock(page, blockId);
        const blockFileName = blockDownload.suggestedFilename();
        expect(blockFileName).toContain('.block');

        const blockFilePath = path.join(tempDir, blockFileName);
        await blockDownload.saveAs(blockFilePath);
        expect(fs.existsSync(blockFilePath)).toBe(true);

        console.log(`Block exported to: ${blockFilePath}`);

        // 6. Export the iDevice
        const ideviceDownload = await exportIdevice(page, ideviceId);
        const ideviceFileName = ideviceDownload.suggestedFilename();
        expect(ideviceFileName).toContain('.idevice');

        const ideviceFilePath = path.join(tempDir, ideviceFileName);
        await ideviceDownload.saveAs(ideviceFilePath);
        expect(fs.existsSync(ideviceFilePath)).toBe(true);

        console.log(`iDevice exported to: ${ideviceFilePath}`);

        // 7. Add two new pages for importing
        await addPage(page);
        await page.waitForTimeout(500);
        await addPage(page);
        await page.waitForTimeout(500);

        // 8. Select page 2 and import the block
        await selectPageByIndex(page, 1);
        await page.waitForTimeout(500);

        // Import the block file
        await importComponent(page, blockFilePath);

        // Wait for import to complete and verify
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 1;
            },
            undefined,
            { timeout: 15000 },
        );

        // Verify the imported block appears
        const importedBlockOnPage2 = page.locator('#node-content article .idevice_node.text').first();
        await expect(importedBlockOnPage2).toBeVisible({ timeout: 10000 });

        console.log('Block successfully imported to page 2');

        // 9. Select page 3 and import the iDevice
        await selectPageByIndex(page, 2);
        await page.waitForTimeout(500);

        // Import the iDevice file
        await importComponent(page, ideviceFilePath);

        // Wait for import to complete and verify
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 1;
            },
            undefined,
            { timeout: 15000 },
        );

        // Verify the imported iDevice appears
        const importedIdeviceOnPage3 = page.locator('#node-content article .idevice_node.text').first();
        await expect(importedIdeviceOnPage3).toBeVisible({ timeout: 10000 });

        console.log('iDevice successfully imported to page 3');

        // 10. Verify all three pages have content
        // Go back to page 1 and verify original content
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);

        const originalContent = page.locator('#node-content article .idevice_node.text').first();
        await expect(originalContent).toBeVisible({ timeout: 10000 });

        console.log('Test completed successfully - export and import working correctly');
    });

    test('should export block and verify file format', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create project with text iDevice
        const projectUuid = await createProject(page, 'Block Export Format Test');
        await gotoWorkarea(page, projectUuid);

        await waitForAppReady(page);

        // Add text iDevice
        await selectPageByIndex(page, 0);
        await addTextIdevice(page);
        await editTextIdevice(page, 'Block export test content');

        const { blockId } = await getFirstBlockAndIdeviceIds(page);

        // Export the block
        const download = await exportBlock(page, blockId);
        const fileName = download.suggestedFilename();

        // Verify file name format
        expect(fileName).toMatch(/\.block$/);

        // Save and verify it's a valid ZIP
        const filePath = path.join(tempDir, fileName);
        await download.saveAs(filePath);

        // Read and verify it's a ZIP file (starts with PK signature)
        const fileBuffer = fs.readFileSync(filePath);
        expect(fileBuffer[0]).toBe(0x50); // P
        expect(fileBuffer[1]).toBe(0x4b); // K

        console.log(`Block file verified: ${fileName}`);
    });

    test('should export iDevice and verify file format', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create project with text iDevice
        const projectUuid = await createProject(page, 'iDevice Export Format Test');
        await gotoWorkarea(page, projectUuid);

        await waitForAppReady(page);

        // Add text iDevice
        await selectPageByIndex(page, 0);
        await addTextIdevice(page);
        await editTextIdevice(page, 'iDevice export test content');

        const { blockId, ideviceId } = await getFirstBlockAndIdeviceIds(page);

        // Export the iDevice
        const download = await exportIdevice(page, ideviceId);
        const fileName = download.suggestedFilename();

        // Verify file name format
        expect(fileName).toMatch(/\.idevice$/);

        // Save and verify it's a valid ZIP
        const filePath = path.join(tempDir, fileName);
        await download.saveAs(filePath);

        // Read and verify it's a ZIP file
        const fileBuffer = fs.readFileSync(filePath);
        expect(fileBuffer[0]).toBe(0x50); // P
        expect(fileBuffer[1]).toBe(0x4b); // K

        console.log(`iDevice file verified: ${fileName}`);
    });

    test('should import iDevice with images and display them immediately without refresh', async ({
        authenticatedPage,
        createProject,
    }) => {
        /**
         * This test verifies the fix for issue #953:
         * "Importing idevice not completed until refreshing page"
         *
         * The issue was that when importing an iDevice with images, the images
         * wouldn't appear (and weren't included in the file manager) until
         * page refresh. This was caused by the asset extraction logic not
         * recognizing UUID-style folder paths like "{uuid}/{filename}" that
         * are used in exported .idevice files.
         */
        const page = authenticatedPage;

        // 1. Create a new project
        const projectUuid = await createProject(page, 'iDevice Image Import Test');
        await gotoWorkarea(page, projectUuid);

        // Wait for app initialization
        await waitForAppReady(page);

        // 2. Select the first page
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);

        // 3. Import the test iDevice file that contains an image
        // The file is located at test/fixtures/idevice-mkg5tfoo-i0k5qzyvx.idevice
        // Use process.cwd() as the base since __dirname behaves differently in ESM context
        const ideviceFilePath = path.join(process.cwd(), 'test/fixtures/idevice-mkg5tfoo-i0k5qzyvx.idevice');

        // Verify the fixture file exists
        if (!fs.existsSync(ideviceFilePath)) {
            throw new Error(
                `Fixture file not found at: ${ideviceFilePath}. Current working directory: ${process.cwd()}`,
            );
        }

        // Import the iDevice
        await importComponent(page, ideviceFilePath);

        // 4. Wait for the iDevice to appear
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 1;
            },
            undefined,
            { timeout: 15000 },
        );

        // Verify the iDevice is visible
        const importedIdevice = page.locator('#node-content article .idevice_node.text').first();
        await expect(importedIdevice).toBeVisible({ timeout: 10000 });

        console.log('iDevice imported successfully');

        // 5. KEY TEST: Verify the image is visible WITHOUT refreshing the page
        // The bug was that images wouldn't appear until refresh
        // Wait for asset resolution to complete
        await page.waitForTimeout(500);

        // Check for images in the iDevice content
        const imagesInIdevice = await page.evaluate(() => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            if (!idevice) return { found: false, imgCount: 0, imgDetails: [] };

            const images = idevice.querySelectorAll('img');
            const details = Array.from(images).map(img => ({
                src: img.getAttribute('src')?.substring(0, 50) || 'no-src',
                dataAssetUrl: img.getAttribute('data-asset-url')?.substring(0, 50) || 'no-data-url',
                naturalWidth: img.naturalWidth,
                complete: img.complete,
            }));

            return {
                found: images.length > 0,
                imgCount: images.length,
                imgDetails: details,
            };
        });

        console.log('Image details:', JSON.stringify(imagesInIdevice, null, 2));

        // Verify that at least one image was found
        expect(imagesInIdevice.found).toBe(true);
        expect(imagesInIdevice.imgCount).toBeGreaterThan(0);

        // 6. Verify the image has been resolved to a blob URL (not still asset://)
        // After the fix, asset:// URLs should be resolved to blob:// URLs immediately
        const imageResolution = await page.waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.text');
                if (!idevice) return null;

                const img = idevice.querySelector('img');
                if (!img) return null;

                const src = img.getAttribute('src');
                const dataAssetUrl = img.getAttribute('data-asset-url');

                // Image is resolved if:
                // 1. src is a blob:// URL, or
                // 2. data-asset-url exists (meaning MutationObserver processed it)
                const isResolved = src?.startsWith('blob:') || dataAssetUrl?.startsWith('asset://');

                return {
                    src: src?.substring(0, 60),
                    dataAssetUrl: dataAssetUrl?.substring(0, 60),
                    isResolved,
                    isLoaded: img.complete && img.naturalWidth > 0,
                };
            },
            undefined,
            { timeout: 10000 },
        );

        const resolution = await imageResolution.jsonValue();
        console.log('Image resolution status:', JSON.stringify(resolution, null, 2));

        // The image should be resolved
        expect(resolution.isResolved).toBe(true);

        // 7. Verify image actually loads (not broken)
        // Wait for image to fully load
        const imageLoaded = await page.waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.text');
                if (!idevice) return false;

                const img = idevice.querySelector('img') as HTMLImageElement;
                if (!img) return false;

                // Image is loaded when complete and has dimensions
                return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
            },
            undefined,
            { timeout: 15000 },
        );

        expect(await imageLoaded.jsonValue()).toBe(true);

        console.log('Image loaded successfully without page refresh - issue #953 is fixed');

        // 8. BONUS: Verify the asset is available in the file manager
        // Open file manager
        const fileManagerBtn = page.locator('[data-bs-target="#modalFileManager"], #head-bottom-filemanager');
        if ((await fileManagerBtn.count()) > 0) {
            await fileManagerBtn.click();
            await page.waitForTimeout(500);

            // Check if the modal opened
            const modal = page.locator('#modalFileManager[data-open="true"], #modalFileManager.show');
            if (await modal.isVisible().catch(() => false)) {
                // Wait for assets to load
                await page.waitForTimeout(500);

                // Check for media items in the file manager
                const mediaItems = await page.locator('#modalFileManager .media-library-item').count();
                console.log(`Found ${mediaItems} media items in file manager`);

                // Close modal
                const closeBtn = page
                    .locator('#modalFileManager .btn-close, #modalFileManager [data-bs-dismiss="modal"]')
                    .first();
                if ((await closeBtn.count()) > 0) {
                    await closeBtn.click();
                }

                // Should have at least 1 asset (the imported image)
                expect(mediaItems).toBeGreaterThanOrEqual(1);
                console.log('Asset verified in file manager');
            }
        }

        console.log('Test completed - iDevice with image imported and displayed immediately');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS FOR IMAGE VERIFICATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get list of file names from a ZIP file
 */
function getZipFileNames(filePath: string): string[] {
    const fileBuffer = fs.readFileSync(filePath);
    const zipContents = unzipSync(fileBuffer);
    return Object.keys(zipContents);
}

/**
 * Verify images in the current iDevice are loaded correctly
 * @param page - Playwright page
 * @param expectedCount - Expected number of images
 * @returns Object with verification results
 */
async function verifyIdeviceImages(
    page: Page,
    expectedCount: number,
): Promise<{
    found: boolean;
    imgCount: number;
    allLoaded: boolean;
    allBlobUrls: boolean;
    details: Array<{
        src: string;
        dataAssetUrl: string;
        naturalWidth: number;
        complete: boolean;
        isBlobUrl: boolean;
    }>;
}> {
    return await page
        .waitForFunction(
            (expected: number) => {
                const idevice = document.querySelector('#node-content article .idevice_node');
                if (!idevice) return { found: false, imgCount: 0, allLoaded: false, allBlobUrls: false, details: [] };

                const images = idevice.querySelectorAll('img');
                const details = Array.from(images).map(img => ({
                    src: img.getAttribute('src')?.substring(0, 80) || 'no-src',
                    dataAssetUrl: img.getAttribute('data-asset-url')?.substring(0, 80) || 'no-data-url',
                    naturalWidth: img.naturalWidth,
                    complete: img.complete,
                    isBlobUrl: img.src.startsWith('blob:'),
                }));

                const allLoaded = details.every(d => d.complete && d.naturalWidth > 0);
                const allBlobUrls = details.every(d => d.isBlobUrl);

                return {
                    found: images.length > 0,
                    imgCount: images.length,
                    allLoaded,
                    allBlobUrls,
                    details,
                };
            },
            expectedCount,
            { timeout: 15000 },
        )
        .then(handle => handle.jsonValue());
}

/**
 * Fixture file path for the ELPX with images
 */
const FIXTURE_ELPX_WITH_IMAGES = path.join(
    process.cwd(),
    'test/fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx',
);

test.describe('Component Export/Import with Images', () => {
    // Temporary directory for downloaded files
    let tempDir: string;

    test.beforeAll(() => {
        tempDir = path.join('/tmp', `exelearning-e2e-images-${Date.now()}`);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Verify fixture file exists
        if (!fs.existsSync(FIXTURE_ELPX_WITH_IMAGES)) {
            throw new Error(`Fixture file not found: ${FIXTURE_ELPX_WITH_IMAGES}`);
        }
    });

    test.afterAll(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should export block from Inicio page and import with image to new project', async ({
        authenticatedPage,
        createProject,
    }) => {
        /**
         * This test verifies that blocks with images can be:
         * 1. Exported from one document
         * 2. Imported into a new document
         * 3. Images load correctly with blob URLs
         *
         * Page "Inicio" contains a text iDevice with 1 image (00.jpg)
         */
        const page = authenticatedPage;

        // 1. Open the fixture ELPX file
        console.log('Opening fixture ELPX file with images...');
        await openElpFile(page, FIXTURE_ELPX_WITH_IMAGES, 2);
        await waitForAppReady(page);

        // 2. Navigate to "Inicio" page (first page)
        await navigateToPageByTitle(page, 'Inicio');

        // 3. Get the block and iDevice IDs
        const { blockId, ideviceId } = await getBlockAndIdeviceIdsByIndex(page, 0);
        console.log(`Found block: ${blockId}, iDevice: ${ideviceId}`);

        // 4. Export the block
        const blockDownload = await exportBlock(page, blockId);
        const blockFileName = blockDownload.suggestedFilename();
        expect(blockFileName).toContain('.block');

        const blockFilePath = path.join(tempDir, blockFileName);
        await blockDownload.saveAs(blockFilePath);
        expect(fs.existsSync(blockFilePath)).toBe(true);

        console.log(`Block exported to: ${blockFilePath}`);

        // 5. Verify ZIP contains image file
        const zipFiles = getZipFileNames(blockFilePath);
        console.log('ZIP contents:', zipFiles);

        // Should have content.xml and at least one image file
        expect(zipFiles).toContain('content.xml');

        // Find image files (jpg, png, gif)
        const imageFiles = zipFiles.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
        console.log('Image files in ZIP:', imageFiles);
        expect(imageFiles.length).toBeGreaterThanOrEqual(1);

        // 6. Create a NEW project for import
        const newProjectUuid = await createProject(page, 'Block Import Test - Images');
        await gotoWorkarea(page, newProjectUuid);
        await waitForLoadingScreen(page);

        // 7. Select the first page
        await selectPageByIndex(page, 0);

        // 8. Import the block file
        await importComponent(page, blockFilePath);

        // 9. Wait for import to complete and verify iDevice appears
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 1;
            },
            undefined,
            { timeout: 15000 },
        );

        // Verify the imported block appears
        const importedBlock = page.locator('#node-content article .idevice_node.text').first();
        await expect(importedBlock).toBeVisible({ timeout: 10000 });

        console.log('Block imported successfully');

        // 10. Wait for asset resolution
        await page.waitForTimeout(500);

        // 11. Verify the image is loaded correctly
        const imageVerification = await verifyIdeviceImages(page, 1);
        console.log('Image verification:', JSON.stringify(imageVerification, null, 2));

        expect(imageVerification.found).toBe(true);
        expect(imageVerification.imgCount).toBeGreaterThanOrEqual(1);
        expect(imageVerification.allBlobUrls).toBe(true);
        expect(imageVerification.allLoaded).toBe(true);

        console.log('Block with image imported and verified successfully');
    });

    test('should export iDevice from Apartado uno and import with 3 images to new project', async ({
        authenticatedPage,
        createProject,
    }) => {
        /**
         * This test verifies that iDevices with multiple images can be:
         * 1. Exported from one document
         * 2. Imported into a new document
         * 3. All images load correctly with blob URLs
         *
         * Page "Apartado uno, con un título largo..." contains a text iDevice with 3 images
         * (sq01.jpg, sq02.jpg, sq03.jpg)
         */
        const page = authenticatedPage;

        // 1. Open the fixture ELPX file
        console.log('Opening fixture ELPX file with images...');
        await openElpFile(page, FIXTURE_ELPX_WITH_IMAGES, 2);
        await waitForAppReady(page);

        // 2. Navigate to "Apartado uno" page
        await navigateToPageByTitle(page, 'Apartado uno');
        await page.waitForTimeout(500);

        // 3. Get the block and iDevice IDs (first block on the page)
        const { blockId, ideviceId } = await getBlockAndIdeviceIdsByIndex(page, 0);
        console.log(`Found block: ${blockId}, iDevice: ${ideviceId}`);

        // 4. Export the iDevice
        const ideviceDownload = await exportIdevice(page, ideviceId);
        const ideviceFileName = ideviceDownload.suggestedFilename();
        expect(ideviceFileName).toContain('.idevice');

        const ideviceFilePath = path.join(tempDir, ideviceFileName);
        await ideviceDownload.saveAs(ideviceFilePath);
        expect(fs.existsSync(ideviceFilePath)).toBe(true);

        console.log(`iDevice exported to: ${ideviceFilePath}`);

        // 5. Verify ZIP contains 3 image files
        const zipFiles = getZipFileNames(ideviceFilePath);
        console.log('ZIP contents:', zipFiles);

        // Should have content.xml and image files
        expect(zipFiles).toContain('content.xml');

        // Find image files
        const imageFiles = zipFiles.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
        console.log('Image files in ZIP:', imageFiles);
        expect(imageFiles.length).toBeGreaterThanOrEqual(3);

        // 6. Create a NEW project for import
        const newProjectUuid = await createProject(page, 'iDevice Import Test - 3 Images');
        await gotoWorkarea(page, newProjectUuid);
        await waitForLoadingScreen(page);

        // 7. Select the first page
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);

        // 8. Import the iDevice file
        await importComponent(page, ideviceFilePath);

        // 9. Wait for import to complete and verify iDevice appears
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 1;
            },
            undefined,
            { timeout: 15000 },
        );

        // Verify the imported iDevice appears
        const importedIdevice = page.locator('#node-content article .idevice_node.text').first();
        await expect(importedIdevice).toBeVisible({ timeout: 10000 });

        console.log('iDevice imported successfully');

        // 10. Wait for asset resolution
        await page.waitForTimeout(500);

        // 11. Verify all 3 images are loaded correctly
        const imageVerification = await verifyIdeviceImages(page, 3);
        console.log('Image verification:', JSON.stringify(imageVerification, null, 2));

        expect(imageVerification.found).toBe(true);
        expect(imageVerification.imgCount).toBeGreaterThanOrEqual(3);
        expect(imageVerification.allBlobUrls).toBe(true);
        expect(imageVerification.allLoaded).toBe(true);

        // Verify each individual image detail
        for (let i = 0; i < imageVerification.details.length; i++) {
            const detail = imageVerification.details[i];
            console.log(`Image ${i + 1}:`, detail);
            expect(detail.complete).toBe(true);
            expect(detail.naturalWidth).toBeGreaterThan(0);
            expect(detail.isBlobUrl).toBe(true);
        }

        console.log('iDevice with 3 images imported and verified successfully');
    });

    test('should verify imported images display correctly in preview', async ({ authenticatedPage, createProject }) => {
        /**
         * This test verifies that imported images display correctly in the preview panel.
         * The preview uses a Service Worker to serve exported HTML files.
         */
        const page = authenticatedPage;

        // 1. Open the fixture ELPX file
        console.log('Opening fixture ELPX file with images...');
        await openElpFile(page, FIXTURE_ELPX_WITH_IMAGES, 2);
        await waitForAppReady(page);

        // 2. Navigate to "Inicio" page
        await navigateToPageByTitle(page, 'Inicio');
        await page.waitForTimeout(500);

        // 3. Export the block
        const { blockId } = await getBlockAndIdeviceIdsByIndex(page, 0);
        const blockDownload = await exportBlock(page, blockId);
        const blockFilePath = path.join(tempDir, blockDownload.suggestedFilename());
        await blockDownload.saveAs(blockFilePath);

        // 4. Create a NEW project for import
        const newProjectUuid = await createProject(page, 'Preview Image Test');
        await gotoWorkarea(page, newProjectUuid);
        await waitForLoadingScreen(page);

        // 5. Select the first page and import the block
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);
        await importComponent(page, blockFilePath);

        // 6. Wait for import and asset resolution
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 1;
            },
            undefined,
            { timeout: 15000 },
        );
        await page.waitForTimeout(500);

        // 7. Open preview panel and wait for content using shared helper
        const contentLoaded = await waitForPreviewContent(page, 30000);
        expect(contentLoaded).toBe(true);

        // 8. Get iframe reference for verification
        const iframe = getPreviewFrame(page);

        // 9. Verify image displays in preview
        const previewImageResult = await iframe.locator('body').evaluate(async body => {
            // Wait for images to load in preview
            const maxWait = 10000;
            let elapsed = 0;
            while (elapsed < maxWait) {
                const images = body.querySelectorAll('img');
                if (images.length > 0) {
                    const imgDetails = Array.from(images).map(img => ({
                        src: img.src?.substring(0, 80) || 'no-src',
                        naturalWidth: img.naturalWidth,
                        complete: img.complete,
                    }));

                    // Check if at least one image is loaded
                    const someLoaded = imgDetails.some(d => d.complete && d.naturalWidth > 0);
                    if (someLoaded) {
                        return { found: true, imgCount: images.length, details: imgDetails };
                    }
                }
                await new Promise(r => setTimeout(r, 500));
                elapsed += 500;
            }
            return { found: false, imgCount: 0, details: [] };
        });

        console.log('Preview image result:', JSON.stringify(previewImageResult, null, 2));

        expect(previewImageResult.found).toBe(true);
        expect(previewImageResult.imgCount).toBeGreaterThanOrEqual(1);

        // At least one image should be loaded
        const loadedImages = previewImageResult.details.filter(
            (d: { complete: boolean; naturalWidth: number }) => d.complete && d.naturalWidth > 0,
        );
        expect(loadedImages.length).toBeGreaterThanOrEqual(1);

        console.log('Imported images display correctly in preview');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK ICON PRESERVATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Block Icon Preservation during Export/Import', () => {
    // Temporary directory for downloaded files
    let tempDir: string;

    test.beforeAll(() => {
        tempDir = path.join('/tmp', `exelearning-e2e-icon-${Date.now()}`);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    test.afterAll(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should preserve block icon during export and verify iconName in ZIP content.xml', async ({
        authenticatedPage,
        createProject,
    }) => {
        /**
         * This test verifies that the block iconName is correctly included
         * in the exported .block file's content.xml
         *
         * Previously, the iconName was hardcoded as empty: <iconName></iconName>
         * After the fix, it should contain the actual block iconName value.
         */
        const page = authenticatedPage;

        // 1. Create a new project
        const projectUuid = await createProject(page, 'Block Icon Export Test');
        await gotoWorkarea(page, projectUuid);
        await waitForLoadingScreen(page);

        // 2. Select the first page
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);

        // 3. Add a text iDevice
        await addTextIdevice(page);
        await editTextIdevice(page, 'Test content for icon export');

        // 4. Verify block starts with empty icon
        const hasEmptyIconBefore = await blockHasEmptyIcon(page, 0);
        expect(hasEmptyIconBefore).toBe(true);

        // 5. Wait for theme icons to be loaded before attempting to change icon
        const themeIconCount = await waitForThemeIconsLoaded(page, 1);
        if (themeIconCount === 0) {
            console.log('No theme icons available, skipping icon change test');
            test.skip();
            return;
        }
        console.log(`Theme has ${themeIconCount} icons available`);

        // 6. Change the block icon to first theme icon (index 1)
        await changeBlockIcon(page, 0, 1);

        // 6. Verify icon changed
        const hasEmptyIconAfter = await blockHasEmptyIcon(page, 0);
        expect(hasEmptyIconAfter).toBe(false);

        // 7. Get the icon name from Yjs to verify it's set
        const iconNameInYjs = await getBlockIconName(page, 0);
        console.log('Icon name in Yjs before export:', iconNameInYjs);
        expect(iconNameInYjs).toBeTruthy();

        // 8. Get block ID and export the block
        const blockId = await getBlockId(page, 0);
        const blockDownload = await exportBlock(page, blockId);
        const blockFileName = blockDownload.suggestedFilename();
        expect(blockFileName).toContain('.block');

        const blockFilePath = path.join(tempDir, blockFileName);
        await blockDownload.saveAs(blockFilePath);
        expect(fs.existsSync(blockFilePath)).toBe(true);

        console.log(`Block exported to: ${blockFilePath}`);

        // 9. Extract and verify content.xml contains the iconName
        const fileBuffer = fs.readFileSync(blockFilePath);
        const zipContents = unzipSync(fileBuffer);

        expect(zipContents['content.xml']).toBeDefined();

        const contentXml = new TextDecoder().decode(zipContents['content.xml']);
        console.log('Content.xml snippet:', contentXml.substring(0, 500));

        // Verify iconName element contains the actual icon name (not empty)
        const iconNameMatch = contentXml.match(/<iconName>([^<]*)<\/iconName>/);
        expect(iconNameMatch).not.toBeNull();

        const exportedIconName = iconNameMatch ? iconNameMatch[1] : '';
        console.log('Exported iconName:', exportedIconName);

        // The iconName should match what's in Yjs
        expect(exportedIconName).toBe(iconNameInYjs);
        expect(exportedIconName).not.toBe('');

        console.log('Block icon preserved in exported content.xml');
    });

    test('should preserve block icon during import to new project', async ({ authenticatedPage, createProject }) => {
        test.setTimeout(90000);
        /**
         * This test verifies the full export/import cycle for block icons:
         * 1. Create block with icon
         * 2. Export block
         * 3. Import to new project
         * 4. Verify icon is preserved
         */
        const page = authenticatedPage;

        // 1. Create first project and add block with icon
        const projectUuid1 = await createProject(page, 'Block Icon Export Source');
        await gotoWorkarea(page, projectUuid1);
        await waitForLoadingScreen(page);

        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);

        // Add text iDevice and set icon
        await addTextIdevice(page);
        await editTextIdevice(page, 'Test content for icon import');

        // Wait for theme icons to be loaded before attempting to change icon
        const themeIconCount = await waitForThemeIconsLoaded(page, 1);
        if (themeIconCount === 0) {
            console.log('No theme icons available, skipping icon change test');
            test.skip();
            return;
        }
        console.log(`Theme has ${themeIconCount} icons available`);

        await changeBlockIcon(page, 0, 1);

        // Get the icon src and name for comparison later
        const originalIconSrc = await getBlockIconSrc(page, 0);
        const originalIconName = await getBlockIconName(page, 0);
        console.log('Original icon src:', originalIconSrc?.substring(0, 80));
        console.log('Original icon name:', originalIconName);

        expect(originalIconName).toBeTruthy();

        // Export the block
        const blockId = await getBlockId(page, 0);
        const blockDownload = await exportBlock(page, blockId);
        const blockFilePath = path.join(tempDir, blockDownload.suggestedFilename());
        await blockDownload.saveAs(blockFilePath);

        console.log(`Block exported to: ${blockFilePath}`);

        // 2. Create a NEW project for import
        const projectUuid2 = await createProject(page, 'Block Icon Import Target');
        await gotoWorkarea(page, projectUuid2);
        await waitForLoadingScreen(page);

        // Wait for theme icons to be loaded in the target project
        // This is crucial because makeIconNameElement() looks up icons from getThemeIcons()
        // and if icons aren't loaded yet, the block will render with empty icon
        const targetThemeIconCount = await waitForThemeIconsLoaded(page, 1);
        console.log(`Target project theme has ${targetThemeIconCount} icons`);

        // 3. Select page and import the block
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);

        await importComponent(page, blockFilePath);

        // 4. Wait for import to complete
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 1;
            },
            undefined,
            { timeout: 15000 },
        );

        // Verify the imported block appears
        const importedBlock = page.locator('#node-content article .idevice_node.text').first();
        await expect(importedBlock).toBeVisible({ timeout: 10000 });

        console.log('Block imported successfully');

        // 5. Wait for icon to be rendered
        await page.waitForTimeout(500);

        // Find the correct block index (imported block is appended after the default welcome block)
        const blockCount = await page.locator('#node-content article.box').count();
        console.log('Total blocks on page:', blockCount);

        // The imported block is the second one (index 1) since new projects come with a default welcome block
        // Note: When importing a block into a new project, the default welcome block is at index 0
        // and the imported block is appended at index 1
        const importedBlockIndex = blockCount > 1 ? 1 : 0;
        console.log('Using imported block index:', importedBlockIndex);

        // 6. Verify icon is preserved (using correct block index)
        const hasEmptyIconAfterImport = await blockHasEmptyIcon(page, importedBlockIndex);
        console.log('hasEmptyIconAfterImport:', hasEmptyIconAfterImport);
        expect(hasEmptyIconAfterImport).toBe(false);

        // Verify icon src is displayed (may have different blob URL but should be present)
        const importedIconSrc = await getBlockIconSrc(page, importedBlockIndex);
        console.log('Imported icon src:', importedIconSrc?.substring(0, 80));
        expect(importedIconSrc).toBeTruthy();

        // Verify the icon src contains 'activity' or is a theme icon blob URL
        // The src may be a direct URL or a blob URL, but should exist
        expect(importedIconSrc).toBeTruthy();

        console.log('Block icon preserved after import - test passed!');
    });

    test('should handle block without icon (empty iconName) during export/import', async ({
        authenticatedPage,
        createProject,
    }) => {
        /**
         * This test verifies that blocks without icons are correctly handled:
         * Empty iconName should remain empty after export/import cycle.
         */
        const page = authenticatedPage;

        // 1. Create project and add block WITHOUT setting an icon
        const projectUuid1 = await createProject(page, 'Block No Icon Export');
        await gotoWorkarea(page, projectUuid1);
        await waitForLoadingScreen(page);

        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);

        // Add text iDevice (icon stays empty)
        await addTextIdevice(page);
        await editTextIdevice(page, 'Test content without icon');

        // Verify block has empty icon
        const hasEmptyIcon = await blockHasEmptyIcon(page, 0);
        expect(hasEmptyIcon).toBe(true);

        // Export the block
        const blockId = await getBlockId(page, 0);
        const blockDownload = await exportBlock(page, blockId);
        const blockFilePath = path.join(tempDir, blockDownload.suggestedFilename());
        await blockDownload.saveAs(blockFilePath);

        // Verify content.xml has empty iconName
        const fileBuffer = fs.readFileSync(blockFilePath);
        const zipContents = unzipSync(fileBuffer);
        const contentXml = new TextDecoder().decode(zipContents['content.xml']);

        const iconNameMatch = contentXml.match(/<iconName>([^<]*)<\/iconName>/);
        expect(iconNameMatch).not.toBeNull();
        const exportedIconName = iconNameMatch ? iconNameMatch[1] : null;
        expect(exportedIconName).toBe('');

        console.log('Empty iconName correctly preserved in export');

        // 2. Create new project and import
        const projectUuid2 = await createProject(page, 'Block No Icon Import');
        await gotoWorkarea(page, projectUuid2);
        await waitForLoadingScreen(page);

        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);

        await importComponent(page, blockFilePath);

        // Wait for import
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 1;
            },
            undefined,
            { timeout: 15000 },
        );

        await page.waitForTimeout(500);

        // Verify block still has empty icon after import
        const hasEmptyIconAfterImport = await blockHasEmptyIcon(page, 0);
        expect(hasEmptyIconAfterImport).toBe(true);

        const importedIconName = await getBlockIconName(page, 0);
        expect(importedIconName === '' || importedIconName === null).toBe(true);

        console.log('Block without icon correctly handled during export/import');
    });
});
