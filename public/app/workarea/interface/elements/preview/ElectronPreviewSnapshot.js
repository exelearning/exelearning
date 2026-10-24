/**
 * The opaque preview snapshot in Electron.
 *
 * Same lifecycle as `EmbeddedPreviewSnapshot` (`replace(files)` → capability URL,
 * `applySandbox(iframe)`, `dispose()`), with the main process as the server: the generated
 * file map crosses IPC through the preload's `electronAPI.previewSnapshot`, and the main
 * process answers `preview://{id}/…` with the same hardening headers and sandbox-first CSP
 * the HTTP capability route sends (`app/preview-snapshot-scheme.js`). `preview://{id}` is a
 * different origin from the editor's `app://localhost` by scheme and by host; the iframe
 * sandbox makes the document opaque on top of that.
 */
import { EMBEDDED_PREVIEW_SANDBOX } from './EmbeddedPreviewSnapshot.js';

const PREVIEW_SCHEME = 'preview:';

/** The preload bridge for the scheme, or `null` when this Electron build predates it. */
export function electronPreviewSnapshotApi(win = typeof window !== 'undefined' ? window : undefined) {
    const api = win?.electronAPI?.previewSnapshot;
    return api && typeof api.replace === 'function' && typeof api.dispose === 'function' ? api : null;
}

export class ElectronPreviewSnapshot {
    constructor(api = electronPreviewSnapshotApi()) {
        if (!api) throw new Error('The Electron preview snapshot API is unavailable');
        this.api = api;
        this.previewId = null;
        this.previewUrl = null;
    }

    applySandbox(iframe) {
        iframe?.setAttribute('sandbox', EMBEDDED_PREVIEW_SANDBOX);
    }

    async replace(files) {
        const result = await this.api.replace(this.previewId, files);
        if (typeof result?.previewId !== 'string' || !result.previewId) {
            throw new Error('Electron preview response is missing previewId');
        }
        let url;
        try {
            url = new URL(String(result.previewUrl));
        } catch {
            throw new Error('Electron preview URL is invalid');
        }
        // The URL must be the snapshot's own origin: never the editor's, never anything else.
        if (url.protocol !== PREVIEW_SCHEME || url.hostname !== result.previewId) {
            throw new Error('Electron preview URL must use the preview scheme');
        }
        this.previewId = result.previewId;
        this.previewUrl = url.href;
        return this.previewUrl;
    }

    async dispose() {
        if (!this.previewId) return;
        const previewId = this.previewId;
        this.previewId = null;
        this.previewUrl = null;
        await this.api.dispose(previewId);
    }
}
