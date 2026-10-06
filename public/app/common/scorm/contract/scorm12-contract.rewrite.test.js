/**
 * Independent SCORM 1.2 contract suite — REWRITE runtime variant (#2210).
 *
 * Runs the shared scenarios against the in-tree SCORM 1.2 runtime
 * (public/app/common/scorm/scorm12/, PR #2209) — the layers the exporter
 * assembles into libs/SCOFunctions.js — loaded in their package order:
 *   vendor/pipwerks/SCORM_API_wrapper.js
 *   exe-scorm12-client.js
 *   exe-scorm12-activities.js
 *   exe-scorm12-policy.js
 *   exe-scorm12-lifecycle.js
 *   exe-scorm12-adapter.js
 * with scorm-again as the LMS-side window.API.
 *
 * The driver reproduces the PR #2209 production wiring: the exporter emits
 * <body onload="loadPage()"> and NO unload-family attributes; exe_export.js
 * hands the page's scored-activities flag to the runtime
 * (exeScorm12.setPageHasScoredActivities) and the lifecycle layer ends the
 * session itself on pagehide (persisted=false).
 *
 * This file must not be merged with the legacy variant: each variant owns
 * the `pipwerks` global of its own wrapper (Vitest isolates per test file).
 */
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { createContractLms, createLmsWindowTree } from './scorm-again-lms.test-util.js';
import { runContractSuite } from './scorm12-contract-scenarios.test-util.js';

const pipwerks = require('../scorm12/vendor/pipwerks/SCORM_API_wrapper.js');
window.pipwerks = pipwerks;
const client = require('../scorm12/exe-scorm12-client.js');
const activities = require('../scorm12/exe-scorm12-activities.js');
const policy = require('../scorm12/exe-scorm12-policy.js');
const lifecycle = require('../scorm12/exe-scorm12-lifecycle.js');
require('../scorm12/exe-scorm12-adapter.js');
// The adapter defined the legacy globals on the page window; capture it
// before tests stub the `window` global with the fake LMS tree.
const pageWindow = window;

/** Minimal event target so scenarios can fire pagehide/pageshow/visibilitychange. */
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

/** Reset the vendored (upstream) pipwerks wrapper's module state. */
function resetVendoredPipwerks() {
    const scorm = pipwerks.SCORM;
    scorm.version = null; // the vendored wrapper's shipped default
    scorm.handleCompletionStatus = true;
    scorm.handleExitMode = true;
    scorm.API.handle = null;
    scorm.API.isFound = false;
    scorm.connection.isActive = false;
    scorm.data.completionStatus = null;
    scorm.data.exitStatus = null;
    pipwerks.debug.isActive = false;
}

describe('SCORM 1.2 contract (scorm-again LMS) — rewrite runtime (PR #2209)', () => {
    let clockMs;
    let fakeWindow;
    let fakeDocument;

    beforeEach(() => {
        clockMs = 1_700_000_000_000;
        resetVendoredPipwerks();
        client.resetDependencies();
        client.configure({ getPipwerks: () => pipwerks, now: () => clockMs, error: vi.fn(), warn: vi.fn() });
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
        vi.unstubAllGlobals();
        lifecycle.resetDependencies();
        policy.resetDependencies();
        activities.resetDependencies();
        client.resetDependencies();
    });

    function createContext(lmsOptions) {
        const lms = createContractLms(lmsOptions);
        const { scoWindow } = createLmsWindowTree(lms.windowApi, lmsOptions ? lmsOptions.lmsWindowExtras : undefined);
        // The wrapper resolves `window` at call time during API discovery;
        // give it the SCO frame whose parent is the LMS window.
        vi.stubGlobal('window', scoWindow);

        const driver = {
            variant: 'rewrite',
            loadPage: () => pageWindow.loadPage(),
            unloadPageOnly: isSCORM => pageWindow.unloadPage(isSCORM),
            doQuit: () => pageWindow.doQuit(),
            doBack: () => pageWindow.doBack(),
            doContinue: status => pageWindow.doContinue(status),
            startTimer: () => pageWindow.startTimer(),
            computeTime: () => pageWindow.computeTime(),
            /** window.scorm facade installed by the adapter. */
            facade: pageWindow.scorm,
            /** eXe extension methods on pipwerks.SCORM (compat surface). */
            ext: pipwerks.SCORM,
            /** Adapter-installed page globals. */
            global: name => pageWindow[name],
            advanceClock: ms => {
                clockMs += ms;
            },
            /**
             * Deterministic LMS-navigation exit with PR #2209 wiring:
             * exe_export hands over the scored-activities flag (production
             * sets it at init; timing is behavior-equivalent because the
             * policy reads it at exit) and the lifecycle layer ends the
             * session on pagehide (persisted=false). No unload attributes.
             * The visibilitychange persistence path is exercised separately
             * (E03) rather than folded into every exit.
             */
            endSessionViaPageExit: ({ scored }) => {
                pageWindow.exeScorm12.setPageHasScoredActivities(scored);
                fakeWindow.fire('pagehide', { persisted: false });
            },
            /** Score reporting through the adapter's setScore global. */
            reportScore: (raw, max, min) => pageWindow.setScore(raw, max, min),
            /**
             * Tab visibility transitions (the rewrite's persistence surface;
             * PR #2209 replaces unload handlers with visibilitychange/pagehide).
             */
            hideTab: () => {
                fakeDocument.visibilityState = 'hidden';
                fakeDocument.fire('visibilitychange');
            },
            showTab: () => {
                fakeDocument.visibilityState = 'visible';
                fakeDocument.fire('visibilitychange');
            },
            /**
             * A scored activity completing with a score, as the PR #2209
             * games layer does it (common.js reportActivity +
             * policy.setScoreDetailed + policy.recordActivityOutcome).
             */
            completeScoredActivity: ({ id, score }) => {
                const registry = pageWindow.scorm.activities;
                const base = {
                    evaluable: true,
                    completionRequired: true,
                    weight: 1,
                    minimumScore: 0,
                    maximumScore: 100,
                };
                registry.register(id, base);
                pageWindow.exeScorm12.policy.reconcilePendingActivities();
                registry.register(id, Object.assign({}, base, { completed: true, answered: 1, total: 1, score }));
                pageWindow.exeScorm12.policy.setScoreDetailed(score, 0, 100);
                pageWindow.exeScorm12.policy.recordActivityOutcome();
            },
            /**
             * A required activity the learner opened but never answered, as the
             * PR #2209 games layer reports it: the activity registers, the
             * status policy runs, and NO score is written. common.js
             * showFinalScore skips setScoreDetailed while the registry summary
             * reports nothing answered, because cmi.core.score.raw cannot
             * express "no answer" — and an LMS may read a stored score as proof
             * the page was done (Moodle promotes `incomplete` to `completed` as
             * soon as any score.raw exists).
             */
            registerUnansweredActivity: ({ id }) => {
                pageWindow.scorm.activities.register(id, {
                    evaluable: true,
                    completionRequired: true,
                    weight: 1,
                    minimumScore: 0,
                    maximumScore: 100,
                    total: 1,
                    answered: 0,
                });
                pageWindow.exeScorm12.policy.reconcilePendingActivities();
                pageWindow.exeScorm12.policy.recordActivityOutcome();
            },
        };
        return { driver, lms };
    }

    runContractSuite({ variant: 'rewrite', describe, it, createContext });
});
