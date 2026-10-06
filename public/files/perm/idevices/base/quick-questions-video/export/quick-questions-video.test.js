/**
 * Unit tests for the Video test (quick-questions-video) iDevice export runtime.
 *
 * startGame() cleared the counters without telling the LMS, and left gameOver
 * standing from the previous attempt, so pressing start showed neither a zero
 * nor a status change and the first answer reported the fresh attempt as
 * already finished.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load the export runtime and expose $quickquestionsvideo globally, without
 * the auto-init call at the end of the file.
 */
function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$quickquestionsvideo\s*=/, 'global.$quickquestionsvideo =')
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$quickquestionsvideo\.init\(\);\s*\}\);?/g,
            ''
        );

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$quickquestionsvideo;
}

describe('quick-questions-video iDevice export', () => {
    let $quickquestionsvideo;

    beforeEach(() => {
        global.$quickquestionsvideo = undefined;
        const code = readFileSync(
            join(__dirname, 'quick-questions-video.js'),
            'utf-8'
        );
        $quickquestionsvideo = loadExportIdevice(code);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('SCORM reporting on start', () => {
        function setupGame(overrides = {}) {
            document.body.innerHTML = `
                <div id="vquextMainContainer-0">
                    <div id="vquextGameMinimize-0"></div>
                    <div id="vquextGameContainer-0">
                        <div class="VQXTP-StartGame"></div>
                    </div>
                    <div id="vquextProgressBar-0"></div>
                    <div id="vquextVideo-0"></div>
                    <div id="vquextPShowClue-0"></div>
                    <div id="vquextQuestionDiv-0"></div>
                    <div id="vquextQuestion-0"></div>
                    <div id="vquextPNumber-0"></div>
                    <div id="vquextGamerOver-0"></div>
                    <div id="vquextPHits-0"></div>
                    <div id="vquextPErrors-0"></div>
                    <div id="vquextPScore-0"></div>
                    <div id="vquextPTime-0"></div>
                </div>`;
            $quickquestionsvideo.options[0] = Object.assign(
                {
                    main: 'vquextMainContainer-0',
                    isScorm: 1,
                    gameStarted: false,
                    gameOver: false,
                    hits: 0,
                    errors: 0,
                    score: 0,
                    scoreGame: 0,
                    scoreTotal: 4,
                    numberQuestions: 2,
                    numberLives: 3,
                    questionsGame: [{ answerScore: 1 }, { answerScore: 1 }],
                    idVideoQuExt: '',
                    startVideoQuExt: 0,
                    endVideoQuExt: 10,
                    msgs: { msgYouScore: 'Score' },
                },
                overrides
            );
            vi.spyOn($quickquestionsvideo, 'createPointsVideo').mockImplementation(() => {});
            vi.spyOn($quickquestionsvideo, 'showNavigationButtons').mockImplementation(() => {});
            vi.spyOn($quickquestionsvideo, 'updateLives').mockImplementation(() => {});
            vi.spyOn($quickquestionsvideo, 'showQuestion').mockImplementation(() => {});
            vi.spyOn($quickquestionsvideo, 'startVideo').mockImplementation(() => {});
            vi.spyOn($quickquestionsvideo, 'uptateTime').mockImplementation(() => {});
            vi.spyOn($quickquestionsvideo, 'sendScore').mockImplementation(() => {});
        }

        it('saveScormScore reports only in automatic SCORM mode', () => {
            setupGame({ isScorm: 1 });
            $quickquestionsvideo.saveScormScore(0);
            expect($quickquestionsvideo.sendScore).toHaveBeenCalledWith(true, 0);

            $quickquestionsvideo.sendScore.mockClear();
            $quickquestionsvideo.options[0].isScorm = 2;
            $quickquestionsvideo.saveScormScore(0);
            expect($quickquestionsvideo.sendScore).not.toHaveBeenCalled();
        });

        // The defect: pressing start showed neither a zero nor a status change
        // in the LMS menu.
        it('publishes the cleared state when a finished game is restarted', () => {
            setupGame({ hits: 2, errors: 1, scoreGame: 4, gameOver: true });
            let stateWhenReported;
            $quickquestionsvideo.sendScore.mockImplementation(() => {
                const { hits, errors, scoreGame, gameOver, gameStarted } =
                    $quickquestionsvideo.options[0];
                stateWhenReported = { hits, errors, scoreGame, gameOver, gameStarted };
            });

            $quickquestionsvideo.startGame(0);

            expect(stateWhenReported).toEqual({
                hits: 0,
                errors: 0,
                scoreGame: 0,
                // The status half of the report: left standing from the
                // finished attempt, this reported the fresh game as complete.
                gameOver: false,
                // sendScoreNew ignores a game that reports as neither started
                // nor over.
                gameStarted: true,
            });
        });

        it('does not report a game that was already running', () => {
            setupGame({ gameStarted: true });

            $quickquestionsvideo.startGame(0);

            expect($quickquestionsvideo.sendScore).not.toHaveBeenCalled();
        });
    });

    // The editor never reloads the document between pages, and a game's ids
    // are numbered by position: the next page's first game takes the ids this
    // one had. The clock driving the video used to find that game by id and
    // drive it, stopping its video at this one's questions.
    describe('the clock of a game', () => {
        const instance = 0;

        beforeEach(() => {
            vi.useFakeTimers();
            document.body.innerHTML = `<div id="vquextMainContainer-${instance}"></div>`;
            $quickquestionsvideo.options = [
                {
                    gameStarted: false,
                    videoType: 1,
                    localPlayer: { currentTime: 5 },
                    questionsGame: [{ pointVideo: 100 }],
                    startVideoQuExt: 0,
                    endVideoQuExt: 1000,
                    numberQuestions: 1,
                    numberLives: 3,
                },
            ];
            for (const method of [
                'createPointsVideo',
                'showNavigationButtons',
                'updateLives',
                'showQuestion',
                'startVideo',
                'uptateTime',
                'updataProgressBar',
                'saveScormScore',
                'gameOver',
            ]) {
                vi.spyOn($quickquestionsvideo, method).mockImplementation(() => {});
            }
        });

        it('follows its own video', () => {
            $quickquestionsvideo.startGame(instance);

            vi.advanceTimersByTime(3000);

            expect($quickquestionsvideo.updataProgressBar).toHaveBeenCalledTimes(3);
            expect($quickquestionsvideo.updataProgressBar).toHaveBeenLastCalledWith(5, instance);
        });

        it("leaves the next page's game alone, though it takes the same ids", () => {
            $quickquestionsvideo.startGame(instance);
            vi.advanceTimersByTime(1000);

            // The author moves to another page, whose first game is numbered the same.
            document.body.innerHTML = `<div id="vquextMainContainer-${instance}"></div>`;
            $quickquestionsvideo.options[instance] = { gameStarted: true, stateReproduction: 0 };
            $quickquestionsvideo.updataProgressBar.mockClear();
            vi.advanceTimersByTime(5000);

            expect($quickquestionsvideo.updataProgressBar).not.toHaveBeenCalled();
            expect($quickquestionsvideo.gameOver).not.toHaveBeenCalled();
        });
    });
});
