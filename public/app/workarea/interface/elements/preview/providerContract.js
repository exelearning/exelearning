/**
 * Shared contract for preview transport providers.
 *
 * A provider owns how generated preview content reaches the sandboxed iframe
 * (HTTP session, or the standalone static/PWA Service Worker) and never
 * touches the DOM: it returns render targets the panel applies.
 *
 * prepare()/update() input shape is EXPLICIT per transport — no duck typing:
 *  - HTTP transport (mode 'http'): the layered shape below
 *    ({@link LayeredPreviewInput}), produced by
 *    `SharedExporters.generatePreviewLayered` (serving contract v2).
 *  - static Service Worker transport (mode 'static-service-worker'): a plain
 *    object file map (`Object<string, ArrayBuffer|Uint8Array|string>`) from
 *    `SharedExporters.generatePreviewForSW`, unchanged.
 *
 * @typedef {Object} PreviewSession
 * @property {string} id
 * @property {string|null} entryUrl Absolute-from-basePath URL for the framed
 *   preview entry page.
 * @property {'http'|'static-service-worker'} mode
 * @property {boolean} opaqueSafe Whether the transport works inside an
 *   opaque-origin sandbox (no allow-same-origin).
 *
 * @typedef {{kind: 'url', url: string}} RenderTarget Both remaining transports
 *   render pages via real URLs; the panel sets iframe.src.
 *
 * @typedef {Object} LayeredPreviewInput Input for the HTTP transport
 *   (serving contract v2 — three layers with different lifecycles).
 * @property {Map<string, ArrayBuffer|string>} documents Generated documents
 *   (page HTML, generated CSS/JS, user themes/iDevices…): bytes, published as
 *   atomic incremental revisions.
 * @property {Map<string, {assetId: string, hash: string, size: number, mime: string}>} assetRefs
 *   Project assets by identity (served path → asset identity); bytes upload
 *   at most once per session under `${assetId}@${hash16}` keys.
 * @property {Map<string, string>} fixedRefs Fixed installation resources
 *   (served path → fixedResourceId); zero bytes transferred — the host
 *   resolves ids through its build manifest.
 * @property {(assetId: string) => Promise<Uint8Array|null>} getAssetBytes
 *   Lazy per-asset byte loader; called only for assets the session is missing.
 * @property {(fixedResourceId: string) => Promise<Uint8Array|null>} [resolveFixedResource]
 *   Resolves the bytes behind a fixed id so paths can be demoted to document
 *   writes when the host manifest does not know the id (422 recovery).
 */

/** Message types exchanged between the preview iframe and the workarea. */
export const MSG = Object.freeze({
    /** child → parent: reports the page path currently rendered (all transports) */
    NAV_REPORT: 'exe-preview-nav',
    /** child → parent: request opening a non-HTML document (PDF, office docs, media) */
    OPEN_DOC: 'exe-preview-open-document',
    /** child → parent: download-source-file iDevice asks for the .elpx (existing) */
    DOWNLOAD_ELPX: 'exe-download-elpx',
    /** parent → child: trigger window.print() inside the print-preview frame */
    PRINT: 'exe-print',
});

/** Transport-level failure with a user-safe message (shown via showError). */
export class PreviewProviderError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PreviewProviderError';
    }
}

/** The backend preview session expired/vanished; callers should re-prepare. */
export class PreviewSessionExpiredError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PreviewSessionExpiredError';
    }
}

/** Upper bound for page paths accepted from the (untrusted) preview frame. */
const MAX_PAGE_PATH_LENGTH = 2048;

/**
 * Validate and normalize a page path received from the preview iframe.
 *
 * The frame renders untrusted authored content, so anything it posts is
 * attacker-controlled: only root-relative page paths inside the preview file
 * set are acceptable. Protocol URLs, protocol-relative URLs and paths that
 * escape the root are rejected.
 *
 * @param {*} value
 * @returns {string|null} Normalized path, or null when rejected.
 */
export function sanitizePagePath(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PAGE_PATH_LENGTH) {
        return null;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) {
        return null;
    }

    // Strict resolution: a '..' that would climb above the root rejects the
    // whole path instead of silently clamping it to the root.
    const resolved = [];
    for (const part of value.split('/')) {
        if (part === '..') {
            if (resolved.length === 0) return null;
            resolved.pop();
        } else if (part !== '.' && part !== '') {
            resolved.push(part);
        }
    }
    if (resolved.length === 0) return null;
    return resolved.join('/');
}
