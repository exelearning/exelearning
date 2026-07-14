const EMBEDDED_PREVIEW_SANDBOX = 'allow-scripts allow-forms allow-popups allow-downloads allow-presentation';

function sameOriginUrl(value, baseUrl = window.location.href) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Embedded preview URL is missing');
    const url = new URL(value, baseUrl);
    if (url.origin !== window.location.origin) throw new Error('Embedded preview URL must use the editor origin');
    return url;
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
        const target = this.config.deleteUrlTemplate
            ? new URL(
                  this.config.deleteUrlTemplate.href.replace('{previewId}', encodeURIComponent(this.previewId)),
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
