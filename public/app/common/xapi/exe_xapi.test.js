import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

const xapi = require('./exe_xapi.js');
// Load the shipped gamification layer so these tests exercise the REAL package
// aggregator. Re-implementing getFinalScore here would prove the emitter agrees
// with a copy of the algorithm rather than with the algorithm.
require('../common.js');

const ANSWERED_VERB = 'http://adlnet.gov/expapi/verbs/answered';
const COMPLETED_VERB = 'http://adlnet.gov/expapi/verbs/completed';
const PASSED_VERB = 'http://adlnet.gov/expapi/verbs/passed';
const FAILED_VERB = 'http://adlnet.gov/expapi/verbs/failed';
const IDEVICE_ID_EXTENSION = 'https://exelearning.net/xapi/extensions/idevice-id';
const PAGE_COUNT_EXTENSION = 'https://exelearning.net/xapi/extensions/page-count';
const PAGE_ID_EXTENSION = 'https://exelearning.net/xapi/extensions/page-id';
const PAGE_TITLE_EXTENSION = 'https://exelearning.net/xapi/extensions/page-title';
const INITIALIZED_VERB = 'http://adlnet.gov/expapi/verbs/initialized';

/** The one shipped implementation of the weighted package total. */
const getFinalScore = global.$exeDevices.iDevice.gamification.scorm.getFinalScore;

/**
 * Helper: install a fake parent window so the postMessage transport fires
 * (happy-dom sets window.parent === window by default, which the lib treats
 * as "no parent").
 */
function installFakeParent() {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', {
        value: { postMessage, [Symbol.for('fake')]: true },
        configurable: true,
        writable: true,
    });
    return postMessage;
}

function lastStatement(spy) {
    return spy.mock.calls[spy.mock.calls.length - 1][0].statement;
}
function statementsByVerb(spy, verbId) {
    return spy.mock.calls
        .map((c) => c[0].statement)
        .filter((s) => s.verb.id === verbId);
}

describe('exe_xapi emitter', () => {
    let originalParent;

    beforeEach(() => {
        originalParent = Object.getOwnPropertyDescriptor(window, 'parent');
        // Reset singleton state between tests.
        xapi._initialised = false;
        xapi.config = null;
        xapi.launch = null;
        xapi._state = {};
        xapi._lastSig = {};
        xapi._lifecycle = { initialized: false, terminated: false };
        xapi._census = {};
        delete window.exeXapi;
        // No getFinalScore stub: common.js installs the real one on
        // $exeDevices.iDevice.gamification.scorm, which is what the emitter reads.
        // Restore it here because a later test swaps in a throwing aggregator.
        global.$exeDevices.iDevice.gamification.scorm.getFinalScore = getFinalScore;
    });

    afterEach(() => {
        if (originalParent) Object.defineProperty(window, 'parent', originalParent);
        vi.restoreAllMocks();
    });

    it('derives package and per-iDevice IRIs from odeId', () => {
        window.exeXapi = { odeId: 'PKG1', packageTitle: 'Demo', language: 'es' };
        xapi.init();
        expect(xapi.config.baseIri).toBe('https://exelearning.net/xapi/PKG1');
        expect(xapi.config.activityId).toBe('https://exelearning.net/xapi/PKG1');
    });

    it('falls back to the document URL when no config is injected', () => {
        xapi.init();
        expect(typeof xapi.config.baseIri).toBe('string');
        expect(xapi.config.activityId).toBe(xapi.config.baseIri);
    });

    it('emits an "answered" statement per iDevice with a stable IRI and scaled score', () => {
        window.exeXapi = { odeId: 'PKG1', packageTitle: 'Demo' };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'idevice-abc', ideviceType: 'trueorfalse', ideviceNumber: 1, title: 'Q1', score: 8, weighted: '25' });

        const answered = statementsByVerb(spy, ANSWERED_VERB);
        expect(answered).toHaveLength(1);
        const s = answered[0];
        expect(s.object.id).toBe('https://exelearning.net/xapi/PKG1/idevice/idevice-abc');
        expect(s.result.score).toEqual({ scaled: 0.8, raw: 8, min: 0, max: 10 });
        expect(s.result.success).toBe(true);
        expect(s.object.definition.extensions['https://exelearning.net/xapi/extensions/idevice-type']).toBe('trueorfalse');
        expect(s.context.contextActivities.parent[0].id).toBe('https://exelearning.net/xapi/PKG1');
        expect(s.id).toMatch(/^[0-9a-f-]{36}$/i);
    });






    it.each([
        ['zero (jQuery could not locate the node)', 0],
        ['negative', -1],
        ['missing', undefined],
    ])('omits the order and the package aggregate for a %s iDevice number', (_label, ideviceNumber) => {
        window.exeXapi = { odeId: 'PKG1', ideviceOrderOffset: 4 };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'device-a', ideviceNumber, score: 8, weighted: 25 });

        // The granular statement is still reported...
        const answered = statementsByVerb(spy, ANSWERED_VERB);
        expect(answered).toHaveLength(1);
        // ...but an iDevice that cannot be placed must not shift the aggregate
        // under a false slot (#2302).
        expect(xapi._state).toEqual({});
        expect(statementsByVerb(spy, COMPLETED_VERB)).toHaveLength(0);
        expect(statementsByVerb(spy, PASSED_VERB)).toHaveLength(0);
        expect(statementsByVerb(spy, FAILED_VERB)).toHaveLength(0);
    });

    it('suppresses the package verdict on a multipage package', () => {
        // Each page only knows its own scores, so a page-local verdict wearing
        // the package IRI would let two pages emit "passed" and "failed" for the
        // same activity in one attempt. Consumers rebuild it from the per-iDevice
        // statements instead (ADR-2302-01).
        window.exeXapi = { odeId: 'PKG1', pageCount: 2 };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'd2', ideviceNumber: 1, score: 4, weighted: 75 });

        const answered = statementsByVerb(spy, ANSWERED_VERB);
        expect(answered).toHaveLength(1);
        expect(statementsByVerb(spy, COMPLETED_VERB)).toHaveLength(0);
        expect(statementsByVerb(spy, PASSED_VERB)).toHaveLength(0);
        expect(statementsByVerb(spy, FAILED_VERB)).toHaveLength(0);
    });

    it('still emits the package verdict for a single-page package', () => {
        window.exeXapi = { odeId: 'PKG1', pageCount: 1 };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 });

        expect(statementsByVerb(spy, COMPLETED_VERB)).toHaveLength(1);
        expect(statementsByVerb(spy, PASSED_VERB)).toHaveLength(1);
    });


    describe('evaluable seeding (#2302)', () => {
        it('seeds the aggregate at 0 so a partial attempt is not inflated', () => {
            // Single page, so the package verdict is still emitted. The learner
            // answers only the 25-point iDevice: 100 x 25 / 100 = 25, not 100.
            window.exeXapi = { odeId: 'PKG1', pageCount: 1 };
            const spy = installFakeParent();
            xapi.init();

            xapi.registerEvaluable({ ideviceId: 'dev-a', ideviceNumber: 1, title: 'A', weighted: 25 });
            xapi.registerEvaluable({ ideviceId: 'dev-b', ideviceNumber: 2, title: 'B', weighted: 75 });
            xapi.emit({ type: 'answered', ideviceId: 'dev-a', ideviceNumber: 1, score: 10, weighted: 25 });

            const completed = statementsByVerb(spy, COMPLETED_VERB);
            expect(completed[completed.length - 1].result.score.raw).toBe(25);
            expect(statementsByVerb(spy, FAILED_VERB)).toHaveLength(1);
        });

        it('never lets an answer overwrite its own score with the seeded 0', () => {
            window.exeXapi = { odeId: 'PKG1', pageCount: 1 };
            installFakeParent();
            xapi.init();

            xapi.emit({ type: 'answered', ideviceId: 'dev-a', ideviceNumber: 1, score: 10, weighted: 25 });
            // A late registration for an already-answered iDevice must not reset it.
            xapi.registerEvaluable({ ideviceId: 'dev-a', ideviceNumber: 1, weighted: 25 });

            expect(xapi._state[1].score).toBe(100);
        });

        it.each([
            ['zero (jQuery could not locate the node)', 0],
            ['negative', -1],
            ['missing', undefined],
        ])('never seeds under a %s page-local slot', (_label, ideviceNumber) => {
            // index() returning -1 yields slot 0: an iDevice that cannot be placed
            // must not shift the aggregate under a false slot.
            window.exeXapi = { odeId: 'PKG1', pageCount: 1 };
            installFakeParent();
            xapi.init();

            xapi.registerEvaluable({ ideviceId: 'dev-lost', ideviceNumber, weighted: 75 });

            expect(xapi._state).toEqual({});
        });

        it('ignores a registration with no stable iDevice id, and never re-seeds a slot', () => {
            window.exeXapi = { odeId: 'PKG1', pageCount: 1 };
            installFakeParent();
            xapi.init();

            xapi.registerEvaluable({ ideviceNumber: 1, weighted: 25 });
            xapi.registerEvaluable(null);
            expect(xapi._state).toEqual({});

            xapi.registerEvaluable({ ideviceId: 'dev-a', ideviceNumber: 1, weighted: 25 });
            xapi.registerEvaluable({ ideviceId: 'dev-a', ideviceNumber: 1, weighted: 99 });
            expect(xapi._state[1].weighted).toBe(25);
        });
    });

    it('emits package "completed" + "passed" when the aggregate is >= 50', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();

        // score 8 (0..10) -> 80 (0..100) -> avg 80 -> passed
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, title: 'Q1', score: 8, weighted: 1 });

        const completed = statementsByVerb(spy, COMPLETED_VERB);
        expect(completed).toHaveLength(1);
        const passed = statementsByVerb(spy, PASSED_VERB);
        expect(passed).toHaveLength(1);
        expect(passed[0].result.score.scaled).toBe(0.8);
        expect(passed[0].result.success).toBe(true);
        expect(passed[0].object.definition.type).toBe('http://adlnet.gov/expapi/activities/assessment');
    });

    it('emits package "failed" when the aggregate is below 50', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, title: 'Q1', score: 2, weighted: 1 });

        const failed = statementsByVerb(spy, FAILED_VERB);
        expect(failed).toHaveLength(1);
        expect(statementsByVerb(spy, PASSED_VERB)).toHaveLength(0);
    });

    it('debounces duplicate statements with the same score', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, title: 'Q1', score: 8, weighted: 1 });
        const after1 = spy.mock.calls.length;
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, title: 'Q1', score: 8, weighted: 1 });
        expect(spy.mock.calls.length).toBe(after1); // no new statements
    });


    it.each([
        ['above the scale', 25, 10, 1],
        ['negative', -3, 0, 0],
    ])('clamps a score %s onto the declared 0..10 scale', (_label, score, expectedraw, expectedscaled) => {
        // The statement advertises min 0 / max 10; emitting raw 25 / scaled 2.5 is
        // the one shape a strict LRS (and the Moodle consumer's score validation)
        // must reject, so the emitter never produces it.
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score, weighted: 1 });

        const answered = statementsByVerb(spy, ANSWERED_VERB)[0];
        expect(answered.result.score.raw).toBe(expectedraw);
        expect(answered.result.score.scaled).toBe(expectedscaled);
    });

    it('ignores events with a non-numeric score', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();
        // init() may emit a lifecycle statement; measure only emit()'s effect.
        const before = spy.mock.calls.length;
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 'n/a', weighted: 75 });
        expect(spy.mock.calls.length).toBe(before);
        expect(statementsByVerb(spy, ANSWERED_VERB)).toHaveLength(0);
    });

    it('is a silent no-op when there is no parent and no LRS', () => {
        window.exeXapi = { odeId: 'PKG1' };
        // window.parent === window in happy-dom -> treated as no parent.
        expect(window.parent === window).toBe(true);
        xapi.init();
        // No transport -> no lifecycle statement is emitted either.
        expect(xapi._lifecycle.initialized).toBe(false);
        expect(() =>
            xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 })
        ).not.toThrow();
        // And terminating without a transport stays a no-op.
        xapi._emitTerminated();
        expect(xapi._lifecycle.terminated).toBe(false);
    });

    it('parses xAPI launch params and POSTs to the LRS', () => {
        const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }));
        vi.stubGlobal('fetch', fetchSpy);
        const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
        Object.defineProperty(window, 'location', {
            value: {
                origin: 'https://host.example',
                pathname: '/p.html',
                search: '?endpoint=https%3A%2F%2Flrs.example%2Fxapi&auth=Basic%20abc&registration=reg-1',
            },
            configurable: true,
        });
        try {
            window.exeXapi = { odeId: 'PKG1' };
            xapi.init();
            expect(xapi.launch.endpoint).toBe('https://lrs.example/xapi/');
            expect(xapi.launch.registration).toBe('reg-1');

            xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 });

            expect(fetchSpy).toHaveBeenCalled();
            // Find the "answered" POST (a lifecycle "initialized" POST may precede it).
            const answeredPost = fetchSpy.mock.calls.find(
                (c) => JSON.parse(c[1].body).verb.id === 'http://adlnet.gov/expapi/verbs/answered'
            );
            const [url, opts] = answeredPost;
            expect(url).toBe('https://lrs.example/xapi/statements');
            expect(opts.method).toBe('POST');
            expect(opts.headers['X-Experience-API-Version']).toBe('1.0.3');
            expect(opts.headers.Authorization).toBe('Basic abc');
            const body = JSON.parse(opts.body);
            expect(body.context.registration).toBe('reg-1');
        } finally {
            if (originalLocation) Object.defineProperty(window, 'location', originalLocation);
        }
    });

    it('uses an anonymous account actor when none is supplied', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 });
        const s = lastStatement(spy);
        expect(s.actor.account.name).toBe('anonymous');
        expect(s.actor.account.homePage).toBe('https://exelearning.net/xapi/PKG1');
    });

    it('honours an injected actor when posting to a configured parentOrigin', () => {
        window.exeXapi = {
            odeId: 'PKG1',
            actor: { mbox: 'mailto:a@b.c', objectType: 'Agent' },
            parentOrigin: 'https://moodle.test',
        };
        const spy = installFakeParent();
        xapi.init();
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 });
        const answered = statementsByVerb(spy, 'http://adlnet.gov/expapi/verbs/answered')[0];
        expect(answered.actor.mbox).toBe('mailto:a@b.c'); // delivered intact to the intended host
    });

    it('anonymizes the actor when broadcasting to an unrestricted origin (no parentOrigin)', () => {
        // Security (#1867): with no parentOrigin the statement is posted to '*'
        // (any origin); a configured learner identity must NOT leak there.
        window.exeXapi = { odeId: 'PKG1', actor: { mbox: 'mailto:a@b.c', objectType: 'Agent' } };
        const spy = installFakeParent();
        xapi.init();
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 });
        const answeredCall = spy.mock.calls.find(
            (c) => c[0].statement.verb.id === 'http://adlnet.gov/expapi/verbs/answered'
        );
        expect(answeredCall[1]).toBe('*'); // broadcast to any origin
        expect(answeredCall[0].statement.actor.mbox).toBeUndefined(); // real identity stripped
        expect(answeredCall[0].statement.actor.account.name).toBe('anonymous');
    });

    it('honours an injected baseIri override and parentOrigin', () => {
        window.exeXapi = { odeId: 'PKG1', baseIri: 'https://custom.example/base', parentOrigin: 'https://moodle.test' };
        const spy = installFakeParent();
        xapi.init();
        expect(xapi.config.activityId).toBe('https://custom.example/base');

        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 });

        // The "initialized" lifecycle statement precedes emit() output, so find
        // the answered call by verb rather than by call index.
        const answeredCall = spy.mock.calls.find(
            (c) => c[0].statement.verb.id === 'http://adlnet.gov/expapi/verbs/answered'
        );
        expect(answeredCall[0].statement.object.id).toBe('https://custom.example/base/idevice/d1');
        expect(answeredCall[1]).toBe('https://moodle.test'); // postMessage targetOrigin
    });

    it('falls back to a Math.random UUID when crypto.randomUUID is unavailable', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        const originalCrypto = Object.getOwnPropertyDescriptor(window, 'crypto');
        Object.defineProperty(window, 'crypto', { value: {}, configurable: true });
        try {
            xapi.init();
            xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 });
            expect(lastStatement(spy).id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        } finally {
            if (originalCrypto) Object.defineProperty(window, 'crypto', originalCrypto);
        }
    });

    it('parses a JSON actor from the launch URL', () => {
        const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
        const actor = { mbox: 'mailto:l@x.y', objectType: 'Agent' };
        Object.defineProperty(window, 'location', {
            value: {
                origin: 'https://h',
                pathname: '/p',
                search: `?endpoint=https%3A%2F%2Flrs%2Fx&auth=Basic%20z&actor=${encodeURIComponent(JSON.stringify(actor))}`,
            },
            configurable: true,
        });
        const spy = installFakeParent();
        try {
            // parentOrigin set so the parsed launch actor is delivered to the
            // concrete host (without it, broadcasting to '*' anonymizes it; see
            // the dedicated anonymization test above).
            window.exeXapi = { odeId: 'PKG1', parentOrigin: 'https://h' };
            xapi.init();
            xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 });
            expect(lastStatement(spy).actor.mbox).toBe('mailto:l@x.y');
        } finally {
            if (originalLocation) Object.defineProperty(window, 'location', originalLocation);
        }
    });

    it('skips the package statement when the aggregator throws', () => {
        window.exeXapi = { odeId: 'PKG1' };
        window.$exeDevices.iDevice.gamification.scorm.getFinalScore = () => {
            throw new Error('boom');
        };
        const spy = installFakeParent();
        xapi.init();
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 });
        // The per-iDevice statement is still sent; the package one is skipped.
        expect(statementsByVerb(spy, 'http://adlnet.gov/expapi/verbs/answered')).toHaveLength(1);
        expect(statementsByVerb(spy, 'http://adlnet.gov/expapi/verbs/completed')).toHaveLength(0);
    });

    it('init() degrades safely when reading config throws', () => {
        Object.defineProperty(window, 'exeXapi', {
            get() {
                throw new Error('blocked');
            },
            configurable: true,
        });
        try {
            expect(() => xapi.init()).not.toThrow();
            expect(xapi.config).toBeTruthy();
            expect(xapi._initialised).toBe(true);
        } finally {
            delete window.exeXapi;
        }
    });

    it('package Activity object includes a localized definition', () => {
        window.exeXapi = { odeId: 'PKG1', packageTitle: 'My Course', language: 'es' };
        const spy = installFakeParent();
        xapi.init();
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 });
        const completed = statementsByVerb(spy, 'http://adlnet.gov/expapi/verbs/completed')[0];
        expect(completed.object.definition.type).toBe('http://adlnet.gov/expapi/activities/assessment');
        expect(completed.object.definition.name).toEqual({ es: 'My Course' });
    });

    it('iDevice Activity object includes a localized definition', () => {
        window.exeXapi = { odeId: 'PKG1', language: 'fr' };
        const spy = installFakeParent();
        xapi.init();
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceType: 'quiz', ideviceNumber: 1, title: 'Question', score: 8, weighted: 1 });
        const answered = statementsByVerb(spy, 'http://adlnet.gov/expapi/verbs/answered')[0];
        expect(answered.object.definition.type).toBe('http://adlnet.gov/expapi/activities/cmi.interaction');
        expect(answered.object.definition.name).toEqual({ fr: 'Question' });
    });

    it('adds eXeLearning context.extensions (package + iDevice metadata)', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceType: 'quiz', ideviceNumber: 1, score: 8, weighted: 1 });
        const answered = statementsByVerb(spy, 'http://adlnet.gov/expapi/verbs/answered')[0];
        const ext = answered.context.extensions;
        expect(ext['https://exelearning.net/xapi/extensions/package-id']).toBe('PKG1');
        expect(ext['https://exelearning.net/xapi/extensions/idevice-id']).toBe('d1');
        expect(ext['https://exelearning.net/xapi/extensions/idevice-type']).toBe('quiz');
        // Page extensions are absent when the event does not supply them.
        expect(ext['https://exelearning.net/xapi/extensions/page-id']).toBeUndefined();
        expect(ext['https://exelearning.net/xapi/extensions/page-title']).toBeUndefined();
    });

    it('includes page extensions only when the event supplies them', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1, pageId: 'page-7', pageTitle: 'Intro' });
        const answered = statementsByVerb(spy, 'http://adlnet.gov/expapi/verbs/answered')[0];
        const ext = answered.context.extensions;
        expect(ext['https://exelearning.net/xapi/extensions/page-id']).toBe('page-7');
        expect(ext['https://exelearning.net/xapi/extensions/page-title']).toBe('Intro');
    });

    it('includes context.registration when provided via config', () => {
        window.exeXapi = { odeId: 'PKG1', registration: 'reg-cfg' };
        const spy = installFakeParent();
        xapi.init();
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 1 });
        const answered = statementsByVerb(spy, 'http://adlnet.gov/expapi/verbs/answered')[0];
        expect(answered.context.registration).toBe('reg-cfg');
    });

    it('emits "initialized" exactly once when a transport is available', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();
        // A second init() must not re-emit (idempotent + lifecycle guard).
        xapi._initialised = false;
        xapi.init();
        const initialized = statementsByVerb(spy, 'http://adlnet.gov/expapi/verbs/initialized');
        expect(initialized).toHaveLength(1);
        // Lifecycle statements carry no result/score.
        expect(initialized[0].result).toBeUndefined();
        expect(initialized[0].object.id).toBe('https://exelearning.net/xapi/PKG1');
    });

    it('emits "terminated" exactly once on pagehide', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();
        window.dispatchEvent(new Event('pagehide'));
        window.dispatchEvent(new Event('pagehide'));
        window.dispatchEvent(new Event('unload'));
        const terminated = statementsByVerb(spy, 'http://adlnet.gov/expapi/verbs/terminated');
        expect(terminated).toHaveLength(1);
        expect(terminated[0].result).toBeUndefined();
    });

    it('init() is idempotent', () => {
        window.exeXapi = { odeId: 'PKG1' };
        xapi.init();
        const cfg = xapi.config;
        window.exeXapi = { odeId: 'CHANGED' };
        xapi.init(); // should not re-read
        expect(xapi.config).toBe(cfg);
        expect(xapi.config.odeId).toBe('PKG1');
    });
});
