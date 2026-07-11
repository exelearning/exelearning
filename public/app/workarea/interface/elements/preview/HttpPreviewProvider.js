/**
 * HTTP preview transport — serving contract v2 (layered, incremental).
 *
 * The provider publishes the client-generated preview to an ephemeral backend
 * session as three layers and points the opaque iframe at the authless
 * capability URL /preview/{previewId}/…:
 *
 *  - generated documents: uploaded as atomic baseRevision→nextRevision deltas
 *    (only bytes that differ from the last ACKNOWLEDGED revision travel);
 *  - project assets: uploaded at most once per session under immutable
 *    `${assetId}@${hash16}` keys, bytes loaded lazily per missing asset;
 *  - fixed installation resources: never uploaded — referenced by id and
 *    resolved server-side through the build manifest.
 *
 * `prepare`/`update` take the layered input shape (see providerContract.js):
 * `{ documents, assetRefs, fixedRefs, getAssetBytes, resolveFixedResource }`.
 * There is no fallback to a plain file map and no protocol negotiation: a
 * create-session response without `protocolVersion: 2` is an error.
 */
import { PreviewProviderError, PreviewSessionExpiredError } from './providerContract.js';
import { decorateForHttp } from './previewContentDecorators.js';

const Logger = (typeof window !== 'undefined' && window.AppLogger) || console;

/** Translate a user-facing message when the app i18n global is available. */
function t(message) {
    const translate = typeof globalThis._ === 'function' ? globalThis._ : null;
    return translate ? translate(message) : message;
}

/** Max files per asset-upload call, independent of the byte batch limit. */
const MAX_FILES_PER_BATCH = 400;

/** Default asset batch bound when the server does not advertise one. */
const DEFAULT_BATCH_BYTES = 64 * 1024 * 1024;

/** Contract v2 asset key shape: `${assetId}@${hashPrefix}`. */
const ASSET_KEY_RE = /^[0-9a-fA-F-]{36}@[0-9a-f]{8,64}$/;

/**
 * Server rejection reasons that are TRANSIENT (space can free up, or a
 * recreated session starts empty) and must NOT permanently blacklist the key.
 * Everything else (invalid-key, asset-too-large, size-mismatch) is
 * deterministic and stays blacklisted for the session.
 */
const TRANSIENT_ASSET_REJECTIONS = new Set(['session-budget-exceeded', 'global-budget-exceeded']);

/**
 * PDF.js fixed-resource ids (ids equal the served paths). Added by the
 * provider whenever the preview references a PDF: browsers refuse the native
 * viewer inside the opaque sandbox, so the injected embed script renders
 * PDFs with PDF.js loaded session-relative — which now resolves through the
 * fixed layer instead of copying the runtime into every session.
 */
const PDFJS_FIXED_FILES = ['libs/pdfjs/pdf.min.mjs', 'libs/pdfjs/pdf.worker.min.mjs'];

/** Normalize a document value for comparison/upload (keep strings as strings). */
function normalizeContent(value) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return value;
}

/**
 * Exact equality of two document values. Strings compare as strings (never
 * encoded just to compare); binary compares byte by byte after a cheap
 * reference/length check. Mixed types count as different (worst case: one
 * redundant upload).
 */
function contentEquals(a, b) {
    if (a === b) return true;
    const aIsString = typeof a === 'string';
    const bIsString = typeof b === 'string';
    if (aIsString || bIsString) return aIsString && bIsString && a === b;
    if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
    if (a.byteLength !== b.byteLength) return false;
    for (let i = 0; i < a.byteLength; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

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
        /** Server-acknowledged revision number (0 = nothing published). */
        this._revision = 0;
        /** Asset keys the current session is known to hold. */
        this._uploadedAssetKeys = new Set();
        /** Keys the server rejected (budget/shape) — never retried this instance. */
        this._rejectedAssetKeys = new Set();
        /** Last ACKNOWLEDGED decorated documents (path → string|Uint8Array). */
        this._ackDocuments = new Map();
        /** Decoration cache: path → {raw, decorated}; hit on reference equality. */
        this._decorationCache = new Map();
        /**
         * Fixed ids this host's manifest does not know (422); their paths are
         * demoted to document writes on every future sync, bytes cached.
         * Manifest drift is an install property → survives session recreation.
         */
        this._demotedFixedIds = new Set();
        this._demotedFixedBytes = new Map();
        this._pdfjsCache = null;
    }

    /** @returns {import('./providerContract.js').PreviewSession|null} */
    get session() {
        return this._session;
    }

    /**
     * Create (or reuse) the backend session and publish the layered input.
     * @param {import('./providerContract.js').LayeredPreviewInput} input
     * @returns {Promise<import('./providerContract.js').PreviewSession>}
     */
    async prepare(input) {
        if (!this._session) {
            const response = await this._fetch('POST', `${this._basePath}/api/preview-session`);
            if (response.status !== 201) {
                throw new PreviewProviderError(
                    `${t('Could not create the preview session')} (HTTP ${response.status})`,
                );
            }
            const body = await response.json();
            if (body.protocolVersion !== 2) {
                // No silent fallback: a host answering with the wrong protocol
                // version surfaces an error instead of degrading (contract v2).
                throw new PreviewProviderError(
                    `${t('Preview endpoint does not implement protocol v2')} (got ${body.protocolVersion ?? 'none'})`,
                );
            }
            this._limits = body.limits || {};
            this._revision = typeof body.revision === 'number' ? body.revision : 0;
            // Fresh session ⇒ empty server-side stores and a new capability id
            // (the decoration bakes the session-relative pdfjs base).
            this._uploadedAssetKeys = new Set();
            this._rejectedAssetKeys = new Set();
            this._ackDocuments = new Map();
            this._decorationCache = new Map();
            this._session = Object.freeze({
                id: body.previewId,
                entryUrl: `${this._basePath}/preview/${body.previewId}/index.html?exe-teacher=1`,
                mode: this.mode,
                opaqueSafe: this.opaqueSafe,
            });
        }
        await this._sync(input);
        return this._session;
    }

    /**
     * Publish an updated layered input into the existing session.
     * @throws {PreviewSessionExpiredError} when the backend session vanished.
     */
    async update(input) {
        if (!this._session) {
            await this.prepare(input);
            return;
        }
        await this._sync(input);
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
     * The serving route resolves documents → assets → fixed transparently.
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
        this._revision = 0;
        this._uploadedAssetKeys = new Set();
        this._rejectedAssetKeys = new Set();
        this._ackDocuments = new Map();
        this._decorationCache = new Map();
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

    /** 404 from any session endpoint ⇒ the session vanished: reset and signal. */
    _assertSessionAlive(status) {
        if (status === 404) {
            const expired = this._session;
            this._session = null;
            this._revision = 0;
            this._uploadedAssetKeys = new Set();
            this._rejectedAssetKeys = new Set();
            this._ackDocuments = new Map();
            this._decorationCache = new Map();
            throw new PreviewSessionExpiredError(`Preview session ${expired?.id ?? ''} expired`);
        }
    }

    async _safeJson(response) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    /** Validate the layered input shape — no duck-typing surprises. */
    _validateInput(input) {
        if (
            !input ||
            !(input.documents instanceof Map) ||
            !(input.assetRefs instanceof Map) ||
            !(input.fixedRefs instanceof Map)
        ) {
            throw new PreviewProviderError(
                'HttpPreviewProvider requires layered preview input ' +
                    '({documents, assetRefs, fixedRefs, getAssetBytes}); plain file maps are for other transports',
            );
        }
    }

    /**
     * One full publication round: decorate → asset uploads → revision delta →
     * bounded error recovery (409 conflict, 422 missing-assets, 422
     * unknown-fixed-resources — each recovered at most once per round).
     */
    async _sync(input) {
        this._validateInput(input);

        const decorated = this._decorateDocuments(input.documents);
        const assetKeyByPath = this._buildAssetKeys(input.assetRefs);
        const fixedRefs = new Map(input.fixedRefs);
        this._addPdfjsFixedRefs(decorated, assetKeyByPath, fixedRefs);
        await this._applyStandingDemotions(decorated, fixedRefs, input);

        await this._uploadMissingAssets(assetKeyByPath, input.getAssetBytes);
        // Paths whose asset can not be served (rejected by the server or blob
        // unavailable) are dropped from the ref map: the preview degrades to a
        // 404 for that one file instead of failing entirely; unavailable blobs
        // are retried on the next refresh.
        for (const [path, entry] of [...assetKeyByPath]) {
            if (!this._uploadedAssetKeys.has(entry.key)) assetKeyByPath.delete(path);
        }

        // Delta against the last acknowledged revision.
        let writes = new Map();
        for (const [path, value] of decorated) {
            const acked = this._ackDocuments.get(path);
            if (acked === undefined || !contentEquals(acked, value)) writes.set(path, value);
        }
        let deletes = [...this._ackDocuments.keys()].filter((path) => !decorated.has(path));
        let baseRevision = this._revision;

        const recovered = { conflict: false, missingAssets: false, unknownFixed: false };
        for (;;) {
            const response = await this._postRevision(baseRevision, writes, deletes, assetKeyByPath, fixedRefs);
            this._assertSessionAlive(response.status);

            if (response.status === 200) {
                const body = await this._safeJson(response);
                this._revision = typeof body?.revision === 'number' ? body.revision : baseRevision + 1;
                this._ackDocuments = new Map(decorated);
                break;
            }

            const body = await this._safeJson(response);

            if (response.status === 409 && body?.reason === 'revision-conflict' && !recovered.conflict) {
                recovered.conflict = true;
                // Stateless recovery: resend a full snapshot of the generated
                // document layer at the server's current revision. Assets are
                // NOT re-uploaded (422 missing-assets lists real losses).
                baseRevision = body.currentRevision;
                writes = new Map(decorated);
                deletes = [];
                continue;
            }

            if (response.status === 422 && body?.reason === 'missing-assets' && !recovered.missingAssets) {
                recovered.missingAssets = true;
                for (const key of body.missing || []) this._uploadedAssetKeys.delete(key);
                await this._uploadMissingAssets(assetKeyByPath, input.getAssetBytes);
                for (const [path, entry] of [...assetKeyByPath]) {
                    if (!this._uploadedAssetKeys.has(entry.key)) assetKeyByPath.delete(path);
                }
                continue;
            }

            if (response.status === 422 && body?.reason === 'unknown-fixed-resources' && !recovered.unknownFixed) {
                recovered.unknownFixed = true;
                await this._demoteFixedResources(body.resources || [], decorated, fixedRefs, writes, input);
                continue;
            }

            throw new PreviewProviderError(`${t('Preview sync failed')} (HTTP ${response.status})`);
        }

        this._version++;
    }

    /**
     * Decorate HTML documents for the opaque transport. Decoration is cached
     * per path and only recomputed when the raw value changed — the generator
     * copies untouched pages by reference, so reused pages hit the cache.
     */
    _decorateDocuments(documents) {
        const decorated = new Map();
        const pdfjsBase = `${this._basePath}/preview/${this._session.id}/`;
        // The shim is served same-origin from the app (not the session), so an
        // absolute-from-root URL is used; the opaque iframe loads it under CSP 'self'.
        const embedShimUrl = `${this._basePath}/app/common/exe_embed_bridge/exe_embed_shim.js`;

        for (const [path, content] of documents) {
            if (!/\.html?$/i.test(path)) {
                decorated.set(path, normalizeContent(content));
                continue;
            }
            const cached = this._decorationCache.get(path);
            if (cached && cached.raw === content) {
                decorated.set(path, cached.decorated);
                continue;
            }
            const html = typeof content === 'string' ? content : new TextDecoder().decode(content);
            const output = decorateForHttp(html, {
                pdfjsBase,
                pdfUnavailableMessage: this._pdfUnavailableMessage,
                embedShimUrl,
            });
            this._decorationCache.set(path, { raw: content, decorated: output });
            decorated.set(path, output);
        }

        // Drop cache entries for paths that no longer exist.
        for (const path of [...this._decorationCache.keys()]) {
            if (!documents.has(path)) this._decorationCache.delete(path);
        }
        return decorated;
    }

    /**
     * Derive contract asset keys (`${assetId}@${hash16}`) from the generator's
     * asset refs. Keys are identities from the project model — NEVER derived
     * from export paths. Invalid shapes are dropped with a warning (the
     * generator routes those assets through the document layer already).
     * @returns {Map<string, {key: string, assetId: string, size: number}>}
     */
    _buildAssetKeys(assetRefs) {
        const byPath = new Map();
        for (const [path, ref] of assetRefs) {
            const hash = (ref?.hash || '').toLowerCase();
            const key = `${ref?.assetId}@${hash.slice(0, 16)}`;
            if (!ASSET_KEY_RE.test(key)) {
                Logger.warn(`[HttpPreviewProvider] Dropping asset ref with invalid identity for ${path}`);
                continue;
            }
            if (this._rejectedAssetKeys.has(key)) continue;
            byPath.set(path, { key, assetId: ref.assetId, size: typeof ref.size === 'number' ? ref.size : 0 });
        }
        return byPath;
    }

    /**
     * Reference the PDF.js runtime through the fixed layer whenever any PDF is
     * part of the preview (documents or assets). Ids equal the served paths.
     */
    _addPdfjsFixedRefs(decorated, assetKeyByPath, fixedRefs) {
        let hasPdf = false;
        for (const path of decorated.keys()) {
            if (/\.pdf$/i.test(path)) {
                hasPdf = true;
                break;
            }
        }
        if (!hasPdf) {
            for (const path of assetKeyByPath.keys()) {
                if (/\.pdf$/i.test(path)) {
                    hasPdf = true;
                    break;
                }
            }
        }
        if (!hasPdf) return;
        for (const path of PDFJS_FIXED_FILES) {
            if (!decorated.has(path) && !fixedRefs.has(path)) fixedRefs.set(path, path);
        }
    }

    /**
     * Re-apply known manifest gaps: fixed ids a previous round demoted keep
     * being shipped as document bytes so the server never sees them again.
     */
    async _applyStandingDemotions(decorated, fixedRefs, input) {
        if (this._demotedFixedIds.size === 0) return;
        for (const [path, id] of [...fixedRefs]) {
            if (!this._demotedFixedIds.has(id)) continue;
            const bytes = await this._fixedResourceBytes(id, input);
            if (!bytes) continue; // leave the ref; the server will 422 and the round will surface it
            fixedRefs.delete(path);
            decorated.set(path, this._decorateDemoted(path, bytes));
        }
    }

    /**
     * 422 unknown-fixed-resources recovery: fetch the bytes behind each
     * unknown id (generator callback; PDF.js from the app origin) and demote
     * the affected paths to document writes, then the caller retries once.
     * Unresolvable ids surface a clear error — never a silent hole.
     */
    async _demoteFixedResources(resourceIds, decorated, fixedRefs, writes, input) {
        for (const id of resourceIds) {
            const paths = [...fixedRefs].filter(([, fid]) => fid === id).map(([path]) => path);
            if (paths.length === 0) continue;
            const bytes = await this._fixedResourceBytes(id, input);
            if (!bytes) {
                throw new PreviewProviderError(
                    `${t('Preview host does not know fixed resource')} '${id}' ${t('and it could not be regenerated')}`,
                );
            }
            this._demotedFixedIds.add(id);
            this._demotedFixedBytes.set(id, bytes);
            for (const path of paths) {
                fixedRefs.delete(path);
                const value = this._decorateDemoted(path, bytes);
                decorated.set(path, value);
                writes.set(path, value);
            }
        }
    }

    /** Bytes behind a fixed id: demotion cache → PDF.js app fetch → generator callback. */
    async _fixedResourceBytes(id, input) {
        const cached = this._demotedFixedBytes.get(id);
        if (cached) return cached;
        if (PDFJS_FIXED_FILES.includes(id)) {
            const loaded = await this._loadPdfjsFiles();
            return loaded[id] || null;
        }
        if (typeof input.resolveFixedResource === 'function') {
            try {
                return await input.resolveFixedResource(id);
            } catch (error) {
                Logger.warn(`[HttpPreviewProvider] resolveFixedResource failed for '${id}':`, error);
                return null;
            }
        }
        return null;
    }

    /** Demoted fixed HTML is decorated like any served page; binary passes through. */
    _decorateDemoted(path, bytes) {
        if (!/\.html?$/i.test(path)) return bytes;
        const html = new TextDecoder().decode(bytes);
        return decorateForHttp(html, {
            pdfjsBase: `${this._basePath}/preview/${this._session.id}/`,
            pdfUnavailableMessage: this._pdfUnavailableMessage,
            embedShimUrl: `${this._basePath}/app/common/exe_embed_bridge/exe_embed_shim.js`,
        });
    }

    /**
     * Upload asset bytes the session is missing, in multipart batches bounded
     * by recommendedBatchBytes (an oversized asset ships alone). Bytes are
     * loaded lazily per asset via getAssetBytes and released after upload.
     */
    async _uploadMissingAssets(assetKeyByPath, getAssetBytes) {
        const missing = [];
        const seen = new Set();
        for (const entry of assetKeyByPath.values()) {
            if (this._uploadedAssetKeys.has(entry.key) || this._rejectedAssetKeys.has(entry.key)) continue;
            if (seen.has(entry.key)) continue;
            seen.add(entry.key);
            missing.push(entry);
        }
        if (missing.length === 0) return;
        if (typeof getAssetBytes !== 'function') {
            throw new PreviewProviderError(
                'HttpPreviewProvider input is missing getAssetBytes (required to upload project assets)',
            );
        }

        const batchLimit = this._limits?.recommendedBatchBytes || DEFAULT_BATCH_BYTES;
        let batch = [];
        let batchBytes = 0;

        const flush = async () => {
            if (batch.length === 0) return;
            const form = new FormData();
            form.append('assets', JSON.stringify(batch.map(({ key, size }) => ({ key, size }))));
            for (const item of batch) {
                form.append('files', new Blob([item.bytes]));
            }
            // Release byte references before awaiting so uploaded buffers can
            // be collected while the next batch loads.
            batch = [];
            batchBytes = 0;
            const response = await this._fetch(
                'POST',
                `${this._basePath}/api/preview-session/${this._session.id}/assets`,
                { body: form },
            );
            this._assertSessionAlive(response.status);
            if (response.status !== 200) {
                throw new PreviewProviderError(`${t('Preview asset upload failed')} (HTTP ${response.status})`);
            }
            const body = await this._safeJson(response);
            for (const key of [...(body?.stored || []), ...(body?.alreadyStored || [])]) {
                this._uploadedAssetKeys.add(key);
            }
            for (const rejected of body?.rejected || []) {
                if (!rejected?.key) continue;
                // Only DETERMINISTIC rejections are blacklisted for the session:
                // an invalid key / oversized asset / size mismatch will fail
                // identically on every retry. Budget rejections are TRANSIENT
                // (global LRU eviction frees space; a recreated session starts
                // empty), so leave those keys retryable — the next sync attempts
                // them again rather than 404-ing the asset for the whole session.
                if (TRANSIENT_ASSET_REJECTIONS.has(rejected.reason)) {
                    Logger.warn(
                        `[HttpPreviewProvider] Asset ${rejected.key} rejected (${rejected.reason}); will retry on the next sync`,
                    );
                    continue;
                }
                Logger.warn(
                    `[HttpPreviewProvider] Server rejected asset ${rejected.key} (${rejected.reason || 'unknown reason'}); its paths will 404 in the preview`,
                );
                this._rejectedAssetKeys.add(rejected.key);
            }
        };

        for (const entry of missing) {
            let bytes = null;
            try {
                bytes = await getAssetBytes(entry.assetId);
            } catch (error) {
                Logger.warn(`[HttpPreviewProvider] getAssetBytes failed for ${entry.assetId}:`, error);
            }
            if (!bytes || bytes.byteLength === undefined) {
                // Blob not locally available (e.g. still syncing from a peer):
                // skip now, retried automatically on the next refresh.
                Logger.warn(`[HttpPreviewProvider] Asset bytes unavailable for ${entry.assetId}; retrying next refresh`);
                continue;
            }
            if (batch.length >= MAX_FILES_PER_BATCH || (batch.length > 0 && batchBytes + bytes.byteLength > batchLimit)) {
                await flush();
            }
            batch.push({ key: entry.key, size: bytes.byteLength, bytes });
            batchBytes += bytes.byteLength;
            if (batchBytes >= batchLimit) {
                await flush();
            }
        }
        await flush();
    }

    /** POST one revision (multipart: 'revision' JSON + files[] aligned with writes). */
    async _postRevision(baseRevision, writes, deletes, assetKeyByPath, fixedRefs) {
        const assetRefsJson = {};
        for (const [path, entry] of assetKeyByPath) assetRefsJson[path] = entry.key;
        const fixedRefsJson = {};
        for (const [path, id] of fixedRefs) fixedRefsJson[path] = id;

        const form = new FormData();
        form.append(
            'revision',
            JSON.stringify({
                baseRevision,
                nextRevision: baseRevision + 1,
                writes: [...writes.keys()],
                deletes,
                assetRefs: assetRefsJson,
                fixedRefs: fixedRefsJson,
            }),
        );
        for (const value of writes.values()) {
            form.append('files', new Blob([value]));
        }
        return this._fetch('POST', `${this._basePath}/api/preview-session/${this._session.id}/revisions`, {
            body: form,
        });
    }

    /** Fetch the PDF.js runtime from the app origin once and cache it. */
    async _loadPdfjsFiles() {
        if (this._pdfjsCache) return this._pdfjsCache;
        const loaded = {};
        for (const path of PDFJS_FIXED_FILES) {
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
