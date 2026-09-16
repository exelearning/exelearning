/**
 * mod_exelearning, driven by the declared scenarios, in a live Moodle.
 *
 * `exelearning-live.spec.ts` proves the essential path works. It does not answer the
 * questions a grade actually turns on: several pages, an activity answered with a real
 * zero next to one never touched, weights that are not all equal, the slot collisions the
 * legacy `cmi.suspend_data` format makes possible, and both grade models over all of it.
 *
 * This lane runs the SAME scenarios the SCORM matrix runs — same catalogue, same runner,
 * same answer key — against the plugin, and asserts on what the plugin itself recorded:
 * its attempt rows and Moodle's gradebook, read back through the CLI helpers.
 *
 * The expectation comes from the scenario declaration, not from the code under test: an
 * iDevice the scenario answered must be graded with what it scored, and one the scenario
 * skipped must not be graded at all.
 */
import * as fs from 'fs-extra';
import * as path from 'path';

import { expect, test } from '@playwright/test';

import { gradingAnswerKey } from '../../../helpers/grading-fixtures';
import { addExeActivity, createExeLearningHost, readExeState, type ExeActivity } from '../helpers/exelearning-host';
import { runScenario, type Scenario } from '../helpers/scenario-runner';

const AUDIT_ROOT = process.env.AUDIT_ROOT ?? path.resolve(__dirname, '../../../../test-results/moodle-harness');
const CONTAINER_PACKAGES = process.env.EXE_PACKAGE_DIR ?? '/var/www/moodledata/audit/packages';
const PRODUCERS = (process.env.AUDIT_PRODUCERS ?? '2209final').split(',').filter(Boolean);
const ONLY = (process.env.AUDIT_EXE_SCENARIOS ?? 'S01,S02,S07,M01,M05,P01,P05').split(',').filter(Boolean);

const GRADEMODEL_OVERALL = 0;
const GRADEMODEL_PERITEM = 1;
const MODELS: Record<string, number> = { peritem: GRADEMODEL_PERITEM, overall: GRADEMODEL_OVERALL };

const CATALOGUE_PATH = path.join(AUDIT_ROOT, 'scenarios', 'catalogue.json');
const catalogue: { scenarios: Scenario[] } | null = fs.existsSync(CATALOGUE_PATH)
    ? (fs.readJsonSync(CATALOGUE_PATH) as { scenarios: Scenario[] })
    : null;
const SCENARIOS = (catalogue?.scenarios ?? []).filter(entry => ONLY.includes(entry.id));

/** Learners, one per worker slot, so a cell never reads another cell's attempt. */
const LEARNERS = ['exelearner1', 'exelearner2', 'exelearner3', 'exelearner4'];
let learnerIndex = 0;

/**
 * The pages of a scenario's ELPX, in the order the exporter wrote them.
 *
 * @param producer Producer label.
 * @param scenario Scenario id.
 * @returns Page file names, index.html first.
 */
function elpxPages(producer: string, scenario: string): string[] {
    const manifest = fs.readJsonSync(path.join(AUDIT_ROOT, 'packages', producer, `manifest-${producer}.json`)) as {
        scenarios: { id: string; packages: Record<string, { pages?: { file: string }[] }> }[];
    };
    const pages = manifest.scenarios.find(entry => entry.id === scenario)?.packages?.elpx?.pages;
    if (!pages?.length) throw new Error(`${scenario}: manifest-${producer}.json declares no .elpx pages`);
    return pages.map(page => page.file);
}

/** What the scenario says each iDevice should end up scoring, or null when it was skipped. */
function expectedPerIdevice(scenario: Scenario): Record<string, number | null> {
    const expected: Record<string, number | null> = {};
    for (const page of scenario.spec.pages) {
        for (const idevice of page.idevices) {
            const action = scenario.actions[idevice.id];
            expected[idevice.id] = action === 'skip' || action === undefined ? null : Number(action);
        }
    }
    return expected;
}

test.describe('mod_exelearning over the declared scenarios', () => {
    test.describe.configure({ mode: 'default' });

    if (catalogue === null) {
        test('the scenario catalogue this lane replays', () => {
            test.skip(true, `no catalogue at ${CATALOGUE_PATH} — see test/e2e/moodle/README.md`);
        });
    }

    for (const scenario of SCENARIOS) {
        for (const producer of PRODUCERS) {
            for (const [modelName, grademodel] of Object.entries(MODELS)) {
                test(`${scenario.id}-${producer}-${modelName}`, async ({ page }) => {
                    test.setTimeout(240000);
                    const learner = LEARNERS[learnerIndex++ % LEARNERS.length];

                    const activity: ExeActivity = addExeActivity({
                        packagePath: `${CONTAINER_PACKAGES}/${scenario.id}-${producer}-elpx.zip`,
                        name: `${scenario.id}-${producer}-${modelName}-${Date.now()}`,
                        grademodel,
                    });

                    const host = createExeLearningHost(page, activity.cmid);
                    await host.login(learner, '');

                    const pages = elpxPages(producer, scenario.id);
                    const runnerActivity = {
                        ...activity,
                        module: 'scorm' as const,
                        instanceid: activity.instanceid,
                        grademethod: 1,
                        maxgrade: activity.grademax,
                        version: 'ELPX',
                        launchurl: activity.url,
                        playerurl: activity.url,
                        scoes: pages.map((file, index) => ({
                            id: index + 1,
                            identifier: `EXE-${index + 1}`,
                            title: file,
                            launch: file,
                            scormtype: 'sco',
                        })),
                    };

                    const session = await runScenario(
                        page,
                        host,
                        runnerActivity,
                        scenario,
                        gradingAnswerKey(scenario.spec),
                    );

                    // The plugin writes after it answers, so poll its own tables rather
                    // than reading once and hoping.
                    // Poll until EVERY answered iDevice has landed, not until the first one
                    // does. The tracker debounces and posts more than once, so reading after
                    // the first row appears catches a half-written state and reads as a lost
                    // score — which it is not.
                    const expected = expectedPerIdevice(scenario);
                    const answered = Object.entries(expected).filter(([, value]) => value !== null);
                    const deadline = Date.now() + 25000;
                    let state = readExeState(activity.cmid, learner);
                    const complete = (candidate: typeof state): boolean => {
                        const items = new Map(candidate.gradeitems.map(item => [item.objectid, item.itemnumber]));
                        return answered.every(([idevice]) => {
                            const itemnumber = items.get(idevice);
                            // An iDevice the package never registered cannot be waited for.
                            if (itemnumber === undefined) return true;
                            return candidate.attempts.some(attempt => attempt.itemnumber === itemnumber);
                        });
                    };
                    while (answered.length > 0 && !complete(state) && Date.now() < deadline) {
                        await page.waitForTimeout(250);
                        state = readExeState(activity.cmid, learner);
                    }

                    const out = path.join(AUDIT_ROOT, 'evidence', 'exelearning-matrix', test.info().project.name);
                    await fs.ensureDir(out);
                    await fs.writeJson(
                        path.join(out, `${scenario.id}-${producer}-${modelName}.json`),
                        {
                            scenario: scenario.id,
                            producer,
                            grademodel: modelName,
                            browser: test.info().project.name,
                            learner,
                            expected,
                            activity,
                            performed: session.performed,
                            state,
                        },
                        { spaces: 2 },
                    );

                    // What the scenario answered must be graded, and what it skipped must
                    // not be. Both directions matter: the legacy payload seeds unanswered
                    // activities at zero, which is how a learner ends up graded for work
                    // they never did.
                    // Restored deliberately, and kept: without it a cell where the plugin
                    // recorded NOTHING passed every per-item check by vacuous truth, which
                    // is how a total publication failure sat green for a whole round.
                    if (answered.length > 0) {
                        expect(
                            state.attempts.length,
                            `the scenario answered ${answered.length} iDevice(s) and the plugin recorded nothing`,
                        ).toBeGreaterThan(0);
                    }

                    const byObjectId = new Map(state.gradeitems.map(item => [item.objectid, item.itemnumber]));
                    for (const [idevice, target] of Object.entries(expected)) {
                        const itemnumber = byObjectId.get(idevice);
                        if (itemnumber === undefined) continue;
                        const row = state.attempts.find(attempt => attempt.itemnumber === itemnumber);
                        if (target === null) {
                            expect(
                                row?.rawscore ?? null,
                                `${idevice} was never answered and must not be graded`,
                            ).toBeNull();
                        } else {
                            expect(row, `${idevice} was answered and must have an attempt row`).toBeDefined();
                            expect(row?.rawscore, `${idevice} scored ${target} in the scenario`).toBeCloseTo(target, 1);
                            expect(row?.gradable, `${idevice}'s row must count towards the grade`).toBe(1);
                        }
                    }

                    // Each grade model publishes its own column. Asserting only on attempt
                    // rows would miss a module that records correctly and then puts the
                    // value where nobody reads it.
                    const overallColumn = state.gradebook.find(row => row.itemnumber === 0);
                    const itemColumns = state.gradebook.filter(row => row.itemnumber > 0);
                    if (answered.length > 0) {
                        if (grademodel === GRADEMODEL_OVERALL) {
                            expect(
                                overallColumn?.grade ?? null,
                                'OVERALL publishes one aggregated column',
                            ).not.toBeNull();
                            expect(itemColumns, 'OVERALL publishes no per-iDevice columns').toHaveLength(0);
                        } else {
                            expect(
                                itemColumns.some(column => column.grade !== null),
                                'PERITEM publishes the answered iDevices in their own columns',
                            ).toBe(true);
                            expect(
                                overallColumn?.grade ?? null,
                                'PERITEM leaves the overall column to the gradebook category',
                            ).toBeNull();
                        }
                    }

                    // A page with unanswered required activities must not be left terminal
                    // by an earlier page's verdict: these pages share one session and one
                    // lesson_status, which is the condition under which a status leaks
                    // forward.
                    const overallRow = state.attempts.find(attempt => attempt.itemnumber === 0);
                    const pending = Object.values(expected).some(value => value === null);
                    if (pending && overallRow) {
                        expect(
                            overallRow.status,
                            'a scenario with an unanswered required activity must not report a terminal status',
                        ).toBe('incomplete');
                    }
                });
            }
        }
    }
});
