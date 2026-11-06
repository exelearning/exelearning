import { test, expect } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';

test('Video test with no score keeps its feedback on, to be written', async ({
    authenticatedPage: page,
    createProject,
}) => {
    // The YouTube player is not needed to check the form.
    await page.route('https://www.youtube.com/iframe_api', route => route.abort());
    const uuid = await createProject(page, 'Video test feedback');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'quick-questions-video');

    // No score is nothing but the feedback: it stays on and has to be written.
    await page.locator('#vquextQEIdeviceForm-tab-options').click();
    await page.locator('#vquextETypeReto').check();
    await page.locator('#vquextQEIdeviceForm-tab-feedback').click();
    await expect(page.locator('#eXeGameHasFeedBack')).toBeChecked();
    await expect(page.locator('#eXeGameHasFeedBack')).toBeDisabled();
    await page.locator('#vquextQEIdeviceForm-tab-options').click();
    await page.locator('#vquextETypeActivity').check();
    await page.locator('#vquextQEIdeviceForm-tab-feedback').click();
    await expect(page.locator('#eXeGameHasFeedBack')).toBeEnabled();
    await expect(page.locator('#eXeGameHasFeedBack')).not.toBeChecked();
});
