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

test('Quick Questions explains each option inline without changing its value', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(90000);
    const uuid = await createProject(page, 'Quick Questions option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'quick-questions');
    const device = page.locator('.idevice_node.quick-questions').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();
    await page.locator('#quextEQuestion').fill('What is the capital of France?');
    await page.locator('#quextEOption0').fill('Paris');
    await page.locator('#quextEOption1').fill('London');
    await page.locator('#quextEOption2').fill('Rome');
    await page.locator('#quextEOption3').fill('Berlin');
    await page.locator('#gameQEIdeviceForm-tab-options').click();
    const help = page.locator('#quextEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(10);
    for (const button of await help.all()) {
        await button.hover();
        await expect(page.getByRole('tooltip')).toHaveText('Information');
        await expect(page.locator('#quextEOptions .help-content:visible')).toHaveCount(0);
        const sameLine = await button.evaluate(element => {
            const row = element.closest('.toggle-item, .form-check, .d-flex')!;
            const control = row.querySelector('input, select')!;
            const a = element.getBoundingClientRect();
            const b = control.getBoundingClientRect();
            const previous = element.parentElement!.previousElementSibling!.getBoundingClientRect();
            const gap = a.left - previous.right;
            return a.top < b.bottom && b.top < a.bottom && gap >= 0 && gap <= 24;
        });
        expect(sameLine).toBe(true);
        await button.click();
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        const content = page.locator(`#${await button.getAttribute('aria-controls')}`);
        await expect(content).toBeVisible();
        const opensToTheRight = await content.evaluate(element => {
            const rect = element.getBoundingClientRect();
            const icon = element.parentElement!.querySelector('button')!.getBoundingClientRect();
            const panel = element.closest('.tab-pane')!.getBoundingClientRect();
            return Math.abs(rect.left - icon.left) < 2 && rect.left >= panel.left && rect.right <= window.innerWidth;
        });
        expect(opensToTheRight).toBe(true);
        await page.locator('#gameQEIdeviceForm-tab-options').hover();
        await expect(content).toBeVisible();
        await expect(button).toHaveAttribute('aria-expanded', 'true');
        await button.press('Escape');
        await expect(content).toBeHidden();
    }
    const randomHelp = page
        .locator('#quextEOptions')
        .locator('.d-flex')
        .filter({ has: page.locator('#quextEQuestionsRamdon') })
        .locator('.exe-idevice-help');
    await randomHelp.focus();
    await expect(page.getByRole('tooltip')).toHaveText((await randomHelp.getAttribute('aria-label')) as string);
    await randomHelp.click();
    await expect(page.locator('#quextEQuestionsRamdon')).not.toBeChecked();
    const randomContent = page.locator(`#${await randomHelp.getAttribute('aria-controls')}`);
    await expect(randomContent).toBeVisible();
    await expect(randomContent).toContainText('Random questions:');
    await expect(randomContent).toContainText('Random options:');
    await help.first().click();
    await expect(randomContent).toBeHidden();
    await expect(page.locator('#quextEOptions .help-content:visible')).toHaveCount(1);
    await page.locator('#gameQEIdeviceForm-tab-options').click();
    await expect(page.locator('#quextEOptions .help-content:visible')).toHaveCount(0);
    await page.locator('#quextEQuestionsRamdon').check();
    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('quick-questions');
    expect(stored.html).toContain('quext-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await page.locator('#gameQEIdeviceForm-tab-options').click();
    await expect(page.locator('#quextEQuestionsRamdon')).toBeChecked();
    await randomHelp.hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
});
