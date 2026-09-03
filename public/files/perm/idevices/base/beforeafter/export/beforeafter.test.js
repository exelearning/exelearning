/**
 * Unit tests for the beforeafter iDevice (export/runtime).
 *
 * Two concerns share this file:
 *
 * - Regression coverage for issue #2272: initComparison runs from a 200ms
 *   setTimeout scheduled after each image load, so by the time it fires the
 *   iDevice DOM or its options entry may already be gone (page navigation,
 *   editor closing the activity). It must bail out instead of crashing on a
 *   null container / missing options / missing card.
 * - The completion signal the LMS depends on: this activity is a "see every
 *   card" task, so the moment the learner reaches the last card it is finished,
 *   and it has to say so. The completion signal is separate from the score —
 *   the runtime decides `passed` from what the activity reports as finished,
 *   not from the number it reports.
 *
 * The export declares `var $eXeBeforeAfter`; it is rewired to a global and
 * the auto-init call is stripped so importing has no side effects. Real
 * jQuery + happy-dom (from vitest.setup.js) back the DOM.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The export reads the shared color palette while its object literal evaluates,
// so the palette has to exist before the file is evaluated, not after.
const PALETTE = {
    borderColors: { red: '#f00', green: '#0f0', blue: '#00f', yellow: '#ff0' },
    backColor: '#fff',
};

function loadExport() {
    const code = readFileSync(join(__dirname, 'beforeafter.js'), 'utf-8');
    let modified = code.replace(/var\s+\$eXeBeforeAfter\s*=/, 'global.$eXeBeforeAfter =');
    modified = modified.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeBeforeAfter\.init\(\);\s*\}\);?/g, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$eXeBeforeAfter;
}

describe('beforeafter iDevice export — initComparison guards (#2272)', () => {
    let bfaf;
    const instance = 0;

    beforeEach(() => {
        global.$eXeBeforeAfter = undefined;
        global.$exeDevices.iDevice.gamification.colors = PALETTE;
        bfaf = loadExport();
        bfaf.options = [];
        document.body.innerHTML = '';
    });

    afterEach(() => {
        delete global.$eXeBeforeAfter;
        delete global.$exeDevices.iDevice.gamification.colors;
    });

    function addContainer() {
        document.body.innerHTML = `
            <div id="bfafpContainerBA-${instance}">
                <div class="BFAFP-Overlay"></div>
                <div class="BFAFP-Slider"></div>
            </div>
        `;
    }

    it('returns early without throwing when the container is no longer in the DOM', () => {
        bfaf.options[instance] = { cardsGame: [{ vertical: false, position: 50 }], active: 0 };
        // DOM is empty: the delayed setTimeout fired after the activity was removed.
        expect(() => bfaf.initComparison(0, instance)).not.toThrow();
    });

    it('returns early without throwing when options[instance] is gone', () => {
        addContainer();
        expect(() => bfaf.initComparison(0, instance)).not.toThrow();
    });

    it('returns early without throwing when the card no longer exists', () => {
        addContainer();
        bfaf.options[instance] = { cardsGame: [], active: 0 };
        expect(() => bfaf.initComparison(0, instance)).not.toThrow();
        // No handlers were wired on the still-present slider.
        const slider = document.querySelector('.BFAFP-Slider');
        expect(slider._initComparisonHandlers).toBeUndefined();
    });

    it('wires the comparison slider when DOM and data are present (positive path)', () => {
        addContainer();
        bfaf.options[instance] = { cardsGame: [{ vertical: false, position: 50 }], active: 0 };
        expect(() => bfaf.initComparison(0, instance)).not.toThrow();
        const slider = document.querySelector('.BFAFP-Slider');
        const container = document.getElementById(`bfafpContainerBA-${instance}`);
        expect(slider._initComparisonHandlers).toBeDefined();
        expect(typeof slider._initComparisonHandlers.startSlide).toBe('function');
        expect(typeof container._initComparisonHandlers.containerClick).toBe('function');
    });
});

describe('beforeafter iDevice export — completion signal', () => {
    let bfaf;
    let calls;
    let previousScorm;

    beforeEach(() => {
        global.$eXeBeforeAfter = undefined;
        calls = [];
        global.$exeDevices.iDevice.gamification.colors = PALETTE;
        // Record what the activity reports to the runtime instead of the shared mock.
        previousScorm = global.$exeDevices.iDevice.gamification.scorm;
        global.$exeDevices.iDevice.gamification.scorm = {
            sendScoreNew: (auto, game) => calls.push({ auto, game }),
        };
        bfaf = loadExport();
    });

    afterEach(() => {
        global.$exeDevices.iDevice.gamification.scorm = previousScorm;
        delete global.$exeDevices.iDevice.gamification.colors;
        delete global.$eXeBeforeAfter;
    });

    /**
     * Minimal instance state: `sendScore` only reads the card count, how many have been
     * seen, and the two fields it copies across for the report.
     *
     * @param {number} visiteds index of the card the learner has reached
     * @param {number} cards how many cards the activity has
     * @returns {number} the instance index to pass to sendScore
     */
    function givenInstance(visiteds, cards) {
        bfaf.options = [{ visiteds, cardsGame: new Array(cards).fill({}), msgs: {} }];
        return 0;
    }

    describe('sendScore', () => {
        it('reports progress as a fraction of the cards seen', () => {
            bfaf.sendScore(true, givenInstance(1, 4));

            expect(calls).toHaveLength(1);
            expect(calls[0].game.scorerp).toBe(5);
        });

        it('does not mark the activity finished while cards remain', () => {
            bfaf.sendScore(true, givenInstance(1, 4));

            expect(calls[0].game.gameOver).toBeUndefined();
        });

        it('marks the activity finished on the last card, so the page can be passed', () => {
            // 4 of 4 seen: score 10 of 10, and the activity is over. Without the flag the
            // page stays `incomplete` in the LMS at 100%.
            bfaf.sendScore(true, givenInstance(3, 4));

            expect(calls[0].game.scorerp).toBe(10);
            expect(calls[0].game.gameOver).toBe(true);
        });

        it('handles a single-card activity, which is finished on its first report', () => {
            bfaf.sendScore(true, givenInstance(0, 1));

            expect(calls[0].game.scorerp).toBe(10);
            expect(calls[0].game.gameOver).toBe(true);
        });
    });
});

/**
 * Behind an access code the activity never started: the cover is a sibling of
 * the game container, so the click that submits the code does not reach the
 * handler that starts it, and showImage only reports once the game is running.
 * The LMS therefore kept the previous attempt's grade until the learner clicked
 * the board. A valid code is that same opening gesture and has to start it.
 */
describe('beforeafter iDevice export — access code', () => {
    let bfaf;
    let calls;
    let previousScorm;
    let previousReport;

    beforeEach(() => {
        global.$eXeBeforeAfter = undefined;
        calls = [];
        global.$exeDevices.iDevice.gamification.colors = PALETTE;
        previousScorm = global.$exeDevices.iDevice.gamification.scorm;
        previousReport = global.$exeDevices.iDevice.gamification.report;
        global.$exeDevices.iDevice.gamification.scorm = {
            sendScoreNew: (auto, game) =>
                calls.push({
                    auto,
                    scorerp: game.scorerp,
                    gameOver: game.gameOver,
                    gameStarted: game.gameStarted,
                }),
        };
        global.$exeDevices.iDevice.gamification.report = {
            saveEvaluation: vi.fn(),
            updateEvaluationIcon: vi.fn(),
        };
        bfaf = loadExport();
    });

    afterEach(() => {
        global.$exeDevices.iDevice.gamification.scorm = previousScorm;
        global.$exeDevices.iDevice.gamification.report = previousReport;
        delete global.$exeDevices.iDevice.gamification.colors;
        delete global.$eXeBeforeAfter;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    /**
     * A covered activity with `cards` images, waiting on the code "abre".
     * showImage and activeButton are stubbed: they only paint, and the whole
     * point here is what reaches the LMS and in which order.
     *
     * @param {string} typed what the learner puts in the code field
     * @param {number} cards how many cards the activity has
     */
    function givenCoveredActivity(typed, cards = 4) {
        bfaf.options = [
            {
                gameStarted: false,
                visiteds: 0,
                isScorm: 1,
                cardsGame: new Array(cards).fill({}),
                itinerary: { codeAccess: 'abre', showClue: false },
                msgs: {},
            },
        ];
        document.body.innerHTML = `
            <div id="bfafCodeAccessDiv-0"></div>
            <div id="bfafCubierta-0"></div>
            <div id="bfafMesajeAccesCodeE-0"></div>
            <a id="bfafLinkMaximize-0" href="#"></a>
            <a id="bfafStartGame-0" href="#"></a>
            <div id="bfafMultimedia-0"></div>
            <input id="bfafCodeAccessE-0" value="${typed}" />`;
        vi.spyOn(bfaf, 'activeButton').mockImplementation(() => {});
    }

    it('reports the opening progress as unfinished when a valid code opens it', () => {
        givenCoveredActivity('AbrE');
        vi.spyOn(bfaf, 'showImage').mockImplementation(() => {});

        bfaf.enterCodeAccess(0);

        // One card of four seen, and nothing finished yet: exactly what the
        // click on the board publishes when there is no code.
        expect(calls).toEqual([
            { auto: true, scorerp: 2.5, gameOver: false, gameStarted: true },
        ]);
    });

    it('starts after painting the first card, so the score is not sent twice', () => {
        givenCoveredActivity('abre');
        let startedWhenPainted;
        vi.spyOn(bfaf, 'showImage').mockImplementation(() => {
            startedWhenPainted = bfaf.options[0].gameStarted;
        });

        bfaf.enterCodeAccess(0);

        // showImage reports on its own once the game is running, so starting
        // before it would put the same score on the wire twice.
        expect(startedWhenPainted).toBe(false);
        expect(calls).toHaveLength(1);
    });

    it('neither starts nor reports when the code is wrong', () => {
        givenCoveredActivity('nope');
        vi.spyOn(bfaf, 'showImage').mockImplementation(() => {});

        bfaf.enterCodeAccess(0);

        expect(calls).toEqual([]);
        expect(bfaf.options[0].gameStarted).toBe(false);
        expect($('#bfafCodeAccessE-0').val()).toBe('');
    });
});
