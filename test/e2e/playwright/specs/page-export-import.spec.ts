import { test, expect, waitForLoadingScreenHidden } from '../fixtures/auth.fixture';
import type { Page, Download } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { unzipSync } from '../../../../src/shared/export';
import {
    waitForAppReady,
    openElpFile,
    navigateToPageByTitle,
    selectPageByIndex,
    addTextIdevice,
    editTextIdevice,
    changeBlockIcon,
    blockHasEmptyIcon,
    getBlockIconName,
    waitForThemeIconsLoaded,
    importComponent,
} from '../helpers/workarea-helpers';

/**
 * E2E Tests for Page Export/Import
 *
 * Tests the "Export page" functionality which exports a page subtree as .elpx file.
 * The exported file should include:
 * - content.xml with only the exported page and its children
 * - ONLY assets referenced by the exported pages (not all project assets)
 *
 * This tests the fix for: Page export includes images in content/resources/
 */

// Fixture file paths
const FIXTURE_ELPX_WITH_IMAGES = path.join(
    process.cwd(),
    'test/fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx',
);
const FIXTURE_OLD_ELP = path.join(process.cwd(), 'test/fixtures/old_el_cid.elp');

/**
 * Export a page using the context menu "Export page" option
 *
 * @param page - Playwright page
 * @param nodeId - Navigation node ID to export
 * @returns Download object for the exported file
 */
async function exportPage(page: Page, nodeId: string): Promise<Download> {
    // Find the page in navigation tree
    const navElement = page.locator(`.nav-element[nav-id="${nodeId}"]`);
    await navElement.waitFor({ state: 'visible', timeout: 10000 });

    // Hover over the nav element to reveal the settings trigger
    await navElement.hover();
    await page.waitForTimeout(300);

    // Find and click the dropdown trigger (three dots menu)
    const dropdownTrigger = navElement.locator('.page-settings-trigger');
    await dropdownTrigger.waitFor({ state: 'visible', timeout: 5000 });
    await dropdownTrigger.click();
    await page.waitForTimeout(300);

    // Wait for dropdown menu to appear
    const dropdownMenu = navElement.locator('.dropdown-menu.show');
    await dropdownMenu.waitFor({ state: 'visible', timeout: 5000 });

    // Setup download event listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

    // Click the "Export page" option
    const exportOption = dropdownMenu.locator('.action_export_page');
    await exportOption.waitFor({ state: 'visible', timeout: 5000 });
    await exportOption.click();

    // Wait for download to complete
    const download = await downloadPromise;
    return download;
}

/**
 * Get list of file names from a ZIP file
 */
function getZipFileNames(filePath: string): string[] {
    const fileBuffer = fs.readFileSync(filePath);
    const zipContents = unzipSync(fileBuffer);
    return Object.keys(zipContents);
}

test.describe('Page Export with Images', () => {
    // Temporary directory for downloaded files
    let tempDir: string;

    test.beforeAll(() => {
        tempDir = path.join('/tmp', `exelearning-page-export-${Date.now()}`);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Verify fixture files exist
        if (!fs.existsSync(FIXTURE_ELPX_WITH_IMAGES)) {
            console.warn(`Fixture file not found: ${FIXTURE_ELPX_WITH_IMAGES}`);
        }
        if (!fs.existsSync(FIXTURE_OLD_ELP)) {
            console.warn(`Fixture file not found: ${FIXTURE_OLD_ELP}`);
        }
    });

    test.afterAll(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should export page with images and include only referenced assets', async ({
        authenticatedPage,
        createProject,
    }) => {
        /**
         * This test verifies that page export creates a valid .elpx file
         * that includes images from browser IndexedDB via client-side export.
         *
         * After the fix, page export runs client-side with access to IndexedDB assets,
         * so images should be properly included in the exported file.
         */
        const page = authenticatedPage;

        // Skip if fixture doesn't exist
        if (!fs.existsSync(FIXTURE_ELPX_WITH_IMAGES)) {
            test.skip();
            return;
        }

        // 1. Open the fixture ELPX file
        console.log('Opening fixture ELPX file with images...');
        await openElpFile(page, FIXTURE_ELPX_WITH_IMAGES, 2);
        await waitForAppReady(page);

        // 2. Navigate to "Inicio" page (has images)
        await navigateToPageByTitle(page, 'Inicio');
        await page.waitForTimeout(2000);

        // Get the node ID from navigation
        const nodeId = await page.evaluate(() => {
            const selected = document.querySelector('.nav-element.selected');
            return selected?.getAttribute('nav-id') || null;
        });

        if (!nodeId) {
            throw new Error('Could not find node ID for "Inicio" page');
        }

        console.log(`Exporting page with node ID: ${nodeId}`);

        // 3. Export the page using context menu
        const download = await exportPage(page, nodeId);
        const fileName = download.suggestedFilename();
        expect(fileName).toContain('.elpx');

        const filePath = path.join(tempDir, fileName);
        await download.saveAs(filePath);
        expect(fs.existsSync(filePath)).toBe(true);

        console.log(`Page exported to: ${filePath}`);

        // 4. Verify ZIP contents
        const zipFiles = getZipFileNames(filePath);
        console.log('ZIP contents:', zipFiles.slice(0, 30)); // First 30 files

        // Should have content.xml
        expect(zipFiles).toContain('content.xml');

        // 5. Verify resource files are included (FIX VERIFICATION)
        const resourceFiles = zipFiles.filter(f => f.startsWith('content/resources/'));
        console.log('Resource files in ZIP:', resourceFiles);
        console.log(`Export contains ${resourceFiles.length} resource files`);

        // The Inicio page has images - verify they're included
        // After the fix, client-side export should include IndexedDB assets
        expect(resourceFiles.length).toBeGreaterThan(0);

        console.log('Page export with images verified successfully');
    });

    test('should export page from legacy .elp file with images', async ({ authenticatedPage, createProject }) => {
        /**
         * This test verifies that page export works with legacy Python eXeLearning files
         * and that images are included via client-side export.
         */
        const page = authenticatedPage;

        // Skip if fixture doesn't exist
        if (!fs.existsSync(FIXTURE_OLD_ELP)) {
            test.skip();
            return;
        }

        // 1. Open the legacy ELP file
        console.log('Opening legacy .elp file...');
        await openElpFile(page, FIXTURE_OLD_ELP, 2);
        await waitForAppReady(page);

        // 2. Select the first non-root page
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(1500);

        // Get the node ID from navigation
        const nodeId = await page.evaluate(() => {
            const selected = document.querySelector('.nav-element.selected:not([nav-id="root"])');
            return selected?.getAttribute('nav-id') || null;
        });

        if (!nodeId) {
            // Try to select a different page
            await selectPageByIndex(page, 1);
            await page.waitForTimeout(1000);
        }

        const finalNodeId = await page.evaluate(() => {
            const selected = document.querySelector('.nav-element.selected:not([nav-id="root"])');
            return selected?.getAttribute('nav-id') || null;
        });

        if (!finalNodeId) {
            console.log('Could not find a non-root page to export');
            test.skip();
            return;
        }

        console.log(`Exporting page with node ID: ${finalNodeId}`);

        // 3. Export the page
        const download = await exportPage(page, finalNodeId);
        const fileName = download.suggestedFilename();
        expect(fileName).toContain('.elpx');

        const filePath = path.join(tempDir, fileName);
        await download.saveAs(filePath);
        expect(fs.existsSync(filePath)).toBe(true);

        console.log(`Page exported to: ${filePath}`);

        // 4. Verify ZIP contents
        const zipFiles = getZipFileNames(filePath);
        console.log('ZIP contents (first 20):', zipFiles.slice(0, 20));

        // Should have content.xml
        expect(zipFiles).toContain('content.xml');

        // 5. Check for resource files (images from legacy format)
        const resourceFiles = zipFiles.filter(f => f.startsWith('content/resources/'));
        console.log('Resource files in ZIP:', resourceFiles);
        console.log(`Found ${resourceFiles.length} resource files in export`);

        // Legacy ELP should have images on most pages - verify export includes them
        // The old_el_cid.elp fixture has images on its pages
        expect(resourceFiles.length).toBeGreaterThan(0);

        console.log('Legacy .elp page export with images verified successfully');
    });

    test('should only include assets used by exported page, not all project assets', async ({
        authenticatedPage,
        createProject,
    }) => {
        /**
         * This is the key test for the fix:
         * When exporting a page, ONLY assets referenced by that page should be included,
         * NOT all assets from the entire project.
         *
         * The fixture file has multiple pages with different images:
         * - Inicio: has 1 image (00.jpg)
         * - Apartado uno: has 3 images (sq01.jpg, sq02.jpg, sq03.jpg)
         *
         * If we export just "Inicio", we should NOT see sq01/sq02/sq03 images.
         */
        const page = authenticatedPage;

        // Skip if fixture doesn't exist
        if (!fs.existsSync(FIXTURE_ELPX_WITH_IMAGES)) {
            test.skip();
            return;
        }

        // 1. Open the fixture ELPX file
        console.log('Opening fixture ELPX file...');
        await openElpFile(page, FIXTURE_ELPX_WITH_IMAGES, 2);
        await waitForAppReady(page);

        // 2. Navigate to "Inicio" page (has 00.jpg image)
        await navigateToPageByTitle(page, 'Inicio');
        await page.waitForTimeout(1500);

        const inicioNodeId = await page.evaluate(() => {
            const selected = document.querySelector('.nav-element.selected');
            return selected?.getAttribute('nav-id') || null;
        });

        if (!inicioNodeId) {
            throw new Error('Could not find node ID for "Inicio" page');
        }

        // 3. Export just the "Inicio" page
        console.log(`Exporting "Inicio" page with node ID: ${inicioNodeId}`);
        const download = await exportPage(page, inicioNodeId);
        const filePath = path.join(tempDir, download.suggestedFilename());
        await download.saveAs(filePath);

        // 4. Analyze ZIP contents
        const zipFiles = getZipFileNames(filePath);
        const resourceFiles = zipFiles.filter(f => f.startsWith('content/resources/'));
        console.log('Resource files in "Inicio" export:', resourceFiles);

        // CRITICAL: After the fix, the export should include SOME assets (the ones used by Inicio)
        expect(resourceFiles.length).toBeGreaterThan(0);

        // Find all image filenames
        const imageFilenames = resourceFiles.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f)).map(f => f.split('/').pop()); // Get just the filename

        console.log('Image filenames:', imageFilenames);

        // The Inicio page has 00.jpg (or similar)
        // It should NOT have sq01.jpg, sq02.jpg, sq03.jpg from "Apartado uno"

        // Check that we don't have the images from "Apartado uno"
        const hasApartadoImages = imageFilenames.some(
            f => f?.includes('sq01') || f?.includes('sq02') || f?.includes('sq03'),
        );

        if (hasApartadoImages) {
            console.log('WARNING: Export contains images from other pages!');
            console.log('This indicates the asset filtering is not working correctly.');
        }

        // This assertion verifies the asset filtering works correctly
        // If this fails, it means assets from other pages are being incorrectly included
        expect(hasApartadoImages).toBe(false);

        console.log('Page export correctly filtered assets - only referenced assets included');
    });

    test('should import exported page to new project', async ({ authenticatedPage, createProject }) => {
        /**
         * Test page import functionality:
         * 1. Export a page with images
         * 2. Create a new project
         * 3. Import the exported page
         * 4. Verify the page structure is imported
         * 5. Verify images load correctly (blob:// URLs)
         *
         * After the fix, the client-side export includes IndexedDB assets,
         * so the import should also have working images.
         */
        const page = authenticatedPage;

        // Skip if fixture doesn't exist
        if (!fs.existsSync(FIXTURE_ELPX_WITH_IMAGES)) {
            test.skip();
            return;
        }

        // 1. Open the fixture ELPX file
        console.log('Opening fixture ELPX file...');
        await openElpFile(page, FIXTURE_ELPX_WITH_IMAGES, 2);
        await waitForAppReady(page);

        // 2. Navigate to "Inicio" page (which has images)
        await navigateToPageByTitle(page, 'Inicio');
        await page.waitForTimeout(1500);

        const nodeId = await page.evaluate(() => {
            const selected = document.querySelector('.nav-element.selected');
            return selected?.getAttribute('nav-id') || null;
        });

        if (!nodeId) {
            throw new Error('Could not find node ID');
        }

        // 3. Export the page
        const download = await exportPage(page, nodeId);
        const exportedFilePath = path.join(tempDir, download.suggestedFilename());
        await download.saveAs(exportedFilePath);

        console.log(`Page exported to: ${exportedFilePath}`);

        // 4. Verify the export has images before importing
        const zipFiles = getZipFileNames(exportedFilePath);
        const resourceFiles = zipFiles.filter(f => f.startsWith('content/resources/'));
        console.log(`Exported ZIP has ${resourceFiles.length} resource files`);
        expect(resourceFiles.length).toBeGreaterThan(0);

        // 5. Create a NEW project
        const newProjectUuid = await createProject(page, 'Page Import Test');
        await page.goto(`/workarea?project=${newProjectUuid}`);
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);
        await waitForLoadingScreenHidden(page);

        // 6. Select the first page
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(1000);

        // 7. Import the exported page using the file input
        const fileInput = page.locator('#local-ode-file-upload');
        await fileInput.waitFor({ state: 'attached', timeout: 10000 });
        await fileInput.setInputFiles(exportedFilePath);

        // Wait for import to complete
        await page.waitForTimeout(3000);

        // 8. Wait for imported page to appear in navigation (will be 2nd page since project already has one)
        await page.waitForFunction(
            () => {
                const navElements = document.querySelectorAll('.nav-element:not([nav-id="root"])');
                return navElements.length >= 2;
            },
            { timeout: 15000 },
        );

        // 9. Verify the imported page exists in navigation
        const pageCount = await page.evaluate(() => {
            const navElements = document.querySelectorAll('.nav-element:not([nav-id="root"])');
            return navElements.length;
        });
        console.log(`Navigation has ${pageCount} pages after import`);
        expect(pageCount).toBeGreaterThanOrEqual(2);

        // 10. Select the IMPORTED page (second page, index 1)
        await selectPageByIndex(page, 1);
        await page.waitForTimeout(2000); // Extra time for assets to load

        // 11. Verify the imported page has content
        const hasContent = await page.evaluate(() => {
            const nodeContent = document.querySelector('#node-content');
            const idevices = nodeContent?.querySelectorAll('.idevice_node');
            return idevices ? idevices.length > 0 : false;
        });
        console.log(`Imported page has iDevices: ${hasContent}`);
        expect(hasContent).toBe(true);

        // 12. Verify images loaded correctly (should have blob:// URLs)
        const imageInfo = await page.evaluate(() => {
            const nodeContent = document.querySelector('#node-content');
            const images = nodeContent?.querySelectorAll('.idevice_node img');
            if (!images || images.length === 0) return { count: 0, sources: [] };
            return {
                count: images.length,
                sources: Array.from(images).map(img => (img as HTMLImageElement).src),
            };
        });
        console.log(`Imported page has ${imageInfo.count} images`);
        console.log('Image sources:', imageInfo.sources.slice(0, 3)); // First 3

        // If the page has images, they should be loaded (blob:// URLs indicate success)
        if (imageInfo.count > 0) {
            const hasBlobImages = imageInfo.sources.some(src => src.startsWith('blob:'));
            console.log(`Images using blob:// URLs: ${hasBlobImages}`);
            // After the fix, images should be loaded from IndexedDB via blob:// URLs
            expect(hasBlobImages).toBe(true);
        }

        console.log('Page import with images verified successfully');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK ICON PRESERVATION IN PAGE EXPORT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Block Icon Preservation during Page Export/Import', () => {
    // Temporary directory for downloaded files
    let tempDir: string;

    test.beforeAll(() => {
        tempDir = path.join('/tmp', `exelearning-page-icon-export-${Date.now()}`);
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

    test('should preserve block icon during page export and verify iconName in content.xml', async ({
        authenticatedPage,
        createProject,
    }) => {
        /**
         * This test verifies that block icons are preserved when exporting a page:
         * 1. Create a page with a block that has an icon
         * 2. Export the page as .elpx
         * 3. Verify the content.xml contains the correct iconName
         */
        const page = authenticatedPage;

        // 1. Create a new project
        const projectUuid = await createProject(page, 'Page Icon Export Test');
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);
        await waitForLoadingScreenHidden(page);

        // 2. Select the first page
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(1000);

        // 3. Add a text iDevice
        await addTextIdevice(page);
        await editTextIdevice(page, 'Test content for page icon export');

        // 4. Wait for theme icons to be loaded
        const themeIconCount = await waitForThemeIconsLoaded(page, 1);
        if (themeIconCount === 0) {
            console.log('No theme icons available, skipping icon test');
            test.skip();
            return;
        }
        console.log(`Theme has ${themeIconCount} icons available`);

        // 5. Verify block starts with empty icon
        const hasEmptyIconBefore = await blockHasEmptyIcon(page, 0);
        expect(hasEmptyIconBefore).toBe(true);

        // 6. Change the block icon
        await changeBlockIcon(page, 0, 1);

        // 7. Verify icon changed
        const hasEmptyIconAfter = await blockHasEmptyIcon(page, 0);
        expect(hasEmptyIconAfter).toBe(false);

        // 8. Get the icon name from Yjs
        const iconNameInYjs = await getBlockIconName(page, 0);
        console.log('Icon name in Yjs before export:', iconNameInYjs);
        expect(iconNameInYjs).toBeTruthy();

        // 9. Get the node ID for export
        const nodeId = await page.evaluate(() => {
            const selected = document.querySelector('.nav-element.selected');
            return selected?.getAttribute('nav-id') || null;
        });

        if (!nodeId) {
            throw new Error('Could not find node ID for selected page');
        }

        // 10. Export the page
        const download = await exportPage(page, nodeId);
        const fileName = download.suggestedFilename();
        expect(fileName).toContain('.elpx');

        const filePath = path.join(tempDir, fileName);
        await download.saveAs(filePath);
        expect(fs.existsSync(filePath)).toBe(true);

        console.log(`Page exported to: ${filePath}`);

        // 11. Extract and verify content.xml contains the iconName
        const fileBuffer = fs.readFileSync(filePath);
        const zipContents = unzipSync(fileBuffer);

        expect(zipContents['content.xml']).toBeDefined();

        const contentXml = new TextDecoder().decode(zipContents['content.xml']);
        console.log('Content.xml snippet:', contentXml.substring(0, 500));

        // Verify iconName element contains the actual icon name
        const iconNameMatch = contentXml.match(/<iconName>([^<]*)<\/iconName>/);
        expect(iconNameMatch).not.toBeNull();

        const exportedIconName = iconNameMatch ? iconNameMatch[1] : '';
        console.log('Exported iconName:', exportedIconName);

        // The iconName should match what's in Yjs
        expect(exportedIconName).toBe(iconNameInYjs);
        expect(exportedIconName).not.toBe('');

        console.log('Block icon preserved in page export content.xml');
    });

    test('should preserve block icon when importing page to new project', async ({
        authenticatedPage,
        createProject,
    }) => {
        /**
         * This test verifies the full page export/import cycle for block icons:
         * 1. Create page with block that has an icon
         * 2. Export the page
         * 3. Import to new project
         * 4. Verify icon is preserved
         */
        const page = authenticatedPage;

        // 1. Create first project
        const projectUuid1 = await createProject(page, 'Page Icon Export Source');
        await page.goto(`/workarea?project=${projectUuid1}`);
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);
        await waitForLoadingScreenHidden(page);

        await selectPageByIndex(page, 0);
        await page.waitForTimeout(1000);

        // Add text iDevice
        await addTextIdevice(page);
        await editTextIdevice(page, 'Test content for page icon import');

        // Wait for theme icons
        const themeIconCount = await waitForThemeIconsLoaded(page, 1);
        if (themeIconCount === 0) {
            console.log('No theme icons available, skipping icon test');
            test.skip();
            return;
        }

        // Change icon
        await changeBlockIcon(page, 0, 1);

        // Get original icon name
        const originalIconName = await getBlockIconName(page, 0);
        console.log('Original icon name:', originalIconName);
        expect(originalIconName).toBeTruthy();

        // Get node ID and export
        const nodeId = await page.evaluate(() => {
            const selected = document.querySelector('.nav-element.selected');
            return selected?.getAttribute('nav-id') || null;
        });

        if (!nodeId) {
            throw new Error('Could not find node ID');
        }

        const download = await exportPage(page, nodeId);
        // Use a unique filename to avoid race conditions with parallel tests
        const uniqueFilename = `page-icon-import-${Date.now()}.elpx`;
        const exportedFilePath = path.join(tempDir, uniqueFilename);
        await download.saveAs(exportedFilePath);

        console.log(`Page exported to: ${exportedFilePath}`);

        // 2. Create a NEW project
        const projectUuid2 = await createProject(page, 'Page Icon Import Target');
        await page.goto(`/workarea?project=${projectUuid2}`);
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);
        await waitForLoadingScreenHidden(page);

        // 3. Select page and import
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(1000);

        // Import the exported page
        await importComponent(page, exportedFilePath);

        // 4. Wait for import to complete
        await page.waitForFunction(
            () => {
                const navElements = document.querySelectorAll('.nav-element:not([nav-id="root"])');
                return navElements.length >= 2;
            },
            { timeout: 15000 },
        );

        // 5. Select the IMPORTED page (second page)
        await selectPageByIndex(page, 1);
        await page.waitForTimeout(2000);

        // 6. Verify icon is preserved
        const hasEmptyIconAfterImport = await blockHasEmptyIcon(page, 0);
        expect(hasEmptyIconAfterImport).toBe(false);

        const importedIconName = await getBlockIconName(page, 0);
        console.log('Imported icon name:', importedIconName);

        expect(importedIconName).toBe(originalIconName);

        console.log('Block icon preserved after page import - test passed!');
    });
});
