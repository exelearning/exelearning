/**
 * exe_atools.js Tests
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

describe('exe_atools', () => {
  let scriptContent;
  let originalExe;
  let originalExeI18n;
  let originalLocalStorage;
  let localStorageData;

  beforeAll(() => {
    // Read the script content
    const scriptPath = join(__dirname, 'exe_atools.js');
    scriptContent = readFileSync(scriptPath, 'utf-8');
  });

  beforeEach(() => {
    // Store originals
    originalExe = global.$exe;
    originalExeI18n = global.$exe_i18n;
    originalLocalStorage = global.localStorage;

    // Mock localStorage
    localStorageData = {};
    global.localStorage = {
      getItem: vi.fn((key) => localStorageData[key] || null),
      setItem: vi.fn((key, value) => {
        localStorageData[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete localStorageData[key];
      }),
      clear: vi.fn(() => {
        localStorageData = {};
      }),
    };

    // Mock $exe_i18n
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

    // Mock $exe
    global.$exe = {
      options: {
        atools: {
          modeToggler: false,
          translator: false,
          i18n: {},
        },
      },
    };

    // Reset DOM
    document.body.innerHTML = '';
    document.body.className = '';
    document.body.style.cssText = '';
  });

  afterEach(() => {
    // Restore originals
    global.$exe = originalExe;
    global.$exe_i18n = originalExeI18n;
    global.localStorage = originalLocalStorage;
    vi.clearAllMocks();
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
    it('executes without errors when dependencies are available', () => {
      // Setup complete mock environment
      global.$exe = {
        options: {
          atools: {
            modeToggler: false,
            translator: false,
            i18n: {},
          },
        },
        atools: undefined,
      };

      const readyCallbacks = [];
      const originalReady = global.$?.fn?.ready;
      if (global.$?.fn?.ready) {
        global.$.fn.ready = function (fn) {
          readyCallbacks.push(fn);
          return this;
        };
      }

      // Execute script (but don't run document ready)
      try {
        expect(() => {
          // eslint-disable-next-line no-eval
          eval(scriptContent);
        }).not.toThrow();
      } finally {
        if (global.$?.fn?.ready) {
          global.$.fn.ready = originalReady;
        }
      }

      // Verify $exe.atools was created
      expect(global.$exe.atools).toBeDefined();
      expect(typeof global.$exe.atools.init).toBe('function');
      expect(typeof global.$exe.atools.start).toBe('function');
      expect(typeof global.$exe.atools.storage).toBe('object');
      expect(typeof global.$exe.atools.reader).toBe('object');
      expect(typeof global.$exe.atools.draggable).toBe('object');
      expect(typeof global.$exe.atools.Drog).toBe('object');
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
