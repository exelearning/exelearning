/**
 * Unit tests for three-d-viewer iDevice (export)
 *
 * Tests the path resolution functions used in export/preview contexts:
 * - detectMode: Detects current execution environment (static, server, export, preview)
 * - getModelViewerLibUrl: Returns URL for model-viewer library based on mode
 * - getThreeJSBaseUrl: Returns base URL for Three.js modules with absolute URLs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load the export iDevice file and return the $threedviewer object.
 * The export script uses an IIFE that attaches to globalScope.$threedviewer.
 */
function loadExportIdevice(code) {
    // Execute the IIFE in global context
    // eslint-disable-next-line no-eval
    (0, eval)(code);
    return global.$threedviewer;
}

describe('three-d-viewer iDevice (export)', () => {
    let $threedviewer;
    let originalGlobals;

    beforeEach(() => {
        // Save original global state
        originalGlobals = {
            eXeLearning: global.eXeLearning,
            location: global.location,
            document: global.document,
            $threedviewer: global.$threedviewer,
            $exeLibs: global.$exeLibs,
        };

        // Reset globals
        global.$threedviewer = undefined;
        global.$exeLibs = undefined;

        // Mock window.location
        global.location = {
            origin: 'http://localhost:8080',
            protocol: 'http:',
            host: 'localhost:8080',
            href: 'http://localhost:8080/viewer/index.html',
        };

        // Mock minimal eXeLearning structure
        global.eXeLearning = {
            config: null,
            symfony: {},
            app: {
                project: {},
            },
        };

        // Mock minimal document
        global.document = {
            documentElement: { id: '' },
            createElement: (tag) => ({
                tagName: tag.toUpperCase(),
                setAttribute: () => {},
                getAttribute: () => null,
                removeAttribute: () => {},
                style: {},
                addEventListener: () => {},
            }),
            head: { appendChild: () => {} },
            querySelector: () => null,
        };

        // Mock customElements
        global.customElements = {
            get: () => undefined,
            whenDefined: () => Promise.resolve(),
        };

        // Mock _ function for translations
        global._ = (s) => s;

        // Read and execute the iDevice file
        const filePath = join(__dirname, 'three-d-viewer.js');
        const code = readFileSync(filePath, 'utf-8');

        // Load iDevice and get reference
        $threedviewer = loadExportIdevice(code);
    });

    afterEach(() => {
        // Restore original global state
        global.eXeLearning = originalGlobals.eXeLearning;
        global.location = originalGlobals.location;
        global.document = originalGlobals.document;
        global.$threedviewer = originalGlobals.$threedviewer;
        global.$exeLibs = originalGlobals.$exeLibs;
    });

    describe('$threedviewer object', () => {
        it('is defined', () => {
            expect($threedviewer).toBeDefined();
        });

        it('has renderView function', () => {
            expect(typeof $threedviewer.renderView).toBe('function');
        });

        it('has renderBehaviour function', () => {
            expect(typeof $threedviewer.renderBehaviour).toBe('function');
        });

        it('has init function', () => {
            expect(typeof $threedviewer.init).toBe('function');
        });

        it('exposes getModelViewerLibUrl for debugging', () => {
            expect(typeof $threedviewer.getModelViewerLibUrl).toBe('function');
        });
    });

    describe('getModelViewerLibUrl', () => {
        const modelViewerFile = 'model-viewer.min.js';

        describe('static mode', () => {
            beforeEach(() => {
                global.eXeLearning.config = { isStaticMode: true };
            });

            it('returns relative path for static mode', () => {
                const url = $threedviewer.getModelViewerLibUrl();

                expect(url).toBe(`./files/perm/idevices/base/three-d-viewer/export/${modelViewerFile}`);
            });

            it('also triggers for isOfflineInstallation', () => {
                global.eXeLearning.config = { isOfflineInstallation: true };

                const url = $threedviewer.getModelViewerLibUrl();

                expect(url).toBe(`./files/perm/idevices/base/three-d-viewer/export/${modelViewerFile}`);
            });
        });

        describe('server mode', () => {
            it('returns resolved URL for server mode', () => {
                global.eXeLearning.config = { baseURL: 'https://example.com' };
                global.eXeLearning.symfony = { baseURL: 'https://example.com', basePath: '' };

                const url = $threedviewer.getModelViewerLibUrl();

                expect(url).toContain('files/perm/idevices/base/three-d-viewer/export/' + modelViewerFile);
            });

            it('includes basePath in resolved URL', () => {
                global.eXeLearning.config = { baseURL: 'https://example.com', basePath: 'myapp' };
                global.eXeLearning.symfony = { baseURL: 'https://example.com', basePath: 'myapp' };

                const url = $threedviewer.getModelViewerLibUrl();

                expect(url).toContain('myapp');
                expect(url).toContain(modelViewerFile);
            });
        });

        describe('export mode', () => {
            beforeEach(() => {
                // No config = not static or server mode
                global.eXeLearning.config = null;
            });

            it('returns ./idevices/ path on index page', () => {
                global.document.documentElement.id = 'exe-index';

                const url = $threedviewer.getModelViewerLibUrl();

                expect(url).toBe(`./idevices/three-d-viewer/${modelViewerFile}`);
            });

            it('returns ../idevices/ path on subpage', () => {
                global.document.documentElement.id = 'exe-page1';
                global.document.querySelector = (selector) => {
                    if (selector === 'html[id^="exe-"]') {
                        return { id: 'exe-page1' };
                    }
                    return null;
                };

                const url = $threedviewer.getModelViewerLibUrl();

                expect(url).toBe(`../idevices/three-d-viewer/${modelViewerFile}`);
            });
        });

        describe('fallback mode', () => {
            it('uses symfony config when no mode detected', () => {
                global.eXeLearning.config = null;
                global.document.documentElement.id = '';
                global.eXeLearning.symfony = { baseURL: 'https://fallback.com', basePath: '' };

                const url = $threedviewer.getModelViewerLibUrl();

                expect(url).toContain('https://fallback.com');
                expect(url).toContain(modelViewerFile);
            });
        });
    });

    describe('renderView', () => {
        it('returns HTML with model-viewer element', () => {
            const data = {
                src: 'model.glb',
                alt: 'Test model',
                backgroundColor: '#ffffff',
            };

            const html = $threedviewer.renderView(data, {}, '{content}');

            expect(html).toContain('model-viewer');
            expect(html).toContain('three-d-viewer-wrapper');
        });

        it('omits fullscreen + nav controls when showNavControls is false (default)', () => {
            const html = $threedviewer.renderView({ src: 'model.glb' }, {}, '{content}');

            expect(html).not.toContain('three-d-viewer-fullscreen-button');
            expect(html).not.toContain('data-nav="left"');
        });

        it('renders fullscreen + 4-direction nav pad when showNavControls is true', () => {
            const html = $threedviewer.renderView(
                { src: 'model.glb', showNavControls: true },
                {},
                '{content}',
            );

            expect(html).toContain('three-d-viewer-fullscreen-button');
            expect(html).toContain('data-fullscreen');
            expect(html).toContain('data-nav="left"');
            expect(html).toContain('data-nav="right"');
            expect(html).toContain('data-nav="up"');
            expect(html).toContain('data-nav="down"');
        });

        it('disables auto-rotate automatically when showNavControls is true', () => {
            const html = $threedviewer.renderView(
                { src: 'model.glb', showNavControls: true, autoRotate: true },
                {},
                '{content}',
            );

            // The <model-viewer> element must not carry the `auto-rotate`
            // attribute, and the wrapper's flat data-auto-rotate must be
            // "false" because showNavControls wins the mutex.
            expect(html).not.toMatch(/<model-viewer[^>]*\sauto-rotate(\s|>)/);
            expect(html).toContain('data-auto-rotate="false"');
            expect(html).toContain('data-show-nav-controls="true"');
        });

        it('includes alt text in aria-label', () => {
            const data = {
                src: 'model.glb',
                alt: 'A 3D cube',
            };

            const html = $threedviewer.renderView(data, {}, '{content}');

            expect(html).toContain('aria-label="A 3D cube"');
        });

        it('includes camera-controls by default', () => {
            const data = { src: 'model.glb' };

            const html = $threedviewer.renderView(data, {}, '{content}');

            expect(html).toContain('camera-controls');
        });

        it('excludes camera-controls when disabled', () => {
            const data = {
                src: 'model.glb',
                cameraControls: false,
            };

            const html = $threedviewer.renderView(data, {}, '{content}');

            // The <model-viewer> element must not carry the attribute;
            // the wrapper's `data-camera-controls` should be "false".
            expect(html).not.toMatch(/<model-viewer[^>]*\scamera-controls(\s|>)/);
            expect(html).toContain('data-camera-controls="false"');
        });

        it('includes auto-rotate by default', () => {
            const data = { src: 'model.glb' };

            const html = $threedviewer.renderView(data, {}, '{content}');

            expect(html).toContain('auto-rotate');
        });

        it('includes rotation speed', () => {
            const data = {
                src: 'model.glb',
                autoRotate: true,
                autoRotateSpeed: 45,
            };

            const html = $threedviewer.renderView(data, {}, '{content}');

            expect(html).toContain('rotation-per-second="45deg"');
        });

        it('sets background color style', () => {
            const data = {
                src: 'model.glb',
                backgroundColor: '#ff0000',
            };

            const html = $threedviewer.renderView(data, {}, '{content}');

            expect(html).toContain('background-color: #ff0000');
        });

        it('emits flat data-* attributes (no base64 data-config envelope)', () => {
            const data = {
                src: 'asset://uuid-123.glb',
                ideviceId: 'test-id',
                modelColor: '#abcdef',
                backgroundColor: '#ffffff',
                cameraControls: false,
                autoRotate: false,
                autoRotateSpeed: 45,
                animation: { enabled: true, name: 'spin', speed: 1.5 },
            };

            const html = $threedviewer.renderView(data, {}, '{content}');

            // No more opaque base64 envelope.
            expect(html).not.toContain('data-config="');
            // Canonical source lives in a flat attribute; asset:// is
            // preserved here and is what the export pipeline rewrites
            // to content/resources/...
            expect(html).toContain('data-model-src="asset://uuid-123.glb"');
            // Canonical AssetManager reference survives the global
            // asset:// regex rewrite (no `asset://` prefix in its value).
            expect(html).toContain('data-model-asset-ref="uuid-123.glb"');
            expect(html).toContain('data-model-type="glb"');
            expect(html).toContain('data-model-color="#abcdef"');
            expect(html).toContain('data-background-color="#ffffff"');
            expect(html).toContain('data-camera-controls="false"');
            expect(html).toContain('data-auto-rotate="false"');
            expect(html).toContain('data-auto-rotate-speed="45"');
            expect(html).toContain('data-animation-enabled="true"');
            expect(html).toContain('data-animation-name="spin"');
            expect(html).toContain('data-animation-speed="1.5"');
        });

        it('omits data-model-asset-ref when src is not an asset:// URL', () => {
            const html = $threedviewer.renderView(
                { src: 'content/resources/cube.glb' },
                {},
                '{content}',
            );
            expect(html).not.toContain('data-model-asset-ref=');
            expect(html).toContain('data-model-src="content/resources/cube.glb"');
        });

        it('recovers data-model-asset-ref from a blob: URL via AssetManager.reverseBlobCache', () => {
            // The workarea engine resolves asset:// → blob: before
            // passing the iDevice JSON to renderView. Without a
            // recovery step the wrapper would carry only a blob URL
            // and the runtime would lose the canonical AssetManager
            // handle on every reload / page-change.
            const reverseBlobCache = new Map();
            reverseBlobCache.set('blob:http://localhost/abc-123', 'asset-uuid-1');
            global.eXeLearning.app.project.assetManager = {
                reverseBlobCache,
                getAssetMetadata: (id) =>
                    id === 'asset-uuid-1' ? { filename: 'cali-bee.stl' } : null,
            };
            const html = $threedviewer.renderView(
                { src: 'blob:http://localhost/abc-123' },
                {},
                '{content}',
            );
            expect(html).toContain('data-model-asset-ref="asset-uuid-1.stl"');
            expect(html).toContain('data-model-type="stl"');
            delete global.eXeLearning.app.project.assetManager;
        });

        it('emits <model-viewer> without a src attribute (runtime owns it)', () => {
            const html = $threedviewer.renderView(
                { src: 'asset://uuid.glb' },
                {},
                '{content}',
            );
            expect(html).toMatch(/<model-viewer\s/);
            expect(html).not.toMatch(/<model-viewer[^>]*\ssrc=/);
        });

        it('handles empty data gracefully', () => {
            const html = $threedviewer.renderView({}, {}, '{content}');

            expect(html).toContain('model-viewer');
            expect(html).toContain('three-d-viewer-wrapper');
        });

        it('handles null data', () => {
            const html = $threedviewer.renderView(null, {}, '{content}');

            expect(html).toContain('model-viewer');
        });
    });

    describe('ThreeDViewerExportObject', () => {
        it('is defined globally', () => {
            expect(global.ThreeDViewerExportObject).toBeDefined();
        });

        it('has init method', () => {
            const helper = new global.ThreeDViewerExportObject();
            expect(typeof helper.init).toBe('function');
        });

        it('has toJSON method', () => {
            const helper = new global.ThreeDViewerExportObject();
            expect(typeof helper.toJSON).toBe('function');
        });

        it('has fromJSON method', () => {
            const helper = new global.ThreeDViewerExportObject();
            expect(typeof helper.fromJSON).toBe('function');
        });

        it('init returns true', () => {
            const helper = new global.ThreeDViewerExportObject();
            expect(helper.init({}, null)).toBe(true);
        });

        it('toJSON returns empty object when no node', () => {
            const helper = new global.ThreeDViewerExportObject();
            helper.init(null, null);
            expect(helper.toJSON()).toEqual({});
        });
    });

    describe('isSTLFile detection', () => {
        it('renderView processes STL files', () => {
            const data = {
                src: 'model.stl',
                alt: 'STL model',
            };

            // Should not throw, STL handling is done at runtime
            const html = $threedviewer.renderView(data, {}, '{content}');
            expect(html).toContain('model-viewer');
        });
    });

    describe('asset:// URL handling', () => {
        it('renderView accepts asset:// URLs', () => {
            const data = {
                src: 'asset://uuid-123/model.glb',
                alt: 'Asset model',
            };

            const html = $threedviewer.renderView(data, {}, '{content}');
            expect(html).toContain('model-viewer');
        });
    });
});

/**
 * Tests for internal helper functions (accessed via module internals)
 * These test the mode detection and URL resolution logic indirectly
 * through the public API.
 */
describe('three-d-viewer mode detection (integration)', () => {
    let originalGlobals;

    beforeEach(() => {
        originalGlobals = {
            eXeLearning: global.eXeLearning,
            location: global.location,
            document: global.document,
            $threedviewer: global.$threedviewer,
            $exeLibs: global.$exeLibs,
        };

        global.$threedviewer = undefined;
        global.$exeLibs = undefined;

        global.location = {
            origin: 'http://localhost:8080',
            protocol: 'http:',
            host: 'localhost:8080',
            href: 'http://localhost:8080/export/index.html',
        };

        global.eXeLearning = {
            config: null,
            symfony: {},
            app: { project: {} },
        };

        global.document = {
            documentElement: { id: '' },
            createElement: () => ({ setAttribute: () => {}, style: {}, addEventListener: () => {} }),
            head: { appendChild: () => {} },
            querySelector: () => null,
        };

        global.customElements = { get: () => undefined, whenDefined: () => Promise.resolve() };
        global._ = (s) => s;
    });

    afterEach(() => {
        global.eXeLearning = originalGlobals.eXeLearning;
        global.location = originalGlobals.location;
        global.document = originalGlobals.document;
        global.$threedviewer = originalGlobals.$threedviewer;
        global.$exeLibs = originalGlobals.$exeLibs;
    });

    function loadAndGetUrl() {
        const filePath = join(__dirname, 'three-d-viewer.js');
        const code = readFileSync(filePath, 'utf-8');
        // eslint-disable-next-line no-eval
        (0, eval)(code);
        return global.$threedviewer.getModelViewerLibUrl();
    }

    it('detects static mode via isStaticMode config', () => {
        global.eXeLearning.config = { isStaticMode: true };

        const url = loadAndGetUrl();

        expect(url).toMatch(/^\.\//);
    });

    it('detects static mode via isOfflineInstallation config', () => {
        global.eXeLearning.config = { isOfflineInstallation: true };

        const url = loadAndGetUrl();

        expect(url).toMatch(/^\.\//);
    });

    it('detects static mode from JSON string config', () => {
        global.eXeLearning.config = JSON.stringify({ isStaticMode: true });

        const url = loadAndGetUrl();

        expect(url).toMatch(/^\.\//);
    });

    it('detects server mode when baseURL is defined', () => {
        global.eXeLearning.config = { baseURL: 'https://server.com' };
        global.eXeLearning.symfony = { baseURL: 'https://server.com' };

        const url = loadAndGetUrl();

        expect(url).toContain('server.com');
    });

    it('detects export mode on index page via html id', () => {
        global.eXeLearning.config = null;
        global.document.documentElement.id = 'exe-index';

        const url = loadAndGetUrl();

        expect(url).toBe('./idevices/three-d-viewer/model-viewer.min.js');
    });

    it('detects export mode on subpage via html id', () => {
        global.eXeLearning.config = null;
        global.document.documentElement.id = 'exe-page-abc';
        global.document.querySelector = (sel) => {
            if (sel === 'html[id^="exe-"]') return { id: 'exe-page-abc' };
            return null;
        };

        const url = loadAndGetUrl();

        expect(url).toBe('../idevices/three-d-viewer/model-viewer.min.js');
    });
});

// Issue #1810 follow-up: the old base64 `data-config` envelope hid the
// canonical `asset://uuid.ext` URL from the exporter's URL rewriter,
// forcing a dual-source kludge inside `resolveBootConfig`. The refactor
// drops base64 entirely — `data-model-src` is a flat attribute that
// IdeviceRenderer.fixAssetUrls rewrites just like every other asset
// reference. The behaviour these tests cover splits into:
//
//   1. resolveBootConfig: reads flat data-* attrs only
//   2. migrateLegacyConfig: upgrades persisted base64 wrappers in place
//      so existing projects keep working without a save round-trip.
describe('three-d-viewer iDevice (export) — resolveBootConfig & legacy migration', () => {
    let $threedviewer;
    let originalLocation;

    beforeEach(() => {
        originalLocation = global.location;
        global.location = {
            origin: 'http://127.0.0.1:8081',
            protocol: 'http:',
            host: '127.0.0.1:8081',
            href: 'http://127.0.0.1:8081/index.html',
        };
        global.eXeLearning = { config: null, symfony: {}, app: { project: {} } };
        global._ = (s) => s;
        global.$threedviewer = undefined;
        global.customElements = global.customElements || { get: () => undefined, whenDefined: () => Promise.resolve() };

        const code = readFileSync(join(__dirname, 'three-d-viewer.js'), 'utf-8');
        // eslint-disable-next-line no-eval
        (0, eval)(code);
        $threedviewer = global.$threedviewer;
    });

    afterEach(() => {
        global.location = originalLocation;
    });

    function makeFlatWrapper(attrs) {
        document.body.innerHTML = '<div></div>';
        const wrapper = document.querySelector('div');
        wrapper.className = 'three-d-viewer-wrapper';
        wrapper.dataset.threeD = '';
        Object.entries(attrs).forEach(([k, v]) => { wrapper.dataset[k] = v; });
        return wrapper;
    }

    function makeLegacyBase64Wrapper(cfg) {
        const encoded = btoa(JSON.stringify(cfg));
        document.body.innerHTML = `
            <div id="legacy-node">
                <div class="three-d-viewer-wrapper" data-three-d id="legacy"
                     data-config="${encoded}"></div>
            </div>`;
        return document.querySelector('.three-d-viewer-wrapper');
    }

    // -- resolveBootConfig --------------------------------------------

    it('exposes resolveBootConfig() on the public namespace', () => {
        expect(typeof $threedviewer.resolveBootConfig).toBe('function');
    });

    it('reads canonical asset:// from data-model-src (preview context)', () => {
        const uuid = '436bf925-79a1-6762-6713-a6fcbb0dca08';
        const wrapper = makeFlatWrapper({
            modelSrc: `asset://${uuid}.stl`,
            modelType: 'stl',
            modelColor: '#ff0000',
        });
        const resolved = $threedviewer.resolveBootConfig({}, wrapper);
        expect(resolved.src).toBe(`asset://${uuid}.stl`);
        expect(resolved.type).toBe('stl');
        expect(resolved.modelColor).toBe('#ff0000');
    });

    it('reads exporter-rewritten path from data-model-src (static export)', () => {
        // After `IdeviceRenderer.fixAssetUrls` runs on export, the
        // wrapper's data-model-src is the relative content/resources path,
        // not asset://. The runtime reads it transparently.
        const wrapper = makeFlatWrapper({
            modelSrc: 'content/resources/model.stl',
            modelType: 'stl',
        });
        const resolved = $threedviewer.resolveBootConfig({}, wrapper);
        expect(resolved.src).toBe('content/resources/model.stl');
        expect(resolved.type).toBe('stl');
    });

    it('passes absolute https URLs through unchanged', () => {
        const wrapper = makeFlatWrapper({
            modelSrc: 'https://example.com/cdn/model.glb',
        });
        const resolved = $threedviewer.resolveBootConfig({}, wrapper);
        expect(resolved.src).toBe('https://example.com/cdn/model.glb');
        expect(resolved.type).toBe('glb');
    });

    it('passes through blob: URLs as runtime sources (workarea engine sets them)', () => {
        // The workarea's asset resolver substitutes asset:// → blob:
        // when reading the iDevice JSON, so by the time renderView /
        // resolveBootConfig sees the wrapper, data-model-src holds a
        // live blob URL. The runtime can fetch the blob directly; we
        // only need to refuse `data:` URLs (would never round-trip).
        const wrapper = makeFlatWrapper({
            modelSrc: 'blob:http://localhost/abc',
        });
        const resolved = $threedviewer.resolveBootConfig({}, wrapper);
        expect(resolved.src).toBe('blob:http://localhost/abc');
    });

    it('strips data: URLs (they would never round-trip)', () => {
        const wrapper = makeFlatWrapper({
            modelSrc: 'data:model/gltf-binary;base64,AAA=',
        });
        const resolved = $threedviewer.resolveBootConfig({}, wrapper);
        expect(resolved.src).toBe('');
    });

    it('applies safe defaults when most attrs are missing', () => {
        const wrapper = makeFlatWrapper({ modelSrc: 'asset://x.glb' });
        const resolved = $threedviewer.resolveBootConfig({}, wrapper);
        expect(resolved.modelColor).toBe('#888888');
        expect(resolved.backgroundColor).toBe('#f5f5f5');
        expect(resolved.cameraControls).toBe(true);
        expect(resolved.autoRotate).toBe(true);
        expect(resolved.autoRotateSpeed).toBe(30);
        expect(resolved.showNavControls).toBe(false);
        expect(resolved.animation).toEqual({ enabled: false, name: '', speed: 1 });
    });

    it('respects the mutex: showNavControls=true forces autoRotate=false', () => {
        const wrapper = makeFlatWrapper({
            modelSrc: 'asset://x.glb',
            showNavControls: 'true',
            autoRotate: 'true',
        });
        const resolved = $threedviewer.resolveBootConfig({}, wrapper);
        expect(resolved.showNavControls).toBe(true);
        expect(resolved.autoRotate).toBe(false);
    });

    it('returns an empty object for a null wrapper', () => {
        expect($threedviewer.resolveBootConfig({}, null)).toEqual({});
    });

    // -- migrateLegacyConfig -----------------------------------------

    it('migrateLegacyConfig upgrades base64 data-config to flat attrs', () => {
        const uuid = '436bf925-79a1-6762-6713-a6fcbb0dca08';
        const wrapper = makeLegacyBase64Wrapper({
            src: `asset://${uuid}.stl`,
            alt: 'A cube',
            backgroundColor: '#222222',
            cameraControls: false,
            autoRotate: false,
            autoRotateSpeed: 45,
            showNavControls: true,
            animation: { enabled: true, name: 'spin', speed: 0.5 },
        });
        expect(wrapper.hasAttribute('data-config')).toBe(true);

        $threedviewer.__migrateLegacyConfig(wrapper);

        expect(wrapper.hasAttribute('data-config')).toBe(false);
        expect(wrapper.dataset.modelSrc).toBe(`asset://${uuid}.stl`);
        expect(wrapper.dataset.modelType).toBe('stl');
        expect(wrapper.dataset.modelColor).toBe('#888888');
        expect(wrapper.dataset.alt).toBe('A cube');
        expect(wrapper.dataset.backgroundColor).toBe('#222222');
        expect(wrapper.dataset.cameraControls).toBe('false');
        expect(wrapper.dataset.autoRotate).toBe('false');
        expect(wrapper.dataset.autoRotateSpeed).toBe('45');
        expect(wrapper.dataset.showNavControls).toBe('true');
        expect(wrapper.dataset.animationEnabled).toBe('true');
        expect(wrapper.dataset.animationName).toBe('spin');
        expect(wrapper.dataset.animationSpeed).toBe('0.5');
    });

    it('migrateLegacyConfig is a no-op when there is no data-config', () => {
        const wrapper = makeFlatWrapper({ modelSrc: 'asset://x.glb' });
        // Snapshot dataset keys so we can confirm none were added.
        const before = { ...wrapper.dataset };
        $threedviewer.__migrateLegacyConfig(wrapper);
        expect({ ...wrapper.dataset }).toEqual(before);
    });

    it('migrateLegacyConfig preserves existing flat attrs (idempotent)', () => {
        const wrapper = makeLegacyBase64Wrapper({ src: 'asset://old.stl' });
        wrapper.dataset.modelSrc = 'asset://new.stl';
        $threedviewer.__migrateLegacyConfig(wrapper);
        expect(wrapper.dataset.modelSrc).toBe('asset://new.stl');
        expect(wrapper.hasAttribute('data-config')).toBe(false);
    });

    // -- resolveRuntimeSrc: preview-iframe path fix --------------------

    it('resolveRuntimeSrc keeps content/resources/... paths relative', () => {
        // Bug: if the helper prepended a leading slash (via resolveAssetUrl),
        // the preview iframe at /viewer/index.html would request
        // /content/resources/foo.stl (root) instead of
        // /viewer/content/resources/foo.stl (where the SW intercepts),
        // and STLLoader would parse the 404 HTML response, throwing
        // "Invalid typed array length".
        const resolved = $threedviewer.__resolveRuntimeSrc('content/resources/cali-bee.stl');
        expect(resolved).toBe('content/resources/cali-bee.stl');
        expect(resolved.startsWith('/')).toBe(false);
    });

    it('resolveRuntimeSrc keeps ../content/resources/... paths relative', () => {
        // Subpage in html/ folder: exporter writes ../content/resources/...
        // Same logic — return it untouched so the browser does relative
        // resolution against the page URL.
        const resolved = $threedviewer.__resolveRuntimeSrc('../content/resources/cali-bee.stl');
        expect(resolved).toBe('../content/resources/cali-bee.stl');
    });

    // -- data-model-asset-ref: workarea / preview-with-AssetManager fix --

    it('resolveBootConfig prefers asset-ref when AssetManager is live', () => {
        // Simulate workarea view: AssetManager present, and the wrapper
        // already has its data-model-src rewritten by fixAssetUrls. The
        // canonical asset:// URL must be recovered from
        // data-model-asset-ref so AssetManager can serve the blob.
        global.eXeLearning.app.project.assetManager = {
            resolveAssetURLSync: () => 'blob:fake',
            resolveAssetURL: async () => 'blob:fake',
        };
        const wrapper = makeFlatWrapper({
            modelSrc: 'content/resources/cali-bee.stl',
            modelAssetRef: 'uuid-123.stl',
            modelType: 'stl',
            modelColor: '#ff0000',
        });
        const resolved = $threedviewer.resolveBootConfig({}, wrapper);
        expect(resolved.src).toBe('asset://uuid-123.stl');
        expect(resolved.modelColor).toBe('#ff0000');
        delete global.eXeLearning.app.project.assetManager;
    });

    it('resolveBootConfig falls back to data-model-src when no AssetManager (static export)', () => {
        const wrapper = makeFlatWrapper({
            modelSrc: 'content/resources/cali-bee.stl',
            modelAssetRef: 'uuid-123.stl',
            modelType: 'stl',
        });
        // No AssetManager → static export context → use the rewritten path
        const resolved = $threedviewer.resolveBootConfig({}, wrapper);
        expect(resolved.src).toBe('content/resources/cali-bee.stl');
    });
});

// Regression for issue #1810 follow-up: <model-viewer> cannot parse STL files.
// model-viewer dispatches its src URL to the GLB/GLTF/USDZ loaders; feeding it
// an ASCII STL produces `SyntaxError: Unexpected token 'C', "COLOR= "... is not
// valid JSON` (the "COLOR=" tokens at the start of the binary STL header).
// STL files must therefore NOT appear in the <model-viewer src=…> attribute —
// the Three.js / STLLoader path renders them on its own <canvas>.
describe('three-d-viewer renderView — STL must not be passed to <model-viewer>', () => {
    let $threedviewer;
    beforeEach(() => {
        global.eXeLearning = { config: null, symfony: {}, app: { project: {} } };
        global._ = (s) => s;
        global.$threedviewer = undefined;
        global.customElements = global.customElements || { get: () => undefined, whenDefined: () => Promise.resolve() };
        const code = readFileSync(join(__dirname, 'three-d-viewer.js'), 'utf-8');
        // eslint-disable-next-line no-eval
        (0, eval)(code);
        $threedviewer = global.$threedviewer;
    });

    it('omits the src attribute when the file is an STL (model-viewer would mis-parse it)', () => {
        const html = $threedviewer.renderView(
            { src: 'content/resources/model.stl' },
            {},
            '{content}',
        );
        // The <model-viewer> element is still emitted (it acts as the visible
        // host the runtime can resize), but it MUST NOT have an `src` pointing
        // at the STL — otherwise the GLTF/GLB loader inside model-viewer fetches
        // the file and chokes on the ASCII STL header.
        expect(html).toContain('<model-viewer');
        expect(html).not.toMatch(/<model-viewer[^>]*\ssrc="[^"]*\.stl"/);
    });

    it('does NOT bake a src into <model-viewer> for GLB / GLTF (runtime owns it)', () => {
        // Refactor change: the runtime now sets `mv.src` at boot from the
        // wrapper's `data-model-src`. Baking it into the markup would
        // leak blob: URLs into persisted HTML and complicate the static
        // export URL rewrite.
        const glb = $threedviewer.renderView({ src: 'content/resources/cube.glb' }, {}, '{content}');
        expect(glb).not.toMatch(/<model-viewer[^>]*\ssrc=/);
        expect(glb).toContain('data-model-src="content/resources/cube.glb"');
        expect(glb).toContain('data-model-type="glb"');

        const gltf = $threedviewer.renderView({ src: 'content/resources/cube.gltf' }, {}, '{content}');
        expect(gltf).not.toMatch(/<model-viewer[^>]*\ssrc=/);
        expect(gltf).toContain('data-model-src="content/resources/cube.gltf"');
        expect(gltf).toContain('data-model-type="gltf"');
    });

    it('omits src for STL even when the URL is an asset:// reference', () => {
        const html = $threedviewer.renderView(
            { src: 'asset://436bf925-79a1-6762-6713-a6fcbb0dca08.stl' },
            {},
            '{content}',
        );
        // Whether the resolver leaves the asset:// URL or converts it, the
        // model-viewer tag must still not receive a .stl src attribute.
        expect(html).not.toMatch(/<model-viewer[^>]*\ssrc="[^"]*\.stl"/);
        expect(html).not.toMatch(/<model-viewer[^>]*\ssrc="asset:\/\/[^"]+\.stl"/);
    });
});

// Regression #1810 continuation: persisted HTML produced by the old renderView
// still carries `<model-viewer src="asset://<uuid>.stl">`. Even after the
// renderView fix lands, projects saved before the fix continue to ship that
// stale attribute, and as soon as the model-viewer custom element activates
// it fetches the URL and throws the "COLOR= not valid JSON" error.
//
// renderBehaviour must therefore strip the `src` attribute from every
// `<model-viewer>` inside an STL wrapper BEFORE `ensureModelViewerModule()`
// loads the custom element definition (the upgrade is what triggers the
// fetch). The Three.js / STLLoader path then draws on its own <canvas>.
describe('three-d-viewer renderBehaviour — strips stale model-viewer src for STL', () => {
    let $threedviewer;
    beforeEach(() => {
        global.eXeLearning = { config: null, symfony: {}, app: { project: {} } };
        global._ = (s) => s;
        global.$threedviewer = undefined;
        global.customElements = { get: () => undefined, whenDefined: () => Promise.resolve() };
        const code = readFileSync(join(__dirname, 'three-d-viewer.js'), 'utf-8');
        // eslint-disable-next-line no-eval
        (0, eval)(code);
        $threedviewer = global.$threedviewer;
    });

    function makeIdeviceWithStaleSrc(modelViewerSrcAttr, configSrc) {
        const ideviceId = 'three-d-viewer-stl-strip';
        document.body.innerHTML = `
            <div id="${ideviceId}-node"
                 class="idevice_node three-d-viewer"
                 data-idevice-type="three-d-viewer"
                 data-idevice-component-type="json"
                 data-idevice-json-data="${JSON.stringify({ src: configSrc }).replace(/"/g, '&quot;')}">
                <div class="three-d-viewer-wrapper" data-three-d id="${ideviceId}"
                     data-config="${btoa(JSON.stringify({ src: configSrc }))}">
                    <model-viewer src="${modelViewerSrcAttr}"></model-viewer>
                </div>
            </div>`;
        return document.getElementById(`${ideviceId}-node`);
    }

    it('removes the src attribute from <model-viewer> when the persisted URL is an STL (asset://)', () => {
        const node = makeIdeviceWithStaleSrc(
            'asset://436bf925-79a1-6762-6713-a6fcbb0dca08.stl',
            'asset://436bf925-79a1-6762-6713-a6fcbb0dca08.stl',
        );

        // Trigger the synchronous pre-pass.
        $threedviewer.renderBehaviour({ ideviceId: node.id, src: 'asset://436bf925-79a1-6762-6713-a6fcbb0dca08.stl' });

        const mv = node.querySelector('model-viewer');
        expect(mv).toBeTruthy();
        expect(mv.hasAttribute('src')).toBe(false);
    });

    it('removes src when the persisted URL is a content/resources/...stl path', () => {
        const node = makeIdeviceWithStaleSrc(
            'content/resources/model.stl',
            'content/resources/model.stl',
        );

        $threedviewer.renderBehaviour({ ideviceId: node.id, src: 'content/resources/model.stl' });

        const mv = node.querySelector('model-viewer');
        expect(mv.hasAttribute('src')).toBe(false);
    });

    it('removes src when the persisted attribute is a blob: URL but the config says STL', () => {
        // Older edit sessions stored the live blob URL on the model-viewer
        // element. The blob URL has no extension, so we must rely on the
        // config (cfg.src) to decide whether to strip it.
        const node = makeIdeviceWithStaleSrc(
            'blob:http://localhost:8084/7ca80692-1d63-4ecb-8ef6-88068f2226bd',
            'asset://436bf925-79a1-6762-6713-a6fcbb0dca08.stl',
        );

        $threedviewer.renderBehaviour({ ideviceId: node.id, src: 'asset://436bf925-79a1-6762-6713-a6fcbb0dca08.stl' });

        const mv = node.querySelector('model-viewer');
        expect(mv.hasAttribute('src')).toBe(false);
    });

    it('LEAVES src untouched when the file is GLB / GLTF', () => {
        const node = makeIdeviceWithStaleSrc(
            'asset://abc.glb',
            'asset://abc.glb',
        );

        $threedviewer.renderBehaviour({ ideviceId: node.id, src: 'asset://abc.glb' });

        const mv = node.querySelector('model-viewer');
        expect(mv.getAttribute('src')).toBe('asset://abc.glb');
    });
});
