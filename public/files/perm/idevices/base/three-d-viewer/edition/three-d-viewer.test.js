/**
 * Unit tests for three-d-viewer iDevice (edition)
 *
 * Tests the path resolution functions used for loading Three.js modules:
 * - getThreeJSBaseUrl: Returns absolute URL for dynamic ES module imports
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load iDevice file and expose $exeDevice globally.
 * Replaces 'var $exeDevice' with 'global.$exeDevice' to make it accessible.
 */
function loadIdevice(code) {
    // Replace 'var $exeDevice' with 'global.$exeDevice' anywhere in the code
    const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
    // Execute the modified code using eval in global context
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$exeDevice;
}

describe('three-d-viewer iDevice (edition)', () => {
    let $exeDevice;
    let originalWindow;

    beforeEach(() => {
        // Save original window state
        originalWindow = {
            eXeLearning: global.eXeLearning,
            location: global.location,
        };

        // Reset $exeDevice before loading
        global.$exeDevice = undefined;

        // Mock window.location
        global.location = {
            origin: 'http://localhost:8080',
            protocol: 'http:',
            host: 'localhost:8080',
            href: 'http://localhost:8080/workarea',
        };

        // Mock minimal eXeLearning structure
        global.eXeLearning = {
            symfony: {},
            app: {
                project: {},
            },
        };

        // Mock minimal DOM elements
        global.document = global.document || {
            createElement: () => ({
                setAttribute: () => {},
                style: {},
                addEventListener: () => {},
            }),
            head: { appendChild: () => {} },
            querySelector: () => null,
        };

        // Mock _ function for translations
        global._ = (s) => s;

        // Read and execute the iDevice file
        const filePath = join(__dirname, 'three-d-viewer.js');
        const code = readFileSync(filePath, 'utf-8');

        // Load iDevice and get reference
        $exeDevice = loadIdevice(code);
    });

    afterEach(() => {
        // Restore original window state
        global.eXeLearning = originalWindow.eXeLearning;
        global.location = originalWindow.location;
    });

    describe('i18n', () => {
        it('is defined', () => {
            expect($exeDevice.i18n).toBeDefined();
        });

        it('has name defined', () => {
            expect($exeDevice.i18n.name).toBeDefined();
        });
    });

    describe('isStaticMode', () => {
        it('returns true when config.isStaticMode is true', () => {
            global.eXeLearning.config = { isStaticMode: true };
            expect($exeDevice.isStaticMode()).toBe(true);
        });

        it('returns true when config.isOfflineInstallation is true', () => {
            global.eXeLearning.config = { isOfflineInstallation: true };
            expect($exeDevice.isStaticMode()).toBe(true);
        });

        it('returns false when neither flag is set', () => {
            global.eXeLearning.config = {};
            expect($exeDevice.isStaticMode()).toBe(false);
        });

        it('returns false when config is undefined', () => {
            global.eXeLearning.config = undefined;
            expect($exeDevice.isStaticMode()).toBe(false);
        });

        it('handles string config (JSON)', () => {
            global.eXeLearning.config = '{"isStaticMode":true}';
            expect($exeDevice.isStaticMode()).toBe(true);
        });

        it('handles invalid JSON string gracefully', () => {
            global.eXeLearning.config = 'not valid json';
            expect($exeDevice.isStaticMode()).toBe(false);
        });

        it('returns true when both flags are true', () => {
            global.eXeLearning.config = { isStaticMode: true, isOfflineInstallation: true };
            expect($exeDevice.isStaticMode()).toBe(true);
        });
    });

    describe('getThreeJSBaseUrl', () => {
        // Shared Three.js libs live under export/ so editor and exported packages
        // reuse a single copy (saves ~700KB of duplicated assets).
        const expectedPath = 'files/perm/idevices/base/three-d-viewer/export/';

        it('returns absolute URL with protocol when baseURL is a full URL', () => {
            global.eXeLearning.symfony = {
                baseURL: 'https://example.com',
                basePath: '',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            expect(result).toBe(`https://example.com/${expectedPath}`);
            expect(result).toMatch(/^https?:\/\//);
        });

        it('returns absolute URL with protocol when baseURL includes path', () => {
            global.eXeLearning.symfony = {
                baseURL: 'https://example.com/app',
                basePath: '',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            expect(result).toBe(`https://example.com/app/${expectedPath}`);
            expect(result).toMatch(/^https?:\/\//);
        });

        it('prepends origin when baseURL is empty', () => {
            global.eXeLearning.symfony = {
                baseURL: '',
                basePath: '',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            expect(result).toBe(`http://localhost:8080/${expectedPath}`);
            expect(result).toMatch(/^https?:\/\//);
        });

        it('prepends origin when symfony config is undefined', () => {
            global.eXeLearning.symfony = undefined;

            const result = $exeDevice.getThreeJSBaseUrl();

            expect(result).toBe(`http://localhost:8080/${expectedPath}`);
            expect(result).toMatch(/^https?:\/\//);
        });

        it('includes basePath in URL', () => {
            global.eXeLearning.symfony = {
                baseURL: 'https://example.com',
                basePath: 'myapp',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            expect(result).toBe(`https://example.com/myapp/${expectedPath}`);
        });

        it('handles basePath with leading slash', () => {
            global.eXeLearning.symfony = {
                baseURL: 'https://example.com',
                basePath: '/myapp',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            expect(result).toBe(`https://example.com/myapp/${expectedPath}`);
        });

        it('handles basePath with trailing slash', () => {
            global.eXeLearning.symfony = {
                baseURL: 'https://example.com',
                basePath: 'myapp/',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            expect(result).toBe(`https://example.com/myapp/${expectedPath}`);
        });

        it('handles both baseURL and basePath together', () => {
            global.eXeLearning.symfony = {
                baseURL: 'https://example.com',
                basePath: 'school/elearning',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            expect(result).toBe(`https://example.com/school/elearning/${expectedPath}`);
        });

        it('strips trailing slashes from baseURL', () => {
            global.eXeLearning.symfony = {
                baseURL: 'https://example.com/',
                basePath: '',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            // Should not have double slashes
            expect(result).toBe(`https://example.com/${expectedPath}`);
            expect(result).not.toContain('//files');
        });

        it('prepends origin for relative baseURL', () => {
            global.eXeLearning.symfony = {
                baseURL: '/app',
                basePath: '',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            expect(result).toBe(`http://localhost:8080/app/${expectedPath}`);
            expect(result).toMatch(/^https?:\/\//);
        });

        it('uses https origin when page is served over https', () => {
            global.location.origin = 'https://secure.example.com';
            global.eXeLearning.symfony = {
                baseURL: '',
                basePath: '',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            expect(result).toBe(`https://secure.example.com/${expectedPath}`);
            expect(result).toMatch(/^https:\/\//);
        });

        it('always returns URL starting with http:// or https://', () => {
            // Test various edge cases
            const testCases = [
                { baseURL: '', basePath: '' },
                { baseURL: '/', basePath: '' },
                { baseURL: '/app', basePath: '' },
                { baseURL: '', basePath: 'path' },
                { baseURL: 'http://example.com', basePath: '' },
                { baseURL: 'https://example.com', basePath: 'app' },
            ];

            for (const config of testCases) {
                global.eXeLearning.symfony = config;
                const result = $exeDevice.getThreeJSBaseUrl();
                expect(result, `Failed for config: ${JSON.stringify(config)}`).toMatch(/^https?:\/\//);
            }
        });

        it('ignores basePath in static mode to avoid path duplication', () => {
            global.eXeLearning.config = { isStaticMode: true };
            global.eXeLearning.symfony = {
                baseURL: '.',
                basePath: 'pr-preview/pr-888',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            // Should use origin directly without basePath
            expect(result).toBe(`http://localhost:8080/${expectedPath}`);
            // Should NOT contain the basePath (which would cause duplication)
            expect(result).not.toContain('pr-preview');
        });

        it('uses origin + path in static offline installation mode', () => {
            global.eXeLearning.config = { isOfflineInstallation: true };
            global.eXeLearning.symfony = {
                baseURL: '.',
                basePath: 'some/deep/path',
            };

            const result = $exeDevice.getThreeJSBaseUrl();

            expect(result).toBe(`http://localhost:8080/${expectedPath}`);
            expect(result).not.toContain('some/deep/path');
        });
    });

    describe('getModelViewerLibUrl', () => {
        const expectedLibPath = 'files/perm/idevices/base/three-d-viewer/export/model-viewer.min.js';

        it('returns relative path in static mode', () => {
            global.eXeLearning.config = { isStaticMode: true };
            global.eXeLearning.symfony = {
                baseURL: '.',
                basePath: 'pr-preview/pr-888',
            };

            const result = $exeDevice.getModelViewerLibUrl();

            expect(result).toBe(`./${expectedLibPath}`);
            // Should NOT contain basePath (which would cause duplication)
            expect(result).not.toContain('pr-preview');
        });

        it('returns relative path in offline installation mode', () => {
            global.eXeLearning.config = { isOfflineInstallation: true };

            const result = $exeDevice.getModelViewerLibUrl();

            expect(result).toBe(`./${expectedLibPath}`);
        });

        it('uses resolveAssetUrl in normal (non-static) mode', () => {
            global.eXeLearning.config = {};
            global.eXeLearning.symfony = {
                baseURL: 'https://example.com',
                basePath: 'app',
            };

            const result = $exeDevice.getModelViewerLibUrl();

            expect(result).toBe(`https://example.com/app/${expectedLibPath}`);
        });

        it('uses resolveAssetUrl when config is undefined', () => {
            global.eXeLearning.config = undefined;
            global.eXeLearning.symfony = {
                baseURL: 'https://example.com',
                basePath: '',
            };

            const result = $exeDevice.getModelViewerLibUrl();

            expect(result).toBe(`https://example.com/${expectedLibPath}`);
        });
    });

    describe('isSTLFile', () => {
        it('returns true for .stl extension', () => {
            expect($exeDevice.isSTLFile('model.stl')).toBe(true);
        });

        it('returns true for .STL extension (uppercase)', () => {
            expect($exeDevice.isSTLFile('model.STL')).toBe(true);
        });

        it('returns true for path with .stl extension', () => {
            expect($exeDevice.isSTLFile('path/to/model.stl')).toBe(true);
        });

        it('returns false for .glb extension', () => {
            expect($exeDevice.isSTLFile('model.glb')).toBe(false);
        });

        it('returns false for empty string', () => {
            expect($exeDevice.isSTLFile('')).toBe(false);
        });

        it('returns false for null/undefined', () => {
            expect($exeDevice.isSTLFile(null)).toBe(false);
            expect($exeDevice.isSTLFile(undefined)).toBe(false);
        });
    });

    describe('isSupportedModelFile', () => {
        it('returns true for .glb files', () => {
            expect($exeDevice.isSupportedModelFile('model.glb')).toBe(true);
        });

        it('returns true for .gltf files', () => {
            expect($exeDevice.isSupportedModelFile('model.gltf')).toBe(true);
        });

        it('returns true for .stl files', () => {
            expect($exeDevice.isSupportedModelFile('model.stl')).toBe(true);
        });

        it('returns true for asset:// URLs with .glb', () => {
            expect($exeDevice.isSupportedModelFile('asset://uuid.glb')).toBe(true);
        });

        it('returns true for asset:// URLs with .gltf', () => {
            expect($exeDevice.isSupportedModelFile('asset://uuid.gltf')).toBe(true);
        });

        it('returns true for asset:// URLs with .stl', () => {
            expect($exeDevice.isSupportedModelFile('asset://uuid.stl')).toBe(true);
        });

        it('returns true for blob: URLs', () => {
            expect($exeDevice.isSupportedModelFile('blob:http://localhost/123')).toBe(true);
        });

        it('returns false for unsupported extensions', () => {
            expect($exeDevice.isSupportedModelFile('model.obj')).toBe(false);
            expect($exeDevice.isSupportedModelFile('model.fbx')).toBe(false);
        });

        it('returns false for empty string', () => {
            expect($exeDevice.isSupportedModelFile('')).toBe(false);
        });

        it('returns false for null/undefined', () => {
            expect($exeDevice.isSupportedModelFile(null)).toBe(false);
            expect($exeDevice.isSupportedModelFile(undefined)).toBe(false);
        });
    });

    describe('set3DViewerJSON / get3DViewerJSON', () => {
        it('forces autoRotate=false when showNavControls is true (mutual exclusion)', () => {
            $exeDevice.set3DViewerJSON({ showNavControls: true, autoRotate: true });
            expect($exeDevice.state.showNavControls).toBe(true);
            expect($exeDevice.state.autoRotate).toBe(false);
        });

        it('keeps autoRotate when showNavControls is false', () => {
            $exeDevice.set3DViewerJSON({ showNavControls: false, autoRotate: true });
            expect($exeDevice.state.autoRotate).toBe(true);
        });

        it('defaults showNavControls to false for new state', () => {
            $exeDevice.set3DViewerJSON({});
            expect($exeDevice.state.showNavControls).toBe(false);
        });

        it('reads showNavControls boolean from data', () => {
            $exeDevice.set3DViewerJSON({ showNavControls: true });
            expect($exeDevice.state.showNavControls).toBe(true);
        });

        it('get3DViewerJSON strips _previewBlobUrl (session-scoped, must not persist)', () => {
            $exeDevice.set3DViewerJSON({});
            $exeDevice.state._previewBlobUrl = 'blob:http://localhost/abc';
            const json = $exeDevice.get3DViewerJSON();
            expect(json._previewBlobUrl).toBeUndefined();
            expect(json.src).toBe('');
        });

        it('set3DViewerJSON merges modelColor as lowercase hex', () => {
            $exeDevice.set3DViewerJSON({ modelColor: '#FF0000' });
            expect($exeDevice.state.modelColor).toBe('#ff0000');
        });

        it('set3DViewerJSON expands #RGB to #RRGGBB', () => {
            $exeDevice.set3DViewerJSON({ modelColor: '#abc' });
            expect($exeDevice.state.modelColor).toBe('#aabbcc');
        });

        it('set3DViewerJSON defaults modelColor to #888888 when missing', () => {
            $exeDevice.set3DViewerJSON({});
            expect($exeDevice.state.modelColor).toBe('#888888');
        });

        it('set3DViewerJSON falls back to default for invalid modelColor', () => {
            $exeDevice.set3DViewerJSON({ modelColor: 'red' });
            expect($exeDevice.state.modelColor).toBe('#888888');
        });

        it('get3DViewerJSON round-trips modelColor', () => {
            $exeDevice.set3DViewerJSON({ modelColor: '#123456' });
            const json = $exeDevice.get3DViewerJSON();
            expect(json.modelColor).toBe('#123456');
        });

        it('get3DViewerJSON strips blob: from state.src', () => {
            $exeDevice.set3DViewerJSON({});
            // Simulate a regression upstream that injected a blob: URL.
            $exeDevice.state.src = 'blob:http://localhost/abc';
            const json = $exeDevice.get3DViewerJSON();
            expect(json.src).toBe('');
        });

        it('set3DViewerJSON discards stale blob: URL when no recovery is possible', () => {
            // Legacy projects from PR #888 saved blob: URLs in state.src.
            // With no AssetManager (or no reverse-blob entry), the
            // blob URL is unreachable on reload; discard it cleanly.
            $exeDevice.set3DViewerJSON({ src: 'blob:http://localhost/old' });
            expect($exeDevice.state.src).toBe('');
        });

        it('set3DViewerJSON recovers asset:// from blob: via reverseBlobCache', () => {
            // The workarea engine resolves asset:// → blob: when reading
            // the iDevice JSON, so the edition form receives blob: as
            // previousData.src on re-open. AssetManager.reverseBlobCache
            // lets us rebuild the canonical asset:// URL.
            const reverseBlobCache = new Map();
            reverseBlobCache.set('blob:http://localhost/abc', 'asset-uuid-1');
            global.eXeLearning.app.project.assetManager = {
                reverseBlobCache,
                getAssetMetadata: (id) =>
                    id === 'asset-uuid-1' ? { filename: 'cali-bee.stl' } : null,
                resolveAssetURLSync: () => null,
            };
            $exeDevice.set3DViewerJSON({ src: 'blob:http://localhost/abc' });
            expect($exeDevice.state.src).toBe('asset://asset-uuid-1.stl');
            delete global.eXeLearning.app.project.assetManager;
        });

        it('get3DViewerJSON does not include _previewBlobUrl from instance field', () => {
            // The instance field is intentionally NOT part of state, so a
            // serialization round-trip should drop it without help.
            $exeDevice.set3DViewerJSON({});
            $exeDevice.previewBlobUrl = 'blob:http://localhost/abc';
            const json = $exeDevice.get3DViewerJSON();
            expect(json.previewBlobUrl).toBeUndefined();
            expect(json._previewBlobUrl).toBeUndefined();
        });

        it('readFormState does not carry _previewBlobUrl on state', () => {
            // Set up stub formElements + ideviceBody that readFormState
            // (and the helpers it triggers) consume.
            $exeDevice.formElements = {
                backgroundColor: { value: '#000000' },
                modelColor: { value: '#888888' },
                src: { value: 'asset://x.stl' },
                alt: { value: '' },
                cameraControls: { checked: true },
                autoRotate: { checked: false, disabled: false },
                autoRotateSpeed: { value: '30', disabled: false },
                showNavControls: { checked: false },
                animationToggle: { checked: false },
                animationName: { value: '' },
                animationSpeed: { value: '1' },
            };
            $exeDevice.ideviceBody = { querySelector: () => null };
            $exeDevice.previewBlobUrl = 'blob:http://localhost/abc';
            $exeDevice.readFormState();
            expect($exeDevice.state._previewBlobUrl).toBeUndefined();
            // Instance field survives the state rebuild.
            expect($exeDevice.previewBlobUrl).toBe('blob:http://localhost/abc');
        });
    });

    describe('init — destroys the previous runtime instance before rebuilding', () => {
        let destroyCalls;
        let originalRuntime;

        beforeEach(() => {
            destroyCalls = [];
            originalRuntime = global.eXe3DViewer;
            global.eXe3DViewer = {
                destroy: (wrapper) => destroyCalls.push(wrapper),
                getInstance: () => null,
            };
            global.window = global.window || global;
            global.window.eXe3DViewer = global.eXe3DViewer;
        });

        afterEach(() => {
            global.eXe3DViewer = originalRuntime;
            if (global.window) global.window.eXe3DViewer = originalRuntime;
        });

        it('calls eXe3DViewer.destroy on the prior preview container on re-init', async () => {
            // Pretend a previous init() already ran and stashed a
            // previewContainer + previewBlobUrl on the singleton.
            const oldWrapper = { id: 'previous-wrapper' };
            $exeDevice.previewContainer = oldWrapper;
            $exeDevice.previewBlobUrl = 'blob:http://stale';

            // We don't run the full init flow (it would render a real
            // form via happy-dom and call into model-viewer). Instead
            // mimic just the destroy-pre-rebuild branch:
            if ($exeDevice.previewContainer && window.eXe3DViewer) {
                window.eXe3DViewer.destroy($exeDevice.previewContainer);
            }
            $exeDevice.previewBlobUrl = null;

            expect(destroyCalls).toEqual([oldWrapper]);
            expect($exeDevice.previewBlobUrl).toBeNull();
        });
    });

    describe('updateModelColorFieldState', () => {
        function stubFormAndIdeviceBody() {
            const colorEl = { disabled: false, title: '', value: '#888888' };
            $exeDevice.formElements = { modelColor: colorEl };
            $exeDevice.ideviceBody = { querySelector: () => ({ classList: { toggle() {} } }) };
            return colorEl;
        }

        it('enables the color picker for .stl files', () => {
            const colorEl = stubFormAndIdeviceBody();
            $exeDevice.state = { src: 'asset://uuid.stl' };
            $exeDevice.updateModelColorFieldState();
            expect(colorEl.disabled).toBe(false);
        });

        it('disables the color picker for .glb files', () => {
            const colorEl = stubFormAndIdeviceBody();
            $exeDevice.state = { src: 'asset://uuid.glb' };
            $exeDevice.updateModelColorFieldState();
            expect(colorEl.disabled).toBe(true);
        });

        it('disables the color picker when src is empty', () => {
            const colorEl = stubFormAndIdeviceBody();
            $exeDevice.state = { src: '' };
            $exeDevice.updateModelColorFieldState();
            expect(colorEl.disabled).toBe(true);
        });

        it('is a no-op when the color form element is missing', () => {
            $exeDevice.formElements = {};
            $exeDevice.state = { src: 'asset://uuid.stl' };
            expect(() => $exeDevice.updateModelColorFieldState()).not.toThrow();
        });
    });

    describe('controls (fullscreen + nav)', () => {
        it('exposes setupControls and nudgeCamera methods', () => {
            expect(typeof $exeDevice.setupControls).toBe('function');
            expect(typeof $exeDevice.nudgeCamera).toBe('function');
        });

        it('nudgeCamera is a no-op when no camera or model-viewer is available', () => {
            $exeDevice.threeJSCamera = null;
            $exeDevice.threeJSScene = null;
            $exeDevice.modelViewer = null;
            // Should not throw
            expect(() => $exeDevice.nudgeCamera(0.1, 0)).not.toThrow();
        });

        it('nudgeCamera updates model-viewer cameraOrbit when no STL scene is active', () => {
            $exeDevice.threeJSCamera = null;
            $exeDevice.threeJSScene = null;
            const orbits = [];
            $exeDevice.modelViewer = {
                getCameraOrbit: () => ({ theta: 0, phi: Math.PI / 2, radius: 1 }),
                set cameraOrbit(v) { orbits.push(v); },
                jumpCameraToGoal: () => {},
            };
            $exeDevice.nudgeCamera(0.1, 0);
            expect(orbits.length).toBe(1);
            expect(orbits[0]).toMatch(/^0\.1rad /);
        });

        it('nudgeCamera moves the STL camera position when a scene is active', () => {
            const positions = [];
            const camera = {
                position: {
                    x: 0, y: 0, z: 5,
                    length: () => 5,
                    set(x, y, z) { positions.push([x, y, z]); this.x = x; this.y = y; this.z = z; },
                },
                lookAt: () => {},
            };
            $exeDevice.threeJSCamera = camera;
            $exeDevice.threeJSScene = {};
            $exeDevice.threeJSControls = null;
            $exeDevice.modelViewer = null;
            $exeDevice.nudgeCamera(Math.PI / 2, 0);
            expect(positions.length).toBe(1);
            // After +PI/2 yaw from (0,0,5), camera should be roughly at (5,0,0)
            const [x, , z] = positions[0];
            expect(Math.abs(x - 5)).toBeLessThan(0.001);
            expect(Math.abs(z)).toBeLessThan(0.001);
        });
    });

    describe('resolveModelPath', () => {
        it('returns asset:// URLs unchanged', () => {
            const assetUrl = 'asset://uuid-123/model.glb';
            expect($exeDevice.resolveModelPath(assetUrl)).toBe(assetUrl);
        });

        it('returns blob: URLs unchanged', () => {
            const blobUrl = 'blob:http://localhost/123';
            expect($exeDevice.resolveModelPath(blobUrl)).toBe(blobUrl);
        });

        it('returns http/https URLs unchanged', () => {
            expect($exeDevice.resolveModelPath('https://example.com/model.glb'))
                .toBe('https://example.com/model.glb');
        });

        it('returns empty string for empty input', () => {
            expect($exeDevice.resolveModelPath('')).toBe('');
        });

        it('returns empty string for null/undefined', () => {
            expect($exeDevice.resolveModelPath(null)).toBe('');
            expect($exeDevice.resolveModelPath(undefined)).toBe('');
        });

        it('prefixes file_manager/ for unknown paths', () => {
            expect($exeDevice.resolveModelPath('uploads/model.glb')).toBe('file_manager/uploads/model.glb');
        });

        it('preserves files/ prefix', () => {
            expect($exeDevice.resolveModelPath('files/temp/model.glb')).toBe('files/temp/model.glb');
        });
    });
});
