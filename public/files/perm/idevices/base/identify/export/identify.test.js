/**
 * Unit tests for identify iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - checkWord: Compares words with normalization and pipe alternatives
 */

/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeIdentifica globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeIdentifica\s*=/, 'global.$eXeIdentifica =');
  // Remove auto-init call: $(function () { $eXeIdentifica.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeIdentifica\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeIdentifica;
}

describe('identify iDevice export', () => {
  let $eXeIdentifica;

  beforeEach(() => {
    global.$eXeIdentifica = undefined;

    const filePath = join(__dirname, 'identify.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeIdentifica = loadExportIdevice(code);
  });

  it('does not register its own unload or beforeunload SCORM handlers', () => {
    const code = readFileSync(join(__dirname, 'identify.js'), 'utf-8');

    expect(code).not.toMatch(/beforeunload|unload\.eXeIdentifica|endScorm/);
  });

  describe('SCORM score saving', () => {
    let originalMedia;
    let originalReport;
    let originalSendScoreNew;

    beforeEach(() => {
      originalMedia = global.$exeDevices.iDevice.gamification.media;
      originalReport = global.$exeDevices.iDevice.gamification.report;
      originalSendScoreNew = global.$exeDevices.iDevice.gamification.scorm.sendScoreNew;
      global.$exeDevices.iDevice.gamification.media = {
        stopSound: vi.fn(),
      };
      global.$exeDevices.iDevice.gamification.report = {
        saveEvaluation: vi.fn(),
        updateEvaluationIcon: vi.fn(),
      };
      global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = vi.fn();
    });

    afterEach(() => {
      global.$exeDevices.iDevice.gamification.media = originalMedia;
      global.$exeDevices.iDevice.gamification.report = originalReport;
      global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = originalSendScoreNew;
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('does not save score when the game starts without user interaction', () => {
      const instance = 0;
      document.body.innerHTML = `
        <div id="idfGameContainer-${instance}"><div class="IDFP-StartGame"></div></div>
        <div id="idfShowClue-${instance}"></div>
        <div id="idfPShowClue-${instance}"></div>
        <div id="idfPNumber-${instance}"></div>
        <div id="idfPHits-${instance}"></div>
        <div id="idfPErrors-${instance}"></div>
        <div id="idfPScore-${instance}"></div>
        <div id="idfRepeatActivity-${instance}"></div>
      `;
      $eXeIdentifica.options[instance] = {
        errors: 0,
        gameStarted: false,
        hits: 0,
        isScorm: 1,
        msgs: {
          msgGameStarted: 'Game started',
          msgYouScore: 'Your score',
        },
        numberQuestions: 2,
        questionsGame: [{}, {}],
        score: 0,
      };

      vi.spyOn($eXeIdentifica, 'newQuestion').mockImplementation(() => {});
      vi.spyOn($eXeIdentifica, 'showMessage').mockImplementation(() => {});

      $eXeIdentifica.startGame(instance);

      expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).not.toHaveBeenCalled();
      expect($(`#idfRepeatActivity-${instance}`).text()).toBe('');
      expect($eXeIdentifica.newQuestion).toHaveBeenCalledWith(instance);
    });

    it('does not save score when the player opens a clue', () => {
      const instance = 0;
      document.body.innerHTML = `
        <div id="idfGameContainer-${instance}">
          <a class="IDFP-LinkClue" data-number="0"><img class="IDFP-Clue" /></a>
        </div>
        <div id="idfMessageClue-${instance}"></div>
        <div id="idfPoints-${instance}"></div>
        <div id="idfUseClue-${instance}"></div>
        <div id="idfRepeatActivity-${instance}"></div>
      `;
      $eXeIdentifica.options[instance] = {
        activeClue: 0,
        activeQuestion: 0,
        isScorm: 1,
        msgs: {
          msgShowClue: 'Show clue',
          msgShowNewClue: 'Show another clue',
          msgUseAllClues: 'All clues: %s',
          msgUseClue: 'Use clue: %s',
          msgYouScore: 'Your score',
        },
        pointsQuestion: 10,
        questionsGame: [{ clues: ['Hint'], numberClues: 1 }],
        score: 0,
      };

      vi.spyOn($eXeIdentifica, 'showMessage').mockImplementation(() => {});

      $eXeIdentifica.showClue(instance);

      expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).not.toHaveBeenCalled();
      expect($(`#idfRepeatActivity-${instance}`).text()).toBe('');
    });

    it('does not save score when the player sends a wrong answer and still has attempts', () => {
      const instance = 0;
      document.body.innerHTML = `
        <div id="idfAttempts-${instance}"></div>
        <div id="idfPoints-${instance}"></div>
        <input id="idfAnswer-${instance}" />
        <div id="idfRepeatActivity-${instance}"></div>
      `;
      $eXeIdentifica.options[instance] = {
        attempts: 2,
        isScorm: 1,
        msgs: {
          msgYouCanTryAgain: 'Try again',
          msgYouScore: 'Your score',
        },
        pointsClue: 10,
        score: 0,
      };
      vi.spyOn($eXeIdentifica, 'getRetroFeedMessages').mockReturnValue('Wrong');
      vi.spyOn($eXeIdentifica, 'showMessage').mockImplementation(() => {});

      $eXeIdentifica.answerWord(false, instance);

      expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).not.toHaveBeenCalled();
      expect($eXeIdentifica.options[instance].attempts).toBe(1);
    });

    it('saves score when the player answers correctly', () => {
      const instance = 0;
      document.body.innerHTML = `
        <div id="idfUseClue-${instance}"></div>
        <div id="idfBackImage-${instance}"></div>
        <div id="idfCardDraw-${instance}"><div class="IDFP-card-inner"></div></div>
        <div id="idfPAuthor-${instance}"></div>
        <input id="idfAnswer-${instance}" />
        <button id="idfSubmit-${instance}"></button>
        <button id="idfBtnMoveOn-${instance}"></button>
        <div id="idfPScore-${instance}"></div>
        <div id="idfPHits-${instance}"></div>
        <div id="idfPErrors-${instance}"></div>
        <div id="idfRepeatActivity-${instance}"></div>
      `;
      $eXeIdentifica.options[instance] = {
        errors: 0,
        gameActived: true,
        hits: 0,
        isScorm: 1,
        itinerary: { showClue: false },
        msgs: {
          msgYouScore: 'Your score',
        },
        numberQuestions: 1,
        obtainedClue: false,
        pointsClue: 10,
        score: 0,
        showSolution: false,
        timeShowSolution: 0,
      };
      vi.spyOn(global, 'setTimeout').mockImplementation(() => 0);

      $eXeIdentifica.endQuestion(true, instance);

      expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          scorerp: 10,
        })
      );
      expect($(`#idfRepeatActivity-${instance}`).text()).toBe('Your score: 10.00');
    });

    it('saves score when the player exhausts attempts', () => {
      const instance = 0;
      document.body.innerHTML = `
        <div id="idfAttempts-${instance}"></div>
        <div id="idfUseClue-${instance}"></div>
        <div id="idfBackImage-${instance}"></div>
        <div id="idfCardDraw-${instance}"><div class="IDFP-card-inner"></div></div>
        <div id="idfPAuthor-${instance}"></div>
        <input id="idfAnswer-${instance}" />
        <button id="idfSubmit-${instance}"></button>
        <button id="idfBtnMoveOn-${instance}"></button>
        <div id="idfPoints-${instance}"></div>
        <div id="idfPScore-${instance}"></div>
        <div id="idfPHits-${instance}"></div>
        <div id="idfPErrors-${instance}"></div>
        <div id="idfRepeatActivity-${instance}"></div>
      `;
      $eXeIdentifica.options[instance] = {
        attempts: 1,
        errors: 0,
        gameActived: true,
        hits: 0,
        isScorm: 1,
        itinerary: { showClue: false },
        msgs: {
          msgYouScore: 'Your score',
        },
        numberQuestions: 1,
        obtainedClue: false,
        pointsClue: 10,
        score: 0,
        showSolution: false,
        timeShowSolution: 0,
      };
      vi.spyOn($eXeIdentifica, 'getMessageAnswer').mockReturnValue('Wrong');
      vi.spyOn($eXeIdentifica, 'showMessage').mockImplementation(() => {});
      vi.spyOn(global, 'setTimeout').mockImplementation(() => 0);

      $eXeIdentifica.answerWord(false, instance);

      expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          scorerp: 0,
        })
      );
      expect($eXeIdentifica.options[instance].attempts).toBe(0);
      expect($(`#idfRepeatActivity-${instance}`).text()).toBe('Your score: 0.00');
    });

    it('saves score when the game finishes', () => {
      const instance = 0;
      document.body.innerHTML = `
        <div id="idfLinkAudio-${instance}"></div>
        <div id="idfCursor-${instance}"></div>
        <div id="idfPNumber-${instance}"></div>
        <input id="idfAnswer-${instance}" />
        <button id="idfSubmit-${instance}"></button>
        <button id="idfBtnMoveOn-${instance}"></button>
        <div id="idfMessageClue-${instance}"></div>
        <div id="idfUseClue-${instance}"></div>
        <div id="idfRepeatActivity-${instance}"></div>
      `;
      $eXeIdentifica.options[instance] = {
        errors: 0,
        feedBack: false,
        gameStarted: true,
        hits: 1,
        isScorm: 1,
        msgs: {
          msgGameEnd: 'Game end',
          msgYouScore: 'Your score',
        },
        questionsGame: [{}],
        score: 5,
      };
      vi.spyOn($eXeIdentifica, 'showCluesLinks').mockImplementation(() => {});
      vi.spyOn($eXeIdentifica, 'showMessage').mockImplementation(() => {});
      vi.spyOn($eXeIdentifica, 'showScoreGame').mockImplementation(() => {});
      vi.spyOn($eXeIdentifica, 'showFeedBack').mockImplementation(() => {});

      $eXeIdentifica.gameOver(instance);

      expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          scorerp: 5,
        })
      );
    });

    it('does not save score just by showing a question', () => {
      const code = readFileSync(join(__dirname, 'identify.js'), 'utf-8'),
        showQuestionSource = code.slice(
          code.indexOf('showQuestion: function'),
          code.indexOf('newQuestion: function')
        );

      expect(showQuestionSource).not.toMatch(/sendScore|sendScoreNew/);
    });
  });

  describe('checkWord', () => {
    it('returns true for identical words', () => {
      expect($eXeIdentifica.checkWord('hello', 'hello')).toBe(true);
    });

    it('is case insensitive', () => {
      expect($eXeIdentifica.checkWord('Hello', 'HELLO')).toBe(true);
      expect($eXeIdentifica.checkWord('WORLD', 'world')).toBe(true);
    });

    it('trims whitespace', () => {
      expect($eXeIdentifica.checkWord('  hello  ', 'hello')).toBe(true);
    });

    it('normalizes multiple spaces', () => {
      expect($eXeIdentifica.checkWord('hello   world', 'hello world')).toBe(true);
    });

    it('removes trailing punctuation', () => {
      expect($eXeIdentifica.checkWord('hello.', 'hello')).toBe(true);
      expect($eXeIdentifica.checkWord('hello,', 'hello')).toBe(true);
      expect($eXeIdentifica.checkWord('hello;', 'hello')).toBe(true);
    });

    it('returns false for different words', () => {
      expect($eXeIdentifica.checkWord('hello', 'world')).toBe(false);
    });

    it('handles pipe-separated alternatives', () => {
      expect($eXeIdentifica.checkWord('cat|dog|bird', 'cat')).toBe(true);
      expect($eXeIdentifica.checkWord('cat|dog|bird', 'dog')).toBe(true);
      expect($eXeIdentifica.checkWord('cat|dog|bird', 'bird')).toBe(true);
      expect($eXeIdentifica.checkWord('cat|dog|bird', 'fish')).toBe(false);
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeIdentifica.borderColors).toBeDefined();
      expect($eXeIdentifica.borderColors.black).toBe('#1c1b1b');
      expect($eXeIdentifica.borderColors.blue).toBe('#45085f');
      expect($eXeIdentifica.borderColors.green).toBe('#00a300');
      expect($eXeIdentifica.borderColors.red).toBe('#b3092f');
      expect($eXeIdentifica.borderColors.white).toBe('#f9f9f9');
      expect($eXeIdentifica.borderColors.yellow).toBe('#f3d55a');
      expect($eXeIdentifica.borderColors.grey).toBe('#777777');
    });
  });

  describe('options', () => {
    it('is defined', () => {
      expect($eXeIdentifica.options).toBeDefined();
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($eXeIdentifica.idevicePath).toBe('');
    });
  });
});
