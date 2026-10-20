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

test('GeoGebra activity explains its options inline and keeps its instructions', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(180000);
    const uuid = await createProject(page, 'GeoGebra option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'geogebra-activity');
    const device = page.locator('.idevice_node.geogebra-activity').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();
    await expect(page.locator('#eXeAutoGeogebraForm-tab-contents')).toHaveAttribute('aria-selected', 'true');

    await page.locator('#eXeAutoGeogebraForm-tab-options').click();
    const help = page.locator('#eXeAutoGeogebraOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(18);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
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
                const panel = element.closest('.tab-pane')!.getBoundingClientRect();
                return (
                    rect.left >= panel.left &&
                    rect.right <= Math.min(panel.right, window.innerWidth) &&
                    element.scrollWidth <= element.clientWidth
                );
            });
            expect(fitsInThePanel).toBe(true);
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const menuHelp = page
        .locator('#eXeAutoGeogebraOptions .d-flex')
        .filter({ has: page.locator('#geogebraActivityshowMenuBar') })
        .locator('.exe-idevice-help');
    await menuHelp.click();
    await page.locator(`#${await menuHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#geogebraActivityshowMenuBar')).not.toBeChecked();
    await menuHelp.press('Escape');
    await page.locator('#geogebraActivityshowMenuBar').check();
    await page.locator('#geogebraActivityLang').fill('fr');

    // The instructions are written in their own tab.
    await page.locator('#eXeAutoGeogebraForm-tab-instructions').click();
    await waitForEditor(page, 'eXeGameInstructions');
    await page.evaluate(() => (window as any).tinymce.get('eXeGameInstructions').setContent('<p>Move the point</p>'));

    await page.locator('#eXeAutoGeogebraForm-tab-contents').click();
    await page.locator('#geogebraActivityURL').fill('VgHhQXCC');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('geogebra-activity');
    expect(stored.html).toContain('<div class="auto-geogebra-instructions"><p>Move the point</p></div>');
    expect(stored.html).toContain('language-fr');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await expect(page.locator('#geogebraActivityURL')).toHaveValue('https://www.geogebra.org/m/VgHhQXCC');
    await page.locator('#eXeAutoGeogebraForm-tab-options').click();
    await expect(page.locator('#geogebraActivityshowMenuBar')).toBeChecked();
    await expect(page.locator('#geogebraActivityLang')).toHaveValue('fr');
    await page.locator('#eXeAutoGeogebraForm-tab-instructions').click();
    await waitForEditor(page, 'eXeGameInstructions');
    expect(await page.evaluate(() => (window as any).tinymce.get('eXeGameInstructions').getContent())).toBe(
        '<p>Move the point</p>',
    );
});
