import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildVendorPlan, detectDrift, resolvePaths, run, VENDORED_SRE_LOCALES, writeVendoredTree } from './vendor-mathjax';

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

        it('vendors the speech worker and exactly the selected locales', () => {
            const mathmaps = buildVendorPlan(packageRoot)
                .map((entry) => entry.relativePath)
                .filter((relativePath) => relativePath.startsWith('sre/mathmaps/'))
                .map((relativePath) => path.basename(relativePath, '.json'))
                .sort();

            expect(mathmaps).toEqual([...VENDORED_SRE_LOCALES].sort());
            expect(buildVendorPlan(packageRoot).map((e) => e.relativePath)).toContain('sre/speech-worker.js');
        });

        it('ships the lazily-loaded accessibility components the MathJax menu offers', () => {
            const plan = buildVendorPlan(packageRoot).map((entry) => entry.relativePath);

            // These are NOT bundled into tex-mml-svg.js; the contextual menu fetches
            // them on demand. Issue #2259 was exactly these files going stale.
            expect(plan).toContain('a11y/assistive-mml.js');
            expect(plan).toContain('a11y/complexity.js');
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
