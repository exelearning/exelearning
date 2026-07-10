/**
 * Unit tests for the 3D Viewer interaction schema (export side).
 *
 * These MUST mirror edition/three-d-viewer.interaction.test.js — the two
 * normalization copies are kept byte-identical (see SDD-0001). Export-specific
 * markup/serialization tests live in three-d-viewer.test.js.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    // eslint-disable-next-line no-eval
    (0, eval)(code);
    return global.$threedviewer;
}

describe('three-d-viewer interaction schema (export)', () => {
    let $tdv;
    let originalGlobals;

    beforeEach(() => {
        originalGlobals = {
            eXeLearning: global.eXeLearning,
            location: global.location,
            document: global.document,
            $threedviewer: global.$threedviewer,
            $exeLibs: global.$exeLibs,
            customElements: global.customElements,
        };
        global.$threedviewer = undefined;
        global.$exeLibs = undefined;
        global.location = { origin: 'http://localhost:8080', protocol: 'http:', host: 'localhost:8080', href: 'http://localhost:8080/viewer/index.html' };
        global.eXeLearning = { config: null, symfony: {}, app: { project: {} } };
        global.document = {
            documentElement: { id: '' },
            createElement: (tag) => ({ tagName: tag.toUpperCase(), setAttribute: () => {}, getAttribute: () => null, removeAttribute: () => {}, style: {}, addEventListener: () => {} }),
            head: { appendChild: () => {} },
            querySelector: () => null,
        };
        global.customElements = { get: () => undefined, whenDefined: () => Promise.resolve() };
        global._ = (s) => s;
        global.c_ = (s) => s;
        const code = readFileSync(join(__dirname, 'three-d-viewer.js'), 'utf-8');
        $tdv = loadExportIdevice(code);
    });

    afterEach(() => {
        global.eXeLearning = originalGlobals.eXeLearning;
        global.location = originalGlobals.location;
        global.document = originalGlobals.document;
        global.$threedviewer = originalGlobals.$threedviewer;
        global.$exeLibs = originalGlobals.$exeLibs;
        global.customElements = originalGlobals.customElements;
    });

    it('exposes the mirrored normalization helpers', () => {
        expect(typeof $tdv.__normalizeInteraction).toBe('function');
        expect(typeof $tdv.__normalizeMarker).toBe('function');
        expect(typeof $tdv.__normalizeAction).toBe('function');
        expect(typeof $tdv.__normalizeQuestion).toBe('function');
        expect(typeof $tdv.__gradeSingleChoice).toBe('function');
    });

    it('normalizes a disabled interaction from garbage', () => {
        expect($tdv.__normalizeInteraction(undefined)).toEqual({
            enabled: false, guidedMode: false, wrapNavigation: false,
            showMarkerLabels: true, activeMarkerId: '', markers: [],
        });
    });

    it('reindexes and sorts markers by order (matches edition)', () => {
        const it = $tdv.__normalizeInteraction({
            enabled: true,
            markers: [{ id: 'b', order: 5, label: 'B' }, { id: 'a', order: 1, label: 'A' }],
        });
        expect(it.markers.map((m) => m.label)).toEqual(['A', 'B']);
        expect(it.markers.map((m) => m.order)).toEqual([0, 1]);
    });

    it('is idempotent', () => {
        const raw = { enabled: true, markers: [{ label: 'M', icon: 'star',
            action: { type: 'question', payload: { prompt: 'Q', options: [{ text: 'a', correct: true }, { text: 'b' }] } } }] };
        const once = $tdv.__normalizeInteraction(raw);
        expect($tdv.__normalizeInteraction(once)).toEqual(once);
    });

    it('strips blob:/data: from media payloads and defaults action to information', () => {
        expect($tdv.__normalizeAction({ type: 'image', payload: { src: 'blob:x' } }).payload.src).toBe('');
        expect($tdv.__normalizeAction({ type: 'boom' }).type).toBe('information');
    });

    it('forces one correct option and grades by id', () => {
        const q = $tdv.__normalizeQuestion({ options: [{ id: 'o1', text: 'a', correct: true }, { id: 'o2', text: 'b', correct: true }] });
        expect(q.options.filter((o) => o.correct).length).toBe(1);
        expect($tdv.__gradeSingleChoice(q, 'o1')).toBe(true);
        expect($tdv.__gradeSingleChoice(q, 'o2')).toBe(false);
    });
});
