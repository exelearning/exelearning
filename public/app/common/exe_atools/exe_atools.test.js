/**
 * exe_atools.js Tests (app/common version)
 *
 * Unit tests for the eXeLearning Accessibility Toolbar.
 * Tests the toolbar functionality including font size, font family,
 * text-to-speech, Google Translate integration, and draggable behavior.
 *
 * Run with: make test-frontend
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read script content for string-matching tests
const scriptPath = join(__dirname, 'exe_atools.js');
const scriptContent = readFileSync(scriptPath, 'utf-8');

// Setup globals BEFORE requiring the module
global.$exe_i18n = {
  read: 'Read',
  translate: 'Translate',
  drag_and_drop: 'Drag and drop',
  mode_toggler: 'Mode toggler',
  accessibility_tools: 'Accessibility tools',
  default_font: 'Default font',
  increase_text_size: 'Increase text size',
  decrease_text_size: 'Decrease text size',
  reset: 'Reset',
  close_toolbar: 'Close toolbar',
  stop_reading: 'Stop reading',
};

global.$exe = {
  options: {
    atools: {
      modeToggler: false,
      translator: false,
      i18n: {},
    },
  },
};

// Prevent auto-init on import; tests invoke start() explicitly.
const originalJQueryReady = global.$?.fn?.ready;
if (originalJQueryReady) {
  global.$.fn.ready = function () {
    return this;
  };
}

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Now require the module to get coverage
const exeAtools = require('./exe_atools.js');

afterAll(() => {
  if (originalJQueryReady) {
    global.$.fn.ready = originalJQueryReady;
  }
});

describe('exe_atools (app/common)', () => {
  let localStorageData;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset localStorage mock data
    localStorageData = {};
    global.localStorage.getItem.mockImplementation((key) => localStorageData[key] || null);
    global.localStorage.setItem.mockImplementation((key, value) => {
      localStorageData[key] = value;
    });
    global.localStorage.removeItem.mockImplementation((key) => {
      delete localStorageData[key];
    });

    // Reset DOM
    document.body.innerHTML = '';
    document.body.className = '';
    document.body.style.cssText = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('script structure', () => {
    it('defines $exe.atools object', () => {
      expect(scriptContent).toContain('$exe.atools = {');
    });

    it('has options configuration', () => {
      expect(scriptContent).toContain('options : {');
      expect(scriptContent).toContain('draggable : true');
      expect(scriptContent).toContain('modeToggler');
      expect(scriptContent).toContain('translator');
    });

    it('has i18n strings', () => {
      expect(scriptContent).toContain('i18n : {');
      expect(scriptContent).toContain('read :');
      expect(scriptContent).toContain('translate :');
      expect(scriptContent).toContain('accessibility_tools :');
    });

    it('has storage methods', () => {
      expect(scriptContent).toContain('storage : {');
      expect(scriptContent).toContain('setOriginalFontSize');
      expect(scriptContent).toContain('getTranslatorStatus');
      expect(scriptContent).toContain('getToolbarStatus');
      expect(scriptContent).toContain('getFontSize');
      expect(scriptContent).toContain('getFontFamily');
      expect(scriptContent).toContain('getToolbarPosition');
    });

    it('has init and start methods', () => {
      expect(scriptContent).toContain('init : function()');
      expect(scriptContent).toContain('start : function()');
    });

    it('has reader functionality', () => {
      expect(scriptContent).toContain('reader : {');
      expect(scriptContent).toContain('isReading : false');
      expect(scriptContent).toContain('read : function()');
      expect(scriptContent).toContain('SpeechSynthesisUtterance');
    });

    it('has setFontSize method', () => {
      expect(scriptContent).toContain('setFontSize : function(size)');
    });

    it('has toggleGoogleTranslateWidget method', () => {
      expect(scriptContent).toContain('toggleGoogleTranslateWidget : function()');
    });

    it('has draggable functionality', () => {
      expect(scriptContent).toContain('draggable : {');
      expect(scriptContent).toContain('limit : function');
      expect(scriptContent).toContain('checkPosition : function');
      expect(scriptContent).toContain('fixPosition : function');
      expect(scriptContent).toContain('getTranslation : function');
    });

    it('includes Drog.js library', () => {
      expect(scriptContent).toContain('$exe.atools.Drog = {');
      expect(scriptContent).toContain('on: on');
      expect(scriptContent).toContain('move: move');
    });

    it('initializes on document ready', () => {
      expect(scriptContent).toContain('$(function(){');
      expect(scriptContent).toContain('$exe.atools.init()');
    });
  });

  describe('localStorage keys', () => {
    it('uses exeAtoolsTranslator key', () => {
      expect(scriptContent).toContain("'exeAtoolsTranslator'");
    });

    it('uses exeAtoolsStatus key', () => {
      expect(scriptContent).toContain("'exeAtoolsStatus'");
    });

    it('uses exeAtoolsFontSize key', () => {
      expect(scriptContent).toContain("'exeAtoolsFontSize'");
    });

    it('uses exeAtoolsFontFamily key', () => {
      expect(scriptContent).toContain("'exeAtoolsFontFamily'");
    });

    it('uses exeAtoolsToolbarStyles key', () => {
      expect(scriptContent).toContain("'exeAtoolsToolbarStyles'");
    });

    it('uses exeAtoolsMode key', () => {
      expect(scriptContent).toContain("'exeAtoolsMode'");
    });
  });

  describe('storage helpers', () => {
    it('stores the original font size from computed styles', () => {
      const original = window.getComputedStyle;
      window.getComputedStyle = vi.fn(() => ({
        getPropertyValue: () => '18px',
      }));

      exeAtools.storage.setOriginalFontSize();

      expect(exeAtools.storage.originalFontSize).toBe(18);
      window.getComputedStyle = original;
    });

    it('returns translator status based on options and storage', () => {
      exeAtools.options.translator = false;
      localStorageData.exeAtoolsTranslator = 'on';
      expect(exeAtools.storage.getTranslatorStatus()).toBe('off');

      exeAtools.options.translator = true;
      localStorageData.exeAtoolsTranslator = 'on';
      expect(exeAtools.storage.getTranslatorStatus()).toBe('on');
    });

    it('returns toolbar, font size, font family, and position settings', () => {
      localStorageData.exeAtoolsStatus = 'on';
      localStorageData.exeAtoolsFontSize = '20px';
      localStorageData.exeAtoolsFontFamily = 'od';
      localStorageData.exeAtoolsToolbarStyles = 'transform: translate(10px, 5px);';

      expect(exeAtools.storage.getToolbarStatus()).toBe('on');
      expect(exeAtools.storage.getFontSize()).toBe('20px');
      expect(exeAtools.storage.getFontFamily()).toBe('od');
      expect(exeAtools.storage.getToolbarPosition()).toBe('transform: translate(10px, 5px);');
    });
  });

  describe('font size adjustments', () => {
    it('increases font size and persists when above original size', () => {
      exeAtools.storage.originalFontSize = 16;
      document.body.style.fontSize = '';

      exeAtools.setFontSize(2);

      expect(document.body.style.fontSize).toBe('18px');
      expect(localStorageData.exeAtoolsFontSize).toBe('18px');
    });

    it('resets font size when it falls below original size', () => {
      exeAtools.storage.originalFontSize = 16;
      document.body.style.fontSize = '16px';

      const result = exeAtools.setFontSize(-1);

      expect(result).toBe(false);
      expect(document.body.style.fontSize).toBe('');
      expect(localStorageData.exeAtoolsFontSize).toBe('');
    });
  });

  describe('reset button state', () => {
    it('enables reset button when settings are active', () => {
      localStorageData.exeAtoolsTranslator = 'on';
      const resetBtn = {
        addClass: vi.fn(),
        removeClass: vi.fn(),
      };
      const original$ = global.$;
      global.$ = vi.fn(() => resetBtn);

      exeAtools.checkResetBtnStatus();

      expect(resetBtn.removeClass).toHaveBeenCalledWith('reset-disabled');
      global.$ = original$;
    });
  });

  describe('google translate toggle', () => {
    it('adds and removes translator elements and updates storage', () => {
      exeAtools.options.translator = true;
      localStorageData.exeAtoolsTranslator = 'off';
      const originalAppendChild = document.head.appendChild;
      document.head.appendChild = vi.fn((node) => node);

      exeAtools.toggleGoogleTranslateWidget();

      expect(localStorageData.exeAtoolsTranslator).toBe('on');
      expect(document.getElementById('google_translate_element')).toBeTruthy();

      const original$ = global.$;
      global.$ = vi.fn((selector) => ({
        remove: () => {
          document.querySelectorAll(selector).forEach((node) => node.remove());
        },
      }));

      exeAtools.toggleGoogleTranslateWidget();

      expect(localStorageData.exeAtoolsTranslator).toBe('off');
      expect(document.getElementById('google_translate_element')).toBeFalsy();
      global.$ = original$;
      document.head.appendChild = originalAppendChild;
    });
  });

  describe('draggable helpers', () => {
    it('limits drag position to viewport', () => {
      const original$ = global.$;
      global.$ = vi.fn((selector) => {
        if (selector === '#eXeAtoolsSet') {
          return { height: () => 100, width: () => 200 };
        }
        if (selector === window) {
          return { height: () => 300, width: () => 400 };
        }
        if (selector === 'body') {
          return { css: () => '0px' };
        }
        return original$(selector);
      });

      const limited = exeAtools.draggable.limit(500, -500);

      expect(limited[0]).toBe(200);
      expect(limited[1]).toBe(-200);
      global.$ = original$;
    });

    it('reads translation from computed matrix', () => {
      const originalMatrix = global.WebKitCSSMatrix;
      const originalComputed = window.getComputedStyle;
      global.WebKitCSSMatrix = function (transform) {
        const match = /matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([^,]+),\s*([^,]+)\)/.exec(transform);
        this.m41 = match ? Number(match[1]) : 0;
        this.m42 = match ? Number(match[2]) : 0;
      };

      const element = document.createElement('div');
      element.style.transform = 'matrix(1, 0, 0, 1, 12, 34)';
      window.getComputedStyle = vi.fn(() => ({ transform: element.style.transform }));

      const [x, y] = exeAtools.draggable.getTranslation(element);

      expect(x).toBe(12);
      expect(y).toBe(34);
      global.WebKitCSSMatrix = originalMatrix;
      window.getComputedStyle = originalComputed;
    });
  });

  describe('start behavior', () => {
    it('inserts toolbar after skipNav and restores stored settings', () => {
      const originalOptions = { ...exeAtools.options };
      const originalSpeech = global.SpeechSynthesisUtterance;
      global.SpeechSynthesisUtterance = function () {};
      exeAtools.options.draggable = false;
      exeAtools.options.translator = false;
      exeAtools.options.modeToggler = false;

      const skipNav = document.createElement('div');
      skipNav.id = 'skipNav';
      document.body.classList.add('exe-web-site');
      document.body.appendChild(skipNav);

      localStorageData.exeAtoolsStatus = 'on';
      localStorageData.exeAtoolsFontSize = '18px';
      localStorageData.exeAtoolsFontFamily = 'od';

      exeAtools.start();

      expect(skipNav.nextElementSibling?.id).toBe('eXeAtools');
      expect(document.body.classList.contains('exe-atools-on')).toBe(true);
      expect(document.body.style.fontSize).toBe('18px');
      expect(document.body.classList.contains('exe-atools-od')).toBe(true);
      expect(document.getElementById('eXeAtools').classList.contains('loading')).toBe(false);

      global.SpeechSynthesisUtterance = originalSpeech;
      Object.assign(exeAtools.options, originalOptions);
    });

    it('restores translator status by toggling widget', () => {
      const originalOptions = { ...exeAtools.options };
      const originalAppendChild = document.head.appendChild;
      document.head.appendChild = vi.fn((node) => node);
      exeAtools.options.draggable = false;
      exeAtools.options.translator = true;

      localStorageData.exeAtoolsTranslator = 'on';

      exeAtools.start();

      expect(localStorageData.exeAtoolsTranslator).toBe('on');
      expect(document.getElementById('google_translate_element')).toBeTruthy();

      document.head.appendChild = originalAppendChild;
      Object.assign(exeAtools.options, originalOptions);
    });

    it('applies saved toolbar styles and uses draggable hooks', () => {
      const originalOptions = { ...exeAtools.options };
      const originalDrogOn = exeAtools.Drog.on;
      const originalFixPosition = exeAtools.draggable.fixPosition;
      exeAtools.options.draggable = true;
      exeAtools.Drog.on = vi.fn();
      exeAtools.draggable.fixPosition = vi.fn();

      localStorageData.exeAtoolsToolbarStyles = 'transform: translate(10px, -5px);';

      exeAtools.start();

      const handler = document.getElementById('eXeAtoolsSet');
      expect(handler.style.cssText).toContain('translate(10px, -5px)');
      expect(exeAtools.Drog.on).toHaveBeenCalledWith(handler);
      expect(exeAtools.draggable.fixPosition).toHaveBeenCalledWith(handler);

      Object.assign(exeAtools.options, originalOptions);
      exeAtools.Drog.on = originalDrogOn;
      exeAtools.draggable.fixPosition = originalFixPosition;
    });
  });

  describe('setEvents behavior', () => {
    it('toggles toolbar visibility and reminder class', () => {
      const originalOptions = { ...exeAtools.options };
      exeAtools.options.draggable = false;
      exeAtools.options.modeToggler = false;
      exeAtools.options.translator = false;

      exeAtools.start();
      vi.useFakeTimers();

      const button = document.getElementById('eXeAtoolsBtn');
      button.click();

      expect(document.body.classList.contains('exe-atools-on')).toBe(true);
      expect(localStorageData.exeAtoolsStatus).toBe('on');

      button.click();

      expect(document.body.classList.contains('exe-atools-on')).toBe(false);
      expect(localStorageData.exeAtoolsStatus).toBe('off');
      expect(button.classList.contains('eXeAreminder')).toBe(true);

      vi.advanceTimersByTime(1000);
      expect(button.classList.contains('eXeAreminder')).toBe(false);

      vi.useRealTimers();
      Object.assign(exeAtools.options, originalOptions);
    });

    it('updates font family on selector change', () => {
      const originalOptions = { ...exeAtools.options };
      exeAtools.options.draggable = false;

      exeAtools.start();

      const selector = document.getElementById('eXeAtoolsFont');
      selector.value = 'ah';
      selector.dispatchEvent(new Event('change', { bubbles: true }));

      expect(document.body.classList.contains('exe-atools-ah')).toBe(true);
      expect(localStorageData.exeAtoolsFontFamily).toBe('ah');

      Object.assign(exeAtools.options, originalOptions);
    });

    it('toggles dark mode via mode toggler', () => {
      const originalOptions = { ...exeAtools.options };
      exeAtools.options.draggable = false;
      exeAtools.options.modeToggler = true;

      exeAtools.start();

      const toggler = document.getElementById('eXeAtoolsModeToggler');
      toggler.click();

      expect(document.body.classList.contains('exe-atools-dm')).toBe(true);
      expect(localStorageData.exeAtoolsMode).toBe('dark');

      toggler.click();

      expect(document.body.classList.contains('exe-atools-dm')).toBe(false);
      expect(localStorageData.exeAtoolsMode).toBe('');

      Object.assign(exeAtools.options, originalOptions);
    });

    it('handles resize by checking draggable position', () => {
      const originalOptions = { ...exeAtools.options };
      const originalCheckPosition = exeAtools.draggable.checkPosition;
      const originalFixPosition = exeAtools.draggable.fixPosition;
      exeAtools.options.draggable = true;
      exeAtools.options.translator = false;
      exeAtools.options.modeToggler = false;
      exeAtools.draggable.checkPosition = vi.fn();
      exeAtools.draggable.fixPosition = vi.fn();

      exeAtools.start();
      window.dispatchEvent(new Event('resize'));

      expect(exeAtools.draggable.checkPosition).toHaveBeenCalled();

      Object.assign(exeAtools.options, originalOptions);
      exeAtools.draggable.checkPosition = originalCheckPosition;
      exeAtools.draggable.fixPosition = originalFixPosition;
    });
  });

  describe('button actions', () => {
    it('invokes font size handlers from toolbar buttons', () => {
      const originalOptions = { ...exeAtools.options };
      const originalSetFontSize = exeAtools.setFontSize;
      const originalCheckReset = exeAtools.checkResetBtnStatus;
      exeAtools.options.draggable = false;
      exeAtools.setFontSize = vi.fn();
      exeAtools.checkResetBtnStatus = vi.fn();

      exeAtools.start();
      exeAtools.checkResetBtnStatus.mockClear();

      document.getElementById('eXeAtoolsLgTextBtn').click();
      document.getElementById('eXeAtoolsSmTextBtn').click();

      expect(exeAtools.setFontSize).toHaveBeenCalledWith(1);
      expect(exeAtools.setFontSize).toHaveBeenCalledWith(-1);
      expect(exeAtools.checkResetBtnStatus).toHaveBeenCalledTimes(2);

      Object.assign(exeAtools.options, originalOptions);
      exeAtools.setFontSize = originalSetFontSize;
      exeAtools.checkResetBtnStatus = originalCheckReset;
    });

    it('invokes translate button toggle and reset status', () => {
      const originalOptions = { ...exeAtools.options };
      const originalToggle = exeAtools.toggleGoogleTranslateWidget;
      const originalCheckReset = exeAtools.checkResetBtnStatus;
      exeAtools.options.translator = true;
      exeAtools.options.draggable = false;
      exeAtools.toggleGoogleTranslateWidget = vi.fn();
      exeAtools.checkResetBtnStatus = vi.fn();

      exeAtools.start();

      document.getElementById('eXeAtoolsTranslateBtn').click();

      expect(exeAtools.toggleGoogleTranslateWidget).toHaveBeenCalled();
      expect(exeAtools.checkResetBtnStatus).toHaveBeenCalled();

      Object.assign(exeAtools.options, originalOptions);
      exeAtools.toggleGoogleTranslateWidget = originalToggle;
      exeAtools.checkResetBtnStatus = originalCheckReset;
    });

    it('resets styles and toggles translator on reset button click', () => {
      const originalOptions = { ...exeAtools.options };
      const originalToggle = exeAtools.toggleGoogleTranslateWidget;
      exeAtools.options.translator = true;
      exeAtools.options.draggable = false;
      exeAtools.toggleGoogleTranslateWidget = vi.fn();

      localStorageData.exeAtoolsTranslator = 'on';

      exeAtools.start();

      const resetBtn = document.getElementById('eXeAtoolsResetBtn');
      resetBtn.className = '';
      document.body.style.fontSize = '19px';
      document.body.classList.add('exe-atools-od');

      resetBtn.click();

      expect(document.body.style.fontSize).toBe('');
      expect(localStorageData.exeAtoolsFontSize).toBe('');
      expect(localStorageData.exeAtoolsFontFamily).toBe('');
      expect(exeAtools.toggleGoogleTranslateWidget).toHaveBeenCalled();

      Object.assign(exeAtools.options, originalOptions);
      exeAtools.toggleGoogleTranslateWidget = originalToggle;
    });

    it('does nothing when reset button is disabled', () => {
      const originalOptions = { ...exeAtools.options };
      exeAtools.options.draggable = false;

      exeAtools.start();

      const resetBtn = document.getElementById('eXeAtoolsResetBtn');
      resetBtn.className = 'reset-disabled';
      document.body.style.fontSize = '19px';

      resetBtn.click();

      expect(document.body.style.fontSize).toBe('19px');

      Object.assign(exeAtools.options, originalOptions);
    });
  });

  describe('reader behavior', () => {
    it('reads selected text and toggles speaking state', () => {
      const originalSelection = window.getSelection;
      const originalSpeech = global.SpeechSynthesisUtterance;
      const originalSpeechSynthesis = global.speechSynthesis;
      const selectedNode = document.createElement('span');
      selectedNode.setAttribute('lang', 'es');

      const readBtn = document.createElement('button');
      readBtn.id = 'eXeAtoolsReadBtn';
      document.body.appendChild(readBtn);

      window.getSelection = vi.fn(() => ({
        toString: () => 'Hola',
        anchorNode: selectedNode,
      }));
      global.SpeechSynthesisUtterance = function () {
        this.addEventListener = vi.fn((event, cb) => {
          if (event === 'end') this._onEnd = cb;
        });
      };
      global.speechSynthesis = {
        speak: vi.fn(),
        cancel: vi.fn(),
      };

      exeAtools.reader.isReading = false;
      exeAtools.reader.read();

      expect(exeAtools.reader.isReading).toBe(true);
      expect(global.speechSynthesis.speak).toHaveBeenCalled();

      exeAtools.reader.read();

      expect(exeAtools.reader.isReading).toBe(false);
      expect(global.speechSynthesis.cancel).toHaveBeenCalled();

      window.getSelection = originalSelection;
      global.SpeechSynthesisUtterance = originalSpeech;
      global.speechSynthesis = originalSpeechSynthesis;
    });

    it('uses page text when no selection is present', () => {
      const originalSelection = window.getSelection;
      const originalSpeech = global.SpeechSynthesisUtterance;
      const originalSpeechSynthesis = global.speechSynthesis;

      const page = document.createElement('div');
      page.className = 'page';
      page.innerText = 'Page content';
      document.body.appendChild(page);

      window.getSelection = vi.fn(() => ({
        toString: () => '',
        anchorNode: null,
      }));
      global.SpeechSynthesisUtterance = function () {
        this.addEventListener = vi.fn();
      };
      global.speechSynthesis = {
        speak: vi.fn(),
        cancel: vi.fn(),
      };

      exeAtools.reader.isReading = false;
      exeAtools.reader.read();

      expect(global.speechSynthesis.speak).toHaveBeenCalled();

      window.getSelection = originalSelection;
      global.SpeechSynthesisUtterance = originalSpeech;
      global.speechSynthesis = originalSpeechSynthesis;
    });

    it('returns early when no text is available', () => {
      const originalSelection = window.getSelection;
      const originalSpeech = global.SpeechSynthesisUtterance;
      const originalSpeechSynthesis = global.speechSynthesis;

      window.getSelection = vi.fn(() => ({
        toString: () => '',
        anchorNode: null,
      }));
      global.SpeechSynthesisUtterance = function () {
        this.addEventListener = vi.fn();
      };
      global.speechSynthesis = {
        speak: vi.fn(),
        cancel: vi.fn(),
      };

      exeAtools.reader.isReading = false;
      exeAtools.reader.read();

      expect(global.speechSynthesis.speak).not.toHaveBeenCalled();

      window.getSelection = originalSelection;
      global.SpeechSynthesisUtterance = originalSpeech;
      global.speechSynthesis = originalSpeechSynthesis;
    });
  });

  describe('Drog interactions', () => {
    it('marks element as draggable and ignores repeat init', () => {
      const element = document.createElement('div');
      const handler = document.createElement('button');
      handler.setAttribute('data-drog', '');
      element.appendChild(handler);

      exeAtools.Drog.on(element);
      exeAtools.Drog.on(element);

      expect(element['-d']).toBe(true);
      expect(handler['-f']).toBe(element);
    });

    it('ignores move when element is not draggable', () => {
      const element = document.createElement('div');

      exeAtools.Drog.move(element, 10, 5);

      expect(element.style.transform).toBe('');
    });

    it('moves element when draggable', () => {
      const element = document.createElement('div');
      element['-d'] = true;

      exeAtools.Drog.move(element, 12, -7);

      expect(element.style.transform).toBe('translate(12px,-7px)');
    });

    it('handles drag move and stores toolbar position', () => {
      const element = document.createElement('div');
      const handler = document.createElement('button');
      handler.setAttribute('data-drog', '');
      element.appendChild(handler);

      const originalLimit = exeAtools.draggable.limit;
      exeAtools.draggable.limit = vi.fn(() => [10, -5]);

      exeAtools.Drog.on(element);
      const down = new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true });
      Object.defineProperty(down, 'which', { value: 1 });
      handler.dispatchEvent(down);

      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 30, bubbles: true }));

      expect(element.style.transform).toBe('translate(10px,-5px)');
      expect(localStorageData.exeAtoolsToolbarStyles).toContain('translate(10px,-5px)');

      exeAtools.draggable.limit = originalLimit;
    });

    it('clears toolbar styles when dragged back to origin', () => {
      const element = document.createElement('div');
      const handler = document.createElement('button');
      handler.setAttribute('data-drog', '');
      element.appendChild(handler);

      const originalLimit = exeAtools.draggable.limit;
      exeAtools.draggable.limit = vi.fn(() => [0, 0]);

      exeAtools.Drog.on(element);
      const down = new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true });
      Object.defineProperty(down, 'which', { value: 1 });
      handler.dispatchEvent(down);

      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 15, clientY: 15, bubbles: true }));

      expect(localStorageData.exeAtoolsToolbarStyles).toBe('');

      exeAtools.draggable.limit = originalLimit;
    });

    it('ignores middle and right click drag initiation', () => {
      const element = document.createElement('div');
      const handler = document.createElement('button');
      handler.setAttribute('data-drog', '');
      element.appendChild(handler);

      exeAtools.Drog.on(element);
      const down = new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true });
      Object.defineProperty(down, 'which', { value: 2 });
      handler.dispatchEvent(down);

      expect(element['-Xi']).toBeUndefined();
    });
  });

  describe('draggable behavior', () => {
    it('stores constrained position on checkPosition', () => {
      document.body.classList.add('exe-atools-on');

      const handler = document.createElement('div');
      handler.id = 'eXeAtoolsSet';
      document.body.appendChild(handler);

      const originalGetTranslation = exeAtools.draggable.getTranslation;
      const originalLimit = exeAtools.draggable.limit;
      exeAtools.draggable.getTranslation = vi.fn(() => [20, -10]);
      exeAtools.draggable.limit = vi.fn(() => [5, -5]);

      exeAtools.draggable.checkPosition();

      expect(handler.style.cssText).toContain('translate(5px, -5px)');
      expect(localStorageData.exeAtoolsToolbarStyles).toContain('translate(5px, -5px)');

      exeAtools.draggable.getTranslation = originalGetTranslation;
      exeAtools.draggable.limit = originalLimit;
    });

    it('clears toolbar style when position resets to origin', () => {
      document.body.classList.add('exe-atools-on');

      const handler = document.createElement('div');
      handler.id = 'eXeAtoolsSet';
      handler.style.transform = 'translate(3px, -3px)';
      document.body.appendChild(handler);

      const originalGetTranslation = exeAtools.draggable.getTranslation;
      const originalLimit = exeAtools.draggable.limit;
      exeAtools.draggable.getTranslation = vi.fn(() => [10, -10]);
      exeAtools.draggable.limit = vi.fn(() => [0, 0]);

      exeAtools.draggable.checkPosition();

      expect(localStorageData.exeAtoolsToolbarStyles).toBe('');

      exeAtools.draggable.getTranslation = originalGetTranslation;
      exeAtools.draggable.limit = originalLimit;
    });

    it('calls Drog.move when fixPosition has translation', () => {
      const originalMove = exeAtools.Drog.move;
      const originalGetTranslation = exeAtools.draggable.getTranslation;
      exeAtools.Drog.move = vi.fn();
      exeAtools.draggable.getTranslation = vi.fn(() => [12, -8]);

      const handler = document.createElement('div');
      exeAtools.draggable.fixPosition(handler);

      expect(exeAtools.Drog.move).toHaveBeenCalledWith(handler, 12, -8);

      exeAtools.Drog.move = originalMove;
      exeAtools.draggable.getTranslation = originalGetTranslation;
    });
  });

  describe('toolbar HTML structure', () => {
    it('creates eXeAtools container', () => {
      expect(scriptContent).toContain('id="eXeAtools"');
    });

    it('creates toolbar button', () => {
      expect(scriptContent).toContain('id="eXeAtoolsBtn"');
      expect(scriptContent).toContain('id="eXeAtoolsBtnSet"');
    });

    it('creates toolbar set container', () => {
      expect(scriptContent).toContain('id="eXeAtoolsSet"');
    });

    it('creates font selector', () => {
      expect(scriptContent).toContain('id="eXeAtoolsFont"');
      expect(scriptContent).toContain('value="od"');
      expect(scriptContent).toContain('OpenDyslexic');
      expect(scriptContent).toContain('value="ah"');
      expect(scriptContent).toContain('Atkinson Hyperlegible');
      expect(scriptContent).toContain('value="mo"');
      expect(scriptContent).toContain('Montserrat');
    });

    it('creates size buttons', () => {
      expect(scriptContent).toContain('id="eXeAtoolsLgTextBtn"');
      expect(scriptContent).toContain('id="eXeAtoolsSmTextBtn"');
    });

    it('creates reset button', () => {
      expect(scriptContent).toContain('id="eXeAtoolsResetBtn"');
    });

    it('creates close button', () => {
      expect(scriptContent).toContain('id="eXeAtoolsCloseBtn"');
    });

    it('creates read button conditionally', () => {
      expect(scriptContent).toContain('id="eXeAtoolsReadBtn"');
      expect(scriptContent).toContain("typeof(SpeechSynthesisUtterance)==\"function\"");
    });

    it('creates translate button conditionally', () => {
      expect(scriptContent).toContain('id="eXeAtoolsTranslateBtn"');
      expect(scriptContent).toContain('opts.translator==true');
    });

    it('creates drag button conditionally', () => {
      expect(scriptContent).toContain('id="eXeAtoolsSetDragHandler"');
      expect(scriptContent).toContain('opts.draggable==true');
    });

    it('creates mode toggler button conditionally', () => {
      expect(scriptContent).toContain('id="eXeAtoolsModeToggler"');
      expect(scriptContent).toContain('opts.modeToggler==true');
    });
  });

  describe('CSS class management', () => {
    it('uses exe-atools-on class for toolbar visibility', () => {
      expect(scriptContent).toContain('"exe-atools-on"');
      expect(scriptContent).toContain('exe-atools-on');
    });

    it('uses font family classes', () => {
      // Classes are built dynamically with "exe-atools-"+v where v is od, ah, or mo
      expect(scriptContent).toContain('"exe-atools-"+');
      expect(scriptContent).toContain('"od"');
      expect(scriptContent).toContain('"ah"');
      expect(scriptContent).toContain('"mo"');
    });

    it('uses dark mode class', () => {
      expect(scriptContent).toContain('"exe-atools-dm"');
    });

    it('uses loading class', () => {
      expect(scriptContent).toContain('"loading"');
      expect(scriptContent).toContain('.removeClass("loading")');
    });

    it('uses reset-disabled class', () => {
      expect(scriptContent).toContain('"reset-disabled"');
    });

    it('uses eXeAreminder class for animation', () => {
      expect(scriptContent).toContain('"eXeAreminder"');
    });

    it('uses eXeAtoolsReading class for reader state', () => {
      expect(scriptContent).toContain('"eXeAtoolsReading"');
    });
  });

  describe('event handlers', () => {
    it('handles toolbar toggle click', () => {
      expect(scriptContent).toContain('$("#eXeAtoolsBtn,#eXeAtoolsCloseBtn").click');
    });

    it('handles font change', () => {
      expect(scriptContent).toContain('$("#eXeAtoolsFont").change');
    });

    it('handles increase text size click', () => {
      expect(scriptContent).toContain('$("#eXeAtoolsLgTextBtn").click');
      expect(scriptContent).toContain('$exe.atools.setFontSize(1)');
    });

    it('handles decrease text size click', () => {
      expect(scriptContent).toContain('$("#eXeAtoolsSmTextBtn").click');
      expect(scriptContent).toContain('$exe.atools.setFontSize(-1)');
    });

    it('handles translate button click', () => {
      expect(scriptContent).toContain('$("#eXeAtoolsTranslateBtn").click');
      expect(scriptContent).toContain('$exe.atools.toggleGoogleTranslateWidget()');
    });

    it('handles read button click', () => {
      expect(scriptContent).toContain('$("#eXeAtoolsReadBtn").click');
      expect(scriptContent).toContain('$exe.atools.reader.read()');
    });

    it('handles reset button click', () => {
      expect(scriptContent).toContain('$("#eXeAtoolsResetBtn").click');
    });

    it('handles mode toggler click', () => {
      expect(scriptContent).toContain('$("#eXeAtoolsModeToggler").click');
    });

    it('handles window resize for draggable', () => {
      expect(scriptContent).toContain('$(window).on("resize"');
      expect(scriptContent).toContain('$exe.atools.draggable.checkPosition()');
    });
  });

  describe('storage.getTranslatorStatus', () => {
    it('returns off when translator option is disabled', () => {
      expect(scriptContent).toContain('if (opts.translator!==true) return "off"');
    });

    it('reads from localStorage', () => {
      expect(scriptContent).toContain("localStorage.getItem('exeAtoolsTranslator')");
    });

    it('returns on when localStorage value is on', () => {
      expect(scriptContent).toContain('if (e==="on") return "on"');
    });

    it('returns off as default', () => {
      expect(scriptContent).toContain('return "off"');
    });
  });

  describe('storage.getToolbarStatus', () => {
    it('reads from localStorage', () => {
      expect(scriptContent).toContain("localStorage.getItem('exeAtoolsStatus')");
    });
  });

  describe('storage.getFontSize', () => {
    it('reads from localStorage', () => {
      expect(scriptContent).toContain("localStorage.getItem('exeAtoolsFontSize')");
    });

    it('returns empty string as default', () => {
      expect(scriptContent).toContain('return ""');
    });
  });

  describe('storage.getFontFamily', () => {
    it('reads from localStorage', () => {
      expect(scriptContent).toContain("localStorage.getItem('exeAtoolsFontFamily')");
    });
  });

  describe('setFontSize logic', () => {
    it('gets current font size from body style', () => {
      expect(scriptContent).toContain('document.body.style.fontSize');
    });

    it('uses original font size when NaN', () => {
      expect(scriptContent).toContain('if (isNaN(currentFontSize))');
      expect(scriptContent).toContain('$exe.atools.storage.originalFontSize');
    });

    it('prevents font size below original', () => {
      expect(scriptContent).toContain('if (currentFontSize<=$exe.atools.storage.originalFontSize)');
    });

    it('saves font size to localStorage', () => {
      expect(scriptContent).toContain("localStorage.setItem('exeAtoolsFontSize'");
    });
  });

  describe('reader functionality', () => {
    it('creates SpeechSynthesisUtterance', () => {
      expect(scriptContent).toContain('new SpeechSynthesisUtterance()');
    });

    it('uses window.getSelection for selected text', () => {
      expect(scriptContent).toContain('window.getSelection().toString()');
    });

    it('gets language from document or selection', () => {
      expect(scriptContent).toContain('document.documentElement.lang');
      expect(scriptContent).toContain("getAttribute('lang')");
    });

    it('reads from page div when no selection', () => {
      expect(scriptContent).toContain('$("div.page")');
      expect(scriptContent).toContain('mainWrapper.innerText');
    });

    it('toggles reading state', () => {
      expect(scriptContent).toContain('$exe.atools.reader.isReading');
      expect(scriptContent).toContain('speechSynthesis.speak');
      expect(scriptContent).toContain('speechSynthesis.cancel');
    });

    it('handles end event', () => {
      expect(scriptContent).toContain("addEventListener('end'");
    });
  });

  describe('Google Translate integration', () => {
    it('loads Google Translate script', () => {
      expect(scriptContent).toContain('translate.google.com/translate_a/element.js');
    });

    it('creates translate element div', () => {
      expect(scriptContent).toContain("googleTranslateElement.id = 'google_translate_element'");
    });

    it('defines googleTranslateElementInit', () => {
      expect(scriptContent).toContain('window.googleTranslateElementInit');
      expect(scriptContent).toContain('google.translate.TranslateElement');
    });

    it('removes translate elements when toggling off', () => {
      expect(scriptContent).toContain('$("#google-translate-script,#google_translate_element,.skiptranslate").remove()');
    });
  });

  describe('Drog.js integration', () => {
    it('defines Drog object', () => {
      expect(scriptContent).toContain('$exe.atools.Drog');
    });

    it('has on method for enabling drag', () => {
      expect(scriptContent).toContain('on: on');
      expect(scriptContent).toContain('function on(element)');
    });

    it('has move method', () => {
      expect(scriptContent).toContain('move: move');
      expect(scriptContent).toContain('function move(element, x, y)');
    });

    it('handles mousedown and touchstart', () => {
      expect(scriptContent).toContain("mousedown = 'mousedown'");
      expect(scriptContent).toContain("touchstart = 'touchstart'");
      expect(scriptContent).toContain('addEvent(target, mousedown, drogInit)');
      expect(scriptContent).toContain('addEvent(target, touchstart, drogInit, passive)');
    });

    it('handles mousemove and touchmove', () => {
      expect(scriptContent).toContain("mousemove = 'mousemove'");
      expect(scriptContent).toContain("touchmove = 'touchmove'");
    });

    it('handles mouseup and touchend', () => {
      expect(scriptContent).toContain("mouseup = 'mouseup'");
      expect(scriptContent).toContain("touchend = 'touchend'");
    });

    it('uses data-drog attribute', () => {
      expect(scriptContent).toContain("data = '[data-drog]'");
    });

    it('prevents right and middle click', () => {
      expect(scriptContent).toContain('e.which === 2 || e.which === 3');
    });

    it('uses transform for positioning', () => {
      expect(scriptContent).toContain("'translate(' + x + 'px,' + y + 'px)'");
    });

    it('integrates with draggable.limit', () => {
      expect(scriptContent).toContain('$exe.atools.draggable.limit(elmnt[Xt],elmnt[Yt])');
    });
  });

  describe('draggable.limit', () => {
    it('calculates max boundaries', () => {
      expect(scriptContent).toContain('$(window).height()');
      expect(scriptContent).toContain('$(window).width()');
    });

    it('handles body top offset for translate bar', () => {
      expect(scriptContent).toContain('if (bodyT=="40px")');
      expect(scriptContent).toContain('maxTop = maxTop-40');
    });

    it('constrains x position', () => {
      expect(scriptContent).toContain('if (x>maxLeft) x = maxLeft');
      expect(scriptContent).toContain('else if (x<0) x = 0');
    });

    it('constrains y position', () => {
      expect(scriptContent).toContain('if (-y>maxTop) y = -maxTop');
      expect(scriptContent).toContain('else if (y>0) y = 0');
    });
  });

  describe('draggable.getTranslation', () => {
    it('uses computed style', () => {
      expect(scriptContent).toContain('window.getComputedStyle(e)');
    });

    it('uses WebKitCSSMatrix', () => {
      expect(scriptContent).toContain('new WebKitCSSMatrix(style.transform)');
    });

    it('extracts m41 and m42 values', () => {
      expect(scriptContent).toContain('matrix.m41');
      expect(scriptContent).toContain('matrix.m42');
    });
  });

  describe('init method', () => {
    it('checks localStorage availability', () => {
      expect(scriptContent).toContain("if (typeof(localStorage)=='undefined') return");
    });

    it('allows custom i18n strings', () => {
      expect(scriptContent).toContain('var strs = $exe.options.atools.i18n');
      expect(scriptContent).toContain('$exe.atools.i18n[i] = strs[i]');
    });

    it('calls start method', () => {
      expect(scriptContent).toContain('this.start()');
    });

    it('overrides i18n strings from options', () => {
      const originalOptions = { ...$exe.options.atools };
      const originalStart = exeAtools.start;
      exeAtools.start = vi.fn();

      $exe.options.atools.i18n = { read: 'Leer' };
      exeAtools.init();

      expect(exeAtools.i18n.read).toBe('Leer');

      exeAtools.start = originalStart;
      $exe.options.atools = originalOptions;
    });
  });

  describe('start method', () => {
    it('sets original font size', () => {
      expect(scriptContent).toContain('$exe.atools.storage.setOriginalFontSize()');
    });

    it('inserts toolbar after skipNav or prepends to body', () => {
      expect(scriptContent).toContain('$("#skipNav")');
      expect(scriptContent).toContain('skipNav.after(html)');
      expect(scriptContent).toContain('$("body").prepend(html)');
    });

    it('sets button titles and sr-av spans', () => {
      expect(scriptContent).toContain('this.title = this.innerHTML');
      expect(scriptContent).toContain('class="sr-av"');
    });

    it('calls setEvents', () => {
      expect(scriptContent).toContain('this.setEvents()');
    });

    it('restores font size from storage', () => {
      expect(scriptContent).toContain('$exe.atools.storage.getFontSize()');
      expect(scriptContent).toContain('document.body.style.fontSize = $exe.atools.storage.getFontSize()');
    });

    it('restores font family from storage', () => {
      expect(scriptContent).toContain('$exe.atools.storage.getFontFamily()');
      expect(scriptContent).toContain('$("#eXeAtoolsFont").val(');
    });

    it('restores translator status', () => {
      expect(scriptContent).toContain('$exe.atools.storage.getTranslatorStatus()');
    });

    it('makes toolbar draggable', () => {
      expect(scriptContent).toContain('$exe.atools.Drog.on(handler)');
      expect(scriptContent).toContain('$exe.atools.draggable.fixPosition(handler)');
    });
  });

  describe('checkResetBtnStatus', () => {
    it('checks translator status', () => {
      expect(scriptContent).toContain('$exe.atools.storage.getTranslatorStatus()=="on"');
    });

    it('checks font size', () => {
      expect(scriptContent).toContain('$exe.atools.storage.getFontSize()!=""');
    });

    it('checks font family', () => {
      expect(scriptContent).toContain('$exe.atools.storage.getFontFamily()!=""');
    });

    it('toggles reset-disabled class', () => {
      expect(scriptContent).toContain('btn.removeClass("reset-disabled")');
      expect(scriptContent).toContain('btn.addClass("reset-disabled")');
    });
  });

  describe('reset button behavior', () => {
    it('returns false when disabled', () => {
      expect(scriptContent).toContain('if (this.className=="reset-disabled") return false');
    });

    it('clears font size', () => {
      expect(scriptContent).toContain('document.body.style.fontSize=""');
      expect(scriptContent).toContain("localStorage.setItem('exeAtoolsFontSize', '')");
    });

    it('clears font family', () => {
      expect(scriptContent).toContain('$("#eXeAtoolsFont").val("").trigger("change")');
      expect(scriptContent).toContain("localStorage.setItem('exeAtoolsFontFamily', '')");
    });

    it('turns off translator if on', () => {
      expect(scriptContent).toContain(
        'if($exe.atools.storage.getTranslatorStatus()=="on") $exe.atools.toggleGoogleTranslateWidget()'
      );
    });
  });

  describe('mode toggler behavior', () => {
    it('toggles exe-atools-dm class', () => {
      expect(scriptContent).toContain('var c = "exe-atools-dm"');
      expect(scriptContent).toContain('b.removeClass(c)');
      expect(scriptContent).toContain('b.addClass(c)');
    });

    it('saves mode to localStorage', () => {
      expect(scriptContent).toContain("localStorage.setItem('exeAtoolsMode', \"\")");
      expect(scriptContent).toContain("localStorage.setItem('exeAtoolsMode', 'dark')");
    });
  });

  describe('font family handling', () => {
    it('defines font codes array', () => {
      expect(scriptContent).toContain('"od"');
      expect(scriptContent).toContain('"ah"');
      expect(scriptContent).toContain('"mo"');
    });

    it('removes all font classes before adding new one', () => {
      expect(scriptContent).toContain('$("body").removeClass("exe-atools-"+fonts[i])');
    });

    it('adds font class when value is not empty', () => {
      expect(scriptContent).toContain('$("body").addClass("exe-atools-"+v)');
    });

    it('saves font family to localStorage', () => {
      expect(scriptContent).toContain("localStorage.setItem('exeAtoolsFontFamily',v)");
    });
  });

  describe('script execution', () => {
    it('exports $exe.atools with expected structure', () => {
      // Verify the module was loaded and $exe.atools was created
      expect(exeAtools).toBeDefined();
      expect(typeof exeAtools.init).toBe('function');
      expect(typeof exeAtools.start).toBe('function');
      expect(typeof exeAtools.storage).toBe('object');
      expect(typeof exeAtools.reader).toBe('object');
      expect(typeof exeAtools.draggable).toBe('object');
      expect(typeof exeAtools.Drog).toBe('object');
    });
  });

  describe('accessibility features', () => {
    it('uses sr-av class for screen reader text', () => {
      expect(scriptContent).toContain('class="sr-av"');
    });

    it('provides title attributes for buttons', () => {
      expect(scriptContent).toContain('this.title = this.innerHTML');
    });

    it('uses label for font selector', () => {
      expect(scriptContent).toContain('label for="eXeAtoolsFont"');
    });

    it('includes heading for accessibility', () => {
      expect(scriptContent).toContain('<h2 class="sr-av">');
    });
  });

  describe('touch support', () => {
    it('sets touch-action none for drag target', () => {
      expect(scriptContent).toContain('target.style.touchAction = "none"');
    });

    it('uses passive option for touch events', () => {
      expect(scriptContent).toContain('passive = { passive: false }');
    });

    it('handles targetTouches for touch coordinates', () => {
      expect(scriptContent).toContain('e.targetTouches[0].clientX');
      expect(scriptContent).toContain('e.targetTouches[0].clientY');
    });
  });
});
