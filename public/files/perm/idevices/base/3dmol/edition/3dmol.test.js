/**
 * Unit tests for the 3dmol iDevice (edition).
 *
 * Follows the guess iDevice pattern: the `var $exeDevice =` declaration is
 * rewired to a global so the suite can grab a reference and exercise its
 * helpers. Real jQuery + happy-dom (from vitest.setup.js) back the
 * DOM-reading paths; `_`/`c_` translation stubs are provided globally too.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadIdevice() {
    const code = readFileSync(join(__dirname, '3dmol.js'), 'utf-8');
    const modified = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$exeDevice;
}

describe('3dmol iDevice edition', () => {
    let dmol;

    beforeEach(() => {
        global.$exeDevice = undefined;
        dmol = loadIdevice();
        document.body.innerHTML = '';
    });

    describe('getModelFormatByName', () => {
        it('maps extensions to formats and rejects unknown ones', () => {
            expect(dmol.getModelFormatByName('a.pdb')).toBe('pdb');
            expect(dmol.getModelFormatByName('a.SDF')).toBe('sdf');
            expect(dmol.getModelFormatByName('a.mmcif')).toBe('cif');
            expect(dmol.getModelFormatByName('a.txt')).toBe('');
            expect(dmol.getModelFormatByName('noext')).toBe('');
        });
    });

    describe('normalizeModelStyle', () => {
        it('keeps allowed styles and falls back to stick otherwise', () => {
            expect(dmol.normalizeModelStyle('SPHERE')).toBe('sphere');
            expect(dmol.normalizeModelStyle(' surface ')).toBe('surface');
            expect(dmol.normalizeModelStyle('nope')).toBe('stick');
        });
    });

    describe('getCuestionDefault', () => {
        it('includes empty author and alt fields', () => {
            const q = dmol.getCuestionDefault({
                modelPath: 'glucose.sdf',
                modelName: 'glucose.sdf',
                modelData: 'data',
                modelFormat: 'sdf',
            });
            expect(q.author).toBe('');
            expect(q.alt).toBe('');
        });

        it('preserves the supplied model fields', () => {
            const q = dmol.getCuestionDefault({
                modelPath: 'glucose.sdf',
                modelName: 'glucose.sdf',
                modelData: 'data',
                modelFormat: 'sdf',
            });
            expect(q.modelName).toBe('glucose.sdf');
            expect(q.modelFormat).toBe('sdf');
        });
    });

    describe('validateQuestion author/alt round-trip', () => {
        function buildForm({ author = '', alt = '' } = {}) {
            document.body.innerHTML = `
                <input type="radio" name="slcactivitymode" value="show" checked />
                <input type="radio" name="slctime" value="0" checked />
                <input type="radio" name="slcnumber" value="4" checked />
                <input type="radio" name="slctypeselect" value="0" checked />
                <input id="dmoleScoreQuestion" value="1" />
                <textarea id="dmoleModelData">MODELDATA</textarea>
                <input id="dmoleModelFormat" value="sdf" />
                <div id="dmoleModelFileName">glucose.sdf</div>
                <input id="dmoleModelFile" value="glucose.sdf" />
                <input id="dmoleModelAuthor" value="${author}" />
                <input id="dmoleModelAlt" value="${alt}" />
                <input id="dmoleDescription" value="A molecule" />
                <input id="dmoleModelStyle" value="stick" />
                <span id="dmoleModelToggleBg" aria-pressed="false"></span>
                <span id="dmoleShowAtomLegend" aria-pressed="false"></span>
                <input id="dmoleQuestion" value="Q?" />
                <span id="dmoleSolutionSelect">A</span>
                <input id="dmolePercentageShow" value="35" />
            `;
        }

        beforeEach(() => {
            // validateQuestion calls the shared edition helper to stop audio.
            global.$exeDevicesEdition = {
                iDevice: { gamification: { helpers: { stopSound: () => {} } } },
            };
            dmol.msgs = {};
            dmol.active = 0;
            dmol.selectsGame = [{}];
            dmol.modelViewer = null;
        });

        it('captures the author and alt text into the stored question', () => {
            buildForm({ author: 'Jane Doe', alt: 'Glucose, ball-and-stick' });
            const ok = dmol.validateQuestion();
            expect(ok).toBe(true);
            expect(dmol.selectsGame[0].author).toBe('Jane Doe');
            expect(dmol.selectsGame[0].alt).toBe('Glucose, ball-and-stick');
        });

        it('stores empty strings when the inputs are blank', () => {
            buildForm({ author: '', alt: '' });
            const ok = dmol.validateQuestion();
            expect(ok).toBe(true);
            expect(dmol.selectsGame[0].author).toBe('');
            expect(dmol.selectsGame[0].alt).toBe('');
        });
    });
});
