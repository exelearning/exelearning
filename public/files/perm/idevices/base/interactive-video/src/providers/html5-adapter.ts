/**
 * Native `<video>` adapter — also serves generic direct media URLs and, over a
 * derived stream URL, Mediateca. `load()` rejects on a media error so callers
 * can fall back (the Mediateca host may be unreachable).
 */

import { createBaseAdapter, DEFAULT_TIMEOUT_MS } from './callbacks';
import type { ProviderAdapter } from './types';

export function createLocalAdapter(video: HTMLVideoElement, options?: { timeout?: number }): ProviderAdapter {
    const base = createBaseAdapter();
    const timeout = options && typeof options.timeout === 'number' ? options.timeout : DEFAULT_TIMEOUT_MS;
    let destroyed = false;

    const onTime = (): void => {
        if (!destroyed) {
            base.emitTime(video.currentTime);
        }
    };
    const onPlay = (): void => {
        base.emitState('playing');
    };
    const onPause = (): void => {
        base.emitState('paused');
    };
    const onEnded = (): void => {
        base.emitState('ended');
    };

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    return {
        onTimeUpdate: base.onTimeUpdate,
        onStateChange: base.onStateChange,
        onReady: base.onReady,
        load() {
            return new Promise<void>((resolve, reject) => {
                if (video.error) {
                    reject(new Error('interactive-video: media error'));
                    return;
                }
                let settled = false;
                let timer: ReturnType<typeof setTimeout> | null = null;
                function cleanup(): void {
                    if (timer) {
                        clearTimeout(timer);
                    }
                    video.removeEventListener('loadedmetadata', ok);
                    video.removeEventListener('canplay', ok);
                    video.removeEventListener('error', fail);
                }
                function ok(): void {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    cleanup();
                    base.emitReady();
                    resolve();
                }
                function fail(): void {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    cleanup();
                    reject(new Error('interactive-video: media error'));
                }
                video.addEventListener('loadedmetadata', ok, { once: true });
                video.addEventListener('canplay', ok, { once: true });
                video.addEventListener('error', fail, { once: true });
                timer = setTimeout(ok, timeout);
                // Same-origin media needs no cross-origin handshake: resolve
                // optimistically on the next microtask. A media error dispatched
                // synchronously still wins the `settled` race (see the degrade
                // test).
                Promise.resolve().then(() => {
                    if (video.error) {
                        fail();
                    } else {
                        ok();
                    }
                });
            });
        },
        play() {
            try {
                const p = video.play();
                if (p && typeof p.catch === 'function') {
                    p.catch(() => {});
                }
            } catch {
                /* autoplay/gesture policies — ignore */
            }
        },
        pause() {
            try {
                video.pause();
            } catch {
                /* ignore */
            }
        },
        seekTo(seconds) {
            if (isFinite(seconds)) {
                try {
                    video.currentTime = seconds;
                } catch {
                    /* ignore */
                }
            }
        },
        getCurrentTime() {
            return Promise.resolve(video.currentTime || 0);
        },
        getDuration() {
            const d = video.duration;
            return Promise.resolve(typeof d === 'number' && isFinite(d) ? d : null);
        },
        destroy() {
            destroyed = true;
            video.removeEventListener('timeupdate', onTime);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ended', onEnded);
            base.clearSubscribers();
        },
    };
}
