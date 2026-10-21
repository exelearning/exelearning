/**
 * Unit tests for crossword iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getCuestionDefault: Default question structure
 * - escapeHtml: HTML escaping
 * - validTime: Time format validation
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runInThisContext } from 'vm';

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
  // The edition scripts register their timers, handlers and disposers through
  // `this.$lifecycle`, exactly as IdeviceNode provides it in the workarea.
  global.attachEditionLifecycle(global.$exeDevice);
  return global.$exeDevice;
}

describe('crossword iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'crossword.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('getCuestionDefault', () => {
    it('returns a default question object with correct structure', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();

      expect(defaultQuestion).toEqual({
        word: '',
        definition: '',
        url: '',
        audio: '',
        x: 0,
        y: 0,
        author: '',
        alt: '',
      });
    });

    it('returns a new object each time', () => {
      const q1 = $exeDevice.getCuestionDefault();
      const q2 = $exeDevice.getCuestionDefault();

      expect(q1).not.toBe(q2);
      q1.word = 'modified';
      expect(q2.word).toBe('');
    });

    it('has word property as empty string', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();
      expect(defaultQuestion.word).toBe('');
    });

    it('has definition property as empty string', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();
      expect(defaultQuestion.definition).toBe('');
    });

    it('has coordinates initialized to 0', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();
      expect(defaultQuestion.x).toBe(0);
      expect(defaultQuestion.y).toBe(0);
    });
  });

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect($exeDevice.escapeHtml('&')).toBe('&amp;');
      expect($exeDevice.escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes less than', () => {
      expect($exeDevice.escapeHtml('<')).toBe('&lt;');
      expect($exeDevice.escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('escapes greater than', () => {
      expect($exeDevice.escapeHtml('>')).toBe('&gt;');
    });

    it('escapes double quotes', () => {
      expect($exeDevice.escapeHtml('"')).toBe('&quot;');
      expect($exeDevice.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect($exeDevice.escapeHtml("'")).toBe('&#39;');
      expect($exeDevice.escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes multiple characters', () => {
      expect($exeDevice.escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
    });

    it('handles empty string', () => {
      expect($exeDevice.escapeHtml('')).toBe('');
    });

    it('handles string with no special characters', () => {
      expect($exeDevice.escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('validTime', () => {
    it('returns true for valid time format hh:mm:ss', () => {
      expect($exeDevice.validTime('00:00:00')).toBe(true);
      expect($exeDevice.validTime('23:59:59')).toBe(true);
      expect($exeDevice.validTime('12:30:45')).toBe(true);
    });

    it('returns false for invalid hours', () => {
      expect($exeDevice.validTime('24:00:00')).toBe(false);
      expect($exeDevice.validTime('25:00:00')).toBe(false);
    });

    it('returns false for invalid minutes', () => {
      expect($exeDevice.validTime('12:60:00')).toBe(false);
      expect($exeDevice.validTime('12:99:00')).toBe(false);
    });

    it('returns false for invalid seconds', () => {
      expect($exeDevice.validTime('12:30:60')).toBe(false);
      expect($exeDevice.validTime('12:30:99')).toBe(false);
    });

    it('returns false for wrong length', () => {
      expect($exeDevice.validTime('12:30')).toBe(false);
      expect($exeDevice.validTime('')).toBe(false);
    });
  });

  describe('i18n', () => {
    it('has category and name defined', () => {
      expect($exeDevice.i18n).toBeDefined();
      expect($exeDevice.i18n.category).toBeDefined();
      expect($exeDevice.i18n.name).toBeDefined();
    });
  });

  describe('classIdevice', () => {
    it('has correct class identifier', () => {
      expect($exeDevice.classIdevice).toBe('crossword');
    });
  });

  describe('edition lifecycle', () => {
    let originalItinerary;
    let originalMedia;

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="crosswordForm">
          <span class="toggle-item">
            <input id="tgl" class="toggle-input" type="checkbox" data-target="#tgt">
          </span>
          <div id="tgt"></div>
          <input id="eXeGameImportGame" type="file">
        </div>
      `;
      originalItinerary = global.$exeIDevicesEdition.iDevice.gamification.itinerary;
      global.$exeIDevicesEdition.iDevice.gamification.itinerary = { addEvents: vi.fn() };
      originalMedia = global.$exeDevices.iDevice.gamification.media;
      global.$exeDevices.iDevice.gamification.media = { extractURLGD: url => url };
      global.$exeIDevicesEdition.iDevice.gamification.helpers.stopSound = vi.fn();
      $exeDevice.addEvents();
    });

    afterEach(() => {
      // Close the edition the test opened, so its document handlers cannot
      // leak into the next one — exactly what the workarea does on teardown.
      $exeDevice.$lifecycle.destroy();
      global.$exeIDevicesEdition.iDevice.gamification.itinerary = originalItinerary;
      global.$exeDevices.iDevice.gamification.media = originalMedia;
      document.body.innerHTML = '';
    });

    describe('delegated .toggle-input handler on document', () => {
      it('reacts to a change while the edition is open', () => {
        const $input = $('#tgl');
        $input.prop('checked', true).trigger('change');

        expect($('#tgt').css('display')).toBe('flex');
      });

      it('stops reacting once the edition is closed', () => {
        $('#tgl').prop('checked', true).trigger('change');
        expect($('#tgt').css('display')).toBe('flex');

        $exeDevice.$lifecycle.destroy();

        $('#tgl').prop('checked', false).trigger('change');

        expect($('#tgt').css('display')).toBe('flex');
      });

      it('leaves unrelated document handlers registered', () => {
        const unrelated = vi.fn();
        $(document).on('change.crosswordUnrelated', '.toggle-input', unrelated);

        $exeDevice.$lifecycle.destroy();
        $('#tgl').trigger('change');

        expect(unrelated).toHaveBeenCalledTimes(1);
        $(document).off('change.crosswordUnrelated');
      });
    });

    describe('import FileReader', () => {
      /**
       * Drive the file input the way a user picking a file does, and hand back
       * the FileReader the edition created for it.
       *
       * @returns {FileReader}
       */
      function pickFile() {
        const readers = [];
        const RealFileReader = global.FileReader;
        class TrackedFileReader extends RealFileReader {
          constructor() {
            super();
            readers.push(this);
          }
        }
        global.FileReader = TrackedFileReader;
        try {
          const input = document.getElementById('eXeGameImportGame');
          Object.defineProperty(input, 'files', {
            configurable: true,
            value: [new File(['word|clue'], 'game.txt', { type: 'text/plain' })],
          });
          $(input).trigger('change');
        } finally {
          global.FileReader = RealFileReader;
        }
        return readers[0];
      }

      it('aborts a read that is still in flight when the edition closes', () => {
        const reader = pickFile();
        expect(reader).toBeDefined();
        const abort = vi.spyOn(reader, 'abort');

        expect(reader.readyState).toBe(1);
        $exeDevice.$lifecycle.destroy();

        expect(abort).toHaveBeenCalledTimes(1);
        abort.mockRestore();
      });

      it('discards a load that resolves after the edition closed', () => {
        const reader = pickFile();
        const importGame = vi.fn();
        $exeDevice.importGame = importGame;

        $exeDevice.$lifecycle.destroy();
        reader.onload({ target: { result: 'word|clue' } });

        expect(importGame).not.toHaveBeenCalled();
      });

      it('imports a load that resolves while the edition is open', () => {
        const reader = pickFile();
        const importGame = vi.fn();
        $exeDevice.importGame = importGame;

        reader.onload({ target: { result: 'word|clue' } });

        expect(importGame).toHaveBeenCalledWith('word|clue', 'text/plain');
      });
    });

    describe('preview audio', () => {
      it('stops playback and releases the stream when the edition closes', () => {
        $exeDevice.playSound('files/beep.mp3');
        const player = $exeDevice.playerAudio;
        const pause = vi.spyOn(player, 'pause');

        $exeDevice.$lifecycle.destroy();

        expect(pause).toHaveBeenCalledTimes(1);
        expect(player.hasAttribute('src')).toBe(false);
        pause.mockRestore();
      });
    });
  });
});

describe('default image edition/export dedup', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const editionDir = __dirname;
  const exportDir = path.join(editionDir, '..', 'export');

  it('ships the default image only in export/ (edition previews the export copy)', () => {
    expect(fs.existsSync(path.join(exportDir, 'ccgmbackground.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(editionDir, 'ccgmbackground.jpg'))).toBe(false);
  });

  it('routes every edition reference to the export copy', () => {
    const source = fs.readFileSync(path.join(editionDir, 'crossword.js'), 'utf-8');
    const refs = source.split('ccgmbackground.jpg').length - 1;
    const routed = source.split("replace(/\\/edition\\/?$/, '/export/')").length - 1;
    expect(refs).toBeGreaterThan(0);
    expect(routed).toBeGreaterThan(0);
    // No unrouted direct reference may sneak back in.
    expect(source).not.toContain("path + 'ccgmbackground.jpg'");
    expect(source).not.toContain('${path}ccgmbackground.jpg');
    expect(source).not.toContain('${$exeDevice.idevicePath}ccgmbackground.jpg');
  });

  /**
   * The pass-score control is a shared block in common_edition.js, exercised by
   * its own tests. What is specific to this iDevice -- and what silently breaks
   * if someone edits the form -- is the wiring: all four call sites have to be
   * present, and the two saved fields have to reach the stored data. Reading
   * the source is how that is checked without standing up the whole edition
   * form.
   */
  describe('pass score wiring', () => {
      let source;

      beforeEach(() => {
          source = readFileSync(join(__dirname, 'crossword.js'), 'utf-8');
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
});

describe('crossword minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'crossword.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('crossword edition: shared form tabs and feedback', () => {
  const PATH = '/files/perm/idevices/base/crossword/edition/';
  const edition = () => global.$exeIDevicesEdition.iDevice;
  const feedback = () => edition().gamification.feedback;
  const tabNames = () =>
    [...document.querySelectorAll('#ccgmQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
      tab.getAttribute('data-exe-tab')
    );
  const panel = (name) => document.getElementById(`ccgmQEIdeviceForm-panel-${name}`);
  const game = (overrides = {}) => ({
    typeGame: 'Crucigrama',
    itinerary: {
      showClue: false,
      clueGame: '',
      percentageClue: 40,
      showCodeAccess: false,
      codeAccess: '',
      messageCodeAccess: '',
    },
    wordsGame: [
      { word: 'CASA', definition: 'Hogar', url: '', audio: '', x: 0, y: 0, author: '', alt: '' },
      { word: 'ARBOL', definition: 'Planta con tronco', url: '', audio: '', x: 0, y: 0, author: '', alt: '' },
    ],
    feedBack: false,
    percentajeFB: 100,
    isScorm: 0,
    textButtonScorm: 'Save score',
    ...overrides,
  });
  const exportHelpers = {
    isJsonString: (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return false;
      }
    },
    decrypt: (text) => text,
    encrypt: (text) => text,
  };
  let device;
  let previousApp;
  let originalMedia;
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
    Object.assign(global.$exeDevices.iDevice.gamification.helpers, exportHelpers);
    originalMedia = global.$exeDevices.iDevice.gamification.media;
    global.$exeDevices.iDevice.gamification.media = { extractURLGD: (url) => url };
    document.body.innerHTML = '<div id="crosswordBody"></div>';
    const filename = join(__dirname, 'crossword.js');
    runInThisContext(readFileSync(filename, 'utf8'), { filename });
    device = global.$exeDevice;
    global.attachEditionLifecycle(device);
    device.init(document.getElementById('crosswordBody'), {}, PATH);
  });

  afterEach(() => {
    device.$lifecycle?.destroy();
    global.eXeLearning.app = previousApp;
    vi.unstubAllGlobals();
    Object.keys(exportHelpers).forEach((name) => delete global.$exeDevices.iDevice.gamification.helpers[name]);
    global.$exeDevices.iDevice.gamification.media = originalMedia;
    global.$exeDevice = undefined;
    document.body.innerHTML = '';
  });

  it('lays the form out in the shared tabs, and opens on its questions', () => {
    expect(tabNames()).toEqual([
      'instructions',
      'options',
      'contents',
      'passwords',
      'feedback',
      'after',
      'grading',
      'texts',
    ]);
    expect(document.getElementById('ccgmQEIdeviceForm-tab-contents').textContent.trim()).toBe('Activities');
    expect(panel('contents').classList.contains('active')).toBe(true);
  });

  it('puts each part of the form in its tab', () => {
    expect(panel('instructions').querySelector('#eXeGameInstructions').value).toBe(
      'Complete the following crossword puzzle.'
    );
    expect(panel('options').querySelector('#ccgmEOptions')).not.toBeNull();
    expect(panel('contents').querySelector('#ccgmEPanel')).not.toBeNull();
    expect(panel('passwords').querySelector('#eXeGameShowClue')).not.toBeNull();
    expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
    expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
    expect(panel('texts').querySelector('#ci18n_msgReply').value).toBe('Reply');
  });

  it('provides one accessible information button at the end of each options row', () => {
    const options = panel('options');
    const helpButtons = [...options.querySelectorAll('#ccgmEOptions .exe-idevice-help')];
    expect(helpButtons).toHaveLength(8);
    for (const help of helpButtons) {
      const row = help.closest('.d-flex');
      expect(row).not.toBeNull();
      expect(row.lastElementChild.contains(help)).toBe(true);
      expect(help.tagName).toBe('BUTTON');
      expect(help.type).toBe('button');
      expect(help.getAttribute('aria-label')).toBe(help.title);
      expect(help.title).toBe('Information');
      expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(30);
      expect(help.querySelector('[aria-hidden="true"].info-icon-solid-green')).not.toBeNull();
      const controls = [...row.querySelectorAll('input, select')];
      const checked = controls.map((control) => control.checked);
      help.click();
      expect(controls.map((control) => control.checked)).toEqual(checked);
    }
    expect(global.eXeLearning.app.common.initTooltips).toHaveBeenCalledWith(
      document.getElementById('ccgmQEIdeviceForm-panels')
    );
  });

  it('escapes translated help text in the explanation', () => {
    const text = 'Use "Accept" <once> & keep the learner\'s answer.';
    const container = document.createElement('div');
    container.innerHTML = edition().common.getHelpTooltip(text);
    const button = container.querySelector('button');
    expect(button.title).toBe('Information');
    expect(container.querySelector('.help-content').textContent).toBe(text);
    expect(container.querySelector('once')).toBeNull();
  });

  it('disposes all option tooltips when the edition closes', () => {
    expect(tooltips.size).toBe(14); // Options plus the six shared Grading helpers.
    device.$lifecycle.destroy();
    for (const tooltip of tooltips.values()) {
      expect(tooltip.dispose).toHaveBeenCalledTimes(1);
    }
  });

  it('offers Import, Export and Create with AI on its Questions tab, in windows of their own', () => {
    const links = [...panel('contents').querySelectorAll('[data-exe-share]')];

    expect(links.map((link) => link.getAttribute('data-exe-share'))).toEqual(['import', 'export', 'ai']);
    expect(document.querySelector('body > #eXeShareModal-import #eXeGameImportGame')).not.toBeNull();
    expect(document.querySelector('body > #eXeShareModal-export #eXeGameExportQuestions')).not.toBeNull();
    expect(document.querySelector('body > #eXeShareModal-ai #eXeEPromptArea')).not.toBeNull();
  });

  it('leaves the feedback to the shared block, without controls of its own', () => {
    expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
    expect(document.getElementById('ccgmEHasFeedBack')).toBeNull();
    expect(document.getElementById('ccgmEPercentajeFB')).toBeNull();
    expect(document.getElementById('ccgmEFeedBackEditor')).toBeNull();
  });

  it('switches tabs when one is clicked', () => {
    document.getElementById('ccgmQEIdeviceForm-tab-options').click();

    expect(panel('options').classList.contains('active')).toBe(true);
    expect(panel('contents').classList.contains('active')).toBe(false);
  });

  it('makes the feedback compulsory in "No score" mode only', () => {
    device.updateGameMode(2);
    expect(feedback().isRequired()).toBe(true);
    expect(document.getElementById('eXeGameHasFeedBack').disabled).toBe(true);

    device.updateGameMode(0);
    expect(feedback().isRequired()).toBe(false);
    expect(document.getElementById('eXeGameHasFeedBack').disabled).toBe(false);
  });

  it('restores the feedback with the game', () => {
    device.updateFieldGame(game({ feedBack: true, percentajeFB: 80 }));

    expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
    expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
  });

  it('loads the saved message into the shared editor', () => {
    device.idevicePreviousData = `
      <div class="crucigrama-IDevice">
        <div class="crucigrama-version js-hidden">2</div>
        <div class="crucigrama-feedback-game"><p>Well done</p></div>
        <div class="crucigrama-DataGame js-hidden">${JSON.stringify(game({ feedBack: true }))}</div>
      </div>`;
    vi.spyOn(device, 'showQuestion').mockImplementation(() => {});

    device.loadPreviousValues();

    expect(feedback().getText()).toBe('<p>Well done</p>');
    expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
  });

  describe('saving', () => {
    let editors;
    let tinymceGet;

    beforeEach(() => {
      editors = {
        eXeGameInstructions: '<p>Instructions</p>',
        eXeIdeviceTextAfter: '',
        eXeGameFeedBackEditor: '',
      };
      tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
        id in editors ? { initialized: true, getContent: () => editors[id], setContent: (html) => (editors[id] = html) } : null
      );
      device.wordsGame = [
        { ...device.getCuestionDefault(), word: 'CASA', definition: 'Hogar' },
        { ...device.getCuestionDefault(), word: 'ARBOL', definition: 'Planta con tronco' },
      ];
    });

    afterEach(() => {
      tinymceGet.mockRestore();
    });

    it('explains what goes in the Questions tab', () => {
        const info = panel('contents').firstElementChild;

        expect(info.tagName).toBe('P');
        expect(info.textContent).toContain('Add the words and their definitions, and edit them one by one.');
    });

    it('leaves the state of each switch to its native checkbox', () => {
        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('counts the first word of a new activity', () => {
      device.$lifecycle?.destroy();
      device.wordsGame = [];
      device.init(document.getElementById('crosswordBody'), {}, PATH);

      expect(device.wordsGame).toHaveLength(1);
      expect(document.getElementById('ccgmENumQuestions').textContent).toBe('1');
    });

    it('counts a pasted copy in the words per game', () => {
      device.active = 0;
      device.showQuestion(0);
      device.updateQuestionsNumber();

      device.copyQuestion();
      device.pasteQuestion();

      expect(device.wordsGame).toHaveLength(3);
      expect(document.getElementById('ccgmENumeroPercentaje').textContent).toBe('3/3');
    });

    it('exports the word on screen with the others', async () => {
      const blobs = [];
      const download = vi
        .spyOn(global.$exeIDevicesEdition.iDevice.gamification.share, 'downloadBlob')
        .mockImplementation((blob) => {
          blobs.push(blob);
          return true;
        });
      device.active = 0;
      device.showQuestion(0);
      document.getElementById('ccgmESolutionWord').value = 'SUN';
      document.getElementById('ccgmEDefinitionWord').value = 'The star of our system';

      device.exportQuestions();
      download.mockRestore();

      // The word on screen used to be left out, or the export refused when it was new.
      expect(blobs).toHaveLength(1);
      expect(await blobs[0].text()).toBe('SUN#The star of our system\nARBOL#Planta con tronco');
    });

    it('does not tell the author that the AI words were added when none fits the game', () => {
      eXe.app.alert.mockClear();

      // Too long, and with a space: the filter leaves nothing to add.
      expect(device.insertWords(['SOLAR SYSTEM#The sun and its planets'])).toEqual({ handledMessaging: true });
      expect(eXe.app.alert).toHaveBeenCalledWith('Sorry, there are no questions for this type of activity.');
      expect(device.wordsGame).toHaveLength(2);
      expect(device.insertWords(['SUN#The star of our system'])).toBeUndefined();
    });

    it('stores a word with the fields of its form only', () => {
      device.active = 0;
      $('#ccgmESolutionWord').val('HEART');
      $('#ccgmEDefinitionWord').val('Organ that pumps blood');

      expect(device.validateQuestion()).toBeTruthy();
      expect(device.wordsGame[0]).toMatchObject({ word: 'HEART', definition: 'Organ that pumps blood' });
      expect(device.wordsGame[0]).not.toHaveProperty('percentageShow');
    });

    it('saves the feedback values the export reads', () => {
      device.updateFieldGame(game({ wordsGame: device.wordsGame, feedBack: true, percentajeFB: 70 }));
      editors.eXeGameFeedBackEditor = '<p>Bravo</p>';
      vi.spyOn(device, 'validateQuestion').mockReturnValue(true);

      const data = device.validateData();

      expect(data.feedBack).toBe(true);
      expect(data.percentajeFB).toBe(70);
      expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
      expect(device.save()).toContain('<div class="crucigrama-feedback-game"><p>Bravo</p></div>');
    });

    it('requires feedback message if feedback is enabled and text is empty', () => {
      device.updateFieldGame(game({ wordsGame: device.wordsGame, feedBack: true }));
      editors.eXeGameFeedBackEditor = '';
      vi.spyOn(device, 'validateQuestion').mockReturnValue(true);

      expect(device.validateData()).toBe(false);
      expect(global.eXe.app.alert).toHaveBeenCalledWith('Message to display when passing the game');
    });
  });
});
