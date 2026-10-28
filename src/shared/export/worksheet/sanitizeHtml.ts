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
    a: ['href'],
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
/** Content embedded from elsewhere, and the attribute holding where it comes from. */
const EMBEDDED_CONTENT: Record<string, string> = { iframe: 'src', embed: 'src', object: 'data' };
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
 * An address on the web, the one kind a reader holding the paper can follow; null for any other.
 *
 * Print styles recognise a web address by how it starts (`a[href^="http"]`), so one written
 * without its protocol is given HTTPS, and the protocol is written in lower case.
 */
function webAddress(value: string | undefined): string | null {
    const address = (value ?? '').trim();
    const start = /^(?:(https?):)?\/\/(?=[^\s/])/i.exec(address);
    if (!start) return null;
    return `${(start[1] ?? 'https').toLowerCase()}://${address.slice(start[0].length)}`;
}

/** The value of one of an element's attributes. */
function attributeOf(node: DefaultTreeAdapterMap['element'], name: string): string | undefined {
    return node.attrs.find(attr => attr.name === name)?.value;
}

/**
 * Where content embedded from the web can be found, written where it was embedded.
 *
 * It has a class of its own rather than the one `common.js` gives the address beside each frame
 * of the document. That one sits next to a frame still there to print, and the base styles and
 * Show link URLs may move or hide it; this one is all that is left of what was embedded, and is
 * printed whatever the options say (`WORKSHEET_ACTIVITY_STYLES`).
 */
function embeddedAddress(address: string, insideLink: boolean): string {
    const url = escapeText(address);
    // An embed can sit inside an author link. Nesting a second anchor would make the browser
    // close the first early, separating it from any answer gap whose link must be removed.
    const content = insideLink ? url : `<a href="${url}">${url}</a>`;
    return `<span class="worksheet-embed-address">${content}</span>`;
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

function renderNode(node: HtmlNode, insideLink = false): Rendered {
    if ('value' in node) return { html: escapeText(node.value), stripped: false };
    if (!('tagName' in node)) return { html: '', stripped: false };
    if (STRIPPED_WITH_CONTENT.has(node.tagName)) {
        // Paper cannot play what was embedded from the web, but it can say where to find it, in
        // the place it was. Content from anywhere else leaves nothing a reader could follow, and
        // goes without a trace.
        const source = Object.hasOwn(EMBEDDED_CONTENT, node.tagName)
            ? webAddress(attributeOf(node, EMBEDDED_CONTENT[node.tagName]))
            : null;
        return source ? { html: embeddedAddress(source, insideLink), stripped: false } : { html: '', stripped: true };
    }

    const href = node.tagName === 'a' ? webAddress(attributeOf(node, 'href')) : null;
    const parts = node.childNodes.map(child => renderNode(child, insideLink || href !== null));
    const children = parts.map(part => part.html).join('');
    const stripped = parts.some(part => part.stripped);

    if (!Object.hasOwn(ALLOWED_TAGS, node.tagName)) return { html: children, stripped };

    // A link is kept for an address on the web, which print writes after it, and only round
    // something to read: round nothing, the address would be printed on its own. Any other link
    // leads nowhere a reader holding the paper can go, and only what it held is kept.
    if (node.tagName === 'a' && (!href || !showsSomething(children))) return { html: children, stripped };

    // An element left with nothing to show, because what was in it could not be printed, goes with
    // it. A video in a paragraph of its own would otherwise print as a hole the size of the words
    // it replaced. An element the author left empty is theirs and is kept: a blank paragraph
    // between two others is spacing they asked for.
    if (stripped && !VOID_TAGS.has(node.tagName) && !TABLE_STRUCTURE.has(node.tagName) && !showsSomething(children))
        return { html: '', stripped };

    const allowed = ALLOWED_TAGS[node.tagName];
    const attrs = node.attrs
        .filter(attr => allowed.includes(attr.name) && (attr.name !== 'src' || isSafeImageUrl(attr.value)))
        .map(attr => ` ${attr.name}="${escapeText(attr.name === 'href' ? href : attr.value)}"`)
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
