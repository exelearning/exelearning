import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Full stack below the policy: vendored wrapper + client + strict fake LMS, so
// assertions run against the recorded LMS traffic, not against mocks of the
// code under test.
const pipwerks = require('./vendor/pipwerks/SCORM_API_wrapper.js');
const client = require('./exe-scorm12-client.js');
const activities = require('./exe-scorm12-activities.js');
const policy = require('./exe-scorm12-policy.js');
const { createFakeScorm12Api, createFakeWindowTree, resetPipwerks } = require('./fake-scorm12-api.test-util.js');

describe('exe-scorm12-policy', () => {
    let api;
    let warnSpy;
    let clientWarnSpy;

    function startSession(initialData, options = {}) {
        api = createFakeScorm12Api(Object.assign({ data: initialData }, options));
        vi.stubGlobal('window', createFakeWindowTree('self', api));
        expect(client.initialize()).toBe(true);
        api.resetCalls();
    }

    beforeEach(() => {
        warnSpy = vi.fn();
        clientWarnSpy = vi.fn();
        resetPipwerks(pipwerks);
        client.resetDependencies();
        client.configure({ getPipwerks: () => pipwerks, now: () => 1000, error: vi.fn(), warn: clientWarnSpy });
        activities.resetDependencies();
        activities.configure({ warn: vi.fn() });
        policy.resetDependencies();
        policy.configure({ getClient: () => client, getActivities: () => activities, warn: warnSpy });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        policy.resetDependencies();
        activities.resetDependencies();
        client.resetDependencies();
    });

    describe('entry policy', () => {
        it('promotes an empty status to incomplete', () => {
            startSession({ 'cmi.core.lesson_status': '' });

            policy.applyEntryPolicy();

            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
        });

        it('promotes "not attempted" to incomplete', () => {
            startSession({ 'cmi.core.lesson_status': 'not attempted' });

            policy.applyEntryPolicy();

            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
        });

        it.each(['incomplete', 'completed', 'passed', 'failed'])('preserves a stored "%s" status', status => {
            startSession({ 'cmi.core.lesson_status': status });

            policy.applyEntryPolicy();

            expect(api.data['cmi.core.lesson_status']).toBe(status);
            expect(api.callsFor('LMSSetValue')).toEqual([]);
        });

        it('restores the activity registry from cmi.suspend_data', () => {
            startSession({
                'cmi.core.lesson_status': 'incomplete',
                'cmi.suspend_data': 'exe12/1|quiz;7;3;5;60;1;0;100',
            });

            policy.applyEntryPolicy();

            expect(activities.get('quiz')).toMatchObject({ completed: true, answered: 3, total: 5, score: 60 });
        });

        it('restores cmi.core.score.raw from the loaded registry and does not write 0', () => {
            startSession({
                'cmi.core.lesson_status': 'incomplete',
                'cmi.core.score.raw': '80',
                'cmi.suspend_data': 'exe12/1|quiz;7;0;0;80;1;0;100',
            });

            policy.applyEntryPolicy();

            expect(api.data['cmi.core.score.raw']).toBe('80');
            expect(api.callsFor('LMSSetValue').filter(call => call[0] === 'cmi.core.score.raw')).toEqual([
                ['cmi.core.score.raw', '80'],
            ]);
        });

        it('writes no score at all when an evaluable activity is registered but unanswered', () => {
            // The real ordering, which the other entry-policy cases invert: iDevices
            // bootstrap on jQuery ready and register BEFORE loadPage() runs the entry
            // policy on the window load event. A learner who merely opens the page must
            // not be scored — cmi.core.score.raw cannot express "no answer", and a 0
            // there reads as "scored zero" to every LMS.
            startSession({ 'cmi.core.lesson_status': '' });
            activities.register('quiz-a', { evaluable: true, completionRequired: true, total: 4 });

            policy.applyEntryPolicy();

            expect(api.callsFor('LMSSetValue').filter(call => call[0] === 'cmi.core.score.raw')).toEqual([]);
            // The LMS keeps the SCORM 1.2 default it seeded, untouched.
            expect(api.data['cmi.core.score.raw']).toBe('');
        });

        it('still restores a real zero the LMS was already holding', () => {
            // The mirror image of the case above, and the reason the guard cannot simply
            // be "never write 0 on entry": a learner who genuinely scored 0 and comes
            // back must keep that 0, not lose it.
            startSession({
                'cmi.core.lesson_status': 'incomplete',
                'cmi.core.score.raw': '0',
                'cmi.suspend_data': 'exe12/1|quiz;7;4;4;0;1;0;100',
            });

            policy.applyEntryPolicy();

            expect(api.data['cmi.core.score.raw']).toBe('0');
        });

        it('sends the score bounds once, not again on every later score', () => {
            // The legacy runtime writes cmi.core.score.min/max once, at initGame, and
            // then only ever touches score.raw. Re-sending unchanged bounds on every
            // update is traffic the old runtime never produced — measured on a real
            // 51-page project, where 21 pages received the pair two or three times.
            startSession({ 'cmi.core.lesson_status': 'incomplete' });

            policy.setScoreDetailed(20, 0, 100);
            policy.setScoreDetailed(60, 0, 100);
            policy.setScoreDetailed(90, 0, 100);

            const bounds = api
                .callsFor('LMSSetValue')
                .filter(call => call[0] === 'cmi.core.score.min' || call[0] === 'cmi.core.score.max');
            expect(bounds).toEqual([
                ['cmi.core.score.min', '0'],
                ['cmi.core.score.max', '100'],
            ]);
            expect(api.callsFor('LMSSetValue').filter(call => call[0] === 'cmi.core.score.raw')).toEqual([
                ['cmi.core.score.raw', '20'],
                ['cmi.core.score.raw', '60'],
                ['cmi.core.score.raw', '90'],
            ]);
        });

        it('sends a bound again when it actually changes', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });

            policy.setScoreDetailed(20, 0, 100);
            policy.setScoreDetailed(3, 0, 10);

            expect(
                api.callsFor('LMSSetValue').filter(call => call[0] === 'cmi.core.score.max'),
            ).toEqual([['cmi.core.score.max', '100'], ['cmi.core.score.max', '10']]);
        });

        it('claims a pre-registered activity when suspend_data is loaded', () => {
            startSession({
                'cmi.core.lesson_status': 'incomplete',
                'cmi.core.score.raw': '40',
                'cmi.suspend_data': '1. "Quiz"; Score: 40%; Weight: 1%',
            });
            activities.register('quiz-a', { evaluable: true, completionRequired: true, legacyIndex: 1 });

            policy.applyEntryPolicy();

            expect(activities.get('quiz-a')).toMatchObject({ score: 40 });
            expect(api.data['cmi.core.score.raw']).toBe('40');
        });

        it('marks entry as applied so mid-session writers can talk to the LMS', () => {
            expect(policy.hasAppliedEntry()).toBe(false);
            startSession({});
            expect(policy.hasAppliedEntry()).toBe(false);

            policy.applyEntryPolicy();

            expect(policy.hasAppliedEntry()).toBe(true);
        });

        it('is idempotent: a second call re-reads nothing and writes nothing', () => {
            // session.open() can run more than once on a page — a host that opened the
            // session and the SCO's own loadPage() both call it — and the entry
            // decision is taken once. A repeated status write, a re-read of
            // suspend_data or a republished score is traffic the LMS must not see.
            startSession({
                'cmi.core.lesson_status': '',
                'cmi.core.score.raw': '80',
                'cmi.suspend_data': 'exe12/1|quiz;7;0;0;80;1;0;100',
            });

            policy.applyEntryPolicy();
            const firstPass = api.callSignatures();
            policy.applyEntryPolicy();

            expect(api.callSignatures()).toEqual(firstPass);
            const sets = api.callsFor('LMSSetValue');
            expect(sets.filter(call => call[0] === 'cmi.core.lesson_status')).toEqual([
                ['cmi.core.lesson_status', 'incomplete'],
            ]);
            expect(sets.filter(call => call[0] === 'cmi.core.score.min')).toEqual([['cmi.core.score.min', '0']]);
            expect(sets.filter(call => call[0] === 'cmi.core.score.max')).toEqual([['cmi.core.score.max', '100']]);
            expect(sets.filter(call => call[0] === 'cmi.core.score.raw')).toEqual([['cmi.core.score.raw', '80']]);
            expect(api.callsFor('LMSGetValue').map(call => call[0])).toEqual([
                'cmi.core.lesson_status',
                'cmi.student_data.mastery_score',
                'cmi.suspend_data',
            ]);
        });

        it('a repeated call never merges the stored records back over live progress', () => {
            // load() lets a restored record overwrite the progress of a live one, which
            // is right on entry and wrong afterwards: a second pass after the learner
            // answered would roll the registry back to the previous attempt.
            startSession({
                'cmi.core.lesson_status': 'incomplete',
                'cmi.suspend_data': 'exe12/1|quiz;7;0;0;80;1;0;100',
            });
            policy.applyEntryPolicy();
            activities.register('quiz', { evaluable: true, completionRequired: true, completed: true, score: 100 });

            policy.applyEntryPolicy();

            expect(activities.get('quiz')).toMatchObject({ completed: true, score: 100 });
        });

        it('does nothing, and does not latch, without an open session', () => {
            // Nothing was read from the LMS, so nothing was applied: the real entry
            // must still run once the session opens.
            api = createFakeScorm12Api({ data: { 'cmi.core.lesson_status': '' } });
            vi.stubGlobal('window', createFakeWindowTree('self', api));

            policy.applyEntryPolicy();

            expect(policy.hasAppliedEntry()).toBe(false);
            expect(api.calls).toEqual([]);
            expect(clientWarnSpy).not.toHaveBeenCalled();

            expect(client.initialize()).toBe(true);
            policy.applyEntryPolicy();

            expect(policy.hasAppliedEntry()).toBe(true);
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
        });

        it('adopts the LMS mastery score as the success threshold', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete', 'cmi.student_data.mastery_score': '70' });

            policy.applyEntryPolicy();

            expect(policy.getSuccessThreshold()).toBe(70);
        });

        it('keeps the eXeLearning default when the LMS does not implement mastery_score', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' }, { profile: 'minimal' });
            const errorSpy = vi.fn();
            client.configure({ getPipwerks: () => pipwerks, now: () => 1000, error: errorSpy, warn: vi.fn() });

            policy.applyEntryPolicy();

            expect(policy.getSuccessThreshold()).toBe(policy.DEFAULT_SUCCESS_THRESHOLD);
            // A "not implemented" answer to an optional probe is not an error.
            expect(errorSpy).not.toHaveBeenCalled();
        });
    });

    describe('status helpers', () => {
        it.each([
            ['setCompleted', 'completed'],
            ['setIncomplete', 'incomplete'],
            ['setPassed', 'passed'],
            ['setFailed', 'failed'],
        ])('%s writes "%s"', (helper, expected) => {
            startSession({});

            expect(policy[helper]()).toBe(true);

            expect(api.callsFor('LMSSetValue')).toEqual([['cmi.core.lesson_status', expected]]);
        });

        it('validates the SCORM 1.2 vocabulary', () => {
            expect(policy.isValidStatus('passed')).toBe(true);
            expect(policy.isValidStatus('browsed')).toBe(true);
            expect(policy.isValidStatus('not attempted')).toBe(true);
            expect(policy.isValidStatus('unknown')).toBe(false);
            expect(policy.isValidStatus('done')).toBe(false);
        });

        it('excludes "not attempted" from what a SCO may write', () => {
            // SCORM 1.2 requires the LMS to refuse it from a SCO.
            expect(policy.isWritableStatus('not attempted')).toBe(false);
            expect(policy.isWritableStatus('incomplete')).toBe(true);
        });
    });

    describe('setScore', () => {
        it('writes raw/min/max as strings', () => {
            startSession({});

            expect(policy.setScore(85, 0, 100)).toBe(true);

            expect(api.callsFor('LMSSetValue')).toEqual([
                ['cmi.core.score.raw', '85'],
                ['cmi.core.score.min', '0'],
                ['cmi.core.score.max', '100'],
            ]);
        });

        it('writes only the raw score when min/max are absent', () => {
            startSession({});

            expect(policy.setScore(42.5)).toBe(true);

            expect(api.callsFor('LMSSetValue')).toEqual([['cmi.core.score.raw', '42.5']]);
        });

        it.each([0, 100])('accepts the boundary value %d', value => {
            startSession({});

            expect(policy.setScore(value)).toBe(true);
            expect(api.data['cmi.core.score.raw']).toBe(String(value));
        });

        it('accepts numeric strings', () => {
            startSession({});

            expect(policy.setScore('66', '0', '100')).toBe(true);
            expect(api.data['cmi.core.score.raw']).toBe('66');
        });

        it.each([
            ['non-numeric raw', ['abc', 0, 100], 'raw-not-numeric'],
            ['raw below 0', [-1, 0, 100], 'raw-out-of-range'],
            ['raw above 100', [101, 0, 100], 'raw-out-of-range'],
            ['min above raw', [50, 60, 100], 'min-above-raw'],
            ['max below raw', [50, 0, 40], 'max-below-raw'],
            ['min above max', [50, 80, 60], 'min-above-raw'],
            ['NaN raw', [Number.NaN, 0, 100], 'raw-not-numeric'],
            ['Infinity raw', [Number.POSITIVE_INFINITY, 0, 100], 'raw-not-numeric'],
            ['non-numeric min', [50, 'x', 100], 'min-not-numeric'],
            ['non-numeric max', [50, 0, 'x'], 'max-not-numeric'],
            ['min out of range', [50, -1, 100], 'min-out-of-range'],
            ['max out of range', [50, 0, 101], 'max-out-of-range'],
        ])('rejects %s and writes nothing', (_label, args, problem) => {
            startSession({});

            const result = policy.setScoreDetailed(args[0], args[1], args[2]);

            expect(result.valid).toBe(false);
            expect(result.problem).toBe(problem);
            expect(result.requiredWritten).toBe(false);
            expect(api.callsFor('LMSSetValue')).toEqual([]);
            expect(warnSpy).toHaveBeenCalled();
        });

        it('reports an inconsistent triplet through the bound that contradicts the raw score', () => {
            startSession({});

            // An inconsistent min/max is always also inconsistent with raw, so
            // validateScore has no separate "min above max" outcome.
            expect(policy.validateScore(70, 60, 65).problem).toBe('max-below-raw');
            expect(policy.validateScore(50, 50, 40).problem).toBe('max-below-raw');
            expect(policy.validateScore(50, 80, 60).problem).toBe('min-above-raw');
            expect(policy.validateScore(50, 40, 60).valid).toBe(true);
        });
    });

    describe('setScoreDetailed with optional score bounds', () => {
        it('records the required raw write and both optional writes on a complete LMS', () => {
            startSession({});

            const result = policy.setScoreDetailed(80, 0, 100);

            expect(result).toMatchObject({ valid: true, requiredWritten: true, ok: true, optionalFailures: [] });
            expect(result.required).toMatchObject({ element: 'cmi.core.score.raw', written: true });
            expect(result.optional.map(entry => entry.element)).toEqual(['cmi.core.score.min', 'cmi.core.score.max']);
        });

        it('keeps the raw score on an LMS that implements neither bound', () => {
            // A minimal SCORM 1.2 LMS implements score.raw but not min/max.
            startSession({}, { profile: 'minimal' });

            const result = policy.setScoreDetailed(80, 0, 100);

            expect(result.requiredWritten).toBe(true);
            expect(result.ok).toBe(false);
            expect(result.optional.every(entry => entry.unsupported)).toBe(true);
            expect(result.optionalFailures).toEqual(['cmi.core.score.min', 'cmi.core.score.max']);
            expect(api.data['cmi.core.score.raw']).toBe('80');
        });

        it.each([
            ['minimum', 'cmi.core.score.min'],
            ['maximum', 'cmi.core.score.max'],
        ])('keeps the raw score when only the %s is unsupported', (_label, element) => {
            startSession({}, { elementFailures: { [element]: { errorCode: 401 } } });

            const result = policy.setScoreDetailed(80, 0, 100);

            expect(result.requiredWritten).toBe(true);
            expect(result.optionalFailures).toEqual([element]);
            expect(result.optional.find(entry => entry.element === element).unsupported).toBe(true);
            expect(api.data['cmi.core.score.raw']).toBe('80');
        });

        it('distinguishes an unsupported bound from a rejected one', () => {
            startSession({}, { elementFailures: { 'cmi.core.score.min': { errorCode: 101 } } });

            const result = policy.setScoreDetailed(80, 0, 100);

            expect(result.optional[0]).toMatchObject({ written: false, unsupported: false, errorCode: 101 });
        });

        it('reports a failed required write', () => {
            startSession({}, { elementFailures: { 'cmi.core.score.raw': { errorCode: 101 } } });

            const result = policy.setScoreDetailed(80);

            expect(result.requiredWritten).toBe(false);
            expect(result.required.errorCode).toBe(101);
        });

        it('does not log an error for an unimplemented optional bound', () => {
            // A conforming LMS may skip score.min/max ([CR] §2.1.1.3a): the
            // 401 answer is classified as unsupported, and nothing lands in
            // the console — two error lines per score update on a perfectly
            // valid minimal LMS would train users to ignore real errors.
            const errorSpy = vi.fn();
            client.configure({ getPipwerks: () => pipwerks, now: () => 1000, error: errorSpy, warn: vi.fn() });
            startSession({}, { profile: 'minimal' });

            const result = policy.setScoreDetailed(80, 0, 100);

            expect(result.optional.every(entry => entry.unsupported)).toBe(true);
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('still logs a real failure on an optional bound', () => {
            const errorSpy = vi.fn();
            client.configure({ getPipwerks: () => pipwerks, now: () => 1000, error: errorSpy, warn: vi.fn() });
            startSession({}, { elementFailures: { 'cmi.core.score.min': { errorCode: 101 } } });

            const result = policy.setScoreDetailed(80, 0, 100);

            expect(result.optional[0]).toMatchObject({ unsupported: false, errorCode: 101 });
            expect(errorSpy).toHaveBeenCalled();
        });

        it('still decides the status when the mandatory score write fails', () => {
            startSession(
                { 'cmi.core.lesson_status': 'incomplete' },
                { elementFailures: { 'cmi.core.score.raw': { errorCode: 101 } } },
            );
            activities.register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });

            const score = policy.setScoreDetailed(90, 0, 100);
            expect(score.requiredWritten).toBe(false);

            // Documented policy (runtime contract §8): completion is not held
            // hostage by score storage — a broken LMS that refuses score.raw
            // must not trap the learner at "incomplete" forever.
            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'passed', written: true });
            expect(api.data['cmi.core.lesson_status']).toBe('passed');
        });
    });

    describe('completion decision (activity matrix)', () => {
        function register(id, descriptor) {
            activities.register(id, descriptor);
        }

        it('1. no iDevices at all → completed by viewing the page', () => {
            expect(policy.decideStatus()).toMatchObject({ status: 'completed', reason: 'no-required-activities' });
        });

        it('2. one unstarted quiz → incomplete', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, total: 5 });

            expect(policy.decideStatus()).toMatchObject({ status: 'incomplete' });
        });

        it('3. one partially answered quiz → incomplete', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, answered: 2, total: 5, score: 40 });

            expect(policy.decideStatus()).toMatchObject({ status: 'incomplete' });
        });

        it('4. one completed passing quiz → passed', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 80 });

            expect(policy.decideStatus()).toMatchObject({ status: 'passed', score: 80 });
        });

        it('5. one completed failing quiz → failed', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 20 });

            expect(policy.decideStatus()).toMatchObject({ status: 'failed', score: 20 });
        });

        it('6. two quizzes, one complete and one unstarted → incomplete', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 100 });
            register('quiz-2', { evaluable: true, completionRequired: true });

            expect(policy.decideStatus()).toMatchObject({ status: 'incomplete' });
        });

        it('7. two completed quizzes average their scores', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 100 });
            register('quiz-2', { evaluable: true, completionRequired: true, completed: true, score: 0 });

            expect(policy.decideStatus()).toMatchObject({ status: 'passed', score: 50 });
        });

        it('8. a quiz plus a presentation activity is decided by the quiz alone', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });
            register('slides-1', { evaluable: false, completionRequired: false });

            expect(policy.decideStatus()).toMatchObject({ status: 'passed', score: 90 });
        });

        it('9. presentation activities only → completed, never stuck incomplete', () => {
            register('slides-1', { evaluable: false, completionRequired: false });
            register('slides-2', { evaluable: false, completionRequired: false });

            expect(policy.decideStatus()).toMatchObject({ status: 'completed', reason: 'no-required-activities' });
        });

        it('a presentation on a scored page stays incomplete until a required activity registers', () => {
            policy.setHasScoredActivities(true);
            register('slides-1', { evaluable: false, completionRequired: false });

            expect(policy.decideStatus()).toMatchObject({
                status: 'incomplete',
                reason: 'required-activities-pending',
            });
        });

        it('10. a suspended page reopened keeps its restored progress', () => {
            activities.load('exe12/1|quiz-1;7;5;5;90;1;0;100');

            expect(policy.decideStatus()).toMatchObject({ status: 'passed', score: 90 });
        });

        it('11. a retry after failure re-decides from the new score', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 20 });
            expect(policy.decideStatus().status).toBe('failed');

            activities.update('quiz-1', { completed: true, score: 75 });

            expect(policy.decideStatus().status).toBe('passed');
        });

        it('14. a score exactly at the threshold passes', () => {
            policy.setSuccessThreshold(50);
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 50 });

            expect(policy.decideStatus().status).toBe('passed');
        });

        it('15. an activity that reports no completion flag stays incomplete while required', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, score: 90 });

            expect(policy.decideStatus().status).toBe('incomplete');
        });

        it('16. an activity registered after the page settled is counted', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });
            expect(policy.decideStatus().status).toBe('passed');

            register('quiz-2', { evaluable: true, completionRequired: true });

            expect(policy.decideStatus().status).toBe('incomplete');
        });

        it('17. duplicate registration does not reset progress', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });
            register('quiz-1', { evaluable: true, completionRequired: true, total: 5 });

            expect(policy.decideStatus()).toMatchObject({ status: 'passed', score: 90 });
        });

        it('18. corrupt persisted state is ignored rather than fatal', () => {
            expect(() => activities.load('not a payload at all')).not.toThrow();

            expect(policy.decideStatus().status).toBe('completed');
        });

        it('with no threshold in force, completed required activities are just completed', () => {
            policy.setSuccessThreshold(null);
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 10 });

            expect(policy.decideStatus()).toMatchObject({ status: 'completed', reason: 'no-success-threshold' });
        });

        it('rejects an out-of-range threshold and keeps the previous one', () => {
            policy.setSuccessThreshold(60);
            policy.setSuccessThreshold(140);

            expect(policy.getSuccessThreshold()).toBe(60);
            expect(warnSpy).toHaveBeenCalled();
        });

        it('accepts an explicit aggregate score from the caller', () => {
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 10 });

            // The gamification helper computes the aggregate itself and hands
            // it in, so the recorded score and the decision agree.
            expect(policy.decideStatus(90)).toMatchObject({ status: 'passed', score: 90 });
        });
    });

    describe('in-session status re-evaluation', () => {
        function register(id, descriptor) {
            activities.register(id, descriptor);
        }

        it('writes the decided status while activities are still pending', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            register('quiz-1', { evaluable: true, completionRequired: true });

            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'incomplete', written: true });
            // Already stored: no redundant write.
            expect(api.callsFor('LMSSetValue')).toEqual([]);
        });

        it('upgrades a failed activity to passed after a successful retry', () => {
            startSession({ 'cmi.core.lesson_status': 'failed' });
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });

            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'passed', written: true });
            expect(api.data['cmi.core.lesson_status']).toBe('passed');
        });

        it('never replaces a terminal status with a non-terminal one', () => {
            startSession({ 'cmi.core.lesson_status': 'passed' });
            register('quiz-1', { evaluable: true, completionRequired: true });

            expect(policy.recordActivityOutcome()).toMatchObject({
                status: 'passed',
                written: false,
                reason: 'terminal-status-preserved',
            });
            expect(api.callsFor('LMSSetValue')).toEqual([]);
        });

        it('records a failing aggregate supplied by the caller', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });

            expect(policy.recordActivityOutcome(20)).toMatchObject({ status: 'failed', written: true });
            expect(api.data['cmi.core.lesson_status']).toBe('failed');
        });

        it('a required activity registering late corrects the policy\'s own passed verdict', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });
            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'passed', written: true });

            // A second iDevice initialises after the first one finished.
            register('quiz-2', { evaluable: true, completionRequired: true, total: 4 });

            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'incomplete', written: true });
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
            // The exit now suspends instead of reporting a normal end.
            api.resetCalls();
            expect(policy.applyExitPolicy()).toMatchObject({ status: 'incomplete', exit: 'suspend' });
        });

        it('never downgrades a terminal status the policy did not write', () => {
            // Restored from a previous attempt: the policy wrote nothing.
            startSession({ 'cmi.core.lesson_status': 'passed' });
            register('quiz-2', { evaluable: true, completionRequired: true });

            expect(policy.recordActivityOutcome()).toMatchObject({
                status: 'passed',
                written: false,
                reason: 'terminal-status-preserved',
            });

            // Written explicitly by content, not by the policy.
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            policy.setCompleted();
            register('quiz-3', { evaluable: true, completionRequired: true });

            expect(policy.recordActivityOutcome()).toMatchObject({
                status: 'completed',
                written: false,
                reason: 'terminal-status-preserved',
            });
        });

        it('agreeing with a restored terminal status does not claim it for the policy', () => {
            // The LMS restores "passed" from a previous attempt, and the
            // restored registry agrees, so the decision equals the stored
            // value without the policy ever writing it.
            startSession({ 'cmi.core.lesson_status': 'passed' });
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });
            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'passed', written: true });

            // A required activity registering later must therefore NOT
            // downgrade it: agreeing with a status is not owning it.
            register('quiz-2', { evaluable: true, completionRequired: true, total: 4 });

            expect(policy.recordActivityOutcome()).toMatchObject({
                status: 'passed',
                written: false,
                reason: 'terminal-status-preserved',
            });
            expect(api.data['cmi.core.lesson_status']).toBe('passed');
        });

        it('decides the same status during the session and at exit near the threshold', () => {
            // 100/49/0 with equal weights: the historical largest-remainder
            // weighting yields 50.17 (passed at the default threshold of
            // 50), where an exact mean would yield 49.67 (failed). Both the
            // mid-session decision and the exit decision must read the same
            // aggregate — a page must never pass while in use and fail on
            // the way out.
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            register('a', { evaluable: true, completionRequired: true, completed: true, score: 100 });
            register('b', { evaluable: true, completionRequired: true, completed: true, score: 49 });
            register('c', { evaluable: true, completionRequired: true, completed: true, score: 0 });

            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'passed', written: true });

            expect(policy.applyExitPolicy()).toMatchObject({ status: 'passed', exit: '' });
            expect(api.data['cmi.core.lesson_status']).toBe('passed');
        });
    });

    describe('reconcilePendingActivities', () => {
        function register(id, descriptor) {
            activities.register(id, descriptor);
        }

        it('corrects the policy\'s own terminal verdict when a required activity is pending', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });
            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'passed', written: true });

            register('quiz-2', { evaluable: true, completionRequired: true, total: 4 });

            expect(policy.reconcilePendingActivities()).toMatchObject({
                status: 'incomplete',
                written: true,
                effective: 'incomplete',
            });
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
        });

        it('does nothing without a pending required activity', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });
            api.resetCalls();

            expect(policy.reconcilePendingActivities()).toBeNull();
            // Never writes a transient passed/failed verdict from a
            // registration event: only pending work is reconciled.
            expect(api.calls).toEqual([]);
        });

        it('is inert before the session opens: no LMS traffic and no rejection warnings', () => {
            // iDevices register on jQuery ready, before loadPage() opens the session,
            // and common.js reconciles after every registration. There is nothing to
            // reconcile against yet — every read and write would be refused and logged
            // — and the entry policy sees the pending registrations when it runs.
            api = createFakeScorm12Api({ data: { 'cmi.core.lesson_status': '' } });
            vi.stubGlobal('window', createFakeWindowTree('self', api));
            register('quiz-1', { evaluable: true, completionRequired: true, total: 4 });

            expect(policy.reconcilePendingActivities()).toBeNull();

            expect(api.calls).toEqual([]);
            expect(clientWarnSpy).not.toHaveBeenCalled();
        });

        it('reconciles as soon as the session is open', () => {
            api = createFakeScorm12Api({ data: { 'cmi.core.lesson_status': '' } });
            vi.stubGlobal('window', createFakeWindowTree('self', api));
            register('quiz-1', { evaluable: true, completionRequired: true, total: 4 });
            expect(policy.reconcilePendingActivities()).toBeNull();

            expect(client.initialize()).toBe(true);

            expect(policy.reconcilePendingActivities()).toMatchObject({ status: 'incomplete', written: true });
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
        });

        it('never touches a restored terminal status', () => {
            startSession({ 'cmi.core.lesson_status': 'passed' });
            register('quiz-1', { evaluable: true, completionRequired: true, total: 4 });

            expect(policy.reconcilePendingActivities()).toMatchObject({
                status: 'passed',
                written: false,
                reason: 'terminal-status-preserved',
            });
            expect(api.data['cmi.core.lesson_status']).toBe('passed');
        });

        it('an explicit content write clears the policy\'s claim, even for the same value', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });
            expect(policy.recordActivityOutcome()).toMatchObject({ status: 'passed', written: true });

            // Content ratifies the very verdict the policy wrote. Ratifying
            // makes it content's: a required activity registering later must
            // no longer downgrade it.
            expect(policy.setPassed()).toBe(true);
            register('quiz-2', { evaluable: true, completionRequired: true, total: 4 });

            expect(policy.reconcilePendingActivities()).toMatchObject({
                status: 'passed',
                written: false,
                reason: 'terminal-status-preserved',
            });
            expect(api.data['cmi.core.lesson_status']).toBe('passed');
        });
    });

    describe('lesson mode', () => {
        it('12. review mode suppresses the doContinue status write', () => {
            startSession({ 'cmi.core.lesson_mode': 'review' });

            expect(policy.setStatusForContinue('completed')).toBe(false);
            expect(api.callsFor('LMSSetValue')).toEqual([]);
        });

        it('13. browse mode suppresses the doContinue status write', () => {
            startSession({ 'cmi.core.lesson_mode': 'browse' });

            expect(policy.setStatusForContinue('completed')).toBe(false);
            expect(api.callsFor('LMSSetValue')).toEqual([]);
        });

        it('writes a valid status in normal mode', () => {
            startSession({ 'cmi.core.lesson_mode': 'normal' });

            expect(policy.setStatusForContinue('completed')).toBe(true);
            expect(api.data['cmi.core.lesson_status']).toBe('completed');
        });

        it('rejects invalid vocabulary', () => {
            startSession({});

            expect(policy.setStatusForContinue('unknown')).toBe(false);
            expect(api.callsFor('LMSSetValue')).toEqual([]);
            expect(warnSpy).toHaveBeenCalled();
        });

        it('rejects "not attempted", which a SCO may not write', () => {
            startSession({});

            expect(policy.setStatusForContinue('not attempted')).toBe(false);
            expect(api.callsFor('LMSSetValue')).toEqual([]);
        });
    });

    describe('exit policy', () => {
        it('completes an unscored page and ends the attempt normally', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            policy.setHasScoredActivities(false);

            policy.applyExitPolicy();

            expect(api.callSignatures()).toEqual([
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.lesson_status=completed)',
                'LMSSetValue(cmi.core.exit=)',
            ]);
        });

        it('keeps a scored page incomplete and suspends the attempt', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            policy.setHasScoredActivities(true);

            policy.applyExitPolicy();

            // The decided status equals the stored one, so no redundant write.
            expect(api.callSignatures()).toEqual([
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.exit=suspend)',
            ]);
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
        });

        it('persists the activity registry before deciding the status', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            activities.register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });

            policy.applyExitPolicy();

            expect(api.callSignatures()).toEqual([
                'LMSSetValue(cmi.suspend_data=exe12/1|quiz-1;7;0;0;90;1;0;100)',
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.lesson_status=passed)',
                'LMSSetValue(cmi.core.exit=)',
            ]);
        });

        it.each(['completed', 'passed', 'failed'])('never downgrades a terminal "%s" status', status => {
            startSession({ 'cmi.core.lesson_status': status });
            policy.setHasScoredActivities(true);

            policy.applyExitPolicy();

            expect(api.data['cmi.core.lesson_status']).toBe(status);
            expect(api.data['cmi.core.exit']).toBe('');
        });

        it('leaves the status untouched when the completion rule is disabled', () => {
            startSession({ 'cmi.core.lesson_status': 'incomplete' });
            policy.setHasScoredActivities(false);

            policy.applyExitPolicy(false);

            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
            expect(api.data['cmi.core.exit']).toBe('suspend');
        });

        it('computes cmi.core.exit from the status the LMS actually stored', () => {
            // The LMS rejects the status write: the attempt is still
            // incomplete at the LMS, so reporting a normal end ("") would
            // close it prematurely — the exit must say "suspend".
            startSession(
                { 'cmi.core.lesson_status': 'incomplete' },
                { elementFailures: { 'cmi.core.lesson_status': { errorCode: 101 } } },
            );
            activities.register('quiz-1', { evaluable: true, completionRequired: true, completed: true, score: 90 });

            const result = policy.applyExitPolicy();

            expect(result).toMatchObject({ status: 'incomplete', exit: 'suspend' });
            expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
            expect(api.data['cmi.core.exit']).toBe('suspend');
        });
    });

    describe('defaults and state accessors', () => {
        it('tracks the scored-activities flag', () => {
            expect(policy.getHasScoredActivities()).toBe(false);
            policy.setHasScoredActivities(true);
            expect(policy.getHasScoredActivities()).toBe(true);
            policy.setHasScoredActivities('truthy-but-not-true');
            expect(policy.getHasScoredActivities()).toBe(false);
        });

        it('falls back to the default client lookup and console warn channel', () => {
            policy.resetDependencies();
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Default getClient resolves window.exeScorm12.client (attached
            // by the client module); invalid input warns via the console.
            expect(policy.setScore('not-a-number')).toBe(false);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid score'));

            consoleWarnSpy.mockRestore();
        });

        it('persistActivities is a no-op with an empty registry', () => {
            startSession({});

            expect(policy.persistActivities()).toBe(true);
            expect(api.callsFor('LMSSetValue')).toEqual([]);
        });

        it('persistActivities writes the unclaimed legacy pool when no live activity has registered', () => {
            startSession({});
            activities.load('1. "Quiz"; Score: 40%; Weight: 1%');

            expect(policy.persistActivities()).toBe(true);
            expect(api.data['cmi.suspend_data']).toContain('1;40;1');
        });
    });
    describe('without an activity registry (four-layer host)', () => {
        it('does not pin a scored page to incomplete for ever', () => {
            // The Moodle plugin assembles the runtime WITHOUT
            // exe-scorm12-activities.js, so getActivities() returns null and
            // nothing will ever report progress. The page-flag branch answered
            // allRequiredComplete: false on every call, so decideStatus returned
            // `incomplete` for the rest of the session — on a page the learner
            // may well have finished.
            policy.configure({ getClient: () => client, getActivities: () => null, warn: warnSpy });
            startSession({ 'cmi.core.lesson_status': '' });
            policy.setHasScoredActivities(true);

            const decision = policy.decideStatus();

            expect(decision.status).not.toBe('incomplete');
            expect(decision.reason).toBe('no-required-activities');
        });

        it('still lets an EMPTY registry hold the page incomplete until something registers', () => {
            // Deliberately a different case: the registry exists, so registration
            // is merely pending and resolves as soon as an activity arrives.
            startSession({ 'cmi.core.lesson_status': '' });
            policy.setHasScoredActivities(true);

            expect(policy.decideStatus().status).toBe('incomplete');
        });
    });

});
