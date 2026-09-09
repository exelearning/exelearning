/**
 * Consistency checks on the committed grading scenario catalogue
 * (test/helpers/grading-scenarios.ts).
 *
 * The expectations in the catalogue are hand-authored literals — that is the oracle
 * rule, and nothing here imports the runtime's aggregation to recompute them. What is
 * checked is that the hand-authored numbers agree with each other and with the
 * declaration they describe: the overall is the weight-normalised mean of the per-item
 * map (the `weighted-mean-v1` policy the oracle names), every answered iDevice's
 * per-item score is the score the learner script aims for, the weights are the weights
 * the package is built with, and each target is reachable through the drivers.
 */
import { describe, it, expect, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    CATALOGUE_VERSION,
    GRADING_SCENARIOS,
    ORACLE_POLICY_ID,
    cataloguePath,
    gradingPackages,
    gradingScenario,
    loadCatalogue,
    manifestPath,
    packageFileName,
    recordedScenarios,
    scenarioIdevices,
    type GradingScenario,
} from './grading-scenarios';

/**
 * The `weighted-mean-v1` rule, written out here as a second copy on purpose: this is
 * the arithmetic the notes in the catalogue perform by hand, not the runtime's
 * `getFinalScore`. Σ(score·weight) / Σ(weight), rounded to two decimals.
 */
function weightedMean(perItem: Record<string, number>, weights: Record<string, number>): number {
    let scored = 0;
    let total = 0;
    for (const [id, score] of Object.entries(perItem)) {
        scored += score * weights[id];
        total += weights[id];
    }
    return Math.round((scored / total) * 100) / 100;
}

describe('grading scenario catalogue', () => {
    it('declares at least the four-type matrix and gives every scenario a unique id', () => {
        const ids = GRADING_SCENARIOS.map(s => s.id);
        expect(ids.length).toBeGreaterThanOrEqual(4);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain('M2');
    });

    for (const scenario of GRADING_SCENARIOS) {
        describe(scenario.id, () => {
            const idevices = scenarioIdevices(scenario.spec);

            it('names the oracle policy every expectation follows', () => {
                expect(scenario.expected.policyId).toBe(ORACLE_POLICY_ID);
                expect(scenario.expected.note.length).toBeGreaterThan(0);
            });

            it('has an overall equal to the weight-normalised mean of its per-item map', () => {
                expect(scenario.expected.overall).toBe(
                    weightedMean(scenario.expected.perItem, scenario.expected.weights),
                );
            });

            it('scores exactly the gradable iDevices the package declares', () => {
                const declared = idevices.map(i => i.id).sort();
                expect(Object.keys(scenario.expected.perItem).sort()).toEqual(declared);
                expect(Object.keys(scenario.expected.weights).sort()).toEqual(declared);
                expect(Object.keys(scenario.actions).sort()).toEqual(declared);
            });

            it('carries the weights the package is built with', () => {
                for (const idevice of idevices) {
                    expect(scenario.expected.weights[idevice.id]).toBe(idevice.weighted);
                }
            });

            it('expects of each iDevice exactly the score the learner script aims for', () => {
                for (const idevice of idevices) {
                    const action = scenario.actions[idevice.id];
                    if (action === 'skip') {
                        expect(scenario.expected.ungraded).toContain(idevice.id);
                    } else {
                        expect(scenario.expected.perItem[idevice.id]).toBe(action);
                        expect(scenario.expected.ungraded).not.toContain(idevice.id);
                    }
                }
            });

            it('aims only at scores the drivers can reach exactly', () => {
                for (const idevice of idevices) {
                    const action = scenario.actions[idevice.id];
                    if (action === 'skip') continue;
                    const correct = (action * idevice.questions) / 100;
                    expect(Number.isInteger(correct)).toBe(true);
                    // A single wrong dragdrop card would have to evict a correct one.
                    if (idevice.type === 'dragdrop') expect(idevice.questions - correct).not.toBe(1);
                }
            });

            it('visits only pages the package has, and every page at least once', () => {
                const pageIds = scenario.spec.pages.map(p => p.id);
                for (const pageId of scenario.navigation) expect(pageIds).toContain(pageId);
                for (const pageId of pageIds) expect(scenario.navigation).toContain(pageId);
            });
        });
    }

    it('records the four-type matrix under the committed trace names', () => {
        const recorded = recordedScenarios();
        expect(recorded.map(s => s.id)).toEqual(['M2', 'M3', 'M3C', 'M4']);
        const traces = recorded.map(s => s.trace);
        expect(new Set(traces).size).toBe(traces.length);
        for (const scenario of recorded) {
            expect(fs.existsSync(path.join('test', 'fixtures', 'grading', `${scenario.trace}.trace.json`))).toBe(true);
        }
    });

    it('exports each distinct package once, under the id of the first scenario that uses it', () => {
        const packages = gradingPackages();
        expect(packages.map(p => p.id)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5']);
        // M3C is the same package as M3, answered differently.
        expect(gradingScenario('M3C').spec).toBe(gradingScenario('M3').spec);
        expect(new Set(packages.map(p => p.spec)).size).toBe(packages.length);
    });

    it('resolves a scenario by id and refuses an unknown one', () => {
        expect(gradingScenario('M4').spec.odeId).toBe('GRADING-FIXTURE-M4');
        expect(() => gradingScenario('nope')).toThrow("unknown grading scenario 'nope'");
    });

    it('lists the gradable iDevices of a package with their defaults filled in', () => {
        const ideviceList = scenarioIdevices({
            title: 't',
            pages: [{ id: 'p', title: 'p', idevices: [{ id: 'x', weighted: 50 }] }],
        });
        expect(ideviceList).toEqual([{ page: 'p', id: 'x', type: 'trueorfalse', weighted: 50, questions: 4 }]);
    });
});

describe('catalogue layout on disk', () => {
    const roots: string[] = [];
    afterEach(() => {
        for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
    });

    function tmpRoot(): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-catalogue-'));
        roots.push(root);
        return root;
    }

    it('names the files the live lanes read', () => {
        expect(cataloguePath('/audit')).toBe(path.join('/audit', 'scenarios', 'catalogue.json'));
        expect(manifestPath('/audit', 'main')).toBe(path.join('/audit', 'packages', 'main', 'manifest-main.json'));
        expect(packageFileName('M2', 'main', 'scorm12')).toBe('M2-main-scorm12.zip');
    });

    it('loads nothing when no catalogue was staged', () => {
        expect(loadCatalogue(tmpRoot())).toBeNull();
    });

    it('loads a staged catalogue of the current version', () => {
        const root = tmpRoot();
        const file = cataloguePath(root);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
            file,
            JSON.stringify({ catalogueVersion: CATALOGUE_VERSION, scenarios: GRADING_SCENARIOS.slice(0, 1) }),
        );
        const loaded = loadCatalogue(root);
        expect(loaded?.scenarios.map((s: GradingScenario) => s.id)).toEqual([GRADING_SCENARIOS[0].id]);
    });

    it('refuses a catalogue of a version it does not know', () => {
        const root = tmpRoot();
        const file = cataloguePath(root);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ catalogueVersion: CATALOGUE_VERSION + 1, scenarios: [] }));
        expect(() => loadCatalogue(root)).toThrow(`catalogueVersion ${CATALOGUE_VERSION + 1}`);
    });
});
