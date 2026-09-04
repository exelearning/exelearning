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
import { describe, it, expect, beforeEach } from 'vitest';
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
                scorm: { addButtonScoreNew: () => '' },
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

    // Presentation mode has no questions: walking to the last model is the
    // whole of the activity. The score already reached 10 there, but nothing
    // said the activity was finished, so the page stayed `incomplete`.
    describe('completion in presentation mode', () => {
        const instance = 0;
        let reported;

        function setupShow(models) {
            document.body.innerHTML = `
                <div id="dmolpMainContainer-${instance}">
                    <div id="dmolpMultimedia-${instance}"></div>
                    <div id="dmolpShowPrev-${instance}"></div>
                    <div id="dmolpShowNext-${instance}"></div>
                    <div id="dmolpShowClue-${instance}"></div>
                    <div id="dmolpDivFeedBack-${instance}"></div>
                </div>`;
            dmol.options[instance] = {
                main: `dmolpMainContainer-${instance}`,
                isScorm: 1,
                activityMode: 'show',
                gameOver: false,
                gameStarted: false,
                visiteds: 0,
                showCurrentIndex: 0,
                selectsGame: new Array(models).fill({}),
                feedBack: false,
                obtainedClue: false,
                itinerary: { showClue: false, percentageClue: 0 },
                msgs: { msgInformation: 'info', msgYouScore: 'Score' },
            };
            reported = [];
            dmol.showModelAtIndex = () => {};
            dmol.setModelStyleControlVisibility = () => {};
            dmol.saveEvaluation = () => {};
            dmol.sendScore = (auto, i) => {
                reported.push({
                    auto,
                    gameOver: dmol.options[i].gameOver,
                    scorerp: dmol.getScoreRP(i),
                });
            };
            dmol.initShowMode(instance);
        }

        /** Press Next once. */
        function next() {
            $(`#dmolpShowNext-${instance}`).trigger('click');
        }

        it('stays unfinished while models remain', () => {
            setupShow(3);

            next();

            expect(reported).toHaveLength(1);
            expect(reported[0].gameOver).toBe(false);
        });

        it('finishes on the last model, with the full mark', () => {
            setupShow(3);

            next();
            next();

            expect(reported).toHaveLength(2);
            expect(reported[1].gameOver).toBe(true);
            expect(reported[1].scorerp).toBe(10);
        });

        it('finishes on the first step of a two-model presentation', () => {
            setupShow(2);

            next();

            expect(reported[0].gameOver).toBe(true);
            expect(reported[0].scorerp).toBe(10);
        });
    });

    // The quiz modes only reported when a NEXT question appeared (showQuestion)
    // and from gameOver(), which is reached solely from the setTimeout that
    // shows the solution. After the last answer there is no next question, so
    // a learner who left while the solution was on screen had neither that
    // answer's points nor the completion recorded.
    describe('completion on the last answer', () => {
        const instance = 0;
        let reported;

        function setupLastQuestion(overrides = {}) {
            document.body.innerHTML = `
                <div id="dmolpMainContainer-${instance}">
                    <input id="dmolpEdAnswer-${instance}" type="text" value="OHM">
                    <button id="dmolpBtnReply-${instance}"></button>
                    <button id="dmolpBtnMoveOn-${instance}"></button>
                    <span id="dmolpPHits-${instance}"></span>
                    <span id="dmolpPErrors-${instance}"></span>
                    <span id="dmolpPScore-${instance}"></span>
                    <div id="dmolpShowClue-${instance}"></div>
                    <div id="dmolpPShowClue-${instance}"></div>
                </div>`;
            dmol.options[instance] = Object.assign(
                {
                    main: `dmolpMainContainer-${instance}`,
                    isScorm: 1,
                    activeQuestion: 0,
                    numberQuestions: 1,
                    gameActived: true,
                    gameStarted: true,
                    gameOver: false,
                    respuesta: '',
                    showSolution: false,
                    timeShowSolution: 3,
                    hits: 0,
                    errors: 0,
                    scoreGame: 0,
                    scoreTotal: 1,
                    gameMode: 1,
                    itinerary: { showClue: false, percentageClue: 0 },
                    msgs: { msgYouScore: 'Score' },
                    selectsGame: [
                        { typeSelect: 2, solutionQuestion: 'OHM', customScore: 1 },
                    ],
                },
                overrides
            );
            reported = [];
            vi.spyOn(dmol, 'sameQuestion').mockReturnValue(false);
            vi.spyOn(dmol, 'showMessage').mockImplementation(() => {});
            vi.spyOn(dmol, 'newQuestion').mockImplementation(() => {});
            vi.spyOn(dmol, 'sendScore').mockImplementation((auto, i) => {
                reported.push({ auto, gameOver: dmol.options[i].gameOver });
            });
        }

        afterEach(() => {
            document.body.innerHTML = '';
            vi.restoreAllMocks();
        });

        it('reports the completion in the same turn the learner answered', () => {
            setupLastQuestion();

            dmol.answerQuestion(instance);

            expect(reported).toEqual([{ auto: true, gameOver: true }]);
        });

        it('does the same from the board buttons', () => {
            setupLastQuestion();

            dmol.answerQuestionBoard(true, instance);

            expect(reported).toEqual([{ auto: true, gameOver: true }]);
        });

        // An intermediate answer must not close the attempt: the page would go
        // to passed/failed while the learner is still playing.
        it('leaves the attempt open while questions remain', () => {
            setupLastQuestion({ numberQuestions: 3 });

            dmol.answerQuestion(instance);

            expect(dmol.options[instance].gameOver).toBe(false);
            expect(reported).toEqual([]);
        });

        it('does not auto-report in manual SCORM mode', () => {
            setupLastQuestion({ isScorm: 2 });

            dmol.answerQuestion(instance);

            expect(reported).toEqual([]);
            // The flag still rises: the attempt is over either way, and the
            // learner's own send button has to carry the completion.
            expect(dmol.options[instance].gameOver).toBe(true);
        });
    });

    // The code opens both modes, but only one of them can be started by it.
    describe('opening with an access code', () => {
        const instance = 0;
        let reported;

        function setupCoded(activityMode, typed) {
            document.body.innerHTML = `
                <div id="dmolpMainContainer-${instance}">
                    <div id="dmolpCodeAccessDiv-${instance}"></div>
                    <div id="dmolpMesajeAccesCodeE-${instance}"></div>
                    <a id="dmolpLinkMaximize-${instance}" href="#"></a>
                    <input id="dmolpCodeAccessE-${instance}" value="${typed}">
                </div>`;
            dmol.options[instance] = {
                main: `dmolpMainContainer-${instance}`,
                isScorm: 1,
                activityMode,
                // initShowMode raises this at load in presentation mode; the
                // quiz waits for its start.
                gameStarted: activityMode === 'show',
                gameOver: false,
                visiteds: 0,
                showCurrentIndex: 0,
                selectsGame: [{}, {}],
                itinerary: { codeAccess: 'abre', showCodeAccess: true },
                msgs: { msgYouScore: 'Score' },
            };
            reported = [];
            vi.spyOn(dmol, 'showCubiertaOptions').mockImplementation(() => {});
            vi.spyOn(dmol, 'startGame').mockImplementation(() => {});
            vi.spyOn(dmol, 'sendScore').mockImplementation((auto, i) => {
                reported.push({
                    auto,
                    gameOver: dmol.options[i].gameOver,
                    scorerp: dmol.getScoreRP(i),
                });
            });
        }

        afterEach(() => {
            document.body.innerHTML = '';
            vi.restoreAllMocks();
        });

        it('starts the quiz, which publishes through its first question', () => {
            setupCoded('quiz', 'AbrE');

            dmol.enterCodeAccess(instance);

            expect(dmol.startGame).toHaveBeenCalledWith(instance);
        });

        // startGame returns early on a presentation — that early return is what
        // keeps the quiz interface off it — so the report has to come from here.
        it('publishes the opening mark of a presentation itself', () => {
            setupCoded('show', 'abre');

            dmol.enterCodeAccess(instance);

            expect(dmol.startGame).not.toHaveBeenCalled();
            expect(reported).toEqual([
                // One model of two seen, and nothing finished yet.
                { auto: true, gameOver: false, scorerp: 5 },
            ]);
        });

        it('reports nothing when the code is wrong', () => {
            setupCoded('show', 'nope');

            dmol.enterCodeAccess(instance);

            expect(reported).toEqual([]);
            expect($(`#dmolpCodeAccessE-${instance}`).val()).toBe('');
        });

        it('does not auto-report a presentation in manual SCORM mode', () => {
            setupCoded('show', 'abre');
            dmol.options[instance].isScorm = 2;

            dmol.enterCodeAccess(instance);

            expect(reported).toEqual([]);
        });
    });
});
