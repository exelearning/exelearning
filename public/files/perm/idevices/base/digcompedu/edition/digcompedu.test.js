/**
 * DigCompEdu iDevice — Unit Tests
 *
 * Focused on `loadFrameworkData()`'s decompression fallback chain:
 *   <url>.zst (via window.fzstd)  ->  plain <url>  ->  XHR
 *
 * Run with:  npx vitest run public/files/perm/idevices/base/digcompedu/edition/digcompedu.test.js
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

globalThis._ = (str) => str;

async function loadDevice() {
    const raw = await import('./digcompedu.js?raw').then((m) => m.default);
    // eslint-disable-next-line no-new-func
    return new Function('globalThis', '_', raw + '\nreturn $exeDevice;')(
        globalThis,
        globalThis._
    );
}

function minimalFramework() {
    return {
        competences: {
            C1: {
                name: 'Competence 1',
                levels: {},
            },
        },
    };
}

function mockZstFetch(data) {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(data));
    globalThis.window.fzstd = { decompress: vi.fn(() => jsonBytes) };
    globalThis.fetch = vi.fn((url) => {
        if (/\.zst$/.test(url)) {
            return Promise.resolve({
                ok: true,
                arrayBuffer: () => Promise.resolve(jsonBytes.buffer),
            });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    });
}

function mockZstFetch404ThenPlain(data) {
    globalThis.window.fzstd = { decompress: vi.fn() };
    globalThis.fetch = vi.fn((url) => {
        if (/\.zst$/.test(url)) {
            return Promise.resolve({ ok: false, status: 404 });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    });
}

function mockPlainFetchOnly(data) {
    delete globalThis.window.fzstd;
    globalThis.fetch = vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
    );
}

describe('DigCompEdu iDevice configuration', () => {
    it('is registered as $exeDevice with the required interface', async () => {
        const dev = await loadDevice();
        expect(dev).toBeDefined();
        expect(typeof dev.init).toBe('function');
        expect(typeof dev.loadFrameworkData).toBe('function');
    });
});

describe('loadFrameworkData decompression tiers (.zst / plain / XHR)', () => {
    let dev;

    beforeEach(async () => {
        dev = await loadDevice();
    });

    afterEach(() => {
        delete globalThis.window.fzstd;
        vi.restoreAllMocks();
    });

    it('tries <url>.zst first and decompresses via window.fzstd when available', async () => {
        mockZstFetch(minimalFramework());
        const data = await dev.loadFrameworkData('es');
        expect(globalThis.fetch).toHaveBeenCalled();
        const firstUrl = globalThis.fetch.mock.calls[0][0];
        expect(firstUrl).toMatch(/\.zst$/);
        expect(globalThis.window.fzstd.decompress).toHaveBeenCalled();
        expect(data).toEqual(minimalFramework());
    });

    it('falls back to the plain <url> fetch when the .zst request 404s', async () => {
        mockZstFetch404ThenPlain(minimalFramework());
        const data = await dev.loadFrameworkData('es');
        const urls = globalThis.fetch.mock.calls.map((c) => c[0]);
        expect(urls.some((u) => /\.zst$/.test(u))).toBe(true);
        expect(urls.some((u) => !/\.zst$/.test(u))).toBe(true);
        expect(data).toEqual(minimalFramework());
    });

    it('skips the .zst tier entirely when window.fzstd is not loaded', async () => {
        mockPlainFetchOnly(minimalFramework());
        const data = await dev.loadFrameworkData('es');
        const urls = globalThis.fetch.mock.calls.map((c) => c[0]);
        expect(urls.every((u) => !/\.zst$/.test(u))).toBe(true);
        expect(data).toEqual(minimalFramework());
    });

    it('caches the result per language and does not re-fetch on a second call', async () => {
        mockZstFetch(minimalFramework());
        await dev.loadFrameworkData('es');
        const callsAfterFirst = globalThis.fetch.mock.calls.length;
        await dev.loadFrameworkData('es');
        expect(globalThis.fetch.mock.calls.length).toBe(callsAfterFirst);
    });
});
