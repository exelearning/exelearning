/**
 * Unit tests for dragdrop iDevice (export/runtime)
 *
 * Tests pure functions and native touch drag-and-drop support:
 * - setupTouchDragAndDrop / removeTouchDragAndDrop
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
 * Helper to load export iDevice file and expose $eXeDragDrop globally.
 * Replaces var declaration with global assignment and strips the auto-init call.
 */
function loadExportIdevice(code) {
  // $exeDevices.iDevice.gamification.colors is accessed at load time
  global.$exeDevices.iDevice.gamification.colors = {
    borderColors: { black: '#000', white: '#fff' },
    backColor: { black: '#000', white: '#fff' },
  };
  const modifiedCode = code
    .replace(/var\s+\$eXeDragDrop\s*=/, 'global.$eXeDragDrop =')
    .replace(/\$\(function\s*\(\)\s*\{[\s\S]*?\}\);?\s*$/, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeDragDrop;
}

describe('dragdrop iDevice export', () => {
  let $eXeDragDrop;

  beforeEach(() => {
    global.$eXeDragDrop = undefined;

    const filePath = join(__dirname, 'dragdrop.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeDragDrop = loadExportIdevice(code);
  });

  describe('startGame', () => {
    it('initializes drag and drop immediately on first start', () => {
      const instance = 6;
      $eXeDragDrop.options[instance] = {
        gameStarted: false,
        gameOver: false,
        type: 0,
        time: 0,
      };

      const initSpy = vi
        .spyOn($eXeDragDrop, 'initializeDragAndDrop')
        .mockImplementation(() => {});

      $eXeDragDrop.startGame(instance);

      expect(initSpy).toHaveBeenCalledWith(instance);
      expect($eXeDragDrop.options[instance].gameStarted).toBe(true);
    });
  });

  describe('setupTouchDragAndDrop', () => {
    it('exists as a function', () => {
      expect(typeof $eXeDragDrop.setupTouchDragAndDrop).toBe('function');
    });

    it('registers three touch listeners on the game container', () => {
      const instance = 0;
      $eXeDragDrop.options[instance] = { gameStarted: true, gameOver: false };

      const container = document.createElement('div');
      container.id = `dadPGameContainer-${instance}`;
      document.body.appendChild(container);
      const spy = vi.spyOn(container, 'addEventListener');

      $eXeDragDrop.setupTouchDragAndDrop(instance);

      expect(spy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
      expect(spy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
      expect(spy).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });

      document.body.removeChild(container);
      $eXeDragDrop.removeTouchDragAndDrop(instance);
    });

    it('stores handlers in mOptions', () => {
      const instance = 1;
      $eXeDragDrop.options[instance] = { gameStarted: true, gameOver: false };

      const container = document.createElement('div');
      container.id = `dadPGameContainer-${instance}`;
      document.body.appendChild(container);

      $eXeDragDrop.setupTouchDragAndDrop(instance);

      const mOptions = $eXeDragDrop.options[instance];
      expect(typeof mOptions._touchDragStart).toBe('function');
      expect(typeof mOptions._touchDragMove).toBe('function');
      expect(typeof mOptions._touchDragEnd).toBe('function');
      expect(mOptions._touchDragContainer).toBe(container);

      document.body.removeChild(container);
      $eXeDragDrop.removeTouchDragAndDrop(instance);
    });

    it('does nothing when the game container does not exist', () => {
      $eXeDragDrop.options[999] = { gameStarted: true, gameOver: false };
      expect(() => $eXeDragDrop.setupTouchDragAndDrop(999)).not.toThrow();
      expect($eXeDragDrop.options[999]._touchDragContainer).toBeUndefined();
    });

    it('removes previous listeners before registering new ones (idempotent)', () => {
      const instance = 2;
      $eXeDragDrop.options[instance] = { gameStarted: true, gameOver: false };

      const container = document.createElement('div');
      container.id = `dadPGameContainer-${instance}`;
      document.body.appendChild(container);
      const removeSpy = vi.spyOn(container, 'removeEventListener');

      $eXeDragDrop.setupTouchDragAndDrop(instance);
      $eXeDragDrop.setupTouchDragAndDrop(instance); // second call should remove first

      expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

      document.body.removeChild(container);
      $eXeDragDrop.removeTouchDragAndDrop(instance);
    });
  });

  describe('removeTouchDragAndDrop', () => {
    it('exists as a function', () => {
      expect(typeof $eXeDragDrop.removeTouchDragAndDrop).toBe('function');
    });

    it('removes the three touch listeners', () => {
      const instance = 3;
      $eXeDragDrop.options[instance] = { gameStarted: true, gameOver: false };

      const container = document.createElement('div');
      container.id = `dadPGameContainer-${instance}`;
      document.body.appendChild(container);

      $eXeDragDrop.setupTouchDragAndDrop(instance);
      const removeSpy = vi.spyOn(container, 'removeEventListener');

      $eXeDragDrop.removeTouchDragAndDrop(instance);

      expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

      document.body.removeChild(container);
    });

    it('clears handler references in mOptions', () => {
      const instance = 4;
      $eXeDragDrop.options[instance] = { gameStarted: true, gameOver: false };

      const container = document.createElement('div');
      container.id = `dadPGameContainer-${instance}`;
      document.body.appendChild(container);

      $eXeDragDrop.setupTouchDragAndDrop(instance);
      $eXeDragDrop.removeTouchDragAndDrop(instance);

      const mOptions = $eXeDragDrop.options[instance];
      expect(mOptions._touchDragStart).toBeNull();
      expect(mOptions._touchDragMove).toBeNull();
      expect(mOptions._touchDragEnd).toBeNull();
      expect(mOptions._touchDragContainer).toBeNull();

      document.body.removeChild(container);
    });

    it('does not throw when called without a prior setupTouchDragAndDrop', () => {
      $eXeDragDrop.options[888] = { gameStarted: true, gameOver: false };
      expect(() => $eXeDragDrop.removeTouchDragAndDrop(888)).not.toThrow();
    });

    it('does not throw when mOptions does not exist', () => {
      expect(() => $eXeDragDrop.removeTouchDragAndDrop(777)).not.toThrow();
    });
  });

  describe('touch drag handler behaviors', () => {
    let instance, container;

    beforeEach(() => {
      instance = 5;
      $eXeDragDrop.options[instance] = { gameStarted: true, gameOver: false };
      container = document.createElement('div');
      container.id = `dadPGameContainer-${instance}`;
      document.body.appendChild(container);
      $eXeDragDrop.setupTouchDragAndDrop(instance);
    });

    afterEach(() => {
      $eXeDragDrop.removeTouchDragAndDrop(instance);
      if (container.parentNode) document.body.removeChild(container);
    });

    it('touchstart ignores touch on non-DADP-DS elements', () => {
      const touchStartHandler = $eXeDragDrop.options[instance]._touchDragStart;
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body);
      const preventDefault = vi.fn();

      expect(() => touchStartHandler({ touches: [{ clientX: 0, clientY: 0 }], preventDefault })).not.toThrow();
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('touchstart does nothing when game not started', () => {
      $eXeDragDrop.options[instance].gameStarted = false;
      const touchStartHandler = $eXeDragDrop.options[instance]._touchDragStart;
      const preventDefault = vi.fn();

      expect(() => touchStartHandler({ touches: [{ clientX: 0, clientY: 0 }], preventDefault })).not.toThrow();
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('touchstart does nothing when game is over', () => {
      $eXeDragDrop.options[instance].gameOver = true;
      const touchStartHandler = $eXeDragDrop.options[instance]._touchDragStart;
      const preventDefault = vi.fn();

      expect(() => touchStartHandler({ touches: [{ clientX: 0, clientY: 0 }], preventDefault })).not.toThrow();
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('touchmove does nothing when no item is being dragged', () => {
      const touchMoveHandler = $eXeDragDrop.options[instance]._touchDragMove;
      const preventDefault = vi.fn();

      // Without a prior touchstart that set touchedEl, touchmove should return early
      expect(() => touchMoveHandler({ touches: [{ clientX: 10, clientY: 10 }], preventDefault })).not.toThrow();
      // preventDefault should NOT be called since no item is being dragged
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('touchend does nothing when no item is being dragged', () => {
      const touchEndHandler = $eXeDragDrop.options[instance]._touchDragEnd;
      expect(() => touchEndHandler({ changedTouches: [{ clientX: 10, clientY: 10 }] })).not.toThrow();
    });
  });
});
