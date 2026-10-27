/** HTML5 parsing keeps author text, entities and attributes consistent in Bun and browsers. */
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';

const ALLOWED_TAGS: Record<string, readonly string[]> = {
    p: [],
    br: [],
    hr: [],
    strong: [],
    b: [],
    em: [],
    i: [],
    u: [],
    s: [],
    sub: [],
    sup: [],
    ul: [],
    ol: ['start'],
    li: ['value'],
    blockquote: [],
    code: [],
    pre: [],
    span: [],
    div: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    table: [],
    thead: [],
    tbody: [],
    tr: [],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
    img: ['src', 'alt', 'title', 'width', 'height'],
};
const STRIPPED_WITH_CONTENT = new Set([
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'noscript',
    'template',
    'svg',
    'math',
]);
const VOID_TAGS = new Set(['br', 'hr', 'img']);
type HtmlNode = DefaultTreeAdapterMap['childNode'];

/** Escape a decoded string exactly once when serializing text or a quoted attribute. */
export function escapeText(text: string | null | undefined): string {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Attribute entities have already been decoded by the HTML parser. */
export function isSafeImageUrl(value: string): boolean {
    // Control characters are the point of this check: a browser ignores them inside a URL, so a
    // scheme split by a tab or a NUL still resolves, and must still be rejected.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the check
    const normalized = value.replace(/[\s\u0000-\u001f\u007f]/g, '');
    return (
        !/^[a-z][a-z0-9+.-]*:/i.test(normalized) ||
        /^(?:https?|blob|asset):/i.test(normalized) ||
        /^data:image\//i.test(normalized)
    );
}

/**
 * Cells and rows, which are kept even when empty.
 *
 * A table's shape is the columns lining up. Dropping a cell because a video used to be the only
 * thing in it would shift every cell after it one place to the left.
 */
const TABLE_STRUCTURE = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th']);

/** What a sanitised fragment leaves behind, and whether anything was taken out of it. */
interface Rendered {
    html: string;
    /** True when an element that cannot be printed was removed from this subtree. */
    stripped: boolean;
}

/** Whether a sanitised fragment would put anything on the page. */
function showsSomething(html: string): boolean {
    return /<(?:img|hr)\b/i.test(html) || html.replace(/<[^>]*>/g, '').trim() !== '';
}

function renderNode(node: HtmlNode): Rendered {
    if ('value' in node) return { html: escapeText(node.value), stripped: false };
    if (!('tagName' in node)) return { html: '', stripped: false };
    if (STRIPPED_WITH_CONTENT.has(node.tagName)) return { html: '', stripped: true };

    const parts = node.childNodes.map(renderNode);
    const children = parts.map(part => part.html).join('');
    const stripped = parts.some(part => part.stripped);

    if (!Object.hasOwn(ALLOWED_TAGS, node.tagName)) return { html: children, stripped };

    // An element left with nothing to show, because what was in it could not be printed, goes with
    // it. A video in a paragraph of its own would otherwise print as a hole the size of the words
    // it replaced. An element the author left empty is theirs and is kept: a blank paragraph
    // between two others is spacing they asked for.
    if (stripped && !VOID_TAGS.has(node.tagName) && !TABLE_STRUCTURE.has(node.tagName) && !showsSomething(children))
        return { html: '', stripped };

    const allowed = ALLOWED_TAGS[node.tagName];
    const attrs = node.attrs
        .filter(attr => allowed.includes(attr.name) && (attr.name !== 'src' || isSafeImageUrl(attr.value)))
        .map(attr => ` ${attr.name}="${escapeText(attr.value)}"`)
        .join('');
    const html = VOID_TAGS.has(node.tagName)
        ? `<${node.tagName}${attrs} />`
        : `<${node.tagName}${attrs}>${children}</${node.tagName}>`;

    return { html, stripped };
}

/** Keep safe formatting, discarding executable elements and rebuilding allowed attributes. */
export function sanitizeHtml(html: string | null | undefined): string {
    if (typeof html !== 'string' || !html) return '';
    // NUL is dropped before parsing: browsers treat it inconsistently inside markup.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: removing NUL is deliberate
    return parseFragment(html.replace(/\u0000/g, ''))
        .childNodes.map(node => renderNode(node).html)
        .join('')
        .trim();
}

/** Visible text of a parsed fragment, with entities decoded by the HTML parser. */
export function nodeText(node: DefaultTreeAdapterMap['node']): string {
    if ('value' in node) return node.value;
    return 'childNodes' in node ? node.childNodes.map(nodeText).join('') : '';
}

/** Convert safe HTML to decoded text, preserving spacing between block-level fragments. */
export function htmlToText(html: string | null | undefined): string {
    const safe = sanitizeHtml(html);
    const spaced = safe.replace(/<\/?(?:p|div|br|li|h[1-6]|tr)\b[^>]*>/gi, ' ');
    return nodeText(parseFragment(spaced)).replace(/\s+/g, ' ').trim();
}

/** Images are printable content even when a fragment contains no text. */
export function hasPrintableContent(html: string | null | undefined): boolean {
    const safe = sanitizeHtml(html);
    return htmlToText(safe) !== '' || /<img\b[^>]*\bsrc="[^"]+"/i.test(safe);
}
