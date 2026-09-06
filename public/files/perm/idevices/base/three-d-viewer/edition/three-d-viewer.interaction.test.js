/**
 * Unit tests for the 3D Viewer interaction schema (edition side).
 *
 * Covers the versioned state migration and the pure normalization helpers
 * (interaction / marker / anchor / camera / action / question) plus the
 * single-choice grading function. These mirror the export side byte-for-byte
 * (see export/three-d-viewer.interaction.test.js) — the two must stay in sync.
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

describe('three-d-viewer interaction schema (edition)', () => {
    let dev;

    beforeEach(() => {
        global.$exeDevice = undefined;
        global.location = { origin: 'http://localhost:8080', protocol: 'http:', host: 'localhost:8080', href: 'http://localhost:8080/workarea' };
        global.eXeLearning = { symfony: {}, app: { project: {} } };
        global.document = global.document || {
            createElement: () => ({ setAttribute: () => {}, style: {}, addEventListener: () => {} }),
            head: { appendChild: () => {} },
            querySelector: () => null,
        };
        global._ = (s) => s;
        global.c_ = (s) => s;
        const code = readFileSync(join(__dirname, 'three-d-viewer.js'), 'utf-8');
        dev = loadIdevice(code);
    });

    describe('normalizeInteraction', () => {
        it('returns a disabled, empty interaction for undefined/garbage', () => {
            const it0 = dev.__normalizeInteraction(undefined);
            expect(it0).toEqual({
                enabled: false, guidedMode: false, wrapNavigation: false,
                showMarkerLabels: true, activeMarkerId: '', markers: [],
            });
            expect(dev.__normalizeInteraction(null).markers).toEqual([]);
            expect(dev.__normalizeInteraction(42).enabled).toBe(false);
            expect(dev.__normalizeInteraction({ markers: 'nope' }).markers).toEqual([]);
        });

        it('coerces boolean flags and defaults showMarkerLabels to true', () => {
            const it = dev.__normalizeInteraction({ enabled: 1, guidedMode: 'x', wrapNavigation: true });
            expect(it.enabled).toBe(true);
            expect(it.guidedMode).toBe(true);
            expect(it.wrapNavigation).toBe(true);
            expect(it.showMarkerLabels).toBe(true);
            expect(dev.__normalizeInteraction({ showMarkerLabels: false }).showMarkerLabels).toBe(false);
        });

        it('reindexes marker order stably and sorts by order', () => {
            const it = dev.__normalizeInteraction({
                enabled: true,
                markers: [
                    { id: 'b', order: 5, label: 'B' },
                    { id: 'a', order: 1, label: 'A' },
                    { id: 'c', order: 10, label: 'C' },
                ],
            });
            expect(it.markers.map((m) => m.label)).toEqual(['A', 'B', 'C']);
            expect(it.markers.map((m) => m.order)).toEqual([0, 1, 2]);
        });

        it('keeps activeMarkerId only when it references an existing marker', () => {
            expect(dev.__normalizeInteraction({ markers: [{ id: 'a' }], activeMarkerId: 'a' }).activeMarkerId).toBe('a');
            expect(dev.__normalizeInteraction({ markers: [{ id: 'a' }], activeMarkerId: 'zzz' }).activeMarkerId).toBe('');
        });

        it('is idempotent (normalize(normalize(x)) === normalize(x))', () => {
            const raw = { enabled: true, guidedMode: true, markers: [
                { label: 'M', icon: 'star', order: 3, anchor: { position: { x: 1, y: 2, z: 3 } },
                  action: { type: 'question', payload: { prompt: 'Q', options: [{ text: 'a', correct: true }, { text: 'b' }] } } },
            ] };
            const once = dev.__normalizeInteraction(raw);
            const twice = dev.__normalizeInteraction(once);
            expect(twice).toEqual(once);
        });
    });

    describe('normalizeMarker / anchor / camera', () => {
        it('generates a stable id, defaults icon to circle, clamps invalid icon', () => {
            const m = dev.__normalizeMarker({ icon: 'skull' }, 0);
            expect(typeof m.id).toBe('string');
            expect(m.id.startsWith('marker-')).toBe(true);
            expect(m.icon).toBe('circle');
            expect(dev.__normalizeMarker({ icon: 'pin' }, 0).icon).toBe('pin');
        });

        it('preserves an existing id', () => {
            expect(dev.__normalizeMarker({ id: 'keep-me' }, 0).id).toBe('keep-me');
        });

        it('coerces anchor vectors with numeric fallback and default up-normal', () => {
            const m = dev.__normalizeMarker({ anchor: { position: { x: '1.5', y: 'bad' } } }, 0);
            expect(m.anchor.position).toEqual({ x: 1.5, y: 0, z: 0 });
            expect(m.anchor.normal).toEqual({ x: 0, y: 1, z: 0 });
            expect(m.anchor.surface).toBe('');
        });

        it('normalizes camera to string triples', () => {
            const m = dev.__normalizeMarker({ camera: { orbit: '30deg 75deg 105%', fieldOfView: 45 } }, 0);
            expect(m.camera.orbit).toBe('30deg 75deg 105%');
            expect(m.camera.target).toBe('');
            expect(m.camera.fieldOfView).toBe(''); // non-string coerced to ''
        });

        it('falls back marker order to the array index when missing', () => {
            expect(dev.__normalizeMarker({}, 7).order).toBe(7);
        });
    });

    describe('normalizeAction', () => {
        it('defaults unknown action types to information', () => {
            expect(dev.__normalizeAction({ type: 'explode' }).type).toBe('information');
            expect(dev.__normalizeAction(undefined).payload).toEqual({ html: '' });
        });

        it('strips blob:/data: URLs from image/video payloads', () => {
            const img = dev.__normalizeAction({ type: 'image', payload: { src: 'blob:http://x/y', alt: 'a' } });
            expect(img.payload.src).toBe('');
            expect(img.payload.alt).toBe('a');
            const vid = dev.__normalizeAction({ type: 'video', payload: { src: 'data:video/mp4;base64,AAA', poster: 'asset://p.png' } });
            expect(vid.payload.src).toBe('');
            expect(vid.payload.poster).toBe('asset://p.png');
        });

        it('keeps asset:// image src and preserves link newTab default true', () => {
            const img = dev.__normalizeAction({ type: 'image', payload: { src: 'asset://abc.png' } });
            expect(img.payload.src).toBe('asset://abc.png');
            expect(dev.__normalizeAction({ type: 'link', payload: { url: 'https://x' } }).payload.newTab).toBe(true);
            expect(dev.__normalizeAction({ type: 'link', payload: { url: 'https://x', newTab: false } }).payload.newTab).toBe(false);
        });

        it('strips dangerous schemes from link URLs at normalize time', () => {
            expect(dev.__normalizeAction({ type: 'link', payload: { url: 'javascript:alert(1)' } }).payload.url).toBe('');
            expect(dev.__normalizeAction({ type: 'link', payload: { url: 'blob:http://x/y' } }).payload.url).toBe('');
            expect(dev.__normalizeAction({ type: 'link', payload: { url: 'https://ok.org' } }).payload.url).toBe('https://ok.org');
            expect(dev.__normalizeAction({ type: 'link', payload: { url: '/relative/path' } }).payload.url).toBe('/relative/path');
        });
    });

    describe('normalizeQuestion + gradeSingleChoice', () => {
        it('forces exactly one correct option (first correct wins)', () => {
            const q = dev.__normalizeQuestion({ options: [{ text: 'a', correct: true }, { text: 'b', correct: true }] });
            expect(q.options.filter((o) => o.correct).length).toBe(1);
            expect(q.options[0].correct).toBe(true);
        });

        it('defaults the first option correct when none is marked', () => {
            const q = dev.__normalizeQuestion({ options: [{ text: 'a' }, { text: 'b' }] });
            expect(q.options[0].correct).toBe(true);
        });

        it('provides two placeholder options when none supplied', () => {
            const q = dev.__normalizeQuestion({});
            expect(q.options.length).toBe(2);
            expect(q.type).toBe('single-choice');
        });

        it('clamps attemptsAllowed to [0,20] integers', () => {
            expect(dev.__normalizeQuestion({ attemptsAllowed: -3 }).attemptsAllowed).toBe(0);
            expect(dev.__normalizeQuestion({ attemptsAllowed: 999 }).attemptsAllowed).toBe(20);
            expect(dev.__normalizeQuestion({ attemptsAllowed: 2.7 }).attemptsAllowed).toBe(3);
        });

        it('grades a chosen option by id', () => {
            const q = dev.__normalizeQuestion({ options: [{ id: 'o1', text: 'a', correct: true }, { id: 'o2', text: 'b' }] });
            expect(dev.__gradeSingleChoice(q, 'o1')).toBe(true);
            expect(dev.__gradeSingleChoice(q, 'o2')).toBe(false);
            expect(dev.__gradeSingleChoice(q, 'missing')).toBe(false);
        });
    });

    describe('normalizeScorm', () => {
        it('defaults to disabled scoring', () => {
            expect(dev.__normalizeScorm(undefined)).toEqual({ isScorm: 0, weighted: 100, textButtonScorm: '' });
        });
        it('clamps isScorm to 0..2 and weighted to 1..100', () => {
            expect(dev.__normalizeScorm({ isScorm: 5 }).isScorm).toBe(2);
            expect(dev.__normalizeScorm({ isScorm: -1 }).isScorm).toBe(0);
            expect(dev.__normalizeScorm({ isScorm: '1' }).isScorm).toBe(1);
            expect(dev.__normalizeScorm({ weighted: 0 }).weighted).toBe(1);
            expect(dev.__normalizeScorm({ weighted: 250 }).weighted).toBe(100);
            expect(dev.__normalizeScorm({ weighted: 50 }).weighted).toBe(50);
        });
    });

    describe('state migration via set/get JSON', () => {
        it('round-trips SCORM scoring config', () => {
            dev.set3DViewerJSON({ src: 'asset://m.glb', isScorm: 1, weighted: 80, textButtonScorm: 'Save' });
            expect(dev.state.isScorm).toBe(1);
            expect(dev.state.weighted).toBe(80);
            const out = dev.get3DViewerJSON();
            expect(out.isScorm).toBe(1);
            expect(out.weighted).toBe(80);
            expect(out.textButtonScorm).toBe('Save');
        });

        it('migrates legacy state (no version) to v2 with a disabled interaction', () => {
            dev.set3DViewerJSON({ src: 'asset://m.glb', alt: 'A model' });
            expect(dev.state.version).toBe(2);
            expect(dev.state.interaction).toEqual({
                enabled: false, guidedMode: false, wrapNavigation: false,
                showMarkerLabels: true, activeMarkerId: '', markers: [],
            });
            // existing visual options preserved
            expect(dev.state.alt).toBe('A model');
        });

        it('round-trips interaction data through get3DViewerJSON without loss', () => {
            const input = {
                src: 'asset://m.glb',
                version: 2,
                interaction: {
                    enabled: true, guidedMode: true, showMarkerLabels: false,
                    markers: [{ id: 'm1', label: 'Crater', icon: 'pin', order: 0,
                        anchor: { position: { x: 0.1, y: 0.2, z: 0.3 }, normal: { x: 0, y: 1, z: 0 } },
                        action: { type: 'information', payload: { html: '<p>Hi</p>' } } }],
                },
            };
            dev.set3DViewerJSON(input);
            const out = dev.get3DViewerJSON();
            expect(out.version).toBe(2);
            expect(out.interaction.enabled).toBe(true);
            expect(out.interaction.markers[0].label).toBe('Crater');
            expect(out.interaction.markers[0].action.payload.html).toBe('<p>Hi</p>');
            // reload the serialized output — must be stable
            dev.set3DViewerJSON(out);
            expect(dev.get3DViewerJSON().interaction).toEqual(out.interaction);
        });

        it('never persists a blob: image src inside a marker action', () => {
            dev.set3DViewerJSON({ src: 'asset://m.glb', interaction: { enabled: true,
                markers: [{ id: 'm', action: { type: 'image', payload: { src: 'blob:http://x/leak' } } }] } });
            const out = dev.get3DViewerJSON();
            expect(JSON.stringify(out)).not.toContain('blob:');
            expect(out.interaction.markers[0].action.payload.src).toBe('');
        });
    });
});
