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

    it('keeps Electron on the legacy Service Worker transport (documented interim)', () => {
        const provider = selectPreviewProvider({
            runtimeConfig: config('static'),
            hasElectronApi: true,
            deps,
        });
        expect(provider).toBeInstanceOf(ServiceWorkerPreviewProvider);
        expect(provider.opaqueSafe).toBe(false);
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
