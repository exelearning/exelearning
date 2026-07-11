import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { SignJWT } from 'jose';
import {
    configure as configureFixedResources,
    resetDependencies as resetFixedResources,
} from '../services/preview-fixed-resources';
import {
    DEFAULT_PREVIEW_SESSION_LIMITS,
    configure,
    createSession,
    resetDependencies,
} from '../services/preview-session-manager';
import {
    previewServeRoutes,
    previewSessionApiRoutes,
    PROTOCOL_VERSION,
    RECOMMENDED_BATCH_BYTES,
} from './preview-session';

// Must match the fallback in getJwtSecret() (API_JWT_SECRET || JWT_SECRET ||
// 'dev_secret_change_me') so signed tokens verify inside withJwtAuth().
const TEST_JWT_SECRET = 'dev_secret_change_me';
const OWNER_ID = 7;
const OTHER_ID = 8;
const BASE = 'http://localhost';

const ASSET_KEY_A = '11111111-2222-4333-8444-555555555555@aabbccdd';
const ASSET_KEY_B = '99999999-8888-4777-8666-555555555555@00112233';

async function signTestToken(sub: number): Promise<string> {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    return new SignJWT({ sub, email: `u${sub}@test.local`, roles: ['ROLE_USER'] })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

function bytesOf(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

/** Materialize a throwaway fixed-resource root and point the resolver DI at it. */
function useFixedRoot(files: Record<string, { id: string; content: string }>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-route-fixed-'));
    const resources: Record<string, { path: string; size: number }> = {};
    for (const [rel, { id, content }] of Object.entries(files)) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
        resources[id] = { path: rel, size: Buffer.byteLength(content) };
    }
    const manifestPath = path.join(root, 'bundles', 'preview-fixed-resources.json');
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, buildVersion: 'v-test', resources }));
    configureFixedResources({ publicRoot: root, manifestPath });
    return root;
}

describe('preview-session routes', () => {
    let ownerToken: string;
    let otherToken: string;
    const tempRoots: string[] = [];

    beforeEach(async () => {
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        resetDependencies();
        resetFixedResources();
        ownerToken = await signTestToken(OWNER_ID);
        otherToken = await signTestToken(OTHER_ID);
    });

    afterEach(() => {
        resetDependencies();
        resetFixedResources();
        for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
    });

    function apiRequest(
        path: string,
        options: { method?: string; token?: string; json?: unknown; form?: FormData } = {},
    ): Request {
        const headers: Record<string, string> = {};
        if (options.token) headers.Cookie = `auth=${options.token}`;
        let body: BodyInit | undefined;
        if (options.json !== undefined) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(options.json);
        } else if (options.form) {
            body = options.form;
        }
        return new Request(`${BASE}${path}`, { method: options.method ?? 'GET', headers, body });
    }

    async function createViaApi(token: string = ownerToken): Promise<string> {
        const res = await previewSessionApiRoutes.handle(apiRequest('/api/preview-session', { method: 'POST', token }));
        expect(res.status).toBe(201);
        const json = (await res.json()) as { previewId: string };
        return json.previewId;
    }

    function assetsForm(entries: Array<{ key: string; size: number; bytes: Uint8Array }>): FormData {
        const form = new FormData();
        form.append('assets', JSON.stringify(entries.map(({ key, size }) => ({ key, size }))));
        for (const { bytes } of entries) form.append('files', new Blob([bytes]));
        return form;
    }

    function revisionForm(meta: {
        baseRevision: number;
        nextRevision: number;
        writes?: Record<string, string>;
        deletes?: string[];
        assetRefs?: Record<string, string>;
        fixedRefs?: Record<string, string>;
    }): FormData {
        const writes = meta.writes ?? {};
        const form = new FormData();
        form.append(
            'revision',
            JSON.stringify({
                baseRevision: meta.baseRevision,
                nextRevision: meta.nextRevision,
                writes: Object.keys(writes),
                deletes: meta.deletes ?? [],
                assetRefs: meta.assetRefs ?? {},
                fixedRefs: meta.fixedRefs ?? {},
            }),
        );
        for (const text of Object.values(writes)) form.append('files', new Blob([bytesOf(text)]));
        return form;
    }

    async function publishViaApi(
        previewId: string,
        meta: Parameters<typeof revisionForm>[0],
        token = ownerToken,
    ): Promise<Response> {
        return previewSessionApiRoutes.handle(
            apiRequest(`/api/preview-session/${previewId}/revisions`, {
                method: 'POST',
                token,
                form: revisionForm(meta),
            }),
        );
    }

    async function servedSession(files: Record<string, string>): Promise<string> {
        const previewId = await createViaApi();
        const res = await publishViaApi(previewId, { baseRevision: 0, nextRevision: 1, writes: files });
        expect(res.status).toBe(200);
        return previewId;
    }

    describe('POST /api/preview-session', () => {
        it('requires authentication', async () => {
            const res = await previewSessionApiRoutes.handle(apiRequest('/api/preview-session', { method: 'POST' }));
            expect(res.status).toBe(401);
        });

        it('creates a protocol-v2 session at revision 0 and advertises the limits', async () => {
            const res = await previewSessionApiRoutes.handle(
                apiRequest('/api/preview-session', { method: 'POST', token: ownerToken }),
            );
            expect(res.status).toBe(201);
            const json = (await res.json()) as {
                previewId: string;
                protocolVersion: number;
                revision: number;
                limits: {
                    maxFilesPerSession: number;
                    maxBytesPerSession: number;
                    maxAssetBytes: number;
                    recommendedBatchBytes: number;
                };
            };
            expect(json.previewId).toMatch(/^[0-9a-f-]{36}$/);
            expect(json.protocolVersion).toBe(PROTOCOL_VERSION);
            expect(json.revision).toBe(0);
            expect(json.limits.maxFilesPerSession).toBeGreaterThan(0);
            expect(json.limits.maxBytesPerSession).toBeGreaterThan(0);
            expect(json.limits.maxAssetBytes).toBeGreaterThan(0);
            expect(json.limits.recommendedBatchBytes).toBe(RECOMMENDED_BATCH_BYTES);
        });
    });

    describe('POST /api/preview-session/:previewId/assets', () => {
        it('enforces auth, ownership and existence', async () => {
            const previewId = await createViaApi();
            const makeForm = () => assetsForm([{ key: ASSET_KEY_A, size: 1, bytes: bytesOf('x') }]);
            const unauth = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/assets`, { method: 'POST', form: makeForm() }),
            );
            expect(unauth.status).toBe(401);
            const forbidden = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/assets`, {
                    method: 'POST',
                    token: otherToken,
                    form: makeForm(),
                }),
            );
            expect(forbidden.status).toBe(403);
            const missing = await previewSessionApiRoutes.handle(
                apiRequest('/api/preview-session/11111111-2222-4333-8444-555555555555/assets', {
                    method: 'POST',
                    token: ownerToken,
                    form: makeForm(),
                }),
            );
            expect(missing.status).toBe(404);
        });

        it('rejects malformed assets JSON and misaligned files with 400', async () => {
            const previewId = await createViaApi();
            const badJson = new FormData();
            badJson.append('assets', 'not json');
            const bad = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/assets`, {
                    method: 'POST',
                    token: ownerToken,
                    form: badJson,
                }),
            );
            expect(bad.status).toBe(400);

            const misaligned = new FormData();
            misaligned.append('assets', JSON.stringify([{ key: ASSET_KEY_A, size: 1 }]));
            const res = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/assets`, {
                    method: 'POST',
                    token: ownerToken,
                    form: misaligned,
                }),
            );
            expect(res.status).toBe(400);
        });

        it('stores assets, reporting alreadyStored on immutability re-uploads and rejected entries', async () => {
            const previewId = await createViaApi();
            const first = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/assets`, {
                    method: 'POST',
                    token: ownerToken,
                    form: assetsForm([
                        { key: ASSET_KEY_A, size: 5, bytes: bytesOf('image') },
                        { key: 'garbage-key', size: 1, bytes: bytesOf('x') },
                    ]),
                }),
            );
            expect(first.status).toBe(200);
            const firstJson = (await first.json()) as {
                stored: string[];
                alreadyStored: string[];
                rejected: Array<{ key: string; reason: string }>;
            };
            expect(firstJson.stored).toEqual([ASSET_KEY_A]);
            expect(firstJson.rejected).toEqual([{ key: 'garbage-key', reason: 'invalid-key' }]);

            const again = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/assets`, {
                    method: 'POST',
                    token: ownerToken,
                    form: assetsForm([{ key: ASSET_KEY_A, size: 9, bytes: bytesOf('DIFFERENT') }]),
                }),
            );
            expect(again.status).toBe(200);
            const againJson = (await again.json()) as { stored: string[]; alreadyStored: string[] };
            expect(againJson.stored).toEqual([]);
            expect(againJson.alreadyStored).toEqual([ASSET_KEY_A]);
        });

        it('rejects batches whose DECLARED sizes exceed the session byte budget with 413', async () => {
            configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, maxBytesPerSession: 8 } });
            const previewId = await createViaApi();
            // Declared size is honest (9 > 8): rejected before buffering.
            const res = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/assets`, {
                    method: 'POST',
                    token: ownerToken,
                    form: assetsForm([{ key: ASSET_KEY_A, size: 9, bytes: bytesOf('123456789') }]),
                }),
            );
            expect(res.status).toBe(413);
        });

        it('rejects batches whose ACTUAL bytes exceed the budget despite lying declared sizes', async () => {
            configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, maxBytesPerSession: 8 } });
            const previewId = await createViaApi();
            // Declared size lies low (1); the buffered actual total (9) trips
            // the second-stage check.
            const form = new FormData();
            form.append('assets', JSON.stringify([{ key: ASSET_KEY_A, size: 1 }]));
            form.append('files', new Blob([bytesOf('123456789')]));
            const res = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/assets`, { method: 'POST', token: ownerToken, form }),
            );
            expect(res.status).toBe(413);
        });
    });

    describe('POST /api/preview-session/:previewId/revisions', () => {
        it('enforces auth and ownership', async () => {
            const previewId = await createViaApi();
            const meta = { baseRevision: 0, nextRevision: 1, writes: { 'index.html': 'x' } };
            const unauth = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/revisions`, { method: 'POST', form: revisionForm(meta) }),
            );
            expect(unauth.status).toBe(401);
            const forbidden = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/revisions`, {
                    method: 'POST',
                    token: otherToken,
                    form: revisionForm(meta),
                }),
            );
            expect(forbidden.status).toBe(403);
        });

        it('rejects malformed revision JSON and misaligned writes/files with 400', async () => {
            const previewId = await createViaApi();
            const badJson = new FormData();
            badJson.append('revision', '{not json');
            const bad = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/revisions`, {
                    method: 'POST',
                    token: ownerToken,
                    form: badJson,
                }),
            );
            expect(bad.status).toBe(400);

            const misaligned = new FormData();
            misaligned.append(
                'revision',
                JSON.stringify({
                    baseRevision: 0,
                    nextRevision: 1,
                    writes: ['index.html'],
                    deletes: [],
                    assetRefs: {},
                    fixedRefs: {},
                }),
            );
            const res = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/revisions`, {
                    method: 'POST',
                    token: ownerToken,
                    form: misaligned,
                }),
            );
            expect(res.status).toBe(400);
        });

        it('rejects unsafe paths with 400', async () => {
            const previewId = await createViaApi();
            const res = await publishViaApi(previewId, {
                baseRevision: 0,
                nextRevision: 1,
                writes: { '../escape.html': 'x' },
            });
            expect(res.status).toBe(400);
        });

        it('publishes revisions and answers conflicts with 409 + currentRevision', async () => {
            const previewId = await createViaApi();
            const first = await publishViaApi(previewId, {
                baseRevision: 0,
                nextRevision: 1,
                writes: { 'index.html': 'v1' },
            });
            expect(first.status).toBe(200);
            expect(await first.json()).toEqual({ revision: 1, active: true });

            const conflict = await publishViaApi(previewId, {
                baseRevision: 0,
                nextRevision: 1,
                writes: { 'index.html': 'stale' },
            });
            expect(conflict.status).toBe(409);
            expect(await conflict.json()).toEqual({ reason: 'revision-conflict', currentRevision: 1 });
        });

        it('rejects revisions referencing assets the session does not hold with 422', async () => {
            const previewId = await createViaApi();
            const res = await publishViaApi(previewId, {
                baseRevision: 0,
                nextRevision: 1,
                writes: { 'index.html': 'x' },
                assetRefs: { 'content/resources/a.png': ASSET_KEY_B },
            });
            expect(res.status).toBe(422);
            // Exact contract shape — no extra fields on the wire.
            expect(await res.json()).toEqual({ reason: 'missing-assets', missing: [ASSET_KEY_B] });
        });

        it('rejects revisions referencing unknown fixed resources with 422', async () => {
            tempRoots.push(
                useFixedRoot({ 'libs/jquery/jquery.min.js': { id: 'libs/jquery/jquery.min.js', content: 'jq' } }),
            );
            const previewId = await createViaApi();
            const res = await publishViaApi(previewId, {
                baseRevision: 0,
                nextRevision: 1,
                writes: { 'index.html': 'x' },
                fixedRefs: { 'libs/nope.js': 'libs/nope.js' },
            });
            expect(res.status).toBe(422);
            expect(await res.json()).toEqual({ reason: 'unknown-fixed-resources', resources: ['libs/nope.js'] });
        });

        it('rejects revisions over the byte budget with 413', async () => {
            configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, maxBytesPerSession: 4 } });
            const previewId = await createViaApi();
            const res = await publishViaApi(previewId, {
                baseRevision: 0,
                nextRevision: 1,
                writes: { 'index.html': '123456789' },
            });
            expect(res.status).toBe(413);
        });
    });

    describe('DELETE /api/preview-session/:previewId', () => {
        it('enforces auth and ownership, then deletes', async () => {
            const previewId = await createViaApi();
            const unauth = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}`, { method: 'DELETE' }),
            );
            expect(unauth.status).toBe(401);
            const forbidden = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}`, { method: 'DELETE', token: otherToken }),
            );
            expect(forbidden.status).toBe(403);
            const ok = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}`, { method: 'DELETE', token: ownerToken }),
            );
            expect(ok.status).toBe(200);
            const gone = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}`, { method: 'DELETE', token: ownerToken }),
            );
            expect(gone.status).toBe(404);
        });
    });

    describe('GET /preview/:previewId/*', () => {
        it('serves files with correct MIME types', async () => {
            const previewId = await servedSession({
                'index.html': '<html><body>hi</body></html>',
                'theme/style.css': 'body { color: red; }',
                'libs/app.js': 'console.log(1);',
                'fonts/f.woff2': 'binaryfont',
                'img/i.png': 'binarypng',
                'img/v.svg': '<svg/>',
            });
            const cases: Array<[string, string]> = [
                ['index.html', 'text/html; charset=utf-8'],
                ['theme/style.css', 'text/css; charset=utf-8'],
                ['libs/app.js', 'application/javascript; charset=utf-8'],
                ['fonts/f.woff2', 'font/woff2'],
                ['img/i.png', 'image/png'],
                ['img/v.svg', 'image/svg+xml; charset=utf-8'],
            ];
            for (const [path, mime] of cases) {
                const res = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/${path}`));
                expect(res.status).toBe(200);
                expect(res.headers.get('content-type')).toBe(mime);
            }
        });

        it('sends the security headers on every response, including 404s', async () => {
            const previewId = await servedSession({ 'index.html': '<html></html>' });
            const responses = [
                await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/index.html`)),
                await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/missing.css`)),
                await previewServeRoutes.handle(
                    new Request(`${BASE}/preview/11111111-2222-4333-8444-555555555555/index.html`),
                ),
            ];
            for (const res of responses) {
                expect(res.headers.get('x-content-type-options')).toBe('nosniff');
                expect(res.headers.get('referrer-policy')).toBe('no-referrer');
                expect(res.headers.get('permissions-policy')).toContain('camera=()');
                expect(res.headers.get('access-control-allow-origin')).toBe('*');
            }
            // 404s are never cacheable.
            expect(responses[1].status).toBe(404);
            expect(responses[1].headers.get('cache-control')).toBe('no-store');
        });

        it('serves nothing before the first revision publishes (but the bare root still redirects)', async () => {
            const previewId = await createViaApi();
            const res = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/index.html`));
            expect(res.status).toBe(404);
            // The bare root is a stateless redirect to the entry document, which
            // then 404s until the first revision publishes.
            const bare = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}`));
            expect(bare.status).toBe(302);
            expect(bare.headers.get('location')).toBe(`${previewId}/index.html`);
        });

        it('applies the tiered Cache-Control per resolution layer', async () => {
            tempRoots.push(
                useFixedRoot({ 'libs/jquery/jquery.min.js': { id: 'libs/jquery/jquery.min.js', content: 'jq();' } }),
            );
            const previewId = await createViaApi();
            await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/assets`, {
                    method: 'POST',
                    token: ownerToken,
                    form: assetsForm([{ key: ASSET_KEY_A, size: 5, bytes: bytesOf('asset') }]),
                }),
            );
            const published = await publishViaApi(previewId, {
                baseRevision: 0,
                nextRevision: 1,
                writes: { 'index.html': '<html></html>' },
                assetRefs: { 'content/resources/pic.png': ASSET_KEY_A },
                fixedRefs: { 'libs/jquery/jquery.min.js': 'libs/jquery/jquery.min.js' },
            });
            expect(published.status).toBe(200);

            const document = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/index.html`));
            expect(document.status).toBe(200);
            expect(document.headers.get('cache-control')).toBe('no-store');
            expect(document.headers.get('etag')).toBeNull();

            const asset = await previewServeRoutes.handle(
                new Request(`${BASE}/preview/${previewId}/content/resources/pic.png`),
            );
            expect(asset.status).toBe(200);
            expect(asset.headers.get('cache-control')).toBe('no-cache');
            expect(asset.headers.get('etag')).toBe(`"${ASSET_KEY_A}"`);
            expect(asset.headers.get('accept-ranges')).toBe('bytes');
            expect(await asset.text()).toBe('asset');

            const fixed = await previewServeRoutes.handle(
                new Request(`${BASE}/preview/${previewId}/libs/jquery/jquery.min.js`),
            );
            expect(fixed.status).toBe(200);
            expect(fixed.headers.get('cache-control')).toBe('private, max-age=31536000');
            expect(await fixed.text()).toBe('jq();');
        });

        it('answers If-None-Match with 304 for unchanged assets', async () => {
            const previewId = await createViaApi();
            await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/assets`, {
                    method: 'POST',
                    token: ownerToken,
                    form: assetsForm([{ key: ASSET_KEY_A, size: 5, bytes: bytesOf('asset') }]),
                }),
            );
            await publishViaApi(previewId, {
                baseRevision: 0,
                nextRevision: 1,
                writes: { 'index.html': 'x' },
                assetRefs: { 'content/resources/pic.png': ASSET_KEY_A },
            });
            const res = await previewServeRoutes.handle(
                new Request(`${BASE}/preview/${previewId}/content/resources/pic.png`, {
                    headers: { 'If-None-Match': `"${ASSET_KEY_A}"` },
                }),
            );
            expect(res.status).toBe(304);
            expect(await res.text()).toBe('');
            // A non-matching validator serves the full body.
            const changed = await previewServeRoutes.handle(
                new Request(`${BASE}/preview/${previewId}/content/resources/pic.png`, {
                    headers: { 'If-None-Match': '"some-other-etag"' },
                }),
            );
            expect(changed.status).toBe(200);
        });

        it('honors single-range requests on assets with 206/416', async () => {
            const previewId = await createViaApi();
            const payload = bytesOf('0123456789');
            await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/assets`, {
                    method: 'POST',
                    token: ownerToken,
                    form: assetsForm([{ key: ASSET_KEY_A, size: payload.length, bytes: payload }]),
                }),
            );
            await publishViaApi(previewId, {
                baseRevision: 0,
                nextRevision: 1,
                writes: { 'index.html': 'x' },
                assetRefs: { 'media/clip.mp4': ASSET_KEY_A },
            });
            const url = `${BASE}/preview/${previewId}/media/clip.mp4`;

            const middle = await previewServeRoutes.handle(new Request(url, { headers: { Range: 'bytes=2-4' } }));
            expect(middle.status).toBe(206);
            expect(middle.headers.get('content-range')).toBe('bytes 2-4/10');
            expect(middle.headers.get('content-length')).toBe('3');
            expect(await middle.text()).toBe('234');

            const openEnded = await previewServeRoutes.handle(new Request(url, { headers: { Range: 'bytes=7-' } }));
            expect(openEnded.status).toBe(206);
            expect(openEnded.headers.get('content-range')).toBe('bytes 7-9/10');
            expect(await openEnded.text()).toBe('789');

            const suffix = await previewServeRoutes.handle(new Request(url, { headers: { Range: 'bytes=-3' } }));
            expect(suffix.status).toBe(206);
            expect(suffix.headers.get('content-range')).toBe('bytes 7-9/10');
            expect(await suffix.text()).toBe('789');

            // Valid-but-unsatisfiable ranges → 416 with the unsatisfied Content-Range.
            for (const unsat of ['bytes=10-', 'bytes=99-', 'bytes=-0']) {
                const res = await previewServeRoutes.handle(new Request(url, { headers: { Range: unsat } }));
                expect(res.status).toBe(416);
                expect(res.headers.get('content-range')).toBe('bytes */10');
            }
            // Syntactically invalid / unsupported specs are IGNORED → full 200 body.
            // bytes=15-2 is inverted AND out of bounds: structural check wins → 200.
            for (const ignored of ['bytes=5-2', 'bytes=15-2', 'bytes=-', 'bytes=0-1,3-4', 'items=0-1', 'bytes=a-b']) {
                const res = await previewServeRoutes.handle(new Request(url, { headers: { Range: ignored } }));
                expect(res.status).toBe(200);
                expect(res.headers.get('content-range')).toBeNull();
                expect(await res.text()).toBe('0123456789');
            }

            // Documents ignore Range entirely (full 200 body).
            const doc = await previewServeRoutes.handle(
                new Request(`${BASE}/preview/${previewId}/index.html`, { headers: { Range: 'bytes=0-0' } }),
            );
            expect(doc.status).toBe(200);
            expect(await doc.text()).toBe('x');
        });

        it('adds the sandbox CSP to every scriptable document type (HTML, SVG, XML), not just HTML', async () => {
            const previewId = await servedSession({
                'index.html': '<html></html>',
                'html/page2.html': '<html>2</html>',
                // The SVG case is the security-critical one: opened top-level it
                // would run its inline <script> same-origin without the CSP.
                'img/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>',
                'data/feed.xml': '<?xml version="1.0"?><root/>',
                'theme/style.css': 'body{}',
                'libs/app.js': 'console.log(1);',
                'img/i.png': 'binarypng',
            });
            // Scriptable documents MUST carry the sandbox-first CSP.
            for (const scriptable of ['index.html', 'html/page2.html', 'img/logo.svg', 'data/feed.xml']) {
                const res = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/${scriptable}`));
                const csp = res.headers.get('content-security-policy') ?? '';
                expect(csp.startsWith('sandbox allow-scripts allow-popups allow-forms')).toBe(true);
                expect(csp).not.toContain('allow-same-origin');
            }
            // Passive resource types get no CSP (it would be wasted).
            for (const passive of ['theme/style.css', 'libs/app.js', 'img/i.png']) {
                const res = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/${passive}`));
                expect(res.headers.get('content-security-policy')).toBeNull();
            }
        });

        it('adds the sandbox CSP to a scriptable SVG resolved from the FIXED layer', async () => {
            tempRoots.push(
                useFixedRoot({
                    'files/perm/themes/base/zen/icon.svg': {
                        id: 'theme:zen/icon.svg',
                        content: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
                    },
                }),
            );
            const previewId = await createViaApi();
            await publishViaApi(previewId, {
                baseRevision: 0,
                nextRevision: 1,
                writes: { 'index.html': 'x' },
                fixedRefs: { 'theme/icon.svg': 'theme:zen/icon.svg' },
            });
            const res = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/theme/icon.svg`));
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
            expect(res.headers.get('cache-control')).toBe('private, max-age=31536000');
            const csp = res.headers.get('content-security-policy') ?? '';
            expect(csp.startsWith('sandbox allow-scripts allow-popups allow-forms')).toBe(true);
        });

        it('redirects the bare session URL to the entry document with a relative Location', async () => {
            const previewId = await servedSession({ 'index.html': '<html>root</html>' });
            // No trailing slash: Location resolves against `/preview/{id}` →
            // `/preview/{id}/index.html`.
            const noSlash = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}`));
            expect(noSlash.status).toBe(302);
            expect(noSlash.headers.get('location')).toBe(`${previewId}/index.html`);
            expect(noSlash.headers.get('cache-control')).toBe('no-store');
            expect(noSlash.headers.get('x-content-type-options')).toBe('nosniff');
            expect(await noSlash.text()).toBe('');
            // Trailing slash: Location resolves against `/preview/{id}/` →
            // `/preview/{id}/index.html`.
            const trailingSlash = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/`));
            expect(trailingSlash.status).toBe(302);
            expect(trailingSlash.headers.get('location')).toBe('index.html');
        });

        it('rejects traversal attempts with 404', async () => {
            const previewId = await servedSession({ 'index.html': '<html></html>' });
            const paths = [
                `/preview/${previewId}/%2e%2e/secret`,
                `/preview/${previewId}/%2e%2e%2fsecret`,
                `/preview/${previewId}/a%2f..%2f..%2fsecret`,
                `/preview/${previewId}/%252e%252e%252fsecret`,
                `/preview/${previewId}/%00`,
                `/preview/${previewId}/..%2f..%2fetc%2fpasswd`,
            ];
            for (const path of paths) {
                const res = await previewServeRoutes.handle(new Request(`${BASE}${path}`));
                expect(res.status).toBe(404);
            }
        });

        it('returns 404 for malformed preview ids and deleted sessions', async () => {
            const malformed = await previewServeRoutes.handle(new Request(`${BASE}/preview/not-a-uuid/index.html`));
            expect(malformed.status).toBe(404);
            const previewId = await servedSession({ 'index.html': 'x' });
            createSession(OWNER_ID); // unrelated session stays alive
            const deleted = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}`, { method: 'DELETE', token: ownerToken }),
            );
            expect(deleted.status).toBe(200);
            const gone = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/index.html`));
            expect(gone.status).toBe(404);
        });

        it('serves updated documents after an incremental revision and keeps unchanged paths', async () => {
            const previewId = await servedSession({
                'index.html': 'version one',
                'theme/style.css': 'unchanged css',
            });
            const second = await publishViaApi(previewId, {
                baseRevision: 1,
                nextRevision: 2,
                writes: { 'index.html': 'version two!' },
            });
            expect(second.status).toBe(200);
            const index = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/index.html`));
            expect(await index.text()).toBe('version two!');
            const css = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/theme/style.css`));
            expect(await css.text()).toBe('unchanged css');
        });
    });
});
