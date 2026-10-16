import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, selectFirstPage, addIdevice, saveIdevice } from '../helpers/workarea-helpers';
import { insertFileIntoEditor, selectFileByName } from '../helpers/file-manager-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E for File Manager usability (#1817): usage locations ("Used in"), sort by
 * references, and Replace file preserving references — built on #1868/#1869.
 *
 * The real usage is created by inserting an image into a Text iDevice. A Resource
 * Report iDevice is also present the whole time: its all-assets snapshot must NOT
 * count as a reference (self-reference exclusion), so an asset only listed by the
 * report still reads "Not used in this project".
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

async function uploadFile(page: Page, fixturePath: string, expectedCount: number): Promise<void> {
    await page.locator('#modalFileManager .media-library-upload-input').setInputFiles(fixturePath);
    await page.waitForFunction(
        (count: number) =>
            document.querySelectorAll('#modalFileManager .media-library-item:not(.media-library-folder)').length >=
            count,
        expectedCount,
        { timeout: 15000 },
    );
    await page.waitForTimeout(500);
}

/** Select a file by name and open the sidebar Usage tab. */
async function openUsageForFile(page: Page, filename: string): Promise<void> {
    await selectFileByName(page, filename);
    await page.waitForSelector('#modalFileManager .media-library-sidebar-content:not([style*="display: none"])', {
        timeout: 5000,
    });
    await page.locator('#modalFileManager .media-library-tab[data-media-tab="usage"]').click();
}

/** Insert an image asset into a new Text iDevice via the TinyMCE image dialog. */
async function insertImageIntoTextIdevice(page: Page, filename: string): Promise<string> {
    await addIdevice(page, 'text');
    await page.waitForSelector('.tox-tinymce, .tox-menubar, .tox-toolbar', { timeout: 20000 });

    const imageBtn = page.locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]').first();
    await expect(imageBtn).toBeVisible({ timeout: 10000 });
    await imageBtn.click();
    await page.waitForSelector('.tox-dialog', { timeout: 10000 });

    const browseBtn = page.locator('.tox-dialog .tox-browse-url').first();
    await expect(browseBtn).toBeVisible({ timeout: 5000 });
    await browseBtn.click();
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    await insertFileIntoEditor(page, filename);

    const ideviceId = (await page
        .locator('#node-content article .idevice_node.text')
        .first()
        .getAttribute('id')) as string;
    expect(ideviceId).toBeTruthy();
    await saveIdevice(page, ideviceId);
    return ideviceId;
}

test.describe('File Manager usage & replace (#1817)', () => {
    test('shows "Used in", excludes the Resource Report snapshot, supports references sort, and Replace keeps references', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'File Manager Usability Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // 1. Upload two image assets: one will be used, the other stays unused.
        await openFileManager(page);
        await uploadFile(page, 'test/fixtures/sample-2.jpg', 1);
        await uploadFile(page, 'test/fixtures/sample-3.jpg', 2);
        await closeFileManager(page);

        // 2. Add a Resource Report iDevice: it snapshots asset:// URLs for EVERY
        //    asset, which must NOT count as a reference.
        await selectFirstPage(page);
        await addIdevice(page, 'resource-report');
        await page.locator('#resourceReportForm').waitFor({ state: 'visible', timeout: 15000 });
        const reportId = await page
            .locator('#node-content article .idevice_node.resource-report')
            .first()
            .getAttribute('id');
        await saveIdevice(page, reportId as string);

        // 3. Create a REAL usage: insert sample-2.jpg into a Text iDevice.
        await insertImageIntoTextIdevice(page, 'sample-2.jpg');

        // 4. The used asset lists exactly one location (the Text iDevice; the
        //    Resource Report must not appear).
        await openFileManager(page);
        await openUsageForFile(page, 'sample-2.jpg');
        const usageLocations = page.locator('#modalFileManager .media-library-usage-locations li');
        await expect(usageLocations.first()).toBeVisible({ timeout: 5000 });
        await expect(usageLocations).toHaveCount(1);
        await expect(page.locator('#modalFileManager .media-library-usage-locations')).not.toContainText(/Not used/i);

        // 5. The asset only snapshotted by the Resource Report still reads unused —
        //    the report's self-reference is excluded from the scanners.
        await openUsageForFile(page, 'sample-3.jpg');
        await expect(page.locator('#modalFileManager .media-library-usage-locations')).toContainText(
            /Not used in this project/i,
        );

        // 6. Sort by references (most used first): the genuinely used asset leads.
        await page.locator('#modalFileManager .media-library-sort').selectOption('references-desc');
        await page.waitForTimeout(300);
        await expect(
            page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first(),
        ).toHaveAttribute('data-filename', 'sample-2.jpg');

        // 7. Replace the used file's content (same broad type) — references must be
        //    preserved because the asset id is unchanged.
        await selectFileByName(page, 'sample-2.jpg');
        await page
            .locator('#modalFileManager .media-library-replace-input')
            .setInputFiles('test/fixtures/sample-4.jpg');
        // Wait for the replace to complete (assets reload).
        await page.waitForTimeout(1500);

        // The replaced asset (now named sample-4.jpg) is still reported as used.
        await openUsageForFile(page, 'sample-4.jpg');
        await expect(page.locator('#modalFileManager .media-library-usage-locations li').first()).toBeVisible({
            timeout: 5000,
        });
        await expect(page.locator('#modalFileManager .media-library-usage-locations')).not.toContainText(/Not used/i);
    });
});
