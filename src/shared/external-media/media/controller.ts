/**
 * The content-side media controller: the API an iDevice drives.
 *
 * It turns neutral calls (`play`, `seek`, `getDuration`) into validated protocol messages
 * on the private port, and fans inbound events back out to listeners. DOM-free, like the
 * session it rides on.
 *
 * The rule that shapes the design is not the command surface but this: a page may hold
 * several bridged videos, while the host runs ONE player over ONE transferred port.
 * Whoever opened last owns it. Before that was made explicit, each new controller
 * overwrote the port's single `onmessage`, which silently froze every earlier controller
 * and broke any page with more than one bridged video. So a factory owns the port, routes
 * inbound events to the current owner, and tells the previous owner it was superseded —
 * because an iDevice that is no longer driving needs to stop reading a clock that will
 * never advance again.
 */
import { MEDIA_TYPE, PROTOCOL_VERSION } from '../protocol/messages';
import { validateMediaCommand, validateMediaEvent } from '../protocol/schemas';

export interface MediaPortLike {
    postMessage(message: unknown): void;
    start?(): void;
    onmessage: ((event: { data: unknown }) => void) | null;
}

export interface OpenOptions {
    provider: string;
    videoId: string;
    start?: number;
    autoplay?: boolean;
}

export type MediaListener = (payload: unknown) => void;

export interface MediaController {
    on(event: string, listener: MediaListener): MediaController;
    off(event: string, listener: MediaListener): MediaController;
    open(options: OpenOptions): void;
    play(): void;
    pause(): void;
    seek(seconds: number): void;
    hide(): void;
    show(): void;
    close(): void;
    /** @returns the player's time, or null if this controller was superseded first. */
    getCurrentTime(): Promise<number | null>;
    /** @returns the media's duration, or null if this controller was superseded first. */
    getDuration(): Promise<number | null>;
    /** True once a newer controller took over the port. */
    isRetired(): boolean;
}

export interface ControllerFactory {
    /** Create a controller and make it the page's active one, superseding any previous. */
    create(port: MediaPortLike): MediaController;
}

interface PendingQuery {
    resolve(value: number | null): void;
    field: 'currentTime' | 'duration';
}

export function createControllerFactory(): ControllerFactory {
    let active: { controller: MediaController; deliver(data: unknown): void; retire(): void } | null = null;
    const bound = new WeakSet<MediaPortLike>();

    function build(port: MediaPortLike) {
        const listeners = new Map<string, MediaListener[]>();
        let pending = new Map<number, PendingQuery>();
        let sequence = 0;
        let retired = false;

        function emit(event: string, payload: unknown): void {
            for (const listener of listeners.get(event) ?? []) {
                try {
                    listener(payload);
                } catch {
                    // A listener that throws is the iDevice's problem, not the relay's.
                }
            }
        }

        function send(command: Record<string, unknown>): void {
            if (retired) return;
            // No capability token: the port this goes down was transferred to exactly one
            // document, so possession of it IS the authorisation (P5).
            const message = { ...command, type: MEDIA_TYPE, v: PROTOCOL_VERSION };
            if (!validateMediaCommand(message)) return;
            port.postMessage(message);
        }

        function query(action: 'getCurrentTime' | 'getDuration', field: PendingQuery['field']) {
            return new Promise<number | null>(resolve => {
                if (retired) {
                    resolve(null);
                    return;
                }
                sequence += 1;
                const reqId = sequence;
                pending.set(reqId, { resolve, field });
                send({ action, reqId });
            });
        }

        const controller: MediaController = {
            on(event, listener) {
                listeners.set(event, [...(listeners.get(event) ?? []), listener]);
                return controller;
            },
            off(event, listener) {
                listeners.set(
                    event,
                    (listeners.get(event) ?? []).filter(candidate => candidate !== listener),
                );
                return controller;
            },
            open(options) {
                sequence += 1;
                send({
                    action: 'open',
                    reqId: sequence,
                    provider: options.provider,
                    videoId: options.videoId,
                    start: options.start,
                    autoplay: options.autoplay,
                });
            },
            play: () => send({ action: 'play' }),
            pause: () => send({ action: 'pause' }),
            seek: seconds => send({ action: 'seek', t: seconds }),
            hide: () => send({ action: 'hide' }),
            show: () => send({ action: 'show' }),
            close: () => send({ action: 'close' }),
            getCurrentTime: () => query('getCurrentTime', 'currentTime'),
            getDuration: () => query('getDuration', 'duration'),
            isRetired: () => retired,
        };

        function deliver(data: unknown): void {
            if (retired) return;
            if (!validateMediaEvent(data)) return;
            const message = data as Record<string, unknown>;

            if (message.action === 'state') {
                const query = pending.get(message.reqId as number);
                if (!query) return;
                pending.delete(message.reqId as number);
                query.resolve((message[query.field] as number | undefined) ?? null);
                return;
            }

            emit(message.action as string, message);
        }

        function retire(): void {
            if (retired) return;
            // Settle before clearing: the incumbent dropped its pending map here, leaving
            // an iDevice that was awaiting a time hung for the life of the page.
            for (const query of pending.values()) query.resolve(null);
            pending = new Map();

            emit('closed', { type: MEDIA_TYPE, v: PROTOCOL_VERSION, action: 'closed', superseded: true });
            retired = true;
            listeners.clear();
        }

        return { controller, deliver, retire };
    }

    return {
        create(port) {
            const built = build(port);

            if (active && active.controller !== built.controller) active.retire();
            active = built;

            // One handler for the port's lifetime, routing to whoever currently owns it.
            //
            // Note what makes the incumbent's bug unreachable here: the handler closes over
            // `active`, not over a particular controller, so rebinding it would be harmless
            // anyway. The guard only avoids redundant work — the freezing came from handlers
            // that each captured their own controller and overwrote one another.
            if (!bound.has(port)) {
                bound.add(port);
                port.onmessage = event => active?.deliver(event?.data);
                port.start?.();
            }

            return built.controller;
        },
    };
}
