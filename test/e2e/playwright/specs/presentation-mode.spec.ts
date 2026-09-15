/**
 * Presentation mode for web site exports (issue #2019, PR #2020).
 *
 * The mode is activated by the READER, never stored in the project: opening the
 * export with `?exe-presentation=1` shows a "Presentation mode" control next to
 * the "made with eXe" badge; entering the mode collapses the menu and makes
 * Left/PageUp and Right/PageDown change page. It only exists for a web site
 * export opened as the top-level document, so the export is served from its own
 * origin and opened directly, not through the preview iframe.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import { addPage, gotoWorkarea, serveWebSiteExport, waitForAppReady } from '../helpers/workarea-helpers';

const ORIGIN = 'http://presentation-mode.test';
const SECOND_PAGE = 'Presentation second page';

/**
 * Every page change loads a new document whose deferred `init()` re-binds the
 * key listener; the pressed control is set in that same call, so waiting on it
 * guarantees the keys are live before pressing one.
 */
async function expectPresenting(page: Page): Promise<void> {
    await expect(page.locator('#exe-presentation-toggler')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'false');
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

    test('the reader enters the mode with the control, presents with the keys and the choice survives navigation', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await exportTwoPageSite(page, createProject);

        await page.goto(`${ORIGIN}/index.html?exe-presentation=1`);
        const heading = page.locator('main h1.page-title');
        await expect(heading).toBeVisible();
        const firstTitle = await heading.textContent();

        // The parameter alone changes nothing: control shown, mode off, keys inert.
        const control = page.locator('#exe-presentation-toggler');
        await expect(control).toBeVisible();
        await expect(control).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('html')).not.toHaveClass(/mode-presentation/);
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'true');
        await heading.click();
        await page.keyboard.press('ArrowRight');
        await expect(heading).toHaveText(firstTitle ?? '');

        // Enter: menu collapses, Right goes to the next page and the parameter travels along.
        await control.click();
        await expect(control).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('html')).toHaveClass(/mode-presentation/);
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'false');
        await page.keyboard.press('ArrowRight');
        await expect(heading).toHaveText(SECOND_PAGE);
        expect(page.url()).toContain('exe-presentation=1');

        // Each next page restores the mode on its own: pressed control, collapsed menu, keys live.
        await expectPresenting(page);
        await page.keyboard.press('ArrowLeft');
        await expect(heading).toHaveText(firstTitle ?? '');
        await expectPresenting(page);
        await page.keyboard.press('PageDown');
        await expect(heading).toHaveText(SECOND_PAGE);
        await expectPresenting(page);
        await page.keyboard.press('PageUp');
        await expect(heading).toHaveText(firstTitle ?? '');
        await expectPresenting(page);

        // The menu can still be opened normally while presenting.
        await page.locator('#siteNavToggler').click();
        await expect(page.locator('#siteNavToggler')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('html')).toHaveClass(/mode-presentation/);

        // Leave: keys are inert again and the choice is forgotten.
        await page.locator('#exe-presentation-toggler').click();
        await expect(page.locator('#exe-presentation-toggler')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('html')).not.toHaveClass(/mode-presentation/);
        await heading.click();
        await page.keyboard.press('ArrowRight');
        await expect(heading).toHaveText(firstTitle ?? '');
        await page.reload();
        await expect(page.locator('#exe-presentation-toggler')).toHaveAttribute('aria-pressed', 'false');
    });
});
