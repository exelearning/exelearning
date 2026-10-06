import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pipwerks = require('./vendor/pipwerks/SCORM_API_wrapper.js');
const client = require('./exe-scorm12-client.js');
const activities = require('./exe-scorm12-activities.js');
const policy = require('./exe-scorm12-policy.js');
const lifecycle = require('./exe-scorm12-lifecycle.js');
const { createFakeScorm12Api, createFakeWindowTree, resetPipwerks } = require('./fake-scorm12-api.test-util.js');

/**
 * Minimal event target capturing listeners so tests can fire them with a real
 * event object — `pagehide`/`pageshow` carry `persisted`, and the runtime
 * branches on it.
 */
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

describe('exe-scorm12-lifecycle', () => {
    let api;
    let fakeWindow;
    let fakeDocument;
    let clock;

    function startSession(initialData, options = {}) {
        api = createFakeScorm12Api(Object.assign({ data: initialData }, options));
        vi.stubGlobal('window', createFakeWindowTree('self', api));
        expect(client.initialize()).toBe(true);
        api.resetCalls();
    }

    beforeEach(() => {
        clock = 1000;
        resetPipwerks(pipwerks);
        client.resetDependencies();
        client.configure({ getPipwerks: () => pipwerks, now: () => clock, error: vi.fn(), warn: vi.fn() });
        activities.resetDependencies();
        activities.configure({ warn: vi.fn() });
        policy.resetDependencies();
        policy.configure({ getClient: () => client, getActivities: () => activities, warn: vi.fn() });
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
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        lifecycle.resetDependencies();
        policy.resetDependencies();
        activities.resetDependencies();
        client.resetDependencies();
    });

    describe('listener installation', () => {
        it('registers no unload or beforeunload handlers', () => {
            lifecycle.install();

            expect(Object.keys(fakeWindow.listeners).sort()).toEqual(['pagehide', 'pageshow']);
            expect(Object.keys(fakeDocument.listeners)).toEqual(['visibilitychange']);
        });

        it('installs its listeners only once', () => {
            lifecycle.install();
            lifecycle.install();

            expect(fakeWindow.listeners.pagehide).toHaveLength(1);
            expect(fakeWindow.listeners.pageshow).toHaveLength(1);
            expect(fakeDocument.listeners.visibilitychange).toHaveLength(1);
        });
    });

    describe('pagehide', () => {
        it('persisted=false ends the session once: status, exit, session time, commit, finish', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();

            fakeWindow.fire('pagehide', { persisted: false });

            expect(api.callSignatures()).toEqual([
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.lesson_status=completed)',
                'LMSSetValue(cmi.core.exit=)',
                'LMSSetValue(cmi.core.session_time=0000:00:00.00)',
                'LMSCommit',
                'LMSFinish',
            ]);
            expect(lifecycle.hasFinished()).toBe(true);
        });

        it('an event without a persisted property is treated as a real exit', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();

            fakeWindow.fire('pagehide', {});

            expect(api.callNames()).toContain('LMSFinish');
        });

        it('persisted=true persists the session without finishing it', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            clock = 4000;

            fakeWindow.fire('pagehide', { persisted: true });

            expect(api.callSignatures()).toEqual([
                'LMSSetValue(cmi.core.session_time=0000:00:03.00)',
                'LMSCommit',
            ]);
            expect(api.callNames()).not.toContain('LMSFinish');
            expect(client.isActive()).toBe(true);
            expect(lifecycle.hasFinished()).toBe(false);
            expect(lifecycle.isFrozen()).toBe(true);
        });

        it('pauses the session clock while the page is in the back/forward cache', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            clock = 4000;

            fakeWindow.fire('pagehide', { persisted: true });
            expect(client.isClockRunning()).toBe(false);

            // An hour passes while the page is frozen.
            clock = 3604000;
            expect(client.getElapsedMs()).toBe(3000);
        });

        it('a second pagehide does nothing', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            fakeWindow.fire('pagehide', { persisted: false });
            const callCount = api.calls.length;

            fakeWindow.fire('pagehide', { persisted: false });

            expect(api.calls.length).toBe(callCount);
            expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
        });

        it('a persisted pagehide after a real one makes no LMS call', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            fakeWindow.fire('pagehide', { persisted: false });
            api.resetCalls();

            fakeWindow.fire('pagehide', { persisted: true });

            expect(api.calls).toEqual([]);
        });
    });

    describe('pageshow', () => {
        it('persisted=true resumes the clock and keeps the runtime usable', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            clock = 4000;
            fakeWindow.fire('pagehide', { persisted: true });
            api.resetCalls();

            // Restored an hour later.
            clock = 3604000;
            fakeWindow.fire('pageshow', { persisted: true });

            expect(lifecycle.isFrozen()).toBe(false);
            expect(client.isClockRunning()).toBe(true);
            // The frozen hour is not counted; only the 3 s before freezing.
            expect(client.getElapsedMs()).toBe(3000);
            // No re-initialization: the LMS session was never closed.
            expect(api.callNames()).not.toContain('LMSInitialize');
            expect(client.setValue('cmi.core.score.raw', '70')).toBe(true);
        });

        it('a full hidden → frozen → restored → exit cycle finishes exactly once', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();

            clock = 2000;
            fakeDocument.visibilityState = 'hidden';
            fakeDocument.fire('visibilitychange');
            clock = 3000;
            fakeWindow.fire('pagehide', { persisted: true });
            clock = 9000;
            fakeWindow.fire('pageshow', { persisted: true });
            fakeDocument.visibilityState = 'visible';
            clock = 11000;
            fakeWindow.fire('pagehide', { persisted: false });

            expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
            // 1000→3000 before freezing plus 9000→11000 after restoring.
            expect(api.callsFor('LMSSetValue').filter(args => args[0] === 'cmi.core.session_time').pop()).toEqual([
                'cmi.core.session_time',
                '0000:00:04.00',
            ]);
        });

        it('persisted=false (a normal load) resumes nothing', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            clock = 4000;
            fakeWindow.fire('pagehide', { persisted: true });

            fakeWindow.fire('pageshow', { persisted: false });

            expect(lifecycle.isFrozen()).toBe(true);
            expect(client.isClockRunning()).toBe(false);
        });

        it('pageshow without a previous freeze leaves a running clock alone', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            clock = 4000;

            fakeWindow.fire('pageshow', { persisted: true });

            expect(client.isClockRunning()).toBe(true);
            // resumeClock() is idempotent: the running segment is not restarted.
            expect(client.getElapsedMs()).toBe(3000);
        });
    });

    describe('visibilitychange', () => {
        it('to hidden writes the session time and commits, never finishing', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            clock = 6000;

            fakeDocument.visibilityState = 'hidden';
            fakeDocument.fire('visibilitychange');

            expect(api.callSignatures()).toEqual([
                'LMSSetValue(cmi.core.session_time=0000:00:05.00)',
                'LMSCommit',
            ]);
            expect(api.callNames()).not.toContain('LMSFinish');
            expect(client.isActive()).toBe(true);
            expect(client.setValue('cmi.core.score.raw', '70')).toBe(true);
        });

        it('to hidden persists the activity registry before the session time', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            activities.register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 80 });

            fakeDocument.visibilityState = 'hidden';
            fakeDocument.fire('visibilitychange');

            // A page killed after this commit (mobile app switch) must be
            // able to restore its activity state, not only its session time.
            const signatures = api.callSignatures();
            expect(signatures[0]).toMatch(/^LMSSetValue\(cmi\.suspend_data=exe12\//);
            expect(signatures.slice(1)).toEqual([
                'LMSSetValue(cmi.core.session_time=0000:00:00.00)',
                'LMSCommit',
            ]);
        });

        it('a persisted pagehide stores the activity registry too', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            activities.register('quiz-1', { evaluable: true, completionRequired: true, answered: 2, total: 5 });

            fakeWindow.fire('pagehide', { persisted: true });

            // With a required activity pending, persist() first reconciles
            // the lesson status against the registry (a read; the stored
            // "incomplete" already matches), then stores the registry.
            const signatures = api.callSignatures();
            expect(signatures[0]).toBe('LMSGetValue(cmi.core.lesson_status)');
            expect(signatures[1]).toMatch(/^LMSSetValue\(cmi\.suspend_data=exe12\//);
            expect(api.callNames()).not.toContain('LMSFinish');
        });

        it('persist() corrects a stale terminal verdict before committing', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            activities.register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });
            policy.recordActivityOutcome();
            expect(api.data['cmi.core.lesson_status']).toBe('passed');
            // A second iDevice initialises late, after the verdict.
            activities.register('quiz-2', { evaluable: true, completionRequired: true, total: 4 });
            api.resetCalls();

            fakeDocument.visibilityState = 'hidden';
            fakeDocument.fire('visibilitychange');

            // The commit must never freeze a terminal verdict alongside a
            // registry that still has required work pending — the page may
            // be killed right after this commit.
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
            expect(api.data['cmi.suspend_data']).toContain('quiz-2');
            const signatures = api.callSignatures();
            expect(signatures.indexOf('LMSSetValue(cmi.core.lesson_status=incomplete)')).toBeLessThan(
                signatures.indexOf('LMSCommit'),
            );
        });

        it('persist() reports every step it took', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            activities.register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 80 });

            expect(lifecycle.persist()).toEqual({
                activitiesWritten: true,
                sessionTimeWritten: true,
                committed: true,
            });
        });

        it('persist() reports an activities write the LMS refused', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.configure({
                getClient: () => client,
                getPolicy: () => ({
                    reconcilePendingActivities: () => null,
                    persistActivities: () => false,
                }),
                getWindow: () => fakeWindow,
                getDocument: () => fakeDocument,
            });

            // A caller must be able to tell a full commit from one whose
            // suspend_data write failed — "committed" alone would claim more
            // than the LMS accepted.
            expect(lifecycle.persist()).toEqual({
                activitiesWritten: false,
                sessionTimeWritten: true,
                committed: true,
            });
        });

        it('repeated hidden/visible cycles report the total, never a sum of deltas', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();

            clock = 3000;
            fakeDocument.visibilityState = 'hidden';
            fakeDocument.fire('visibilitychange');
            fakeDocument.visibilityState = 'visible';
            fakeDocument.fire('visibilitychange');
            clock = 6000;
            fakeDocument.visibilityState = 'hidden';
            fakeDocument.fire('visibilitychange');

            const written = api
                .callsFor('LMSSetValue')
                .filter(args => args[0] === 'cmi.core.session_time')
                .map(args => args[1]);
            expect(written).toEqual(['0000:00:02.00', '0000:00:05.00']);
        });

        it('while visible does nothing', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();

            fakeDocument.fire('visibilitychange');

            expect(api.calls).toEqual([]);
        });

        it('after finish does nothing', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();
            fakeWindow.fire('pagehide', { persisted: false });
            const callCount = api.calls.length;

            fakeDocument.visibilityState = 'hidden';
            fakeDocument.fire('visibilitychange');

            expect(api.calls.length).toBe(callCount);
        });
    });

    describe('finalization', () => {
        it('is a no-op when the session never started', () => {
            api = createFakeScorm12Api();
            vi.stubGlobal('window', createFakeWindowTree('none', api));
            lifecycle.install();

            expect(lifecycle.finish()).toBe(true);
            expect(api.calls).toEqual([]);
            // Nothing was opened, so nothing was finalized and the one-shot
            // latch stays available.
            expect(lifecycle.hasFinished()).toBe(false);
            expect(lifecycle.getReport()).toBeNull();
        });

        it('records a no-active-session report once the session has already ended', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            expect(client.terminate()).toBe(true);
            api.resetCalls();

            expect(lifecycle.finish()).toBe(true);

            expect(api.calls).toEqual([]);
            expect(lifecycle.getReport().reason).toBe('no-active-session');
        });

        it('a finish requested before the session opened does not silence the real one', () => {
            // Legacy content can call doQuit() from a script that runs before
            // the body onload handler. That must not consume the one-shot
            // latch, or the page would never send LMSFinish at all.
            api = createFakeScorm12Api({ data: { 'cmi.core.lesson_status': 'incomplete' } });
            vi.stubGlobal('window', createFakeWindowTree('self', api));
            lifecycle.install();

            expect(lifecycle.finish(false)).toBe(true);
            expect(lifecycle.hasFinished()).toBe(false);
            expect(api.calls).toEqual([]);

            expect(client.initialize()).toBe(true);
            fakeWindow.fire('pagehide', { persisted: false });

            expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
        });

        it('exposes hasFinished() and a report', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            expect(lifecycle.hasFinished()).toBe(false);
            expect(lifecycle.getReport()).toBeNull();

            lifecycle.finish();

            expect(lifecycle.hasFinished()).toBe(true);
            expect(lifecycle.getReport()).toMatchObject({
                finished: true,
                terminated: true,
                status: 'completed',
                exit: '',
                state: 'finished',
            });
        });

        it('records a failed termination as failed and never retries it', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' }, { failures: { LMSFinish: {} } });
            lifecycle.install();

            expect(lifecycle.finish()).toBe(false);
            expect(lifecycle.getReport().terminated).toBe(false);
            expect(client.getState()).toBe('finish_failed');

            api.resetCalls();
            expect(lifecycle.finish()).toBe(false);
            expect(api.calls).toEqual([]);
        });

        it('aborts the termination when the commit inside the wrapper fails', () => {
            // The vendored pipwerks wrapper commits before LMSFinish and skips
            // the finish when the commit fails; the runtime records that as a
            // failed termination and does not retry during teardown.
            startSession({ 'cmi.core.lesson_status': 'incomplete' }, { failures: { LMSCommit: {} } });
            lifecycle.install();

            expect(lifecycle.finish()).toBe(false);

            expect(api.callNames()).not.toContain('LMSFinish');
            expect(client.getState()).toBe('finish_failed');
        });

        it('without the completion rule keeps the stored status', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();

            lifecycle.finish(false);

            expect(api.callSignatures()).toEqual([
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.exit=suspend)',
                'LMSSetValue(cmi.core.session_time=0000:00:00.00)',
                'LMSCommit',
                'LMSFinish',
            ]);
        });

        it('a pagehide racing a quit finalizes once and replays the result', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            // A policy proxy that fires pagehide from inside the exit policy
            // models the browser dispatching the event while finish() is still
            // running — the guard must be raised before any LMS traffic.
            const reentrant = vi.fn(() => fakeWindow.fire('pagehide', { persisted: false }));
            lifecycle.configure({
                getClient: () => client,
                getPolicy: () => ({
                    applyExitPolicy(rule) {
                        reentrant();
                        return policy.applyExitPolicy(rule);
                    },
                }),
                getWindow: () => fakeWindow,
                getDocument: () => fakeDocument,
            });
            lifecycle.install();

            lifecycle.finish(false);

            expect(reentrant).toHaveBeenCalledTimes(1);
            expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
        });

        it('persist() is inert once a finalization has started', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.finish();
            api.resetCalls();

            expect(lifecycle.persist()).toEqual({
                activitiesWritten: false,
                sessionTimeWritten: false,
                committed: false,
            });
            expect(api.calls).toEqual([]);
        });

        it('notices a connection closed outside the runtime', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            lifecycle.install();

            // Legacy content holding a pre-wrap reference closes the session.
            pipwerks.SCORM.connection.isActive = false;
            api.resetCalls();

            expect(lifecycle.finish()).toBe(true);
            expect(api.calls).toEqual([]);
            expect(client.getState()).toBe('finished');
        });
    });

    it('falls back to the page window/document and global layer lookups by default', () => {
        lifecycle.resetDependencies();

        // install() on the real happy-dom window/document; finish() resolves
        // the client via window.exeScorm12 (attached by the layer modules).
        expect(() => lifecycle.install()).not.toThrow();
        expect(lifecycle.finish()).toBe(true);

        // resetDependencies removes the real listeners it installed.
        lifecycle.resetDependencies();
    });
});
