/**
 * Editor preview sessions: ephemeral, in-memory storage for the opaque preview
 * (serving contract v2 — doc/development/preview-serving-contract.md).
 *
 * A session holds three layers with different lifecycles:
 *
 * - `documents` — generated files (page HTML, generated CSS/JS, user themes…),
 *   mutated only through atomic incremental revisions (`applyRevision`);
 * - `assets` — author media, immutable per `assetKey` for the session lifetime
 *   (`storeAssets`); the key is an opaque validated token the project model
 *   already stores (asset id + content-hash prefix) — the server never hashes;
 * - `fixedRefs` — served path → fixedResourceId indirection into the
 *   installation's fixed-resource manifest (zero bytes transferred).
 *
 * The authless `/preview/{previewId}/*` route serves the three layers through
 * `getFile` (documents → assetRefs→assets → fixedRefs→manifest → miss).
 *
 * Sessions are process-local and intentionally NOT persisted: they die on
 * restart and the client transparently recreates them on the next refresh (any
 * 404 from the API or the serving route triggers a re-sync). Deployments that
 * run multiple instances behind a load balancer need sticky sessions for the
 * preview routes — the same limitation class as the other in-memory managers.
 */
import { isScriptableDocumentType } from '../shared/security/previewSandbox';
import { contentTypeFor, normalizeContentPath } from '../utils/content-path.util';

export interface PreviewSession {
    id: string;
    ownerUserId: number;
    /** Active revision number; 0 until the first revision publishes. */
    revision: number;
    /** Generated-document layer: served path → bytes (latest revision). */
    documents: Map<string, Uint8Array>;
    /** Active revision's full asset map: served path → assetKey. */
    assetRefs: ReadonlyMap<string, string>;
    /** Active revision's full fixed map: served path → fixedResourceId. */
    fixedRefs: ReadonlyMap<string, string>;
    /** Session-lifetime asset store: assetKey → bytes (immutable per key). */
    assets: Map<string, Uint8Array>;
    assetBytes: number;
    documentBytes: number;
    createdAt: number;
    lastAccessAt: number;
}

export interface PreviewSessionLimits {
    ttlMs: number;
    maxSessionsPerUser: number;
    maxFilesPerSession: number;
    maxBytesPerSession: number;
    maxAssetBytes: number;
    globalMaxBytes: number;
    sweepIntervalMs: number;
}

export const DEFAULT_PREVIEW_SESSION_LIMITS: PreviewSessionLimits = {
    ttlMs: 30 * 60 * 1000,
    maxSessionsPerUser: 4,
    maxFilesPerSession: 5000,
    maxBytesPerSession: 200 * 1024 * 1024,
    maxAssetBytes: 128 * 1024 * 1024,
    globalMaxBytes: 2048 * 1024 * 1024,
    sweepIntervalMs: 60 * 1000,
};

/** Parse a positive integer env var, falling back when unset or invalid. */
function positiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Resolve the session limits from the environment (`.env.dist` documents the
 * knobs). Invalid or non-positive values fall back to the defaults.
 */
export function getLimitsFromEnv(env: NodeJS.ProcessEnv = process.env): PreviewSessionLimits {
    const d = DEFAULT_PREVIEW_SESSION_LIMITS;
    return {
        ttlMs: positiveInt(env.PREVIEW_SESSION_TTL_MINUTES, d.ttlMs / 60_000) * 60_000,
        maxSessionsPerUser: positiveInt(env.PREVIEW_MAX_SESSIONS_PER_USER, d.maxSessionsPerUser),
        maxFilesPerSession: positiveInt(env.PREVIEW_MAX_FILES_PER_SESSION, d.maxFilesPerSession),
        maxBytesPerSession:
            positiveInt(env.PREVIEW_MAX_BYTES_PER_SESSION_MB, d.maxBytesPerSession / (1024 * 1024)) * 1024 * 1024,
        maxAssetBytes: positiveInt(env.PREVIEW_MAX_ASSET_BYTES_MB, d.maxAssetBytes / (1024 * 1024)) * 1024 * 1024,
        globalMaxBytes: positiveInt(env.PREVIEW_GLOBAL_MAX_BYTES_MB, d.globalMaxBytes / (1024 * 1024)) * 1024 * 1024,
        sweepIntervalMs: d.sweepIntervalMs,
    };
}

interface PreviewSessionDeps {
    limits: PreviewSessionLimits;
    now: () => number;
}

function buildDefaultDeps(): PreviewSessionDeps {
    return {
        limits: getLimitsFromEnv(process.env),
        now: () => Date.now(),
    };
}

let deps: PreviewSessionDeps = buildDefaultDeps();

const sessions = new Map<string, PreviewSession>();
/** Sum of documentBytes + assetBytes across every session. */
let globalBytes = 0;
let sweeper: ReturnType<typeof setInterval> | null = null;

export function configure(newDeps: Partial<PreviewSessionDeps>): void {
    deps = { ...deps, ...newDeps };
}

/**
 * Restore default dependencies AND clear all sessions and the sweeper timer.
 * Spec `afterEach` relies on this leaving no cross-test state behind.
 */
export function resetDependencies(): void {
    deps = buildDefaultDeps();
    sessions.clear();
    globalBytes = 0;
    stopPreviewSessionSweeper();
}

export function getStats(): { sessions: number; globalBytes: number } {
    return { sessions: sessions.size, globalBytes };
}

/** The limits currently in effect (route handlers advertise and enforce them). */
export function getLimits(): PreviewSessionLimits {
    return deps.limits;
}

/** Bytes a session currently holds against `maxBytesPerSession`. */
export function sessionBytes(session: PreviewSession): number {
    return session.documentBytes + session.assetBytes;
}

function removeSession(session: PreviewSession): void {
    globalBytes -= sessionBytes(session);
    sessions.delete(session.id);
}

/** The session with the oldest lastAccessAt among `candidates`. */
function lruOf(candidates: Iterable<PreviewSession>): PreviewSession | null {
    let lru: PreviewSession | null = null;
    for (const session of candidates) {
        if (!lru || session.lastAccessAt < lru.lastAccessAt) lru = session;
    }
    return lru;
}

export function createSession(ownerUserId: number): { previewId: string } {
    const owned = [...sessions.values()].filter(s => s.ownerUserId === ownerUserId);
    if (owned.length >= deps.limits.maxSessionsPerUser) {
        const lru = lruOf(owned);
        if (lru) removeSession(lru);
    }
    const now = deps.now();
    const session: PreviewSession = {
        id: crypto.randomUUID(),
        ownerUserId,
        revision: 0,
        documents: new Map(),
        assetRefs: new Map(),
        fixedRefs: new Map(),
        assets: new Map(),
        assetBytes: 0,
        documentBytes: 0,
        createdAt: now,
        lastAccessAt: now,
    };
    sessions.set(session.id, session);
    return { previewId: session.id };
}

export type OwnershipResult = { session: PreviewSession } | { status: 403 | 404 };

export function getOwnedSession(previewId: string, ownerUserId: number): OwnershipResult {
    const session = sessions.get(previewId);
    if (!session) return { status: 404 };
    if (session.ownerUserId !== ownerUserId) return { status: 403 };
    session.lastAccessAt = deps.now();
    return { session };
}

/** Lookup for the authless serving route; touches the LRU clock. */
export function getSessionForServing(previewId: string): PreviewSession | null {
    const session = sessions.get(previewId);
    if (!session) return null;
    session.lastAccessAt = deps.now();
    return session;
}

export function deleteSession(previewId: string): boolean {
    const session = sessions.get(previewId);
    if (!session) return false;
    removeSession(session);
    return true;
}

export function sweepExpired(now: number = deps.now()): number {
    let swept = 0;
    for (const session of [...sessions.values()]) {
        if (now - session.lastAccessAt > deps.limits.ttlMs) {
            removeSession(session);
            swept++;
        }
    }
    return swept;
}

/**
 * Evict other sessions (never `current`) in LRU order until `incomingBytes`
 * fits the global budget. Returns false when it cannot fit even with every
 * other session evicted.
 */
function evictOthersForBudget(current: PreviewSession, incomingBytes: number): boolean {
    const budget = deps.limits.globalMaxBytes;
    while (globalBytes + incomingBytes > budget) {
        const lru = lruOf([...sessions.values()].filter(s => s.id !== current.id));
        if (!lru) return false;
        removeSession(lru);
    }
    return true;
}

// =============================================================================
// Assets (layer 2)
// =============================================================================

/**
 * `assetKey` wire format: `{assetId}@{contentHashPrefix}` — a 36-char UUID-like
 * id plus 8–64 hex chars of the content hash the project model already stores.
 * The server validates the shape and treats the key as opaque; it never hashes.
 */
export const ASSET_KEY_RE = /^[0-9a-fA-F-]{36}@[0-9a-f]{8,64}$/;

export interface AssetUploadEntry {
    key: string;
    declaredSize: number;
    bytes: Uint8Array;
}

export interface StoreAssetsResult {
    stored: string[];
    alreadyStored: string[];
    rejected: Array<{ key: string; reason: string }>;
}

/**
 * Store uploaded assets. Keys are immutable: an existing key is reported in
 * `alreadyStored` and its bytes are NOT replaced (replaced author files get a
 * new key because their content hash changed — different bytes can never hide
 * behind an existing identity). Per-entry failures land in `rejected` with a
 * reason; the whole call is synchronous (bytes arrive pre-buffered), so a
 * concurrent `getFile` never observes a half-stored batch.
 */
export function storeAssets(session: PreviewSession, entries: AssetUploadEntry[]): StoreAssetsResult {
    const limits = deps.limits;
    const stored: string[] = [];
    const alreadyStored: string[] = [];
    const rejected: Array<{ key: string; reason: string }> = [];

    for (const entry of entries) {
        const key = entry.key ?? '';
        if (!ASSET_KEY_RE.test(key)) {
            rejected.push({ key, reason: 'invalid-key' });
            continue;
        }
        if (session.assets.has(key)) {
            alreadyStored.push(key);
            continue;
        }
        if (entry.declaredSize !== entry.bytes.length) {
            rejected.push({ key, reason: 'size-mismatch' });
            continue;
        }
        if (entry.bytes.length > limits.maxAssetBytes) {
            rejected.push({ key, reason: 'asset-too-large' });
            continue;
        }
        if (sessionBytes(session) + entry.bytes.length > limits.maxBytesPerSession) {
            rejected.push({ key, reason: 'session-budget-exceeded' });
            continue;
        }
        if (!evictOthersForBudget(session, entry.bytes.length)) {
            rejected.push({ key, reason: 'global-budget-exceeded' });
            continue;
        }
        session.assets.set(key, entry.bytes);
        session.assetBytes += entry.bytes.length;
        globalBytes += entry.bytes.length;
        stored.push(key);
    }

    return { stored, alreadyStored, rejected };
}

// =============================================================================
// Revisions (layer 3 publication)
// =============================================================================

/** Minimal fixed-resource surface `applyRevision` validates against. */
export interface FixedResourceLookup {
    hasResource(id: string): boolean;
}

/** Full resolver surface `getFile` reads the fixed layer through. */
export interface FixedResourceResolver extends FixedResourceLookup {
    getResource(id: string): { bytes: Uint8Array; size: number } | null;
}

export interface RevisionMeta {
    baseRevision: number;
    nextRevision: number;
    writes: Array<{ path: string; bytes: Uint8Array }>;
    deletes: string[];
    /** FULL replacement map: served path → assetKey. */
    assetRefs: Record<string, string>;
    /** FULL replacement map: served path → fixedResourceId. */
    fixedRefs: Record<string, string>;
}

export type ApplyRevisionResult =
    | { revision: number; active: true }
    | { status: 400 | 413; message: string }
    | { status: 409; currentRevision: number }
    | { status: 422; reason: 'missing-assets'; missing: string[] }
    | { status: 422; reason: 'unknown-fixed-resources'; resources: string[] };

/**
 * Publish a revision. Validation order per the contract: revision check (409)
 * → path normalization (400) → asset existence (422) → fixed-resource
 * existence (422) → file-count / byte budgets (413). All mutations happen in
 * one synchronous block at the end — no awaits — so a concurrent `getFile`
 * observes revision N or N+1 in full, never a mixture, and a failed apply
 * leaves revision N completely intact.
 */
export function applyRevision(
    session: PreviewSession,
    meta: RevisionMeta,
    fixedResources: FixedResourceLookup,
): ApplyRevisionResult {
    const limits = deps.limits;

    // 1. Revision ordering: stale base or non-consecutive next → conflict.
    if (meta.baseRevision !== session.revision || meta.nextRevision !== session.revision + 1) {
        return { status: 409, currentRevision: session.revision };
    }

    // 2. Normalize every client-supplied path (writes, deletes, both ref-map
    //    key sets). Any unsafe path rejects the whole revision.
    const writes = new Map<string, Uint8Array>();
    for (const write of meta.writes) {
        const normalized = normalizeContentPath(write.path);
        if (normalized === null) return { status: 400, message: `Unsafe path in writes: ${write.path}` };
        writes.set(normalized, write.bytes);
    }
    const deletes: string[] = [];
    for (const rawPath of meta.deletes) {
        const normalized = normalizeContentPath(rawPath);
        if (normalized === null) return { status: 400, message: `Unsafe path in deletes: ${rawPath}` };
        deletes.push(normalized);
    }
    const assetRefs = new Map<string, string>();
    for (const [rawPath, key] of Object.entries(meta.assetRefs ?? {})) {
        const normalized = normalizeContentPath(rawPath);
        if (normalized === null) return { status: 400, message: `Unsafe path in assetRefs: ${rawPath}` };
        assetRefs.set(normalized, key);
    }
    const fixedRefs = new Map<string, string>();
    for (const [rawPath, id] of Object.entries(meta.fixedRefs ?? {})) {
        const normalized = normalizeContentPath(rawPath);
        if (normalized === null) return { status: 400, message: `Unsafe path in fixedRefs: ${rawPath}` };
        fixedRefs.set(normalized, id);
    }

    // 3. Every referenced asset must exist in the session store (a malformed
    //    key cannot exist, so it reports as missing too).
    const missing = [...new Set([...assetRefs.values()].filter(key => !session.assets.has(key)))];
    if (missing.length > 0) {
        return { status: 422, reason: 'missing-assets', missing };
    }

    // 4. Every referenced fixed resource must be manifest-listed.
    const unknown = [...new Set([...fixedRefs.values()].filter(id => !fixedResources.hasResource(id)))];
    if (unknown.length > 0) {
        return { status: 422, reason: 'unknown-fixed-resources', resources: unknown };
    }

    // 5. Budgets, computed on the post-delta state without mutating anything.
    //    Deltas apply deletes first, then writes (a path in both is a write).
    let documentCount = session.documents.size;
    let documentBytes = session.documentBytes;
    const affected = new Map<string, Uint8Array | null>();
    for (const del of deletes) affected.set(del, null);
    for (const [writePath, bytes] of writes) affected.set(writePath, bytes);
    for (const [affectedPath, newBytes] of affected) {
        const oldSize = session.documents.get(affectedPath)?.length;
        if (newBytes === null) {
            if (oldSize !== undefined) {
                documentCount--;
                documentBytes -= oldSize;
            }
        } else if (oldSize !== undefined) {
            documentBytes += newBytes.length - oldSize;
        } else {
            documentCount++;
            documentBytes += newBytes.length;
        }
    }
    const fileCount = documentCount + assetRefs.size + fixedRefs.size;
    if (fileCount > limits.maxFilesPerSession) {
        return { status: 413, message: `Too many files (max ${limits.maxFilesPerSession})` };
    }
    if (documentBytes + session.assetBytes > limits.maxBytesPerSession) {
        return { status: 413, message: `Session over byte budget (max ${limits.maxBytesPerSession} bytes)` };
    }
    const byteDelta = documentBytes - session.documentBytes;
    if (byteDelta > 0 && !evictOthersForBudget(session, byteDelta)) {
        return { status: 413, message: 'Preview storage budget exceeded' };
    }

    // 6. Publish: one synchronous block (no awaits) — deletes, then writes,
    //    then wholesale ref-map replacement, then the revision bump.
    for (const del of deletes) {
        const existing = session.documents.get(del);
        if (existing !== undefined && !writes.has(del)) {
            session.documents.delete(del);
            session.documentBytes -= existing.length;
            globalBytes -= existing.length;
        }
    }
    for (const [writePath, bytes] of writes) {
        const existing = session.documents.get(writePath);
        if (existing !== undefined) {
            session.documentBytes -= existing.length;
            globalBytes -= existing.length;
        }
        session.documents.set(writePath, bytes);
        session.documentBytes += bytes.length;
        globalBytes += bytes.length;
    }
    session.assetRefs = assetRefs;
    session.fixedRefs = fixedRefs;
    session.revision = meta.nextRevision;

    return { revision: session.revision, active: true };
}

// =============================================================================
// Serving (three-layer resolution)
// =============================================================================

export type PreviewFile =
    | { kind: 'document'; bytes: Uint8Array; contentType: string; isScriptable: boolean }
    | { kind: 'asset'; bytes: Uint8Array; contentType: string; isScriptable: boolean; etag: string }
    | { kind: 'fixed'; bytes: Uint8Array; contentType: string; isScriptable: boolean };

/**
 * Resolve a served path against the active revision: documents →
 * assetRefs→assets → fixedRefs→manifest → null. Unsafe paths and sessions
 * without a published revision (revision 0) resolve to null for everything.
 */
export function getFile(
    session: PreviewSession,
    rawPath: string,
    fixedResources: FixedResourceResolver,
): PreviewFile | null {
    if (session.revision === 0) return null;
    const path = normalizeContentPath(rawPath);
    if (path === null) return null;
    const contentType = contentTypeFor(path);
    const isScriptable = isScriptableDocumentType(contentType);

    const document = session.documents.get(path);
    if (document !== undefined) {
        return { kind: 'document', bytes: document, contentType, isScriptable };
    }

    const assetKey = session.assetRefs.get(path);
    if (assetKey !== undefined) {
        const bytes = session.assets.get(assetKey);
        if (bytes !== undefined) {
            return { kind: 'asset', bytes, contentType, isScriptable, etag: assetKey };
        }
    }

    const fixedId = session.fixedRefs.get(path);
    if (fixedId !== undefined) {
        const resource = fixedResources.getResource(fixedId);
        if (resource !== null) {
            return { kind: 'fixed', bytes: resource.bytes, contentType, isScriptable };
        }
    }

    return null;
}

/**
 * Start the idle-session sweeper. Idempotent: calling it again replaces any
 * existing timer. The orchestrator (src/index.ts) starts it at boot and stops
 * it in gracefulShutdown.
 */
export function startPreviewSessionSweeper(intervalMs: number = deps.limits.sweepIntervalMs): void {
    stopPreviewSessionSweeper();
    sweeper = setInterval(() => {
        sweepExpired();
    }, intervalMs);
    // Do not keep the process alive solely for this timer.
    if (typeof sweeper.unref === 'function') {
        sweeper.unref();
    }
}

export function stopPreviewSessionSweeper(): void {
    if (sweeper) {
        clearInterval(sweeper);
        sweeper = null;
    }
}
