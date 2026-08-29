import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Every place that builds a SCORM 1.2 export must supply the runtime version.
 *
 * The version stamp is only worth having if it is in every package, and it was in almost
 * none of them: `buildScorm12RuntimeFiles()` takes the version as an argument, five call
 * sites construct the exporter, and only the two CLI commands passed it. Everything else
 * shipped `eXeLearning-SCORM12-Runtime: unknown`, including the export a user makes from
 * the editor — the one the Moodle plugin vendors its runtime from.
 *
 * Unit tests on the resolver cannot catch that: the defect is a caller that never calls
 * it. So this checks the call sites themselves, which is also what protects the next one
 * somebody adds.
 */

const SRC = path.join(process.cwd(), 'src');

/** Files that construct a SCORM 1.2 exporter, with their contents. */
function scorm12ExportCallSites(): { file: string; source: string }[] {
    const found: { file: string; source: string }[] = [];

    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) continue;
            const source = fs.readFileSync(full, 'utf8');
            if (source.includes('new Scorm12Exporter(')) {
                found.push({ file: path.relative(process.cwd(), full), source });
            }
        }
    };
    walk(SRC);
    return found;
}

describe('SCORM 1.2 runtime version, at every call site', () => {
    it('finds the call sites at all, so a rename cannot make this test vacuous', () => {
        expect(scorm12ExportCallSites().length).toBeGreaterThanOrEqual(4);
    });

    it('every server-side file that builds a SCORM 1.2 export supplies runtimeVersion', () => {
        // The browser entry is the one exemption, and it is deliberate: nothing in the
        // browser knows which release it is, so the exporter resolves it from the running
        // application instead. That path has its own test below and in
        // Scorm12Runtime.spec.ts. Everything else runs in Node, can read package.json,
        // and must say so explicitly.
        const browserEntry = path.join('src', 'shared', 'export', 'browser', 'index.ts');
        const missing = scorm12ExportCallSites()
            .filter(({ file }) => file !== browserEntry)
            .filter(({ source }) => !source.includes('runtimeVersion'))
            .map(({ file }) => file);

        expect(missing).toEqual([]);
    });

    it('the browser entry point defaults it instead of asking each caller', () => {
        // There is no caller in the browser that knows the release: the exporter runs
        // inside the application, which publishes its own version. The exporter resolves
        // it there rather than every UI path remembering to pass it.
        const runtime = fs.readFileSync(path.join(SRC, 'shared', 'export', 'utils', 'Scorm12Runtime.ts'), 'utf8');

        expect(runtime).toContain('export function resolveScorm12RuntimeVersion');
        expect(runtime).toContain('eXeLearning?: { version?: unknown }');
    });
});
