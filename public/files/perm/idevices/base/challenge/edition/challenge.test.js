/**
 * Unit tests for challenge iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - escapeHtml: HTML character escaping
 * - getChallengeDefault: Default challenge object structure
 * - getId: Unique ID generation
 *
 * Also covers the navigation between trials on a minimal DOM, and the form
 * laid out in the shared tabs.
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
  return global.$exeDevice;
}

describe('challenge iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'challenge.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect($exeDevice.escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('escapes less than', () => {
      expect($exeDevice.escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('escapes greater than', () => {
      expect($exeDevice.escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('escapes double quotes', () => {
      expect($exeDevice.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect($exeDevice.escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes multiple special characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      expect($exeDevice.escapeHtml(input)).toBe(expected);
    });

    it('returns empty string for empty input', () => {
      expect($exeDevice.escapeHtml('')).toBe('');
    });

    it('handles string with no special characters', () => {
      expect($exeDevice.escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('getChallengeDefault', () => {
    it('returns an object with title, solution and description', () => {
      const challenge = $exeDevice.getChallengeDefault();
      expect(challenge).toHaveProperty('title');
      expect(challenge).toHaveProperty('solution');
      expect(challenge).toHaveProperty('description');
    });

    it('returns empty strings for all properties', () => {
      const challenge = $exeDevice.getChallengeDefault();
      expect(challenge.title).toBe('');
      expect(challenge.solution).toBe('');
      expect(challenge.description).toBe('');
    });

    it('returns a new object each time', () => {
      const c1 = $exeDevice.getChallengeDefault();
      const c2 = $exeDevice.getChallengeDefault();
      expect(c1).not.toBe(c2);
    });
  });

  describe('getId', () => {
    it('returns a number', () => {
      const id = $exeDevice.getId();
      expect(typeof id).toBe('number');
    });

    it('returns different IDs when time or random changes', () => {
      // Mock Date and Math.random for deterministic testing
      const originalDate = global.Date;
      const originalRandom = Math.random;

      // First call: timestamp 1000, random 0.5
      global.Date = class extends originalDate {
        getTime() {
          return 1000;
        }
      };
      Math.random = () => 0.5;
      const id1 = $exeDevice.getId();
      expect(id1).toBe(Math.round(1000 + 0.5 * 100)); // 1050

      // Second call: different timestamp
      global.Date = class extends originalDate {
        getTime() {
          return 2000;
        }
      };
      Math.random = () => 0.5;
      const id2 = $exeDevice.getId();
      expect(id2).toBe(Math.round(2000 + 0.5 * 100)); // 2050

      // IDs should be different
      expect(id1).not.toBe(id2);

      // Restore originals
      global.Date = originalDate;
      Math.random = originalRandom;
    });

    it('returns a positive number', () => {
      const id = $exeDevice.getId();
      expect(id).toBeGreaterThan(0);
    });
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
    });

    it('has name defined', () => {
      expect($exeDevice.i18n.name).toBeDefined();
    });
  });

  describe('ci18n', () => {
    it('is defined', () => {
      expect($exeDevice.ci18n).toBeDefined();
    });
  });

  describe('validateData', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.validateData).toBe('function');
    });
  });

  describe('showMessage', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.showMessage).toBe('function');
    });
  });

  describe('addChallenge', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.addChallenge).toBe('function');
    });
  });

  describe('removeChallenge', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.removeChallenge).toBe('function');
    });
  });

  describe('copyChallenge', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.copyChallenge).toBe('function');
    });
  });

  describe('cutChallenge', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.cutChallenge).toBe('function');
    });
  });

  describe('pasteChallenge', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.pasteChallenge).toBe('function');
    });
  });

  describe('clearChallenge', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.clearChallenge).toBe('function');
    });
  });

  describe('addEvents', () => {
    let originalExeDevicesEdition;

    beforeEach(() => {
      originalExeDevicesEdition = global.$exeIDevicesEdition;
      document.body.innerHTML = '<div id="desafioIdeviceForm"></div>';
      $exeDevice.challengesGame = [];

      global.$exeIDevicesEdition = {
        iDevice: {
          gamification: {
            progressBar: { addEvents: vi.fn() },
            passScore: { addEvents: vi.fn() },
          },
        },
      };
    });

    afterEach(() => {
      global.$exeIDevicesEdition = originalExeDevicesEdition;
    });

    it('registers shared progress bar events', () => {
      $exeDevice.addEvents();
      expect(
        global.$exeIDevicesEdition.iDevice.gamification.progressBar.addEvents,
      ).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // DOM Manipulation Tests
  // ============================================

  describe('clearChallenge - DOM', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <input id="desafioECTitle" value="existing title" />
        <input id="desafioECSolution" value="existing solution" />
      `;
    });

    it('clears title field', () => {
      $exeDevice.clearChallenge();
      expect($('#desafioECTitle').val()).toBe('');
    });

    it('clears solution field', () => {
      $exeDevice.clearChallenge();
      expect($('#desafioECSolution').val()).toBe('');
    });
  });

  describe('addChallenge - DOM', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <span id="desafioENumberChallenge">1</span>
        <span id="desafioENumChallenges">1</span>
        <button id="desafioEPaste" style="display: block"></button>
        <div class="desafio-EDivFeebBack" id="desafioEDivFeebBack-0" style="display: block"></div>
        <div class="desafio-EDivFeebBack" id="desafioEDivFeebBack-1" style="display: none"></div>
        <input id="desafioECTitle" value="" />
        <input id="desafioECSolution" value="" />
      `;
      $exeDevice.challengesGame = [{ title: 'Test', solution: 'sol', description: '' }];
      $exeDevice.active = 0;
      $exeDevice.typeEdit = -1;
      $exeDevice.msgs = { msgTenChallenges: 'Max 10 challenges' };
      // Mock saveChallenge to avoid TinyMCE calls
      $exeDevice.saveChallenge = () => {};
    });

    it('adds new challenge to array', () => {
      $exeDevice.addChallenge();
      expect($exeDevice.challengesGame.length).toBe(2);
    });

    it('updates challenge counter', () => {
      $exeDevice.addChallenge();
      expect($('#desafioENumChallenges').text()).toBe('2');
    });

    it('updates current challenge number', () => {
      $exeDevice.addChallenge();
      expect($('#desafioENumberChallenge').text()).toBe('2');
    });

    it('hides paste button', () => {
      $exeDevice.addChallenge();
      expect($('#desafioEPaste').is(':visible')).toBe(false);
    });

    it('does not exceed 10 challenges', () => {
      $exeDevice.challengesGame = Array(10).fill({ title: '', solution: '', description: '' });
      const alertSpy = vi.spyOn(eXe.app, 'alert');
      $exeDevice.addChallenge();
      expect($exeDevice.challengesGame.length).toBe(10);
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  describe('removeChallenge - DOM', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <span id="desafioENumberChallenge">2</span>
        <span id="desafioENumChallenges">3</span>
        <button id="desafioEPaste" style="display: block"></button>
        <div id="desafioENumQuestionDiv"></div>
        <div id="desafioENavigationButtons"></div>
        <input id="desafioECTitle" />
        <input id="desafioECSolution" />
        <div id="divDesafioEDescription"></div>
        <div class="desafio-EDivFeebBack" id="desafioEDivFeebBack-0"></div>
        <div class="desafio-EDivFeebBack" id="desafioEDivFeebBack-1"></div>
        <div id="desafioEChallenges"></div>
      `;
      $exeDevice.challengesGame = [
        { title: '1', solution: 's1', description: '' },
        { title: '2', solution: 's2', description: '' },
        { title: '3', solution: 's3', description: '' },
      ];
      $exeDevice.active = 1;
      $exeDevice.typeEdit = -1;
      $exeDevice.msgs = { msgOneChallenge: 'Need at least 1' };
      // Mock functions
      $exeDevice.saveChallenge = () => {};
      $exeDevice.updateFeedBack = () => {};
    });

    it('removes challenge from array', () => {
      $exeDevice.removeChallenge();
      expect($exeDevice.challengesGame.length).toBe(2);
    });

    it('updates challenge counter', () => {
      $exeDevice.removeChallenge();
      expect($('#desafioENumChallenges').text()).toBe('2');
    });

    it('hides paste button', () => {
      $exeDevice.removeChallenge();
      expect($('#desafioEPaste').is(':visible')).toBe(false);
    });

    it('prevents removing last challenge', () => {
      $exeDevice.challengesGame = [{ title: 'Only', solution: 's', description: '' }];
      $exeDevice.active = 0;
      const alertSpy = vi.spyOn(eXe.app, 'alert');
      $exeDevice.removeChallenge();
      expect($exeDevice.challengesGame.length).toBe(1);
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  describe('copyChallenge - DOM', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <button id="desafioEPaste" style="display: none"></button>
      `;
      $exeDevice.challengesGame = [
        { title: 'Copy me', solution: 'sol', description: 'desc' },
      ];
      $exeDevice.active = 0;
      $exeDevice.clipBoard = null;
      $exeDevice.saveChallenge = () => {};
    });

    it('copies current challenge to clipboard', () => {
      $exeDevice.copyChallenge();
      expect($exeDevice.clipBoard.title).toBe('Copy me');
    });

    it('shows paste button', () => {
      $exeDevice.copyChallenge();
      // jQuery .show() sets display to empty string or block
      expect($('#desafioEPaste').css('display')).not.toBe('none');
    });

    it('sets typeEdit to 0 (copy mode)', () => {
      $exeDevice.copyChallenge();
      expect($exeDevice.typeEdit).toBe(0);
    });

    it('creates a deep copy (not same reference)', () => {
      $exeDevice.copyChallenge();
      expect($exeDevice.clipBoard).not.toBe($exeDevice.challengesGame[0]);
    });
  });

  describe('cutChallenge - DOM', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <button id="desafioEPaste" style="display: none"></button>
      `;
      $exeDevice.challengesGame = [{ title: 'A' }, { title: 'B' }];
      $exeDevice.active = 1;
      $exeDevice.saveChallenge = () => {};
    });

    it('sets numberCutCuestion to active index', () => {
      $exeDevice.cutChallenge();
      expect($exeDevice.numberCutCuestion).toBe(1);
    });

    it('shows paste button', () => {
      $exeDevice.cutChallenge();
      // jQuery .show() sets display to empty string or block
      expect($('#desafioEPaste').css('display')).not.toBe('none');
    });

    it('sets typeEdit to 1 (cut mode)', () => {
      $exeDevice.cutChallenge();
      expect($exeDevice.typeEdit).toBe(1);
    });
  });

  describe('showChallenge - DOM', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="desafioENumQuestionDiv" style="display: none"></div>
        <div id="desafioENavigationButtons" style="display: none"></div>
        <input id="desafioECTitle" value="" />
        <input id="desafioECSolution" value="" />
        <div id="divDesafioEDescription" style="display: block"></div>
        <div class="desafio-EDivFeebBack" id="desafioEDivFeebBack-0" style="display: none"></div>
        <div class="desafio-EDivFeebBack" id="desafioEDivFeebBack-1" style="display: none"></div>
        <div id="desafioEChallenges" style="display: none"></div>
        <span id="desafioENumChallenges">0</span>
        <span id="desafioENumberChallenge">0</span>
        <label for="desafioEDSolution"></label>
        <input id="desafioEDSolution" />
        <label for="desafioEDTitle"></label>
        <input id="desafioEDTitle" />
        <label for="desafioECTitle"></label>
        <label for="desafioECSolution"></label>
      `;
      $exeDevice.challengesGame = [
        { title: 'Challenge 1', solution: 'Sol 1', description: 'Desc 1' },
        { title: 'Challenge 2', solution: 'Sol 2', description: 'Desc 2' },
      ];
      $exeDevice.active = 0;
    });

    it('populates title field with challenge data', () => {
      $exeDevice.showChallenge(0);
      expect($('#desafioECTitle').val()).toBe('Challenge 1');
    });

    it('populates solution field with challenge data', () => {
      $exeDevice.showChallenge(0);
      expect($('#desafioECSolution').val()).toBe('Sol 1');
    });

    it('shows navigation buttons', () => {
      $exeDevice.showChallenge(0);
      // jQuery .show() sets display to empty string or block
      expect($('#desafioENavigationButtons').css('display')).not.toBe('none');
    });

    it('shows correct feedback div for index', () => {
      $exeDevice.showChallenge(1);
      // jQuery .show() sets display to empty string or block
      expect($('#desafioEDivFeebBack-1').css('display')).not.toBe('none');
    });

    it('updates challenge counter', () => {
      $exeDevice.showChallenge(1);
      expect($('#desafioENumChallenges').text()).toBe('2');
    });

    it('handles negative index by clamping to 0', () => {
      $exeDevice.showChallenge(-5);
      expect($('#desafioECTitle').val()).toBe('Challenge 1');
    });

    it('handles index beyond array length by clamping to last', () => {
      $exeDevice.showChallenge(100);
      expect($('#desafioECTitle').val()).toBe('Challenge 2');
    });
  });

    /**
     * The pass-score control is a shared block in common_edition.js, exercised
     * by its own tests. What is specific to this iDevice -- and what silently
     * breaks if someone edits the form -- is the wiring: all four call sites
     * have to be present, and the two saved fields have to reach the stored
     * data. Reading the source is how that is checked without standing up the
     * whole edition form.
     */
    describe('pass score wiring', () => {
        let source;

        beforeEach(() => {
            source = readFileSync(join(__dirname, 'challenge.js'), 'utf-8');
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

describe('challenge minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'challenge.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('challenge edition: shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/challenge/edition/';
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#desafioIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`desafioIdeviceForm-panel-${name}`);
    const trial = (title, solution) => ({
        title,
        solution,
        description: `<p>${title}</p>`,
        timeShow: -1,
        clues: [
            { clue: 'First help', time: 5 },
            { clue: 'Second help', time: 10 },
            { clue: 'Third help', time: 5 },
        ],
    });
    const game = (overrides = {}) => ({
        typeGame: 'desafio',
        desafioTitle: 'The vault',
        desafioSolution: 'OPEN',
        desafioType: 1,
        desafioTime: 60,
        desafioDescription: '<p>Open the vault</p>',
        showMinimize: true,
        challengesGame: [trial('Lock', 'KEY')],
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
        desafioID: 1234,
        evaluation: false,
        evaluationID: '',
        msgs: {},
        ...overrides,
    });
    let device;
    let previousApp;
    let previousHelpers;
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
        previousHelpers = { ...helpers() };
        Object.assign(helpers(), {
            isJsonString: (text) => {
                try {
                    return JSON.parse(text);
                } catch {
                    return false;
                }
            },
            decrypt: (text) => text,
            encrypt: (text) => text,
        });
        document.body.innerHTML = '<div id="challengeBody"></div>';
        const filename = join(__dirname, 'challenge.js');
        runInThisContext(readFileSync(filename, 'utf8'), { filename });
        device = global.$exeDevice;
        global.attachEditionLifecycle(device);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        global.eXeLearning.app = previousApp;
        vi.unstubAllGlobals();
        for (const key of ['isJsonString', 'decrypt', 'encrypt']) {
            if (key in previousHelpers) helpers()[key] = previousHelpers[key];
            else delete helpers()[key];
        }
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    const open = (previousData = {}) => device.init(document.getElementById('challengeBody'), previousData, PATH);

    const stored = (data) => `
        <div class="desafio-IDevice">
            <div class="desafio-instructions"><p>Escape!</p></div>
            <div class="desafio-version js-hidden">2</div>
            <div class="desafio-EDescription"><p>Open the vault</p></div>
            <div class="desafio-ChallengeDescription"><p>Lock</p></div>
            <div class="desafio-DataGame js-hidden">${JSON.stringify(data)}</div>
        </div>`;

    it('lays the form out in the shared tabs, and opens on its questions', () => {
        open();

        expect(tabNames()).toEqual(['instructions', 'options', 'contents', 'grading', 'texts']);
        expect(document.getElementById('desafioIdeviceForm-tab-contents').textContent.trim()).toBe('Activities');
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
        open();

        expect(panel('instructions').querySelector('#eXeGameInstructions').value).toBe(
            'Solve all the trials and complete the final challenge.'
        );
        expect(panel('options').querySelector('#desafioEShowMinimize')).not.toBeNull();
        expect(panel('options').querySelectorAll('input, select')).toHaveLength(1);
        expect(panel('contents').querySelector('#desafioEPanel')).not.toBeNull();
        // The type and the time stay under the challenge's title and solution, as in main.
        expect(panel('contents').querySelector('.desafio-EDataChallenger #desafioSelects #desafioEDType')).not.toBeNull();
        expect(panel('contents').querySelector('.desafio-EDataChallenger #desafioSelects #desafioEDTime')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgStartGame').value).toBe('Click here to start');
    });

    it('explains what goes in the Questions tab, and offers no sharing', () => {
        open();
        const info = panel('contents').firstElementChild;

        expect(info.tagName).toBe('P');
        expect(info.textContent).toContain('Write the final challenge, add its trials and edit them one by one.');
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('provides one accessible information button after each setting', () => {
        open();
        const helpButtons = [
            ...document.querySelectorAll('#desafioEOptions .exe-idevice-help, #desafioSelects .exe-idevice-help'),
        ];

        expect(helpButtons).toHaveLength(3);
        for (const help of helpButtons) {
            const row = help.closest('.d-flex, #desafioSelects');
            // Right after its control: the type and the time share a row.
            expect(help.parentElement.previousElementSibling.matches('select, .toggle-item')).toBe(true);
            expect(help.type).toBe('button');
            expect(help.getAttribute('aria-label')).toBe(help.title);
            expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(30);
            const controls = [...row.querySelectorAll('input, select')];
            const values = controls.map((control) => `${control.checked}${control.value}`);
            help.click();
            row.querySelector('.help-content')?.click();
            expect(controls.map((control) => `${control.checked}${control.value}`)).toEqual(values);
        }
    });

    it('disposes all option tooltips when the edition closes', () => {
        open();

        expect(tooltips.size).toBe(document.querySelectorAll('#desafioIdeviceForm .exe-app-tooltip').length);
        expect(tooltips.size).toBeGreaterThanOrEqual(3);
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

    it('shows the type and the time with the challenge and hides them with the trials, as in main', () => {
        open();
        const selects = document.getElementById('desafioSelects');
        expect(selects.style.display).toBe('flex');

        document.getElementById('desafioEReto').click();
        expect(selects.style.display).toBe('none');

        document.getElementById('desafioEDesafio').click();
        expect(selects.style.display).toBe('flex');
    });

    it('restores the options of a saved game', () => {
        open(stored(game()));

        expect(document.getElementById('desafioEShowMinimize').checked).toBe(true);
        expect(document.getElementById('desafioEDType').value).toBe('1');
        expect(document.getElementById('desafioEDTime').value).toBe('60');
        expect(document.getElementById('desafioEDTitle').value).toBe('The vault');
    });

    it('restores the custom texts of a saved game', () => {
        open(stored(game({ msgs: { msgStartGame: 'Go!' } })));

        expect(document.getElementById('ci18n_msgStartGame').value).toBe('Go!');
    });

    it('saves the options it shows', () => {
        open(stored(game()));
        const editors = {
            eXeGameInstructions: '<p>Escape!</p>',
            desafioEDescription: '<p>Open the vault</p>',
            'desafioEChallenge-0': '<p>Lock</p>',
        };
        const tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
            id in editors ? { initialized: true, getContent: () => editors[id], setContent: () => {} } : null
        );

        try {
            const data = device.validateData();

            // happy-dom does not read `option:selected`, so the type and the
            // time are left to the Playwright spec, which saves and reloads them.
            expect(data).toMatchObject({
                showMinimize: true,
                desafioTitle: 'The vault',
                desafioSolution: 'OPEN',
            });
            expect(device.save()).not.toContain('exe-idevice-help');
        } finally {
            tinymceGet.mockRestore();
        }
    });

    it('starts a new game as linear', () => {
        open();

        expect(document.getElementById('desafioEDType').value).toBe('0');
    });

    it('names the game types in the language of the edition', () => {
        open();

        expect([...document.querySelectorAll('#desafioEDType option')].map((option) => option.textContent)).toEqual([
            'Linear',
            'Free',
        ]);
    });

    it('reopens a game saved without a type as linear', () => {
        open(stored(game({ desafioType: null })));

        expect(document.getElementById('desafioEDType').value).toBe('0');
    });

    it('starts a new trial with no help of its own', () => {
        open();
        document.getElementById('desafioEReto').click();
        document.getElementById('desafioECTitle').value = 'Lock';
        document.getElementById('desafioEClue1').value = 'Look under the mat';

        device.addChallenge();
        device.saveChallenge();

        expect(document.getElementById('desafioEClue1').value).toBe('');
        expect(device.challengesGame[0].clues[0].clue).toBe('Look under the mat');
        expect(device.challengesGame[1].clues.map((clue) => clue.clue)).toEqual(['', '', '']);
    });

    it('shows no help on a trial that has none', () => {
        open(stored(game()));
        device.challengesGame.push(device.getChallengeDefault());

        device.showChallenge(1);

        expect(document.getElementById('desafioEClue1').value).toBe('');
        expect(document.getElementById('desafioECTime2').value).toBe('10');
    });

    it('keeps a trial written before its editor starts', () => {
        open();
        device.active = 0;
        document.getElementById('desafioEChallenge-0').value = '<p>Find the key</p>';

        device.saveChallenge();

        expect(device.challengesGame[0].description).toBe('<p>Find the key</p>');
    });

    it('names both description editors as descriptions', () => {
        open();

        expect(document.querySelector('label[for="desafioEDescription"]').textContent).toBe('Description:');
        expect(document.querySelector('label[for="desafioEChallenge-0"]').textContent).toBe('Description');
    });
});
