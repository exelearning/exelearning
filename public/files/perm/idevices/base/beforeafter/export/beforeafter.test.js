/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$eXeBeforeAfter\s*=/, 'global.$eXeBeforeAfter =')
        .replace(/\$\(function\s*\(\)\s*\{\s*\$eXeBeforeAfter\.init\(\);\s*\}\);?/g, '');

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeBeforeAfter;
}

describe('beforeafter iDevice export', () => {
    let $eXeBeforeAfter;
    let originalColors;
    let originalReport;
    let originalSendScoreNew;

    beforeEach(() => {
        global.$eXeBeforeAfter = undefined;
        originalColors = global.$exeDevices.iDevice.gamification.colors;
        originalReport = global.$exeDevices.iDevice.gamification.report;
        originalSendScoreNew = global.$exeDevices.iDevice.gamification.scorm.sendScoreNew;

        global.$exeDevices.iDevice.gamification.colors = {
            backColor: {
                black: '#000000',
                white: '#ffffff',
            },
            borderColors: {
                blue: '#3334a1',
                green: '#006641',
                red: '#a2241a',
                yellow: '#f3d55a',
            },
        };
        global.$exeDevices.iDevice.gamification.report = {
            saveEvaluation: vi.fn(),
        };
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = vi.fn();

        const code = readFileSync(join(__dirname, 'beforeafter.js'), 'utf-8');
        $eXeBeforeAfter = loadExportIdevice(code);
    });

    afterEach(() => {
        global.$exeDevices.iDevice.gamification.colors = originalColors;
        global.$exeDevices.iDevice.gamification.report = originalReport;
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = originalSendScoreNew;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('does not register unload or beforeunload SCORM handlers', () => {
        const code = readFileSync(join(__dirname, 'beforeafter.js'), 'utf-8');

        expect(code).not.toMatch(/beforeunload|unload\.eXeBeforeAfter|endScorm/);
    });

    it('sends the SCORM score from the visited cards', () => {
        $eXeBeforeAfter.options[0] = {
            cardsGame: [{}, {}, {}, {}],
            gameOver: false,
            gameStarted: true,
            visiteds: 1,
        };

        $eXeBeforeAfter.sendScore(true, 0);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                gameOver: false,
                gameStarted: true,
                scorerp: 5,
            }),
        );
    });

    it('starts the game and saves the initial SCORM score', () => {
        document.body.innerHTML = `
            <div id="bfafCubierta-0"></div>
            <button id="bfafStartGame-0"></button>
        `;
        $eXeBeforeAfter.options[0] = {
            cardsGame: [{}, {}],
            gameOver: true,
            gameStarted: false,
            isScorm: 1,
            itinerary: {
                showClue: false,
            },
            msgs: {},
            obtainedClue: true,
            score: 10,
            visiteds: 0,
        };
        vi.spyOn($eXeBeforeAfter, 'showClue').mockImplementation(() => {});

        $eXeBeforeAfter.startGame(0);

        expect($eXeBeforeAfter.options[0]).toEqual(
            expect.objectContaining({
                gameOver: false,
                gameStarted: true,
                hits: 0,
                obtainedClue: false,
                scorerp: 5,
                score: 0,
            }),
        );
        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                gameOver: false,
                gameStarted: true,
                scorerp: 5,
            }),
        );
        expect(global.$exeDevices.iDevice.gamification.report.saveEvaluation).toHaveBeenCalledWith(
            expect.objectContaining({
                scorerp: 5,
            }),
            expect.any(Boolean),
        );
    });
});
