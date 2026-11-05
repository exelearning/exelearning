import { test, expect } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';
import { waitForEditor } from '../../helpers/editor-helpers';

/**
 * The tabs of the iDevice forms (tabs.getHtml) in the application's style, as in the project properties: the
 * active tab is bold and underlined with an inset box-shadow, which forced colors mode removes. In that mode it
 * gets a real bottom border, taken from its padding so the tab row does not grow, and the focused tab an outline.
 *
 * Playwright only emulates forced colors in Chromium, so the Firefox project ignores this spec (see `testIgnore`
 * in playwright.config.ts).
 */
test('The active tab of an iDevice form is bold and underlined, also in forced colors mode', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'iDevice form tabs');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'guess');
    await waitForEditor(page, 'adivinaEText');

    const row = page.locator('#gameQEIdeviceForm-tabs');
    const active = row.locator('.nav-link.active');
    const inactive = row.locator('.nav-link:not(.active)').first();
    await expect(active).toHaveText('Activities');
    const look = (tab: typeof active) =>
        tab.evaluate(element => {
            const style = getComputedStyle(element);
            return { weight: Number(style.fontWeight), color: style.color, underline: style.boxShadow };
        });
    const on = await look(active);
    const off = await look(inactive);
    expect(on.weight).toBe(600);
    expect(off.weight).toBeLessThan(600);
    expect(on.color).not.toBe(off.color);
    expect(on.underline).toMatch(/0px -3px 0px 0px inset/);
    expect(off.underline).toBe('none');
    // No folder borders: the active tab is not boxed.
    await expect(active).toHaveCSS('border-top-style', 'none');

    // Focused, it keeps its underline inside the focus ring.
    await active.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await expect(active).toHaveCSS('box-shadow', /0px -3px 0px 0px inset.*0px 0px 0px 2px inset/);

    const height = (await row.boundingBox())!.height;
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(active).toHaveCSS('border-bottom-style', 'solid');
    await expect(active).toHaveCSS('border-bottom-width', '3px');
    await expect(inactive).toHaveCSS('border-bottom-style', 'none');
    expect((await row.boundingBox())!.height).toBe(height);

    // Keyboard focus, so the next tab matches :focus-visible.
    await active.focus();
    await page.keyboard.press('ArrowRight');
    const focused = row.locator('.nav-link:focus-visible');
    await expect(focused).toHaveCount(1);
    await expect(focused).toHaveCSS('outline-style', 'solid');
    await expect(focused).toHaveCSS('outline-width', '2px');
});
