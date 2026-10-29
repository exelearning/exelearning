/**
 * Presentation mode for web site exports (issue #2019, PR #2020).
 *
 * The mode is activated by the READER, never stored in the project: opening the
 * export with `?exe-presentation=1` enters the mode (menu collapsed, Left/PageUp
 * and Right/PageDown change page, M shows/hides the menu, T toggles Teacher Mode
 * where available) and shows a pressed "Presentation mode" toggle
 * next to the "made with eXe" badge. The parameter is the state: leaving
 * rewrites it to `=0` in the URL and the navigation links, so the choice
 * survives page changes and reloads without any storage. The export is served
 * from its own origin and opened directly (or embedded by a host page), not
 * through the preview iframe, which never adds the parameter.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import { addPage, changeTheme, gotoWorkarea, serveWebSiteExport, waitForAppReady } from '../helpers/workarea-helpers';

const ORIGIN = 'http://presentation-mode.test';
const SECOND_PAGE = 'Presentation second page';

/**
 * Every page change loads a new document whose deferred `init()` re-enters the
 * mode and binds the key listener in the same call, so waiting on the runtime's
 * own flag guarantees the keys are live before pressing one.
 */
async function expectPresenting(page: Page, active: boolean, menuExpanded = false): Promise<void> {
    await page.waitForFunction(
        expected => (window as any).$exeExport?.presentationMode?.isActive() === expected,
        active,
    );
    // The label never changes; the toggle's state does.
    const control = page.locator('#exe-presentation-toggler');
    await expect(control).toHaveText('Presentation mode');
    await expect(control).toHaveAttribute('aria-pressed', String(active));
    // The mode collapses the menu unless the reader chose otherwise (nav=true); when it
    // is off the menu is the style's business.
    if (active) {
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', String(menuExpanded));
    }
}

async function exportTwoPageSite(
    page: Page,
    createProject: (page: Page, title?: string) => Promise<string>,
    themeId?: string,
): Promise<void> {
    const uuid = await createProject(page, 'Presentation mode');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await addPage(page, SECOND_PAGE);
    if (themeId) await changeTheme(page, themeId);
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

        // The menu can still be opened normally while presenting, and M shows/hides it.
        await page.locator('#siteNavToggler').click();
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('html')).toHaveClass(/mode-presentation/);
        await heading.click();
        await page.keyboard.press('m');
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'false');
        await page.keyboard.press('m');
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'true');

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

    test('the menu the reader chooses with M survives page changes and reloads, and leaving keeps it', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await exportTwoPageSite(page, createProject);

        // The site opens with the menu visible; entering collapses it.
        await page.goto(`${ORIGIN}/index.html?exe-presentation=0`);
        const heading = page.locator('main h1.page-title');
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'true');
        await page.locator('#exe-presentation-toggler').click();
        await expectPresenting(page, true);

        // Leaving on the same page, untouched, restores the menu as it was.
        await page.locator('#exe-presentation-toggler').click();
        await expectPresenting(page, false);
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'true');

        // Back in, M shows the menu: the next page and a reload keep it visible.
        await page.locator('#exe-presentation-toggler').click();
        await expectPresenting(page, true);
        await heading.click();
        await page.keyboard.press('m');
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('a.nav-button-right')).toHaveAttribute('href', /nav=true/);
        await page.keyboard.press('ArrowRight');
        await expect(heading).toHaveText(SECOND_PAGE);
        expect(page.url()).toContain('nav=true');
        await expectPresenting(page, true, true);
        await page.reload();
        await expectPresenting(page, true, true);

        // M hides it again; the previous page keeps it hidden.
        await heading.click();
        await page.keyboard.press('m');
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'false');
        await page.keyboard.press('ArrowLeft');
        await expect(heading).not.toHaveText(SECOND_PAGE);
        await expectPresenting(page, true, false);

        // Leaving keeps the state the reader chose instead of forcing the menu open.
        await page.locator('#exe-presentation-toggler').click();
        await expectPresenting(page, false);
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'false');
    });

    test('a host page can embed the export in presentation mode', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await exportTwoPageSite(page, createProject);

        await page.setContent(
            `<iframe src="${ORIGIN}/index.html?exe-presentation=1" style="width: 1000px; height: 700px"></iframe>`,
        );
        const frame = page.frameLocator('iframe');
        const heading = frame.locator('main h1.page-title');
        await expect(frame.locator('#exe-presentation-toggler')).toHaveAttribute('aria-pressed', 'true');
        await heading.click();
        await page.keyboard.press('ArrowRight');
        await expect(heading).toHaveText(SECOND_PAGE);
        await expect(frame.locator('#exe-presentation-toggler')).toHaveAttribute('aria-pressed', 'true');
    });

    test('M hides the menu at narrow widths after scrolling down', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await exportTwoPageSite(page, createProject);

        // The style's narrow layout, shorter than the menu so it is not pinned (#sidebar-nav.fixed).
        await page.setViewportSize({ width: 400, height: 120 });
        await page.goto(`${ORIGIN}/index.html?exe-presentation=1&nav=true`);
        await expectPresenting(page, true, true);
        await expect(page.locator('#sidebar-nav')).not.toHaveClass(/fixed/);
        // The styles only collapse the menu at this width while it is in view.
        await page.evaluate(() => {
            document.body.style.paddingBottom = '3000px';
            window.scrollTo(0, 2000);
        });
        await expect.poll(() => page.evaluate(() => (window as any).$('#siteNav').isInViewport())).toBe(false);

        await page.keyboard.press('m');
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator('a.nav-button-right')).toHaveAttribute('href', /nav=false/);
    });

    test('the cedec title link keeps the menu the reader chose', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await exportTwoPageSite(page, createProject, 'cedec');

        await page.goto(`${ORIGIN}/index.html?exe-presentation=1&nav=true`);
        await expectPresenting(page, true, true);
        const title = page.locator('#topBarTitle .package-title-link');
        // The style rereads the home link on mousedown/click.
        await title.dispatchEvent('mousedown');
        await expect(title).toHaveAttribute('href', /exe-presentation=1/);
        await expect(title).toHaveAttribute('href', /nav=true/);
    });

    test('the universal breadcrumbs keep the mode', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await exportTwoPageSite(page, createProject, 'universal');

        await page.goto(`${ORIGIN}/index.html?exe-presentation=1`);
        await expectPresenting(page, true);
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('main h1.page-title')).toHaveText(SECOND_PAGE);
        await expectPresenting(page, true);

        // Breadcrumbs are built before the runtime rewrites the menu: their href is read on use.
        const home = page.locator('#siteBreadcrumbsHome');
        await home.dispatchEvent('mousedown');
        await expect(home).toHaveAttribute('href', /exe-presentation=1/);
    });
});
