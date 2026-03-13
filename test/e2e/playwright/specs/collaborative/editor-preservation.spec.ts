import { test, expect, skipInStaticMode } from '../../fixtures/collaboration.fixture';
import { waitForYjsSync } from '../../helpers/sync-helpers';
import {
    waitForLoadingScreen,
    waitForAppReady,
    addTextIdevice,
    navigateToPageByTitle,
} from '../../helpers/workarea-helpers';
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
async function typeInTinyMCE(page: Page, content: string): Promise<void> {
    const textIdeviceNode = page.locator('#node-content article .idevice_node.text').first();
    const tinyMceFrame = textIdeviceNode.locator('iframe.tox-edit-area__iframe').first();
    await tinyMceFrame.waitFor({ timeout: 15000 });

    const frameEl = await tinyMceFrame.elementHandle();
    const frame = await frameEl?.contentFrame();
    if (frame) {
        await frame.focus('body');
        await frame.type('body', content, { delay: 5 });
    }

    // Wait for TinyMCE to process the input
    await page.waitForTimeout(500);
}

/**
 * Save text iDevice (exit edition mode).
 */
async function saveTextIdevice(page: Page): Promise<void> {
    const textIdeviceNode = page.locator('#node-content article .idevice_node.text').first();
    const saveBtn = textIdeviceNode.locator('.btn-save-idevice');
    if ((await saveBtn.count()) > 0) {
        await saveBtn.click();
    }

    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 15000 },
    );
}

/**
 * Open the first text iDevice in edition mode and wait for TinyMCE.
 */
async function openTextIdeviceEditor(page: Page): Promise<void> {
    const textIdeviceNode = page.locator('#node-content article .idevice_node.text').first();
    const editBtn = textIdeviceNode.locator('.btn-edit-idevice');
    await expect(editBtn).toBeVisible({ timeout: 10000 });
    await editBtn.click();
    await textIdeviceNode.locator('iframe.tox-edit-area__iframe').first().waitFor({ timeout: 15000 });
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
        await waitForLoadingScreen(pageA);

        // ── Step 2: Client A adds a text iDevice and saves it ──
        await addTextIdevice(pageA);
        await pageA.waitForSelector('.tox-menubar', { timeout: 15000 });

        const seedText = `Seed content ${Date.now()}`;
        await typeInTinyMCE(pageA, seedText);
        await saveTextIdevice(pageA);

        // Verify saved content is visible in export view
        await expect(pageA.locator('#node-content')).toContainText(seedText, { timeout: 10000 });

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
        await openTextIdeviceEditor(pageA);

        // ── Step 6: Client A types UNSAVED content ──
        const unsavedContent = `UNSAVED_EDIT_${Date.now()}`;
        await typeInTinyMCE(pageA, unsavedContent);

        // Verify editor is open and contains the content
        const modeBefore = await pageA.evaluate(() => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            return idevice?.getAttribute('mode');
        });
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
        const modeAfter = await pageA.evaluate(() => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            return idevice?.getAttribute('mode');
        });
        expect(modeAfter).toBe('edition');

        // A2: The TinyMCE iframe must still be visible
        const tinyMceIframe = pageA
            .locator('#node-content article .idevice_node.text iframe.tox-edit-area__iframe')
            .first();
        await expect(tinyMceIframe).toBeVisible({ timeout: 5000 });

        // A3: The unsaved content must still be present
        const contentAfter = await getTinyMCEContent(pageA);
        expect(contentAfter).toContain(unsavedContent);

        // A4: The editor must remain interactable after the remote insertion.
        const appendedContent = ' ++';
        await typeInTinyMCE(pageA, appendedContent);
        const contentAfterMoreTyping = await getTinyMCEContent(pageA);
        expect(contentAfterMoreTyping).toContain(unsavedContent);
        expect(contentAfterMoreTyping.length).toBeGreaterThan(contentAfter.length);
    });
});
