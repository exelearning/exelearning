/**
 * The addresses printed after external links.
 *
 * Paper cannot follow a link, so a printout writes each one's address after it, in CSS
 * (`a[href^="http"]::after`). Both the print preview and the worksheet do. Neither should write it
 * after a link whose text already is that address.
 */
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { nodeText } from '../worksheet/sanitizeHtml';

/**
 * Mark the external links whose text already is their address, so that it is not written
 * after them a second time.
 *
 * CSS cannot compare a link's text with its href, so the HTML says it. Both are compared as
 * the reader sees them, entities and percent-encoding decoded. The protocol, a trailing slash
 * and the letter case of the host may differ: "Example.com" is the address of
 * "https://example.com/". The rest may not, since a path or a query can tell two addresses
 * apart by case alone.
 *
 * The links are found in the parsed document, not by a pattern, which would take an anchor
 * never closed, or a "<a" in a script, for a link. Only the start tags are written to, at the
 * places the parser read them from, so the rest of the document is left as it was.
 *
 * @param html - A whole document
 * @returns The document, with `data-exe-text-is-url` on each of those links
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

    const matchesByStart = new Map<number, boolean>();
    const visit = (node: DefaultTreeAdapterMap['node']) => {
        if (node.nodeName === 'a' && 'attrs' in node) {
            const href = node.attrs.find(attribute => attribute.name === 'href')?.value ?? '';
            const start = node.sourceCodeLocation?.startTag?.startOffset;
            if (start !== undefined && /^https?:\/\//i.test(href)) {
                // Malformed HTML can produce several anchors from one start tag. An attribute
                // inserted there reaches every copy, so all must already show their address.
                const matches = bare(nodeText(node)) === bare(href);
                matchesByStart.set(start, matchesByStart.get(start) !== false && matches);
            }
        }
        if ('childNodes' in node) for (const child of node.childNodes) visit(child);
        if ('content' in node) visit(node.content);
    };
    visit(parse(html, { sourceCodeLocationInfo: true }));

    const starts = [...matchesByStart]
        .filter(([, matches]) => matches)
        .map(([start]) => start)
        .sort((a, b) => a - b);
    if (starts.length === 0) return html;

    // Slice only the original source and join once. Rebuilding the whole document for each
    // insertion makes previews with many links take time proportional to links times HTML size.
    const parts: string[] = [];
    let cursor = 0;
    for (const start of starts) {
        const insertion = start + 2;
        parts.push(html.slice(cursor, insertion), ' data-exe-text-is-url');
        cursor = insertion;
    }
    parts.push(html.slice(cursor));
    return parts.join('');
}
