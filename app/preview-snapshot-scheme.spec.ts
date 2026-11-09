import { describe, expect, it } from 'bun:test';
import { isScriptableDocumentType as tsIsScriptable, PREVIEW_SNAPSHOT_SANDBOX_TOKENS } from '../src/shared/security/previewSandbox';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scheme = require('./preview-snapshot-scheme');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
};

const ID_A = 'a'.repeat(32);
const ID_B = 'b'.repeat(32);

function store(overrides: Record<string, unknown> = {}) {
    const ids = [ID_A, ID_B];
    return scheme.createPreviewSnapshotStore({ randomId: () => ids.shift() ?? 'c'.repeat(32), mimeTypes: MIME, ...overrides });
}

const files = () => ({
    'index.html': '<!doctype html><script>x()</script>',
    'html/page.html': new TextEncoder().encode('<p>two</p>'),
    'theme/style.css': 'body{}',
    'content/a.png': new Uint8Array([137, 80, 78, 71]).buffer,
    'content/doc.pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    'content/pic.svg': '<svg onload="x()"/>',
});

describe('preview scheme: single owner of the sandbox contract', () => {
    it('uses exactly the sandbox tokens and scriptable types of src/shared/security/previewSandbox.ts', () => {
        expect([...scheme.SANDBOX_TOKENS]).toEqual([...PREVIEW_SNAPSHOT_SANDBOX_TOKENS]);
        expect(scheme.sandboxCsp()).toBe(`sandbox ${PREVIEW_SNAPSHOT_SANDBOX_TOKENS.join(' ')}`);
        for (const type of [
            'text/html',
            'text/html; charset=utf-8',
            'application/xhtml+xml',
            'image/svg+xml',
            'application/xml',
            'text/xml',
            'application/pdf',
            'image/png',
            'application/javascript',
            'text/css',
            'video/mp4',
        ]) {
            expect(scheme.isScriptableDocumentType(type), type).toBe(tsIsScriptable(type));
        }
    });
});

describe('preview scheme store: replace and dispose', () => {
    it('mints a 128-bit capability id and a preview:// URL on first replace', () => {
        const s = store();
        const result = s.replace(7, null, files());
        expect(result.previewId).toBe(ID_A);
        expect(result.previewUrl).toBe(`preview://${ID_A}/index.html`);
        expect(s.size()).toBe(1);
    });

    it('keeps the id on replace so the iframe URL stays valid, and swaps the whole map', () => {
        const s = store();
        const first = s.replace(7, null, files());
        const second = s.replace(7, first.previewId, { 'index.html': '<p>v2</p>' });
        expect(second.previewId).toBe(ID_A);
        expect(new TextDecoder().decode(s.serve(`preview://${ID_A}/index.html`).body)).toBe('<p>v2</p>');
        expect(s.serve(`preview://${ID_A}/theme/style.css`).status).toBe(404);
        expect(s.size()).toBe(1);
    });

    it('refuses to replace a snapshot that belongs to another window', () => {
        const s = store();
        const mine = s.replace(7, null, files());
        expect(() => s.replace(8, mine.previewId, files())).toThrow(/another window/);
    });

    it('mints a fresh id when the given one is unknown or malformed', () => {
        const s = store();
        expect(s.replace(7, 'f'.repeat(32), files()).previewId).toBe(ID_A);
        expect(s.replace(7, '../etc', files()).previewId).toBe(ID_B);
        // One live snapshot per owner: the earlier one is gone.
        expect(s.size()).toBe(1);
    });

    it('rejects an empty map, a map without index.html, a traversing path and oversized content', () => {
        const s = store({ maxBytes: 10 });
        expect(() => s.replace(7, null, undefined)).toThrow(/missing/);
        expect(() => s.replace(7, null, { 'a.html': 'x' })).toThrow(/index\.html/);
        expect(() => s.replace(7, null, { 'index.html': 'x', '../escape.js': 'x' })).toThrow(/not valid/);
        expect(() => s.replace(7, null, { 'index.html': 'x'.repeat(11) })).toThrow(/maximum allowed size/);
        expect(() => s.replace(7, null, { 'index.html': 42 })).toThrow(/not valid/);
    });

    it('disposes only the owner’s snapshot and everything an owner had when its window closes', () => {
        const s = store();
        const a = s.replace(7, null, files());
        expect(s.dispose(8, a.previewId)).toBe(false);
        expect(s.dispose(7, 'nope')).toBe(false);
        expect(s.dispose(7, a.previewId)).toBe(true);
        expect(s.serve(a.previewUrl).status).toBe(404);

        s.replace(9, null, files());
        expect(s.disposeOwner(9)).toBe(1);
        expect(s.disposeOwner(9)).toBe(0);
        expect(s.size()).toBe(0);
    });
});

describe('preview scheme store: serving', () => {
    it('serves snapshot files with the hardening headers and the right content type', () => {
        const s = store();
        const { previewUrl } = s.replace(7, null, files());
        const css = s.serve(`preview://${ID_A}/theme/style.css`);
        expect(css.status).toBe(200);
        expect(css.headers['Content-Type']).toBe('text/css; charset=utf-8');
        expect(css.headers['X-Content-Type-Options']).toBe('nosniff');
        expect(css.headers['Referrer-Policy']).toBe('no-referrer');
        expect(css.headers['Cache-Control']).toBe('no-store');
        expect(css.headers['Content-Security-Policy']).toBeUndefined();
        expect(s.serve(previewUrl).status).toBe(200);
    });

    it('puts the sandbox-first CSP on every scriptable type and on nothing else', () => {
        const s = store();
        s.replace(7, null, files());
        for (const [file, scriptable] of [
            ['index.html', true],
            ['html/page.html', true],
            ['content/pic.svg', true],
            ['content/doc.pdf', true],
            ['theme/style.css', false],
            ['content/a.png', false],
        ] as const) {
            const response = s.serve(`preview://${ID_A}/${file}`);
            expect(response.status, file).toBe(200);
            expect(response.headers['Content-Security-Policy'], file).toBe(scriptable ? scheme.sandboxCsp() : undefined);
        }
    });

    it('serves index.html for the bare root and resolves encoded paths', () => {
        const s = store();
        s.replace(7, null, files());
        expect(s.serve(`preview://${ID_A}/`).status).toBe(200);
        expect(s.serve(`preview://${ID_A}`).status).toBe(200);
        expect(s.serve(`preview://${ID_A}/html%2Fpage.html?x=1#y`).status).toBe(200);
    });

    it('resolves dot segments inside the snapshot: the URL parser folds them, the normalizer catches the rest', () => {
        const s = store();
        s.replace(7, null, files());
        // `..` can only ever walk up to the snapshot root, never out of the map.
        expect(s.serve(`preview://${ID_A}/html/../index.html`).status).toBe(200);
        expect(s.serve(`preview://${ID_A}/../../index.html`).status).toBe(200);
        expect(s.serve(`preview://${ID_A}/%2e%2e/theme/style.css`).status).toBe(200);
        expect(scheme.normalizeContentPath('../index.html')).toBeNull();
    });

    it('answers 404 (never a lookup) for a malformed id, another scheme or an unknown file', () => {
        const s = store();
        s.replace(7, null, files());
        for (const url of [
            `preview://${ID_A.slice(1)}X/index.html`,
            `app://${ID_A}/index.html`,
            `preview://${ID_B}/index.html`,
            `preview://${ID_A}/missing.js`,
            `preview://${ID_A}/%ff`,
            'not a url',
        ]) {
            const response = s.serve(url);
            expect(response.status, url).toBe(404);
            expect(response.headers['X-Content-Type-Options'], url).toBe('nosniff');
            expect(response.headers['Cache-Control'], url).toBe('no-store');
        }
    });

    it('serves bytes, strings and ArrayBuffers alike', () => {
        const s = store();
        s.replace(7, null, files());
        expect(s.serve(`preview://${ID_A}/content/a.png`).body).toEqual(new Uint8Array([137, 80, 78, 71]));
        expect(new TextDecoder().decode(s.serve(`preview://${ID_A}/html/page.html`).body)).toBe('<p>two</p>');
    });
});

describe('normalizeContentPath', () => {
    it('matches the server utility’s rules', () => {
        expect(scheme.normalizeContentPath('/')).toBe('index.html');
        expect(scheme.normalizeContentPath('/a/./b/../c.js?v=1#h')).toBe('a/c.js');
        expect(scheme.normalizeContentPath('/../x')).toBeNull();
        expect(scheme.normalizeContentPath('/a/%00')).toBeNull();
        expect(scheme.normalizeContentPath('/%zz')).toBeNull();
    });
});
