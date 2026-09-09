import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Load order mirrors the assembled package: vendored wrapper first (attached
// as the pipwerks global), then the runtime layers, then the adapter (which
// defines the legacy globals at load time).
const pipwerks = require('./vendor/pipwerks/SCORM_API_wrapper.js');
window.pipwerks = pipwerks;
const client = require('./exe-scorm12-client.js');
const activities = require('./exe-scorm12-activities.js');
const policy = require('./exe-scorm12-policy.js');
const lifecycle = require('./exe-scorm12-lifecycle.js');
require('./exe-scorm12-adapter.js');
// The adapter defined its globals on the page window; capture it before
// tests stub the `window` global with fake API trees.
const pageWindow = window;
const { createFakeScorm12Api, createFakeWindowTree, resetPipwerks } = require('./fake-scorm12-api.test-util.js');

/** Minimal event target capturing listeners so tests can fire them. */
function createFakeEventTarget() {
    const listeners = {};
    return {
        listeners,
        addEventListener(type, handler) {
            listeners[type] = listeners[type] || [];
            listeners[type].push(handler);
        },
        removeEventListener(type, handler) {
            listeners[type] = (listeners[type] || []).filter(entry => entry !== handler);
        },
        fire(type, event) {
            for (const handler of listeners[type] || []) {
                handler(event === undefined ? { type, persisted: false } : Object.assign({ type }, event));
            }
        },
    };
}

describe('exe-scorm12-adapter (legacy globals contract)', () => {
    let api;
    let fakeNow;
    let fakeWindow;
    let fakeDocument;
    let warnSpy;

    function useLms(initialData, options = {}) {
        api = createFakeScorm12Api(Object.assign({ data: initialData }, options));
        vi.stubGlobal('window', createFakeWindowTree('self', api));
    }

    beforeEach(() => {
        fakeNow = 1000;
        warnSpy = vi.fn();
        resetPipwerks(pipwerks);
        client.resetDependencies();
        client.configure({ getPipwerks: () => pipwerks, now: () => fakeNow, error: vi.fn(), warn: warnSpy });
        activities.resetDependencies();
        activities.configure({ warn: warnSpy });
        policy.resetDependencies();
        policy.configure({ getClient: () => client, getActivities: () => activities, warn: warnSpy });
        fakeWindow = createFakeEventTarget();
        fakeDocument = createFakeEventTarget();
        fakeDocument.visibilityState = 'visible';
        lifecycle.resetDependencies();
        lifecycle.configure({
            getClient: () => client,
            getPolicy: () => policy,
            getWindow: () => fakeWindow,
            getDocument: () => fakeDocument,
        });
        pageWindow.exeScorm12.resetAdapterForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        lifecycle.resetDependencies();
        policy.resetDependencies();
        activities.resetDependencies();
        client.resetDependencies();
    });

    describe('globals definition', () => {
        it('defines every contract global', () => {
            for (const name of [
                'loadPage',
                'unloadPage',
                'doQuit',
                'doBack',
                'doContinue',
                'startTimer',
                'computeTime',
                'goBack',
                'goForward',
                'setComplete',
                'setIncomplete',
                'setScore',
            ]) {
                expect(typeof pageWindow[name], name).toBe('function');
            }
            expect(typeof pageWindow.scorm).toBe('object');
            expect(pageWindow.scorm.version).toBe('1.2');
        });
    });

    describe('session.open', () => {
        it('brings the client up and applies the entry policy without the SCO lifecycle', () => {
            // The host that embeds an exported website owns the page: several of its
            // pages share one session, so installing the SCO lifecycle would end that
            // session as soon as one page reached a terminal status.
            useLms({});

            const opened = pageWindow.exeScorm12.session.open({ ownsLifecycle: false });

            expect(opened).toBe(true);
            expect(api.callSignatures()).toEqual([
                'LMSInitialize',
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.lesson_status=incomplete)',
                'LMSGetValue(cmi.student_data.mastery_score)',
                'LMSGetValue(cmi.suspend_data)',
            ]);
            expect(fakeWindow.listeners.pagehide ?? []).toHaveLength(0);
            expect(fakeWindow.listeners.pageshow ?? []).toHaveLength(0);
        });

        it('leaves the client able to write, which opening pipwerks alone does not', () => {
            // The defect this exists for: a host that opened pipwerks' connection but not
            // the client's own state machine gets every write refused with 301, silently
            // — the registry holds the score and cmi.core.score.raw stays empty.
            useLms({});

            const refused = pageWindow.exeScorm12.policy.setScoreDetailed(50, 0, 100);
            expect(refused.requiredWritten).toBe(false);
            expect(refused.required.errorCode).toBe(301);

            pageWindow.exeScorm12.session.open({ ownsLifecycle: false });
            const accepted = pageWindow.exeScorm12.policy.setScoreDetailed(50, 0, 100);

            expect(accepted.requiredWritten).toBe(true);
            expect(accepted.required.errorCode).toBe(0);
        });

        it('installs the lifecycle when the caller owns it', () => {
            useLms({});

            pageWindow.exeScorm12.session.open({ ownsLifecycle: true });

            expect(fakeWindow.listeners.pagehide).toHaveLength(1);
        });

        it('defaults to owning the lifecycle, so an argument-less call is the SCO case', () => {
            useLms({});

            pageWindow.exeScorm12.session.open();

            expect(fakeWindow.listeners.pagehide).toHaveLength(1);
        });

        it('does not initialize twice when called again', () => {
            useLms({});
            pageWindow.exeScorm12.session.open({ ownsLifecycle: false });
            const initializes = api.callSignatures().filter(name => name === 'LMSInitialize').length;

            pageWindow.exeScorm12.session.open({ ownsLifecycle: false });

            expect(api.callSignatures().filter(name => name === 'LMSInitialize')).toHaveLength(initializes);
        });

        it('reports failure when the session cannot be opened', () => {
            useLms({}, { failures: { LMSInitialize: { result: 'false', errorCode: 101 } } });

            expect(pageWindow.exeScorm12.session.open({ ownsLifecycle: false })).toBe(false);
        });

        describe('lifecycle ownership is decided by the first successful open', () => {
            function lifecycleListenerCount() {
                return (
                    (fakeWindow.listeners.pagehide ?? []).length +
                    (fakeWindow.listeners.pageshow ?? []).length +
                    (fakeDocument.listeners.visibilitychange ?? []).length
                );
            }

            it('a host that declined ownership is not overridden by a later loadPage()', () => {
                // The Moodle plugin opens the session as the host of an embedded page and
                // declines the SCO lifecycle; a SCORM 1.2 package it embeds still carries
                // <body onload="loadPage()">, which asks for it. The first caller wins:
                // nothing is installed, nothing is initialized or decided twice.
                useLms({});

                expect(pageWindow.exeScorm12.session.open({ ownsLifecycle: false })).toBe(true);
                pageWindow.loadPage();
                expect(pageWindow.exeScorm12.session.open({ ownsLifecycle: true })).toBe(true);

                expect(api.callNames().filter(name => name === 'LMSInitialize')).toHaveLength(1);
                expect(api.callsFor('LMSSetValue').filter(call => call[0] === 'cmi.core.lesson_status')).toEqual([
                    ['cmi.core.lesson_status', 'incomplete'],
                ]);
                expect(api.callsFor('LMSGetValue').filter(call => call[0] === 'cmi.suspend_data')).toHaveLength(1);
                expect(lifecycleListenerCount()).toBe(0);
                // The page is left alone on the way out: the host ends the session.
                fakeWindow.fire('pagehide', { persisted: false });
                expect(api.callNames()).not.toContain('LMSFinish');
            });

            it('a host opening after the SCO already owns the lifecycle does not remove it', () => {
                useLms({});
                pageWindow.loadPage();

                expect(pageWindow.exeScorm12.session.open({ ownsLifecycle: false })).toBe(true);

                expect(api.callNames().filter(name => name === 'LMSInitialize')).toHaveLength(1);
                expect(fakeWindow.listeners.pagehide).toHaveLength(1);
                expect(fakeWindow.listeners.pageshow).toHaveLength(1);
                expect(fakeDocument.listeners.visibilitychange).toHaveLength(1);
                fakeWindow.fire('pagehide', { persisted: false });
                expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
            });

            it('runs the entry policy once across repeated opens', () => {
                useLms({
                    'cmi.core.lesson_status': 'incomplete',
                    'cmi.core.score.raw': '80',
                    'cmi.suspend_data': 'exe12/1|quiz;7;0;0;80;1;0;100',
                });

                pageWindow.exeScorm12.session.open({ ownsLifecycle: false });
                pageWindow.exeScorm12.session.open({ ownsLifecycle: false });
                pageWindow.loadPage();

                expect(api.callsFor('LMSGetValue').filter(call => call[0] === 'cmi.suspend_data')).toHaveLength(1);
                expect(api.callsFor('LMSSetValue')).toEqual([
                    ['cmi.core.score.raw', '80'],
                    ['cmi.core.score.min', '0'],
                    ['cmi.core.score.max', '100'],
                ]);
            });

            it('a failed open decides nothing: the next successful caller owns the lifecycle', () => {
                const failures = { LMSInitialize: { result: 'false', errorCode: 101 } };
                useLms({}, { failures });
                expect(pageWindow.exeScorm12.session.open({ ownsLifecycle: false })).toBe(false);
                expect(lifecycleListenerCount()).toBe(0);

                delete failures.LMSInitialize;
                pageWindow.loadPage();

                // The refused attempt and the successful one.
                expect(api.callNames().filter(name => name === 'LMSInitialize')).toHaveLength(2);
                expect(api.callsFor('LMSSetValue').filter(call => call[0] === 'cmi.core.lesson_status')).toEqual([
                    ['cmi.core.lesson_status', 'incomplete'],
                ]);
                expect(lifecycleListenerCount()).toBe(3);
            });

            it('starts afresh after the test reset', () => {
                useLms({});
                pageWindow.exeScorm12.session.open({ ownsLifecycle: false });

                pageWindow.exeScorm12.resetAdapterForTests();
                lifecycle.resetDependencies();
                lifecycle.configure({
                    getClient: () => client,
                    getPolicy: () => policy,
                    getWindow: () => fakeWindow,
                    getDocument: () => fakeDocument,
                });
                pageWindow.exeScorm12.session.open({ ownsLifecycle: true });

                expect(fakeWindow.listeners.pagehide).toHaveLength(1);
            });
        });
    });

    describe('loadPage', () => {
        it('initializes and applies the entry policy (exact call sequence)', () => {
            useLms({});

            pageWindow.loadPage();

            expect(api.callSignatures()).toEqual([
                'LMSInitialize',
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.lesson_status=incomplete)',
                // The entry policy also probes the optional mastery score and
                // restores the activity registry from suspend_data.
                'LMSGetValue(cmi.student_data.mastery_score)',
                'LMSGetValue(cmi.suspend_data)',
            ]);
            expect(fakeWindow.listeners.pagehide).toHaveLength(1);
            expect(fakeWindow.listeners.pageshow).toHaveLength(1);
        });

        it('preserves a terminal status on load', () => {
            useLms({ 'cmi.core.lesson_status': 'completed' });

            pageWindow.loadPage();

            expect(api.callSignatures()).toEqual([
                'LMSInitialize',
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSGetValue(cmi.student_data.mastery_score)',
                'LMSGetValue(cmi.suspend_data)',
            ]);
        });

        it('is idempotent (body onload and exe_export.js may both call it)', () => {
            useLms({});
            pageWindow.loadPage();
            const callCount = api.calls.length;

            pageWindow.loadPage();

            expect(api.calls.length).toBe(callCount);
        });

        it('stays retryable after a failed initialize', () => {
            // A transient failure (the LMS API not attached yet) must not
            // consume the one-shot latch: exe_export.js calls loadPage()
            // again after the body onload attribute already tried.
            const failures = { LMSInitialize: { result: 'false', errorCode: 101 } };
            useLms({}, { failures });

            pageWindow.loadPage();
            expect(client.isActive()).toBe(false);

            delete failures.LMSInitialize;
            pageWindow.loadPage();

            expect(client.isActive()).toBe(true);
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
        });
    });

    describe('unloadPage', () => {
        it('completes a page without scored activities (exact call sequence)', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.unloadPage(false);

            expect(api.callSignatures()).toEqual([
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.lesson_status=completed)',
                'LMSSetValue(cmi.core.exit=)',
                'LMSSetValue(cmi.core.session_time=0000:00:00.00)',
                'LMSCommit',
                'LMSFinish',
            ]);
        });

        it('keeps a page with scored activities incomplete', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.unloadPage(true);

            // The decided status equals the stored one, so the runtime does
            // not send a redundant LMSSetValue for it.
            expect(api.callSignatures()).toEqual([
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.exit=suspend)',
                'LMSSetValue(cmi.core.session_time=0000:00:00.00)',
                'LMSCommit',
                'LMSFinish',
            ]);
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
        });

        it('is a no-op once the session ended', () => {
            useLms({});
            pageWindow.loadPage();
            pageWindow.unloadPage(false);
            const callCount = api.calls.length;

            pageWindow.unloadPage(false);

            expect(api.calls.length).toBe(callCount);
        });
    });

    describe('doQuit / doBack / doContinue', () => {
        it('doQuit suspends without changing the status (exact call sequence)', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.doQuit();

            expect(api.callSignatures()).toEqual([
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.exit=suspend)',
                'LMSSetValue(cmi.core.session_time=0000:00:00.00)',
                'LMSCommit',
                'LMSFinish',
            ]);
        });

        it('doBack behaves like doQuit', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.doBack();

            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
            expect(api.data['cmi.core.exit']).toBe('suspend');
            expect(api.callNames()).toContain('LMSFinish');
        });

        it('doContinue stores the status and ends the session (exact call sequence)', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.doContinue('completed');

            expect(api.callSignatures()).toEqual([
                'LMSGetValue(cmi.core.lesson_mode)',
                'LMSSetValue(cmi.core.lesson_status=completed)',
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.exit=)',
                'LMSSetValue(cmi.core.session_time=0000:00:00.00)',
                'LMSCommit',
                'LMSFinish',
            ]);
        });

        it('doContinue does not write a status in review mode', () => {
            useLms({ 'cmi.core.lesson_mode': 'review' });
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.doContinue('completed');

            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
        });
    });

    describe('fallback-contract helpers', () => {
        it('setComplete writes and commits (exact call sequence)', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.setComplete();

            expect(api.callSignatures()).toEqual(['LMSSetValue(cmi.core.lesson_status=completed)', 'LMSCommit']);
        });

        it('setIncomplete writes and commits', () => {
            useLms({ 'cmi.core.lesson_status': 'completed' });
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.setIncomplete();

            expect(api.callSignatures()).toEqual(['LMSSetValue(cmi.core.lesson_status=incomplete)', 'LMSCommit']);
        });

        it('setScore keeps the legacy (score, max, min) argument order', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.setScore(85, 100, 0);

            expect(api.callSignatures()).toEqual([
                'LMSSetValue(cmi.core.score.raw=85)',
                'LMSSetValue(cmi.core.score.min=0)',
                'LMSSetValue(cmi.core.score.max=100)',
                'LMSCommit',
            ]);
        });

        it('setScore rejects invalid input without LMS traffic', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.setScore('not-a-number');

            expect(api.calls).toEqual([]);
        });
    });

    describe('timer globals', () => {
        it('startTimer/computeTime restart and write the session time', () => {
            useLms({});
            pageWindow.loadPage();
            fakeNow = 3500;
            pageWindow.startTimer();
            fakeNow = 4700;
            api.calls.length = 0;

            pageWindow.computeTime();

            expect(api.callSignatures()).toEqual(['LMSSetValue(cmi.core.session_time=0000:00:01.20)']);
        });
    });

    describe('navigation stubs', () => {
        it('goBack and goForward are inert stubs that warn and produce no LMS traffic', () => {
            const consoleWarnSpy = vi.spyOn(pageWindow.console, 'warn').mockImplementation(() => {});
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.goBack();
            pageWindow.goForward();

            expect(api.calls).toEqual([]);
            expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
            consoleWarnSpy.mockRestore();
        });
    });

    describe('the scorm facade', () => {
        it('init() returns true when the session is already active', () => {
            useLms({});
            pageWindow.loadPage();
            const callCount = api.calls.length;

            expect(pageWindow.scorm.init()).toBe(true);
            expect(api.calls.length).toBe(callCount);
        });

        it('exposes get/set/save with working LMS traffic', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            expect(pageWindow.scorm.set('cmi.suspend_data', 'a|b|c')).toBe(true);
            expect(pageWindow.scorm.get('cmi.suspend_data')).toBe('a|b|c');
            expect(pageWindow.scorm.save()).toBe(true);
        });

        it('set() on lesson_status validates the SCO-writable vocabulary locally', () => {
            useLms({});
            pageWindow.loadPage();

            expect(pageWindow.scorm.set('cmi.core.lesson_status', 'completed')).toBe(true);
            expect(api.data['cmi.core.lesson_status']).toBe('completed');

            // "not attempted" is LMS-only: refused locally, never forwarded —
            // sending it would be an invalid SCORM 1.2 call.
            api.resetCalls();
            expect(pageWindow.scorm.set('cmi.core.lesson_status', 'not attempted')).toBe(false);
            expect(api.callsFor('LMSSetValue')).toEqual([]);
            expect(api.data['cmi.core.lesson_status']).toBe('completed');
        });

        it('set() on lesson_status releases the policy claim, so the status is never downgraded', () => {
            useLms({});
            pageWindow.loadPage();
            pageWindow.scorm.activities.register('quiz-1', {
                evaluable: true,
                completionRequired: true,
                completed: true,
                score: 90,
            });
            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'passed', written: true });

            // Content ratifies the verdict through the generic facade.
            expect(pageWindow.scorm.set('cmi.core.lesson_status', 'passed')).toBe(true);

            // A required activity registering afterwards must not downgrade
            // a status content wrote — whatever entry point it used.
            pageWindow.scorm.activities.register('quiz-2', { evaluable: true, completionRequired: true, total: 4 });
            expect(policy.reconcilePendingActivities()).toMatchObject({
                status: 'passed',
                written: false,
                reason: 'terminal-status-preserved',
            });
            expect(api.data['cmi.core.lesson_status']).toBe('passed');
        });

        it('pipwerks.SCORM.set on lesson_status routes through the policy and releases the claim', () => {
            useLms({});
            pageWindow.loadPage();
            pageWindow.scorm.activities.register('quiz-1', {
                evaluable: true,
                completionRequired: true,
                completed: true,
                score: 90,
            });
            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'passed', written: true });

            // Content ratifies the verdict through the wrapper's own helper
            // (the alias of data.set) — the lowest-level public write path.
            expect(pipwerks.SCORM.set('cmi.core.lesson_status', 'passed')).toBe(true);

            pageWindow.scorm.activities.register('quiz-2', { evaluable: true, completionRequired: true, total: 4 });
            expect(policy.reconcilePendingActivities()).toMatchObject({
                status: 'passed',
                written: false,
                reason: 'terminal-status-preserved',
            });
            expect(api.data['cmi.core.lesson_status']).toBe('passed');

            // Other elements keep flowing through the native wrapper write.
            expect(pipwerks.SCORM.set('cmi.core.lesson_location', 'page-2')).toBe(true);
            expect(api.data['cmi.core.lesson_location']).toBe('page-2');

            // Vocabulary is validated locally, like every content entry point.
            api.resetCalls();
            expect(pipwerks.SCORM.set('cmi.core.lesson_status', 'not attempted')).toBe(false);
            expect(api.callsFor('LMSSetValue')).toEqual([]);
        });

        it("pipwerks.SCORM.status('set') routes through the policy and releases the claim", () => {
            useLms({});
            pageWindow.loadPage();
            pageWindow.scorm.activities.register('quiz-1', {
                evaluable: true,
                completionRequired: true,
                completed: true,
                score: 90,
            });
            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'passed', written: true });

            expect(pipwerks.SCORM.status('set', 'passed')).toBe(true);

            pageWindow.scorm.activities.register('quiz-2', { evaluable: true, completionRequired: true, total: 4 });
            expect(policy.reconcilePendingActivities()).toMatchObject({
                status: 'passed',
                written: false,
                reason: 'terminal-status-preserved',
            });
            expect(api.data['cmi.core.lesson_status']).toBe('passed');

            // The read action stays native.
            expect(pipwerks.SCORM.status('get')).toBe('passed');
        });

        it('SetCompletionStatus releases the policy claim, so the status is never downgraded', () => {
            useLms({});
            pageWindow.loadPage();
            pageWindow.scorm.activities.register('quiz-1', {
                evaluable: true,
                completionRequired: true,
                completed: true,
                score: 90,
            });
            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'passed', written: true });

            // Content ratifies the very value the policy wrote (the
            // documented "written explicitly by content" case).
            pageWindow.scorm.SetCompletionStatus('passed');

            pageWindow.scorm.activities.register('quiz-2', { evaluable: true, completionRequired: true, total: 4 });
            expect(policy.reconcilePendingActivities()).toMatchObject({
                status: 'passed',
                written: false,
                reason: 'terminal-status-preserved',
            });
            expect(api.data['cmi.core.lesson_status']).toBe('passed');
        });

        it('quit() ends the session without completing the page and is idempotent', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            expect(pageWindow.scorm.quit()).toBe(true);
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
            const callCount = api.calls.length;
            expect(pageWindow.scorm.quit()).toBe(true);
            expect(api.calls.length).toBe(callCount);
        });

        it('SetScoreMax/SetScoreMin write the score bounds (game contract)', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.scorm.SetScoreMax(100);
            pageWindow.scorm.SetScoreMin(0);

            expect(api.data['cmi.core.score.max']).toBe('100');
            expect(api.data['cmi.core.score.min']).toBe('0');
        });

        it('SetScoreMax/SetScoreMin send each bound once per session', () => {
            // The bounds are constants for the attempt, and the legacy runtime puts one
            // pair on the wire, at initGame. Content sets them there and the runtime sets
            // them again with every score, so without a single owner an LMS sees the same
            // value two or three times a page — measured on a real 51-page project.
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.scorm.SetScoreMax(100);
            pageWindow.scorm.SetScoreMin(0);
            pageWindow.scorm.SetScoreMax(100);
            pageWindow.scorm.SetScoreMin(0);

            const bounds = api
                .callsFor('LMSSetValue')
                .filter(call => String(call[0]).startsWith('cmi.core.score.'));
            expect(bounds).toEqual([
                ['cmi.core.score.max', '100'],
                ['cmi.core.score.min', '0'],
            ]);
            expect(api.data['cmi.core.score.max']).toBe('100');
            expect(api.data['cmi.core.score.min']).toBe('0');
        });

        it('SetScoreMax sends again when the bound actually changes', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.scorm.SetScoreMax(100);
            pageWindow.scorm.SetScoreMax(10);

            expect(api.data['cmi.core.score.max']).toBe('10');
            expect(api.callsFor('LMSSetValue').filter(call => call[0] === 'cmi.core.score.max')).toEqual([
                ['cmi.core.score.max', '100'],
                ['cmi.core.score.max', '10'],
            ]);
        });

        it('SetScoreMax/SetScoreMin treat LMS 401 as unsupported, not an error', () => {
            const errorSpy = vi.fn();
            client.configure({
                getPipwerks: () => pipwerks,
                now: () => fakeNow,
                error: errorSpy,
                warn: warnSpy,
            });
            useLms({}, { profile: 'minimal' });
            pageWindow.loadPage();
            errorSpy.mockClear();

            pageWindow.scorm.SetScoreMax(100);
            pageWindow.scorm.SetScoreMin(0);

            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('GetLearnerName/GetLearnerId/GetScoreRaw read the learner elements', () => {
            useLms({
                'cmi.core.student_name': 'Learner, Test',
                'cmi.core.student_id': 'learner-1',
                'cmi.core.score.raw': '77',
            });
            pageWindow.loadPage();

            expect(pageWindow.scorm.GetLearnerName()).toBe('Learner, Test');
            expect(pageWindow.scorm.GetLearnerId()).toBe('learner-1');
            expect(pageWindow.scorm.GetScoreRaw()).toBe('77');
        });

        it('SetCompletionStatus rejects the SCORM 2004 value "unknown" (no downgrade)', () => {
            const consoleWarnSpy = vi.spyOn(pageWindow.console, 'warn').mockImplementation(() => {});
            useLms({ 'cmi.core.lesson_status': 'incomplete' });
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.scorm.SetCompletionStatus('unknown');

            expect(api.callsFor('LMSSetValue')).toEqual([]);
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
            consoleWarnSpy.mockRestore();
        });

        it('SetSuccessStatus is a validated no-op in SCORM 1.2', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.scorm.SetSuccessStatus('passed');

            expect(api.calls).toEqual([]);
        });

        it('SetExit validates the vocabulary and maps "normal" to ""', () => {
            useLms({});
            pageWindow.loadPage();

            pageWindow.scorm.SetExit('normal');
            expect(api.data['cmi.core.exit']).toBe('');
            pageWindow.scorm.SetExit('suspend');
            expect(api.data['cmi.core.exit']).toBe('suspend');
            api.calls.length = 0;
            pageWindow.scorm.SetExit('bogus');
            expect(api.callsFor('LMSSetValue')).toEqual([]);
        });
    });

    describe('full extension surface', () => {
        it('maps every documented extension method onto the SCORM 1.2 data model', () => {
            const consoleWarnSpy = vi.spyOn(pageWindow.console, 'warn').mockImplementation(() => {});
            useLms({ 'cmi._version': '3.4', 'cmi.core.lesson_mode': 'normal' });
            pageWindow.loadPage();
            const facade = pageWindow.scorm;

            expect(facade.isAvailable()).toBe(true);
            expect(facade.GetDataModelVersion()).toBe('3.4');
            expect(facade.GetCompletionStatus()).toBe('incomplete');

            facade.SetCompletionStatus('completed');
            expect(api.data['cmi.core.lesson_status']).toBe('completed');
            facade.SetCompletionScormActivity('incomplete');
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
            expect(facade.GetSuccessStatus()).toBe('incomplete');

            facade.SetExit('time-out');
            expect(api.data['cmi.core.exit']).toBe('time-out');
            facade.SetExit('logout');
            expect(facade.GetExit()).toBe('logout');

            facade.SetInteractionValue('cmi.interactions.0.student_response', 'a');
            expect(facade.GetInteractionValue('cmi.interactions.0.student_response')).toBe('a');

            expect(facade.GetMode()).toBe('normal');
            // SetMode is a documented no-op: cmi.core.lesson_mode is read-only
            // in SCORM 1.2, so the legacy setter never had a legal LMS call.
            facade.SetMode('review');
            expect(api.data['cmi.core.lesson_mode']).toBe('normal');
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('SetMode'));

            facade.SetScoreRaw(55);
            expect(facade.GetScoreRaw()).toBe('55');
            facade.SetScoreMax(100);
            expect(facade.GetScoreMax()).toBe('100');
            facade.SetScoreMin(0);
            expect(facade.GetScoreMin()).toBe('0');
            expect(() => facade.SetScoreScaled()).not.toThrow();

            facade.SetSessionTime('0000:10:00.00');
            expect(facade.GetSessionTime()).toBe('0000:10:00.00');

            facade.SetSuccessStatus('bogus');
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('SetSuccessStatus'));

            consoleWarnSpy.mockRestore();
        });
    });

    describe('pipwerks.SCORM augmentation', () => {
        it('attaches the extension methods to pipwerks.SCORM (geogebra contract)', () => {
            expect(typeof pipwerks.SCORM.SetScoreMax).toBe('function');
            expect(typeof pipwerks.SCORM.SetScoreMin).toBe('function');
            expect(typeof pipwerks.SCORM.GetLearnerName).toBe('function');

            useLms({});
            pageWindow.loadPage();
            pipwerks.SCORM.SetScoreMax('100');
            expect(api.data['cmi.core.score.max']).toBe('100');
        });

        it('does not replace upstream members', () => {
            expect(pipwerks.SCORM.data.get).not.toBe(pageWindow.scorm.get);
            expect(pipwerks.SCORM.connection.initialize).toBeDefined();
        });

        it('leaves the vendored isAvailable implementation in place', () => {
            // `isAvailable` is the one extension name the upstream wrapper
            // already defines, so it is the only real test of the
            // "additive only" guard. Both implementations return true, so only
            // the function identity can tell them apart: if the guard were
            // dropped, pipwerks.SCORM.isAvailable would become the very
            // function the facade holds.
            expect(typeof pipwerks.SCORM.isAvailable).toBe('function');
            expect(pipwerks.SCORM.isAvailable).not.toBe(pageWindow.scorm.isAvailable);
        });
    });

    describe('exe_export.js handover', () => {
        it('pagehide applies the scored-activities flag set via setPageHasScoredActivities', () => {
            useLms({});
            pageWindow.loadPage();
            pageWindow.exeScorm12.setPageHasScoredActivities(true);
            api.calls.length = 0;

            fakeWindow.fire('pagehide', { persisted: false });

            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
            expect(api.data['cmi.core.exit']).toBe('suspend');
            expect(api.callNames()).toContain('LMSFinish');
        });

        it('the activity registry wins over the page-level flag', () => {
            useLms({});
            pageWindow.loadPage();
            pageWindow.exeScorm12.setPageHasScoredActivities(true);
            pageWindow.scorm.activities.register('quiz-1', {
                evaluable: true,
                completionRequired: true,
                completed: true,
                score: 90,
            });
            api.calls.length = 0;

            fakeWindow.fire('pagehide', { persisted: false });

            expect(api.data['cmi.core.lesson_status']).toBe('passed');
            expect(api.data['cmi.core.exit']).toBe('');
        });
    });

    describe('compatibility methods never issue an invalid SCORM 1.2 call', () => {
        it('GetExit reads the local cache instead of a write-only element', () => {
            useLms({});
            pageWindow.loadPage();
            pageWindow.scorm.SetExit('suspend');
            api.calls.length = 0;

            expect(pageWindow.scorm.GetExit()).toBe('suspend');
            expect(api.calls).toEqual([]);
        });

        it('GetExit answers "" before anything was written', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            expect(pageWindow.scorm.GetExit()).toBe('');
            expect(api.calls).toEqual([]);
        });

        it('GetSessionTime reads the local cache instead of a write-only element', () => {
            useLms({});
            pageWindow.loadPage();
            fakeNow = 4000;
            pageWindow.computeTime();
            api.calls.length = 0;

            expect(pageWindow.scorm.GetSessionTime()).toBe('0000:00:03.00');
            expect(api.calls).toEqual([]);
        });

        it('GetInteractionValue reads the local cache for write-only leaves', () => {
            useLms({});
            pageWindow.loadPage();
            pageWindow.scorm.SetInteractionValue('cmi.interactions.0.result', 'correct');
            api.calls.length = 0;

            expect(pageWindow.scorm.GetInteractionValue('cmi.interactions.0.result')).toBe('correct');
            expect(api.calls).toEqual([]);
        });

        it('GetInteractionValue still reads the readable keywords from the LMS', () => {
            useLms({});
            pageWindow.loadPage();
            pageWindow.scorm.SetInteractionValue('cmi.interactions.0.id', 'q1');
            api.calls.length = 0;

            expect(pageWindow.scorm.GetInteractionValue('cmi.interactions._count')).toBe('1');
            expect(api.callsFor('LMSGetValue')).toEqual([['cmi.interactions._count']]);
        });

        it('SetMode is a no-op with no LMS traffic', () => {
            const consoleWarnSpy = vi.spyOn(pageWindow.console, 'warn').mockImplementation(() => {});
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.scorm.SetMode('review');

            expect(api.calls).toEqual([]);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('read-only'));
            consoleWarnSpy.mockRestore();
        });

        it('SetSuccessStatus is a no-op with no LMS traffic', () => {
            useLms({ 'cmi.core.lesson_status': 'incomplete' });
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.scorm.SetSuccessStatus('passed');
            pageWindow.scorm.SetSuccessStatus('failed');

            expect(api.calls).toEqual([]);
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
        });

        it('SetCompletionStatus refuses "not attempted", which a SCO may not write', () => {
            useLms({ 'cmi.core.lesson_status': 'incomplete' });
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.scorm.SetCompletionStatus('not attempted');

            expect(api.calls).toEqual([]);
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
        });

        it('GetMode assumes "normal" on an LMS that does not implement lesson_mode', () => {
            useLms({}, { profile: 'minimal' });
            pageWindow.loadPage();

            expect(pageWindow.scorm.GetMode()).toBe('normal');
        });

        it('GetScoreMax/GetScoreMin answer "" on an LMS without the optional bounds', () => {
            useLms({}, { profile: 'minimal' });
            pageWindow.loadPage();

            expect(pageWindow.scorm.GetScoreMax()).toBe('');
            expect(pageWindow.scorm.GetScoreMin()).toBe('');
        });

        it('setScore commits the raw score even when the LMS lacks the bounds', () => {
            useLms({}, { profile: 'minimal' });
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.setScore(85, 100, 0);

            expect(api.data['cmi.core.score.raw']).toBe('85');
            expect(api.callNames()).toContain('LMSCommit');
        });

        it('setScore does not commit when the required raw score was rejected', () => {
            useLms({}, { elementFailures: { 'cmi.core.score.raw': { errorCode: 101 } } });
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.setScore(85);

            expect(api.callNames()).not.toContain('LMSCommit');
        });
    });

    describe('centralized finalization', () => {
        it('routes pipwerks.SCORM.quit through the lifecycle layer', () => {
            useLms({ 'cmi.core.lesson_status': 'incomplete' });
            pageWindow.loadPage();
            api.calls.length = 0;

            expect(pipwerks.SCORM.quit()).toBe(true);

            expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
            // Legacy parity: quit() never applies the completion rule.
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
            expect(lifecycle.hasFinished()).toBe(true);
        });

        it('routes pipwerks.SCORM.connection.terminate through the lifecycle layer', () => {
            useLms({ 'cmi.core.lesson_status': 'incomplete' });
            pageWindow.loadPage();
            api.calls.length = 0;

            expect(pipwerks.SCORM.connection.terminate()).toBe(true);

            expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
        });

        it('a direct pipwerks termination followed by pagehide finishes exactly once', () => {
            useLms({ 'cmi.core.lesson_status': 'incomplete' });
            pageWindow.loadPage();
            api.calls.length = 0;

            pipwerks.SCORM.quit();
            fakeWindow.fire('pagehide', { persisted: false });

            expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
        });

        it('an iDevice quitting before pagehide finishes exactly once', () => {
            useLms({ 'cmi.core.lesson_status': 'incomplete' });
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.scorm.quit();
            fakeWindow.fire('pagehide', { persisted: false });

            expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
        });

        it('two iDevices requesting finish concurrently finish exactly once', () => {
            useLms({ 'cmi.core.lesson_status': 'incomplete' });
            pageWindow.loadPage();
            api.calls.length = 0;

            pageWindow.scorm.quit();
            pipwerks.SCORM.quit();
            pageWindow.doQuit();
            pageWindow.unloadPage(true);

            expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
        });

        it('an iDevice saving after another requested finish makes no LMS call', () => {
            useLms({ 'cmi.core.lesson_status': 'incomplete' });
            pageWindow.loadPage();
            pageWindow.scorm.quit();
            api.calls.length = 0;

            expect(pageWindow.scorm.set('cmi.suspend_data', 'late')).toBe(false);
            expect(pageWindow.scorm.save()).toBe(false);

            expect(api.calls).toEqual([]);
        });

        it('one iDevice storing local state while another updates the score both reach the LMS', () => {
            useLms({});
            pageWindow.loadPage();
            api.calls.length = 0;

            expect(pageWindow.scorm.set('cmi.suspend_data', 'state-a')).toBe(true);
            expect(pageWindow.scorm.SetScoreRaw(70)).toBe(true);

            expect(api.data['cmi.suspend_data']).toBe('state-a');
            expect(api.data['cmi.core.score.raw']).toBe('70');
        });

        it('keeps the shim reachable from the wrapper without editing the vendored file', () => {
            expect(typeof pipwerks.SCORM.connection.terminate.exeScorm12Native).toBe('function');
            expect(pipwerks.SCORM.quit).toBe(pipwerks.SCORM.connection.terminate);
        });
    });

    describe('bfcache lifecycle through the page globals', () => {
        it('a persisted pagehide keeps the globals usable and a later exit finishes once', () => {
            useLms({ 'cmi.core.lesson_status': 'incomplete' });
            pageWindow.loadPage();
            api.calls.length = 0;

            fakeWindow.fire('pagehide', { persisted: true });
            expect(api.callNames()).not.toContain('LMSFinish');

            fakeWindow.fire('pageshow', { persisted: true });
            expect(pageWindow.scorm.set('cmi.core.score.raw', '60')).toBe(true);

            fakeWindow.fire('pagehide', { persisted: false });
            expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
        });
    });
});
