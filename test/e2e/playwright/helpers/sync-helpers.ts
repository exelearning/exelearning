import { Page } from '@playwright/test';

/**
 * Helper utilities for waiting on Yjs synchronization in collaboration tests
 */

/**
 * Waits for Yjs document to be synced
 * Checks that YjsProjectBridge is initialized (which means WebSocket is connected)
 */
export async function waitForYjsSync(page: Page, timeout: number = 30000): Promise<void> {
    await page.waitForFunction(
        () => {
            const eXe = (window as any).eXeLearning;

            // Wait for YjsProjectBridge to be fully initialized
            // This flag is set AFTER WebSocket connection is established
            // The bridge is stored at project._yjsBridge, not app.yjsProjectBridge
            const bridge = eXe?.app?.project?._yjsBridge;
            if (!bridge?.initialized) {
                return false;
            }

            const manager = bridge.documentManager;
            if (!manager) {
                return false;
            }

            const provider = manager.wsProvider;
            if (!provider) {
                // Provider not created - offline mode, check if document is synced
                return manager.synced === true;
            }

            // Check WebSocket connection state
            return provider.wsconnected === true || provider.synced === true;
        },
        { timeout, polling: 100 },
    );
}

/**
 * Waits for a node with specific title to appear in navigation
 * Used to verify sync between clients
 *
 * Navigation tree structure:
 * - treeitem[aria-label="NodeTitle"] > button > generic
 */
export async function waitForNodeInNav(page: Page, nodeTitle: string, timeout: number = 60000): Promise<void> {
    // The tree uses role="treeitem" with buttons containing the node title
    // Use polling to catch rapid UI updates
    await page.waitForSelector(`[role="tree"] [role="treeitem"] button:has-text("${nodeTitle}")`, {
        state: 'visible',
        timeout,
    });
}

/**
 * Waits for a node with specific title to disappear from navigation
 * Used to verify deletion sync between clients
 */
export async function waitForNodeNotInNav(page: Page, nodeTitle: string, timeout: number = 60000): Promise<void> {
    // The tree uses role="treeitem" with buttons containing the node title
    await page.waitForSelector(`[role="tree"] [role="treeitem"] button:has-text("${nodeTitle}")`, {
        state: 'hidden',
        timeout,
    });
}

/**
 * Waits for both clients to see the same node
 * Useful for verifying sync after structure changes
 */
export async function waitForNodeSyncBetweenClients(
    clientA: Page,
    clientB: Page,
    nodeTitle: string,
    timeout: number = 15000,
): Promise<void> {
    await Promise.all([waitForNodeInNav(clientA, nodeTitle, timeout), waitForNodeInNav(clientB, nodeTitle, timeout)]);
}

/**
 * Waits for content area to be ready and showing expected node
 * Checks for data-ready attribute and optional title match
 */
export async function waitForContentReady(page: Page, expectedTitle?: string, timeout: number = 10000): Promise<void> {
    // Wait for node-content to be ready
    await page.waitForSelector('#node-content[data-ready="true"]', { timeout });

    // If expected title provided, verify it
    if (expectedTitle) {
        await page.waitForFunction(
            title => {
                const titleElement = document.querySelector('#node-content h1, .node-title-header');
                return titleElement?.textContent?.includes(title) ?? false;
            },
            expectedTitle,
            { timeout },
        );
    }
}

/**
 * Waits for text to appear in content area
 * Used to verify content sync between clients
 */
export async function waitForTextInContent(page: Page, text: string, timeout: number = 15000): Promise<void> {
    await page.waitForFunction(
        searchText => {
            const content = document.querySelector('#node-content');
            return content?.textContent?.includes(searchText) ?? false;
        },
        text,
        { timeout },
    );
}

/**
 * Small delay for UI updates (use sparingly, prefer deterministic waits)
 */
export async function shortDelay(ms: number = 300): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
}
