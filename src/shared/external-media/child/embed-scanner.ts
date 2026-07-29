/**
 * Turn the author's external embeds into geometry placeholders, and report where they
 * are so the trusted host can render the real player over them.
 *
 * The placeholder carries `{provider, resourceId}` for a recognised provider and never
 * the final URL: the host rebuilds that from the canonical registry, so an author URL
 * does not cross the trust boundary for anything the registry knows. Unknown embeds fall
 * back to reporting the URL, which the host still re-validates.
 */
import { parseExternalMedia } from '../providers/registry';
import { contentBase, isPromotable, type RuntimeWindow } from './environment';

export const EMBED_ID_ATTR = 'data-exe-embed-id';
export const EMBED_URL_ATTR = 'data-exe-embed-url';
export const EMBED_PROVIDER_ATTR = 'data-exe-embed-provider';
export const EMBED_RESOURCE_ATTR = 'data-exe-embed-object-id';

export interface EmbedRecord {
    id: string;
    url: string;
    x: number;
    y: number;
    w: number;
    h: number;
    provider?: string;
    objectId?: string;
}

/** Mutable counter so ids stay unique across repeated scans of the same document. */
export interface ScanCounter {
    n: number;
}

/** Render a width/height attribute as a CSS length. */
function cssSize(value: string | null, fallback: string): string {
    if (!value) return fallback;
    return /^[0-9]+$/.test(value) ? `${value}px` : value;
}

/**
 * Replace every promotable iframe under `root` with a same-size placeholder.
 *
 * Callers must not invoke this before a host has answered the handshake: a placeholder
 * only the host can fill is a permanent black box if no host exists (ADR-0017).
 */
export function promote(
    root: ParentNode & { ownerDocument?: Document | null },
    counter: ScanCounter,
    win: RuntimeWindow,
): Element[] {
    const base = contentBase(win);
    const maker = (root.ownerDocument ?? (root as unknown as Document)) as Document;
    const created: Element[] = [];

    for (const frame of Array.from(root.querySelectorAll('iframe[src]'))) {
        if (frame.getAttribute(EMBED_ID_ATTR)) continue;
        const src = frame.getAttribute('src');
        if (!src || !isPromotable(src, base)) continue;

        const rect = frame.getBoundingClientRect?.() ?? { width: 0, height: 0 };
        const placeholder = maker.createElement('div');
        counter.n += 1;
        placeholder.setAttribute(EMBED_ID_ATTR, `exe-embed-${counter.n}`);

        // Report an ABSOLUTE url: only the child can resolve a relative src correctly,
        // because the host would resolve it against its own document instead.
        let absolute = src;
        try {
            absolute = new URL(src, base).href;
        } catch {
            absolute = src;
        }
        placeholder.setAttribute(EMBED_URL_ATTR, absolute);

        const resource = parseExternalMedia(absolute);
        if (resource) {
            placeholder.setAttribute(EMBED_PROVIDER_ATTR, resource.provider);
            placeholder.setAttribute(EMBED_RESOURCE_ATTR, resource.resourceId);
        }

        placeholder.className = frame.className;
        const style = (placeholder as HTMLElement).style;
        style.display = 'block';
        style.maxWidth = '100%';
        style.width = cssSize(frame.getAttribute('width'), `${rect.width || 0}px`);
        style.height = cssSize(frame.getAttribute('height'), `${rect.height || 0}px`);
        style.background = '#000';

        frame.parentNode?.replaceChild(placeholder, frame);
        created.push(placeholder);
    }
    return created;
}

/** Current geometry of every placeholder under `root`. */
export function collect(root: ParentNode): EmbedRecord[] {
    return Array.from(root.querySelectorAll(`[${EMBED_ID_ATTR}]`)).map(node => {
        const rect = node.getBoundingClientRect();
        const record: EmbedRecord = {
            id: node.getAttribute(EMBED_ID_ATTR) ?? '',
            url: node.getAttribute(EMBED_URL_ATTR) ?? '',
            x: rect.left,
            y: rect.top,
            w: rect.width,
            h: rect.height,
        };
        const provider = node.getAttribute(EMBED_PROVIDER_ATTR);
        const objectId = node.getAttribute(EMBED_RESOURCE_ATTR);
        if (provider && objectId) {
            record.provider = provider;
            record.objectId = objectId;
        }
        return record;
    });
}
