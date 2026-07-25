/**
 * Shared allowlist of trusted external embed-provider hosts.
 *
 * Mostly video providers, plus institutional media libraries that also serve
 * documents from the same host (see `mediateca.educa.madrid.org` below), which
 * is why the match is by host rather than by path.
 *
 * Single source of truth for "is this iframe `src` a known provider?",
 * reused by:
 *   - the preview trust-boundary sanitizer (`previewContentPolicy.js`), so a
 *     provider iframe plays inline in the filtered preview without the "allow"
 *     gate — it is cross-origin, hence isolated from the editor by the
 *     same-origin policy; and
 *   - the opaque-enabled external-media fallback
 *     (`previewExternalMediaFallback.js`), which swaps provider iframes for an
 *     "open in a new tab" placeholder because an opaque origin cannot satisfy
 *     the providers' embedder-identity checks.
 *
 * Host matching is exact or subdomain-suffix, computed from the parsed URL
 * hostname, so look-alikes such as `youtube.com.evil.com` or `evil-vimeo.com`
 * are rejected. `player.vimeo.com` is covered by the `.vimeo.com` suffix.
 */

export const VIDEO_PROVIDER_HOSTS = [
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

/** True when the URL's hostname is a trusted external embed-provider host. */
export function isVideoProviderUrl(url) {
    if (typeof url !== 'string' || !url.trim()) return false;
    let hostname;
    try {
        hostname = new URL(url, 'https://placeholder.invalid').hostname.toLowerCase();
    } catch {
        return false;
    }
    return VIDEO_PROVIDER_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`));
}
