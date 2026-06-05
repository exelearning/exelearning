/**
 * Unit tests for the 3dmol iDevice (export/runtime).
 *
 * Loads the export object the same way the guess iDevice tests do: a minimal
 * `$exeDevices.iDevice.gamification.colors` stub satisfies the load-time
 * property initializers, the `var $eXe3Dmol =` declaration is rewired to a
 * global, and the auto-init call is stripped so importing has no side effects.
 *
 * Real jQuery + happy-dom (provided by vitest.setup.js) back the DOM-touching
 * helpers (`updateModelAuthor`, `updateModelA11y`).
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice() {
    global.$exeDevices = {
        iDevice: {
            gamification: {
                colors: {
                    borderColors: { black: '#000', white: '#fff', red: '#f00', green: '#0f0', yellow: '#ff0' },
                    backColor: { black: '#000', white: '#fff' },
                },
                scorm: { addButtonScoreNew: () => '' },
            },
        },
    };
    const code = readFileSync(join(__dirname, '3dmol.js'), 'utf-8');
    let modified = code.replace(/var\s+\$eXe3Dmol\s*=/, 'global.$eXe3Dmol =');
    // Strip the auto-init: $(function () { $eXe3Dmol.init(); });
    modified = modified.replace(/\$\(function\s*\(\)\s*\{\s*\$eXe3Dmol\.init\(\);\s*\}\);?/g, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$eXe3Dmol;
}

describe('3dmol iDevice export', () => {
    let dmol;

    beforeEach(() => {
        global.$eXe3Dmol = undefined;
        dmol = loadExportIdevice();
        document.body.innerHTML = '';
    });

    describe('getModelFormatByName', () => {
        it('maps known extensions to their 3Dmol format', () => {
            expect(dmol.getModelFormatByName('protein.pdb')).toBe('pdb');
            expect(dmol.getModelFormatByName('molecule.SDF')).toBe('sdf');
            expect(dmol.getModelFormatByName('ligand.mol2')).toBe('mol2');
            expect(dmol.getModelFormatByName('coords.xyz')).toBe('xyz');
            expect(dmol.getModelFormatByName('crystal.cif')).toBe('cif');
            expect(dmol.getModelFormatByName('crystal.mmcif')).toBe('cif');
        });

        it('returns empty string for unknown or extension-less names', () => {
            expect(dmol.getModelFormatByName('model.txt')).toBe('');
            expect(dmol.getModelFormatByName('noextension')).toBe('');
            expect(dmol.getModelFormatByName('')).toBe('');
        });
    });

    describe('normalizeModelStyle', () => {
        it('keeps allowed styles (case-insensitive)', () => {
            expect(dmol.normalizeModelStyle('stick')).toBe('stick');
            expect(dmol.normalizeModelStyle('SPHERE')).toBe('sphere');
            expect(dmol.normalizeModelStyle(' surface ')).toBe('surface');
        });

        it('falls back to stick for invalid input', () => {
            expect(dmol.normalizeModelStyle('bogus')).toBe('stick');
            expect(dmol.normalizeModelStyle('')).toBe('stick');
            expect(dmol.normalizeModelStyle(undefined)).toBe('stick');
        });
    });

    describe('updateModelAuthor', () => {
        const instance = 'auth1';

        beforeEach(() => {
            document.body.innerHTML = `<div id="dmolpModelAuthor-${instance}" style="display:none"></div>`;
        });

        it('shows the author text below the model when an author is set', () => {
            dmol.updateModelAuthor('Jane Doe', instance);
            const el = document.getElementById(`dmolpModelAuthor-${instance}`);
            expect(el.textContent).toBe('Jane Doe');
            expect(el.style.display).not.toBe('none');
        });

        it('clears and hides the caption when there is no author', () => {
            dmol.updateModelAuthor('Jane Doe', instance);
            dmol.updateModelAuthor('', instance);
            const el = document.getElementById(`dmolpModelAuthor-${instance}`);
            expect(el.textContent).toBe('');
            expect(el.style.display).toBe('none');
        });

        it('trims whitespace-only authors to nothing', () => {
            dmol.updateModelAuthor('   ', instance);
            const el = document.getElementById(`dmolpModelAuthor-${instance}`);
            expect(el.textContent).toBe('');
            expect(el.style.display).toBe('none');
        });

        it('escapes HTML in the author (rendered as text, not markup)', () => {
            dmol.updateModelAuthor('<b>x</b>', instance);
            const el = document.getElementById(`dmolpModelAuthor-${instance}`);
            expect(el.querySelector('b')).toBeNull();
            expect(el.textContent).toBe('<b>x</b>');
        });

        it('does nothing when the caption element is absent', () => {
            document.body.innerHTML = '';
            expect(() => dmol.updateModelAuthor('Jane', instance)).not.toThrow();
        });
    });

    describe('updateModelA11y', () => {
        const instance = 'a11y1';

        beforeEach(() => {
            dmol.options[instance] = { msgs: { msgNoImage: 'No 3D model', msgTypeGame: '3D Model' } };
            document.body.innerHTML = `
                <div id="dmolpModelPreview-${instance}"></div>
                <span id="dmolpModelDesc-${instance}"></span>
            `;
        });

        it('uses the custom alternative text as the accessible description when provided', () => {
            dmol.updateModelA11y('glucose.sdf', instance, 'Glucose molecule, ball-and-stick');
            expect(document.getElementById(`dmolpModelPreview-${instance}`).getAttribute('aria-label')).toBe(
                'Glucose molecule, ball-and-stick',
            );
            expect(document.getElementById(`dmolpModelDesc-${instance}`).textContent).toBe(
                'Glucose molecule, ball-and-stick',
            );
        });

        it('falls back to the model name when no alt text is given', () => {
            dmol.updateModelA11y('glucose.sdf', instance);
            expect(document.getElementById(`dmolpModelPreview-${instance}`).getAttribute('aria-label')).toBe(
                '3D Model: glucose.sdf',
            );
        });

        it('falls back to the no-model message when neither alt nor name exist', () => {
            dmol.updateModelA11y('', instance, '');
            expect(document.getElementById(`dmolpModelPreview-${instance}`).getAttribute('aria-label')).toBe(
                'No 3D model',
            );
        });
    });

    describe('createInterface', () => {
        it('renders a dedicated, centered author caption below the model', () => {
            const instance = 'iface1';
            dmol.options[instance] = { msgs: {}, modelStyle: 'stick' };
            const html = dmol.createInterface(instance);
            expect(html).toContain(`id="dmolpModelAuthor-${instance}"`);
            expect(html).toContain('class="DMOLP-ModelAuthor"');
        });
    });

    describe('export styles', () => {
        it('centers the model author caption', () => {
            const css = readFileSync(join(__dirname, '3dmol.css'), 'utf-8');
            const rule = css.match(/\.DMOLP-ModelAuthor\s*\{[\s\S]*?\}/)?.[0] || '';
            expect(rule).toContain('text-align: center;');
        });
    });
});
