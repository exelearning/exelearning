import type { Locator } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    changeTheme,
    enableSearchOption,
    selectPageByIndex,
    addTextIdeviceWithContent,
    cloneCurrentPage,
    waitForPreviewContent,
    getPreviewFrame,
} from '../helpers/workarea-helpers';

/**
 * Menu and search togglers accessibility (PR #2389).
 *
 * Every base theme injects a "Menu" toggler (and, when the search box is
 * enabled, a "Search" toggler) into the exported page. This spec checks, in the
 * preview (same renderer and theme files as the real exports), that:
 *
 * - both togglers expose `aria-controls` and keep `aria-expanded` in sync with
 *   the real state of the element they control;
 * - a collapsed menu is really out of reach (`inert`): Neo, Flux and Educablue
 *   only move or shrink it out of sight on desktop, so without `inert` its
 *   links would stay in the tab order while the toggler announces "collapsed";
 * - on desktop the toggler follows the desktop branch of the theme script:
 *   `nav=false` is added to the page buttons when the menu is closed and
 *   removed again when it is reopened, and toggling the menu leaves the search
 *   bar alone. Neo and Flux used to take the low-resolution branch at every
 *   width because `isLowRes()` looked at `float` on a `position: fixed` menu.
 *
 * The preview iframe is wider than 750px with the default desktop viewport, so
 * every theme renders its desktop layout here.
 */

/**
 * Whether `link` can take focus. Focusing an element does not move
 * `document.activeElement` while the iframe's browsing context is not focused
 * (Firefox), so the probe first focuses the menu toggler, which is always
 * focusable, and fails loudly if even that does not take: the collapsed-state
 * check must never pass just because nothing in the frame can be focused.
 */
function canFocus(link: Locator): Promise<boolean> {
    return link.evaluate(a => {
        const toggler = document.getElementById('siteNavToggler') as HTMLElement;
        toggler.focus();
        if (document.activeElement !== toggler) throw new Error('The preview document cannot take focus');
        (a as HTMLElement).focus();
        return document.activeElement === a;
    });
}

test.describe('Theme navigation and search togglers', () => {
    // neo/flux: nav slides off-screen on desktop; educablue: nav shrinks to width 0
    // at every width; base: nav uses display:none (control case).
    for (const themeId of ['neo', 'flux', 'educablue', 'base']) {
        test(`${themeId}: togglers announce and enforce the real menu/search state`, async ({
            authenticatedPage,
            createProject,
        }) => {
            test.setTimeout(90000);
            const page = authenticatedPage;

            const projectUuid = await createProject(page, `Togglers a11y ${themeId}`);
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await enableSearchOption(page);
            await selectPageByIndex(page, 0);
            await addTextIdeviceWithContent(page, '<p>Toggler content</p>');
            // Two pages so the page has a "Next" button to carry nav=false.
            await cloneCurrentPage(page);
            await changeTheme(page, themeId);

            expect(await waitForPreviewContent(page)).toBe(true);
            const iframe = getPreviewFrame(page);

            const navToggler = iframe.locator('#siteNavToggler');
            const nav = iframe.locator('#siteNav');
            const firstNavLink = iframe.locator('#siteNav a').first();
            const nextButton = iframe.locator('.nav-buttons a').first();
            await navToggler.waitFor({ state: 'attached', timeout: 15000 });
            await nextButton.waitFor({ state: 'attached', timeout: 15000 });
            // Give the iframe's browsing context the focus before probing focusability.
            await iframe.locator('main h1').first().click();

            // Initial state: menu open, announced as expanded and reachable.
            await expect(navToggler).toHaveAttribute('aria-controls', 'siteNav');
            await expect(navToggler).toHaveAttribute('aria-expanded', 'true');
            expect(await nav.evaluate(el => el.inert)).toBe(false);
            expect(await canFocus(firstNavLink)).toBe(true);
            expect(await nextButton.getAttribute('href')).not.toContain('nav=false');

            // Collapse: announced as collapsed AND removed from focus/a11y tree.
            await navToggler.click();
            await expect(navToggler).toHaveAttribute('aria-expanded', 'false');
            expect(await nav.evaluate(el => el.inert)).toBe(true);
            expect(await canFocus(firstNavLink)).toBe(false);
            expect(await nextButton.getAttribute('href')).toContain('nav=false');

            // Reopen: desktop branch clears nav=false again.
            await navToggler.click();
            await expect(navToggler).toHaveAttribute('aria-expanded', 'true');
            expect(await nav.evaluate(el => el.inert)).toBe(false);
            expect(await canFocus(firstNavLink)).toBe(true);
            expect(await nextButton.getAttribute('href')).not.toContain('nav=false');

            // Educablue has no search toggler: the search form is always visible.
            const searchToggler = iframe.locator('#searchBarToggler');
            if ((await searchToggler.count()) === 0) return;

            const searchBar = iframe.locator('#exe-client-search');
            await expect(searchToggler).toHaveAttribute('aria-controls', 'exe-client-search');
            await expect(searchToggler).toHaveAttribute('aria-expanded', 'false');
            await expect(searchBar).toBeHidden();

            await searchToggler.click();
            await expect(searchToggler).toHaveAttribute('aria-expanded', 'true');
            await expect(searchBar).toBeVisible();

            // On desktop, toggling the menu must not close the search bar.
            await navToggler.click();
            await expect(navToggler).toHaveAttribute('aria-expanded', 'false');
            await expect(searchBar).toBeVisible();
            await expect(searchToggler).toHaveAttribute('aria-expanded', 'true');
            await navToggler.click();
            await expect(navToggler).toHaveAttribute('aria-expanded', 'true');

            await searchToggler.click();
            await expect(searchToggler).toHaveAttribute('aria-expanded', 'false');
            await expect(searchBar).toBeHidden();
        });
    }

    test('search disabled: no search toggler is injected, so no aria-controls points at nothing', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(60000);
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Togglers a11y no search');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectPageByIndex(page, 0);
        await addTextIdeviceWithContent(page, '<p>Toggler content</p>');
        await changeTheme(page, 'base');

        expect(await waitForPreviewContent(page)).toBe(true);
        const iframe = getPreviewFrame(page);
        await iframe.locator('#siteNavToggler').waitFor({ state: 'attached', timeout: 15000 });

        await expect(iframe.locator('#exe-client-search')).toHaveCount(0);
        await expect(iframe.locator('#searchBarToggler')).toHaveCount(0);
        await expect(iframe.locator('[aria-controls="exe-client-search"]')).toHaveCount(0);
    });
});
