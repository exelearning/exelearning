/**
 * Preview snapshot route conformance and security-negative tests.
 *
 * Management: auth required, cross-site rejected, create/replace/delete
 * semantics. Serving: capability-only authorization (cookies ignored, never
 * issued), hardening headers, sandbox-first CSP on scriptable types,
 * traversal and guessed-id probes all 404.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import * as fflate from 'fflate';
import { SignJWT } from 'jose';
import * as store from '../services/preview-snapshot-store';
import { PREVIEW_SNAPSHOT_SANDBOX } from '../shared/security/previewSandbox';
import { createPreviewSnapshotApiRoutes, createPreviewSnapshotServeRoutes } from './preview-snapshot';

// Must match the fallback in getJwtSecret() (API_JWT_SECRET || JWT_SECRET ||
// 'dev_secret_change_me') so signed tokens verify inside withJwtAuth().
const TEST_JWT_SECRET = 'dev_secret_change_me';
const OWNER_USER_ID = 42;
const OTHER_USER_ID = 7;

async function signTestToken(sub: number): Promise<string> {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    return new SignJWT({ sub, email: `u${sub}@test.local`, roles: ['ROLE_USER'] })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

function zipOf(entries: Record<string, string>): Uint8Array {
    return fflate.zipSync(
        Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, new TextEncoder().encode(v)])),
    );
}

const DEFAULT_ENTRIES = {
    'index.html': '<html><body><script>document.title="active"</script></body></html>',
    'theme/style.css': 'body{}',
    'img/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'content/data.xml': '<x/>',
    'content/doc.pdf': '%PDF-1.4',
    'img/photo.png': 'png-bytes',
};

function uploadRequest(
    token: string | null,
    entries = DEFAULT_ENTRIES,
    previewId?: string,
    headers: Record<string, string> = {},
) {
    const formData = new FormData();
    formData.append('snapshot', new Blob([zipOf(entries) as BlobPart], { type: 'application/zip' }), 'preview.zip');
    if (previewId) formData.append('previewId', previewId);
    const allHeaders: Record<string, string> = { ...headers };
    if (token) allHeaders.Cookie = `auth=${token}`;
    return new Request('http://localhost/api/preview-snapshot/', {
        method: 'POST',
        headers: allHeaders,
        body: formData,
    });
}

describe('preview-snapshot routes', () => {
    let app: Elysia;
    let ownerToken: string;
    let otherToken: string;
    const savedJwtSecret = process.env.JWT_SECRET;
    const savedApiJwtSecret = process.env.API_JWT_SECRET;

    beforeEach(async () => {
        delete process.env.API_JWT_SECRET;
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        ownerToken = await signTestToken(OWNER_USER_ID);
        otherToken = await signTestToken(OTHER_USER_ID);
        app = new Elysia().use(createPreviewSnapshotApiRoutes()).use(createPreviewSnapshotServeRoutes());
    });

    afterEach(() => {
        store.clearAllForTests();
        store.resetDependencies();
        if (savedJwtSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = savedJwtSecret;
        if (savedApiJwtSecret !== undefined) process.env.API_JWT_SECRET = savedApiJwtSecret;
    });

    async function createSnapshot(
        token = ownerToken,
        entries = DEFAULT_ENTRIES,
    ): Promise<{ previewId: string; previewUrl: string }> {
        const res = await app.handle(uploadRequest(token, entries));
        expect(res.status).toBe(200);
        return res.json();
    }

    describe('management: authentication and CSRF', () => {
        it('rejects an unauthenticated create with 401', async () => {
            const res = await app.handle(uploadRequest(null));
            expect(res.status).toBe(401);
        });

        it('rejects an invalid token with 401', async () => {
            const res = await app.handle(uploadRequest('not-a-jwt'));
            expect(res.status).toBe(401);
        });

        it('rejects a browser-marked cross-site request with 403 even when authenticated', async () => {
            const res = await app.handle(
                uploadRequest(ownerToken, DEFAULT_ENTRIES, undefined, { 'Sec-Fetch-Site': 'cross-site' }),
            );
            expect(res.status).toBe(403);
        });

        it('accepts same-origin fetch metadata', async () => {
            const res = await app.handle(
                uploadRequest(ownerToken, DEFAULT_ENTRIES, undefined, { 'Sec-Fetch-Site': 'same-origin' }),
            );
            expect(res.status).toBe(200);
        });

        it('rejects an unauthenticated delete with 401', async () => {
            const { previewId } = await createSnapshot();
            const res = await app.handle(
                new Request(`http://localhost/api/preview-snapshot/${previewId}`, { method: 'DELETE' }),
            );
            expect(res.status).toBe(401);
        });
    });

    describe('management: create / replace / delete', () => {
        it('creates a snapshot and returns previewId + previewUrl', async () => {
            const { previewId, previewUrl } = await createSnapshot();
            expect(previewId).toMatch(/^[0-9a-f]{32}$/);
            expect(previewUrl).toBe(`/preview-snapshot/${previewId}/index.html`);
        });

        it('replace keeps the same previewId and swaps contents', async () => {
            const { previewId } = await createSnapshot();
            const res = await app.handle(uploadRequest(ownerToken, { 'index.html': '<p>v2</p>' }, previewId));
            expect(res.status).toBe(200);
            const payload = await res.json();
            expect(payload.previewId).toBe(previewId);
            const served = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/index.html`));
            expect(await served.text()).toBe('<p>v2</p>');
        });

        it("refuses to replace another user's snapshot (403) and leaves it serving", async () => {
            const { previewId } = await createSnapshot();
            const res = await app.handle(uploadRequest(otherToken, { 'index.html': 'hijack' }, previewId));
            expect(res.status).toBe(403);
            const served = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/index.html`));
            expect(served.status).toBe(200);
            expect(await served.text()).not.toBe('hijack');
        });

        it('returns 400 when the snapshot part is missing', async () => {
            const formData = new FormData();
            formData.append('previewId', 'f'.repeat(32));
            const res = await app.handle(
                new Request('http://localhost/api/preview-snapshot/', {
                    method: 'POST',
                    headers: { Cookie: `auth=${ownerToken}` },
                    body: formData,
                }),
            );
            expect(res.status).toBe(400);
        });

        it('returns 400 for a corrupt archive', async () => {
            const formData = new FormData();
            formData.append('snapshot', new Blob([new TextEncoder().encode('not a zip') as BlobPart]), 'preview.zip');
            const res = await app.handle(
                new Request('http://localhost/api/preview-snapshot/', {
                    method: 'POST',
                    headers: { Cookie: `auth=${ownerToken}` },
                    body: formData,
                }),
            );
            expect(res.status).toBe(400);
        });

        it('returns 413 for an oversized snapshot', async () => {
            process.env.MAX_UPLOAD_SIZE = '64';
            try {
                const res = await app.handle(uploadRequest(ownerToken, { 'index.html': 'x'.repeat(500) }));
                expect(res.status).toBe(413);
            } finally {
                delete process.env.MAX_UPLOAD_SIZE;
            }
        });

        it('deletes an owned snapshot; the capability URL then 404s', async () => {
            const { previewId } = await createSnapshot();
            const res = await app.handle(
                new Request(`http://localhost/api/preview-snapshot/${previewId}`, {
                    method: 'DELETE',
                    headers: { Cookie: `auth=${ownerToken}` },
                }),
            );
            expect(res.status).toBe(200);
            const served = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/index.html`));
            expect(served.status).toBe(404);
        });

        it("rejects deleting another user's snapshot (403) and keeps it serving", async () => {
            const { previewId } = await createSnapshot();
            const res = await app.handle(
                new Request(`http://localhost/api/preview-snapshot/${previewId}`, {
                    method: 'DELETE',
                    headers: { Cookie: `auth=${otherToken}` },
                }),
            );
            expect(res.status).toBe(403);
            const served = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/index.html`));
            expect(served.status).toBe(200);
        });

        it('returns 404 when deleting an unknown snapshot', async () => {
            const res = await app.handle(
                new Request(`http://localhost/api/preview-snapshot/${'0'.repeat(32)}`, {
                    method: 'DELETE',
                    headers: { Cookie: `auth=${ownerToken}` },
                }),
            );
            expect(res.status).toBe(404);
        });
    });

    describe('serving: capability semantics', () => {
        it('serves without any cookies (capability is the only credential)', async () => {
            const { previewId } = await createSnapshot();
            const res = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/index.html`));
            expect(res.status).toBe(200);
            expect(await res.text()).toContain('active');
        });

        it('ignores cookies sent along and never issues Set-Cookie', async () => {
            const { previewId } = await createSnapshot();
            for (const path of ['index.html', 'theme/style.css', 'missing.html']) {
                const res = await app.handle(
                    new Request(`http://localhost/preview-snapshot/${previewId}/${path}`, {
                        headers: { Cookie: 'auth=whatever; session=other' },
                    }),
                );
                expect(res.headers.get('set-cookie')).toBeNull();
            }
        });

        it('redirects the bare capability root to the entry document (relative Location)', async () => {
            const { previewId } = await createSnapshot();
            const bare = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}`));
            expect(bare.status).toBe(302);
            expect(bare.headers.get('location')).toBe(`${previewId}/index.html`);
            const slash = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/`));
            expect(slash.status).toBe(302);
            expect(slash.headers.get('location')).toBe('index.html');
        });

        it('404s for unknown and malformed ids', async () => {
            await createSnapshot();
            for (const id of ['0'.repeat(32), 'nope', 'F'.repeat(32), 'f'.repeat(31)]) {
                const res = await app.handle(new Request(`http://localhost/preview-snapshot/${id}/index.html`));
                expect(res.status).toBe(404);
            }
        });

        it('404s once the snapshot TTL has expired', async () => {
            const { previewId } = await createSnapshot();
            let fakeNow = Date.now();
            store.configure({ now: () => fakeNow });
            fakeNow += store.getLimits().idleTtlMs + 1;
            const res = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/index.html`));
            expect(res.status).toBe(404);
        });
    });

    describe('serving: headers', () => {
        it('applies the hardening header set to every response', async () => {
            const { previewId } = await createSnapshot();
            for (const path of ['index.html', 'img/photo.png', 'missing.txt']) {
                const res = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/${path}`));
                expect(res.headers.get('x-content-type-options')).toBe('nosniff');
                expect(res.headers.get('cache-control')).toBe('no-store');
                expect(res.headers.get('referrer-policy')).toBe('no-referrer');
                expect(res.headers.get('permissions-policy')).toContain('camera=()');
                expect(res.headers.get('access-control-allow-origin')).toBe('*');
            }
        });

        it('emits the sandbox-first CSP on every scriptable type (HTML, SVG, XML, PDF)', async () => {
            const { previewId } = await createSnapshot();
            for (const path of ['index.html', 'img/logo.svg', 'content/data.xml', 'content/doc.pdf']) {
                const res = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/${path}`));
                const csp = res.headers.get('content-security-policy');
                expect(csp).toBe(`sandbox ${PREVIEW_SNAPSHOT_SANDBOX}`);
                expect(csp).not.toContain('allow-same-origin');
            }
        });

        it('omits the CSP on non-scriptable types', async () => {
            const { previewId } = await createSnapshot();
            for (const path of ['theme/style.css', 'img/photo.png']) {
                const res = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/${path}`));
                expect(res.headers.get('content-security-policy')).toBeNull();
            }
        });

        it('maps Content-Type from the stored extension only (no sniffing)', async () => {
            const { previewId } = await createSnapshot(ownerToken, {
                'index.html': '<p>doc</p>',
                'notes.txt': '<script>html-looking but plain text</script>',
            });
            const html = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/index.html`));
            expect(html.headers.get('content-type')).toBe('text/html; charset=utf-8');
            const txt = await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/notes.txt`));
            expect(txt.headers.get('content-type')).toBe('text/plain; charset=utf-8');
            expect(txt.headers.get('content-security-policy')).toBeNull();
            expect(txt.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });

    describe('security-negative', () => {
        it('sequentially guessed ids all 404 (statistical sanity)', async () => {
            await createSnapshot();
            for (let i = 0; i < 32; i++) {
                const guessed = i.toString(16).padStart(32, '0');
                const res = await app.handle(new Request(`http://localhost/preview-snapshot/${guessed}/index.html`));
                expect(res.status).toBe(404);
            }
        });

        it('rejects traversal over HTTP (encoded and literal)', async () => {
            const { previewId } = await createSnapshot();
            const probes = [
                `http://localhost/preview-snapshot/${previewId}/%2e%2e%2f%2e%2e%2fetc%2fpasswd`,
                `http://localhost/preview-snapshot/${previewId}/..%2f..%2fetc%2fpasswd`,
                `http://localhost/preview-snapshot/${previewId}/a/../../secret.html`,
                `http://localhost/preview-snapshot/${previewId}/%00`,
                `http://localhost/preview-snapshot/${previewId}/..%5c..%5cwindows`,
            ];
            for (const url of probes) {
                const res = await app.handle(new Request(url));
                expect(res.status).toBe(404);
            }
        });

        it('management routes reject requests without credentials on every method', async () => {
            const { previewId } = await createSnapshot();
            const post = await app.handle(uploadRequest(null));
            expect(post.status).toBe(401);
            const del = await app.handle(
                new Request(`http://localhost/api/preview-snapshot/${previewId}`, { method: 'DELETE' }),
            );
            expect(del.status).toBe(401);
        });
    });
});
