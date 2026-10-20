/**
 * Independent SCORM 1.2 contract suite — LEGACY runtime variant (#2210).
 *
 * Runs the shared scenarios against the runtime currently shipped in SCORM
 * 1.2 exports from main:
 *   libs/SCORM_API_wrapper.js  (modified pipwerks wrapper)
 *   libs/SCOFunctions.js       (page lifecycle functions)
 * with scorm-again as the LMS-side window.API.
 *
 * The driver reproduces the PRODUCTION wiring of an exported page
 * (src/shared/export/renderers/PageRenderer.ts + public/app/common/exe_export.js):
 *   - load:   <body onload="loadPage()">
 *   - unload: <body onbeforeunload="unloadPage()" onunload="unloadPage()">
 *             plus exe_export's `window.addEventListener('unload',
 *             () => unloadPage(isSCORM))` — i.e. THREE unload calls, the
 *             first two without the isSCORM argument.
 * Scenarios that want the runtime's best case call `unloadPageOnly(isSCORM)`
 * directly instead.
 *
 * This file must not be merged with the rewrite variant: each variant owns
 * the `pipwerks` global of its own wrapper (Vitest isolates per test file).
 */
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { createContractLms, createLmsWindowTree } from './scorm-again-lms.test-util.js';
import { runContractSuite } from './scorm12-contract-scenarios.test-util.js';

// Load order mirrors the exported page: wrapper first (defines pipwerks),
// then SCOFunctions (captures pipwerks.SCORM at load).
const pipwerks = require('../SCORM_API_wrapper.js');
globalThis.pipwerks = pipwerks;
const sco = require('../SCOFunctions.js');

const T0 = 1_700_000_000_000;

/** Reset all module-level state the legacy wrapper keeps between sessions. */
function resetLegacyRuntime() {
    const scorm = pipwerks.SCORM;
    scorm.version = null; // production default: version is auto-detected at discovery
    scorm.handleCompletionStatus = true;
    scorm.handleExitMode = true;
    scorm.API.handle = null;
    scorm.API.isFound = false;
    scorm.connection.isActive = false;
    scorm.data.completionStatus = null;
    scorm.data.exitStatus = null;
    pipwerks.debug.isActive = false; // silence trace() in tests
    sco._setStartDate(0);
    sco._setExitPageStatus(false);
}

describe('SCORM 1.2 contract (scorm-again LMS) — legacy runtime', () => {
    beforeEach(() => {
        vi.useFakeTimers({ now: T0 });
        resetLegacyRuntime();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
        resetLegacyRuntime();
    });

    function createContext(lmsOptions) {
        const lms = createContractLms(lmsOptions);
        const { scoWindow } = createLmsWindowTree(lms.windowApi, lmsOptions ? lmsOptions.lmsWindowExtras : undefined);
        // The wrapper resolves `window` at call time during API discovery;
        // give it the SCO frame whose parent is the LMS window.
        vi.stubGlobal('window', scoWindow);

        const driver = {
            variant: 'legacy',
            loadPage: () => sco.loadPage(),
            unloadPageOnly: isSCORM => sco.unloadPage(isSCORM),
            doQuit: () => sco.doQuit(),
            doBack: () => sco.doBack(),
            doContinue: status => sco.doContinue(status),
            startTimer: () => sco.startTimer(),
            computeTime: () => sco.computeTime(),
            /** window.scorm equivalent on the exported page. */
            facade: pipwerks.SCORM,
            /** eXe extension methods live directly on pipwerks.SCORM. */
            ext: pipwerks.SCORM,
            /** Legacy global surface (production defines these as page globals). */
            global: name => sco[name],
            advanceClock: ms => {
                vi.setSystemTime(Date.now() + ms);
            },
            /**
             * Production end-of-page sequence on main (see file header):
             * beforeunload attr, unload attr, then exe_export's listener with
             * the page's isSCORM flag.
             */
            endSessionViaPageExit: ({ scored }) => {
                sco.unloadPage();
                sco.unloadPage();
                sco.unloadPage(scored);
            },
            /**
             * Score reporting as main's games layer does it
             * (public/app/common/common.js): bounds via the pipwerks
             * extensions at init (numeric, common.js:900-901), raw score via
             * the facade (numeric, common.js:1362) — values cross the LMS API
             * boundary exactly as production sends them.
             */
            reportScore: (raw, max, min) => {
                if (max !== undefined) pipwerks.SCORM.SetScoreMax(max);
                if (min !== undefined) pipwerks.SCORM.SetScoreMin(min);
                return pipwerks.SCORM.set('cmi.core.score.raw', raw);
            },
            /** No visibility-persistence surface exists in the legacy runtime. */
            hideTab: () => {},
            showTab: () => {},
            /**
             * A scored activity completing with a score, as main's games layer
             * does it (common.js showFinalScore): numeric raw write plus a
             * pass/fail decision at the HARDCODED threshold 50
             * (common.js:1362-1368) — cmi.student_data.mastery_score is never
             * consulted.
             */
            completeScoredActivity: ({ score }) => {
                pipwerks.SCORM.SetScoreMax(100);
                pipwerks.SCORM.SetScoreMin(0);
                pipwerks.SCORM.set('cmi.core.score.raw', score);
                pipwerks.SCORM.set('cmi.core.lesson_status', score >= 50 ? 'passed' : 'failed');
            },
            /**
             * A required activity the learner opened but never answered. main's
             * games layer has no notion of "not answered": registerActivity
             * seeds the slot at zero and showFinalScore takes the same write
             * path as a real score, so the page publishes 0 and — being under
             * the hardcoded threshold of 50 — reports "failed" before the
             * learner has touched anything (common.js:1362-1368).
             */
            registerUnansweredActivity: () => {
                pipwerks.SCORM.SetScoreMax(100);
                pipwerks.SCORM.SetScoreMin(0);
                pipwerks.SCORM.set('cmi.core.score.raw', 0);
                pipwerks.SCORM.set('cmi.core.lesson_status', 'failed');
            },
        };
        return { driver, lms };
    }

    runContractSuite({ variant: 'legacy', describe, it, createContext });
});
