/**
 * Unified E2E Test Helpers for eXeLearning Workarea
 *
 * Centralized helpers for common UI interactions across all Playwright tests.
 * These functions standardize how tests interact with the workarea, preview panel,
 * navigation tree, iDevices, and file operations.
 *
 * @example
 * ```typescript
 * import {
 *     waitForAppReady,
 *     openElpFile,
 *     openPreviewPanel,
 *     navigateToIdevicePage,
 *     verifyIdeviceInEditor,
 * } from '../helpers/workarea-helpers';
 *
 * test('my test', async ({ page }) => {
 *     await waitForAppReady(page);
 *     await openElpFile(page, '/path/to/file.elp');
 *     await openPreviewPanel(page);
 * });
 * ```
 */

import type { Page, FrameLocator, Download } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════════
// APP INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wait for eXeLearning app to be fully initialized
 * Waits for Yjs bridge to be available and loading screen to disappear
 */
export async function waitForAppReady(page: Page, timeout = 30000): Promise<void> {
    // Wait for Yjs bridge initialization
    await page.waitForFunction(
        () => {
            const app = (window as any).eXeLearning?.app;
            return app?.project?._yjsBridge !== undefined;
        },
        { timeout },
    );

    // Wait for loading screen to disappear
    await waitForLoadingScreen(page, timeout);
}

/**
 * Wait for loading screen to disappear
 */
export async function waitForLoadingScreen(page: Page, timeout = 30000): Promise<void> {
    await page.waitForFunction(
        () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
        { timeout },
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Open an ELP file via File menu -> Open
 * This opens the file as a new project (replacing the current one)
 *
 * @param page - Playwright page
 * @param fixturePath - Absolute path to the ELP file
 * @param minPages - Minimum number of pages to wait for in navigation (default 1)
 */
export async function openElpFile(page: Page, fixturePath: string, minPages = 1): Promise<void> {
    // Open File menu dropdown
    await page.locator('#dropdownFile').click();
    await page.waitForTimeout(300);

    // Click Open option (not Import)
    const openOption = page.locator('#navbar-button-openuserodefiles');
    await openOption.waitFor({ state: 'visible', timeout: 5000 });
    await openOption.click();

    // Wait for the Open modal to appear
    const openModal = page.locator('#modalOpenUserOdeFiles');
    await openModal.waitFor({ state: 'visible', timeout: 10000 });

    // Setup file chooser BEFORE clicking the upload button
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });

    // Click "Select a file from your device" button in the modal
    const uploadButton = openModal.locator('.ode-files-button-upload');
    await uploadButton.waitFor({ state: 'visible', timeout: 5000 });
    await uploadButton.click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    // Handle "Open without saving" confirmation dialog
    await handleCloseWithoutSavingModal(page);

    // Wait for file to be processed - Yjs navigation has pages
    await page.waitForFunction(
        expectedMinPages => {
            try {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return false;
                const docManager = bridge.getDocumentManager();
                if (!docManager || !docManager.initialized) return false;
                const yDoc = docManager.getDoc();
                if (!yDoc) return false;
                const navigation = yDoc.getArray('navigation');
                return navigation && navigation.length >= expectedMinPages;
            } catch {
                return false;
            }
        },
        minPages,
        { timeout: 90000 },
    );

    // Wait for loading screen to hide
    await waitForLoadingScreen(page, 30000);

    // Wait for import progress overlay to disappear (if present)
    await page.waitForFunction(() => !document.querySelector('#import-progress-overlay'), { timeout: 30000 });

    // Additional wait for all handlers to complete
    await page.waitForTimeout(2000);
}

/**
 * Handle "Open without saving" confirmation modal
 * This modal appears when opening a file while another project is open
 */
export async function handleCloseWithoutSavingModal(page: Page): Promise<void> {
    const modal = page.locator('#modalSessionLogout');
    try {
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        const openWithoutSavingBtn = modal.locator('button.session-logout-without-save');
        await openWithoutSavingBtn.click();
        await modal.waitFor({ state: 'hidden', timeout: 5000 });
    } catch {
        // Modal didn't appear - that's fine, continue
    }
}

/**
 * Save the current project
 */
export async function saveProject(page: Page): Promise<void> {
    await page.click('#head-top-save-button');
    // Wait for save to complete
    await page.waitForTimeout(2000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Navigate to a page by title in the navigation tree
 *
 * @param page - Playwright page
 * @param title - Page title to click (partial match supported)
 */
export async function navigateToPageByTitle(page: Page, title: string): Promise<void> {
    const navItem = page.locator('.nav-element .nav-element-text', { hasText: title }).first();
    await navItem.scrollIntoViewIfNeeded();
    await navItem.click({ force: true });

    // Wait for content to load
    await page.waitForFunction(
        () => {
            const nodeContent = document.querySelector('#node-content');
            return nodeContent && nodeContent.children.length > 0;
        },
        { timeout: 10000 },
    );
    await page.waitForTimeout(500);
}

/**
 * Navigate to the page containing a specific iDevice by searching through navigation
 *
 * @param page - Playwright page
 * @param ideviceId - The iDevice element ID to look for
 * @param ideviceType - The iDevice type class name
 * @returns true if iDevice was found, false otherwise
 */
export async function navigateToIdevicePage(page: Page, ideviceId: string, ideviceType: string): Promise<boolean> {
    // First check if iDevice is already visible
    const isAlreadyVisible = await page.evaluate(
        ({ id, type }) => {
            const el = document.getElementById(id);
            return el?.classList.contains(type);
        },
        { id: ideviceId, type: ideviceType },
    );

    if (isAlreadyVisible) {
        return true;
    }

    // Get all navigation elements and click through them to find the page with our iDevice
    const navElements = page.locator('.nav-element:not([nav-id="root"]) > .nav-element-text');
    const count = await navElements.count();

    for (let i = 0; i < count; i++) {
        const navItem = navElements.nth(i);
        await navItem.scrollIntoViewIfNeeded();
        await navItem.click({ force: true });
        await page.waitForTimeout(500);

        // Check if iDevice is now visible
        const found = await page.evaluate(
            ({ id, type }) => {
                const el = document.getElementById(id);
                return el?.classList.contains(type);
            },
            { id: ideviceId, type: ideviceType },
        );

        if (found) {
            // Wait for content to fully load
            await page.waitForTimeout(1000);
            return true;
        }
    }

    return false;
}

/**
 * Select a node in the navigation tree by ID
 *
 * @param page - Playwright page
 * @param nodeId - Navigation node ID
 */
export async function selectNavNode(page: Page, nodeId: string): Promise<void> {
    const navItem = page.locator(`.nav-element[nav-id="${nodeId}"] > .nav-element-text`);
    await navItem.scrollIntoViewIfNeeded();
    await navItem.click({ force: true });
    await page.waitForTimeout(500);
}

/**
 * Select a non-root page (required before adding iDevices)
 * Selects the first available page if no page is currently selected
 */
export async function selectFirstPage(page: Page): Promise<void> {
    const isPageSelected = await page.evaluate(() => {
        const selected = document.querySelector('.nav-element.selected:not([nav-id="root"])');
        return !!selected;
    });

    if (!isPageSelected) {
        const pageNode = page.locator('.nav-element:not([nav-id="root"]) > .nav-element-text').first();
        await pageNode.scrollIntoViewIfNeeded();
        await pageNode.click({ force: true });
        await page.waitForTimeout(1000);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREVIEW PANEL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Open the preview panel
 */
export async function openPreviewPanel(page: Page): Promise<void> {
    // Wait for Service Worker to be ready first
    await page
        .waitForFunction(
            () => {
                const app = (window as any).eXeLearning?.app;
                return (
                    app?._previewSwRegistration?.active?.state === 'activated' ||
                    navigator.serviceWorker?.controller !== null
                );
            },
            { timeout: 15000 },
        )
        .catch(() => {
            // Continue even if SW check times out
        });

    const previewPanel = page.locator('#previewsidenav');
    const isVisible = await previewPanel.isVisible();
    if (!isVisible) {
        await page.click('#head-bottom-preview');
        await previewPanel.waitFor({ state: 'visible', timeout: 15000 });
    }

    // Wait for iframe to exist
    const previewIframe = page.locator('#preview-iframe');
    await previewIframe.waitFor({ state: 'attached', timeout: 10000 });

    // Give time for preview generation
    await page.waitForTimeout(2000);
}

/**
 * Close the preview panel
 */
export async function closePreviewPanel(page: Page): Promise<void> {
    const previewPanel = page.locator('#previewsidenav');
    const isVisible = await previewPanel.isVisible();
    if (isVisible) {
        await page.click('#head-bottom-preview');
        await previewPanel.waitFor({ state: 'hidden', timeout: 15000 });
    }
}

/**
 * Get the preview iframe frame locator
 */
export function getPreviewFrame(page: Page): FrameLocator {
    return page.frameLocator('#preview-iframe');
}

/**
 * Wait for preview content to load
 * Opens preview panel if not already open, waits for article to be attached
 *
 * @returns true if content loaded, false if timeout
 */
export async function waitForPreviewContent(page: Page, timeout = 30000): Promise<boolean> {
    // Always click preview button to ensure panel opens
    await page.click('#head-bottom-preview');
    const previewPanel = page.locator('#previewsidenav');
    await previewPanel.waitFor({ state: 'visible', timeout: 15000 });

    // Wait for content to load in iframe
    try {
        const iframe = page.frameLocator('#preview-iframe');
        await iframe.locator('article').first().waitFor({ state: 'attached', timeout });
        return true;
    } catch {
        return false;
    }
}

/**
 * Navigate within the preview iframe by clicking a link
 *
 * @param page - Playwright page
 * @param linkText - Text to find in navigation links
 */
export async function navigateInPreview(page: Page, linkText: string): Promise<void> {
    const iframe = getPreviewFrame(page);
    const navLinks = iframe.locator('nav a, .menu a, #siteNav a');
    const link = navLinks.filter({ hasText: linkText }).first();
    await link.click();
    await page.waitForTimeout(1500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEVICE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add an iDevice from the panel by type
 *
 * @param page - Playwright page
 * @param ideviceType - iDevice type ID (e.g., 'text', 'rubric', 'flipcards')
 */
export async function addIdevice(page: Page, ideviceType: string): Promise<void> {
    // Ensure a non-root page is selected
    await selectFirstPage(page);

    // Find the iDevice item - wait for it to be visible first
    const idevice = page.locator(`.idevice_item[id="${ideviceType}"], [data-testid="idevice-${ideviceType}"]`).first();
    await idevice.waitFor({ state: 'visible', timeout: 10000 });
    await idevice.scrollIntoViewIfNeeded();
    await idevice.click();

    // Wait for iDevice to appear in content area
    await page.locator(`#node-content article .idevice_node.${ideviceType}`).first().waitFor({ timeout: 15000 });
}

/**
 * Enter edit mode on an iDevice
 *
 * @param page - Playwright page
 * @param ideviceId - iDevice element ID
 */
export async function editIdevice(page: Page, ideviceId: string): Promise<void> {
    const idevice = page.locator(`#${ideviceId}`);
    const editBtn = idevice.locator('.btn-edit-idevice');
    await editBtn.click();

    // Wait for edition mode
    await page.waitForFunction(
        id => {
            const el = document.getElementById(id);
            return el?.getAttribute('mode') === 'edition';
        },
        ideviceId,
        { timeout: 10000 },
    );
}

/**
 * Save an iDevice (exit edit mode)
 *
 * @param page - Playwright page
 * @param ideviceId - iDevice element ID
 */
export async function saveIdevice(page: Page, ideviceId: string): Promise<void> {
    const idevice = page.locator(`#${ideviceId}`);
    const saveBtn = idevice.locator('.btn-save-idevice');
    await saveBtn.click();

    // Wait for edition mode to end
    await waitForIdeviceEditionEnd(page, ideviceId);
}

/**
 * Delete an iDevice
 *
 * @param page - Playwright page
 * @param ideviceId - iDevice element ID
 */
export async function deleteIdevice(page: Page, ideviceId: string): Promise<void> {
    const idevice = page.locator(`#${ideviceId}`);
    const deleteBtn = idevice.locator('.btn-delete-idevice');
    await deleteBtn.click();

    // Wait for confirmation modal and confirm
    const confirmBtn = page.locator('.modal.show .btn-danger, .modal.show [data-action="confirm"]').first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmBtn.click();

    // Wait for iDevice to be removed
    await page.waitForFunction(id => !document.getElementById(id), ideviceId, { timeout: 10000 });
}

/**
 * Wait for iDevice to exit edition mode
 *
 * @param page - Playwright page
 * @param ideviceId - iDevice element ID
 * @param timeout - Timeout in milliseconds
 */
export async function waitForIdeviceEditionEnd(page: Page, ideviceId: string, timeout = 15000): Promise<void> {
    await page.waitForFunction(
        id => {
            const el = document.getElementById(id);
            return el && el.getAttribute('mode') !== 'edition';
        },
        ideviceId,
        { timeout },
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify iDevice is rendered in the editor DOM
 *
 * @param page - Playwright page
 * @param ideviceType - iDevice type class name
 * @param expectedElements - Elements to check within the iDevice
 * @returns Object with found status and details
 */
export async function verifyIdeviceInEditor(
    page: Page,
    ideviceType: string,
    expectedElements: { selector: string; minCount?: number }[] = [],
): Promise<{ found: boolean; details: Record<string, unknown> }> {
    return await page.evaluate(
        ({ type, elements }) => {
            const nodeContent = document.querySelector('#node-content');
            if (!nodeContent) return { found: false, details: { error: 'No #node-content' } };

            // Find iDevice node
            const ideviceNode = nodeContent.querySelector(`.idevice_node.${type}`);
            if (!ideviceNode) return { found: false, details: { error: `No .idevice_node.${type}` } };

            const details: Record<string, unknown> = { ideviceFound: true, elements: {} };
            const elementsResult: Record<string, { count: number; found: boolean }> = {};

            for (const { selector, minCount = 1 } of elements) {
                const matches = ideviceNode.querySelectorAll(selector);
                elementsResult[selector] = { count: matches.length, found: matches.length >= minCount };
            }
            details.elements = elementsResult;

            return { found: true, details };
        },
        { type: ideviceType, elements: expectedElements },
    );
}

/**
 * Verify content exists in the preview iframe
 * Opens preview panel if not already open and navigates through pages if needed
 *
 * @param page - Playwright page
 * @param selectors - CSS selectors to check in preview
 * @returns Object with found status and details
 */
export async function verifyInPreview(
    page: Page,
    selectors: string[],
): Promise<{ found: boolean; details: Record<string, unknown> }> {
    // Open preview panel if not already open
    const previewPanel = page.locator('#previewsidenav');
    const isVisible = await previewPanel.isVisible();
    if (!isVisible) {
        await page.click('#head-bottom-preview');
        await previewPanel.waitFor({ state: 'visible', timeout: 15000 });
    }

    // Wait for preview content to actually load in the iframe
    const iframe = getPreviewFrame(page);
    try {
        await iframe.locator('article, main, body > *').first().waitFor({ state: 'attached', timeout: 15000 });
    } catch {
        return { found: false, details: { error: 'Preview iframe content did not load' } };
    }

    // Helper function to check selectors
    const checkSelectors = async (): Promise<Record<string, { count: number; found: boolean }>> => {
        const results: Record<string, { count: number; found: boolean }> = {};
        for (const selector of selectors) {
            try {
                const count = await iframe.locator(selector).count();
                results[selector] = { count, found: count > 0 };
            } catch {
                results[selector] = { count: 0, found: false };
            }
        }
        return results;
    };

    // Check current page
    let results = await checkSelectors();
    let anyFound = Object.values(results).some(r => r.found);

    if (anyFound) {
        return { found: true, details: results };
    }

    // If not found, try navigating through all pages in the preview
    try {
        const navLinks = iframe.locator('nav a, #siteNav a, .menu a');
        const linkCount = await navLinks.count();

        for (let i = 0; i < linkCount; i++) {
            const link = navLinks.nth(i);
            const href = await link.getAttribute('href');

            // Skip external links or anchor-only links
            if (!href || href.startsWith('http') || href === '#') {
                continue;
            }

            try {
                await link.click();
                await page.waitForTimeout(1500);

                results = await checkSelectors();
                anyFound = Object.values(results).some(r => r.found);

                if (anyFound) {
                    return { found: true, details: results };
                }
            } catch {
                // Link might not be clickable, continue
            }
        }
    } catch {
        // Navigation failed, return what we have
    }

    return { found: anyFound, details: results };
}

/**
 * Get iDevice data from Yjs by searching for component type
 *
 * @param page - Playwright page
 * @param ideviceType - iDevice type to search for
 * @returns iDevice data or error object
 */
export async function getIdeviceFromYjs(
    page: Page,
    ideviceType: string,
): Promise<{
    elementId?: string;
    type?: string;
    jsonProperties?: any;
    pageName?: string;
    editButtonEnabled?: boolean | null;
    hasCorrectClass?: boolean;
    domElementExists?: boolean;
    error?: string;
}> {
    return await page.evaluate(targetType => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        if (!bridge) return { error: 'No yjsBridge' };
        const yDoc = bridge.getDocumentManager()?.getDoc();
        if (!yDoc) return { error: 'No yDoc' };

        // Recursive function to search through pages and subpages
        const searchInPage = (pageMap: any, parentName: string): { comp: any; pageName: string } | null => {
            const currentName = pageMap?.get('name') || parentName;

            // Search blocks in this page
            const blocks = pageMap?.get('blocks');
            if (blocks) {
                for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
                    const blockMap = blocks.get(blockIdx);
                    const components = blockMap?.get('components');
                    if (components) {
                        for (let compIdx = 0; compIdx < components.length; compIdx++) {
                            const c = components.get(compIdx);
                            if (c?.get('type') === targetType) {
                                return { comp: c, pageName: currentName };
                            }
                        }
                    }
                }
            }

            // Search subpages (nested pages)
            const subpages = pageMap?.get('pages');
            if (subpages) {
                for (let i = 0; i < subpages.length; i++) {
                    const result = searchInPage(subpages.get(i), currentName);
                    if (result) return result;
                }
            }

            return null;
        };

        // Search through all top-level pages
        const navigation = yDoc.getArray('navigation');
        let comp = null;
        let pageName = '';

        for (let pageIdx = 0; pageIdx < navigation.length && !comp; pageIdx++) {
            const pageMap = navigation.get(pageIdx);
            const result = searchInPage(pageMap, `Page ${pageIdx}`);
            if (result) {
                comp = result.comp;
                pageName = result.pageName;
            }
        }

        if (!comp) return { error: `Component with type ${targetType} not found in Yjs` };

        const type = comp.get('type');
        const id = comp.get('id');
        const jsonPropsStr = comp.get('jsonProperties');
        let jsonProperties = null;

        if (jsonPropsStr) {
            try {
                jsonProperties = typeof jsonPropsStr === 'string' ? JSON.parse(jsonPropsStr) : jsonPropsStr;
            } catch {
                return { error: 'Failed to parse jsonProperties', type, elementId: id };
            }
        }

        // Check if DOM element exists and Edit button state
        const element = document.getElementById(id);
        const editBtn = element?.querySelector('.btn-edit-idevice');
        const isEditDisabled = editBtn?.hasAttribute('disabled') || editBtn?.classList.contains('disabled');

        return {
            elementId: id,
            type,
            jsonProperties,
            pageName,
            editButtonEnabled: element ? !isEditDisabled : null,
            hasCorrectClass: element?.classList.contains(targetType) ?? false,
            domElementExists: !!element,
        };
    }, ideviceType);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Open project properties modal
 */
export async function openProjectProperties(page: Page): Promise<void> {
    await page.click('#head-top-settings-button');
    const modal = page.locator('#modalProperties');
    await modal.waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Close project properties modal
 */
export async function closeProjectProperties(page: Page): Promise<void> {
    const modal = page.locator('#modalProperties');
    const closeBtn = modal.locator('button[data-bs-dismiss="modal"], .btn-close').first();
    await closeBtn.click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
}

/**
 * Toggle a project property checkbox
 *
 * @param page - Playwright page
 * @param propertyId - Property input ID
 * @param value - Desired checkbox state
 */
export async function toggleProjectProperty(page: Page, propertyId: string, value: boolean): Promise<void> {
    const checkbox = page.locator(`#${propertyId}`);
    const isChecked = await checkbox.isChecked();
    if (isChecked !== value) {
        await checkbox.click();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEVICE CATEGORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Expand an iDevice category in the panel
 *
 * @param page - Playwright page
 * @param categoryPattern - Regex pattern to match category name (e.g., /Assessment|Evaluación/i)
 */
export async function expandIdeviceCategory(page: Page, categoryPattern: RegExp): Promise<void> {
    // Wait for at least one category to be visible
    await page.locator('.idevice_category').first().waitFor({ state: 'visible', timeout: 15000 });

    // Find the category matching the pattern using filter
    const category = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: categoryPattern }),
        })
        .first();

    if ((await category.count()) > 0) {
        // Check if category is collapsed (has "off" class)
        const isCollapsed = await category.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            // Click on the h3 heading directly (it's the clickable element)
            const heading = category.locator('h3.idevice_category_name');
            await heading.click();
            await page.waitForTimeout(800);
        }
    }

    // Wait for content to be visible after expansion
    await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH & EXPORT OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Enable search box option in project export settings
 * Uses the Project Properties button in the top bar to show properties inline
 */
export async function enableSearchOption(page: Page): Promise<void> {
    // Click Project Properties button to show project properties inline
    const propertiesButton = page.locator('#head-top-settings-button');
    await propertiesButton.waitFor({ state: 'visible', timeout: 10000 });
    await propertiesButton.click();

    // Wait for properties to appear in the content area
    await page.waitForTimeout(1000);

    // Wait for the "Export options" section to be present in DOM
    const exportSection = page.getByRole('button', { name: /Export options|Opciones de exportación/i }).first();

    // Scroll the export section into view if needed
    await exportSection.scrollIntoViewIfNeeded({ timeout: 10000 });

    // Check if the export options section is expanded
    const isExpanded = (await exportSection.getAttribute('aria-expanded')) === 'true';
    if (!isExpanded) {
        await exportSection.click();
        await page.waitForTimeout(500);
    }

    // Find the search toggle in the export options section
    const searchToggle = page.locator('input[property="pp_addSearchBox"]');

    // Scroll to and wait for the toggle to be visible
    await searchToggle.scrollIntoViewIfNeeded({ timeout: 10000 });

    const isChecked = await searchToggle.isChecked();
    if (!isChecked) {
        // Click the toggle container to enable
        const toggleItem = page.locator('.toggle-item').filter({ has: searchToggle }).first();
        if ((await toggleItem.count()) > 0) {
            await toggleItem.click();
        } else {
            await searchToggle.click({ force: true });
        }
        await page.waitForTimeout(500);
    }

    // Verify metadata was updated via Yjs binding
    await page.waitForFunction(
        () => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const metadata = bridge?.documentManager?.getMetadata();
            const value = metadata?.get('addSearchBox');
            return value === true || value === 'true';
        },
        { timeout: 5000 },
    );
}

/**
 * Clone the currently selected page in the navigation tree
 */
export async function cloneCurrentPage(page: Page): Promise<void> {
    const cloneBtn = page.locator('.button_nav_action.action_clone');
    await cloneBtn.click();
    await page.waitForTimeout(2000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Select a page in the navigation tree by index
 *
 * @param page - Playwright page
 * @param pageIndex - Zero-based index of the page to select (default 0)
 */
export async function selectPageByIndex(page: Page, pageIndex: number = 0): Promise<void> {
    // Get all page nodes (excluding root)
    const pageNodes = page.locator('.nav-element:not([nav-id="root"]) > .nav-element-text');
    const count = await pageNodes.count();

    if (count === 0) {
        throw new Error('No pages found in navigation tree');
    }

    const targetIndex = Math.min(pageIndex, count - 1);
    const targetNode = pageNodes.nth(targetIndex);

    await targetNode.scrollIntoViewIfNeeded();
    await targetNode.click({ force: true });
    await page.waitForTimeout(1000);

    // Wait for page content area to be ready
    await page
        .waitForFunction(
            () => {
                const nodeContent = document.querySelector('#node-content');
                const metadata = document.querySelector('#properties-node-content-form');
                return nodeContent && (!metadata || !metadata.closest('.show'));
            },
            { timeout: 10000 },
        )
        .catch(() => {});
}

/**
 * Add a new page to the project via Yjs bridge
 *
 * @param page - Playwright page
 * @param name - Name for the new page (default 'New Page')
 * @returns The page ID of the newly created page
 */
export async function addPage(page: Page, name: string = 'New Page'): Promise<string> {
    const pageId = await page.evaluate(pageName => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        if (!bridge) throw new Error('Yjs bridge not available');

        // Add page using the structure binding
        const newPage = bridge.structureBinding.addPage(pageName, null);
        return newPage.id || newPage.pageId;
    }, name);

    await page.waitForTimeout(500);
    return pageId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT EXPORT/IMPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Export a block as a .block file
 *
 * @param page - Playwright page
 * @param blockId - The block element ID (without the 'dropdownMenuButton' prefix)
 * @returns The Download object for the exported file
 */
export async function exportBlock(page: Page, blockId: string): Promise<Download> {
    // Click on the block's actions dropdown button (three dots)
    const dropdownBtn = page.locator(`#dropdownMenuButton${blockId}`);
    await dropdownBtn.waitFor({ state: 'visible', timeout: 10000 });
    await dropdownBtn.click();
    await page.waitForTimeout(300);

    // Wait for download event and click export button
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    const exportBtn = page.locator(`#dropdownBlockMore-button-export${blockId}`);
    await exportBtn.waitFor({ state: 'visible', timeout: 5000 });
    await exportBtn.click();

    const download = await downloadPromise;
    return download;
}

/**
 * Export an iDevice as a .idevice file
 *
 * @param page - Playwright page
 * @param ideviceId - The iDevice element ID
 * @returns The Download object for the exported file
 */
export async function exportIdevice(page: Page, ideviceId: string): Promise<Download> {
    // Click on the iDevice's actions dropdown button (three dots horizontal)
    const dropdownBtn = page.locator(`#dropdownMenuButtonIdevice${ideviceId}`);
    await dropdownBtn.waitFor({ state: 'visible', timeout: 10000 });
    await dropdownBtn.click();
    await page.waitForTimeout(300);

    // Wait for download event and click export button
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    const exportBtn = page.locator(`#exportIdevice${ideviceId}`);
    await exportBtn.waitFor({ state: 'visible', timeout: 5000 });
    await exportBtn.click();

    const download = await downloadPromise;
    return download;
}

/**
 * Import a component file (.block or .idevice) to the current page
 * Uses the dedicated iDevice import file input (#local-ode-file-upload)
 *
 * @param page - Playwright page
 * @param filePath - Absolute path to the component file
 */
export async function importComponent(page: Page, filePath: string): Promise<void> {
    // Ensure ComponentImporter is loaded
    try {
        await page.waitForFunction(
            () => {
                return (window as any).ComponentImporter !== undefined;
            },
            { timeout: 15000 },
        );
    } catch {
        const debugInfo = await page.evaluate(() => ({
            YjsLoaderLoaded: (window as any).YjsLoader?.getStatus?.()?.loaded,
            ComponentImporter: typeof (window as any).ComponentImporter,
        }));
        throw new Error(`ComponentImporter not loaded: ${JSON.stringify(debugInfo)}`);
    }

    // Use the dedicated iDevice import file input (#local-ode-file-upload)
    // This is the hidden file input created by createIdevicesUploadInput() in menuStructureBehaviour.js
    const fileInput = page.locator('#local-ode-file-upload');

    // Wait for the file input to be available
    await fileInput.waitFor({ state: 'attached', timeout: 10000 });

    // Set the file - this triggers the import directly
    await fileInput.setInputFiles(filePath);

    // Wait for import to complete - watch for iDevice to appear in the page
    await page.waitForTimeout(3000);

    // Close any error modal if present
    const errorModal = page.locator('.modal.show:has-text("Import error"), .modal.show:has-text("Error")');
    if (await errorModal.isVisible().catch(() => false)) {
        const errorText = await errorModal.textContent();
        console.log('Import error modal:', errorText);
        const closeBtn = errorModal.locator('.btn-close, button:has-text("Close")').first();
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
        }
        throw new Error(`Import failed: ${errorText}`);
    }
}

/**
 * Get the block and iDevice IDs from the first block on the current page
 *
 * @param page - Playwright page
 * @returns Object containing blockId and ideviceId
 */
export async function getFirstBlockAndIdeviceIds(page: Page): Promise<{ blockId: string; ideviceId: string }> {
    // Find the block - it's article.box in #node-content
    const blockNode = page.locator('#node-content article.box').first();
    await blockNode.waitFor({ state: 'visible', timeout: 15000 });

    // Get block ID from the element's 'id' attribute
    const blockId = await blockNode.getAttribute('id');
    if (!blockId) {
        // Debug: check what's in node-content
        const html = await page.evaluate(() => document.querySelector('#node-content')?.innerHTML.substring(0, 1000));
        console.log('Node content HTML:', html);
        throw new Error('Block does not have an id attribute');
    }

    // Find the iDevice inside the block
    // The iDevice dropdown button has id="dropdownMenuButtonIdevice{ideviceId}"
    const ideviceDropdown = blockNode.locator('[id^="dropdownMenuButtonIdevice"]').first();
    await ideviceDropdown.waitFor({ state: 'attached', timeout: 10000 });

    const dropdownId = await ideviceDropdown.getAttribute('id');
    const ideviceId = dropdownId?.replace('dropdownMenuButtonIdevice', '') || '';

    if (!ideviceId) {
        // Try alternative: get ID from idevice_node article
        const ideviceNode = blockNode.locator('article.idevice_node').first();
        const altId = await ideviceNode.getAttribute('id').catch(() => null);
        if (altId) {
            return { blockId, ideviceId: altId };
        }
        throw new Error('Could not find iDevice ID');
    }

    return { blockId, ideviceId };
}

/**
 * Get block and iDevice IDs from a specific block on the current page
 *
 * @param page - Playwright page
 * @param blockIndex - Index of the block on the page (0-based)
 * @returns Object containing blockId and ideviceId
 */
export async function getBlockAndIdeviceIdsByIndex(
    page: Page,
    blockIndex: number = 0,
): Promise<{ blockId: string; ideviceId: string }> {
    // Find the block by index - blocks are article.box in #node-content
    const blockNodes = page.locator('#node-content article.box');
    const count = await blockNodes.count();

    if (count === 0) {
        throw new Error('No blocks found on the current page');
    }

    const targetIndex = Math.min(blockIndex, count - 1);
    const blockNode = blockNodes.nth(targetIndex);
    await blockNode.waitFor({ state: 'visible', timeout: 15000 });

    // Get block ID from the element's 'id' attribute
    const blockId = await blockNode.getAttribute('id');
    if (!blockId) {
        throw new Error('Block does not have an id attribute');
    }

    // Find the iDevice inside the block
    const ideviceDropdown = blockNode.locator('[id^="dropdownMenuButtonIdevice"]').first();
    await ideviceDropdown.waitFor({ state: 'attached', timeout: 10000 });

    const dropdownId = await ideviceDropdown.getAttribute('id');
    const ideviceId = dropdownId?.replace('dropdownMenuButtonIdevice', '') || '';

    if (!ideviceId) {
        // Try alternative: get ID from idevice_node article
        const ideviceNode = blockNode.locator('article.idevice_node').first();
        const altId = await ideviceNode.getAttribute('id').catch(() => null);
        if (altId) {
            return { blockId, ideviceId: altId };
        }
        throw new Error('Could not find iDevice ID');
    }

    return { blockId, ideviceId };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEXT IDEVICE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add a text iDevice to the current page
 * Expands the "Information and presentation" category and clicks the text iDevice
 *
 * @param page - Playwright page
 */
export async function addTextIdevice(page: Page): Promise<void> {
    // Expand "Information and presentation" category
    const infoCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }),
        })
        .first();

    if ((await infoCategory.count()) > 0) {
        const isCollapsed = await infoCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            await infoCategory.locator('.label').click();
            await page.waitForTimeout(800);
        }
    }

    // Click text iDevice
    const textIdevice = page.locator('.idevice_item[id="text"]').first();
    await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await textIdevice.click();

    // Wait for iDevice to appear
    await page.locator('#node-content article .idevice_node.text').first().waitFor({ timeout: 15000 });
}

/**
 * Edit and save a text iDevice with the given content
 * Handles entering edit mode, typing in TinyMCE, and saving
 *
 * @param page - Playwright page
 * @param content - Text content to enter in the iDevice
 */
export async function editTextIdevice(page: Page, content: string): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.text').last();
    await block.waitFor({ timeout: 10000 });

    // Check if already in edition mode (TinyMCE visible or mode attribute)
    const isEdition = await block.evaluate(el => {
        const hasMode = el.getAttribute('mode') === 'edition';
        const hasTinyMCE = el.querySelector('.tox-tinymce') !== null;
        return hasMode || hasTinyMCE;
    });

    if (!isEdition) {
        // Enter edit mode
        const editBtn = block.locator('.btn-edit-idevice');
        await editBtn.waitFor({ timeout: 10000 });
        await editBtn.click();
        await page.waitForTimeout(500);
    }

    // Wait for TinyMCE editor to load
    await page.waitForSelector('.tox-edit-area__iframe', { timeout: 15000 });

    // Find the TinyMCE iframe and type content
    const frameEl = await block
        .locator('iframe.tox-edit-area__iframe, iframe[title="Rich Text Area"]')
        .first()
        .elementHandle();

    if (frameEl) {
        const frame = await frameEl.contentFrame();
        if (frame) {
            await frame.waitForSelector('body', { timeout: 8000 });
            await frame.evaluate(() => {
                document.body.innerHTML = '';
            });
            await frame.focus('body');
            await frame.type('body', content, { delay: 5 });
        }
    }

    // Wait a bit before saving to ensure content is synced
    await page.waitForTimeout(500);

    // Save the iDevice
    const saveBtn = block.locator('.btn-save-idevice');
    await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await saveBtn.click();

    // Wait for TinyMCE to be removed (indicates edit mode ended)
    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            if (!idevice) return false;
            // TinyMCE editor should be gone after save
            const hasTinyMCE = idevice.querySelector('.tox-tinymce') !== null;
            const isEditionMode = idevice.getAttribute('mode') === 'edition';
            return !hasTinyMCE && !isEditionMode;
        },
        { timeout: 15000 },
    );

    // Wait a bit more for DOM to stabilize
    await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK ICON HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current icon src from block header
 *
 * @param page - Playwright page
 * @param blockIndex - Index of the block on the page (0-based)
 * @returns The src attribute of the icon image, or null if no image
 */
export async function getBlockIconSrc(page: Page, blockIndex: number = 0): Promise<string | null> {
    const block = page.locator('#node-content article.box').nth(blockIndex);
    const iconImg = block.locator('header.box-head button.box-icon img').first();
    if ((await iconImg.count()) === 0) return null;
    return await iconImg.getAttribute('src');
}

/**
 * Check if block has empty icon (SVG placeholder with exe-no-icon class)
 *
 * @param page - Playwright page
 * @param blockIndex - Index of the block on the page (0-based)
 * @returns true if block has empty/placeholder icon
 */
export async function blockHasEmptyIcon(page: Page, blockIndex: number = 0): Promise<boolean> {
    const block = page.locator('#node-content article.box').nth(blockIndex);
    const iconBtn = block.locator('header.box-head button.box-icon').first();
    return await iconBtn.evaluate(el => el.classList.contains('exe-no-icon') || el.querySelector('svg') !== null);
}

/**
 * Change block icon via icon picker modal
 *
 * @param page - Playwright page
 * @param blockIndex - Index of the block on the page (0-based)
 * @param iconIndex - Index of the icon to select (0 = empty, 1+ = theme icons)
 */
export async function changeBlockIcon(page: Page, blockIndex: number, iconIndex: number): Promise<void> {
    // 1. Click icon button
    const block = page.locator('#node-content article.box').nth(blockIndex);
    const iconBtn = block.locator('header.box-head button.box-icon').first();
    await iconBtn.click();

    // 2. Wait for icon picker modal
    await page.waitForSelector('.option-block-icon', { timeout: 10000 });

    // 3. Click desired icon (iconIndex 0 = empty, 1+ = theme icons)
    const iconOption = page.locator('.option-block-icon').nth(iconIndex);
    await iconOption.click();

    // 4. Click Save button (confirm button in modal)
    const saveBtn = page.locator('.modal.show button.btn.button-primary').first();
    await saveBtn.click();

    // 5. Wait for modal to close
    await page.waitForFunction(() => !document.querySelector('.modal.show .option-block-icon'), { timeout: 5000 });
    await page.waitForTimeout(500);
}

/**
 * Get the iconName value from Yjs document for a specific block
 *
 * @param page - Playwright page
 * @param blockIndex - Index of the block on the page (0-based)
 * @returns The iconName value from Yjs, or null if not found
 */
export async function getBlockIconName(page: Page, blockIndex: number = 0): Promise<string | null> {
    return await page.evaluate(targetIndex => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        if (!bridge) return null;

        const docManager = bridge.getDocumentManager();
        if (!docManager) return null;

        const yDoc = docManager.getDoc();
        if (!yDoc) return null;

        // Get current page ID from the selected nav element
        const selectedNav = document.querySelector('.nav-element.selected');
        if (!selectedNav) return null;

        const pageId = selectedNav.getAttribute('nav-id');
        if (!pageId) return null;

        // Helper function to find blocks in a page
        const findBlocksInPage = (pageMap: any): any[] => {
            const blocks: any[] = [];
            const pageBlocks = pageMap?.get('blocks');
            if (pageBlocks) {
                for (let i = 0; i < pageBlocks.length; i++) {
                    blocks.push(pageBlocks.get(i));
                }
            }
            return blocks;
        };

        // Helper to recursively search pages for the matching pageId
        const findPage = (pages: any, targetId: string): any | null => {
            for (let i = 0; i < pages.length; i++) {
                const pageMap = pages.get(i);
                const id = pageMap?.get('id');
                if (id === targetId) {
                    return pageMap;
                }
                // Check nested pages
                const subpages = pageMap?.get('pages');
                if (subpages) {
                    const found = findPage(subpages, targetId);
                    if (found) return found;
                }
            }
            return null;
        };

        const navigation = yDoc.getArray('navigation');
        const targetPage = findPage(navigation, pageId);

        if (!targetPage) return null;

        const blocks = findBlocksInPage(targetPage);
        if (blocks.length <= targetIndex) return null;

        const block = blocks[targetIndex];
        return block?.get('iconName') || null;
    }, blockIndex);
}

/**
 * Get the block ID from the current page at a given index
 *
 * @param page - Playwright page
 * @param blockIndex - Index of the block on the page (0-based)
 * @returns The block ID string
 */
export async function getBlockId(page: Page, blockIndex: number = 0): Promise<string> {
    const blockNode = page.locator('#node-content article.box').nth(blockIndex);
    await blockNode.waitFor({ state: 'visible', timeout: 15000 });
    const blockId = await blockNode.getAttribute('id');
    if (!blockId) {
        throw new Error(`Block at index ${blockIndex} does not have an id attribute`);
    }
    return blockId;
}
