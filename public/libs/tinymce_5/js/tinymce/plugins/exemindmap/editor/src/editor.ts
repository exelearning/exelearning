/**
 * Mind map editor for the exemindmap TinyMCE plugin, built on Mind Elixir.
 *
 * It runs in the iframe of the plugin's TinyMCE URL dialog and talks to the plugin with the
 * dialog's messages (`mceAction`, same origin):
 *
 * - `exeMindmapReady` (editor): it has started;
 * - `exeMindmapLoad` (plugin): the HTML of the map's `.exe-mindmap-code` paragraph (empty for a
 *   new map), its descriptive title and whether the title is shown as a caption;
 * - `exeMindmapSave` (plugin, the dialog's Save button): the editor answers `exeMindmapSaved`
 *   with the escaped Mind Elixir JSON, which keeps the map editable, an SVG of the map made by
 *   @erseco/mind-elixir-export-svg, the title and the caption setting, or `exeMindmapFailed`
 *   after showing why;
 * - `exeMindmapError` (plugin): the map could not be inserted.
 *
 * Legacy mindmaps documents are converted on open (see storedMindmap.ts); the document only
 * changes when the author saves.
 *
 * Built into mindmap-editor.bundle.js by scripts/build-mindmap-editor.ts.
 */

import MindElixir from 'mind-elixir';
import type { MindElixirData, MindElixirInstance, NodeObj, Theme, Topic } from 'mind-elixir';
import 'mind-elixir/style.css';
import {
    DEFAULT_FONT_FAMILY,
    createSvgExportPlugin,
    toDataUrl,
    type WithVectorSvgExport,
} from '@erseco/mind-elixir-export-svg';
// Material Symbols, the icon set of eXeLearning, inlined at build time
import addChildIcon from '@material-symbols/svg-400/outlined/subdirectory_arrow_right.svg';
import addSiblingIcon from '@material-symbols/svg-400/outlined/add_row_below.svg';
import deleteIcon from '@material-symbols/svg-400/outlined/delete.svg';
import undoIcon from '@material-symbols/svg-400/outlined/undo.svg';
import redoIcon from '@material-symbols/svg-400/outlined/redo.svg';
import importIcon from '@material-symbols/svg-400/outlined/upload.svg';
import exportIcon from '@material-symbols/svg-400/outlined/download.svg';
import printIcon from '@material-symbols/svg-400/outlined/print.svg';
import smallerIcon from '@material-symbols/svg-400/outlined/text_decrease.svg';
import largerIcon from '@material-symbols/svg-400/outlined/text_increase.svg';
import boldIcon from '@material-symbols/svg-400/outlined/format_bold.svg';
import italicIcon from '@material-symbols/svg-400/outlined/format_italic.svg';
import underlineIcon from '@material-symbols/svg-400/outlined/format_underlined.svg';
import strikeIcon from '@material-symbols/svg-400/outlined/format_strikethrough.svg';
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

type ParentWindow = Window & { _?: (text: string) => string };

/** The workarea, which holds the plugin's dialog (always this page's origin). */
const workarea = window.parent as ParentWindow;

/** eXeLearning's translator, from the workarea */
const _ = (text: string): string => (typeof workarea._ === 'function' ? workarea._(text) : text);

const FONT_STEP = 2;
const FONT_MIN = 8;
const FONT_MAX = 72;
/** Opening a large map zooms out to show it whole, but not below this */
const MIN_FIT_SCALE = 0.75;

/**
 * The look of the previous mindmaps editor, in Mind Elixir theme variables: a white central
 * idea with an orange border, distinct branch colours and dark text on a white canvas. The SVG
 * exporter reads the same variables, so the saved image looks like the editor.
 */
const THEME: Theme = {
    name: 'eXeLearning',
    type: 'light',
    palette: ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00897b', '#d81b60', '#3949ab', '#7cb342', '#6d4c41'],
    cssVar: {
        '--bgcolor': '#ffffff',
        '--color': '#1f2328',
        '--main-color': '#1f2328',
        '--main-radius': '8px',
        '--root-color': '#1f2328',
        '--root-bgcolor': '#ffffff',
        '--root-border-color': '#ffa500',
        '--root-radius': '12px',
    },
};

let mind: WithVectorSvgExport<MindElixirInstance>;
let previousMeta: Record<string, unknown> | undefined;
let titleInput: HTMLInputElement;
let captionInput: HTMLInputElement;
/** Whether the title still follows the central idea (new maps, until the author types one) */
let titleFollowsRoot = false;

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

/** Sends a dialog message to the plugin. */
function post(message: Record<string, unknown>): void {
    workarea.postMessage(message, location.origin);
}

// ---------------------------------------------------------------------------
// Map data
// ---------------------------------------------------------------------------

function newMap(): MindElixirData {
    return { nodeData: { id: `root-${Date.now().toString(36)}`, topic: _('Central Idea'), children: [] }, direction: 2 };
}

/** The map to edit: the stored one, converted if it is a legacy document, or a new one. */
function initialMap(stored: string): MindElixirData {
    if (!stored.trim()) return newMap();
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
// Toolbar and inspector
// ---------------------------------------------------------------------------

const controls: Record<string, HTMLButtonElement | HTMLInputElement> = {};

interface ButtonOptions {
    icon?: string;
    /** Show only the icon; the label stays the button's name and tooltip */
    iconOnly?: boolean;
    shortcut?: string;
    title?: string;
}

function button(id: string, label: string, onClick: () => unknown, options: ButtonOptions = {}): HTMLButtonElement {
    const title = options.title ?? label;
    const b = el('button', { type: 'button', id, title: options.shortcut ? `${title} (${options.shortcut})` : title });
    if (options.icon) b.innerHTML = options.icon.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
    if (options.iconOnly) b.setAttribute('aria-label', label);
    else b.append(el('span', {}, label));
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

/** A labelled row of the inspector. */
function field(label: string, ...items: HTMLElement[]): HTMLElement {
    const f = el('div', { class: 'field', role: 'group', 'aria-label': label });
    f.append(el('span', { class: 'field-label' }, label), ...items);
    return f;
}

function colorInput(id: string, label: string, onChange: (value: string) => unknown): HTMLInputElement {
    const input = el('input', { type: 'color', id, title: label, 'aria-label': label });
    input.addEventListener('change', () => {
        Promise.resolve(onChange(input.value)).catch((error) => showMessage(String(error), true));
    });
    controls[id] = input;
    return input;
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
    (document.getElementById('format-hint') as HTMLElement).hidden = !!tpc;
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
            button('add-child', _('Add child'), () => mind.addChild(), { icon: addChildIcon, shortcut: 'Tab' }),
            button('add-sibling', _('Add sibling'), () => mind.insertSibling('after'), { icon: addSiblingIcon, shortcut: 'Enter' }),
            button('remove', _('Delete'), () => mind.removeNodes(selectedTopics()), { icon: deleteIcon, shortcut: 'Del' }),
        ),
        group(
            _('History'),
            button('undo', _('Undo'), () => mind.undo(), { icon: undoIcon, shortcut: 'Ctrl+Z' }),
            button('redo', _('Redo'), () => mind.redo(), { icon: redoIcon, shortcut: 'Ctrl+Y' }),
        ),
        el('span', { class: 'spacer' }),
        group(
            _('Tools'),
            button('import', _('Import'), () => fileInput.click(), { icon: importIcon }),
            button('export', _('Export'), exportJson, { icon: exportIcon }),
            button('print', _('Print'), () => window.print(), { icon: printIcon }),
            fileInput,
        ),
    );
    return bar;
}

/** The map's title and caption, and the format of the selected ideas, as in the legacy inspector. */
function buildInspector(): HTMLElement {
    titleInput = el('input', { type: 'text', id: 'map-title', autocomplete: 'off' });
    titleInput.addEventListener('input', () => {
        titleFollowsRoot = false;
    });
    captionInput = el('input', { type: 'checkbox', id: 'map-caption' });
    const caption = el('label', { class: 'check' });
    caption.append(captionInput, _('Show the title under the image'));
    const map = el('section');
    map.append(el('label', { for: 'map-title' }, _('Descriptive title')), titleInput, caption);

    const format = el('section', { 'aria-labelledby': 'format-heading' });
    format.append(
        el('h2', { id: 'format-heading' }, _('Format')),
        el('p', { id: 'format-hint' }, _('Select an idea to change its appearance.')),
        field(
            _('Size'),
            button('font-smaller', _('Smaller text'), changeFontSize(-FONT_STEP), { icon: smallerIcon, iconOnly: true }),
            button('font-larger', _('Larger text'), changeFontSize(FONT_STEP), { icon: largerIcon, iconOnly: true }),
        ),
        // One decoration at a time, as in the legacy editor (editor.css makes Mind Elixir show it)
        field(
            _('Text style'),
            button('bold', _('Bold'), toggle('fontWeight', 'bold'), { icon: boldIcon, iconOnly: true }),
            button('italic', _('Italic'), toggle('fontStyle', 'italic'), { icon: italicIcon, iconOnly: true }),
            button('underline', _('Underline'), toggle('textDecoration', 'underline'), {
                icon: underlineIcon,
                iconOnly: true,
            }),
            button('strike', _('Strikethrough'), toggle('textDecoration', 'line-through'), {
                icon: strikeIcon,
                iconOnly: true,
            }),
        ),
        field(
            _('Text color'),
            colorInput('text-color', _('Text color'), (color) => patchStyle((style) => (style.color = color))),
        ),
        field(
            _('Line color'),
            colorInput('branch-color', _('Line color'), (color) => setBranchColor(color, false)),
            button(
                'branch-color-children',
                _('Recursive'),
                () => setBranchColor((controls['branch-color'] as HTMLInputElement).value, true),
                { title: _('Apply the line color to the child nodes') },
            ),
        ),
    );

    const inspector = el('aside', { id: 'inspector' });
    inspector.append(map, format);
    return inspector;
}

/** Names Mind Elixir's own zoom and layout buttons, which only have an icon. */
function labelMindElixirToolbars(): void {
    const labels: Record<string, string> = {
        toCenter: _('Center'),
        zoomout: _('Zoom out'),
        zoomin: _('Zoom in'),
        tbltl: _('Ideas on the left'),
        tbltr: _('Ideas on the right'),
        tblts: _('Ideas on both sides'),
    };
    for (const [id, label] of Object.entries(labels)) {
        const span = mind.container.querySelector<HTMLElement>(`.mind-elixir-toolbar #${id}`);
        if (!span) continue;
        span.title = label;
        span.setAttribute('aria-label', label);
        span.setAttribute('role', 'button');
        span.tabIndex = 0;
        span.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                span.click();
            }
        });
    }
}

/**
 * The legacy Navigator: the whole map, drawn by the SVG exporter, with the visible part framed.
 * A click or a drag on it moves the map there.
 */
function buildNavigator(): void {
    const toggle = el('button', { type: 'button', id: 'navigator-toggle', 'aria-expanded': 'true' }, _('Navigator'));
    const view = el('div', { class: 'navigator-view' });
    const image = el('img', { alt: '' });
    const frame = el('div', { class: 'navigator-frame' });
    view.append(image, frame);
    const navigator = el('div', { id: 'navigator' });
    navigator.append(toggle, view);
    (document.getElementById('map') as HTMLElement).append(navigator);

    /** Where the map's content is on screen: Mind Elixir's nodes box without its padding. */
    const content = () => {
        const box = mind.nodes.getBoundingClientRect();
        const css = getComputedStyle(mind.nodes);
        const pad = (side: string) => Number.parseFloat(css.getPropertyValue(`padding-${side}`)) * mind.scaleVal;
        const left = box.left + pad('left');
        const top = box.top + pad('top');
        return { left, top, width: box.right - pad('right') - left, height: box.bottom - pad('bottom') - top };
    };
    const place = () => {
        const c = content();
        const v = mind.container.getBoundingClientRect();
        const clamp = (n: number) => Math.min(100, Math.max(0, n * 100));
        const x0 = clamp((v.left - c.left) / c.width);
        const y0 = clamp((v.top - c.top) / c.height);
        Object.assign(frame.style, {
            left: `${x0}%`,
            top: `${y0}%`,
            width: `${clamp((v.right - c.left) / c.width) - x0}%`,
            height: `${clamp((v.bottom - c.top) / c.height) - y0}%`,
        });
    };
    let timer = 0;
    const render = () => {
        clearTimeout(timer);
        timer = window.setTimeout(async () => {
            image.src = toDataUrl((await mind.exportVectorSvg({ padding: 0 })).svg);
            place();
        }, 150);
    };
    const moveTo = (event: PointerEvent) => {
        const r = view.getBoundingClientRect();
        const c = content();
        const v = mind.container.getBoundingClientRect();
        const x = c.left + ((event.clientX - r.left) / r.width) * c.width;
        const y = c.top + ((event.clientY - r.top) / r.height) * c.height;
        mind.move(v.left + v.width / 2 - x, v.top + v.height / 2 - y);
    };

    toggle.addEventListener('click', () => {
        view.hidden = !view.hidden;
        toggle.setAttribute('aria-expanded', String(!view.hidden));
    });
    view.addEventListener('pointerdown', (event) => {
        view.setPointerCapture(event.pointerId);
        moveTo(event);
    });
    view.addEventListener('pointermove', (event) => {
        if (view.hasPointerCapture(event.pointerId)) moveTo(event);
    });
    // Redrawn when the map changes (Mind Elixir relinks it after every change), framed when it moves
    mind.bus.addListener('linkDiv', render);
    new MutationObserver(place).observe(mind.map, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', place);
    render();
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

/** Answers the dialog's Save: the map's source, its SVG, title and caption, or why not. */
async function save(): Promise<void> {
    try {
        const data = mind.getData();
        const title = titleInput.value.trim() || data.nodeData.topic.trim();
        if (!title) {
            showMessage(_('Please provide a title.'), true);
            titleInput.focus();
            post({ mceAction: 'exeMindmapFailed' });
            return;
        }
        // The plugin reads the theme the editor shows, so the SVG looks like the editor
        const { svg, width, height } = await mind.exportVectorSvg({ title });
        post({
            mceAction: 'exeMindmapSaved',
            code: serializeStoredCode(data, previousMeta),
            svg: toDataUrl(svg),
            width: Math.round(width),
            height: Math.round(height),
            title,
            caption: captionInput.checked,
        });
    } catch (error) {
        // Answered first, so the dialog is never left waiting, even if this page failed to start
        post({ mceAction: 'exeMindmapFailed' });
        const reason = error instanceof Error ? error.message : String(error);
        showMessage(`${_('The mind map could not be saved.')} (${reason})`, true);
    }
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

/** Starts the editor with what the plugin sent (`exeMindmapLoad`): the map, its title and caption. */
export function start(load: Record<string, unknown> = {}): MindElixirInstance {
    document.documentElement.lang = workarea.document?.documentElement?.lang || 'en';
    const main = el('div', { id: 'main' });
    main.append(el('div', { id: 'map' }), buildInspector());
    document.body.replaceChildren(buildToolbar(), el('div', { id: 'message', role: 'status', hidden: '' }), main);

    const data = initialMap(typeof load.code === 'string' ? load.code : '');
    const title = typeof load.title === 'string' ? load.title.trim() : '';
    titleInput.value = title || data.nodeData.topic;
    titleFollowsRoot = !title || title === data.nodeData.topic;
    captionInput.checked = load.caption !== false;

    mind = new MindElixir({
        el: '#map',
        direction: MindElixir.SIDE,
        toolBar: true,
        keypress: true,
        allowUndo: true,
        contextMenu: { locale: contextMenuLocale(), focus: true, link: false },
        newTopicName: _('New idea'),
        theme: THEME,
    }) as WithVectorSvgExport<MindElixirInstance>;
    // The SVG draws underline and strike-through, which editor.css makes the editor show
    mind.install(createSvgExportPlugin({ textDecoration: true }));
    // The font the SVG is laid out for, so the map looks the same in the editor and the content
    mind.container.style.fontFamily = DEFAULT_FONT_FAMILY;
    mind.init(data);
    labelMindElixirToolbars();
    buildNavigator();
    // The whole map in view, unless that makes its text too small to read, and the central
    // idea selected, ready for Tab and Enter
    mind.scaleFit();
    if (mind.scaleVal < MIN_FIT_SCALE) {
        mind.scale(MIN_FIT_SCALE);
        mind.toCenter();
    }
    mind.selectNode(mind.findEle(mind.nodeData.id));
    // The running instance, for debugging and for the end-to-end tests
    (window as Window & { __mindmapEditor?: MindElixirInstance }).__mindmapEditor = mind;

    mind.bus.addListener('selectNodes', refreshControls);
    mind.bus.addListener('unselectNodes', refreshControls);
    mind.bus.addListener('operation', () => {
        if (titleFollowsRoot) titleInput.value = mind.nodeData.topic;
        refreshControls();
    });
    refreshControls();

    window.addEventListener('pagehide', () => mind.destroy());
    return mind;
}

window.addEventListener('message', (event: MessageEvent) => {
    // Only the plugin's dialog: this page's parent, on this page's origin
    if (event.source !== workarea || event.origin !== location.origin) return;
    const message = event.data as Record<string, unknown> | null;
    if (message?.mceAction === 'exeMindmapLoad' && !mind) start(message);
    else if (message?.mceAction === 'exeMindmapSave') void save();
    else if (message?.mceAction === 'exeMindmapError') showMessage(String(message.message ?? ''), true);
});

function ready(): void {
    // Opened on its own (not in the plugin's dialog), it starts a new map
    if (workarea === window) start();
    else post({ mceAction: 'exeMindmapReady' });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
} else {
    ready();
}
