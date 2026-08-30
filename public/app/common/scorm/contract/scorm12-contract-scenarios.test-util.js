/**
 * Shared SCORM 1.2 contract scenarios (#2210).
 *
 * One scenario list, executed verbatim against BOTH content-side runtimes:
 *   - legacy:  public/app/common/scorm/SCORM_API_wrapper.js + SCOFunctions.js
 *              (the pre-#2209 SCORM 1.2 runtime; no longer packaged for
 *              SCORM 1.2, still shipped by the SCORM 2004 exporter)
 *   - rewrite: public/app/common/scorm/scorm12/* (the in-tree SCORM 1.2
 *              runtime, PR #2209)
 *
 * Both variants run under scorm-again's Scorm12API: this suite is a SCORM 1.2
 * oracle only and says nothing about SCORM 2004 behavior.
 *
 * Each scenario drives the runtime through the variant-specific `driver`
 * (built in scorm12-contract.legacy.test.js / scorm12-contract.rewrite.test.js)
 * against a scorm-again LMS and then asserts the CONTRACT expectation — the
 * behavior grounded in the SCORM 1.2 RTE Book and/or the documented eXe
 * policy (see doc/architecture/changes/2210-scorm12-contract-tests/research.md
 * for the per-scenario grounding).
 *
 * Known deviations are encoded per runtime in `deviations`. A deviation entry
 * does NOT weaken the contract: the runner first proves the contract
 * assertion still FAILS for that runtime (so a stale entry breaks the build),
 * then asserts the precisely documented actual behavior (so any behavior
 * change breaks the build too). Nothing is skipped; the comparison report is
 * generated from these records.
 *
 * Deviation records also carry a machine-readable `origin`:
 *   'runtime'       — the SCORM runtime files themselves
 *   'page-wiring'   — the exported page (PageRenderer attributes, exe_export)
 *   'content-layer' — the shipped games layer (common.js)
 *
 * Registry internals of the rewrite (aggregation algorithm, suspend_data
 * compaction, payload migration) are deliberately delegated to the scorm12
 * layer unit tests; E04 exercises the registry-engaged completion path
 * end-to-end through the production content shapes, and the remaining 40+
 * scenarios certify the shared page/facade surface.
 *
 * Classification values (mirrors the report):
 *   'legacy-defect'   — violates SCORM 1.2, contradicts the runtime's own
 *                       explicit write/intent (e.g. its SetExit value being
 *                       overwritten by its own terminate), or causes
 *                       demonstrable data/behavior harm on a conformant LMS
 *   'rewrite-defect'  — same, with legacy correct
 *   'policy-difference'      — a spec-legal alternative choice that only the
 *                       documented eXe policy decides against
 *   'scorm-again-difference' — an implementation choice of the scorm-again oracle
 *   'spec-uncertain'         — SCORM 1.2 does not decide the point
 */
import { expect } from 'vitest';

/**
 * Parse a CMITimespan (HHHH:MM:SS.SS) into milliseconds.
 */
export function timespanToMs(value) {
    const match = /^(\d+):(\d{2}):(\d{2})(\.\d{1,2})?$/.exec(String(value));
    if (!match) return Number.NaN;
    const [, h, m, s, frac] = match;
    return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Math.round(Number(frac || 0) * 1000);
}

function rejectedWrites(lms, since = 0) {
    return lms.callsSince(since).filter(call => call.method === 'LMSSetValue' && call.errorAfter !== '0');
}

/** Strict CMITimespan shape per RTE §3.4.5: 2-4 digit hours, 2-digit minutes/seconds. */
const STRICT_TIMESPAN = /^\d{2,4}:\d{2}:\d{2}(\.\d{1,2})?$/;

export const CONTRACT_SCENARIOS = [
    // =====================================================================
    // Lifecycle
    // =====================================================================
    {
        id: 'S01',
        area: 'lifecycle',
        title: 'LMSInitialize("") succeeds exactly once on launch',
        expectation: 'One LMSInitialize call with the empty-string parameter, answered "true" (RTE §3.3.2.1).',
        run({ driver }) {
            driver.loadPage();
        },
        verify({ lms }) {
            const inits = lms.callsOf('LMSInitialize');
            expect(inits).toHaveLength(1);
            expect(inits[0].args).toEqual(['']);
            expect(inits[0].result).toBe('true');
            expect(inits[0].errorAfter).toBe('0');
        },
    },
    {
        id: 'S04',
        area: 'lifecycle',
        title: 'non-empty LMSInitialize parameter is an error; the runtime always passes ""',
        expectation:
            'LMSInitialize takes "" only; a non-empty argument is error 201 (RTE §3.3.2.1/§3.3.3). The runtime must never send one.',
        run({ driver, lms }) {
            // Harness probe of the oracle: a broken launcher would get 201.
            lms.windowApi.LMSInitialize('init');
            driver.loadPage();
        },
        verify({ lms }) {
            const inits = lms.callsOf('LMSInitialize');
            expect(inits).toHaveLength(2);
            expect(inits[0].args).toEqual(['init']);
            // The 201 code is normative (§3.3.3 example); the spec does not
            // fix the returned boolean, so it is deliberately not asserted.
            expect(inits[0].errorAfter).toBe('201');
            // The runtime's own call used the conformant empty string.
            expect(inits[1].args).toEqual(['']);
            expect(inits[1].result).toBe('true');
        },
    },
    {
        id: 'S05',
        area: 'lifecycle',
        title: 'non-empty LMSCommit parameter is an error; the runtime always passes ""',
        expectation: 'LMSCommit takes "" only; a non-empty argument is error 201 (RTE §3.3.2.1/§3.3.3).',
        run({ driver, lms }) {
            driver.loadPage();
            lms.windowApi.LMSCommit('now'); // harness probe of the oracle
            driver.advanceClock(5_000);
            driver.endSessionViaPageExit({ scored: false });
        },
        verify({ lms }) {
            const commits = lms.callsOf('LMSCommit');
            const probe = commits.find(call => call.args[0] === 'now');
            expect(probe).toBeDefined();
            expect(probe.errorAfter).toBe('201');
            // Every commit issued by the runtime used the empty string.
            for (const call of commits.filter(c => c !== probe)) {
                expect(call.args).toEqual(['']);
                expect(call.errorAfter).toBe('0');
            }
        },
    },
    {
        id: 'S06',
        area: 'lifecycle',
        title: 'non-empty LMSFinish parameter is an error; the runtime always passes ""',
        expectation:
            'LMSFinish takes "" only; a non-empty argument is error 201 and does not terminate (RTE §3.3.2.1/§3.3.3).',
        run({ driver, lms }) {
            driver.loadPage();
            lms.windowApi.LMSFinish('bye'); // harness probe of the oracle
            driver.advanceClock(5_000);
            driver.endSessionViaPageExit({ scored: false });
        },
        verify({ lms }) {
            const finishes = lms.callsOf('LMSFinish');
            const probe = finishes.find(call => call.args[0] === 'bye');
            expect(probe).toBeDefined();
            expect(probe.errorAfter).toBe('201');
            // The rejected finish did not terminate: the runtime's own
            // session end afterwards succeeded with the empty string.
            const own = finishes.filter(c => c !== probe);
            expect(own).toHaveLength(1);
            expect(own[0].args).toEqual(['']);
            expect(own[0].result).toBe('true');
            expect(own[0].errorAfter).toBe('0');
        },
    },
    {
        id: 'S07',
        area: 'lifecycle',
        title: 'runtime operations before initialization produce no LMS traffic',
        expectation:
            'Any data-model call before LMSInitialize is error 301 (RTE §3.3.3); the runtime must guard locally and send nothing.',
        run({ driver }) {
            driver.computeTime();
            driver.ext.SetCompletionStatus('completed');
            driver.facade.set('cmi.core.score.raw', '50');
            driver.facade.get('cmi.core.lesson_status');
        },
        verify({ lms }) {
            expect(lms.calls).toEqual([]);
            // Oracle sanity: had the runtime let a call through, it would be 301.
            expect(lms.windowApi.LMSGetValue('cmi.core.lesson_status')).toBe('');
            expect(lms.lastError()).toBe('301');
            expect(lms.windowApi.LMSSetValue('cmi.core.lesson_status', 'completed')).toBe('false');
            expect(lms.lastError()).toBe('301');
        },
    },
    {
        id: 'S08',
        area: 'lifecycle',
        title: 'runtime operations after termination produce no further LMS traffic',
        expectation:
            'After LMSFinish the SCO may no longer call API functions (RTE §3.3.2.1); the runtime must guard locally. ' +
            'Note: SCORM 1.2 assigns no error code to this case, and scorm-again 3.3.0 would even accept the calls — ' +
            'the runtime-side guard is the only real protection.',
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(5_000);
            driver.endSessionViaPageExit({ scored: false });
            const before = driver;
            before.ext.SetCompletionStatus('incomplete');
            before.facade.set('cmi.core.score.raw', '10');
            before.facade.get('cmi.core.lesson_status');
            before.computeTime();
        },
        verify({ lms }) {
            const finishIndex = lms.calls.findIndex(call => call.method === 'LMSFinish');
            expect(finishIndex).toBeGreaterThan(-1);
            expect(lms.calls.slice(finishIndex + 1)).toEqual([]);
        },
    },
    {
        id: 'S09',
        area: 'lifecycle',
        title: 'repeated quit/unload calls terminate the session exactly once',
        expectation: 'LMSFinish is issued at most once per page lifetime; later exit paths are inert.',
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(5_000);
            driver.doQuit();
            driver.doQuit();
            driver.unloadPageOnly(false);
        },
        verify({ lms }) {
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
            expect(lms.callsOf('LMSInitialize')).toHaveLength(1);
        },
    },
    {
        id: 'S10',
        area: 'lifecycle',
        title: 'the production page-exit sequence terminates the session exactly once',
        expectation:
            'The exported page fires several unload-family handlers; only one LMSFinish (and its commit) may reach the LMS.',
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(5_000);
            driver.endSessionViaPageExit({ scored: false });
            driver.unloadPageOnly(false); // stray late handler
        },
        verify({ lms }) {
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
        },
    },
    {
        id: 'S43',
        area: 'lifecycle',
        title: 'a second LMSInitialize is refused with 101 and the runtime keeps working',
        expectation:
            'LMSInitialize is called once per SCO launch (RTE §3.3.2.1); an LMS answers a repeat with "false" and a ' +
            'non-zero error — 101 is CTS/Moodle/oracle practice, the RTE names no specific code. The refusal must not ' +
            'disturb the session the runtime already owns: a later write is still accepted and the page still ends ' +
            'with exactly one successful LMSFinish.',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            // Harness probe of the oracle: a launcher (or a second copy of the
            // runtime) re-initializing the session the runtime already opened.
            lms.windowApi.LMSInitialize('');
            const afterProbe = lms.checkpoint();
            driver.facade.set('cmi.core.score.raw', '60');
            driver.advanceClock(5_000);
            driver.endSessionViaPageExit({ scored: false });
            return { afterLaunch, afterProbe };
        },
        verify({ lms, observations }) {
            const inits = lms.callsOf('LMSInitialize');
            expect(inits).toHaveLength(2);
            expect(inits[1].result).toBe('false');
            expect(inits[1].errorAfter).toBe('101');
            // The runtime's own session survived the refusal.
            const scoreWrites = lms
                .callsSince(observations.afterProbe)
                .filter(c => c.method === 'LMSSetValue' && c.args[0] === 'cmi.core.score.raw');
            expect(scoreWrites.map(c => c.errorAfter)).toEqual(['0']);
            expect(lms.stored('core.score.raw')).toBe('60');
            const finishes = lms.callsOf('LMSFinish');
            expect(finishes).toHaveLength(1);
            expect(finishes[0].errorAfter).toBe('0');
        },
    },
    {
        id: 'E01',
        area: 'lifecycle',
        title: 'the exported page calls loadPage() twice; the second call must be harmless',
        expectation:
            'On main, <body onload="loadPage()"> and exe_export initScorm() BOTH call loadPage(). The second call must not ' +
            're-initialize, must not produce invalid writes, and must not reset the session clock.',
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(60_000);
            driver.loadPage();
            driver.advanceClock(30_000);
            driver.endSessionViaPageExit({ scored: false });
        },
        verify({ lms }) {
            expect(lms.callsOf('LMSInitialize')).toHaveLength(1);
            expect(rejectedWrites(lms)).toEqual([]);
            const writes = lms.writesTo('cmi.core.session_time');
            expect(writes.length).toBeGreaterThan(0);
            const reported = timespanToMs(writes[writes.length - 1].args[1]);
            expect(Math.abs(reported - 90_000)).toBeLessThanOrEqual(20);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'page-wiring',
                reason:
                    'The second loadPage() does not re-initialize (pipwerks guards that), but it repeats the invalid ' +
                    '"not attempted" write (S02) and restarts the session timer, so the reported session_time only covers ' +
                    'the time after the LAST loadPage() call — 30 s instead of 90 s in this scenario. Both loadPage() ' +
                    'calls really happen on every exported page (body onload attribute plus exe_export initScorm); in ' +
                    'production the two calls are separated by the DOM-ready-to-window-load interval (typically ' +
                    'sub-second to a few seconds), so the shipped loss is the page-load gap, not the 60 s this probe ' +
                    'uses to make it observable.',
                verify({ lms }) {
                    expect(lms.callsOf('LMSInitialize')).toHaveLength(1);
                    const rejected = rejectedWrites(lms);
                    expect(rejected.map(call => call.args)).toEqual([
                        ['cmi.core.lesson_status', 'not attempted'],
                        ['cmi.core.lesson_status', 'not attempted'],
                    ]);
                    const writes = lms.writesTo('cmi.core.session_time');
                    const reported = timespanToMs(writes[writes.length - 1].args[1]);
                    expect(Math.abs(reported - 30_000)).toBeLessThanOrEqual(20);
                },
            },
        },
    },
    {
        id: 'S02',
        area: 'lifecycle',
        title: 'first launch from "not attempted" reaches "incomplete" without invalid writes',
        expectation:
            'eXe policy: a fresh attempt becomes "incomplete". SCORM: the SCO must never write "not attempted" (RTE §3.4.4 ' +
            'SCO usage; the refusal duty is Conformance Requirements 1.6.5 — the RTE prints no specific code, 405 is ' +
            'CTS/oracle practice).',
        run({ driver }) {
            driver.loadPage();
        },
        verify({ lms }) {
            expect(lms.stored('core.lesson_status')).toBe('incomplete');
            expect(rejectedWrites(lms)).toEqual([]);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'loadPage() calls SetCompletionStatus("unknown"); the wrapper maps "unknown" to "not attempted" for 1.2 ' +
                    'and writes it. A SCO may never write "not attempted" (RTE §3.4.4 SCO usage) — a strict LMS refuses it ' +
                    'with 405, and the attempt only shows "incomplete" because the pipwerks auto-promotion ran first. On a ' +
                    'lenient LMS the write lands and the fresh attempt shows "not attempted". Fixed in the rewrite (entry ' +
                    'policy writes "incomplete" once).',
                verify({ lms }) {
                    expect(lms.stored('core.lesson_status')).toBe('incomplete');
                    const rejected = rejectedWrites(lms);
                    expect(rejected.map(call => call.args)).toEqual([['cmi.core.lesson_status', 'not attempted']]);
                    expect(rejected[0].errorAfter).toBe('405');
                },
            },
        },
    },
    {
        id: 'S03',
        area: 'lifecycle',
        title: 'resume from "incomplete" preserves the stored status without invalid writes',
        expectation:
            'eXe policy: an existing status is never downgraded on entry. The launch must not depend on the LMS rejecting an invalid write to keep the data safe.',
        lmsOptions: {
            cmi: { core: { lesson_status: 'incomplete', entry: 'resume' } },
        },
        run({ driver }) {
            driver.loadPage();
        },
        verify({ lms }) {
            expect(lms.stored('core.lesson_status')).toBe('incomplete');
            expect(rejectedWrites(lms)).toEqual([]);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'Same invalid write as S02: on every launch the runtime tries to reset cmi.core.lesson_status to ' +
                    '"not attempted". Resumed "incomplete" progress survives only because the strict LMS answers 405; a ' +
                    'lenient LMS would silently destroy the stored progress.',
                verify({ lms }) {
                    expect(lms.stored('core.lesson_status')).toBe('incomplete');
                    const rejected = rejectedWrites(lms);
                    expect(rejected.map(call => call.args)).toEqual([['cmi.core.lesson_status', 'not attempted']]);
                    expect(rejected[0].errorAfter).toBe('405');
                },
            },
        },
    },

    // =====================================================================
    // Status
    // =====================================================================
    {
        id: 'S13',
        area: 'status',
        title: 'unscored page: leaving the page completes the attempt with a normal exit',
        expectation:
            'eXe policy: a page without scored activities is "completed" on exit, cmi.core.exit is "" (normal), and the session terminates exactly once.',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            driver.advanceClock(30_000);
            driver.endSessionViaPageExit({ scored: false });
            return { afterLaunch };
        },
        verify({ lms, observations }) {
            expect(lms.stored('core.lesson_status')).toBe('completed');
            const exitWrites = lms.writesTo('cmi.core.exit');
            expect(exitWrites.length).toBeGreaterThan(0);
            expect(exitWrites[exitWrites.length - 1].args[1]).toBe('');
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
            // LMSFinish implies persistence (RTE §3.3.2.1), but eXe policy
            // commits explicitly before finishing.
            const lastCommit = lms.calls.map(c => c.method).lastIndexOf('LMSCommit');
            const finishIndex = lms.calls.findIndex(c => c.method === 'LMSFinish');
            expect(lastCommit).toBeGreaterThan(-1);
            expect(lastCommit).toBeLessThan(finishIndex);
            expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'The status ladder works, but the exit value does not follow the eXe terminal-exit policy: doQuit() ' +
                    'writes exit "suspend", then the wrapper\'s handleExitMode block inside connection.terminate() ' +
                    'overwrites it with "logout" because the cached completion status is terminal. "logout" tells the LMS ' +
                    'the learner logged out of the whole session (RTE §3.4.4) — not what closing a completed page means. ' +
                    'The overwrite also lands AFTER the last LMSCommit, so it reaches the LMS uncommitted (spec-legal: ' +
                    'LMSFinish implies persistence, RTE §3.3.2.1).',
                verify({ lms }) {
                    expect(lms.stored('core.lesson_status')).toBe('completed');
                    expect(lms.writesTo('cmi.core.exit').map(call => call.args[1])).toEqual(['suspend', 'logout']);
                    expect(lms.callsOf('LMSFinish')).toHaveLength(1);
                },
            },
        },
    },
    {
        id: 'S14',
        area: 'status',
        title: 'scored page with unanswered activities: leaving keeps "incomplete" and suspends',
        expectation:
            'eXe policy: a page with scored activities that were not completed stays "incomplete" and exits with "suspend" so the attempt can resume.',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            driver.advanceClock(30_000);
            driver.endSessionViaPageExit({ scored: true });
            return { afterLaunch };
        },
        verify({ lms, observations }) {
            expect(lms.stored('core.lesson_status')).toBe('incomplete');
            const exitWrites = lms.writesTo('cmi.core.exit');
            expect(exitWrites.length).toBeGreaterThan(0);
            expect(exitWrites[exitWrites.length - 1].args[1]).toBe('suspend');
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
            expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'page-wiring',
                reason:
                    'The exported page fires unloadPage() (no argument) from the body onbeforeunload/onunload attributes ' +
                    'BEFORE exe_export\'s unloadPage(isSCORM) listener. The first call defaults isSCORM to false and marks ' +
                    'the scored page "completed"; the flagged call afterwards is a no-op (exitPageStatus guard). The ' +
                    'terminal cache then makes handleExitMode write exit "logout", so the attempt can no longer resume.',
                verify({ lms }) {
                    expect(lms.stored('core.lesson_status')).toBe('completed');
                    expect(lms.writesTo('cmi.core.exit').map(call => call.args[1])).toEqual(['suspend', 'logout']);
                    expect(lms.callsOf('LMSFinish')).toHaveLength(1);
                },
            },
        },
    },

    // =====================================================================
    // Session time
    // =====================================================================
    {
        id: 'S22',
        area: 'session-time',
        title: 'generated cmi.core.session_time is accepted and matches the elapsed session',
        expectation:
            'CMITimespan HHHH:MM:SS.SS accepted by the LMS (RTE §3.4.4/§3.4.5) and equal to the time actually spent (±20 ms).',
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(3_661_500); // 1h 1m 1.5s
            driver.endSessionViaPageExit({ scored: false });
        },
        verify({ lms }) {
            const writes = lms.writesTo('cmi.core.session_time');
            expect(writes.length).toBeGreaterThan(0);
            const last = writes[writes.length - 1];
            expect(last.result).toBe('true');
            expect(last.errorAfter).toBe('0');
            expect(Math.abs(timespanToMs(last.args[1]) - 3_661_500)).toBeLessThanOrEqual(20);
        },
    },
    {
        id: 'S23',
        area: 'session-time',
        title: 'the LMS rejects malformed session_time; the runtime only emits strict CMITimespan',
        expectation:
            'CMITimespan requires 2-4 digit hours and exactly 2-digit minutes/seconds (RTE §3.4.5); malformed values are error 405.',
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(59_990);
            driver.endSessionViaPageExit({ scored: false });
        },
        verify({ lms }) {
            // Snapshot the runtime's own writes before probing the oracle.
            const runtimeWrites = lms.writesTo('cmi.core.session_time');
            expect(runtimeWrites.length).toBeGreaterThan(0);
            // Runtime output stays inside the strict grammar (scorm-again
            // itself would also accept 1-digit hour fields — do not rely on it).
            for (const call of runtimeWrites) {
                expect(call.args[1]).toMatch(STRICT_TIMESPAN);
            }
            // Oracle sanity: a malformed value is refused with 405.
            expect(lms.windowApi.LMSSetValue('cmi.core.session_time', '10:0:0')).toBe('false');
            expect(lms.lastError()).toBe('405');
        },
    },
    {
        id: 'S24',
        area: 'session-time',
        title: 'a very short session reports its real duration',
        expectation: 'The reported CMITimespan equals the elapsed session time (±20 ms), including the fraction digits.',
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(30_040); // 30.04 s — exposes fraction handling
            driver.endSessionViaPageExit({ scored: false });
        },
        verify({ lms }) {
            const writes = lms.writesTo('cmi.core.session_time');
            expect(writes.length).toBeGreaterThan(0);
            const last = writes[writes.length - 1];
            expect(last.errorAfter).toBe('0');
            expect(Math.abs(timespanToMs(last.args[1]) - 30_040)).toBeLessThanOrEqual(20);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'The 1.2 formatter appends the hundredths without zero-padding: 30.04 s becomes "0000:00:30.4", which ' +
                    'a conformant LMS must parse as 30.4 s — a tenfold inflation of the fraction whenever hundredths < 10. ' +
                    'The string is grammatically valid, so no LMS will reject it; the stored duration is simply wrong.',
                verify({ lms }) {
                    const writes = lms.writesTo('cmi.core.session_time');
                    const last = writes[writes.length - 1];
                    expect(last.args[1]).toBe('0000:00:30.4');
                    expect(last.errorAfter).toBe('0');
                    expect(timespanToMs(last.args[1])).toBe(30_400);
                },
            },
        },
    },
    {
        id: 'S25',
        area: 'session-time',
        title: 'a longer session reports its real duration',
        expectation: 'The reported CMITimespan equals the elapsed session time (±20 ms).',
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(7_200_330); // 2h 0m 0.33s
            driver.endSessionViaPageExit({ scored: false });
        },
        verify({ lms }) {
            const writes = lms.writesTo('cmi.core.session_time');
            expect(writes.length).toBeGreaterThan(0);
            const last = writes[writes.length - 1];
            expect(last.errorAfter).toBe('0');
            expect(Math.abs(timespanToMs(last.args[1]) - 7_200_330)).toBeLessThanOrEqual(20);
        },
    },

    // =====================================================================
    // Status (continued)
    // =====================================================================
    {
        id: 'S11',
        area: 'status',
        title: 'the entry transition writes exactly one "incomplete" status',
        expectation:
            'eXe policy: ""/"not attempted" becomes "incomplete" through a single valid LMSSetValue; no other status write happens at entry.',
        run({ driver }) {
            driver.loadPage();
        },
        verify({ lms }) {
            const statusWrites = lms.writesTo('cmi.core.lesson_status');
            expect(statusWrites.map(call => call.args[1])).toEqual(['incomplete']);
            expect(statusWrites[0].result).toBe('true');
            expect(statusWrites[0].errorAfter).toBe('0');
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'Entry produces two status writes: the pipwerks auto-promotion to "incomplete" and then the invalid ' +
                    '"not attempted" write from loadPage() (rejected 405 by the strict LMS). See S02.',
                verify({ lms }) {
                    const statusWrites = lms.writesTo('cmi.core.lesson_status');
                    expect(statusWrites.map(call => call.args[1])).toEqual(['incomplete', 'not attempted']);
                    expect(statusWrites[0].errorAfter).toBe('0');
                    expect(statusWrites[1].errorAfter).toBe('405');
                },
            },
        },
    },
    {
        id: 'S12',
        area: 'status',
        title: 'resumed "incomplete" progress survives leaving a scored page unanswered',
        expectation:
            'eXe policy: an attempt resumed as "incomplete" whose scored activities remain unanswered stays "incomplete" after exit.',
        lmsOptions: {
            cmi: { core: { lesson_status: 'incomplete', entry: 'resume' } },
        },
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            driver.advanceClock(10_000);
            driver.endSessionViaPageExit({ scored: true });
            return { afterLaunch };
        },
        verify({ lms, observations }) {
            expect(lms.stored('core.lesson_status')).toBe('incomplete');
            expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'page-wiring',
                reason:
                    'Same wiring defect as S14, now destroying resumed progress: the argument-less unloadPage() from the ' +
                    'body attributes marks the resumed scored page "completed" before the flagged handler runs.',
                verify({ lms }) {
                    expect(lms.stored('core.lesson_status')).toBe('completed');
                    expect(lms.writesTo('cmi.core.exit').map(call => call.args[1])).toEqual(['suspend', 'logout']);
                    expect(lms.callsOf('LMSFinish')).toHaveLength(1);
                },
            },
        },
    },
    {
        id: 'S14b',
        area: 'status',
        title: 'runtime-level unloadPage(true) alone keeps a scored page "incomplete"',
        expectation:
            'Calling the runtime surface directly with the scored flag (best case, without the exported page\'s ' +
            'extra no-argument unload handlers) must keep the attempt "incomplete".',
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(10_000);
            driver.unloadPageOnly(true);
        },
        verify({ lms }) {
            expect(lms.stored('core.lesson_status')).toBe('incomplete');
            const exitWrites = lms.writesTo('cmi.core.exit');
            expect(exitWrites[exitWrites.length - 1].args[1]).toBe('suspend');
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
        },
    },
    {
        id: 'S15',
        area: 'status',
        title: 'a terminal status set by content survives the page exit',
        expectation: 'eXe policy: content-set "passed" is never downgraded by the exit path.',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            driver.facade.set('cmi.core.lesson_status', 'passed');
            driver.advanceClock(10_000);
            driver.endSessionViaPageExit({ scored: true });
            return { afterLaunch };
        },
        verify({ lms, observations }) {
            expect(lms.stored('core.lesson_status')).toBe('passed');
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
            expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
        },
    },
    {
        id: 'S16',
        area: 'status',
        title: 'every SCO-writable lesson_status value is accepted through the scorm facade',
        expectation:
            'Vocabulary "passed|completed|failed|incomplete|browsed" is valid for a SCO write (RTE §3.4.4); each write must land.',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            const storedAfterEach = [];
            for (const value of ['passed', 'completed', 'failed', 'incomplete', 'browsed']) {
                driver.facade.set('cmi.core.lesson_status', value);
                storedAfterEach.push(lms.stored('core.lesson_status'));
            }
            return { afterLaunch, storedAfterEach };
        },
        verify({ lms, observations }) {
            expect(observations.storedAfterEach).toEqual(['passed', 'completed', 'failed', 'incomplete', 'browsed']);
            expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
        },
    },
    {
        id: 'S16b',
        area: 'status',
        title: 'every SCO-writable lesson_status value is forwarded by SetCompletionStatus',
        expectation:
            'The pipwerks.SCORM.SetCompletionStatus extension must forward all five SCO-writable vocabulary values; ' +
            'silently dropping a value loses data.',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            const storedAfterEach = [];
            for (const value of ['passed', 'completed', 'failed', 'incomplete', 'browsed']) {
                driver.ext.SetCompletionStatus(value);
                storedAfterEach.push(lms.stored('core.lesson_status'));
            }
            return { afterLaunch, storedAfterEach };
        },
        verify({ lms, observations }) {
            expect(observations.storedAfterEach).toEqual(['passed', 'completed', 'failed', 'incomplete', 'browsed']);
            expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'The wrapper\'s SetCompletionStatus vocabulary switch has no case for "passed" or "failed" in 1.2 — ' +
                    'both fall into the default branch and are silently dropped (trace + return, no LMS write). The ' +
                    'wrapper routes pass/fail through the sibling SetSuccessStatus channel instead, but that function\'s ' +
                    'version switch has no "1.2" case and writes nothing either, so neither channel can record pass/fail. ' +
                    'No current production caller uses SetCompletionStatus for pass/fail (the games layer writes ' +
                    'cmi.core.lesson_status directly), which is why this stayed hidden.',
                verify({ lms, observations }) {
                    const forwarded = lms
                        .callsSince(observations.afterLaunch)
                        .filter(call => call.method === 'LMSSetValue' && call.args[0] === 'cmi.core.lesson_status')
                        .map(call => call.args[1]);
                    expect(forwarded).toEqual(['completed', 'incomplete', 'browsed']);
                    expect(observations.storedAfterEach).toEqual([
                        'incomplete',
                        'completed',
                        'completed',
                        'incomplete',
                        'browsed',
                    ]);
                },
            },
        },
    },
    {
        id: 'S17',
        area: 'status',
        title: 'invalid lesson_status values never reach the stored state',
        expectation:
            'Vocabulary is case sensitive and closed (RTE §3.3.3/§3.4.4): an invalid value must not be stored, whether the ' +
            'runtime rejects it locally or the LMS answers 405.',
        run({ driver }) {
            driver.loadPage();
            driver.facade.set('cmi.core.lesson_status', 'Completed');
            driver.facade.set('cmi.core.lesson_status', 'finished');
            driver.ext.SetCompletionStatus('done');
        },
        verify({ lms }) {
            expect(lms.stored('core.lesson_status')).toBe('incomplete');
        },
    },

    // =====================================================================
    // Score
    // =====================================================================
    {
        id: 'S18',
        area: 'score',
        title: 'a valid raw score is stored',
        expectation: 'cmi.core.score.raw accepts a normalized 0-100 CMIDecimal (RTE §3.4.4).',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            driver.reportScore(85, 100, 0);
            return { afterLaunch };
        },
        verify({ lms, observations }) {
            expect(lms.stored('core.score.raw')).toBe('85');
            expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
            // The SCORM 1.2 API takes string arguments; values must cross the
            // boundary as strings (scorm-again coerces silently, real LMS API
            // adapters have not always been so forgiving).
            for (const call of lms.callsSince(observations.afterLaunch).filter(c => c.method === 'LMSSetValue')) {
                expect(call.argTypes, `${call.args[0]} argument types`).toEqual(['string', 'string']);
            }
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'The stored end state is correct, but every score value crosses the LMS API boundary as a raw ' +
                    'NUMBER: the games layer passes numbers (common.js:900-901, :1362) and the wrapper extensions ' +
                    'forward them unconverted to LMSSetValue. The SCORM 1.2 API takes string arguments; scorm-again ' +
                    'coerces silently, but stricter LMS API adapters (Java-bridge era) have failed on non-string values. ' +
                    'The rewrite stringifies before the wire.',
                verify({ lms, observations }) {
                    expect(lms.stored('core.score.raw')).toBe('85');
                    expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
                    const writes = lms.callsSince(observations.afterLaunch).filter(c => c.method === 'LMSSetValue');
                    expect(writes.map(c => [c.args[0], c.argTypes[1]])).toEqual([
                        ['cmi.core.score.max', 'number'],
                        ['cmi.core.score.min', 'number'],
                        ['cmi.core.score.raw', 'number'],
                    ]);
                },
            },
        },
    },
    {
        id: 'S19',
        area: 'score',
        title: 'the score minimum is stored',
        expectation: 'cmi.core.score.min accepts a normalized 0-100 CMIDecimal (RTE §3.4.4; LMS support is optional).',
        run({ driver }) {
            driver.loadPage();
            driver.reportScore(85, 100, 0);
        },
        verify({ lms }) {
            expect(lms.stored('core.score.min')).toBe('0');
        },
    },
    {
        id: 'S20',
        area: 'score',
        title: 'the score maximum is stored',
        expectation: 'cmi.core.score.max accepts a normalized 0-100 CMIDecimal (RTE §3.4.4; LMS support is optional).',
        run({ driver }) {
            driver.loadPage();
            driver.reportScore(85, 100, 0);
        },
        verify({ lms }) {
            expect(lms.stored('core.score.max')).toBe('100');
        },
    },
    {
        id: 'S21',
        area: 'score',
        title: 'invalid score values are never stored',
        expectation:
            'Out-of-range or non-decimal raw scores must not land in cmi.core.score.raw (0-100 normalization, RTE §3.4.4; ' +
            'the LMS answer for them is 405). This scenario deliberately asserts the END STATE only: the runtimes differ ' +
            'in mechanism (the rewrite validates locally and sends nothing; legacy forwards the invalid write and relies ' +
            'on the LMS rejecting it) — the mechanism difference is recorded in the report, not failed here.',
        run({ driver }) {
            driver.loadPage();
            driver.reportScore(85, 100, 0); // a valid baseline first
            driver.reportScore(101, 100, 0);
            driver.reportScore(-5, 100, 0);
            driver.reportScore('eighty five', 100, 0);
        },
        verify({ lms }) {
            expect(lms.stored('core.score.raw')).toBe('85');
        },
    },

    // =====================================================================
    // Exit
    // =====================================================================
    {
        id: 'S26',
        area: 'exit',
        title: 'quitting a non-terminal session suspends the attempt',
        expectation: 'eXe policy: a non-terminal status exits with cmi.core.exit "suspend" so the attempt can resume.',
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(5_000);
            driver.doQuit();
        },
        verify({ lms }) {
            const exitWrites = lms.writesTo('cmi.core.exit');
            expect(exitWrites.length).toBeGreaterThan(0);
            expect(exitWrites[exitWrites.length - 1].args[1]).toBe('suspend');
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
        },
    },
    {
        id: 'S27',
        area: 'exit',
        title: 'quitting a completed session exits normally (empty exit)',
        expectation:
            'eXe policy: a terminal status ends the attempt with cmi.core.exit "" (normal exit, RTE §3.4.4 vocabulary), ' +
            'so the next launch is a fresh entry rather than a resume.',
        run({ driver }) {
            driver.loadPage();
            driver.facade.set('cmi.core.lesson_status', 'completed');
            driver.advanceClock(5_000);
            driver.doQuit();
        },
        verify({ lms }) {
            const exitWrites = lms.writesTo('cmi.core.exit');
            expect(exitWrites.length).toBeGreaterThan(0);
            expect(exitWrites[exitWrites.length - 1].args[1]).toBe('');
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'doQuit() writes exit "suspend" even for a completed session, and connection.terminate()\'s ' +
                    'handleExitMode block then overwrites it with "logout" (the SetExit value never reaches the ' +
                    'data.exitStatus cache the block consults). Both values are wrong for a normal completed exit: ' +
                    '"suspend" would resume the attempt, "logout" ends the learner\'s whole LMS session.',
                verify({ lms }) {
                    expect(lms.writesTo('cmi.core.exit').map(call => call.args[1])).toEqual(['suspend', 'logout']);
                    expect(lms.callsOf('LMSFinish')).toHaveLength(1);
                },
            },
        },
    },
    {
        id: 'S28',
        area: 'exit',
        title: 'invalid exit values never reach the LMS',
        expectation:
            'cmi.core.exit vocabulary is "time-out|suspend|logout|" (RTE §3.4.4); anything else must be rejected before ' +
            'or by the LMS (405) and must not be stored.',
        run({ driver }) {
            driver.loadPage();
            driver.ext.SetExit('finish');
            driver.ext.SetExit('closed');
        },
        verify({ lms }) {
            expect(lms.writesTo('cmi.core.exit')).toEqual([]);
            // Oracle sanity: a direct invalid write is refused with 405.
            expect(lms.windowApi.LMSSetValue('cmi.core.exit', 'closed')).toBe('false');
            expect(lms.lastError()).toBe('405');
        },
    },

    // =====================================================================
    // API / data-model access
    // =====================================================================
    {
        id: 'S29',
        area: 'api-access',
        title: 'writing a read-only element fails and does not change the stored value',
        expectation:
            'cmi.core.student_id is read-only; a write is error 403 (RTE §3.3.3/§3.4.4). The runtime may refuse locally ' +
            'or let the LMS refuse — either way nothing is stored and the caller sees a failure.',
        run({ driver }) {
            driver.loadPage();
            return { setResult: driver.facade.set('cmi.core.student_id', 'tampered') };
        },
        verify({ lms, observations }) {
            expect(observations.setResult).toBeFalsy();
            expect(lms.stored('core.student_id')).toBe('exe-student-1');
        },
    },
    {
        id: 'S30',
        area: 'api-access',
        title: 'reading a write-only element does not query the LMS',
        expectation:
            'cmi.core.exit is write-only: an LMSGetValue on it is error 404 (RTE §3.4.4), so the read gains nothing — a ' +
            'conformant LMS always answers "". The eXe contract therefore answers GetExit() from the local write cache, ' +
            'and the runtime must not leave the LMS error state dirty as a side effect of its own API surface.',
        run({ driver }) {
            driver.loadPage();
            driver.ext.SetExit('suspend');
            return { getResult: driver.ext.GetExit() };
        },
        verify({ lms }) {
            const exitReads = lms.calls.filter(call => call.method === 'LMSGetValue' && call.args[0] === 'cmi.core.exit');
            expect(exitReads).toEqual([]);
            expect(lms.lastError()).toBe('0');
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'GetExit() forwards an LMSGetValue("cmi.core.exit") to the LMS. The element is write-only, so a ' +
                    'conformant LMS answers "" with error 404 — the extension can never return the real value, and it ' +
                    'leaves the API error state at 404, which later error handling in content may misread.',
                verify({ lms, observations }) {
                    const exitReads = lms.calls.filter(
                        call => call.method === 'LMSGetValue' && call.args[0] === 'cmi.core.exit',
                    );
                    expect(exitReads).toHaveLength(1);
                    expect(exitReads[0].result).toBe('');
                    expect(exitReads[0].errorAfter).toBe('404');
                    expect(observations.getResult).toBe('');
                    expect(lms.lastError()).toBe('404');
                },
            },
        },
    },
    {
        id: 'S31',
        area: 'api-access',
        title: 'an unsupported CMI element read returns "" and does not break the runtime',
        expectation:
            'A nonexistent data-model element is an error (RTE §3.3.3: 201 for a nonexistent cmi element, 401 for a foreign ' +
            'data model) answered with ""; the runtime must surface "" and keep working. Note: scorm-again answers 401 for ' +
            'both probes, where the RTE book\'s own example uses 201 for cmi.core.zip_code.',
        run({ driver }) {
            driver.loadPage();
            return {
                unknownCmi: driver.facade.get('cmi.core.zip_code'),
                foreignModel: driver.facade.get('xyz.score.result'),
            };
        },
        verify({ driver, lms, observations }) {
            expect(observations.unknownCmi).toBe('');
            expect(observations.foreignModel).toBe('');
            // The runtime is still fully operational afterwards.
            driver.facade.set('cmi.core.lesson_location', 'after-unknown');
            expect(lms.stored('core.lesson_location')).toBe('after-unknown');
        },
    },
    {
        id: 'S32',
        area: 'api-access',
        title: 'a SCORM 1.2 package binds the SCORM 1.2 API when both API generations are present',
        expectation:
            'The 1.2 API adapter is the DOM object named "API" (RTE §3.3.6.1). A window also exposing API_1484_11 (SCORM ' +
            '2004) must not divert a 1.2 package: the runtime has to bind API and speak LMSInitialize.',
        lmsOptions: () => {
            const decoy = {
                calls: [],
                record(method) {
                    return (...args) => {
                        decoy.calls.push({ method, args: args.map(String) });
                        return method === 'GetValue' || method === 'GetErrorString' || method === 'GetDiagnostic'
                            ? ''
                            : method === 'GetLastError'
                              ? '0'
                              : 'true';
                    };
                },
            };
            for (const method of [
                'Initialize',
                'Terminate',
                'GetValue',
                'SetValue',
                'Commit',
                'GetLastError',
                'GetErrorString',
                'GetDiagnostic',
            ]) {
                decoy[method] = decoy.record(method);
            }
            return { lmsWindowExtras: { API_1484_11: decoy } };
        },
        run({ driver }) {
            driver.loadPage();
        },
        verify({ lms, lmsOptions }) {
            expect(lms.callsOf('LMSInitialize')).toHaveLength(1);
            expect(lmsOptions.lmsWindowExtras.API_1484_11.calls).toEqual([]);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'Nothing in the legacy package pins pipwerks.SCORM.version to "1.2", and the wrapper\'s auto-detect ' +
                    'prefers API_1484_11. In a window exposing both API generations the 1.2 package binds the SCORM 2004 ' +
                    'API and speaks Initialize/Terminate to it — the SCORM 1.2 API is never called. The rewrite pins the ' +
                    'version before discovery.',
                verify({ lms, lmsOptions }) {
                    expect(lms.callsOf('LMSInitialize')).toEqual([]);
                    const decoyCalls = lmsOptions.lmsWindowExtras.API_1484_11.calls;
                    expect(decoyCalls.length).toBeGreaterThan(0);
                    expect(decoyCalls[0].method).toBe('Initialize');
                },
            },
        },
    },

    // =====================================================================
    // Compatibility surface
    // =====================================================================
    {
        id: 'S33',
        area: 'compat',
        title: 'doContinue("completed") records completion and ends the session with a normal exit',
        expectation:
            'The legacy doContinue global must store the given status, terminate exactly once, write cmi.core.exit "" ' +
            '(continue = normal transition), and produce no invalid LMS calls.',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            driver.advanceClock(5_000);
            driver.doContinue('completed');
            return { afterLaunch };
        },
        verify({ lms, observations }) {
            expect(lms.stored('core.lesson_status')).toBe('completed');
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
            const exitWrites = lms.writesTo('cmi.core.exit');
            expect(exitWrites.length).toBeGreaterThan(0);
            expect(exitWrites[exitWrites.length - 1].args[1]).toBe('');
            expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'doContinue() correctly writes exit "" for the normal transition, but handleExitMode inside ' +
                    'connection.terminate() overwrites it with "logout" (terminal cached status, empty exitStatus cache). ' +
                    'Same root cause as S27.',
                verify({ lms, observations }) {
                    expect(lms.stored('core.lesson_status')).toBe('completed');
                    expect(lms.writesTo('cmi.core.exit').map(call => call.args[1])).toEqual(['', 'logout']);
                    expect(lms.callsOf('LMSFinish')).toHaveLength(1);
                    expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
                },
            },
        },
    },
    {
        id: 'S34',
        area: 'compat',
        title: 'the scorm facade reads and writes representative elements',
        expectation: 'scorm.get/scorm.set pass valid RW elements through to the LMS.',
        run({ driver }) {
            driver.loadPage();
            return {
                name: driver.facade.get('cmi.core.student_name'),
                setResult: driver.facade.set('cmi.core.lesson_location', 'page-3'),
            };
        },
        verify({ lms, observations }) {
            expect(observations.name).toBe('Student, Contract');
            expect(lms.stored('core.lesson_location')).toBe('page-3');
        },
    },
    {
        id: 'S35',
        area: 'compat',
        title: 'representative pipwerks.SCORM extension methods reach the LMS data',
        expectation: 'GetLearnerName/GetLearnerId (used by the games layer) return the LMS-provided learner data.',
        run({ driver }) {
            driver.loadPage();
            return {
                learnerName: driver.ext.GetLearnerName(),
                learnerId: driver.ext.GetLearnerId(),
            };
        },
        verify({ observations }) {
            expect(observations.learnerName).toBe('Student, Contract');
            expect(observations.learnerId).toBe('exe-student-1');
        },
    },
    {
        id: 'E02',
        area: 'compat',
        title: 'suspend_data written directly by content survives the session end',
        expectation:
            'Content shipped from main (games layer in common.js) writes its own line-format payload to cmi.suspend_data ' +
            'via pipwerks.SCORM.set. Whatever else the runtime persists at exit, the content\'s payload must still be on ' +
            'the LMS at session end, or resuming that content loses its state.',
        run({ driver }) {
            driver.loadPage();
            driver.facade.set('cmi.suspend_data', '0#act one#70#1|1#act two#30#1');
            driver.advanceClock(5_000);
            driver.endSessionViaPageExit({ scored: true });
        },
        verify({ lms }) {
            expect(lms.stored('suspend_data')).toBe('0#act one#70#1|1#act two#30#1');
        },
    },

    // =====================================================================
    // Interactions
    // =====================================================================
    {
        id: 'S36',
        area: 'interactions',
        title: 'a representative true-false interaction is accepted by the CMI model',
        expectation:
            'The SetInteractionValue extension writes cmi.interactions.0.* leaves (id/type/student_response/result) in the ' +
            'shape an eXe iDevice produces; all writes are valid SCORM 1.2 (RTE §3.4.4 pp.3-48…3-56).',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            driver.ext.SetInteractionValue('cmi.interactions.0.id', 'q-tf-1');
            driver.ext.SetInteractionValue('cmi.interactions.0.type', 'true-false');
            driver.ext.SetInteractionValue('cmi.interactions.0.student_response', 't');
            driver.ext.SetInteractionValue('cmi.interactions.0.result', 'correct');
            return { afterLaunch };
        },
        verify({ lms, observations }) {
            expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
            const stored = lms.stored('interactions');
            const first = stored && (stored['0'] || (stored.childArray && stored.childArray[0]));
            expect(first).toBeDefined();
            expect(first.id).toBe('q-tf-1');
            expect(first.type).toBe('true-false');
            expect(first.result).toBe('correct');
        },
    },
    {
        id: 'S37',
        area: 'interactions',
        title: 'invalid interaction values are rejected and never stored',
        expectation:
            'An invalid interaction type or result vocabulary member is refused (405). scorm-again additionally refuses ' +
            'non-sequential indexes (with its implementation-chosen code 402; SCORM 1.2 names no code for that case). ' +
            'The runtime must survive all rejections.',
        run({ driver }) {
            driver.loadPage();
            driver.ext.SetInteractionValue('cmi.interactions.0.id', 'q-1');
            return {
                badType: driver.ext.SetInteractionValue('cmi.interactions.0.type', 'multiple-choice'),
                badResult: driver.ext.SetInteractionValue('cmi.interactions.0.result', 'right'),
                skippedIndex: driver.ext.SetInteractionValue('cmi.interactions.9.id', 'q-9'),
            };
        },
        verify({ driver, lms, observations }) {
            expect(observations.badType).toBeFalsy();
            expect(observations.badResult).toBeFalsy();
            expect(observations.skippedIndex).toBeFalsy();
            const stored = lms.stored('interactions');
            const first = stored && (stored['0'] || (stored.childArray && stored.childArray[0]));
            expect(first.type || '').toBe('');
            // The runtime keeps working after the rejections.
            driver.facade.set('cmi.core.lesson_location', 'after-bad-interaction');
            expect(lms.stored('core.lesson_location')).toBe('after-bad-interaction');
        },
    },
    // =====================================================================
    // Additions from the adversarial review (see change-doc research.md)
    // =====================================================================
    {
        id: 'S12b',
        area: 'status',
        title: 'runtime-level unloadPage(true) alone keeps a resumed scored page "incomplete"',
        expectation:
            'Best-case runtime call for the resumed variant of S12: with the scored flag actually delivered, resumed ' +
            '"incomplete" progress survives and the attempt suspends.',
        lmsOptions: {
            cmi: { core: { lesson_status: 'incomplete', entry: 'resume' } },
        },
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(10_000);
            driver.unloadPageOnly(true);
        },
        verify({ lms }) {
            expect(lms.stored('core.lesson_status')).toBe('incomplete');
            const exitWrites = lms.writesTo('cmi.core.exit');
            expect(exitWrites[exitWrites.length - 1].args[1]).toBe('suspend');
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
        },
    },
    {
        id: 'S38',
        area: 'status',
        title: 'doContinue in review mode never rewrites a stored terminal status',
        expectation:
            'eXe policy (runtime contract): status writes are suppressed in review/browse lesson_mode; a stored terminal ' +
            'status survives, the session terminates once, and the continue transition exits with "". (SCORM 1.2 itself ' +
            'only mandates ignoring status changes in no-credit mode, RTE §3.4.4 — the suppression is eXe policy.)',
        lmsOptions: {
            cmi: { core: { lesson_status: 'passed', lesson_mode: 'review', entry: '' } },
        },
        run({ driver }) {
            driver.loadPage();
            driver.advanceClock(5_000);
            driver.doContinue('incomplete');
        },
        verify({ lms }) {
            expect(lms.writesTo('cmi.core.lesson_status')).toEqual([]);
            expect(lms.stored('core.lesson_status')).toBe('passed');
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
            const exitWrites = lms.writesTo('cmi.core.exit');
            expect(exitWrites[exitWrites.length - 1].args[1]).toBe('');
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'runtime',
                reason:
                    'The review-mode status suppression itself works (no lesson_status write, stored "passed" intact), ' +
                    'but the continue exit is again overwritten: doContinue writes exit "" and handleExitMode inside ' +
                    'connection.terminate() replaces it with "logout" (same root cause as S27/S33).',
                verify({ lms }) {
                    expect(lms.writesTo('cmi.core.lesson_status')).toEqual([]);
                    expect(lms.stored('core.lesson_status')).toBe('passed');
                    expect(lms.callsOf('LMSFinish')).toHaveLength(1);
                    expect(lms.writesTo('cmi.core.exit').map(call => call.args[1])).toEqual(['', 'logout']);
                },
            },
        },
    },
    {
        id: 'S39',
        area: 'session-time',
        title: 'mid-session persistence: repeated session_time writes carry the running total',
        expectation:
            'The LMS takes the LAST cmi.core.session_time and must overwrite, not accumulate (RTE §3.4.4), so every ' +
            'write must be the total since session start. Mid-session computeTime()+scorm.save() is the content-facing ' +
            'persistence idiom; whole-second durations are used deliberately so the legacy fraction defect (S24) does ' +
            'not re-fire here.',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            driver.advanceClock(30_000);
            driver.computeTime();
            driver.facade.save();
            driver.advanceClock(60_000);
            driver.endSessionViaPageExit({ scored: false });
            return { afterLaunch };
        },
        verify({ lms, observations }) {
            const writes = lms.writesTo('cmi.core.session_time');
            expect(writes.length).toBeGreaterThanOrEqual(2);
            for (const call of writes) {
                expect(call.args[1]).toMatch(/^\d{2,4}:\d{2}:\d{2}(\.\d{1,2})?$/);
                expect(call.errorAfter).toBe('0');
            }
            expect(Math.abs(timespanToMs(writes[0].args[1]) - 30_000)).toBeLessThanOrEqual(20);
            expect(Math.abs(timespanToMs(writes[writes.length - 1].args[1]) - 90_000)).toBeLessThanOrEqual(20);
            expect(lms.callsOf('LMSCommit').length).toBeGreaterThanOrEqual(2);
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
            expect(rejectedWrites(lms, observations.afterLaunch)).toEqual([]);
        },
    },
    {
        id: 'S42',
        area: 'compat',
        title: 'the setComplete compat global stores the status and commits it',
        expectation:
            'The eXe compatibility surface (runtime contract) includes setComplete(): content built against older eXe ' +
            'exports can call it to record completion, coupled with a commit.',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            const fn = driver.global('setComplete');
            const available = typeof fn === 'function';
            if (available) fn();
            return { afterLaunch, available };
        },
        verify({ lms, observations }) {
            expect(observations.available).toBe(true);
            expect(lms.stored('core.lesson_status')).toBe('completed');
            const statusWrite = lms
                .callsSince(observations.afterLaunch)
                .findIndex(c => c.method === 'LMSSetValue' && c.args[0] === 'cmi.core.lesson_status');
            const commitAfter = lms
                .callsSince(observations.afterLaunch)
                .slice(statusWrite + 1)
                .some(c => c.method === 'LMSCommit');
            expect(statusWrite).toBeGreaterThan(-1);
            expect(commitAfter).toBe(true);
        },
        deviations: {
            legacy: {
                classification: 'policy-difference',
                origin: 'runtime',
                reason:
                    'setComplete/setIncomplete do not exist in the files shipped from main (they appear only in ' +
                    'Scorm12Exporter\'s emergency fallback runtime, used when fetching the real files fails). Content ' +
                    'written against the eXe compat surface that calls setComplete() throws a ReferenceError on a ' +
                    'main-exported package. The rewrite always defines both globals per its compatibility contract.',
                verify({ lms, observations }) {
                    expect(observations.available).toBe(false);
                    expect(
                        lms
                            .callsSince(observations.afterLaunch)
                            .filter(c => c.method === 'LMSSetValue' && c.args[0] === 'cmi.core.lesson_status'),
                    ).toEqual([]);
                    expect(lms.stored('core.lesson_status')).toBe('incomplete');
                },
            },
        },
    },
    {
        id: 'E03',
        area: 'lifecycle',
        title: 'hiding the tab persists the session without terminating it',
        expectation:
            'eXe [BROWSER] policy (runtime contract): on visibilitychange to hidden the runtime persists progress — a ' +
            'session_time write and an LMSCommit — but never finishes the session and never writes status or exit; the ' +
            'session stays fully usable. This is the replacement for unload handlers on mobile app-switch/kill paths, ' +
            'where a page is often discarded without any further event.',
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            driver.advanceClock(30_000);
            const beforeHide = lms.checkpoint();
            driver.hideTab();
            const afterHide = lms.checkpoint();
            driver.showTab();
            driver.advanceClock(60_000);
            driver.endSessionViaPageExit({ scored: false });
            return { afterLaunch, beforeHide, afterHide };
        },
        verify({ lms, observations }) {
            const hideCalls = lms.calls.slice(observations.beforeHide, observations.afterHide);
            expect(hideCalls.some(c => c.method === 'LMSCommit')).toBe(true);
            const hideTimeWrites = hideCalls.filter(
                c => c.method === 'LMSSetValue' && c.args[0] === 'cmi.core.session_time',
            );
            expect(hideTimeWrites.length).toBeGreaterThan(0);
            expect(Math.abs(timespanToMs(hideTimeWrites[0].args[1]) - 30_000)).toBeLessThanOrEqual(20);
            expect(hideCalls.filter(c => c.method === 'LMSFinish')).toEqual([]);
            expect(
                hideCalls.filter(
                    c =>
                        c.method === 'LMSSetValue' &&
                        (c.args[0] === 'cmi.core.lesson_status' || c.args[0] === 'cmi.core.exit'),
                ),
            ).toEqual([]);
            // The session remained usable: the later real exit finished once
            // with the full duration.
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
            const finalTime = lms.writesTo('cmi.core.session_time').pop();
            expect(Math.abs(timespanToMs(finalTime.args[1]) - 90_000)).toBeLessThanOrEqual(20);
        },
        deviations: {
            legacy: {
                classification: 'policy-difference',
                origin: 'runtime',
                reason:
                    'The legacy runtime has no visibility-persistence surface at all: hiding the tab produces zero LMS ' +
                    'traffic, so on mobile app-switch/kill paths (where no further page event may ever fire) the whole ' +
                    'session — progress and session_time — is lost. SCORM 1.2 does not require the persistence; the ' +
                    'documented eXe [BROWSER] policy does. The rest of the session is unaffected when the page does get ' +
                    'a normal exit.',
                verify({ lms, observations }) {
                    expect(lms.calls.slice(observations.beforeHide, observations.afterHide)).toEqual([]);
                    expect(lms.callsOf('LMSFinish')).toHaveLength(1);
                    const finalTime = lms.writesTo('cmi.core.session_time').pop();
                    expect(Math.abs(timespanToMs(finalTime.args[1]) - 90_000)).toBeLessThanOrEqual(20);
                },
            },
        },
    },
    {
        id: 'E04',
        area: 'status',
        title: 'a completed scored activity below the LMS mastery score fails the attempt',
        expectation:
            'eXe policy (runtime contract / ADR-2209-02): a published cmi.student_data.mastery_score (here 80) is the ' +
            'success threshold; a page whose single required activity is complete with aggregate 70 ends "failed" with ' +
            'exit "" and the raw score stored. Grounded in RTE §3.4.4 (mastery_score is the LMS-published pass mark) ' +
            'plus the documented eXe policy; content decides through its production score path for each variant.',
        lmsOptions: {
            cmi: { student_data: { mastery_score: '80' } },
        },
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            driver.completeScoredActivity({ id: 'game-1', score: 70 });
            driver.advanceClock(10_000);
            driver.endSessionViaPageExit({ scored: true });
            return { afterLaunch };
        },
        verify({ lms }) {
            expect(lms.stored('core.lesson_status')).toBe('failed');
            expect(lms.stored('core.score.raw')).toBe('70');
            const exitWrites = lms.writesTo('cmi.core.exit');
            expect(exitWrites[exitWrites.length - 1].args[1]).toBe('');
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
        },
        deviations: {
            legacy: {
                classification: 'policy-difference',
                origin: 'content-layer',
                reason:
                    'The legacy stack never consults cmi.student_data.mastery_score: the games layer decides pass/fail ' +
                    'at a hardcoded threshold of 50 (common.js:1362-1368), so the attempt is recorded "passed" with 70 ' +
                    'although the LMS published a pass mark of 80. That is spec-legal: SCORM 1.2 defines ' +
                    'mastery_score as LMS-published data the LMS may use to override the status (RTE §3.4.4); ' +
                    'SCO-side use is optional, and Moodle\'s default masteryoverride=1 turns this "passed" into ' +
                    '"failed" LMS-side anyway (the very rule this harness disables with mastery_override:false). ' +
                    'Whether the SCO should apply the mastery score itself is the documented eXe policy the ' +
                    'rewrite implements and an open product decision (#2316) — a policy difference, not a ' +
                    'defect. The terminal cache also produces the familiar suspend/logout exit overwrite (root ' +
                    'cause L3, recorded as a defect in S13/S27/S33/S38).',
                verify({ lms }) {
                    expect(lms.stored('core.lesson_status')).toBe('passed');
                    expect(lms.stored('core.score.raw')).toBe('70');
                    expect(lms.writesTo('cmi.core.exit').map(call => call.args[1])).toEqual(['suspend', 'logout']);
                    expect(lms.callsOf('LMSFinish')).toHaveLength(1);
                },
            },
        },
    },
    {
        id: 'E07',
        area: 'status',
        title: "Moodle profile: the host's mastery verdict at LMSFinish agrees with the SCO's own",
        expectation:
            "eXe policy (runtime contract / ADR-2209-02) checked from the host side: Moodle's masteryoverride (site " +
            'default 1) rewrites lesson_status at LMSFinish to passed/failed by comparing cmi.core.score.raw with ' +
            'cmi.student_data.mastery_score (mod/scorm/datamodels/scorm_12.js StoreData). Because the runtime adopts ' +
            'the published mastery score (80) as its own threshold, its final status write for an aggregate of 70 is ' +
            'already "failed": the stored status is "failed", the LMS had nothing to rewrite, and what the page told ' +
            'the learner matches what the LMS records.',
        lmsOptions: {
            profile: 'moodle',
            cmi: { student_data: { mastery_score: '80' } },
        },
        run({ driver, lms }) {
            driver.loadPage();
            const afterLaunch = lms.checkpoint();
            driver.completeScoredActivity({ id: 'game-1', score: 70 });
            driver.advanceClock(10_000);
            driver.endSessionViaPageExit({ scored: true });
            return { afterLaunch };
        },
        verify({ lms, observations }) {
            expect(lms.profile).toBe('moodle');
            const scoVerdict = lms
                .callsSince(observations.afterLaunch)
                .filter(c => c.method === 'LMSSetValue' && c.args[0] === 'cmi.core.lesson_status' && c.errorAfter === '0')
                .pop();
            expect(scoVerdict.args[1]).toBe('failed');
            expect(lms.stored('core.score.raw')).toBe('70');
            expect(lms.stored('core.lesson_status')).toBe('failed');
            expect(lms.lmsRewrites).toEqual([]);
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
        },
        deviations: {
            legacy: {
                classification: 'policy-difference',
                origin: 'content-layer',
                reason:
                    'The legacy games layer decides pass/fail at its hardcoded 50 and never reads ' +
                    'cmi.student_data.mastery_score (E04), so the SCO\'s own final verdict for 70 is "passed". ' +
                    'Moodle\'s masteryoverride then rewrites it to "failed" at LMSFinish (70 < 80): the LMS record ends ' +
                    'up right — which is exactly why E04 is a policy difference and not a defect — but the page had ' +
                    'already told the learner they passed, so what the learner saw and what the LMS stores disagree. ' +
                    'Whether the SCO should apply the published mastery score itself is the open product decision ' +
                    '(#2316).',
                verify({ lms, observations }) {
                    const scoVerdict = lms
                        .callsSince(observations.afterLaunch)
                        .filter(c => c.method === 'LMSSetValue' && c.args[0] === 'cmi.core.lesson_status')
                        .pop();
                    expect(scoVerdict.args[1]).toBe('passed');
                    expect(lms.stored('core.score.raw')).toBe('70');
                    expect(lms.stored('core.lesson_status')).toBe('failed');
                    expect(lms.lmsRewrites).toEqual([
                        { rule: 'masteryoverride', element: 'cmi.core.lesson_status', from: 'passed', to: 'failed' },
                    ]);
                    expect(lms.callsOf('LMSFinish')).toHaveLength(1);
                },
            },
        },
    },
    {
        id: 'E05',
        area: 'score',
        title: 'a page whose required activity was never answered publishes no score',
        expectation:
            'cmi.core.score.raw cannot express "not answered": a 0 there reads as "scored zero". A page the learner ' +
            'opened and left without answering must therefore store no score at all and stay "incomplete" — the ' +
            'honest report, and the one the RTE describes for a SCO exited before a verdict could be determined ' +
            '(§3.4.4, "incomplete"). It also matters to the host: Moodle promotes an incomplete status to completed ' +
            'as soon as any score.raw exists (mod/scorm/locallib.php scorm_insert_track under forcecompleted), so a ' +
            'seeded zero makes a merely-visited page count as a finished learning object under grademethod SCOES.',
        run({ driver }) {
            driver.loadPage();
            driver.registerUnansweredActivity({ id: 'game-1' });
            driver.advanceClock(5_000);
            driver.endSessionViaPageExit({ scored: true });
        },
        verify({ lms }) {
            expect(lms.writesTo('cmi.core.score.raw')).toHaveLength(0);
            expect(lms.stored('core.lesson_status')).toBe('incomplete');
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'content-layer',
                reason:
                    'main\'s games layer has no notion of "not answered": registerActivity seeds the slot at zero and ' +
                    'showFinalScore takes the same write path as a real score, so the page publishes 0 and — being ' +
                    'under the hardcoded threshold of 50 — records "failed" before the learner has touched anything. ' +
                    'A SCO that reports failed for a page nobody attempted misreports the attempt in either ' +
                    'direction: the grade is wrong, and so is the completion state derived from it.',
                verify({ lms }) {
                    expect(lms.stored('core.score.raw')).toBe('0');
                    expect(lms.stored('core.lesson_status')).toBe('failed');
                },
            },
        },
    },
    {
        id: 'E06',
        area: 'score',
        title: 'Moodle profile: an unanswered scored page is not promoted to "completed" at LMSFinish',
        expectation:
            "eXe policy (E05) checked from the host side: under Moodle's mod_scorm with forcecompleted on, any stored " +
            'cmi.core.score.raw turns an "incomplete" attempt into "completed" when the data is saved ' +
            '(mod/scorm/locallib.php scorm_insert_track). A page the learner opened and left without answering ' +
            'publishes no score, so the LMS finds nothing to promote: the attempt is still "incomplete" after ' +
            'LMSFinish, the LMS applied no rewrite, and the learner can resume.',
        lmsOptions: { profile: 'moodle' },
        run({ driver }) {
            driver.loadPage();
            driver.registerUnansweredActivity({ id: 'game-1' });
            driver.advanceClock(5_000);
            driver.endSessionViaPageExit({ scored: true });
        },
        verify({ lms }) {
            expect(lms.profile).toBe('moodle');
            expect(lms.writesTo('cmi.core.score.raw')).toHaveLength(0);
            expect(lms.callsOf('LMSFinish')).toHaveLength(1);
            expect(lms.stored('core.lesson_status')).toBe('incomplete');
            expect(lms.lmsRewrites).toEqual([]);
        },
        deviations: {
            legacy: {
                classification: 'legacy-defect',
                origin: 'content-layer',
                reason:
                    'Same root cause as E05 (L10): main\'s games layer seeds the unanswered activity at 0 and takes the ' +
                    'real-score write path, so the page publishes cmi.core.score.raw = 0 and writes "failed" itself ' +
                    'before the learner touched anything. Seen from Moodle, forcecompleted has nothing left to promote ' +
                    '— the SCO already reported a terminal verdict, which is worse than a promotion: a merely-visited ' +
                    'page is stored as a graded, failed attempt (score 0) instead of a resumable "incomplete". Had the ' +
                    'games layer left the status "incomplete" but still published the 0, scorm_insert_track\'s ' +
                    'forcecompleted rule would have promoted the untouched page to "completed" — either way the stored ' +
                    'score.raw is what makes the host treat the page as done.',
                verify({ lms }) {
                    expect(lms.writesTo('cmi.core.score.raw').map(call => call.args[1])).toEqual(['0']);
                    expect(lms.stored('core.score.raw')).toBe('0');
                    expect(lms.stored('core.lesson_status')).toBe('failed');
                    expect(lms.lmsRewrites).toEqual([]);
                    expect(lms.callsOf('LMSFinish')).toHaveLength(1);
                },
            },
        },
    },
];

/**
 * Execute the shared scenarios for one runtime variant.
 *
 * @param {object} options
 * @param {'legacy'|'rewrite'} options.variant
 * @param {(lmsOptions: object|undefined) => {driver: object, lms: object}} options.createContext
 *   builds a fresh driver + LMS pair for one scenario (called inside the test)
 */
export function runContractSuite({ variant, describe, it, createContext }) {
    const areas = [...new Set(CONTRACT_SCENARIOS.map(s => s.area))];
    for (const area of areas) {
        describe(area, () => {
            for (const scenario of CONTRACT_SCENARIOS.filter(s => s.area === area)) {
                it(`${scenario.id} ${scenario.title}`, () => {
                    const lmsOptions =
                        typeof scenario.lmsOptions === 'function' ? scenario.lmsOptions() : scenario.lmsOptions;
                    const { driver, lms } = createContext(lmsOptions);
                    const ctx = { driver, lms, variant, lmsOptions };
                    const observations = scenario.run(ctx) || {};
                    ctx.observations = observations;

                    const deviation = scenario.deviations ? scenario.deviations[variant] : undefined;
                    if (!deviation) {
                        scenario.verify(ctx);
                        return;
                    }
                    let contractError = null;
                    try {
                        scenario.verify(ctx);
                    } catch (error) {
                        // Only an assertion failure proves the deviation still
                        // exists; a harness/driver crash must fail the test.
                        const isAssertion =
                            error && (error.name === 'AssertionError' || error.matcherResult !== undefined);
                        if (!isAssertion) throw error;
                        contractError = error;
                    }
                    if (!contractError) {
                        throw new Error(
                            `Stale deviation record: ${scenario.id} now meets the contract on '${variant}'. ` +
                                'Remove the deviation entry so the contract assertion applies again.',
                        );
                    }
                    deviation.verify(ctx);
                });
            }
        });
    }
}
