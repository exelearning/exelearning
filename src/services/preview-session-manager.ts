/**
 * Editor preview sessions: ephemeral, in-memory storage for the opaque preview.
 *
 * The editor generates preview files client-side and syncs them here via a
 * manifest-diff protocol (stage a path→sha256 manifest, upload only the blobs
 * the server lacks); the authless `/preview/{previewId}/*` route then serves
 * them to the opaque-origin preview iframe, which cannot send SameSite cookies.
 * Blobs are content-addressed per session, and every uploaded blob is
 * re-hashed server-side, so a forged declared hash can only disqualify itself
 * — it can never poison another path's content.
 *
 * Sessions are process-local and intentionally NOT persisted: they die on
 * restart and the client transparently recreates them on the next refresh (any
 * 404 from the API or the serving route triggers a re-sync). Deployments that
 * run multiple instances behind a load balancer need sticky sessions for the
 * preview routes — the same limitation class as the other in-memory managers.
 */
import { contentTypeFor, normalizeContentPath } from '../utils/content-path.util';

export interface PreviewManifestEntry {
    sha256: string;
    size: number;
}

export interface PreviewManifest {
    /** Normalized path → entry. Frozen after the swap; never mutated. */
    files: Map<string, PreviewManifestEntry>;
    totalBytes: number;
}

interface PendingManifest {
    manifestId: string;
    files: Map<string, PreviewManifestEntry>;
    /** Hashes declared by the manifest that the blob store does not hold yet. */
    missing: Set<string>;
}

export interface PreviewSession {
    id: string;
    ownerUserId: number;
    /** Content-addressed blob store: sha256 → bytes. */
    blobs: Map<string, Uint8Array>;
    blobBytes: number;
    activeManifest: PreviewManifest | null;
    pending: PendingManifest | null;
    createdAt: number;
    lastAccessAt: number;
}

export interface PreviewSessionLimits {
    ttlMs: number;
    maxSessionsPerUser: number;
    maxFilesPerSession: number;
    maxBytesPerSession: number;
    globalMaxBytes: number;
    sweepIntervalMs: number;
}

export const DEFAULT_PREVIEW_SESSION_LIMITS: PreviewSessionLimits = {
    ttlMs: 30 * 60 * 1000,
    maxSessionsPerUser: 4,
    maxFilesPerSession: 5000,
    maxBytesPerSession: 200 * 1024 * 1024,
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
        globalMaxBytes: positiveInt(env.PREVIEW_GLOBAL_MAX_BYTES_MB, d.globalMaxBytes / (1024 * 1024)) * 1024 * 1024,
        sweepIntervalMs: d.sweepIntervalMs,
    };
}

interface PreviewSessionDeps {
    limits: PreviewSessionLimits;
    now: () => number;
    sha256: (bytes: Uint8Array) => Promise<string>;
}

async function defaultSha256(bytes: Uint8Array): Promise<string> {
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(bytes);
    return hasher.digest('hex');
}

function buildDefaultDeps(): PreviewSessionDeps {
    return {
        limits: getLimitsFromEnv(process.env),
        now: () => Date.now(),
        sha256: defaultSha256,
    };
}

let deps: PreviewSessionDeps = buildDefaultDeps();

const sessions = new Map<string, PreviewSession>();
let globalBlobBytes = 0;
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
    globalBlobBytes = 0;
    stopPreviewSessionSweeper();
}

export function getStats(): { sessions: number; globalBytes: number } {
    return { sessions: sessions.size, globalBytes: globalBlobBytes };
}

/** The limits currently in effect (route handlers advertise and enforce them). */
export function getLimits(): PreviewSessionLimits {
    return deps.limits;
}

function removeSession(session: PreviewSession): void {
    globalBlobBytes -= session.blobBytes;
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
        blobs: new Map(),
        blobBytes: 0,
        activeManifest: null,
        pending: null,
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

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

export type StageResult =
    | { manifestId: string; missing: string[]; active: boolean }
    | { status: 400 | 413; message: string };

/**
 * Stage a new manifest for the session. Paths are normalized (traversal →
 * 400), caps enforced (→ 413), and the returned `missing` lists the hashes the
 * blob store does not hold. When nothing is missing the manifest is promoted
 * immediately; otherwise it replaces any previously pending manifest (the
 * debounced editor refresh means the latest staged manifest always wins).
 */
export function stageManifest(session: PreviewSession, files: Record<string, PreviewManifestEntry>): StageResult {
    const limits = deps.limits;
    const entries = Object.entries(files ?? {});
    if (entries.length === 0) {
        return { status: 400, message: 'Manifest is empty' };
    }
    if (entries.length > limits.maxFilesPerSession) {
        return { status: 413, message: `Too many files (max ${limits.maxFilesPerSession})` };
    }

    const normalized = new Map<string, PreviewManifestEntry>();
    let totalBytes = 0;
    for (const [rawPath, entry] of entries) {
        const path = normalizeContentPath(rawPath);
        if (path === null) {
            return { status: 400, message: `Unsafe path in manifest: ${rawPath}` };
        }
        const sha256 = typeof entry?.sha256 === 'string' ? entry.sha256.toLowerCase() : '';
        if (!SHA256_HEX_RE.test(sha256)) {
            return { status: 400, message: `Invalid sha256 for ${rawPath}` };
        }
        const size = entry.size;
        if (!Number.isFinite(size) || size < 0) {
            return { status: 400, message: `Invalid size for ${rawPath}` };
        }
        normalized.set(path, { sha256, size });
        totalBytes += size;
    }
    if (totalBytes > limits.maxBytesPerSession) {
        return { status: 413, message: `Manifest too large (max ${limits.maxBytesPerSession} bytes)` };
    }

    const missing = new Set<string>();
    for (const entry of normalized.values()) {
        if (!session.blobs.has(entry.sha256)) missing.add(entry.sha256);
    }

    const manifestId = crypto.randomUUID();
    if (missing.size === 0) {
        promote(session, { manifestId, files: normalized, missing });
        return { manifestId, missing: [], active: true };
    }
    session.pending = { manifestId, files: normalized, missing };
    return { manifestId, missing: [...missing], active: false };
}

/** Swap the active manifest reference and reclaim unreferenced blobs. */
function promote(session: PreviewSession, pending: PendingManifest): void {
    session.activeManifest = Object.freeze({
        files: pending.files,
        totalBytes: [...pending.files.values()].reduce((sum, e) => sum + e.size, 0),
    });
    session.pending = null;
    collectUnreferencedBlobs(session);
}

function collectUnreferencedBlobs(session: PreviewSession): void {
    const referenced = new Set<string>();
    if (session.activeManifest) {
        for (const entry of session.activeManifest.files.values()) referenced.add(entry.sha256);
    }
    if (session.pending) {
        for (const entry of session.pending.files.values()) referenced.add(entry.sha256);
    }
    for (const [hash, bytes] of session.blobs) {
        if (!referenced.has(hash)) {
            session.blobs.delete(hash);
            session.blobBytes -= bytes.length;
            globalBlobBytes -= bytes.length;
        }
    }
}

export type StoreBlobsResult =
    | { stored: string[]; mismatched: string[]; active: boolean }
    | { status: 400 | 409 | 413; message: string };

/**
 * Store uploaded blobs against the pending manifest.
 *
 * Every blob is re-hashed server-side; entries whose recomputed hash differs
 * from the declared one are quarantined in `mismatched` and dropped. All
 * hashing (the only awaits) happens before any mutation, and the mutations run
 * in one synchronous block, so a concurrent `getFile` always observes either
 * the previous manifest or the fully promoted new one — never a half state.
 */
export async function storeBlobs(
    session: PreviewSession,
    manifestId: string,
    blobs: Array<{ declaredSha256: string; bytes: Uint8Array }>,
): Promise<StoreBlobsResult> {
    if (!session.pending || session.pending.manifestId !== manifestId) {
        return { status: 409, message: 'Manifest superseded' };
    }

    const hashed: Array<{ declared: string; actual: string; bytes: Uint8Array }> = [];
    for (const blob of blobs) {
        const declared = (blob.declaredSha256 ?? '').toLowerCase();
        hashed.push({ declared, actual: await deps.sha256(blob.bytes), bytes: blob.bytes });
    }

    // Re-check after the awaits: a newer manifest may have been staged while
    // hashing was in flight (the client's debounced refresh superseding this
    // upload round).
    const pending = session.pending as PendingManifest | null;
    if (!pending || pending.manifestId !== manifestId) {
        return { status: 409, message: 'Manifest superseded' };
    }

    const stored: string[] = [];
    const mismatched: string[] = [];
    const toInsert = new Map<string, Uint8Array>();
    for (const { declared, actual, bytes } of hashed) {
        if (declared !== actual) {
            mismatched.push(declared);
            continue;
        }
        if (session.blobs.has(actual) || toInsert.has(actual)) {
            stored.push(actual);
            continue;
        }
        // Blobs the pending manifest never declared are ignored silently: they
        // could only bloat the store without ever being served.
        if (!pending.missing.has(actual)) continue;
        toInsert.set(actual, bytes);
        stored.push(actual);
    }

    const incomingBytes = [...toInsert.values()].reduce((sum, b) => sum + b.length, 0);
    if (session.blobBytes + incomingBytes > deps.limits.maxBytesPerSession) {
        return { status: 413, message: `Session over byte budget (max ${deps.limits.maxBytesPerSession})` };
    }
    if (!evictOthersForBudget(session, incomingBytes)) {
        return { status: 413, message: 'Preview storage budget exceeded' };
    }

    for (const [hash, bytes] of toInsert) {
        session.blobs.set(hash, bytes);
        session.blobBytes += bytes.length;
        globalBlobBytes += bytes.length;
        pending.missing.delete(hash);
    }

    let active = false;
    if (pending.missing.size === 0) {
        promote(session, pending);
        active = true;
    }
    return { stored, mismatched, active };
}

/**
 * Evict other sessions (never `current`) in LRU order until `incomingBytes`
 * fits the global budget. Returns false when it cannot fit even with every
 * other session evicted.
 */
function evictOthersForBudget(current: PreviewSession, incomingBytes: number): boolean {
    const budget = deps.limits.globalMaxBytes;
    while (globalBlobBytes + incomingBytes > budget) {
        const lru = lruOf([...sessions.values()].filter(s => s.id !== current.id));
        if (!lru) return false;
        removeSession(lru);
    }
    return true;
}

/**
 * Resolve a file from the session's active manifest. Returns `null` for
 * unsafe paths, unknown paths, and sessions with no promoted manifest yet.
 */
export function getFile(
    session: PreviewSession,
    rawPath: string,
): { bytes: Uint8Array; contentType: string; isHtml: boolean } | null {
    const path = normalizeContentPath(rawPath);
    if (path === null) return null;
    const manifest = session.activeManifest;
    if (!manifest) return null;
    const entry = manifest.files.get(path);
    if (!entry) return null;
    const bytes = session.blobs.get(entry.sha256);
    if (!bytes) return null;
    const contentType = contentTypeFor(path);
    return { bytes, contentType, isHtml: contentType.startsWith('text/html') };
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
