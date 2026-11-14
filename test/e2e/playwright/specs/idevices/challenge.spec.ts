import { test, expect } from '../../fixtures/auth.fixture';
import { waitForEditor } from '../../helpers/editor-helpers';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';

test('Challenge hides the type and the time of the challenge while its trials are edited', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Challenge type and time');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'challenge');
    const write = (editor: string, html: string) =>
        page.evaluate(
            ([editorId, content]) => (window as any).tinymce.get(editorId).setContent(content),
            [editor, html],
        );

    // The final challenge, with its type and its time, then its only trial.
    await page.locator('#desafioIdeviceForm-tab-contents').click();
    await expect(page.locator('#desafioSelects')).toBeVisible();
    await page.locator('#desafioEDType').selectOption('1');
    await page.locator('#desafioEDTime').selectOption('60');
    await page.locator('#desafioEDTitle').fill('The vault');
    await page.locator('#desafioEDSolution').fill('OPEN');
    await waitForEditor(page, 'desafioEDescription');
    await write('desafioEDescription', '<p>Open the vault</p>');
    await page.locator('label[for="desafioEReto"]').click();
    await page.locator('#desafioECTitle').fill('Lock');
    await page.locator('#desafioECSolution').fill('KEY');
    await waitForEditor(page, 'desafioEChallenge-0');
    await write('desafioEChallenge-0', '<p>Find the key</p>');
    // The type and the time belong to the challenge: hidden while the trials are edited.
    await expect(page.locator('#desafioSelects')).toBeHidden();
    await page.locator('label[for="desafioEDesafio"]').click();
    await expect(page.locator('#desafioSelects')).toBeVisible();
    await expect(page.locator('#desafioEDType')).toHaveValue('1');
    await expect(page.locator('#desafioEDTime')).toHaveValue('60');
});
