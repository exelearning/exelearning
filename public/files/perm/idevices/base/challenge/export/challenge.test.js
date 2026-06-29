/**
 * Unit tests for challenge iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - createArrayStateChallenges: Creates array of challenge states
 * - checkWord: Compares words with normalization
 * - addZero: Pads single digit numbers
 * - getTimeToString: Formats time to hh:mm:ss
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeDesafio globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeDesafio\s*=/, 'global.$eXeDesafio =');
  // Remove auto-init call: $(function () { $eXeDesafio.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeDesafio\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeDesafio;
}

describe('challenge iDevice export', () => {
  let $eXeDesafio;

  beforeEach(() => {
    global.$eXeDesafio = undefined;

    const filePath = join(__dirname, 'challenge.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeDesafio = loadExportIdevice(code);
  });

  afterEach(() => {
    vi.useRealTimers();
    $(window).off('pagehide.eXeChallenger');
    $(document).off('visibilitychange.eXeChallenger');
    document.body.innerHTML = '';
  });

  describe('createArrayStateChallenges', () => {
    it('creates array with correct length', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 5);
      expect(result).toHaveLength(5);
    });

    it('sets first challenge state to 3 (active)', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 3);
      expect(result[0].state).toBe(3);
    });

    it('sets subsequent challenges to 0 when type is 0', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 3);
      expect(result[1].state).toBe(0);
      expect(result[2].state).toBe(0);
    });

    it('sets subsequent challenges to 1 when type is 1', () => {
      const result = $eXeDesafio.createArrayStateChallenges(1, 3);
      expect(result[1].state).toBe(1);
      expect(result[2].state).toBe(1);
    });

    it('initializes all challenges with solved = 0', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 3);
      result.forEach(challenge => {
        expect(challenge.solved).toBe(0);
      });
    });

    it('handles single challenge', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 1);
      expect(result).toHaveLength(1);
      expect(result[0].state).toBe(3);
    });

    it('handles empty array', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 0);
      expect(result).toHaveLength(0);
    });
  });

  describe('checkWord', () => {
    it('returns true for identical words', () => {
      expect($eXeDesafio.checkWord('hello', 'hello')).toBe(true);
    });

    it('is case insensitive', () => {
      expect($eXeDesafio.checkWord('Hello', 'HELLO')).toBe(true);
      expect($eXeDesafio.checkWord('WORLD', 'world')).toBe(true);
    });

    it('trims whitespace', () => {
      expect($eXeDesafio.checkWord('  hello  ', 'hello')).toBe(true);
    });

    it('normalizes multiple spaces', () => {
      expect($eXeDesafio.checkWord('hello   world', 'hello world')).toBe(true);
    });

    it('removes trailing punctuation', () => {
      expect($eXeDesafio.checkWord('hello.', 'hello')).toBe(true);
      expect($eXeDesafio.checkWord('hello,', 'hello')).toBe(true);
      expect($eXeDesafio.checkWord('hello;', 'hello')).toBe(true);
    });

    it('returns false for different words', () => {
      expect($eXeDesafio.checkWord('hello', 'world')).toBe(false);
    });

    it('handles pipe-separated alternatives in answer', () => {
      expect($eXeDesafio.checkWord('cat|dog|bird', 'cat')).toBe(true);
      expect($eXeDesafio.checkWord('cat|dog|bird', 'dog')).toBe(true);
      expect($eXeDesafio.checkWord('cat|dog|bird', 'bird')).toBe(true);
      expect($eXeDesafio.checkWord('cat|dog|bird', 'fish')).toBe(false);
    });

    it('handles empty strings', () => {
      expect($eXeDesafio.checkWord('', '')).toBe(true);
    });
  });

  describe('addZero', () => {
    it('adds zero to single digit numbers', () => {
      expect($eXeDesafio.addZero(0)).toBe('00');
      expect($eXeDesafio.addZero(5)).toBe('05');
      expect($eXeDesafio.addZero(9)).toBe('09');
    });

    it('returns string for double digit numbers', () => {
      expect($eXeDesafio.addZero(10)).toBe('10');
      expect($eXeDesafio.addZero(59)).toBe('59');
    });

    it('handles larger numbers', () => {
      expect($eXeDesafio.addZero(100)).toBe('100');
    });
  });

  describe('getTimeToString', () => {
    it('formats zero seconds', () => {
      expect($eXeDesafio.getTimeToString(0)).toBe('00:00:00');
    });

    it('formats seconds only', () => {
      expect($eXeDesafio.getTimeToString(30)).toBe('00:00:30');
      expect($eXeDesafio.getTimeToString(59)).toBe('00:00:59');
    });

    it('formats minutes and seconds', () => {
      expect($eXeDesafio.getTimeToString(60)).toBe('00:01:00');
      expect($eXeDesafio.getTimeToString(90)).toBe('00:01:30');
      expect($eXeDesafio.getTimeToString(3599)).toBe('00:59:59');
    });

    it('formats hours, minutes, and seconds', () => {
      expect($eXeDesafio.getTimeToString(3600)).toBe('01:00:00');
      expect($eXeDesafio.getTimeToString(3661)).toBe('01:01:01');
      expect($eXeDesafio.getTimeToString(7200)).toBe('02:00:00');
    });

    it('pads single digits with zeros', () => {
      expect($eXeDesafio.getTimeToString(3723)).toBe('01:02:03');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeDesafio.borderColors).toBeDefined();
      expect($eXeDesafio.borderColors.black).toBe('#1c1b1b');
      expect($eXeDesafio.borderColors.blue).toBe('#5877c6');
      expect($eXeDesafio.borderColors.green).toBe('#2a9315');
      expect($eXeDesafio.borderColors.red).toBe('#ff0000');
      expect($eXeDesafio.borderColors.white).toBe('#ffffff');
      expect($eXeDesafio.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($eXeDesafio.colors).toBeDefined();
      expect($eXeDesafio.colors.black).toBe('#1c1b1b');
    });
  });

  describe('options', () => {
    it('is defined', () => {
      expect($eXeDesafio.options).toBeDefined();
    });
  });

  describe('SVG icon file naming', () => {
    /**
     * Tests for the SVG icon naming convention used in showDesafio.
     * The colorMap maps state numbers to color names:
     * - 0: grey (inactive/default)
     * - 1: blue (selectable)
     * - 2: green (solved correctly)
     * - 3: red (active/current)
     */
    const colorMap = ['grey', 'blue', 'green', 'red'];

    describe('colorMap state mapping', () => {
      it('maps state 0 to grey', () => {
        expect(colorMap[0]).toBe('grey');
      });

      it('maps state 1 to blue', () => {
        expect(colorMap[1]).toBe('blue');
      });

      it('maps state 2 to green', () => {
        expect(colorMap[2]).toBe('green');
      });

      it('maps state 3 to red', () => {
        expect(colorMap[3]).toBe('red');
      });

      it('returns undefined for invalid states', () => {
        expect(colorMap[4]).toBeUndefined();
        expect(colorMap[-1]).toBeUndefined();
      });
    });

    describe('SVG filename generation', () => {
      const generateSvgFilename = (number, state) => {
        const color = colorMap[state] || 'grey';
        return `number${number}_${color}.svg`;
      };

      it('generates correct filename for challenge 1 with grey state', () => {
        expect(generateSvgFilename(1, 0)).toBe('number1_grey.svg');
      });

      it('generates correct filename for challenge 5 with blue state', () => {
        expect(generateSvgFilename(5, 1)).toBe('number5_blue.svg');
      });

      it('generates correct filename for challenge 10 with green state', () => {
        expect(generateSvgFilename(10, 2)).toBe('number10_green.svg');
      });

      it('generates correct filename for challenge 3 with red state', () => {
        expect(generateSvgFilename(3, 3)).toBe('number3_red.svg');
      });

      it('falls back to grey for invalid state', () => {
        expect(generateSvgFilename(1, 99)).toBe('number1_grey.svg');
        expect(generateSvgFilename(1, -1)).toBe('number1_grey.svg');
      });

      it('generates all valid combinations for numbers 1-10', () => {
        const validColors = ['grey', 'blue', 'green', 'red'];
        for (let num = 1; num <= 10; num++) {
          for (let state = 0; state < 4; state++) {
            const filename = generateSvgFilename(num, state);
            expect(filename).toBe(`number${num}_${validColors[state]}.svg`);
          }
        }
      });
    });

    describe('CSS background generation', () => {
      const generateCssBackground = (idevicePath, number, state) => {
        const color = colorMap[state] || 'grey';
        const svgFile = `number${number}_${color}.svg`;
        return `url(${idevicePath}${svgFile}) no-repeat center center`;
      };

      it('generates correct CSS with idevice path', () => {
        const result = generateCssBackground('/files/idevices/', 1, 0);
        expect(result).toBe('url(/files/idevices/number1_grey.svg) no-repeat center center');
      });

      it('generates correct CSS for different states', () => {
        const basePath = 'assets/';
        expect(generateCssBackground(basePath, 2, 1)).toBe('url(assets/number2_blue.svg) no-repeat center center');
        expect(generateCssBackground(basePath, 3, 2)).toBe('url(assets/number3_green.svg) no-repeat center center');
        expect(generateCssBackground(basePath, 4, 3)).toBe('url(assets/number4_red.svg) no-repeat center center');
      });

      it('handles empty idevice path', () => {
        const result = generateCssBackground('', 5, 0);
        expect(result).toBe('url(number5_grey.svg) no-repeat center center');
      });
    });
  });

  describe('challenge state values', () => {
    /**
     * Challenge states correspond to icon colors:
     * - 0: Inactive (grey) - challenge locked
     * - 1: Selectable (blue) - challenge available
     * - 2: Solved (green) - challenge completed correctly
     * - 3: Active (red) - currently selected challenge
     */
    it('state 0 represents inactive/locked challenge', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 3);
      // When type is 0, subsequent challenges should be inactive (grey)
      expect(result[1].state).toBe(0);
    });

    it('state 1 represents selectable/available challenge', () => {
      const result = $eXeDesafio.createArrayStateChallenges(1, 3);
      // When type is 1, subsequent challenges should be selectable (blue)
      expect(result[1].state).toBe(1);
    });

    it('state 3 represents active/current challenge', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 3);
      // First challenge is always active (red)
      expect(result[0].state).toBe(3);
    });
  });

  describe('timeout handling', () => {
    it('saves results before ending the activity by time', () => {
      vi.useFakeTimers();
      document.body.innerHTML = '<div id="desafioMainContainer-0"></div>';
      $eXeDesafio.options[0] = {
        activeChallenge: 0,
        challengesGame: [{ clueTimes: [] }],
        counter: 1,
        gameStarted: false,
        msgs: {
          msgChallengesAllCompleted: 'All challenges completed',
          msgReadTime: 'Read the challenge',
        },
        solvedsChallenges: [],
        timesShow: [0],
        typeQuestion: 0,
      };
      $eXeDesafio.gameOver = vi.fn();
      $eXeDesafio.saveDataStorage = vi.fn();
      $eXeDesafio.saveEvaluation = vi.fn();
      $eXeDesafio.showDesafio = vi.fn();
      $eXeDesafio.showMessage = vi.fn();
      $eXeDesafio.updateTime = vi.fn();

      $eXeDesafio.startGame(0, 0, 0);
      vi.advanceTimersByTime(1000);
      clearInterval($eXeDesafio.options[0].counterClock);

      expect($eXeDesafio.saveEvaluation).toHaveBeenCalledWith(0);
      expect($eXeDesafio.gameOver).toHaveBeenCalledWith(1, 0);
    });
  });

  describe('gameOver persists the completed SCORM state', () => {
    it('sends the score with the completed flag when the game ends (e.g. time-out)', () => {
      const scormHelpers = $exeDevices.iDevice.gamification.scorm;
      const prevSend = scormHelpers.sendScoreNew;
      const sendScoreNew = vi.fn();
      scormHelpers.sendScoreNew = sendScoreNew;

      $eXeDesafio.options[0] = {
        isScorm: 1,
        desafioSolved: false,
        solvedsChallenges: [1, 2],
        challengesGame: [1, 2, 3],
        msgs: {},
        gameStarted: true,
        gameOver: false,
      };

      try {
        $eXeDesafio.gameOver(1, 0); // type 1 = time-out

        // The game is flagged completed so updateActivity records state 2...
        expect($eXeDesafio.options[0].gameOver).toBe(true);
        // ...and the score is sent on game end (it was only sent mid-play before).
        expect(sendScoreNew).toHaveBeenCalledTimes(1);
        const [auto, game] = sendScoreNew.mock.calls[0];
        expect(auto).toBe(true);
        expect(game.gameOver).toBe(true);
      } finally {
        scormHelpers.sendScoreNew = prevSend;
      }
    });
  });

  describe('page lifecycle persistence', () => {
    function lifecycleOptions(overrides = {}) {
      return {
        author: '',
        challengesGame: [],
        desafioType: 0,
        gameStarted: true,
        instructions: '',
        isScorm: 0,
        msgs: { msgDesafioReboot: 'Reboot', msgPlayStart: 'Start' },
        numberQuestions: 0,
        title: '',
        typeQuestion: 0,
        ...overrides,
      };
    }

    it('saves local progress on pagehide and when hidden, without unload events', () => {
      vi.useFakeTimers();
      $eXeDesafio.options[0] = lifecycleOptions();
      $eXeDesafio.changeImageButtonState = vi.fn();
      $eXeDesafio.saveDataStorage = vi.fn();

      $eXeDesafio.addEvents(0);

      // pagehide replaces the deprecated unload/beforeunload save.
      $(window).trigger('pagehide');
      expect($eXeDesafio.saveDataStorage).toHaveBeenCalledWith(0);

      // Becoming hidden also persists (covers the visibilitychange branch).
      $eXeDesafio.saveDataStorage.mockClear();
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      try {
        $(document).trigger('visibilitychange');
        expect($eXeDesafio.saveDataStorage).toHaveBeenCalledWith(0);
      } finally {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      }
    });

    it('does not save on pagehide before the game has started', () => {
      vi.useFakeTimers();
      $eXeDesafio.options[0] = lifecycleOptions({ gameStarted: false });
      $eXeDesafio.changeImageButtonState = vi.fn();
      $eXeDesafio.saveDataStorage = vi.fn();

      $eXeDesafio.addEvents(0);
      $(window).trigger('pagehide');

      expect($eXeDesafio.saveDataStorage).not.toHaveBeenCalled();
    });
  });
});
