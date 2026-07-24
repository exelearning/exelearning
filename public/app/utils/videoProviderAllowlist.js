/**
 * Shared allowlist of external video-provider hosts.
 *
 * Single source of truth for "is this iframe `src` a known video provider?",
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
];

/** True when the URL's hostname is a known external video-provider host. */
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
