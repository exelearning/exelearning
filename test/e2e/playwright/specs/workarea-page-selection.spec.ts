import { test, expect } from '../fixtures/auth.fixture';
import {
    addIdevice,
    addPage,
    gotoWorkarea,
    selectFirstPage,
    selectNavNode,
    waitForAppReady,
} from '../helpers/workarea-helpers';

test('Selecting a page opens collapsed panels and preserves an already selected page', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Page selection with collapsed panels');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);

    // With no page selected, the helper opens the panels and selects the first page.
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.locator('body')).toHaveClass(/left-column-hidden/);
    await selectFirstPage(page);
    await expect(page.locator('body')).not.toHaveClass(/left-column-hidden/);
    const firstPage = page.locator('.nav-element:not([nav-id="root"])').first();
    await expect(firstPage).toHaveClass(/selected/);

    // The early-return path must also open the iDevice list, without changing the selected page.
    const secondPageId = await addPage(page, 'Second page');
    await selectNavNode(page, secondPageId);
    await page.locator('#exe-panels-toggler').click();
    await expect(page.locator('body')).toHaveClass(/left-column-hidden/);
    await selectFirstPage(page);
    await expect(page.locator('body')).not.toHaveClass(/left-column-hidden/);
    await expect(page.locator('.nav-element.selected')).toHaveAttribute('nav-id', secondPageId);

    await addIdevice(page, 'text');
    const device = page.locator('.idevice_node.text[mode="edition"]');
    await expect(device).toBeVisible();
    const id = await device.getAttribute('id');
    const stored = await page.evaluate(componentId => {
        return (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
    }, id!);
    expect(stored.ideviceType).toBe('text');
});
