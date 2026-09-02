/**
 * Unit tests for discover iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - hexToRgba: Hex to RGBA color conversion
 * - clear: String cleanup (whitespace normalization)
 * - createCardsData: Card data structure creation
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeDescubre globally.
 * Replaces 'var $eXeDescubre' with 'global.$eXeDescubre' to make it accessible.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeDescubre\s*=/, 'global.$eXeDescubre =');
  // Remove auto-init call: $(function () { $eXeDescubre.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeDescubre\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeDescubre;
}

describe('discover iDevice export', () => {
  let $eXeDescubre;

  beforeEach(() => {
    global.$eXeDescubre = undefined;

    const filePath = join(__dirname, 'discover.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeDescubre = loadExportIdevice(code);
  });

  describe('hexToRgba', () => {
    it('converts 6-digit hex to rgba with 0.7 opacity', () => {
      expect($eXeDescubre.hexToRgba('#ffffff')).toBe('rgba(255, 255, 255, 0.7)');
    });

    it('converts 3-digit hex to rgba', () => {
      expect($eXeDescubre.hexToRgba('#fff')).toBe('rgba(255, 255, 255, 0.7)');
    });

    it('converts black hex to rgba', () => {
      expect($eXeDescubre.hexToRgba('#000000')).toBe('rgba(0, 0, 0, 0.7)');
    });

    it('converts color hex to rgba', () => {
      expect($eXeDescubre.hexToRgba('#ff0000')).toBe('rgba(255, 0, 0, 0.7)');
      expect($eXeDescubre.hexToRgba('#00ff00')).toBe('rgba(0, 255, 0, 0.7)');
      expect($eXeDescubre.hexToRgba('#0000ff')).toBe('rgba(0, 0, 255, 0.7)');
    });

    it('handles hex without hash prefix', () => {
      expect($eXeDescubre.hexToRgba('ffffff')).toBe('rgba(255, 255, 255, 0.7)');
    });

    it('handles 3-digit hex without hash', () => {
      expect($eXeDescubre.hexToRgba('fff')).toBe('rgba(255, 255, 255, 0.7)');
    });

    it('throws error for invalid hex', () => {
      expect(() => $eXeDescubre.hexToRgba('gggggg')).toThrow();
      expect(() => $eXeDescubre.hexToRgba('#zzzzzz')).toThrow();
    });
  });

  describe('clear', () => {
    it('trims whitespace', () => {
      expect($eXeDescubre.clear('  hello  ')).toBe('hello');
    });

    it('normalizes multiple spaces to single space', () => {
      expect($eXeDescubre.clear('hello   world')).toBe('hello world');
    });

    it('handles newlines and carriage returns', () => {
      expect($eXeDescubre.clear('hello\nworld')).toBe('hello world');
      expect($eXeDescubre.clear('hello\r\nworld')).toBe('hello world');
    });

    it('handles ampersands in whitespace normalization', () => {
      expect($eXeDescubre.clear('hello&world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect($eXeDescubre.clear('')).toBe('');
    });

    it('handles single word', () => {
      expect($eXeDescubre.clear('hello')).toBe('hello');
    });
  });

  describe('createCardsData', () => {
    describe('gameMode 0 (pairs)', () => {
      it('creates card pairs from wordsGame array', () => {
        const wordsGame = [
          {
            data: [
              { url: 'img1.jpg', eText: 'Text1', audio: '', x: 0, y: 0, alt: 'Alt1', color: '#000', backcolor: '#fff' },
              { url: 'img2.jpg', eText: 'Text2', audio: '', x: 0, y: 0, alt: 'Alt2', color: '#000', backcolor: '#fff' },
            ],
          },
        ];

        const result = $eXeDescubre.createCardsData(wordsGame, 0);

        expect(result.length).toBe(2);
        expect(result[0].url).toBe('img1.jpg');
        expect(result[0].eText).toBe('Text1');
        expect(result[1].url).toBe('img2.jpg');
        expect(result[1].eText).toBe('Text2');
      });

      it('sets correct property on first card of each pair', () => {
        const wordsGame = [
          {
            data: [
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
            ],
          },
        ];

        const result = $eXeDescubre.createCardsData(wordsGame, 0);
        expect(result[0].correct).toBe(0);
      });

      it('assigns number property correctly', () => {
        const wordsGame = [
          {
            data: [
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
            ],
          },
          {
            data: [
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
            ],
          },
        ];

        const result = $eXeDescubre.createCardsData(wordsGame, 0);
        expect(result[0].number).toBe(0);
        expect(result[1].number).toBe(0);
        expect(result[2].number).toBe(1);
        expect(result[3].number).toBe(1);
      });
    });

    it('handles empty wordsGame array', () => {
      const result = $eXeDescubre.createCardsData([], 0);
      expect(result).toEqual([]);
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeDescubre.borderColors).toBeDefined();
      expect($eXeDescubre.borderColors.black).toBe('#1c1b1b');
      expect($eXeDescubre.borderColors.white).toBe('#ffffff');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($eXeDescubre.colors).toBeDefined();
      expect($eXeDescubre.colors.black).toBe('#1c1b1b');
      expect($eXeDescubre.colors.white).toBe('#ffffff');
    });
  });

  describe('init', () => {
    it('exists as a function', () => {
      expect(typeof $eXeDescubre.init).toBe('function');
    });
  });

  describe('enable', () => {
    it('exists as a function', () => {
      expect(typeof $eXeDescubre.enable).toBe('function');
    });
  });

  describe('options', () => {
    it('is initialized as an empty array', () => {
      expect($eXeDescubre.options).toEqual([]);
    });
  });

  // common.js derives completion from `gameOver === true || auto !== true`, and
  // the report below is automatic, so without the flag a page carrying a
  // discover stayed `incomplete` in the LMS however well the learner did.
  describe('the countdown across attempts', () => {
    function setupTimedGame(overrides = {}) {
      document.body.innerHTML = `
        <div id="descubreMainContainer-0">
          <div id="descubreMultimedia-0"></div>
          <div id="descubrePShowClue-0"></div>
          <div id="descubreShowClue-0"></div>
          <div id="descubrePHits-0"></div>
          <div id="descubrePErrors-0"></div>
          <div id="descubreCubierta-0"></div>
          <div id="descubreGameOver-0"></div>
          <div id="descubreStartLevels-0"></div>
          <div id="descubreMessage-0"></div>
          <div id="descubrePTime-0"></div>
          <div id="descubreImgTime-0"></div>
        </div>`;
      $eXeDescubre.options[0] = Object.assign(
        {
          id: 0,
          isScorm: 0,
          // 3 seconds: the interval ticks once a second.
          time: 3 / 60,
          gameStarted: false,
          gameOver: false,
          hits: 0,
          errors: 0,
          attempts: 0,
          wordsGame: [{}, {}],
          wordsGameFix: [{}, {}],
          gameLevels: 1,
          numberQuestions: 2,
          itinerary: { showClue: false, percentageClue: 0 },
          msgs: { msgSelectLevel: '', msgRookie: '', msgStar: '' },
        },
        overrides
      );
      // Builds the deck for the chosen level through the shared shuffle
      // helper; irrelevant to the countdown and absent from the test stubs.
      vi.spyOn($eXeDescubre, 'getCardsLevels').mockReturnValue([]);
      vi.spyOn($eXeDescubre, 'addCards').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'initCards').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'showMessage').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'uptateTime').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'showScoreGame').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'saveEvaluation').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'showFeedBack').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'sendScore').mockImplementation(() => {});
    }

    beforeEach(() => {
      vi.useFakeTimers();
      // gameOver() silences the statement audio; absent from the test stubs.
      global.$exeDevices.iDevice.gamification.media = { stopSound: vi.fn() };
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
      delete global.$exeDevices.iDevice.gamification.media;
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    // Asserted on the live timer count, not on the counter: gameOver() clears
    // gameStarted, and the interval body only decrements while that is set, so
    // a surviving interval is invisible in the counter alone.
    // The early return that ends the attempt used to skip the last paint, so
    // the clock jumped from 00:01 to the results screen.
    it('shows the clock reaching zero before ending the attempt', () => {
      setupTimedGame();
      $eXeDescubre.startGame(0, 0);
      $eXeDescubre.options[0].gameStarted = true;
      let clockWhenEnded;
      vi.spyOn($eXeDescubre, 'gameOver').mockImplementation(() => {
        const painted = $eXeDescubre.uptateTime.mock.calls;
        clockWhenEnded = painted[painted.length - 1][0];
      });

      vi.advanceTimersByTime(3000);

      expect(clockWhenEnded).toBe(0);
    });

    it('stops the countdown when the attempt ends', () => {
      setupTimedGame();
      $eXeDescubre.startGame(0, 0);
      $eXeDescubre.options[0].gameStarted = true;
      expect(vi.getTimerCount()).toBe(1);

      $eXeDescubre.gameOver(2, 0);

      expect(vi.getTimerCount()).toBe(0);
    });

    // The level buttons and the play-again button re-enter startGame without
    // passing through rebootGame, so a second game used to run two intervals
    // over the same counter: its clock ticked twice per second and the time
    // ran out in half the time.
    it('never leaves two countdowns running over the same game', () => {
      setupTimedGame();
      $eXeDescubre.startGame(0, 0);
      // Whatever reopened the activity left the flag down without ending the
      // attempt through gameOver().
      $eXeDescubre.options[0].gameStarted = false;

      $eXeDescubre.startGame(0, 0);
      $eXeDescubre.options[0].gameStarted = true;
      vi.advanceTimersByTime(1000);

      expect(vi.getTimerCount()).toBe(1);
      expect($eXeDescubre.options[0].counter).toBe(2);
    });
  });

  describe('completion when every group is discovered', () => {
    function setupPair(overrides) {
      document.body.innerHTML = `
        <div id="descubreMainContainer-0">
          <div id="descubreMultimedia-0"></div>
          <div id="descubrePShowClue-0"></div>
        </div>`;
      $eXeDescubre.options[0] = Object.assign(
        {
          id: 0,
          isScorm: 1,
          gameOver: false,
          hits: 3,
          errors: 0,
          selecteds: [0],
          activeQuestion: 0,
          wordsGame: [{}, {}, {}],
          obtainedClue: false,
          itinerary: { showClue: false, percentageClue: 0 },
          msgs: {},
        },
        overrides
      );
      vi.spyOn($eXeDescubre, 'updateCovers').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'updateScore').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'sendScore').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'showMessage').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'saveEvaluation').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('marks the activity finished on the last group', () => {
      setupPair({ hits: 3, wordsGame: [{}, {}, {}] });

      $eXeDescubre.correctPair(0, 0);

      expect($eXeDescubre.options[0].gameOver).toBe(true);
    });

    // An intermediate pair must not close the attempt.
    it('leaves the activity unfinished while groups remain', () => {
      setupPair({ hits: 1, wordsGame: [{}, {}, {}] });

      $eXeDescubre.correctPair(0, 0);

      expect($eXeDescubre.options[0].gameOver).toBe(false);
    });

    it('raises the flag before it reports, so the two cannot disagree', () => {
      setupPair({ hits: 3, wordsGame: [{}, {}, {}] });
      let flagWhenReported;
      $eXeDescubre.sendScore.mockImplementation(() => {
        flagWhenReported = $eXeDescubre.options[0].gameOver;
      });

      $eXeDescubre.correctPair(0, 0);

      expect(flagWhenReported).toBe(true);
    });
  });
});
