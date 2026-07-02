/**
 * HTTP preview transport: uploads the client-generated preview files to an
 * ephemeral backend session (POST /api/preview-session) and points the opaque
 * iframe at the authless capability URL /preview/{previewId}/index.html.
 *
 * The manifest-diff protocol keeps the debounced auto-refresh cheap: the
 * backend replies with the content hashes it is missing and only those blobs
 * are uploaded (steady-state edits re-upload just the changed page HTML).
 */
import { PreviewProviderError, PreviewSessionExpiredError } from './providerContract.js';
import { buildManifest } from './fileManifest.js';
import { toUint8Array } from './previewFileMap.js';
import { decorateForHttp } from './previewContentDecorators.js';

const Logger = (typeof window !== 'undefined' && window.AppLogger) || console;

/** Max files per blob-upload call, independent of the byte batch limit. */
const MAX_FILES_PER_BATCH = 400;

/** Internal signal: the backend staged a newer manifest mid-upload (HTTP 409). */
class StaleManifestError extends PreviewProviderError {
    constructor() {
        super('Preview upload superseded by a newer manifest');
    }
}

/** PDF.js runtime shipped into the session when the preview contains PDFs. */
const PDFJS_SESSION_FILES = ['libs/pdfjs/pdf.min.mjs', 'libs/pdfjs/pdf.worker.min.mjs'];

export class HttpPreviewProvider {
    /**
     * @param {Object} [options]
     * @param {string} [options.basePath] App base path ('' or '/subdir').
     * @param {typeof fetch} [options.fetchFn] Injectable for tests.
     * @param {string} [options.pdfUnavailableMessage] Translated fallback text.
     */
    constructor(options = {}) {
        this.mode = 'http';
        this.opaqueSafe = true;
        this._basePath = options.basePath || '';
        this._fetchFn = options.fetchFn || ((...args) => window.fetch(...args));
        this._pdfUnavailableMessage = options.pdfUnavailableMessage;
        this._session = null;
        this._limits = null;
        this._version = 0;
        this._pdfjsCache = null;
    }

    /** @returns {import('./providerContract.js').PreviewSession|null} */
    get session() {
        return this._session;
    }

    /**
     * Create (or reuse) the backend session and sync the given files.
     * @param {Object<string, ArrayBuffer|Uint8Array|string>} files
     * @returns {Promise<import('./providerContract.js').PreviewSession>}
     */
    async prepare(files) {
        if (!this._session) {
            const response = await this._fetch('POST', `${this._basePath}/api/preview-session`);
            if (response.status !== 201) {
                throw new PreviewProviderError(`Could not create the preview session (HTTP ${response.status})`);
            }
            const body = await response.json();
            this._limits = body.limits || {};
            this._session = Object.freeze({
                id: body.previewId,
                entryUrl: `${this._basePath}/preview/${body.previewId}/index.html?exe-teacher=1`,
                mode: this.mode,
                opaqueSafe: this.opaqueSafe,
            });
        }
        await this._sync(files);
        return this._session;
    }

    /**
     * Sync updated files into the existing session.
     * @throws {PreviewSessionExpiredError} when the backend session vanished.
     */
    async update(files) {
        if (!this._session) {
            await this.prepare(files);
            return;
        }
        await this._sync(files);
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
        // `v` changes on every sync so re-setting iframe.src always re-navigates.
        return {
            kind: 'url',
            url: `${this._basePath}/preview/${this._session.id}/${encoded}?exe-teacher=1&v=${this._version}`,
        };
    }

    /**
     * Fetch a file from the session (used by the parent-side document opener).
     * @param {string} path
     * @returns {Promise<Uint8Array|null>}
     */
    async getFile(path) {
        if (!this._session) return null;
        const encoded = path
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/');
        const response = await this._fetch('GET', `${this._basePath}/preview/${this._session.id}/${encoded}`);
        if (!response.ok) return null;
        return new Uint8Array(await response.arrayBuffer());
    }

    /**
     * Delete the backend session. Failures are swallowed: the backend TTL owns
     * cleanup and dispose runs during pagehide.
     */
    async dispose({ keepalive = false } = {}) {
        const session = this._session;
        this._session = null;
        this._version = 0;
        if (!session) return;
        try {
            await this._fetchFn(`${this._basePath}/api/preview-session/${session.id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
                keepalive,
            });
        } catch (error) {
            Logger.warn('[HttpPreviewProvider] Session delete failed (TTL will reclaim it):', error);
        }
    }

    async _fetch(method, url, options = {}) {
        return this._fetchFn(url, { method, credentials: 'same-origin', ...options });
    }

    /** Decorate pages, sync the manifest and upload missing blobs. */
    async _sync(files) {
        try {
            await this._syncOnce(files);
        } catch (error) {
            // 409: a newer manifest superseded this round's uploads (stale
            // manifestId). Restage once — the second round wins by definition.
            if (error instanceof StaleManifestError) {
                await this._syncOnce(files);
                return;
            }
            throw error;
        }
    }

    async _syncOnce(files) {
        const processed = await this._processFiles(files);
        const manifest = await buildManifest(processed);

        const manifestResponse = await this._fetch(
            'POST',
            `${this._basePath}/api/preview-session/${this._session.id}/manifest`,
            {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: manifest }),
            },
        );
        this._assertSessionAlive(manifestResponse.status);
        if (manifestResponse.status !== 200) {
            throw new PreviewProviderError(`Preview manifest sync failed (HTTP ${manifestResponse.status})`);
        }
        const { manifestId, missing } = await manifestResponse.json();

        if (missing.length > 0) {
            await this._uploadMissing(processed, manifest, manifestId, new Set(missing));
        }
        this._version++;
    }

    /** Upload the blobs for missing hashes in size-bounded batches. */
    async _uploadMissing(files, manifest, manifestId, missingHashes) {
        const batchLimit = this._limits?.recommendedBatchBytes || 64 * 1024 * 1024;
        const pending = [];
        const seen = new Set();
        for (const [path, entry] of Object.entries(manifest)) {
            if (!missingHashes.has(entry.sha256) || seen.has(entry.sha256)) continue;
            seen.add(entry.sha256);
            pending.push({ hash: entry.sha256, bytes: toUint8Array(files[path]) });
        }

        let batch = [];
        let batchBytes = 0;
        const flush = async () => {
            if (batch.length === 0) return;
            const form = new FormData();
            form.append('manifestId', manifestId);
            form.append('hashes', JSON.stringify(batch.map((item) => item.hash)));
            for (const item of batch) {
                form.append('files', new Blob([item.bytes]));
            }
            const response = await this._fetch(
                'POST',
                `${this._basePath}/api/preview-session/${this._session.id}/blobs`,
                { body: form },
            );
            this._assertSessionAlive(response.status);
            if (response.status === 409) {
                throw new StaleManifestError();
            }
            if (response.status !== 200) {
                throw new PreviewProviderError(`Preview upload failed (HTTP ${response.status})`);
            }
            batch = [];
            batchBytes = 0;
        };

        for (const item of pending) {
            if (batch.length > 0 && (batchBytes + item.bytes.length > batchLimit || batch.length >= MAX_FILES_PER_BATCH)) {
                await flush();
            }
            batch.push(item);
            batchBytes += item.bytes.length;
        }
        await flush();
    }

    _assertSessionAlive(status) {
        if (status === 404) {
            const expired = this._session;
            this._session = null;
            throw new PreviewSessionExpiredError(`Preview session ${expired?.id ?? ''} expired`);
        }
    }

    /**
     * Decorate HTML pages (before hashing, so served bytes match the manifest)
     * and ship the PDF.js runtime into the session when PDFs are present.
     */
    async _processFiles(files) {
        const processed = {};
        let hasPdf = false;
        const pdfjsBase = `${this._basePath}/preview/${this._session.id}/`;

        for (const [path, content] of Object.entries(files)) {
            if (/\.pdf$/i.test(path)) hasPdf = true;
            if (/\.html?$/i.test(path)) {
                const html = typeof content === 'string' ? content : new TextDecoder().decode(content);
                processed[path] = decorateForHttp(html, {
                    pdfjsBase,
                    pdfUnavailableMessage: this._pdfUnavailableMessage,
                });
            } else {
                processed[path] = content;
            }
        }

        if (hasPdf) {
            const pdfjs = await this._loadPdfjsFiles();
            for (const [path, bytes] of Object.entries(pdfjs)) {
                if (!(path in processed)) processed[path] = bytes;
            }
        }
        return processed;
    }

    /** Fetch the PDF.js runtime from the app origin once and cache it. */
    async _loadPdfjsFiles() {
        if (this._pdfjsCache) return this._pdfjsCache;
        const loaded = {};
        for (const path of PDFJS_SESSION_FILES) {
            try {
                const response = await this._fetch('GET', `${this._basePath}/${path}`);
                if (response.ok) {
                    loaded[path] = new Uint8Array(await response.arrayBuffer());
                }
            } catch (error) {
                Logger.warn('[HttpPreviewProvider] PDF.js runtime fetch failed:', error);
            }
        }
        this._pdfjsCache = loaded;
        return loaded;
    }
}
