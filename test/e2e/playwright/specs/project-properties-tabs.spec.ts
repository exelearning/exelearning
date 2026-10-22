import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * Project properties tabs in forced colors mode (Windows High Contrast).
 *
 * The active tab is marked with an inset box-shadow and the focused tab with an
 * inset ring, both of which forced colors mode removes. In that mode the active
 * tab gets a real bottom border, taken from its padding so the tab row does not
 * grow, and the focused tab gets a real outline.
 *
 * Playwright only emulates forced colors in Chromium, so the Firefox project
 * ignores this spec (see `testIgnore` in playwright.config.ts).
 */

test.describe('Project properties tabs', () => {
    test('mark the active and focused tabs in forced colors mode', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Properties Tabs Forced Colors');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await page.locator('#head-top-settings-button').click();

        const tabRow = page.locator('.project-properties-tabs');
        const activeTab = page.locator('.project-properties-tab.active');
        const inactiveTab = page.locator('.project-properties-tab:not(.active)').first();
        await activeTab.waitFor({ state: 'visible', timeout: 10000 });

        // Tabs stretch to the tallest one, so a taller active tab shows up as a taller row
        const normalRowHeight = (await tabRow.boundingBox())?.height;

        await page.emulateMedia({ forcedColors: 'active' });

        await expect(activeTab).toHaveCSS('border-bottom-style', 'solid');
        await expect(activeTab).toHaveCSS('border-bottom-width', '2px');
        await expect(inactiveTab).toHaveCSS('border-bottom-style', 'none');
        expect((await tabRow.boundingBox())?.height).toBe(normalRowHeight);

        // Keyboard focus, so the next tab matches :focus-visible
        await activeTab.focus();
        await page.keyboard.press('Tab');
        const focusedTab = page.locator('.project-properties-tab:focus-visible');
        await expect(focusedTab).toHaveCount(1);
        await expect(focusedTab).toHaveCSS('outline-style', 'solid');
        await expect(focusedTab).toHaveCSS('outline-width', '2px');
    });
});
