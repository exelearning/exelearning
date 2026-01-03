/**
 * ImportProgress Bun Tests
 *
 * Unit tests for the ImportProgress UI component.
 *
 */

 

// Test functions available globally from vitest setup

// Use dynamic import for ES Module
let ImportProgress;

beforeAll(async () => {
  const module = await import('./importProgress.js');
  ImportProgress = module.default;
});

describe('ImportProgress', () => {
  let importProgress;
  let container;

  beforeEach(() => {
    // Setup DOM with menus
    document.body.innerHTML = `
      <div id="menu_nav"></div>
      <div id="menuidevices-menu"></div>
      <div id="listmenuidevices"></div>
      <div id="node-content-container">
        <div id="node-content">Existing content</div>
      </div>
    `;
    container = document.querySelector('#node-content-container');

    // Mock global _ function for translations
    global._ = (str) => str;

    importProgress = new ImportProgress();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete global._;
  });

  describe('constructor', () => {
    it('initializes with correct container selector', () => {
      expect(importProgress.containerSelector).toBe('#node-content-container');
    });

    it('initializes with null element', () => {
      expect(importProgress.element).toBeNull();
    });

    it('initializes with menu selectors array', () => {
      expect(importProgress.menuSelectors).toEqual([
        '#menu_nav',
        '#menuidevices-menu',
        '#listmenuidevices'
      ]);
    });
  });

  describe('show()', () => {
    it('creates overlay element in container', () => {
      importProgress.show();

      const overlay = document.querySelector('#import-progress-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay.parentElement).toBe(container);
    });

    it('adds import-progress-overlay class', () => {
      importProgress.show();

      const overlay = document.querySelector('#import-progress-overlay');
      expect(overlay.classList.contains('import-progress-overlay')).toBe(true);
    });

    it('creates progress bar at 0%', () => {
      importProgress.show();

      const bar = document.querySelector('.import-progress-bar');
      expect(bar).not.toBeNull();
      expect(bar.style.width).toBe('0%');
    });

    it('creates percentage text showing 0%', () => {
      importProgress.show();

      const percent = document.querySelector('.import-progress-percent');
      expect(percent).not.toBeNull();
      expect(percent.textContent).toBe('0%');
    });

    it('creates message element', () => {
      importProgress.show();

      const message = document.querySelector('.import-progress-message');
      expect(message).not.toBeNull();
    });

    it('creates spinner element', () => {
      importProgress.show();

      const spinner = document.querySelector('.import-progress-spinner');
      expect(spinner).not.toBeNull();
    });

    it('sets container position to relative', () => {
      importProgress.show();

      expect(container.style.position).toBe('relative');
    });

    it('prepends overlay as first child', () => {
      importProgress.show();

      expect(container.firstChild.id).toBe('import-progress-overlay');
    });

    it('stores element reference', () => {
      importProgress.show();

      expect(importProgress.element).not.toBeNull();
      expect(importProgress.element.id).toBe('import-progress-overlay');
    });

    it('removes existing overlay before creating new one', () => {
      importProgress.show();
      importProgress.show();

      const overlays = document.querySelectorAll('#import-progress-overlay');
      expect(overlays.length).toBe(1);
    });

    it('does nothing if container not found', () => {
      document.body.innerHTML = '';
      const consoleSpy = spyOn(console, 'warn').mockImplementation(() => {});

      importProgress.show();

      expect(importProgress.element).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ImportProgress] Container not found:',
        '#node-content-container'
      );
    });
  });

  describe('update()', () => {
    beforeEach(() => {
      importProgress.show();
    });

    it('updates progress bar width', () => {
      importProgress.update({ percent: 50 });

      const bar = document.querySelector('.import-progress-bar');
      expect(bar.style.width).toBe('50%');
    });

    it('updates percentage text', () => {
      importProgress.update({ percent: 75 });

      const percent = document.querySelector('.import-progress-percent');
      expect(percent.textContent).toBe('75%');
    });

    it('rounds percentage to integer', () => {
      importProgress.update({ percent: 33.7 });

      const percent = document.querySelector('.import-progress-percent');
      expect(percent.textContent).toBe('34%');
    });

    it('updates message text', () => {
      importProgress.update({ message: 'Extracting files...' });

      const message = document.querySelector('.import-progress-message');
      expect(message.textContent).toBe('Extracting files...');
    });

    it('updates both percent and message together', () => {
      importProgress.update({ percent: 60, message: 'Processing...' });

      const bar = document.querySelector('.import-progress-bar');
      const percent = document.querySelector('.import-progress-percent');
      const message = document.querySelector('.import-progress-message');

      expect(bar.style.width).toBe('60%');
      expect(percent.textContent).toBe('60%');
      expect(message.textContent).toBe('Processing...');
    });

    it('does nothing if element is null', () => {
      importProgress.element = null;

      // Should not throw
      expect(() => {
        importProgress.update({ percent: 50, message: 'Test' });
      }).not.toThrow();
    });

    it('handles missing percent in progress object', () => {
      importProgress.update({ message: 'Just message' });

      // Bar should remain unchanged
      const bar = document.querySelector('.import-progress-bar');
      expect(bar.style.width).toBe('0%');
    });

    it('handles missing message in progress object', () => {
      const originalMessage = document.querySelector('.import-progress-message').textContent;

      importProgress.update({ percent: 50 });

      const message = document.querySelector('.import-progress-message');
      // Message should remain unchanged
      expect(message.textContent).toBe(originalMessage);
    });

    it('handles 0% progress', () => {
      importProgress.update({ percent: 0 });

      const bar = document.querySelector('.import-progress-bar');
      const percent = document.querySelector('.import-progress-percent');

      expect(bar.style.width).toBe('0%');
      expect(percent.textContent).toBe('0%');
    });

    it('handles 100% progress', () => {
      importProgress.update({ percent: 100, message: 'Complete!' });

      const bar = document.querySelector('.import-progress-bar');
      const percent = document.querySelector('.import-progress-percent');
      const message = document.querySelector('.import-progress-message');

      expect(bar.style.width).toBe('100%');
      expect(percent.textContent).toBe('100%');
      expect(message.textContent).toBe('Complete!');
    });
  });

  describe('hide()', () => {
    beforeEach(() => {
      importProgress.show();
    });

    it('adds hiding class to element', () => {
      importProgress.hide();

      expect(importProgress.element).toBeNull(); // Element ref is cleared immediately
      const overlay = document.querySelector('#import-progress-overlay');
      expect(overlay.classList.contains('hiding')).toBe(true);
    });

    it('sets element reference to null immediately', () => {
      importProgress.hide();

      expect(importProgress.element).toBeNull();
    });

    it('removes element from DOM after timeout', async () => {
      vi.useFakeTimers();

      importProgress.hide();

      // Element should still be in DOM
      expect(document.querySelector('#import-progress-overlay')).not.toBeNull();

      // Advance timers past the 300ms delay
      await vi.advanceTimersByTimeAsync(350);

      // Element should be removed
      expect(document.querySelector('#import-progress-overlay')).toBeNull();

      vi.useRealTimers();
    });

    it('does nothing if element is already null', () => {
      importProgress.element = null;

      // Should not throw
      expect(() => {
        importProgress.hide();
      }).not.toThrow();
    });

    it('can be called multiple times safely', () => {
      importProgress.hide();
      importProgress.hide();

      // Should not throw
      expect(importProgress.element).toBeNull();
    });
  });

  describe('integration: full progress cycle', () => {
    it('simulates complete import progress cycle', async () => {
      vi.useFakeTimers();

      // Show
      importProgress.show();
      expect(document.querySelector('#import-progress-overlay')).not.toBeNull();

      // Decompress phase
      importProgress.update({ phase: 'decompress', percent: 0, message: 'Decompressing...' });
      expect(document.querySelector('.import-progress-bar').style.width).toBe('0%');

      importProgress.update({ phase: 'decompress', percent: 10, message: 'Decompressed' });
      expect(document.querySelector('.import-progress-bar').style.width).toBe('10%');

      // Assets phase
      importProgress.update({ phase: 'assets', percent: 30, message: 'Extracting assets...' });
      expect(document.querySelector('.import-progress-bar').style.width).toBe('30%');

      importProgress.update({ phase: 'assets', percent: 50, message: 'Assets extracted' });
      expect(document.querySelector('.import-progress-bar').style.width).toBe('50%');

      // Structure phase
      importProgress.update({ phase: 'structure', percent: 65, message: 'Importing structure...' });
      expect(document.querySelector('.import-progress-bar').style.width).toBe('65%');

      importProgress.update({ phase: 'structure', percent: 80, message: 'Structure imported' });
      expect(document.querySelector('.import-progress-bar').style.width).toBe('80%');

      // Precache phase
      importProgress.update({ phase: 'precache', percent: 90, message: 'Precaching assets...' });
      expect(document.querySelector('.import-progress-bar').style.width).toBe('90%');

      importProgress.update({ phase: 'precache', percent: 100, message: 'Import complete' });
      expect(document.querySelector('.import-progress-bar').style.width).toBe('100%');
      expect(document.querySelector('.import-progress-message').textContent).toBe('Import complete');

      // Hide
      importProgress.hide();
      await vi.advanceTimersByTimeAsync(350);
      expect(document.querySelector('#import-progress-overlay')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('edge cases', () => {
    it('handles empty progress object', () => {
      importProgress.show();

      expect(() => {
        importProgress.update({});
      }).not.toThrow();
    });

    it('handles null progress object', () => {
      importProgress.show();

      expect(() => {
        importProgress.update(null);
      }).not.toThrow();
    });

    it('handles undefined progress object', () => {
      importProgress.show();

      expect(() => {
        importProgress.update(undefined);
      }).not.toThrow();
    });

    it('handles negative percent', () => {
      importProgress.show();
      importProgress.update({ percent: -10 });

      const bar = document.querySelector('.import-progress-bar');
      expect(bar.style.width).toBe('-10%'); // CSS will handle clamping
    });

    it('handles percent over 100', () => {
      importProgress.show();
      importProgress.update({ percent: 150 });

      const bar = document.querySelector('.import-progress-bar');
      expect(bar.style.width).toBe('150%'); // CSS will handle clamping
    });
  });

  describe('UI blocking', () => {

    describe('show() blocks UI', () => {
      it('adds import-blocking class to container', () => {
        importProgress.show();

        expect(container.classList.contains('import-blocking')).toBe(true);
      });

      it('adds disabled class to menu_nav', () => {
        importProgress.show();

        const menuNav = document.querySelector('#menu_nav');
        expect(menuNav.classList.contains('disabled')).toBe(true);
      });

      it('adds disabled class to menuidevices-menu', () => {
        importProgress.show();

        const menuIdevices = document.querySelector('#menuidevices-menu');
        expect(menuIdevices.classList.contains('disabled')).toBe(true);
      });

      it('adds disabled class to listmenuidevices', () => {
        importProgress.show();

        const listMenuIdevices = document.querySelector('#listmenuidevices');
        expect(listMenuIdevices.classList.contains('disabled')).toBe(true);
      });

      it('handles missing menu elements gracefully', () => {
        // Remove menus from DOM
        document.querySelector('#menu_nav').remove();
        document.querySelector('#menuidevices-menu').remove();
        document.querySelector('#listmenuidevices').remove();

        // Should not throw
        expect(() => {
          importProgress.show();
        }).not.toThrow();

        expect(container.classList.contains('import-blocking')).toBe(true);
      });
    });

    describe('hide() unblocks UI', () => {
      beforeEach(() => {
        importProgress.show();
      });

      it('removes import-blocking class from container', () => {
        importProgress.hide();

        expect(container.classList.contains('import-blocking')).toBe(false);
      });

      it('removes disabled class from menu_nav', () => {
        importProgress.hide();

        const menuNav = document.querySelector('#menu_nav');
        expect(menuNav.classList.contains('disabled')).toBe(false);
      });

      it('removes disabled class from menuidevices-menu', () => {
        importProgress.hide();

        const menuIdevices = document.querySelector('#menuidevices-menu');
        expect(menuIdevices.classList.contains('disabled')).toBe(false);
      });

      it('removes disabled class from listmenuidevices', () => {
        importProgress.hide();

        const listMenuIdevices = document.querySelector('#listmenuidevices');
        expect(listMenuIdevices.classList.contains('disabled')).toBe(false);
      });

      it('handles missing menu elements gracefully', () => {
        // Remove menus from DOM after show()
        document.querySelector('#menu_nav').remove();
        document.querySelector('#menuidevices-menu').remove();
        document.querySelector('#listmenuidevices').remove();

        // Should not throw
        expect(() => {
          importProgress.hide();
        }).not.toThrow();

        expect(container.classList.contains('import-blocking')).toBe(false);
      });

      it('unblocks UI even when element is null', () => {
        importProgress.element = null;

        importProgress.hide();

        expect(container.classList.contains('import-blocking')).toBe(false);
        expect(document.querySelector('#menu_nav').classList.contains('disabled')).toBe(false);
      });
    });

    describe('full blocking cycle', () => {
      it('blocks and unblocks UI through complete progress cycle', () => {
        // Initially not blocked
        expect(container.classList.contains('import-blocking')).toBe(false);

        // Show - should block
        importProgress.show();
        expect(container.classList.contains('import-blocking')).toBe(true);
        expect(document.querySelector('#menu_nav').classList.contains('disabled')).toBe(true);

        // Update - should stay blocked
        importProgress.update({ percent: 50 });
        expect(container.classList.contains('import-blocking')).toBe(true);

        // Hide - should unblock
        importProgress.hide();
        expect(container.classList.contains('import-blocking')).toBe(false);
        expect(document.querySelector('#menu_nav').classList.contains('disabled')).toBe(false);
      });
    });
  });
});
