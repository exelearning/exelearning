/**
 * Unit tests for guess iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - clear: Cleans phrase by normalizing whitespace
 * - getShowLetter: Gets array of letter positions to show based on level
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $guess globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  // Mock $exeDevices.iDevice.gamification.colors used at load time
  global.$exeDevices = {
    iDevice: {
      gamification: {
        colors: {
          borderColors: { black: '#000', white: '#fff' },
          backColor: { black: '#000', white: '#fff' }
        }
      }
    }
  };
  let modifiedCode = code.replace(/var\s+\$guess\s*=/, 'global.$guess =');
  // Remove auto-init call: $(function () { $guess.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$guess\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$guess;
}

describe('guess iDevice export', () => {
  let $guess;

  beforeEach(() => {
    global.$guess = undefined;
    global.$exeDevices = undefined;

    const filePath = join(__dirname, 'guess.js');
    const code = readFileSync(filePath, 'utf-8');

    $guess = loadExportIdevice(code);
  });

  describe('clear', () => {
    it('trims whitespace', () => {
      expect($guess.clear('  hello  ')).toBe('hello');
    });

    it('normalizes multiple spaces to single space', () => {
      expect($guess.clear('hello   world')).toBe('hello world');
    });

    it('replaces newlines with space', () => {
      expect($guess.clear('hello\nworld')).toBe('hello world');
      expect($guess.clear('hello\r\nworld')).toBe('hello world');
    });

    it('replaces ampersands with space', () => {
      expect($guess.clear('hello&world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect($guess.clear('')).toBe('');
    });

    it('handles single word', () => {
      expect($guess.clear('hello')).toBe('hello');
    });

    it('handles mixed whitespace characters', () => {
      expect($guess.clear('hello\n\r  &  world')).toBe('hello world');
    });
  });

  describe('getShowLetter', () => {
    it('returns empty array when nivel is 0', () => {
      const result = $guess.getShowLetter('hello', 0);
      expect(result).toHaveLength(0);
    });

    it('returns array with positions when nivel > 0', () => {
      const result = $guess.getShowLetter('hello', 50);
      // 50% of 5 letters = 2 positions
      expect(result).toHaveLength(2);
    });

    it('returns array (note: sorted lexicographically due to .sort() without comparator)', () => {
      const result = $guess.getShowLetter('hello world', 50);
      // The function uses .sort() without comparator, so it sorts as strings
      // This means [10, 4, 2] becomes [10, 2, 4] (lexicographic order)
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns positions within phrase length', () => {
      const phrase = 'test';
      const result = $guess.getShowLetter(phrase, 100);
      result.forEach(pos => {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThan(phrase.length);
      });
    });

    it('returns unique positions', () => {
      const result = $guess.getShowLetter('hello world test', 75);
      const uniquePositions = new Set(result);
      expect(uniquePositions.size).toBe(result.length);
    });

    it('handles 100% level', () => {
      const phrase = 'hi';
      const result = $guess.getShowLetter(phrase, 100);
      // Should return positions for all letters
      expect(result).toHaveLength(phrase.length);
    });
  });

  describe('options', () => {
    it('is initialized as array', () => {
      expect(Array.isArray($guess.options)).toBe(true);
    });
  });

  describe('hasSCORMbutton', () => {
    it('is initially false', () => {
      expect($guess.hasSCORMbutton).toBe(false);
    });
  });

  describe('isInExe', () => {
    it('is initially false', () => {
      expect($guess.isInExe).toBe(false);
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($guess.idevicePath).toBe('');
    });
  });

  // The automatic report used to happen only from newQuestion()/showQuestion(),
  // i.e. once the setTimeout that reveals the next question had elapsed. That
  // put the mark in the LMS seconds late, and a learner who left during that
  // window lost the answer: the timer never fired.
  describe('reporting in the same turn the learner answered', () => {
    function setupAnswer(overrides) {
      document.body.innerHTML = `
        <div id="adivinaMainContainer-0">
          <div id="adivinaPShowClue-0"></div>
          <div id="adivinaModeBoardOK-0"></div>
          <div id="adivinaModeBoardKO-0"></div>
          <div id="adivinaModeBoardMoveOn-0"></div>
        </div>`;
      $guess.options[0] = Object.assign(
        {
          id: 0,
          isScorm: 1,
          gameStarted: true,
          gameOver: false,
          hits: 1,
          errors: 0,
          numberQuestions: 4,
          activeQuestion: 0,
          activeCounter: true,
          gameActived: true,
          wordsGame: [
            { word: 'uno' },
            { word: 'dos' },
            { word: 'tres' },
            { word: 'cuatro' },
          ],
          obtainedClue: false,
          itinerary: { showClue: false, percentageClue: 0 },
          msgs: { msgInformation: 'info', msgYouScore: 'Score' },
        },
        overrides
      );
      vi.spyOn($guess, 'updateScore').mockReturnValue(1);
      vi.spyOn($guess, 'sendScore').mockImplementation(() => {});
      vi.spyOn($guess, 'newQuestion').mockImplementation(() => {});
      vi.spyOn($guess, 'showMessage').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('reports before the reveal timer runs, not after it', () => {
      vi.useFakeTimers();
      setupAnswer();

      $guess.answerQuestionBoard(true, 0);

      // No timer has been advanced: the report has to have gone out already.
      expect($guess.sendScore).toHaveBeenCalledWith(true, 0);

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('does not report when the activity is not in automatic SCORM mode', () => {
      vi.useFakeTimers();
      setupAnswer({ isScorm: 0 });

      $guess.answerQuestionBoard(true, 0);

      expect($guess.sendScore).not.toHaveBeenCalled();

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    // An intermediate answer must not close the attempt: the page would go to
    // passed/failed while the learner is still playing.
    it('leaves the activity unfinished while questions remain', () => {
      vi.useFakeTimers();
      setupAnswer({ activeQuestion: 0, numberQuestions: 4 });

      $guess.answerQuestionBoard(true, 0);

      expect($guess.options[0].gameOver).toBe(false);

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    // The last answer must carry the completion, so leaving during the reveal
    // delay still records a finished activity.
    it('marks the activity finished on the last question, before reporting', () => {
      vi.useFakeTimers();
      setupAnswer({ activeQuestion: 3, numberQuestions: 4 });
      let flagWhenReported;
      $guess.sendScore.mockImplementation(() => {
        flagWhenReported = $guess.options[0].gameOver;
      });

      $guess.answerQuestionBoard(true, 0);

      expect(flagWhenReported).toBe(true);

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    // saveScormScore is the single entry point the three call sites share
    // (startGame, answerQuestion, answerQuestionBoard).
    it('saveScormScore reports only in automatic SCORM mode', () => {
      setupAnswer({ isScorm: 1 });
      $guess.saveScormScore(0);
      expect($guess.sendScore).toHaveBeenCalledWith(true, 0);

      $guess.sendScore.mockClear();
      $guess.options[0].isScorm = 2;
      $guess.saveScormScore(0);
      expect($guess.sendScore).not.toHaveBeenCalled();
    });
  });
});
