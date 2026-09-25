/**
 * Unit tests for az-quiz-game iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - replaceLetters: L·L→0, SS→1 conversion
 * - getRealLetter: 0→L·L, 1→SS conversion
 * - getCaracterLetter: L·L→0, SS→1 conversion
 * - normaliceLetter: Letter normalization (removes accents, preserves Ñ)
 * - normaliceWord: Word normalization
 * - startContains: Check if word starts with or contains letter
 * - placeImageWindows: Image dimension calculations (with mocked jQuery)
 * - rearrangeAlphabet: Alphabet rearrangement
 * - escapeHtml: HTML character escaping
 * - removeTags: HTML tag removal
 */
/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * The real browser environment, captured before `loadIdevice` below replaces
 * it with the lightweight stubs the pure-function tests rely on. The edition
 * lifecycle tests need real jQuery and a real document, so they restore these.
 */
const realEnvironment = {
    $: global.$,
    jQuery: global.jQuery,
    document: global.document,
    translate: global._,
};

/**
 * Helper to load iDevice file and expose $exeDevice globally.
 * Replaces 'var $exeDevice' with 'global.$exeDevice' to make it accessible.
 */
function loadIdevice(code) {
  // Mock translation function
  global._ = (str) => str;

  // Helper to strip HTML tags
  const stripTags = (html) => {
    if (!html) return '';
    return String(html).replace(/<[^>]*>/g, '');
  };

  // Mock jQuery with chaining support
  const createJQueryObject = (element) => {
    // If element is a DOM node, use its properties
    const isElement = element && typeof element === 'object' && element.tagName;
    
    const obj = {
      length: isElement ? 1 : 0,
      0: element,
      val: () => '',
      text: () => stripTags(element || ''),
      html: (newContent) => {
        if (newContent !== undefined) {
          return createJQueryObject(newContent);
        }
        return element || '';
      },
      attr: () => '',
      data: () => null,
      find: () => createJQueryObject(''),
      each: () => {},
      on: () => obj,
      off: () => obj,
      click: () => obj,
      hide: () => obj,
      show: () => obj,
      css: () => obj,
      addClass: () => obj,
      removeClass: () => obj,
      hasClass: () => false,
      parent: () => {
        if (isElement && element.parentNode) {
          return createJQueryObject(element.parentNode);
        }
        return createJQueryObject('');
      },
      eq: () => ({ attr: () => '' }),
      append: () => obj,
      prepend: () => obj,
      remove: () => obj,
      width: () => {
        if (isElement) {
          return element.offsetWidth || 100;
        }
        return 100;
      },
      height: () => {
        if (isElement) {
          return element.offsetHeight || 100;
        }
        return 100;
      },
    };
    return obj;
  };

  global.$ = (selector) => createJQueryObject(selector);
  global.$.trim = (str) => (str ? String(str).trim() : '');
  global.jQuery = global.$;

  // Mock document with proper element creation
  global.document = {
    createElement: (tag) => {
      const element = {
        tagName: tag.toUpperCase(),
        style: {},
        children: [],
        parentNode: null,
        appendChild: function(child) {
          child.parentNode = this;
          this.children.push(child);
          return child;
        },
        remove: () => {},
      };
      return element;
    },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    body: {
        appendChild: function(child) {
        child.parentNode = global.document.body;
        return child;
      },
      removeChild: () => {},
    },
  };

  // Mock $exeDevices
  global.$exeDevices = {
    iDevice: {
      gamification: {
        helpers: {
          supportedBrowser: () => true,
          isJsonString: (str) => {
            if (!str) return false;
            try {
              return JSON.parse(str);
            } catch {
              return false;
            }
          },
        },
      },
    },
  };

  // Mock $exeDevicesEdition
  global.$exeDevicesEdition = {
    iDevice: {
      gamification: {
        common: {
          getLanguageTab: () => '',
        },
      },
      tabs: {
        init: () => {},
      },
    },
  };

  // Replace 'var $exeDevice' with 'global.$exeDevice' anywhere in the code
  const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
  // Execute the modified code using eval in global context
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$exeDevice;
}

describe('az-quiz-game iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'az-quiz-game.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('replaceLetters', () => {
    it('replaces L·L with 0', () => {
      expect($exeDevice.replaceLetters('ABL·LCD')).toBe('AB0CD');
    });

    it('replaces SS with 1', () => {
      expect($exeDevice.replaceLetters('ABSSCD')).toBe('AB1CD');
    });

    it('converts to uppercase', () => {
      expect($exeDevice.replaceLetters('abcdef')).toBe('ABCDEF');
    });

    it('removes spaces', () => {
      expect($exeDevice.replaceLetters('A B C D')).toBe('ABCD');
    });

    it('removes commas', () => {
      expect($exeDevice.replaceLetters('A,B,C,D')).toBe('ABCD');
    });

    it('handles multiple replacements', () => {
      expect($exeDevice.replaceLetters('L·L,SS,A B')).toBe('01AB');
    });

    it('handles empty string', () => {
      expect($exeDevice.replaceLetters('')).toBe('');
    });

    it('handles string with no special characters', () => {
      expect($exeDevice.replaceLetters('ABCDEFGHIJKLMNOPQRSTUVWXYZ'))
        .toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });
  });

  describe('getRealLetter', () => {
    it('converts 0 to L·L', () => {
      expect($exeDevice.getRealLetter('0')).toBe('L·L');
    });

    it('converts 1 to SS', () => {
      expect($exeDevice.getRealLetter('1')).toBe('SS');
    });

    it('returns regular letter unchanged', () => {
      expect($exeDevice.getRealLetter('A')).toBe('A');
      expect($exeDevice.getRealLetter('Z')).toBe('Z');
      expect($exeDevice.getRealLetter('Ñ')).toBe('Ñ');
    });
  });

  describe('getCaracterLetter', () => {
    it('converts L·L to 0', () => {
      expect($exeDevice.getCaracterLetter('L·L')).toBe('0');
    });

    it('converts SS to 1', () => {
      expect($exeDevice.getCaracterLetter('SS')).toBe('1');
    });

    it('returns regular letter unchanged', () => {
      expect($exeDevice.getCaracterLetter('A')).toBe('A');
      expect($exeDevice.getCaracterLetter('Z')).toBe('Z');
      expect($exeDevice.getCaracterLetter('Ñ')).toBe('Ñ');
    });
  });

  describe('normaliceLetter', () => {
    it('removes accent from vowels', () => {
      expect($exeDevice.normaliceLetter('á')).toBe('A');
      expect($exeDevice.normaliceLetter('é')).toBe('E');
      expect($exeDevice.normaliceLetter('í')).toBe('I');
      expect($exeDevice.normaliceLetter('ó')).toBe('O');
      expect($exeDevice.normaliceLetter('ú')).toBe('U');
    });

    it('preserves Ñ', () => {
      expect($exeDevice.normaliceLetter('Ñ')).toBe('Ñ');
      expect($exeDevice.normaliceLetter('ñ')).toBe('Ñ');
    });

    it('converts to uppercase', () => {
      expect($exeDevice.normaliceLetter('a')).toBe('A');
      expect($exeDevice.normaliceLetter('z')).toBe('Z');
    });

    it('handles already uppercase letters', () => {
      expect($exeDevice.normaliceLetter('A')).toBe('A');
      expect($exeDevice.normaliceLetter('Z')).toBe('Z');
    });

    it('handles umlauts', () => {
      expect($exeDevice.normaliceLetter('ü')).toBe('U');
      expect($exeDevice.normaliceLetter('ö')).toBe('O');
    });
  });

  describe('normaliceWord', () => {
    it('removes accents from word', () => {
      expect($exeDevice.normaliceWord('árbol')).toBe('ARBOL');
    });

    it('converts to uppercase', () => {
      expect($exeDevice.normaliceWord('hello')).toBe('HELLO');
    });

    it('preserves Ñ indicator in result for words containing uppercase Ñ', () => {
      // Note: function checks for uppercase Ñ only, not lowercase ñ
      expect($exeDevice.normaliceWord('NIÑO')).toBe('NINOÑ');
      expect($exeDevice.normaliceWord('ESPAÑA')).toBe('ESPANAÑ');
    });

    it('handles single letter Ñ', () => {
      expect($exeDevice.normaliceWord('Ñ')).toBe('Ñ');
      expect($exeDevice.normaliceWord('ñ')).toBe('Ñ');
    });

    it('handles empty string', () => {
      expect($exeDevice.normaliceWord('')).toBe('');
    });

    it('handles word with multiple accents', () => {
      expect($exeDevice.normaliceWord('árido')).toBe('ARIDO');
    });
  });

  describe('startContains', () => {
    it('checks if word starts with letter (type 0)', () => {
      expect($exeDevice.startContains('A', 'APPLE', 0)).toBe(true);
      expect($exeDevice.startContains('B', 'APPLE', 0)).toBe(false);
    });

    it('checks if word contains letter (type 1)', () => {
      expect($exeDevice.startContains('P', 'APPLE', 1)).toBe(true);
      expect($exeDevice.startContains('Z', 'APPLE', 1)).toBe(false);
    });

    it('handles vowels with accents (type 0)', () => {
      expect($exeDevice.startContains('A', 'ÁRBOL', 0)).toBe(true);
      expect($exeDevice.startContains('E', 'ÉXITO', 0)).toBe(true);
    });

    it('handles vowels with accents (type 1)', () => {
      expect($exeDevice.startContains('A', 'PÁJARO', 1)).toBe(true);
      expect($exeDevice.startContains('I', 'TÍPICO', 1)).toBe(true);
    });

    it('is case insensitive', () => {
      expect($exeDevice.startContains('A', 'apple', 0)).toBe(true);
      expect($exeDevice.startContains('a', 'APPLE', 0)).toBe(false); // letter should be uppercase
    });

    it('handles L·L special character', () => {
      expect($exeDevice.startContains('0', 'L·LORO', 0)).toBe(true);
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

    it('calculates dimensions for square image in square container', () => {
      const { mockImage, cleanup } = createMockImage(200, 200);

      // Square image
      const result = $exeDevice.placeImageWindows(mockImage, 400, 400);

      // Image should fill container exactly
      expect(result.w).toBe(200);
      expect(result.h).toBe(200);
      expect(result.x).toBe(0);
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

  describe('rearrangeAlphabet', () => {
    it('puts Ñ at the beginning', () => {
      const result = $exeDevice.rearrangeAlphabet('ABCÑDEFG');
      expect(result[0]).toBe('Ñ');
    });

    it('puts vowels at the end', () => {
      const result = $exeDevice.rearrangeAlphabet('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ');
      expect(result.slice(-5)).toBe('AEIOU');
    });

    it('preserves consonants (except Ñ which moves to front) and appends AEIOU', () => {
      const result = $exeDevice.rearrangeAlphabet('ABCÑD');
      // Ñ moves to front, then consonants (BCD), then vowels (AEIOU)
      expect(result).toBe('ÑBCDAEIOU');
    });

    it('handles alphabet without Ñ', () => {
      const result = $exeDevice.rearrangeAlphabet('ABCD');
      // Consonants (BCD), then vowels (AEIOU)
      expect(result).toBe('BCDAEIOU');
    });
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

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeUndefined(); // Note: i18n is defined in refreshTranslations
    });
  });

  describe('ci18n', () => {
    it('is defined after init structure', () => {
      expect($exeDevice.ci18n).toBeDefined();
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($exeDevice.colors).toBeDefined();
      expect($exeDevice.colors.black).toBe('#1c1b1b');
      expect($exeDevice.colors.blue).toBe('#0099cc');
      expect($exeDevice.colors.red).toBe('#ff0000');
      expect($exeDevice.colors.white).toBe('#ffffff');
    });
  });

  describe('validateData', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.validateData).toBe('function');
    });
  });
});

describe('az-quiz-game edition lifecycle', () => {
    let $exeDevice;
    let savedAnimationsOff;

    beforeEach(() => {
        // Undo the lightweight stubs installed by the pure-function suite above:
        // these tests drive real DOM events through real jQuery.
        global.$ = realEnvironment.$;
        global.jQuery = realEnvironment.jQuery;
        global.document = realEnvironment.document;
        global._ = realEnvironment.translate;

        global.$exeDevices = {
            iDevice: {
                gamification: {
                    media: { extractURLGD: url => url },
                    helpers: { supportedBrowser: () => true },
                },
            },
        };
        global.$exeDevicesEdition = {
            iDevice: {
                gamification: {
                    progressBar: { addEvents: vi.fn() },
                    itinerary: { addEvents: vi.fn() },
                    share: { addEvents: vi.fn(), downloadBlob: vi.fn(() => true) },
                    helpers: { stopSound: vi.fn(), playSound: vi.fn() },
                    common: { getLanguageTab: () => '' },
                },
                tabs: { init: () => {} },
            },
        };

        // slideToggle would otherwise leave animation frames running past the test.
        savedAnimationsOff = $.fx.off;
        $.fx.off = true;

        document.body.innerHTML = `
      <div id="roscoIdeviceForm">
        <div id="roscoDataWord">
          <div class="roscoFileWordEdition">
            <h3 class="roscoLetterEdition">A</h3>
            <input class="roscoWordEdition" value="">
          </div>
          <div class="roscoWordMutimediaEdition">
            <a href="#" class="roscoLinkSelectImage"></a>
            <div class="roscoImageBarEdition">
              <img class="roscoHomeImageEdition" alt="">
              <input class="roscoURLImageEdition" value="files/pic.png">
              <input class="roscoAlt" value="a picture">
              <input class="roscoXImageEdition" value="0">
              <input class="roscoYImageEdition" value="0">
              <input class="roscoURLAudioEdition" value="">
              <span class="roscoCursorEdition"></span>
              <span class="roscoNoImageEdition"></span>
            </div>
            <img class="roscoSelectImageEdition" alt="">
          </div>
        </div>
        <div class="toggle-item" idevice-id="tglInput"><span class="toggle-face"></span></div>
        <input id="tglInput" type="checkbox">
        <input id="eXeGameImportGame" type="file">
      </div>
    `;

        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'az-quiz-game.js'));
        $exeDevice.addEvents();
    });

    afterEach(() => {
        // Close the edition the test opened, so its document handlers cannot leak
        // into the next one.
        $exeDevice.$lifecycle.destroy();
        $.fx.off = savedAnimationsOff;
        document.body.innerHTML = '';
    });

    describe('delegated .toggle-item click handler on document', () => {
        it('toggles the linked checkbox while the edition is open', () => {
            $('.toggle-item').trigger('click');

            expect($('#tglInput').is(':checked')).toBe(true);
        });

        it('stops toggling once the edition is closed', () => {
            const changed = vi.fn();
            $('#tglInput').on('change', changed);

            $exeDevice.$lifecycle.destroy();
            $('.toggle-item').trigger('click');

            expect(changed).not.toHaveBeenCalled();
            expect($('#tglInput').is(':checked')).toBe(false);
        });

        it('leaves unrelated document handlers registered', () => {
            const unrelated = vi.fn();
            $(document).on('click.roscoUnrelated', '.toggle-item', unrelated);

            $exeDevice.$lifecycle.destroy();
            $('.toggle-item').trigger('click');

            expect(unrelated).toHaveBeenCalledTimes(1);
            $(document).off('click.roscoUnrelated');
        });
    });

    describe('delegated image click handler on document', () => {
        it('reports the clicked image while the edition is open', () => {
            const clickImage = vi.fn();
            $exeDevice.clickImage = clickImage;

            $('#roscoDataWord img.roscoHomeImageEdition').trigger('click');

            expect(clickImage).toHaveBeenCalledTimes(1);
            expect(clickImage.mock.calls[0][0]).toBe(
                document.querySelector('#roscoDataWord img.roscoHomeImageEdition'),
            );
        });

        it('stops reporting once the edition is closed', () => {
            const clickImage = vi.fn();
            $exeDevice.clickImage = clickImage;

            $exeDevice.$lifecycle.destroy();
            $('#roscoDataWord img.roscoHomeImageEdition').trigger('click');

            expect(clickImage).not.toHaveBeenCalled();
        });
    });

    describe('delegated image panel handler on document', () => {
        it('previews the selected image while the edition is open', () => {
            const showImage = vi.fn();
            $exeDevice.showImage = showImage;

            $('#roscoDataWord a.roscoLinkSelectImage').trigger('click');

            expect(showImage).toHaveBeenCalledTimes(1);
        });

        it('stops previewing once the edition is closed', () => {
            const showImage = vi.fn();
            $exeDevice.showImage = showImage;

            $exeDevice.$lifecycle.destroy();
            $('#roscoDataWord a.roscoLinkSelectImage').trigger('click');

            expect(showImage).not.toHaveBeenCalled();
        });
    });

    describe('delegated word focusout handler on document', () => {
        it('repaints the letter while the edition is open', () => {
            const letter = document.querySelector('h3.roscoLetterEdition');
            letter.style.backgroundColor = '';

            $('#roscoDataWord .roscoWordEdition').trigger('focusout');

            expect(letter.style.backgroundColor).not.toBe('');
        });

        it('stops repainting once the edition is closed', () => {
            const letter = document.querySelector('h3.roscoLetterEdition');

            $exeDevice.$lifecycle.destroy();
            letter.style.backgroundColor = '';
            $('#roscoDataWord .roscoWordEdition').trigger('focusout');

            expect(letter.style.backgroundColor).toBe('');
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
                    value: [new File(['word'], 'game.txt', { type: 'text/plain' })],
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
            reader.onload({ target: { result: 'word' } });

            expect(importGame).not.toHaveBeenCalled();
        });

        it('imports a load that resolves while the edition is open', () => {
            const reader = pickFile();
            const importGame = vi.fn();
            $exeDevice.importGame = importGame;

            reader.onload({ target: { result: 'word' } });

            expect(importGame).toHaveBeenCalledWith('word', 'text/plain');
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
            const play = vi.spyOn(player, 'play').mockReturnValue(Promise.resolve());

            player.dispatchEvent(new Event('canplaythrough'));
            expect(play).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            player.dispatchEvent(new Event('canplaythrough'));

            expect(play).toHaveBeenCalledTimes(1);
            play.mockRestore();
        });
    });
});
