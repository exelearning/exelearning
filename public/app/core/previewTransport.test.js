import { describe, it, expect } from 'vitest';
import {
    resolvePreviewTransport,
    isUnsafeEmbeddedServiceWorker,
    validatePreviewHttpConfig,
} from './previewTransport.js';

const VALID_PREVIEW_HTTP = Object.freeze({
    protocolVersion: 2,
    managementBaseUrl: '/mod/exelearning/preview_session.php',
    servingBaseUrl: '/mod/exelearning/preview.php',
});

function config(mode, { isEmbedded = false, previewTransport = undefined, previewHttp = undefined } = {}) {
    const embeddingConfig =
        previewTransport || previewHttp ? { ...(previewTransport ? { previewTransport } : {}), ...(previewHttp ? { previewHttp } : {}) } : null;
    return { mode, isEmbedded, embeddingConfig };
}

describe('resolvePreviewTransport', () => {
    it('maps server mode to the HTTP transport', () => {
        expect(resolvePreviewTransport(config('server'))).toBe('http');
    });

    it('maps Electron to the opaque HTTP transport (app://localhost/preview)', () => {
        expect(resolvePreviewTransport(config('static'), { hasElectronApi: true })).toBe('http');
    });

    it('maps an embedded editor with valid previewHttp to the HTTP transport', () => {
        expect(
            resolvePreviewTransport(config('embedded', { isEmbedded: true, previewHttp: VALID_PREVIEW_HTTP })),
        ).toBe('http');
    });

    it('fails closed for an embedded editor without previewHttp (no silent fallback)', () => {
        expect(() => resolvePreviewTransport(config('embedded', { isEmbedded: true }))).toThrow(/previewHttp/);
    });

    it('fails closed for an embedded editor with malformed previewHttp, naming the field', () => {
        expect(() =>
            resolvePreviewTransport(
                config('embedded', {
                    isEmbedded: true,
                    previewHttp: { protocolVersion: 1, managementBaseUrl: '/x', servingBaseUrl: '/y' },
                }),
            ),
        ).toThrow(/protocolVersion/);
    });

    it('uses the static Service Worker transport for standalone static builds', () => {
        expect(resolvePreviewTransport(config('static'))).toBe('static-service-worker');
    });

    it('uses the static Service Worker transport for a standalone PWA (isEmbedded false)', () => {
        expect(resolvePreviewTransport(config('static', { isEmbedded: false }))).toBe('static-service-worker');
    });

    it('no mode selects the removed srcdoc transport', () => {
        for (const transport of [
            resolvePreviewTransport(config('server')),
            resolvePreviewTransport(config('static'), { hasElectronApi: true }),
            resolvePreviewTransport(config('static')),
            resolvePreviewTransport(config('embedded', { isEmbedded: true, previewHttp: VALID_PREVIEW_HTTP })),
        ]) {
            expect(transport).not.toBe('srcdoc');
        }
    });

    it('honors the explicit http override', () => {
        expect(resolvePreviewTransport(config('static', { previewTransport: 'http' }))).toBe('http');
    });

    it('honors the explicit static-service-worker override, even in an embedded context', () => {
        expect(
            resolvePreviewTransport(config('embedded', { isEmbedded: true, previewTransport: 'static-service-worker' })),
        ).toBe('static-service-worker');
    });

    it('rejects the removed srcdoc override instead of downgrading', () => {
        expect(() => resolvePreviewTransport(config('server', { previewTransport: 'srcdoc' }))).toThrow(
            /previewTransport/,
        );
    });

    it('rejects the removed legacy-sw override instead of downgrading', () => {
        expect(() => resolvePreviewTransport(config('server', { previewTransport: 'legacy-sw' }))).toThrow(
            /previewTransport/,
        );
    });

    it('rejects unknown overrides instead of downgrading', () => {
        expect(() => resolvePreviewTransport(config('server', { previewTransport: 'same-origin' }))).toThrow(
            /previewTransport/,
        );
    });
});

describe('isUnsafeEmbeddedServiceWorker', () => {
    it('is true only when an embedded editor overrides to static-service-worker', () => {
        expect(
            isUnsafeEmbeddedServiceWorker(config('embedded', { isEmbedded: true, previewTransport: 'static-service-worker' })),
        ).toBe(true);
    });

    it('is false for a standalone static build (no override)', () => {
        expect(isUnsafeEmbeddedServiceWorker(config('static'))).toBe(false);
    });

    it('is false for an embedded editor overriding to http', () => {
        expect(
            isUnsafeEmbeddedServiceWorker(config('embedded', { isEmbedded: true, previewTransport: 'http' })),
        ).toBe(false);
    });
});

describe('validatePreviewHttpConfig', () => {
    it('accepts a minimal valid block and normalizes optional records to {}', () => {
        const result = validatePreviewHttpConfig({
            protocolVersion: 2,
            managementBaseUrl: '/api/preview-session',
            servingBaseUrl: '/preview',
        });
        expect(result).toEqual({
            protocolVersion: 2,
            managementBaseUrl: '/api/preview-session',
            servingBaseUrl: '/preview',
            managementHeaders: {},
            managementQuery: {},
        });
    });

    it('accepts optional string→string header and query records', () => {
        const result = validatePreviewHttpConfig({
            protocolVersion: 2,
            managementBaseUrl: 'https://host.example/api/preview-session',
            servingBaseUrl: 'https://host.example/preview',
            managementHeaders: { 'X-WP-Nonce': 'abc' },
            managementQuery: { cmid: '42', sesskey: 'zzz' },
        });
        expect(result.managementHeaders).toEqual({ 'X-WP-Nonce': 'abc' });
        expect(result.managementQuery).toEqual({ cmid: '42', sesskey: 'zzz' });
    });

    it('rejects a non-object', () => {
        expect(() => validatePreviewHttpConfig(null)).toThrow(/previewHttp/);
        expect(() => validatePreviewHttpConfig('nope')).toThrow(/previewHttp/);
        expect(() => validatePreviewHttpConfig([])).toThrow(/previewHttp/);
    });

    it('rejects a wrong protocolVersion, naming the field', () => {
        expect(() =>
            validatePreviewHttpConfig({ protocolVersion: 3, managementBaseUrl: '/a', servingBaseUrl: '/b' }),
        ).toThrow(/protocolVersion/);
    });

    it('rejects an empty or non-string managementBaseUrl, naming the field', () => {
        expect(() =>
            validatePreviewHttpConfig({ protocolVersion: 2, managementBaseUrl: '', servingBaseUrl: '/b' }),
        ).toThrow(/managementBaseUrl/);
        expect(() =>
            validatePreviewHttpConfig({ protocolVersion: 2, managementBaseUrl: 5, servingBaseUrl: '/b' }),
        ).toThrow(/managementBaseUrl/);
    });

    it('rejects a missing servingBaseUrl, naming the field', () => {
        expect(() => validatePreviewHttpConfig({ protocolVersion: 2, managementBaseUrl: '/a' })).toThrow(
            /servingBaseUrl/,
        );
    });

    it('rejects non-string header values, naming the offending key', () => {
        expect(() =>
            validatePreviewHttpConfig({
                protocolVersion: 2,
                managementBaseUrl: '/a',
                servingBaseUrl: '/b',
                managementHeaders: { 'X-Bad': 42 },
            }),
        ).toThrow(/managementHeaders\.X-Bad/);
    });

    it('rejects a non-plain-object query record, naming the field', () => {
        expect(() =>
            validatePreviewHttpConfig({
                protocolVersion: 2,
                managementBaseUrl: '/a',
                servingBaseUrl: '/b',
                managementQuery: ['cmid'],
            }),
        ).toThrow(/managementQuery/);
    });
});
