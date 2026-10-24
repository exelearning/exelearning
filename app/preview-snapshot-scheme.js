/**
 * The `preview://` scheme: the opaque capability snapshot of the preview trust boundary,
 * served by the Electron main process.
 *
 * Web/server runtimes serve the enabled preview from `/preview-snapshot/{id}/*`
 * (`src/routes/preview-snapshot.ts`). Electron has no HTTP server, but its main process can
 * answer a custom scheme, so the same contract is implemented here: the renderer hands the
 * generated file map over IPC, gets back `preview://{id}/index.html`, and points an iframe
 * sandboxed WITHOUT `allow-same-origin` at it. `preview://{id}` is a different origin from
 * the editor's `app://localhost` by scheme and by host, the iframe sandbox makes the document
 * opaque on top of that, and the sandbox-first CSP on every scriptable type keeps a snapshot
 * URL opaque when it is opened in its own window.
 *
 * The id is the only credential: serving reads no state but the map. One snapshot per
 * renderer (`ownerId` = the WebContents id); a replace keeps the id so the iframe URL stays
 * valid, and the snapshot dies with its window.
 *
 * Pure module: no Electron import. `main.js` wires `protocol.handle`, the IPC channels and
 * the window lifecycle; `serve()` returns a plain `{ status, headers, body }` for it to wrap.
 */

const path = require('path');
const { randomBytes } = require('crypto');

const SCHEME = 'preview';

/**
 * Sandbox tokens of the enabled preview. Must stay identical to
 * `PREVIEW_SNAPSHOT_SANDBOX_TOKENS` in `src/shared/security/previewSandbox.ts` — the
 * effective sandbox is the intersection of this CSP and the iframe attribute, so a
 * divergence silently drops capabilities. A spec asserts the equality.
 */
const SANDBOX_TOKENS = Object.freeze([
    'allow-scripts',
    'allow-forms',
    'allow-popups',
    'allow-downloads',
    'allow-presentation',
    'allow-popups-to-escape-sandbox',
]);

/** Document types a browser executes script from; they carry the sandbox CSP (same set as the TS owner). */
const SCRIPTABLE_TYPES = Object.freeze([
    'text/html',
    'application/xhtml+xml',
    'image/svg+xml',
    'application/xml',
    'text/xml',
    'application/pdf',
]);

const PREVIEW_ID_RE = /^[0-9a-f]{32}$/;

// ponytail: one fixed cap for the in-memory snapshot; a size tier per project if it ever bites.
const MAX_SNAPSHOT_BYTES = 512 * 1024 * 1024;

function sandboxCsp() {
    return `sandbox ${SANDBOX_TOKENS.join(' ')}`;
}

function isScriptableDocumentType(contentType) {
    const base = String(contentType || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
    return SCRIPTABLE_TYPES.includes(base);
}

/**
 * Traversal-safe normalization of the path part of a snapshot URL (same rules as
 * `src/utils/content-path.util.ts`): root-relative POSIX path or `null`.
 */
function normalizeContentPath(relPath) {
    let p = String(relPath ?? '')
        .split('?')[0]
        .split('#')[0];
    try {
        p = decodeURIComponent(p);
    } catch {
        return null;
    }
    if (p.includes('\0')) return null;
    p = p.replace(/^\/+/, '');
    if (p === '') p = 'index.html';
    const norm = path.posix.normalize(p);
    if (norm === '..' || norm.startsWith('../') || norm.startsWith('/') || path.posix.isAbsolute(norm)) {
        return null;
    }
    return norm;
}

function baseHeaders() {
    return {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
        'Cache-Control': 'no-store',
    };
}

function toBytes(content) {
    if (content instanceof Uint8Array) return content;
    if (content instanceof ArrayBuffer) return new Uint8Array(content);
    if (typeof content === 'string') return new TextEncoder().encode(content);
    return null;
}

/**
 * @param {object} [options]
 * @param {() => string} [options.randomId] 32 lowercase hex chars (128 bits).
 * @param {number} [options.maxBytes] Cap on the summed file bytes of one snapshot.
 * @param {Record<string, string>} options.mimeTypes Extension (with dot) → content type.
 */
function createPreviewSnapshotStore({ randomId = () => randomBytes(16).toString('hex'), maxBytes = MAX_SNAPSHOT_BYTES, mimeTypes = {} } = {}) {
    /** @type {Map<string, { ownerId: unknown, files: Map<string, Uint8Array>, bytes: number }>} */
    const snapshots = new Map();

    function contentTypeFor(relPath) {
        return mimeTypes[path.posix.extname(relPath).toLowerCase()] || 'application/octet-stream';
    }

    function previewUrl(previewId) {
        return `${SCHEME}://${previewId}/index.html`;
    }

    return {
        /**
         * Create or replace the caller's snapshot. A replace keeps the id so the iframe URL
         * stays valid; an id owned by another renderer is refused. The whole map is
         * materialized before the swap, so a torn snapshot is never served.
         */
        replace(ownerId, previewId, files) {
            if (!files || typeof files !== 'object') throw new Error('Preview snapshot files are missing');
            const map = new Map();
            let bytes = 0;
            for (const [rawPath, content] of Object.entries(files)) {
                const relPath = normalizeContentPath(rawPath);
                const data = toBytes(content);
                if (!relPath || !data) throw new Error(`Preview snapshot entry "${rawPath}" is not valid`);
                bytes += data.byteLength;
                if (bytes > maxBytes) throw new Error('Preview snapshot exceeds the maximum allowed size');
                map.set(relPath, data);
            }
            if (!map.has('index.html')) throw new Error('Preview snapshot has no index.html');

            let id = typeof previewId === 'string' && PREVIEW_ID_RE.test(previewId) ? previewId : null;
            if (id) {
                const existing = snapshots.get(id);
                if (existing && existing.ownerId !== ownerId) throw new Error('Preview snapshot belongs to another window');
                if (!existing) id = null; // expired or unknown: mint a fresh capability
            }
            if (!id) {
                // One live snapshot per renderer: a new one replaces whatever it had.
                this.disposeOwner(ownerId);
                id = randomId();
            }
            snapshots.set(id, { ownerId, files: map, bytes });
            return { previewId: id, previewUrl: previewUrl(id) };
        },

        /** Drop the caller's snapshot; `false` when it is not the caller's (or unknown). */
        dispose(ownerId, previewId) {
            const existing = typeof previewId === 'string' ? snapshots.get(previewId) : undefined;
            if (!existing || existing.ownerId !== ownerId) return false;
            snapshots.delete(previewId);
            return true;
        },

        /** Drop every snapshot a renderer owns (its window closed). Returns how many. */
        disposeOwner(ownerId) {
            let removed = 0;
            for (const [id, snapshot] of snapshots) {
                if (snapshot.ownerId === ownerId) {
                    snapshots.delete(id);
                    removed += 1;
                }
            }
            return removed;
        },

        /**
         * Answer a `preview://{id}/{path}` request. Returns `{ status, headers, body }`;
         * `main.js` wraps it in a `Response`. The id gate runs before any lookup, so an
         * unknown or malformed URL costs nothing and tells nothing.
         */
        serve(requestUrl) {
            const notFound = () => ({
                status: 404,
                headers: { ...baseHeaders(), 'Content-Type': 'text/plain; charset=utf-8' },
                body: 'Not found',
            });
            let url;
            try {
                url = new URL(requestUrl);
            } catch {
                return notFound();
            }
            if (url.protocol !== `${SCHEME}:` || !PREVIEW_ID_RE.test(url.hostname)) return notFound();
            const snapshot = snapshots.get(url.hostname);
            if (!snapshot) return notFound();
            const relPath = normalizeContentPath(url.pathname);
            if (!relPath) return notFound();
            const body = snapshot.files.get(relPath);
            if (!body) return notFound();

            const contentType = contentTypeFor(relPath);
            const headers = { ...baseHeaders(), 'Content-Type': contentType };
            // Sandbox-first CSP on every scriptable type, not just HTML: an author SVG or XML
            // opened in its own window would otherwise run its script with the snapshot's
            // (non-sandboxed) origin.
            if (isScriptableDocumentType(contentType)) headers['Content-Security-Policy'] = sandboxCsp();
            return { status: 200, headers, body };
        },

        /** Live snapshots (tests, diagnostics). */
        size() {
            return snapshots.size;
        },
    };
}

module.exports = {
    SCHEME,
    SANDBOX_TOKENS,
    SCRIPTABLE_TYPES,
    PREVIEW_ID_RE,
    MAX_SNAPSHOT_BYTES,
    sandboxCsp,
    isScriptableDocumentType,
    normalizeContentPath,
    createPreviewSnapshotStore,
};
