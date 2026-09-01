/**
 * Unit tests for sort iDevice (export/runtime)
 *
 * Tests native touch drag-and-drop support for two modes:
 * - setupTouchDragAndDrop / removeTouchDragAndDrop (card/image mode)
 * - setupTouchPhraseDragAndDrop / removeTouchPhraseDragAndDrop (phrase/text mode)
 */

/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeOrdena globally.
 * Replaces var declaration with global assignment and strips the auto-init call.
 */
function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$eXeOrdena\s*=/, 'global.$eXeOrdena =')
        .replace(/\$\(function\s*\(\)\s*\{[\s\S]*?\}\);?\s*$/, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeOrdena;
}

describe('sort iDevice export', () => {
    let $eXeOrdena;

    beforeEach(() => {
        global.$eXeOrdena = undefined;

        const filePath = join(__dirname, 'sort.js');
        const code = readFileSync(filePath, 'utf-8');

        $eXeOrdena = loadExportIdevice(code);
    });

    // ─── Card / image mode ────────────────────────────────────────────────────

    describe('setupTouchDragAndDrop (card mode)', () => {
        it('exists as a function', () => {
            expect(typeof $eXeOrdena.setupTouchDragAndDrop).toBe('function');
        });

        it('registers three touch listeners on the multimedia container', () => {
            const instance = 0;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };

            const container = document.createElement('div');
            container.id = `ordenaMultimedia-${instance}`;
            document.body.appendChild(container);
            const spy = vi.spyOn(container, 'addEventListener');

            $eXeOrdena.setupTouchDragAndDrop(instance);

            expect(spy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
            expect(spy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
            expect(spy).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });

            document.body.removeChild(container);
            $eXeOrdena.removeTouchDragAndDrop(instance);
        });

        it('stores handlers in mOptions', () => {
            const instance = 1;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };

            const container = document.createElement('div');
            container.id = `ordenaMultimedia-${instance}`;
            document.body.appendChild(container);

            $eXeOrdena.setupTouchDragAndDrop(instance);

            const mOptions = $eXeOrdena.options[instance];
            expect(typeof mOptions._touchDragStart).toBe('function');
            expect(typeof mOptions._touchDragMove).toBe('function');
            expect(typeof mOptions._touchDragEnd).toBe('function');
            expect(mOptions._touchDragContainer).toBe(container);

            document.body.removeChild(container);
            $eXeOrdena.removeTouchDragAndDrop(instance);
        });

        it('does nothing when multimedia container does not exist', () => {
            $eXeOrdena.options[999] = { gameStarted: true, gameOver: false };
            expect(() => $eXeOrdena.setupTouchDragAndDrop(999)).not.toThrow();
            expect($eXeOrdena.options[999]._touchDragContainer).toBeUndefined();
        });

        it('removes previous listeners before registering new ones (idempotent)', () => {
            const instance = 2;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };

            const container = document.createElement('div');
            container.id = `ordenaMultimedia-${instance}`;
            document.body.appendChild(container);
            const removeSpy = vi.spyOn(container, 'removeEventListener');

            $eXeOrdena.setupTouchDragAndDrop(instance);
            $eXeOrdena.setupTouchDragAndDrop(instance); // second call should remove first

            expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

            document.body.removeChild(container);
            $eXeOrdena.removeTouchDragAndDrop(instance);
        });
    });

    describe('removeTouchDragAndDrop (card mode)', () => {
        it('exists as a function', () => {
            expect(typeof $eXeOrdena.removeTouchDragAndDrop).toBe('function');
        });

        it('removes the three touch listeners', () => {
            const instance = 3;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };

            const container = document.createElement('div');
            container.id = `ordenaMultimedia-${instance}`;
            document.body.appendChild(container);

            $eXeOrdena.setupTouchDragAndDrop(instance);
            const removeSpy = vi.spyOn(container, 'removeEventListener');

            $eXeOrdena.removeTouchDragAndDrop(instance);

            expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

            document.body.removeChild(container);
        });

        it('clears handler references in mOptions', () => {
            const instance = 4;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };

            const container = document.createElement('div');
            container.id = `ordenaMultimedia-${instance}`;
            document.body.appendChild(container);

            $eXeOrdena.setupTouchDragAndDrop(instance);
            $eXeOrdena.removeTouchDragAndDrop(instance);

            const mOptions = $eXeOrdena.options[instance];
            expect(mOptions._touchDragStart).toBeNull();
            expect(mOptions._touchDragMove).toBeNull();
            expect(mOptions._touchDragEnd).toBeNull();
            expect(mOptions._touchDragContainer).toBeNull();

            document.body.removeChild(container);
        });

        it('does not throw when called without prior setup', () => {
            $eXeOrdena.options[888] = { gameStarted: true, gameOver: false };
            expect(() => $eXeOrdena.removeTouchDragAndDrop(888)).not.toThrow();
        });

        it('does not throw when mOptions does not exist', () => {
            expect(() => $eXeOrdena.removeTouchDragAndDrop(777)).not.toThrow();
        });
    });

    describe('card mode touch handler behaviors', () => {
        let instance, container;

        beforeEach(() => {
            instance = 5;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };
            container = document.createElement('div');
            container.id = `ordenaMultimedia-${instance}`;
            document.body.appendChild(container);
            $eXeOrdena.setupTouchDragAndDrop(instance);
        });

        afterEach(() => {
            $eXeOrdena.removeTouchDragAndDrop(instance);
            if (container.parentNode) document.body.removeChild(container);
        });

        it('touchstart ignores touch on non-ODNP-NewCard elements', () => {
            const touchStartHandler = $eXeOrdena.options[instance]._touchDragStart;
            vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body);
            const preventDefault = vi.fn();

            expect(() =>
                touchStartHandler({ touches: [{ clientX: 0, clientY: 0 }], preventDefault })
            ).not.toThrow();
            expect(preventDefault).not.toHaveBeenCalled();
        });

        it('touchstart does nothing when game not started', () => {
            $eXeOrdena.options[instance].gameStarted = false;
            const touchStartHandler = $eXeOrdena.options[instance]._touchDragStart;
            const preventDefault = vi.fn();

            expect(() =>
                touchStartHandler({ touches: [{ clientX: 0, clientY: 0 }], preventDefault })
            ).not.toThrow();
            expect(preventDefault).not.toHaveBeenCalled();
        });

        it('touchstart does nothing when game is over', () => {
            $eXeOrdena.options[instance].gameOver = true;
            const touchStartHandler = $eXeOrdena.options[instance]._touchDragStart;
            const preventDefault = vi.fn();

            expect(() =>
                touchStartHandler({ touches: [{ clientX: 0, clientY: 0 }], preventDefault })
            ).not.toThrow();
            expect(preventDefault).not.toHaveBeenCalled();
        });

        it('touchmove does nothing when no item is being dragged', () => {
            const touchMoveHandler = $eXeOrdena.options[instance]._touchDragMove;
            const preventDefault = vi.fn();

            expect(() =>
                touchMoveHandler({ touches: [{ clientX: 10, clientY: 10 }], preventDefault })
            ).not.toThrow();
            expect(preventDefault).not.toHaveBeenCalled();
        });

        it('touchend does nothing when no item is being dragged', () => {
            const touchEndHandler = $eXeOrdena.options[instance]._touchDragEnd;
            expect(() =>
                touchEndHandler({ changedTouches: [{ clientX: 10, clientY: 10 }] })
            ).not.toThrow();
        });
    });

    // ─── Phrase / text mode ───────────────────────────────────────────────────

    describe('setupTouchPhraseDragAndDrop (phrase mode)', () => {
        it('exists as a function', () => {
            expect(typeof $eXeOrdena.setupTouchPhraseDragAndDrop).toBe('function');
        });

        it('registers three touch listeners on the phrases container', () => {
            const instance = 10;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };

            const container = document.createElement('div');
            container.id = `ordenaPhrasesContainer-${instance}`;
            document.body.appendChild(container);
            const spy = vi.spyOn(container, 'addEventListener');

            $eXeOrdena.setupTouchPhraseDragAndDrop(instance);

            expect(spy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
            expect(spy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
            expect(spy).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });

            document.body.removeChild(container);
            $eXeOrdena.removeTouchPhraseDragAndDrop(instance);
        });

        it('stores handlers in mOptions with phrase-specific keys', () => {
            const instance = 11;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };

            const container = document.createElement('div');
            container.id = `ordenaPhrasesContainer-${instance}`;
            document.body.appendChild(container);

            $eXeOrdena.setupTouchPhraseDragAndDrop(instance);

            const mOptions = $eXeOrdena.options[instance];
            expect(typeof mOptions._touchPhraseDragStart).toBe('function');
            expect(typeof mOptions._touchPhraseDragMove).toBe('function');
            expect(typeof mOptions._touchPhraseDragEnd).toBe('function');
            expect(mOptions._touchPhraseContainer).toBe(container);

            document.body.removeChild(container);
            $eXeOrdena.removeTouchPhraseDragAndDrop(instance);
        });

        it('does nothing when phrases container does not exist', () => {
            $eXeOrdena.options[998] = { gameStarted: true, gameOver: false };
            expect(() => $eXeOrdena.setupTouchPhraseDragAndDrop(998)).not.toThrow();
            expect($eXeOrdena.options[998]._touchPhraseContainer).toBeUndefined();
        });

        it('removes previous listeners before registering new ones (idempotent)', () => {
            const instance = 12;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };

            const container = document.createElement('div');
            container.id = `ordenaPhrasesContainer-${instance}`;
            document.body.appendChild(container);
            const removeSpy = vi.spyOn(container, 'removeEventListener');

            $eXeOrdena.setupTouchPhraseDragAndDrop(instance);
            $eXeOrdena.setupTouchPhraseDragAndDrop(instance); // second call removes first

            expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

            document.body.removeChild(container);
            $eXeOrdena.removeTouchPhraseDragAndDrop(instance);
        });
    });

    describe('removeTouchPhraseDragAndDrop (phrase mode)', () => {
        it('exists as a function', () => {
            expect(typeof $eXeOrdena.removeTouchPhraseDragAndDrop).toBe('function');
        });

        it('removes the three touch listeners', () => {
            const instance = 13;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };

            const container = document.createElement('div');
            container.id = `ordenaPhrasesContainer-${instance}`;
            document.body.appendChild(container);

            $eXeOrdena.setupTouchPhraseDragAndDrop(instance);
            const removeSpy = vi.spyOn(container, 'removeEventListener');

            $eXeOrdena.removeTouchPhraseDragAndDrop(instance);

            expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

            document.body.removeChild(container);
        });

        it('clears phrase handler references in mOptions', () => {
            const instance = 14;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };

            const container = document.createElement('div');
            container.id = `ordenaPhrasesContainer-${instance}`;
            document.body.appendChild(container);

            $eXeOrdena.setupTouchPhraseDragAndDrop(instance);
            $eXeOrdena.removeTouchPhraseDragAndDrop(instance);

            const mOptions = $eXeOrdena.options[instance];
            expect(mOptions._touchPhraseDragStart).toBeNull();
            expect(mOptions._touchPhraseDragMove).toBeNull();
            expect(mOptions._touchPhraseDragEnd).toBeNull();
            expect(mOptions._touchPhraseContainer).toBeNull();

            document.body.removeChild(container);
        });

        it('does not throw when called without prior setup', () => {
            $eXeOrdena.options[886] = { gameStarted: true, gameOver: false };
            expect(() => $eXeOrdena.removeTouchPhraseDragAndDrop(886)).not.toThrow();
        });

        it('does not throw when mOptions does not exist', () => {
            expect(() => $eXeOrdena.removeTouchPhraseDragAndDrop(775)).not.toThrow();
        });
    });

    describe('phrase mode touch handler behaviors', () => {
        let instance, container;

        beforeEach(() => {
            instance = 15;
            $eXeOrdena.options[instance] = { gameStarted: true, gameOver: false };
            container = document.createElement('div');
            container.id = `ordenaPhrasesContainer-${instance}`;
            document.body.appendChild(container);
            $eXeOrdena.setupTouchPhraseDragAndDrop(instance);
        });

        afterEach(() => {
            $eXeOrdena.removeTouchPhraseDragAndDrop(instance);
            if (container.parentNode) document.body.removeChild(container);
        });

        it('touchstart ignores touch on non-ODNP-Word elements', () => {
            const touchStartHandler = $eXeOrdena.options[instance]._touchPhraseDragStart;
            vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body);
            const preventDefault = vi.fn();

            expect(() =>
                touchStartHandler({ touches: [{ clientX: 0, clientY: 0 }], preventDefault })
            ).not.toThrow();
            expect(preventDefault).not.toHaveBeenCalled();
        });

        it('touchstart does nothing when game not started', () => {
            $eXeOrdena.options[instance].gameStarted = false;
            const touchStartHandler = $eXeOrdena.options[instance]._touchPhraseDragStart;
            const preventDefault = vi.fn();

            expect(() =>
                touchStartHandler({ touches: [{ clientX: 0, clientY: 0 }], preventDefault })
            ).not.toThrow();
            expect(preventDefault).not.toHaveBeenCalled();
        });

        it('touchstart does nothing when game is over', () => {
            $eXeOrdena.options[instance].gameOver = true;
            const touchStartHandler = $eXeOrdena.options[instance]._touchPhraseDragStart;
            const preventDefault = vi.fn();

            expect(() =>
                touchStartHandler({ touches: [{ clientX: 0, clientY: 0 }], preventDefault })
            ).not.toThrow();
            expect(preventDefault).not.toHaveBeenCalled();
        });

        it('touchmove does nothing when no item is being dragged', () => {
            const touchMoveHandler = $eXeOrdena.options[instance]._touchPhraseDragMove;
            const preventDefault = vi.fn();

            expect(() =>
                touchMoveHandler({ touches: [{ clientX: 10, clientY: 10 }], preventDefault })
            ).not.toThrow();
            expect(preventDefault).not.toHaveBeenCalled();
        });

        it('touchend does nothing when no item is being dragged', () => {
            const touchEndHandler = $eXeOrdena.options[instance]._touchPhraseDragEnd;
            expect(() =>
                touchEndHandler({ changedTouches: [{ clientX: 10, clientY: 10 }] })
            ).not.toThrow();
        });
    });

    describe('multimedia validation for image-only cards', () => {
        beforeEach(() => {
            document.body.innerHTML = '';
        });

        function createCardDrawHtml(order, imageUrl = '') {
            return `
                <div class="ODNP-CardDraw" data-order="${order}">
                    <img class="ODNP-Image" data-url="${imageUrl}" />
                </div>
            `;
        }

        it('checkPhrase accepts cards by exact image URL when all cards are image-only', () => {
            const instance = 20;
            $eXeOrdena.options[instance] = {
                type: 1,
                phrase: {
                    cards: [
                        { order: 0, url: 'img/avanza.png', eText: '   ', audio: '   ' },
                        { order: 1, url: 'img/avanza.png', eText: '', audio: '' },
                        { order: 2, url: 'img/para.png', eText: '', audio: '' },
                    ],
                },
            };

            document.body.innerHTML = `
                <div id="ordenaMultimedia-${instance}">
                    ${createCardDrawHtml(1, 'img/avanza.png')}
                    ${createCardDrawHtml(0, 'img/avanza.png')}
                    ${createCardDrawHtml(2, 'img/para.png')}
                </div>
            `;

            const result = $eXeOrdena.checkPhrase(instance);
            expect(result.correct).toBe(true);
            expect(result.valids).toEqual([1, 0, 2]);
        });

        it('checkPhrase keeps legacy order validation when phrase is mixed (text/audio present)', () => {
            const instance = 21;
            $eXeOrdena.options[instance] = {
                phrase: {
                    cards: [
                        { order: 0, url: 'img/avanza.png', eText: 'texto', audio: '' },
                        { order: 1, url: 'img/para.png', eText: '', audio: '' },
                    ],
                },
            };

            document.body.innerHTML = `
                <div id="ordenaMultimedia-${instance}">
                    ${createCardDrawHtml(1, 'img/avanza.png')}
                    ${createCardDrawHtml(0, 'img/para.png')}
                </div>
            `;

            const result = $eXeOrdena.checkPhrase(instance);
            expect(result.correct).toBe(false);
            expect(result.valids).toEqual([]);
        });

        it('checkPhraseColumns validates by image URL in image-only mode', () => {
            const instance = 22;
            $eXeOrdena.options[instance] = {
                gameColumns: 2,
                type: 1,
                phrase: {
                    cards: [
                        { order: 0, url: 'img/avanza.png', eText: '', audio: '' },
                        { order: 1, url: 'img/para.png', eText: '', audio: '' },
                        { order: 2, url: 'img/avanza.png', eText: '', audio: '' },
                        { order: 3, url: 'img/para.png', eText: '', audio: '' },
                    ],
                },
            };

            document.body.innerHTML = `
                <div id="ordenaMultimedia-${instance}">
                    ${createCardDrawHtml(0, 'img/avanza.png')}
                    ${createCardDrawHtml(1, 'img/para.png')}
                    ${createCardDrawHtml(2, 'img/avanza.png')}
                    ${createCardDrawHtml(3, 'img/para.png')}
                </div>
            `;

            const result = $eXeOrdena.checkPhraseColumns(instance);
            expect(result.correct).toBe(true);
            expect(result.valids).toEqual([2, 3]);
        });

        it('checkPhraseColumns does not accept duplicated occurrences beyond expected count', () => {
            const instance = 23;
            $eXeOrdena.options[instance] = {
                gameColumns: 2,
                type: 1,
                phrase: {
                    cards: [
                        { order: 0, url: 'img/header-a.png', eText: '', audio: '' },
                        { order: 1, url: 'img/header-b.png', eText: '', audio: '' },
                        { order: 2, url: 'img/a.png', eText: '', audio: '' },
                        { order: 3, url: 'img/b.png', eText: '', audio: '' },
                    ],
                },
            };

            document.body.innerHTML = `
                <div id="ordenaMultimedia-${instance}">
                    ${createCardDrawHtml(0, 'img/header-a.png')}
                    ${createCardDrawHtml(1, 'img/header-b.png')}
                    ${createCardDrawHtml(2, 'img/a.png')}
                    ${createCardDrawHtml(2, 'img/a.png')}
                </div>
            `;

            const result = $eXeOrdena.checkPhraseColumns(instance);
            expect(result.correct).toBe(false);
        });
    });

    describe('content signature helpers', () => {
        it('sanitizeComparableValue strips HTML in a detached copy and trims', () => {
            const value = '  <strong>Hello</strong> <em>world</em>  ';
            const sanitized = $eXeOrdena.sanitizeComparableValue(value);

            expect(sanitized).toBe('Hello world');
        });

        it('isCardContentSignatureEmpty detects empty and non-empty signatures', () => {
            const emptySignature = $eXeOrdena.getCardContentSignature('', '', '');
            const nonEmptySignature = $eXeOrdena.getCardContentSignature(
                'img/a.png',
                '',
                ''
            );

            expect($eXeOrdena.isCardContentSignatureEmpty(emptySignature)).toBe(
                true
            );
            expect(
                $eXeOrdena.isCardContentSignatureEmpty(nonEmptySignature)
            ).toBe(false);
        });

        it('cardMatchesImagePosition returns false for legacy empty content cards', () => {
            const phrase = {
                cards: [{ order: 0, url: '', eText: '   ', audio: '   ' }],
            };
            const $cardDraw = $(
                '<div class="ODNP-CardDraw" data-order="0"></div>'
            );

            const result = $eXeOrdena.cardMatchesImagePosition(
                $cardDraw,
                phrase,
                0
            );
            expect(result).toBe(false);
        });
    });

    // ─── SCORM completion signal ──────────────────────────────────────────────

    describe('completion signal', () => {
        const instance = 0;
        let reports;

        /**
         * Build the smallest instance state the end-of-activity path reads.
         *
         * `active` is the phrase the learner has just validated: the activity is
         * over when advancing past it leaves no phrase left.
         *
         * @param {number} active index of the phrase just answered
         * @param {number} phrases how many phrases the activity has
         * @returns {object} the instance options object
         */
        function givenInstance(active, phrases) {
            const mOptions = {
                active: active,
                attempts: 0,
                feedBack: false,
                gameActived: true,
                gameOver: false,
                gameStarted: true,
                hits: phrases,
                isScorm: 1,
                itinerary: { showClue: false, percentageClue: 0 },
                main: 'ordenaMainContainer-' + instance,
                msgs: {},
                nattempts: 0,
                numberQuestions: phrases,
                percentajeFB: 0,
                phrasesGame: new Array(phrases).fill({ cards: [] }),
                timeShowSolution: 0,
                type: 0,
            };
            $eXeOrdena.options[instance] = mOptions;
            return mOptions;
        }

        beforeEach(() => {
            reports = [];
            global.$exeDevices = {
                iDevice: {
                    gamification: {
                        media: { stopSound: () => {} },
                        report: { saveEvaluation: () => {} },
                        scorm: {
                            // `gameOver` is captured by value: holding a reference to
                            // the shared options object would let a mutation made
                            // after the report fake a completion that never happened.
                            sendScoreNew: (auto, game) =>
                                reports.push({
                                    auto: auto,
                                    gameOver: game.gameOver,
                                    scorerp: game.scorerp,
                                }),
                        },
                    },
                },
            };
            // nextPhrase hands an intermediate phrase to the renderer, which needs
            // the authored DOM. Only the branch it takes matters here.
            $eXeOrdena.showPhrase = () => {};
            $eXeOrdena.showPhraseText = () => {};
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('does not report the activity finished while phrases remain', () => {
            const mOptions = givenInstance(0, 3);

            $eXeOrdena.nextPhrase(instance);
            vi.runAllTimers();

            expect(mOptions.gameOver).toBe(false);
            expect(reports).toHaveLength(0);
        });

        it('marks the activity finished on the last phrase, so the page can be passed', () => {
            // Validating the last phrase is the activity's end condition: nextPhrase
            // runs out of phrases and calls gameOver(0). Without the flag set before
            // that report the page stays `incomplete` in the LMS at 100%.
            givenInstance(2, 3);

            $eXeOrdena.nextPhrase(instance);
            vi.runAllTimers();

            expect(reports).toHaveLength(1);
            expect(reports[0].auto).toBe(true);
            expect(reports[0].gameOver).toBe(true);
            expect(reports[0].scorerp).toBe(10);
        });

        // The validate handler reports as soon as nextPhrase returns, without
        // waiting for the timeShowSolution delay. Raising the flag only inside
        // the delayed gameOver() left that report carrying the final score with
        // completed: false, so a learner who left during the delay stayed at
        // 100% on a page the LMS still called incomplete.
        it('marks the last phrase finished before the reveal delay elapses', () => {
            const mOptions = givenInstance(2, 3);

            $eXeOrdena.nextPhrase(instance);

            // No timer advanced: this is what the validate handler would send.
            expect(mOptions.gameOver).toBe(true);
        });

        it('leaves the flag down while phrases remain, before the delay too', () => {
            const mOptions = givenInstance(0, 3);

            $eXeOrdena.nextPhrase(instance);

            expect(mOptions.gameOver).toBe(false);
        });

        it('handles a single-phrase activity, which ends on its first validation', () => {
            givenInstance(0, 1);

            $eXeOrdena.nextPhrase(instance);
            vi.runAllTimers();

            expect(reports).toHaveLength(1);
            expect(reports[0].gameOver).toBe(true);
        });
    });

    // The count used to subtract gameColumns from response.valids in the
    // ordered-columns mode, so the feedback undercounted the learner's own
    // result — with three columns, three correct positions read as none.
    describe('SCORM reporting on start', () => {
        function setupGame(overrides = {}) {
            document.body.innerHTML = `
                <div id="ordenaMainContainer-0">
                    <div id="ordenaPhrasesContainer-0"></div>
                    <div id="ordenaGameButtons-0"></div>
                    <div id="ordenaPShowClue-0"></div>
                    <div id="ordenaShowClue-0"></div>
                    <div id="ordenaPHits-0"></div>
                    <div id="ordenaPErrors-0"></div>
                    <div id="ordenaCubierta-0"></div>
                    <div id="ordenaGameOver-0"></div>
                    <div id="ordenaPTime-0"></div>
                    <div id="ordenaImgTime-0"></div>
                    <div id="ordenaMultimedia-0"></div>
                </div>`;
            $eXeOrdena.options[0] = Object.assign(
                {
                    main: 'ordenaMainContainer-0',
                    isScorm: 1,
                    type: 0,
                    time: 0,
                    attempts: 0,
                    gameStarted: false,
                    gameOver: false,
                    hits: 0,
                    errors: 0,
                    score: 0,
                    scorerp: 0,
                    numberQuestions: 4,
                    msgs: { msgYouScore: 'Score' },
                },
                overrides
            );
            vi.spyOn($eXeOrdena, 'initCards').mockImplementation(() => {});
            vi.spyOn($eXeOrdena, 'showMessage').mockImplementation(() => {});
            vi.spyOn($eXeOrdena, 'uptateTime').mockImplementation(() => {});
            vi.spyOn($eXeOrdena, 'sendScore').mockImplementation(() => {});
        }

        afterEach(() => {
            document.body.innerHTML = '';
            vi.restoreAllMocks();
        });

        it('saveScormScore reports only in automatic SCORM mode', () => {
            setupGame({ isScorm: 1 });
            $eXeOrdena.saveScormScore(0);
            expect($eXeOrdena.sendScore).toHaveBeenCalledWith(true, 0);

            $eXeOrdena.sendScore.mockClear();
            $eXeOrdena.options[0].isScorm = 2;
            $eXeOrdena.saveScormScore(0);
            expect($eXeOrdena.sendScore).not.toHaveBeenCalled();
        });

        // The defect: clicking the play link cleared the board, but the LMS
        // menu kept the previous attempt's grade and its terminal status.
        it('publishes the cleared state when a finished game is restarted', () => {
            setupGame({ hits: 4, errors: 2, score: 10, gameOver: true });
            let stateWhenReported;
            $eXeOrdena.sendScore.mockImplementation(() => {
                const { hits, errors, gameOver, gameStarted } =
                    $eXeOrdena.options[0];
                stateWhenReported = { hits, errors, gameOver, gameStarted };
            });

            $eXeOrdena.startGame(0);

            expect(stateWhenReported).toEqual({
                hits: 0,
                errors: 0,
                gameOver: false,
                // sendScoreNew ignores a game that reports as neither started
                // nor over.
                gameStarted: true,
            });
        });

        it('does not report a game that was already running', () => {
            setupGame({ gameStarted: true });

            $eXeOrdena.startGame(0);

            expect($eXeOrdena.sendScore).not.toHaveBeenCalled();
        });
    });

    describe('getCorrectPositionsCount', () => {
        it('counts every correct position', () => {
            expect(
                $eXeOrdena.getCorrectPositionsCount({ valids: [0, 1, 2] })
            ).toBe(3);
        });

        it('does not discount anything in the ordered-columns mode', () => {
            // Three columns, three correct positions: the learner got them all.
            const response = { valids: [0, 1, 2], correct: true };

            expect($eXeOrdena.getCorrectPositionsCount(response)).toBe(3);
        });

        it('answers zero when there is nothing to count', () => {
            expect($eXeOrdena.getCorrectPositionsCount({ valids: [] })).toBe(0);
            expect($eXeOrdena.getCorrectPositionsCount({})).toBe(0);
            expect($eXeOrdena.getCorrectPositionsCount(undefined)).toBe(0);
        });
    });
});
