import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    buildVendorPlan,
    detectDrift,
    EXCLUDED_FONT_RANGES,
    fontRangeDirectory,
    resolvePaths,
    run,
    VENDORED_FONT_RANGES,
    writeVendoredTree,
} from './vendor-mathjax';

const repoRoot = path.resolve(import.meta.dir, '..');
const { packageRoot, targetRoot } = resolvePaths(repoRoot);

describe('vendor-mathjax', () => {
    describe('buildVendorPlan', () => {
        it('vendors only the tex-mml-svg combined component', () => {
            const rootFiles = buildVendorPlan(packageRoot)
                .map((entry) => entry.relativePath)
                .filter((relativePath) => !relativePath.includes('/'));

            expect(rootFiles).toContain('tex-mml-svg.js');
            expect(rootFiles).not.toContain('tex-mml-chtml.js');
            expect(rootFiles).not.toContain('tex-mml-svg-nofont.js');
            expect(rootFiles).not.toContain('node-main.js');
        });

        it('excludes the Node-only DOM adaptors a browser can never load', () => {
            const plan = buildVendorPlan(packageRoot).map((entry) => entry.relativePath);

            expect(plan.some((relativePath) => relativePath.startsWith('adaptors/'))).toBe(false);
        });

        it('ships assistive MathML, which is the accessibility floor', () => {
            const plan = buildVendorPlan(packageRoot).map((entry) => entry.relativePath);

            // Not bundled into tex-mml-svg.js; common.js asks the loader for it. It is
            // the only a11y path with no worker and no fetch, so it is the only one that
            // works in an export opened from the filesystem. ADR-2259-02.
            expect(plan).toContain('a11y/assistive-mml.js');
        });

        it('ships no TeX extension whose font extension is not vendored', () => {
            const plan = buildVendorPlan(packageRoot).map((entry) => entry.relativePath);

            // Shipping the TeX half alone is worse than shipping neither: \require{bbm}
            // registers glyph ranges pointing at files that are not there, and the
            // second character in such a range fails the whole typeset call.
            expect(plan).not.toContain('input/tex/extensions/bbm.js');
            expect(plan).not.toContain('input/tex/extensions/bboldx.js');
        });

        it('ships no Speech Rule Engine', () => {
            const plan = buildVendorPlan(packageRoot).map((entry) => entry.relativePath);

            // ADR-2259-03. 2,668,043 B in every export containing LaTeX, usable only
            // over HTTP and only in 5 of 11 interface languages, for capabilities the
            // screen reader already provides from the MathML.
            expect(plan.filter((relativePath) => relativePath.startsWith('sre/'))).toEqual([]);
            for (const component of ['sre', 'explorer', 'speech', 'semantic-enrich', 'complexity']) {
                expect(plan).not.toContain(`a11y/${component}.js`);
            }
        });

        it('accounts for every glyph range the font package publishes', () => {
            // MathJax 4 fetches these on demand and the stock loader path is a CDN, so
            // an unlisted range is an external request from exported content and a
            // missing glyph offline. Forcing every range into one of the two lists
            // means a MathJax upgrade that adds one fails here instead of shipping.
            const published = fs
                .readdirSync(fontRangeDirectory(packageRoot))
                .filter((file) => file.endsWith('.js'))
                .map((file) => path.basename(file, '.js'))
                .sort();
            const accounted = [...VENDORED_FONT_RANGES, ...Object.keys(EXCLUDED_FONT_RANGES)].sort();

            expect(accounted).toEqual(published);
        });

        it('vendors the glyph ranges the TeX variant macros need', () => {
            const plan = buildVendorPlan(packageRoot).map((entry) => entry.relativePath);

            // \\mathbb, \\mathcal, \\mathfrak, \\mathscr: MathJax 3.2.2 rendered all of
            // them from its bundled font, so losing them would be a visible regression.
            for (const range of ['double-struck', 'calligraphic', 'fraktur', 'script']) {
                expect(plan).toContain(`fonts/mathjax-newcm-font/svg/dynamic/${range}.js`);
            }
        });

        it('drops the standalone output jaxes the menu can no longer reach', () => {
            const plan = buildVendorPlan(packageRoot).map((entry) => entry.relativePath);

            // output/svg is inside the combined component; output/chtml needs a font
            // package we do not ship and common.js hides its menu entry.
            expect(plan.some((relativePath) => relativePath.startsWith('output/'))).toBe(false);
        });

        it('points every planned file at a file that exists in the package', () => {
            for (const entry of buildVendorPlan(packageRoot)) {
                expect(fs.existsSync(entry.sourcePath)).toBe(true);
            }
        });
    });

    describe('writeVendoredTree', () => {
        const temporaryRoots: string[] = [];

        function temporaryRoot(): string {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-mathjax-'));
            temporaryRoots.push(root);
            return root;
        }

        afterEach(() => {
            for (const root of temporaryRoots.splice(0)) {
                fs.rmSync(root, { recursive: true, force: true });
            }
        });

        it('writes exactly the planned files and nothing else', () => {
            const target = path.join(temporaryRoot(), 'exe_math');
            const plan = buildVendorPlan(packageRoot);

            writeVendoredTree(plan, target);

            expect(detectDrift(plan, target)).toEqual({ missing: [], extra: [], changed: [] });
        });

        it('removes files a previous vendoring left behind', () => {
            // The failure mode behind #2259 was a partial update leaving stale files, so
            // the writer clears the tree rather than merging into it.
            const target = path.join(temporaryRoot(), 'exe_math');
            fs.mkdirSync(path.join(target, 'sre', 'mathmaps'), { recursive: true });
            fs.writeFileSync(path.join(target, 'sre', 'mathmaps', 'fr.json'), '{}');
            fs.writeFileSync(path.join(target, 'stale-from-mathjax-3.js'), 'VERSION="3.2.2"');

            writeVendoredTree(buildVendorPlan(packageRoot), target);

            expect(fs.existsSync(path.join(target, 'stale-from-mathjax-3.js'))).toBe(false);
            expect(fs.existsSync(path.join(target, 'sre', 'mathmaps', 'fr.json'))).toBe(false);
        });
    });

    describe('run', () => {
        function captureIo() {
            const logs: string[] = [];
            const errors: string[] = [];
            return { io: { log: (m: string) => logs.push(m), error: (m: string) => errors.push(m) }, logs, errors };
        }

        it('reports success when the committed tree is in sync', () => {
            const { io, logs, errors } = captureIo();

            expect(run(['--check'], repoRoot, io)).toBe(0);
            expect(logs.join('\n')).toContain('is in sync with mathjax@');
            expect(errors).toEqual([]);
        });

        it('fails and names every drifted file', () => {
            const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-mathjax-cli-'));
            try {
                // A repo root whose node_modules is the real one but whose vendored tree
                // is deliberately wrong, so --check has something to report.
                fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(scratch, 'node_modules'));
                const target = path.join(scratch, 'public', 'app', 'common', 'exe_math');
                fs.mkdirSync(target, { recursive: true });
                fs.writeFileSync(path.join(target, 'tex-mml-svg.js'), 'not the real file');
                fs.writeFileSync(path.join(target, 'left-over.js'), '');
                const { io, errors } = captureIo();

                expect(run(['--check'], scratch, io)).toBe(1);
                const report = errors.join('\n');
                expect(report).toContain('has drifted from mathjax@');
                expect(report).toContain('changed  tex-mml-svg.js');
                expect(report).toContain('extra    left-over.js');
                expect(report).toContain('missing  core.js');
                expect(report).toContain('make vendor-mathjax');
            } finally {
                fs.rmSync(scratch, { recursive: true, force: true });
            }
        });

        it('writes the tree when no flag is given', () => {
            const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-mathjax-cli-'));
            try {
                fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(scratch, 'node_modules'));
                const { io, logs } = captureIo();

                expect(run([], scratch, io)).toBe(0);
                expect(logs.join('\n')).toContain('Vendored mathjax@');
                expect(run(['--check'], scratch, io)).toBe(0);
            } finally {
                fs.rmSync(scratch, { recursive: true, force: true });
            }
        });

        it('explains itself when the package is not installed', () => {
            const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-mathjax-cli-'));
            try {
                const { io, errors } = captureIo();

                expect(run(['--check'], scratch, io)).toBe(1);
                expect(errors.join('\n')).toContain('Run `make deps` first');
            } finally {
                fs.rmSync(scratch, { recursive: true, force: true });
            }
        });
    });

    describe('the committed tree', () => {
        it('matches the pinned mathjax package exactly', () => {
            const drift = detectDrift(buildVendorPlan(packageRoot), targetRoot);

            expect({ missing: drift.missing, extra: drift.extra, changed: drift.changed }).toEqual({
                missing: [],
                extra: [],
                changed: [],
            });
        });

        it('contains no MathJax 3 leftovers (regression guard for #2259)', () => {
            const offenders: string[] = [];
            const walk = (dir: string): void => {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        walk(full);
                    } else if (entry.name.endsWith('.js') && fs.readFileSync(full, 'utf8').includes('"3.2.2"')) {
                        offenders.push(path.relative(targetRoot, full));
                    }
                }
            };
            walk(targetRoot);

            expect(offenders).toEqual([]);
        });
    });
});
