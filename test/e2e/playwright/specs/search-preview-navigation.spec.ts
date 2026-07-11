import { test, expect } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    selectPageByIndex,
    addTextIdeviceWithContent,
    enableSearchOption,
    cloneCurrentPage,
    waitForTinyMCEReady,
    setTinyMCEContent,
    gotoWorkarea,
} from '../helpers/workarea-helpers';

/**
 * E2E Tests for Search Navigation in Preview
 *
 * Tests that search result links work correctly when viewing from a subpage
 * in preview mode. The fix ensures that relative links are properly adjusted
 * when navigating from a subpage to avoid incorrect nested URLs.
 *
 * The preview iframe may be opaque (server/HTTP transport: no allow-same-origin),
 * so the parent cannot assume it can read `iframe.contentWindow.location`.
 * Navigation is tracked instead via the `data-preview-page` attribute the panel
 * stamps on every rendered page, which the browser exposes to the parent
 * regardless of origin — working the same across the HTTP and static transports.
 */

/**
 * The page path currently rendered in the preview iframe, read from the
 * cross-origin-safe `data-preview-page` attribute.
 */
async function getPreviewPage(page: import('@playwright/test').Page): Promise<string> {
    return page.evaluate(() => document.querySelector('#preview-iframe')?.getAttribute('data-preview-page') ?? '');
}

/**
 * Wait for the preview to report a different rendered page than `prevPage`.
 */
async function waitForIframeNavigation(
    page: import('@playwright/test').Page,
    prevPage: string,
    timeout = 15000,
): Promise<void> {
    await page.waitForFunction(
        (prev: string) => {
            const curr = document.querySelector('#preview-iframe')?.getAttribute('data-preview-page') ?? '';
            return curr.length > 0 && curr !== prev;
        },
        prevPage,
        { timeout },
    );
}

test.describe('Search in preview - subpage navigation', () => {
    test('should navigate correctly when clicking search results from a subpage', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(90000);
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Search Navigation Test');
        await gotoWorkarea(page, projectUuid);

        // Wait for app initialization
        await waitForAppReady(page);

        // 1. Enable search option
        await enableSearchOption(page);

        // 2. Select first page and add text with searchable content
        await selectPageByIndex(page, 0);
        await addTextIdeviceWithContent(page, '<p>SEARCHTERM_PAGE_ONE unique content first</p>');

        // 3. Clone the page 2 times to have 3 pages total
        await cloneCurrentPage(page);
        await cloneCurrentPage(page);

        // 4. Edit second page with different content
        await selectPageByIndex(page, 1);

        // Edit the existing text iDevice on page 2
        const idevice2 = page.locator('#node-content article .idevice_node.text').first();
        const editBtn2 = idevice2.locator('.btn-edit-idevice');
        await editBtn2.click();

        await waitForTinyMCEReady(page);
        await setTinyMCEContent(page, '<p>SEARCHTERM_PAGE_TWO unique content second</p>');

        const saveBtn2 = idevice2.locator('.btn-save-idevice');
        await saveBtn2.click();
        await page.waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.text');
                return idevice?.getAttribute('mode') !== 'edition';
            },
            undefined,
            { timeout: 15000 },
        );

        // 5. Edit third page with different content
        await selectPageByIndex(page, 2);

        const idevice3 = page.locator('#node-content article .idevice_node.text').first();
        const editBtn3 = idevice3.locator('.btn-edit-idevice');
        await editBtn3.click();

        await waitForTinyMCEReady(page);
        await setTinyMCEContent(page, '<p>SEARCHTERM_PAGE_THREE unique content third</p>');

        const saveBtn3 = idevice3.locator('.btn-save-idevice');
        await saveBtn3.click();
        await page.waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.text');
                return idevice?.getAttribute('mode') !== 'edition';
            },
            undefined,
            { timeout: 15000 },
        );

        // 6. Open preview panel
        const previewBtn = page.locator('#head-bottom-preview');
        await previewBtn.click();

        const previewPanel = page.locator('#previewsidenav');
        await previewPanel.waitFor({ state: 'visible', timeout: 15000 });

        // Wait for iframe to load
        const previewIframe = page.locator('#preview-iframe');
        await previewIframe.waitFor({ state: 'attached', timeout: 10000 });

        // Wait for preview content to load (cross-origin-safe: locate the
        // rendered article inside the opaque frame).
        const iframe = page.frameLocator('#preview-iframe');
        await iframe.locator('article, #siteNav, nav').first().waitFor({ state: 'attached', timeout: 30000 });

        // 7. Navigate to a subpage (page 2) via navigation menu
        const navLinks = iframe.locator('#siteNav a, nav a');
        const navCount = await navLinks.count();
        expect(navCount).toBeGreaterThanOrEqual(2);

        // Capture current page before navigating so we can detect when navigation completes
        const pageBeforeNav = await getPreviewPage(page);

        // Click on second page link to navigate to subpage
        await navLinks.nth(1).click();

        // Wait for the iframe to report the subpage (page path must change and be under html/)
        await waitForIframeNavigation(page, pageBeforeNav);
        await page.waitForFunction(
            () =>
                (document.querySelector('#preview-iframe')?.getAttribute('data-preview-page') ?? '').includes('html/'),
            undefined,
            { timeout: 10000 },
        );

        // 8. Click on search button - now we are on the subpage
        const searchToggler = iframe.locator('#searchBarTogger');
        await searchToggler.waitFor({ state: 'visible', timeout: 15000 });
        await searchToggler.click();

        // 9. Enter search term and search
        const searchInput = iframe.locator('#exe-client-search-text');
        await searchInput.waitFor({ state: 'visible', timeout: 5000 });
        await searchInput.fill('SEARCHTERM');
        await searchInput.press('Enter');

        // 10. Verify search results appear - wait for at least one result link
        const searchResults = iframe.locator('#exe-client-search-results-list a');
        await searchResults.first().waitFor({ timeout: 10000 });
        const resultsCount = await searchResults.count();
        expect(resultsCount).toBeGreaterThanOrEqual(1);

        // 11. Click on a search result (first one)
        // Capture page before click so we can detect navigation
        const pageBeforeFirstClick = await getPreviewPage(page);
        await searchResults.first().click();

        // 12. Wait for iframe to navigate to the search result page (not just article to appear)
        // The click handler briefly shows .page-content before navigation, so we must
        // wait for an actual page change rather than element visibility.
        await waitForIframeNavigation(page, pageBeforeFirstClick);

        const bodyAfterClick = await iframe.locator('body').innerText();
        expect(bodyAfterClick).not.toContain('File not found');
        expect(bodyAfterClick).not.toContain('Cannot GET');
        expect(bodyAfterClick).not.toContain('404');

        // The page should still be valid (has navigation, content area, etc.)
        const hasNav = await iframe.locator('#siteNav, nav').count();
        expect(hasNav).toBeGreaterThan(0);

        // 13. Try clicking on another result from this page (if multiple results exist)
        if (resultsCount >= 2) {
            const searchToggler2 = iframe.locator('#searchBarTogger');
            await searchToggler2.waitFor({ state: 'visible', timeout: 10000 });
            await searchToggler2.click();

            const searchInput2 = iframe.locator('#exe-client-search-text');
            await searchInput2.waitFor({ state: 'visible', timeout: 5000 });
            await searchInput2.fill('SEARCHTERM');
            await searchInput2.press('Enter');

            const searchResults2 = iframe.locator('#exe-client-search-results-list a');
            await searchResults2.first().waitFor({ timeout: 10000 });

            // Click on second result
            const pageBeforeSecondClick = await getPreviewPage(page);
            await searchResults2.nth(1).click();

            // Wait for iframe to navigate to the second search result page
            await waitForIframeNavigation(page, pageBeforeSecondClick);

            const bodyAfterClick2 = await iframe.locator('body').innerText();
            expect(bodyAfterClick2).not.toContain('File not found');
            expect(bodyAfterClick2).not.toContain('404');

            // Page structure should still be intact
            const hasNav2 = await iframe.locator('#siteNav, nav').count();
            expect(hasNav2).toBeGreaterThan(0);
        }
    });
});
