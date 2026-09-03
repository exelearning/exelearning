import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildVendorPlan, detectDrift, resolvePaths, run, writeVendoredTree } from './vendor-edicuatex';

const repoRoot = path.resolve(import.meta.dir, '..');
const { packageRoot, targetRoot } = resolvePaths(repoRoot);

describe('vendor-edicuatex', () => {
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

    describe('the generated tree', () => {
        it('is what a build produces, and --check agrees with it', () => {
            // The tree is not committed: `vendor:edicuatex` runs as the first step of
            // build:all, so every path that serves or packages the editor regenerates
            // it. This asserts the two halves agree, which is what makes a stale tree
            // from an interrupted build visible instead of silent.
            if (!fs.existsSync(targetRoot)) {
                throw new Error(
                    'public/app/common/edicuatex is missing. It is generated: run `make vendor-edicuatex`.',
                );
            }

            expect(detectDrift(buildVendorPlan(packageRoot), targetRoot)).toEqual({
                missing: [],
                extra: [],
                changed: [],
            });
            expect(run(['--check'], repoRoot, { log: () => {}, error: () => {} })).toBe(0);
        });
    });
});
