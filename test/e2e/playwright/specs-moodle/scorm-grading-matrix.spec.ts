/**
 * The live-LMS grading matrix: one declared scenario, four cells.
 *
 * Every scenario in the shared catalogue is exported by BOTH core revisions under test
 * and then played, as a real learner, against BOTH Moodle SCORM hosts:
 *
 *     producer x host  =  {core main, core #2209} x {mod_scorm, mod_exescorm}
 *
 * Each cell records what the package sent (the ordered SCORM API journal captured on the
 * player window), what Moodle persisted (every cmi element, per SCO, straight from the
 * database), and what reached the gradebook. Judging happens afterwards, against the
 * hand-declared oracle — this spec measures, it does not decide.
 *
 * Requires a provisioned Moodle. See AUDIT/moodle/README for the stack.
 */
import { test } from '@playwright/test';
import * as fs from 'fs-extra';
import * as path from 'path';

import { gradingAnswerKey } from '../../../helpers/grading-fixtures';
import { createMoodleHost, instrumentScormApi, type ScormModule } from '../helpers/lms-host';
import { addActivity, readState } from '../helpers/moodle-cli';
import { runScenario, type Scenario } from '../helpers/scenario-runner';

const AUDIT_ROOT = process.env.AUDIT_ROOT ?? path.resolve(__dirname, '../../../../test-results/moodle-harness');
const BASE_URL = process.env.MOODLE_BASE_URL ?? 'http://localhost:8097';
const LEARNER = process.env.AUDIT_LEARNER ?? 'learner1';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Audit#1234';
/**
 * One directory per browser engine.
 *
 * The cell name identifies a scenario, a producer, a host and a grading method — but not
 * the engine, and two engines running the same matrix into one directory means the second
 * silently overwrites the first. There is then no way to compare them, and no way to tell
 * which engine any surviving file came from.
 */
function evidenceDir(): string {
    return path.join(AUDIT_ROOT, 'evidence', 'moodle', test.info().project.name);
}

/** Which producers to run; override to bisect a single revision. */
const PRODUCERS = (process.env.AUDIT_PRODUCERS ?? 'main,2209').split(',').filter(Boolean);
/** Which hosts to run. */
const HOSTS = (process.env.AUDIT_HOSTS ?? 'scorm,exescorm').split(',').filter(Boolean) as ScormModule[];
/** Restrict to a subset of scenario ids while iterating. */
const ONLY = process.env.AUDIT_ONLY?.split(',').filter(Boolean);
/**
 * Grade methods to create the activity with.
 *
 * Moodle recomputes the gradebook from the same stored tracks for every method, so one
 * pass per method over the same learner session would be wasteful; instead each method
 * gets its own activity and its own session. GRADEHIGHEST (1) is the default; the full
 * set is only worth running on the multi-SCO scenarios, where the methods differ.
 */
const GRADE_METHODS = (process.env.AUDIT_GRADEMETHODS ?? '1').split(',').map(Number);

interface Catalogue {
    catalogueVersion: number;
    scenarios: Scenario[];
}

/**
 * The declared scenarios this lane replays.
 *
 * They are an input, not a fixture of this repository: each entry names a package that
 * has to be generated and staged first (see test/e2e/moodle/README.md). Without the
 * catalogue there is nothing to run, so the lane skips itself with a message instead of
 * failing at import time and taking the rest of the harness down with it.
 */
const CATALOGUE_PATH = path.join(AUDIT_ROOT, 'scenarios', 'catalogue.json');
const catalogue: Catalogue | null = fs.existsSync(CATALOGUE_PATH)
    ? (fs.readJsonSync(CATALOGUE_PATH) as Catalogue)
    : null;
const scenarios = (catalogue?.scenarios ?? []).filter(s => !ONLY || ONLY.includes(s.id));

interface PackageManifest {
    head: string;
    worktreeDirty?: boolean;
    scenarios: {
        id: string;
        packages: Record<string, { file: string; sha256?: string; runtimeSha256?: Record<string, string> }>;
    }[];
}

/**
 * Everything needed to say which bytes produced a cell.
 *
 * The producing revision is not enough on its own: packages are regenerated, and a file
 * name is reused. A digest is what ties a recorded result to the artefact it came from
 * once the worktree that built it is gone.
 *
 * @param producer Producer label, i.e. which revision built the packages.
 * @param scenarioId Scenario whose package this cell used.
 * @returns Head, dirty flag and the digests of the zip and of its runtime files.
 */
function packageProvenance(
    producer: string,
    scenarioId: string,
): {
    producerHead: string;
    producerDirty: boolean;
    packageFile: string | null;
    packageSha256: string | null;
    runtimeSha256: Record<string, string> | null;
} {
    const manifestPath = path.join(AUDIT_ROOT, 'packages', producer, `manifest-${producer}.json`);
    const manifest = fs.readJsonSync(manifestPath) as PackageManifest;
    const entry = manifest.scenarios.find(item => item.id === scenarioId);
    const pkg = entry?.packages?.scorm12;
    return {
        producerHead: manifest.head,
        producerDirty: manifest.worktreeDirty === true,
        packageFile: pkg?.file ?? null,
        packageSha256: pkg?.sha256 ?? null,
        runtimeSha256: pkg?.runtimeSha256 ?? null,
    };
}

test.describe('SCORM grading matrix against a live Moodle', () => {
    // Not `serial`: with 400 cells, one cell failing must not skip the other 399.
    // The config already pins workers to 1, so cells still run one at a time against
    // the single Moodle; what changes is that a failure is reported and the run
    // continues, which is the only way a matrix is a matrix.
    test.describe.configure({ mode: 'default' });

    // With no catalogue the loops below produce no tests at all, and a lane that
    // silently contributes nothing is indistinguishable from one that passed. Say so.
    if (catalogue === null) {
        test('the scenario catalogue this lane replays', () => {
            test.skip(
                true,
                `no catalogue at ${CATALOGUE_PATH} — generate and stage the packages first, see test/e2e/moodle/README.md`,
            );
        });
    }

    for (const producer of PRODUCERS) {
        for (const host of HOSTS) {
            for (const grademethod of GRADE_METHODS) {
                for (const scenario of scenarios) {
                    const cell = `${scenario.id}-${producer}-${host}-gm${grademethod}`;

                    test(cell, async ({ page }) => {
                        const activity = addActivity({
                            module: host,
                            packageFile: `${scenario.id}-${producer}-scorm12.zip`,
                            name: cell,
                            grademethod,
                        });

                        await instrumentScormApi(page);
                        await createMoodleHost(page, host, BASE_URL).login(LEARNER, PASSWORD);

                        const bound = createMoodleHost(page, host, BASE_URL);
                        const session = await runScenario(
                            page,
                            bound,
                            activity,
                            scenario,
                            gradingAnswerKey(scenario.spec),
                        );

                        const persisted = readState(activity.cmid, LEARNER);

                        const out = evidenceDir();
                        await fs.ensureDir(out);
                        await fs.writeJson(
                            path.join(out, `${cell}.json`),
                            {
                                cell,
                                scenario: scenario.id,
                                title: scenario.title,
                                producer,
                                ...packageProvenance(producer, scenario.id),
                                browser: test.info().project.name,
                                moodle: persisted.moodleRelease ?? null,
                                host,
                                grademethod,
                                learner: LEARNER,
                                activity,
                                performed: session.performed,
                                calls: session.calls,
                                persisted,
                            },
                            { spaces: 2 },
                        );

                        // The measurement is the deliverable; the only thing that can fail
                        // here is the measurement itself. A session that never reached the
                        // LMS would silently produce an empty, meaningless record.
                        if (session.calls.length === 0) {
                            throw new Error(`${cell}: the package made no SCORM API calls at all`);
                        }
                    });
                }
            }
        }
    }
});
