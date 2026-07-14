import { describe, expect, it, vi } from 'vitest';
import {
    EMBEDDED_PREVIEW_SANDBOX,
    EmbeddedPreviewSnapshot,
    validateEmbeddedPreviewConfig,
} from './EmbeddedPreviewSnapshot.js';

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
