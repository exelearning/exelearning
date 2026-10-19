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

test('Puzzle explains its settings inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Puzzle option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'puzzle');
    const device = page.locator('.idevice_node.puzzle').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    // Each puzzle is set in Questions; how the game behaves, in Options.
    for (const [tab, container, count] of [
        ['contents', '#puzzleEPanel', 7],
        ['options', '#puzzleEOptions', 3],
    ] as const) {
        await page.locator(`#puzzleIdeviceForm-tab-${tab}`).click();
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
                await page.locator(`#puzzleIdeviceForm-tab-${tab}`).hover();
                await expect(content).toBeVisible();
                await expect(button).toHaveAttribute('aria-expanded', 'true');
                await button.press('Escape');
                await expect(content).toBeHidden();
            }
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const minimizeHelp = page
        .locator('#puzzleEOptions .d-flex')
        .filter({ hasText: 'Show minimized' })
        .locator('.exe-idevice-help');
    await minimizeHelp.click();
    await page.locator(`#${await minimizeHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#puzzleEShowMinimize')).not.toBeChecked();
    await minimizeHelp.press('Escape');

    await page.locator('#puzzleEShowMinimize').check();
    await page.locator('#puzzleIdeviceForm-tab-contents').click();
    await page.locator('#puzzleEURLImageDefinition').fill('https://example.org/cat.jpg');
    await page.locator('#puzzleERows').selectOption('4');
    await page.locator('#puzzleEShowTime').check();
    await page.locator('#puzzleECluePuzzle').fill('Well done');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('puzzle');
    expect(stored.html).toContain('puzzle-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#puzzleIdeviceForm-tab-options').click();
    await expect(page.locator('#puzzleEShowMinimize')).toBeChecked();
    await page.locator('#puzzleIdeviceForm-tab-contents').click();
    await expect(page.locator('#puzzleEURLImageDefinition')).toHaveValue('https://example.org/cat.jpg');
    await expect(page.locator('#puzzleERows')).toHaveValue('4');
    await expect(page.locator('#puzzleEShowTime')).toBeChecked();
    await expect(page.locator('#puzzleECluePuzzle')).toHaveValue('Well done');
});
