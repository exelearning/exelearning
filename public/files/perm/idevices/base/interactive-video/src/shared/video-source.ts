/**
 * Video source classification and URL normalization.
 *
 * External providers are treated as untrusted cross-origin: we store only
 * `{provider, videoId}` and rebuild canonical HTTPS URLs, never trusting an
 * author-supplied embed URL verbatim (see the changes/2147-interactive-video-refactor design, Security principles).
 */

import type { NormalizedVideoSource, ProviderId } from './types';

/** Extract an 11-char YouTube id from watch/youtu.be/embed/shorts URLs, else null. */
export function parseYouTubeId(url: unknown): string | null {
    if (typeof url !== 'string') {
        return null;
    }
    const match = url.match(
        /(?:youtu\.be\/|\/embed\/|\/shorts\/|\/v\/|watch\?v=|[?&]v=)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/,
    );
    return match?.[1] ?? null;
}

/** Extract a 6-12 digit Vimeo id from vimeo.com / player.vimeo.com URLs, else null. */
export function parseVimeoId(url: unknown): string | null {
    if (typeof url !== 'string') {
        return null;
    }
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d{6,12})(?!\d)/);
    return match?.[1] ?? null;
}

/** Extract the id from an EducaMadrid mediateca video URL (http or https), else null. */
export function parseMediatecaId(url: unknown): string | null {
    if (typeof url !== 'string') {
        return null;
    }
    const match = url.match(/^https?:\/\/mediateca\.educa\.madrid\.org\/video\/([^?#/]+)/);
    return match?.[1] ?? null;
}

/**
 * Providers whose video plays in a native `<video>` element (and can therefore
 * carry `<track>` captions), as opposed to a cross-origin iframe embed.
 */
export function isNativeProvider(provider: string | null | undefined): boolean {
    return provider === 'local' || provider === 'mediateca';
}

/**
 * Reject URLs whose scheme can execute script or smuggle markup. Everything
 * else (https, protocol-relative, relative, resources/, asset://) is allowed;
 * https is enforced separately at normalization time for external providers.
 */
export function isSafeVideoUrl(url: unknown): url is string {
    if (typeof url !== 'string' || url.trim() === '') {
        return false;
    }
    return !/^(?:javascript|data|vbscript):/i.test(url.trim());
}

/**
 * Produce a declarative `{provider, videoId, url}` descriptor from a source
 * URL. External providers get an https-forced canonical URL rebuilt from the
 * parsed id; local sources keep their reference. Unsafe URLs return null so
 * the caller can surface a friendly error.
 */
export function normalizeVideoSource(url: unknown): NormalizedVideoSource | null {
    if (!isSafeVideoUrl(url)) {
        return null;
    }
    const mediatecaId = parseMediatecaId(url);
    if (mediatecaId) {
        return {
            provider: 'mediateca',
            videoId: mediatecaId,
            url: 'https://mediateca.educa.madrid.org/video/' + mediatecaId,
        };
    }
    const youtubeId = parseYouTubeId(url);
    if (youtubeId) {
        return {
            provider: 'youtube',
            videoId: youtubeId,
            url: 'https://www.youtube.com/watch?v=' + youtubeId,
        };
    }
    const vimeoId = parseVimeoId(url);
    if (vimeoId) {
        return {
            provider: 'vimeo',
            videoId: vimeoId,
            url: 'https://player.vimeo.com/video/' + vimeoId,
        };
    }
    return { provider: 'local', videoId: null, url: url };
}
