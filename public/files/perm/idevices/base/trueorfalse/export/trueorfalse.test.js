/**
 * Unit tests for trueorfalse iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - escapeForCallback: Escapes JSON for callback
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $trueorfalse globally.
 * Note: This file doesn't have auto-init call.
 */
function loadExportIdevice(code) {
  const modifiedCode = code.replace(/var\s+\$trueorfalse\s*=/, 'global.$trueorfalse =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$trueorfalse;
}

describe('trueorfalse iDevice export', () => {
  let $trueorfalse;

  beforeEach(() => {
    global.$trueorfalse = undefined;

    const filePath = join(__dirname, 'trueorfalse.js');
    const code = readFileSync(filePath, 'utf-8');

    $trueorfalse = loadExportIdevice(code);
  });

  it('coerces legacy manual SCORM mode (2) to automatic (1) at load', () => {
    const code = readFileSync(join(__dirname, 'trueorfalse.js'), 'utf-8');

    // trueorfalse is auto-only (no manual save button); updateConfig normalizes
    // legacy manual data to automatic via the shared helper.
    expect(code).toContain('gamification.scorm.normalizeMode(data.isScorm)');
  });

  describe('does not send a score on page load', () => {
    it('registers with gameStarted=false even when updateConfig flagged it started', () => {
      // updateConfig sets gameStarted=true for the new format; renderBehaviour
      // must reset it before registering so no score is written on load.
      const ldata = { id: 'tof-1', isScorm: 1, gameStarted: true };
      vi.spyOn($trueorfalse, 'updateConfig').mockReturnValue(ldata);
      vi.spyOn($trueorfalse, 'generateTrueFalseQuizHtml').mockReturnValue('');
      vi.spyOn($trueorfalse, 'addEvents').mockImplementation(() => {});
      vi.spyOn($trueorfalse, 'updateLatexInView').mockImplementation(() => {});

      const prevScorm = $exeDevices.iDevice.gamification.scorm;
      let gameStartedAtRegister;
      $exeDevices.iDevice.gamification.scorm = {
        registerActivity: vi.fn((opts) => {
          gameStartedAtRegister = opts.gameStarted;
        }),
      };
      document.body.className = ''; // not an exe-scorm runtime -> direct register

      try {
        $trueorfalse.renderBehaviour(
          { id: 'tof-1', questionsData: [] },
          0,
          'tof-1',
        );
      } finally {
        $exeDevices.iDevice.gamification.scorm = prevScorm;
        vi.restoreAllMocks();
      }

      expect(gameStartedAtRegister).toBe(false);
    });
  });

  describe('SCORM session binding', () => {
    it('binds to a live SCO session even when init() returns false', () => {
      // init() returns false when the SCO session is already active; renderBehaviour
      // must still load the SCORM data (bind to the live session) instead of
      // falling through to reloading the wrapper.
      const ldata = { id: 'tof-1', isScorm: 1, gameStarted: true };
      vi.spyOn($trueorfalse, 'updateConfig').mockReturnValue(ldata);
      vi.spyOn($trueorfalse, 'generateTrueFalseQuizHtml').mockReturnValue('');
      vi.spyOn($trueorfalse, 'addEvents').mockImplementation(() => {});
      vi.spyOn($trueorfalse, 'updateLatexInView').mockImplementation(() => {});
      const initScormData = vi
        .spyOn($trueorfalse, 'initScormData')
        .mockImplementation(() => {});
      const loadWrapper = vi
        .spyOn($trueorfalse, 'loadSCORM_API_wrapper')
        .mockImplementation(() => {});

      document.body.className = 'exe-scorm';
      const init = vi.fn(() => false);
      window.scorm = { init };

      try {
        $trueorfalse.renderBehaviour(
          { id: 'tof-1', questionsData: [] },
          0,
          'tof-1',
        );
      } finally {
        delete window.scorm;
        document.body.className = '';
        vi.restoreAllMocks();
      }

      expect(init).toHaveBeenCalled();
      expect(initScormData).toHaveBeenCalledWith(ldata);
      expect(loadWrapper).not.toHaveBeenCalled();
    });
  });

  describe('escapeForCallback', () => {
    it('escapes backslashes', () => {
      const obj = { path: 'C:\\folder\\file' };
      const result = $trueorfalse.escapeForCallback(obj);
      expect(result).toContain('\\\\');
    });

    it('escapes double quotes', () => {
      const obj = { text: 'Hello "World"' };
      const result = $trueorfalse.escapeForCallback(obj);
      expect(result).toContain('\\"');
    });

    it('returns valid JSON string', () => {
      const obj = { name: 'test', value: 123 };
      const result = $trueorfalse.escapeForCallback(obj);
      expect(typeof result).toBe('string');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($trueorfalse.borderColors).toBeDefined();
      expect($trueorfalse.borderColors.black).toBe('#1c1b1b');
      expect($trueorfalse.borderColors.blue).toBe('#5877c6');
      expect($trueorfalse.borderColors.green).toBe('#00a300');
      expect($trueorfalse.borderColors.red).toBe('#ff0000');
      expect($trueorfalse.borderColors.white).toBe('#f9f9f9');
      expect($trueorfalse.borderColors.yellow).toBe('#f3d55a');
    });

    it('has grey color', () => {
      expect($trueorfalse.borderColors.grey).toBe('#777777');
    });

    it('has incorrect color', () => {
      expect($trueorfalse.borderColors.incorrect).toBe('#d9d9d9');
    });

    it('has correct color', () => {
      expect($trueorfalse.borderColors.correct).toBe('#00ff00');
    });
  });

  describe('userName', () => {
    it('is initially empty', () => {
      expect($trueorfalse.userName).toBe('');
    });
  });

  describe('previousScore', () => {
    it('is initially empty', () => {
      expect($trueorfalse.previousScore).toBe('');
    });
  });

  describe('score calculation', () => {
    it('calculates the score from hits and total questions', () => {
      expect($trueorfalse.getScore(2, 4)).toBe(5);
    });

    it('returns 0 when there are no questions', () => {
      expect($trueorfalse.getScore(2, 0)).toBe(0);
    });
  });

  describe('initialScore', () => {
    it('is initially empty', () => {
      expect($trueorfalse.initialScore).toBe('');
    });
  });

  describe('mScorm', () => {
    it('is initially null', () => {
      expect($trueorfalse.mScorm).toBe(null);
    });
  });

  describe('init', () => {
    it('is a function that does nothing', () => {
      expect(typeof $trueorfalse.init).toBe('function');
      expect(() => $trueorfalse.init()).not.toThrow();
    });
  });

  describe('msgsdefault', () => {
    it('has message strings', () => {
      expect($trueorfalse.msgsdefault).toBeDefined();
      expect(typeof $trueorfalse.msgsdefault).toBe('object');
    });

    it('has required messages', () => {
      expect($trueorfalse.msgsdefault.msgTrue).toBe('Verdadero');
      expect($trueorfalse.msgsdefault.msgFalse).toBe('Falso');
      expect($trueorfalse.msgsdefault.msgOk).toBe('Correcto');
      expect($trueorfalse.msgsdefault.msgKO).toBe('Incorrecto');
    });
  });

  describe('updateLatexInView', () => {
    const math = () => $exeDevices.iDevice.gamification.math;

    beforeEach(() => {
      math().hasLatex.mockClear();
      math().updateLatex.mockClear();
    });

    it('typesets the whole container, instructions included', () => {
      document.body.innerHTML = `
        <div class="exe-trueorfalse-container">
          <div class="TOFP-instructions">Resuelve \\(x^2 = 1\\)</div>
          <div class="TOFP-MainContainer" id="tofPMainContainer-tof-1"></div>
          <div class="TOFP-After"></div>
        </div>
      `;

      $trueorfalse.updateLatexInView('tof-1');

      expect(math().updateLatex).toHaveBeenCalledTimes(1);
      const target = math().updateLatex.mock.calls[0][0];
      expect(target).toBe(document.querySelector('.exe-trueorfalse-container'));
      // The instructions live inside the typeset target.
      expect(target.querySelector('.TOFP-instructions')).not.toBeNull();
    });

    it('does not typeset when there is no LaTeX', () => {
      document.body.innerHTML = `
        <div class="exe-trueorfalse-container">
          <div class="TOFP-instructions">Sin fórmulas</div>
          <div class="TOFP-MainContainer" id="tofPMainContainer-tof-1"></div>
        </div>
      `;

      $trueorfalse.updateLatexInView('tof-1');

      expect(math().updateLatex).not.toHaveBeenCalled();
    });

    it('does nothing when the container is missing', () => {
      document.body.innerHTML = '';

      expect(() => $trueorfalse.updateLatexInView('missing')).not.toThrow();
      expect(math().updateLatex).not.toHaveBeenCalled();
    });
  });

  describe('addEvents', () => {
    it('targets the trueorfalse iDevice body for report icons', () => {
      const previousReport = $exeDevices.iDevice.gamification.report;
      const updateEvaluationIcon = vi.fn();
      $exeDevices.iDevice.gamification.report = { updateEvaluationIcon };

      document.body.innerHTML = `
        <div class="idevice_body trueorfalseIdevice" id="tof-1">
          <div class="exe-trueorfalse-container">
            <div class="TOFP-MainContainer" id="tofPMainContainer-tof-1">
              <div id="tofPGameContainer-tof-1"></div>
              <button id="tofPStartGame-tof-1"></button>
              <button id="tofPCheckTest-tof-1"></button>
              <button id="tofRebootTest-tof-1"></button>
              <input id="tofPSendScore-tof-1" />
            </div>
          </div>
        </div>
      `;

      const options = {
        id: 'tof-1',
        idevicePath: '/idevices/trueorfalse/',
        msgs: { tofPStartGame: 'Start' },
        textButtonScorm: 'Send',
        tofPTime: '0',
        isScorm: 0,
        showSlider: false,
        isTest: true,
        time: 0,
        evaluation: true,
        evaluationID: 'eval-1',
        isInExe: false,
      };

      try {
        $trueorfalse.addEvents(options);
      } finally {
        $exeDevices.iDevice.gamification.report = previousReport;
      }

      expect(options.idevice).toBe('trueorfalseIdevice');
      expect(updateEvaluationIcon).toHaveBeenCalledWith(options, false);
    });

    it('does not register its own unload handlers', () => {
      const onSpy = vi.spyOn($.fn, 'on');

      document.body.innerHTML = `
        <div class="idevice_body trueorfalseIdevice" id="tof-1">
          <div class="TOFP-MainContainer" id="tofPMainContainer-tof-1">
            <div id="tofPGameContainer-tof-1"></div>
            <button id="tofPStartGame-tof-1"></button>
            <button id="tofPCheckTest-tof-1"></button>
            <button id="tofRebootTest-tof-1"></button>
            <input id="tofPSendScore-tof-1" />
          </div>
        </div>
      `;

      const options = {
        id: 'tof-1',
        idevicePath: '/idevices/trueorfalse/',
        msgs: { tofPStartGame: 'Start' },
        textButtonScorm: 'Send',
        tofPTime: '0',
        isScorm: 0,
        showSlider: false,
        isTest: false,
      };

      try {
        $trueorfalse.addEvents(options);
        expect(onSpy).not.toHaveBeenCalledWith(
          'unload.eXeTOF beforeunload.eXeTOF',
          expect.any(Function)
        );
      } finally {
        onSpy.mockRestore();
      }
    });
  });

  describe('runtime scoring', () => {
    it('updates hits and errors using numeric solutions', () => {
      document.body.innerHTML = `
        <div id="tofPGameContainer-tof-1">
          <div class="TOFP-QuestionDiv">
            <input class="TOFP-Answer" type="radio" value="1" checked />
          </div>
          <div class="TOFP-QuestionDiv">
            <input class="TOFP-Answer" type="radio" value="0" checked />
          </div>
        </div>
      `;

      const options = {
        id: 'tof-1',
        questionsGame: [{ solution: '1' }, { solution: '0' }],
      };

      $trueorfalse.updateScoreData(options);

      expect(options.hits).toBe(2);
      expect(options.errors).toBe(0);
    });

    it('finalizes test scoring without implicit globals', () => {
      const previousReport = $exeDevices.iDevice.gamification.report;
      const saveEvaluation = vi.fn();
      $exeDevices.iDevice.gamification.report = { saveEvaluation };

      document.body.innerHTML = `
        <button id="tofPCheckTest-tof-1"></button>
        <button id="tofRebootTest-tof-1"></button>
        <div id="tofPMessage-tof-1"></div>
        <div id="tofPMultimedia"></div>
        <div id="tofPGameContainer-tof-1">
          <div class="TOFP-QuestionDiv">
            <input class="TOFP-Answer" type="radio" value="1" checked />
            <div class="TOFP-Feedback"><span class="TOFP-SolutionMessage"></span></div>
          </div>
          <div class="TOFP-QuestionDiv">
            <input class="TOFP-Answer" type="radio" value="1" checked />
            <div class="TOFP-Feedback"><span class="TOFP-SolutionMessage"></span></div>
          </div>
        </div>
      `;

      const options = {
        id: 'tof-1',
        questionsGame: [{ solution: '1' }, { solution: '0' }],
        numberQuestions: 2,
        msgs: {
          msgKO: 'Incorrecto',
          msgOk: 'Correcto',
          msgYouScore: 'Puntuación',
        },
        isScorm: 0,
        isInExe: false,
      };

      try {
        expect(() => $trueorfalse.gameOver(options)).not.toThrow();
      } finally {
        $exeDevices.iDevice.gamification.report = previousReport;
      }

      expect(options.hits).toBe(1);
      expect(options.errors).toBe(1);
      expect(options.scorep).toBe(5);
      expect(saveEvaluation).toHaveBeenCalledWith(options, false);
    });

    it('auto-submits the SCORM score on Comprobar when the game is over', () => {
      const previousReport = $exeDevices.iDevice.gamification.report;
      const previousSendScoreNew = $exeDevices.iDevice.gamification.scorm.sendScoreNew;
      const sendScoreNew = vi.fn();
      $exeDevices.iDevice.gamification.report = { saveEvaluation: vi.fn() };
      $exeDevices.iDevice.gamification.scorm.sendScoreNew = sendScoreNew;

      document.body.innerHTML = `
        <button id="tofPCheckTest-tof-1"></button>
        <button id="tofRebootTest-tof-1"></button>
        <div id="tofPMessage-tof-1"></div>
        <div id="tofPMultimedia"></div>
        <div id="tofPGameContainer-tof-1">
          <div class="TOFP-QuestionDiv">
            <input class="TOFP-Answer" type="radio" value="1" checked />
            <div class="TOFP-Feedback"><span class="TOFP-SolutionMessage"></span></div>
          </div>
          <div class="TOFP-QuestionDiv">
            <input class="TOFP-Answer" type="radio" value="0" checked />
            <div class="TOFP-Feedback"><span class="TOFP-SolutionMessage"></span></div>
          </div>
        </div>
      `;

      const options = {
        id: 'tof-1',
        questionsGame: [{ solution: '1' }, { solution: '0' }],
        numberQuestions: 2,
        msgs: { msgKO: 'KO', msgOk: 'OK', msgYouScore: 'Score' },
        isScorm: 1,
        isInExe: false,
      };

      try {
        $trueorfalse.gameOver(options);
      } finally {
        $exeDevices.iDevice.gamification.report = previousReport;
        $exeDevices.iDevice.gamification.scorm.sendScoreNew = previousSendScoreNew;
      }

      expect(options.gameOver).toBe(true);
      expect(options.gameStarted).toBe(false);
      expect(sendScoreNew).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ gameOver: true, scorerp: 10 }),
      );
    });
  });

  describe('attempts (retries)', () => {
    function setupGameOverDom() {
      document.body.innerHTML = `
        <button id="tofPCheckTest-tof-1"></button>
        <button id="tofRebootTest-tof-1"></button>
        <div id="tofPMessage-tof-1"></div>
        <div id="tofPMultimedia"></div>
        <div id="tofPGameContainer-tof-1">
          <div class="TOFP-QuestionDiv">
            <input class="TOFP-Answer" type="radio" value="1" checked />
            <div class="TOFP-Feedback"><span class="TOFP-SolutionMessage"></span></div>
          </div>
        </div>`;
    }

    function baseOptions() {
      return {
        id: 'tof-1',
        questionsGame: [{ solution: '1' }],
        numberQuestions: 1,
        msgs: { msgKO: 'KO', msgOk: 'OK', msgYouScore: 'Score' },
        isInExe: false,
      };
    }

    it('updateConfig defaults attemptsNumber to 1 when missing (backward compatible)', () => {
      const prevExeApp = eXe.app;
      eXe.app = {
        ...eXe.app,
        isInExe: () => false,
        getIdeviceInstalledExportPath: () => '',
      };
      const prevGetQuestions =
        $exeDevices.iDevice.gamification.helpers.getQuestions;
      $exeDevices.iDevice.gamification.helpers.getQuestions = q => q;

      try {
        const result = $trueorfalse.updateConfig(
          { id: 'x', questionsData: [] },
          'x'
        );
        expect(result.attemptsNumber).toBe(1);
      } finally {
        eXe.app = prevExeApp;
        $exeDevices.iDevice.gamification.helpers.getQuestions = prevGetQuestions;
      }
    });

    it('default (1 attempt): completes and hides the retry button on the first check', () => {
      const previousReport = $exeDevices.iDevice.gamification.report;
      const previousSendScoreNew = $exeDevices.iDevice.gamification.scorm.sendScoreNew;
      const sendScoreNew = vi.fn();
      $exeDevices.iDevice.gamification.report = { saveEvaluation: vi.fn() };
      $exeDevices.iDevice.gamification.scorm.sendScoreNew = sendScoreNew;
      setupGameOverDom();
      const options = { ...baseOptions(), isScorm: 1, pendingAttempts: 1 };

      try {
        $trueorfalse.gameOver(options);
      } finally {
        $exeDevices.iDevice.gamification.report = previousReport;
        $exeDevices.iDevice.gamification.scorm.sendScoreNew = previousSendScoreNew;
      }

      // Completed regardless of attempts.
      expect(options.gameOver).toBe(true);
      expect(sendScoreNew).toHaveBeenCalled();
      // One attempt consumed -> no retry offered.
      expect(options.pendingAttempts).toBe(0);
      expect(
        document.getElementById('tofRebootTest-tof-1').style.display
      ).toBe('none');
    });

    it('several attempts: offers the retry button and decrements pendingAttempts', () => {
      const previousReport = $exeDevices.iDevice.gamification.report;
      $exeDevices.iDevice.gamification.report = { saveEvaluation: vi.fn() };
      setupGameOverDom();
      const options = { ...baseOptions(), isScorm: 0, pendingAttempts: 3 };

      try {
        $trueorfalse.gameOver(options);
      } finally {
        $exeDevices.iDevice.gamification.report = previousReport;
      }

      expect(options.pendingAttempts).toBe(2);
      expect(
        document.getElementById('tofRebootTest-tof-1').style.display
      ).not.toBe('none');
    });
  });
});
