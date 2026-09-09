/**
 * Preview trust-boundary integration tests (server side).
 *
 * Concurrent replace on the snapshot routes is last-write-wins with no torn
 * snapshot: after any number of racing replaces, every file served comes from
 * the same single upload. (The filtered-vs-unfiltered export fixture lives in
 * public/app/workarea/interface/elements/preview/previewFilteredExport.test.js
 * — the real content policy needs a browser DOM, which Vitest provides.)
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import * as fflate from 'fflate';
import { SignJWT } from 'jose';
import * as snapshotStore from '../../src/services/preview-snapshot-store';
import { createPreviewSnapshotApiRoutes, createPreviewSnapshotServeRoutes } from '../../src/routes/preview-snapshot';

describe('snapshot routes: concurrent replace', () => {
    const TEST_JWT_SECRET = 'dev_secret_change_me';
    const savedJwtSecret = process.env.JWT_SECRET;
    const savedApiJwtSecret = process.env.API_JWT_SECRET;

    afterEach(() => {
        snapshotStore.clearAllForTests();
        if (savedJwtSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = savedJwtSecret;
        if (savedApiJwtSecret !== undefined) process.env.API_JWT_SECRET = savedApiJwtSecret;
    });

    it('is last-write-wins without partial reads (no torn snapshot)', async () => {
        delete process.env.API_JWT_SECRET;
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        const token = await new SignJWT({ sub: 1, email: 'u@test.local', roles: ['ROLE_USER'] })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(new TextEncoder().encode(TEST_JWT_SECRET));
        const app = new Elysia().use(createPreviewSnapshotApiRoutes()).use(createPreviewSnapshotServeRoutes());

        const upload = (previewId: string | null, version: number) => {
            const zipped = fflate.zipSync({
                'index.html': new TextEncoder().encode(`<html><body>v${version}</body></html>`),
                'data.txt': new TextEncoder().encode(`v${version}`),
            });
            const formData = new FormData();
            formData.append('snapshot', new Blob([zipped as BlobPart], { type: 'application/zip' }), 'preview.zip');
            if (previewId) formData.append('previewId', previewId);
            return app.handle(
                new Request('http://localhost/api/preview-snapshot/', {
                    method: 'POST',
                    headers: { Cookie: `auth=${token}` },
                    body: formData,
                }),
            );
        };

        const created = await (await upload(null, 0)).json();
        const previewId: string = created.previewId;

        // Fire many replaces of the SAME snapshot concurrently.
        const responses = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(version => upload(previewId, version)));
        for (const response of responses) {
            expect(response.status).toBe(200);
            expect((await response.json()).previewId).toBe(previewId);
        }

        // Whatever write won, BOTH files must come from the same upload.
        const indexHtml = await (
            await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/index.html`))
        ).text();
        const dataTxt = await (
            await app.handle(new Request(`http://localhost/preview-snapshot/${previewId}/data.txt`))
        ).text();
        const winner = /v(\d+)/.exec(indexHtml)?.[1];
        expect(winner).toBeDefined();
        expect(dataTxt).toBe(`v${winner}`);
    });
});
