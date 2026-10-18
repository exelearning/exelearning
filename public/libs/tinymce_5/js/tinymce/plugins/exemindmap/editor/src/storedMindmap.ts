/**
 * Reads and writes the mind map source kept in a `<p class="exe-mindmap-code">`.
 *
 * Two formats are found there:
 *
 * - **Legacy mindmaps documents** (`{ id, title, mindmap: { root }, dates, dimensions, autosave }`),
 *   written by the mindmaps.app editor that eXeLearning shipped until it moved to Mind Elixir.
 * - **Mind Elixir data** (`{ nodeData, ..., meta: { exelearning: { version } } }`), written now.
 *
 * Opening a legacy document converts it in memory. The stored source only changes when the
 * author saves, and everything Mind Elixir cannot represent (legacy node offsets and document
 * metadata) is kept in `metadata` / `meta` so a later version can still recover it.
 *
 * The legacy plugin stored the JSON in a damaged form, which `readStoredCode` repairs:
 * it ran `JSON.stringify(json).replace(/\\"/g, '"').slice(1, -1)`, which writes a `"` typed
 * in a caption as `\\"`, and it inserted the JSON into the paragraph unescaped, so TinyMCE
 * parsed a caption such as `<clima>` as an element and appended `</clima>` after the JSON.
 */

import type { MindElixirData, NodeObj } from 'mind-elixir';

/** Version of the eXeLearning data written in `meta.exelearning`. */
export const STORED_FORMAT_VERSION = 1;

/** Limits that keep a damaged or hostile document from hanging the editor. */
export const MAX_NODES = 10000;
export const MAX_DEPTH = 200;

/** Mind Elixir's `direction` values (the constants live on the class). */
const LEFT = 0;
const RIGHT = 1;
const SIDE = 2;

export class MindmapFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MindmapFormatError';
    }
}

// ---------------------------------------------------------------------------
// Legacy mindmaps format
// ---------------------------------------------------------------------------

export interface LegacyFont {
    style?: string;
    weight?: string;
    decoration?: string;
    size?: number;
    color?: string;
}

export interface LegacyNode {
    id?: string;
    parentId?: string | null;
    text?: { caption?: string; font?: LegacyFont };
    offset?: { x?: number; y?: number };
    foldChildren?: boolean;
    branchColor?: string;
    children?: LegacyNode[];
}

export interface LegacyDocument {
    id?: string;
    title?: string;
    mindmap: { root: LegacyNode };
    dates?: { created?: number; modified?: number };
    dimensions?: { x?: number; y?: number };
    autosave?: boolean;
}

/** What eXeLearning keeps in `meta.exelearning`. */
export interface ExeMeta {
    version: number;
    /** Document fields of the legacy source, kept when a legacy map was converted. */
    legacy?: Omit<LegacyDocument, 'mindmap'>;
}

/** What eXeLearning keeps in a node's `metadata`. */
export interface ExeNodeMetadata {
    /** Position of the node relative to its parent in the legacy editor. */
    legacyOffset?: { x: number; y: number };
    /** Original legacy id, when it had to be replaced because it was repeated. */
    legacyId?: string;
}

/** Defaults of the legacy `mindmaps.Node` and `mindmaps.MindMap` constructors. */
const LEGACY_FONT: Required<LegacyFont> = { style: 'normal', weight: 'normal', decoration: 'none', size: 15, color: '#000000' };
const LEGACY_ROOT_FONT: Required<LegacyFont> = { ...LEGACY_FONT, weight: 'bold', size: 20 };

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isLegacyMindmapDocument(value: unknown): value is LegacyDocument {
    return isObject(value) && isObject(value.mindmap) && isObject((value.mindmap as Record<string, unknown>).root);
}

export function isMindElixirData(value: unknown): value is MindElixirData {
    return isObject(value) && isObject(value.nodeData);
}

type NodeStyle = NonNullable<NodeObj['style']> & { fontStyle?: string };

/** Legacy font settings that differ from the legacy defaults, as Mind Elixir styles. */
function legacyFontToStyle(font: LegacyFont | undefined, isRoot: boolean): NodeStyle | undefined {
    const defaults = isRoot ? LEGACY_ROOT_FONT : LEGACY_FONT;
    const f = { ...defaults, ...(isObject(font) ? font : {}) };
    const style: NodeStyle = {};
    if (Number.isFinite(f.size) && f.size !== defaults.size) style.fontSize = `${f.size}px`;
    if (f.weight !== defaults.weight) style.fontWeight = String(f.weight);
    // Not in Mind Elixir's style type, but it applies every style key to the topic
    if (f.style !== defaults.style) style.fontStyle = String(f.style);
    if (f.decoration !== defaults.decoration) style.textDecoration = String(f.decoration);
    if (typeof f.color === 'string' && f.color.toLowerCase() !== defaults.color) style.color = f.color;
    return Object.keys(style).length ? style : undefined;
}

/**
 * Converts a legacy mindmaps document to Mind Elixir data.
 *
 * Keeps the hierarchy, order, ids, captions, font size/weight/style/decoration/colour,
 * branch colours and folded state. Main branches go to the side their legacy offset was on.
 * Offsets and document fields are kept as metadata.
 */
export function convertLegacyMindmapToMindElixir(doc: LegacyDocument): MindElixirData {
    if (!isLegacyMindmapDocument(doc)) {
        throw new MindmapFormatError('Not a mindmaps document');
    }
    const seen = new Set<string>();
    let count = 0;

    const convert = (node: LegacyNode, depth: number): NodeObj => {
        if (!isObject(node)) throw new MindmapFormatError('A node is not an object');
        if (++count > MAX_NODES) throw new MindmapFormatError(`The map has more than ${MAX_NODES} nodes`);
        if (depth > MAX_DEPTH) throw new MindmapFormatError(`The map is deeper than ${MAX_DEPTH} levels`);
        const isRoot = depth === 0;

        let id = typeof node.id === 'string' && node.id ? node.id : `legacy-${count}`;
        const metadata: ExeNodeMetadata = {};
        if (seen.has(id)) {
            metadata.legacyId = id;
            id = `${id}-${count}`;
        }
        seen.add(id);

        const caption = isObject(node.text) && typeof node.text.caption === 'string' ? node.text.caption : '';
        const result: NodeObj = { id, topic: caption, expanded: node.foldChildren !== true };
        const style = legacyFontToStyle(isObject(node.text) ? node.text.font : undefined, isRoot);
        if (style) result.style = style;
        if (!isRoot && typeof node.branchColor === 'string' && node.branchColor) result.branchColor = node.branchColor;

        const offset = isObject(node.offset) ? node.offset : undefined;
        const x = Number(offset?.x) || 0;
        const y = Number(offset?.y) || 0;
        if (!isRoot && offset) metadata.legacyOffset = { x, y };
        if (depth === 1) result.direction = x < 0 ? LEFT : RIGHT;
        if (Object.keys(metadata).length) result.metadata = metadata;

        const children = Array.isArray(node.children) ? node.children : [];
        result.children = children.map((child) => convert(child, depth + 1));
        return result;
    };

    const { mindmap, ...documentFields } = doc;
    const legacy: ExeMeta['legacy'] = {};
    for (const key of ['id', 'title', 'dates', 'dimensions', 'autosave'] as const) {
        if (documentFields[key] !== undefined) (legacy as Record<string, unknown>)[key] = documentFields[key];
    }
    return {
        nodeData: convert(mindmap.root, 0),
        direction: SIDE,
        meta: { exelearning: { version: STORED_FORMAT_VERSION, legacy } satisfies ExeMeta },
    };
}

/**
 * Compares a legacy document with its conversion and returns the differences found.
 * An empty list means every node, caption, order, style, colour and folded state survived.
 */
export function validateConvertedMindmap(doc: LegacyDocument, data: MindElixirData): string[] {
    const problems: string[] = [];
    const ids = new Set<string>();
    const walk = (legacy: LegacyNode, node: NodeObj | undefined, path: string, depth: number) => {
        if (!node) {
            problems.push(`${path}: missing`);
            return;
        }
        if (ids.has(node.id)) problems.push(`${path}: repeated id ${node.id}`);
        ids.add(node.id);
        const caption = legacy.text?.caption ?? '';
        if (node.topic !== caption) problems.push(`${path}: caption "${node.topic}" instead of "${caption}"`);
        if ((node.expanded !== false) === (legacy.foldChildren === true)) problems.push(`${path}: folded state`);
        if (depth > 0 && legacy.branchColor && node.branchColor !== legacy.branchColor) problems.push(`${path}: branch colour`);
        const expected = JSON.stringify(legacyFontToStyle(legacy.text?.font, depth === 0) ?? {});
        if (JSON.stringify(node.style ?? {}) !== expected) problems.push(`${path}: style`);
        const legacyChildren = legacy.children ?? [];
        const children = node.children ?? [];
        if (children.length !== legacyChildren.length) {
            problems.push(`${path}: ${children.length} children instead of ${legacyChildren.length}`);
        }
        legacyChildren.forEach((child, i) => walk(child, children[i], `${path}/${i}`, depth + 1));
    };
    walk(doc.mindmap.root, data.nodeData, 'root', 0);
    return problems;
}

// ---------------------------------------------------------------------------
// Mind Elixir data coming from stored content or an imported file
// ---------------------------------------------------------------------------

const ALLOWED_STYLE_KEYS = new Set([
    'fontSize',
    'fontFamily',
    'color',
    'background',
    'fontWeight',
    'fontStyle',
    'width',
    'border',
    'textDecoration',
]);
const SAFE_LINK = /^(https?:|mailto:|#|\/|\.{0,2}\/)/i;
const SAFE_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,/i;

/**
 * Validates Mind Elixir data and removes what could run script or reach the network from
 * inside the editor, which shares the workarea's origin: `dangerouslySetInnerHTML`, links
 * other than http(s)/mailto/relative, images that are not inline data, and style values
 * outside the properties the editor sets or containing `url(`.
 */
export function sanitizeMindElixirData(value: unknown): MindElixirData {
    if (!isMindElixirData(value)) throw new MindmapFormatError('Not a Mind Elixir map');
    const seen = new Set<string>();
    let count = 0;

    const clean = (raw: unknown, depth: number): NodeObj => {
        if (!isObject(raw)) throw new MindmapFormatError('A node is not an object');
        if (++count > MAX_NODES) throw new MindmapFormatError(`The map has more than ${MAX_NODES} nodes`);
        if (depth > MAX_DEPTH) throw new MindmapFormatError(`The map is deeper than ${MAX_DEPTH} levels`);
        let id = typeof raw.id === 'string' && raw.id ? raw.id : `node-${count}`;
        if (seen.has(id)) id = `${id}-${count}`;
        seen.add(id);

        const node: NodeObj = { id, topic: typeof raw.topic === 'string' ? raw.topic : '' };
        if (typeof raw.expanded === 'boolean') node.expanded = raw.expanded;
        if (raw.direction === LEFT || raw.direction === RIGHT) node.direction = raw.direction;
        if (typeof raw.branchColor === 'string' && !/url\(/i.test(raw.branchColor)) node.branchColor = raw.branchColor;
        if (typeof raw.hyperLink === 'string' && SAFE_LINK.test(raw.hyperLink.trim())) node.hyperLink = raw.hyperLink;
        if (typeof raw.note === 'string') node.note = raw.note;
        if (raw.metadata !== undefined) node.metadata = raw.metadata;
        if (Array.isArray(raw.tags)) node.tags = raw.tags.filter((t) => typeof t === 'string');
        if (Array.isArray(raw.icons)) node.icons = raw.icons.filter((t) => typeof t === 'string');
        if (isObject(raw.image) && typeof raw.image.url === 'string' && SAFE_IMAGE.test(raw.image.url)) {
            node.image = raw.image as NodeObj['image'];
        }
        if (isObject(raw.style)) {
            const style: Record<string, string> = {};
            for (const [key, v] of Object.entries(raw.style)) {
                if (ALLOWED_STYLE_KEYS.has(key) && typeof v === 'string' && !/url\(|expression\(/i.test(v)) style[key] = v;
            }
            if (Object.keys(style).length) node.style = style;
        }
        const children = Array.isArray(raw.children) ? raw.children : [];
        node.children = children.map((child) => clean(child, depth + 1));
        return node;
    };

    const data: MindElixirData = { nodeData: clean(value.nodeData, 0) };
    const direction = (value as Record<string, unknown>).direction;
    if (direction === 0 || direction === 1 || direction === 2 || direction === 3) data.direction = direction;
    const meta = (value as Record<string, unknown>).meta;
    if (isObject(meta)) data.meta = meta;
    return data;
}

// ---------------------------------------------------------------------------
// Reading and writing `.exe-mindmap-code`
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };

export function decodeHtmlEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
        if (name[0] === '#') {
            const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
            return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
        }
        return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
    });
}

/** Inverse of the legacy plugin's `JSON.stringify(json).replace(/\\"/g, '"').slice(1, -1)`. */
function undoLegacySaveTransform(text: string): string {
    return JSON.parse(`"${text.replace(/"/g, '\\"')}"`);
}

export interface StoredMindmap {
    format: 'mind-elixir' | 'legacy';
    data: MindElixirData;
    /** The parsed legacy document, when the source was one */
    legacy?: LegacyDocument;
}

/**
 * Parses the HTML content of a `.exe-mindmap-code` paragraph (its innerHTML).
 * Throws a MindmapFormatError when it holds no usable map; the caller keeps the original.
 */
export function readStoredCode(innerHtml: string): StoredMindmap {
    let text = decodeHtmlEntities(String(innerHtml ?? '')).trim();
    const end = text.lastIndexOf('}');
    if (!text.startsWith('{') || end < 0) throw new MindmapFormatError('No mind map data found');
    // Drops closing tags TinyMCE appended after the JSON (see the file comment)
    text = text.slice(0, end + 1);

    if (/^\{\s*"nodeData"\s*:/.test(text) || /"nodeData"\s*:\s*\{/.test(text.slice(0, 200))) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch (error) {
            throw new MindmapFormatError(`The mind map data is not valid JSON: ${(error as Error).message}`);
        }
        return { format: 'mind-elixir', data: sanitizeMindElixirData(parsed) };
    }

    // Legacy: written through the save transform, unless a tool stored plain JSON
    let parsed: unknown;
    for (const candidate of [() => JSON.parse(undoLegacySaveTransform(text)), () => JSON.parse(text)]) {
        try {
            parsed = candidate();
            if (isLegacyMindmapDocument(parsed)) break;
        } catch {
            parsed = undefined;
        }
    }
    if (isLegacyMindmapDocument(parsed)) {
        return { format: 'legacy', data: convertLegacyMindmapToMindElixir(parsed), legacy: parsed };
    }
    if (isMindElixirData(parsed)) return { format: 'mind-elixir', data: sanitizeMindElixirData(parsed) };
    throw new MindmapFormatError('The mind map data is not a format this editor knows');
}

/** Removes Mind Elixir's runtime-only `parent` links and keeps the stored fields. */
function stripNode(node: NodeObj): NodeObj {
    const { parent: _parent, children, ...rest } = node;
    const out: NodeObj = { ...rest };
    if (children?.length) out.children = children.map(stripNode);
    return out;
}

/**
 * Serializes Mind Elixir data for `.exe-mindmap-code`. The result is HTML-escaped, so
 * captions can never be parsed as markup, and still starts with `{` as the plugin expects.
 */
export function serializeStoredCode(data: MindElixirData, previousMeta?: Record<string, unknown>): string {
    const meta = { ...(previousMeta ?? {}), ...(data.meta ?? {}) } as Record<string, unknown>;
    const exe = isObject(meta.exelearning) ? meta.exelearning : {};
    meta.exelearning = { ...exe, version: STORED_FORMAT_VERSION };
    const stored: MindElixirData = { nodeData: stripNode(data.nodeData) };
    if (data.direction !== undefined) stored.direction = data.direction;
    if (data.arrows?.length) stored.arrows = data.arrows;
    if (data.summaries?.length) stored.summaries = data.summaries;
    stored.meta = meta;
    return JSON.stringify(stored).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Counts a map's nodes. */
export function countNodes(node: NodeObj | LegacyNode): number {
    return 1 + ((node.children as Array<NodeObj | LegacyNode>) ?? []).reduce((sum, child) => sum + countNodes(child), 0);
}
