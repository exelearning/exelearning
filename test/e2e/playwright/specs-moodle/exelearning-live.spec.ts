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
import { expect, test } from '@playwright/test';

import { createIdeviceDriver } from '../helpers/idevice-drivers';
import {
    EXE_FRAME_ID,
    addExeActivity,
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

/**
 * Wait until the plugin has acknowledged a tracking POST.
 *
 * The tracker debounces auto-commits by 500 ms, so asserting on the database immediately
 * after the last click reads it before the write. Waiting on the response makes the test
 * deterministic without a sleep.
 *
 * @param page The page to watch.
 * @param action What to do while watching.
 */
async function withTrackPost(page: import('@playwright/test').Page, action: () => Promise<void>): Promise<number> {
    let posts = 0;
    const listener = (response: import('@playwright/test').Response) => {
        if (response.url().includes('/mod/exelearning/track.php') && response.request().method() === 'POST') {
            posts++;
        }
    };
    page.on('response', listener);
    try {
        await action();
        await page.waitForResponse(
            response => response.url().includes('/mod/exelearning/track.php') && response.request().method() === 'POST',
            { timeout: 20000 },
        );
        // Give a trailing debounced commit room to land before the database is read.
        await page.waitForTimeout(1500);
    } finally {
        page.off('response', listener);
    }
    return posts;
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
        const scormPackage = process.env.EXE_SCORM_PACKAGE;
        test.skip(!scormPackage, 'set EXE_SCORM_PACKAGE to a SCORM 1.2 zip inside the container');

        const activity = addExeActivity({
            packagePath: scormPackage as string,
            name: `EXE-FROM-SCORM-${Date.now()}`,
            grademodel: GRADEMODEL_PERITEM,
        });
        await openExeActivity(page, activity.cmid, 'exelearner4');

        const authority = await readRuntimeAuthority(page);

        expect(authority.wrapperTags).toBe(1);
        expect(authority.scoFunctionsTags).toBe(1);
        // And the package keeps its own nature: this one DOES run the runtime's page
        // lifecycle, unlike the web export the plugin normally serves.
        expect(authority.bodyClass).toContain('exe-scorm');
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

        const state = readExeState(activity.cmid, 'exelearner1');
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

        const state = readExeState(activity.cmid, 'exelearner2');
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
        await answerTrueOrFalseFully(page, idevice as string);
        // Nothing to wait for: the point is that no write happens. Give the debounced
        // commit more than its 500 ms window so this is a real observation.
        await page.waitForTimeout(3000);

        const state = readExeState(activity.cmid, 'exelearner3');
        expect(state.attempts).toHaveLength(0);
        expect(state.gradebook).toHaveLength(0);
    });
});
