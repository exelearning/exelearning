/**
 * Unit tests for the shared 3D Viewer runtime.
 *
 * Covers:
 *   - Pure helpers: detectModelType, normalizeColor, normalizeModelSource
 *   - configureRendererColorManagement (with mocked THREE)
 *   - disposeMaterial / disposeObject3D
 *   - Instance registry: init/destroy/destroyAll idempotence
 *   - readWrapperConfig: flat data-* attribute parsing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadRuntime() {
    const code = readFileSync(join(__dirname, 'three-d-viewer-runtime.js'), 'utf-8');
    // eslint-disable-next-line no-eval
    (0, eval)(code);
    return globalThis.eXe3DViewer;
}

describe('three-d-viewer runtime', () => {
    let runtime;
    let originalGlobals;

    beforeEach(() => {
        originalGlobals = {
            eXe3DViewer: globalThis.eXe3DViewer,
            __threedViewerCleanupBound: globalThis.__threedViewerCleanupBound,
            THREE: globalThis.THREE,
            eXeLearning: globalThis.eXeLearning,
            URL: globalThis.URL,
        };
        delete globalThis.eXe3DViewer;
        delete globalThis.__threedViewerCleanupBound;
        delete globalThis.THREE;
        globalThis.eXeLearning = { app: { project: {} } };
        // Ensure URL.revokeObjectURL exists (Node provides it on URL, but
        // make it a no-op spy to be safe in older runners).
        if (typeof globalThis.URL?.revokeObjectURL !== 'function') {
            globalThis.URL = globalThis.URL || {};
            globalThis.URL.revokeObjectURL = () => {};
        }
        runtime = loadRuntime();
    });

    afterEach(() => {
        // Tear down any leftover instances so cross-test state can't leak.
        runtime?.destroyAll?.();
        globalThis.eXe3DViewer = originalGlobals.eXe3DViewer;
        globalThis.__threedViewerCleanupBound = originalGlobals.__threedViewerCleanupBound;
        globalThis.THREE = originalGlobals.THREE;
        globalThis.eXeLearning = originalGlobals.eXeLearning;
        if (originalGlobals.URL) globalThis.URL = originalGlobals.URL;
    });

    // ----------------------------------------------------------------
    // detectModelType
    // ----------------------------------------------------------------
    describe('detectModelType', () => {
        it('returns "stl" for asset://uuid.stl', () => {
            expect(runtime.detectModelType('asset://abc-123.stl')).toBe('stl');
        });

        it('returns "glb" for .glb', () => {
            expect(runtime.detectModelType('model.glb')).toBe('glb');
        });

        it('returns "gltf" for .gltf', () => {
            expect(runtime.detectModelType('path/to/model.gltf')).toBe('gltf');
        });

        it('returns "obj" / "fbx" for those extensions', () => {
            expect(runtime.detectModelType('m.obj')).toBe('obj');
            expect(runtime.detectModelType('m.fbx')).toBe('fbx');
        });

        it('is case-insensitive', () => {
            expect(runtime.detectModelType('FOO.STL')).toBe('stl');
            expect(runtime.detectModelType('Foo.GlB')).toBe('glb');
        });

        it('strips query strings and hash fragments', () => {
            expect(runtime.detectModelType('model.stl?v=2')).toBe('stl');
            expect(runtime.detectModelType('model.glb#frag')).toBe('glb');
            expect(runtime.detectModelType('model.gltf?a=1#b=2')).toBe('gltf');
        });

        it('returns "unknown" for missing / unsupported / empty', () => {
            expect(runtime.detectModelType('')).toBe('unknown');
            expect(runtime.detectModelType(null)).toBe('unknown');
            expect(runtime.detectModelType(undefined)).toBe('unknown');
            expect(runtime.detectModelType('model.xyz')).toBe('unknown');
            expect(runtime.detectModelType('noextension')).toBe('unknown');
        });
    });

    // ----------------------------------------------------------------
    // normalizeColor
    // ----------------------------------------------------------------
    describe('normalizeColor', () => {
        it('accepts #RRGGBB and returns lowercase', () => {
            expect(runtime.normalizeColor('#AABBCC')).toBe('#aabbcc');
            expect(runtime.normalizeColor('#123456')).toBe('#123456');
        });

        it('expands #RGB to #RRGGBB lowercase', () => {
            expect(runtime.normalizeColor('#abc')).toBe('#aabbcc');
            expect(runtime.normalizeColor('#F00')).toBe('#ff0000');
        });

        it('trims whitespace', () => {
            expect(runtime.normalizeColor('  #FF00FF  ')).toBe('#ff00ff');
        });

        it('falls back for invalid input', () => {
            expect(runtime.normalizeColor('rgb(0,0,0)')).toBe('#888888');
            expect(runtime.normalizeColor('red')).toBe('#888888');
            expect(runtime.normalizeColor('')).toBe('#888888');
            expect(runtime.normalizeColor(null)).toBe('#888888');
            expect(runtime.normalizeColor(undefined)).toBe('#888888');
            expect(runtime.normalizeColor('#GGGGGG')).toBe('#888888');
            expect(runtime.normalizeColor('#12345')).toBe('#888888');
        });

        it('uses the provided fallback', () => {
            expect(runtime.normalizeColor('bad', '#000000')).toBe('#000000');
            expect(runtime.normalizeColor(null, '#ffffff')).toBe('#ffffff');
        });
    });

    // ----------------------------------------------------------------
    // normalizeModelSource
    // ----------------------------------------------------------------
    describe('normalizeModelSource', () => {
        it('passes asset:// URLs through unchanged', () => {
            expect(runtime.normalizeModelSource('asset://abc.stl')).toBe('asset://abc.stl');
        });

        it('passes http(s):// URLs through unchanged', () => {
            expect(runtime.normalizeModelSource('https://example.com/m.glb'))
                .toBe('https://example.com/m.glb');
        });

        it('passes relative paths through unchanged', () => {
            expect(runtime.normalizeModelSource('content/resources/x.stl'))
                .toBe('content/resources/x.stl');
        });

        it('strips blob: URLs', () => {
            expect(runtime.normalizeModelSource('blob:http://localhost/123')).toBe('');
        });

        it('strips data: URLs', () => {
            expect(runtime.normalizeModelSource('data:model/gltf-binary;base64,AAA=')).toBe('');
        });

        it('trims whitespace and returns empty for invalid input', () => {
            expect(runtime.normalizeModelSource('   ')).toBe('');
            expect(runtime.normalizeModelSource(null)).toBe('');
            expect(runtime.normalizeModelSource(undefined)).toBe('');
            expect(runtime.normalizeModelSource(123)).toBe('');
        });
    });

    // ----------------------------------------------------------------
    // configureRendererColorManagement
    // ----------------------------------------------------------------
    describe('configureRendererColorManagement', () => {
        it('is a no-op when THREE is not defined', () => {
            const renderer = { outputColorSpace: undefined };
            expect(() => runtime.configureRendererColorManagement(renderer)).not.toThrow();
            // No properties should be touched.
            expect(renderer.outputColorSpace).toBeUndefined();
        });

        it('sets outputColorSpace when available (r150+ path)', () => {
            globalThis.THREE = {
                SRGBColorSpace: 'srgb',
                NoToneMapping: 0,
                ColorManagement: { enabled: false },
            };
            const renderer = { outputColorSpace: 'linear', toneMapping: 1 };
            runtime.configureRendererColorManagement(renderer);
            expect(renderer.outputColorSpace).toBe('srgb');
            expect(renderer.toneMapping).toBe(0);
            expect(globalThis.THREE.ColorManagement.enabled).toBe(true);
        });

        it('falls back to outputEncoding when only that is available (pre-r150)', () => {
            globalThis.THREE = {
                sRGBEncoding: 3001,
                NoToneMapping: 0,
                ColorManagement: { enabled: false },
            };
            const renderer = { outputEncoding: 3000 };
            runtime.configureRendererColorManagement(renderer);
            expect(renderer.outputEncoding).toBe(3001);
        });

        it('is a no-op when renderer is null', () => {
            globalThis.THREE = { SRGBColorSpace: 'srgb' };
            expect(() => runtime.configureRendererColorManagement(null)).not.toThrow();
        });
    });

    // ----------------------------------------------------------------
    // disposeMaterial
    // ----------------------------------------------------------------
    describe('disposeMaterial', () => {
        it('handles null / undefined without throwing', () => {
            expect(() => runtime.disposeMaterial(null)).not.toThrow();
            expect(() => runtime.disposeMaterial(undefined)).not.toThrow();
        });

        it('disposes the material', () => {
            let disposed = false;
            runtime.disposeMaterial({ dispose: () => { disposed = true; } });
            expect(disposed).toBe(true);
        });

        it('disposes texture-shaped fields (isTexture flag)', () => {
            const calls = [];
            const tex = { isTexture: true, dispose: () => calls.push('tex') };
            const notTex = { dispose: () => calls.push('notTex') };
            const mat = {
                map: tex,
                normalMap: tex,
                userData: notTex, // isTexture is undefined → not disposed
                dispose: () => calls.push('mat'),
            };
            runtime.disposeMaterial(mat);
            // map + normalMap are the same texture object → dispose called twice
            // (we don't dedupe; THREE doesn't either).
            expect(calls.filter((c) => c === 'tex').length).toBe(2);
            expect(calls).toContain('mat');
            expect(calls).not.toContain('notTex');
        });

        it('handles arrays of materials', () => {
            const seen = [];
            runtime.disposeMaterial([
                { dispose: () => seen.push('a') },
                { dispose: () => seen.push('b') },
            ]);
            expect(seen).toEqual(['a', 'b']);
        });
    });

    // ----------------------------------------------------------------
    // disposeObject3D
    // ----------------------------------------------------------------
    describe('disposeObject3D', () => {
        it('is a no-op for null / objects without traverse', () => {
            expect(() => runtime.disposeObject3D(null)).not.toThrow();
            expect(() => runtime.disposeObject3D({})).not.toThrow();
        });

        it('traverses children and disposes geometries + materials', () => {
            const events = [];
            const tex = { isTexture: true, dispose: () => events.push('tex') };
            const mat = { map: tex, dispose: () => events.push('mat') };
            const geom = { dispose: () => events.push('geom') };
            const child = { geometry: geom, material: mat };
            const root = {
                traverse: (cb) => {
                    cb(root);
                    cb(child);
                },
            };
            runtime.disposeObject3D(root);
            expect(events).toContain('geom');
            expect(events).toContain('mat');
            expect(events).toContain('tex');
        });
    });
});

// ------------------------------------------------------------------
// Registry / lifecycle
// ------------------------------------------------------------------
describe('three-d-viewer runtime — registry', () => {
    let runtime;

    beforeEach(() => {
        delete globalThis.eXe3DViewer;
        delete globalThis.__threedViewerCleanupBound;
        runtime = loadRuntime();
    });

    afterEach(() => {
        runtime.destroyAll();
        delete globalThis.eXe3DViewer;
        delete globalThis.__threedViewerCleanupBound;
    });

    function makeWrapper(attrs = {}) {
        const div = document.createElement('div');
        div.className = 'three-d-viewer-wrapper';
        Object.entries(attrs).forEach(([k, v]) => { div.dataset[k] = v; });
        document.body.appendChild(div);
        return div;
    }

    it('init returns an instance and registers it', () => {
        const w = makeWrapper({ modelSrc: 'asset://abc.stl' });
        const inst = runtime.init(w);
        expect(inst).toBeTruthy();
        expect(inst.wrapper).toBe(w);
        expect(runtime.__registry.has(w)).toBe(true);
    });

    it('init is idempotent — same instance on repeated calls', () => {
        const w = makeWrapper({ modelSrc: 'asset://abc.glb' });
        const a = runtime.init(w);
        const b = runtime.init(w);
        expect(a).toBe(b);
    });

    it('readWrapperConfig parses flat data-* attributes', () => {
        const w = makeWrapper({
            modelSrc: 'asset://abc.stl',
            modelColor: '#FF0000',
            backgroundColor: '#000000',
            cameraControls: 'false',
            autoRotate: 'false',
            autoRotateSpeed: '45',
            showNavControls: 'true',
            animationEnabled: 'true',
            animationName: 'spin',
            animationSpeed: '1.5',
            alt: 'A red cube',
        });
        const cfg = runtime.__readWrapperConfig(w);
        expect(cfg.src).toBe('asset://abc.stl');
        expect(cfg.type).toBe('stl');
        expect(cfg.modelColor).toBe('#ff0000');
        expect(cfg.backgroundColor).toBe('#000000');
        expect(cfg.cameraControls).toBe(false);
        expect(cfg.showNavControls).toBe(true);
        expect(cfg.autoRotate).toBe(false); // showNavControls forces autoRotate off
        expect(cfg.autoRotateSpeed).toBe(45);
        expect(cfg.animation).toEqual({ enabled: true, name: 'spin', speed: 1.5 });
        expect(cfg.alt).toBe('A red cube');
    });

    it('readWrapperConfig applies defaults when attrs missing', () => {
        const w = makeWrapper({ modelSrc: 'asset://abc.glb' });
        const cfg = runtime.__readWrapperConfig(w);
        expect(cfg.modelColor).toBe('#888888');
        expect(cfg.backgroundColor).toBe('#f5f5f5');
        expect(cfg.cameraControls).toBe(true);
        expect(cfg.autoRotate).toBe(true);
        expect(cfg.autoRotateSpeed).toBe(30);
        expect(cfg.showNavControls).toBe(false);
        expect(cfg.animation).toEqual({ enabled: false, name: '', speed: 1 });
    });

    it('readWrapperConfig strips blob: from data-model-src', () => {
        const w = makeWrapper({ modelSrc: 'blob:http://x/abc' });
        expect(runtime.__readWrapperConfig(w).src).toBe('');
    });

    it('destroy cancels RAF, runs disposers, drops from registry', () => {
        const w = makeWrapper({ modelSrc: 'asset://abc.stl' });
        const inst = runtime.init(w);
        let cancelled = null;
        const originalCancel = globalThis.cancelAnimationFrame;
        globalThis.cancelAnimationFrame = (id) => { cancelled = id; };
        const events = [];
        inst.rafId = 42;
        inst.renderer = { dispose: () => events.push('renderer') };
        inst.controls = { dispose: () => events.push('controls') };
        inst.geometry = { dispose: () => events.push('geom') };
        inst.material = { dispose: () => events.push('mat') };
        const handler = () => {};
        inst.eventListeners.push({ target: w, type: 'click', handler });
        runtime.destroy(w);
        expect(cancelled).toBe(42);
        expect(events).toEqual(expect.arrayContaining(['renderer', 'controls', 'geom', 'mat']));
        expect(runtime.__registry.has(w)).toBe(false);
        expect(inst.stopped).toBe(true);
        globalThis.cancelAnimationFrame = originalCancel;
    });

    it('destroy on an unregistered wrapper is a safe no-op', () => {
        const w = document.createElement('div');
        expect(() => runtime.destroy(w)).not.toThrow();
    });

    it('destroyAll tears down every instance', () => {
        const w1 = makeWrapper({ modelSrc: 'asset://a.stl' });
        const w2 = makeWrapper({ modelSrc: 'asset://b.glb' });
        runtime.init(w1);
        runtime.init(w2);
        expect(runtime.__registry.size).toBe(2);
        runtime.destroyAll();
        expect(runtime.__registry.size).toBe(0);
    });

    it('destroyAll iterates in reverse insertion order', () => {
        const order = [];
        const w1 = makeWrapper({ modelSrc: 'asset://a.stl' });
        const w2 = makeWrapper({ modelSrc: 'asset://b.stl' });
        const w3 = makeWrapper({ modelSrc: 'asset://c.stl' });
        runtime.init(w1);
        runtime.init(w2);
        runtime.init(w3);
        // Tag each instance with its insertion index so we can observe order.
        runtime.__registry.get(w1).material = { dispose: () => order.push(1) };
        runtime.__registry.get(w2).material = { dispose: () => order.push(2) };
        runtime.__registry.get(w3).material = { dispose: () => order.push(3) };
        runtime.destroyAll();
        expect(order).toEqual([3, 2, 1]);
    });

    it('destroying one instance leaves the other intact', () => {
        const w1 = makeWrapper({ modelSrc: 'asset://a.stl' });
        const w2 = makeWrapper({ modelSrc: 'asset://b.glb' });
        const i1 = runtime.init(w1);
        const i2 = runtime.init(w2);
        runtime.destroy(w1);
        expect(runtime.__registry.has(w2)).toBe(true);
        expect(runtime.__registry.get(w2)).toBe(i2);
        expect(i1.stopped).toBe(true);
        expect(i2.stopped).toBe(false);
    });

    it('destroy revokes object URLs it tracked', () => {
        const w = makeWrapper({ modelSrc: 'asset://a.stl' });
        const inst = runtime.init(w);
        const revoked = [];
        const original = globalThis.URL.revokeObjectURL;
        globalThis.URL.revokeObjectURL = (u) => revoked.push(u);
        inst.objectURLs.push('blob:fake-1', 'blob:fake-2');
        runtime.destroy(w);
        expect(revoked).toEqual(['blob:fake-1', 'blob:fake-2']);
        globalThis.URL.revokeObjectURL = original;
    });
});

// ------------------------------------------------------------------
// resolveModelSource
// ------------------------------------------------------------------
describe('three-d-viewer runtime — resolveModelSource', () => {
    let runtime;

    beforeEach(() => {
        delete globalThis.eXe3DViewer;
        delete globalThis.__threedViewerCleanupBound;
        globalThis.eXeLearning = { app: { project: {} } };
        runtime = loadRuntime();
    });

    afterEach(() => {
        runtime.destroyAll();
        delete globalThis.eXe3DViewer;
        delete globalThis.__threedViewerCleanupBound;
    });

    it('returns "" for empty input', async () => {
        expect(await runtime.resolveModelSource('')).toBe('');
        expect(await runtime.resolveModelSource(null)).toBe('');
        expect(await runtime.resolveModelSource('   ')).toBe('');
    });

    it('passes http(s):// through', async () => {
        expect(await runtime.resolveModelSource('https://example.com/m.glb'))
            .toBe('https://example.com/m.glb');
    });

    it('passes relative paths through', async () => {
        expect(await runtime.resolveModelSource('content/resources/m.stl'))
            .toBe('content/resources/m.stl');
    });

    it('asset:// with no AssetManager → ""', async () => {
        expect(await runtime.resolveModelSource('asset://abc.stl')).toBe('');
    });

    it('asset:// with sync resolution → blob URL', async () => {
        const am = {
            resolveAssetURLSync: () => 'blob:abc',
            resolveAssetURL: async () => 'should-not-be-called',
        };
        expect(await runtime.resolveModelSource('asset://abc.stl', { assetManager: am }))
            .toBe('blob:abc');
    });

    it('asset:// with async resolution → blob URL', async () => {
        const am = {
            resolveAssetURLSync: () => null,
            resolveAssetURL: async () => 'blob:async',
        };
        expect(await runtime.resolveModelSource('asset://abc.glb', { assetManager: am }))
            .toBe('blob:async');
    });

    it('asset:// with AssetManager that throws → ""', async () => {
        const am = {
            resolveAssetURLSync: () => null,
            resolveAssetURL: async () => { throw new Error('boom'); },
        };
        expect(await runtime.resolveModelSource('asset://abc.glb', { assetManager: am }))
            .toBe('');
    });
});
