/* global eXe */

/**
 * Three D Viewer iDevice (export runtime)
 *
 * - Loads the model-viewer web component (ES module) once per page.
 * - Renders a <model-viewer> using the JSON stored by the edition view.
 * - Works on initial page load (refresh) without entering Edit mode.
 */

(function () {
    const globalScope = typeof window !== 'undefined' ? window : globalThis;

    /** Default background color */
    const DEFAULT_BACKGROUND = '#f5f5f5';

    /** Fallback translations when i18n is not available */
    const FALLBACK_TRANSLATIONS = {
        'viewer.empty_state': 'Select a 3D model to display',
        'viewer.animation_paused': 'Animation paused',
        'viewer.animation_enabled': 'Animation enabled',
        'viewer.local_warning_title': '3D Viewer not available',
        'viewer.local_warning_message': 'The 3D viewer requires a web server to work. Open this content from a web server or use eXeLearning preview.',
        'viewer.fullscreen': 'Fullscreen',
        'viewer.exit_fullscreen': 'Exit fullscreen',
        'viewer.rotate_left': 'Rotate left',
        'viewer.rotate_right': 'Rotate right',
        'viewer.tilt_up': 'Tilt up',
        'viewer.tilt_down': 'Tilt down'
    };

    /** Camera nudge step (radians) — matches threesixty viewer feel */
    const YAW_STEP = (15 * Math.PI) / 180;
    const PITCH_STEP = (10 * Math.PI) / 180;

    /**
     * Build the toolbar markup (fullscreen button + 4-direction nav pad).
     * Rendered once into the wrapper so it ships with the static export.
     * Returns empty string when nav controls are not enabled in the config.
     * @param {object} [cfg]
     * @returns {string}
     */
    function buildControlsMarkup(cfg) {
        if (!cfg?.showNavControls) return '';
        const fs = translate('viewer.fullscreen');
        const nav = [
            ['left',  '←', translate('viewer.rotate_left')],
            ['up',    '↑', translate('viewer.tilt_up')],
            ['down',  '↓', translate('viewer.tilt_down')],
            ['right', '→', translate('viewer.rotate_right')],
        ];
        const navBtns = nav
            .map(([key, glyph, label]) =>
                `<button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-${key}" data-nav="${key}" aria-label="${label}" title="${label}">${glyph}</button>`)
            .join('');
        return `
            <button type="button" class="three-d-viewer-fullscreen-button" data-fullscreen aria-label="${fs}" title="${fs}">⛶</button>
            <div class="three-d-viewer-nav" role="group" aria-label="${translate('viewer.rotate_left')}">${navBtns}</div>
        `;
    }

    /**
     * Clamp a value to [min, max].
     */
    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    /**
     * Simple i18n helper. Falls back to built-in translations if _() is not present.
     * @param {string} key
     * @returns {string}
     */
    function translate(key) {
        try {
            if (typeof globalScope._ === 'function') {
                const translated = globalScope._(key);
                // If translation returns the key, use fallback
                if (translated !== key) {
                    return translated;
                }
            }
        } catch (err) {}
        return FALLBACK_TRANSLATIONS[key] || key;
    }

    /**
     * Build an absolute URL for an app-relative path using eXe symfony baseURL/basePath.
     * @param {string} path
     * @returns {string}
     */
    function resolveAssetUrl(path) {
        const sym = globalScope.eXeLearning?.symfony || {};
        const baseURL = String(sym.baseURL || '').replace(/\/+$/g, '');
        const basePath = sym.basePath ? '/' + String(sym.basePath).replace(/^\/+|\/+$/g, '') : '';
        const norm = String(path || '').replace(/^\/+/, '');
        const prefix = (baseURL + basePath).replace(/\/+$/g, '');
        return prefix ? `${prefix}/${norm}` : `/${norm}`;
    }

    /**
     * Detect the current execution mode for path resolution.
     *
     * Modes are checked in priority order but may overlap:
     * 1. Static mode - PWA/offline build (isStaticMode or isOfflineInstallation in config)
     * 2. Server mode - Running on eXeLearning server (config.baseURL is defined)
     * 3. Export mode - Standalone HTML export (html id starts with 'exe-')
     * 4. Preview mode - Inside workarea preview panel (AssetManager available)
     *
     * WHY check html[id^="exe-"]: Exported HTML files have the root element id
     * set to 'exe-index' or 'exe-{pageId}', which distinguishes them from
     * the workarea or server-rendered pages.
     *
     * @returns {{isStaticMode: boolean, isServerMode: boolean, isExportMode: boolean, isOnIndexPage: boolean, isPreviewMode: boolean}}
     */
    function detectMode() {
        const config = globalScope.eXeLearning?.config;
        const parsedConfig = typeof config === 'string'
            ? (function() { try { return JSON.parse(config); } catch(e) { return null; } })()
            : config;

        return {
            isStaticMode: !!(parsedConfig?.isStaticMode || parsedConfig?.isOfflineInstallation),
            isServerMode: parsedConfig?.baseURL !== undefined,
            isExportMode: document.documentElement.id === 'exe-index' ||
                          document.querySelector('html[id^="exe-"]') !== null,
            isOnIndexPage: document.documentElement.id === 'exe-index',
            isPreviewMode: !!getAssetManager()
        };
    }

    /**
     * Compute the resources base path for offline export: content/resources/<ideviceId>/
     * Falls back to ../content/resources when not on index.
     * @param {string} ideviceId
     * @returns {string}
     */
    function getIdeviceResourcesBase(ideviceId) {
        if (!ideviceId) return '';
        const onIndex = document.documentElement.id === 'exe-index';
        return onIndex
            ? `content/resources/${ideviceId}/`
            : `../content/resources/${ideviceId}/`;
    }

    /**
     * Get the URL for the model-viewer library.
     *
     * Mode-aware path resolution:
     * - Static mode: Returns `./files/perm/...` (relative to app root)
     * - Server mode: Returns resolved absolute URL via resolveAssetUrl
     * - Export mode on index: Returns `./idevices/...` (relative to index.html)
     * - Export mode on subpage: Returns `../idevices/...` (up one level from html/)
     * - Fallback: Uses symfony config via resolveAssetUrl
     *
     * WHY different paths for export: Exported packages have a specific structure
     * where libraries are in `idevices/<type>/` folder. Index.html is at the root,
     * while subpages are in `html/` folder, requiring the `../` prefix.
     *
     * @returns {string} URL to model-viewer.min.js
     */
    function getModelViewerLibUrl() {
        const mode = detectMode();

        if (mode.isStaticMode) {
            return './files/perm/idevices/base/three-d-viewer/export/model-viewer.min.js';
        }
        if (mode.isServerMode) {
            return resolveAssetUrl('files/perm/idevices/base/three-d-viewer/export/model-viewer.min.js');
        }
        if (mode.isExportMode) {
            return mode.isOnIndexPage
                ? './idevices/three-d-viewer/model-viewer.min.js'
                : '../idevices/three-d-viewer/model-viewer.min.js';
        }
        // Fallback to resolveAssetUrl
        return resolveAssetUrl('files/perm/idevices/base/three-d-viewer/export/model-viewer.min.js');
    }

    /**
     * Get the base URL for Three.js modules (STLLoader, OrbitControls, etc.).
     *
     * WHY mode-aware: Different execution contexts need different path strategies:
     * - Static: Uses origin for absolute URL (prevents path duplication in dynamic imports)
     * - Server: Builds from config.baseURL + basePath (handles subdirectory installs)
     * - Export: Uses page URL base + relative paths (./idevices or ../idevices)
     *   based on whether we're on index.html or a subpage in html/ folder
     * - Fallback: Uses symfony config (legacy support for workarea)
     *
     * WHY absolute URLs for imports: Dynamic import() resolves paths relative to the
     * current module's location. If we return a relative path and the module is loaded
     * from a nested location, the browser may resolve it incorrectly, causing path
     * duplication (e.g., `/path/to/files/perm/.../path/to/...`). Using absolute URLs
     * with protocol (http://... or https://...) prevents this issue entirely.
     *
     * @returns {string} Absolute URL ending with trailing slash for module base path
     */
    function getThreeJSBaseUrl() {
        const mode = detectMode();

        if (mode.isStaticMode) {
            // Static mode: use origin + absolute path for dynamic imports
            return `${globalScope.location.origin}/files/perm/idevices/base/three-d-viewer/export/`;
        }
        if (mode.isServerMode) {
            // Server mode: build absolute URL with protocol
            const config = globalScope.eXeLearning?.config;
            const baseURL = (config?.baseURL || globalScope.location.origin).replace(/\/+$/g, '');
            const basePath = config?.basePath ? `/${config.basePath.replace(/^\/+|\/+$/g, '')}` : '';
            return `${baseURL}${basePath}/files/perm/idevices/base/three-d-viewer/export/`;
        }
        if (mode.isExportMode) {
            // Export mode: resolve relative to current page location
            const currentUrl = globalScope.location.href;
            const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
            const prefix = mode.isOnIndexPage ? '' : '../';
            return `${baseUrl}${prefix}idevices/three-d-viewer/`;
        }
        // Fallback: use symfony config with absolute URL
        const sym = globalScope.eXeLearning?.symfony || {};
        const baseURL = (sym.baseURL || globalScope.location.origin).replace(/\/+$/g, '');
        const basePath = sym.basePath ? '/' + String(sym.basePath).replace(/^\/+|\/+$/g, '') : '';
        return `${baseURL}${basePath}/files/perm/idevices/base/three-d-viewer/export/`;
    }

    /**
     * Check if a path refers to an STL file.
     * @param {string} path
     * @returns {boolean}
     */
    function isSTLFile(path) {
        if (!path) return false;
        const filename = path.split('/').pop() || '';
        return filename.toLowerCase().endsWith('.stl');
    }

    /**
     * Check if we're running from file:// protocol (local HTML file).
     * ES modules and model-viewer don't work with file:// due to CORS restrictions.
     * @returns {boolean}
     */
    function isLocalFileProtocol() {
        try {
            return globalScope.location?.protocol === 'file:';
        } catch (e) {
            return false;
        }
    }

    /**
     * Build the HTML for the local file warning.
     * @returns {string}
     */
    function buildLocalWarningHTML() {
        const title = translate('viewer.local_warning_title');
        const message = translate('viewer.local_warning_message');
        return `
            <div class="three-d-viewer-local-warning" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                min-height: 200px;
                padding: 2rem;
                text-align: center;
                background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
                border-radius: 8px;
                border: 2px dashed #ccc;
            ">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.5" style="margin-bottom: 1rem; opacity: 0.7;">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <strong style="font-size: 1.1rem; color: #333; margin-bottom: 0.5rem;">${title}</strong>
                <p style="color: #666; margin: 0; max-width: 300px; line-height: 1.4;">${message}</p>
            </div>
        `;
    }

    /**
     * Normalize input path.
     * - Trim, unify slashes, strip leading slash.
     * - Keep absolute URLs as-is.
     * @param {string} path
     * @returns {string}
     */
    function normalizePath(path) {
        const clean = String(path || '').trim().replace(/\\+/g, '/');
        if (!clean) return '';
        if (/^(https?:)?\/\//i.test(clean)) return clean;
        return clean.replace(/^\/+/, '');
    }

    /**
     * Get the AssetManager from current window or parent window (for preview iframe).
     * @returns {object|null}
     */
    function getAssetManager() {
        // Check current window
        let assetManager = globalScope.eXeLearning?.app?.project?.assetManager ||
                           globalScope.eXeLearning?.app?.project?._yjsBridge?.assetManager;
        if (assetManager) return assetManager;

        // Check parent window (for preview iframe)
        try {
            assetManager = globalScope.parent?.eXeLearning?.app?.project?.assetManager ||
                           globalScope.parent?.eXeLearning?.app?.project?._yjsBridge?.assetManager;
            if (assetManager) return assetManager;
        } catch (e) {
            // Cross-origin access denied - we're in a true export context
        }

        return null;
    }

    /**
     * Check if we're in preview/online context (AssetManager available).
     * In preview context, asset:// URLs should be kept for blob resolution.
     * In export context (offline HTML), they should be converted to content/resources/.
     * @returns {boolean}
     */
    function isPreviewContext() {
        return !!getAssetManager();
    }

    /**
     * Try to use ODE session-based temporary path if available, then fall back to plain asset path.
     * Accept already sessionized or absolute URLs as-is.
     * Handles asset:// URLs by resolving to iDevice resources path in export context.
     * In preview context, resolves asset:// URLs to blob URLs via AssetManager.
     * @param {string} path
     * @param {string} [ideviceId] - Optional iDevice ID for asset:// resolution
     * @returns {string}
     */
    function resolveRuntimeSrc(path, ideviceId) {
        const clean = normalizePath(path);
        if (!clean) return '';
        if (/^(https?:)?\/\//i.test(clean)) return clean;
        if (clean.startsWith('blob:')) return clean;
        if (clean.startsWith('files/tmp/')) return resolveAssetUrl(clean);

        // Handle asset:// URLs
        if (clean.startsWith('asset://')) {
            // In preview/online context, resolve to blob URL via AssetManager
            const assetManager = getAssetManager();
            if (assetManager) {
                if (typeof assetManager.resolveAssetURLSync === 'function') {
                    const blobUrl = assetManager.resolveAssetURLSync(clean);
                    if (blobUrl) {
                        return blobUrl;
                    }
                }
                // If AssetManager can't resolve it yet, return empty to prevent 404
                // The async resolution in applyConfig will handle it
                return '';
            }

            // In export context (offline HTML), resolve to content/resources path
            // asset://uuid.glb -> content/resources/uuid.glb
            const assetPath = clean.substring('asset://'.length);
            if (assetPath) {
                const onIndex = document.documentElement.id === 'exe-index';
                return (onIndex ? 'content/resources/' : '../content/resources/') + assetPath;
            }
            return '';
        }

        // Post-export paths already rewritten by IdeviceRenderer.fixAssetUrls
        // (preview pipeline AND static export both run that helper). Return
        // them *relative* — calling `resolveAssetUrl` here would prepend a
        // leading `/` making the URL absolute to the origin, so a preview
        // iframe served at `/viewer/index.html` would request
        // `/content/resources/foo.stl` instead of
        // `/viewer/content/resources/foo.stl` and miss the Service Worker
        // interceptor (404 → STLLoader parses the HTML 404 page → the
        // "Invalid typed array length" crash). Relative paths resolve
        // against the document URL: in preview they pick up the `/viewer/`
        // prefix automatically, in static export they stay relative to
        // index.html / html/<page>.html.
        if (clean.startsWith('content/resources/') || clean.startsWith('../content/resources/')) {
            return clean;
        }

        // If the edition stored "file_manager/..." and an ODE session exists, build the session path.
        const sessionId = (function () {
            const s = globalScope.eXeLearning?.app?.project?.odeSession;
            return typeof s === 'string' && s.trim().length >= 8 ? s.trim() : '';
        })();

        if (sessionId) {
            const year = sessionId.substring(0, 4);
            const month = sessionId.substring(4, 6);
            const day = sessionId.substring(6, 8);
            const sessionPath = `files/tmp/${year}/${month}/${day}/${sessionId}/${clean}`;
            return resolveAssetUrl(sessionPath);
        }

        // Plain file inside app
        return resolveAssetUrl(clean);
    }

    /**
     * Resolve asset:// URL to blob URL asynchronously.
     * Waits for AssetManager to be available and the asset to be loaded.
     * @param {string} assetUrl - asset:// URL
     * @param {number} [timeout=10000] - Max wait time in ms
     * @returns {Promise<string|null>}
     */
    async function resolveAssetUrlAsync(assetUrl, timeout = 10000) {
        if (!assetUrl || !assetUrl.startsWith('asset://')) {
            return null;
        }

        const startTime = Date.now();
        const pollInterval = 100;

        while (Date.now() - startTime < timeout) {
            const assetManager = getAssetManager();
            if (assetManager) {
                // Try sync method first (faster if asset is already loaded)
                if (typeof assetManager.resolveAssetURLSync === 'function') {
                    const blobUrl = assetManager.resolveAssetURLSync(assetUrl);
                    if (blobUrl) {
                        return blobUrl;
                    }
                }
                // Try async method which will load the asset if needed
                if (typeof assetManager.resolveAssetURL === 'function') {
                    try {
                        const blobUrl = await assetManager.resolveAssetURL(assetUrl);
                        if (blobUrl) {
                            return blobUrl;
                        }
                    } catch (err) {
                        // Asset not ready yet, keep polling
                    }
                }
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        console.warn('[3D Viewer] Timeout resolving asset URL:', assetUrl);
        return null;
    }

    /**
     * Append a single <link rel="modulepreload"> if not present.
     * @param {string} href
     */
    function appendModulePreloadOnce(href) {
        if (!href) return;
        if (document.querySelector(`link[rel="modulepreload"][href="${href}"]`)) return;
        const l = document.createElement('link');
        l.rel = 'modulepreload';
        l.href = href;
        document.head.appendChild(l);
    }

    /**
     * Ensure Three.js modules are loaded for STL rendering.
     * Uses dynamic imports with ES modules.
     * @returns {Promise<void>}
     */
    async function ensureThreeJSLoaded() {
        if (globalScope.THREE?.STLLoader && globalScope.THREE?.OrbitControls) {
            return;
        }

        globalScope.$exeLibs = globalScope.$exeLibs || {};
        if (globalScope.$exeLibs.threeJSPromise) {
            return globalScope.$exeLibs.threeJSPromise;
        }

        const basePath = getThreeJSBaseUrl();

        globalScope.$exeLibs.threeJSPromise = (async () => {
            try {
                const THREE = await import(basePath + 'three.module.min.js');
                const { STLLoader } = await import(basePath + 'STLLoader.js');
                const { OrbitControls } = await import(basePath + 'OrbitControls.js');

                globalScope.THREE = globalScope.THREE || {};
                Object.assign(globalScope.THREE, THREE);
                globalScope.THREE.STLLoader = STLLoader;
                globalScope.THREE.OrbitControls = OrbitControls;
            } catch (err) {
                console.error('[3D Viewer] Failed to load Three.js modules:', err);
                throw err;
            }
        })();

        return globalScope.$exeLibs.threeJSPromise;
    }

    /**
     * Ensure the shared eXe3DViewer runtime script is loaded.
     * Uses a global promise to coordinate with the edition path.
     */
    function ensureRuntimeLoaded() {
        if (globalScope.eXe3DViewer) return Promise.resolve();
        globalScope.$exeLibs = globalScope.$exeLibs || {};
        if (globalScope.$exeLibs.threeDViewerRuntimePromise) {
            return globalScope.$exeLibs.threeDViewerRuntimePromise;
        }
        const url = getThreeJSBaseUrl() + 'three-d-viewer-runtime.js';
        globalScope.$exeLibs.threeDViewerRuntimePromise = new Promise((resolve) => {
            const existing = document.querySelector('script[data-threedviewer-runtime]');
            if (existing) {
                if (globalScope.eXe3DViewer) { resolve(); return; }
                existing.addEventListener('load', () => resolve());
                return;
            }
            const script = document.createElement('script');
            script.src = url;
            script.dataset.threedviewerRuntime = '1';
            script.addEventListener('load', () => resolve());
            script.addEventListener('error', () => resolve());
            document.head.appendChild(script);
        });
        return globalScope.$exeLibs.threeDViewerRuntimePromise;
    }

    /**
     * Ensure the model-viewer module is loaded and defined.
     * Uses a global promise to prevent duplicate loading.
     * @param {string} ideviceId
     */
    async function ensureModelViewerModule(ideviceId) {
        // Early exit if already registered
        if (globalScope.customElements?.get?.('model-viewer')) return;

        // Use global namespace to coordinate loading across edition/export
        globalScope.$exeLibs = globalScope.$exeLibs || {};

        // If another context (edition) is already loading, wait for it
        if (globalScope.$exeLibs.modelViewerPromise) {
            try {
                await globalScope.$exeLibs.modelViewerPromise;
            } catch (err) {}
            return;
        }

        // Re-check after awaiting (edition may have finished loading)
        if (globalScope.customElements?.get?.('model-viewer')) return;

        const candidates = [
            getModelViewerLibUrl(),
            getIdeviceResourcesBase(ideviceId) ? getIdeviceResourcesBase(ideviceId) + 'model-viewer.min.js' : null
        ].filter(Boolean);

        globalScope.$exeLibs.modelViewerPromise = (async () => {
            for (const url of candidates) {
                // Skip if already registered (race condition check)
                if (globalScope.customElements?.get?.('model-viewer')) return;

                try {
                    // Inject script and wait for it to load
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = url;
                        s.onload = resolve;
                        s.onerror = reject;
                        document.head.appendChild(s);
                    });
                    break;
                } catch (err) {
                    // Try next candidate
                }
            }
        })();

        try {
            await globalScope.$exeLibs.modelViewerPromise;
            if (globalScope.customElements?.whenDefined) {
                await globalScope.customElements.whenDefined('model-viewer');
            }
        } catch (err) {
            // Keep going; runtime will attempt again if needed
        }
    }

    /**
     * Build the <model-viewer> tag.
     *
     * The `src` attribute is NOT set here — the runtime owns it (sets it
     * at boot from the wrapper's `data-model-src`). Two reasons:
     *
     *   1. STL files would crash model-viewer's GLB/GLTF/USDZ loader with
     *      `SyntaxError: Unexpected token 'C', "COLOR= "... is not valid
     *      JSON` (the ASCII STL header starts with "COLOR="). See #1810.
     *   2. The persisted HTML must not leak blob: URLs; setting the src
     *      at runtime keeps the wrapper's `data-model-src` the only
     *      canonical reference (`asset://` in editor, rewritten to
     *      `content/resources/...` in static export by
     *      `IdeviceRenderer.fixAssetUrls`).
     *
     * @param {object} data
     * @returns {string}
     */
    function buildModelMarkup(data) {
        const attributes = [
            ['shadow-intensity', '1'],
            ['tone-mapping', 'pbr-neutral'],
            ['reveal', 'auto'],
            ['style', `background-color: ${data.backgroundColor || DEFAULT_BACKGROUND};`]
        ];
        if (data.alt) {
            attributes.push(['alt', data.alt]);
            attributes.push(['aria-label', data.alt]);
        }
        if (data.cameraControls !== false) attributes.push(['camera-controls', '']);
        if (data.autoRotate) {
            attributes.push(['auto-rotate', '']);
            attributes.push(['rotation-per-second', `${data.autoRotateSpeed || 30}deg`]);
        }

        const attrString = attributes
            .map(([k, v]) => (v === '' ? k : `${k}="${v}"`))
            .join(' ');

        return `<model-viewer ${attrString}></model-viewer>`;
    }

    /**
     * Build the flat data-* attribute string for the wrapper.
     *
     * Picked up automatically by `IdeviceRenderer.fixAssetUrls` on export
     * (it runs a global `asset://...` regex over the rendered HTML with
     * no attribute-name filter), so canonical `asset://uuid.ext` URLs
     * get rewritten to `content/resources/...` with no special handling.
     *
     * @param {object} cfg - normalized config
     * @returns {string}
     */
    function buildWrapperAttrs(cfg) {
        const src = cfg.src || '';
        let type = src ? detectModelTypeFromSrc(src) : '';
        const parts = [];
        const push = (name, value) => parts.push(`${name}="${escapeAttr(String(value))}"`);
        if (src) push('data-model-src', src);

        // Canonical AssetManager reference (no `asset://` prefix so
        // IdeviceRenderer.fixAssetUrls' global URL regex doesn't touch
        // it). Lets the runtime recover the original asset:// URL in
        // contexts where AssetManager is live (workarea view +
        // preview-with-AssetManager) even when `data-model-src` arrives
        // as a blob: URL or as a `content/resources/...` relative
        // path.
        //
        // Two recovery paths:
        //   * `cfg.src` starts with `asset://` (fresh save before any
        //     downstream URL rewriting): take the path part directly.
        //   * `cfg.src` is a `blob:` URL (the workarea engine resolves
        //     asset:// → blob: when reading the iDevice JSON, so by the
        //     time `data` reaches `renderView` the asset URL is
        //     already gone). Look the blob up in
        //     AssetManager.reverseBlobCache to recover the asset id,
        //     then read the filename from getAssetMetadata so the
        //     reconstructed `asset://<id>.<ext>` can be resolved back
        //     to the same blob by AssetManager.
        let assetRef = '';
        if (src.startsWith('asset://')) {
            assetRef = src.substring('asset://'.length);
        } else if (src.startsWith('blob:')) {
            const am = getAssetManager();
            const assetId = am?.reverseBlobCache?.get?.(src) || null;
            if (assetId) {
                const meta = typeof am.getAssetMetadata === 'function'
                    ? am.getAssetMetadata(assetId)
                    : null;
                const filename = (meta && meta.filename) || '';
                const dot = filename.lastIndexOf('.');
                const ext = dot !== -1 ? filename.substring(dot + 1).toLowerCase() : '';
                assetRef = ext ? `${assetId}.${ext}` : String(assetId);
                if (!type && ext && ['stl', 'glb', 'gltf', 'obj', 'fbx'].includes(ext)) {
                    type = ext;
                }
            }
        }
        if (assetRef) push('data-model-asset-ref', assetRef);
        if (type) push('data-model-type', type);
        push('data-model-color', cfg.modelColor || '#888888');
        push('data-background-color', cfg.backgroundColor || DEFAULT_BACKGROUND);
        push('data-camera-controls', cfg.cameraControls !== false ? 'true' : 'false');
        push('data-auto-rotate', cfg.autoRotate ? 'true' : 'false');
        push('data-auto-rotate-speed', cfg.autoRotateSpeed || 30);
        push('data-show-nav-controls', cfg.showNavControls ? 'true' : 'false');
        push('data-animation-enabled', cfg.animation?.enabled ? 'true' : 'false');
        if (cfg.animation?.name) push('data-animation-name', cfg.animation.name);
        push('data-animation-speed', cfg.animation?.speed ?? 1);
        if (cfg.alt) push('data-alt', cfg.alt);
        return parts.join(' ');
    }

    /**
     * Escape characters that would break out of an HTML attribute.
     * @param {string} s
     * @returns {string}
     */
    function escapeAttr(s) {
        return s
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Cheap extension-based detection used by `buildWrapperAttrs` and
     * `migrateLegacyConfig` so they don't have to wait for the runtime
     * to load. Mirrors `eXe3DViewer.detectModelType` semantics; the two
     * must stay in sync.
     *
     * @param {string} src
     * @returns {string}
     */
    function detectModelTypeFromSrc(src) {
        if (typeof src !== 'string') return '';
        let s = src.trim();
        const q = s.indexOf('?'); if (q !== -1) s = s.substring(0, q);
        const h = s.indexOf('#'); if (h !== -1) s = s.substring(0, h);
        const dot = s.lastIndexOf('.');
        if (dot === -1) return '';
        const ext = s.substring(dot + 1).toLowerCase();
        if (['stl', 'glb', 'gltf', 'obj', 'fbx'].includes(ext)) return ext;
        return '';
    }

    /**
     * One-shot migration for persisted HTML from PRs #888/#1810: copies
     * the base64 `data-config` payload into the new flat `data-*` attrs
     * and removes the legacy attribute. Idempotent and silent — runs
     * once per wrapper at first render and is a no-op for wrappers
     * already in the new format.
     *
     * @param {HTMLElement} wrapper
     */
    function migrateLegacyConfig(wrapper) {
        const encoded = wrapper.getAttribute && wrapper.getAttribute('data-config');
        if (!encoded) return;
        let cfg = {};
        try {
            cfg = JSON.parse(decodeURIComponent(escape(atob(encoded))));
        } catch (_) {
            try { cfg = JSON.parse(encoded); } catch (_) { cfg = {}; }
        }
        const ds = wrapper.dataset;
        const setIfMissing = (key, value) => {
            if (ds[key] == null && value != null && value !== '') ds[key] = String(value);
        };
        setIfMissing('modelSrc', cfg.src);
        setIfMissing('alt', cfg.alt);
        setIfMissing('backgroundColor', cfg.backgroundColor);
        if (cfg.cameraControls != null) setIfMissing('cameraControls', !!cfg.cameraControls);
        if (cfg.autoRotate != null) setIfMissing('autoRotate', !!cfg.autoRotate);
        setIfMissing('autoRotateSpeed', cfg.autoRotateSpeed);
        if (cfg.showNavControls != null) setIfMissing('showNavControls', !!cfg.showNavControls);
        if (cfg.animation) {
            if (cfg.animation.enabled != null) setIfMissing('animationEnabled', !!cfg.animation.enabled);
            setIfMissing('animationName', cfg.animation.name);
            setIfMissing('animationSpeed', cfg.animation.speed);
        }
        if (!ds.modelType && ds.modelSrc) {
            const ext = detectModelTypeFromSrc(ds.modelSrc);
            if (ext) ds.modelType = ext;
        }
        if (!ds.modelColor) ds.modelColor = '#888888';
        wrapper.removeAttribute('data-config');
    }

    /**
     * Runtime controller for each wrapper.
     */
    class ThreeDViewerRuntime {
        /**
         * @param {HTMLElement} wrapper
         * @param {object} config
         */
        constructor(wrapper, config) {
            this.wrapper = wrapper;
            this.ideviceId = wrapper.id || '';
            this.modelViewer = wrapper.querySelector('model-viewer');
            this.emptyState = wrapper.querySelector('[data-empty]');
            this.ariaLive = wrapper.querySelector('[data-live]');
            this.config = this.normalizeConfig(config);
            this.availableAnimations = [];
            this.init();
        }

        /**
         * Normalize and coerce config values.
         * @param {object} config
         * @returns {object}
         */
        normalizeConfig(config = {}) {
            const anim = config.animation || {};
            const parsedSpeed = parseFloat(anim.speed);
            const showNavControls = !!config.showNavControls;

            return {
                src: normalizePath(config.src),
                alt: config.alt || '',
                modelColor: config.modelColor || '#888888',
                backgroundColor: config.backgroundColor || DEFAULT_BACKGROUND,
                cameraControls: config.cameraControls !== false,
                // Mutually exclusive: nav controls override auto-rotate
                autoRotate: !showNavControls && config.autoRotate !== false,
                autoRotateSpeed: Number.isFinite(parseFloat(config.autoRotateSpeed))
                    ? parseFloat(config.autoRotateSpeed)
                    : 30,
                showNavControls,
                animation: {
                    enabled: !!anim.enabled,
                    name: anim.name || '',
                    speed: Number.isFinite(parsedSpeed) ? parsedSpeed : 1
                }
            };
        }

        /**
         * Initialize runtime: apply config and hook events.
         */
        async init() {
            // Check if we're running from file:// protocol - show warning
            if (isLocalFileProtocol()) {
                this.showLocalWarning();
                return;
            }

            // Check if this is an STL file - render with Three.js instead
            if (isSTLFile(this.config.src)) {
                await this.renderSTL();
            } else {
                this.applyConfig();
                this.setupEvents();
            }

            this.setupControls();
        }

        /**
         * Wire fullscreen toggle and 4-direction nav buttons. Works for both
         * STL (Three.js scene) and GLB/GLTF (model-viewer) modes.
         */
        setupControls() {
            const fsBtn = this.wrapper.querySelector('[data-fullscreen]');
            if (fsBtn) {
                const isFs = () =>
                    document.fullscreenElement === this.wrapper ||
                    document.webkitFullscreenElement === this.wrapper;
                const syncLabel = () => {
                    const label = isFs() ? translate('viewer.exit_fullscreen') : translate('viewer.fullscreen');
                    fsBtn.setAttribute('aria-label', label);
                    fsBtn.setAttribute('title', label);
                };
                fsBtn.addEventListener('click', () => {
                    if (isFs()) {
                        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
                    } else {
                        (this.wrapper.requestFullscreen || this.wrapper.webkitRequestFullscreen)?.call(this.wrapper);
                    }
                });
                document.addEventListener('fullscreenchange', syncLabel);
                document.addEventListener('webkitfullscreenchange', syncLabel);
            }

            // Arrow direction matches user expectation: pressing → makes the
            // model appear to rotate right (camera orbits the opposite way).
            this.wrapper.querySelectorAll('[data-nav]').forEach((btn) => {
                const dir = btn.getAttribute('data-nav');
                const dAz = dir === 'right' ? -YAW_STEP : dir === 'left' ? YAW_STEP : 0;
                const dPo = dir === 'up' ? PITCH_STEP : dir === 'down' ? -PITCH_STEP : 0;
                btn.addEventListener('click', () => this.nudgeCamera(dAz, dPo));
            });
        }

        /**
         * Orbit camera by (dAz, dPo) radians around the model. Dispatches to the
         * STL three.js scene we control directly, or to model-viewer's
         * cameraOrbit API for GLB/GLTF.
         */
        nudgeCamera(dAz, dPo) {
            // STL path: the shared runtime owns the camera + OrbitControls.
            // bootSTL is async, so re-read the instance on every nudge —
            // the cached `_threeJSCamera` may have been null when init
            // returned synchronously.
            const inst = globalScope.eXe3DViewer?.getInstance?.(this.wrapper);
            const camera = inst?.camera || this._threeJSCamera;
            if (camera) {
                const controls = inst?.controls || this._threeJSControls;
                const r = camera.position.length() || 1;
                let az = controls?.getAzimuthalAngle?.() ?? Math.atan2(camera.position.x, camera.position.z);
                let po = controls?.getPolarAngle?.() ?? Math.acos(clamp((camera.position.y || 0) / r, -1, 1));
                az += dAz;
                po = clamp(po + dPo, 0.05, Math.PI - 0.05);
                const sinPo = Math.sin(po);
                camera.position.set(r * sinPo * Math.sin(az), r * Math.cos(po), r * sinPo * Math.cos(az));
                camera.lookAt(0, 0, 0);
                controls?.update?.();
                return;
            }
            // GLB/GLTF path: drive model-viewer's camera orbit.
            const mv = this.modelViewer;
            if (mv && typeof mv.getCameraOrbit === 'function') {
                const orbit = mv.getCameraOrbit();
                const theta = (orbit.theta || 0) + dAz;
                const phi = clamp((orbit.phi || Math.PI / 2) + dPo, 0.05, Math.PI - 0.05);
                mv.cameraOrbit = `${theta}rad ${phi}rad ${orbit.radius || 'auto'}m`;
                mv.jumpCameraToGoal?.();
            }
        }

        /**
         * Show warning when running from local file:// protocol.
         */
        showLocalWarning() {
            // Hide model-viewer and empty state
            if (this.modelViewer) {
                this.modelViewer.style.display = 'none';
            }
            if (this.emptyState) {
                this.emptyState.style.display = 'none';
            }

            // Insert warning HTML
            const warningDiv = document.createElement('div');
            warningDiv.innerHTML = buildLocalWarningHTML();
            this.wrapper.appendChild(warningDiv.firstElementChild);
        }

        /**
         * Render STL file via the shared eXe3DViewer runtime.
         *
         * Scene/camera/renderer setup, STL fetch+parse, OrbitControls and
         * the animate loop all live in `three-d-viewer-runtime.js` so the
         * editor and the exported package share a single implementation.
         */
        async renderSTL() {
            const cfg = this.config;

            // Resolve the STL file URL (preview AssetManager or static
            // export resources path).
            let stlUrl = resolveRuntimeSrc(cfg.src, this.ideviceId);
            if (!stlUrl && cfg.src && cfg.src.startsWith('asset://')) {
                stlUrl = await resolveAssetUrlAsync(cfg.src);
            }
            if (!stlUrl) {
                console.warn('[3D Viewer] No STL URL resolved for:', cfg.src);
                this.toggleEmpty();
                return;
            }

            try {
                await ensureThreeJSLoaded();
                await ensureRuntimeLoaded();

                // Tear down any previous instance bound to this wrapper.
                globalScope.eXe3DViewer.destroy(this.wrapper);

                globalScope.eXe3DViewer.init(this.wrapper, {
                    src: stlUrl,
                    type: 'stl',
                    modelColor: cfg.modelColor || '#888888',
                    backgroundColor: cfg.backgroundColor || DEFAULT_BACKGROUND,
                    cameraControls: !!cfg.cameraControls,
                    autoRotate: !!cfg.autoRotate,
                    autoRotateSpeed: cfg.autoRotateSpeed || 30,
                });

                // Expose runtime fields for nudgeCamera (the runtime
                // populates these asynchronously inside bootSTL; nudge
                // reads them later when the user clicks).
                const inst = globalScope.eXe3DViewer.getInstance(this.wrapper);
                if (inst) {
                    this._threeJSRenderer = inst.renderer;
                    this._threeJSControls = inst.controls;
                    this._threeJSCamera = inst.camera;
                }
            } catch (err) {
                console.error('[3D Viewer] Failed to render STL:', err);
                this.toggleEmpty();
            }
        }

        /**
         * Hook model-viewer events once the element is defined.
         */
        setupEvents() {
            if (!this.modelViewer) return;

            // Hide empty state when model loads
            this.modelViewer.addEventListener('load', () => {
                this.updateAnimationOptions();
                this.applyAnimation();
                this.toggleEmpty();
            });

            // Also observe src attribute changes (for async blob URL resolution)
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                        this.toggleEmpty();
                    }
                }
            });
            observer.observe(this.modelViewer, { attributes: true, attributeFilter: ['src'] });
        }

        /**
         * Apply config to the <model-viewer> element.
         */
        async applyConfig() {
            if (!this.modelViewer) return;
            const cfg = this.config;

            // First try synchronous resolution
            let viewerSrc = resolveRuntimeSrc(cfg.src, this.ideviceId);

            // If src is an asset:// URL and sync resolution returned empty, try async
            if (!viewerSrc && cfg.src && cfg.src.startsWith('asset://')) {
                viewerSrc = await resolveAssetUrlAsync(cfg.src);
            }

            if (viewerSrc) {
                this.modelViewer.src = viewerSrc;
                // model-viewer's property doesn't always reflect to the
                // attribute reliably (custom-element timing), so set both.
                this.modelViewer.setAttribute('src', viewerSrc);
            }

            const alt = cfg.alt || '';
            this.modelViewer.alt = alt;
            if (alt) {
                this.modelViewer.setAttribute('aria-label', alt);
            } else {
                this.modelViewer.removeAttribute('aria-label');
            }

            // Only apply background if it's explicitly set in config
            // Otherwise, preserve whatever was set in the HTML
            if (cfg.backgroundColor) {
                this.modelViewer.style.backgroundColor = cfg.backgroundColor;
            }

            this.modelViewer.setAttribute('shadow-intensity', '1');
            this.modelViewer.setAttribute('tone-mapping', 'pbr-neutral');

            if (cfg.cameraControls) {
                this.modelViewer.setAttribute('camera-controls', '');
            } else {
                this.modelViewer.removeAttribute('camera-controls');
            }

            if (cfg.autoRotate) {
                this.modelViewer.setAttribute('auto-rotate', '');
                this.modelViewer.setAttribute('rotation-per-second', `${cfg.autoRotateSpeed || 30}deg`);
            } else {
                this.modelViewer.removeAttribute('auto-rotate');
                this.modelViewer.removeAttribute('rotation-per-second');
            }

            this.applyAnimation();
            this.toggleEmpty();
        }

        /**
         * Cache available animations from the loaded model, if any.
         */
        updateAnimationOptions() {
            if (!this.modelViewer) return;
            this.availableAnimations = Array.from(this.modelViewer.availableAnimations || []);
            if (!this.availableAnimations.length) {
                this.config.animation.name = '';
                this.config.animation.enabled = false;
            } else if (!this.availableAnimations.includes(this.config.animation.name)) {
                this.config.animation.name = this.availableAnimations[0];
            }
        }

        /**
         * Apply animation state (play/pause/speed/name).
         */
        applyAnimation() {
            if (!this.modelViewer) return;
            const animation = this.config.animation || {};
            if (!animation.enabled) {
                this.modelViewer.pause?.();
                this.announce(translate('viewer.animation_paused'));
                return;
            }
            const available = this.availableAnimations.length
                ? this.availableAnimations
                : Array.from(this.modelViewer.availableAnimations || []);
            const name = animation.name && available.includes(animation.name)
                ? animation.name
                : available[0];

            if (!name) {
                this.modelViewer.pause?.();
                return;
            }

            this.modelViewer.animationName = name;
            this.modelViewer.animationSpeed = animation.speed || 1;
            this.modelViewer.play?.({ repetitions: Infinity });
            this.announce(`${translate('viewer.animation_enabled')}: ${name}`);
        }

        /**
         * Show/hide empty-state banner.
         */
        toggleEmpty() {
            if (!this.emptyState) return;
            // Check for any valid src (including blob: URLs from asset resolution)
            const src = this.modelViewer?.getAttribute('src') || this.modelViewer?.src || '';
            // Show model if we have a valid src (blob: or http:) or if config has asset:// that will be resolved
            const hasValidSrc = src && (src.startsWith('blob:') || src.startsWith('http'));
            const hasConfigSrc = this.config.src && this.config.src.startsWith('asset://');
            const hasModel = hasValidSrc || hasConfigSrc;
            this.emptyState.style.display = hasModel ? 'none' : 'grid';
        }

        /**
         * Announce a short message to screen readers.
         * @param {string} message
         */
        announce(message) {
            if (!this.ariaLive) return;
            this.ariaLive.textContent = message;
        }
    }

    // ---------------------------------------------------------------------
    // Export helper class (used by the eXe engine to serialize/deserialize)
    // ---------------------------------------------------------------------
    if (!globalScope.ThreeDViewerExportObject) {
        globalScope.ThreeDViewerExportObject = class {
            init(node, resources) {
                this.node = node;
                this.resources = resources || null;
                return true;
            }
            toJSON() {
                if (this.node && typeof this.node.get3DViewerJSON === 'function') {
                    return this.node.get3DViewerJSON();
                }
                return {};
            }
            fromJSON(data) {
                if (this.node && typeof this.node.set3DViewerJSON === 'function') {
                    this.node.set3DViewerJSON(data || {});
                }
            }
        };
    }

    // ---------------------------------------------------------------------
    // Public API expected by eXe iDevice engine in export runtime
    // ---------------------------------------------------------------------
    globalScope.$threedviewer = globalScope.$threedviewer || {};

    Object.assign(globalScope.$threedviewer, {
        /**
         * Build the static HTML of the view.
         * Injects a modulepreload hint for the model-viewer library.
         */
        renderView: function (data, accessibility, template) {
            data = data || {};

            const viewerId = data.ideviceId || `three-d-viewer-${Date.now()}`;
            const anim = data.animation || {};
            const showNavControls = !!data.showNavControls;
            const cfg = {
                src: normalizePath(data.src),
                alt: data.alt || '',
                modelColor: data.modelColor || '#888888',
                backgroundColor: data.backgroundColor || DEFAULT_BACKGROUND,
                cameraControls: data.cameraControls !== false,
                // Mutually exclusive: nav controls override auto-rotate
                autoRotate: !showNavControls && data.autoRotate !== false,
                autoRotateSpeed: Number.isFinite(parseFloat(data.autoRotateSpeed))
                    ? parseFloat(data.autoRotateSpeed)
                    : 30,
                showNavControls,
                animation: {
                    enabled: !!anim.enabled,
                    name: anim.name || '',
                    speed: Number.isFinite(parseFloat(anim.speed)) ? parseFloat(anim.speed) : 1
                }
            };

            // Preload the ES module for faster first paint
            appendModulePreloadOnce(getModelViewerLibUrl());

            // Store current iDevice ID for asset:// resolution
            globalScope.$threedviewer._currentIdeviceId = viewerId;

            // Flat data-* attributes — exposed to grep/inspect and picked
            // up by IdeviceRenderer.fixAssetUrls during export.
            const wrapperAttrs = buildWrapperAttrs(cfg);
            const content = `
                <div class="three-d-viewer-wrapper" data-three-d id="${viewerId}" ${wrapperAttrs}>
                    ${buildModelMarkup(cfg)}
                    <span class="sr-only" data-live aria-live="polite"></span>
                    <div class="viewer-empty" data-empty>${translate('viewer.empty_state')}</div>
                    ${buildControlsMarkup(cfg)}
                </div>
            `;
            return template.replace('{content}', content);
        },

        /**
         * Resolve the boot config for a wrapper from its flat data-*
         * attributes.
         *
         * The `data` argument is kept for engine ABI parity but ignored —
         * the wrapper attributes are the single source of truth. The
         * exporter rewrites `asset://uuid.ext` → `content/resources/...`
         * directly inside `data-model-src` via
         * `IdeviceRenderer.fixAssetUrls`, so editor (asset://) and static
         * export (content/resources/...) read the same code path.
         *
         * Legacy persisted HTML that still carries the base64
         * `data-config` is upgraded by `migrateLegacyConfig` (called in
         * `renderBehaviour` before this function runs).
         *
         * @param {object|undefined} _data - ignored
         * @param {HTMLElement} wrapper
         * @returns {object}
         */
        resolveBootConfig: function (_data, wrapper) {
            if (!wrapper || !wrapper.dataset) return {};
            const ds = wrapper.dataset;
            const showNav = ds.showNavControls === 'true';
            const rawSrc = (ds.modelSrc || '').trim();
            const assetRef = (ds.modelAssetRef || '').trim();
            // Prefer the canonical asset:// URL when AssetManager is live
            // — `data-model-src` may have been rewritten by
            // IdeviceRenderer.fixAssetUrls to a `content/resources/...`
            // path that only exists inside an export ZIP, or replaced
            // with a `blob:` URL by the workarea's asset resolver.
            // In both contexts `asset://` is the only durable handle
            // because AssetManager / the export pipeline know how to
            // serve it.
            let src = rawSrc;
            if (assetRef && getAssetManager()) {
                src = 'asset://' + assetRef;
            }
            // data: URLs are still rejected (would never round-trip),
            // but `blob:` is left intact when no asset-ref recovery is
            // possible — the browser can still fetch a live blob URL
            // directly and that's better than the empty-state UI.
            const sanitized = src.startsWith('data:') ? '' : src;
            return {
                src: sanitized,
                type: ds.modelType || detectModelTypeFromSrc(sanitized),
                modelColor: ds.modelColor || '#888888',
                alt: ds.alt || '',
                backgroundColor: ds.backgroundColor || DEFAULT_BACKGROUND,
                cameraControls: ds.cameraControls !== 'false',
                autoRotate: !showNav && ds.autoRotate !== 'false',
                autoRotateSpeed: parseFloat(ds.autoRotateSpeed) || 30,
                showNavControls: showNav,
                animation: {
                    enabled: ds.animationEnabled === 'true',
                    name: ds.animationName || '',
                    speed: parseFloat(ds.animationSpeed) || 1,
                },
            };
        },

        /**
         * Attach behaviors. Robust to missing data argument.
         * Ensures the model-viewer module is loaded before booting wrappers.
         */
        renderBehaviour: function (data, accessibility, ideviceId) {
            const id =
                (data && data.ideviceId) ||
                ideviceId ||
                '';

            // Try multiple selector patterns for the iDevice container
            let scope = document;
            if (id) {
                scope = document.querySelector(`.idevice_node.three-d-viewer[id="${id}"]`) ||
                        document.querySelector(`[idevice-id="${id}"]`) ||
                        document.querySelector(`#${id}`) ||
                        document;
            }

            // Find all wrappers, either in scope or in entire document
            let wrappers = Array.from(scope.querySelectorAll('.three-d-viewer-wrapper[data-three-d]'));

            // If no wrappers found in scope, search entire document
            if (!wrappers.length && scope !== document) {
                wrappers = Array.from(document.querySelectorAll('.three-d-viewer-wrapper[data-three-d]'));
            }

            if (!wrappers.length) return true;

            // Phase 1: upgrade legacy persisted HTML (PR #888/#1810 wrote a
            // base64 `data-config`) to the new flat data-* attributes. No-op
            // when the wrapper is already in the new format.
            wrappers.forEach(migrateLegacyConfig);

            // Phase 2: strip stale `src` attribute from any <model-viewer>
            // inside an STL wrapper BEFORE we load the model-viewer custom
            // element definition. Persisted iDevice HTML may still carry
            // `<model-viewer src="…stl">`, and the moment model-viewer's
            // custom element activates it would fetch that URL and throw
            // `SyntaxError: Unexpected token 'C', "COLOR= "... is not valid
            // JSON` (model-viewer routes the bytes through the GLB / GLTF /
            // USDZ loaders). Driven by `data-model-type === "stl"`, which
            // survives the exporter's URL rewrite. See issue #1810.
            wrappers.forEach((w) => {
                const mv = w.querySelector('model-viewer');
                if (!mv) return;
                const ds = w.dataset || {};
                const isStl = ds.modelType === 'stl'
                    || (ds.modelSrc && detectModelTypeFromSrc(ds.modelSrc) === 'stl')
                    || isSTLFile(mv.getAttribute('src') || '');
                if (isStl) mv.removeAttribute('src');
            });

            const boot = () => {
                wrappers.forEach((w) => {
                    if (w.dataset._threedBooted === '1') return;
                    w.dataset._threedBooted = '1';
                    const cfg = globalScope.$threedviewer.resolveBootConfig(data, w);
                    new ThreeDViewerRuntime(w, cfg);
                });
            };

            ensureModelViewerModule(id).then(boot);
            return true;
        },

        /** Not used here but kept for parity with other iDevices */
        init: function () {}
    });

    // Instance used by the engine to serialize/deserialize node data
    globalScope.$threedviewer.exportHelper = new globalScope.ThreeDViewerExportObject();

    // Optional helpers exposed for debugging
    globalScope.$threedviewer.getModelViewerLibUrl = getModelViewerLibUrl;
    globalScope.$threedviewer.resolveAssetUrl = resolveAssetUrl;
    globalScope.$threedviewer.__migrateLegacyConfig = migrateLegacyConfig;
    globalScope.$threedviewer.__detectModelTypeFromSrc = detectModelTypeFromSrc;
    globalScope.$threedviewer.__resolveRuntimeSrc = resolveRuntimeSrc;
})();
