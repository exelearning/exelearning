/**
 * Unit tests for scrambled-list iDevice
 *
 * Tests pure functions and data structures:
 * - checkValues: Data validation
 * - dataJson: JSON data structure
 */

/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

describe('scrambled-list iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'scrambled-list.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('name', () => {
    it('has name defined', () => {
      expect($exeDevice.name).toBeDefined();
    });
  });

  describe('checkValues', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.checkValues).toBe('function');
    });
  });

  describe('dataJson', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.dataJson).toBe('function');
    });
  });

  describe('addQuestions', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.addQuestions).toBe('function');
    });
  });

  describe('normalizeOptions', () => {
    it('normalizes legacy object and nested option shapes', () => {
      expect(
        $exeDevice.normalizeOptions([
          { text: ' First ' },
          { value: '<em>Second</em>' },
          [' Third ', false],
          null,
        ]),
      ).toEqual(['First', '<em>Second</em>', 'Third']);
    });
  });

  describe('normalizePreviousData', () => {
    it('extracts previous data from legacy htmlView when jsonProperties is empty', () => {
      const element = document.createElement('div');
      element.innerHTML = `
        <div class="exe-sortableList">
          <div class="exe-sortableList-instructions"><p>Order items</p></div>
          <ul class="exe-sortableList-list">
            <li>One</li>
            <li><strong>Two</strong></li>
            <li>Three</li>
          </ul>
          <p class="exe-sortableList-buttonText">Check legacy</p>
          <p class="exe-sortableList-rightText"><em>Right</em></p>
          <p class="exe-sortableList-wrongText">Wrong</p>
        </div>`;

      const data = $exeDevice.normalizePreviousData({}, element);

      expect(data.options).toEqual(['One', '<strong>Two</strong>', 'Three']);
      expect(data.instructions).toBe('<p>Order items</p>');
      expect(data.buttonText).toBe('Check legacy');
      expect(data.rightText).toBe('Right');
      expect(data.wrongText).toBe('Wrong');
    });
  });

  describe('loadPreviousValues', () => {
    const buildEditorBody = () => {
      const fields = Array.from({ length: $exeDevice.items_no }, (_, index) => {
        return `<input id="sortableListFormList${index}" />`;
      }).join('');
      document.body.innerHTML = `
        <div id="editor">
          <div id="sortableListFormList">${fields}</div>
          <input id="sortableListButtonText" />
          <input id="sortableListRightText" />
          <input id="sortableListWrongText" />
          <input id="eXeGameInstructions" />
          <input id="eXeIdeviceTextAfter" />
          <input id="sortableShowSolutions" type="checkbox" />
          <input id="sortableAttemptsNumber" />
        </div>`;
      return document.getElementById('editor');
    };

    it('loads legacy option objects into the list inputs', () => {
      const previousEdition = global.$exeDevicesEdition;
      global.$exeDevicesEdition = {
        iDevice: {
          gamification: {
            progressBar: { setValues: vi.fn() },
            passScore: {
              setValues: vi.fn(),
              getValues: vi.fn(() => ({ passScoreMode: 'global', passScoreCustom: 5 })),
            },
            scorm: { setValues: vi.fn() },
            common: { setLanguageTabValues: vi.fn() },
          },
        },
      };
      $exeDevice.ideviceBody = buildEditorBody();
      $exeDevice.idevicePreviousData = {
        options: [{ text: 'One' }, { html: '<strong>Two</strong>' }, ['Three']],
        buttonText: 'Check',
        rightText: 'Right',
        wrongText: 'Wrong',
        instructions: 'Order',
      };

      try {
        $exeDevice.loadPreviousValues();

        expect(document.getElementById('sortableListFormList0').value).toBe('One');
        expect(document.getElementById('sortableListFormList1').value).toBe('<strong>Two</strong>');
        expect(document.getElementById('sortableListFormList2').value).toBe('Three');
      } finally {
        global.$exeDevicesEdition = previousEdition;
      }
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
            source = readFileSync(join(__dirname, 'scrambled-list.js'), 'utf-8');
        });

        it('renders the control immediately above the progress report', () => {
            const passScoreAt = source.indexOf('gamification.passScore.getContents()');
            const progressBarAt = source.indexOf('gamification.progressBar.getContents(');

            expect(passScoreAt).toBeGreaterThan(-1);
            expect(progressBarAt).toBeGreaterThan(-1);
            expect(passScoreAt).toBeLessThan(progressBarAt);
        });

        it('restores the control when the iDevice is reopened', () => {
            expect(source).toContain('gamification.passScore.setValues(');
            // This iDevice restores from `data`, not `game`.
            expect(source).toContain('passScoreMode: data.passScoreMode');
            expect(source).toContain('passScoreCustom: data.passScoreCustom');
        });

        it('saves the mode and the customised mark, and nothing else', () => {
            expect(source).toContain('gamification.passScore.getValues()');
            // It parks the values on the instance before writing them out.
            expect(source).toContain('this.passScoreMode = passScore.passScoreMode');
            expect(source).toContain('this.passScoreCustom = passScore.passScoreCustom');
            expect(source).toContain('passScoreMode: this.passScoreMode');
            expect(source).toContain('passScoreCustom: this.passScoreCustom');
            // The project value is never copied into the iDevice: it is read
            // live, so an iDevice on the global mode follows the project.
            expect(source).not.toContain('passScoreGlobal');
        });

        it('wires the radio and input handlers', () => {
            expect(source).toContain('gamification.passScore.addEvents()');
        });
    });
});
