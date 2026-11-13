import { test, expect } from '../../fixtures/auth.fixture';
import { waitForEditor } from '../../helpers/editor-helpers';
import { dropText, exportText } from '../../helpers/idevice-share-helpers';
import {
    addIdevice,
    gotoWorkarea,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

test('Guess exports and saves a video question that starts at second zero', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await page.route('https://www.youtube.com/iframe_api', route => route.abort());
    const uuid = await createProject(page, 'Guess video from zero');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'guess');
    await waitForEditor(page, 'adivinaEText');
    const id = await page.locator('.idevice_node.guess').first().getAttribute('id');
    expect(id).toBeTruthy();
    await page.locator('#adivinaESolutionWord').fill('HEART');
    await page.locator('#adivinaEDefinitionWord').fill('Organ that pumps blood');
    await page.locator('#adivinaEMediaVideo').check();
    await page.locator('#adivinaEURLYoutube').fill('https://www.youtube.com/watch?v=M7lc1UVf-VE');
    // Second 0 is a start, not a missing one.
    await page.locator('#adivinaEInitVideo').fill('00:00:00');
    await page.locator('#adivinaEEndVideo').fill('00:00:10');

    expect(await exportText(page)).toContain('HEART#Organ that pumps blood');
    await saveIdevice(page, id!);
});

test('Guess imports a txt file dropped on the Import window', async ({ authenticatedPage: page, createProject }) => {
    const uuid = await createProject(page, 'Guess dropped file');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'guess');
    await waitForEditor(page, 'adivinaEText');

    await dropText(page, 'words.txt', 'ECOSYSTEM#A community of living organisms\nHEART#Organ that pumps blood', () =>
        expect
            .poll(() => page.evaluate(() => (window as any).$exeDevice.wordsGame.map((word: any) => word.word)))
            .toEqual(expect.arrayContaining(['ECOSYSTEM', 'HEART'])),
    );
});
