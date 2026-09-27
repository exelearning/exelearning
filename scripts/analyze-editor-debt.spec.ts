import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dir, '..');
const chartDir = path.join(repoRoot, 'doc/architecture/adr/assets/editor-comparison');

function run(...extra: string[]) {
    const proc = Bun.spawnSync([process.execPath, 'scripts/analyze-editor-debt.mjs', ...extra], { cwd: repoRoot });
    expect(proc.exitCode).toBe(0);
    return proc.stdout.toString();
}

describe('analyze-editor-debt', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-debt-'));
    const first = run('--charts-out', tmp);
    const result = JSON.parse(first);

    it('is deterministic', () => {
        expect(run()).toBe(first);
    });

    it('classifies every plugin directory exactly once', () => {
        const c = result.counts;
        expect(c.upstream + c.exeFork + c.exeOwn).toBe(c.pluginDirs);
        expect(result.debtChart[0].count).toBe(c.exeFork + c.exeOwn);
    });

    it('keeps the committed ADR charts in sync with the script and evaluation.json', () => {
        for (const name of fs.readdirSync(tmp)) {
            expect(fs.readFileSync(path.join(tmp, name), 'utf8')).toBe(
                fs.readFileSync(path.join(chartDir, name), 'utf8'),
            );
        }
        fs.rmSync(tmp, { recursive: true, force: true });
    });
});
