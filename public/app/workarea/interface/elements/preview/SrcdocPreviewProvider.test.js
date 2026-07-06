import { describe, it, expect, beforeEach } from 'vitest';
import { SrcdocPreviewProvider } from './SrcdocPreviewProvider.js';
import { INJECTED_MARKER } from './previewContentDecorators.js';

const FILES = {
    'index.html': '<!DOCTYPE html><html><head><link rel="stylesheet" href="content/css/base.css"></head><body>one</body></html>',
    'html/page2.html': '<!DOCTYPE html><html><body>two</body></html>',
    'content/css/base.css': 'body { color: rgb(9, 9, 9); }',
    'content/resources/doc.pdf': new Uint8Array([0x25, 0x50]),
};

describe('SrcdocPreviewProvider', () => {
    let provider;

    beforeEach(() => {
        provider = new SrcdocPreviewProvider();
    });

    it('prepares an opaque-safe session without an entry URL', async () => {
        const session = await provider.prepare(FILES);
        expect(session.mode).toBe('srcdoc');
        expect(session.opaqueSafe).toBe(true);
        expect(session.entryUrl).toBeNull();
        expect(typeof session.id).toBe('string');
    });

    it('resolves pages to inlined, decorated srcdoc HTML', async () => {
        await provider.prepare(FILES);
        const target = await provider.resolvePage('index.html');
        expect(target.kind).toBe('srcdoc');
        expect(target.html).toContain('color: rgb(9, 9, 9)');
        expect(target.html).not.toContain('<link');
        expect(target.html).toContain(INJECTED_MARKER);
        expect(target.html).toContain('"index.html"');
    });

    it('update() before prepare() creates the session', async () => {
        await provider.update(FILES);
        expect(provider.session).not.toBeNull();
        expect(provider.session.mode).toBe('srcdoc');
        const target = await provider.resolvePage('index.html');
        expect(target.kind).toBe('srcdoc');
    });

    it('keeps the session id stable across updates but serves new content', async () => {
        const session = await provider.prepare(FILES);
        await provider.update({ ...FILES, 'index.html': FILES['index.html'].replace('one', 'uno') });
        expect(provider.session.id).toBe(session.id);
        const target = await provider.resolvePage('index.html');
        expect(target.html).toContain('uno');
    });

    it('throws for unknown pages', async () => {
        await provider.prepare(FILES);
        await expect(provider.resolvePage('nope.html')).rejects.toThrow(/not found/i);
    });

    it('exposes page and file accessors for the panel message handlers', async () => {
        await provider.prepare(FILES);
        expect(provider.hasPage('html/page2.html')).toBe(true);
        expect(provider.hasPage('content/css/base.css')).toBe(false);
        const bytes = await provider.getFile('content/resources/doc.pdf');
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(await provider.getFile('missing.bin')).toBeNull();
    });

    it('reports inlining stats for the last rendered page', async () => {
        provider = new SrcdocPreviewProvider({ inlineOptions: { perAssetCaps: { image: 1 } } });
        await provider.prepare({
            'index.html': '<html><body><img src="a.png"></body></html>',
            'a.png': new Uint8Array(10),
        });
        await provider.resolvePage('index.html');
        expect(provider.lastRenderStats.skipped).toHaveLength(1);
    });

    it('clears state on dispose', async () => {
        await provider.prepare(FILES);
        await provider.dispose();
        expect(provider.session).toBeNull();
        expect(provider.hasPage('index.html')).toBe(false);
    });
});
