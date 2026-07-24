import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Load order mirrors the assembled package: vendored wrapper first (attached
// as the pipwerks global), then the runtime layers, then the adapter (which
// defines the legacy globals at load time).
const pipwerks = require('./vendor/pipwerks/SCORM_API_wrapper.js');
window.pipwerks = pipwerks;
const client = require('./exe-scorm12-client.js');
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
        fire(type) {
            for (const handler of listeners[type] || []) {
                handler();
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

    function useLms(initialData) {
        api = createFakeScorm12Api({ data: initialData });
        vi.stubGlobal('window', createFakeWindowTree('self', api));
    }

    beforeEach(() => {
        fakeNow = 1000;
        warnSpy = vi.fn();
        resetPipwerks(pipwerks);
        client.resetDependencies();
        client.configure({ getPipwerks: () => pipwerks, now: () => fakeNow, error: vi.fn(), warn: warnSpy });
        policy.resetDependencies();
        policy.configure({ getClient: () => client, warn: warnSpy });
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

    describe('loadPage', () => {
        it('initializes and applies the entry policy (exact call sequence)', () => {
            useLms({});

            pageWindow.loadPage();

            expect(api.callSignatures()).toEqual([
                'LMSInitialize',
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.lesson_status=incomplete)',
            ]);
            expect(fakeWindow.listeners.pagehide).toHaveLength(1);
        });

        it('preserves a terminal status on load', () => {
            useLms({ 'cmi.core.lesson_status': 'completed' });

            pageWindow.loadPage();

            expect(api.callSignatures()).toEqual(['LMSInitialize', 'LMSGetValue(cmi.core.lesson_status)']);
        });

        it('is idempotent (body onload and exe_export.js may both call it)', () => {
            useLms({});
            pageWindow.loadPage();
            const callCount = api.calls.length;

            pageWindow.loadPage();

            expect(api.calls.length).toBe(callCount);
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

            expect(api.callSignatures()).toEqual([
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.lesson_status=incomplete)',
                'LMSSetValue(cmi.core.exit=suspend)',
                'LMSSetValue(cmi.core.session_time=0000:00:00.00)',
                'LMSCommit',
                'LMSFinish',
            ]);
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
            facade.SetMode('review');
            expect(api.data['cmi.core.lesson_mode']).toBe('review');
            facade.SetMode('bogus');
            expect(api.data['cmi.core.lesson_mode']).toBe('review');
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
    });

    describe('exe_export.js handover', () => {
        it('pagehide applies the scored-activities flag set via setPageHasScoredActivities', () => {
            useLms({});
            pageWindow.loadPage();
            pageWindow.exeScorm12.setPageHasScoredActivities(true);
            api.calls.length = 0;

            fakeWindow.fire('pagehide');

            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
            expect(api.data['cmi.core.exit']).toBe('suspend');
            expect(api.callNames()).toContain('LMSFinish');
        });
    });
});
