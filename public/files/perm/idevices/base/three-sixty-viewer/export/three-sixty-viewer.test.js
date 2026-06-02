/**
 * Unit tests for three-sixty-viewer iDevice (export/runtime) — v2 tour schema.
 */

/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code.replace(/var\s+\$threesixtyviewer\s*=/, 'global.$threesixtyviewer =');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$threesixtyviewer;
}

function createThreeMock() {
    return {
        Scene: class {
            constructor() {
                this.children = [];
            }
            add(obj) {
                this.children.push(obj);
            }
        },
        PerspectiveCamera: class {
            constructor(fov, aspect) {
                this.fov = fov;
                this.aspect = aspect;
                this.position = { set: vi.fn() };
                this.lookAt = vi.fn();
                this.updateProjectionMatrix = vi.fn();
                this.getWorldDirection = vi.fn();
            }
        },
        WebGLRenderer: class {
            constructor() {
                this.domElement = document.createElement('canvas');
                this.setPixelRatio = vi.fn();
                this.setSize = vi.fn();
                this.render = vi.fn();
                this.dispose = vi.fn();
            }
        },
        SphereGeometry: class {
            scale() {
                return this;
            }
            dispose() {}
        },
        MeshBasicMaterial: class {
            constructor() {
                this.map = null;
                this.needsUpdate = false;
            }
            dispose() {}
        },
        Mesh: class {
            constructor(geom, mat) {
                this.geometry = geom;
                this.material = mat;
            }
        },
        TextureLoader: class {
            load(url, onLoad) {
                const texture = { dispose: vi.fn(), colorSpace: '' };
                if (onLoad) onLoad(texture);
                return texture;
            }
        },
        OrbitControls: class {
            constructor(camera, dom) {
                this.camera = camera;
                this.dom = dom;
                this.update = vi.fn();
                this.dispose = vi.fn();
                this.enablePan = true;
                this.enableDamping = false;
                this.dampingFactor = 0;
                this.enableZoom = true;
                this.autoRotate = false;
                this.autoRotateSpeed = 0;
                this.rotateSpeed = 1;
                this.minDistance = 0;
                this.maxDistance = Infinity;
            }
        },
        Vector3: class {
            constructor(x, y, z) {
                this.x = x || 0;
                this.y = y || 0;
                this.z = z || 0;
            }
            multiplyScalar(s) {
                this.x *= s;
                this.y *= s;
                this.z *= s;
                return this;
            }
            // Project to NDC: pretend everything in front of camera is at 0,0,0.5
            project() {
                this.x = 0;
                this.y = 0;
                this.z = 0.5;
                return this;
            }
        },
        SRGBColorSpace: 'srgb',
    };
}

describe('three-sixty-viewer iDevice (export)', () => {
    let $t;

    beforeEach(() => {
        global.$threesixtyviewer = undefined;
        document.body.innerHTML = '';
        const filePath = join(__dirname, 'three-sixty-viewer.js');
        const code = readFileSync(filePath, 'utf-8');
        $t = loadExportIdevice(code);
        $t._instances = [];
        global.THREE = createThreeMock();
        if (typeof window !== 'undefined') window.THREE = global.THREE;
    });

    afterEach(() => {
        try {
            $t.destroyAll();
        } catch (_) {
            /* ignore */
        }
        delete global.THREE;
        if (typeof window !== 'undefined') delete window.THREE;
    });

    describe('normalize() v2 schema', () => {
        it('produces a one-scene tour from {} input', () => {
            const n = $t.normalize({});
            expect(n.version).toBe(2);
            expect(n.scenes.length).toBe(1);
            expect(n.scenes[0].src).toBe('');
            expect(n.scenes[0].initialView).toEqual({ yaw: 0, pitch: 0, fov: 75 });
            expect(n.behaviour.zoomEnabled).toBe(true);
            expect(n.behaviour.imageAdjustments).toEqual({ brightness: 1, contrast: 1, saturation: 1 });
        });

        it('tolerates null', () => {
            const n = $t.normalize(null);
            expect(n.scenes.length).toBe(1);
            expect(n.scenes[0].initialView.fov).toBe(75);
        });

        it('clamps out-of-range yaw/pitch/fov inside scene', () => {
            const n = $t.normalize({ initialView: { yaw: 1000, pitch: -999, fov: 5 } });
            expect(n.scenes[0].initialView.yaw).toBe(180);
            expect(n.scenes[0].initialView.pitch).toBe(-90);
            expect(n.scenes[0].initialView.fov).toBe(30);
        });

        it('clamps autorotate.speed', () => {
            expect($t.normalize({ autorotate: { speed: 99 } }).behaviour.autorotate.speed).toBe(10);
            expect($t.normalize({ autorotate: { speed: -5 } }).behaviour.autorotate.speed).toBe(0);
        });

        it('preserves explicit false flags on behaviour', () => {
            const n = $t.normalize({ zoomEnabled: false, fullscreenEnabled: false });
            expect(n.behaviour.zoomEnabled).toBe(false);
            expect(n.behaviour.fullscreenEnabled).toBe(false);
        });

        it('migrates v1 single-image data into a one-scene tour', () => {
            const n = $t.normalize({
                src: 'asset://p.jpg',
                alt: 'A',
                initialView: { yaw: 30, pitch: 5, fov: 80 },
            });
            expect(n.scenes.length).toBe(1);
            expect(n.scenes[0].src).toBe('asset://p.jpg');
            expect(n.scenes[0].alt).toBe('A');
            expect(n.scenes[0].initialView.yaw).toBe(30);
            expect(n.startSceneId).toBe(n.scenes[0].id);
        });

        it('keeps v2 input intact', () => {
            const n = $t.normalize({
                version: 2,
                startSceneId: 'b',
                scenes: [
                    { id: 'a', src: 'a.jpg' },
                    { id: 'b', src: 'b.jpg' },
                ],
                behaviour: { renderQuality: 'low' },
            });
            expect(n.scenes.length).toBe(2);
            expect(n.startSceneId).toBe('b');
            expect(n.behaviour.renderQuality).toBe('low');
        });

        it('falls back startSceneId when requested id is missing', () => {
            const n = $t.normalize({ version: 2, scenes: [{ id: 'first' }], startSceneId: 'missing' });
            expect(n.startSceneId).toBe('first');
        });
    });

    describe('hotspot normalization', () => {
        it('coerces unknown action.type to text', () => {
            const n = $t.normalize({
                version: 2,
                scenes: [{ id: 's', hotspots: [{ id: 'h', action: { type: 'evil', payload: {} } }] }],
            });
            expect(n.scenes[0].hotspots[0].action.type).toBe('text');
        });

        it('clamps yaw/pitch on hotspots', () => {
            const n = $t.normalize({
                version: 2,
                scenes: [{ id: 's', hotspots: [{ id: 'h', yaw: 999, pitch: -999 }] }],
            });
            expect(n.scenes[0].hotspots[0].yaw).toBe(180);
            expect(n.scenes[0].hotspots[0].pitch).toBe(-90);
        });

        it('accepts the "link" action type and defaults newTab to true', () => {
            const n = $t.normalize({
                version: 2,
                scenes: [
                    {
                        id: 's',
                        hotspots: [
                            { id: 'h', action: { type: 'link', payload: { url: 'https://example.com' } } },
                        ],
                    },
                ],
            });
            expect(n.scenes[0].hotspots[0].action.type).toBe('link');
            expect(n.scenes[0].hotspots[0].action.payload.url).toBe('https://example.com');
            expect(n.scenes[0].hotspots[0].action.payload.newTab).toBe(true);
        });

        it('coerces non-string link url to empty and preserves explicit newTab=false', () => {
            const n = $t.normalize({
                version: 2,
                scenes: [
                    {
                        id: 's',
                        hotspots: [{ id: 'h', action: { type: 'link', payload: { url: 42, newTab: false } } }],
                    },
                ],
            });
            const p = n.scenes[0].hotspots[0].action.payload;
            expect(p.url).toBe('');
            expect(p.newTab).toBe(false);
        });
    });

    describe('extractState()', () => {
        it('reads v2 JSON from data-idevice-json-data', () => {
            const node = document.createElement('div');
            node.setAttribute(
                'data-idevice-json-data',
                JSON.stringify({ version: 2, scenes: [{ id: 's1', src: 'asset://x.jpg' }], startSceneId: 's1' }),
            );
            const state = $t.extractState(node);
            expect(state.scenes[0].src).toBe('asset://x.jpg');
            expect(state.startSceneId).toBe('s1');
        });

        it('migrates v1 JSON from data-idevice-json-data', () => {
            const node = document.createElement('div');
            node.setAttribute('data-idevice-json-data', JSON.stringify({ src: 'asset://x.jpg', alt: 'hello' }));
            const state = $t.extractState(node);
            expect(state.scenes[0].src).toBe('asset://x.jpg');
            expect(state.scenes[0].alt).toBe('hello');
        });

        it('falls back to a nested JSON script tag', () => {
            const node = document.createElement('div');
            const script = document.createElement('script');
            script.className = 'three-sixty-viewer-data';
            script.type = 'application/json';
            script.textContent = JSON.stringify({ alt: 'from-script' });
            node.appendChild(script);
            const state = $t.extractState(node);
            expect(state.scenes[0].alt).toBe('from-script');
        });

        it('returns defaults when attribute is malformed JSON', () => {
            const node = document.createElement('div');
            node.setAttribute('data-idevice-json-data', '{bad json');
            const state = $t.extractState(node);
            expect(state.scenes[0].src).toBe('');
        });

        it('returns defaults when no data is present', () => {
            const node = document.createElement('div');
            const state = $t.extractState(node);
            expect(state.scenes[0].initialView.fov).toBe(75);
        });
    });

    describe('hasWebGL()', () => {
        it('returns a boolean without throwing', () => {
            expect(() => $t.hasWebGL()).not.toThrow();
            expect(typeof $t.hasWebGL()).toBe('boolean');
        });
    });

    describe('resolveSrc()', () => {
        it('returns empty string for empty input', () => {
            expect($t.resolveSrc('')).toBe('');
        });

        it('returns the src as-is for http(s) URLs', () => {
            expect($t.resolveSrc('https://example.com/p.jpg')).toBe('https://example.com/p.jpg');
        });

        it('returns the asset:// src as-is when no asset manager', () => {
            expect($t.resolveSrc('asset://abc.jpg')).toBe('asset://abc.jpg');
        });

        it('uses the sync asset manager when available', () => {
            global.eXeLearning = {
                app: {
                    project: {
                        _yjsBridge: {
                            assetManager: {
                                resolveAssetURLSync: () => 'blob:mock-resolved',
                            },
                        },
                    },
                },
            };
            expect($t.resolveSrc('asset://abc.jpg')).toBe('blob:mock-resolved');
            delete global.eXeLearning;
        });
    });

    describe('renderFallback()', () => {
        it('adds a fallback element with the label', () => {
            const wrapper = document.createElement('div');
            $t.renderFallback(wrapper, $t.normalize({ alt: 'my alt' }), 'fallback text');
            const fb = wrapper.querySelector('.three-sixty-viewer-fallback');
            expect(fb).not.toBeNull();
            expect(fb.textContent).toBe('fallback text');
        });

        it('falls back to start scene alt when label is empty', () => {
            const wrapper = document.createElement('div');
            $t.renderFallback(wrapper, $t.normalize({ alt: 'my alt' }), '');
            expect(wrapper.querySelector('.three-sixty-viewer-fallback').textContent).toBe('my alt');
        });
    });

    describe('renderOne()', () => {
        it('renders a fallback when src is empty', () => {
            const node = document.createElement('div');
            node.className = 'idevice_node three-sixty-viewer';
            document.body.appendChild(node);
            $t.renderOne(node, $t.normalize({ alt: 'alt text' }), '', false);
            expect(node.querySelector('.three-sixty-viewer-fallback')).not.toBeNull();
            expect(node.querySelector('canvas')).toBeNull();
        });

        it('wraps the content in a div with role="region" and aria-label', () => {
            const node = document.createElement('div');
            node.className = 'idevice_node three-sixty-viewer';
            document.body.appendChild(node);
            $t.renderOne(node, $t.normalize({ alt: 'An image label' }), '', false);
            const wrapper = node.querySelector('.three-sixty-viewer-wrapper');
            expect(wrapper).not.toBeNull();
            expect(wrapper.getAttribute('role')).toBe('region');
            expect(wrapper.getAttribute('aria-label')).toBe('An image label');
        });

        it('renders a fallback when WebGL is unavailable', () => {
            const originalHasWebGL = $t.hasWebGL;
            $t.hasWebGL = () => false;
            const node = document.createElement('div');
            node.className = 'idevice_node three-sixty-viewer';
            document.body.appendChild(node);
            $t.renderOne(node, $t.normalize({ src: 'asset://x.jpg', alt: 'no webgl' }), '', false);
            expect(node.querySelector('.three-sixty-viewer-fallback')).not.toBeNull();
            expect(node.querySelector('canvas')).toBeNull();
            $t.hasWebGL = originalHasWebGL;
        });

        it('creates a canvas when src is set and THREE + WebGL are available', () => {
            const originalHasWebGL = $t.hasWebGL;
            $t.hasWebGL = () => true;
            const node = document.createElement('div');
            node.className = 'idevice_node three-sixty-viewer';
            document.body.appendChild(node);
            $t.renderOne(node, $t.normalize({ src: 'asset://x.jpg', alt: 'with canvas' }), '', false);
            expect(node.querySelector('canvas')).not.toBeNull();
            expect($t._instances.length).toBe(1);
            $t.hasWebGL = originalHasWebGL;
        });

        it('adds a fullscreen button when enabled', () => {
            const originalHasWebGL = $t.hasWebGL;
            $t.hasWebGL = () => true;
            const node = document.createElement('div');
            node.className = 'idevice_node three-sixty-viewer';
            document.body.appendChild(node);
            $t.renderOne(node, $t.normalize({ src: 'asset://x.jpg', fullscreenEnabled: true }), '', false);
            expect(node.querySelector('.three-sixty-viewer-fullscreen-button')).not.toBeNull();
            $t.hasWebGL = originalHasWebGL;
        });

        it('omits the fullscreen button when disabled', () => {
            const originalHasWebGL = $t.hasWebGL;
            $t.hasWebGL = () => true;
            const node = document.createElement('div');
            node.className = 'idevice_node three-sixty-viewer';
            document.body.appendChild(node);
            $t.renderOne(node, $t.normalize({ src: 'asset://x.jpg', fullscreenEnabled: false }), '', false);
            expect(node.querySelector('.three-sixty-viewer-fullscreen-button')).toBeNull();
            $t.hasWebGL = originalHasWebGL;
        });

        it('falls back gracefully when THREE is missing', () => {
            const savedTHREE = global.THREE;
            delete global.THREE;
            if (typeof window !== 'undefined') delete window.THREE;
            const node = document.createElement('div');
            node.className = 'idevice_node three-sixty-viewer';
            document.body.appendChild(node);
            const originalHasWebGL = $t.hasWebGL;
            $t.hasWebGL = () => true;
            $t.renderOne(node, $t.normalize({ src: 'asset://x.jpg', alt: 'nope' }), '', false);
            expect(node.querySelector('.three-sixty-viewer-fallback')).not.toBeNull();
            $t.hasWebGL = originalHasWebGL;
            global.THREE = savedTHREE;
            if (typeof window !== 'undefined') window.THREE = savedTHREE;
        });

        it('renders one DOM hotspot button per hotspot in the active scene', () => {
            $t.hasWebGL = () => true;
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                scenes: [
                    {
                        id: 's1',
                        src: 'asset://x.jpg',
                        hotspots: [
                            {
                                id: 'h1',
                                label: 'A',
                                yaw: 0,
                                pitch: 0,
                                action: { type: 'text', payload: { html: 'hi' } },
                            },
                            {
                                id: 'h2',
                                label: 'Go',
                                yaw: 30,
                                pitch: 0,
                                action: { type: 'goToScene', payload: { sceneId: 's1' } },
                            },
                        ],
                    },
                ],
            });
            $t.renderOne(node, state, '', false);
            const buttons = node.querySelectorAll('.three-sixty-viewer-hotspot');
            expect(buttons.length).toBe(2);
            expect(buttons[0].getAttribute('aria-label')).toBe('A');
        });
    });

    describe('multi-instance safety', () => {
        beforeEach(() => {
            $t.hasWebGL = () => true;
        });

        it('tracks each created instance separately', () => {
            for (let i = 0; i < 3; i++) {
                const node = document.createElement('div');
                node.className = 'idevice_node three-sixty-viewer';
                document.body.appendChild(node);
                $t.renderOne(node, $t.normalize({ src: `asset://p${i}.jpg`, alt: `p${i}` }), '', false);
            }
            expect($t._instances.length).toBe(3);
        });

        it('destroyAll() calls dispose on every instance and empties the list', () => {
            for (let i = 0; i < 2; i++) {
                const node = document.createElement('div');
                node.className = 'idevice_node three-sixty-viewer';
                document.body.appendChild(node);
                $t.renderOne(node, $t.normalize({ src: `asset://p${i}.jpg` }), '', false);
            }
            const spies = $t._instances.map(inst => {
                const orig = inst.dispose;
                const spy = vi.fn(() => orig());
                inst.dispose = spy;
                return spy;
            });
            $t.destroyAll();
            spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
            expect($t._instances.length).toBe(0);
        });
    });

    describe('renderView()', () => {
        it('returns the template with a wrapper div substituted for {content}', () => {
            const html = $t.renderView(
                { src: 'asset://a.jpg', alt: 'My panorama' },
                null,
                '<div class="exe-three-sixty-viewer-template">{content}</div>',
            );
            expect(html).toContain('<div class="exe-three-sixty-viewer-template">');
            expect(html).toContain('class="three-sixty-viewer-wrapper"');
            expect(html).toContain('role="region"');
            expect(html).toContain('aria-label="My panorama"');
            expect(html).not.toContain('{content}');
        });

        it('escapes HTML-unsafe characters in alt', () => {
            const html = $t.renderView({ alt: 'Evil <img onerror="x">' }, null, '{content}');
            expect(html).not.toContain('<img onerror');
            expect(html).toContain('&lt;img');
        });

        it('falls back to a sensible default when alt is empty', () => {
            const html = $t.renderView({}, null, '{content}');
            expect(html).toContain('aria-label="360° panorama"');
        });

        it('accepts a missing template gracefully', () => {
            const html = $t.renderView({ alt: 'x' }, null, '');
            expect(html).toContain('class="three-sixty-viewer-wrapper"');
        });
    });

    describe('renderBehaviour()', () => {
        beforeEach(() => {
            $t.hasWebGL = () => true;
        });

        it('is a no-op when the ideviceId does not resolve to a node', () => {
            expect(() => $t.renderBehaviour({ ideviceId: 'missing', src: 'asset://x.jpg' }, null)).not.toThrow();
            expect($t._instances.length).toBe(0);
        });

        it('creates a viewer inside the wrapper when src + WebGL are present (v1 input)', () => {
            const node = document.createElement('div');
            node.id = 'idev-unit-1';
            const wrapper = document.createElement('div');
            wrapper.className = 'three-sixty-viewer-wrapper';
            node.appendChild(wrapper);
            document.body.appendChild(node);

            $t.renderBehaviour({ ideviceId: 'idev-unit-1', src: 'asset://a.jpg', alt: 'alpha' }, null);

            expect(node.querySelector('canvas')).not.toBeNull();
            expect($t._instances.length).toBe(1);
        });

        it('renders the fallback when the start scene src is empty', () => {
            const node = document.createElement('div');
            node.id = 'idev-unit-2';
            document.body.appendChild(node);

            $t.renderBehaviour({ ideviceId: 'idev-unit-2', alt: 'empty src' }, null);

            expect(node.querySelector('.three-sixty-viewer-fallback')).not.toBeNull();
            expect(node.querySelector('canvas')).toBeNull();
        });

        it('creates a wrapper on the fly if the post-renderView HTML is missing', () => {
            const node = document.createElement('div');
            node.id = 'idev-unit-3';
            document.body.appendChild(node);

            $t.renderBehaviour({ ideviceId: 'idev-unit-3', src: 'asset://x.jpg', alt: 'late' }, null);

            expect(node.querySelector('.three-sixty-viewer-wrapper')).not.toBeNull();
            expect(node.querySelector('canvas')).not.toBeNull();
        });

        it('disposes the previous viewer when re-rendering the same node', () => {
            const node = document.createElement('div');
            node.id = 'idev-unit-4';
            document.body.appendChild(node);

            $t.renderBehaviour({ ideviceId: 'idev-unit-4', src: 'asset://a.jpg', alt: 'a' }, null);
            expect($t._instances.length).toBe(1);
            const firstInstance = $t._instances[0];
            const disposeSpy = vi.spyOn(firstInstance, 'dispose');

            $t.renderBehaviour({ ideviceId: 'idev-unit-4', src: 'asset://b.jpg', alt: 'b' }, null);

            expect(disposeSpy).toHaveBeenCalledTimes(1);
            expect($t._instances.length).toBe(1);
        });

        it('falls back when THREE is missing even if WebGL is available', () => {
            delete global.THREE;
            if (typeof window !== 'undefined') delete window.THREE;
            const node = document.createElement('div');
            node.id = 'idev-unit-5';
            document.body.appendChild(node);

            $t.renderBehaviour({ ideviceId: 'idev-unit-5', src: 'asset://x.jpg', alt: 'no three' }, null);

            expect(node.querySelector('.three-sixty-viewer-fallback')).not.toBeNull();
            expect($t._instances.length).toBe(0);
        });
    });

    describe('scene navigation at runtime', () => {
        beforeEach(() => {
            $t.hasWebGL = () => true;
        });

        it('goToScene swaps the texture and re-renders hotspots', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                startSceneId: 'a',
                scenes: [
                    { id: 'a', src: 'asset://a.jpg', hotspots: [{ id: 'h1', label: 'A1' }] },
                    {
                        id: 'b',
                        src: 'asset://b.jpg',
                        hotspots: [
                            { id: 'h2', label: 'B1' },
                            { id: 'h3', label: 'B2' },
                        ],
                    },
                ],
            });
            $t.renderOne(node, state, '', false);
            const inst = $t._instances[0];
            expect(inst.currentSceneId).toBe('a');
            expect(inst.hotspotButtons.length).toBe(1);
            inst.goToScene('b');
            expect(inst.currentSceneId).toBe('b');
            expect(inst.hotspotButtons.length).toBe(2);
        });

        it('clicking a goToScene hotspot triggers scene navigation', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                startSceneId: 'a',
                scenes: [
                    {
                        id: 'a',
                        src: 'asset://a.jpg',
                        hotspots: [
                            {
                                id: 'go',
                                label: 'Go to B',
                                yaw: 0,
                                pitch: 0,
                                action: { type: 'goToScene', payload: { sceneId: 'b' } },
                            },
                        ],
                    },
                    { id: 'b', src: 'asset://b.jpg' },
                ],
            });
            $t.renderOne(node, state, '', false);
            const inst = $t._instances[0];
            const btn = inst.hotspotButtons[0].button;
            btn.click();
            expect(inst.currentSceneId).toBe('b');
        });

        it('clicking a text hotspot opens an accessible modal', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                scenes: [
                    {
                        id: 'a',
                        src: 'asset://a.jpg',
                        hotspots: [
                            { id: 'tx', label: 'Info', action: { type: 'text', payload: { html: '<p>Hi</p>' } } },
                        ],
                    },
                ],
            });
            $t.renderOne(node, state, '', false);
            const inst = $t._instances[0];
            inst.hotspotButtons[0].button.click();
            const modal = node.querySelector('.three-sixty-viewer-modal');
            expect(modal).not.toBeNull();
            expect(modal.getAttribute('role')).toBe('dialog');
            expect(modal.getAttribute('aria-modal')).toBe('true');
            expect(modal.querySelector('.three-sixty-viewer-modal-body').innerHTML).toContain('Hi');
        });

        it('clicking a link hotspot opens the URL in a new tab with noopener,noreferrer', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                scenes: [
                    {
                        id: 'a',
                        src: 'asset://a.jpg',
                        hotspots: [
                            {
                                id: 'lnk',
                                label: 'Docs',
                                action: { type: 'link', payload: { url: 'https://exelearning.net' } },
                            },
                        ],
                    },
                ],
            });
            $t.renderOne(node, state, '', false);
            const inst = $t._instances[0];
            const originalOpen = window.open;
            const openSpy = vi.fn();
            window.open = openSpy;
            inst.hotspotButtons[0].button.click();
            expect(openSpy).toHaveBeenCalledWith('https://exelearning.net', '_blank', 'noopener,noreferrer');
            // Link hotspots never open the content modal.
            expect(node.querySelector('.three-sixty-viewer-modal')).toBeNull();
            window.open = originalOpen;
        });

        it('a link hotspot with newTab=false navigates the current window', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                scenes: [
                    {
                        id: 'a',
                        src: 'asset://a.jpg',
                        hotspots: [
                            {
                                id: 'lnk',
                                label: 'Docs',
                                action: {
                                    type: 'link',
                                    payload: { url: 'https://exelearning.net', newTab: false },
                                },
                            },
                        ],
                    },
                ],
            });
            $t.renderOne(node, state, '', false);
            const inst = $t._instances[0];
            const originalOpen = window.open;
            const openSpy = vi.fn();
            window.open = openSpy;
            // Capture location.href writes without actually navigating jsdom.
            const originalLocation = window.location;
            let assigned = null;
            delete window.location;
            window.location = {
                set href(v) {
                    assigned = v;
                },
                get href() {
                    return assigned || '';
                },
            };
            inst.hotspotButtons[0].button.click();
            expect(openSpy).not.toHaveBeenCalled();
            expect(assigned).toBe('https://exelearning.net');
            window.open = originalOpen;
            window.location = originalLocation;
        });

        it('a link hotspot with an empty URL is a no-op (no modal, no open)', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                scenes: [
                    {
                        id: 'a',
                        src: 'asset://a.jpg',
                        hotspots: [
                            { id: 'lnk', label: 'Empty', action: { type: 'link', payload: { url: '' } } },
                        ],
                    },
                ],
            });
            $t.renderOne(node, state, '', false);
            const inst = $t._instances[0];
            const originalOpen = window.open;
            const openSpy = vi.fn();
            window.open = openSpy;
            inst.hotspotButtons[0].button.click();
            expect(openSpy).not.toHaveBeenCalled();
            expect(node.querySelector('.three-sixty-viewer-modal')).toBeNull();
            window.open = originalOpen;
        });

        it('_defaultHotspotLabel returns "Open link" for the link action type', () => {
            expect($t._defaultHotspotLabel('link')).toBe('Open link');
        });

        it('closing the modal removes it from the DOM', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                scenes: [
                    {
                        id: 'a',
                        src: 'asset://a.jpg',
                        hotspots: [{ id: 'tx', label: 'Info', action: { type: 'text', payload: { html: 'x' } } }],
                    },
                ],
            });
            $t.renderOne(node, state, '', false);
            const inst = $t._instances[0];
            inst.hotspotButtons[0].button.click();
            const closeBtn = node.querySelector('.three-sixty-viewer-modal-close');
            closeBtn.click();
            expect(node.querySelector('.three-sixty-viewer-modal')).toBeNull();
        });
    });

    describe('navigation controls', () => {
        beforeEach(() => {
            $t.hasWebGL = () => true;
        });

        it('renders four pan-arrow buttons by default', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            $t.renderOne(node, $t.normalize({ src: 'asset://x.jpg' }), '', false);
            const buttons = node.querySelectorAll('.three-sixty-viewer-nav-btn');
            expect(buttons.length).toBe(4);
            const labels = Array.from(buttons).map(b => b.getAttribute('aria-label'));
            expect(labels).toEqual(expect.arrayContaining(['Pan left', 'Pan up', 'Pan down', 'Pan right']));
        });

        it('omits the nav-arrows container when showNavControls is false', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            $t.renderOne(node, $t.normalize({ src: 'asset://x.jpg', showNavControls: false }), '', false);
            expect(node.querySelector('.three-sixty-viewer-nav')).toBeNull();
        });

        it('clicking a nav arrow calls camera.lookAt and controls.update', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            $t.renderOne(node, $t.normalize({ src: 'asset://x.jpg' }), '', false);
            const inst = $t._instances[0];
            inst.camera.lookAt = vi.fn();
            inst.controls.update = vi.fn();
            const left = node.querySelector('.three-sixty-viewer-nav-left');
            left.click();
            expect(inst.camera.lookAt).toHaveBeenCalled();
            expect(inst.controls.update).toHaveBeenCalled();
        });
    });

    describe('_blockNativeDragInside (document-capture drag blocker)', () => {
        it('preventDefaults dragstart events that originate inside the wrapper', () => {
            const wrapper = document.createElement('div');
            const inner = document.createElement('div');
            wrapper.appendChild(inner);
            document.body.appendChild(wrapper);

            const handler = $t._blockNativeDragInside(wrapper);
            expect(typeof handler).toBe('function');

            const ev = new Event('dragstart', { bubbles: true, cancelable: true });
            const prevented = vi.spyOn(ev, 'preventDefault');
            inner.dispatchEvent(ev);
            expect(prevented).toHaveBeenCalled();

            // Cleanup
            document.removeEventListener('dragstart', handler, true);
            document.removeEventListener('selectstart', handler, true);
        });

        it('leaves dragstart events that originate outside the wrapper alone', () => {
            const wrapper = document.createElement('div');
            const sibling = document.createElement('div');
            document.body.appendChild(wrapper);
            document.body.appendChild(sibling);

            const handler = $t._blockNativeDragInside(wrapper);
            const ev = new Event('dragstart', { bubbles: true, cancelable: true });
            const prevented = vi.spyOn(ev, 'preventDefault');
            sibling.dispatchEvent(ev);
            expect(prevented).not.toHaveBeenCalled();

            document.removeEventListener('dragstart', handler, true);
            document.removeEventListener('selectstart', handler, true);
        });

        it('returns null when wrapper is missing', () => {
            expect($t._blockNativeDragInside(null)).toBeNull();
        });
    });

    describe('fullscreen toggle button', () => {
        beforeEach(() => {
            $t.hasWebGL = () => true;
        });

        it('initial aria-label is "Fullscreen"', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            $t.renderOne(
                node,
                $t.normalize({ src: 'asset://x.jpg', fullscreenEnabled: true }),
                '',
                false,
            );
            const fsBtn = node.querySelector('.three-sixty-viewer-fullscreen-button');
            expect(fsBtn).not.toBeNull();
            expect(fsBtn.getAttribute('aria-label')).toBe('Fullscreen');
        });

        it('aria-label updates to "Exit fullscreen" on fullscreenchange when wrapper is the active element', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            $t.renderOne(
                node,
                $t.normalize({ src: 'asset://x.jpg', fullscreenEnabled: true }),
                '',
                false,
            );
            const inst = $t._instances[0];
            const fsBtn = node.querySelector('.three-sixty-viewer-fullscreen-button');
            // Pretend the browser entered fullscreen on our wrapper.
            Object.defineProperty(document, 'fullscreenElement', {
                configurable: true,
                value: inst.wrapper,
            });
            document.dispatchEvent(new Event('fullscreenchange'));
            expect(fsBtn.getAttribute('aria-label')).toBe('Exit fullscreen');
            // restore
            Object.defineProperty(document, 'fullscreenElement', {
                configurable: true,
                value: null,
            });
            document.dispatchEvent(new Event('fullscreenchange'));
            expect(fsBtn.getAttribute('aria-label')).toBe('Fullscreen');
        });
    });

    describe('drag event capture', () => {
        beforeEach(() => {
            $t.hasWebGL = () => true;
        });

        it('stops mousedown / pointerdown / touchstart / wheel propagation on the canvas', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            $t.renderOne(node, $t.normalize({ src: 'asset://x.jpg' }), '', false);
            const canvas = node.querySelector('canvas');
            expect(canvas).not.toBeNull();
            ['mousedown', 'pointerdown', 'touchstart', 'wheel'].forEach(evt => {
                const event = new Event(evt, { bubbles: true, cancelable: true });
                const stop = vi.spyOn(event, 'stopPropagation');
                canvas.dispatchEvent(event);
                expect(stop).toHaveBeenCalled();
            });
        });
    });

    describe('applyColorManagement', () => {
        it('sets outputColorSpace = SRGBColorSpace and toneMapping = NoToneMapping', () => {
            global.THREE = {
                SRGBColorSpace: 'srgb',
                NoToneMapping: 0,
                ColorManagement: { enabled: false },
            };
            const renderer = { outputColorSpace: '', toneMapping: 99, toneMappingExposure: 0.5 };
            $t.applyColorManagement(renderer);
            expect(renderer.outputColorSpace).toBe('srgb');
            expect(renderer.toneMapping).toBe(0);
            expect(renderer.toneMappingExposure).toBe(1);
            expect(global.THREE.ColorManagement.enabled).toBe(true);
        });

        it('falls back to outputEncoding = sRGBEncoding when outputColorSpace is missing', () => {
            global.THREE = { sRGBEncoding: 3001 };
            const renderer = { outputEncoding: 0 };
            $t.applyColorManagement(renderer);
            expect(renderer.outputEncoding).toBe(3001);
        });

        it('is a no-op when THREE is undefined', () => {
            delete global.THREE;
            const renderer = { outputColorSpace: '' };
            expect(() => $t.applyColorManagement(renderer)).not.toThrow();
            expect(renderer.outputColorSpace).toBe('');
        });

        it('is a no-op when renderer is null', () => {
            global.THREE = { SRGBColorSpace: 'srgb' };
            expect(() => $t.applyColorManagement(null)).not.toThrow();
        });
    });

    describe('applyTextureColorSpace', () => {
        it('sets colorSpace on a modern texture', () => {
            global.THREE = { SRGBColorSpace: 'srgb' };
            const texture = { colorSpace: '' };
            $t.applyTextureColorSpace(texture);
            expect(texture.colorSpace).toBe('srgb');
        });

        it('falls back to encoding on a legacy texture', () => {
            global.THREE = { sRGBEncoding: 3001 };
            const texture = { encoding: 0 };
            $t.applyTextureColorSpace(texture);
            expect(texture.encoding).toBe(3001);
        });

        it('handles null texture safely', () => {
            global.THREE = { SRGBColorSpace: 'srgb' };
            expect(() => $t.applyTextureColorSpace(null)).not.toThrow();
        });
    });

    describe('renderOne() applies color management on the renderer', () => {
        beforeEach(() => {
            $t.hasWebGL = () => true;
        });

        it('writes outputColorSpace = SRGBColorSpace on the created WebGLRenderer', () => {
            const created = [];
            global.THREE = createThreeMock();
            const OrigRenderer = global.THREE.WebGLRenderer;
            global.THREE.WebGLRenderer = class extends OrigRenderer {
                constructor() {
                    super();
                    this.outputColorSpace = '';
                    this.toneMapping = 99;
                    this.toneMappingExposure = 0.5;
                    created.push(this);
                }
            };
            global.THREE.NoToneMapping = 0;
            global.THREE.ColorManagement = { enabled: false };
            const node = document.createElement('div');
            document.body.appendChild(node);
            $t.renderOne(node, $t.normalize({ src: 'asset://x.jpg' }), '', false);
            expect(created.length).toBe(1);
            expect(created[0].outputColorSpace).toBe('srgb');
            expect(created[0].toneMapping).toBe(0);
            expect(created[0].toneMappingExposure).toBe(1);
            expect(global.THREE.ColorManagement.enabled).toBe(true);
        });
    });

    describe('init() (engine hook)', () => {
        it('is callable with the engine signature and does nothing on its own', () => {
            expect(() => $t.init({ ideviceId: 'whatever' }, null)).not.toThrow();
            expect($t._instances.length).toBe(0);
        });
    });

    describe('flat (non-360) scenes', () => {
        beforeEach(() => {
            $t.hasWebGL = () => true;
        });

        it('normalizes scene projection and hotspot x/y', () => {
            const state = $t.normalize({
                version: 2,
                scenes: [{ id: 'a', src: 'asset://a.jpg', projection: 'flat', hotspots: [{ id: 'h', x: 200, y: -3 }] }],
            });
            expect(state.scenes[0].projection).toBe('flat');
            expect(state.scenes[0].hotspots[0].x).toBe(100);
            expect(state.scenes[0].hotspots[0].y).toBe(0);
        });

        it('defaults projection to equirectangular and hotspot x/y to 50', () => {
            const state = $t.normalize({ version: 2, scenes: [{ id: 'a', src: 'asset://a.jpg', hotspots: [{ id: 'h' }] }] });
            expect(state.scenes[0].projection).toBe('equirectangular');
            expect(state.scenes[0].hotspots[0].x).toBe(50);
            expect(state.scenes[0].hotspots[0].y).toBe(50);
        });

        it('containedImageRect letterboxes and falls back to the full box', () => {
            expect($t.containedImageRect(0, 0, 200, 100)).toEqual({ left: 0, top: 0, width: 200, height: 100 });
            const r = $t.containedImageRect(200, 100, 100, 100);
            expect(r.width).toBe(100);
            expect(r.height).toBe(50);
            expect(r.top).toBe(25);
        });

        it('renders a flat <img>, hides the canvas, and disables controls for a flat start scene', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                startSceneId: 'a',
                scenes: [{ id: 'a', src: 'asset://flat.jpg', projection: 'flat', alt: 'a flat photo' }],
            });
            $t.renderOne(node, state, '', false);
            const inst = $t._instances[0];
            expect(inst.currentMode).toBe('flat');
            expect(inst.flatImg.style.display).not.toBe('none');
            expect(inst.flatImg.alt).toBe('a flat photo');
            expect(inst.renderer.domElement.style.display).toBe('none');
            expect(inst.controls.enabled).toBe(false);
        });

        it('skips WebGL rendering while a flat scene is active', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                scenes: [{ id: 'a', src: 'asset://flat.jpg', projection: 'flat' }],
            });
            $t.renderOne(node, state, '', false);
            const inst = $t._instances[0];
            const before = inst.renderer.render.mock.calls.length;
            $t._positionHotspots(inst); // safe no-op without hotspots
            expect(inst.renderer.render.mock.calls.length).toBe(before);
        });

        it('positions flat hotspots by x/y percent of the wrapper box', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                scenes: [
                    {
                        id: 'a',
                        src: 'asset://flat.jpg',
                        projection: 'flat',
                        hotspots: [{ id: 'h', label: 'spot', x: 25, y: 75 }],
                    },
                ],
            });
            $t.renderOne(node, state, '', false);
            const inst = $t._instances[0];
            // naturalWidth is 0 in jsdom → contained rect falls back to the full box.
            inst.wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });
            $t._positionHotspotsFlat(inst);
            const btn = inst.hotspotButtons[0].button;
            expect(btn.style.left).toBe('100px'); // 25% of 400
            expect(btn.style.top).toBe('150px'); // 75% of 200
        });

        it('navigates flat → 360 → flat, switching renderer and image visibility each time', () => {
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                startSceneId: 'flatA',
                scenes: [
                    { id: 'flatA', src: 'asset://a.jpg', projection: 'flat' },
                    { id: 'pano', src: 'asset://b.jpg' },
                    { id: 'flatC', src: 'asset://c.jpg', projection: 'flat' },
                ],
            });
            $t.renderOne(node, state, '', false);
            const inst = $t._instances[0];
            expect(inst.currentMode).toBe('flat');
            expect(inst.renderer.domElement.style.display).toBe('none');

            inst.goToScene('pano');
            expect(inst.currentMode).toBe('equirectangular');
            expect(inst.flatImg.style.display).toBe('none');
            expect(inst.renderer.domElement.style.display).toBe('');
            expect(inst.controls.enabled).toBe(true);

            inst.goToScene('flatC');
            expect(inst.currentMode).toBe('flat');
            expect(inst.flatImg.style.display).toBe('');
            expect(inst.renderer.domElement.style.display).toBe('none');
            expect(inst.controls.enabled).toBe(false);
        });
    });

    describe('video hotspot embedding', () => {
        describe('_videoEmbedUrl', () => {
            it('maps YouTube URLs to an embed src', () => {
                expect($t._videoEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe(
                    'https://www.youtube.com/embed/abc123',
                );
                expect($t._videoEmbedUrl('https://youtu.be/abc123')).toBe('https://www.youtube.com/embed/abc123');
                expect($t._videoEmbedUrl('https://www.youtube.com/embed/abc123')).toBe(
                    'https://www.youtube.com/embed/abc123',
                );
            });

            it('maps Vimeo URLs to the player embed src', () => {
                expect($t._videoEmbedUrl('https://vimeo.com/123456789')).toBe(
                    'https://player.vimeo.com/video/123456789',
                );
            });

            it('keeps the privacy hash for unlisted Vimeo URLs', () => {
                expect($t._videoEmbedUrl('https://vimeo.com/123456789/abcdef0123')).toBe(
                    'https://player.vimeo.com/video/123456789?h=abcdef0123',
                );
            });

            it('maps Educamadrid Mediateca URLs to the /fs embed src', () => {
                expect($t._videoEmbedUrl('https://mediateca.educa.madrid.org/video/j6mdl514dd1t715f')).toBe(
                    'https://mediateca.educa.madrid.org/video/j6mdl514dd1t715f/fs',
                );
            });

            it('returns null for a direct media file and for empty/non-string input', () => {
                expect($t._videoEmbedUrl('https://example.com/clip.mp4')).toBeNull();
                expect($t._videoEmbedUrl('')).toBeNull();
                expect($t._videoEmbedUrl(null)).toBeNull();
                expect($t._videoEmbedUrl(42)).toBeNull();
            });
        });

        function openVideoHotspot(src) {
            $t.hasWebGL = () => true;
            const node = document.createElement('div');
            document.body.appendChild(node);
            const state = $t.normalize({
                version: 2,
                scenes: [
                    {
                        id: 'a',
                        src: 'asset://a.jpg',
                        hotspots: [{ id: 'v', label: 'Clip', action: { type: 'video', payload: { src } } }],
                    },
                ],
            });
            $t.renderOne(node, state, '', false);
            $t._instances[0].hotspotButtons[0].button.click();
            return node.querySelector('.three-sixty-viewer-modal-body');
        }

        it('renders an <iframe> for a provider URL (Mediateca)', () => {
            const body = openVideoHotspot('https://mediateca.educa.madrid.org/video/j6mdl514dd1t715f');
            const iframe = body.querySelector('iframe');
            expect(iframe).not.toBeNull();
            expect(iframe.src).toContain('mediateca.educa.madrid.org/video/j6mdl514dd1t715f/fs');
            expect(iframe.getAttribute('allowfullscreen')).not.toBeNull();
            expect(body.querySelector('video')).toBeNull();
        });

        it('renders an <iframe> for a Vimeo URL', () => {
            const body = openVideoHotspot('https://vimeo.com/123456789');
            const iframe = body.querySelector('iframe');
            expect(iframe).not.toBeNull();
            expect(iframe.src).toContain('player.vimeo.com/video/123456789');
        });

        it('falls back to a <video> element for a direct media file', () => {
            const body = openVideoHotspot('https://example.com/clip.mp4');
            expect(body.querySelector('iframe')).toBeNull();
            const video = body.querySelector('video');
            expect(video).not.toBeNull();
            expect(video.src).toContain('clip.mp4');
        });
    });
});
