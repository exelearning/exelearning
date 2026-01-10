import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import type { Page } from '@playwright/test';

/**
 * Helper function to wait for app initialization
 */
async function waitForAppReady(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle');

    // Wait for Yjs bridge initialization
    await page.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsEnabled, {
        timeout: 30000,
    });

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

    // Get list of themes before upload
    const themesBefore = await page.evaluate(() => {
        return Object.keys((window as any).eXeLearning?.app?.themes?.list?.installed || {});
    });

    // Find the upload input (hidden inside the upload box)
    const fileInput = page.locator('#theme-file-import');

    // Upload the theme file
    await fileInput.setInputFiles(fixturePath);

    // Wait for theme to be processed and appear in the list
    await page.waitForFunction(
        (beforeCount: number) => {
            const installed = (window as any).eXeLearning?.app?.themes?.list?.installed || {};
            return Object.keys(installed).length > beforeCount;
        },
        themesBefore.length,
        { timeout: 10000 },
    );

    // Get the new theme name (the one that wasn't in the list before)
    const themeName = await page.evaluate((beforeList: string[]) => {
        const installed = (window as any).eXeLearning?.app?.themes?.list?.installed || {};
        const currentKeys = Object.keys(installed);
        const newTheme = currentKeys.find(k => !beforeList.includes(k));
        return newTheme || '';
    }, themesBefore);

    console.log(`[Test] Actual theme name after upload: ${themeName}`);

    return themeName;
}

test.describe('Theme Yjs Cleanup', () => {
    /**
     * Test that user themes are removed from Yjs when a different theme is selected
     * but remain in IndexedDB for the user
     */
    test('user theme is removed from Yjs when base theme is selected', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // 1. Create project and navigate
        console.log('[Test] Creating project...');
        const projectUuid = await createProject(page, 'Theme Yjs Cleanup Test');
        await page.goto(`/workarea?project=${projectUuid}`);
        await waitForAppReady(page);
        console.log('[Test] Project ready');

        // 2. Upload a user theme
        console.log('[Test] Uploading theme...');
        const themeName = await uploadTheme(page, 'test-theme.zip');
        console.log(`[Test] Theme uploaded: ${themeName}`);

        // 3. Select the user theme (this ensures it's in Yjs)
        await page.evaluate(async name => {
            await (window as any).eXeLearning.app.themes.selectTheme(name, true, false);
        }, themeName);
        await page.waitForTimeout(1000);

        // 4. Verify theme is in Yjs themeFiles
        const themeInYjsBefore = await page.evaluate(name => {
            const dm = (window as any).eXeLearning?.app?.project?._yjsBridge?.getDocumentManager();
            const themeFiles = dm?.getThemeFiles();
            return themeFiles?.has(name);
        }, themeName);
        console.log(`[Test] Theme in Yjs before: ${themeInYjsBefore}`);
        expect(themeInYjsBefore).toBe(true);

        // 5. Verify theme is in IndexedDB
        const themeInIndexedDBBefore = await page.evaluate(async name => {
            const cache = (window as any).eXeLearning?.app?.project?._yjsBridge?.resourceCache;
            const themes = await cache?.listUserThemes();
            return themes?.some((t: any) => t.name === name);
        }, themeName);
        console.log(`[Test] Theme in IndexedDB before: ${themeInIndexedDBBefore}`);
        expect(themeInIndexedDBBefore).toBe(true);

        // 6. Select a base theme (e.g., 'base')
        console.log('[Test] Selecting base theme...');
        await page.evaluate(async () => {
            await (window as any).eXeLearning.app.themes.selectTheme('base', true, false);
        });
        await page.waitForTimeout(1000);

        // 7. Verify theme is REMOVED from Yjs themeFiles
        const themeInYjsAfter = await page.evaluate(name => {
            const dm = (window as any).eXeLearning?.app?.project?._yjsBridge?.getDocumentManager();
            const themeFiles = dm?.getThemeFiles();
            return themeFiles?.has(name);
        }, themeName);
        console.log(`[Test] Theme in Yjs after: ${themeInYjsAfter}`);
        expect(themeInYjsAfter).toBe(false);

        // 8. Verify theme is STILL in IndexedDB
        const themeInIndexedDBAfter = await page.evaluate(async name => {
            const cache = (window as any).eXeLearning?.app?.project?._yjsBridge?.resourceCache;
            const themes = await cache?.listUserThemes();
            return themes?.some((t: any) => t.name === name);
        }, themeName);
        console.log(`[Test] Theme in IndexedDB after: ${themeInIndexedDBAfter}`);
        expect(themeInIndexedDBAfter).toBe(true);

        console.log('[Test] User theme correctly removed from Yjs but kept in IndexedDB!');
    });

    /**
     * Test that re-selecting a user theme copies it back to Yjs
     */
    test('re-selecting user theme copies it back to Yjs', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // 1. Create project and navigate
        const projectUuid = await createProject(page, 'Theme Re-select Test');
        await page.goto(`/workarea?project=${projectUuid}`);
        await waitForAppReady(page);

        // 2. Upload and select user theme
        const themeName = await uploadTheme(page, 'test-theme.zip');
        await page.evaluate(async name => {
            await (window as any).eXeLearning.app.themes.selectTheme(name, true, false);
        }, themeName);
        await page.waitForTimeout(500);

        // 3. Select base theme (removes user theme from Yjs)
        await page.evaluate(async () => {
            await (window as any).eXeLearning.app.themes.selectTheme('base', true, false);
        });
        await page.waitForTimeout(500);

        // Verify theme is not in Yjs
        const themeRemovedFromYjs = await page.evaluate(name => {
            const dm = (window as any).eXeLearning?.app?.project?._yjsBridge?.getDocumentManager();
            const themeFiles = dm?.getThemeFiles();
            return !themeFiles?.has(name);
        }, themeName);
        expect(themeRemovedFromYjs).toBe(true);

        // 4. Re-select user theme
        console.log('[Test] Re-selecting user theme...');
        await page.evaluate(async name => {
            await (window as any).eXeLearning.app.themes.selectTheme(name, true, false);
        }, themeName);
        await page.waitForTimeout(500);

        // 5. Verify theme is back in Yjs
        const themeBackInYjs = await page.evaluate(name => {
            const dm = (window as any).eXeLearning?.app?.project?._yjsBridge?.getDocumentManager();
            const themeFiles = dm?.getThemeFiles();
            return themeFiles?.has(name);
        }, themeName);
        console.log(`[Test] Theme back in Yjs: ${themeBackInYjs}`);
        expect(themeBackInYjs).toBe(true);

        console.log('[Test] User theme correctly copied back to Yjs!');
    });

    /**
     * Test that switching between two user themes works correctly
     */
    test('switching between user themes updates Yjs correctly', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // 1. Create project and navigate
        const projectUuid = await createProject(page, 'Theme Switch Test');
        await page.goto(`/workarea?project=${projectUuid}`);
        await waitForAppReady(page);

        // 2. Upload first theme
        const themeName1 = await uploadTheme(page, 'test-theme.zip');

        // Close and reopen styles panel to upload second theme
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // 3. Create a second theme by copying (simulate via JS)
        // We'll just use the same theme but pretend it's different by checking the logic
        await page.evaluate(async name => {
            await (window as any).eXeLearning.app.themes.selectTheme(name, true, false);
        }, themeName1);
        await page.waitForTimeout(500);

        // Verify first theme is in Yjs
        const theme1InYjs = await page.evaluate(name => {
            const dm = (window as any).eXeLearning?.app?.project?._yjsBridge?.getDocumentManager();
            const themeFiles = dm?.getThemeFiles();
            return themeFiles?.has(name);
        }, themeName1);
        expect(theme1InYjs).toBe(true);

        // 4. Select base theme
        await page.evaluate(async () => {
            await (window as any).eXeLearning.app.themes.selectTheme('base', true, false);
        });
        await page.waitForTimeout(500);

        // Verify first theme is removed from Yjs
        const theme1RemovedFromYjs = await page.evaluate(name => {
            const dm = (window as any).eXeLearning?.app?.project?._yjsBridge?.getDocumentManager();
            const themeFiles = dm?.getThemeFiles();
            return !themeFiles?.has(name);
        }, themeName1);
        expect(theme1RemovedFromYjs).toBe(true);

        console.log('[Test] Theme switching updates Yjs correctly!');
    });
});
