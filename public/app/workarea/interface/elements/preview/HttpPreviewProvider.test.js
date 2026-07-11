import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpPreviewProvider } from './HttpPreviewProvider.js';
import { PreviewProviderError, PreviewSessionExpiredError } from './providerContract.js';
import { INJECTED_MARKER } from './previewContentDecorators.js';

const PREVIEW_ID = '9f6b2c1e-9a51-4c40-a2f5-1234567890ab';

const ASSET_ID = '3f2a9c41-d2e8-4a1b-93f5-7c0d12345678';
const ASSET_HASH = 'a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4e5f60718';
const ASSET_KEY = `${ASSET_ID}@${ASSET_HASH.slice(0, 16)}`;

/**
 * Configurable fake backend implementing the preview-session API (contract v2).
 */
function createFakeBackend(overrides = {}) {
    const calls = [];
    const state = {
        revision: 0,
        documents: new Map(),
        assets: new Set(), // stored asset keys
        fixedIds: new Set([
            'libs/jquery/jquery.min.js',
            'theme:base/content.css',
            'content/css/base.css',
            'libs/pdfjs/pdf.min.mjs',
            'libs/pdfjs/pdf.worker.min.mjs',
        ]),
        limits: {
            maxFilesPerSession: 5000,
            maxBytesPerSession: 200 * 1024 * 1024,
            maxAssetBytes: 128 * 1024 * 1024,
            recommendedBatchBytes: 64 * 1024 * 1024,
        },
        protocolVersion: 2,
        createStatus: 201,
        assetsStatus: 200,
        revisionStatus: 200,
        rejectKeys: new Set(),
        rejectReason: 'asset-too-large',
        ...overrides,
    };

    const fetchFn = async (url, opts = {}) => {
        const method = (opts.method || 'GET').toUpperCase();
        const call = { url: String(url), method, opts };
        calls.push(call);

        // Create is the only POST that targets the management base directly
        // (no /assets or /revisions suffix) — robust to a custom managementBaseUrl.
        if (method === 'POST' && !call.url.includes('/assets') && !call.url.includes('/revisions')) {
            return new Response(
                JSON.stringify({
                    previewId: PREVIEW_ID,
                    protocolVersion: state.protocolVersion,
                    revision: 0,
                    limits: state.limits,
                }),
                { status: state.createStatus },
            );
        }

        if (method === 'POST' && call.url.includes('/assets')) {
            if (state.assetsStatus !== 200) return new Response('nope', { status: state.assetsStatus });
            const declared = JSON.parse(opts.body.get('assets'));
            call.assetKeys = declared.map((entry) => entry.key);
            call.assetSizes = declared.map((entry) => entry.size);
            call.assetFiles = opts.body.getAll('files');
            const stored = [];
            const alreadyStored = [];
            const rejected = [];
            for (const { key } of declared) {
                if (state.rejectKeys.has(key)) {
                    rejected.push({ key, reason: state.rejectReason });
                    continue;
                }
                if (state.assets.has(key)) alreadyStored.push(key);
                else {
                    state.assets.add(key);
                    stored.push(key);
                }
            }
            return new Response(JSON.stringify({ stored, alreadyStored, rejected }), { status: 200 });
        }

        if (method === 'POST' && call.url.includes('/revisions')) {
            if (state.revisionStatus !== 200) return new Response('nope', { status: state.revisionStatus });
            const revision = JSON.parse(opts.body.get('revision'));
            call.revision = revision;
            call.files = opts.body.getAll('files');

            if (revision.baseRevision !== state.revision || revision.nextRevision !== state.revision + 1) {
                return new Response(
                    JSON.stringify({ reason: 'revision-conflict', currentRevision: state.revision }),
                    { status: 409 },
                );
            }
            const missing = [...new Set(Object.values(revision.assetRefs).filter((key) => !state.assets.has(key)))];
            if (missing.length > 0) {
                return new Response(JSON.stringify({ reason: 'missing-assets', missing }), { status: 422 });
            }
            const unknown = [...new Set(Object.values(revision.fixedRefs).filter((id) => !state.fixedIds.has(id)))];
            if (unknown.length > 0) {
                return new Response(JSON.stringify({ reason: 'unknown-fixed-resources', resources: unknown }), {
                    status: 422,
                });
            }
            for (const path of revision.deletes) state.documents.delete(path);
            revision.writes.forEach((path, index) => state.documents.set(path, call.files[index]));
            state.revision = revision.nextRevision;
            return new Response(JSON.stringify({ revision: state.revision, active: true }), { status: 200 });
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

/** Build a layered input (contract shape the panel hands to the provider). */
function layeredInput(overrides = {}) {
    return {
        documents:
            overrides.documents ??
            new Map([
                ['index.html', '<!DOCTYPE html><html><body><p>x</p></body></html>'],
                ['libs/common_i18n.js', 'window.i18n = {};'],
            ]),
        assetRefs: overrides.assetRefs ?? new Map(),
        fixedRefs: overrides.fixedRefs ?? new Map([['libs/jquery/jquery.min.js', 'libs/jquery/jquery.min.js']]),
        getAssetBytes: overrides.getAssetBytes ?? vi.fn(async () => new Uint8Array([1, 2, 3, 4])),
        resolveFixedResource: overrides.resolveFixedResource,
    };
}

function assetRef(overrides = {}) {
    return { assetId: ASSET_ID, hash: ASSET_HASH, size: 4, mime: 'image/png', ...overrides };
}

const revisionCalls = (backend) => backend.calls.filter((c) => c.url.includes('/revisions'));
const assetCalls = (backend) => backend.calls.filter((c) => c.method === 'POST' && c.url.includes('/assets'));

describe('HttpPreviewProvider (contract v2)', () => {
    let backend;
    let provider;

    beforeEach(() => {
        backend = createFakeBackend();
        provider = new HttpPreviewProvider({ basePath: '/exe', fetchFn: backend.fetchFn });
    });

    describe('session creation', () => {
        it('creates a session and publishes revision 1 with every document as a write', async () => {
            const input = layeredInput();
            const session = await provider.prepare(input);

            expect(session.id).toBe(PREVIEW_ID);
            expect(session.mode).toBe('http');
            expect(session.opaqueSafe).toBe(true);
            expect(session.entryUrl).toBe(`/exe/preview/${PREVIEW_ID}/index.html?exe-teacher=1`);

            const [revCall] = revisionCalls(backend);
            expect(revCall.revision.baseRevision).toBe(0);
            expect(revCall.revision.nextRevision).toBe(1);
            expect(revCall.revision.writes.sort()).toEqual(['index.html', 'libs/common_i18n.js']);
            expect(revCall.revision.deletes).toEqual([]);
            expect(revCall.revision.fixedRefs).toEqual({ 'libs/jquery/jquery.min.js': 'libs/jquery/jquery.min.js' });
            expect(backend.state.revision).toBe(1);
        });

        it('rejects a create-session response without protocolVersion 2 (no silent fallback)', async () => {
            backend.state.protocolVersion = undefined;
            await expect(provider.prepare(layeredInput())).rejects.toBeInstanceOf(PreviewProviderError);
            expect(revisionCalls(backend)).toHaveLength(0);
        });

        it('rejects protocol v1-style responses', async () => {
            backend.state.protocolVersion = 1;
            await expect(provider.prepare(layeredInput())).rejects.toBeInstanceOf(PreviewProviderError);
        });

        it('throws PreviewProviderError on create failures', async () => {
            backend.state.createStatus = 500;
            await expect(provider.prepare(layeredInput())).rejects.toBeInstanceOf(PreviewProviderError);
        });

        it('rejects non-layered input (plain file maps are for other transports)', async () => {
            await expect(provider.prepare({ 'index.html': 'x' })).rejects.toBeInstanceOf(PreviewProviderError);
        });
    });

    describe('document deltas', () => {
        it('decorates HTML before upload so served bytes carry the preview scripts', async () => {
            await provider.prepare(layeredInput());
            const [revCall] = revisionCalls(backend);
            const index = revCall.revision.writes.indexOf('index.html');
            const uploaded = await revCall.files[index].text();
            expect(uploaded).toContain(INJECTED_MARKER);
        });

        it('publishes an empty delta when nothing changed (no bytes re-sent)', async () => {
            const input = layeredInput();
            await provider.prepare(input);
            backend.calls.length = 0;

            await provider.update(input);

            const [revCall] = revisionCalls(backend);
            expect(revCall.revision.writes).toEqual([]);
            expect(revCall.revision.deletes).toEqual([]);
            expect(revCall.files).toHaveLength(0);
        });

        it('writes only the documents whose bytes changed', async () => {
            const input = layeredInput();
            await provider.prepare(input);
            backend.calls.length = 0;

            const documents = new Map(input.documents);
            documents.set('index.html', '<!DOCTYPE html><html><body><p>edited</p></body></html>');
            await provider.update({ ...input, documents });

            const [revCall] = revisionCalls(backend);
            expect(revCall.revision.writes).toEqual(['index.html']);
        });

        it('compares binary documents byte-exactly', async () => {
            const bytes = new Uint8Array([1, 2, 3]);
            const input = layeredInput({
                documents: new Map([
                    ['index.html', '<html><body>x</body></html>'],
                    ['content/data.bin', bytes],
                ]),
            });
            await provider.prepare(input);
            backend.calls.length = 0;

            // Same bytes in a NEW buffer: still equal → no write.
            const sameBytes = new Uint8Array([1, 2, 3]);
            const documents = new Map(input.documents);
            documents.set('content/data.bin', sameBytes);
            await provider.update({ ...input, documents });
            expect(revisionCalls(backend)[0].revision.writes).toEqual([]);

            backend.calls.length = 0;
            const changed = new Uint8Array([1, 2, 9]);
            documents.set('content/data.bin', changed);
            await provider.update({ ...input, documents });
            expect(revisionCalls(backend)[0].revision.writes).toEqual(['content/data.bin']);
        });

        it('reports vanished documents as deletes', async () => {
            const input = layeredInput();
            await provider.prepare(input);
            backend.calls.length = 0;

            const documents = new Map(input.documents);
            documents.delete('libs/common_i18n.js');
            await provider.update({ ...input, documents });

            const [revCall] = revisionCalls(backend);
            expect(revCall.revision.deletes).toEqual(['libs/common_i18n.js']);
        });

        it('bumps the resolvePage cache-buster on every sync', async () => {
            const input = layeredInput();
            await provider.prepare(input);
            const v1 = new URL(provider.resolvePage('index.html').url, 'http://x').searchParams.get('v');
            await provider.update(input);
            const v2 = new URL(provider.resolvePage('index.html').url, 'http://x').searchParams.get('v');
            expect(v2).not.toBe(v1);
        });
    });

    describe('asset uploads', () => {
        it('uploads new assets once under their identity keys and never again', async () => {
            const getAssetBytes = vi.fn(async () => new Uint8Array([9, 9, 9]));
            const input = layeredInput({
                assetRefs: new Map([['content/resources/photo.png', assetRef()]]),
                getAssetBytes,
            });
            await provider.prepare(input);

            const [upload] = assetCalls(backend);
            expect(upload.assetKeys).toEqual([ASSET_KEY]);
            expect(upload.assetSizes).toEqual([3]);
            expect(getAssetBytes).toHaveBeenCalledTimes(1);
            expect(getAssetBytes).toHaveBeenCalledWith(ASSET_ID);
            expect(revisionCalls(backend)[0].revision.assetRefs).toEqual({
                'content/resources/photo.png': ASSET_KEY,
            });

            backend.calls.length = 0;
            await provider.update(input);
            expect(assetCalls(backend)).toHaveLength(0);
            expect(getAssetBytes).toHaveBeenCalledTimes(1);
        });

        it('splits asset uploads into batches bounded by recommendedBatchBytes (oversized ships alone)', async () => {
            backend.state.limits = { ...backend.state.limits, recommendedBatchBytes: 10 };
            const ids = [
                '00000000-0000-4000-8000-000000000001',
                '00000000-0000-4000-8000-000000000002',
                '00000000-0000-4000-8000-000000000003',
            ];
            const sizes = [6, 6, 32]; // 32 > batch limit → ships alone
            const refs = new Map(
                ids.map((id, i) => [
                    `content/resources/a${i}.png`,
                    assetRef({ assetId: id, hash: `${i}`.repeat(16), size: sizes[i] }),
                ]),
            );
            const getAssetBytes = vi.fn(async (assetId) => new Uint8Array(sizes[ids.indexOf(assetId)]));
            await provider.prepare(layeredInput({ assetRefs: refs, getAssetBytes }));

            const uploads = assetCalls(backend);
            expect(uploads).toHaveLength(3);
            expect(uploads.map((u) => u.assetKeys.length)).toEqual([1, 1, 1]);
        });

        it('drops refs for assets whose bytes are unavailable and retries them next refresh', async () => {
            const getAssetBytes = vi.fn(async () => null);
            const input = layeredInput({
                assetRefs: new Map([['content/resources/photo.png', assetRef()]]),
                getAssetBytes,
            });
            await provider.prepare(input);

            // Revision still publishes, without the unavailable asset.
            expect(revisionCalls(backend)[0].revision.assetRefs).toEqual({});

            // Blob shows up later → retried and referenced on the next sync.
            getAssetBytes.mockResolvedValue(new Uint8Array([1]));
            backend.calls.length = 0;
            await provider.update(input);
            expect(assetCalls(backend)).toHaveLength(1);
            expect(revisionCalls(backend)[0].revision.assetRefs).toEqual({
                'content/resources/photo.png': ASSET_KEY,
            });
        });

        it('drops server-rejected assets permanently (warn + 404 for that file only)', async () => {
            backend.state.rejectKeys.add(ASSET_KEY);
            const getAssetBytes = vi.fn(async () => new Uint8Array([1]));
            const input = layeredInput({
                assetRefs: new Map([['content/resources/big.mp4', assetRef()]]),
                getAssetBytes,
            });
            await provider.prepare(input);
            expect(revisionCalls(backend)[0].revision.assetRefs).toEqual({});

            backend.calls.length = 0;
            getAssetBytes.mockClear();
            await provider.update(input);
            // Never retried: the key is remembered as rejected.
            expect(assetCalls(backend)).toHaveLength(0);
            expect(getAssetBytes).not.toHaveBeenCalled();
        });

        it('retries a transiently rejected asset (budget) on the next sync instead of blacklisting it', async () => {
            backend.state.rejectKeys.add(ASSET_KEY);
            backend.state.rejectReason = 'global-budget-exceeded';
            const getAssetBytes = vi.fn(async () => new Uint8Array([1]));
            const input = layeredInput({
                assetRefs: new Map([['content/resources/big.mp4', assetRef()]]),
                getAssetBytes,
            });
            await provider.prepare(input);
            // Rejected this round → its path is not served yet.
            expect(revisionCalls(backend)[0].revision.assetRefs).toEqual({});

            // Space frees up server-side; the next sync must ATTEMPT the upload again.
            backend.state.rejectKeys.clear();
            backend.calls.length = 0;
            getAssetBytes.mockClear();
            await provider.update(input);
            expect(getAssetBytes).toHaveBeenCalled();
            expect(assetCalls(backend).length).toBeGreaterThan(0);
            expect(revisionCalls(backend)[0].revision.assetRefs).toEqual({ 'content/resources/big.mp4': ASSET_KEY });
        });

        it('drops asset refs with identities that cannot form a contract key', async () => {
            const input = layeredInput({
                assetRefs: new Map([
                    ['content/resources/legacy.png', assetRef({ assetId: 'legacy-name.png', hash: ASSET_HASH })],
                ]),
            });
            await provider.prepare(input);
            expect(assetCalls(backend)).toHaveLength(0);
            expect(revisionCalls(backend)[0].revision.assetRefs).toEqual({});
        });
    });

    describe('PDF.js fixed refs', () => {
        it('references PDF.js through the fixed layer when an asset is a PDF (no session copy)', async () => {
            const input = layeredInput({
                assetRefs: new Map([
                    [
                        'content/resources/doc.pdf',
                        assetRef({ assetId: '00000000-0000-4000-8000-00000000000f', hash: ASSET_HASH }),
                    ],
                ]),
            });
            await provider.prepare(input);

            const [revCall] = revisionCalls(backend);
            expect(revCall.revision.fixedRefs['libs/pdfjs/pdf.min.mjs']).toBe('libs/pdfjs/pdf.min.mjs');
            expect(revCall.revision.fixedRefs['libs/pdfjs/pdf.worker.min.mjs']).toBe('libs/pdfjs/pdf.worker.min.mjs');
            // The runtime is not fetched from the app origin any more.
            expect(backend.calls.find((c) => c.method === 'GET' && c.url.includes('/libs/pdfjs/'))).toBeUndefined();
        });

        it('adds the refs when a PDF rides the document layer too', async () => {
            const input = layeredInput({
                documents: new Map([
                    ['index.html', '<html><body>x</body></html>'],
                    ['content/resources/doc.pdf', new Uint8Array([0x25, 0x50])],
                ]),
            });
            await provider.prepare(input);
            expect(revisionCalls(backend)[0].revision.fixedRefs['libs/pdfjs/pdf.min.mjs']).toBe(
                'libs/pdfjs/pdf.min.mjs',
            );
        });
    });

    describe('decoration cache', () => {
        it('decorates a page once while its raw value is unchanged (reference equality)', async () => {
            const input = layeredInput();
            await provider.prepare(input);
            const decoratedFirst = provider._decorationCache.get('index.html').decorated;

            await provider.update(input);
            expect(provider._decorationCache.get('index.html').decorated).toBe(decoratedFirst);
        });
    });

    describe('error recovery', () => {
        it('recovers from a revision conflict with a full document snapshot at currentRevision', async () => {
            const input = layeredInput();
            await provider.prepare(input);

            // Another writer bumped the server revision behind our back.
            backend.state.revision = 7;
            backend.calls.length = 0;

            const documents = new Map(input.documents);
            documents.set('index.html', '<html><body>new</body></html>');
            await provider.update({ ...input, documents });

            const posts = revisionCalls(backend);
            expect(posts).toHaveLength(2);
            expect(posts[1].revision.baseRevision).toBe(7);
            expect(posts[1].revision.nextRevision).toBe(8);
            // Full snapshot: every document, no deletes.
            expect(posts[1].revision.writes.sort()).toEqual(['index.html', 'libs/common_i18n.js']);
            expect(posts[1].revision.deletes).toEqual([]);

            // Local revision tracking follows the server.
            backend.calls.length = 0;
            await provider.update({ ...input, documents });
            expect(revisionCalls(backend)[0].revision.baseRevision).toBe(8);
        });

        it('includes deletions in 409 recovery for a publish whose response was lost after the server applied it', async () => {
            const A = '<html><body>A</body></html>';
            const B = '<html><body>B</body></html>';
            const base = new Map([['index.html', '<html><body>i</body></html>']]);
            const input = layeredInput({ documents: base, fixedRefs: new Map() });
            await provider.prepare(input);
            expect(backend.state.revision).toBe(1);

            // Publish adds A + B; the server APPLIES it but the response is lost,
            // so the client never advances past revision 1 and ackDocuments stays
            // {index.html} — the acknowledged delta will never mention B again.
            const withAB = new Map(base);
            withAB.set('html/a.html', A);
            withAB.set('html/b.html', B);
            const originalFetch = backend.fetchFn;
            provider._fetchFn = async (url, opts) => {
                if (String(url).includes('/revisions')) {
                    await originalFetch(url, opts); // server applies it (revision → 2)
                    throw new TypeError('network lost');
                }
                return originalFetch(url, opts);
            };
            await expect(provider.update({ ...input, documents: withAB })).rejects.toThrow('network lost');
            expect(backend.state.revision).toBe(2);
            expect(backend.state.documents.has('html/b.html')).toBe(true);

            // User deletes page B locally. The next sync sends baseRevision 1 →
            // 409 (server at 2); recovery must delete B even though the
            // acknowledged snapshot never held it — only the cumulative
            // attempted-or-acknowledged set knows B was ever published.
            provider._fetchFn = originalFetch;
            const withoutB = new Map(withAB);
            withoutB.delete('html/b.html');
            await provider.update({ ...input, documents: withoutB });

            expect(backend.state.revision).toBe(3);
            expect(backend.state.documents.has('html/b.html')).toBe(false);
            expect(backend.state.documents.has('html/a.html')).toBe(true);
            expect(backend.state.documents.has('index.html')).toBe(true);
            // The recovery revision explicitly carried b.html in deletes.
            const recovery = revisionCalls(backend).at(-1);
            expect(recovery.revision.baseRevision).toBe(2);
            expect(recovery.revision.deletes).toContain('html/b.html');
        });

        it('gives up after one conflict retry', async () => {
            const input = layeredInput();
            await provider.prepare(input);
            // Every subsequent POST conflicts (the fake keeps drifting).
            const originalFetch = backend.fetchFn;
            provider._fetchFn = async (url, opts) => {
                if (String(url).includes('/revisions')) {
                    backend.state.revision += 5;
                }
                return originalFetch(url, opts);
            };
            await expect(provider.update(input)).rejects.toBeInstanceOf(PreviewProviderError);
        });

        it('re-uploads assets the server lost (422 missing-assets) and retries once', async () => {
            const getAssetBytes = vi.fn(async () => new Uint8Array([5]));
            const input = layeredInput({
                assetRefs: new Map([['content/resources/photo.png', assetRef()]]),
                getAssetBytes,
            });
            await provider.prepare(input);

            // Simulate server-side asset loss.
            backend.state.assets.clear();
            backend.calls.length = 0;

            const documents = new Map(input.documents);
            documents.set('index.html', '<html><body>edit</body></html>');
            await provider.update({ ...input, documents });

            expect(assetCalls(backend)).toHaveLength(1);
            expect(assetCalls(backend)[0].assetKeys).toEqual([ASSET_KEY]);
            expect(revisionCalls(backend)).toHaveLength(2);
            expect(backend.state.revision).toBe(2);
        });

        it('demotes unknown fixed resources to document writes and retries once', async () => {
            const resolveFixedResource = vi.fn(async () => new Uint8Array([0xca, 0xfe]));
            const input = layeredInput({
                fixedRefs: new Map([
                    ['libs/jquery/jquery.min.js', 'libs/jquery/jquery.min.js'],
                    ['theme/content.css', 'theme:missing-from-manifest/content.css'],
                ]),
                resolveFixedResource,
            });
            await provider.prepare(input);

            expect(resolveFixedResource).toHaveBeenCalledWith('theme:missing-from-manifest/content.css');
            const posts = revisionCalls(backend);
            expect(posts).toHaveLength(2);
            // Retry ships the demoted path as a write and drops its fixed ref.
            expect(posts[1].revision.writes).toContain('theme/content.css');
            expect(posts[1].revision.fixedRefs['theme/content.css']).toBeUndefined();
            expect(posts[1].revision.fixedRefs['libs/jquery/jquery.min.js']).toBe('libs/jquery/jquery.min.js');
            expect(backend.state.revision).toBe(1);
        });

        it('keeps demoting a known-unknown fixed id on later syncs without a second 422 round-trip', async () => {
            const resolveFixedResource = vi.fn(async () => new Uint8Array([0xca, 0xfe]));
            const input = layeredInput({
                fixedRefs: new Map([['theme/content.css', 'theme:missing-from-manifest/content.css']]),
                resolveFixedResource,
            });
            await provider.prepare(input);
            backend.calls.length = 0;

            await provider.update(input);

            const posts = revisionCalls(backend);
            expect(posts).toHaveLength(1); // no 422 → no retry needed
            expect(posts[0].revision.fixedRefs['theme/content.css']).toBeUndefined();
        });

        it('surfaces a clear error when an unknown fixed resource cannot be regenerated', async () => {
            const input = layeredInput({
                fixedRefs: new Map([['theme/content.css', 'theme:missing-from-manifest/content.css']]),
                resolveFixedResource: async () => null,
            });
            await expect(provider.prepare(input)).rejects.toBeInstanceOf(PreviewProviderError);
        });

        it('throws PreviewSessionExpiredError and clears state when the session vanished', async () => {
            const getAssetBytes = vi.fn(async () => new Uint8Array([5]));
            const input = layeredInput({
                assetRefs: new Map([['content/resources/photo.png', assetRef()]]),
                getAssetBytes,
            });
            await provider.prepare(input);

            // Session swept server-side: the revision endpoint 404s.
            const originalFetch = backend.fetchFn;
            provider._fetchFn = async (url, opts) => {
                if (String(url).includes('/revisions')) return new Response('gone', { status: 404 });
                return originalFetch(url, opts);
            };
            await expect(provider.update(input)).rejects.toBeInstanceOf(PreviewSessionExpiredError);
            expect(provider.session).toBeNull();

            // Recreate: assets re-upload (uploadedAssetKeys cleared) and a full
            // snapshot publishes (ack cache cleared).
            provider._fetchFn = backend.fetchFn;
            backend.state.revision = 0;
            backend.state.assets.clear();
            backend.calls.length = 0;
            await provider.prepare(input);
            expect(assetCalls(backend)).toHaveLength(1);
            const [revCall] = revisionCalls(backend);
            expect(revCall.revision.writes.sort()).toEqual(['index.html', 'libs/common_i18n.js']);
        });

        it('throws PreviewProviderError on other server failures', async () => {
            backend.state.revisionStatus = 500;
            await expect(provider.prepare(layeredInput())).rejects.toBeInstanceOf(PreviewProviderError);
        });
    });

    describe('additional recovery and edge branches', () => {
        it('update() without a session delegates to prepare()', async () => {
            await provider.update(layeredInput());
            expect(provider.session?.id).toBe(PREVIEW_ID);
            expect(revisionCalls(backend)).toHaveLength(1);
        });

        it('normalizes ArrayBuffer document values and diffs them byte-exactly', async () => {
            const bytes = new Uint8Array([1, 2, 3]);
            const input = layeredInput({
                documents: new Map([
                    ['index.html', '<html><body>x</body></html>'],
                    ['content/data.bin', bytes.buffer.slice(0)],
                ]),
            });
            await provider.prepare(input);
            backend.calls.length = 0;

            const documents = new Map(input.documents);
            documents.set('content/data.bin', bytes.buffer.slice(0)); // fresh ArrayBuffer, same bytes
            await provider.update({ ...input, documents });
            expect(revisionCalls(backend)[0].revision.writes).toEqual([]);
        });

        it('evicts decoration cache entries for vanished paths', async () => {
            const input = layeredInput();
            await provider.prepare(input);
            expect(provider._decorationCache.has('index.html')).toBe(true);

            const documents = new Map([['html/other.html', '<html><body>y</body></html>']]);
            await provider.update({ ...input, documents });
            expect(provider._decorationCache.has('index.html')).toBe(false);
        });

        it('requires getAssetBytes when assets must upload', async () => {
            const input = layeredInput({
                assetRefs: new Map([['content/resources/photo.png', assetRef()]]),
            });
            input.getAssetBytes = undefined;
            await expect(provider.prepare(input)).rejects.toBeInstanceOf(PreviewProviderError);
        });

        it('throws PreviewProviderError when the asset upload endpoint fails', async () => {
            backend.state.assetsStatus = 500;
            const input = layeredInput({
                assetRefs: new Map([['content/resources/photo.png', assetRef()]]),
            });
            await expect(provider.prepare(input)).rejects.toBeInstanceOf(PreviewProviderError);
        });

        it('tolerates a getAssetBytes rejection (asset skipped, retried next refresh)', async () => {
            const getAssetBytes = vi.fn(async () => {
                throw new Error('cache gone');
            });
            const input = layeredInput({
                assetRefs: new Map([['content/resources/photo.png', assetRef()]]),
                getAssetBytes,
            });
            await provider.prepare(input);
            expect(revisionCalls(backend)[0].revision.assetRefs).toEqual({});
        });

        it('drops the ref and retries once when a lost asset is rejected on re-upload', async () => {
            const getAssetBytes = vi.fn(async () => new Uint8Array([5]));
            const input = layeredInput({
                assetRefs: new Map([['content/resources/photo.png', assetRef()]]),
                getAssetBytes,
            });
            await provider.prepare(input);

            // Server loses the asset AND refuses the re-upload.
            backend.state.assets.clear();
            backend.state.rejectKeys.add(ASSET_KEY);
            backend.calls.length = 0;

            await provider.update(input);

            const posts = revisionCalls(backend);
            expect(posts).toHaveLength(2);
            expect(posts[1].revision.assetRefs).toEqual({});
            expect(backend.state.revision).toBe(2);
        });

        it('demotes PDF.js fixed ids with bytes fetched from the app origin', async () => {
            backend.state.fixedIds.delete('libs/pdfjs/pdf.min.mjs');
            backend.state.fixedIds.delete('libs/pdfjs/pdf.worker.min.mjs');
            const input = layeredInput({
                documents: new Map([
                    ['index.html', '<html><body>x</body></html>'],
                    ['content/resources/doc.pdf', new Uint8Array([0x25])],
                ]),
                fixedRefs: new Map(),
            });
            await provider.prepare(input);

            const posts = revisionCalls(backend);
            expect(posts).toHaveLength(2);
            expect(posts[1].revision.writes).toContain('libs/pdfjs/pdf.min.mjs');
            expect(posts[1].revision.fixedRefs['libs/pdfjs/pdf.min.mjs']).toBeUndefined();
            const appOriginGet = backend.calls.find(
                (c) => c.method === 'GET' && c.url === '/exe/libs/pdfjs/pdf.min.mjs',
            );
            expect(appOriginGet).toBeDefined();
        });

        it('decorates demoted fixed HTML like any served page', async () => {
            const html = '<html><body>fixed page</body></html>';
            const input = layeredInput({
                fixedRefs: new Map([['theme/help.html', 'theme:missing-from-manifest/help.html']]),
                resolveFixedResource: async () => new TextEncoder().encode(html),
            });
            await provider.prepare(input);

            const posts = revisionCalls(backend);
            const retry = posts[1];
            const index = retry.revision.writes.indexOf('theme/help.html');
            const uploaded = await retry.files[index].text();
            expect(uploaded).toContain(INJECTED_MARKER);
        });

        it('treats a throwing resolveFixedResource as unresolvable (clear error)', async () => {
            const input = layeredInput({
                fixedRefs: new Map([['theme/content.css', 'theme:missing-from-manifest/content.css']]),
                resolveFixedResource: async () => {
                    throw new Error('nope');
                },
            });
            await expect(provider.prepare(input)).rejects.toBeInstanceOf(PreviewProviderError);
        });

        it('dispose() swallows DELETE failures (TTL owns cleanup)', async () => {
            await provider.prepare(layeredInput());
            provider._fetchFn = async () => {
                throw new Error('network gone');
            };
            await expect(provider.dispose()).resolves.toBeUndefined();
            expect(provider.session).toBeNull();
        });
    });

    describe('page resolution and files', () => {
        it('builds page URLs under the session prefix with teacher mode preserved', async () => {
            await provider.prepare(layeredInput());
            const target = provider.resolvePage('html/página 2.html');
            expect(target.kind).toBe('url');
            expect(target.url).toContain(`/exe/preview/${PREVIEW_ID}/html/p%C3%A1gina%202.html`);
            expect(target.url).toContain('exe-teacher=1');
        });

        it('fetches session files for the parent-side document opener', async () => {
            await provider.prepare(layeredInput());
            const bytes = await provider.getFile('content/css/base.css');
            // The fake backend 404s unknown GETs, so this exercises the URL + null contract.
            expect(bytes).toBeNull();
            const getCall = backend.calls.find(
                (c) => c.method === 'GET' && c.url.includes(`/preview/${PREVIEW_ID}/content/css/base.css`),
            );
            expect(getCall).toBeDefined();
        });

        it('disposes the session with a keepalive DELETE and clears state', async () => {
            await provider.prepare(layeredInput());
            await provider.dispose({ keepalive: true });

            const deleteCall = backend.calls.find((c) => c.method === 'DELETE');
            expect(deleteCall.url).toBe(`/exe/api/preview-session/${PREVIEW_ID}`);
            expect(deleteCall.opts.keepalive).toBe(true);
            expect(provider.session).toBeNull();
            expect(provider._uploadedAssetKeys.size).toBe(0);
            expect(provider._ackDocuments.size).toBe(0);
        });
    });

    describe('normalized previewHttp endpoint configuration', () => {
        const PREVIEW_HTTP = {
            protocolVersion: 2,
            managementBaseUrl: 'https://host.example/mod/exelearning/preview_session.php',
            servingBaseUrl: 'https://cdn.example/serve',
            managementHeaders: { 'X-WP-Nonce': 'nonce-123' },
            managementQuery: { cmid: '5', sesskey: 'abc def' },
        };

        it('routes management to managementBaseUrl with headers + query on every call and serves from servingBaseUrl', async () => {
            const httpProvider = new HttpPreviewProvider({
                basePath: '/exe',
                fetchFn: backend.fetchFn,
                previewHttp: PREVIEW_HTTP,
            });
            const input = layeredInput({
                assetRefs: new Map([['content/resources/photo.png', assetRef()]]),
            });
            const session = await httpProvider.prepare(input);

            // Serving URLs are built from servingBaseUrl/{id}/…, never basePath/preview.
            expect(session.entryUrl).toBe(`https://cdn.example/serve/${PREVIEW_ID}/index.html?exe-teacher=1`);
            expect(httpProvider.resolvePage('html/p2.html').url).toContain(
                `https://cdn.example/serve/${PREVIEW_ID}/html/p2.html`,
            );

            // Management create/assets/revisions all hit managementBaseUrl with
            // the CSRF header and the query string appended (values encoded).
            const management = backend.calls.filter((c) => c.method === 'POST' || c.method === 'DELETE');
            const create = backend.calls.find(
                (c) => c.method === 'POST' && !c.url.includes('/assets') && !c.url.includes('/revisions'),
            );
            expect(create.url).toBe(`${PREVIEW_HTTP.managementBaseUrl}?cmid=5&sesskey=abc%20def`);
            for (const call of management) {
                expect(call.url.startsWith(PREVIEW_HTTP.managementBaseUrl)).toBe(true);
                expect(call.url).toContain('cmid=5');
                expect(call.url).toContain('sesskey=abc%20def');
                expect(call.opts.headers['X-WP-Nonce']).toBe('nonce-123');
                expect(call.opts.credentials).toBe('same-origin');
            }
            const assetsCall = backend.calls.find((c) => c.method === 'POST' && c.url.includes('/assets'));
            expect(assetsCall.url).toBe(
                `${PREVIEW_HTTP.managementBaseUrl}/${PREVIEW_ID}/assets?cmid=5&sesskey=abc%20def`,
            );
            const revCall = backend.calls.find((c) => c.method === 'POST' && c.url.includes('/revisions'));
            expect(revCall.url).toBe(
                `${PREVIEW_HTTP.managementBaseUrl}/${PREVIEW_ID}/revisions?cmid=5&sesskey=abc%20def`,
            );
        });

        it('fetches serving files without credentials (authless capability URL)', async () => {
            const httpProvider = new HttpPreviewProvider({
                basePath: '/exe',
                fetchFn: backend.fetchFn,
                previewHttp: PREVIEW_HTTP,
            });
            await httpProvider.prepare(layeredInput());
            backend.calls.length = 0;
            await httpProvider.getFile('content/css/base.css');

            const getCall = backend.calls.find((c) => c.method === 'GET' && c.url.includes('/serve/'));
            expect(getCall.url).toBe(`https://cdn.example/serve/${PREVIEW_ID}/content/css/base.css`);
            expect(getCall.opts.credentials).toBe('omit');
        });

        it('DELETE on dispose targets managementBaseUrl/{id} with headers + query', async () => {
            const httpProvider = new HttpPreviewProvider({
                basePath: '/exe',
                fetchFn: backend.fetchFn,
                previewHttp: PREVIEW_HTTP,
            });
            await httpProvider.prepare(layeredInput());
            await httpProvider.dispose({ keepalive: true });

            const deleteCall = backend.calls.find((c) => c.method === 'DELETE');
            expect(deleteCall.url).toBe(
                `${PREVIEW_HTTP.managementBaseUrl}/${PREVIEW_ID}?cmid=5&sesskey=abc%20def`,
            );
            expect(deleteCall.opts.headers['X-WP-Nonce']).toBe('nonce-123');
            expect(deleteCall.opts.keepalive).toBe(true);
        });
    });
});
