/**
 * Safe path utilities — single source of truth for validating user-supplied
 * path segments and identifiers before they are used to build on-disk paths.
 *
 * Background: several upload/export/theme endpoints concatenated attacker
 * controlled identifiers (clientId, resumableIdentifier, odeSessionId,
 * themeName, ideviceId) directly into `path.join(...)`. Because `path.join`
 * collapses `..` segments, this allowed arbitrary file read/write outside the
 * intended base directory. These helpers reject unsafe segments up front and
 * assert containment after the join, so every filesystem sink shares the same
 * hardened guard instead of re-implementing (and forgetting) it.
 */
import * as nodePath from 'path';

/**
 * Thrown when a path segment is rejected or a resolved path escapes its base.
 */
export class UnsafePathError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnsafePathError';
    }
}

export interface SafeSegmentOptions {
    /** Allow `.` characters inside the segment (still rejects `.` and `..`). */
    allowDots?: boolean;
    /** Maximum allowed length. Defaults to 255. */
    maxLength?: number;
}

const DEFAULT_MAX_SEGMENT_LENGTH = 255;

const SEGMENT_CHARS = /^[A-Za-z0-9_-]+$/;
const SEGMENT_CHARS_WITH_DOTS = /^[A-Za-z0-9._-]+$/;

/** Returns true if the string contains any ASCII control character (incl. NUL/DEL). */
function hasControlChars(value: string): boolean {
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code <= 0x1f || code === 0x7f) {
            return true;
        }
    }
    return false;
}

/**
 * Returns true if `segment` is a single, safe path component: a non-empty,
 * bounded string with no path separators, no NUL/control characters and which
 * is not a traversal token (`.` / `..`). By default only `[A-Za-z0-9_-]` is
 * permitted; pass `allowDots` to also permit `.` (e.g. `name.ext`).
 */
export function isSafePathSegment(segment: unknown, opts: SafeSegmentOptions = {}): segment is string {
    if (typeof segment !== 'string') {
        return false;
    }
    const maxLength = opts.maxLength ?? DEFAULT_MAX_SEGMENT_LENGTH;
    if (segment.length === 0 || segment.length > maxLength) {
        return false;
    }
    if (segment === '.' || segment === '..') {
        return false;
    }
    if (segment.includes('/') || segment.includes('\\')) {
        return false;
    }
    if (hasControlChars(segment)) {
        return false;
    }
    return (opts.allowDots ? SEGMENT_CHARS_WITH_DOTS : SEGMENT_CHARS).test(segment);
}

/**
 * Validates `segment` and returns it unchanged, or throws {@link UnsafePathError}.
 */
export function assertSafePathSegment(segment: unknown, opts: SafeSegmentOptions & { label?: string } = {}): string {
    if (!isSafePathSegment(segment, opts)) {
        throw new UnsafePathError(`Invalid ${opts.label ?? 'path segment'}`);
    }
    return segment;
}

/**
 * Returns true if `targetPath`, resolved relative to `baseDir`, stays inside
 * `baseDir`. Uses a separator-aware prefix check so that `/data/assets-evil`
 * is NOT considered inside `/data/assets` (a bug in a naive `startsWith`).
 */
export function isWithinBase(baseDir: string, targetPath: string): boolean {
    const resolvedBase = nodePath.resolve(baseDir);
    const resolvedTarget = nodePath.resolve(baseDir, targetPath);
    return resolvedTarget === resolvedBase || resolvedTarget.startsWith(resolvedBase + nodePath.sep);
}

/**
 * Joins one or more user-supplied segments onto `baseDir`, validating each
 * segment and asserting the final path stays within `baseDir`. Throws
 * {@link UnsafePathError} on any violation. This is the preferred way to build
 * an on-disk path from untrusted input.
 */
export function safeJoin(baseDir: string, ...segments: string[]): string {
    for (const segment of segments) {
        assertSafePathSegment(segment, { allowDots: true, label: 'path segment' });
    }
    const joined = nodePath.join(baseDir, ...segments);
    if (!isWithinBase(baseDir, joined)) {
        throw new UnsafePathError('Resolved path escapes base directory');
    }
    return joined;
}

/**
 * Extracts a safe, lowercased file extension (including the leading dot) from a
 * filename, or returns '' when there is no acceptable extension. Only short
 * alphanumeric extensions are accepted, so a crafted filename cannot smuggle
 * separators or traversal tokens through the extension.
 */
export function sanitizeFileExtension(filename: unknown): string {
    if (typeof filename !== 'string') {
        return '';
    }
    const ext = nodePath.extname(filename).toLowerCase();
    return /^\.[a-z0-9]{1,12}$/.test(ext) ? ext : '';
}
