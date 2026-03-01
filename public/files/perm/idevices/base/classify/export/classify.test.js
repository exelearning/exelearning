/**
 * Unit tests for classify iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - hexToRgba: Hex to RGBA color conversion with alpha parameter
 * - loadGame: DataGame skip behavior when already initialized
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
 * Helper to load export iDevice file and expose $eXeClasifica globally.
 * Replaces 'var $eXeClasifica' with 'global.$eXeClasifica' to make it accessible.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeClasifica\s*=/, 'global.$eXeClasifica =');
  // Remove auto-init call: $(function () { $eXeClasifica.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeClasifica\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeClasifica;
}

describe('classify iDevice export', () => {
  let $eXeClasifica;

  beforeEach(() => {
    global.$eXeClasifica = undefined;

    const filePath = join(__dirname, 'classify.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeClasifica = loadExportIdevice(code);
  });

  describe('hexToRgba', () => {
    it('converts 6-digit hex to rgba with default alpha 1', () => {
      expect($eXeClasifica.hexToRgba('#ffffff')).toBe('rgba(255, 255, 255, 1)');
    });

    it('converts 6-digit hex to rgba with custom alpha', () => {
      expect($eXeClasifica.hexToRgba('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    });

    it('converts 3-digit hex to rgba', () => {
      expect($eXeClasifica.hexToRgba('#fff')).toBe('rgba(255, 255, 255, 1)');
    });

    it('converts 3-digit hex to rgba with custom alpha', () => {
      expect($eXeClasifica.hexToRgba('#fff', 0.7)).toBe('rgba(255, 255, 255, 0.7)');
    });

    it('converts black hex to rgba', () => {
      expect($eXeClasifica.hexToRgba('#000000')).toBe('rgba(0, 0, 0, 1)');
    });

    it('converts color hex to rgba', () => {
      expect($eXeClasifica.hexToRgba('#ff0000')).toBe('rgba(255, 0, 0, 1)');
      expect($eXeClasifica.hexToRgba('#00ff00')).toBe('rgba(0, 255, 0, 1)');
      expect($eXeClasifica.hexToRgba('#0000ff')).toBe('rgba(0, 0, 255, 1)');
    });

    it('handles hex without hash prefix', () => {
      expect($eXeClasifica.hexToRgba('ffffff')).toBe('rgba(255, 255, 255, 1)');
    });

    it('handles 3-digit hex without hash', () => {
      expect($eXeClasifica.hexToRgba('fff')).toBe('rgba(255, 255, 255, 1)');
    });

    it('returns fallback for invalid hex', () => {
      expect($eXeClasifica.hexToRgba('gggggg')).toBe('rgba(255,255,255,1)');
      expect($eXeClasifica.hexToRgba('#zzzzzz')).toBe('rgba(255,255,255,1)');
    });

    it('returns fallback for empty string', () => {
      expect($eXeClasifica.hexToRgba('')).toBe('rgba(255,255,255,1)');
    });

    it('returns fallback for non-string input', () => {
      expect($eXeClasifica.hexToRgba(null)).toBe('rgba(255,255,255,1)');
      expect($eXeClasifica.hexToRgba(undefined)).toBe('rgba(255,255,255,1)');
    });

    it('handles rgba input passthrough', () => {
      expect($eXeClasifica.hexToRgba('rgba(100, 150, 200, 0.8)')).toBe('rgba(100, 150, 200, 0.8)');
    });

    it('handles rgb input with alpha injection', () => {
      expect($eXeClasifica.hexToRgba('rgb(100, 150, 200)', 0.5)).toBe('rgba(100, 150, 200, 0.5)');
    });

    it('clamps alpha to valid range', () => {
      expect($eXeClasifica.hexToRgba('#ffffff', 2)).toBe('rgba(255, 255, 255, 1)');
      expect($eXeClasifica.hexToRgba('#ffffff', -1)).toBe('rgba(255, 255, 255, 0)');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeClasifica.borderColors).toBeDefined();
      expect($eXeClasifica.borderColors.black).toBe('#1c1b1b');
      expect($eXeClasifica.borderColors.white).toBe('#ffffff');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($eXeClasifica.colors).toBeDefined();
      expect($eXeClasifica.colors.black).toBe('#1c1b1b');
      expect($eXeClasifica.colors.white).toBe('#ffffff');
    });
  });

  describe('init', () => {
    it('exists as a function', () => {
      expect(typeof $eXeClasifica.init).toBe('function');
    });
  });

  describe('enable', () => {
    it('exists as a function', () => {
      expect(typeof $eXeClasifica.enable).toBe('function');
    });
  });

  describe('options', () => {
    it('is initialized as an empty array', () => {
      expect($eXeClasifica.options).toEqual([]);
    });
  });

  describe('setupTouchDragAndDrop', () => {
    it('exists as a function', () => {
      expect(typeof $eXeClasifica.setupTouchDragAndDrop).toBe('function');
    });

    it('registers three touch listeners on the game container', () => {
      const instance = 0;
      $eXeClasifica.options[instance] = { gameStarted: false, gameOver: false };

      const container = document.createElement('div');
      container.id = `clasificaGameContainer-${instance}`;
      document.body.appendChild(container);
      const spy = vi.spyOn(container, 'addEventListener');

      $eXeClasifica.setupTouchDragAndDrop(instance);

      expect(spy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
      expect(spy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
      expect(spy).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });

      container.remove();
      delete $eXeClasifica.options[instance];
    });

    it('stores handler references in mOptions', () => {
      const instance = 0;
      $eXeClasifica.options[instance] = { gameStarted: false, gameOver: false };

      const container = document.createElement('div');
      container.id = `clasificaGameContainer-${instance}`;
      document.body.appendChild(container);

      $eXeClasifica.setupTouchDragAndDrop(instance);
      const mOptions = $eXeClasifica.options[instance];

      expect(typeof mOptions._touchStartHandler).toBe('function');
      expect(typeof mOptions._touchMoveHandler).toBe('function');
      expect(typeof mOptions._touchEndHandler).toBe('function');

      container.remove();
      delete $eXeClasifica.options[instance];
    });

    it('does nothing when game container does not exist', () => {
      const instance = 99;
      $eXeClasifica.options[instance] = { gameStarted: false, gameOver: false };

      expect(() => $eXeClasifica.setupTouchDragAndDrop(instance)).not.toThrow();

      delete $eXeClasifica.options[instance];
    });
  });

  describe('removeTouchDragAndDrop', () => {
    it('exists as a function', () => {
      expect(typeof $eXeClasifica.removeTouchDragAndDrop).toBe('function');
    });

    it('removes touch listeners and nulls handler references', () => {
      const instance = 0;
      $eXeClasifica.options[instance] = { gameStarted: false, gameOver: false };

      const container = document.createElement('div');
      container.id = `clasificaGameContainer-${instance}`;
      document.body.appendChild(container);

      $eXeClasifica.setupTouchDragAndDrop(instance);
      const removeSpy = vi.spyOn(container, 'removeEventListener');

      $eXeClasifica.removeTouchDragAndDrop(instance);
      const mOptions = $eXeClasifica.options[instance];

      expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
      expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
      expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });
      expect(mOptions._touchStartHandler).toBeNull();
      expect(mOptions._touchMoveHandler).toBeNull();
      expect(mOptions._touchEndHandler).toBeNull();

      container.remove();
      delete $eXeClasifica.options[instance];
    });

    it('does not throw when instance has no options', () => {
      expect(() => $eXeClasifica.removeTouchDragAndDrop(99)).not.toThrow();
    });
  });

  describe('touch drag handler behaviors', () => {
    let instance;
    let gameContainer;
    let cardEl;

    const makeTouch = (target, x = 50, y = 50) => ({
      touches: [{ clientX: x, clientY: y, target }],
      changedTouches: [{ clientX: x, clientY: y }],
      preventDefault: vi.fn(),
    });

    beforeEach(() => {
      instance = 0;
      $eXeClasifica.options[instance] = { gameStarted: true, gameOver: false };
      $eXeClasifica.moveCard = vi.fn();

      gameContainer = document.createElement('div');
      gameContainer.id = `clasificaGameContainer-${instance}`;

      cardEl = document.createElement('div');
      cardEl.className = `CQP-CardContainer CQP-Drag-${instance}`;
      gameContainer.appendChild(cardEl);

      document.body.appendChild(gameContainer);
      $eXeClasifica.setupTouchDragAndDrop(instance);
    });

    afterEach(() => {
      $eXeClasifica.removeTouchDragAndDrop(instance);
      gameContainer.remove();
      delete $eXeClasifica.options[instance];
    });

    it('touchstart ignores events when game is not started', () => {
      $eXeClasifica.options[instance].gameStarted = false;
      const handler = $eXeClasifica.options[instance]._touchStartHandler;
      const e = makeTouch(cardEl);

      // Mock elementFromPoint to return the card
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(cardEl);

      handler(e);

      expect(e.preventDefault).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('touchstart ignores events when game is over', () => {
      $eXeClasifica.options[instance].gameOver = true;
      const handler = $eXeClasifica.options[instance]._touchStartHandler;
      const e = makeTouch(cardEl);

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(cardEl);

      handler(e);

      expect(e.preventDefault).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('touchstart ignores locked cards (data-touch-locked)', () => {
      cardEl.setAttribute('data-touch-locked', 'true');
      const handler = $eXeClasifica.options[instance]._touchStartHandler;
      const e = makeTouch(cardEl);

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(cardEl);

      handler(e);

      expect(e.preventDefault).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('touchend calls moveCard when released over a valid container', () => {
      const startHandler = $eXeClasifica.options[instance]._touchStartHandler;
      const endHandler = $eXeClasifica.options[instance]._touchEndHandler;

      // Start drag
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(cardEl);
      const startEvent = makeTouch(cardEl);
      cardEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 80 });
      startHandler(startEvent);

      // Build a drop container and release over it
      const dropEl = document.createElement('div');
      dropEl.className = `CQP-CC-${instance}`;
      gameContainer.appendChild(dropEl);

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(dropEl);
      const endEvent = makeTouch(cardEl);
      endHandler(endEvent);

      expect($eXeClasifica.moveCard).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        instance
      );

      vi.restoreAllMocks();
    });

    it('touchend does not call moveCard when released outside any container', () => {
      const startHandler = $eXeClasifica.options[instance]._touchStartHandler;
      const endHandler = $eXeClasifica.options[instance]._touchEndHandler;

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(cardEl);
      const startEvent = makeTouch(cardEl);
      cardEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 80 });
      startHandler(startEvent);

      // Release over an element that is not a drop container
      const outsideEl = document.createElement('div');
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(outsideEl);
      const endEvent = makeTouch(cardEl);
      endHandler(endEvent);

      expect($eXeClasifica.moveCard).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe('loadGame DataGame skip behavior', () => {
    /**
     * Test that loadGame skips activities without DataGame element.
     * This is critical for preventing double initialization when scripts are reloaded.
     *
     * Bug scenario (before fix):
     * 1. Page has multiple Classify iDevices
     * 2. User saves one iDevice → resetCurrentIdevicesExportView is called
     * 3. Each iDevice's generateContentExportView() renders and calls init() → loadGame()
     * 4. loadGame() consumes DataGame (removes from DOM) and initializes the activity
     * 5. Scripts are cleared and reloaded from <head>
     * 6. Script auto-executes $(function(){ $eXeClasifica.init() })
     * 7. loadGame() is called again, but DataGame no longer exists
     * 8. Without the fix: tries to process activities → TypeError on undefined mOption.msgs
     * 9. With the fix: skips activities without DataGame → no error
     */

    let originalActivities;
    let processedCount;

    beforeEach(() => {
      // Reset processed count
      processedCount = 0;

      // Create mock activities jQuery object
      const mockActivities = [];

      // Activity 1: HAS DataGame (should be processed)
      const activity1 = document.createElement('div');
      activity1.className = 'clasifica-IDevice';
      activity1.innerHTML = '<div class="clasifica-DataGame">encrypted-data</div>';
      mockActivities.push(activity1);

      // Activity 2: NO DataGame (simulates already initialized, should be skipped)
      const activity2 = document.createElement('div');
      activity2.className = 'clasifica-IDevice';
      activity2.innerHTML = '<div class="clasifica-interface">Already rendered UI</div>';
      mockActivities.push(activity2);

      // Activity 3: HAS DataGame (should be processed)
      const activity3 = document.createElement('div');
      activity3.className = 'clasifica-IDevice';
      activity3.innerHTML = '<div class="clasifica-DataGame">more-encrypted-data</div>';
      mockActivities.push(activity3);

      // Store original activities and replace with mock
      originalActivities = $eXeClasifica.activities;

      // Create jQuery-like object with .each()
      $eXeClasifica.activities = {
        each: function (callback) {
          mockActivities.forEach((el, i) => {
            callback.call(el, i);
          });
        },
        length: mockActivities.length,
      };

      // Mock loadDataGame to track calls and return valid data
      $eXeClasifica.loadDataGame = vi.fn(() => {
        processedCount++;
        return {
          msgs: { msgPlayStart: 'Start' },
          wordsGame: [],
          cardsGame: [],
        };
      });

      // Mock createInterfaceClasifica to return a DOM element
      $eXeClasifica.createInterfaceClasifica = vi.fn(() => {
        return document.createElement('div');
      });

      // Mock addCards and addEvents
      $eXeClasifica.addCards = vi.fn();
      $eXeClasifica.addEvents = vi.fn();

      // Set idevicePath
      $eXeClasifica.idevicePath = '/test/path/';
    });

    afterEach(() => {
      // Restore original activities
      if (originalActivities !== undefined) {
        $eXeClasifica.activities = originalActivities;
      }
    });

    it('skips activities without DataGame element', () => {
      // Act
      $eXeClasifica.loadGame();

      // Assert: Only 2 activities should be processed (activity 1 and 3)
      // Activity 2 has no DataGame and should be skipped
      expect(processedCount).toBe(2);
      expect($eXeClasifica.loadDataGame).toHaveBeenCalledTimes(2);
    });

    it('does not throw when all activities lack DataGame (script reload scenario)', () => {
      // Simulate scenario where all DataGames have been consumed
      const emptyActivities = [];
      for (let i = 0; i < 3; i++) {
        const activity = document.createElement('div');
        activity.className = 'clasifica-IDevice';
        activity.innerHTML = '<div class="clasifica-interface">Already rendered</div>';
        emptyActivities.push(activity);
      }

      $eXeClasifica.activities = {
        each: function (callback) {
          emptyActivities.forEach((el, i) => {
            callback.call(el, i);
          });
        },
        length: emptyActivities.length,
      };

      // Act & Assert: Should not throw
      expect(() => {
        $eXeClasifica.loadGame();
      }).not.toThrow();

      // No activities should be processed
      expect(processedCount).toBe(0);
      expect($eXeClasifica.options).toEqual([]);
    });

    it('processes activity with DataGame correctly', () => {
      // Act
      $eXeClasifica.loadGame();

      // Assert: Options should have 2 entries (for the 2 activities with DataGame)
      expect($eXeClasifica.options.length).toBe(2);
      expect($eXeClasifica.options[0].idevice).toBe('clasifica-IDevice');
      expect($eXeClasifica.options[1].idevice).toBe('clasifica-IDevice');
    });
  });
});
