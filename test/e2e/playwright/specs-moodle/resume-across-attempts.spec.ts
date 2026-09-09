/**
 * Leaving and coming back: what the LMS gives the package on re-entry, and what the
 * package does with it.
 *
 * Everything else in this harness measures one sitting. Resume is where a grading runtime
 * can lose a mark that was already earned: on re-entry the LMS replays `cmi.core.entry`,
 * `cmi.core.score.raw` and `cmi.suspend_data`, and a runtime that seeds an unanswered
 * activity before reading them overwrites a real score with a zero. That is not a
 * hypothetical — it is the failure the entry policy exists to prevent, and until now it
 * was only ever asserted against a fake LMS.
 *
 * One scenario, two hosts, two runtimes, three visits: play, leave, come back.
 */
import { expect, test } from '@playwright/test';
import * as fs from 'fs-extra';
import * as path from 'path';

import {
    createMoodleHost,
    instrumentScormApi,
    readScormCalls,
    type HostActivity,
    type ScormModule,
} from '../helpers/lms-host';
import { addActivity, readState } from '../helpers/moodle-cli';

const AUDIT_ROOT = process.env.AUDIT_ROOT ?? path.resolve(__dirname, '../../../../test-results/moodle-harness');
const BASE_URL = process.env.MOODLE_BASE_URL ?? 'http://localhost:8097';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Audit#1234';
/**
 * One directory per engine, for the same reason the matrix has one: the cell name says
 * scenario, producer and host, so a second engine writing beside the first overwrites it
 * and the surviving files cannot say which engine produced them.
 */
function outDir(): string {
    return path.join(AUDIT_ROOT, 'evidence', 'resume', test.info().project.name);
}

/** Producers to compare, and the learner each one uses. */
const PRODUCERS: Record<string, { learner: string }> = {
    main: { learner: 'learner1' },
    '2209final': { learner: 'learner2' },
};
const ONLY = process.env.AUDIT_PRODUCERS?.split(',').filter(Boolean) ?? Object.keys(PRODUCERS);
const HOSTS = (process.env.AUDIT_HOSTS ?? 'scorm,exescorm').split(',').filter(Boolean) as ScormModule[];

/** S01 is a single page with one True/False iDevice: the smallest thing that can hold a score. */
const SCENARIO = process.env.AUDIT_RESUME_SCENARIO ?? 'S01';

test.describe('resume across visits', () => {
    test.describe.configure({ mode: 'default' });

    for (const producer of ONLY) {
        for (const host of HOSTS) {
            test(`${SCENARIO}-${producer}-${host}`, async ({ page }) => {
                test.setTimeout(180000);
                const { learner } = PRODUCERS[producer];

                const activity: HostActivity = addActivity({
                    module: host,
                    packageFile: `${SCENARIO}-${producer}-scorm12.zip`,
                    name: `resume-${SCENARIO}-${producer}-${host}`,
                    grademethod: 1,
                });

                await instrumentScormApi(page);
                const lms = createMoodleHost(page, host, BASE_URL);
                await lms.login(learner, PASSWORD);

                // Moodle's player needs to be told which SCO to launch: with none it
                // answers "A required parameter (scoid) was missing" rather than picking
                // the only launchable one.
                const sco = activity.scoes.find(candidate => candidate.launch !== '');
                if (!sco) throw new Error(`${SCENARIO}-${producer} has no launchable SCO`);

                // Visit one: answer the activity, then leave the way the exit control does.
                await lms.openSco(activity, sco);
                await lms.waitReady();
                const idevice = 'ide-a';
                // waitReady() waits for the SCORM connection, which comes up before the
                // iDevice has rendered. Answering needs the question, so wait for that too.
                await lms.idevices.waitForInFrame(`#tofPGameContainer-${idevice} .TOFP-QuestionDiv`);
                await lms.idevices.answerTrueOrFalse(idevice, 0, 1);
                await lms.idevices.checkTrueOrFalse(idevice);
                const firstVisit = await readScormCalls(page);
                await lms.exitPlayer(activity);
                const afterFirst = readState(activity.cmid, learner);

                // Visit two: come back. Nothing is answered this time — the question is
                // purely what the runtime does with what the LMS replays at it.
                await instrumentScormApi(page);
                await lms.openSco(activity, sco);
                await lms.waitReady();
                // Entry replay is what this visit is about, and it happens as the package
                // boots: wait for the traffic to settle rather than for a fixed pause.
                await page.waitForLoadState('networkidle');
                const secondVisit = await readScormCalls(page);
                await lms.exitPlayer(activity);
                const afterSecond = readState(activity.cmid, learner);

                const out = outDir();
                await fs.ensureDir(out);
                await fs.writeJson(
                    path.join(out, `${SCENARIO}-${producer}-${host}.json`),
                    {
                        scenario: SCENARIO,
                        producer,
                        host,
                        browser: test.info().project.name,
                        moodle: afterFirst.moodleRelease,
                        firstVisit,
                        afterFirst,
                        secondVisit,
                        afterSecond,
                    },
                    { spaces: 2 },
                );

                // The mark earned in visit one must still be there after visit two. This is
                // the assertion the whole lane exists for, and it is deliberately about the
                // LMS's stored state, not about what the package said.
                const storedScore = (state: typeof afterFirst): string | null => {
                    for (const attempt of Object.values(state.tracks)) {
                        for (const sco of Object.values(attempt)) {
                            if (sco['cmi.core.score.raw'] !== undefined) return sco['cmi.core.score.raw'];
                        }
                    }
                    return null;
                };
                expect(storedScore(afterSecond)).toBe(storedScore(afterFirst));
                expect(afterSecond.gradebook).toBe(afterFirst.gradebook);

                // And re-entry must not be reported as a fresh, unattempted visit.
                const wroteNotAttempted = secondVisit.some(
                    call =>
                        call.method === 'LMSSetValue' &&
                        call.args?.[0] === 'cmi.core.lesson_status' &&
                        call.args?.[1] === 'not attempted',
                );
                expect(wroteNotAttempted).toBe(false);
            });
        }
    }
});
