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

test('Periodic table explains its settings inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Periodic table option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'periodic-table');
    const device = page.locator('.idevice_node.periodic-table').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    // What learners do is set in Questions; how the game behaves, in Options.
    for (const [tab, container, count] of [
        ['contents', '#ptEPanel', 4],
        ['options', '#ptEOptions', 3],
    ] as const) {
        await page.locator(`#ptQEIdeviceForm-tab-${tab}`).click();
        const help = page.locator(`${container} .exe-idevice-help:visible`);
        await expect(help).toHaveCount(count);
        for (const width of [1280, 1024]) {
            await page.setViewportSize({ width, height: 900 });
            for (const button of await help.all()) {
                await button.hover();
                await expect(page.getByRole('tooltip')).toHaveText('Information');
                await expect(page.locator(`${container} .help-content:visible`)).toHaveCount(0);
                const sameLine = await button.evaluate(element => {
                    const row = element.closest('.d-flex')!;
                    const control = row.querySelector('input, select')!;
                    const a = element.getBoundingClientRect();
                    const b = control.getBoundingClientRect();
                    // The data to complete keeps two of its switches hidden.
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
                await page.locator(`#ptQEIdeviceForm-tab-${tab}`).hover();
                await expect(content).toBeVisible();
                await expect(button).toHaveAttribute('aria-expanded', 'true');
                await button.press('Escape');
                await expect(content).toBeHidden();
            }
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const minimizeHelp = page
        .locator('#ptEOptions .d-flex')
        .filter({ hasText: 'Show minimized' })
        .locator('.exe-idevice-help');
    await minimizeHelp.click();
    await page.locator(`#${await minimizeHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#ptEShowMinimize')).not.toBeChecked();
    await minimizeHelp.press('Escape');

    await page.locator('#ptEShowMinimize').check();
    await page.locator('#ptEAttemptsNumber').fill('3');

    // The Complete mode asks for the data to fill in instead of the type.
    await page.locator('#ptQEIdeviceForm-tab-contents').click();
    await page.locator('#ptEComplete').check();
    await expect(page.locator('#ptGameType')).toBeHidden();
    const completeHelp = page.locator('#ptCompleteData .exe-idevice-help');
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        await completeHelp.click();
        const content = page.locator(`#${await completeHelp.getAttribute('aria-controls')}`);
        await expect(content).toBeVisible();
        const fitsInThePanel = await content.evaluate(element => {
            const rect = element.getBoundingClientRect();
            const panel = element.closest('.tab-pane')!.getBoundingClientRect();
            return rect.right <= panel.right && element.scrollWidth <= element.clientWidth;
        });
        expect(fitsInThePanel).toBe(true);
        await completeHelp.press('Escape');
    }
    await page.locator('#ptEname').check();

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('periodic-table');
    expect(stored.html).toContain('periodic-table-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#ptQEIdeviceForm-tab-options').click();
    await expect(page.locator('#ptEShowMinimize')).toBeChecked();
    await expect(page.locator('#ptEAttemptsNumber')).toHaveValue('3');
    await page.locator('#ptQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#ptEComplete')).toBeChecked();
    await expect(page.locator('#ptCompleteData')).toBeVisible();
    await expect(page.locator('#ptEname')).toBeChecked();
    await expect(page.locator('#ptEsymbol')).toBeChecked();
});
