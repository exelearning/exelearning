/**
 * Srcdoc preview transport for environments without a backend
 * (static/PWA, editors embedded in LMS/CMS hosts).
 *
 * The file map stays in the parent; each page is inlined into a
 * self-contained HTML document rendered via iframe.srcdoc. srcdoc is the only
 * client-side bootstrap that works in an opaque sandbox: an opaque child
 * cannot load a parent-created blob: URL, and a Service Worker cannot serve
 * an opaque client at all. Multi-page navigation goes through validated
 * postMessage (the panel resolves pages and re-renders).
 */
import { findFileContent, decodeFileContent, toUint8Array } from './previewFileMap.js';
import { inlinePreviewPage } from './srcdocInliner.js';
import { decorateForSrcdoc } from './previewContentDecorators.js';

export class SrcdocPreviewProvider {
    /**
     * @param {Object} [options]
     * @param {Object} [options.inlineOptions] Budget overrides for the inliner.
     * @param {string|null} [options.pdfjsBase] Base URL the PDF embed script
     *   tries to import PDF.js from (host origin; may fail without CORS —
     *   the script degrades to a visible notice).
     * @param {string} [options.pdfUnavailableMessage] Translated fallback text.
     */
    constructor(options = {}) {
        this.mode = 'srcdoc';
        this.opaqueSafe = true;
        this._inlineOptions = options.inlineOptions || {};
        this._pdfjsBase = options.pdfjsBase ?? null;
        this._pdfUnavailableMessage = options.pdfUnavailableMessage;
        this._basePath = options.basePath || '';
        this._fetchFn = options.fetchFn || ((...args) => window.fetch(...args));
        this._files = null;
        this._session = null;
        this._embedShimSource = null;
        /** @type {{inlinedBytes: number, skipped: Array}|null} Stats of the last resolvePage call. */
        this.lastRenderStats = null;
    }

    /**
     * Fetch the external-embed shim source once (srcdoc has no server, so it is
     * inlined into every page). Failure is non-fatal: external embeds then keep
     * their original reference and simply do not render in the opaque frame.
     * @returns {Promise<string|null>}
     */
    async _loadEmbedShim() {
        if (this._embedShimSource !== null) return this._embedShimSource;
        try {
            const response = await this._fetchFn(`${this._basePath}/app/common/exe_embed_bridge/exe_embed_shim.js`);
            this._embedShimSource = response.ok ? await response.text() : '';
        } catch {
            this._embedShimSource = '';
        }
        return this._embedShimSource;
    }

    /** @returns {import('./providerContract.js').PreviewSession|null} */
    get session() {
        return this._session;
    }

    /**
     * @param {Object<string, ArrayBuffer|Uint8Array|string>} files
     * @returns {Promise<import('./providerContract.js').PreviewSession>}
     */
    async prepare(files) {
        this._files = files;
        if (!this._session) {
            this._session = Object.freeze({
                id: crypto.randomUUID(),
                entryUrl: null,
                mode: this.mode,
                opaqueSafe: this.opaqueSafe,
            });
        }
        return this._session;
    }

    /** Replace the file map (srcdoc has no server to diff against). */
    async update(files) {
        if (!this._session) {
            await this.prepare(files);
            return;
        }
        this._files = files;
    }

    /**
     * Inline + decorate a page for srcdoc rendering.
     * @param {string} pagePath
     * @returns {Promise<{kind: 'srcdoc', html: string}>}
     */
    async resolvePage(pagePath) {
        const content = this._files ? findFileContent(this._files, pagePath) : undefined;
        const html = decodeFileContent(content);
        if (html == null) {
            throw new Error(`Preview page not found: ${pagePath}`);
        }
        const embedShimSource = await this._loadEmbedShim();
        const { html: inlined, stats, assetMap } = inlinePreviewPage(html, this._files, {
            pagePath,
            ...this._inlineOptions,
        });
        this.lastRenderStats = stats;
        const decorated = decorateForSrcdoc(inlined, {
            pagePath,
            pdfjsBase: this._pdfjsBase,
            pdfUnavailableMessage: this._pdfUnavailableMessage,
            embedShimSource: embedShimSource || undefined,
            assetMap,
        });
        return { kind: 'srcdoc', html: decorated };
    }

    /**
     * Whether the file map contains an HTML page at the given path.
     * @param {string} pagePath
     */
    hasPage(pagePath) {
        if (!this._files || !/\.html?$/i.test(pagePath)) return false;
        return findFileContent(this._files, pagePath) !== undefined;
    }

    /**
     * Raw bytes for a file in the map (parent-side document opener).
     * @param {string} path
     * @returns {Promise<Uint8Array|null>}
     */
    async getFile(path) {
        if (!this._files) return null;
        const content = findFileContent(this._files, path);
        if (content === undefined) return null;
        return toUint8Array(content);
    }

    async dispose() {
        this._files = null;
        this._session = null;
        this.lastRenderStats = null;
    }
}
