import { describe, it, expect } from 'vitest';
import { selectPreviewProvider } from './selectPreviewProvider.js';
import { HttpPreviewProvider } from './HttpPreviewProvider.js';
import { SrcdocPreviewProvider } from './SrcdocPreviewProvider.js';
import { ServiceWorkerPreviewProvider } from './ServiceWorkerPreviewProvider.js';

const deps = { basePath: '', app: {} };

function config(mode, { isEmbedded = false, previewTransport = undefined } = {}) {
    return {
        mode,
        isEmbedded,
        embeddingConfig: previewTransport ? { previewTransport } : null,
    };
}

describe('selectPreviewProvider', () => {
    it('selects the HTTP provider in server mode', () => {
        const provider = selectPreviewProvider({ runtimeConfig: config('server'), deps });
        expect(provider).toBeInstanceOf(HttpPreviewProvider);
        expect(provider.opaqueSafe).toBe(true);
    });

    it('selects the srcdoc provider for embedded editors', () => {
        const provider = selectPreviewProvider({
            runtimeConfig: config('embedded', { isEmbedded: true }),
            deps,
        });
        expect(provider).toBeInstanceOf(SrcdocPreviewProvider);
    });

    it('selects the opaque HTTP provider in Electron (app://localhost/preview), not the legacy SW', () => {
        const provider = selectPreviewProvider({
            runtimeConfig: config('static'),
            hasElectronApi: true,
            deps,
        });
        expect(provider).toBeInstanceOf(HttpPreviewProvider);
        expect(provider.opaqueSafe).toBe(true);
    });

    it('only selects the legacy Service Worker provider via an explicit legacy-sw override', () => {
        const legacy = selectPreviewProvider({
            runtimeConfig: config('static', { previewTransport: 'legacy-sw' }),
            hasElectronApi: true,
            deps,
        });
        expect(legacy).toBeInstanceOf(ServiceWorkerPreviewProvider);
        expect(legacy.opaqueSafe).toBe(false);
    });

    it('uses the srcdoc provider for standalone static/PWA', () => {
        const provider = selectPreviewProvider({ runtimeConfig: config('static'), deps });
        expect(provider).toBeInstanceOf(SrcdocPreviewProvider);
        expect(provider.opaqueSafe).toBe(true);
    });

    it('honors the explicit previewTransport override from the embedding host', () => {
        const http = selectPreviewProvider({
            runtimeConfig: config('embedded', { isEmbedded: true, previewTransport: 'http' }),
            deps,
        });
        expect(http).toBeInstanceOf(HttpPreviewProvider);

        const legacy = selectPreviewProvider({
            runtimeConfig: config('embedded', { isEmbedded: true, previewTransport: 'legacy-sw' }),
            deps,
        });
        expect(legacy).toBeInstanceOf(ServiceWorkerPreviewProvider);
    });

    it('rejects unknown transport overrides instead of silently downgrading', () => {
        expect(() =>
            selectPreviewProvider({
                runtimeConfig: config('embedded', { isEmbedded: true, previewTransport: 'same-origin' }),
                deps,
            }),
        ).toThrow(/previewTransport/);
    });
});
