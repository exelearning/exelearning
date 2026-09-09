import * as fs from 'fs';
import * as path from 'path';
import type { Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Phase 2 of #2210: exported-package smoke against scorm-again.
 *
 * Chain under test (production path end to end):
 *   real SCORM 1.2 export (SharedExporters.quickExport in the workarea)
 *     -> exported HTML + the packaged runtime (libs/SCORM_API_wrapper.js and
 *        the assembled libs/SCOFunctions.js)
 *       -> served under a launcher page whose window.API is scorm-again
 *         -> LMS-side CMI state inspected after launch and after exit
 *
 * The launcher wraps scorm-again's browser build (dist/scorm12.min.js) with
 * the same conservative settings and journaling facade as the unit-level
 * contract suite (public/app/common/scorm/contract/), so the assertions read
 * the identical evidence: every SCO-visible call with its result and the LMS
 * error code after it.
 *
 * What is asserted is the SCORM 1.2 runtime contract the exported package
 * ships (doc/development/scorm12-runtime-contract.md, ADR-2209-01/-02), as
 * the unit-level contract suite pins it: S01/S11 at launch (one
 * LMSInitialize(""), one accepted "incomplete" write, nothing rejected), S13
 * for a page without scored activities (completed, exit "") and S14 for a
 * page whose scored activity was left unanswered (incomplete, exit
 * "suspend"). A change to the entry, status or exit policy must update the
 * contract scenarios and this smoke together. See
 * doc/architecture/changes/2210-scorm12-contract-tests/research.md.
 */

const SMOKE_ORIGIN = 'https://scorm-smoke.local';

/** Strict CMITimespan grammar per RTE §3.4.5 (scorm-again itself is laxer). */
const STRICT_TIMESPAN = /^\d{2,4}:\d{2}:\d{2}(\.\d{1,2})?$/;

const CONTENT_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml',
};

interface JournalEntry {
    method: string;
    args: string[];
    result: string;
    errorAfter: string;
}

interface LmsSnapshot {
    journal: JournalEntry[];
    state: { core: { lesson_status: string } };
}

/**
 * Launcher page: scorm-again as window.API behind a journaling facade,
 * mirroring the unit contract harness (same settings, same seed, same
 * journal shape).
 */
const LAUNCHER_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>SCORM 1.2 smoke launcher</title>
<script src="/scorm-again.js"></script>
<script>
(function () {
    var SETTINGS = {
        autocommit: false,
        lmsCommitUrl: false,
        logLevel: 5,
        mastery_override: false,
        score_overrides_status: false,
        autoCompleteLessonStatus: false,
        selfReportSessionTime: false,
        alwaysSendTotalTime: false,
        sendFullCommit: false,
        autoProgress: false,
        strict_errors: true,
    };
    var ApiClass = typeof Scorm12API === 'function' ? Scorm12API : Scorm12API && Scorm12API.Scorm12API;
    var api = new ApiClass(SETTINGS);
    api.loadFromJSON({
        cmi: {
            core: {
                student_id: 'exe-student-1',
                student_name: 'Student, Smoke',
                lesson_status: 'not attempted',
                credit: 'credit',
                entry: 'ab-initio',
                lesson_mode: 'normal',
                total_time: '0000:00:00.00',
            },
            suspend_data: '',
            launch_data: '',
        },
    });
    var journal = (window.__scormJournal = []);
    var rec = {};
    ['LMSInitialize', 'LMSFinish', 'LMSCommit', 'LMSGetValue', 'LMSSetValue'].forEach(function (m) {
        rec[m] = function () {
            var args = Array.prototype.slice.call(arguments);
            var result = api[m].apply(api, args);
            journal.push({
                method: m,
                args: args.map(String),
                result: String(result),
                errorAfter: String(api.LMSGetLastError()),
            });
            return result;
        };
    });
    ['LMSGetLastError', 'LMSGetErrorString', 'LMSGetDiagnostic'].forEach(function (m) {
        rec[m] = function () {
            return api[m].apply(api, arguments);
        };
    });
    window.API = rec;
    window.__lmsState = function () {
        var dump = api.renderCommitCMI(true);
        return dump && dump.cmi ? dump.cmi : dump;
    };
})();
</script>
</head>
<body>
<iframe id="sco" src="/pkg/index.html" style="width:1000px;height:700px;border:0"></iframe>
</body>
</html>
`;

/**
 * A true-or-false iDevice as the editor stores it: the container markup
 * (`htmlView`, cloned from a real ELPX — the export renderer drops a component
 * with no content, so the placeholder is not optional) plus the settings
 * payload. `isScorm: 1` in quiz mode makes its export code register a required,
 * evaluable activity with the runtime, and the exported page's scan
 * (`exe_export.initScorm`) hands the scored flag to the runtime before
 * `loadPage()` — the production wiring the S14 contract scenario reproduces at
 * unit level.
 */
const SCORED_IDEVICE_ID = 'tof-smoke-1';

const TRUEORFALSE_HTML_TEMPLATE = `<div class="exe-trueorfalse-container">
        <div class="game-evaluation-ids js-hidden" data-id="__INSTANCE__" data-evaluationid="__EVALUATION_ID__"></div>
        <div class="TOFP-instructions"><p>Revisión Final</p></div>
        <div class="TOFP-MainContainer" data-instance="__INSTANCE__" id="tofPMainContainer-__INSTANCE__">
            <div class="TOFP-GameContainer" id="tofPGameContainer-__INSTANCE__">
                <div class="TOFP-GameScoreBoard TOFP-EHidden">
                    <div class="TOFP-TimeNumber">
                        <strong><span class="sr-av">Tiempo por pregunta:</span></strong>
                        <p id="tofPPTime-__INSTANCE__" class="TOFP-PTime">00:00:</p>
                    </div>
                </div>
                <div class="TOFP-MessgeDiv" id="tofPMessageDiv-__INSTANCE__">
                    <div class="TOFP-Message" id="tofPMessage-__INSTANCE__"></div>
                </div>
                <div class="TOFP-StartGameDiv TOFP-EHidden" id="tofPStartGameDiv-__INSTANCE__">
                    <button  id="tofPStartGame-__INSTANCE__" type="button" class="btn btn-primary">Haz clic aquí para empezar</button>
                </div>
                <div class="TOFP-Multimedia " id="tofPMultimedia-__INSTANCE__">
                </div>
            <div class="TOFP-CheckTestDiv " id="tofPCheckTestDiv-__INSTANCE__">
                 <button id="tofPCheckTest-__INSTANCE__" type="button" class="btn btn-primary">Comprobar</button>
                 <button id="tofRebootTest-__INSTANCE__" type="button" class="btn btn-primary TOFP-EHidden">Inténtalo de nuevo</button>
            </div>
        </div>
        <div class="Games-BottonContainer">
            <div class="Games-GetScore">
                <input id="tofPSendScore-__INSTANCE__" type="button" value="Guardar puntuación" class="feedbackbutton Games-SendScore" style="display:none"/> <span class="Games-RepeatActivity"></span>
            </div>
        </div>
        <div class="TOFP-After"></div>
        </div>`;

const TRUEORFALSE_MSGS: Record<string, string> = {
    'msgStartGame': 'Haz clic aquí para empezar',
    'msgTime': 'Tiempo por pregunta',
    'msgNoImage': 'Sin pregunta de imagen',
    'msgScoreScorm': 'La puntuación no se puede guardar porque esta página no es parte de un paquete SCORM.',
    'msgEndGameScore': 'Por favor, empieza el juego antes de guardar tu puntuación.',
    'msgOnlySaveScore': 'Solo puedes guardar la puntuación una vez!',
    'msgOnlySave': 'Solo puedes guardar una vez',
    'msgYouScore': 'Tu puntuación',
    'msgAuthor': 'Autoría',
    'msgOnlySaveAuto': 'Tu puntuación será guardada después de cada pregunta. Solo puedes jugar una vez.',
    'msgSaveAuto': 'Tu puntuación será guardada automáticamente después de cada pregunta.',
    'msgSeveralScore': 'Puedes guardar tu puntuación las veces que quieras',
    'msgYouLastScore': 'La última puntuación guardada es',
    'msgActityComply': 'Ya has hecho esta actividad.',
    'msgPlaySeveralTimes': 'Puedes hacer esta actividad las veces que quieras. ',
    'msgUncompletedActivity': 'Actividad incompleta',
    'msgSuccessfulActivity': 'Actividad: Aprobada. Puntuación: %s',
    'msgUnsuccessfulActivity': 'Actividad: No aprobada. Puntuación: %s',
    'msgTypeGame': 'VerdaderoOFalso',
    'msgFeedback': 'Retroalimentación',
    'msgSuggestion': 'Sugerencia',
    'msgSolution': 'Solución',
    'msgQuestion': 'Pregunta',
    'msgTrue': 'Verdadero',
    'msgFalse': 'Falso',
    'msgOk': 'Correcto',
    'msgKO': 'Incorrecto',
    'msgShow': 'Mostrar',
    'msgHide': 'Esconder',
    'msgCheck': 'Comprobar',
    'msgReboot': 'Inténtalo de nuevo',
    'msgScore': 'Puntuación',
    'msgWeight': 'Peso',
};

const SCORED_TRUE_OR_FALSE = {
    id: SCORED_IDEVICE_ID,
    typeGame: 'TrueOrFalse',
    eXeGameInstructions: '<p>Decide whether the statement is true.</p>',
    eXeIdeviceTextAfter: '',
    msgs: TRUEORFALSE_MSGS,
    questionsRandom: false,
    percentageQuestions: 100,
    // Quiz mode with no countdown: the only pair in which this type scores.
    isTest: true,
    time: 0,
    questionsGame: [
        {
            question: '<p>SCORM 1.2 session time is a CMITimespan.</p>',
            feedback: '',
            suggestion: '',
            solution: 1,
        },
    ],
    isScorm: 1,
    textButtonScorm: 'Guardar puntuación',
    repeatActivity: true,
    weighted: 100,
    evaluation: false,
    evaluationID: '',
    ideviceId: SCORED_IDEVICE_ID,
};

const SCORED_TRUE_OR_FALSE_HTML = TRUEORFALSE_HTML_TEMPLATE.replaceAll('__INSTANCE__', SCORED_IDEVICE_ID).replaceAll(
    '__EVALUATION_ID__',
    '',
);

/**
 * Export the open project as a SCORM 1.2 package through the browser-side
 * pipeline (the production path) after adding one iDevice to its first page.
 *
 * @param page - Workarea page with the project open.
 * @param scored - Add a scored true-or-false iDevice instead of a Text one.
 * @returns The unzipped package files.
 */
async function exportScorm12Package(page: Page, scored: boolean): Promise<Record<string, Uint8Array>> {
    const zipBase64 = await page.evaluate(
        async ({ scored, scoredIdevice, scoredIdeviceHtml }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const exporters = (window as any).SharedExporters;
            if (!bridge?.documentManager || !bridge?.structureBinding || !exporters?.quickExport) {
                throw new Error('Browser export dependencies are not available');
            }
            const navigation = bridge.documentManager.getNavigation();
            const pageId = navigation.get(0)?.get('id');
            if (!pageId) throw new Error('The project has no page');
            let blockId = bridge.structureBinding.getBlocks(pageId)?.[0]?.id;
            if (!blockId) blockId = bridge.structureBinding.createBlock(pageId, 'Content');
            if (scored) {
                bridge.structureBinding.createComponent(pageId, blockId, 'trueorfalse', {
                    id: scoredIdevice.id,
                    htmlContent: scoredIdeviceHtml,
                    jsonProperties: scoredIdevice,
                });
            } else {
                bridge.structureBinding.createComponent(pageId, blockId, 'text', {
                    htmlContent: '<p>SCORM smoke content</p>',
                });
            }
            const exported = await exporters.quickExport(
                'scorm12',
                bridge.documentManager,
                bridge.assetCache || null,
                bridge.resourceFetcher || null,
                {},
                bridge.assetManager || null,
            );
            if (!exported.success || !exported.data) {
                throw new Error(exported.error || 'scorm12 export failed');
            }
            const bytes = new Uint8Array(exported.data);
            let binary = '';
            const CHUNK = 0x8000;
            for (let i = 0; i < bytes.length; i += CHUNK) {
                binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
            }
            return btoa(binary);
        },
        { scored, scoredIdevice: SCORED_TRUE_OR_FALSE, scoredIdeviceHtml: SCORED_TRUE_OR_FALSE_HTML },
    );
    return unzipSync(new Uint8Array(Buffer.from(zipBase64, 'base64')));
}

/**
 * Package composition: entry page, manifest, and exactly the two runtime
 * files the runtime contract freezes — the vendored pipwerks wrapper and
 * libs/SCOFunctions.js, into which the exporter ASSEMBLES the
 * public/app/common/scorm/scorm12/ source layers (Scorm12Runtime.ts). No
 * scorm12/ path may leak into a user's ZIP: the assertion guards that
 * assembly and the ResourceFetcher per-version file list at package level.
 */
function assertPackageComposition(packageFiles: Record<string, Uint8Array>): void {
    const fileNames = Object.keys(packageFiles);
    expect(fileNames).toContain('index.html');
    expect(fileNames).toContain('imsmanifest.xml');
    expect(fileNames).toContain('libs/SCORM_API_wrapper.js');
    expect(fileNames).toContain('libs/SCOFunctions.js');
    expect(fileNames.filter(name => name.includes('scorm12/'))).toEqual([]);
}

/**
 * Serve launcher + scorm-again + the extracted package under one origin so
 * pipwerks' parent-window discovery works unmodified, then open the launcher.
 *
 * @returns The LMS page hosting the SCO iframe.
 */
async function openLauncher(page: Page, packageFiles: Record<string, Uint8Array>): Promise<Page> {
    const scormAgainSource = fs.readFileSync(
        path.join(process.cwd(), 'node_modules', 'scorm-again', 'dist', 'scorm12.min.js'),
    );
    const lmsPage = await page.context().newPage();
    await lmsPage.route(`${SMOKE_ORIGIN}/**`, route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/launcher.html') {
            return route.fulfill({ contentType: 'text/html; charset=utf-8', body: LAUNCHER_HTML });
        }
        if (url.pathname === '/scorm-again.js') {
            return route.fulfill({ contentType: 'text/javascript', body: scormAgainSource });
        }
        if (url.pathname.startsWith('/pkg/')) {
            const packagePath = decodeURIComponent(url.pathname.slice('/pkg/'.length));
            const file = packageFiles[packagePath];
            if (file) {
                return route.fulfill({
                    contentType: CONTENT_TYPES[path.extname(packagePath).toLowerCase()] || 'application/octet-stream',
                    body: Buffer.from(file),
                });
            }
        }
        return route.fulfill({ status: 404, body: 'not found' });
    });
    await lmsPage.goto(`${SMOKE_ORIGIN}/launcher.html`);
    return lmsPage;
}

async function snapshot(lmsPage: Page): Promise<LmsSnapshot> {
    return lmsPage.evaluate(() => ({
        journal: (window as any).__scormJournal.slice(),
        state: (window as any).__lmsState(),
    }));
}

/**
 * Launch: the SCO must discover the parent API, initialize, and apply the
 * entry policy. The deterministic launch signal is the single accepted
 * "incomplete" status write (contract S11): after it the entry transition
 * is over, whatever else the page still initializes.
 */
async function waitForLaunch(lmsPage: Page): Promise<LmsSnapshot> {
    await lmsPage.waitForFunction(
        () => (window as any).__scormJournal?.some((entry: { method: string }) => entry.method === 'LMSInitialize'),
        undefined,
        { timeout: 30_000 },
    );
    await lmsPage.waitForFunction(
        () =>
            (window as any).__scormJournal.some(
                (entry: { method: string; args: string[]; errorAfter: string }) =>
                    entry.method === 'LMSSetValue' &&
                    entry.args[0] === 'cmi.core.lesson_status' &&
                    entry.args[1] === 'incomplete' &&
                    entry.errorAfter === '0',
            ),
        undefined,
        { timeout: 30_000 },
    );
    return snapshot(lmsPage);
}

/**
 * Exit: navigating the SCO frame away fires the package's pagehide handler
 * (persisted=false) and must terminate the session once.
 */
async function exitSco(lmsPage: Page): Promise<LmsSnapshot> {
    await lmsPage.evaluate(() => {
        const frame = document.getElementById('sco') as HTMLIFrameElement;
        frame.src = 'about:blank';
    });
    await lmsPage.waitForFunction(
        () => (window as any).__scormJournal.some((entry: { method: string }) => entry.method === 'LMSFinish'),
        undefined,
        { timeout: 30_000 },
    );
    return snapshot(lmsPage);
}

/**
 * Wait until the exported page has registered its required activity with the
 * runtime (S14 precondition). `exe_export.js` hands the scored flag over and the
 * iDevice registers on its own init, both after the `<body onload>` handshake.
 *
 * @param lmsPage - The launcher page holding the SCO iframe.
 */
async function waitForRequiredActivity(lmsPage: Page): Promise<void> {
    await lmsPage.waitForFunction(
        () => {
            const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
            const summary = sco?.exeScorm12?.activities?.summary?.();
            return summary?.hasRequired === true;
        },
        undefined,
        { timeout: 15_000 },
    );
}

function rejectedWrites(journal: JournalEntry[]): JournalEntry[] {
    return journal.filter(entry => entry.method === 'LMSSetValue' && entry.errorAfter !== '0');
}

function writesTo(journal: JournalEntry[], element: string): JournalEntry[] {
    return journal.filter(entry => entry.method === 'LMSSetValue' && entry.args[0] === element);
}

/** Contract at launch (S01 + S11): one LMSInitialize(""), one accepted "incomplete", nothing rejected. */
function assertLaunchContract({ journal, state }: LmsSnapshot): void {
    const inits = journal.filter(entry => entry.method === 'LMSInitialize');
    expect(inits).toHaveLength(1); // the page calls loadPage() twice; the runtime initializes once (E01)
    expect(inits[0].args).toEqual(['']);
    expect(inits[0].result).toBe('true');
    expect(inits[0].errorAfter).toBe('0');

    // eXe policy: the fresh attempt is "incomplete" at the LMS, reached
    // through exactly one valid status write — never "not attempted".
    expect(state.core.lesson_status).toBe('incomplete');
    const statusWrites = writesTo(journal, 'cmi.core.lesson_status');
    expect(statusWrites.map(entry => entry.args[1])).toEqual(['incomplete']);
    expect(statusWrites[0].result).toBe('true');

    // SPEC: a conformant SCO makes no write the LMS has to refuse.
    expect(rejectedWrites(journal)).toEqual([]);
}

/**
 * Contract at exit: one LMSFinish(""), an explicit commit before it, no call
 * after it, strict CMITimespan session_time accepted, the expected status,
 * exactly one exit write with the expected value, nothing rejected.
 */
function assertExitContract({ journal, state }: LmsSnapshot, expected: { status: string; exit: string }): void {
    const finishes = journal.filter(entry => entry.method === 'LMSFinish');
    expect(finishes).toHaveLength(1);
    expect(finishes[0].args).toEqual(['']);
    expect(finishes[0].result).toBe('true');

    expect(state.core.lesson_status).toBe(expected.status);

    // Session time reached the LMS in the strict CMITimespan grammar and
    // was accepted.
    const timeWrites = writesTo(journal, 'cmi.core.session_time');
    expect(timeWrites.length).toBeGreaterThan(0);
    for (const write of timeWrites) {
        expect(write.args[1]).toMatch(STRICT_TIMESPAN);
        expect(write.errorAfter).toBe('0');
    }

    // An explicit commit preceded the finish, and nothing followed it
    // (RTE §3.3.2.1: the SCO may no longer call the API after LMSFinish).
    const methods = journal.map(entry => entry.method);
    const finishIndex = methods.indexOf('LMSFinish');
    expect(methods.lastIndexOf('LMSCommit')).toBeGreaterThan(-1);
    expect(methods.lastIndexOf('LMSCommit')).toBeLessThan(finishIndex);
    expect(methods.slice(finishIndex + 1)).toEqual([]);

    // eXe exit policy (applyExitPolicy): "" for a terminal status, "suspend"
    // otherwise — written once, and never overwritten by the terminate path.
    const exitWrites = writesTo(journal, 'cmi.core.exit');
    expect(exitWrites.map(entry => entry.args[1])).toEqual([expected.exit]);
    expect(exitWrites[0].errorAfter).toBe('0');

    expect(rejectedWrites(journal)).toEqual([]);
}

test.describe('SCORM 1.2 exported package against scorm-again (smoke)', () => {
    test('an unscored page drives an independent LMS API end to end and completes on exit', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(180_000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'SCORM 1.2 scorm-again smoke');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const packageFiles = await exportScorm12Package(page, false);
        assertPackageComposition(packageFiles);

        const lmsPage = await openLauncher(page, packageFiles);
        assertLaunchContract(await waitForLaunch(lmsPage));

        // S13: a page without scored activities is completed by being
        // viewed, and the attempt ends normally rather than suspended.
        const atExit = await exitSco(lmsPage);
        assertExitContract(atExit, { status: 'completed', exit: '' });
        expect(writesTo(atExit.journal, 'cmi.core.lesson_status').map(entry => entry.args[1])).toEqual([
            'incomplete',
            'completed',
        ]);

        await lmsPage.close();
    });

    test('a scored page left unanswered stays incomplete and suspends on exit', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(180_000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'SCORM 1.2 scorm-again smoke (scored)');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const packageFiles = await exportScorm12Package(page, true);
        assertPackageComposition(packageFiles);

        const lmsPage = await openLauncher(page, packageFiles);
        assertLaunchContract(await waitForLaunch(lmsPage));
        // The iDevice registers its activity from its own init, after the launch
        // handshake the body onload completes; a learner cannot leave before the
        // page has rendered, so wait for that registration the way a real dwell does.
        await waitForRequiredActivity(lmsPage);

        // S14: the learner leaves without answering the required activity —
        // the attempt stays "incomplete" and suspends so it can resume.
        const atExit = await exitSco(lmsPage);
        assertExitContract(atExit, { status: 'incomplete', exit: 'suspend' });
        // E05: an unanswered page publishes no score (a 0 would read as
        // "scored zero"); the status is never rewritten during the session.
        expect(writesTo(atExit.journal, 'cmi.core.score.raw')).toEqual([]);
        expect(writesTo(atExit.journal, 'cmi.core.lesson_status').map(entry => entry.args[1])).toEqual(['incomplete']);

        await lmsPage.close();
    });
});
