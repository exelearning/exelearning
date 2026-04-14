/**
 * E2E regression test for issues #1664 and #1668.
 *
 * Bug: inserting a second image into a TinyMCE editor (inside a text iDevice)
 * via the File Manager caused the first image to visually break in the editor.
 * The canonical `data-mce-src="asset://..."` value was being overwritten with
 * a `blob:` URL by TinyMCE's `images_upload_handler` post-success pipeline
 * whenever the upload scanner re-queued the already-resolved first image.
 *
 * Fix: `images_replace_blob_uris: false` in the TinyMCE init config, so
 * TinyMCE keeps `markUploaded` bookkeeping but no longer rewrites the
 * `<img>` src / data-mce-src attributes after our handler returns.
 *
 * This spec reproduces the exact user-reported flow:
 *  1. Add a text iDevice → open TinyMCE
 *  2. Insert a first image from the File Manager → assert it renders
 *  3. Insert a second image from the File Manager → assert BOTH images
 *     still carry a canonical `asset://` data-mce-src and have loaded
 *     bitmap data (naturalWidth > 0).
 *
 * The strict check on `data-mce-src` is the key regression assertion —
 * without the fix, the first image's `data-mce-src` gets rewritten to a
 * `blob:` URL and this test fails.
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

/** Put the most recently added text iDevice into edit mode and wait for TinyMCE. */
async function enterTextIdeviceEditMode(page: Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.text').last();
    await block.waitFor({ timeout: 10000 });

    const isEdition = await block.evaluate(el => {
        const hasMode = el.getAttribute('mode') === 'edition';
        const hasTinyMce = el.querySelector('.tox-tinymce') !== null;
        return hasMode || hasTinyMce;
    });

    if (!isEdition) {
        const editBtn = block.locator('.btn-edit-idevice');
        try {
            await editBtn.waitFor({ state: 'visible', timeout: 5000 });
            await editBtn.click({ timeout: 5000 });
        } catch {
            // Fallback: double-click the body to enter edition.
            const body = block.locator('.idevice_body').first();
            if (await body.isVisible().catch(() => false)) {
                await body.dblclick({ timeout: 5000 }).catch(() => {});
            } else {
                await block.dblclick({ timeout: 5000 }).catch(() => {});
            }
        }
    }

    await page.waitForSelector('.tox-tinymce, .tox-menubar, .tox-toolbar', { timeout: 20000 });
    await dismissBlockingAlertModal(page);
}

/** Open the File Manager via TinyMCE's image dialog → "browse" button. */
async function openFileManagerViaImageButton(page: Page): Promise<void> {
    await dismissBlockingAlertModal(page);

    const imageBtn = page.locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]').first();
    await expect(imageBtn).toBeVisible({ timeout: 10000 });
    try {
        await imageBtn.click({ timeout: 6000 });
    } catch {
        // Fall back to opening via the editor API when the toolbar click is intercepted
        const openedByApi = await page.evaluate(() => {
            const anyWindow = window as unknown as {
                tinymce?: { activeEditor?: { execCommand?: (c: string) => void } };
            };
            const editor = anyWindow.tinymce?.activeEditor;
            if (!editor || typeof editor.execCommand !== 'function') return false;
            editor.execCommand('mceImage');
            return true;
        });
        if (!openedByApi) {
            await imageBtn.click({ timeout: 6000, force: true });
        }
    }

    await page.waitForSelector('.tox-dialog', { timeout: 10000 });
    const browseBtn = page.locator('.tox-dialog .tox-browse-url').first();
    await expect(browseBtn).toBeVisible({ timeout: 5000 });
    await browseBtn.click();
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', {
        timeout: 10000,
    });
}

/**
 * Snapshot of each <img> inside the TinyMCE editor body.
 * We read the raw attribute values (not the resolved DOM `img.src`) so we
 * can assert on what TinyMCE has persisted into the editor model.
 */
type EditorImageState = {
    count: number;
    src: string | null;
    dataMceSrc: string | null;
    dataAssetSrc: string | null;
    naturalWidth: number;
    complete: boolean;
};

async function readEditorImages(page: Page): Promise<EditorImageState[]> {
    const frame = page.frameLocator('iframe.tox-edit-area__iframe').first();
    await frame.locator('body').waitFor({ state: 'attached', timeout: 10000 });
    return frame.locator('body').evaluate(body => {
        const imgs = Array.from(body.querySelectorAll('img')) as HTMLImageElement[];
        return imgs.map(img => ({
            count: imgs.length,
            src: img.getAttribute('src'),
            dataMceSrc: img.getAttribute('data-mce-src'),
            dataAssetSrc: img.getAttribute('data-asset-src'),
            naturalWidth: img.naturalWidth,
            complete: img.complete,
        }));
    });
}

/**
 * Move the TinyMCE caret to the end of the editor body and drop any image
 * selection. This mimics a user clicking somewhere else in the text before
 * inserting the next image — without this step, clicking the image toolbar
 * button with an image still selected would put TinyMCE's dialog into "edit
 * selected image" mode and replace the first image instead of appending a
 * second one.
 */
async function collapseSelectionToEnd(page: Page): Promise<void> {
    await page.evaluate(() => {
        const anyWindow = window as unknown as {
            tinymce?: {
                activeEditor?: {
                    getBody: () => HTMLElement;
                    selection: {
                        select: (el: HTMLElement, content?: boolean) => void;
                        collapse: (toStart: boolean) => void;
                    };
                    focus: () => void;
                    nodeChanged: () => void;
                };
            };
        };
        const editor = anyWindow.tinymce?.activeEditor;
        if (!editor) return;
        editor.focus();
        const body = editor.getBody();
        // Append a trailing text node so the caret lands after the image,
        // not inside a zero-width wrapper that TinyMCE keeps around the img.
        const trailer = body.ownerDocument.createElement('p');
        trailer.innerHTML = '<br data-mce-bogus="1">';
        body.appendChild(trailer);
        editor.selection.select(trailer, true);
        editor.selection.collapse(false);
        editor.nodeChanged();
    });
}

test.describe('Text iDevice — multiple image insertion (issues #1664, #1668)', () => {
    test('inserting a second image keeps the first image canonical and visible', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Multi-image regression #1664');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Step 1 — create a text iDevice and enter TinyMCE edit mode.
        await addTextIdevice(page);
        await enterTextIdeviceEditMode(page);

        // Step 2 — insert the first image via the File Manager.
        await openFileManagerViaImageButton(page);
        await uploadFixtureFile(page, 'test/fixtures/sample-2.jpg');
        await insertFileIntoEditor(page, 'sample-2.jpg');

        // The first image should be resolved and visible on its own.
        await expect
            .poll(async () => (await readEditorImages(page)).length, {
                timeout: 10000,
                message: 'first image did not appear in the editor',
            })
            .toBe(1);

        await expect
            .poll(
                async () => {
                    const [first] = await readEditorImages(page);
                    return first?.naturalWidth ?? 0;
                },
                {
                    timeout: 10000,
                    message: 'first image did not load its bitmap',
                },
            )
            .toBeGreaterThan(0);

        // Sanity: after the first resolution the canonical asset:// reference
        // must be recoverable from either data-mce-src or data-asset-src, and
        // the displayed src must be a blob: URL.
        {
            const [first] = await readEditorImages(page);
            expect(first.src, 'first image src should be the resolved blob: URL').toMatch(/^blob:/);
            const canonical = first.dataMceSrc ?? first.dataAssetSrc;
            expect(canonical, 'first image must keep an asset:// reference in data-mce-src or data-asset-src').toMatch(
                /^asset:\/\//,
            );
        }

        // Step 3 — collapse the caret after the first image (so the next
        // toolbar click inserts a new image instead of editing the selected
        // one), then insert the second image via the File Manager.
        await collapseSelectionToEnd(page);
        await openFileManagerViaImageButton(page);
        await uploadFixtureFile(page, 'test/fixtures/sample-3.jpg');
        await insertFileIntoEditor(page, 'sample-3.jpg');

        // Both images must be present, both loaded, and — critically — the
        // FIRST image's data-mce-src must still be the canonical asset:// URL.
        // Before the fix, TinyMCE's upload pipeline rewrote it to a blob: URL
        // and the first image visually broke.
        await expect
            .poll(async () => (await readEditorImages(page)).length, {
                timeout: 10000,
                message: 'second image did not appear in the editor',
            })
            .toBe(2);

        // Wait until both images have finished loading (bitmap available).
        await expect
            .poll(
                async () => {
                    const imgs = await readEditorImages(page);
                    if (imgs.length !== 2) return -1;
                    return imgs.filter(img => img.complete && img.naturalWidth > 0).length;
                },
                {
                    timeout: 15000,
                    message: 'both images must finish loading their bitmap data',
                },
            )
            .toBe(2);

        // Final strict check — capture the state once so the failure message
        // shows the exact attributes that regressed.
        const imgs = await readEditorImages(page);
        console.log('[#1664 regression test] editor image state:', JSON.stringify(imgs, null, 2));
        expect(imgs, 'editor must contain exactly two <img> elements').toHaveLength(2);

        for (const [index, img] of imgs.entries()) {
            // Core regression: data-mce-src MUST NOT be a blob: URL. If it is
            // set at all it must be the canonical asset:// URL. (TinyMCE may
            // legitimately drop the attribute during reparse — that is fine
            // as long as data-asset-src still holds the canonical reference.)
            expect(
                img.dataMceSrc ?? '',
                `img[${index}] data-mce-src must never be a blob: URL (got "${img.dataMceSrc}")`,
            ).not.toMatch(/^blob:/);
            if (img.dataMceSrc !== null) {
                expect(
                    img.dataMceSrc,
                    `img[${index}] data-mce-src must be the canonical asset:// URL (got "${img.dataMceSrc}")`,
                ).toMatch(/^asset:\/\//);
            }

            // Canonical asset reference must survive via data-mce-src OR data-asset-src.
            const canonical = img.dataMceSrc ?? img.dataAssetSrc;
            expect(canonical, `img[${index}] must keep an asset:// reference somewhere on the element`).toMatch(
                /^asset:\/\//,
            );

            // Displayed src must be a live blob: URL the browser rendered.
            expect(img.src, `img[${index}] src must be a blob: URL resolved from the asset (got "${img.src}")`).toMatch(
                /^blob:/,
            );
            expect(img.naturalWidth, `img[${index}] must have loaded bitmap data (naturalWidth > 0)`).toBeGreaterThan(
                0,
            );
            expect(img.complete, `img[${index}] must have finished loading`).toBe(true);
        }
    });
});
