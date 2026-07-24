import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Full stack below the policy: vendored wrapper + client + fake LMS API, so
// assertions run against the recorded LMS traffic, not against mocks of the
// code under test.
const pipwerks = require('./vendor/pipwerks/SCORM_API_wrapper.js');
const client = require('./exe-scorm12-client.js');
const policy = require('./exe-scorm12-policy.js');
const { createFakeScorm12Api, createFakeWindowTree, resetPipwerks } = require('./fake-scorm12-api.test-util.js');

describe('exe-scorm12-policy', () => {
    let api;
    let warnSpy;

    function startSession(initialData) {
        api = createFakeScorm12Api({ data: initialData });
        vi.stubGlobal('window', createFakeWindowTree('self', api));
        expect(client.initialize()).toBe(true);
        api.calls.length = 0;
    }

    beforeEach(() => {
        warnSpy = vi.fn();
        resetPipwerks(pipwerks);
        client.resetDependencies();
        client.configure({ getPipwerks: () => pipwerks, now: () => 1000, error: vi.fn(), warn: vi.fn() });
        policy.resetDependencies();
        policy.configure({ getClient: () => client, warn: warnSpy });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        policy.resetDependencies();
        client.resetDependencies();
    });

    describe('entry policy', () => {
        it('promotes an empty status to incomplete', () => {
            startSession({});

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
            ['non-numeric raw', ['abc', 0, 100]],
            ['raw below 0', [-1, 0, 100]],
            ['raw above 100', [101, 0, 100]],
            ['min above raw', [50, 60, 100]],
            ['max below raw', [50, 0, 40]],
            ['min above max', [50, 80, 60]],
            ['NaN raw', [Number.NaN, 0, 100]],
            ['Infinity raw', [Number.POSITIVE_INFINITY, 0, 100]],
        ])('rejects %s and writes nothing', (_label, args) => {
            startSession({});

            expect(policy.setScore(args[0], args[1], args[2])).toBe(false);

            expect(api.callsFor('LMSSetValue')).toEqual([]);
            expect(warnSpy).toHaveBeenCalled();
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

            expect(api.callSignatures()).toEqual([
                'LMSGetValue(cmi.core.lesson_status)',
                'LMSSetValue(cmi.core.lesson_status=incomplete)',
                'LMSSetValue(cmi.core.exit=suspend)',
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
    });

    describe('setStatusForContinue', () => {
        it('writes a valid status in normal mode', () => {
            startSession({ 'cmi.core.lesson_mode': 'normal' });

            expect(policy.setStatusForContinue('completed')).toBe(true);
            expect(api.data['cmi.core.lesson_status']).toBe('completed');
        });

        it.each(['review', 'browse'])('does not write in %s mode', mode => {
            startSession({ 'cmi.core.lesson_mode': mode });

            expect(policy.setStatusForContinue('completed')).toBe(false);
            expect(api.callsFor('LMSSetValue')).toEqual([]);
        });

        it('rejects invalid vocabulary', () => {
            startSession({});

            expect(policy.setStatusForContinue('unknown')).toBe(false);
            expect(api.callsFor('LMSSetValue')).toEqual([]);
            expect(warnSpy).toHaveBeenCalled();
        });
    });
});
