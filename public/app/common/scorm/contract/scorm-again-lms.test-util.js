/**
 * LMS-side harness for the independent SCORM 1.2 contract suite (#2210).
 *
 * Wraps `scorm-again`'s Scorm12API — an independently implemented LMS-side
 * SCORM 1.2 API — so the eXeLearning content-side runtimes can be executed
 * against a second oracle that was NOT developed from the project's own
 * runtime contract. The wrapper records every SCO-visible API call together
 * with the LMS error state after the call, because that is the evidence the
 * comparison report needs (which calls were made, which were rejected).
 *
 * scorm-again is a TEST-ONLY dependency. It is not the SCORM specification:
 * assertions about normative behavior must be grounded in the SCORM 1.2 RTE
 * Book (see doc/architecture/changes/2210-scorm12-contract-tests/research.md);
 * this module only provides the second implementation and its observations.
 *
 * Settings policy: every setting below is pinned explicitly — even when it
 * matches the library default — so a future scorm-again default change cannot
 * silently alter the oracle. All values are the conservative "no LMS-side
 * policy" configuration; tests that need an LMS-side policy pass an override
 * and say so, or pick a named profile (`profile: 'moodle'`, see LMS_PROFILES)
 * whose rules are documented in one place instead of per scenario.
 */
import { Scorm12API } from 'scorm-again/scorm12';

/**
 * Conservative scorm-again configuration for contract testing.
 *
 * - autocommit: false        — no timer-driven LMSCommit; call order must be
 *                              exactly what the runtime produced.
 * - lmsCommitUrl: false      — no HTTP; commits stay in-memory + synchronous.
 * - logLevel: 5 (NONE)       — expected-failure probes would otherwise spam
 *                              the test output; raise locally when debugging.
 * - mastery_override: false  — the LMS must not rewrite lesson_status from
 *                              score vs mastery_score; eXe's own pass/fail
 *                              policy is under test.
 * - score_overrides_status: false — same family as mastery_override.
 * - autoCompleteLessonStatus: false — keep scorm-again's finish-time status
 *                              defaulting observable instead of emulating the
 *                              RTE "completed" rule (see research doc C5).
 * - selfReportSessionTime: false — the SCO's session_time writes are under
 *                              test and must land untouched.
 * - alwaysSendTotalTime/sendFullCommit: false — lean commit payloads.
 * - autoProgress: false      — no automatic navigation.
 * - strict_errors: true      — surface 403/404/405 as SCORM error codes;
 *                              relaxing would hide exactly what is under test.
 */
export const CONTRACT_LMS_SETTINGS = Object.freeze({
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
});

/**
 * scorm-again configuration of the 'moodle' profile: the conservative oracle
 * plus Moodle's `masteryoverride` (site default 1 — mod/scorm/settings.php,
 * MOODLE_405_STABLE :115-116), which scorm-again implements natively at
 * LMSFinish with the same conditions as Moodle's StoreData
 * (mod/scorm/datamodels/scorm_12.js :627-637: lesson_mode "normal", credit,
 * mastery_score and score.raw both present → "passed"/"failed" by comparison).
 */
export const MOODLE_LMS_SETTINGS = Object.freeze({ ...CONTRACT_LMS_SETTINGS, mastery_override: true });

/**
 * Finish-time rules of Moodle's mod_scorm (SCORM 1.2) that scorm-again has no
 * setting for. Applied by the recording facade after a SUCCESSFUL LMSFinish
 * only — after the SCO can no longer read anything — because that is what an
 * SCO observes of Moodle: the JS data model rewrites happen inside LMSFinish
 * and the server-side `scorm_insert_track` rewrites are never echoed back
 * into a running session (Moodle also applies them at every LMSCommit, but a
 * single in-memory model cannot express "changed in the database, unchanged
 * for the SCO", so the end-of-attempt state is what the profile models).
 *
 * @param {Scorm12API} api
 * @returns {Array<{rule: string, element: string, from: string, to: string}>}
 */
function applyMoodleFinishRules(api) {
    const core = api.cmi.core;
    const rewrites = [];
    // StoreData(cmi, true) on LMSFinish: an attempt still "not attempted" is
    // stored as "completed" (scorm_12.js :624-626). scorm-again's
    // autoCompleteLessonStatus cannot express this for an LMS-seeded attempt:
    // its lmsInitialize marks any pre-seeded status as "set by the module"
    // and the setting then never fires (pinned in scorm-again-lms.test.js).
    if (core.lesson_status === 'not attempted') {
        rewrites.push(statusRewrite('not-attempted-completed', core.lesson_status, 'completed'));
        core.lesson_status = 'completed';
    }
    // scorm_insert_track under forcecompleted (mod/scorm/locallib.php
    // :463-481, passed from datamodel.php :70-71 as $scorm->forcecompleted —
    // an activity setting whose site default is 0, settings.php :105-106):
    // once any cmi.core.score.raw is stored, an "incomplete" status becomes
    // "completed". This is the rule E05/E06 cite; the profile turns it on.
    if (core.lesson_status === 'incomplete' && core.score.raw !== '') {
        rewrites.push(statusRewrite('forcecompleted', core.lesson_status, 'completed'));
        core.lesson_status = 'completed';
    }
    return rewrites;
}

function statusRewrite(rule, from, to) {
    return { rule, element: 'cmi.core.lesson_status', from, to };
}

/**
 * Named LMS profiles for createContractLms().
 *
 * - conservative (default): validate but never rewrite — the configuration
 *   every contract scenario runs under unless it says otherwise.
 * - moodle: what Moodle's mod_scorm does to a SCORM 1.2 attempt, verified
 *   against MOODLE_405_STABLE — (a) a SCO write of "not attempted" is refused
 *   with 405 (scorm_12.js :38/:73; scorm-again does the same natively),
 *   (b) a second LMSInitialize answers "false" with 101 (scorm_12.js
 *   :172-195; native in scorm-again, journaled by the facade), (c) at
 *   LMSFinish an "incomplete" attempt that stored a score is promoted to
 *   "completed" (forcecompleted) and an untouched attempt to "completed",
 *   (d) masteryoverride: passed/failed by mastery_score vs score.raw.
 *   NOT modelled: browse-mode "browsed", per-commit application of (c),
 *   Moodle's grading (grademethod), attempt/track persistence, the
 *   suspend/resume entry computation, and everything SCORM 2004.
 */
export const LMS_PROFILES = Object.freeze({
    conservative: Object.freeze({ settings: CONTRACT_LMS_SETTINGS, afterFinish: null }),
    moodle: Object.freeze({ settings: MOODLE_LMS_SETTINGS, afterFinish: applyMoodleFinishRules }),
});

/**
 * Default learner/attempt seed. Mirrors what a real LMS initializes before
 * launch (RTE Book §3.4.4): lesson_status starts as "not attempted", entry as
 * "ab-initio" (scorm-again does not auto-manage entry — the embedding LMS
 * seeds it), mode "normal", credit granted. mastery_score is deliberately NOT
 * published by default (it is LMS-optional); tests that need one seed it.
 */
export function defaultCmiSeed() {
    return {
        cmi: {
            core: {
                student_id: 'exe-student-1',
                student_name: 'Student, Contract',
                lesson_status: 'not attempted',
                credit: 'credit',
                entry: 'ab-initio',
                lesson_mode: 'normal',
                total_time: '0000:00:00.00',
            },
            suspend_data: '',
            launch_data: '',
        },
    };
}

const STATE_METHODS = ['LMSInitialize', 'LMSFinish', 'LMSCommit', 'LMSGetValue', 'LMSSetValue'];
const ERROR_METHODS = ['LMSGetLastError', 'LMSGetErrorString', 'LMSGetDiagnostic'];

/**
 * Create a scorm-again LMS plus a recording facade suitable for `window.API`.
 *
 * @param {object} [options]
 * @param {'conservative'|'moodle'} [options.profile='conservative'] - named
 *   LMS profile (see LMS_PROFILES); selects the settings and the LMS-side
 *   finish-time rules.
 * @param {object} [options.cmi] - deep-merged over defaultCmiSeed().cmi
 * @param {object} [options.settings] - merged over the profile's settings;
 *   every use must be documented in the scenario that needs it.
 * @returns {{
 *   api: Scorm12API,
 *   profile: string,
 *   windowApi: object,     // recording facade to expose as window.API
 *   calls: Array<{method: string, args: string[], result: string, errorAfter: string}>,
 *   lmsRewrites: Array<{rule: string, element: string, from: string, to: string}>,
 * }} handle with inspection helpers
 */
export function createContractLms(options = {}) {
    const profileName = options.profile === undefined ? 'conservative' : options.profile;
    const profile = LMS_PROFILES[profileName];
    if (!profile) {
        throw new Error(
            `Unknown LMS profile "${profileName}"; expected one of: ${Object.keys(LMS_PROFILES).join(', ')}`,
        );
    }
    const api = new Scorm12API({ ...profile.settings, ...(options.settings || {}) });
    const seed = defaultCmiSeed();
    if (options.cmi) {
        mergeDeep(seed.cmi, options.cmi);
    }
    api.loadFromJSON(seed);

    const calls = [];
    // Status rewrites the LMS made on its own at LMSFinish (never journaled
    // as calls: the SCO did not send them). Empty under the conservative
    // profile unless scorm-again itself rewrote something.
    const lmsRewrites = [];
    const windowApi = {};
    for (const method of STATE_METHODS) {
        windowApi[method] = (...args) => {
            const statusBefore = api.cmi.core.lesson_status;
            const result = api[method](...args);
            const errorAfter = String(api.LMSGetLastError());
            calls.push({
                method,
                args: args.map(String),
                // SCORM 1.2 API arguments are strings; journal the real types
                // so a runtime passing raw numbers is observable evidence.
                argTypes: args.map(a => typeof a),
                result: String(result),
                errorAfter,
            });
            if (method === 'LMSFinish' && String(result) === 'true' && errorAfter === '0') {
                recordLibraryFinishRewrite(api, statusBefore, lmsRewrites);
                if (profile.afterFinish) {
                    lmsRewrites.push(...profile.afterFinish(api));
                }
            }
            return result;
        };
    }
    for (const method of ERROR_METHODS) {
        // Error functions are not journaled: the SCO may poll them freely and
        // per RTE §3.3.4 they do not change the error state.
        windowApi[method] = (...args) => api[method](...args);
    }

    const handle = {
        api,
        profile: profileName,
        windowApi,
        calls,
        lmsRewrites,
        /** Last SCORM error code as a string, e.g. '0', '405'. */
        lastError() {
            return String(api.LMSGetLastError());
        },
        /** Final LMS-side CMI tree (includes write-only elements). Note that
         *  scorm-again normalizes some stored values in this export (e.g.
         *  session_time); assert exact written strings via the call log. */
        cmi() {
            const dump = api.renderCommitCMI(true);
            return dump && dump.cmi ? dump.cmi : dump;
        },
        /** All LMSSetValue calls targeting one element. */
        writesTo(element) {
            return calls.filter(call => call.method === 'LMSSetValue' && call.args[0] === element);
        },
        /** Calls the LMS answered with a non-zero error code. */
        rejectedCalls() {
            return calls.filter(call => call.errorAfter !== '0');
        },
        /** Calls of one method, e.g. callsOf('LMSFinish'). */
        callsOf(method) {
            return calls.filter(call => call.method === method);
        },
        /**
         * Index marking "everything up to here is out of scope". Scenarios
         * whose subject is NOT the launch sequence checkpoint after
         * loadPage() so a launch-time defect is only counted by the launch
         * scenarios and not by every later assertion.
         */
        checkpoint() {
            return calls.length;
        },
        /** Calls recorded after a checkpoint. */
        callsSince(index) {
            return calls.slice(index);
        },
        /** Value the LMS holds for a dotted cmi path, via the JSON export. */
        stored(path) {
            let node = handle.cmi();
            for (const part of path.replace(/^cmi\./, '').split('.')) {
                if (node == null) return undefined;
                node = node[part];
            }
            return node;
        },
    };
    return handle;
}

/**
 * Expose the LMS on a fake window tree so that pipwerks-style discovery
 * (climb window.parent, then window.top.opener — never the SCO window
 * itself) finds it, mirroring how a real LMS frames the SCO.
 *
 * The returned tree is deliberately minimal: the SCO-side runtimes only walk
 * parent/opener links and read the API object. Extra properties (a decoy
 * `API_1484_11`, …) can be added by the caller via `extras` for discovery
 * scenarios.
 *
 * @param {object} windowApi - the recording facade (window.API contents)
 * @param {object} [extras] - additional properties for the LMS window
 * @returns {{ scoWindow: object, lmsWindow: object }}
 */
export function createLmsWindowTree(windowApi, extras = {}) {
    const lmsWindow = { API: windowApi, ...extras };
    lmsWindow.parent = lmsWindow;
    lmsWindow.top = lmsWindow;
    const scoWindow = { parent: lmsWindow };
    scoWindow.top = lmsWindow;
    return { scoWindow, lmsWindow };
}

/**
 * scorm-again rewrites lesson_status inside a terminating storeData() when
 * mastery_override (or its own finish-time defaulting) applies. Name the rule
 * from the observable conditions so scenarios can assert on it.
 */
function recordLibraryFinishRewrite(api, statusBefore, lmsRewrites) {
    const statusAfter = api.cmi.core.lesson_status;
    if (statusAfter === statusBefore) return;
    const masteryApplies =
        api.settings.mastery_override === true &&
        api.cmi.student_data.mastery_score !== '' &&
        api.cmi.core.score.raw !== '';
    lmsRewrites.push(
        statusRewrite(masteryApplies ? 'masteryoverride' : 'scorm-again-finish-default', statusBefore, statusAfter),
    );
}

function mergeDeep(target, source) {
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            mergeDeep(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}
