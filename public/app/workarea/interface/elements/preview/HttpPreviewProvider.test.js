import { describe, it, expect, beforeEach } from 'vitest';
import { HttpPreviewProvider } from './HttpPreviewProvider.js';
import { PreviewProviderError, PreviewSessionExpiredError } from './providerContract.js';
import { INJECTED_MARKER } from './previewContentDecorators.js';
import { sha256Hex } from './fileManifest.js';

const PREVIEW_ID = '9f6b2c1e-9a51-4c40-a2f5-1234567890ab';

/**
 * Configurable fake backend implementing the preview-session API contract.
 */
function createFakeBackend(overrides = {}) {
    const calls = [];
    const state = {
        knownHashes: new Set(),
        limits: { maxFilesPerSession: 5000, maxBytesPerSession: 200 * 1024 * 1024, recommendedBatchBytes: 64 * 1024 * 1024 },
        manifestStatus: 200,
        blobsStatus: 200,
        createStatus: 201,
        ...overrides,
    };

    const fetchFn = async (url, opts = {}) => {
        const method = (opts.method || 'GET').toUpperCase();
        const call = { url: String(url), method, opts };
        calls.push(call);

        if (method === 'POST' && call.url.endsWith('/api/preview-session')) {
            return new Response(JSON.stringify({ previewId: PREVIEW_ID, limits: state.limits }), {
                status: state.createStatus,
            });
        }
        if (method === 'POST' && call.url.includes('/manifest')) {
            if (state.manifestStatus !== 200) return new Response('nope', { status: state.manifestStatus });
            const body = JSON.parse(opts.body);
            call.manifest = body.files;
            const missing = [
                ...new Set(
                    Object.values(body.files)
                        .map((entry) => entry.sha256)
                        .filter((hash) => !state.knownHashes.has(hash)),
                ),
            ];
            call.missing = missing;
            return new Response(JSON.stringify({ manifestId: 'm1', missing, active: missing.length === 0 }), {
                status: 200,
            });
        }
        if (method === 'POST' && call.url.includes('/blobs')) {
            if (state.blobsStatus !== 200) return new Response('nope', { status: state.blobsStatus });
            const hashes = JSON.parse(opts.body.get('hashes'));
            call.uploadedHashes = hashes;
            for (const hash of hashes) state.knownHashes.add(hash);
            return new Response(JSON.stringify({ stored: hashes, mismatched: [], active: true }), { status: 200 });
        }
        if (method === 'DELETE') {
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        if (method === 'GET' && call.url.includes('/libs/pdfjs/')) {
            return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        }
        return new Response('not found', { status: 404 });
    };

    return { fetchFn, calls, state };
}

const FILES = {
    'index.html': '<!DOCTYPE html><html><body><p>x</p></body></html>',
    'content/css/base.css': 'body{}',
};

describe('HttpPreviewProvider', () => {
    let backend;
    let provider;

    beforeEach(() => {
        backend = createFakeBackend();
        provider = new HttpPreviewProvider({ basePath: '/exe', fetchFn: backend.fetchFn });
    });

    it('creates a session, syncs the manifest and uploads only missing blobs', async () => {
        const session = await provider.prepare(FILES);

        expect(session.mode).toBe('http');
        expect(session.opaqueSafe).toBe(true);
        expect(session.id).toBe(PREVIEW_ID);
        expect(session.entryUrl).toBe(`/exe/preview/${PREVIEW_ID}/index.html?exe-teacher=1`);

        const manifestCall = backend.calls.find((c) => c.url.includes('/manifest'));
        expect(manifestCall.url).toBe(`/exe/api/preview-session/${PREVIEW_ID}/manifest`);
        const blobsCall = backend.calls.find((c) => c.url.includes('/blobs'));
        expect(blobsCall.uploadedHashes.sort()).toEqual(manifestCall.missing.sort());
    });

    it('decorates HTML before hashing so served bytes match the manifest', async () => {
        await provider.prepare(FILES);
        const manifestCall = backend.calls.find((c) => c.url.includes('/manifest'));
        const blobsCall = backend.calls.find((c) => c.url.includes('/blobs'));

        const uploadedFiles = blobsCall.opts.body.getAll('files');
        const texts = await Promise.all(uploadedFiles.map((blob) => blob.text()));
        const decorated = texts.find((text) => text.includes('<!DOCTYPE html'));
        expect(decorated).toContain(INJECTED_MARKER);

        const decoratedHash = await sha256Hex(new TextEncoder().encode(decorated));
        expect(manifestCall.manifest['index.html'].sha256).toBe(decoratedHash);
    });

    it('skips re-uploading unchanged blobs on update', async () => {
        await provider.prepare(FILES);
        backend.calls.length = 0;

        await provider.update({ ...FILES, 'index.html': '<!DOCTYPE html><html><body><p>y</p></body></html>' });

        const blobsCall = backend.calls.find((c) => c.url.includes('/blobs'));
        expect(blobsCall.uploadedHashes).toHaveLength(1);
    });

    it('does not upload at all when nothing changed', async () => {
        await provider.prepare(FILES);
        backend.calls.length = 0;

        await provider.update(FILES);

        expect(backend.calls.find((c) => c.url.includes('/blobs'))).toBeUndefined();
    });

    it('throws PreviewSessionExpiredError when the session vanished', async () => {
        await provider.prepare(FILES);
        backend.state.manifestStatus = 404;

        await expect(provider.update(FILES)).rejects.toBeInstanceOf(PreviewSessionExpiredError);
    });

    it('throws PreviewProviderError on server failures', async () => {
        backend.state.createStatus = 500;
        await expect(provider.prepare(FILES)).rejects.toBeInstanceOf(PreviewProviderError);
    });

    it('restages and retries once when a blob upload hits a stale manifest (409)', async () => {
        backend.state.blobsStatus = 409;
        let blobAttempts = 0;
        const originalFetch = backend.fetchFn;
        const retryingFetch = async (url, opts) => {
            if (String(url).includes('/blobs')) {
                blobAttempts++;
                if (blobAttempts > 1) backend.state.blobsStatus = 200;
            }
            return originalFetch(url, opts);
        };
        provider = new HttpPreviewProvider({ basePath: '/exe', fetchFn: retryingFetch });

        await provider.prepare(FILES);

        const manifestCalls = backend.calls.filter((c) => c.url.includes('/manifest'));
        expect(manifestCalls.length).toBe(2);
        expect(blobAttempts).toBe(2);
    });

    it('gives up after one stale-manifest retry', async () => {
        backend.state.blobsStatus = 409;
        await expect(provider.prepare(FILES)).rejects.toBeInstanceOf(PreviewProviderError);
    });

    it('splits blob uploads into batches bounded by recommendedBatchBytes', async () => {
        backend.state.limits = { ...backend.state.limits, recommendedBatchBytes: 10 };
        const files = {
            'a.css': 'x'.repeat(8),
            'b.css': 'y'.repeat(8),
            'c.css': 'z'.repeat(8),
        };
        await provider.prepare(files);
        const blobCalls = backend.calls.filter((c) => c.url.includes('/blobs'));
        expect(blobCalls.length).toBe(3);
    });

    it('adds PDF.js runtime files to the session when the preview contains PDFs', async () => {
        const files = { ...FILES, 'content/resources/doc.pdf': new Uint8Array([0x25]) };
        await provider.prepare(files);

        const manifestCall = backend.calls.find((c) => c.url.includes('/manifest'));
        expect(manifestCall.manifest['libs/pdfjs/pdf.min.mjs']).toBeDefined();
        expect(manifestCall.manifest['libs/pdfjs/pdf.worker.min.mjs']).toBeDefined();
        const pdfjsFetch = backend.calls.find((c) => c.method === 'GET' && c.url.includes('/libs/pdfjs/pdf.min.mjs'));
        expect(pdfjsFetch.url).toBe('/exe/libs/pdfjs/pdf.min.mjs');
    });

    it('builds page URLs under the session prefix with a cache-busting version', async () => {
        await provider.prepare(FILES);
        const first = provider.resolvePage('html/página 2.html');
        expect(first.kind).toBe('url');
        expect(first.url).toContain(`/exe/preview/${PREVIEW_ID}/html/p%C3%A1gina%202.html`);
        expect(first.url).toContain('exe-teacher=1');

        const v1 = new URL(first.url, 'http://x').searchParams.get('v');
        await provider.update({ ...FILES, 'content/css/base.css': 'p{}' });
        const v2 = new URL(provider.resolvePage('index.html').url, 'http://x').searchParams.get('v');
        expect(v2).not.toBe(v1);
    });

    it('fetches session files for the parent-side document opener', async () => {
        await provider.prepare(FILES);
        const bytes = await provider.getFile('content/css/base.css');
        // The fake backend 404s unknown GETs, so this exercises the URL + null contract.
        expect(bytes).toBeNull();
        const getCall = backend.calls.find(
            (c) => c.method === 'GET' && c.url.includes(`/preview/${PREVIEW_ID}/content/css/base.css`),
        );
        expect(getCall).toBeDefined();
    });

    it('disposes the session with a keepalive DELETE', async () => {
        await provider.prepare(FILES);
        await provider.dispose({ keepalive: true });

        const deleteCall = backend.calls.find((c) => c.method === 'DELETE');
        expect(deleteCall.url).toBe(`/exe/api/preview-session/${PREVIEW_ID}`);
        expect(deleteCall.opts.keepalive).toBe(true);
        expect(provider.session).toBeNull();
    });
});
