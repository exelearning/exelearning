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

test('Multiple Choice explains each option inline without changing its value', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(90000);
    const uuid = await createProject(page, 'Multiple Choice option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'quick-questions-multiple-choice');
    const device = page.locator('.idevice_node.quick-questions-multiple-choice').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();
    await page.locator('#seleccionaEQuestion').fill('What is the capital of France?');
    await page.locator('#seleccionaEOption0').fill('Paris');
    await page.locator('#seleccionaEOption1').fill('London');
    await page.locator('#seleccionaEOption2').fill('Rome');
    await page.locator('#seleccionaEOption3').fill('Berlin');
    await page.locator('#seleccionaESolution0').check();
    await page.locator('#quickMultipleQEIdeviceForm-tab-options').click();
    const help = page.locator('#seleccionaEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(13);
    for (const button of await help.all()) {
        await button.hover();
        await expect(page.getByRole('tooltip')).toHaveText('Information');
        await expect(page.locator('#seleccionaEOptions .help-content:visible')).toHaveCount(0);
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
        await page.locator('#quickMultipleQEIdeviceForm-tab-options').hover();
        await expect(content).toBeVisible();
        await expect(button).toHaveAttribute('aria-expanded', 'true');
        await button.press('Escape');
        await expect(content).toBeHidden();
    }
    const orderHelp = page
        .locator('#seleccionaEOptions')
        .locator('.d-flex')
        .filter({ has: page.locator('#seleccionaEOrderLinear') })
        .locator('.exe-idevice-help');
    await orderHelp.focus();
    await expect(page.getByRole('tooltip')).toHaveText((await orderHelp.getAttribute('aria-label')) as string);
    await orderHelp.click();
    await expect(page.locator('#seleccionaEOrderLinear')).toBeChecked();
    const orderContent = page.locator(`#${await orderHelp.getAttribute('aria-controls')}`);
    await expect(orderContent).toBeVisible();
    await expect(orderContent).toContainText('Default:');
    await expect(orderContent).toContainText('Random:');
    await expect(orderContent).toContainText('Tree:');
    await help.first().click();
    await expect(orderContent).toBeHidden();
    await expect(page.locator('#seleccionaEOptions .help-content:visible')).toHaveCount(1);
    await page.locator('#quickMultipleQEIdeviceForm-tab-options').click();
    await expect(page.locator('#seleccionaEOptions .help-content:visible')).toHaveCount(0);
    await page.locator('#seleccionaEAnswersRamdon').check();
    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('quick-questions-multiple-choice');
    expect(stored.html).toContain('selecciona-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await page.locator('#quickMultipleQEIdeviceForm-tab-options').click();
    await expect(page.locator('#seleccionaEAnswersRamdon')).toBeChecked();
    await orderHelp.hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
});
