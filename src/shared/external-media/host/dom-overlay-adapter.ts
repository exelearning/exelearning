/**
 * The `OverlayAdapter` implementation: the only part of the host half that touches a
 * document.
 *
 * It applies and never decides. Every value it writes was computed by a tested module —
 * the box by `overlay-geometry`, the attributes by `player-descriptor` — so a mistake here
 * can only be a wiring mistake, which is what the three-engine artifact E2E covers.
 *
 * Two properties are structural rather than cosmetic and must not be "tidied away":
 *
 *  - the overlay is `position: absolute` with `overflow: hidden`, which is what clips a
 *    player to the content's own box. The size clamp is defence in depth on top of it.
 *  - it is `pointer-events: none`, so the overlay itself never intercepts a click; only
 *    the players inside it do.
 */
import type { FrameHandle } from './frame-registry';
import type { OverlayAdapter } from './host-runtime';
import type { Rect, ScrollOffset } from './overlay-geometry';
import type { PlayerDescriptor } from './player-descriptor';

/** Marks a promoted player, so it is never mistaken for a content frame. */
export const PLAYER_MARKER_ATTR = 'data-exe-embed-player';

export const OVERLAY_CLASS = 'exe-embed-overlay';

/** The document surface this adapter needs; narrow enough to stub in a test. */
export interface AdapterDocument {
    createElement(tag: string): AdapterElement;
    /** Topmost element at a viewport point, used to detect that the frame is covered. */
    elementFromPoint?(x: number, y: number): unknown;
    body: { appendChild(node: AdapterElement): void } | null;
    documentElement?: { scrollLeft?: number; scrollTop?: number };
}

export interface AdapterElement {
    style: Record<string, string>;
    setAttribute(name: string, value: string): void;
    appendChild(node: AdapterElement): void;
    remove?(): void;
    parentNode?: { removeChild(node: AdapterElement): void } | null;
}

export interface AdapterFrame {
    getBoundingClientRect(): Rect;
    contentWindow?: { postMessage(message: unknown, targetOrigin: string): void } | null;
}

export interface DomOverlayAdapterOptions {
    doc: AdapterDocument;
    win: { pageXOffset?: number; pageYOffset?: number; innerWidth?: number; innerHeight?: number };
    /** Resolve a handle to the content iframe element it was registered for. */
    frameFor(handle: FrameHandle): AdapterFrame | null;
}

export function createDomOverlayAdapter({ doc, win, frameFor }: DomOverlayAdapterOptions): OverlayAdapter {
    const overlays = new Map<FrameHandle, AdapterElement>();
    const players = new Map<string, AdapterElement>();

    const playerKey = (handle: FrameHandle, id: string) => `${handle}::${id}`;

    function overlayFor(handle: FrameHandle): AdapterElement {
        const existing = overlays.get(handle);
        if (existing) return existing;

        const element = doc.createElement('div');
        element.setAttribute('class', OVERLAY_CLASS);
        // overflow:hidden is what clips a player to the content box; pointer-events:none
        // keeps the overlay itself from swallowing clicks meant for the page.
        Object.assign(element.style, {
            position: 'absolute',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: '2147483646',
        });
        doc.body?.appendChild(element);
        overlays.set(handle, element);
        return element;
    }

    return {
        measureFrame(handle) {
            const frame = frameFor(handle);
            return frame ? frame.getBoundingClientRect() : null;
        },

        isFrameObscured(handle) {
            const frame = frameFor(handle);
            if (!frame) return true;

            const rect = frame.getBoundingClientRect();
            // display:none, visibility collapse and detachment all land here.
            if (rect.width <= 0 || rect.height <= 0) return true;

            const viewportWidth = win.innerWidth ?? 0;
            const viewportHeight = win.innerHeight ?? 0;
            const left = Math.max(rect.left, 0);
            const top = Math.max(rect.top, 0);
            const right = Math.min(rect.left + rect.width, viewportWidth);
            const bottom = Math.min(rect.top + rect.height, viewportHeight);
            // Entirely outside the viewport: scrolled away, not covered. The overlay is
            // placed in document coordinates and scrolls with the page, so hiding a frame
            // for being below the fold would blank a perfectly good player.
            if (right <= left || bottom <= top) return false;

            const topmost = doc.elementFromPoint?.((left + right) / 2, (top + bottom) / 2);
            // No answer is not evidence of covering; leave the overlay alone.
            if (!topmost) return false;
            if (topmost === frame) return false;
            // Our own player sits over that point by design.
            for (const player of players.values()) if (topmost === player) return false;
            return true;
        },

        setOverlayHidden(handle, hidden) {
            overlayFor(handle).style.display = hidden ? 'none' : '';
        },

        scrollOffset(): ScrollOffset {
            return {
                x: win.pageXOffset ?? doc.documentElement?.scrollLeft ?? 0,
                y: win.pageYOffset ?? doc.documentElement?.scrollTop ?? 0,
            };
        },

        positionOverlay(handle, box) {
            const element = overlayFor(handle);
            element.style.left = `${box.left}px`;
            element.style.top = `${box.top}px`;
            element.style.width = `${box.width}px`;
            element.style.height = `${box.height}px`;
        },

        mountPlayer(handle: FrameHandle, id: string, descriptor: PlayerDescriptor) {
            const frame = doc.createElement('iframe');
            // Tagged so the frame registry can never mistake a player for a content peer.
            frame.setAttribute(PLAYER_MARKER_ATTR, '1');
            if (descriptor.sandbox !== undefined) frame.setAttribute('sandbox', descriptor.sandbox);
            frame.setAttribute('allow', descriptor.allow);
            frame.setAttribute('referrerpolicy', descriptor.referrerPolicy);
            if (descriptor.allowFullscreen) frame.setAttribute('allowfullscreen', '');
            Object.assign(frame.style, { position: 'absolute', border: '0', pointerEvents: 'auto' });
            // src last: everything that governs the load must be set before it starts.
            frame.setAttribute('src', descriptor.src);

            overlayFor(handle).appendChild(frame);
            players.set(playerKey(handle, id), frame);
        },

        positionPlayer(handle, id, rect) {
            const player = players.get(playerKey(handle, id));
            if (!player) return;
            player.style.left = `${rect.left}px`;
            player.style.top = `${rect.top}px`;
            player.style.width = `${rect.width}px`;
            player.style.height = `${rect.height}px`;
        },

        unmountPlayer(handle, id) {
            const key = playerKey(handle, id);
            const player = players.get(key);
            if (!player) return;
            player.parentNode?.removeChild(player);
            players.delete(key);
        },

        postToFrame(handle, message) {
            // targetOrigin '*' because an opaque document has no stable origin to address;
            // the child authenticates US by window identity, exactly as we do it.
            frameFor(handle)?.contentWindow?.postMessage(message, '*');
        },
    };
}
