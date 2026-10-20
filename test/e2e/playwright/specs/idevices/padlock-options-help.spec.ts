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

test('Padlock keeps its editors and settings in Activities and explains each setting inline', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Padlock option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'padlock');
    const device = page.locator('.idevice_node.padlock').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    // Instructions, feedback, access code and settings share the Activities tab.
    const tabs = page.locator('#candadoIdeviceForm-tabs [data-exe-tab]');
    await expect(tabs).toHaveCount(3);
    await expect(page.locator('#candadoIdeviceForm-tab-contents')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#candadoIdeviceForm-tab-instructions')).toHaveCount(0);
    await expect(page.locator('#candadoIdeviceForm-tab-options')).toHaveCount(0);

    const help = page.locator('#candadoEPanel .exe-idevice-help:visible');
    await expect(help).toHaveCount(6);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#candadoEPanel .help-content:visible')).toHaveCount(0);
            const sameLine = await button.evaluate(element => {
                const row = element.closest('.d-flex')!;
                const control = row.querySelector('input, select')!;
                const a = element.getBoundingClientRect();
                const b = control.getBoundingClientRect();
                let previous = element.parentElement!.previousElementSibling!;
                while (!previous.getClientRects().length) previous = previous.previousElementSibling!;
                const gap = a.left - previous.getBoundingClientRect().right;
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
            await page.locator('#candadoIdeviceForm-tab-contents').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const minimizeHelp = page
        .locator('#candadoEOptions .d-flex')
        .filter({ hasText: 'Show minimized' })
        .locator('.exe-idevice-help');
    await minimizeHelp.click();
    await page.locator(`#${await minimizeHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#candadoEShowMinimize')).not.toBeChecked();
    await minimizeHelp.press('Escape');

    // The error message is there to fill once there is a number of attempts.
    await expect(page.locator('#candadoEErrorMessage')).toBeDisabled();
    await page.locator('#candadoEAttemps').fill('3');
    await page.locator('#candadoEAttemps').blur();
    await page.locator('#candadoEErrorMessage').fill('Look at the date');
    await page.locator('#candadoEShowMinimize').check();

    // One editor at a time: the switch shows the instructions or the feedback.
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
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('padlock');
    expect(stored.html).toContain('<div class="candado-instructions js-hidden"><p>Find the code</p></div>');
    expect(stored.html).toContain('<div class="candado-retro js-hidden"><p>Well done</p></div>');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await expect(page.locator('#candadoEShowMinimize')).toBeChecked();
    await expect(page.locator('#candadoEAttemps')).toHaveValue('3');
    await expect(page.locator('#candadoEErrorMessage')).toHaveValue('Look at the date');
    await expect(page.locator('#candadoEDSolution')).toHaveValue('2468');
    await waitForEditor(page, 'candadoEDescription');
    await waitForEditor(page, 'candadoEFeedBack');
    expect(await read('candadoEDescription')).toBe('<p>Find the code</p>');
    expect(await read('candadoEFeedBack')).toBe('<p>Well done</p>');
});
