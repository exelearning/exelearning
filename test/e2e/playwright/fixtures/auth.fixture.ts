import { test as base, expect, Browser, Page, TestInfo } from '@playwright/test';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * Detect static mode from project name
 * Works automatically when running: bun x playwright test --project=static-chromium
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

interface AuthWorkerFixtures {
    /** Worker-scoped storage state path with authenticated guest session (dynamic mode only) */
    guestStorageStatePath: string | null;
    /**
     * Browser for this worker. Firefox is relaunched after a fixed number of
     * contexts: a process that has been opening pages for a whole shard stops
     * answering newPage, and the test timeout then closes it.
     */
    suiteBrowser: () => Promise<Browser>;
}

/** Contexts opened on one Firefox process before it is replaced. */
const FIREFOX_CONTEXTS_PER_BROWSER = 20;

export const test = base.extend<AuthFixtures, AuthWorkerFixtures>({
    /**
     * One browser per worker. launch() with no arguments picks up the launch
     * options Playwright already installed for the worker. Firefox is replaced
     * after FIREFOX_CONTEXTS_PER_BROWSER contexts so newPage is not sent to a
     * process that has stopped answering. timeout 0 matches Playwright's own
     * browser fixture: launching is not part of the test clock.
     */
    suiteBrowser: [
        async ({ playwright }, use, workerInfo) => {
            const browserName = workerInfo.project.use.browserName ?? 'chromium';
            const browserType = playwright[browserName];
            if (!browserType) {
                throw new Error(`No browser type for ${browserName}`);
            }
            let current = await browserType.launch();
            let opened = 0;
            const recycle = workerInfo.project.name === 'firefox';
            try {
                await use(async () => {
                    if (recycle && opened >= FIREFOX_CONTEXTS_PER_BROWSER) {
                        await current.close().catch(() => {});
                        current = await browserType.launch();
                        opened = 0;
                    }
                    opened += 1;
                    return current;
                });
            } finally {
                await current?.close().catch(() => {});
            }
        },
        { scope: 'worker', timeout: 0 },
    ],

    /**
     * Build guest-authenticated storage state once per worker.
     * This avoids repeating /login/guest for every single test.
     */
    guestStorageStatePath: [
        async ({ suiteBrowser }, use, workerInfo) => {
            if (workerInfo.project.name.includes('static')) {
                await use(null);
                return;
            }

            const baseURL = String(
                workerInfo.project.use.baseURL || process.env.E2E_BASE_URL || 'http://localhost:3001',
            );
            const safeProjectName = workerInfo.project.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const statePath = path.join(
                os.tmpdir(),
                `pw-guest-state-${process.pid}-${workerInfo.parallelIndex}-${safeProjectName}.json`,
            );

            const authContext = await (await suiteBrowser()).newContext({ baseURL });
            const authPage = await authContext.newPage();
            const loginResponse = await authPage.request.post('/login/guest', {
                form: { guest_login_nonce: '' },
                timeout: 30000,
            });
            if (!loginResponse.ok()) {
                await authContext.close();
                throw new Error(`Failed to prepare guest storage state: ${loginResponse.status()}`);
            }

            await authContext.storageState({ path: statePath });
            await authContext.close();

            await use(statePath);

            await fs.unlink(statePath).catch(() => {});
        },
        { scope: 'worker' },
    ],

    /**
     * Override context so all tests in dynamic mode start already authenticated.
     * Keeps normal per-test isolation while skipping repeated login calls.
     * Own clock so a Firefox relaunch does not consume the 45s test timeout.
     * newPage still runs on the test clock.
     */
    context: [
        async ({ suiteBrowser, contextOptions, guestStorageStatePath }, use, testInfo) => {
            const baseURL = String(testInfo.project.use.baseURL || process.env.E2E_BASE_URL || 'http://localhost:3001');
            const context = await (await suiteBrowser()).newContext({
                ...contextOptions,
                baseURL,
                storageState: isStaticProject(testInfo)
                    ? contextOptions.storageState
                    : (guestStorageStatePath ?? undefined),
            });
            await use(context);
            await context.close();
        },
        { timeout: 30_000 },
    ],

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
            await page.waitForFunction(() => (window as any).eXeLearning?.app !== undefined, undefined, {
                timeout: 30000,
            });
            await waitForLoadingScreenHidden(page);

            await use(page);
            return;
        }

        // Server mode: guest auth already loaded via worker storage state
        await page.goto('/workarea');

        // Wait for workarea to load
        await page.waitForURL(/\/workarea/, { timeout: 30000 });

        // Wait for the app to initialize
        await page.waitForFunction(
            () => {
                return (
                    typeof (window as any).eXeLearning !== 'undefined' && (window as any).eXeLearning.app !== undefined
                );
            },
            undefined,
            { timeout: 30000 },
        );

        // Wait for loading screen to be completely hidden
        await waitForLoadingScreenHidden(page);

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

        // Server mode: guest auth already loaded via worker storage state
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
        undefined,
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
