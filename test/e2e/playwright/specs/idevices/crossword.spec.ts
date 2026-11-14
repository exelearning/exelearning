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

test('Crossword exports the word on screen, and its AI window says when nothing fits', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Crossword sharing');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'crossword');
    const id = await page.locator('.idevice_node.crossword').first().getAttribute('id');
    expect(id).toBeTruthy();
    await page.locator('#ccgmESolutionWord').fill('EARTH');
    await page.locator('#ccgmEDefinitionWord').fill('Our home planet');
    await page.locator('#ccgmEAdd').click();
    await page.locator('#ccgmESolutionWord').fill('MOON');
    await page.locator('#ccgmEDefinitionWord').fill('Earth natural satellite');

    // Export includes the word still on screen (MOON, not stored yet), in the format Import reads.
    await page.locator('#ccgmQEIdeviceForm-tab-contents').click();
    expect((await exportText(page)).split('\n')).toEqual(['EARTH#Our home planet', 'MOON#Earth natural satellite']);
    await expect(page.locator('.exe-share-modal.show')).toHaveCount(0);
    // The AI window says when nothing fits the game, and adds what does.
    await addWithAi(page, 'SOLAR SYSTEM#The sun and its planets');
    const alert = page.locator('#modalAlert.show');
    await expect(alert).toContainText('Sorry, there are no questions for this type of activity.');
    await expect(alert).not.toContainText('added successfully');
    await closeAlert(page, 'Sorry, there are no questions for this type of activity.');
    await expect(page.locator('#ccgmENumQuestions')).toHaveText('2');
    await page.locator('#eXeEQuestionsArea').fill('STAR#A sun far away');
    await page.locator('#eXeESaveButton').click();
    await closeAlert(page, 'The questions have been added successfully');
    await expect(page.locator('#ccgmENumQuestions')).toHaveText('3');

    await saveIdevice(page, id!);
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await page.locator('#ccgmQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#ccgmENumQuestions')).toHaveText('3');
});
