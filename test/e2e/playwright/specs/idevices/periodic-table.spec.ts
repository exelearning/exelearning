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

test('Periodic table asks for the data to complete instead of the type in its Complete mode', async ({
    authenticatedPage: page,
    createProject,
}) => {
    // Saving and reloading the project takes most of a minute in Firefox.
    test.setTimeout(90_000);
    const uuid = await createProject(page, 'Periodic table complete mode');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'periodic-table');
    const id = await page.locator('.idevice_node.periodic-table').first().getAttribute('id');
    expect(id).toBeTruthy();

    await page.locator('#ptQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#ptGameType')).toBeVisible();
    await page.locator('#ptEComplete').check();
    await expect(page.locator('#ptGameType')).toBeHidden();
    await expect(page.locator('#ptCompleteData')).toBeVisible();
    await page.locator('#ptEname').check();

    await saveIdevice(page, id!);
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await page.locator('#ptQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#ptEComplete')).toBeChecked();
    await expect(page.locator('#ptGameType')).toBeHidden();
    await expect(page.locator('#ptCompleteData')).toBeVisible();
    await expect(page.locator('#ptEname')).toBeChecked();
    await expect(page.locator('#ptEsymbol')).toBeChecked();
});
