/**
 * Reads the source of a legacy mind map and converts it to Mermaid `mindmap` code.
 *
 * Until eXeLearning retired its mindmaps.app editor, the exemindmap TinyMCE plugin stored a
 * map as a PNG plus the editor's JSON document in `<p class="exe-mindmap-code">`:
 * `{ id, title, mindmap: { root }, dates, dimensions, autosave }`, where every node is
 * `{ id, parentId, text: { caption, font }, offset, foldChildren, branchColor, children }`.
 *
 * The plugin damaged that JSON in two known ways, which `parseLegacyMindmapCode` undoes:
 *
 * - It saved `JSON.stringify(json).replace(/\\"/g, '"').slice(1, -1)`, so every backslash
 *   escape of the JSON is doubled except for quotes (a `"` typed in a caption becomes `\\"`).
 * - It inserted the JSON into the paragraph without escaping it, so TinyMCE parsed a caption
 *   such as `<clima>` as an element and appended `</clima>` after the JSON.
 *
 * Anything else that does not parse is rejected rather than guessed at: the caller keeps
 * the original map untouched.
 */

import { mindElixirToMermaid } from '@erseco/mind-elixir-export-mermaid';

import { decodeEntities } from '../export/prerender/MermaidPreRenderer';

/** Limits that keep a damaged or hostile document from hanging the editor. */
export const MAX_SOURCE_LENGTH = 5_000_000;
export const MAX_NODES = 10_000;
export const MAX_DEPTH = 200;

export class LegacyMindmapError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LegacyMindmapError';
    }
}

export interface LegacyMindmapNode {
    id?: string;
    parentId?: string | null;
    text?: {
        caption?: string;
        font?: { style?: string; weight?: string; decoration?: string; size?: number; color?: string };
    };
    offset?: { x?: number; y?: number };
    foldChildren?: boolean;
    branchColor?: string;
    children?: LegacyMindmapNode[];
}

export interface LegacyMindmapDocument {
    id?: string;
    title?: string;
    mindmap: { root: LegacyMindmapNode };
    dates?: { created?: number; modified?: number };
    dimensions?: { x?: number; y?: number };
    autosave?: boolean;
}

/** The node shape `mindElixirToMermaid` reads. */
interface TopicNode {
    topic: string;
    children: TopicNode[];
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLegacyDocument(value: unknown): value is LegacyMindmapDocument {
    return isObject(value) && isObject(value.mindmap) && isObject(value.mindmap.root);
}

/** Inverse of the legacy save transform described in the file comment. */
function undoLegacySaveTransform(text: string): string {
    return JSON.parse(`"${text.replace(/"/g, '\\"')}"`);
}

/**
 * Parses the inner HTML of a `.exe-mindmap-code` paragraph.
 *
 * @throws {LegacyMindmapError} when it holds no recognisable mindmaps document.
 */
export function parseLegacyMindmapCode(innerHtml: string): LegacyMindmapDocument {
    if (typeof innerHtml !== 'string') throw new LegacyMindmapError('The mind map has no source data.');
    if (innerHtml.length > MAX_SOURCE_LENGTH) throw new LegacyMindmapError('The mind map source data is too large.');
    let text = decodeEntities(innerHtml).trim();
    const end = text.lastIndexOf('}');
    if (!text.startsWith('{') || end < 0) throw new LegacyMindmapError('The mind map has no source data.');
    // Drops the closing tags TinyMCE appended after the JSON
    text = text.slice(0, end + 1);

    // Legacy content went through the save transform; plain JSON is accepted as well
    for (const parse of [() => JSON.parse(undoLegacySaveTransform(text)), () => JSON.parse(text)]) {
        try {
            const parsed: unknown = parse();
            if (isLegacyDocument(parsed)) return parsed;
        } catch {
            // Try the next reading
        }
    }
    throw new LegacyMindmapError('The mind map source data is damaged and cannot be read.');
}

/** Builds the topic tree, validating every node instead of skipping what it does not understand. */
function toTopicTree(root: LegacyMindmapNode): { tree: TopicNode; count: number } {
    let count = 0;
    const convert = (node: unknown, depth: number): TopicNode => {
        if (!isObject(node)) throw new LegacyMindmapError('The mind map contains a node that is not valid.');
        if (++count > MAX_NODES) throw new LegacyMindmapError(`The mind map has more than ${MAX_NODES} nodes.`);
        if (depth > MAX_DEPTH) throw new LegacyMindmapError(`The mind map is deeper than ${MAX_DEPTH} levels.`);
        const text = node.text;
        const caption = isObject(text) && typeof text.caption === 'string' ? text.caption : '';
        if (node.children !== undefined && !Array.isArray(node.children)) {
            throw new LegacyMindmapError('The mind map contains a node whose children are not valid.');
        }
        // Folded branches (foldChildren) are kept: Mermaid has no folding, so they are shown
        const children = ((node.children as unknown[] | undefined) ?? []).map(child => convert(child, depth + 1));
        return { topic: caption, children };
    };
    const tree = convert(root, 0);
    return { tree, count };
}

/**
 * Converts a legacy mindmaps document to Mermaid `mindmap` code.
 *
 * Keeps every node, caption, line break, the hierarchy and the order, including the
 * descendants of folded nodes. Colours, fonts, positions and folding have no Mermaid
 * equivalent and are not converted.
 *
 * @throws {LegacyMindmapError} when the document is not valid or exceeds the limits.
 */
export function legacyMindmapToMermaid(doc: LegacyMindmapDocument): string {
    if (!isLegacyDocument(doc)) throw new LegacyMindmapError('This is not a mind map document.');
    // Markdown strings keep line breaks; their labels are escaped by the library
    return mindElixirToMermaid(toTopicTree(doc.mindmap.root).tree, { markdown: true });
}

/**
 * Reads a `.exe-mindmap-code` paragraph and returns the Mermaid code and its node count.
 *
 * @throws {LegacyMindmapError} when the source cannot be read or converted.
 */
export function convertLegacyMindmapCode(innerHtml: string): { source: string; nodes: number } {
    const doc = parseLegacyMindmapCode(innerHtml);
    const { tree, count } = toTopicTree(doc.mindmap.root);
    return { source: mindElixirToMermaid(tree, { markdown: true }), nodes: count };
}
