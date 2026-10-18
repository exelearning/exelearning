/**
 * Unit tests for guess iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - escapeHtml: HTML character escaping
 * - validTime: Time format validation
 * - removeTags: HTML tag removal (with mocked jQuery)
 * - getCuestionDefault: Default question object structure
 * - placeImageWindows: Image dimension calculations (with mocked jQuery)
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runInThisContext } from 'node:vm';

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
  global.attachEditionLifecycle(global.$exeDevice);
  return global.$exeDevice;
}

describe('guess iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'guess.js');
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
      expect($exeDevice.validTime('25:00:00')).toBe(false);
    });

    it('returns false for invalid minutes', () => {
      expect($exeDevice.validTime('12:60:00')).toBe(false);
      expect($exeDevice.validTime('12:99:00')).toBe(false);
    });

    it('returns false for invalid seconds', () => {
      expect($exeDevice.validTime('12:30:60')).toBe(false);
      expect($exeDevice.validTime('12:30:99')).toBe(false);
    });

    it('returns false for wrong format', () => {
      expect($exeDevice.validTime('1:30:45')).toBe(false);
      expect($exeDevice.validTime('12:3:45')).toBe(false);
      expect($exeDevice.validTime('12:30:4')).toBe(false);
    });

    it('returns false for wrong length', () => {
      expect($exeDevice.validTime('12:30')).toBe(false);
      expect($exeDevice.validTime('123:30:45')).toBe(false);
      expect($exeDevice.validTime('')).toBe(false);
    });

    it('returns false for non-numeric characters', () => {
      expect($exeDevice.validTime('aa:bb:cc')).toBe(false);
      expect($exeDevice.validTime('12-30-45')).toBe(false);
    });
  });

  describe('getCuestionDefault', () => {
    it('returns object with word property as empty string', () => {
      const question = $exeDevice.getCuestionDefault();
      expect(question.word).toBe('');
    });

    it('returns object with definition property as empty string', () => {
      const question = $exeDevice.getCuestionDefault();
      expect(question.definition).toBe('');
    });

    it('returns object with type property as 0', () => {
      const question = $exeDevice.getCuestionDefault();
      expect(question.type).toBe(0);
    });

    it('returns object with url property as empty string', () => {
      const question = $exeDevice.getCuestionDefault();
      expect(question.url).toBe('');
    });

    it('returns object with audio property as empty string', () => {
      const question = $exeDevice.getCuestionDefault();
      expect(question.audio).toBe('');
    });

    it('returns object with coordinate properties x and y', () => {
      const question = $exeDevice.getCuestionDefault();
      expect(question.x).toBe(0);
      expect(question.y).toBe(0);
    });

    it('returns object with percentageShow property', () => {
      const question = $exeDevice.getCuestionDefault();
      expect(question.percentageShow).toBe(35);
    });

    it('returns object with time property', () => {
      const question = $exeDevice.getCuestionDefault();
      expect(question.time).toBe(0);
    });

    it('returns a new object each time', () => {
      const q1 = $exeDevice.getCuestionDefault();
      const q2 = $exeDevice.getCuestionDefault();
      expect(q1).not.toBe(q2);
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

      // Landscape image (wider than tall)
      const result = $exeDevice.placeImageWindows(mockImage, 400, 300);

      // Image should scale to fit width, with vertical centering
      expect(result.w).toBe(200); // Full width of container
      expect(result.h).toBe(150); // Proportional height (300 * 200/400)
      expect(result.x).toBe(0); // No horizontal offset
      expect(result.y).toBe(25); // Centered vertically ((200-150)/2)

      cleanup();
    });

    it('calculates dimensions for portrait image in square container', () => {
      const { mockImage, cleanup } = createMockImage(200, 200);

      // Portrait image (taller than wide)
      const result = $exeDevice.placeImageWindows(mockImage, 300, 400);

      // Image should scale to fit height, with horizontal centering
      expect(result.w).toBe(150); // Proportional width (300 * 200/400)
      expect(result.h).toBe(200); // Full height of container
      expect(result.x).toBe(25); // Centered horizontally ((200-150)/2)
      expect(result.y).toBe(0); // No vertical offset

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

  describe('ci18n', () => {
    it('is defined', () => {
      expect($exeDevice.ci18n).toBeDefined();
    });
  });

  describe('wordsGame', () => {
    it('is defined as an empty array', () => {
      expect($exeDevice.wordsGame).toBeDefined();
      expect(Array.isArray($exeDevice.wordsGame)).toBe(true);
      expect($exeDevice.wordsGame.length).toBe(0);
    });
  });

  // The editor truncates its numeric fields on keyup. Capping them at one digit
  // made ordinary values impossible to enter: the second keystroke was dropped,
  // so an author aiming for 10 silently ended up with 1.
  describe('numeric field limits', () => {
    let previousItinerary;
    let originalYT;
    let originalReady;
    let scriptTag;

    beforeEach(() => {
      previousItinerary = $exeIDevicesEdition.iDevice.gamification.itinerary;
      // addEvents wires the whole editor. The itinerary component lives outside
      // this iDevice's source, so it is stubbed rather than exercised here.
      $exeIDevicesEdition.iDevice.gamification.itinerary = {
        addEvents: () => {},
        getContents: () => '',
        init: () => {},
        setValues: () => {},
      };
      // loadYoutubeApi inserts its tag before the first script of the page
      // and binds the ready callback through $lifecycle.
      scriptTag = document.createElement('script');
      document.head.appendChild(scriptTag);
      originalYT = global.YT;
      originalReady = window.onYouTubeIframeAPIReady;
      global.$exeDevices.iDevice.gamification.media = {
        getIDYoutube: () => false,
        getURLVideoMediaTeca: () => false,
        extractURLGD: (url) => url,
      };
      document.body.innerHTML = `
        <script></script>
        <form id="gameQEIdeviceForm">
          <input id="adivinaETimeSilence" />
        </form>`;
      $exeDevice.addEvents();
    });

    afterEach(() => {
      if ($exeDevice && $exeDevice.$lifecycle) {
        $exeDevice.$lifecycle.destroy();
      }
      $exeIDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
      global.YT = originalYT;
      window.onYouTubeIframeAPIReady = originalReady;
      scriptTag.remove();
      document.body.innerHTML = '';
    });

    it('keeps a 3-digit silence time', () => {
      $('#adivinaETimeSilence').val('120').trigger('keyup');

      expect($('#adivinaETimeSilence').val()).toBe('120');
    });

    it('truncates the silence time beyond 3 digits and drops non-digits', () => {
      $('#adivinaETimeSilence').val('1a2345').trigger('keyup');

      expect($('#adivinaETimeSilence').val()).toBe('123');
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
            source = readFileSync(join(__dirname, 'guess.js'), 'utf-8');
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
});

/**
 * Edition lifecycle teardown (#2293).
 *
 * The YouTube player, the polling clock, the answer sound, the local <video>
 * element and the game import file readers all outlive the edition form unless
 * the lifecycle owns them.
 */
describe('guess edition: lifecycle teardown (#2293)', () => {
    let $exeDevice;
    let players;
    let originalYT;
    let originalReady;
    let scriptTag;
    let previousItinerary;

    function fakeYouTubeApi() {
        players = [];
        global.YT = {
            Player: function (id, options) {
                this.id = id;
                this.options = options || {};
                this.destroy = vi.fn();
                players.push(this);
            },
        };
    }

    function buildForm() {
        document.body.innerHTML = `
      <div id="adivinaQEIdeviceForm">
        <div id="eXeGameExportImport">
          <p class="exe-field-instructions"></p>
          <input id="eXeGameImportGame" type="file" />
          <a href="#" id="eXeGameExportQuestions"></a>
        </div>
        <input id="adivinaEURLYoutube" type="text" value="" />
        <input id="adivinaEInitVideo" type="text" value="00:00:00" />
        <input id="adivinaEEndVideo" type="text" value="00:00:00" />
        <input id="adivinaESilenceVideo" type="text" value="00:00:00" />
        <input id="adivinaEAlt" type="text" value="" />
        <video id="adivinaEVideoLocal"></video>
      </div>`;
    }

    beforeEach(() => {
        vi.useFakeTimers();
        global.$exeDevice = undefined;
        buildForm();
        // loadYoutubeApi inserts its tag before the first script of the page.
        scriptTag = document.createElement('script');
        document.head.appendChild(scriptTag);
        originalYT = global.YT;
        originalReady = window.onYouTubeIframeAPIReady;
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: vi.fn(() => false),
            getURLVideoMediaTeca: vi.fn(() => false),
            extractURLGD: vi.fn(url => url),
        };
        previousItinerary = global.$exeIDevicesEdition.iDevice.gamification.itinerary;
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = {
            getContents: vi.fn(() => ''),
            addEvents: vi.fn(),
            getValues: vi.fn(() => ({})),
            setValues: vi.fn(),
        };
        $exeDevice = global.loadIdevice(join(__dirname, 'guess.js'));
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) {
            $exeDevice.$lifecycle.destroy();
        }
        global.YT = originalYT;
        window.onYouTubeIframeAPIReady = originalReady;
        scriptTag.remove();
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    describe('video clock', () => {
        it('stops ticking once the edition closes', () => {
            const spy = vi.spyOn($exeDevice, 'updateTimerDisplay').mockImplementation(() => {});

            $exeDevice.clockVideo.start('remote');
            vi.advanceTimersByTime(2000);
            expect(spy).toHaveBeenCalledTimes(2);

            $exeDevice.$lifecycle.destroy();
            vi.advanceTimersByTime(5000);
            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('never drives the iDevice opened after it', () => {
            const spy = vi.spyOn($exeDevice, 'updateTimerDisplayLocal').mockImplementation(() => {});
            $exeDevice.clockVideo.start('local');

            const laterDevice = { updateTimerDisplayLocal: vi.fn() };
            global.$exeDevice = laterDevice;
            vi.advanceTimersByTime(1000);

            expect(spy).toHaveBeenCalledTimes(1);
            expect(laterDevice.updateTimerDisplayLocal).not.toHaveBeenCalled();
        });
    });

    describe('YouTube player', () => {
        it('destroys the player created by loadPlayerYoutube', () => {
            fakeYouTubeApi();
            $exeDevice.loadPlayerYoutube();
            expect(players).toHaveLength(1);

            $exeDevice.$lifecycle.destroy();
            expect(players[0].destroy).toHaveBeenCalledTimes(1);
        });

        it('destroys the player created when the API becomes ready', () => {
            fakeYouTubeApi();
            $exeDevice.youTubeReady();
            expect(players).toHaveLength(1);

            $exeDevice.$lifecycle.destroy();
            expect(players[0].destroy).toHaveBeenCalledTimes(1);
        });

        it('ignores a player event delivered after the edition closed', () => {
            fakeYouTubeApi();
            const spy = vi.spyOn($exeDevice, 'playVideoQuestion').mockImplementation(() => {});
            $exeDevice.loadPlayerYoutube();
            const onReady = players[0].options.events.onReady;

            onReady();
            expect(spy).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            onReady();
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('restores the global API ready callback on teardown', () => {
            const previous = vi.fn();
            window.onYouTubeIframeAPIReady = previous;
            global.YT = undefined;
            const spy = vi.spyOn($exeDevice, 'youTubeReady').mockImplementation(() => {});

            $exeDevice.loadYoutubeApi();
            const bound = window.onYouTubeIframeAPIReady;
            expect(bound).not.toBe(previous);
            bound();
            expect(spy).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            expect(window.onYouTubeIframeAPIReady).toBe(previous);
            bound();
            expect(spy).toHaveBeenCalledTimes(1);
            expect(previous).not.toHaveBeenCalled();
        });
    });

    describe('media elements', () => {
        it('stops the answer sound on teardown', () => {
            $exeDevice.playSound('sound.mp3');
            const audio = $exeDevice.playerAudio;
            const pause = vi.spyOn(audio, 'pause');

            $exeDevice.$lifecycle.destroy();

            expect(pause).toHaveBeenCalledTimes(1);
            expect(audio.getAttribute('src')).toBeNull();
        });

        it('stops the local video player on teardown', () => {
            $exeDevice.wordsGame = [{}];
            $exeDevice.initQuestions();

            const player = $exeDevice.localPlayer;
            player.setAttribute('src', 'question.mp4');
            const pause = vi.spyOn(player, 'pause');

            $exeDevice.$lifecycle.destroy();

            expect(pause).toHaveBeenCalledTimes(1);
            expect(player.getAttribute('src')).toBeNull();
        });
    });

    describe('game import', () => {
        it('aborts an in-flight read and ignores its late result', () => {
            $exeDevice.addEvents();
            const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});
            const input = document.getElementById('eXeGameImportGame');
            const file = new File(['question'], 'game.txt', { type: 'text/plain' });
            Object.defineProperty(input, 'files', { value: [file], configurable: true });

            const readers = [];
            const realFileReader = global.FileReader;
            class FakeFileReader {
                constructor() {
                    this.readyState = 0;
                    this.onload = null;
                    this.aborted = false;
                    readers.push(this);
                }
                readAsText() {
                    this.readyState = 1;
                }
                abort() {
                    this.aborted = true;
                    this.readyState = 2;
                }
                fireLoad(result) {
                    this.readyState = 2;
                    this.onload({ target: { result } });
                }
            }
            global.FileReader = FakeFileReader;
            window.FileReader = FakeFileReader;

            try {
                $(input).trigger('change');
                readers[0].fireLoad('finished');
                expect(importGame).toHaveBeenCalledTimes(1);

                $(input).trigger('change');
                const pending = readers[1];
                $exeDevice.$lifecycle.destroy();

                expect(readers[0].aborted).toBe(false);
                expect(pending.aborted).toBe(true);
                pending.onload({ target: { result: 'late' } });
                expect(importGame).toHaveBeenCalledTimes(1);
            } finally {
                global.FileReader = realFileReader;
                window.FileReader = realFileReader;
            }
        });
    });

    describe('accessibility confirmation', () => {
        it('does not save a later iDevice when answered too late', () => {
            let confirmed;
            const originalConfirm = global.eXe.app.confirm;
            global.eXe.app.confirm = vi.fn((title, message, callback) => {
                confirmed = callback;
            });
            const saveButton = document.createElement('button');
            saveButton.className = 'button-save-idevice';
            const click = vi.spyOn(saveButton, 'click');
            document.body.appendChild(saveButton);

            try {
                $exeDevice.checkAltImage = true;
                $exeDevice.validateAlt();
                expect(typeof confirmed).toBe('function');

                $exeDevice.$lifecycle.destroy();
                confirmed();

                expect(click).not.toHaveBeenCalled();
                expect($exeDevice.checkAltImage).toBe(true);
            } finally {
                global.eXe.app.confirm = originalConfirm;
            }
        });
    });
  });

describe('guess minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'guess.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

/**
 * guess is the first iDevice on $exeIDevicesEdition: its form is laid out in
 * the shared tabs and its feedback is the shared block. These tests open the
 * real form, with the real shared object the setup loads.
 */
describe('guess edition: shared form tabs and feedback', () => {
  const PATH = '/files/perm/idevices/base/guess/edition/';
  const edition = () => global.$exeIDevicesEdition.iDevice;
  const feedback = () => edition().gamification.feedback;
  const tabNames = () =>
    [...document.querySelectorAll('#gameQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
      tab.getAttribute('data-exe-tab')
    );
  const panel = (name) => document.getElementById(`gameQEIdeviceForm-panel-${name}`);
  const game = (overrides = {}) => ({
    typeGame: 'Adivina',
    itinerary: {
      showClue: false,
      clueGame: '',
      percentageClue: 40,
      showCodeAccess: false,
      codeAccess: '',
      messageCodeAccess: '',
    },
    wordsGame: [],
    gameMode: 1,
    feedBack: false,
    percentajeFB: 100,
    isScorm: 0,
    textButtonScorm: 'Save score',
    ...overrides,
  });
  // Export-side helpers (common.js) that loading and saving go through; the
  // setup's $exeDevices mock leaves them out. Stored data is plain JSON here.
  const exportHelpers = {
    isJsonString: (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return false;
      }
    },
    decrypt: (text) => text,
    encrypt: (text) => text,
  };
  let device;
  let tinymceInit;
  let previousApp;
  let tooltips;

  beforeEach(() => {
    global.$exeDevice = undefined;
    previousApp = global.eXeLearning.app;
    tooltips = new Map();
    global.eXeLearning.app = {
      ...previousApp,
      common: {
        initTooltips: vi.fn((scope) => {
          scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
            tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
          });
        }),
      },
    };
    vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });
    Object.assign(global.$exeDevices.iDevice.gamification.helpers, exportHelpers);
    // createForm starts its own editor for the question text.
    tinymceInit = vi.spyOn(global.tinymce, 'init').mockImplementation(() => Promise.resolve([]));
    document.body.innerHTML = '<div id="guessBody"></div>';
    // Keep the source filename so coverage includes the real form and its help text.
    const filename = join(__dirname, 'guess.js');
    runInThisContext(readFileSync(filename, 'utf8'), { filename });
    device = global.$exeDevice;
    global.attachEditionLifecycle(device);
    device.init(document.getElementById('guessBody'), {}, PATH);
  });

  afterEach(() => {
    device.$lifecycle?.destroy();
    global.eXeLearning.app = previousApp;
    vi.unstubAllGlobals();
    tinymceInit.mockRestore();
    Object.keys(exportHelpers).forEach((name) => delete global.$exeDevices.iDevice.gamification.helpers[name]);
    global.$exeDevice = undefined;
    document.body.innerHTML = '';
  });

  it('lays the form out in the shared tabs, and opens on its questions', () => {
    expect(tabNames()).toEqual([
      'instructions',
      'options',
      'contents',
      'passwords',
      'feedback',
      'after',
      'grading',
      'texts',
    ]);
    expect(document.getElementById('gameQEIdeviceForm-tab-contents').textContent.trim()).toBe('Questions');
    expect(panel('contents').classList.contains('active')).toBe(true);
  });

  it('puts each part of the form in its tab', () => {
    expect(panel('instructions').querySelector('#eXeGameInstructions').value).toBe(
      'Observe the letters, identify and fill in the missing words.'
    );
    expect(panel('options').querySelector('#adivinaEOptions')).not.toBeNull();
    expect(panel('contents').querySelector('#adivinaEPanel')).not.toBeNull();
    expect(panel('passwords').querySelector('#eXeGameShowClue')).not.toBeNull();
    expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
    expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
    expect(panel('texts').querySelector('#ci18n_msgReply').value).toBe('Reply');
  });

  it('provides one accessible information button at the end of each options row', () => {
    const options = panel('options');
    const rows = [...options.querySelector('#adivinaEOptions').children];
    expect(rows).toHaveLength(11);
    for (const row of rows) {
      const buttons = row.querySelectorAll('.exe-idevice-help');
      expect(buttons).toHaveLength(1);
      const help = buttons[0];
      expect(row.lastElementChild.contains(help)).toBe(true);
      expect(help.tagName).toBe('BUTTON');
      expect(help.type).toBe('button');
      expect(help.getAttribute('aria-label')).toBe(help.title);
      expect(help.title).toBe('Information');
      expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(30);
      expect(help.querySelector('[aria-hidden="true"].info-icon-solid-green')).not.toBeNull();
      const controls = [...row.querySelectorAll('input, select')];
      const checked = controls.map((control) => control.checked);
      help.click();
      expect(controls.map((control) => control.checked)).toEqual(checked);
    }
    expect(global.eXeLearning.app.common.initTooltips).toHaveBeenCalledWith(
      document.getElementById('gameQEIdeviceForm-panels')
    );
  });

  it('explains every control in each combined options row', () => {
    const groups = [
      ['adivinaEShowSolution', 'Show solutions', 'Show solution time (seconds)'],
      ['adivinaETypeActivity', 'From 0 to 10', 'Points and lives', 'No score'],
      ['adivinaEUseLives', 'Use lives', 'Number of lives'],
    ];
    for (const [id, ...labels] of groups) {
      const row = [...document.querySelector('#adivinaEOptions').children].find((item) => item.querySelector(`#${id}`));
      const text = row.querySelector('.help-content').textContent;
      for (const label of labels) expect(text).toContain(`${label}:`);
      expect(text.split('\n\n')).toHaveLength(labels.length);
    }
  });

  it('escapes translated help text in the explanation', () => {
    const text = 'Use "Accept" <once> & keep the learner\'s answer.';
    const container = document.createElement('div');
    container.innerHTML = edition().common.getHelpTooltip(text);
    const button = container.querySelector('button');
    expect(button.title).toBe('Information');
    expect(container.querySelector('.help-content').textContent).toBe(text);
    expect(container.querySelector('once')).toBeNull();
  });

  it('disposes all option tooltips when the edition closes', () => {
    expect(tooltips.size).toBe(11);
    device.$lifecycle.destroy();
    for (const tooltip of tooltips.values()) {
      expect(tooltip.dispose).toHaveBeenCalledTimes(1);
    }
  });

  it('offers Import, Export and Create with AI on its Questions tab, in windows of their own', () => {
    const links = [...panel('contents').querySelectorAll('[data-exe-share]')];

    expect(links.map((link) => link.getAttribute('data-exe-share'))).toEqual(['import', 'export', 'ai']);
    expect(document.querySelector('body > #eXeShareModal-import #eXeGameImportGame')).not.toBeNull();
    expect(document.querySelector('body > #eXeShareModal-export #eXeGameExportQuestions')).not.toBeNull();
    expect(document.querySelector('body > #eXeShareModal-ai #eXeEPromptArea')).not.toBeNull();
  });

  it('leaves the feedback to the shared block, without controls of its own', () => {
    expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
    expect(document.getElementById('adivinaEHasFeedBack')).toBeNull();
    expect(document.getElementById('adivinaEPercentajeFB')).toBeNull();
    expect(document.getElementById('adivinaEFeedBackEditor')).toBeNull();
  });

  it('switches tabs when one is clicked', () => {
    document.getElementById('gameQEIdeviceForm-tab-options').click();

    expect(panel('options').classList.contains('active')).toBe(true);
    expect(panel('contents').classList.contains('active')).toBe(false);
  });

  it('makes the feedback compulsory in "No score" mode only', () => {
    device.updateGameMode(2, false);
    expect(feedback().isRequired()).toBe(true);
    expect(document.getElementById('eXeGameHasFeedBack').disabled).toBe(true);

    device.updateGameMode(0, true);
    expect(feedback().isRequired()).toBe(false);
    expect(document.getElementById('eXeGameHasFeedBack').disabled).toBe(false);
    expect(document.getElementById('adivinaEUseLives').disabled).toBe(false);
  });

  it('restores the feedback and its mode with the game', () => {
    device.updateFieldGame(game({ gameMode: 2, feedBack: false, percentajeFB: 60 }));

    expect(feedback().isRequired()).toBe(true);
    expect(document.getElementById('eXeGamePercentajeFB').value).toBe('60');

    device.updateFieldGame(game({ gameMode: 1, feedBack: true, percentajeFB: 80 }));

    expect(feedback().isRequired()).toBe(false);
    expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
    expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
  });

  it('loads the saved message into the shared editor', () => {
    device.idevicePreviousData = `
      <div class="adivina-IDevice">
        <div class="adivina-version js-hidden">2</div>
        <div class="adivina-feedback-game"><p>Well done</p></div>
        <div class="adivina-DataGame js-hidden">${JSON.stringify(game({ feedBack: true }))}</div>
      </div>`;
    vi.spyOn(device, 'showQuestion').mockImplementation(() => {});

    device.loadPreviousValues();

    expect(feedback().getText()).toBe('<p>Well done</p>');
    expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
  });

  describe('saving', () => {
    let editors;
    let tinymceGet;

    beforeEach(() => {
      editors = {
        eXeGameInstructions: '<p>Instructions</p>',
        eXeIdeviceTextAfter: '',
        eXeGameFeedBackEditor: '',
      };
      tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
        id in editors ? { initialized: true, getContent: () => editors[id], setContent: (html) => (editors[id] = html) } : null
      );
      device.wordsGame = [{ ...device.getCuestionDefault(), word: 'casa', definition: 'home' }];
    });

    afterEach(() => {
      tinymceGet.mockRestore();
    });

    it('saves the feedback values the export reads', () => {
      device.updateFieldGame(game({ wordsGame: device.wordsGame, feedBack: true, percentajeFB: 70 }));
      editors.eXeGameFeedBackEditor = '<p>Bravo</p>';
      // The question being edited is checked against its media controls,
      // which is not what this test is about.
      vi.spyOn(device, 'validateQuestion').mockReturnValue(true);

      const data = device.validateData();

      expect(data.feedBack).toBe(true);
      expect(data.percentajeFB).toBe(70);
      expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
      expect(device.save()).toContain('<div class="adivina-feedback-game"><p>Bravo</p></div>');
    });

    it('asks for the message in "No score" mode', () => {
      device.updateFieldGame(game({ wordsGame: device.wordsGame, gameMode: 2 }));

      expect(device.validateData()).toBe(false);
      expect(global.eXe.app.alert).toHaveBeenCalledWith('Message to display when passing the game');
    });
  });
});
