import { test as base, expect, type Page } from '@playwright/test';

/**
 * Static Mode Fixtures for E2E Tests
 *
 * Provides fixtures specifically for testing the static version of eXeLearning.
 * In static mode, there's no login required - the app starts directly in workarea.
 */

export interface StaticFixtures {
    /** Page navigated to static workarea (no login needed) */
    staticPage: Page;
}

export const test = base.extend<StaticFixtures>({
    /**
     * Provides a page navigated to the static app workarea.
     * No login is required in static mode.
     */
    staticPage: async ({ page }, use) => {
        // Navigate to static app root (no login required)
        await page.goto('/');

        // Wait for app initialization
        await page.waitForFunction(
            () => {
                return (window as any).eXeLearning?.app !== undefined;
            },
            { timeout: 30000 },
        );

        // Wait for loading screen to hide
        await page.waitForFunction(
            () => {
                const loadScreen = document.querySelector('#load-screen-main');
                return loadScreen?.getAttribute('data-visible') === 'false';
            },
            { timeout: 30000 },
        );

        await use(page);
    },
});

export { expect };
