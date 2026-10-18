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

test('BeforeAfter explains options and card settings inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(90000);
    const uuid = await createProject(page, 'BeforeAfter option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'beforeafter');
    const device = page.locator('.idevice_node.beforeafter').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    // Fill minimum card data so the activity is valid for saving
    await page.locator('#bfafEDescription').fill('City view comparison');
    await page.locator('#bfafEURLImageBack').fill('before.jpg');
    await page.locator('#bfafEURLImage').fill('after.jpg');

    // Test the option help in Options tab
    await page.locator('#beforeAfterQIdeviceForm-tab-options').click();
    const optionHelp = page.locator('#bfafEOptions .exe-idevice-help:visible');
    await expect(optionHelp).toHaveCount(1);

    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await optionHelp.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#bfafEOptions .help-content:visible')).toHaveCount(0);
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
                return (
                    Math.abs(rect.left - icon.left) < 2 &&
                    rect.left >= panel.left &&
                    rect.right <= Math.min(panel.right, window.innerWidth) &&
                    element.scrollWidth <= element.clientWidth
                );
            });
            expect(opensToTheRight).toBe(true);
            await page.locator('#beforeAfterQIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Verify clicking help does not toggle Show minimize
    const minimizeHelp = optionHelp.first();
    await minimizeHelp.click();
    await expect(page.locator('#bfafEShowMinimize')).not.toBeChecked();
    const minimizeContent = page.locator(`#${await minimizeHelp.getAttribute('aria-controls')}`);
    await expect(minimizeContent).toBeVisible();
    await minimizeHelp.press('Escape');
    await expect(minimizeContent).toBeHidden();

    // Check Show minimize and switch to contents (cards) tab
    await page.locator('#bfafEShowMinimize').check();
    await page.locator('#beforeAfterQIdeviceForm-tab-contents').click();

    // Verify card settings help buttons (Vertical orientation and Position)
    const cardHelp = page.locator('#bfafEPanel .exe-idevice-help:visible');
    await expect(cardHelp).toHaveCount(2);

    for (const button of await cardHelp.all()) {
        await button.hover();
        await expect(page.getByRole('tooltip')).toHaveText('Information');
        await button.click();
        const content = page.locator(`#${await button.getAttribute('aria-controls')}`);
        await expect(content).toBeVisible();
        await button.press('Escape');
        await expect(content).toBeHidden();
    }

    // Save iDevice and verify clean output without help controls
    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('beforeafter');
    expect(stored.html).toContain('beforeafter-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    // Reload and verify persistence of settings
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#beforeAfterQIdeviceForm-tab-options').click();
    await expect(page.locator('#bfafEShowMinimize')).toBeChecked();

    await page.locator('#beforeAfterQIdeviceForm-tab-contents').click();
    await expect(page.locator('#bfafEDescription')).toHaveValue('City view comparison');
});
