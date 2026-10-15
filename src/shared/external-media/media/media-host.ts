/**
 * The media half assembled: session → command dispatch → modal + player → events back.
 *
 * Every part it composes decides its own thing and is tested on its own. What lives here
 * is the lifecycle, and the rule that shapes it: **one video at a time per content frame**.
 * A second `open`, or the content re-announcing itself, discards the previous player and
 * dialog rather than stacking another on top — otherwise two videos sound at once and only
 * one of them is reachable.
 *
 * Deliberate divergence from the classic implementation: time updates are **event-driven,
 * not polled**. The incumbent ran a 250 ms timer reading its own cache, which made sense
 * when reading the time was an SDK call. With raw `postMessage` the providers volunteer
 * time in their event stream, so the timer only re-emitted an unchanged value — and kept
 * emitting it while paused. The events that update the cache are exactly the events worth
 * forwarding.
 */
import { MEDIA_TYPE, PROTOCOL_VERSION } from '../protocol/messages';
import { createMediaModal, type MediaModal } from './modal';
import { mountPlayer, type PlayerAdapter } from './player-adapter';
import { getDialect } from './provider-dialects';
import { createMediaSessionHost, type MediaChannel, type MediaSession } from './session';

export interface MediaHostOptions {
    /** The content document's window: the only sender a `hello` is accepted from. */
    contentWindow: { postMessage(message: unknown, targetOrigin: string, transfer?: unknown[]): void };
    doc: Parameters<typeof createMediaModal>[0]['doc'] & { createElement(tag: string): never };
    win: {
        addEventListener(type: string, listener: (event: unknown) => void): void;
        removeEventListener(type: string, listener: (event: unknown) => void): void;
    };
    /** This page's origin, which is what lets a player accept commands at all. */
    origin: string;
    translate(key: string): string;
    createChannel(): MediaChannel;
}

export interface AttachedMediaHost {
    detach(): void;
}

interface OpenCommand {
    provider: string;
    videoId: string;
    start?: number;
    autoplay?: boolean;
}

export function attachMediaHost(options: MediaHostOptions): AttachedMediaHost {
    const { contentWindow, doc, win, origin, translate, createChannel } = options;

    let modal: MediaModal | null = null;
    let player: PlayerAdapter | null = null;
    let detached = false;

    const session = createMediaSessionHost({
        contentWindow,
        createChannel,
        onCommand: dispatch,
        // A new document in this window gets a fresh port; whatever the previous one was
        // watching must not outlive it.
        onTeardown: () => discardPlayback(),
    });

    function send(current: MediaSession, event: Record<string, unknown>): void {
        current.port.postMessage({ type: MEDIA_TYPE, v: PROTOCOL_VERSION, ...event });
    }

    /** Remove the current player and dialog, if any. Silent: reports nothing. */
    function discardPlayback(): void {
        player?.destroy();
        player = null;
        modal?.close();
        modal = null;
    }

    function open(current: MediaSession, request: OpenCommand): void {
        const dialect = getDialect(request.provider);
        if (!dialect) {
            // Embeddable is not the same as controllable: a provider with no dialect can be
            // shown but not driven, and saying so beats opening a player that ignores us.
            send(current, { action: 'error', code: 'unsupported_provider', fatal: true });
            return;
        }

        discardPlayback();

        const dialog = createMediaModal({
            doc,
            translate,
            // The learner pressing Esc or the close button has to reach the iDevice, or its
            // question clock keeps running against a video that is no longer there.
            onClose: () => {
                player?.destroy();
                player = null;
                modal = null;
                send(current, { action: 'closed' });
            },
        });
        modal = dialog;

        player = mountPlayer({
            container: dialog.body() as never,
            doc: doc as never,
            win: win as never,
            dialect,
            videoId: request.videoId,
            origin,
            start: request.start,
            autoplay: request.autoplay,
            on: {
                ready: duration => send(current, { action: 'ready', duration }),
                play: () => send(current, { action: 'play' }),
                pause: () => send(current, { action: 'pause' }),
                ended: () => send(current, { action: 'ended' }),
                error: code => send(current, { action: 'error', code, fatal: false }),
                time: (currentTime, duration) => {
                    // A time without a duration is not yet a useful report, and the protocol
                    // requires both.
                    if (typeof currentTime !== 'number' || typeof duration !== 'number' || duration <= 0) return;
                    send(current, { action: 'timeupdate', currentTime, duration });
                },
            },
        });
    }

    function dispatch(current: MediaSession, raw: unknown): void {
        if (detached) return;
        const command = raw as Record<string, unknown>;

        switch (command.action) {
            case 'open':
                open(current, command as unknown as OpenCommand);
                return;
            case 'play':
                player?.play();
                return;
            case 'pause':
                player?.pause();
                return;
            case 'seek':
                player?.seek(command.t as number);
                return;
            case 'hide':
                modal?.hide();
                return;
            case 'show':
                modal?.show();
                return;
            case 'close':
                player?.destroy();
                player = null;
                modal?.close(); // reports `closed` through the modal's own callback
                modal = null;
                return;
            case 'getCurrentTime':
                send(current, { action: 'state', reqId: command.reqId, currentTime: player?.currentTime() ?? 0 });
                return;
            case 'getDuration':
                send(current, { action: 'state', reqId: command.reqId, duration: player?.duration() ?? 0 });
                return;
            default:
                return;
        }
    }

    function onWindowMessage(event: unknown): void {
        if (detached) return;
        session.handleWindowMessage(event as { source?: unknown; data?: unknown });
    }

    win.addEventListener('message', onWindowMessage);

    return {
        detach() {
            if (detached) return;
            detached = true;
            win.removeEventListener('message', onWindowMessage);
            discardPlayback();
            session.teardown();
        },
    };
}
