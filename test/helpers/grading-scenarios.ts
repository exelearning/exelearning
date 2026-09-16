/**
 * The grading scenario catalogue — the ONE declaration every grading consumer reads.
 *
 * A scenario says three things: what the package contains (a `ProjectSpec` for
 * `buildGradingStructure()`), what the learner does to it (a target score per gradable
 * iDevice, page by page), and what the result must be (the hand-authored oracle). Until
 * this module existed the first two were written out by hand in three places — the
 * integration spec, the browser recorder and a `catalogue.json` the live-LMS lanes read
 * but nothing in the repository produced — and the third lived only in the recorder.
 *
 * Consumers:
 *
 *  - `test/integration/grading-fixtures.spec.ts` exports every distinct package
 *    (`gradingPackages()`) and checks the ids, weights and runtimes reached the export;
 *  - `test/e2e/playwright/specs/grading-matrix-recorder.spec.ts` drives the scenarios
 *    that name a `trace` (`recordedScenarios()`) under the mod_exelearning serving model
 *    and writes their traces (test/fixtures/grading/TRACE-CONTRACT.md);
 *  - `scripts/build-grading-catalogue.ts` exports every scenario with the production
 *    exporters and writes the `catalogue.json` + package manifests the live lanes under
 *    `test/e2e/playwright/specs-moodle/` consume (`loadCatalogue()`, `packageFileName()`).
 *
 * ## The oracle rule
 *
 * `expected` is hand-computed in the declaration — the per-item map, the weights and
 * the overall are literal numbers with the arithmetic spelled out in `note` — and is
 * never derived from the code under test. A scenario whose expectation is computed by
 * the implementation is worthless: one recorded case produced the arithmetically
 * correct overall while silently dropping an iDevice, because `(75+50+25)/3` happens to
 * equal `(75+50+25+50)/4`. Assert on the per-item map, not the total.
 *
 * `test/helpers/grading-scenarios.spec.ts` checks the literals against each other (the
 * overall is the weight-normalised mean of the per-item map, the weights are the ones
 * the package is built with, every answered iDevice scores what the script aims for)
 * so a typo cannot hide — but it does that with its own copy of the arithmetic, not
 * with the runtime's `getFinalScore`.
 *
 * ## Policy
 *
 * `weighted-mean-v1`: the overall is Σ(score·weight) / Σ(weight) over ALL gradable
 * iDevices, to two decimals. Every scenario here answers every iDevice, so the rule
 * for an UNANSWERED iDevice (counted as 0, or excluded as ungraded — audit B10, still a
 * product decision) is never exercised: `ungraded` is always empty. Add a scenario with
 * a `'skip'` action only together with that decision and a new `policyId`.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { GradableType, ProjectSpec } from './grading-fixtures';

/** What the learner does to one iDevice: aim for a 0..100 score, or leave it alone. */
export type ScenarioAction = number | 'skip';

/** The hand-authored oracle of one scenario, as written into its trace. */
export interface ScenarioOracle {
    /** Which rule `overall` follows; see the module docblock. */
    policyId: string;
    /** iDevice id -> the score 0..100 the LMS must hold for it. */
    perItem: Record<string, number>;
    /** iDevice id -> the weight the package declares for it. */
    weights: Record<string, number>;
    overall: number;
    /** iDevices deliberately left unanswered — none in this catalogue. */
    ungraded: string[];
    /** The arithmetic, by hand. */
    note: string;
}

/** One declared scenario. */
export interface GradingScenario {
    id: string;
    /** What the scenario is about; the package title is `spec.title`. */
    title: string;
    /** `single-page` | `multi-page` | `same-block` — coarse selection key for the lanes. */
    group: string;
    spec: ProjectSpec;
    /** iDevice id -> target score, or `'skip'`. */
    actions: Record<string, ScenarioAction>;
    /** Scores to re-enter on a later revisit of a page, keyed by page id then iDevice id. */
    revisit?: Record<string, Record<string, number>>;
    /** Page ids in visit order; a page may appear more than once. */
    navigation: string[];
    expected: ScenarioOracle;
    /**
     * The trace file name the core recorder writes this scenario under
     * (`<trace>.<engine>.trace.json`). Scenarios without one are not recorded.
     */
    trace?: string;
}

/** The oracle policy every scenario in this catalogue follows. */
export const ORACLE_POLICY_ID = 'weighted-mean-v1';

/**
 * Version of the `catalogue.json` the producer writes and the live lanes read. Bump it
 * when a field changes meaning; `loadCatalogue()` refuses a version it does not know.
 */
export const CATALOGUE_VERSION = 1;

// ---------------------------------------------------------------------------
// The packages
// ---------------------------------------------------------------------------

const M1_SPEC: ProjectSpec = {
    title: 'M1 two iDevices, separate blocks',
    odeId: 'GRADING-FIXTURE-M1',
    pages: [
        {
            id: 'page-1',
            title: 'M1 Page',
            idevices: [
                { id: 'm1-tof', type: 'trueorfalse', weighted: 25, questions: 4, blockTitle: 'M1 TrueOrFalse' },
                { id: 'm1-dnd', type: 'dragdrop', weighted: 75, questions: 4, blockTitle: 'M1 DragDrop' },
            ],
        },
    ],
};

const M2_SPEC: ProjectSpec = {
    title: 'M2 one of each type',
    odeId: 'GRADING-FIXTURE-M2',
    pages: [
        {
            id: 'page-1',
            title: 'M2 Page',
            idevices: [
                { id: 'm2-tof', type: 'trueorfalse', weighted: 10, questions: 4, blockTitle: 'M2 TrueOrFalse' },
                { id: 'm2-dnd', type: 'dragdrop', weighted: 20, questions: 4, blockTitle: 'M2 DragDrop' },
                { id: 'm2-sl', type: 'scrambled-list', weighted: 30, questions: 4, blockTitle: 'M2 ScrambledList' },
                { id: 'm2-frm', type: 'form', weighted: 40, questions: 4, blockTitle: 'M2 Form' },
            ],
        },
    ],
};

const M3_SPEC: ProjectSpec = {
    title: 'M3 two pages, two gradable each',
    odeId: 'GRADING-FIXTURE-M3',
    pages: [
        {
            id: 'page-1',
            title: 'M3 Page One',
            idevices: [
                { id: 'm3-p1-tof', type: 'trueorfalse', weighted: 100, questions: 4, blockTitle: 'M3 P1 A' },
                { id: 'm3-p1-sl', type: 'scrambled-list', weighted: 100, questions: 4, blockTitle: 'M3 P1 B' },
            ],
        },
        {
            id: 'page-2',
            title: 'M3 Page Two',
            idevices: [
                { id: 'm3-p2-dnd', type: 'dragdrop', weighted: 100, questions: 4, blockTitle: 'M3 P2 A' },
                { id: 'm3-p2-frm', type: 'form', weighted: 100, questions: 4, blockTitle: 'M3 P2 B' },
            ],
        },
    ],
};

const M4_SPEC: ProjectSpec = {
    title: 'M4 two pages, one gradable each',
    odeId: 'GRADING-FIXTURE-M4',
    pages: [
        {
            id: 'page-1',
            title: 'M4 Page One',
            blockTitle: 'M4 Activity A',
            idevices: [{ id: 'm4-p1', type: 'trueorfalse', weighted: 25, questions: 4 }],
        },
        {
            id: 'page-2',
            title: 'M4 Page Two',
            blockTitle: 'M4 Activity B',
            idevices: [{ id: 'm4-p2', type: 'form', weighted: 75, questions: 4 }],
        },
    ],
};

/**
 * The deliberate bug case: a `trueorfalse` followed by a `dragdrop` IN THE SAME BLOCK.
 * The stored `trueorfalse` `htmlView` leaves `.exe-trueorfalse-container` unclosed, so
 * the browser nests the following sibling inside it (PR #2307, unmerged).
 */
const M5_SPEC: ProjectSpec = {
    title: 'M5 same block (swallowing case)',
    odeId: 'GRADING-FIXTURE-M5',
    pages: [
        {
            id: 'page-1',
            title: 'M5 Page',
            blockTitle: 'M5 Shared Block',
            sameBlock: true,
            idevices: [
                { id: 'm5-tof', type: 'trueorfalse', weighted: 40, questions: 4 },
                { id: 'm5-dnd', type: 'dragdrop', weighted: 60, questions: 4 },
            ],
        },
    ],
};

// ---------------------------------------------------------------------------
// The scenarios
// ---------------------------------------------------------------------------

/**
 * Every declared scenario, in catalogue order.
 *
 * Scores are reached by answering, never by injecting values: `k` correct units out of
 * `n` gives `k·100/n` on every gradable type (see `gradingAnswerKey`), so a target of
 * 75 on four questions means three answered right and one wrong.
 */
export const GRADING_SCENARIOS: readonly GradingScenario[] = [
    {
        id: 'M1',
        title: 'single page, two types, weights 25/75',
        group: 'single-page',
        spec: M1_SPEC,
        actions: { 'm1-tof': 50, 'm1-dnd': 100 },
        navigation: ['page-1'],
        expected: {
            policyId: ORACLE_POLICY_ID,
            perItem: { 'm1-tof': 50, 'm1-dnd': 100 },
            weights: { 'm1-tof': 25, 'm1-dnd': 75 },
            overall: 87.5,
            ungraded: [],
            note:
                'By hand: tof 2/4 = 50, dnd 4/4 cards on their own target = 100. Weights sum to 100 ' +
                'already: (50*25 + 100*75)/100 = 12.5 + 75 = 87.5.',
        },
    },
    {
        id: 'M2',
        title: 'single page, four types, weights 10/20/30/40',
        group: 'single-page',
        spec: M2_SPEC,
        actions: { 'm2-tof': 100, 'm2-dnd': 100, 'm2-sl': 0, 'm2-frm': 0 },
        navigation: ['page-1'],
        expected: {
            policyId: ORACLE_POLICY_ID,
            perItem: { 'm2-tof': 100, 'm2-dnd': 100, 'm2-sl': 0, 'm2-frm': 0 },
            weights: { 'm2-tof': 10, 'm2-dnd': 20, 'm2-sl': 30, 'm2-frm': 40 },
            overall: 30,
            ungraded: [],
            note:
                'By hand: tof 4/4 = 100, dnd 4/4 cards on their own target = 100, sl a derangement ' +
                '(0 of 4 in position) = 0, form 4 wrong answers = 0. Weights sum to 100 already: ' +
                '(100*10 + 100*20 + 0*30 + 0*40)/100 = 30.',
        },
        trace: 'm2-four-types-single-page',
    },
    {
        id: 'M3',
        title: 'two pages, two gradable each, mixed scores',
        group: 'multi-page',
        spec: M3_SPEC,
        actions: { 'm3-p1-tof': 75, 'm3-p1-sl': 50, 'm3-p2-dnd': 25, 'm3-p2-frm': 50 },
        navigation: ['page-1', 'page-2'],
        expected: {
            policyId: ORACLE_POLICY_ID,
            perItem: { 'm3-p1-tof': 75, 'm3-p1-sl': 50, 'm3-p2-dnd': 25, 'm3-p2-frm': 50 },
            weights: { 'm3-p1-tof': 100, 'm3-p1-sl': 100, 'm3-p2-dnd': 100, 'm3-p2-frm': 100 },
            overall: 50,
            ungraded: [],
            note:
                'By hand: tof 3/4 = 75, scrambled-list [0,1,3,2] keeps 2 of 4 in position = 50, ' +
                'dragdrop 1 of 4 cards on its own target = 25, form 2/4 = 50. All weights 100, so ' +
                'the overall is the plain mean: (75 + 50 + 25 + 50)/4 = 50.',
        },
        trace: 'm3-two-pages-two-gradable',
    },
    {
        /**
         * The SAME package as M3 and the same first three answers, with only the
         * page-2 form moved from 2/4 (50) to 3/4 (75).
         *
         * In M3 the page-2 form lands on slot 2, whose stale page-1 entry already reads
         * "50%, weight 100" — numerically identical, so the plugin tracker's
         * changed-entries heuristic sees no change and never stamps the form. Scoring 75
         * instead makes the very same write visible. Recorded to prove the mechanism
         * rather than assert it.
         */
        id: 'M3C',
        title: 'same package as M3, page-2 form scores 75 instead of 50',
        group: 'multi-page',
        spec: M3_SPEC,
        actions: { 'm3-p1-tof': 75, 'm3-p1-sl': 50, 'm3-p2-dnd': 25, 'm3-p2-frm': 75 },
        navigation: ['page-1', 'page-2'],
        expected: {
            policyId: ORACLE_POLICY_ID,
            perItem: { 'm3-p1-tof': 75, 'm3-p1-sl': 50, 'm3-p2-dnd': 25, 'm3-p2-frm': 75 },
            weights: { 'm3-p1-tof': 100, 'm3-p1-sl': 100, 'm3-p2-dnd': 100, 'm3-p2-frm': 100 },
            overall: 56.25,
            ungraded: [],
            note:
                'By hand: tof 3/4 = 75, scrambled-list 2 of 4 in position = 50, dragdrop 1 of 4 = 25, ' +
                'form 3/4 = 75. All weights 100: (75 + 50 + 25 + 75)/4 = 56.25.',
        },
        trace: 'm3-control-form-75',
    },
    {
        id: 'M4',
        title: 'two pages, one gradable each, weights 25/75',
        group: 'multi-page',
        spec: M4_SPEC,
        actions: { 'm4-p1': 100, 'm4-p2': 0 },
        navigation: ['page-1', 'page-2'],
        expected: {
            policyId: ORACLE_POLICY_ID,
            perItem: { 'm4-p1': 100, 'm4-p2': 0 },
            weights: { 'm4-p1': 25, 'm4-p2': 75 },
            overall: 25,
            ungraded: [],
            note: 'By hand: page 1 tof 4/4 = 100, page 2 form 0/4 = 0. (100*25 + 0*75)/100 = 25.',
        },
        trace: 'm4-multipage-weighted-25-75',
    },
    {
        id: 'M5',
        title: 'same block, trueorfalse swallows the dragdrop that follows it (#2307)',
        group: 'same-block',
        spec: M5_SPEC,
        actions: { 'm5-tof': 100, 'm5-dnd': 50 },
        navigation: ['page-1'],
        expected: {
            policyId: ORACLE_POLICY_ID,
            perItem: { 'm5-tof': 100, 'm5-dnd': 50 },
            weights: { 'm5-tof': 40, 'm5-dnd': 60 },
            overall: 70,
            ungraded: [],
            note:
                'By hand: tof 4/4 = 100, dnd 2 of 4 cards on their own target = 50. Weights sum to ' +
                '100 already: (100*40 + 50*60)/100 = 40 + 30 = 70. What a teacher expects of the ' +
                'package — whether the swallowed dragdrop still scores is what the lanes measure.',
        },
    },
];

/**
 * One scenario by id.
 *
 * @throws when no scenario has that id
 */
export function gradingScenario(id: string): GradingScenario {
    const scenario = GRADING_SCENARIOS.find(s => s.id === id);
    if (!scenario) throw new Error(`unknown grading scenario '${id}'`);
    return scenario;
}

/** The scenarios the core recorder records: those that name a trace file. */
export function recordedScenarios(): (GradingScenario & { trace: string })[] {
    return GRADING_SCENARIOS.filter((s): s is GradingScenario & { trace: string } => s.trace !== undefined);
}

/**
 * The distinct packages of the catalogue, each under the id of the first scenario that
 * uses it. Two scenarios that answer the same package differently (M3 / M3C) share one
 * `ProjectSpec` object, and that identity is what "the same package" means here.
 */
export function gradingPackages(): { id: string; spec: ProjectSpec }[] {
    const seen = new Set<ProjectSpec>();
    const packages: { id: string; spec: ProjectSpec }[] = [];
    for (const scenario of GRADING_SCENARIOS) {
        if (seen.has(scenario.spec)) continue;
        seen.add(scenario.spec);
        packages.push({ id: scenario.id, spec: scenario.spec });
    }
    return packages;
}

/** One gradable iDevice of a package, with the generator's defaults filled in. */
export interface ScenarioIdevice {
    page: string;
    id: string;
    type: GradableType;
    weighted: number;
    /** Scorable units — what a target score is reached out of. */
    questions: number;
}

/** Every gradable iDevice of a package, in page and DOM order, defaults resolved. */
export function scenarioIdevices(spec: ProjectSpec): ScenarioIdevice[] {
    return spec.pages.flatMap(page =>
        page.idevices.map(idevice => ({
            page: page.id,
            id: idevice.id,
            type: idevice.type ?? 'trueorfalse',
            weighted: idevice.weighted,
            questions: idevice.questions ?? 4,
        })),
    );
}

// ---------------------------------------------------------------------------
// Where the live lanes find the catalogue and the packages
// ---------------------------------------------------------------------------

/** The shape of `scenarios/catalogue.json` under the audit root. */
export interface GradingCatalogue {
    catalogueVersion: number;
    /** The checkout that wrote it, for the evidence record. */
    generatedFrom?: { head: string; worktreeDirty: boolean; generatedAt: string };
    scenarios: GradingScenario[];
}

/** `<root>/scenarios/catalogue.json`. */
export function cataloguePath(root: string): string {
    return path.join(root, 'scenarios', 'catalogue.json');
}

/** `<root>/packages/<producer>/manifest-<producer>.json`. */
export function manifestPath(root: string, producer: string): string {
    return path.join(root, 'packages', producer, `manifest-${producer}.json`);
}

/** `<id>-<producer>-<format>.zip` — the file name every lane addresses a package by. */
export function packageFileName(scenarioId: string, producer: string, format: string): string {
    return `${scenarioId}-${producer}-${format}.zip`;
}

/**
 * Read the staged catalogue, or null when none was staged.
 *
 * @throws when the file is of a version this code does not know
 */
export function loadCatalogue(root: string): GradingCatalogue | null {
    const file = cataloguePath(root);
    if (!fs.existsSync(file)) return null;
    const catalogue = JSON.parse(fs.readFileSync(file, 'utf8')) as GradingCatalogue;
    if (catalogue.catalogueVersion !== CATALOGUE_VERSION) {
        throw new Error(
            `${file}: catalogueVersion ${catalogue.catalogueVersion} is not the ${CATALOGUE_VERSION} this ` +
                'checkout reads — regenerate it with scripts/build-grading-catalogue.ts',
        );
    }
    return catalogue;
}
