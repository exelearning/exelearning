/**
 * Turn the author's external embeds into geometry placeholders, and report where they
 * are so the trusted host can render the real player over them.
 *
 * The placeholder carries `{provider, resourceId}` for a recognised provider and never
 * the final URL: the host rebuilds that from the canonical registry, so an author URL
 * does not cross the trust boundary for anything the registry knows. Unknown embeds fall
 * back to reporting the URL, which the host still re-validates.
 *
 * In a sandboxed document the scanner can also build a FACADE (ADR-2199-16): an embed the
 * registry does not know becomes a placeholder that carries a link to it. Unlike a bare
 * placeholder it is usable with no host at all, so it may be built before the handshake;
 * a host that accepts the embed still overlays its player on the same geometry.
 */
import { parseExternalMedia } from '../providers/registry';
import { contentBase, isCrossOriginHttps, isPdfUrl, isPromotable, type RuntimeWindow } from './environment';

export const EMBED_ID_ATTR = 'data-exe-embed-id';
export const EMBED_URL_ATTR = 'data-exe-embed-url';
export const EMBED_PROVIDER_ATTR = 'data-exe-embed-provider';
export const EMBED_RESOURCE_ATTR = 'data-exe-embed-object-id';
/** Marks a placeholder that carries its own link (ADR-2199-16). */
export const EMBED_FACADE_ATTR = 'data-exe-embed-facade';

/** English source of the facade label; exports translate it through `$exe_i18n`. */
export const FACADE_LABEL_FALLBACK = 'View content from %s';
/** The `$exe_i18n` key, declared with `c_()` in `public/app/common/common_i18n.js`. */
export const FACADE_LABEL_KEY = 'viewContentFrom';

/** The extra window surface the facade reads; both optional, so tests stay honest. */
interface ScannerWindow extends RuntimeWindow {
    $exe_i18n?: Record<string, string>;
    getComputedStyle?(node: Element): { position?: string } | null;
}

export interface PromoteOptions {
    /** Give embeds the registry does not know a link to themselves (sandboxed documents). */
    facade?: boolean;
    /** Touch ONLY those embeds: what may run before a host has answered. */
    facadeOnly?: boolean;
}

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
 * Whether an embed gets a facade: cross-origin https that is neither a PDF nor a
 * provider the registry knows. Those two keep waiting for a host, which renders them
 * properly; for anything else a link is the best a sandboxed document can offer.
 */
export function isFacadeCandidate(src: string, base: string | undefined): boolean {
    // `isCrossOriginHttps` has already parsed the URL, so this one cannot throw.
    if (!isCrossOriginHttps(src, base) || isPdfUrl(src, base)) return false;
    return !parseExternalMedia(new URL(src, base).href);
}

/** The facade label in the content language, falling back to English. */
export function facadeLabel(win: ScannerWindow, host: string): string {
    const translated = win.$exe_i18n?.[FACADE_LABEL_KEY];
    return (typeof translated === 'string' && translated ? translated : FACADE_LABEL_FALLBACK).replace('%s', host);
}

/** Whether the author positioned the iframe over its container (responsive snippets). */
function isPositioned(frame: Element, win: ScannerWindow): boolean {
    let position = '';
    try {
        position = win.getComputedStyle?.(frame)?.position ?? '';
    } catch {
        position = '';
    }
    if (!position) position = (frame as HTMLElement).style?.position ?? '';
    return position === 'absolute' || position === 'fixed';
}

/** `url` is the absolute URL of a facade candidate, which always parses. */
function appendFacadeLink(maker: Document, placeholder: Element, url: string, win: ScannerWindow): void {
    const host = new URL(url).hostname;
    const anchor = maker.createElement('a');
    anchor.setAttribute('href', url);
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
    anchor.textContent = facadeLabel(win, host);
    const style = (anchor as HTMLElement).style;
    if (style) {
        style.color = '#fff';
        style.textDecoration = 'underline';
        style.fontWeight = '600';
        style.padding = '1em';
    }
    placeholder.setAttribute(EMBED_FACADE_ATTR, '');
    const box = (placeholder as HTMLElement).style;
    box.display = 'flex';
    box.alignItems = 'center';
    box.justifyContent = 'center';
    box.textAlign = 'center';
    placeholder.appendChild(anchor);
}

/**
 * Replace every promotable iframe under `root` with a same-size placeholder.
 *
 * Callers must not invoke this before a host has answered the handshake: a placeholder
 * only the host can fill is a permanent black box if no host exists (ADR-2199-08). The
 * one exception is `facadeOnly`, whose placeholders carry their own link (ADR-2199-16).
 */
export function promote(
    root: ParentNode & { ownerDocument?: Document | null },
    counter: ScanCounter,
    win: ScannerWindow,
    options: PromoteOptions = {},
): Element[] {
    const base = contentBase(win);
    const maker = (root.ownerDocument ?? (root as unknown as Document)) as Document;
    const created: Element[] = [];

    for (const frame of Array.from(root.querySelectorAll('iframe[src]'))) {
        if (frame.getAttribute(EMBED_ID_ATTR)) continue;
        const src = frame.getAttribute('src');
        if (!src || !isPromotable(src, base)) continue;
        const facade = !!options.facade && isFacadeCandidate(src, base);
        if (options.facadeOnly && !facade) continue;

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
        if (isPositioned(frame, win)) {
            // Take the iframe's place over its container: in flow, the placeholder would
            // fall below a zero-height box and be clipped by its overflow.
            style.position = 'absolute';
            style.top = '0';
            style.left = '0';
            style.width = '100%';
            style.height = '100%';
        } else {
            style.width = cssSize(frame.getAttribute('width'), `${rect.width || 0}px`);
            style.height = cssSize(frame.getAttribute('height'), `${rect.height || 0}px`);
        }
        style.background = '#000';
        if (facade) appendFacadeLink(maker, placeholder, absolute, win);

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
