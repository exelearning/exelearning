/**
 * Worksheet HTML sanitiser
 *
 * Activity text (instructions, question prompts, closing notes) is author-written HTML lifted out
 * of the project and dropped into a brand new document. A crafted .elp could carry a script there,
 * so it is filtered before it reaches the page.
 *
 * Deliberately dependency-free and DOM-free: this module runs both in the browser and under Bun
 * for CLI exports, and DOMPurify needs a DOM in both halves.
 *
 * The policy is narrow on purpose — a worksheet only needs formatting. Anything outside the
 * allow-list is unwrapped (tag dropped, text kept) rather than deleted, so no wording is lost.
 */

/** Tags kept, with the attributes allowed on each. Everything else is unwrapped. */
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
    ol: [],
    li: [],
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
    td: [],
    th: [],
    img: ['src', 'alt', 'title', 'width', 'height'],
};

/** Tags dropped together with their contents — unwrapping these would leak code as text. */
const STRIPPED_WITH_CONTENT = ['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg'];

/** Tags that never carry a closing tag. */
const VOID_TAGS = new Set(['br', 'hr', 'img']);

/**
 * Sentinel wrapping the placeholders that stand in for already-rebuilt tags.
 *
 * It has to be a character that cannot legitimately appear in author HTML, otherwise plain text
 * could be mistaken for a placeholder. NUL fits, and is stripped from the input up front.
 */
const MARKER = String.fromCharCode(0);

/** URL schemes accepted in `img src`. Relative and protocol-relative URLs are accepted too. */
const SAFE_URL_PATTERN = /^(?:https?:|blob:|data:image\/|content\/|asset:|\/|\.{0,2}\/|#|[^:]*$)/i;

/**
 * Check whether a URL is safe to emit, rejecting `javascript:` and friends.
 */
function isSafeUrl(value: string): boolean {
    // Entities and whitespace are stripped first: `java&#115;cript:` and `java\tscript:` both
    // resolve to `javascript:` once the browser parses the attribute.
    const normalised = value.replace(/&#(\d+);?/g, (_m, code) => String.fromCharCode(Number(code))).replace(/\s+/g, '');

    if (/^[a-z][a-z0-9+.-]*:/i.test(normalised)) {
        return /^(?:https?|blob|asset):/i.test(normalised) || /^data:image\//i.test(normalised);
    }

    return SAFE_URL_PATTERN.test(normalised);
}

/**
 * Escape a value for use inside a double-quoted attribute.
 */
function escapeAttribute(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Rebuild an allowed tag with only its allowed attributes.
 *
 * Attributes are re-emitted from scratch rather than filtered in place, so nothing unexpected
 * (event handlers, `style`, stray quoting) can survive.
 */
function rebuildTag(tagName: string, rawAttributes: string, isClosing: boolean, selfClosed: boolean): string {
    if (isClosing) return VOID_TAGS.has(tagName) ? '' : `</${tagName}>`;

    const allowed = ALLOWED_TAGS[tagName] ?? [];
    let rendered = `<${tagName}`;

    if (allowed.length > 0) {
        const attributePattern = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
        let match = attributePattern.exec(rawAttributes);

        while (match !== null) {
            const name = match[1].toLowerCase();
            const value = match[2] ?? match[3] ?? match[4] ?? '';

            if (allowed.includes(name) && (name !== 'src' || isSafeUrl(value))) {
                rendered += ` ${name}="${escapeAttribute(value)}"`;
            }
            match = attributePattern.exec(rawAttributes);
        }
    }

    return VOID_TAGS.has(tagName) || selfClosed ? `${rendered} />` : `${rendered}>`;
}

/**
 * Filter author HTML down to safe formatting markup.
 *
 * @param html - Author-written HTML from the activity data
 * @returns Sanitised HTML, or '' for empty input
 */
export function sanitizeHtml(html: string | null | undefined): string {
    if (!html) return '';

    // Strip the sentinel up front so author text can never be mistaken for a placeholder.
    let output = html.split(MARKER).join('');

    // Comments can hide markup from the tag scanner below.
    output = output.replace(/<!--[\s\S]*?-->/g, '');

    // Drop dangerous elements together with their contents, including unterminated ones.
    for (const tag of STRIPPED_WITH_CONTENT) {
        output = output.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
        output = output.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '');
    }

    // Rebuild allowed tags and unwrap the rest. Rebuilt tags are parked behind placeholders so the
    // malformed-markup sweep below cannot mistake them for input and strip them again.
    const kept: string[] = [];
    output = output.replace(
        /<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^>]*?)(\/?)\s*>/gi,
        (_match, slash, name, attrs, selfClose) => {
            const tagName = String(name).toLowerCase();
            if (!(tagName in ALLOWED_TAGS)) return '';

            const rebuilt = rebuildTag(tagName, String(attrs), slash === '/', selfClose === '/');
            if (!rebuilt) return '';

            kept.push(rebuilt);
            return `${MARKER}${kept.length - 1}${MARKER}`;
        },
    );

    // Anything still looking like a tag was malformed; drop the angle brackets so it renders as
    // text instead of being re-parsed as markup.
    output = output.replace(/<[^>]*>?/g, '');

    return output.replace(new RegExp(`${MARKER}(\\d+)${MARKER}`, 'g'), (_match, index) => kept[Number(index)]).trim();
}

/**
 * Escape plain text for safe embedding in HTML.
 *
 * Used for values an iDevice stores and renders as text, so that a `<` an author typed shows up
 * as a `<` on paper instead of being parsed as a tag.
 *
 * @param text - Plain text
 * @returns HTML-escaped text, or '' for empty input
 */
export function escapeText(text: string | null | undefined): string {
    if (!text) return '';

    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Reduce HTML to its visible text, collapsing whitespace.
 *
 * Used where markup makes no sense on paper, such as the plain-text question prompts.
 *
 * @param html - HTML fragment
 * @returns Plain text, or '' for empty input
 */
export function htmlToText(html: string | null | undefined): string {
    if (!html) return '';

    return sanitizeHtml(html)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
