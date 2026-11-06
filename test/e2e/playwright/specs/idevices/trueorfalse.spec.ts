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
import { addWithAi, closeAlert, exportText, importText } from '../../helpers/idevice-share-helpers';

test('True or false shares its questions', async ({ authenticatedPage: page, createProject }) => {
    // Saving and reloading the project takes most of a minute in Firefox.
    test.setTimeout(90_000);
    const uuid = await createProject(page, 'True or false sharing');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'trueorfalse');
    const id = await page.locator('.idevice_node.trueorfalse').first().getAttribute('id');
    expect(id).toBeTruthy();
    await waitForEditor(page, 'tofEQuestionEditor');
    // Half of the questions, at random: the count below shows how many of them.
    await page.locator('#trueorfalseIdeviceForm-tab-options').click();
    await page.locator('#tofEQuestionsRandom').check();
    await page.locator('#tofEPercentageQuestions').fill('50');

    // Import a real text file: its statements replace the empty first question.
    await page.locator('#trueorfalseIdeviceForm-tab-contents').click();
    await importText(page, 'statements.txt', '1#The Sun is a star\n0#The Moon is a planet\n');
    await expect(page.locator('#tofENumQuestions')).toHaveText('2');
    await expect
        .poll(() => page.evaluate(() => (window as any).tinymce.get('tofEQuestionEditor').getContent()))
        .toContain('The Sun is a star');
    await expect(page.locator('#tofAnswerTrue')).toBeChecked();
    // The AI window adds the questions it is given.
    await addWithAi(page, 'Is the Earth round?#1#Think about the horizon.#It is not flat.');
    await closeAlert(page, 'The questions have been added successfully');
    await expect(page.locator('#tofENumQuestions')).toHaveText('3');
    // Export writes every question in the order Import reads back: the one on
    // screen as the editor stores it, and suggestion before feedback.
    expect((await exportText(page)).split('\n')).toEqual([
        'v-f#<p>The Sun is a star</p>#1##',
        'v-f#The Moon is a planet#0##',
        'v-f#Is the Earth round?#1#Think about the horizon.#It is not flat.',
    ]);

    await saveIdevice(page, id!);
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await waitForEditor(page, 'tofEQuestionEditor');
    await expect(page.locator('#tofENumQuestions')).toHaveText('3');
    await page.locator('#trueorfalseIdeviceForm-tab-options').click();
    await expect(page.locator('#tofENumeroPercentaje')).toHaveText('2/3');
});
