import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, waitForLoadingScreen, reloadPage, gotoWorkarea } from '../helpers/workarea-helpers';
import { WorkareaPage } from '../pages/workarea.page';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for File Manager (Media Library)
 *
 * Tests the File Manager functionality including:
 * - Upload files
 * - Create folders
 * - Navigate through folder tree (breadcrumbs)
 * - Move files/folders to another folder
 * - Duplicate files
 */

/**
 * Helper to add a text iDevice and enter edit mode
 */
async function addTextIdeviceFromPanel(page: Page): Promise<void> {
    // First, select a page in the navigation tree
    const pageNodeSelectors = [
        '.nav-element-text:has-text("New page")',
        '.nav-element-text:has-text("Nueva página")',
        '[data-testid="nav-node-text"]',
        '.structure-tree li .nav-element-text',
    ];

    let pageSelected = false;
    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.click({ force: true, timeout: 5000 });
                pageSelected = true;
                break;
            } catch {
                // Try next selector
            }
        }
    }

    if (!pageSelected) {
        const treeItem = page.locator('#menu_structure .structure-tree li').first();
        if ((await treeItem.count()) > 0) {
            await treeItem.click({ force: true });
        }
    }

    await page.waitForTimeout(500);

    await page
        .waitForFunction(
            () => {
                const nodeContent = document.querySelector('#node-content');
                const metadata = document.querySelector('#properties-node-content-form');
                return nodeContent && (!metadata || !metadata.closest('.show'));
            },
            undefined,
            { timeout: 10000 },
        )
        .catch(() => {});

    // Try quick access button first
    const quickTextButton = page
        .locator('[data-testid="quick-idevice-text"], .quick-idevice-btn[data-idevice="text"]')
        .first();
    if ((await quickTextButton.count()) > 0 && (await quickTextButton.isVisible())) {
        await quickTextButton.click();
    } else {
        // Expand "Information and presentation" category
        const infoCategory = page
            .locator('#menu_idevices .accordion-item')
            .filter({ hasText: /Information|Información/i })
            .locator('.accordion-button');

        if ((await infoCategory.count()) > 0) {
            const isCollapsed = await infoCategory.first().evaluate(el => el.classList.contains('collapsed'));
            if (isCollapsed) {
                await infoCategory.first().click();
                await page.waitForTimeout(500);
            }
        }

        const textIdevice = page.locator('.idevice_item[id="text"], [data-testid="idevice-text"]').first();
        await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
        await textIdevice.click();
    }

    await page.locator('#node-content article .idevice_node.text').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to open the File Manager modal via TinyMCE image dialog
 */
async function openFileManager(page: Page): Promise<void> {
    const existingTinyMce = page.locator('.tox-menubar');
    if ((await existingTinyMce.count()) === 0) {
        await addTextIdeviceFromPanel(page);
    }

    await page.waitForSelector('.tox-menubar', { timeout: 15000 });

    const imageBtn = page.locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]').first();
    await expect(imageBtn).toBeVisible({ timeout: 10000 });
    await imageBtn.click();

    await page.waitForSelector('.tox-dialog', { timeout: 10000 });

    const browseBtn = page.locator('.tox-dialog .tox-browse-url').first();
    await expect(browseBtn).toBeVisible({ timeout: 5000 });
    await browseBtn.click();

    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });
}

/**
 * Helper to open the File Manager modal via Utilities menu.
 * Useful for imported projects where no editable iDevice is selected yet.
 */
async function openFileManagerFromUtilitiesMenu(page: Page): Promise<void> {
    await page.locator('#dropdownUtilities').click();
    await page.waitForTimeout(200);
    await page.locator('#navbar-button-filemanager').click();
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });
}

/**
 * Helper to close the File Manager modal
 */
async function closeFileManager(page: Page): Promise<void> {
    const closeBtn = page.locator('#modalFileManager .close, #modalFileManager [data-dismiss="modal"]').first();
    if ((await closeBtn.count()) > 0) {
        await closeBtn.click();
    }
    await page.waitForTimeout(500);
}

/**
 * Helper to upload a file to the File Manager
 */
async function uploadFile(page: Page, fixturePath: string): Promise<void> {
    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    await page.waitForFunction(
        () => {
            const items = document.querySelectorAll('#modalFileManager .media-library-item:not(.media-library-folder)');
            return items.length > 0;
        },
        undefined,
        { timeout: 15000 },
    );

    await page.waitForTimeout(500);
}

/**
 * Helper to create a new folder
 */
async function createFolder(page: Page, folderName: string): Promise<void> {
    const newFolderBtn = page.locator('#modalFileManager .media-library-newfolder-btn');
    await newFolderBtn.click();

    const renameDialog = page.locator('#modalFileManager .media-library-rename-dialog');
    await renameDialog.waitFor({ state: 'visible', timeout: 5000 });

    await page.locator('#modalFileManager .rename-dialog-input').fill(folderName);
    await page.locator('#modalFileManager .rename-dialog-confirm').click();

    await page.waitForSelector(`#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`, {
        timeout: 10000,
    });
}

/**
 * Helper to navigate to a folder by double-clicking on it
 */
async function navigateToFolder(page: Page, folderName: string): Promise<void> {
    const folder = page.locator(`#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`);
    await folder.dblclick();

    await page.waitForFunction(
        name => {
            const breadcrumbs = document.querySelector('#modalFileManager .media-library-breadcrumbs');
            return breadcrumbs?.textContent?.includes(name);
        },
        folderName,
        { timeout: 10000 },
    );
}

/**
 * Helper to navigate using breadcrumbs (click on home icon for root)
 */
async function navigateToRoot(page: Page): Promise<void> {
    const homeBreadcrumb = page.locator('#modalFileManager .breadcrumb-item[data-path=""]');
    await homeBreadcrumb.click();

    // Wait for breadcrumbs to show only the home icon (no path segments)
    await page.waitForFunction(
        () => {
            const breadcrumbs = document.querySelector('#modalFileManager .media-library-breadcrumbs');
            // At root, there should only be the home breadcrumb item
            const items = breadcrumbs?.querySelectorAll('.breadcrumb-item');
            return items && items.length === 1;
        },
        undefined,
        { timeout: 10000 },
    );

    await page.waitForTimeout(300);
}

/**
 * Helper to select the first file in the grid
 */
async function selectFirstFile(page: Page): Promise<void> {
    const fileItem = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
    await fileItem.waitFor({ state: 'visible', timeout: 10000 });
    await fileItem.click();

    await page.waitForSelector('#modalFileManager .media-library-sidebar-content:not([style*="display: none"])', {
        timeout: 5000,
    });
}

/**
 * Helper to duplicate selected file and wait for new file to appear.
 * Confirms the suggested name in the custom rename dialog.
 */
async function duplicateSelectedFile(page: Page, expectedCount: number): Promise<void> {
    const duplicateBtn = page.locator('#modalFileManager .media-library-duplicate-btn');
    await expect(duplicateBtn).toBeVisible({ timeout: 5000 });

    // Get the current file count before duplicating
    const countBefore = await getFileCount(page);

    // Click duplicate button — this opens the custom rename dialog
    await duplicateBtn.click();

    // Confirm the suggested name in the custom rename dialog
    const renameInput = page.locator('#modalFileManager .rename-dialog-input');
    await renameInput.waitFor({ state: 'visible', timeout: 5000 });
    // Accept the pre-filled suggested name as-is
    await page.locator('#modalFileManager .rename-dialog-confirm').click();

    // Wait for the file count to increase
    await page.waitForFunction(
        (before: number) => {
            const items = document.querySelectorAll('#modalFileManager .media-library-item:not(.media-library-folder)');
            return items.length > before;
        },
        countBefore,
        { timeout: 15000 },
    );

    // Also verify we have at least the expected count
    await page.waitForFunction(
        (count: number) => {
            const items = document.querySelectorAll('#modalFileManager .media-library-item:not(.media-library-folder)');
            return items.length >= count;
        },
        expectedCount,
        { timeout: 5000 },
    );

    await page.waitForTimeout(500);
}

/**
 * Helper to get count of file items (not folders)
 */
async function getFileCount(page: Page): Promise<number> {
    return page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').count();
}

/**
 * Helper to get count of folder items
 */
async function getFolderCount(page: Page): Promise<number> {
    return page.locator('#modalFileManager .media-library-folder').count();
}

/**
 * Helper to import/open an ELP/ELPX file via File menu.
 * Uses File > Open.
 */
async function importElpFile(page: Page, fixturePath: string): Promise<void> {
    // Open File menu
    await page.locator('#dropdownFile').click();
    await page.waitForTimeout(300);

    const openOfflineOption = page.locator('#navbar-button-open-offline');
    const openOnlineOption = page.locator('#navbar-button-openuserodefiles');
    const openOption = ((await openOfflineOption.count()) > 0 ? openOfflineOption : openOnlineOption).first();
    await expect(openOption).toHaveCount(1);

    // In static mode Open triggers a file chooser; in online mode it opens a modal with file inputs.
    const fileChooserPromise = page
        .waitForEvent('filechooser', { timeout: 12000 })
        .then(fileChooser => ({ type: 'filechooser' as const, fileChooser }))
        .catch(() => null);
    await openOption.click({ force: true });

    const modalUploadInput = page.locator('#local-ode-modal-file-upload');
    const staticOpenInput = page.locator('#static-open-file-input');

    await page
        .waitForSelector('#local-ode-modal-file-upload, #static-open-file-input', {
            state: 'attached',
            timeout: 12000,
        })
        .catch(() => {});

    if (await modalUploadInput.count()) {
        await modalUploadInput.setInputFiles(fixturePath);
    } else {
        if (await staticOpenInput.count()) {
            await staticOpenInput.setInputFiles(fixturePath);
        } else {
            const chooserResult = await fileChooserPromise;
            if (!chooserResult) {
                throw new Error('Open did not expose a file input or file chooser');
            }
            await chooserResult.fileChooser.setFiles(fixturePath);
        }
    }

    // Wait for import to complete by checking Yjs navigation has pages
    await page.waitForFunction(
        () => {
            try {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return false;
                const yDoc = bridge.getDocumentManager()?.getDoc();
                if (!yDoc) return false;
                const navigation = yDoc.getArray('navigation');
                return navigation && navigation.length >= 1;
            } catch {
                return false;
            }
        },
        undefined,
        { timeout: 90000 },
    );

    // Wait for page count to stabilize (no changes for 2 seconds)
    await page.waitForFunction(
        () => {
            try {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return false;
                const yDoc = bridge.getDocumentManager()?.getDoc();
                if (!yDoc) return false;
                const navigation = yDoc.getArray('navigation');
                if (!navigation) return false;

                const win = window as any;
                const currentCount = navigation.length;
                if (!win.__importPageCount) {
                    win.__importPageCount = currentCount;
                    win.__importStableTime = Date.now();
                    return false;
                }

                if (win.__importPageCount !== currentCount) {
                    win.__importPageCount = currentCount;
                    win.__importStableTime = Date.now();
                    return false;
                }

                return Date.now() - win.__importStableTime >= 2000;
            } catch {
                return false;
            }
        },
        undefined,
        { timeout: 90000, polling: 500 },
    );

    // Clean up temporary window variables
    await page.evaluate(() => {
        const win = window as any;
        delete win.__importPageCount;
        delete win.__importStableTime;
    });

    // Wait for loading screen to hide
    await waitForLoadingScreen(page);

    await page.waitForTimeout(500);
}

test.describe('File Manager', () => {
    test.describe('Import File Formats', () => {
        test('should show assets from new .elpx format (content.xml) with folder structure', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const fixturePath = 'test/fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx';

            // Create a new project
            const projectUuid = await createProject(page, 'Import ELPX Format Test');

            // Navigate to the project workarea
            await gotoWorkarea(page, projectUuid);

            // Wait for app to fully initialize
            await waitForAppReady(page);

            // Import the .elpx file
            await importElpFile(page, fixturePath);

            // Open File Manager
            await openFileManagerFromUtilitiesMenu(page);

            // Wait for file manager to load assets
            await page.waitForTimeout(500);

            // Verify there are folders in the file manager (from content/resources/*)
            const folderCount = await getFolderCount(page);
            const fileCount = await getFileCount(page);

            // The .elpx has assets in content/resources/* folders
            // Should have multiple folders containing the assets
            expect(folderCount + fileCount).toBeGreaterThan(0);

            // Verify we can see some expected assets
            // The fixture has images like 01.jpg, colegio.mp3, sq01.jpg, etc.
            const assetsInfo = await page.evaluate(() => {
                const items = document.querySelectorAll('#modalFileManager .media-library-item');
                return {
                    totalItems: items.length,
                    itemNames: Array.from(items)
                        .slice(0, 10)
                        .map(item => item.getAttribute('data-filename') || item.getAttribute('data-folder-name')),
                };
            });

            expect(assetsInfo.totalItems).toBeGreaterThan(0);
            console.log('ELPX Import - Assets found:', assetsInfo);
        });

        test('should show assets from legacy .elp format (contentv3.xml) at root level', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const fixturePath = 'test/fixtures/old_el_cid.elp';

            // Create a new project
            const projectUuid = await createProject(page, 'Import Legacy ELP Format Test');

            // Navigate to the project workarea
            await gotoWorkarea(page, projectUuid);

            // Wait for app to fully initialize
            await waitForAppReady(page);

            // Import the legacy .elp file
            await importElpFile(page, fixturePath);

            // Open File Manager
            await openFileManagerFromUtilitiesMenu(page);

            // Wait for file manager to load assets
            await page.waitForTimeout(500);

            // Verify there are files at root level (no folder structure in legacy format)
            const fileCount = await getFileCount(page);

            // The legacy .elp has 16+ image files at root level
            // (juglar.png, el_cid.jpg, batalla_medieval.png, etc.)
            expect(fileCount).toBeGreaterThan(0);

            // Verify we can see some expected assets from the legacy format
            const assetsInfo = await page.evaluate(() => {
                const items = document.querySelectorAll(
                    '#modalFileManager .media-library-item:not(.media-library-folder)',
                );
                return {
                    totalFiles: items.length,
                    fileNames: Array.from(items)
                        .slice(0, 10)
                        .map(item => item.getAttribute('data-filename')),
                };
            });

            expect(assetsInfo.totalFiles).toBeGreaterThan(0);
            console.log('Legacy ELP Import - Assets found:', assetsInfo);

            // Verify some expected filenames are present (known files from old_el_cid.elp)
            const expectedFiles = ['juglar.png', 'el_cid.jpg', 'batalla_medieval.png', 'elcid.png'];
            const foundFiles = assetsInfo.fileNames.filter((name: string | null) =>
                expectedFiles.some(expected => name?.includes(expected.replace('.png', '').replace('.jpg', ''))),
            );

            // At least one of the expected files should be found
            expect(foundFiles.length).toBeGreaterThanOrEqual(1);
        });
    });

    test.describe('Folder Operations', () => {
        test('should create a new folder', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'File Manager - Create Folder Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);
            await openFileManagerFromUtilitiesMenu(page);

            const folderName = `TestFolder_${Date.now()}`;
            await createFolder(page, folderName);

            const folder = page.locator(`#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`);
            await expect(folder).toBeVisible({ timeout: 5000 });
        });

        test('should navigate into folder and back using breadcrumbs', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'File Manager - Navigation Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);
            await openFileManager(page);

            // Create a folder
            const folderName = `NavFolder_${Date.now()}`;
            await createFolder(page, folderName);

            // Navigate into the folder
            await navigateToFolder(page, folderName);

            // Verify breadcrumbs show the folder name
            const breadcrumbs = page.locator('#modalFileManager .media-library-breadcrumbs');
            await expect(breadcrumbs).toContainText(folderName, { timeout: 5000 });

            // Navigate back to root
            await navigateToRoot(page);

            // Verify we're at root (folder should be visible)
            const folderItem = page.locator(
                `#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`,
            );
            await expect(folderItem).toBeVisible({ timeout: 5000 });
        });

        test('should upload file to folder', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'File Manager - Upload to Folder Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);
            await openFileManager(page);

            // Create a folder and navigate into it
            const folderName = `UploadFolder_${Date.now()}`;
            await createFolder(page, folderName);
            await navigateToFolder(page, folderName);

            // Upload a file while in the folder
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Verify file is in the folder
            const fileCount = await getFileCount(page);
            expect(fileCount).toBe(1);

            // Navigate back to root - file should not be visible there
            await navigateToRoot(page);

            // Root should only have the folder, no files
            const rootFileCount = await getFileCount(page);
            expect(rootFileCount).toBe(0);
        });
    });

    test.describe('Duplicate Operations', () => {
        test('should duplicate a file with (copy) suffix', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'File Manager - Duplicate Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);
            await openFileManager(page);

            // Upload a file
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Select the file
            await selectFirstFile(page);

            // Duplicate - expect 2 files after
            await duplicateSelectedFile(page, 2);

            // Verify we now have 2 files
            const fileCount = await getFileCount(page);
            expect(fileCount).toBeGreaterThanOrEqual(2);
        });

        test('should duplicate with incremented suffix when copy already exists', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'File Manager - Duplicate Increment Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);
            await openFileManager(page);

            // Upload a file
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Select and duplicate first time - expect 2 files
            await selectFirstFile(page);
            await duplicateSelectedFile(page, 2);

            // Select original again and duplicate second time - expect 3 files
            await selectFirstFile(page);
            await duplicateSelectedFile(page, 3);

            // Verify we now have 3 files
            const fileCount = await getFileCount(page);
            expect(fileCount).toBeGreaterThanOrEqual(3);
        });
    });

    test.describe('Rename Operations', () => {
        test('should rename a file', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'File Manager - Rename File Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);
            await openFileManager(page);

            // Upload a file
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Select the file
            await selectFirstFile(page);

            // Get original filename from sidebar
            const filenameSpan = page.locator('#modalFileManager .media-library-filename');
            await expect(filenameSpan).toBeVisible({ timeout: 5000 });
            const originalName = await filenameSpan.textContent();
            expect(originalName).toContain('sample-2');

            // Click rename button
            const renameBtn = page.locator('#modalFileManager .media-library-rename-btn');
            await expect(renameBtn).toBeVisible({ timeout: 5000 });

            const newName = `renamed-file-${Date.now()}.jpg`;
            await renameBtn.click();

            // Fill in the custom rename dialog
            const renameInput = page.locator('#modalFileManager .rename-dialog-input');
            await renameInput.waitFor({ state: 'visible', timeout: 5000 });
            await renameInput.fill(newName);
            await page.locator('#modalFileManager .rename-dialog-confirm').click();

            // Wait for the filename to update in sidebar
            await page.waitForFunction(
                (expected: string) => {
                    const span = document.querySelector('#modalFileManager .media-library-filename');
                    return span?.textContent?.includes(expected.replace('.jpg', ''));
                },
                newName,
                { timeout: 10000 },
            );

            // Verify filename changed
            const updatedName = await filenameSpan.textContent();
            expect(updatedName).toContain(newName.replace('.jpg', ''));
        });

        test('should rename a folder', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'File Manager - Rename Folder Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);
            await openFileManager(page);

            // Create an empty folder
            const originalFolderName = `OriginalFolder_${Date.now()}`;
            await createFolder(page, originalFolderName);

            // Click on folder to select it (single click)
            const folder = page.locator(
                `#modalFileManager .media-library-folder[data-folder-name="${originalFolderName}"]`,
            );
            await folder.click();

            // Wait for folder to be selected (sidebar shows folder name)
            await page.waitForFunction(
                (name: string) => {
                    const filenameEl = document.querySelector('#modalFileManager .media-library-filename');
                    return filenameEl?.textContent === name;
                },
                originalFolderName,
                { timeout: 5000 },
            );

            // Click rename button
            const renameBtn = page.locator('#modalFileManager .media-library-rename-btn');
            await expect(renameBtn).toBeVisible({ timeout: 5000 });
            await expect(renameBtn).toBeEnabled({ timeout: 5000 });

            const newFolderName = `RenamedFolder_${Date.now()}`;
            await renameBtn.click();

            // Fill in the custom rename dialog
            const renameInput = page.locator('#modalFileManager .rename-dialog-input');
            await renameInput.waitFor({ state: 'visible', timeout: 5000 });
            await renameInput.fill(newFolderName);
            await page.locator('#modalFileManager .rename-dialog-confirm').click();

            // Wait for folder with new name to appear in the grid
            await page.waitForFunction(
                (name: string) => {
                    const folder = document.querySelector(
                        `#modalFileManager .media-library-folder[data-folder-name="${name}"]`,
                    );
                    return folder !== null;
                },
                newFolderName,
                { timeout: 15000 },
            );

            // Verify original folder name is gone
            const oldFolder = page.locator(
                `#modalFileManager .media-library-folder[data-folder-name="${originalFolderName}"]`,
            );
            await expect(oldFolder).toHaveCount(0);
        });
    });

    test.describe('Delete Operations', () => {
        test('should delete a file', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'File Manager - Delete File Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);
            await openFileManager(page);

            // Upload a file
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Verify file exists
            let fileCount = await getFileCount(page);
            expect(fileCount).toBe(1);

            // Select the file
            await selectFirstFile(page);

            // Click delete button
            const deleteBtn = page.locator('#modalFileManager .media-library-delete-btn');
            await expect(deleteBtn).toBeVisible({ timeout: 5000 });

            // Set up dialog handler for delete confirmation
            page.once('dialog', async dialog => {
                await dialog.accept();
            });

            await deleteBtn.click();

            // Wait for file to be removed
            await page.waitForFunction(
                () => {
                    const items = document.querySelectorAll(
                        '#modalFileManager .media-library-item:not(.media-library-folder)',
                    );
                    return items.length === 0;
                },
                undefined,
                { timeout: 10000 },
            );

            // Verify file is deleted
            fileCount = await getFileCount(page);
            expect(fileCount).toBe(0);
        });

        test('should delete a folder', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'File Manager - Delete Folder Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);
            await openFileManager(page);

            // Create a folder
            const folderName = `FolderToDelete_${Date.now()}`;
            await createFolder(page, folderName);

            // Verify folder exists
            let folderCount = await getFolderCount(page);
            expect(folderCount).toBe(1);

            // Click on folder to select it
            const folder = page.locator(`#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`);
            await folder.click();
            await page.waitForTimeout(300);

            // Click delete button
            const deleteBtn = page.locator('#modalFileManager .media-library-delete-btn');
            await expect(deleteBtn).toBeVisible({ timeout: 5000 });

            // Set up dialog handler for delete confirmation
            page.once('dialog', async dialog => {
                await dialog.accept();
            });

            await deleteBtn.click();

            // Wait for folder to be removed
            await page.waitForFunction(
                () => {
                    const folders = document.querySelectorAll('#modalFileManager .media-library-folder');
                    return folders.length === 0;
                },
                undefined,
                { timeout: 10000 },
            );

            // Verify folder is deleted
            folderCount = await getFolderCount(page);
            expect(folderCount).toBe(0);
        });

        test('should delete folder with contents', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'File Manager - Delete Folder Contents Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);
            await openFileManager(page);

            // Create a folder
            const folderName = `FolderWithContent_${Date.now()}`;
            await createFolder(page, folderName);

            // Navigate into folder and upload a file
            await navigateToFolder(page, folderName);
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Navigate back to root
            await navigateToRoot(page);

            // Click on folder to select it
            const folder = page.locator(`#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`);
            await folder.click();
            await page.waitForTimeout(300);

            // Click delete button
            const deleteBtn = page.locator('#modalFileManager .media-library-delete-btn');
            await expect(deleteBtn).toBeVisible({ timeout: 5000 });

            // Set up dialog handler for delete confirmation (may have 2 dialogs for folder with content)
            page.on('dialog', async dialog => {
                await dialog.accept();
            });

            await deleteBtn.click();

            // Wait for folder to be removed
            await page.waitForFunction(
                () => {
                    const folders = document.querySelectorAll('#modalFileManager .media-library-folder');
                    return folders.length === 0;
                },
                undefined,
                { timeout: 15000 },
            );

            // Verify folder is deleted
            const folderCount = await getFolderCount(page);
            expect(folderCount).toBe(0);
        });
    });

    test.describe('Integration', () => {
        test('should maintain folder structure after page reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'File Manager - Persistence Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);
            await openFileManager(page);

            // Create a folder
            const folderName = `PersistFolder_${Date.now()}`;
            await createFolder(page, folderName);

            // Navigate into folder and upload a file
            await navigateToFolder(page, folderName);
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Close file manager
            await closeFileManager(page);

            // Firefox can keep a TinyMCE backdrop active, which blocks Save button clicks.
            const tinyDialog = page.locator('.tox-dialog');
            if ((await tinyDialog.count()) > 0) {
                const closeBtn = page
                    .locator(
                        '.tox-dialog .tox-dialog__header-close, .tox-dialog button[aria-label="Close"], .tox-dialog .tox-button:has-text("Cancel"), .tox-dialog .tox-button:has-text("Cancelar")',
                    )
                    .first();
                if ((await closeBtn.count()) > 0) {
                    await closeBtn.click({ force: true }).catch(() => {});
                } else {
                    await page.keyboard.press('Escape').catch(() => {});
                }
                await page
                    .waitForFunction(() => !document.querySelector('.tox-dialog-wrap__backdrop'), undefined, {
                        timeout: 5000,
                    })
                    .catch(() => {});
            }

            // Save project
            await workarea.save();
            await page.waitForTimeout(500);

            // Reload page
            await reloadPage(page);

            // Open File Manager again
            await openFileManagerFromUtilitiesMenu(page);

            // Verify folder still exists at root
            const folder = page.locator(`#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`);
            await expect(folder).toBeVisible({ timeout: 10000 });

            // Navigate into folder
            await navigateToFolder(page, folderName);

            // Verify file is still in the folder
            const fileCount = await getFileCount(page);
            expect(fileCount).toBe(1);
        });
    });

    test.describe('Cross-Project Asset Deduplication', () => {
        /**
         * This test verifies the fix for the bug where uploading an image
         * that already exists in a different project would fail to show
         * the thumbnail because the system incorrectly thought it already
         * existed in the current project.
         *
         * Bug: getAsset() always returned projectId: this.projectId,
         * so insertImage() check always passed but blob wasn't stored
         * for current project.
         *
         * Fix: getBlobRecord() returns actual stored projectId, and
         * insertImage() now stores blob for current project if needed.
         */
        test('should upload same image content to different projects and show thumbnails in both', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            // Create first project and upload image
            const projectUuidA = await createProject(page, 'Cross-Project Test A');
            await gotoWorkarea(page, projectUuidA);

            await waitForAppReady(page);
            await openFileManager(page);

            // Upload image to Project A
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Verify image appears with valid thumbnail in Project A
            const imageA = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
            await expect(imageA).toBeVisible({ timeout: 10000 });

            // Verify image has blob URL (not undefined or placeholder)
            const imgSrcA = await imageA.locator('img').getAttribute('src');
            expect(imgSrcA).toMatch(/^blob:/);

            // Get the asset ID for later comparison
            const assetIdA = await imageA.getAttribute('data-asset-id');
            expect(assetIdA).toBeTruthy();

            // Close File Manager
            await closeFileManager(page);

            // Close TinyMCE dialog if open
            const cancelBtn = page.locator('.tox-dialog .tox-button:has-text("Cancel")');
            if ((await cancelBtn.count()) > 0) {
                await cancelBtn.click();
            }

            // Create second project
            const projectUuidB = await createProject(page, 'Cross-Project Test B');
            await gotoWorkarea(page, projectUuidB);

            await waitForAppReady(page);
            await openFileManager(page);

            // Upload SAME image to Project B (same content = same hash = same assetId)
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Verify image appears with valid thumbnail in Project B
            const imageB = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
            await expect(imageB).toBeVisible({ timeout: 10000 });

            // KEY ASSERTION: Verify image has blob URL (not undefined or placeholder)
            // This was broken before the fix - image would appear but src was undefined
            const imgSrcB = await imageB.locator('img').getAttribute('src');
            expect(imgSrcB).toMatch(/^blob:/);

            // Verify naturalWidth > 0 (image actually rendered, not broken)
            const naturalWidth = await imageB.locator('img').evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);

            // Verify the asset ID is the same (content-addressed)
            const assetIdB = await imageB.getAttribute('data-asset-id');
            expect(assetIdB).toBe(assetIdA);
        });

        test('should verify console shows correct log message for cross-project upload', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const consoleLogs: string[] = [];

            // Capture console logs
            page.on('console', msg => {
                const text = msg.text();
                if (text.includes('[AssetManager]')) {
                    consoleLogs.push(text);
                }
            });

            // Create first project and upload image
            const projectUuidA = await createProject(page, 'Console Log Test A');
            await gotoWorkarea(page, projectUuidA);

            await waitForAppReady(page);
            await openFileManager(page);

            await uploadFile(page, 'test/fixtures/sample-2.jpg');
            await closeFileManager(page);

            const cancelBtn = page.locator('.tox-dialog .tox-button:has-text("Cancel")');
            if ((await cancelBtn.count()) > 0) {
                await cancelBtn.click();
            }

            // Create second project and upload same image
            const projectUuidB = await createProject(page, 'Console Log Test B');
            await gotoWorkarea(page, projectUuidB);

            await waitForAppReady(page);
            await openFileManager(page);

            // Clear previous logs
            consoleLogs.length = 0;

            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Wait for async operations
            await page.waitForTimeout(500);

            // Verify the correct log message appears (not "Asset already exists for this project")
            // The fix should show "Storing blob for current project" instead
            const hasIncorrectLog = consoleLogs.some(log => log.includes('Asset already exists for this project'));

            // If we see "Storing blob for current project", that's the fix working
            // If we see "Asset already exists", that would be the old buggy behavior
            // Note: We might also see new asset logs if hash calculation differs
            console.log('Console logs captured:', consoleLogs);

            // The key is that if it's cross-project, we should NOT see "already exists for this project"
            // We should see either "Storing blob for current project" or "New asset stored"
            expect(hasIncorrectLog).toBe(false);
        });
    });

    test.describe('Image Insertion No Duplication', () => {
        /**
         * This test verifies the fix for the bug where selecting an existing image
         * from the File Manager and inserting it into TinyMCE would cause the image
         * to be duplicated in the File Manager.
         *
         * Root cause: TinyMCE's images_upload_handler metadata does NOT automatically
         * become HTML attributes. When data-asset-id was passed as metadata, it wasn't
         * set as an attribute on the <img> element, so convertBlobURLsToAssetRefs()
         * couldn't find it and would fall back to blob URL lookup, potentially
         * creating duplicates.
         *
         * Fix: Added MutationObserver and SetContent handler in tinymce_5_settings.js
         * to explicitly add data-asset-id as HTML attribute on images with blob URLs.
         */
        test('should NOT duplicate image when inserting existing asset from file manager', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'File Manager - No Duplicate Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Step 1: Open File Manager and upload an image
            await openFileManager(page);
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Verify initial count is 1
            const initialCount = await getFileCount(page);
            expect(initialCount).toBe(1);

            // Step 2: Select the image and insert it
            await selectFirstFile(page);
            const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
            await expect(insertBtn).toBeVisible({ timeout: 5000 });
            await insertBtn.click();

            // Wait for File Manager to close
            await page.waitForTimeout(500);

            // Step 3: Fill alternative description to avoid prompt
            // Locate by label text (works for both English "Alternative description" and Spanish "Descripción alternativa")
            const altTextField = page
                .locator('.tox-dialog .tox-form__group')
                .filter({ has: page.locator('label:text-matches("alternativ", "i")') })
                .locator('.tox-textfield');
            if ((await altTextField.count()) > 0) {
                await altTextField.fill('Test image description');
            }

            // Step 5: Save the TinyMCE dialog (which inserts the image)
            const saveBtn = page.locator(
                '.tox-dialog .tox-button[title="Save"], .tox-dialog .tox-button:has-text("Save")',
            );
            if ((await saveBtn.count()) > 0) {
                await saveBtn.first().click();
            }

            await page.waitForTimeout(500);

            // Step 6: Save the iDevice
            const idevice = page.locator('#node-content article .idevice_node.text').first();
            const saveIdeviceBtn = idevice.locator('.btn-save-idevice');
            if ((await saveIdeviceBtn.count()) > 0) {
                await saveIdeviceBtn.click();
            }

            // Wait for iDevice to exit edit mode
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                undefined,
                { timeout: 15000 },
            );

            // Step 7: Open File Manager again and verify count is still 1
            // First, enter edit mode again
            const editIdeviceBtn = idevice.locator('.btn-edit-idevice');
            await editIdeviceBtn.click();
            await page.waitForSelector('.tox-menubar', { timeout: 15000 });

            // Open File Manager via TinyMCE image button
            await openFileManager(page);

            // CRITICAL ASSERTION: Image should NOT be duplicated
            const finalCount = await getFileCount(page);
            expect(finalCount).toBe(1); // Should still be 1, not 2

            // Verify the same image is present (by filename)
            const fileItem = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
            const filename = await fileItem.getAttribute('data-filename');
            expect(filename).toContain('sample-2');
        });
    });

    test.describe('Recursive Search', () => {
        /**
         * Helper to type in search input and wait for results
         */
        async function searchFiles(page: Page, term: string): Promise<void> {
            const searchInput = page.locator('#modalFileManager .media-library-search');
            await searchInput.fill(term);
            // Wait for debounce and render
            await page.waitForTimeout(500);
        }

        test('should search files recursively across all subfolders', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'File Manager - Recursive Search Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManager(page);

            // Create nested folder structure
            const folderName = `Images_${Date.now()}`;
            await createFolder(page, folderName);
            await navigateToFolder(page, folderName);

            // Upload file with unique name to subfolder
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Navigate back to root
            await navigateToRoot(page);

            // Search for the file
            await searchFiles(page, 'sample-2');

            // Verify file from subfolder appears in search results
            const fileItem = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)');
            await expect(fileItem).toBeVisible({ timeout: 10000 });

            // Verify folders are NOT shown during search
            const folderItem = page.locator('#modalFileManager .media-library-folder');
            await expect(folderItem).toHaveCount(0);
        });

        test('should show search indicator instead of breadcrumbs', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'File Manager - Search Indicator Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManager(page);

            // Upload a file so we have something to search
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Type search term
            await searchFiles(page, 'sample');

            // Verify breadcrumbs are hidden
            const breadcrumbs = page.locator('#modalFileManager .media-library-breadcrumbs');
            await expect(breadcrumbs).toHaveClass(/d-none/);

            // Verify search indicator is visible
            const searchIndicator = page.locator('#modalFileManager .media-library-search-indicator');
            await expect(searchIndicator).toBeVisible();
            await expect(searchIndicator).toContainText('sample');

            // Verify home icon and X button are present
            const homeIcon = searchIndicator.locator('.breadcrumb-home');
            const clearBtn = searchIndicator.locator('.clear-search-btn');
            await expect(homeIcon).toBeVisible();
            await expect(clearBtn).toBeVisible();
        });

        test('should display path badge in grid view during search', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'File Manager - Path Badge Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManager(page);

            // Create folder and upload file inside
            const folderName = `Events_${Date.now()}`;
            await createFolder(page, folderName);
            await navigateToFolder(page, folderName);
            await uploadFile(page, 'test/fixtures/sample-2.jpg');
            await navigateToRoot(page);

            // Search for file
            await searchFiles(page, 'sample');

            // Verify path badge is visible on grid item
            const pathBadge = page.locator('#modalFileManager .media-library-item .item-path-badge');
            await expect(pathBadge).toBeVisible();
            await expect(pathBadge).toContainText(folderName);
        });

        test('should navigate to folder when clicking path badge', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'File Manager - Path Navigation Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManager(page);

            // Create folder and upload file inside
            const folderName = `NavTest_${Date.now()}`;
            await createFolder(page, folderName);
            await navigateToFolder(page, folderName);
            await uploadFile(page, 'test/fixtures/sample-2.jpg');
            await navigateToRoot(page);

            // Search for file
            await searchFiles(page, 'sample');

            // Click path badge
            const pathBadge = page.locator('#modalFileManager .media-library-item .item-path-badge');
            await pathBadge.click();

            // Verify search is cleared and navigated to folder
            const searchInput = page.locator('#modalFileManager .media-library-search');
            await expect(searchInput).toHaveValue('');

            // Verify breadcrumbs show folder
            const breadcrumbs = page.locator('#modalFileManager .media-library-breadcrumbs');
            await expect(breadcrumbs).toContainText(folderName);
        });

        test('should show location in sidebar with open folder button', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'File Manager - Sidebar Location Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManager(page);

            // Create folder and upload file inside
            const folderName = `SidebarTest_${Date.now()}`;
            await createFolder(page, folderName);
            await navigateToFolder(page, folderName);
            await uploadFile(page, 'test/fixtures/sample-2.jpg');
            await navigateToRoot(page);

            // Search and select file
            await searchFiles(page, 'sample');
            await selectFirstFile(page);

            // Verify location row in sidebar
            const locationRow = page.locator('#modalFileManager .media-library-location-row');
            await expect(locationRow).toBeVisible();

            const locationValue = page.locator('#modalFileManager .media-library-location-value');
            await expect(locationValue).toContainText(folderName);

            // Verify open folder button exists
            const openFolderBtn = page.locator('#modalFileManager .media-library-open-folder-btn');
            await expect(openFolderBtn).toBeVisible();

            // Click open folder button
            await openFolderBtn.click();

            // Verify navigated to folder
            const breadcrumbs = page.locator('#modalFileManager .media-library-breadcrumbs');
            await expect(breadcrumbs).toContainText(folderName);
        });

        test('should clear search when clicking X button', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'File Manager - Clear Search Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManager(page);

            // Upload file and create folder
            await uploadFile(page, 'test/fixtures/sample-2.jpg');
            const folderName = `ClearTest_${Date.now()}`;
            await createFolder(page, folderName);

            // Search
            await searchFiles(page, 'sample');

            // Verify search indicator is visible
            const searchIndicator = page.locator('#modalFileManager .media-library-search-indicator');
            await expect(searchIndicator).toBeVisible();

            // Click X button
            const clearBtn = page.locator('#modalFileManager .clear-search-btn');
            await clearBtn.click();

            // Wait for UI to update
            await page.waitForTimeout(300);

            // Verify search is cleared
            const searchInput = page.locator('#modalFileManager .media-library-search');
            await expect(searchInput).toHaveValue('');

            // Verify breadcrumbs restored
            const breadcrumbs = page.locator('#modalFileManager .media-library-breadcrumbs');
            await expect(breadcrumbs).not.toHaveClass(/d-none/);

            // Verify folder is visible again (not hidden by search mode)
            const folder = page.locator(`#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`);
            await expect(folder).toBeVisible();
        });

        test('should go to root when clicking home icon during search', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'File Manager - Home Icon Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openFileManager(page);

            // Create nested structure
            const folderName = `HomeTest_${Date.now()}`;
            await createFolder(page, folderName);
            await navigateToFolder(page, folderName);
            await uploadFile(page, 'test/fixtures/sample-2.jpg');

            // Search while in subfolder
            await searchFiles(page, 'sample');

            // Click home icon in search indicator
            const homeIcon = page.locator('#modalFileManager .media-library-search-indicator .breadcrumb-home');
            await homeIcon.click();

            // Wait for UI to update
            await page.waitForTimeout(300);

            // Verify search cleared
            const searchInput = page.locator('#modalFileManager .media-library-search');
            await expect(searchInput).toHaveValue('');

            // Verify at root (folder should be visible)
            const folder = page.locator(`#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`);
            await expect(folder).toBeVisible();
        });
    });
});
