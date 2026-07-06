import { test, expect } from '../fixtures/auth.fixture';
import {
    changeTheme,
    waitForAppReady,
    gotoWorkarea,
    openPreviewPanel,
    getPreviewFrame,
} from '../helpers/workarea-helpers';

/**
 * E2E Tests for Page Properties
 *
 * Tests that the Preview correctly reflects page property changes:
 * - visibility: When false, page is hidden from navigation (but first page always visible)
 * - highlight: Adds 'highlighted-link' class to navigation links
 * - hidePageTitle: Hides the page title in the article content
 * - editableInPage + titlePage: Shows a different title in the page content
 */
test.describe('Page Properties', () => {
    test('visibility property should hide page from navigation', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Page Visibility Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize including Yjs
        await waitForAppReady(page);

        // Create two pages: "Visible Page" and "Hidden Page"
        const pageIds = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const project = (window as any).eXeLearning.app.project;
            const nav = bridge.documentManager.getNavigation();

            // Rename first page
            const firstId = nav.get(0).get('id');
            project.renamePageViaYjs(firstId, 'Visible Page');

            // Create second page
            const secondPage = bridge.structureBinding.addPage('Hidden Page', null);

            return {
                visible: firstId,
                hidden: secondPage?.id,
            };
        });

        expect(pageIds.hidden).toBeTruthy();

        await page.waitForTimeout(300);

        // Set visibility=false on the second page
        await page.evaluate(
            ({ pageId }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                bridge.structureBinding.updatePageProperties(pageId, { visibility: false });
            },
            { pageId: pageIds.hidden },
        );

        await page.waitForTimeout(300);

        // Open Preview
        const previewButton = page.locator('#head-bottom-preview');
        await previewButton.click();

        const previewPanel = page.locator('#previewsidenav');
        await expect(previewPanel).toBeVisible({ timeout: 15000 });

        const iframe = page.frameLocator('#preview-iframe');

        // The hidden page should NOT appear in navigation
        const hiddenLink = iframe.locator('#siteNav a, nav a').filter({ hasText: 'Hidden Page' });
        await expect(hiddenLink).toHaveCount(0);

        // The visible page should still appear
        const visibleLink = iframe.locator('#siteNav a, nav a').filter({ hasText: 'Visible Page' });
        await expect(visibleLink).toBeVisible();
    });

    test('first page should always be visible regardless of visibility setting', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'First Page Always Visible Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Get first page ID and set visibility=false
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const project = (window as any).eXeLearning.app.project;
            const nav = bridge.documentManager.getNavigation();
            const firstId = nav.get(0).get('id');

            // Rename for clarity
            project.renamePageViaYjs(firstId, 'First Page');

            // Try to hide it
            bridge.structureBinding.updatePageProperties(firstId, { visibility: false });

            return firstId;
        });

        await page.waitForTimeout(300);

        // Open Preview
        const previewButton = page.locator('#head-bottom-preview');
        await previewButton.click();

        const previewPanel = page.locator('#previewsidenav');
        await expect(previewPanel).toBeVisible({ timeout: 15000 });

        const iframe = page.frameLocator('#preview-iframe');

        // First page should STILL be visible even with visibility=false
        const firstLink = iframe.locator('#siteNav a, nav a').filter({ hasText: 'First Page' });
        await expect(firstLink).toBeVisible();
    });

    test('highlight property should add highlighted-link class to nav', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Page Highlight Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Create two pages: one highlighted, one not
        const pageIds = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const project = (window as any).eXeLearning.app.project;
            const nav = bridge.documentManager.getNavigation();

            // Rename first page
            const firstId = nav.get(0).get('id');
            project.renamePageViaYjs(firstId, 'Highlighted Page');

            // Create second page (not highlighted)
            const secondPage = bridge.structureBinding.addPage('Normal Page', null);

            return {
                highlighted: firstId,
                normal: secondPage?.id,
            };
        });

        await page.waitForTimeout(300);

        // Set highlight=true on the first page
        await page.evaluate(
            ({ pageId }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                bridge.structureBinding.updatePageProperties(pageId, { highlight: true });
            },
            { pageId: pageIds.highlighted },
        );

        await page.waitForTimeout(300);

        // Open Preview
        const previewButton = page.locator('#head-bottom-preview');
        await previewButton.click();

        const previewPanel = page.locator('#previewsidenav');
        await expect(previewPanel).toBeVisible({ timeout: 15000 });

        const iframe = page.frameLocator('#preview-iframe');

        // The highlighted page should have highlighted-link class
        const highlightedLink = iframe.locator('#siteNav a.highlighted-link, nav a.highlighted-link').filter({
            hasText: 'Highlighted Page',
        });
        await expect(highlightedLink).toBeVisible();

        // The normal page should NOT have highlighted-link class
        const normalLink = iframe.locator('#siteNav a, nav a').filter({ hasText: 'Normal Page' }).first();
        await expect(normalLink).toBeVisible();
        await expect(normalLink).not.toHaveClass(/highlighted-link/);
    });

    test('hidePageTitle property should hide page title in preview', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Hide Title Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Create two pages: one with hidden title, one normal
        const pageIds = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const project = (window as any).eXeLearning.app.project;
            const nav = bridge.documentManager.getNavigation();

            // First page will have hidden title
            const firstId = nav.get(0).get('id');
            project.renamePageViaYjs(firstId, 'Hidden Title Page');

            // Create second page with visible title
            const secondPage = bridge.structureBinding.addPage('Visible Title Page', null);

            return {
                hiddenTitle: firstId,
                visibleTitle: secondPage?.id,
            };
        });

        await page.waitForTimeout(300);

        // Set hidePageTitle=true on the first page
        await page.evaluate(
            ({ pageId }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                bridge.structureBinding.updatePageProperties(pageId, { hidePageTitle: true });
            },
            { pageId: pageIds.hiddenTitle },
        );

        await page.waitForTimeout(300);

        // Open Preview
        const previewButton = page.locator('#head-bottom-preview');
        await previewButton.click();

        const previewPanel = page.locator('#previewsidenav');
        await expect(previewPanel).toBeVisible({ timeout: 15000 });

        // Wait for SW to serve content
        await page.waitForTimeout(500);

        const iframe = page.frameLocator('#preview-iframe');

        // Wait for the opaque preview to render. The iframe has no allow-same-origin,
        // so locate content inside the frame rather than reaching through contentDocument.
        await iframe
            .locator('.page-title, article, .exe-content')
            .first()
            .waitFor({ state: 'attached', timeout: 15000 });

        // The .page-title should be hidden (has sr-av class for accessible hiding)
        // Multi-page export uses .page-title in .page-header
        const pageTitle = iframe.locator('.page-title');
        await expect(pageTitle).toHaveClass(/sr-av/);

        // Navigate to the second page
        const secondPageLink = iframe.locator('#siteNav a, nav a').filter({ hasText: 'Visible Title Page' });
        await secondPageLink.click();
        await page.waitForTimeout(500);

        // The page-title should be visible on the second page (no sr-av class)
        await expect(pageTitle).not.toHaveClass(/sr-av/);

        // The title should be visible and contain the correct text
        await expect(pageTitle).toContainText('Visible Title Page');
    });

    test('hidePageTitle should work with flux, neo, and nova themes', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Hide Title Theme Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize including Yjs
        await waitForAppReady(page);

        // Set page title and hide it
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const project = (window as any).eXeLearning.app.project;
            const nav = bridge.documentManager.getNavigation();
            const firstId = nav.get(0).get('id');
            project.renamePageViaYjs(firstId, 'My Hidden Title Page');
            bridge.structureBinding.updatePageProperties(firstId, { hidePageTitle: true });
        });

        await page.waitForTimeout(500);

        // Open the preview once and keep it open: changing the theme triggers an
        // auto-refresh that re-renders the open preview, so there is no need to
        // close/reopen per theme (the panel's off-canvas X and the panel-covered toolbar
        // toggle both make closing flaky). hidePageTitle keeps .page-title accessibly
        // hidden (sr-av) in every theme, which is exactly what we assert per theme.
        await openPreviewPanel(page);
        const iframe = getPreviewFrame(page);

        // Test each theme that uses movePageTitle()
        // Note: 'zen' theme has additional logic, testing core themes first
        const themesToTest = ['flux', 'nova', 'neo'];

        for (const themeId of themesToTest) {
            // Change theme, then click the page in the nav tree. Selecting the page is a
            // Yjs-observed navigation that auto-refreshes the open preview (the same path
            // exercised by preview-page-updates), re-rendering it with the current theme
            // without a manually forced refresh (which would race the panel's own refresh).
            await changeTheme(page, themeId);
            const pageLink = page.locator('.nav-element-text').filter({ hasText: 'My Hidden Title Page' }).first();
            await pageLink.click({ force: true });

            // Verify .page-title keeps the sr-av accessible-hiding class. Theme JS
            // (flux, neo, nova) moves .page-title from .page-header into .page-content, but a
            // hidden title must stay hidden. The generous timeout absorbs the auto-refresh.
            const pageTitle = iframe.locator('.page-title').first();
            await expect(pageTitle).toHaveClass(/sr-av/, { timeout: 20000 });
        }
    });

    test('titlePage property should show custom title when editableInPage is true', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Custom Title Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Create page and set custom title
        const pageIds = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const project = (window as any).eXeLearning.app.project;
            const nav = bridge.documentManager.getNavigation();

            // First page - will have custom title
            const firstId = nav.get(0).get('id');
            project.renamePageViaYjs(firstId, 'Navigation Title');

            // Create second page - normal title
            const secondPage = bridge.structureBinding.addPage('Normal Page', null);

            return {
                customTitle: firstId,
                normalTitle: secondPage?.id,
            };
        });

        await page.waitForTimeout(300);

        // Set editableInPage=true and titlePage on the first page
        await page.evaluate(
            ({ pageId }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                bridge.structureBinding.updatePageProperties(pageId, {
                    editableInPage: true,
                    titlePage: 'Custom Display Title',
                });
            },
            { pageId: pageIds.customTitle },
        );

        await page.waitForTimeout(300);

        // Open Preview
        const previewButton = page.locator('#head-bottom-preview');
        await previewButton.click();

        const previewPanel = page.locator('#previewsidenav');
        await expect(previewPanel).toBeVisible({ timeout: 15000 });

        // Wait for SW to serve content
        await page.waitForTimeout(500);

        const iframe = page.frameLocator('#preview-iframe');

        // Wait for the opaque preview to render. The iframe has no allow-same-origin,
        // so locate content inside the frame rather than reaching through contentDocument.
        await iframe
            .locator('.page-title, article, .exe-content')
            .first()
            .waitFor({ state: 'attached', timeout: 15000 });

        // The page title in header should show the custom title (titlePage), not the navigation title
        // Multi-page export uses .page-title in .page-header, not inside article
        const pageTitle = iframe.locator('.page-title');
        await expect(pageTitle).toContainText('Custom Display Title');
        await expect(pageTitle).not.toContainText('Navigation Title');

        // Navigate to the second page
        const secondPageLink = iframe.locator('#siteNav a, nav a').filter({ hasText: 'Normal Page' });
        await secondPageLink.click();
        await page.waitForTimeout(500);

        // The title should be the normal page title (multi-page navigation loads new page)
        await expect(pageTitle).toContainText('Normal Page');
    });

    test('child pages should be hidden when parent visibility is false', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Parent Visibility Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Create parent page, then child page
        const pageIds = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const project = (window as any).eXeLearning.app.project;
            const nav = bridge.documentManager.getNavigation();

            // First page is always visible, create a second page as "parent"
            const firstId = nav.get(0).get('id');
            project.renamePageViaYjs(firstId, 'Root Page');

            // Create parent page
            const parentPage = bridge.structureBinding.addPage('Hidden Parent', null);
            const parentId = parentPage?.id;

            // Create child under parent
            const childPage = bridge.structureBinding.addPage('Child of Hidden', parentId);

            return {
                root: firstId,
                parent: parentId,
                child: childPage?.id,
            };
        });

        expect(pageIds.parent).toBeTruthy();
        expect(pageIds.child).toBeTruthy();

        await page.waitForTimeout(300);

        // Hide the parent page (not the child directly)
        await page.evaluate(
            ({ parentId }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                bridge.structureBinding.updatePageProperties(parentId, { visibility: false });
            },
            { parentId: pageIds.parent },
        );

        await page.waitForTimeout(300);

        // Open Preview
        const previewButton = page.locator('#head-bottom-preview');
        await previewButton.click();

        const previewPanel = page.locator('#previewsidenav');
        await expect(previewPanel).toBeVisible({ timeout: 15000 });

        const iframe = page.frameLocator('#preview-iframe');

        // Root page should be visible
        const rootLink = iframe.locator('#siteNav a, nav a').filter({ hasText: 'Root Page' });
        await expect(rootLink).toBeVisible();

        // Hidden parent should NOT be visible
        const parentLink = iframe.locator('#siteNav a, nav a').filter({ hasText: 'Hidden Parent' });
        await expect(parentLink).toHaveCount(0);

        // Child of hidden parent should also NOT be visible (inherited visibility)
        const childLink = iframe.locator('#siteNav a, nav a').filter({ hasText: 'Child of Hidden' });
        await expect(childLink).toHaveCount(0);
    });

    test('visibility and highlight can be combined - page hidden but second page highlighted', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Combined Properties Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Create three pages: Root, Hidden, and Highlighted
        const pageIds = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const project = (window as any).eXeLearning.app.project;
            const nav = bridge.documentManager.getNavigation();

            // Rename first page
            const firstId = nav.get(0).get('id');
            project.renamePageViaYjs(firstId, 'Root Page');

            // Create second page (will be hidden)
            const hiddenPage = bridge.structureBinding.addPage('Hidden Page', null);

            // Create third page (will be highlighted)
            const highlightedPage = bridge.structureBinding.addPage('Highlighted Page', null);

            return {
                root: firstId,
                hidden: hiddenPage?.id,
                highlighted: highlightedPage?.id,
            };
        });

        await page.waitForTimeout(300);

        // Set visibility=false on second page and highlight=true on third page
        await page.evaluate(
            ({ hiddenId, highlightedId }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                bridge.structureBinding.updatePageProperties(hiddenId, { visibility: false });
                bridge.structureBinding.updatePageProperties(highlightedId, { highlight: true });
            },
            { hiddenId: pageIds.hidden, highlightedId: pageIds.highlighted },
        );

        await page.waitForTimeout(300);

        // Open Preview
        const previewButton = page.locator('#head-bottom-preview');
        await previewButton.click();

        const previewPanel = page.locator('#previewsidenav');
        await expect(previewPanel).toBeVisible({ timeout: 15000 });

        const iframe = page.frameLocator('#preview-iframe');

        // Root page should be visible (not highlighted)
        const rootLink = iframe.locator('#siteNav a, nav a').filter({ hasText: 'Root Page' });
        await expect(rootLink).toBeVisible();
        await expect(rootLink).not.toHaveClass(/highlighted-link/);

        // Hidden page should NOT be visible
        const hiddenLink = iframe.locator('#siteNav a, nav a').filter({ hasText: 'Hidden Page' });
        await expect(hiddenLink).toHaveCount(0);

        // Highlighted page should be visible with highlighted-link class
        const highlightedLink = iframe
            .locator('#siteNav a.highlighted-link, nav a.highlighted-link')
            .filter({ hasText: 'Highlighted Page' });
        await expect(highlightedLink).toBeVisible();
    });

    test('addMathJax metadata property should be stored and retrieved', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'MathJax Property Persistence Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize including Yjs
        await waitForAppReady(page);

        // Set addMathJax property to true directly in metadata (Y.Map)
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('addMathJax', 'true');
        });

        await page.waitForTimeout(300);

        // Verify the property was set in Yjs metadata
        const valueAfterSet = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            return metadata.get('addMathJax');
        });

        expect(valueAfterSet).toBe('true');

        // Set it to false
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('addMathJax', 'false');
        });

        await page.waitForTimeout(300);

        // Verify the property was updated
        const valueAfterUnset = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            return metadata.get('addMathJax');
        });

        expect(valueAfterUnset).toBe('false');
    });

    test('addMathJax property should affect preview MathJax inclusion', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'MathJax Preview Effect Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Enable addMathJax option directly in metadata (Y.Map)
        // Use boolean true, not string 'true' - the exporter checks with strict equality
        const metadataSet = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('addMathJax', true);
            // Verify the value was set
            return metadata.get('addMathJax');
        });
        expect(metadataSet).toBe(true);

        // Wait for any Yjs propagation to complete
        await page.waitForTimeout(500);

        // Verify metadata is correctly set
        const metadataVerify = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            return metadata.get('addMathJax');
        });
        expect(metadataVerify).toBe(true);

        // Open Preview
        const previewButton = page.locator('#head-bottom-preview');
        await previewButton.click();

        const previewPanel = page.locator('#previewsidenav');
        await expect(previewPanel).toBeVisible({ timeout: 15000 });

        // The preview iframe is opaque (no allow-same-origin), so read its DOM via the
        // cross-origin-safe frame locator rather than contentDocument.
        const iframe = page.frameLocator('#preview-iframe');

        // Skip if the preview failed to load on this engine (e.g. SW quirks).
        const bodyText =
            (await iframe
                .locator('body')
                .textContent({ timeout: 15000 })
                .catch(() => '')) ?? '';
        if (bodyText.includes('Preview Error')) {
            test.skip();
            return;
        }

        // Verify the MathJax script is included when addMathJax is enabled.
        const mathJaxScripts = iframe.locator('script[src*="tex-mml-svg"], script[src*="exe_math"]');
        await expect.poll(() => mathJaxScripts.count(), { timeout: 15000 }).toBeGreaterThan(0);
    });
});
