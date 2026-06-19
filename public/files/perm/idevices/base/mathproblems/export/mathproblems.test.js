/**
 * Unit tests for Math Problems iDevice export/runtime.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    let modifiedCode = code.replace(
        /var\s+\$eXeMathProblems\s*=/,
        'global.$eXeMathProblems ='
    );
    modifiedCode = modifiedCode.replace(
        /\$\(function\s*\(\)\s*\{\s*\$eXeMathProblems\.init\(\);\s*\}\);?/g,
        ''
    );
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeMathProblems;
}

describe('mathproblems iDevice export', () => {
    let $eXeMathProblems;

    beforeEach(() => {
        global.$eXeMathProblems = undefined;

        const filePath = join(__dirname, 'mathproblems.js');
        const code = readFileSync(filePath, 'utf-8');

        $eXeMathProblems = loadExportIdevice(code);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('newQuestion', () => {
        it('does not save scores when moving to the next question', () => {
            document.body.innerHTML = `
                <input id="mthpEdAnswer-0" value="12">
                <span id="mthpPNumber-0"></span>`;
            $eXeMathProblems.options[0] = {
                activeQuestion: 0,
                numberQuestions: 2,
                questions: [{ time: 10 }, { time: 20 }],
                scorm: {
                    isScorm: 1,
                    repeatActivity: true,
                },
            };
            $eXeMathProblems.initialScore = '';
            $eXeMathProblems.showQuestion = vi.fn();
            $eXeMathProblems.gameOver = vi.fn();
            $eXeMathProblems.sendScore = vi.fn();
            $eXeMathProblems.saveEvaluation = vi.fn();

            $eXeMathProblems.newQuestion(0);

            expect($eXeMathProblems.options[0].activeQuestion).toBe(1);
            expect($eXeMathProblems.options[0].counter).toBe(20);
            expect($eXeMathProblems.options[0].activeCounter).toBe(true);
            expect($('#mthpEdAnswer-0').val()).toBe('');
            expect($('#mthpPNumber-0').text()).toBe('1');
            expect($eXeMathProblems.showQuestion).toHaveBeenCalledWith(1, 0);
            expect($eXeMathProblems.sendScore).not.toHaveBeenCalled();
            expect($eXeMathProblems.saveEvaluation).not.toHaveBeenCalled();
        });
    });

    describe('updateScore', () => {
        it('persists the SCORM score after a correct answer', () => {
            $eXeMathProblems.options[0] = {
                isScorm: 1,
                scorm: { repeatActivity: true },
                hits: 0,
                errors: 0,
                numberQuestions: 4,
            };
            $eXeMathProblems.initialScore = '';
            $eXeMathProblems.getMessageAnswer = vi.fn(() => '');
            $eXeMathProblems.sendScore = vi.fn();
            $eXeMathProblems.saveEvaluation = vi.fn();
            $eXeMathProblems.checkClue = vi.fn();
            $eXeMathProblems.updateGameBoard = vi.fn();
            $eXeMathProblems.showMessage = vi.fn();

            $eXeMathProblems.updateScore(true, 0);

            expect($eXeMathProblems.options[0].hits).toBe(1);
            expect($eXeMathProblems.options[0].score).toBe(2.5);
            expect($eXeMathProblems.sendScore).toHaveBeenCalledWith(true, 0);
            expect($eXeMathProblems.saveEvaluation).toHaveBeenCalledWith(0);
        });
    });

    describe('gameOver', () => {
        it('marks the terminal state and persists the SCORM score', () => {
            global.$exeDevices = {
                iDevice: {
                    gamification: {
                        helpers: { shuffleAds: (arr) => arr },
                    },
                },
            };
            $eXeMathProblems.options[0] = {
                scorm: { isScorm: 1, repeatActivity: true },
                hits: 2,
                numberQuestions: 4,
                score: 5,
                optionsRamdon: false,
                questions: [{}, {}],
                msgs: { msgEndGameM: 'End: %s' },
            };
            $eXeMathProblems.initialScore = '';
            $eXeMathProblems.uptateTime = vi.fn();
            $eXeMathProblems.sendScore = vi.fn();
            $eXeMathProblems.saveEvaluation = vi.fn();
            $eXeMathProblems.showFeedBack = vi.fn();
            $eXeMathProblems.showMessage = vi.fn();
            $eXeMathProblems.loadProblems = vi.fn();

            $eXeMathProblems.gameOver(1, 0);

            expect($eXeMathProblems.options[0].gameStarted).toBe(false);
            expect($eXeMathProblems.options[0].gameOver).toBe(true);
            expect($eXeMathProblems.sendScore).toHaveBeenCalledWith(true, 0);
            expect($eXeMathProblems.saveEvaluation).toHaveBeenCalledWith(0);
        });
    });
});
