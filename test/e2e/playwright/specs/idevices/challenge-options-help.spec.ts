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

test('Challenge explains its options inline without changing their values', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Challenge option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'challenge');
    const device = page.locator('.idevice_node.challenge').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    await page.locator('#desafioIdeviceForm-tab-options').click();
    const help = page.locator('#desafioEOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(3);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            await expect(page.locator('#desafioEOptions .help-content:visible')).toHaveCount(0);
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
            await page.locator('#desafioIdeviceForm-tab-options').hover();
            await expect(content).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const minimizeHelp = page
        .locator('#desafioEOptions .d-flex')
        .filter({ has: page.locator('#desafioEShowMinimize') })
        .locator('.exe-idevice-help');
    await minimizeHelp.click();
    await page.locator(`#${await minimizeHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#desafioEShowMinimize')).not.toBeChecked();
    await minimizeHelp.press('Escape');
    await page.locator('#desafioEShowMinimize').check();
    await page.locator('#desafioEDType').selectOption('1');
    await page.locator('#desafioEDTime').selectOption('60');

    // The final challenge, then its only trial.
    const write = (editor: string, html: string) =>
        page.evaluate(
            ([editorId, content]) => (window as any).tinymce.get(editorId).setContent(content),
            [editor, html],
        );
    await page.locator('#desafioIdeviceForm-tab-contents').click();
    await page.locator('#desafioEDTitle').fill('The vault');
    await page.locator('#desafioEDSolution').fill('OPEN');
    await waitForEditor(page, 'desafioEDescription');
    await write('desafioEDescription', '<p>Open the vault</p>');
    await page.locator('label[for="desafioEReto"]').click();
    await page.locator('#desafioECTitle').fill('Lock');
    await page.locator('#desafioECSolution').fill('KEY');
    await waitForEditor(page, 'desafioEChallenge-0');
    await write('desafioEChallenge-0', '<p>Find the key</p>');
    // The type and the time stay in Options while the trials are edited.
    await page.locator('#desafioIdeviceForm-tab-options').click();
    await expect(page.locator('#desafioEDType')).toBeVisible();
    await expect(page.locator('#desafioEDTime')).toBeVisible();

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('challenge');
    expect(stored.html).toContain('desafio-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await page.locator('#desafioIdeviceForm-tab-options').click();
    await expect(page.locator('#desafioEShowMinimize')).toBeChecked();
    await expect(page.locator('#desafioEDType')).toHaveValue('1');
    await expect(page.locator('#desafioEDTime')).toHaveValue('60');
    await page.locator('#desafioIdeviceForm-tab-contents').click();
    await expect(page.locator('#desafioEDTitle')).toHaveValue('The vault');
});
