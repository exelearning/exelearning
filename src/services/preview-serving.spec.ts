import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as manager from './preview-session-manager';
import {
    PROTOCOL_VERSION,
    RECOMMENDED_BATCH_BYTES,
    baseServeHeaders,
    createSessionResponse,
    handleAssetsUpload,
    handleRevisionUpload,
    parseRangeHeader,
    servePreviewFile,
} from './preview-serving';

const ASSET_KEY = '11111111-2222-4333-8444-555555555555@aabbccdd';

const NO_FIXED: manager.FixedResourceResolver = {
    hasResource: () => false,
    getResource: () => null,
};

function bytesOf(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

function newSession(): manager.PreviewSession {
    const { previewId } = manager.createSession(1);
    const owned = manager.getOwnedSession(previewId, 1);
    if ('status' in owned) throw new Error('expected session');
    return owned.session;
}

beforeEach(() => {
    manager.resetDependencies();
});

afterEach(() => {
    manager.resetDependencies();
});

describe('parseRangeHeader', () => {
    it('returns null when no range is requested', () => {
        expect(parseRangeHeader(null, 10)).toBeNull();
        expect(parseRangeHeader(undefined, 10)).toBeNull();
        expect(parseRangeHeader('', 10)).toBeNull();
    });

    it('parses the three single-range forms', () => {
        expect(parseRangeHeader('bytes=2-4', 10)).toEqual({ start: 2, end: 4 });
        expect(parseRangeHeader('bytes=7-', 10)).toEqual({ start: 7, end: 9 });
        expect(parseRangeHeader('bytes=-3', 10)).toEqual({ start: 7, end: 9 });
        // A suffix longer than the body clamps to the whole body.
        expect(parseRangeHeader('bytes=-99', 10)).toEqual({ start: 0, end: 9 });
        // An end beyond the body clamps to the last byte.
        expect(parseRangeHeader('bytes=8-99', 10)).toEqual({ start: 8, end: 9 });
        expect(parseRangeHeader(' bytes=0-0 ', 10)).toEqual({ start: 0, end: 0 });
    });

    it('flags malformed, multi-range and out-of-bounds requests as unsatisfiable', () => {
        expect(parseRangeHeader('bytes=10-', 10)).toBe('unsatisfiable');
        expect(parseRangeHeader('bytes=5-2', 10)).toBe('unsatisfiable');
        expect(parseRangeHeader('bytes=-', 10)).toBe('unsatisfiable');
        expect(parseRangeHeader('bytes=-0', 10)).toBe('unsatisfiable');
        expect(parseRangeHeader('bytes=0-1,3-4', 10)).toBe('unsatisfiable');
        expect(parseRangeHeader('items=0-1', 10)).toBe('unsatisfiable');
        expect(parseRangeHeader('bytes=a-b', 10)).toBe('unsatisfiable');
        // Nothing is satisfiable on an empty body.
        expect(parseRangeHeader('bytes=0-', 0)).toBe('unsatisfiable');
        expect(parseRangeHeader('bytes=-1', 0)).toBe('unsatisfiable');
    });
});

describe('baseServeHeaders', () => {
    it('carries the hardening set but no Cache-Control (tiered per layer)', () => {
        const headers = baseServeHeaders();
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['Referrer-Policy']).toBe('no-referrer');
        expect(headers['Permissions-Policy']).toContain('camera=()');
        expect(headers['Access-Control-Allow-Origin']).toBe('*');
        expect(headers['Cache-Control']).toBeUndefined();
    });
});

describe('createSessionResponse', () => {
    it('advertises protocol v2, revision 0 and all four limits', () => {
        const result = createSessionResponse(manager, 1);
        expect(result.status).toBe(201);
        expect(result.body).toMatchObject({
            protocolVersion: PROTOCOL_VERSION,
            revision: 0,
            limits: {
                maxFilesPerSession: expect.any(Number),
                maxBytesPerSession: expect.any(Number),
                maxAssetBytes: expect.any(Number),
                recommendedBatchBytes: RECOMMENDED_BATCH_BYTES,
            },
        });
    });
});

describe('handleAssetsUpload', () => {
    it('accepts a pre-parsed assets array (multipart duck-typing)', async () => {
        const session = newSession();
        const result = await handleAssetsUpload(
            session,
            [{ key: ASSET_KEY, size: 4 }],
            [new Blob([bytesOf('data')])],
            manager,
        );
        expect(result.status).toBe(200);
        expect(result.body).toMatchObject({ stored: [ASSET_KEY] });
    });

    it('rejects non-array and malformed entries with 400', async () => {
        const session = newSession();
        expect((await handleAssetsUpload(session, '{broken', [], manager)).status).toBe(400);
        expect((await handleAssetsUpload(session, { key: ASSET_KEY }, [], manager)).status).toBe(400);
        expect((await handleAssetsUpload(session, [{ key: 5, size: 1 }], [new Blob(['x'])], manager)).status).toBe(400);
        expect((await handleAssetsUpload(session, [{ key: ASSET_KEY, size: 'big' }], [new Blob(['x'])], manager)).status).toBe(
            400,
        );
    });
});

describe('handleRevisionUpload', () => {
    it('rejects non-object metas and non-integer revision numbers with 400', async () => {
        const session = newSession();
        expect((await handleRevisionUpload(session, '[1]', [], manager, NO_FIXED)).status).toBe(400);
        expect((await handleRevisionUpload(session, 'null', [], manager, NO_FIXED)).status).toBe(400);
        const nonInteger = JSON.stringify({ baseRevision: 0.5, nextRevision: 1, writes: [] });
        expect((await handleRevisionUpload(session, nonInteger, [], manager, NO_FIXED)).status).toBe(400);
    });

    it('rejects malformed writes/deletes/ref maps with 400', async () => {
        const session = newSession();
        const cases = [
            { baseRevision: 0, nextRevision: 1, writes: [42] },
            { baseRevision: 0, nextRevision: 1, writes: [], deletes: 'index.html' },
            { baseRevision: 0, nextRevision: 1, writes: [], assetRefs: { a: 7 } },
            { baseRevision: 0, nextRevision: 1, writes: [], fixedRefs: ['libs/a.js'] },
        ];
        for (const meta of cases) {
            const result = await handleRevisionUpload(session, JSON.stringify(meta), [], manager, NO_FIXED);
            expect(result.status).toBe(400);
        }
    });

    it('defaults omitted deletes/assetRefs/fixedRefs to empty and publishes', async () => {
        const session = newSession();
        const meta = JSON.stringify({ baseRevision: 0, nextRevision: 1, writes: ['index.html'] });
        const result = await handleRevisionUpload(session, meta, [new Blob([bytesOf('<html/>')])], manager, NO_FIXED);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({ revision: 1, active: true });
    });

    it('rejects write payloads that exceed the budget while buffering with 413', async () => {
        manager.configure({
            limits: { ...manager.DEFAULT_PREVIEW_SESSION_LIMITS, maxBytesPerSession: 4 },
        });
        const session = newSession();
        const meta = JSON.stringify({ baseRevision: 0, nextRevision: 1, writes: ['big.bin'] });
        const result = await handleRevisionUpload(session, meta, [new Blob([bytesOf('123456789')])], manager, NO_FIXED);
        expect(result.status).toBe(413);
        expect(session.revision).toBe(0);
    });
});

describe('servePreviewFile', () => {
    it('404s malformed ids and unknown sessions with hardened, uncacheable responses', () => {
        for (const previewId of ['nope', '11111111-2222-4333-8444-555555555555']) {
            const res = servePreviewFile(previewId, 'index.html', {}, { manager, fixedResources: NO_FIXED });
            expect(res.status).toBe(404);
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            expect(res.headers.get('cache-control')).toBe('no-store');
        }
    });

    it('matches If-None-Match lists, weak validators and the wildcard', async () => {
        const session = newSession();
        manager.storeAssets(session, [{ key: ASSET_KEY, declaredSize: 4, bytes: bytesOf('data') }]);
        manager.applyRevision(
            session,
            {
                baseRevision: 0,
                nextRevision: 1,
                writes: [],
                deletes: [],
                assetRefs: { 'a.png': ASSET_KEY },
                fixedRefs: {},
            },
            NO_FIXED,
        );
        const deps = { manager, fixedResources: NO_FIXED };
        const matches = [`"${ASSET_KEY}"`, ASSET_KEY, `W/"${ASSET_KEY}"`, `"other", "${ASSET_KEY}"`, '*'];
        for (const value of matches) {
            expect(servePreviewFile(session.id, 'a.png', { ifNoneMatch: value }, deps).status).toBe(304);
        }
        expect(servePreviewFile(session.id, 'a.png', { ifNoneMatch: '"nope"' }, deps).status).toBe(200);
    });
});
