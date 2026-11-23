import { readFileSync } from 'node:fs';
import { expect, test } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';

/**
 * Memory cards store the text of each side %-encoded. Earlier versions wrote
 * that stored form to the exported text file ("New%20York"), and the import,
 * which now encodes what it reads, would have encoded it a second time.
 */
test('flipcards reads an earlier text file and exports its cards as text', async ({
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

    // A file as earlier versions exported it, sides in their stored form.
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'cards.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(
            [
                `${encodeURIComponent('New York')}#${encodeURIComponent('Nueva York')}`,
                `${encodeURIComponent('50&percnt; off')}#${encodeURIComponent('Half price')}`,
            ].join('\n'),
        ),
    });
    await expect(page.locator('#flipcardsEText')).toHaveValue('New York');
    await expect(page.locator('#flipcardsETextBack')).toHaveValue('Nueva York');

    await page
        .locator('.exe-form-tabs a')
        .filter({ hasText: /^Import\/Export$/ })
        .click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#eXeGameExportQuestions').click();
    const download = await downloadPromise;

    expect(readFileSync(await download.path(), 'utf8')).toBe('New York#Nueva York\n50% off#Half price');
});
