import { describe, expect, it, vi } from 'vitest';
import {
    EMBEDDED_PREVIEW_SANDBOX,
    EmbeddedPreviewSnapshot,
    selfHostedPreviewSnapshotConfig,
    validateEmbeddedPreviewConfig,
} from './EmbeddedPreviewSnapshot.js';

describe('selfHostedPreviewSnapshotConfig', () => {
    it('builds a config for eXe\'s own capability routes', () => {
        expect(selfHostedPreviewSnapshotConfig()).toMatchObject({
            managementUrl: '/api/preview-snapshot/',
            servingBaseUrl: '/preview-snapshot/',
        });
    });

    it('prefixes BASE_PATH installs and strips trailing slashes', () => {
        expect(selfHostedPreviewSnapshotConfig('/exelearning/')).toMatchObject({
            managementUrl: '/exelearning/api/preview-snapshot/',
            servingBaseUrl: '/exelearning/preview-snapshot/',
        });
    });

    it('passes the same-origin validation the class enforces (dual config, one lifecycle)', () => {
        const validated = validateEmbeddedPreviewConfig(selfHostedPreviewSnapshotConfig());
        expect(validated.managementUrl.origin).toBe(window.location.origin);
        expect(validated.servingBaseUrl.origin).toBe(window.location.origin);
    });

    it('drives the full replace/dispose lifecycle against the self-hosted routes', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ previewId: 'a'.repeat(32), previewUrl: `/preview-snapshot/${'a'.repeat(32)}/index.html` }),
            })
            .mockResolvedValueOnce({ ok: true, status: 204 });
        const client = new EmbeddedPreviewSnapshot(selfHostedPreviewSnapshotConfig(), {
            fetchImpl,
            zipSync: vi.fn(() => new Uint8Array([1])),
        });

        const url = await client.replace({ 'index.html': '<html></html>' });
        expect(url).toBe(`${window.location.origin}/preview-snapshot/${'a'.repeat(32)}/index.html`);
        expect(fetchImpl.mock.calls[0][0].pathname).toBe('/api/preview-snapshot/');

        await client.dispose();
        expect(fetchImpl.mock.calls[1][0].pathname).toBe(`/api/preview-snapshot/${'a'.repeat(32)}`);
        expect(fetchImpl.mock.calls[1][1].method).toBe('DELETE');
    });
});

describe('EmbeddedPreviewSnapshot', () => {
    it('validates same-origin management and serving URLs', () => {
        expect(
            validateEmbeddedPreviewConfig({ managementUrl: '/manage', servingBaseUrl: '/preview' }),
        ).toMatchObject({
            managementUrl: expect.objectContaining({ pathname: '/manage' }),
            servingBaseUrl: expect.objectContaining({ pathname: '/preview' }),
        });
        expect(() =>
            validateEmbeddedPreviewConfig({
                managementUrl: 'https://unrelated.example/manage',
                servingBaseUrl: '/preview',
            }),
        ).toThrow('editor origin');

        expect(
            validateEmbeddedPreviewConfig({
                managementUrl: '/manage',
                servingBaseUrl: '/preview',
                deleteUrlTemplate: '/cleanup?id={previewId}',
            }).deleteUrlTemplate.pathname,
        ).toBe('/cleanup');
    });

    it('applies an opaque sandbox without allow-same-origin', () => {
        const client = new EmbeddedPreviewSnapshot(
            { managementUrl: '/manage', servingBaseUrl: '/preview' },
            { fetchImpl: vi.fn(), zipSync: vi.fn() },
        );
        const iframe = document.createElement('iframe');
        client.applySandbox(iframe);
        expect(iframe.getAttribute('sandbox')).toBe(EMBEDDED_PREVIEW_SANDBOX);
        expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
    });

    it('uploads a complete snapshot, replaces it by id, and cleans it up', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ previewId: 'capability-id' }),
            })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ previewId: 'capability-id' }) })
            .mockResolvedValueOnce({ ok: true, status: 204 });
        const zipSync = vi.fn(() => new Uint8Array([1, 2, 3]));
        const client = new EmbeddedPreviewSnapshot(
            {
                managementUrl: '/manage',
                servingBaseUrl: '/preview',
                managementHeaders: { 'X-CSRF-Token': 'token' },
            },
            { fetchImpl, zipSync },
        );

        expect(await client.replace({ 'index.html': new TextEncoder().encode('<html></html>').buffer })).toBe(
            `${window.location.origin}/preview/capability-id/index.html`,
        );
        await client.replace({ 'index.html': new ArrayBuffer(0) });
        const secondBody = fetchImpl.mock.calls[1][1].body;
        expect(secondBody.get('previewId')).toBe('capability-id');
        expect(fetchImpl.mock.calls[0][1]).toMatchObject({
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': 'token' },
        });

        await client.dispose();
        expect(fetchImpl.mock.calls[2][0].pathname).toBe('/manage/capability-id');
        expect(fetchImpl.mock.calls[2][1].method).toBe('DELETE');
    });

    it('uses a same-origin delete URL template when the host cannot append path segments', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ previewId: 'capability-id' }) })
            .mockResolvedValueOnce({ ok: true, status: 204 });
        const client = new EmbeddedPreviewSnapshot(
            {
                managementUrl: '/?rest_route=/preview-session/42',
                servingBaseUrl: '/',
                deleteUrlTemplate: '/?rest_route=/preview-session/42/{previewId}',
            },
            { fetchImpl, zipSync: vi.fn(() => new Uint8Array()) },
        );

        await client.replace({ 'index.html': '<html></html>' });
        await client.dispose();
        expect(fetchImpl.mock.calls[1][0].searchParams.get('rest_route')).toBe(
            '/preview-session/42/capability-id',
        );
    });

    it('substitutes a PATH-based delete template even though the URL constructor percent-encodes braces', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ previewId: 'capability-id' }) })
            .mockResolvedValueOnce({ ok: true, status: 204 });
        const client = new EmbeddedPreviewSnapshot(
            {
                managementUrl: '/manage',
                servingBaseUrl: '/preview',
                deleteUrlTemplate: '/cleanup/{previewId}',
            },
            { fetchImpl, zipSync: vi.fn(() => new Uint8Array()) },
        );
        await client.replace({ 'index.html': '<html></html>' });
        await client.dispose();
        expect(fetchImpl.mock.calls[1][0].pathname).toBe('/cleanup/capability-id');
    });

    it('fails closed when ZIP support or the host response is invalid', async () => {
        const withoutZip = new EmbeddedPreviewSnapshot(
            { managementUrl: '/manage', servingBaseUrl: '/preview' },
            { fetchImpl: vi.fn(), zipSync: null },
        );
        await expect(withoutZip.replace({})).rejects.toThrow('ZIP support');

        const invalidResponse = new EmbeddedPreviewSnapshot(
            { managementUrl: '/manage', servingBaseUrl: '/preview' },
            { fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }), zipSync: vi.fn(() => []) },
        );
        await expect(invalidResponse.replace({})).rejects.toThrow('previewId');
    });
});
