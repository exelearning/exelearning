/**
 * The trusted side's decision about what may be loaded into a promoted player.
 *
 * This is the security core of the host half, so it is deliberately pure: it takes the
 * host's own location as a parameter rather than reading a global, and returns a verdict
 * rather than touching the DOM. Everything here is unit-testable without a browser.
 *
 * Ported faithfully from the shipped `exe_embed_relay.js` — ADR-0020 Step 1 requires
 * equivalence, so known policy *changes* are deliberately NOT folded in here. In
 * particular the remote-PDF question raised in Phase 0 (§7.2 of the design brief: a
 * server may answer `text/html` to a URL ending in `.pdf`) is left exactly as it ships
 * today, to be decided on its own terms rather than smuggled in under a refactor.
 */
import { getProvider } from '../providers/registry';

export type EmbedKind = 'video' | 'pdf';

export interface EmbedVerdict {
    url: string;
    kind: EmbedKind;
    /** True only for a PDF belonging to this package, served from the host's origin. */
    sameOrigin?: boolean;
}

export interface HostLocation {
    /** The trusted page's origin, e.g. `https://lms.example`. */
    origin: string;
    /** The trusted page's hostname, e.g. `lms.example`. */
    hostname: string;
}

export interface ValidateOptions {
    /** Strict mode: a maintained host allowlist instead of the structural invariant. */
    strict?: boolean;
    /** Lowercased host allowlist, used only in strict mode. */
    allowlist?: readonly string[];
}

/** Lowercase and strip a single trailing dot: `host.` is the same vhost as `host`. */
export function normalizeHost(host: string): string {
    return (host || '').toLowerCase().replace(/\.$/, '');
}

/**
 * IP literals and loopback/local names. These are cross-origin to the host page yet
 * point at the machine or the internal network, so they are refused even though the
 * same-origin policy would isolate them.
 */
export function isIpOrLocalHost(host: string): boolean {
    if (!host) return true;
    if (host === 'localhost' || /\.localhost$/.test(host) || /\.local$/.test(host)) return true;
    if (host.startsWith('[') || host.includes(':')) return true; // IPv6, bracketed
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
    return false;
}

/**
 * Whether `host` equals, is a subdomain of, or is a superdomain of the host page's own
 * host. Such hosts may share its cookies, so they are refused. The dotted boundary stops
 * `evil-lms.example` matching `lms.example`.
 */
export function isRelatedToHost(host: string, hostPageHost: string): boolean {
    const a = normalizeHost(host);
    const b = normalizeHost(hostPageHost);
    if (!b) return false;
    return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

/**
 * The structural invariant of open mode: https, cross-origin to the host page, not a
 * sub/superdomain of it, not an IP or local name, no userinfo.
 *
 * This is the only attacker-influenced gate in open mode, and it is what makes the
 * promoted player's `allow-same-origin` safe — the embed keeps ITS OWN origin, which the
 * same-origin policy isolates from the host page.
 */
export function isCrossOriginHttps(url: URL, location: HostLocation): boolean {
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    if (url.origin === location.origin) return false;
    const host = normalizeHost(url.hostname);
    if (isIpOrLocalHost(host)) return false;
    if (isRelatedToHost(host, location.hostname)) return false;
    return true;
}

/** Directory portion of the content iframe's src (everything up to the last `/`). */
export function contentDir(src: string): string {
    try {
        return new URL(src).href.replace(/[^/]*([?#].*)?$/, '');
    } catch {
        return '';
    }
}

/** Long hex token shared by a content URL and its extracted assets, when there is one. */
export function packageId(src: string): string | null {
    return String(src).match(/[a-f0-9]{12,}/i)?.[0] ?? null;
}

/**
 * Whether a same-origin URL is one of this package's own extracted files: under the
 * content's own directory, or carrying the package hash as a path segment.
 */
export function isSameOriginPackageFile(url: URL, contentSrc: string): boolean {
    const dir = contentDir(contentSrc);
    if (dir && url.href.startsWith(dir)) return true;
    const id = packageId(contentSrc);
    return !!(id && url.pathname.includes(`/${id}/`));
}

/**
 * Decide whether a reported embed may be promoted, and to what.
 *
 * @param raw        The ABSOLUTE URL the content reported. Parsed with no base: a
 *                   relative or scheme-relative value would otherwise inherit the host
 *                   page's origin and pass as same-origin; here it throws and is refused.
 * @param contentSrc The src of the content iframe that reported it.
 */
export function validate(
    raw: string,
    contentSrc: string,
    location: HostLocation,
    options: ValidateOptions = {},
): EmbedVerdict | null {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }
    // Reject userinfo, e.g. https://evil.example@youtube.com/.
    if (url.username || url.password) return null;

    if (/\.pdf$/i.test(url.pathname)) {
        if (url.origin === location.origin) {
            return isSameOriginPackageFile(url, contentSrc) ? { url: url.href, kind: 'pdf', sameOrigin: true } : null;
        }
        return isCrossOriginHttps(url, location) ? { url: url.href, kind: 'pdf' } : null;
    }

    if (options.strict) {
        const host = normalizeHost(url.hostname);
        // An OMITTED allowlist means "the maintained providers", and the registry below is
        // already that list — so the gate is skipped and the provider loop decides. An
        // explicitly empty array is a different statement ("promote nothing") and is
        // honoured as written. Requiring every embedder to restate hosts the bundle
        // already knows made an omitted argument silently disable all video: geometry
        // still arrives, the overlay is still created, and it stays empty forever.
        if (options.allowlist && !options.allowlist.includes(host)) return null;
        if (url.protocol !== 'https:') return null;
        // In strict mode the URL is rebuilt from the canonical registry, so an allowed
        // host can still only ever produce that provider's canonical embed URL.
        for (const providerId of ['youtube', 'vimeo', 'dailymotion', 'mediateca-madrid']) {
            const provider = getProvider(providerId);
            if (!provider?.hosts.some(candidate => host === candidate || host.endsWith(`.${candidate}`))) continue;
            const resource = provider.parse(url);
            if (!resource) return null;
            const canonical = provider.buildCanonicalEmbedUrl(resource.resourceId);
            return canonical ? { url: canonical, kind: 'video' } : null;
        }
        return null;
    }

    return isCrossOriginHttps(url, location) ? { url: url.href, kind: 'video' } : null;
}
