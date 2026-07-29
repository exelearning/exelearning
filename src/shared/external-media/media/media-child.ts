/**
 * The content side of the media half: announce, pair, hand the iDevice a controller.
 *
 * What an interactive-video iDevice needs from inside an opaque document is one thing —
 * "play this video and let me drive it" — and this is that, with the handshake underneath.
 *
 * WHAT IS DELIBERATELY ABSENT. The classic bridge also scanned the document and turned
 * declarative embeds into click-to-open placeholders. That path was already unreachable:
 * `exe_media_bridge.js` opens it with `if (win.exeEmbedShim) return Promise.resolve([])`,
 * and the child bundle always publishes that global. In a unified bundle the embed half
 * promotes declarative embeds **in place**, overlaid as real players, which is a better
 * outcome than a placeholder that needs a click. Porting the dead branch would have
 * carried a second, worse presentation into the canonical implementation.
 *
 * The handshake is announce-and-wait, with no retry: unlike the embed shim, nothing here
 * happens until an iDevice asks. If no host answers, the caller gets `null` and can say so
 * in its own terms rather than leaving the learner looking at a frozen control.
 */
import { MEDIA_TYPE, PROTOCOL_VERSION } from '../protocol/messages';
import { createControllerFactory, type MediaController, type MediaPortLike } from './controller';

export interface MediaBridgeOptions {
    win: {
        parent?: { postMessage(message: unknown, targetOrigin: string): void };
        addEventListener(type: string, listener: (event: unknown) => void): void;
        removeEventListener(type: string, listener: (event: unknown) => void): void;
    };
    /** Injected so the handshake is deterministic under test. */
    createHelloId(): string;
}

export interface OpenMediaRequest {
    provider: string;
    videoId: string;
    start?: number;
    autoplay?: boolean;
}

export interface MediaBridge {
    /**
     * The page's one session, established on first use.
     * @returns the private port, or null when no host answers.
     */
    session(): Promise<MediaPortLike | null>;
    /** @returns a controller for the opened video, or null when there is no host. */
    openMedia(request: OpenMediaRequest): Promise<MediaController | null>;
}

export function createMediaBridge({ win, createHelloId }: MediaBridgeOptions): MediaBridge {
    const controllers = createControllerFactory();
    // One handshake per page: many embeds, one parent, one transferred port.
    let pending: Promise<MediaPortLike | null> | null = null;

    function establish(): Promise<MediaPortLike | null> {
        const parent = win.parent;
        // Unframed, or framed by nothing that can hear us. Not an error: a package opened
        // directly has no host, which is the case ADR-0017 exists to keep quiet.
        if (!parent) return Promise.resolve(null);

        return new Promise<MediaPortLike | null>(resolve => {
            const helloId = createHelloId();
            let settled = false;

            function onMessage(event: unknown): void {
                if (settled) return;
                const message = event as { source?: unknown; data?: unknown; ports?: unknown[] };
                // Window identity is the only trust anchor available: this document is
                // opaque, so its own `event.origin` is the string "null" and so is the
                // host's view of us.
                if (message?.source !== parent) return;

                const data = message.data as Record<string, unknown> | null | undefined;
                if (!data || data.type !== MEDIA_TYPE || data.v !== PROTOCOL_VERSION) return;
                if (data.action !== 'welcome' || data.helloId !== helloId) return;

                // A welcome with no transferred port is not a session: there would be
                // nothing to talk over, and accepting it would strand the caller.
                const port = message.ports?.[0] as MediaPortLike | undefined;
                if (!port) return;

                settled = true;
                win.removeEventListener('message', onMessage);
                resolve(port);
            }

            win.addEventListener('message', onMessage);
            try {
                parent.postMessage({ type: MEDIA_TYPE, v: PROTOCOL_VERSION, action: 'hello', helloId }, '*');
            } catch {
                // An unreachable parent is simply the no-host case; the promise stays
                // unsettled and the caller's own timeout, if any, decides.
            }
        });
    }

    return {
        session() {
            pending ??= establish();
            return pending;
        },

        async openMedia(request) {
            const port = await this.session();
            if (!port) return null;

            // The factory supersedes whichever controller was previously driving, because
            // the host runs one modal: the old one must be told rather than left reading a
            // clock that will never advance.
            const media = controllers.create(port);
            media.open(request);
            return media;
        },
    };
}
