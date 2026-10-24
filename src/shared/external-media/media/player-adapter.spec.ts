import { beforeEach, describe, expect, it } from 'bun:test';
import { mountPlayer, type PlayerAdapter } from './player-adapter';
import { getDialect } from './provider-dialects';

/**
 * The DOM boundary of the media half: it mounts a player iframe, talks to it in its
 * provider's dialect, and reports back in neutral terms. Everything it decides was decided
 * elsewhere — the URL and the message shapes by `provider-dialects`, what may be played at
 * all by the protocol schema — so a mistake here can only be a wiring mistake.
 *
 * Two properties are load-bearing rather than incidental:
 *
 *  - inbound messages are matched by WINDOW IDENTITY, never by origin. Same anchor as the
 *    rest of this subsystem.
 *  - commands are addressed to the provider's origin, never `*`. Here we know exactly who
 *    we are talking to, so there is no reason to shout.
 */
interface StubElement {
    tag: string;
    attrs: Record<string, string>;
    style: Record<string, string>;
    listeners: Record<string, (() => void)[]>;
    parentNode: { removeChild(node: unknown): void } | null;
    removed: boolean;
    children: StubElement[];
}

let created: StubElement[];
let appended: StubElement[];
let winListeners: ((event: unknown) => void)[];
let removedListeners: ((event: unknown) => void)[];
let posted: { message: unknown; target: string }[];
let events: string[];
let times: { currentTime?: number; duration?: number }[];
let errors: string[];
let adapter: PlayerAdapter | null;

const contentWindow = { name: 'player' };

function element(tag: string): StubElement {
    const node: StubElement = {
        tag,
        attrs: {},
        style: {},
        listeners: {},
        parentNode: null,
        removed: false,
        children: [],
    };
    Object.assign(node, {
        setAttribute: (name: string, value: string) => {
            node.attrs[name] = value;
        },
        addEventListener: (type: string, fn: () => void) => {
            node.listeners[type] = [...(node.listeners[type] ?? []), fn];
        },
        appendChild: (child: StubElement) => {
            node.children.push(child);
            child.parentNode = {
                removeChild: () => {
                    child.removed = true;
                    node.children = node.children.filter(c => c !== child);
                },
            };
        },
        contentWindow: { postMessage: (message: unknown, target: string) => posted.push({ message, target }) },
    });
    (node as unknown as { contentWindow: unknown }).contentWindow = {
        ...contentWindow,
        postMessage: (message: unknown, target: string) => posted.push({ message, target }),
    };
    created.push(node);
    return node;
}

/** The most recent player: a test that remounts must not keep addressing the old one. */
const frame = () => [...created].reverse().find(node => node.tag === 'iframe') as StubElement;
const frameWindow = () => (frame() as unknown as { contentWindow: unknown }).contentWindow;
const fireLoad = () => frame().listeners.load?.forEach(fn => fn());
const deliver = (data: unknown, source: unknown = frameWindow()) => winListeners.forEach(fn => fn({ source, data }));
const sentMessages = () => posted.map(entry => JSON.parse(entry.message as string));

function mount(providerId = 'youtube', options: Record<string, unknown> = {}): PlayerAdapter | null {
    const container = element('div');
    appended.push(container);
    return mountPlayer({
        container: container as never,
        doc: { createElement: element } as never,
        win: {
            addEventListener: (_t: string, fn: (event: unknown) => void) => winListeners.push(fn),
            removeEventListener: (_t: string, fn: (event: unknown) => void) => removedListeners.push(fn),
        } as never,
        dialect: getDialect(providerId) as never,
        videoId: providerId === 'youtube' ? 'aqz-KE-bpKQ' : '123456789',
        origin: 'https://lms.example',
        on: {
            ready: () => events.push('ready'),
            play: () => events.push('play'),
            pause: () => events.push('pause'),
            ended: () => events.push('ended'),
            error: code => errors.push(code),
            time: (currentTime, duration) => times.push({ currentTime, duration }),
        },
        ...options,
    });
}

beforeEach(() => {
    created = [];
    appended = [];
    winListeners = [];
    removedListeners = [];
    posted = [];
    events = [];
    times = [];
    errors = [];
    adapter = null;
});

describe('mounting', () => {
    it('creates the player from the dialect it was given', () => {
        adapter = mount('youtube');
        const url = new URL(frame().attrs.src);

        expect(url.origin).toBe('https://www.youtube-nocookie.com');
        expect(url.searchParams.get('enablejsapi')).toBe('1');
        expect(url.searchParams.get('origin')).toBe('https://lms.example');
    });

    it('refuses to mount without a dialect', () => {
        const container = element('div');
        expect(
            mountPlayer({
                container: container as never,
                doc: { createElement: element } as never,
                win: { addEventListener: () => {}, removeEventListener: () => {} } as never,
                dialect: null as never,
                videoId: 'aqz-KE-bpKQ',
                origin: 'https://lms.example',
                on: {},
            }),
        ).toBeNull();
    });

    it('puts the player inside the container it was given', () => {
        adapter = mount('youtube');

        expect(appended[appended.length - 1].children).toEqual([frame()]);
    });

    it('carries start and autoplay through to the player', () => {
        adapter = mount('youtube', { start: 42, autoplay: true });
        const url = new URL(frame().attrs.src);

        expect(url.searchParams.get('start')).toBe('42');
        expect(url.searchParams.get('autoplay')).toBe('1');
    });

    /** The player is third-party content: it gets what it needs and nothing else. */
    it('allows only what a player needs', () => {
        adapter = mount('youtube');

        expect(frame().attrs.allow).toContain('fullscreen');
        expect(frame().attrs.referrerpolicy).toBe('strict-origin-when-cross-origin');
        expect('allowfullscreen' in frame().attrs).toBe(true);
    });

    it('subscribes once the frame has loaded, not before', () => {
        adapter = mount('youtube');
        expect(posted).toHaveLength(0);

        fireLoad();

        expect(sentMessages()).toEqual([{ event: 'listening' }]);
    });

    it('subscribes to every event a vimeo player must be asked for', () => {
        adapter = mount('vimeo');
        fireLoad();

        expect(sentMessages()).toHaveLength(6);
        // Both time-event names, because Vimeo answers `playProgress` with `api=1` and
        // `timeupdate` under the newer SDK. Asserted by membership rather than by index:
        // which one leads says nothing, and pinning it would break on a reorder that
        // changes no behaviour.
        expect(sentMessages()).toContainEqual({ method: 'addEventListener', value: 'playProgress' });
        expect(sentMessages()).toContainEqual({ method: 'addEventListener', value: 'timeupdate' });
    });
});

describe('commanding', () => {
    beforeEach(() => {
        adapter = mount('youtube');
        fireLoad();
        posted.length = 0;
    });

    it('encodes each command in the provider dialect', () => {
        adapter?.play();
        adapter?.pause();
        adapter?.seek(12.5);

        expect(sentMessages()).toEqual([
            { event: 'command', func: 'playVideo', args: [] },
            { event: 'command', func: 'pauseVideo', args: [] },
            { event: 'command', func: 'seekTo', args: [12.5, true] },
        ]);
    });

    /** We know exactly which origin we are talking to, so there is no reason to shout. */
    it('addresses the provider origin, never a wildcard', () => {
        adapter?.play();

        expect(posted[0].target).toBe('https://www.youtube-nocookie.com');
        expect(posted[0].target).not.toBe('*');
    });
});

describe('listening', () => {
    beforeEach(() => {
        adapter = mount('youtube');
        fireLoad();
    });

    it('reports ready, playback state and errors in neutral terms', () => {
        deliver(JSON.stringify({ event: 'onReady' }));
        deliver(JSON.stringify({ event: 'onStateChange', info: 1 }));
        deliver(JSON.stringify({ event: 'onStateChange', info: 2 }));
        deliver(JSON.stringify({ event: 'onStateChange', info: 0 }));
        deliver(JSON.stringify({ event: 'onError', info: 150 }));

        expect(events).toEqual(['ready', 'play', 'pause', 'ended']);
        expect(errors).toEqual(['150']);
    });

    /**
     * Identity, not origin — the same anchor as the frame registry. A page can hold several
     * players, and every one of them posts to this same window.
     */
    it('ignores a message from any window but its own player', () => {
        deliver(JSON.stringify({ event: 'onReady' }), { impostor: true });

        expect(events).toHaveLength(0);
    });

    it('ignores a message its dialect cannot decode', () => {
        deliver('not json');
        deliver(JSON.stringify({ event: 'unknownThing' }));

        expect(events).toHaveLength(0);
        expect(errors).toHaveLength(0);
    });

    /**
     * The time arrives unasked, which is why `currentTime()` is synchronous and no
     * round-trip is needed for it.
     */
    it('caches the time the player volunteers', () => {
        expect(adapter?.currentTime()).toBe(0);

        deliver(JSON.stringify({ event: 'infoDelivery', info: { currentTime: 42.5, duration: 300 } }));

        expect(adapter?.currentTime()).toBe(42.5);
        expect(adapter?.duration()).toBe(300);
        expect(times).toEqual([{ currentTime: 42.5, duration: 300 }]);
    });

    it('keeps the last known time when an update omits it', () => {
        deliver(JSON.stringify({ event: 'infoDelivery', info: { currentTime: 10, duration: 300 } }));
        deliver(JSON.stringify({ event: 'infoDelivery', info: { playerState: 1 } }));

        expect(adapter?.currentTime()).toBe(10);
        expect(adapter?.duration()).toBe(300);
    });

    /**
     * The two providers report playback differently and both paths matter: YouTube sends a
     * numeric state that has to be mapped, Vimeo names the event directly. Testing only
     * YouTube left the whole direct branch unexercised.
     */
    it('reports vimeo playback from its named events', () => {
        adapter?.destroy();
        adapter = mount('vimeo');
        fireLoad();

        deliver(JSON.stringify({ event: 'ready' }));
        deliver(JSON.stringify({ event: 'play' }));
        deliver(JSON.stringify({ event: 'pause' }));
        deliver(JSON.stringify({ event: 'ended' }));
        deliver(JSON.stringify({ event: 'error' }));

        expect(events).toEqual(['ready', 'play', 'pause', 'ended']);
        expect(errors).toEqual(['vimeo_error']);
    });

    it('reports vimeo time updates from its own event shape', () => {
        adapter?.destroy();
        adapter = mount('vimeo');
        fireLoad();

        deliver(JSON.stringify({ event: 'timeupdate', data: { seconds: 7, duration: 100 } }), frameWindow());

        expect(adapter?.currentTime()).toBe(7);
    });
});

describe('tearing down', () => {
    it('stops listening and removes the player', () => {
        adapter = mount('youtube');
        const player = frame();

        adapter?.destroy();

        expect(removedListeners).toHaveLength(1);
        expect(player.removed).toBe(true);
    });

    it('reports nothing after it was destroyed', () => {
        adapter = mount('youtube');
        fireLoad();
        adapter?.destroy();

        deliver(JSON.stringify({ event: 'onReady' }));

        expect(events).toHaveLength(0);
    });

    it('survives being destroyed twice', () => {
        adapter = mount('youtube');
        adapter?.destroy();
        expect(() => adapter?.destroy()).not.toThrow();
    });

    it('sends nothing once destroyed', () => {
        adapter = mount('youtube');
        fireLoad();
        adapter?.destroy();
        posted.length = 0;

        adapter?.play();

        expect(posted).toHaveLength(0);
    });
});

/**
 * Subscribing again once the player says it is ready.
 *
 * Measured against the real Vimeo player: subscriptions posted on the iframe's `load`
 * event are accepted and then silently ignored, because the legacy API only wires
 * listeners after it has emitted its own `ready`. The symptom is the worst kind — the
 * player loads, plays when clicked by hand, and reports nothing: no `play`, no time. Every
 * timestamp-driven feature reads zero forever, and nothing errors.
 *
 * Re-sending on `ready` is harmless for a provider that was already listening: it is the
 * same idempotent `addEventListener` list.
 */
describe('subscribing after the player reports ready', () => {
    it('re-sends the subscriptions when the provider says ready', () => {
        adapter = mount('vimeo');
        fireLoad();
        posted.length = 0;

        deliver(JSON.stringify({ event: 'ready', player_id: 'exe-vimeo-76979871' }));

        expect(sentMessages()).toContainEqual({ method: 'addEventListener', value: 'playProgress' });
    });

    it('does not resubscribe on every later event', () => {
        adapter = mount('vimeo');
        fireLoad();
        deliver(JSON.stringify({ event: 'ready', player_id: 'exe-vimeo-76979871' }));
        posted.length = 0;

        deliver(JSON.stringify({ event: 'playProgress', data: { seconds: 3, duration: 60 } }));

        expect(sentMessages()).toEqual([]);
    });
});
