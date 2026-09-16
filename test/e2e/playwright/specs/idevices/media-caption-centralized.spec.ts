/**
 * E2E for the centralized media caption (Workstream B — exemedia rework, PR #1868 family).
 *
 * Mirrors image-caption-centralized.spec.ts for the "Insert/Edit Media" dialog:
 *  - asset:// media: no "Title and Attribution" tab; the General tab exposes the
 *    per-instance "Media header and caption" controls (heading / notes / hide) and the
 *    caption is auto-derived from the centralized File Manager metadata.
 *  - external media (YouTube / plain URLs): the attribution tab and its per-instance
 *    fields are kept exactly as before (fixed decision).
 *  - The caption persists as figure[data-asset-id][data-caption-*], is non-editable
 *    inline, round-trips the hidden state, and live-updates when the File Manager
 *    metadata changes — without re-editing the insertion.
 *
 * Caption building/baking logic is unit-tested (figure-caption.ts + figureCaption.js +
 * assetCaptionResolver.js + exemedia-plugin.test.js); this spec is the wiring check.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';
import {
    addTextIdevice,
    dismissBlockingAlertModal,
    gotoWorkarea,
    saveIdevice,
    waitForAppReady,
} from '../../helpers/workarea-helpers';
import { uploadFixtureFile } from '../../helpers/file-manager-helpers';

const VIDEO_FIXTURE = 'test/fixtures/sample-video-480-900kb.webm';

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

async function openMediaDialog(page: Page): Promise<void> {
    await dismissBlockingAlertModal(page);
    const mediaBtn = page.locator('.tox-tbtn[aria-label*="media" i], .tox-tbtn[aria-label*="multimedia" i]').first();
    await expect(mediaBtn).toBeVisible({ timeout: 10000 });
    try {
        await mediaBtn.click({ timeout: 6000 });
    } catch {
        await page.evaluate(() => {
            const w = window as unknown as { tinymce?: { activeEditor?: { execCommand?: (c: string) => void } } };
            w.tinymce?.activeEditor?.execCommand?.('mceMedia');
        });
    }
    await page.waitForSelector('.tox-dialog', { timeout: 10000 });
}

function dialogTabTexts(page: Page): Promise<string[]> {
    return page
        .locator('.tox-dialog .tox-dialog__body-nav-item, .tox-dialog .tox-tab')
        .allTextContents()
        .then(texts => texts.map(t => t.trim().toLowerCase()));
}

/** Click a dialog tab whose label matches `re`. */
async function openDialogTab(page: Page, re: RegExp): Promise<void> {
    await page
        .locator('.tox-dialog .tox-dialog__body-nav-item, .tox-dialog .tox-tab')
        .filter({ hasText: re })
        .first()
        .click();
}

/** The per-instance "Hide media caption" checkbox — only present for asset:// media. */
function hideCaptionCheckbox(page: Page) {
    return page.locator('.tox-dialog .tox-checkbox').filter({ hasText: /hide media caption|ocultar/i });
}

/**
 * From an open media dialog: browse to the File Manager, upload the video fixture,
 * optionally set centralized metadata, then insert it back into the dialog and wait
 * for the dialog to flip into centralized (asset://) mode.
 */
async function pickAssetVideo(page: Page, metadata?: { title?: string; author?: string; license?: string }) {
    const browseBtn = page.locator('.tox-dialog .tox-browse-url').first();
    await expect(browseBtn).toBeVisible({ timeout: 5000 });
    await browseBtn.click();
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });
    await uploadFixtureFile(page, VIDEO_FIXTURE);

    const firstFile = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
    await firstFile.click();
    await page.waitForSelector('#modalFileManager .media-library-edit-metadata', { state: 'visible', timeout: 5000 });

    if (metadata) {
        // Deterministic: wait for the autosave "Saved" status after each field, so
        // every value is flushed to the Y.Doc before the next edit (and before Insert).
        const status = page.locator('#modalFileManager .media-library-meta-status');
        const setField = async (sel: string, value: string): Promise<void> => {
            await page.locator(sel).fill(value);
            await page.locator(sel).blur();
            await expect(status).toHaveText(/saved|guardad/i, { timeout: 5000 });
        };
        if (metadata.title) await setField('#modalFileManager .media-library-meta-title', metadata.title);
        if (metadata.author) await setField('#modalFileManager .media-library-meta-author', metadata.author);
        if (metadata.license) {
            await page.locator('#modalFileManager .media-library-meta-license').selectOption(metadata.license);
            await expect(status).toHaveText(/saved|guardad/i, { timeout: 5000 });
        }
    }

    await page.locator('#modalFileManager .media-library-insert-btn').click();
    await page.locator('#modalFileManager').waitFor({ state: 'hidden', timeout: 5000 });
    // The dialog rebuilds (redial) into centralized mode: the caption controls appear.
    await expect(hideCaptionCheckbox(page)).toHaveCount(1, { timeout: 10000 });
}

async function saveMediaDialog(page: Page): Promise<void> {
    await page
        .locator('.tox-dialog .tox-button:has-text("Save"), .tox-dialog .tox-button:has-text("Guardar")')
        .first()
        .click();
    await page.waitForSelector('.tox-dialog', { state: 'detached', timeout: 10000 }).catch(() => {});
}

function editorFrame(page: Page) {
    return page.frameLocator('iframe.tox-edit-area__iframe').first();
}

/** Re-open the media dialog for the inserted media figure. */
async function reopenMediaDialog(page: Page): Promise<void> {
    const frame = editorFrame(page);
    await frame.locator('figure.exe-media [data-mce-object], figure.exe-media video').first().click();
    await openMediaDialog(page);
}

const labelledField = (page: Page, re: RegExp) =>
    page
        .locator('.tox-dialog label.tox-label', { hasText: re })
        .first()
        .locator('xpath=following::*[self::input or self::textarea][1]');

test.describe('Centralized media caption', () => {
    test('media dialog: editable attribution for external sources, read-only mirror for asset media', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Media caption — dialog shape');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        await enterTextIdeviceEditMode(page);
        await openMediaDialog(page);

        // Empty/external source: the attribution tab is present and editable.
        let tabTexts = await dialogTabTexts(page);
        expect(tabTexts.some(t => /atribuci|attribution/.test(t))).toBe(true);
        await expect(hideCaptionCheckbox(page)).toHaveCount(0);

        // Picking an asset video keeps the attribution tab but turns it into a READ-ONLY
        // mirror (File-Manager provenance hint + disabled fields prefilled from centralized
        // metadata), and the per-instance caption controls appear on the General tab.
        await pickAssetVideo(page, { title: 'Intro clip', author: 'Ada Lovelace', license: 'Creative Commons BY' });
        tabTexts = await dialogTabTexts(page);
        expect(tabTexts.some(t => /atribuci|attribution/.test(t))).toBe(true);
        await expect(hideCaptionCheckbox(page)).toHaveCount(1);
        await expect(labelledField(page, /header|encabezado/i)).toBeVisible();
        await expect(labelledField(page, /notes|notas|observaciones/i)).toBeVisible();

        await openDialogTab(page, /atribuci|attribution/i);
        await expect(page.locator('.tox-dialog .exe-attr-fm-hint')).toBeVisible();
        // The mirror fields are disabled (owned by the File Manager) and prefilled.
        expect(await page.locator('.tox-dialog input.tox-textfield[disabled]').count()).toBeGreaterThanOrEqual(3);
        await expect(labelledField(page, /^t[íi]tulo$|^title$/i)).toHaveValue('Intro clip');
        await expect(labelledField(page, /source\/author$|fuente\/autor[íi]a?$|autor[íi]a?$/i)).toHaveValue(
            'Ada Lovelace',
        );

        // Return to General, then flip back to an external URL: the editable attribution tab returns.
        await openDialogTab(page, /general/i);
        const sourceInput = page
            .locator('.tox-dialog .tox-textfield[type="url"], .tox-dialog input.tox-textfield')
            .first();
        await sourceInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        await sourceInput.blur();
        await expect(hideCaptionCheckbox(page)).toHaveCount(0, { timeout: 10000 });
        tabTexts = await dialogTabTexts(page);
        expect(tabTexts.some(t => /atribuci|attribution/.test(t))).toBe(true);

        await page
            .locator('.tox-dialog .tox-button:has-text("Cancel"), .tox-dialog .tox-button:has-text("Cancelar")')
            .first()
            .click();
    });

    test('inserting an asset video derives the caption; heading/notes/hide round-trip; caption locked', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Media caption — derive + edit');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        await enterTextIdeviceEditMode(page);
        await openMediaDialog(page);
        await pickAssetVideo(page, {
            title: 'Intro clip',
            author: 'Ada Lovelace',
            license: 'Creative Commons BY',
        });
        await saveMediaDialog(page);

        // The editor holds a media figure carrying the asset id, with the caption derived
        // from the centralized metadata (title + author + a rel="license" link).
        const frame = editorFrame(page);
        const figure = frame.locator('figure.exe-media[data-asset-id]').first();
        await expect(figure).toHaveCount(1, { timeout: 10000 });
        const caption = figure.locator('figcaption.figcaption');
        await expect(caption).toContainText('Intro clip');
        await expect(caption).toContainText('Ada Lovelace');
        await expect(caption.locator('a.license[rel*="license"]')).toHaveCount(1);
        // The auto-derived caption is locked (non-editable inline).
        await expect(caption).toHaveAttribute('contenteditable', 'false');

        // Edit per-instance heading + notes: the figure re-renders with both.
        await reopenMediaDialog(page);
        await labelledField(page, /header|encabezado/i).fill('Clip 1');
        await labelledField(page, /notes|notas|observaciones/i).fill('Trimmed for length');
        await saveMediaDialog(page);

        await expect(figure.locator('.figcaption.header')).toContainText('Clip 1');
        await expect(figure.locator('figcaption.figcaption')).toContainText('Trimmed for length');
        expect(await figure.getAttribute('data-caption-heading')).toBe('Clip 1');
        await expect(figure.locator('.figcaption.header')).toHaveAttribute('contenteditable', 'false');

        // Hide the caption: figcaption gone, figure + hidden state persist (round-trip).
        await reopenMediaDialog(page);
        await hideCaptionCheckbox(page).click();
        await saveMediaDialog(page);

        await expect(figure).toHaveCount(1);
        await expect(figure.locator('figcaption.figcaption')).toHaveCount(0);
        expect(await figure.getAttribute('data-caption-hidden')).toBe('true');

        // Re-opening shows the checkbox checked.
        await reopenMediaDialog(page);
        await expect(hideCaptionCheckbox(page).locator('input')).toBeChecked();
        await page
            .locator('.tox-dialog .tox-button:has-text("Cancel"), .tox-dialog .tox-button:has-text("Cancelar")')
            .first()
            .click();
    });

    test('a File Manager metadata edit propagates to the rendered media caption without re-editing', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Media caption — live propagation');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        await enterTextIdeviceEditMode(page);
        await openMediaDialog(page);
        await pickAssetVideo(page, { title: 'Before rename', author: 'Ada Lovelace' });
        await saveMediaDialog(page);

        const frame = editorFrame(page);
        await expect(frame.locator('figure.exe-media[data-asset-id]').first()).toHaveCount(1, { timeout: 10000 });

        // Save the iDevice so the figure lives in the rendered content view.
        const ideviceId = await page.locator('#node-content article .idevice_node.text').last().getAttribute('id');
        await saveIdevice(page, ideviceId as string);

        const renderedCaption = page.locator('#node-content figure[data-asset-id] figcaption.figcaption').first();
        await expect(renderedCaption).toContainText('Before rename', { timeout: 10000 });

        // Edit the centralized title in the File Manager (Utilities menu) — no re-edit
        // of the insertion. The live observer re-derives the rendered caption.
        await page.locator('#dropdownUtilities').click();
        await page.waitForTimeout(200);
        await page.locator('#navbar-button-filemanager').click();
        await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });
        const fileItem = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
        await fileItem.click();
        await page.waitForSelector('#modalFileManager .media-library-edit-metadata', {
            state: 'visible',
            timeout: 5000,
        });
        await page.locator('#modalFileManager .media-library-meta-title').fill('After rename');
        await page.locator('#modalFileManager .media-library-meta-title').blur();
        await page.waitForTimeout(1000);
        const closeBtn = page.locator('#modalFileManager .close, #modalFileManager [data-dismiss="modal"]').first();
        await closeBtn.click();

        await expect(renderedCaption).toContainText('After rename', { timeout: 10000 });
        await expect(renderedCaption).not.toContainText('Before rename');
    });
});
