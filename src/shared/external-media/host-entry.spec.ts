import { beforeEach, describe, expect, it } from 'bun:test';
import { createExternalMediaHost, publishHost, type ExternalMediaHost } from './host-entry';

/**
 * A window stub rather than a DOM engine, for the same reason the adapter spec uses one:
 * what is worth asserting here is the WIRING — which listeners get installed, what they
 * are hooked to, and that disposing takes all of them away again. The DOM behaviour
 * underneath is covered in three browsers by the artifact E2E.
 */
interface Listener {
    type: string;
    fn: (event?: unknown) => void;
    capture?: boolean;
}

interface StubFrame {
    src: string;
    contentWindow: { postMessage(message: unknown, targetOrigin: string): void };
    attrs: Record<string, string>;
    listeners: Listener[];
    getBoundingClientRect(): { left: number; top: number; width: number; height: number };
    getAttribute(name: string): string | null;
    addEventListener(type: string, fn: () => void): void;
}

let win: Record<string, unknown> & { location: { origin: string; hostname: string } };
/** Append-only: what was ever installed. */
let installed: Listener[];
/** Currently attached, so removing really removes — otherwise a disposed host still fires. */
let active: Listener[];
let removed: Listener[];
let intervals: { fn: () => void; ms: number; cleared: boolean }[];
let rafQueue: (() => void)[];
let documentFrames: StubFrame[];
let posted: { frame: StubFrame; message: unknown }[];
let created: { tag: string; attrs: Record<string, string>; style: Record<string, string> }[];
let host: ExternalMediaHost;

const CONTENT = 'https://lms.example/pluginfile/1/mod/a1b2c3d4e5f6a7b8/index.html';

function makeFrame(src = CONTENT, attrs: Record<string, string> = {}): StubFrame {
    const frame: StubFrame = {
        src,
        attrs,
        listeners: [],
        contentWindow: { postMessage: message => posted.push({ frame, message }) },
        getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 600 }),
        getAttribute: name => attrs[name] ?? null,
        addEventListener: (type, fn) => frame.listeners.push({ type, fn }),
    };
    return frame;
}

const fire = (type: string, event?: unknown) => active.filter(l => l.type === type).forEach(l => l.fn(event));
const flushFrames = () => {
    const queued = rafQueue.splice(0);
    queued.forEach(fn => fn());
};
const hello = (frame: StubFrame) => ({ source: frame.contentWindow, data: { type: 'exe-embed', action: 'hello' } });
const syncOne = (frame: StubFrame, id = 'e1') => ({
    source: frame.contentWindow,
    data: {
        type: 'exe-embed',
        action: 'sync',
        embeds: [
            {
                id,
                x: 0,
                y: 0,
                w: 480,
                h: 270,
                url: 'https://www.youtube.com/embed/x',
                provider: 'youtube',
                objectId: 'aqz-KE-bpKQ',
            },
        ],
    },
});
const players = () => created.filter(node => node.tag === 'iframe');
const overlayBoxes = () => created.filter(node => node.attrs.class === 'exe-embed-overlay');
const requestsTo = (frame: StubFrame) =>
    posted.filter(entry => entry.frame === frame && (entry.message as { action?: string })?.action === 'request')
        .length;

beforeEach(() => {
    installed = [];
    active = [];
    removed = [];
    intervals = [];
    rafQueue = [];
    documentFrames = [];
    posted = [];
    created = [];

    win = {
        location: { origin: 'https://lms.example', hostname: 'lms.example' },
        document: {
            createElement: (tag: string) => {
                const node = {
                    tag,
                    attrs: {} as Record<string, string>,
                    style: {} as Record<string, string>,
                    setAttribute(name: string, value: string) {
                        node.attrs[name] = value;
                    },
                    appendChild() {},
                    parentNode: null,
                };
                created.push(node);
                return node;
            },
            body: { appendChild: () => {} },
            documentElement: { scrollLeft: 0, scrollTop: 0 },
            getElementsByTagName: (tag: string) => (tag === 'iframe' ? documentFrames : []),
        },
        addEventListener: (type: string, fn: (event?: unknown) => void, capture?: boolean) => {
            installed.push({ type, fn, capture });
            active.push({ type, fn, capture });
        },
        removeEventListener: (type: string, fn: (event?: unknown) => void, capture?: boolean) => {
            removed.push({ type, fn, capture });
            active = active.filter(
                l => !(l.type === type && l.fn === fn && (l.capture ?? false) === (capture ?? false)),
            );
        },
        setInterval: (fn: () => void, ms: number) => {
            intervals.push({ fn, ms, cleared: false });
            return intervals.length - 1;
        },
        clearInterval: (handle: number) => {
            if (intervals[handle]) intervals[handle].cleared = true;
        },
        setTimeout: (fn: () => void) => {
            rafQueue.push(fn);
            return 0;
        },
        requestAnimationFrame: (fn: () => void) => {
            rafQueue.push(fn);
            return rafQueue.length;
        },
    };

    host = createExternalMediaHost(win as never);
});

describe('starting up', () => {
    it('routes window messages into the runtime', () => {
        const frame = makeFrame();
        host.attach(frame as never);

        fire('message', hello(frame));

        expect(posted.map(entry => entry.message)).toEqual([{ type: 'exe-embed', action: 'welcome' }]);
    });

    it('ignores a message from a window it never attached', () => {
        host.attach(makeFrame() as never);

        fire('message', { source: { stranger: true }, data: { type: 'exe-embed', action: 'hello' } });

        expect(posted).toHaveLength(0);
    });

    /**
     * A panel or sidebar can move the content frame with no scroll, resize or animation
     * event at all. The poll is the only thing that catches that, so it has to actually
     * re-place the overlay, not merely exist.
     */
    it('re-places an overlay that drifted with no event to announce it', () => {
        const frame = makeFrame();
        host.attach(frame as never);
        fire('message', hello(frame));
        fire('message', syncOne(frame));

        expect(intervals).toHaveLength(1);
        expect(intervals[0].ms).toBeLessThanOrEqual(500);

        const before = overlayBoxes()[0].style.top;
        frame.getBoundingClientRect = () => ({ left: 100, top: 400, width: 800, height: 600 });
        intervals[0].fn();

        expect(overlayBoxes()[0].style.top).not.toBe(before);
    });

    it('installs its listeners once however many frames attach', () => {
        host.attach(makeFrame() as never);
        host.attach(makeFrame('https://lms.example/pkg/two.html') as never);

        expect(active.filter(l => l.type === 'message')).toHaveLength(1);
        expect(intervals).toHaveLength(1);
    });
});

describe('keeping overlays under the content', () => {
    let frame: StubFrame;

    beforeEach(() => {
        frame = makeFrame();
        host.attach(frame as never);
        fire('message', hello(frame));
        posted.length = 0;
    });

    /** Scroll fires per event; re-placing overlays on each one would be hundreds a second. */
    it('coalesces a burst of scroll and resize into one pass', () => {
        fire('scroll');
        fire('scroll');
        fire('resize');

        expect(rafQueue).toHaveLength(1);
    });

    it('schedules again once the previous pass has run', () => {
        fire('scroll');
        flushFrames();
        fire('scroll');

        expect(rafQueue).toHaveLength(1);
    });

    /**
     * The case the incumbent missed: a sidebar or preview panel ANIMATES the content frame
     * into place, and the geometry at the start of that animation is not where it lands.
     */
    it('re-measures when a host animation lands', () => {
        expect(active.some(l => l.type === 'transitionend')).toBe(true);
        expect(active.some(l => l.type === 'animationend')).toBe(true);
    });
});

describe('a frame that navigates', () => {
    let frame: StubFrame;

    const load = () => frame.listeners.filter(l => l.type === 'load').forEach(l => l.fn());

    beforeEach(() => {
        frame = makeFrame();
        host.attach(frame as never);
        fire('message', hello(frame));
        posted.length = 0;
    });

    /**
     * Measured in three browsers: the child announces itself while the document is still
     * parsing, so the frame's `load` fires AFTER the handshake it belongs to. Treating
     * every load as a navigation therefore tears down the welcome of the very document
     * that just completed — and every report after it is refused.
     */
    it('keeps the welcome when the document it belongs to finishes loading', () => {
        load();
        fire('message', syncOne(frame));

        expect(players()).toHaveLength(1);
    });

    /** A different document in the same window must handshake for itself. */
    it('re-gates when the frame is pointed at a different document', () => {
        fire('message', syncOne(frame));
        expect(players()).toHaveLength(1);

        frame.src = 'https://lms.example/pluginfile/1/mod/a1b2c3d4e5f6a7b8/page2.html';
        load();

        // The old document's player is gone and the new document is not trusted yet.
        fire('message', syncOne(frame, 'e2'));
        expect(players()).toHaveLength(1);

        // ...until it announces itself.
        fire('message', hello(frame));
        fire('message', syncOne(frame, 'e2'));
        expect(players()).toHaveLength(2);
    });
});

describe('discovering frames the way the relay always did', () => {
    it('registers and pings the content iframes on the page', () => {
        const first = makeFrame();
        const second = makeFrame('https://lms.example/pkg/two.html');
        documentFrames.push(first, second);

        host.scan();

        expect(requestsTo(first)).toBe(1);
        expect(requestsTo(second)).toBe(1);
    });

    /** A promoted player is ours; treating it as content would loop the protocol. */
    it('skips promoted players', () => {
        const player = makeFrame('https://www.youtube-nocookie.com/embed/x', { 'data-exe-embed-player': '1' });
        documentFrames.push(player);

        host.scan();

        expect(requestsTo(player)).toBe(0);
    });

    /**
     * Counting welcomes cannot see this: two registrations of one window both resolve to
     * it, so the handshake looks identical. What a duplicate actually costs is a second
     * overlay stacked over the same frame, and a second copy of every player in it.
     */
    it('does not register the same frame twice', () => {
        const frame = makeFrame();
        documentFrames.push(frame);

        expect(host.scan()).toBe(1);
        expect(host.scan()).toBe(0);

        fire('message', hello(frame));
        fire('message', {
            source: frame.contentWindow,
            data: {
                type: 'exe-embed',
                action: 'sync',
                embeds: [
                    {
                        id: 'e1',
                        x: 0,
                        y: 0,
                        w: 480,
                        h: 270,
                        url: 'https://www.youtube.com/embed/x',
                        provider: 'youtube',
                        objectId: 'aqz-KE-bpKQ',
                    },
                ],
            },
        });

        expect(created.filter(node => node.attrs.class === 'exe-embed-overlay')).toHaveLength(1);
        expect(created.filter(node => node.tag === 'iframe')).toHaveLength(1);
    });

    /**
     * The order Moodle uses, and the one that broke: its `init()` runs 243 lines BEFORE
     * the content iframe appears, deliberately, so the message listener is installed
     * before the frame can load. A scan at that moment registers nothing, and a host that
     * only ever knew what `scan()` found would never welcome that frame — the child then
     * waits forever and the reader is left with unpromoted embeds.
     *
     * The incumbent resolved senders lazily on every message, and that is the behaviour
     * being restored. Adoption stays safe because only a window that IS an iframe of this
     * document can be adopted: the same trust anchor, applied later.
     */
    it('welcomes a frame that did not exist when it was initialised', () => {
        host.scan(); // nothing in the document yet, exactly as Moodle's init sees it
        expect(documentFrames).toHaveLength(0);

        const late = makeFrame();
        documentFrames.push(late);
        fire('message', hello(late));

        expect(posted.map(entry => (entry.message as { action?: string }).action)).toContain('welcome');
    });

    it('refuses to adopt a window that is not a frame of this document', () => {
        host.scan();

        fire('message', { source: { stranger: true }, data: { type: 'exe-embed', action: 'hello' } });

        expect(posted).toHaveLength(0);
    });

    /** A promoted player is ours; adopting one would have the relay talking to itself. */
    it('refuses to adopt a promoted player, however it announces itself', () => {
        host.scan();
        const player = makeFrame('https://www.youtube-nocookie.com/embed/x', { 'data-exe-embed-player': '1' });
        documentFrames.push(player);

        fire('message', hello(player));

        expect(posted).toHaveLength(0);
    });

    it('picks up a frame added to the page after the first scan', () => {
        host.scan();
        const late = makeFrame();
        documentFrames.push(late);

        host.scan();

        expect(requestsTo(late)).toBe(1);
    });
});

describe('shutting down', () => {
    it('takes away every listener it installed', () => {
        host.attach(makeFrame() as never);

        host.dispose();

        const wanted = installed.map(l => `${l.type}:${l.capture ?? false}`).sort();
        const takenAway = removed.map(l => `${l.type}:${l.capture ?? false}`).sort();
        expect(takenAway).toEqual(wanted);
        expect(active).toHaveLength(0);
    });

    it('stops the drift poll', () => {
        host.attach(makeFrame() as never);

        host.dispose();

        expect(intervals[0].cleared).toBe(true);
    });

    it('can start again afterwards', () => {
        const frame = makeFrame();
        host.attach(frame as never);
        host.dispose();

        const again = makeFrame();
        host.attach(again as never);
        fire('message', hello(again));

        expect(posted.map(entry => entry.message)).toEqual([{ type: 'exe-embed', action: 'welcome' }]);
    });

    it('survives being disposed twice', () => {
        host.attach(makeFrame() as never);
        host.dispose();
        expect(() => host.dispose()).not.toThrow();
    });
});

describe('clearing and re-placing', () => {
    let frame: StubFrame;

    beforeEach(() => {
        frame = makeFrame();
        host.attach(frame as never);
        fire('message', hello(frame));
        fire('message', syncOne(frame));
    });

    /**
     * `clear()` is what the editor's preview host calls when the panel closes: the players
     * go, the registration stays, so reopening does not need a fresh handshake.
     */
    it('removes the players but keeps the frame registered', () => {
        expect(players()).toHaveLength(1);

        host.clear();
        posted.length = 0;
        fire('message', syncOne(frame, 'e2'));

        expect(players()).toHaveLength(2);
    });

    it('re-places the overlay on demand', () => {
        const before = overlayBoxes()[0].style.top;
        frame.getBoundingClientRect = () => ({ left: 100, top: 400, width: 800, height: 600 });

        host.reflow();

        expect(overlayBoxes()[0].style.top).not.toBe(before);
    });
});

describe('detaching one frame', () => {
    it('stops relaying for it without disturbing its neighbour', () => {
        const first = makeFrame();
        const second = makeFrame('https://lms.example/pkg/two.html');
        const attached = host.attach(first as never);
        host.attach(second as never);

        attached.detach();
        posted.length = 0;
        fire('message', hello(first));
        fire('message', hello(second));

        expect(posted).toHaveLength(1);
        expect(posted[0].frame).toBe(second);
    });
});

describe('the published globals', () => {
    beforeEach(() => publishHost(win as never));

    it('publishes a host new code can create for itself', () => {
        const created = (win.exeExternalMediaHost as { create(options?: unknown): ExternalMediaHost }).create();
        const frame = makeFrame();

        created.attach(frame as never);
        fire('message', hello(frame));

        expect(posted.map(entry => entry.message)).toEqual([{ type: 'exe-embed', action: 'welcome' }]);
    });

    /** Five repositories call `window.exeEmbedRelay.init(config)`; it keeps working. */
    it('keeps the legacy relay entry point working', () => {
        const frame = makeFrame();
        documentFrames.push(frame);

        const relay = (win.exeEmbedRelay as { init(config: unknown): { clear(): void; dispose(): void } }).init({
            mode: 'open',
        });

        expect(requestsTo(frame)).toBe(1);
        expect(typeof relay.clear).toBe('function');
        expect(typeof relay.dispose).toBe('function');
    });

    /** The incumbent's `init()` was idempotent; a second call must not stack listeners. */
    it('can be initialised twice without stacking listeners', () => {
        documentFrames.push(makeFrame());
        const relay = (win.exeEmbedRelay as { init(config: unknown): { init(): unknown } }).init({ mode: 'open' });

        relay.init();

        expect(active.filter(l => l.type === 'message')).toHaveLength(1);
        expect(intervals.filter(i => !i.cleared)).toHaveLength(1);
    });

    it('reflows and clears through the legacy handle', () => {
        const frame = makeFrame();
        documentFrames.push(frame);
        const relay = (win.exeEmbedRelay as { init(config: unknown): { clear(): void; reflow(): void } }).init({
            mode: 'open',
        });
        fire('message', hello(frame));
        fire('message', syncOne(frame));
        expect(players()).toHaveLength(1);

        relay.reflow();
        relay.clear();
        fire('message', syncOne(frame, 'e2'));

        expect(players()).toHaveLength(2);
    });

    /** The editor's preview host calls this when the panel is torn down. */
    it('shuts down through the legacy handle', () => {
        documentFrames.push(makeFrame());
        const relay = (win.exeEmbedRelay as { init(config: unknown): { dispose(): void } }).init({ mode: 'open' });

        relay.dispose();

        expect(active).toHaveLength(0);
        expect(intervals.every(i => i.cleared)).toBe(true);
    });

    it('carries the strict mode and whitelist through', () => {
        const frame = makeFrame();
        documentFrames.push(frame);
        (win.exeEmbedRelay as { init(config: unknown): unknown }).init({
            mode: 'strict',
            whitelist: ['player.vimeo.com'],
        });
        fire('message', hello(frame));

        // youtube is not on the whitelist, so strict mode must refuse it.
        fire('message', {
            source: frame.contentWindow,
            data: {
                type: 'exe-embed',
                action: 'sync',
                embeds: [
                    {
                        id: 'e1',
                        x: 0,
                        y: 0,
                        w: 480,
                        h: 270,
                        url: 'https://www.youtube.com/embed/x',
                        provider: 'youtube',
                        objectId: 'aqz-KE-bpKQ',
                    },
                ],
            },
        });

        expect(created.filter(node => node.tag === 'iframe')).toHaveLength(0);
    });

    /**
     * The media half attaches per content frame and separately from the embed half: they
     * share a page but nothing else, so a host can adopt one without the other.
     */
    it('attaches the media half to a content frame', () => {
        (win as Record<string, unknown>).MessageChannel = class {
            port1 = { postMessage: () => {}, start: () => {}, close: () => {}, onmessage: null };
            port2 = {};
        };
        const frame = makeFrame();

        const attached = (win.exeExternalMediaHost as { attachMedia(f: unknown): { detach(): void } }).attachMedia(
            frame as never,
        );

        // A hello from that frame is answered with a welcome carrying a transferred port.
        fire('message', {
            source: frame.contentWindow,
            data: { type: 'exe-media', v: 1, action: 'hello', helloId: 'h1' },
        });
        expect(posted.map(e => (e.message as { action?: string }).action)).toContain('welcome');

        expect(() => attached.detach()).not.toThrow();
    });

    it('keeps the legacy media host name working', () => {
        (win as Record<string, unknown>).MessageChannel = class {
            port1 = { postMessage: () => {}, start: () => {}, close: () => {}, onmessage: null };
            port2 = {};
        };
        const legacy = win.exeMediaHost as { attach(f: unknown): { detach(): void } };

        const attached = legacy.attach(makeFrame() as never);

        expect(typeof attached.detach).toBe('function');
        attached.detach();
    });

    it('announces the legacy name once, on use, and not before', () => {
        const warnings: string[] = [];
        publishHost(win as never, { warn: message => warnings.push(message) });
        expect(warnings).toHaveLength(0);

        void (win.exeEmbedRelay as { init: unknown }).init;
        void (win.exeEmbedRelay as { init: unknown }).init;

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('exeExternalMediaHost');
    });

    it('leaves the new name unwrapped, with nothing to warn about', () => {
        const warnings: string[] = [];
        publishHost(win as never, { warn: message => warnings.push(message) });

        void (win.exeExternalMediaHost as { create: unknown }).create;

        expect(warnings).toHaveLength(0);
    });
});
