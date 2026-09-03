/**
 * vendor-mathjax
 *
 * Regenerates the vendored MathJax tree at public/app/common/exe_math/ from the
 * pinned `mathjax` npm package in node_modules.
 *
 * The tree is committed to git because exports, the static PWA build and the
 * Electron app all need MathJax on disk with no network. Hand-copying is what
 * produced issue #2259, where a 3.2.2 combined component was left sitting next
 * to a 4.0.0 accessibility stack: the loader refused the mismatched components
 * and the whole a11y menu died. Deriving the tree from one pinned package makes
 * that state unrepresentable.
 *
 *   bun scripts/vendor-mathjax.ts            # rewrite the tree
 *   bun scripts/vendor-mathjax.ts --check    # fail if the tree has drifted
 *
 * The --check mode backs vendor-mathjax.spec.ts, so CI catches drift.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Accessibility components vendored from the package.
 *
 * Only assistive MathML. It is the accessibility floor (ADR-2259-02): a `<math>`
 * element beside the visual output, which NVDA, JAWS and VoiceOver turn into speech
 * themselves. It needs no worker and no fetch, so it is the only path that survives
 * an export opened from the filesystem.
 *
 * The Speech Rule Engine — `a11y/{sre,explorer,speech,semantic-enrich,complexity}.js`
 * plus `sre/` — is deliberately absent (ADR-2259-03). It bought the expression
 * explorer, Nemeth braille and Auto Voicing, at 2,668,043 B in every export
 * containing LaTeX, only over HTTP, and only in 5 of eXeLearning's 11 interface
 * languages. `common.js` turns the features off through `menuOptions.settings` and
 * hides their menu sections, because speech lives inside the combined component:
 * deleting the files alone would leave the menu offering toggles that stall the
 * typeset queue.
 */
const VENDORED_A11Y_FILES = ['a11y/assistive-mml.js'] as const;

/**
 * Directories copied wholesale from the package.
 *
 * `adaptors/` is deliberately absent: jsdom, linkedom and liteDOM are Node-only
 * DOM adaptors that a browser can never load.
 *
 * `a11y/` is not here either: only one file of it is vendored, see
 * VENDORED_A11Y_FILES.
 *
 * `output/` is deliberately absent too. It holds only the standalone `svg` and
 * `chtml` output jaxes: `output/svg` is already inside the combined component
 * (it declares it via `checkVersion`, so the loader never fetches the file), and
 * `output/chtml` is reachable only from the menu's Math Renderer entry, whose
 * CHTML font is a separate 2.4 MB package we do not ship. `common.js` hides that
 * menu entry, which makes both files dead weight in every math export.
 */
const VENDORED_DIRECTORIES = ['input', 'ui'] as const;

/**
 * Files skipped inside the directories above.
 *
 * `bbm` and `bboldx` draw their glyphs from font extensions published separately
 * (@mathjax/mathjax-{bbm,bboldx}-font-extension), which are not vendored: nobody has
 * asked for the macros and each extension is heavier than both the ones that are.
 * Shipping the TeX half alone is worse than shipping neither, because `\require{bbm}`
 * would then register glyph ranges pointing at files that are not there, and the
 * second character in one of those ranges fails the whole typeset call rather than
 * just missing a glyph. Leaving them out turns that into an ordinary "extension not
 * found" on the console.
 */
const EXCLUDED_DIRECTORY_FILES = new Set(['input/tex/extensions/bbm.js', 'input/tex/extensions/bboldx.js']);

/**
 * Glyph ranges of the SVG font that are vendored alongside the bundle.
 *
 * MathJax 4 splits the font into a base set bundled inside the combined
 * component plus ~40 ranges the browser fetches on first use. Unvendored, they
 * resolve through `loader.paths.fonts`, whose default is
 * `https://cdn.jsdelivr.net/npm/@mathjax` — an external request from exported
 * packages and a missing glyph wherever there is no network (Electron, the
 * offline PWA, a SCORM package on an isolated LMS). `common.js` repoints
 * `paths.fonts` at this directory so a range can never leave the origin.
 *
 * The line is drawn by measurement, not by taste: this is exactly the set of
 * ranges whose code points MathJax 3.2.2's bundled TeX font could already
 * render, so vendoring them means the upgrade loses no glyph anyone could
 * previously see. `vendor-mathjax.spec.ts` recomputes that overlap from the
 * bundle's own range table and accounts for every excluded range.
 *
 * Deliberately excluded, with the v3 code points they would restore:
 *   accents-b-i (2), greek (1), greek-ss (1)  — 1.7 MB for four code points
 *   PUA (18), monospace-ex (17), sans-serif-ex (12) — 1.4 MB, all reachable
 *       through the cheaper ranges above in the variants authors actually type
 *   everything else (latin*, cyrillic*, hebrew, arabic, devanagari, cherokee,
 *       braille*, phonetics*, marrows, mshapes, sans-serif-[rbi]*, monospace-l)
 *       — zero overlap: v3 never rendered those code points either, so they are
 *       new v4 coverage rather than a regression.
 */
export const VENDORED_FONT_RANGES = [
    // TeX font-variant macros: \mathcal, \mathbb, \mathfrak, \mathscr, \mathsf, \mathtt.
    'calligraphic',
    'double-struck',
    'fraktur',
    'script',
    'sans-serif',
    'monospace',
    // Operators, relations, arrows and shapes reachable from plain TeX macros,
    // including the stretchy \uparrow / \downarrow delimiters.
    'arrows',
    'math',
    'shapes',
    'symbols',
    'symbols-b-i',
    'variants',
    // \H{o} and friends.
    'accents',
] as const;

/**
 * Ranges deliberately left out, with the number of MathJax 3.2.2 code points each
 * one would restore. Every range the font package publishes must appear here or in
 * VENDORED_FONT_RANGES; `vendor-mathjax.spec.ts` fails otherwise, so a MathJax
 * upgrade that adds a range cannot slip through unweighed.
 */
export const EXCLUDED_FONT_RANGES: Record<string, string> = {
    // Costly for what they restore.
    'accents-b-i': 'bold/italic of the 2 accents in `accents` — 145 KB for 2 code points',
    greek: 'Greek Extended, polytonic and Coptic — 1.0 MB for 1 code point (ϝ); math Greek is in the base set',
    'greek-ss': 'sans-serif of the same — 528 KB for the same code point',
    PUA: 'private-use glyphs — 350 KB for 18 code points reachable through the vendored ranges',
    'monospace-ex': 'extended monospace — 610 KB for 17 code points',
    'sans-serif-ex': 'extended sans-serif — 484 KB for 12 code points',
    // No overlap at all with 3.2.2: new v4 coverage, not a regression.
    latin: 'Latin-1 and Latin Extended — 3.2.2 did not render them either',
    'latin-b': 'as latin',
    'latin-i': 'as latin',
    'latin-bi': 'as latin',
    'sans-serif-r': 'as latin',
    'sans-serif-b': 'as latin',
    'sans-serif-i': 'as latin',
    'sans-serif-bi': 'as latin',
    'monospace-l': 'as latin',
    cyrillic: 'non-Latin script, new in v4',
    'cyrillic-ss': 'non-Latin script, new in v4',
    hebrew: 'non-Latin script, new in v4',
    arabic: 'non-Latin script, new in v4',
    devanagari: 'non-Latin script, new in v4',
    cherokee: 'non-Latin script, new in v4',
    phonetics: 'IPA, new in v4',
    'phonetics-ss': 'IPA, new in v4',
    braille: 'braille cells, new in v4 (Nemeth speech output does not need the glyphs)',
    'braille-d': 'braille cells, new in v4',
    marrows: 'supplemental arrows, new in v4',
    mshapes: 'supplemental shapes, new in v4',
};

/** Path of the SVG font package the ranges above come from, inside node_modules. */
const FONT_PACKAGE = '@mathjax/mathjax-newcm-font';

/**
 * Font extensions for the TeX packages that ship glyphs of their own.
 *
 * MathJax 4 moved these out of the core font: `[tex]/mhchem` and `[tex]/dsfont`
 * ask for `[fonts]/<package>/svg.js` the first time a document uses them. Left to
 * the stock `paths.fonts` they came from jsdelivr and nobody noticed, because a
 * browser with a network renders the formula anyway — `\ce{H2O}` in an export
 * opened offline would simply have lost its glyphs.
 *
 * `bbm` and `bboldx` have published extensions too (838 KB and 662 KB unpacked),
 * but neither macro set is enabled in `common.js`, so neither is vendored.
 */
export const VENDORED_FONT_EXTENSIONS = [
    '@mathjax/mathjax-dsfont-font-extension',
    '@mathjax/mathjax-mhchem-font-extension',
] as const;

/** Directory of the font package holding one file per glyph range. */
export function fontRangeDirectory(packageRoot: string): string {
    return path.join(packageRoot, '..', FONT_PACKAGE, 'svg', 'dynamic');
}

/**
 * Where the ranges land inside the vendored tree.
 *
 * The layout mirrors the npm package because MathJax builds the URL itself:
 * the font registers `loader.paths['mathjax-newcm'] = '[fonts]/mathjax-newcm-font'`
 * and asks for `[mathjax-newcm]/svg/dynamic/<range>.js`. Keeping the same shape
 * means the only thing we have to configure is `paths.fonts`.
 */
const FONT_TARGET_PREFIX = 'fonts/mathjax-newcm-font/svg/dynamic';

/**
 * Individual files copied from the package root.
 *
 * Only the `tex-mml-svg` combined component is vendored — it is the single
 * component eXeLearning loads, and in v4 it already bundles core, the SVG
 * output, the contextual menu and the speech/explorer/semantic-enrich
 * accessibility extensions. The other combined components (chtml variants,
 * `-nofont` variants) and the Node entry points are not shipped.
 */
const VENDORED_FILES = ['LICENSE', 'core.js', 'loader.js', 'startup.js', 'tex-mml-svg.js'] as const;

export interface VendorPlanEntry {
    /** Path relative to the vendored root, using POSIX separators. */
    relativePath: string;
    /** Absolute path of the source file inside node_modules. */
    sourcePath: string;
}

function listFilesRecursively(root: string, prefix = ''): string[] {
    const entries = fs.readdirSync(path.join(root, prefix), { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            files.push(...listFilesRecursively(root, relativePath));
        } else {
            files.push(relativePath);
        }
    }
    return files.sort();
}

/**
 * Builds the list of files the vendored tree must contain, sorted by path.
 * Pure — takes the package root, touches nothing else.
 */
export function buildVendorPlan(packageRoot: string): VendorPlanEntry[] {
    const entries: VendorPlanEntry[] = [];

    for (const file of VENDORED_FILES) {
        entries.push({ relativePath: file, sourcePath: path.join(packageRoot, file) });
    }

    for (const directory of VENDORED_DIRECTORIES) {
        for (const file of listFilesRecursively(path.join(packageRoot, directory))) {
            const relativePath = `${directory}/${file}`;
            if (EXCLUDED_DIRECTORY_FILES.has(relativePath)) continue;
            entries.push({ relativePath, sourcePath: path.join(packageRoot, directory, ...file.split('/')) });
        }
    }

    const fontRoot = fontRangeDirectory(packageRoot);
    for (const range of VENDORED_FONT_RANGES) {
        entries.push({
            relativePath: `${FONT_TARGET_PREFIX}/${range}.js`,
            sourcePath: path.join(fontRoot, `${range}.js`),
        });
    }

    for (const extension of VENDORED_FONT_EXTENSIONS) {
        const name = extension.split('/')[1];
        entries.push({
            relativePath: `fonts/${name}/svg.js`,
            sourcePath: path.join(packageRoot, '..', extension, 'svg.js'),
        });
    }

    for (const file of VENDORED_A11Y_FILES) {
        entries.push({ relativePath: file, sourcePath: path.join(packageRoot, ...file.split('/')) });
    }

    return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function sha256(filePath: string): string {
    return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export interface VendorDrift {
    missing: string[];
    extra: string[];
    changed: string[];
}

/** Compares the vendored tree against the plan without writing anything. */
export function detectDrift(plan: VendorPlanEntry[], targetRoot: string): VendorDrift {
    const expected = new Map(plan.map((entry) => [entry.relativePath, entry.sourcePath]));
    const actual = fs.existsSync(targetRoot) ? new Set(listFilesRecursively(targetRoot)) : new Set<string>();

    const missing: string[] = [];
    const changed: string[] = [];
    for (const [relativePath, sourcePath] of expected) {
        if (!actual.has(relativePath)) {
            missing.push(relativePath);
        } else if (sha256(sourcePath) !== sha256(path.join(targetRoot, ...relativePath.split('/')))) {
            changed.push(relativePath);
        }
    }
    const extra = [...actual].filter((relativePath) => !expected.has(relativePath)).sort();

    return { missing: missing.sort(), extra, changed: changed.sort() };
}

/** Writes the plan to disk, removing anything the plan does not list. */
export function writeVendoredTree(plan: VendorPlanEntry[], targetRoot: string): void {
    fs.rmSync(targetRoot, { recursive: true, force: true });
    for (const entry of plan) {
        const destination = path.join(targetRoot, ...entry.relativePath.split('/'));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(entry.sourcePath, destination);
    }
}

export function resolvePaths(repoRoot: string): { packageRoot: string; targetRoot: string } {
    return {
        packageRoot: path.join(repoRoot, 'node_modules', 'mathjax'),
        targetRoot: path.join(repoRoot, 'public', 'app', 'common', 'exe_math'),
    };
}

export interface CliIo {
    log: (message: string) => void;
    error: (message: string) => void;
}

const consoleIo: CliIo = { log: (m) => console.log(m), error: (m) => console.error(m) };

/** Runs the command and returns the process exit code. */
export function run(argv: string[], repoRoot: string, io: CliIo = consoleIo): number {
    const { packageRoot, targetRoot } = resolvePaths(repoRoot);

    if (!fs.existsSync(packageRoot)) {
        io.error('node_modules/mathjax is missing. Run `make deps` first.');
        return 1;
    }

    const version = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version;
    const plan = buildVendorPlan(packageRoot);

    if (argv.includes('--check')) {
        const drift = detectDrift(plan, targetRoot);
        if (drift.missing.length + drift.extra.length + drift.changed.length === 0) {
            io.log(`public/app/common/exe_math is in sync with mathjax@${version} (${plan.length} files).`);
            return 0;
        }
        io.error(`public/app/common/exe_math has drifted from mathjax@${version}:`);
        for (const file of drift.missing) io.error(`  missing  ${file}`);
        for (const file of drift.extra) io.error(`  extra    ${file}`);
        for (const file of drift.changed) io.error(`  changed  ${file}`);
        io.error('\nRun `make vendor-mathjax` to regenerate the tree.');
        return 1;
    }

    writeVendoredTree(plan, targetRoot);
    io.log(`Vendored mathjax@${version} into public/app/common/exe_math (${plan.length} files).`);
    return 0;
}

if (import.meta.main) {
    process.exit(run(process.argv.slice(2), path.resolve(import.meta.dir, '..')));
}
