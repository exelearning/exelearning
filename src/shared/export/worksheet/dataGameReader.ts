/** Read DataGame payloads and current media sidecars with HTML5 semantics. */
import { parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { decryptDataGame } from '../utils/dataGameCipher';
import { nodeText } from './sanitizeHtml';

export type MediaLinkKind = 'Images' | 'Audios';
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
    const links = new Map<number, string>();
    for (const node of elements(html, 'a', `${prefix}-Link${kind}`)) {
        const href = node.attrs.find(attr => attr.name === 'href')?.value ?? '';
        const text = nodeText(node).trim();
        const index = /^\d+$/.test(text) ? Number(text) : -1;
        if (href && Number.isSafeInteger(index) && index >= 0) links.set(index, href);
    }
    return links;
}
