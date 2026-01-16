/**
 * E2E Tests for: Yjs Binary Data Integrity
 *
 * Tests that Yjs document binary data is not corrupted during save/load cycles.
 * This is critical for verifying that the base64 encoding solution for MySQL/MariaDB
 * works correctly, and that binary data round-trips properly across all databases.
 *
 * The test imports an ELP, extracts detailed document state, saves to server,
 * reloads, and verifies all data matches exactly.
 */
import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import type { Page } from '@playwright/test';

const ELP_FIXTURE = 'basic-example.elp';

interface PageData {
    id: string;
    title: string;
    blockCount: number;
    childCount: number;
}

interface DocumentSnapshot {
    title: string;
    author: string;
    language: string;
    theme: string;
    pageCount: number;
    pages: PageData[];
    totalBlocks: number;
}

/**
 * Import the ELP fixture via File menu
 */
async function importElpFixture(page: Page, fixtureName: string): Promise<void> {
    const fixturePath = path.resolve(__dirname, `../../../fixtures/${fixtureName}`);

    // Open File menu
    await page.locator('#dropdownFile').click();
    await page.waitForTimeout(300);

    // Click Import ELP option
    const importOption = page.locator('#navbar-button-import-elp');
    await expect(importOption).toBeVisible({ timeout: 5000 });
    await importOption.click();

    // Click Continue in confirmation dialog
    const continueButton = page.getByRole('button', { name: /Continue|Continuar/i });
    await expect(continueButton).toBeVisible({ timeout: 5000 });

    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
    await continueButton.click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    // Wait for upload progress modal to appear and then hide
    // The modal shows during import and hides when complete
    await page.waitForFunction(
        () => {
            const modal = document.querySelector('#uploadProgressModal');
            // First wait for modal to appear, then wait for it to hide
            const win = window as any;
            if (!win.__modalSeen) {
                if (modal?.classList.contains('show')) {
                    win.__modalSeen = true;
                }
                return false;
            }
            // Modal was shown, now wait for it to hide
            return !modal || !modal.classList.contains('show');
        },
        { timeout: 120000, polling: 500 },
    );

    // Clean up modal tracking
    await page.evaluate(() => {
        delete (window as any).__modalSeen;
    });

    // Wait for navigation to be populated
    await page.waitForFunction(
        () => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            if (!bridge) return false;
            const yDoc = bridge.getDocumentManager()?.getDoc();
            if (!yDoc) return false;
            const navigation = yDoc.getArray('navigation');
            return navigation && navigation.length >= 1;
        },
        { timeout: 30000 },
    );

    // Wait for page count to stabilize (no changes for 3 seconds)
    // This is critical for Firefox which may be slower to process large ELPs
    await page.waitForFunction(
        () => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            if (!bridge) return false;
            const yDoc = bridge.getDocumentManager()?.getDoc();
            if (!yDoc) return false;
            const navigation = yDoc.getArray('navigation');
            if (!navigation) return false;

            // Recursive count of all pages
            const countPages = (pages: any): number => {
                let count = 0;
                if (!pages) return count;
                for (let i = 0; i < pages.length; i++) {
                    count++;
                    const pageMap = pages.get(i);
                    const children = pageMap?.get('children');
                    if (children) count += countPages(children);
                }
                return count;
            };
            const currentCount = countPages(navigation);

            // Store/check the page count to detect stabilization
            const win = window as any;
            if (!win.__importPageCount) {
                win.__importPageCount = currentCount;
                win.__importStableTime = Date.now();
                return false;
            }

            if (win.__importPageCount !== currentCount) {
                win.__importPageCount = currentCount;
                win.__importStableTime = Date.now();
                return false;
            }

            // Page count stable for 3 seconds = import complete (increased for Firefox)
            return Date.now() - win.__importStableTime >= 3000;
        },
        { timeout: 120000, polling: 500 },
    );

    // Clean up the temporary window variables
    await page.evaluate(() => {
        const win = window as any;
        delete win.__importPageCount;
        delete win.__importStableTime;
    });

    // Additional wait for all handlers to complete
    await page.waitForTimeout(2000);
}

/**
 * Click the save button and wait for save to complete
 */
async function saveProject(page: Page): Promise<void> {
    const saveButton = page.locator('#head-top-save-button');
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    // Wait for save to complete
    await page.waitForFunction(
        () => {
            const saveBtn = document.querySelector('#head-top-save-button');
            return saveBtn && !saveBtn.classList.contains('saving');
        },
        { timeout: 30000 },
    );

    await page.waitForTimeout(2000);
}

/**
 * Extract detailed document snapshot for comparison
 */
async function getDocumentSnapshot(page: Page): Promise<DocumentSnapshot> {
    return page.evaluate(() => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        if (!bridge) throw new Error('No yjsBridge');

        const docManager = bridge.getDocumentManager();
        if (!docManager) throw new Error('No documentManager');

        const yDoc = docManager.getDoc();
        if (!yDoc) throw new Error('No yDoc');

        const metadata = docManager.getMetadata();
        const navigation = yDoc.getArray('navigation');

        // Extract page data recursively
        const pages: { id: string; title: string; blockCount: number; childCount: number }[] = [];
        let totalBlocks = 0;

        const extractPages = (navArray: any, depth = 0) => {
            for (let i = 0; i < navArray.length; i++) {
                const pageMap = navArray.get(i);
                if (!pageMap) continue;

                const id = pageMap.get('id') || pageMap.get('pageId') || '';
                const title = pageMap.get('title') || pageMap.get('pageName') || '';
                const blocks = pageMap.get('blocks');
                const children = pageMap.get('children');

                const blockCount = blocks ? blocks.length : 0;
                const childCount = children ? children.length : 0;

                totalBlocks += blockCount;
                pages.push({ id, title, blockCount, childCount });

                // Recurse into children
                if (children && children.length > 0) {
                    extractPages(children, depth + 1);
                }
            }
        };

        extractPages(navigation);

        return {
            title: metadata?.get('title') || '',
            author: metadata?.get('author') || '',
            language: metadata?.get('language') || '',
            theme: metadata?.get('theme') || '',
            pageCount: pages.length,
            pages,
            totalBlocks,
        };
    });
}

/**
 * Wait for app to be fully initialized
 */
async function waitForAppReady(page: Page): Promise<void> {
    await page.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsBridge !== undefined, {
        timeout: 30000,
    });

    await page.waitForFunction(
        () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
        { timeout: 30000 },
    );
}

test.describe('Yjs Binary Data Integrity', () => {
    test('should preserve all document data after save and reload', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Binary Integrity Test');

        // Navigate to project
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);

        // Import ELP fixture
        await importElpFixture(page, ELP_FIXTURE);

        // Take snapshot BEFORE save
        const beforeSave = await getDocumentSnapshot(page);
        expect(beforeSave.pageCount).toBeGreaterThan(0);

        // Save the project
        await saveProject(page);

        // Reload the page completely
        await page.reload();
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);

        // Take snapshot AFTER reload
        const afterReload = await getDocumentSnapshot(page);

        // Verify metadata preserved
        expect(afterReload.title).toBe(beforeSave.title);
        expect(afterReload.author).toBe(beforeSave.author);
        expect(afterReload.language).toBe(beforeSave.language);
        expect(afterReload.theme).toBe(beforeSave.theme);

        // Verify page count preserved
        expect(afterReload.pageCount).toBe(beforeSave.pageCount);

        // Verify total blocks preserved
        expect(afterReload.totalBlocks).toBe(beforeSave.totalBlocks);

        // Verify each page's data preserved
        for (let i = 0; i < beforeSave.pages.length; i++) {
            const pageBefore = beforeSave.pages[i];
            const pageAfter = afterReload.pages[i];

            expect(pageAfter.id).toBe(pageBefore.id);
            expect(pageAfter.title).toBe(pageBefore.title);
            expect(pageAfter.blockCount).toBe(pageBefore.blockCount);
            expect(pageAfter.childCount).toBe(pageBefore.childCount);
        }
    });

    test('should preserve document data across multiple save/reload cycles', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Multi-Cycle Integrity Test');

        // Navigate to project
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);

        // Import ELP fixture
        await importElpFixture(page, ELP_FIXTURE);

        // Take initial snapshot
        const initialSnapshot = await getDocumentSnapshot(page);

        // Perform 3 save/reload cycles
        for (let cycle = 1; cycle <= 3; cycle++) {
            // Save
            await saveProject(page);

            // Reload
            await page.reload();
            await page.waitForLoadState('networkidle');
            await waitForAppReady(page);

            // Verify data after this cycle
            const cycleSnapshot = await getDocumentSnapshot(page);

            expect(cycleSnapshot.pageCount).toBe(initialSnapshot.pageCount);
            expect(cycleSnapshot.totalBlocks).toBe(initialSnapshot.totalBlocks);
            expect(cycleSnapshot.title).toBe(initialSnapshot.title);

            // Verify all page IDs match
            for (let i = 0; i < initialSnapshot.pages.length; i++) {
                expect(cycleSnapshot.pages[i].id).toBe(initialSnapshot.pages[i].id);
            }
        }
    });

    test('should handle complex ELP with many pages', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Complex ELP Integrity Test');

        // Navigate to project
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);

        // Import a more complex ELP - old_manual has many pages
        await importElpFixture(page, 'old_manual_exe29_compressed.elp');

        // Take snapshot BEFORE save
        const beforeSave = await getDocumentSnapshot(page);

        // This ELP should have multiple pages
        expect(beforeSave.pageCount).toBeGreaterThan(0);

        // Save the project
        await saveProject(page);

        // Reload
        await page.reload();
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);

        // Take snapshot AFTER reload
        const afterReload = await getDocumentSnapshot(page);

        // Verify all data preserved
        expect(afterReload.pageCount).toBe(beforeSave.pageCount);
        expect(afterReload.totalBlocks).toBe(beforeSave.totalBlocks);
        expect(afterReload.title).toBe(beforeSave.title);

        // Verify page structure exactly matches
        expect(afterReload.pages.length).toBe(beforeSave.pages.length);
        for (let i = 0; i < beforeSave.pages.length; i++) {
            expect(afterReload.pages[i]).toEqual(beforeSave.pages[i]);
        }
    });

    test('should verify Yjs document binary size is consistent after save/load', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Binary Size Test');

        // Navigate to project
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);

        // Import ELP fixture
        await importElpFixture(page, ELP_FIXTURE);

        // Get Yjs document binary size before save
        const beforeSaveSize = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const docManager = bridge?.getDocumentManager();
            const yDoc = docManager?.getDoc();
            if (!yDoc) return 0;

            // Get encoded state size
            const Y = (window as any).Y;
            const state = Y.encodeStateAsUpdate(yDoc);
            return state.length;
        });

        expect(beforeSaveSize).toBeGreaterThan(0);

        // Save the project
        await saveProject(page);

        // Reload
        await page.reload();
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);

        // Get Yjs document binary size after reload
        const afterReloadSize = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const docManager = bridge?.getDocumentManager();
            const yDoc = docManager?.getDoc();
            if (!yDoc) return 0;

            const Y = (window as any).Y;
            const state = Y.encodeStateAsUpdate(yDoc);
            return state.length;
        });

        // Binary size should be the same or very close (within 5% due to Yjs internal optimizations)
        const sizeDifference = Math.abs(afterReloadSize - beforeSaveSize);
        const tolerancePercent = 0.05;
        const tolerance = beforeSaveSize * tolerancePercent;

        expect(sizeDifference).toBeLessThanOrEqual(tolerance);
    });
});
