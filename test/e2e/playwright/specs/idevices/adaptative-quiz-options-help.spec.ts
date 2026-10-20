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

const QUESTIONS = [
    '0@0#A#Which is a star?#Sun#Moon',
    '0@0#B#Which is a planet?#Sun#Mars',
    '0@1#A#How much is 2+2?#4#5',
    '0@1#B#How much is 3+3?#5#6',
    '0@2#A#Capital of France?#Paris#Rome',
    '0@2#B#Capital of Italy?#Paris#Rome',
];

test('Adaptative quiz explains its options inline and shares its questions', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(150000);
    const uuid = await createProject(page, 'Adaptative quiz option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'adaptative-quiz');
    const device = page.locator('.idevice_node.adaptative-quiz').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    await page.locator('#adaptativeQuizIdeviceForm-tab-options').click();
    const help = page.locator('#adaptativeQuizEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(9);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            const sameLine = await button.evaluate(element => {
                const row = element.closest('#adaptativeQuizEOptions > div')!;
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
    const shuffleHelp = page
        .locator('#adaptativeQuizEOptions > div')
        .filter({ has: page.locator('#adaptativeQuizShuffle') })
        .locator('.exe-idevice-help');
    await shuffleHelp.click();
    await page.locator(`#${await shuffleHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#adaptativeQuizShuffle')).toBeChecked();
    await shuffleHelp.press('Escape');
    await page.locator('#adaptativeQuizShuffle').uncheck();
    await page.locator('#adaptativeQuizCaseSensitive').check();
    await page.locator('#adaptativeQuizETime').fill('5');
    await page.locator('#adaptativeQuizNumRound').fill('4');

    // Import a real text file: its questions replace the empty first one.
    await page.locator('#adaptativeQuizIdeviceForm-tab-contents').click();
    await page.locator('[data-exe-share="import"]').click();
    await expect(page.locator('#eXeShareModal-import')).toBeVisible();
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'questions.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(`${QUESTIONS.join('\n')}\n`),
    });
    await expect(page.locator('#eXeShareModal-import')).toBeHidden();
    await expect(page.locator('#adaptativeQuizENumQuestions')).toHaveText('6');
    await expect(page.locator('#adaptativeQuizEQuestion')).toHaveValue('Which is a star?');

    // The AI window adds the questions it is given.
    await page.locator('[data-exe-share="ai"]').click();
    await page.locator('#eXeETabQuestions').click();
    await page.locator('#eXeEQuestionsArea').fill('2@0#Sun#The star of our system');
    await page.locator('#eXeESaveButton').click();
    const alert = page.locator('#modalAlert.show');
    await expect(alert).toContainText('The questions have been added successfully');
    await alert.locator('.close').first().click();
    await expect(alert).toBeHidden();
    await expect(page.locator('#adaptativeQuizENumQuestions')).toHaveText('7');

    // Export writes the format Import reads back.
    await page.locator('[data-exe-share="export"]').click();
    const downloading = page.waitForEvent('download');
    await page.locator('#eXeGameExportQuestions').click();
    const download = await downloading;
    const stream = await download.createReadStream();
    let exported = '';
    for await (const chunk of stream) exported += chunk.toString();
    expect(exported.split('\n')).toEqual([...QUESTIONS, '2@0#Sun#The star of our system']);
    await page.keyboard.press('Escape');
    await expect(page.locator('#eXeShareModal-export')).toBeHidden();

    // An access code, in the Passwords tab.
    await page.locator('#adaptativeQuizIdeviceForm-tab-passwords').click();
    await page.locator('#eXeGameShowCodeAccess').check();
    await page.locator('#eXeGameCodeAccess').fill('1234');
    await page.locator('#eXeGameMessageCodeAccess').fill('Type the code');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('adaptative-quiz');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await expect(page.locator('#adaptativeQuizENumQuestions')).toHaveText('7');
    await page.locator('#adaptativeQuizIdeviceForm-tab-options').click();
    await expect(page.locator('#adaptativeQuizShuffle')).not.toBeChecked();
    await expect(page.locator('#adaptativeQuizCaseSensitive')).toBeChecked();
    await expect(page.locator('#adaptativeQuizETime')).toHaveValue('5');
    await expect(page.locator('#adaptativeQuizNumRound')).toHaveValue('4');
    await page.locator('#adaptativeQuizIdeviceForm-tab-passwords').click();
    await expect(page.locator('#eXeGameShowCodeAccess')).toBeChecked();
    await expect(page.locator('#eXeGameCodeAccess')).toHaveValue('1234');
});
