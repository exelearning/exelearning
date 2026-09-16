import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildVendorPlan, type CliIo, detectDrift, resolvePaths, run, writeVendoredTree } from './vendor-edicuatex';

const repoRoot = path.resolve(import.meta.dir, '..');
const { packageRoot } = resolvePaths(repoRoot);

describe('vendor-edicuatex', () => {
    const temporaryRoots: string[] = [];

    function temporaryRoot(): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-edicuatex-'));
        temporaryRoots.push(root);
        return root;
    }

    afterEach(() => {
        for (const root of temporaryRoots.splice(0)) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    describe('buildVendorPlan', () => {
        it('vendors what the editor loads at runtime', () => {
            const plan = buildVendorPlan(packageRoot).map((entry) => entry.relativePath);

            expect(plan).toContain('index.html');
            expect(plan).toContain('js/edicuatex-tools.js');
            expect(plan).toContain('menus/editor.html');
            expect(plan).toContain('lang/es.js');
        });

        it('vendors the assets the editor used to take from a CDN', () => {
            const plan = buildVendorPlan(packageRoot).map((entry) => entry.relativePath);

            // Since 1.5.2 Tailwind and SortableJS are served from the package, which is
            // what makes the editor work offline and under a restrictive CSP.
            expect(plan).toContain('menus/vendor/tailwind.css');
            expect(plan).toContain('menus/vendor/Sortable.min.js');
        });

        it('keeps the licence, which the static pruner refuses to remove anyway', () => {
            expect(buildVendorPlan(packageRoot).map((e) => e.relativePath)).toContain('LICENSE.txt');
        });

        it('leaves out what only builds the package', () => {
            const plan = buildVendorPlan(packageRoot).map((entry) => entry.relativePath);

            for (const excluded of ['package.json', 'tailwind.config.js', 'README.md', 'README_es.md']) {
                expect(plan).not.toContain(excluded);
            }
            expect(plan.some((relativePath) => relativePath.startsWith('scripts/'))).toBe(false);
        });

        it('points every planned file at a file that exists in the package', () => {
            for (const entry of buildVendorPlan(packageRoot)) {
                expect(fs.existsSync(entry.sourcePath)).toBe(true);
            }
        });
    });

    describe('writeVendoredTree', () => {
        it('writes exactly the planned files and nothing else', () => {
            const target = path.join(temporaryRoot(), 'edicuatex');
            const plan = buildVendorPlan(packageRoot);

            writeVendoredTree(plan, target);

            expect(detectDrift(plan, target)).toEqual({ missing: [], extra: [], changed: [] });
        });

        it('reports a hand-edited file as drift', () => {
            const target = path.join(temporaryRoot(), 'edicuatex');
            const plan = buildVendorPlan(packageRoot);
            writeVendoredTree(plan, target);

            // The failure this whole script exists to prevent: the copy and the source
            // disagreeing without anyone noticing.
            fs.appendFileSync(path.join(target, 'js', 'edicuatex-tools.js'), '\n// local edit\n');

            expect(detectDrift(plan, target).changed).toEqual(['js/edicuatex-tools.js']);
        });
    });

    describe('run', () => {
        /**
         * A repository root with a stand-in package installed, so the CLI is exercised
         * against a tree the test owns. Running it against the real package would tie
         * these assertions to whatever upstream happens to ship.
         */
        function repoWithPackage(): string {
            const root = temporaryRoot();
            const installed = path.join(root, 'node_modules', 'edicuatex');
            fs.mkdirSync(installed, { recursive: true });
            fs.writeFileSync(path.join(installed, 'package.json'), JSON.stringify({ version: '1.2.3' }));
            for (const file of ['index.html', 'favicon.svg', 'LICENSE.txt']) {
                fs.writeFileSync(path.join(installed, file), `${file} contents\n`);
            }
            const directoryFiles = {
                css: 'edicuatex.css',
                icons: 'settings.svg',
                js: 'edicuatex-tools.js',
                lang: 'es.js',
                menus: 'base.json',
            };
            for (const [directory, file] of Object.entries(directoryFiles)) {
                fs.mkdirSync(path.join(installed, directory), { recursive: true });
                fs.writeFileSync(path.join(installed, directory, file), `${directory}/${file} contents\n`);
            }
            return root;
        }

        /** Collects both streams in order, which is all these assertions need. */
        function recordingIo(): { io: CliIo; output: string[] } {
            const output: string[] = [];
            return { io: { log: (m) => output.push(m), error: (m) => output.push(m) }, output };
        }

        it('stops with an actionable error when the package is not installed', () => {
            const root = temporaryRoot();
            const { io, output } = recordingIo();

            expect(run([], root, io)).toBe(1);
            expect(output.join('\n')).toContain('make deps');
            // A failed run must not leave a half-written tree for the build to pick up.
            expect(fs.existsSync(resolvePaths(root).targetRoot)).toBe(false);
        });

        it('vendors the tree and reports the version it came from', () => {
            const root = repoWithPackage();
            const { io, output } = recordingIo();

            expect(run([], root, io)).toBe(0);
            expect(output.join('\n')).toContain('edicuatex@1.2.3');
            expect(fs.existsSync(path.join(resolvePaths(root).targetRoot, 'index.html'))).toBe(true);
        });

        it('--check accepts the tree it has just written', () => {
            const root = repoWithPackage();
            run([], root, recordingIo().io);
            const { io, output } = recordingIo();

            expect(run(['--check'], root, io)).toBe(0);
            expect(output.join('\n')).toContain('is in sync with edicuatex@1.2.3');
        });

        it('--check fails and names every file that has drifted', () => {
            const root = repoWithPackage();
            run([], root, recordingIo().io);
            const vendored = resolvePaths(root).targetRoot;
            // The three shapes a stale tree takes after an interrupted build or a
            // hand-edit: a file gone, a file altered, a file that was never planned.
            fs.rmSync(path.join(vendored, 'lang', 'es.js'));
            fs.appendFileSync(path.join(vendored, 'js', 'edicuatex-tools.js'), '// local edit\n');
            fs.writeFileSync(path.join(vendored, 'menus', 'stray.json'), '{}\n');
            const { io, output } = recordingIo();

            expect(run(['--check'], root, io)).toBe(1);
            expect(output).toContain('  missing  lang/es.js');
            expect(output).toContain('  changed  js/edicuatex-tools.js');
            expect(output).toContain('  extra    menus/stray.json');
            expect(output.join('\n')).toContain('make vendor-edicuatex');
        });
    });

    // There is deliberately no test asserting the tree on disk matches the package.
    // The tree is generated by `vendor:edicuatex` as the first step of build:all, and
    // `bun test` runs before any build, so such a test would fail on a clean checkout
    // and be tautological after a build. What the drift check guards is a *stale* tree,
    // which is what `--check` is for: the Dockerfile runs it as a build assertion.
});
