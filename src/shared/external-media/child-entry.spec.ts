import { beforeEach, describe, expect, it } from 'bun:test';
import { bootWhenReady, publishChild, startChild, type ChildEntry } from './child-entry';

/**
 * As with the host entry, what is worth asserting here is the WIRING: which observers get
 * installed, WHEN they get installed, and what they call. The DOM work they drive is
 * covered by `embed-scanner` and, end to end in three browsers, by the artifact E2E.
 *
 * The load-bearing property in this file is that nothing is observed until a host has
 * answered. A dormant document that installs a MutationObserver over its own body is a
 * permanent cost paid by every `file://` package that will never have a host.
 */
interface Observed {
    target: unknown;
    options?: unknown;
}

let posted: unknown[];
let listeners: { type: string; fn: (event?: unknown) => void; capture?: boolean }[];
let timers: (() => void)[];
let mutationObserved: Observed[];
let resizeObserved: Observed[];
let fireMutation: () => void;
let fireResize: () => void;
let scanned: string[];
let win: Record<string, unknown>;
let entry: ChildEntry;

const parent = { postMessage: (message: unknown) => posted.push(message) };

const fire = (type: string, event?: unknown) => listeners.filter(l => l.type === type).forEach(l => l.fn(event));
const welcome = () => fire('message', { source: parent, data: { type: 'exe-embed', action: 'welcome' } });
const syncs = () => posted.filter(m => (m as { action?: string }).action === 'sync');

beforeEach(() => {
    posted = [];
    listeners = [];
    timers = [];
    mutationObserved = [];
    resizeObserved = [];
    scanned = [];
    fireMutation = () => {};
    fireResize = () => {};

    const documentElement = { name: 'documentElement' };
    // Recording the SELECTOR, not just the fact of a query: `promote` looks for
    // `iframe[src]` and `collect` for the placeholder attribute, so this is what tells
    // a re-promote apart from a mere re-measure.
    const body = {
        name: 'body',
        querySelectorAll: (selector: string) => {
            scanned.push(selector);
            return [];
        },
    };

    win = {
        parent,
        // Opaque and framed, so the runtime is willing to start at all.
        origin: 'null',
        top: { name: 'top' },
        self: undefined,
        location: { href: 'https://lms.example/preview/page.html' },
        document: {
            cookie: '',
            readyState: 'complete',
            documentElement,
            body,
            querySelectorAll: (selector: string) => {
                scanned.push(selector);
                return [];
            },
            addEventListener: (type: string, fn: () => void) => listeners.push({ type, fn }),
        },
        addEventListener: (type: string, fn: (event?: unknown) => void, capture?: boolean) =>
            listeners.push({ type, fn, capture }),
        setTimeout: (fn: () => void) => {
            timers.push(fn);
            return timers.length;
        },
        MutationObserver: class {
            constructor(callback: () => void) {
                fireMutation = callback;
            }
            observe(target: unknown, options?: unknown) {
                mutationObserved.push({ target, options });
            }
        },
        ResizeObserver: class {
            constructor(callback: () => void) {
                fireResize = callback;
            }
            observe(target: unknown) {
                resizeObserved.push({ target });
            }
        },
    };
    win.self = win;

    entry = startChild(win as never);
});

describe('before a host answers', () => {
    it('announces itself and waits', () => {
        expect(posted.map(m => (m as { action: string }).action)).toEqual(['hello']);
        expect(entry.runtime.isActivated()).toBe(false);
    });

    /**
     * The point of the whole handshake. A `file://` package or a third-party LMS gets a
     * document that stays exactly as authored — and pays for no observers either.
     */
    it('observes nothing', () => {
        expect(mutationObserved).toHaveLength(0);
        expect(resizeObserved).toHaveLength(0);
        expect(listeners.filter(l => l.type === 'scroll')).toHaveLength(0);
    });

    it('refuses to start outside a frame', () => {
        // `isFramed` asks whether `parent` is this window, so a top-level document is one
        // that is its own parent.
        const alone = { ...win } as Record<string, unknown>;
        alone.parent = alone;
        alone.self = alone;
        alone.top = alone;
        posted.length = 0;

        const solo = startChild(alone as never);

        expect(solo.started).toBe(false);
        expect(posted).toHaveLength(0);
    });
});

describe('once a host answers', () => {
    beforeEach(() => welcome());

    it('watches the document for content that arrives or moves', () => {
        expect(mutationObserved).toHaveLength(1);
        expect(mutationObserved[0].options).toMatchObject({ childList: true, subtree: true, attributes: true });
    });

    /** A drawer pushing the content column fires no window resize. */
    it('watches the box itself, not only the window', () => {
        expect(resizeObserved.length).toBeGreaterThan(0);
    });

    /**
     * Firing them rather than only checking they are registered: a handler wired to the
     * wrong call is registered just as convincingly as a correct one.
     */
    it.each(['scroll', 'resize', 'transitionend', 'animationend'])('re-measures on %s', type => {
        scanned.length = 0;

        fire(type);

        expect(scanned.length).toBeGreaterThan(0);
        // Moving what is already there; none of these should go hunting for new embeds.
        expect(scanned).not.toContain('iframe[src]');
    });

    it('installs its observers once, not on every welcome', () => {
        welcome();
        welcome();

        expect(mutationObserved).toHaveLength(1);
        expect(listeners.filter(l => l.type === 'scroll')).toHaveLength(1);
    });

    it('re-promotes what a mutation brought in', () => {
        scanned.length = 0;

        fireMutation();

        expect(scanned).toContain('iframe[src]');
    });

    /** Resizing moves what is already there; it must not go hunting for new embeds. */
    it('re-measures on a resize without re-promoting', () => {
        scanned.length = 0;

        fireResize();

        expect(scanned.length).toBeGreaterThan(0);
        expect(scanned).not.toContain('iframe[src]');
    });

    /**
     * `load` is when late images have finally settled the layout, so this one report is
     * forced through rather than skipped as unchanged.
     */
    it('forces a report once the page has fully loaded', () => {
        posted.length = 0;

        fire('load');

        expect(syncs()).toHaveLength(1);
    });
});

/**
 * Measured in three browsers, not imagined: `replaceChild` on the last pending iframe
 * dispatches the window `load` event SYNCHRONOUSLY, because discarding it completes the
 * document load. Any listener that scans from there re-enters the scan it interrupted,
 * holding a node list captured before a single replacement happened — and promotes every
 * one of them a second time.
 *
 * The `load` handler no longer promotes, which removes the case that was actually hit.
 * This guard removes the whole class: a browser may dispatch events synchronously from
 * inside a DOM mutation, and there is no useful meaning for a promotion that starts
 * inside another one.
 */
describe('re-entrancy during promotion', () => {
    it('ignores a promotion that starts inside a promotion', () => {
        const queries: string[] = [];
        let reentered = 0;
        let entry: ChildEntry;

        // A body whose query synchronously re-enters the scan, exactly as a `load` event
        // dispatched from inside `replaceChild` does in a real browser.
        const body = {
            querySelectorAll: (selector: string) => {
                queries.push(selector);
                if (selector === 'iframe[src]' && reentered === 0) {
                    reentered += 1;
                    entry.runtime.rescan();
                }
                return [];
            },
        };

        // Its own listener list, so only this entry's handshake is driven here.
        const own: typeof listeners = [];
        entry = startChild({
            ...(win as never),
            document: { ...(win.document as object), body },
            addEventListener: (type: string, fn: (event?: unknown) => void) => own.push({ type, fn }),
        } as never);
        own.filter(l => l.type === 'message').forEach(l =>
            l.fn({ source: parent, data: { type: 'exe-embed', action: 'welcome' } }),
        );

        expect(reentered).toBe(1);
        // The inner call found the guard closed and did nothing, so exactly one promotion
        // pass ran — not two, and no second set of placeholders.
        expect(queries.filter(q => q === 'iframe[src]')).toHaveLength(1);
    });
});

/**
 * The placeholders must be in place before the page is painted, or the reader watches the
 * embeds pop in. `load` would be too late; not waiting at all would scan a body that does
 * not exist yet.
 */
describe('deciding when to boot', () => {
    it('runs straight away when the document is already parsed', () => {
        let booted = 0;
        const listeners: string[] = [];

        bootWhenReady(
            { readyState: 'complete', addEventListener: (type: string) => listeners.push(type) } as never,
            () => {
                booted += 1;
            },
        );

        expect(booted).toBe(1);
        expect(listeners).toEqual([]);
    });

    it('waits for DOMContentLoaded while the document is still parsing', () => {
        let booted = 0;
        const listeners: { type: string; fn: () => void }[] = [];

        bootWhenReady(
            {
                readyState: 'loading',
                addEventListener: (type: string, fn: () => void) => listeners.push({ type, fn }),
            } as never,
            () => {
                booted += 1;
            },
        );

        expect(booted).toBe(0);
        expect(listeners.map(l => l.type)).toEqual(['DOMContentLoaded']);

        listeners.forEach(l => l.fn());
        expect(booted).toBe(1);
    });

    /** An `interactive` document has a body already; there is nothing left to wait for. */
    it('runs straight away once parsing is interactive', () => {
        let booted = 0;
        bootWhenReady({ readyState: 'interactive', addEventListener: () => {} } as never, () => {
            booted += 1;
        });
        expect(booted).toBe(1);
    });
});

describe('the published globals', () => {
    it('publishes a name new code can start from', () => {
        publishChild(win as never);
        posted.length = 0;

        const started = (win.exeExternalMediaChild as { start(): ChildEntry }).start();

        expect(started.started).toBe(true);
        expect(posted.map(m => (m as { action: string }).action)).toContain('hello');
    });

    it('keeps the legacy shim entry point working', () => {
        publishChild(win as never);
        posted.length = 0;

        const runtime = (win.exeEmbedShim as { createRuntime(): { isActivated(): boolean } }).createRuntime();

        expect(runtime.isActivated()).toBe(false);
        expect(posted.map(m => (m as { action: string }).action)).toContain('hello');
    });

    it('announces the legacy name once, on use, and not before', () => {
        const warnings: string[] = [];
        publishChild(win as never, { warn: message => warnings.push(message) });
        expect(warnings).toHaveLength(0);

        void (win.exeEmbedShim as { createRuntime: unknown }).createRuntime;
        void (win.exeEmbedShim as { isOpaqueOrigin: unknown }).isOpaqueOrigin;

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('exeExternalMediaChild');
    });

    it('reports the opaque-origin verdict the legacy callers ask it for', () => {
        publishChild(win as never);
        const shim = win.exeEmbedShim as { isOpaqueOrigin(w: unknown): boolean };

        expect(shim.isOpaqueOrigin(win)).toBe(true);
        expect(shim.isOpaqueOrigin({ origin: 'https://lms.example', document: {}, location: {} })).toBe(false);
    });
});
