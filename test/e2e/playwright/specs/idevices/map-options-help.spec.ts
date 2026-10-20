import type { Page } from '@playwright/test';
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

/**
 * Check that every help shown in the options sits right after what precedes it
 * on its row (its control, or the label of a long row) and that its explanation
 * fits the panel.
 */
async function expectHelpsInline(page: Page) {
    const help = page.locator('#mapaEOptions .exe-idevice-help:visible');
    expect(await help.count()).toBeGreaterThan(0);
    for (const button of await help.all()) {
        await button.hover();
        await expect(page.getByRole('tooltip')).toHaveText('Information');
        const sameLine = await button.evaluate(element => {
            const container = element.parentElement!;
            let previous = container.previousElementSibling;
            while (previous && previous.getClientRects().length === 0) previous = previous.previousElementSibling;
            const a = element.getBoundingClientRect();
            const b = previous!.getBoundingClientRect();
            const gap = a.left - b.right;
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

test('Map explains the options of each assessment mode inline', async ({ authenticatedPage: page, createProject }) => {
    test.setTimeout(180000);
    const uuid = await createProject(page, 'Map option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'map');
    const device = page.locator('.idevice_node.map').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();
    // The form is wired once the editor of the point text is ready.
    await waitForEditor(page, 'mapaToolTip');

    await page.locator('#gameQEIdeviceForm-tab-options').click();
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        await expectHelpsInline(page);
    }
    // Each mode shows its own rows, with their help.
    for (const mode of ['mapaEEvaluationTest', 'mapaEEvaluationOrder', 'mapaEEvaluationTX', 'mapaEEvaluationSearch']) {
        await page.locator(`label[for="${mode}"]`).click();
        await expectHelpsInline(page);
    }

    // Reading a help, or its open explanation, leaves the option as it was.
    await page.locator('label[for="mapaEEvaluationPoints"]').click();
    const areasHelp = page
        .locator('#mapaEOptions .d-flex')
        .filter({ has: page.locator('#mapaEHideAreas') })
        .locator('.exe-idevice-help');
    await areasHelp.click();
    await page.locator(`#${await areasHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#mapaEHideAreas')).not.toBeChecked();
    await areasHelp.press('Escape');
    await page.locator('#mapaEHideAreas').check();
    await page.locator('#mapaEHideScoreBar').check();

    // A map needs its image and one point marked on it, with a title.
    await page.locator('#gameQEIdeviceForm-tab-contents').click();
    const image = await page.locator('#mapaNoImage').getAttribute('src');
    await page.locator('#mapaURLImageMap').fill(image!);
    await page.locator('#mapaShowImageMap').click();
    await expect(page.locator('#mapaImage')).toBeVisible();
    await page.locator('#mapaTypePointSelect').selectOption('4');
    await page.locator('#mapaTitle').fill('North');
    const box = (await page.locator('#mapaImage').boundingBox())!;
    await page.mouse.click(box.x + box.width / 3, box.y + box.height / 3);
    await expect(page.locator('#mapaX')).not.toHaveValue('0');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('map');
    expect(stored.html).toContain('mapa-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await waitForEditor(page, 'mapaToolTip');

    await page.locator('#gameQEIdeviceForm-tab-options').click();
    await expect(page.locator('#mapaEEvaluationPoints')).toBeChecked();
    await expect(page.locator('#mapaEHideAreas')).toBeChecked();
    await expect(page.locator('#mapaEHideScoreBar')).toBeChecked();
    await page.locator('#gameQEIdeviceForm-tab-contents').click();
    await expect(page.locator('#mapaTitle')).toHaveValue('North');
});
