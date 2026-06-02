import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(
            /var\s+\$eXeSeleccionaMedias\s*=/,
            'global.$eXeSeleccionaMedias ='
        )
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$eXeSeleccionaMedias\.init\(\);\s*\}\);?/g,
            ''
        );
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeSeleccionaMedias;
}

describe('select-media-files iDevice export', () => {
    let $eXeSeleccionaMedias;
    let originalMedia;
    let originalReport;
    let originalSendScoreNew;

    beforeEach(() => {
        global.$eXeSeleccionaMedias = undefined;
        const code = readFileSync(join(__dirname, 'select-media-files.js'), 'utf-8');
        $eXeSeleccionaMedias = loadExportIdevice(code);

        originalMedia = global.$exeDevices.iDevice.gamification.media;
        originalReport = global.$exeDevices.iDevice.gamification.report;
        originalSendScoreNew =
            global.$exeDevices.iDevice.gamification.scorm.sendScoreNew;
        global.$exeDevices.iDevice.gamification.media = {
            stopSound: vi.fn(),
        };
        global.$exeDevices.iDevice.gamification.report = {
            saveEvaluation: vi.fn(),
            updateEvaluationIcon: vi.fn(),
        };
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = vi.fn();
    });

    afterEach(() => {
        global.$exeDevices.iDevice.gamification.media = originalMedia;
        global.$exeDevices.iDevice.gamification.report = originalReport;
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew =
            originalSendScoreNew;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('does not register its own unload or beforeunload SCORM handlers', () => {
        const code = readFileSync(
            join(__dirname, 'select-media-files.js'),
            'utf-8'
        );

        expect(code).not.toMatch(
            /beforeunload|unload\.eXeSeleccionaMedias|endScorm/
        );
    });

    it('does not initialize scorerp to zero on load', () => {
        const code = readFileSync(
            join(__dirname, 'select-media-files.js'),
            'utf-8'
        );

        expect(code).not.toContain('mOption.scorerp = 0');
    });

    it('does not save score while updating an intermediate wrong answer', () => {
        const instance = 0;
        document.body.innerHTML = `
            <div id="slcmpPNumber-${instance}"></div>
            <div id="slcmpPErrors-${instance}"></div>
            <div id="slcmpPScore-${instance}"></div>
            <div id="slcmpPHits-${instance}"></div>
            <div id="slcmpMultimedia-${instance}"></div>
        `;
        $eXeSeleccionaMedias.options[instance] = {
            errors: 0,
            hits: 0,
            isScorm: 1,
            itinerary: { percentageClue: 80 },
            numberQuestions: 2,
            phrasesGame: [{}, {}],
            score: 0,
            showSolution: false,
        };
        vi.spyOn($eXeSeleccionaMedias, 'nextPhrase').mockImplementation(() => {});

        $eXeSeleccionaMedias.updateScore(false, instance);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).not.toHaveBeenCalled();
        expect(global.$exeDevices.iDevice.gamification.report.saveEvaluation).not.toHaveBeenCalled();
        expect($eXeSeleccionaMedias.nextPhrase).toHaveBeenCalledWith(instance);
    });

    it('saves score when the player answers correctly', () => {
        const instance = 0;
        document.body.innerHTML = `
            <div id="slcmpCheck-${instance}"></div>
            <div id="slcmpMultimedia-${instance}">
                <div class="SLCMP-GridItem SLCMP-Select"></div>
            </div>
            <div id="slcmpMessage-${instance}"></div>
            <div id="slcmpPNumber-${instance}"></div>
            <div id="slcmpPErrors-${instance}"></div>
            <div id="slcmpPScore-${instance}"></div>
            <div id="slcmpPHits-${instance}"></div>
        `;
        $(`#slcmpMultimedia-${instance} .SLCMP-GridItem`).data('state', true);
        $eXeSeleccionaMedias.options[instance] = {
            active: 0,
            customMessages: false,
            errors: 0,
            hits: 0,
            isScorm: 1,
            itinerary: { percentageClue: 80 },
            msgs: {
                msgAllOK: 'Correct',
            },
            numberQuestions: 1,
            phrasesGame: [{}],
            repeatActivity: true,
            score: 0,
            showSolution: false,
        };

        $eXeSeleccionaMedias.checkQuestion(instance);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                scorerp: 10,
            })
        );
    });

    it('saves score when the player exhausts attempts', () => {
        const instance = 0;
        document.body.innerHTML = `
            <div id="slcmpCheck-${instance}"></div>
            <div id="slcmpMultimedia-${instance}">
                <div class="SLCMP-GridItem"></div>
            </div>
            <div id="slcmpMessage-${instance}"></div>
            <div id="slcmpReboot-${instance}"></div>
            <div id="slcmpPNumber-${instance}"></div>
            <div id="slcmpPErrors-${instance}"></div>
            <div id="slcmpPScore-${instance}"></div>
            <div id="slcmpPHits-${instance}"></div>
        `;
        $(`#slcmpMultimedia-${instance} .SLCMP-GridItem`).data('state', true);
        $eXeSeleccionaMedias.options[instance] = {
            active: 0,
            customMessages: false,
            errors: 0,
            hits: 0,
            intentos: 1,
            isScorm: 1,
            itinerary: { percentageClue: 80 },
            msgs: {
                msgAgain: 'Try again',
                msgFailures: 'Wrong',
            },
            numberQuestions: 1,
            phrasesGame: [{}],
            repeatActivity: true,
            score: 0,
            showSolution: false,
        };
        vi.spyOn($eXeSeleccionaMedias, 'getRetroFeedMessages').mockReturnValue('Wrong');

        $eXeSeleccionaMedias.checkQuestion(instance);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                scorerp: 0,
            })
        );
    });

    it('saves score when the game finishes', () => {
        const instance = 0;
        document.body.innerHTML = `
            <div id="slcmpCubierta-${instance}"></div>
            <div id="slcmpCodeAccessDiv-${instance}"></div>
        `;
        $eXeSeleccionaMedias.options[instance] = {
            errors: 0,
            feedBack: false,
            gameStarted: true,
            hits: 1,
            isScorm: 1,
            msgs: {
                msgYouScore: 'Your score',
            },
            numberQuestions: 2,
            phrasesGame: [{}, {}],
            score: 5,
        };
        vi.spyOn($eXeSeleccionaMedias, 'desactivateHover').mockImplementation(() => {});
        vi.spyOn($eXeSeleccionaMedias, 'showScoreGame').mockImplementation(() => {});
        vi.spyOn($eXeSeleccionaMedias, 'showFeedBack').mockImplementation(() => {});

        $eXeSeleccionaMedias.gameOver(1, instance);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                gameOver: true,
                gameStarted: false,
                scorerp: 5,
            })
        );
    });
});
