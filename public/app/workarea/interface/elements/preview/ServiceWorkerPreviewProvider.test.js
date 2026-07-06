import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceWorkerPreviewProvider } from './ServiceWorkerPreviewProvider.js';

describe('ServiceWorkerPreviewProvider', () => {
    let app;
    let provider;

    beforeEach(() => {
        app = { sendContentToPreviewSW: vi.fn().mockResolvedValue(undefined) };
        provider = new ServiceWorkerPreviewProvider({ app, basePath: '/exe' });
    });

    it('is explicitly NOT opaque-safe (legacy transport)', () => {
        expect(provider.mode).toBe('service-worker');
        expect(provider.opaqueSafe).toBe(false);
    });

    it('sends the file map to the Service Worker on prepare and update', async () => {
        const files = { 'index.html': '<html></html>' };
        const session = await provider.prepare(files);
        await provider.update(files);

        expect(app.sendContentToPreviewSW).toHaveBeenCalledTimes(2);
        expect(app.sendContentToPreviewSW).toHaveBeenCalledWith(files, { openExternalLinksInNewWindow: true });
        expect(session.entryUrl).toBe('/exe/viewer/index.html?exe-teacher=1');
        expect(session.opaqueSafe).toBe(false);
    });

    it('resolves pages under the virtual /viewer/ prefix', async () => {
        await provider.prepare({});
        const target = provider.resolvePage('html/page2.html');
        expect(target).toEqual({ kind: 'url', url: '/exe/viewer/html/page2.html?exe-teacher=1' });
    });

    it('has no parent-side file access (the SW owns in-frame handling)', async () => {
        await provider.prepare({});
        expect(await provider.getFile('anything.pdf')).toBeNull();
    });

    it('exposes the session getter and clears it on dispose', async () => {
        expect(provider.session).toBeNull();
        await provider.prepare({});
        expect(provider.session).not.toBeNull();
        await provider.dispose();
        expect(provider.session).toBeNull();
    });
});
