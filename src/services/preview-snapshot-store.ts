/**
 * In-memory store for opaque preview snapshots (capability-URL serving).
 *
 * A snapshot is a complete, self-contained preview export (the same file map
 * the Service Worker preview consumes) uploaded by an authenticated editor
 * session and served back — cookieless and authless — to a sandboxed iframe
 * under `/preview-snapshot/{previewId}/*`. The unguessable `previewId` (128
 * bits, crypto-random, server-minted) IS the authorization: whoever holds the
 * URL may read the snapshot until it expires.
 *
 * This is a deliberately minimal subset of the maximal opaque-preview branch's
 * session manager (fix/opaque-iframe-external-media): one flat file map per
 * snapshot, full replacement on every update, no layers, no revisions, no
 * providers. Replacement is atomic by construction — the new file map is fully
 * materialized before a single synchronous swap, so a concurrent read can
 * never observe a torn snapshot (Bun runs JS on one thread; there is no await
 * between removing the old map and publishing the new one).
 *
 * Lifecycle: sliding idle TTL renewed on management writes only (serving does
 * NOT renew — an abandoned-but-open preview should die), plus an absolute cap
 * counted from creation. Expired snapshots are never served (checked lazily on
 * every access) and their memory is reclaimed by `sweepExpired()`, which runs
 * on every management write and is exposed for periodic invocation.
 */
import { randomBytes } from 'node:crypto';
import * as fflate from 'fflate';
import { contentTypeFor, normalizeContentPath } from '../utils/content-path.util';
import { isScriptableDocumentType } from '../shared/security/previewSandbox';

export interface PreviewSnapshot {
    id: string;
    ownerUserId: number;
    files: Map<string, Uint8Array>;
    totalBytes: number;
    /** Creation timestamp (ms) — anchors the absolute TTL cap. */
    createdAt: number;
    /** Last management write (ms) — anchors the sliding idle TTL. */
    touchedAt: number;
}

export interface PreviewSnapshotLimits {
    /** Sliding idle TTL: expiry after this long without a management write. */
    idleTtlMs: number;
    /** Absolute cap: expiry this long after creation, regardless of writes. */
    absoluteTtlMs: number;
    /** Active snapshots per user; the oldest is evicted beyond this. */
    maxSnapshotsPerUser: number;
    /** Maximum total uncompressed bytes per snapshot. */
    maxSnapshotBytes: number;
    /** Maximum number of files per snapshot. */
    maxFilesPerSnapshot: number;
}

/**
 * Snapshot byte cap follows the server upload limit (`MAX_UPLOAD_SIZE`, same
 * semantics as `src/routes/convert.ts`): a preview snapshot is the same
 * content the user could export/upload, so it gets the same ceiling.
 */
function defaultMaxSnapshotBytes(): number {
    const envSize = process.env.MAX_UPLOAD_SIZE;
    if (envSize) {
        if (envSize.endsWith('M')) return parseInt(envSize, 10) * 1024 * 1024;
        return parseInt(envSize, 10);
    }
    return 100 * 1024 * 1024; // 100 MB
}

export function getLimits(): PreviewSnapshotLimits {
    return {
        idleTtlMs: 30 * 60 * 1000, // 30 minutes idle
        absoluteTtlMs: 8 * 60 * 60 * 1000, // 8 hours hard cap
        maxSnapshotsPerUser: 2,
        maxSnapshotBytes: defaultMaxSnapshotBytes(),
        maxFilesPerSnapshot: 10000,
    };
}

interface Deps {
    now: () => number;
    /** Mints a 128-bit crypto-random capability id (32 lowercase hex chars). */
    randomId: () => string;
    /** Interval scheduler (injectable so sweeper tests need no real timers). */
    scheduleInterval: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
}

const defaultDeps: Deps = {
    now: () => Date.now(),
    randomId: () => randomBytes(16).toString('hex'),
    scheduleInterval: (fn, ms) => setInterval(fn, ms),
};

let deps: Deps = defaultDeps;

export function configure(newDeps: Partial<Deps>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetDependencies(): void {
    deps = defaultDeps;
}

/** Capability id shape: exactly 32 lowercase hex characters (128 bits). */
export const PREVIEW_ID_RE = /^[0-9a-f]{32}$/;

const snapshots = new Map<string, PreviewSnapshot>();

function isExpired(snapshot: PreviewSnapshot, now: number): boolean {
    const limits = getLimits();
    return now - snapshot.touchedAt > limits.idleTtlMs || now - snapshot.createdAt > limits.absoluteTtlMs;
}

/** Drop every expired snapshot; returns how many were reclaimed. */
export function sweepExpired(): number {
    const now = deps.now();
    let removed = 0;
    for (const [id, snapshot] of snapshots) {
        if (isExpired(snapshot, now)) {
            snapshots.delete(id);
            removed++;
        }
    }
    return removed;
}

export type UnpackResult = { files: Map<string, Uint8Array> } | { status: 400 | 413; error: string };

/**
 * Unpack the wire-format snapshot archive (the ZIP `EmbeddedPreviewSnapshot`
 * emits) into a normalized path → bytes map.
 *
 * Byte and entry-count caps are enforced in fflate's pre-inflation `filter`
 * against the declared sizes (the same zip-bomb guard and documented
 * declared-size limitation as `ElpxImporter.safeUnzip`), and re-checked
 * against actual inflated bytes afterwards. Any entry whose path escapes the
 * snapshot root rejects the whole archive — a snapshot with unservable
 * entries is malformed, not partially valid.
 */
export function unpackSnapshotArchive(buffer: Uint8Array): UnpackResult {
    const limits = getLimits();
    let declaredBytes = 0;
    let entryCount = 0;
    let unpacked: Record<string, Uint8Array>;
    try {
        unpacked = fflate.unzipSync(buffer, {
            filter: (entry: { name: string; originalSize: number }) => {
                if (entry.name.endsWith('/')) return false; // directory entry
                entryCount++;
                if (entryCount > limits.maxFilesPerSnapshot) {
                    throw new SnapshotLimitError('Snapshot exceeds the maximum number of files');
                }
                declaredBytes += entry.originalSize;
                if (declaredBytes > limits.maxSnapshotBytes) {
                    throw new SnapshotLimitError('Snapshot exceeds the maximum allowed size');
                }
                return true;
            },
        });
    } catch (error) {
        if (error instanceof SnapshotLimitError) return { status: 413, error: error.message };
        return { status: 400, error: 'Snapshot archive is not a valid ZIP file' };
    }

    const files = new Map<string, Uint8Array>();
    let actualBytes = 0;
    for (const [rawPath, bytes] of Object.entries(unpacked)) {
        const normalized = normalizeContentPath(rawPath);
        if (normalized === null) {
            return { status: 400, error: `Snapshot entry has an unsafe path: ${rawPath}` };
        }
        actualBytes += bytes.length;
        if (actualBytes > limits.maxSnapshotBytes) {
            return { status: 413, error: 'Snapshot exceeds the maximum allowed size' };
        }
        files.set(normalized, bytes);
    }
    return { files };
}

class SnapshotLimitError extends Error {}

export type CreateOrReplaceResult =
    | { snapshot: PreviewSnapshot }
    | { status: 403; error: string }
    | { status: 413; error: string };

/**
 * Create a snapshot, or replace an existing one's contents in place.
 *
 * Replace semantics: a known, owned, live `previewId` keeps its id (the
 * client's iframe URL stays valid) and renews the idle TTL; an unknown or
 * expired id falls through to CREATE with a freshly minted id — the client
 * treats the returned `previewId` as authoritative, so an expired snapshot
 * self-heals on the next refresh. A client-supplied id is never honored for
 * creation: capability ids are exclusively server-minted. A live id owned by
 * another user is refused (403) rather than silently rebound.
 */
export function createOrReplace(
    ownerUserId: number,
    previewId: string | null,
    files: Map<string, Uint8Array>,
): CreateOrReplaceResult {
    sweepExpired();
    const limits = getLimits();
    let totalBytes = 0;
    for (const bytes of files.values()) totalBytes += bytes.length;
    if (totalBytes > limits.maxSnapshotBytes) {
        return { status: 413, error: 'Snapshot exceeds the maximum allowed size' };
    }
    if (files.size > limits.maxFilesPerSnapshot) {
        return { status: 413, error: 'Snapshot exceeds the maximum number of files' };
    }

    const now = deps.now();
    const existing = previewId ? snapshots.get(previewId) : undefined;
    if (existing && !isExpired(existing, now)) {
        if (existing.ownerUserId !== ownerUserId) {
            return { status: 403, error: 'Access denied' };
        }
        // Atomic in-place replace: single synchronous field swap, no await.
        existing.files = files;
        existing.totalBytes = totalBytes;
        existing.touchedAt = now;
        return { snapshot: existing };
    }

    // Per-user quota: evict the least-recently-touched snapshot beyond the cap.
    const owned = [...snapshots.values()]
        .filter(s => s.ownerUserId === ownerUserId)
        .sort((a, b) => a.touchedAt - b.touchedAt);
    while (owned.length >= limits.maxSnapshotsPerUser) {
        const evicted = owned.shift();
        if (evicted) snapshots.delete(evicted.id);
    }

    const snapshot: PreviewSnapshot = {
        id: deps.randomId(),
        ownerUserId,
        files,
        totalBytes,
        createdAt: now,
        touchedAt: now,
    };
    snapshots.set(snapshot.id, snapshot);
    return { snapshot };
}

export type OwnedSnapshotResult = { snapshot: PreviewSnapshot } | { status: 403 } | { status: 404 };

/** Owner-gated lookup for management routes (DELETE). Expiry-checked. */
export function getOwned(previewId: string, ownerUserId: number): OwnedSnapshotResult {
    const snapshot = snapshots.get(previewId);
    if (!snapshot || isExpired(snapshot, deps.now())) return { status: 404 };
    if (snapshot.ownerUserId !== ownerUserId) return { status: 403 };
    return { snapshot };
}

/**
 * Authless lookup for the serving route. Expiry-checked; does NOT renew the
 * idle TTL — only management writes keep a snapshot alive.
 */
export function getForServing(previewId: string): PreviewSnapshot | null {
    if (!PREVIEW_ID_RE.test(previewId)) return null;
    const snapshot = snapshots.get(previewId);
    if (!snapshot || isExpired(snapshot, deps.now())) return null;
    return snapshot;
}

export function deleteSnapshot(previewId: string): boolean {
    return snapshots.delete(previewId);
}

export interface ServedFile {
    bytes: Uint8Array;
    contentType: string;
    isScriptable: boolean;
}

/** Resolve a requested path inside a snapshot (traversal-safe, exact match). */
export function getFile(snapshot: PreviewSnapshot, relPath: string): ServedFile | null {
    const normalized = normalizeContentPath(relPath);
    if (normalized === null) return null;
    const bytes = snapshot.files.get(normalized);
    if (!bytes) return null;
    const contentType = contentTypeFor(normalized);
    return { bytes, contentType, isScriptable: isScriptableDocumentType(contentType) };
}

/**
 * Start the periodic expiry sweep. Expired snapshots are already never served
 * (every getter checks lazily); the sweeper guarantees their memory is also
 * reclaimed when no management write ever comes back. Returns a stop
 * function. The timer is unref'd so it never keeps the process alive.
 */
export function startSweeper(intervalMs: number = 10 * 60 * 1000): () => void {
    const timer = deps.scheduleInterval(() => sweepExpired(), intervalMs);
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) timer.unref();
    return () => clearInterval(timer);
}

/** Test-only: wipe all snapshots. */
export function clearAllForTests(): void {
    snapshots.clear();
}

/** Number of live (non-expired) snapshots — used by tests and diagnostics. */
export function liveCount(): number {
    const now = deps.now();
    return [...snapshots.values()].filter(s => !isExpired(s, now)).length;
}
