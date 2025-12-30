import { test, expect } from '../fixtures/collaboration.fixture';
import { waitForYjsSync } from '../helpers/sync-helpers';

/**
 * Duplicate Page Prevention Tests
 *
 * These tests verify the fix for a bug where duplicate pages were created
 * when a second client joined an unsaved project.
 *
 * Bug scenario (before fix):
 * 1. Client A creates new project (not saved)
 * 2. Client A makes project public
 * 3. Client B joins the project
 * 4. Result: 2 pages created instead of 1
 *
 * Root cause:
 * - createBlankProjectStructure() was called BEFORE WebSocket sync
 * - Both clients created blank pages independently
 * - After sync, Yjs merged both, resulting in 2 pages
 *
 * Fix:
 * - Blank structure creation is now deferred to AFTER WebSocket sync
 * - ensureBlankStructureIfEmpty() is called in YjsProjectBridge after sync
 * - Only the first client's structure is used
 */

// Server-side page creation is now implemented in src/services/yjs-initializer.ts
// The initial Yjs document with one page is created when the project is created,
// preventing the race condition where multiple clients would create duplicate pages.
test.describe('Duplicate Page Prevention', () => {
    test.setTimeout(120000); // 2 minutes per test

    test('should have exactly 1 page when second client joins unsaved public project', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        // Step 1: Client A creates a new project (this is created but not "saved")
        const projectTitle = `Duplicate Page Test ${Date.now()}`;
        const projectUuid = await createProject(authenticatedPage, projectTitle);

        // Step 2: Navigate Client A to the project
        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);

        // Wait for the project to fully load
        await waitForYjsSync(authenticatedPage);

        // Step 3: Client A makes project public and gets share URL
        // (The project is still "unsaved" - only Yjs state, no server save)
        const shareUrl = await getShareUrl(authenticatedPage);
        expect(shareUrl).toContain(projectUuid);

        // Step 4: Client B joins via share URL
        await joinSharedProject(secondAuthenticatedPage, shareUrl);

        // Step 5: Wait for both clients to sync
        await waitForYjsSync(authenticatedPage);
        await waitForYjsSync(secondAuthenticatedPage);

        // Additional wait to ensure all sync operations complete
        await authenticatedPage.waitForTimeout(2000);

        // Step 6: Count pages on both clients
        const countPagesOnClient = async (page: typeof authenticatedPage) => {
            return page.evaluate(() => {
                const eXe = (window as any).eXeLearning;
                const bridge = eXe?.app?.project?._yjsBridge;
                if (!bridge?.documentManager) {
                    throw new Error('Bridge or documentManager not found');
                }

                const navigation = bridge.documentManager.getNavigation();
                return navigation.length;
            });
        };

        const pagesClientA = await countPagesOnClient(authenticatedPage);
        const pagesClientB = await countPagesOnClient(secondAuthenticatedPage);

        // Both clients should see exactly 1 page
        expect(pagesClientA).toBe(1);
        expect(pagesClientB).toBe(1);
    });

    test('should have consistent page count after multiple clients join', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        // This test verifies the fix works even with fast client joins

        const projectTitle = `Multi-Client Test ${Date.now()}`;
        const projectUuid = await createProject(authenticatedPage, projectTitle);

        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
        await waitForYjsSync(authenticatedPage);

        // Get share URL
        const shareUrl = await getShareUrl(authenticatedPage);

        // Client B joins
        await joinSharedProject(secondAuthenticatedPage, shareUrl);

        // Wait for sync
        await waitForYjsSync(authenticatedPage);
        await waitForYjsSync(secondAuthenticatedPage);
        await authenticatedPage.waitForTimeout(2000);

        // Verify page count
        const getPageCount = async (page: typeof authenticatedPage) => {
            return page.evaluate(() => {
                const eXe = (window as any).eXeLearning;
                const nav = eXe?.app?.project?._yjsBridge?.documentManager?.getNavigation();
                return nav?.length ?? -1;
            });
        };

        const countA = await getPageCount(authenticatedPage);
        const countB = await getPageCount(secondAuthenticatedPage);

        // Both should have same count (1 page)
        expect(countA).toBe(1);
        expect(countB).toBe(1);
    });

    test('should not create duplicate pages when owner has not interacted yet', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        // Edge case: Client A creates project but does nothing, Client B joins quickly

        const projectTitle = `No Interaction Test ${Date.now()}`;
        const projectUuid = await createProject(authenticatedPage, projectTitle);

        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);

        // Immediately make public and get share URL (minimal delay)
        const shareUrl = await getShareUrl(authenticatedPage);

        // Client B joins immediately
        await joinSharedProject(secondAuthenticatedPage, shareUrl);

        // Wait for full sync
        await waitForYjsSync(authenticatedPage);
        await waitForYjsSync(secondAuthenticatedPage);
        await authenticatedPage.waitForTimeout(3000);

        // Check navigation structure via UI elements
        const countNavigationItems = async (page: typeof authenticatedPage) => {
            // Count nodes in the navigation tree
            return page.evaluate(() => {
                const eXe = (window as any).eXeLearning;
                const nav = eXe?.app?.project?._yjsBridge?.documentManager?.getNavigation();
                return nav?.length ?? -1;
            });
        };

        const navCountA = await countNavigationItems(authenticatedPage);
        const navCountB = await countNavigationItems(secondAuthenticatedPage);

        // Should have exactly 1 page
        expect(navCountA).toBe(1);
        expect(navCountB).toBe(1);
    });
});
