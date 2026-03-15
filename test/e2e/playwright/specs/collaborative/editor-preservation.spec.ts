import { test, expect, skipInStaticMode } from '../../fixtures/collaboration.fixture';
import { waitForYjsSync } from '../../helpers/sync-helpers';
import { waitForAppReady, addTextIdevice, navigateToPageByTitle } from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * Regression test for issue #1532:
 * "Creating a new iDevice forces other users' active editors to close"
 *
 * Reproduces the data-loss scenario where User A has an open editor with
 * unsaved content, and User B creates a new iDevice on the same page,
 * causing User A's editor to be destroyed by a full page reload.
 */

async function waitForYjsBridge(page: Page): Promise<void> {
    await waitForAppReady(page);
}

/**
 * Type content into TinyMCE editor without saving.
 */
async function typeInTinyMCE(page: Page, content: string, ideviceId?: string): Promise<void> {
    const textIdeviceNode = ideviceId
        ? page.locator(`#${ideviceId}`)
        : page.locator('#node-content article .idevice_node.text').first();

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const tinyMceFrame = textIdeviceNode.locator('iframe.tox-edit-area__iframe').first();
        await tinyMceFrame.waitFor({ timeout: 15000 });

        const frameEl = await tinyMceFrame.elementHandle();
        const frame = await frameEl?.contentFrame();
        if (!frame) {
            if (attempt === 2) {
                throw new Error('TinyMCE frame is not available');
            }
            await page.waitForTimeout(250);
            continue;
        }

        try {
            await frame.focus('body');
            await frame.type('body', content, { delay: 5 });
            await page.waitForTimeout(500);
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('Frame was detached') || attempt === 2) {
                throw error;
            }
            await page.waitForTimeout(250);
        }
    }
}

/**
 * Save text iDevice (exit edition mode).
 */
async function saveTextIdevice(page: Page, ideviceId?: string): Promise<void> {
    const textIdeviceNode = ideviceId
        ? page.locator(`#${ideviceId}`)
        : page.locator('#node-content article .idevice_node.text').first();
    const saveBtn = textIdeviceNode.locator('.btn-save-idevice');
    if ((await saveBtn.count()) > 0) {
        await saveBtn.click();
    }

    await page.waitForFunction(
        targetIdeviceId => {
            const idevice = targetIdeviceId
                ? document.getElementById(targetIdeviceId)
                : document.querySelector('#node-content article .idevice_node.text');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        ideviceId,
        { timeout: 15000 },
    );
}

/**
 * Open the first text iDevice in edition mode and wait for TinyMCE.
 */
async function openTextIdeviceEditor(page: Page, ideviceId?: string): Promise<void> {
    const textIdeviceNode = ideviceId
        ? page.locator(`#${ideviceId}`)
        : page.locator('#node-content article .idevice_node.text').first();
    const editBtn = textIdeviceNode.locator('.btn-edit-idevice');
    await expect(editBtn).toBeVisible({ timeout: 10000 });
    await editBtn.click();
    await textIdeviceNode.locator('iframe.tox-edit-area__iframe').first().waitFor({ timeout: 15000 });
    await page.waitForFunction(
        targetIdeviceId => {
            const idevice = targetIdeviceId
                ? document.getElementById(targetIdeviceId)
                : document.querySelector('#node-content article .idevice_node.text');
            return idevice?.getAttribute('mode') === 'edition';
        },
        ideviceId,
        { timeout: 15000 },
    );
}

/**
 * Read the current text content from TinyMCE's active editor.
 */
async function getTinyMCEContent(page: Page): Promise<string> {
    return page.evaluate(() => {
        const editor = (window as any).tinymce?.activeEditor;
        return editor ? editor.getContent({ format: 'text' }).trim() : '';
    });
}

async function waitForRemoteIdeviceInsertion(page: Page): Promise<void> {
    await page.waitForFunction(
        () => document.querySelectorAll('#node-content article .idevice_node.text').length >= 2,
        undefined,
        { timeout: 20000 },
    );
}

async function getFirstTextIdeviceId(page: Page): Promise<string> {
    const ideviceId = await page.locator('#node-content article .idevice_node.text').first().getAttribute('id');

    if (!ideviceId) {
        throw new Error('Could not resolve text iDevice id');
    }

    return ideviceId;
}

async function getIdeviceMode(page: Page, ideviceId: string): Promise<string | undefined> {
    return page.evaluate(targetIdeviceId => {
        const idevice = document.getElementById(targetIdeviceId);
        return idevice?.getAttribute('mode') ?? undefined;
    }, ideviceId);
}

test.describe('Editor Preservation During Collaborative iDevice Creation (#1532)', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    test('User A editor must remain open when User B creates a new iDevice on the same page', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        // ── Step 1: Client A creates a project ──
        const projectUuid = await createProject(pageA, 'Editor Preservation Test');
        await pageA.goto(`/workarea?project=${projectUuid}`);
        await waitForYjsBridge(pageA);

        // ── Step 2: Client A adds a text iDevice and saves it ──
        await addTextIdevice(pageA);
        await pageA.waitForSelector('.tox-menubar', { timeout: 15000 });
        const originalIdeviceId = await getFirstTextIdeviceId(pageA);

        const seedText = `Seed content ${Date.now()}`;
        await typeInTinyMCE(pageA, seedText, originalIdeviceId);
        await saveTextIdevice(pageA, originalIdeviceId);

        await expect.poll(() => getIdeviceMode(pageA, originalIdeviceId), { timeout: 10000 }).toBe('export');

        // ── Step 3: Client A shares the project and Client B joins ──
        const shareUrl = await getShareUrl(pageA);
        await joinSharedProject(pageB, shareUrl);
        await waitForYjsSync(pageB);
        await waitForYjsSync(pageA);

        // ── Step 4: Navigate Client B to the same page ──
        try {
            await navigateToPageByTitle(pageB, 'New page');
        } catch {
            await navigateToPageByTitle(pageB, 'Nueva página');
        }

        // Client B must see the existing iDevice
        const textIdeviceOnB = pageB.locator('#node-content article .idevice_node.text');
        await expect(textIdeviceOnB).toBeVisible({ timeout: 15000 });

        // ── Step 5: Client A opens the iDevice editor ──
        await openTextIdeviceEditor(pageA, originalIdeviceId);

        // ── Step 6: Client A types UNSAVED content ──
        const unsavedContent = `UNSAVED_EDIT_${Date.now()}`;
        await typeInTinyMCE(pageA, unsavedContent, originalIdeviceId);

        // Verify editor is open and contains the content
        const modeBefore = await getIdeviceMode(pageA, originalIdeviceId);
        expect(modeBefore).toBe('edition');

        const contentBefore = await getTinyMCEContent(pageA);
        expect(contentBefore).toContain(unsavedContent);

        // ── Step 7: Client B creates a NEW iDevice on the same page ──
        // This should NOT close Client A's editor.
        await addTextIdevice(pageB);

        // Wait for the remote insertion to be reflected on Client A.
        await waitForRemoteIdeviceInsertion(pageA);

        // ── ASSERTIONS: Client A's editor must survive ──

        // A1: The editor DOM must still be in edition mode
        const modeAfter = await getIdeviceMode(pageA, originalIdeviceId);
        expect(modeAfter).toBe('edition');

        // A2: Editing controls must still be present for the original iDevice.
        await expect(pageA.locator(`#${originalIdeviceId} .btn-save-idevice`)).toBeVisible({ timeout: 5000 });

        // A3: The unsaved content must still be present
        const contentAfter = await getTinyMCEContent(pageA);
        expect(contentAfter).toContain(unsavedContent);
    });
});
