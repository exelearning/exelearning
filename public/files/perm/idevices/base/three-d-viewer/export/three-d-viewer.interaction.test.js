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

    describe('renderView interaction markup', () => {
        const dataWith = (interaction) => ({ ideviceId: 'tdv-1', src: 'asset://m.glb', interaction });
        const enabled = (over) => Object.assign({
            enabled: true, guidedMode: false, showMarkerLabels: true, markers: [
                { id: 'm1', label: 'Crater <peak>', icon: 'pin',
                  anchor: { position: { x: 1, y: 2, z: 3 }, normal: { x: 0, y: 1, z: 0 } },
                  action: { type: 'information', payload: { html: '<p>Lava</p>' } } },
            ],
        }, over || {});

        it('omits the interaction data block when interactions are disabled', () => {
            const html = $tdv.renderView(dataWith({ enabled: false, markers: [] }), null, '{content}');
            expect(html).not.toContain('tdv-interaction-data');
            expect(html).not.toContain('tdv-fallback');
        });

        it('embeds a JSON data block and an escaped fallback list when enabled', () => {
            const html = $tdv.renderView(dataWith(enabled()), null, '{content}');
            expect(html).toContain('script type="application/json" class="tdv-interaction-data"');
            expect(html).toContain('<ul class="tdv-fallback" hidden>');
            // fallback label is HTML-escaped
            expect(html).toContain('Crater &lt;peak&gt;');
            expect(html).not.toContain('<peak>');
        });

        it('escapes < inside the JSON block to prevent </script> breakout', () => {
            const html = $tdv.renderView(dataWith(enabled({ markers: [
                { id: 'x', label: 'X', icon: 'circle',
                  anchor: { position: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
                  action: { type: 'information', payload: { html: '</script><img src=x onerror=alert(1)>' } } },
            ] })), null, '{content}');
            // The data block must not contain a raw closing </script> from the
            // payload — every leading < is escaped to <.
            const block = html.slice(html.indexOf('tdv-interaction-data'));
            const jsonPart = block.slice(0, block.indexOf('</script>'));
            expect(jsonPart).not.toContain('</script>');
            expect(jsonPart).toContain('\\u003c/script>');
        });

        it('keeps asset:// media references in the JSON block for the export rewriter', () => {
            const html = $tdv.renderView(dataWith(enabled({ markers: [
                { id: 'i', label: 'Img', icon: 'circle',
                  anchor: { position: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
                  action: { type: 'image', payload: { src: 'asset://pic.png', alt: 'p' } } },
            ] })), null, '{content}');
            expect(html).toContain('asset://pic.png');
        });

        it('never emits a blob: URL from marker media', () => {
            const html = $tdv.renderView(dataWith(enabled({ markers: [
                { id: 'i', label: 'Img', icon: 'circle',
                  anchor: { position: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
                  action: { type: 'image', payload: { src: 'blob:http://x/leak' } } },
            ] })), null, '{content}');
            expect(html).not.toContain('blob:');
        });

        it('renders guided navigation controls only in guided mode', () => {
            const off = $tdv.renderView(dataWith(enabled({ guidedMode: false })), null, '{content}');
            expect(off).not.toContain('tdv-guided-nav');
            const on = $tdv.renderView(dataWith(enabled({ guidedMode: true })), null, '{content}');
            expect(on).toContain('tdv-guided-nav');
            expect(on).toContain('tdv-nav-prev');
            expect(on).toContain('tdv-nav-next');
        });

        it('bakes a runtime i18n map into the data block', () => {
            const html = $tdv.renderView(dataWith(enabled()), null, '{content}');
            expect(html).toContain('"i18n"');
            expect(html).toContain('Check');
        });

        it('embeds the SCORM scoring config in the data block', () => {
            const data = Object.assign(dataWith(enabled()), { isScorm: 1, weighted: 80 });
            const html = $tdv.renderView(data, null, '{content}');
            expect(html).toContain('"scorm"');
            expect(html).toContain('"isScorm":1');
            expect(html).toContain('"weighted":80');
        });
    });

    describe('normalizeScorm + setupScormScoring', () => {
        it('clamps the SCORM config', () => {
            expect($tdv.__normalizeScorm({ isScorm: 9, weighted: 0 })).toEqual({ isScorm: 2, weighted: 1, textButtonScorm: '' });
        });

        it('registers the activity and reports the fraction correct in a SCORM export', () => {
            const events = [];
            globalThis.$exeDevices = { iDevice: { gamification: { scorm: {
                registerActivity: (g) => events.push(['register', g.main, g.isScorm, g.weighted]),
                sendScoreNew: (auto, g) => events.push(['send', g.scorerp, !!g.gameOver]),
            } } } };
            const savedDoc = globalThis.document;
            globalThis.document = { body: { classList: { contains: (c) => c === 'exe-scorm' } } };
            try {
                const interaction = $tdv.__normalizeInteraction({ enabled: true, markers: [
                    { id: 'q1', action: { type: 'question', payload: { options: [{ text: 'a', correct: true }, { text: 'b' }] } } },
                    { id: 'q2', action: { type: 'question', payload: { options: [{ text: 'a', correct: true }, { text: 'b' }] } } },
                    { id: 'i1', action: { type: 'information', payload: { html: '' } } },
                ] });
                const hooks = {};
                $tdv.__setupScormScoring({ id: 'viewer-1' }, interaction, { isScorm: 1, weighted: 100 }, hooks);
                expect(events).toContainEqual(['register', 'viewer-1', 1, 100]);
                expect(typeof hooks.onQuestionAnswered).toBe('function');
                hooks.onQuestionAnswered('q1', true); // 1 of 2 questions → 5/10
                expect(events).toContainEqual(['send', 5, false]);
                hooks.onQuestionAnswered('q2', true); // 2 of 2 → 10/10, complete
                expect(events).toContainEqual(['send', 10, true]);
            } finally {
                globalThis.document = savedDoc;
                delete globalThis.$exeDevices;
            }
        });

        it('does not wire scoring outside a SCORM export', () => {
            const savedDoc = globalThis.document;
            globalThis.document = { body: { classList: { contains: () => false } } };
            try {
                const hooks = {};
                const interaction = $tdv.__normalizeInteraction({ enabled: true, markers: [
                    { id: 'q', action: { type: 'question', payload: {} } },
                ] });
                $tdv.__setupScormScoring({ id: 'v' }, interaction, { isScorm: 1 }, hooks);
                expect(hooks.onQuestionAnswered).toBeUndefined();
            } finally {
                globalThis.document = savedDoc;
            }
        });
    });
});
