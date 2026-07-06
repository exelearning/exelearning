/**
 * Single source of truth for preview transport selection.
 *
 * Consumed by Capabilities (feature flags) and by the preview provider
 * factory. Selection is deterministic — no runtime probing, no fallback
 * chain — so an unavailable transport surfaces as an error instead of a
 * silent downgrade to a same-origin preview.
 */

/** @typedef {'http'|'srcdoc'|'service-worker'} PreviewTransport */

const OVERRIDES = Object.freeze({
    http: 'http',
    srcdoc: 'srcdoc',
    'legacy-sw': 'service-worker',
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
            throw new Error(`Unknown previewTransport override: ${forced}`);
        }
        return transport;
    }

    if (runtimeConfig?.mode === 'server') return 'http';
    // Electron: opaque HTTP preview served by the main process at
    // app://localhost/preview/{id}/* (protocol.handle → electron-preview-handler).
    // Same opaque transport as cloud, so the preview is cross-origin to the
    // app://localhost renderer and untrusted author JS cannot reach
    // window.top.electronAPI (arbitrary readFile) — the hole the legacy
    // same-origin Service Worker preview left open.
    if (hasElectronApi) return 'http';
    // Everything else (embedded editors AND static/PWA standalone) is
    // opaque-safe srcdoc: a Service Worker cannot serve an opaque iframe.
    // (Embedded hosts may opt into 'http' with their own serving endpoint —
    // see doc/development/preview-serving-contract.md.)
    return 'srcdoc';
}
