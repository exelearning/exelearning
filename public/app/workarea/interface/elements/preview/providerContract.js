/**
 * Shared contract for preview transport providers.
 *
 * A provider owns how generated preview files reach the sandboxed iframe
 * (HTTP session, srcdoc, legacy Service Worker) and never touches the DOM:
 * it returns render targets the panel applies.
 *
 * @typedef {Object} PreviewSession
 * @property {string} id
 * @property {string|null} entryUrl Absolute-from-basePath URL for URL-based
 *   transports; null when pages render via srcdoc.
 * @property {'http'|'srcdoc'|'service-worker'} mode
 * @property {boolean} opaqueSafe Whether the transport works inside an
 *   opaque-origin sandbox (no allow-same-origin).
 *
 * @typedef {{kind: 'url', url: string} | {kind: 'srcdoc', html: string}} RenderTarget
 */

/** Message types exchanged between the preview iframe and the workarea. */
export const MSG = Object.freeze({
    /** child → parent: reports the page path currently rendered (all transports) */
    NAV_REPORT: 'exe-preview-nav',
    /** child → parent: request navigation to another page (srcdoc transport) */
    NAVIGATE: 'exe-preview-navigate',
    /** child → parent: request opening a non-HTML document (srcdoc transport) */
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
    // whole path instead of silently clamping (unlike resolveRelativePath).
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
