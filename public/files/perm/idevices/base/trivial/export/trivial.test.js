/**
 * Unit tests for the trivial iDevice (export/runtime).
 *
 * Covers the page lifecycle: the SCORM runtime owns the end of the session
 * (pagehide / visibilitychange), so the activity must never report a score of its
 * own when the page is hidden — that report races the runtime's own persistence and
 * termination, and can land after the session is already closed.
 *
 * The export declares `var $eXeTrivial`; it is rewired to a global and the auto-init
 * call is stripped so importing has no side effects.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeTrivial\s*=/, 'global.$eXeTrivial =');
  // Remove the auto-init call, whichever form the export uses ($(function () {…}) or $(() => {…})).
  modifiedCode = modifiedCode.replace(
    /\$\(\s*(?:function\s*\(\)|\(\)\s*=>)\s*\{\s*\$eXeTrivial\.init\(\);\s*\}\s*\);?/g,
    ''
  );
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeTrivial;
}

describe('trivial iDevice export', () => {
  let $eXeTrivial;

  beforeEach(() => {
    global.$eXeTrivial = undefined;
    const code = readFileSync(join(__dirname, 'trivial.js'), 'utf-8');
    $eXeTrivial = loadExportIdevice(code);
  });

  afterEach(() => {
    $(window).off('pagehide.eXeTrivial');
    delete global.$eXeTrivial;
    document.body.innerHTML = '';
  });

  describe('page lifecycle', () => {
    it('does not report a score when the page is hidden mid-game', () => {
      global.$exeDevices.iDevice.gamification.scorm.endScorm ??= vi.fn();
      $eXeTrivial.options[0] = {
        numeroTemas: 0,
        nombresTemas: [],
        msgs: {},
        itinerary: { showCodeAccess: false },
        numberLives: 0,
        instructions: '',
        title: '',
        author: '',
        isScorm: 0,
        hasVideo: false,
        gameStarted: true,
        gameOver: false,
      };
      // Board drawing needs a canvas; it is not what this test is about.
      $eXeTrivial.loadGameBoard = vi.fn();
      $eXeTrivial.sendScore = vi.fn();

      $eXeTrivial.addEvents(0);
      $(window).trigger('pagehide');

      expect($eXeTrivial.sendScore).not.toHaveBeenCalled();
    });
  });

  // The report used to live at the end of correctAnswer(), so a wrong answer
  // changed nothing in the LMS until the next correct one or the end of the
  // game — and a win reported twice, once there and once from gameOver().
  describe('reporting every answer, right or wrong', () => {
    function setupTurn(overrides) {
      $eXeTrivial.options[0] = Object.assign(
        {
          id: 0,
          isScorm: 1,
          gameStarted: true,
          gameOver: false,
        },
        overrides
      );
      vi.spyOn($eXeTrivial, 'sendScore').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'saveEvaluation').mockImplementation(() => {});
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('reports while the game is running', () => {
      setupTurn();

      $eXeTrivial.saveQuestionScore(0);

      expect($eXeTrivial.sendScore).toHaveBeenCalledWith(true, 0);
    });

    // gameOver() reports the terminal state itself; reporting here as well
    // sent the same result to the LMS twice.
    it('stands down once the game is over', () => {
      setupTurn({ gameOver: true });

      $eXeTrivial.saveQuestionScore(0);

      expect($eXeTrivial.sendScore).not.toHaveBeenCalled();
    });

    it('does not report outside automatic SCORM mode', () => {
      setupTurn({ isScorm: 0 });

      $eXeTrivial.saveQuestionScore(0);

      expect($eXeTrivial.sendScore).not.toHaveBeenCalled();
    });

    // Recording the attempt locally happens either way.
    it('records the evaluation whether or not it reports', () => {
      setupTurn({ isScorm: 0 });

      $eXeTrivial.saveQuestionScore(0);

      expect($eXeTrivial.saveEvaluation).toHaveBeenCalledWith(0);
    });
  });

  describe('restarting the game', () => {
    function setupReboot() {
      document.body.innerHTML = `<div id="trivialJugadores-0"></div>`;
      $eXeTrivial.options[0] = {
        id: 0,
        main: 'trivialMainContainer-0',
        trivialID: 7,
        isScorm: 1,
        gameStarted: true,
        gameOver: true,
        numeroJugadores: 1,
        numeroTemas: 3,
        numeroCasillas: 20,
        pT: [{}, {}],
        gamers: [{ score: 8, quesos: [0, 1], cheeses: [0, 1], casilla: 5 }],
        msgs: {},
      };
      global.localStorage = { removeItem: vi.fn() };
      vi.spyOn($eXeTrivial, 'updateTimeGame').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'saveEvaluation').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'placePlayerToken').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'activeCheese').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'loadGameBoard').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'sendScore').mockImplementation(() => {});
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    // The board was put back but the players were not: only the on-screen
    // points were zeroed, while the values sendScore reads kept the finished
    // game's numbers.
    it('puts the players back to zero, not just the scoreboard', () => {
      setupReboot();

      $eXeTrivial.rebootGame(0);

      expect($eXeTrivial.options[0].gamers[0]).toMatchObject({
        score: 0,
        quesos: [],
        cheeses: [],
      });
    });

    // It used to report here, before any of the resets, so it published the
    // discarded game's score again — and with gameOver still up, telling the
    // LMS that was the final word.
    it('does not report the game it is discarding', () => {
      setupReboot();

      $eXeTrivial.rebootGame(0);

      expect($eXeTrivial.sendScore).not.toHaveBeenCalled();
    });
  });

  describe('reporting when a game starts', () => {
    function setupStart(overrides = {}) {
      $eXeTrivial.options[0] = Object.assign(
        {
          id: 0,
          main: 'trivialMainContainer-0',
          isScorm: 1,
          gameStarted: false,
          gameOver: false,
          numeroJugadores: 1,
          numeroTemas: 3,
          scoreGame: 8,
          pT: [{}, {}],
          gamers: [{ score: 8, quesos: [1, 2], cheeses: [], casilla: 0 }],
          msgs: {},
        },
        overrides
      );
      // Board drawing needs a canvas; player names come from inputs.
      vi.spyOn($eXeTrivial, 'loadGameBoard').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'loadPlayers').mockImplementation(instance => {
        // What the real one does: rebuild every player from scratch.
        $eXeTrivial.options[instance].gamers = [
          { name: 'A', score: 0, casilla: 1, number: 0, quesos: [], cheeses: [] },
        ];
        return true;
      });
      vi.spyOn($eXeTrivial, 'initCheeses').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'changePlayer').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'updateTimeGame').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'saveDataStorage').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'showGameMessage').mockImplementation(() => {});
      vi.spyOn($eXeTrivial, 'sendScore').mockImplementation(() => {});
      vi.useFakeTimers();
    }

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    // The defect: starting a game rebuilt the players at zero but told the LMS
    // nothing, so its menu kept the previous game's grade and status.
    it('publishes the rebuilt players, so the report is a zero', () => {
      setupStart();
      let scoreWhenReported;
      $eXeTrivial.sendScore.mockImplementation(() => {
        scoreWhenReported = $eXeTrivial.options[0].gamers[0].score;
      });

      $eXeTrivial.startGame(0);

      expect($eXeTrivial.sendScore).toHaveBeenCalledWith(true, 0);
      expect(scoreWhenReported).toBe(0);
    });

    it('does not report outside automatic SCORM mode', () => {
      setupStart({ isScorm: 2 });

      $eXeTrivial.startGame(0);

      expect($eXeTrivial.sendScore).not.toHaveBeenCalled();
    });

    it('does not report a game that was already running', () => {
      setupStart({ gameStarted: true });

      $eXeTrivial.startGame(0);

      expect($eXeTrivial.sendScore).not.toHaveBeenCalled();
    });

    // Missing player names abort the start, so nothing has been reset yet.
    it('does not report when the players are not ready', () => {
      setupStart();
      $eXeTrivial.loadPlayers.mockReturnValue(false);

      $eXeTrivial.startGame(0);

      expect($eXeTrivial.sendScore).not.toHaveBeenCalled();
    });
  });
});
