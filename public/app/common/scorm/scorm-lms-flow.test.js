/**
 * End-to-end SCORM 1.2 flow against a fake LMS that behaves like Moodle's mod_scorm.
 *
 * The other SCORM specs mock pipwerks and assert single calls. This one wires the REAL runtime
 * files together — SCORM_API_wrapper.js + SCOFunctions.js + common.js — on top of an API object
 * that enforces the Moodle rules verified in mod/scorm/datamodels/scorm_12.js, and walks the
 * learner journey. It is the level at which "nothing reaches the LMS" bugs show up, because it
 * asserts what was PERSISTED, not what was called.
 *
 * Moodle rules modelled here:
 *  - `cmi.core.lesson_status` only accepts passed|completed|failed|incomplete|browsed; anything
 *    else (notably "not attempted") is rejected with error 405 (L38-39, L73).
 *  - LMSGetValue/LMSSetValue work against a volatile cmi object; only LMSCommit and LMSFinish
 *    persist it (StoreData).
 *  - LMSFinish promotes a SCO still in "not attempted" to "completed" (L621-634).
 */

const pipwerks = require('./SCORM_API_wrapper.js');
globalThis.pipwerks = pipwerks;
// In an export these are classic scripts, so their top-level functions live on window. Under
// CommonJS they do not, so re-attach the ones the runtime calls through window.
const scoFunctions = require('./SCOFunctions.js');
globalThis.loadPage = scoFunctions.loadPage;
globalThis.unloadPage = scoFunctions.unloadPage;
globalThis.scorm = pipwerks.SCORM;
require('../common.js');
// $exeExport owns the single page-status writer that restartActivity calls, and it ships in every
// export, so the journey is only faithful with it loaded. It touches a couple of editor globals on
// load that an exported page never has; stub them so the require goes through.
globalThis.eXe = globalThis.eXe || {};
globalThis.eXe.app = Object.assign({ clearHistory() {}, isInExe: () => false }, globalThis.eXe.app);
require('../exe_export.js');

// Minimal Moodle-like SCORM 1.2 API.
function createMoodleApi() {
    const calls = [];
    // What the learner would see in the TOC: only what a commit/finish has persisted.
    const persisted = {};
    const cmi = {
        'cmi.core.lesson_status': 'not attempted',
        'cmi.core.student_name': 'Doe, Jane',
        'cmi.core.lesson_mode': 'normal',
        'cmi.suspend_data': '',
        'cmi.core.exit': '',
    };
    let lastError = '0';
    let initialized = false;

    const writable = ['passed', 'completed', 'failed', 'incomplete', 'browsed'];

    return {
        calls,
        persisted,
        cmi,
        LMSInitialize() {
            // SCORM requires a SCO to terminate before the next one initializes. An LMS that is
            // handed a second LMSInitialize on a still-open session answers 101 and refuses.
            if (initialized) {
                lastError = '101';
                calls.push(['LMSInitialize', 'REJECTED 101']);
                return 'false';
            }
            initialized = true;
            lastError = '0';
            calls.push(['LMSInitialize']);
            return 'true';
        },
        LMSGetValue(key) {
            lastError = '0';
            calls.push(['LMSGetValue', key]);
            return key in cmi ? cmi[key] : '';
        },
        LMSSetValue(key, value) {
            calls.push(['LMSSetValue', key, String(value)]);
            if (key === 'cmi.core.lesson_status' && !writable.includes(String(value))) {
                // Moodle answers 405 and drops the write.
                lastError = '405';
                return 'false';
            }
            lastError = '0';
            cmi[key] = String(value);
            return 'true';
        },
        LMSCommit() {
            calls.push(['LMSCommit']);
            Object.assign(persisted, cmi);
            lastError = '0';
            return 'true';
        },
        LMSFinish() {
            calls.push(['LMSFinish']);
            if (cmi['cmi.core.lesson_status'] === 'not attempted') {
                cmi['cmi.core.lesson_status'] = 'completed';
            }
            Object.assign(persisted, cmi);
            initialized = false;
            lastError = '0';
            return 'true';
        },
        LMSGetLastError() {
            return lastError;
        },
        LMSGetErrorString() {
            return '';
        },
        LMSGetDiagnostic() {
            return '';
        },
        isInitialized: () => initialized,
    };
}

// A scored iDevice as the gamification helpers see it.
function createGame(overrides) {
    return Object.assign(
        {
            main: 'game',
            ideviceNumber: 1,
            ideviceId: 'idevice-1',
            title: 'Quiz',
            weighted: 100,
            scorerp: 0,
            isScorm: 1,
            gameStarted: false,
            gameOver: false,
            msgs: {
                msgScore: 'Score',
                msgWeight: 'Weight',
                msgYouScore: 'Your score',
                msgScoreScorm: '',
                msgEndGameScore: 'finish first',
                msgOnlySaveScore: 'only save',
            },
        },
        overrides,
    );
}

describe('SCORM 1.2 learner journey against a Moodle-like LMS', () => {
    let api;
    let scorm;

    beforeEach(() => {
        api = createMoodleApi();
        // The wrapper only looks for the API in a PARENT or opener window, never in its own, so
        // the SCO has to sit in a frame the way an LMS player runs it.
        Object.defineProperty(window, 'parent', { value: { API: api }, configurable: true });
        Object.defineProperty(window, 'top', { value: window, configurable: true });

        // Reset the SCO between journeys: loadPage is a no-op once pageLoaded is set, and
        // unloadPage is a no-op once exitPageStatus is set.
        scoFunctions._setPageLoaded(false);
        scoFunctions._setExitPageStatus(false);
        scoFunctions._setStartDate(0);
        scoFunctions._resetScormLifecycleState(window);

        // Reset the wrapper between journeys: it caches the API handle and the session flag.
        pipwerks.SCORM.API.handle = null;
        pipwerks.SCORM.API.isFound = false;
        pipwerks.SCORM.connection.isActive = false;
        pipwerks.SCORM.data.completionStatus = null;
        pipwerks.SCORM.data.exitStatus = null;
        pipwerks.SCORM.version = '1.2';
        pipwerks.debug.isActive = false;

        scorm = window.$exeDevices.iDevice.gamification.scorm;

        document.body.className = 'exe-export exe-scorm exe-scorm12';
        document.body.innerHTML = `
            <div class="idevice_node" id="idevice-1">
                <article>
                    <header><span class="box-title">Quiz</span></header>
                    <div id="game"></div>
                    <span class="Games-SendScore"></span>
                    <span class="Games-RepeatActivity"></span>
                </article>
            </div>
            <span id="eXeScoreNodeScore"></span>`;
    });

    afterEach(() => {
        // exe_export.js's setExe() replaces window.eXe with its own object, which does not carry
        // the members the shared vitest teardown clears. Put them back so it can run.
        if (window.eXe && window.eXe.app) {
            if (typeof window.eXe.app.clearHistory !== 'function') {
                window.eXe.app.clearHistory = () => {};
            }
            if (!window.eXe.app._confirmResponses) {
                window.eXe.app._confirmResponses = new Map();
            }
        }
        delete window.API;
        document.body.className = '';
        document.body.innerHTML = '';
    });

    it('persists the score and a live verdict as soon as the learner answers', () => {
        window.loadPage();
        expect(pipwerks.SCORM.connection.isActive).toBe(true);

        const game = createGame();
        scorm.registerActivity(game);

        // Opening the page must not have told the LMS anything about progress.
        expect(api.persisted['cmi.core.lesson_status']).toBeUndefined();

        // The learner starts the activity and answers: 7/10 on the only iDevice of the page.
        game.gameStarted = true;
        scorm.restartActivity(game);
        game.scorerp = 7;
        scorm.sendScoreNew(true, game);

        // The score and the verdict must have REACHED the LMS, not just the cmi object. The
        // activity is not finished (Estado: 1) but the status already follows the score.
        expect(api.persisted['cmi.core.score.raw']).toBe('70');
        expect(api.persisted['cmi.core.lesson_status']).toBe('passed');
        expect(api.persisted['cmi.suspend_data']).toContain('Estado: 1');
        // Nothing was rejected on the way.
        expect(api.calls.filter(([fn, key, value]) => fn === 'LMSSetValue' && key === 'cmi.core.lesson_status' && value === 'not attempted')).toEqual([]);
    });

    // The verdict follows the score on every save, in both directions. (#1831)
    it('moves from failed to passed as the learner keeps answering', () => {
        window.loadPage();
        const game = createGame();
        scorm.registerActivity(game);

        // Starting alone is already a verdict: 0 is below the threshold.
        game.gameStarted = true;
        scorm.restartActivity(game);
        expect(api.persisted['cmi.core.lesson_status']).toBe('failed');
        expect(api.persisted['cmi.core.score.raw']).toBe('0');

        // Still below 50.
        game.scorerp = 3;
        scorm.sendScoreNew(true, game);
        expect(api.persisted['cmi.core.lesson_status']).toBe('failed');
        expect(api.persisted['cmi.core.score.raw']).toBe('30');

        // Crossing the threshold flips it without the activity being finished.
        game.scorerp = 6;
        scorm.sendScoreNew(true, game);
        expect(api.persisted['cmi.core.lesson_status']).toBe('passed');
        expect(api.persisted['cmi.core.score.raw']).toBe('60');
        expect(api.persisted['cmi.suspend_data']).toContain('Estado: 1');
    });

    // "incomplete" now means one thing only: the learner never started. Restarting a finished
    // activity is a start, so it drops to failed with 0, not to incomplete. (#1831)
    it('drops a finished activity to failed with 0 when the learner restarts it', () => {
        window.loadPage();
        const game = createGame();
        scorm.registerActivity(game);

        game.gameStarted = true;
        game.gameOver = true;
        game.scorerp = 9;
        scorm.sendScoreNew(true, game);
        expect(api.persisted['cmi.core.lesson_status']).toBe('passed');

        game.gameOver = false;
        scorm.restartActivity(game);

        expect(api.persisted['cmi.core.lesson_status']).toBe('failed');
        expect(api.persisted['cmi.core.score.raw']).toBe('0');
    });

    it('persists passed once the learner finishes above 50', () => {
        window.loadPage();
        const game = createGame();
        scorm.registerActivity(game);

        game.gameStarted = true;
        scorm.restartActivity(game);
        game.scorerp = 8;
        scorm.sendScoreNew(true, game);

        game.gameOver = true;
        scorm.sendScoreNew(true, game);

        expect(api.persisted['cmi.core.lesson_status']).toBe('passed');
        expect(api.persisted['cmi.core.score.raw']).toBe('80');
    });

    it('persists failed once the learner finishes below 50', () => {
        window.loadPage();
        const game = createGame();
        scorm.registerActivity(game);

        game.gameStarted = true;
        scorm.restartActivity(game);
        game.gameOver = true;
        game.scorerp = 3;
        scorm.sendScoreNew(true, game);

        expect(api.persisted['cmi.core.lesson_status']).toBe('failed');
        expect(api.persisted['cmi.core.score.raw']).toBe('30');
    });

    it('records a page the learner never touched as incomplete, never as completed', () => {
        window.loadPage();
        const game = createGame();
        scorm.registerActivity(game);

        window.unloadPage(true);

        // Moodle promotes a SCO still in "not attempted" to "completed" inside LMSFinish, so a
        // page the learner never did would otherwise be reported as done.
        expect(api.persisted['cmi.core.lesson_status']).toBe('incomplete');
        expect(api.persisted['cmi.core.exit']).toBe('suspend');
    });

    // The regression that broke saving in a real Moodle: skipping LMSFinish on an untouched page
    // left the session open, the next SCO's LMSInitialize answered 101, and from that point the
    // wrapper never set connection.isActive -- so every write in the rest of the package was
    // silently dropped and every page read "not attempted". (#1831)
    it('leaves the session closed so the NEXT SCO can still save', () => {
        // SCO 1: opened, never touched, left.
        window.loadPage();
        scorm.registerActivity(createGame());
        window.unloadPage(true);
        expect(api.calls.some(([fn]) => fn === 'LMSFinish')).toBe(true);

        // SCO 2: a fresh page in the same player, where the learner does answer.
        scoFunctions._setPageLoaded(false);
        scoFunctions._setExitPageStatus(false);
        pipwerks.SCORM.connection.isActive = false;
        pipwerks.SCORM.data.completionStatus = null;
        pipwerks.SCORM.data.exitStatus = null;

        window.loadPage();
        expect(api.calls.filter(([, note]) => note === 'REJECTED 101')).toEqual([]);
        expect(pipwerks.SCORM.connection.isActive).toBe(true);

        const second = createGame({ title: 'Quiz 2' });
        scorm.registerActivity(second);
        second.gameStarted = true;
        scorm.restartActivity(second);
        second.scorerp = 9;
        scorm.sendScoreNew(true, second);

        expect(api.persisted['cmi.core.score.raw']).toBe('90');
        expect(api.persisted['cmi.core.lesson_status']).toBe('passed');
    });

    // Resumability follows whether the activity is finished, never the verdict. Deriving it from
    // the status closed the attempt as "normal" the moment the running score passed, so a learner
    // who left mid-activity came back to a fresh attempt with their progress gone. (#1831)
    it('leaves a half-finished page resumable even though it already reports passed', () => {
        window.loadPage();
        const game = createGame();
        scorm.registerActivity(game);

        game.gameStarted = true;
        scorm.restartActivity(game);
        game.scorerp = 9;
        scorm.sendScoreNew(true, game);
        expect(api.persisted['cmi.core.lesson_status']).toBe('passed');

        window.unloadPage(true);

        // SCORM 1.2 has no "normal"; SetExit maps it to "". The attempt must NOT end that way.
        expect(api.persisted['cmi.core.exit']).toBe('suspend');
        expect(api.persisted['cmi.suspend_data']).toContain('Estado: 1');
    });

    it('closes a finished page as non-resumable', () => {
        window.loadPage();
        const game = createGame();
        scorm.registerActivity(game);

        game.gameStarted = true;
        game.gameOver = true;
        game.scorerp = 9;
        scorm.sendScoreNew(true, game);

        window.unloadPage(true);

        expect(api.persisted['cmi.core.exit']).toBe('');
    });

    it('still closes the session when the learner did interact', () => {
        window.loadPage();
        const game = createGame();
        scorm.registerActivity(game);

        game.gameStarted = true;
        scorm.restartActivity(game);
        game.scorerp = 6;
        scorm.sendScoreNew(true, game);

        window.unloadPage(true);

        expect(api.calls.some(([fn]) => fn === 'LMSFinish')).toBe(true);
        expect(api.persisted['cmi.core.lesson_status']).toBe('passed');
    });
});
