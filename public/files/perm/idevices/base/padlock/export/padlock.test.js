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

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($padlock.idevicePath).toBe('');
    });
  });

  // showFeedback is the padlock's only end: its three callers are the correct
  // code, the clock running out and reopening an already solved padlock.
  // common.js derives completion from `gameOver === true || auto !== true` and
  // the report there is automatic, so without the flag a page carrying a
  // padlock stays `incomplete` in the LMS even once the learner has opened it.
  // saveCandadoData stores the mark under `candadoScore`, and this used to read
  // `mOptions.candadoScore` — a key nothing ever puts on the instance — so it
  // always fell through to 0. A learner who had solved the padlock came back to
  // a restored 0, and startGame's early path reports it: a passed page turned
  // into a failed one just by being revisited.
  describe('restoring a saved padlock', () => {
    function setupRestore(stored) {
      document.body.innerHTML = `
        <div id="candadoMainContainer-0"></div>
        <div id="candadoTimeNumber-0"></div>
        <div id="candadoPTime-0"></div>`;
      $padlock.options[0] = {
        id: 0,
        isScorm: 1,
        candadoTime: 5,
        candadoReboot: false,
        candadoShowMinimize: true,
        score: 0,
        msgs: {},
      };
      vi.spyOn($padlock, 'getCandadoData').mockReturnValue(stored);
      vi.spyOn($padlock, 'uptateTime').mockImplementation(() => {});
      vi.spyOn($padlock, 'sendScore').mockImplementation(() => {});
      vi.spyOn($padlock, 'startGame').mockImplementation(() => {});
      vi.spyOn($padlock, 'saveEvaluation').mockImplementation(() => {});
      global.$exeDevices.iDevice.gamification.scorm.registerActivity = vi.fn();
      global.$exeDevices.iDevice.gamification.report = {
        updateEvaluationIcon: vi.fn(),
      };
      global.localStorage = { removeItem: vi.fn(), setItem: vi.fn() };
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    // Without retries the learner cannot solve it again, so a finished padlock
    // must never reopen the attempt: startGame shows the result and returns,
    // and showFeedback reports with gameOver up (pinned below), which is what
    // keeps the page on passed/failed instead of falling back to incomplete.
    describe('a finished padlock without retries stays finished', () => {
      function setupFinished(overrides) {
        document.body.innerHTML = '<div id="candadoMainContainer-0"></div>';
        $padlock.options[0] = Object.assign(
          {
            id: 0,
            isScorm: 1,
            candadoTime: 5,
            candadoReboot: false,
            candadoSolved: true,
            counter: 30,
            score: 10,
            msgs: {},
          },
          overrides
        );
        vi.spyOn($padlock, 'showFeedback').mockImplementation(() => {});
        vi.useFakeTimers();
      }

      afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
      });

      it.each([
        ['solved', 10],
        ['closed by the clock', 0],
      ])('shows the result of a padlock %s instead of running the clock', (_label, score) => {
        setupFinished({ score });

        $padlock.startGame(0);

        // `false`: painting the stored result on page load must not report —
        // the learner has done nothing and the registry already restored the
        // mark from cmi.suspend_data.
        expect($padlock.showFeedback).toHaveBeenCalledWith(0, false);
        // No countdown and no reopened attempt: the mark and the status stand.
        expect(vi.getTimerCount()).toBe(0);
        expect($padlock.options[0].gameStarted).not.toBe(true);
        expect($padlock.options[0].score).toBe(score);
      });
    });

    // An untimed padlock never starts a countdown, so the board must not carry
    // a clock icon and a 00:00 that will never move. The code used to hide two
    // ids the export markup has never had, so nothing was hidden.
    describe('an untimed padlock hides the clock', () => {
      function setupBoard(candadoTime) {
        document.body.innerHTML = `
          <div id="candadoMainContainer-0"></div>
          <strong id="candadoTimeLabel-0"></strong>
          <div id="candadoTimeIcon-0"></div>
          <p id="candadoPTime-0">00:00</p>`;
        $padlock.options[0] = {
          id: 0,
          isScorm: 0,
          candadoTime,
          candadoReboot: false,
          candadoShowMinimize: true,
          score: 0,
          msgs: {},
        };
        vi.spyOn($padlock, 'getCandadoData').mockReturnValue(null);
        vi.spyOn($padlock, 'uptateTime').mockImplementation(() => {});
        vi.spyOn($padlock, 'startGame').mockImplementation(() => {});
        global.$exeDevices.iDevice.gamification.report = {
          updateEvaluationIcon: vi.fn(),
        };
        global.localStorage = { removeItem: vi.fn(), setItem: vi.fn() };
      }

      it.each(['candadoTimeLabel-0', 'candadoTimeIcon-0', 'candadoPTime-0'])(
        'hides %s when there is no time',
        id => {
          setupBoard(0);

          $padlock.addEvents(0);

          expect(document.getElementById(id).style.display).toBe('none');
        }
      );

      it('leaves the clock in place when the padlock is timed', () => {
        setupBoard(5);

        $padlock.addEvents(0);

        expect(document.getElementById('candadoPTime-0').style.display).not.toBe('none');
        expect(document.getElementById('candadoTimeIcon-0').style.display).not.toBe('none');
      });
    });

    it('restores the mark the learner had earned', () => {
      setupRestore({
        candadoSolved: true,
        counter: 120,
        candadoTime: 5,
        candadoReboot: false,
        candadoScore: 10,
      });

      $padlock.addEvents(0);

      expect($padlock.options[0].score).toBe(10);
    });

    it('registers the activity before the first report goes out', () => {
      setupRestore({
        candadoSolved: true,
        counter: 120,
        candadoTime: 5,
        candadoReboot: false,
        candadoScore: 10,
      });
      // registerActivity resolves the node id from the DOM, and reportActivity
      // drops any report that arrives without one — so a padlock restored as
      // solved used to throw away the very mark it was restoring.
      global.$exeDevices.iDevice.gamification.scorm.registerActivity = vi.fn(
        game => {
          game.ideviceId = 'ide-padlock';
        }
      );
      let idWhenReported = null;
      $padlock.sendScore.mockImplementation(() => {
        idWhenReported = $padlock.options[0].ideviceId;
      });

      $padlock.addEvents(0);

      expect($padlock.sendScore).toHaveBeenCalled();
      expect(idWhenReported).toBe('ide-padlock');
    });

    it('restores a zero when nothing was scored', () => {
      setupRestore({
        candadoSolved: false,
        counter: 120,
        candadoTime: 5,
        candadoReboot: false,
        candadoScore: 0,
      });

      $padlock.addEvents(0);

      expect($padlock.options[0].score).toBe(0);
    });

    // With retries allowed, reopening the page discards the finished attempt
    // and starts the clock again from the full time. That is the retry, and it
    // happens on load, so the LMS has to be told on load: the page used to keep
    // the previous passed/failed and its mark while a fresh clock ran.
    describe('reopening a solved padlock that allows retries', () => {
      function setupRetry() {
        setupRestore({
          candadoSolved: true,
          counter: 30,
          candadoTime: 5,
          candadoReboot: true,
          candadoScore: 10,
        });
        $padlock.options[0].candadoReboot = true;
      }

      // Loading a page changes no mark. The board is reset and the clock starts
      // again, but the previous passed/failed stands until this retry produces
      // an outcome: the score moves only when the learner enters the code or
      // the clock runs out.
      it('changes nothing in the LMS', () => {
        setupRetry();

        $padlock.addEvents(0);

        // Not merely "no score sent": the attempt is never declared open, which
        // is what makes sendScoreNew drop the report in addEvents.
        expect($padlock.options[0].gameStarted).not.toBe(true);
        expect($padlock.options[0].gameOver).not.toBe(true);
      });

      it('drops the stored attempt so the clock starts from the full time', () => {
        setupRetry();

        $padlock.addEvents(0);

        expect(global.localStorage.removeItem).toHaveBeenCalledWith('dataCandado-0');
        expect($padlock.options[0].candadoSolved).toBe(false);
        expect($padlock.options[0].counter).toBe(5 * 60);
      });

      it('leaves a padlock without retries alone', () => {
        setupRestore({
          candadoSolved: true,
          counter: 30,
          candadoTime: 5,
          candadoReboot: false,
          candadoScore: 10,
        });

        $padlock.addEvents(0);

        // Terminal attempt: nothing is discarded and no attempt is declared
        // open, so startGame shows the result instead of running the clock.
        // `not.toBe(true)` rather than `toBe(false)`: loadDataGame is what
        // initialises the flag, and this harness builds the options directly.
        expect($padlock.options[0].gameStarted).not.toBe(true);
        expect($padlock.options[0].candadoSolved).toBe(true);
        expect($padlock.options[0].score).toBe(10);
      });
    });
  });

  describe('completion signal', () => {
    function setupPadlock(overrides) {
      document.body.innerHTML = `
        <div id="candadoMainContainer-0"></div>
        <div id="candadoInstructions-0"></div>
        <div id="candadoFeedRetro-0"></div>
        <div id="candadoSolutionDiv-0"></div>
        <div id="candadoNavigator-0"></div>
        <div id="candadoMessageInfo-0"></div>
        <div id="candadoShowRetro-0"></div>`;
      $padlock.options[0] = Object.assign(
        {
          id: 0,
          gameOver: false,
          candadoStarted: true,
          candadoSolved: false,
          counter: 0,
          score: 10,
          isScorm: 0,
          msgs: {},
        },
        overrides
      );
      vi.spyOn($padlock, 'saveEvaluation').mockImplementation(() => {});
      vi.spyOn($padlock, 'uptateTime').mockImplementation(() => {});
      // showFeedback checks the container for LaTeX through the shared helper;
      // this suite does not load the gamification stubs, so provide just that.
      global.$exeDevices = global.$exeDevices || {};
      global.$exeDevices.iDevice = global.$exeDevices.iDevice || {};
      global.$exeDevices.iDevice.gamification =
        global.$exeDevices.iDevice.gamification || {};
      global.$exeDevices.iDevice.gamification.math = {
        hasLatex: vi.fn(() => false),
        updateLatex: vi.fn(),
      };
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('marks the activity finished, so the page can leave incomplete', () => {
      setupPadlock();

      $padlock.showFeedback(0);

      expect($padlock.options[0].gameOver).toBe(true);
    });

    // Only the two callers that resolve the padlock report: the learner
    // entering the code and the clock running out. Painting the stored result
    // on page load must not, or merely visiting a page would write and commit
    // a score nobody has just earned.
    it('stays quiet when it only paints a stored result', () => {
      setupPadlock({ isScorm: 1 });
      vi.spyOn($padlock, 'sendScore').mockImplementation(() => {});

      $padlock.showFeedback(0, false);

      expect($padlock.sendScore).not.toHaveBeenCalled();
      // Still painted and still finished: only the report is held back.
      expect($padlock.options[0].gameOver).toBe(true);
      expect($padlock.options[0].candadoSolved).toBe(true);
    });

    it('raises the flag before it reports, so the two cannot disagree', () => {
      setupPadlock({ isScorm: 1 });
      let flagWhenReported;
      vi.spyOn($padlock, 'sendScore').mockImplementation(() => {
        flagWhenReported = $padlock.options[0].gameOver;
      });

      $padlock.showFeedback(0);

      expect($padlock.sendScore).toHaveBeenCalledWith(true, 0);
      expect(flagWhenReported).toBe(true);
    });

    // 10 for a padlock opened with the right code, 0 for one the clock closed:
    // right or wrong, nothing in between. The mark is whatever the solve path
    // left on the instance, so showFeedback must not overwrite it — deriving it
    // from candadoSolved would score a restored timeout as a solve, because
    // that flag means "finished" and the timeout path raises it too.
    it.each([
      ['the code was solved', { candadoSolved: true, score: 10 }, 10],
      ['the clock ran out', { candadoSolved: false, score: 0 }, 0],
    ])('reports its own mark when %s', (_name, state, expected) => {
      setupPadlock(Object.assign({ isScorm: 1, counter: 0 }, state));
      const reported = [];
      global.$exeDevices.iDevice.gamification.scorm = {
        sendScoreNew: (auto, game) =>
          reported.push({ auto, scorerp: game.scorerp, gameOver: game.gameOver }),
      };

      $padlock.showFeedback(0);

      expect(reported).toEqual([
        { auto: true, scorerp: expected, gameOver: true },
      ]);
    });
  });
});
