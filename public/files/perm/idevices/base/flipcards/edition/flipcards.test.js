/**
 * Unit tests for flipcards iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - escapeHtml: HTML character escaping
 * - validTime: Time format validation
 * - removeTags: HTML tag removal (with mocked jQuery)
 * - getCardDefault: Default card object structure
 * - placeImageWindows: Image dimension calculations (with mocked jQuery)
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load iDevice file and expose $exeDevice globally.
 * Replaces 'var $exeDevice' with 'global.$exeDevice' to make it accessible.
 */
function loadIdevice(code) {
  // Replace 'var $exeDevice' with 'global.$exeDevice' anywhere in the code
  const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
  // Execute the modified code using eval in global context
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  // The edition scripts register their timers, handlers and disposers through
  // `this.$lifecycle`, exactly as IdeviceNode provides it in the workarea.
  global.attachEditionLifecycle(global.$exeDevice);
  return global.$exeDevice;
}

describe('flipcards iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'flipcards.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect($exeDevice.escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('escapes less than', () => {
      expect($exeDevice.escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('escapes greater than', () => {
      expect($exeDevice.escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('escapes double quotes', () => {
      expect($exeDevice.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect($exeDevice.escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes multiple special characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      expect($exeDevice.escapeHtml(input)).toBe(expected);
    });

    it('returns empty string for empty input', () => {
      expect($exeDevice.escapeHtml('')).toBe('');
    });
  });

  describe('validTime', () => {
    it('returns true for valid time format hh:mm:ss', () => {
      expect($exeDevice.validTime('00:00:00')).toBe(true);
      expect($exeDevice.validTime('23:59:59')).toBe(true);
      expect($exeDevice.validTime('12:30:45')).toBe(true);
    });

    it('returns false for invalid hours', () => {
      expect($exeDevice.validTime('24:00:00')).toBe(false);
    });

    it('returns false for invalid minutes', () => {
      expect($exeDevice.validTime('12:60:00')).toBe(false);
    });

    it('returns false for invalid seconds', () => {
      expect($exeDevice.validTime('12:30:60')).toBe(false);
    });

    it('returns false for wrong format', () => {
      expect($exeDevice.validTime('1:30:45')).toBe(false);
    });

    it('returns false for wrong length', () => {
      expect($exeDevice.validTime('12:30')).toBe(false);
      expect($exeDevice.validTime('')).toBe(false);
    });

    it('returns false for non-numeric characters', () => {
      expect($exeDevice.validTime('aa:bb:cc')).toBe(false);
    });
  });

  describe('getCardDefault', () => {
    it('returns object with id as empty string', () => {
      const card = $exeDevice.getCardDefault();
      expect(card.id).toBe('');
    });

    it('returns object with type as 2', () => {
      const card = $exeDevice.getCardDefault();
      expect(card.type).toBe(2);
    });

    it('returns object with url as empty string', () => {
      const card = $exeDevice.getCardDefault();
      expect(card.url).toBe('');
    });

    it('returns object with audio as empty string', () => {
      const card = $exeDevice.getCardDefault();
      expect(card.audio).toBe('');
    });

    it('returns object with coordinate properties', () => {
      const card = $exeDevice.getCardDefault();
      expect(card.x).toBe(0);
      expect(card.y).toBe(0);
      expect(card.xBk).toBe(0);
      expect(card.yBk).toBe(0);
    });

    it('returns object with front text properties', () => {
      const card = $exeDevice.getCardDefault();
      expect(card.eText).toBe('');
      expect(card.color).toBe('#000000');
      expect(card.backcolor).toBe('#ffffff');
    });

    it('returns object with back text properties', () => {
      const card = $exeDevice.getCardDefault();
      expect(card.eTextBk).toBe('');
      expect(card.colorBk).toBe('#000000');
      expect(card.backcolorBk).toBe('#ffffff');
    });

    it('returns object with back url and audio properties', () => {
      const card = $exeDevice.getCardDefault();
      expect(card.urlBk).toBe('');
      expect(card.audioBk).toBe('');
    });

    it('returns object with correct property as 0', () => {
      const card = $exeDevice.getCardDefault();
      expect(card.correct).toBe(0);
    });

    it('returns a new object each time', () => {
      const c1 = $exeDevice.getCardDefault();
      const c2 = $exeDevice.getCardDefault();
      expect(c1).not.toBe(c2);
    });
  });

  describe('removeTags', () => {
    it('removes simple HTML tags', () => {
      const result = $exeDevice.removeTags('<p>Hello</p>');
      expect(result).toBe('Hello');
    });

    it('removes nested HTML tags', () => {
      const result = $exeDevice.removeTags('<div><p><strong>Text</strong></p></div>');
      expect(result).toBe('Text');
    });

    it('handles text without tags', () => {
      const result = $exeDevice.removeTags('Plain text');
      expect(result).toBe('Plain text');
    });

    it('handles empty string', () => {
      const result = $exeDevice.removeTags('');
      expect(result).toBe('');
    });
  });

  describe('placeImageWindows', () => {
    // Helper to create a mock image with real DOM parent dimensions
    const createMockImage = (parentWidth, parentHeight) => {
      const parent = document.createElement('div');
      parent.style.width = `${parentWidth}px`;
      parent.style.height = `${parentHeight}px`;
      Object.defineProperty(parent, 'offsetWidth', {
        value: parentWidth,
        configurable: true,
      });
      Object.defineProperty(parent, 'offsetHeight', {
        value: parentHeight,
        configurable: true,
      });
      const img = document.createElement('img');
      parent.appendChild(img);
      document.body.appendChild(parent);
      return {
        mockImage: img,
        cleanup: () => {
          parent.remove();
        },
      };
    };

    it('calculates dimensions for landscape image in square container', () => {
      const { mockImage, cleanup } = createMockImage(200, 200);

      const result = $exeDevice.placeImageWindows(mockImage, 400, 300);

      expect(result.w).toBe(200);
      expect(result.h).toBe(150);
      expect(result.x).toBe(0);
      expect(result.y).toBe(25);

      cleanup();
    });

    it('calculates dimensions for portrait image in square container', () => {
      const { mockImage, cleanup } = createMockImage(200, 200);

      const result = $exeDevice.placeImageWindows(mockImage, 300, 400);

      expect(result.w).toBe(150);
      expect(result.h).toBe(200);
      expect(result.x).toBe(25);
      expect(result.y).toBe(0);

      cleanup();
    });

    it('returns object with required properties', () => {
      const { mockImage, cleanup } = createMockImage(100, 100);

      const result = $exeDevice.placeImageWindows(mockImage, 200, 200);

      expect(result).toHaveProperty('w');
      expect(result).toHaveProperty('h');
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');

      cleanup();
    });
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
    });

    it('has name defined', () => {
      expect($exeDevice.i18n.name).toBeDefined();
    });
  });

  describe('cardsGame', () => {
    it('is defined as an empty array', () => {
      expect($exeDevice.cardsGame).toBeDefined();
      expect(Array.isArray($exeDevice.cardsGame)).toBe(true);
      expect($exeDevice.cardsGame.length).toBe(0);
    });
  });

  describe('showMessage', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.showMessage).toBe('function');
    });
  });

  describe('validateData', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.validateData).toBe('function');
    });
  });

  describe('createForm', () => {
    let originalExeLearning;
    let originalExeDevicesEdition;
    let originalExeIDevicesEdition;
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      $exeDevice.ideviceBody = container;
      $exeDevice.idevicePath = '/test/';
      $exeDevice.ci18n = {};

      originalExeLearning = global.eXeLearning;
      originalExeDevicesEdition = global.$exeDevicesEdition;
      originalExeIDevicesEdition = global.$exeIDevicesEdition;

      global.eXeLearning = {
        app: {
          project: { odeId: 'ode-id' },
        },
      };
      const mockEdition = {
        iDevice: {
          tabs: {
            init: vi.fn(),
            getHtml: vi.fn((id, config) => `<div id="${id}-tabs"><div class="mock-scorm"></div></div>`),
            bind: vi.fn(),
          },
          common: {
            getTextFieldset: vi.fn(() => '<div class="mock-after"></div>'),
            getIdeviceDescription: vi.fn(
              () =>
                '<p class="alert alert-info alert-dismissible fade show mb-3" role="alert">mock description<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Hide"></button></p>',
            ),
            getHelpTooltip: vi.fn((text) => `<button class="exe-idevice-help" type="button" title="${text}">?</button>`),
          },
          gamification: {
            instructions: { getFieldset: vi.fn(() => '<div class="mock-instructions"></div>') },
            itinerary: {
              getTab: vi.fn(() => '<div class="mock-itinerary"></div>'),
              addEvents: vi.fn(),
            },
            scorm: {
              getTab: vi.fn(() => '<div class="mock-scorm"></div>'),
              init: vi.fn(),
            },
            common: { getLanguageTab: vi.fn(() => '<div class="mock-language"></div>') },
            share: {
              getTab: vi.fn(() => '<div class="mock-share"></div>'),
              getTabIA: vi.fn(() => '<div class="mock-share-ia"></div>'),
              addEvents: vi.fn(),
            },
            progressBar: {
              getContents: vi.fn(() => '<div class="mock-progress-bar"></div>'),
              setValues: vi.fn(),
              getValues: vi.fn(() => ({ evaluation: false, evaluationID: '' })),
              addEvents: vi.fn(),
            },
            passScore: {
              getContents: vi.fn(() => '<div class="mock-pass-score"></div>'),
              setValues: vi.fn(),
              getValues: vi.fn(() => ({ passScoreMode: 'global', passScoreCustom: 5 })),
              addEvents: vi.fn(),
            },
          },
        },
      };
      global.$exeDevicesEdition = mockEdition;
      global.$exeIDevicesEdition = mockEdition;
      $exeDevice.enableForm = vi.fn();
    });

    afterEach(() => {
      global.eXeLearning = originalExeLearning;
      global.$exeDevicesEdition = originalExeDevicesEdition;
      global.$exeIDevicesEdition = originalExeIDevicesEdition;
    });

    it('hands its asset path to the Grading tab, which renders the report', () => {
      // The iDevice used to render the progress report itself. The tab does it
      // now, and it needs this path for the report's help icon -- so what this
      // iDevice still owns is passing it along.
      $exeDevice.createForm();
      const tabs = global.$exeIDevicesEdition.iDevice.tabs;
      expect(tabs.getHtml).toHaveBeenCalledWith(
        'flipcardsQEIdeviceForm',
        expect.objectContaining({ path: '/test/', grading: true }),
      );
      expect(container.querySelector('.mock-scorm')).not.toBeNull();
    });
  });

  describe('addEvents', () => {
    let originalExeDevicesEdition;
    let originalExeIDevicesEdition;

    beforeEach(() => {
      originalExeDevicesEdition = global.$exeDevicesEdition;
      originalExeIDevicesEdition = global.$exeIDevicesEdition;
      const mockEvents = {
        iDevice: {
          gamification: {
            itinerary: { addEvents: vi.fn() },
            share: { addEvents: vi.fn() },
            progressBar: { addEvents: vi.fn() },
            passScore: { addEvents: vi.fn() },
          },
        },
      };
      global.$exeDevicesEdition = mockEvents;
      global.$exeIDevicesEdition = mockEvents;
    });

    afterEach(() => {
      // Close the edition, so the handlers addEvents() delegated on document
      // do not leak into the next test.
      $exeDevice.$lifecycle.destroy();
      global.$exeDevicesEdition = originalExeDevicesEdition;
      global.$exeIDevicesEdition = originalExeIDevicesEdition;
    });

    it('registers shared progress bar events', () => {
      $exeDevice.addEvents();
      expect(
        global.$exeIDevicesEdition.iDevice.gamification.progressBar.addEvents,
      ).toHaveBeenCalledTimes(1);
    });
  });

  // The editor truncates its numeric fields on keyup. Capping them at one digit
  // made ordinary values impossible to enter: the second keystroke was dropped,
  // so an author aiming for 10 silently ended up with 1.
  describe('numeric field limits', () => {
    let previousItinerary;

    beforeEach(() => {
      previousItinerary = (global.$exeIDevicesEdition || global.$exeDevicesEdition).iDevice.gamification.itinerary;
      // addEvents wires the whole editor. The itinerary component lives outside
      // this iDevice's source, so it is stubbed rather than exercised here.
      const itin = {
        addEvents: () => {},
        getTab: () => '',
        init: () => {},
        setValues: () => {},
      };
      if (global.$exeIDevicesEdition) {
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = itin;
      }
      if (global.$exeDevicesEdition) {
        global.$exeDevicesEdition.iDevice.gamification.itinerary = itin;
      }
      document.body.innerHTML = `
        <script></script>
        <form id="gameQEIdeviceForm">
          <input id="flipcardsETime" />
        </form>`;
      $exeDevice.addEvents();
    });

    afterEach(() => {
      $exeDevice.$lifecycle.destroy();
      if (global.$exeIDevicesEdition) {
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
      }
      if (global.$exeDevicesEdition) {
        global.$exeDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
      }
      document.body.innerHTML = '';
    });

    it('keeps a 2-digit time', () => {
      $('#flipcardsETime').val('45').trigger('keyup');

      expect($('#flipcardsETime').val()).toBe('45');
    });

    it('truncates the time beyond 2 digits and drops non-digits', () => {
      $('#flipcardsETime').val('1a234').trigger('keyup');

      expect($('#flipcardsETime').val()).toBe('12');
    });
  });

    /**
     * The pass-score control is a shared block in common_edition.js, exercised
     * by its own tests. What is specific to this iDevice -- and what silently
     * breaks if someone edits the form -- is the wiring: all four call sites
     * have to be present, and the two saved fields have to reach the stored
     * data. Reading the source is how that is checked without standing up the
     * whole edition form.
     */
    describe('pass score wiring', () => {
        let source;

        beforeEach(() => {
            source = readFileSync(join(__dirname, 'flipcards.js'), 'utf-8');
        });

        it('delegates the evaluation controls to the shared tab', () => {
            // The pass score and the progress report used to be rendered here,
            // loose in the general options. They now live in the Grading tab,
            // so rendering them again would show each control twice.
            expect(source).not.toContain('passScore.getContents(');
            expect(source).not.toContain('progressBar.getContents(');
            expect(source).toMatch(/tabs\.getHtml\([\s\S]*grading: true/);
        });

        it('restores the control when the iDevice is reopened', () => {
            expect(source).toContain('gamification.passScore.setValues(');
            expect(source).toContain('passScoreMode: game.passScoreMode');
            expect(source).toContain('passScoreCustom: game.passScoreCustom');
        });

        it('saves the mode and the customised mark, and nothing else', () => {
            expect(source).toContain('gamification.passScore.getValues()');
            expect(source).toContain('passScoreMode: passScore.passScoreMode');
            expect(source).toContain('passScoreCustom: passScore.passScoreCustom');
            // The project value is never copied into the iDevice: it is read
            // live, so an iDevice on the global mode follows the project.
            expect(source).not.toContain('passScoreGlobal');
        });

        it('wires the radio and input handlers', () => {
            expect(source).toContain('gamification.passScore.addEvents()');
        });
    });

  describe('edition lifecycle', () => {
    let savedGamification;
    let savedMedia;

    beforeEach(() => {
      savedGamification =
        global.$exeIDevicesEdition?.iDevice?.gamification ||
        global.$exeDevicesEdition?.iDevice?.gamification;
      const mockGam = {
        ...savedGamification,
        progressBar: { addEvents: vi.fn() },
        passScore: { addEvents: vi.fn() },
        itinerary: { addEvents: vi.fn() },
        share: { addEvents: vi.fn(), downloadBlob: vi.fn(() => true) },
        helpers: { stopSound: vi.fn(), playSound: vi.fn() },
      };
      if (!global.$exeIDevicesEdition) {
        global.$exeIDevicesEdition = { iDevice: {} };
      }
      global.$exeIDevicesEdition.iDevice.gamification = mockGam;
      if (global.$exeDevicesEdition) {
        global.$exeDevicesEdition.iDevice.gamification = mockGam;
      }
      savedMedia = global.$exeDevices.iDevice.gamification.media;
      global.$exeDevices.iDevice.gamification.media = {
        extractURLGD: (url) => url,
      };

      document.body.innerHTML = `
        <div id="flipcardsIdeviceForm">
          <span class="toggle-item">
            <input id="tgl" class="toggle-input" type="checkbox" data-target="#tgt">
          </span>
          <div id="tgt"></div>
          <input id="eXeGameImportGame" type="file">
        </div>
      `;

      $exeDevice.addEvents();
    });

    afterEach(() => {
      // Close the edition the test opened, so its document handlers cannot
      // leak into the next one.
      $exeDevice.$lifecycle.destroy();
      document.body.innerHTML = '';
      if (global.$exeIDevicesEdition?.iDevice) {
        global.$exeIDevicesEdition.iDevice.gamification = savedGamification;
      }
      if (global.$exeDevicesEdition?.iDevice) {
        global.$exeDevicesEdition.iDevice.gamification = savedGamification;
      }
      global.$exeDevices.iDevice.gamification.media = savedMedia;
    });

    describe('delegated .toggle-input handler on document', () => {
      it('reacts to a change while the edition is open', () => {
        $('#tgl').prop('checked', true).trigger('change');

        expect($('#tgt').css('display')).toBe('flex');
      });

      it('stops reacting once the edition is closed', () => {
        $('#tgl').prop('checked', true).trigger('change');
        expect($('#tgt').css('display')).toBe('flex');

        $exeDevice.$lifecycle.destroy();
        $('#tgl').prop('checked', false).trigger('change');

        expect($('#tgt').css('display')).toBe('flex');
      });

      it('leaves unrelated document handlers registered', () => {
        const unrelated = vi.fn();
        $(document).on('change.flipcardsUnrelated', '.toggle-input', unrelated);

        $exeDevice.$lifecycle.destroy();
        $('#tgl').trigger('change');

        expect(unrelated).toHaveBeenCalledTimes(1);
        $(document).off('change.flipcardsUnrelated');
      });
    });

    describe('import FileReader', () => {
      /**
       * Drive the file input the way a user picking a file does, and hand back
       * the FileReader the edition created for it.
       *
       * @returns {FileReader}
       */
      function pickFile() {
        const readers = [];
        const RealFileReader = global.FileReader;
        class TrackedFileReader extends RealFileReader {
          constructor() {
            super();
            readers.push(this);
          }
        }
        global.FileReader = TrackedFileReader;
        try {
          const input = document.getElementById('eXeGameImportGame');
          Object.defineProperty(input, 'files', {
            configurable: true,
            value: [new File(['card'], 'game.txt', { type: 'text/plain' })],
          });
          $(input).trigger('change');
        } finally {
          global.FileReader = RealFileReader;
        }
        return readers[0];
      }

      it('aborts a read that is still in flight when the edition closes', () => {
        const reader = pickFile();
        expect(reader).toBeDefined();
        const abort = vi.spyOn(reader, 'abort');

        expect(reader.readyState).toBe(1);
        $exeDevice.$lifecycle.destroy();

        expect(abort).toHaveBeenCalledTimes(1);
        abort.mockRestore();
      });

      it('discards a load that resolves after the edition closed', () => {
        const reader = pickFile();
        const importGame = vi.fn();
        $exeDevice.importGame = importGame;

        $exeDevice.$lifecycle.destroy();
        reader.onload({ target: { result: 'card' } });

        expect(importGame).not.toHaveBeenCalled();
      });

      it('imports a load that resolves while the edition is open', () => {
        const reader = pickFile();
        const importGame = vi.fn();
        $exeDevice.importGame = importGame;

        reader.onload({ target: { result: 'card' } });

        expect(importGame).toHaveBeenCalledWith('card', 'text/plain');
      });
    });

    describe('preview audio', () => {
      it('stops playback and releases the stream when the edition closes', () => {
        $exeDevice.playSound('files/beep.mp3');
        const player = $exeDevice.playerAudio;
        const pause = vi.spyOn(player, 'pause');

        $exeDevice.$lifecycle.destroy();

        expect(pause).toHaveBeenCalledTimes(1);
        expect(player.hasAttribute('src')).toBe(false);
        pause.mockRestore();
      });

      it('plays on canplaythrough while open, and stays silent afterwards', () => {
        $exeDevice.playSound('files/beep.mp3');
        const player = $exeDevice.playerAudio;
        const play = vi.spyOn(player, 'play').mockReturnValue(undefined);

        player.dispatchEvent(new Event('canplaythrough'));
        expect(play).toHaveBeenCalledTimes(1);

        $exeDevice.$lifecycle.destroy();
        player.dispatchEvent(new Event('canplaythrough'));

        expect(play).toHaveBeenCalledTimes(1);
        play.mockRestore();
      });
    });
  });
});

describe('flipcards minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'flipcards.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('flipcards edition: shared form tabs, options tooltips, and saving', () => {
    const PATH = 'files/perm/idevices/base/flipcards/edition/';
    const jq = window.jQuery;
    let savedGlobals;
    let device;
    let previousApp;
    let tooltips;

    function panel(tab) {
        return document.getElementById(`flipcardsQEIdeviceForm-panel-${tab}`);
    }

    function tabNames() {
        return [...document.querySelectorAll('#flipcardsQEIdeviceForm-tabs [data-exe-tab]')].map(
            (tab) => tab.getAttribute('data-exe-tab')
        );
    }

    beforeEach(() => {
        savedGlobals = {
            $: global.$,
            jQuery: global.jQuery,
            exeDevices: global.$exeDevices,
        };
        global.$ = jq;
        global.jQuery = jq;
        global.$exeDevices = {
            ...global.$exeDevices,
            iDevice: {
                ...global.$exeDevices?.iDevice,
                gamification: {
                    ...global.$exeDevices?.iDevice?.gamification,
                    helpers: {
                        ...global.$exeDevices?.iDevice?.gamification?.helpers,
                        encrypt: (t) => t,
                        decrypt: (t) => t,
                        isJsonString: (t) => {
                            try {
                                return JSON.parse(t);
                            } catch {
                                return false;
                            }
                        },
                        sanitizeJSONString: (t) => t,
                    },
                    media: {
                        extractURLGD: (url) => url,
                    },
                },
            },
        };
        global.$exeDevice = undefined;
        previousApp = global.eXeLearning?.app;
        tooltips = new Map();
        global.eXeLearning = {
            ...global.eXeLearning,
            app: {
                ...previousApp,
                common: {
                    initTooltips: vi.fn((scope) => {
                        scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
                            if (!tooltips.has(button)) tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                        });
                    }),
                },
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });

        device = global.loadIdevice(join(__dirname, 'flipcards.js'));
        document.body.innerHTML = '<div id="flipcardsBody"></div>';
        device.init(document.getElementById('flipcardsBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        document.body.innerHTML = '';
        global.$ = savedGlobals.$;
        global.jQuery = savedGlobals.jQuery;
        global.$exeDevices = savedGlobals.exeDevices;
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
    });

    it('counts the first card of a new activity', () => {
        // The counter used to stay at the 0 of its markup until a card was added.
        expect(device.cardsGame).toHaveLength(1);
        expect(document.getElementById('flipcardsENumCards').textContent).toBe('1');
    });

    it('explains what goes in the Questions tab', () => {
        const info = panel('contents').firstElementChild;

        expect(info.tagName).toBe('P');
        expect(info.textContent).toContain('Add the cards with the text, image or sound of each side, and edit them one by one.');
    });

    it('leaves the state of each switch to its native checkbox', () => {
        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('organises the edition form into shared WAI-ARIA tabs', () => {
        expect(tabNames()).toEqual([
            'instructions',
            'options',
            'contents',
            'passwords',
            'after',
            'grading',
            'texts',
        ]);

        expect(panel('instructions').querySelector('#eXeGameInstructions')).not.toBeNull();
        expect(panel('options').querySelector('#flipcardsEOptions')).not.toBeNull();
        expect(panel('contents').querySelector('#flipcardsEPanel')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowClue')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit')).not.toBeNull();
    });

    it('provides accessible help tooltips for option rows', () => {
        const optionHelps = [...panel('options').querySelectorAll('#flipcardsEOptions .exe-idevice-help')];
        expect(optionHelps.length).toBe(7);

        for (const help of optionHelps) {
            expect(help.tagName).toBe('BUTTON');
            expect(help.type).toBe('button');
            expect(help.title).toBe('Information');
            const targetId = help.getAttribute('aria-controls');
            expect(targetId).toBeTruthy();
            expect(document.getElementById(targetId)?.textContent.length).toBeGreaterThan(10);
        }
    });

    it('does not toggle switches when clicking help icons inside toggle-items', () => {
        const minimizeInput = document.getElementById('flipcardsEShowMinimize');
        const minimizeHelp = minimizeInput.closest('div').querySelector('.exe-idevice-help');
        expect(minimizeHelp).not.toBeNull();
        expect(minimizeInput.checked).toBe(false);
        minimizeHelp.click();
        expect(minimizeInput.checked).toBe(false);
    });

    it('disposes all option tooltips when the edition closes', () => {
        expect(tooltips.size).toBeGreaterThanOrEqual(7);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('switches tabs when one is clicked', () => {
        document.getElementById('flipcardsQEIdeviceForm-tab-options').click();

        expect(panel('options').classList.contains('active')).toBe(true);
        expect(panel('instructions').classList.contains('active')).toBe(false);
    });

    it('restores form values and updates gamification modules on updateFieldGame', () => {
        device.updateFieldGame({
            showMinimize: true,
            percentajeCards: 80,
            author: 'Test Author',
            showSolution: true,
            timeShowSolution: 5,
            time: 25,
            type: 3,
            itinerary: {},
            evaluation: true,
            evaluationID: 'eval-flip-1',
            passScoreMode: 1,
            passScoreCustom: 7,
            isScorm: 1,
            textButtonScorm: 'Submit',
            repeatActivity: true,
            weighted: 50,
            cardsGame: [{ eText: 'card1', eTextBk: 'cardBack1' }],
        });

        expect(document.getElementById('flipcardsEShowMinimize').checked).toBe(true);
        expect(document.getElementById('flipcardsEPercentajeCards').value).toBe('80');
        expect(document.getElementById('flipcardsEAuthory').value).toBe('Test Author');
        expect(document.getElementById('flipcardsEShowSolution').checked).toBe(true);
        expect(document.getElementById('flipcardsETimeShowSolution').value).toBe('5');
        expect(document.getElementById('flipcardsETime').value).toBe('25');
        expect(document.getElementById('flipcardsETypeMemory').checked).toBe(true);
        expect(document.getElementById('flipcardsETimeDiv').style.display).toBe('flex');
        expect(document.getElementById('flipcardBackDiv').style.display).not.toBe('none');
    });

    describe('saving and validation', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Click on cards</p>',
                eXeIdeviceTextAfter: '<p>Extra flipcards info</p>',
            };
            tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? {
                          initialized: true,
                          getContent: () => editors[id],
                          setContent: (html) => (editors[id] = html),
                          hide: vi.fn(),
                          show: vi.fn(),
                      }
                    : null
            );
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        it('saves valid data and outputs expected HTML structure', () => {
            device.updateFieldGame({
                showMinimize: true,
                percentajeCards: 100,
                author: 'Author Name',
                showSolution: true,
                timeShowSolution: 3,
                time: 0,
                type: 0,
                itinerary: {},
                evaluation: false,
                evaluationID: '',
                passScoreMode: 0,
                passScoreCustom: 5,
                isScorm: 0,
                textButtonScorm: '',
                repeatActivity: false,
                weighted: 100,
                cardsGame: [
                    {
                        eText: 'front card text',
                        eTextBk: 'back card text',
                        url: '',
                        urlBk: '',
                        author: '',
                        alt: '',
                        audio: '',
                        audioBk: '',
                    },
                ],
            });
            $('#flipcardsEText').val('front card text');
            $('#flipcardsETextBack').val('back card text');

            const data = device.validateData();
            expect(data).not.toBe(false);
            expect(data.showMinimize).toBe(true);
            expect(data.instructions).toBe('<p>Click on cards</p>');
            expect(unescape(data.textAfter)).toBe('<p>Extra flipcards info</p>');

            const savedHtml = device.save();
            expect(savedHtml).toContain('flipcards-IDevice');
            expect(savedHtml).toContain('flipcards-instructions');
            expect(savedHtml).toContain('flipcards-DataGame');
            expect(savedHtml).toContain('flipcards-extra-content');
        });

        describe('sharing the cards as text', () => {
            let downloadBlob;
            const encode = (text) => device.encodeURIComponentSafe(text);
            const showCards = (cards) => {
                device.cardsGame = cards;
                device.active = 0;
                device.showCard(0);
            };

            beforeEach(() => {
                downloadBlob = vi
                    .spyOn($exeIDevicesEdition.iDevice.gamification.share, 'downloadBlob')
                    .mockReturnValue(true);
            });

            afterEach(() => {
                downloadBlob.mockRestore();
            });

            it('exports readable lines for the cards with text on both sides', async () => {
                showCards([
                    { ...device.getCardDefault(), eText: encode('Heart 50%'), eTextBk: encode('Organ #1') },
                    { ...device.getCardDefault(), url: 'images/front.png', urlBk: 'images/back.png' },
                ]);

                document.getElementById('eXeGameExportQuestions').click();

                expect(downloadBlob).toHaveBeenCalledTimes(1);
                expect(await downloadBlob.mock.calls[0][0].text()).toBe('Heart 50%#Organ 1');
            });

            it('does not export a card left empty', () => {
                showCards([device.getCardDefault()]);

                document.getElementById('eXeGameExportQuestions').click();

                expect(downloadBlob).not.toHaveBeenCalled();
            });

            it('imports text cards ready for the activity, even with a "%"', () => {
                device.importGame('Heart 50%#Organ that pumps blood', 'text/plain');

                const card = device.cardsGame.at(-1);
                expect(device.decodeURIComponentSafe(card.eText)).toBe('Heart 50%');
                expect(device.decodeURIComponentSafe(card.eTextBk)).toBe('Organ that pumps blood');
            });
        });
    });
});
