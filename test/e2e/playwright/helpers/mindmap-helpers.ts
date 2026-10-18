import { expect, type Frame, type FrameLocator, type Locator, type Page } from '@playwright/test';
import {
    readStoredCode,
    countNodes,
} from '../../../../public/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/src/storedMindmap';
import type { MindElixirData, NodeObj } from 'mind-elixir';

/**
 * Drives the exemindmap TinyMCE plugin and its Mind Elixir editor the way a user does:
 * a text iDevice, TinyMCE, the plugin dialog, then the editor iframe.
 *
 * Selectors are the ids the editor assigns (#toolbar, #add-child, #save, …) and Mind
 * Elixir's own elements (me-tpc, me-epd), whose `data-nodeid` is "me" plus the node id.
 */

export const MINDMAP_BUTTON = '.tox-tbtn[aria-label*="Mind map"], .tox-tbtn[aria-label*="Mapa mental"]';

/** Puts the nth text iDevice of the page in edition and shows every toolbar row. */
export async function editTextIdevice(page: Page, index = -1): Promise<Locator> {
    const blocks = page.locator('#node-content article .idevice_node.text');
    const block = index < 0 ? blocks.last() : blocks.nth(index);
    await block.waitFor({ timeout: 15000 });
    const opened = await page
        .locator('.tox-menubar')
        .first()
        .waitFor({ timeout: 3000 })
        .then(() => true)
        .catch(() => false);
    if (!opened) {
        await block.locator('.btn-edit-idevice').click();
        await page.locator('.tox-menubar').first().waitFor({ timeout: 15000 });
    }
    await showMindmapButton(page);
    return block;
}

/**
 * The mind map button is on a toolbar row TinyMCE starts with collapsed, and TinyMCE can
 * collapse it again while it finishes starting, so showing it and clicking it are retried
 * together.
 */
async function showMindmapButton(page: Page, click = false): Promise<void> {
    const button = page.locator(MINDMAP_BUTTON).first();
    await expect(async () => {
        if (!(await button.isVisible())) {
            await page.locator('.tox-tbtn[aria-label*="Toggle"], .tox-tbtn[aria-label*="Alternar"]').first().click();
        }
        await expect(button).toBeVisible({ timeout: 1000 });
        if (click) await button.click({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
}

/** The TinyMCE document of the Text iDevice's main field (it also has a feedback editor). */
export function tinymceFrame(page: Page): FrameLocator {
    return page.frameLocator('iframe#textTextarea_ifr');
}

/** Replaces the HTML of the Text iDevice's main field. */
export async function setTextContent(page: Page, html: string): Promise<void> {
    await page.evaluate(content => (window as any).tinymce.get('textTextarea').setContent(content), html);
}

/**
 * Opens the plugin dialog and the editor. With `mapIndex`, the existing map at that
 * position in the TinyMCE content is clicked first, as a user does to edit it.
 */
export async function openMindmapEditor(
    page: Page,
    mapIndex?: number,
): Promise<{ frame: FrameLocator; frame2: Frame }> {
    if (mapIndex !== undefined) {
        await tinymceFrame(page).locator('.exe-mind-map').nth(mapIndex).click();
    }
    await showMindmapButton(page, true);
    const dialog = page.locator('.tox-dialog');
    await expect(dialog).toBeVisible();
    await dialog
        .locator('button.tox-button')
        .filter({ hasText: /Open.*mind.*map|Abrir.*mapa.*mental/i })
        .click();
    const frame = page.frameLocator('iframe[src*="exemindmap"]');
    await expect(frame.locator('#toolbar')).toBeVisible({ timeout: 15000 });
    await expect(frame.locator('me-root me-tpc')).toBeVisible({ timeout: 15000 });
    const frame2 = page.frames().find(f => f.url().includes('exemindmap'));
    if (!frame2) throw new Error('mind map editor frame not found');
    return { frame, frame2 };
}

/** A node of the map by its exact caption. */
export function topic(frame: FrameLocator, caption: string): Locator {
    return frame.locator('me-tpc').filter({ hasText: new RegExp(`^${escapeRegExp(caption)}$`) });
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Map data the editor holds right now. */
export async function editorData(frame2: Frame): Promise<MindElixirData> {
    return frame2.evaluate(() =>
        (window as unknown as { __mindmapEditor: { getData(): MindElixirData } }).__mindmapEditor.getData(),
    );
}

/**
 * Replaces the caption of a node: a click selects it and a double click opens the caption
 * editor, as a user does (Mind Elixir only edits a node that is already selected).
 */
export async function renameTopic(page: Page, frame: FrameLocator, from: string, to: string): Promise<void> {
    await topic(frame, from).click();
    await expect(topic(frame, from)).toHaveClass(/selected/);
    await topic(frame, from).dblclick();
    const input = frame.locator('#input-box');
    await expect(input).toBeVisible();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(to);
    await page.keyboard.press('Enter');
    await expect(topic(frame, to)).toBeVisible();
}

/** Closes the editor without saving, then cancels the plugin dialog. */
export async function cancelMindmap(page: Page): Promise<void> {
    await page.locator('#closebutton').click();
    await expect(page.locator('iframe[src*="exemindmap"]')).toHaveCount(0);
    await page
        .locator('.tox-dialog__footer button')
        .filter({ hasText: /^(Cancel|Cancelar)$/ })
        .click();
    await expect(page.locator('.tox-dialog')).toHaveCount(0);
}

/** Saves from the editor, gives the map a title and closes the plugin dialog. */
export async function saveMindmap(page: Page, frame: FrameLocator, title: string): Promise<void> {
    await frame.locator('#save').click();
    await expect(page.locator('iframe[src*="exemindmap"]')).toHaveCount(0, { timeout: 15000 });
    const dialog = page.locator('.tox-dialog');
    const titleInput = dialog
        .locator('.tox-form__group', { hasText: /Descriptive title|Título descriptivo/i })
        .locator('input');
    await titleInput.fill(title);
    await dialog
        .locator('.tox-dialog__footer button')
        .filter({ hasText: /^(Save|Guardar)$/ })
        .click();
    await expect(dialog).toHaveCount(0, { timeout: 10000 });
}

/** Leaves iDevice edition through its Save button. */
export async function saveIdevice(page: Page, block: Locator): Promise<void> {
    await block.locator('.btn-save-idevice').click();
    await expect(block).not.toHaveAttribute('mode', 'edition', { timeout: 20000 });
}

/**
 * The stored map of each `.exe-mind-map` in the page's iDevice views, as the editor reads it,
 * with its image's URL and, when the image is an SVG (maps saved by Mind Elixir), its source.
 */
export async function storedMaps(
    page: Page,
): Promise<Array<{ format: string; data: MindElixirData; img: string; svg: string }>> {
    const raw = await page.evaluate(() =>
        Promise.all(
            Array.from(document.querySelectorAll('#node-content .exe-mind-map')).map(async map => {
                const img = map.querySelector('img')?.getAttribute('src') ?? '';
                const response = img ? await fetch(img).catch(() => null) : null;
                const svg = response?.headers.get('content-type')?.includes('svg') ? await response.text() : '';
                return { code: map.querySelector('.exe-mindmap-code')?.innerHTML ?? '', img, svg };
            }),
        ),
    );
    return raw.map(({ code, img, svg }) => {
        const { format, data } = readStoredCode(code);
        return { format, data, img, svg };
    });
}

export function captions(node: NodeObj): string[] {
    return [node.topic, ...(node.children ?? []).flatMap(captions)];
}

export function findNode(node: NodeObj, caption: string): NodeObj | undefined {
    if (node.topic === caption) return node;
    for (const child of node.children ?? []) {
        const found = findNode(child, caption);
        if (found) return found;
    }
    return undefined;
}

export { countNodes };
