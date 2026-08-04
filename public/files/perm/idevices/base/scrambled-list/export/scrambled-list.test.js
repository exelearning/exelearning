/**
 * Unit tests for scrambled-list iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - randomizeArray: Shuffles array ensuring at least one change
 * - removeTags: Removes HTML tags from string
 * - setupTouchDrag / removeTouchDrag: Native touch drag-and-drop support
 */

/* eslint-disable no-undef */
// Import setup for DOM mocks (happy-dom), jQuery, and global mocks
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $scrambledlist globally.
 * Note: This file doesn't have auto-init call.
 */
function loadExportIdevice(code) {
  const modifiedCode = code.replace(/var\s+\$scrambledlist\s*=/, 'global.$scrambledlist =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$scrambledlist;
}

describe('scrambled-list iDevice export', () => {
  let $scrambledlist;

  beforeEach(() => {
    global.$scrambledlist = undefined;

    const filePath = join(__dirname, 'scrambled-list.js');
    const code = readFileSync(filePath, 'utf-8');

    $scrambledlist = loadExportIdevice(code);
  });

  describe('updateConfig', () => {
    beforeEach(() => {
      eXe.app.isInExe = vi.fn(() => false);
      eXe.app.getIdeviceInstalledExportPath = vi.fn(() => '/idevices/scrambled-list/');
      document.body.innerHTML = '';
    });

    it('does not throw when there is no saved data at all', () => {
      expect(() => $scrambledlist.updateConfig(undefined, 'sl-1')).not.toThrow();
    });

    it('does not throw when the saved data is empty', () => {
      expect(() => $scrambledlist.updateConfig({}, 'sl-1')).not.toThrow();
    });
  });

  describe('randomizeArray', () => {
    it('returns array of same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = $scrambledlist.randomizeArray([...arr]);
      expect(result).toHaveLength(arr.length);
    });

    it('contains all original elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = $scrambledlist.randomizeArray([...arr]);
      expect(result.sort()).toEqual(arr.sort());
    });

    it('ensures at least one element changes position', () => {
      const arr = [1, 2, 3, 4, 5];
      const original = [...arr];
      const result = $scrambledlist.randomizeArray(arr);

      let hasChanged = false;
      for (let i = 0; i < result.length; i++) {
        if (result[i] !== original[i]) {
          hasChanged = true;
          break;
        }
      }
      expect(hasChanged).toBe(true);
    });

    it('handles array with two elements', () => {
      const arr = [1, 2];
      const result = $scrambledlist.randomizeArray([...arr]);
      expect(result).toHaveLength(2);
      expect(result.sort()).toEqual([1, 2]);
    });
  });

  describe('removeTags', () => {
    it('removes HTML tags', () => {
      expect($scrambledlist.removeTags('<p>Hello</p>')).toBe('Hello');
    });

    it('handles nested tags', () => {
      expect($scrambledlist.removeTags('<div><span>Test</span></div>')).toBe('Test');
    });

    it('handles empty string', () => {
      expect($scrambledlist.removeTags('')).toBe('');
    });

    it('handles plain text', () => {
      expect($scrambledlist.removeTags('Plain text')).toBe('Plain text');
    });

    it('handles multiple elements', () => {
      expect($scrambledlist.removeTags('<p>Hello</p><p>World</p>')).toBe('HelloWorld');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($scrambledlist.borderColors).toBeDefined();
      expect($scrambledlist.borderColors.black).toBe('#1c1b1b');
      expect($scrambledlist.borderColors.blue).toBe('#5877c6');
      expect($scrambledlist.borderColors.green).toBe('#66FF66');
      expect($scrambledlist.borderColors.red).toBe('#FF6666');
      expect($scrambledlist.borderColors.white).toBe('#f9f9f9');
      expect($scrambledlist.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('getMessages', () => {
    it('returns object with message strings', () => {
      const msgs = $scrambledlist.getMessages();
      expect(msgs).toBeDefined();
      expect(typeof msgs).toBe('object');
    });
  });

  describe('updateConfig', () => {
    it('targets the scrambled-list iDevice body for report icons', () => {
      const previousIsInExe = eXe.app.isInExe;
      eXe.app.isInExe = vi.fn(() => false);

      document.body.innerHTML = `
        <article>
          <header><h1 class="box-title">Scrambled list</h1></header>
          <div id="scrambled-1" class="idevice_node scrambled-list" data-idevice-path="/idevices/scrambled-list/"></div>
        </article>
      `;

      try {
        const result = $scrambledlist.updateConfig(
          {
            id: 'scrambled-1',
            attemptsNumber: 1,
            pendingAttempts: 1,
            msgs: $scrambledlist.getMessages(),
          },
          'scrambled-1',
        );

        expect(result.idevice).toBe('scrambled-listIdevice');
        expect(result.main).toBe('slscrambled-1');
      } finally {
        eXe.app.isInExe = previousIsInExe;
      }
    });

    it('normalizes legacy option objects before rendering', () => {
      const previousIsInExe = eXe.app.isInExe;
      eXe.app.isInExe = vi.fn(() => false);
      document.body.innerHTML = `
        <article>
          <header><h1 class="box-title">Scrambled list</h1></header>
          <div id="scrambled-1" class="idevice_node scrambled-list" data-idevice-path="/idevices/scrambled-list/"></div>
        </article>
      `;

      try {
        const result = $scrambledlist.updateConfig(
          {
            id: 'scrambled-1',
            options: [{ text: 'One' }, { value: '<strong>Two</strong>' }, ['Three']],
            msgs: $scrambledlist.getMessages(),
          },
          'scrambled-1',
        );

        expect(result.options).toEqual(['One', '<strong>Two</strong>', 'Three']);
      } finally {
        eXe.app.isInExe = previousIsInExe;
      }
    });
  });

  describe('setupTouchDrag', () => {
    it('exists as a function', () => {
      expect(typeof $scrambledlist.setupTouchDrag).toBe('function');
    });

    it('registers three touch listeners on the sortable list', () => {
      const listOrder = 0;
      const ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      document.body.appendChild(ul);
      const spy = vi.spyOn(ul, 'addEventListener');

      $scrambledlist.setupTouchDrag(listOrder);

      expect(spy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
      expect(spy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
      expect(spy).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });

      document.body.removeChild(ul);
      $scrambledlist.removeTouchDrag(listOrder);
    });

    it('stores handlers in _touchHandlers keyed by listOrder', () => {
      const listOrder = 1;
      const ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      document.body.appendChild(ul);

      $scrambledlist.setupTouchDrag(listOrder);

      expect($scrambledlist._touchHandlers[listOrder]).toBeDefined();
      expect(typeof $scrambledlist._touchHandlers[listOrder].touchstart).toBe('function');
      expect(typeof $scrambledlist._touchHandlers[listOrder].touchmove).toBe('function');
      expect(typeof $scrambledlist._touchHandlers[listOrder].touchend).toBe('function');
      expect($scrambledlist._touchHandlers[listOrder].ul).toBe(ul);

      document.body.removeChild(ul);
      $scrambledlist.removeTouchDrag(listOrder);
    });

    it('does nothing when the UL element does not exist', () => {
      expect(() => $scrambledlist.setupTouchDrag(999)).not.toThrow();
      expect($scrambledlist._touchHandlers[999]).toBeUndefined();
    });

    it('removes previous listeners before registering new ones (idempotent)', () => {
      const listOrder = 2;
      const ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      document.body.appendChild(ul);
      const removeSpy = vi.spyOn(ul, 'removeEventListener');

      $scrambledlist.setupTouchDrag(listOrder);
      $scrambledlist.setupTouchDrag(listOrder); // second call should remove first

      expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

      document.body.removeChild(ul);
      $scrambledlist.removeTouchDrag(listOrder);
    });
  });

  describe('removeTouchDrag', () => {
    it('exists as a function', () => {
      expect(typeof $scrambledlist.removeTouchDrag).toBe('function');
    });

    it('removes the three touch listeners', () => {
      const listOrder = 3;
      const ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      document.body.appendChild(ul);

      $scrambledlist.setupTouchDrag(listOrder);
      const removeSpy = vi.spyOn(ul, 'removeEventListener');

      $scrambledlist.removeTouchDrag(listOrder);

      expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

      document.body.removeChild(ul);
    });

    it('deletes the entry from _touchHandlers', () => {
      const listOrder = 4;
      const ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      document.body.appendChild(ul);

      $scrambledlist.setupTouchDrag(listOrder);
      expect($scrambledlist._touchHandlers[listOrder]).toBeDefined();

      $scrambledlist.removeTouchDrag(listOrder);
      expect($scrambledlist._touchHandlers[listOrder]).toBeUndefined();

      document.body.removeChild(ul);
    });

    it('does not throw when called without a prior setupTouchDrag', () => {
      expect(() => $scrambledlist.removeTouchDrag(888)).not.toThrow();
    });
  });

  describe('touch drag handler behaviors', () => {
    let listOrder, ul, li1, li2;

    beforeEach(() => {
      listOrder = 5;
      ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      li1 = document.createElement('li');
      li1.textContent = 'Item A';
      li2 = document.createElement('li');
      li2.textContent = 'Item B';
      ul.appendChild(li1);
      ul.appendChild(li2);
      document.body.appendChild(ul);

      $scrambledlist.setupTouchDrag(listOrder);
    });

    afterEach(() => {
      $scrambledlist.removeTouchDrag(listOrder);
      if (ul.parentNode) document.body.removeChild(ul);
    });

    it('touchstart ignores touch on non-li elements', () => {
      // Firing touchstart on the UL itself (not an li child) should not throw
      const touchStartHandler = $scrambledlist._touchHandlers[listOrder].touchstart;
      const fakeTouch = { clientX: 0, clientY: 0 };
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body);

      expect(() => touchStartHandler({ touches: [fakeTouch], preventDefault: vi.fn() })).not.toThrow();
    });

    it('touchmove does nothing when no item is being dragged', () => {
      const touchMoveHandler = $scrambledlist._touchHandlers[listOrder].touchmove;
      const preventDefaultMock = vi.fn();

      // Without a prior touchstart that set touchedItem, touchmove should return early
      expect(() => touchMoveHandler({ touches: [{ clientX: 10, clientY: 10 }], preventDefault: preventDefaultMock })).not.toThrow();
      // preventDefault should NOT be called since no item is being dragged
      expect(preventDefaultMock).not.toHaveBeenCalled();
    });

    it('touchend does nothing when no item is being dragged', () => {
      const touchEndHandler = $scrambledlist._touchHandlers[listOrder].touchend;
      expect(() => touchEndHandler({ changedTouches: [{ clientX: 10, clientY: 10 }] })).not.toThrow();
    });
  });

  describe('getOriginalIndexValue / getOriginalIndexNumber (legacy fallback)', () => {
    const el = (attr) => ({ getAttribute: () => attr });

    it('returns the data-orig-index attribute when present', () => {
      expect($scrambledlist.getOriginalIndexValue(el('2'), 5)).toBe('2');
      expect($scrambledlist.getOriginalIndexNumber(el('4'), 9)).toBe(4);
    });

    it('falls back to the position when the attribute is missing (eXe 2.9 imports)', () => {
      // Legacy <li> carry no data-orig-index, so the position is the canonical index.
      expect($scrambledlist.getOriginalIndexValue(el(null), 5)).toBe('5');
      expect($scrambledlist.getOriginalIndexValue(el(''), 3)).toBe('3');
      expect($scrambledlist.getOriginalIndexNumber(el(null), 9)).toBe(9);
      expect($scrambledlist.getOriginalIndexNumber(el('abc'), 7)).toBe(7);
    });
  });

  describe('normalizeOptions', () => {
    it('keeps string options and drops empties', () => {
      expect($scrambledlist.normalizeOptions(['a', '', '  ', 'b'])).toEqual(['a', 'b']);
    });

    it('extracts text from object-shaped options and tolerates non-arrays', () => {
      expect($scrambledlist.normalizeOptions([{ text: 'x' }, { html: 'y' }, 3])).toEqual(['x', 'y', '3']);
      expect($scrambledlist.normalizeOptions(undefined)).toEqual([]);
      expect($scrambledlist.normalizeOptions(null)).toEqual([]);
    });
  });

  describe('countRightAnswers', () => {
    it('counts every item that sits in its correct position', () => {
      expect($scrambledlist.countRightAnswers([0, 1, 2])).toBe(3);
    });

    it('counts only the items left in place after a swap', () => {
      // index 2 stays correct; 0 and 1 are swapped
      expect($scrambledlist.countRightAnswers([1, 0, 2])).toBe(1);
    });

    it('returns 0 when nothing is in place', () => {
      expect($scrambledlist.countRightAnswers([2, 0, 1])).toBe(0);
    });

    it('handles an empty list', () => {
      expect($scrambledlist.countRightAnswers([])).toBe(0);
    });
  });

  describe('escapeHtmlButKeepRenderedMath', () => {
    const mathSpan =
      '<span class="exe-math-rendered" data-latex="\\(x\\)"><svg></svg><math></math></span>';

    it('escapes plain HTML', () => {
      expect($scrambledlist.escapeHtmlButKeepRenderedMath('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
    });

    it('keeps a valid pre-rendered math span verbatim', () => {
      const out = $scrambledlist.escapeHtmlButKeepRenderedMath('Pick ' + mathSpan);
      expect(out).toContain(mathSpan);
      expect(out.startsWith('Pick ')).toBe(true);
    });

    it('neutralises a forged math span carrying script (XSS boundary)', () => {
      const forged = '<span class="exe-math-rendered" data-latex=""><svg onload="alert(1)"></svg></span>';
      const out = $scrambledlist.escapeHtmlButKeepRenderedMath('Pick ' + forged);
      expect(out).not.toContain('<svg onload');
    });

    it('handles null/undefined', () => {
      expect($scrambledlist.escapeHtmlButKeepRenderedMath(null)).toBe('');
      expect($scrambledlist.escapeHtmlButKeepRenderedMath(undefined)).toBe('');
    });
  });

  describe('getListLinks (math-safe controls)', () => {
    const mathSpan =
      '<span class="exe-math-rendered" data-latex="\\(x\\)"><svg></svg><math></math></span>';

    it('adds sorter controls without removing pre-rendered math spans', () => {
      const listOrder = 10;
      document.body.innerHTML =
        `<ul id="exe-sortableList-${listOrder}">` +
        `<li data-orig-index="0">A ${mathSpan}</li>` +
        `<li data-orig-index="1">B</li>` +
        `</ul>`;

      $scrambledlist.getListLinks(listOrder);
      const ul = document.getElementById('exe-sortableList-' + listOrder);

      // Math span preserved, one sorter-control wrapper added per item.
      expect(ul.querySelectorAll('span.exe-math-rendered').length).toBe(1);
      expect(ul.querySelectorAll('span.exe-sortableList-controls').length).toBe(2);

      // Re-running (as on every sortupdate) must not duplicate or destroy math.
      $scrambledlist.getListLinks(listOrder);
      expect(ul.querySelectorAll('span.exe-math-rendered').length).toBe(1);
      expect(ul.querySelectorAll('span.exe-sortableList-controls').length).toBe(2);
    });
  });

  describe('enableList legacy htmlView support', () => {
    it('adds fallback original indexes to legacy list items without data attributes', () => {
      document.body.innerHTML = `
        <div class="exe-sortableList">
          <ul class="exe-sortableList-list">
            <li>One</li>
            <li>Two</li>
            <li>Three</li>
          </ul>
          <p class="exe-sortableList-buttonText">Check</p>
        </div>`;
      const activity = document.querySelector('.exe-sortableList');
      const randomize = vi
        .spyOn($scrambledlist, 'randomizeArray')
        .mockImplementation((items) => [items[1], items[0], items[2]]);

      try {
        $scrambledlist.enableList(activity, 12);

        const originalItems = document.querySelectorAll('#exe-sortableListResults-12 li');
        const playableItems = document.querySelectorAll('#exe-sortableList-12 li');
        expect(Array.from(originalItems).map((item) => item.getAttribute('data-orig-index'))).toEqual([
          '0',
          '1',
          '2',
        ]);
        expect(Array.from(playableItems).map((item) => item.getAttribute('data-orig-index'))).toEqual([
          '1',
          '0',
          '2',
        ]);
      } finally {
        randomize.mockRestore();
      }
    });
  });

  describe('renderView', () => {
    const template =
      '<div id="sl{idList}">{instructions}<ul class="exe-sortableList-list">{optionsText}</ul>' +
      '<p class="exe-sortableList-buttonText">{buttonText}</p>' +
      '<p class="exe-sortableList-rightText">{rightText}</p>' +
      '<p class="exe-sortableList-wrongText">{wrongText}</p>' +
      '{scormMessage}{afterElement}{evaluationID}{ideviceID}{evaluation}{scorm}</div>';

    it('emits data-orig-index per option and keeps rendered math in options and feedback', () => {
      const previousIsInExe = eXe.app.isInExe;
      eXe.app.isInExe = vi.fn(() => false);
      document.body.innerHTML = `
        <article><header><h1 class="box-title">SL</h1></header>
          <div id="sl-1" class="idevice_node scrambled-list" data-idevice-path="/idevices/scrambled-list/"></div>
        </article>`;
      const mathSpan =
        '<span class="exe-math-rendered" data-latex="\\(x\\)"><svg></svg><math></math></span>';

      try {
        const html = $scrambledlist.renderView(
          {
            id: 'sl-1',
            options: ['<p>' + mathSpan + '</p>', 'plain'],
            rightText: 'Great ' + mathSpan,
            wrongText: 'Nope',
            buttonText: 'Check',
            instructions: 'Order them',
            msgs: $scrambledlist.getMessages(),
          },
          0,
          template,
          'sl-1',
        );

        // Each option carries its correct-position index.
        expect(html).toContain('data-orig-index="0"');
        expect(html).toContain('data-orig-index="1"');
        // Rendered math survives in the option AND the feedback text.
        expect((html.match(/exe-math-rendered/g) || []).length).toBeGreaterThanOrEqual(2);
      } finally {
        eXe.app.isInExe = previousIsInExe;
      }
    });
  });
});
