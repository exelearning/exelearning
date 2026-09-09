import { describe, expect, it, beforeEach } from 'bun:test';
import { createChildRuntime, type ChildHostWindow, type EmbedScanner } from './child-runtime';
import type { EmbedRecord } from './embed-scanner';

/**
 * These mirror the incumbent `exe_embed_shim.test.js` case for case. Equivalence on the
 * tested surface is the point: ADR-2199-11 switches loaders only once the canonical runtime
 * does everything the shipped one does.
 *
 * The scanner is injected, so this exercises the handshake — the part with the security
 * consequences — with no DOM engine involved. The DOM behaviour itself is covered end to
 * end in three browsers by `external-media-artifacts.spec.ts`.
 */

let posted: unknown[];
let timers: (() => void)[];
let listeners: unknown[];
let win: ChildHostWindow;
let scanner: EmbedScanner & { promoted: number };

const EMBED: EmbedRecord = {
    id: 'exe-embed-1',
    url: 'https://www.youtube.com/embed/aqz-KE-bpKQ',
    x: 0,
    y: 0,
    w: 560,
    h: 315,
    provider: 'youtube',
    objectId: 'aqz-KE-bpKQ',
};

function makeWin(over: Partial<ChildHostWindow> = {}): ChildHostWindow {
    return {
        parent: { postMessage: (message: unknown) => posted.push(message) },
        origin: 'null',
        document: { cookie: '' },
        location: { href: 'https://lms.example/preview/page.html' },
        addEventListener: (_type: string, listener: unknown) => listeners.push(listener),
        setTimeout: (handler: () => void) => {
            timers.push(handler);
            return timers.length;
        },
        ...over,
    } as ChildHostWindow;
}

/** Reports nothing until promoted, exactly as the real scanner does. */
function makeScanner(): EmbedScanner & { promoted: number } {
    let promoted = 0;
    return {
        get promoted() {
            return promoted;
        },
        promote: () => {
            promoted += 1;
        },
        collect: (): EmbedRecord[] => (promoted > 0 ? [EMBED] : []),
    } as EmbedScanner & { promoted: number };
}

beforeEach(() => {
    posted = [];
    timers = [];
    listeners = [];
    win = makeWin();
    scanner = makeScanner();
});

const welcome = () => ({ source: win.parent, data: { type: 'exe-embed', action: 'welcome' } });
const request = () => ({ source: win.parent, data: { type: 'exe-embed', action: 'request' } });
const actions = () => posted.map(m => (m as { action: string }).action);
const syncs = () => posted.filter(m => (m as { action: string }).action === 'sync');
const hellos = () => actions().filter(a => a === 'hello').length;

describe('createChildRuntime', () => {
    it('does not scan or promote before a host answers', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();

        expect(scanner.promoted).toBe(0);
        expect(runtime.isActivated()).toBe(false);
        expect(syncs()).toHaveLength(0);
    });

    it('announces itself on start', () => {
        createChildRuntime(win, scanner).start();
        expect(actions()).toContain('hello');
    });

    it('promotes once welcomed and reports provider and id, not the author URL', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage(welcome());

        expect(runtime.isActivated()).toBe(true);
        expect(scanner.promoted).toBe(1);

        const sync = syncs()[0] as { embeds: EmbedRecord[] };
        expect(sync.embeds[0].provider).toBe('youtube');
        expect(sync.embeds[0].objectId).toBe('aqz-KE-bpKQ');
    });

    it('ignores a welcome from a window that is not the parent', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage({ source: { other: true }, data: { type: 'exe-embed', action: 'welcome' } });

        expect(runtime.isActivated()).toBe(false);
        expect(scanner.promoted).toBe(0);
    });

    it('ignores messages outside the protocol', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage({ source: win.parent, data: { type: 'other', action: 'welcome' } });
        runtime.handleHostMessage({ source: win.parent, data: null });
        runtime.handleHostMessage({ source: win.parent, data: { type: 'exe-embed', action: 'evaluate' } });

        expect(runtime.isActivated()).toBe(false);
    });

    /** A broadcast ping must never unlock a document the host has not accepted. */
    it('does not activate on a re-sync ping, only on a welcome', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage(request());

        expect(runtime.isActivated()).toBe(false);
        expect(scanner.promoted).toBe(0);
    });

    it('re-announces when a ping arrives while dormant, recovering a late host', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        const before = hellos();

        runtime.handleHostMessage(request());

        expect(hellos()).toBeGreaterThan(before);
    });

    it('re-reports geometry on a ping once activated, without promoting twice', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage(welcome());
        const before = syncs().length;

        runtime.handleHostMessage(request());

        expect(syncs().length).toBeGreaterThan(before);
        expect(scanner.promoted).toBe(1);
    });

    it('re-runs a scan on a second welcome, so a navigated host recovers', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage(welcome());
        runtime.handleHostMessage(welcome());

        expect(scanner.promoted).toBe(2);
    });

    it('re-announces on a schedule while unanswered, then stops once welcomed', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        const first = hellos();

        timers.splice(0).forEach(run => run());
        expect(hellos()).toBeGreaterThan(first);

        runtime.handleHostMessage(welcome());
        const afterWelcome = hellos();
        timers.splice(0).forEach(run => run());
        expect(hellos()).toBe(afterWelcome);
    });

    it('skips an unchanged geometry report but always posts a forced one', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage(welcome());
        // Every subsequent ping is forced, so an identical geometry still posts.
        runtime.handleHostMessage(request());
        expect(syncs().length).toBe(2);
    });

    it('stays dormant outside an opaque origin', () => {
        const runtime = createChildRuntime(makeWin({ origin: 'https://lms.example' }), scanner);
        expect(runtime.start()).toBe(false);
        expect(posted).toHaveLength(0);
    });

    it('stays dormant when it is not framed', () => {
        const top = makeWin();
        (top as { parent: unknown }).parent = top;
        expect(createChildRuntime(top, scanner).start()).toBe(false);
    });

    it('survives a parent that throws on postMessage', () => {
        const hostile = makeWin({
            parent: {
                postMessage: () => {
                    throw new Error('unreachable');
                },
            },
        });
        expect(() => createChildRuntime(hostile, scanner).start()).not.toThrow();
    });

    it('notifies the caller on activation so observers attach only then', () => {
        let activated = 0;
        const runtime = createChildRuntime(win, scanner, { onActivate: () => (activated += 1) });
        runtime.start();
        expect(activated).toBe(0);

        runtime.handleHostMessage(welcome());
        runtime.handleHostMessage(welcome());
        expect(activated).toBe(1);
    });

    it('registers its message listener on start', () => {
        createChildRuntime(win, scanner).start();
        expect(listeners).toHaveLength(1);
    });
});

/**
 * The observers live in the entry, not here, so this runtime stays free of any DOM
 * dependency. These two are what they call. Both must be inert while dormant: an
 * unhosted document — `file://`, a third-party LMS, an ePub reader — must never be
 * pushed into promoting embeds nobody will fill.
 */
describe('re-reporting on demand', () => {
    it('reports again when the geometry changed', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage(welcome());
        posted.length = 0;

        scanner.collect = () => [{ ...EMBED, y: 400 }];
        runtime.refresh();

        expect(syncs()).toHaveLength(1);
    });

    /** An attribute-noisy page would otherwise spam the host on every mutation. */
    it('stays quiet when nothing moved', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage(welcome());
        posted.length = 0;

        runtime.refresh();
        runtime.refresh();

        expect(syncs()).toHaveLength(0);
    });

    it('promotes newly arrived embeds when asked to rescan', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage(welcome());
        const before = scanner.promoted;

        runtime.rescan();

        expect(scanner.promoted).toBe(before + 1);
    });

    it('does nothing at all while dormant', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        posted.length = 0;

        runtime.refresh();
        runtime.rescan();

        expect(scanner.promoted).toBe(0);
        expect(syncs()).toHaveLength(0);
    });
});

/**
 * `load` is the moment late images have finally settled the layout — and the geometry
 * they settled into is often the same JSON the last observer pass already sent, so an
 * unchanged-skip would swallow exactly the report that matters most.
 */
describe('resyncing unconditionally', () => {
    it('reports even when nothing appears to have moved', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage(welcome());
        posted.length = 0;

        runtime.resync();

        expect(syncs()).toHaveLength(1);
    });

    /**
     * Measured, not assumed: `replaceChild` on the last pending iframe SYNCHRONOUSLY
     * dispatches the window `load` event, because discarding it completes the document
     * load. A `load` handler that promoted would therefore re-enter the promotion it was
     * dispatched from, with a node list captured before any of it happened — which is
     * precisely the duplicate-placeholder crash the browsers showed. Reporting is safe
     * to do from there; promoting is not, and the mutation observer covers it anyway.
     */
    it('reports without promoting, so it is safe to call from a load handler', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        runtime.handleHostMessage(welcome());
        const before = scanner.promoted;

        runtime.resync();

        expect(scanner.promoted).toBe(before);
    });

    it('does nothing at all while dormant', () => {
        const runtime = createChildRuntime(win, scanner);
        runtime.start();
        posted.length = 0;

        runtime.resync();

        expect(scanner.promoted).toBe(0);
        expect(syncs()).toHaveLength(0);
    });
});
