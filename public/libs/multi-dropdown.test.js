/**
 * multi-dropdown.js Tests
 *
 * Unit tests for the Bootstrap multi-level dropdown extension.
 * This library extends Bootstrap's Dropdown to support nested dropdowns
 * and hover functionality.
 *
 * Run with: make test-frontend
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('multi-dropdown', () => {
  let scriptContent;
  let originalBootstrap;

  beforeAll(() => {
    // Read the script content
    const scriptPath = join(__dirname, 'multi-dropdown.js');
    scriptContent = readFileSync(scriptPath, 'utf-8');
  });

  beforeEach(() => {
    // Store original
    originalBootstrap = global.bootstrap;

    // Reset DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Restore original
    global.bootstrap = originalBootstrap;
    vi.clearAllMocks();
  });

  describe('script structure', () => {
    it('is wrapped in an IIFE with bootstrap parameter', () => {
      expect(scriptContent).toContain('(function($bs)');
      expect(scriptContent).toContain('})(bootstrap)');
    });

    it('defines CLASS_NAME constant', () => {
      expect(scriptContent).toContain("const CLASS_NAME = 'has-child-dropdown-show'");
    });

    it('overrides Dropdown.prototype.toggle', () => {
      expect(scriptContent).toContain('$bs.Dropdown.prototype.toggle');
      expect(scriptContent).toContain('function(_orginal)');
    });

    it('handles hide.bs.dropdown event', () => {
      expect(scriptContent).toContain("'hide.bs.dropdown'");
      expect(scriptContent).toContain('e.preventDefault()');
      expect(scriptContent).toContain('e.stopPropagation()');
    });

    it('supports hover functionality', () => {
      expect(scriptContent).toContain('.dropdown-hover');
      expect(scriptContent).toContain('.dropdown-hover-all .dropdown');
      expect(scriptContent).toContain('mouseenter');
      expect(scriptContent).toContain('mouseleave');
    });
  });

  describe('toggle override logic', () => {
    it('removes CLASS_NAME from all elements first', () => {
      expect(scriptContent).toContain("document.querySelectorAll('.' + CLASS_NAME)");
      expect(scriptContent).toContain('e.classList.remove(CLASS_NAME)');
    });

    it('traverses parent dropdowns', () => {
      expect(scriptContent).toContain("this._element.closest('.dropdown')");
      expect(scriptContent).toContain(".parentNode.closest('.dropdown')");
    });

    it('adds CLASS_NAME to parent dropdowns', () => {
      expect(scriptContent).toContain('dd.classList.add(CLASS_NAME)');
    });

    it('calls original toggle method', () => {
      expect(scriptContent).toContain('return _orginal.call(this)');
    });
  });

  describe('hide.bs.dropdown handler', () => {
    it('prevents default when element has CLASS_NAME', () => {
      expect(scriptContent).toContain('this.classList.contains(CLASS_NAME)');
      expect(scriptContent).toContain('this.classList.remove(CLASS_NAME)');
      expect(scriptContent).toContain('e.preventDefault()');
    });

    it('always stops propagation', () => {
      // stopPropagation is called outside the if block
      expect(scriptContent).toContain('e.stopPropagation()');
      expect(scriptContent).toContain('// do not need pop in multi level mode');
    });
  });

  describe('hover functionality', () => {
    it('queries for hover-enabled dropdowns', () => {
      expect(scriptContent).toContain(
        "document.querySelectorAll('.dropdown-hover, .dropdown-hover-all .dropdown')"
      );
    });

    it('finds toggle element on mouseenter', () => {
      expect(scriptContent).toContain(':scope>[data-bs-toggle="dropdown"]');
    });

    it('checks show state before toggling', () => {
      expect(scriptContent).toContain("toggle.classList.contains('show')");
    });

    it('uses getOrCreateInstance for dropdown', () => {
      expect(scriptContent).toContain('$bs.Dropdown.getOrCreateInstance(toggle)');
    });

    it('clears menus after toggle on mouseenter', () => {
      expect(scriptContent).toContain('$bs.Dropdown.clearMenus()');
    });
  });

  describe('script execution', () => {
    it('executes without errors when bootstrap is available', () => {
      // Setup mock bootstrap
      const mockToggleFn = vi.fn();
      global.bootstrap = {
        Dropdown: {
          prototype: {
            toggle: mockToggleFn,
          },
          getOrCreateInstance: vi.fn(() => ({
            toggle: vi.fn(),
          })),
          clearMenus: vi.fn(),
        },
      };

      // Execute script
      expect(() => {
        // eslint-disable-next-line no-eval
        eval(scriptContent);
      }).not.toThrow();

      // Verify toggle was overridden
      expect(global.bootstrap.Dropdown.prototype.toggle).not.toBe(mockToggleFn);
    });

    it('overrides toggle with wrapper function', () => {
      const originalToggle = vi.fn(() => 'original-result');
      global.bootstrap = {
        Dropdown: {
          prototype: {
            toggle: originalToggle,
          },
          getOrCreateInstance: vi.fn(() => ({
            toggle: vi.fn(),
          })),
          clearMenus: vi.fn(),
        },
      };

      // eslint-disable-next-line no-eval
      eval(scriptContent);

      // The toggle should now be a wrapper
      expect(typeof global.bootstrap.Dropdown.prototype.toggle).toBe('function');
    });
  });

  describe('DOM event binding', () => {
    it('binds hide.bs.dropdown to dropdown elements', () => {
      // Create dropdown element
      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown';
      document.body.appendChild(dropdown);

      const addEventListenerSpy = vi.spyOn(dropdown, 'addEventListener');

      // Setup mock bootstrap
      global.bootstrap = {
        Dropdown: {
          prototype: {
            toggle: vi.fn(),
          },
          getOrCreateInstance: vi.fn(() => ({
            toggle: vi.fn(),
          })),
          clearMenus: vi.fn(),
        },
      };

      // eslint-disable-next-line no-eval
      eval(scriptContent);

      expect(addEventListenerSpy).toHaveBeenCalledWith('hide.bs.dropdown', expect.any(Function));
    });

    it('binds mouseenter and mouseleave to hover dropdowns', () => {
      // Create hover dropdown element
      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown dropdown-hover';
      const toggle = document.createElement('button');
      toggle.setAttribute('data-bs-toggle', 'dropdown');
      dropdown.appendChild(toggle);
      document.body.appendChild(dropdown);

      const addEventListenerSpy = vi.spyOn(dropdown, 'addEventListener');

      // Setup mock bootstrap
      global.bootstrap = {
        Dropdown: {
          prototype: {
            toggle: vi.fn(),
          },
          getOrCreateInstance: vi.fn(() => ({
            toggle: vi.fn(),
          })),
          clearMenus: vi.fn(),
        },
      };

      // eslint-disable-next-line no-eval
      eval(scriptContent);

      const calls = addEventListenerSpy.mock.calls.map((c) => c[0]);
      expect(calls).toContain('mouseenter');
      expect(calls).toContain('mouseleave');
    });
  });

  describe('hide.bs.dropdown behavior', () => {
    it('prevents hide when dropdown has CLASS_NAME', () => {
      // Create dropdown with CLASS_NAME
      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown has-child-dropdown-show';
      document.body.appendChild(dropdown);

      // Setup mock bootstrap
      global.bootstrap = {
        Dropdown: {
          prototype: {
            toggle: vi.fn(),
          },
          getOrCreateInstance: vi.fn(() => ({
            toggle: vi.fn(),
          })),
          clearMenus: vi.fn(),
        },
      };

      // eslint-disable-next-line no-eval
      eval(scriptContent);

      // Create and dispatch event
      const event = new Event('hide.bs.dropdown', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      dropdown.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(dropdown.classList.contains('has-child-dropdown-show')).toBe(false);
    });

    it('does not prevent hide when dropdown lacks CLASS_NAME', () => {
      // Create dropdown without CLASS_NAME
      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown';
      document.body.appendChild(dropdown);

      // Setup mock bootstrap
      global.bootstrap = {
        Dropdown: {
          prototype: {
            toggle: vi.fn(),
          },
          getOrCreateInstance: vi.fn(() => ({
            toggle: vi.fn(),
          })),
          clearMenus: vi.fn(),
        },
      };

      // eslint-disable-next-line no-eval
      eval(scriptContent);

      // Create and dispatch event
      const event = new Event('hide.bs.dropdown', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      dropdown.dispatchEvent(event);

      // preventDefault should NOT be called, but stopPropagation always is
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('mouseenter behavior', () => {
    it('toggles dropdown on mouseenter when not shown', () => {
      // Create hover dropdown
      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown dropdown-hover';
      const toggle = document.createElement('button');
      toggle.setAttribute('data-bs-toggle', 'dropdown');
      toggle.className = ''; // not shown
      dropdown.appendChild(toggle);
      document.body.appendChild(dropdown);

      const mockToggle = vi.fn();
      global.bootstrap = {
        Dropdown: {
          prototype: {
            toggle: vi.fn(),
          },
          getOrCreateInstance: vi.fn(() => ({
            toggle: mockToggle,
          })),
          clearMenus: vi.fn(),
        },
      };

      // eslint-disable-next-line no-eval
      eval(scriptContent);

      // Dispatch mouseenter
      const event = new MouseEvent('mouseenter', { bubbles: true });
      Object.defineProperty(event, 'target', { value: dropdown, writable: false });
      dropdown.dispatchEvent(event);

      expect(global.bootstrap.Dropdown.getOrCreateInstance).toHaveBeenCalledWith(toggle);
      expect(mockToggle).toHaveBeenCalled();
      expect(global.bootstrap.Dropdown.clearMenus).toHaveBeenCalled();
    });

    it('does not toggle on mouseenter when already shown', () => {
      // Create hover dropdown with shown toggle
      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown dropdown-hover';
      const toggle = document.createElement('button');
      toggle.setAttribute('data-bs-toggle', 'dropdown');
      toggle.className = 'show'; // already shown
      dropdown.appendChild(toggle);
      document.body.appendChild(dropdown);

      const mockToggle = vi.fn();
      global.bootstrap = {
        Dropdown: {
          prototype: {
            toggle: vi.fn(),
          },
          getOrCreateInstance: vi.fn(() => ({
            toggle: mockToggle,
          })),
          clearMenus: vi.fn(),
        },
      };

      // eslint-disable-next-line no-eval
      eval(scriptContent);

      // Dispatch mouseenter
      const event = new MouseEvent('mouseenter', { bubbles: true });
      Object.defineProperty(event, 'target', { value: dropdown, writable: false });
      dropdown.dispatchEvent(event);

      // Should not toggle since already shown
      expect(mockToggle).not.toHaveBeenCalled();
    });
  });

  describe('mouseleave behavior', () => {
    it('toggles dropdown on mouseleave when shown', () => {
      // Create hover dropdown with shown toggle
      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown dropdown-hover';
      const toggle = document.createElement('button');
      toggle.setAttribute('data-bs-toggle', 'dropdown');
      toggle.className = 'show';
      dropdown.appendChild(toggle);
      document.body.appendChild(dropdown);

      const mockToggle = vi.fn();
      global.bootstrap = {
        Dropdown: {
          prototype: {
            toggle: vi.fn(),
          },
          getOrCreateInstance: vi.fn(() => ({
            toggle: mockToggle,
          })),
          clearMenus: vi.fn(),
        },
      };

      // eslint-disable-next-line no-eval
      eval(scriptContent);

      // Dispatch mouseleave
      const event = new MouseEvent('mouseleave', { bubbles: true });
      Object.defineProperty(event, 'target', { value: dropdown, writable: false });
      dropdown.dispatchEvent(event);

      expect(global.bootstrap.Dropdown.getOrCreateInstance).toHaveBeenCalledWith(toggle);
      expect(mockToggle).toHaveBeenCalled();
    });

    it('does not toggle on mouseleave when not shown', () => {
      // Create hover dropdown without shown toggle
      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown dropdown-hover';
      const toggle = document.createElement('button');
      toggle.setAttribute('data-bs-toggle', 'dropdown');
      toggle.className = ''; // not shown
      dropdown.appendChild(toggle);
      document.body.appendChild(dropdown);

      const mockToggle = vi.fn();
      global.bootstrap = {
        Dropdown: {
          prototype: {
            toggle: vi.fn(),
          },
          getOrCreateInstance: vi.fn(() => ({
            toggle: mockToggle,
          })),
          clearMenus: vi.fn(),
        },
      };

      // eslint-disable-next-line no-eval
      eval(scriptContent);

      // Dispatch mouseleave
      const event = new MouseEvent('mouseleave', { bubbles: true });
      Object.defineProperty(event, 'target', { value: dropdown, writable: false });
      dropdown.dispatchEvent(event);

      // Should not toggle since not shown
      expect(mockToggle).not.toHaveBeenCalled();
    });
  });

  describe('nested dropdown support', () => {
    it('script contains logic to find parent dropdowns', () => {
      // The toggle override should traverse up the DOM tree
      expect(scriptContent).toContain("let dd = this._element.closest('.dropdown')");
      expect(scriptContent).toContain(".parentNode.closest('.dropdown')");
      expect(scriptContent).toContain('dd !== document');
    });

    it('script adds CLASS_NAME to all parent dropdowns', () => {
      // The for loop adds CLASS_NAME to each parent
      expect(scriptContent).toContain('for (; dd && dd !== document;');
      expect(scriptContent).toContain('dd.classList.add(CLASS_NAME)');
    });
  });

  describe('CLASS_NAME management', () => {
    it('removes CLASS_NAME from all elements before adding', () => {
      // The toggle first clears all CLASS_NAME instances
      expect(scriptContent).toContain("document.querySelectorAll('.' + CLASS_NAME).forEach");
      expect(scriptContent).toContain('e.classList.remove(CLASS_NAME)');
    });

    it('uses consistent CLASS_NAME value', () => {
      // Verify CLASS_NAME is defined once and used consistently
      const matches = scriptContent.match(/CLASS_NAME/g);
      expect(matches.length).toBeGreaterThan(5); // Used multiple times
      expect(scriptContent).toContain("const CLASS_NAME = 'has-child-dropdown-show'");
    });
  });
});
