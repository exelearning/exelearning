import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import {
    waitForAppReady,
    waitForLoadingScreen,
    selectFirstPage,
    addTextIdevice as addTextIdeviceHelper,
    getBlockIconSrc,
    blockHasEmptyIcon,
    changeBlockIcon,
    waitForThemeIconsLoaded,
    gotoWorkarea,
} from '../helpers/workarea-helpers';
import { pressUndo, pressRedo, waitForBlockTitle, waitForUndoAvailable } from '../helpers/undo-redo-helpers';

/**
 * E2E Tests for Undo/Redo iDevice Title - Issue #956
 *
 * Tests that visual state is correctly reflected after undo (Ctrl+Z) on iDevice title rename.
 * Previously, Yjs data was reverted but the visual title box didn't update without page reload.
 */

/**
 * Helper to wait for Yjs bridge initialization
 */
async function waitForYjsInit(page: Page): Promise<void> {
    await waitForAppReady(page);
}

/**
 * Helper to select a page node (not root)
 */
async function selectPageNode(page: Page): Promise<void> {
    await selectFirstPage(page);
}

/**
 * Helper to add a text iDevice and return to view mode
 */
async function addTextIdevice(page: Page): Promise<void> {
    // First select the page
    await selectPageNode(page);

    // Wait for content area to be ready
    await page.waitForFunction(
        () => {
            const nodeContent = document.querySelector('#node-content');
            return nodeContent !== null;
        },
        undefined,
        { timeout: 10000 },
    );

    // Use the centralized helper to add text iDevice
    await addTextIdeviceHelper(page);

    // Save the iDevice (exit edit mode) if still in edit mode
    await page.waitForTimeout(500);
    const textIdeviceNode = page.locator('#node-content article .idevice_node.text').last();
    const saveBtn = textIdeviceNode.locator('.btn-save-idevice');
    if ((await saveBtn.count()) > 0 && (await saveBtn.isVisible())) {
        await saveBtn.click();
    }

    // Wait for save to complete
    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.text:last-of-type');
            return idevice?.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 15000 },
    );
}

/**
 * Helper to get the block title text
 */
async function getBlockTitleText(page: Page, blockIndex: number = 0): Promise<string> {
    const block = page.locator('#node-content article.box').nth(blockIndex);
    const titleEl = block.locator('.box-title').first();
    return (await titleEl.textContent()) || '';
}

/**
 * Helper to edit block title inline
 */
async function editBlockTitle(page: Page, blockIndex: number, newTitle: string): Promise<void> {
    const block = page.locator('#node-content article.box').nth(blockIndex);
    const header = block.locator('header.box-head').first();

    // Find and click the edit button for the title ("Edit title" button with class btn-edit-title)
    const editBtn = header.locator('.btn-edit-title').first();
    await editBtn.click();
    await page.waitForTimeout(300);

    // The title element should now be contenteditable
    const titleEl = header.locator('.box-title').first();
    await titleEl.waitFor({ state: 'visible', timeout: 5000 });

    // Focus the element first
    await titleEl.click();
    await page.waitForTimeout(100);

    // Select all text using Ctrl+A (more reliable across browsers than triple-click)
    // Firefox has issues with triple-click selection in contenteditable elements
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+a`);

    // Small wait to ensure selection is registered
    await page.waitForTimeout(100);

    // Type new title all at once (replaces selection, firing input events that sync with Yjs)
    // Using type() instead of pressSequentially() to ensure all changes are in one Yjs transaction
    await titleEl.type(newTitle);
    await page.waitForTimeout(300);

    // Blur to finish editing
    await titleEl.blur();
    await page.waitForTimeout(500);
}

/**
 * Helper to get page name text from navigation tree
 */
async function getPageNameText(page: Page, pageIndex: number = 0): Promise<string> {
    const pageNameEl = page
        .locator('.nav-element:not([nav-id="root"]) > .nav-element-text span:not(.small-icon)')
        .nth(pageIndex);
    return (await pageNameEl.textContent()) || '';
}

/**
 * Helper to edit page name via Page Properties dialog
 * Double-clicking a page opens the Page Properties modal with Title field
 */
async function editPageName(page: Page, pageIndex: number, newName: string): Promise<void> {
    // 1. Double-click page name to open Page Properties dialog
    const pageNameEl = page.locator('.nav-element:not([nav-id="root"]) > .nav-element-text').nth(pageIndex);
    await pageNameEl.dblclick();

    // 2. Wait for Page Properties dialog to appear (it has a Title textbox)
    const titleInput = page.locator('.modal.show input[type="text"]').first();
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });

    // 3. Clear and type new title
    await titleInput.fill(newName);

    // 4. Click Save button in Page Properties dialog
    const saveBtn = page.locator('.modal.show button:has-text("Save"), .modal.show button:has-text("Guardar")').first();
    await saveBtn.click();

    // 5. Wait for modal to close
    await page.waitForFunction(() => !document.querySelector('.modal.show input[type="text"]'), undefined, {
        timeout: 5000,
    });
    await page.waitForTimeout(500);
}

// Icon helpers are imported from workarea-helpers:
// getBlockIconSrc, blockHasEmptyIcon, changeBlockIcon

test.describe('Undo/Redo iDevice Title - Issue #956', () => {
    // Skip in static mode - requires server to create projects and Yjs undo manager
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires server for project creation and Yjs undo');
    });

    test('should visually update block title after undo without page reload', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create project
        const projectUuid = await createProject(page, 'Undo Title Test');
        await gotoWorkarea(page, projectUuid);

        await waitForYjsInit(page);
        await waitForLoadingScreen(page);

        // Add a text iDevice
        await addTextIdevice(page);

        // Get the original title
        const originalTitle = await getBlockTitleText(page, 0);

        // Edit the block title
        const newTitle = 'Modified Title ' + Date.now();
        await editBlockTitle(page, 0, newTitle);

        // Verify title changed
        const titleAfterEdit = await getBlockTitleText(page, 0);
        expect(titleAfterEdit).toBe(newTitle);

        // Press Ctrl+Z to undo
        await pressUndo(page);

        // Wait for title to revert visually (polling wait)
        await waitForBlockTitle(page, 0, originalTitle);

        // Verify title reverted visually (without page reload)
        const titleAfterUndo = await getBlockTitleText(page, 0);
        expect(titleAfterUndo).toBe(originalTitle);
    });

    test('should visually update block title after redo without page reload', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create project
        const projectUuid = await createProject(page, 'Redo Title Test');
        await gotoWorkarea(page, projectUuid);

        await waitForYjsInit(page);
        await waitForLoadingScreen(page);

        // Add a text iDevice
        await addTextIdevice(page);

        // Get the original title
        const originalTitle = await getBlockTitleText(page, 0);

        // Edit the block title
        const newTitle = 'Modified Title ' + Date.now();
        await editBlockTitle(page, 0, newTitle);

        // Verify title changed
        expect(await getBlockTitleText(page, 0)).toBe(newTitle);

        // Undo
        await pressUndo(page);

        // Wait for title to revert visually (polling wait)
        await waitForBlockTitle(page, 0, originalTitle);

        // Verify title reverted
        expect(await getBlockTitleText(page, 0)).toBe(originalTitle);

        // Redo
        await pressRedo(page);

        // Wait for title to be restored visually (polling wait)
        await waitForBlockTitle(page, 0, newTitle);

        // Verify title is back to modified (without page reload)
        expect(await getBlockTitleText(page, 0)).toBe(newTitle);
    });

    test('should handle multiple undo/redo cycles correctly', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create project
        const projectUuid = await createProject(page, 'Multi Undo Test');
        await gotoWorkarea(page, projectUuid);

        await waitForYjsInit(page);
        await waitForLoadingScreen(page);

        // Add a text iDevice
        await addTextIdevice(page);

        // Get the original title
        const originalTitle = await getBlockTitleText(page, 0);

        // Make first edit
        const title1 = 'First Edit ' + Date.now();
        await editBlockTitle(page, 0, title1);
        expect(await getBlockTitleText(page, 0)).toBe(title1);

        // Wait for undo to be available before making second edit
        // This ensures first edit is captured as separate undo entry
        await waitForUndoAvailable(page);

        // Make second edit
        const title2 = 'Second Edit ' + Date.now();
        await editBlockTitle(page, 0, title2);
        expect(await getBlockTitleText(page, 0)).toBe(title2);

        // Wait for undo to be available after second edit
        await waitForUndoAvailable(page);

        // Undo second edit
        await pressUndo(page);
        await waitForBlockTitle(page, 0, title1);
        expect(await getBlockTitleText(page, 0)).toBe(title1);

        // Undo first edit
        await pressUndo(page);
        await waitForBlockTitle(page, 0, originalTitle);
        expect(await getBlockTitleText(page, 0)).toBe(originalTitle);

        // Redo first edit
        await pressRedo(page);
        await waitForBlockTitle(page, 0, title1);
        expect(await getBlockTitleText(page, 0)).toBe(title1);

        // Redo second edit
        await pressRedo(page);
        await waitForBlockTitle(page, 0, title2);
        expect(await getBlockTitleText(page, 0)).toBe(title2);
    });

    test('should sync multiple block titles on undo', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create project
        const projectUuid = await createProject(page, 'Multi Block Undo Test');
        await gotoWorkarea(page, projectUuid);

        await waitForYjsInit(page);
        await waitForLoadingScreen(page);

        // Add two text iDevices (creates two blocks)
        await addTextIdevice(page);
        await addTextIdevice(page);

        // Get original titles
        const originalTitle0 = await getBlockTitleText(page, 0);
        const originalTitle1 = await getBlockTitleText(page, 1);

        // Edit first block title
        const newTitle0 = 'Block 0 Modified ' + Date.now();
        await editBlockTitle(page, 0, newTitle0);
        expect(await getBlockTitleText(page, 0)).toBe(newTitle0);

        // Undo should revert first block title
        await pressUndo(page);
        await waitForBlockTitle(page, 0, originalTitle0);
        expect(await getBlockTitleText(page, 0)).toBe(originalTitle0);

        // Second block should remain unchanged
        expect(await getBlockTitleText(page, 1)).toBe(originalTitle1);
    });
});

test.describe('Undo/Redo Page Title - Issue #956', () => {
    // Skip in static mode - requires server to create projects and Yjs undo manager
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires server for project creation and Yjs undo');
    });

    test('should visually update page title after undo without page reload', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create project
        const projectUuid = await createProject(page, 'Page Title Undo Test');
        await gotoWorkarea(page, projectUuid);

        await waitForYjsInit(page);
        await waitForLoadingScreen(page);

        // Get the original page title
        const originalTitle = await getPageNameText(page, 0);
        expect(originalTitle).toBeTruthy();

        // Edit the page title
        const newTitle = 'Renamed Page ' + Date.now();
        await editPageName(page, 0, newTitle);

        // Verify title changed
        const titleAfterEdit = await getPageNameText(page, 0);
        expect(titleAfterEdit).toBe(newTitle);

        // Press Ctrl+Z to undo
        await pressUndo(page);

        // Verify title reverted visually (without page reload)
        const titleAfterUndo = await getPageNameText(page, 0);
        expect(titleAfterUndo).toBe(originalTitle);
    });

    test('should visually update page title after redo without page reload', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create project
        const projectUuid = await createProject(page, 'Page Title Redo Test');
        await gotoWorkarea(page, projectUuid);

        await waitForYjsInit(page);
        await waitForLoadingScreen(page);

        // Get the original page title
        const originalTitle = await getPageNameText(page, 0);

        // Edit the page title
        const newTitle = 'Renamed Page ' + Date.now();
        await editPageName(page, 0, newTitle);

        // Verify title changed
        expect(await getPageNameText(page, 0)).toBe(newTitle);

        // Undo
        await pressUndo(page);

        // Verify title reverted
        expect(await getPageNameText(page, 0)).toBe(originalTitle);

        // Redo
        await pressRedo(page);

        // Verify title is back to modified (without page reload)
        expect(await getPageNameText(page, 0)).toBe(newTitle);
    });

    test('should update page title in content area header after undo', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create project
        const projectUuid = await createProject(page, 'Page Title Content Header Test');
        await gotoWorkarea(page, projectUuid);

        await waitForYjsInit(page);
        await waitForLoadingScreen(page);

        // Select the page node to ensure content area shows the page
        await selectPageNode(page);
        await page.waitForTimeout(500);

        // Get the original page title from both nav tree and content header
        const originalTitleNav = await getPageNameText(page, 0);

        // Edit the page title
        const newTitle = 'Content Header Test ' + Date.now();
        await editPageName(page, 0, newTitle);

        // Verify title changed in nav tree
        expect(await getPageNameText(page, 0)).toBe(newTitle);

        // Undo
        await pressUndo(page);

        // Verify title reverted in nav tree
        expect(await getPageNameText(page, 0)).toBe(originalTitleNav);
    });
});

test.describe('Undo/Redo iDevice Icon - Issue #956', () => {
    // Skip in static mode - requires server to create projects and Yjs undo manager
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires server for project creation and Yjs undo');
    });

    test('should visually update block icon after undo without page reload', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create project
        const projectUuid = await createProject(page, 'Icon Undo Test');
        await gotoWorkarea(page, projectUuid);

        await waitForYjsInit(page);
        await waitForLoadingScreen(page);

        // Add a text iDevice
        await addTextIdevice(page);

        // Verify block starts with empty icon
        const hasEmptyIconBefore = await blockHasEmptyIcon(page, 0);
        expect(hasEmptyIconBefore).toBe(true);

        // Wait for theme icons to be loaded before attempting icon change
        await waitForThemeIconsLoaded(page);

        // IMPORTANT: Wait longer than Yjs UndoManager's captureTimeout (500ms default)
        // to ensure the icon change is in a separate undo transaction from block creation
        await page.waitForTimeout(500);

        // Change icon to first theme icon (index 1, since 0 is empty)
        await changeBlockIcon(page, 0, 1);

        // Verify icon changed (should no longer be empty)
        const hasEmptyIconAfter = await blockHasEmptyIcon(page, 0);
        expect(hasEmptyIconAfter).toBe(false);

        const iconSrcAfterChange = await getBlockIconSrc(page, 0);
        expect(iconSrcAfterChange).toBeTruthy();

        // Press Ctrl+Z to undo
        await pressUndo(page);

        // Wait for icon to revert (poll for the change - should no longer have an img, should have svg)
        await page.waitForFunction(
            () => {
                const block = document.querySelector('#node-content article.box');
                if (!block) return false;
                const iconBtn = block.querySelector('header.box-head button.box-icon');
                if (!iconBtn) return false;
                // After undo, the icon should be empty (no img, has exe-no-icon class or svg)
                const hasImg = iconBtn.querySelector('img') !== null;
                const hasEmptyClass = iconBtn.classList.contains('exe-no-icon');
                const hasSvg = iconBtn.querySelector('svg') !== null;
                return !hasImg && (hasEmptyClass || hasSvg);
            },
            undefined,
            { timeout: 10000 },
        );

        // Verify icon reverted visually (should be empty again)
        const hasEmptyIconAfterUndo = await blockHasEmptyIcon(page, 0);
        expect(hasEmptyIconAfterUndo).toBe(true);
    });

    test('should visually update block icon after redo without page reload', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create project
        const projectUuid = await createProject(page, 'Icon Redo Test');
        await gotoWorkarea(page, projectUuid);

        await waitForYjsInit(page);
        await waitForLoadingScreen(page);

        // Add a text iDevice
        await addTextIdevice(page);

        // Verify block starts with empty icon
        expect(await blockHasEmptyIcon(page, 0)).toBe(true);

        // Wait for theme icons to be loaded before attempting icon change
        await waitForThemeIconsLoaded(page);

        // IMPORTANT: Wait longer than Yjs UndoManager's captureTimeout (500ms default)
        // to ensure the icon change is in a separate undo transaction from block creation
        await page.waitForTimeout(500);

        // Change icon to first theme icon
        await changeBlockIcon(page, 0, 1);

        // Verify icon changed
        expect(await blockHasEmptyIcon(page, 0)).toBe(false);
        const iconSrcAfterChange = await getBlockIconSrc(page, 0);

        // Undo
        await pressUndo(page);

        // Wait for icon to revert (poll for the empty state)
        await page.waitForFunction(
            () => {
                const block = document.querySelector('#node-content article.box');
                if (!block) return false;
                const iconBtn = block.querySelector('header.box-head button.box-icon');
                if (!iconBtn) return false;
                const hasImg = iconBtn.querySelector('img') !== null;
                const hasEmptyClass = iconBtn.classList.contains('exe-no-icon');
                const hasSvg = iconBtn.querySelector('svg') !== null;
                return !hasImg && (hasEmptyClass || hasSvg);
            },
            undefined,
            { timeout: 10000 },
        );

        // Verify icon reverted
        expect(await blockHasEmptyIcon(page, 0)).toBe(true);

        // Redo
        await pressRedo(page);

        // Wait for icon to be restored (poll for the img state)
        await page.waitForFunction(
            () => {
                const block = document.querySelector('#node-content article.box');
                if (!block) return false;
                const iconBtn = block.querySelector('header.box-head button.box-icon');
                if (!iconBtn) return false;
                const hasImg = iconBtn.querySelector('img') !== null;
                return hasImg;
            },
            undefined,
            { timeout: 10000 },
        );

        // Verify icon is back to modified (without page reload)
        expect(await blockHasEmptyIcon(page, 0)).toBe(false);
        const iconSrcAfterRedo = await getBlockIconSrc(page, 0);
        // Compare icon paths without leading "./" as it may differ
        const normalizeIconPath = (path: string) => path.replace(/^\.\//, '/');
        expect(normalizeIconPath(iconSrcAfterRedo!)).toBe(normalizeIconPath(iconSrcAfterChange!));
    });

    test('should handle multiple icon change undo/redo cycles correctly', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create project
        const projectUuid = await createProject(page, 'Multi Icon Undo Test');
        await gotoWorkarea(page, projectUuid);

        await waitForYjsInit(page);
        await waitForLoadingScreen(page);

        // Add a text iDevice
        await addTextIdevice(page);

        // Initial state: empty icon
        expect(await blockHasEmptyIcon(page, 0)).toBe(true);

        // Wait for theme icons to be loaded before attempting icon change
        await waitForThemeIconsLoaded(page);

        // IMPORTANT: Wait longer than Yjs UndoManager's captureTimeout (500ms default)
        // to ensure the icon change is in a separate undo transaction from block creation
        await page.waitForTimeout(500);

        // Helper to normalize icon paths (remove leading ./)
        const normalizePath = (path: string | null) => path?.replace(/^\.\//, '/') || '';

        // Change to icon 1
        await changeBlockIcon(page, 0, 1);
        expect(await blockHasEmptyIcon(page, 0)).toBe(false);
        const iconSrc1 = normalizePath(await getBlockIconSrc(page, 0));

        // Wait for UndoManager captureTimeout to separate transactions
        await page.waitForTimeout(500);

        // Change to icon 2
        await changeBlockIcon(page, 0, 2);
        const iconSrc2 = normalizePath(await getBlockIconSrc(page, 0));
        expect(iconSrc2).not.toBe(iconSrc1);

        // Undo to icon 1 - poll for the specific icon src (normalized)
        await pressUndo(page);
        await page.waitForFunction(
            expectedSrc => {
                const block = document.querySelector('#node-content article.box');
                const img = block?.querySelector('header.box-head button.box-icon img');
                const src = img?.getAttribute('src')?.replace(/^\.\//, '/') || '';
                return src === expectedSrc;
            },
            iconSrc1,
            { timeout: 10000 },
        );
        expect(normalizePath(await getBlockIconSrc(page, 0))).toBe(iconSrc1);

        // Undo to empty - poll for empty state
        await pressUndo(page);
        await page.waitForFunction(
            () => {
                const block = document.querySelector('#node-content article.box');
                const iconBtn = block?.querySelector('header.box-head button.box-icon');
                if (!iconBtn) return false;
                const hasImg = iconBtn.querySelector('img') !== null;
                return !hasImg;
            },
            undefined,
            { timeout: 10000 },
        );
        expect(await blockHasEmptyIcon(page, 0)).toBe(true);

        // Redo to icon 1 - poll for the specific icon src (normalized)
        await pressRedo(page);
        await page.waitForFunction(
            expectedSrc => {
                const block = document.querySelector('#node-content article.box');
                const img = block?.querySelector('header.box-head button.box-icon img');
                const src = img?.getAttribute('src')?.replace(/^\.\//, '/') || '';
                return src === expectedSrc;
            },
            iconSrc1,
            { timeout: 10000 },
        );
        expect(normalizePath(await getBlockIconSrc(page, 0))).toBe(iconSrc1);

        // Redo to icon 2 - poll for the specific icon src (normalized)
        await pressRedo(page);
        await page.waitForFunction(
            expectedSrc => {
                const block = document.querySelector('#node-content article.box');
                const img = block?.querySelector('header.box-head button.box-icon img');
                const src = img?.getAttribute('src')?.replace(/^\.\//, '/') || '';
                return src === expectedSrc;
            },
            iconSrc2,
            { timeout: 10000 },
        );
        expect(normalizePath(await getBlockIconSrc(page, 0))).toBe(iconSrc2);
    });
});
