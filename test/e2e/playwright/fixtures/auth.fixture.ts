import { test as base, expect, Page } from '@playwright/test';
import { isStaticMode } from './mode.fixture';

/**
 * Authentication fixtures for E2E tests
 * Provides pre-authenticated pages for testing
 *
 * In static mode, no authentication is needed - the app starts directly in workarea.
 * In server mode, performs guest login to establish session.
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
     * In static mode, navigates directly (no login needed).
     * In server mode, performs guest login.
     */
    authenticatedPage: async ({ page }, use) => {
        if (isStaticMode()) {
            // Static mode: no login needed, navigate directly to app
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
        } else {
            // Server mode: perform guest login
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
        }

        await use(page);
    },

    /**
     * Provides a page with guest session established via API
     * Use this when you need session but will navigate yourself
     */
    guestSession: async ({ page }, use) => {
        // Perform guest login via API
        const response = await page.request.post('/login/guest', {
            form: { guest_login_nonce: '' },
        });

        expect(response.ok()).toBeTruthy();

        await use(page);
    },

    /**
     * Helper to create a new project and return its UUID
     *
     * In static mode, projects are created client-side automatically.
     * In server mode, creates project via API.
     */
    // eslint-disable-next-line no-empty-pattern
    createProject: async ({}, use) => {
        const createProjectFn = async (page: Page, title: string = 'Test Project'): Promise<string> => {
            if (isStaticMode()) {
                // Static mode: project is created locally via UI
                // Check if already on the app (authenticatedPage already navigated)
                const isOnApp = await page
                    .evaluate(() => (window as any).eXeLearning?.app?.project !== undefined)
                    .catch(() => false);

                if (!isOnApp) {
                    // Navigate to root which auto-creates a project
                    await page.goto('/');

                    // Wait for project to be initialized
                    await page.waitForFunction(() => (window as any).eXeLearning?.app?.project !== undefined, {
                        timeout: 30000,
                    });

                    // Wait for loading screen to hide
                    await page.waitForFunction(
                        () => {
                            const loadScreen = document.querySelector('#load-screen-main');
                            return loadScreen?.getAttribute('data-visible') === 'false';
                        },
                        { timeout: 30000 },
                    );
                }

                // Get project UUID from app
                const uuid = await page.evaluate(
                    () => (window as any).eXeLearning?.app?.project?.uuid || 'static-project',
                );
                return uuid;
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

/**
 * Navigate to a project's workarea.
 *
 * In static mode, the app is already loaded and doesn't use URL-based routing,
 * so we just ensure the app is ready (no navigation needed).
 *
 * In server mode, navigates to /workarea?project=uuid
 */
export async function navigateToProject(page: Page, projectUuid: string): Promise<void> {
    if (isStaticMode()) {
        // Static mode: already on the workarea, just wait for app to be ready
        await page.waitForFunction(() => (window as any).eXeLearning?.app?.project !== undefined, {
            timeout: 30000,
        });
        await waitForLoadingScreenHidden(page);
    } else {
        // Server mode: navigate to workarea with project UUID
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        // Wait for app initialization
        await page.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsEnabled, {
            timeout: 30000,
        });

        await waitForLoadingScreenHidden(page);
    }
}
