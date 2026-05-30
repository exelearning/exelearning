import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, selectFirstPage, addIdevice, saveIdevice } from '../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E for File Manager usability (#1817): usage locations ("Used in"), sort by
 * references, and Replace file preserving references — built on #1868/#1869.
 */

async function openFileManager(page: Page): Promise<void> {
    await page.locator('#dropdownUtilities').click();
    await page.waitForTimeout(200);
    await page.locator('#navbar-button-filemanager').click();
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });
}

async function closeFileManager(page: Page): Promise<void> {
    const closeBtn = page.locator('#modalFileManager .close, #modalFileManager [data-dismiss="modal"]').first();
    if ((await closeBtn.count()) > 0) await closeBtn.click();
    await page.waitForTimeout(400);
}

async function uploadFile(page: Page, fixturePath: string): Promise<void> {
    await page.locator('#modalFileManager .media-library-upload-input').setInputFiles(fixturePath);
    await page.waitForFunction(
        () => document.querySelectorAll('#modalFileManager .media-library-item:not(.media-library-folder)').length > 0,
        undefined,
        { timeout: 15000 },
    );
    await page.waitForTimeout(500);
}

async function selectFirstFile(page: Page): Promise<void> {
    const item = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
    await item.waitFor({ state: 'visible', timeout: 10000 });
    await item.click();
    await page.waitForSelector('#modalFileManager .media-library-sidebar-content:not([style*="display: none"])', {
        timeout: 5000,
    });
}

test.describe('File Manager usage & replace (#1817)', () => {
    test('shows "Used in", supports references sort, and Replace keeps references', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'File Manager Usability Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // 1. Upload an image asset.
        await openFileManager(page);
        await uploadFile(page, 'test/fixtures/sample-2.jpg');
        await closeFileManager(page);

        // 2. Create a usage: add a Resource Report iDevice (auto-references the asset).
        await selectFirstPage(page);
        await addIdevice(page, 'resource-report');
        await page.locator('#resourceReportForm').waitFor({ state: 'visible', timeout: 15000 });
        const ideviceId = await page
            .locator('#node-content article .idevice_node.resource-report')
            .first()
            .getAttribute('id');
        await saveIdevice(page, ideviceId as string);

        // 3. Open the File Manager and verify the asset is reported as used.
        await openFileManager(page);
        await selectFirstFile(page);

        const usageLocations = page.locator('#modalFileManager .media-library-usage-locations li');
        await expect(usageLocations.first()).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#modalFileManager .media-library-usage-locations')).not.toContainText(/Not used/i);

        // 4. Sort by references (most used first) works without error.
        await page.locator('#modalFileManager .media-library-sort').selectOption('references-desc');
        await page.waitForTimeout(300);
        await expect(
            page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first(),
        ).toBeVisible();

        // 5. Replace the file content (same broad type) — references must be preserved.
        await selectFirstFile(page);
        await page
            .locator('#modalFileManager .media-library-replace-input')
            .setInputFiles('test/fixtures/sample-3.jpg');
        // Wait for the replace to complete (assets reload).
        await page.waitForTimeout(1500);

        // The asset is still listed and still reported as used (same id → refs intact).
        await selectFirstFile(page);
        await expect(page.locator('#modalFileManager .media-library-usage-locations li').first()).toBeVisible({
            timeout: 5000,
        });
        await expect(page.locator('#modalFileManager .media-library-usage-locations')).not.toContainText(/Not used/i);
    });
});
