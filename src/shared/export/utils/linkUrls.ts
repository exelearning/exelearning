/**
 * The addresses printed after external links.
 *
 * Paper cannot follow a link, so a printout writes each one's address after it, in CSS
 * (`a[href^="http"]::after`). Both the print preview and the worksheet do, with the same rules
 * (`LINK_URLS_CSS`). Neither writes it after a link whose text already is that address, nor after
 * one holding only a picture.
 */
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { nodeText } from '../worksheet/sanitizeHtml';

/**
 * Write each external link's address after it, on screen and on paper so that the preview
 * matches, except after the links `markLinksShowingTheirUrl` marks.
 */
export const LINK_URLS_CSS = `a[href^="http"]::after {
    content: " [" attr(href) "]";
    font-size: 0.85em;
    word-break: break-all;
    color: #666;
}
a[href^="http"][data-exe-text-is-url]::after,
a[href^="http"][data-exe-image-link]::after {
    content: none;
}`;

/** What a link start tag is marked with, if its link needs no address after it. */
type LinkMark = 'data-exe-text-is-url' | 'data-exe-image-link' | null;

/**
 * Mark the external links whose text already is their address, so that it is not written
 * after them a second time, and those holding only a picture, which it is not written after.
 *
 * CSS cannot compare a link's text with its href, so the HTML says it. Both are compared as
 * the reader sees them, entities and percent-encoding decoded. The protocol, a trailing slash
 * and the letter case of the host may differ: "Example.com" is the address of
 * "https://example.com/". The rest may not, since a path or a query can tell two addresses
 * apart by case alone. Nor can CSS see the words beside a picture (`img:only-child` counts
 * elements only), so a link with both would lose its address.
 *
 * The links are found in the parsed document, not by a pattern, which would take an anchor
 * never closed, or a "<a" in a script, for a link. Only the start tags are written to, at the
 * places the parser read them from, so the rest of the document is left as it was.
 *
 * @param html - A whole document
 * @returns The document, with `data-exe-text-is-url` or `data-exe-image-link` on each of those links
 */
export function markLinksShowingTheirUrl(html: string): string {
    const bare = (url: string) => {
        const address = url
            .trim()
            .replace(/^https?:\/\//i, '')
            .replace(/\/$/, '');
        const hostEnd = address.search(/[/?#]/);
        const host = hostEnd < 0 ? address.toLowerCase() : address.slice(0, hostEnd).toLowerCase();
        const rest = hostEnd < 0 ? '' : address.slice(hostEnd);
        try {
            return host + decodeURI(rest);
        } catch {
            return host + rest;
        }
    };

    const holdsPicture = (node: DefaultTreeAdapterMap['node']): boolean =>
        node.nodeName === 'img' || ('childNodes' in node && node.childNodes.some(holdsPicture));

    const markByStart = new Map<number, LinkMark>();
    const visit = (node: DefaultTreeAdapterMap['node']) => {
        if (node.nodeName === 'a' && 'attrs' in node) {
            const href = node.attrs.find(attribute => attribute.name === 'href')?.value ?? '';
            const start = node.sourceCodeLocation?.startTag?.startOffset;
            if (start !== undefined && /^https?:\/\//i.test(href)) {
                const text = nodeText(node);
                let mark: LinkMark = null;
                if (bare(text) === bare(href)) mark = 'data-exe-text-is-url';
                else if (text.trim() === '' && holdsPicture(node)) mark = 'data-exe-image-link';
                // Malformed HTML can produce several anchors from one start tag. An attribute
                // inserted there reaches every copy, so all must be marked alike.
                markByStart.set(start, !markByStart.has(start) || markByStart.get(start) === mark ? mark : null);
            }
        }
        if ('childNodes' in node) for (const child of node.childNodes) visit(child);
        if ('content' in node) visit(node.content);
    };
    visit(parse(html, { sourceCodeLocationInfo: true }));

    const marks = [...markByStart]
        .filter((entry): entry is [number, Exclude<LinkMark, null>] => entry[1] !== null)
        .sort(([a], [b]) => a - b);
    if (marks.length === 0) return html;

    // Slice only the original source and join once. Rebuilding the whole document for each
    // insertion makes previews with many links take time proportional to links times HTML size.
    const parts: string[] = [];
    let cursor = 0;
    for (const [start, mark] of marks) {
        const insertion = start + 2;
        parts.push(html.slice(cursor, insertion), ` ${mark}`);
        cursor = insertion;
    }
    parts.push(html.slice(cursor));
    return parts.join('');
}
