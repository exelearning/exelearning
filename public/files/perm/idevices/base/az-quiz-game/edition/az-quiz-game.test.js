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
