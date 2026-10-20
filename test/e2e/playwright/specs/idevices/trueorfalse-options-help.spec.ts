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

test('True or false explains its options inline and shares its questions', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'True or false option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'trueorfalse');
    const device = page.locator('.idevice_node.trueorfalse').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();
    await waitForEditor(page, 'tofEQuestionEditor');

    await page.locator('#trueorfalseIdeviceForm-tab-options').click();
    const help = page.locator('#tofEOptions .exe-idevice-help:visible');
    // The time and the attempts only apply to a test.
    await expect(help).toHaveCount(4);
    await page.locator('#tofEIsTest').check();
    await expect(help).toHaveCount(6);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            const sameLine = await button.evaluate(element => {
                const row = element.closest('#tofEOptions > div')!;
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
    const sliderHelp = page
        .locator('#tofEOptions > div')
        .filter({ has: page.locator('#tofEShowSlider') })
        .locator('.exe-idevice-help');
    await sliderHelp.click();
    await page.locator(`#${await sliderHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#tofEShowSlider')).not.toBeChecked();
    await sliderHelp.press('Escape');
    await page.locator('#tofEShowSlider').check();
    await page.locator('#tofETime').fill('5');
    await page.locator('#tofEAttemptsNumber').fill('3');
    await page.locator('#tofEQuestionsRandom').check();
    await page.locator('#tofEPercentageQuestions').fill('50');

    // Import a real text file: its statements replace the empty first question.
    await page.locator('#trueorfalseIdeviceForm-tab-contents').click();
    await page.locator('[data-exe-share="import"]').click();
    await expect(page.locator('#eXeShareModal-import')).toBeVisible();
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'statements.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('1#The Sun is a star\n0#The Moon is a planet\n'),
    });
    await expect(page.locator('#eXeShareModal-import')).toBeHidden();
    await expect(page.locator('#tofENumQuestions')).toHaveText('2');
    await expect
        .poll(() => page.evaluate(() => (window as any).tinymce.get('tofEQuestionEditor').getContent()))
        .toContain('The Sun is a star');
    await expect(page.locator('#tofAnswerTrue')).toBeChecked();

    // The AI window adds the questions it is given.
    await page.locator('[data-exe-share="ai"]').click();
    await page.locator('#eXeETabQuestions').click();
    await page.locator('#eXeEQuestionsArea').fill('Is the Earth round?#1#Think about the horizon.#It is not flat.');
    await page.locator('#eXeESaveButton').click();
    const alert = page.locator('#modalAlert.show');
    await expect(alert).toContainText('The questions have been added successfully');
    await alert.locator('.close').first().click();
    await expect(alert).toBeHidden();
    await expect(page.locator('#tofENumQuestions')).toHaveText('3');

    // Export writes every question in the order Import reads back: the one on
    // screen as the editor stores it, and suggestion before feedback.
    await page.locator('[data-exe-share="export"]').click();
    const downloading = page.waitForEvent('download');
    await page.locator('#eXeGameExportQuestions').click();
    const download = await downloading;
    const stream = await download.createReadStream();
    let exported = '';
    for await (const chunk of stream) exported += chunk.toString();
    expect(exported.split('\n')).toEqual([
        'v-f#<p>The Sun is a star</p>#1##',
        'v-f#The Moon is a planet#0##',
        'v-f#Is the Earth round?#1#Think about the horizon.#It is not flat.',
    ]);

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('trueorfalse');
    expect(stored.html).toContain('exe-trueorfalse-container');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await waitForEditor(page, 'tofEQuestionEditor');
    await expect(page.locator('#tofENumQuestions')).toHaveText('3');
    await page.locator('#trueorfalseIdeviceForm-tab-options').click();
    await expect(page.locator('#tofEShowSlider')).toBeChecked();
    await expect(page.locator('#tofEIsTest')).toBeChecked();
    await expect(page.locator('#tofETime')).toHaveValue('5');
    await expect(page.locator('#tofEAttemptsNumber')).toHaveValue('3');
    await expect(page.locator('#tofEQuestionsRandom')).toBeChecked();
    await expect(page.locator('#tofEPercentageQuestions')).toHaveValue('50');
    await expect(page.locator('#tofENumeroPercentaje')).toHaveText('2/3');
});
