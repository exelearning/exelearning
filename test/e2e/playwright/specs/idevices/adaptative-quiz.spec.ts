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
import { addWithAi, closeAlert, exportText, importText } from '../../helpers/idevice-share-helpers';

const QUESTIONS = [
    '0@0#A#Which is a star?#Sun#Moon',
    '0@0#B#Which is a planet?#Sun#Mars',
    '0@1#A#How much is 2+2?#4#5',
    '0@1#B#How much is 3+3?#5#6',
    '0@2#A#Capital of France?#Paris#Rome',
    '0@2#B#Capital of Italy?#Paris#Rome',
];

test('Adaptative quiz shares its questions and keeps its access code', async ({
    authenticatedPage: page,
    createProject,
}) => {
    // Saving and reloading the project takes most of a minute in Firefox.
    test.setTimeout(90_000);
    const uuid = await createProject(page, 'Adaptative quiz sharing');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'adaptative-quiz');
    const id = await page.locator('.idevice_node.adaptative-quiz').first().getAttribute('id');
    expect(id).toBeTruthy();

    // Import a real text file: its questions replace the empty first one.
    await page.locator('#adaptativeQuizIdeviceForm-tab-contents').click();
    await importText(page, 'questions.txt', `${QUESTIONS.join('\n')}\n`);
    await expect(page.locator('#adaptativeQuizENumQuestions')).toHaveText('6');
    await expect(page.locator('#adaptativeQuizEQuestion')).toHaveValue('Which is a star?');
    // The AI window adds the questions it is given.
    await addWithAi(page, '2@0#Sun#The star of our system');
    await closeAlert(page, 'The questions have been added successfully');
    await expect(page.locator('#adaptativeQuizENumQuestions')).toHaveText('7');
    // Export writes the format Import reads back.
    expect((await exportText(page)).split('\n')).toEqual([...QUESTIONS, '2@0#Sun#The star of our system']);
    await expect(page.locator('.exe-share-modal.show')).toHaveCount(0);
    // An access code, in the Passwords tab.
    await page.locator('#adaptativeQuizIdeviceForm-tab-passwords').click();
    await page.locator('#eXeGameShowCodeAccess').check();
    await page.locator('#eXeGameCodeAccess').fill('1234');
    await page.locator('#eXeGameMessageCodeAccess').fill('Type the code');

    await saveIdevice(page, id!);
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await expect(page.locator('#adaptativeQuizENumQuestions')).toHaveText('7');
    await page.locator('#adaptativeQuizIdeviceForm-tab-passwords').click();
    await expect(page.locator('#eXeGameShowCodeAccess')).toBeChecked();
    await expect(page.locator('#eXeGameCodeAccess')).toHaveValue('1234');
});
