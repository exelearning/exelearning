import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { ShareModalPage } from '../pages/share-modal.page';
import { gotoWorkarea } from '../helpers/workarea-helpers';
import type { Locator, Page } from '@playwright/test';

/**
 * Editor layout in a tablet viewport (issues #2638 and #2650)
 *
 * 810x1080 is an iPad in portrait: below 1200px the left panels start collapsed and
 * Save and Share show their icon only.
 */
const TABLET_PORTRAIT = { width: 810, height: 1080 };
const TABLET_LANDSCAPE = { width: 1080, height: 810 };

async function resizeAndWaitForEvent(page: Page, size: { width: number; height: number }): Promise<void> {
    await page.evaluate(() => {
        (window as any).__exeResized = false;
        window.addEventListener('resize', () => ((window as any).__exeResized = true), { once: true });
    });
    await page.setViewportSize(size);
    await page.waitForFunction(() => (window as any).__exeResized === true);
}

// Bootstrap's tooltip shows the text, with no native title tooltip on top of it
async function expectTooltip(page: Page, button: Locator, text: string): Promise<void> {
    await expect(button).not.toHaveAttribute('title');
    await page.mouse.move(0, 0);
    await button.hover();
    await expect(page.getByRole('tooltip')).toHaveText(text);
}

test.describe('Tablet layout', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
        await authenticatedPage.setViewportSize(TABLET_PORTRAIT);
    });

    test('fits the toolbar and the content, with the panels collapsed', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Tablet Layout Project');
        await gotoWorkarea(page, projectUuid);

        await expect(page.locator('body')).toHaveClass(/left-column-hidden/);

        const metrics = await page.evaluate(() => {
            const navbar = document.querySelector('#eXeLearningNavbar') as HTMLElement;
            return {
                pageScrollWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
                navbarScrollWidth: navbar.scrollWidth,
                navbarClientWidth: navbar.clientWidth,
            };
        });
        expect(metrics.pageScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(metrics.navbarScrollWidth).toBeLessThanOrEqual(metrics.navbarClientWidth);
    });

    test('keeps the panels open after reopening them by hand and rotating the tablet', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Tablet Panels Project');
        await gotoWorkarea(page, projectUuid);

        const body = page.locator('body');
        await expect(body).toHaveClass(/left-column-hidden/);

        await page.locator('#exe-panels-toggler').click();
        await expect(body).not.toHaveClass(/left-column-hidden/);

        // Still below 1200px: the resize must not collapse panels the user opened
        await resizeAndWaitForEvent(page, TABLET_LANDSCAPE);
        await expect(body).not.toHaveClass(/left-column-hidden/);
    });

    test('names the icon-only Share button after the project visibility', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        skipInStaticMode(test, testInfo, 'Server API for sharing');
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Tablet Share Project');
        await gotoWorkarea(page, projectUuid);

        const shareButton = page.locator('#head-top-share-button');
        await expect(shareButton).toHaveAccessibleName('Share');

        const shareModal = new ShareModalPage(page);
        await shareButton.click();
        await shareModal.waitForOpen();
        await shareModal.setVisibility('public');
        await expect(shareButton).toHaveAccessibleName('Shared');
        await shareModal.close();
        await expectTooltip(page, shareButton, 'Shared');

        // The visibility is stored: a reload names the button from the server state
        await gotoWorkarea(page, projectUuid);
        await expect(shareButton).toHaveAccessibleName('Shared');
        await expectTooltip(page, shareButton, 'Shared');
    });
});
