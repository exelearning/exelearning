/**
 * Unit tests for the shared 3D Viewer interaction layer.
 *
 * Covers the pure helpers (escapeHtml / safeUrl / sanitizeHtmlDom / parseTriple),
 * the renderer-agnostic controller behaviour (markers, dialog, question,
 * guided navigation, fallback, cleanup) through the model-viewer adapter, and
 * the STL adapter (projection/occlusion, raycast placement, camera capture)
 * with a minimal THREE stub. happy-dom provides a real document.
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

// ── Minimal THREE stub (identity transforms → deterministic projection) ──
class V3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    clone() { return new V3(this.x, this.y, this.z); }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    project() { return this; }
    transformDirection() { return this; }
    subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
    normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; this.x /= l; this.y /= l; this.z /= l; return this; }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
}
function makeThreeStub(hit) {
    return {
        Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
        Vector3: V3,
        Raycaster: class { setFromCamera() {} intersectObject() { return hit ? [hit] : []; } },
    };
}
function makeStlInstance(overrides) {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
    Object.defineProperty(canvas, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 100, configurable: true });
    const mesh = {
        matrixWorld: {},
        updateMatrixWorld() {},
        localToWorld(v) { return v; },
        worldToLocal(v) { return v; },
    };
    const camera = { position: new V3(0, 0, 5), fov: 45, updateMatrixWorld() {} };
    const controls = { target: new V3(0, 0, 0), update() {} };
    return Object.assign({ canvas, mesh, camera, controls, onFrame: [], options: { src: 'x.stl' } }, overrides || {});
}

const IX = (over) => Object.assign({
    enabled: true, guidedMode: false, wrapNavigation: false, showMarkerLabels: true, activeMarkerId: '',
    markers: [
        { id: 'm1', label: 'Crater', description: '', icon: 'pin', order: 0,
          anchor: { position: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, surface: '' },
          camera: { orbit: '', target: '', fieldOfView: '' },
          action: { type: 'information', payload: { html: '<p>Hot <b>lava</b></p>' } } },
        { id: 'm2', label: 'Quiz', description: '', icon: 'question', order: 1,
          anchor: { position: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, surface: '' },
          camera: { orbit: '', target: '', fieldOfView: '' },
          action: { type: 'question', payload: { prompt: 'How hot?', type: 'single-choice',
            options: [{ id: 'o1', text: 'Hot', correct: true }, { id: 'o2', text: 'Cold', correct: false }],
            feedbackCorrect: 'Yes!', feedbackIncorrect: 'No.', attemptsAllowed: 1 } } },
    ],
}, over || {});

describe('three-d-viewer interaction layer', () => {
    let runtime;
    let originalGlobals;

    beforeEach(() => {
        originalGlobals = {
            eXe3DViewer: globalThis.eXe3DViewer,
            __threedViewerCleanupBound: globalThis.__threedViewerCleanupBound,
            THREE: globalThis.THREE,
            eXeLearning: globalThis.eXeLearning,
        };
        delete globalThis.eXe3DViewer;
        delete globalThis.__threedViewerCleanupBound;
        delete globalThis.THREE;
        globalThis.eXeLearning = { app: { project: {} } };
        runtime = loadRuntime();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        runtime?.destroyAll?.();
        globalThis.eXe3DViewer = originalGlobals.eXe3DViewer;
        globalThis.__threedViewerCleanupBound = originalGlobals.__threedViewerCleanupBound;
        globalThis.THREE = originalGlobals.THREE;
        globalThis.eXeLearning = originalGlobals.eXeLearning;
    });

    describe('pure helpers', () => {
        it('escapeHtml escapes markup metacharacters', () => {
            expect(runtime.__escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
        });
        it('safeUrl allows safe schemes and rejects javascript:', () => {
            expect(runtime.__safeUrl('https://x.org')).toBe('https://x.org');
            expect(runtime.__safeUrl('/rel/path')).toBe('/rel/path');
            expect(runtime.__safeUrl('asset://a.png')).toBe('asset://a.png');
            expect(runtime.__safeUrl('javascript:alert(1)')).toBe('');
            expect(runtime.__safeUrl('vbscript:x')).toBe('');
        });
        it('sanitizeHtmlDom strips scripts, event handlers and javascript: urls', () => {
            const out = runtime.__sanitizeHtmlDom('<p onclick="x()">hi<script>alert(1)</script><a href="javascript:evil()">l</a></p>');
            expect(out).toContain('hi');
            expect(out).not.toContain('<script');
            expect(out).not.toContain('onclick');
            expect(out).not.toContain('javascript:');
        });
        it('parseTriple parses an "x y z" string', () => {
            expect(runtime.__parseTriple('1 2 3')).toEqual({ x: 1, y: 2, z: 3 });
            expect(runtime.__parseTriple('')).toEqual({ x: 0, y: 0, z: 0 });
        });
    });

    describe('model-viewer adapter', () => {
        function setup(interaction, mode, hooks) {
            const wrapper = document.createElement('div');
            wrapper.className = 'three-d-viewer-wrapper';
            const fb = document.createElement('ul');
            fb.className = 'tdv-fallback';
            fb.hidden = true;
            wrapper.appendChild(fb);
            const mv = document.createElement('model-viewer');
            wrapper.appendChild(mv);
            document.body.appendChild(wrapper);
            const ctrl = runtime.createInteractionLayer({ wrapper, type: 'glb', modelViewer: mv }, interaction, mode || 'view', hooks || {});
            return { wrapper, mv, ctrl };
        }

        it('renders markers as slotted hotspot buttons with anchors and labels', () => {
            const { mv } = setup(IX());
            const btns = mv.querySelectorAll('.tdv-marker[slot^="hotspot-"]');
            expect(btns.length).toBe(2);
            expect(btns[0].getAttribute('slot')).toBe('hotspot-m1');
            expect(btns[0].dataset.position).toBe('0 0 0');
            expect(btns[0].dataset.normal).toBe('0 1 0');
            expect(btns[0].getAttribute('aria-label')).toBe('Crater');
            expect(btns[0].querySelector('.tdv-marker-icon.tdv-icon-pin')).toBeTruthy();
            expect(btns[0].querySelector('.tdv-marker-label').textContent).toBe('Crater');
        });

        it('hides the fallback list when markers render', () => {
            const { wrapper } = setup(IX());
            expect(wrapper.querySelector('.tdv-fallback').hidden).toBe(true);
        });

        it('opens an accessible dialog with sanitized information HTML on click', () => {
            const { wrapper, mv } = setup(IX());
            mv.querySelector('[data-marker-id="m1"]').click();
            const dialog = wrapper.querySelector('.tdv-dialog[role="dialog"]');
            expect(dialog).toBeTruthy();
            expect(dialog.getAttribute('aria-modal')).toBe('true');
            expect(dialog.getAttribute('aria-label')).toBe('Crater');
            expect(dialog.querySelector('.tdv-dialog-html').innerHTML).toContain('<b>lava</b>');
        });

        it('closes the dialog on the close button and on Escape', () => {
            const { wrapper, mv } = setup(IX());
            mv.querySelector('[data-marker-id="m1"]').click();
            wrapper.querySelector('.tdv-dialog-close').click();
            expect(wrapper.querySelector('.tdv-dialog')).toBeNull();
            mv.querySelector('[data-marker-id="m1"]').click();
            const dialog = wrapper.querySelector('.tdv-dialog');
            dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            expect(wrapper.querySelector('.tdv-dialog')).toBeNull();
        });

        it('renders an accessible single-choice question and grades a correct answer', () => {
            const { wrapper, mv } = setup(IX());
            mv.querySelector('[data-marker-id="m2"]').click();
            const fieldset = wrapper.querySelector('fieldset.tdv-question');
            expect(fieldset.querySelector('legend').textContent).toBe('How hot?');
            const radios = fieldset.querySelectorAll('input[type="radio"]');
            expect(radios.length).toBe(2);
            expect(radios[0].name).toBe('tdv-q-m2');
            radios[0].checked = true;
            wrapper.querySelector('.tdv-q-check').click();
            const fb = wrapper.querySelector('.tdv-q-feedback');
            expect(fb.className).toContain('tdv-q-feedback--correct');
            expect(fb.getAttribute('aria-live')).toBe('polite');
            expect(fb.textContent).toBe('Yes!');
        });

        it('marks an incorrect answer and disables checking when attempts run out', () => {
            const { wrapper, mv } = setup(IX());
            mv.querySelector('[data-marker-id="m2"]').click();
            const radios = wrapper.querySelectorAll('.tdv-question input[type="radio"]');
            radios[1].checked = true; // wrong
            const check = wrapper.querySelector('.tdv-q-check');
            check.click();
            const fb = wrapper.querySelector('.tdv-q-feedback');
            expect(fb.className).toContain('tdv-q-feedback--incorrect');
            expect(check.disabled).toBe(true); // attemptsAllowed = 1
        });

        it('reveals the fallback list when there is no usable adapter', () => {
            // type unknown → no adapter constructed
            const wrapper = document.createElement('div');
            wrapper.className = 'three-d-viewer-wrapper';
            const fb = document.createElement('ul');
            fb.className = 'tdv-fallback';
            fb.hidden = true;
            wrapper.appendChild(fb);
            document.body.appendChild(wrapper);
            runtime.createInteractionLayer({ wrapper, type: 'obj' }, IX(), 'view', {});
            expect(fb.hidden).toBe(false);
        });

        it('cleans up markers, dialog and listeners on destroy', () => {
            const { wrapper, mv, ctrl } = setup(IX());
            mv.querySelector('[data-marker-id="m1"]').click();
            ctrl.destroy();
            expect(wrapper.querySelector('.tdv-dialog')).toBeNull();
            expect(mv.querySelectorAll('.tdv-marker').length).toBe(0);
        });
    });

    describe('guided navigation', () => {
        function setupGuided() {
            const wrapper = document.createElement('div');
            wrapper.className = 'three-d-viewer-wrapper';
            const mv = document.createElement('model-viewer');
            wrapper.appendChild(mv);
            document.body.appendChild(wrapper);
            const ctrl = runtime.createInteractionLayer({ wrapper, type: 'glb', modelViewer: mv }, IX({ guidedMode: true }), 'view', {});
            return { wrapper, ctrl };
        }

        it('builds nav controls and disables prev at the start (no wrap)', () => {
            const { wrapper } = setupGuided();
            const nav = wrapper.querySelector('.tdv-guided-nav');
            expect(nav).toBeTruthy();
            expect(nav.hidden).toBe(false);
            expect(nav.querySelector('.tdv-nav-prev').textContent).toBe('Previous');
            // no active marker yet → prev disabled, status 0 / 2
            expect(nav.querySelector('.tdv-nav-prev').disabled).toBe(true);
            expect(nav.querySelector('.tdv-guided-status').textContent).toContain('/ 2');
        });

        it('advances with next() and updates disabled state + live status', () => {
            const { wrapper, ctrl } = setupGuided();
            const nav = wrapper.querySelector('.tdv-guided-nav');
            ctrl.next(); // → marker 0 (first): prev disabled, next enabled
            expect(ctrl.getActiveId()).toBe('m1');
            expect(nav.querySelector('.tdv-nav-prev').disabled).toBe(true);
            expect(nav.querySelector('.tdv-nav-next').disabled).toBe(false);
            expect(nav.querySelector('.tdv-guided-status').textContent).toContain('1 / 2');
            ctrl.next(); // → marker 1 (last): prev enabled, next disabled
            expect(ctrl.getActiveId()).toBe('m2');
            expect(nav.querySelector('.tdv-nav-prev').disabled).toBe(false);
            expect(nav.querySelector('.tdv-nav-next').disabled).toBe(true);
            expect(nav.querySelector('.tdv-guided-status').textContent).toContain('2 / 2');
        });
    });

    describe('STL adapter (with THREE stub)', () => {
        it('raycastFromPointer returns local position and face normal', () => {
            globalThis.THREE = makeThreeStub({ point: new V3(0.2, 0.1, 0), face: { normal: new V3(0, 0, 1) } });
            const inst = makeStlInstance();
            const hit = runtime.raycastFromPointer(inst, 50, 50);
            expect(hit.position).toEqual({ x: 0.2, y: 0.1, z: 0 });
            expect(hit.normal).toEqual({ x: 0, y: 0, z: 1 });
        });

        it('renders a marker overlay and reprojects onto the canvas each frame', () => {
            globalThis.THREE = makeThreeStub(null);
            const wrapper = document.createElement('div');
            wrapper.className = 'three-d-viewer-wrapper';
            document.body.appendChild(wrapper);
            const inst = makeStlInstance();
            runtime.createInteractionLayer({ wrapper, type: 'stl', instance: inst }, IX({ guidedMode: false }), 'view', {});
            const layer = wrapper.querySelector('.tdv-marker-layer');
            expect(layer).toBeTruthy();
            const btn = layer.querySelector('.tdv-marker.tdv-marker--stl[data-marker-id="m1"]');
            expect(btn).toBeTruthy();
            // simulate a frame
            expect(inst.onFrame.length).toBe(1);
            inst.onFrame[0]();
            // marker at NDC (0,0,0) → centre of a 200x100 canvas
            expect(btn.style.left).toBe('100px');
            expect(btn.style.top).toBe('50px');
            expect(btn.classList.contains('tdv-marker--hidden')).toBe(false);
        });

        it('hides a marker whose surface normal faces away from the camera', () => {
            globalThis.THREE = makeThreeStub(null);
            const wrapper = document.createElement('div');
            document.body.appendChild(wrapper);
            const inst = makeStlInstance();
            const ix = IX();
            ix.markers = [{ id: 'back', label: 'Back', icon: 'circle', order: 0,
                anchor: { position: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: -1 }, surface: '' },
                camera: { orbit: '', target: '', fieldOfView: '' },
                action: { type: 'information', payload: { html: 'x' } } }];
            runtime.createInteractionLayer({ wrapper, type: 'stl', instance: inst }, ix, 'view', {});
            inst.onFrame[0]();
            const btn = wrapper.querySelector('[data-marker-id="back"]');
            expect(btn.classList.contains('tdv-marker--hidden')).toBe(true);
            expect(btn.getAttribute('aria-hidden')).toBe('true');
        });

        it('captures and applies STL camera views', () => {
            globalThis.THREE = makeThreeStub(null);
            const wrapper = document.createElement('div');
            document.body.appendChild(wrapper);
            const inst = makeStlInstance();
            const ctrl = runtime.createInteractionLayer({ wrapper, type: 'stl', instance: inst }, IX(), 'edit', {});
            const cam = ctrl.captureCamera();
            expect(cam.orbit).toBe('0 0 5');
            expect(cam.target).toBe('0 0 0');
            expect(cam.fieldOfView).toBe('45deg');
        });

        it('places a marker via a canvas click in placement mode', () => {
            globalThis.THREE = makeThreeStub({ point: new V3(0.5, 0.5, 0), face: { normal: new V3(1, 0, 0) } });
            const wrapper = document.createElement('div');
            document.body.appendChild(wrapper);
            const inst = makeStlInstance();
            let placed = null;
            const ctrl = runtime.createInteractionLayer({ wrapper, type: 'stl', instance: inst }, IX({ markers: [] }), 'edit', {
                onPlaced: (anchor) => { placed = anchor; },
            });
            ctrl.enterPlacementMode();
            inst.canvas.dispatchEvent(new window.MouseEvent('click', { clientX: 40, clientY: 20, bubbles: true }));
            expect(placed).toBeTruthy();
            expect(placed.position).toEqual({ x: 0.5, y: 0.5, z: 0 });
            expect(placed.normal).toEqual({ x: 1, y: 0, z: 0 });
            expect(placed.camera.orbit).toBe('0 0 5');
        });

        it('removes its onFrame callback and overlay on destroy', () => {
            globalThis.THREE = makeThreeStub(null);
            const wrapper = document.createElement('div');
            document.body.appendChild(wrapper);
            const inst = makeStlInstance();
            const ctrl = runtime.createInteractionLayer({ wrapper, type: 'stl', instance: inst }, IX(), 'view', {});
            expect(inst.onFrame.length).toBe(1);
            ctrl.destroy();
            expect(inst.onFrame.length).toBe(0);
            expect(wrapper.querySelector('.tdv-marker-layer')).toBeNull();
        });
    });
});
