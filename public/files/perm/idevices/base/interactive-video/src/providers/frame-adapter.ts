/**
 * Shared postMessage plumbing for iframe providers: one validated `message`
 * listener, a bounded-timeout `load()`, and command posting to the exact
 * iframe origin. Provider specifics (handshake, command shapes, event
 * decoding) are injected through `FrameProviderSpec`.
 *
 * Message handling is strictly validated (`event.source` must be this
 * iframe's own window AND `event.origin` its own origin), JSON is parsed
 * defensively, and each adapter installs exactly one `message` listener
 * removed in `destroy()` — so multiple instances on one page stay isolated.
 */

import { createBaseAdapter, DEFAULT_TIMEOUT_MS } from './callbacks';
import { originOf } from './origins';
import type { PlaybackState, ProviderAdapter } from './types';

export type FrameCommandKind = 'play' | 'pause' | 'seek';

/** The slice of the adapter a provider spec may drive from decoded messages. */
export interface FrameAdapterContext {
    duration: number | null;
    emitReady(): void;
    emitTime(seconds: unknown): void;
    emitState(state: PlaybackState | null): void;
    post(payload: object): void;
}

export interface FrameProviderSpec {
    /** Sent on iframe load and again when `load()` is called. */
    handshake(post: (payload: object) => void): void;
    /** Build the wire payload for a playback command. */
    command(kind: FrameCommandKind, value?: number): object;
    /** Decode one validated inbound message. */
    onData(adapter: FrameAdapterContext, data: Record<string, unknown>): void;
}

export function createFrameAdapter(
    iframe: HTMLIFrameElement,
    options: { timeout?: number } | undefined,
    spec: FrameProviderSpec,
): ProviderAdapter {
    const base = createBaseAdapter();
    const origin = originOf(iframe.src);
    const timeout = options && typeof options.timeout === 'number' ? options.timeout : DEFAULT_TIMEOUT_MS;
    let destroyed = false;

    function post(payload: object): void {
        if (destroyed || !iframe.contentWindow) {
            return;
        }
        try {
            iframe.contentWindow.postMessage(JSON.stringify(payload), origin);
        } catch {
            /* contentWindow gone / serialization failure — ignore */
        }
    }

    const context: FrameAdapterContext = {
        get duration() {
            return base.duration;
        },
        set duration(value) {
            base.duration = value;
        },
        emitReady: () => base.emitReady(),
        emitTime: seconds => {
            if (typeof seconds === 'number') {
                base.emitTime(seconds);
            }
        },
        emitState: state => base.emitState(state),
        post: post,
    };

    function onMessage(event: MessageEvent): void {
        if (destroyed) {
            return;
        }
        // Strict provenance: only this iframe's own window and origin.
        if (event.source !== iframe.contentWindow || event.origin !== origin) {
            return;
        }
        let data: unknown;
        try {
            data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch {
            return;
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return;
        }
        spec.onData(context, data as Record<string, unknown>);
    }

    const onLoad = (): void => {
        spec.handshake(post);
    };
    window.addEventListener('message', onMessage);
    iframe.addEventListener('load', onLoad);

    return {
        onTimeUpdate: base.onTimeUpdate,
        onStateChange: base.onStateChange,
        onReady: base.onReady,
        load() {
            return new Promise<void>((resolve, reject) => {
                // The iframe may already be loaded; handshake immediately too.
                spec.handshake(post);
                if (base.loaded) {
                    resolve();
                    return;
                }
                let settled = false;
                const timer = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        reject(new Error('interactive-video: provider load timeout'));
                    }
                }, timeout);
                base.readySubscribers.add(() => {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timer);
                        resolve();
                    }
                });
            });
        },
        play() {
            post(spec.command('play'));
        },
        pause() {
            post(spec.command('pause'));
        },
        seekTo(seconds) {
            if (isFinite(seconds)) {
                post(spec.command('seek', seconds));
            }
        },
        getCurrentTime() {
            return Promise.resolve(base.lastTime || 0);
        },
        getDuration() {
            return Promise.resolve(typeof base.duration === 'number' ? base.duration : null);
        },
        destroy() {
            destroyed = true;
            window.removeEventListener('message', onMessage);
            iframe.removeEventListener('load', onLoad);
            base.clearSubscribers();
        },
    };
}
