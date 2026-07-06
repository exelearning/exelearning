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

    it('keeps Electron on the legacy Service Worker transport', () => {
        expect(resolvePreviewTransport(config('static'), { hasElectronApi: true })).toBe('service-worker');
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
