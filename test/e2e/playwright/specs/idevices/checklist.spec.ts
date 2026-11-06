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

test('Checklist shows where to choose its logo once the logo is on, and keeps its items', async ({
    authenticatedPage: page,
    createProject,
}) => {
    // Saving and reloading the project takes most of a minute in Firefox.
    test.setTimeout(90_000);
    const uuid = await createProject(page, 'Checklist logo');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'checklist');
    const id = await page.locator('.idevice_node.checklist').first().getAttribute('id');
    expect(id).toBeTruthy();

    await page.locator('#gameQEIdeviceForm-tab-options').click();
    await expect(page.locator('#ctjLogo')).not.toBeChecked();
    await expect(page.locator('#ctjlogologo')).toBeHidden();
    await page.locator('#ctjLogo').check();
    await expect(page.locator('#ctjlogologo')).toBeVisible();
    await page.locator('#gameQEIdeviceForm-tab-contents').click();
    await page.locator('#ctjTitle').fill('My tasks');
    await page.locator('.CTJ-data-row .CTJ-Level1').first().click();
    await page.keyboard.type('Read the text');

    await saveIdevice(page, id!);
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await page.locator('#gameQEIdeviceForm-tab-options').click();
    await expect(page.locator('#ctjLogo')).toBeChecked();
    await expect(page.locator('#ctjlogologo')).toBeVisible();
    await page.locator('#gameQEIdeviceForm-tab-contents').click();
    await expect(page.locator('.CTJ-data-row .CTJ-Level1').first()).toHaveText('Read the text');
});
