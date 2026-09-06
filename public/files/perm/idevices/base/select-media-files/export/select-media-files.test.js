/**
 * Unit tests for the select-media-files iDevice (export/runtime).
 *
 * Regression coverage for the "first statement audio autoplays on load and the
 * speaker icon is missing" bug:
 *   - showPhrase must reveal the speaker icon whenever the statement has audio,
 *     for every question (including the first / num === 0).
 *   - showPhrase must only auto-play on navigation to a later question
 *     (num > 0); the first question stays silent until the icon is clicked.
 *   - startGame must never auto-play the statement audio (the game auto-starts
 *     on load when there is no timer / access code).
 *
 * The export declares `var $eXeSeleccionaMedias`; it is rewired to a global and
 * the auto-init call is stripped so importing has no side effects. Real jQuery
 * + happy-dom (from vitest.setup.js) back the DOM, and a media spy stands in
 * for the shared gamification audio helper.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExport() {
    const code = readFileSync(join(__dirname, 'select-media-files.js'), 'utf-8');
    let modified = code.replace(/var\s+\$eXeSeleccionaMedias\s*=/, 'global.$eXeSeleccionaMedias =');
    modified = modified.replace(
        /\$\(function\s*\(\)\s*\{\s*\$eXeSeleccionaMedias\.init\(\);\s*\}\);?/g,
        '',
    );
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$eXeSeleccionaMedias;
}

describe('select-media-files iDevice export', () => {
    let media;
    let dmedia;

    beforeEach(() => {
        global.$eXeSeleccionaMedias = undefined;
        media = { playSound: vi.fn(), stopSound: vi.fn() };
        global.$exeDevices = { iDevice: { gamification: { media } } };
        dmedia = loadExport();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        delete global.$exeDevices;
        delete global.$eXeSeleccionaMedias;
    });

    describe('showPhrase audio icon + autoplay gating', () => {
        const instance = 0;

        function setup(phrases) {
            dmedia.options[instance] = {
                active: 0,
                attempsNumber: 1,
                phrasesGame: phrases,
            };
            // Isolate showPhrase from the card/image/message rendering helpers.
            dmedia.addCards = () => {};
            dmedia.showImage = () => {};
            dmedia.showMessage = () => {};
            document.body.innerHTML = `
                <a href="#" id="slcmpAudioDef-${instance}" style="display:none"></a>
                <div id="slcmpQuestion-${instance}"></div>
            `;
        }

        it('shows the speaker icon and does NOT autoplay on the first question (num === 0)', () => {
            setup([{ definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] }]);
            dmedia.showPhrase(0, instance);
            const icon = document.getElementById(`slcmpAudioDef-${instance}`);
            expect(icon.style.display).toBe('block');
            expect(media.playSound).not.toHaveBeenCalled();
        });

        it('shows the speaker icon AND autoplays when navigating to a later question (num > 0)', () => {
            setup([
                { definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] },
                { definition: 'Q1', audioDefinition: 'audio1.mp3', cards: [] },
            ]);
            dmedia.showPhrase(1, instance);
            const icon = document.getElementById(`slcmpAudioDef-${instance}`);
            expect(icon.style.display).toBe('block');
            expect(media.playSound).toHaveBeenCalledWith('audio1.mp3');
        });

        it('keeps the icon hidden when the statement has no audio', () => {
            setup([{ definition: 'Q0', audioDefinition: '', cards: [] }]);
            dmedia.showPhrase(0, instance);
            const icon = document.getElementById(`slcmpAudioDef-${instance}`);
            expect(icon.style.display).toBe('none');
            expect(media.playSound).not.toHaveBeenCalled();
        });
    });

    describe('startGame never autoplays the statement audio', () => {
        const instance = 0;

        it('starts the game silently even when the first statement has audio', () => {
            dmedia.options[instance] = {
                phrasesGame: [{ definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] }],
                phrase: { definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] },
                time: 0,
                attempts: 0,
                gameStarted: false,
                itinerary: { showCodeAccess: false },
            };
            // activateHover/uptateTime touch unrelated DOM; stub them out.
            dmedia.activateHover = () => {};
            dmedia.uptateTime = () => {};

            dmedia.startGame(instance);

            expect(media.playSound).not.toHaveBeenCalled();
            expect(dmedia.options[instance].gameStarted).toBe(true);
        });
    });

    // startGame cleared the counters but told the LMS nothing, so its menu kept
    // the previous attempt's grade and status until the learner answered.
    describe('reporting when a timed game starts', () => {
        const instance = 0;

        function setupStart(overrides = {}) {
            document.body.innerHTML = `
                <div id="slcmpMainContainer-${instance}">
                    <div id="slcmpQuestion-${instance}"></div>
                    <div id="slcmpGameButtons-${instance}"></div>
                    <div id="slcmpShowClue-${instance}"></div>
                    <div id="slcmpPHits-${instance}"></div>
                    <div id="slcmpPNumber-${instance}"></div>
                    <div id="slcmpPScore-${instance}"></div>
                    <div id="slcmpPErrors-${instance}"></div>
                    <div id="slcmpCubierta-${instance}"></div>
                    <div id="slcmpGameOver-${instance}"></div>
                    <div id="slcmpStartGame-${instance}"></div>
                    <div id="slcmpCheck-${instance}"></div>
                    <div id="slcmpPTime-${instance}"></div>
                    <div id="slcmpImgTime-${instance}"></div>
                    <div id="slcmpGameContainer-${instance}"></div>
                </div>`;
            dmedia.options[instance] = Object.assign(
                {
                    main: `slcmpMainContainer-${instance}`,
                    isScorm: 1,
                    time: 1,
                    attempts: 0,
                    gameStarted: false,
                    gameOver: true,
                    hits: 3,
                    errors: 2,
                    score: 10,
                    numberQuestions: 4,
                    phrasesGame: [{ definition: 'Q0', audioDefinition: '', cards: [] }],
                    phrase: { definition: 'Q0', audioDefinition: '', cards: [] },
                    itinerary: { showCodeAccess: false },
                    msgs: { msgYouScore: 'Score' },
                },
                overrides
            );
            dmedia.activateHover = () => {};
            dmedia.uptateTime = () => {};
            dmedia.sendScore = vi.fn();
            vi.useFakeTimers();
        }

        afterEach(() => {
            vi.clearAllTimers();
            vi.useRealTimers();
            document.body.innerHTML = '';
        });

        it('publishes the cleared state when a finished game is restarted', () => {
            setupStart();
            let stateWhenReported;
            dmedia.sendScore.mockImplementation(() => {
                const { hits, errors, score, gameOver, gameStarted } =
                    dmedia.options[instance];
                stateWhenReported = { hits, errors, score, gameOver, gameStarted };
            });

            dmedia.startGame(instance, true);

            expect(stateWhenReported).toEqual({
                hits: 0,
                errors: 0,
                score: 0,
                gameOver: false,
                // sendScoreNew ignores a game that reports as neither started
                // nor over.
                gameStarted: true,
            });
        });

        it('does not report outside automatic SCORM mode', () => {
            setupStart({ isScorm: 2 });

            dmedia.startGame(instance, true);

            expect(dmedia.sendScore).not.toHaveBeenCalled();
        });

        it('does not report a game that was already running', () => {
            setupStart({ gameStarted: true });

            dmedia.startGame(instance, true);

            expect(dmedia.sendScore).not.toHaveBeenCalled();
        });

        // Loading an untimed activity and maximizing the board both reach
        // startGame, and a zero recorded there is one the learner never asked
        // for: with no timer and no code, nothing is published until the first
        // answer.
        it('stays silent when the start did not come from a control', () => {
            setupStart({ time: 0 });

            dmedia.startGame(instance);

            expect(dmedia.sendScore).not.toHaveBeenCalled();
            // Silent, but started: the board is playable and checkQuestion's
            // report will carry, since sendScoreNew drops an unstarted game.
            expect(dmedia.options[instance].gameStarted).toBe(true);
        });

        /**
         * The code field and the cover the entry drives, plus the button bar
         * hidden the way addEvents leaves it before the game starts.
         *
         * @param {string} typed what the learner puts in the code field
         */
        function addCodeAccessDom(typed) {
            $(`#slcmpMainContainer-${instance}`).append(`
                <div id="slcmpCodeAccessDiv-${instance}"></div>
                <div id="slcmpMesajeAccesCodeE-${instance}"></div>
                <a id="slcmpLinkMaximize-${instance}" href="#"></a>
                <input id="slcmpCodeAccessE-${instance}" value="${typed}" />`);
            $(`#slcmpGameButtons-${instance}`).hide();
        }

        // Without a timer the load path only starts the game when there is no
        // code, and the code entry only started it when there was a timer. A
        // coded, untimed activity was therefore left with nobody to start it:
        // no check button to answer with, and no opening zero either.
        it('starts an untimed activity when the code opens it, so it can be answered', () => {
            setupStart({
                time: 0,
                itinerary: { showCodeAccess: true, codeAccess: 'abre' },
            });
            addCodeAccessDom('abre');
            let stateWhenReported;
            dmedia.sendScore.mockImplementation(() => {
                const { hits, gameOver, gameStarted } = dmedia.options[instance];
                stateWhenReported = { hits, gameOver, gameStarted };
            });

            dmedia.enterCodeAccess(instance);

            expect(stateWhenReported).toEqual({
                hits: 0,
                gameOver: false,
                gameStarted: true,
            });
            // The check button lives inside this bar: without the start there
            // is nothing for the learner to press.
            expect($(`#slcmpGameButtons-${instance}`).css('display')).toBe(
                'flex'
            );
        });

        it('still starts a timed activity when the code opens it', () => {
            setupStart({
                time: 1,
                itinerary: { showCodeAccess: true, codeAccess: 'abre' },
            });
            addCodeAccessDom('abre');

            dmedia.enterCodeAccess(instance);

            expect(dmedia.sendScore).toHaveBeenCalledWith(true, instance);
            expect(dmedia.options[instance].gameStarted).toBe(true);
        });

        // The two above call enterCodeAccess with nothing bound, so its
        // maximize trigger does nothing and they passed while the shipped
        // iDevice reported nothing at all. With the real handlers attached,
        // that click reaches a maximize handler that also starts the game —
        // without the reporting flag — so the entry's own startGame hit its
        // `if (gameStarted) return` and the opening zero was lost. Wiring
        // addEvents is the whole point of these two.
        describe.each([
            ['untimed', 0],
            ['timed', 1],
        ])('with the real handlers bound, %s', (_label, time) => {
            beforeEach(() => {
                setupStart({
                    time,
                    // A fresh attempt, which is what makes the maximize
                    // handler start the game: it needs !gameStarted AND
                    // !gameOver. setupStart's default of gameOver: true would
                    // hide the defect these two exist to catch.
                    gameOver: false,
                    itinerary: { showCodeAccess: true, codeAccess: 'abre' },
                });
                addCodeAccessDom('abre');
                $(`#slcmpMainContainer-${instance}`).append(
                    `<div id="slcmpGameMinimize-${instance}"></div>
                     <div id="slcmpAuthorGame-${instance}"></div>
                     <div id="slcmpNextPhrase-${instance}"></div>`
                );
                dmedia.options[instance].active = -1;
                dmedia.options[instance].author = '';
                dmedia.showImage = () => {};
                dmedia.saveEvaluation = () => {};
                $exeDevices.iDevice.gamification.scorm = { registerActivity: vi.fn() };

                dmedia.addEvents(instance);
            });

            it('publishes the opening zero when the code opens it', () => {
                dmedia.enterCodeAccess(instance);

                expect(dmedia.sendScore).toHaveBeenCalledWith(true, instance);
                expect(dmedia.options[instance].gameStarted).toBe(true);
            });

            it('reports nothing when the code is wrong', () => {
                $(`#slcmpCodeAccessE-${instance}`).val('nope');

                dmedia.enterCodeAccess(instance);

                expect(dmedia.sendScore).not.toHaveBeenCalled();
                expect(dmedia.options[instance].gameStarted).toBe(false);
            });
        });

        // The timed case: no code, so the learner presses the play button and
        // that is the explicit start the LMS has to hear about.
        it('reports when the play button starts a timed activity', () => {
            setupStart({
                time: 1,
                author: '',
                itinerary: { showCodeAccess: false },
            });
            $(`#slcmpMainContainer-${instance}`).append(
                `<a id="slcmpStartGame-${instance}" href="#"></a>`
            );
            $exeDevices.iDevice.gamification.scorm = {
                registerActivity: vi.fn(),
            };
            $exeDevices.iDevice.gamification.report = {
                saveEvaluation: vi.fn(),
                updateEvaluationIcon: vi.fn(),
            };
            vi.spyOn(dmedia, 'startGame').mockImplementation(() => {});

            dmedia.addEvents(instance);
            $(`#slcmpStartGame-${instance}`).trigger('click');

            expect(dmedia.startGame).toHaveBeenCalledWith(instance, true);
        });

        it('neither starts nor reports when the code is wrong', () => {
            setupStart({
                time: 0,
                itinerary: { showCodeAccess: true, codeAccess: 'abre' },
            });
            addCodeAccessDom('nope');

            dmedia.enterCodeAccess(instance);

            expect(dmedia.sendScore).not.toHaveBeenCalled();
            expect(dmedia.options[instance].gameStarted).toBe(false);
            expect($(`#slcmpCodeAccessE-${instance}`).val()).toBe('');
        });
    });

    // The speaker played the clip and the card did not, so a learner who
    // clicked the picture heard nothing. checkAudio was written for this and
    // called from nowhere — and it read a data-audio the link never carried,
    // because the URL only lived in the icon handler's closure.
    describe('playing a card sound', () => {
        const instance = 0;

        function setupCards(audio = 'card.mp3') {
            document.body.innerHTML = `
                <div id="slcmpMainContainer-${instance}">
                    <div id="slcmpMultimedia-${instance}">
                        <div class="SLCMP-Card SLCMP-GridItem">
                            <img class="SLCMP-Image" />
                            <a href="#" class="SLCMP-LinkAudio" data-audio="${audio}">
                                <img class="SLCMP-AudioIcon" />
                            </a>
                        </div>
                    </div>
                </div>`;
            dmedia.activateHover(instance);
        }

        afterEach(() => {
            document.body.innerHTML = '';
        });

        it('plays the clip when the card itself is clicked', () => {
            setupCards();

            $('.SLCMP-Image').trigger('click');

            expect(media.playSound).toHaveBeenCalledWith('card.mp3');
        });

        it('selects the card as well', () => {
            setupCards();

            $('.SLCMP-Image').trigger('click');

            expect($('.SLCMP-Card').hasClass('SLCMP-Select')).toBe(true);
        });

        // The icon carries its own handler, bound where the card is built, so
        // the card handler has to stand aside: what this pins is that it adds
        // no second start for the same click.
        it('leaves the speaker click to the icon handler', () => {
            setupCards();

            $('.SLCMP-AudioIcon').trigger('click');

            expect(media.playSound).not.toHaveBeenCalled();
        });

        it('stays quiet on a card with no sound', () => {
            document.body.innerHTML = `
                <div id="slcmpMainContainer-${instance}">
                    <div id="slcmpMultimedia-${instance}">
                        <div class="SLCMP-Card SLCMP-GridItem">
                            <img class="SLCMP-Image" />
                        </div>
                    </div>
                </div>`;
            dmedia.activateHover(instance);

            $('.SLCMP-Image').trigger('click');

            expect(media.playSound).not.toHaveBeenCalled();
            expect($('.SLCMP-Card').hasClass('SLCMP-Select')).toBe(true);
        });
    });
});
