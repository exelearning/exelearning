import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { getYjsComponentPlainText, waitForYjsComponentText } from './sync-helpers';

export const ORIGINAL_IDEVICE_CONTENT = 'Original content';
export const UPDATED_IDEVICE_CONTENT = 'Updated by client A';
export const DISCARDED_IDEVICE_CONTENT = 'Discarded draft from client A';
export const IDEVICE_COLLAB_SESSION_MARKER = '__e2eIdeviceCollabSession';

export async function getTextIdeviceId(page: Page): Promise<string> {
    const node = page.locator('#node-content article .idevice_node.text').first();
    await node.waitFor({ state: 'attached', timeout: 15000 });
    const id = await node.getAttribute('id');
    if (!id) {
        throw new Error('text iDevice id not found');
    }
    return id;
}

export function ideviceLocator(page: Page, ideviceId: string) {
    return page.locator(`.idevice_node[id="${ideviceId}"]`);
}

export async function getVisibleIdeviceText(page: Page, ideviceId: string): Promise<string> {
    return ideviceLocator(page, ideviceId).evaluate(el => {
        const body = el.querySelector('.idevice_body') || el;
        return (body.textContent || '').replace(/\s+/g, ' ').trim();
    });
}

/** Wait for the content editor, independently of the feedback editor's initialization. */
export async function waitForTextIdeviceEditor(page: Page) {
    await page.waitForFunction(() => (window as any).tinymce?.get('textTextarea')?.initialized === true, undefined, {
        timeout: 15000,
    });
    return page.frameLocator('#textTextarea_ifr').locator('body[contenteditable="true"]');
}

export async function getTinyMCEPlainText(page: Page): Promise<string> {
    const editor = await waitForTextIdeviceEditor(page);
    return (await editor.innerText()).trim();
}

export async function fillTextIdeviceEditor(page: Page, text: string): Promise<void> {
    const editor = await waitForTextIdeviceEditor(page);
    await editor.fill(text);
    await expect(editor).toHaveText(text);
}

export async function confirmDiscardModal(page: Page): Promise<void> {
    const confirmBtn = page.locator('#modalConfirm .confirm, [data-testid="confirm-action"]').first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmBtn.click();
}

export async function markIdeviceCollabSession(page: Page): Promise<void> {
    await page.evaluate(key => {
        (window as any)[key] = true;
    }, IDEVICE_COLLAB_SESSION_MARKER);
}

export async function isIdeviceCollabSessionAlive(page: Page): Promise<boolean> {
    return page.evaluate(key => (window as any)[key] === true, IDEVICE_COLLAB_SESSION_MARKER);
}

/**
 * Fail if a leaky TinyMCE binding writes unsaved text to Yjs or the remote view.
 * The wait is bounded: character-level sync would surface well before this timeout.
 */
export async function expectUnsavedTextDoesNotLeak(
    sourcePage: Page,
    remotePage: Page,
    ideviceId: string,
    unsavedText: string,
    savedText: string,
    timeout = 400,
): Promise<void> {
    const leakedInYjs = await waitForYjsComponentText(sourcePage, ideviceId, unsavedText, timeout)
        .then(() => true)
        .catch(() => false);
    expect(leakedInYjs, 'unsaved TinyMCE changes must not be written to Yjs').toBe(false);

    const leakedOnRemote = await remotePage
        .waitForFunction(
            ({ id, text }) => {
                const el = document.querySelector(`.idevice_node[id="${id}"]`);
                return el?.textContent?.includes(text) === true;
            },
            { id: ideviceId, text: unsavedText },
            { timeout },
        )
        .then(() => true)
        .catch(() => false);
    expect(leakedOnRemote, 'unsaved TinyMCE changes must not appear on the remote client').toBe(false);

    const yjsSource = await getYjsComponentPlainText(sourcePage, ideviceId);
    const yjsRemote = await getYjsComponentPlainText(remotePage, ideviceId);
    const remoteView = await getVisibleIdeviceText(remotePage, ideviceId);
    expect(yjsSource).toContain(savedText);
    expect(yjsRemote).toContain(savedText);
    expect(remoteView).toContain(savedText);
}
