/**
 * Asset storage path utilities — single source of truth for the physical
 * layout of project assets and for the portable database representation of
 * `assets.storage_path`.
 *
 * Layout (one 8-bit shard level, 256 lazy buckets — see ADR-2250-01):
 *
 *     FILES_DIR/assets/<shard>/<projectUuid>/<file...>
 *
 * Database representation: POSIX-style paths relative to FILES_DIR, always
 * starting with the `assets/` component, e.g.
 *
 *     assets/ab/ab12cd34-.../client-id.png
 *
 * Everything here is pure (no filesystem, no environment access) so the shard
 * and path grammar can be tested exhaustively. Resolution against the real
 * FILES_DIR is wrapped by `src/services/file-helper.ts`.
 */
import * as nodePath from 'path';
import { isWithinBase, UnsafePathError } from './safe-path';

/** Name of the assets root directory under FILES_DIR. */
export const ASSETS_ROOT_DIR_NAME = 'assets';

/** Canonical UUID shape (8-4-4-4-12 hex groups, any version, any case). */
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHARD_HEX_ANY_CASE = /^[0-9a-fA-F]{2}$/;

/**
 * Validates one stored-path segment. Deliberately more permissive than
 * `isSafePathSegment` because historical asset filenames legitimately contain
 * spaces, parentheses and non-ASCII characters. Only structural hazards are
 * rejected: separators, traversal tokens, control characters and emptiness.
 */
export function isSafeAssetPathSegment(segment: unknown): segment is string {
    if (typeof segment !== 'string' || segment.length === 0 || segment.length > 255) {
        return false;
    }
    if (segment === '.' || segment === '..') {
        return false;
    }
    if (segment.includes('/') || segment.includes('\\')) {
        return false;
    }
    for (let i = 0; i < segment.length; i++) {
        const code = segment.charCodeAt(i);
        if (code <= 0x1f || code === 0x7f) {
            return false;
        }
    }
    return true;
}

/** FNV-1a 32-bit hash over the UTF-8 bytes of `value`. */
function fnv1a32(value: string): number {
    let hash = 0x811c9dc5;
    const bytes = new TextEncoder().encode(value);
    for (const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
}

/**
 * Returns the two-character lowercase hex shard bucket for a project
 * identifier. Canonical UUIDs (the normal case — project UUIDs are generated
 * with `crypto.randomUUID()` / `uuid.v4()`) use their first two hex
 * characters, so the bucket is readable straight off the UUID and uniformly
 * distributed. Any other identifier (`projects.uuid` is not format-validated
 * at every creation site) falls back to a deterministic 8-bit FNV-1a hash so
 * the mapping is total and stable.
 */
export function getAssetShard(projectId: string): string {
    if (typeof projectId !== 'string' || projectId.length === 0) {
        throw new UnsafePathError('Invalid project identifier for asset shard');
    }
    if (CANONICAL_UUID.test(projectId)) {
        return projectId.slice(0, 2).toLowerCase();
    }
    return (fnv1a32(projectId) & 0xff).toString(16).padStart(2, '0');
}

/**
 * Builds the canonical stored (database) path for an asset file:
 * `assets/<shard>/<projectUuid>/<segments...>`, POSIX separators, relative to
 * FILES_DIR. At least one segment below the project directory is required.
 */
export function buildAssetStoragePath(projectUuid: string, ...segments: string[]): string {
    if (!isSafeAssetPathSegment(projectUuid)) {
        throw new UnsafePathError('Invalid project identifier in asset storage path');
    }
    if (segments.length === 0) {
        throw new UnsafePathError('Asset storage path requires at least one segment');
    }
    for (const segment of segments) {
        if (!isSafeAssetPathSegment(segment)) {
            throw new UnsafePathError('Invalid segment in asset storage path');
        }
    }
    return [ASSETS_ROOT_DIR_NAME, getAssetShard(projectUuid), projectUuid, ...segments].join('/');
}

/**
 * Returns true if `value` is a well-formed stored asset path: a relative
 * POSIX path starting with `assets/`, containing at least a project directory
 * and a filename, with only safe segments. Both the sharded form
 * (`assets/<shard>/<uuid>/...`) and the unsharded assets-relative form
 * (`assets/<uuid>/...`, used as a conservative fallback for migration
 * conflicts) are accepted — resolution does not depend on shard depth.
 */
export function isCanonicalAssetStoragePath(value: unknown): value is string {
    if (typeof value !== 'string' || value.includes('\\')) {
        return false;
    }
    const segments = value.split('/');
    if (segments.length < 3 || segments[0] !== ASSETS_ROOT_DIR_NAME) {
        return false;
    }
    return segments.slice(1).every(isSafeAssetPathSegment);
}

/**
 * Extracts the assets-relative segments from a legacy stored value (an
 * absolute host path written by versions before the relative-path migration,
 * with either POSIX or Windows separators). Uses the LAST `assets` path
 * component that yields a valid suffix — backtracking to earlier components
 * covers files literally named `assets` — and requires at least two suffix
 * segments (a project directory plus a filename), so a value can never
 * resolve to a whole bucket or project directory. Returns null when no safe
 * interpretation exists. The absolute prefix is deliberately ignored: it
 * refers to whatever FILES_DIR was when the row was written.
 */
export function extractAssetsRelativeSegments(storedPath: string): string[] | null {
    if (typeof storedPath !== 'string' || storedPath.length === 0) {
        return null;
    }
    const segments = storedPath.split(/[\\/]/);
    // A trailing separator produces one empty trailing segment; drop it.
    if (segments.length > 0 && segments[segments.length - 1] === '') {
        segments.pop();
    }
    let assetsIndex = segments.lastIndexOf(ASSETS_ROOT_DIR_NAME);
    while (assetsIndex !== -1) {
        const suffix = segments.slice(assetsIndex + 1);
        if (suffix.length >= 2 && suffix.every(isSafeAssetPathSegment)) {
            return suffix;
        }
        if (assetsIndex === 0) {
            break;
        }
        assetsIndex = segments.lastIndexOf(ASSETS_ROOT_DIR_NAME, assetsIndex - 1);
    }
    return null;
}

/**
 * Resolves a stored `assets.storage_path` value to an absolute filesystem
 * path under `filesDir`. Canonical relative values resolve directly; legacy
 * absolute values are re-rooted under the current FILES_DIR via their
 * `assets/...` suffix (transitional read fallback — see ADR-2250-01). Throws
 * {@link UnsafePathError} when the value cannot be interpreted safely or the
 * result would escape `FILES_DIR/assets`.
 */
export function resolveAssetStoragePath(filesDir: string, storedPath: string): string {
    let segments: string[];
    if (isCanonicalAssetStoragePath(storedPath)) {
        segments = storedPath.split('/').slice(1);
    } else {
        const extracted = extractAssetsRelativeSegments(storedPath);
        if (!extracted) {
            throw new UnsafePathError('Stored asset path cannot be resolved under FILES_DIR/assets');
        }
        segments = extracted;
    }
    const assetsRoot = nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME);
    const resolved = nodePath.join(assetsRoot, ...segments);
    if (resolved === nodePath.resolve(assetsRoot) || !isWithinBase(assetsRoot, resolved)) {
        throw new UnsafePathError('Resolved asset path escapes FILES_DIR/assets');
    }
    return resolved;
}

/**
 * Non-throwing variant of {@link resolveAssetStoragePath}: returns null for
 * values that cannot be resolved. Intended for read paths where an
 * unresolvable stored value should behave like a missing file.
 */
export function tryResolveAssetStoragePath(filesDir: string, storedPath: string): string | null {
    try {
        return resolveAssetStoragePath(filesDir, storedPath);
    } catch {
        return null;
    }
}

/**
 * Derives the canonical sharded stored path (`assets/<shard>/<uuid>/...`) for
 * any interpretable stored value: canonical values map to themselves, parked
 * conflict values (`assets/<uuid>/...`) and legacy absolute values map to
 * their sharded target. Returns null when the value has no safe
 * interpretation. Pure companion to the startup migration's per-row
 * derivation, used by the conflict-resolution service (issue #2287).
 */
export function deriveShardedAssetStoragePath(projectUuid: string, storedPath: string): string | null {
    const segments = extractAssetsRelativeSegments(storedPath);
    if (!segments || segments.length < 2) {
        return null;
    }
    let shard: string;
    try {
        shard = getAssetShard(projectUuid);
    } catch {
        return null;
    }
    const alreadySharded = segments.length >= 3 && segments[0] === shard && segments[1] === projectUuid;
    const relWithinProject = alreadySharded ? segments.slice(2) : segments.slice(1);
    try {
        return buildAssetStoragePath(projectUuid, ...relWithinProject);
    } catch {
        return null;
    }
}

/**
 * Returns the physical project asset directory candidates for `projectUuid`
 * under `filesDir`: the canonical sharded directory first, then the legacy
 * unsharded directory. Deletion/cleanup paths must remove both so projects
 * created before the sharding migration are fully cleaned up.
 */
export function getProjectAssetsDirCandidates(filesDir: string, projectUuid: string): string[] {
    if (!isSafeAssetPathSegment(projectUuid)) {
        throw new UnsafePathError('Invalid project identifier for asset directory');
    }
    const shard = getAssetShard(projectUuid);
    const candidates = [nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME, shard, projectUuid)];
    if (!SHARD_HEX_ANY_CASE.test(projectUuid)) {
        // Defensive: a two-hex "uuid" would make the legacy candidate collide
        // with a shard bucket directory; never offer that for deletion. The
        // check is case-insensitive because case-insensitive filesystems
        // (macOS/Windows desktop builds) alias 'AB' to the 'ab' bucket.
        candidates.push(nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME, projectUuid));
    }
    return candidates;
}
