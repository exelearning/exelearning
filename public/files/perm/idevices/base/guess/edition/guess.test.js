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
