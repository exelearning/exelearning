import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, waitForServiceWorker, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * E2E Tests for Preview Page Updates
 *
 * Tests that the Preview correctly reflects page title changes and reordering.
 *
 * Root causes being tested:
 * 1. Page renames: When a page is renamed, both 'pageName' and 'title' fields
 *    must be updated (ELPX imports set both, but rename only updated pageName)
 * 2. Page reorder: Pages must be sorted by hierarchical 'order' field
 */

test.describe('Preview Page Updates', () => {
    test('should reflect page title changes in Preview via Yjs', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Preview Title Update Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize including Yjs
        await waitForAppReady(page);

        // Get the first page info from Yjs
        const pageInfo = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const nav = bridge.documentManager.getNavigation();
            const firstPage = nav.get(0);
            return {
                id: firstPage.get('id'),
                originalTitle: firstPage.get('pageName') || firstPage.get('title'),
            };
        });

        expect(pageInfo.id).toBeTruthy();
        expect(pageInfo.originalTitle).toBeTruthy();

        // Rename the page via Yjs (simulates what the UI does)
        const newPageName = 'RENAMED VIA YJS ' + Date.now();
        await page.evaluate(
            ({ pageId, newName }) => {
                const project = (window as any).eXeLearning.app.project;
                project.renamePageViaYjs(pageId, newName);
            },
            { pageId: pageInfo.id, newName: newPageName },
        );

        // Wait for Yjs to process
        await page.waitForTimeout(500);

        // Wait for Service Worker to be ready (Firefox takes longer)
        await waitForServiceWorker(page);

        // Open Preview panel via the preview button
        const previewButton = page.locator('#head-bottom-preview');
        await previewButton.click();

        // Wait for preview sidenav panel to be visible
        const previewPanel = page.locator('#previewsidenav');
        await expect(previewPanel).toBeVisible({ timeout: 15000 });

        // Wait for iframe to load
        const previewIframe = page.locator('#preview-iframe');
        await expect(previewIframe).toBeVisible({ timeout: 10000 });

        // Check that the renamed page appears in the preview navigation
        const iframe = page.frameLocator('#preview-iframe');
        const navItem = iframe.locator('#siteNav a, nav a').filter({ hasText: newPageName });
        await expect(navItem).toBeVisible({ timeout: 10000 });

        // Verify the old name is NOT present
        const oldNavItem = iframe.locator('#siteNav a, nav a').filter({ hasText: pageInfo.originalTitle });
        await expect(oldNavItem).toHaveCount(0);
    });

    test('should update both title and pageName fields on rename', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Title Fields Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Get first page ID
        const pageId = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const nav = bridge.documentManager.getNavigation();
            return nav.get(0).get('id');
        });

        // Set both title and pageName to simulate imported ELPX (which sets both)
        await page.evaluate(
            ({ id }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                const nav = bridge.documentManager.getNavigation();
                const doc = bridge.documentManager.getDoc();
                doc.transact(() => {
                    for (let i = 0; i < nav.length; i++) {
                        const pageMap = nav.get(i);
                        if (pageMap.get('id') === id) {
                            pageMap.set('title', 'Old Title From Import');
                            pageMap.set('pageName', 'Old Title From Import');
                            break;
                        }
                    }
                });
            },
            { id: pageId },
        );

        await page.waitForTimeout(200);

        // Now rename via the official API
        const newName = 'New Name After Rename';
        await page.evaluate(
            ({ id, name }) => {
                (window as any).eXeLearning.app.project.renamePageViaYjs(id, name);
            },
            { id: pageId, name: newName },
        );

        await page.waitForTimeout(200);

        // Verify BOTH fields were updated
        const fields = await page.evaluate(
            ({ id }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                const nav = bridge.documentManager.getNavigation();
                for (let i = 0; i < nav.length; i++) {
                    const pageMap = nav.get(i);
                    if (pageMap.get('id') === id) {
                        return {
                            title: pageMap.get('title'),
                            pageName: pageMap.get('pageName'),
                        };
                    }
                }
                return null;
            },
            { id: pageId },
        );

        expect(fields).not.toBeNull();
        expect(fields!.title).toBe(newName);
        expect(fields!.pageName).toBe(newName);
    });

    test('should reflect page order in Preview navigation', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Page Order Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Create multiple pages via Yjs using addPage (correct method)
        const pageNames = ['First Page', 'Second Page', 'Third Page'];
        await page.evaluate(
            ({ names }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                const project = (window as any).eXeLearning.app.project;
                // First page already exists, just rename it
                const nav = bridge.documentManager.getNavigation();
                const firstPageId = nav.get(0).get('id');
                project.renamePageViaYjs(firstPageId, names[0]);

                // Create additional pages using structureBinding.addPage
                for (let i = 1; i < names.length; i++) {
                    bridge.structureBinding.addPage(names[i], null);
                }
            },
            { names: pageNames },
        );

        // Wait for pages to be created in Yjs
        await page.waitForTimeout(500);

        // Wait for Service Worker to be ready (Firefox takes longer)
        await waitForServiceWorker(page);

        // Open Preview
        const previewButton = page.locator('#head-bottom-preview');
        await previewButton.click();

        const previewPanel = page.locator('#previewsidenav');
        await expect(previewPanel).toBeVisible({ timeout: 15000 });

        const iframe = page.frameLocator('#preview-iframe');

        // Wait for the navigation to be loaded in the iframe
        // The iframe needs time to render after the panel becomes visible
        const navLinks = iframe.locator('nav ul li a, #siteNav ul li a');
        await navLinks.first().waitFor({ state: 'attached', timeout: 10000 });

        // Verify all pages are in the preview navigation in correct order
        const count = await navLinks.count();
        expect(count).toBeGreaterThanOrEqual(pageNames.length);

        // Check first three links match our page names in order
        for (let i = 0; i < pageNames.length; i++) {
            const linkText = await navLinks.nth(i).textContent();
            expect(linkText).toBe(pageNames[i]);
        }
    });

    test('should maintain correct order after page movement', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Page Movement Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Create pages A, B, C using correct method
        const pageIds = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const project = (window as any).eXeLearning.app.project;
            const nav = bridge.documentManager.getNavigation();

            // Rename first page to A
            const firstId = nav.get(0).get('id');
            project.renamePageViaYjs(firstId, 'Page A');

            // Create B and C using structureBinding.addPage
            const pageB = bridge.structureBinding.addPage('Page B', null);
            const pageC = bridge.structureBinding.addPage('Page C', null);

            return {
                a: firstId,
                b: pageB?.id,
                c: pageC?.id,
            };
        });

        await page.waitForTimeout(500);

        // Move page C to first position by updating order fields
        await page.evaluate(
            ({ ids }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                const nav = bridge.documentManager.getNavigation();
                const doc = bridge.documentManager.getDoc();

                doc.transact(() => {
                    for (let i = 0; i < nav.length; i++) {
                        const pageMap = nav.get(i);
                        const id = pageMap.get('id');
                        if (id === ids.c) {
                            pageMap.set('order', 0); // C becomes first
                        } else if (id === ids.a) {
                            pageMap.set('order', 1); // A becomes second
                        } else if (id === ids.b) {
                            pageMap.set('order', 2); // B becomes third
                        }
                    }
                });
            },
            { ids: pageIds },
        );

        // Wait for move operation to complete
        await page.waitForTimeout(500);

        // Wait for Service Worker to be ready (Firefox takes longer)
        await waitForServiceWorker(page);

        // Open Preview
        const previewButton = page.locator('#head-bottom-preview');
        await previewButton.click();

        const previewPanel = page.locator('#previewsidenav');
        await expect(previewPanel).toBeVisible({ timeout: 15000 });

        const iframe = page.frameLocator('#preview-iframe');

        // Wait for the navigation to be loaded in the iframe
        const navLinks = iframe.locator('nav ul li a, #siteNav ul li a');
        await navLinks.first().waitFor({ state: 'attached', timeout: 10000 });

        // Verify order is C, A, B
        const firstLink = await navLinks.nth(0).textContent();
        const secondLink = await navLinks.nth(1).textContent();
        const thirdLink = await navLinks.nth(2).textContent();

        expect(firstLink).toBe('Page C');
        expect(secondLink).toBe('Page A');
        expect(thirdLink).toBe('Page B');
    });
});
