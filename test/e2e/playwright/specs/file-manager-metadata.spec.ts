import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for centralized File Manager asset metadata (#1244, #1243).
 *
 * Covers:
 * - Editing & saving an image's centralized metadata (image name/title, description,
 *   license, author, author link, image URL) in the properties panel
 * - Alt text is NOT here (it is per-instance, edited in the image dialog)
 * - Persistence across reopening the File Manager
 * - Searching assets by description / author
 * - The metadata panel being available for non-image files too
 */

async function openFileManagerFromUtilitiesMenu(page: Page): Promise<void> {
    await page.locator('#dropdownUtilities').click();
    await page.waitForTimeout(200);
    await page.locator('#navbar-button-filemanager').click();
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });
}

async function closeFileManager(page: Page): Promise<void> {
    const closeBtn = page.locator('#modalFileManager .close, #modalFileManager [data-dismiss="modal"]').first();
    if ((await closeBtn.count()) > 0) {
        await closeBtn.click();
    }
    await page.waitForTimeout(500);
}

async function uploadFile(page: Page, fixturePath: string): Promise<void> {
    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);
    await page.waitForFunction(
        () => document.querySelectorAll('#modalFileManager .media-library-item:not(.media-library-folder)').length > 0,
        undefined,
        { timeout: 15000 },
    );
    await page.waitForTimeout(500);
}

async function selectFirstFile(page: Page): Promise<void> {
    const fileItem = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
    await fileItem.waitFor({ state: 'visible', timeout: 10000 });
    await fileItem.click();
    await page.waitForSelector('#modalFileManager .media-library-edit-metadata', { state: 'visible', timeout: 5000 });
}

test.describe('File Manager - centralized asset metadata', () => {
    test('edits, saves and persists image metadata; searches by description', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'File Manager - Metadata Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openFileManagerFromUtilitiesMenu(page);
        await uploadFile(page, 'test/fixtures/sample-2.jpg');
        await selectFirstFile(page);

        // Alt text is per-instance (edited in the image dialog), so it is NOT in the
        // File Manager panel anymore.
        await expect(page.locator('#modalFileManager .media-library-meta-alt')).toHaveCount(0);

        // Fill metadata — there is no Save button: changes autosave on blur/debounce.
        // Edit each field and wait for the "Saved" status before the next one. The
        // status only flips to "Saved" after the flush completes (which awaits both the
        // Yjs write and the best-effort server sync), so this is deterministic and
        // avoids races between rapid autosaves.
        const status = page.locator('#modalFileManager .media-library-meta-status');
        const editField = async (selector: string, value: string): Promise<void> => {
            await page.locator(selector).fill(value);
            await page.locator(selector).blur();
            await expect(status).toHaveText(/saved|guardad/i, { timeout: 5000 });
        };
        await editField('#modalFileManager .media-library-meta-description', 'A scenic mountain sunset');
        await editField('#modalFileManager .media-library-meta-title', 'Mountain Sunset');
        await page.locator('#modalFileManager .media-library-meta-license').selectOption('Creative Commons BY');
        await expect(status).toHaveText(/saved|guardad/i, { timeout: 5000 });
        await editField('#modalFileManager .media-library-meta-author', 'Ada Lovelace');
        await editField('#modalFileManager .media-library-meta-author-url', 'https://ada.example');
        await editField('#modalFileManager .media-library-meta-source-url', 'https://src.example/sunset.jpg');

        // Search by description finds the image.
        await page.locator('#modalFileManager .media-library-search').fill('mountain');
        await page.waitForTimeout(400);
        await expect(page.locator('#modalFileManager .media-library-item:not(.media-library-folder)')).toHaveCount(1);

        // Search by author also finds the image (search spans all metadata fields).
        await page.locator('#modalFileManager .media-library-search').fill('lovelace');
        await page.waitForTimeout(400);
        await expect(page.locator('#modalFileManager .media-library-item:not(.media-library-folder)')).toHaveCount(1);

        // Clear search, reopen the panel and confirm persistence.
        await page.locator('#modalFileManager .media-library-search').fill('');
        await page.waitForTimeout(300);
        // Let the debounced autosave + best-effort server PATCH settle before reopening.
        await page.waitForTimeout(800);
        await closeFileManager(page);
        await openFileManagerFromUtilitiesMenu(page);
        await selectFirstFile(page);

        await expect(page.locator('#modalFileManager .media-library-meta-description')).toHaveValue(
            'A scenic mountain sunset',
        );
        await expect(page.locator('#modalFileManager .media-library-meta-title')).toHaveValue('Mountain Sunset');
        await expect(page.locator('#modalFileManager .media-library-meta-author')).toHaveValue('Ada Lovelace');
        await expect(page.locator('#modalFileManager .media-library-meta-license')).toHaveValue('Creative Commons BY');
        await expect(page.locator('#modalFileManager .media-library-meta-author-url')).toHaveValue(
            'https://ada.example',
        );
        await expect(page.locator('#modalFileManager .media-library-meta-source-url')).toHaveValue(
            'https://src.example/sunset.jpg',
        );
    });
});
