/**
 * Unit tests for the 3D Viewer interaction EDITOR UI (edition).
 *
 * Exercises the DOM-driven authoring flow (enable, placement callback, marker
 * list, reorder/delete, marker editor incl. question fields) against a real
 * happy-dom document. The WebGL preview attach is stubbed out — it is covered
 * by the Playwright spec.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadIdevice(code) {
    const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$exeDevice;
}

function setupEditor(initial) {
    global.$exeDevice = undefined;
    global.location = { origin: 'http://localhost:8080', protocol: 'http:', host: 'localhost:8080', href: 'http://localhost:8080/workarea' };
    global.eXeLearning = { symfony: {}, app: { project: {} } };
    global._ = (s) => s;
    global.c_ = (s) => s;
    const code = readFileSync(join(__dirname, 'three-d-viewer.js'), 'utf-8');
    const dev = loadIdevice(code);
    // Stub out the WebGL preview machinery so interaction wiring is inert.
    dev.ensureRuntimeLoaded = () => Promise.resolve();
    dev.getModelViewerUrl = (u) => u;
    dev.ideviceBody = document.createElement('div');
    document.body.appendChild(dev.ideviceBody);
    dev.renderEditor();
    dev.collectFormElements();
    dev.set3DViewerJSON(initial || { src: 'asset://m.glb' });
    dev.applyStateToForm();
    dev.registerInteractionBehaviours();
    return dev;
}

describe('three-d-viewer interaction editor (edition)', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('renders the Interactions fieldset with its controls', () => {
        const dev = setupEditor();
        expect(dev.ideviceBody.querySelector('#threeDInteractionsEnable')).toBeTruthy();
        expect(dev.ideviceBody.querySelector('#threeDGuidedMode')).toBeTruthy();
        expect(dev.ideviceBody.querySelector('#threeDAddMarker')).toBeTruthy();
        expect(dev.ideviceBody.querySelector('#threeDMarkerList')).toBeTruthy();
    });

    it('keeps the interactions body hidden until interactions are enabled', () => {
        const dev = setupEditor();
        expect(dev.interactionsBody.hidden).toBe(true);
        dev.formElements.interactionsEnable.checked = true;
        dev.formElements.interactionsEnable.dispatchEvent(new window.Event('change'));
        expect(dev.state.interaction.enabled).toBe(true);
        expect(dev.interactionsBody.hidden).toBe(false);
    });

    it('adds a normalized marker on placement and opens its editor', () => {
        const dev = setupEditor();
        dev.state.interaction.enabled = true;
        dev.handleMarkerPlaced({ position: { x: 0.1, y: 0.2, z: 0.3 }, normal: { x: 0, y: 1, z: 0 }, surface: '', camera: { orbit: '1 2 3', target: '0 0 0', fieldOfView: '45deg' } });
        expect(dev.state.interaction.markers.length).toBe(1);
        const m = dev.state.interaction.markers[0];
        expect(m.anchor.position).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
        expect(m.camera.orbit).toBe('1 2 3');
        // list row + editor rendered
        expect(dev.markerListEl.querySelectorAll('.tdv-marker-row').length).toBe(1);
        expect(dev.markerEditorHost.querySelector('.tdv-marker-editor')).toBeTruthy();
    });

    it('renders marker rows with reorder buttons disabled at the ends', () => {
        const dev = setupEditor({ src: 'asset://m.glb', interaction: { enabled: true, markers: [
            { id: 'a', label: 'A', action: { type: 'information', payload: { html: '' } } },
            { id: 'b', label: 'B', action: { type: 'question', payload: {} } },
        ] } });
        const rows = dev.markerListEl.querySelectorAll('.tdv-marker-row');
        expect(rows.length).toBe(2);
        expect(rows[0].querySelector('.tdv-move-up').disabled).toBe(true);
        expect(rows[1].querySelector('.tdv-move-down').disabled).toBe(true);
        expect(rows[0].querySelector('.tdv-marker-row-label').textContent).toContain('A');
        expect(rows[1].querySelector('.tdv-marker-row-label').textContent).toContain('Question');
    });

    it('reorders and deletes markers, keeping order contiguous', () => {
        const dev = setupEditor({ src: 'asset://m.glb', interaction: { enabled: true, markers: [
            { id: 'a', label: 'A', order: 0, action: { type: 'information', payload: {} } },
            { id: 'b', label: 'B', order: 1, action: { type: 'information', payload: {} } },
            { id: 'c', label: 'C', order: 2, action: { type: 'information', payload: {} } },
        ] } });
        dev.moveMarker('c', -1); // C up → A, C, B
        expect(dev.state.interaction.markers.map((m) => m.id)).toEqual(['a', 'c', 'b']);
        expect(dev.state.interaction.markers.map((m) => m.order)).toEqual([0, 1, 2]);
        dev.deleteMarker('a');
        expect(dev.state.interaction.markers.map((m) => m.id)).toEqual(['c', 'b']);
        expect(dev.state.interaction.markers.map((m) => m.order)).toEqual([0, 1]);
    });

    it('edits a marker into a single-choice question and persists it', () => {
        const dev = setupEditor({ src: 'asset://m.glb', interaction: { enabled: true, markers: [
            { id: 'm', label: '', action: { type: 'information', payload: { html: '' } } },
        ] } });
        dev.openMarkerEditor('m');
        const host = dev.markerEditorHost;
        host.querySelector('#tdvMkLabel').value = 'The crater';
        // switch action type to question
        const typeSel = host.querySelector('#tdvMkType');
        typeSel.value = 'question';
        typeSel.dispatchEvent(new window.Event('change'));
        // fill prompt + option text + mark second option correct
        const prompt = host.querySelector('textarea');
        prompt.value = 'What is it?';
        prompt.dispatchEvent(new window.Event('input'));
        const optionInputs = host.querySelectorAll('.tdv-q-options .input-group input[type="text"]');
        expect(optionInputs.length).toBe(2);
        optionInputs[0].value = 'A crater';
        optionInputs[0].dispatchEvent(new window.Event('input'));
        const radios = host.querySelectorAll('.tdv-q-options input[type="radio"]');
        radios[1].checked = true;
        radios[1].dispatchEvent(new window.Event('change'));
        dev.saveMarkerEditor();

        const marker = dev.state.interaction.markers[0];
        expect(marker.label).toBe('The crater');
        expect(marker.action.type).toBe('question');
        expect(marker.action.payload.prompt).toBe('What is it?');
        expect(marker.action.payload.options[0].text).toBe('A crater');
        expect(marker.action.payload.options.filter((o) => o.correct).length).toBe(1);
        expect(marker.action.payload.options[1].correct).toBe(true);
        // editor closed
        expect(dev.markerEditorHost.querySelector('.tdv-marker-editor')).toBeNull();
    });

    it('round-trips edited markers through get3DViewerJSON', () => {
        const dev = setupEditor({ src: 'asset://m.glb', interaction: { enabled: true, guidedMode: true, markers: [
            { id: 'm', label: 'Peak', icon: 'pin', action: { type: 'information', payload: { html: '<p>x</p>' } } },
        ] } });
        const out = dev.get3DViewerJSON();
        expect(out.version).toBe(2);
        expect(out.interaction.enabled).toBe(true);
        expect(out.interaction.guidedMode).toBe(true);
        expect(out.interaction.markers[0].label).toBe('Peak');
        expect(out.interaction.markers[0].icon).toBe('pin');
    });
});
