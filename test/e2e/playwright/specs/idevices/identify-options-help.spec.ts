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

test('Identify explains options inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(90000);
    const uuid = await createProject(page, 'Identify option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'identify');
    const device = page.locator('.idevice_node.identify').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    // A complete question, so the iDevice can be saved.
    await page.locator('#idfEQuestion').fill('Who am I?');
    await page.locator('#idfESolution').fill('Mercury');
    await page.locator('#idfEPista0').fill('Closest planet to the Sun');
    await page.locator('#idfEPista1').fill('Smallest planet');
    await page.locator('#idfEPista2').fill('Named after a Roman god');
    await page.locator('#idfEPista3').fill('No moons');

    await page.locator('#identifyQEIdeviceForm-tab-options').click();
    const optionHelp = page.locator('#idfEOptions .exe-idevice-help:visible');
    await expect(optionHelp).toHaveCount(6);

    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await optionHelp.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#idfEOptions .help-content:visible')).toHaveCount(0);
            const sameLine = await button.evaluate(element => {
                const row = element.closest('.d-flex')!;
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
            await page.locator('#identifyQEIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const advancedHelp = page
        .locator('#idfEOptions .d-flex')
        .filter({ hasText: 'Advanced mode' })
        .locator('.exe-idevice-help');
    await advancedHelp.click();
    await page.locator(`#${await advancedHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#idfESAvancedMode')).toBeChecked();
    await advancedHelp.press('Escape');

    await page.locator('#idfEShowMinimize').check();
    await page.locator('#idfESAvancedMode').uncheck();

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('identify');
    expect(stored.html).toContain('identifica-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#identifyQEIdeviceForm-tab-options').click();
    await expect(page.locator('#idfEShowMinimize')).toBeChecked();
    await expect(page.locator('#idfESAvancedMode')).not.toBeChecked();

    await page.locator('#identifyQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#idfESolution')).toHaveValue('Mercury');
    await expect(page.locator('#idfEPista3')).toHaveValue('No moons');
});
