import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElectronPreviewSnapshot, electronPreviewSnapshotApi } from './ElectronPreviewSnapshot.js';

const ID = 'a'.repeat(32);

function api(overrides = {}) {
    return {
        replace: vi.fn().mockResolvedValue({ previewId: ID, previewUrl: `preview://${ID}/index.html` }),
        dispose: vi.fn().mockResolvedValue(true),
        ...overrides,
    };
}

afterEach(() => {
    delete window.electronAPI;
});

describe('electronPreviewSnapshotApi', () => {
    it('finds the bridge only when the preload exposes both methods', () => {
        expect(electronPreviewSnapshotApi({})).toBeNull();
        expect(electronPreviewSnapshotApi({ electronAPI: {} })).toBeNull();
        expect(electronPreviewSnapshotApi({ electronAPI: { previewSnapshot: { replace() {} } } })).toBeNull();
        const bridge = api();
        expect(electronPreviewSnapshotApi({ electronAPI: { previewSnapshot: bridge } })).toBe(bridge);
    });

    it('reads window.electronAPI by default', () => {
        window.electronAPI = { previewSnapshot: api() };
        expect(electronPreviewSnapshotApi()).toBe(window.electronAPI.previewSnapshot);
    });
});

describe('ElectronPreviewSnapshot', () => {
    it('refuses to exist without the bridge (an old preload fails closed)', () => {
        expect(() => new ElectronPreviewSnapshot(null)).toThrow(/unavailable/);
    });

    it('sandboxes the frame without allow-same-origin', () => {
        const iframe = document.createElement('iframe');
        new ElectronPreviewSnapshot(api()).applySandbox(iframe);
        expect(iframe.getAttribute('sandbox')).toContain('allow-scripts');
        expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
    });

    it('hands the file map to the main process and keeps the id for the next replace', async () => {
        const bridge = api();
        const snapshot = new ElectronPreviewSnapshot(bridge);
        const files = { 'index.html': new Uint8Array([60]) };

        const url = await snapshot.replace(files);

        expect(bridge.replace).toHaveBeenCalledWith(null, files);
        expect(url).toBe(`preview://${ID}/index.html`);
        expect(snapshot.previewId).toBe(ID);
        await snapshot.replace(files);
        expect(bridge.replace).toHaveBeenLastCalledWith(ID, files);
    });

    it('rejects a response that is not a preview:// URL of the returned id', async () => {
        for (const previewUrl of [
            `app://localhost/preview-snapshot/${ID}/index.html`,
            `preview://${'b'.repeat(32)}/index.html`,
            'not a url',
        ]) {
            const snapshot = new ElectronPreviewSnapshot(api({ replace: vi.fn().mockResolvedValue({ previewId: ID, previewUrl }) }));
            await expect(snapshot.replace({}), previewUrl).rejects.toThrow(/preview/);
            expect(snapshot.previewUrl).toBeNull();
        }
        const missing = new ElectronPreviewSnapshot(api({ replace: vi.fn().mockResolvedValue({}) }));
        await expect(missing.replace({})).rejects.toThrow(/missing previewId/);
    });

    it('disposes once and forgets the id first', async () => {
        const bridge = api();
        const snapshot = new ElectronPreviewSnapshot(bridge);
        await snapshot.replace({});
        await snapshot.dispose();
        await snapshot.dispose();
        expect(bridge.dispose).toHaveBeenCalledTimes(1);
        expect(bridge.dispose).toHaveBeenCalledWith(ID);
        expect(snapshot.previewId).toBeNull();
        expect(snapshot.previewUrl).toBeNull();
    });
});
