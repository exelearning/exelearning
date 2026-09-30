/**
 * Hosts whose cross-origin iframe we trust to render inline in the sanitized
 * preview.
 *
 * Mostly video providers, plus institutional media libraries that also serve
 * documents from the same host (see `mediateca.educa.madrid.org` below), which
 * is why the match is by host rather than by path — and why this is named for
 * the question it answers ("do we trust this embed?") rather than for "video".
 *
 * Single source of truth for that question on the editor side, reused by:
 *   - the preview trust-boundary sanitizer (`previewContentPolicy.js`), so a
 *     trusted iframe plays inline in the filtered preview without the "allow"
 *     gate — it is cross-origin, hence isolated from the editor by the
 *     same-origin policy; and
 *   - the opaque-enabled external-media fallback
 *     (`previewExternalMediaFallback.js`), which swaps those iframes for an
 *     "open in a new tab" placeholder when the embed relay is unavailable,
 *     because an opaque origin cannot satisfy the providers' embedder checks.
 *
 * Host matching is exact or subdomain-suffix, computed from the parsed URL
 * hostname, so look-alikes such as `youtube.com.evil.com` or `evil-vimeo.com`
 * are rejected. `player.vimeo.com` is covered by the `.vimeo.com` suffix.
 */

export const TRUSTED_EMBED_HOSTS = [
    'youtube.com',
    'youtube-nocookie.com',
    'youtu.be',
    'vimeo.com',
    'dailymotion.com',
    'dai.ly',
    // Regional education media library, already a first-class provider in the
    // canonical embed relay (exe_embed_bridge/exe_embed_relay.js). Trusted as a
    // whole host, not just its `/video/` paths, because the same library serves
    // the `/documentos/` embeds authors put next to their videos.
    'mediateca.educa.madrid.org',
];

/** True when the URL's hostname is a trusted embed-provider host. */
export function isTrustedEmbedUrl(url) {
    if (typeof url !== 'string' || !url.trim()) return false;
    let parsed;
    try {
        parsed = new URL(url, 'https://placeholder.invalid');
    } catch {
        return false;
    }
    // Reject credentials in the authority, e.g. https://evil.com@youtube.com/ —
    // they read as the provider while the request goes elsewhere. The canonical
    // relay refuses them too (exe_embed_relay.js).
    if (parsed.username || parsed.password) return false;
    const hostname = parsed.hostname.toLowerCase();
    return TRUSTED_EMBED_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`));
}
