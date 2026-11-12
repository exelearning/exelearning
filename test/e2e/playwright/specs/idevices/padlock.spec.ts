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

test('Padlock keeps its editors in Activities and its settings in Options', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Padlock tabs');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'padlock');
    const device = page.locator('.idevice_node.padlock').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    // Instructions, feedback and access code share the Activities tab; the settings have their own.
    const tabs = page.locator('#candadoIdeviceForm-tabs [data-exe-tab]');
    await expect(tabs).toHaveCount(4);
    await expect(page.locator('#candadoIdeviceForm-tab-contents')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#candadoIdeviceForm-tab-instructions')).toHaveCount(0);
    const optionsTab = page.locator('#candadoIdeviceForm-tab-options');
    const contentsTab = page.locator('#candadoIdeviceForm-tab-contents');

    // The error message is there to fill once there is a number of attempts.
    await optionsTab.click();
    await expect(page.locator('#candadoEErrorMessage')).toBeDisabled();
    await page.locator('#candadoEAttemps').fill('3');
    await page.locator('#candadoEAttemps').blur();
    await page.locator('#candadoEErrorMessage').fill('Look at the date');

    // One editor at a time: the switch shows the instructions or the feedback.
    await contentsTab.click();
    const write = (editor: string, html: string) =>
        page.evaluate(([id, content]) => (window as any).tinymce.get(id).setContent(content), [editor, html]);
    const read = (editor: string) => page.evaluate(id => (window as any).tinymce.get(id).getContent(), editor);
    await waitForEditor(page, 'candadoEDescription');
    await waitForEditor(page, 'candadoEFeedBack');
    await expect(page.locator('#divCandadoInstructions')).toBeVisible();
    await expect(page.locator('#divCandadoFeebBack')).toBeHidden();
    await write('candadoEDescription', '<p>Find the code</p>');
    await page.locator('label[for="candadoERetro"]').click();
    await expect(page.locator('#divCandadoFeebBack')).toBeVisible();
    await expect(page.locator('#divCandadoInstructions')).toBeHidden();
    await write('candadoEFeedBack', '<p>Well done</p>');
    await page.locator('#candadoEDSolution').fill('2468');

    await saveIdevice(page, id!);
    const html = await page.evaluate(
        componentId =>
            (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId)
                .htmlContent as string,
        id!,
    );
    expect(html).toContain('<div class="candado-instructions js-hidden"><p>Find the code</p></div>');
    expect(html).toContain('<div class="candado-retro js-hidden"><p>Well done</p></div>');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await waitForEditor(page, 'candadoEDescription');
    await waitForEditor(page, 'candadoEFeedBack');
    expect(await read('candadoEDescription')).toBe('<p>Find the code</p>');
    expect(await read('candadoEFeedBack')).toBe('<p>Well done</p>');
});

test('Padlock reveals and focuses invalid fields across tabs before allowing a save', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Padlock validation');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'padlock');
    const device = page.locator('.idevice_node.padlock').first();
    const id = await device.getAttribute('id');
    await waitForEditor(page, 'candadoEDescription');
    await waitForEditor(page, 'candadoEFeedBack');

    const tab = (name: string) => page.locator(`#candadoIdeviceForm-tab-${name}`);
    const write = (editor: string, html: string) =>
        page.evaluate(
            ([editorId, content]) => (window as any).tinymce.get(editorId).setContent(content),
            [editor, html],
        );
    const rejectSave = async (message: string, destination: string) => {
        await device.locator('.btn-save-idevice').click();
        const alert = page.locator('#modalAlert');
        await expect(alert).toHaveAttribute('data-open', 'true');
        await expect(alert).toContainText(message);
        await expect(alert.locator('.modal-footer .close')).toBeFocused();
        await alert.locator('.close').first().click();
        await expect(alert).toHaveAttribute('data-open', 'false');
        await expect(tab(destination)).toHaveAttribute('aria-selected', 'true');
        await expect(device).toHaveAttribute('mode', 'edition');
    };

    // Both content editors start empty, with the wrong editor and tab selected.
    await write('candadoEDescription', '');
    await write('candadoEFeedBack', '');
    await page.locator('label[for="candadoERetro"]').click();
    await tab('options').click();
    await rejectSave('Please write the instructions.', 'contents');
    await expect(page.locator('#candadoECandado')).toBeChecked();
    await expect(page.locator('#divCandadoInstructions')).toBeVisible();
    await expect(page.locator('#candadoEDescription_ifr')).toBeFocused();
    await write('candadoEDescription', '<p>Find the code</p>');

    await tab('options').click();
    await rejectSave('Please write the feedback.', 'contents');
    await expect(page.locator('#candadoERetro')).toBeChecked();
    await expect(page.locator('#divCandadoFeebBack')).toBeVisible();
    await expect(page.locator('#candadoEFeedBack_ifr')).toBeFocused();
    await write('candadoEFeedBack', '<p>Well done</p>');

    await tab('texts').click();
    const codeMessage = await page.evaluate(() => (window as any).$exeDevice.msgs.msgEnterCodeAccess);
    await rejectSave(codeMessage, 'contents');
    await expect(page.locator('#candadoEDSolution')).toBeFocused();
    await page.locator('#candadoEDSolution').fill('2468');

    await tab('options').click();
    await page.locator('#candadoEAttemps').fill('3');
    await page.locator('#candadoEAttemps').blur();
    await tab('contents').click();
    await rejectSave('Please write the error message.', 'options');
    await expect(page.locator('#candadoEErrorMessage')).toBeVisible();
    await expect(page.locator('#candadoEErrorMessage')).toBeFocused();
    await page.locator('#candadoEErrorMessage').fill('Look at the date');

    await tab('grading').click();
    await page.locator('label[for="eXeProgressReport"]').click();
    await page.locator('#eXeProgressReportID').fill('abc');
    await tab('contents').click();
    await rejectSave('The report identifier must have at least 5 characters', 'grading');
    await expect(page.locator('#eXeProgressReportID')).toBeFocused();
    await page.locator('#eXeProgressReportID').fill('padlock-report');

    await saveIdevice(page, id!);
    const html = await page.evaluate(componentId => {
        return (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId)
            .htmlContent;
    }, id!);
    expect(html).toContain('<p>Find the code</p>');
    expect(html).toContain('<p>Well done</p>');
    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await expect(page.locator('#candadoEDSolution')).toHaveValue('2468');
    await expect(page.locator('#candadoEErrorMessage')).toHaveValue('Look at the date');
    await expect(page.locator('#eXeProgressReportID')).toHaveValue('padlock-report');
});
