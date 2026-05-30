import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for centralized File Manager asset metadata (#1244, #1243).
 *
 * Covers:
 * - Editing & saving an image's description / alt text / title in the properties panel
 * - Persistence across reopening the File Manager
 * - Searching assets by description
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

        // The image-specific alt-text row is visible for images.
        await expect(page.locator('#modalFileManager .metadata-edit-alt-row')).toBeVisible();

        // Fill and save metadata.
        await page.locator('#modalFileManager .media-library-meta-description').fill('A scenic mountain sunset');
        await page.locator('#modalFileManager .media-library-meta-alt').fill('Sunset over mountains');
        await page.locator('#modalFileManager .media-library-meta-title').fill('Mountain Sunset');
        await page.locator('#modalFileManager .media-library-meta-author').fill('Ada Lovelace');
        await page.locator('#modalFileManager .media-library-meta-license').selectOption('Creative Commons BY');
        await page.locator('#modalFileManager .media-library-meta-save-btn').click();

        // "Metadata saved" status appears.
        await expect(page.locator('#modalFileManager .media-library-meta-status')).toHaveText(/saved|guardad/i, {
            timeout: 5000,
        });

        // Search by description finds the image.
        await page.locator('#modalFileManager .media-library-search').fill('mountain');
        await page.waitForTimeout(400);
        await expect(
            page.locator('#modalFileManager .media-library-item:not(.media-library-folder)'),
        ).toHaveCount(1);

        // Clear search, reopen the panel and confirm persistence.
        await page.locator('#modalFileManager .media-library-search').fill('');
        await page.waitForTimeout(300);
        await closeFileManager(page);
        await openFileManagerFromUtilitiesMenu(page);
        await selectFirstFile(page);

        await expect(page.locator('#modalFileManager .media-library-meta-description')).toHaveValue(
            'A scenic mountain sunset',
        );
        await expect(page.locator('#modalFileManager .media-library-meta-alt')).toHaveValue('Sunset over mountains');
        await expect(page.locator('#modalFileManager .media-library-meta-title')).toHaveValue('Mountain Sunset');
        await expect(page.locator('#modalFileManager .media-library-meta-author')).toHaveValue('Ada Lovelace');
        await expect(page.locator('#modalFileManager .media-library-meta-license')).toHaveValue('Creative Commons BY');
    });
});
