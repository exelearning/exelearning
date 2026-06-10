/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function configureGamificationGlobals() {
    global.$exeDevices = {
        iDevice: {
            gamification: {
                colors: {
                    borderColors: {
                        red: '#ff0000',
                        blue: '#0000ff',
                        green: '#00ff00',
                        yellow: '#ffff00',
                    },
                    backColor: {
                        black: '#000000',
                        white: '#ffffff',
                    },
                },
                helpers: {
                    decrypt: (value) => value,
                    isJsonString: (value) => JSON.parse(value),
                    getQuestions: (questions) => questions,
                },
                scorm: {},
                math: {
                    updateLatex: vi.fn(),
                },
                observers: {
                    observeResize: vi.fn(),
                },
            },
        },
    };
}

function loadExportIdevice(code) {
    let modifiedCode = code.replace(/var\s+\$eXeEC\s*=/, 'global.$eXeEC =');
    modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeEC\.init\(\);\s*\}\);?/g, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeEC;
}

describe('electrical-circuits iDevice export', () => {
    let $eXeEC;

    beforeEach(() => {
        global.$eXeEC = undefined;
        configureGamificationGlobals();
        const code = readFileSync(join(__dirname, 'electrical-circuits.js'), 'utf-8');
        $eXeEC = loadExportIdevice(code);
    });

    it('enable starts the game without loading TikZJax', () => {
        const loadGame = vi.spyOn($eXeEC, 'loadGame').mockImplementation(() => {});

        $eXeEC.enable();

        expect(loadGame).toHaveBeenCalled();
        expect(document.querySelector('script[src*="tikzjax"]')).toBeNull();
    });

    it('sanitizes SVG before rendering it', () => {
        document.body.innerHTML = '<div id="elcpTikzPreview-0"></div><div id="elcpCover-0"></div>';
        const question = {
            tikzSvg: `
                <svg width="100" height="50" viewBox="0 0 10 10" onload="alert(1)">
                    <script>alert(1)</script>
                    <foreignObject><div>html</div></foreignObject>
                    <path onclick="alert(1)" href="javascript:alert(1)" d="M0 0"></path>
                </svg>
            `,
        };

        $eXeEC.showTikzCircuit(question, 0);
        const previewHtml = document.getElementById('elcpTikzPreview-0').innerHTML;

        expect(previewHtml).toContain('<svg');
        expect(previewHtml).toContain('viewBox="0 0 10 10"');
        expect(previewHtml).not.toContain('width=');
        expect(previewHtml).not.toContain('height=');
        expect(previewHtml).not.toContain('<script');
        expect(previewHtml).not.toContain('foreignObject');
        expect(previewHtml).not.toContain('onload');
        expect(previewHtml).not.toContain('onclick');
        expect(previewHtml).not.toContain('javascript:');
        expect(document.querySelector('script[type="text/tikz"]')).toBeNull();
    });

    it('does not render from tikzCode when SVG is missing', () => {
        document.body.innerHTML = '<div id="elcpTikzPreview-0"></div><div id="elcpCover-0"></div>';

        $eXeEC.showTikzCircuit({ tikzCode: '\\draw (0,0);', tikzSvg: '' }, 0);

        expect(document.getElementById('elcpTikzPreview-0').innerHTML).toBe('');
        expect(document.querySelector('script[type="text/tikz"]')).toBeNull();
    });

    it('disableWordAnswer locks the word input and its buttons', () => {
        document.body.innerHTML = `
            <input id="elcpEdAnswer-0" type="text">
            <button id="elcpBtnReply-0"></button>
            <button id="elcpBtnMoveOn-0"></button>
        `;

        $eXeEC.disableWordAnswer(0);

        expect(document.getElementById('elcpEdAnswer-0').disabled).toBe(true);
        expect(document.getElementById('elcpBtnReply-0').disabled).toBe(true);
        expect(document.getElementById('elcpBtnMoveOn-0').disabled).toBe(true);
    });

    function setupWordQuestion() {
        document.body.innerHTML = `
            <input id="elcpEdAnswer-0" type="text" value="OHM">
            <button id="elcpBtnReply-0"></button>
            <button id="elcpBtnMoveOn-0"></button>
            <span id="elcpPHits-0"></span>
            <span id="elcpPErrors-0"></span>
        `;
        $eXeEC.options = [
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
        vi.spyOn($eXeEC, 'updateScore').mockImplementation(() => {});
        vi.spyOn($eXeEC, 'sameQuestion').mockReturnValue(false);
        vi.spyOn($eXeEC, 'newQuestion').mockImplementation(() => {});
    }

    it('answerQuestion disables the word input for word questions', () => {
        vi.useFakeTimers();
        setupWordQuestion();

        $eXeEC.answerQuestion(0);

        expect(document.getElementById('elcpEdAnswer-0').disabled).toBe(true);
        vi.useRealTimers();
    });

    it('answerQuestionBoard disables the word input for word questions', () => {
        vi.useFakeTimers();
        setupWordQuestion();

        $eXeEC.answerQuestionBoard(true, 0);

        expect(document.getElementById('elcpEdAnswer-0').disabled).toBe(true);
        vi.useRealTimers();
    });

    it('reveals the full solution word when show solution is on (ignoring sameQuestion)', () => {
        vi.useFakeTimers();
        setupWordQuestion();
        $eXeEC.options[0].showSolution = true;
        // Force the buggy guard to report "same question" to prove it no longer
        // blocks revealing the word.
        $eXeEC.sameQuestion.mockReturnValue(true);
        const drawPhrase = vi
            .spyOn($eXeEC, 'drawPhrase')
            .mockImplementation(() => {});

        $eXeEC.answerQuestion(0);

        expect(drawPhrase).toHaveBeenCalled();
        const args = drawPhrase.mock.calls[0];
        expect(args[0]).toBe('OHM'); // the correct solution word
        expect(args[2]).toBe(100); // fully revealed
        vi.useRealTimers();
    });

    it('ramdonOptions shuffles order questions and remaps the solution sequence', () => {
        // Deterministic "shuffle": reverse the array.
        global.$exeDevices.iDevice.gamification.helpers.shuffleAds = (arr) => [
            ...arr,
        ].reverse();
        $eXeEC.options = [
            {
                question: {
                    typeSelect: 1,
                    options: ['A1', 'B2', 'C3', 'D4'],
                    solution: 'ACBD', // correct order: A1, C3, B2, D4
                },
            },
        ];

        $eXeEC.ramdonOptions(0);

        const q = $eXeEC.options[0].question;
        expect(q.options).toEqual(['D4', 'C3', 'B2', 'A1']);
        // The new positions must still read out as A1, C3, B2, D4 in order.
        expect(q.solution).toBe('DBCA');
    });

    it('shows the order solution even when sameQuestion would block it', () => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <span id="elcpPHits-0"></span>
            <span id="elcpPErrors-0"></span>
        `;
        $eXeEC.options = [
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
        vi.spyOn($eXeEC, 'updateScore').mockImplementation(() => {});
        vi.spyOn($eXeEC, 'sameQuestion').mockReturnValue(true);
        const drawSolution = vi
            .spyOn($eXeEC, 'drawSolution')
            .mockImplementation(() => {});
        vi.spyOn($eXeEC, 'newQuestion').mockImplementation(() => {});

        $eXeEC.answerQuestion(0);

        expect(drawSolution).toHaveBeenCalledWith(0);
        vi.useRealTimers();
    });

    it('loadDataGame preserves tikzSvg and does not add tikzSvgHash', () => {
        const data = {
            text: () =>
                JSON.stringify({
                    selectsGame: [
                        {
                            tikzCode: '\\draw (0,0);',
                            tikzSvg: '<svg viewBox="0 0 10 10"></svg>',
                            customScore: 2,
                        },
                    ],
                    percentajeQuestions: 100,
                    msgs: {},
                }),
        };

        const loaded = $eXeEC.loadDataGame(data);

        expect(loaded.selectsGame[0].tikzSvg).toBe('<svg viewBox="0 0 10 10"></svg>');
        expect(loaded.selectsGame[0]).not.toHaveProperty('tikzSvgHash');
    });
});
