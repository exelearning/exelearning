import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const activities = require('./exe-scorm12-activities.js');

describe('exe-scorm12-activities', () => {
    let warnSpy;

    beforeEach(() => {
        warnSpy = vi.fn();
        activities.resetDependencies();
        activities.configure({ warn: warnSpy });
    });

    afterEach(() => {
        activities.resetDependencies();
    });

    describe('registration', () => {
        it('normalises a descriptor with explicit flags', () => {
            const stored = activities.register('quiz-1', {
                evaluable: true,
                completionRequired: true,
                answered: 2,
                total: 5,
                score: 40,
                weight: 3,
            });

            expect(stored).toEqual({
                id: 'quiz-1',
                evaluable: true,
                completionRequired: true,
                completed: false,
                answered: 2,
                total: 5,
                score: 40,
                minimumScore: 0,
                maximumScore: 100,
                weight: 3,
            });
        });

        it('defaults completionRequired to whether the activity is evaluable', () => {
            expect(activities.register('quiz', { evaluable: true }).completionRequired).toBe(true);
            expect(activities.register('slides', { evaluable: false }).completionRequired).toBe(false);
        });

        it('defaults an unqualified activity to presentation-only', () => {
            expect(activities.register('plain')).toEqual({
                id: 'plain',
                evaluable: false,
                completionRequired: false,
                completed: false,
                answered: 0,
                total: 0,
                score: null,
                minimumScore: 0,
                maximumScore: 100,
                weight: 1,
            });
        });

        it('refuses an activity without a stable identifier', () => {
            expect(activities.register('')).toBeNull();
            expect(activities.register(undefined)).toBeNull();
            expect(activities.list()).toEqual([]);
            expect(warnSpy).toHaveBeenCalled();
        });

        it('re-registering keeps the progress already reported', () => {
            activities.register('quiz', { evaluable: true, completed: true, score: 80, answered: 4, total: 4 });

            activities.register('quiz', { evaluable: true, total: 6 });

            expect(activities.get('quiz')).toMatchObject({ completed: true, score: 80, answered: 4, total: 6 });
            expect(activities.list()).toHaveLength(1);
        });

        it('update() registers an unknown activity on the fly', () => {
            activities.update('late', { evaluable: true, completed: true, score: 55 });

            expect(activities.get('late')).toMatchObject({ evaluable: true, completed: true, score: 55 });
        });

        it('unregister() removes an activity and reports whether it existed', () => {
            activities.register('a', { evaluable: true });

            expect(activities.unregister('a')).toBe(true);
            expect(activities.unregister('a')).toBe(false);
            expect(activities.list()).toEqual([]);
        });

        it('get() returns a copy, so callers cannot mutate the registry', () => {
            activities.register('a', { evaluable: true, score: 10 });

            const copy = activities.get('a');
            copy.score = 99;

            expect(activities.get('a').score).toBe(10);
            expect(activities.get('missing')).toBeNull();
        });

        it('clamps a non-positive weight and a degenerate score range', () => {
            const stored = activities.register('a', { weight: 0, minimumScore: 50, maximumScore: 10 });

            expect(stored.weight).toBe(1);
            expect(stored.maximumScore).toBe(150);
        });

        it('coerces numeric strings', () => {
            const stored = activities.register('a', { answered: '3', total: '4', score: '55.5', weight: '2' });

            expect(stored).toMatchObject({ answered: 3, total: 4, score: 55.5, weight: 2 });
        });

        it('clamps negative counters to zero', () => {
            expect(activities.register('a', { answered: -3, total: -1 })).toMatchObject({ answered: 0, total: 0 });
        });
    });

    describe('summary', () => {
        it('is empty for an empty registry', () => {
            expect(activities.summary()).toEqual({
                total: 0,
                evaluable: 0,
                required: 0,
                requiredCompleted: 0,
                hasRequired: false,
                allRequiredComplete: true,
                answered: 0,
                questions: 0,
                score: null,
            });
        });

        it('counts required and completed activities', () => {
            activities.register('a', { evaluable: true, completionRequired: true, completed: true, score: 100 });
            activities.register('b', { evaluable: true, completionRequired: true });
            activities.register('c', { evaluable: false, completionRequired: false });

            expect(activities.summary()).toMatchObject({
                total: 3,
                evaluable: 2,
                required: 2,
                requiredCompleted: 1,
                hasRequired: true,
                allRequiredComplete: false,
            });
        });

        it('weights the aggregate score', () => {
            activities.register('a', { evaluable: true, completed: true, score: 100, weight: 3 });
            activities.register('b', { evaluable: true, completed: true, score: 20, weight: 1 });

            expect(activities.summary().score).toBe(80);
        });

        it('counts an evaluable activity without a score as zero', () => {
            activities.register('a', { evaluable: true, completed: true, score: 100 });
            activities.register('b', { evaluable: true });

            expect(activities.summary().score).toBe(50);
        });

        it('normalises a score against its own bounds', () => {
            activities.register('a', { evaluable: true, completed: true, score: 5, minimumScore: 0, maximumScore: 10 });

            expect(activities.summary().score).toBe(50);
        });

        it('clamps a score outside its bounds', () => {
            activities.register('a', { evaluable: true, score: 500, minimumScore: 0, maximumScore: 100 });

            expect(activities.summary().score).toBe(100);
        });

        it('leaves the aggregate null when nothing is evaluable', () => {
            activities.register('slides', { evaluable: false });

            expect(activities.summary().score).toBeNull();
        });

        it('sums answered and total question counters', () => {
            activities.register('a', { evaluable: true, answered: 2, total: 5 });
            activities.register('b', { evaluable: true, answered: 1, total: 3 });

            expect(activities.summary()).toMatchObject({ answered: 3, questions: 8 });
        });
    });

    describe('cmi.suspend_data serialisation', () => {
        it('round-trips through the versioned payload', () => {
            activities.register('quiz-1', {
                evaluable: true,
                completionRequired: true,
                completed: true,
                answered: 4,
                total: 5,
                score: 72.5,
                weight: 2,
            });
            activities.register('slides', { evaluable: false });

            const payload = activities.serialize();
            activities.clear();
            const outcome = activities.load(payload);

            expect(outcome).toEqual({ version: 1, restored: 2, migrated: false });
            expect(activities.get('quiz-1')).toMatchObject({
                evaluable: true,
                completionRequired: true,
                completed: true,
                answered: 4,
                total: 5,
                score: 72.5,
                weight: 2,
            });
            expect(activities.get('slides')).toMatchObject({ evaluable: false, completionRequired: false });
        });

        it('serialises an empty registry to the bare header', () => {
            expect(activities.serialize()).toBe('exe12/1');
        });

        it('encodes identifiers so separators cannot corrupt the payload', () => {
            activities.register('id;with|separators', { evaluable: true });

            const payload = activities.serialize();
            activities.clear();
            activities.load(payload);

            expect(activities.get('id;with|separators')).not.toBeNull();
        });

        it('stores no learner-identifying data', () => {
            activities.register('quiz-1', { evaluable: true, completed: true, score: 60 });

            // Only structural fields: identifier, flags, counters, score,
            // weight and bounds.
            expect(activities.serialize()).toBe('exe12/1|quiz-1;7;0;0;60;1;0;100');
        });

        it('stays inside the SCORM 1.2 4096-character limit and says what it dropped', () => {
            for (let index = 0; index < 400; index += 1) {
                activities.register(`activity-with-a-fairly-long-identifier-${index}`, {
                    evaluable: true,
                    completionRequired: index % 2 === 0,
                    score: 50,
                });
            }

            const payload = activities.serialize();

            expect(payload.length).toBeLessThanOrEqual(activities.SUSPEND_DATA_LIMIT);
            expect(payload.indexOf('exe12/1|')).toBe(0);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exceeded the SCORM 1.2 limit'));
        });

        it('keeps the required activities when it has to compact', () => {
            for (let index = 0; index < 200; index += 1) {
                activities.register(`optional-${index}-with-a-long-identifier-to-fill-space`, {
                    evaluable: false,
                    completionRequired: false,
                });
            }
            activities.register('the-required-one', { evaluable: true, completionRequired: true, score: 90 });

            const payload = activities.serialize();

            expect(payload).toContain('the-required-one');
            expect(payload.length).toBeLessThanOrEqual(activities.SUSPEND_DATA_LIMIT);
        });

        it('falls back to the header when even the required activities do not fit', () => {
            const longId = 'x'.repeat(activities.SUSPEND_DATA_LIMIT + 1);
            for (let index = 0; index < 10; index += 1) {
                activities.register(`${longId}-${index}`, { evaluable: true, completionRequired: true });
            }

            expect(activities.serialize()).toBe('exe12/1');
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no activity state was stored'));
        });
    });

    describe('cmi.suspend_data migration and robustness', () => {
        it('migrates the unversioned legacy payload', () => {
            const legacy = '1. "First activity"; Score: 40%; Weight: 1%.\t2. "Second"; Puntuación: 0%; Peso: 2%';

            const outcome = activities.load(legacy);

            expect(outcome).toMatchObject({ version: 0, restored: 2, migrated: true });
            expect(activities.get('1')).toMatchObject({ evaluable: true, completed: true, score: 40, weight: 1 });
            // A legacy record with a zero score was registered but never done.
            expect(activities.get('2')).toMatchObject({ completed: false, score: 0, weight: 2 });
        });

        it('re-serialises a migrated payload in the versioned format', () => {
            activities.load('1. "First"; Score: 40%; Weight: 1%');

            expect(activities.serialize().indexOf('exe12/1|')).toBe(0);
        });

        it.each([
            ['an empty string', ''],
            ['whitespace', '   '],
            ['a non-string', 42],
            ['unrelated text', 'some other product wrote this'],
            ['a truncated record', 'exe12/1|only;two'],
            ['a record with an unreadable flag field', 'exe12/1|id;notanumber;0;0;;1;0;100'],
            ['a record with an empty identifier', 'exe12/1|;7;0;0;50;1;0;100'],
        ])('ignores %s without throwing', (_label, payload) => {
            expect(() => activities.load(payload)).not.toThrow();
            expect(activities.list()).toEqual([]);
        });

        it('ignores a payload written by a newer runtime', () => {
            const outcome = activities.load('exe12/99|quiz;7;0;0;50;1;0;100');

            expect(outcome.restored).toBe(0);
            expect(activities.list()).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('newer runtime'));
        });

        it('ignores a payload with an unreadable version tag', () => {
            expect(activities.load('exe12/x|quiz;7;0;0;50;1;0;100').restored).toBe(0);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unreadable version tag'));
        });

        it('accepts a header-only payload', () => {
            expect(activities.load('exe12/1')).toEqual({ version: 1, restored: 0, migrated: false });
        });

        it('rejects a record whose identifier is not decodable', () => {
            expect(activities.load('exe12/1|%E0%A4%A;7;0;0;50;1;0;100').restored).toBe(0);
        });

        it('drops only the malformed records of a mixed payload', () => {
            const outcome = activities.load('exe12/1|good;7;0;0;50;1;0;100|broken');

            expect(outcome.restored).toBe(1);
            expect(activities.get('good')).not.toBeNull();
        });

        it('merges restored progress into a live declaration', () => {
            activities.register('quiz', { evaluable: true, completionRequired: true, total: 8, weight: 4 });

            activities.load('exe12/1|quiz;7;3;5;60;1;0;100');

            expect(activities.get('quiz')).toMatchObject({
                // The running page knows the real shape…
                weight: 4,
                total: 5,
                // …and the stored payload contributes the progress.
                completed: true,
                answered: 3,
                score: 60,
            });
        });

        it('keeps the live total when the payload has none', () => {
            activities.register('quiz', { evaluable: true, total: 8 });

            activities.load('exe12/1|quiz;7;3;0;60;1;0;100');

            expect(activities.get('quiz').total).toBe(8);
        });
    });

    it('falls back to the console warn channel by default', () => {
        activities.resetDependencies();
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(activities.register('')).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('stable identifier'));

        consoleWarnSpy.mockRestore();
    });
});
