/**
 * Navigation Helpers for E2E Tests
 *
 * Helpers for page/node operations in the navigation tree:
 * - Creating, deleting, cloning pages
 * - Moving pages (up/down/left/right)
 * - Waiting for page content to be ready
 *
 * @example
 * ```typescript
 * import { createPage, deletePage, clonePage } from '../helpers/navigation-helpers';
 *
 * test('my test', async ({ page }) => {
 *     await createPage(page, 'New Page');
 *     await clonePage(page);
 *     await deletePage(page, 'New Page');
 * });
 * ```
 */

import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE/NODE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new page at root level
 *
 * @param page - Playwright page
 * @param title - Optional title for the new page
 * @returns The node ID of the new page
 */
export async function createPage(page: Page, title?: string): Promise<string> {
    // Click the "New Page" button in the navigation panel
    const newPageBtn = page.locator('#navbar-button-newpage, .btn-new-page, [title*="New page"]').first();
    await newPageBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newPageBtn.click();
    await page.waitForTimeout(500);

    // Wait for the new page to appear in navigation
    await page.waitForFunction(
        () => {
            const navElements = document.querySelectorAll('.nav-element:not([nav-id="root"])');
            return navElements.length > 0;
        },
        undefined,
        { timeout: 10000 },
    );

    // If title provided, rename the page
    if (title) {
        // Double-click to edit the page name on the last created page
        const lastNavText = page.locator('.nav-element:last-child .nav-element-text').first();
        await lastNavText.dblclick();
        await page.waitForTimeout(300);
        await page.keyboard.press('Control+a');
        await page.keyboard.type(title);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
    }

    // Return the node ID
    const nodeId = await page.evaluate(() => {
        const lastNav = document.querySelector('.nav-element:last-child');
        return lastNav?.getAttribute('nav-id') || '';
    });

    return nodeId;
}

/**
 * Create a child page under a parent page
 *
 * @param page - Playwright page
 * @param parentTitle - Title of the parent page
 * @param childTitle - Optional title for the child page
 * @returns The node ID of the new child page
 */
export async function createChildPage(page: Page, parentTitle: string, childTitle?: string): Promise<string> {
    // First navigate to the parent page
    const parentNav = page.locator('.nav-element .nav-element-text', { hasText: parentTitle }).first();
    await parentNav.scrollIntoViewIfNeeded();
    await parentNav.click({ button: 'right' });

    // Wait for context menu
    await page.locator('.nav-context-menu, .dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });

    // Click "Add child page" option
    const addChildOption = page.locator(
        '.nav-context-menu [data-action="add-child"], .dropdown-item:has-text("child"), .dropdown-item:has-text("hijo")',
    );
    await addChildOption.first().click();

    await page.waitForTimeout(500);

    // If title provided, rename the page
    if (childTitle) {
        const lastNavText = page
            .locator(`.nav-element:has(.nav-element-text:has-text("${parentTitle}")) .nav-element .nav-element-text`)
            .last();
        await lastNavText.dblclick();
        await page.waitForTimeout(300);
        await page.keyboard.press('Control+a');
        await page.keyboard.type(childTitle);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
    }

    // Return the node ID of the new child
    const nodeId = await page.evaluate((parent: string) => {
        const parentEl = [...document.querySelectorAll('.nav-element')].find(el =>
            el.querySelector('.nav-element-text')?.textContent?.includes(parent),
        );
        const lastChild = parentEl?.querySelector('.nav-element:last-child');
        return lastChild?.getAttribute('nav-id') || '';
    }, parentTitle);

    return nodeId;
}

/**
 * Delete a page by title
 *
 * @param page - Playwright page
 * @param title - Title of the page to delete
 */
export async function deletePage(page: Page, title: string): Promise<void> {
    // Find and right-click the page
    const navItem = page.locator('.nav-element .nav-element-text', { hasText: title }).first();
    await navItem.scrollIntoViewIfNeeded();
    await navItem.click({ button: 'right' });

    // Wait for context menu
    await page.locator('.nav-context-menu, .dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });

    // Click delete option
    const deleteOption = page.locator(
        '.nav-context-menu [data-action="delete"], .dropdown-item:has-text("Delete"), .dropdown-item:has-text("Eliminar")',
    );
    await deleteOption.first().click();

    // Confirm deletion if dialog appears
    try {
        const confirmBtn = page.locator('.modal.show .btn-danger, .modal.show .btn-primary').first();
        await confirmBtn.waitFor({ state: 'visible', timeout: 2000 });
        await confirmBtn.click();
        await page.waitForTimeout(500);
    } catch {
        // No confirmation dialog appeared
    }
}

/**
 * Clone the currently selected page
 *
 * @param page - Playwright page
 */
export async function clonePage(page: Page): Promise<void> {
    // Right-click on the currently selected page
    const selectedNav = page.locator('.nav-element.selected .nav-element-text').first();
    await selectedNav.scrollIntoViewIfNeeded();
    await selectedNav.click({ button: 'right' });

    // Wait for context menu
    await page.locator('.nav-context-menu, .dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });

    // Click clone option
    const cloneOption = page.locator(
        '.nav-context-menu [data-action="clone"], .dropdown-item:has-text("Clone"), .dropdown-item:has-text("Duplicar"), .dropdown-item:has-text("Clonar")',
    );
    await cloneOption.first().click();

    await page.waitForTimeout(500);
}

/**
 * Move page up in navigation tree
 *
 * @param page - Playwright page
 * @param title - Title of the page to move
 */
export async function movePageUp(page: Page, title: string): Promise<void> {
    const navItem = page.locator('.nav-element .nav-element-text', { hasText: title }).first();
    await navItem.scrollIntoViewIfNeeded();
    await navItem.click({ button: 'right' });

    await page.locator('.nav-context-menu, .dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });

    const moveUpOption = page.locator(
        '.nav-context-menu [data-action="move-up"], .dropdown-item:has-text("Move up"), .dropdown-item:has-text("Subir")',
    );
    await moveUpOption.first().click();

    await page.waitForTimeout(500);
}

/**
 * Move page down in navigation tree
 *
 * @param page - Playwright page
 * @param title - Title of the page to move
 */
export async function movePageDown(page: Page, title: string): Promise<void> {
    const navItem = page.locator('.nav-element .nav-element-text', { hasText: title }).first();
    await navItem.scrollIntoViewIfNeeded();
    await navItem.click({ button: 'right' });

    await page.locator('.nav-context-menu, .dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });

    const moveDownOption = page.locator(
        '.nav-context-menu [data-action="move-down"], .dropdown-item:has-text("Move down"), .dropdown-item:has-text("Bajar")',
    );
    await moveDownOption.first().click();

    await page.waitForTimeout(500);
}

/**
 * Move page left (promote in hierarchy)
 *
 * @param page - Playwright page
 * @param title - Title of the page to move
 */
export async function movePageLeft(page: Page, title: string): Promise<void> {
    const navItem = page.locator('.nav-element .nav-element-text', { hasText: title }).first();
    await navItem.scrollIntoViewIfNeeded();
    await navItem.click({ button: 'right' });

    await page.locator('.nav-context-menu, .dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });

    const moveLeftOption = page.locator(
        '.nav-context-menu [data-action="move-left"], .dropdown-item:has-text("Move left"), .dropdown-item:has-text("Promocionar")',
    );
    await moveLeftOption.first().click();

    await page.waitForTimeout(500);
}

/**
 * Move page right (demote in hierarchy)
 *
 * @param page - Playwright page
 * @param title - Title of the page to move
 */
export async function movePageRight(page: Page, title: string): Promise<void> {
    const navItem = page.locator('.nav-element .nav-element-text', { hasText: title }).first();
    await navItem.scrollIntoViewIfNeeded();
    await navItem.click({ button: 'right' });

    await page.locator('.nav-context-menu, .dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });

    const moveRightOption = page.locator(
        '.nav-context-menu [data-action="move-right"], .dropdown-item:has-text("Move right"), .dropdown-item:has-text("Degradar")',
    );
    await moveRightOption.first().click();

    await page.waitForTimeout(500);
}

/**
 * Wait for page content area to be ready
 *
 * @param page - Playwright page
 * @param timeout - Timeout in milliseconds
 */
export async function waitForPageContentReady(page: Page, timeout = 10000): Promise<void> {
    await page.waitForFunction(
        () => {
            const nodeContent = document.querySelector('#node-content');
            const metadata = document.querySelector('#properties-node-content-form');
            // Content area should have children and not be showing project metadata
            return nodeContent && nodeContent.children.length > 0 && (!metadata || !metadata.closest('.show'));
        },
        undefined,
        { timeout },
    );
    await page.waitForTimeout(300);
}

/**
 * Get the count of pages in the navigation tree (excluding root)
 *
 * @param page - Playwright page
 * @returns Number of pages
 */
export async function getPageCount(page: Page): Promise<number> {
    return await page.evaluate(() => {
        return document.querySelectorAll('.nav-element:not([nav-id="root"])').length;
    });
}
