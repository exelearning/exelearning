import { test, expect, skipInStaticMode } from '../../fixtures/collaboration.fixture';
import { waitForYjsComponentText, waitForYjsSync } from '../../helpers/sync-helpers';
import { ideviceLocator, waitForTextIdeviceEditor } from '../../helpers/idevice-collab-helpers';
import { waitForAppReady, addTextIdevice, navigateToPageByTitle } from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * Regression tests for issues #1532 and #2427:
 * "Creating a new iDevice forces other users' active editors to close" and
 * "Collaborative editing: adding an iDevice in the same block closes another
 * user's active edit and causes data loss".
 *
 * User A has an open editor with unsaved content while User B changes the
 * structure of the same page. User A's editor must survive, and what User A
 * saves afterwards must be the content of the editor, not the last saved
 * version.
 */

async function waitForYjsBridge(page: Page): Promise<void> {
    await waitForAppReady(page);
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

async function waitForTextIdeviceCount(page: Page, count: number): Promise<void> {
    await page.waitForFunction(
        expected => document.querySelectorAll('#node-content article .idevice_node.text').length >= expected,
        count,
        { timeout: 20000 },
    );
}

async function getLastTextIdeviceId(page: Page): Promise<string> {
    const ideviceId = await page.locator('#node-content article .idevice_node.text').last().getAttribute('id');

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

/**
 * Add a text iDevice (in its own block), type `text` into it and save it.
 * Returns the iDevice id.
 */
async function seedTextIdevice(page: Page, text: string): Promise<string> {
    await addTextIdevice(page);
    await page.waitForSelector('.tox-menubar', { timeout: 15000 });
    const ideviceId = await getLastTextIdeviceId(page);

    const editorBody = await waitForTextIdeviceEditor(page);
    await editorBody.fill(text);
    await expect(editorBody).toHaveText(text);
    await saveTextIdevice(page, ideviceId);
    await expect.poll(() => getIdeviceMode(page, ideviceId), { timeout: 10000 }).toBe('export');
    await waitForYjsComponentText(page, ideviceId, text);

    return ideviceId;
}

/**
 * Client B joins the project Client A is working on and opens the same page.
 */
async function joinSamePage(
    pageA: Page,
    pageB: Page,
    getShareUrl: (page: Page) => Promise<string>,
    joinSharedProject: (page: Page, shareUrl: string) => Promise<void>,
    expectedTextIdevices: number,
): Promise<void> {
    const shareUrl = await getShareUrl(pageA);
    await joinSharedProject(pageB, shareUrl);
    await waitForYjsSync(pageB);
    await waitForYjsSync(pageA);

    try {
        await navigateToPageByTitle(pageB, 'New page');
    } catch {
        await navigateToPageByTitle(pageB, 'Nueva página');
    }

    await waitForTextIdeviceCount(pageB, expectedTextIdevices);
}

/**
 * Client A opens the editor of `ideviceId` and types unsaved content.
 * Returns the TinyMCE body locator and the unsaved text.
 */
async function typeUnsavedContent(pageA: Page, ideviceId: string, savedText: string) {
    await openTextIdeviceEditor(pageA, ideviceId);
    const editorBody = await waitForTextIdeviceEditor(pageA);

    const unsavedContent = `UNSAVED_EDIT_${Date.now()}`;
    // Wait for the saved content to load before entering an unsaved edit.
    await expect(editorBody).toHaveText(savedText);
    await editorBody.fill(unsavedContent);

    expect(await getIdeviceMode(pageA, ideviceId)).toBe('edition');
    await expect(editorBody).toHaveText(unsavedContent);

    return { editorBody, unsavedContent };
}

/**
 * Bounded negative wait: resolves true if the iDevice leaves edition mode
 * within `timeout` ms. A forced page reload closes the editor well within
 * this window.
 */
async function leavesEditionMode(page: Page, ideviceId: string, timeout = 2000): Promise<boolean> {
    return page
        .waitForFunction(id => document.getElementById(id)?.getAttribute('mode') !== 'edition', ideviceId, { timeout })
        .then(() => true)
        .catch(() => false);
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
        const seedText = `Seed content ${Date.now()}`;
        const originalIdeviceId = await seedTextIdevice(pageA, seedText);

        // ── Step 3: Client A shares the project and Client B joins the same page ──
        await joinSamePage(pageA, pageB, getShareUrl, joinSharedProject, 1);

        // ── Step 4: Client A opens the iDevice editor and types UNSAVED content ──
        const { editorBody, unsavedContent } = await typeUnsavedContent(pageA, originalIdeviceId, seedText);

        // ── Step 5: Client B creates a NEW iDevice on the same page ──
        // This should NOT close Client A's editor.
        await addTextIdevice(pageB);

        // Wait for the remote insertion to be reflected on Client A.
        await waitForTextIdeviceCount(pageA, 2);

        // ── ASSERTIONS: Client A's editor must survive ──

        // A1: The editor DOM must still be in edition mode
        const modeAfter = await getIdeviceMode(pageA, originalIdeviceId);
        expect(modeAfter).toBe('edition');

        // A2: Editing controls must still be present for the original iDevice.
        await expect(pageA.locator(`#${originalIdeviceId} .btn-save-idevice`)).toBeVisible({ timeout: 5000 });

        // A3: The unsaved content must still be present
        await expect(editorBody).toHaveText(unsavedContent);
    });
});

test.describe('Editor data integrity during collaborative structure changes (#2427)', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    test('User A saves the editor content, not the stale version, after User B creates an iDevice', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        const projectUuid = await createProject(pageA, 'Editor Save After Remote Insert');
        await pageA.goto(`/workarea?project=${projectUuid}`);
        await waitForYjsBridge(pageA);

        const seedText = `Seed content ${Date.now()}`;
        const originalIdeviceId = await seedTextIdevice(pageA, seedText);
        await joinSamePage(pageA, pageB, getShareUrl, joinSharedProject, 1);

        const { unsavedContent } = await typeUnsavedContent(pageA, originalIdeviceId, seedText);

        // Client B creates a new iDevice while Client A is still editing.
        await addTextIdevice(pageB);
        await waitForTextIdeviceCount(pageA, 2);
        expect(await getIdeviceMode(pageA, originalIdeviceId)).toBe('edition');

        // Client A saves: the editor content must win over the last saved version.
        await saveTextIdevice(pageA, originalIdeviceId);

        await expect(ideviceLocator(pageA, originalIdeviceId).locator('.idevice_body')).toContainText(unsavedContent, {
            timeout: 15000,
        });
        await waitForYjsComponentText(pageA, originalIdeviceId, unsavedContent);
        await expect(ideviceLocator(pageB, originalIdeviceId).locator('.idevice_body')).toContainText(unsavedContent, {
            timeout: 20000,
        });
    });

    test('User A editor survives User B moving another iDevice into the block being edited', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        const projectUuid = await createProject(pageA, 'Editor Survives Remote Move');
        await pageA.goto(`/workarea?project=${projectUuid}`);
        await waitForYjsBridge(pageA);

        // Two text iDevices, each in its own block.
        const seedText = `Seed content ${Date.now()}`;
        const editedIdeviceId = await seedTextIdevice(pageA, seedText);
        const movedIdeviceId = await seedTextIdevice(pageA, 'Content to be moved');
        expect(movedIdeviceId).not.toBe(editedIdeviceId);

        await joinSamePage(pageA, pageB, getShareUrl, joinSharedProject, 2);

        const { editorBody, unsavedContent } = await typeUnsavedContent(pageA, editedIdeviceId, seedText);

        // Client B moves the second iDevice into the block Client A is editing.
        // This is the Yjs operation the drag-and-drop handler performs
        // (IdeviceNode.moveToBlockViaYjs).
        const targetBlockId = await pageB.evaluate(
            id => document.getElementById(id)?.closest('article')?.getAttribute('sym-id') ?? null,
            editedIdeviceId,
        );
        expect(targetBlockId).toBeTruthy();
        const moved = await pageB.evaluate(
            ({ componentId, blockId }) => {
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                return binding.moveComponentToBlock(componentId, blockId);
            },
            { componentId: movedIdeviceId, blockId: targetBlockId as string },
        );
        expect(moved).toBe(true);

        // Wait until Client A's document holds both components in the target block.
        await pageA.waitForFunction(
            ({ blockId, expected }) => {
                const eXe = (window as any).eXeLearning;
                const pageId = document.querySelector('.nav-element.selected')?.getAttribute('nav-id');
                const components = eXe?.app?.project?._yjsBridge?.structureBinding?.getComponents?.(pageId, blockId);
                return Array.isArray(components) && components.length === expected;
            },
            { blockId: targetBlockId as string, expected: 2 },
            { timeout: 20000 },
        );

        // ── ASSERTIONS: Client A's editor must survive the remote move ──
        expect(await leavesEditionMode(pageA, editedIdeviceId)).toBe(false);
        await expect(pageA.locator(`#${editedIdeviceId} .btn-save-idevice`)).toBeVisible({ timeout: 5000 });
        await expect(editorBody).toHaveText(unsavedContent);

        // Client A saves: content is persisted and the page then reflects the move.
        await saveTextIdevice(pageA, editedIdeviceId);
        await waitForYjsComponentText(pageA, editedIdeviceId, unsavedContent);
        await expect(ideviceLocator(pageA, editedIdeviceId).locator('.idevice_body')).toContainText(unsavedContent, {
            timeout: 15000,
        });
        await expect(pageA.locator(`article[sym-id="${targetBlockId}"] .idevice_node.text`)).toHaveCount(2, {
            timeout: 15000,
        });
        await expect(ideviceLocator(pageB, editedIdeviceId).locator('.idevice_body')).toContainText(unsavedContent, {
            timeout: 20000,
        });
    });
});
