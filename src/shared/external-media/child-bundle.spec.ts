import { describe, expect, it } from 'bun:test';

/**
 * The bootstrap is module-level side effects on the real `window`, so it is exercised by
 * installing a stub global and importing it exactly once — which is also why everything
 * asserted here is about WHEN things happen, not what they do. The behaviour behind it
 * lives in `child-entry.ts` and is tested there; the browsers cover the whole thing end
 * to end in `external-media-artifacts.spec.ts`.
 */
const posted: unknown[] = [];
const documentListeners: { type: string; fn: () => void }[] = [];

const parent = { postMessage: (message: unknown) => posted.push(message) };

const win: Record<string, unknown> = {
    parent,
    origin: 'null', // opaque and framed, so the runtime is willing to start
    location: { href: 'https://lms.example/preview/page.html' },
    document: {
        cookie: '',
        // Still parsing, which is the case that decides whether it defers.
        readyState: 'loading',
        documentElement: {},
        body: { querySelectorAll: () => [] },
        querySelectorAll: () => [],
        addEventListener: (type: string, fn: () => void) => documentListeners.push({ type, fn }),
    },
    addEventListener: () => {},
    setTimeout: () => 0,
};
win.self = win;
win.top = {};

(globalThis as { window?: unknown }).window = win;
await import('./child-bundle');

describe('the child bundle bootstrap', () => {
    /** Plugins and iDevices look these up by name; they must exist from the first tick. */
    it('publishes the globals immediately, without waiting for the document', () => {
        expect(typeof win.exeExternalMediaChild).toBe('object');
        expect(typeof win.exeEmbedShim).toBe('object');
    });

    /**
     * The placeholders have to be in place before the page is painted, or a reader
     * watches the embeds pop in. Waiting for `load` would be too late; not waiting at all
     * would scan a body that does not exist yet.
     */
    it('waits for DOMContentLoaded before it starts scanning', () => {
        expect(documentListeners.map(l => l.type)).toEqual(['DOMContentLoaded']);
        expect(posted).toHaveLength(0);
    });

    it('announces itself once the document is ready', () => {
        documentListeners.forEach(l => l.fn());

        expect(posted.map(m => (m as { action: string }).action)).toEqual(['hello']);
    });
});
