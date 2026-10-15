/**
 * YouTube adapter over the raw widget wire protocol (the same postMessage
 * handshake the official IFrame API uses), against the privacy-enhanced
 * youtube-nocookie.com embed. No SDK script is ever loaded.
 */

import { createFrameAdapter } from './frame-adapter';
import { isHttpOrigin, locationOrigin } from './origins';
import type { PlaybackState, ProviderAdapter } from './types';

export const YT_ORIGIN = 'https://www.youtube-nocookie.com';

/** Canonical, controllable embed URL for a YouTube video id. */
export function youTubeEmbedUrl(videoId: unknown): string {
    const id = encodeURIComponent(videoId == null ? '' : String(videoId));
    let url = YT_ORIGIN + '/embed/' + id + '?enablejsapi=1&rel=0';
    const origin = locationOrigin();
    // The YouTube API rejects the handshake unless `origin` matches a real
    // http(s) page origin; omit it in opaque/file: contexts where it is 'null'.
    if (isHttpOrigin(origin)) {
        url += '&origin=' + encodeURIComponent(origin);
    }
    return url;
}

/** Map a YouTube playerState code to the shared state vocabulary (else null). */
function ytState(code: unknown): PlaybackState | null {
    if (code === 1) {
        return 'playing';
    }
    if (code === 2) {
        return 'paused';
    }
    if (code === 0) {
        return 'ended';
    }
    return null;
}

export function createYouTubeAdapter(iframe: HTMLIFrameElement, options?: { timeout?: number }): ProviderAdapter {
    return createFrameAdapter(iframe, options, {
        handshake(post) {
            // The undocumented-but-stable wire handshake the IFrame API uses.
            post({ event: 'listening', id: '', channel: 'widget' });
        },
        command(kind, value) {
            if (kind === 'play') {
                return { event: 'command', func: 'playVideo', args: [], id: '', channel: 'widget' };
            }
            if (kind === 'pause') {
                return { event: 'command', func: 'pauseVideo', args: [], id: '', channel: 'widget' };
            }
            return { event: 'command', func: 'seekTo', args: [value, true], id: '', channel: 'widget' };
        },
        onData(adapter, data) {
            const info = data.info;
            if (data.event === 'onReady' || data.event === 'initialDelivery' || data.event === 'infoDelivery') {
                adapter.emitReady();
            }
            if (info && typeof info === 'object' && !Array.isArray(info)) {
                const payload = info as Record<string, unknown>;
                if (typeof payload.duration === 'number' && isFinite(payload.duration)) {
                    adapter.duration = payload.duration;
                }
                if (typeof payload.currentTime === 'number') {
                    adapter.emitTime(payload.currentTime);
                }
                if (typeof payload.playerState === 'number') {
                    adapter.emitState(ytState(payload.playerState));
                }
            }
            if (data.event === 'onStateChange') {
                // onStateChange carries the numeric state directly in `info`.
                adapter.emitState(ytState(typeof data.info === 'number' ? data.info : NaN));
            }
        },
    });
}
