/**
 * Tests for the scorm-again LMS harness of the SCORM 1.2 contract suite: the
 * oracle settings really reach the Scorm12API instance, the recording facade
 * journals exactly what the scenarios assert on, and the inspection helpers
 * read the journal and the stored CMI the way the scenarios expect.
 */
import { describe, expect, it } from 'vitest';
import {
    CONTRACT_LMS_SETTINGS,
    LMS_PROFILES,
    MOODLE_LMS_SETTINGS,
    createContractLms,
    createLmsWindowTree,
    defaultCmiSeed,
} from './scorm-again-lms.test-util.js';

describe('createContractLms', () => {
    it('pins every conservative oracle setting on the Scorm12API instance', () => {
        const lms = createContractLms();
        expect(CONTRACT_LMS_SETTINGS).toMatchObject({
            strict_errors: true,
            autocommit: false,
            mastery_override: false,
        });
        for (const [key, value] of Object.entries(CONTRACT_LMS_SETTINGS)) {
            expect(lms.api.settings[key]).toBe(value);
        }
        const overridden = createContractLms({ settings: { autoCompleteLessonStatus: true } });
        expect(overridden.api.settings.autoCompleteLessonStatus).toBe(true);
        expect(overridden.api.settings.strict_errors).toBe(true);
    });

    it('seeds the attempt like a real LMS and deep-merges caller overrides', () => {
        const lms = createContractLms({ cmi: { student_data: { mastery_score: '80' } } });
        expect(lms.stored('core.lesson_status')).toBe('not attempted');
        expect(lms.stored('cmi.core.entry')).toBe('ab-initio');
        expect(lms.stored('core.student_id')).toBe(defaultCmiSeed().cmi.core.student_id);
        expect(lms.stored('student_data.mastery_score')).toBe('80');
        expect(lms.stored('no.such.element')).toBeUndefined();
    });

    it('journals method, arguments, argument types, result and error code of every state call', () => {
        const lms = createContractLms();
        expect(lms.windowApi.LMSInitialize('')).toBe('true');
        lms.windowApi.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        lms.windowApi.LMSSetValue('cmi.core.score.raw', 85);
        expect(lms.windowApi.LMSSetValue('cmi.core.lesson_status', 'not attempted')).toBe('false');
        expect(lms.calls).toEqual([
            { method: 'LMSInitialize', args: [''], argTypes: ['string'], result: 'true', errorAfter: '0' },
            {
                method: 'LMSSetValue',
                args: ['cmi.core.lesson_status', 'incomplete'],
                argTypes: ['string', 'string'],
                result: 'true',
                errorAfter: '0',
            },
            {
                method: 'LMSSetValue',
                args: ['cmi.core.score.raw', '85'],
                argTypes: ['string', 'number'],
                result: 'true',
                errorAfter: '0',
            },
            {
                method: 'LMSSetValue',
                args: ['cmi.core.lesson_status', 'not attempted'],
                argTypes: ['string', 'string'],
                result: 'false',
                errorAfter: '405',
            },
        ]);
        expect(lms.lastError()).toBe('405');
        expect(lms.stored('core.lesson_status')).toBe('incomplete');
        expect(lms.stored('core.score.raw')).toBe('85');
    });

    it('answers journal queries: writesTo, rejectedCalls, callsOf and callsSince a checkpoint', () => {
        const lms = createContractLms();
        lms.windowApi.LMSInitialize('');
        const afterLaunch = lms.checkpoint();
        lms.windowApi.LMSSetValue('cmi.core.exit', 'suspend');
        lms.windowApi.LMSSetValue('cmi.core.exit', 'bogus');
        lms.windowApi.LMSCommit('');
        lms.windowApi.LMSFinish('');
        expect(lms.writesTo('cmi.core.exit').map(call => call.args[1])).toEqual(['suspend', 'bogus']);
        expect(lms.rejectedCalls().map(call => [call.args[1], call.errorAfter])).toEqual([['bogus', '405']]);
        expect(lms.callsOf('LMSFinish')).toHaveLength(1);
        expect(lms.callsSince(afterLaunch).map(call => call.method)).toEqual([
            'LMSSetValue',
            'LMSSetValue',
            'LMSCommit',
            'LMSFinish',
        ]);
    });

    it('does not journal the error-inspection functions', () => {
        const lms = createContractLms();
        expect(lms.windowApi.LMSGetLastError()).toBe('0');
        lms.windowApi.LMSGetErrorString('0');
        lms.windowApi.LMSGetDiagnostic('');
        expect(lms.calls).toEqual([]);
    });
});

describe('createLmsWindowTree', () => {
    it('exposes the API on the parent/top of the SCO window, never on the SCO window itself', () => {
        const { windowApi } = createContractLms();
        const { scoWindow, lmsWindow } = createLmsWindowTree(windowApi, { API_1484_11: { decoy: true } });
        expect(scoWindow.API).toBeUndefined();
        expect(scoWindow.parent).toBe(lmsWindow);
        expect(scoWindow.top).toBe(lmsWindow);
        expect(lmsWindow.API).toBe(windowApi);
        expect(lmsWindow.parent).toBe(lmsWindow);
        expect(lmsWindow.top).toBe(lmsWindow);
        expect(lmsWindow.API_1484_11).toEqual({ decoy: true });
    });
});

describe('LMS profiles', () => {
    function launch(lms) {
        expect(lms.windowApi.LMSInitialize('')).toBe('true');
        return lms;
    }

    it('defaults to the conservative profile and keeps its settings exactly as before', () => {
        expect(Object.keys(LMS_PROFILES)).toEqual(['conservative', 'moodle']);
        expect(LMS_PROFILES.conservative.settings).toBe(CONTRACT_LMS_SETTINGS);
        for (const lms of [createContractLms(), createContractLms({ profile: 'conservative' })]) {
            expect(lms.profile).toBe('conservative');
            for (const [key, value] of Object.entries(CONTRACT_LMS_SETTINGS)) {
                expect(lms.api.settings[key]).toBe(value);
            }
            expect(lms.lmsRewrites).toEqual([]);
        }
    });

    it('rejects an unknown profile loudly', () => {
        expect(() => createContractLms({ profile: 'blackboard' })).toThrow(/Unknown LMS profile "blackboard"/);
    });

    it('moodle: turns on mastery_override and keeps every other conservative setting', () => {
        expect(MOODLE_LMS_SETTINGS).toEqual({ ...CONTRACT_LMS_SETTINGS, mastery_override: true });
        expect(LMS_PROFILES.moodle.settings).toBe(MOODLE_LMS_SETTINGS);
        const lms = createContractLms({ profile: 'moodle' });
        expect(lms.profile).toBe('moodle');
        for (const [key, value] of Object.entries(MOODLE_LMS_SETTINGS)) {
            expect(lms.api.settings[key]).toBe(value);
        }
        // Explicit settings still win over the profile.
        const overridden = createContractLms({ profile: 'moodle', settings: { mastery_override: false } });
        expect(overridden.api.settings.mastery_override).toBe(false);
        expect(overridden.profile).toBe('moodle');
    });

    it('journals the refusal of a second LMSInitialize with 101 and the session stays usable (both profiles)', () => {
        for (const profile of ['conservative', 'moodle']) {
            const lms = launch(createContractLms({ profile }));
            expect(lms.windowApi.LMSInitialize('')).toBe('false');
            expect(lms.windowApi.LMSSetValue('cmi.core.score.raw', '60')).toBe('true');
            expect(lms.callsOf('LMSInitialize').map(call => [call.result, call.errorAfter])).toEqual([
                ['true', '0'],
                ['false', '101'],
            ]);
            expect(lms.rejectedCalls().map(call => call.method)).toEqual(['LMSInitialize']);
            expect(lms.stored('core.score.raw')).toBe('60');
        }
    });

    it('moodle: refuses a SCO write of "not attempted" with 405', () => {
        const lms = launch(createContractLms({ profile: 'moodle' }));
        expect(lms.windowApi.LMSSetValue('cmi.core.lesson_status', 'not attempted')).toBe('false');
        expect(lms.lastError()).toBe('405');
        expect(lms.stored('core.lesson_status')).toBe('not attempted');
    });

    it('moodle: promotes an "incomplete" attempt with a stored score at LMSFinish (forcecompleted)', () => {
        const lms = launch(createContractLms({ profile: 'moodle' }));
        lms.windowApi.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        lms.windowApi.LMSSetValue('cmi.core.score.raw', '40');
        expect(lms.stored('core.lesson_status')).toBe('incomplete');
        expect(lms.windowApi.LMSFinish('')).toBe('true');
        expect(lms.stored('core.lesson_status')).toBe('completed');
        expect(lms.lmsRewrites).toEqual([
            { rule: 'forcecompleted', element: 'cmi.core.lesson_status', from: 'incomplete', to: 'completed' },
        ]);
        // The rewrite is LMS-side: the journal holds only what the SCO sent.
        expect(lms.writesTo('cmi.core.lesson_status').map(call => call.args[1])).toEqual(['incomplete']);
    });

    it('moodle: leaves an "incomplete" attempt without any score alone at LMSFinish', () => {
        const lms = launch(createContractLms({ profile: 'moodle' }));
        lms.windowApi.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        expect(lms.windowApi.LMSFinish('')).toBe('true');
        expect(lms.stored('core.lesson_status')).toBe('incomplete');
        expect(lms.lmsRewrites).toEqual([]);
    });

    it('moodle: applies the published mastery score at LMSFinish in both directions (masteryoverride)', () => {
        const below = launch(createContractLms({ profile: 'moodle', cmi: { student_data: { mastery_score: '80' } } }));
        below.windowApi.LMSSetValue('cmi.core.score.raw', '70');
        below.windowApi.LMSSetValue('cmi.core.lesson_status', 'passed');
        expect(below.windowApi.LMSFinish('')).toBe('true');
        expect(below.stored('core.lesson_status')).toBe('failed');
        expect(below.lmsRewrites).toEqual([
            { rule: 'masteryoverride', element: 'cmi.core.lesson_status', from: 'passed', to: 'failed' },
        ]);

        const above = launch(createContractLms({ profile: 'moodle', cmi: { student_data: { mastery_score: '80' } } }));
        above.windowApi.LMSSetValue('cmi.core.score.raw', '80');
        above.windowApi.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        expect(above.windowApi.LMSFinish('')).toBe('true');
        expect(above.stored('core.lesson_status')).toBe('passed');
        // masteryoverride decided first; forcecompleted found nothing left to promote.
        expect(above.lmsRewrites).toEqual([
            { rule: 'masteryoverride', element: 'cmi.core.lesson_status', from: 'incomplete', to: 'passed' },
        ]);

        const agreeing = launch(
            createContractLms({ profile: 'moodle', cmi: { student_data: { mastery_score: '80' } } }),
        );
        agreeing.windowApi.LMSSetValue('cmi.core.score.raw', '70');
        agreeing.windowApi.LMSSetValue('cmi.core.lesson_status', 'failed');
        expect(agreeing.windowApi.LMSFinish('')).toBe('true');
        expect(agreeing.stored('core.lesson_status')).toBe('failed');
        expect(agreeing.lmsRewrites).toEqual([]);
    });

    it('moodle: completes an attempt the SCO never touched at LMSFinish', () => {
        const lms = launch(createContractLms({ profile: 'moodle' }));
        expect(lms.windowApi.LMSFinish('')).toBe('true');
        expect(lms.stored('core.lesson_status')).toBe('completed');
        expect(lms.lmsRewrites).toEqual([
            {
                rule: 'not-attempted-completed',
                element: 'cmi.core.lesson_status',
                from: 'not attempted',
                to: 'completed',
            },
        ]);
        // Why the rule is a hook and not scorm-again's autoCompleteLessonStatus:
        // the library counts a seeded status as "set by the module" and its
        // setting never fires for a real LMS-seeded attempt.
        const library = launch(createContractLms({ settings: { autoCompleteLessonStatus: true } }));
        expect(library.windowApi.LMSFinish('')).toBe('true');
        expect(library.stored('core.lesson_status')).toBe('not attempted');
    });

    it('conservative: never rewrites the status at LMSFinish', () => {
        const scored = launch(createContractLms({ cmi: { student_data: { mastery_score: '80' } } }));
        scored.windowApi.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        scored.windowApi.LMSSetValue('cmi.core.score.raw', '70');
        expect(scored.windowApi.LMSFinish('')).toBe('true');
        expect(scored.stored('core.lesson_status')).toBe('incomplete');
        expect(scored.lmsRewrites).toEqual([]);

        const untouched = launch(createContractLms());
        expect(untouched.windowApi.LMSFinish('')).toBe('true');
        expect(untouched.stored('core.lesson_status')).toBe('not attempted');
        expect(untouched.lmsRewrites).toEqual([]);
    });

    it('names a finish-time rewrite scorm-again made on its own, so no LMS-side change goes unreported', () => {
        // score_overrides_status is a scorm-again rule (not Moodle's
        // masteryoverride): under the conservative profile it still shows up.
        const lms = launch(
            createContractLms({
                settings: { score_overrides_status: true },
                cmi: { student_data: { mastery_score: '80' } },
            }),
        );
        lms.windowApi.LMSSetValue('cmi.core.lesson_status', 'passed');
        lms.windowApi.LMSSetValue('cmi.core.score.raw', '70');
        expect(lms.windowApi.LMSFinish('')).toBe('true');
        expect(lms.stored('core.lesson_status')).toBe('failed');
        expect(lms.lmsRewrites).toEqual([
            {
                rule: 'scorm-again-finish-default',
                element: 'cmi.core.lesson_status',
                from: 'passed',
                to: 'failed',
            },
        ]);
    });

    it('moodle: the finish-time rules run only after a successful LMSFinish', () => {
        const lms = launch(createContractLms({ profile: 'moodle' }));
        lms.windowApi.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        lms.windowApi.LMSSetValue('cmi.core.score.raw', '40');
        lms.windowApi.LMSFinish('bye'); // 201: not a termination
        expect(lms.lastError()).toBe('201');
        expect(lms.stored('core.lesson_status')).toBe('incomplete');
        expect(lms.lmsRewrites).toEqual([]);
        expect(lms.windowApi.LMSFinish('')).toBe('true');
        expect(lms.stored('core.lesson_status')).toBe('completed');
        expect(lms.lmsRewrites.map(rewrite => rewrite.rule)).toEqual(['forcecompleted']);
    });
});
