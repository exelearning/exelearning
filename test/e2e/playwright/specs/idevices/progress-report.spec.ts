import { test, expect } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';

test('Progress report lists the pages that "Show" asks for as soon as an option is picked', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Progress report show');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'progress-report');

    // A page with no assessable activity drops out of "Only pages with evaluable activities".
    await page.locator('#reportQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#informeERefresh')).toBeVisible();
    const firstPage = page.locator('#informeEPages .IFPE-PageItem').first();
    await expect(firstPage).toBeVisible();
    await page.locator('#showtype2').check();
    await expect(firstPage).toBeHidden();
    await page.locator('#showtype0').check();
    await expect(firstPage).toBeVisible();
});
