/**
 * Tier 1 trace recorder — the FOUR-TYPE matrix.
 *
 * Drives real exported eXeLearning packages (M2 / M3 / M4 of the fixture matrix) in a
 * real browser under the `mod_exelearning` serving model
 * (see helpers/moodle-serving-model.ts, which reproduces scorm_injector.php AND
 * idevice_patch.php) and writes the observed SCORM 1.2 + xAPI traffic to
 * `<TRACE_DIR>/<scenario>.<engine>.trace.json` per the trace contract
 * (test/fixtures/grading/TRACE-CONTRACT.md, v2): every trace names the engine it was
 * recorded in, the sha256 of the exported zip, the sha256 and version stamp of the
 * runtime pair that was served, and which injector served it.
 *
 * It needs the plugin's runtime pair (`MOD_EXELEARNING_SCORM_ASSETS`) and skips
 * without it. It fails when it records nothing — see {@link assertRecorded}.
 *
 * Every iDevice is answered through its OWN UI controls: radio clicks for
 * `trueorfalse` and `form`, a real jQuery-UI mouse drag for `dragdrop`, the runtime's
 * own up-arrows for `scrambled-list`, then each type's own "Comprobar" button.
 *
 * The fixtures are exported exactly as the generator authors them — no
 * `fixtureRepairs`. (`trueorfalse` needs `isTest: true` to score at all; that is the
 * generator's default now, see `GradableSpec.isTest`.)
 *
 * `expected` in each trace is hand-computed here from the answer key and the
 * documented per-type scoring model — never derived from what the code produced.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

import type { ProjectSpec } from '../../../helpers/grading-fixtures';
import { gradingAnswerKey } from '../../../helpers/grading-fixtures';
import { gradingScenario, type ScenarioOracle } from '../../../helpers/grading-scenarios';
import {
    buildHtml5Package,
    installMoodleServing,
    openPackage,
    navigateIframe,
    waitForScormActive,
    waitForInFrame,
    answerTrueOrFalse,
    checkTrueOrFalse,
    dragDropInstance,
    dragCard,
    checkDragDrop,
    dragDropStates,
    scrambledListOrderIndex,
    scrambledListOrigIndices,
    sortScrambledList,
    checkScrambledList,
    answerForm,
    checkForm,
    waitForFormBound,
    readTrace,
    readCmi,
    settle,
    pluginScormAssetsFromEnv,
    PLUGIN_SCORM_ASSETS_ENV,
    type BuiltPackage,
    type InjectorVariant,
    type RecordedTrace,
    type ServedRuntime,
} from '../helpers/moodle-serving-model';

/** `traceVersion` of what this recorder writes (TRACE-CONTRACT.md). */
const TRACE_VERSION = 2;

/**
 * Where the recorded traces are written. Defaults inside the repo's own gitignored
 * scratch area so a checkout runs anywhere; set GRADING_TRACE_DIR to redirect them, for
 * instance straight into the plugin's tests/fixtures/traces/.
 */
const TRACE_DIR = process.env.GRADING_TRACE_DIR ?? path.join(process.cwd(), 'test', 'temp', 'grading-traces');

/**
 * The plugin revision whose serving model is recorded: #105, which opens the session
 * through `exeScorm12.session.open({ ownsLifecycle: false })`. Under plugin main's
 * `pipwerks.SCORM.init()` the rewritten runtime opens the pipwerks connection but keeps
 * its own client idle, refuses every write with 301 and records nothing.
 */
const INJECTOR: InjectorVariant = '105';

const CORE_REF = (() => {
    try {
        return execSync('git rev-parse HEAD', { cwd: path.resolve(__dirname, '../../../..') })
            .toString()
            .trim();
    } catch {
        return 'unknown';
    }
})();

/**
 * Re-attribute each recorded call to the page whose document was REALLY loaded.
 *
 * `window.__trace.page` is the index the driver last navigated to, but an iDevice's
 * `beforeunload`/`unload` handler fires AFTER that assignment while the OLD page is
 * still the frame's document — those calls must stay on the old page, or the replay
 * would resolve their slots against the next page's DOM. `href` is what the browser
 * really had loaded, so it is the authority; the driver's index is kept as `navPage`.
 */
function attributePages<T extends { page: number; href: string }>(pkg: BuiltPackage, entries: T[]): T[] {
    return entries.map(entry => {
        const match = pkg.pages.find(p => entry.href.endsWith(`/${p.url}`));
        return { ...entry, page: match ? match.index : entry.page, navPage: entry.page };
    });
}

/**
 * The hand-authored oracle of one scenario. It is the catalogue's `ScenarioOracle`
 * verbatim (test/helpers/grading-scenarios.ts) — the recorder does not author its own,
 * it reads the one every consumer shares and writes it into the trace.
 */
type ExpectedOutcome = ScenarioOracle;

/** Everything one scenario observed, plus its oracle. */
interface Recording {
    interactions: Record<string, unknown>[];
    trace: RecordedTrace;
    cmi: Record<string, string>;
    consoleErrors: string[];
    expected: ExpectedOutcome;
}

/**
 * Write one v2 trace. The file name carries the engine, so a Firefox run sits next to
 * the Chromium one instead of overwriting it.
 */
function writeTrace(
    scenario: string,
    engine: string,
    pkg: BuiltPackage,
    runtime: ServedRuntime,
    recording: Recording,
): string {
    const body = {
        traceVersion: TRACE_VERSION,
        scenario,
        engine,
        recordedFrom: { repo: 'exelearning', ref: CORE_REF, exportFormat: 'html5' },
        package: { odeId: pkg.xapiConfig.odeId ?? '', pageCount: pkg.pages.length, sha256: pkg.zipSha256 },
        runtime: {
            sha256: runtime.runtimeSha256,
            version: runtime.runtimeVersion,
            wrapperSha256: runtime.wrapperSha256,
        },
        servingModel: {
            injector: runtime.injector,
            injectorSource: runtime.injectorSource,
            idevicePatch: pkg.patchedFiles,
        },
        pages: pkg.pages,
        interactions: recording.interactions,
        scorm: attributePages(pkg, recording.trace.scorm),
        xapi: attributePages(pkg, recording.trace.xapi),
        finalCmi: recording.cmi,
        consoleErrors: recording.consoleErrors,
        expected: recording.expected,
    };
    fs.mkdirSync(TRACE_DIR, { recursive: true });
    const file = path.join(TRACE_DIR, `${scenario}.${engine}.trace.json`);
    fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
    return file;
}

/**
 * A recorder that records nothing must not pass.
 *
 * The serving model measured exactly that once: a runtime whose client stayed idle
 * refused every write locally, `finalCmi` came back empty, and the run was green
 * because only page count and order were asserted. So, after the trace is on disk
 * (it is the evidence either way), four things are required of it: the package wrote
 * `cmi.suspend_data` at least once, the LMS-side cmi map is not empty, no uncaught
 * error fired inside the package, and the score the LMS holds is the scenario's
 * hand-computed overall — the trace file is the assertion's failure output.
 */
function assertRecorded(
    label: string,
    trace: RecordedTrace,
    cmi: Record<string, string>,
    consoleErrors: string[],
    expected: ExpectedOutcome,
): void {
    const suspendWrites = trace.scorm.filter(c => c.method === 'LMSSetValue' && c.args[0] === 'cmi.suspend_data');
    expect(suspendWrites.length, `${label}: no LMSSetValue(cmi.suspend_data) reached window.API`).toBeGreaterThan(0);
    expect(Object.keys(cmi).length, `${label}: the LMS-side cmi map is empty`).toBeGreaterThan(0);
    const pageErrors = consoleErrors.filter(e => e.startsWith('pageerror:'));
    expect(pageErrors, `${label}: uncaught errors inside the package`).toEqual([]);
    expect(
        Number(cmi['cmi.core.score.raw']),
        `${label}: cmi.core.score.raw ${JSON.stringify(cmi['cmi.core.score.raw'])} vs hand-authored overall ${expected.overall}`,
    ).toBe(expected.overall);
}

async function setup(
    spec: ProjectSpec,
    origin: string,
    page: import('@playwright/test').Page,
): Promise<{ pkg: BuiltPackage; runtime: ServedRuntime }> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-matrix-'));
    const pkg = await buildHtml5Package(spec, tmpDir);
    const runtime = await installMoodleServing(page, pkg, origin, { injector: INJECTOR });
    await openPackage(page, origin);
    return { pkg, runtime };
}

/** Scroll the PARENT window so an element inside the iframe is near the top. */
async function scrollToInFrame(page: import('@playwright/test').Page, selector: string): Promise<void> {
    await page.evaluate(sel => {
        const f = document.getElementById('exelearningobject') as HTMLIFrameElement;
        const d = f.contentDocument as Document;
        const el = d.querySelector(sel) as HTMLElement | null;
        if (!el) throw new Error(`scrollToInFrame: ${sel} not found`);
        const top = f.getBoundingClientRect().top + window.scrollY + el.getBoundingClientRect().top;
        window.scrollTo(0, Math.max(0, top - 60));
    }, selector);
    await page.waitForTimeout(100);
}

// ---------------------------------------------------------------------------
// The matrix specs and their oracles — from the shared scenario catalogue
// (test/helpers/grading-scenarios.ts), the single declaration every grading
// consumer reads. The click scripts below drive each spec to the target scores
// the catalogue's `actions` name; the `expected` oracle is the catalogue's own.
// ---------------------------------------------------------------------------

const M2_SPEC: ProjectSpec = gradingScenario('M2').spec;
const M3_SPEC: ProjectSpec = gradingScenario('M3').spec;
const M4_SPEC: ProjectSpec = gradingScenario('M4').spec;

/** Answer-key accessors, typed by the discriminated union the fixture returns. */
function tofSolutions(spec: ProjectSpec, id: string): (0 | 1)[] {
    const key = gradingAnswerKey(spec)[id];
    if (key.type !== 'trueorfalse') throw new Error(`${id} is not trueorfalse`);
    return key.solutions;
}
function formAnswers(spec: ProjectSpec, id: string): (0 | 1)[] {
    const key = gradingAnswerKey(spec)[id];
    if (key.type !== 'form') throw new Error(`${id} is not form`);
    return key.questions.map(q => q.answer);
}
function dndPairs(spec: ProjectSpec, id: string): number[] {
    const key = gradingAnswerKey(spec)[id];
    if (key.type !== 'dragdrop') throw new Error(`${id} is not dragdrop`);
    return key.pairs;
}

const flip = (v: 0 | 1): 0 | 1 => (v === 1 ? 0 : 1);

test.describe('grading matrix recorder', () => {
    // This file sits in the default Playwright testDir, so every project (chromium,
    // firefox, static) collects it. It needs the plugin's own runtime pair, which no
    // checkout of this repository carries: without the variable the whole group skips —
    // visibly, with the reason — instead of failing at the first file read.
    test.skip(
        !pluginScormAssetsFromEnv(),
        `${PLUGIN_SCORM_ASSETS_ENV} is not set — the recorder serves the mod_exelearning runtime pair from ` +
            'that directory (<mod_exelearning>/assets/scorm); see helpers/moodle-serving-model.ts',
    );
    test.describe.configure({ mode: 'serial' });
    test.use({ viewport: { width: 1400, height: 1000 } });

    test('M2 single page, four types, weights 10/20/30/40', async ({ page, browserName }) => {
        test.setTimeout(300000);
        const consoleErrors: string[] = [];
        page.on('console', m => {
            if (m.type() === 'error') consoleErrors.push(m.text());
        });
        page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`));

        const origin = 'http://exe-matrix-m2.local';
        const { pkg, runtime } = await setup(M2_SPEC, origin, page);
        expect(pkg.pages.length).toBe(1);
        expect(pkg.pages[0].ideviceNodes).toEqual(['m2-tof', 'm2-dnd', 'm2-sl', 'm2-frm']);
        console.log(`[M2] patched files: ${JSON.stringify(pkg.patchedFiles)}`);

        await waitForScormActive(page, INJECTOR);
        await waitForInFrame(page, '#tofPGameContainer-m2-tof .TOFP-Answer');
        await waitForInFrame(page, '#frmMainContainer-m2-frm li.FormView_question');
        await waitForInFrame(page, '[id^="dadPGameContainer-"] .DADP-DS');
        await waitForInFrame(page, 'ul[id^="exe-sortableList-"] > li');

        const interactions: Record<string, unknown>[] = [];

        // --- m2-tof: all four correct -> 100 -------------------------------
        const tofKey = tofSolutions(M2_SPEC, 'm2-tof');
        for (let q = 0; q < 4; q++) await answerTrueOrFalse(page, 'm2-tof', q, tofKey[q]);
        await checkTrueOrFalse(page, 'm2-tof');
        await settle(page);
        interactions.push({ page: 0, idevice: 'm2-tof', type: 'trueorfalse', clicked: tofKey, hits: 4, of: 4 });

        // --- m2-dnd: every card on its own target -> 100 --------------------
        const dnd = await dragDropInstance(page, 'm2-dnd');
        const pairs = dndPairs(M2_SPEC, 'm2-dnd');
        await scrollToInFrame(page, `#dadPMainContainer-${dnd}`);
        for (let card = 0; card < pairs.length; card++) {
            await dragCard(page, dnd, card, pairs[card]);
        }
        const statesM2 = await dragDropStates(page, dnd);
        console.log(`[M2] dragdrop states after drops: ${JSON.stringify(statesM2)}`);
        await checkDragDrop(page, dnd);
        await settle(page);
        interactions.push({
            page: 0,
            idevice: 'm2-dnd',
            type: 'dragdrop',
            drops: pairs,
            states: statesM2,
            hits: 4,
            of: 4,
        });

        // --- m2-sl: a derangement -> 0 --------------------------------------
        const sl = await scrambledListOrderIndex(page, 'm2-sl');
        const slBefore = await scrambledListOrigIndices(page, sl);
        const slWanted = [1, 2, 3, 0]; // no item in its own position
        await scrollToInFrame(page, `#exe-sortableList-${sl}`);
        await sortScrambledList(page, sl, slWanted);
        const slAfter = await scrambledListOrigIndices(page, sl);
        console.log(`[M2] scrambled-list ${sl}: ${JSON.stringify(slBefore)} -> ${JSON.stringify(slAfter)}`);
        await checkScrambledList(page, sl);
        await settle(page);
        interactions.push({
            page: 0,
            idevice: 'm2-sl',
            type: 'scrambled-list',
            shuffled: slBefore,
            submitted: slAfter,
            hits: 0,
            of: 4,
        });

        // --- m2-frm: every answer wrong -> 0 --------------------------------
        const frmKey = formAnswers(M2_SPEC, 'm2-frm');
        const frmClicked = frmKey.map(flip);
        await waitForFormBound(page, 'm2-frm');
        await scrollToInFrame(page, '#frmMainContainer-m2-frm');
        for (let q = 0; q < frmClicked.length; q++) await answerForm(page, 'm2-frm', q, frmClicked[q]);
        await checkForm(page, 'm2-frm');
        await settle(page);
        interactions.push({ page: 0, idevice: 'm2-frm', type: 'form', clicked: frmClicked, hits: 0, of: 4 });

        const trace = await readTrace(page);
        const cmi = await readCmi(page);

        const expected: ExpectedOutcome = gradingScenario('M2').expected;

        const file = writeTrace('m2-four-types-single-page', browserName, pkg, runtime, {
            interactions,
            trace,
            cmi,
            consoleErrors,
            expected,
        });

        console.log(`[M2] trace: ${file}`);
        console.log(`[M2] suspend_data: ${JSON.stringify(cmi['cmi.suspend_data'])}`);
        console.log(`[M2] score.raw: ${JSON.stringify(cmi['cmi.core.score.raw'])}`);
        console.log(`[M2] scorm calls ${trace.scorm.length}, xapi ${trace.xapi.length}`);
        console.log(`[M2] console errors: ${JSON.stringify(consoleErrors.slice(0, 8))}`);

        assertRecorded('M2', trace, cmi, consoleErrors, expected);
    });

    test('M4 two pages, one gradable each, weights 25/75', async ({ page, browserName }) => {
        test.setTimeout(300000);
        const consoleErrors: string[] = [];
        page.on('console', m => {
            if (m.type() === 'error') consoleErrors.push(m.text());
        });
        page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`));

        const origin = 'http://exe-matrix-m4.local';
        const { pkg, runtime } = await setup(M4_SPEC, origin, page);
        expect(pkg.pages.length).toBe(2);
        console.log(`[M4] pages: ${JSON.stringify(pkg.pages)}`);

        const interactions: Record<string, unknown>[] = [];

        // --- page 1: trueorfalse, all correct -> 100 ------------------------
        await waitForScormActive(page, INJECTOR);
        await waitForInFrame(page, '#tofPGameContainer-m4-p1 .TOFP-Answer');
        const tofKey = tofSolutions(M4_SPEC, 'm4-p1');
        for (let q = 0; q < 4; q++) await answerTrueOrFalse(page, 'm4-p1', q, tofKey[q]);
        await checkTrueOrFalse(page, 'm4-p1');
        await settle(page);
        interactions.push({ page: 0, idevice: 'm4-p1', type: 'trueorfalse', clicked: tofKey, hits: 4, of: 4 });

        // --- page 2: form, all wrong -> 0 -----------------------------------
        await navigateIframe(page, origin, pkg, 1);
        await waitForScormActive(page, INJECTOR);
        await waitForInFrame(page, '#frmMainContainer-m4-p2 li.FormView_question');
        await waitForFormBound(page, 'm4-p2');
        const frmKey = formAnswers(M4_SPEC, 'm4-p2');
        const frmClicked = frmKey.map(flip);
        for (let q = 0; q < frmClicked.length; q++) await answerForm(page, 'm4-p2', q, frmClicked[q]);
        await checkForm(page, 'm4-p2');
        await settle(page);
        interactions.push({ page: 1, idevice: 'm4-p2', type: 'form', clicked: frmClicked, hits: 0, of: 4 });

        const trace = await readTrace(page);
        const cmi = await readCmi(page);

        const expected: ExpectedOutcome = gradingScenario('M4').expected;

        const file = writeTrace('m4-multipage-weighted-25-75', browserName, pkg, runtime, {
            interactions,
            trace,
            cmi,
            consoleErrors,
            expected,
        });

        console.log(`[M4] trace: ${file}`);
        console.log(`[M4] suspend_data: ${JSON.stringify(cmi['cmi.suspend_data'])}`);
        console.log(`[M4] score.raw: ${JSON.stringify(cmi['cmi.core.score.raw'])}`);
        console.log(`[M4] scorm calls ${trace.scorm.length}, xapi ${trace.xapi.length}`);
        console.log(`[M4] console errors: ${JSON.stringify(consoleErrors.slice(0, 8))}`);

        assertRecorded('M4', trace, cmi, consoleErrors, expected);
    });

    test('M3 two pages, two gradable each, mixed scores', async ({ page, browserName }) => {
        test.setTimeout(300000);
        const consoleErrors: string[] = [];
        page.on('console', m => {
            if (m.type() === 'error') consoleErrors.push(m.text());
        });
        page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`));

        const origin = 'http://exe-matrix-m3.local';
        const { pkg, runtime } = await setup(M3_SPEC, origin, page);
        expect(pkg.pages.length).toBe(2);
        console.log(`[M3] pages: ${JSON.stringify(pkg.pages)}`);

        const interactions: Record<string, unknown>[] = [];

        // --- page 1 --------------------------------------------------------
        await waitForScormActive(page, INJECTOR);
        await waitForInFrame(page, '#tofPGameContainer-m3-p1-tof .TOFP-Answer');
        await waitForInFrame(page, 'ul[id^="exe-sortableList-"] > li');

        // m3-p1-tof: 3 of 4 correct -> 75
        const tofKey = tofSolutions(M3_SPEC, 'm3-p1-tof');
        const tofClicked: (0 | 1)[] = [tofKey[0], tofKey[1], tofKey[2], flip(tofKey[3])];
        for (let q = 0; q < 4; q++) await answerTrueOrFalse(page, 'm3-p1-tof', q, tofClicked[q]);
        await checkTrueOrFalse(page, 'm3-p1-tof');
        await settle(page);
        interactions.push({ page: 0, idevice: 'm3-p1-tof', type: 'trueorfalse', clicked: tofClicked, hits: 3, of: 4 });

        // m3-p1-sl: [0,1,3,2] -> exactly 2 items in position -> 50
        const sl = await scrambledListOrderIndex(page, 'm3-p1-sl');
        const slBefore = await scrambledListOrigIndices(page, sl);
        const slWanted = [0, 1, 3, 2];
        await scrollToInFrame(page, `#exe-sortableList-${sl}`);
        await sortScrambledList(page, sl, slWanted);
        const slAfter = await scrambledListOrigIndices(page, sl);
        console.log(`[M3] scrambled-list ${sl}: ${JSON.stringify(slBefore)} -> ${JSON.stringify(slAfter)}`);
        await checkScrambledList(page, sl);
        await settle(page);
        interactions.push({
            page: 0,
            idevice: 'm3-p1-sl',
            type: 'scrambled-list',
            shuffled: slBefore,
            submitted: slAfter,
            hits: 2,
            of: 4,
        });

        // --- page 2 --------------------------------------------------------
        await navigateIframe(page, origin, pkg, 1);
        await waitForScormActive(page, INJECTOR);
        await waitForInFrame(page, '[id^="dadPGameContainer-"] .DADP-DS');
        await waitForInFrame(page, '#frmMainContainer-m3-p2-frm li.FormView_question');

        // m3-p2-dnd: only card 0 on its own target -> 1 of 4 -> 25
        const dnd = await dragDropInstance(page, 'm3-p2-dnd');
        const drops: [number, number][] = [
            [0, 0],
            [1, 2],
            [2, 3],
            [3, 1],
        ];
        await scrollToInFrame(page, `#dadPMainContainer-${dnd}`);
        for (const [card, target] of drops) await dragCard(page, dnd, card, target);
        const states = await dragDropStates(page, dnd);
        console.log(`[M3] dragdrop states after drops: ${JSON.stringify(states)}`);
        await checkDragDrop(page, dnd);
        await settle(page);
        interactions.push({ page: 1, idevice: 'm3-p2-dnd', type: 'dragdrop', drops, states, hits: 1, of: 4 });

        // m3-p2-frm: 2 of 4 correct -> 50
        const frmKey = formAnswers(M3_SPEC, 'm3-p2-frm');
        const frmClicked: (0 | 1)[] = [frmKey[0], frmKey[1], flip(frmKey[2]), flip(frmKey[3])];
        await waitForFormBound(page, 'm3-p2-frm');
        await scrollToInFrame(page, '#frmMainContainer-m3-p2-frm');
        for (let q = 0; q < frmClicked.length; q++) await answerForm(page, 'm3-p2-frm', q, frmClicked[q]);
        await checkForm(page, 'm3-p2-frm');
        await settle(page);
        interactions.push({ page: 1, idevice: 'm3-p2-frm', type: 'form', clicked: frmClicked, hits: 2, of: 4 });

        const trace = await readTrace(page);
        const cmi = await readCmi(page);

        const expected: ExpectedOutcome = gradingScenario('M3').expected;

        const file = writeTrace('m3-two-pages-two-gradable', browserName, pkg, runtime, {
            interactions,
            trace,
            cmi,
            consoleErrors,
            expected,
        });

        console.log(`[M3] trace: ${file}`);
        console.log(`[M3] suspend_data: ${JSON.stringify(cmi['cmi.suspend_data'])}`);
        console.log(`[M3] score.raw: ${JSON.stringify(cmi['cmi.core.score.raw'])}`);
        console.log(`[M3] scorm calls ${trace.scorm.length}, xapi ${trace.xapi.length}`);
        console.log(`[M3] console errors: ${JSON.stringify(consoleErrors.slice(0, 8))}`);

        assertRecorded('M3', trace, cmi, consoleErrors, expected);
    });
    /**
     * M3-control: the SAME package and the same first three answers, with only the
     * page-2 form moved from 2/4 (50) to 3/4 (75).
     *
     * In M3 the page-2 form lands on slot 2, whose stale page-1 entry already reads
     * "50%, weight 100" — numerically identical, so the plugin tracker's
     * changed-entries heuristic sees no change and never stamps the form. Scoring 75
     * instead makes the very same write visible. Recorded to prove the mechanism
     * rather than assert it.
     */
    test('M3-control same package, page-2 form scores 75 instead of 50', async ({ page, browserName }) => {
        test.setTimeout(300000);
        const consoleErrors: string[] = [];
        page.on('console', m => {
            if (m.type() === 'error') consoleErrors.push(m.text());
        });
        page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`));

        const origin = 'http://exe-matrix-m3c.local';
        const { pkg, runtime } = await setup(M3_SPEC, origin, page);
        const interactions: Record<string, unknown>[] = [];

        await waitForScormActive(page, INJECTOR);
        await waitForInFrame(page, '#tofPGameContainer-m3-p1-tof .TOFP-Answer');
        await waitForInFrame(page, 'ul[id^="exe-sortableList-"] > li');

        const tofKey = tofSolutions(M3_SPEC, 'm3-p1-tof');
        const tofClicked: (0 | 1)[] = [tofKey[0], tofKey[1], tofKey[2], flip(tofKey[3])];
        for (let q = 0; q < 4; q++) await answerTrueOrFalse(page, 'm3-p1-tof', q, tofClicked[q]);
        await checkTrueOrFalse(page, 'm3-p1-tof');
        await settle(page);
        interactions.push({ page: 0, idevice: 'm3-p1-tof', type: 'trueorfalse', clicked: tofClicked, hits: 3, of: 4 });

        const sl = await scrambledListOrderIndex(page, 'm3-p1-sl');
        const slBefore = await scrambledListOrigIndices(page, sl);
        await scrollToInFrame(page, `#exe-sortableList-${sl}`);
        await sortScrambledList(page, sl, [0, 1, 3, 2]);
        const slAfter = await scrambledListOrigIndices(page, sl);
        await checkScrambledList(page, sl);
        await settle(page);
        interactions.push({
            page: 0,
            idevice: 'm3-p1-sl',
            type: 'scrambled-list',
            shuffled: slBefore,
            submitted: slAfter,
            hits: 2,
            of: 4,
        });

        await navigateIframe(page, origin, pkg, 1);
        await waitForScormActive(page, INJECTOR);
        await waitForInFrame(page, '[id^="dadPGameContainer-"] .DADP-DS');
        await waitForInFrame(page, '#frmMainContainer-m3-p2-frm li.FormView_question');

        const dnd = await dragDropInstance(page, 'm3-p2-dnd');
        const drops: [number, number][] = [
            [0, 0],
            [1, 2],
            [2, 3],
            [3, 1],
        ];
        await scrollToInFrame(page, `#dadPMainContainer-${dnd}`);
        for (const [card, target] of drops) await dragCard(page, dnd, card, target);
        const states = await dragDropStates(page, dnd);
        await checkDragDrop(page, dnd);
        await settle(page);
        interactions.push({ page: 1, idevice: 'm3-p2-dnd', type: 'dragdrop', drops, states, hits: 1, of: 4 });

        // 3 of 4 correct -> 75 (the only difference from M3)
        const frmKey = formAnswers(M3_SPEC, 'm3-p2-frm');
        const frmClicked: (0 | 1)[] = [frmKey[0], frmKey[1], frmKey[2], flip(frmKey[3])];
        await waitForFormBound(page, 'm3-p2-frm');
        await scrollToInFrame(page, '#frmMainContainer-m3-p2-frm');
        for (let q = 0; q < frmClicked.length; q++) await answerForm(page, 'm3-p2-frm', q, frmClicked[q]);
        await checkForm(page, 'm3-p2-frm');
        await settle(page);
        interactions.push({ page: 1, idevice: 'm3-p2-frm', type: 'form', clicked: frmClicked, hits: 3, of: 4 });

        const trace = await readTrace(page);
        const cmi = await readCmi(page);

        const expected: ExpectedOutcome = gradingScenario('M3C').expected;

        const file = writeTrace('m3-control-form-75', browserName, pkg, runtime, {
            interactions,
            trace,
            cmi,
            consoleErrors,
            expected,
        });

        console.log(`[M3C] trace: ${file}`);
        console.log(`[M3C] suspend_data: ${JSON.stringify(cmi['cmi.suspend_data'])}`);
        console.log(`[M3C] score.raw: ${JSON.stringify(cmi['cmi.core.score.raw'])}`);
        console.log(`[M3C] console errors: ${JSON.stringify(consoleErrors.slice(0, 8))}`);

        assertRecorded('M3C', trace, cmi, consoleErrors, expected);
    });
});
