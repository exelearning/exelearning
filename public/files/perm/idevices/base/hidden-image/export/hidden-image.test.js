/**
 * Unit tests for hidden-image iDevice (export/runtime)
 *
 * Tests pure functions and configuration:
 * - borderColors: Color definitions
 * - options: Initial state
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeHiddenImage globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeHiddenImage\s*=/, 'global.$eXeHiddenImage =');
  // Remove auto-init call: $(function () { $eXeHiddenImage.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeHiddenImage\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeHiddenImage;
}

describe('hidden-image iDevice export', () => {
  let $eXeHiddenImage;

  beforeEach(() => {
    global.$eXeHiddenImage = undefined;

    const filePath = join(__dirname, 'hidden-image.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeHiddenImage = loadExportIdevice(code);
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeHiddenImage.borderColors).toBeDefined();
      expect($eXeHiddenImage.borderColors.black).toBe('#1c1b1b');
      expect($eXeHiddenImage.borderColors.blue).toBe('#5877c6');
      expect($eXeHiddenImage.borderColors.green).toBe('#137575');
      expect($eXeHiddenImage.borderColors.red).toBe('#b3092f');
      expect($eXeHiddenImage.borderColors.white).toBe('#f9f9f9');
      expect($eXeHiddenImage.borderColors.yellow).toBe('#f3d55a');
    });

    it('has grey color', () => {
      expect($eXeHiddenImage.borderColors.grey).toBe('#777777');
    });

    it('has incorrect color', () => {
      expect($eXeHiddenImage.borderColors.incorrect).toBe('#d9d9d9');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($eXeHiddenImage.colors).toBeDefined();
    });
  });

  describe('options', () => {
    it('is defined', () => {
      expect($eXeHiddenImage.options).toBeDefined();
    });
  });

  describe('hasSCORMbutton', () => {
    it('is initially false', () => {
      expect($eXeHiddenImage.hasSCORMbutton).toBe(false);
    });
  });

  describe('isInExe', () => {
    it('is initially false', () => {
      expect($eXeHiddenImage.isInExe).toBe(false);
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($eXeHiddenImage.idevicePath).toBe('');
    });
  });

  describe('userName', () => {
    it('is initially empty', () => {
      expect($eXeHiddenImage.userName).toBe('');
    });
  });

  describe('previousScore', () => {
    it('is initially empty', () => {
      expect($eXeHiddenImage.previousScore).toBe('');
    });
  });

  describe('initialScore', () => {
    it('is initially empty', () => {
      expect($eXeHiddenImage.initialScore).toBe('');
    });
  });

  describe('getRevealDelayMs', () => {
    it('converts seconds to milliseconds', () => {
      expect($eXeHiddenImage.getRevealDelayMs(2)).toBe(2000);
      expect($eXeHiddenImage.getRevealDelayMs('10')).toBe(10000);
    });

    it('returns infinite delay when value is zero', () => {
      expect($eXeHiddenImage.getRevealDelayMs(0)).toBe(Number.POSITIVE_INFINITY);
      expect($eXeHiddenImage.getRevealDelayMs('0')).toBe(Number.POSITIVE_INFINITY);
    });

    it('falls back to one second on invalid values', () => {
      expect($eXeHiddenImage.getRevealDelayMs(-1)).toBe(1000);
      expect($eXeHiddenImage.getRevealDelayMs('abc')).toBe(1000);
      expect($eXeHiddenImage.getRevealDelayMs(undefined)).toBe(1000);
    });
  });

  describe('hideSquareAfterElapsedTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('reveals square only after configured elapsed time', () => {
      const fadeIn = vi.fn();
      const square = {
        length: 1,
        _dataStore: {},
        data(key, value) {
          if (typeof value === 'undefined') {
            return this._dataStore[key];
          }
          this._dataStore[key] = value;
          return this._dataStore[key];
        },
        removeData(key) {
          delete this._dataStore[key];
        },
        stop() {
          return {
            fadeIn,
          };
        },
      };

      $eXeHiddenImage.hideSquareAfterElapsedTime(square, 2000);

      vi.advanceTimersByTime(1900);
      expect(fadeIn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fadeIn).toHaveBeenCalledTimes(1);
    });

    it('does not schedule reveal when delay is infinite', () => {
      const fadeIn = vi.fn();
      const square = {
        length: 1,
        _dataStore: {},
        data(key, value) {
          if (typeof value === 'undefined') {
            return this._dataStore[key];
          }
          this._dataStore[key] = value;
          return this._dataStore[key];
        },
        removeData(key) {
          delete this._dataStore[key];
        },
        stop() {
          return {
            fadeIn,
          };
        },
      };

      $eXeHiddenImage.hideSquareAfterElapsedTime(
        square,
        Number.POSITIVE_INFINITY
      );

      vi.advanceTimersByTime(60000);
      expect(fadeIn).not.toHaveBeenCalled();
    });

    it('clears previous pending timer before scheduling a new one', () => {
      const previousTimer = setTimeout(() => {}, 99999);
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const fadeIn = vi.fn();
      const square = {
        length: 1,
        _dataStore: {
          hiRevealTimerId: previousTimer,
        },
        data(key, value) {
          if (typeof value === 'undefined') {
            return this._dataStore[key];
          }
          this._dataStore[key] = value;
          return this._dataStore[key];
        },
        removeData(key) {
          delete this._dataStore[key];
        },
        stop() {
          return {
            fadeIn,
          };
        },
      };

      $eXeHiddenImage.hideSquareAfterElapsedTime(square, 1000);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(previousTimer);
      vi.advanceTimersByTime(1000);
      expect(fadeIn).toHaveBeenCalledTimes(1);
    });
  });

  // Regression coverage for issue #2272: createSquares and showImageNeo run
  // from image load handlers and delayed timeouts, so they can fire after the
  // activity was torn down — options[instance] may be gone and the <img>
  // element may have been removed. Both must bail out instead of crashing.
  describe('createSquares guards (#2272)', () => {
    const instance = 0;

    it('returns early without throwing when options[instance] is gone', () => {
      document.body.innerHTML = `<div id="hipOverlay-${instance}"></div>`;
      expect(() => $eXeHiddenImage.createSquares(instance)).not.toThrow();
    });

    it('builds the rows x columns grid of squares when data and DOM are present (positive path)', () => {
      document.body.innerHTML = `
        <div id="hipParent-${instance}">
          <img id="hiPImage-${instance}">
          <div id="hipOverlay-${instance}"></div>
        </div>
      `;
      const overlayEl = document.getElementById(`hipOverlay-${instance}`);
      // happy-dom has no layout; give the overlay a real box.
      overlayEl.getBoundingClientRect = () => ({
        width: 100,
        height: 60,
        top: 0,
        left: 0,
        right: 100,
        bottom: 60,
      });
      $eXeHiddenImage.options[instance] = {
        questionsGame: [{ columns: 2, rows: 3 }],
        activeQuestion: 0,
      };
      expect(() => $eXeHiddenImage.createSquares(instance)).not.toThrow();
      expect(document.querySelectorAll(`#hipOverlay-${instance} .HIP-Square`).length).toBe(6);
    });
  });

  describe('showImageNeo guards (#2272)', () => {
    const instance = 0;

    it('returns early without throwing when options[instance] is gone', () => {
      document.body.innerHTML = `<img id="hiPImage-${instance}">`;
      expect(() => $eXeHiddenImage.showImageNeo('test.png', instance)).not.toThrow();
    });

    it('returns early without throwing when the image element is no longer in the DOM', () => {
      $eXeHiddenImage.options[instance] = {
        questionsGame: [{ author: 'Author', alt: 'An image' }],
        activeQuestion: 0,
      };
      // DOM is empty: the activity was removed before the image callback ran.
      expect(() => $eXeHiddenImage.showImageNeo('test.png', instance)).not.toThrow();
    });

    it('sets the image source and load handlers when data and DOM are present (positive path)', () => {
      $eXeHiddenImage.options[instance] = {
        questionsGame: [{ author: 'Author', alt: 'An image' }],
        activeQuestion: 0,
      };
      document.body.innerHTML = `<img id="hiPImage-${instance}">`;
      $eXeHiddenImage.showAuthor = vi.fn();
      $eXeHiddenImage.scheduleReflow = vi.fn();
      expect(() => $eXeHiddenImage.showImageNeo('test.png', instance)).not.toThrow();
      expect($(`#hiPImage-${instance}`).attr('src')).toBe('test.png');
    });
  });

  // The automatic report used to happen only from showQuestion(), i.e. once the
  // hideSquares reveal had elapsed. That put the mark in the LMS seconds late,
  // and a learner who left during that window lost the answer.
  describe('reporting in the same turn the learner answered', () => {
    function setupAnswer(overrides) {
      document.body.innerHTML = `
        <div id="hiPMainContainer-0">
          <div id="hiPHits-0"></div>
          <div id="hiPErrors-0"></div>
          <div id="hiPShowClue-0"></div>
        </div>`;
      $eXeHiddenImage.options[0] = Object.assign(
        {
          id: 0,
          isScorm: 1,
          gameStarted: true,
          gameActived: true,
          gameOver: false,
          hits: 1,
          errors: 0,
          numberQuestions: 4,
          activeQuestion: 0,
          activeCounter: true,
          showSolution: false,
          obtainedClue: false,
          question: { solution: 1 },
          questionsGame: [{}, {}, {}, {}],
          itinerary: { showClue: false, percentageClue: 0, clueGame: '' },
          msgs: { msgInformation: 'info', msgYouScore: 'Score' },
        },
        overrides
      );
      vi.spyOn($eXeHiddenImage, 'sendScore').mockImplementation(() => {});
      vi.spyOn($eXeHiddenImage, 'saveEvaluation').mockImplementation(() => {});
      vi.spyOn($eXeHiddenImage, 'hideSquares').mockImplementation(() => {});
      vi.spyOn($eXeHiddenImage, 'drawSolution').mockImplementation(() => {});
      vi.spyOn($eXeHiddenImage, 'updateScore').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('reports without waiting for the reveal', () => {
      setupAnswer();

      $eXeHiddenImage.answerQuestion(true, 0);

      // hideSquares is stubbed, so nothing deferred has run yet.
      expect($eXeHiddenImage.sendScore).toHaveBeenCalledWith(true, 0);
    });

    it('does not report when the activity is not scored', () => {
      setupAnswer({ isScorm: 0 });

      $eXeHiddenImage.answerQuestion(true, 0);

      expect($eXeHiddenImage.sendScore).not.toHaveBeenCalled();
    });

    // An intermediate answer must not close the attempt: the page would go to
    // passed/failed while the learner is still playing.
    it('leaves the activity unfinished while questions remain', () => {
      setupAnswer({ activeQuestion: 0, numberQuestions: 4 });

      $eXeHiddenImage.answerQuestion(true, 0);

      expect($eXeHiddenImage.options[0].gameOver).toBe(false);
    });

    // The last answer must carry the completion, so leaving during the reveal
    // still records a finished activity.
    it('marks the activity finished on the last question, before reporting', () => {
      setupAnswer({ activeQuestion: 3, numberQuestions: 4 });
      let flagWhenReported;
      $eXeHiddenImage.sendScore.mockImplementation(() => {
        flagWhenReported = $eXeHiddenImage.options[0].gameOver;
      });

      $eXeHiddenImage.answerQuestion(true, 0);

      expect(flagWhenReported).toBe(true);
    });

    it('clears the previous game-over flag before starting a replay question', () => {
      document.body.innerHTML = '<div id="hiPGameContainer-0"><div class="HIP-StartGame"></div></div>';
      $eXeHiddenImage.options[0] = {
        gameStarted: false,
        gameOver: true,
        scoreGame: 8,
        obtainedClue: true,
        hits: 3,
        errors: 1,
        score: 8,
        gameActived: true,
        activeQuestion: 3,
        validQuestions: 4,
        numberQuestions: 4,
        questionsGame: [{ time: 10 }],
      };
      let flagWhenStartingQuestion;
      vi.spyOn($eXeHiddenImage, 'uptateTime').mockImplementation(() => {});
      vi.spyOn($eXeHiddenImage, 'saveEvaluation').mockImplementation(() => {});
      vi.spyOn($eXeHiddenImage, 'newQuestion').mockImplementation(() => {
        flagWhenStartingQuestion = $eXeHiddenImage.options[0].gameOver;
      });

      $eXeHiddenImage.startGame(0);

      expect(flagWhenStartingQuestion).toBe(false);
      expect($eXeHiddenImage.options[0].gameOver).toBe(false);
    });
  });
});
