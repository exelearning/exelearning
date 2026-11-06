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
import { addWithAi, closeAlert, exportText } from '../../helpers/idevice-share-helpers';

test('Scrambled list imports, adds with AI and exports its elements', async ({
    authenticatedPage: page,
    createProject,
}) => {
    // Saving and reloading the project takes most of a minute in Firefox.
    test.setTimeout(90_000);
    const uuid = await createProject(page, 'Scrambled list sharing');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'scrambled-list');
    const id = await page.locator('.idevice_node.scrambled-list').first().getAttribute('id');
    expect(id).toBeTruthy();

    // Import a real text file: its list replaces the elements.
    await page.locator('#scrambledlistIdeviceForm-tab-contents').click();
    await page.locator('[data-exe-share="import"]').click();
    await expect(page.locator('#eXeShareModal-import .modal-body > p').first()).toHaveText(
        'You can import questions compatible with this activity from txt files.',
    );
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'list.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Wake up#Have breakfast#Go to school\n'),
    });
    await expect(page.locator('#eXeShareModal-import')).toBeHidden();
    await expect(page.locator('#sortableListFormList0')).toHaveValue('Wake up');
    await expect(page.locator('#sortableListFormList2')).toHaveValue('Go to school');
    // The AI window does the same with the lines it is given.
    await addWithAi(page, 'Seed#Sprout#Plant#Flower');
    await closeAlert(page, 'The questions have been added successfully');
    await expect(page.locator('#sortableListFormList3')).toHaveValue('Flower');
    // Export writes the list as Import reads it: one line, separated by #.
    expect(await exportText(page)).toBe('Seed#Sprout#Plant#Flower');
    await expect(page.locator('.exe-share-modal.show')).toHaveCount(0);

    await saveIdevice(page, id!);
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await expect(page.locator('#sortableListFormList0')).toHaveValue('Seed');
});
