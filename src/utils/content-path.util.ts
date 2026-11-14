/**
 * Traversal-safe path normalization and MIME resolution for content maps.
 *
 * Serving routes that resolve user-supplied relative paths against an
 * in-memory file map (editor preview sessions; the public viewer on branch
 * 348-public-url uses the same normalization and should refactor onto this
 * module when it lands) must never let a request escape the map root or
 * mislabel a response type. Lookups are exact-match `Map.get()` calls, so a
 * path that survives {@link normalizeContentPath} can only ever name an entry
 * of the map — never a filesystem location.
 */
import * as path from 'path';
import { getMimeType } from './mime-types';

/**
 * Normalize a requested relative path against a content-map root.
 *
 * Returns a safe, root-relative POSIX path, or `null` if the request escapes
 * the root (path traversal, encoded or literal), contains a NUL byte, or is
 * malformed percent-encoding.
 */
export function normalizeContentPath(relPath: string): string | null {
    let p = (relPath ?? '').split('?')[0].split('#')[0];
    try {
        p = decodeURIComponent(p);
    } catch {
        return null;
    }
    // Backslashes are not path separators in the content map; treat them as
    // literal, but a NUL byte is always invalid.
    if (p.includes('\0')) return null;
    p = p.replace(/^\/+/, '');
    if (p === '') p = 'index.html';
    const norm = path.posix.normalize(p);
    if (norm === '..' || norm.startsWith('../') || norm.startsWith('/') || path.posix.isAbsolute(norm)) {
        return null;
    }
    return norm;
}

/**
 * Resolve the Content-Type for a content-map path, appending a UTF-8 charset
 * to textual types so responses paired with `X-Content-Type-Options: nosniff`
 * stay both strict and readable.
 */
export function contentTypeFor(relPath: string): string {
    const ext = path.posix.extname(relPath).toLowerCase();
    let contentType = getMimeType(ext);
    const isTextual =
        contentType.startsWith('text/') ||
        ext === '.js' ||
        ext === '.mjs' ||
        ext === '.json' ||
        ext === '.svg' ||
        ext === '.xml';
    if (isTextual && !contentType.includes('charset')) {
        contentType += '; charset=utf-8';
    }
    return contentType;
}
