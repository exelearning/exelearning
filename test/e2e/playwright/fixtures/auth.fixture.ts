import { test as base, expect, Browser, BrowserContext, BrowserContextOptions, Page, TestInfo } from '@playwright/test';
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
    /**
     * Context and its first page, opened together. Tests keep using `page` and
     * `context`; this exists so a Firefox retry still hands both fixtures the
     * same live context.
     */
    openedBrowser: OpenedBrowser;
}

interface AuthWorkerFixtures {
    /** Worker-scoped storage state path with authenticated guest session (dynamic mode only) */
    guestStorageStatePath: string | null;
    /**
     * Browser Playwright launched for this worker. A replacement, when one is
     * needed, is started from that browser's own type.
     */
    workerBrowser: WorkerBrowserSlot;
}

interface WorkerBrowserSlot {
    current: () => Browser;
    replace: () => Promise<Browser>;
}

interface OpenedBrowser {
    context: BrowserContext;
    page: Page;
}

/**
 * A healthy Firefox newPage returns in well under a second. One that is still
 * pending after this has stopped answering: the test timeout used to sit here
 * until it closed the browser, and the retry then passed.
 */
const FIREFOX_NEW_PAGE_BUDGET_MS = 12_000;
const FIREFOX_CONTEXT_CLOSE_BUDGET_MS = 5_000;

class NewPageStalled extends Error {
    constructor() {
        super('newPage stalled');
        this.name = 'NewPageStalled';
    }
}

function contextSettings(
    testInfo: TestInfo,
    contextOptions: BrowserContextOptions,
    guestStorageStatePath: string | null,
): BrowserContextOptions {
    const baseURL = String(testInfo.project.use.baseURL || process.env.E2E_BASE_URL || 'http://localhost:3001');
    return {
        ...contextOptions,
        baseURL,
        storageState: isStaticProject(testInfo) ? contextOptions.storageState : (guestStorageStatePath ?? undefined),
    };
}

/** newPage, or NewPageStalled when Firefox does not answer within the budget. */
function pageWithin(context: BrowserContext, budgetMs: number): Promise<Page> {
    const pending = context.newPage();
    pending.catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    return new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new NewPageStalled()), budgetMs);
        pending.then(
            page => {
                if (timer) clearTimeout(timer);
                resolve(page);
            },
            error => {
                if (timer) clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/** True when close finished. A wedged Firefox can ignore close; the caller then stops using that process. */
async function closeWithin(context: BrowserContext, budgetMs: number): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const closed = context.close().then(
        () => true,
        () => true,
    );
    try {
        return await Promise.race([
            closed,
            new Promise<false>(resolve => {
                timer = setTimeout(() => resolve(false), budgetMs);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/**
 * Open a Firefox page. If newPage does not return, close that context and try
 * once more on the same browser: that close is what lets the runner's retry pass.
 * If the process still does not answer, launch another one of the same browser
 * type. Desktop Firefox sets defaultBrowserType and leaves browserName empty, so
 * the launch goes through the browser Playwright already started.
 */
async function openFirefoxPage(
    slot: WorkerBrowserSlot,
    settings: BrowserContextOptions,
    testInfo: TestInfo,
): Promise<{ context: BrowserContext; page: Page; recoveredMs: number }> {
    const started = Date.now();
    const originalTimeout = testInfo.timeout;
    // The stall is on the test clock. Extend it while recovering so a second
    // newPage is not cut off, then put back only the time this recovery used.
    let extended = false;
    const noteStall = () => {
        if (extended) return;
        extended = true;
        testInfo.setTimeout(originalTimeout + 60_000);
    };
    const finish = (page: Page, live: BrowserContext) => {
        const recoveredMs = Date.now() - started;
        if (extended) testInfo.setTimeout(originalTimeout + recoveredMs);
        return { context: live, page, recoveredMs: extended ? recoveredMs : 0 };
    };

    let context = await slot.current().newContext(settings);
    try {
        try {
            const page = await pageWithin(context, FIREFOX_NEW_PAGE_BUDGET_MS);
            return finish(page, context);
        } catch (error) {
            if (!(error instanceof NewPageStalled)) throw error;
            noteStall();
        }

        const closed = await closeWithin(context, FIREFOX_CONTEXT_CLOSE_BUDGET_MS);
        console.warn(`[e2e] Firefox newPage stalled; opening a new context (${testInfo.title})`);
        if (closed) {
            context = await slot.current().newContext(settings);
            try {
                const page = await pageWithin(context, FIREFOX_NEW_PAGE_BUDGET_MS);
                return finish(page, context);
            } catch (error) {
                if (!(error instanceof NewPageStalled)) throw error;
                await closeWithin(context, FIREFOX_CONTEXT_CLOSE_BUDGET_MS);
            }
        }

        console.warn(`[e2e] Firefox newPage stalled again; relaunching Firefox (${testInfo.title})`);
        context = await (await slot.replace()).newContext(settings);
        const page = await pageWithin(context, FIREFOX_NEW_PAGE_BUDGET_MS);
        return finish(page, context);
    } catch (error) {
        await context.close().catch(() => {});
        throw error;
    }
}

export const test = base.extend<AuthFixtures, AuthWorkerFixtures>({
    /**
     * The runner's browser, plus a same-type replacement when Firefox stops answering.
     * timeout 0 matches Playwright's browser fixture: the process is not on the test clock.
     * Launch uses browser.browserType() so a Firefox worker does not ask for Chromium.
     * browserType is a method; reading it as a property throws and fails the attempt.
     */
    workerBrowser: [
        async ({ browser }, use) => {
            let current = browser;
            let owned: Browser | null = null;
            try {
                await use({
                    current: () => current,
                    replace: async () => {
                        const next = await browser.browserType().launch();
                        const previous = owned;
                        owned = next;
                        current = next;
                        if (previous) await previous.close().catch(() => {});
                        return next;
                    },
                });
            } finally {
                if (owned) await owned.close().catch(() => {});
            }
        },
        { scope: 'worker', timeout: 0 },
    ],

    /**
     * Build guest-authenticated storage state once per worker.
     * This avoids repeating /login/guest for every single test.
     */
    guestStorageStatePath: [
        async ({ browser }, use, workerInfo) => {
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

            const authContext = await browser.newContext({ baseURL });
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
     * One context and its first page. Firefox retries a newPage that does not
     * return, then gives both fixtures that live pair. The time spent recovering
     * is added back onto the test timeout so the body keeps its 45s.
     */
    openedBrowser: async ({ workerBrowser, contextOptions, guestStorageStatePath }, use, testInfo) => {
        const settings = contextSettings(testInfo, contextOptions, guestStorageStatePath);
        let context: BrowserContext | undefined;
        try {
            if (testInfo.project.name === 'firefox') {
                const firefox = await openFirefoxPage(workerBrowser, settings, testInfo);
                context = firefox.context;
                await use({ context, page: firefox.page });
                return;
            }
            context = await workerBrowser.current().newContext(settings);
            await use({ context, page: await context.newPage() });
        } finally {
            await context?.close().catch(() => {});
        }
    },

    /**
     * Override context so all tests in dynamic mode start already authenticated.
     * Keeps normal per-test isolation while skipping repeated login calls.
     * Closed by openedBrowser, which owns the context a Firefox retry may replace.
     */
    context: async ({ openedBrowser }, use) => {
        await use(openedBrowser.context);
    },

    /** The page opened with `context`, including a Firefox retry of a stalled newPage. */
    page: async ({ openedBrowser }, use) => {
        await use(openedBrowser.page);
    },

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
