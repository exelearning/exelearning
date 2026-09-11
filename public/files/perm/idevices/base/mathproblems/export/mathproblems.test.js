/**
 * Unit tests for the mathproblems iDevice (export/runtime).
 *
 * common.js derives completion from `gameOver === true || auto !== true`, and
 * updateScore reports automatically, so without the flag a page carrying a
 * mathproblems stayed `incomplete` in the LMS however well the learner did:
 * the gameOver() that runs after the reveal delay comes too late for the
 * report that carries the final score.
 */

/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$eXeMathProblems\s*=/, 'global.$eXeMathProblems =')
        .replace(
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
        const code = readFileSync(join(__dirname, 'mathproblems.js'), 'utf-8');
        $eXeMathProblems = loadExportIdevice(code);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('completion on the last question', () => {
        function setupAnswer(overrides) {
            document.body.innerHTML = `
                <div id="mthpMainContainer-0">
                    <div id="mthpPHits-0"></div>
                    <div id="mthpPErrors-0"></div>
                    <div id="mthpPScore-0"></div>
                    <div id="mthpRepeatActivity-0"></div>
                </div>`;
            $eXeMathProblems.initialScore = '';
            $eXeMathProblems.options[0] = Object.assign(
                {
                    id: 0,
                    isScorm: 1,
                    scorm: { repeatActivity: true },
                    gameOver: false,
                    hits: 2,
                    errors: 0,
                    numberQuestions: 3,
                    obtainedClue: false,
                    itinerary: { showClue: false, percentageClue: 0, clueGame: '' },
                    msgs: { msgYouScore: 'Score', msgInformation: 'info' },
                },
                overrides
            );
            vi.spyOn($eXeMathProblems, 'getMessageAnswer').mockReturnValue('');
            vi.spyOn($eXeMathProblems, 'sendScore').mockImplementation(() => {});
            vi.spyOn($eXeMathProblems, 'showMessage').mockImplementation(() => {});
            vi.spyOn($eXeMathProblems, 'saveEvaluation').mockImplementation(() => {});
        }

        it('marks the activity finished when no questions are left', () => {
            // 2 hits + this one = 3 of 3.
            setupAnswer({ hits: 2, errors: 0, numberQuestions: 3 });

            $eXeMathProblems.updateScore(true, 0);

            expect($eXeMathProblems.options[0].gameOver).toBe(true);
        });

        // Running out of questions through errors ends the attempt just the same.
        it('marks it finished when the last question is answered wrongly', () => {
            setupAnswer({ hits: 1, errors: 1, numberQuestions: 3 });

            $eXeMathProblems.updateScore(false, 0);

            expect($eXeMathProblems.options[0].gameOver).toBe(true);
        });

        // An intermediate answer must not close the attempt: the page would go
        // to passed/failed while the learner is still playing.
        it('leaves the activity unfinished while questions remain', () => {
            setupAnswer({ hits: 0, errors: 0, numberQuestions: 3 });

            $eXeMathProblems.updateScore(true, 0);

            expect($eXeMathProblems.options[0].gameOver).toBe(false);
        });

        it('raises the flag before it reports, so the two cannot disagree', () => {
            setupAnswer({ hits: 2, errors: 0, numberQuestions: 3 });
            let flagWhenReported;
            $eXeMathProblems.sendScore.mockImplementation(() => {
                flagWhenReported = $eXeMathProblems.options[0].gameOver;
            });

            $eXeMathProblems.updateScore(true, 0);

            expect($eXeMathProblems.sendScore).toHaveBeenCalledWith(true, 0);
            expect(flagWhenReported).toBe(true);
        });
    });
});
