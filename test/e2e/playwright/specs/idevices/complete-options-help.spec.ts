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

test('Complete explains options inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(90000);
    const uuid = await createProject(page, 'Complete option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'complete');
    const device = page.locator('.idevice_node.complete').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    // Test the option help in Options tab
    await page.locator('#completeQEIdeviceForm-tab-options').click();
    const optionHelp = page.locator('#cmptEOptions .exe-idevice-help:visible');
    await expect(optionHelp).toHaveCount(11);

    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await optionHelp.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#cmptEOptions .help-content:visible')).toHaveCount(0);
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
            await page.locator('#completeQEIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Verify clicking help does not toggle switches
    const minimizeHelp = page
        .locator('#cmptEOptions .d-flex')
        .filter({ hasText: 'Show minimized' })
        .locator('.exe-idevice-help');
    await minimizeHelp.click();
    await expect(page.locator('#cmptEShowMinimize')).not.toBeChecked();
    await minimizeHelp.press('Escape');

    const solutionHelp = page
        .locator('#cmptEOptions .d-flex')
        .filter({ hasText: 'Show solutions' })
        .locator('.exe-idevice-help');
    await solutionHelp.click();
    await expect(page.locator('#cmptEShowSolution')).not.toBeChecked();
    await solutionHelp.press('Escape');

    // Check Show minimize before saving
    await page.locator('#cmptEShowMinimize').check();

    // Save iDevice and verify clean output without help controls
    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('complete');
    expect(stored.html).toContain('completa-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    // Reload and verify persistence of settings
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#completeQEIdeviceForm-tab-options').click();
    await expect(page.locator('#cmptEShowMinimize')).toBeChecked();
});
