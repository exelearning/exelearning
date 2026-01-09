import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import type { Page } from '@playwright/test';

/**
 * Helper function to wait for app initialization
 */
async function waitForAppReady(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle');

    // Wait for Yjs bridge initialization
    await page.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsEnabled, { timeout: 30000 });

    // Wait for loading screen to disappear
    await page.waitForFunction(
        () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
        { timeout: 30000 },
    );
}

/**
 * Helper function to open styles panel and navigate to Imported tab
 */
async function openImportedStylesTab(page: Page): Promise<void> {
    // Open styles panel
    const stylesButton = page.locator('#dropdownStyles');
    await expect(stylesButton).toBeVisible({ timeout: 5000 });
    await stylesButton.click();

    // Wait for styles panel to be active
    await page.waitForSelector('#stylessidenav.active', { timeout: 5000 });

    // Click on Imported tab
    const importedTab = page.locator('#importedstylescontent-tab');
    await expect(importedTab).toBeVisible({ timeout: 5000 });
    await importedTab.click();

    // Wait for tab content to be visible
    await page.waitForSelector('#importedstylescontent', { timeout: 5000 });
}

/**
 * Helper function to upload a theme via the styles panel
 */
async function uploadTheme(page: Page, fixtureName: string): Promise<string> {
    const fixturePath = path.resolve(__dirname, `../../../fixtures/${fixtureName}`);

    // Open styles panel and go to Imported tab
    await openImportedStylesTab(page);

    // Find the upload input (hidden inside the upload box)
    const fileInput = page.locator('#theme-file-import');

    // Upload the theme file
    await fileInput.setInputFiles(fixturePath);

    // Wait for theme to be processed (small timeout to allow async processing)
    await page.waitForTimeout(2000);

    // Get the theme name from config.xml (should be extracted by the upload process)
    // The theme name is sanitized: lowercase, alphanumeric + underscore/dash only
    const themeName = fixtureName
        .replace('.zip', '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');

    return themeName;
}

/**
 * Helper function to check if a theme appears in the Imported tab
 */
async function checkThemeInImportedTab(page: Page, themeName: string): Promise<boolean> {
    // Open styles panel and go to Imported tab
    await openImportedStylesTab(page);

    // Wait for content to be populated
    await page.waitForTimeout(1000);

    // Look for the theme in the user themes list
    // Themes are displayed as .user-theme-item elements
    const themeItem = page.locator(`.user-theme-item[data-theme="${themeName}"]`);

    // Check if at least one theme item exists (could also check by theme name displayed)
    const anyUserTheme = page.locator('.user-theme-item').first();

    try {
        await anyUserTheme.waitFor({ state: 'visible', timeout: 5000 });
        return true;
    } catch {
        // Debug: log current state
        const debugInfo = await page.evaluate(() => {
            const content = document.querySelector('#importedstylescontent');
            return {
                contentInnerHTML: content?.innerHTML?.substring(0, 500) || 'not found',
                userThemeCount: document.querySelectorAll('.user-theme-item').length,
            };
        });
        console.log('[Test] Debug - no user themes found:', debugInfo);
        return false;
    }
}

test.describe('Theme Persistence Across Projects', () => {
    /**
     * Test that uploaded themes persist across different projects
     * This is the key test case: upload theme in project A, verify it appears in project B
     */
    test('uploaded theme persists in new project', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // 1. Create first project
        console.log('[Test] Creating first project...');
        const projectA = await createProject(page, 'Theme Persistence Test A');
        expect(projectA).toBeDefined();

        // 2. Navigate to first project
        await page.goto(`/workarea?project=${projectA}`);
        await waitForAppReady(page);
        console.log('[Test] First project ready');

        // 3. Upload a theme via styles panel
        console.log('[Test] Uploading theme...');
        const themeName = await uploadTheme(page, 'test-theme.zip');
        console.log(`[Test] Theme uploaded: ${themeName}`);

        // 4. Verify theme was uploaded by checking installed themes (via JS, not UI)
        const themeUploadedInA = await page.evaluate(() => {
            const themeList = (window as any).eXeLearning?.app?.themes?.list;
            const installedThemes = themeList?.installed || {};
            const userThemes = Object.entries(installedThemes)
                .filter(([_, theme]: [string, any]) => theme?.type === 'user' || theme?.isUserTheme)
                .map(([name]) => name);
            return {
                userThemesCount: userThemes.length,
                userThemes,
            };
        });
        console.log('[Test] Themes in project A:', themeUploadedInA);
        expect(themeUploadedInA.userThemesCount).toBeGreaterThan(0);
        console.log('[Test] Theme visible in first project');

        // 5. Verify theme is in IndexedDB
        const indexedDBInA = await page.evaluate(async () => {
            const resourceCache = (window as any).eXeLearning?.app?.project?._yjsBridge?.resourceCache;
            if (!resourceCache) return { error: 'ResourceCache not available' };

            try {
                const themes = await resourceCache.listUserThemes();
                return {
                    themeCount: themes?.length || 0,
                    themeNames: themes?.map((t: any) => t.name) || [],
                };
            } catch (e: any) {
                return { error: e.message };
            }
        });
        console.log('[Test] IndexedDB in project A:', indexedDBInA);
        expect(indexedDBInA.themeCount).toBeGreaterThan(0);

        // 6. Create second project
        console.log('[Test] Creating second project...');
        const projectB = await createProject(page, 'Theme Persistence Test B');
        expect(projectB).toBeDefined();

        // 7. Navigate to second project
        await page.goto(`/workarea?project=${projectB}`);
        await waitForAppReady(page);
        console.log('[Test] Second project ready');

        // 8. Check IndexedDB directly after navigation
        const indexedDBInB = await page.evaluate(async () => {
            const resourceCache = (window as any).eXeLearning?.app?.project?._yjsBridge?.resourceCache;
            if (!resourceCache) return { error: 'ResourceCache not available' };

            try {
                const themes = await resourceCache.listUserThemes();
                return {
                    themeCount: themes?.length || 0,
                    themeNames: themes?.map((t: any) => t.name) || [],
                };
            } catch (e: any) {
                return { error: e.message };
            }
        });
        console.log('[Test] IndexedDB in project B:', indexedDBInB);

        // This SHOULD pass - IndexedDB is global across all projects
        expect(indexedDBInB.themeCount).toBeGreaterThan(0);
        expect(indexedDBInB.themeNames).toContain('test_theme');

        // 9. Check if theme is in installed themes list (THE KEY ASSERTION)
        const themesInB = await page.evaluate(() => {
            const themeList = (window as any).eXeLearning?.app?.themes?.list;
            const installedThemes = themeList?.installed || {};
            const userThemes = Object.entries(installedThemes)
                .filter(([_, theme]: [string, any]) => theme?.type === 'user' || theme?.isUserTheme)
                .map(([name]) => name);
            return {
                userThemesCount: userThemes.length,
                userThemes,
                totalInstalled: Object.keys(installedThemes).length,
            };
        });
        console.log('[Test] Themes in project B:', themesInB);

        // This is where the bug is - themes from IndexedDB are NOT being loaded into installed list
        expect(themesInB.userThemesCount).toBeGreaterThan(0);
        expect(themesInB.userThemes).toContain('test_theme');
        console.log('[Test] Theme persists across projects!');
    });

    /**
     * Test that IndexedDB correctly stores themes
     * This verifies the storage layer is working
     */
    test('IndexedDB stores and retrieves themes', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create and navigate to project
        const projectUuid = await createProject(page, 'IndexedDB Theme Test');
        await page.goto(`/workarea?project=${projectUuid}`);
        await waitForAppReady(page);

        // Upload a theme
        await uploadTheme(page, 'test-theme.zip');

        // Verify theme is stored in IndexedDB
        const themeInIndexedDB = await page.evaluate(async () => {
            const resourceCache = (window as any).eXeLearning?.app?.project?._yjsBridge?.resourceCache;
            if (!resourceCache) return { error: 'ResourceCache not available' };

            try {
                const themes = await resourceCache.listUserThemes();
                return {
                    themeCount: themes?.length || 0,
                    themeNames: themes?.map((t: any) => t.name) || [],
                };
            } catch (e: any) {
                return { error: e.message };
            }
        });

        console.log('[Test] IndexedDB themes:', themeInIndexedDB);

        expect(themeInIndexedDB.error).toBeUndefined();
        expect(themeInIndexedDB.themeCount).toBeGreaterThan(0);
        expect(themeInIndexedDB.themeNames).toContain('test_theme');
    });

    /**
     * Test that loadUserThemesFromIndexedDB is called during project initialization
     */
    test('themes are loaded from IndexedDB on project init', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // First, create a project and upload a theme
        const projectA = await createProject(page, 'Theme Init Test A');
        await page.goto(`/workarea?project=${projectA}`);
        await waitForAppReady(page);
        await uploadTheme(page, 'test-theme.zip');

        // Create a new project
        const projectB = await createProject(page, 'Theme Init Test B');
        await page.goto(`/workarea?project=${projectB}`);
        await waitForAppReady(page);

        // Check if user themes were loaded during initialization
        const themesLoaded = await page.evaluate(() => {
            const themeList = (window as any).eXeLearning?.app?.themes?.list;
            const installedThemes = themeList?.installed || {};
            const userThemes = Object.entries(installedThemes)
                .filter(([_, theme]: [string, any]) => theme?.isUserTheme)
                .map(([name]) => name);
            return {
                userThemesCount: userThemes.length,
                userThemes,
            };
        });

        console.log('[Test] Themes loaded on init:', themesLoaded);

        // The user theme should be loaded from IndexedDB
        expect(themesLoaded.userThemesCount).toBeGreaterThan(0);
        expect(themesLoaded.userThemes).toContain('test_theme');
    });
});
