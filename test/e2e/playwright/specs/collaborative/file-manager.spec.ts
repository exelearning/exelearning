import { test, expect, skipInStaticMode } from '../../fixtures/collaboration.fixture';
import { waitForYjsSync } from '../../helpers/sync-helpers';
import { waitForLoadingScreen, waitForAppReady, dismissBlockingAlertModal } from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';
import { addTextIdevice } from '../../helpers/workarea-helpers';

/**
 * Collaborative File Manager Tests
 *
 * These tests verify that File Manager operations sync in real-time
 * between multiple clients connected to the same project via WebSocket.
 *
 * NOTE: These tests are skipped in static mode as they require WebSocket collaboration
 */

/**
 * Helper to open the File Manager modal.
 * Fast path: open from Utilities menu (more stable in CI).
 * Fallback: TinyMCE image dialog for flows where navbar entry is unavailable.
 */
async function openFileManager(page: Page): Promise<void> {
    const fileManagerModal = page.locator('#modalFileManager[data-open="true"], #modalFileManager.show');
    if (await fileManagerModal.isVisible().catch(() => false)) {
        return;
    }

    const openFromUtilitiesMenu = async (): Promise<boolean> => {
        try {
            await dismissBlockingAlertModal(page);

            const fileManagerBtn = page.locator('#navbar-button-filemanager').first();
            if (await fileManagerBtn.isVisible().catch(() => false)) {
                await fileManagerBtn.click();
                await fileManagerModal.waitFor({ state: 'visible', timeout: 10000 });
                return true;
            }

            const utilitiesDropdown = page.locator('#dropdownUtilities').first();
            if (await utilitiesDropdown.isVisible().catch(() => false)) {
                await utilitiesDropdown.click();
                await page.waitForTimeout(150);
            }

            if (await fileManagerBtn.isVisible().catch(() => false)) {
                await fileManagerBtn.click();
                await fileManagerModal.waitFor({ state: 'visible', timeout: 10000 });
                return true;
            }
        } catch {
            return false;
        }

        return false;
    };

    if (await openFromUtilitiesMenu()) {
        return;
    }

    const textBlocks = page.locator('#node-content article .idevice_node.text');
    if ((await textBlocks.count()) === 0) {
        await addTextIdevice(page);
    }

    const editionBlock = page
        .locator(
            '#node-content article .idevice_node.text[mode="edition"], #node-content article .idevice_node.text:has(.tox-tinymce)',
        )
        .first();

    if ((await editionBlock.count()) === 0) {
        const editableEditBtn = page
            .locator('#node-content article .idevice_node.text .btn-edit-idevice:not([disabled])')
            .first();
        await editableEditBtn.waitFor({ state: 'visible', timeout: 10000 });
        await editableEditBtn.click();
    }

    await page.waitForSelector('.tox-tinymce, .tox-toolbar, .tox-edit-area, .tox-tbtn', { timeout: 25000 });
    await dismissBlockingAlertModal(page);

    const imageBtn = page.locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]').first();
    await expect(imageBtn).toBeVisible({ timeout: 10000 });
    await imageBtn.click();

    await page.waitForSelector('.tox-dialog', { timeout: 10000 });

    const browseBtn = page.locator('.tox-dialog .tox-browse-url').first();
    await expect(browseBtn).toBeVisible({ timeout: 5000 });
    await browseBtn.click();

    await fileManagerModal.waitFor({ state: 'visible', timeout: 10000 });
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
 * Helper to select the first file in the grid
 */
async function selectFirstFile(page: Page): Promise<void> {
    const fileItem = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
    await fileItem.waitFor({ state: 'visible', timeout: 10000 });
    await fileItem.click({ force: true });

    // Wait for item to be selected
    await page.waitForFunction(
        () => {
            const item = document.querySelector('#modalFileManager .media-library-item:not(.media-library-folder)');
            return !!item && item.classList.contains('selected');
        },
        null,
        { timeout: 10000 },
    );

    // Wait for sidebar content to be populated (filename element has content)
    // This indicates showSidebarContent() has completed its async work including getImageDimensions()
    await page.waitForFunction(
        () => {
            const filenameEl = document.querySelector('#modalFileManager .media-library-filename');
            return filenameEl?.textContent && filenameEl.textContent.trim().length > 0;
        },
        null,
        { timeout: 10000 },
    );

    // Give the UI a brief moment to finish button state updates after sidebar render.
    await page.waitForTimeout(150);
}

/**
 * Helper to get count of file items (not folders)
 */
async function getFileCount(page: Page): Promise<number> {
    return page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').count();
}

/**
 * Helper to wait for Yjs bridge initialization
 */
async function waitForYjsBridge(page: Page): Promise<void> {
    await waitForAppReady(page);
}

test.describe('Collaborative File Manager', () => {
    // Collaboration tests need more time for WebSocket sync between clients
    test.setTimeout(90000); // 3 minutes per test

    // Skip all collaboration tests in static mode
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    test.describe('Real-Time Asset Rename Sync', () => {
        test('should sync file rename from Client A to Client B', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            // Client A creates a project
            const projectUuid = await createProject(pageA, 'Collaborative File Manager - Rename Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsBridge(pageA);
            await waitForLoadingScreen(pageA);

            // Client A gets share URL and shares project
            const shareUrl = await getShareUrl(pageA);

            // Client B joins the project
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageB);

            // Both clients wait for sync
            await waitForYjsSync(pageA);
            await waitForYjsSync(pageB);

            // Client A opens File Manager and uploads a file
            await openFileManager(pageA);
            await uploadFile(pageA, 'test/fixtures/sample-2.jpg');

            // Wait for asset to sync via WebSocket (asset-announced message)
            await pageA.waitForTimeout(500);

            // Client A selects the file and renames it
            await selectFirstFile(pageA);

            const filenameSpanA = pageA.locator('#modalFileManager .media-library-filename');
            await expect(filenameSpanA).toBeVisible({ timeout: 5000 });
            const originalFilename = await filenameSpanA.textContent();
            expect(originalFilename).toContain('sample-2');

            // Click rename button on Client A and fill in the custom rename dialog
            const newFilename = `synced-rename-${Date.now()}.jpg`;
            const renameBtn = pageA.locator('#modalFileManager .media-library-rename-btn');
            await renameBtn.click();
            const renameInputA = pageA.locator('#modalFileManager .rename-dialog-input');
            await renameInputA.waitFor({ state: 'visible', timeout: 5000 });
            await renameInputA.fill(newFilename);
            await pageA.locator('#modalFileManager .rename-dialog-confirm').click();

            // Wait for rename to complete on Client A
            await pageA.waitForFunction(
                (expected: string) => {
                    const span = document.querySelector('#modalFileManager .media-library-filename');
                    return span?.textContent?.includes(expected.replace('.jpg', ''));
                },
                newFilename,
                { timeout: 10000 },
            );

            // Close File Manager on Client A
            await closeFileManager(pageA);

            // Close TinyMCE dialog on Client A
            const cancelBtnA = pageA.locator('.tox-dialog .tox-button:has-text("Cancel")');
            if ((await cancelBtnA.count()) > 0) {
                await cancelBtnA.click();
            }

            // Wait for WebSocket sync (asset-renamed message)
            await pageA.waitForTimeout(500);

            // Client B opens File Manager to verify the renamed file
            await openFileManager(pageB);

            // Wait for file to appear in Client B's file manager
            await pageB.waitForFunction(
                () => {
                    const items = document.querySelectorAll(
                        '#modalFileManager .media-library-item:not(.media-library-folder)',
                    );
                    return items.length > 0;
                },
                undefined,
                { timeout: 15000 },
            );

            // Client B selects the file
            await selectFirstFile(pageB);

            // Verify the filename on Client B matches the renamed file
            const filenameSpanB = pageB.locator('#modalFileManager .media-library-filename');
            await expect(filenameSpanB).toBeVisible({ timeout: 5000 });
            const filenameOnB = await filenameSpanB.textContent();

            // The file should have the new name (synced via WebSocket)
            expect(filenameOnB).toContain(newFilename.replace('.jpg', ''));
        });

        test('should sync file rename in File Manager that is already open on Client B', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            // Client A creates a project
            const projectUuid = await createProject(pageA, 'Collaborative FM - Live Rename Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsBridge(pageA);
            await waitForLoadingScreen(pageA);

            // Client A gets share URL and shares project
            const shareUrl = await getShareUrl(pageA);

            // Client B joins the project
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageB);

            // Both clients wait for sync
            await waitForYjsSync(pageA);
            await waitForYjsSync(pageB);

            // Client A opens File Manager and uploads a file
            await openFileManager(pageA);
            await uploadFile(pageA, 'test/fixtures/sample-2.jpg');

            // Wait for asset to sync via WebSocket
            await pageA.waitForTimeout(500);

            // Client B opens File Manager BEFORE the rename happens
            await openFileManager(pageB);

            // Wait for file to appear in Client B's file manager
            await pageB.waitForFunction(
                () => {
                    const items = document.querySelectorAll(
                        '#modalFileManager .media-library-item:not(.media-library-folder)',
                    );
                    return items.length > 0;
                },
                undefined,
                { timeout: 15000 },
            );

            // Client A selects the file and renames it (while Client B has FM open)
            await selectFirstFile(pageA);

            const newFilename = `live-sync-rename-${Date.now()}.jpg`;
            const renameBtn = pageA.locator('#modalFileManager .media-library-rename-btn');
            await renameBtn.click();
            const renameInputA2 = pageA.locator('#modalFileManager .rename-dialog-input');
            await renameInputA2.waitFor({ state: 'visible', timeout: 5000 });
            await renameInputA2.fill(newFilename);
            await pageA.locator('#modalFileManager .rename-dialog-confirm').click();

            // Wait for rename to complete on Client A
            await pageA.waitForFunction(
                (expected: string) => {
                    const span = document.querySelector('#modalFileManager .media-library-filename');
                    return span?.textContent?.includes(expected.replace('.jpg', ''));
                },
                newFilename,
                { timeout: 10000 },
            );

            // Wait for WebSocket sync to propagate to Client B
            // The File Manager should auto-refresh when receiving asset-renamed event
            await pageB.waitForTimeout(500);

            // Client B selects the file to view its current name
            await selectFirstFile(pageB);

            // Verify the filename on Client B has been updated in real-time
            const filenameSpanB = pageB.locator('#modalFileManager .media-library-filename');
            await expect(filenameSpanB).toBeVisible({ timeout: 5000 });
            const filenameOnB = await filenameSpanB.textContent();

            expect(filenameOnB).toContain(newFilename.replace('.jpg', ''));
        });
    });

    test.describe('Real-Time Folder Rename Sync', () => {
        test('should sync folder rename from Client A to Client B', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            // Client A creates a project
            const projectUuid = await createProject(pageA, 'Collaborative FM - Folder Rename Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsBridge(pageA);
            await waitForLoadingScreen(pageA);

            // Share and join
            const shareUrl = await getShareUrl(pageA);
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageA);
            await waitForYjsSync(pageB);

            // Client A opens File Manager and creates a folder
            await openFileManager(pageA);

            const originalFolderName = `SharedFolder_${Date.now()}`;

            const newFolderBtn = pageA.locator('#modalFileManager .media-library-newfolder-btn');
            await newFolderBtn.click();

            await pageA
                .locator('#modalFileManager .media-library-rename-dialog')
                .waitFor({ state: 'visible', timeout: 5000 });
            await pageA.locator('#modalFileManager .rename-dialog-input').fill(originalFolderName);
            await pageA.locator('#modalFileManager .rename-dialog-confirm').click();

            await pageA.waitForSelector(
                `#modalFileManager .media-library-folder[data-folder-name="${originalFolderName}"]`,
                { timeout: 10000 },
            );

            // Upload a file inside the folder
            const folder = pageA.locator(
                `#modalFileManager .media-library-folder[data-folder-name="${originalFolderName}"]`,
            );
            await folder.dblclick();
            await pageA.waitForTimeout(500);

            await uploadFile(pageA, 'test/fixtures/sample-2.jpg');

            // Navigate back to root
            const homeBreadcrumb = pageA.locator('#modalFileManager .breadcrumb-item[data-path=""]');
            await homeBreadcrumb.click();
            await pageA.waitForTimeout(500);

            // Wait for sync
            await pageA.waitForTimeout(500);

            // Client A renames the folder
            const folderToRename = pageA.locator(
                `#modalFileManager .media-library-folder[data-folder-name="${originalFolderName}"]`,
            );
            await folderToRename.click();
            await pageA.waitForTimeout(300);

            const newFolderName = `RenamedFolder_${Date.now()}`;
            const renameBtn = pageA.locator('#modalFileManager .media-library-rename-btn');
            await renameBtn.click();
            const renameFolderInput = pageA.locator('#modalFileManager .rename-dialog-input');
            await renameFolderInput.waitFor({ state: 'visible', timeout: 5000 });
            await renameFolderInput.fill(newFolderName);
            await pageA.locator('#modalFileManager .rename-dialog-confirm').click();

            // Wait for folder rename on Client A
            await pageA.waitForSelector(
                `#modalFileManager .media-library-folder[data-folder-name="${newFolderName}"]`,
                {
                    timeout: 10000,
                },
            );

            // Close File Manager on Client A
            await closeFileManager(pageA);
            const cancelBtnA = pageA.locator('.tox-dialog .tox-button:has-text("Cancel")');
            if ((await cancelBtnA.count()) > 0) {
                await cancelBtnA.click();
            }

            // Wait for WebSocket sync
            await pageA.waitForTimeout(500);

            // Client B opens File Manager and verifies the renamed folder
            await openFileManager(pageB);

            // Verify the folder has the new name on Client B
            const renamedFolderOnB = pageB.locator(
                `#modalFileManager .media-library-folder[data-folder-name="${newFolderName}"]`,
            );
            await expect(renamedFolderOnB).toBeVisible({ timeout: 15000 });

            // Verify old folder name doesn't exist
            const oldFolderOnB = pageB.locator(
                `#modalFileManager .media-library-folder[data-folder-name="${originalFolderName}"]`,
            );
            await expect(oldFolderOnB).toHaveCount(0);

            // Verify file is still inside the renamed folder
            await renamedFolderOnB.dblclick();
            await pageB.waitForTimeout(500);

            const fileCount = await getFileCount(pageB);
            expect(fileCount).toBe(1);
        });
    });

    test.describe('Asset Visibility Sync', () => {
        test('should show assets uploaded by Client A in Client B File Manager', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            // Client A creates a project
            const projectUuid = await createProject(pageA, 'Collaborative FM - Asset Visibility Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsBridge(pageA);
            await waitForLoadingScreen(pageA);

            // Client A opens File Manager and uploads files
            await openFileManager(pageA);
            await uploadFile(pageA, 'test/fixtures/sample-2.jpg');

            // Wait for upload to complete and verify file count on Client A
            const initialCountA = await getFileCount(pageA);
            expect(initialCountA).toBe(1);

            // Get the filename on Client A
            await selectFirstFile(pageA);
            const filenameA = await pageA.locator('#modalFileManager .media-library-filename').textContent();

            // Close File Manager on Client A
            await closeFileManager(pageA);
            const cancelBtnA = pageA.locator('.tox-dialog .tox-button:has-text("Cancel")');
            if ((await cancelBtnA.count()) > 0) {
                await cancelBtnA.click();
            }

            // Close the text iDevice (exit edit mode) - required before share button works
            const textIdevice = pageA.locator('#node-content article .idevice_node.text').first();
            const saveIdeviceBtn = textIdevice.locator('.btn-save-idevice');
            if (await saveIdeviceBtn.isVisible()) {
                await saveIdeviceBtn.click();
                await pageA.waitForFunction(
                    () => {
                        const idevice = document.querySelector('#node-content article .idevice_node.text');
                        return idevice && idevice.getAttribute('mode') !== 'edition';
                    },
                    undefined,
                    { timeout: 10000 },
                );
            }

            // Wait for asset to sync to server
            await pageA.waitForTimeout(500);

            // Client A gets share URL
            const shareUrl = await getShareUrl(pageA);

            // Client B joins the project
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageB);

            // Client B waits for WebSocket to sync asset metadata from server
            await pageB.waitForTimeout(500);

            // Client B opens File Manager
            await openFileManager(pageB);

            // Wait for file to appear in Client B's file manager
            await pageB.waitForFunction(
                () => {
                    const items = document.querySelectorAll(
                        '#modalFileManager .media-library-item:not(.media-library-folder)',
                    );
                    return items.length > 0;
                },
                undefined,
                { timeout: 15000 },
            );

            // Verify Client B sees the same asset
            const countB = await getFileCount(pageB);
            expect(countB).toBe(1);

            // Verify the filename matches
            await selectFirstFile(pageB);
            const filenameB = await pageB.locator('#modalFileManager .media-library-filename').textContent();
            expect(filenameB).toBe(filenameA);
        });

        test('should show assets in folder when Client B opens File Manager', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            // Client A creates a project
            const projectUuid = await createProject(pageA, 'Collaborative FM - Folder Asset Visibility');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsBridge(pageA);
            await waitForLoadingScreen(pageA);

            // Client A opens File Manager and creates a folder
            await openFileManager(pageA);

            const folderName = `SharedAssets_${Date.now()}`;

            // Create folder
            const newFolderBtn = pageA.locator('#modalFileManager .media-library-newfolder-btn');
            await newFolderBtn.click();

            await pageA
                .locator('#modalFileManager .media-library-rename-dialog')
                .waitFor({ state: 'visible', timeout: 5000 });
            await pageA.locator('#modalFileManager .rename-dialog-input').fill(folderName);
            await pageA.locator('#modalFileManager .rename-dialog-confirm').click();

            await pageA.waitForSelector(`#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`, {
                timeout: 10000,
            });

            // Navigate into folder and upload file
            const folder = pageA.locator(`#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`);
            await folder.dblclick();
            await pageA.waitForTimeout(500);

            await uploadFile(pageA, 'test/fixtures/sample-2.jpg');

            // Wait for upload
            const countInFolder = await getFileCount(pageA);
            expect(countInFolder).toBe(1);

            // Close File Manager on Client A
            await closeFileManager(pageA);
            const cancelBtnA = pageA.locator('.tox-dialog .tox-button:has-text("Cancel")');
            if ((await cancelBtnA.count()) > 0) {
                await cancelBtnA.click();
            }

            // Close the text iDevice (exit edit mode) - required before share button works
            const textIdeviceA = pageA.locator('#node-content article .idevice_node.text').first();
            const saveIdeviceBtnA = textIdeviceA.locator('.btn-save-idevice');
            if (await saveIdeviceBtnA.isVisible()) {
                await saveIdeviceBtnA.click();
                await pageA.waitForFunction(
                    () => {
                        const idevice = document.querySelector('#node-content article .idevice_node.text');
                        return idevice && idevice.getAttribute('mode') !== 'edition';
                    },
                    undefined,
                    { timeout: 10000 },
                );
            }

            // Wait for sync to server
            await pageA.waitForTimeout(500);

            // Client A shares and Client B joins
            const shareUrl = await getShareUrl(pageA);
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageB);

            // Wait for metadata sync
            await pageB.waitForTimeout(500);

            // Client B opens File Manager
            await openFileManager(pageB);

            // Verify folder exists on Client B
            const folderOnB = pageB.locator(
                `#modalFileManager .media-library-folder[data-folder-name="${folderName}"]`,
            );
            await expect(folderOnB).toBeVisible({ timeout: 15000 });

            // Navigate into folder on Client B
            await folderOnB.dblclick();
            await pageB.waitForTimeout(500);

            // Verify file is inside the folder
            await pageB.waitForFunction(
                () => {
                    const items = document.querySelectorAll(
                        '#modalFileManager .media-library-item:not(.media-library-folder)',
                    );
                    return items.length > 0;
                },
                undefined,
                { timeout: 15000 },
            );

            const countInFolderOnB = await getFileCount(pageB);
            expect(countInFolderOnB).toBe(1);
        });

        test('should sync asset metadata from Client A to Client B via Yjs', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // This test verifies that when Client A uploads an image,
            // the asset metadata syncs to Client B via Yjs so the item appears
            // in Client B's File Manager (even before P2P blob transfer completes)
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            // Client A creates a project
            const projectUuid = await createProject(pageA, 'Live Asset Upload Sync Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsBridge(pageA);
            await waitForLoadingScreen(pageA);

            // Share project BEFORE both open File Manager
            const shareUrl = await getShareUrl(pageA);

            // Client B joins
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageB);
            await waitForYjsSync(pageA);

            // Both clients open File Manager simultaneously
            await openFileManager(pageA);
            await openFileManager(pageB);

            // Client A uploads an image
            const fileInput = pageA.locator('#modalFileManager .media-library-upload-input');
            await fileInput.setInputFiles('test/fixtures/sample-2.jpg');

            // Wait for upload to complete on Client A
            const imageItemOnA = pageA
                .locator('#modalFileManager .media-library-item:not(.media-library-folder)')
                .first();
            await expect(imageItemOnA).toBeVisible({ timeout: 15000 });

            // Get the asset ID from Client A's uploaded item
            const assetId = await imageItemOnA.getAttribute('data-asset-id');
            expect(assetId).toBeTruthy();

            // CRITICAL TEST: Client B should see the asset item appear via Yjs metadata sync
            // This verifies the core sync mechanism works
            const imageItemOnB = pageB.locator(`#modalFileManager .media-library-item[data-asset-id="${assetId}"]`);
            await expect(imageItemOnB).toBeVisible({ timeout: 30000 });

            // Verify the item has an image element (either with blob: or data: placeholder)
            const imgOnB = imageItemOnB.locator('img');
            await expect(imgOnB).toBeVisible({ timeout: 5000 });

            // Verify the asset ID is correct
            const itemAssetId = await imageItemOnB.getAttribute('data-asset-id');
            expect(itemAssetId).toBe(assetId);

            // Verify the image has some src (either blob: for loaded, or data: for loading)
            const imgSrc = await imgOnB.getAttribute('src');
            expect(imgSrc).toBeTruthy();
            expect(imgSrc!.startsWith('blob:') || imgSrc!.startsWith('data:')).toBe(true);

            // Optional: Try to wait for blob: URL with shorter timeout (P2P transfer)
            // This is best-effort - P2P can be slow depending on server/network
            try {
                await pageB.waitForFunction(
                    (aid: string) => {
                        const item = document.querySelector(
                            `#modalFileManager .media-library-item[data-asset-id="${aid}"]`,
                        );
                        const img = item?.querySelector('img') as HTMLImageElement | null;
                        const src = img?.getAttribute('src') || '';
                        return src.startsWith('blob:');
                    },
                    assetId!,
                    { timeout: 15000 },
                );
                // P2P completed - verify blob URL is valid
                const blobSrc = await imgOnB.getAttribute('src');
                expect(blobSrc).toMatch(/^blob:/);
            } catch {
                // P2P didn't complete in time, but metadata sync worked
                // which is the critical functionality being tested
                console.log('[Test] P2P blob transfer did not complete in 15s, but metadata sync verified');
            }
        });

        test('should show assets to guest user on public document (cross-browser/user sync)', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // This test verifies that assets are synced between DIFFERENT users/browsers
            // (not just tabs of the same user) via WebSocket asset forwarding
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage; // Guest user in separate browser context

            // Client A (authenticated user) creates a project
            const projectUuid = await createProject(pageA, 'Cross-User Asset Sync Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsBridge(pageA);
            await waitForLoadingScreen(pageA);

            // Client A opens File Manager and uploads a file
            await openFileManager(pageA);
            await uploadFile(pageA, 'test/fixtures/sample-2.jpg');

            // Wait for upload to complete and get filename
            const initialCountA = await getFileCount(pageA);
            expect(initialCountA).toBe(1);

            await selectFirstFile(pageA);
            const filenameA = await pageA.locator('#modalFileManager .media-library-filename').textContent();
            expect(filenameA).toContain('sample-2');

            // Close File Manager on Client A
            await closeFileManager(pageA);
            const cancelBtnA = pageA.locator('.tox-dialog .tox-button:has-text("Cancel")');
            if ((await cancelBtnA.count()) > 0) {
                await cancelBtnA.click();
            }

            // Close the text iDevice (exit edit mode) - required before share button works
            const textIdevice = pageA.locator('#node-content article .idevice_node.text').first();
            const saveIdeviceBtn = textIdevice.locator('.btn-save-idevice');
            if (await saveIdeviceBtn.isVisible()) {
                await saveIdeviceBtn.click();
                await pageA.waitForFunction(
                    () => {
                        const idevice = document.querySelector('#node-content article .idevice_node.text');
                        return idevice && idevice.getAttribute('mode') !== 'edition';
                    },
                    undefined,
                    { timeout: 10000 },
                );
            }

            // Wait for asset to sync to server
            await pageA.waitForTimeout(500);

            // Client A makes project public and gets share URL
            const shareUrl = await getShareUrl(pageA);

            // Client B (guest user in separate browser context) joins via share URL
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageB);

            // Wait for WebSocket to sync asset metadata
            await pageB.waitForTimeout(500);

            // Client B opens File Manager
            await openFileManager(pageB);

            // Wait for file to appear in Client B's file manager
            await pageB.waitForFunction(
                () => {
                    const items = document.querySelectorAll(
                        '#modalFileManager .media-library-item:not(.media-library-folder)',
                    );
                    return items.length > 0;
                },
                undefined,
                { timeout: 20000 },
            );

            // Verify Client B (guest user) sees the same asset uploaded by Client A
            const countB = await getFileCount(pageB);
            expect(countB).toBe(1);

            // Verify filename matches
            await selectFirstFile(pageB);
            const filenameB = await pageB.locator('#modalFileManager .media-library-filename').textContent();
            expect(filenameB).toBe(filenameA);
        });
    });
});
