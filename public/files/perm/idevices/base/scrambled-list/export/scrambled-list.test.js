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
});
