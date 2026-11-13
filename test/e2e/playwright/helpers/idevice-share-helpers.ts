import { expect, type Page } from '@playwright/test';

/**
 * The Import, Create with AI and Export buttons shared by the iDevice forms
 * ($exeIDevicesEdition.iDevice.share), as an author uses them from the tab
 * that shows them.
 */

/** Imports a text file, then waits for the caller's assertion on the imported content. */
export async function importText(page: Page, name: string, text: string, imported: () => Promise<void>): Promise<void> {
    await page.locator('[data-exe-share="import"]').click();
    await expect(page.locator('#eXeShareModal-import')).toBeVisible();
    await page.locator('#eXeGameImportGame').setInputFiles({
        name,
        mimeType: 'text/plain',
        buffer: Buffer.from(text),
    });
    await expect(page.locator('#eXeShareModal-import')).toBeHidden();
    // Selecting a file closes the window before FileReader has processed it.
    await imported();
}

/**
 * Drops a text file on the zone of the Import window, as an author drags one from the desktop, then waits
 * for the caller's assertion on the imported content. The zone must light up while the file is over it.
 */
export async function dropText(page: Page, name: string, text: string, imported: () => Promise<void>): Promise<void> {
    await page.locator('[data-exe-share="import"]').click();
    const modal = page.locator('#eXeShareModal-import');
    await expect(modal).toBeVisible();
    const zone = modal.locator('[data-exe-file-drop]');
    const dataTransfer = await page.evaluateHandle(
        ([fileName, content]) => {
            const transfer = new DataTransfer();
            transfer.items.add(new File([content], fileName, { type: 'text/plain' }));
            return transfer;
        },
        [name, text],
    );
    await zone.dispatchEvent('dragenter', { dataTransfer });
    await zone.dispatchEvent('dragover', { dataTransfer });
    await expect(zone).toHaveClass(/\bis-dragover\b/);
    await zone.dispatchEvent('drop', { dataTransfer });
    await expect(modal).toBeHidden();
    await expect(zone).not.toHaveClass(/\bis-dragover\b/);
    // Dropping a file closes the window before FileReader has processed it.
    await imported();
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
