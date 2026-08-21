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

  describe('updateConfig', () => {
    beforeEach(() => {
      eXe.app.isInExe = vi.fn(() => false);
      eXe.app.getIdeviceInstalledExportPath = vi.fn(() => '/idevices/trueorfalse/');
      document.body.innerHTML = '';
    });

    // A saved activity that lost its questions still carries typeGame, so it
    // skips the legacy migration and goes straight to getQuestions. Before the
    // helper was fixed that returned undefined and the next line read .length
    // off it, taking down the whole activity.
    it('normalises missing questions to an empty list', () => {
      let result;

      expect(() => {
        result = $trueorfalse.updateConfig({ typeGame: 'TrueOrFalse' }, 'tof-1');
      }).not.toThrow();

      expect(result.questionsGame).toEqual([]);
      expect(result.numberQuestions).toBe(0);
    });

    it('normalises non-array questions to an empty list', () => {
      const result = $trueorfalse.updateConfig(
        { typeGame: 'TrueOrFalse', questionsGame: { 0: 'not-an-array' } },
        'tof-1'
      );

      expect(result.questionsGame).toEqual([]);
      expect(result.numberQuestions).toBe(0);
    });

    // An activity whose saved jsonProperties was lost or discarded arrives here
    // as {}, which takes the legacy migration branch with no questionsData.
    it('renders an activity with no saved data instead of throwing', () => {
      let result;

      expect(() => {
        result = $trueorfalse.updateConfig({}, 'tof-1');
      }).not.toThrow();

      expect(result.questionsGame).toEqual([]);
      expect(result.numberQuestions).toBe(0);
    });

    it('still migrates legacy questionsData', () => {
      const result = $trueorfalse.updateConfig(
        {
          questionsData: [
            { baseText: '¿El Teide está en Tenerife?', answer: 'True', feedback: 'Correcto', hint: 'Isla' },
          ],
        },
        'tof-1'
      );

      expect(result.typeGame).toBe('TrueOrFalse');
      expect(result.numberQuestions).toBe(1);
      expect(result.questionsGame[0]).toEqual({
        question: '¿El Teide está en Tenerife?',
        answer: 'True',
        feedback: 'Correcto',
        suggestion: 'Isla',
        solution: 1,
      });
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
  });

  describe('source hygiene', () => {
    const source = () =>
      readFileSync(join(__dirname, 'trueorfalse.js'), 'utf-8');

    /**
     * `score` was assigned without a declaration, so it leaked as an implicit
     * global — and it read `mOptions.hist`, a typo for `hits`, so the value was
     * NaN. The only two consumers were an assignment to a field nothing reads
     * and a `$('#tofPMultimedia')` selector that matches nothing (the rendered
     * id carries an instance suffix). `mOptions.scorep`, computed two lines
     * below, is the real score.
     */
    it('declares every variable it assigns', () => {
      expect(source()).not.toMatch(/^\s*score\s*=/m);
    });

    it('does not read the misspelled mOptions.hist', () => {
      expect(source()).not.toContain('mOptions.hist');
      expect(source()).toContain('mOptions.hits');
    });
  });

  describe('updateConfig SCORM invariant', () => {
    let warn;

    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
    });

    it('warns when a SCORM score is requested with quiz mode off', () => {
      $trueorfalse.updateConfig({ ideviceId: 'tof-1', isScorm: 1, isTest: false });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('tof-1');
      expect(warn.mock.calls[0][0]).toContain('no score can ever be saved');
    });

    it.each([
      ['quiz mode on', { isScorm: 1, isTest: true }],
      ['SCORM off', { isScorm: 0, isTest: false }],
    ])('stays quiet for a valid combination: %s', (_label, flags) => {
      $trueorfalse.updateConfig({ ideviceId: 'tof-1', ...flags });

      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('createInterfaceTrueOrFalse', () => {
    const options = () => ({
      id: 'tof-1',
      msgs: {
        msgTime: 'Time',
        msgStartGame: 'Start',
        msgCheck: 'Check',
        msgReboot: 'Restart',
      },
      eXeGameInstructions: '<p>Instructions</p>',
      eXeIdeviceTextAfter: '<p>After</p>',
      textButtonScorm: 'Save score',
      isTest: true,
      time: 0,
      isScorm: 1,
      evaluation: false,
      evaluationID: '',
    });

    it('returns balanced markup', () => {
      const html = $trueorfalse.createInterfaceTrueOrFalse(options());

      const opened = (html.match(/<div\b/g) || []).length;
      const closed = (html.match(/<\/div>/g) || []).length;

      expect(closed).toBe(opened);
    });

    /**
     * The main container carries `.TOFP-MainContainer p { margin: 0 !important }`, which
     * would flatten the author's rich text. Both the score button and the after-text
     * belong outside it — as the LaTeX docblock above `updateLatexInView` states, and as
     * the sibling `form` iDevice lays them out.
     */
    it('keeps the score button and the after-text outside the main container', () => {
      const html = $trueorfalse.createInterfaceTrueOrFalse(options());

      document.body.innerHTML = `<div class="exe-trueorfalse-container">${html}</div>`;

      const main = document.querySelector('.TOFP-MainContainer');
      expect(main.querySelector('.Games-BottonContainer')).toBeNull();
      expect(main.querySelector('.TOFP-After')).toBeNull();
      expect(document.querySelector('.TOFP-After')).not.toBeNull();
    });

    /**
     * The exporter concatenates each iDevice's markup as a sibling of the next one
     * inside the block, so an unclosed tag does not stay inside this iDevice: the HTML
     * parser nests whatever follows into it, and exe_export.js then removes it with
     * `ideviceNode.innerHTML = htmlIdevice`.
     */
    it('closes its main container, so a following iDevice stays a sibling', () => {
      const html = $trueorfalse.createInterfaceTrueOrFalse(options());

      document.body.innerHTML = `
        <div class="box-content">
          <div class="idevice_node trueorfalse" id="tof-1">${html}</div>
          <div class="idevice_node text" id="text-2"></div>
        </div>
      `;

      const following = document.getElementById('text-2');
      expect(following.parentElement.className).toBe('box-content');
      expect(document.getElementById('tof-1').contains(following)).toBe(false);
    });
  });
});
