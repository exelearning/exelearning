/**
 * Unit tests for TriviExt iDevice export/runtime.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    let modifiedCode = code.replace(/var\s+\$eXeTrivial\s*=/, 'global.$eXeTrivial =');
    modifiedCode = modifiedCode.replace(
        /\$\(function\s*\(\)\s*\{\s*\$eXeTrivial\.init\(\);\s*\}\);?/g,
        ''
    );
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeTrivial;
}

function loadTrivial() {
    global.$eXeTrivial = undefined;
    global.$exeDevices.iDevice.gamification.media = {
        stopSound: vi.fn(),
        stopVideo: vi.fn(),
    };

    const code = readFileSync(join(__dirname, 'trivial.js'), 'utf-8');
    return loadExportIdevice(code);
}

function createGameOptions(overrides = {}) {
    return {
        activePlayer: 0,
        gameOver: false,
        gamers: [
            {
                cheeses: [],
                name: 'Player',
                quesos: [],
                score: 0,
            },
        ],
        isScorm: 1,
        numeroJugadores: 1,
        numeroTemas: 2,
        quesos: [0, 12],
        ...overrides,
    };
}

describe('TriviExt score saving', () => {
    it('does not send SCORM score when leaving the page', () => {
        const code = readFileSync(join(__dirname, 'trivial.js'), 'utf-8');
        const loadGameSource = code.slice(
            code.indexOf('loadGame: function'),
            code.indexOf('positionPointer: function')
        );
        const unloadHandlers = [
            ...loadGameSource.matchAll(
                /\$\(window\)\.on\('unload\.eXeTrivial beforeunload\.eXeTrivial', function \(\) \{([\s\S]*?)\s*\}\);/g
            ),
        ];

        expect(unloadHandlers.some((handler) => handler[1].includes('sendScore'))).toBe(false);
        expect(loadGameSource).not.toMatch(/endScorm\(\$eXeTrivial\.mScorm\)/);
        expect(loadGameSource).toContain('$eXeTrivial.saveDataStorage(instance);');
    });

    it('loads legacy manual SCORM mode as automatic mode', () => {
        const code = readFileSync(join(__dirname, 'trivial.js'), 'utf-8');

        expect(code).toContain('mOptions.isScorm = mOptions.isScorm === 2 ? 1 : mOptions.isScorm;');
    });

    it('saves automatic SCORM score after an incorrect completed question', () => {
        const $eXeTrivial = loadTrivial();
        $eXeTrivial.options[0] = createGameOptions();
        $eXeTrivial.changePlayer = vi.fn();
        $eXeTrivial.activeDice = vi.fn();
        $eXeTrivial.loadGameBoard = vi.fn();
        $eXeTrivial.sendScore = vi.fn();
        $eXeTrivial.saveEvaluation = vi.fn();
        $eXeTrivial.saveDataStorage = vi.fn();

        $eXeTrivial.questionAnswer(false, 0);

        expect($eXeTrivial.sendScore).toHaveBeenCalledTimes(1);
        expect($eXeTrivial.sendScore).toHaveBeenCalledWith(true, 0);
        expect($eXeTrivial.saveEvaluation).toHaveBeenCalledWith(0);
        expect($eXeTrivial.saveDataStorage).toHaveBeenCalledWith(0);
    });

    it('saves automatic SCORM score after a correct completed question from the common flow', () => {
        const $eXeTrivial = loadTrivial();
        $eXeTrivial.options[0] = createGameOptions();
        $eXeTrivial.correctAnswer = vi.fn(() => {
            $eXeTrivial.options[0].gamers[0].score = 1;
        });
        $eXeTrivial.sendScore = vi.fn();
        $eXeTrivial.saveEvaluation = vi.fn();
        $eXeTrivial.saveDataStorage = vi.fn();

        $eXeTrivial.questionAnswer(true, 0);

        expect($eXeTrivial.correctAnswer).toHaveBeenCalledWith(0);
        expect($eXeTrivial.sendScore).toHaveBeenCalledTimes(1);
        expect($eXeTrivial.sendScore).toHaveBeenCalledWith(true, 0);
        expect($eXeTrivial.saveEvaluation).toHaveBeenCalledWith(0);
    });

    it('does not duplicate the final SCORM save when the question already ended the game', () => {
        const $eXeTrivial = loadTrivial();
        $eXeTrivial.options[0] = createGameOptions();
        $eXeTrivial.correctAnswer = vi.fn(() => {
            $eXeTrivial.options[0].gameOver = true;
        });
        $eXeTrivial.sendScore = vi.fn();
        $eXeTrivial.saveEvaluation = vi.fn();
        $eXeTrivial.saveDataStorage = vi.fn();

        $eXeTrivial.questionAnswer(true, 0);

        expect($eXeTrivial.sendScore).not.toHaveBeenCalled();
        expect($eXeTrivial.saveEvaluation).toHaveBeenCalledWith(0);
    });

    it('calculates the final completed score as ten when all cheeses are collected', () => {
        const $eXeTrivial = loadTrivial();
        const mOptions = createGameOptions({
            gamers: [
                {
                    cheeses: [0, 1],
                    name: 'Player',
                    quesos: [0, 12],
                    score: 111,
                },
            ],
        });

        expect($eXeTrivial.getScore(mOptions)).toBe(10);
    });

    it('calculates a partial score when not all topics are completed', () => {
        const $eXeTrivial = loadTrivial();
        const mOptions = createGameOptions({
            numeroTemas: 2,
            gamers: [{ cheeses: [], name: 'Player', quesos: [], score: 11 }],
        });

        // points * 10 / (numeroTemas * 10 + numeroTemas) = 110 / 22 = 5
        expect($eXeTrivial.getScore(mOptions)).toBe(5);
    });

    it('caps the partial score at ten', () => {
        const $eXeTrivial = loadTrivial();
        const mOptions = createGameOptions({
            numeroTemas: 2,
            gamers: [{ cheeses: [], name: 'Player', quesos: [], score: 300 }],
        });

        expect($eXeTrivial.getScore(mOptions)).toBe(10);
    });

    it('persists the per-question score only while the game is not over (saveQuestionScore)', () => {
        const $eXeTrivial = loadTrivial();
        $eXeTrivial.options[0] = createGameOptions({ isScorm: 1, gameOver: false });
        $eXeTrivial.sendScore = vi.fn();
        $eXeTrivial.saveEvaluation = vi.fn();

        $eXeTrivial.saveQuestionScore(0);

        expect($eXeTrivial.sendScore).toHaveBeenCalledWith(true, 0);
        expect($eXeTrivial.saveEvaluation).toHaveBeenCalledWith(0);
    });

    it('does not re-send the per-question score once the game is over', () => {
        const $eXeTrivial = loadTrivial();
        $eXeTrivial.options[0] = createGameOptions({ isScorm: 1, gameOver: true });
        $eXeTrivial.sendScore = vi.fn();
        $eXeTrivial.saveEvaluation = vi.fn();

        $eXeTrivial.saveQuestionScore(0);

        expect($eXeTrivial.sendScore).not.toHaveBeenCalled();
        expect($eXeTrivial.saveEvaluation).toHaveBeenCalledWith(0);
    });
});
