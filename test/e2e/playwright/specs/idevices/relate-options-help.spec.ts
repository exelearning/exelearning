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

test('Relate explains its options inline and shares its pairs', async ({ authenticatedPage: page, createProject }) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Relate option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'relate');
    const device = page.locator('.idevice_node.relate').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    // The time is asked only in the Advanced level.
    await page.locator('#relateQIdeviceForm-tab-options').click();
    await expect(page.locator('#rclETime')).toBeHidden();
    await page.locator('#rclETypeIdentify').check();
    await expect(page.locator('#rclETime')).toBeVisible();

    const help = page.locator('#rclEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(4);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#rclEOptions .help-content:visible')).toHaveCount(0);
            const sameLine = await button.evaluate(element => {
                const row = element.closest('.d-flex')!;
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
            await page.locator('#relateQIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const minimizeHelp = page
        .locator('#rclEOptions .d-flex')
        .filter({ has: page.locator('#rclEShowMinimize') })
        .locator('.exe-idevice-help');
    await minimizeHelp.click();
    await page.locator(`#${await minimizeHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#rclEShowMinimize')).not.toBeChecked();
    await minimizeHelp.press('Escape');
    await page.locator('#rclETime').fill('5');

    // Import a real text file: its pairs replace the empty first card.
    await page.locator('#relateQIdeviceForm-tab-contents').click();
    await page.locator('[data-exe-share="import"]').click();
    await expect(page.locator('#eXeShareModal-import')).toBeVisible();
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'pairs.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Sun#Sol\nMoon#Luna\n'),
    });
    await expect(page.locator('#eXeShareModal-import')).toBeHidden();
    await expect(page.locator('#rclENumCards')).toHaveText('2');
    await expect(page.locator('#rclEText')).toHaveValue('Sun');

    // The AI window adds the lines it is given.
    await page.locator('[data-exe-share="ai"]').click();
    await page.locator('#eXeETabQuestions').click();
    await page.locator('#eXeEQuestionsArea').fill('Star#Estrella');
    await page.locator('#eXeESaveButton').click();
    await expect(page.locator('#rclENumCards')).toHaveText('3');
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
    expect(exported.split('\n')).toEqual(['Sun#Sol', 'Moon#Luna', 'Star#Estrella']);

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('relate');
    expect(stored.html).toContain('relaciona-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#relateQIdeviceForm-tab-options').click();
    await expect(page.locator('#rclETypeIdentify')).toBeChecked();
    await expect(page.locator('#rclETime')).toHaveValue('5');
    await page.locator('#relateQIdeviceForm-tab-contents').click();
    await expect(page.locator('#rclENumCards')).toHaveText('3');
    await expect(page.locator('#rclETextBack')).toHaveValue('Sol');
});
