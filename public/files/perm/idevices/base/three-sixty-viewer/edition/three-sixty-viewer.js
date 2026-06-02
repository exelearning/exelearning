/* eslint-disable no-undef */
/**
 * 360° panorama viewer iDevice (edition code).
 * Stores a virtual-tour-capable v2 state: scenes[] + behaviour + hotspots.
 * v1 single-image data is migrated transparently into a single-scene tour.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $exeDevice = {
    i18n: {
        name: _('360° panorama viewer'),
    },

    SCHEMA_VERSION: 2,

    defaultBehaviour: () => ({
        autorotate: { enabled: false, speed: 1 },
        zoomEnabled: true,
        fullscreenEnabled: true,
        renderQuality: 'high',
        showLabels: true,
        labelPosition: 'right',
        imageAdjustments: { brightness: 1, contrast: 1, saturation: 1 },
    }),

    defaultScene: id => ({
        id: id || 'scene-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36),
        title: '',
        src: '',
        alt: '',
        description: '',
        // 'equirectangular' = 360° panorama (default); 'flat' = regular photo,
        // shown undistorted (no spherical wrap) with x/y-positioned hotspots.
        projection: 'equirectangular',
        initialView: { yaw: 0, pitch: 0, fov: 75 },
        hotspots: [],
    }),

    defaultHotspot: id => ({
        id: id || 'hs-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36),
        label: '',
        icon: 'circle',
        // yaw/pitch are used on equirectangular scenes; x/y (percent of the
        // displayed image) are used on flat scenes.
        yaw: 0,
        pitch: 0,
        x: 50,
        y: 50,
        action: { type: 'text', payload: { html: '' } },
    }),

    PROJECTION_VALUES: ['equirectangular', 'flat'],
    HOTSPOT_ACTION_TYPES: ['goToScene', 'text', 'image', 'video', 'link'],
    RENDER_QUALITY_VALUES: ['low', 'medium', 'high'],
    LABEL_POSITION_VALUES: ['right', 'left', 'top', 'bottom'],

    // Runtime state for the live preview
    _preview: null,
    _rafId: null,
    _scriptsLoading: null,
    _activeSceneIndex: 0,

    /**
     * eXeLearning idevice engine init
     * @param {HTMLElement} element - form container
     * @param {object} previousData - JSON returned by save()
     * @param {string} idevicePath - optional path to iDevice resources
     */
    init: function (element, previousData, idevicePath) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = idevicePath || '';
        this.state = this.normalizeData(previousData);
        this._activeSceneIndex = this.findStartSceneIndex();
        this.createForm();
        this.addFormBehaviour();
        this.updatePreviewSoon();
    },

    /**
     * Always returns a fresh v2-shaped state. Accepts v1 (single-image) input
     * and lifts it into a one-scene tour. ideviceId is preserved when present.
     */
    normalizeData: function (data) {
        var raw = data && typeof data === 'object' ? data : {};
        var v2 = this.migrateToV2(raw);
        var scenes =
            Array.isArray(v2.scenes) && v2.scenes.length > 0
                ? v2.scenes.map(this.normalizeScene, this)
                : [this.defaultScene('scene-1')];
        var startSceneId = this.resolveStartSceneId(v2.startSceneId, scenes);
        return {
            version: this.SCHEMA_VERSION,
            ideviceId: typeof raw.ideviceId === 'string' ? raw.ideviceId : '',
            startSceneId: startSceneId,
            scenes: scenes,
            behaviour: this.normalizeBehaviour(v2.behaviour),
        };
    },

    /**
     * Detect the schema version of input. Anything without scenes[] is treated
     * as v1 (the original single-image shape from PR #1689).
     */
    migrateToV2: function (data) {
        if (data && data.version >= 2 && Array.isArray(data.scenes)) {
            return {
                scenes: data.scenes,
                startSceneId: typeof data.startSceneId === 'string' ? data.startSceneId : '',
                behaviour: data.behaviour && typeof data.behaviour === 'object' ? data.behaviour : {},
            };
        }
        // v1: lift top-level src/alt/initialView into a single scene
        var hasV1Fields =
            data &&
            (typeof data.src === 'string' ||
                typeof data.alt === 'string' ||
                data.initialView ||
                data.autorotate ||
                'zoomEnabled' in data ||
                'fullscreenEnabled' in data);
        if (hasV1Fields) {
            var scene = this.defaultScene('scene-1');
            scene.src = typeof data.src === 'string' ? data.src : '';
            scene.alt = typeof data.alt === 'string' ? data.alt : '';
            scene.initialView = this.normalizeInitialView(data.initialView);
            return {
                scenes: [scene],
                startSceneId: 'scene-1',
                behaviour: {
                    autorotate: data.autorotate || {},
                    zoomEnabled: data.zoomEnabled,
                    fullscreenEnabled: data.fullscreenEnabled,
                    showNavControls: data.showNavControls,
                },
            };
        }
        return { scenes: [], startSceneId: '', behaviour: {} };
    },

    normalizeInitialView: function (iv) {
        var s = iv && typeof iv === 'object' ? iv : {};
        return {
            yaw: this.clamp(this.toNumber(s.yaw, 0), -180, 180),
            pitch: this.clamp(this.toNumber(s.pitch, 0), -90, 90),
            fov: this.clamp(this.toNumber(s.fov, 75), 30, 120),
        };
    },

    normalizeScene: function (s, index) {
        var src = s && typeof s === 'object' ? s : {};
        var fallbackId = 'scene-' + (typeof index === 'number' ? index + 1 : 1);
        var hotspots = Array.isArray(src.hotspots) ? src.hotspots.map(this.normalizeHotspot, this) : [];
        return {
            id: typeof src.id === 'string' && src.id ? src.id : fallbackId,
            title: typeof src.title === 'string' ? src.title : '',
            src: typeof src.src === 'string' ? src.src : '',
            alt: typeof src.alt === 'string' ? src.alt : '',
            description: typeof src.description === 'string' ? src.description : '',
            projection: src.projection === 'flat' ? 'flat' : 'equirectangular',
            initialView: this.normalizeInitialView(src.initialView),
            hotspots: hotspots,
        };
    },

    normalizeHotspot: function (h) {
        var src = h && typeof h === 'object' ? h : {};
        var actionRaw = src.action && typeof src.action === 'object' ? src.action : {};
        var type = this.HOTSPOT_ACTION_TYPES.indexOf(actionRaw.type) >= 0 ? actionRaw.type : 'text';
        var payload = actionRaw.payload && typeof actionRaw.payload === 'object' ? actionRaw.payload : {};
        return {
            id: typeof src.id === 'string' && src.id ? src.id : this.defaultHotspot().id,
            label: typeof src.label === 'string' ? src.label : '',
            icon: typeof src.icon === 'string' ? src.icon : 'circle',
            yaw: this.clamp(this.toNumber(src.yaw, 0), -180, 180),
            pitch: this.clamp(this.toNumber(src.pitch, 0), -90, 90),
            x: this.clamp(this.toNumber(src.x, 50), 0, 100),
            y: this.clamp(this.toNumber(src.y, 50), 0, 100),
            action: { type: type, payload: this.normalizeHotspotPayload(type, payload) },
        };
    },

    normalizeHotspotPayload: (type, payload) => {
        switch (type) {
            case 'goToScene':
                return { sceneId: typeof payload.sceneId === 'string' ? payload.sceneId : '' };
            case 'text':
                return { html: typeof payload.html === 'string' ? payload.html : '' };
            case 'image':
                return {
                    src: typeof payload.src === 'string' ? payload.src : '',
                    alt: typeof payload.alt === 'string' ? payload.alt : '',
                    caption: typeof payload.caption === 'string' ? payload.caption : '',
                };
            case 'video':
                return {
                    src: typeof payload.src === 'string' ? payload.src : '',
                    poster: typeof payload.poster === 'string' ? payload.poster : '',
                };
            case 'link':
                return {
                    url: typeof payload.url === 'string' ? payload.url : '',
                    newTab: payload.newTab !== false,
                };
            default:
                return {};
        }
    },

    normalizeBehaviour: function (b) {
        var src = b && typeof b === 'object' ? b : {};
        var ar = src.autorotate && typeof src.autorotate === 'object' ? src.autorotate : {};
        var ia = src.imageAdjustments && typeof src.imageAdjustments === 'object' ? src.imageAdjustments : {};
        var renderQuality = this.RENDER_QUALITY_VALUES.indexOf(src.renderQuality) >= 0 ? src.renderQuality : 'high';
        var labelPosition = this.LABEL_POSITION_VALUES.indexOf(src.labelPosition) >= 0 ? src.labelPosition : 'right';
        return {
            autorotate: {
                enabled: !!ar.enabled,
                speed: this.clamp(this.toNumber(ar.speed, 1), 0, 10),
            },
            zoomEnabled: src.zoomEnabled !== false,
            fullscreenEnabled: src.fullscreenEnabled !== false,
            showNavControls: src.showNavControls !== false,
            renderQuality: renderQuality,
            showLabels: src.showLabels !== false,
            labelPosition: labelPosition,
            imageAdjustments: {
                brightness: this.clamp(this.toNumber(ia.brightness, 1), 0.1, 3),
                contrast: this.clamp(this.toNumber(ia.contrast, 1), 0.1, 3),
                saturation: this.clamp(this.toNumber(ia.saturation, 1), 0, 3),
            },
        };
    },

    /**
     * If startSceneId points at a missing scene, fall back to the first scene.
     */
    resolveStartSceneId: (requested, scenes) => {
        if (!Array.isArray(scenes) || scenes.length === 0) return '';
        if (typeof requested === 'string' && requested) {
            for (var i = 0; i < scenes.length; i++) {
                if (scenes[i].id === requested) return requested;
            }
        }
        return scenes[0].id;
    },

    findStartSceneIndex: function () {
        if (!this.state || !Array.isArray(this.state.scenes)) return 0;
        for (var i = 0; i < this.state.scenes.length; i++) {
            if (this.state.scenes[i].id === this.state.startSceneId) return i;
        }
        return 0;
    },

    getActiveScene: function () {
        if (!this.state || !Array.isArray(this.state.scenes) || this.state.scenes.length === 0) {
            return this.defaultScene('scene-1');
        }
        var idx = this._activeSceneIndex;
        if (idx < 0 || idx >= this.state.scenes.length) idx = 0;
        return this.state.scenes[idx];
    },

    toNumber: (v, fallback) => {
        var n = typeof v === 'number' ? v : parseFloat(v);
        return isFinite(n) ? n : fallback;
    },

    clamp: (v, min, max) => {
        if (v < min) return min;
        if (v > max) return max;
        return v;
    },

    /**
     * Compute the rectangle a `object-fit: contain` image occupies inside a box,
     * accounting for letterboxing. Falls back to the full box when the natural
     * dimensions are unavailable (e.g. image not yet decoded, or jsdom tests).
     * Shared by editor placement and runtime hotspot positioning so the two
     * agree on the flat-image coordinate basis.
     */
    containedImageRect: (naturalW, naturalH, boxW, boxH) => {
        if (!naturalW || !naturalH || !boxW || !boxH) {
            return { left: 0, top: 0, width: boxW || 0, height: boxH || 0 };
        }
        var scale = Math.min(boxW / naturalW, boxH / naturalH);
        var w = naturalW * scale;
        var h = naturalH * scale;
        return { left: (boxW - w) / 2, top: (boxH - h) / 2, width: w, height: h };
    },

    /**
     * Make WebGL output match the source panorama's apparent brightness/colour.
     * Without this the canvas reads sRGB textures as linear and renders darker.
     */
    applyColorManagement: renderer => {
        if (typeof THREE === 'undefined' || !renderer) return;
        if (THREE.ColorManagement && 'enabled' in THREE.ColorManagement) {
            THREE.ColorManagement.enabled = true;
        }
        if ('outputColorSpace' in renderer && typeof THREE.SRGBColorSpace !== 'undefined') {
            renderer.outputColorSpace = THREE.SRGBColorSpace;
        } else if ('outputEncoding' in renderer && typeof THREE.sRGBEncoding !== 'undefined') {
            renderer.outputEncoding = THREE.sRGBEncoding;
        }
        if ('toneMapping' in renderer && typeof THREE.NoToneMapping !== 'undefined') {
            renderer.toneMapping = THREE.NoToneMapping;
            renderer.toneMappingExposure = 1.0;
        }
    },

    applyTextureColorSpace: texture => {
        if (!texture || typeof THREE === 'undefined') return;
        if ('colorSpace' in texture && typeof THREE.SRGBColorSpace !== 'undefined') {
            texture.colorSpace = THREE.SRGBColorSpace;
        } else if ('encoding' in texture && typeof THREE.sRGBEncoding !== 'undefined') {
            texture.encoding = THREE.sRGBEncoding;
        }
    },

    // Scene management helpers (used by Phase 3 UI)

    addScene: function () {
        var idx = this.state.scenes.length + 1;
        var scene = this.defaultScene('scene-' + Date.now().toString(36) + '-' + idx);
        scene.title = _('Scene') + ' ' + idx;
        this.state.scenes.push(scene);
        return scene;
    },

    duplicateScene: function (sceneIndex) {
        var src = this.state.scenes[sceneIndex];
        if (!src) return null;
        var copy = this.normalizeScene(JSON.parse(JSON.stringify(src)));
        copy.id = 'scene-' + Date.now().toString(36) + '-' + this.state.scenes.length;
        copy.title = src.title ? src.title + ' (' + _('copy') + ')' : '';
        copy.hotspots = copy.hotspots.map(h =>
            Object.assign({}, h, {
                id: 'hs-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36),
            }),
        );
        this.state.scenes.splice(sceneIndex + 1, 0, copy);
        return copy;
    },

    removeScene: function (sceneIndex) {
        if (!this.state.scenes[sceneIndex]) return null;
        var removed = this.state.scenes.splice(sceneIndex, 1)[0];
        if (this.state.scenes.length === 0) {
            this.state.scenes.push(this.defaultScene('scene-1'));
        }
        // Repair startSceneId / activeSceneIndex if we deleted them
        this.state.startSceneId = this.resolveStartSceneId(this.state.startSceneId, this.state.scenes);
        if (this._activeSceneIndex >= this.state.scenes.length) {
            this._activeSceneIndex = this.state.scenes.length - 1;
        }
        // Repair goToScene hotspots that pointed at the removed scene
        this.state.scenes.forEach(sc => {
            sc.hotspots.forEach(h => {
                if (
                    h.action &&
                    h.action.type === 'goToScene' &&
                    h.action.payload &&
                    h.action.payload.sceneId === removed.id
                ) {
                    h.action.payload.sceneId = '';
                }
            });
        });
        return removed;
    },

    setStartScene: function (sceneId) {
        this.state.startSceneId = this.resolveStartSceneId(sceneId, this.state.scenes);
    },

    setActiveSceneIndex: function (idx) {
        if (idx < 0 || idx >= this.state.scenes.length) return;
        this._activeSceneIndex = idx;
        this.refreshActiveSceneInputs();
        this.updatePreviewSoon();
        this.renderHotspotList();
    },

    addHotspot: function (yaw, pitch) {
        var scene = this.getActiveScene();
        var h = this.defaultHotspot();
        h.label = _('Hotspot') + ' ' + (scene.hotspots.length + 1);
        h.yaw = this.clamp(this.toNumber(yaw, 0), -180, 180);
        h.pitch = this.clamp(this.toNumber(pitch, 0), -90, 90);
        scene.hotspots.push(h);
        return h;
    },

    /**
     * Add a hotspot to a flat scene, positioned by x/y percent of the displayed
     * image (0–100). Used when the active scene's projection is 'flat'.
     */
    addHotspotFlat: function (x, y) {
        var scene = this.getActiveScene();
        var h = this.defaultHotspot();
        h.label = _('Hotspot') + ' ' + (scene.hotspots.length + 1);
        h.x = this.clamp(this.toNumber(x, 50), 0, 100);
        h.y = this.clamp(this.toNumber(y, 50), 0, 100);
        scene.hotspots.push(h);
        return h;
    },

    removeHotspot: function (hotspotIndex) {
        var scene = this.getActiveScene();
        if (!scene.hotspots[hotspotIndex]) return null;
        return scene.hotspots.splice(hotspotIndex, 1)[0];
    },

    getCurrentCameraYawPitch: function () {
        // Try to read live camera direction from the preview; fall back to scene's initial view.
        var scene = this.getActiveScene();
        var p = this._preview;
        if (p && p.camera && typeof p.camera.getWorldDirection === 'function') {
            var dir = new THREE.Vector3();
            try {
                p.camera.getWorldDirection(dir);
                var pitch = (Math.asin(this.clamp(dir.y, -1, 1)) * 180) / Math.PI;
                var yaw = (Math.atan2(dir.x, dir.z) * 180) / Math.PI;
                return { yaw: this.clamp(yaw, -180, 180), pitch: this.clamp(pitch, -90, 90) };
            } catch (_) {
                /* fall through */
            }
        }
        return { yaw: scene.initialView.yaw, pitch: scene.initialView.pitch };
    },

    /**
     * Build the form HTML and insert it into the iDevice body.
     */
    createForm: function () {
        var scene = this.getActiveScene();
        var b = this.state.behaviour;
        var isFlat = scene.projection === 'flat';
        // The "Initial view" controls (yaw/pitch/fov) only make sense on a 360°
        // panorama; a flat photo is shown undistorted with no camera to aim.
        var initialViewFieldset = isFlat
            ? ''
            : `
                    <fieldset class="exe-fieldset">
                        <legend>${_('Initial view')}</legend>
                        <div class="property-row">
                            <label for="threeSixtyYaw">${_('Yaw')} (-180…180):</label>
                            <input type="number" id="threeSixtyYaw" class="form-control" min="-180" max="180" step="1" value="${scene.initialView.yaw}" />
                            <label for="threeSixtyPitch">${_('Pitch')} (-90…90):</label>
                            <input type="number" id="threeSixtyPitch" class="form-control" min="-90" max="90" step="1" value="${scene.initialView.pitch}" />
                            <label for="threeSixtyFov">${_('Field of view')} (30…120):</label>
                            <input type="number" id="threeSixtyFov" class="form-control" min="30" max="120" step="1" value="${scene.initialView.fov}" />
                        </div>
                    </fieldset>`;
        var html = `
            <div class="three-sixty-viewer-form">
                <p class="exe-block-info">${_('Add equirectangular 360° images (2:1 aspect), or uncheck “360° panorama image” to use a regular flat photo. The viewer uses WebGL for 360° scenes.')}</p>

                <fieldset class="exe-fieldset three-sixty-scenes">
                    <legend>${_('Scenes')}</legend>
                    <div id="threeSixtySceneList" class="three-sixty-scene-list" role="list"></div>
                    <div class="property-row">
                        <button type="button" id="threeSixtyAddScene" class="btn btn-secondary">${_('Add scene')}</button>
                    </div>
                </fieldset>

                <fieldset class="exe-fieldset three-sixty-active-scene">
                    <legend id="threeSixtyActiveSceneLegend">${_('Active scene')}</legend>
                    <div class="property-row">
                        <label for="threeSixtySceneTitle" class="form-label">${_('Title')}:</label>
                        <input type="text" id="threeSixtySceneTitle" class="form-control" value="${this.escapeAttr(scene.title)}" />
                    </div>
                    <div class="property-row">
                        <label for="threeSixtyImageButton" class="form-label">${_('Panorama image')}:</label>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <button type="button" id="threeSixtyImageButton" class="btn btn-secondary">${_('Choose image…')}</button>
                            <span id="threeSixtyImageName" class="small text-muted">${scene.src ? this.escapeHtml(this.truncateLabel(scene.src)) : _('No image selected')}</span>
                            <button type="button" id="threeSixtyImageClear" class="btn btn-link p-0" ${scene.src ? '' : 'hidden'}>${_('Clear')}</button>
                        </div>
                        <input type="file" id="threeSixtyImageFile" accept="image/*" style="display:none" />
                    </div>
                    <div class="property-row">
                        <label class="toggle-label">
                            <input type="checkbox" id="threeSixtyIsPanorama" ${isFlat ? '' : 'checked'} />
                            ${_('360° panorama image')}
                        </label>
                        <span class="small text-muted">${_('Uncheck for a regular flat photo (no 360° effect).')}</span>
                    </div>
                    <div class="property-row">
                        <label for="threeSixtyAlt" class="form-label">${_('Alternative text')}:</label>
                        <input type="text" id="threeSixtyAlt" class="form-control" value="${this.escapeAttr(scene.alt)}" />
                    </div>
                    <div class="property-row">
                        <label for="threeSixtySceneDescription" class="form-label">${_('Description')}:</label>
                        <textarea id="threeSixtySceneDescription" class="form-control" rows="2">${this.escapeHtml(scene.description)}</textarea>
                    </div>
                    ${initialViewFieldset}

                    <fieldset class="exe-fieldset three-sixty-hotspots">
                        <legend>${_('Hotspots')}</legend>
                        <p class="exe-block-info small">${isFlat ? _('Click on the image to place a hotspot, or drag an existing hotspot to move it.') : _('Click on the panorama to place a hotspot, or drag an existing hotspot to move it.')}</p>
                        <div id="threeSixtyHotspotList" class="three-sixty-hotspot-list" role="list"></div>
                        <div class="property-row">
                            <button type="button" id="threeSixtyPlaceHotspot" class="btn btn-primary">${_('Place hotspot by clicking')}</button>
                            <button type="button" id="threeSixtyAddHotspot" class="btn btn-link">${_('…or add at current view')}</button>
                        </div>
                    </fieldset>
                </fieldset>

                <fieldset class="exe-fieldset">
                    <legend>${_('Controls')}</legend>
                    <div class="property-row">
                        <label class="toggle-label">
                            <input type="checkbox" id="threeSixtyAutorotate" ${b.autorotate.enabled ? 'checked' : ''} />
                            ${_('Auto-rotate')}
                        </label>
                        <label for="threeSixtyAutorotateSpeed">${_('Speed')} (0…10):</label>
                        <input type="number" id="threeSixtyAutorotateSpeed" class="form-control" min="0" max="10" step="0.1" value="${b.autorotate.speed}" />
                    </div>
                    <div class="property-row">
                        <label class="toggle-label">
                            <input type="checkbox" id="threeSixtyZoom" ${b.zoomEnabled ? 'checked' : ''} />
                            ${_('Allow zoom')}
                        </label>
                        <label class="toggle-label">
                            <input type="checkbox" id="threeSixtyFullscreen" ${b.fullscreenEnabled ? 'checked' : ''} />
                            ${_('Show fullscreen button')}
                        </label>
                        <label class="toggle-label">
                            <input type="checkbox" id="threeSixtyShowLabels" ${b.showLabels ? 'checked' : ''} />
                            ${_('Show hotspot labels')}
                        </label>
                        <label class="toggle-label">
                            <input type="checkbox" id="threeSixtyNavControls" ${b.showNavControls ? 'checked' : ''} />
                            ${_('Show navigation arrows')}
                        </label>
                    </div>
                </fieldset>

                <div class="three-sixty-viewer-preview">
                    <div id="threeSixtyPreview" class="three-sixty-preview-stage" aria-label="${_('Preview')}"></div>
                    <p id="threeSixtyPreviewMessage" class="text-muted small">${_('Select an image to see a live preview.')}</p>
                </div>
            </div>
        `;
        this.ideviceBody.innerHTML = html;
        this.renderSceneList();
        this.renderHotspotList();
    },

    /**
     * Render the scene list panel.
     */
    renderSceneList: function () {
        var body = this.ideviceBody;
        if (!body) return;
        var list = body.querySelector('#threeSixtySceneList');
        if (!list) return;

        list.innerHTML = '';
        this.state.scenes.forEach((scene, idx) => {
            var row = document.createElement('div');
            row.className = 'three-sixty-scene-item' + (idx === this._activeSceneIndex ? ' is-active' : '');
            row.setAttribute('role', 'listitem');
            row.setAttribute('data-scene-index', String(idx));
            var label = scene.title || _('Scene') + ' ' + (idx + 1);
            var isStart = scene.id === this.state.startSceneId;
            row.innerHTML =
                '<button type="button" class="three-sixty-scene-select btn btn-link" data-action="select" data-index="' +
                idx +
                '">' +
                this.escapeHtml(label) +
                (isStart ? ' <span class="badge text-bg-info">' + _('Start') + '</span>' : '') +
                '</button>' +
                '<div class="three-sixty-scene-actions" role="group" aria-label="' +
                this.escapeAttr(_('Scene actions')) +
                '">' +
                '<button type="button" class="btn btn-sm btn-link" data-action="set-start" data-index="' +
                idx +
                '" aria-label="' +
                this.escapeAttr(_('Set as start scene')) +
                '"' +
                (isStart ? ' disabled' : '') +
                '>★</button>' +
                '<button type="button" class="btn btn-sm btn-link" data-action="duplicate" data-index="' +
                idx +
                '" aria-label="' +
                this.escapeAttr(_('Duplicate scene')) +
                '">⎘</button>' +
                '<button type="button" class="btn btn-sm btn-link" data-action="remove" data-index="' +
                idx +
                '" aria-label="' +
                this.escapeAttr(_('Remove scene')) +
                '">✕</button>' +
                '</div>';
            list.appendChild(row);
        });
    },

    /**
     * Render the hotspot list for the active scene + the live overlay handles
     * on the panorama preview, so the form and the canvas stay in sync.
     */
    renderHotspotList: function () {
        this._renderHotspotListUI();
        this._renderEditorHotspots();
    },

    _renderHotspotListUI: function () {
        var body = this.ideviceBody;
        if (!body) return;
        var list = body.querySelector('#threeSixtyHotspotList');
        if (!list) return;

        var scene = this.getActiveScene();
        var isFlat = scene.projection === 'flat';
        list.innerHTML = '';
        if (!scene.hotspots.length) {
            var empty = document.createElement('p');
            empty.className = 'text-muted small';
            empty.textContent = _('No hotspots in this scene yet.');
            list.appendChild(empty);
            return;
        }
        scene.hotspots.forEach((h, idx) => {
            var item = document.createElement('div');
            item.className = 'three-sixty-hotspot-item';
            item.setAttribute('role', 'listitem');
            item.setAttribute('data-hotspot-index', String(idx));
            var actionOptions = this.HOTSPOT_ACTION_TYPES.map(
                type =>
                    '<option value="' +
                    type +
                    '"' +
                    (h.action.type === type ? ' selected' : '') +
                    '>' +
                    this.escapeHtml(this.actionTypeLabel(type)) +
                    '</option>',
            ).join('');
            item.innerHTML =
                '<div class="property-row">' +
                '<label>' +
                _('Label') +
                ': <input type="text" class="form-control hotspot-label" data-index="' +
                idx +
                '" value="' +
                this.escapeAttr(h.label) +
                '" /></label>' +
                '<button type="button" class="btn btn-sm btn-link" data-hotspot-action="remove" data-index="' +
                idx +
                '" aria-label="' +
                this.escapeAttr(_('Remove hotspot')) +
                '">✕</button>' +
                '</div>' +
                '<div class="property-row">' +
                (isFlat
                    ? '<label>' +
                      'X' +
                      ' (%): <input type="number" class="form-control hotspot-x" data-index="' +
                      idx +
                      '" min="0" max="100" step="1" value="' +
                      h.x +
                      '" /></label>' +
                      '<label>' +
                      'Y' +
                      ' (%): <input type="number" class="form-control hotspot-y" data-index="' +
                      idx +
                      '" min="0" max="100" step="1" value="' +
                      h.y +
                      '" /></label>'
                    : '<label>' +
                      _('Yaw') +
                      ': <input type="number" class="form-control hotspot-yaw" data-index="' +
                      idx +
                      '" min="-180" max="180" step="1" value="' +
                      h.yaw +
                      '" /></label>' +
                      '<label>' +
                      _('Pitch') +
                      ': <input type="number" class="form-control hotspot-pitch" data-index="' +
                      idx +
                      '" min="-90" max="90" step="1" value="' +
                      h.pitch +
                      '" /></label>') +
                '<label>' +
                _('Action') +
                ': <select class="form-control hotspot-action-type" data-index="' +
                idx +
                '">' +
                actionOptions +
                '</select></label>' +
                '</div>' +
                '<div class="property-row hotspot-payload" data-index="' +
                idx +
                '">' +
                this.renderHotspotPayloadInputs(h, idx) +
                '</div>';
            list.appendChild(item);
        });
    },

    actionTypeLabel: type => {
        switch (type) {
            case 'goToScene':
                return _('Go to scene');
            case 'text':
                return _('Text');
            case 'image':
                return _('Image');
            case 'video':
                return _('Video');
            case 'link':
                return _('External link');
            default:
                return type;
        }
    },

    renderHotspotPayloadInputs: function (h, idx) {
        var p = h.action.payload || {};

        switch (h.action.type) {
            case 'goToScene': {
                var options = this.state.scenes
                    .map(sc => {
                        var label = sc.title || sc.id;
                        return (
                            '<option value="' +
                            this.escapeAttr(sc.id) +
                            '"' +
                            (p.sceneId === sc.id ? ' selected' : '') +
                            '>' +
                            this.escapeHtml(label) +
                            '</option>'
                        );
                    })
                    .join('');
                return (
                    '<label>' +
                    _('Target scene') +
                    ': <select class="form-control hotspot-payload-sceneId" data-index="' +
                    idx +
                    '"><option value="">--</option>' +
                    options +
                    '</select></label>'
                );
            }
            case 'text':
                return (
                    '<label>' +
                    _('Text') +
                    ': <textarea class="form-control hotspot-payload-html" data-index="' +
                    idx +
                    '" rows="3">' +
                    this.escapeHtml(p.html || '') +
                    '</textarea></label>'
                );
            case 'image':
                return (
                    '<label>' +
                    _('Image URL') +
                    ': <input type="text" class="form-control hotspot-payload-src" data-index="' +
                    idx +
                    '" value="' +
                    this.escapeAttr(p.src || '') +
                    '" /></label>' +
                    '<button type="button" class="btn btn-sm btn-secondary hotspot-payload-pickImage" data-index="' +
                    idx +
                    '">' +
                    _('Choose image…') +
                    '</button>' +
                    '<label>' +
                    _('Caption') +
                    ': <input type="text" class="form-control hotspot-payload-caption" data-index="' +
                    idx +
                    '" value="' +
                    this.escapeAttr(p.caption || '') +
                    '" /></label>'
                );
            case 'video':
                return (
                    '<label>' +
                    _('Video URL') +
                    ': <input type="text" class="form-control hotspot-payload-src" data-index="' +
                    idx +
                    '" value="' +
                    this.escapeAttr(p.src || '') +
                    '" /></label>' +
                    '<button type="button" class="btn btn-sm btn-secondary hotspot-payload-pickVideo" data-index="' +
                    idx +
                    '">' +
                    _('Choose video…') +
                    '</button>' +
                    '<p class="exe-block-info small">' +
                    this.escapeHtml(
                        _('Paste a YouTube, Vimeo or Educamadrid Mediateca page URL to embed it, or choose an uploaded video file.'),
                    ) +
                    '</p>'
                );
            case 'link':
                return (
                    '<label>' +
                    _('Link URL') +
                    ': <input type="url" class="form-control hotspot-payload-url" data-index="' +
                    idx +
                    '" value="' +
                    this.escapeAttr(p.url || '') +
                    '" placeholder="https://example.com" /></label>' +
                    '<label class="toggle-label"><input type="checkbox" class="hotspot-payload-newTab" data-index="' +
                    idx +
                    '"' +
                    (p.newTab !== false ? ' checked' : '') +
                    ' /> ' +
                    _('Open in a new tab') +
                    '</label>'
                );
            default:
                return '';
        }
    },

    refreshActiveSceneInputs: function () {
        var body = this.ideviceBody;
        if (!body) return;
        var scene = this.getActiveScene();
        var fields = {
            '#threeSixtySceneTitle': scene.title,
            '#threeSixtyAlt': scene.alt,
            '#threeSixtySceneDescription': scene.description,
            '#threeSixtyYaw': scene.initialView.yaw,
            '#threeSixtyPitch': scene.initialView.pitch,
            '#threeSixtyFov': scene.initialView.fov,
        };
        Object.keys(fields).forEach(sel => {
            var el = body.querySelector(sel);
            if (el && el.value !== String(fields[sel])) el.value = fields[sel];
        });
        this.refreshImageLabel();
        var legend = body.querySelector('#threeSixtyActiveSceneLegend');
        if (legend) legend.textContent = scene.title || _('Scene') + ' ' + (this._activeSceneIndex + 1);
    },

    /**
     * Wire up change events on the form controls.
     */
    addFormBehaviour: function () {
        var body = this.ideviceBody;

        body.querySelector('#threeSixtyImageButton').addEventListener('click', () => {
            this.pickImage();
        });
        body.querySelector('#threeSixtyImageClear').addEventListener('click', () => {
            this.getActiveScene().src = '';
            this.refreshImageLabel();
            this.updatePreviewSoon();
        });
        body.querySelector('#threeSixtyImageFile').addEventListener('change', ev => {
            var file = ev.target.files && ev.target.files[0];
            if (file) this.handleFileFallback(file);
        });

        body.querySelector('#threeSixtySceneTitle').addEventListener('input', ev => {
            this.getActiveScene().title = String(ev.target.value || '');
            this.renderSceneList();
        });
        body.querySelector('#threeSixtyAlt').addEventListener('input', ev => {
            this.getActiveScene().alt = String(ev.target.value || '');
        });
        body.querySelector('#threeSixtySceneDescription').addEventListener('input', ev => {
            this.getActiveScene().description = String(ev.target.value || '');
        });

        var panoramaToggle = body.querySelector('#threeSixtyIsPanorama');
        if (panoramaToggle) {
            panoramaToggle.addEventListener('change', ev => {
                this.getActiveScene().projection = ev.target.checked ? 'equirectangular' : 'flat';
                // Mode change swaps the renderer (WebGL sphere ↔ flat <img>) and
                // the per-scene fields, so rebuild the form and preview wholesale.
                this.destroyPreview();
                this.createForm();
                this.addFormBehaviour();
                this.updatePreviewSoon();
            });
        }

        var numericFields = [
            ['#threeSixtyYaw', 'initialView.yaw', -180, 180],
            ['#threeSixtyPitch', 'initialView.pitch', -90, 90],
            ['#threeSixtyFov', 'initialView.fov', 30, 120],
        ];
        numericFields.forEach(f => {
            var el = body.querySelector(f[0]);
            if (!el) return;
            el.addEventListener('input', () => {
                var scene = this.getActiveScene();
                this.setNestedPath(scene, f[1], this.clamp(this.toNumber(el.value, 0), f[2], f[3]));
                this.updatePreviewSoon();
            });
        });

        body.querySelector('#threeSixtyAutorotateSpeed').addEventListener('input', ev => {
            this.state.behaviour.autorotate.speed = this.clamp(this.toNumber(ev.target.value, 0), 0, 10);
            this.updatePreviewSoon();
        });
        body.querySelector('#threeSixtyAutorotate').addEventListener('change', ev => {
            this.state.behaviour.autorotate.enabled = !!ev.target.checked;
            this.updatePreviewSoon();
        });
        body.querySelector('#threeSixtyZoom').addEventListener('change', ev => {
            this.state.behaviour.zoomEnabled = !!ev.target.checked;
            this.updatePreviewSoon();
        });
        body.querySelector('#threeSixtyFullscreen').addEventListener('change', ev => {
            this.state.behaviour.fullscreenEnabled = !!ev.target.checked;
        });
        body.querySelector('#threeSixtyShowLabels').addEventListener('change', ev => {
            this.state.behaviour.showLabels = !!ev.target.checked;
            this.updatePreviewSoon();
        });
        body.querySelector('#threeSixtyNavControls').addEventListener('change', ev => {
            this.state.behaviour.showNavControls = !!ev.target.checked;
            this.updatePreviewSoon();
        });

        body.querySelector('#threeSixtyAddScene').addEventListener('click', () => {
            this.addScene();
            this._activeSceneIndex = this.state.scenes.length - 1;
            this.refreshActiveSceneInputs();
            this.renderSceneList();
            this.renderHotspotList();
            this.updatePreviewSoon();
        });

        body.querySelector('#threeSixtySceneList').addEventListener('click', ev => {
            var btn = ev.target.closest('button[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            var idx = parseInt(btn.getAttribute('data-index'), 10);
            if (isNaN(idx)) return;
            if (action === 'select') this.setActiveSceneIndex(idx);
            else if (action === 'set-start') {
                this.setStartScene(this.state.scenes[idx].id);
                this.renderSceneList();
            } else if (action === 'duplicate') {
                this.duplicateScene(idx);
                this.renderSceneList();
            } else if (action === 'remove') {
                this.removeScene(idx);
                this._activeSceneIndex = Math.min(this._activeSceneIndex, this.state.scenes.length - 1);
                this.refreshActiveSceneInputs();
                this.renderSceneList();
                this.renderHotspotList();
                this.updatePreviewSoon();
            }
        });

        body.querySelector('#threeSixtyAddHotspot').addEventListener('click', () => {
            if (this.getActiveScene().projection === 'flat') {
                this.addHotspotFlat(50, 50);
            } else {
                var pose = this.getCurrentCameraYawPitch();
                this.addHotspot(pose.yaw, pose.pitch);
            }
            this.renderHotspotList();
            this.updatePreviewSoon();
        });
        body.querySelector('#threeSixtyPlaceHotspot').addEventListener('click', () => {
            this._placingHotspot = !this._placingHotspot;
            this.refreshPlacementMode();
        });

        body.querySelector('#threeSixtyHotspotList').addEventListener('input', ev => {
            var t = ev.target;
            var idx = parseInt(t.getAttribute && t.getAttribute('data-index'), 10);
            if (isNaN(idx)) return;
            var h = this.getActiveScene().hotspots[idx];
            if (!h) return;
            if (t.classList.contains('hotspot-label')) h.label = String(t.value || '');
            else if (t.classList.contains('hotspot-yaw')) h.yaw = this.clamp(this.toNumber(t.value, 0), -180, 180);
            else if (t.classList.contains('hotspot-pitch')) h.pitch = this.clamp(this.toNumber(t.value, 0), -90, 90);
            else if (t.classList.contains('hotspot-x')) h.x = this.clamp(this.toNumber(t.value, 50), 0, 100);
            else if (t.classList.contains('hotspot-y')) h.y = this.clamp(this.toNumber(t.value, 50), 0, 100);
            else if (t.classList.contains('hotspot-payload-sceneId')) h.action.payload.sceneId = String(t.value || '');
            else if (t.classList.contains('hotspot-payload-html')) h.action.payload.html = String(t.value || '');
            else if (t.classList.contains('hotspot-payload-src')) h.action.payload.src = String(t.value || '');
            else if (t.classList.contains('hotspot-payload-caption')) h.action.payload.caption = String(t.value || '');
            else if (t.classList.contains('hotspot-payload-url')) h.action.payload.url = String(t.value || '');
            this.updatePreviewSoon();
        });

        body.querySelector('#threeSixtyHotspotList').addEventListener('change', ev => {
            var t = ev.target;
            var idx = parseInt(t.getAttribute && t.getAttribute('data-index'), 10);
            if (isNaN(idx)) return;
            if (t.classList.contains('hotspot-action-type')) {
                var h = this.getActiveScene().hotspots[idx];
                if (!h) return;
                h.action.type = this.HOTSPOT_ACTION_TYPES.indexOf(t.value) >= 0 ? t.value : 'text';
                h.action.payload = this.normalizeHotspotPayload(h.action.type, {});
                this.renderHotspotList();
                this.updatePreviewSoon();
            } else if (t.classList.contains('hotspot-payload-newTab')) {
                var hs = this.getActiveScene().hotspots[idx];
                if (!hs) return;
                hs.action.payload.newTab = !!t.checked;
            }
        });

        body.querySelector('#threeSixtyHotspotList').addEventListener('click', ev => {
            var btn = ev.target.closest('button[data-hotspot-action="remove"]');
            if (btn) {
                var idx = parseInt(btn.getAttribute('data-index'), 10);
                if (!isNaN(idx)) {
                    this.removeHotspot(idx);
                    this.renderHotspotList();
                    this.updatePreviewSoon();
                }
                return;
            }
            var pickImg = ev.target.closest('button.hotspot-payload-pickImage');
            if (pickImg) {
                var imgIdx = parseInt(pickImg.getAttribute('data-index'), 10);
                if (!isNaN(imgIdx)) this.pickHotspotMedia(imgIdx, 'image');
                return;
            }
            var pickVid = ev.target.closest('button.hotspot-payload-pickVideo');
            if (pickVid) {
                var vidIdx = parseInt(pickVid.getAttribute('data-index'), 10);
                if (!isNaN(vidIdx)) this.pickHotspotMedia(vidIdx, 'video');
            }
        });
    },

    /**
     * Assign a nested property defined by a dotted path (e.g. "initialView.yaw").
     */
    setNestedPath: (target, path, value) => {
        var parts = path.split('.');
        var t = target;
        for (var i = 0; i < parts.length - 1; i++) {
            t = t[parts[i]];
        }
        t[parts[parts.length - 1]] = value;
    },

    escapeHtml: str =>
        String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;'),

    escapeAttr: function (str) {
        return this.escapeHtml(str).replace(/"/g, '&quot;');
    },

    /**
     * Open the file manager or fall back to a hidden input.
     */
    pickImage: function () {
        var fm = this._getFileManager();
        if (fm) {
            fm.show({
                accept: 'image',
                multiSelect: false,
                onSelect: result => {
                    if (!result) return;
                    var assetUrl = result.assetUrl || '';
                    if (!assetUrl) return;
                    this.getActiveScene().src = assetUrl;
                    this.refreshImageLabel();
                    this.updatePreviewSoon();
                },
            });
            return;
        }
        this.ideviceBody.querySelector('#threeSixtyImageFile').click();
    },

    pickHotspotMedia: function (hotspotIndex, kind) {
        var fm = this._getFileManager();
        if (!fm) return;
        fm.show({
            accept: kind === 'video' ? 'video' : 'image',
            multiSelect: false,
            onSelect: result => {
                if (!result || !result.assetUrl) return;
                var h = this.getActiveScene().hotspots[hotspotIndex];
                if (!h) return;
                h.action.payload.src = result.assetUrl;
                this.renderHotspotList();
            },
        });
    },

    _getFileManager: () =>
        typeof eXeLearning !== 'undefined' &&
        eXeLearning &&
        eXeLearning.app &&
        eXeLearning.app.modals &&
        eXeLearning.app.modals.filemanager &&
        typeof eXeLearning.app.modals.filemanager.show === 'function'
            ? eXeLearning.app.modals.filemanager
            : null,

    /**
     * Fallback when filemanager is not available: read file as data URL.
     */
    handleFileFallback: function (file) {
        var reader = new FileReader();
        reader.onload = () => {
            this.getActiveScene().src = String(reader.result || '');
            this.refreshImageLabel();
            this.updatePreviewSoon();
        };
        reader.readAsDataURL(file);
    },

    refreshImageLabel: function () {
        var body = this.ideviceBody;
        if (!body) return;
        var name = body.querySelector('#threeSixtyImageName');
        var clearBtn = body.querySelector('#threeSixtyImageClear');
        var src = this.getActiveScene().src;
        if (name) name.textContent = src ? this.truncateLabel(src) : _('No image selected');
        if (clearBtn) {
            if (src) clearBtn.removeAttribute('hidden');
            else clearBtn.setAttribute('hidden', 'hidden');
        }
    },

    truncateLabel: s => {
        if (s.length <= 60) return s;
        return s.slice(0, 28) + '…' + s.slice(-28);
    },

    /**
     * Save() returns a plain JSON object (component-type=json) shaped for v2.
     */
    save: function () {
        var body = this.ideviceBody;
        if (body) {
            var alt = body.querySelector('#threeSixtyAlt');
            if (alt) this.getActiveScene().alt = String(alt.value || '');
        }
        var normalized = this.normalizeData(this.state);
        if (body && body.getAttribute) {
            var id = body.getAttribute('idevice-id') || body.getAttribute('data-idevice-id');
            if (id) normalized.ideviceId = id;
        }
        this.destroyPreview();
        return normalized;
    },

    /**
     * Live preview — lazy-load three.js then render an inverted sphere.
     * Tests running without THREE will skip rendering.
     */
    updatePreviewSoon: function () {
        if (this._updateQueued) return;
        this._updateQueued = true;
        var schedule =
            typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
                ? window.requestAnimationFrame.bind(window)
                : cb => setTimeout(cb, 16);
        schedule(() => {
            this._updateQueued = false;
            this.renderPreview();
        });
    },

    renderPreview: function () {
        var body = this.ideviceBody;
        if (!body) return;
        var stage = body.querySelector('#threeSixtyPreview');
        var message = body.querySelector('#threeSixtyPreviewMessage');
        if (!stage) return;

        var scene = this.getActiveScene();
        if (!scene.src) {
            this.destroyPreview();
            if (message) {
                message.textContent = _('Select an image to see a live preview.');
                message.style.display = '';
            }
            return;
        }

        // Flat scenes are rendered with a plain <img> — no WebGL/three.js needed.
        if (scene.projection === 'flat') {
            if (
                !this._preview ||
                this._preview.mode !== 'flat' ||
                this._preview.currentSrc !== scene.src
            ) {
                this.destroyPreview();
                this._preview = this.createFlatPreview(stage);
            }
            this.applyPreviewState();
            if (message) message.style.display = 'none';
            return;
        }

        if (typeof THREE === 'undefined') {
            this.ensureThreeLoaded(
                function () {
                    if (typeof THREE !== 'undefined') {
                        this.renderPreview();
                    }
                }.bind(this),
            );
            if (message) {
                message.textContent = _('Loading 3D preview…');
                message.style.display = '';
            }
            return;
        }

        if (!this._preview) {
            this._preview = this.createPreview(stage);
        } else if (this._preview.mode === 'flat' || this._preview.currentSrc !== scene.src) {
            this.destroyPreview();
            this._preview = this.createPreview(stage);
        }
        this.applyPreviewState();
        if (message) message.style.display = 'none';
    },

    ensureThreeLoaded: function (cb) {
        var self = this;
        if (typeof window === 'undefined') return cb();
        if (typeof THREE !== 'undefined' && THREE.OrbitControls) return cb();
        if (typeof document !== 'undefined') {
            var already = document.querySelector('script[src$="three.min.js"]');
            if (already && typeof THREE !== 'undefined') return cb();
        }
        if (this._scriptsLoading) {
            this._scriptsLoading.push(cb);
            return;
        }
        this._scriptsLoading = [cb];
        var base = this.idevicePath || '';
        var candidates = [];
        if (base) {
            candidates.push(base.replace(/\/edition\/?$/, '/export/'));
            candidates.push(base);
        }
        candidates.push('../export/');
        candidates.push('');

        function loadScript(url, done) {
            var existing = document.querySelector('script[data-three-sixty-src="' + url + '"]');
            if (existing) return done();
            var s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.setAttribute('data-three-sixty-src', url);
            s.onload = () => {
                done();
            };
            s.onerror = () => {
                done(new Error('failed: ' + url));
            };
            document.head.appendChild(s);
        }

        function tryLoad(i) {
            if (i >= candidates.length) {
                self._scriptsLoading.forEach(c => {
                    try {
                        c();
                    } catch (_) {
                        /* ignore */
                    }
                });
                self._scriptsLoading = null;
                return;
            }
            var prefix = candidates[i];
            loadScript(prefix + 'three.min.js', err => {
                if (err) return tryLoad(i + 1);
                loadScript(prefix + 'OrbitControls.js', err2 => {
                    if (err2) return tryLoad(i + 1);
                    var cbs = self._scriptsLoading || [];
                    self._scriptsLoading = null;
                    cbs.forEach(c => {
                        try {
                            c();
                        } catch (_) {
                            /* ignore */
                        }
                    });
                });
            });
        }
        tryLoad(0);
    },

    createPreview: function (stage) {
        var scene = this.getActiveScene();
        while (stage.firstChild) stage.removeChild(stage.firstChild);
        var rect = stage.getBoundingClientRect();
        var width = Math.max(200, rect.width | 0);
        var height = Math.max(150, rect.height | 0);

        var threeScene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(scene.initialView.fov, width / height, 0.1, 1000);
        camera.position.set(0, 0, 0.01);

        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        if (typeof renderer.setPixelRatio === 'function') {
            var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
            renderer.setPixelRatio(Math.min(dpr, 2));
        }
        renderer.setSize(width, height);
        this.applyColorManagement(renderer);
        stage.appendChild(renderer.domElement);
        this._captureDragEvents(renderer.domElement);

        // Hotspot overlay (placed over the canvas inside the stage).
        var overlay = document.createElement('div');
        overlay.className = 'three-sixty-viewer-overlay three-sixty-viewer-overlay--editor';
        stage.appendChild(overlay);

        // Click on the canvas to place a hotspot when placement-mode is active.
        var self = this;
        renderer.domElement.addEventListener('click', ev => {
            if (!self._placingHotspot) return;
            var pose = self._clickToYawPitch(camera, renderer.domElement, ev.clientX, ev.clientY);
            if (!pose) return;
            self.addHotspot(pose.yaw, pose.pitch);
            self._placingHotspot = false;
            self.refreshPlacementMode();
            self.renderHotspotList();
            // Drop the just-placed hotspot into the overlay immediately so the
            // author can see and drag it before the next render tick.
            self._renderEditorHotspots();
        });

        var geometry = new THREE.SphereGeometry(500, 60, 40);
        if (typeof geometry.scale === 'function') geometry.scale(-1, 1, 1);
        var material = new THREE.MeshBasicMaterial({});
        var mesh = new THREE.Mesh(geometry, material);
        threeScene.add(mesh);

        var texture = null;
        var loader = new THREE.TextureLoader();
        try {
            texture = loader.load(
                scene.src,
                () => {
                    /* loaded */
                },
                undefined,
                () => {
                    /* error */
                },
            );
            if (texture) {
                this.applyTextureColorSpace(texture);
                material.map = texture;
            }
        } catch (_) {
            /* texture failed */
        }

        var controls = null;
        if (THREE.OrbitControls) {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enablePan = false;
            controls.rotateSpeed = -0.25;
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.minDistance = 0.01;
            controls.maxDistance = 0.01;
        }

        var stopped = false;
        function tick() {
            if (stopped) return;
            if (controls && typeof controls.update === 'function') controls.update();
            renderer.render(threeScene, camera);
            self._positionEditorHotspots();
            self._rafId =
                typeof window !== 'undefined' && window.requestAnimationFrame
                    ? window.requestAnimationFrame(tick)
                    : setTimeout(tick, 16);
        }
        tick();

        var preview = {
            mode: 'equirectangular',
            scene: threeScene,
            camera: camera,
            renderer: renderer,
            geometry: geometry,
            material: material,
            texture: texture,
            controls: controls,
            currentSrc: scene.src,
            stage: stage,
            overlay: overlay,
            hotspotButtons: [],
            stop: () => {
                stopped = true;
            },
        };

        if (this.state.behaviour.showNavControls) {
            preview.navControls = this._createNavControls(stage, preview);
        }

        return preview;
    },

    /**
     * Live preview for a flat (non-360) scene: a plain <img> shown undistorted
     * (object-fit: contain) with an overlay of x/y-positioned hotspots. No
     * three.js/WebGL is involved, so this works even when THREE never loads.
     */
    createFlatPreview: function (stage) {
        var scene = this.getActiveScene();
        while (stage.firstChild) stage.removeChild(stage.firstChild);

        var img = document.createElement('img');
        img.className = 'three-sixty-preview-flat';
        img.alt = scene.alt || '';
        img.setAttribute('draggable', 'false');
        img.src = scene.src;
        stage.appendChild(img);

        var overlay = document.createElement('div');
        overlay.className = 'three-sixty-viewer-overlay three-sixty-viewer-overlay--editor';
        stage.appendChild(overlay);

        var self = this;
        // Click on the image to place a hotspot when placement-mode is active.
        var onClick = ev => {
            if (!self._placingHotspot) return;
            var coords = self._clickToXY(self._preview, ev.clientX, ev.clientY);
            if (!coords) return;
            self.addHotspotFlat(coords.x, coords.y);
            self._placingHotspot = false;
            self.refreshPlacementMode();
            self.renderHotspotList();
            self._renderEditorHotspots();
        };
        overlay.addEventListener('click', onClick);
        img.addEventListener('click', onClick);

        var stopped = false;
        function tick() {
            if (stopped) return;
            self._positionEditorHotspots();
            self._rafId =
                typeof window !== 'undefined' && window.requestAnimationFrame
                    ? window.requestAnimationFrame(tick)
                    : setTimeout(tick, 16);
        }
        tick();

        return {
            mode: 'flat',
            img: img,
            stage: stage,
            overlay: overlay,
            currentSrc: scene.src,
            hotspotButtons: [],
            stop: () => {
                stopped = true;
            },
        };
    },

    /**
     * Convert a click on the flat preview into x/y percent (0–100) within the
     * displayed (contain-fitted) image rectangle.
     */
    _clickToXY: function (preview, clientX, clientY) {
        if (!preview || !preview.overlay) return null;
        var rect = preview.overlay.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        var img = preview.img;
        var ir = this.containedImageRect(
            img && img.naturalWidth,
            img && img.naturalHeight,
            rect.width,
            rect.height,
        );
        if (ir.width <= 0 || ir.height <= 0) return null;
        var px = ((clientX - rect.left - ir.left) / ir.width) * 100;
        var py = ((clientY - rect.top - ir.top) / ir.height) * 100;
        return { x: this.clamp(px, 0, 100), y: this.clamp(py, 0, 100) };
    },

    /**
     * Render a draggable handle for each hotspot in the active scene over the
     * editor preview canvas. Recreated whenever the hotspot list changes; the
     * tick loop only updates positions via _positionEditorHotspots().
     */
    _renderEditorHotspots: function () {
        var p = this._preview;
        if (!p || !p.overlay) return;
        var overlay = p.overlay;
        while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
        p.hotspotButtons = [];
        var scene = this.getActiveScene();
        var self = this;
        scene.hotspots.forEach((h, idx) => {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className =
                'three-sixty-viewer-hotspot three-sixty-viewer-hotspot-' + (h.action.type || 'text') +
                ' three-sixty-viewer-hotspot--editor';
            btn.setAttribute('data-hotspot-id', h.id);
            btn.setAttribute('data-hotspot-index', String(idx));
            btn.setAttribute('aria-label', h.label || _('Hotspot') + ' ' + (idx + 1));
            btn.setAttribute('title', _('Drag to move'));
            btn.style.display = 'none';
            var icon = document.createElement('span');
            icon.className = 'three-sixty-viewer-hotspot-icon';
            icon.setAttribute('aria-hidden', 'true');
            btn.appendChild(icon);
            self._wireHotspotDrag(btn, h, idx);
            overlay.appendChild(btn);
            p.hotspotButtons.push({ button: btn, hotspot: h, index: idx });
        });
    },

    _positionEditorHotspots: function () {
        var p = this._preview;
        if (!p || !p.hotspotButtons || !p.hotspotButtons.length) return;
        if (p.mode === 'flat') return this._positionEditorHotspotsFlat(p);
        if (typeof THREE === 'undefined' || !THREE.Vector3) return;
        var camera = p.camera;
        var rect = p.overlay.getBoundingClientRect();
        var w = rect.width;
        var h = rect.height;
        if (w < 1 || h < 1) return;
        for (var i = 0; i < p.hotspotButtons.length; i++) {
            var entry = p.hotspotButtons[i];
            var hs = entry.hotspot;
            var btn = entry.button;
            var yawRad = (hs.yaw * Math.PI) / 180;
            var pitchRad = (hs.pitch * Math.PI) / 180;
            var v = new THREE.Vector3(
                Math.sin(yawRad) * Math.cos(pitchRad),
                Math.sin(pitchRad),
                Math.cos(yawRad) * Math.cos(pitchRad),
            );
            v.multiplyScalar(10);
            try { v.project(camera); } catch (_) { btn.style.display = 'none'; continue; }
            if (v.z >= 1) {
                btn.style.display = 'none';
                continue;
            }
            var x = ((v.x + 1) / 2) * w;
            var y = (1 - (v.y + 1) / 2) * h;
            btn.style.display = '';
            btn.style.left = x + 'px';
            btn.style.top = y + 'px';
        }
    },

    /**
     * Position flat-scene hotspots at their x/y percent within the displayed
     * (contain-fitted) image rectangle.
     */
    _positionEditorHotspotsFlat: function (p) {
        var rect = p.overlay.getBoundingClientRect();
        var boxW = rect.width;
        var boxH = rect.height;
        if (boxW < 1 || boxH < 1) return;
        var img = p.img;
        var ir = this.containedImageRect(img && img.naturalWidth, img && img.naturalHeight, boxW, boxH);
        for (var i = 0; i < p.hotspotButtons.length; i++) {
            var entry = p.hotspotButtons[i];
            var hs = entry.hotspot;
            var btn = entry.button;
            var x = ir.left + (this.clamp(this.toNumber(hs.x, 50), 0, 100) / 100) * ir.width;
            var y = ir.top + (this.clamp(this.toNumber(hs.y, 50), 0, 100) / 100) * ir.height;
            btn.style.display = '';
            btn.style.left = x + 'px';
            btn.style.top = y + 'px';
        }
    },

    /**
     * Pointerdown on a hotspot starts a drag. Move = recompute yaw/pitch from
     * the cursor position; up = finalize, restore OrbitControls, refresh form.
     */
    _wireHotspotDrag: function (btn, hotspot, hotspotIndex) {
        var self = this;
        var dragging = false;
        var pointerId = null;
        var preview = this._preview;
        var isFlat = preview && preview.mode === 'flat';
        var canvas = preview && preview.renderer ? preview.renderer.domElement : null;
        if (!isFlat && !canvas) return;

        function onPointerMove(ev) {
            if (!dragging) return;
            if (isFlat) {
                var coords = self._clickToXY(preview, ev.clientX, ev.clientY);
                if (!coords) return;
                hotspot.x = coords.x;
                hotspot.y = coords.y;
                return;
            }
            var pose = self._clickToYawPitch(preview.camera, canvas, ev.clientX, ev.clientY);
            if (!pose) return;
            hotspot.yaw = pose.yaw;
            hotspot.pitch = pose.pitch;
        }

        function onPointerUp(ev) {
            if (!dragging) return;
            dragging = false;
            try {
                if (pointerId !== null && typeof btn.releasePointerCapture === 'function') {
                    btn.releasePointerCapture(pointerId);
                }
            } catch (_) { /* ignore */ }
            pointerId = null;
            if (preview.controls) preview.controls.enabled = true;
            // Reflect the new yaw/pitch in the form list inputs.
            self.renderHotspotList();
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        }

        btn.addEventListener('pointerdown', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            dragging = true;
            pointerId = ev.pointerId;
            try {
                if (typeof btn.setPointerCapture === 'function') btn.setPointerCapture(pointerId);
            } catch (_) { /* ignore */ }
            if (preview.controls) preview.controls.enabled = false;
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        });

        btn.addEventListener('click', ev => {
            // Don't open the hotspot row in the form; just scroll its row
            // into view to make it findable after dragging.
            ev.preventDefault();
            var row = self.ideviceBody.querySelector(
                '#threeSixtyHotspotList .three-sixty-hotspot-item[data-hotspot-index="' + hotspotIndex + '"]',
            );
            if (row && typeof row.scrollIntoView === 'function') {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('is-highlighted');
                setTimeout(() => row.classList.remove('is-highlighted'), 1200);
            }
        });
    },

    _captureDragEvents: canvas => {
        if (!canvas || !canvas.addEventListener) return;
        try {
            canvas.setAttribute('contenteditable', 'false');
            canvas.setAttribute('draggable', 'false');
        } catch (_) {
            /* ignore */
        }
        var stop = e => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        };
        var stopAndPrevent = e => {
            if (!e) return;
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
        };
        ['mousedown', 'pointerdown', 'touchstart', 'wheel'].forEach(evt => {
            canvas.addEventListener(evt, stop, { passive: false });
        });
        canvas.addEventListener('dragstart', stopAndPrevent, { capture: true });
        canvas.addEventListener('dragstart', stopAndPrevent);
        canvas.addEventListener('selectstart', stopAndPrevent);
    },

    /**
     * Convert a click position on the canvas into yaw/pitch in degrees,
     * by unprojecting the NDC-space click ray to a world direction.
     */
    _clickToYawPitch: function (camera, canvas, clientX, clientY) {
        if (!camera || !canvas || typeof THREE === 'undefined' || !THREE.Vector3) return null;
        var rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        var ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
        var ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
        var v;
        try {
            v = new THREE.Vector3(ndcX, ndcY, 0.5);
            if (typeof v.unproject !== 'function') return null;
            v.unproject(camera);
        } catch (_) {
            return null;
        }
        var dx = v.x - camera.position.x;
        var dy = v.y - camera.position.y;
        var dz = v.z - camera.position.z;
        var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        dx /= len;
        dy /= len;
        dz /= len;
        var yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
        var pitch = (Math.asin(this.clamp(dy, -1, 1)) * 180) / Math.PI;
        return {
            yaw: this.clamp(yaw, -180, 180),
            pitch: this.clamp(pitch, -90, 90),
        };
    },

    refreshPlacementMode: function () {
        var body = this.ideviceBody;
        if (!body) return;
        var btn = body.querySelector('#threeSixtyPlaceHotspot');
        var stage = body.querySelector('#threeSixtyPreview');
        if (this._placingHotspot) {
            if (btn) btn.classList.add('active');
            if (stage) stage.classList.add('three-sixty-preview-stage--placing');
        } else {
            if (btn) btn.classList.remove('active');
            if (stage) stage.classList.remove('three-sixty-preview-stage--placing');
        }
    },

    _createNavControls: function (host, preview) {
        var nav = document.createElement('div');
        nav.className = 'three-sixty-viewer-nav';
        nav.setAttribute('role', 'group');
        nav.setAttribute('aria-label', _('Pan navigation'));
        var YAW_STEP = (15 * Math.PI) / 180;
        var PITCH_STEP = (10 * Math.PI) / 180;
        // Camera lives inside an inverted sphere, so visible "right" = camera
        // azimuth decreases. Match button-arrow direction to the apparent pan.
        var directions = [
            { key: 'left', glyph: '←', label: _('Pan left'), dYaw: YAW_STEP, dPitch: 0 },
            { key: 'up', glyph: '↑', label: _('Pan up'), dYaw: 0, dPitch: -PITCH_STEP },
            { key: 'down', glyph: '↓', label: _('Pan down'), dYaw: 0, dPitch: PITCH_STEP },
            { key: 'right', glyph: '→', label: _('Pan right'), dYaw: -YAW_STEP, dPitch: 0 },
        ];
        var self = this;
        directions.forEach(d => {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'three-sixty-viewer-nav-btn three-sixty-viewer-nav-' + d.key;
            btn.setAttribute('aria-label', d.label);
            btn.setAttribute('title', d.label);
            btn.textContent = d.glyph;
            btn.addEventListener('click', () => {
                self._nudgePreviewCamera(preview, d.dYaw, d.dPitch);
            });
            nav.appendChild(btn);
        });
        host.appendChild(nav);
        return nav;
    },

    _nudgePreviewCamera: function (preview, dYaw, dPitch) {
        if (!preview || !preview.camera) return;
        var camera = preview.camera;
        var controls = preview.controls;
        var pos = camera.position;
        var radius = (typeof pos.length === 'function' ? pos.length() : 0) || 0.01;
        var azimuth =
            controls && typeof controls.getAzimuthalAngle === 'function'
                ? controls.getAzimuthalAngle()
                : Math.atan2(pos.x || 0, pos.z || 0);
        var polar =
            controls && typeof controls.getPolarAngle === 'function'
                ? controls.getPolarAngle()
                : Math.acos(this.clamp((pos.y || 0) / radius, -1, 1));
        azimuth += dYaw;
        polar = this.clamp(polar - dPitch, 0.05, Math.PI - 0.05);
        var sinPolar = Math.sin(polar);
        if (typeof pos.set === 'function') {
            pos.set(
                radius * sinPolar * Math.sin(azimuth),
                radius * Math.cos(polar),
                radius * sinPolar * Math.cos(azimuth),
            );
        }
        if (typeof camera.lookAt === 'function') camera.lookAt(0, 0, 0);
        if (controls && typeof controls.update === 'function') controls.update();
    },

    applyPreviewState: function () {
        var p = this._preview;
        if (!p) return;
        // Keep the overlay in sync with whichever scene is now active.
        if (p.overlay && (!p.hotspotButtons || p.hotspotButtons.length !== this.getActiveScene().hotspots.length)) {
            this._renderEditorHotspots();
        }
        // Flat preview has no camera/controls; the <img> is static.
        if (p.mode === 'flat') return;
        var scene = this.getActiveScene();
        var iv = scene.initialView;
        p.camera.fov = iv.fov;
        if (typeof p.camera.updateProjectionMatrix === 'function') p.camera.updateProjectionMatrix();
        var yawRad = (iv.yaw * Math.PI) / 180;
        var pitchRad = (iv.pitch * Math.PI) / 180;
        var target = {
            x: Math.sin(yawRad) * Math.cos(pitchRad),
            y: Math.sin(pitchRad),
            z: Math.cos(yawRad) * Math.cos(pitchRad),
        };
        if (typeof p.camera.lookAt === 'function') {
            p.camera.lookAt(target.x, target.y, target.z);
        }
        if (p.controls) {
            p.controls.autoRotate = !!this.state.behaviour.autorotate.enabled;
            p.controls.autoRotateSpeed = this.state.behaviour.autorotate.speed;
            p.controls.enableZoom = !!this.state.behaviour.zoomEnabled;
        }
    },

    destroyPreview: function () {
        if (this._rafId) {
            if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(this._rafId);
            } else {
                clearTimeout(this._rafId);
            }
            this._rafId = null;
        }
        var p = this._preview;
        if (!p) return;
        try {
            p.stop && p.stop();
        } catch (_) {
            /* ignore */
        }
        try {
            p.controls && p.controls.dispose && p.controls.dispose();
        } catch (_) {
            /* ignore */
        }
        try {
            p.geometry && p.geometry.dispose && p.geometry.dispose();
        } catch (_) {
            /* ignore */
        }
        try {
            p.material && p.material.dispose && p.material.dispose();
        } catch (_) {
            /* ignore */
        }
        try {
            p.texture && p.texture.dispose && p.texture.dispose();
        } catch (_) {
            /* ignore */
        }
        try {
            p.renderer && p.renderer.dispose && p.renderer.dispose();
        } catch (_) {
            /* ignore */
        }
        if (p.renderer && p.renderer.domElement && p.renderer.domElement.parentNode) {
            p.renderer.domElement.parentNode.removeChild(p.renderer.domElement);
        }
        // Flat preview cleanup: remove the <img> and overlay we appended.
        [p.img, p.overlay].forEach(el => {
            if (el && el.parentNode) {
                try {
                    el.parentNode.removeChild(el);
                } catch (_) {
                    /* ignore */
                }
            }
        });
        this._preview = null;
    },
};
