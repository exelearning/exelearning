import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectDrift, inspectVendoredTree, writeVendoredTree } from './vendor-package';
import { buildVendorPlan, resolvePaths, run, SIRENA } from './vendor-sirena';

const repoRoot = path.resolve(import.meta.dir, '..');
const { packageRoot } = resolvePaths(repoRoot);

describe('vendor-sirena', () => {
    const temporaryRoots: string[] = [];

    function temporaryRoot(): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-sirena-'));
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
            const plan = buildVendorPlan(packageRoot).map(entry => entry.relativePath);

            expect(plan).toContain('index.html');
            expect(plan).toContain('js/sirena.js');
            expect(plan).toContain('css/sirena.css');
            // The strings the translation extraction reads, wrapped in _().
            expect(plan).toContain('lang/en.js');
        });

        it("brings no second Mermaid: inside eXe, the editor draws with eXe's", () => {
            const plan = buildVendorPlan(packageRoot).map(entry => entry.relativePath);

            expect(plan.some(relativePath => relativePath.startsWith('vendor/mermaid/'))).toBe(false);
        });

        it('keeps both licences, for the code and for the contents', () => {
            const plan = buildVendorPlan(packageRoot).map(entry => entry.relativePath);

            expect(plan).toContain('LICENSE.txt');
            expect(plan).toContain('LICENSE-CONTENIDOS');
            expect(plan).toContain('vendor/lucide/LICENSE.txt');
        });

        it('leaves out what only describes the standalone project', () => {
            const plan = buildVendorPlan(packageRoot).map(entry => entry.relativePath);

            expect(plan).not.toContain('package.json');
            expect(plan).not.toContain('README.md');
        });

        it('points every planned file at a file that exists in the package', () => {
            for (const entry of buildVendorPlan(packageRoot)) {
                expect(fs.existsSync(entry.sourcePath)).toBe(true);
            }
        });

        it('writes into its own directory, next to EdiCuaTeX', () => {
            expect(resolvePaths(repoRoot).targetRoot).toBe(path.join(repoRoot, 'public', 'app', 'common', 'sirena'));
        });
    });

    describe('writeVendoredTree', () => {
        it('writes exactly the planned files and nothing else', () => {
            const target = path.join(temporaryRoot(), 'sirena');
            const plan = buildVendorPlan(packageRoot);

            writeVendoredTree(plan, target);

            expect(detectDrift(plan, target)).toEqual({ missing: [], extra: [], changed: [] });
        });
    });

    /**
     * A repository root with a stand-in package installed, so the CLI and the translation
     * inspection are exercised against a tree the test owns rather than whatever the real
     * package happens to ship.
     */
    function repoWithPackage(): string {
        const root = temporaryRoot();
        const installed = path.join(root, 'node_modules', 'sirenaapp');
        fs.mkdirSync(installed, { recursive: true });
        fs.writeFileSync(path.join(installed, 'package.json'), JSON.stringify({ version: '9.8.7' }));
        for (const file of ['index.html', 'favicon.svg', 'LICENSE.txt', 'LICENSE-CONTENIDOS', 'README.md']) {
            fs.writeFileSync(path.join(installed, file), `${file} contents\n`);
        }
        const directoryFiles = {
            css: 'sirena.css',
            js: 'sirena.js',
            lang: 'en.js',
            'vendor/lucide': 'LICENSE.txt',
        };
        for (const [directory, file] of Object.entries(directoryFiles)) {
            fs.mkdirSync(path.join(installed, ...directory.split('/')), { recursive: true });
            fs.writeFileSync(path.join(installed, ...directory.split('/'), file), `${directory}/${file} contents\n`);
        }
        return root;
    }

    function recordingIo(): { io: { log: (m: string) => void; error: (m: string) => void }; output: string[] } {
        const output: string[] = [];
        return { io: { log: m => output.push(m), error: m => output.push(m) }, output };
    }

    describe('run', () => {
        it('stops with an actionable error when the package is not installed', () => {
            const root = temporaryRoot();
            const { io, output } = recordingIo();

            expect(run([], root, io)).toBe(1);
            expect(output.join('\n')).toContain('node_modules/sirenaapp is missing');
            expect(output.join('\n')).toContain('make deps');
            expect(fs.existsSync(resolvePaths(root).targetRoot)).toBe(false);
        });

        it('vendors the tree without the README and reports the version it came from', () => {
            const root = repoWithPackage();
            const { io, output } = recordingIo();

            expect(run([], root, io)).toBe(0);
            expect(output.join('\n')).toContain('sirenaapp@9.8.7');
            expect(output.join('\n')).toContain('public/app/common/sirena');
            const target = resolvePaths(root).targetRoot;
            expect(fs.existsSync(path.join(target, 'vendor', 'lucide', 'LICENSE.txt'))).toBe(true);
            expect(fs.existsSync(path.join(target, 'README.md'))).toBe(false);
        });

        it('--check accepts the tree it has just written and names what has drifted', () => {
            const root = repoWithPackage();
            run([], root, recordingIo().io);
            const accepted = recordingIo();

            expect(run(['--check'], root, accepted.io)).toBe(0);
            expect(accepted.output.join('\n')).toContain('is in sync with sirenaapp@9.8.7');

            fs.rmSync(path.join(resolvePaths(root).targetRoot, 'lang', 'en.js'));
            const rejected = recordingIo();

            expect(run(['--check'], root, rejected.io)).toBe(1);
            expect(rejected.output).toContain('  missing  lang/en.js');
            expect(rejected.output.join('\n')).toContain('make vendor-sirena');
        });
    });

    describe('inspectVendoredTree', () => {
        it('reports nothing when the package is not installed at all', () => {
            expect(inspectVendoredTree(SIRENA, temporaryRoot())).toBeNull();
        });

        it('trusts a tree that matches the pinned package', () => {
            const root = repoWithPackage();
            run([], root, recordingIo().io);

            expect(inspectVendoredTree(SIRENA, root)).toEqual({
                complete: true,
                detail: 'in sync with the pinned sirenaapp package',
            });
        });

        it('does not trust a tree whose strings file is stale', () => {
            const root = repoWithPackage();
            run([], root, recordingIo().io);
            fs.appendFileSync(path.join(resolvePaths(root).targetRoot, 'lang', 'en.js'), '// older version\n');

            expect(inspectVendoredTree(SIRENA, root)).toEqual({
                complete: false,
                detail: '1 file(s) out of sync: lang/en.js',
            });
        });
    });
});
