import { Page, BrowserContext } from '@playwright/test';
import { AuthFixtures, test as authTest, isStaticProject, skipInStaticMode } from './auth.fixture';
import { ShareModalPage } from '../pages/share-modal.page';
import { waitForLoadingScreenHidden } from './auth.fixture';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

// Re-export static mode helpers for convenience
export { isStaticProject, skipInStaticMode };

/**
 * Wait for workarea UI to be interactable.
 * Under heavy parallel load we may need one reload before app globals are fully available.
 */
async function waitForWorkareaUiReady(page: Page, timeout = 60000): Promise<void> {
    const deadline = Date.now() + timeout;
    let retriedReload = false;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const remaining = Math.max(1000, deadline - Date.now());

        try {
            await page.waitForURL(/\/workarea/, { timeout: Math.min(30000, remaining) });
            await page.waitForSelector('#dropdownFile, #head-top-save-button', {
                state: 'visible',
                timeout: Math.min(30000, remaining),
            });
            await waitForLoadingScreenHidden(page);
            return;
        } catch (error) {
            if (retriedReload || Date.now() >= deadline) {
                throw error;
            }
            retriedReload = true;
            await page.reload({ waitUntil: 'domcontentloaded' });
        }
    }
}

/**
 * Fixtures for multi-client collaboration testing
 * Extends AuthFixtures to provide two authenticated pages for real-time collaboration tests
 */
export interface CollaborationFixtures extends AuthFixtures {
    /** Second authenticated page for collaboration tests */
    secondAuthenticatedPage: Page;

    /** Second browser context for the second client */
    secondContext: BrowserContext;

    /** Helper to get share URL from a page's share modal */
    getShareUrl: (page: Page) => Promise<string>;

    /** Helper to join shared project from second client */
    joinSharedProject: (pageB: Page, shareUrl: string) => Promise<void>;
}

interface CollaborationWorkerFixtures {
    /** Worker-scoped storage state for a second guest identity */
    secondGuestStorageStatePath: string | null;
}

export const test = authTest.extend<CollaborationFixtures, CollaborationWorkerFixtures>({
    /**
     * Create a second guest account storage state once per worker.
     * This keeps client A and B as different users while avoiding per-test login cost.
     */
    secondGuestStorageStatePath: [
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
                `pw-guest-state-second-${process.pid}-${workerInfo.parallelIndex}-${safeProjectName}.json`,
            );

            const authContext = await browser.newContext({ baseURL });
            const authPage = await authContext.newPage();
            const loginResponse = await authPage.request.post('/login/guest', {
                form: { guest_login_nonce: '' },
                timeout: 30000,
            });
            if (!loginResponse.ok()) {
                await authContext.close();
                throw new Error(`Failed to prepare second guest storage state: ${loginResponse.status()}`);
            }

            await authContext.storageState({ path: statePath });
            await authContext.close();

            await use(statePath);

            await fs.unlink(statePath).catch(() => {});
        },
        { scope: 'worker' },
    ],

    /**
     * Second browser context for complete isolation
     * This ensures cookies, local storage, and session are independent
     */
    secondContext: async ({ browser, secondGuestStorageStatePath, contextOptions }, use, testInfo) => {
        const baseURL = String(testInfo.project.use.baseURL || process.env.E2E_BASE_URL || 'http://localhost:3001');
        const context = await browser.newContext({
            ...contextOptions,
            baseURL,
            storageState: isStaticProject(testInfo)
                ? contextOptions.storageState
                : (secondGuestStorageStatePath ?? undefined),
        });
        await use(context);
        await context.close();
    },

    /**
     * Second authenticated page for collaboration tests
     * Performs guest login independently from the first client
     */
    secondAuthenticatedPage: async ({ secondContext }, use) => {
        const page = await secondContext.newPage();

        await page.goto('/workarea');
        await waitForWorkareaUiReady(page, 60000);

        await use(page);
        await page.close();
    },

    /**
     * Helper to get share URL from the share modal
     * Opens share modal, makes project public, extracts URL, and closes modal
     */
    // eslint-disable-next-line no-empty-pattern
    getShareUrl: async ({}, use) => {
        const getShareUrlFn = async (page: Page): Promise<string> => {
            const shareModal = new ShareModalPage(page);

            // Dismiss any alert modals that might be blocking
            const alertModal = page.locator('#modalAlert[data-open="true"]');
            if (await alertModal.isVisible()) {
                const alertCloseBtn = alertModal.locator('.btn-close, .close, [data-bs-dismiss="modal"], .btn-primary');
                if (await alertCloseBtn.first().isVisible()) {
                    await alertCloseBtn.first().click();
                    await alertModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
                }
            }

            // Open share button - ensure it's visible and clickable first
            const shareButton = page.locator('#head-top-share-button, .btn-share-pill, [data-action="share"]');
            await shareButton.waitFor({ state: 'visible', timeout: 10000 });
            await shareButton.click();

            // Wait for modal to open
            await shareModal.waitForOpen();

            // Make project public for collaboration to work
            await shareModal.setVisibility('public');
            await page.waitForFunction(
                () => {
                    const help = document.querySelector('#modalProjectShare .visibility-help');
                    return !help || help.textContent !== '';
                },
                undefined,
                { timeout: 5000 },
            );

            // Get the share URL
            const shareUrl = await shareModal.getShareLink();

            // Close modal
            await shareModal.close();

            return shareUrl;
        };

        await use(getShareUrlFn);
    },

    /**
     * Helper to join a shared project from second client
     * Navigates to share URL and waits for project to load
     */
    // eslint-disable-next-line no-empty-pattern
    joinSharedProject: async ({}, use) => {
        const joinSharedProjectFn = async (pageB: Page, shareUrl: string): Promise<void> => {
            // Navigate to share URL
            await pageB.goto(shareUrl, { waitUntil: 'domcontentloaded' });

            // Wait for workarea shell to be ready with one reload fallback under load
            await waitForWorkareaUiReady(pageB, 90000);

            // App object should exist at this point, but don't hard-fail here:
            // bridge readiness below is the authoritative collaboration signal.
            await pageB
                .waitForFunction(
                    () => {
                        return (
                            typeof (window as any).eXeLearning !== 'undefined' &&
                            (window as any).eXeLearning.app !== undefined
                        );
                    },
                    undefined,
                    { timeout: 15000, polling: 100 },
                )
                .catch(() => {});

            // Wait for YjsProjectBridge to be fully initialized with WebSocket connected
            // The bridge is at project._yjsBridge and initialized flag is set AFTER WebSocket connection
            await pageB.waitForFunction(
                () => {
                    const eXe = (window as any).eXeLearning;

                    // Wait for bridge to be initialized (set after WebSocket connects)
                    // The bridge is stored at project._yjsBridge, not app.yjsProjectBridge
                    const bridge = eXe?.app?.project?._yjsBridge;
                    if (!bridge?.initialized) {
                        return false;
                    }

                    // Check WebSocket connection
                    const manager = bridge.documentManager;
                    if (!manager) {
                        return false;
                    }

                    const provider = manager.wsProvider;
                    if (!provider) {
                        // Offline mode - check if synced
                        return manager.synced === true;
                    }

                    // Check if WebSocket is connected
                    return provider.wsconnected === true || provider.synced === true;
                },
                undefined,
                { timeout: 60000, polling: 100 },
            );
        };

        await use(joinSharedProjectFn);
    },
});

export { expect } from '@playwright/test';
