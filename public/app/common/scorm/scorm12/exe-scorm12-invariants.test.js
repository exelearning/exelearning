/**
 * Sequence and property-based invariant tests for the SCORM 1.2 runtime.
 *
 * These drive the *public* surface — the page globals and the `scorm` facade —
 * through long sequences of lifecycle and content events, and assert the
 * properties that must hold whatever the order. Deterministic sequences cover
 * the cases that are known to be dangerous; a seeded generator covers the ones
 * nobody thought of. Seeds are fixed constants so a CI failure reproduces
 * exactly (the repository has no property-testing dependency, and adding one
 * for a pseudo-random walk this small would not pay for itself).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pipwerks = require('./vendor/pipwerks/SCORM_API_wrapper.js');
window.pipwerks = pipwerks;
const client = require('./exe-scorm12-client.js');
const activities = require('./exe-scorm12-activities.js');
const policy = require('./exe-scorm12-policy.js');
const lifecycle = require('./exe-scorm12-lifecycle.js');
require('./exe-scorm12-adapter.js');
const pageWindow = window;
const { createFakeScorm12Api, createFakeWindowTree, resetPipwerks } = require('./fake-scorm12-api.test-util.js');

/** Statuses that end the attempt and must never be downgraded. */
const TERMINAL = ['passed', 'completed', 'failed'];

/** Minimal event target that hands listeners a real event object. */
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
                handler(Object.assign({ type, persisted: false }, event));
            }
        },
    };
}

/**
 * xorshift32 — a tiny deterministic generator. Seeded explicitly so a failing
 * case is reproducible from the seed printed in the test name.
 *
 * @param {number} seed - Non-zero 32-bit seed.
 * @returns {function(number): number} Draws an integer in [0, bound).
 */
function createRandom(seed) {
    let state = seed >>> 0 || 1;
    return function next(bound) {
        state ^= state << 13;
        state >>>= 0;
        state ^= state >> 17;
        state ^= state << 5;
        state >>>= 0;
        return state % bound;
    };
}

describe('exe-scorm12 runtime invariants', () => {
    let api;
    let clock;
    let fakeWindow;
    let fakeDocument;
    let statusHistory;
    /**
     * Every status the *completion policy* decided, paired with the registry
     * state at the moment it decided. Recorded by wrapping the two policy
     * entry points that write a decided status, so the invariants below check
     * the policy's output against the registry rather than re-deriving the
     * decision from the same data (which would be a tautology).
     */
    let policyDecisions;
    const originalApplyDecidedStatus = policy.applyDecidedStatus;
    const originalRecordActivityOutcome = policy.recordActivityOutcome;

    function recordDecision(name, original) {
        return function (aggregateScore) {
            const before = activities.summary();
            const result = original.call(policy, aggregateScore);
            policyDecisions.push({ entryPoint: name, before: before, result: result });
            return result;
        };
    }

    /**
     * Boot a page against a fresh LMS and start recording status transitions.
     *
     * @param {object} [options] - Fake LMS options.
     * @returns {object} The fake API.
     */
    function bootPage(options = {}) {
        api = createFakeScorm12Api(options);
        const nativeSetValue = api.LMSSetValue;
        api.LMSSetValue = function (element, value) {
            const result = nativeSetValue.call(api, element, value);
            if (element === 'cmi.core.lesson_status' && result === 'true') {
                statusHistory.push(value);
            }
            return result;
        };
        vi.stubGlobal('window', createFakeWindowTree('self', api));
        return api;
    }

    beforeEach(() => {
        clock = 1000;
        statusHistory = [];
        policyDecisions = [];
        policy.applyDecidedStatus = recordDecision('applyDecidedStatus', originalApplyDecidedStatus);
        policy.recordActivityOutcome = recordDecision('recordActivityOutcome', originalRecordActivityOutcome);
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
        pageWindow.exeScorm12.resetAdapterForTests();
    });

    afterEach(() => {
        policy.applyDecidedStatus = originalApplyDecidedStatus;
        policy.recordActivityOutcome = originalRecordActivityOutcome;
        vi.unstubAllGlobals();
        lifecycle.resetDependencies();
        policy.resetDependencies();
        activities.resetDependencies();
        client.resetDependencies();
    });

    /** Every operation a page can perform, keyed by name. */
    const OPERATIONS = {
        load: () => pageWindow.loadPage(),
        initialize: () => pageWindow.scorm.init(),
        hidden: () => {
            fakeDocument.visibilityState = 'hidden';
            fakeDocument.fire('visibilitychange');
        },
        visible: () => {
            fakeDocument.visibilityState = 'visible';
            fakeDocument.fire('visibilitychange');
        },
        'pagehide-persisted': () => fakeWindow.fire('pagehide', { persisted: true }),
        'pagehide-final': () => fakeWindow.fire('pagehide', { persisted: false }),
        'pageshow-persisted': () => fakeWindow.fire('pageshow', { persisted: true }),
        'set-score': () => pageWindow.setScore(75, 100, 0),
        'set-completion': () => pageWindow.setComplete(),
        'register-activity': () =>
            pageWindow.scorm.activities.register('quiz-1', { evaluable: true, completionRequired: true, total: 4 }),
        'complete-activity': () =>
            pageWindow.scorm.activities.update('quiz-1', { completed: true, answered: 4, score: 80 }),
        commit: () => pageWindow.scorm.save(),
        quit: () => pageWindow.scorm.quit(),
        finish: () => pageWindow.doQuit(),
        'unload-page': () => pageWindow.unloadPage(true),
        'external-close': () => {
            pipwerks.SCORM.connection.isActive = false;
        },
        tick: () => {
            clock += 1000;
        },
    };

    const OPERATION_NAMES = Object.keys(OPERATIONS);

    /**
     * Run a sequence of operations, then check every invariant that holds for
     * any sequence whatsoever.
     *
     * @param {string[]} sequence - Operation names.
     * @param {string} label - Description used in failure messages.
     */
    function runSequence(sequence, label) {
        for (const name of sequence) {
            expect(() => OPERATIONS[name](), `${label}: ${name} threw`).not.toThrow();
        }

        const names = api.callNames();

        // 1. LMSInitialize reaches the LMS at most once.
        expect(names.filter(name => name === 'LMSInitialize').length, `${label}: LMSInitialize count`).toBeLessThanOrEqual(1);

        // 2. LMSFinish reaches the LMS at most once.
        expect(names.filter(name => name === 'LMSFinish').length, `${label}: LMSFinish count`).toBeLessThanOrEqual(1);

        // 3. No LMS call after a finish attempt.
        const finishIndex = names.indexOf('LMSFinish');
        if (finishIndex !== -1) {
            expect(names.slice(finishIndex + 1), `${label}: calls after LMSFinish`).toEqual([]);
        }

        // 4. A terminal status is never downgraded.
        for (let index = 1; index < statusHistory.length; index += 1) {
            if (TERMINAL.indexOf(statusHistory[index - 1]) !== -1) {
                expect(TERMINAL, `${label}: downgrade ${statusHistory[index - 1]} → ${statusHistory[index]}`).toContain(
                    statusHistory[index],
                );
            }
        }

        // 5. The completion policy never decides a terminal status while a
        //    required activity is still pending. Checked per decision against
        //    the registry state captured at that moment, so a policy that
        //    always answered "completed" would fail here.
        //    (Content is still free to record a status explicitly through
        //    setComplete()/SetCompletionStatus(); that is not a policy
        //    decision, and `terminal-status-preserved` is the policy declining
        //    to overwrite it.)
        for (const decision of policyDecisions) {
            if (decision.result.reason === 'terminal-status-preserved') {
                continue;
            }
            if (decision.before.hasRequired && !decision.before.allRequiredComplete) {
                expect(decision.result.status, `${label}: ${decision.entryPoint} with pending activities`).toBe(
                    'incomplete',
                );
            }
        }

        // 6. Pass/fail is only decided once every required activity is done.
        for (const decision of policyDecisions) {
            if (decision.result.status !== 'passed' && decision.result.status !== 'failed') {
                continue;
            }
            if (decision.result.reason === 'terminal-status-preserved') {
                continue;
            }
            expect(decision.before.allRequiredComplete, `${label}: premature pass/fail`).toBe(true);
        }

        // 7. Visibility changes never finish the session.
        const visibilityOnly = sequence.every(name => name !== 'pagehide-final' && name !== 'quit' && name !== 'finish' && name !== 'unload-page');
        if (visibilityOnly) {
            expect(names, `${label}: a visibility-only sequence finished`).not.toContain('LMSFinish');
        }

        // 8. Every value the LMS accepted is still the stored value, unless a
        //    later accepted write replaced it. An optional element failing must
        //    never discard data the LMS took.
        const lastAccepted = {};
        for (const call of api.calls) {
            if (call.method !== 'LMSSetValue' || call.args[0] === 'cmi.comments') {
                continue;
            }
            // The fake returns 'true' only for writes it accepted; a rejected
            // write leaves the previous value in place.
            lastAccepted[call.args[0]] = String(call.args[1]);
        }
        for (const element of Object.keys(lastAccepted)) {
            if (api.data[element] === undefined) {
                // The write was rejected and the element has no stored value.
                continue;
            }
            expect(api.data[element], `${label}: ${element} lost its accepted value`).toBe(lastAccepted[element]);
        }
    }

    describe('deterministic sequences', () => {
        const SEQUENCES = [
            ['load', 'pagehide-final'],
            ['load', 'hidden', 'pagehide-final'],
            ['load', 'hidden', 'pagehide-persisted', 'pageshow-persisted', 'visible', 'pagehide-final'],
            ['load', 'pagehide-persisted', 'pagehide-persisted', 'pageshow-persisted', 'pagehide-final'],
            ['load', 'pageshow-persisted', 'pagehide-final'],
            ['load', 'quit', 'pagehide-final'],
            ['load', 'pagehide-final', 'quit'],
            ['load', 'finish', 'unload-page', 'quit'],
            ['load', 'external-close', 'pagehide-final'],
            ['load', 'external-close', 'quit', 'commit', 'set-score'],
            ['load', 'register-activity', 'pagehide-final'],
            ['load', 'register-activity', 'complete-activity', 'pagehide-final'],
            ['load', 'register-activity', 'complete-activity', 'complete-activity', 'pagehide-final'],
            ['load', 'set-score', 'hidden', 'visible', 'set-score', 'pagehide-final'],
            ['load', 'set-completion', 'register-activity', 'pagehide-final'],
            ['load', 'initialize', 'initialize', 'load', 'pagehide-final'],
            ['pagehide-final', 'load'],
            ['load', 'tick', 'hidden', 'tick', 'pagehide-persisted', 'tick', 'pageshow-persisted', 'tick', 'pagehide-final'],
        ];

        it.each(SEQUENCES.map(sequence => [sequence.join(' → '), sequence]))('holds every invariant for %s', (label, sequence) => {
            bootPage();
            pageWindow.loadPage();
            lifecycle.install();
            pageWindow.exeScorm12.resetAdapterForTests();
            api.resetCalls();
            statusHistory.length = 0;

            runSequence(sequence, label);
        });
    });

    describe('seeded random sequences', () => {
        const SEEDS = [1, 7, 42, 1337, 20260804, 987654321];

        it.each(SEEDS)('holds every invariant for seed %d', seed => {
            const random = createRandom(seed);
            bootPage();
            pageWindow.loadPage();
            lifecycle.install();
            pageWindow.exeScorm12.resetAdapterForTests();
            api.resetCalls();
            statusHistory.length = 0;

            const sequence = [];
            for (let step = 0; step < 40; step += 1) {
                sequence.push(OPERATION_NAMES[random(OPERATION_NAMES.length)]);
            }

            runSequence(sequence, `seed ${seed}: ${sequence.join(',')}`);
        });

        it.each([
            ['minimal', 'minimal'],
            ['intermediate', 'intermediate'],
            ['complete', 'complete'],
        ])('holds every invariant against a %s LMS', (_label, profile) => {
            const random = createRandom(0x5eed);
            bootPage({ profile });
            pageWindow.loadPage();
            lifecycle.install();
            pageWindow.exeScorm12.resetAdapterForTests();
            api.resetCalls();
            statusHistory.length = 0;

            const sequence = [];
            for (let step = 0; step < 30; step += 1) {
                sequence.push(OPERATION_NAMES[random(OPERATION_NAMES.length)]);
            }

            runSequence(sequence, `${profile}: ${sequence.join(',')}`);
        });
    });

    describe('order independence of the persisted result', () => {
        /**
         * Play a set of content events in a given order and report what the
         * LMS ends up storing.
         *
         * @param {string[]} order - Operation names to play before exiting.
         * @returns {object} The stored data model.
         */
        function persistedAfter(order) {
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
            pageWindow.exeScorm12.resetAdapterForTests();
            bootPage();
            pageWindow.loadPage();
            for (const name of order) {
                OPERATIONS[name]();
            }
            fakeWindow.fire('pagehide', { persisted: false });
            return api.data;
        }

        it('reordering independent content events does not change the stored result', () => {
            const first = persistedAfter(['register-activity', 'complete-activity', 'set-score']);
            const second = persistedAfter(['set-score', 'register-activity', 'complete-activity']);

            for (const element of [
                'cmi.core.lesson_status',
                'cmi.core.score.raw',
                'cmi.core.exit',
                'cmi.suspend_data',
            ]) {
                expect(second[element], element).toBe(first[element]);
            }
        });

        it('reporting the same activity twice does not change the aggregate', () => {
            const once = persistedAfter(['register-activity', 'complete-activity']);
            const twice = persistedAfter(['register-activity', 'complete-activity', 'complete-activity', 'register-activity']);

            expect(twice['cmi.suspend_data']).toBe(once['cmi.suspend_data']);
            expect(twice['cmi.core.lesson_status']).toBe(once['cmi.core.lesson_status']);
        });
    });
});
