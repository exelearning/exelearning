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

    test('shows the download link in the preview panel', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

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
    });
});
