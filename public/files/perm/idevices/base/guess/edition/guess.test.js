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
        global.$exeDevicesEdition.iDevice.gamification.itinerary = {
            getTab: vi.fn(() => ''),
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
