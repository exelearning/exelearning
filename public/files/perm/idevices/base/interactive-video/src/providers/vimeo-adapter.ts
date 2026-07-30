/**
 * Vimeo adapter over the raw player wire protocol (postMessage), against the
 * dnt-enabled player.vimeo.com embed. No SDK script is ever loaded.
 */

import { createFrameAdapter } from './frame-adapter';
import type { ProviderAdapter } from './types';

export const VIMEO_ORIGIN = 'https://player.vimeo.com';

/** Canonical, controllable embed URL for a Vimeo video id. */
export function vimeoEmbedUrl(videoId: unknown): string {
    const id = encodeURIComponent(videoId == null ? '' : String(videoId));
    return VIMEO_ORIGIN + '/video/' + id + '?dnt=1';
}

/** The player events the Vimeo adapter subscribes to. */
const VIMEO_EVENTS = ['ready', 'play', 'pause', 'finish', 'timeupdate'] as const;

function vimeoSubscribe(post: (payload: object) => void): void {
    for (const event of VIMEO_EVENTS) {
        post({ method: 'addEventListener', value: event });
    }
}

export function createVimeoAdapter(iframe: HTMLIFrameElement, options?: { timeout?: number }): ProviderAdapter {
    return createFrameAdapter(iframe, options, {
        handshake: vimeoSubscribe,
        command(kind, value) {
            if (kind === 'play') {
                return { method: 'play' };
            }
            if (kind === 'pause') {
                return { method: 'pause' };
            }
            return { method: 'setCurrentTime', value: value };
        },
        onData(adapter, data) {
            if (data.event === 'ready' || data.method === 'getDuration') {
                if (data.event === 'ready') {
                    adapter.emitReady();
                    // The player DISCARDS every addEventListener it receives
                    // before it announces `ready`, so the load-time handshake is
                    // a no-op on a cold embed and no event would ever arrive.
                    // Subscribing again here is what actually takes.
                    vimeoSubscribe(adapter.post);
                    adapter.post({ method: 'getDuration' });
                }
                if (typeof data.value === 'number' && isFinite(data.value)) {
                    adapter.duration = data.value;
                }
            }
            if (data.event === 'play') {
                adapter.emitState('playing');
            } else if (data.event === 'pause') {
                adapter.emitState('paused');
            } else if (data.event === 'finish') {
                adapter.emitState('ended');
            } else if (
                // `timeupdate` is the SDK-level name used when subscribing; on
                // the wire the player emits `playProgress`. Accept both so the
                // scheduler is fed whichever the player sends.
                (data.event === 'timeupdate' || data.event === 'playProgress') &&
                data.data &&
                typeof data.data === 'object' &&
                !Array.isArray(data.data)
            ) {
                const payload = data.data as Record<string, unknown>;
                if (typeof payload.duration === 'number' && isFinite(payload.duration)) {
                    adapter.duration = payload.duration;
                }
                if (typeof payload.seconds === 'number') {
                    adapter.emitTime(payload.seconds);
                }
            }
        },
    });
}
