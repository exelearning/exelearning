/**
 * Unit tests for az-quiz-game iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getRealLetter: Converts 0/1 codes to L·L/SS special characters
 * - getCaracterLetter: Converts L·L/SS special characters to 0/1 codes
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $azquizgame globally.
 * Replaces 'var $azquizgame' with 'global.$azquizgame' to make it accessible.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$azquizgame\s*=/, 'global.$azquizgame =');
  // Remove the auto-init call, whichever form the export uses:
  // $(function () { $azquizgame.init(); }); or $(() => { $azquizgame.init(); });
  modifiedCode = modifiedCode.replace(
    /\$\(\s*(?:function\s*\(\)|\(\)\s*=>)\s*\{\s*\$azquizgame\.init\(\);\s*\}\s*\);?/g,
    ''
  );
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$azquizgame;
}

describe('az-quiz-game iDevice export', () => {
  let $azquizgame;

  beforeEach(() => {
    global.$azquizgame = undefined;

    const filePath = join(__dirname, 'az-quiz-game.js');
    const code = readFileSync(filePath, 'utf-8');

    $azquizgame = loadExportIdevice(code);
  });

  describe('getRealLetter', () => {
    it('converts 0 to L·L', () => {
      expect($azquizgame.getRealLetter('0')).toBe('L·L');
    });

    it('converts 1 to SS', () => {
      expect($azquizgame.getRealLetter('1')).toBe('SS');
    });

    it('returns regular letter unchanged', () => {
      expect($azquizgame.getRealLetter('A')).toBe('A');
      expect($azquizgame.getRealLetter('Z')).toBe('Z');
      expect($azquizgame.getRealLetter('Ñ')).toBe('Ñ');
    });

    it('returns empty string unchanged', () => {
      expect($azquizgame.getRealLetter('')).toBe('');
    });
  });

  describe('getCaracterLetter', () => {
    it('converts L·L to 0', () => {
      expect($azquizgame.getCaracterLetter('L·L')).toBe('0');
    });

    it('converts SS to 1', () => {
      expect($azquizgame.getCaracterLetter('SS')).toBe('1');
    });

    it('returns regular letter unchanged', () => {
      expect($azquizgame.getCaracterLetter('A')).toBe('A');
      expect($azquizgame.getCaracterLetter('Z')).toBe('Z');
      expect($azquizgame.getCaracterLetter('Ñ')).toBe('Ñ');
    });

    it('returns empty string unchanged', () => {
      expect($azquizgame.getCaracterLetter('')).toBe('');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($azquizgame.colors).toBeDefined();
      expect($azquizgame.colors.black).toBe('#f9f9f9');
      expect($azquizgame.colors.white).toBe('#ffffff');
      expect($azquizgame.colors.blue).toBe('#5877c6');
      expect($azquizgame.colors.green).toBe('#00a300');
      expect($azquizgame.colors.red).toBe('#b3092f');
      expect($azquizgame.colors.yellow).toBe('#f3d55a');
    });
  });

  describe('mcanvas', () => {
    it('has default canvas dimensions', () => {
      expect($azquizgame.mcanvas).toBeDefined();
      expect($azquizgame.mcanvas.width).toBe(360);
      expect($azquizgame.mcanvas.height).toBe(360);
    });
  });

  describe('radiusLetter', () => {
    it('has default radius value', () => {
      expect($azquizgame.radiusLetter).toBe(16);
    });
  });

  describe('init', () => {
    it('exists as a function', () => {
      expect(typeof $azquizgame.init).toBe('function');
    });
  });

  describe('options', () => {
    it('is initialized as an empty array', () => {
      expect($azquizgame.options).toEqual([]);
    });
  });

  describe('loadDataGame', () => {
    beforeEach(() => {
      // Mock $exeDevices.iDevice.gamification
      global.$exeDevices = {
        iDevice: {
          gamification: {
            helpers: {
              decrypt: (json) => json,
              isJsonString: (json) => JSON.parse(json),
            },
            media: {
              extractURLGD: (url) => url,
            },
          },
        },
      };
    });

    afterEach(() => {
      delete global.$exeDevices;
    });

    it('sets durationGame to 240 when not defined in JSON', () => {
      const mockData = {
        text: () => JSON.stringify({
          wordsGame: [],
        }),
      };
      const mockImgsLink = { each: () => {} };
      const mockAudiosLink = { each: () => {} };

      const result = $azquizgame.loadDataGame(mockData, mockImgsLink, mockAudiosLink, 0);

      expect(result.durationGame).toBe(240);
    });

    it('preserves durationGame when defined in JSON', () => {
      const mockData = {
        text: () => JSON.stringify({
          wordsGame: [],
          durationGame: 300,
        }),
      };
      const mockImgsLink = { each: () => {} };
      const mockAudiosLink = { each: () => {} };

      const result = $azquizgame.loadDataGame(mockData, mockImgsLink, mockAudiosLink, 0);

      expect(result.durationGame).toBe(300);
    });

    it('sets default values for modeBoard, evaluation, and evaluationID', () => {
      const mockData = {
        text: () => JSON.stringify({
          wordsGame: [],
        }),
      };
      const mockImgsLink = { each: () => {} };
      const mockAudiosLink = { each: () => {} };

      const result = $azquizgame.loadDataGame(mockData, mockImgsLink, mockAudiosLink, 0);

      expect(result.modeBoard).toBe(false);
      expect(result.evaluation).toBe(false);
      expect(result.evaluationID).toBe('');
      expect(result.playerAudio).toBe('');
      expect(result.gameOver).toBe(false);
    });
  });

  describe('page lifecycle', () => {
    // The SCORM runtime owns the end of the session (pagehide / visibilitychange).
    // An activity must never finish itself when the page is hidden: a learner who
    // navigates away, switches tab or lets the browser freeze the page mid-rosco
    // would otherwise be reported as finished with the score of the moment — a
    // fail below the threshold — and the completion flag survives in
    // cmi.suspend_data, so the attempt is closed for good.
    // addEvents() ends by scheduling a 500 ms timer that refreshes the verdict
    // icon through $exeDevices. Under real timers it outlives the test: the
    // teardown below deletes the global, the callback fires afterwards and
    // throws ReferenceError from outside any test, which Vitest reports as an
    // unhandled error and which fails the whole run even though every test
    // passed. Fake timers keep that callback inside the test, where the mock
    // still exists and the assertion can see it.
    beforeEach(() => {
      vi.useFakeTimers();
      // An earlier suite in this file removes the shared mock; rebuild the surface
      // addEvents touches. The scorm helpers are what the hide handler used to call.
      global.$exeDevices = {
        iDevice: {
          gamification: {
            scorm: { endScorm: vi.fn(), registerActivity: vi.fn() },
            media: { stopSound: vi.fn(), playSound: vi.fn() },
            helpers: { toggleFullscreen: vi.fn(), getTimeToString: vi.fn(() => '00:00') },
            report: { updateEvaluationIcon: vi.fn() },
          },
        },
      };
    });

    afterEach(() => {
      // Order matters: drop anything still pending BEFORE the global it reads
      // goes away, and hand the clock back so the next suite in this file runs
      // on real timers, exactly as it did before.
      vi.clearAllTimers();
      vi.useRealTimers();
      delete global.$exeDevices;
    });

    it('does not finish a running game when the page is hidden', () => {
      document.body.innerHTML = `
        <div id="roscoMainContainer-0">
          <div id="roscoTypeGame-0"></div>
          <canvas id="roscoCanvas-0"></canvas>
        </div>
      `;
      // happy-dom has no 2D context; addEvents only needs one it can draw on.
      const getContext = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue(new Proxy({}, { get: () => vi.fn() }));
      $azquizgame.options[0] = {
        isScorm: 0,
        gameStarted: true,
        gameOver: false,
        itinerary: { showCodeAccess: false },
        wordsGame: [],
        msgs: {},
        instructions: '',
        title: '',
        author: '',
        durationGame: 0,
        numberTurns: 1,
      };
      // Board drawing is not what this test is about.
      $azquizgame.drawRosco = vi.fn();
      $azquizgame.drawRows = vi.fn();
      $azquizgame.drawText = vi.fn();
      $azquizgame.gameOver = vi.fn();
      $azquizgame.sendScore = vi.fn();

      const { report } = $exeDevices.iDevice.gamification;

      $azquizgame.addEvents(0);
      try {
        // Run the icon refresh here rather than letting it escape the test.
        // removeEvents() unbinds handlers but holds no timer id, so this is the
        // only place that can account for it.
        vi.advanceTimersByTime(500);
        $(window).trigger('pagehide');
      } finally {
        $azquizgame.removeEvents(0);
        getContext.mockRestore();
        document.body.innerHTML = '';
      }

      // The refresh reads the activity this instance is playing.
      expect(report.updateEvaluationIcon).toHaveBeenCalledTimes(1);
      expect(report.updateEvaluationIcon.mock.calls[0][0]).toBe($azquizgame.options[0]);
      expect($azquizgame.gameOver).not.toHaveBeenCalled();
      expect($azquizgame.sendScore).not.toHaveBeenCalled();
    });
  });

  // The automatic report used to happen from showWord(), i.e. only once the
  // setTimeout that reveals the next word had elapsed. That put the mark in the
  // LMS one to four seconds late, and a learner who left during that window
  // lost the answer: the timer never fired.
  describe('reporting in the same turn the learner answered', () => {
    function setupAnswer(overrides) {
      document.body.innerHTML = `
        <div id="roscoMainContainer-0">
          <div id="roscoPShowClue-0"></div>
          <div id="roscotPHits-0"></div>
          <div id="roscotPErrors-0"></div>
          <div id="roscoEdReply-0"></div>
        </div>`;
      $azquizgame.options[0] = Object.assign(
        {
          id: 0,
          isScorm: 1,
          gameStarted: true,
          gameActived: true,
          gameOver: false,
          hits: 1,
          errors: 0,
          validWords: 4,
          answeredWords: 0,
          activeWord: 0,
          letters: ['A', 'B', 'C', 'D'],
          wordsGame: [
            { word: 'uno', answer: 'uno', state: 0 },
            { word: 'dos', answer: 'dos', state: 0 },
            { word: 'tres', answer: 'tres', state: 0 },
            { word: 'cuatro', answer: 'cuatro', state: 0 },
          ],
          showSolution: false,
          timeShowSolution: 1,
          itinerary: { showClue: false, percentageClue: 0 },
          obtainedClue: false,
          msgs: { msgInformation: 'info', msgYouScore: 'Score' },
        },
        overrides
      );
      vi.spyOn($azquizgame, 'drawRosco').mockImplementation(() => {});
      vi.spyOn($azquizgame, 'drawMessage').mockImplementation(() => {});
      vi.spyOn($azquizgame, 'newWord').mockImplementation(() => {});
      vi.spyOn($azquizgame, 'sendScore').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('reports before the reveal timer runs, not after it', () => {
      vi.useFakeTimers();
      setupAnswer();

      $azquizgame.answerQuetionBoard(0, 0);

      // No timer has been advanced: the report has to have gone out already.
      expect($azquizgame.sendScore).toHaveBeenCalledWith(true, 0);

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('does not report when the activity is not in automatic SCORM mode', () => {
      vi.useFakeTimers();
      setupAnswer({ isScorm: 0 });

      $azquizgame.answerQuetionBoard(0, 0);

      expect($azquizgame.sendScore).not.toHaveBeenCalled();

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    // An intermediate answer must not close the attempt: the page would go to
    // passed/failed while the learner is still playing. The active letter says
    // nothing here — the rosco comes back to the words that were skipped — so
    // what decides is answeredWords against validWords.
    it('leaves the activity unfinished while words remain', () => {
      vi.useFakeTimers();
      setupAnswer({ activeWord: 3, answeredWords: 0 });

      $azquizgame.answerQuetionBoard(0, 0);

      expect($azquizgame.options[0].gameOver).toBe(false);

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    // The last answer has to carry the completion, so a learner who leaves
    // during the reveal delay still has a finished activity recorded.
    it('marks the activity finished on the last word, before reporting', () => {
      vi.useFakeTimers();
      setupAnswer({ activeWord: 0, answeredWords: 3 });
      let flagWhenReported;
      $azquizgame.sendScore.mockImplementation(() => {
        flagWhenReported = $azquizgame.options[0].gameOver;
      });

      $azquizgame.answerQuetionBoard(0, 0);

      expect(flagWhenReported).toBe(true);

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    // newWord() returns at once while gameOver is up, so the ending has to be
    // called directly. Routing it through newWord() would leave the rosco with
    // no closing message and no start button.
    it('runs the ending after the reveal, not through newWord', () => {
      vi.useFakeTimers();
      setupAnswer({ activeWord: 0, answeredWords: 3 });
      const endSpy = vi
        .spyOn($azquizgame, 'gameOver')
        .mockImplementation(() => {});

      $azquizgame.answerQuetionBoard(0, 0);
      vi.runAllTimers();

      expect(endSpy).toHaveBeenCalledWith(0, 0);
      expect($azquizgame.newWord).not.toHaveBeenCalled();

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    // saveScormScore is the single entry point the three call sites share
    // (startGame, answerQuetion, answerQuetionBoard), so its mode guard is
    // pinned once here rather than through each of them.
    it('saveScormScore reports only in automatic SCORM mode', () => {
      setupAnswer({ isScorm: 1 });
      $azquizgame.saveScormScore(0);
      expect($azquizgame.sendScore).toHaveBeenCalledWith(true, 0);

      $azquizgame.sendScore.mockClear();
      $azquizgame.options[0].isScorm = 2;
      $azquizgame.saveScormScore(0);
      expect($azquizgame.sendScore).not.toHaveBeenCalled();
    });
  });

  // The editor never reloads the document between pages, and a game's ids are
  // numbered by position: the next page's first game takes the ids this one
  // had. The clock used to find that game by id and run it, counting down on
  // its display and ending it when its own time ran out.
  describe('the clock of a game', () => {
    const instance = 0;

    beforeEach(() => {
      vi.useFakeTimers();
      global.$exeDevices = { iDevice: { gamification: { helpers: { getTimeToString: () => '00:00' } } } };
      document.body.innerHTML = `<div id="roscoMainContainer-${instance}"></div>`;
      $azquizgame.options = [{ gameStarted: false, durationGame: 60, wordsGame: [], letters: '', numberTurns: 1 }];
      for (const method of ['updateTime', 'drawRosco', 'gameOver', 'saveScormScore', 'newWord']) {
        vi.spyOn($azquizgame, method).mockImplementation(() => {});
      }
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      delete global.$exeDevices;
      document.body.innerHTML = '';
    });

    it('counts down on its own game', () => {
      $azquizgame.startGame(instance);

      vi.advanceTimersByTime(3000);

      expect($azquizgame.updateTime).toHaveBeenLastCalledWith(58, instance);
    });

    it('ends its own game when the time runs out', () => {
      $azquizgame.startGame(instance);

      vi.advanceTimersByTime(60000);

      expect($azquizgame.gameOver).toHaveBeenCalledWith(1, instance);
    });

    it("leaves the next page's game alone, though it takes the same ids", () => {
      $azquizgame.startGame(instance);
      vi.advanceTimersByTime(1000);

      // The author moves to another page, whose first game is numbered the same.
      document.body.innerHTML = `<div id="roscoMainContainer-${instance}"></div>`;
      $azquizgame.options[instance] = { gameStarted: true, counter: 240 };
      $azquizgame.updateTime.mockClear();
      vi.advanceTimersByTime(120000);

      expect($azquizgame.updateTime).not.toHaveBeenCalled();
      expect($azquizgame.gameOver).not.toHaveBeenCalled();
      expect($azquizgame.options[instance].counter).toBe(240);
    });
  });

  // A picture's pointer is placed once the picture has loaded, or a second
  // after the layout changes. Both reached the game by its number, which in the
  // editor names the next page's game once the author has moved on — where no
  // word is on the board yet, and reading one threw.
  describe('placing the pointer on a picture', () => {
    const instance = 0;

    beforeEach(() => {
      vi.useFakeTimers();
      document.body.innerHTML = `
        <div id="roscoMultimedia-${instance}">
          <img id="roscoImage-${instance}" src="pic.png">
          <div id="roscoCursor-${instance}"></div>
        </div>`;
      $azquizgame.options = [{ activeWord: 0, wordsGame: [{ url: 'pic.png', x: 0, y: 0, author: '', alt: '' }] }];
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      document.body.innerHTML = '';
    });

    it('does nothing when no word is on the board', () => {
      $azquizgame.options[instance].activeWord = -1;

      expect(() => $azquizgame.positionPointer(instance)).not.toThrow();
    });

    it('places it on its own game a second after the layout changed', () => {
      const positionPointer = vi.spyOn($azquizgame, 'positionPointer').mockImplementation(() => {});

      $azquizgame.refreshImageActiveNeo(instance);
      vi.advanceTimersByTime(1000);

      expect(positionPointer).toHaveBeenCalledWith(instance);
    });

    it("leaves the next page's game alone when the page changed within that second", () => {
      const positionPointer = vi.spyOn($azquizgame, 'positionPointer').mockImplementation(() => {});

      $azquizgame.refreshImageActiveNeo(instance);
      $azquizgame.options[instance] = { activeWord: -1, wordsGame: [] };
      vi.advanceTimersByTime(1000);

      expect(positionPointer).not.toHaveBeenCalled();
    });

    it('places it once its own picture has loaded', () => {
      const positionPointer = vi.spyOn($azquizgame, 'positionPointer').mockImplementation(() => {});
      $azquizgame.showImageNeo('pic.png', instance);
      const picture = document.getElementById(`roscoImage-${instance}`);
      Object.defineProperty(picture, 'naturalWidth', { value: 100 });
      Object.defineProperty(picture, 'complete', { value: true });

      $(picture).trigger('load');

      expect(positionPointer).toHaveBeenCalledWith(instance);
    });

    it('does not position a removed picture when the next page has no Rosco', () => {
      $azquizgame.options[instance].wordsGame[0].x = 0.5;
      const positionPointer = vi.spyOn($azquizgame, 'positionPointer');
      $azquizgame.refreshImageActiveNeo(instance);

      document.body.innerHTML = '<p>A page without Rosco</p>';

      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
      expect(positionPointer).not.toHaveBeenCalled();
    });

    it('does not schedule pointer work onto a replacement picture with the same id', () => {
      const positionPointer = vi.spyOn($azquizgame, 'positionPointer');
      $azquizgame.refreshImageActiveNeo(instance);
      document.getElementById('roscoImage-0').outerHTML = '<img id="roscoImage-0">';

      vi.advanceTimersByTime(1000);

      expect(positionPointer).not.toHaveBeenCalled();
    });

    it('ignores a layout refresh with no picture element', () => {
      document.getElementById('roscoImage-0').remove();
      const positionPointer = vi.spyOn($azquizgame, 'positionPointer');
      $azquizgame.refreshImageActiveNeo(instance);

      vi.advanceTimersByTime(1000);

      expect(positionPointer).not.toHaveBeenCalled();
    });

    it('ignores a picture that finished loading after its page was left', () => {
      const positionPointer = vi.spyOn($azquizgame, 'positionPointer').mockImplementation(() => {});
      $azquizgame.showImageNeo('pic.png', instance);
      const picture = document.getElementById(`roscoImage-${instance}`);
      Object.defineProperty(picture, 'naturalWidth', { value: 100 });
      Object.defineProperty(picture, 'complete', { value: true });

      picture.remove();
      $(picture).trigger('load');

      expect(positionPointer).not.toHaveBeenCalled();
    });
  });
});

describe('az-quiz-game minimum score notice', () => {
  let $azquizgame;
  let mainOnPageWhenAsked;

  beforeEach(() => {
    vi.useFakeTimers();
    global.$azquizgame = undefined;
    $azquizgame = loadExportIdevice(readFileSync(join(__dirname, 'az-quiz-game.js'), 'utf-8'));
    mainOnPageWhenAsked = null;
    global.$exeDevices = {
      iDevice: {
        gamification: {
          helpers: {
            decrypt: (json) => json,
            isJsonString: (json) => JSON.parse(json),
            getTimeToString: () => '04:00',
            toggleFullscreen: vi.fn(),
          },
          media: { extractURLGD: (url) => url, stopSound: vi.fn(), playSound: vi.fn() },
          scorm: { registerActivity: vi.fn(), addButtonScoreNew: vi.fn(() => '') },
          observers: { observeResize: vi.fn() },
          math: { updateLatex: vi.fn(), hasLatex: () => false },
          report: {
            updateEvaluationIcon: vi.fn(),
            showPassScoreNotice: vi.fn((game) => {
              mainOnPageWhenAsked = document.getElementById(game.main) !== null;
              return null;
            }),
          },
        },
      },
    };
    const data = {
      letters: 'A',
      wordsGame: [{ letter: 'A', word: 'abeja', definition: 'Insecto', type: 0 }],
      isScorm: 1,
      passScoreMode: 'custom',
      passScoreCustom: 7,
      msgs: { msgPlayStart: 'Play', msgPassScore: 'Pass at %s' },
    };
    document.body.innerHTML = `
      <div class="rosco-IDevice">
        <div class="rosco-version js-hidden">0</div>
        <div class="rosco-instructions">Instructions</div>
        <div class="rosco-DataGame js-hidden">${JSON.stringify(data)}</div>
      </div>`;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete global.$exeDevices;
    document.body.innerHTML = '';
  });

  it('asks for the notice once the main container is on the page', () => {
    // The rosco draws on a canvas, which happy-dom does not implement.
    vi.spyOn($azquizgame, 'addEvents').mockImplementation(() => {});

    $azquizgame.loadGame();

    const showPassScoreNotice = global.$exeDevices.iDevice.gamification.report.showPassScoreNotice;
    expect(showPassScoreNotice).toHaveBeenCalledTimes(1);
    expect(showPassScoreNotice).toHaveBeenCalledWith($azquizgame.options[0]);
    expect($azquizgame.options[0]).toMatchObject({ main: 'roscoMainContainer-0', passScoreCustom: 7 });
    expect(mainOnPageWhenAsked).toBe(true);
  });
});
