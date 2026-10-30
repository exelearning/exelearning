import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CliIo } from './vendor-edicuatex';
import { buildVendorPlan, resolvePaths, run } from './vendor-pele';

const repoRoot = path.resolve(import.meta.dir, '..');

describe('vendor-pele', () => {
    const temporaryRoots: string[] = [];

    function temporaryRepo(): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-pele-'));
        temporaryRoots.push(root);
        fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
        fs.symlinkSync(resolvePaths(repoRoot).packageRoot, path.join(root, 'node_modules', 'pele'), 'junction');
        return root;
    }

    function captureIo(): CliIo & { output: string[] } {
        const output: string[] = [];
        return { output, log: m => output.push(m), error: m => output.push(m) };
    }

    afterEach(() => {
        for (const root of temporaryRoots.splice(0)) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('vendors the browser build and its licence from the installed package', () => {
        const plan = buildVendorPlan(resolvePaths(repoRoot).packageRoot);

        expect(plan.map(entry => entry.relativePath)).toEqual(['pele.global.js', 'LICENSE']);
        for (const entry of plan) {
            expect(fs.existsSync(entry.sourcePath)).toBe(true);
        }
        expect(fs.readFileSync(plan[0].sourcePath, 'utf8')).toContain('var pele=');
    });

    it('writes the copy and then reports it in sync', () => {
        const root = temporaryRepo();
        const io = captureIo();

        expect(run([], root, io)).toBe(0);
        expect(fs.existsSync(path.join(root, 'public/app/common/pele/pele.global.js'))).toBe(true);
        expect(run(['--check'], root, io)).toBe(0);
        expect(io.output.at(-1)).toContain('is in sync with pele@');
    });

    it('fails the check when the copy is missing or stale', () => {
        const root = temporaryRepo();
        const io = captureIo();

        expect(run(['--check'], root, io)).toBe(1);
        expect(io.output.join('\n')).toContain('missing  pele.global.js');

        run([], root, io);
        fs.writeFileSync(path.join(root, 'public/app/common/pele/pele.global.js'), 'stale');
        expect(run(['--check'], root, io)).toBe(1);
        expect(io.output.join('\n')).toContain('changed  pele.global.js');
    });

    it('explains how to recover when the package is not installed', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-pele-'));
        temporaryRoots.push(root);
        const io = captureIo();

        expect(run([], root, io)).toBe(1);
        expect(io.output[0]).toContain('node_modules/pele is missing');
    });
});
