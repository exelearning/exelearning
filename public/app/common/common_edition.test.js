import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('common_edition.js', () => {
  beforeAll(async () => {
    // Setup globals needed BEFORE the script is loaded
    globalThis._ = vi.fn((key) => key);
    globalThis.c_ = vi.fn((key) => key);
    globalThis.eXe = {
      app: {
        alert: vi.fn(),
        clearHistory: vi.fn(),
        _confirmResponses: {
          clear: vi.fn()
        }
      },
    };
    globalThis.tinymce = {
      majorVersion: 4,
    };
    globalThis.$exeTinyMCE = {
      init: vi.fn(),
    };
    globalThis.$exeDevice = {
      init: vi.fn(),
      save: vi.fn(() => '<div>Saved HTML</div>'),
      i18n: {
        en: { 'Test': 'Translated Test' }
      }
    };
    globalThis.top = {
      translations: {}
    };

    // Mock jQuery
    const mockJQuery = vi.fn((selector) => {
      const elements = {
        '#exe-submitButton a': {
          length: 1,
          attr: vi.fn(() => 'console.log("clicked")'),
          0: { onclick: null },
          eq: function() { return this; }
        },
        'HTML': {
          attr: vi.fn(() => 'en')
        },
        '.exe-fieldset legend a': {
          click: vi.fn()
        },
        '.exe-info': {
          each: vi.fn(),
          html: vi.fn()
        },
        'textarea.mceEditor, #node-content .idevice_node[mode=edition]': {
          val: vi.fn()
        },
        '#eXeGameShowClue': {
          is: vi.fn(() => true),
          prop: vi.fn()
        },
        '#eXeGameClue': {
          val: vi.fn(() => 'Clue Text'),
          prop: vi.fn()
        },
        '#eXeGamePercentajeClue': {
          children: vi.fn(() => ({
            val: vi.fn(() => '40')
          })),
          val: vi.fn()
        },
        '#eXeGameShowCodeAccess': {
          is: vi.fn(() => false),
          prop: vi.fn()
        },
        '#eXeGameCodeAccess': {
          val: vi.fn(() => ''),
          prop: vi.fn()
        },
        '#eXeGameMessageCodeAccess': {
          val: vi.fn(() => ''),
          prop: vi.fn()
        },
        'input[type=radio][name=\'eXeGameSCORM\']:checked': {
          val: vi.fn(() => '1')
        },
        '#eXeGameSCORMbuttonText': {
          val: vi.fn(() => 'Save'),
        },
        '#eXeGameSCORMWeight': {
          val: vi.fn(() => '100'),
        }
      };

      if (typeof selector === 'string' && elements[selector]) {
        return elements[selector];
      }

      return {
        length: 0,
        attr: vi.fn(),
        click: vi.fn(),
        each: vi.fn(),
        html: vi.fn(),
        val: vi.fn(),
        find: vi.fn().mockReturnThis(),
        parent: vi.fn().mockReturnThis(),
        prev: vi.fn().mockReturnThis(),
        next: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        before: vi.fn().mockReturnThis(),
        after: vi.fn().mockReturnThis(),
        addClass: vi.fn().mockReturnThis(),
        removeClass: vi.fn().mockReturnThis(),
        toggleClass: vi.fn().mockReturnThis(),
        css: vi.fn().mockReturnThis(),
        fadeOut: vi.fn().mockReturnThis(),
        prop: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        off: vi.fn().mockReturnThis(),
        is: vi.fn(() => false),
        children: vi.fn().mockReturnThis(),
        trigger: vi.fn().mockReturnThis(),
        removeAttr: vi.fn().mockReturnThis(),
      };
    });
    
    // Add $.trim
    mockJQuery.trim = (str) => str ? str.trim() : '';
    
    globalThis.$ = mockJQuery;
    globalThis.jQuery = mockJQuery;

    // Load the script content and eval it
    const fs = await import('fs');
    const path = await import('path');
    const scriptPath = path.resolve(__dirname, './common_edition.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    (0, eval)(scriptContent);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Ensure $exeDevice is defined globally before script evaluation in each test
    globalThis.$exeDevice = {
      init: vi.fn(),
      save: vi.fn(() => '<div>Saved HTML</div>'),
      i18n: {
        en: { 'Test': 'Translated Test' }
      }
    };

    // Re-mock jQuery to ensure it handles string checks safely
    const mockJQuery = vi.fn((selector) => {
      const isString = typeof selector === 'string';
      
      const elements = {
        '#exe-submitButton a': {
          length: 1,
          attr: vi.fn(() => 'console.log("clicked")'),
          0: { onclick: null },
          eq: function() { return this; }
        },
        'HTML': {
          attr: vi.fn(() => 'en')
        }
      };

      if (isString && elements[selector]) {
        return elements[selector];
      }

      const baseMock = {
        length: isString && selector.includes('.exe-form-tab') ? 0 : 0,
        attr: vi.fn(),
        click: vi.fn(),
        each: vi.fn(),
        html: vi.fn(),
        val: vi.fn(),
        find: vi.fn().mockReturnThis(),
        parent: vi.fn().mockReturnThis(),
        prev: vi.fn().mockReturnThis(),
        next: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        before: vi.fn().mockReturnThis(),
        after: vi.fn().mockReturnThis(),
        addClass: vi.fn().mockReturnThis(),
        removeClass: vi.fn().mockReturnThis(),
        toggleClass: vi.fn().mockReturnThis(),
        css: vi.fn().mockReturnThis(),
        fadeOut: vi.fn().mockReturnThis(),
        prop: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        off: vi.fn().mockReturnThis(),
        is: vi.fn(() => selector === '#eXeGameShowClue'),
        children: vi.fn().mockReturnThis(),
        trigger: vi.fn().mockReturnThis(),
        removeAttr: vi.fn().mockReturnThis(),
      };

      if (isString) {
        if (selector === '#eXeGameClue') baseMock.val = vi.fn(() => 'Clue Text');
        if (selector === '#eXeGameSCORMbuttonText') baseMock.val = vi.fn(() => 'Save');
        if (selector === '#eXeGameSCORMWeight') baseMock.val = vi.fn(() => '100');
        if (selector === 'input[type=radio][name=\'eXeGameSCORM\']:checked') baseMock.val = vi.fn(() => '1');
      }

      return baseMock;
    });
    mockJQuery.trim = (str) => str ? str.trim() : '';
    globalThis.$ = mockJQuery;
    globalThis.jQuery = mockJQuery;
  });

  it('defines global $exeDevicesEdition', () => {
    expect(globalThis.$exeDevicesEdition).toBeDefined();
    expect(typeof globalThis.$exeDevicesEdition.iDevice.init).toBe('function');
  });

  describe('iDevice.init', () => {
    it('calls $exeDevice.init and $exeTinyMCE.init', () => {
      globalThis.$exeDevicesEdition.iDevice.init();
      expect(globalThis.$exeDevice.init).toHaveBeenCalled();
      expect(globalThis.$exeTinyMCE.init).toHaveBeenCalledWith('multiple-visible', '.exe-html-editor');
    });

    it('shows alert if $exeDevice is not fully defined', () => {
      const originalInit = globalThis.$exeDevice.init;
      delete globalThis.$exeDevice.init;
      
      globalThis.$exeDevicesEdition.iDevice.init();
      
      expect(globalThis.eXe.app.alert).toHaveBeenCalled();
      
      globalThis.$exeDevice.init = originalInit;
    });
  });

  describe('common', () => {
    it('getTextFieldset returns fieldset HTML', () => {
      const result = globalThis.$exeDevicesEdition.iDevice.common.getTextFieldset('after');
      expect(result).toContain('fieldset');
      expect(result).toContain('eXeIdeviceTextAfter');
    });
  });

  describe('gamification', () => {
    it('instructions.getFieldset returns fieldset HTML', () => {
      const result = globalThis.$exeDevicesEdition.iDevice.gamification.instructions.getFieldset('test info');
      expect(result).toContain('fieldset');
      expect(result).toContain('eXeGameInstructions');
      expect(result).toContain('test info');
    });

    it('itinerary.getValues returns object with values', () => {
      const values = globalThis.$exeDevicesEdition.iDevice.gamification.itinerary.getValues();
      expect(values).toHaveProperty('showClue');
      expect(values).toHaveProperty('clueGame');
      expect(values.clueGame).toBe('Clue Text');
    });

    it('scorm.getValues returns SCORM values', () => {
      const values = globalThis.$exeDevicesEdition.iDevice.gamification.scorm.getValues();
      expect(values.isScorm).toBe(1);
      expect(values.textButtonScorm).toBe('Save');
    });
  });

  describe('tabs', () => {
    it('init handles tabs', () => {
      const mockTabs = {
        each: vi.fn((callback) => {
          callback.call({ 
            attr: vi.fn((name, val) => {
              if (name === 'title') return 'Tab Title';
              return '';
            }),
            hide: vi.fn()
          }, 0);
        }),
        eq: vi.fn(() => ({
          before: vi.fn()
        }))
      };
      
      globalThis.$ = vi.fn((selector) => {
        if (typeof selector === 'string' && selector.includes('.exe-form-tab')) return mockTabs;
        return {
          click: vi.fn(),
          attr: vi.fn(),
          addClass: vi.fn(),
          hide: vi.fn(),
          trigger: vi.fn(),
          length: 1
        };
      });

      globalThis.$exeDevicesEdition.iDevice.tabs.init('test-id');
      expect(mockTabs.each).toHaveBeenCalled();
    });
  });
});
