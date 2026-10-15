import { beforeEach, describe, expect, it } from 'bun:test';
import { attachMediaHost, type AttachedMediaHost } from './media-host';

/**
 * The assembly: session → command dispatch → modal + player adapter → events back.
 *
 * Everything it composes is tested on its own, so what matters here is the wiring and the
 * lifecycle — particularly that opening a second video does not leave the first one's
 * player, dialog or listeners behind, which is the failure that produces two videos
 * playing at once.
 */
interface StubNode {
    tag: string;
    attrs: Record<string, string>;
    style: Record<string, string>;
    className: string;
    textContent: string;
    children: StubNode[];
    listeners: Record<string, ((event?: unknown) => void)[]>;
    removed: boolean;
    shown: number;
}

interface StubPort {
    posted: unknown[];
    onmessage: ((event: { data: unknown }) => void) | null;
    postMessage(message: unknown): void;
    start(): void;
    close(): void;
}

let nodes: StubNode[];
let ports: { port1: StubPort; port2: StubPort }[];
let winListeners: ((event: unknown) => void)[];
let removedWinListeners: number;
let playerPosts: { message: unknown; target: string }[];
let contentPosts: { message: unknown; transfer?: unknown[] }[];
let host: AttachedMediaHost;

const contentWindow = {
    postMessage: (message: unknown, _t: string, transfer?: unknown[]) => contentPosts.push({ message, transfer }),
};

function node(tag: string): StubNode {
    const created: StubNode = {
        tag,
        attrs: {},
        style: {},
        className: '',
        textContent: '',
        children: [],
        listeners: {},
        removed: false,
        shown: 0,
    };
    Object.assign(created, {
        setAttribute: (name: string, value: string) => {
            created.attrs[name] = value;
        },
        addEventListener: (type: string, fn: (event?: unknown) => void) => {
            created.listeners[type] = [...(created.listeners[type] ?? []), fn];
        },
        appendChild: (child: StubNode) => {
            created.children.push(child);
            (child as unknown as { parentNode: unknown }).parentNode = {
                removeChild: () => {
                    child.removed = true;
                },
            };
        },
        remove: () => {
            created.removed = true;
        },
        showModal: () => {
            created.shown += 1;
        },
        close: () => created.listeners.close?.forEach(fn => fn()),
        contentWindow: { postMessage: (message: unknown, target: string) => playerPosts.push({ message, target }) },
    });
    nodes.push(created);
    return created;
}

function makePort(): StubPort {
    const port: StubPort = {
        posted: [],
        onmessage: null,
        postMessage: message => port.posted.push(message),
        start: () => {},
        close: () => {},
    };
    return port;
}

const dialogs = () => nodes.filter(n => n.tag === 'dialog');
const players = () => nodes.filter(n => n.tag === 'iframe');
const lastPort = () => ports[ports.length - 1].port1;
const sentToContent = () => lastPort().posted as { action: string; [k: string]: unknown }[];
const actionsToContent = () => sentToContent().map(m => m.action);

const hello = (helloId = 'h1') =>
    winListeners.forEach(fn =>
        fn({ source: contentWindow, data: { type: 'exe-media', v: 1, action: 'hello', helloId } }),
    );
const command = (data: Record<string, unknown>) =>
    lastPort().onmessage?.({ data: { type: 'exe-media', v: 1, ...data } });
const openYoutube = (extra: Record<string, unknown> = {}) =>
    command({ action: 'open', reqId: 1, provider: 'youtube', videoId: 'aqz-KE-bpKQ', ...extra });
/** Deliver a message from the current player frame, as the provider would. */
const fromPlayer = (payload: unknown) => {
    const frame = players()[players().length - 1] as unknown as { contentWindow: unknown };
    winListeners.forEach(fn => fn({ source: frame.contentWindow, data: JSON.stringify(payload) }));
};

beforeEach(() => {
    nodes = [];
    ports = [];
    winListeners = [];
    removedWinListeners = 0;
    playerPosts = [];
    contentPosts = [];

    host = attachMediaHost({
        contentWindow: contentWindow as never,
        doc: { createElement: node, body: node('body-root') as never } as never,
        win: {
            addEventListener: (_t: string, fn: (event: unknown) => void) => winListeners.push(fn),
            removeEventListener: () => {
                removedWinListeners += 1;
            },
        } as never,
        origin: 'https://lms.example',
        translate: key => key,
        createChannel: () => {
            const channel = { port1: makePort(), port2: makePort() };
            ports.push(channel);
            return channel as never;
        },
    });
});

describe('pairing', () => {
    it('answers a hello with a welcome and a transferred port', () => {
        hello();

        expect(contentPosts).toHaveLength(1);
        expect(contentPosts[0].message).toMatchObject({ action: 'welcome', helloId: 'h1' });
        expect(contentPosts[0].transfer).toHaveLength(1);
    });

    it('opens no player until asked to', () => {
        hello();

        expect(players()).toHaveLength(0);
        expect(dialogs()).toHaveLength(0);
    });
});

describe('opening a video', () => {
    beforeEach(() => {
        hello();
        openYoutube();
    });

    it('puts a player inside a modal dialog', () => {
        expect(dialogs()).toHaveLength(1);
        expect(dialogs()[0].shown).toBe(1);
        expect(players()).toHaveLength(1);
        expect(players()[0].attrs.src).toContain('youtube-nocookie.com/embed/aqz-KE-bpKQ');
    });

    it('refuses a provider it cannot control, and says so', () => {
        command({ action: 'open', reqId: 2, provider: 'dailymotion', videoId: 'x8abcd1' });

        expect(actionsToContent()).toContain('error');
        expect(players()).toHaveLength(1); // the youtube one, untouched
    });

    /** Malformed commands are refused by the protocol before reaching any of this. */
    it('ignores an open with an id that is not the provider’s', () => {
        const before = players().length;
        command({ action: 'open', reqId: 3, provider: 'youtube', videoId: '../../evil' });

        expect(players()).toHaveLength(before);
    });
});

describe('relaying player events to the content', () => {
    beforeEach(() => {
        hello();
        openYoutube();
    });

    it('reports ready, playback and errors', () => {
        fromPlayer({ event: 'onReady' });
        fromPlayer({ event: 'onStateChange', info: 1 });
        fromPlayer({ event: 'onStateChange', info: 2 });
        fromPlayer({ event: 'onStateChange', info: 0 });
        fromPlayer({ event: 'onError', info: 150 });

        expect(actionsToContent()).toEqual(['ready', 'play', 'pause', 'ended', 'error']);
    });

    /**
     * Event-driven rather than polled: the provider volunteers the time, so a timer would
     * only re-emit an unchanged cached value.
     */
    it('reports time as the player volunteers it, with no timer', () => {
        fromPlayer({ event: 'infoDelivery', info: { currentTime: 42.5, duration: 300 } });

        const update = sentToContent().find(m => m.action === 'timeupdate');
        expect(update).toMatchObject({ currentTime: 42.5, duration: 300 });
    });

    it('never emits a time update before a duration is known', () => {
        fromPlayer({ event: 'infoDelivery', info: { currentTime: 5 } });

        expect(actionsToContent()).not.toContain('timeupdate');
    });
});

describe('commanding the player', () => {
    beforeEach(() => {
        hello();
        openYoutube();
        players()[0].listeners.load?.forEach(fn => fn());
        playerPosts.length = 0;
    });

    it('forwards playback commands in the provider dialect', () => {
        command({ action: 'play' });
        command({ action: 'pause' });
        command({ action: 'seek', t: 12.5 });

        expect(playerPosts.map(p => JSON.parse(p.message as string).func)).toEqual([
            'playVideo',
            'pauseVideo',
            'seekTo',
        ]);
    });

    it('answers a time query with the state the player volunteered', () => {
        fromPlayer({ event: 'infoDelivery', info: { currentTime: 42.5, duration: 300 } });

        command({ action: 'getCurrentTime', reqId: 7 });
        command({ action: 'getDuration', reqId: 8 });

        const states = sentToContent().filter(m => m.action === 'state');
        expect(states).toContainEqual(expect.objectContaining({ reqId: 7, currentTime: 42.5 }));
        expect(states).toContainEqual(expect.objectContaining({ reqId: 8, duration: 300 }));
    });
});

describe('presentation', () => {
    beforeEach(() => {
        hello();
        openYoutube();
    });

    it('hides and shows the dialog without reporting a close', () => {
        command({ action: 'hide' });
        command({ action: 'show' });

        expect(actionsToContent()).not.toContain('closed');
        expect(dialogs()[0].shown).toBe(2);
    });

    it('reports a close when the content asks for one', () => {
        command({ action: 'close' });

        expect(actionsToContent()).toContain('closed');
        expect(players()[0].removed).toBe(true);
    });

    /** The learner pressing Esc must reach the iDevice, or its clock keeps running. */
    it('reports a close when the learner dismisses the dialog', () => {
        dialogs()[0].listeners.close?.forEach(fn => fn());

        expect(actionsToContent()).toContain('closed');
    });
});

describe('one video at a time', () => {
    /**
     * The failure this prevents is two players sounding at once: opening a second video
     * must discard the first one's player and dialog, not stack another on top.
     */
    it('discards the previous player and dialog when a second video opens', () => {
        hello();
        openYoutube();
        const first = { player: players()[0], dialog: dialogs()[0] };

        command({ action: 'open', reqId: 9, provider: 'vimeo', videoId: '123456789' });

        expect(first.player.removed).toBe(true);
        expect(first.dialog.removed).toBe(true);
        expect(players()).toHaveLength(2);
        expect(players()[1].attrs.src).toContain('player.vimeo.com');
    });

    it('discards everything when the content re-announces itself', () => {
        hello('h1');
        openYoutube();
        const first = players()[0];

        hello('h2');

        expect(first.removed).toBe(true);
    });
});

describe('detaching', () => {
    it('stops listening and tears the player down', () => {
        hello();
        openYoutube();

        host.detach();

        expect(players()[0].removed).toBe(true);
        expect(removedWinListeners).toBeGreaterThan(0);
    });

    it('survives being detached twice', () => {
        hello();
        host.detach();
        expect(() => host.detach()).not.toThrow();
    });
});
