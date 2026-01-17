import { test, expect, Page, waitForLoadingScreenHidden } from '../fixtures/auth.fixture';

/**
 * E2E Tests for Search Navigation in Preview
 *
 * Tests that search result links work correctly when viewing from a subpage
 * in preview mode. The fix ensures that relative links are properly adjusted
 * when navigating from /viewer/html/subpage.html to avoid incorrect URLs
 * like /viewer/html/html/page.html.
 */

/**
 * Helper to select a non-root page node in the navigation tree
 */
async function selectPageNode(page: Page, index = 0): Promise<boolean> {
    const pageNodes = page.locator('.nav-element:not([nav-id="root"]) .nav-element-text');
    const count = await pageNodes.count();

    if (count > index) {
        const element = pageNodes.nth(index);
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.click({ timeout: 5000 });
        await page.waitForTimeout(500);
        return true;
    }
    return false;
}

/**
 * Helper to add a text iDevice with content using TinyMCE API
 */
async function addTextIdeviceWithContent(page: Page, content: string): Promise<void> {
    // Expand "Information and presentation" category if collapsed
    const infoCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }),
        })
        .first();

    if ((await infoCategory.count()) > 0) {
        const isCollapsed = await infoCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            const heading = infoCategory.locator('h3.idevice_category_name');
            await heading.click();
            await page.waitForTimeout(800);
        }
    }

    // Click on text iDevice
    const textIdevice = page.locator('.idevice_item[id="text"]').first();
    await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await textIdevice.click();

    // Wait for iDevice to appear
    const textIdeviceNode = page.locator('#node-content article .idevice_node.text').first();
    await textIdeviceNode.waitFor({ timeout: 15000 });

    // Wait for TinyMCE iframe
    await page.waitForSelector('.tox-edit-area__iframe', { timeout: 15000 });

    // Wait for TinyMCE to be ready
    await page.waitForFunction(
        () => {
            const editor = (window as any).tinymce?.activeEditor;
            return !!editor && editor.initialized;
        },
        null,
        { timeout: 15000 },
    );

    // Set content via TinyMCE API
    await page.evaluate(newContent => {
        const editor = (window as any).tinymce?.activeEditor;
        if (!editor) return;
        editor.setContent(`<p>${newContent}</p>`);
        editor.fire('change');
        editor.fire('input');
        editor.setDirty(true);
    }, content);

    // Wait for dirty flag
    await page.waitForFunction(() => {
        const editor = (window as any).tinymce?.activeEditor;
        return !!editor && editor.isDirty();
    });

    // Save the iDevice
    const saveBtn = textIdeviceNode.locator('.btn-save-idevice');
    if ((await saveBtn.count()) > 0) {
        await saveBtn.click();
    }

    // Wait for save to complete
    await page.waitForFunction(
        expectedContent => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            if (!idevice) return false;
            const mode = idevice.getAttribute('mode');
            if (mode === 'edition') return false;
            const nodeContent = document.querySelector('#node-content');
            return nodeContent?.textContent?.includes(expectedContent) ?? false;
        },
        content,
        { timeout: 20000 },
    );
}

/**
 * Helper to enable search option in project properties
 */
async function enableSearchOption(page: Page): Promise<void> {
    // Click Project Properties button
    const propertiesButton = page.locator('#head-top-settings-button');
    await propertiesButton.waitFor({ state: 'visible', timeout: 10000 });
    await propertiesButton.click();
    await page.waitForTimeout(1000);

    // Expand "Export options" section
    const exportSection = page.getByRole('button', { name: /Export options|Opciones de exportación/i }).first();
    await exportSection.scrollIntoViewIfNeeded({ timeout: 10000 });

    const isExpanded = (await exportSection.getAttribute('aria-expanded')) === 'true';
    if (!isExpanded) {
        await exportSection.click();
        await page.waitForTimeout(500);
    }

    // Find and enable the search toggle
    const searchToggle = page.locator('input[property="pp_addSearchBox"]');
    await searchToggle.scrollIntoViewIfNeeded({ timeout: 10000 });

    const isChecked = await searchToggle.isChecked();
    if (!isChecked) {
        const toggleItem = page.locator('.toggle-item').filter({ has: searchToggle }).first();
        if ((await toggleItem.count()) > 0) {
            await toggleItem.click();
        } else {
            await searchToggle.click({ force: true });
        }
        await page.waitForTimeout(500);
    }

    // Verify metadata was updated
    await page.waitForFunction(
        () => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const metadata = bridge?.documentManager?.getMetadata();
            const value = metadata?.get('addSearchBox');
            return value === true || value === 'true';
        },
        { timeout: 5000 },
    );
}

/**
 * Helper to clone the currently selected page
 */
async function cloneCurrentPage(page: Page): Promise<void> {
    const cloneBtn = page.locator('.button_nav_action.action_clone');
    await cloneBtn.waitFor({ state: 'visible', timeout: 5000 });
    await cloneBtn.click();
    await page.waitForTimeout(1500);

    // Close rename modal by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Wait for modal to close
    await page.waitForFunction(() => !document.querySelector('.modal.show'), { timeout: 5000 }).catch(() => {});
}

test.describe('Search in preview - subpage navigation', () => {
    test('should navigate correctly when clicking search results from a subpage', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(180000);
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Search Navigation Test');
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        // Wait for app initialization
        await page.waitForFunction(
            () => {
                const app = (window as any).eXeLearning?.app;
                return app?.project?._yjsBridge !== undefined;
            },
            { timeout: 30000 },
        );

        await waitForLoadingScreenHidden(page);

        // 1. Enable search option
        await enableSearchOption(page);

        // 2. Select first page and add text with searchable content
        await selectPageNode(page, 0);
        await addTextIdeviceWithContent(page, 'SEARCHTERM_PAGE_ONE unique content first');

        // 3. Clone the page 2 times to have 3 pages total
        await cloneCurrentPage(page);
        await cloneCurrentPage(page);

        // 4. Edit second page with different content
        await selectPageNode(page, 1);
        await page.waitForTimeout(500);

        // Edit the existing text iDevice on page 2
        const idevice2 = page.locator('#node-content article .idevice_node.text').first();
        const editBtn2 = idevice2.locator('.btn-edit-idevice');
        await editBtn2.click();
        await page.waitForTimeout(500);

        await page.waitForFunction(
            () => {
                const editor = (window as any).tinymce?.activeEditor;
                return !!editor && editor.initialized;
            },
            null,
            { timeout: 15000 },
        );

        await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            if (!editor) return;
            editor.setContent('<p>SEARCHTERM_PAGE_TWO unique content second</p>');
            editor.fire('change');
            editor.setDirty(true);
        });

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
        await selectPageNode(page, 2);
        await page.waitForTimeout(500);

        const idevice3 = page.locator('#node-content article .idevice_node.text').first();
        const editBtn3 = idevice3.locator('.btn-edit-idevice');
        await editBtn3.click();
        await page.waitForTimeout(500);

        await page.waitForFunction(
            () => {
                const editor = (window as any).tinymce?.activeEditor;
                return !!editor && editor.initialized;
            },
            null,
            { timeout: 15000 },
        );

        await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            if (!editor) return;
            editor.setContent('<p>SEARCHTERM_PAGE_THREE unique content third</p>');
            editor.fire('change');
            editor.setDirty(true);
        });

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
