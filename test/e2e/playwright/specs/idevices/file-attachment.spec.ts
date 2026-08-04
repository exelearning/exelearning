import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    selectFirstPage,
    addIdevice,
    saveIdevice,
    saveProject,
    getPreviewFrame,
} from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E coverage for the File attachment iDevice authoring flow:
 * add the iDevice, upload/select a file through the Media Library, confirm it
 * appears as an attachment, save, and verify the learner-facing download link
 * renders in the iDevice view and in the preview panel.
 */

const FILE_ATTACHMENT_ID = 'file-attachment';
const PDF_FIXTURE = 'test/fixtures/sample-1.pdf';

/** Resolve the id of the (single) file-attachment iDevice on the page. */
async function getFileAttachmentId(page: Page): Promise<string> {
    const node = page.locator('#node-content article .idevice_node.file-attachment').first();
    await node.waitFor({ state: 'attached', timeout: 15000 });
    const id = await node.getAttribute('id');
    if (!id) throw new Error('file-attachment iDevice has no id');
    return id;
}

/** Upload a file through the Media Library modal and add it as an attachment. */
async function addFileViaMediaLibrary(page: Page, fixturePath: string): Promise<void> {
    await page.locator('#fileAttachmentAddButton').click();

    await page.waitForSelector('#modalFileManager.show, #modalFileManager[data-open="true"]', { timeout: 10000 });

    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await expect(mediaItem).toBeVisible({ timeout: 15000 });

    // The freshly uploaded asset is auto-selected, which enables the insert button.
    // In multi-select mode a manual click would *toggle* (deselect) it, so only
    // click to select when the button is not already enabled.
    const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
    if (await insertBtn.isDisabled()) {
        await mediaItem.click();
    }
    await expect(insertBtn).toBeEnabled({ timeout: 10000 });
    await insertBtn.click();

    // The attachment row appears once onSelect stores the asset reference.
    await page.waitForFunction(
        () => {
            const rows = document.querySelectorAll('#fileAttachmentList .fileAttachment-edit-item');
            return rows.length > 0;
        },
        { timeout: 15000 },
    );
}

test.describe('File attachment iDevice', () => {
    test('renders the authoring form with an empty state', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'File Attachment Form Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addIdevice(page, FILE_ATTACHMENT_ID);

        await expect(page.locator('#fileAttachmentAddButton')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#fileAttachmentShowDescriptions')).toBeChecked();
        await expect(page.locator('#fileAttachmentEmpty')).toBeVisible();
        await expect(page.locator('#fileAttachmentList .fileAttachment-edit-item')).toHaveCount(0);
    });

    test('uploads a file via the Media Library and renders a download link', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'File Attachment Upload Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addIdevice(page, FILE_ATTACHMENT_ID);

        await addFileViaMediaLibrary(page, PDF_FIXTURE);

        // The attachment row shows the uploaded filename and stores an asset:// reference.
        const row = page.locator('#fileAttachmentList .fileAttachment-edit-item').first();
        await expect(row).toBeVisible();
        await expect(row.locator('.fileAttachment-edit-filename')).toContainText('sample-1.pdf');
        const storedUrl = await row.getAttribute('data-url');
        expect(storedUrl).toMatch(/^asset:\/\//);

        // Save and verify the learner-facing download link renders in the view.
        const ideviceId = await getFileAttachmentId(page);
        await saveIdevice(page, ideviceId);

        const link = page.locator(`#${ideviceId} .fileAttachment-link`).first();
        await expect(link).toBeVisible({ timeout: 10000 });
        await expect(link).toHaveAttribute('download', /sample-1\.pdf/);
    });

    test('reflects renaming and deleting a referenced asset in the Media Library', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'File Attachment Sync Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addIdevice(page, FILE_ATTACHMENT_ID);
        await addFileViaMediaLibrary(page, PDF_FIXTURE);

        const row = page.locator('#fileAttachmentList .fileAttachment-edit-item').first();
        const storedUrl = await row.getAttribute('data-url');
        const uuid = (storedUrl || '').replace('asset://', '').split('.')[0];
        expect(uuid).toBeTruthy();

        // Rename through the real AssetManager (the same path the Media Library uses).
        await page.evaluate(async id => {
            const am = window.eXeLearning.app.project._yjsBridge.assetManager;
            await am.renameAsset(id, 'renamed-worksheet.pdf');
        }, uuid);
        await expect(row.locator('.fileAttachment-edit-filename')).toHaveText('renamed-worksheet.pdf', {
            timeout: 10000,
        });

        // Delete the asset: the attachment must flag itself as missing, not stay stale.
        await page.evaluate(async id => {
            const am = window.eXeLearning.app.project._yjsBridge.assetManager;
            await am.deleteAsset(id, { skipServerDelete: true });
        }, uuid);
        await expect(row).toHaveClass(/fileAttachment-edit-item--missing/, { timeout: 10000 });
        await expect(row.locator('.fileAttachment-edit-warning')).toBeVisible();
    });

    test('shows the download link in the preview panel', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // The exported/preview runtime has no editor-only c_() helper. Calling it
        // from the export code threw "c_ is not defined" inside renderView(), which
        // exe_export.js swallowed as "Could not load template" and the iDevice never
        // rendered. Capture the runtime log so the regression cannot return silently.
        const runtimeErrors: string[] = [];
        page.on('console', message => {
            const text = message.text();
            if (/is not defined|Could not load template/.test(text)) runtimeErrors.push(text);
        });
        page.on('pageerror', error => runtimeErrors.push(error.message));

        const projectUuid = await createProject(page, 'File Attachment Preview Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addIdevice(page, FILE_ATTACHMENT_ID);
        await addFileViaMediaLibrary(page, PDF_FIXTURE);

        const ideviceId = await getFileAttachmentId(page);
        await saveIdevice(page, ideviceId);
        await saveProject(page);
        await page.waitForTimeout(500);

        // Open the preview panel (raw sequence mirrors the image-gallery preview spec).
        await page.click('#head-bottom-preview');
        await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });

        const frame = getPreviewFrame(page);
        await frame.locator('article').waitFor({ state: 'attached', timeout: 20000 });

        const previewLink = frame.locator('.fileAttachment-link').first();
        await expect(previewLink).toBeVisible({ timeout: 20000 });
        await expect(previewLink).toHaveAttribute('download', /sample-1\.pdf/);

        // Links stay in the same browsing context unless the author opts in
        // (WCAG 2.2 SC 3.2.5 Change on Request).
        await expect(previewLink).not.toHaveAttribute('target', '_blank');

        expect(runtimeErrors).toEqual([]);
    });
});
