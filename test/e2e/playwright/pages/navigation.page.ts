import { Page, Locator } from '@playwright/test';
import { waitForNodeInNav, waitForNodeNotInNav } from '../helpers/sync-helpers';

/**
 * Page Object for navigation tree operations
 * Handles node creation, selection, deletion, and reordering
 */
export class NavigationPage {
    readonly page: Page;

    // Navigation tree elements
    readonly navList: Locator;
    readonly addPageButton: Locator;
    readonly deleteButton: Locator;
    readonly moveUpButton: Locator;
    readonly moveDownButton: Locator;
    readonly moveLeftButton: Locator;
    readonly moveRightButton: Locator;

    // Modal elements for node creation/deletion
    readonly newNodeInput: Locator;
    readonly confirmButton: Locator;
    readonly settingsButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Navigation controls
        this.navList = page.locator('#nav_list, [data-testid="nav-list"]');
        this.addPageButton = page.locator('[data-testid="nav-add-page"]');
        this.deleteButton = page.locator('[data-testid="nav-delete"]');
        this.moveUpButton = page.locator('[data-testid="nav-move-up"]');
        this.moveDownButton = page.locator('[data-testid="nav-move-down"]');
        this.moveLeftButton = page.locator('[data-testid="nav-move-left"]');
        this.moveRightButton = page.locator('[data-testid="nav-move-right"]');

        // Modal controls
        this.newNodeInput = page.locator('#input-new-node');
        this.confirmButton = page.locator('[data-testid="confirm-action"]');
        this.settingsButton = page.locator('#head-top-settings-button');
    }

    /**
     * Opens project settings (useful for creating root nodes)
     */
    async openProjectSettings(): Promise<void> {
        await this.settingsButton.click();
        await this.page.waitForSelector(
            '#properties-node-content-form, [data-testid="node-content"][data-ready="true"]',
            { timeout: 15000 },
        );
    }

    /**
     * Gets node ID by title text
     * Tree structure: treeitem > button > generic (text)
     */
    async getNodeIdByTitle(title: string): Promise<string | null> {
        return this.page.evaluate(t => {
            const titleText = String(t).trim();
            // First try using [role="treeitem"] .node-text-span (new structure)
            const treeItems = Array.from(document.querySelectorAll('[role="tree"] [role="treeitem"]'));
            for (const item of treeItems) {
                const span = item.querySelector('.nav-element-text .node-text-span');
                if (span?.textContent && span.textContent.trim() === titleText) {
                    return item.getAttribute('data-node-id') || item.getAttribute('nav-id') || item.id || null;
                }
            }
            // Fallback to legacy selectors
            const nodes = Array.from(document.querySelectorAll('[data-testid="nav-node"]'));
            for (const nav of nodes) {
                const span = nav.querySelector('.node-text-span');
                if (span?.textContent && span.textContent.trim() === titleText) {
                    return nav.getAttribute('data-node-id') || nav.getAttribute('nav-id') || null;
                }
            }
            return null;
        }, title);
    }

    /**
     * Selects a node by its ID or title
     * Tree structure: treeitem > button > generic (text)
     */
    async selectNodeById(id: string, expectedTitle?: string): Promise<void> {
        // If we have an expected title, try clicking by text first (more reliable)
        if (expectedTitle) {
            const treeSelector = `[role="tree"] [role="treeitem"] .nav-element-text:has-text("${expectedTitle}")`;
            const treeItem = this.page.locator(treeSelector).first();
            if (await treeItem.count()) {
                await treeItem.click();
                await this.waitForContentReady(expectedTitle);
                return;
            }
        }

        // Fallback: try by data-node-id
        const legacySelector = `[data-testid="nav-node-text"][data-node-id="${id}"] .node-text-span`;
        const idSelector = `[data-node-id="${id}"] .nav-element-text`;
        const locator = this.page.locator(`${idSelector}, ${legacySelector}`).first();
        await locator.waitFor({ timeout: 20000 });
        await locator.click();

        // Wait for content to be ready
        await this.waitForContentReady(expectedTitle);
    }

    /**
     * Selects a node by its title
     */
    async selectNodeByTitle(title: string): Promise<void> {
        const id = await this.getNodeIdByTitle(title);
        if (!id) {
            throw new Error(`Node with title not found: ${title}`);
        }
        await this.selectNodeById(id, title);
    }

    /**
     * Waits for node content area to be ready
     */
    async waitForContentReady(expectedTitle?: string, timeout: number = 30000): Promise<void> {
        await this.page.waitForFunction(
            args => {
                const expected = (args.expectedTitle || '').trim();
                const loadingOverlay = document.querySelector('[data-testid="loading-content"]');
                if (loadingOverlay && loadingOverlay.getAttribute('data-visible') === 'true') {
                    return false;
                }

                const nodeContent =
                    document.querySelector('[data-testid="node-content"]') || document.querySelector('#node-content');
                if (!nodeContent) return false;

                const dataReady = nodeContent.getAttribute('data-ready');
                if (dataReady && dataReady !== 'true') return false;

                // If expecting specific title, check it
                if (expected) {
                    const titleElement = document.querySelector('#page-title-node-content');
                    return !!titleElement && (titleElement.textContent || '').trim() === expected;
                }

                return true;
            },
            { expectedTitle },
            { timeout },
        );
    }

    /**
     * Creates a node at root level
     */
    async createNodeAtRoot(title: string): Promise<void> {
        // Open settings to ensure root-level creation
        await this.openProjectSettings();
        await this.createNodeUnderSelected(title);
    }

    /**
     * Creates a node under the currently selected node
     */
    async createNodeUnderSelected(title: string): Promise<void> {
        // Click add page button
        await this.addPageButton.click();

        // Fill in title in modal
        await this.newNodeInput.waitFor({ timeout: 15000 });
        await this.newNodeInput.fill(title);

        // Confirm
        await this.confirmButton.click();

        // Wait for node to appear in navigation
        await waitForNodeInNav(this.page, title, 45000);

        // Select the newly created node
        await this.selectNodeByTitle(title);
    }

    /**
     * Creates a child node under a parent node using the per-node "Add subpage" button
     */
    async createChildNode(parentTitle: string, childTitle: string): Promise<void> {
        await this.selectNodeByTitle(parentTitle);

        // Get parent's nav-id to find its "Add subpage" button
        const navId = await this.getNodeIdByTitle(parentTitle);
        if (!navId) {
            throw new Error(`Parent node not found: ${parentTitle}`);
        }

        // Click the "Add subpage" button on this specific parent node
        const addSubpageBtn = this.page.locator(`.node-add-button[data-parentnavid="${navId}"]`);
        await addSubpageBtn.waitFor({ timeout: 10000 });
        await addSubpageBtn.click();

        // Fill in title in modal
        await this.newNodeInput.waitFor({ timeout: 15000 });
        await this.newNodeInput.fill(childTitle);

        // Confirm
        await this.confirmButton.click();

        // Wait for child node to appear in navigation
        await waitForNodeInNav(this.page, childTitle, 45000);

        // Select the newly created child node
        await this.selectNodeByTitle(childTitle);
    }

    /**
     * Deletes a node by title
     */
    async deleteNodeByTitle(title: string): Promise<void> {
        await this.selectNodeByTitle(title);
        await this.deleteButton.click();
        await this.confirmButton.click();
        await waitForNodeNotInNav(this.page, title, 60000);
    }

    /**
     * Moves a node down in the navigation tree
     */
    async moveNodeDown(title: string): Promise<void> {
        await this.selectNodeByTitle(title);
        await this.moveDownButton.click();
    }

    /**
     * Moves a node up in the navigation tree
     */
    async moveNodeUp(title: string): Promise<void> {
        await this.selectNodeByTitle(title);
        await this.moveUpButton.click();
    }

    /**
     * Moves a node left (promote in hierarchy)
     */
    async moveNodeLeft(title: string): Promise<void> {
        await this.selectNodeByTitle(title);
        await this.moveLeftButton.click();
    }

    /**
     * Moves a node right (demote in hierarchy)
     */
    async moveNodeRight(title: string): Promise<void> {
        await this.selectNodeByTitle(title);
        await this.moveRightButton.click();
    }

    /**
     * Gets ordered child titles under a parent node
     * Tree structure: treeitem > group > treeitem > button
     */
    async getChildrenTitles(parentTitle: string): Promise<string[]> {
        return this.page.evaluate(title => {
            const titleText = String(title).trim();

            // Find parent node by .node-text-span text
            const allNodes = Array.from(document.querySelectorAll('.nav-element[nav-id]'));
            const parentNode = allNodes.find(node => {
                const span = node.querySelector(':scope > .nav-element-text .node-text-span');
                return span?.textContent?.trim() === titleText;
            });

            if (!parentNode) return [];

            const parentNavId = parentNode.getAttribute('nav-id');
            if (!parentNavId) return [];

            // Find children by nav-parent attribute (DOM order = display order)
            const children = Array.from(document.querySelectorAll(`.nav-element[nav-parent="${parentNavId}"]`));
            return children
                .map(child => {
                    const span = child.querySelector(':scope > .nav-element-text .node-text-span');
                    return span?.textContent?.trim() || '';
                })
                .filter(text => text !== '');
        }, parentTitle);
    }

    /**
     * Waits for children to be in specific order
     * Tree structure: treeitem > group > treeitem > button
     */
    async waitForChildrenOrder(parentTitle: string, expectedOrder: string[], timeout: number = 45000): Promise<void> {
        await this.page.waitForFunction(
            args => {
                const title = String(args.parentTitle).trim();
                const expected = args.expectedOrder;

                // Find parent node by .node-text-span text
                const allNodes = Array.from(document.querySelectorAll('.nav-element[nav-id]'));
                const parentNode = allNodes.find(node => {
                    const span = node.querySelector(':scope > .nav-element-text .node-text-span');
                    return span?.textContent?.trim() === title;
                });

                if (!parentNode) return false;

                const parentNavId = parentNode.getAttribute('nav-id');
                if (!parentNavId) return false;

                // Find children by nav-parent attribute (DOM order = display order)
                const children = Array.from(document.querySelectorAll(`.nav-element[nav-parent="${parentNavId}"]`));
                const labels = children
                    .map(child => {
                        const span = child.querySelector(':scope > .nav-element-text .node-text-span');
                        return span?.textContent?.trim() || '';
                    })
                    .filter(text => text !== '');

                return labels.length === expected.length && labels.every((v, i) => v === expected[i]);
            },
            { parentTitle, expectedOrder },
            { timeout },
        );
    }

    /**
     * Waits for a node with specific title to appear in navigation
     * Default 60s timeout for cross-client collaboration sync
     */
    async waitForNodeInNav(title: string, timeout: number = 60000): Promise<void> {
        await waitForNodeInNav(this.page, title, timeout);
    }

    /**
     * Waits for a node with specific title to disappear from navigation
     * Default 60s timeout for cross-client collaboration sync
     */
    async waitForNodeNotInNav(title: string, timeout: number = 60000): Promise<void> {
        await waitForNodeNotInNav(this.page, title, timeout);
    }
}
