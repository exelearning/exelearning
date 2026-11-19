import { test, expect } from '../../fixtures/auth.fixture';
import {
    addIdevice,
    editIdevice,
    gotoWorkarea,
    reloadPage,
    saveIdevice,
    saveProject,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';
import { addWithAi, closeAlert, exportText, importText } from '../../helpers/idevice-share-helpers';

test('Word search shares its words', async ({ authenticatedPage: page, createProject }) => {
    const uuid = await createProject(page, 'Word search sharing');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'word-search');
    const id = await page.locator('.idevice_node.word-search').first().getAttribute('id');
    expect(id).toBeTruthy();

    // Import a real text file: its words replace the empty first one.
    await page.locator('#sopaQEIdeviceForm-tab-contents').click();
    await importText(page, 'words.txt', 'SUN#The star of our system\nMOON#Natural satellite of the Earth\n', () =>
        expect(page.locator('#sopaENumQuestions')).toHaveText('2'),
    );
    await expect(page.locator('#sopaESolutionWord')).toHaveValue('SUN');
    // The AI window adds the lines it is given.
    await addWithAi(page, 'STAR#A sun far away');
    await expect(page.locator('#sopaENumQuestions')).toHaveText('3');
    await closeAlert(page, 'The questions have been added successfully');
    // Export writes the format Import reads back.
    expect((await exportText(page)).split('\n')).toEqual([
        'SUN#The star of our system',
        'MOON#Natural satellite of the Earth',
        'STAR#A sun far away',
    ]);

    await saveIdevice(page, id!);
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await page.locator('#sopaQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#sopaENumQuestions')).toHaveText('3');
    await expect(page.locator('#sopaEDefinitionWord')).toHaveValue('The star of our system');
});
