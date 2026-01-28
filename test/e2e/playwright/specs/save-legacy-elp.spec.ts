/**
 * E2E Tests for: Save Legacy ELP
 *
 * Tests that legacy ELP files can be imported and saved without errors.
 * This is critical for verifying database compatibility across SQLite, PostgreSQL, and MySQL.
 *
 * If the database schema has incompatibilities, the save operation will fail,
 * exposing issues early in the test suite.
 */
import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import type { ConsoleMessage } from '@playwright/test';
import { openElpFile, waitForAppReady, saveProject, reloadPage, gotoWorkarea } from '../helpers/workarea-helpers';

const ELP_FIXTURE = 'old_manual_exe29_compressed.elp';
const FIXTURE_PATH = path.resolve(__dirname, `../../../fixtures/${ELP_FIXTURE}`);

test.describe('Save Legacy ELP - Database Compatibility', () => {
    test('should import and save old_manual_exe29_compressed.elp without console errors', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Collect console errors
        const consoleErrors: string[] = [];
        const consoleHandler = (msg: ConsoleMessage) => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Ignore known non-critical errors
                if (
                    !text.includes('favicon.ico') &&
                    !text.includes('404') &&
                    !text.includes('net::ERR') &&
                    !text.includes('ResizeObserver')
                ) {
                    consoleErrors.push(text);
                }
            }
        };
        page.on('console', consoleHandler);

        // Create a new project
        const projectUuid = await createProject(page, 'Save Legacy ELP Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Open the legacy ELP fixture
        await openElpFile(page, FIXTURE_PATH);

        // Verify the project has content after import
        const projectInfo = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            if (!bridge) return { error: 'No yjsBridge' };
            const yDoc = bridge.getDocumentManager()?.getDoc();
            if (!yDoc) return { error: 'No yDoc' };

            const navigation = yDoc.getArray('navigation');
            const metadata = bridge.getDocumentManager()?.getMetadata();

            return {
                pageCount: navigation.length,
                hasNavigation: navigation.length > 0,
                title: metadata?.get('title') || 'Unknown',
            };
        });

        expect(projectInfo.hasNavigation).toBe(true);
        expect(projectInfo.pageCount).toBeGreaterThan(0);

        // Clear any errors that occurred during import (import errors are not the focus here)
        const importErrors = [...consoleErrors];
        consoleErrors.length = 0;

        // Save the project
        await saveProject(page);

        // Verify save completed without throwing errors
        // Check for API errors in console that would indicate database issues
        const saveErrors = consoleErrors.filter(
            err =>
                err.includes('save') ||
                err.includes('database') ||
                err.includes('SQL') ||
                err.includes('constraint') ||
                err.includes('SQLITE') ||
                err.includes('PGSQL') ||
                err.includes('MySQL') ||
                err.includes('500') ||
                err.includes('Failed'),
        );

        // Log any import errors for debugging (but don't fail on them)
        if (importErrors.length > 0) {
            console.log('Import-related console errors (informational):', importErrors);
        }

        // Fail if there are save-related errors - these indicate database compatibility issues
        if (saveErrors.length > 0) {
            console.error('Save-related errors detected:', saveErrors);
        }
        expect(saveErrors.length).toBe(0);

        // Verify the project can still be accessed after save
        const projectAfterSave = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            if (!bridge) return { error: 'No yjsBridge after save' };
            const yDoc = bridge.getDocumentManager()?.getDoc();
            if (!yDoc) return { error: 'No yDoc after save' };

            const navigation = yDoc.getArray('navigation');
            return {
                pageCount: navigation.length,
                hasNavigation: navigation.length > 0,
            };
        });

        expect(projectAfterSave.hasNavigation).toBe(true);
        // Page count should be at least as many as before (import may have created nested pages)
        expect(projectAfterSave.pageCount).toBeGreaterThanOrEqual(projectInfo.pageCount);
    });

    test('should save project and verify data persists after reload', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Save Persistence Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Open the legacy ELP fixture
        await openElpFile(page, FIXTURE_PATH);

        // Get the page count before save (count all pages recursively)
        const beforeSaveInfo = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const yDoc = bridge?.getDocumentManager()?.getDoc();
            const navigation = yDoc?.getArray('navigation');
            const metadata = bridge?.getDocumentManager()?.getMetadata();

            // Count pages including nested ones
            let totalPages = 0;
            const countPages = (pages: any) => {
                if (!pages) return;
                for (let i = 0; i < pages.length; i++) {
                    totalPages++;
                    const page = pages.get(i);
                    const subpages = page?.get('children');
                    if (subpages) countPages(subpages);
                }
            };
            countPages(navigation);

            return {
                pageCount: totalPages,
                title: metadata?.get('title') || 'Unknown',
            };
        });

        expect(beforeSaveInfo.pageCount).toBeGreaterThan(0);

        // Save the project
        await saveProject(page);

        // Reload the page to verify data persisted
        await reloadPage(page);

        // Verify data persisted (count pages recursively)
        const afterReloadInfo = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const yDoc = bridge?.getDocumentManager()?.getDoc();
            const navigation = yDoc?.getArray('navigation');
            const metadata = bridge?.getDocumentManager()?.getMetadata();

            // Count pages including nested ones
            let totalPages = 0;
            const countPages = (pages: any) => {
                if (!pages) return;
                for (let i = 0; i < pages.length; i++) {
                    totalPages++;
                    const page = pages.get(i);
                    const subpages = page?.get('children');
                    if (subpages) countPages(subpages);
                }
            };
            countPages(navigation);

            return {
                pageCount: totalPages,
                title: metadata?.get('title') || 'Unknown',
            };
        });

        // Page count should match after reload
        expect(afterReloadInfo.pageCount).toBe(beforeSaveInfo.pageCount);
    });
});
