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

    it('writes exactly the six committed charts, including the experiment charts', () => {
        const committed = fs.readdirSync(chartDir).filter(n => n.endsWith('.svg'));
        expect(fs.readdirSync(tmp).sort()).toEqual(committed.sort());
        expect(committed).toContain('5-html-roundtrip.svg');
        expect(committed).toContain('6-asset-url-experiment.svg');
    });

    it('records well-formed experiment results in evaluation.json', () => {
        const { htmlRoundtrip, assetUri } = JSON.parse(
            fs.readFileSync(path.join(chartDir, 'evaluation.json'), 'utf8'),
        ).experiments;
        for (const e of htmlRoundtrip.editors) {
            for (const m of htmlRoundtrip.metrics) {
                const v = e.pct[m.id];
                expect(v === null || (v >= 0 && v <= 100)).toBe(true);
            }
        }
        for (const e of assetUri.editors) {
            for (const g of assetUri.groups) {
                const [passed, total] = e[g.id];
                expect(total > 0 && passed >= 0 && passed <= total).toBe(true);
            }
        }
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
