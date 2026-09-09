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
        undefined,
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
    // The tree uses role="treeitem" containing .nav-element-text with the title
    // Use polling to catch rapid UI updates
    await page.waitForSelector(`[role="tree"] [role="treeitem"] .nav-element-text:has-text("${nodeTitle}")`, {
        state: 'visible',
        timeout,
    });
}

/**
 * Waits for a node with specific title to disappear from navigation
 * Used to verify deletion sync between clients
 */
export async function waitForNodeNotInNav(page: Page, nodeTitle: string, timeout: number = 60000): Promise<void> {
    // The tree uses role="treeitem" containing .nav-element-text with the title
    await page.waitForSelector(`[role="tree"] [role="treeitem"] .nav-element-text:has-text("${nodeTitle}")`, {
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
 * Read the saved iDevice payload currently stored in the local Y.Doc.
 * Covers htmlContent (Y.Text), htmlView (string fallback), and jsonProperties.
 */
export async function getYjsComponentPlainText(page: Page, componentId: string): Promise<string> {
    return page.evaluate(id => {
        const eXe = (window as any).eXeLearning;
        const yDoc = eXe?.app?.project?._yjsBridge?.getDocumentManager?.()?.getDoc?.();
        if (!yDoc) {
            return '';
        }

        const collectText = (compMap: any): string => {
            const htmlContent = compMap.get('htmlContent');
            const htmlFromYText = htmlContent?.toString?.() || '';
            const htmlView = typeof compMap.get('htmlView') === 'string' ? compMap.get('htmlView') : '';
            const rawJson = compMap.get('jsonProperties');
            const jsonText = typeof rawJson === 'string' ? rawJson : rawJson ? JSON.stringify(rawJson) : '';
            return `${htmlFromYText}\n${htmlView}\n${jsonText}`;
        };

        const searchInPage = (pageMap: any): string | null => {
            const blocks = pageMap?.get('blocks');
            if (blocks) {
                for (let i = 0; i < blocks.length; i++) {
                    const components = blocks.get(i)?.get('components');
                    if (!components) {
                        continue;
                    }
                    for (let j = 0; j < components.length; j++) {
                        const comp = components.get(j);
                        if (comp?.get('id') === id || comp?.get('elementId') === id) {
                            return collectText(comp);
                        }
                    }
                }
            }

            const children = pageMap?.get('pages') || pageMap?.get('children');
            if (children) {
                for (let i = 0; i < children.length; i++) {
                    const found = searchInPage(children.get(i));
                    if (found !== null) {
                        return found;
                    }
                }
            }

            return null;
        };

        const navigation = yDoc.getArray('navigation');
        for (let i = 0; i < navigation.length; i++) {
            const found = searchInPage(navigation.get(i));
            if (found !== null) {
                return found;
            }
        }

        return '';
    }, componentId);
}

/**
 * Wait until the local Y.Doc component payload contains the expected text.
 * This is the Yjs-side counterpart of waitForTextInContent (DOM).
 */
export async function waitForYjsComponentText(
    page: Page,
    componentId: string,
    text: string,
    timeout: number = 15000,
): Promise<void> {
    await page.waitForFunction(
        ({ id, search }) => {
            const eXe = (window as any).eXeLearning;
            const yDoc = eXe?.app?.project?._yjsBridge?.getDocumentManager?.()?.getDoc?.();
            if (!yDoc) {
                return false;
            }

            const collectText = (compMap: any): string => {
                const htmlContent = compMap.get('htmlContent');
                const htmlFromYText = htmlContent?.toString?.() || '';
                const htmlView = typeof compMap.get('htmlView') === 'string' ? compMap.get('htmlView') : '';
                const rawJson = compMap.get('jsonProperties');
                const jsonText = typeof rawJson === 'string' ? rawJson : rawJson ? JSON.stringify(rawJson) : '';
                return `${htmlFromYText}\n${htmlView}\n${jsonText}`;
            };

            const searchInPage = (pageMap: any): string | null => {
                const blocks = pageMap?.get('blocks');
                if (blocks) {
                    for (let i = 0; i < blocks.length; i++) {
                        const components = blocks.get(i)?.get('components');
                        if (!components) {
                            continue;
                        }
                        for (let j = 0; j < components.length; j++) {
                            const comp = components.get(j);
                            if (comp?.get('id') === id || comp?.get('elementId') === id) {
                                return collectText(comp);
                            }
                        }
                    }
                }

                const children = pageMap?.get('pages') || pageMap?.get('children');
                if (children) {
                    for (let i = 0; i < children.length; i++) {
                        const found = searchInPage(children.get(i));
                        if (found !== null) {
                            return found;
                        }
                    }
                }

                return null;
            };

            const navigation = yDoc.getArray('navigation');
            for (let i = 0; i < navigation.length; i++) {
                const found = searchInPage(navigation.get(i));
                if (found !== null) {
                    return found.includes(search);
                }
            }

            return false;
        },
        { id: componentId, search: text },
        { timeout, polling: 100 },
    );
}

export interface IdeviceLockState {
    isLockedByMe: boolean;
    isLockedByOther: boolean;
    editDisabled: boolean;
    hasLockIndicator: boolean;
    mode: string | null;
}

/**
 * Observable lock state for one iDevice: Yjs lock map plus the Edit button UI.
 */
export async function getIdeviceLockState(page: Page, componentId: string): Promise<IdeviceLockState> {
    return page.evaluate(id => {
        const lockManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.lockManager;
        const el = document.querySelector(`.idevice_node[id="${id}"]`) as HTMLElement | null;
        const editBtn = el?.querySelector('.btn-edit-idevice') as HTMLButtonElement | null;
        return {
            isLockedByMe: lockManager?.isLockedByMe?.(id) === true,
            isLockedByOther: lockManager?.isLocked?.(id) === true,
            editDisabled: !!(
                editBtn?.disabled ||
                editBtn?.hasAttribute('disabled') ||
                editBtn?.classList.contains('disabled')
            ),
            hasLockIndicator: !!el?.querySelector('.lock-indicator'),
            mode: el?.getAttribute('mode') ?? null,
        };
    }, componentId);
}

/**
 * Wait until this client holds the exclusive iDevice lock.
 */
export async function waitForIdeviceLockedByMe(
    page: Page,
    componentId: string,
    timeout: number = 15000,
): Promise<void> {
    await page.waitForFunction(
        id => {
            const lockManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.lockManager;
            return lockManager?.isLockedByMe?.(id) === true;
        },
        componentId,
        { timeout, polling: 100 },
    );
}

/**
 * Wait until another client holds the lock and this client cannot edit the iDevice.
 * Accepts either the Yjs lock map or the disabled Edit button as the observable signal.
 */
export async function waitForIdeviceLockedByOther(
    page: Page,
    componentId: string,
    timeout: number = 15000,
): Promise<void> {
    await page.waitForFunction(
        id => {
            const lockManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.lockManager;
            if (lockManager?.isLocked?.(id) === true) {
                return true;
            }
            const el = document.querySelector(`.idevice_node[id="${id}"]`);
            const editBtn = el?.querySelector('.btn-edit-idevice');
            return !!(
                editBtn &&
                ((editBtn as HTMLButtonElement).disabled ||
                    editBtn.hasAttribute('disabled') ||
                    editBtn.classList.contains('disabled'))
            );
        },
        componentId,
        { timeout, polling: 100 },
    );
}

/**
 * Wait until neither this client nor another client holds the iDevice lock.
 */
export async function waitForIdeviceUnlocked(page: Page, componentId: string, timeout: number = 15000): Promise<void> {
    await page.waitForFunction(
        id => {
            const lockManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.lockManager;
            if (!lockManager) {
                return false;
            }
            return lockManager.isLockedByMe?.(id) !== true && lockManager.isLocked?.(id) !== true;
        },
        componentId,
        { timeout, polling: 100 },
    );
}

/**
 * Small delay for UI updates (use sparingly, prefer deterministic waits)
 */
export async function shortDelay(ms: number = 300): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
}
