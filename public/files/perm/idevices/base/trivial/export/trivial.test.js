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

  // The editor never reloads the document between pages, and a game's ids are
  // numbered by position: the next page's first board takes the ids this one
  // had. The question clock and the dice used to find that board by id and run
  // it; the game clock and the video clock never looked at all, and ran for
  // ever — counting on the next page's board and driving its video.
  describe('the timers of a board', () => {
    const instance = 0;
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    let getTimeSeconds;

    /** The author moves to another page, whose first board is numbered the same. */
    function moveToNextPage(options) {
      document.body.innerHTML = `<div id="trivialMainContainer-${instance}"></div>`;
      $eXeTrivial.options[instance] = options;
    }

    beforeEach(() => {
      vi.useFakeTimers();
      getTimeSeconds = helpers().getTimeSeconds;
      helpers().getTimeSeconds = () => 30;
      document.body.innerHTML = `<div id="trivialMainContainer-${instance}"></div>`;
      $eXeTrivial.options = [
        {
          gameStarted: false,
          numeroJugadores: 1,
          numeroTemas: 4,
          msgs: {},
          temas: [[{ time: 1, type: 0 }]],
          activesQuestions: [-1],
          nombresTemas: ['Tema'],
          localPlayer: { play: vi.fn() },
        },
      ];
      vi.spyOn($eXeTrivial, 'loadPlayers').mockImplementation(() => true);
      for (const method of [
        'loadGameBoard',
        'initCheeses',
        'changePlayer',
        'updateTimeGame',
        'saveScormScore',
        'saveDataStorage',
        'showQuestion',
        'updateTime',
        'updateSoundVideo',
        'questionAnswer',
        'updateTimerDisplayLocal',
        'showTargetPositions',
      ]) {
        vi.spyOn($eXeTrivial, method).mockImplementation(() => {});
      }
    });

    afterEach(() => {
      helpers().getTimeSeconds = getTimeSeconds;
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('counts the game time on its own board', () => {
      $eXeTrivial.startGame(instance);

      vi.advanceTimersByTime(3000);

      expect($eXeTrivial.updateTimeGame).toHaveBeenLastCalledWith(3, instance);
    });

    it("stops counting the game time once its board leaves the page, leaving the next page's alone", () => {
      $eXeTrivial.startGame(instance);
      vi.advanceTimersByTime(1000);

      moveToNextPage({ contadorJuego: 0 });
      $eXeTrivial.updateTimeGame.mockClear();
      vi.advanceTimersByTime(5000);

      expect($eXeTrivial.updateTimeGame).not.toHaveBeenCalled();
      expect($eXeTrivial.options[instance].contadorJuego).toBe(0);
    });

    it('counts down a question on its own board', () => {
      $eXeTrivial.showGameQuestion(0, instance);

      vi.advanceTimersByTime(3000);

      expect($eXeTrivial.updateTime).toHaveBeenLastCalledWith(27, instance);
    });

    it.each([true, false])('delivers a delayed answer (%s) to its own board', correct => {
      $eXeTrivial.scheduleQuestionAnswer(correct, instance, 3000);
      vi.advanceTimersByTime(2999);
      expect($eXeTrivial.questionAnswer).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);

      expect($eXeTrivial.questionAnswer).toHaveBeenCalledExactlyOnceWith(correct, instance);
    });

    it.each(['removed', 'replaced', 'options', 'edition', 'missing'])('drops a delayed answer after its board is %s', change => {
      if (change === 'missing') document.body.innerHTML = '';
      $eXeTrivial.scheduleQuestionAnswer(false, instance, 3000);
      if (change === 'removed') document.body.innerHTML = '';
      if (change === 'replaced') document.body.innerHTML = '<div id="trivialMainContainer-0"></div>';
      if (change === 'options') $eXeTrivial.options[instance] = {};
      if (change === 'edition') document.body.insertAdjacentHTML('beforeend', '<div id="node-content" mode="edition"></div>');

      vi.advanceTimersByTime(3000);

      expect($eXeTrivial.questionAnswer).not.toHaveBeenCalled();
    });

    it('drops the answer queued by an expired question when the next board opens', () => {
      const gamification = global.$exeDevices.iDevice.gamification;
      const media = gamification.media;
      gamification.media = { stopVideo: vi.fn() };
      try {
        $eXeTrivial.showGameQuestion(0, instance);
        $eXeTrivial.options[instance].counter = 1;
        vi.advanceTimersByTime(1000);
        expect($eXeTrivial.options[instance].activeCounter).toBe(false);

        moveToNextPage({ activeCounter: true, counter: 240 });
        vi.advanceTimersByTime(3000);

        expect($eXeTrivial.questionAnswer).not.toHaveBeenCalled();
        expect($eXeTrivial.options[instance].counter).toBe(240);
      } finally {
        gamification.media = media;
      }
    });

    it.each(['text', 'board'])('keeps the %s answer delay on its own board', mode => {
      const gamification = global.$exeDevices.iDevice.gamification;
      const media = gamification.media;
      gamification.media = { stopVideo: vi.fn() };
      vi.spyOn($eXeTrivial, 'getRetroFeedMessages').mockReturnValue('Correct');
      vi.spyOn($eXeTrivial, 'showMessage').mockImplementation(() => {});
      Object.assign($eXeTrivial.options[instance], {
        activeTema: 0,
        activesQuestions: [0],
        activeCounter: true,
        respuesta: 'A',
        temas: [[{ solution: 'A', typeSelect: 0 }]],
      });
      try {
        if (mode === 'text') $eXeTrivial.answerQuestion(instance);
        else $eXeTrivial.answerQuestionBoard(true, instance);
        expect($eXeTrivial.questionAnswer).not.toHaveBeenCalled();

        vi.advanceTimersByTime(3000);

        expect($eXeTrivial.questionAnswer).toHaveBeenCalledExactlyOnceWith(true, instance);
      } finally {
        gamification.media = media;
      }
    });

    it("leaves the next page's question alone, though it takes the same ids", () => {
      $eXeTrivial.showGameQuestion(0, instance);
      vi.advanceTimersByTime(1000);

      moveToNextPage({ activeCounter: true, counter: 30 });
      $eXeTrivial.updateTime.mockClear();
      vi.advanceTimersByTime(60000);

      expect($eXeTrivial.updateTime).not.toHaveBeenCalled();
      expect($eXeTrivial.questionAnswer).not.toHaveBeenCalled();
      expect($eXeTrivial.options[instance].counter).toBe(30);
    });

    it("stops following a question's video once its board leaves the page", () => {
      $eXeTrivial.startVideo('clip.mp4', 0, 10, instance, 1);
      vi.advanceTimersByTime(1000);
      expect($eXeTrivial.updateTimerDisplayLocal).toHaveBeenCalledTimes(1);

      moveToNextPage({ localPlayer: { play: vi.fn() } });
      vi.advanceTimersByTime(5000);

      expect($eXeTrivial.updateTimerDisplayLocal).toHaveBeenCalledTimes(1);
    });

    it('lands its own dice', () => {
      $eXeTrivial.options[instance].gameStarted = true;
      $eXeTrivial.throwDice(instance);

      vi.advanceTimersByTime(5000);

      expect($eXeTrivial.showTargetPositions).toHaveBeenCalledWith($eXeTrivial.options[instance].valorDado, instance);
    });

    it("stops the dice once its board leaves the page, not moving the next page's pieces", () => {
      $eXeTrivial.options[instance].gameStarted = true;
      $eXeTrivial.throwDice(instance);
      vi.advanceTimersByTime(150);

      moveToNextPage({ gameStarted: true });
      vi.advanceTimersByTime(5000);

      expect($eXeTrivial.showTargetPositions).not.toHaveBeenCalled();
    });
  });

  // A duplicated board carries the same trivialID. Kept under it, the two
  // copies shared one entry and each resumed the other's game.
  describe('where a board keeps its game', () => {
    let previousLocalStorage;
    let store;

    beforeEach(() => {
      previousLocalStorage = global.localStorage;
      store = {};
      global.localStorage = {
        getItem: key => (key in store ? store[key] : null),
        setItem: (key, value) => {
          store[key] = String(value);
        },
        removeItem: key => {
          delete store[key];
        },
      };
    });

    afterEach(() => {
      global.localStorage = previousLocalStorage;
      document.body.innerHTML = '';
    });

    it("names the entry after the board's own component", () => {
      document.body.innerHTML =
        '<div class="idevice_node trivial" id="idevice-abc"><div class="trivial-IDevice"></div></div>';

      expect($eXeTrivial.storageKeyOf(document.querySelector('.trivial-IDevice'))).toBe('dataTrivial-idevice-abc');
    });

    it('gives no key to a board outside any component', () => {
      document.body.innerHTML = '<div class="trivial-IDevice"></div>';

      expect($eXeTrivial.storageKeyOf(document.querySelector('.trivial-IDevice'))).toBe('');
    });

    it('keeps the game under its own component, not under the id its data carries', () => {
      $eXeTrivial.options = [{ trivialID: 7, storageKey: 'dataTrivial-idevice-copy-a', gamers: [] }];

      $eXeTrivial.saveDataStorage(0);

      expect(store['dataTrivial-idevice-copy-a']).toBeDefined();
      expect(store['dataTrivial-7']).toBeUndefined();
      expect(store['dataTrivial-idevice-copy-b']).toBeUndefined();
    });

    it('keeps nothing when the board belongs to no component', () => {
      $eXeTrivial.options = [{ trivialID: 7, storageKey: '', gamers: [] }];

      $eXeTrivial.saveDataStorage(0);

      expect(Object.keys(store)).toEqual([]);
    });

    it('forgets only its own game when played again', () => {
      store['dataTrivial-idevice-copy-a'] = '{}';
      store['dataTrivial-idevice-copy-b'] = '{}';
      $eXeTrivial.options = [
        {
          storageKey: 'dataTrivial-idevice-copy-a',
          numeroJugadores: 1,
          numeroTemas: 3,
          numeroCasillas: 20,
          pT: [{}, {}],
          gamers: [{ score: 0, quesos: [], cheeses: [], casilla: 0 }],
          msgs: {},
        },
      ];
      for (const method of ['updateTimeGame', 'saveEvaluation', 'placePlayerToken', 'activeCheese', 'loadGameBoard']) {
        vi.spyOn($eXeTrivial, method).mockImplementation(() => {});
      }

      $eXeTrivial.rebootGame(0);

      expect(store['dataTrivial-idevice-copy-a']).toBeUndefined();
      expect(store['dataTrivial-idevice-copy-b']).toBe('{}');
      vi.restoreAllMocks();
    });
  });
});

describe('trivial minimum score notice', () => {
  it('asks for the notice right after its interface replaces the stored data', () => {
    const source = readFileSync(join(__dirname, 'trivial.js'), 'utf-8');
    const loadGame = source.slice(source.search(/\bloadGame: function/));

    // The main container comes with the interface, so from that line on the
    // notice can go right before it, below the instructions.
    expect(loadGame).toMatch(
      /mOption\.main = [^\n]+[\s\S]*?dl\.before\(\w+\)\.remove\(\);\s*\$exeDevices\.iDevice\.gamification\.report\.showPassScoreNotice\(mOption\);/
    );
  });
});
