import { test, expect, waitForLoadingScreenHidden } from '../fixtures/auth.fixture';
import type { Page, Download } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * E2E Tests for Component Export/Import
 *
 * Tests the ability to:
 * - Export a block as .block file
 * - Export an iDevice as .idevice file
 * - Import .block files into different pages
 * - Import .idevice files into different pages
 */

/**
 * Helper to select a page in the navigation tree
 */
async function selectPage(page: Page, pageIndex: number = 0): Promise<void> {
    // Get all page nodes (excluding root)
    const pageNodes = page.locator('.nav-element:not([nav-id="root"]) > .nav-element-text');
    const count = await pageNodes.count();

    if (count === 0) {
        throw new Error('No pages found in navigation tree');
    }

    const targetIndex = Math.min(pageIndex, count - 1);
    const targetNode = pageNodes.nth(targetIndex);

    await targetNode.scrollIntoViewIfNeeded();
    await targetNode.click({ force: true });
    await page.waitForTimeout(1000);

    // Wait for page content area to be ready
    await page
        .waitForFunction(
            () => {
                const nodeContent = document.querySelector('#node-content');
                const metadata = document.querySelector('#properties-node-content-form');
                return nodeContent && (!metadata || !metadata.closest('.show'));
            },
            { timeout: 10000 },
        )
        .catch(() => {});
}

/**
 * Helper to add a text iDevice to the current page
 */
async function addTextIdevice(page: Page): Promise<void> {
    // Expand "Information and presentation" category
    const infoCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }),
        })
        .first();

    if ((await infoCategory.count()) > 0) {
        const isCollapsed = await infoCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            await infoCategory.locator('.label').click();
            await page.waitForTimeout(800);
        }
    }

    // Click text iDevice
    const textIdevice = page.locator('.idevice_item[id="text"]').first();
    await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await textIdevice.click();

    // Wait for iDevice to appear
    await page.locator('#node-content article .idevice_node.text').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to edit and save a text iDevice
 */
async function editTextIdevice(page: Page, content: string): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.text').last();
    await block.waitFor({ timeout: 10000 });

    // Check if already in edition mode (TinyMCE visible or mode attribute)
    const isEdition = await block.evaluate(el => {
        const hasMode = el.getAttribute('mode') === 'edition';
        const hasTinyMCE = el.querySelector('.tox-tinymce') !== null;
        return hasMode || hasTinyMCE;
    });

    if (!isEdition) {
        // Enter edit mode
        const editBtn = block.locator('.btn-edit-idevice');
        await editBtn.waitFor({ timeout: 10000 });
        await editBtn.click();
        await page.waitForTimeout(500);
    }

    // Wait for TinyMCE editor to load
    await page.waitForSelector('.tox-edit-area__iframe', { timeout: 15000 });

    // Find the TinyMCE iframe and type content
    const frameEl = await block
        .locator('iframe.tox-edit-area__iframe, iframe[title="Rich Text Area"]')
        .first()
        .elementHandle();

    if (frameEl) {
        const frame = await frameEl.contentFrame();
        if (frame) {
            await frame.waitForSelector('body', { timeout: 8000 });
            await frame.evaluate(() => {
                document.body.innerHTML = '';
            });
            await frame.focus('body');
            await frame.type('body', content, { delay: 5 });
        }
    }

    // Wait a bit before saving to ensure content is synced
    await page.waitForTimeout(500);

    // Save the iDevice
    const saveBtn = block.locator('.btn-save-idevice');
    await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await saveBtn.click();

    // Wait for TinyMCE to be removed (indicates edit mode ended)
    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            if (!idevice) return false;
            // TinyMCE editor should be gone after save
            const hasTinyMCE = idevice.querySelector('.tox-tinymce') !== null;
            const isEditionMode = idevice.getAttribute('mode') === 'edition';
            return !hasTinyMCE && !isEditionMode;
        },
        { timeout: 15000 },
    );

    // Wait a bit more for DOM to stabilize
    await page.waitForTimeout(500);
}

/**
 * Helper to get block and iDevice IDs from the page
 * Uses the dropdown button IDs as the source of truth, similar to cloning test
 */
async function getBlockAndIdeviceIds(page: Page): Promise<{ blockId: string; ideviceId: string }> {
    // Find the block - it's article.box in #node-content
    const blockNode = page.locator('#node-content article.box').first();
    await blockNode.waitFor({ state: 'visible', timeout: 15000 });

    // Get block ID from the element's 'id' attribute
    const blockId = await blockNode.getAttribute('id');
    if (!blockId) {
        // Debug: check what's in node-content
        const html = await page.evaluate(() => document.querySelector('#node-content')?.innerHTML.substring(0, 1000));
        console.log('Node content HTML:', html);
        throw new Error('Block does not have an id attribute');
    }

    // Find the iDevice inside the block
    // The iDevice dropdown button has id="dropdownMenuButtonIdevice{ideviceId}"
    const ideviceDropdown = blockNode.locator('[id^="dropdownMenuButtonIdevice"]').first();
    await ideviceDropdown.waitFor({ state: 'attached', timeout: 10000 });

    const dropdownId = await ideviceDropdown.getAttribute('id');
    const ideviceId = dropdownId?.replace('dropdownMenuButtonIdevice', '') || '';

    if (!ideviceId) {
        // Try alternative: get ID from idevice_node article
        const ideviceNode = blockNode.locator('article.idevice_node').first();
        const altId = await ideviceNode.getAttribute('id').catch(() => null);
        if (altId) {
            return { blockId, ideviceId: altId };
        }
        throw new Error('Could not find iDevice ID');
    }

    return { blockId, ideviceId };
}

/**
 * Helper to export a block as .block file
 */
async function exportBlock(page: Page, blockId: string): Promise<Download> {
    // Click on the block's actions dropdown button (three dots)
    const dropdownBtn = page.locator(`#dropdownMenuButton${blockId}`);
    await dropdownBtn.waitFor({ state: 'visible', timeout: 10000 });
    await dropdownBtn.click();
    await page.waitForTimeout(300);

    // Wait for download event and click export button
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    const exportBtn = page.locator(`#dropdownBlockMore-button-export${blockId}`);
    await exportBtn.waitFor({ state: 'visible', timeout: 5000 });
    await exportBtn.click();

    const download = await downloadPromise;
    return download;
}

/**
 * Helper to export an iDevice as .idevice file
 */
async function exportIdevice(page: Page, blockId: string, ideviceId: string): Promise<Download> {
    // Click on the iDevice's actions dropdown button (three dots horizontal)
    const dropdownBtn = page.locator(`#dropdownMenuButtonIdevice${ideviceId}`);
    await dropdownBtn.waitFor({ state: 'visible', timeout: 10000 });
    await dropdownBtn.click();
    await page.waitForTimeout(300);

    // Wait for download event and click export button
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    const exportBtn = page.locator(`#exportIdevice${ideviceId}`);
    await exportBtn.waitFor({ state: 'visible', timeout: 5000 });
    await exportBtn.click();

    const download = await downloadPromise;
    return download;
}

/**
 * Helper to add a new page to the project via Yjs bridge
 */
async function addNewPage(page: Page, pageName: string = 'New Page'): Promise<string> {
    const pageId = await page.evaluate(name => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        if (!bridge) throw new Error('Yjs bridge not available');

        // Add page using the structure binding
        const newPage = bridge.structureBinding.addPage(name, null);
        return newPage.id || newPage.pageId;
    }, pageName);

    await page.waitForTimeout(500);
    return pageId;
}

/**
 * Helper to import a component file (.block or .idevice) to the current page
 */
async function importComponentFile(page: Page, filePath: string): Promise<void> {
    // Open the file menu to trigger import
    // The import is handled by modalOpenUserOdeFiles when file type is .idevice or .block

    // Create a file input for import (the modal uses a hidden file input)
    const fileInput = await page.evaluateHandle(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.idevice,.block';
        input.style.display = 'none';
        document.body.appendChild(input);
        return input;
    });

    // Set up the import handler
    await page.evaluate(() => {
        const input = document.querySelector('input[type="file"][accept=".idevice,.block"]') as HTMLInputElement;
        if (input) {
            input.addEventListener('change', async e => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;

                // Get the modal instance and call largeFilesUpload with isImportIdevices=true
                const modal = (window as any).eXeLearning?.app?.modals?.openuserodefiles;
                if (modal) {
                    await modal.largeFilesUpload(file, true);
                }
            });
        }
    });

    // Set the file
    await (fileInput as any).setInputFiles(filePath);
    await page.waitForTimeout(2000);

    // Clean up
    await page.evaluate(() => {
        const input = document.querySelector('input[type="file"][accept=".idevice,.block"]');
        if (input) input.remove();
    });
}

/**
 * Alternative helper to import component via the Open modal
 */
async function importComponentViaModal(page: Page, filePath: string): Promise<void> {
    // Ensure ComponentImporter is loaded
    try {
        await page.waitForFunction(
            () => {
                return (window as any).ComponentImporter !== undefined;
            },
            { timeout: 15000 },
        );
    } catch {
        const debugInfo = await page.evaluate(() => ({
            YjsLoaderLoaded: (window as any).YjsLoader?.getStatus?.()?.loaded,
            ComponentImporter: typeof (window as any).ComponentImporter,
        }));
        throw new Error(`ComponentImporter not loaded: ${JSON.stringify(debugInfo)}`);
    }

    // Open file dialog via keyboard shortcut
    await page.keyboard.press('Control+o');
    await page.waitForTimeout(500);

    // Wait for modal to open
    const modal = page.locator('#modalOpenUserOdeFiles, .modal-open-file');
    await modal.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    // Find the file input in the modal - look for the large files upload input
    const fileInput = page.locator('#local-ode-modal-file-upload, input[type="file"]').first();

    // Set the file
    await fileInput.setInputFiles(filePath);

    // Wait for import to complete - watch for either success (new iDevice) or error modal
    await page.waitForTimeout(3000);

    // Close any error modal if present
    const errorModal = page.locator('.modal.show:has-text("Import error"), .modal.show:has-text("Error")');
    if (await errorModal.isVisible().catch(() => false)) {
        const errorText = await errorModal.textContent();
        console.log('Import error modal:', errorText);
        const closeBtn = errorModal.locator('.btn-close, button:has-text("Close")').first();
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
        }
        throw new Error(`Import failed: ${errorText}`);
    }
}

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
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        // Wait for app initialization
        await page.waitForFunction(
            () => {
                const app = (window as any).eXeLearning?.app;
                return app?.project?._yjsBridge !== undefined;
            },
            { timeout: 30000 },
        );

        await waitForLoadingScreenHidden(page);

        // 2. Select the first page
        await selectPage(page, 0);
        await page.waitForTimeout(1000);

        // 3. Add a text iDevice with content
        await addTextIdevice(page);
        const testContent = `Test content for export ${Date.now()}`;
        await editTextIdevice(page, testContent);

        // 4. Get the block and iDevice IDs
        const { blockId, ideviceId } = await getBlockAndIdeviceIds(page);
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
        const ideviceDownload = await exportIdevice(page, blockId, ideviceId);
        const ideviceFileName = ideviceDownload.suggestedFilename();
        expect(ideviceFileName).toContain('.idevice');

        const ideviceFilePath = path.join(tempDir, ideviceFileName);
        await ideviceDownload.saveAs(ideviceFilePath);
        expect(fs.existsSync(ideviceFilePath)).toBe(true);

        console.log(`iDevice exported to: ${ideviceFilePath}`);

        // 7. Add two new pages for importing
        await addNewPage(page);
        await page.waitForTimeout(1000);
        await addNewPage(page);
        await page.waitForTimeout(1000);

        // 8. Select page 2 and import the block
        await selectPage(page, 1);
        await page.waitForTimeout(1000);

        // Import the block file
        await importComponentViaModal(page, blockFilePath);

        // Wait for import to complete and verify
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 1;
            },
            { timeout: 15000 },
        );

        // Verify the imported block appears
        const importedBlockOnPage2 = page.locator('#node-content article .idevice_node.text').first();
        await expect(importedBlockOnPage2).toBeVisible({ timeout: 10000 });

        console.log('Block successfully imported to page 2');

        // 9. Select page 3 and import the iDevice
        await selectPage(page, 2);
        await page.waitForTimeout(1000);

        // Import the iDevice file
        await importComponentViaModal(page, ideviceFilePath);

        // Wait for import to complete and verify
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 1;
            },
            { timeout: 15000 },
        );

        // Verify the imported iDevice appears
        const importedIdeviceOnPage3 = page.locator('#node-content article .idevice_node.text').first();
        await expect(importedIdeviceOnPage3).toBeVisible({ timeout: 10000 });

        console.log('iDevice successfully imported to page 3');

        // 10. Verify all three pages have content
        // Go back to page 1 and verify original content
        await selectPage(page, 0);
        await page.waitForTimeout(1000);

        const originalContent = page.locator('#node-content article .idevice_node.text').first();
        await expect(originalContent).toBeVisible({ timeout: 10000 });

        console.log('Test completed successfully - export and import working correctly');
    });

    test('should export block and verify file format', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create project with text iDevice
        const projectUuid = await createProject(page, 'Block Export Format Test');
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        await page.waitForFunction(
            () => {
                const app = (window as any).eXeLearning?.app;
                return app?.project?._yjsBridge !== undefined;
            },
            { timeout: 30000 },
        );

        await waitForLoadingScreenHidden(page);

        // Add text iDevice
        await selectPage(page, 0);
        await addTextIdevice(page);
        await editTextIdevice(page, 'Block export test content');

        const { blockId } = await getBlockAndIdeviceIds(page);

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
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        await page.waitForFunction(
            () => {
                const app = (window as any).eXeLearning?.app;
                return app?.project?._yjsBridge !== undefined;
            },
            { timeout: 30000 },
        );

        await waitForLoadingScreenHidden(page);

        // Add text iDevice
        await selectPage(page, 0);
        await addTextIdevice(page);
        await editTextIdevice(page, 'iDevice export test content');

        const { blockId, ideviceId } = await getBlockAndIdeviceIds(page);

        // Export the iDevice
        const download = await exportIdevice(page, blockId, ideviceId);
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
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        // Wait for app initialization
        await page.waitForFunction(
            () => {
                const app = (window as any).eXeLearning?.app;
                return app?.project?._yjsBridge !== undefined;
            },
            { timeout: 30000 },
        );

        await waitForLoadingScreenHidden(page);

        // 2. Select the first page
        await selectPage(page, 0);
        await page.waitForTimeout(1000);

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
        await importComponentViaModal(page, ideviceFilePath);

        // 4. Wait for the iDevice to appear
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 1;
            },
            { timeout: 15000 },
        );

        // Verify the iDevice is visible
        const importedIdevice = page.locator('#node-content article .idevice_node.text').first();
        await expect(importedIdevice).toBeVisible({ timeout: 10000 });

        console.log('iDevice imported successfully');

        // 5. KEY TEST: Verify the image is visible WITHOUT refreshing the page
        // The bug was that images wouldn't appear until refresh
        // Wait for asset resolution to complete
        await page.waitForTimeout(2000);

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
            { timeout: 15000 },
        );

        expect(await imageLoaded.jsonValue()).toBe(true);

        console.log('Image loaded successfully without page refresh - issue #953 is fixed');

        // 8. BONUS: Verify the asset is available in the file manager
        // Open file manager
        const fileManagerBtn = page.locator('[data-bs-target="#modalFileManager"], #head-bottom-filemanager');
        if ((await fileManagerBtn.count()) > 0) {
            await fileManagerBtn.click();
            await page.waitForTimeout(1000);

            // Check if the modal opened
            const modal = page.locator('#modalFileManager[data-open="true"], #modalFileManager.show');
            if (await modal.isVisible().catch(() => false)) {
                // Wait for assets to load
                await page.waitForTimeout(1500);

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
