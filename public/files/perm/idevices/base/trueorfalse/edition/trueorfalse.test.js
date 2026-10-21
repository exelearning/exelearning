/**
 * Unit tests for trueorfalse iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getDefaultQuestion: Default question structure
 * - transformObject: Object transformation
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runInThisContext } from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load iDevice file and expose $exeDevice globally.
 * Replaces 'var $exeDevice' with 'global.$exeDevice' to make it accessible.
 */
function loadIdevice(code) {
  // Replace 'var $exeDevice' with 'global.$exeDevice' anywhere in the code
  const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
  // Execute the modified code using eval in global context
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  // Give the edition the lifecycle IdeviceNode publishes in the real workarea.
  global.attachEditionLifecycle(global.$exeDevice);
  return global.$exeDevice;
}

describe('trueorfalse iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'trueorfalse.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('getDefaultQuestion', () => {
    it('returns a default question object with correct structure', () => {
      const defaultQuestion = $exeDevice.getDefaultQuestion();

      expect(defaultQuestion).toEqual({
        question: '',
        feedback: '',
        suggestion: '',
        solution: true,
      });
    });

    it('returns a new object each time', () => {
      const q1 = $exeDevice.getDefaultQuestion();
      const q2 = $exeDevice.getDefaultQuestion();

      expect(q1).not.toBe(q2);
      q1.question = 'modified';
      expect(q2.question).toBe('');
    });

    it('has question property as empty string', () => {
      const defaultQuestion = $exeDevice.getDefaultQuestion();
      expect(defaultQuestion.question).toBe('');
    });

    it('has feedback property as empty string', () => {
      const defaultQuestion = $exeDevice.getDefaultQuestion();
      expect(defaultQuestion.feedback).toBe('');
    });

    it('has suggestion property as empty string', () => {
      const defaultQuestion = $exeDevice.getDefaultQuestion();
      expect(defaultQuestion.suggestion).toBe('');
    });

    it('has solution property as true by default', () => {
      const defaultQuestion = $exeDevice.getDefaultQuestion();
      expect(defaultQuestion.solution).toBe(true);
    });
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
    });
  });

  describe('classIdevice', () => {
    it('has correct class identifier', () => {
      expect($exeDevice.classIdevice).toBe('trueorfalse');
    });
  });

  describe('questionsGame initialization', () => {
    it('starts with empty questions array', () => {
      expect($exeDevice.questionsGame).toEqual([]);
    });
  });

  describe('attempts (Number of attempts)', () => {
    it('transformObject sets attemptsNumber default 1 when converting the new format', () => {
      // A spy rather than a replacement: vitest.setup.js installs the real
      // $exeIDevicesEdition that the rest of the suite relies on.
      const getValues = vi
        .spyOn($exeIDevicesEdition.iDevice.gamification.scorm, 'getValues')
        .mockReturnValue({
          isScorm: 0,
          weighted: 100,
          textButtonScorm: '',
          repeatActivity: true,
        });
      $exeDevice.id = 'tof-1';
      $exeDevice.msgs = {};

      try {
        const result = $exeDevice.transformObject({ questionsData: [] });
        expect(result.attemptsNumber).toBe(1);
      } finally {
        getValues.mockRestore();
      }
    });

    it('wires the attempts field and persists it (reusing the existing label)', () => {
      const src = readFileSync(join(__dirname, 'trueorfalse.js'), 'utf-8');

      // Reuses the existing translation string (no new msgid).
      expect(src).toContain("_('Number of attempts')");
      expect(src).toContain('id="tofEAttemptsNumber"');
      // Persisted by validateData.
      expect(src).toMatch(/attemptsNumber:\s*attemptsNumber/);
    });
  });

  /**
   * A stored activity can reach the editor without a usable question list:
   * `transformObject` returns an already-migrated payload untouched, so a
   * missing or non-array `questionsGame` used to land straight on
   * `$exeDevice.questionsGame` and every later `.length` read threw.
   *
   * The two damaged shapes below are the ones shipped in
   * `pr2192-actividades-sin-preguntas.elpx`: the key absent, and the key
   * holding an object. Normalizing to `[]` puts the editor in the same state
   * as a brand-new activity, which `addEvents` then seeds with one question.
   */
  describe('questionsGame load boundary', () => {
    const savedGame = (extra = {}) => ({
      id: 'tof-damaged',
      ideviceId: 'tof-damaged',
      typeGame: 'TrueOrFalse',
      eXeGameInstructions: '<p>Revision final</p>',
      eXeIdeviceTextAfter: '',
      msgs: {},
      questionsRandom: false,
      percentageQuestions: 100,
      time: 0,
      isTest: false,
      isScorm: 0,
      weighted: 100,
      evaluation: false,
      evaluationID: '',
      repeatActivity: true,
      textButtonScorm: 'Guardar',
      ...extra,
    });

    it('normalizes a missing questionsGame to an empty array', () => {
      $exeDevice.idevicePreviousData = savedGame();

      $exeDevice.loadPreviousValues();

      expect($exeDevice.questionsGame).toEqual([]);
    });

    it('normalizes a non-array questionsGame to an empty array', () => {
      $exeDevice.idevicePreviousData = savedGame({
        questionsGame: { 0: 'esto no es un array' },
      });

      $exeDevice.loadPreviousValues();

      expect($exeDevice.questionsGame).toEqual([]);
    });

    it('normalizes a null questionsGame to an empty array', () => {
      $exeDevice.idevicePreviousData = savedGame({ questionsGame: null });

      $exeDevice.loadPreviousValues();

      expect($exeDevice.questionsGame).toEqual([]);
    });

    it('keeps a valid question list untouched', () => {
      const questions = [
        { question: 'Madrid is in Spain', feedback: '', suggestion: '', solution: 1 },
        { question: 'Rome is in France', feedback: '', suggestion: '', solution: 0 },
      ];
      $exeDevice.idevicePreviousData = savedGame({ questionsGame: questions });

      $exeDevice.loadPreviousValues();

      expect($exeDevice.questionsGame).toEqual(questions);
    });

    it('lets the editor open on an activity saved without questions', () => {
      $exeDevice.idevicePreviousData = savedGame();
      $exeDevice.loadPreviousValues();

      // This is the call that threw the reported
      // "can't access property length, $exeDevice.questionsGame is undefined".
      expect(() => $exeDevice.addEvents()).not.toThrow();
      // An empty list is seeded with one editable question, as for a new activity.
      expect($exeDevice.questionsGame).toHaveLength(1);
      expect($exeDevice.questionsGame[0]).toEqual($exeDevice.getDefaultQuestion());
    });

    it('lets showQuestion run on an activity saved without questions', () => {
      $exeDevice.idevicePreviousData = savedGame();
      $exeDevice.loadPreviousValues();

      expect(() => $exeDevice.showQuestion(0)).not.toThrow();
    });

    it('reports the empty activity on save instead of throwing', () => {
      $exeDevice.idevicePreviousData = savedGame();
      $exeDevice.setMessagesInfo();
      $exeDevice.loadPreviousValues();

      // The reported second failure: "can't access property 0" while saving.
      let result;
      expect(() => {
        result = $exeDevice.validateData();
      }).not.toThrow();
      expect(result).toBe(false);
      // The message the iDevice defines: it used to read a key it never set,
      // and the author got an empty alert.
      expect(eXe.app.alert).toHaveBeenCalledWith('Please add at least one question');
    });

    it('treats a missing question editor as empty content when trimming', () => {
      $exeDevice.questionsGame = [
        { question: 'a', feedback: '', suggestion: '', solution: 1 },
        { question: '', feedback: '', suggestion: '', solution: 1 },
      ];
      $exeDevice.active = 1;

      expect(() => $exeDevice.deleteEmptyQuestion()).not.toThrow();
      expect($exeDevice.questionsGame).toHaveLength(1);
    });

    it('keeps a single question when trimming without a question editor', () => {
      $exeDevice.questionsGame = [{ question: '', feedback: '', suggestion: '', solution: 1 }];
      $exeDevice.active = 0;

      $exeDevice.deleteEmptyQuestion();

      expect($exeDevice.questionsGame).toHaveLength(1);
    });

    it('normalizes questionsGame when importing a game file without questions', () => {
      const helpers = $exeDevices.iDevice.gamification.helpers;
      const originalIsJsonString = helpers.isJsonString;
      helpers.isJsonString = () => savedGame();

      try {
        $exeDevice.importGame(JSON.stringify(savedGame()), 'application/json');
      } finally {
        helpers.isJsonString = originalIsJsonString;
      }

      expect($exeDevice.questionsGame).toEqual([]);
    });
  });
  // Issue #2263: textButtonScorm had no c_() counterpart here, so nothing ever
  // translated the SCORM send button and the export's own default — Spanish —
  // was the only caption that reached the page.
  describe('the message keys the export expects', () => {
    it('translates the SCORM button caption', () => {
      $exeDevice.refreshTranslations();

      expect($exeDevice.ci18n.textButtonScorm).toBe('Save score');
    });

    it('routes it through c_ rather than inlining it', () => {
      c_.mockClear();

      $exeDevice.refreshTranslations();

      expect(c_).toHaveBeenCalledWith('Save score');
    });
  });

    /**
     * The pass-score control is a shared block in common_idevices_edition.js,
     * exercised by its own tests. What is specific to this iDevice -- and what silently
     * breaks if someone edits the form -- is the wiring: all four call sites
     * have to be present, and the two saved fields have to reach the stored
     * data. Reading the source is how that is checked without standing up the
     * whole edition form.
     */
    describe('pass score wiring', () => {
        let source;

        beforeEach(() => {
            source = readFileSync(join(__dirname, 'trueorfalse.js'), 'utf-8');
        });

        it('delegates the evaluation controls to the shared tab', () => {
            // The pass score and the progress report used to be rendered here,
            // loose in the general options. They now live in the Grading tab,
            // so rendering them again would show each control twice.
            expect(source).not.toContain('passScore.getContents(');
            expect(source).not.toContain('progressBar.getContents(');
            expect(source).toMatch(/tabs\.getHtml\([\s\S]*grading: true/);
        });

        it('restores the control when the iDevice is reopened', () => {
            expect(source).toContain('gamification.passScore.setValues(');
            expect(source).toContain('passScoreMode: game.passScoreMode');
            expect(source).toContain('passScoreCustom: game.passScoreCustom');
        });

        it('saves the mode and the customised mark, and nothing else', () => {
            expect(source).toContain('gamification.passScore.getValues()');
            expect(source).toContain('passScoreMode: passScore.passScoreMode');
            expect(source).toContain('passScoreCustom: passScore.passScoreCustom');
            // The project value is never copied into the iDevice: it is read
            // live, so an iDevice on the global mode follows the project.
            expect(source).not.toContain('passScoreGlobal');
        });

        it('wires the radio and input handlers', () => {
            expect(source).toContain('gamification.passScore.addEvents()');
        });
    });

    /**
     * The progress report is offered only in quiz mode, because that is the
     * only mode that produces a score to report. It used to live in a container
     * this iDevice showed and hid with the mode; the Grading tab left it always
     * visible, so an author could switch it on and watch validateData discard
     * it in silence.
     */
    describe('progress report availability', () => {
        beforeEach(() => {
            document.body.innerHTML =
                '<div class="exe-progress-report-wrapper"></div>';
        });

        it('hides the report when quiz mode is off', () => {
            $exeDevice.toggleProgressReport(false);
            expect(
                document
                    .querySelector('.exe-progress-report-wrapper')
                    .classList.contains('d-none')
            ).toBe(true);
        });

        it('shows the report when quiz mode is on', () => {
            $exeDevice.toggleProgressReport(false);
            $exeDevice.toggleProgressReport(true);
            expect(
                document
                    .querySelector('.exe-progress-report-wrapper')
                    .classList.contains('d-none')
            ).toBe(false);
        });

        it('no longer carries the container the report used to sit in', () => {
            const source = readFileSync(
                join(__dirname, 'trueorfalse.js'),
                'utf-8'
            );
            // Emptied when the report moved to the Grading tab. Leaving it
            // behind meant the mode kept toggling a div with nothing in it.
            expect(source).not.toContain('Games-Reportdiv');
        });

        it('still reads the report only in quiz mode', () => {
            const source = readFileSync(
                join(__dirname, 'trueorfalse.js'),
                'utf-8'
            );
            // A box ticked before the mode was turned off is stale: the control
            // is hidden, and saving it would promise a report nothing writes.
            const gate = source.indexOf('if (isTest) {');
            const read = source.indexOf('gamification.progressBar.getValues()');
            expect(gate).toBeGreaterThan(-1);
            expect(read).toBeGreaterThan(gate);
            expect(source.slice(gate, read)).not.toContain('}');
        });
    });

    describe('progress report in the initialized editor', () => {
        let previousLearning;

        beforeEach(() => {
            previousLearning = globalThis.eXeLearning;
            globalThis.eXeLearning = {
                app: { project: { odeId: 'report-test' }, common: { initTooltips: vi.fn() } },
            };
            vi.stubGlobal('bootstrap', { Tooltip: { getInstance: () => null } });
            // Load the real script with its filename so coverage includes the initialization path.
            const filename = join(__dirname, 'trueorfalse.js');
            runInThisContext(readFileSync(filename, 'utf8'), { filename });
            $exeDevice = globalThis.$exeDevice;
            global.attachEditionLifecycle($exeDevice);
            document.body.innerHTML = '<div id="editor" idevice-id="tof-new"></div>';
        });

        afterEach(() => {
            $exeDevice.$lifecycle?.destroy();
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
            globalThis.eXeLearning = previousLearning;
        });

        it.each([{}, null])('hides the report for a new self-check activity with previous data %s', previous => {
            $exeDevice.init(document.getElementById('editor'), previous, 'assets/');
            expect($('#tofEIsTest').is(':checked')).toBe(false);
            expect($('.exe-progress-report-wrapper')).toHaveLength(1);
            expect($('.exe-progress-report-wrapper').hasClass('d-none')).toBe(true);
        });

        it('shows the report in test mode and preserves it through save and reopen', () => {
            $exeDevice.init(document.getElementById('editor'), {}, 'assets/');
            $('#tofEIsTest').trigger('click');
            expect($('.exe-progress-report-wrapper').hasClass('d-none')).toBe(false);
            $('#eXeProgressReport').prop('checked', true);
            $('#eXeProgressReportID').val('report-test');
            $exeDevice.questionsGame = [{ question: 'Question', solution: true, feedback: '', suggestion: '' }];
            const saved = $exeDevice.validateData();
            expect(saved).toMatchObject({ isTest: true, evaluation: true, evaluationID: 'report-test' });
            $exeDevice.init(document.getElementById('editor'), saved, 'assets/');
            expect($('.exe-progress-report-wrapper').hasClass('d-none')).toBe(false);
            expect($('#eXeProgressReport').is(':checked')).toBe(true);
            expect($('#eXeProgressReportID').val()).toBe('report-test');
            $('#tofEIsTest').trigger('click');
            expect($('.exe-progress-report-wrapper').hasClass('d-none')).toBe(true);
            expect($exeDevice.validateData()).toMatchObject({ isTest: false, evaluation: false, evaluationID: '' });
        });
    });

  /**
   * Importing a question file is asynchronous, so the read can complete after
   * the editor closed. The callback used to reach `$exeDevice` through the
   * global, which by then holds whatever iDevice the author opened next.
   */
  describe('edition lifecycle teardown', () => {
    /** FileReader double that fires only when a test says so. */
    class FakeFileReader {
      constructor() {
        FakeFileReader.instances.push(this);
        this.readyState = 0;
        this.onload = null;
        this.abort = vi.fn(() => {
          this.readyState = 2;
        });
      }

      readAsText() {
        this.readyState = 1;
      }

      fire(result) {
        this.readyState = 2;
        if (this.onload) this.onload({ target: { result } });
      }
    }

    let originalFileReader;

    const selectFile = () => {
      const input = document.getElementById('eXeGameImportGame');
      Object.defineProperty(input, 'files', {
        value: [{ name: 'questions.json', type: 'application/json' }],
        configurable: true,
      });
      $(input).trigger('change');
    };

    beforeEach(() => {
      FakeFileReader.instances = [];
      originalFileReader = global.FileReader;
      global.FileReader = FakeFileReader;
      window.FileReader = FakeFileReader;

      document.body.innerHTML = `
        <div id="eXeGameExportImport"></div>
        <input type="file" id="eXeGameImportGame" />
        <button id="eXeGameExportQuestions"></button>`;
      $exeDevice.addEvents();
    });

    afterEach(() => {
      if ($exeDevice && $exeDevice.$lifecycle) $exeDevice.$lifecycle.destroy();
      global.FileReader = originalFileReader;
      window.FileReader = originalFileReader;
    });

    it('imports the questions while the edition is open', () => {
      const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});

      selectFile();
      FakeFileReader.instances[0].fire('{"q":1}');

      expect(importGame).toHaveBeenCalledWith('{"q":1}', 'application/json');
      importGame.mockRestore();
    });

    it('aborts an in-flight read when the edition closes', () => {
      selectFile();
      const reader = FakeFileReader.instances[0];
      expect(reader.readyState).toBe(1);

      $exeDevice.$lifecycle.destroy();

      expect(reader.abort).toHaveBeenCalledTimes(1);
    });

    it('ignores a late read callback instead of importing into a closed edition', () => {
      const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});

      selectFile();
      const reader = FakeFileReader.instances[0];
      $exeDevice.$lifecycle.destroy();
      reader.fire('{"q":1}');

      expect(importGame).not.toHaveBeenCalled();
      importGame.mockRestore();
    });

    it('never imports into the iDevice that replaced this one', () => {
      const first = $exeDevice;
      selectFile();
      const reader = FakeFileReader.instances[0];
      first.$lifecycle.destroy();

      const second = { importGame: vi.fn() };
      global.$exeDevice = second;
      reader.fire('{"q":1}');

      expect(second.importGame).not.toHaveBeenCalled();
      global.$exeDevice = first;
    });
  });
});

describe('trueorfalse minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'trueorfalse.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('trueorfalse edition: shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/trueorfalse/edition/';
    const panel = (name) => document.getElementById(`trueorfalseIdeviceForm-panel-${name}`);
    let device;
    let previousApp;
    let tooltips;

    beforeEach(() => {
        global.$exeDevice = undefined;
        previousApp = global.eXeLearning.app;
        tooltips = new Map();
        global.eXeLearning.app = {
            ...previousApp,
            common: {
                initTooltips: vi.fn((scope) => {
                    scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
                        if (!tooltips.has(button)) tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                    });
                }),
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });
        document.body.innerHTML = '<div id="tofBody" idevice-id="tof-1"></div>';
        device = global.loadIdevice(join(__dirname, 'trueorfalse.js'));
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        global.eXeLearning.app = previousApp;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    const open = (previousData = {}) => device.init(document.getElementById('tofBody'), previousData, PATH);

    it('lays the form out in the shared tabs, and opens on the questions', () => {
        open();
        const tabNames = [...document.querySelectorAll('#trueorfalseIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );

        expect(tabNames).toEqual(['instructions', 'options', 'contents', 'after', 'grading', 'texts']);
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
        open();

        expect(panel('instructions').querySelector('#eXeGameInstructions').value).toBe(
            'Answer all the questions in this quiz.'
        );
        for (const id of [
            'tofEShowSlider',
            'tofEIsTest',
            'tofETime',
            'tofEAttemptsNumber',
            'tofEQuestionsRandom',
            'tofEPercentageQuestions',
        ]) {
            expect(panel('options').querySelector(`#${id}`)).not.toBeNull();
        }
        expect(panel('contents').querySelector('#tofEQuestionEditor')).not.toBeNull();
        expect(panel('contents').querySelectorAll('input[name="tofAnswer"]')).toHaveLength(2);
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgTrue').value).toBe('True');
    });

    it('offers Import, Export and Create with AI on the Questions tab', () => {
        open();
        const links = [...panel('contents').querySelectorAll('[data-exe-share]')];

        expect(links.map((link) => link.getAttribute('data-exe-share'))).toEqual(['import', 'export', 'ai']);
        expect(document.querySelector('body > #eXeShareModal-import #eXeGameImportGame')).not.toBeNull();
        expect(document.querySelector('body > #eXeShareModal-export #eXeGameExportQuestions')).not.toBeNull();
        expect(document.getElementById('eXeEPromptArea').value.length).toBeGreaterThan(0);
        expect(panel('contents').firstElementChild.textContent).toContain('mark whether it is true or false');
    });

    it('provides one accessible information button at the end of each options row', () => {
        open();
        const helpButtons = [...panel('options').querySelectorAll('.exe-idevice-help')];

        expect(helpButtons).toHaveLength(6);
        for (const help of helpButtons) {
            const row = help.closest('#tofEOptions > div');
            expect(row.lastElementChild.contains(help)).toBe(true);
            expect(help.getAttribute('aria-label')).toBe(help.title);
            expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(30);
            const input = row.querySelector('input');
            const value = `${input.checked}${input.value}`;
            help.click();
            document.getElementById(help.getAttribute('aria-controls')).click();
            expect(`${input.checked}${input.value}`).toBe(value);
        }
    });

    it('shows the time and the attempts, with their help, only in test mode', () => {
        open();
        const rows = () => ['tofETimeDiv', 'tofEAttemptsNumberDiv'].map((id) => document.getElementById(id));

        for (const row of rows()) {
            expect(row.classList.contains('d-none')).toBe(true);
            expect(row.querySelector('.exe-idevice-help')).not.toBeNull();
        }
        document.getElementById('tofEIsTest').click();
        for (const row of rows()) {
            expect(row.classList.contains('d-none')).toBe(false);
            expect(row.classList.contains('d-flex')).toBe(true);
        }
        document.getElementById('tofEIsTest').click();
        for (const row of rows()) expect(row.classList.contains('d-none')).toBe(true);
    });

    it('disposes all option tooltips when the edition closes', () => {
        open();

        expect(tooltips.size).toBe(document.querySelectorAll('#trueorfalseIdeviceForm .exe-app-tooltip').length);
        expect(tooltips.size).toBeGreaterThanOrEqual(6);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('leaves the state of each switch to its native checkbox', () => {
        open();

        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('reopens and saves the questions with their options', () => {
        open({
            typeGame: 'TrueOrFalse',
            id: 'tof-1',
            eXeGameInstructions: '<p>Read carefully</p>',
            eXeIdeviceTextAfter: '',
            questionsGame: [
                { question: 'Madrid is in Spain', feedback: 'Yes', suggestion: 'Map', solution: 1 },
                { question: 'Rome is in France', feedback: '', suggestion: '', solution: 0 },
            ],
            showSlider: true,
            isTest: true,
            time: 5,
            attemptsNumber: 3,
            questionsRandom: true,
            percentageQuestions: 50,
            msgs: { msgTrue: 'Yes' },
        });
        expect(document.getElementById('tofEShowSlider').checked).toBe(true);
        expect(document.getElementById('tofEIsTest').checked).toBe(true);
        expect(document.getElementById('tofETimeDiv').classList.contains('d-flex')).toBe(true);
        expect(document.getElementById('tofETime').value).toBe('5');
        expect(document.getElementById('tofEAttemptsNumber').value).toBe('3');
        expect(document.getElementById('tofEQuestionsRandom').checked).toBe(true);
        expect(document.getElementById('tofENumeroPercentaje').textContent).toBe('1/2');
        expect(document.getElementById('ci18n_msgTrue').value).toBe('Yes');
        expect(document.getElementById('tofEQuestionEditor').value).toBe('Madrid is in Spain');
        expect(document.getElementById('tofAnswerTrue').checked).toBe(true);
        vi.spyOn(global.tinymce, 'get').mockReturnValue(null);

        expect(device.save()).toMatchObject({
            showSlider: true,
            isTest: true,
            time: 5,
            attemptsNumber: 3,
            questionsRandom: true,
            percentageQuestions: 50,
            questionsGame: [
                { question: 'Madrid is in Spain', feedback: 'Yes', suggestion: 'Map', solution: 1 },
                { question: 'Rome is in France', solution: 0 },
            ],
        });
    });

    it('starts a new question empty, also without the rich editor', () => {
        open();
        vi.spyOn(global.tinymce, 'get').mockReturnValue(null);
        $('#tofEQuestionEditor').val('First');
        $('#tofAnswerFalse').prop('checked', true);

        $('#tofEAdd').trigger('click');

        expect(device.questionsGame).toHaveLength(2);
        expect(device.questionsGame[0]).toMatchObject({ question: 'First', solution: 0 });
        // The fields used to keep the previous question, which then was
        // saved again as the new one.
        expect($('#tofEQuestionEditor').val()).toBe('');
        expect($('#tofEFeedBackEditor').val()).toBe('');
        expect($('#tofESuggestionEditor').val()).toBe('');
    });

    it('exports the feedback and the suggestion in the order Import reads back', () => {
        open();
        vi.spyOn(global.tinymce, 'get').mockReturnValue(null);
        const lines = device.getLinesQuestions([
            { question: 'The Sun is a star', solution: 1, feedback: 'It shines', suggestion: 'Look up' },
        ]);

        device.insertQuestions(lines);

        expect(device.questionsGame).toHaveLength(1);
        expect(device.questionsGame[0]).toMatchObject({
            question: 'The Sun is a star',
            solution: true,
            feedback: 'It shines',
            suggestion: 'Look up',
        });
    });

    it('exports the question on screen with its latest changes', async () => {
        open({
            typeGame: 'TrueOrFalse',
            questionsGame: [{ question: 'Old', feedback: '', suggestion: '', solution: 1 }],
            msgs: {},
        });
        vi.spyOn(global.tinymce, 'get').mockReturnValue(null);
        const download = vi
            .spyOn($exeIDevicesEdition.iDevice.gamification.share, 'downloadBlob')
            .mockReturnValue(true);
        $('#tofEQuestionEditor').val('New');

        device.exportQuestions();

        expect(download).toHaveBeenCalledTimes(1);
        expect(await download.mock.calls[0][0].text()).toBe('v-f#New#1##');
    });

    it('switches between the question, feedback and suggestion editors without following the link', () => {
        open();

        for (const [toggle, editor] of [
            ['tofFeedBackToggle', 'tofFeedBackDiv'],
            ['tofSuggestionToggle', 'SuggestionDiv'],
            ['tofQuestionToggle', 'tofQuestionDiv'],
        ]) {
            const click = new MouseEvent('click', { bubbles: true, cancelable: true });
            document.getElementById(toggle).dispatchEvent(click);

            expect(click.defaultPrevented).toBe(true);
            expect(document.getElementById(editor).classList.contains('d-block')).toBe(true);
        }
    });

    describe('adding questions to the one on screen', () => {
        // The author typed it in a new activity: it is on screen, not in the list yet.
        const typeOnScreen = (question) => {
            open();
            // Each editor stands on its own textarea.
            vi.spyOn(global.tinymce, 'get').mockImplementation((id) => ({
                getContent: () => $(`#${id}`).val(),
                setContent: (html) => $(`#${id}`).val(html),
            }));
            $('#tofEQuestionEditor').val(question);
            $('input[name="tofAnswer"][value="1"]').prop('checked', true);
        };
        const addFromAI = () =>
            device.insertQuestions(
                device.getLinesQuestions([{ question: 'The Sun is a star', solution: 1, feedback: '', suggestion: '' }])
            );
        const questions = () => device.questionsGame.map((item) => item.question);

        it('keeps it when it is complete', () => {
            typeOnScreen('Water boils at 100 degrees');

            addFromAI();

            expect(questions()).toEqual(['Water boils at 100 degrees', 'The Sun is a star']);
        });

        it('leaves it out, without its warning, when it is incomplete', () => {
            typeOnScreen('');
            const before = eXe.app._alertHistory.length;

            addFromAI();

            expect(questions()).toEqual(['The Sun is a star']);
            expect(eXe.app._alertHistory.slice(before)).toEqual([]);
        });
    });
});
