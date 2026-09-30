import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth.fixture';
import { COMPONENT_IDS, openPage, projectWithTwoCopies, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Checklist keeps what is ticked to its own list across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const errors = await projectWithTwoCopies(page, createProject, {
        type: 'checklist',
        html: storedIdevice('checklist').html,
        dataGame: 'listacotejo',
        change: data => {
            data.saveData = true;
            // The editor writes the checklist's own component id into its data;
            // a duplicate carries the original's until it is edited. The list
            // used to be kept under that id, so the copy came back with what was
            // ticked on the original.
            data.id = COMPONENT_IDS[0];
        },
    });
    const item = page.locator('#ctjItems-0 input[type="checkbox"]').first();

    await openPage(page, 'First game', '#ctjMainContainer-0');
    await item.check();
    const firstList = await page.locator('#ctjMainContainer-0').elementHandle();

    await openPage(page, 'Second game', '#ctjMainContainer-0');
    await page.waitForFunction(element => !element?.isConnected, firstList);
    await expect(page.locator('#ctjMainContainer-0')).toBeVisible();
    await expect(item, 'the second list came back with what was ticked on the first').not.toBeChecked();

    // Its own list, still there for it.
    const secondList = await page.locator('#ctjMainContainer-0').elementHandle();
    await openPage(page, 'First game', '#ctjMainContainer-0');
    await page.waitForFunction(element => !element?.isConnected, secondList);
    await expect(page.locator('#ctjMainContainer-0')).toBeVisible();
    await expect(item, 'the first list lost what was ticked on it').toBeChecked();
    expect(errors, 'the page threw').toEqual([]);
});
