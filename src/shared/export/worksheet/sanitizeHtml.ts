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

function renderNode(node: HtmlNode): string {
    if ('value' in node) return escapeText(node.value);
    if (!('tagName' in node) || STRIPPED_WITH_CONTENT.has(node.tagName)) return '';
    const children = node.childNodes.map(renderNode).join('');
    if (!Object.hasOwn(ALLOWED_TAGS, node.tagName)) return children;
    const allowed = ALLOWED_TAGS[node.tagName];
    const attrs = node.attrs
        .filter(attr => allowed.includes(attr.name) && (attr.name !== 'src' || isSafeImageUrl(attr.value)))
        .map(attr => ` ${attr.name}="${escapeText(attr.value)}"`)
        .join('');
    return VOID_TAGS.has(node.tagName)
        ? `<${node.tagName}${attrs} />`
        : `<${node.tagName}${attrs}>${children}</${node.tagName}>`;
}

/** Keep safe formatting, discarding executable elements and rebuilding allowed attributes. */
export function sanitizeHtml(html: string | null | undefined): string {
    if (typeof html !== 'string' || !html) return '';
    // NUL is dropped before parsing: browsers treat it inconsistently inside markup.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: removing NUL is deliberate
    return parseFragment(html.replace(/\u0000/g, ''))
        .childNodes.map(renderNode)
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
