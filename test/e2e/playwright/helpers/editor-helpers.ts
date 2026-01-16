/**
 * Editor Helpers for E2E Tests
 *
 * Helpers for TinyMCE editor and modal operations:
 * - TinyMCE content manipulation
 * - Inserting images/media via editor
 * - Modal handling
 *
 * @example
 * ```typescript
 * import { waitForTinyMCE, setTinyMCEContent, confirmDialog } from '../helpers/editor-helpers';
 *
 * test('my test', async ({ page }) => {
 *     await waitForTinyMCE(page);
 *     await setTinyMCEContent(page, '<p>Hello World</p>');
 *     await confirmDialog(page);
 * });
 * ```
 */

import type { Page, Locator } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════════
// TINYMCE EDITOR HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wait for TinyMCE editor to be ready
 *
 * @param page - Playwright page
 * @param timeout - Timeout in milliseconds
 */
export async function waitForTinyMCE(page: Page, timeout = 15000): Promise<void> {
    // Wait for TinyMCE container to be visible
    await page.waitForSelector('.tox-tinymce, .tox-menubar', { timeout });

    // Wait for TinyMCE to be fully initialized
    await page.waitForFunction(
        () => {
            const tinymce = (window as any).tinymce;
            return tinymce?.activeEditor?.initialized === true;
        },
        { timeout },
    );
}

/**
 * Set content in active TinyMCE editor
 *
 * @param page - Playwright page
 * @param content - HTML content to set
 */
export async function setTinyMCEContent(page: Page, content: string): Promise<void> {
    await waitForTinyMCE(page);
    await page.evaluate(html => {
        const tinymce = (window as any).tinymce;
        if (tinymce?.activeEditor) {
            tinymce.activeEditor.setContent(html);
        }
    }, content);
    await page.waitForTimeout(500);
}

/**
 * Get content from active TinyMCE editor
 *
 * @param page - Playwright page
 * @returns HTML content of the editor
 */
export async function getTinyMCEContent(page: Page): Promise<string> {
    await waitForTinyMCE(page);
    return await page.evaluate(() => {
        const tinymce = (window as any).tinymce;
        return tinymce?.activeEditor?.getContent() || '';
    });
}

/**
 * Insert text at cursor position in TinyMCE
 *
 * @param page - Playwright page
 * @param text - Text to insert
 */
export async function insertTextInTinyMCE(page: Page, text: string): Promise<void> {
    await waitForTinyMCE(page);
    await page.evaluate(txt => {
        const tinymce = (window as any).tinymce;
        if (tinymce?.activeEditor) {
            tinymce.activeEditor.insertContent(txt);
        }
    }, text);
    await page.waitForTimeout(300);
}

/**
 * Focus the TinyMCE editor
 *
 * @param page - Playwright page
 */
export async function focusTinyMCE(page: Page): Promise<void> {
    await waitForTinyMCE(page);
    await page.evaluate(() => {
        const tinymce = (window as any).tinymce;
        if (tinymce?.activeEditor) {
            tinymce.activeEditor.focus();
        }
    });
}

/**
 * Insert image via TinyMCE and file manager
 *
 * @param page - Playwright page
 * @param imagePath - Path to the image file to upload
 */
export async function insertImageViaTinyMCE(page: Page, imagePath: string): Promise<void> {
    await waitForTinyMCE(page);

    // Click image button in TinyMCE toolbar
    const imageBtn = page.locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]').first();
    await imageBtn.click();

    // Wait for TinyMCE dialog
    await page.waitForSelector('.tox-dialog', { timeout: 10000 });

    // Click Browse button to open file manager
    const browseBtn = page.locator('.tox-dialog .tox-browse-url').first();
    await browseBtn.click();

    // Wait for file manager modal
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    // Upload the file
    const fileInput = page.locator(
        '#modalFileManager .media-library-upload-input, #modalFileManager input[type="file"]',
    );
    await fileInput.first().setInputFiles(imagePath);

    // Wait for upload and select the item
    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await mediaItem.waitFor({ state: 'visible', timeout: 10000 });
    await mediaItem.click();
    await page.waitForTimeout(500);

    // Click insert button in file manager
    const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
    await insertBtn.click();
    await page.waitForTimeout(1000);

    // Save TinyMCE dialog (closes and inserts into editor)
    const saveBtn = page.locator('.tox-dialog .tox-button:has-text("Save"), .tox-dialog .tox-button--primary');
    if (
        await saveBtn
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false)
    ) {
        await saveBtn.first().click();
    }

    await page.waitForTimeout(500);
}

/**
 * Insert media (PDF/video/audio) via TinyMCE
 *
 * @param page - Playwright page
 * @param mediaPath - Path to the media file to upload
 */
export async function insertMediaViaTinyMCE(page: Page, mediaPath: string): Promise<void> {
    await waitForTinyMCE(page);

    // Click multimedia button
    const multimediaBtn = page
        .locator('.tox-tbtn[aria-label*="media" i], .tox-tbtn[aria-label*="multimedia" i]')
        .first();
    await multimediaBtn.click();

    // Wait for TinyMCE dialog
    await page.waitForSelector('.tox-dialog', { timeout: 10000 });

    // Click Browse button to open file manager
    const browseBtn = page.locator('.tox-dialog .tox-browse-url').first();
    await browseBtn.click();

    // Wait for file manager modal
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    // Upload the file
    const fileInput = page.locator(
        '#modalFileManager .media-library-upload-input, #modalFileManager input[type="file"]',
    );
    await fileInput.first().setInputFiles(mediaPath);

    // Wait for upload and select the item
    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await mediaItem.waitFor({ state: 'visible', timeout: 10000 });
    await mediaItem.click();
    await page.waitForTimeout(500);

    // Click insert button in file manager
    const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
    await insertBtn.click();
    await page.waitForTimeout(1000);

    // Save TinyMCE dialog
    const saveBtn = page.locator('.tox-dialog .tox-button:has-text("Save"), .tox-dialog .tox-button--primary');
    if (
        await saveBtn
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false)
    ) {
        await saveBtn.first().click();
    }

    await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Close any visible modal
 *
 * @param page - Playwright page
 */
export async function closeModal(page: Page): Promise<void> {
    const modal = page.locator('.modal.show').first();
    if (await modal.isVisible()) {
        const closeBtn = modal.locator('button[data-bs-dismiss="modal"], .btn-close, .close').first();
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
        } else {
            // Try pressing Escape
            await page.keyboard.press('Escape');
        }
        await modal.waitFor({ state: 'hidden', timeout: 5000 });
    }
}

/**
 * Wait for modal to appear and return locator
 *
 * @param page - Playwright page
 * @param modalSelector - Optional CSS selector for specific modal
 * @param timeout - Timeout in milliseconds
 * @returns Locator for the modal
 */
export async function waitForModal(page: Page, modalSelector?: string, timeout = 10000): Promise<Locator> {
    const selector = modalSelector || '.modal.show';
    const modal = page.locator(selector).first();
    await modal.waitFor({ state: 'visible', timeout });
    return modal;
}

/**
 * Confirm a dialog (click primary/confirm button)
 *
 * @param page - Playwright page
 */
export async function confirmDialog(page: Page): Promise<void> {
    const modal = page.locator('.modal.show').first();
    const confirmBtn = modal.locator(
        '.btn-primary, .btn-danger, [data-action="confirm"], button:has-text("OK"), button:has-text("Confirm"), button:has-text("Aceptar")',
    );
    await confirmBtn.first().click();

    // Wait for modal to close
    await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
        // Modal might not close automatically
    });
}

/**
 * Cancel a dialog (click cancel/close button)
 *
 * @param page - Playwright page
 */
export async function cancelDialog(page: Page): Promise<void> {
    const modal = page.locator('.modal.show').first();
    const cancelBtn = modal.locator(
        '.btn-secondary, [data-bs-dismiss="modal"], [data-action="cancel"], button:has-text("Cancel"), button:has-text("Cancelar")',
    );
    await cancelBtn.first().click();

    // Wait for modal to close
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
}

/**
 * Check if any modal is visible
 *
 * @param page - Playwright page
 * @returns true if a modal is visible
 */
export async function isModalVisible(page: Page): Promise<boolean> {
    return await page.locator('.modal.show').isVisible();
}

/**
 * Get modal title text
 *
 * @param page - Playwright page
 * @returns Modal title or empty string
 */
export async function getModalTitle(page: Page): Promise<string> {
    const modal = page.locator('.modal.show').first();
    const title = modal.locator('.modal-title').first();
    return (await title.textContent()) || '';
}

/**
 * Fill a form field in the current modal
 *
 * @param page - Playwright page
 * @param fieldName - Name or ID of the field
 * @param value - Value to fill
 */
export async function fillModalField(page: Page, fieldName: string, value: string): Promise<void> {
    const modal = page.locator('.modal.show').first();
    const field = modal
        .locator(`input[name="${fieldName}"], input#${fieldName}, textarea[name="${fieldName}"]`)
        .first();
    await field.fill(value);
}

/**
 * Click a button in the current modal by text
 *
 * @param page - Playwright page
 * @param buttonText - Text of the button to click
 */
export async function clickModalButton(page: Page, buttonText: string): Promise<void> {
    const modal = page.locator('.modal.show').first();
    const button = modal.locator(`button:has-text("${buttonText}")`).first();
    await button.click();
}
