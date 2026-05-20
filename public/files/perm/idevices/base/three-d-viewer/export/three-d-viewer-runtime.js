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
        // Test-only access — do not use in production code.
        __registry: REGISTRY,
        __readWrapperConfig: readWrapperConfig,
        __track: track,
        __bootSTL: bootSTL,
    };
})();
