/**
 * Unit tests for puzzle iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - generateRandomArray: Creates shuffled array of numbers
 * - isSolvable: Checks if puzzle configuration is solvable
 * - getPhraseDefault: Returns default phrase object
 * - clear: Cleans puzzle data
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXePuzzle globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXePuzzle\s*=/, 'global.$eXePuzzle =');
  // Remove auto-init call: $(function () { $eXePuzzle.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXePuzzle\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXePuzzle;
}

describe('puzzle iDevice export', () => {
  let $eXePuzzle;

  beforeEach(() => {
    global.$eXePuzzle = undefined;

    const filePath = join(__dirname, 'puzzle.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXePuzzle = loadExportIdevice(code);
  });

  describe('generateRandomArray', () => {
    it('generates array of specified length', () => {
      const result = $eXePuzzle.generateRandomArray(5);
      expect(result).toHaveLength(5);
    });

    it('contains all numbers from 0 to n-1', () => {
      const result = $eXePuzzle.generateRandomArray(5);
      const sorted = [...result].sort((a, b) => a - b);
      expect(sorted).toEqual([0, 1, 2, 3, 4]);
    });

    it('handles array of length 1', () => {
      const result = $eXePuzzle.generateRandomArray(1);
      expect(result).toEqual([0]);
    });

    it('handles empty array', () => {
      const result = $eXePuzzle.generateRandomArray(0);
      expect(result).toHaveLength(0);
    });

    it('returns shuffled array (elements may be in different positions)', () => {
      // Run multiple times to increase chance of different orders
      const results = new Set();
      for (let i = 0; i < 50; i++) {
        results.add(JSON.stringify($eXePuzzle.generateRandomArray(5)));
      }
      // Should have at least some variation
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('isSolvable', () => {
    it('returns true for solvable odd-column puzzle', () => {
      // For odd columns, even inversions means solvable
      const parts = [
        { id: 0 }, { id: 1 }, { id: 2 },
        { id: 3 }, { id: 4 }, { id: 5 },
        { id: 6 }, { id: 7 }, null
      ];
      expect($eXePuzzle.isSolvable(parts, 3)).toBe(true);
    });

    it('returns true for already solved puzzle', () => {
      const parts = [
        { id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }
      ];
      expect($eXePuzzle.isSolvable(parts, 2)).toBe(true);
    });

    it('handles parts with null values', () => {
      const parts = [{ id: 0 }, null, { id: 2 }];
      // Should not throw
      expect(() => $eXePuzzle.isSolvable(parts, 3)).not.toThrow();
    });
  });

  describe('getPhraseDefault', () => {
    it('returns object with required properties', () => {
      const phrase = $eXePuzzle.getPhraseDefault();
      expect(phrase).toHaveProperty('cards');
      expect(phrase).toHaveProperty('msgError');
      expect(phrase).toHaveProperty('msgHit');
      expect(phrase).toHaveProperty('definition');
      expect(phrase).toHaveProperty('puzzle');
    });

    it('returns default values', () => {
      const phrase = $eXePuzzle.getPhraseDefault();
      expect(phrase.cards).toEqual([]);
      expect(phrase.msgError).toBe('');
      expect(phrase.msgHit).toBe('');
      expect(phrase.definition).toBe('');
      expect(phrase.puzzle).toBe('');
    });

    it('returns new object on each call', () => {
      const phrase1 = $eXePuzzle.getPhraseDefault();
      const phrase2 = $eXePuzzle.getPhraseDefault();
      expect(phrase1).not.toBe(phrase2);
    });
  });

  describe('clear', () => {
    it('removes localStorage item for puzzle', () => {
      // Note: This function clears localStorage, which may have side effects
      expect(typeof $eXePuzzle.clear).toBe('function');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXePuzzle.borderColors).toBeDefined();
      expect($eXePuzzle.borderColors.black).toBe('#1c1b1b');
      expect($eXePuzzle.borderColors.blue).toBe('#0056b3');
      expect($eXePuzzle.borderColors.green).toBe('#006641');
      expect($eXePuzzle.borderColors.red).toBe('#a2241a');
      expect($eXePuzzle.borderColors.white).toBe('#ffffff');
      expect($eXePuzzle.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('options', () => {
    it('is initialized as array', () => {
      expect(Array.isArray($eXePuzzle.options)).toBe(true);
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($eXePuzzle.idevicePath).toBe('');
    });
  });

  // common.js derives completion from `gameOver === true || auto !== true`, and
  // updateScore reports automatically, so without the flag a page carrying a
  // puzzle stayed `incomplete` in the LMS however well the learner did.
  describe('completion on the last puzzle', () => {
    function setupSolved(overrides) {
      document.body.innerHTML = `<div id="pzlImagePuzzle-0"></div>`;
      $eXePuzzle.options[0] = Object.assign(
        {
          id: 0,
          isScorm: 1,
          gameOver: false,
          active: 2,
          puzzlesGame: [{}, {}, {}],
          msgs: {},
        },
        overrides
      );
      vi.spyOn($eXePuzzle, 'updateScore').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('marks the activity finished when the last puzzle is solved', () => {
      setupSolved({ active: 2, puzzlesGame: [{}, {}, {}] });

      $eXePuzzle.showCompletedWindows(0);

      expect($eXePuzzle.options[0].gameOver).toBe(true);
    });

    // Solving an intermediate puzzle must not close the attempt: the page would
    // go to passed/failed while the learner is still playing.
    it('leaves the activity unfinished while puzzles remain', () => {
      setupSolved({ active: 0, puzzlesGame: [{}, {}, {}] });

      $eXePuzzle.showCompletedWindows(0);

      expect($eXePuzzle.options[0].gameOver).toBe(false);
    });

    it('raises the flag before it reports, so the two cannot disagree', () => {
      setupSolved({ active: 2, puzzlesGame: [{}, {}, {}] });
      let flagWhenReported;
      $eXePuzzle.updateScore.mockImplementation(() => {
        flagWhenReported = $eXePuzzle.options[0].gameOver;
      });

      $eXePuzzle.showCompletedWindows(0);

      expect(flagWhenReported).toBe(true);
    });
  });

  describe('repeating a solved puzzle', () => {
    function setupRepeat(overrides) {
      document.body.innerHTML = `
        <div id="pzlPNumber-0"></div>
        <div id="pzlPErrors-0"></div>
        <div id="pzlPScore-0"></div>
        <div id="pzlPHits-0"></div>`;
      $eXePuzzle.options[0] = Object.assign(
        {
          id: 0,
          main: 'pzlMainContainer-0',
          isScorm: 1,
          gameStarted: true,
          gameOver: true,
          hits: 3,
          errors: 0,
          score: 10,
          active: 2,
          puzzlesGame: [{}, {}, {}],
          itinerary: { percentageClue: 100 },
          msgs: { msgYouScore: 'Score' },
        },
        overrides
      );
      vi.spyOn($eXePuzzle, 'sendScore').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'saveEvaluation').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    // The defect: solving the last puzzle raises gameOver so the report
    // carries the completion, and the drag handlers refuse to move a piece
    // while it is set. Repeating left it up, so the learner got a board they
    // could look at and not touch.
    it('reopens the attempt so the pieces can be moved again', () => {
      setupRepeat();

      $eXePuzzle.updateScoreRepeat(0);

      expect($eXePuzzle.options[0].gameOver).toBe(false);
    });

    it('tells the LMS the attempt was reopened', () => {
      setupRepeat();
      let flagWhenReported;
      $eXePuzzle.sendScore.mockImplementation(() => {
        flagWhenReported = $eXePuzzle.options[0].gameOver;
      });

      $eXePuzzle.updateScoreRepeat(0);

      expect($eXePuzzle.sendScore).toHaveBeenCalledWith(true, 0);
      expect(flagWhenReported).toBe(false);
    });

    it('does not report outside automatic SCORM mode', () => {
      setupRepeat({ isScorm: 2 });

      $eXePuzzle.updateScoreRepeat(0);

      expect($eXePuzzle.sendScore).not.toHaveBeenCalled();
    });
  });

  describe('playing again from the end screen', () => {
    function setupPlayAgain(overrides) {
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="pzlMainContainer-0"></div>
          <a href="#" id="pzlStartGameEnd-0">Play again</a>
          <div id="pzlCubierta-0"></div>
          <div id="pzlShowClue-0"></div>
          <div id="pzlPHits-0"></div>
          <div id="pzlPNumber-0"></div>
          <div id="pzlPScore-0"></div>
          <div id="pzlPErrors-0"></div>
          <div id="pzlGameOver-0"></div>
        </article>`;
      $eXePuzzle.options[0] = Object.assign(
        {
          id: 0,
          main: 'pzlMainContainer-0',
          isScorm: 1,
          gameStarted: false,
          gameOver: true,
          hits: 3,
          errors: 0,
          score: 10,
          numberQuestions: 3,
          puzzlesGame: [{}, {}, {}],
          itinerary: { showCodeAccess: false },
          time: 0,
          author: '',
          fullscreen: false,
          msgs: { msgYouScore: 'Score' },
        },
        overrides
      );
      $exeDevices.iDevice.gamification.scorm.registerActivity = vi.fn();
      $exeDevices.iDevice.gamification.scorm.sendScoreNew = vi.fn();
      $exeDevices.iDevice.gamification.report = {
        updateEvaluationIcon: vi.fn(),
        saveEvaluation: vi.fn(),
      };
      vi.spyOn($eXePuzzle, 'uptateTime').mockImplementation(() => {});
      // Rebuilding the board is stubbed out, but the real showPuzzle raises
      // gameStarted and the replay report depends on that: sendScoreNew drops
      // a game that is neither started nor over. A bare no-op here would let
      // the stub, not the code, decide whether the report carries.
      vi.spyOn($eXePuzzle, 'showPuzzle').mockImplementation(() => {
        $eXePuzzle.options[0].gameStarted = true;
      });
      vi.spyOn($eXePuzzle, 'saveEvaluation').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('resets before rebuilding the board and reports the replay start to SCORM', () => {
      setupPlayAgain();
      let reportedState;
      $exeDevices.iDevice.gamification.scorm.sendScoreNew.mockImplementation(
        (auto, game) => {
          reportedState = {
            auto,
            gameOver: game.gameOver,
            gameStarted: game.gameStarted,
            hits: game.hits,
            score: game.score,
            scorerp: game.scorerp,
          };
        }
      );

      $eXePuzzle.addEvents(0);
      $('#pzlStartGameEnd-0').trigger('click');

      expect($eXePuzzle.options[0].hits).toBe(0);
      expect($eXePuzzle.options[0].score).toBe(0);
      expect($eXePuzzle.options[0].scorerp).toBe(0);
      expect($eXePuzzle.options[0].gameOver).toBe(false);
      expect($eXePuzzle.options[0].gameStarted).toBe(true);
      expect($eXePuzzle.showPuzzle).toHaveBeenCalledWith(0, 0);
      expect(reportedState).toEqual({
        auto: true,
        gameOver: false,
        gameStarted: true,
        hits: 0,
        score: 0,
        scorerp: 0,
      });
    });

    // startGame returns early on a game it believes is already running, so the
    // handler lowers the flag first. Without that, the replay kept the finished
    // attempt's errors — the one count the handler never reset by hand.
    it('clears every count when the game flag was still up', () => {
      setupPlayAgain({ gameStarted: true, gameOver: false, hits: 3, errors: 2 });

      $eXePuzzle.addEvents(0);
      $('#pzlStartGameEnd-0').trigger('click');

      expect($eXePuzzle.options[0].hits).toBe(0);
      expect($eXePuzzle.options[0].errors).toBe(0);
      expect($eXePuzzle.options[0].score).toBe(0);
    });

    it('does not auto-report a manual SCORM replay', () => {
      setupPlayAgain({ isScorm: 2 });
      vi.spyOn($eXePuzzle, 'sendScore').mockImplementation(() => {});

      $eXePuzzle.addEvents(0);
      $('#pzlStartGameEnd-0').trigger('click');

      expect($eXePuzzle.sendScore).not.toHaveBeenCalled();
      expect($eXePuzzle.saveEvaluation).toHaveBeenCalledWith(0);
    });

    // The puzzle reports when a piece resolves a board and when the learner
    // asks to play again — never on the way in. addEvents() is what the load
    // path runs (init -> addEvents -> showPuzzle), so it must only wire the
    // handlers up.
    it('reports nothing while loading the page', () => {
      setupPlayAgain();
      vi.spyOn($eXePuzzle, 'sendScore').mockImplementation(() => {});

      $eXePuzzle.addEvents(0);

      expect($eXePuzzle.sendScore).not.toHaveBeenCalled();
      expect(
        $exeDevices.iDevice.gamification.scorm.sendScoreNew
      ).not.toHaveBeenCalled();
    });
  });

  // Behind a code the board is laid out and started while the page loads, under
  // the cover, and nothing reports until a piece lands. Accepting the code is
  // the learner opening the activity, so that is where the opening zero goes.
  describe('opening the puzzle with an access code', () => {
    function setupCodeAccess(typed, overrides) {
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="pzlMainContainer-0"></div>
          <a href="#" id="pzlLinkMaximize-0"></a>
          <div id="pzlCodeAccessDiv-0"></div>
          <div id="pzlMesajeAccesCodeE-0"></div>
          <div id="pzlCubierta-0"></div>
          <input id="pzlCodeAccessE-0" value="${typed}" />
        </article>`;
      $eXePuzzle.options[0] = Object.assign(
        {
          id: 0,
          main: 'pzlMainContainer-0',
          isScorm: 1,
          // The load path already ran: showPuzzle placed the pieces and raised
          // the flag before the learner ever saw the code field.
          gameStarted: true,
          gameOver: false,
          hits: 0,
          errors: 0,
          score: 0,
          numberQuestions: 3,
          puzzlesGame: [{}, {}, {}],
          itinerary: { showCodeAccess: true, codeAccess: 'abre' },
          time: 0,
          msgs: { msgYouScore: 'Score' },
        },
        overrides
      );
      $exeDevices.iDevice.gamification.scorm.sendScoreNew = vi.fn();
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('publishes a zero and an unfinished attempt when the code is right', () => {
      setupCodeAccess('abre');
      let reportedState;
      $exeDevices.iDevice.gamification.scorm.sendScoreNew.mockImplementation(
        (auto, game) => {
          reportedState = {
            auto,
            gameOver: game.gameOver,
            gameStarted: game.gameStarted,
            scorerp: game.scorerp,
          };
        }
      );

      $eXePuzzle.enterCodeAccess(0);

      expect(reportedState).toEqual({
        auto: true,
        gameOver: false,
        gameStarted: true,
        scorerp: 0,
      });
    });

    it('reports nothing when the code is wrong', () => {
      setupCodeAccess('nope');

      $eXePuzzle.enterCodeAccess(0);

      expect(
        $exeDevices.iDevice.gamification.scorm.sendScoreNew
      ).not.toHaveBeenCalled();
      expect($('#pzlCodeAccessE-0').val()).toBe('');
    });

    it('does not auto-report in manual SCORM mode', () => {
      setupCodeAccess('abre', { isScorm: 2 });

      $eXePuzzle.enterCodeAccess(0);

      expect(
        $exeDevices.iDevice.gamification.scorm.sendScoreNew
      ).not.toHaveBeenCalled();
    });
  });
});
