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
 * when navigating from /viewer/html/subpage.html to avoid incorrect URLs
 * like /viewer/html/html/page.html.
 */

/**
 * Wait for the preview iframe to navigate to a new URL and fully load.
 * More reliable than waiting for specific elements, which may briefly appear
 * during transitions.
 */
async function waitForIframeNavigation(
    page: import('@playwright/test').Page,
    prevUrl: string,
    timeout = 15000,
): Promise<void> {
    await page.waitForFunction(
        (prev: string) => {
            const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
            try {
                const doc = iframe?.contentDocument ?? iframe?.contentWindow?.document;
                const curr = iframe?.contentWindow?.location?.href ?? '';
                // URL must change and new document must finish loading.
                // Do NOT gate on #siteNav: if navigation goes to a "not found" page,
                // it won't have #siteNav but we still want the function to return
                // (so the test can assert on the correct error content).
                return curr !== prev && curr.length > 0 && doc?.readyState === 'complete';
            } catch {
                return false;
            }
        },
        prevUrl,
        { timeout },
    );
}

/**
 * Get current URL of the preview iframe from the main page context.
 */
async function getIframeUrl(page: import('@playwright/test').Page): Promise<string> {
    return page.evaluate(() => {
        const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
        try {
            return iframe?.contentWindow?.location?.href ?? '';
        } catch {
            return '';
        }
    });
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

        // Wait for preview content to load
        await page.waitForFunction(
            () => {
                const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
                if (!iframe) return false;
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    return doc?.body && doc.body.innerHTML.length > 200;
                } catch {
                    return false;
                }
            },
            undefined,
            { timeout: 30000 },
        );

        await page.waitForTimeout(500);

        const iframe = page.frameLocator('#preview-iframe');

        // 7. Navigate to a subpage (page 2) via navigation menu
        const navLinks = iframe.locator('#siteNav a, nav a');
        const navCount = await navLinks.count();
        expect(navCount).toBeGreaterThanOrEqual(2);

        // Capture current URL before navigating so we can detect when navigation completes
        const urlBeforeNav = await getIframeUrl(page);

        // Click on second page link to navigate to subpage
        await navLinks.nth(1).click();

        // Wait for the iframe to fully navigate to the subpage (URL must change and page must be ready)
        await waitForIframeNavigation(page, urlBeforeNav);

        // Additionally wait for the subpage URL to contain /html/ (confirms we're on a subpage)
        await page.waitForFunction(
            () => {
                const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
                try {
                    return iframe?.contentWindow?.location?.pathname?.includes('/html/') ?? false;
                } catch {
                    return false;
                }
            },
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
        // Capture URL before click so we can detect navigation
        const urlBeforeFirstClick = await getIframeUrl(page);
        await searchResults.first().click();

        // 12. Wait for iframe to navigate to the search result page (not just article to appear)
        // The click handler briefly shows .page-content before navigation, so we must
        // wait for an actual URL change + page load rather than element visibility.
        await waitForIframeNavigation(page, urlBeforeFirstClick);

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
            const urlBeforeSecondClick = await getIframeUrl(page);
            await searchResults2.nth(1).click();

            // Wait for iframe to navigate to the second search result page
            await waitForIframeNavigation(page, urlBeforeSecondClick);

            const bodyAfterClick2 = await iframe.locator('body').innerText();
            expect(bodyAfterClick2).not.toContain('File not found');
            expect(bodyAfterClick2).not.toContain('404');

            // Page structure should still be intact
            const hasNav2 = await iframe.locator('#siteNav, nav').count();
            expect(hasNav2).toBeGreaterThan(0);
        }
    });
});
