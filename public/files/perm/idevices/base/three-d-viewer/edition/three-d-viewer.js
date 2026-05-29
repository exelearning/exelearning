/* global eXeLearning, eXe */

var $exeDevice = (function () {
    const DEFAULT_STATE = Object.freeze({
        src: '',
        alt: '',
        modelColor: '#888888',
        backgroundColor: '#f5f5f5',
        cameraControls: true,
        autoRotate: true,
        autoRotateSpeed: 30,
        showNavControls: false,
        animation: { enabled: false, name: '', speed: 1 },
    });

    const MODEL_EXTENSIONS = ['.glb', '.gltf', '.stl'];

    /** Camera nudge step (radians) — matches threesixty viewer feel */
    const YAW_STEP = (15 * Math.PI) / 180;
    const PITCH_STEP = (10 * Math.PI) / 180;

    const cloneState = () => structuredClone(DEFAULT_STATE);

    const clampNum = (value, min, max) => Math.min(max, Math.max(min, value));

    /**
     * Validate a CSS color hex string. Used inline rather than via the
     * runtime helper because state plumbing fires before
     * window.eXe3DViewer is loaded.
     */
    const normalizeHex = (value, fallback) => {
        if (typeof value !== 'string') return fallback;
        const v = value.trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(v)) return v;
        if (/^#[0-9a-f]{3}$/.test(v)) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
        return fallback;
    };

    /** Detect model type from a src by file extension. */
    const detectType = (src) => {
        if (typeof src !== 'string' || !src) return 'unknown';
        let s = src.trim();
        const q = s.indexOf('?'); if (q !== -1) s = s.substring(0, q);
        const h = s.indexOf('#'); if (h !== -1) s = s.substring(0, h);
        const d = s.lastIndexOf('.');
        if (d === -1) return 'unknown';
        const ext = s.substring(d + 1).toLowerCase();
        if (['stl', 'glb', 'gltf', 'obj', 'fbx'].includes(ext)) return ext;
        return 'unknown';
    };

    return {
        name: _('3D Viewer'),
        i18n: {
            name: _('3D Viewer'),
        },

        /**
         * Check if running in static mode (PWA/offline build).
         * In static mode, paths should be relative to avoid basePath duplication.
         * @returns {boolean}
         */
        isStaticMode: function () {
            const config = window.eXeLearning?.config;
            const parsedConfig = typeof config === 'string'
                ? (function () { try { return JSON.parse(config); } catch (e) { return null; } })()
                : config;
            return !!(parsedConfig?.isStaticMode || parsedConfig?.isOfflineInstallation);
        },
        ideviceBody: null,
        modelViewer: null,
        previewContainer: null,
        ariaLive: null,
        formElements: {},
        animationRow: null,
        lastPreviewSrc: '',
        previewRetryCount: 0,
        state: cloneState(),

        init: async function (element, previousData) {
            // Tear down any previous runtime instance bound to the prior
            // preview container. Re-opening the same iDevice for edit
            // replaces the form HTML; without this destroy, the old
            // WebGL context and RAF loop would leak.
            if (this.previewContainer && window.eXe3DViewer) {
                window.eXe3DViewer.destroy(this.previewContainer);
            }
            this.previewBlobUrl = null;
            this.ideviceBody = element;
            this.renderEditor();
            this.collectFormElements();
            this.set3DViewerJSON(previousData || {});
            this.applyStateToForm();
            await this.createModelViewer();

            // Pre-resolve asset:// URL if present (load blob into cache)
            if (this.state.src && this.state.src.startsWith('asset://')) {
                await this.preResolveAssetUrl(this.state.src);
            }

            this.updatePreview();
            this.registerBehaviours();
            this.setupControls();
        },

        /**
         * Wire fullscreen toggle and 4-direction nav buttons. Targets the
         * preview container so the controls remain visible in fullscreen.
         */
        setupControls: function () {
            const target = this.previewContainer?.parentElement || this.previewContainer;
            const fsBtn = this.previewContainer?.querySelector('[data-fullscreen]');
            if (target && fsBtn) {
                const isFs = () =>
                    document.fullscreenElement === target ||
                    document.webkitFullscreenElement === target;
                fsBtn.addEventListener('click', () => {
                    if (isFs()) {
                        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
                    } else {
                        (target.requestFullscreen || target.webkitRequestFullscreen)?.call(target);
                    }
                });
                const sync = () => {
                    const label = isFs() ? _('Exit fullscreen') : _('Fullscreen');
                    fsBtn.setAttribute('aria-label', label);
                    fsBtn.setAttribute('title', label);
                };
                document.addEventListener('fullscreenchange', sync);
                document.addEventListener('webkitfullscreenchange', sync);
            }

            // Arrow direction matches user expectation: pressing → makes the
            // model appear to rotate right (camera orbits the opposite way).
            this.previewContainer?.querySelectorAll('[data-nav]').forEach((btn) => {
                const dir = btn.getAttribute('data-nav');
                const dAz = dir === 'right' ? -YAW_STEP : dir === 'left' ? YAW_STEP : 0;
                const dPo = dir === 'up' ? PITCH_STEP : dir === 'down' ? -PITCH_STEP : 0;
                btn.addEventListener('click', () => this.nudgeCamera(dAz, dPo));
            });
        },

        /**
         * Orbit camera by (dAz, dPo) radians around the model.
         * STL path uses our own three.js scene; GLB/GLTF uses model-viewer.
         */
        nudgeCamera: function (dAz, dPo) {
            // Prefer the runtime's STL instance if one is live for this
            // preview container — those test fields (threeJSCamera /
            // threeJSScene) are kept as fallbacks for legacy callers and
            // unit tests that stub them directly.
            const stlInstance = window.eXe3DViewer?.getInstance?.(this.previewContainer);
            const camera = stlInstance?.camera || this.threeJSCamera;
            const scene = stlInstance?.scene || this.threeJSScene;
            const controls = stlInstance?.controls || this.threeJSControls;
            if (camera && scene) {
                const r = camera.position.length() || 1;
                let az = controls?.getAzimuthalAngle?.() ?? Math.atan2(camera.position.x, camera.position.z);
                let po = controls?.getPolarAngle?.() ?? Math.acos(clampNum((camera.position.y || 0) / r, -1, 1));
                az += dAz;
                po = clampNum(po + dPo, 0.05, Math.PI - 0.05);
                const sinPo = Math.sin(po);
                camera.position.set(r * sinPo * Math.sin(az), r * Math.cos(po), r * sinPo * Math.cos(az));
                camera.lookAt(0, 0, 0);
                controls?.update?.();
                return;
            }
            const mv = this.modelViewer;
            if (mv && typeof mv.getCameraOrbit === 'function') {
                const orbit = mv.getCameraOrbit();
                const theta = (orbit.theta || 0) + dAz;
                const phi = clampNum((orbit.phi || Math.PI / 2) + dPo, 0.05, Math.PI - 0.05);
                mv.cameraOrbit = `${theta}rad ${phi}rad ${orbit.radius || 'auto'}m`;
                mv.jumpCameraToGoal?.();
            }
        },

        /**
         * Pre-resolve asset:// URL to ensure blob is in cache before
         * displaying. The blob URL is held in `this.previewBlobUrl` —
         * never in iDevice state and never on the form-input dataset,
         * so it can't leak into persisted JSON or HTML.
         */
        preResolveAssetUrl: async function (assetUrl) {
            const assetManager = this.getAssetManager();
            if (!assetManager) return;

            try {
                const cached = assetManager.resolveAssetURLSync(assetUrl);
                if (cached) {
                    this.previewBlobUrl = cached;
                    return;
                }
                const blobUrl = await assetManager.resolveAssetURL(assetUrl);
                if (blobUrl) this.previewBlobUrl = blobUrl;
            } catch (err) {
                console.error('[3D Viewer] Failed to pre-load asset:', assetUrl, err);
            }
        },

        /**
         * Check if a file path/URL is an STL file
         */
        isSTLFile: function (path) {
            if (!path) return false;
            const filename = path.split('/').pop() || '';
            return filename.toLowerCase().endsWith('.stl');
        },

        renderEditor: function () {
            const html = `
                <div class="three-d-viewer-editor" id="threeDViewerEditor">
                    <div class="container">
                        <!-- Preview area -->
                        <div class="ratio ratio-16x9 mb-4 viewer-preview-container">
                            <div class="viewer-preview" id="threeDViewerPreview">
                                <div class="viewer-empty" data-empty-state>
                                    <div class="viewer-empty-content">
                                        <svg class="viewer-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                        </svg>
                                        <span>${_('Select a 3D model to preview')}</span>
                                    </div>
                                </div>
                                <button type="button" class="three-d-viewer-fullscreen-button" data-fullscreen aria-label="${_('Fullscreen')}" title="${_('Fullscreen')}">⛶</button>
                                <div class="three-d-viewer-nav" role="group" aria-label="${_('Rotate model')}">
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-left" data-nav="left" aria-label="${_('Rotate left')}" title="${_('Rotate left')}">←</button>
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-up" data-nav="up" aria-label="${_('Tilt up')}" title="${_('Tilt up')}">↑</button>
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-down" data-nav="down" aria-label="${_('Tilt down')}" title="${_('Tilt down')}">↓</button>
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-right" data-nav="right" aria-label="${_('Rotate right')}" title="${_('Rotate right')}">→</button>
                                </div>
                            </div>
                        </div>

                        <!-- Model file selector -->
                        <div class="d-flex align-items-center mb-3">
                            <label for="threeD3DModelFile" class="form-label me-2 mb-0 text-nowrap">${_('3D Model')}:</label>
                            <input type="text" class="exe-file-picker form-control" id="threeD3DModelFile" readonly placeholder="${_('Select a GLB, GLTF or STL file')}" />
                        </div>
                        <p class="form-text text-muted mb-4">${_('Supported formats')}: GLB, GLTF, STL</p>

                        <!-- Alt text -->
                        <div class="mb-4">
                            <label for="threeDAlt" class="form-label">${_('Alternative text')}:</label>
                            <input type="text" class="form-control" id="threeDAlt" maxlength="180" placeholder="${_('Describe the 3D model for accessibility')}" />
                            <p class="form-text text-muted">${_('Describe the 3D model for screen readers and accessibility')}</p>
                        </div>

                        <!-- Display options -->
                        <fieldset class="mb-4">
                            <legend class="h6 mb-3">${_('Display Options')}</legend>

                            <div class="row align-items-center mb-3">
                                <label for="threeDBackground" class="col-auto col-form-label">${_('Background color')}:</label>
                                <div class="col-auto">
                                    <input type="color" class="form-control form-control-color" id="threeDBackground" title="${_('Choose background color')}" />
                                </div>
                            </div>

                            <div class="row align-items-center mb-3">
                                <label for="threeDModelColor" class="col-auto col-form-label">${_('STL model color')}:</label>
                                <div class="col-auto">
                                    <input type="color" class="form-control form-control-color" id="threeDModelColor" title="${_('Choose STL model color')}" value="#888888" />
                                </div>
                                <div class="col form-text text-muted mb-0" id="threeDModelColorHint">${_('Only used for STL files; ignored for GLB/GLTF (materials come from the model).')}</div>
                            </div>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDCameraControls" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDCameraControls" class="toggle-label">${_('Enable camera controls')}</label>
                                </div>
                            </div>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDAutoRotate" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDAutoRotate" class="toggle-label">${_('Auto-rotate model')}</label>
                                </div>
                                <div class="d-flex align-items-center gap-2" id="threeDAutoRotateSpeedRow">
                                    <label for="threeDAutoRotateSpeed" class="form-label mb-0 text-nowrap">${_('Speed')}:</label>
                                    <div class="input-group" style="width: 7em;">
                                        <input type="number" class="form-control" id="threeDAutoRotateSpeed" min="1" max="90" step="1" value="30" />
                                        <span class="input-group-text">°/s</span>
                                    </div>
                                </div>
                            </div>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-1">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDShowNavControls" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDShowNavControls" class="toggle-label">${_('Show navigation controls (fullscreen + arrows)')}</label>
                                </div>
                            </div>
                            <p class="form-text text-muted">${_('Mutually exclusive with auto-rotate.')}</p>
                        </fieldset>

                        <!-- Animation options (shown when model has animations) -->
                        <fieldset class="mb-3" data-animation-row hidden>
                            <legend class="h6 mb-3">${_('Animation')}</legend>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDAnimationToggle" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDAnimationToggle" class="toggle-label">${_('Play animation')}</label>
                                </div>
                            </div>

                            <div class="row g-3">
                                <div class="col-sm-6">
                                    <label for="threeDAnimationName" class="form-label">${_('Animation')}:</label>
                                    <select class="form-select" id="threeDAnimationName"></select>
                                </div>
                                <div class="col-sm-6">
                                    <label for="threeDAnimationSpeed" class="form-label">${_('Speed')}:</label>
                                    <div class="input-group">
                                        <input type="number" class="form-control" id="threeDAnimationSpeed" min="0.1" max="3" step="0.1" value="1" />
                                        <span class="input-group-text">x</span>
                                    </div>
                                </div>
                            </div>
                        </fieldset>
                    </div>
                    <div class="sr-only" id="threeDAnimationLive" aria-live="polite"></div>
                </div>
            `;
            this.ideviceBody.innerHTML = html;
        },

        collectFormElements: function () {
            this.previewContainer = this.ideviceBody.querySelector('#threeDViewerPreview');
            this.ariaLive = this.ideviceBody.querySelector('#threeDAnimationLive');
            this.animationRow = this.ideviceBody.querySelector('[data-animation-row]');
            this.formElements = {
                src: this.ideviceBody.querySelector('#threeD3DModelFile'),
                alt: this.ideviceBody.querySelector('#threeDAlt'),
                modelColor: this.ideviceBody.querySelector('#threeDModelColor'),
                backgroundColor: this.ideviceBody.querySelector('#threeDBackground'),
                cameraControls: this.ideviceBody.querySelector('#threeDCameraControls'),
                autoRotate: this.ideviceBody.querySelector('#threeDAutoRotate'),
                autoRotateSpeed: this.ideviceBody.querySelector('#threeDAutoRotateSpeed'),
                showNavControls: this.ideviceBody.querySelector('#threeDShowNavControls'),
                animationToggle: this.ideviceBody.querySelector('#threeDAnimationToggle'),
                animationName: this.ideviceBody.querySelector('#threeDAnimationName'),
                animationSpeed: this.ideviceBody.querySelector('#threeDAnimationSpeed'),
            };
        },

        set3DViewerJSON: function (data) {
            const merged = cloneState();
            if (data && typeof data === 'object') {
                merged.src = data.src || merged.src;
                merged.alt = data.alt || merged.alt;
                merged.modelColor = normalizeHex(data.modelColor, merged.modelColor);
                merged.backgroundColor = data.backgroundColor || merged.backgroundColor;
                merged.cameraControls = typeof data.cameraControls === 'boolean' ? data.cameraControls : merged.cameraControls;
                merged.autoRotate = typeof data.autoRotate === 'boolean' ? data.autoRotate : merged.autoRotate;
                const autoRotateSpeed = parseFloat(data.autoRotateSpeed);
                if (!Number.isNaN(autoRotateSpeed)) {
                    merged.autoRotateSpeed = autoRotateSpeed;
                }
                merged.showNavControls = typeof data.showNavControls === 'boolean' ? data.showNavControls : merged.showNavControls;
                // Mutually exclusive: nav controls override auto-rotate
                if (merged.showNavControls) merged.autoRotate = false;
                if (data.animation && typeof data.animation === 'object') {
                    merged.animation.enabled = !!data.animation.enabled;
                    merged.animation.name = data.animation.name || '';
                    const speed = parseFloat(data.animation.speed);
                    if (!Number.isNaN(speed)) {
                        merged.animation.speed = Math.min(Math.max(speed, 0.1), 3);
                    }
                }
            }
            merged.backgroundColor = merged.backgroundColor || '#f5f5f5';
            merged.src = this.resolveModelPath(merged.src);
            // Recover `asset://` from a `blob:` URL when possible. The
            // workarea engine resolves asset:// → blob: when reading
            // the iDevice JSON, so on re-open the form field would
            // otherwise show the ephemeral blob URL (or, with the
            // previous blunt discard, nothing at all). reverseBlobCache
            // maps blob URL → asset id; combined with metadata's
            // filename we can rebuild the canonical reference.
            if (typeof merged.src === 'string' && merged.src.startsWith('blob:')) {
                const recovered = this.recoverAssetUrlFromBlob(merged.src);
                if (recovered) {
                    merged.src = recovered;
                    this.previewBlobUrl = merged.src.startsWith('asset://') ? null : this.previewBlobUrl;
                } else {
                    console.warn('[3D Viewer] Discarding stale blob: URL from stored data');
                    merged.src = '';
                }
            }
            this.state = merged;
        },

        /**
         * Reverse-lookup a blob: URL through AssetManager to rebuild
         * the canonical `asset://<id>.<ext>` reference. Returns '' when
         * recovery isn't possible.
         */
        recoverAssetUrlFromBlob: function (blobUrl) {
            if (typeof blobUrl !== 'string' || !blobUrl.startsWith('blob:')) return '';
            const am = this.getAssetManager();
            if (!am) return '';
            const assetId = am.reverseBlobCache?.get?.(blobUrl);
            if (!assetId) return '';
            const meta = typeof am.getAssetMetadata === 'function' ? am.getAssetMetadata(assetId) : null;
            const filename = (meta && meta.filename) || '';
            const dot = filename.lastIndexOf('.');
            const ext = dot !== -1 ? filename.substring(dot + 1).toLowerCase() : '';
            return ext ? `asset://${assetId}.${ext}` : `asset://${assetId}`;
        },

        get3DViewerJSON: function () {
            const clone = structuredClone(this.state);
            // Legacy field that used to stash the runtime blob URL on the
            // state object; never persist it.
            delete clone._previewBlobUrl;
            // Defensive sanitizer: a blob: URL in src would mean a
            // regression somewhere upstream. Strip it rather than ship
            // a stale URL across save/reload.
            if (typeof clone.src === 'string' && clone.src.startsWith('blob:')) {
                console.warn('[3D Viewer] Stripping blob: URL from serialized state');
                clone.src = '';
            }
            return clone;
        },

        applyStateToForm: function () {
            const s = this.state;
            this.formElements.src.value = s.src || '';
            this.formElements.alt.value = s.alt || '';
            if (this.formElements.modelColor) {
                this.formElements.modelColor.value = s.modelColor || '#888888';
            }
            this.formElements.backgroundColor.value = s.backgroundColor || '#f5f5f5';
            this.formElements.cameraControls.checked = !!s.cameraControls;
            this.formElements.autoRotate.checked = !!s.autoRotate;
            this.formElements.autoRotateSpeed.value = s.autoRotateSpeed || 30;
            this.formElements.showNavControls.checked = !!s.showNavControls;
            this.formElements.animationToggle.checked = !!s.animation.enabled;
            this.formElements.animationSpeed.value = s.animation.speed || 1;
            this.formElements.animationName.value = s.animation.name || '';
            this.updateAutoRotateSpeedState();
            this.updateNavControlsVisibility();
            this.updateModelColorFieldState();
            this.toggleEmptyState();
            if (this.animationRow) {
                this.toggleAnimationRow(false);
            }
            this.formElements.animationToggle.disabled = true;
            this.formElements.animationName.disabled = true;
            this.formElements.animationSpeed.disabled = true;
        },

        readFormState: function () {
            const backgroundColor = this.formElements.backgroundColor.value || '#f5f5f5';
            const modelColor = normalizeHex(this.formElements.modelColor?.value, '#888888');
            const showNavControls = !!this.formElements.showNavControls?.checked;
            this.state = {
                src: this.resolveModelPath(this.formElements.src.value.trim()),
                alt: this.formElements.alt.value.trim(),
                modelColor,
                backgroundColor,
                cameraControls: !!this.formElements.cameraControls.checked,
                // Mutually exclusive: nav controls override auto-rotate
                autoRotate: !showNavControls && !!this.formElements.autoRotate.checked,
                autoRotateSpeed: parseFloat(this.formElements.autoRotateSpeed.value) || 30,
                showNavControls,
                animation: {
                    enabled: !!this.formElements.animationToggle.checked,
                    name: this.formElements.animationName.value || '',
                    speed: Math.min(Math.max(parseFloat(this.formElements.animationSpeed.value) || 1, 0.1), 3),
                },
            };
            // previewBlobUrl is an instance field — it survives state
            // rebuilds without any preserve dance.
            this.updateAutoRotateSpeedState();
        },

        registerBehaviours: function () {
            const onChange = () => {
                this.readFormState();
                this.updatePreview();
            };

            // Generic change listener for everything except src and the
            // mutually-exclusive autoRotate / showNavControls toggles. Those
            // are handled by a dedicated listener below so we can flip the
            // sibling checkbox BEFORE readFormState runs — otherwise the
            // generic onChange would observe stale form values.
            Object.entries(this.formElements).forEach(([key, element]) => {
                if (!element || key === 'src' || key === 'autoRotate' || key === 'showNavControls') {
                    return;
                }
                const events = new Set(['change']);
                if (element.tagName === 'INPUT' && element.type === 'text') {
                    events.add('input');
                }
                events.forEach((eventName) => element.addEventListener(eventName, onChange));
            });

            // Handle file picker change (set by legacyExeIdevicesFilePicker)
            if (this.formElements.src) {
                this.formElements.src.addEventListener('change', () => this.handleModelSelection());
            }

            const handleBehaviorChange = (winner) => {
                if (winner === 'autoRotate' && this.formElements.autoRotate.checked) {
                    if (this.formElements.showNavControls) this.formElements.showNavControls.checked = false;
                } else if (winner === 'showNavControls' && this.formElements.showNavControls?.checked) {
                    this.formElements.autoRotate.checked = false;
                }
                this.readFormState();
                this.updatePreview();
                this.updateAutoRotateSpeedState();
                this.updateNavControlsVisibility();
            };

            this.formElements.autoRotate.addEventListener('change', () => handleBehaviorChange('autoRotate'));
            this.formElements.showNavControls?.addEventListener('change', () => handleBehaviorChange('showNavControls'));
        },

        updateAutoRotateSpeedState: function () {
            const enabled = this.formElements.autoRotate.checked;
            this.formElements.autoRotateSpeed.disabled = !enabled;
            // Show/hide the speed row
            const speedRow = this.ideviceBody.querySelector('#threeDAutoRotateSpeedRow');
            if (speedRow) {
                speedRow.style.display = enabled ? '' : 'none';
            }
        },

        /**
         * Enable/disable the STL model color picker based on the
         * selected file type. The stored value persists regardless so
         * the user's preference survives a swap to GLB and back to STL.
         */
        updateModelColorFieldState: function () {
            const el = this.formElements?.modelColor;
            if (!el) return;
            const isSTL = detectType(this.state?.src) === 'stl';
            el.disabled = !isSTL;
            el.title = isSTL
                ? _('Choose STL model color')
                : _('Only STL files use this color; current file is not STL');
            const hint = this.ideviceBody?.querySelector?.('#threeDModelColorHint');
            if (hint) hint.classList.toggle('text-muted', !isSTL);
        },

        /**
         * Toggle visibility of fullscreen + nav buttons in the editor preview
         * based on the showNavControls state.
         */
        updateNavControlsVisibility: function () {
            const visible = !!this.state?.showNavControls;
            const fs = this.previewContainer?.querySelector('[data-fullscreen]');
            const nav = this.previewContainer?.querySelector('.three-d-viewer-nav');
            if (fs) fs.style.display = visible ? '' : 'none';
            if (nav) nav.style.display = visible ? '' : 'none';
        },

        createModelViewer: async function () {
            await this.ensureModelViewerLoaded();
            this.modelViewer = document.createElement('model-viewer');
            this.modelViewer.setAttribute('shadow-intensity', '1');
            this.modelViewer.setAttribute('tone-mapping', 'pbr-neutral');
            this.modelViewer.setAttribute('reveal', 'auto');
            this.modelViewer.style.width = '100%';
            this.modelViewer.style.height = '100%';
            this.modelViewer.addEventListener('load', () => {
                this.updateAnimationOptions();
                this.applyAnimationState();
                this.toggleEmptyState();
                this.previewRetryCount = 0;
            });
            this.modelViewer.addEventListener('error', () => {
                if (!this.state?.src) {
                    return;
                }
                if (this.previewRetryCount >= 3) {
                    return;
                }
                this.previewRetryCount += 1;
                window.setTimeout(() => this.updatePreview(true), 150 * this.previewRetryCount);
            });
            this.previewContainer.prepend(this.modelViewer);
        },

        updatePreview: async function (force = false) {
            const state = this.state;
            const background = state.backgroundColor || '#f5f5f5';
            this.previewContainer?.style?.setProperty('--viewer-preview-bg', background);

            // Check if file is STL - render with Three.js directly
            if (state.src && this.isSTLFile(state.src)) {
                await this.renderSTLWithThreeJS(force);
                return;
            }

            // For GLB/GLTF files, use model-viewer
            if (!this.modelViewer) return;

            // Ensure model-viewer is visible (might have been hidden for STL)
            this.modelViewer.style.display = '';
            this.hideThreeJSCanvas();

            const viewerSrc = this.getModelViewerUrl(state.src);
            if (viewerSrc && (force || viewerSrc !== this.lastPreviewSrc || !this.modelViewer.src)) {
                this.lastPreviewSrc = viewerSrc;
                this.modelViewer.src = viewerSrc;
                // model-viewer's property doesn't always reflect to the
                // attribute reliably (custom-element timing), so set both.
                this.modelViewer.setAttribute('src', viewerSrc);
            }
            this.modelViewer.alt = state.alt || '';
            if (state.alt) {
                this.modelViewer.setAttribute('aria-label', state.alt);
            } else {
                this.modelViewer.removeAttribute('aria-label');
            }
            this.modelViewer.style.backgroundColor = background;
            if (state.cameraControls) {
                this.modelViewer.setAttribute('camera-controls', '');
            } else {
                this.modelViewer.removeAttribute('camera-controls');
            }
            if (state.autoRotate) {
                this.modelViewer.setAttribute('auto-rotate', '');
                this.modelViewer.setAttribute('rotation-per-second', `${state.autoRotateSpeed || 30}deg`);
            } else {
                this.modelViewer.removeAttribute('auto-rotate');
                this.modelViewer.removeAttribute('rotation-per-second');
            }
            this.applyAnimationState();
            this.toggleEmptyState();
        },

        /**
         * Render STL file via the shared eXe3DViewer runtime. Three.js
         * scene setup, OrbitControls and the animate loop now live in
         * `export/three-d-viewer-runtime.js` so the editor and the
         * exported package share a single implementation.
         */
        renderSTLWithThreeJS: async function (force = false) {
            const state = this.state;
            let blobUrl = this.getModelViewerUrl(state.src);

            // If no blob URL, try async resolution for asset:// URLs.
            // Blob URL goes into the instance field; never the DOM, never
            // state.
            if (!blobUrl && state.src && state.src.startsWith('asset://')) {
                const assetManager = await this.waitForAssetManager(5000);
                if (assetManager) {
                    try {
                        blobUrl = await assetManager.resolveAssetURL(state.src);
                        if (blobUrl) this.previewBlobUrl = blobUrl;
                    } catch (err) {
                        console.error('[3D Viewer] STL: Async resolution failed:', err);
                    }
                } else {
                    console.warn('[3D Viewer] STL: AssetManager not available after waiting');
                }
            }

            if (!blobUrl) {
                console.warn('[3D Viewer] STL: No blob URL available for:', state.src);
                this.toggleEmptyState();
                return;
            }

            // Skip the re-render only when *every* preview-affecting
            // option is unchanged AND a runtime instance is already
            // live. A naive blobUrl-only check would skip when the user
            // changed e.g. modelColor or backgroundColor (same file,
            // different look) — the bug spotted in workarea testing.
            const optionsKey = JSON.stringify({
                src: blobUrl,
                modelColor: state.modelColor,
                backgroundColor: state.backgroundColor,
                cameraControls: !!state.cameraControls,
                autoRotate: !!state.autoRotate,
                autoRotateSpeed: state.autoRotateSpeed,
            });
            const existing = window.eXe3DViewer?.getInstance?.(this.previewContainer);
            if (!force && optionsKey === this.lastPreviewKey && existing?.renderer) {
                return;
            }
            this.lastPreviewKey = optionsKey;
            // Keep lastPreviewSrc in sync for the GLB/GLTF branch in
            // updatePreview, which still uses URL-only comparison.
            this.lastPreviewSrc = blobUrl;

            await this.ensureThreeJSLoaded();
            await this.ensureRuntimeLoaded();

            // Tear down any previous instance bound to this wrapper so
            // we don't accumulate canvases or WebGL contexts.
            window.eXe3DViewer.destroy(this.previewContainer);

            window.eXe3DViewer.init(this.previewContainer, {
                src: blobUrl,
                type: 'stl',
                modelColor: state.modelColor || '#888888',
                backgroundColor: state.backgroundColor || '#f5f5f5',
                cameraControls: !!state.cameraControls,
                autoRotate: !!state.autoRotate,
                autoRotateSpeed: state.autoRotateSpeed || 30,
            });

            this.toggleEmptyState();
        },

        /**
         * Tear down the runtime's STL instance bound to the preview
         * container. Kept as a separate method (rather than inlined)
         * because callers may invoke it before the runtime script has
         * loaded — the optional chain keeps that safe.
         */
        disposeThreeJSScene: function () {
            window.eXe3DViewer?.destroy?.(this.previewContainer);
        },

        /**
         * Hide the Three.js canvas (when switching from STL back to a
         * GLB/GLTF preview). Tearing down the instance disposes the
         * canvas; we keep this for legacy callers that just want to
         * hide it transiently.
         */
        hideThreeJSCanvas: function () {
            const canvas = this.previewContainer?.querySelector('.three-js-canvas');
            if (canvas) {
                canvas.style.display = 'none';
            }
            window.eXe3DViewer?.destroy?.(this.previewContainer);
        },

        applyAnimationState: function () {
            if (!this.modelViewer) return;
            const animation = this.state.animation;
            if (!animation.enabled) {
                this.modelViewer.pause?.();
                this.announce(_('Animation paused'));
                return;
            }
            const available = Array.from(this.modelViewer.availableAnimations || []);
            const targetName = animation.name && available.includes(animation.name) ? animation.name : available[0];
            if (!targetName) {
                this.modelViewer.pause?.();
                return;
            }
            this.modelViewer.animationName = targetName;
            this.modelViewer.animationSpeed = animation.speed || 1;
            this.modelViewer.play?.({ repetitions: Infinity });
            this.announce(`${_('Playing animation')}: ${targetName}`);
        },

        updateAnimationOptions: function () {
            if (!this.modelViewer) return;
            const select = this.formElements.animationName;
            if (!select) return;
            const available = Array.from(this.modelViewer.availableAnimations || []);
            select.innerHTML = '';
            available.forEach((name) => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
            });
            if (available.length) {
                const selected = available.includes(this.state.animation.name)
                    ? this.state.animation.name
                    : available[0];
                select.value = selected;
                this.state.animation.name = selected;
                this.toggleAnimationRow(true);
                this.formElements.animationToggle.disabled = false;
            } else {
                this.formElements.animationToggle.checked = false;
                this.formElements.animationToggle.disabled = true;
                this.state.animation.enabled = false;
                this.state.animation.name = '';
                this.toggleAnimationRow(false);
            }
        },

        toggleAnimationRow: function (visible) {
            if (!this.animationRow) return;
            this.animationRow.hidden = !visible;
            if (!visible) {
                this.formElements.animationToggle.checked = false;
                this.formElements.animationName.disabled = true;
                this.formElements.animationSpeed.disabled = true;
            } else {
                this.formElements.animationName.disabled = false;
                this.formElements.animationSpeed.disabled = false;
            }
            this.formElements.animationToggle.disabled = !visible;
        },

        save: function () {
            this.readFormState();
            const src = this.state.src;
            if (!src) {
                eXe?.app?.alert?.(_('Please select a 3D model file'));
                return false;
            }
            if (!this.isSupportedModelFile(src)) {
                eXe?.app?.alert?.(_('Please select a valid 3D model file (GLB, GLTF, or STL)'));
                return false;
            }
            return this.get3DViewerJSON();
        },

        /**
         * Handle model selection from file picker.
         *
         * Same path for GLB/GLTF and STL: store the asset URL as-is and
         * let updatePreview pick the right renderer (model-viewer for
         * GLB/GLTF, Three.js scene for STL). No upfront STL→GLB
         * conversion — it would create an orphan duplicate file in the
         * asset library.
         *
         * The runtime blob URL is held in `this.previewBlobUrl`
         * (instance field), never written to iDevice state or the form
         * dataset, so it cannot leak into persisted JSON.
         */
        handleModelSelection: async function () {
            const assetUrl = this.formElements.src.value;
            if (!assetUrl) return;

            // Defensive: a misconfigured file picker could return a
            // blob: URL. Refuse it — those URLs are ephemeral and
            // saving one would 404 on reload.
            if (assetUrl.startsWith('blob:')) {
                console.warn('[3D Viewer] Refusing to store blob: URL as model source');
                this.formElements.src.value = '';
                return;
            }

            let blobUrl = null;
            if (assetUrl.startsWith('asset://')) {
                const assetManager = this.getAssetManager();
                if (assetManager) {
                    blobUrl = assetManager.resolveAssetURLSync(assetUrl);
                    if (!blobUrl) {
                        try {
                            blobUrl = await assetManager.resolveAssetURL(assetUrl);
                        } catch (err) {
                            console.error('[3D Viewer] Failed to load asset:', err);
                        }
                    }
                }
            }

            this.state.src = assetUrl;
            this.previewBlobUrl = blobUrl;
            this.readFormState();
            this.updateModelColorFieldState();
            this.updatePreview();
        },

        /**
         * Load Three.js modules for native STL rendering. Three core, STLLoader
         * and OrbitControls live under `export/` because they are also bundled
         * into HTML/SCORM/EPUB exports — single copy avoids drift and ~700 KB
         * of duplicate assets.
         */
        ensureThreeJSLoaded: async function () {
            if (window.THREE?.STLLoader && window.THREE?.OrbitControls) {
                return;
            }
            if (this._threeLoadPromise) {
                return this._threeLoadPromise;
            }

            const sharedBase = this.getThreeJSBaseUrl();

            this._threeLoadPromise = (async () => {
                const THREE = await import(sharedBase + 'three.module.min.js');
                const { STLLoader } = await import(sharedBase + 'STLLoader.js');
                const { OrbitControls } = await import(sharedBase + 'OrbitControls.js');

                window.THREE = window.THREE || {};
                Object.assign(window.THREE, THREE);
                window.THREE.STLLoader = STLLoader;
                window.THREE.OrbitControls = OrbitControls;
            })();

            return this._threeLoadPromise;
        },

        toggleEmptyState: function () {
            const empty = this.previewContainer?.querySelector('[data-empty-state]');
            if (!empty) return;
            // Single source of truth: state.src. Don't trust modelViewer.src
            // because the custom-element property may report stale or
            // unexpected values (e.g. resolved page URL) before a real
            // model is loaded.
            empty.style.display = this.state?.src ? 'none' : 'grid';
        },

        announce: function (message) {
            if (!this.ariaLive) return;
            this.ariaLive.textContent = message;
        },

        /**
         * Check if a file path/URL refers to a supported 3D model format.
         * Handles asset:// URLs, blob: URLs, and regular file paths.
         * @param {string} path - File path or URL
         * @returns {boolean}
         */
        isSupportedModelFile: function (path) {
            if (!path) return false;
            let filename = String(path).toLowerCase();

            // Extract extension from asset:// URL (format: asset://uuid.ext)
            if (filename.startsWith('asset://')) {
                // New format: asset://uuid.ext - just need the extension
                filename = filename.substring('asset://'.length);
            }
            // For blob: URLs, we can't check extension - assume valid if we have blob URL
            // (the file was already validated when uploaded)
            else if (filename.startsWith('blob:')) {
                return true;
            }
            // Extract filename from regular paths
            else {
                const parts = filename.split('/');
                filename = parts[parts.length - 1] || '';
            }

            // Remove query string if present
            filename = filename.split('?')[0].split('#')[0];

            if (!filename) return false;
            return MODEL_EXTENSIONS.some((ext) => filename.endsWith(ext));
        },

        buildFilemanagerUrl: function (endpoint, params = {}) {
            const symfony = window.eXeLearning?.symfony || {};
            const baseURL = (symfony.baseURL || '').replace(/\/+$/g, '');
            const basePath = symfony.basePath ? `/${symfony.basePath.replace(/^\/+|\/+$/g, '')}` : '';
            const base = `${baseURL}${basePath}`.replace(/\/+$/g, '');
            const endpointPath = `filemanager/${String(endpoint || '').replace(/^\/+/, '')}`;
            const urlBase = base ? `${base}/${endpointPath}` : `/${endpointPath}`;
            const search = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    search.append(key, value);
                }
            });
            const sessionId = window.eXeLearning?.app?.project?.odeSession;
            if (sessionId) {
                search.set('odeSessionId', sessionId);
            }
            const query = search.toString();
            return query ? `${urlBase}?${query}` : urlBase;
        },

        resolveModelPath: function (relativePath) {
            if (/^(https?:)?\/\//i.test(relativePath || '')) {
                return String(relativePath || '').trim();
            }
            const cleanPath = String(relativePath || '').replace(/^\/+/, '').replace(/\\+/g, '/');
            if (!cleanPath) {
                return '';
            }
            // Handle asset:// URLs - return unchanged
            if (cleanPath.startsWith('asset://')) {
                return cleanPath;
            }
            // Handle blob: URLs - return unchanged
            if (cleanPath.startsWith('blob:')) {
                return cleanPath;
            }
            if (cleanPath.startsWith('files/')) {
                return cleanPath;
            }
            if (cleanPath.startsWith('custom/')) {
                return cleanPath;
            }
            if (cleanPath.startsWith('file_manager/')) {
                return cleanPath;
            }
            return `file_manager/${cleanPath}`;
        },
        getModelViewerUrl: function (relativePath) {
            // Prefer the runtime preview blob URL when one is live.
            if (this.previewBlobUrl) {
                return this.previewBlobUrl;
            }

            // Handle asset:// URLs - resolve via AssetManager
            if (relativePath && relativePath.startsWith('asset://')) {
                const assetManager = this.getAssetManager();
                if (assetManager) {
                    // Try sync resolution first (instant if cached)
                    const blobUrl = assetManager.resolveAssetURLSync(relativePath);
                    if (blobUrl) return blobUrl;

                    // If not in cache, trigger async load and return empty for now
                    // The model will be loaded when resolveAssetAndUpdate is called
                    this.resolveAssetAndUpdate(relativePath);
                    return ''; // Return empty - model-viewer will show empty state until loaded
                }
                // Don't fall through - asset:// URLs can't be loaded directly
                console.warn('[3D Viewer] Cannot resolve asset:// URL without AssetManager:', relativePath);
                return '';
            }

            // Handle blob: URLs directly
            if (relativePath && relativePath.startsWith('blob:')) {
                return relativePath;
            }

            const normalized = this.resolveModelPath(relativePath);
            if (!normalized) {
                return '';
            }
            if (/^(https?:)?\/\//i.test(normalized)) {
                return normalized;
            }
            if (normalized.startsWith('files/tmp/')) {
                return this.resolveAssetUrl(normalized);
            }
            const sessionId = this.getOdeSessionId();
            if (sessionId && sessionId.length >= 8) {
                const year = sessionId.substring(0, 4);
                const month = sessionId.substring(4, 6);
                const day = sessionId.substring(6, 8);
                const sessionPrefix = `files/tmp/${year}/${month}/${day}/${sessionId}/`;
                if (normalized.startsWith('file_manager/')) {
                    return this.resolveAssetUrl(`${sessionPrefix}${normalized}`);
                }
            }
            return this.resolveAssetUrl(normalized);
        },

        /**
         * Resolve asset:// URL asynchronously and update preview when ready.
         * The blob URL is held in `this.previewBlobUrl`; state stays clean.
         */
        resolveAssetAndUpdate: async function (assetUrl) {
            const assetManager = this.getAssetManager();
            if (!assetManager) return;

            try {
                const blobUrl = await assetManager.resolveAssetURL(assetUrl);
                if (blobUrl) {
                    this.previewBlobUrl = blobUrl;
                    this.updatePreview(true); // Force update with new blob URL
                }
            } catch (err) {
                console.error('[3D Viewer] Failed to resolve asset:', assetUrl, err);
            }
        },

        /**
         * Wait for AssetManager to become available.
         * Useful when iDevice is re-edited and AssetManager might not be immediately ready.
         * @param {number} timeout - Max wait time in ms
         * @returns {Promise<object|null>}
         */
        /**
         * Get the AssetManager from the current context.
         * Checks both project.assetManager and project._yjsBridge.assetManager.
         * @returns {object|null}
         */
        getAssetManager: function () {
            return window.eXeLearning?.app?.project?.assetManager ||
                   window.eXeLearning?.app?.project?._yjsBridge?.assetManager ||
                   null;
        },

        waitForAssetManager: async function (timeout = 5000) {
            const startTime = Date.now();
            const pollInterval = 100;

            while (Date.now() - startTime < timeout) {
                const assetManager = this.getAssetManager();
                if (assetManager) {
                    return assetManager;
                }
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            return null;
        },

        resolveModelUrl: function (path) {
            const symfony = window.eXeLearning?.symfony || {};
            const baseURL = (symfony.baseURL || '').replace(/\/+$/g, '');
            const basePath = symfony.basePath ? `/${symfony.basePath.replace(/^\/+|\/+$/g, '')}` : '';
            const prefix = `${baseURL}${basePath}`.replace(/\/+$/g, '');
            const normalized = String(path || '').replace(/^\/+/, '');
            return prefix ? `${prefix}/${normalized}` : `/${normalized}`;
        },

        formatModelLabel: function (path) {
            const normalized = this.resolveModelPath(path);
            if (!normalized) {
                return '';
            }
            if (normalized.startsWith('files/tmp/')) {
                const index = normalized.indexOf('file_manager/');
                if (index !== -1) {
                    return normalized.substring(index + 'file_manager/'.length);
                }
                const parts = normalized.split('/');
                return parts[parts.length - 1] || normalized;
            }
            return normalized.replace(/^file_manager\//, '');
        },

        resolveAssetUrl: function (path) {
            const symfony = window.eXeLearning?.symfony || {};
            const baseURL = (symfony.baseURL || '').replace(/\/+$/g, '');
            const basePath = symfony.basePath ? `/${symfony.basePath.replace(/^\/+|\/+$/g, '')}` : '';
            const base = `${baseURL}${basePath}`.replace(/\/+$/g, '');
            const normalized = String(path || '').replace(/^\/+/, '');
            return base ? `${base}/${normalized}` : `/${normalized}`;
        },

        /**
         * Get the base URL for Three.js modules with absolute URL including protocol.
         *
         * WHY absolute URLs: Dynamic import() resolves paths relative to the current
         * module's location. If we return a relative path like `/files/perm/...`,
         * and the module is loaded from `/files/perm/.../three-d-viewer.js`, the
         * browser will resolve it as `/files/perm/.../files/perm/...`, causing
         * path duplication. Using absolute URLs (http://...) prevents this.
         *
         * WHY check for protocol: symfony.baseURL might be a relative path (e.g., '/app')
         * or empty. We must ensure the final URL has a protocol for dynamic imports
         * to work correctly regardless of how the main script was loaded.
         *
         * @returns {string} Absolute URL ending with trailing slash (e.g., 'https://example.com/files/perm/.../export/')
         */
        getThreeJSBaseUrl: function () {
            // Shared libs (three core / STLLoader / OrbitControls) live under
            // export/ so editor and exported packages reuse the same copy.
            const relativePath = 'files/perm/idevices/base/three-d-viewer/export/';

            // In static mode, use origin + path without basePath to avoid duplication
            // Static deployments serve files from the deploy root, and basePath is already
            // in the URL - adding it again causes path duplication like /pr-preview/pr-888/pr-preview/pr-888/...
            if (this.isStaticMode()) {
                return window.location.origin + '/' + relativePath;
            }

            const symfony = window.eXeLearning?.symfony || {};
            const baseURL = String(symfony.baseURL || '').replace(/\/+$/g, '');
            const basePath = symfony.basePath ? `/${symfony.basePath.replace(/^\/+|\/+$/g, '')}` : '';
            let url = `${baseURL}${basePath}/${relativePath}`;

            // Ensure absolute URL with protocol for dynamic imports
            if (!/^https?:\/\//i.test(url)) {
                url = window.location.origin + (url.startsWith('/') ? '' : '/') + url;
            }
            return url;
        },

        /**
         * Load the shared 3D viewer runtime script (window.eXe3DViewer)
         * via <script> injection. Idempotent and race-safe across both
         * the editor and the exporter via window.$exeLibs.
         */
        ensureRuntimeLoaded: function () {
            if (window.eXe3DViewer) return Promise.resolve();
            window.$exeLibs = window.$exeLibs || {};
            if (window.$exeLibs.threeDViewerRuntimePromise) {
                return window.$exeLibs.threeDViewerRuntimePromise;
            }
            const url = this.getThreeJSBaseUrl() + 'three-d-viewer-runtime.js';
            window.$exeLibs.threeDViewerRuntimePromise = new Promise((resolve) => {
                const existing = document.querySelector('script[data-threedviewer-runtime]');
                if (existing) {
                    if (window.eXe3DViewer) { resolve(); return; }
                    existing.addEventListener('load', () => resolve());
                    return;
                }
                const script = document.createElement('script');
                script.src = url;
                script.dataset.threedviewerRuntime = '1';
                script.addEventListener('load', () => resolve());
                script.addEventListener('error', (event) => {
                    console.error('[3D Viewer] Unable to load shared runtime', event);
                    resolve(); // Resolve to unblock callers; init guards.
                });
                document.head.appendChild(script);
            });
            return window.$exeLibs.threeDViewerRuntimePromise;
        },

        ensureModelViewerLoaded: function () {
            // Early exit if already registered
            if (window.customElements?.get?.('model-viewer')) {
                return Promise.resolve();
            }

            // Use global namespace to coordinate loading across edition/export
            window.$exeLibs = window.$exeLibs || {};

            // If already loading (from export or previous call), wait for it
            if (window.$exeLibs.modelViewerPromise) {
                return window.$exeLibs.modelViewerPromise;
            }

            // Check for existing script tag
            const existing = document.querySelector('script[data-threedviewer-lib]');
            if (existing) {
                if (window.customElements?.whenDefined) {
                    window.$exeLibs.modelViewerPromise = window.customElements
                        .whenDefined('model-viewer')
                        .catch(() => {});
                    return window.$exeLibs.modelViewerPromise;
                }
                return Promise.resolve();
            }

            const url = this.getModelViewerLibUrl();
            window.$exeLibs.modelViewerPromise = new Promise((resolve) => {
                // Re-check in case of race condition
                if (window.customElements?.get?.('model-viewer')) {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = url;
                script.dataset.threedviewerLib = 'edition';
                script.addEventListener('load', () => {
                    if (window.customElements?.whenDefined) {
                        window.customElements.whenDefined('model-viewer').then(resolve).catch(resolve);
                    } else {
                        resolve();
                    }
                });
                script.addEventListener('error', (event) => {
                    console.error('[3D Viewer] Unable to load model-viewer library', event);
                    resolve();
                });
                document.head.appendChild(script);
            });
            return window.$exeLibs.modelViewerPromise;
        },

        getModelViewerLibUrl: function () {
            const libPath = 'files/perm/idevices/base/three-d-viewer/export/model-viewer.min.js';
            // In static mode, use relative path to avoid basePath duplication
            // The browser resolves './files/...' relative to the current document, which is correct
            if (this.isStaticMode()) {
                return './' + libPath;
            }
            return this.resolveAssetUrl(libPath);
        },

        getOdeSessionId: function () {
            const raw = window.eXeLearning?.app?.project?.odeSession;
            return typeof raw === 'string' ? raw.trim() : '';
        },
    };
})();
