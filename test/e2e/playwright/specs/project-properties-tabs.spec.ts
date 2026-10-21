import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * Project properties tabs in forced colors mode (Windows High Contrast).
 *
 * The active tab is marked with an inset box-shadow, which forced colors mode
 * removes, so in that mode it also gets a real bottom border. The tab loses the
 * same height from its padding, so marking it does not make it taller.
 */

test.describe('Project properties tabs', () => {
    test('mark the active tab with a border in forced colors mode', async ({
        authenticatedPage,
        createProject,
        browserName,
    }) => {
        // Playwright only emulates forced colors in Chromium
        test.skip(browserName !== 'chromium', 'forcedColors emulation is Chromium-only');

        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Properties Tabs Forced Colors');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await page.emulateMedia({ forcedColors: 'active' });
        await page.locator('#head-top-settings-button').click();

        const activeTab = page.locator('.project-properties-tab.active');
        const inactiveTab = page.locator('.project-properties-tab:not(.active)').first();
        await activeTab.waitFor({ state: 'visible', timeout: 10000 });

        await expect(activeTab).toHaveCSS('border-bottom-style', 'solid');
        await expect(activeTab).toHaveCSS('border-bottom-width', '2px');
        await expect(inactiveTab).toHaveCSS('border-bottom-style', 'none');

        const activeBox = await activeTab.boundingBox();
        const inactiveBox = await inactiveTab.boundingBox();
        expect(activeBox?.height).toBe(inactiveBox?.height);
    });
});
