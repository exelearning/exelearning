import { test, expect } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    selectFirstPage,
    addIdevice,
    editIdevice,
    saveIdevice,
} from '../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E for the Resource Report iDevice (#1087), built on the centralized asset
 * metadata from #1868. Verifies that an uploaded asset is auto-listed with a
 * title/filename and working View + Download links.
 */

async function uploadAssetViaFileManager(page: Page, fixturePath: string): Promise<void> {
    await page.locator('#dropdownUtilities').click();
    await page.waitForTimeout(200);
    await page.locator('#navbar-button-filemanager').click();
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    await page.locator('#modalFileManager .media-library-upload-input').setInputFiles(fixturePath);
    await page.waitForFunction(
        () => document.querySelectorAll('#modalFileManager .media-library-item:not(.media-library-folder)').length > 0,
        undefined,
        { timeout: 15000 },
    );
    await page.waitForTimeout(500);

    const closeBtn = page.locator('#modalFileManager .close, #modalFileManager [data-dismiss="modal"]').first();
    if ((await closeBtn.count()) > 0) await closeBtn.click();
    await page.waitForTimeout(500);
}

test.describe('Resource Report iDevice', () => {
    test('auto-lists an uploaded asset with View and Download links', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Resource Report Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // 1. Upload an asset so the project has a resource to report.
        await uploadAssetViaFileManager(page, 'test/fixtures/sample-2.jpg');

        // 2. Add the Resource Report iDevice to the first page.
        await selectFirstPage(page);
        await addIdevice(page, 'resource-report');

        // Wait for the editor form to finish rendering (async iDevice init) before saving.
        await page.locator('#resourceReportForm').waitFor({ state: 'visible', timeout: 15000 });

        // 3. Save it (triggers the snapshot + renderView for the node view).
        const ideviceId = await page
            .locator('#node-content article .idevice_node.resource-report')
            .first()
            .getAttribute('id');
        expect(ideviceId).toBeTruthy();
        await saveIdevice(page, ideviceId as string);

        // 4. The rendered report lists the uploaded asset with View + Download.
        const node = page.locator(`.idevice_node[id="${ideviceId}"]`);
        await expect(node.locator('.resource-report-item')).toHaveCount(1);
        await expect(node.locator('.resource-report-item-title')).toBeVisible();
        await expect(node.locator('.resource-report-view')).toBeVisible();
        await expect(node.locator('.resource-report-download')).toBeVisible();
        await expect(node).toContainText('sample-2.jpg');
    });

    test('lets the author turn off the View and Download links', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Resource Report Links Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await uploadAssetViaFileManager(page, 'test/fixtures/sample-2.jpg');

        await selectFirstPage(page);
        await addIdevice(page, 'resource-report');
        await page.locator('#resourceReportForm').waitFor({ state: 'visible', timeout: 15000 });

        const ideviceId = (await page
            .locator('#node-content article .idevice_node.resource-report')
            .first()
            .getAttribute('id')) as string;
        expect(ideviceId).toBeTruthy();

        // Save once so both links render, then re-edit and disable them.
        await saveIdevice(page, ideviceId);
        const node = page.locator(`.idevice_node[id="${ideviceId}"]`);
        await expect(node.locator('.resource-report-view')).toBeVisible();
        await expect(node.locator('.resource-report-download')).toBeVisible();

        await editIdevice(page, ideviceId);
        // The toggles live inside the collapsible "Display options" group; the
        // checkboxes are still present in the DOM even while it is collapsed.
        await node.locator('#rrShowViewLink').uncheck({ force: true });
        await node.locator('#rrShowDownloadLink').uncheck({ force: true });
        await saveIdevice(page, ideviceId);

        await expect(node.locator('.resource-report-view')).toHaveCount(0);
        await expect(node.locator('.resource-report-download')).toHaveCount(0);
        await expect(node.locator('.resource-report-actions')).toHaveCount(0);
        // The asset itself is still listed — only the links were removed.
        await expect(node.locator('.resource-report-item')).toHaveCount(1);
    });
});
