import { describe, expect, it } from 'bun:test';

/**
 * As with the child bootstrap: module-level side effects on the real `window`, exercised
 * by installing a stub global and importing once. The behaviour lives in `host-entry.ts`.
 *
 * The counters are wired in BEFORE the import, so what they record is what merely loading
 * the bundle did to the page.
 */
const installed: string[] = [];
const intervals: number[] = [];

const win: Record<string, unknown> = {
    location: { origin: 'https://lms.example', hostname: 'lms.example' },
    document: {
        createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
        body: { appendChild: () => {} },
        documentElement: {},
        getElementsByTagName: () => [],
    },
    addEventListener: (type: string) => installed.push(type),
    removeEventListener: () => {},
    setInterval: (_fn: () => void, ms: number) => intervals.push(ms),
    clearInterval: () => {},
};

(globalThis as { window?: unknown }).window = win;
await import('./host-bundle');

describe('the host bundle bootstrap', () => {
    it('publishes both the new and the legacy name', () => {
        expect(typeof (win.exeExternalMediaHost as { create?: unknown })?.create).toBe('function');
        expect(typeof (win.exeEmbedRelay as { init?: unknown })?.init).toBe('function');
    });

    /**
     * Unlike the child, the host must NOT start itself. The policy it applies — open or
     * strict, and with which allowlist — is the embedding page's decision, supplied by
     * `init()`. A host that started on its own would have to guess, and the guess that
     * makes it work everywhere is the permissive one.
     *
     * It is also why a page can load this bundle and pay nothing for it: no listeners, no
     * timer, until it asks.
     */
    it('touches nothing on the page until it is asked to', () => {
        expect(installed).toEqual([]);
        expect(intervals).toEqual([]);
    });

    it('starts once the page states its policy', () => {
        (win.exeEmbedRelay as { init(config: unknown): unknown }).init({ mode: 'open' });

        expect(installed).toContain('message');
        expect(intervals.length).toBeGreaterThan(0);
    });
});
