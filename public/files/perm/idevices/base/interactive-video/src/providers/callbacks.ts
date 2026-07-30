/**
 * Observer plumbing shared by every provider adapter: a tiny fan-out callback
 * registry and the base adapter that wires time/state/ready subscriptions.
 */

import type { PlaybackState } from './types';

export interface CallbackRegistry<T> {
    add(fn: ((arg: T) => void) | undefined | null): void;
    emit(arg: T): void;
    clear(): void;
}

/** A tiny fan-out callback registry; invocations are error-isolated. */
export function callbacks<T = void>(): CallbackRegistry<T> {
    const list: Array<(arg: T) => void> = [];
    return {
        add(fn) {
            if (typeof fn === 'function') {
                list.push(fn);
            }
        },
        emit(arg) {
            for (const fn of list) {
                try {
                    fn(arg);
                } catch {
                    /* one bad subscriber must not break the others */
                }
            }
        },
        clear() {
            list.length = 0;
        },
    };
}

/**
 * The mutable adapter under construction: subscription plumbing plus the
 * last-known time/duration the frame adapters cache from event payloads.
 * Concrete factories fill in the remaining `ProviderAdapter` methods.
 */
export interface BaseAdapter {
    lastTime: number;
    duration: number | null;
    loaded: boolean;
    onTimeUpdate(cb: (seconds: number) => void): void;
    onStateChange(cb: (state: PlaybackState) => void): void;
    onReady(cb: () => void): void;
    emitTime(seconds: number): void;
    emitState(state: PlaybackState | null): void;
    emitReady(): void;
    /** Registered ready callbacks, exposed for the frame adapter's load(). */
    readySubscribers: CallbackRegistry<void>;
    clearSubscribers(): void;
}

/** Shared observer plumbing (time/state/ready fan-out) for every adapter. */
export function createBaseAdapter(): BaseAdapter {
    const timeCbs = callbacks<number>();
    const stateCbs = callbacks<PlaybackState>();
    const readyCbs = callbacks<void>();
    const base: BaseAdapter = {
        lastTime: 0,
        duration: null,
        loaded: false,
        onTimeUpdate(cb) {
            timeCbs.add(cb);
        },
        onStateChange(cb) {
            stateCbs.add(cb);
        },
        onReady(cb) {
            readyCbs.add(cb);
            if (base.loaded && typeof cb === 'function') {
                try {
                    cb();
                } catch {
                    /* ignore */
                }
            }
        },
        emitTime(seconds) {
            if (typeof seconds === 'number' && isFinite(seconds)) {
                base.lastTime = seconds;
                timeCbs.emit(seconds);
            }
        },
        emitState(state) {
            if (state) {
                stateCbs.emit(state);
            }
        },
        emitReady() {
            if (!base.loaded) {
                base.loaded = true;
                readyCbs.emit();
            }
        },
        readySubscribers: readyCbs,
        clearSubscribers() {
            timeCbs.clear();
            stateCbs.clear();
            readyCbs.clear();
        },
    };
    return base;
}

/** Default handshake/load timeout for every adapter. */
export const DEFAULT_TIMEOUT_MS = 7000;
