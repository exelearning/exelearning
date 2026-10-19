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
import { waitForEditor } from '../../helpers/editor-helpers';

test('Trivial explains its settings inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(150000);
    const uuid = await createProject(page, 'Trivial option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await page.route('https://www.youtube.com/iframe_api', route => route.abort());
    await addIdevice(page, 'trivial');
    // The form is built when its question editor starts: wait, or what is
    // done first is lost.
    await waitForEditor(page, 'trivialEText');
    const device = page.locator('.idevice_node.trivial').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    // Topics and questions are set in Questions; how the game behaves, in Options.
    for (const [tab, container, count] of [
        ['contents', '#trivialEPanel', 1],
        ['options', '#trivialEOptions', 5],
    ] as const) {
        await page.locator(`#gameQEIdeviceForm-tab-${tab}`).click();
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
                await page.locator(`#gameQEIdeviceForm-tab-${tab}`).hover();
                await expect(content).toBeVisible();
                await expect(button).toHaveAttribute('aria-expanded', 'true');
                await button.press('Escape');
                await expect(content).toBeHidden();
            }
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const boardHelp = page
        .locator('#trivialEOptions .d-flex')
        .filter({ has: page.locator('#trivialModeBoard') })
        .locator('.exe-idevice-help');
    await boardHelp.click();
    await page.locator(`#${await boardHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#trivialModeBoard')).not.toBeChecked();
    await boardHelp.press('Escape');

    await page.locator('#trivialModeBoard').check();
    await page.locator('#trivialEShowMinimize').check();

    // Each topic needs its name and complete questions to save.
    await page.evaluate(() => {
        const edition = (window as any).$exeDevice;
        for (let topic = 0; topic < 2; topic++) {
            const question = edition.getCuestionDefault();
            question.quextion = `Question ${topic + 1}`;
            question.options = ['Right', 'Wrong', '', ''];
            question.numberOptions = 2;
            question.solution = 'A';
            edition.temas[topic] = [question];
        }
        edition.nombresTemas = ['Maths', 'History', '', '', '', ''];
        edition.showTema(0);
    });

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('trivial');
    expect(stored.html).toContain('trivial-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await waitForEditor(page, 'trivialEText');

    await page.locator('#gameQEIdeviceForm-tab-options').click();
    await expect(page.locator('#trivialModeBoard')).toBeChecked();
    await expect(page.locator('#trivialEShowMinimize')).toBeChecked();
    await page.locator('#gameQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#trivialNameTema')).toHaveValue('Maths');
    await expect(page.locator('#trivialEQuestion')).toHaveValue('Question 1');
});
