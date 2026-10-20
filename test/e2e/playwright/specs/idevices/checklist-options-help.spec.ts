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

test('Checklist explains its options inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Checklist option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'checklist');
    const device = page.locator('.idevice_node.checklist').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    await page.locator('#gameQEIdeviceForm-tab-options').click();
    const help = page.locator('#ctjEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(7);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#ctjEOptions .help-content:visible')).toHaveCount(0);
            const sameLine = await button.evaluate(element => {
                const row = element.closest('.d-flex')!;
                const control = row.querySelector('input')!;
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
            await page.locator('#gameQEIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const logoHelp = page
        .locator('#ctjEOptions .d-flex')
        .filter({ has: page.locator('#ctjLogo') })
        .locator('.exe-idevice-help');
    await logoHelp.click();
    await page.locator(`#${await logoHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#ctjLogo')).not.toBeChecked();
    await expect(page.locator('#ctjlogologo')).toBeHidden();
    await logoHelp.press('Escape');
    await page.locator('#ctjUserData').check();
    await page.locator('#ctjLogo').check();
    await expect(page.locator('#ctjlogologo')).toBeVisible();

    await page.locator('#gameQEIdeviceForm-tab-contents').click();
    await page.locator('#ctjTitle').fill('My tasks');
    await page.locator('.CTJ-data-row .CTJ-Level1').first().click();
    await page.keyboard.type('Read the text');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('checklist');
    expect(stored.html).toContain('listacotejo-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#gameQEIdeviceForm-tab-options').click();
    await expect(page.locator('#ctjUserData')).toBeChecked();
    await expect(page.locator('#ctjLogo')).toBeChecked();
    await expect(page.locator('#ctjlogologo')).toBeVisible();
    await page.locator('#gameQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#ctjTitle')).toHaveValue('My tasks');
    await expect(page.locator('.CTJ-data-row .CTJ-Level1').first()).toHaveText('Read the text');
});
