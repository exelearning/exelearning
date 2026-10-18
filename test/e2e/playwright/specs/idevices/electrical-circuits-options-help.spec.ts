import { test, expect } from '../../fixtures/auth.fixture';
import {
    editIdevice,
    expandIdeviceCategory,
    gotoWorkarea,
    reloadPage,
    saveIdevice,
    saveProject,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

async function dismissBetaWarningIfPresent(page: Page): Promise<void> {
    const betaClose = page.locator('#eXeBetaWarningCloseBtn');
    if (await betaClose.isVisible()) {
        await betaClose.click();
    }
}

async function addElectricalCircuitsIdevice(page: Page): Promise<void> {
    await expandIdeviceCategory(page, /Science|Ciencia/i);

    const menuItem = page.locator('.idevice_item[id="electrical-circuits"]').first();
    await menuItem.waitFor({ state: 'visible', timeout: 10000 });
    await menuItem.click();

    const editForm = page.locator('#electricalCircuitsIdeviceForm');
    await editForm.waitFor({ state: 'visible', timeout: 15000 });

    await dismissBetaWarningIfPresent(page);
}

test('Electrical circuits explains each option inline without changing its value', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(90000);
    const uuid = await createProject(page, 'Electrical circuits option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addElectricalCircuitsIdevice(page);
    const id = await page
        .locator('#electricalCircuitsIdeviceForm')
        .evaluate(el => el.closest('.idevice_node')?.getAttribute('id'));
    expect(id).toBeTruthy();

    await page.locator('#electricalCircuitsIdeviceForm-tab-options').click();
    const help = page.locator('#elceOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(8);

    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#elceOptions .help-content:visible')).toHaveCount(0);
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
            await page.locator('#electricalCircuitsIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    const randomQuestionsHelp = page
        .locator('#elceOptions')
        .locator('.d-flex')
        .filter({ has: page.locator('#elceQuestionsRandom') })
        .locator('.exe-idevice-help');
    await randomQuestionsHelp.focus();
    await expect(page.getByRole('tooltip')).toHaveText(
        (await randomQuestionsHelp.getAttribute('aria-label')) as string,
    );
    await randomQuestionsHelp.click();
    await expect(page.locator('#elceQuestionsRandom')).not.toBeChecked();
    const randomContent = page.locator(`#${await randomQuestionsHelp.getAttribute('aria-controls')}`);
    await expect(randomContent).toBeVisible();
    await help.first().click();
    await expect(randomContent).toBeHidden();
    await expect(page.locator('#elceOptions .help-content:visible')).toHaveCount(1);
    await page.locator('#electricalCircuitsIdeviceForm-tab-options').click();
    await expect(page.locator('#elceOptions .help-content:visible')).toHaveCount(0);

    await page.locator('#elceQuestionsRandom').check();
    await page.locator('#elcePercentajeQuestionsValue').fill('80');

    const minimizeHelp = page
        .locator('#elceOptions > .d-flex')
        .filter({ has: page.locator('#elceShowMinimize') })
        .locator('.exe-idevice-help');
    await minimizeHelp.click();
    const minimizeContent = page.locator(`#${await minimizeHelp.getAttribute('aria-controls')}`);
    await expect(minimizeContent).toBeVisible();
    await minimizeHelp.press('Escape');
    await expect(minimizeContent).toBeHidden();

    await page.locator('#electricalCircuitsIdeviceForm-tab-contents').click();
    await page.locator('#elceTikzCode').fill('');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('electrical-circuits');
    expect(stored.html).toContain('electrical-circuits-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await dismissBetaWarningIfPresent(page);
    await page.locator('#electricalCircuitsIdeviceForm-tab-options').click();
    await expect(page.locator('#elceQuestionsRandom')).toBeChecked();
    await expect(page.locator('#elcePercentajeQuestionsValue')).toHaveValue('80');
    await randomQuestionsHelp.hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
});
