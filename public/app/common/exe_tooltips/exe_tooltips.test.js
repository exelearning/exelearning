import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read script content for string-matching tests
const scriptPath = join(__dirname, 'exe_tooltips.js');
const scriptContent = readFileSync(scriptPath, 'utf-8');

// Setup globals BEFORE requiring the module
const mockJQuery = vi.fn((selector) => {
  return {
    length: 0,
    each: vi.fn(),
    attr: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnValue(''),
    qtip: vi.fn(),
    html: vi.fn().mockReturnValue(''),
    append: vi.fn(),
    next: vi.fn().mockReturnValue({ length: 0, html: vi.fn().mockReturnValue('') }),
    eq: vi.fn().mockReturnThis(),
  };
});
mockJQuery.ajax = vi.fn().mockReturnValue({
  then: vi.fn(),
  done: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
});
globalThis.$ = mockJQuery;

// Mock $exe global
globalThis.$exe = {
  loadScript: vi.fn(),
};

// Now require the module to get coverage
const exeTooltips = require('./exe_tooltips.js');

// Assign to globalThis for tests that expect it there
globalThis.$exe.tooltips = exeTooltips;

describe('exe_tooltips.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockJQuery.mockImplementation((selector) => {
      return {
        length: 0,
        each: vi.fn(),
        attr: vi.fn().mockReturnThis(),
        text: vi.fn().mockReturnValue(''),
        qtip: vi.fn(),
        html: vi.fn().mockReturnValue(''),
        append: vi.fn(),
        next: vi.fn().mockReturnValue({ length: 0, html: vi.fn().mockReturnValue('') }),
        eq: vi.fn().mockReturnThis(),
      };
    });

    // Reset $exe.tooltips state
    globalThis.$exe.tooltips.isAJAXAllowed = undefined;
    globalThis.$exe.tooltips.path = undefined;
    globalThis.$exe.tooltips.viewport = undefined;
    globalThis.$exe.tooltips.links = undefined;

    // Mock window for init tests
    globalThis.window = {
      location: {
        protocol: 'http:',
      },
    };

    // Mock document.body for init tests
    globalThis.document = {
      body: {
        className: '',
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('script structure', () => {
    it('should define $exe.tooltips object', () => {
      expect(exeTooltips).toBeDefined();
      expect(typeof exeTooltips).toBe('object');
    });

    it('should have className property set to exe-tooltip', () => {
      expect(exeTooltips.className).toBe('exe-tooltip');
    });

    it('should have init method', () => {
      expect(typeof exeTooltips.init).toBe('function');
    });

    it('should have loadCSS method', () => {
      expect(typeof exeTooltips.loadCSS).toBe('function');
    });

    it('should have loadJS method', () => {
      expect(typeof exeTooltips.loadJS).toBe('function');
    });

    it('should have run method', () => {
      expect(typeof exeTooltips.run).toBe('function');
    });
  });

  describe('getTooltipTitle', () => {
    it('should return empty string for null input', () => {
      const result = globalThis.$exe.tooltips.getTooltipTitle(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined input', () => {
      const result = globalThis.$exe.tooltips.getTooltipTitle(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for empty string input', () => {
      const result = globalThis.$exe.tooltips.getTooltipTitle('');
      expect(result).toBe('');
    });

    it('should return empty string when no separator present', () => {
      const result = globalThis.$exe.tooltips.getTooltipTitle('Just some text');
      expect(result).toBe('');
    });

    it('should return title part before " | " separator', () => {
      const result = globalThis.$exe.tooltips.getTooltipTitle('Title | Content text');
      expect(result).toBe('Title');
    });

    it('should return only first part when multiple separators exist', () => {
      const result = globalThis.$exe.tooltips.getTooltipTitle('Title | Part 2 | Part 3');
      expect(result).toBe('');
    });

    it('should handle title with spaces', () => {
      const result = globalThis.$exe.tooltips.getTooltipTitle('My Long Title | Description here');
      expect(result).toBe('My Long Title');
    });

    it('should handle separator at beginning', () => {
      const result = globalThis.$exe.tooltips.getTooltipTitle(' | Content only');
      expect(result).toBe('');
    });
  });

  describe('getTooltipText', () => {
    it('should return original text when no separator present', () => {
      const result = globalThis.$exe.tooltips.getTooltipText('Just some text');
      expect(result).toBe('Just some text');
    });

    it('should return text part after " | " separator', () => {
      const result = globalThis.$exe.tooltips.getTooltipText('Title | Content text');
      expect(result).toBe('Content text');
    });

    it('should return original text when multiple separators exist', () => {
      const result = globalThis.$exe.tooltips.getTooltipText('Part 1 | Part 2 | Part 3');
      // Since split gives array > 2, it returns original text
      expect(result).toBe('Part 1 | Part 2 | Part 3');
    });

    it('should handle empty text after separator', () => {
      const result = globalThis.$exe.tooltips.getTooltipText('Title | ');
      expect(result).toBe('');
    });

    it('should handle text with HTML content', () => {
      const result = globalThis.$exe.tooltips.getTooltipText('Title | <b>Bold</b> text');
      expect(result).toBe('<b>Bold</b> text');
    });
  });

  describe('getFriendlyURL', () => {
    it('should convert text to lowercase', () => {
      const result = globalThis.$exe.tooltips.getFriendlyURL('UPPERCASE');
      expect(result).toBe('uppercase');
    });

    it('should replace spaces with dashes', () => {
      const result = globalThis.$exe.tooltips.getFriendlyURL('hello world');
      expect(result).toBe('hello-world');
    });

    it('should remove special characters', () => {
      const result = globalThis.$exe.tooltips.getFriendlyURL('hello@world!');
      expect(result).toBe('helloworld');
    });

    it('should remove punctuation', () => {
      const result = globalThis.$exe.tooltips.getFriendlyURL('hello, world.');
      expect(result).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      const result = globalThis.$exe.tooltips.getFriendlyURL('hello   world');
      expect(result).toBe('hello---world');
    });

    it('should handle accented characters', () => {
      const result = globalThis.$exe.tooltips.getFriendlyURL('café résumé');
      expect(result).toBe('caf-rsum');
    });

    it('should handle empty string', () => {
      const result = globalThis.$exe.tooltips.getFriendlyURL('');
      expect(result).toBe('');
    });

    it('should handle only special characters', () => {
      const result = globalThis.$exe.tooltips.getFriendlyURL('!@#$%');
      expect(result).toBe('');
    });

    it('should handle mixed content', () => {
      const result = globalThis.$exe.tooltips.getFriendlyURL('My Title: A Test (2024)');
      expect(result).toBe('my-title-a-test-2024');
    });
  });

  describe('getClasses', () => {
    it('should return empty string for no matching classes', () => {
      const result = globalThis.$exe.tooltips.getClasses('plain with-button');
      expect(result).toBe('');
    });

    it('should return light class', () => {
      const result = globalThis.$exe.tooltips.getClasses(' light-tt');
      expect(result).toBe('qtip-light');
    });

    it('should return dark class', () => {
      const result = globalThis.$exe.tooltips.getClasses(' dark-tt');
      expect(result).toBe('qtip-dark');
    });

    it('should return red class', () => {
      const result = globalThis.$exe.tooltips.getClasses(' red-tt');
      expect(result).toBe('qtip-red');
    });

    it('should return blue class', () => {
      const result = globalThis.$exe.tooltips.getClasses(' blue-tt');
      expect(result).toBe('qtip-blue');
    });

    it('should return green class', () => {
      const result = globalThis.$exe.tooltips.getClasses(' green-tt');
      expect(result).toBe('qtip-green');
    });

    it('should add rounded class', () => {
      const result = globalThis.$exe.tooltips.getClasses('rounded-tt');
      expect(result).toBe(' qtip-rounded');
    });

    it('should add shadowed class', () => {
      const result = globalThis.$exe.tooltips.getClasses('shadowed-tt');
      expect(result).toBe(' qtip-shadow');
    });

    it('should add definition class', () => {
      const result = globalThis.$exe.tooltips.getClasses('definition-tt');
      expect(result).toBe(' qtip-definition');
    });

    it('should combine color with rounded', () => {
      const result = globalThis.$exe.tooltips.getClasses(' light-tt rounded-tt');
      expect(result).toBe('qtip-light qtip-rounded');
    });

    it('should combine color with multiple modifiers', () => {
      const result = globalThis.$exe.tooltips.getClasses(' dark-tt rounded-tt shadowed-tt');
      expect(result).toBe('qtip-dark qtip-rounded qtip-shadow');
    });

    it('should combine all modifiers without color', () => {
      const result = globalThis.$exe.tooltips.getClasses('rounded-tt shadowed-tt definition-tt');
      expect(result).toBe(' qtip-rounded qtip-shadow qtip-definition');
    });

    it('should handle full complex class string', () => {
      const result = globalThis.$exe.tooltips.getClasses('plain  blue-tt with-button rounded-tt shadowed-tt');
      expect(result).toBe('qtip-blue qtip-rounded qtip-shadow');
    });
  });

  describe('hasCloseButton', () => {
    it('should always return false', () => {
      expect(globalThis.$exe.tooltips.hasCloseButton()).toBe(false);
      expect(globalThis.$exe.tooltips.hasCloseButton({})).toBe(false);
      expect(globalThis.$exe.tooltips.hasCloseButton('anything')).toBe(false);
    });
  });

  describe('autoClose', () => {
    it('should always return true', () => {
      expect(globalThis.$exe.tooltips.autoClose()).toBe(true);
    });
  });

  describe('init', () => {
    it('should set path property', () => {
      globalThis.$exe.tooltips.init('/test/path/');
      expect(globalThis.$exe.tooltips.path).toBe('/test/path/');
    });

    it('should set viewport to window', () => {
      globalThis.$exe.tooltips.init('/test/path/');
      expect(globalThis.$exe.tooltips.viewport).toBeDefined();
    });

    it('should not call loadCSS when no tooltip links found', () => {
      const loadCSSSpy = vi.spyOn(globalThis.$exe.tooltips, 'loadCSS');
      globalThis.$exe.tooltips.init('/test/path/');
      expect(loadCSSSpy).not.toHaveBeenCalled();
    });

    it('should call loadCSS when tooltip links found', () => {
      // Mock jQuery to return elements
      globalThis.$.mockReturnValue({
        length: 1,
        each: vi.fn(),
      });

      const loadCSSSpy = vi.spyOn(globalThis.$exe.tooltips, 'loadCSS').mockImplementation(() => {});
      globalThis.$exe.tooltips.init('/test/path/');

      expect(loadCSSSpy).toHaveBeenCalled();
    });

    it('should set isAJAXAllowed when protocol is http', () => {
      globalThis.window.location.protocol = 'http:';
      globalThis.$exe.tooltips.init('/test/path/');
      expect(globalThis.$exe.tooltips.isAJAXAllowed).toBe(true);
    });

    it('should set isAJAXAllowed when protocol is https', () => {
      globalThis.window.location.protocol = 'https:';
      globalThis.$exe.tooltips.init('/test/path/');
      expect(globalThis.$exe.tooltips.isAJAXAllowed).toBe(true);
    });

    it('should not set isAJAXAllowed for file protocol', () => {
      globalThis.window.location.protocol = 'file:';
      globalThis.$exe.tooltips.init('/test/path/');
      expect(globalThis.$exe.tooltips.isAJAXAllowed).toBeUndefined();
    });

    it('should disable AJAX for single page mode', () => {
      globalThis.window.location.protocol = 'http:';
      globalThis.document.body.className = 'exe-single-page';
      globalThis.$exe.tooltips.init('/test/path/');
      expect(globalThis.$exe.tooltips.isAJAXAllowed).toBe(false);
    });
  });

  describe('loadCSS', () => {
    it('should load CSS file using $exe.loadScript', () => {
      globalThis.$exe.tooltips.path = '/test/path/';
      globalThis.$exe.tooltips.loadCSS();

      expect(globalThis.$exe.loadScript).toHaveBeenCalledWith('/test/path/jquery.qtip.min.css');
    });
  });

  describe('loadJS', () => {
    it('should load qTip JS with callback', () => {
      globalThis.$exe.tooltips.path = '/test/path/';
      globalThis.$exe.tooltips.loadJS();

      expect(globalThis.$exe.loadScript).toHaveBeenCalledWith(
        '/test/path/jquery.qtip.min.js',
        '$exe.tooltips.loadImageLoader()'
      );
    });
  });

  describe('loadImageLoader', () => {
    it('should load imagesloaded JS with callback', () => {
      globalThis.$exe.tooltips.path = '/test/path/';
      globalThis.$exe.tooltips.loadImageLoader();

      expect(globalThis.$exe.loadScript).toHaveBeenCalledWith(
        '/test/path/imagesloaded.pkg.min.js',
        '$exe.tooltips.run()'
      );
    });
  });

  describe('getPageName', () => {
    it('should return href if no matching nav link', () => {
      const result = globalThis.$exe.tooltips.getPageName('test.html');
      expect(result).toBe('test.html');
    });
  });
});
