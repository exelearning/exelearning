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

test('Video test explains its options inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Video test option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    // The YouTube player is not needed to check the form.
    await page.route('https://www.youtube.com/iframe_api', route => route.abort());
    await addIdevice(page, 'quick-questions-video');
    const device = page.locator('.idevice_node.quick-questions-video').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    await page.locator('#vquextQEIdeviceForm-tab-options').click();
    const help = page.locator('#vquextEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(13);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#vquextEOptions .help-content:visible')).toHaveCount(0);
            const sameLine = await button.evaluate(element => {
                const row = element.closest('.d-flex')!;
                const control = row.querySelector('input, select')!;
                const a = element.getBoundingClientRect();
                const b = control.getBoundingClientRect();
                let previous = element.parentElement!.previousElementSibling!;
                while (!previous.getClientRects().length) previous = previous.previousElementSibling!;
                const gap = a.left - previous.getBoundingClientRect().right;
                return a.top < b.bottom && b.top < a.bottom && gap >= 0 && gap <= 24;
            });
            expect(sameLine).toBe(true);
            await button.click();
            await expect(page.getByRole('tooltip')).toHaveCount(0);
            const content = page.locator(`#${await button.getAttribute('aria-controls')}`);
            await expect(content).toBeVisible();
            const fitsInThePanel = await content.evaluate(element => {
                const rect = element.getBoundingClientRect();
                const icon = element.parentElement!.querySelector('button')!.getBoundingClientRect();
                const panel = element.closest('.tab-pane')!.getBoundingClientRect();
                return (
                    Math.abs(rect.left - icon.left) < 2 &&
                    rect.left >= panel.left &&
                    rect.right <= Math.min(panel.right, window.innerWidth) &&
                    element.scrollWidth <= element.clientWidth
                );
            });
            expect(fitsInThePanel).toBe(true);
            await page.locator('#vquextQEIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const navigableHelp = page
        .locator('#vquextEOptions .d-flex')
        .filter({ has: page.locator('#vquextENavigable') })
        .locator('.exe-idevice-help');
    await navigableHelp.click();
    await page.locator(`#${await navigableHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#vquextENavigable')).not.toBeChecked();
    await navigableHelp.press('Escape');

    // No score is nothing but the feedback: it stays on and has to be written.
    await page.locator('#vquextETypeReto').check();
    await page.locator('#vquextQEIdeviceForm-tab-feedback').click();
    await expect(page.locator('#eXeGameHasFeedBack')).toBeChecked();
    await expect(page.locator('#eXeGameHasFeedBack')).toBeDisabled();
    await page.locator('#vquextQEIdeviceForm-tab-options').click();
    await page.locator('#vquextETypeActivity').check();
    await page.locator('#vquextQEIdeviceForm-tab-feedback').click();
    await expect(page.locator('#eXeGameHasFeedBack')).toBeEnabled();
    await expect(page.locator('#eXeGameHasFeedBack')).not.toBeChecked();

    await page.locator('#vquextQEIdeviceForm-tab-options').click();
    await page.locator('#vquextENavigable').check();
    await page.locator('#vquextEPauseVideo').check();

    await page.locator('#vquextQEIdeviceForm-tab-contents').click();
    await page.locator('#vquextEVIURL').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.locator('#vquextEVIEnd').fill('00:01:00');
    await page.locator('#vquextPoint').fill('00:00:10');
    await page.locator('#vquextEQuestion').fill('What is the capital of France?');
    await page.locator('#vquextEOption0').fill('Paris');
    await page.locator('#vquextEOption1').fill('London');
    await page.locator('#vquextEOption2').fill('Rome');
    await page.locator('#vquextEOption3').fill('Berlin');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('quick-questions-video');
    expect(stored.html).toContain('vquext-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#vquextQEIdeviceForm-tab-options').click();
    await expect(page.locator('#vquextENavigable')).toBeChecked();
    await expect(page.locator('#vquextEPauseVideo')).toBeChecked();
    await page.locator('#vquextQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#vquextEQuestion')).toHaveValue('What is the capital of France?');
    await expect(page.locator('#vquextPoint')).toHaveValue('00:00:10');
});
