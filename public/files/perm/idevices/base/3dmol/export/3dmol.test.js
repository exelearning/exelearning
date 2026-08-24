/**
 * Unit tests for the 3dmol iDevice (export/runtime).
 *
 * Loads the export object the same way the guess iDevice tests do: a minimal
 * `$exeDevices.iDevice.gamification.colors` stub satisfies the load-time
 * property initializers, the `var $eXe3Dmol =` declaration is rewired to a
 * global, and the auto-init call is stripped so importing has no side effects.
 *
 * Real jQuery + happy-dom (provided by vitest.setup.js) back the DOM-touching
 * helpers (`updateModelAuthor`, `updateModelA11y`).
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice() {
    global.$exeDevices = {
        iDevice: {
            gamification: {
                colors: {
                    borderColors: { black: '#000', white: '#fff', red: '#f00', green: '#0f0', yellow: '#ff0' },
                    backColor: { black: '#000', white: '#fff' },
                },
                scorm: { addButtonScoreNew: () => '', restartActivity: () => {} },
            },
        },
    };
    const code = readFileSync(join(__dirname, '3dmol.js'), 'utf-8');
    let modified = code.replace(/var\s+\$eXe3Dmol\s*=/, 'global.$eXe3Dmol =');
    // Strip the auto-init: $(function () { $eXe3Dmol.init(); });
    modified = modified.replace(/\$\(function\s*\(\)\s*\{\s*\$eXe3Dmol\.init\(\);\s*\}\);?/g, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$eXe3Dmol;
}

describe('3dmol iDevice export', () => {
    let dmol;

    beforeEach(() => {
        global.$eXe3Dmol = undefined;
        dmol = loadExportIdevice();
        document.body.innerHTML = '';
    });

    describe('getModelFormatByName', () => {
        it('maps known extensions to their 3Dmol format', () => {
            expect(dmol.getModelFormatByName('protein.pdb')).toBe('pdb');
            expect(dmol.getModelFormatByName('molecule.SDF')).toBe('sdf');
            expect(dmol.getModelFormatByName('ligand.mol2')).toBe('mol2');
            expect(dmol.getModelFormatByName('coords.xyz')).toBe('xyz');
            expect(dmol.getModelFormatByName('crystal.cif')).toBe('cif');
            expect(dmol.getModelFormatByName('crystal.mmcif')).toBe('cif');
        });

        it('returns empty string for unknown or extension-less names', () => {
            expect(dmol.getModelFormatByName('model.tar.gz')).toBe('');
            expect(dmol.getModelFormatByName('model.txt')).toBe('');
            expect(dmol.getModelFormatByName('noextension')).toBe('');
            expect(dmol.getModelFormatByName('')).toBe('');
        });
    });

    describe('normalizeModelStyle', () => {
        it('keeps allowed styles (case-insensitive)', () => {
            expect(dmol.normalizeModelStyle('stick')).toBe('stick');
            expect(dmol.normalizeModelStyle('SPHERE')).toBe('sphere');
            expect(dmol.normalizeModelStyle(' surface ')).toBe('surface');
        });

        it('falls back to stick for invalid input', () => {
            expect(dmol.normalizeModelStyle('bogus')).toBe('stick');
            expect(dmol.normalizeModelStyle('')).toBe('stick');
            expect(dmol.normalizeModelStyle(undefined)).toBe('stick');
        });
    });

    describe('updateModelAuthor', () => {
        const instance = 'auth1';

        beforeEach(() => {
            document.body.innerHTML = `<div id="dmolpModelAuthor-${instance}" style="display:none"></div>`;
        });

        it('shows the author text below the model when an author is set', () => {
            dmol.updateModelAuthor('Jane Doe', instance);
            const el = document.getElementById(`dmolpModelAuthor-${instance}`);
            expect(el.textContent).toBe('Jane Doe');
            expect(el.style.display).not.toBe('none');
        });

        it('clears and hides the caption when there is no author', () => {
            dmol.updateModelAuthor('Jane Doe', instance);
            dmol.updateModelAuthor('', instance);
            const el = document.getElementById(`dmolpModelAuthor-${instance}`);
            expect(el.textContent).toBe('');
            expect(el.style.display).toBe('none');
        });

        it('trims whitespace-only authors to nothing', () => {
            dmol.updateModelAuthor('   ', instance);
            const el = document.getElementById(`dmolpModelAuthor-${instance}`);
            expect(el.textContent).toBe('');
            expect(el.style.display).toBe('none');
        });

        it('escapes HTML in the author (rendered as text, not markup)', () => {
            dmol.updateModelAuthor('<b>x</b>', instance);
            const el = document.getElementById(`dmolpModelAuthor-${instance}`);
            expect(el.querySelector('b')).toBeNull();
            expect(el.textContent).toBe('<b>x</b>');
        });

        it('does nothing when the caption element is absent', () => {
            document.body.innerHTML = '';
            expect(() => dmol.updateModelAuthor('Jane', instance)).not.toThrow();
        });
    });

    describe('updateModelA11y', () => {
        const instance = 'a11y1';

        beforeEach(() => {
            dmol.options[instance] = { msgs: { msgNoImage: 'No 3D model', msgTypeGame: '3D Model' } };
            document.body.innerHTML = `
                <div id="dmolpModelPreview-${instance}"></div>
                <span id="dmolpModelDesc-${instance}"></span>
            `;
        });

        it('uses the custom alternative text as the accessible description when provided', () => {
            dmol.updateModelA11y('glucose.sdf', instance, 'Glucose molecule, ball-and-stick');
            expect(document.getElementById(`dmolpModelPreview-${instance}`).getAttribute('aria-label')).toBe(
                'Glucose molecule, ball-and-stick',
            );
            expect(document.getElementById(`dmolpModelDesc-${instance}`).textContent).toBe(
                'Glucose molecule, ball-and-stick',
            );
        });

        it('falls back to the model name when no alt text is given', () => {
            dmol.updateModelA11y('glucose.sdf', instance);
            expect(document.getElementById(`dmolpModelPreview-${instance}`).getAttribute('aria-label')).toBe(
                '3D Model: glucose.sdf',
            );
        });

        it('falls back to the no-model message when neither alt nor name exist', () => {
            dmol.updateModelA11y('', instance, '');
            expect(document.getElementById(`dmolpModelPreview-${instance}`).getAttribute('aria-label')).toBe(
                'No 3D model',
            );
        });
    });

    describe('createInterface', () => {
        it('renders a dedicated, centered author caption below the model', () => {
            const instance = 'iface1';
            dmol.options[instance] = { msgs: {}, modelStyle: 'stick' };
            const html = dmol.createInterface(instance);
            expect(html).toContain(`id="dmolpModelAuthor-${instance}"`);
            expect(html).toContain('class="DMOLP-ModelAuthor"');
        });
    });

    describe('word questions', () => {
        function setupWordQuestion() {
            document.body.innerHTML = `
                <input id="dmolpEdAnswer-0" type="text" value="OHM">
                <button id="dmolpBtnReply-0"></button>
                <button id="dmolpBtnMoveOn-0"></button>
                <span id="dmolpPHits-0"></span>
                <span id="dmolpPErrors-0"></span>
            `;
            dmol.options = [
                {
                    activeQuestion: 0,
                    gameActived: true,
                    respuesta: '',
                    showSolution: false,
                    numberQuestions: 1,
                    hits: 0,
                    errors: 0,
                    timeShowSolution: 1,
                    itinerary: { showClue: false },
                    msgs: {},
                    selectsGame: [{ typeSelect: 2, solutionQuestion: 'OHM' }],
                },
            ];
            vi.spyOn(dmol, 'updateScore').mockImplementation(() => {});
            vi.spyOn(dmol, 'sameQuestion').mockReturnValue(false);
            vi.spyOn(dmol, 'newQuestion').mockImplementation(() => {});
        }

        it('disableWordAnswer locks the word input and its buttons', () => {
            document.body.innerHTML = `
                <input id="dmolpEdAnswer-0" type="text">
                <button id="dmolpBtnReply-0"></button>
                <button id="dmolpBtnMoveOn-0"></button>
            `;

            dmol.disableWordAnswer(0);

            expect(document.getElementById('dmolpEdAnswer-0').disabled).toBe(true);
            expect(document.getElementById('dmolpBtnReply-0').disabled).toBe(true);
            expect(document.getElementById('dmolpBtnMoveOn-0').disabled).toBe(true);
        });

        it('answerQuestion disables the word input', () => {
            vi.useFakeTimers();
            setupWordQuestion();

            dmol.answerQuestion(0);

            expect(document.getElementById('dmolpEdAnswer-0').disabled).toBe(true);
            vi.useRealTimers();
        });

        it('reveals the full solution word when show solution is on (ignoring sameQuestion)', () => {
            vi.useFakeTimers();
            setupWordQuestion();
            dmol.options[0].showSolution = true;
            dmol.sameQuestion.mockReturnValue(true);
            const drawPhrase = vi
                .spyOn(dmol, 'drawPhrase')
                .mockImplementation(() => {});

            dmol.answerQuestion(0);

            expect(drawPhrase).toHaveBeenCalled();
            const args = drawPhrase.mock.calls[0];
            expect(args[0]).toBe('OHM'); // the correct solution word
            expect(args[2]).toBe(100); // fully revealed
            vi.useRealTimers();
        });
    });

    describe('order questions', () => {
        it('ramdonOptions shuffles order questions and remaps the solution sequence', () => {
            // Deterministic "shuffle": reverse the array.
            global.$exeDevices.iDevice.gamification.helpers = {
                shuffleAds: (arr) => [...arr].reverse(),
            };
            dmol.options = [
                {
                    question: {
                        typeSelect: 1,
                        options: ['A1', 'B2', 'C3', 'D4'],
                        solution: 'ACBD', // correct order: A1, C3, B2, D4
                    },
                },
            ];

            dmol.ramdonOptions(0);

            const q = dmol.options[0].question;
            expect(q.options).toEqual(['D4', 'C3', 'B2', 'A1']);
            // The new positions must still read out as A1, C3, B2, D4 in order.
            expect(q.solution).toBe('DBCA');
        });

        it('shows the order solution even when sameQuestion would block it', () => {
            vi.useFakeTimers();
            document.body.innerHTML = `
                <span id="dmolpPHits-0"></span>
                <span id="dmolpPErrors-0"></span>
            `;
            dmol.options = [
                {
                    activeQuestion: 0,
                    gameActived: true,
                    respuesta: 'AB',
                    showSolution: true,
                    numberQuestions: 1,
                    hits: 0,
                    errors: 0,
                    timeShowSolution: 1,
                    itinerary: { showClue: false },
                    msgs: {},
                    selectsGame: [{ typeSelect: 1, solution: 'AB' }],
                },
            ];
            vi.spyOn(dmol, 'updateScore').mockImplementation(() => {});
            vi.spyOn(dmol, 'sameQuestion').mockReturnValue(true);
            const drawSolution = vi
                .spyOn(dmol, 'drawSolution')
                .mockImplementation(() => {});
            vi.spyOn(dmol, 'newQuestion').mockImplementation(() => {});

            dmol.answerQuestion(0);

            expect(drawSolution).toHaveBeenCalledWith(0);
            vi.useRealTimers();
        });
    });

    describe('export styles', () => {
        it('centers the model author caption', () => {
            const css = readFileSync(join(__dirname, '3dmol.css'), 'utf-8');
            const rule = css.match(/\.DMOLP-ModelAuthor\s*\{[\s\S]*?\}/)?.[0] || '';
            expect(rule).toContain('text-align: center;');
        });
    });

    describe('SCORM score persistence', () => {
        beforeEach(() => {
            document.body.innerHTML = '<span id="dmolpRepeatActivity-0"></span>';
        });

        afterEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
            document.body.innerHTML = '';
        });

        it('returns zero when the score denominator is not available', () => {
            dmol.options[0] = {
                activityMode: 'game',
                scoreGame: 1,
                scoreTotal: 0,
            };

            expect(dmol.getScoreRP(0)).toBe(0);
        });

        it('saves the SCORM score and updates the visible score text', () => {
            const sendScore = vi.spyOn(dmol, 'sendScore').mockImplementation(() => {});
            dmol.initialScore = '';
            dmol.options[0] = {
                isScorm: 1,
                repeatActivity: true,
                activityMode: 'game',
                scoreGame: 2,
                scoreTotal: 4,
                msgs: { msgYouScore: 'Score' },
            };

            dmol.saveScormScore(0);

            expect(sendScore).toHaveBeenCalledWith(true, 0);
            expect($('#dmolpRepeatActivity-0').text()).toBe('Score: 5.00');
        });

        it('saves the initial SCORM score when the test game starts', () => {
            vi.useFakeTimers();
            const saveScormScore = vi.spyOn(dmol, 'saveScormScore').mockImplementation(() => {});
            vi.spyOn(dmol, 'setModelStyleControlVisibility').mockImplementation(() => {});
            vi.spyOn(dmol, 'updateLives').mockImplementation(() => {});
            vi.spyOn(dmol, 'updateTime').mockImplementation(() => {});
            vi.spyOn(dmol, 'newQuestion').mockImplementation(() => {});
            dmol.options[0] = {
                activityMode: 'test',
                gameStarted: false,
                numberQuestions: 1,
                numberLives: 1,
                selectsGame: [{}],
            };

            dmol.startGame(0);

            expect(saveScormScore).toHaveBeenCalledWith(0);
            expect(dmol.newQuestion).toHaveBeenCalledWith(0);
        });

        it('saves the SCORM score after answering a board question', () => {
            const saveScormScore = vi.spyOn(dmol, 'saveScormScore').mockImplementation(() => {});
            vi.spyOn(dmol, 'updateScore').mockImplementation(() => {});
            dmol.options[0] = {
                gameActived: true,
                activeQuestion: 0,
                activeCounter: true,
                selectsGame: [{}],
                showSolution: false,
                timeShowSolution: 0,
                numberQuestions: 1,
                hits: 1,
                errors: 0,
                itinerary: { showClue: false },
            };

            dmol.answerQuestionBoard(true, 0);

            expect(dmol.updateScore).toHaveBeenCalledWith(true, 0);
            expect(saveScormScore).toHaveBeenCalledWith(0);
        });
    });

    describe('show mode completion (SCORM state)', () => {
        afterEach(() => {
            vi.restoreAllMocks();
            document.body.innerHTML = '';
        });

        function setupShow(slides) {
            document.body.innerHTML = `
                <div id="dmolpGameContainer-0"></div>
                <div id="dmolpModelPreview-0" tabindex="0"></div>
                <button id="dmolpShowPrev-0"></button>
                <button id="dmolpShowNext-0"></button>
            `;
            dmol.options[0] = {
                selectsGame: Array.from({ length: slides }, () => ({})),
                isScorm: 0,
                feedBack: false,
                itinerary: { showClue: false },
                msgs: {},
            };
            vi.spyOn(dmol, 'showModelAtIndex').mockImplementation(() => {});
            vi.spyOn(dmol, 'setModelStyleControlVisibility').mockImplementation(() => {});
            vi.spyOn(dmol, 'sendScore').mockImplementation(() => {});
            vi.spyOn(dmol, 'saveEvaluation').mockImplementation(() => {});
        }

        // A single model has no "next" to reach, so it completes on the learner's first use of the
        // viewer -- never on load, which would report work nobody did and close the attempt as
        // non-resumable. (#1831)
        it('does not complete a single-model activity on load', () => {
            setupShow(1);
            dmol.initShowMode(0);
            expect(dmol.options[0].gameOver).toBeFalsy();
            expect(dmol.sendScore).not.toHaveBeenCalled();
        });

        it('completes a single-model activity once the learner uses the viewer', () => {
            setupShow(1);
            dmol.options[0].isScorm = 1;
            dmol.initShowMode(0);

            $('#dmolpModelPreview-0').trigger('pointerdown');

            expect(dmol.options[0].gameOver).toBe(true);
            expect(dmol.sendScore).toHaveBeenCalledWith(true, 0);
        });

        it('completes a single-model activity from the keyboard too, and only once', () => {
            setupShow(1);
            dmol.options[0].isScorm = 1;
            dmol.initShowMode(0);

            $('#dmolpModelPreview-0').trigger('keydown');
            $('#dmolpModelPreview-0').trigger('pointerdown');

            expect(dmol.sendScore).toHaveBeenCalledTimes(1);
        });

        // It used to rewrite the score on every visit when the stored one was below the minimum,
        // which pushed up a mark the learner had not earned. (#1831)
        it('never writes a score on load, even with a low previous one stored', () => {
            setupShow(2);
            dmol.options[0].isScorm = 1;
            dmol.previousScore = '1';

            dmol.initShowMode(0);

            expect(dmol.sendScore).not.toHaveBeenCalled();
        });

        it('stays incomplete until the last model is reached', () => {
            setupShow(3);
            dmol.initShowMode(0);
            expect(dmol.options[0].gameOver).toBeFalsy();

            $('#dmolpShowNext-0').trigger('click');
            expect(dmol.options[0].showCurrentIndex).toBe(1);
            expect(dmol.options[0].gameOver).toBeFalsy();

            $('#dmolpShowNext-0').trigger('click');
            expect(dmol.options[0].showCurrentIndex).toBe(2);
            expect(dmol.options[0].gameOver).toBe(true);
        });
    });
});
