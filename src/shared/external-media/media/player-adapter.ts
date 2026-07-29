/**
 * The DOM boundary of the media half: mount a player iframe, talk to it in its provider's
 * dialect, report back in neutral terms.
 *
 * It applies and never decides. The URL and the message shapes come from
 * `provider-dialects`, and what may be played at all was settled by the protocol schema
 * before a command ever reached here — so a mistake in this file can only be a wiring
 * mistake, which is what the browser tests cover.
 *
 * Two properties are structural rather than stylistic:
 *
 *  - inbound messages are matched by WINDOW IDENTITY. A page can hold several players and
 *    they all post to the same window; origin would not tell them apart, and is the wrong
 *    anchor everywhere else in this subsystem too.
 *  - outbound commands are addressed to the provider's origin, never `*`. Here we know
 *    exactly who we are talking to, so there is no reason to shout.
 *
 * There is no command buffering, and that is the dialects' doing rather than an omission:
 * the providers volunteer time and duration in their event stream, so `currentTime()` is
 * answered from cache instead of round-tripping, and commands sent before the player is
 * listening are simply lost — which is what "press play before it loaded" already means.
 */
import type { ProviderDialect } from './provider-dialects';

export interface PlayerCallbacks {
    ready?(duration?: number): void;
    play?(): void;
    pause?(): void;
    ended?(): void;
    error?(code: string): void;
    time?(currentTime?: number, duration?: number): void;
}

interface AdapterElement {
    setAttribute(name: string, value: string): void;
    addEventListener(type: string, listener: () => void): void;
    appendChild(node: unknown): void;
    style: Record<string, string>;
    parentNode?: { removeChild(node: unknown): void } | null;
    contentWindow?: { postMessage(message: unknown, targetOrigin: string): void } | null;
}

export interface MountPlayerOptions {
    container: AdapterElement;
    doc: { createElement(tag: string): AdapterElement };
    win: {
        addEventListener(type: string, listener: (event: unknown) => void): void;
        removeEventListener(type: string, listener: (event: unknown) => void): void;
    };
    dialect: ProviderDialect | null;
    videoId: string;
    /** The embedding page's origin, or '' when there is none to give. */
    origin: string;
    start?: number;
    autoplay?: boolean;
    on: PlayerCallbacks;
}

export interface PlayerAdapter {
    play(): void;
    pause(): void;
    seek(seconds: number): void;
    /** The last time the player volunteered. Synchronous by design; see the header. */
    currentTime(): number;
    duration(): number;
    destroy(): void;
}

/** YouTube's numeric player states. Vimeo names its events instead. */
const YOUTUBE_STATE = { ended: 0, playing: 1, paused: 2 } as const;

export function mountPlayer(options: MountPlayerOptions): PlayerAdapter | null {
    const { container, doc, win, dialect, videoId, origin, start, autoplay, on } = options;
    // No dialect means this provider cannot be controlled. Refusing here is better than
    // mounting a player that will ignore everything said to it.
    if (!dialect) return null;

    const frame = doc.createElement('iframe');
    const cache = { currentTime: 0, duration: 0 };
    let destroyed = false;

    function post(message: unknown): void {
        if (destroyed || !message) return;
        try {
            frame.contentWindow?.postMessage(JSON.stringify(message), dialect.targetOrigin);
        } catch {
            // The frame is not ready, or is gone. Either way there is nothing to say.
        }
    }

    function signalState(playerState?: number): void {
        if (playerState === YOUTUBE_STATE.playing) on.play?.();
        else if (playerState === YOUTUBE_STATE.paused) on.pause?.();
        else if (playerState === YOUTUBE_STATE.ended) on.ended?.();
    }

    function remember(currentTime?: number, duration?: number): void {
        // Keep the last known values: an update that omits one is not a report of zero.
        if (typeof currentTime === 'number') cache.currentTime = currentTime;
        if (typeof duration === 'number') cache.duration = duration;
        on.time?.(cache.currentTime, cache.duration);
    }

    function onMessage(event: unknown): void {
        if (destroyed) return;
        const message = event as { source?: unknown; data?: unknown };
        // Identity, not origin: several players post to this same window.
        if (message?.source !== frame.contentWindow) return;

        const decoded = dialect.decodeEvent(message.data);
        if (!decoded) return;

        switch (decoded.kind) {
            case 'ready':
                /**
                 * Subscribe AGAIN, now that the player says it is listening.
                 *
                 * The subscriptions sent on the iframe's `load` are what YouTube needs —
                 * it says nothing until asked — but Vimeo's legacy API accepts them at
                 * that point and wires nothing, because its own `ready` has not fired
                 * yet. Doing both covers the two orders, and the list is an idempotent
                 * `addEventListener` set, so a provider that was already subscribed is
                 * unaffected.
                 */
                for (const command of dialect.subscribeCommands()) post(command);
                on.ready?.(cache.duration || undefined);
                break;
            case 'play':
                on.play?.();
                break;
            case 'pause':
                on.pause?.();
                break;
            case 'ended':
                on.ended?.();
                break;
            case 'error':
                on.error?.(decoded.code);
                break;
            case 'info':
                remember(decoded.currentTime, decoded.duration);
                signalState(decoded.playerState);
                break;
            case 'timeupdate':
                remember(decoded.currentTime, decoded.duration);
                break;
            case 'state':
                signalState(decoded.playerState);
                break;
        }
    }

    frame.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    Object.assign(frame.style, { border: '0', width: '100%', height: '100%' });
    // src last: everything governing the load is set before it starts.
    frame.setAttribute('src', dialect.buildPlayerUrl(videoId, { origin, start, autoplay }));

    win.addEventListener('message', onMessage);
    // Subscribing before the frame exists would be shouting at nothing; YouTube in
    // particular says nothing at all until it has been asked to.
    frame.addEventListener('load', () => {
        for (const command of dialect.subscribeCommands()) post(command);
    });
    container.appendChild(frame);

    return {
        play: () => post(dialect.encodeCommand('play')),
        pause: () => post(dialect.encodeCommand('pause')),
        seek: seconds => post(dialect.encodeCommand('seek', seconds)),
        currentTime: () => cache.currentTime,
        duration: () => cache.duration,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            win.removeEventListener('message', onMessage);
            frame.parentNode?.removeChild(frame);
        },
    };
}
