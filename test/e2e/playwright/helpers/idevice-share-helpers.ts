import { expect, type Page } from '@playwright/test';

/**
 * The Import, Create with AI and Export buttons shared by the iDevice forms
 * ($exeIDevicesEdition.iDevice.share), as an author uses them from the tab
 * that shows them.
 */

/** Imports a text file through the Import window, which closes once it is read. */
export async function importText(page: Page, name: string, text: string): Promise<void> {
    await page.locator('[data-exe-share="import"]').click();
    await expect(page.locator('#eXeShareModal-import')).toBeVisible();
    await page.locator('#eXeGameImportGame').setInputFiles({
        name,
        mimeType: 'text/plain',
        buffer: Buffer.from(text),
    });
    await expect(page.locator('#eXeShareModal-import')).toBeHidden();
}

/** Writes lines in the Create with AI window and adds them. What the app answers is up to the test. */
export async function addWithAi(page: Page, lines: string): Promise<void> {
    await page.locator('[data-exe-share="ai"]').click();
    await page.locator('#eXeETabQuestions').click();
    await page.locator('#eXeEQuestionsArea').fill(lines);
    await page.locator('#eXeESaveButton').click();
}

/** Closes the alert of the app once it says `message`. */
export async function closeAlert(page: Page, message: string): Promise<void> {
    const alert = page.locator('#modalAlert.show');
    await expect(alert).toContainText(message);
    await alert.locator('.close').first().click();
    await expect(alert).toBeHidden();
}

/** Exports through the Export button and returns the text downloaded. */
export async function exportText(page: Page): Promise<string> {
    const downloading = page.waitForEvent('download');
    await page.locator('#eXeGameExportQuestions').click();
    const download = await downloading;
    let exported = '';
    for await (const chunk of await download.createReadStream()) exported += chunk.toString();
    return exported;
}
