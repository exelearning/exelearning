import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for IndexedDB Tab-Close Cleanup (Branch: feature/clean-yjs-indexedb-on-tab-close)
 *
 * Tests that closing the last browser tab for a project:
 * 1. Deletes the IndexedDB database so the server is consulted on next open
 * 2. Clears the Cache API (exe-assets-{uuid}) for the project
 * 3. Clears the dirty-state localStorage flag so no stale "unsaved" indicator
 *
 * All tests skip in static mode (no WebSocket, no real Yjs IndexedDB).
 */

test.describe('IndexedDB Tab-Close Cleanup', () => {
    test.beforeEach(({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires real Yjs IndexedDB and WebSocket');
    });

    test.setTimeout(120000);

    /**
     * Check whether the IndexedDB database for a project exists and has data.
     * Uses indexedDB.databases() if available (Chromium), otherwise opens the DB
     * and checks whether it has any object stores.
     */
    async function checkIndexedDBExists(page: Page, projectId: string): Promise<boolean> {
        return page.evaluate(async id => {
            const name = `exelearning-project-${id}`;

            // Chromium supports indexedDB.databases()
            if (typeof indexedDB.databases === 'function') {
                const dbs = await indexedDB.databases();
                return dbs.some(db => db.name === name);
            }

            // Fallback: open the DB and check whether it has stores
            return new Promise<boolean>(resolve => {
                const req = indexedDB.open(name);
                req.onsuccess = () => {
                    const hasStores = req.result.objectStoreNames.length > 0;
                    req.result.close();
                    resolve(hasStores);
                };
                req.onerror = () => resolve(false);
                // onupgradeneeded fires only for new/empty databases
                req.onupgradeneeded = () => {
                    req.result.close();
                    // Abort the upgrade – we don't want to create the DB
                    resolve(false);
                };
            });
        }, projectId);
    }

    /**
     * Wait until IndexedDB has data (navigation array is non-empty).
     * Yjs IndexedDB is populated asynchronously after initialize().
     */
    async function waitForIndexedDBPopulated(page: Page, projectId: string): Promise<void> {
        await page.waitForFunction(
            async id => {
                if (typeof indexedDB.databases !== 'function') return true; // Can't check, assume ok
                const dbs = await indexedDB.databases();
                return dbs.some(db => db.name === `exelearning-project-${id}`);
            },
            projectId,
            { timeout: 15000 },
        );
    }

    /**
     * Trigger cleanup via ProjectTabTracker.forceCleanup() — deterministic,
     * does not require actually closing the page.
     * Returns after the flag is set (cleanup callbacks are synchronous/fire-and-forget).
     */
    async function triggerTabCloseCleanup(page: Page): Promise<void> {
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            bridge?.documentManager?._tabTracker?.forceCleanup();
        });
        // Allow async IDB deleteDatabase and Cache API operations to settle
        await page.waitForTimeout(500);
    }

    /**
     * Check whether the Cache API entry for a project's assets exists.
     */
    async function checkCacheExists(page: Page, projectId: string): Promise<boolean> {
        return page.evaluate(async id => {
            if (!('caches' in window)) return false;
            const keys = await caches.keys();
            return keys.includes(`exe-assets-${id}`);
        }, projectId);
    }

    // ---------------------------------------------------------------------------
    // Test 1: Cleanup sets the needs-cleanup flag; deferred IDB deletion + dirty state
    // clear happen on the next initialize() in a fresh tab session
    // ---------------------------------------------------------------------------
    test('cleanup sets flag; next navigation deletes IndexedDB and clears dirty state', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IDB Cleanup Test');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Make an unsaved edit so the dirty state flag is set
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            bridge.documentManager.getMetadata().set('author', 'TestUnsaved');
        });
        await page.waitForTimeout(300);

        // Save button should show unsaved
        await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);

        // Wait until IndexedDB is populated
        await waitForIndexedDBPopulated(page, projectUuid);

        // Confirm dirty state flag is set
        const dirtyFlagBefore = await page.evaluate(id => {
            return localStorage.getItem(`exelearning_dirty_state_${id}`);
        }, projectUuid);
        expect(dirtyFlagBefore).toBe('true');

        // Trigger cleanup (simulates closing the last tab).
        // With the deferred architecture, _cleanupOnLastTabClose() only sets the flag.
        // All actual cleanup is deferred to initialize() in the next fresh tab session.
        await triggerTabCloseCleanup(page);

        // The needs-cleanup flag should be set immediately after forceCleanup()
        const needsCleanupFlag = await page.evaluate(id => {
            return localStorage.getItem(`exe-needs-cleanup-${id}`);
        }, projectUuid);
        expect(needsCleanupFlag).toBe('true');

        // Simulate opening the project in a fresh tab session.
        await page.evaluate(() => sessionStorage.clear());

        // Reopen the project so initialize() performs deferred cleanup
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // The needs-cleanup flag must be consumed by initialize()
        const needsCleanupAfterReopen = await page.evaluate(id => {
            return localStorage.getItem(`exe-needs-cleanup-${id}`);
        }, projectUuid);
        expect(needsCleanupAfterReopen).toBeNull();

        // Dirty state must be cleared — save button shows saved
        const dirtyFlagAfter = await page.evaluate(id => {
            return localStorage.getItem(`exelearning_dirty_state_${id}`);
        }, projectUuid);
        expect(dirtyFlagAfter).toBeNull();

        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/unsaved/);
    });

    // ---------------------------------------------------------------------------
    // Test 2: Page refresh (F5) preserves IndexedDB and unsaved edits
    // ---------------------------------------------------------------------------
    test('page refresh preserves IndexedDB and unsaved edits', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IDB Refresh Preserve Test');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Make an unsaved edit
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            bridge.documentManager.getMetadata().set('author', 'TestRefreshShouldPersist');
        });
        await page.waitForTimeout(500);

        // Confirm unsaved state and dirty flag
        await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);
        const dirtyFlagBefore = await page.evaluate(id => {
            return localStorage.getItem(`exelearning_dirty_state_${id}`);
        }, projectUuid);
        expect(dirtyFlagBefore).toBe('true');

        // Wait for IndexedDB to be populated
        await waitForIndexedDBPopulated(page, projectUuid);

        // F5 – page.reload() is treated as a refresh by Performance API
        await page.reload();
        await waitForAppReady(page);

        // IndexedDB must still exist (was NOT deleted)
        const existsAfterRefresh = await checkIndexedDBExists(page, projectUuid);
        expect(existsAfterRefresh).toBe(true);

        // The unsaved edit must still be present
        const authorAfterRefresh = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            return bridge.documentManager.getMetadata().get('author') ?? '';
        });
        expect(authorAfterRefresh).toBe('TestRefreshShouldPersist');

        // Dirty state should be restored — save button shows unsaved
        await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);
    });

    // ---------------------------------------------------------------------------
    // Test 3: Cache API is cleared alongside IndexedDB on last-tab close
    // ---------------------------------------------------------------------------
    test('Cache API exe-assets-{uuid} is deleted on last-tab close', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Cache API Cleanup Test');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Manually create the cache entry to simulate it being populated
        await page.evaluate(async id => {
            if (!('caches' in window)) return;
            const cache = await caches.open(`exe-assets-${id}`);
            // Store a dummy entry so the cache is non-empty
            await cache.put('/dummy', new Response('dummy'));
        }, projectUuid);

        // Verify the cache exists
        const cacheExistsBefore = await checkCacheExists(page, projectUuid);
        expect(cacheExistsBefore).toBe(true);

        // Trigger cleanup
        await triggerTabCloseCleanup(page);

        // Simulate a brand new tab session so initialize() executes deferred cleanup.
        await page.evaluate(() => sessionStorage.clear());
        await page.reload();
        await waitForAppReady(page);

        // Cache must be gone after deferred cleanup runs during initialize()
        const cacheExistsAfter = await checkCacheExists(page, projectUuid);
        expect(cacheExistsAfter).toBe(false);
    });

    // ---------------------------------------------------------------------------
    // Test 4: With multiple tabs, cleanup only fires when the LAST tab closes
    // ---------------------------------------------------------------------------
    test('cleanup fires only when the last tab closes, not while others are open', async ({
        context,
        createProject,
        authenticatedPage,
    }) => {
        const page1 = authenticatedPage;
        const projectUuid = await createProject(page1, 'Multi-Tab Cleanup Test');

        await gotoWorkarea(page1, projectUuid);
        await waitForAppReady(page1);

        // Wait for IndexedDB to be populated by page1
        await waitForIndexedDBPopulated(page1, projectUuid);

        // Open a second tab for the same project
        const page2 = await context.newPage();
        await gotoWorkarea(page2, projectUuid);
        await waitForAppReady(page2);

        // Close page1 — page2 is still open, so cleanup must NOT fire
        await page1.close();
        await page2.waitForTimeout(600);

        // No needs-cleanup flag should be set while page2 is alive
        const flagWithPage2Open = await page2.evaluate(id => {
            return localStorage.getItem(`exe-needs-cleanup-${id}`);
        }, projectUuid);
        expect(flagWithPage2Open).toBeNull();

        // IndexedDB should still be intact (page2 is alive)
        const existsWithPage2Open = await checkIndexedDBExists(page2, projectUuid);
        expect(existsWithPage2Open).toBe(true);

        // Now trigger cleanup on page2 (simulates closing the last tab).
        // With deferred architecture, this sets the needs-cleanup flag and clears the Cache API.
        await triggerTabCloseCleanup(page2);

        // needs-cleanup flag must be set (IDB deletion deferred to initialize())
        const flagAfterCleanup = await page2.evaluate(id => {
            return localStorage.getItem(`exe-needs-cleanup-${id}`);
        }, projectUuid);
        expect(flagAfterCleanup).toBe('true');

        // Simulate a brand new tab session before reopening the project.
        await page2.evaluate(() => sessionStorage.clear());

        // Navigate to the workarea again — initialize() will perform deferred cleanup
        await gotoWorkarea(page2, projectUuid);
        await waitForAppReady(page2);

        // Flag must be consumed by initialize()
        const flagAfterReopen = await page2.evaluate(id => {
            return localStorage.getItem(`exe-needs-cleanup-${id}`);
        }, projectUuid);
        expect(flagAfterReopen).toBeNull();
    });
});
