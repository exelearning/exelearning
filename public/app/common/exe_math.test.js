/**
 * Integrity guard for the vendored MathJax tree (public/app/common/exe_math).
 *
 * The active math runtime is the MathJax 3.2.2 combined component
 * (tex-mml-svg.js) plus the v3 [tex] extensions that common.js lazy-loads.
 * A partially-applied MathJax 4 upgrade once left ~6 MB of v4-only files in
 * this tree; they were unloadable by the 3.2.2 loader (version-mismatch
 * TypeError) and were removed. These tests pin both directions:
 *   - everything the 3.2.2 runtime can actually request must exist, and
 *   - no mixed-version leftovers may reappear.
 *
 * The whole exe_math directory is copied into every export that contains
 * math (see LIBRARY_PATTERNS in src/shared/export/constants.ts), so this
 * also guards exported-package contents.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exeMathDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'exe_math');

// Must stay in sync with `externalExtensions` in public/app/common/common.js.
const EXTERNAL_TEX_EXTENSIONS = [
    'amscd', 'bbox', 'boldsymbol', 'braket', 'bussproofs', 'cancel',
    'cases', 'centernot', 'color', 'colortbl', 'empheq', 'enclose',
    'extpfeil', 'gensymb', 'html', 'mathtools', 'mhchem', 'noerrors',
    'physics', 'tagformat', 'textcomp', 'unicode', 'upgreek', 'verb',
    'setoptions',
];

function readCommonJsExtensions() {
    const commonJs = fs.readFileSync(path.join(exeMathDir, '..', 'common.js'), 'utf-8');
    const match = commonJs.match(/var externalExtensions = \[([\s\S]*?)\];/);
    if (!match) return null;
    const withoutComments = match[1].replace(/\/\/[^\n]*/g, '');
    return [...withoutComments.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
}

describe('exe_math (MathJax 3.2.2) integrity', () => {
    it('ships the combined 3.2.2 entry point', () => {
        const entry = path.join(exeMathDir, 'tex-mml-svg.js');
        expect(fs.existsSync(entry)).toBe(true);
        expect(fs.readFileSync(entry, 'utf-8')).toContain('3.2.2');
    });

    it('ships every [tex] extension that common.js lazy-loads', () => {
        const configured = readCommonJsExtensions();
        expect(configured).toEqual(EXTERNAL_TEX_EXTENSIONS);
        for (const ext of configured) {
            const file = path.join(exeMathDir, 'input/tex/extensions', `${ext}.js`);
            expect(fs.existsSync(file), `missing [tex]/${ext}`).toBe(true);
        }
    });

    it('ships the lazily-loaded MathML entities component from the 3.2.2 build', () => {
        const entities = fs.readFileSync(path.join(exeMathDir, 'input/mml/entities.js'), 'utf-8');
        // The 3.2.2 component feeds MathJax._.util.Entities; the v4 one instead
        // calls checkVersion(..., "4.0.0") and crashes under the 3.2.2 loader.
        expect(entities).toContain('MathJax._.util.Entities');
        expect(entities).not.toContain('"4.0.0"');
    });

    it('keeps the MathJax license in the tree (copied into exports)', () => {
        expect(fs.existsSync(path.join(exeMathDir, 'LICENSE'))).toBe(true);
    });

    it('contains no MathJax 4 leftovers (loader/SRE/a11y/mathmaps were dead weight)', () => {
        for (const gone of [
            'loader.js',
            'startup.js',
            'core.js',
            'ui',
            'a11y',
            'adaptors',
            'output',
            'sre',
            'input/tex.js',
            'input/mml.js',
            'input/asciimath.js',
            'input/mml/extensions',
        ]) {
            expect(fs.existsSync(path.join(exeMathDir, gone)), `${gone} should not exist`).toBe(false);
        }
    });

    it('contains no file claiming MathJax version 4', () => {
        const walk = (dir) =>
            fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
                const abs = path.join(dir, entry.name);
                return entry.isDirectory() ? walk(abs) : [abs];
            });
        const offenders = walk(exeMathDir).filter(
            (file) => file.endsWith('.js') && fs.readFileSync(file, 'utf-8').includes('"4.0.0"'),
        );
        expect(offenders).toEqual([]);
    });
});
