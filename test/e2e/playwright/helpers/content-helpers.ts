/**
 * Content Helpers for E2E Tests
 *
 * Helpers for iDevice and block operations:
 * - Cloning iDevices and blocks
 * - Moving iDevices within blocks
 * - Drag-drop between blocks
 * - Block management
 *
 * @example
 * ```typescript
 * import { cloneIdevice, cloneBlock, enableAdvancedMode } from '../helpers/content-helpers';
 *
 * test('my test', async ({ page }) => {
 *     await enableAdvancedMode(page);
 *     await cloneIdevice(page);
 *     await cloneBlock(page, 0);
 * });
 * ```
 */

import type { Page, Locator } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════════
// MODE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Enable advanced mode (shows clone buttons, additional options)
 *
 * @param page - Playwright page
 */
export async function enableAdvancedMode(page: Page): Promise<void> {
    await page.evaluate(() => {
        document.body.setAttribute('mode', 'advanced');
    });
    await page.waitForTimeout(300);
}

/**
 * Disable advanced mode (return to basic mode)
 *
 * @param page - Playwright page
 */
export async function disableAdvancedMode(page: Page): Promise<void> {
    await page.evaluate(() => {
        document.body.removeAttribute('mode');
    });
    await page.waitForTimeout(300);
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEVICE CLONE/MOVE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clone an iDevice (creates duplicate)
 *
 * @param page - Playwright page
 * @param ideviceLocator - Locator for the iDevice to clone (defaults to last iDevice)
 */
export async function cloneIdevice(page: Page, ideviceLocator?: Locator): Promise<void> {
    // Enable advanced mode if needed
    await enableAdvancedMode(page);

    // Get the target iDevice (default to last one)
    const target = ideviceLocator || page.locator('#node-content article .idevice_node').last();

    // Click the dropdown toggle
    const dropdown = target.locator('.idevice-dropdown-toggle, .dropdown-toggle').first();
    await dropdown.waitFor({ state: 'visible', timeout: 5000 });
    await dropdown.click();

    // Wait for menu and click clone
    await page.locator('.dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });
    const cloneOption = page.locator(
        '.dropdown-menu.show [data-action="clone"], .dropdown-menu.show .dropdown-item:has-text("Clone"), .dropdown-menu.show .dropdown-item:has-text("Duplicar")',
    );
    await cloneOption.first().click();

    // Wait for clone to appear
    await page.waitForTimeout(1000);
}

/**
 * Clone a block (creates duplicate with all iDevices)
 *
 * @param page - Playwright page
 * @param blockIndex - Index of the block to clone (defaults to last block)
 */
export async function cloneBlock(page: Page, blockIndex?: number): Promise<void> {
    // Enable advanced mode if needed
    await enableAdvancedMode(page);

    // Get the target block
    const blocks = page.locator('#node-content article .block_node');
    const target = blockIndex !== undefined ? blocks.nth(blockIndex) : blocks.last();

    // Click the block dropdown toggle
    const dropdown = target.locator('.block-dropdown-toggle, .dropdown-toggle').first();
    await dropdown.waitFor({ state: 'visible', timeout: 5000 });
    await dropdown.click();

    // Wait for menu and click clone
    await page.locator('.dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });
    const cloneOption = page.locator(
        '.dropdown-menu.show [data-action="clone"], .dropdown-menu.show .dropdown-item:has-text("Clone"), .dropdown-menu.show .dropdown-item:has-text("Duplicar")',
    );
    await cloneOption.first().click();

    // Wait for clone to appear
    await page.waitForTimeout(1000);
}

/**
 * Move iDevice up within block
 *
 * @param page - Playwright page
 * @param ideviceLocator - Locator for the iDevice to move
 */
export async function moveIdeviceUp(page: Page, ideviceLocator: Locator): Promise<void> {
    await enableAdvancedMode(page);

    const dropdown = ideviceLocator.locator('.idevice-dropdown-toggle, .dropdown-toggle').first();
    await dropdown.click();

    await page.locator('.dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });
    const moveUpOption = page.locator(
        '.dropdown-menu.show [data-action="move-up"], .dropdown-menu.show .dropdown-item:has-text("Move up"), .dropdown-menu.show .dropdown-item:has-text("Subir")',
    );
    await moveUpOption.first().click();

    await page.waitForTimeout(500);
}

/**
 * Move iDevice down within block
 *
 * @param page - Playwright page
 * @param ideviceLocator - Locator for the iDevice to move
 */
export async function moveIdeviceDown(page: Page, ideviceLocator: Locator): Promise<void> {
    await enableAdvancedMode(page);

    const dropdown = ideviceLocator.locator('.idevice-dropdown-toggle, .dropdown-toggle').first();
    await dropdown.click();

    await page.locator('.dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });
    const moveDownOption = page.locator(
        '.dropdown-menu.show [data-action="move-down"], .dropdown-menu.show .dropdown-item:has-text("Move down"), .dropdown-menu.show .dropdown-item:has-text("Bajar")',
    );
    await moveDownOption.first().click();

    await page.waitForTimeout(500);
}

/**
 * Drag iDevice from one block to another
 *
 * @param page - Playwright page
 * @param sourceIdevice - Locator for the source iDevice
 * @param targetBlock - Locator for the target block
 */
export async function dragIdeviceToBlock(page: Page, sourceIdevice: Locator, targetBlock: Locator): Promise<void> {
    await enableAdvancedMode(page);

    // Get the drag handle
    const dragHandle = sourceIdevice.locator('.idevice-drag-handle, .drag-handle').first();
    await dragHandle.waitFor({ state: 'visible', timeout: 5000 });

    // Get bounding boxes
    const sourceBox = await dragHandle.boundingBox();
    const targetBox = await targetBlock.boundingBox();

    if (!sourceBox || !targetBox) {
        throw new Error('Could not get bounding boxes for drag operation');
    }

    // Perform drag
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();

    await page.waitForTimeout(1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Delete a block
 *
 * @param page - Playwright page
 * @param blockIndex - Index of the block to delete
 */
export async function deleteBlock(page: Page, blockIndex: number): Promise<void> {
    await enableAdvancedMode(page);

    const blocks = page.locator('#node-content article .block_node');
    const target = blocks.nth(blockIndex);

    const dropdown = target.locator('.block-dropdown-toggle, .dropdown-toggle').first();
    await dropdown.click();

    await page.locator('.dropdown-menu.show').waitFor({ state: 'visible', timeout: 5000 });
    const deleteOption = page.locator(
        '.dropdown-menu.show [data-action="delete"], .dropdown-menu.show .dropdown-item:has-text("Delete"), .dropdown-menu.show .dropdown-item:has-text("Eliminar")',
    );
    await deleteOption.first().click();

    // Handle confirmation modal if it appears
    try {
        const confirmBtn = page.locator('.modal.show .btn-danger, .modal.show .btn-primary').first();
        await confirmBtn.waitFor({ state: 'visible', timeout: 2000 });
        await confirmBtn.click();
    } catch {
        // No confirmation dialog
    }

    await page.waitForTimeout(500);
}

/**
 * Get block count on current page
 *
 * @param page - Playwright page
 * @returns Number of blocks
 */
export async function getBlockCount(page: Page): Promise<number> {
    return await page.locator('#node-content article .block_node').count();
}

/**
 * Get iDevice count on current page
 *
 * @param page - Playwright page
 * @param ideviceType - Optional iDevice type to filter by
 * @returns Number of iDevices
 */
export async function getIdeviceCount(page: Page, ideviceType?: string): Promise<number> {
    if (ideviceType) {
        return await page.locator(`#node-content article .idevice_node.${ideviceType}`).count();
    }
    return await page.locator('#node-content article .idevice_node').count();
}

/**
 * Get iDevice by index on current page
 *
 * @param page - Playwright page
 * @param index - Index of the iDevice
 * @param ideviceType - Optional iDevice type to filter by
 * @returns Locator for the iDevice
 */
export function getIdeviceByIndex(page: Page, index: number, ideviceType?: string): Locator {
    if (ideviceType) {
        return page.locator(`#node-content article .idevice_node.${ideviceType}`).nth(index);
    }
    return page.locator('#node-content article .idevice_node').nth(index);
}

/**
 * Get block by index on current page
 *
 * @param page - Playwright page
 * @param index - Index of the block
 * @returns Locator for the block
 */
export function getBlockByIndex(page: Page, index: number): Locator {
    return page.locator('#node-content article .block_node').nth(index);
}
