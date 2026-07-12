import { describe, it, expect } from 'vitest';
import { selectPreviewProvider } from './selectPreviewProvider.js';
import { HttpPreviewProvider } from './HttpPreviewProvider.js';
import { StaticServiceWorkerPreviewProvider } from './StaticServiceWorkerPreviewProvider.js';
import { PreviewProviderError } from './providerContract.js';

const deps = { basePath: '', app: {} };

const VALID_PREVIEW_HTTP = Object.freeze({
    protocolVersion: 2,
    managementBaseUrl: '/api/preview-session',
    servingBaseUrl: '/preview',
});

function config(
    mode,
    {
        isEmbedded = false,
        previewTransport = undefined,
        previewHttp = undefined,
        allowUnsafeEmbeddedPreview = undefined,
    } = {},
) {
    const hasEmbeddingConfig =
        previewTransport !== undefined || previewHttp !== undefined || allowUnsafeEmbeddedPreview !== undefined;
    const embeddingConfig = hasEmbeddingConfig
        ? {
              ...(previewTransport !== undefined ? { previewTransport } : {}),
              ...(previewHttp !== undefined ? { previewHttp } : {}),
              ...(allowUnsafeEmbeddedPreview !== undefined ? { allowUnsafeEmbeddedPreview } : {}),
          }
        : null;
    return { mode, isEmbedded, embeddingConfig };
}

describe('selectPreviewProvider', () => {
    it('selects the HTTP provider in server mode', () => {
        const provider = selectPreviewProvider({ runtimeConfig: config('server'), deps });
        expect(provider).toBeInstanceOf(HttpPreviewProvider);
        expect(provider.opaqueSafe).toBe(true);
    });

    it('selects the opaque HTTP provider in Electron (app://localhost/preview)', () => {
        const provider = selectPreviewProvider({
            runtimeConfig: config('static'),
            hasElectronApi: true,
            deps,
        });
        expect(provider).toBeInstanceOf(HttpPreviewProvider);
        expect(provider.opaqueSafe).toBe(true);
    });

    it('selects the HTTP provider for an embedded editor with valid previewHttp', () => {
        const provider = selectPreviewProvider({
            runtimeConfig: config('embedded', { isEmbedded: true, previewHttp: VALID_PREVIEW_HTTP }),
            deps,
        });
        expect(provider).toBeInstanceOf(HttpPreviewProvider);
    });

    it('fails closed for an embedded editor without previewHttp', () => {
        expect(() =>
            selectPreviewProvider({
                runtimeConfig: config('embedded', { isEmbedded: true }),
                deps,
            }),
        ).toThrow(PreviewProviderError);
    });

    it('selects the static Service Worker provider for standalone static/PWA', () => {
        const provider = selectPreviewProvider({ runtimeConfig: config('static'), deps });
        expect(provider).toBeInstanceOf(StaticServiceWorkerPreviewProvider);
        expect(provider.opaqueSafe).toBe(false);
    });

    it('rejects an embedded static-service-worker override without the separate unsafe authorization', () => {
        expect(() =>
            selectPreviewProvider({
                runtimeConfig: config('embedded', {
                    isEmbedded: true,
                    previewTransport: 'static-service-worker',
                }),
                deps,
            }),
        ).toThrow(/allowUnsafeEmbeddedPreview/);
    });

    it('honors an embedded static-service-worker override only with explicit development authorization', () => {
        const provider = selectPreviewProvider({
            runtimeConfig: config('embedded', {
                isEmbedded: true,
                previewTransport: 'static-service-worker',
                allowUnsafeEmbeddedPreview: true,
            }),
            deps,
        });
        expect(provider).toBeInstanceOf(StaticServiceWorkerPreviewProvider);
        expect(provider.opaqueSafe).toBe(false);
    });

    it('does not let an embedded http override bypass previewHttp validation', () => {
        expect(() =>
            selectPreviewProvider({
                runtimeConfig: config('embedded', {
                    isEmbedded: true,
                    previewTransport: 'http',
                }),
                deps,
            }),
        ).toThrow(/previewHttp/);
    });

    it('honors the embedded http override when the host also supplies valid previewHttp', () => {
        const provider = selectPreviewProvider({
            runtimeConfig: config('embedded', {
                isEmbedded: true,
                previewTransport: 'http',
                previewHttp: VALID_PREVIEW_HTTP,
            }),
            deps,
        });
        expect(provider).toBeInstanceOf(HttpPreviewProvider);
    });

    it('rejects a Service Worker downgrade in server mode', () => {
        expect(() =>
            selectPreviewProvider({
                runtimeConfig: config('server', { previewTransport: 'static-service-worker' }),
                deps,
            }),
        ).toThrow(/standalone static\/PWA/);
    });

    it('rejects the removed srcdoc override instead of silently downgrading', () => {
        expect(() =>
            selectPreviewProvider({
                runtimeConfig: config('static', { previewTransport: 'srcdoc' }),
                deps,
            }),
        ).toThrow(PreviewProviderError);
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
