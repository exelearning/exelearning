/**
 * Unit tests for padlock iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - addZero: Pads single digit numbers
 * - getTimeToString: Formats time to mm:ss
 * - checkWord: Compares words with normalization
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $padlock globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$padlock\s*=/, 'global.$padlock =');
  // Remove auto-init call: $(function () { $padlock.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$padlock\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$padlock;
}

describe('padlock iDevice export', () => {
  let $padlock;

  beforeEach(() => {
    global.$padlock = undefined;

    const filePath = join(__dirname, 'padlock.js');
    const code = readFileSync(filePath, 'utf-8');

    $padlock = loadExportIdevice(code);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    $(window).off('unload.eXeCandado beforeunload.eXeCandado');
    document.body.innerHTML = '';
  });

  describe('addZero', () => {
    it('adds zero to single digit numbers', () => {
      expect($padlock.addZero(0)).toBe('00');
      expect($padlock.addZero(5)).toBe('05');
      expect($padlock.addZero(9)).toBe('09');
    });

    it('returns number as-is for double digits', () => {
      expect($padlock.addZero(10)).toBe(10);
      expect($padlock.addZero(59)).toBe(59);
    });
  });

  describe('getTimeToString', () => {
    it('formats zero seconds', () => {
      expect($padlock.getTimeToString(0)).toBe('00:00');
    });

    it('formats seconds only', () => {
      expect($padlock.getTimeToString(30)).toBe('00:30');
      expect($padlock.getTimeToString(59)).toBe('00:59');
    });

    it('formats minutes and seconds', () => {
      expect($padlock.getTimeToString(60)).toBe('01:00');
      expect($padlock.getTimeToString(90)).toBe('01:30');
    });

    it('pads single digits with zeros', () => {
      expect($padlock.getTimeToString(65)).toBe('01:05');
    });

    it('handles large values', () => {
      expect($padlock.getTimeToString(3599)).toBe('59:59');
    });
  });

  describe('checkWord', () => {
    it('returns true for identical words', () => {
      expect($padlock.checkWord('hello', 'hello')).toBe(true);
    });

    it('is case insensitive (converts to uppercase)', () => {
      expect($padlock.checkWord('Hello', 'HELLO')).toBe(true);
      expect($padlock.checkWord('WORLD', 'world')).toBe(true);
    });

    it('trims whitespace', () => {
      expect($padlock.checkWord('  hello  ', 'hello')).toBe(true);
    });

    it('normalizes multiple spaces', () => {
      expect($padlock.checkWord('hello   world', 'hello world')).toBe(true);
    });

    it('removes trailing punctuation', () => {
      expect($padlock.checkWord('hello.', 'hello')).toBe(true);
      expect($padlock.checkWord('hello,', 'hello')).toBe(true);
      expect($padlock.checkWord('hello;', 'hello')).toBe(true);
    });

    it('returns false for different words', () => {
      expect($padlock.checkWord('hello', 'world')).toBe(false);
    });

    it('handles pipe-separated alternatives', () => {
      expect($padlock.checkWord('cat', 'cat|dog|bird')).toBe(true);
      expect($padlock.checkWord('dog', 'cat|dog|bird')).toBe(true);
      expect($padlock.checkWord('bird', 'cat|dog|bird')).toBe(true);
      expect($padlock.checkWord('fish', 'cat|dog|bird')).toBe(false);
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($padlock.borderColors).toBeDefined();
      expect($padlock.borderColors.black).toBe('#1c1b1b');
      expect($padlock.borderColors.blue).toBe('#5877c6');
      expect($padlock.borderColors.green).toBe('#2a9315');
      expect($padlock.borderColors.red).toBe('#ff0000');
      expect($padlock.borderColors.white).toBe('#ffffff');
      expect($padlock.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('options', () => {
    it('is defined', () => {
      expect($padlock.options).toBeDefined();
    });
  });

  describe('progress report save', () => {
    it('uses the current activity score when saving results', () => {
      const saveEvaluation = vi.fn();
      global.$exeDevices.iDevice.gamification.report = { saveEvaluation };
      $padlock.options[0] = { score: 0 };

      $padlock.saveEvaluation(0);

      expect($padlock.options[0].scorerp).toBe(0);
      expect(saveEvaluation).toHaveBeenCalledWith($padlock.options[0], false);
    });

    it('saves results when the manual score button is clicked', () => {
      vi.useFakeTimers();
      const updateEvaluationIcon = vi.fn();
      global.$exeDevices.iDevice.gamification.report = {
        saveEvaluation: vi.fn(),
        updateEvaluationIcon,
      };
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="candadoMainContainer-0">
            <button class="Games-SendScore">Save</button>
          </div>
        </article>`;
      $padlock.options[0] = {
        candadoReboot: false,
        candadoShowMinimize: true,
        candadoTime: 1,
        id: 'padlock-test',
        isScorm: 0,
        score: 4,
      };
      $padlock.sendScore = vi.fn();
      $padlock.saveEvaluation = vi.fn();
      $padlock.getCandadoData = vi.fn(() => false);

      $padlock.addEvents(0);
      $('.Games-SendScore').trigger('click');
      vi.runOnlyPendingTimers();

      expect($padlock.sendScore).toHaveBeenCalledWith(false, 0);
      expect($padlock.saveEvaluation).toHaveBeenCalledWith(0);
      expect(updateEvaluationIcon).toHaveBeenCalledWith($padlock.options[0], $padlock.isInExe);
    });
  });

  describe('answerActivity', () => {
    it('marks the game over and sends the SCORM score when the correct solution is checked', () => {
      document.body.innerHTML = `
        <input id="candadoSolution-0">
        <p id="candadoPInformation-0"></p>`;
      const sendScoreNew = vi.fn();
      global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = sendScoreNew;
      global.$exeDevices.iDevice.gamification.report = { saveEvaluation: vi.fn() };
      $padlock.options[0] = {
        candadoSolution: 'OPENME',
        isScorm: 1,
        main: 'candadoMainContainer-0',
        msgs: { msgYouScore: 'Score' },
        previousScore: '',
        score: 0,
      };
      // showFeedback performs heavy DOM/LaTeX work; keep just the SCORM path.
      vi.spyOn($padlock, 'showFeedback').mockImplementation((i) => {
        $padlock.sendScore(true, i);
      });
      $('#candadoSolution-0').val('openme');

      $padlock.answerActivity(0);

      expect($padlock.options[0].gameOver).toBe(true);
      expect($padlock.options[0].gameStarted).toBe(false);
      expect(sendScoreNew).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          gameOver: true,
          gameStarted: false,
          scorerp: 10,
        }),
      );
    });

    it('does not flag the game over for a wrong solution', () => {
      document.body.innerHTML = `
        <input id="candadoSolution-0">
        <p id="candadoPInformation-0"></p>`;
      const sendScoreNew = vi.fn();
      global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = sendScoreNew;
      $padlock.options[0] = {
        candadoAttemps: 0,
        candadoErrorMessage: '',
        candadoErrors: 0,
        candadoSolution: 'OPENME',
        isScorm: 1,
        main: 'candadoMainContainer-0',
        msgs: { msgErrorCode: 'Wrong', msgFailures: 'try' },
        score: 0,
      };
      $('#candadoSolution-0').val('nope');

      $padlock.answerActivity(0);

      expect($padlock.options[0].gameOver).toBeUndefined();
      expect(sendScoreNew).not.toHaveBeenCalled();
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($padlock.idevicePath).toBe('');
    });
  });
});
