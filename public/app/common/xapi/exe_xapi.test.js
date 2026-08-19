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
const IDEVICE_ORDER_EXTENSION = 'https://exelearning.net/xapi/extensions/idevice-order';
const IDEVICE_WEIGHT_EXTENSION = 'https://exelearning.net/xapi/extensions/idevice-weight';
const IDEVICE_CENSUS_EXTENSION = 'https://exelearning.net/xapi/extensions/idevice-census';
const PAGE_COUNT_EXTENSION = 'https://exelearning.net/xapi/extensions/page-count';
const PAGE_ID_EXTENSION = 'https://exelearning.net/xapi/extensions/page-id';
const PAGE_TITLE_EXTENSION = 'https://exelearning.net/xapi/extensions/page-title';
const INITIALIZED_VERB = 'http://adlnet.gov/expapi/verbs/initialized';

/** The one shipped implementation of the weighted package total. */
const getFinalScore = global.$exeDevices.iDevice.gamification.scorm.getFinalScore;

/**
 * Consumer-side reconstruction: feed ordered per-iDevice records back through
 * the shipped aggregator. Keys are non-numeric so `Object.keys()` preserves the
 * insertion order, which is the package order the largest-remainder tie-break
 * depends on.
 *
 * @param {{score:number, weight:number}[]} items ordered by package position
 * @returns {number} package total on the 0..100 scale
 */
function calculateWeightedScore(items) {
    const lmsData = {};
    items.forEach((item, index) => {
        lmsData['idevice-' + index] = { score: item.score, weighted: item.weight };
    });
    return getFinalScore(lmsData);
}

/**
 * Rebuild the current package state from the statement stream. A later answer
 * replaces the earlier contribution with the same stable iDevice id.
 */
function reconstructLatestWeightedScore(statements) {
    const latestByIdevice = new Map();

    statements
        .filter(statement => statement.verb.id === ANSWERED_VERB)
        .forEach(statement => {
            const extensions = statement.context?.extensions || {};
            latestByIdevice.set(extensions[IDEVICE_ID_EXTENSION], {
                score: statement.result.score.raw * 10,
                weight: extensions[IDEVICE_WEIGHT_EXTENSION],
                order: extensions[IDEVICE_ORDER_EXTENSION],
            });
        });

    return calculateWeightedScore(
        [...latestByIdevice.values()].sort((a, b) => a.order - b.order),
    );
}

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

/**
 * The "initialized" statement is deferred to DOM-ready + a macrotask so the
 * iDevice census has time to populate. Await this to let that flush run.
 */
async function flushDeferredInitialized() {
    await new Promise(resolve => setTimeout(resolve, 0));
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
        expect(s.context.extensions[IDEVICE_ORDER_EXTENSION]).toBe(1);
        expect(s.context.extensions[IDEVICE_WEIGHT_EXTENSION]).toBe(25);
        expect(typeof s.context.extensions[IDEVICE_WEIGHT_EXTENSION]).toBe('number');
        expect(s.context.contextActivities.parent[0].id).toBe('https://exelearning.net/xapi/PKG1');
        expect(s.id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('reconstructs the latest unequal-weight state by stable iDevice id', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'device-a', ideviceNumber: 1, score: 4, weighted: 25 });
        xapi.emit({ type: 'answered', ideviceId: 'device-b', ideviceNumber: 2, score: 4, weighted: 75 });
        xapi.emit({ type: 'answered', ideviceId: 'device-a', ideviceNumber: 1, score: 10, weighted: 25 });

        const answered = statementsByVerb(spy, ANSWERED_VERB);
        expect(answered).toHaveLength(3);
        expect(answered.map(statement => statement.context.extensions[IDEVICE_ID_EXTENSION])).toEqual([
            'device-a',
            'device-b',
            'device-a',
        ]);
        expect(answered.map(statement => statement.context.extensions[IDEVICE_WEIGHT_EXTENSION])).toEqual([25, 75, 25]);
        expect(answered.map(statement => statement.context.extensions[IDEVICE_ORDER_EXTENSION])).toEqual([1, 2, 1]);
        expect(answered[0].object.id).toBe(answered[2].object.id);
        expect(answered[0].object.id).not.toBe(answered[1].object.id);

        // Latest state is A=100 @ 25% and B=40 @ 75%: 25 + 30 = 55.
        expect(reconstructLatestWeightedScore(answered)).toBe(55);
    });

    it('uses package-global iDevice order to reproduce largest-remainder ties', () => {
        window.exeXapi = { odeId: 'PKG1', ideviceOrderOffset: 0 };
        const spy = installFakeParent();
        xapi.init();

        // Arrival order differs from package order. Three equal weights apportion
        // to 34/33/33, so package-order device A must receive the extra point.
        xapi.emit({ type: 'answered', ideviceId: 'device-b', ideviceNumber: 2, score: 0, weighted: 1 });
        xapi.emit({ type: 'answered', ideviceId: 'device-a', ideviceNumber: 1, score: 10, weighted: 1 });
        xapi.emit({ type: 'answered', ideviceId: 'device-c', ideviceNumber: 3, score: 0, weighted: 1 });

        const answered = statementsByVerb(spy, ANSWERED_VERB);
        expect(answered.map(statement => statement.context.extensions[IDEVICE_ORDER_EXTENSION])).toEqual([2, 1, 3]);
        expect(reconstructLatestWeightedScore(answered)).toBe(34);
        const completed = statementsByVerb(spy, COMPLETED_VERB);
        expect(completed[completed.length - 1].result.score.raw).toBe(34);
    });

    it('adds the exported page offset to the page-local iDevice number', () => {
        window.exeXapi = { odeId: 'PKG1', ideviceOrderOffset: 3 };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'device-d', ideviceNumber: 1, score: 8, weighted: 25 });

        const answered = statementsByVerb(spy, ANSWERED_VERB);
        expect(answered[0].context.extensions[IDEVICE_ORDER_EXTENSION]).toBe(4);
    });

    it.each([
        ['zero', 0],
        ['missing', undefined],
    ])('emits the current effective weight of 1 for %s weight', (_label, weighted) => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'device-a', ideviceNumber: 1, score: 8, weighted });

        const answered = statementsByVerb(spy, ANSWERED_VERB);
        expect(answered).toHaveLength(1);
        expect(answered[0].context.extensions[IDEVICE_WEIGHT_EXTENSION]).toBe(1);
    });

    it.each([
        ['above the maximum', 250, 100],
        ['negative', -5, 1],
        ['non-numeric', 'heavy', 1],
    ])('clamps a %s weight into the 1..100 range the aggregator expects', (_label, weighted, expected) => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'device-a', ideviceNumber: 1, score: 8, weighted });

        const answered = statementsByVerb(spy, ANSWERED_VERB);
        expect(answered[0].context.extensions[IDEVICE_WEIGHT_EXTENSION]).toBe(expected);
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
        expect(answered[0].context.extensions[IDEVICE_ORDER_EXTENSION]).toBeUndefined();
        // ...but an iDevice the consumer cannot place must not silently shift the
        // order-sensitive package total either. Both guards agree (#2302).
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
        window.exeXapi = { odeId: 'PKG1', pageCount: 2, ideviceOrderOffset: 1 };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'd2', ideviceNumber: 1, score: 4, weighted: 75 });

        const answered = statementsByVerb(spy, ANSWERED_VERB);
        expect(answered).toHaveLength(1);
        expect(answered[0].context.extensions[IDEVICE_ORDER_EXTENSION]).toBe(2);
        expect(answered[0].context.extensions[IDEVICE_WEIGHT_EXTENSION]).toBe(75);
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

    it('reconstructs the multipage package total from the per-iDevice stream', () => {
        // Page 1 (offset 0) and page 2 (offset 1) both emit page-locally; only the
        // order extension lets a consumer put them back in package order.
        const spy = installFakeParent();
        window.exeXapi = { odeId: 'PKG1', pageCount: 2, ideviceOrderOffset: 0 };
        xapi.init();
        xapi.emit({ type: 'answered', ideviceId: 'device-a', ideviceNumber: 1, score: 10, weighted: 25 });

        // Second page: a fresh page load resets the emitter's page-local state.
        xapi._initialised = false;
        xapi.config = null;
        xapi._state = {};
        xapi._lastSig = {};
        window.exeXapi = { odeId: 'PKG1', pageCount: 2, ideviceOrderOffset: 1 };
        xapi.init();
        xapi.emit({ type: 'answered', ideviceId: 'device-b', ideviceNumber: 1, score: 4, weighted: 75 });

        const answered = statementsByVerb(spy, ANSWERED_VERB);
        expect(answered.map(s => s.context.extensions[IDEVICE_ORDER_EXTENSION])).toEqual([1, 2]);
        // A=100 @ 25 and B=40 @ 75 -> 25 + 30 = 55, and neither page could say so.
        expect(reconstructLatestWeightedScore(answered)).toBe(55);
        expect(statementsByVerb(spy, PASSED_VERB)).toHaveLength(0);
        expect(statementsByVerb(spy, FAILED_VERB)).toHaveLength(0);
    });

    describe('evaluable census (#2302)', () => {
        it('publishes every evaluable iDevice on the page, answered or not', async () => {
            window.exeXapi = { odeId: 'PKG1', pageCount: 2, ideviceOrderOffset: 3, pageId: 'p2', pageTitle: 'Page two' };
            const spy = installFakeParent();
            xapi.init();

            // Registration order deliberately differs from package order.
            xapi.registerEvaluable({ ideviceId: 'dev-b', ideviceNumber: 2, title: 'B', weighted: 75 });
            xapi.registerEvaluable({ ideviceId: 'dev-a', ideviceNumber: 1, title: 'A', weighted: 25 });
            await flushDeferredInitialized();

            const initialized = statementsByVerb(spy, INITIALIZED_VERB);
            expect(initialized).toHaveLength(1);
            const extensions = initialized[0].context.extensions;
            // Sorted by package-global order, with the export offset applied.
            // Short keys inside the value; the extension key itself stays a full IRI.
            expect(extensions[IDEVICE_CENSUS_EXTENSION]).toEqual([
                { 'idevice-id': 'dev-a', 'idevice-weight': 25, 'idevice-order': 4 },
                { 'idevice-id': 'dev-b', 'idevice-weight': 75, 'idevice-order': 5 },
            ]);
            expect(Object.keys(extensions)).toContain(IDEVICE_CENSUS_EXTENSION);
            expect(extensions[PAGE_COUNT_EXTENSION]).toBe(2);
            expect(extensions[PAGE_ID_EXTENSION]).toBe('p2');
            expect(extensions[PAGE_TITLE_EXTENSION]).toBe('Page two');
            // Lifecycle statements still carry no result.
            expect(initialized[0].result).toBeUndefined();
        });

        it('publishes an empty census for a page with no evaluable iDevices', async () => {
            window.exeXapi = { odeId: 'PKG1', pageCount: 3, pageId: 'p1' };
            const spy = installFakeParent();
            xapi.init();
            await flushDeferredInitialized();

            const initialized = statementsByVerb(spy, INITIALIZED_VERB);
            expect(initialized).toHaveLength(1);
            // An empty census still tells a consumer it has seen this page.
            expect(initialized[0].context.extensions[IDEVICE_CENSUS_EXTENSION]).toEqual([]);
            expect(initialized[0].context.extensions[PAGE_COUNT_EXTENSION]).toBe(3);
        });

        it('excludes an iDevice whose package-global order cannot be resolved', async () => {
            window.exeXapi = { odeId: 'PKG1' };
            const spy = installFakeParent();
            xapi.init();

            xapi.registerEvaluable({ ideviceId: 'dev-a', ideviceNumber: 1, weighted: 25 });
            xapi.registerEvaluable({ ideviceId: 'dev-lost', ideviceNumber: 0, weighted: 75 });
            xapi.registerEvaluable({ ideviceId: 'dev-none', weighted: 75 });
            await flushDeferredInitialized();

            // Better absent than present with a false order, and consistent with
            // the same iDevice being kept out of the aggregate.
            const census = statementsByVerb(spy, INITIALIZED_VERB)[0].context.extensions[IDEVICE_CENSUS_EXTENSION];
            expect(census.map(entry => entry['idevice-id'])).toEqual(['dev-a']);
            expect(Object.keys(xapi._state)).toEqual(['1']);
        });

        it('ignores a registration with no stable iDevice id, and never registers twice', async () => {
            window.exeXapi = { odeId: 'PKG1' };
            const spy = installFakeParent();
            xapi.init();

            xapi.registerEvaluable({ ideviceNumber: 1, weighted: 25 });
            xapi.registerEvaluable(null);
            xapi.registerEvaluable({ ideviceId: 'dev-a', ideviceNumber: 1, weighted: 25 });
            xapi.registerEvaluable({ ideviceId: 'dev-a', ideviceNumber: 1, weighted: 99 });
            await flushDeferredInitialized();

            const census = statementsByVerb(spy, INITIALIZED_VERB)[0].context.extensions[IDEVICE_CENSUS_EXTENSION];
            expect(census).toHaveLength(1);
            expect(census[0]['idevice-weight']).toBe(25);
        });

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
            ['a normal weight', 25, 25],
            ['a weight above the maximum', 250, 100],
            ['a missing weight', undefined, 1],
            ['a non-numeric weight', 'heavy', 1],
        ])('reports the same effective weight in the census and in the answer for %s', async (_label, weighted, expected) => {
            // If these two ever diverged, a consumer would score answered iDevices
            // with one weight and unanswered ones with another, and the same package
            // would grade differently depending on arrival order. Same input, same
            // effectiveWeight(), same number.
            window.exeXapi = { odeId: 'PKG1', pageCount: 1 };
            const spy = installFakeParent();
            xapi.init();

            xapi.registerEvaluable({ ideviceId: 'dev-a', ideviceNumber: 1, weighted });
            await flushDeferredInitialized();
            xapi.emit({ type: 'answered', ideviceId: 'dev-a', ideviceNumber: 1, score: 8, weighted });

            const census = statementsByVerb(spy, INITIALIZED_VERB)[0].context.extensions[IDEVICE_CENSUS_EXTENSION];
            const answered = statementsByVerb(spy, ANSWERED_VERB)[0];
            expect(census[0]['idevice-weight']).toBe(expected);
            expect(answered.context.extensions[IDEVICE_WEIGHT_EXTENSION]).toBe(expected);
            expect(census[0]['idevice-order']).toBe(answered.context.extensions[IDEVICE_ORDER_EXTENSION]);
        });

        it('republishes the census on "terminated" so a late registration is not lost', async () => {
            // "initialized" is flushed on a macrotask after DOM-ready, so an iDevice
            // that registers later than that misses it. Page unload happens after every
            // registration, so this copy is the complete one.
            window.exeXapi = { odeId: 'PKG1', pageCount: 2 };
            const spy = installFakeParent();
            xapi.init();
            xapi.registerEvaluable({ ideviceId: 'dev-early', ideviceNumber: 1, weighted: 25 });
            await flushDeferredInitialized();

            xapi.registerEvaluable({ ideviceId: 'dev-late', ideviceNumber: 2, weighted: 75 });
            xapi._emitTerminated();

            const initialized = statementsByVerb(spy, INITIALIZED_VERB)[0];
            const terminated = statementsByVerb(spy, 'http://adlnet.gov/expapi/verbs/terminated')[0];
            expect(initialized.context.extensions[IDEVICE_CENSUS_EXTENSION]).toEqual([
                { 'idevice-id': 'dev-early', 'idevice-weight': 25, 'idevice-order': 1 },
            ]);
            expect(terminated.context.extensions[IDEVICE_CENSUS_EXTENSION]).toEqual([
                { 'idevice-id': 'dev-early', 'idevice-weight': 25, 'idevice-order': 1 },
                { 'idevice-id': 'dev-late', 'idevice-weight': 75, 'idevice-order': 2 },
            ]);
            // Still a lifecycle statement: no result, no verdict.
            expect(terminated.result).toBeUndefined();
        });

        it('flushes the deferred "initialized" before the first "answered"', () => {
            window.exeXapi = { odeId: 'PKG1' };
            const spy = installFakeParent();
            xapi.init();
            xapi.registerEvaluable({ ideviceId: 'dev-a', ideviceNumber: 1, weighted: 25 });

            // No macrotask has run yet, so the deferred flush has not fired.
            expect(statementsByVerb(spy, INITIALIZED_VERB)).toHaveLength(0);

            xapi.emit({ type: 'answered', ideviceId: 'dev-a', ideviceNumber: 1, score: 8, weighted: 25 });

            // A consumer must never see an answer before the census that scopes it.
            const verbs = spy.mock.calls.map(call => call[0].statement.verb.id);
            expect(verbs.indexOf(INITIALIZED_VERB)).toBeLessThan(verbs.indexOf(ANSWERED_VERB));
            expect(statementsByVerb(spy, INITIALIZED_VERB)).toHaveLength(1);
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
        expect(completed[0].context.extensions[IDEVICE_WEIGHT_EXTENSION]).toBeUndefined();
        expect(passed[0].context.extensions[IDEVICE_WEIGHT_EXTENSION]).toBeUndefined();
    });

    it('emits package "failed" when the aggregate is below 50', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, title: 'Q1', score: 2, weighted: 1 });

        const failed = statementsByVerb(spy, FAILED_VERB);
        expect(failed).toHaveLength(1);
        expect(statementsByVerb(spy, PASSED_VERB)).toHaveLength(0);
        expect(failed[0].context.extensions[IDEVICE_WEIGHT_EXTENSION]).toBeUndefined();
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

    it('emits the same score again when the effective weight changes', () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();

        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 25 });
        xapi.emit({ type: 'answered', ideviceId: 'd1', ideviceNumber: 1, score: 8, weighted: 75 });

        const answered = statementsByVerb(spy, ANSWERED_VERB);
        expect(answered).toHaveLength(2);
        expect(answered.map(statement => statement.context.extensions[IDEVICE_WEIGHT_EXTENSION])).toEqual([25, 75]);
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

    it('ignores events with a non-numeric score', async () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();
        // Let the deferred lifecycle statement out first, so this measures only
        // emit()'s own effect.
        await flushDeferredInitialized();
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

    it('emits "initialized" exactly once when a transport is available', async () => {
        window.exeXapi = { odeId: 'PKG1' };
        const spy = installFakeParent();
        xapi.init();
        // A second init() must not re-emit (idempotent + lifecycle guard).
        xapi._initialised = false;
        xapi.init();
        await flushDeferredInitialized();
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
