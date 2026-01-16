/**
 * File Manager Helpers for E2E Tests
 *
 * Helpers for file manager (media library) operations:
 * - Opening/closing file manager
 * - Uploading files
 * - Managing folders
 * - Selecting and inserting files
 *
 * @example
 * ```typescript
 * import { openFileManager, uploadFileToManager, selectFileInManager } from '../helpers/file-manager-helpers';
 *
 * test('my test', async ({ page }) => {
 *     await openFileManager(page);
 *     await uploadFileToManager(page, '/path/to/file.pdf');
 *     await selectFileInManager(page, 'file.pdf');
 * });
 * ```
 */

import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════════
// FILE MANAGER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Open file manager modal
 *
 * @param page - Playwright page
 */
export async function openFileManager(page: Page): Promise<void> {
    // Click the file manager button in the toolbar
    const fileManagerBtn = page.locator(
        '#navbar-button-filemanager, [aria-label*="File Manager"], [aria-label*="Gestor de archivos"], [title*="File manager"]',
    );
    await fileManagerBtn.first().click();

    // Wait for modal to appear
    await page.locator('#modalFileManager[data-open="true"], #modalFileManager.show').waitFor({
        state: 'visible',
        timeout: 10000,
    });
}

/**
 * Close file manager modal
 *
 * @param page - Playwright page
 */
export async function closeFileManager(page: Page): Promise<void> {
    const modal = page.locator('#modalFileManager');

    if (await modal.isVisible()) {
        const closeBtn = modal.locator('button[data-bs-dismiss="modal"], .btn-close, .close').first();
        await closeBtn.click();
        await modal.waitFor({ state: 'hidden', timeout: 5000 });
    }
}

/**
 * Check if file manager is open
 *
 * @param page - Playwright page
 * @returns true if file manager modal is visible
 */
export async function isFileManagerOpen(page: Page): Promise<boolean> {
    return await page.locator('#modalFileManager').isVisible();
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Upload a file to the file manager
 *
 * @param page - Playwright page
 * @param filePath - Path to the file to upload
 */
export async function uploadFileToManager(page: Page, filePath: string): Promise<void> {
    // Ensure file manager is open
    const modal = page.locator('#modalFileManager');
    if (!(await modal.isVisible())) {
        await openFileManager(page);
    }

    // Find the upload input (hidden file input)
    const fileInput = modal.locator('.media-library-upload-input, input[type="file"]').first();
    await fileInput.setInputFiles(filePath);

    // Wait for upload to complete
    await page.waitForTimeout(2000);

    // Wait for the file to appear in the list
    await modal.locator('.media-library-item').first().waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Select a file in file manager by name
 *
 * @param page - Playwright page
 * @param fileName - Name of the file to select
 */
export async function selectFileInManager(page: Page, fileName: string): Promise<void> {
    const modal = page.locator('#modalFileManager');

    // Find the file item by name
    const fileItem = modal.locator('.media-library-item', { hasText: fileName }).first();
    await fileItem.waitFor({ state: 'visible', timeout: 5000 });
    await fileItem.click();

    await page.waitForTimeout(300);
}

/**
 * Delete selected file/folder in file manager
 *
 * @param page - Playwright page
 */
export async function deleteFileInManager(page: Page): Promise<void> {
    const modal = page.locator('#modalFileManager');

    // Click delete button
    const deleteBtn = modal.locator(
        '.media-library-delete-btn, [data-action="delete"], button:has-text("Delete"), button:has-text("Eliminar")',
    );
    await deleteBtn.first().click();

    // Handle confirmation dialog if present
    try {
        const confirmBtn = page.locator('.modal.show .btn-danger, .modal.show .btn-primary').first();
        await confirmBtn.waitFor({ state: 'visible', timeout: 2000 });
        await confirmBtn.click();
    } catch {
        // No confirmation needed
    }

    await page.waitForTimeout(500);
}

/**
 * Rename selected file/folder in file manager
 *
 * @param page - Playwright page
 * @param newName - New name for the file/folder
 */
export async function renameFileInManager(page: Page, newName: string): Promise<void> {
    const modal = page.locator('#modalFileManager');

    // Click rename button
    const renameBtn = modal.locator(
        '.media-library-rename-btn, [data-action="rename"], button:has-text("Rename"), button:has-text("Renombrar")',
    );
    await renameBtn.first().click();

    // Wait for rename input to appear
    const renameInput = modal.locator('input[name="rename"], .media-library-rename-input').first();
    await renameInput.waitFor({ state: 'visible', timeout: 5000 });

    // Clear and type new name
    await renameInput.fill(newName);

    // Confirm rename
    const confirmBtn = modal.locator(
        '.media-library-rename-confirm, button:has-text("OK"), button:has-text("Confirm")',
    );
    await confirmBtn.first().click();

    await page.waitForTimeout(500);
}

/**
 * Insert selected file into TinyMCE editor
 *
 * @param page - Playwright page
 */
export async function insertFileFromManager(page: Page): Promise<void> {
    const modal = page.locator('#modalFileManager');

    // Click insert button
    const insertBtn = modal.locator(
        '.media-library-insert-btn, [data-action="insert"], button:has-text("Insert"), button:has-text("Insertar")',
    );
    await insertBtn.first().click();

    // Wait for modal to close
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOLDER OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a folder in file manager
 *
 * @param page - Playwright page
 * @param folderName - Name of the folder to create
 */
export async function createFolder(page: Page, folderName: string): Promise<void> {
    const modal = page.locator('#modalFileManager');

    // Click create folder button
    const createFolderBtn = modal.locator(
        '.media-library-create-folder-btn, [data-action="create-folder"], button:has-text("New folder"), button:has-text("Nueva carpeta")',
    );
    await createFolderBtn.first().click();

    // Wait for folder name input
    const folderInput = modal.locator('input[name="folder-name"], .media-library-folder-input').first();
    await folderInput.waitFor({ state: 'visible', timeout: 5000 });

    // Type folder name
    await folderInput.fill(folderName);

    // Confirm creation
    const confirmBtn = modal.locator(
        '.media-library-folder-confirm, button:has-text("Create"), button:has-text("Crear"), button:has-text("OK")',
    );
    await confirmBtn.first().click();

    await page.waitForTimeout(500);
}

/**
 * Navigate to folder in file manager
 *
 * @param page - Playwright page
 * @param folderPath - Path to the folder (can be nested like "folder1/folder2")
 */
export async function navigateToFolder(page: Page, folderPath: string): Promise<void> {
    const modal = page.locator('#modalFileManager');
    const folders = folderPath.split('/');

    for (const folderName of folders) {
        // Double-click to enter folder
        const folderItem = modal.locator('.media-library-item.folder, .media-library-item[data-type="folder"]', {
            hasText: folderName,
        });
        await folderItem.first().dblclick();
        await page.waitForTimeout(500);
    }
}

/**
 * Navigate to parent folder in file manager
 *
 * @param page - Playwright page
 */
export async function navigateToParentFolder(page: Page): Promise<void> {
    const modal = page.locator('#modalFileManager');

    // Click parent folder button or ".." item
    const parentBtn = modal.locator('.media-library-parent-btn, .media-library-item:has-text("..")');
    await parentBtn.first().click();

    await page.waitForTimeout(500);
}

/**
 * Get list of files in current folder
 *
 * @param page - Playwright page
 * @returns Array of file names
 */
export async function getFilesInManager(page: Page): Promise<string[]> {
    const modal = page.locator('#modalFileManager');
    const items = modal.locator('.media-library-item');
    const count = await items.count();

    const files: string[] = [];
    for (let i = 0; i < count; i++) {
        const name = await items.nth(i).locator('.media-library-item-name, .item-name').textContent();
        if (name) {
            files.push(name.trim());
        }
    }

    return files;
}

/**
 * Check if a file exists in file manager
 *
 * @param page - Playwright page
 * @param fileName - Name of the file to check
 * @returns true if file exists
 */
export async function fileExistsInManager(page: Page, fileName: string): Promise<boolean> {
    const modal = page.locator('#modalFileManager');
    const fileItem = modal.locator('.media-library-item', { hasText: fileName }).first();

    return (await fileItem.count()) > 0;
}
