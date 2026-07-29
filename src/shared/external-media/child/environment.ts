/**
 * What the in-content runtime is allowed to conclude about where it is running.
 *
 * Every check here takes the window it is asked about rather than reading the global,
 * because the same code runs inside a preview snapshot, inside an exported package on
 * `file://`, and inside a unit test. Reading the global made the incumbent's URL helpers
 * compare an embed against the *editor's* host instead of the content's own — this
 * module exists partly so that cannot recur.
 */

/** The minimum surface the runtime needs from its window; keeps tests honest. */
export interface RuntimeWindow {
    parent: unknown;
    origin?: string;
    document?: { cookie?: string };
    location?: { href?: string };
}

/**
 * Whether the document runs in an opaque origin.
 *
 * In an opaque origin `window.origin` is the string `"null"` and cookie access throws.
 * **This is never sufficient to act on**: `file://` is also an opaque origin in every
 * engine, which is exactly how the incumbent came to destroy embeds in unhosted content
 * (ADR-0017). Promotion is gated on an answered handshake, not on this.
 */
export function isOpaqueOrigin(win: RuntimeWindow): boolean {
    try {
        void win.document?.cookie;
        return win.origin === 'null';
    } catch {
        // Cookie access throwing is itself the signal.
        return true;
    }
}

/** Whether this window is nested in another browsing context. */
export function isFramed(win: RuntimeWindow): boolean {
    try {
        return !!win && win.parent !== win;
    } catch {
        // A cross-origin parent throws on access, which means we are framed.
        return true;
    }
}

/**
 * The content document's own location, used both to resolve relative `src` values and
 * to decide what counts as same-host.
 */
export function contentBase(win: RuntimeWindow): string | undefined {
    return win.location?.href;
}

/**
 * Whether a `src` resolves to an https URL on a host other than the content's own.
 *
 * The own-host side is derived by PARSING the base rather than reading
 * `location.hostname`: a document can expose an `href` while leaving `hostname` unset,
 * and reading it blind throws — which the enclosing `try` would swallow as "not
 * cross-origin", silently disabling promotion altogether.
 */
export function isCrossOriginHttps(src: string, base: string | undefined): boolean {
    try {
        const url = new URL(src, base);
        if (url.protocol !== 'https:') return false;
        const host = url.hostname.toLowerCase().replace(/\.$/, '');
        // A trailing dot is the FQDN-root form of the same vhost, so strip it on both
        // sides or `host.` would read as cross-origin to `host`.
        const here = new URL(base ?? '').hostname.toLowerCase().replace(/\.$/, '');
        return host !== here;
    } catch {
        return false;
    }
}

/** Whether a URL path ends in `.pdf`; PDFs also fail to render under the sandbox. */
export function isPdfUrl(src: string, base: string | undefined): boolean {
    try {
        return /\.pdf$/i.test(new URL(src, base).pathname);
    } catch {
        return false;
    }
}

/**
 * Whether an iframe is a candidate for promotion: any cross-origin https embed, or a
 * PDF. There is deliberately no host list here — the trusted relay is the authoritative
 * gate, and duplicating its allowlist in untrusted content would only invite drift.
 */
export function isPromotable(src: string, base: string | undefined): boolean {
    return isCrossOriginHttps(src, base) || isPdfUrl(src, base);
}
