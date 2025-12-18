/**
 * Unit tests for challenge iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - escapeHtml: HTML character escaping
 * - getChallengeDefault: Default challenge object structure
 * - getId: Unique ID generation
 */

/* eslint-disable no-undef */
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

    it('returns different IDs on consecutive calls', () => {
      const id1 = $exeDevice.getId();
      const id2 = $exeDevice.getId();
      // Due to time-based + random component, should be different (unless called in same millisecond)
      expect(id1).not.toBe(id2);
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

  // ============================================
  // DOM Manipulation Tests
  // ============================================

  describe('clearChallenge - DOM', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <input id="desafioECTitle" value="existing title" />
        <input id="desafioECSolution" value="existing solution" />
        <input id="desafioECMessage" value="existing message" />
        <input id="desafioECTime" value="10" />
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

    it('clears message field', () => {
      $exeDevice.clearChallenge();
      expect($('#desafioECMessage').val()).toBe('');
    });

    it('sets default time value to 5', () => {
      $exeDevice.clearChallenge();
      expect($('#desafioECTime').val()).toBe('5');
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
        <input id="desafioECMessage" value="" />
        <input id="desafioECTime" value="5" />
      `;
      $exeDevice.challengesGame = [{ title: 'Test', solution: 'sol', description: '' }];
      $exeDevice.active = 0;
      $exeDevice.numberId = 0;
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
        <div id="desafioSelects"></div>
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
        <div id="desafioSelects" style="display: block"></div>
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
});
