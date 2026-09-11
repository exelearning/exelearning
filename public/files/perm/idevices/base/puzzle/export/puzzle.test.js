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

  /**
   * A solved board is counted where it is solved. It used to be counted at the
   * end of the reveal animation, which runs one 300 ms tick per tile: three to
   * eight seconds during which the LMS held the previous puzzle's mark, and
   * during which a hand-sent score saved that same short mark. common.js
   * derives completion from `gameOver === true`, so the flag has to be up
   * before updateScore reports, or a finished page stays `incomplete`.
   */
  describe('counting a solved puzzle', () => {
    function setupSolved(overrides) {
      document.body.innerHTML = `
        <div id="pzlImagePuzzle-0"></div>
        <div id="pzlAttemps-0"></div>`;
      const silent = { audioDefinition: '', audioClue: '' };
      $eXePuzzle.options[0] = Object.assign(
        {
          id: 0,
          isScorm: 1,
          gameOver: false,
          active: 2,
          attemps: 0,
          puzzlesGame: [silent, silent, silent],
          msgs: {},
        },
        overrides
      );
      vi.spyOn($eXePuzzle, 'checkCorrectPlaces').mockImplementation(() => true);
      vi.spyOn($eXePuzzle, 'showSholution').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'updateScore').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('marks the activity finished when the last puzzle is solved', () => {
      setupSolved({ active: 2 });

      $eXePuzzle.checkIfSolved(0);

      expect($eXePuzzle.options[0].gameOver).toBe(true);
    });

    // Solving an intermediate puzzle must not close the attempt: the page would
    // go to passed/failed while the learner is still playing.
    it('leaves the activity unfinished while puzzles remain', () => {
      setupSolved({ active: 0 });

      $eXePuzzle.checkIfSolved(0);

      expect($eXePuzzle.options[0].gameOver).toBe(false);
    });

    it('raises the flag before it reports, so the two cannot disagree', () => {
      setupSolved({ active: 2 });
      let flagWhenReported;
      $eXePuzzle.updateScore.mockImplementation(() => {
        flagWhenReported = $eXePuzzle.options[0].gameOver;
      });

      $eXePuzzle.checkIfSolved(0);

      expect(flagWhenReported).toBe(true);
    });

    // The order is the whole point: count first, then show. Reversed, the
    // report goes out while the tiles are still appearing and carries a mark
    // that does not include the puzzle the learner has just solved.
    it('counts the hit before the reveal starts', () => {
      setupSolved({ active: 1 });
      const order = [];
      $eXePuzzle.updateScore.mockImplementation(() => order.push('count'));
      $eXePuzzle.showSholution.mockImplementation(() => order.push('reveal'));

      $eXePuzzle.checkIfSolved(0);

      expect(order).toEqual(['count', 'reveal']);
    });

    it('does not count an unsolved board', () => {
      setupSolved({ active: 2 });
      $eXePuzzle.checkCorrectPlaces.mockImplementation(() => false);

      $eXePuzzle.checkIfSolved(0);

      expect($eXePuzzle.updateScore).not.toHaveBeenCalled();
      expect($eXePuzzle.options[0].gameOver).toBe(false);
    });

    // The reveal window only shows the result now. Counting there as well
    // would charge the learner twice for one puzzle.
    it('leaves the completed window with nothing to count', () => {
      setupSolved({ active: 2, msgs: { msgsCompletedPuzzle: '', msgsRepeat: '', msgsNext: '', msgsTerminate: '' } });

      $eXePuzzle.showCompletedWindows(0);

      expect($eXePuzzle.updateScore).not.toHaveBeenCalled();
      expect($eXePuzzle.options[0].gameOver).toBe(false);
    });
  });

  /**
   * The save button of manual mode. `gameStarted` goes up on its own when the
   * image loads — it is what the tile handlers read to allow play — so it
   * cannot stand for "the learner has done something", and the runtime's own
   * refusal never fires here. Without a question of its own, a learner who came
   * back and pressed save before touching a tile wrote a 0 over the mark the
   * LMS was holding.
   */
  describe('what the save button will write', () => {
    function given(overrides) {
      $eXePuzzle.options[0] = Object.assign(
        {
          id: 0,
          isScorm: 2,
          gameStarted: true,
          gameOver: false,
          engaged: false,
          codeAccepted: false,
          itinerary: { showCodeAccess: false },
        },
        overrides
      );
    }

    afterEach(() => {
      $eXePuzzle.options = [];
      vi.restoreAllMocks();
    });

    it('refuses a board nobody has touched', () => {
      given();

      expect($eXePuzzle.canSendScore(0)).toBe(false);
    });

    it('allows it once a tile has been moved', () => {
      given({ engaged: true });

      expect($eXePuzzle.canSendScore(0)).toBe(true);
    });

    // The button sits outside the cover, so it is within reach of someone who
    // never opened the activity.
    it('refuses while the access code has not been accepted', () => {
      given({ engaged: true, itinerary: { showCodeAccess: true } });

      expect($eXePuzzle.canSendScore(0)).toBe(false);
    });

    it('allows it once the code has been accepted', () => {
      given({
        engaged: true,
        codeAccepted: true,
        itinerary: { showCodeAccess: true },
      });

      expect($eXePuzzle.canSendScore(0)).toBe(true);
    });

    // A finished activity is the mark the learner came to save, so being
    // finished stands in for having touched the board.
    it('allows a finished activity that is not locked', () => {
      given({ gameOver: true, engaged: false });

      expect($eXePuzzle.canSendScore(0)).toBe(true);
    });

    // But being finished is not proof the code was ever given. The cover is a
    // sibling of the game container, so taking the container fullscreen leaves
    // it behind, and its control is still in the tab order underneath: the
    // board can be reached, and solved, without the code.
    it('refuses a finished activity that never took the code', () => {
      given({
        gameOver: true,
        engaged: true,
        codeAccepted: false,
        itinerary: { showCodeAccess: true },
      });

      expect($eXePuzzle.canSendScore(0)).toBe(false);
    });

    it('allows a finished activity once the code has been accepted', () => {
      given({
        gameOver: true,
        codeAccepted: true,
        itinerary: { showCodeAccess: true },
      });

      expect($eXePuzzle.canSendScore(0)).toBe(true);
    });

    it('answers no for an instance that does not exist', () => {
      expect($eXePuzzle.canSendScore(7)).toBe(false);
    });
  });
  describe('pressing the save button', () => {
    function setupButton(overrides) {
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="pzlMainContainer-0"></div>
          <div id="pzlAudioDef-0"></div>
          <div id="pzlAudioClue-0"></div>
          <div id="pzlShowClue-0"></div>
          <div id="pzlPHits-0"></div>
          <div id="pzlPNumber-0"></div>
          <div id="pzlPScore-0"></div>
          <div id="pzlPErrors-0"></div>
          <div id="pzlCubierta-0"></div>
          <div id="pzlGameOver-0"></div>
          <div id="pzlTime-0"></div>
          <div id="pzlImgTime-0"></div>
          <div id="pzlAttemps-0"></div>
          <div id="pzlImgAttemps-0"></div>
          <div id="pzlCodeAccessDiv-0"></div>
          <div id="pzlMultimedia-0"><div class="PZLP-Tile" id="slide-0"></div></div>
          <div id="pzlImagePuzzle-0"><div class="PZLP-TileChange" id="swap-0"></div></div>
          <input type="button" class="Games-SendScore" />
          <span class="Games-RepeatActivity"></span>
        </article>`;
      $eXePuzzle.options[0] = Object.assign(
        {
          id: 0,
          main: 'pzlMainContainer-0',
          isScorm: 2,
          gameStarted: true,
          gameOver: false,
          engaged: false,
          codeAccepted: false,
          hits: 0,
          errors: 0,
          score: 0,
          numberQuestions: 3,
          time: 0,
          author: '',
          fullscreen: false,
          itinerary: { showCodeAccess: false },
          msgs: { msgEndGameScore: 'Please start the game first.' },
        },
        overrides
      );
      $exeDevices.iDevice.gamification.scorm.registerActivity = vi.fn();
      $exeDevices.iDevice.gamification.scorm.refuseHandSend = vi.fn();
      vi.spyOn($eXePuzzle, 'uptateTime').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'sendScore').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'saveEvaluation').mockImplementation(() => {});
      $eXePuzzle.addEvents(0);
    }

    afterEach(() => {
      document.body.innerHTML = '';
      $eXePuzzle.options = [];
      vi.restoreAllMocks();
    });

    it('writes nothing and says so when the board is untouched', () => {
      setupButton();

      $('.Games-SendScore').trigger('click');

      expect($eXePuzzle.sendScore).not.toHaveBeenCalled();
      expect($eXePuzzle.saveEvaluation).not.toHaveBeenCalled();
      expect(
        $exeDevices.iDevice.gamification.scorm.refuseHandSend
      ).toHaveBeenCalledWith($eXePuzzle.options[0]);
    });

    it('sends by hand once the learner has played', () => {
      setupButton({ engaged: true });

      $('.Games-SendScore').trigger('click');

      expect($eXePuzzle.sendScore).toHaveBeenCalledWith(false, 0);
      expect($eXePuzzle.saveEvaluation).toHaveBeenCalledWith(0);
      expect(
        $exeDevices.iDevice.gamification.scorm.refuseHandSend
      ).not.toHaveBeenCalled();
    });

    // What counts as touching the board: a click the handlers accept, in
    // either mode of play. The sliding puzzle marks it even for a tile that
    // cannot move — the learner tried.
    it.each([
      ['a sliding tile', '#slide-0'],
      ['a tile to swap', '#swap-0'],
    ])('takes %s as the learner engaging', (_label, selector) => {
      setupButton({
        gameActived: false,
        active: 0,
        puzzlesGame: [{ type: 1, columns: 2, rows: 2 }],
      });
      expect($eXePuzzle.canSendScore(0)).toBe(false);

      $(selector).trigger('click');

      expect($eXePuzzle.options[0].engaged).toBe(true);
      expect($eXePuzzle.canSendScore(0)).toBe(true);
    });

    it('ignores a click on a board that is busy', () => {
      setupButton({
        gameActived: true,
        active: 0,
        puzzlesGame: [{ type: 1, columns: 2, rows: 2 }],
      });

      $('#swap-0').trigger('click');

      expect($eXePuzzle.options[0].engaged).toBe(false);
    });
  });

  /**
   * Finishing is reached from the completed window's own button, which is only
   * there because the last puzzle was solved — and solving it already reported
   * the final mark with the activity closed. Repeating that report made the LMS
   * re-evaluate a verdict it had already reached.
   */
  describe('finishing the activity', () => {
    function setupFinish(overrides) {
      document.body.innerHTML = `
        <div id="pzlImagePuzzle-0"></div>
        <div id="pzlCubierta-0"></div>
        <div id="pzlRepeatActivity-0"></div>
        <div id="pzlCodeAccessDiv-0"></div>`;
      $eXePuzzle.options[0] = Object.assign(
        {
          id: 0,
          isScorm: 1,
          gameStarted: true,
          gameOver: true,
          hits: 3,
          errors: 0,
          active: 2,
          puzzlesGame: [{}, {}, {}],
          numberQuestions: 3,
          msgs: { msgYouScore: 'Score' },
        },
        overrides
      );
      vi.spyOn($eXePuzzle, 'stopAllSounds').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'showScoreGame').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'showFeedBack').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'saveEvaluation').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'sendScore').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('does not send the terminal mark a second time', () => {
      setupFinish();

      $eXePuzzle.gameOver(0, 0);

      expect($eXePuzzle.sendScore).not.toHaveBeenCalled();
      expect($eXePuzzle.saveEvaluation).toHaveBeenCalledWith(0);
      expect($eXePuzzle.options[0].gameStarted).toBe(false);
    });

    it('still shows the learner their mark', () => {
      setupFinish();

      $eXePuzzle.gameOver(0, 0);

      expect($('#pzlRepeatActivity-0').text()).toBe('Score: 10.00');
    });

    // showScoreGame's type 1 shows the losing image, and it was the only value
    // ever passed: whoever solved every puzzle was told they had lost.
    it('closes a completed activity as a win', () => {
      setupFinish({ active: 2 });
      vi.spyOn($eXePuzzle, 'gameOver').mockImplementation(() => {});

      $eXePuzzle.nextPuzzle(0);

      expect($eXePuzzle.gameOver).toHaveBeenCalledWith(0, 0);
    });

    it('moves on instead of finishing while puzzles remain', () => {
      setupFinish({ active: 0 });
      vi.spyOn($eXePuzzle, 'gameOver').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'showPuzzle').mockImplementation(() => {});

      $eXePuzzle.nextPuzzle(0);

      expect($eXePuzzle.gameOver).not.toHaveBeenCalled();
      expect($eXePuzzle.showPuzzle).toHaveBeenCalledWith(1, 0);
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
      // A bare no-op, deliberately. This used to raise gameStarted, on the
      // stated grounds that "the real showPuzzle raises it" — which it does
      // not: placePuzzlePieces does, from the image's own load event. So the
      // stub was supplying the one thing the handler was missing, and these
      // tests certified a replay that in a browser sent no progress to SCORM.
      vi.spyOn($eXePuzzle, 'showPuzzle').mockImplementation(() => {});
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

    // A new attempt is untouched again, so in manual mode the button waits for
    // a move before it will overwrite the mark the last attempt saved.
    it('asks for a move again before the button will write', () => {
      setupPlayAgain({ isScorm: 2, engaged: true });

      $eXePuzzle.addEvents(0);
      $('#pzlStartGameEnd-0').trigger('click');

      expect($eXePuzzle.options[0].engaged).toBe(false);
      expect($eXePuzzle.canSendScore(0)).toBe(false);
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

    // The save button sits outside the cover, so until the code is in it has
    // to know the activity was never opened.
    it('remembers that the code was accepted, so the button may write', () => {
      setupCodeAccess('abre', {
        isScorm: 2,
        engaged: true,
        codeAccepted: false,
      });
      expect($eXePuzzle.canSendScore(0)).toBe(false);

      $eXePuzzle.enterCodeAccess(0);

      expect($eXePuzzle.options[0].codeAccepted).toBe(true);
      expect($eXePuzzle.canSendScore(0)).toBe(true);
    });

    it('keeps the button shut after a wrong code', () => {
      setupCodeAccess('nope', {
        isScorm: 2,
        engaged: true,
        codeAccepted: false,
      });

      $eXePuzzle.enterCodeAccess(0);

      expect($eXePuzzle.options[0].codeAccepted).toBe(false);
      expect($eXePuzzle.canSendScore(0)).toBe(false);
    });
  });

  /**
   * The tests above hand showPuzzle a no-op, which proves the replay does not
   * lean on it but says nothing about the real order of events. This one runs
   * showPuzzle and showImagePuzzle for real: the picture's load handler is
   * attached and, as in a browser, has not run by the time the click handler
   * finishes. Setting src queues the load event as a task even when the image
   * is held in cache, so it can never overtake the code that follows.
   */
  describe('replaying before the picture arrives', () => {
    let pictureArrived;

    function setupSlowImage() {
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="pzlMainContainer-0"></div>
          <a href="#" id="pzlStartGameEnd-0">Play again</a>
          <div id="pzlCubierta-0"></div>
          <div id="pzlGameOver-0"></div>
          <div id="pzlShowClue-0"></div>
          <div id="pzlPHits-0"></div>
          <div id="pzlPNumber-0"></div>
          <div id="pzlPScore-0"></div>
          <div id="pzlPErrors-0"></div>
          <div id="pzlTime-0"></div>
          <div id="pzlImgTime-0"></div>
          <div id="pzlAttemps-0"></div>
          <div id="pzlImgAttemps-0"></div>
          <div id="pzlCodeAccessDiv-0"></div>
          <div id="pzlAudioDef-0"></div>
          <div id="pzlAudioClue-0"></div>
          <div id="pzlAuthor-0"></div>
          <a href="#" id="pzlShowImage-0"></a>
          <a href="#" id="pzlShowNumber-0"></a>
          <img id="pzlImage-0" alt="" />
          <div id="pzlImagePuzzle-0"></div>
        </article>`;
      $eXePuzzle.options[0] = {
        id: 0,
        main: 'pzlMainContainer-0',
        isScorm: 1,
        gameStarted: false,
        gameOver: true,
        gameActived: false,
        hits: 3,
        errors: 0,
        score: 10,
        numberQuestions: 3,
        active: 0,
        puzzlesGame: [
          {
            type: 1,
            url: 'puzzle-image.png',
            definition: '',
            author: '',
            alt: '',
            atl: '',
            audioDefinition: '',
            showTime: false,
            showImage: false,
            showNumber: false,
          },
        ],
        itinerary: { showCodeAccess: false },
        time: 0,
        author: '',
        fullscreen: false,
        msgs: { msgYouScore: 'Score', msgNoImage: 'no image' },
      };
      pictureArrived = false;
      $exeDevices.iDevice.gamification.scorm.registerActivity = vi.fn();
      $exeDevices.iDevice.gamification.scorm.sendScoreNew = vi.fn();
      vi.spyOn($eXePuzzle, 'uptateTime').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'saveEvaluation').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'stopAllSounds').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'showMessage').mockImplementation(() => {});
      // Stands in for the browser delivering the picture. Nothing calls it
      // during the click: jsdom does not fetch the image, exactly as a real
      // browser does not fire load synchronously.
      vi.spyOn($eXePuzzle, 'handleImageLoad').mockImplementation(() => {
        pictureArrived = true;
      });
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('tells the LMS the new attempt started while the board is still empty', () => {
      setupSlowImage();
      let reported;
      $exeDevices.iDevice.gamification.scorm.sendScoreNew.mockImplementation(
        (auto, game) => {
          reported = {
            auto,
            gameStarted: game.gameStarted,
            gameOver: game.gameOver,
            gameActived: game.gameActived,
            pictureArrived,
          };
        }
      );

      $eXePuzzle.addEvents(0);
      $('#pzlStartGameEnd-0').trigger('click');

      // The report went out ahead of the picture, carrying a started attempt
      // that has not finished — a zero the LMS can act on at once. Leave the
      // flag to placePuzzlePieces and this call reports neither started nor
      // over, which sendScoreNew drops in silence.
      expect(reported).toEqual({
        auto: true,
        gameStarted: true,
        gameOver: false,
        gameActived: true,
        pictureArrived: false,
      });
    });

    // The flip side of declaring the attempt started early: the previous
    // board is still on screen and the handlers now believe there is a game
    // running, so gameActived is what keeps the learner off it.
    it('leaves the board locked until the picture arrives', () => {
      setupSlowImage();

      $eXePuzzle.addEvents(0);
      $('#pzlStartGameEnd-0').trigger('click');

      expect($eXePuzzle.options[0].gameActived).toBe(true);

      $('#pzlImage-0').trigger('load');

      expect(pictureArrived).toBe(true);
    });
  });

  /**
   * The pieces only appear once the image has loaded — placePuzzlePieces runs
   * from its load event — and the replay declares the attempt started before
   * that, so the LMS hears it immediately. Between the two the previous board
   * is still on screen, and without this it answered to clicks.
   */
  describe('rebuilding the board', () => {
    function setupBoard(type) {
      document.body.innerHTML = `
        <div id="pzlImagePuzzle-0">
          <div class="PZLP-Tile" id="old-slide"></div>
          <div class="PZLP-TileChange" id="old-swap"></div>
          <div class="PZLP-Completed" id="old-done"></div>
        </div>
        <div id="pzlAuthor-0"></div>
        <div id="pzlImage-0"></div>
        <div id="pzlAudioDef-0"></div>
        <div id="pzlAudioClue-0"></div>`;
      $eXePuzzle.options[0] = {
        id: 0,
        active: 0,
        gameActived: false,
        selectedTile: $('#old-swap'),
        puzzlesGame: [{ type, showTime: false, audioDefinition: '', author: '', atl: '' }],
        msgs: { msgNoImage: 'no image' },
      };
      vi.spyOn($eXePuzzle, 'stopAllSounds').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'showMessage').mockImplementation(() => {});
      vi.spyOn($eXePuzzle, 'showImagePuzzle').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('shuts the board until the pieces are placed', () => {
      setupBoard(0);

      $eXePuzzle.showPuzzle(0, 0);

      // The click handlers read this one: true means "busy, ignore". Only
      // placePuzzlePieces clears it, as the last thing it does.
      expect($eXePuzzle.options[0].gameActived).toBe(true);
    });

    // The truncated class name matched nothing, so the swap puzzle kept the
    // previous attempt's pieces on screen through the rebuild.
    it.each([
      ['sliding pieces', '#old-slide'],
      ['swap pieces', '#old-swap'],
      ['the completed overlay', '#old-done'],
    ])('removes %s from the previous board', (_label, selector) => {
      setupBoard(1);

      $eXePuzzle.showPuzzle(0, 0);

      expect($(selector).length).toBe(0);
    });

    // The swap logic compares the next click against it, so a tile held from
    // the previous attempt would pair with a node that no longer exists.
    it('forgets the tile held from the previous attempt', () => {
      setupBoard(1);

      $eXePuzzle.showPuzzle(0, 0);

      expect($eXePuzzle.options[0].selectedTile).toBeNull();
    });
  });
});
