/**
 * Mind map editor for the exemindmap TinyMCE plugin, built on Mind Elixir.
 *
 * It runs in the plugin's editor iframe. The plugin passes the HTML of the map's
 * `.exe-mindmap-code` paragraph in `top.mindmapEditor.data`. Saving fills the plugin dialog
 * with the escaped Mind Elixir JSON, which keeps the map editable, and two views of the map,
 * of which the author picks one in the dialog: a PNG, and Mermaid `mindmap` source, which
 * eXeLearning renders to SVG like any other Mermaid diagram. Legacy mindmaps documents are
 * converted on open (see storedMindmap.ts); nothing is replaced until the author saves.
 *
 * Built into mindmap-editor.bundle.js by scripts/build-mindmap-editor.ts. The PNG is drawn
 * with modern-screenshot, which Mind Elixir points to in place of its deprecated exportPng.
 */

import MindElixir from 'mind-elixir';
import type { MindElixirData, MindElixirInstance, NodeObj, Topic } from 'mind-elixir';
import 'mind-elixir/style.css';
import { domToCanvas } from 'modern-screenshot';
import { mindElixirToMermaid } from '@erseco/mind-elixir-export-mermaid';
import './editor.css';
import {
    MindmapFormatError,
    convertLegacyMindmapToMindElixir,
    decodeHtmlEntities,
    isLegacyMindmapDocument,
    readStoredCode,
    sanitizeMindElixirData,
    serializeStoredCode,
} from './storedMindmap';

/** What the exemindmap plugin shares with this iframe through `top.mindmapEditor`. */
interface MindmapHost {
    data?: string;
    closeConfirmed?: boolean;
    pluginDialog?: { setData(data: Record<string, unknown>): void };
    tinymce?: { windowManager: { close(): void } };
}

type TopWindow = Window & { _?: (text: string) => string; mindmapEditor?: MindmapHost };

const topWindow = (() => {
    try {
        return window.top as TopWindow;
    } catch {
        return window as TopWindow;
    }
})();

/** eXeLearning's translator, from the workarea */
const _ = (text: string): string => (typeof topWindow._ === 'function' ? topWindow._(text) : text);

const host = (): MindmapHost | undefined => topWindow.mindmapEditor;

const FONT_STEP = 2;
const FONT_MIN = 8;
const FONT_MAX = 72;

let mind: MindElixirInstance;
let previousMeta: Record<string, unknown> | undefined;

function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string> = {},
    text?: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
}

function showMessage(text: string, isError = false): void {
    const box = document.getElementById('message') as HTMLElement;
    box.textContent = text;
    box.className = isError ? 'error' : '';
    box.hidden = !text;
}

// ---------------------------------------------------------------------------
// Map data
// ---------------------------------------------------------------------------

function newMap(): MindElixirData {
    return { nodeData: { id: `root-${Date.now().toString(36)}`, topic: _('Central Idea'), children: [] }, direction: 2 };
}

/** The map to edit: the stored one, converted if it is a legacy document, or a new one. */
function initialMap(): MindElixirData {
    const stored = host()?.data;
    if (!stored || !stored.trim()) return newMap();
    try {
        const { format, data } = readStoredCode(stored);
        previousMeta = data.meta;
        if (format === 'legacy') showMessage(_('This mind map was created with the previous editor. It will be saved in the new format.'));
        return data;
    } catch (error) {
        const reason = error instanceof MindmapFormatError ? error.message : String(error);
        showMessage(`${_('The mind map could not be opened, so a new one was started. The original is kept until you save.')} (${reason})`, true);
        return newMap();
    }
}

/** Reads a JSON file exported by this editor, by Mind Elixir or by the legacy mindmaps editor. */
function readImportedFile(text: string): MindElixirData {
    const parsed: unknown = JSON.parse(text.replace(/^﻿/, ''));
    if (isLegacyMindmapDocument(parsed)) return convertLegacyMindmapToMindElixir(parsed);
    return sanitizeMindElixirData(parsed);
}

// ---------------------------------------------------------------------------
// Styling the selected nodes
// ---------------------------------------------------------------------------

type NodeStyle = NonNullable<NodeObj['style']> & { fontStyle?: string };

function selectedTopics(): Topic[] {
    if (mind.currentNodes?.length) return mind.currentNodes;
    return mind.currentNode ? [mind.currentNode] : [];
}

async function patchStyle(update: (style: NodeStyle, tpc: Topic) => void): Promise<void> {
    for (const tpc of selectedTopics()) {
        const style: NodeStyle = { ...(tpc.nodeObj.style ?? {}) };
        update(style, tpc);
        for (const key of Object.keys(style) as Array<keyof NodeStyle>) {
            if (style[key] === undefined || style[key] === '') delete style[key];
        }
        await mind.reshapeNode(tpc, { style });
    }
    refreshControls();
}

function toggle(key: 'fontWeight' | 'fontStyle' | 'textDecoration', on: string): () => Promise<void> {
    return () =>
        patchStyle((style) => {
            style[key] = style[key] === on ? undefined : on;
        });
}

function changeFontSize(delta: number): () => Promise<void> {
    return () =>
        patchStyle((style, tpc) => {
            const current = Number.parseFloat(style.fontSize ?? getComputedStyle(tpc).fontSize) || 16;
            style.fontSize = `${Math.min(FONT_MAX, Math.max(FONT_MIN, current + delta))}px`;
        });
}

async function setBranchColor(color: string, recursive: boolean): Promise<void> {
    for (const tpc of selectedTopics()) {
        if (recursive) {
            const paint = (node: NodeObj) => {
                node.branchColor = color;
                node.children?.forEach(paint);
            };
            tpc.nodeObj.children?.forEach(paint);
        }
        await mind.reshapeNode(tpc, { branchColor: color });
    }
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

const controls: Record<string, HTMLButtonElement | HTMLInputElement> = {};

function button(id: string, label: string, onClick: () => unknown, title = label): HTMLButtonElement {
    const b = el('button', { type: 'button', id, title }, label);
    b.addEventListener('click', () => {
        Promise.resolve(onClick()).catch((error) => showMessage(String(error), true));
    });
    controls[id] = b;
    return b;
}

function group(label: string, ...items: HTMLElement[]): HTMLElement {
    const g = el('div', { class: 'group', role: 'group', 'aria-label': label });
    g.append(...items);
    return g;
}

function colorInput(id: string, label: string, onChange: (value: string) => unknown): HTMLLabelElement {
    const input = el('input', { type: 'color', id, title: label });
    input.addEventListener('change', () => {
        Promise.resolve(onChange(input.value)).catch((error) => showMessage(String(error), true));
    });
    controls[id] = input;
    const wrapper = el('label', { class: 'color', for: id }, label);
    wrapper.append(input);
    return wrapper;
}

function toHex(color: string): string {
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
    if (!match) return /^#[0-9a-f]{6}$/i.test(color) ? color : '#000000';
    return `#${match
        .slice(1, 4)
        .map((n) => Number(n).toString(16).padStart(2, '0'))
        .join('')}`;
}

/** Enables the controls that need a selection and shows the selected node's style. */
function refreshControls(): void {
    const tpc = selectedTopics()[0];
    const isRoot = tpc ? tpc.nodeObj.id === mind.nodeData.id : false;
    for (const id of ['font-smaller', 'font-larger', 'bold', 'italic', 'underline', 'strike', 'text-color', 'add-child']) {
        controls[id].disabled = !tpc;
    }
    for (const id of ['add-sibling', 'remove', 'branch-color', 'branch-color-children']) controls[id].disabled = !tpc || isRoot;
    if (!tpc) return;
    const style = (tpc.nodeObj.style ?? {}) as NodeStyle;
    controls.bold.setAttribute('aria-pressed', String(style.fontWeight === 'bold'));
    controls.italic.setAttribute('aria-pressed', String(style.fontStyle === 'italic'));
    controls.underline.setAttribute('aria-pressed', String(style.textDecoration === 'underline'));
    controls.strike.setAttribute('aria-pressed', String(style.textDecoration === 'line-through'));
    (controls['text-color'] as HTMLInputElement).value = toHex(style.color ?? getComputedStyle(tpc).color);
    (controls['branch-color'] as HTMLInputElement).value = toHex(tpc.nodeObj.branchColor ?? '#000000');
}

function buildToolbar(): HTMLElement {
    const fileInput = el('input', { type: 'file', accept: '.json,application/json', id: 'import-file', hidden: '' });
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        try {
            const data = readImportedFile(await file.text());
            previousMeta = data.meta;
            mind.refresh(data);
            mind.clearHistory();
            showMessage('');
        } catch (error) {
            showMessage(`${_('Sorry, wrong file format')} (${(error as Error).message})`, true);
        }
    });

    const bar = el('div', { id: 'toolbar', role: 'toolbar', 'aria-label': _('Mind map') });
    bar.append(
        group(
            _('Nodes'),
            button('add-child', _('Add child'), () => mind.addChild()),
            button('add-sibling', _('Add sibling'), () => mind.insertSibling('after')),
            button('remove', _('Delete'), () => mind.removeNodes(selectedTopics())),
        ),
        group(_('History'), button('undo', _('Undo'), () => mind.undo()), button('redo', _('Redo'), () => mind.redo())),
        group(
            _('Text style'),
            button('font-smaller', 'A−', changeFontSize(-FONT_STEP), _('Smaller text')),
            button('font-larger', 'A+', changeFontSize(FONT_STEP), _('Larger text')),
            button('bold', 'B', toggle('fontWeight', 'bold'), _('Bold')),
            button('italic', 'I', toggle('fontStyle', 'italic'), _('Italic')),
            button('underline', 'U', toggle('textDecoration', 'underline'), _('Underline')),
            button('strike', 'S', toggle('textDecoration', 'line-through'), _('Strikethrough')),
            colorInput('text-color', _('Text color'), (color) => patchStyle((style) => (style.color = color))),
        ),
        group(
            _('Line color'),
            colorInput('branch-color', _('Line color'), (color) => setBranchColor(color, false)),
            button(
                'branch-color-children',
                _('Recursive'),
                () => setBranchColor((controls['branch-color'] as HTMLInputElement).value, true),
                _('Apply the line color to the child nodes'),
            ),
        ),
        group(
            _('Tools'),
            button('import', _('Import'), () => fileInput.click()),
            button('export', _('Export'), exportJson),
            button('export-mermaid', _('Export as Mermaid'), exportMermaid),
            button('print', _('Print'), () => window.print()),
            fileInput,
        ),
        el('span', { class: 'spacer' }),
        button('save', _('Save'), save),
    );
    controls.save.classList.add('primary');
    return bar;
}

// ---------------------------------------------------------------------------
// Export, print and save
// ---------------------------------------------------------------------------

function fileName(extension: string): string {
    return `${(mind.nodeData.topic || 'mindmap').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)}.${extension}`;
}

function download(content: string, type: string, name: string): void {
    const link = el('a', { href: URL.createObjectURL(new Blob([content], { type })), download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function exportJson(): void {
    const json = JSON.stringify(JSON.parse(decodeHtmlEntities(serializeStoredCode(mind.getData(), previousMeta))), null, 2);
    download(json, 'application/json', fileName('json'));
}

/** The whole map as a Mermaid file, folded branches included. */
function exportMermaid(): void {
    download(mindElixirToMermaid(mind.getData(), { markdown: true }), 'text/vnd.mermaid', fileName('mmd'));
}

/**
 * The map as the content shows it: Mermaid source with bold, italic and line breaks
 * (markdown strings), leaving out folded branches as the editor does.
 */
export function contentDiagram(data: MindElixirData): string {
    return mindElixirToMermaid(data, { markdown: true, omitCollapsed: true });
}

/** Margin kept around the map when the empty canvas around it is trimmed. */
const IMAGE_MARGIN = 20;

/** Crops the white area around the drawing, like the legacy editor's tight PNG. */
export function trimCanvas(canvas: HTMLCanvasElement, margin = IMAGE_MARGIN): HTMLCanvasElement {
    const { width, height } = canvas;
    const context = canvas.getContext('2d');
    if (!context || !width || !height) return canvas;
    const pixels = context.getImageData(0, 0, width, height).data;
    let top = height;
    let left = width;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (pixels[i] < 250 || pixels[i + 1] < 250 || pixels[i + 2] < 250) {
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
    }
    if (right < 0) return canvas;
    left = Math.max(0, left - margin);
    top = Math.max(0, top - margin);
    const w = Math.min(width, right + margin + 1) - left;
    const h = Math.min(height, bottom + margin + 1) - top;
    const trimmed = document.createElement('canvas');
    trimmed.width = w;
    trimmed.height = h;
    trimmed.getContext('2d')?.drawImage(canvas, left, top, w, h, 0, 0, w, h);
    return trimmed;
}

/** Renders the whole map at 100% to a canvas, whatever the current zoom, with nothing selected. */
async function renderMap(): Promise<HTMLCanvasElement> {
    const scale = mind.scaleVal;
    mind.clearSelection();
    mind.scale(1);
    try {
        return trimCanvas(await domToCanvas(mind.nodes, { backgroundColor: '#ffffff', scale: 1 }));
    } finally {
        mind.scale(scale);
    }
}

/** Hands the map to the plugin dialog and closes the editor. */
async function save(): Promise<void> {
    const current = host();
    const data = mind.getData();
    const canvas = await renderMap();
    current?.pluginDialog?.setData({
        mindmapDiagram: contentDiagram(data),
        mindmapImgToSave: canvas.toDataURL('image/png'),
        mindmapImgSize: `${canvas.width}x${canvas.height}`,
        mindmapCode: serializeStoredCode(data, previousMeta),
    });
    const instructions = window.parent.document.getElementById('mindmapImgInstructions');
    if (instructions) instructions.textContent = _('Saved changes!');
    if (current) current.closeConfirmed = true;
    current?.tinymce?.windowManager.close();
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------

function contextMenuLocale() {
    return {
        addChild: _('Add child'),
        addParent: _('Add parent'),
        addSibling: _('Add sibling'),
        removeNode: _('Delete'),
        focus: _('Focus mode'),
        cancelFocus: _('Cancel focus mode'),
        moveUp: _('Move up'),
        moveDown: _('Move down'),
        link: _('Link'),
        linkBidirectional: _('Bidirectional link'),
        clickTips: _('Please click the target node'),
        summary: _('Summary'),
    };
}

export function start(): MindElixirInstance {
    document.documentElement.lang = topWindow.document?.documentElement?.lang || 'en';
    document.body.replaceChildren(
        buildToolbar(),
        el('div', { id: 'message', role: 'status', hidden: '' }),
        el('div', { id: 'map' }),
    );

    mind = new MindElixir({
        el: '#map',
        direction: MindElixir.SIDE,
        toolBar: true,
        keypress: true,
        allowUndo: true,
        contextMenu: { locale: contextMenuLocale(), focus: true, link: false },
        newTopicName: _('New idea'),
    });
    mind.init(initialMap());
    mind.toCenter();
    // The running instance, for debugging and for the end-to-end tests
    (window as Window & { __mindmapEditor?: MindElixirInstance }).__mindmapEditor = mind;

    mind.bus.addListener('selectNodes', refreshControls);
    mind.bus.addListener('unselectNodes', refreshControls);
    mind.bus.addListener('operation', refreshControls);
    refreshControls();

    window.addEventListener('pagehide', () => mind.destroy());
    return mind;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => start(), { once: true });
} else {
    start();
}
