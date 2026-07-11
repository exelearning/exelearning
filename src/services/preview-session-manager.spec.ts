import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
    ASSET_KEY_RE,
    DEFAULT_PREVIEW_SESSION_LIMITS,
    applyRevision,
    configure,
    createSession,
    deleteSession,
    getFile,
    getLimitsFromEnv,
    getOwnedSession,
    getSessionForServing,
    getStats,
    resetDependencies,
    startPreviewSessionSweeper,
    stopPreviewSessionSweeper,
    storeAssets,
    sweepExpired,
    type FixedResourceResolver,
    type PreviewSession,
    type RevisionMeta,
} from './preview-session-manager';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ASSET_KEY_A = '11111111-2222-4333-8444-555555555555@aabbccdd';
const ASSET_KEY_B = '99999999-8888-4777-8666-555555555555@00112233445566778899aabbccddeeff';

function bytesOf(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

/** In-memory fixed-resource resolver stub for tests. */
function fixedResolver(entries: Record<string, string> = {}): FixedResourceResolver {
    const map = new Map(Object.entries(entries).map(([id, text]) => [id, bytesOf(text)]));
    return {
        hasResource: (id: string) => map.has(id),
        getResource: (id: string) => {
            const bytes = map.get(id);
            return bytes ? { bytes, size: bytes.length } : null;
        },
    };
}

const NO_FIXED = fixedResolver();

function ownedSession(previewId: string, ownerUserId: number): PreviewSession {
    const result = getOwnedSession(previewId, ownerUserId);
    if ('status' in result) throw new Error(`expected owned session, got ${result.status}`);
    return result.session;
}

/** Publish a first revision containing the given documents. */
function publishDocuments(
    session: PreviewSession,
    files: Record<string, string>,
    extras: Partial<Pick<RevisionMeta, 'assetRefs' | 'fixedRefs'>> = {},
    fixed: FixedResourceResolver = NO_FIXED,
): void {
    const result = applyRevision(
        session,
        {
            baseRevision: session.revision,
            nextRevision: session.revision + 1,
            writes: Object.entries(files).map(([path, text]) => ({ path, bytes: bytesOf(text) })),
            deletes: [],
            assetRefs: extras.assetRefs ?? {},
            fixedRefs: extras.fixedRefs ?? {},
        },
        fixed,
    );
    if (!('active' in result)) throw new Error(`applyRevision failed: ${JSON.stringify(result)}`);
}

beforeEach(() => {
    resetDependencies();
});

afterEach(() => {
    resetDependencies();
});

describe('getLimitsFromEnv', () => {
    it('falls back to the documented defaults', () => {
        const limits = getLimitsFromEnv({} as NodeJS.ProcessEnv);
        expect(limits).toEqual(DEFAULT_PREVIEW_SESSION_LIMITS);
        expect(limits.ttlMs).toBe(30 * 60 * 1000);
        expect(limits.maxSessionsPerUser).toBe(4);
        expect(limits.maxFilesPerSession).toBe(5000);
        expect(limits.maxBytesPerSession).toBe(200 * 1024 * 1024);
        expect(limits.maxAssetBytes).toBe(128 * 1024 * 1024);
        expect(limits.globalMaxBytes).toBe(2048 * 1024 * 1024);
    });

    it('parses the documented env knobs', () => {
        const limits = getLimitsFromEnv({
            PREVIEW_SESSION_TTL_MINUTES: '5',
            PREVIEW_MAX_SESSIONS_PER_USER: '2',
            PREVIEW_MAX_FILES_PER_SESSION: '10',
            PREVIEW_MAX_BYTES_PER_SESSION_MB: '1',
            PREVIEW_MAX_ASSET_BYTES_MB: '2',
            PREVIEW_GLOBAL_MAX_BYTES_MB: '3',
        } as unknown as NodeJS.ProcessEnv);
        expect(limits.ttlMs).toBe(5 * 60 * 1000);
        expect(limits.maxSessionsPerUser).toBe(2);
        expect(limits.maxFilesPerSession).toBe(10);
        expect(limits.maxBytesPerSession).toBe(1024 * 1024);
        expect(limits.maxAssetBytes).toBe(2 * 1024 * 1024);
        expect(limits.globalMaxBytes).toBe(3 * 1024 * 1024);
    });

    it('ignores non-numeric or non-positive values', () => {
        const limits = getLimitsFromEnv({
            PREVIEW_SESSION_TTL_MINUTES: 'soon',
            PREVIEW_MAX_SESSIONS_PER_USER: '0',
            PREVIEW_MAX_BYTES_PER_SESSION_MB: '-5',
            PREVIEW_MAX_ASSET_BYTES_MB: 'lots',
        } as unknown as NodeJS.ProcessEnv);
        expect(limits).toEqual(DEFAULT_PREVIEW_SESSION_LIMITS);
    });
});

describe('session lifecycle and ownership', () => {
    it('creates sessions with unguessable UUID ids at revision 0', () => {
        const { previewId } = createSession(1);
        expect(previewId).toMatch(UUID_RE);
        expect(ownedSession(previewId, 1).revision).toBe(0);
        const other = createSession(1);
        expect(other.previewId).not.toBe(previewId);
    });

    it('rejects access by non-owners with 403 and unknown ids with 404', () => {
        const { previewId } = createSession(1);
        expect(getOwnedSession(previewId, 2)).toEqual({ status: 403 });
        expect(getOwnedSession('11111111-2222-4333-8444-555555555555', 1)).toEqual({ status: 404 });
        expect('session' in getOwnedSession(previewId, 1)).toBe(true);
    });

    it('evicts the owner least-recently-used session over the per-user cap', () => {
        let clock = 1000;
        configure({
            now: () => clock,
            limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, maxSessionsPerUser: 2 },
        });
        const first = createSession(1).previewId;
        clock += 10;
        const second = createSession(1).previewId;
        clock += 10;
        // Touch the first session so the second becomes the LRU candidate.
        expect(getSessionForServing(first)).not.toBeNull();
        clock += 10;
        const third = createSession(1).previewId;
        expect(getOwnedSession(second, 1)).toEqual({ status: 404 });
        expect('session' in getOwnedSession(first, 1)).toBe(true);
        expect('session' in getOwnedSession(third, 1)).toBe(true);
    });

    it('expires idle sessions after the TTL but keeps served ones alive', () => {
        let clock = 0;
        configure({
            now: () => clock,
            limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, ttlMs: 100 },
        });
        const active = createSession(1).previewId;
        const idle = createSession(2).previewId;
        clock = 90;
        // GET traffic touches lastAccessAt and must keep the session alive.
        expect(getSessionForServing(active)).not.toBeNull();
        clock = 150;
        expect(sweepExpired()).toBe(1);
        expect(getSessionForServing(idle)).toBeNull();
        expect(getSessionForServing(active)).not.toBeNull();
    });

    it('deletes sessions on demand and reclaims their global bytes', () => {
        const { previewId } = createSession(1);
        const session = ownedSession(previewId, 1);
        storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: 4, bytes: bytesOf('data') }]);
        publishDocuments(session, { 'index.html': '<html></html>' });
        expect(getStats().globalBytes).toBeGreaterThan(0);
        expect(deleteSession(previewId)).toBe(true);
        expect(deleteSession(previewId)).toBe(false);
        expect(getSessionForServing(previewId)).toBeNull();
        expect(getStats()).toEqual({ sessions: 0, globalBytes: 0 });
    });
});

describe('storeAssets', () => {
    it('validates the assetKey shape', () => {
        expect(ASSET_KEY_RE.test(ASSET_KEY_A)).toBe(true);
        expect(ASSET_KEY_RE.test('not-a-key')).toBe(false);
        const session = ownedSession(createSession(1).previewId, 1);
        const result = storeAssets(session, [
            { key: 'short@aabbccdd', declaredSize: 1, bytes: bytesOf('x') },
            { key: `${'1'.repeat(36)}@zzzz11112222`, declaredSize: 1, bytes: bytesOf('x') },
            { key: `${'1'.repeat(36)}@aabbcc`, declaredSize: 1, bytes: bytesOf('x') }, // hash prefix too short
            { key: ASSET_KEY_A, declaredSize: 1, bytes: bytesOf('x') },
        ]);
        expect(result.stored).toEqual([ASSET_KEY_A]);
        expect(result.rejected.map(r => r.reason)).toEqual(['invalid-key', 'invalid-key', 'invalid-key']);
    });

    it('keeps asset bytes immutable: a re-upload with different bytes is alreadyStored and ignored', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        const original = bytesOf('original bytes');
        const first = storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: original.length, bytes: original }]);
        expect(first.stored).toEqual([ASSET_KEY_A]);
        const forged = bytesOf('FORGED payload!');
        const second = storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: forged.length, bytes: forged }]);
        expect(second.stored).toEqual([]);
        expect(second.alreadyStored).toEqual([ASSET_KEY_A]);
        expect(second.rejected).toEqual([]);
        expect(session.assets.get(ASSET_KEY_A)).toEqual(original);
        // Global accounting must not double-count the ignored re-upload.
        expect(getStats().globalBytes).toBe(original.length);
    });

    it('rejects entries whose declared size differs from the actual bytes', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        const result = storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: 999, bytes: bytesOf('tiny') }]);
        expect(result.rejected).toEqual([{ key: ASSET_KEY_A, reason: 'size-mismatch' }]);
        expect(session.assets.size).toBe(0);
    });

    it('enforces the per-asset byte cap', () => {
        configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, maxAssetBytes: 4 } });
        const session = ownedSession(createSession(1).previewId, 1);
        const result = storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: 5, bytes: bytesOf('12345') }]);
        expect(result.rejected).toEqual([{ key: ASSET_KEY_A, reason: 'asset-too-large' }]);
    });

    it('enforces the session byte budget across documents + assets combined', () => {
        configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, maxBytesPerSession: 10 } });
        const session = ownedSession(createSession(1).previewId, 1);
        publishDocuments(session, { 'index.html': '12345678' }); // 8 bytes of documents
        const result = storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: 5, bytes: bytesOf('12345') }]);
        expect(result.rejected).toEqual([{ key: ASSET_KEY_A, reason: 'session-budget-exceeded' }]);
        expect(getStats().globalBytes).toBe(8);
    });

    it('evicts other least-recently-used sessions to fit the global budget but never the current one', () => {
        let clock = 0;
        configure({
            now: () => clock,
            limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, globalMaxBytes: 10 },
        });
        const victimId = createSession(1).previewId;
        const victim = ownedSession(victimId, 1);
        storeAssets(victim, [{ key: ASSET_KEY_A, declaredSize: 6, bytes: bytesOf('123456') }]);
        clock += 10;
        const currentId = createSession(2).previewId;
        const current = ownedSession(currentId, 2);
        const result = storeAssets(current, [{ key: ASSET_KEY_B, declaredSize: 8, bytes: bytesOf('12345678') }]);
        expect(result.stored).toEqual([ASSET_KEY_B]);
        expect(getSessionForServing(victimId)).toBeNull();
        expect(getSessionForServing(currentId)).not.toBeNull();
    });

    it('rejects when the bytes cannot fit the global budget even after evicting others', () => {
        configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, globalMaxBytes: 4 } });
        const session = ownedSession(createSession(1).previewId, 1);
        const result = storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: 6, bytes: bytesOf('123456') }]);
        expect(result.rejected).toEqual([{ key: ASSET_KEY_A, reason: 'global-budget-exceeded' }]);
    });

    it('reports a duplicate key inside one batch as alreadyStored, keeping the first bytes', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        const result = storeAssets(session, [
            { key: ASSET_KEY_A, declaredSize: 5, bytes: bytesOf('first') },
            { key: ASSET_KEY_A, declaredSize: 6, bytes: bytesOf('second') },
        ]);
        expect(result.stored).toEqual([ASSET_KEY_A]);
        expect(result.alreadyStored).toEqual([ASSET_KEY_A]);
        expect(session.assets.get(ASSET_KEY_A)).toEqual(bytesOf('first'));
    });
});

describe('applyRevision', () => {
    it('publishes a first revision and serves its documents', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        const result = applyRevision(
            session,
            {
                baseRevision: 0,
                nextRevision: 1,
                writes: [{ path: 'index.html', bytes: bytesOf('<html></html>') }],
                deletes: [],
                assetRefs: {},
                fixedRefs: {},
            },
            NO_FIXED,
        );
        expect(result).toEqual({ revision: 1, active: true });
        expect(getFile(session, 'index.html', NO_FIXED)?.bytes).toEqual(bytesOf('<html></html>'));
    });

    it('rejects a stale baseRevision with a 409 carrying the current revision', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        publishDocuments(session, { 'index.html': 'v1' });
        const stale = applyRevision(
            session,
            { baseRevision: 0, nextRevision: 1, writes: [], deletes: [], assetRefs: {}, fixedRefs: {} },
            NO_FIXED,
        );
        expect(stale).toEqual({ status: 409, currentRevision: 1 });
    });

    it('rejects nextRevision !== baseRevision + 1 with 409', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        const skipped = applyRevision(
            session,
            { baseRevision: 0, nextRevision: 2, writes: [], deletes: [], assetRefs: {}, fixedRefs: {} },
            NO_FIXED,
        );
        expect(skipped).toEqual({ status: 409, currentRevision: 0 });
    });

    it('rejects unsafe paths in writes, deletes and both ref maps with 400', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        const cases: RevisionMeta[] = [
            {
                baseRevision: 0,
                nextRevision: 1,
                writes: [{ path: '../escape.html', bytes: bytesOf('x') }],
                deletes: [],
                assetRefs: {},
                fixedRefs: {},
            },
            {
                baseRevision: 0,
                nextRevision: 1,
                writes: [],
                deletes: ['%2e%2e%2fescape'],
                assetRefs: {},
                fixedRefs: {},
            },
            {
                baseRevision: 0,
                nextRevision: 1,
                writes: [],
                deletes: [],
                assetRefs: { '/../secret.png': ASSET_KEY_A },
                fixedRefs: {},
            },
            {
                baseRevision: 0,
                nextRevision: 1,
                writes: [],
                deletes: [],
                assetRefs: {},
                fixedRefs: { '.. /x.js': 'libs/x.js' },
            },
        ];
        for (const meta of cases) {
            expect(applyRevision(session, meta, NO_FIXED)).toMatchObject({ status: 400 });
            expect(session.revision).toBe(0);
        }
    });

    it('rejects assetRefs pointing at keys the session does not hold with 422 missing-assets', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: 3, bytes: bytesOf('img') }]);
        const result = applyRevision(
            session,
            {
                baseRevision: 0,
                nextRevision: 1,
                writes: [{ path: 'index.html', bytes: bytesOf('x') }],
                deletes: [],
                assetRefs: {
                    'content/resources/a.png': ASSET_KEY_A,
                    'content/resources/b.png': ASSET_KEY_B,
                    'content/resources/c.png': 'malformed-key',
                },
                fixedRefs: {},
            },
            NO_FIXED,
        );
        expect(result).toEqual({ status: 422, reason: 'missing-assets', missing: [ASSET_KEY_B, 'malformed-key'] });
        expect(session.revision).toBe(0);
    });

    it('rejects fixedRefs pointing at ids outside the manifest with 422 unknown-fixed-resources', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        const fixed = fixedResolver({ 'libs/jquery/jquery.min.js': 'jq' });
        const result = applyRevision(
            session,
            {
                baseRevision: 0,
                nextRevision: 1,
                writes: [{ path: 'index.html', bytes: bytesOf('x') }],
                deletes: [],
                assetRefs: {},
                fixedRefs: {
                    'libs/jquery/jquery.min.js': 'libs/jquery/jquery.min.js',
                    'theme/style.css': 'theme:usertheme/style.css',
                },
            },
            fixed,
        );
        expect(result).toEqual({
            status: 422,
            reason: 'unknown-fixed-resources',
            resources: ['theme:usertheme/style.css'],
        });
        expect(session.revision).toBe(0);
    });

    it('enforces the file-count cap across documents + assetRefs + fixedRefs with 413', () => {
        configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, maxFilesPerSession: 2 } });
        const session = ownedSession(createSession(1).previewId, 1);
        storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: 1, bytes: bytesOf('x') }]);
        const fixed = fixedResolver({ 'libs/a.js': 'a' });
        const result = applyRevision(
            session,
            {
                baseRevision: 0,
                nextRevision: 1,
                writes: [{ path: 'index.html', bytes: bytesOf('x') }],
                deletes: [],
                assetRefs: { 'content/resources/a.png': ASSET_KEY_A },
                fixedRefs: { 'libs/a.js': 'libs/a.js' },
            },
            fixed,
        );
        expect(result).toMatchObject({ status: 413 });
        expect(session.revision).toBe(0);
    });

    it('enforces the session byte budget on the post-delta document set with 413', () => {
        configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, maxBytesPerSession: 10 } });
        const session = ownedSession(createSession(1).previewId, 1);
        publishDocuments(session, { 'index.html': '12345' });
        const result = applyRevision(
            session,
            {
                baseRevision: 1,
                nextRevision: 2,
                writes: [{ path: 'big.html', bytes: bytesOf('123456789') }],
                deletes: [],
                assetRefs: {},
                fixedRefs: {},
            },
            NO_FIXED,
        );
        expect(result).toMatchObject({ status: 413 });
        // A failed apply leaves the old revision fully intact.
        expect(session.revision).toBe(1);
        expect(getFile(session, 'index.html', NO_FIXED)?.bytes).toEqual(bytesOf('12345'));
        expect(getFile(session, 'big.html', NO_FIXED)).toBeNull();
    });

    it('counts deletes against the budget so shrinking revisions fit', () => {
        configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, maxBytesPerSession: 10 } });
        const session = ownedSession(createSession(1).previewId, 1);
        publishDocuments(session, { 'index.html': '12345678' });
        const result = applyRevision(
            session,
            {
                baseRevision: 1,
                nextRevision: 2,
                writes: [{ path: 'index.html', bytes: bytesOf('123456789') }],
                deletes: ['index.html'],
                assetRefs: {},
                fixedRefs: {},
            },
            NO_FIXED,
        );
        expect(result).toEqual({ revision: 2, active: true });
        expect(getFile(session, 'index.html', NO_FIXED)?.bytes).toEqual(bytesOf('123456789'));
        expect(getStats().globalBytes).toBe(9);
    });

    it('evicts other sessions when document growth exceeds the global budget, never the current one', () => {
        let clock = 0;
        configure({
            now: () => clock,
            limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, globalMaxBytes: 10 },
        });
        const victimId = createSession(1).previewId;
        const victim = ownedSession(victimId, 1);
        publishDocuments(victim, { 'v.html': '123456' });
        clock += 10;
        const currentId = createSession(2).previewId;
        const current = ownedSession(currentId, 2);
        publishDocuments(current, { 'c.html': '12345678' });
        expect(getSessionForServing(victimId)).toBeNull();
        expect(getSessionForServing(currentId)).not.toBeNull();
        expect(getFile(current, 'c.html', NO_FIXED)).not.toBeNull();
    });

    it('rejects with 413 when documents cannot fit the global budget even after evicting others', () => {
        configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, globalMaxBytes: 4 } });
        const session = ownedSession(createSession(1).previewId, 1);
        const result = applyRevision(
            session,
            {
                baseRevision: 0,
                nextRevision: 1,
                writes: [{ path: 'big.html', bytes: bytesOf('123456') }],
                deletes: [],
                assetRefs: {},
                fixedRefs: {},
            },
            NO_FIXED,
        );
        expect(result).toMatchObject({ status: 413 });
    });

    it('applies deletes then writes and replaces the ref maps wholesale', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        storeAssets(session, [
            { key: ASSET_KEY_A, declaredSize: 3, bytes: bytesOf('one') },
            { key: ASSET_KEY_B, declaredSize: 3, bytes: bytesOf('two') },
        ]);
        const fixed = fixedResolver({ 'libs/a.js': 'a', 'libs/b.js': 'b' });
        publishDocuments(
            session,
            { 'index.html': 'v1', 'html/gone.html': 'bye' },
            {
                assetRefs: { 'content/resources/a.png': ASSET_KEY_A },
                fixedRefs: { 'libs/a.js': 'libs/a.js' },
            },
            fixed,
        );
        const result = applyRevision(
            session,
            {
                baseRevision: 1,
                nextRevision: 2,
                writes: [{ path: 'index.html', bytes: bytesOf('v2!') }],
                deletes: ['html/gone.html'],
                assetRefs: { 'content/resources/b.png': ASSET_KEY_B },
                fixedRefs: { 'libs/b.js': 'libs/b.js' },
            },
            fixed,
        );
        expect(result).toEqual({ revision: 2, active: true });
        expect(getFile(session, 'index.html', fixed)?.bytes).toEqual(bytesOf('v2!'));
        expect(getFile(session, 'html/gone.html', fixed)).toBeNull();
        // Old refs are gone (FULL replacement maps), new ones resolve.
        expect(getFile(session, 'content/resources/a.png', fixed)).toBeNull();
        expect(getFile(session, 'content/resources/b.png', fixed)?.bytes).toEqual(bytesOf('two'));
        expect(getFile(session, 'libs/a.js', fixed)).toBeNull();
        expect(getFile(session, 'libs/b.js', fixed)?.bytes).toEqual(bytesOf('b'));
        // Unreferenced assets stay stored for the session lifetime (no GC).
        expect(session.assets.has(ASSET_KEY_A)).toBe(true);
    });

    it('treats a path in both deletes and writes as a write', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        publishDocuments(session, { 'index.html': 'old' });
        const result = applyRevision(
            session,
            {
                baseRevision: 1,
                nextRevision: 2,
                writes: [{ path: 'index.html', bytes: bytesOf('new') }],
                deletes: ['index.html'],
                assetRefs: {},
                fixedRefs: {},
            },
            NO_FIXED,
        );
        expect(result).toEqual({ revision: 2, active: true });
        expect(getFile(session, 'index.html', NO_FIXED)?.bytes).toEqual(bytesOf('new'));
        expect(getStats().globalBytes).toBe(3);
    });

    it('is atomic: a failed apply leaves the previous revision fully observable', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        publishDocuments(session, { 'index.html': 'stable', 'theme/style.css': 'css' });
        // Fails at the LAST validation stage (413 file count) — after paths,
        // assets and fixed refs were already validated and normalized.
        // Post-delta count would be 2 (index.html + extra.html) > 1.
        configure({ limits: { ...DEFAULT_PREVIEW_SESSION_LIMITS, maxFilesPerSession: 1 } });
        const failed = applyRevision(
            session,
            {
                baseRevision: 1,
                nextRevision: 2,
                writes: [
                    { path: 'index.html', bytes: bytesOf('torn') },
                    { path: 'extra.html', bytes: bytesOf('extra') },
                ],
                deletes: ['theme/style.css'],
                assetRefs: {},
                fixedRefs: {},
            },
            NO_FIXED,
        );
        expect(failed).toMatchObject({ status: 413 });
        // Every observable piece of revision 1 is intact — no partial deletes,
        // no partial writes, same revision number.
        expect(session.revision).toBe(1);
        expect(getFile(session, 'index.html', NO_FIXED)?.bytes).toEqual(bytesOf('stable'));
        expect(getFile(session, 'theme/style.css', NO_FIXED)?.bytes).toEqual(bytesOf('css'));
        expect(getFile(session, 'extra.html', NO_FIXED)).toBeNull();
    });
});

describe('getFile', () => {
    it('serves nothing before the first revision publishes (revision 0)', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: 3, bytes: bytesOf('img') }]);
        // Even a path that WOULD match after publication returns null.
        expect(getFile(session, 'index.html', NO_FIXED)).toBeNull();
        expect(getFile(session, '', NO_FIXED)).toBeNull();
    });

    it('resolves the three layers in order: documents, then assets, then fixed', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: 5, bytes: bytesOf('asset') }]);
        const fixed = fixedResolver({ 'libs/jquery/jquery.min.js': 'jquery();' });
        publishDocuments(
            session,
            { 'index.html': '<html></html>' },
            {
                assetRefs: { 'content/resources/pic.png': ASSET_KEY_A },
                fixedRefs: { 'libs/jquery/jquery.min.js': 'libs/jquery/jquery.min.js' },
            },
            fixed,
        );
        expect(getFile(session, 'index.html', fixed)).toMatchObject({
            kind: 'document',
            contentType: 'text/html; charset=utf-8',
            isScriptable: true,
        });
        expect(getFile(session, 'content/resources/pic.png', fixed)).toMatchObject({
            kind: 'asset',
            contentType: 'image/png',
            isScriptable: false,
            etag: ASSET_KEY_A,
        });
        expect(getFile(session, 'libs/jquery/jquery.min.js', fixed)).toMatchObject({
            kind: 'fixed',
            isScriptable: false,
        });
    });

    it('a document shadows an assetRef or fixedRef on the same path', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: 5, bytes: bytesOf('asset') }]);
        const fixed = fixedResolver({ 'libs/a.js': 'fixed' });
        publishDocuments(
            session,
            { 'both.png': 'doc-bytes', 'libs/a.js': 'doc-js' },
            { assetRefs: { 'both.png': ASSET_KEY_A }, fixedRefs: { 'libs/a.js': 'libs/a.js' } },
            fixed,
        );
        expect(getFile(session, 'both.png', fixed)).toMatchObject({ kind: 'document' });
        expect(getFile(session, 'libs/a.js', fixed)).toMatchObject({ kind: 'document' });
    });

    it('normalizes the bare session path to index.html and strips query strings', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        publishDocuments(session, { 'index.html': '<html></html>' });
        expect(getFile(session, '', NO_FIXED)).toMatchObject({ kind: 'document', isScriptable: true });
        expect(getFile(session, '/index.html?exe-teacher=1', NO_FIXED)).not.toBeNull();
    });

    it('flags every scriptable document type, not just HTML', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        publishDocuments(session, {
            'img/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>',
            'data/feed.xml': '<?xml version="1.0"?><root/>',
            'theme/style.css': 'body{}',
        });
        expect(getFile(session, 'img/logo.svg', NO_FIXED)?.isScriptable).toBe(true);
        expect(getFile(session, 'data/feed.xml', NO_FIXED)?.isScriptable).toBe(true);
        expect(getFile(session, 'theme/style.css', NO_FIXED)?.isScriptable).toBe(false);
    });

    it('returns null for unknown and traversal paths', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        publishDocuments(session, { 'index.html': 'x' });
        expect(getFile(session, 'missing.html', NO_FIXED)).toBeNull();
        expect(getFile(session, '../index.html', NO_FIXED)).toBeNull();
        expect(getFile(session, '%2e%2e%2findex.html', NO_FIXED)).toBeNull();
    });

    it('falls past a dangling assetRef whose key left the store (defensive)', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        storeAssets(session, [{ key: ASSET_KEY_A, declaredSize: 3, bytes: bytesOf('img') }]);
        publishDocuments(session, { 'index.html': 'x' }, { assetRefs: { 'a.png': ASSET_KEY_A } });
        // Assets are never garbage-collected while the session lives, so this
        // state is unreachable through the public API — simulate it directly.
        session.assets.delete(ASSET_KEY_A);
        expect(getFile(session, 'a.png', NO_FIXED)).toBeNull();
    });

    it('returns null when a fixedRef id vanished from the manifest between revisions', () => {
        const session = ownedSession(createSession(1).previewId, 1);
        const fixed = fixedResolver({ 'libs/a.js': 'a' });
        publishDocuments(session, { 'index.html': 'x' }, { fixedRefs: { 'libs/a.js': 'libs/a.js' } }, fixed);
        expect(getFile(session, 'libs/a.js', NO_FIXED)).toBeNull();
    });
});

describe('sweeper', () => {
    it('start is idempotent and stop clears the timer', () => {
        startPreviewSessionSweeper(60_000);
        startPreviewSessionSweeper(60_000);
        stopPreviewSessionSweeper();
        stopPreviewSessionSweeper();
    });

    it('resetDependencies clears the store and stops the sweeper', () => {
        const { previewId } = createSession(1);
        startPreviewSessionSweeper(60_000);
        resetDependencies();
        expect(getSessionForServing(previewId)).toBeNull();
        expect(getStats()).toEqual({ sessions: 0, globalBytes: 0 });
    });
});
