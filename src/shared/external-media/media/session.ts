/**
 * The media session: pairing a content document with a private command channel.
 *
 * This is the media half's trust boundary, and it is deliberately DOM-free so the part
 * with the security consequences can be tested without a DOM engine — the same split the
 * embed half uses between `frame-registry` and `dom-overlay-adapter`.
 *
 * The model, in one paragraph. The content document announces itself with a `hello`
 * carrying an id it chose. The host answers on the window with a `welcome` and, crucially,
 * **transfers one end of a fresh `MessageChannel`**. Every command after that travels over
 * that port and nowhere else. Possession of the port IS the authorisation: it was handed
 * to exactly one document, and no other party can post on it.
 *
 * Two rules do the work:
 *
 *  - a `hello` is honoured only from the registered content window, matched by IDENTITY.
 *    An opaque document reports `event.origin` as the string "null", so origin cannot be
 *    the anchor — it would either admit every opaque window or none.
 *  - a NEW `helloId` means a new document in that same window. The previous session is
 *    torn down and its port closed before a fresh one is issued, so an arriving document
 *    never inherits a channel granted to its predecessor.
 */
import { MEDIA_TYPE, PROTOCOL_VERSION } from '../protocol/messages';
import { validateMediaCommand } from '../protocol/schemas';

export interface MediaPort {
    postMessage(message: unknown): void;
    start?(): void;
    close?(): void;
    onmessage: ((event: { data: unknown }) => void) | null;
}

export interface MediaChannel {
    port1: MediaPort;
    port2: MediaPort;
}

export interface MediaSession {
    /** The id the content document chose for this pairing. */
    helloId: string;
    /** The host's end of the private channel. */
    port: MediaPort;
}

export interface MediaSessionOptions {
    /** The content document's window; the only sender a `hello` is accepted from. */
    contentWindow: { postMessage(message: unknown, targetOrigin: string, transfer?: unknown[]): void };
    createChannel(): MediaChannel;
    /**
     * A validated command arrived on the private port.
     *
     * There is no capability token, and its absence is the decision rather than an
     * omission (P5). The port was transferred to exactly one document, so a command
     * arriving on it is that document talking. A token layered on top authenticates a
     * channel that is already exclusive — the classic implementation even had the child
     * validate its own outbound commands against a secret it had just written into them.
     *
     * Removing it outright, rather than issuing it and ignoring it, is possible because
     * nothing lags: the child runtime is injected by the host plugin and refreshed on
     * every extract, and the plugins are released in lockstep with core. A token is
     * carried by an inbound message harmlessly; it is simply not consulted.
     */
    onCommand(session: MediaSession, command: unknown): void;
    /** Called before a session's port is closed, so the caller can release its resources. */
    onTeardown?(session: MediaSession): void;
}

export interface MediaSessionHost {
    /** Feed it window messages; it acts only on a well-formed `hello` from its window. */
    handleWindowMessage(event: { source?: unknown; data?: unknown } | null | undefined): void;
    current(): MediaSession | null;
    /** End the current session, closing its port. Idempotent. */
    teardown(): void;
}

function isHello(data: unknown): data is { helloId: string } {
    if (typeof data !== 'object' || data === null) return false;
    const message = data as Record<string, unknown>;
    return (
        message.type === MEDIA_TYPE &&
        message.v === PROTOCOL_VERSION &&
        message.action === 'hello' &&
        typeof message.helloId === 'string' &&
        message.helloId.length > 0
    );
}

export function createMediaSessionHost(options: MediaSessionOptions): MediaSessionHost {
    const { contentWindow, createChannel, onCommand, onTeardown } = options;
    let session: MediaSession | null = null;

    function end(): void {
        if (!session) return;
        const ending = session;
        // Cleared first: a command already queued on the port must not find a live
        // session while the caller is releasing its resources.
        session = null;
        ending.port.onmessage = null;
        onTeardown?.(ending);
        ending.port.close?.();
    }

    function pair(helloId: string): void {
        const channel = createChannel();
        const paired: MediaSession = { helloId, port: channel.port1 };
        session = paired;

        channel.port1.onmessage = event => {
            // Stale-port guard: `end()` nulls this handler, but a port implementation that
            // delivers a queued message anyway must not be able to reach a newer session.
            if (session !== paired) return;
            if (!validateMediaCommand(event?.data)) return;
            onCommand(paired, event.data);
        };
        channel.port1.start?.();

        // targetOrigin '*' because an opaque document has no stable origin to address; the
        // child authenticates US by window identity, exactly as we do it.
        contentWindow.postMessage({ type: MEDIA_TYPE, v: PROTOCOL_VERSION, action: 'welcome', helloId }, '*', [
            channel.port2,
        ]);
    }

    return {
        handleWindowMessage(event) {
            if (!event || event.source !== contentWindow) return;
            if (!isHello(event.data)) return;

            // The child retries its announcement until answered, so a repeat of the id we
            // are already paired with is that retry, not a new document.
            if (session?.helloId === event.data.helloId) return;

            end();
            pair(event.data.helloId);
        },

        current: () => session,
        teardown: end,
    };
}
