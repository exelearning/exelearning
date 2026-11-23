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
import { exportText, importText } from '../../helpers/idevice-share-helpers';

test('Identify exports its stored question and the imported ones as Import reads them', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Identify sharing');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'identify');
    const id = await page.locator('.idevice_node.identify').first().getAttribute('id');
    expect(id).toBeTruthy();
    // A complete question, stored with the activity.
    await page.locator('#idfEQuestion').fill('Who am I?');
    await page.locator('#idfESolution').fill('Mercury');
    await page.locator('#idfEPista0').fill('Closest planet to the Sun');
    await page.locator('#idfEPista1').fill('Smallest planet');
    await page.locator('#idfEPista2').fill('Named after a Roman god');
    await page.locator('#idfEPista3').fill('No moons');
    await saveIdevice(page, id!);
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    // Import a real text file and export: the stored question and the
    // imported ones come back in the format Import reads.
    const lines = ['Paris#A capital#On the Seine#Has a tower', 'Rome# #Has a coliseum#In Italy#Seven hills'];
    await page.locator('#identifyQEIdeviceForm-tab-contents').click();
    await importText(page, 'questions.txt', `${lines.join('\n')}\n`, () =>
        expect(page.locator('#idfENumQuestions')).toHaveText('3'),
    );
    await expect(page.locator('#idfESolution')).toHaveValue('Mercury');
    expect((await exportText(page)).split('\n')).toEqual([
        'Mercury#Who am I?#Closest planet to the Sun#Smallest planet#Named after a Roman god#No moons',
        ...lines,
    ]);
    await expect(page.locator('.exe-share-modal.show')).toHaveCount(0);
});

test('Identify keeps the question typed on screen when questions are imported', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Identify import keeps the question');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'identify');

    // Typed in the new activity, never stored by moving to another question.
    await page.locator('#idfESolution').fill('Mercury');
    await page.locator('#idfEPista0').fill('Closest planet to the Sun');
    await page.locator('#idfEPista1').fill('Smallest planet');
    await page.locator('#idfEPista2').fill('Named after a Roman god');
    await page.locator('#idfEPista3').fill('No moons');

    await page.locator('[data-exe-share="import"]').click();
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'questions.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Paris#A capital#On the Seine#Has a tower\n'),
    });
    await expect(page.locator('#eXeShareModal-import')).toBeHidden();

    await expect(page.locator('#idfENumQuestions')).toHaveText('2');
    await expect(page.locator('#idfESolution')).toHaveValue('Mercury');
    await expect(page.locator('#idfEPista3')).toHaveValue('No moons');
});

test('Identify import waits for the questions even when file reading is delayed', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Identify delayed import');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'identify');

    // Hold this read until the completion assertion is running. No timeout or sleep controls the race.
    await page.evaluate(() => {
        const read = FileReader.prototype.readAsText;
        FileReader.prototype.readAsText = function (...args) {
            FileReader.prototype.readAsText = read;
            (window as any).releaseQuestionImport = () => read.apply(this, args);
        };
    });
    let checking!: () => void;
    const checkingImport = new Promise<void>(resolve => {
        checking = resolve;
    });
    const importing = importText(page, 'questions.txt', 'Paris#A capital#On the Seine#Has a tower\n', async () => {
        checking();
        await expect(page.locator('#idfESolution')).toHaveValue('Paris');
    });
    await Promise.race([
        checkingImport,
        importing.then(() => {
            throw new Error('Import returned before checking the imported content');
        }),
    ]);
    await expect(page.locator('#eXeShareModal-import')).toBeHidden();
    await expect(page.locator('#idfESolution')).toHaveValue('');
    await page.evaluate(() => {
        (window as any).releaseQuestionImport();
        delete (window as any).releaseQuestionImport;
    });
    await importing;
    expect(await exportText(page)).toBe('Paris#A capital#On the Seine#Has a tower');
});
