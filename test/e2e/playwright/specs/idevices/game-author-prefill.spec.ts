import { test, expect } from '../../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, selectFirstPage, addIdevice } from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E for the generic game Authorship prefill (#1868 follow-ups):
 * picking an asset from the File Manager inside a game edition seeds the
 * game's Authorship input from the asset's centralized author metadata —
 * but only when the field is empty (user input is never overwritten).
 *
 * Representative games: guess (prefill on empty) and magnifier (no overwrite).
 */

const AUTHOR = 'Ada Lovelace';
const FIXTURE = 'test/fixtures/sample-2.jpg';

async function openFileManager(page: Page): Promise<void> {
    await page.locator('#dropdownUtilities').click();
    await page.waitForTimeout(200);
    await page.locator('#navbar-button-filemanager').click();
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });
}

async function closeFileManager(page: Page): Promise<void> {
    await page.locator('#modalFileManager .close, #modalFileManager [data-dismiss="modal"]').first().click();
    await page.waitForTimeout(400);
}

/** Upload the fixture and store the author in its centralized metadata. */
async function uploadImageWithAuthor(page: Page): Promise<void> {
    await openFileManager(page);
    await page.locator('#modalFileManager .media-library-upload-input').setInputFiles(FIXTURE);

    const item = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
    await item.waitFor({ state: 'visible', timeout: 15000 });
    await item.click();
    await page.waitForSelector('#modalFileManager .media-library-edit-metadata', { state: 'visible', timeout: 5000 });

    const authorField = page.locator('#modalFileManager .media-library-meta-author');
    await authorField.fill(AUTHOR);
    await authorField.blur();
    // Deterministic wait on app state: the autosave flush writes the patch onto
    // the selected asset (the transient "Saved" label can be wiped early by a
    // same-asset refresh from the Yjs observer, so we don't poll the label).
    await page.waitForFunction(
        (expected: string) => {
            const modal = (window as any).eXeLearning?.app?.modals?.filemanager;
            return modal?.selectedAsset?.author === expected;
        },
        AUTHOR,
        { timeout: 5000 },
    );
    await closeFileManager(page);
}

/**
 * Open the File Manager through a game's picker button and insert the
 * already-uploaded asset into the given picker input.
 */
async function pickAssetFromGame(page: Page, pickerInputId: string): Promise<void> {
    // The "Select a file" button is injected right after the picker input by
    // ideviceNode.legacyExeIdevicesFilePicker() (it carries no id of its own).
    const browseButton = page.locator(`#${pickerInputId} + input.exe-pick-any-file`).first();
    await browseButton.waitFor({ state: 'visible', timeout: 10000 });
    await browseButton.click();

    await page.waitForSelector('#modalFileManager.show, #modalFileManager[data-open="true"]', { timeout: 10000 });

    const mediaItem = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
    await expect(mediaItem).toBeVisible({ timeout: 15000 });
    await mediaItem.click();
    await page.locator('#modalFileManager .media-library-insert-btn').click();

    // The picker writes an asset:// reference to its input.
    await page.waitForFunction(
        (inputId: string) => {
            const input = document.querySelector(`#${inputId}`) as HTMLInputElement | null;
            return !!input && input.value.startsWith('asset://');
        },
        pickerInputId,
        { timeout: 15000 },
    );
}

test.describe('Game Authorship prefill from centralized metadata', () => {
    test('guess: picking an image seeds an empty Authorship field', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Game Author Prefill - Guess');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await uploadImageWithAuthor(page);

        await selectFirstPage(page);
        await addIdevice(page, 'guess');
        await page.locator('#gameQEIdeviceForm').waitFor({ state: 'visible', timeout: 15000 });

        // The question starts in "cover" media mode; switch it to image so the
        // image picker row (and its author/alt block) is shown.
        await page.locator('#adivinaEMediaImage').click();
        await page.locator('#adivinaEURLImage').waitFor({ state: 'visible', timeout: 10000 });

        const authorInput = page.locator('#adivinaEAuthor');
        await expect(authorInput).toHaveValue('');

        await pickAssetFromGame(page, 'adivinaEURLImage');

        await expect(authorInput).toHaveValue(AUTHOR);
    });

    test('magnifier: a value the user typed is never overwritten', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Game Author Prefill - Magnifier');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await uploadImageWithAuthor(page);

        await selectFirstPage(page);
        await addIdevice(page, 'magnifier');
        await page.locator('#magnifierIdeviceForm').waitFor({ state: 'visible', timeout: 15000 });

        // The user types their own attribution BEFORE picking the file.
        const authorInput = page.locator('#mnfAuthor');
        await authorInput.fill('Manual Author');

        await pickAssetFromGame(page, 'mnfFileInput');

        await expect(authorInput).toHaveValue('Manual Author');
    });
});
