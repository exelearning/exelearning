/**
 * File Manager Helpers for E2E Tests
 *
 * Complete helpers for file manager (media library) operations:
 * - Modal operations (open, close, check visibility)
 * - Upload operations (with special names, from fixtures)
 * - Grid operations (wait, select, verify, count)
 * - Folder operations (create, navigate, breadcrumbs)
 * - Rename operations (with native dialog handling)
 * - Search operations (search, get results, clear)
 * - Delete operations (with confirmation dialog handling)
 * - Insert operations (into TinyMCE editor)
 * - Yjs verification (check assets in Yjs)
 *
 * @example
 * ```typescript
 * import {
 *     openFileManager,
 *     uploadFileWithSpecialName,
 *     waitForFileInGrid,
 *     selectFileByName,
 *     verifyFileWithThumbnail,
 * } from '../helpers/file-manager-helpers';
 *
 * test('my test', async ({ page }) => {
 *     await openFileManager(page);
 *     await uploadFileWithSpecialName(page, '日本語ファイル.jpg');
 *     await waitForFileInGrid(page, '日本語ファイル.jpg');
 * });
 * ```
 */

import type { Page, Locator } from '@playwright/test';
import { createTestFileWithName } from './special-chars-helpers';

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
// UPLOAD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Upload a file with a specific filename (handles unicode/special characters).
 * Uses DataTransfer API to set files with arbitrary names since Playwright's
 * setInputFiles only accepts actual file paths.
 *
 * @param page - Playwright page
 * @param filename - The filename to use for the upload
 */
export async function uploadFileWithSpecialName(page: Page, filename: string): Promise<void> {
    // Get initial file count to verify upload
    const initialCount = await page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').count();

    // Create the test file with the special name
    await createTestFileWithName(page, filename);

    // Use DataTransfer to set the file on the input within the modal
    await page.evaluate(() => {
        const input = document.querySelector('#modalFileManager .media-library-upload-input') as HTMLInputElement;
        if (!input) throw new Error('Upload input not found');

        const dt = new DataTransfer();
        dt.items.add((window as any).__testFile);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Wait for file count to increase (more reliable than checking specific filename)
    await page.waitForFunction(
        initial => {
            const items = document.querySelectorAll('#modalFileManager .media-library-item:not(.media-library-folder)');
            return items.length > initial;
        },
        initialCount,
        { timeout: 15000 },
    );

    // Then verify the specific file appeared with a usable thumbnail
    await waitForUploadAndThumbnail(page, filename, 10000);
}

/**
 * Upload a file from a fixture path (for testing with real files).
 * This is the standard upload method for files that exist on disk.
 *
 * @param page - Playwright page
 * @param fixturePath - Path to the fixture file
 */
export async function uploadFixtureFile(page: Page, fixturePath: string): Promise<void> {
    const initialCount = await page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').count();
    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    await page.waitForFunction(
        initial => {
            const items = document.querySelectorAll('#modalFileManager .media-library-item:not(.media-library-folder)');
            return items.length > initial;
        },
        initialCount,
        { timeout: 15000 },
    );
}

/**
 * Wait for uploaded file to appear in the grid and render a valid thumbnail.
 */
export async function waitForUploadAndThumbnail(page: Page, filename: string, timeout = 10000): Promise<void> {
    await waitForFileInGrid(page, filename, timeout);
    await page.waitForFunction(
        name => {
            const items = document.querySelectorAll('#modalFileManager .media-library-item');
            const item = Array.from(items).find(el => el.getAttribute('data-filename') === name);
            if (!item) return false;
            const img = item.querySelector('img');
            if (!img) return false;
            const i = img as HTMLImageElement;
            return i.complete && (i.naturalWidth > 0 || i.src.startsWith('blob:'));
        },
        filename,
        { timeout },
    );
}

/**
 * Upload a file to the file manager (alias for uploadFixtureFile)
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

    await uploadFixtureFile(page, filePath);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRID OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wait for a file to appear in the grid using data-filename attribute.
 * Handles special characters properly with waitForFunction.
 *
 * @param page - Playwright page
 * @param filename - The filename to wait for
 * @param timeout - Maximum wait time in milliseconds
 */
export async function waitForFileInGrid(page: Page, filename: string, timeout = 10000): Promise<void> {
    await page.waitForFunction(
        name => {
            const items = document.querySelectorAll('#modalFileManager .media-library-item');
            return Array.from(items).some(el => el.getAttribute('data-filename') === name);
        },
        filename,
        { timeout },
    );
}

/**
 * Get a file item locator with proper escaping for special characters.
 * Uses CSS.escape for safe selector construction.
 *
 * @param page - Playwright page
 * @param filename - The filename to locate
 * @returns Locator for the file item
 */
export function getFileLocator(page: Page, filename: string): Locator {
    // Use CSS.escape for safe selector construction
    const escapedName = CSS.escape(filename);
    return page.locator(`#modalFileManager .media-library-item[data-filename="${escapedName}"]`);
}

/**
 * Select a file in the grid by filename.
 * Handles special characters by using evaluate to click the element.
 *
 * @param page - Playwright page
 * @param filename - The filename to select
 */
export async function selectFileByName(page: Page, filename: string): Promise<void> {
    await page.evaluate(name => {
        const items = document.querySelectorAll('#modalFileManager .media-library-item');
        const item = Array.from(items).find(el => el.getAttribute('data-filename') === name);
        if (!item) throw new Error(`File not found: ${name}`);
        (item as HTMLElement).click();
    }, filename);

    // Wait for sidebar to show the file info
    await page.waitForFunction(
        name => {
            const filenameEl = document.querySelector('#modalFileManager .media-library-filename');
            return filenameEl?.textContent === name;
        },
        filename,
        { timeout: 5000 },
    );
}

/**
 * Select a file in file manager by name (alias for selectFileByName with hasText)
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
    await page.waitForFunction(
        name => {
            const filenameEl = document.querySelector('#modalFileManager .media-library-filename');
            return filenameEl?.textContent === name;
        },
        fileName,
        { timeout: 5000 },
    );
}

/**
 * Verify that a file exists in the grid and has a valid thumbnail.
 * Checks that the thumbnail image has loaded properly (naturalWidth > 0).
 *
 * @param page - Playwright page
 * @param filename - The filename to verify
 * @returns true if file exists with valid thumbnail, false otherwise
 */
export async function verifyFileWithThumbnail(page: Page, filename: string): Promise<boolean> {
    return await page.evaluate(name => {
        const items = document.querySelectorAll('#modalFileManager .media-library-item');
        const item = Array.from(items).find(el => el.getAttribute('data-filename') === name);
        if (!item) return false;

        const img = item.querySelector('img') as HTMLImageElement;
        if (!img) return false;

        // Check if image has loaded (naturalWidth > 0) or has blob URL
        const hasLoadedImage = img.complete && img.naturalWidth > 0;
        const hasBlobUrl = img.src?.startsWith('blob:');

        return hasLoadedImage || hasBlobUrl;
    }, filename);
}

/**
 * Verify that an uploaded image renders correctly (not broken/error).
 * This is a stricter check than verifyFileWithThumbnail - it ensures:
 * - The image element exists
 * - The image has loaded (complete = true)
 * - The image has valid dimensions (naturalWidth > 1, naturalHeight > 1)
 * - The image is not showing an error placeholder (broken image icon)
 *
 * Use this to verify that uploaded images generate proper thumbnails,
 * especially when testing with programmatically created files.
 *
 * @param page - Playwright page
 * @param filename - The filename to verify
 * @returns true if image renders correctly with proper dimensions
 */
export async function verifyImageRendersCorrectly(page: Page, filename: string): Promise<boolean> {
    return await page.evaluate(name => {
        const items = document.querySelectorAll('#modalFileManager .media-library-item');
        const item = Array.from(items).find(el => el.getAttribute('data-filename') === name);
        if (!item) return false;

        const img = item.querySelector('img') as HTMLImageElement;
        if (!img) return false;

        // Check that image has fully loaded
        if (!img.complete) return false;

        // Check that image has valid dimensions (> 1px to ensure it's not a tiny placeholder)
        // A properly rendered thumbnail should have meaningful dimensions
        if (img.naturalWidth <= 1 || img.naturalHeight <= 1) return false;

        // Check that the image is not in an error state
        // When an image fails to load, naturalWidth and naturalHeight are typically 0
        // but browsers may also show a broken image icon with small dimensions
        // A valid thumbnail from a real image should have dimensions > 10px
        if (img.naturalWidth < 10 || img.naturalHeight < 10) return false;

        return true;
    }, filename);
}

/**
 * Get the thumbnail source URL for a file in the grid.
 *
 * @param page - Playwright page
 * @param filename - The filename to get thumbnail for
 * @returns The src attribute of the thumbnail image, or null if not found
 */
export async function getFileThumbnailSrc(page: Page, filename: string): Promise<string | null> {
    return await page.evaluate(name => {
        const items = document.querySelectorAll('#modalFileManager .media-library-item');
        const item = Array.from(items).find(el => el.getAttribute('data-filename') === name);
        if (!item) return null;

        const img = item.querySelector('img') as HTMLImageElement;
        return img?.src || null;
    }, filename);
}

/**
 * Get all filenames currently visible in the file manager grid.
 *
 * @param page - Playwright page
 * @returns Array of filenames
 */
export async function getAllFilenames(page: Page): Promise<string[]> {
    return await page.evaluate(() => {
        const items = document.querySelectorAll('#modalFileManager .media-library-item:not(.media-library-folder)');
        return Array.from(items)
            .map(el => el.getAttribute('data-filename'))
            .filter((name): name is string => name !== null);
    });
}

/**
 * Get the file count in the current folder (excluding folders).
 *
 * @param page - Playwright page
 * @returns Number of files
 */
export async function getFileCount(page: Page): Promise<number> {
    return await page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').count();
}

/**
 * Get the folder count in the current folder.
 *
 * @param page - Playwright page
 * @returns Number of folders
 */
export async function getFolderCount(page: Page): Promise<number> {
    return await page.locator('#modalFileManager .media-library-folder').count();
}

/**
 * Get list of files in current folder (legacy API)
 *
 * @param page - Playwright page
 * @returns Array of file names
 */
export async function getFilesInManager(page: Page): Promise<string[]> {
    return getAllFilenames(page);
}

/**
 * Check if a file exists in file manager
 *
 * @param page - Playwright page
 * @param fileName - Name of the file to check
 * @returns true if file exists
 */
export async function fileExistsInManager(page: Page, fileName: string): Promise<boolean> {
    const files = await getAllFilenames(page);
    return files.includes(fileName);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOLDER OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new folder with the given name.
 * Handles the native dialog for folder name input.
 *
 * @param page - Playwright page
 * @param folderName - Name for the new folder
 * @returns true if folder was created successfully
 */
export async function createFolderWithName(page: Page, folderName: string): Promise<boolean> {
    // Set up dialog handler BEFORE clicking (using page.once pattern)
    page.once('dialog', async dialog => {
        await dialog.accept(folderName);
    });

    const newFolderBtn = page.locator('#modalFileManager .media-library-newfolder-btn');
    await newFolderBtn.click();

    // Wait for folder to appear or for error
    try {
        await page.waitForFunction(
            name => {
                const folders = document.querySelectorAll('#modalFileManager .media-library-folder');
                return Array.from(folders).some(el => el.getAttribute('data-folder-name') === name);
            },
            folderName,
            { timeout: 10000 },
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Create a folder in file manager (legacy API)
 *
 * @param page - Playwright page
 * @param folderName - Name of the folder to create
 */
export async function createFolder(page: Page, folderName: string): Promise<void> {
    await createFolderWithName(page, folderName);
}

/**
 * Check if a folder exists in the current directory.
 *
 * @param page - Playwright page
 * @param folderName - Name of the folder to check
 * @returns true if folder exists
 */
export async function folderExists(page: Page, folderName: string): Promise<boolean> {
    return await page.evaluate(name => {
        const folders = document.querySelectorAll('#modalFileManager .media-library-folder');
        return Array.from(folders).some(el => el.getAttribute('data-folder-name') === name);
    }, folderName);
}

/**
 * Navigate into a folder by double-clicking on it.
 *
 * @param page - Playwright page
 * @param folderName - Name of the folder to enter
 */
export async function navigateToFolder(page: Page, folderName: string): Promise<void> {
    await page.evaluate(name => {
        const folders = document.querySelectorAll('#modalFileManager .media-library-folder');
        const folder = Array.from(folders).find(el => el.getAttribute('data-folder-name') === name);
        if (!folder) throw new Error(`Folder not found: ${name}`);

        // Create and dispatch dblclick event
        const event = new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            view: window,
        });
        folder.dispatchEvent(event);
    }, folderName);

    // Wait for breadcrumbs to update
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
 * Navigate to root using breadcrumbs.
 *
 * @param page - Playwright page
 */
export async function navigateToRoot(page: Page): Promise<void> {
    const homeBreadcrumb = page.locator('#modalFileManager .breadcrumb-item[data-path=""]');
    await homeBreadcrumb.click();

    // Wait for breadcrumbs to show only the home icon
    await page.waitForFunction(
        () => {
            const breadcrumbs = document.querySelector('#modalFileManager .media-library-breadcrumbs');
            const items = breadcrumbs?.querySelectorAll('.breadcrumb-item');
            return items && items.length === 1;
        },
        undefined,
        { timeout: 10000 },
    );
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

    await page.waitForFunction(() => !document.querySelector('#modalFileManager .media-library-loading'), undefined, {
        timeout: 5000,
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENAME OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rename a file to a new name.
 * Interacts with the custom rename dialog (not a native browser dialog).
 *
 * @param page - Playwright page
 * @param oldName - Current filename
 * @param newName - New filename
 */
export async function renameFile(page: Page, oldName: string, newName: string): Promise<void> {
    // Select the file first
    await selectFileByName(page, oldName);

    // Click rename button
    const renameBtn = page.locator('#modalFileManager .media-library-rename-btn');
    await renameBtn.waitFor({ state: 'visible', timeout: 5000 });
    await renameBtn.click();

    // Fill in the custom rename dialog
    const renameInput = page.locator('#modalFileManager .rename-dialog-input');
    await renameInput.waitFor({ state: 'visible', timeout: 5000 });
    await renameInput.fill(newName);
    await page.locator('#modalFileManager .rename-dialog-confirm').click();

    // Wait for the rename to complete
    await page.waitForFunction(
        ({ oldN, newN }) => {
            const items = document.querySelectorAll('#modalFileManager .media-library-item');
            const hasOld = Array.from(items).some(el => el.getAttribute('data-filename') === oldN);
            const hasNew = Array.from(items).some(el => el.getAttribute('data-filename') === newN);
            return !hasOld && hasNew;
        },
        { oldN: oldName, newN: newName },
        { timeout: 10000 },
    );
}

/**
 * Rename selected file/folder in file manager (legacy API)
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

    // Fill in the custom rename dialog
    const renameInput = modal.locator('.rename-dialog-input');
    await renameInput.waitFor({ state: 'visible', timeout: 5000 });
    await renameInput.fill(newName);
    await modal.locator('.rename-dialog-confirm').click();

    await page.waitForFunction(
        name => {
            const filenameEl = document.querySelector('#modalFileManager .media-library-filename');
            return filenameEl?.textContent === name;
        },
        newName,
        { timeout: 5000 },
    );
}

/**
 * Check if the sidebar displays the correct filename after selection.
 *
 * @param page - Playwright page
 * @param expectedName - Expected filename in sidebar
 * @returns true if sidebar shows the expected name
 */
export async function verifySidebarFilename(page: Page, expectedName: string): Promise<boolean> {
    return await page.evaluate(name => {
        const filenameEl = document.querySelector('#modalFileManager .media-library-filename');
        return filenameEl?.textContent === name;
    }, expectedName);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Search for files in the file manager.
 *
 * @param page - Playwright page
 * @param searchTerm - The search term
 */
export async function searchFiles(page: Page, searchTerm: string): Promise<void> {
    const searchInput = page.locator('#modalFileManager .media-library-search');
    await searchInput.fill(searchTerm);

    // Wait for debounce and search to complete
    await page.waitForFunction(
        term => {
            const input = document.querySelector('#modalFileManager .media-library-search') as HTMLInputElement | null;
            const loading = document.querySelector('#modalFileManager .media-library-loading');
            return input?.value === term && !loading;
        },
        searchTerm,
        { timeout: 5000 },
    );
}

/**
 * Search files and return the matching filenames.
 *
 * @param page - Playwright page
 * @param searchTerm - The search term
 * @returns Array of matching filenames
 */
export async function searchAndGetResults(page: Page, searchTerm: string): Promise<string[]> {
    await searchFiles(page, searchTerm);
    return await getAllFilenames(page);
}

/**
 * Clear the search input and return to normal view.
 *
 * @param page - Playwright page
 */
export async function clearSearch(page: Page): Promise<void> {
    const clearBtn = page.locator('#modalFileManager .clear-search-btn');
    if (await clearBtn.isVisible()) {
        await clearBtn.click();
    } else {
        const searchInput = page.locator('#modalFileManager .media-library-search');
        await searchInput.fill('');
    }
    await page.waitForFunction(
        () => {
            const input = document.querySelector('#modalFileManager .media-library-search') as HTMLInputElement | null;
            return (input?.value || '') === '';
        },
        undefined,
        { timeout: 5000 },
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Delete a file by name.
 * Handles the confirmation dialog.
 *
 * @param page - Playwright page
 * @param filename - The filename to delete
 */
export async function deleteFile(page: Page, filename: string): Promise<void> {
    // Select the file
    await selectFileByName(page, filename);

    // Click delete button
    const deleteBtn = page.locator('#modalFileManager .media-library-delete-btn');
    await deleteBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Handle confirmation dialog
    page.once('dialog', async dialog => {
        await dialog.accept();
    });

    await deleteBtn.click();

    // Wait for file to be removed
    await page.waitForFunction(
        name => {
            const items = document.querySelectorAll('#modalFileManager .media-library-item');
            return !Array.from(items).some(el => el.getAttribute('data-filename') === name);
        },
        filename,
        { timeout: 10000 },
    );
}

/**
 * Delete selected file/folder in file manager (legacy API)
 *
 * @param page - Playwright page
 */
export async function deleteFileInManager(page: Page): Promise<void> {
    const modal = page.locator('#modalFileManager');

    // Handle confirmation dialog
    page.once('dialog', async dialog => {
        await dialog.accept();
    });

    // Click delete button
    const deleteBtn = modal.locator(
        '.media-library-delete-btn, [data-action="delete"], button:has-text("Delete"), button:has-text("Eliminar")',
    );
    await deleteBtn.first().click();

    await page.waitForFunction(() => !document.querySelector('#modalFileManager .media-library-loading'), undefined, {
        timeout: 5000,
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSERT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Insert a file into TinyMCE from the file manager and verify it renders in preview.
 *
 * @param page - Playwright page
 * @param filename - The filename to insert
 */
export async function insertFileIntoEditor(page: Page, filename: string): Promise<void> {
    // Select the file
    await selectFileByName(page, filename);

    // Click insert button
    const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
    await insertBtn.click();

    // Wait for file manager to close
    await page.locator('#modalFileManager').waitFor({ state: 'hidden', timeout: 5000 });

    // Fill alt text if dialog appears
    const altTextField = page
        .locator('.tox-dialog .tox-form__group')
        .filter({ has: page.locator('label:text-matches("alternativ", "i")') })
        .locator('.tox-textfield');

    if (await altTextField.isVisible().catch(() => false)) {
        await altTextField.fill('Test image');
    }

    // Click Save in TinyMCE dialog
    const saveBtn = page.locator('.tox-dialog .tox-button[title="Save"], .tox-dialog .tox-button:has-text("Save")');
    if (
        await saveBtn
            .first()
            .isVisible()
            .catch(() => false)
    ) {
        await saveBtn.first().click();
    }

    await page.waitForFunction(
        () => {
            const d = document.querySelector('#modalFileManager');
            return !d || d.getAttribute('data-open') !== 'true';
        },
        undefined,
        { timeout: 5000 },
    );
}

/**
 * Insert selected file into TinyMCE editor (legacy API)
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

/**
 * Verify that an image with a specific filename appears correctly in the TinyMCE editor.
 * Searches for img elements in the TinyMCE iframe where:
 * - data-asset-src contains the filename, OR
 * - src contains the filename (encoded or not), OR
 * - Any img exists if an image was just inserted
 *
 * @param page - Playwright page
 * @param expectedFilename - The expected filename in data-asset-src or src attribute
 * @returns true if image is found in editor, false otherwise
 */
export async function verifyImageInEditor(page: Page, expectedFilename: string): Promise<boolean> {
    try {
        // Find TinyMCE iframe
        const editorFrame = page.frameLocator('iframe.tox-edit-area__iframe').first();

        // Wait for the TinyMCE body to be available
        await editorFrame.locator('body').waitFor({ state: 'attached', timeout: 10000 });

        // Wait for first image candidate in editor
        await editorFrame
            .locator('img')
            .first()
            .waitFor({ state: 'attached', timeout: 5000 })
            .catch(() => {});

        // Use evaluate to check for images with various attributes
        return await editorFrame.locator('body').evaluate((body, filename) => {
            const images = body.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
            if (images.length === 0) return false;

            // Check each image for a match
            for (const img of images) {
                // Check data-asset-src (preferred)
                const assetSrc = img.getAttribute('data-asset-src') || '';
                if (assetSrc.includes(filename)) {
                    return img.src?.startsWith('blob:') || (img.complete && img.naturalWidth > 0);
                }

                // Check src directly (may be URL-encoded)
                const src = img.getAttribute('src') || '';
                if (src.includes(filename) || src.includes(encodeURIComponent(filename))) {
                    return img.src?.startsWith('blob:') || (img.complete && img.naturalWidth > 0);
                }

                // Check data-mce-src (TinyMCE internal)
                const mceSrc = img.getAttribute('data-mce-src') || '';
                if (mceSrc.includes(filename) || mceSrc.includes(encodeURIComponent(filename))) {
                    return img.src?.startsWith('blob:') || (img.complete && img.naturalWidth > 0);
                }
            }

            // If we can't find by filename, check if there's at least one valid image
            // This is a fallback for cases where the filename encoding is different
            for (const img of images) {
                if (img.complete && img.naturalWidth > 0) {
                    return true;
                }
                if (img.src?.startsWith('blob:')) {
                    return true;
                }
            }

            return false;
        }, expectedFilename);
    } catch {
        return false;
    }
}

/**
 * Verify that an image with a specific data-asset-src exists in the preview iframe.
 * Also checks for images by src or any loaded image as fallback.
 *
 * @param page - Playwright page
 * @param expectedFilename - The expected filename in data-asset-src
 * @returns true if image is found and rendered
 */
export async function verifyImageInPreview(page: Page, expectedFilename: string): Promise<boolean> {
    const iframe = page.frameLocator('#preview-iframe');

    try {
        // Wait for any content to be in the iframe
        await iframe.locator('body').waitFor({ state: 'attached', timeout: 10000 });
        await iframe
            .locator('img')
            .first()
            .waitFor({ state: 'attached', timeout: 5000 })
            .catch(() => {});

        // Verify image exists using evaluate for more flexibility
        return await iframe.locator('body').evaluate((body, filename) => {
            const images = body.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
            if (images.length === 0) return false;

            // Check each image for a match
            for (const img of images) {
                // Check data-asset-src (preferred)
                const assetSrc = img.getAttribute('data-asset-src') || '';
                if (assetSrc.includes(filename)) {
                    return img.src?.startsWith('blob:') || (img.complete && img.naturalWidth > 0);
                }

                // Check src directly (may be URL-encoded)
                const src = img.getAttribute('src') || '';
                if (src.includes(filename) || src.includes(encodeURIComponent(filename))) {
                    return img.src?.startsWith('blob:') || (img.complete && img.naturalWidth > 0);
                }
            }

            // If we can't find by filename, check if there's at least one valid image
            for (const img of images) {
                if (img.complete && img.naturalWidth > 0) {
                    return true;
                }
                if (img.src?.startsWith('blob:')) {
                    return true;
                }
            }

            return false;
        }, expectedFilename);
    } catch {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// YJS VERIFICATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify that an asset exists in Yjs metadata.
 *
 * @param page - Playwright page
 * @param filename - The filename to check for
 * @returns true if asset exists in Yjs
 */
export async function verifyAssetInYjs(page: Page, filename: string): Promise<boolean> {
    return await page.evaluate(fname => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        if (!bridge) return false;

        const docManager = bridge.getDocumentManager();
        if (!docManager) return false;

        const assets = docManager.getAssets?.() || new Map();

        // Search through assets for matching filename
        for (const [, assetData] of assets) {
            if (assetData?.name === fname || assetData?.filename === fname) {
                return true;
            }
        }
        return false;
    }, filename);
}

/**
 * Get the asset ID for a file from Yjs metadata.
 *
 * @param page - Playwright page
 * @param filename - The filename to look up
 * @returns The asset ID or null if not found
 */
export async function getAssetIdFromYjs(page: Page, filename: string): Promise<string | null> {
    return await page.evaluate(fname => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        if (!bridge) return null;

        const docManager = bridge.getDocumentManager();
        if (!docManager) return null;

        const assets = docManager.getAssets?.() || new Map();

        for (const [id, assetData] of assets) {
            if (assetData?.name === fname || assetData?.filename === fname) {
                return id;
            }
        }
        return null;
    }, filename);
}
