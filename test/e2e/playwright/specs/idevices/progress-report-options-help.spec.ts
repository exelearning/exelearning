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

test('Progress report explains its options inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Progress report option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'progress-report');
    const device = page.locator('.idevice_node.progress-report').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    await page.locator('#reportQEIdeviceForm-tab-options').click();
    const help = page.locator('#informeEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(6);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#informeEOptions .help-content:visible')).toHaveCount(0);
            const sameLine = await button.evaluate(element => {
                const row = element.closest('.d-flex')!;
                const previousElement = element.parentElement!.previousElementSibling!;
                const control = row.querySelector('input, select') || previousElement;
                const a = element.getBoundingClientRect();
                const b = control.getBoundingClientRect();
                const previous = previousElement.getBoundingClientRect();
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
            await page.locator('#reportQEIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const linksHelp = page
        .locator('#informeEOptions .d-flex')
        .filter({ has: page.locator('#informeEActiveLinks') })
        .locator('.exe-idevice-help');
    await linksHelp.click();
    await page.locator(`#${await linksHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#informeEActiveLinks')).toBeChecked();
    await linksHelp.press('Escape');

    await page.locator('#informeEEvaluationID').fill('unit-one');
    await page.locator('#informeEActiveLinks').uncheck();
    await page.locator('#showtype2').check();

    // The iDevices it reports are listed in the Questions tab.
    await page.locator('#reportQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#informeERefresh')).toBeVisible();
    await expect(page.locator('#informeEPages')).toBeAttached();

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('progress-report');
    expect(stored.html).toContain('informe-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#reportQEIdeviceForm-tab-options').click();
    await expect(page.locator('#informeEEvaluationID')).toHaveValue('unit-one');
    await expect(page.locator('#informeEActiveLinks')).not.toBeChecked();
    await expect(page.locator('#showtype2')).toBeChecked();
});
