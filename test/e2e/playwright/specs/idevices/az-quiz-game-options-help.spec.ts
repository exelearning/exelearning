import { test, expect } from '../../fixtures/auth.fixture';
import {
    addIdevice,
    editIdevice,
    getPreviewFrame,
    gotoWorkarea,
    openPreviewPanel,
    reloadPage,
    saveIdevice,
    saveProject,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

test('A-Z quiz explains each options row without changing its controls', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(90000);
    const uuid = await createProject(page, 'A-Z quiz option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'az-quiz-game');
    const device = page.locator('.idevice_node.az-quiz-game').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();
    await page.locator('.roscoWordEdition').first().fill('Apple');
    await page.locator('.roscoDefinitionEdition').first().fill('A fruit that grows on trees');
    const optionsTab = page.locator('#roscoIdeviceForm-tab-options');
    await optionsTab.click();
    const rows = page.locator('#roscoOptions > div');
    await expect(rows).toHaveCount(6);
    for (const row of await rows.all()) {
        const button = row.locator('.exe-idevice-help');
        await expect(button).toHaveCount(1);
        const before = await row
            .locator('input')
            .evaluateAll(inputs => inputs.map(input => [input.value, input.checked, input.disabled]));
        await button.hover();
        await expect(page.getByRole('tooltip')).toHaveText('Information');
        await expect(page.locator('#roscoOptions .help-content:visible')).toHaveCount(0);
        const adjacent = await button.evaluate(element => {
            const icon = element.getBoundingClientRect();
            const previous = element.parentElement!.previousElementSibling!.getBoundingClientRect();
            const gap = icon.left - previous.right;
            return icon.top < previous.bottom && previous.top < icon.bottom && gap >= 0 && gap <= 24;
        });
        expect(adjacent).toBe(true);
        await button.click();
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        const content = page.locator(`#${await button.getAttribute('aria-controls')}`);
        await expect(content).toBeVisible();
        const opensToTheRight = await content.evaluate(element => {
            const rect = element.getBoundingClientRect();
            const icon = element.parentElement!.querySelector('button')!.getBoundingClientRect();
            const panel = element.closest('.tab-pane')!.getBoundingClientRect();
            return Math.abs(rect.left - icon.left) < 2 && rect.left >= panel.left && rect.right <= panel.right;
        });
        expect(opensToTheRight).toBe(true);
        await optionsTab.hover();
        await expect(content).toBeVisible();
        await button.click();
        await expect(content).toBeVisible();
        expect(
            await row
                .locator('input')
                .evaluateAll(inputs => inputs.map(input => [input.value, input.checked, input.disabled])),
        ).toEqual(before);
        await button.press('Escape');
        await expect(content).toBeHidden();
    }
    const solutionsHelp = page.locator('.roscoShowSolutionRow .exe-idevice-help');
    const solutionsContent = page.locator(`#${await solutionsHelp.getAttribute('aria-controls')}`);
    await solutionsHelp.focus();
    await expect(page.getByRole('tooltip')).toHaveText('Information');
    await solutionsHelp.click();
    await expect(solutionsContent).toContainText('Show solutions:');
    await expect(solutionsContent).toContainText('Show solution in:');
    await expect(page.locator('#roscoShowSolution')).toBeChecked();
    await expect(page.locator('#roscoTimeShowSolution')).toBeEnabled();
    await rows.first().locator('.exe-idevice-help').click();
    await expect(solutionsContent).toBeHidden();
    await expect(page.locator('#roscoOptions .help-content:visible')).toHaveCount(1);
    await optionsTab.click();
    await expect(page.locator('#roscoOptions .help-content:visible')).toHaveCount(0);
    await page.locator('#roscoDuration').fill('120');
    await page.locator('#roscoNumberTurns').fill('0');
    await page.locator('#roscoCaseSensitive').check();
    await page.locator('#roscoShowSolution').uncheck();
    await solutionsHelp.click();
    await expect(solutionsContent).toBeVisible();
    await expect(page.locator('#roscoTimeShowSolution')).toBeDisabled();
    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('az-quiz-game');
    expect(stored.html).toContain('rosco-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');
    await saveProject(page);
    await page.locator('#head-bottom-preview').click();
    await openPreviewPanel(page);
    const frame = getPreviewFrame(page);
    await expect(frame.locator('.rosco-MainContainer')).toBeVisible();
    await expect(frame.locator('.exe-idevice-help')).toHaveCount(0);
    // The panel closes offscreen rather than becoming hidden in the DOM.
    await page.locator('#previewsidenavclose').click();
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await optionsTab.click();
    await expect(page.locator('#roscoDuration')).toHaveValue('120');
    await expect(page.locator('#roscoNumberTurns')).toHaveValue('0');
    await expect(page.locator('#roscoCaseSensitive')).toBeChecked();
    await expect(page.locator('#roscoShowSolution')).not.toBeChecked();
    await expect(page.locator('#roscoTimeShowSolution')).toBeDisabled();
    await solutionsHelp.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Information');
    await solutionsHelp.click();
    await expect(page.locator('.roscoShowSolutionRow .help-content')).toBeVisible();
});
