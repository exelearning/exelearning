/* global THREE */

/**
 * Three D Viewer iDevice — shared runtime
 *
 * Shared between edition (workarea preview) and export (HTML5/SCORM/EPUB).
 * Owns:
 *   - Three.js scene/camera/renderer setup for STL files
 *   - <model-viewer> attribute application for GLB/GLTF
 *   - Asset source resolution (asset:// → blob via AssetManager, or
 *     content/resources/... for offline export)
 *   - Per-wrapper instance registry with cleanup on beforeunload
 *   - Pure helpers: detectModelType, normalizeColor, normalizeModelSource,
 *     configureRendererColorManagement, disposeObject3D, disposeMaterial
 *
 * The runtime publishes a single global `window.eXe3DViewer` so both
 * edition/three-d-viewer.js and export/three-d-viewer.js can call it
 * without bundling. It is loaded via <script> injection (see
 * ensureRuntimeLoaded() in those files) from the same export/ directory
 * that ships Three.js, STLLoader, OrbitControls and model-viewer — that
 * way the runtime is part of every static export package automatically.
 */

(function () {
    const globalScope = typeof window !== 'undefined' ? window : globalThis;

    if (globalScope.eXe3DViewer) {
        // Idempotent: already loaded by another iDevice on the same page.
        return;
    }

    const DEFAULT_MODEL_COLOR = '#888888';
    const DEFAULT_BACKGROUND = '#f5f5f5';

    const REGISTRY = new Map();

    // ------------------------------------------------------------------
    // Pure helpers
    // ------------------------------------------------------------------

    /**
     * Detect the model type from a path or asset:// URL by file extension.
     * Tolerates query strings, hash fragments, mixed case, and trailing
     * whitespace.
     *
     * @param {string} src
     * @returns {'stl'|'glb'|'gltf'|'obj'|'fbx'|'unknown'}
     */
    function detectModelType(src) {
        if (typeof src !== 'string') return 'unknown';
        let clean = src.trim();
        if (!clean) return 'unknown';
        // Strip query and hash before extension lookup.
        const qIdx = clean.indexOf('?');
        if (qIdx !== -1) clean = clean.substring(0, qIdx);
        const hIdx = clean.indexOf('#');
        if (hIdx !== -1) clean = clean.substring(0, hIdx);
        const dotIdx = clean.lastIndexOf('.');
        if (dotIdx === -1) return 'unknown';
        const ext = clean.substring(dotIdx + 1).toLowerCase();
        if (ext === 'stl') return 'stl';
        if (ext === 'glb') return 'glb';
        if (ext === 'gltf') return 'gltf';
        if (ext === 'obj') return 'obj';
        if (ext === 'fbx') return 'fbx';
        return 'unknown';
    }

    /**
     * Validate and coerce a CSS color string to lowercase #rrggbb. Accepts
     * #RGB and #RRGGBB; everything else falls back.
     *
     * @param {string} value
     * @param {string} [fallback='#888888']
     * @returns {string}
     */
    function normalizeColor(value, fallback) {
        const safeFallback = typeof fallback === 'string' ? fallback : DEFAULT_MODEL_COLOR;
        if (typeof value !== 'string') return safeFallback;
        const v = value.trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(v)) return v;
        if (/^#[0-9a-f]{3}$/.test(v)) {
            return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
        }
        return safeFallback;
    }

    /**
     * Normalize an inbound model source for persistence/runtime use.
     *
     * Rules:
     *   - Pass `asset://...` through unchanged (canonical form).
     *   - Pass http(s):// and relative paths through unchanged.
     *   - Strip `blob:` and `data:` (those are ephemeral runtime URLs that
     *     must never be persisted).
     *   - Empty / non-string → ''.
     *
     * @param {string} src
     * @returns {string}
     */
    function normalizeModelSource(src) {
        if (typeof src !== 'string') return '';
        const clean = src.trim();
        if (!clean) return '';
        if (clean.startsWith('blob:') || clean.startsWith('data:')) return '';
        return clean;
    }

    /**
     * Enable sRGB output + linear color management on a Three.js renderer.
     * Compatible across Three.js r150+ (`outputColorSpace`) and earlier
     * (`outputEncoding`). No-op when Three.js is not available.
     *
     * @param {object} renderer - THREE.WebGLRenderer instance
     */
    function configureRendererColorManagement(renderer) {
        if (typeof globalScope.THREE === 'undefined' || !renderer) return;
        const T = globalScope.THREE;
        if (T.ColorManagement && 'enabled' in T.ColorManagement) {
            T.ColorManagement.enabled = true;
        }
        if ('outputColorSpace' in renderer && typeof T.SRGBColorSpace !== 'undefined') {
            renderer.outputColorSpace = T.SRGBColorSpace;
        } else if ('outputEncoding' in renderer && typeof T.sRGBEncoding !== 'undefined') {
            renderer.outputEncoding = T.sRGBEncoding;
        }
        if ('toneMapping' in renderer && typeof T.NoToneMapping !== 'undefined') {
            renderer.toneMapping = T.NoToneMapping;
        }
    }

    /**
     * Dispose every texture-shaped field on a material, then dispose the
     * material itself. Tolerates arrays of materials.
     *
     * @param {object|object[]|null} material
     */
    function disposeMaterial(material) {
        if (!material) return;
        const list = Array.isArray(material) ? material : [material];
        list.forEach((mat) => {
            if (!mat) return;
            Object.keys(mat).forEach((key) => {
                const v = mat[key];
                if (v && typeof v === 'object' && v.isTexture && typeof v.dispose === 'function') {
                    v.dispose();
                }
            });
            if (typeof mat.dispose === 'function') mat.dispose();
        });
    }

    /**
     * Traverse an Object3D subtree and dispose each node's geometry and
     * material.
     *
     * @param {object} object - THREE.Object3D
     */
    function disposeObject3D(object) {
        if (!object || typeof object.traverse !== 'function') return;
        object.traverse((node) => {
            if (node && node.geometry && typeof node.geometry.dispose === 'function') {
                node.geometry.dispose();
            }
            if (node && node.material) {
                disposeMaterial(node.material);
            }
        });
    }

    // ------------------------------------------------------------------
    // AssetManager / URL resolution
    // ------------------------------------------------------------------

    /**
     * Locate the live AssetManager. Returns null in offline export
     * contexts where the workarea isn't loaded.
     *
     * @returns {object|null}
     */
    function getAssetManager() {
        let am = globalScope.eXeLearning?.app?.project?.assetManager
              || globalScope.eXeLearning?.app?.project?._yjsBridge?.assetManager;
        if (am) return am;
        try {
            am = globalScope.parent?.eXeLearning?.app?.project?.assetManager
              || globalScope.parent?.eXeLearning?.app?.project?._yjsBridge?.assetManager;
        } catch (_) {
            // Cross-origin parent — true export context.
        }
        return am || null;
    }

    /**
     * Resolve a model source to a URL the browser can fetch.
     *
     * - `asset://uuid.ext` + AssetManager available → blob URL via
     *   AssetManager (preview/editor context).
     * - `asset://uuid.ext` + no AssetManager → empty string (caller falls
     *   back to the wrapper's already-rewritten data-model-src path, which
     *   the export pipeline has rewritten to `content/resources/...`).
     * - http(s):// / blob: / relative → returned unchanged.
     * - Empty / invalid → ''.
     *
     * @param {string} src
     * @param {object} [ctx]
     * @param {object} [ctx.assetManager] - injected AssetManager (tests)
     * @returns {Promise<string>}
     */
    async function resolveModelSource(src, ctx) {
        if (typeof src !== 'string' || !src) return '';
        const trimmed = src.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('asset://')) {
            const am = ctx?.assetManager || getAssetManager();
            if (!am) return '';
            try {
                if (typeof am.resolveAssetURLSync === 'function') {
                    const sync = am.resolveAssetURLSync(trimmed);
                    if (sync) return sync;
                }
                if (typeof am.resolveAssetURL === 'function') {
                    const blob = await am.resolveAssetURL(trimmed);
                    if (blob) return blob;
                }
            } catch (_) {
                return '';
            }
            return '';
        }
        return trimmed;
    }

    // ------------------------------------------------------------------
    // Instance lifecycle (registry)
    // ------------------------------------------------------------------

    /**
     * Build an empty instance shell. The boot path (init) populates the
     * Three.js / model-viewer references.
     *
     * @param {HTMLElement} wrapper
     * @param {object} options
     * @returns {object}
     */
    function buildInstanceShell(wrapper, options) {
        return {
            wrapper,
            options,
            type: options.type || detectModelType(options.src || ''),
            modelViewer: null,
            canvas: null,
            scene: null,
            camera: null,
            renderer: null,
            controls: null,
            mesh: null,
            geometry: null,
            material: null,
            textures: [],
            rafId: null,
            stopped: false,
            eventListeners: [],
            objectURLs: [],
            // Per-frame callbacks invoked inside animate() before render.
            // The interaction layer registers marker reprojection here so it
            // stays synced during rotation / auto-rotate without a second
            // RAF loop. Cleared on destroy.
            onFrame: [],
            // The attached interaction layer controller (markers / questions /
            // guided navigation), or null. Torn down in destroy().
            interaction: null,
        };
    }

    /**
     * Register an event listener so it gets cleaned up on destroy.
     *
     * @param {object} instance
     * @param {EventTarget} target
     * @param {string} type
     * @param {Function} handler
     * @param {boolean|object} [opts]
     */
    function track(instance, target, type, handler, opts) {
        target.addEventListener(type, handler, opts);
        instance.eventListeners.push({ target, type, handler, opts });
    }

    /**
     * Tear down an instance: cancel RAF, remove listeners, dispose all
     * GPU resources, revoke any object URLs we created, drop from the
     * registry.
     *
     * @param {HTMLElement} wrapper
     */
    function destroy(wrapper) {
        const inst = REGISTRY.get(wrapper);
        if (!inst) return;
        inst.stopped = true;
        // Tear down the interaction layer first: removes marker overlays,
        // dialog, listeners and per-frame callbacks before the scene goes.
        if (inst.interaction && typeof inst.interaction.destroy === 'function') {
            try { inst.interaction.destroy(); } catch (_) { /* noop */ }
            inst.interaction = null;
        }
        if (inst.onFrame) inst.onFrame.length = 0;
        if (inst.rafId != null) {
            const cancel = globalScope.cancelAnimationFrame || clearTimeout;
            cancel(inst.rafId);
            inst.rafId = null;
        }
        inst.eventListeners.forEach(({ target, type, handler, opts }) => {
            try { target.removeEventListener(type, handler, opts); } catch (_) { /* noop */ }
        });
        inst.eventListeners.length = 0;
        if (inst.scene) {
            try { disposeObject3D(inst.scene); } catch (_) { /* noop */ }
        }
        try { disposeMaterial(inst.material); } catch (_) { /* noop */ }
        try { inst.geometry?.dispose?.(); } catch (_) { /* noop */ }
        try { inst.controls?.dispose?.(); } catch (_) { /* noop */ }
        try { inst.renderer?.dispose?.(); } catch (_) { /* noop */ }
        inst.objectURLs.forEach((u) => {
            try { URL.revokeObjectURL(u); } catch (_) { /* noop */ }
        });
        inst.objectURLs.length = 0;
        REGISTRY.delete(wrapper);
    }

    /**
     * Tear down every instance. Called on `beforeunload`.
     */
    function destroyAll() {
        // Iterate a snapshot in reverse-insertion order; destroy() mutates
        // the registry.
        const wrappers = [...REGISTRY.keys()].reverse();
        wrappers.forEach((w) => destroy(w));
    }

    function bindBeforeUnloadOnce() {
        if (globalScope.__threedViewerCleanupBound) return;
        globalScope.__threedViewerCleanupBound = true;
        if (typeof globalScope.addEventListener === 'function') {
            globalScope.addEventListener('beforeunload', destroyAll);
        }
    }

    // ------------------------------------------------------------------
    // Boot
    // ------------------------------------------------------------------

    /**
     * Read the boot config from a wrapper's flat data-* attributes.
     *
     * @param {HTMLElement} wrapper
     * @returns {object}
     */
    function readWrapperConfig(wrapper) {
        const ds = wrapper.dataset || {};
        const showNav = ds.showNavControls === 'true';
        const src = normalizeModelSource(ds.modelSrc || '');
        return {
            src,
            type: ds.modelType || detectModelType(src),
            modelColor: normalizeColor(ds.modelColor, DEFAULT_MODEL_COLOR),
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
            alt: ds.alt || '',
        };
    }

    /**
     * Boot a wrapper. Idempotent on the same wrapper.
     *
     * Synchronous registration: the instance is in the registry before
     * any async boot work starts, so `destroy(wrapper)` always finds it.
     * The actual scene boot is dispatched by type and may run async
     * (fetch + parse for STL); failures are logged, not thrown, so
     * callers can fire-and-forget.
     *
     * The caller is responsible for ensuring `window.THREE` (with
     * `STLLoader` and `OrbitControls` attached) is loaded *before*
     * calling init for an STL wrapper. Both edition and export already
     * do this via their `ensureThreeJSLoaded()` helpers.
     *
     * @param {HTMLElement} wrapper
     * @param {object} [options]
     * @returns {object} instance
     */
    function init(wrapper, options) {
        if (!wrapper) return null;
        if (REGISTRY.has(wrapper)) return REGISTRY.get(wrapper);
        const cfg = options || readWrapperConfig(wrapper);
        const instance = buildInstanceShell(wrapper, cfg);
        REGISTRY.set(wrapper, instance);
        bindBeforeUnloadOnce();
        if (instance.type === 'stl' && instance.options.src) {
            bootSTL(instance).catch((err) => {
                if (typeof console !== 'undefined' && console.error) {
                    console.error('[3D Viewer] STL boot failed:', err);
                }
            });
        }
        return instance;
    }

    /**
     * Boot the STL Three.js scene for an instance. Idempotent; bails
     * early if the instance was destroyed mid-boot or if THREE/STLLoader
     * is not available (test environments).
     *
     * @param {object} instance
     * @returns {Promise<void>}
     */
    async function bootSTL(instance) {
        const T = globalScope.THREE;
        if (!T || !T.STLLoader) return;
        if (instance.stopped) return;

        const opts = instance.options;
        const wrapper = instance.wrapper;

        // Resolve the model URL. asset:// → blob via AssetManager;
        // anything else passes through.
        const stlUrl = await resolveModelSource(opts.src);
        if (instance.stopped) return;
        if (!stlUrl) return;

        // Create / reuse canvas
        let canvas = wrapper.querySelector('canvas.three-js-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'three-js-canvas';
            canvas.style.cssText = 'width: 100%; height: 100%; display: block;';
            wrapper.appendChild(canvas);
        }
        instance.canvas = canvas;

        // Hide any sibling <model-viewer> — it would still try to claim
        // layout and may attempt to fetch the STL URL otherwise.
        const mv = wrapper.querySelector('model-viewer');
        if (mv) {
            mv.style.display = 'none';
            instance.modelViewer = mv;
        }

        const width = wrapper.clientWidth || 400;
        const height = wrapper.clientHeight || 300;

        const scene = new T.Scene();
        scene.background = new T.Color(opts.backgroundColor || DEFAULT_BACKGROUND);

        const camera = new T.PerspectiveCamera(45, width / height, 0.1, 1000);

        const renderer = new T.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(width, height);
        if (typeof renderer.setPixelRatio === 'function') {
            const dpr = (globalScope.devicePixelRatio || 1);
            renderer.setPixelRatio(Math.min(dpr, 2));
        }
        configureRendererColorManagement(renderer);

        instance.scene = scene;
        instance.camera = camera;
        instance.renderer = renderer;

        const ambient = new T.AmbientLight(0xffffff, 0.6);
        scene.add(ambient);
        const dir1 = new T.DirectionalLight(0xffffff, 0.8);
        dir1.position.set(1, 1, 1);
        scene.add(dir1);
        const dir2 = new T.DirectionalLight(0xffffff, 0.4);
        dir2.position.set(-1, -1, -1);
        scene.add(dir2);

        try {
            const response = await fetch(stlUrl);
            if (instance.stopped) return;
            const arrayBuffer = await response.arrayBuffer();
            if (instance.stopped) return;
            const loader = new T.STLLoader();
            const geometry = loader.parse(arrayBuffer);

            geometry.computeBoundingBox();
            geometry.center();
            const bbox = geometry.boundingBox;
            const size = new T.Vector3();
            bbox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const scale = 2 / maxDim;
            geometry.scale(scale, scale, scale);
            if (!geometry.hasAttribute('normal')) {
                geometry.computeVertexNormals();
            }

            const colorHex = normalizeColor(opts.modelColor, DEFAULT_MODEL_COLOR);
            // Pure diffuse (metalness=0). With any metallic component +
            // no environment map the material reflects an empty scene
            // ≈ black, which silently swallows the user's chosen color
            // — the cube ended up gray-looking even for bright hex
            // values like #3325f4. Spec from the refactor brief:
            // metalness=0.0, roughness=0.55.
            const material = new T.MeshStandardMaterial({
                color: new T.Color(colorHex),
                metalness: 0.0,
                roughness: 0.55,
            });

            const mesh = new T.Mesh(geometry, material);
            scene.add(mesh);

            camera.position.set(3, 3, 3);
            camera.lookAt(0, 0, 0);

            let controls = null;
            if (opts.cameraControls && T.OrbitControls) {
                controls = new T.OrbitControls(camera, canvas);
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;
            }

            instance.mesh = mesh;
            instance.geometry = geometry;
            instance.material = material;
            instance.controls = controls;

            const autoRotate = !!opts.autoRotate;
            const rotPerSec = (opts.autoRotateSpeed || 30) * Math.PI / 180;
            const animate = () => {
                if (instance.stopped) return;
                if (autoRotate && instance.mesh) {
                    // Frame-rate-independent step: 60fps assumption is fine
                    // for this iDevice; the underlying RAF clamps it.
                    instance.mesh.rotation.y += rotPerSec / 60;
                }
                if (instance.controls) instance.controls.update();
                // Interaction marker reprojection and any other per-frame
                // work run here, before the render, guarded like the rest.
                if (instance.onFrame && instance.onFrame.length) {
                    for (let i = 0; i < instance.onFrame.length; i++) {
                        try { instance.onFrame[i](); } catch (_) { /* noop */ }
                    }
                }
                instance.renderer.render(instance.scene, instance.camera);
                const raf = globalScope.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
                instance.rafId = raf(animate);
            };
            animate();

            // Hide the wrapper's empty-state badge, if any.
            const empty = wrapper.querySelector('[data-empty], [data-empty-state]');
            if (empty) empty.style.display = 'none';
        } catch (err) {
            if (typeof console !== 'undefined' && console.error) {
                console.error('[3D Viewer] Failed to render STL:', err);
            }
        }
    }

    // ------------------------------------------------------------------
    // Interaction layer (markers / guided navigation / questions)
    //
    // A single renderer-agnostic controller drives both render paths through
    // a thin adapter (model-viewer native hotspots vs. STL DOM overlay). It
    // is shared by the editor preview and the exported page — see
    // doc/architecture/adr/ADR-0001.
    // ------------------------------------------------------------------

    /** HTML-escape a string for safe text/attribute interpolation. */
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /**
     * Allow only safe URL schemes for links/media. Rejects javascript:, and
     * unknown schemes; permits http(s), mailto, tel, asset://, relative and
     * fragment URLs.
     */
    function safeUrl(url) {
        const s = typeof url === 'string' ? url.trim() : '';
        if (!s) return '';
        if (/^\s*javascript:/i.test(s)) return '';
        if (/^(https?:|mailto:|tel:|asset:)/i.test(s)) return s;
        // Anything without an explicit scheme is treated as relative.
        if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
        return '';
    }

    /**
     * Conservative DOM-based sanitizer used as the default for `information`
     * marker HTML when the caller does not inject the project sanitizer.
     * Removes scripts/styles/embeds, inline event handlers and unsafe URL
     * schemes by DOM traversal (never regex scrubbing of markup).
     */
    function sanitizeHtmlDom(html) {
        const src = typeof html === 'string' ? html : '';
        if (!src) return '';
        if (typeof document === 'undefined' || !document.createElement) return escapeHtml(src);
        const tpl = document.createElement('template');
        tpl.innerHTML = src;
        const banned = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1, BASE: 1 };
        const walk = (node) => {
            const children = Array.prototype.slice.call(node.childNodes || []);
            children.forEach((child) => {
                if (child.nodeType === 1) {
                    if (banned[child.tagName]) { child.remove(); return; }
                    Array.prototype.slice.call(child.attributes || []).forEach((attr) => {
                        const name = attr.name.toLowerCase();
                        if (name.indexOf('on') === 0) { child.removeAttribute(attr.name); return; }
                        if ((name === 'href' || name === 'src' || name === 'xlink:href') && !safeUrl(attr.value)) {
                            child.removeAttribute(attr.name);
                        }
                    });
                    walk(child);
                }
            });
        };
        walk(tpl.content);
        return tpl.innerHTML;
    }

    /** Default media resolver: resolve asset:// via AssetManager when live. */
    function resolveMediaDefault(url) {
        const s = typeof url === 'string' ? url.trim() : '';
        if (!s) return '';
        if (s.startsWith('asset://')) {
            const am = getAssetManager();
            if (am && typeof am.resolveAssetURLSync === 'function') {
                try { return am.resolveAssetURLSync(s) || s; } catch (_) { return s; }
            }
            return s;
        }
        return s;
    }

    /** Return focusable descendants of a container (for the dialog trap). */
    function getFocusable(container) {
        if (!container || !container.querySelectorAll) return [];
        const sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
        return Array.prototype.slice.call(container.querySelectorAll(sel)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    }

    /**
     * Raycast a pointer position against an STL instance mesh.
     *
     * Returns the hit point in the mesh's LOCAL (normalized, centered) space
     * plus the object-space face normal — both stable across camera/auto
     * rotation because the mesh transform is reapplied at render time. Returns
     * null on miss or when THREE / mesh is unavailable.
     *
     * @param {object} instance
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{position:{x,y,z}, normal:{x,y,z}}|null}
     */
    function raycastFromPointer(instance, clientX, clientY) {
        const T = globalScope.THREE;
        if (!T || !instance || !instance.mesh || !instance.camera || !instance.canvas) return null;
        const rect = instance.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const ndc = new T.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1,
        );
        const ray = new T.Raycaster();
        ray.setFromCamera(ndc, instance.camera);
        const hits = ray.intersectObject(instance.mesh, true);
        if (!hits.length) return null;
        const hit = hits[0];
        const local = instance.mesh.worldToLocal(hit.point.clone());
        let normal = { x: 0, y: 1, z: 0 };
        if (hit.face && hit.face.normal) {
            const n = hit.face.normal;
            normal = { x: n.x, y: n.y, z: n.z };
        }
        return { position: { x: local.x, y: local.y, z: local.z }, normal: normal };
    }

    /**
     * Create the interaction layer for a viewer.
     *
     * @param {object} handle - { wrapper, type, modelViewer?, instance? }
     * @param {object} interaction - NORMALIZED interaction state
     * @param {'view'|'edit'} mode
     * @param {object} [hooks] - { onPlaced, resolveMediaUrl, sanitizeHtml, t, onActivate }
     * @returns {object} controller
     */
    function createInteractionLayer(handle, interaction, mode, hooks) {
        handle = handle || {};
        hooks = hooks || {};
        const wrapper = handle.wrapper;
        const type = handle.type || detectModelType((handle.instance && handle.instance.options && handle.instance.options.src) || '');
        const isModelViewer = type === 'glb' || type === 'gltf';
        const t = typeof hooks.t === 'function' ? hooks.t : (k) => k;
        const resolveMedia = typeof hooks.resolveMediaUrl === 'function' ? hooks.resolveMediaUrl : resolveMediaDefault;
        const sanitize = typeof hooks.sanitizeHtml === 'function' ? hooks.sanitizeHtml : sanitizeHtmlDom;

        let state = interaction || { enabled: false, markers: [] };
        let markers = Array.isArray(state.markers) ? state.markers : [];
        let activeId = '';
        let destroyed = false;
        let placing = false;
        let dialogEl = null;
        let lastFocus = null;
        const listeners = [];
        let adapter = null;
        let guidedNav = null;
        let guidedStatus = null;

        function on(target, evType, fn, opts) {
            if (!target || !target.addEventListener) return;
            target.addEventListener(evType, fn, opts);
            listeners.push({ target, evType, fn, opts });
        }
        function offAll() {
            listeners.forEach(({ target, evType, fn, opts }) => {
                try { target.removeEventListener(evType, fn, opts); } catch (_) { /* noop */ }
            });
            listeners.length = 0;
        }

        function markerLabel(marker, index) {
            return marker.label || (t('Marker') + ' ' + (index + 1));
        }

        // ── Content dialog (shared, accessible) ────────────────────────
        function closeDialog() {
            if (!dialogEl) return;
            const el = dialogEl;
            dialogEl = null;
            try { el.remove(); } catch (_) { /* noop */ }
            if (lastFocus && typeof lastFocus.focus === 'function') {
                try { lastFocus.focus(); } catch (_) { /* noop */ }
            }
        }

        function openDialog(title, buildBody) {
            closeDialog();
            lastFocus = document.activeElement;
            const overlay = document.createElement('div');
            overlay.className = 'tdv-dialog-overlay';
            const dialog = document.createElement('div');
            dialog.className = 'tdv-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-label', title || t('Marker'));
            const header = document.createElement('div');
            header.className = 'tdv-dialog-header';
            const h = document.createElement('h2');
            h.className = 'tdv-dialog-title';
            h.textContent = title || '';
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'tdv-dialog-close';
            closeBtn.setAttribute('aria-label', t('Close'));
            closeBtn.textContent = '✕';
            header.appendChild(h);
            header.appendChild(closeBtn);
            const body = document.createElement('div');
            body.className = 'tdv-dialog-body';
            dialog.appendChild(header);
            dialog.appendChild(body);
            overlay.appendChild(dialog);
            (wrapper || document.body).appendChild(overlay);
            dialogEl = overlay;

            buildBody(body);

            on(closeBtn, 'click', closeDialog);
            on(overlay, 'click', (e) => { if (e.target === overlay) closeDialog(); });
            on(dialog, 'keydown', (e) => {
                if (e.key === 'Escape') { e.stopPropagation(); closeDialog(); return; }
                if (e.key === 'Tab') {
                    const f = getFocusable(dialog);
                    if (!f.length) return;
                    const first = f[0];
                    const last = f[f.length - 1];
                    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            });
            try { closeBtn.focus(); } catch (_) { /* noop */ }
        }

        // ── Question renderer (single-choice, accessible) ──────────────
        function buildQuestion(body, marker) {
            const q = marker.action.payload || {};
            const fs = document.createElement('fieldset');
            fs.className = 'tdv-question';
            const legend = document.createElement('legend');
            legend.className = 'tdv-question-prompt';
            legend.textContent = q.prompt || '';
            fs.appendChild(legend);
            const name = 'tdv-q-' + marker.id;
            const inputs = [];
            (q.options || []).forEach((opt) => {
                const label = document.createElement('label');
                label.className = 'tdv-question-option';
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = name;
                input.value = opt.id;
                const span = document.createElement('span');
                span.textContent = opt.text || '';
                label.appendChild(input);
                label.appendChild(span);
                fs.appendChild(label);
                inputs.push(input);
            });
            const check = document.createElement('button');
            check.type = 'button';
            check.className = 'tdv-q-check';
            check.textContent = t('Check');
            const feedback = document.createElement('div');
            feedback.className = 'tdv-q-feedback';
            feedback.setAttribute('role', 'status');
            feedback.setAttribute('aria-live', 'polite');
            body.appendChild(fs);
            body.appendChild(check);
            body.appendChild(feedback);

            const attemptsAllowed = q.attemptsAllowed || 0; // 0 = unlimited
            let attempts = 0;
            on(check, 'click', () => {
                const chosen = inputs.filter((i) => i.checked)[0];
                if (!chosen) {
                    feedback.className = 'tdv-q-feedback';
                    feedback.textContent = t('Please select an answer');
                    return;
                }
                attempts += 1;
                const correct = gradeSingleChoiceLocal(q, chosen.value);
                if (correct) {
                    feedback.className = 'tdv-q-feedback tdv-q-feedback--correct';
                    feedback.textContent = q.feedbackCorrect || t('Correct');
                    check.disabled = true;
                    inputs.forEach((i) => { i.disabled = true; });
                } else {
                    feedback.className = 'tdv-q-feedback tdv-q-feedback--incorrect';
                    let msg = q.feedbackIncorrect || t('Incorrect');
                    if (attemptsAllowed > 0 && attempts >= attemptsAllowed) {
                        check.disabled = true;
                        inputs.forEach((i) => { i.disabled = true; });
                        msg += ' ' + t('No attempts left');
                    }
                    feedback.textContent = msg;
                }
            });
        }

        // Local single-choice grading — the runtime receives already
        // normalized questions, so a direct id/correct lookup is enough.
        function gradeSingleChoiceLocal(q, id) {
            const chosen = (q.options || []).filter((op) => op.id === id)[0];
            return !!(chosen && chosen.correct);
        }

        function activateMarker(marker, index) {
            if (!marker) return;
            const action = marker.action || { type: 'information', payload: {} };
            if (action.type === 'link') {
                const url = safeUrl(action.payload && action.payload.url);
                if (!url) return;
                if (action.payload.newTab !== false) {
                    globalScope.open(url, '_blank', 'noopener,noreferrer');
                } else {
                    globalScope.location.href = url;
                }
                return;
            }
            const title = markerLabel(marker, index);
            openDialog(title, (body) => {
                if (marker.description) {
                    const p = document.createElement('p');
                    p.className = 'tdv-dialog-description';
                    p.textContent = marker.description;
                    body.appendChild(p);
                }
                const payload = action.payload || {};
                if (action.type === 'information') {
                    const div = document.createElement('div');
                    div.className = 'tdv-dialog-html';
                    div.innerHTML = sanitize(payload.html || '');
                    body.appendChild(div);
                } else if (action.type === 'image') {
                    const fig = document.createElement('figure');
                    fig.className = 'tdv-dialog-figure';
                    const img = document.createElement('img');
                    img.src = resolveMedia(payload.src || '');
                    img.alt = payload.alt || '';
                    fig.appendChild(img);
                    if (payload.caption) {
                        const cap = document.createElement('figcaption');
                        cap.textContent = payload.caption;
                        fig.appendChild(cap);
                    }
                    body.appendChild(fig);
                } else if (action.type === 'video') {
                    const video = document.createElement('video');
                    video.className = 'tdv-dialog-video';
                    video.controls = true;
                    video.src = resolveMedia(payload.src || '');
                    if (payload.poster) video.poster = resolveMedia(payload.poster);
                    body.appendChild(video);
                } else if (action.type === 'question') {
                    buildQuestion(body, marker);
                }
            });
            if (typeof hooks.onActivate === 'function') hooks.onActivate(marker.id);
        }

        function setActive(id) {
            activeId = id || '';
            if (adapter && adapter.setActive) adapter.setActive(activeId);
            updateGuided();
        }

        function focusMarker(id) {
            const index = markers.findIndex((m) => m.id === id);
            if (index < 0) return;
            const marker = markers[index];
            setActive(id);
            if (adapter && adapter.focusMarker) adapter.focusMarker(marker);
            activateMarker(marker, index);
        }

        // ── Guided navigation ──────────────────────────────────────────
        function currentIndex() {
            const i = markers.findIndex((m) => m.id === activeId);
            return i < 0 ? -1 : i;
        }
        function go(delta) {
            if (!markers.length) return;
            let i = currentIndex();
            if (i < 0) { i = delta > 0 ? -1 : markers.length; }
            let next = i + delta;
            if (state.wrapNavigation) {
                next = (next + markers.length) % markers.length;
            } else if (next < 0 || next >= markers.length) {
                return;
            }
            focusMarker(markers[next].id);
        }
        function updateGuided() {
            if (!guidedNav) return;
            const i = currentIndex();
            const prevBtn = guidedNav.querySelector('.tdv-nav-prev');
            const nextBtn = guidedNav.querySelector('.tdv-nav-next');
            if (!state.wrapNavigation) {
                if (prevBtn) prevBtn.disabled = i <= 0;
                if (nextBtn) nextBtn.disabled = i >= markers.length - 1;
            }
            if (guidedStatus) {
                const shown = i < 0 ? 0 : i + 1;
                guidedStatus.textContent = t('Marker') + ' ' + shown + ' / ' + markers.length;
            }
        }
        function setupGuided() {
            guidedNav = wrapper ? wrapper.querySelector('.tdv-guided-nav') : null;
            if (state.guidedMode && !guidedNav && wrapper) {
                guidedNav = document.createElement('div');
                guidedNav.className = 'tdv-guided-nav';
                guidedNav.setAttribute('data-guided', '');
                guidedNav.innerHTML =
                    '<button type="button" class="tdv-nav-prev"></button>' +
                    '<span class="tdv-guided-status" aria-live="polite"></span>' +
                    '<button type="button" class="tdv-nav-next"></button>';
                wrapper.appendChild(guidedNav);
            }
            if (!guidedNav) return;
            if (!state.guidedMode) { guidedNav.hidden = true; return; }
            guidedNav.hidden = false;
            const prevBtn = guidedNav.querySelector('.tdv-nav-prev');
            const nextBtn = guidedNav.querySelector('.tdv-nav-next');
            if (prevBtn && !prevBtn.textContent) prevBtn.textContent = t('Previous');
            if (nextBtn && !nextBtn.textContent) nextBtn.textContent = t('Next');
            guidedStatus = guidedNav.querySelector('.tdv-guided-status');
            if (prevBtn) on(prevBtn, 'click', () => go(-1));
            if (nextBtn) on(nextBtn, 'click', () => go(1));
            updateGuided();
        }

        function revealFallback(show) {
            if (!wrapper) return;
            const fb = wrapper.querySelector('.tdv-fallback');
            if (fb) fb.hidden = !show;
        }

        // ── Public controller surface ──────────────────────────────────
        function render() {
            if (destroyed) return;
            markers = Array.isArray(state.markers) ? state.markers : [];
            if (adapter && adapter.renderMarkers) {
                adapter.renderMarkers(markers, { showLabels: state.showMarkerLabels !== false, activeId });
                revealFallback(false);
            } else {
                revealFallback(true);
            }
            setupGuided();
        }

        function setState(next) {
            state = next || { enabled: false, markers: [] };
            if (activeId && !(state.markers || []).some((m) => m.id === activeId)) activeId = '';
            render();
        }

        function enterPlacementMode() {
            if (!adapter || !adapter.enterPlacementMode) return;
            placing = true;
            if (wrapper) wrapper.classList.add('tdv-placing');
            adapter.enterPlacementMode((anchor) => {
                exitPlacementMode();
                if (typeof hooks.onPlaced === 'function') hooks.onPlaced(anchor);
            });
        }
        function exitPlacementMode() {
            placing = false;
            if (wrapper) wrapper.classList.remove('tdv-placing');
            if (adapter && adapter.exitPlacementMode) adapter.exitPlacementMode();
        }

        function captureCamera() {
            return (adapter && adapter.captureCamera) ? adapter.captureCamera() : { orbit: '', target: '', fieldOfView: '' };
        }

        function destroy() {
            if (destroyed) return;
            destroyed = true;
            exitPlacementMode();
            closeDialog();
            offAll();
            if (adapter && adapter.destroy) adapter.destroy();
            adapter = null;
        }

        const controller = {
            setState,
            render,
            enterPlacementMode,
            exitPlacementMode,
            focusMarker,
            captureCamera,
            next: () => go(1),
            prev: () => go(-1),
            getActiveId: () => activeId,
            destroy,
            // exposed for adapters / tests
            _activate: activateMarker,
            _markerLabel: markerLabel,
        };

        // ── Build the adapter ──────────────────────────────────────────
        if (isModelViewer && handle.modelViewer) {
            adapter = makeModelViewerAdapter(handle.modelViewer, controller, { on, t });
        } else if (type === 'stl') {
            const instance = handle.instance || getInstance(wrapper);
            if (instance) {
                adapter = makeStlAdapter(instance, controller, wrapper, { on, t });
            }
        }

        render();
        return controller;
    }

    /**
     * Adapter for the <model-viewer> render path — uses native declarative
     * hotspots (slotted elements with data-position / data-normal), so
     * projection and occlusion are handled by the component.
     */
    function makeModelViewerAdapter(modelViewer, controller, env) {
        let placeHandler = null;
        function clearMarkers() {
            Array.prototype.slice.call(modelViewer.querySelectorAll('.tdv-marker[slot^="hotspot-"]')).forEach((el) => el.remove());
        }
        return {
            renderMarkers(markers, opts) {
                clearMarkers();
                markers.forEach((m, index) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'tdv-marker tdv-marker--mv';
                    btn.setAttribute('slot', 'hotspot-' + m.id);
                    const p = m.anchor.position;
                    const n = m.anchor.normal;
                    btn.dataset.position = p.x + ' ' + p.y + ' ' + p.z;
                    btn.dataset.normal = n.x + ' ' + n.y + ' ' + n.z;
                    if (m.anchor.surface) btn.dataset.surface = m.anchor.surface;
                    btn.dataset.markerId = m.id;
                    btn.dataset.markerOrder = String(index);
                    btn.setAttribute('aria-label', controller._markerLabel(m, index));
                    const icon = document.createElement('span');
                    icon.className = 'tdv-marker-icon tdv-icon-' + m.icon;
                    icon.setAttribute('aria-hidden', 'true');
                    btn.appendChild(icon);
                    if (opts.showLabels && m.label) {
                        const label = document.createElement('span');
                        label.className = 'tdv-marker-label';
                        label.textContent = m.label;
                        btn.appendChild(label);
                    }
                    if (opts.activeId === m.id) { btn.classList.add('tdv-marker--active'); btn.setAttribute('aria-current', 'true'); }
                    env.on(btn, 'click', () => controller.focusMarker(m.id));
                    modelViewer.appendChild(btn);
                });
            },
            setActive(activeId) {
                Array.prototype.slice.call(modelViewer.querySelectorAll('.tdv-marker')).forEach((el) => {
                    const on = el.dataset.markerId === activeId;
                    el.classList.toggle('tdv-marker--active', on);
                    if (on) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
                });
            },
            focusMarker(marker) {
                const cam = marker.camera || {};
                if (cam.orbit) modelViewer.cameraOrbit = cam.orbit;
                if (cam.target) modelViewer.cameraTarget = cam.target;
                if (cam.fieldOfView) modelViewer.fieldOfView = cam.fieldOfView;
            },
            captureCamera() {
                try {
                    const orbit = typeof modelViewer.getCameraOrbit === 'function' ? modelViewer.getCameraOrbit().toString() : '';
                    const target = typeof modelViewer.getCameraTarget === 'function' ? modelViewer.getCameraTarget().toString() : '';
                    const fov = typeof modelViewer.getFieldOfView === 'function' ? modelViewer.getFieldOfView() + 'deg' : '';
                    return { orbit, target, fieldOfView: fov };
                } catch (_) { return { orbit: '', target: '', fieldOfView: '' }; }
            },
            enterPlacementMode(onPlaced) {
                placeHandler = (e) => {
                    if (typeof modelViewer.positionAndNormalFromPoint !== 'function') return;
                    const hit = modelViewer.positionAndNormalFromPoint(e.clientX, e.clientY);
                    if (!hit) return;
                    onPlaced({
                        position: parseTriple(hit.position && hit.position.toString()),
                        normal: parseTriple(hit.normal && hit.normal.toString()),
                        surface: '',
                        camera: this.captureCamera(),
                    });
                };
                env.on(modelViewer, 'click', placeHandler);
            },
            exitPlacementMode() {
                if (placeHandler) {
                    try { modelViewer.removeEventListener('click', placeHandler); } catch (_) { /* noop */ }
                    placeHandler = null;
                }
            },
            destroy() { this.exitPlacementMode(); clearMarkers(); },
        };
    }

    /** Parse a "x y z" string into a {x,y,z} vector object. */
    function parseTriple(str) {
        const parts = String(str || '').trim().split(/\s+/).map(parseFloat);
        return { x: parts[0] || 0, y: parts[1] || 0, z: parts[2] || 0 };
    }

    /**
     * Adapter for the STL Three.js render path — projects marker anchors to a
     * DOM overlay each frame and hides markers that face away from the camera
     * or fall outside the viewport.
     */
    function makeStlAdapter(instance, controller, wrapper, env) {
        const T = globalScope.THREE;
        let layer = wrapper ? wrapper.querySelector('.tdv-marker-layer') : null;
        if (!layer && wrapper) {
            layer = document.createElement('div');
            layer.className = 'tdv-marker-layer';
            wrapper.appendChild(layer);
        }
        let entries = [];
        let placeHandler = null;

        function reproject() {
            if (!T || !instance.mesh || !instance.camera || !instance.canvas || !entries.length) return;
            instance.mesh.updateMatrixWorld();
            instance.camera.updateMatrixWorld();
            const cw = instance.canvas.clientWidth || instance.canvas.width || 1;
            const ch = instance.canvas.clientHeight || instance.canvas.height || 1;
            const camPos = instance.camera.position;
            entries.forEach((entry) => {
                const world = entry.local.clone();
                instance.mesh.localToWorld(world);
                const ndc = world.clone().project(instance.camera);
                const nWorld = entry.normal.clone().transformDirection(instance.mesh.matrixWorld);
                const toCam = new T.Vector3().subVectors(camPos, world).normalize();
                const facing = nWorld.dot(toCam) > -0.15;
                const inFront = ndc.z < 1 && ndc.z > -1;
                const onScreen = ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1;
                const visible = facing && inFront && onScreen;
                const x = (ndc.x * 0.5 + 0.5) * cw;
                const y = (-ndc.y * 0.5 + 0.5) * ch;
                entry.el.style.left = x + 'px';
                entry.el.style.top = y + 'px';
                entry.el.classList.toggle('tdv-marker--hidden', !visible);
                if (visible) { entry.el.removeAttribute('tabindex'); entry.el.removeAttribute('aria-hidden'); }
                else { entry.el.setAttribute('tabindex', '-1'); entry.el.setAttribute('aria-hidden', 'true'); }
            });
        }

        // Drive reprojection off the shared RAF loop (no second loop).
        if (instance.onFrame && instance.onFrame.indexOf(reproject) === -1) {
            instance.onFrame.push(reproject);
        }

        return {
            renderMarkers(markers, opts) {
                if (!layer) return;
                layer.innerHTML = '';
                entries = markers.map((m, index) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'tdv-marker tdv-marker--stl';
                    btn.dataset.markerId = m.id;
                    btn.dataset.markerOrder = String(index);
                    btn.setAttribute('aria-label', controller._markerLabel(m, index));
                    const icon = document.createElement('span');
                    icon.className = 'tdv-marker-icon tdv-icon-' + m.icon;
                    icon.setAttribute('aria-hidden', 'true');
                    btn.appendChild(icon);
                    if (opts.showLabels && m.label) {
                        const label = document.createElement('span');
                        label.className = 'tdv-marker-label';
                        label.textContent = m.label;
                        btn.appendChild(label);
                    }
                    if (opts.activeId === m.id) { btn.classList.add('tdv-marker--active'); btn.setAttribute('aria-current', 'true'); }
                    env.on(btn, 'click', () => controller.focusMarker(m.id));
                    layer.appendChild(btn);
                    return {
                        el: btn,
                        local: T ? new T.Vector3(m.anchor.position.x, m.anchor.position.y, m.anchor.position.z) : { x: 0, y: 0, z: 0, clone() { return this; }, project() { return this; } },
                        normal: T ? new T.Vector3(m.anchor.normal.x, m.anchor.normal.y, m.anchor.normal.z) : { clone() { return this; } },
                    };
                });
                reproject();
            },
            setActive(activeId) {
                entries.forEach((entry) => {
                    const on = entry.el.dataset.markerId === activeId;
                    entry.el.classList.toggle('tdv-marker--active', on);
                    if (on) entry.el.setAttribute('aria-current', 'true'); else entry.el.removeAttribute('aria-current');
                });
            },
            focusMarker(marker) {
                const cam = marker.camera || {};
                if (!T || !instance.camera) return;
                const pos = parseTriple(cam.orbit);
                const tgt = parseTriple(cam.target);
                if (cam.orbit) instance.camera.position.set(pos.x, pos.y, pos.z);
                if (cam.target && instance.controls) { instance.controls.target.set(tgt.x, tgt.y, tgt.z); instance.controls.update(); }
                else if (cam.target) instance.camera.lookAt(tgt.x, tgt.y, tgt.z);
            },
            captureCamera() {
                if (!instance.camera) return { orbit: '', target: '', fieldOfView: '' };
                const p = instance.camera.position;
                const target = instance.controls ? instance.controls.target : { x: 0, y: 0, z: 0 };
                return {
                    orbit: p.x + ' ' + p.y + ' ' + p.z,
                    target: target.x + ' ' + target.y + ' ' + target.z,
                    fieldOfView: (instance.camera.fov || 45) + 'deg',
                };
            },
            enterPlacementMode(onPlaced) {
                if (!instance.canvas) return;
                placeHandler = (e) => {
                    const hit = raycastFromPointer(instance, e.clientX, e.clientY);
                    if (!hit) return;
                    onPlaced({ position: hit.position, normal: hit.normal, surface: '', camera: this.captureCamera() });
                };
                env.on(instance.canvas, 'click', placeHandler);
            },
            exitPlacementMode() {
                if (placeHandler && instance.canvas) {
                    try { instance.canvas.removeEventListener('click', placeHandler); } catch (_) { /* noop */ }
                    placeHandler = null;
                }
            },
            destroy() {
                this.exitPlacementMode();
                if (instance.onFrame) {
                    const idx = instance.onFrame.indexOf(reproject);
                    if (idx !== -1) instance.onFrame.splice(idx, 1);
                }
                if (layer) { try { layer.remove(); } catch (_) { /* noop */ } }
                entries = [];
            },
        };
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Return the instance attached to a wrapper, or null if none.
     *
     * @param {HTMLElement} wrapper
     * @returns {object|null}
     */
    function getInstance(wrapper) {
        return REGISTRY.get(wrapper) || null;
    }

    globalScope.eXe3DViewer = {
        init,
        destroy,
        destroyAll,
        getInstance,
        detectModelType,
        normalizeColor,
        normalizeModelSource,
        resolveModelSource,
        configureRendererColorManagement,
        disposeObject3D,
        disposeMaterial,
        // Interaction layer (markers / guided navigation / questions).
        createInteractionLayer,
        raycastFromPointer,
        // Test-only access — do not use in production code.
        __registry: REGISTRY,
        __readWrapperConfig: readWrapperConfig,
        __track: track,
        __bootSTL: bootSTL,
        __escapeHtml: escapeHtml,
        __safeUrl: safeUrl,
        __sanitizeHtmlDom: sanitizeHtmlDom,
        __parseTriple: parseTriple,
    };
})();
