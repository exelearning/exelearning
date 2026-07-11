/**
 * Single source of truth for preview transport selection.
 *
 * Consumed by Capabilities (feature flags) and by the preview provider
 * factory. Selection is deterministic — no runtime probing, no fallback
 * chain — so an unavailable transport surfaces as an error instead of a
 * silent downgrade to a same-origin preview.
 *
 * Two transports remain:
 *  - 'http': authored content served same-origin from an ephemeral preview
 *    session, rendered in an opaque-origin sandbox (opaqueSafe). Used by the
 *    server, by Electron (app://localhost), and by embedded editors whose host
 *    supplies a `previewHttp` block (serving contract v2).
 *  - 'static-service-worker': the standalone static/PWA compatibility mode. A
 *    Service Worker serves /viewer/* same-origin; it is NOT opaque-safe and is
 *    NOT a security boundary against malicious authored JavaScript — the Y.Doc
 *    sanitizer is the only isolation there. It is never selected automatically
 *    for an embedded editor.
 *
 * The srcdoc transport has been removed. Embedded editors fail closed when the
 * host does not supply preview HTTP configuration — there is no server-less
 * authored-content preview any more.
 */

/** @typedef {'http'|'static-service-worker'} PreviewTransport */

const OVERRIDES = Object.freeze({
    http: 'http',
    'static-service-worker': 'static-service-worker',
});

/**
 * @param {{mode: string, isEmbedded: boolean, embeddingConfig: Object|null}} runtimeConfig
 * @param {{hasElectronApi?: boolean}} [options]
 * @returns {PreviewTransport}
 */
export function resolvePreviewTransport(runtimeConfig, { hasElectronApi = false } = {}) {
    const forced = runtimeConfig?.embeddingConfig?.previewTransport;
    if (forced) {
        const transport = OVERRIDES[forced];
        if (!transport) {
            throw new Error(
                `Unknown previewTransport override: ${forced} ` +
                    `(expected 'http' or 'static-service-worker')`,
            );
        }
        return transport;
    }

    if (runtimeConfig?.mode === 'server') return 'http';
    // Electron: opaque HTTP preview served by the main process at
    // app://localhost/preview/{id}/* (protocol.handle → electron-preview-handler).
    // Cross-origin to the app://localhost renderer, so untrusted author JS
    // cannot reach window.top.electronAPI (arbitrary readFile).
    if (hasElectronApi) return 'http';

    // Embedded editors get a live preview only via HTTP, and only when the host
    // supplied a valid previewHttp block. No server-less fallback: without it,
    // fail closed so the panel shows an error rather than silently rendering a
    // same-origin (non-opaque) preview.
    if (runtimeConfig?.isEmbedded === true) {
        const previewHttp = runtimeConfig?.embeddingConfig?.previewHttp;
        if (previewHttp == null) {
            throw new Error(
                'Embedded host did not supply preview HTTP configuration (previewHttp); ' +
                    'the preview cannot render. See doc/development/preview-serving-contract.md.',
            );
        }
        // Throws (naming the offending field) when the block is malformed.
        validatePreviewHttpConfig(previewHttp);
        return 'http';
    }

    // Standalone static/PWA: same-origin Service Worker compatibility mode.
    return 'static-service-worker';
}

/**
 * Whether the active transport is the static Service Worker selected via an
 * explicit override inside an embedded editor. This is a development-only,
 * unsafe opt-in (playground blueprints only): the panel renders a visible
 * warning banner when it is true. Hosts must never set it in production.
 * @param {{isEmbedded: boolean, embeddingConfig: Object|null}} runtimeConfig
 * @returns {boolean}
 */
export function isUnsafeEmbeddedServiceWorker(runtimeConfig) {
    return (
        runtimeConfig?.isEmbedded === true &&
        runtimeConfig?.embeddingConfig?.previewTransport === 'static-service-worker'
    );
}

/**
 * Validate and normalize the `previewHttp` block an embedding host passes
 * (serving contract v2). Fails closed with a message naming the offending
 * field so a misconfigured host is diagnosable instead of silently degrading.
 *
 * @param {*} previewHttp
 * @returns {{
 *   protocolVersion: 2,
 *   managementBaseUrl: string,
 *   servingBaseUrl: string,
 *   managementHeaders: Object<string, string>,
 *   managementQuery: Object<string, string>,
 * }} Frozen normalized config.
 * @throws {Error} when any field is missing or of the wrong shape.
 */
export function validatePreviewHttpConfig(previewHttp) {
    if (previewHttp == null || typeof previewHttp !== 'object' || Array.isArray(previewHttp)) {
        throw new Error('previewHttp must be a plain object');
    }
    if (previewHttp.protocolVersion !== 2) {
        throw new Error('previewHttp.protocolVersion must be the literal 2');
    }
    const managementBaseUrl = requireUrlString('previewHttp.managementBaseUrl', previewHttp.managementBaseUrl);
    const servingBaseUrl = requireUrlString('previewHttp.servingBaseUrl', previewHttp.servingBaseUrl);
    const managementHeaders = requireStringRecord('previewHttp.managementHeaders', previewHttp.managementHeaders);
    const managementQuery = requireStringRecord('previewHttp.managementQuery', previewHttp.managementQuery);
    return Object.freeze({
        protocolVersion: 2,
        managementBaseUrl,
        servingBaseUrl,
        managementHeaders,
        managementQuery,
    });
}

/**
 * A non-empty string parseable as a URL relative to the current document AND
 * resolving to the current origin. Origin-relative bases (`/api/preview-session`)
 * pass; a cross-origin or protocol-relative base (`//evil.example/…`) fails
 * closed. The preview contract forbids a second/dedicated preview domain (no
 * subdomain either), and management requests use `credentials: 'same-origin'`,
 * so a cross-origin base could never authenticate — reject it up front with a
 * diagnosable message instead of silently failing at request time.
 *
 * NB: this same-origin check lives ONLY here (the embedded `isEmbedded` path).
 * The server and Electron transports never pass `previewHttp`, so they never
 * validate — the Electron `app://localhost` origin is never compared.
 * @param {string} field
 * @param {*} value
 * @returns {string}
 */
function requireUrlString(field, value) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${field} must be a non-empty URL string`);
    }
    const documentOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : null;
    const base = documentOrigin ? window.location.href : 'http://localhost/';
    let resolved;
    try {
        resolved = new URL(value, base);
    } catch {
        throw new Error(`${field} is not a parseable URL: ${value}`);
    }
    // Enforce same-origin ONLY where the document origin is knowable (browser /
    // happy-dom). Without a window (pure Node), the origin cannot be determined,
    // so skip the comparison rather than compare against a fabricated origin.
    // Resolve-then-compare: origin-relative values resolve to the current origin
    // (pass); protocol-relative and absolute cross-origin values resolve to a
    // foreign origin (throw).
    if (documentOrigin !== null && resolved.origin !== documentOrigin) {
        throw new Error(
            `${field} must be same-origin (${documentOrigin}); resolved to ${resolved.origin} from "${value}"`,
        );
    }
    return value;
}

/**
 * An optional plain object whose values are all strings (e.g. header or query
 * maps). `null`/`undefined` normalize to an empty object.
 * @param {string} field
 * @param {*} value
 * @returns {Object<string, string>}
 */
function requireStringRecord(field, value) {
    if (value == null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${field} must be a plain object of string values`);
    }
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry !== 'string') {
            throw new Error(`${field}.${key} must be a string`);
        }
    }
    return { ...value };
}
