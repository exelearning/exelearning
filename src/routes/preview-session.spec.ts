import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { SignJWT } from 'jose';
import {
    DEFAULT_PREVIEW_SESSION_LIMITS,
    configure,
    createSession,
    resetDependencies,
} from '../services/preview-session-manager';
import { previewServeRoutes, previewSessionApiRoutes, RECOMMENDED_BATCH_BYTES } from './preview-session';

// Must match the fallback in getJwtSecret() (API_JWT_SECRET || JWT_SECRET ||
// 'dev_secret_change_me') so signed tokens verify inside withJwtAuth().
const TEST_JWT_SECRET = 'dev_secret_change_me';
const OWNER_ID = 7;
const OTHER_ID = 8;
const BASE = 'http://localhost';

async function signTestToken(sub: number): Promise<string> {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    return new SignJWT({ sub, email: `u${sub}@test.local`, roles: ['ROLE_USER'] })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

function sha256Hex(bytes: Uint8Array): string {
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(bytes);
    return hasher.digest('hex');
}

function bytesOf(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

describe('preview-session routes', () => {
    let ownerToken: string;
    let otherToken: string;

    beforeEach(async () => {
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        resetDependencies();
        ownerToken = await signTestToken(OWNER_ID);
        otherToken = await signTestToken(OTHER_ID);
    });

    afterEach(() => {
        resetDependencies();
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

    async function syncViaApi(previewId: string, files: Record<string, string>, token = ownerToken): Promise<void> {
        const manifest: Record<string, { sha256: string; size: number }> = {};
        for (const [path, text] of Object.entries(files)) {
            const bytes = bytesOf(text);
            manifest[path] = { sha256: sha256Hex(bytes), size: bytes.length };
        }
        const manifestRes = await previewSessionApiRoutes.handle(
            apiRequest(`/api/preview-session/${previewId}/manifest`, {
                method: 'POST',
                token,
                json: { files: manifest },
            }),
        );
        expect(manifestRes.status).toBe(200);
        const staged = (await manifestRes.json()) as { manifestId: string; missing: string[]; active: boolean };
        if (staged.active) return;

        const form = new FormData();
        form.append('manifestId', staged.manifestId);
        const hashes: string[] = [];
        for (const text of Object.values(files)) {
            const bytes = bytesOf(text);
            if (staged.missing.includes(sha256Hex(bytes))) {
                hashes.push(sha256Hex(bytes));
                form.append('files', new Blob([bytes]));
            }
        }
        form.append('hashes', JSON.stringify(hashes));
        const blobsRes = await previewSessionApiRoutes.handle(
            apiRequest(`/api/preview-session/${previewId}/blobs`, { method: 'POST', token, form }),
        );
        expect(blobsRes.status).toBe(200);
        const stored = (await blobsRes.json()) as { active: boolean };
        expect(stored.active).toBe(true);
    }

    describe('POST /api/preview-session', () => {
        it('requires authentication', async () => {
            const res = await previewSessionApiRoutes.handle(apiRequest('/api/preview-session', { method: 'POST' }));
            expect(res.status).toBe(401);
        });

        it('creates a session and advertises the upload limits', async () => {
            const res = await previewSessionApiRoutes.handle(
                apiRequest('/api/preview-session', { method: 'POST', token: ownerToken }),
            );
            expect(res.status).toBe(201);
            const json = (await res.json()) as {
                previewId: string;
                limits: { maxFilesPerSession: number; maxBytesPerSession: number; recommendedBatchBytes: number };
            };
            expect(json.previewId).toMatch(/^[0-9a-f-]{36}$/);
            expect(json.limits.maxFilesPerSession).toBeGreaterThan(0);
            expect(json.limits.maxBytesPerSession).toBeGreaterThan(0);
            expect(json.limits.recommendedBatchBytes).toBe(RECOMMENDED_BATCH_BYTES);
        });
    });

    describe('POST /api/preview-session/:previewId/manifest', () => {
        it('enforces auth, ownership and existence', async () => {
            const previewId = await createViaApi();
            const body = { files: { 'index.html': { sha256: sha256Hex(bytesOf('x')), size: 1 } } };
            const unauth = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/manifest`, { method: 'POST', json: body }),
            );
            expect(unauth.status).toBe(401);
            const forbidden = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/manifest`, {
                    method: 'POST',
                    token: otherToken,
                    json: body,
                }),
            );
            expect(forbidden.status).toBe(403);
            const missing = await previewSessionApiRoutes.handle(
                apiRequest('/api/preview-session/11111111-2222-4333-8444-555555555555/manifest', {
                    method: 'POST',
                    token: ownerToken,
                    json: body,
                }),
            );
            expect(missing.status).toBe(404);
        });

        it('rejects malformed bodies and unsafe paths with 400', async () => {
            const previewId = await createViaApi();
            const malformed = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/manifest`, {
                    method: 'POST',
                    token: ownerToken,
                    json: { nope: true },
                }),
            );
            expect(malformed.status).toBe(400);
            const unsafe = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/manifest`, {
                    method: 'POST',
                    token: ownerToken,
                    json: { files: { '../escape': { sha256: sha256Hex(bytesOf('x')), size: 1 } } },
                }),
            );
            expect(unsafe.status).toBe(400);
        });

        it('returns the missing hashes for a fresh manifest', async () => {
            const previewId = await createViaApi();
            const bytes = bytesOf('<html></html>');
            const res = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/manifest`, {
                    method: 'POST',
                    token: ownerToken,
                    json: { files: { 'index.html': { sha256: sha256Hex(bytes), size: bytes.length } } },
                }),
            );
            expect(res.status).toBe(200);
            const json = (await res.json()) as { manifestId: string; missing: string[]; active: boolean };
            expect(json.active).toBe(false);
            expect(json.missing).toEqual([sha256Hex(bytes)]);
        });
    });

    describe('POST /api/preview-session/:previewId/blobs', () => {
        it('enforces auth and ownership', async () => {
            const previewId = await createViaApi();
            const form = new FormData();
            form.append('manifestId', 'any');
            form.append('hashes', '[]');
            const unauth = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/blobs`, { method: 'POST', form }),
            );
            expect(unauth.status).toBe(401);
            const form2 = new FormData();
            form2.append('manifestId', 'any');
            form2.append('hashes', '[]');
            const forbidden = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/blobs`, {
                    method: 'POST',
                    token: otherToken,
                    form: form2,
                }),
            );
            expect(forbidden.status).toBe(403);
        });

        it('rejects stale manifest ids with 409 and bad hashes JSON with 400', async () => {
            const previewId = await createViaApi();
            const form = new FormData();
            form.append('manifestId', '11111111-2222-4333-8444-555555555555');
            form.append('hashes', '[]');
            const stale = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/blobs`, { method: 'POST', token: ownerToken, form }),
            );
            expect(stale.status).toBe(409);

            const badForm = new FormData();
            badForm.append('manifestId', 'x');
            badForm.append('hashes', 'not json');
            const bad = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/blobs`, {
                    method: 'POST',
                    token: ownerToken,
                    form: badForm,
                }),
            );
            expect(bad.status).toBe(400);
        });

        it('stores missing blobs, reports mismatches, and activates when complete', async () => {
            const previewId = await createViaApi();
            const good = bytesOf('good body');
            const goodHash = sha256Hex(good);
            const forgedHash = sha256Hex(bytesOf('claimed'));
            const manifestRes = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/manifest`, {
                    method: 'POST',
                    token: ownerToken,
                    json: {
                        files: {
                            'good.html': { sha256: goodHash, size: good.length },
                            'forged.html': { sha256: forgedHash, size: 7 },
                        },
                    },
                }),
            );
            const staged = (await manifestRes.json()) as { manifestId: string };

            const form = new FormData();
            form.append('manifestId', staged.manifestId);
            form.append('hashes', JSON.stringify([goodHash, forgedHash]));
            form.append('files', new Blob([good]));
            form.append('files', new Blob([bytesOf('not the claimed bytes')]));
            const res = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/blobs`, { method: 'POST', token: ownerToken, form }),
            );
            expect(res.status).toBe(200);
            const json = (await res.json()) as { stored: string[]; mismatched: string[]; active: boolean };
            expect(json.stored).toEqual([goodHash]);
            expect(json.mismatched).toEqual([forgedHash]);
            expect(json.active).toBe(false);
        });

        it('rejects mismatched hashes/files counts with 400', async () => {
            const previewId = await createViaApi();
            const form = new FormData();
            form.append('manifestId', 'x');
            form.append('hashes', JSON.stringify(['a'.repeat(64)]));
            const res = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/blobs`, { method: 'POST', token: ownerToken, form }),
            );
            expect(res.status).toBe(400);
        });

        it('rejects batches whose declared size exceeds the session byte budget with 413', async () => {
            // A tiny configured budget stands in for a huge upload: the route
            // must reject on declared Blob sizes, before buffering the parts.
            configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, maxBytesPerSession: 8 } });
            const previewId = await createViaApi();
            const bytes = bytesOf('123456789');
            const manifestRes = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/manifest`, {
                    method: 'POST',
                    token: ownerToken,
                    json: { files: { 'a.bin': { sha256: sha256Hex(bytes), size: 4 } } },
                }),
            );
            const staged = (await manifestRes.json()) as { manifestId: string };
            const form = new FormData();
            form.append('manifestId', staged.manifestId);
            form.append('hashes', JSON.stringify([sha256Hex(bytes)]));
            form.append('files', new Blob([bytes]));
            const res = await previewSessionApiRoutes.handle(
                apiRequest(`/api/preview-session/${previewId}/blobs`, { method: 'POST', token: ownerToken, form }),
            );
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
        async function servedSession(files: Record<string, string>): Promise<string> {
            const previewId = await createViaApi();
            await syncViaApi(previewId, files);
            return previewId;
        }

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
                expect(res.headers.get('cache-control')).toBe('no-store');
                expect(res.headers.get('permissions-policy')).toContain('camera=()');
                expect(res.headers.get('access-control-allow-origin')).toBe('*');
            }
        });

        it('adds the sandbox CSP to HTML responses only', async () => {
            const previewId = await servedSession({
                'index.html': '<html></html>',
                'html/page2.html': '<html>2</html>',
                'theme/style.css': 'body{}',
            });
            for (const htmlPath of ['index.html', 'html/page2.html']) {
                const res = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/${htmlPath}`));
                const csp = res.headers.get('content-security-policy') ?? '';
                expect(csp.startsWith('sandbox allow-scripts allow-popups allow-forms')).toBe(true);
                expect(csp).not.toContain('allow-same-origin');
            }
            const css = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/theme/style.css`));
            expect(css.headers.get('content-security-policy')).toBeNull();
        });

        it('serves index.html for the bare session URL without redirecting', async () => {
            const previewId = await servedSession({ 'index.html': '<html>root</html>' });
            for (const suffix of ['', '/']) {
                const res = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}${suffix}`));
                expect(res.status).toBe(200);
                expect([301, 302, 303, 307, 308]).not.toContain(res.status);
                expect(res.headers.get('location')).toBeNull();
                expect(await res.text()).toBe('<html>root</html>');
            }
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

        it('returns 404 for malformed preview ids and expired sessions', async () => {
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

        it('serves updated bytes after a manifest-diff refresh and keeps unchanged paths', async () => {
            const previewId = await servedSession({
                'index.html': 'version one',
                'theme/style.css': 'unchanged css',
            });
            await syncViaApi(previewId, {
                'index.html': 'version two!',
                'theme/style.css': 'unchanged css',
            });
            const index = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/index.html`));
            expect(await index.text()).toBe('version two!');
            const css = await previewServeRoutes.handle(new Request(`${BASE}/preview/${previewId}/theme/style.css`));
            expect(await css.text()).toBe('unchanged css');
        });
    });
});
