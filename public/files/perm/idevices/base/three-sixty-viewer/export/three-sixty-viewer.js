/* eslint-disable no-undef */
/**
 * 360° panorama viewer iDevice (export/runtime code).
 * Renders a v2 virtual tour: scenes + hotspots + accessible content modals.
 * v1 single-image data is migrated transparently into a single-scene tour.
 *
 * JSON iDevice API (called by public/app/common/exe_export.js):
 *   renderView(data, accesibility, template)  -> HTML string
 *   renderBehaviour(data, accesibility)       -> attach three.js viewer
 *   init(data, accesibility)                  -> engine hook (no-op here)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $threesixtyviewer = {
    cssClass: 'three-sixty-viewer',
    SCHEMA_VERSION: 2,
    HOTSPOT_ACTION_TYPES: ['goToScene', 'text', 'image', 'video', 'link'],
    RENDER_QUALITY_VALUES: ['low', 'medium', 'high'],
    LABEL_POSITION_VALUES: ['right', 'left', 'top', 'bottom'],
    _instances: [],

    // ─────────────────────────────────────────────────────────────────────
    // JSON iDevice engine API (called by public/app/common/exe_export.js)
    // ─────────────────────────────────────────────────────────────────────

    renderView: function (data, _accesibility, template) {
        var state = this.normalize(data);
        var startScene = this.getStartScene(state);
        var altAttr = this.escapeAttr((startScene && startScene.alt) || '360° panorama');
        var body = '<div class="three-sixty-viewer-wrapper" role="region" aria-label="' + altAttr + '"></div>';
        var tpl = typeof template === 'string' && template ? template : '{content}';
        return tpl.replace('{content}', body);
    },

    renderBehaviour: function (data, _accesibility) {
        var state = this.normalize(data);
        var id = data && data.ideviceId;
        var node = id ? document.getElementById(id) : null;
        if (!node) return;

        this._disposeNode(node);

        var wrapper = node.querySelector('.three-sixty-viewer-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'three-sixty-viewer-wrapper';
            node.appendChild(wrapper);
        }
        while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);

        var startScene = this.getStartScene(state);
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', (startScene && startScene.alt) || '360° panorama');

        if (!startScene || !startScene.src) {
            this.renderFallback(wrapper, state, '(no image)');
            return;
        }
        if (!this.hasWebGL()) {
            this.renderFallback(wrapper, state, (startScene && startScene.alt) || '');
            return;
        }
        if (typeof THREE === 'undefined') {
            this.renderFallback(wrapper, state, (startScene && startScene.alt) || '');
            return;
        }

        this._createViewer(wrapper, state);
    },

    init: (_data, _accesibility) => {
        // no-op (engine contract)
    },

    // ─────────────────────────────────────────────────────────────────────
    // State helpers (mirror edition/three-sixty-viewer.js)
    // ─────────────────────────────────────────────────────────────────────

    normalize: function (data) {
        var raw = data && typeof data === 'object' ? data : {};
        var v2 = this._migrateToV2(raw);
        var scenes =
            Array.isArray(v2.scenes) && v2.scenes.length > 0
                ? v2.scenes.map(this._normalizeScene, this)
                : [this._defaultScene('scene-1')];
        var startSceneId = this._resolveStartSceneId(v2.startSceneId, scenes);
        return {
            version: this.SCHEMA_VERSION,
            ideviceId: typeof raw.ideviceId === 'string' ? raw.ideviceId : '',
            startSceneId: startSceneId,
            scenes: scenes,
            behaviour: this._normalizeBehaviour(v2.behaviour),
        };
    },

    _migrateToV2: function (data) {
        if (data && data.version >= 2 && Array.isArray(data.scenes)) {
            return {
                scenes: data.scenes,
                startSceneId: typeof data.startSceneId === 'string' ? data.startSceneId : '',
                behaviour: data.behaviour && typeof data.behaviour === 'object' ? data.behaviour : {},
            };
        }
        var hasV1Fields =
            data &&
            (typeof data.src === 'string' ||
                typeof data.alt === 'string' ||
                data.initialView ||
                data.autorotate ||
                'zoomEnabled' in data ||
                'fullscreenEnabled' in data);
        if (hasV1Fields) {
            var scene = this._defaultScene('scene-1');
            scene.src = typeof data.src === 'string' ? data.src : '';
            scene.alt = typeof data.alt === 'string' ? data.alt : '';
            scene.initialView = this._normalizeInitialView(data.initialView);
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

    _defaultScene: id => ({
        id: id || 'scene-' + Math.floor(Math.random() * 1e9).toString(36),
        title: '',
        src: '',
        alt: '',
        description: '',
        projection: 'equirectangular',
        initialView: { yaw: 0, pitch: 0, fov: 75 },
        hotspots: [],
    }),

    _normalizeInitialView: function (iv) {
        var s = iv && typeof iv === 'object' ? iv : {};
        return {
            yaw: this.clamp(this.toNumber(s.yaw, 0), -180, 180),
            pitch: this.clamp(this.toNumber(s.pitch, 0), -90, 90),
            fov: this.clamp(this.toNumber(s.fov, 75), 30, 120),
        };
    },

    _normalizeScene: function (s, index) {
        var src = s && typeof s === 'object' ? s : {};
        var fallbackId = 'scene-' + (typeof index === 'number' ? index + 1 : 1);
        var hotspots = Array.isArray(src.hotspots) ? src.hotspots.map(this._normalizeHotspot, this) : [];
        return {
            id: typeof src.id === 'string' && src.id ? src.id : fallbackId,
            title: typeof src.title === 'string' ? src.title : '',
            src: typeof src.src === 'string' ? src.src : '',
            alt: typeof src.alt === 'string' ? src.alt : '',
            description: typeof src.description === 'string' ? src.description : '',
            projection: src.projection === 'flat' ? 'flat' : 'equirectangular',
            initialView: this._normalizeInitialView(src.initialView),
            hotspots: hotspots,
        };
    },

    _normalizeHotspot: function (h) {
        var src = h && typeof h === 'object' ? h : {};
        var actionRaw = src.action && typeof src.action === 'object' ? src.action : {};
        var type = this.HOTSPOT_ACTION_TYPES.indexOf(actionRaw.type) >= 0 ? actionRaw.type : 'text';
        var payload = actionRaw.payload && typeof actionRaw.payload === 'object' ? actionRaw.payload : {};
        return {
            id: typeof src.id === 'string' && src.id ? src.id : 'hs-' + Math.floor(Math.random() * 1e9).toString(36),
            label: typeof src.label === 'string' ? src.label : '',
            icon: typeof src.icon === 'string' ? src.icon : 'circle',
            yaw: this.clamp(this.toNumber(src.yaw, 0), -180, 180),
            pitch: this.clamp(this.toNumber(src.pitch, 0), -90, 90),
            x: this.clamp(this.toNumber(src.x, 50), 0, 100),
            y: this.clamp(this.toNumber(src.y, 50), 0, 100),
            action: { type: type, payload: this._normalizeHotspotPayload(type, payload) },
        };
    },

    _normalizeHotspotPayload: (type, p) => {
        switch (type) {
            case 'goToScene':
                return { sceneId: typeof p.sceneId === 'string' ? p.sceneId : '' };
            case 'text':
                return { html: typeof p.html === 'string' ? p.html : '' };
            case 'image':
                return {
                    src: typeof p.src === 'string' ? p.src : '',
                    alt: typeof p.alt === 'string' ? p.alt : '',
                    caption: typeof p.caption === 'string' ? p.caption : '',
                };
            case 'video':
                return {
                    src: typeof p.src === 'string' ? p.src : '',
                    poster: typeof p.poster === 'string' ? p.poster : '',
                };
            case 'link':
                return {
                    url: typeof p.url === 'string' ? p.url : '',
                    newTab: p.newTab !== false,
                };
            default:
                return {};
        }
    },

    _normalizeBehaviour: function (b) {
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

    _resolveStartSceneId: (requested, scenes) => {
        if (!Array.isArray(scenes) || scenes.length === 0) return '';
        if (typeof requested === 'string' && requested) {
            for (var i = 0; i < scenes.length; i++) {
                if (scenes[i].id === requested) return requested;
            }
        }
        return scenes[0].id;
    },

    getStartScene: state => {
        if (!state || !Array.isArray(state.scenes) || state.scenes.length === 0) return null;
        for (var i = 0; i < state.scenes.length; i++) {
            if (state.scenes[i].id === state.startSceneId) return state.scenes[i];
        }
        return state.scenes[0];
    },

    findSceneById: (state, sceneId) => {
        if (!state || !Array.isArray(state.scenes)) return null;
        for (var i = 0; i < state.scenes.length; i++) {
            if (state.scenes[i].id === sceneId) return state.scenes[i];
        }
        return null;
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
     * Rectangle a `object-fit: contain` image occupies inside a box (letterbox
     * aware). Falls back to the full box when natural dimensions are unknown.
     * Mirrors edition/three-sixty-viewer.js so editor and runtime agree on the
     * flat-image hotspot coordinate basis.
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

    escapeAttr: s =>
        String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;'),

    escapeHtml: s =>
        String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;'),

    /**
     * Make WebGL output match the source panorama's apparent brightness/colour.
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

    /**
     * Legacy / test helper: extract state from a DOM node that carries either
     * a data-idevice-json-data attribute or a nested <script> JSON block.
     */
    extractState: function (node) {
        var raw = null;
        var attr = node.getAttribute && node.getAttribute('data-idevice-json-data');
        if (attr) {
            try {
                raw = JSON.parse(attr);
            } catch (_) {
                raw = null;
            }
        }
        if (!raw) {
            var script = node.querySelector(
                'script.three-sixty-viewer-data[type="application/json"], script[type="application/json"].three-sixty-viewer-data',
            );
            if (script && script.textContent) {
                try {
                    raw = JSON.parse(script.textContent);
                } catch (_) {
                    raw = null;
                }
            }
        }
        return this.normalize(raw || {});
    },

    hasWebGL: () => {
        try {
            var c = document.createElement('canvas');
            var gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
            return !!gl;
        } catch (_) {
            return false;
        }
    },

    resolveSrc: src => {
        if (!src) return '';
        if (src.indexOf('asset://') === 0) {
            var assetManager =
                typeof eXeLearning !== 'undefined' &&
                eXeLearning &&
                eXeLearning.app &&
                eXeLearning.app.project &&
                eXeLearning.app.project._yjsBridge &&
                eXeLearning.app.project._yjsBridge.assetManager;
            if (assetManager && typeof assetManager.resolveAssetURLSync === 'function') {
                var sync = assetManager.resolveAssetURLSync(src);
                if (sync) return sync;
            }
            if (assetManager && typeof assetManager.resolveAssetURL === 'function') {
                var wrapper = { url: src };
                try {
                    var p = assetManager.resolveAssetURL(src);
                    if (p && typeof p.then === 'function') {
                        p.then(resolved => {
                            wrapper.url = resolved || src;
                        });
                    }
                } catch (_) {
                    /* ignore */
                }
                return wrapper.url;
            }
        }
        return src;
    },

    /**
     * Test/utility entry point: render a fully-formed viewer inside a node.
     * Accepts a v2 state object directly.
     */
    renderOne: function (node, state, _idevicePath, _isInExe) {
        while (node.firstChild) node.removeChild(node.firstChild);
        var wrapper = document.createElement('div');
        wrapper.className = 'three-sixty-viewer-wrapper';
        node.appendChild(wrapper);

        var startScene = this.getStartScene(state);
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', (startScene && startScene.alt) || '360° panorama');

        if (!startScene || !startScene.src) {
            this.renderFallback(wrapper, state, '(no image)');
            return;
        }
        if (!this.hasWebGL()) {
            this.renderFallback(wrapper, state, (startScene && startScene.alt) || '');
            return;
        }
        if (typeof THREE === 'undefined') {
            this.renderFallback(wrapper, state, (startScene && startScene.alt) || '');
            return;
        }
        this._createViewer(wrapper, state);
    },

    renderFallback: function (wrapper, state, label) {
        var fb = document.createElement('div');
        fb.className = 'three-sixty-viewer-fallback';
        var fallbackText = label;
        if (!fallbackText) {
            var startScene = this.getStartScene(state);
            // Tolerate both v2 (scenes[]) and flat legacy state.alt
            fallbackText = (startScene && startScene.alt) || (state && state.alt) || '';
        }
        fb.textContent = fallbackText;
        wrapper.appendChild(fb);
    },

    // ─────────────────────────────────────────────────────────────────────
    // three.js viewer lifecycle (multi-scene tour with hotspots)
    // ─────────────────────────────────────────────────────────────────────

    _createViewer: function (wrapper, state) {
        var width = wrapper.clientWidth || 640;
        var height = wrapper.clientHeight || 360;
        if (width < 1) width = 640;
        if (height < 1) height = 360;

        var startScene = this.getStartScene(state);
        var threeScene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(startScene.initialView.fov, width / height, 0.1, 1000);
        camera.position.set(0, 0, 0.01);

        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        if (typeof renderer.setPixelRatio === 'function') {
            var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
            renderer.setPixelRatio(Math.min(dpr, 2));
        }
        renderer.setSize(width, height);
        this.applyColorManagement(renderer);
        var canvas = renderer.domElement;
        canvas.setAttribute('tabindex', '0');
        wrapper.appendChild(canvas);

        var geometry = new THREE.SphereGeometry(500, 60, 40);
        if (typeof geometry.scale === 'function') geometry.scale(-1, 1, 1);
        var material = new THREE.MeshBasicMaterial({});
        var mesh = new THREE.Mesh(geometry, material);
        threeScene.add(mesh);

        // Flat-scene layer: a plain <img> shown undistorted (object-fit: contain)
        // for scenes whose projection is 'flat'. Hidden while a 360° scene is active.
        var flatImg = document.createElement('img');
        flatImg.className = 'three-sixty-viewer-flat-image';
        flatImg.setAttribute('draggable', 'false');
        flatImg.style.display = 'none';
        flatImg.alt = (startScene && startScene.alt) || '';
        wrapper.appendChild(flatImg);

        // Hotspot overlay container, positioned absolutely on top of the canvas.
        var overlay = document.createElement('div');
        overlay.className = 'three-sixty-viewer-overlay';
        wrapper.appendChild(overlay);

        var controls = null;
        if (THREE.OrbitControls) {
            controls = new THREE.OrbitControls(camera, canvas);
            controls.enablePan = false;
            controls.rotateSpeed = -0.25;
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.minDistance = 0.01;
            controls.maxDistance = 0.01;
            controls.enableZoom = !!state.behaviour.zoomEnabled;
            controls.autoRotate = !!state.behaviour.autorotate.enabled;
            controls.autoRotateSpeed = state.behaviour.autorotate.speed;
        }

        var instance = {
            wrapper: wrapper,
            node: wrapper.parentNode || wrapper,
            overlay: overlay,
            flatImg: flatImg,
            currentMode: 'equirectangular',
            scene: threeScene,
            camera: camera,
            renderer: renderer,
            controls: controls,
            geometry: geometry,
            material: material,
            texture: null,
            state: state,
            currentSceneId: '',
            hotspotButtons: [],
            modal: null,
            lastFocusEl: null,
            stopped: false,
            rafId: null,
            handleResize: null,
            resizeObserver: null,
            keyHandler: null,
        };

        instance.dispose = this._buildDisposer(instance);
        instance.goToScene = (self => sceneId => {
            self._goToScene(instance, sceneId);
        })(this);

        // Apply the start scene's mode (flat <img> or 360° sphere), then hotspots.
        this._applySceneMode(instance, startScene);
        this._renderHotspots(instance, startScene);
        instance.currentSceneId = startScene.id;

        // Render loop
        var self = this;
        function tick() {
            if (instance.stopped) return;
            // Flat scenes use a DOM <img>, so the WebGL canvas stays idle.
            if (instance.currentMode !== 'flat') {
                if (controls && typeof controls.update === 'function') controls.update();
                renderer.render(threeScene, camera);
            }
            self._positionHotspots(instance);
            instance.rafId =
                typeof window !== 'undefined' && window.requestAnimationFrame
                    ? window.requestAnimationFrame(tick)
                    : setTimeout(tick, 16);
        }
        tick();

        // Resize wiring
        instance.handleResize = () => {
            var w = wrapper.clientWidth || width;
            var h = wrapper.clientHeight || height;
            if (w < 1 || h < 1) return;
            camera.aspect = w / h;
            if (typeof camera.updateProjectionMatrix === 'function') camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        if (typeof ResizeObserver !== 'undefined') {
            try {
                instance.resizeObserver = new ResizeObserver(instance.handleResize);
                instance.resizeObserver.observe(wrapper);
            } catch (_) {
                /* ignore */
            }
        }
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('resize', instance.handleResize);
        }

        if (state.behaviour.fullscreenEnabled) {
            var fsBtn = document.createElement('button');
            fsBtn.type = 'button';
            fsBtn.className = 'three-sixty-viewer-fullscreen-button';
            fsBtn.setAttribute('aria-label', 'Fullscreen');
            fsBtn.textContent = '⛶';
            var isFullscreen = () =>
                document.fullscreenElement === wrapper ||
                document.webkitFullscreenElement === wrapper;
            fsBtn.addEventListener('click', () => {
                if (isFullscreen()) {
                    if (document.exitFullscreen) document.exitFullscreen();
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                } else {
                    if (wrapper.requestFullscreen) wrapper.requestFullscreen();
                    else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
                }
            });
            var syncFsBtn = () => {
                var fs = isFullscreen();
                fsBtn.setAttribute('aria-label', fs ? 'Exit fullscreen' : 'Fullscreen');
                fsBtn.setAttribute('title', fs ? 'Exit fullscreen' : 'Fullscreen');
            };
            document.addEventListener('fullscreenchange', syncFsBtn);
            document.addEventListener('webkitfullscreenchange', syncFsBtn);
            instance.fullscreenBtn = fsBtn;
            instance.syncFsBtn = syncFsBtn;
            wrapper.appendChild(fsBtn);
        }

        if (state.behaviour.showNavControls) {
            this._createNavControls(instance);
        }

        // Stop drag/touch events on the canvas from being captured by the surrounding
        // workarea editor or contenteditable wrappers, so OrbitControls can rotate.
        this._captureDragEvents(canvas);
        // Belt-and-braces: kill any native HTML5 dragstart originating inside our
        // wrapper at document-capture level — this beats jQuery-delegated handlers
        // that the eXeLearning workarea attaches on iDevice content blocks.
        instance.dragStartBlocker = this._blockNativeDragInside(wrapper);

        this._instances.push(instance);
        return instance;
    },

    _blockNativeDragInside: wrapper => {
        if (typeof document === 'undefined' || !wrapper) return null;
        var handler = e => {
            if (!e || !e.target) return;
            var node = e.target;
            // Walk up to see if the event originated inside the panorama wrapper.
            while (node) {
                if (node === wrapper) {
                    if (typeof e.preventDefault === 'function') e.preventDefault();
                    if (typeof e.stopPropagation === 'function') e.stopPropagation();
                    return;
                }
                node = node.parentNode;
            }
        };
        document.addEventListener('dragstart', handler, true);
        document.addEventListener('selectstart', handler, true);
        return handler;
    },

    _captureDragEvents: canvas => {
        if (!canvas || !canvas.addEventListener) return;
        try {
            canvas.setAttribute('contenteditable', 'false');
            canvas.setAttribute('draggable', 'false');
        } catch (_) {
            /* ignore */
        }
        // Workarea-mode hosts wrap iDevice blocks in draggable=true containers
        // (block reorder) which hijack mousedown→native HTML5 drag. We must
        // cancel dragstart on the canvas to keep OrbitControls in control.
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
        // dragstart MUST be preventDefault'd to abort native HTML5 drag.
        canvas.addEventListener('dragstart', stopAndPrevent, { capture: true });
        canvas.addEventListener('dragstart', stopAndPrevent);
        // selectstart can fire on contenteditable parents and abort our drag.
        canvas.addEventListener('selectstart', stopAndPrevent);
    },

    _createNavControls: function (instance) {
        var nav = document.createElement('div');
        nav.className = 'three-sixty-viewer-nav';
        nav.setAttribute('role', 'group');
        nav.setAttribute('aria-label', 'Pan navigation');
        var YAW_STEP = (15 * Math.PI) / 180;
        var PITCH_STEP = (10 * Math.PI) / 180;
        // Camera lives inside an inverted sphere, so visible "right" = camera
        // azimuth decreases. Match button-arrow direction to the apparent pan.
        var directions = [
            { key: 'left', glyph: '←', label: 'Pan left', dYaw: YAW_STEP, dPitch: 0 },
            { key: 'up', glyph: '↑', label: 'Pan up', dYaw: 0, dPitch: -PITCH_STEP },
            { key: 'down', glyph: '↓', label: 'Pan down', dYaw: 0, dPitch: PITCH_STEP },
            { key: 'right', glyph: '→', label: 'Pan right', dYaw: -YAW_STEP, dPitch: 0 },
        ];
        var self = this;
        directions.forEach((d) => {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'three-sixty-viewer-nav-btn three-sixty-viewer-nav-' + d.key;
            btn.setAttribute('aria-label', d.label);
            btn.setAttribute('title', d.label);
            btn.textContent = d.glyph;
            btn.addEventListener('click', () => {
                self._nudgeCamera(instance, d.dYaw, d.dPitch);
            });
            nav.appendChild(btn);
        });
        instance.wrapper.appendChild(nav);
        instance.navControls = nav;
        return nav;
    },

    /**
     * Rotate the camera by (dYaw, dPitch) radians while keeping it at the centre
     * of the inverted sphere. Clamps polar angle away from the poles to avoid
     * gimbal lock.
     */
    _nudgeCamera: function (instance, dYaw, dPitch) {
        var camera = instance.camera;
        var controls = instance.controls;
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
        // dPitch positive means pan up (smaller polar angle)
        polar = this.clamp(polar - dPitch, 0.05, Math.PI - 0.05);
        var sinPolar = Math.sin(polar);
        if (typeof pos.set === 'function') {
            pos.set(
                radius * sinPolar * Math.sin(azimuth),
                radius * Math.cos(polar),
                radius * sinPolar * Math.cos(azimuth)
            );
        }
        if (typeof camera.lookAt === 'function') camera.lookAt(0, 0, 0);
        if (controls && typeof controls.update === 'function') controls.update();
    },

    _applyInitialView: (instance, scene) => {
        var camera = instance.camera;
        camera.fov = scene.initialView.fov;
        if (typeof camera.updateProjectionMatrix === 'function') camera.updateProjectionMatrix();
        var yawRad = (scene.initialView.yaw * Math.PI) / 180;
        var pitchRad = (scene.initialView.pitch * Math.PI) / 180;
        if (typeof camera.lookAt === 'function') {
            camera.lookAt(
                Math.sin(yawRad) * Math.cos(pitchRad),
                Math.sin(pitchRad),
                Math.cos(yawRad) * Math.cos(pitchRad),
            );
        }
    },

    _loadSceneTexture: function (instance, scene) {
        // Dispose previous scene's texture to free GPU memory
        if (instance.texture && typeof instance.texture.dispose === 'function') {
            try {
                instance.texture.dispose();
            } catch (_) {
                /* ignore */
            }
        }
        instance.texture = null;
        instance.material.map = null;
        try {
            var loader = new THREE.TextureLoader();
            var texture = loader.load(this.resolveSrc(scene.src));
            if (texture) {
                this.applyTextureColorSpace(texture);
                instance.material.map = texture;
                if ('needsUpdate' in instance.material) instance.material.needsUpdate = true;
                instance.texture = texture;
            }
        } catch (_) {
            /* ignore */
        }
    },

    _goToScene: function (instance, sceneId) {
        var scene = this.findSceneById(instance.state, sceneId);
        if (!scene) return;
        if (instance.currentSceneId === sceneId) return;
        instance.currentSceneId = scene.id;
        this._applySceneMode(instance, scene);
        this._renderHotspots(instance, scene);
        // Update wrapper aria-label to reflect the new scene
        instance.wrapper.setAttribute('aria-label', scene.alt || (scene.projection === 'flat' ? 'image' : '360° panorama'));
    },

    /**
     * Switch the viewer between a flat (DOM <img>) and a 360° (WebGL sphere)
     * scene. Tours can mix both, so this runs on the start scene and on every
     * navigation. Sets instance.currentMode to drive render/positioning.
     */
    _applySceneMode: function (instance, scene) {
        var isFlat = scene.projection === 'flat';
        instance.currentMode = isFlat ? 'flat' : 'equirectangular';
        var canvas = instance.renderer && instance.renderer.domElement;
        if (isFlat) {
            if (canvas) canvas.style.display = 'none';
            if (instance.controls) instance.controls.enabled = false;
            if (instance.flatImg) {
                instance.flatImg.src = this.resolveSrc(scene.src);
                instance.flatImg.alt = scene.alt || '';
                instance.flatImg.style.display = '';
            }
        } else {
            if (instance.flatImg) instance.flatImg.style.display = 'none';
            if (canvas) canvas.style.display = '';
            if (instance.controls) instance.controls.enabled = true;
            this._applyInitialView(instance, scene);
            this._loadSceneTexture(instance, scene);
        }
    },

    _renderHotspots: function (instance, scene) {
        var overlay = instance.overlay;
        while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
        instance.hotspotButtons = [];
        if (!scene.hotspots || !scene.hotspots.length) return;

        scene.hotspots.forEach(h => {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'three-sixty-viewer-hotspot three-sixty-viewer-hotspot-' + (h.action.type || 'text');
            btn.setAttribute('data-hotspot-id', h.id);
            btn.setAttribute('aria-label', h.label || this._defaultHotspotLabel(h.action.type));
            btn.setAttribute('title', h.label || this._defaultHotspotLabel(h.action.type));
            btn.setAttribute('tabindex', '0');
            // Hidden by default until projected on first frame
            btn.style.display = 'none';

            var icon = document.createElement('span');
            icon.className = 'three-sixty-viewer-hotspot-icon';
            icon.setAttribute('aria-hidden', 'true');
            btn.appendChild(icon);

            if (h.label && instance.state.behaviour.showLabels) {
                var label = document.createElement('span');
                label.className =
                    'three-sixty-viewer-hotspot-label three-sixty-viewer-hotspot-label-' +
                    instance.state.behaviour.labelPosition;
                label.textContent = h.label;
                btn.appendChild(label);
            }

            btn.addEventListener('click', ev => {
                ev.preventDefault();
                this._activateHotspot(instance, h, btn);
            });
            btn.addEventListener('keydown', ev => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    this._activateHotspot(instance, h, btn);
                }
            });

            overlay.appendChild(btn);
            instance.hotspotButtons.push({ button: btn, hotspot: h });
        });
    },

    _defaultHotspotLabel: type => {
        switch (type) {
            case 'goToScene':
                return 'Go to scene';
            case 'image':
                return 'View image';
            case 'video':
                return 'Watch video';
            case 'link':
                return 'Open link';
            case 'text':
            default:
                return 'View information';
        }
    },

    /**
     * Project each hotspot's 3D direction into 2D screen coordinates.
     * Hotspots behind the camera (NDC z > 1) are hidden.
     */
    _positionHotspots: function (instance) {
        if (!instance.hotspotButtons.length) return;
        if (instance.currentMode === 'flat') return this._positionHotspotsFlat(instance);
        var camera = instance.camera;
        var rect = instance.wrapper.getBoundingClientRect();
        var w = rect.width;
        var h = rect.height;
        if (w < 1 || h < 1) return;
        for (var i = 0; i < instance.hotspotButtons.length; i++) {
            var entry = instance.hotspotButtons[i];
            var hs = entry.hotspot;
            var btn = entry.button;
            var yawRad = (hs.yaw * Math.PI) / 180;
            var pitchRad = (hs.pitch * Math.PI) / 180;
            // Place hotspot at radius slightly inside the sphere shell so projection works.
            var v = new THREE.Vector3(
                Math.sin(yawRad) * Math.cos(pitchRad),
                Math.sin(pitchRad),
                Math.cos(yawRad) * Math.cos(pitchRad),
            );
            v.multiplyScalar(10);
            try {
                v.project(camera);
            } catch (_) {
                btn.style.display = 'none';
                continue;
            }
            var behind = v.z >= 1;
            if (behind) {
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
     * Position hotspots on a flat scene at their x/y percent within the displayed
     * (contain-fitted) image rectangle.
     */
    _positionHotspotsFlat: function (instance) {
        var rect = instance.wrapper.getBoundingClientRect();
        var boxW = rect.width;
        var boxH = rect.height;
        if (boxW < 1 || boxH < 1) return;
        var img = instance.flatImg;
        var ir = this.containedImageRect(img && img.naturalWidth, img && img.naturalHeight, boxW, boxH);
        for (var i = 0; i < instance.hotspotButtons.length; i++) {
            var entry = instance.hotspotButtons[i];
            var hs = entry.hotspot;
            var btn = entry.button;
            var x = ir.left + (this.clamp(this.toNumber(hs.x, 50), 0, 100) / 100) * ir.width;
            var y = ir.top + (this.clamp(this.toNumber(hs.y, 50), 0, 100) / 100) * ir.height;
            btn.style.display = '';
            btn.style.left = x + 'px';
            btn.style.top = y + 'px';
        }
    },

    _activateHotspot: function (instance, hotspot, triggerButton) {
        instance.lastFocusEl = triggerButton;
        if (!hotspot.action) return;
        if (hotspot.action.type === 'goToScene') {
            var targetId = hotspot.action.payload && hotspot.action.payload.sceneId;
            if (targetId) instance.goToScene(targetId);
            return;
        }
        if (hotspot.action.type === 'link') {
            this._openLink(hotspot.action.payload);
            return;
        }
        this._openContentModal(instance, hotspot);
    },

    /**
     * Open an external link from a hotspot. Defaults to a new tab and uses
     * noopener/noreferrer so the target page cannot reach back into the viewer.
     */
    _openLink: payload => {
        if (!payload || typeof payload.url !== 'string' || !payload.url) return;
        var url = payload.url;
        var newTab = payload.newTab !== false;
        if (typeof window === 'undefined') return;
        if (newTab && typeof window.open === 'function') {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            try {
                window.location.href = url;
            } catch (_) {
                /* ignore */
            }
        }
    },

    _openContentModal: function (instance, hotspot) {
        // Close any existing modal first
        this._closeContentModal(instance);
        var dialog = document.createElement('div');
        dialog.className = 'three-sixty-viewer-modal';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', hotspot.label || this._defaultHotspotLabel(hotspot.action.type));

        var inner = document.createElement('div');
        inner.className = 'three-sixty-viewer-modal-inner';

        var header = document.createElement('div');
        header.className = 'three-sixty-viewer-modal-header';
        var title = document.createElement('h3');
        title.className = 'three-sixty-viewer-modal-title';
        title.textContent = hotspot.label || this._defaultHotspotLabel(hotspot.action.type);
        header.appendChild(title);
        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'three-sixty-viewer-modal-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '✕';
        header.appendChild(closeBtn);
        inner.appendChild(header);

        var body = document.createElement('div');
        body.className = 'three-sixty-viewer-modal-body';
        this._populateModalBody(body, hotspot);
        inner.appendChild(body);

        dialog.appendChild(inner);
        instance.wrapper.appendChild(dialog);
        instance.modal = dialog;

        closeBtn.addEventListener('click', () => {
            this._closeContentModal(instance);
        });
        instance.keyHandler = ev => {
            if (ev.key === 'Escape') {
                ev.stopPropagation();
                this._closeContentModal(instance);
            } else if (ev.key === 'Tab') {
                this._trapFocus(dialog, ev);
            }
        };
        dialog.addEventListener('keydown', instance.keyHandler);

        // Focus the close button to start
        try {
            closeBtn.focus();
        } catch (_) {
            /* ignore */
        }
    },

    /**
     * Map a pasted video page URL to an embeddable iframe src for a known
     * provider, or return null for anything else (direct media files). The
     * embed URL is rebuilt from the captured id rather than echoing the raw
     * input, which is also safer than dropping an arbitrary URL into an iframe.
     */
    _videoEmbedUrl: url => {
        if (!url || typeof url !== 'string') return null;
        var yt = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/.exec(url);
        if (yt) return 'https://www.youtube.com/embed/' + yt[1];
        var vimeo = /vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/.exec(url);
        if (vimeo) return 'https://player.vimeo.com/video/' + vimeo[1] + (vimeo[2] ? '?h=' + vimeo[2] : '');
        var em = /mediateca\.educa\.madrid\.org\/(?:video|media)\/([\w-]+)/.exec(url);
        if (em) return 'https://mediateca.educa.madrid.org/video/' + em[1] + '/fs';
        return null;
    },

    _populateModalBody: function (body, hotspot) {
        var p = hotspot.action.payload || {};
        switch (hotspot.action.type) {
            case 'text':
                body.innerHTML = p.html || '';
                break;
            case 'image':
                if (p.src) {
                    var img = document.createElement('img');
                    img.src = this.resolveSrc(p.src);
                    img.alt = p.alt || hotspot.label || '';
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    body.appendChild(img);
                    if (p.caption) {
                        var cap = document.createElement('p');
                        cap.className = 'three-sixty-viewer-modal-caption';
                        cap.textContent = p.caption;
                        body.appendChild(cap);
                    }
                }
                break;
            case 'video':
                if (p.src) {
                    var resolved = this.resolveSrc(p.src);
                    var embedUrl = this._videoEmbedUrl(resolved);
                    if (embedUrl) {
                        var iframe = document.createElement('iframe');
                        iframe.src = embedUrl;
                        iframe.setAttribute('allowfullscreen', '');
                        iframe.setAttribute('frameborder', '0');
                        iframe.setAttribute('title', hotspot.label || 'video');
                        iframe.style.width = '100%';
                        iframe.style.aspectRatio = '16/9';
                        body.appendChild(iframe);
                    } else {
                        var video = document.createElement('video');
                        video.src = resolved;
                        video.controls = true;
                        video.style.maxWidth = '100%';
                        if (p.poster) video.poster = this.resolveSrc(p.poster);
                        body.appendChild(video);
                    }
                }
                break;
            default:
                break;
        }
    },

    _trapFocus: (dialog, ev) => {
        var focusable = dialog.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
            ev.preventDefault();
            try {
                last.focus();
            } catch (_) {
                /* ignore */
            }
        } else if (!ev.shiftKey && document.activeElement === last) {
            ev.preventDefault();
            try {
                first.focus();
            } catch (_) {
                /* ignore */
            }
        }
    },

    _closeContentModal: instance => {
        if (!instance.modal) return;
        try {
            instance.modal.parentNode && instance.modal.parentNode.removeChild(instance.modal);
        } catch (_) {
            /* ignore */
        }
        instance.modal = null;
        if (instance.lastFocusEl) {
            try {
                instance.lastFocusEl.focus();
            } catch (_) {
                /* ignore */
            }
        }
    },

    _buildDisposer: function (instance) {
        return () => {
            instance.stopped = true;
            if (instance.rafId) {
                if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
                    window.cancelAnimationFrame(instance.rafId);
                } else {
                    clearTimeout(instance.rafId);
                }
                instance.rafId = null;
            }
            try {
                instance.resizeObserver && instance.resizeObserver.disconnect && instance.resizeObserver.disconnect();
            } catch (_) {
                /* ignore */
            }
            if (typeof window !== 'undefined' && window.removeEventListener && instance.handleResize) {
                window.removeEventListener('resize', instance.handleResize);
            }
            if (instance.dragStartBlocker && typeof document !== 'undefined') {
                try {
                    document.removeEventListener('dragstart', instance.dragStartBlocker, true);
                    document.removeEventListener('selectstart', instance.dragStartBlocker, true);
                } catch (_) {
                    /* ignore */
                }
                instance.dragStartBlocker = null;
            }
            if (instance.syncFsBtn && typeof document !== 'undefined') {
                try {
                    document.removeEventListener('fullscreenchange', instance.syncFsBtn);
                    document.removeEventListener('webkitfullscreenchange', instance.syncFsBtn);
                } catch (_) {
                    /* ignore */
                }
            }
            this._closeContentModal(instance);
            try {
                instance.controls && instance.controls.dispose && instance.controls.dispose();
            } catch (_) {
                /* ignore */
            }
            try {
                instance.geometry && instance.geometry.dispose && instance.geometry.dispose();
            } catch (_) {
                /* ignore */
            }
            try {
                instance.material && instance.material.dispose && instance.material.dispose();
            } catch (_) {
                /* ignore */
            }
            try {
                instance.texture && instance.texture.dispose && instance.texture.dispose();
            } catch (_) {
                /* ignore */
            }
            try {
                instance.renderer && instance.renderer.dispose && instance.renderer.dispose();
            } catch (_) {
                /* ignore */
            }
        };
    },

    _disposeNode: function (node) {
        for (var i = this._instances.length - 1; i >= 0; i--) {
            var inst = this._instances[i];
            if (inst.node === node || (node && node.contains(inst.wrapper))) {
                try {
                    inst.dispose();
                } catch (_) {
                    /* ignore */
                }
                this._instances.splice(i, 1);
            }
        }
    },

    destroyAll: function () {
        var list = this._instances.slice();
        this._instances = [];
        for (var i = 0; i < list.length; i++) {
            try {
                list[i].dispose();
            } catch (_) {
                /* ignore */
            }
        }
    },
};

// `pagehide` replaces the former `beforeunload` binding: an unload-family
// listener makes the page ineligible for the back/forward cache, and this
// runtime ships inside SCORM packages whose SCORM runtime relies on bfcache
// staying available. `event.persisted === true` means the page is being frozen
// and may be restored intact, so its WebGL contexts must survive.
if (typeof window !== 'undefined' && !window.__threesixtyCleanupBound) {
    window.__threesixtyCleanupBound = true;
    window.addEventListener('pagehide', function (event) {
        if (event && event.persisted) {
            return;
        }
        $threesixtyviewer.destroyAll();
    });
}
