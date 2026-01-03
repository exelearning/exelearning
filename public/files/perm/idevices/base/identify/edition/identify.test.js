/**
 * Unit tests for identify iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - validTime: Time format validation
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

describe('identify iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'identify.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
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

    it('handles landscape container with landscape image', () => {
      const { mockImage, cleanup } = createMockImage(400, 200);

      // Wide container, wider image
      const result = $exeDevice.placeImageWindows(mockImage, 800, 300);

      // Should scale based on the more constrained dimension
      expect(result.w).toBe(400);
      expect(result.h).toBe(150);
      expect(result.x).toBe(0);
      expect(result.y).toBe(25);

      cleanup();
    });

    it('handles portrait container with portrait image', () => {
      const { mockImage, cleanup } = createMockImage(200, 400);

      // Tall container, taller image
      const result = $exeDevice.placeImageWindows(mockImage, 300, 800);

      // Should scale based on the more constrained dimension
      expect(result.w).toBe(150);
      expect(result.h).toBe(400);
      expect(result.x).toBe(25);
      expect(result.y).toBe(0);

      cleanup();
    });

    it('handles zero or invalid container dimensions', () => {
      const { mockImage, cleanup } = createMockImage(0, 0);

      // Container with zero dimensions (falls back to 1)
      const result = $exeDevice.placeImageWindows(mockImage, 100, 100);

      // Should handle gracefully with fallback values
      expect(result).toBeDefined();
      expect(typeof result.w).toBe('number');
      expect(typeof result.h).toBe('number');

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

  describe('getCuestionDefault', () => {
    it('returns a default question object with correct structure', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();

      expect(defaultQuestion).toHaveProperty('url');
      expect(defaultQuestion).toHaveProperty('audio');
      expect(defaultQuestion).toHaveProperty('x');
      expect(defaultQuestion).toHaveProperty('y');
      expect(defaultQuestion).toHaveProperty('author');
      expect(defaultQuestion).toHaveProperty('alt');
      expect(defaultQuestion).toHaveProperty('question');
      expect(defaultQuestion).toHaveProperty('clues');
    });

    it('returns a new object each time', () => {
      const q1 = $exeDevice.getCuestionDefault();
      const q2 = $exeDevice.getCuestionDefault();

      expect(q1).not.toBe(q2);
    });
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
    });
  });
});
