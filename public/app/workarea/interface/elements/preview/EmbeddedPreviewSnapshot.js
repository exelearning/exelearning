// Must stay identical to PREVIEW_SNAPSHOT_SANDBOX in
// src/shared/security/previewSandbox.ts (the serving CSP `sandbox` directive):
// the effective sandbox of a framed document is the INTERSECTION of the CSP
// directive and this attribute, so any divergence silently drops capabilities.
// A drift test in previewSandbox.spec.ts enforces the equality.
// `allow-popups-to-escape-sandbox` is decision D2 (ADR-2199-02): the external
// media fallback's author-initiated "open in a new tab" must land in a clean,
// non-sandboxed tab or the video would not play there either.
const EMBEDDED_PREVIEW_SANDBOX =
    'allow-scripts allow-forms allow-popups allow-downloads allow-presentation allow-popups-to-escape-sandbox';

function sameOriginUrl(value, baseUrl = window.location.href) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Embedded preview URL is missing');
    const url = new URL(value, baseUrl);
    if (url.origin !== window.location.origin) throw new Error('Embedded preview URL must use the editor origin');
    return url;
}

/**
 * Snapshot config pointing at eXe's OWN capability routes
 * (src/routes/preview-snapshot.ts) instead of an embedding host's. The same
 * EmbeddedPreviewSnapshot lifecycle drives both cases — one client, two
 * servers — which is the point of reusing the wire format: host plugins and
 * the editor share a single snapshot contract.
 */
export function selfHostedPreviewSnapshotConfig(basePath = '') {
    const base = String(basePath || '').replace(/\/+$/, '');
    return {
        managementUrl: `${base}/api/preview-snapshot/`,
        servingBaseUrl: `${base}/preview-snapshot/`,
        // No deleteUrlTemplate: the default dispose target (managementUrl +
        // previewId) is exactly eXe's DELETE /api/preview-snapshot/:previewId.
    };
}

export function validateEmbeddedPreviewConfig(config) {
    if (!config || typeof config !== 'object') throw new Error('Embedded preview configuration is missing');
    const managementUrl = sameOriginUrl(config.managementUrl);
    const servingBaseUrl = sameOriginUrl(config.servingBaseUrl);
    return {
        managementUrl,
        servingBaseUrl,
        deleteUrlTemplate:
            typeof config.deleteUrlTemplate === 'string' && config.deleteUrlTemplate.includes('{previewId}')
                ? sameOriginUrl(config.deleteUrlTemplate)
                : null,
        managementHeaders:
            config.managementHeaders && typeof config.managementHeaders === 'object'
                ? { ...config.managementHeaders }
                : {},
    };
}

function filesToArchiveInput(files) {
    return Object.fromEntries(
        Object.entries(files).map(([path, content]) => {
            const bytes =
                content instanceof Uint8Array
                    ? content
                    : content instanceof ArrayBuffer
                      ? new Uint8Array(content)
                      : new TextEncoder().encode(String(content));
            return [path, bytes];
        }),
    );
}

export class EmbeddedPreviewSnapshot {
    constructor(config, { fetchImpl = window.fetch.bind(window), zipSync = window.fflate?.zipSync } = {}) {
        this.config = validateEmbeddedPreviewConfig(config);
        this.fetchImpl = fetchImpl;
        this.zipSync = zipSync;
        this.previewId = null;
        this.previewUrl = null;
    }

    applySandbox(iframe) {
        iframe?.setAttribute('sandbox', EMBEDDED_PREVIEW_SANDBOX);
    }

    async replace(files) {
        if (typeof this.zipSync !== 'function') throw new Error('Embedded preview ZIP support is unavailable');
        const archive = this.zipSync(filesToArchiveInput(files), { level: 6 });
        const formData = new FormData();
        formData.append('snapshot', new Blob([archive], { type: 'application/zip' }), 'preview.zip');
        if (this.previewId) formData.append('previewId', this.previewId);

        const response = await this.fetchImpl(this.config.managementUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: this.config.managementHeaders,
            body: formData,
        });
        if (!response.ok) throw new Error(`Embedded preview update failed (${response.status})`);
        const payload = await response.json();
        if (typeof payload?.previewId !== 'string' || !payload.previewId) {
            throw new Error('Embedded preview response is missing previewId');
        }
        this.previewId = payload.previewId;
        const fallbackUrl = new URL(
            `${encodeURIComponent(this.previewId)}/index.html`,
            `${this.config.servingBaseUrl.href.replace(/\/$/, '')}/`,
        );
        const previewUrl = payload.previewUrl ? sameOriginUrl(payload.previewUrl) : fallbackUrl;
        this.previewUrl = previewUrl.href;
        return this.previewUrl;
    }

    async dispose() {
        if (!this.previewId) return;
        // The URL constructor percent-encodes `{`/`}` in pathnames (but not in
        // query strings), so the placeholder may appear either raw or encoded
        // in the validated template href — substitute both forms.
        const target = this.config.deleteUrlTemplate
            ? new URL(
                  this.config.deleteUrlTemplate.href
                      .replace('%7BpreviewId%7D', encodeURIComponent(this.previewId))
                      .replace('{previewId}', encodeURIComponent(this.previewId)),
              )
            : new URL(
                  encodeURIComponent(this.previewId),
                  `${this.config.managementUrl.href.replace(/\/$/, '')}/`,
              );
        const response = await this.fetchImpl(target, {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: this.config.managementHeaders,
        });
        if (!response.ok && response.status !== 404) {
            throw new Error(`Embedded preview cleanup failed (${response.status})`);
        }
        this.previewId = null;
        this.previewUrl = null;
    }
}

export { EMBEDDED_PREVIEW_SANDBOX };
