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
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      $exeDevice.ideviceBody = container;
      $exeDevice.idevicePath = '/test/';
      $exeDevice.ci18n = {};

      originalExeLearning = global.eXeLearning;
      originalExeDevicesEdition = global.$exeDevicesEdition;

      global.eXeLearning = {
        app: {
          project: { odeId: 'ode-id' },
        },
      };
      global.$exeDevicesEdition = {
        iDevice: {
          tabs: { init: vi.fn() },
          common: {
            getTextFieldset: vi.fn(() => '<div class="mock-after"></div>'),
            getIdeviceDescription: vi.fn(
              () =>
                '<p class="alert alert-info alert-dismissible fade show mb-3" role="alert">mock description<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Hide"></button></p>',
            ),
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
          },
        },
      };
      $exeDevice.enableForm = vi.fn();
    });

    afterEach(() => {
      global.eXeLearning = originalExeLearning;
      global.$exeDevicesEdition = originalExeDevicesEdition;
    });

    it('renders shared progress bar contents through the helper', () => {
      $exeDevice.createForm();
      const progressBar = global.$exeDevicesEdition.iDevice.gamification.progressBar;
      expect(progressBar.getContents).toHaveBeenCalledWith('/test/');
      expect(container.querySelector('.mock-progress-bar')).not.toBeNull();
    });
  });

  describe('addEvents', () => {
    let originalExeDevicesEdition;

    beforeEach(() => {
      originalExeDevicesEdition = global.$exeDevicesEdition;
      global.$exeDevicesEdition = {
        iDevice: {
          gamification: {
            itinerary: { addEvents: vi.fn() },
            share: { addEvents: vi.fn() },
            progressBar: { addEvents: vi.fn() },
          },
        },
      };
    });

    afterEach(() => {
      global.$exeDevicesEdition = originalExeDevicesEdition;
    });

    it('registers shared progress bar events', () => {
      $exeDevice.addEvents();
      expect(
        global.$exeDevicesEdition.iDevice.gamification.progressBar.addEvents,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
