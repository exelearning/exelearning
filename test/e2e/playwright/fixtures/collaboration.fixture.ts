import { Page, BrowserContext } from '@playwright/test';
import { AuthFixtures, test as authTest } from './auth.fixture';
import { ShareModalPage } from '../pages/share-modal.page';
import { waitForLoadingScreenHidden } from './auth.fixture';

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

export const test = authTest.extend<CollaborationFixtures>({
    /**
     * Second browser context for complete isolation
     * This ensures cookies, local storage, and session are independent
     */
    secondContext: async ({ browser }, use) => {
        const context = await browser.newContext();
        await use(context);
        await context.close();
    },

    /**
     * Second authenticated page for collaboration tests
     * Performs guest login independently from the first client
     */
    secondAuthenticatedPage: async ({ secondContext }, use) => {
        const page = await secondContext.newPage();

        // Navigate to login page
        await page.goto('/login');

        // Click guest login button
        const guestButton = page.locator(
            '#login-link-guest, button[name="guest_login"], .btn-guest-login, [data-action="guest-login"]',
        );

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
                    await page.waitForTimeout(500);
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
            // Wait for visibility change to be applied
            await page.waitForTimeout(500);

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
            await pageB.goto(shareUrl);

            // Wait for workarea to be ready
            await pageB.waitForURL(/\/workarea/, { timeout: 30000 });

            // Wait for app to initialize
            await pageB.waitForFunction(
                () => {
                    return (
                        typeof (window as any).eXeLearning !== 'undefined' &&
                        (window as any).eXeLearning.app !== undefined
                    );
                },
                { timeout: 30000 },
            );

            // Wait for loading screen to be hidden
            await waitForLoadingScreenHidden(pageB);

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
                { timeout: 45000, polling: 100 },
            );
        };

        await use(joinSharedProjectFn);
    },
});

export { expect } from '@playwright/test';
