import { beforeEach, describe, expect, it } from 'bun:test';
import { createMediaBridge, type MediaBridge } from './media-child';

/**
 * The content side of the media half: announce, pair, and hand the iDevice a controller.
 *
 * The declarative half of the classic bridge — scanning the document and turning embeds
 * into click-to-open placeholders — is deliberately absent. It was already unreachable:
 * `exe_media_bridge.js` opens with `if (win.exeEmbedShim) return Promise.resolve([])`, and
 * the child bundle always publishes that global. In a unified bundle the embed half
 * promotes declarative embeds in place, and this half exists only for the programmatic
 * path an iDevice drives.
 */
let posted: { message: unknown; target: string }[];
let listeners: ((event: unknown) => void)[];
let ports: { port1: unknown; port2: unknown }[];
let bridge: MediaBridge;

const parent = {
    postMessage: (message: unknown, target: string) => posted.push({ message, target }),
};

function makePort() {
    const port = {
        posted: [] as unknown[],
        started: false,
        onmessage: null as ((event: { data: unknown }) => void) | null,
        postMessage: (message: unknown) => port.posted.push(message),
        start: () => {
            port.started = true;
        },
    };
    return port;
}

const helloId = () => (posted[0]?.message as { helloId: string })?.helloId;
const welcome = (id = helloId(), source: unknown = parent) => {
    const channel = { port1: makePort(), port2: makePort() };
    ports.push(channel);
    listeners.forEach(fn =>
        fn({
            source,
            data: { type: 'exe-media', v: 1, action: 'welcome', helloId: id },
            ports: [channel.port2],
        }),
    );
    return channel.port2;
};
const hostPort = () => ports[ports.length - 1].port2 as ReturnType<typeof makePort>;

beforeEach(() => {
    posted = [];
    listeners = [];
    ports = [];
    let n = 0;
    bridge = createMediaBridge({
        win: {
            parent,
            addEventListener: (_t: string, fn: (event: unknown) => void) => listeners.push(fn),
            removeEventListener: (_t: string, fn: (event: unknown) => void) => {
                listeners = listeners.filter(l => l !== fn);
            },
        } as never,
        createHelloId: () => `h${(n += 1)}`,
    });
});

describe('announcing', () => {
    it('says hello to the parent as soon as a session is wanted', () => {
        void bridge.session();

        expect(posted).toHaveLength(1);
        expect(posted[0].message).toMatchObject({ type: 'exe-media', v: 1, action: 'hello', helloId: 'h1' });
    });

    /** The opaque origin has no stable value to address; the host authenticates by identity. */
    it('posts with a wildcard target, because an opaque child has no origin to name', () => {
        void bridge.session();

        expect(posted[0].target).toBe('*');
    });

    it('announces once however many callers ask', async () => {
        void bridge.session();
        void bridge.session();
        void bridge.session();

        expect(posted).toHaveLength(1);
    });

    it('gives up quietly when there is no parent to talk to', async () => {
        const alone = createMediaBridge({
            win: { parent: undefined, addEventListener: () => {}, removeEventListener: () => {} } as never,
            createHelloId: () => 'h1',
        });

        expect(await alone.session()).toBeNull();
    });
});

describe('pairing', () => {
    it('resolves the session when the parent answers with a port', async () => {
        const pending = bridge.session();
        welcome();

        expect(await pending).not.toBeNull();
    });

    /** Identity, not origin — the same anchor as everywhere else in this subsystem. */
    it('ignores a welcome from a window that is not the parent', async () => {
        const pending = bridge.session();
        welcome(helloId(), { impostor: true });

        let settled = false;
        void pending.then(() => {
            settled = true;
        });
        await Promise.resolve();
        expect(settled).toBe(false);
    });

    it('ignores a welcome addressed to a different announcement', async () => {
        const pending = bridge.session();
        welcome('some-other-id');

        let settled = false;
        void pending.then(() => {
            settled = true;
        });
        await Promise.resolve();
        expect(settled).toBe(false);
    });

    /** A welcome with no transferred port is not a session; there is nothing to talk over. */
    it('ignores a welcome that carries no port', async () => {
        const pending = bridge.session();
        listeners.forEach(fn =>
            fn({ source: parent, data: { type: 'exe-media', v: 1, action: 'welcome', helloId: helloId() }, ports: [] }),
        );

        let settled = false;
        void pending.then(() => {
            settled = true;
        });
        await Promise.resolve();
        expect(settled).toBe(false);
    });

    it('stops listening once paired', async () => {
        const pending = bridge.session();
        welcome();
        await pending;

        expect(listeners).toHaveLength(0);
    });
});

describe('opening media', () => {
    it('hands back a controller that drives the host', async () => {
        const opening = bridge.openMedia({ provider: 'youtube', videoId: 'aqz-KE-bpKQ' });
        welcome();
        const media = await opening;

        expect(media).not.toBeNull();
        expect((hostPort().posted[0] as { action: string }).action).toBe('open');
    });

    it('carries the start time and autoplay the caller asked for', async () => {
        const opening = bridge.openMedia({ provider: 'youtube', videoId: 'aqz-KE-bpKQ', start: 30, autoplay: true });
        welcome();
        await opening;

        expect(hostPort().posted[0]).toMatchObject({ action: 'open', start: 30, autoplay: true });
    });

    it('returns nothing when there is no host to open against', async () => {
        const alone = createMediaBridge({
            win: { parent: undefined, addEventListener: () => {}, removeEventListener: () => {} } as never,
            createHelloId: () => 'h1',
        });

        expect(await alone.openMedia({ provider: 'youtube', videoId: 'aqz-KE-bpKQ' })).toBeNull();
    });

    /**
     * One player at a time: the host runs a single modal, so a second open supersedes the
     * first and its controller is told, rather than being left reading a frozen clock.
     */
    it('supersedes the previous controller when a second video opens', async () => {
        const first = await (async () => {
            const opening = bridge.openMedia({ provider: 'youtube', videoId: 'aqz-KE-bpKQ' });
            welcome();
            return opening;
        })();
        const closed: unknown[] = [];
        first?.on('closed', event => closed.push(event));

        await bridge.openMedia({ provider: 'vimeo', videoId: '123456789' });

        expect(closed).toHaveLength(1);
        expect(first?.isRetired()).toBe(true);
    });
});
