/**
 * Unit tests for three-sixty-viewer iDevice (edition) — v2 tour schema.
 */

/* eslint-disable no-undef */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('three-sixty-viewer iDevice (edition)', () => {
    let $exeDevice;
    let container;

    beforeEach(() => {
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
        container = document.createElement('div');
        container.setAttribute('idevice-id', 'idev-test');
        document.body.appendChild(container);
        $exeDevice = global.loadIdevice(join(__dirname, 'three-sixty-viewer.js'));
    });

    afterEach(() => {
        if ($exeDevice && typeof $exeDevice.destroyPreview === 'function') {
            $exeDevice.destroyPreview();
        }
        global.$exeDevice = undefined;
    });

    describe('normalizeData (v2 schema)', () => {
        it('produces a one-scene tour from null input', () => {
            const n = $exeDevice.normalizeData(null);
            expect(n.version).toBe(2);
            expect(Array.isArray(n.scenes)).toBe(true);
            expect(n.scenes.length).toBe(1);
            expect(n.scenes[0].src).toBe('');
            expect(n.scenes[0].initialView).toEqual({ yaw: 0, pitch: 0, fov: 75 });
            expect(n.scenes[0].hotspots).toEqual([]);
            expect(n.startSceneId).toBe(n.scenes[0].id);
            expect(n.behaviour.zoomEnabled).toBe(true);
            expect(n.behaviour.imageAdjustments).toEqual({ brightness: 1, contrast: 1, saturation: 1 });
        });

        it('produces a one-scene tour from undefined / non-object input', () => {
            const n1 = $exeDevice.normalizeData(undefined);
            expect(n1.scenes.length).toBe(1);
            const n2 = $exeDevice.normalizeData('string');
            expect(n2.scenes.length).toBe(1);
            expect(n2.scenes[0].initialView.fov).toBe(75);
        });

        it('clamps yaw / pitch / fov inside scene initialView', () => {
            const big = $exeDevice.normalizeData({ initialView: { yaw: 500, pitch: 200, fov: 5 } });
            expect(big.scenes[0].initialView.yaw).toBe(180);
            expect(big.scenes[0].initialView.pitch).toBe(90);
            expect(big.scenes[0].initialView.fov).toBe(30);
        });

        it('clamps autorotate.speed in behaviour', () => {
            expect($exeDevice.normalizeData({ autorotate: { speed: 50 } }).behaviour.autorotate.speed).toBe(10);
            expect($exeDevice.normalizeData({ autorotate: { speed: -5 } }).behaviour.autorotate.speed).toBe(0);
        });

        it('coerces numeric strings inside initialView', () => {
            const n = $exeDevice.normalizeData({ initialView: { yaw: '45', fov: '90' } });
            expect(n.scenes[0].initialView.yaw).toBe(45);
            expect(n.scenes[0].initialView.fov).toBe(90);
        });

        it('falls back to defaults for non-numeric initialView values', () => {
            const n = $exeDevice.normalizeData({ initialView: { yaw: 'abc', fov: {} } });
            expect(n.scenes[0].initialView.yaw).toBe(0);
            expect(n.scenes[0].initialView.fov).toBe(75);
        });

        it('preserves explicit false for zoom / fullscreen on the behaviour block', () => {
            const n = $exeDevice.normalizeData({ zoomEnabled: false, fullscreenEnabled: false });
            expect(n.behaviour.zoomEnabled).toBe(false);
            expect(n.behaviour.fullscreenEnabled).toBe(false);
        });

        it('ignores malformed nested objects', () => {
            const n = $exeDevice.normalizeData({ initialView: 'bad', autorotate: null });
            expect(n.scenes[0].initialView.yaw).toBe(0);
            expect(n.behaviour.autorotate.enabled).toBe(false);
        });
    });

    describe('migrateToV2', () => {
        it('lifts a v1 single-image payload into a one-scene tour', () => {
            const v1 = {
                ideviceId: 'idev-1',
                src: 'asset://pano.jpg',
                alt: 'Mountain',
                initialView: { yaw: 90, pitch: 30, fov: 60 },
                autorotate: { enabled: true, speed: 2 },
                zoomEnabled: false,
                fullscreenEnabled: true,
            };
            const v2 = $exeDevice.normalizeData(v1);
            expect(v2.version).toBe(2);
            expect(v2.ideviceId).toBe('idev-1');
            expect(v2.scenes.length).toBe(1);
            expect(v2.scenes[0].src).toBe('asset://pano.jpg');
            expect(v2.scenes[0].alt).toBe('Mountain');
            expect(v2.scenes[0].initialView).toEqual({ yaw: 90, pitch: 30, fov: 60 });
            expect(v2.behaviour.autorotate).toEqual({ enabled: true, speed: 2 });
            expect(v2.behaviour.zoomEnabled).toBe(false);
            expect(v2.behaviour.fullscreenEnabled).toBe(true);
            expect(v2.startSceneId).toBe(v2.scenes[0].id);
        });

        it('keeps v2 input unchanged through normalize', () => {
            const v2 = {
                version: 2,
                startSceneId: 'scene-2',
                scenes: [
                    { id: 'scene-1', src: 'a.jpg', alt: 'A', hotspots: [] },
                    { id: 'scene-2', src: 'b.jpg', alt: 'B', hotspots: [] },
                ],
                behaviour: { renderQuality: 'medium', zoomEnabled: false },
            };
            const n = $exeDevice.normalizeData(v2);
            expect(n.scenes.length).toBe(2);
            expect(n.startSceneId).toBe('scene-2');
            expect(n.behaviour.renderQuality).toBe('medium');
            expect(n.behaviour.zoomEnabled).toBe(false);
        });

        it('falls back startSceneId to the first scene when the requested id is missing', () => {
            const n = $exeDevice.normalizeData({
                version: 2,
                startSceneId: 'does-not-exist',
                scenes: [{ id: 'only-one' }],
                behaviour: {},
            });
            expect(n.startSceneId).toBe('only-one');
        });

        it('clamps imageAdjustments and rejects unknown render quality / label position', () => {
            const n = $exeDevice.normalizeData({
                version: 2,
                scenes: [{ id: 's1' }],
                behaviour: {
                    renderQuality: 'ultra',
                    labelPosition: 'somewhere',
                    imageAdjustments: { brightness: 99, contrast: -1, saturation: 'x' },
                },
            });
            expect(n.behaviour.renderQuality).toBe('high');
            expect(n.behaviour.labelPosition).toBe('right');
            expect(n.behaviour.imageAdjustments.brightness).toBe(3);
            expect(n.behaviour.imageAdjustments.contrast).toBe(0.1);
            expect(n.behaviour.imageAdjustments.saturation).toBe(1);
        });
    });

    describe('scene management helpers', () => {
        beforeEach(() => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
        });

        it('addScene appends a new scene with a unique id', () => {
            const before = $exeDevice.state.scenes.length;
            const added = $exeDevice.addScene();
            expect($exeDevice.state.scenes.length).toBe(before + 1);
            expect(added.id).not.toBe($exeDevice.state.scenes[0].id);
        });

        it('duplicateScene clones a scene and gives it a new id and new hotspot ids', () => {
            const sc = $exeDevice.state.scenes[0];
            sc.title = 'Original';
            sc.hotspots.push($exeDevice.normalizeHotspot({ id: 'hs-1', label: 'A' }));
            const copy = $exeDevice.duplicateScene(0);
            expect($exeDevice.state.scenes.length).toBe(2);
            expect(copy.id).not.toBe(sc.id);
            expect(copy.title).toContain('copy');
            expect(copy.hotspots.length).toBe(1);
            expect(copy.hotspots[0].id).not.toBe('hs-1');
        });

        it('removeScene falls back to a default scene when the last one is removed', () => {
            $exeDevice.removeScene(0);
            expect($exeDevice.state.scenes.length).toBe(1);
            expect($exeDevice.state.startSceneId).toBe($exeDevice.state.scenes[0].id);
        });

        it('removeScene repairs goToScene hotspots that pointed at the removed scene', () => {
            $exeDevice.addScene();
            const target = $exeDevice.state.scenes[1];
            $exeDevice.state.scenes[0].hotspots.push(
                $exeDevice.normalizeHotspot({
                    action: { type: 'goToScene', payload: { sceneId: target.id } },
                }),
            );
            $exeDevice.removeScene(1);
            expect($exeDevice.state.scenes[0].hotspots[0].action.payload.sceneId).toBe('');
        });

        it('setStartScene keeps current start when requested id is missing', () => {
            const original = $exeDevice.state.startSceneId;
            $exeDevice.setStartScene('non-existent');
            expect($exeDevice.state.startSceneId).toBe(original);
        });

        it('addHotspot clamps yaw/pitch and pushes onto active scene', () => {
            const h = $exeDevice.addHotspot(500, 200);
            expect(h.yaw).toBe(180);
            expect(h.pitch).toBe(90);
            expect($exeDevice.getActiveScene().hotspots).toContain(h);
        });
    });

    describe('hotspot normalization', () => {
        it('normalizes unknown action type to text', () => {
            const h = $exeDevice.normalizeHotspot({ action: { type: 'mystery', payload: {} } });
            expect(h.action.type).toBe('text');
            expect(h.action.payload).toEqual({ html: '' });
        });

        it('clamps yaw and pitch', () => {
            const h = $exeDevice.normalizeHotspot({ yaw: -500, pitch: 999 });
            expect(h.yaw).toBe(-180);
            expect(h.pitch).toBe(90);
        });

        it('keeps a well-formed link payload and defaults newTab to true', () => {
            const h = $exeDevice.normalizeHotspot({
                action: { type: 'link', payload: { url: 'https://example.com/x' } },
            });
            expect(h.action.type).toBe('link');
            expect(h.action.payload.url).toBe('https://example.com/x');
            expect(h.action.payload.newTab).toBe(true);
        });

        it('coerces non-string link url to empty string and preserves explicit newTab=false', () => {
            const h = $exeDevice.normalizeHotspot({
                action: { type: 'link', payload: { url: 123, newTab: false } },
            });
            expect(h.action.payload.url).toBe('');
            expect(h.action.payload.newTab).toBe(false);
        });

        it('exposes "link" as a valid hotspot action type', () => {
            expect($exeDevice.HOTSPOT_ACTION_TYPES).toContain('link');
            expect($exeDevice.actionTypeLabel('link')).toMatch(/link/i);
        });
    });

    describe('init with empty previousData', () => {
        beforeEach(() => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
        });

        it('applies defaults to scene 0 internal state', () => {
            expect($exeDevice.state.scenes[0].src).toBe('');
            expect($exeDevice.state.scenes[0].initialView.fov).toBe(75);
            expect($exeDevice.state.behaviour.zoomEnabled).toBe(true);
        });

        it('renders the form HTML with all expected controls', () => {
            const ids = [
                '#threeSixtyImageButton',
                '#threeSixtyAlt',
                '#threeSixtyYaw',
                '#threeSixtyPitch',
                '#threeSixtyFov',
                '#threeSixtyAutorotate',
                '#threeSixtyAutorotateSpeed',
                '#threeSixtyZoom',
                '#threeSixtyFullscreen',
                '#threeSixtyShowLabels',
                '#threeSixtyPreview',
                '#threeSixtyPreviewMessage',
                '#threeSixtySceneList',
                '#threeSixtyAddScene',
                '#threeSixtyHotspotList',
                '#threeSixtyAddHotspot',
                '#threeSixtySceneTitle',
                '#threeSixtySceneDescription',
            ];
            ids.forEach(id => {
                expect(container.querySelector(id)).not.toBeNull();
            });
        });

        it('shows empty-state message when no image is selected', () => {
            const label = container.querySelector('#threeSixtyImageName');
            expect(label.textContent).toMatch(/No image selected/i);
        });

        it('hides the clear button when no image is selected', () => {
            const clearBtn = container.querySelector('#threeSixtyImageClear');
            expect(clearBtn.hasAttribute('hidden')).toBe(true);
        });

        it('renders one entry in the scene list by default', () => {
            const items = container.querySelectorAll('#threeSixtySceneList .three-sixty-scene-item');
            expect(items.length).toBe(1);
        });
    });

    describe('init with existing v1 data hydrates form from the migrated scene 0', () => {
        beforeEach(() => {
            $exeDevice.init(
                container,
                {
                    ideviceId: 'idev-42',
                    src: 'asset://abc.jpg',
                    alt: 'A mountain vista',
                    initialView: { yaw: 45, pitch: -10, fov: 100 },
                    autorotate: { enabled: true, speed: 3.5 },
                    zoomEnabled: false,
                    fullscreenEnabled: false,
                },
                '',
            );
            $exeDevice.updatePreviewSoon = function () {};
        });

        it('applies migrated scene values into the form', () => {
            expect(container.querySelector('#threeSixtyAlt').value).toBe('A mountain vista');
            expect(container.querySelector('#threeSixtyYaw').value).toBe('45');
            expect(container.querySelector('#threeSixtyPitch').value).toBe('-10');
            expect(container.querySelector('#threeSixtyFov').value).toBe('100');
            expect(container.querySelector('#threeSixtyAutorotateSpeed').value).toBe('3.5');
            expect(container.querySelector('#threeSixtyAutorotate').checked).toBe(true);
            expect(container.querySelector('#threeSixtyZoom').checked).toBe(false);
            expect(container.querySelector('#threeSixtyFullscreen').checked).toBe(false);
        });

        it('shows the image label and clear button when scene 0 has a src', () => {
            const label = container.querySelector('#threeSixtyImageName');
            expect(label.textContent).toContain('asset://abc.jpg');
            const clearBtn = container.querySelector('#threeSixtyImageClear');
            expect(clearBtn.hasAttribute('hidden')).toBe(false);
        });

        it('truncates very long src labels', () => {
            const longSrc = 'a'.repeat(200);
            expect($exeDevice.truncateLabel(longSrc).length).toBeLessThan(longSrc.length);
            expect($exeDevice.truncateLabel(longSrc)).toContain('…');
        });
    });

    describe('save()', () => {
        it('returns a v2-shaped JSON object', () => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
            const result = $exeDevice.save();
            expect(typeof result).toBe('object');
            expect(result.version).toBe(2);
            expect(Array.isArray(result.scenes)).toBe(true);
            expect(result.scenes.length).toBe(1);
            expect(result.behaviour).toBeDefined();
        });

        it('preserves ideviceId from the container attribute', () => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
            const result = $exeDevice.save();
            expect(result.ideviceId).toBe('idev-test');
        });

        it('re-reads the active scene alt input at save time', () => {
            $exeDevice.init(container, { alt: 'initial' }, '');
            $exeDevice.updatePreviewSoon = function () {};
            container.querySelector('#threeSixtyAlt').value = 'updated at save';
            const result = $exeDevice.save();
            expect(result.scenes[0].alt).toBe('updated at save');
        });

        it('round-trips a v2 tour without data loss', () => {
            const original = {
                version: 2,
                ideviceId: 'idev-test',
                startSceneId: 'scene-2',
                scenes: [
                    {
                        id: 'scene-1',
                        title: 'A',
                        src: 'asset://a.jpg',
                        alt: 'A scene',
                        initialView: { yaw: 0, pitch: 0, fov: 75 },
                        hotspots: [],
                    },
                    {
                        id: 'scene-2',
                        title: 'B',
                        src: 'asset://b.jpg',
                        alt: 'B scene',
                        initialView: { yaw: 30, pitch: 15, fov: 90 },
                        hotspots: [
                            {
                                id: 'hs-1',
                                label: 'Go',
                                icon: 'circle',
                                yaw: 10,
                                pitch: 5,
                                action: { type: 'goToScene', payload: { sceneId: 'scene-1' } },
                            },
                        ],
                    },
                ],
                behaviour: {
                    autorotate: { enabled: true, speed: 2 },
                    zoomEnabled: false,
                    fullscreenEnabled: true,
                    renderQuality: 'high',
                    showLabels: true,
                    labelPosition: 'right',
                    imageAdjustments: { brightness: 1, contrast: 1, saturation: 1 },
                },
            };
            $exeDevice.init(container, original, '');
            $exeDevice.updatePreviewSoon = function () {};
            const first = $exeDevice.save();
            expect(first.scenes.length).toBe(2);
            expect(first.startSceneId).toBe('scene-2');

            // Fresh instance, same data
            document.body.innerHTML = '';
            const container2 = document.createElement('div');
            container2.setAttribute('idevice-id', 'idev-test');
            document.body.appendChild(container2);
            global.$exeDevice = undefined;
            const $d2 = global.loadIdevice(join(__dirname, 'three-sixty-viewer.js'));
            $d2.init(container2, first, '');
            $d2.updatePreviewSoon = function () {};
            const second = $d2.save();
            expect(second).toEqual(first);
        });
    });

    describe('form event wiring', () => {
        beforeEach(() => {
            $exeDevice.init(container, {}, '');
            // Prevent preview loading attempts during tests
            $exeDevice.updatePreviewSoon = function () {};
        });

        it('updating #threeSixtyYaw updates active scene state', () => {
            const yaw = container.querySelector('#threeSixtyYaw');
            yaw.value = '60';
            yaw.dispatchEvent(new Event('input'));
            expect($exeDevice.getActiveScene().initialView.yaw).toBe(60);
        });

        it('updating #threeSixtyAlt updates active scene state', () => {
            const alt = container.querySelector('#threeSixtyAlt');
            alt.value = 'new alt text';
            alt.dispatchEvent(new Event('input'));
            expect($exeDevice.getActiveScene().alt).toBe('new alt text');
        });

        it('toggling #threeSixtyAutorotate updates behaviour state', () => {
            const cb = container.querySelector('#threeSixtyAutorotate');
            cb.checked = true;
            cb.dispatchEvent(new Event('change'));
            expect($exeDevice.state.behaviour.autorotate.enabled).toBe(true);
        });

        it('toggling #threeSixtyZoom updates behaviour state', () => {
            const cb = container.querySelector('#threeSixtyZoom');
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
            expect($exeDevice.state.behaviour.zoomEnabled).toBe(false);
        });

        it('toggling #threeSixtyFullscreen updates behaviour state', () => {
            const cb = container.querySelector('#threeSixtyFullscreen');
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
            expect($exeDevice.state.behaviour.fullscreenEnabled).toBe(false);
        });

        it('clear button wipes active scene src and refreshes label', () => {
            $exeDevice.getActiveScene().src = 'asset://x.jpg';
            $exeDevice.refreshImageLabel();
            const clearBtn = container.querySelector('#threeSixtyImageClear');
            clearBtn.dispatchEvent(new Event('click'));
            expect($exeDevice.getActiveScene().src).toBe('');
            const label = container.querySelector('#threeSixtyImageName');
            expect(label.textContent).toMatch(/No image selected/i);
        });

        it('clamps yaw input above the max', () => {
            const yaw = container.querySelector('#threeSixtyYaw');
            yaw.value = '999';
            yaw.dispatchEvent(new Event('input'));
            expect($exeDevice.getActiveScene().initialView.yaw).toBe(180);
        });

        it('add-scene button appends a scene', () => {
            const before = $exeDevice.state.scenes.length;
            container.querySelector('#threeSixtyAddScene').dispatchEvent(new Event('click'));
            expect($exeDevice.state.scenes.length).toBe(before + 1);
            expect(container.querySelectorAll('#threeSixtySceneList .three-sixty-scene-item').length).toBe(before + 1);
        });

        it('add-hotspot button creates a hotspot in the active scene', () => {
            container.querySelector('#threeSixtyAddHotspot').dispatchEvent(new Event('click'));
            expect($exeDevice.getActiveScene().hotspots.length).toBe(1);
            expect(container.querySelectorAll('#threeSixtyHotspotList .three-sixty-hotspot-item').length).toBe(1);
        });

        it('toggling #threeSixtyNavControls updates behaviour state', () => {
            const cb = container.querySelector('#threeSixtyNavControls');
            expect(cb).not.toBeNull();
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
            expect($exeDevice.state.behaviour.showNavControls).toBe(false);
        });
    });

    describe('pickImage', () => {
        it('calls filemanager.show when available', () => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
            const show = vi.fn();
            global.eXeLearning = {
                app: { modals: { filemanager: { show } } },
            };
            $exeDevice.pickImage();
            expect(show).toHaveBeenCalledTimes(1);
            const args = show.mock.calls[0][0];
            expect(args.accept).toBe('image');
            expect(args.multiSelect).toBe(false);
            expect(typeof args.onSelect).toBe('function');
        });

        it('onSelect sets the src on the active scene', () => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
            let savedOpts = null;
            global.eXeLearning = {
                app: {
                    modals: {
                        filemanager: {
                            show: opts => {
                                savedOpts = opts;
                            },
                        },
                    },
                },
            };
            $exeDevice.pickImage();
            savedOpts.onSelect({ assetUrl: 'asset://new-pano.jpg', blobUrl: 'blob:x' });
            expect($exeDevice.getActiveScene().src).toBe('asset://new-pano.jpg');
        });
    });

    describe('applyColorManagement', () => {
        beforeEach(() => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
        });

        afterEach(() => {
            delete global.THREE;
            if (typeof window !== 'undefined') delete window.THREE;
        });

        it('is a no-op when THREE is undefined', () => {
            const renderer = { outputColorSpace: '' };
            expect(() => $exeDevice.applyColorManagement(renderer)).not.toThrow();
            expect(renderer.outputColorSpace).toBe('');
        });

        it('is a no-op when renderer is null', () => {
            global.THREE = { SRGBColorSpace: 'srgb' };
            expect(() => $exeDevice.applyColorManagement(null)).not.toThrow();
        });

        it('sets renderer.outputColorSpace = SRGBColorSpace on modern three.js', () => {
            global.THREE = {
                SRGBColorSpace: 'srgb',
                NoToneMapping: 0,
                ColorManagement: { enabled: false },
            };
            const renderer = { outputColorSpace: '', toneMapping: 1, toneMappingExposure: 0.5 };
            $exeDevice.applyColorManagement(renderer);
            expect(renderer.outputColorSpace).toBe('srgb');
            expect(renderer.toneMapping).toBe(0);
            expect(renderer.toneMappingExposure).toBe(1);
            expect(global.THREE.ColorManagement.enabled).toBe(true);
        });

        it('falls back to renderer.outputEncoding = sRGBEncoding on legacy three.js', () => {
            global.THREE = { sRGBEncoding: 3001 };
            const renderer = { outputEncoding: 0 };
            $exeDevice.applyColorManagement(renderer);
            expect(renderer.outputEncoding).toBe(3001);
        });

        it('does not write toneMapping when property is missing', () => {
            global.THREE = { SRGBColorSpace: 'srgb' };
            const renderer = { outputColorSpace: '' };
            $exeDevice.applyColorManagement(renderer);
            expect(renderer.outputColorSpace).toBe('srgb');
            expect('toneMapping' in renderer).toBe(false);
        });
    });

    describe('applyTextureColorSpace', () => {
        afterEach(() => {
            delete global.THREE;
        });

        it('is a no-op for null texture', () => {
            global.THREE = { SRGBColorSpace: 'srgb' };
            expect(() => $exeDevice.applyTextureColorSpace(null)).not.toThrow();
        });

        it('sets colorSpace on a modern texture', () => {
            global.THREE = { SRGBColorSpace: 'srgb' };
            const texture = { colorSpace: '' };
            $exeDevice.applyTextureColorSpace(texture);
            expect(texture.colorSpace).toBe('srgb');
        });

        it('falls back to encoding on a legacy texture', () => {
            global.THREE = { sRGBEncoding: 3001 };
            const texture = { encoding: 0 };
            $exeDevice.applyTextureColorSpace(texture);
            expect(texture.encoding).toBe(3001);
        });
    });

    describe('link hotspot form wiring', () => {
        beforeEach(() => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
            // Seed one hotspot so the list renders payload inputs we can target.
            $exeDevice.addHotspot(0, 0);
            $exeDevice.renderHotspotList();
        });

        it('switching action type to "link" renders a URL input and a newTab checkbox', () => {
            const select = container.querySelector('.hotspot-action-type');
            select.value = 'link';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            expect(container.querySelector('.hotspot-payload-url')).not.toBeNull();
            expect(container.querySelector('.hotspot-payload-newTab')).not.toBeNull();
        });

        it('typing in the URL input updates the active hotspot payload', () => {
            const select = container.querySelector('.hotspot-action-type');
            select.value = 'link';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            const url = container.querySelector('.hotspot-payload-url');
            url.value = 'https://exelearning.net';
            url.dispatchEvent(new Event('input', { bubbles: true }));
            expect($exeDevice.getActiveScene().hotspots[0].action.payload.url).toBe('https://exelearning.net');
        });

        it('unchecking newTab updates the active hotspot payload', () => {
            const select = container.querySelector('.hotspot-action-type');
            select.value = 'link';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            const cb = container.querySelector('.hotspot-payload-newTab');
            expect(cb.checked).toBe(true);
            cb.checked = false;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            expect($exeDevice.getActiveScene().hotspots[0].action.payload.newTab).toBe(false);
        });

        it('round-trips a link hotspot through save()/normalizeData()', () => {
            const select = container.querySelector('.hotspot-action-type');
            select.value = 'link';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            const url = container.querySelector('.hotspot-payload-url');
            url.value = 'https://example.org';
            url.dispatchEvent(new Event('input', { bubbles: true }));
            const saved = $exeDevice.save();
            const hs = saved.scenes[0].hotspots[0];
            expect(hs.action.type).toBe('link');
            expect(hs.action.payload.url).toBe('https://example.org');
            expect(hs.action.payload.newTab).toBe(true);
        });
    });

    describe('placement mode (click on panorama to add hotspot)', () => {
        beforeEach(() => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
        });

        it('toggles _placingHotspot when the button is clicked', () => {
            expect($exeDevice._placingHotspot).toBeFalsy();
            container.querySelector('#threeSixtyPlaceHotspot').dispatchEvent(new Event('click'));
            expect($exeDevice._placingHotspot).toBe(true);
            container.querySelector('#threeSixtyPlaceHotspot').dispatchEvent(new Event('click'));
            expect($exeDevice._placingHotspot).toBe(false);
        });

        it('refreshPlacementMode adds/removes the active + placing classes', () => {
            $exeDevice._placingHotspot = true;
            $exeDevice.refreshPlacementMode();
            expect(container.querySelector('#threeSixtyPlaceHotspot').classList.contains('active')).toBe(true);
            expect(
                container
                    .querySelector('#threeSixtyPreview')
                    .classList.contains('three-sixty-preview-stage--placing'),
            ).toBe(true);
            $exeDevice._placingHotspot = false;
            $exeDevice.refreshPlacementMode();
            expect(container.querySelector('#threeSixtyPlaceHotspot').classList.contains('active')).toBe(false);
            expect(
                container
                    .querySelector('#threeSixtyPreview')
                    .classList.contains('three-sixty-preview-stage--placing'),
            ).toBe(false);
        });
    });

    describe('_clickToYawPitch (pure projection math)', () => {
        beforeEach(() => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
            global.THREE = {
                Vector3: class {
                    constructor(x, y, z) {
                        this.x = x;
                        this.y = y;
                        this.z = z;
                    }
                    // unproject simulates a camera looking forward at +Z; NDC center
                    // maps to (0, 0, +radius), so the click direction equals (x, y, z).
                    unproject() {
                        // identity: pretend NDC == world for this stub
                        return this;
                    }
                },
            };
        });

        afterEach(() => {
            delete global.THREE;
        });

        it('returns null when canvas has zero size', () => {
            const canvas = {
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
            };
            const camera = { position: { x: 0, y: 0, z: 0 } };
            expect($exeDevice._clickToYawPitch(camera, canvas, 0, 0)).toBeNull();
        });

        it('returns null when THREE is missing', () => {
            delete global.THREE;
            const canvas = {
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
            };
            const camera = { position: { x: 0, y: 0, z: 0 } };
            expect($exeDevice._clickToYawPitch(camera, canvas, 50, 50)).toBeNull();
        });

        it('center click of a forward-looking camera yields ~0 yaw and ~0 pitch', () => {
            const canvas = {
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
            };
            const camera = { position: { x: 0, y: 0, z: 0 } };
            const pose = $exeDevice._clickToYawPitch(camera, canvas, 50, 50);
            expect(pose).not.toBeNull();
            // NDC (0, 0) with z=0.5 produces direction (0, 0, 0.5) → yaw=0, pitch=0
            expect(Math.abs(pose.yaw)).toBeLessThan(1);
            expect(Math.abs(pose.pitch)).toBeLessThan(1);
        });

        it('clicking left of center yields negative yaw', () => {
            const canvas = {
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
            };
            const camera = { position: { x: 0, y: 0, z: 0 } };
            // Click at x=10 → ndcX ≈ -0.8; with our identity unproject this means dx<0 → yaw<0
            const pose = $exeDevice._clickToYawPitch(camera, canvas, 10, 50);
            expect(pose.yaw).toBeLessThan(0);
        });

        it('clicking above center yields positive pitch', () => {
            const canvas = {
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
            };
            const camera = { position: { x: 0, y: 0, z: 0 } };
            // Click at y=10 (above) → ndcY ≈ +0.8 → dy>0 → pitch>0
            const pose = $exeDevice._clickToYawPitch(camera, canvas, 50, 10);
            expect(pose.pitch).toBeGreaterThan(0);
        });
    });

    describe('destroyPreview', () => {
        it('is safe to call when there is no preview', () => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
            expect(() => $exeDevice.destroyPreview()).not.toThrow();
        });

        it('disposes all three.js resources when a preview exists', () => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
            const stops = [];
            const disposes = [];
            $exeDevice._preview = {
                stop: () => stops.push(1),
                controls: { dispose: () => disposes.push('controls') },
                geometry: { dispose: () => disposes.push('geometry') },
                material: { dispose: () => disposes.push('material') },
                texture: { dispose: () => disposes.push('texture') },
                renderer: {
                    dispose: () => disposes.push('renderer'),
                    domElement: document.createElement('canvas'),
                },
            };
            $exeDevice.destroyPreview();
            expect(stops).toEqual([1]);
            expect(disposes).toEqual(
                expect.arrayContaining(['controls', 'geometry', 'material', 'texture', 'renderer']),
            );
            expect($exeDevice._preview).toBeNull();
        });
    });

    describe('flat (non-360) scenes', () => {
        it('defaults scene projection to equirectangular', () => {
            const n = $exeDevice.normalizeData(null);
            expect(n.scenes[0].projection).toBe('equirectangular');
        });

        it('keeps a flat projection through normalize and rejects unknown values', () => {
            expect($exeDevice.normalizeScene({ projection: 'flat' }).projection).toBe('flat');
            expect($exeDevice.normalizeScene({ projection: 'bogus' }).projection).toBe('equirectangular');
            expect($exeDevice.normalizeScene({}).projection).toBe('equirectangular');
        });

        it('migrated v1 data defaults to equirectangular projection', () => {
            const n = $exeDevice.normalizeData({ src: 'old.jpg', initialView: { yaw: 10 } });
            expect(n.scenes[0].projection).toBe('equirectangular');
        });

        it('normalizes and clamps hotspot x/y, defaulting to 50', () => {
            expect($exeDevice.normalizeHotspot({}).x).toBe(50);
            expect($exeDevice.normalizeHotspot({}).y).toBe(50);
            expect($exeDevice.normalizeHotspot({ x: 200, y: -5 }).x).toBe(100);
            expect($exeDevice.normalizeHotspot({ x: 200, y: -5 }).y).toBe(0);
            expect($exeDevice.normalizeHotspot({ x: '30' }).x).toBe(30);
        });

        it('addHotspotFlat clamps x/y and pushes onto the active scene', () => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
            const h = $exeDevice.addHotspotFlat(150, -10);
            expect(h.x).toBe(100);
            expect(h.y).toBe(0);
            expect($exeDevice.getActiveScene().hotspots).toContain(h);
        });

        it('round-trips projection and hotspot x/y through save()', () => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
            const scene = $exeDevice.getActiveScene();
            scene.projection = 'flat';
            scene.src = 'asset://flat.jpg';
            $exeDevice.addHotspotFlat(25, 75);
            const saved = $exeDevice.save();
            expect(saved.scenes[0].projection).toBe('flat');
            expect(saved.scenes[0].hotspots[0].x).toBe(25);
            expect(saved.scenes[0].hotspots[0].y).toBe(75);
        });

        describe('createForm with a flat scene', () => {
            beforeEach(() => {
                $exeDevice.init(container, {}, '');
                $exeDevice.updatePreviewSoon = function () {};
                $exeDevice.getActiveScene().projection = 'flat';
                $exeDevice.createForm();
                $exeDevice.addFormBehaviour();
            });

            it('checks the panorama toggle off and hides the Initial view fields', () => {
                expect(container.querySelector('#threeSixtyIsPanorama').checked).toBe(false);
                expect(container.querySelector('#threeSixtyYaw')).toBeNull();
                expect(container.querySelector('#threeSixtyPitch')).toBeNull();
                expect(container.querySelector('#threeSixtyFov')).toBeNull();
            });

            it('renders X/Y inputs instead of yaw/pitch in the hotspot list', () => {
                $exeDevice.addHotspotFlat(40, 60);
                $exeDevice.renderHotspotList();
                expect(container.querySelector('#threeSixtyHotspotList .hotspot-x')).not.toBeNull();
                expect(container.querySelector('#threeSixtyHotspotList .hotspot-y')).not.toBeNull();
                expect(container.querySelector('#threeSixtyHotspotList .hotspot-yaw')).toBeNull();
            });

            it('editing the X input updates the hotspot x', () => {
                $exeDevice.addHotspotFlat(40, 60);
                $exeDevice.renderHotspotList();
                const xInput = container.querySelector('#threeSixtyHotspotList .hotspot-x');
                xInput.value = '90';
                xInput.dispatchEvent(new Event('input', { bubbles: true }));
                expect($exeDevice.getActiveScene().hotspots[0].x).toBe(90);
            });

            it('add-hotspot button places a flat hotspot at the centre', () => {
                container.querySelector('#threeSixtyAddHotspot').dispatchEvent(new Event('click'));
                const hs = $exeDevice.getActiveScene().hotspots;
                expect(hs.length).toBe(1);
                expect(hs[0].x).toBe(50);
                expect(hs[0].y).toBe(50);
            });
        });

        it('toggling the panorama checkbox off switches the scene to flat', () => {
            $exeDevice.init(container, {}, '');
            $exeDevice.updatePreviewSoon = function () {};
            const cb = container.querySelector('#threeSixtyIsPanorama');
            expect(cb.checked).toBe(true);
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
            expect($exeDevice.getActiveScene().projection).toBe('flat');
            // Form rebuilt: the new checkbox reflects flat state.
            expect(container.querySelector('#threeSixtyIsPanorama').checked).toBe(false);
        });

        describe('containedImageRect', () => {
            it('falls back to the full box when natural dimensions are missing', () => {
                expect($exeDevice.containedImageRect(0, 0, 200, 100)).toEqual({
                    left: 0,
                    top: 0,
                    width: 200,
                    height: 100,
                });
            });

            it('letterboxes a wide image inside a square box', () => {
                const r = $exeDevice.containedImageRect(200, 100, 100, 100);
                expect(r.width).toBe(100);
                expect(r.height).toBe(50);
                expect(r.top).toBe(25);
                expect(r.left).toBe(0);
            });

            it('pillarboxes a tall image inside a wide box', () => {
                const r = $exeDevice.containedImageRect(100, 200, 200, 100);
                expect(r.width).toBe(50);
                expect(r.height).toBe(100);
                expect(r.left).toBe(75);
                expect(r.top).toBe(0);
            });
        });

        describe('_clickToXY', () => {
            it('converts a click to x/y percent within the image rect', () => {
                const overlay = document.createElement('div');
                overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
                const img = { naturalWidth: 200, naturalHeight: 100 };
                const preview = { overlay, img };
                // Centre of a full-box image → 50/50
                expect($exeDevice._clickToXY(preview, 100, 50)).toEqual({ x: 50, y: 50 });
                // Top-left corner → clamped to 0/0
                expect($exeDevice._clickToXY(preview, 0, 0)).toEqual({ x: 0, y: 0 });
            });

            it('returns null when the overlay has no size', () => {
                const overlay = document.createElement('div');
                overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
                expect($exeDevice._clickToXY({ overlay, img: {} }, 10, 10)).toBeNull();
            });
        });

        describe('createFlatPreview', () => {
            it('renders an <img> and overlay without three.js', () => {
                $exeDevice.init(container, {}, '');
                $exeDevice.updatePreviewSoon = function () {};
                const scene = $exeDevice.getActiveScene();
                scene.projection = 'flat';
                scene.src = 'asset://flat.jpg';
                const stage = container.querySelector('#threeSixtyPreview');
                const preview = $exeDevice.createFlatPreview(stage);
                expect(preview.mode).toBe('flat');
                expect(stage.querySelector('img.three-sixty-preview-flat')).not.toBeNull();
                expect(stage.querySelector('.three-sixty-viewer-overlay--editor')).not.toBeNull();
                preview.stop();
                $exeDevice._preview = preview;
                $exeDevice.destroyPreview();
                expect(stage.querySelector('img.three-sixty-preview-flat')).toBeNull();
            });
        });

        describe('flat preview rendering and interaction', () => {
            let scene;
            beforeEach(() => {
                $exeDevice.init(container, {}, '');
                scene = $exeDevice.getActiveScene();
                scene.projection = 'flat';
                scene.src = 'asset://flat.jpg';
                // Give the stage a stable size so positioning math is deterministic.
                const stage = container.querySelector('#threeSixtyPreview');
                stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });
            });

            it('renderPreview builds a flat preview without three.js', () => {
                $exeDevice.renderPreview();
                expect($exeDevice._preview).not.toBeNull();
                expect($exeDevice._preview.mode).toBe('flat');
                expect(container.querySelector('#threeSixtyPreview img.three-sixty-preview-flat')).not.toBeNull();
            });

            it('positions flat hotspots by x/y percent of the displayed image', () => {
                $exeDevice.addHotspotFlat(25, 75);
                $exeDevice.renderPreview();
                const p = $exeDevice._preview;
                p.overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });
                $exeDevice._positionEditorHotspots();
                const btn = p.hotspotButtons[0].button;
                expect(btn.style.left).toBe('100px'); // 25% of 400
                expect(btn.style.top).toBe('150px'); // 75% of 200
            });

            it('dragging a flat hotspot updates its x/y from the pointer position', () => {
                $exeDevice.addHotspotFlat(10, 10);
                $exeDevice.renderPreview();
                const p = $exeDevice._preview;
                p.overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });
                const btn = p.hotspotButtons[0].button;

                const down = new Event('pointerdown');
                down.clientX = 0;
                down.clientY = 0;
                btn.dispatchEvent(down);

                const move = new Event('pointermove');
                move.clientX = 200;
                move.clientY = 100;
                window.dispatchEvent(move);

                expect($exeDevice.getActiveScene().hotspots[0].x).toBe(50);
                expect($exeDevice.getActiveScene().hotspots[0].y).toBe(50);

                window.dispatchEvent(new Event('pointerup'));
            });

            it('placement click on the flat preview adds a hotspot at the clicked point', () => {
                $exeDevice.renderPreview();
                const p = $exeDevice._preview;
                p.overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });
                $exeDevice._placingHotspot = true;
                const img = p.img;
                const click = new Event('click');
                click.clientX = 100; // 25%
                click.clientY = 150; // 75%
                img.dispatchEvent(click);
                const hs = $exeDevice.getActiveScene().hotspots;
                expect(hs.length).toBe(1);
                expect(hs[0].x).toBe(25);
                expect(hs[0].y).toBe(75);
                expect($exeDevice._placingHotspot).toBe(false);
            });
        });
    });
});
