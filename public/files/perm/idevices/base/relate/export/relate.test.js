import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$eXeRelaciona\s*=/, 'global.$eXeRelaciona =')
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$eXeRelaciona\.init\(\);\s*\}\);?/g,
            ''
        );
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeRelaciona;
}

describe('relate iDevice export', () => {
    let $eXeRelaciona;
    let originalColors;
    let originalMedia;
    let originalReport;
    let originalSendScoreNew;

    beforeEach(() => {
        global.$eXeRelaciona = undefined;
        originalColors = global.$exeDevices.iDevice.gamification.colors;
        global.$exeDevices.iDevice.gamification.colors = {
            backColor: {
                blue: '#3334a1',
                green: '#006641',
                red: '#a2241a',
                white: '#ffffff',
                yellow: '#f3d55a',
            },
            borderColors: {
                blue: '#3334a1',
                green: '#006641',
                red: '#a2241a',
                white: '#ffffff',
                yellow: '#f3d55a',
            },
        };
        const code = readFileSync(join(__dirname, 'relate.js'), 'utf-8');
        $eXeRelaciona = loadExportIdevice(code);

        originalMedia = global.$exeDevices.iDevice.gamification.media;
        originalReport = global.$exeDevices.iDevice.gamification.report;
        originalSendScoreNew =
            global.$exeDevices.iDevice.gamification.scorm.sendScoreNew;

        global.$exeDevices.iDevice.gamification.media = {
            stopSound: vi.fn(),
        };
        global.$exeDevices.iDevice.gamification.report = {
            saveEvaluation: vi.fn(),
        };
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = vi.fn();
    });

    afterEach(() => {
        global.$exeDevices.iDevice.gamification.colors = originalColors;
        global.$exeDevices.iDevice.gamification.media = originalMedia;
        global.$exeDevices.iDevice.gamification.report = originalReport;
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew =
            originalSendScoreNew;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('does not register its own unload or beforeunload SCORM handlers', () => {
        const code = readFileSync(join(__dirname, 'relate.js'), 'utf-8');

        expect(code).not.toMatch(/beforeunload|unload\.eXeRelaciona|endScorm/);
    });

    it('sends the final SCORM score with a completed game state', () => {
        const instance = 0;
        document.body.innerHTML = `
            <div id="rlcCheckButton-${instance}"></div>
            <div id="rlcButtons-${instance}"></div>
            <div id="rlcResetButton-${instance}"></div>
            <div id="rlcMessage-${instance}"></div>
            <div id="rlcPScore-${instance}"></div>
            <div id="rlcPHits-${instance}"></div>
            <div id="rlcPErrors-${instance}"></div>
            <div id="rlcPNumber-${instance}"></div>
            <div id="rlcRepeatActivity-${instance}"></div>
        `;
        $eXeRelaciona.options[instance] = {
            cardsGame: [{}, {}],
            counterClock: 1,
            errors: 0,
            gameOver: false,
            gameStarted: true,
            hits: 0,
            isScorm: 1,
            itinerary: {
                showClue: false,
            },
            linesMap: new Map([
                ['word-1', { correct: true }],
                ['word-2', { correct: false }],
            ]),
            msgs: {
                msgEndGameM: 'Score: %s',
                msgYouScore: 'Your score',
            },
            numberCards: 2,
            realNumberCards: 2,
            score: 0,
        };
        vi.spyOn($eXeRelaciona, 'redibujarLineas').mockImplementation(() => {});

        $eXeRelaciona.gameOver(instance);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                errors: 1,
                gameOver: true,
                gameStarted: false,
                hits: 1,
                scorerp: 5,
            })
        );
        expect(global.$exeDevices.iDevice.gamification.report.saveEvaluation).toHaveBeenCalledWith(
            expect.objectContaining({
                gameOver: true,
                gameStarted: false,
                scorerp: 5,
            }),
            expect.any(Boolean)
        );
    });
});
