/**
 * Presentation mode for web site exports (issue #2019, PR #2020).
 *
 * The mode is activated by the READER, never stored in the project: opening the
 * export with `?exe-presentation=1` enters the mode (menu collapsed, Left/PageUp
 * and Right/PageDown change page) and shows an "Exit presentation mode" control
 * next to the "made with eXe" badge. The parameter is the state: leaving
 * rewrites it to `=0` in the URL and the navigation links, so the choice
 * survives page changes and reloads without any storage. It only exists for a
 * web site export opened as the top-level document, so the export is served
 * from its own origin and opened directly, not through the preview iframe.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import { addPage, gotoWorkarea, serveWebSiteExport, waitForAppReady } from '../helpers/workarea-helpers';

const ORIGIN = 'http://presentation-mode.test';
const SECOND_PAGE = 'Presentation second page';

/**
 * Every page change loads a new document whose deferred `init()` re-enters the
 * mode and binds the key listener in the same call, so waiting on the runtime's
 * own flag guarantees the keys are live before pressing one.
 */
async function expectPresenting(page: Page, active: boolean): Promise<void> {
    await page.waitForFunction(
        expected => (window as any).$exeExport?.presentationMode?.isActive() === expected,
        active,
    );
    await expect(page.locator('#exe-presentation-toggler')).toHaveText(
        active ? 'Exit presentation mode' : 'Presentation mode',
    );
    // The mode collapses the menu; when it is off the menu is the style's business
    // (the style's own ?nav=false may still be in the URL after a key navigation).
    if (active) await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'false');
}

async function exportTwoPageSite(
    page: Page,
    createProject: (page: Page, title?: string) => Promise<string>,
): Promise<void> {
    const uuid = await createProject(page, 'Presentation mode');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await addPage(page, SECOND_PAGE);
    const files = await serveWebSiteExport(page, ORIGIN);
    expect(files).toContain('index.html');
}

test.describe('Presentation mode (web site export)', () => {
    test('injects nothing and captures no key without the parameter', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await exportTwoPageSite(page, createProject);

        await page.goto(`${ORIGIN}/index.html`);
        const heading = page.locator('main h1.page-title');
        await expect(heading).toBeVisible();
        const firstTitle = await heading.textContent();

        await expect(page.locator('#exe-presentation-toggler')).toHaveCount(0);
        await expect(page.locator('a.nav-button-right')).not.toHaveAttribute('href', /exe-presentation/);

        await heading.click();
        await page.keyboard.press('ArrowRight');
        await expect(heading).toHaveText(firstTitle ?? '');
    });

    test('the parameter enters the mode, the keys present, and leaving rewrites the parameter to 0', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await exportTwoPageSite(page, createProject);

        await page.goto(`${ORIGIN}/index.html?exe-presentation=1`);
        const heading = page.locator('main h1.page-title');
        await expect(heading).toBeVisible();
        const firstTitle = await heading.textContent();

        // =1 enters at once: exit control, collapsed menu, links carrying =1.
        await expectPresenting(page, true);
        await expect(page.locator('html')).toHaveClass(/mode-presentation/);
        await expect(page.locator('a.nav-button-right')).toHaveAttribute('href', /exe-presentation=1/);

        // Right/PageDown and Left/PageUp change page; each next page re-enters on its own.
        await page.keyboard.press('ArrowRight');
        await expect(heading).toHaveText(SECOND_PAGE);
        expect(page.url()).toContain('exe-presentation=1');
        await expectPresenting(page, true);
        await page.keyboard.press('ArrowLeft');
        await expect(heading).toHaveText(firstTitle ?? '');
        await expectPresenting(page, true);
        await page.keyboard.press('PageDown');
        await expect(heading).toHaveText(SECOND_PAGE);
        await expectPresenting(page, true);
        await page.keyboard.press('PageUp');
        await expect(heading).toHaveText(firstTitle ?? '');
        await expectPresenting(page, true);

        // The menu can still be opened normally while presenting.
        await page.locator('#siteNavToggler').click();
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('html')).toHaveClass(/mode-presentation/);

        // Leave: the parameter becomes 0 in the URL and the links, keys are inert.
        await page.locator('#exe-presentation-toggler').click();
        await expectPresenting(page, false);
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('html')).not.toHaveClass(/mode-presentation/);
        expect(page.url()).toContain('exe-presentation=0');
        await expect(page.locator('a.nav-button-right')).toHaveAttribute('href', /exe-presentation=0/);
        await heading.click();
        await page.keyboard.press('ArrowRight');
        await expect(heading).toHaveText(firstTitle ?? '');

        // The choice survives a reload and a page change without any storage.
        await page.reload();
        await expectPresenting(page, false);
        await page.locator('a.nav-button-right').click();
        await expect(heading).toHaveText(SECOND_PAGE);
        expect(page.url()).toContain('exe-presentation=0');
        await expectPresenting(page, false);

        // And the control lets the reader come back in.
        await page.locator('#exe-presentation-toggler').click();
        await expectPresenting(page, true);
        await page.keyboard.press('ArrowLeft');
        await expect(heading).toHaveText(firstTitle ?? '');
        await expectPresenting(page, true);
    });
});
