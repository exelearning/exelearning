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

test('Word search explains its options inline and shares its words', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Word search option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'word-search');
    const device = page.locator('.idevice_node.word-search').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    await page.locator('#sopaQEIdeviceForm-tab-options').click();
    const help = page.locator('#sopaEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(5);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#sopaEOptions .help-content:visible')).toHaveCount(0);
            const sameLine = await button.evaluate(element => {
                const row = element.closest('.d-flex')!;
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
                const icon = element.parentElement!.querySelector('button')!.getBoundingClientRect();
                const panel = element.closest('.tab-pane')!.getBoundingClientRect();
                return (
                    Math.abs(rect.left - icon.left) < 2 &&
                    rect.left >= panel.left &&
                    rect.right <= Math.min(panel.right, window.innerWidth) &&
                    element.scrollWidth <= element.clientWidth
                );
            });
            expect(fitsInThePanel).toBe(true);
            await page.locator('#sopaQEIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the options as they were.
    const acceptHelp = page
        .locator('#sopaEOptions .d-flex')
        .filter({ has: page.locator('#sopaEDiagonals') })
        .locator('.exe-idevice-help');
    await acceptHelp.click();
    await page.locator(`#${await acceptHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#sopaEDiagonals')).not.toBeChecked();
    await expect(page.locator('#sopaEReverses')).not.toBeChecked();
    await acceptHelp.press('Escape');
    await page.locator('#sopaEDiagonals').check();
    await page.locator('#sopaETime').fill('5');

    // Import a real text file: its words replace the empty first one.
    await page.locator('#sopaQEIdeviceForm-tab-contents').click();
    await page.locator('[data-exe-share="import"]').click();
    await expect(page.locator('#eXeShareModal-import')).toBeVisible();
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'words.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('SUN#The star of our system\nMOON#Natural satellite of the Earth\n'),
    });
    await expect(page.locator('#eXeShareModal-import')).toBeHidden();
    await expect(page.locator('#sopaENumQuestions')).toHaveText('2');
    await expect(page.locator('#sopaESolutionWord')).toHaveValue('SUN');

    // The AI window adds the lines it is given.
    await page.locator('[data-exe-share="ai"]').click();
    await page.locator('#eXeETabQuestions').click();
    await page.locator('#eXeEQuestionsArea').fill('STAR#A sun far away');
    await page.locator('#eXeESaveButton').click();
    await expect(page.locator('#sopaENumQuestions')).toHaveText('3');
    const alert = page.locator('#modalAlert.show');
    await expect(alert).toContainText('The questions have been added successfully');
    await alert.locator('.close').first().click();
    await expect(alert).toBeHidden();

    // Export writes the format Import reads back.
    await page.locator('[data-exe-share="export"]').click();
    const downloading = page.waitForEvent('download');
    await page.locator('#eXeGameExportQuestions').click();
    const download = await downloading;
    const stream = await download.createReadStream();
    let exported = '';
    for await (const chunk of stream) exported += chunk.toString();
    expect(exported.split('\n')).toEqual([
        'SUN#The star of our system',
        'MOON#Natural satellite of the Earth',
        'STAR#A sun far away',
    ]);

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('word-search');
    expect(stored.html).toContain('sopa-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#sopaQEIdeviceForm-tab-options').click();
    await expect(page.locator('#sopaEDiagonals')).toBeChecked();
    await expect(page.locator('#sopaEReverses')).not.toBeChecked();
    await expect(page.locator('#sopaETime')).toHaveValue('5');
    await page.locator('#sopaQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#sopaENumQuestions')).toHaveText('3');
    await expect(page.locator('#sopaEDefinitionWord')).toHaveValue('The star of our system');
});
