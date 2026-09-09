/**
 * Conformance tests for the strict fake SCORM 1.2 LMS.
 *
 * The fake is the oracle every runtime test is measured against, so its own
 * behaviour has to be pinned to the specification: [RTE] SCORM 1.2 Run-Time
 * Environment §3.3-§3.4, [CR] SCORM 1.2 Conformance Requirements and the
 * [ADD] SCORM Addendums 2.0 errata. Expected values here are literal, never
 * computed from the implementation.
 */
import { describe, expect, it } from 'vitest';

const { createFakeScorm12Api, SCORM12_ERROR_STRINGS, isValidValue, msToTimespan, timespanToMs } = require('./fake-scorm12-api.test-util.js');
const { LESSON_STATUS_VOCABULARY, PROFILES } = require('./scorm12-data-model.test-util.js');

/** Start a session and return the api, so each test reads linearly. */
function initialized(options) {
    const api = createFakeScorm12Api(options);
    expect(api.LMSInitialize('')).toBe('true');
    return api;
}

describe('strict fake SCORM 1.2 LMS', () => {
    describe('API surface', () => {
        it('exposes exactly the eight SCORM 1.2 functions', () => {
            const api = createFakeScorm12Api();

            for (const name of [
                'LMSInitialize',
                'LMSFinish',
                'LMSCommit',
                'LMSGetValue',
                'LMSSetValue',
                'LMSGetLastError',
                'LMSGetErrorString',
                'LMSGetDiagnostic',
            ]) {
                expect(typeof api[name], name).toBe('function');
            }
        });

        it('returns strings from every function, never booleans', () => {
            const api = createFakeScorm12Api();

            expect(api.LMSInitialize('')).toBe('true');
            expect(api.LMSSetValue('cmi.core.lesson_status', 'incomplete')).toBe('true');
            expect(api.LMSGetValue('cmi.core.lesson_status')).toBe('incomplete');
            expect(api.LMSCommit('')).toBe('true');
            expect(api.LMSFinish('')).toBe('true');
            expect(api.LMSGetLastError()).toBe('0');
        });

        it('rejects an unknown conformance profile', () => {
            expect(() => createFakeScorm12Api({ profile: 'nonsense' })).toThrow(/conformance profile/);
        });

        it('offers the three documented profiles', () => {
            expect(Object.keys(PROFILES)).toEqual(['minimal', 'intermediate', 'complete']);
        });
    });

    describe('session sequencing', () => {
        it('LMSInitialize("") opens the session', () => {
            const api = createFakeScorm12Api();

            expect(api.LMSInitialize('')).toBe('true');
            expect(api.LMSGetLastError()).toBe('0');
        });

        it.each(['init', ' ', undefined, null])('rejects LMSInitialize(%p) with 201', argument => {
            const api = createFakeScorm12Api();

            expect(api.LMSInitialize(argument)).toBe('false');
            expect(api.LMSGetLastError()).toBe('201');
        });

        it.each([
            ['LMSFinish', 'false'],
            ['LMSCommit', 'false'],
        ])('rejects %s with a non-empty argument (201)', (method, expected) => {
            const api = initialized();

            expect(api[method]('x')).toBe(expected);
            expect(api.LMSGetLastError()).toBe('201');
        });

        it('answers 101 for a duplicate LMSInitialize', () => {
            const api = initialized();

            expect(api.LMSInitialize('')).toBe('false');
            expect(api.LMSGetLastError()).toBe('101');
        });

        it('answers 101 for an LMSInitialize after LMSFinish', () => {
            const api = initialized();
            api.LMSFinish('');

            expect(api.LMSInitialize('')).toBe('false');
            expect(api.LMSGetLastError()).toBe('101');
        });

        it.each([
            ['LMSGetValue', ['cmi.core.lesson_status'], ''],
            ['LMSSetValue', ['cmi.core.lesson_status', 'completed'], 'false'],
            ['LMSCommit', [''], 'false'],
            ['LMSFinish', [''], 'false'],
        ])('answers 301 for %s before LMSInitialize', (method, args, expected) => {
            const api = createFakeScorm12Api();

            expect(api[method](...args)).toBe(expected);
            expect(api.LMSGetLastError()).toBe('301');
        });

        it.each([
            ['LMSGetValue', ['cmi.core.lesson_status'], ''],
            ['LMSSetValue', ['cmi.core.lesson_status', 'completed'], 'false'],
            ['LMSCommit', [''], 'false'],
            ['LMSFinish', [''], 'false'],
        ])('rejects %s after LMSFinish', (method, args, expected) => {
            const api = initialized();
            api.LMSFinish('');

            expect(api[method](...args)).toBe(expected);
            expect(api.LMSGetLastError()).toBe('301');
        });

        it('the three error functions are legal before initialize and after finish', () => {
            const api = createFakeScorm12Api();

            expect(api.LMSGetLastError()).toBe('0');
            expect(api.LMSGetErrorString('0')).toBe('No error');
            expect(api.LMSGetDiagnostic('')).toBe('');

            api.LMSInitialize('');
            api.LMSFinish('');
            expect(api.LMSGetLastError()).toBe('0');
        });

        it('the error functions never change the error state', () => {
            const api = initialized();
            api.LMSGetValue('cmi.core.exit');
            expect(api.LMSGetLastError()).toBe('404');

            api.LMSGetErrorString('101');
            api.LMSGetDiagnostic('');

            expect(api.LMSGetLastError()).toBe('404');
        });

        it('rolls the last session_time into total_time on LMSFinish', () => {
            const api = initialized({ data: { 'cmi.core.total_time': '0000:10:00.00' } });

            api.LMSSetValue('cmi.core.session_time', '0000:05:00.00');
            api.LMSSetValue('cmi.core.session_time', '0000:07:30.00');
            api.LMSFinish('');

            expect(api.data['cmi.core.total_time']).toBe('0000:17:30.00');
        });
    });

    describe('read-only and write-only access', () => {
        it('GetValue(cmi.core.exit) is a write-only error', () => {
            const api = initialized();

            expect(api.LMSGetValue('cmi.core.exit')).toBe('');
            expect(api.LMSGetLastError()).toBe('404');
            expect(api.LMSGetErrorString('404')).toBe('Element is write only');
        });

        it('GetValue(cmi.core.session_time) is a write-only error', () => {
            const api = initialized();

            expect(api.LMSGetValue('cmi.core.session_time')).toBe('');
            expect(api.LMSGetLastError()).toBe('404');
        });

        it.each([
            'cmi.interactions.0.id',
            'cmi.interactions.0.type',
            'cmi.interactions.0.student_response',
            'cmi.interactions.0.result',
            'cmi.interactions.0.latency',
        ])('GetValue(%s) is a write-only error', element => {
            const api = initialized();
            api.LMSSetValue('cmi.interactions.0.id', 'q1');

            expect(api.LMSGetValue(element)).toBe('');
            expect(api.LMSGetLastError()).toBe('404');
        });

        it('SetValue(cmi.core.lesson_mode, normal) is a read-only error', () => {
            const api = initialized();

            expect(api.LMSSetValue('cmi.core.lesson_mode', 'normal')).toBe('false');
            expect(api.LMSGetLastError()).toBe('403');
            expect(api.LMSGetErrorString('403')).toBe('Element is read only');
        });

        it.each([
            'cmi.core.student_id',
            'cmi.core.student_name',
            'cmi.core.credit',
            'cmi.core.entry',
            'cmi.core.total_time',
            'cmi.launch_data',
            'cmi.comments_from_lms',
            'cmi.student_data.mastery_score',
        ])('SetValue(%s) is a read-only error', element => {
            const api = initialized();

            expect(api.LMSSetValue(element, 'x')).toBe('false');
            expect(api.LMSGetLastError()).toBe('403');
        });

        it.each(['cmi._version', 'cmi.core._children', 'cmi.core.score._children', 'cmi.objectives._count'])(
            'SetValue(%s) is a keyword error',
            element => {
                const api = initialized();

                expect(api.LMSSetValue(element, 'x')).toBe('false');
                expect(api.LMSGetLastError()).toBe('402');
            },
        );
    });

    describe('optional elements and conformance profiles', () => {
        it('the minimal profile answers 401 for an optional element', () => {
            const api = initialized({ profile: 'minimal' });

            expect(api.LMSGetValue('cmi.core.score.min')).toBe('');
            expect(api.LMSGetLastError()).toBe('401');
            expect(api.LMSSetValue('cmi.core.score.max', '100')).toBe('false');
            expect(api.LMSGetLastError()).toBe('401');
            expect(api.LMSGetErrorString('401')).toBe('Not implemented error');
        });

        it('the minimal profile still implements every mandatory element', () => {
            const api = initialized({ profile: 'minimal' });

            for (const element of [
                'cmi.core.student_id',
                'cmi.core.student_name',
                'cmi.core.lesson_location',
                'cmi.core.credit',
                'cmi.core.lesson_status',
                'cmi.core.entry',
                'cmi.core.score.raw',
                'cmi.core.total_time',
                'cmi.suspend_data',
                'cmi.launch_data',
            ]) {
                api.LMSGetValue(element);
                expect(api.LMSGetLastError(), element).toBe('0');
            }
            expect(api.LMSSetValue('cmi.core.exit', 'suspend')).toBe('true');
            expect(api.LMSSetValue('cmi.core.session_time', '0000:01:00.00')).toBe('true');
        });

        it('the intermediate profile adds the common optional elements but not interactions', () => {
            const api = initialized({ profile: 'intermediate' });

            expect(api.LMSSetValue('cmi.core.score.min', '0')).toBe('true');
            api.LMSGetValue('cmi.core.lesson_mode');
            expect(api.LMSGetLastError()).toBe('0');
            expect(api.LMSSetValue('cmi.interactions.0.id', 'q1')).toBe('false');
            expect(api.LMSGetLastError()).toBe('401');
        });

        it('_children lists only what the profile implements', () => {
            expect(initialized({ profile: 'minimal' }).LMSGetValue('cmi.core.score._children')).toBe('raw');
            expect(initialized({ profile: 'complete' }).LMSGetValue('cmi.core.score._children')).toBe('raw,min,max');
        });

        it('an element outside the cmi namespace is "not implemented"', () => {
            const api = initialized();

            expect(api.LMSGetValue('nav.event')).toBe('');
            expect(api.LMSGetLastError()).toBe('401');
            expect(api.LMSSetValue('adl.nav.request', 'continue')).toBe('false');
            expect(api.LMSGetLastError()).toBe('401');
        });

        it('an unknown cmi element is an invalid argument', () => {
            const api = initialized();

            expect(api.LMSGetValue('cmi.core.zip_code')).toBe('');
            expect(api.LMSGetLastError()).toBe('201');
            expect(api.LMSSetValue('cmi.evaluation.comments.0.content', 'x')).toBe('false');
            expect(api.LMSGetLastError()).toBe('201');
        });

        it.each(['', undefined, null])('rejects the malformed element name %p', element => {
            const api = initialized();

            expect(api.LMSGetValue(element)).toBe('');
            expect(api.LMSGetLastError()).toBe('201');
        });

        it('per-element failure injection models an LMS that refuses one element', () => {
            const api = initialized({ elementFailures: { 'cmi.core.score.min': { errorCode: 401 } } });

            expect(api.LMSSetValue('cmi.core.score.raw', '80')).toBe('true');
            expect(api.LMSSetValue('cmi.core.score.min', '0')).toBe('false');
            expect(api.LMSGetLastError()).toBe('401');
        });

        it('per-method failure injection models an unexplained LMS failure', () => {
            const api = initialized({ failures: { LMSCommit: { errorCode: 101, diagnostic: 'backend down' } } });

            expect(api.LMSCommit('')).toBe('false');
            expect(api.LMSGetLastError()).toBe('101');
            expect(api.LMSGetDiagnostic('')).toBe('backend down');
        });
    });

    describe('keywords', () => {
        it('cmi._version returns the CMI data model version', () => {
            expect(initialized().LMSGetValue('cmi._version')).toBe('3.4');
        });

        it('_children on an element without children is 202', () => {
            const api = initialized();

            expect(api.LMSGetValue('cmi.core.lesson_status._children')).toBe('');
            expect(api.LMSGetLastError()).toBe('202');
            expect(api.LMSGetErrorString('202')).toBe('Element cannot have children');
        });

        it('_count on a non-array is 203', () => {
            const api = initialized();

            expect(api.LMSGetValue('cmi.core._count')).toBe('');
            expect(api.LMSGetLastError()).toBe('203');
        });

        it('_children on an unknown parent is 201', () => {
            const api = initialized();

            expect(api.LMSGetValue('cmi.nonsense._children')).toBe('');
            expect(api.LMSGetLastError()).toBe('201');
        });

        it('the interactions sub-lists have _count but no _children', () => {
            const api = initialized();
            api.LMSSetValue('cmi.interactions.0.id', 'q1');

            expect(api.LMSGetValue('cmi.interactions.0.objectives._count')).toBe('0');
            expect(api.LMSGetLastError()).toBe('0');
            expect(api.LMSGetValue('cmi.interactions.0.objectives._children')).toBe('');
            expect(api.LMSGetLastError()).toBe('202');
        });

        it('an aggregate element has no value of its own', () => {
            const api = initialized();

            expect(api.LMSGetValue('cmi.core')).toBe('');
            expect(api.LMSGetLastError()).toBe('201');
        });
    });

    describe('data types, vocabularies and ranges', () => {
        it.each(LESSON_STATUS_VOCABULARY.filter(value => value !== 'not attempted'))(
            'accepts the lesson_status value "%s"',
            status => {
                const api = initialized();

                expect(api.LMSSetValue('cmi.core.lesson_status', status)).toBe('true');
            },
        );

        it('refuses "not attempted" from a SCO but initializes to it', () => {
            const api = initialized();

            expect(api.LMSGetValue('cmi.core.lesson_status')).toBe('not attempted');
            expect(api.LMSSetValue('cmi.core.lesson_status', 'not attempted')).toBe('false');
            expect(api.LMSGetLastError()).toBe('405');
        });

        it('accepts "not attempted" on an objective status', () => {
            const api = initialized();

            expect(api.LMSSetValue('cmi.objectives.0.status', 'not attempted')).toBe('true');
        });

        it.each(['Passed', 'PASSED', 'complete', 'unknown', ''])(
            'refuses the out-of-vocabulary lesson_status %p with 405',
            status => {
                const api = initialized();

                expect(api.LMSSetValue('cmi.core.lesson_status', status)).toBe('false');
                expect(api.LMSGetLastError()).toBe('405');
            },
        );

        it.each([
            ['cmi.core.score.raw', '-1'],
            ['cmi.core.score.raw', '101'],
            ['cmi.core.score.raw', 'eighty five'],
            ['cmi.core.score.min', '200'],
            ['cmi.student_preference.audio', '-2'],
            ['cmi.student_preference.speed', '101'],
            ['cmi.student_preference.text', '2'],
        ])('refuses the out-of-range value %s=%s with 405', (element, value) => {
            const api = initialized();

            expect(api.LMSSetValue(element, value)).toBe('false');
            expect(api.LMSGetLastError()).toBe('405');
        });

        it('accepts a blank score (CMIBlank)', () => {
            const api = initialized();

            expect(api.LMSSetValue('cmi.core.score.raw', '')).toBe('true');
        });

        it('enforces the CMIString255 limit on lesson_location', () => {
            const api = initialized();

            expect(api.LMSSetValue('cmi.core.lesson_location', 'x'.repeat(255))).toBe('true');
            expect(api.LMSSetValue('cmi.core.lesson_location', 'x'.repeat(256))).toBe('false');
            expect(api.LMSGetLastError()).toBe('405');
        });

        it('enforces the CMIString4096 limit on suspend_data, never truncating', () => {
            const api = initialized();

            expect(api.LMSSetValue('cmi.suspend_data', 'x'.repeat(4096))).toBe('true');
            expect(api.LMSSetValue('cmi.suspend_data', 'x'.repeat(4097))).toBe('false');
            expect(api.LMSGetLastError()).toBe('405');
            expect(api.data['cmi.suspend_data'].length).toBe(4096);
        });

        it.each(['obj 1', '', 'x'.repeat(256)])('refuses the malformed CMIIdentifier %p', value => {
            const api = initialized();

            expect(api.LMSSetValue('cmi.objectives.0.id', value)).toBe('false');
            expect(api.LMSGetLastError()).toBe('405');
        });

        it('distinguishes CMITime from CMITimespan', () => {
            const api = initialized();

            // CMITime: hours 00-23, minutes and seconds below 60.
            expect(api.LMSSetValue('cmi.interactions.0.time', '22:30:40')).toBe('true');
            expect(api.LMSSetValue('cmi.interactions.0.time', '24:00:00')).toBe('false');
            expect(api.LMSSetValue('cmi.interactions.0.time', '0010:34:34.56')).toBe('false');

            // CMITimespan: four-digit hours, minutes and seconds up to 99.
            expect(api.LMSSetValue('cmi.core.session_time', '0010:34:34.56')).toBe('true');
            expect(api.LMSSetValue('cmi.interactions.0.latency', '00:99:99')).toBe('true');
            expect(api.LMSSetValue('cmi.core.session_time', '10000:00:00.00')).toBe('false');
        });

        it('accepts either a vocabulary token or a decimal for an interaction result', () => {
            const api = initialized();

            expect(api.LMSSetValue('cmi.interactions.0.result', 'correct')).toBe('true');
            expect(api.LMSSetValue('cmi.interactions.0.result', '0.75')).toBe('true');
            expect(api.LMSSetValue('cmi.interactions.0.result', 'sort-of')).toBe('false');
        });

        it('appends to cmi.comments instead of overwriting', () => {
            const api = initialized();

            api.LMSSetValue('cmi.comments', 'first. ');
            api.LMSSetValue('cmi.comments', 'second.');

            expect(api.LMSGetValue('cmi.comments')).toBe('first. second.');
        });

        it('optionally rejects non-ASCII values', () => {
            const strict = initialized({ rejectAsciiViolations: true });
            const lenient = initialized();

            expect(strict.LMSSetValue('cmi.suspend_data', 'café')).toBe('false');
            expect(strict.LMSGetLastError()).toBe('405');
            expect(lenient.LMSSetValue('cmi.suspend_data', 'café')).toBe('true');
        });

        it('exposes the type validator for direct assertions', () => {
            expect(isValidValue({ type: 'CMIDecimal', min: 0, max: 100 }, '50')).toBe(true);
            expect(isValidValue({ type: 'CMIDecimal', min: 0, max: 100 }, '150')).toBe(false);
            expect(isValidValue({ type: 'SomethingElse' }, 'anything')).toBe(true);
        });
    });

    describe('array indices', () => {
        it('_count is the number of records, not the last index', () => {
            const api = initialized();

            expect(api.LMSGetValue('cmi.objectives._count')).toBe('0');
            api.LMSSetValue('cmi.objectives.0.id', 'obj-a');
            expect(api.LMSGetValue('cmi.objectives._count')).toBe('1');
            api.LMSSetValue('cmi.objectives.1.id', 'obj-b');
            expect(api.LMSGetValue('cmi.objectives._count')).toBe('2');
        });

        it('_count increments once per new index, not per sub-element write', () => {
            const api = initialized();

            api.LMSSetValue('cmi.interactions.0.id', 'q1');
            api.LMSSetValue('cmi.interactions.0.type', 'choice');
            api.LMSSetValue('cmi.interactions.0.result', 'correct');

            expect(api.LMSGetValue('cmi.interactions._count')).toBe('1');
        });

        it('accepts index == _count (append) and index < _count (overwrite)', () => {
            const api = initialized();

            expect(api.LMSSetValue('cmi.objectives.0.id', 'a')).toBe('true');
            expect(api.LMSSetValue('cmi.objectives.1.id', 'b')).toBe('true');
            expect(api.LMSSetValue('cmi.objectives.0.id', 'a2')).toBe('true');
            expect(api.LMSGetValue('cmi.objectives._count')).toBe('2');
        });

        it('rejects an index beyond the current count with 201', () => {
            const api = initialized();
            api.LMSSetValue('cmi.objectives.0.id', 'a');
            api.LMSSetValue('cmi.objectives.1.id', 'b');

            expect(api.LMSSetValue('cmi.objectives.5.id', 'f')).toBe('false');
            expect(api.LMSGetLastError()).toBe('201');
        });

        it('rejects writing n+1 before n', () => {
            const api = initialized();

            expect(api.LMSSetValue('cmi.interactions.1.id', 'q2')).toBe('false');
            expect(api.LMSGetLastError()).toBe('201');
        });

        it('rejects reading an index that was never set with 201', () => {
            const api = initialized();

            expect(api.LMSGetValue('cmi.objectives.3.id')).toBe('');
            expect(api.LMSGetLastError()).toBe('201');
        });

        it('tracks nested list counts independently', () => {
            const api = initialized();
            api.LMSSetValue('cmi.interactions.0.id', 'q1');

            expect(api.LMSSetValue('cmi.interactions.0.correct_responses.0.pattern', 'a')).toBe('true');
            expect(api.LMSGetValue('cmi.interactions.0.correct_responses._count')).toBe('1');
            expect(api.LMSGetValue('cmi.interactions.1.objectives._count')).toBe('0');
        });

        it.each(['cmi.objectives.-1.id', 'cmi.objectives.+1.id'])('rejects the malformed index %s', element => {
            const api = initialized();

            expect(api.LMSSetValue(element, 'a')).toBe('false');
            expect(api.LMSGetLastError()).toBe('201');
        });
    });

    describe('error strings and diagnostics', () => {
        it.each([
            [0, 'No error'],
            [101, 'General exception'],
            [201, 'Invalid argument error'],
            [202, 'Element cannot have children'],
            [203, 'Element not an array - cannot have count'],
            [301, 'Not initialized'],
            [401, 'Not implemented error'],
            [402, 'Invalid set value, element is a keyword'],
            [403, 'Element is read only'],
            [404, 'Element is write only'],
            [405, 'Incorrect Data Type'],
        ])('LMSGetErrorString(%d) is "%s"', (code, text) => {
            expect(createFakeScorm12Api().LMSGetErrorString(String(code))).toBe(text);
            expect(SCORM12_ERROR_STRINGS[code]).toBe(text);
        });

        it('answers an unknown error code with an empty string', () => {
            expect(createFakeScorm12Api().LMSGetErrorString('999')).toBe('');
        });

        it('LMSGetDiagnostic("") describes the current error without learner data', () => {
            const api = initialized();
            api.LMSSetValue('cmi.core.score.raw', '400');

            expect(api.LMSGetDiagnostic('')).toBe("LMSSetValue('cmi.core.score.raw')");
            expect(api.LMSGetDiagnostic('403')).toBe('Element is read only');
            expect(api.LMSGetDiagnostic('999')).toBe('');
        });
    });

    describe('call recording helpers', () => {
        it('records call names, arguments and readable signatures', () => {
            const api = initialized();
            api.LMSSetValue('cmi.core.lesson_status', 'completed');
            api.LMSGetValue('cmi.core.lesson_status');

            expect(api.callNames()).toEqual(['LMSInitialize', 'LMSSetValue', 'LMSGetValue']);
            expect(api.callsFor('LMSSetValue')).toEqual([['cmi.core.lesson_status', 'completed']]);
            expect(api.callSignatures()).toEqual([
                'LMSInitialize',
                'LMSSetValue(cmi.core.lesson_status=completed)',
                'LMSGetValue(cmi.core.lesson_status)',
            ]);

            api.resetCalls();
            expect(api.calls).toEqual([]);
        });
    });

    describe('CMITimespan arithmetic helpers', () => {
        it.each([
            ['0000:00:00.00', 0],
            ['0000:00:01.50', 1500],
            ['0001:00:00.00', 3600000],
            ['0010:34:34.56', 38074560],
            ['00:29:00', 1740000],
            ['01:27:45.5', 5265500],
        ])('parses %s as %d ms', (text, milliseconds) => {
            expect(timespanToMs(text)).toBe(milliseconds);
        });

        it('parses an unreadable timespan as zero', () => {
            expect(timespanToMs('nonsense')).toBe(0);
        });

        it.each([
            [0, '0000:00:00.00'],
            [1500, '0000:00:01.50'],
            [3600000, '0001:00:00.00'],
            [-5, '0000:00:00.00'],
        ])('renders %d ms as %s', (milliseconds, text) => {
            expect(msToTimespan(milliseconds)).toBe(text);
        });

        it('clamps beyond the representable maximum', () => {
            expect(msToTimespan(1e12).indexOf('9999:')).toBe(0);
        });
    });
});
