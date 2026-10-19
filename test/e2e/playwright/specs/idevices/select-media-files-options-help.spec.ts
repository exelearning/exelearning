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

test('Select media files explains its options inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Select media files option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'select-media-files');
    const device = page.locator('.idevice_node.select-media-files').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    await page.locator('#gameQEIdeviceForm-tab-options').click();
    const help = page.locator('#slcmEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(9);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#slcmEOptions .help-content:visible')).toHaveCount(0);
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
            await page.locator('#gameQEIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const tableHelp = page
        .locator('#slcmEOptions .d-flex')
        .filter({ has: page.locator('#slcmEModeTable') })
        .locator('.exe-idevice-help');
    await tableHelp.click();
    await page.locator(`#${await tableHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#slcmEModeTable')).not.toBeChecked();
    await tableHelp.press('Escape');

    await page.locator('#slcmEModeTable').check();
    await page.locator('#slcmEAttemptsNumber').fill('3');

    await page.locator('#gameQEIdeviceForm-tab-contents').click();
    await page.locator('#slcmEDefinition').fill('Choose the animal');
    await page.locator('#slcmEPhrase .SLCME-EText').first().fill('Cat');
    await page.locator('#slcmEPhrase .SLCME-EState').first().check();

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('select-media-files');
    expect(stored.html).toContain('seleccionamedias-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#gameQEIdeviceForm-tab-options').click();
    await expect(page.locator('#slcmEModeTable')).toBeChecked();
    await expect(page.locator('#slcmEAttemptsNumber')).toHaveValue('3');
    await page.locator('#gameQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#slcmEDefinition')).toHaveValue('Choose the animal');
    await expect(page.locator('#slcmEPhrase .SLCME-EText').first()).toHaveValue('Cat');
    await expect(page.locator('#slcmEPhrase .SLCME-EState').first()).toBeChecked();
});
