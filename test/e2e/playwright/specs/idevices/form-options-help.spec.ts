import { test, expect } from '../../fixtures/auth.fixture';
import { waitForEditor } from '../../helpers/editor-helpers';
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

test('Form explains its options inline and imports its questions', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Form option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'form');
    const device = page.locator('.idevice_node.form').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();
    await waitForEditor(page, 'eXeGameInstructions');

    await page.locator('#formIdeviceForm-tab-options').click();
    const help = page.locator('#frmEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(5);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            const sameLine = await button.evaluate(element => {
                const row = element.closest('#frmEOptions > div')!;
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
                const panel = element.closest('.tab-pane')!.getBoundingClientRect();
                return (
                    rect.left >= panel.left &&
                    rect.right <= Math.min(panel.right, window.innerWidth) &&
                    element.scrollWidth <= element.clientWidth
                );
            });
            expect(fitsInThePanel).toBe(true);
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const answersHelp = page
        .locator('#frmEOptions > div')
        .filter({ has: page.locator('#checkAddBtnAnswers') })
        .locator('.exe-idevice-help');
    await answersHelp.click();
    await page.locator(`#${await answersHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#checkAddBtnAnswers')).toBeChecked();
    await answersHelp.press('Escape');
    await page.locator('#checkAddBtnAnswers').uncheck();
    await page.locator('#frmEShowSlider').check();
    await page.locator('#frmEQuestionsRandom').check();
    await page.locator('#frmETime').fill('5');
    await page.locator('#frmEPercentageQuestions').fill('50');

    // Import a real text file: each line becomes a question.
    await page.locator('#formIdeviceForm-tab-contents').click();
    await page.locator('[data-exe-share="import"]').click();
    await expect(page.locator('#eXeShareModal-import')).toBeVisible();
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'questions.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('1#The Sun is a star\n0#The Moon is a planet\n'),
    });
    await expect(page.locator('#eXeShareModal-import')).toBeHidden();
    const questions = page.locator('#formPreview > li');
    await expect(questions).toHaveCount(2);
    await expect(questions.first()).toContainText('The Sun is a star');

    // The AI window adds the questions it is given.
    await page.locator('[data-exe-share="ai"]').click();
    await page.locator('#eXeETabQuestions').click();
    await page.locator('#eXeEQuestionsArea').fill('0#Water boils at 50 degrees');
    await page.locator('#eXeESaveButton').click();
    const alert = page.locator('#modalAlert.show');
    await expect(alert).toContainText('The questions have been added successfully');
    await alert.locator('.close').first().click();
    await expect(alert).toBeHidden();
    await expect(questions).toHaveCount(3);
    await expect(page.locator('#frmENumeroPercentaje')).toHaveText('2/3');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('form');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await waitForEditor(page, 'eXeGameInstructions');
    await expect(questions).toHaveCount(3);
    await page.locator('#formIdeviceForm-tab-options').click();
    await expect(page.locator('#checkAddBtnAnswers')).not.toBeChecked();
    await expect(page.locator('#frmEShowSlider')).toBeChecked();
    await expect(page.locator('#frmEQuestionsRandom')).toBeChecked();
    await expect(page.locator('#frmETime')).toHaveValue('5');
    await expect(page.locator('#frmEPercentageQuestions')).toHaveValue('50');
});
