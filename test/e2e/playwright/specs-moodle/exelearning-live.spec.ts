/**
 * mod_exelearning, in a real Moodle, end to end.
 *
 * Every other lane in this harness measures a package inside an LMS's SCORM player. This
 * one measures the eXeLearning plugin itself, which is a different question: the plugin
 * serves a web export, injects its own copy of the SCORM 1.2 runtime, and bridges the
 * scores that runtime produces to its own endpoint. Nothing about that path is exercised
 * by the SCORM lanes, and until now it was only ever replayed offline against
 * `js/scorm_tracker.js` — which cannot show what Moodle stores.
 *
 * So this lane plays the activity as a learner and then reads the plugin's own tables and
 * Moodle's gradebook, for both grade models and for the ungraded case.
 */
import { execFileSync } from 'child_process';

import { expect, test } from '@playwright/test';

import { createIdeviceDriver } from '../helpers/idevice-drivers';
import {
    EXE_FRAME_ID,
    addExeActivity,
    apiCallCount,
    countApiCalls,
    dispatchPageHide,
    openExeActivity,
    readExeState,
    readRuntimeAuthority,
    type ExeActivity,
} from '../helpers/exelearning-host';

/** ELPX fixtures, as mounted inside the Moodle container. */
const FIXTURES = process.env.EXE_FIXTURE_DIR ?? '/var/www/html/mod/exelearning/research/fixtures/elpx';
const SINGLE_PAGE = `${FIXTURES}/actividad-evaluable.elpx`;

const GRADEMODEL_OVERALL = 0;
const GRADEMODEL_PERITEM = 1;

/**
 * Answer the fixture's True/False iDevice correctly and submit it.
 *
 * The fixture's first gradable iDevice is a two-question trueorfalse whose answers are
 * both true; the driver clicks the runtime's own radio inputs and its own check button,
 * so the score is produced by the content exactly as a learner would produce it.
 *
 * @param page The page holding the plugin's content frame.
 * @param ideviceId DOM id of the trueorfalse node.
 */
async function answerTrueOrFalseFully(page: import('@playwright/test').Page, ideviceId: string): Promise<void> {
    const driver = createIdeviceDriver(page, EXE_FRAME_ID);
    const questions = page
        .frameLocator(`#${EXE_FRAME_ID}`)
        .locator(`#tofPGameContainer-${ideviceId} .TOFP-QuestionDiv`);
    await questions.first().waitFor({ timeout: 15000 });
    const count = await questions.count();
    if (count === 0) throw new Error(`no True/False questions rendered in ${ideviceId}`);
    for (let index = 0; index < count; index++) {
        await driver.answerTrueOrFalse(ideviceId, index, 1);
    }
    await driver.checkTrueOrFalse(ideviceId);
}

/** One acknowledged tracking POST, as the plugin answered it. */
interface TrackAck {
    ok?: boolean;
    noop?: boolean;
    rawscore?: number;
}

/**
 * Run an action and collect every tracking POST the plugin answers.
 *
 * Two things make this deterministic rather than timed. The waiter is armed BEFORE the
 * action, so a response that arrives quickly cannot be missed — the earlier version armed
 * it afterwards and raced. And what it waits for is the plugin's own acknowledgement,
 * parsed, rather than a fixed pause chosen to be longer than the tracker's 500 ms debounce.
 *
 * @param page The page to watch.
 * @param action What to do while watching.
 * @returns Every acknowledgement body, in order.
 */
async function withTrackPost(page: import('@playwright/test').Page, action: () => Promise<void>): Promise<TrackAck[]> {
    const acks: TrackAck[] = [];
    const isTrack = (response: import('@playwright/test').Response) =>
        response.url().includes('/mod/exelearning/track.php') && response.request().method() === 'POST';

    const collect = async (response: import('@playwright/test').Response) => {
        if (!isTrack(response)) return;
        try {
            acks.push((await response.json()) as TrackAck);
        } catch {
            acks.push({});
        }
    };
    page.on('response', collect);
    // Armed first, awaited last: the response may land before `action` returns.
    const firstAck = page.waitForResponse(isTrack, { timeout: 20000 });
    try {
        await action();
        await firstAck;
        // The tracker debounces by 500 ms, so a trailing commit can still be in flight.
        // Wait for the traffic to go quiet instead of guessing how long that takes.
        await page.waitForLoadState('networkidle');
    } finally {
        page.off('response', collect);
    }
    return acks;
}

/**
 * Poll the plugin's own tables until they say what the test is waiting for.
 *
 * The database is written by the server after it answers, so even an acknowledged POST is
 * not a guarantee that the row is visible yet. Polling a condition beats sleeping: it is
 * as fast as the system allows and it fails with what it actually saw.
 *
 * @param cmid Activity to read.
 * @param username Learner to read.
 * @param predicate What the state has to satisfy.
 * @param what Description used in the failure message.
 * @returns The state that satisfied the predicate.
 */
async function waitForState(
    cmid: number,
    username: string,
    predicate: (state: ReturnType<typeof readExeState>) => boolean,
    what: string,
): Promise<ReturnType<typeof readExeState>> {
    const deadline = Date.now() + 20000;
    let last = readExeState(cmid, username);
    while (!predicate(last)) {
        if (Date.now() > deadline) {
            throw new Error(`timed out waiting for ${what}; last state: ${JSON.stringify(last.attempts)}`);
        }
        await new Promise(resolve => setTimeout(resolve, 250));
        last = readExeState(cmid, username);
    }
    return last;
}

test.describe('mod_exelearning in a live Moodle', () => {
    test.describe.configure({ mode: 'default' });

    test("the plugin serves exactly one runtime, and it is the plugin's own", async ({ page }) => {
        const activity: ExeActivity = addExeActivity({
            packagePath: SINGLE_PAGE,
            name: `EXE-RUNTIME-${Date.now()}`,
            grademodel: GRADEMODEL_PERITEM,
        });
        await openExeActivity(page, activity.cmid, 'exelearner1');

        const authority = await readRuntimeAuthority(page);

        // One tag each: a package that already carried the pair must not end up with two.
        expect(authority.wrapperTags).toBe(1);
        expect(authority.scoFunctionsTags).toBe(1);
        // The plugin's copy is the complete five-layer runtime, so the registry is there
        // and the file says which eXeLearning release it came from.
        expect(authority.hasRegistry).toBe(true);
        expect(authority.runtimeVersion).not.toBeNull();
        expect(authority.runtimeVersion).not.toBe('unknown');
        // And the serving model is the one the audit predicted: a web export, with no
        // `exe-scorm` body class, so the runtime's page lifecycle never runs here.
        expect(authority.bodyClass).toContain('exe-export');
        expect(authority.bodyClass).not.toContain('exe-scorm');
    });

    test('a SCORM export uploaded here also gets exactly one runtime', async ({ page }) => {
        // The plugin accepts a SCORM 1.2 export as its package: `content.xml` at the root
        // is the only thing it validates. That package references the two runtime files
        // itself, so it is the case where the plugin's injection can double up — and it
        // is also a different serving model, because a SCORM export carries the
        // `exe-scorm` body class that a web export does not.
        // Not a `test.skip`: an assertion that quietly stops running is worse than one
        // that fails, and this is the case the injector's dedupe exists for. The package
        // is staged where the README says to stage it; if it is not there, say so.
        // Outside the plugin directory on purpose: that path is a mount of a working copy
        // and gets rewritten, so a package staged there disappears without warning.
        const scormPackage = process.env.EXE_SCORM_PACKAGE ?? '/var/www/moodledata/audit/scorm12-upload.zip';
        const staged = execFileSync(
            'docker',
            [
                'exec',
                process.env.EXE_MOODLE_CONTAINER ?? 'exeaudit-moodle-1',
                'sh',
                '-c',
                `test -f ${scormPackage} && echo yes || echo no`,
            ],
            { encoding: 'utf8' },
        ).trim();
        expect(
            staged,
            `stage a SCORM 1.2 zip at ${scormPackage} inside the container (see test/e2e/moodle/README.md)`,
        ).toBe('yes');

        const activity = addExeActivity({
            packagePath: scormPackage,
            name: `EXE-FROM-SCORM-${Date.now()}`,
            grademodel: GRADEMODEL_PERITEM,
        });
        await countApiCalls(page);
        await openExeActivity(page, activity.cmid, 'exelearner4');
        await page.waitForLoadState('networkidle');

        const authority = await readRuntimeAuthority(page);

        expect(authority.wrapperTags).toBe(1);
        expect(authority.scoFunctionsTags).toBe(1);
        // And the package keeps its own nature: this one DOES run the runtime's page
        // lifecycle, unlike the web export the plugin normally serves.
        expect(authority.bodyClass).toContain('exe-scorm');

        // One session, one end to it. Before the injector deduped the tags, this page
        // carried two of each; the traffic happened to stay single, which is worth pinning
        // precisely because nothing guaranteed it.
        expect(await apiCallCount(page, 'LMSInitialize')).toBe(1);
        await dispatchPageHide(page);
        await page.waitForLoadState('networkidle');
        expect(await apiCallCount(page, 'LMSFinish')).toBe(1);
        expect(await apiCallCount(page, 'LMSCommit')).toBe(1);
    });

    test('the runtime initialises once and ends the session once', async ({ page }) => {
        // The measurable consequence of loading a runtime twice is doing everything twice:
        // two sessions opened, two commits, two finishes. Counting the calls is what turns
        // "the page has one script tag" into "the LMS sees one session", and it is the
        // assertion that was missing while the duplicate tags went unnoticed.
        const activity = addExeActivity({
            packagePath: SINGLE_PAGE,
            name: `EXE-CALLS-${Date.now()}`,
            grademodel: GRADEMODEL_PERITEM,
        });
        await countApiCalls(page);
        await openExeActivity(page, activity.cmid, 'exelearner4');
        await page.waitForLoadState('networkidle');

        expect(await apiCallCount(page, 'LMSInitialize')).toBe(1);

        await dispatchPageHide(page);
        await page.waitForLoadState('networkidle');

        // A web export never arms the runtime's page lifecycle — no `exe-scorm` body class,
        // so `loadPage()` never runs — and therefore ends no session on the way out. That
        // is the serving model, not a defect, and pinning it is how a change to it becomes
        // visible instead of silent.
        expect(await apiCallCount(page, 'LMSInitialize')).toBe(1);
        expect(await apiCallCount(page, 'LMSFinish')).toBe(0);
    });

    test('PERITEM publishes the answered iDevice in its own gradebook column', async ({ page }) => {
        const activity = addExeActivity({
            packagePath: SINGLE_PAGE,
            name: `EXE-PERITEM-${Date.now()}`,
            grademodel: GRADEMODEL_PERITEM,
        });
        expect(activity.gradeitems.length).toBeGreaterThan(0);

        await openExeActivity(page, activity.cmid, 'exelearner1');
        const first = activity.gradeitems[0];
        await withTrackPost(page, () => answerTrueOrFalseFully(page, first.objectid));

        const state = await waitForState(
            activity.cmid,
            'exelearner1',
            candidate => candidate.attempts.some(row => row.itemnumber === first.itemnumber),
            `an attempt row for item ${first.itemnumber}`,
        );
        const item = state.gradebook.find(row => row.itemnumber === first.itemnumber);
        const overallColumn = state.gradebook.find(row => row.itemnumber === 0);

        expect(item?.grade).toBe(100);
        // In PERITEM the overall column is deliberately not published: the per-iDevice
        // columns carry the gradebook and the category aggregates them.
        expect(overallColumn?.grade ?? null).toBeNull();
        // The attempt row exists and counts.
        const row = state.attempts.find(a => a.itemnumber === first.itemnumber);
        expect(row?.gradable).toBe(1);
        expect(row?.rawscore).toBe(100);
    });

    test('OVERALL publishes one aggregated column instead', async ({ page }) => {
        const activity = addExeActivity({
            packagePath: SINGLE_PAGE,
            name: `EXE-OVERALL-${Date.now()}`,
            grademodel: GRADEMODEL_OVERALL,
        });
        await openExeActivity(page, activity.cmid, 'exelearner2');
        const first = activity.gradeitems[0];
        await withTrackPost(page, () => answerTrueOrFalseFully(page, first.objectid));

        const state = await waitForState(
            activity.cmid,
            'exelearner2',
            candidate => candidate.gradebook.some(row => row.itemnumber === 0 && row.grade !== null),
            'the overall gradebook column to be published',
        );
        const overallColumn = state.gradebook.find(row => row.itemnumber === 0);
        const perItemColumn = state.gradebook.find(row => row.itemnumber === first.itemnumber);

        // The server recomputes the overall from the items the learner reported, not from
        // every gradable iDevice in the package: one answered at 100 with weight 100 makes
        // the overall 100 even though a second iDevice was never touched. That denominator
        // is a live product decision, and this pins what the code does today.
        expect(overallColumn?.grade).toBe(100);
        expect(perItemColumn).toBeUndefined();
        const overallRow = state.attempts.find(a => a.itemnumber === 0);
        expect(overallRow?.gradable).toBe(1);
    });

    test('with grading off the plugin records nothing at all', async ({ page }) => {
        const activity = addExeActivity({
            packagePath: SINGLE_PAGE,
            name: `EXE-UNGRADED-${Date.now()}`,
            grademodel: GRADEMODEL_PERITEM,
            gradeenabled: 0,
        });
        // No grade items are detected for an ungraded activity, so there is nothing for a
        // score to route to either.
        expect(activity.gradeitems.filter(item => item.deleted === 0)).toHaveLength(0);

        await openExeActivity(page, activity.cmid, 'exelearner3');
        const idevice = await page
            .frameLocator(`#${EXE_FRAME_ID}`)
            .locator('.idevice_node.trueorfalse')
            .first()
            .getAttribute('id');
        expect(idevice).not.toBeNull();
        // A negative result needs a positive event to hang off, or it only says the test
        // was faster than the write. The client still POSTs with grading off — it is the
        // server that declines — so wait for that POST and read what the plugin answered.
        const acks = await withTrackPost(page, () => answerTrueOrFalseFully(page, idevice as string));

        expect(acks.length).toBeGreaterThan(0);
        for (const ack of acks) {
            expect(ack.ok).toBe(true);
            expect(ack.noop).toBe(true);
            expect(ack.rawscore).toBeUndefined();
        }

        const state = readExeState(activity.cmid, 'exelearner3');
        expect(state.attempts).toHaveLength(0);
        expect(state.gradebook).toHaveLength(0);
    });
});
