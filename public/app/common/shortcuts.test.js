import Shortcuts, { isMacOS, getModifierKey, formatShortcut } from './shortcuts.js';

describe('Utility functions', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('isMacOS', () => {
    it('should return true for Mac platform', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(true);
    });

    it('should return true for iPhone platform', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'iPhone', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(true);
    });

    it('should return true for iPad platform', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'iPad', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(true);
    });

    it('should return false for Windows platform', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(false);
    });

    it('should return false for Linux platform', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Linux x86_64', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(false);
    });

    it('should use userAgentData.platform when available (macOS)', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32', userAgentData: { platform: 'macOS' } },
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(true);
    });

    it('should use userAgentData.platform when available (Windows)', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel', userAgentData: { platform: 'Windows' } },
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(false);
    });
  });

  describe('getModifierKey', () => {
    it('should return ⌘ for Mac', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(getModifierKey()).toBe('⌘');
    });

    it('should return Ctrl for non-Mac', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(getModifierKey()).toBe('Ctrl');
    });
  });

  describe('formatShortcut', () => {
    it('should format mod+z as ⌘Z on Mac', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('mod+z')).toBe('⌘Z');
    });

    it('should format mod+z as Ctrl+Z on Windows', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('mod+z')).toBe('Ctrl+Z');
    });

    it('should format mod+shift+z as ⌘⇧Z on Mac', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('mod+shift+z')).toBe('⌘⇧Z');
    });

    it('should format mod+shift+z as Ctrl+Shift+Z on Windows', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('mod+shift+z')).toBe('Ctrl+Shift+Z');
    });

    it('should format mod+alt+s correctly on Mac', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('mod+alt+s')).toBe('⌘⌥S');
    });

    it('should format mod+alt+s correctly on Windows', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('mod+alt+s')).toBe('Ctrl+Alt+S');
    });

    it('should handle explicit ctrl key', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('ctrl+c')).toBe('CtrlC');
    });

    it('should handle symbol modifiers', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel', userAgentData: undefined },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('⌘+⇧+s')).toBe('⌘⇧S');
    });
  });
});

describe('Shortcuts', () => {
  let shortcuts;
  let mockApp;

  beforeEach(() => {
    mockApp = {};
    // Ensure document body is clean
    document.body.innerHTML = '';
    document.body.removeAttribute('installation-type');
    
    shortcuts = new Shortcuts(mockApp);
  });

  afterEach(() => {
    shortcuts.destroy();
    vi.restoreAllMocks();
  });

  describe('normalizeCombo', () => {
    it('should normalize Mod+S to mod+s', () => {
      expect(shortcuts.normalizeCombo('Mod+S')).toBe('mod+s');
    });

    it('should normalize Cmd+Shift+A to meta+shift+a', () => {
      expect(shortcuts.normalizeCombo('Cmd+Shift+A')).toBe('meta+shift+a');
    });

    it('should handle various modifier names', () => {
      expect(shortcuts.normalizeCombo('control+option+X')).toBe('ctrl+alt+x');
      expect(shortcuts.normalizeCombo('⌘+⇧+S')).toBe('meta+shift+s');
    });

    it('should return null for invalid inputs', () => {
      expect(shortcuts.normalizeCombo('')).toBeNull();
      expect(shortcuts.normalizeCombo(null)).toBeNull();
      expect(shortcuts.normalizeCombo('Shift+')).toBeNull();
    });
  });

  describe('humanLabel', () => {
    it('should return ⌘ for mod on Mac', () => {
      shortcuts.isMac = true;
      expect(shortcuts.humanLabel('mod+s')).toBe('⌘S');
      expect(shortcuts.humanLabel('mod+shift+s')).toBe('⌘⇧S');
    });

    it('should return Ctrl for mod on non-Mac', () => {
      shortcuts.isMac = false;
      expect(shortcuts.humanLabel('mod+s')).toBe('Ctrl+S');
      expect(shortcuts.humanLabel('mod+shift+s')).toBe('Ctrl+Shift+S');
    });
  });

  describe('buildIndex', () => {
    it('should index elements with data-shortcut', () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-shortcut', 'Mod+S');
      document.body.appendChild(btn);

      shortcuts.buildIndex();
      expect(shortcuts.index.has('mod+s')).toBe(true);
      expect(shortcuts.index.get('mod+s')).toContain(btn);
    });

    it('should handle comma-separated shortcuts', () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-shortcut', 'Mod+S, Mod+Alt+S');
      document.body.appendChild(btn);

      shortcuts.buildIndex();
      expect(shortcuts.index.has('mod+s')).toBe(true);
      expect(shortcuts.index.has('mod+alt+s')).toBe(true);
    });
  });

  describe('renderHints', () => {
    it('should add a hint span to elements', () => {
      shortcuts.isMac = false;
      const btn = document.createElement('button');
      btn.setAttribute('data-shortcut', 'Mod+S');
      document.body.appendChild(btn);

      shortcuts.renderHints();
      const hint = btn.querySelector('.shortcut-hint');
      expect(hint).not.toBeNull();
      expect(hint.textContent).toBe('Ctrl+S');
    });

    it('should not add duplicate hints', () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-shortcut', 'Mod+S');
      document.body.appendChild(btn);

      shortcuts.renderHints();
      shortcuts.renderHints();
      expect(btn.querySelectorAll('.shortcut-hint').length).toBe(1);
    });
  });

  describe('onKeyDown', () => {
    let mockBtn;

    beforeEach(() => {
      mockBtn = document.createElement('button');
      mockBtn.id = 'navbar-button-save';
      mockBtn.click = vi.fn();
      document.body.appendChild(mockBtn);
      
      // Add attribute to simulate online mode
      document.body.setAttribute('installation-type', 'online');
    });

    it('should trigger click on target element for normalized combo', () => {
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true, // mod on Windows
      });
      
      // Mock isMac to false for Ctrl test
      shortcuts.isMac = false;
      
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      shortcuts.onKeyDown(event);

      expect(mockBtn.click).toHaveBeenCalled();
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should use offline remapping when installation-type is offline', () => {
      document.body.setAttribute('installation-type', 'offline');
      
      const offlineBtn = document.createElement('button');
      offlineBtn.id = 'navbar-button-save-offline';
      offlineBtn.click = vi.fn();
      document.body.appendChild(offlineBtn);

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      });
      shortcuts.isMac = false;
      
      shortcuts.onKeyDown(event);

      expect(offlineBtn.click).toHaveBeenCalled();
      expect(mockBtn.click).not.toHaveBeenCalled();
    });

    it('should not trigger if target is typing and combo is not mod+', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const event = new KeyboardEvent('keydown', {
        key: 'm',
        target: input
      });
      
      // Mock comboFromEvent since it requires modifiers usually
      vi.spyOn(shortcuts, 'comboFromEvent').mockReturnValue('m');
      
      shortcuts.onKeyDown(event);
      expect(mockBtn.click).not.toHaveBeenCalled();
    });

    it('should allow mod+ shortcuts even while typing', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        target: input
      });
      shortcuts.isMac = false;
      
      shortcuts.onKeyDown(event);
      expect(mockBtn.click).toHaveBeenCalled();
    });
  });

  describe('observe', () => {
    it('should create MutationObserver on root element', () => {
      const root = document.createElement('div');
      root.id = 'eXeLearningNavbar';
      document.body.appendChild(root);

      shortcuts.observe(root);
      expect(shortcuts._observer).toBeInstanceOf(MutationObserver);
    });
  });

  describe('isTypingTarget', () => {
    it('should return true for input and textarea', () => {
      const input = document.createElement('input');
      const textarea = document.createElement('textarea');
      expect(shortcuts.isTypingTarget(input)).toBe(true);
      expect(shortcuts.isTypingTarget(textarea)).toBe(true);
    });

    it('should return true for contenteditable', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      expect(shortcuts.isTypingTarget(div)).toBe(true);
    });

    it('should return false for regular elements', () => {
      const div = document.createElement('div');
      expect(shortcuts.isTypingTarget(div)).toBe(false);
    });
  });
});
