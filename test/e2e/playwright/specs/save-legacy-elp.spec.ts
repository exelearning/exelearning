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
import type { Page, ConsoleMessage } from '@playwright/test';

const ELP_FIXTURE = 'old_manual_exe29_compressed.elp';

/**
 * Open the ELP fixture via File menu -> Open
 * This opens the file as a new project (replacing the current one)
 */
async function openElpFixture(page: Page): Promise<void> {
    const fixturePath = path.resolve(__dirname, `../../../fixtures/${ELP_FIXTURE}`);

    // Open File menu
    await page.locator('#dropdownFile').click();
    await page.waitForTimeout(300);

    // Click Open option (not Import)
    const openOption = page.locator('#navbar-button-openuserodefiles');
    await expect(openOption).toBeVisible({ timeout: 5000 });
    await openOption.click();

    // Wait for the Open modal to appear
    const openModal = page.locator('#modalOpenUserOdeFiles');
    await expect(openModal).toBeVisible({ timeout: 10000 });

    // Setup file chooser BEFORE clicking the upload button
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });

    // Click "Select a file from your device" button in the modal
    const uploadButton = openModal.locator('.ode-files-button-upload');
    await expect(uploadButton).toBeVisible({ timeout: 5000 });
    await uploadButton.click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    // Handle "Open without saving" confirmation dialog - it appears when opening a file
    // while another project is already open
    const sessionLogoutModal = page.locator('#modalSessionLogout');
    try {
        await sessionLogoutModal.waitFor({ state: 'visible', timeout: 5000 });
        const openWithoutSavingBtn = sessionLogoutModal.locator('button.session-logout-without-save');
        await openWithoutSavingBtn.click();
    } catch {
        // Modal didn't appear - that's fine, continue
    }

    // Wait for navigation to be populated
    await page.waitForFunction(
        () => {
            try {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return false;
                const docManager = bridge.getDocumentManager();
                if (!docManager || !docManager.initialized) return false;
                const yDoc = docManager.getDoc();
                if (!yDoc) return false;
                const navigation = yDoc.getArray('navigation');
                return navigation && navigation.length >= 1;
            } catch {
                // Document may be reinitializing, wait and retry
                return false;
            }
        },
        { timeout: 90000 },
    );

    // Wait for the page count to stabilize (no changes for 3 seconds)
    // This is critical for Firefox which may be slower to process large ELPs
    await page.waitForFunction(
        () => {
            try {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return false;
                const docManager = bridge.getDocumentManager();
                if (!docManager || !docManager.initialized) return false;
                const yDoc = docManager.getDoc();
                if (!yDoc) return false;
                const navigation = yDoc.getArray('navigation');
                if (!navigation) return false;

                // Recursive count of all pages
                const countPages = (pages: any): number => {
                    let count = 0;
                    if (!pages) return count;
                    for (let i = 0; i < pages.length; i++) {
                        count++;
                        const page = pages.get(i);
                        const subpages = page?.get('children');
                        if (subpages) count += countPages(subpages);
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

                // Page count stable for 3 seconds = import complete (increased from 2s for Firefox)
                return Date.now() - win.__importStableTime >= 3000;
            } catch {
                // Document may be reinitializing, wait and retry
                return false;
            }
        },
        { timeout: 120000, polling: 500 },
    );

    // Clean up the temporary window variables
    await page.evaluate(() => {
        const win = window as any;
        delete win.__importPageCount;
        delete win.__importStableTime;
    });

    // Wait for loading screen to hide
    await page.waitForFunction(
        () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
        { timeout: 30000 },
    );

    // Wait for import progress overlay to disappear (if present)
    await page.waitForFunction(() => !document.querySelector('#import-progress-overlay'), { timeout: 30000 });

    // Additional wait for all handlers to complete
    await page.waitForTimeout(2000);
}

/**
 * Click the save button and wait for save to complete
 */
async function clickSaveButton(page: Page): Promise<void> {
    const saveButton = page.locator('#head-top-save-button');
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    // Wait for save to complete - the button will briefly show a loading state
    // then return to normal. We wait for the Yjs save operations to complete.
    await page.waitForFunction(
        () => {
            // Check if there are any pending operations in the save queue
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            if (!bridge) return true; // No bridge means nothing to save
            // The save button might have a "saving" class or similar
            const saveBtn = document.querySelector('#head-top-save-button');
            return saveBtn && !saveBtn.classList.contains('saving');
        },
        { timeout: 30000 },
    );

    // Additional wait for any async operations
    await page.waitForTimeout(2000);
}

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
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        // Wait for app to fully initialize
        await page.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsBridge !== undefined, {
            timeout: 30000,
        });

        // Wait for loading screen to hide
        await page.waitForFunction(
            () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
            { timeout: 30000 },
        );

        // Open the legacy ELP fixture
        await openElpFixture(page);

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

        // Click the save button
        await clickSaveButton(page);

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
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        // Wait for app to fully initialize
        await page.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsBridge !== undefined, {
            timeout: 30000,
        });

        await page.waitForFunction(
            () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
            { timeout: 30000 },
        );

        // Open the legacy ELP fixture
        await openElpFixture(page);

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
        await clickSaveButton(page);

        // Reload the page to verify data persisted
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Wait for app to reinitialize
        await page.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsBridge !== undefined, {
            timeout: 30000,
        });

        await page.waitForFunction(
            () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
            { timeout: 30000 },
        );

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
