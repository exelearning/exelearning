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

test('Classify explains options inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(90000);
    const uuid = await createProject(page, 'Classify option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'classify');
    const device = page.locator('.idevice_node.classify').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    // Fill valid card data in contents tab (select Text card and write content)
    await page.locator('#clasificaEMediaText').check();
    await page.locator('#clasificaEText').fill('Card text 1');

    // Test the option help in Options tab
    await page.locator('#clasificaQEIdeviceForm-tab-options').click();
    const optionHelp = page.locator('#clasificaEOptions .exe-idevice-help:visible');
    await expect(optionHelp).toHaveCount(7);

    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await optionHelp.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#clasificaEOptions .help-content:visible')).toHaveCount(0);
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
            await page.locator('#clasificaQEIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Verify clicking help does not toggle switches
    const customMsgHelp = page.locator('#clasificaECustomMessagesDiv .exe-idevice-help');
    await customMsgHelp.click();
    await expect(page.locator('#clasificaECustomMessages')).not.toBeChecked();
    await customMsgHelp.press('Escape');

    const minimizeHelp = page
        .locator('#clasificaEOptions .d-flex')
        .filter({ hasText: 'Show minimized' })
        .locator('.exe-idevice-help');
    await minimizeHelp.click();
    await expect(page.locator('#clasificaEShowMinimize')).not.toBeChecked();
    await minimizeHelp.press('Escape');

    // Check Show minimize before saving
    await page.locator('#clasificaEShowMinimize').check();

    // Save iDevice and verify clean output without help controls
    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('classify');
    expect(stored.html).toContain('clasifica-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    // Reload and verify persistence of settings
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#clasificaQEIdeviceForm-tab-options').click();
    await expect(page.locator('#clasificaEShowMinimize')).toBeChecked();

    await page.locator('#clasificaQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#clasificaEText')).toHaveValue('Card text 1');
});
