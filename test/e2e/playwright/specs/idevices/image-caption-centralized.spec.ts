/**
 * E2E for the centralized image caption (PR #1868 — Cristina's 2026-06-16 request).
 *
 * Verifies the reworked TinyMCE "Insert/Edit image" dialog and the caption contract:
 *  - The dialog has only General + Advanced tabs (the legacy "Title and Attribution"
 *    tab is gone — that data is now centralized in the File Manager).
 *  - The General tab exposes the per-instance "Image header and caption" controls
 *    (heading / notes / hide) and the "Accessibility" controls (alt text / title).
 *  - Inserting an asset image wraps it in `figure.exe-figure[data-asset-id]`, and the
 *    caption is auto-derived from the centralized File Manager metadata (image
 *    name/author/license) set before insertion.
 *
 * The caption-building logic itself is covered by unit tests (figure-caption.ts +
 * figureCaption.js + assetCaptionResolver.js + IdeviceRenderer baking); this spec is the
 * end-to-end wiring check.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';
import {
    addTextIdevice,
    dismissBlockingAlertModal,
    gotoWorkarea,
    waitForAppReady,
} from '../../helpers/workarea-helpers';
import { insertFileIntoEditor, uploadFixtureFile } from '../../helpers/file-manager-helpers';

async function enterTextIdeviceEditMode(page: Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.text').last();
    await block.waitFor({ timeout: 10000 });
    const isEdition = await block.evaluate(
        el => el.getAttribute('mode') === 'edition' || el.querySelector('.tox-tinymce') !== null,
    );
    if (!isEdition) {
        const editBtn = block.locator('.btn-edit-idevice');
        try {
            await editBtn.waitFor({ state: 'visible', timeout: 5000 });
            await editBtn.click({ timeout: 5000 });
        } catch {
            await block
                .locator('.idevice_body')
                .first()
                .dblclick({ timeout: 5000 })
                .catch(() => {});
        }
    }
    await page.waitForSelector('.tox-tinymce, .tox-toolbar', { timeout: 20000 });
    await dismissBlockingAlertModal(page);
}

async function openImageDialog(page: Page): Promise<void> {
    await dismissBlockingAlertModal(page);
    const imageBtn = page.locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]').first();
    await expect(imageBtn).toBeVisible({ timeout: 10000 });
    try {
        await imageBtn.click({ timeout: 6000 });
    } catch {
        await page.evaluate(() => {
            const w = window as unknown as { tinymce?: { activeEditor?: { execCommand?: (c: string) => void } } };
            w.tinymce?.activeEditor?.execCommand?.('mceImage');
        });
    }
    await page.waitForSelector('.tox-dialog', { timeout: 10000 });
}

async function openFileManagerViaImageButton(page: Page): Promise<void> {
    await openImageDialog(page);
    const browseBtn = page.locator('.tox-dialog .tox-browse-url').first();
    await expect(browseBtn).toBeVisible({ timeout: 5000 });
    await browseBtn.click();
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });
}

test.describe('Centralized image caption', () => {
    test('image dialog has no attribution tab and exposes caption + accessibility controls', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Image caption — dialog');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        await enterTextIdeviceEditMode(page);
        await openImageDialog(page);

        // Tabs: General + Advanced only (no "Title and Attribution" / "atribución").
        const tabs = page.locator('.tox-dialog .tox-dialog__body-nav-item, .tox-dialog .tox-tab');
        const tabTexts = (await tabs.allTextContents()).map(t => t.trim().toLowerCase());
        expect(tabTexts.some(t => /atribuci|attribution/.test(t))).toBe(false);

        // The new per-instance controls exist (Hide image caption checkbox + alt + title).
        await expect(page.locator('.tox-dialog .tox-checkbox').filter({ hasText: /ocultar|hide/i })).toHaveCount(1);
        const altLabel = page.locator('.tox-dialog label.tox-label', { hasText: /alternativ/i }).first();
        await expect(altLabel).toBeVisible();
        await expect(altLabel.locator('xpath=following::input[contains(@class,"tox-textfield")][1]')).toBeVisible();

        await page
            .locator('.tox-dialog .tox-button:has-text("Cancel"), .tox-dialog .tox-button:has-text("Cancelar")')
            .first()
            .click();
    });

    test('inserting an asset image derives the caption from centralized File Manager metadata', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Image caption — derive');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        await enterTextIdeviceEditMode(page);

        // Open File Manager from the image dialog, upload an image and set its centralized
        // metadata (image name / author / license) BEFORE inserting it.
        await openFileManagerViaImageButton(page);
        await uploadFixtureFile(page, 'test/fixtures/sample-2.jpg');

        const firstFile = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
        await firstFile.click();
        await page.waitForSelector('#modalFileManager .media-library-edit-metadata', {
            state: 'visible',
            timeout: 5000,
        });

        // Set the centralized metadata. Blur flushes each field immediately (field-level
        // merge), so we don't depend on the transient "Saved" status (which re-populates
        // can clear before assertion — that was flaky). The real check is the caption below.
        const setField = async (sel: string, value: string): Promise<void> => {
            await page.locator(sel).fill(value);
            await page.locator(sel).blur();
        };
        await setField('#modalFileManager .media-library-meta-title', 'Mountain Sunset');
        await setField('#modalFileManager .media-library-meta-author', 'Ada Lovelace');
        await page.locator('#modalFileManager .media-library-meta-license').selectOption('Creative Commons BY');
        // Let the blur-immediate autosave + best-effort server sync settle before inserting.
        await page.waitForTimeout(2000);

        // Insert the image into the editor (selects file → insert → save dialog).
        await insertFileIntoEditor(page, 'sample-2.jpg');

        // The editor body now holds a figure carrying the asset id, with a caption derived
        // from the centralized metadata (image name + author + a rel="license" link).
        const frame = page.frameLocator('iframe.tox-edit-area__iframe').first();
        const figure = frame.locator('figure.exe-figure[data-asset-id]').first();
        await expect(figure).toHaveCount(1, { timeout: 10000 });
        const caption = figure.locator('figcaption.figcaption');
        await expect(caption).toContainText('Mountain Sunset');
        await expect(caption).toContainText('Ada Lovelace');
        await expect(caption.locator('a.license[rel*="license"]')).toHaveCount(1);
    });
});
