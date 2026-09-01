/**
 * Unit tests for the relate iDevice (export/runtime).
 *
 * reboot() and startGame() cleared hits, errors and gameOver without telling
 * the LMS, so the menu kept the finished attempt's grade and its terminal
 * status until the learner checked the board again.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load the export runtime and expose $eXeRelaciona globally, without the
 * auto-init call at the end of the file.
 */
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

    beforeEach(() => {
        global.$eXeRelaciona = undefined;
        // Read at load time, and absent from the shared stub. Added here
        // rather than there: it is this iDevice that needs it.
        global.$exeDevices.iDevice.gamification.colors = {
            borderColors: { red: 'red', green: 'green', blue: 'blue' },
        };
        const code = readFileSync(join(__dirname, 'relate.js'), 'utf-8');
        $eXeRelaciona = loadExportIdevice(code);
    });

    afterEach(() => {
        delete global.$exeDevices.iDevice.gamification.colors;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('SCORM reporting when a game starts or restarts', () => {
        function setupGame(overrides = {}) {
            document.body.innerHTML = `
                <div id="rlcMainContainer-0">
                    <div id="rlcContainerGame-0"></div>
                    <div id="rlcGameContainer-0"></div>
                    <div id="rlcButtons-0"></div>
                    <div id="rlcResetButton-0"></div>
                    <div id="rlcCheckButton-0"></div>
                    <div id="rlcMessage-0"></div>
                    <div id="rlcPShowClue-0"></div>
                    <div id="rlcShowClue-0"></div>
                    <div id="rlcPHits-0"></div>
                    <div id="rlcPErrors-0"></div>
                    <div id="rlcCubierta-0"></div>
                    <div id="rlcStartGame-0"></div>
                    <div id="rlcImgTime-0"></div>
                    <div id="rlcPTime-0"></div>
                </div>`;
            $eXeRelaciona.options[0] = Object.assign(
                {
                    main: 'rlcMainContainer-0',
                    isScorm: 1,
                    type: 0,
                    time: 0,
                    gameStarted: false,
                    gameOver: false,
                    hits: 0,
                    errors: 0,
                    score: 0,
                    active: 0,
                    obtainedClue: false,
                    realNumberCards: 4,
                    linesMap: new Map(),
                    itinerary: { showClue: false },
                    msgs: { msgYouScore: 'Score' },
                },
                overrides
            );
            vi.spyOn($eXeRelaciona, 'rebootCards').mockImplementation(() => {});
            vi.spyOn($eXeRelaciona, 'showScoreGame').mockImplementation(
                () => {}
            );
            vi.spyOn($eXeRelaciona, 'ajustarCanvas').mockImplementation(
                () => {}
            );
            vi.spyOn($eXeRelaciona, 'sendScore').mockImplementation(() => {});
        }

        it('saveScormScore reports only in automatic SCORM mode', () => {
            setupGame({ isScorm: 1 });
            $eXeRelaciona.saveScormScore(0);
            expect($eXeRelaciona.sendScore).toHaveBeenCalledWith(true, 0);

            $eXeRelaciona.sendScore.mockClear();
            $eXeRelaciona.options[0].isScorm = 2;
            $eXeRelaciona.saveScormScore(0);
            expect($eXeRelaciona.sendScore).not.toHaveBeenCalled();
        });

        // The defect: the Reiniciar link cleared the board, but the LMS menu
        // kept the finished attempt's grade and its terminal status.
        it('publishes the cleared state when the board is restarted', () => {
            setupGame({ hits: 4, errors: 2, gameOver: true });
            let stateWhenReported;
            $eXeRelaciona.sendScore.mockImplementation(() => {
                const { hits, errors, gameOver, gameStarted } =
                    $eXeRelaciona.options[0];
                stateWhenReported = { hits, errors, gameOver, gameStarted };
            });

            $eXeRelaciona.reboot(0);

            expect(stateWhenReported).toEqual({
                hits: 0,
                errors: 0,
                gameOver: false,
                // sendScoreNew ignores a game that reports as neither started
                // nor over, so the restart has to be marked as in progress
                // before the report goes out.
                gameStarted: true,
            });
        });

        it('publishes the cleared state when a game starts', () => {
            setupGame({ hits: 3, gameOver: true });
            let stateWhenReported;
            $eXeRelaciona.sendScore.mockImplementation(() => {
                const { hits, gameOver, gameStarted } =
                    $eXeRelaciona.options[0];
                stateWhenReported = { hits, gameOver, gameStarted };
            });

            $eXeRelaciona.startGame(0);

            expect(stateWhenReported).toEqual({
                hits: 0,
                gameOver: false,
                gameStarted: true,
            });
        });

        it('does not start a game that was already running', () => {
            setupGame({ gameStarted: true });

            $eXeRelaciona.startGame(0);

            expect($eXeRelaciona.sendScore).not.toHaveBeenCalled();
        });
    });
});
