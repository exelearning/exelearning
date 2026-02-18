/**
 * Undo/Redo E2E Test Helpers
 *
 * Shared helpers for testing undo/redo functionality in E2E tests.
 */

import type { Page } from '@playwright/test';

/**
 * Wait for undo button to be enabled (undo available)
 */
export async function waitForUndoAvailable(page: Page, timeout = 10000): Promise<void> {
    await page.waitForFunction(
        () => {
            const undoBtn = document.querySelector('button[title*="Undo"]');
            return undoBtn && !undoBtn.hasAttribute('disabled');
        },
        undefined,
        { timeout },
    );
}

/**
 * Wait for redo button to be enabled (redo available)
 */
export async function waitForRedoAvailable(page: Page, timeout = 10000): Promise<void> {
    await page.waitForFunction(
        () => {
            const redoBtn = document.querySelector('button[title*="Redo"]');
            return redoBtn && !redoBtn.hasAttribute('disabled');
        },
        undefined,
        { timeout },
    );
}

/**
 * Press Ctrl+Z (undo) with platform detection
 * Waits for undo to be available before pressing, then waits for redo to become available
 * (confirming undo was executed)
 */
export async function pressUndo(page: Page): Promise<void> {
    await waitForUndoAvailable(page);

    const isMac = process.platform === 'darwin';
    if (isMac) {
        await page.keyboard.press('Meta+z');
    } else {
        await page.keyboard.press('Control+z');
    }

    // Wait for redo button to become enabled, confirming undo was executed
    await waitForRedoAvailable(page);
    // Small delay to allow DOM sync to complete
    await page.waitForTimeout(300);
}

/**
 * Press Ctrl+Shift+Z (redo) with platform detection
 * Note: The app uses Ctrl+Shift+Z (not Ctrl+Y) for redo
 * Waits for redo to be available before pressing, then waits for undo to become available
 * (confirming redo was executed)
 */
export async function pressRedo(page: Page): Promise<void> {
    await waitForRedoAvailable(page);

    const isMac = process.platform === 'darwin';
    if (isMac) {
        await page.keyboard.press('Meta+Shift+z');
    } else {
        await page.keyboard.press('Control+Shift+z');
    }

    // Wait for undo button to become enabled, confirming redo was executed
    await waitForUndoAvailable(page);
    // Small delay to allow DOM sync to complete
    await page.waitForTimeout(300);
}

/**
 * Poll for block title to match expected value
 */
export async function waitForBlockTitle(
    page: Page,
    blockIndex: number,
    expectedTitle: string,
    timeout = 10000,
): Promise<void> {
    await page.waitForFunction(
        ({ idx, title }) => {
            const blocks = document.querySelectorAll('#node-content article.box');
            const block = blocks[idx];
            if (!block) return false;
            const titleEl = block.querySelector('.box-title');
            return titleEl?.textContent?.trim() === title.trim();
        },
        { idx: blockIndex, title: expectedTitle },
        { timeout },
    );
}
