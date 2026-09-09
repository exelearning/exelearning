/**
 * Origin helpers for the cross-origin frame adapters. Inbound messages are
 * validated against the iframe's own origin; outbound messages are posted to
 * that exact origin, never `*`.
 */

/** True only for real http(s) page origins (opaque/file: contexts are 'null'). */
export function isHttpOrigin(origin: unknown): boolean {
    return typeof origin === 'string' && /^https?:\/\//.test(origin);
}

/** The current page origin, defensively (may be 'null' under opaque sandboxes). */
export function locationOrigin(): string {
    try {
        return (typeof window !== 'undefined' && window.location && window.location.origin) || '';
    } catch {
        return '';
    }
}

/** The origin of an iframe's src, used to validate inbound messages. */
export function originOf(src: unknown): string {
    try {
        return new URL(String(src || ''), locationOrigin() || undefined).origin;
    } catch {
        return '';
    }
}
