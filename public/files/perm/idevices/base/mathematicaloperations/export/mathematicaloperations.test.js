/**
 * Unit tests for mathematicaloperations iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getRandomNo: Generates random numbers
 * - reduceDecimals: Reduces decimal places
 * - removeUnnecessaryDecimals: Removes trailing zeros
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeMathOperations globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeMathOperations\s*=/, 'global.$eXeMathOperations =');
  // Remove auto-init call: $(function () { $eXeMathOperations.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeMathOperations\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeMathOperations;
}

describe('mathematicaloperations iDevice export', () => {
  let $eXeMathOperations;

  beforeEach(() => {
    global.$eXeMathOperations = undefined;

    const filePath = join(__dirname, 'mathematicaloperations.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeMathOperations = loadExportIdevice(code);
  });

  describe('getRandomNo', () => {
    it('returns integer when allowDecimals is 0', () => {
      for (let i = 0; i < 10; i++) {
        const result = $eXeMathOperations.getRandomNo(0, 100, 0);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(100);
      }
    });

    it('returns decimal when allowDecimals is non-zero', () => {
      const result = $eXeMathOperations.getRandomNo(0, 10, 2);
      expect(typeof result).toBe('number');
    });

    it('respects from parameter', () => {
      for (let i = 0; i < 10; i++) {
        const result = $eXeMathOperations.getRandomNo(5, 10, 0);
        expect(result).toBeGreaterThanOrEqual(5);
      }
    });
  });

  describe('reduceDecimals', () => {
    it('reduces number to at most 2 decimals', () => {
      expect($eXeMathOperations.reduceDecimals(1.2345)).toBe('1.23');
    });

    it('removes trailing zeros', () => {
      expect($eXeMathOperations.reduceDecimals(1.10)).toBe('1.1');
      expect($eXeMathOperations.reduceDecimals(1.00)).toBe('1');
    });

    it('handles integers', () => {
      expect($eXeMathOperations.reduceDecimals(5)).toBe('5');
    });

    it('handles string input', () => {
      expect($eXeMathOperations.reduceDecimals('1.2345')).toBe('1.23');
    });

    it('returns NaN string for non-numeric string', () => {
      // parseFloat('abc') = NaN, then toFixed(2) returns 'NaN' string
      expect($eXeMathOperations.reduceDecimals('abc')).toBe('NaN');
    });

    it('returns NaN value for null', () => {
      // null is not a string and not a valid number
      const result = $eXeMathOperations.reduceDecimals(null);
      expect(Number.isNaN(result)).toBe(true);
    });
  });

  describe('removeUnnecessaryDecimals', () => {
    it('removes .00 suffix', () => {
      expect($eXeMathOperations.removeUnnecessaryDecimals(5, true)).toBe('5');
    });

    it('removes trailing zero after decimal', () => {
      expect($eXeMathOperations.removeUnnecessaryDecimals(1.10, true)).toBe('1.1');
    });

    it('keeps necessary decimals', () => {
      expect($eXeMathOperations.removeUnnecessaryDecimals(1.23, true)).toBe('1.23');
    });

    it('handles fix=false', () => {
      const result = $eXeMathOperations.removeUnnecessaryDecimals(5, false);
      expect(result).toBe('5');
    });
  });

  describe('isFeedbackEnabled', () => {
    it('accepts the shapes a saved activity can carry the flag in', () => {
      for (const enabled of [true, 1, 'true', '1']) {
        expect($eXeMathOperations.isFeedbackEnabled(enabled)).toBe(true);
      }
    });

    // These strings are truthy in JS, so an unguarded `if (mOptions.feedBack)`
    // revealed the panel on an activity whose author never enabled it.
    it('rejects the falsy flag written as a string', () => {
      for (const disabled of [false, 0, 'false', '0', undefined, null, '']) {
        expect($eXeMathOperations.isFeedbackEnabled(disabled)).toBe(false);
      }
    });
  });

  // The registry learns an activity's size from `numberQuestions`, the name
  // every other game iDevice uses. This one counts its operations in `number`,
  // so it registered with `total: 0` and the registry never knew how big it was.
  describe('the question count the registry reads', () => {
    function loaded(saved) {
      // loadDataGame parses the saved JSON through the shared helper and fills
      // the questions through loadQuestions; neither is what is under test.
      global.$exeDevices.iDevice.gamification.helpers.isJsonString = (json) =>
        JSON.parse(json);
      vi.spyOn($eXeMathOperations, 'loadQuestions').mockImplementation(
        (options) => options
      );
      const data = { text: () => JSON.stringify(saved) };
      return $eXeMathOperations.loadDataGame(data, 0);
    }

    it('publishes the operation count under the shared name', () => {
      expect(loaded({ number: 7, msgs: {} }).numberQuestions).toBe(7);
    });

    // The editor writes its inputs as strings often enough to matter.
    it('accepts the count written as a string', () => {
      expect(loaded({ number: '12', msgs: {} }).numberQuestions).toBe(12);
    });

    it('answers zero rather than NaN when the count is missing', () => {
      expect(loaded({ msgs: {} }).numberQuestions).toBe(0);
    });
  });

  describe('SCORM reporting when a game starts or restarts', () => {
    function setupGame(overrides = {}) {
      document.body.innerHTML = `
        <div id="mthoMainContainer-0">
          <div id="mthoMultimedia-0"></div>
          <div id="mthoDivImgHome-0"></div>
          <div id="mthoStartGame-0"></div>
          <div id="mthoPTime-0"></div>
          <div id="mthoDivFeedBack-0"></div>
          <div id="mthoPShowClue-0"></div>
        </div>`;
      $eXeMathOperations.options[0] = Object.assign(
        {
          main: 'mthoMainContainer-0',
          isScorm: 1,
          time: 0,
          gameStarted: false,
          gameOver: false,
          hits: 0,
          errors: 0,
          score: 0,
          number: 4,
          msgs: { msgYouScore: 'Score' },
        },
        overrides
      );
      vi.spyOn($eXeMathOperations, 'updateGameBoard').mockImplementation(() => {});
      vi.spyOn($eXeMathOperations, 'createQuestions').mockImplementation(() => {});
      vi.spyOn($eXeMathOperations, 'loadQuestions').mockImplementation(o => o);
      vi.spyOn($eXeMathOperations, 'sendScore').mockImplementation(() => {});
      // Formats the countdown through a shared helper absent from the stubs.
      vi.spyOn($eXeMathOperations, 'uptateTime').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('saveScormScore reports only in automatic SCORM mode', () => {
      setupGame({ isScorm: 1 });
      $eXeMathOperations.saveScormScore(0);
      expect($eXeMathOperations.sendScore).toHaveBeenCalledWith(true, 0);

      $eXeMathOperations.sendScore.mockClear();
      $eXeMathOperations.options[0].isScorm = 2;
      $eXeMathOperations.saveScormScore(0);
      expect($eXeMathOperations.sendScore).not.toHaveBeenCalled();
    });

    // The defect: restarting cleared the board but the LMS menu kept the
    // finished attempt's grade and its terminal status. An untimed activity
    // never reaches startGame, so the restart has to publish its own state.
    it('publishes the cleared state when an untimed game is restarted', () => {
      setupGame({ hits: 4, errors: 1, score: 10, gameOver: true });
      let stateWhenReported;
      $eXeMathOperations.sendScore.mockImplementation(() => {
        const { hits, errors, gameOver, gameStarted } =
          $eXeMathOperations.options[0];
        stateWhenReported = { hits, errors, gameOver, gameStarted };
      });

      $eXeMathOperations.reloadGame(0);

      expect(stateWhenReported).toEqual({
        hits: 0,
        errors: 0,
        gameOver: false,
        // sendScoreNew ignores a game that reports as neither started nor over.
        gameStarted: true,
      });
    });

    it('publishes the cleared state when a timed game starts', () => {
      setupGame({ time: 1, hits: 3, gameOver: true });
      let stateWhenReported;
      $eXeMathOperations.sendScore.mockImplementation(() => {
        const { hits, gameOver, gameStarted } = $eXeMathOperations.options[0];
        stateWhenReported = { hits, gameOver, gameStarted };
      });
      vi.useFakeTimers();

      try {
        $eXeMathOperations.startGame(0);
      } finally {
        vi.clearAllTimers();
        vi.useRealTimers();
      }

      expect(stateWhenReported).toEqual({
        hits: 0,
        gameOver: false,
        gameStarted: true,
      });
    });

    it('does not report a game that was already running', () => {
      setupGame({ gameStarted: true });

      $eXeMathOperations.startGame(0);

      expect($eXeMathOperations.sendScore).not.toHaveBeenCalled();
    });

    /** The code field and the maximize link the entry drives. */
    function addCodeAccessDom(typed) {
      $('#mthoMainContainer-0').append(`
        <div id="mthoCodeAccessDiv-0"></div>
        <div id="mthoMesajeAccesCodeE-0"></div>
        <div id="mthoCubierta-0"></div>
        <a id="mthoLinkMaximize-0" href="#"></a>
        <input id="mthoCodeAccessE-0" value="${typed}" />`);
      $eXeMathOperations.options[0].itinerary = {
        showCodeAccess: true,
        codeAccess: 'abre',
      };
      vi.spyOn($eXeMathOperations, 'showCubiertaOptions').mockImplementation(
        () => {}
      );
    }

    // Untimed, the activity is live from the moment the page loads and the
    // play button stays hidden — it belongs to a timed activity. So the code
    // is the last chance to publish the opening zero.
    it('publishes the opening zero when an untimed activity is opened by code', () => {
      setupGame({ time: 0, gameStarted: true, hits: 3, score: 10 });
      addCodeAccessDom('AbrE');

      $eXeMathOperations.enterCodeAccess(0);

      expect($eXeMathOperations.sendScore).toHaveBeenCalledWith(true, 0);
    });

    // With a clock the code already stands in for the play button: it lowers
    // the flag and starts the game, and startGame publishes from there. A
    // second report here would put the same zero on the wire twice.
    it('starts a timed activity exactly once when opened by code', () => {
      setupGame({ time: 1, gameStarted: false });
      addCodeAccessDom('abre');

      $eXeMathOperations.enterCodeAccess(0);

      expect($eXeMathOperations.sendScore).toHaveBeenCalledTimes(1);
      expect($eXeMathOperations.options[0].gameStarted).toBe(true);
    });

    it('reports nothing when the code is wrong', () => {
      setupGame({ time: 0, gameStarted: true });
      addCodeAccessDom('nope');

      $eXeMathOperations.enterCodeAccess(0);

      expect($eXeMathOperations.sendScore).not.toHaveBeenCalled();
      expect($('#mthoCodeAccessE-0').val()).toBe('');
    });

    it('does not auto-report in manual SCORM mode', () => {
      setupGame({ time: 0, gameStarted: true, isScorm: 2 });
      addCodeAccessDom('abre');

      $eXeMathOperations.enterCodeAccess(0);

      expect($eXeMathOperations.sendScore).not.toHaveBeenCalled();
    });
  });

  describe('reporting the end of the attempt', () => {
    function setupFinished(overrides = {}) {
      document.body.innerHTML = `
        <div id="mthoMainContainer-0">
          <div id="mthoGameContainer-0"></div>
          <div id="mthoStartGame-0"></div>
          <div id="mthoPTime-0"></div>
        </div>`;
      $eXeMathOperations.options[0] = Object.assign(
        {
          main: 'mthoMainContainer-0',
          isScorm: 1,
          time: 1,
          gameStarted: true,
          gameOver: false,
          hits: 2,
          errors: 1,
          number: 4,
          msgs: { msgNewGame: 'New', msgYouScore: 'Score' },
        },
        overrides
      );
      vi.spyOn($eXeMathOperations, 'sendScore').mockImplementation(() => {});
      vi.spyOn($eXeMathOperations, 'saveEvaluation').mockImplementation(() => {});
      vi.spyOn($eXeMathOperations, 'checkClue').mockImplementation(() => {});
      vi.spyOn($eXeMathOperations, 'showFeedBack').mockImplementation(() => {});
      vi.spyOn($eXeMathOperations, 'uptateTime').mockImplementation(() => {});
    }

    afterEach(() => {
      $eXeMathOperations.initialScore = '';
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('reports the finished attempt when the clock runs out', () => {
      setupFinished();
      let flagWhenReported;
      $eXeMathOperations.sendScore.mockImplementation(() => {
        flagWhenReported = $eXeMathOperations.options[0].gameOver;
      });

      $eXeMathOperations.gameOver(0, 0);

      expect($eXeMathOperations.sendScore).toHaveBeenCalledWith(true, 0);
      // The flag has to be up before the report, or the page never completes.
      expect(flagWhenReported).toBe(true);
    });

    // No "score only once" lock any more: the end of the attempt is always
    // reported. The one that used to sit here could never close anyway —
    // registerActivity forces repeatActivity to true at page load (common.js
    // updateScormNew) — and a stale mark in the LMS is worse than a repeated
    // one.
    it('reports again after a previous score, with repeating disabled', () => {
      setupFinished({ repeatActivity: false, initialScore: '7.50' });

      $eXeMathOperations.gameOver(0, 0);

      expect($eXeMathOperations.sendScore).toHaveBeenCalledWith(true, 0);
    });

    it('does not report outside automatic SCORM mode', () => {
      setupFinished({ isScorm: 2 });

      $eXeMathOperations.gameOver(0, 0);

      expect($eXeMathOperations.sendScore).not.toHaveBeenCalled();
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeMathOperations.borderColors).toBeDefined();
      expect($eXeMathOperations.borderColors.black).toBe('#1c1b1b');
      expect($eXeMathOperations.borderColors.blue).toBe('#5877c6');
      expect($eXeMathOperations.borderColors.green).toBe('#00a300');
      expect($eXeMathOperations.borderColors.red).toBe('#b3092f');
      expect($eXeMathOperations.borderColors.white).toBe('#ffffff');
      expect($eXeMathOperations.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('options', () => {
    it('is initialized as array', () => {
      expect(Array.isArray($eXeMathOperations.options)).toBe(true);
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($eXeMathOperations.idevicePath).toBe('');
    });
  });
});
