import { test as base, expect, Page, TestInfo } from '@playwright/test';
import { gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * Detect static mode from project name
 * Works automatically when running: bunx playwright test --project=static-chromium
 */
export function isStaticProject(testInfo: TestInfo): boolean {
    return testInfo.project.name.includes('static');
}

/**
 * Skip test if running in static mode (checks testInfo.project.name)
 * Use for tests that require server features (WebSocket, collaboration, API)
 *
 * @example
 * test('should sync between clients', async ({ authenticatedPage }, testInfo) => {
 *     skipInStaticMode(test, testInfo, 'WebSocket collaboration');
 *     // ... test code (only runs in server mode)
 * });
 *
 * // In beforeEach:
 * test.beforeEach(async ({}, testInfo) => {
 *     skipInStaticMode(test, testInfo, 'WebSocket collaboration');
 * });
 */
export function skipInStaticMode(testFn: typeof base, testInfo: TestInfo, reason = 'Requires server features'): void {
    if (isStaticProject(testInfo)) {
        testFn.skip(true, `Skipped in static mode: ${reason}`);
    }
}

/**
 * Authentication fixtures for E2E tests
 * Provides pre-authenticated pages for testing
 */

export interface AuthFixtures {
    /** Page with guest authentication and navigated to workarea */
    authenticatedPage: Page;
    /** Page with guest session but not navigated */
    guestSession: Page;
    /** Helper to create a new project and return its UUID */
    createProject: (page: Page, title?: string) => Promise<string>;
}

export const test = base.extend<AuthFixtures>({
    /**
     * Provides a page with guest login already performed
     * and navigated to the workarea
     *
     * In static mode: no login needed, navigates directly to root
     * In server mode: performs guest login and navigates to workarea
     */
    authenticatedPage: async ({ page }, use, testInfo) => {
        if (isStaticProject(testInfo)) {
            // Static mode: no login, navigate to root (index.html)
            await page.goto('/');

            // Wait for the app to initialize
            await page.waitForFunction(
                () => {
                    return (
                        typeof (window as any).eXeLearning !== 'undefined' &&
                        (window as any).eXeLearning.app !== undefined
                    );
                },
                { timeout: 30000 },
            );

            // Wait for loading screen to be completely hidden
            await page.waitForFunction(
                () => {
                    const loadingScreen = document.querySelector('#load-screen-main');
                    return loadingScreen?.getAttribute('data-visible') === 'false';
                },
                { timeout: 30000 },
            );

            await use(page);
            return;
        }

        // Server mode: existing login flow
        // Navigate to login page
        await page.goto('/login');

        // Click guest login button
        const guestButton = page.locator(
            '#login-link-guest, button[name="guest_login"], .btn-guest-login, [data-action="guest-login"]',
        );

        // If there's a guest login button, click it
        if ((await guestButton.count()) > 0) {
            await guestButton.first().click();
        } else {
            // Fallback: POST directly to guest login endpoint
            await page.request.post('/login/guest', {
                form: { guest_login_nonce: '' },
            });
            await page.goto('/workarea');
        }

        // Wait for workarea to load
        await page.waitForURL(/\/workarea/, { timeout: 30000 });

        // Wait for the app to initialize
        await page.waitForFunction(
            () => {
                return (
                    typeof (window as any).eXeLearning !== 'undefined' && (window as any).eXeLearning.app !== undefined
                );
            },
            { timeout: 30000 },
        );

        // Wait for loading screen to be completely hidden
        await page.waitForFunction(
            () => {
                const loadingScreen = document.querySelector('#load-screen-main');
                return loadingScreen?.getAttribute('data-visible') === 'false';
            },
            { timeout: 30000 },
        );

        await use(page);
    },

    /**
     * Provides a page with guest session established via API
     * Use this when you need session but will navigate yourself
     *
     * In static mode: no login needed, just use the page
     * In server mode: performs guest login via API
     */
    guestSession: async ({ page }, use, testInfo) => {
        if (isStaticProject(testInfo)) {
            // Static mode: no login needed
            await use(page);
            return;
        }

        // Server mode: perform guest login via API
        const response = await page.request.post('/login/guest', {
            form: { guest_login_nonce: '' },
        });

        expect(response.ok()).toBeTruthy();

        await use(page);
    },

    /**
     * Helper to create a new project and return its UUID
     *
     * In static mode: returns mock UUID (static build has pre-loaded project)
     * In server mode: creates project via API and returns real UUID
     */
    // eslint-disable-next-line no-empty-pattern
    createProject: async ({}, use, testInfo) => {
        const createProjectFn = async (page: Page, title: string = 'Test Project'): Promise<string> => {
            if (isStaticProject(testInfo)) {
                // Static mode: project already exists, return fixed UUID
                // The static build has a pre-loaded project, so we don't need to create one
                return 'static-project';
            }

            // Server mode: create project via API
            const response = await page.request.post('/api/project/create-quick', {
                data: { title },
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });

            expect(response.ok()).toBeTruthy();

            const data = await response.json();
            expect(data.uuid).toBeDefined();

            return data.uuid;
        };

        await use(createProjectFn);
    },
});

export { expect } from '@playwright/test';

/**
 * Helper function to wait for modal to be visible
 */
export async function waitForModal(page: Page, modalId: string): Promise<void> {
    await page.waitForSelector(`#${modalId}.show, #${modalId}[style*="display: block"]`, {
        state: 'visible',
        timeout: 10000,
    });
}

/**
 * Helper function to close modal
 */
export async function closeModal(page: Page, modalId: string): Promise<void> {
    const closeButton = page.locator(`#${modalId} .btn-close, #${modalId} [data-bs-dismiss="modal"]`);
    if ((await closeButton.count()) > 0) {
        await closeButton.first().click();
    }
    await page.waitForSelector(`#${modalId}`, { state: 'hidden', timeout: 5000 });
}

/**
 * Helper function to wait for the loading screen to be completely hidden
 * The loading screen has a fade animation (~1250ms total) before it's fully hidden
 * This waits for the data-visible attribute to be "false", which indicates
 * the loading screen is no longer blocking pointer events
 */
export async function waitForLoadingScreenHidden(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const loadingScreen = document.querySelector('#load-screen-main');
            return loadingScreen?.getAttribute('data-visible') === 'false';
        },
        { timeout: 30000 },
    );
}

// Re-export gotoWorkarea from workarea-helpers (primary helper for workarea navigation)
export { gotoWorkarea };

/**
 * @deprecated Use `gotoWorkarea` from workarea-helpers.ts instead.
 * This alias is kept for backwards compatibility.
 *
 * Navigate to a project's workarea (unified for static/server modes)
 */
export const navigateToProject = gotoWorkarea;
