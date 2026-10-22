import { beforeEach, describe, expect, it } from 'bun:test';
import {
    createDomOverlayAdapter,
    OVERLAY_CLASS,
    PLAYER_MARKER_ATTR,
    type AdapterDocument,
    type AdapterElement,
    type AdapterFrame,
} from './dom-overlay-adapter';
import type { OverlayAdapter } from './host-runtime';
import type { PlayerDescriptor } from './player-descriptor';

/**
 * A minimal document stub rather than a DOM engine: happy-dom's query APIs throw under
 * raw `bun test`, and the real thing is already covered end to end in three browsers by
 * `external-media-artifacts.spec.ts`. What is worth asserting here is what the adapter
 * writes — the attributes that constitute the isolation, and the styles that constitute
 * the clip.
 */
interface StubElement extends AdapterElement {
    tag: string;
    attrs: Record<string, string>;
    children: StubElement[];
    removed: boolean;
}

let created: StubElement[];
let appendedToBody: StubElement[];
let posted: unknown[];
let frameRect: { left: number; top: number; width: number; height: number };
let doc: AdapterDocument;
let adapter: OverlayAdapter;

function element(tag: string): StubElement {
    const node: StubElement = {
        tag,
        attrs: {},
        style: {},
        children: [],
        removed: false,
        setAttribute(name, value) {
            node.attrs[name] = value;
        },
        appendChild(child) {
            node.children.push(child as StubElement);
            (child as StubElement).parentNode = {
                removeChild: (target: AdapterElement) => {
                    (target as StubElement).removed = true;
                    node.children = node.children.filter(c => c !== target);
                },
            };
        },
        parentNode: null,
    };
    created.push(node);
    return node;
}

const frame: AdapterFrame = {
    getBoundingClientRect: () => frameRect,
    contentWindow: { postMessage: (message: unknown) => posted.push(message) },
};

const VIDEO: PlayerDescriptor = {
    src: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
    sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation',
    allow: 'autoplay; fullscreen',
    referrerPolicy: 'strict-origin-when-cross-origin',
    allowFullscreen: true,
};

const PACKAGE_PDF: PlayerDescriptor = {
    src: 'https://lms.example/pkg/h.pdf',
    allow: 'fullscreen',
    referrerPolicy: 'no-referrer',
    allowFullscreen: false,
};

const overlays = () => created.filter(node => node.attrs.class === OVERLAY_CLASS);
const iframes = () => created.filter(node => node.tag === 'iframe');

beforeEach(() => {
    created = [];
    appendedToBody = [];
    posted = [];
    frameRect = { left: 100, top: 50, width: 800, height: 600 };
    doc = {
        createElement: element,
        body: { appendChild: node => appendedToBody.push(node as StubElement) },
        documentElement: { scrollLeft: 7, scrollTop: 9 },
    };
    adapter = createDomOverlayAdapter({ doc, win: {}, frameFor: () => frame });
});

describe('measuring', () => {
    it('reports the content frame box', () => {
        expect(adapter.measureFrame('f1')).toEqual(frameRect);
    });

    it('reports null when the frame is gone', () => {
        const gone = createDomOverlayAdapter({ doc, win: {}, frameFor: () => null });
        expect(gone.measureFrame('f1')).toBeNull();
    });

    it('prefers the window scroll, falling back to the document element', () => {
        expect(adapter.scrollOffset()).toEqual({ x: 7, y: 9 });
        const scrolled = createDomOverlayAdapter({
            doc,
            win: { pageXOffset: 40, pageYOffset: 200 },
            frameFor: () => frame,
        });
        expect(scrolled.scrollOffset()).toEqual({ x: 40, y: 200 });
    });
});

describe('the overlay element', () => {
    it('clips its contents and never intercepts clicks', () => {
        adapter.positionOverlay('f1', { left: 1, top: 2, width: 3, height: 4 });
        const overlay = overlays()[0];
        // overflow:hidden is what confines a player to the content box; pointer-events
        // none keeps the overlay from swallowing clicks meant for the page.
        expect(overlay.style.overflow).toBe('hidden');
        expect(overlay.style.pointerEvents).toBe('none');
        expect(overlay.style.position).toBe('absolute');
    });

    it('is created once per frame and reused', () => {
        adapter.positionOverlay('f1', { left: 1, top: 2, width: 3, height: 4 });
        adapter.positionOverlay('f1', { left: 5, top: 6, width: 7, height: 8 });
        expect(overlays()).toHaveLength(1);
        expect(appendedToBody).toHaveLength(1);
    });

    it('gets its own overlay per frame', () => {
        adapter.positionOverlay('f1', { left: 1, top: 2, width: 3, height: 4 });
        adapter.positionOverlay('f2', { left: 1, top: 2, width: 3, height: 4 });
        expect(overlays()).toHaveLength(2);
    });

    it('writes the box it is given, unchanged', () => {
        adapter.positionOverlay('f1', { left: 105, top: 250, width: 800, height: 600 });
        expect(overlays()[0].style).toMatchObject({
            left: '105px',
            top: '250px',
            width: '800px',
            height: '600px',
        });
    });
});

describe('mounting a player', () => {
    it('applies the isolation it is given, verbatim', () => {
        adapter.mountPlayer('f1', 'e1', VIDEO);
        const player = iframes()[0];
        expect(player.attrs.sandbox).toBe(VIDEO.sandbox);
        expect(player.attrs.allow).toBe(VIDEO.allow);
        expect(player.attrs.referrerpolicy).toBe(VIDEO.referrerPolicy);
        expect(player.attrs.src).toBe(VIDEO.src);
        expect('allowfullscreen' in player.attrs).toBe(true);
    });

    /** A package PDF is deliberately unsandboxed; the attribute must be absent, not "". */
    it('omits the sandbox attribute entirely when the descriptor has none', () => {
        adapter.mountPlayer('f1', 'e1', PACKAGE_PDF);
        const player = iframes()[0];
        expect('sandbox' in player.attrs).toBe(false);
        expect('allowfullscreen' in player.attrs).toBe(false);
    });

    /**
     * Everything governing the load must be set before it starts, or the frame could
     * begin fetching without its sandbox.
     */
    it('sets src last, after every attribute that governs the load', () => {
        adapter.mountPlayer('f1', 'e1', VIDEO);
        const order = Object.keys(iframes()[0].attrs);
        expect(order[order.length - 1]).toBe('src');
    });

    it('tags the player so it can never be mistaken for a content peer', () => {
        adapter.mountPlayer('f1', 'e1', VIDEO);
        expect(iframes()[0].attrs[PLAYER_MARKER_ATTR]).toBe('1');
    });

    it('puts the player inside its frame overlay', () => {
        adapter.mountPlayer('f1', 'e1', VIDEO);
        expect(overlays()[0].children).toHaveLength(1);
    });
});

describe('positioning and unmounting', () => {
    beforeEach(() => adapter.mountPlayer('f1', 'e1', VIDEO));

    it('writes the clamped rect it is given', () => {
        adapter.positionPlayer('f1', 'e1', { left: 10, top: 20, width: 480, height: 270 });
        expect(iframes()[0].style).toMatchObject({
            left: '10px',
            top: '20px',
            width: '480px',
            height: '270px',
        });
    });

    it('ignores an unknown player rather than throwing', () => {
        expect(() => adapter.positionPlayer('f1', 'nope', { left: 0, top: 0, width: 1, height: 1 })).not.toThrow();
        expect(() => adapter.unmountPlayer('f1', 'nope')).not.toThrow();
    });

    it('removes the player from the document', () => {
        adapter.unmountPlayer('f1', 'e1');
        expect(iframes()[0].removed).toBe(true);
        expect(overlays()[0].children).toHaveLength(0);
    });

    it('keeps players of different frames apart even when ids collide', () => {
        adapter.mountPlayer('f2', 'e1', VIDEO);
        adapter.unmountPlayer('f1', 'e1');

        const [first, second] = iframes();
        expect(first.removed).toBe(true);
        expect(second.removed).toBe(false);
    });
});

describe('posting to the frame', () => {
    it('addresses the content window with a wildcard origin', () => {
        adapter.postToFrame('f1', { type: 'exe-embed', action: 'welcome' });
        expect(posted).toEqual([{ type: 'exe-embed', action: 'welcome' }]);
    });

    it('does nothing when the frame is gone', () => {
        const gone = createDomOverlayAdapter({ doc, win: {}, frameFor: () => null });
        expect(() => gone.postToFrame('f1', {})).not.toThrow();
    });
});

/**
 * Deciding whether the content frame can actually be seen.
 *
 * The overlay is pinned to the top of the stacking order so page chrome can never cover a
 * player. That makes an unnoticed hide catastrophic rather than cosmetic: a video left
 * playing above an editor form, which is what was reported. A hit test at the frame's
 * centre is the cheapest honest answer to "is anything painted over this?", and it costs
 * one call per frame per drift tick.
 */
describe('detecting that the frame cannot be seen', () => {
    /** Rebuild the adapter with a document that answers hit tests. */
    function withHitTest(topmost: () => AdapterElement | AdapterFrame | null, frameElement: AdapterFrame = frame) {
        doc = {
            createElement: element,
            body: { appendChild: node => appendedToBody.push(node as StubElement) },
            documentElement: { scrollLeft: 0, scrollTop: 0 },
            elementFromPoint: () => topmost() as never,
        };
        return createDomOverlayAdapter({
            doc,
            win: { innerWidth: 1280, innerHeight: 900 },
            frameFor: () => frameElement,
        });
    }

    it('reports obscured when something else is painted over the frame', () => {
        const panel = element('div');
        const a = withHitTest(() => panel);

        expect(a.isFrameObscured?.('f1')).toBe(true);
    });

    it('reports visible when the frame itself is on top', () => {
        const a = withHitTest(() => frame);

        expect(a.isFrameObscured?.('f1')).toBe(false);
    });

    /** A mounted player covers the very point being tested; that is not occlusion. */
    it('does not mistake its own player for something covering the frame', () => {
        let topmost: AdapterElement | AdapterFrame | null = frame;
        const a = withHitTest(() => topmost);
        a.mountPlayer('f1', 'e1', VIDEO);
        topmost = iframes().at(-1) as AdapterElement;

        expect(a.isFrameObscured?.('f1')).toBe(false);
    });

    it('reports obscured for a frame with no box left', () => {
        frameRect = { left: 0, top: 0, width: 0, height: 0 };
        const a = withHitTest(() => frame);

        expect(a.isFrameObscured?.('f1')).toBe(true);
    });

    it('reports obscured when the frame is gone entirely', () => {
        const a = withHitTest(() => null, null as never);

        expect(a.isFrameObscured?.('f1')).toBe(true);
    });

    /**
     * Scrolled out of view is NOT covered. The overlay is positioned in document
     * coordinates and scrolls with the page, so hiding here would blank a player that is
     * merely below the fold — and it would come back only on the next drift tick.
     */
    it('treats a frame scrolled off screen as visible, not covered', () => {
        frameRect = { left: 100, top: -2000, width: 800, height: 600 };
        const a = withHitTest(() => null);

        expect(a.isFrameObscured?.('f1')).toBe(false);
    });

    it('hides and shows the overlay without destroying it', () => {
        const a = withHitTest(() => frame);
        a.positionOverlay('f1', { left: 0, top: 0, width: 10, height: 10 });

        a.setOverlayHidden?.('f1', true);
        expect(overlays().at(-1)?.style.display).toBe('none');

        a.setOverlayHidden?.('f1', false);
        expect(overlays().at(-1)?.style.display).toBe('');
        expect(overlays().at(-1)?.removed).toBe(false);
    });
});
