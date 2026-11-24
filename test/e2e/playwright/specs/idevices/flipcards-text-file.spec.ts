import { readFileSync } from 'node:fs';
import { expect, test } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';

/**
 * Memory cards store the text of each side %-encoded, and their text file
 * holds it in that form, as every version has written it. Read back, a "#" in
 * the text is not taken for the separator and a literal "%25" is not decoded.
 */
test('flipcards reads its text file and exports the cards the same way', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'flipcards text file');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'flipcards');
    // Import reads the file once its change handler is wired.
    await page.waitForFunction(() => {
        const input = document.querySelector('#eXeGameImportGame');
        return !!input && !!(window as any).jQuery?._data(input, 'events')?.change;
    });

    // Each side as the card stores it, which is how the export writes it.
    const stored = (text: string) => encodeURIComponent(text.replace('%', '&percnt;'));
    const file = [
        ['C#language', 'Programming'],
        ['100%25', 'A literal percent sequence'],
        ['New York', 'Nueva York'],
    ]
        .map(([front, back]) => `${stored(front)}#${stored(back)}`)
        .join('\n');
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'cards.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(file),
    });
    await expect(page.locator('#flipcardsEText')).toHaveValue('C#language');
    await expect(page.locator('#flipcardsETextBack')).toHaveValue('Programming');

    await page
        .locator('.exe-form-tabs a')
        .filter({ hasText: /^Import\/Export$/ })
        .click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#eXeGameExportQuestions').click();
    const download = await downloadPromise;

    expect(readFileSync(await download.path(), 'utf8')).toBe(file);
});
