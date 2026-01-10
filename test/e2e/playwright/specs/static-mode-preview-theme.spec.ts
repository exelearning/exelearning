import { test, expect } from '@playwright/test';

/**
 * Tests for static mode preview panel theme functionality
 */

const STATIC_URL = 'http://127.0.0.1:8080';

test.describe('Static Mode - Preview Theme', () => {
    test('should load themes from bundle and show in preview panel', async ({ page }) => {
        // Track failed requests
        const failedRequests: string[] = [];
        page.on('requestfailed', request => {
            failedRequests.push(request.url());
        });

        // Navigate to static mode
        await page.goto(STATIC_URL);
        await page.waitForLoadState('networkidle');

        // Wait for app to initialize
        await page.waitForSelector('#dropdownFile', { timeout: 30000 });
        await page.waitForTimeout(2000);

        // Verify themes are loaded from DataProvider
        const themesInfo = await page.evaluate(() => {
            const app = window.eXeLearning?.app;
            const dataProvider = app?.dataProvider;
            const themes = app?.themes;
            const list = themes?.list;

            return {
                // DataProvider
                mode: dataProvider?.mode || null,
                hasStaticData: !!dataProvider?.staticData,
                bundleThemesCount: dataProvider?.staticData?.themes?.themes?.length || 0,

                // ThemesManager
                hasThemesManager: !!themes,
                hasSelected: !!themes?.selected,
                selectedName: themes?.selected?.name || null,
                selectedPath: themes?.selected?.path || null,

                // ThemeList
                installedThemes: list?.installed ? Object.keys(list.installed) : [],
            };
        });

        // Assertions for theme loading
        expect(themesInfo.mode).toBe('static');
        expect(themesInfo.hasStaticData).toBe(true);
        expect(themesInfo.bundleThemesCount).toBeGreaterThanOrEqual(1);
        expect(themesInfo.hasThemesManager).toBe(true);
        expect(themesInfo.hasSelected).toBe(true);
        expect(themesInfo.selectedName).toBe('base');
        expect(themesInfo.installedThemes).toContain('base');
        expect(themesInfo.installedThemes.length).toBeGreaterThanOrEqual(1);

        console.log('[Test] Themes loaded:', themesInfo.installedThemes);

        // Click preview button to open preview panel
        await page.click('#head-bottom-preview');

        // Wait for preview panel to be visible
        const previewPanel = page.locator('#previewsidenav');
        await previewPanel.waitFor({ state: 'visible', timeout: 15000 });

        // Wait for iframe to load
        await page.waitForTimeout(2000);

        // Check theme CSS is loaded in preview iframe
        const previewInfo = await page.evaluate(() => {
            const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
            if (!iframe) return { error: 'No iframe found' };

            const doc = iframe.contentDocument;
            if (!doc) return { error: 'No contentDocument' };

            // Get all stylesheets
            const stylesheets = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(
                link => (link as HTMLLinkElement).href,
            );

            // Check for theme-related elements
            const body = doc.body;

            return {
                stylesheets,
                bodyClasses: body?.className || '',
                hasContent: !!doc.querySelector('article'),
                hasThemeStylesheet: stylesheets.some(href => href.includes('themes/') && href.includes('style.css')),
            };
        });

        // Assertions for preview
        expect(previewInfo.error).toBeUndefined();
        expect(previewInfo.hasThemeStylesheet).toBe(true);
        expect(previewInfo.bodyClasses).toContain('exe-web-site');
        expect(previewInfo.hasContent).toBe(true);

        console.log(
            '[Test] Theme CSS loaded in preview:',
            previewInfo.stylesheets.filter(s => s.includes('themes/')),
        );

        // Verify no API calls failed (should all be local in static mode)
        const themeApiFailures = failedRequests.filter(url => url.includes('/api/themes') || url.includes('themes/'));
        expect(themeApiFailures).toHaveLength(0);

        // Take screenshot for visual verification
        await page.screenshot({ path: 'test-results/static-preview-theme.png', fullPage: true });
    });

    test('should apply theme styles visually in preview', async ({ page }) => {
        // Navigate to static mode
        await page.goto(STATIC_URL);
        await page.waitForLoadState('networkidle');

        // Wait for app to initialize
        await page.waitForSelector('#dropdownFile', { timeout: 30000 });
        await page.waitForTimeout(2000);

        // Open preview panel
        await page.click('#head-bottom-preview');
        const previewPanel = page.locator('#previewsidenav');
        await previewPanel.waitFor({ state: 'visible', timeout: 15000 });
        await page.waitForTimeout(2000);

        // Verify theme styles are applied
        const themeStyles = await page.evaluate(() => {
            const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
            if (!iframe?.contentDocument) return null;

            const doc = iframe.contentDocument;
            const body = doc.body;

            // Get computed styles to verify theme is applied
            const computedStyle = window.getComputedStyle(body);

            // Find any theme-specific element styling
            const header = doc.querySelector('header');
            const article = doc.querySelector('article');

            return {
                bodyFontFamily: computedStyle.fontFamily,
                bodyBackgroundColor: computedStyle.backgroundColor,
                hasHeader: !!header,
                hasArticle: !!article,
                // Check if exe-web-site class is applied (theme requirement)
                hasExeWebSiteClass: body.classList.contains('exe-web-site'),
            };
        });

        expect(themeStyles).not.toBeNull();
        expect(themeStyles?.hasExeWebSiteClass).toBe(true);
        expect(themeStyles?.hasArticle).toBe(true);

        console.log('[Test] Theme styles applied:', {
            fontFamily: themeStyles?.bodyFontFamily?.substring(0, 50),
            backgroundColor: themeStyles?.bodyBackgroundColor,
        });
    });
});
