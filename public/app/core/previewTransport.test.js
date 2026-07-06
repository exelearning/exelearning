import { describe, it, expect } from 'vitest';
import { resolvePreviewTransport } from './previewTransport.js';

function config(mode, { isEmbedded = false, previewTransport = undefined } = {}) {
    return {
        mode,
        isEmbedded,
        embeddingConfig: previewTransport ? { previewTransport } : null,
    };
}

describe('resolvePreviewTransport', () => {
    it('maps server mode to the HTTP transport', () => {
        expect(resolvePreviewTransport(config('server'))).toBe('http');
    });

    it('maps embedded editors to srcdoc', () => {
        expect(resolvePreviewTransport(config('embedded', { isEmbedded: true }))).toBe('srcdoc');
    });

    it('maps Electron to the opaque HTTP transport (app://localhost/preview), not the legacy SW', () => {
        // Electron serves the preview opaquely from the main process
        // (protocol.handle), so it must NOT downgrade to the same-origin SW
        // preview that exposes window.top.electronAPI.readFile.
        expect(resolvePreviewTransport(config('static'), { hasElectronApi: true })).toBe('http');
    });

    it('only reaches the same-origin Service Worker transport via an explicit legacy-sw override', () => {
        expect(resolvePreviewTransport(config('static'), { hasElectronApi: true, previewTransport: undefined })).toBe(
            'http',
        );
        expect(resolvePreviewTransport(config('static', { previewTransport: 'legacy-sw' }), { hasElectronApi: true })).toBe(
            'service-worker',
        );
    });

    it('uses srcdoc for standalone static/PWA (a SW cannot serve an opaque iframe)', () => {
        expect(resolvePreviewTransport(config('static'))).toBe('srcdoc');
    });

    it('honors explicit previewTransport overrides, normalizing legacy-sw', () => {
        expect(resolvePreviewTransport(config('embedded', { isEmbedded: true, previewTransport: 'http' }))).toBe(
            'http',
        );
        expect(resolvePreviewTransport(config('server', { previewTransport: 'legacy-sw' }))).toBe('service-worker');
        expect(resolvePreviewTransport(config('server', { previewTransport: 'srcdoc' }))).toBe('srcdoc');
    });

    it('rejects unknown overrides instead of downgrading', () => {
        expect(() => resolvePreviewTransport(config('server', { previewTransport: 'same-origin' }))).toThrow(
            /previewTransport/,
        );
    });
});
