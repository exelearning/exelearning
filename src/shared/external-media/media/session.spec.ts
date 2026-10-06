import { beforeEach, describe, expect, it } from 'bun:test';
import { createMediaSessionHost, type MediaChannel, type MediaSessionHost } from './session';

/**
 * The media session is where the media half's trust boundary lives, so this is the file
 * that has to be convincing.
 *
 * Two properties carry the weight, and neither is obvious from reading the happy path:
 *
 *  - a `hello` is accepted only from the registered content window, by IDENTITY. An
 *    opaque document's `event.origin` is the string "null", so origin cannot be the
 *    anchor — the same reasoning as the embed half's frame registry.
 *  - a new `helloId` means a NEW document in that window, so the previous session is torn
 *    down and a fresh port issued. Reusing the old port would hand the arriving document
 *    a channel granted to its predecessor.
 */
interface StubPort {
    posted: unknown[];
    started: boolean;
    closed: boolean;
    onmessage: ((event: { data: unknown }) => void) | null;
    postMessage(message: unknown): void;
    start(): void;
    close(): void;
}

function makePort(): StubPort {
    const port: StubPort = {
        posted: [],
        started: false,
        closed: false,
        onmessage: null,
        postMessage: message => port.posted.push(message),
        start: () => {
            port.started = true;
        },
        close: () => {
            port.closed = true;
        },
    };
    return port;
}

let channels: { port1: StubPort; port2: StubPort }[];
let commands: { helloId: string; command: unknown }[];
let tornDown: string[];
let contentWindow: { posted: { message: unknown; transfer?: unknown[] }[] };
let host: MediaSessionHost;

const hello = (helloId: string, source: unknown = contentWindow) => ({
    source,
    data: { type: 'exe-media', v: 1, action: 'hello', helloId },
});

const lastChannel = () => channels[channels.length - 1];
const welcomes = () => contentWindow.posted.filter(p => (p.message as { action?: string }).action === 'welcome');

beforeEach(() => {
    channels = [];
    commands = [];
    tornDown = [];
    contentWindow = {
        posted: [],
        // eslint-disable-next-line
        postMessage: (message: unknown, _target: string, transfer?: unknown[]) =>
            contentWindow.posted.push({ message, transfer }),
    } as never;

    host = createMediaSessionHost({
        contentWindow,
        createChannel: (): MediaChannel => {
            const channel = { port1: makePort(), port2: makePort() };
            channels.push(channel);
            return channel as never;
        },
        onCommand: (session, command) => commands.push({ helloId: session.helloId, command }),
        onTeardown: session => tornDown.push(session.helloId),
    });
});

describe('pairing', () => {
    it('answers a hello with a welcome carrying the transferred port', () => {
        host.handleWindowMessage(hello('h1'));

        expect(welcomes()).toHaveLength(1);
        expect(welcomes()[0].message).toMatchObject({ type: 'exe-media', v: 1, action: 'welcome', helloId: 'h1' });
        expect(welcomes()[0].transfer).toEqual([lastChannel().port2]);
    });

    it('starts listening on its own end of the channel', () => {
        host.handleWindowMessage(hello('h1'));

        expect(lastChannel().port1.started).toBe(true);
    });

    /**
     * Identity, not origin. This is the whole trust anchor: an opaque document reports
     * `event.origin === "null"`, so anything keyed on origin would either accept every
     * opaque window or none.
     */
    it('ignores a hello from a window it does not host', () => {
        host.handleWindowMessage(hello('h1', { impostor: true }));

        expect(welcomes()).toHaveLength(0);
        expect(host.current()).toBeNull();
    });

    it('ignores anything that is not a well-formed hello', () => {
        host.handleWindowMessage({ source: contentWindow, data: { type: 'exe-media', v: 1, action: 'play' } });
        host.handleWindowMessage({
            source: contentWindow,
            data: { type: 'other', v: 1, action: 'hello', helloId: 'x' },
        });
        host.handleWindowMessage({ source: contentWindow, data: null });

        expect(welcomes()).toHaveLength(0);
    });

    /** The child retries its announcement; a retry must not churn the session. */
    it('treats a repeated helloId as the same session', () => {
        host.handleWindowMessage(hello('h1'));
        const first = host.current();

        host.handleWindowMessage(hello('h1'));

        expect(welcomes()).toHaveLength(1);
        expect(channels).toHaveLength(1);
        expect(host.current()).toBe(first);
    });
});

describe('a new document in the same window', () => {
    beforeEach(() => host.handleWindowMessage(hello('h1')));

    it('is issued its own port, never the previous one', () => {
        host.handleWindowMessage(hello('h2'));

        expect(channels).toHaveLength(2);
        expect(welcomes()[1].transfer).toEqual([channels[1].port2]);
    });

    it('closes the previous port so the old document cannot keep talking', () => {
        const stale = channels[0].port1;

        host.handleWindowMessage(hello('h2'));

        expect(stale.closed).toBe(true);
        expect(tornDown).toEqual(['h1']);
    });

    /**
     * Nulling `onmessage` is not by itself a defence: a port implementation can deliver a
     * message that was already queued when the handler was detached. The captured
     * reference models exactly that, which is what the identity guard is for.
     */
    it('drops a command already queued on the stale port', () => {
        const staleHandler = channels[0].port1.onmessage;
        expect(staleHandler, 'the first session must have been listening').toBeTruthy();

        host.handleWindowMessage(hello('h2'));
        staleHandler?.({ data: { type: 'exe-media', v: 1, action: 'play' } });

        expect(commands).toHaveLength(0);
    });
});

describe('commands', () => {
    beforeEach(() => host.handleWindowMessage(hello('h1')));

    it('are delivered from the private port', () => {
        lastChannel().port1.onmessage?.({ data: { type: 'exe-media', v: 1, action: 'play' } });

        expect(commands).toHaveLength(1);
        expect(commands[0].command).toMatchObject({ action: 'play' });
    });

    it('are refused when malformed, without reaching the handler', () => {
        lastChannel().port1.onmessage?.({ data: { type: 'exe-media', v: 1, action: 'seek', t: -1 } });
        lastChannel().port1.onmessage?.({ data: { type: 'exe-media', v: 1, action: 'nope' } });
        lastChannel().port1.onmessage?.({ data: null });

        expect(commands).toHaveLength(0);
    });

    /**
     * P5, closed. The port was transferred to exactly one document, so a command arriving
     * on it is that document talking. A capability token layered on top authenticates a
     * channel that is already exclusive — it was ceremony, and the child even validated
     * its own outbound commands against a secret it had just written into them.
     *
     * It is gone rather than issued-and-ignored, because nothing lags: the child runtime
     * is injected by the plugin and refreshed on every extract, and plugins are released
     * in lockstep with core. There is no older peer to stay compatible with.
     */
    it('ignores a capability token if one is sent, because the port already authorised it', () => {
        lastChannel().port1.onmessage?.({
            data: { type: 'exe-media', v: 1, action: 'play', exelearningBridge: 'not-the-nonce' },
        });

        expect(commands).toHaveLength(1);
    });

    it('does not put a token in the welcome at all', () => {
        expect(welcomes()[0].message).not.toHaveProperty('exelearningBridge');
    });
});

describe('shutting down', () => {
    it('closes the port and forgets the session', () => {
        host.handleWindowMessage(hello('h1'));

        host.teardown();

        expect(lastChannel().port1.closed).toBe(true);
        expect(host.current()).toBeNull();
        expect(tornDown).toEqual(['h1']);
    });

    it('survives a teardown with no session', () => {
        expect(() => host.teardown()).not.toThrow();
        expect(tornDown).toEqual([]);
    });

    it('can pair again afterwards', () => {
        host.handleWindowMessage(hello('h1'));
        host.teardown();

        host.handleWindowMessage(hello('h2'));

        expect(host.current()?.helloId).toBe('h2');
    });
});
