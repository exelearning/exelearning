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

test('Crossword explains each option inline without changing its value', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(90000);
    const uuid = await createProject(page, 'Crossword option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'crossword');
    const device = page.locator('.idevice_node.crossword').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    await page.locator('#ccgmESolutionWord').fill('EARTH');
    await page.locator('#ccgmEDefinitionWord').fill('Our home planet');
    await page.locator('#ccgmEAdd').click();
    await page.locator('#ccgmESolutionWord').fill('MOON');
    await page.locator('#ccgmEDefinitionWord').fill('Earth natural satellite');

    await page.locator('#ccgmQEIdeviceForm-tab-options').click();
    const help = page.locator('#ccgmEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(8);

    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#ccgmEOptions .help-content:visible')).toHaveCount(0);
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
            await page.locator('#ccgmQEIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    const caseHelp = page
        .locator('#ccgmEOptions')
        .locator('.d-flex')
        .filter({ has: page.locator('#ccgmECaseSensitive') })
        .locator('.exe-idevice-help');
    await caseHelp.focus();
    await expect(page.getByRole('tooltip')).toHaveText((await caseHelp.getAttribute('aria-label')) as string);
    await caseHelp.click();
    await expect(page.locator('#ccgmECaseSensitive')).not.toBeChecked();
    const caseContent = page.locator(`#${await caseHelp.getAttribute('aria-controls')}`);
    await expect(caseContent).toBeVisible();
    await help.first().click();
    await expect(caseContent).toBeHidden();
    await expect(page.locator('#ccgmEOptions .help-content:visible')).toHaveCount(1);
    await page.locator('#ccgmQEIdeviceForm-tab-options').click();
    await expect(page.locator('#ccgmEOptions .help-content:visible')).toHaveCount(0);

    await page.locator('#ccgmECaseSensitive').check();
    await page.locator('#ccgmETime').fill('15');

    const solutionHelp = page
        .locator('#ccgmEOptions > .d-flex')
        .filter({ has: page.locator('#ccgmEShowSolution') })
        .locator('.exe-idevice-help');
    await solutionHelp.click();
    const solutionContent = page.locator(`#${await solutionHelp.getAttribute('aria-controls')}`);
    await expect(solutionContent).toBeVisible();
    await solutionHelp.press('Escape');
    await expect(solutionContent).toBeHidden();

    // Export includes the word still on screen (MOON, not stored yet), in the format Import reads.
    await page.locator('#ccgmQEIdeviceForm-tab-contents').click();
    await page.locator('[data-exe-share="export"]').click();
    const downloading = page.waitForEvent('download');
    await page.locator('#eXeGameExportQuestions').click();
    const download = await downloading;
    const stream = await download.createReadStream();
    let exported = '';
    for await (const chunk of stream) exported += chunk.toString();
    expect(exported.split('\n')).toEqual(['EARTH#Our home planet', 'MOON#Earth natural satellite']);
    await page.keyboard.press('Escape');
    await expect(page.locator('#eXeShareModal-export')).toBeHidden();

    // The AI window says when nothing fits the game, and adds what does.
    const alert = page.locator('#modalAlert.show');
    await page.locator('[data-exe-share="ai"]').click();
    await page.locator('#eXeETabQuestions').click();
    await page.locator('#eXeEQuestionsArea').fill('SOLAR SYSTEM#The sun and its planets');
    await page.locator('#eXeESaveButton').click();
    await expect(alert).toContainText('Sorry, there are no questions for this type of activity.');
    await expect(alert).not.toContainText('added successfully');
    await alert.locator('.close').first().click();
    await expect(alert).toBeHidden();
    await expect(page.locator('#ccgmENumQuestions')).toHaveText('2');
    await page.locator('#eXeEQuestionsArea').fill('STAR#A sun far away');
    await page.locator('#eXeESaveButton').click();
    await expect(alert).toContainText('The questions have been added successfully');
    await alert.locator('.close').first().click();
    await expect(alert).toBeHidden();
    await expect(page.locator('#ccgmENumQuestions')).toHaveText('3');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('crossword');
    expect(stored.html).toContain('crucigrama-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await page.locator('#ccgmQEIdeviceForm-tab-options').click();
    await expect(page.locator('#ccgmECaseSensitive')).toBeChecked();
    await expect(page.locator('#ccgmETime')).toHaveValue('15');
    await caseHelp.hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.locator('#ccgmQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#ccgmENumQuestions')).toHaveText('3');
});
