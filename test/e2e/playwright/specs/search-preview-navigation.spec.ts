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

test.describe('Search in preview - subpage navigation', () => {
    test('should navigate correctly when clicking search results from a subpage', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(180000);
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
            { timeout: 30000 },
        );

        await page.waitForTimeout(2000);

        const iframe = page.frameLocator('#preview-iframe');

        // 7. Navigate to a subpage (page 2) via navigation menu
        const navLinks = iframe.locator('#siteNav a, nav a');
        const navCount = await navLinks.count();
        expect(navCount).toBeGreaterThanOrEqual(2);

        // Click on second page link to navigate to subpage
        await navLinks.nth(1).click();
        await page.waitForTimeout(2000);

        // 8. Click on search button
        const searchToggler = iframe.locator('#searchBarTogger');
        await searchToggler.waitFor({ state: 'visible', timeout: 10000 });
        await searchToggler.click();
        await page.waitForTimeout(500);

        // 9. Enter search term and search
        const searchInput = iframe.locator('#exe-client-search-text');
        await searchInput.waitFor({ state: 'visible', timeout: 5000 });
        await searchInput.fill('SEARCHTERM');
        await searchInput.press('Enter');
        await page.waitForTimeout(2000);

        // 10. Verify search results appear
        const searchResults = iframe.locator('#exe-client-search-results-list a');
        const resultsCount = await searchResults.count();
        expect(resultsCount).toBeGreaterThanOrEqual(1);

        // 11. Click on a search result (first one)
        await searchResults.first().click();
        await page.waitForTimeout(2000);

        // 12. Verify navigation worked - should NOT show "File not found" or 404
        const bodyAfterClick = await iframe.locator('body').innerText();
        expect(bodyAfterClick).not.toContain('File not found');
        expect(bodyAfterClick).not.toContain('Cannot GET');
        expect(bodyAfterClick).not.toContain('404');

        // The page should still be valid (has navigation, content area, etc.)
        const hasNav = await iframe.locator('#siteNav, nav').count();
        expect(hasNav).toBeGreaterThan(0);

        // 13. Try clicking on another result from this page (if multiple results exist)
        if (resultsCount >= 2) {
            await searchToggler.click();
            await page.waitForTimeout(500);

            const searchInput2 = iframe.locator('#exe-client-search-text');
            await searchInput2.fill('SEARCHTERM');
            await searchInput2.press('Enter');
            await page.waitForTimeout(2000);

            const searchResults2 = iframe.locator('#exe-client-search-results-list a');

            // Click on second result
            await searchResults2.nth(1).click();
            await page.waitForTimeout(2000);

            // Verify navigation worked again - no error page
            const bodyAfterClick2 = await iframe.locator('body').innerText();
            expect(bodyAfterClick2).not.toContain('File not found');
            expect(bodyAfterClick2).not.toContain('404');

            // Page structure should still be intact
            const hasNav2 = await iframe.locator('#siteNav, nav').count();
            expect(hasNav2).toBeGreaterThan(0);
        }
    });
});
