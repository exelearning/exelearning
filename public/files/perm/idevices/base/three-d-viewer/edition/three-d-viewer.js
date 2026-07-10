/* global eXeLearning, eXe */

var $exeDevice = (function () {
    const DEFAULT_STATE = Object.freeze({
        version: 2,
        src: '',
        alt: '',
        modelColor: '#888888',
        backgroundColor: '#f5f5f5',
        cameraControls: true,
        autoRotate: true,
        autoRotateSpeed: 30,
        showNavControls: false,
        animation: { enabled: false, name: '', speed: 1 },
        // SCORM scoring for question markers (0 = off, 1 = auto-save,
        // 2 = save button). Reuses the shared gamification.scorm framework.
        isScorm: 0,
        weighted: 100,
        textButtonScorm: '',
        interaction: {
            enabled: false,
            guidedMode: false,
            wrapNavigation: false,
            showMarkerLabels: true,
            activeMarkerId: '',
            markers: [],
        },
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

    // ─────────────────────────────────────────────────────────────────────
    // Interaction schema (mirror export/three-d-viewer.js and consumed by
    // the shared runtime). These pure helpers must stay byte-identical with
    // the export copy — see doc/architecture/sdd/SDD-0001. Kept as plain
    // functions so migration is defensive and idempotent.
    // ─────────────────────────────────────────────────────────────────────
    var STATE_VERSION = 2;
    var MARKER_ICONS = ['circle', 'pin', 'info', 'question', 'star'];
    var INTERACTION_ACTION_TYPES = ['information', 'image', 'video', 'link', 'question'];

    function tdNum(v, fallback) { var n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : fallback; }
    function tdClamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
    function tdStr(v, fallback) { return typeof v === 'string' ? v : (fallback || ''); }
    function tdId(prefix, existing) {
        if (typeof existing === 'string' && existing) return existing;
        return prefix + '-' + Math.floor(Math.random() * 1e9).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    }
    function tdStripUnsafeUrl(v) { var s = tdStr(v, ''); return /^\s*(blob:|data:|javascript:|vbscript:)/i.test(s) ? '' : s.trim(); }
    function tdInt(v, fallback) { var n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; }
    /** Normalize the SCORM scoring config (mirror edition/export). */
    function normalizeScorm(data) {
        var o = data && typeof data === 'object' ? data : {};
        return {
            isScorm: tdClamp(tdInt(o.isScorm, 0), 0, 2),
            weighted: tdClamp(tdNum(o.weighted, 100), 1, 100),
            textButtonScorm: tdStr(o.textButtonScorm, ''),
        };
    }
    function normalizeVec3(v, dflt) {
        var o = v && typeof v === 'object' ? v : {};
        return { x: tdNum(o.x, dflt.x), y: tdNum(o.y, dflt.y), z: tdNum(o.z, dflt.z) };
    }
    function normalizeAnchor(a) {
        var o = a && typeof a === 'object' ? a : {};
        return {
            position: normalizeVec3(o.position, { x: 0, y: 0, z: 0 }),
            normal: normalizeVec3(o.normal, { x: 0, y: 1, z: 0 }),
            surface: tdStr(o.surface, ''),
        };
    }
    function normalizeCamera(c) {
        var o = c && typeof c === 'object' ? c : {};
        return { orbit: tdStr(o.orbit, ''), target: tdStr(o.target, ''), fieldOfView: tdStr(o.fieldOfView, '') };
    }
    function normalizeQuestion(p) {
        var o = p && typeof p === 'object' ? p : {};
        var rawOpts = Array.isArray(o.options) ? o.options : [];
        var seenCorrect = false;
        var options = rawOpts.slice(0, 10).map(function (opt) {
            var oo = opt && typeof opt === 'object' ? opt : {};
            var correct = !!oo.correct && !seenCorrect;
            if (correct) seenCorrect = true;
            return { id: tdId('option', oo.id), text: tdStr(oo.text, ''), correct: correct };
        });
        if (options.length === 0) {
            options = [{ id: tdId('option'), text: '', correct: true }, { id: tdId('option'), text: '', correct: false }];
        } else if (!seenCorrect) {
            options[0].correct = true;
        }
        return {
            prompt: tdStr(o.prompt, ''),
            type: 'single-choice',
            options: options,
            feedbackCorrect: tdStr(o.feedbackCorrect, ''),
            feedbackIncorrect: tdStr(o.feedbackIncorrect, ''),
            attemptsAllowed: tdClamp(Math.round(tdNum(o.attemptsAllowed, 0)), 0, 20),
        };
    }
    function normalizeAction(a) {
        var o = a && typeof a === 'object' ? a : {};
        var type = INTERACTION_ACTION_TYPES.indexOf(o.type) >= 0 ? o.type : 'information';
        var pin = o.payload && typeof o.payload === 'object' ? o.payload : {};
        var payload;
        switch (type) {
            case 'image': payload = { src: tdStripUnsafeUrl(pin.src), alt: tdStr(pin.alt, ''), caption: tdStr(pin.caption, '') }; break;
            case 'video': payload = { src: tdStripUnsafeUrl(pin.src), poster: tdStripUnsafeUrl(pin.poster) }; break;
            case 'link': payload = { url: tdStripUnsafeUrl(pin.url), newTab: pin.newTab !== false }; break;
            case 'question': payload = normalizeQuestion(pin); break;
            default: payload = { html: tdStr(pin.html, '') }; break;
        }
        return { type: type, payload: payload };
    }
    function normalizeMarker(m, index) {
        var o = m && typeof m === 'object' ? m : {};
        var order = tdNum(o.order, NaN);
        return {
            id: tdId('marker', o.id),
            label: tdStr(o.label, ''),
            description: tdStr(o.description, ''),
            icon: MARKER_ICONS.indexOf(o.icon) >= 0 ? o.icon : 'circle',
            order: Number.isFinite(order) ? order : index,
            anchor: normalizeAnchor(o.anchor),
            camera: normalizeCamera(o.camera),
            action: normalizeAction(o.action),
        };
    }
    function normalizeInteraction(it) {
        var o = it && typeof it === 'object' ? it : {};
        var markers = (Array.isArray(o.markers) ? o.markers : []).map(normalizeMarker);
        markers.sort(function (a, b) { return a.order - b.order; });
        markers.forEach(function (mk, i) { mk.order = i; });
        var ids = markers.map(function (mk) { return mk.id; });
        return {
            enabled: !!o.enabled,
            guidedMode: !!o.guidedMode,
            wrapNavigation: !!o.wrapNavigation,
            showMarkerLabels: o.showMarkerLabels !== false,
            activeMarkerId: ids.indexOf(o.activeMarkerId) >= 0 ? o.activeMarkerId : '',
            markers: markers,
        };
    }
    /** Pure single-choice grading — chosen option id → correct? */
    function gradeSingleChoice(question, selectedOptionId) {
        var q = normalizeQuestion(question);
        var chosen = q.options.filter(function (op) { return op.id === selectedOptionId; })[0];
        return !!(chosen && chosen.correct);
    }

    return {
        name: _('3D Viewer'),
        i18n: {
            name: _('3D Viewer'),
        },

        // Pure interaction-schema helpers exposed for unit tests. They mirror
        // the export copy; keep both in sync.
        __normalizeInteraction: normalizeInteraction,
        __normalizeMarker: normalizeMarker,
        __normalizeAnchor: normalizeAnchor,
        __normalizeCamera: normalizeCamera,
        __normalizeAction: normalizeAction,
        __normalizeQuestion: normalizeQuestion,
        __gradeSingleChoice: gradeSingleChoice,
        __normalizeScorm: normalizeScorm,

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
            // Tear down any prior interaction layer (GLB has no runtime
            // instance so eXe3DViewer.destroy above won't reach it).
            if (this.interactionLayer) {
                try { this.interactionLayer.destroy(); } catch (_) { /* noop */ }
            }
            this.interactionLayer = null;
            this.editingMarkerId = null;
            this.markerEditorDraft = null;
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

                        <!-- Interactions (markers / guided navigation / questions) -->
                        <fieldset class="mb-3 tdv-interactions" data-interactions>
                            <legend class="h6 mb-3">${_('Interactions')}</legend>
                            <div class="toggle-item mb-2">
                                <span class="toggle-control">
                                    <input type="checkbox" id="threeDInteractionsEnable" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label for="threeDInteractionsEnable" class="toggle-label">${_('Enable interactions')}</label>
                            </div>
                            <div id="threeDInteractionsBody" hidden>
                                <div class="toggle-item mb-2">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDGuidedMode" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDGuidedMode" class="toggle-label">${_('Guided navigation (previous / next)')}</label>
                                </div>
                                <div class="toggle-item mb-2">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDWrapNavigation" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDWrapNavigation" class="toggle-label">${_('Wrap around at the ends')}</label>
                                </div>
                                <div class="toggle-item mb-3">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDShowMarkerLabels" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDShowMarkerLabels" class="toggle-label">${_('Show marker labels')}</label>
                                </div>
                                <button type="button" class="btn btn-secondary btn-sm mb-2" id="threeDAddMarker">${_('Add marker')}</button>
                                <p class="form-text text-muted" id="threeDPlacementHint" hidden>${_('Click on the model to place the marker.')}</p>
                                <ul class="tdv-marker-list list-unstyled mb-0" id="threeDMarkerList"></ul>
                                <div class="tdv-scorm mt-3" id="threeDScormSection" hidden>
                                    <h4 class="h6">${_('Assessment (SCORM)')}</h4>
                                    <div id="threeDScormTab"></div>
                                </div>
                            </div>
                        </fieldset>
                        <div class="tdv-marker-editor-host" id="threeDMarkerEditorHost"></div>
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
                interactionsEnable: this.ideviceBody.querySelector('#threeDInteractionsEnable'),
                guidedMode: this.ideviceBody.querySelector('#threeDGuidedMode'),
                wrapNavigation: this.ideviceBody.querySelector('#threeDWrapNavigation'),
                showMarkerLabels: this.ideviceBody.querySelector('#threeDShowMarkerLabels'),
            };
            this.interactionsBody = this.ideviceBody.querySelector('#threeDInteractionsBody');
            this.addMarkerButton = this.ideviceBody.querySelector('#threeDAddMarker');
            this.placementHint = this.ideviceBody.querySelector('#threeDPlacementHint');
            this.markerListEl = this.ideviceBody.querySelector('#threeDMarkerList');
            this.markerEditorHost = this.ideviceBody.querySelector('#threeDMarkerEditorHost');
            this.scormSection = this.ideviceBody.querySelector('#threeDScormSection');
            this.scormTabHost = this.ideviceBody.querySelector('#threeDScormTab');
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
            // Migrate + normalize the interaction layer. Legacy state (no
            // `version`, no `interaction`) yields a disabled, empty block, so
            // pre-interaction projects reopen unchanged. Idempotent.
            merged.version = STATE_VERSION;
            merged.interaction = normalizeInteraction(data && data.interaction);
            var scorm = normalizeScorm(data);
            merged.isScorm = scorm.isScorm;
            merged.weighted = scorm.weighted;
            merged.textButtonScorm = scorm.textButtonScorm;
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
            // Re-normalize the interaction block on the way out: stamps the
            // version, re-strips any blob:/data: media that slipped in during
            // preview, and guarantees a stable, idempotent serialized shape.
            clone.version = STATE_VERSION;
            clone.interaction = normalizeInteraction(clone.interaction);
            var scorm = normalizeScorm(clone);
            clone.isScorm = scorm.isScorm;
            clone.weighted = scorm.weighted;
            clone.textButtonScorm = scorm.textButtonScorm;
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
            // Interaction controls
            const it = s.interaction || {};
            if (this.formElements.interactionsEnable) this.formElements.interactionsEnable.checked = !!it.enabled;
            if (this.formElements.guidedMode) this.formElements.guidedMode.checked = !!it.guidedMode;
            if (this.formElements.wrapNavigation) this.formElements.wrapNavigation.checked = !!it.wrapNavigation;
            if (this.formElements.showMarkerLabels) this.formElements.showMarkerLabels.checked = it.showMarkerLabels !== false;
            this._scormRendered = false;
            this.updateInteractionVisibility();
            this.renderMarkerList();
        },

        readFormState: function () {
            const backgroundColor = this.formElements.backgroundColor.value || '#f5f5f5';
            const modelColor = normalizeHex(this.formElements.modelColor?.value, '#888888');
            const showNavControls = !!this.formElements.showNavControls?.checked;
            this.state = {
                version: STATE_VERSION,
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
                // Interaction state is managed by the dedicated interaction
                // controls (not read from the model/display form), so preserve
                // it here — otherwise a display-option change would wipe every
                // authored marker.
                interaction: (this.state && this.state.interaction) || cloneState().interaction,
                ...this.readScormValues(),
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
            const interactionKeys = ['interactionsEnable', 'guidedMode', 'wrapNavigation', 'showMarkerLabels'];
            Object.entries(this.formElements).forEach(([key, element]) => {
                if (!element || key === 'src' || key === 'autoRotate' || key === 'showNavControls') {
                    return;
                }
                // Interaction toggles have their own handlers (see
                // registerInteractionBehaviours) and must not run the generic
                // readFormState/updatePreview path.
                if (interactionKeys.indexOf(key) !== -1) {
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

            this.registerInteractionBehaviours();
        },

        /**
         * Wire the Interactions section: enable toggle, guided/labels/wrap
         * flags, and the "Add marker" placement button. Live-updates both the
         * persisted state and the preview interaction layer.
         */
        registerInteractionBehaviours: function () {
            const fe = this.formElements;
            const syncFlag = (key, el, onChange) => {
                if (!el) return;
                el.addEventListener('change', () => {
                    this.state.interaction[key] = !!el.checked;
                    if (onChange) onChange();
                    if (this.interactionLayer) this.interactionLayer.setState(this.state.interaction);
                });
            };
            if (fe.interactionsEnable) {
                fe.interactionsEnable.addEventListener('change', () => {
                    this.state.interaction.enabled = !!fe.interactionsEnable.checked;
                    this.updateInteractionVisibility();
                    this.attachInteractionPreview();
                });
            }
            syncFlag('guidedMode', fe.guidedMode);
            syncFlag('wrapNavigation', fe.wrapNavigation);
            syncFlag('showMarkerLabels', fe.showMarkerLabels);
            if (this.addMarkerButton) {
                this.addMarkerButton.addEventListener('click', () => this.startMarkerPlacement());
            }
        },

        /** Show/hide the interaction body and gate the Add-marker button. */
        updateInteractionVisibility: function () {
            const enabled = !!(this.state.interaction && this.state.interaction.enabled);
            if (this.interactionsBody) this.interactionsBody.hidden = !enabled;
            if (this.addMarkerButton) this.addMarkerButton.disabled = !this.state.src;
            this.updateScormVisibility();
        },

        /**
         * (Re)create the preview interaction layer via the shared runtime.
         * Resolves the correct handle per render path and returns the layer
         * (or null). Async because the runtime and the STL mesh load lazily.
         */
        attachInteractionPreview: async function () {
            if (this.interactionLayer) {
                try { this.interactionLayer.destroy(); } catch (_) { /* noop */ }
                this.interactionLayer = null;
            }
            const it = this.state.interaction;
            if (!it || !it.enabled || !this.state.src) return null;
            await this.ensureRuntimeLoaded();
            const runtime = window.eXe3DViewer;
            if (!runtime || typeof runtime.createInteractionLayer !== 'function') return null;
            const type = detectType(this.state.src);
            const hooks = {
                t: (k) => _(k),
                onPlaced: (anchor) => this.handleMarkerPlaced(anchor),
                resolveMediaUrl: (u) => this.getModelViewerUrl(u) || u,
            };
            if (type === 'stl') {
                // Tolerate a cold Three.js module load + STL fetch/parse.
                const inst = await this.waitForStlInstance(20000);
                if (!inst) return null;
                inst.interaction = this.interactionLayer = runtime.createInteractionLayer(
                    { wrapper: this.previewContainer, type: 'stl', instance: inst }, it, 'edit', hooks);
            } else {
                this.interactionLayer = runtime.createInteractionLayer(
                    { wrapper: this.previewContainer, type, modelViewer: this.modelViewer }, it, 'edit', hooks);
            }
            return this.interactionLayer;
        },

        /** Poll the runtime for a booted STL instance with a ready mesh. */
        waitForStlInstance: function (timeoutMs) {
            return new Promise((resolve) => {
                const start = Date.now();
                const poll = () => {
                    const inst = window.eXe3DViewer?.getInstance?.(this.previewContainer);
                    if (inst && inst.mesh) { resolve(inst); return; }
                    if (Date.now() - start > timeoutMs) { resolve(inst || null); return; }
                    (window.requestAnimationFrame || ((cb) => setTimeout(cb, 16)))(poll);
                };
                poll();
            });
        },

        /** Enter marker placement mode; auto-enables interactions if needed. */
        startMarkerPlacement: async function () {
            if (!this.state.src) return;
            if (!this.state.interaction.enabled) {
                this.state.interaction.enabled = true;
                if (this.formElements.interactionsEnable) this.formElements.interactionsEnable.checked = true;
                this.updateInteractionVisibility();
            }
            const layer = await this.attachInteractionPreview();
            if (!layer) return;
            layer.enterPlacementMode();
            if (this.placementHint) this.placementHint.hidden = false;
        },

        /** Called by the layer when the author clicks the model in place mode. */
        handleMarkerPlaced: function (anchor) {
            if (this.placementHint) this.placementHint.hidden = true;
            const idx = this.state.interaction.markers.length;
            const marker = normalizeMarker({
                label: '',
                icon: 'circle',
                order: idx,
                anchor: { position: anchor.position, normal: anchor.normal, surface: anchor.surface || '' },
                camera: anchor.camera || { orbit: '', target: '', fieldOfView: '' },
                action: { type: 'information', payload: { html: '' } },
            }, idx);
            this.state.interaction.markers.push(marker);
            this.renderMarkerList();
            if (this.interactionLayer) this.interactionLayer.setState(this.state.interaction);
            this.openMarkerEditor(marker.id);
        },

        /** Human-readable action-type label for the marker list. */
        actionTypeLabel: function (type) {
            const map = {
                information: _('Information'), image: _('Image'), video: _('Video'),
                link: _('Link'), question: _('Question'),
            };
            return map[type] || type;
        },

        /** Render the editable marker list rows (label, reorder, edit, delete). */
        renderMarkerList: function () {
            if (!this.markerListEl) return;
            const markers = (this.state.interaction && this.state.interaction.markers) || [];
            this.markerListEl.innerHTML = '';
            markers.forEach((m, i) => {
                const li = document.createElement('li');
                li.className = 'tdv-marker-row d-flex align-items-center gap-1 mb-1';
                li.dataset.markerId = m.id;
                const name = document.createElement('span');
                name.className = 'tdv-marker-row-label flex-grow-1';
                name.textContent = `${i + 1}. ${m.label || _('Marker') + ' ' + (i + 1)} — ${this.actionTypeLabel(m.action.type)}`;
                li.appendChild(name);
                const mkBtn = (cls, glyph, title, handler, disabled) => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = `btn btn-sm btn-outline-secondary ${cls}`;
                    b.textContent = glyph;
                    b.title = title;
                    b.setAttribute('aria-label', `${title}: ${m.label || _('Marker') + ' ' + (i + 1)}`);
                    if (disabled) b.disabled = true;
                    b.addEventListener('click', handler);
                    return b;
                };
                li.appendChild(mkBtn('tdv-move-up', '↑', _('Move up'), () => this.moveMarker(m.id, -1), i === 0));
                li.appendChild(mkBtn('tdv-move-down', '↓', _('Move down'), () => this.moveMarker(m.id, 1), i === markers.length - 1));
                li.appendChild(mkBtn('tdv-edit-marker', '✎', _('Edit'), () => this.openMarkerEditor(m.id)));
                li.appendChild(mkBtn('tdv-delete-marker', '✕', _('Delete'), () => this.deleteMarker(m.id)));
                this.markerListEl.appendChild(li);
            });
            // A question marker may have just appeared/disappeared — the SCORM
            // section is only relevant when there is something to score.
            this.updateScormVisibility();
        },

        /** Swap a marker with its neighbour and re-index order. */
        moveMarker: function (id, delta) {
            const markers = this.state.interaction.markers;
            const i = markers.findIndex((m) => m.id === id);
            const j = i + delta;
            if (i < 0 || j < 0 || j >= markers.length) return;
            const tmp = markers[i]; markers[i] = markers[j]; markers[j] = tmp;
            markers.forEach((m, k) => { m.order = k; });
            this.renderMarkerList();
            if (this.interactionLayer) this.interactionLayer.setState(this.state.interaction);
        },

        /** Remove a marker and re-index order. */
        deleteMarker: function (id) {
            this.state.interaction.markers = this.state.interaction.markers.filter((m) => m.id !== id);
            this.state.interaction.markers.forEach((m, k) => { m.order = k; });
            this.renderMarkerList();
            if (this.interactionLayer) this.interactionLayer.setState(this.state.interaction);
            if (this.editingMarkerId === id) this.closeMarkerEditor();
        },

        /** Open the accessible marker editor panel for a marker. */
        openMarkerEditor: function (id) {
            const marker = this.state.interaction.markers.find((m) => m.id === id);
            if (!marker || !this.markerEditorHost) return;
            this.editingMarkerId = id;
            const draft = normalizeMarker(JSON.parse(JSON.stringify(marker)), marker.order);
            this.markerEditorDraft = draft;
            const host = this.markerEditorHost;
            host.innerHTML = `
                <div class="tdv-marker-editor" role="dialog" aria-modal="false" aria-label="${_('Edit marker')}">
                    <div class="tdv-marker-editor-head d-flex justify-content-between align-items-center mb-2">
                        <h3 class="h6 mb-0">${_('Edit marker')}</h3>
                        <button type="button" class="btn-close" data-close aria-label="${_('Close')}"></button>
                    </div>
                    <div class="mb-2">
                        <label class="form-label" for="tdvMkLabel">${_('Label')}</label>
                        <input type="text" class="form-control" id="tdvMkLabel" maxlength="120" />
                    </div>
                    <div class="row g-2 mb-2">
                        <div class="col">
                            <label class="form-label" for="tdvMkIcon">${_('Icon')}</label>
                            <select class="form-select" id="tdvMkIcon"></select>
                        </div>
                        <div class="col">
                            <label class="form-label" for="tdvMkType">${_('Action type')}</label>
                            <select class="form-select" id="tdvMkType"></select>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label" for="tdvMkDesc">${_('Short description')}</label>
                        <input type="text" class="form-control" id="tdvMkDesc" maxlength="200" />
                    </div>
                    <div class="tdv-action-fields mb-2" id="tdvActionFields"></div>
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <button type="button" class="btn btn-outline-secondary btn-sm" data-capture-camera>${_('Capture current camera')}</button>
                        <span class="form-text text-muted mb-0" data-camera-note></span>
                    </div>
                    <div class="d-flex justify-content-between mt-2">
                        <button type="button" class="btn btn-outline-danger btn-sm" data-delete>${_('Delete marker')}</button>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-outline-secondary btn-sm" data-cancel>${_('Cancel')}</button>
                            <button type="button" class="btn btn-primary btn-sm" data-save>${_('Save marker')}</button>
                        </div>
                    </div>
                </div>`;
            const iconSel = host.querySelector('#tdvMkIcon');
            ['circle', 'pin', 'info', 'question', 'star'].forEach((ic) => {
                const o = document.createElement('option'); o.value = ic; o.textContent = ic; iconSel.appendChild(o);
            });
            const typeSel = host.querySelector('#tdvMkType');
            [['information', _('Information')], ['image', _('Image')], ['video', _('Video')], ['link', _('Link')], ['question', _('Question')]].forEach(([v, l]) => {
                const o = document.createElement('option'); o.value = v; o.textContent = l; typeSel.appendChild(o);
            });
            host.querySelector('#tdvMkLabel').value = draft.label;
            host.querySelector('#tdvMkDesc').value = draft.description;
            iconSel.value = draft.icon;
            typeSel.value = draft.action.type;
            const cameraNote = host.querySelector('[data-camera-note]');
            if (draft.camera && (draft.camera.orbit || draft.camera.target)) cameraNote.textContent = _('Camera captured');
            const renderActionFields = () => this.renderMarkerActionFields(host.querySelector('#tdvActionFields'), draft);
            renderActionFields();
            typeSel.addEventListener('change', () => {
                draft.action = normalizeAction({ type: typeSel.value, payload: {} });
                iconSel.value = typeSel.value === 'question' ? 'question' : iconSel.value;
                renderActionFields();
            });
            host.querySelector('[data-capture-camera]').addEventListener('click', () => {
                if (this.interactionLayer) {
                    draft.camera = this.interactionLayer.captureCamera();
                    cameraNote.textContent = _('Camera captured');
                }
            });
            host.querySelector('[data-close]').addEventListener('click', () => this.closeMarkerEditor());
            host.querySelector('[data-cancel]').addEventListener('click', () => this.closeMarkerEditor());
            host.querySelector('[data-delete]').addEventListener('click', () => this.deleteMarker(id));
            host.querySelector('[data-save]').addEventListener('click', () => this.saveMarkerEditor());
            host.querySelector('#tdvMkLabel').focus();
        },

        /** Render the action-specific fields into the marker editor. */
        renderMarkerActionFields: function (container, draft) {
            container.innerHTML = '';
            const type = draft.action.type;
            const p = draft.action.payload;
            const addField = (labelText, input, id) => {
                const w = document.createElement('div'); w.className = 'mb-2';
                const lb = document.createElement('label'); lb.className = 'form-label';
                if (id) { lb.setAttribute('for', id); input.id = id; }
                lb.textContent = labelText;
                w.appendChild(lb); w.appendChild(input); container.appendChild(w);
                return input;
            };
            const textInput = (val) => { const i = document.createElement('input'); i.type = 'text'; i.className = 'form-control'; i.value = val || ''; return i; };
            const textarea = (val) => { const t = document.createElement('textarea'); t.className = 'form-control'; t.rows = 3; t.value = val || ''; return t; };
            if (type === 'information') {
                const ta = addField(_('Content (HTML allowed)'), textarea(p.html), 'tdvMkHtml');
                ta.addEventListener('input', () => { p.html = ta.value; });
            } else if (type === 'image') {
                const s = addField(_('Image URL'), textInput(p.src), 'tdvMkImgSrc'); s.addEventListener('input', () => { p.src = s.value; });
                const a = addField(_('Alternative text'), textInput(p.alt), 'tdvMkImgAlt'); a.addEventListener('input', () => { p.alt = a.value; });
                const c = addField(_('Caption'), textInput(p.caption), 'tdvMkImgCap'); c.addEventListener('input', () => { p.caption = c.value; });
            } else if (type === 'video') {
                const s = addField(_('Video URL'), textInput(p.src), 'tdvMkVidSrc'); s.addEventListener('input', () => { p.src = s.value; });
                const po = addField(_('Poster URL'), textInput(p.poster), 'tdvMkVidPoster'); po.addEventListener('input', () => { p.poster = po.value; });
            } else if (type === 'link') {
                const u = addField(_('Link URL'), textInput(p.url), 'tdvMkLinkUrl'); u.addEventListener('input', () => { p.url = u.value; });
                const nt = document.createElement('div'); nt.className = 'form-check';
                const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'form-check-input'; cb.id = 'tdvMkNewTab'; cb.checked = p.newTab !== false;
                const l = document.createElement('label'); l.className = 'form-check-label'; l.setAttribute('for', 'tdvMkNewTab'); l.textContent = _('Open in a new tab');
                nt.append(cb, l); container.appendChild(nt);
                cb.addEventListener('change', () => { p.newTab = cb.checked; });
            } else if (type === 'question') {
                this.renderQuestionFields(container, p);
            }
        },

        /** Render single-choice question authoring fields. */
        renderQuestionFields: function (container, p) {
            const prompt = document.createElement('textarea');
            prompt.className = 'form-control mb-2'; prompt.rows = 2; prompt.value = p.prompt || '';
            prompt.setAttribute('aria-label', _('Question prompt')); prompt.placeholder = _('Question prompt');
            prompt.addEventListener('input', () => { p.prompt = prompt.value; });
            container.appendChild(prompt);
            const optsWrap = document.createElement('div'); optsWrap.className = 'tdv-q-options';
            container.appendChild(optsWrap);
            const renderOpts = () => {
                optsWrap.innerHTML = '';
                p.options.forEach((opt, idx) => {
                    const row = document.createElement('div'); row.className = 'input-group input-group-sm mb-1';
                    const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'tdvMkCorrect';
                    radio.className = 'form-check-input mt-2 me-2'; radio.checked = !!opt.correct;
                    radio.setAttribute('aria-label', `${_('Correct answer')} ${idx + 1}`);
                    radio.addEventListener('change', () => { p.options.forEach((o) => { o.correct = false; }); opt.correct = true; });
                    const txt = document.createElement('input'); txt.type = 'text'; txt.className = 'form-control';
                    txt.value = opt.text || ''; txt.placeholder = `${_('Option')} ${idx + 1}`;
                    txt.addEventListener('input', () => { opt.text = txt.value; });
                    const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'btn btn-outline-secondary';
                    rm.textContent = '✕'; rm.setAttribute('aria-label', `${_('Remove option')} ${idx + 1}`);
                    rm.disabled = p.options.length <= 2;
                    rm.addEventListener('click', () => {
                        p.options = p.options.filter((o) => o !== opt);
                        if (!p.options.some((o) => o.correct) && p.options[0]) p.options[0].correct = true;
                        renderOpts();
                    });
                    row.append(radio, txt, rm); optsWrap.appendChild(row);
                });
            };
            renderOpts();
            const addOpt = document.createElement('button'); addOpt.type = 'button';
            addOpt.className = 'btn btn-outline-secondary btn-sm mb-2'; addOpt.textContent = _('Add option');
            addOpt.addEventListener('click', () => {
                if (p.options.length >= 8) return;
                p.options.push({ id: 'option-' + Math.random().toString(36).slice(2), text: '', correct: false });
                renderOpts();
            });
            container.appendChild(addOpt);
            const fc = document.createElement('input'); fc.type = 'text'; fc.className = 'form-control mb-2';
            fc.value = p.feedbackCorrect || ''; fc.placeholder = _('Feedback when correct');
            fc.addEventListener('input', () => { p.feedbackCorrect = fc.value; }); container.appendChild(fc);
            const fi = document.createElement('input'); fi.type = 'text'; fi.className = 'form-control mb-2';
            fi.value = p.feedbackIncorrect || ''; fi.placeholder = _('Feedback when incorrect');
            fi.addEventListener('input', () => { p.feedbackIncorrect = fi.value; }); container.appendChild(fi);
            const atWrap = document.createElement('div'); atWrap.className = 'mb-1';
            const atl = document.createElement('label'); atl.className = 'form-label'; atl.setAttribute('for', 'tdvMkAttempts');
            atl.textContent = _('Attempts allowed (0 = unlimited)');
            const at = document.createElement('input'); at.type = 'number'; at.className = 'form-control'; at.id = 'tdvMkAttempts';
            at.min = '0'; at.max = '20'; at.value = p.attemptsAllowed || 0;
            at.addEventListener('input', () => { p.attemptsAllowed = parseInt(at.value, 10) || 0; });
            atWrap.append(atl, at); container.appendChild(atWrap);
        },

        /** Persist the marker editor draft back into state. */
        saveMarkerEditor: function () {
            const draft = this.markerEditorDraft;
            if (!draft) return;
            draft.label = this.markerEditorHost.querySelector('#tdvMkLabel').value || '';
            draft.description = this.markerEditorHost.querySelector('#tdvMkDesc').value || '';
            draft.icon = this.markerEditorHost.querySelector('#tdvMkIcon').value;
            const idx = this.state.interaction.markers.findIndex((m) => m.id === this.editingMarkerId);
            if (idx >= 0) this.state.interaction.markers[idx] = normalizeMarker(draft, idx);
            this.renderMarkerList();
            if (this.interactionLayer) this.interactionLayer.setState(this.state.interaction);
            this.closeMarkerEditor();
        },

        /** Close and clear the marker editor panel. */
        closeMarkerEditor: function () {
            this.editingMarkerId = null;
            this.markerEditorDraft = null;
            if (this.markerEditorHost) this.markerEditorHost.innerHTML = '';
        },

        /** The shared SCORM edition helper, or null when the framework is absent. */
        getScormEdition: function () {
            return (typeof $exeDevicesEdition !== 'undefined'
                && $exeDevicesEdition.iDevice
                && $exeDevicesEdition.iDevice.gamification
                && $exeDevicesEdition.iDevice.gamification.scorm) || null;
        },

        /** Whether the interaction has at least one question marker. */
        hasQuestionMarkers: function () {
            return ((this.state.interaction && this.state.interaction.markers) || [])
                .some((m) => m.action && m.action.type === 'question');
        },

        /** Show the SCORM section only when there is a question to score. */
        updateScormVisibility: function () {
            if (!this.scormSection) return;
            const show = !!(this.state.interaction && this.state.interaction.enabled) && this.hasQuestionMarkers();
            this.scormSection.hidden = !show;
            if (show && !this._scormRendered) this.renderScormTab();
        },

        /** Inject the standard SCORM tab and reflect the saved config. */
        renderScormTab: function () {
            const scorm = this.getScormEdition();
            if (!scorm || !this.scormTabHost || typeof scorm.getTab !== 'function') return;
            try {
                this.scormTabHost.innerHTML = scorm.getTab(false, false);
                if (typeof scorm.init === 'function') scorm.init();
                if (typeof scorm.setValues === 'function') {
                    scorm.setValues(this.state.isScorm || 0, this.state.textButtonScorm || _('Save score'), true, this.state.weighted || 100);
                }
                this._scormRendered = true;
            } catch (e) {
                console.warn('[3D Viewer] SCORM tab unavailable:', e);
            }
        },

        /** Read the SCORM config from the tab, or preserve the stored values. */
        readScormValues: function () {
            const scorm = this.getScormEdition();
            if (scorm && this._scormRendered && typeof scorm.getValues === 'function') {
                try {
                    const v = scorm.getValues();
                    return normalizeScorm({ isScorm: v.isScorm, weighted: v.weighted, textButtonScorm: v.textButtonScorm });
                } catch (e) {
                    /* fall through to preserve stored values */
                }
            }
            return normalizeScorm(this.state);
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
                : _('Only STL files use this color; the current file is not STL');
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
                // Attach the interaction layer once the model is ready so
                // hotspots can position against real geometry.
                this.attachInteractionPreview();
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
            // Attach the interaction layer once the STL instance mesh is
            // ready (attachInteractionPreview polls the runtime).
            this.attachInteractionPreview();
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
