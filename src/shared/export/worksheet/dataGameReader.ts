/** Read DataGame payloads and current media sidecars with HTML5 semantics. */
import { parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { decryptDataGame } from '../utils/dataGameCipher';
import { nodeText } from './sanitizeHtml';

/**
 * The sidecar link classes an iDevice can key its media by.
 *
 * The `Back` pair belongs to the activities whose cards have two faces — Relate stores a picture
 * for each side of a pair, and keys them under `-LinkImages` and `-LinkImagesBack` with the same
 * card index in both.
 */
export type MediaLinkKind = 'Images' | 'Audios' | 'ImagesBack' | 'AudiosBack';
type Element = DefaultTreeAdapterMap['element'];

function elements(html: string, tagName: string, className: string, sourceLocations = false): Element[] {
    const found: Element[] = [];
    const visit = (node: DefaultTreeAdapterMap['node']) => {
        if (
            'tagName' in node &&
            node.tagName === tagName &&
            node.attrs.some(
                attr =>
                    attr.name === 'class' && attr.value.toLowerCase().split(/\s+/).includes(className.toLowerCase()),
            )
        )
            found.push(node);
        if ('childNodes' in node) node.childNodes.forEach(visit);
    };
    visit(parseFragment(html || '', { sourceCodeLocationInfo: sourceLocations }));
    return found;
}

/**
 * Rich text sidecars keyed by the index they carry, one per question.
 *
 * Some iDevices keep a question's text outside the payload, in a hidden div per question tagged
 * with `data-id`. That copy is the one that counts: the export pipeline can see it, so its
 * `asset://` references have been rewritten and any picture in it still resolves, while the copy
 * inside the payload was never reachable and has gone stale.
 *
 * @param html - The component's stored HTML
 * @param className - Class the sidecar divs carry
 * @returns The inner HTML of each, by the index in its `data-id`
 */
export function extractKeyedDivContent(html: string, className: string): Map<number, string> {
    const found = new Map<number, string>();

    for (const node of elements(html, 'div', className)) {
        const key = node.attrs.find(attr => attr.name === 'data-id')?.value ?? '';
        const index = /^\d+$/.test(key.trim()) ? Number(key.trim()) : -1;
        if (index >= 0 && !found.has(index)) found.set(index, serialize(node));
    }

    return found;
}

/** Current rich text sidecar, including nested elements and decoded/re-serialized attributes. */
export function extractDivContent(html: string, className: string): string {
    const node = elements(html, 'div', className)[0];
    return node ? serialize(node) : '';
}

/** Encrypted and legacy plaintext payloads; malformed input is reported by the caller. */
export function extractDataGame<T = Record<string, unknown>>(html: string, prefix: string): T | null {
    const node = elements(html, 'div', `${prefix}-DataGame`, true)[0];
    const raw = node ? nodeText(node).trim() : '';
    // Legacy JSON can contain literal HTML. textContent would remove that markup, while
    // serializing it would rewrite the quotes inside JSON strings. Keep the original source.
    const location = node?.sourceCodeLocation;
    const source = location?.startTag
        ? html.slice(location.startTag.endOffset, location.endTag?.startOffset ?? html.length).trim()
        : '';
    for (const candidate of [decryptDataGame(raw), source, raw]) {
        if (!candidate) continue;
        try {
            const value = JSON.parse(candidate);
            if (value && typeof value === 'object' && !Array.isArray(value)) return value as T;
        } catch {
            /* Try the legacy representation. */
        }
    }
    return null;
}

export function extractLinkHref(html: string, className: string): string {
    return elements(html, 'a', className)[0]?.attrs.find(attr => attr.name === 'href')?.value ?? '';
}

export function extractMediaLinks(html: string, prefix: string, kind: MediaLinkKind): Map<number, string> {
    return extractMediaLinksByClass(html, `${prefix}-Link${kind}`);
}

/**
 * The same sidecar rule, for an iDevice whose link class is not built from prefix and kind.
 *
 * Sort keys its links twice over — the class carries the round, `ordena-LinkImages-0`, and the
 * link text the card within it — so it names the class itself rather than having one composed.
 *
 * @param html - The component's stored HTML
 * @param className - Class the sidecar links carry
 * @returns Href by index, as read from each link's text
 */
export function extractMediaLinksByClass(html: string, className: string): Map<number, string> {
    const links = new Map<number, string>();
    for (const node of elements(html, 'a', className)) {
        const href = node.attrs.find(attr => attr.name === 'href')?.value ?? '';
        const text = nodeText(node).trim();
        const index = /^\d+$/.test(text) ? Number(text) : -1;
        if (href && Number.isSafeInteger(index) && index >= 0) links.set(index, href);
    }
    return links;
}
