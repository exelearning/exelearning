/**
 * Legacy Service Worker preview transport.
 *
 * A Service Worker can never serve an opaque-origin sandboxed iframe
 * (navigator.serviceWorker is undefined there and the document is never a
 * controlled client — see doc/development/preview-architecture.md), so this
 * transport is NOT opaque-safe. It remains only for Electron (interim, until
 * the app:// preview protocol lands) and for hosts that explicitly opt in
 * via previewTransport: 'legacy-sw'.
 */
export class ServiceWorkerPreviewProvider {
    /**
     * @param {Object} options
     * @param {{sendContentToPreviewSW: Function}} options.app
     * @param {string} [options.basePath]
     */
    constructor(options) {
        this.mode = 'service-worker';
        this.opaqueSafe = false;
        this._app = options.app;
        this._basePath = options.basePath || '';
        this._session = null;
    }

    /** @returns {import('./providerContract.js').PreviewSession|null} */
    get session() {
        return this._session;
    }

    async prepare(files) {
        await this._app.sendContentToPreviewSW(files, { openExternalLinksInNewWindow: true });
        if (!this._session) {
            this._session = Object.freeze({
                id: 'service-worker',
                entryUrl: `${this._basePath}/viewer/index.html?exe-teacher=1`,
                mode: this.mode,
                opaqueSafe: this.opaqueSafe,
            });
        }
        return this._session;
    }

    /** The SW replaces its content wholesale; update and prepare are the same. */
    async update(files) {
        await this.prepare(files);
    }

    /**
     * @param {string} pagePath
     * @returns {{kind: 'url', url: string}}
     */
    resolvePage(pagePath) {
        const encoded = pagePath
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/');
        return { kind: 'url', url: `${this._basePath}/viewer/${encoded}?exe-teacher=1` };
    }

    /**
     * Not supported: /viewer/* only resolves for clients the SW controls, and
     * the workarea window is outside its scope. The SW injects its own link
     * handling into served pages, so the parent never needs file access here.
     * @returns {Promise<null>}
     */
    async getFile() {
        return null;
    }

    /** SW content survives panel teardown (legacy behavior); nothing to free. */
    async dispose() {
        this._session = null;
    }
}
