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
import { openElpFile, waitForAppReady, saveProject, reloadPage, gotoWorkarea } from '../helpers/workarea-helpers';

const ELP_FIXTURE = 'basic-example.elp';
const FIXTURES_DIR = path.resolve(__dirname, '../../../fixtures');

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

test.describe('Yjs Binary Data Integrity', () => {
    test('should preserve all document data after save and reload', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Binary Integrity Test');

        // Navigate to project
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Open ELP fixture
        await openElpFile(page, path.join(FIXTURES_DIR, ELP_FIXTURE));

        // Take snapshot BEFORE save
        const beforeSave = await getDocumentSnapshot(page);
        expect(beforeSave.pageCount).toBeGreaterThan(0);

        // Save the project
        await saveProject(page);

        // Reload the page completely
        await reloadPage(page);

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
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Open ELP fixture
        await openElpFile(page, path.join(FIXTURES_DIR, ELP_FIXTURE));

        // Take initial snapshot
        const initialSnapshot = await getDocumentSnapshot(page);

        // Perform 3 save/reload cycles
        for (let cycle = 1; cycle <= 3; cycle++) {
            // Save
            await saveProject(page);

            // Reload
            await reloadPage(page);

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
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Open a more complex ELP - old_manual has many pages
        await openElpFile(page, path.join(FIXTURES_DIR, 'old_manual_exe29_compressed.elp'));

        // Take snapshot BEFORE save
        const beforeSave = await getDocumentSnapshot(page);

        // This ELP should have multiple pages
        expect(beforeSave.pageCount).toBeGreaterThan(0);

        // Save the project
        await saveProject(page);

        // Reload
        await reloadPage(page);

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
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Open ELP fixture
        await openElpFile(page, path.join(FIXTURES_DIR, ELP_FIXTURE));

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
        await reloadPage(page);

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
