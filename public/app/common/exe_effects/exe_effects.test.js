import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock jQuery
const mockJQuery = vi.fn((selector) => {
  const element = {
    html: vi.fn().mockReturnThis(),
    addClass: vi.fn().mockReturnThis(),
    removeClass: vi.fn().mockReturnThis(),
    animate: vi.fn().mockReturnThis(),
    attr: vi.fn().mockReturnThis(),
    css: vi.fn().mockReturnThis(),
    find: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnValue('Test Title'),
    show: vi.fn().mockReturnThis(),
    hide: vi.fn().mockReturnThis(),
    slideDown: vi.fn((duration, callback) => {
      if (callback) callback();
      return element;
    }),
    slideUp: vi.fn().mockReturnThis(),
    each: vi.fn((callback) => {
      // Mock each iteration with proper context
      callback.call({ className: 'test-class' }, 0);
      return element;
    }),
    wrap: vi.fn().mockReturnThis(),
    prepend: vi.fn().mockReturnThis(),
    append: vi.fn().mockReturnThis(),
    fadeIn: vi.fn((speed, callback) => {
      if (callback) callback();
      return element;
    }),
    click: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnValue(false),
    hasClass: vi.fn().mockReturnValue(false),
    parent: vi.fn().mockReturnThis(),
    parents: vi.fn().mockReturnThis(),
    length: 1,
    0: { className: 'test-class', id: 'test-id', nodeName: 'DIV', localName: 'div' },
    className: 'test-class',
    id: 'test-id',
    src: '',
    style: { height: '' }
  };
  return element;
});

// Add jQuery utilities
mockJQuery.extend = vi.fn((target, ...sources) => {
  sources.forEach(source => {
    Object.assign(target, source);
  });
  return target;
});

mockJQuery.map = vi.fn((array, callback) => {
  if (Array.isArray(array)) {
    return array.map(callback);
  }
  return [];
});

mockJQuery.each = vi.fn((array, callback) => {
  if (Array.isArray(array)) {
    array.forEach(callback);
  }
});

mockJQuery.timeliner = vi.fn();

// Mock global objects
global.$ = mockJQuery;
global.jQuery = mockJQuery; // Also add jQuery global for timeliner plugin
global.window = {
  eXeLearning: undefined
};
global.document = {
  body: {
    className: ''
  },
  getElementById: vi.fn((id) => ({
    id,
    className: 'mock-element'
  })),
  ready: vi.fn()
};

global.navigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124'
};

// Mock $exe object (used by timeline.getColor)
global.$exe = {
  rgb2hex: vi.fn((rgb) => '#000000'),
  useBlackOrWhite: vi.fn((hex) => '#ffffff')
};

// Load the module - this will set global $exeFX and $exeFX_i18n
// We only load it once, not in beforeEach
require('./exe_effects.js');

describe('exe_effects.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset $exeFX state
    if (global.$exeFX) {
      global.$exeFX.isOldBrowser = false;
      global.$exeFX.h2 = 'h2';

      if (global.$exeFX.carousel) {
        global.$exeFX.carousel.isWorking = false;
      }
    }

    // Reset navigator user agent to default
    global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124';
  });

  describe('$exeFX_i18n', () => {
    it('should define the localization object', () => {
      expect(global.$exeFX_i18n).toBeDefined();
    });

    it('should have all required i18n strings', () => {
      expect(global.$exeFX_i18n.previous).toBe('Previous');
      expect(global.$exeFX_i18n.next).toBe('Next');
      expect(global.$exeFX_i18n.show).toBe('Show');
      expect(global.$exeFX_i18n.hide).toBe('Hide');
      expect(global.$exeFX_i18n.showFeedback).toBe('Show Feedback');
      expect(global.$exeFX_i18n.hideFeedback).toBe('Hide Feedback');
      expect(global.$exeFX_i18n.correct).toBe('Correct');
      expect(global.$exeFX_i18n.incorrect).toBe('Incorrect');
      expect(global.$exeFX_i18n.menu).toBe('Menu');
      expect(global.$exeFX_i18n.download).toBe('Download');
      expect(global.$exeFX_i18n.yourScoreIs).toBe('Your score is ');
      expect(global.$exeFX_i18n.dataError).toBe('Error recovering data');
      expect(global.$exeFX_i18n.epubJSerror).toBe('This might not work in this ePub reader.');
      expect(global.$exeFX_i18n.solution).toBe('Solution');
      expect(global.$exeFX_i18n.epubDisabled).toBe('This activity does not work in ePub.');
      expect(global.$exeFX_i18n.print).toBe('Print');
    });
  });

  describe('$exeFX object structure', () => {
    it('should define the $exeFX object', () => {
      expect(global.$exeFX).toBeDefined();
      expect(typeof global.$exeFX).toBe('object');
    });

    it('should have correct baseClass property', () => {
      expect(global.$exeFX.baseClass).toBe('exe');
    });

    it('should have correct h2 property', () => {
      expect(global.$exeFX.h2).toBe('h2');
    });

    it('should have correct isOldBrowser property', () => {
      expect(global.$exeFX.isOldBrowser).toBe(false);
    });

    it('should have init function', () => {
      expect(typeof global.$exeFX.init).toBe('function');
    });

    it('should have hex2rgb function', () => {
      expect(typeof global.$exeFX.hex2rgb).toBe('function');
    });

    it('should have h5pResize function', () => {
      expect(typeof global.$exeFX.h5pResize).toBe('function');
    });

    it('should have removeXMLNS function', () => {
      expect(typeof global.$exeFX.removeXMLNS).toBe('function');
    });

    it('should have rftTitles function', () => {
      expect(typeof global.$exeFX.rftTitles).toBe('function');
    });

    it('should have noFX function', () => {
      expect(typeof global.$exeFX.noFX).toBe('function');
    });

    it('should have checkIE function', () => {
      expect(typeof global.$exeFX.checkIE).toBe('function');
    });
  });

  describe('hex2rgb function', () => {
    it('should convert hex to rgb without alpha', () => {
      const result = global.$exeFX.hex2rgb('#ff0000');
      expect(result).toBe('rgb(255,0,0)');
    });

    it('should convert hex to rgba with alpha', () => {
      const result = global.$exeFX.hex2rgb('#ff0000', '0.5');
      expect(result).toBe('rgba(255,0,0,0.5)');
    });

    it('should handle blue color correctly', () => {
      const result = global.$exeFX.hex2rgb('#0000ff');
      expect(result).toBe('rgb(0,0,255)');
    });

    it('should handle green color correctly', () => {
      const result = global.$exeFX.hex2rgb('#00ff00');
      expect(result).toBe('rgb(0,255,0)');
    });

    it('should handle white color correctly', () => {
      const result = global.$exeFX.hex2rgb('#ffffff');
      expect(result).toBe('rgb(255,255,255)');
    });

    it('should handle black color correctly', () => {
      const result = global.$exeFX.hex2rgb('#000000');
      expect(result).toBe('rgb(0,0,0)');
    });

    it('should handle mixed color with alpha', () => {
      const result = global.$exeFX.hex2rgb('#336699', '0.8');
      expect(result).toBe('rgba(51,102,153,0.8)');
    });

    it('should handle color with lowercase hex', () => {
      const result = global.$exeFX.hex2rgb('#abc123');
      expect(result).toBe('rgb(171,193,35)');
    });

    it('should handle color with uppercase hex', () => {
      const result = global.$exeFX.hex2rgb('#ABC123');
      expect(result).toBe('rgb(171,193,35)');
    });

    it('should handle alpha parameter as string', () => {
      const result = global.$exeFX.hex2rgb('#ff00ff', '1');
      expect(result).toBe('rgba(255,0,255,1)');
    });
  });

  describe('checkIE function', () => {
    it('should return false for non-IE user agent', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124';
      const result = global.$exeFX.checkIE();
      expect(result).toBe(false);
    });

    it('should return version number for IE 7 user agent', () => {
      global.navigator.userAgent = 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)';
      const result = global.$exeFX.checkIE();
      expect(result).toBe(7);
    });

    it('should return version number for IE 8 user agent', () => {
      global.navigator.userAgent = 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)';
      const result = global.$exeFX.checkIE();
      expect(result).toBe(8);
    });

    it('should return version number for IE 9 user agent', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1)';
      const result = global.$exeFX.checkIE();
      expect(result).toBe(9);
    });

    it('should return version number for IE 10 user agent', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2)';
      const result = global.$exeFX.checkIE();
      expect(result).toBe(10);
    });

    it('should return version number for IE 11 user agent', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko';
      const result = global.$exeFX.checkIE();
      expect(result).toBe(false); // IE 11 doesn't have 'msie' in user agent
    });

    it('should return false for Firefox user agent', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
      const result = global.$exeFX.checkIE();
      expect(result).toBe(false);
    });

    it('should return false for Safari user agent', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
      const result = global.$exeFX.checkIE();
      expect(result).toBe(false);
    });
  });

  describe('accordion sub-object', () => {
    it('should have accordion object', () => {
      expect(global.$exeFX.accordion).toBeDefined();
      expect(typeof global.$exeFX.accordion).toBe('object');
    });

    it('should have closeBlock function', () => {
      expect(typeof global.$exeFX.accordion.closeBlock).toBe('function');
    });

    it('should have enable function', () => {
      expect(typeof global.$exeFX.accordion.enable).toBe('function');
    });

    it('should have rft function', () => {
      expect(typeof global.$exeFX.accordion.rft).toBe('function');
    });

    it('should have init function', () => {
      expect(typeof global.$exeFX.accordion.init).toBe('function');
    });
  });

  describe('timeline sub-object', () => {
    it('should have timeline object', () => {
      expect(global.$exeFX.timeline).toBeDefined();
      expect(typeof global.$exeFX.timeline).toBe('object');
    });

    it('should have getColor function', () => {
      expect(typeof global.$exeFX.timeline.getColor).toBe('function');
    });

    it('should have rft function', () => {
      expect(typeof global.$exeFX.timeline.rft).toBe('function');
    });

    it('should have init function', () => {
      expect(typeof global.$exeFX.timeline.init).toBe('function');
    });
  });

  describe('tabs sub-object', () => {
    it('should have tabs object', () => {
      expect(global.$exeFX.tabs).toBeDefined();
      expect(typeof global.$exeFX.tabs).toBe('object');
    });

    it('should have show function', () => {
      expect(typeof global.$exeFX.tabs.show).toBe('function');
    });

    it('should have rft function', () => {
      expect(typeof global.$exeFX.tabs.rft).toBe('function');
    });

    it('should have init function', () => {
      expect(typeof global.$exeFX.tabs.init).toBe('function');
    });
  });

  describe('paginated sub-object', () => {
    it('should have paginated object', () => {
      expect(global.$exeFX.paginated).toBeDefined();
      expect(typeof global.$exeFX.paginated).toBe('object');
    });

    it('should have show function', () => {
      expect(typeof global.$exeFX.paginated.show).toBe('function');
    });

    it('should have init function', () => {
      expect(typeof global.$exeFX.paginated.init).toBe('function');
    });

    it('should have rft function', () => {
      expect(typeof global.$exeFX.paginated.rft).toBe('function');
    });
  });

  describe('carousel sub-object', () => {
    it('should have carousel object', () => {
      expect(global.$exeFX.carousel).toBeDefined();
      expect(typeof global.$exeFX.carousel).toBe('object');
    });

    it('should have isWorking property', () => {
      expect(global.$exeFX.carousel.isWorking).toBe(false);
    });

    it('should have show function', () => {
      expect(typeof global.$exeFX.carousel.show).toBe('function');
    });

    it('should have init function', () => {
      expect(typeof global.$exeFX.carousel.init).toBe('function');
    });

    it('should have rft function', () => {
      expect(typeof global.$exeFX.carousel.rft).toBe('function');
    });
  });

  describe('removeXMLNS function', () => {
    it('should return unchanged text for non-epub3', () => {
      global.document.body.className = '';
      const input = '<h2 xmlns="http://www.w3.org/1999/xhtml">Test</h2>';
      const result = global.$exeFX.removeXMLNS(input);
      expect(result).toBe(input);
    });

    it('should remove xmlns for epub3', () => {
      global.document.body.className = 'exe-epub3';
      const input = '<h2 xmlns="http://www.w3.org/1999/xhtml">Test</h2>';
      const result = global.$exeFX.removeXMLNS(input);
      expect(result).toBe('<h2>Test</h2>');
    });

    it('should handle multiple xmlns occurrences in epub3', () => {
      global.document.body.className = 'exe-epub3';
      const input = '<h2 xmlns="http://www.w3.org/1999/xhtml">Test</h2><h2 xmlns="http://www.w3.org/1999/xhtml">Test2</h2>';
      const result = global.$exeFX.removeXMLNS(input);
      expect(result).toBe('<h2>Test</h2><h2>Test2</h2>');
    });
  });

  describe('noFX function', () => {
    it('should clear class and add padding', () => {
      const mockElement = {
        attr: vi.fn().mockReturnThis(),
        css: vi.fn().mockReturnThis()
      };

      global.$exeFX.noFX(mockElement);

      expect(mockElement.attr).toHaveBeenCalledWith('class', '');
      expect(mockElement.css).toHaveBeenCalledWith('padding', '1em');
    });
  });

  describe('init function', () => {
    it('should set isOldBrowser to true for IE < 9', () => {
      global.navigator.userAgent = 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)';

      global.$exeFX.init();

      expect(global.$exeFX.isOldBrowser).toBe(true);
      expect(global.$exeFX.h2).toBe('H2');
    });

    it('should keep isOldBrowser false for modern browsers', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124';

      global.$exeFX.init();

      expect(global.$exeFX.isOldBrowser).toBe(false);
      expect(global.$exeFX.h2).toBe('h2');
    });

    it('should keep isOldBrowser false for IE 9+', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1)';

      global.$exeFX.init();

      expect(global.$exeFX.isOldBrowser).toBe(false);
      expect(global.$exeFX.h2).toBe('h2');
    });

    it('should call jQuery selector for effect containers', () => {
      global.$exeFX.init();

      expect(mockJQuery).toHaveBeenCalledWith('.exe-fx');
    });
  });

  describe('timeline.getColor function', () => {
    it('should return color if not rgb format', () => {
      const mockElement = {
        css: vi.fn().mockReturnValue('#ff0000')
      };

      const result = global.$exeFX.timeline.getColor(mockElement);

      expect(result).toBe('#ff0000');
      expect(mockElement.css).toHaveBeenCalledWith('color');
    });

    it('should convert rgb to hex', () => {
      const mockElement = {
        css: vi.fn().mockReturnValue('rgb(255, 0, 0)')
      };

      global.$exe.rgb2hex.mockReturnValue('#ff0000');

      const result = global.$exeFX.timeline.getColor(mockElement);

      expect(global.$exe.rgb2hex).toHaveBeenCalledWith('rgb(255, 0, 0)');
      expect(result).toBe('#ff0000');
    });
  });

  describe('carousel.show function', () => {
    it('should return false if isWorking is true', () => {
      global.$exeFX.carousel.isWorking = true;

      const result = global.$exeFX.carousel.show('test-id', 'test-item', 0);

      expect(result).toBe(false);
      expect(global.$exeFX.carousel.isWorking).toBe(true);
    });

    it('should attempt to show carousel when called with valid elements', () => {
      global.$exeFX.carousel.isWorking = false;

      // Mock document.getElementById to return proper elements
      global.document.getElementById = vi.fn((id) => {
        if (id.includes('prev-lnk') || id.includes('next-lnk')) {
          return { id, className: 'link-class', onclick: null };
        }
        return null;
      });

      // Mock jQuery to return proper structure for carousel with enough items
      const mockLis = {
        length: 5, // 2 navigation + 3 content items (needs > 3 to not return early)
        removeClass: vi.fn().mockReturnThis(),
        addClass: vi.fn().mockReturnThis()
      };

      const mockContent = {
        hide: vi.fn().mockReturnThis()
      };

      const mockFadeElement = {
        addClass: vi.fn().mockReturnThis(),
        removeClass: vi.fn().mockReturnThis(),
        hide: vi.fn().mockReturnThis(),
        fadeIn: vi.fn((speed, callback) => {
          if (callback) callback.call(mockFadeElement);
          return mockFadeElement;
        })
      };

      global.$ = vi.fn((selector) => {
        if (typeof selector === 'string' && selector.includes('.fx-carousel-pagination li')) {
          return mockLis;
        }
        if (typeof selector === 'string' && selector.includes('.fx-carousel-content')) {
          return mockContent;
        }
        if (typeof selector === 'string' && selector.startsWith('#')) {
          // For ID selectors, return proper mock
          if (selector.includes('-link')) {
            return {
              addClass: vi.fn().mockReturnThis(),
              removeClass: vi.fn().mockReturnThis()
            };
          }
          return mockFadeElement;
        }
        return mockJQuery(selector);
      });
      global.$.extend = mockJQuery.extend;
      global.$.map = mockJQuery.map;
      global.$.each = mockJQuery.each;
      global.$.timeliner = mockJQuery.timeliner;

      // Call the function
      const result = global.$exeFX.carousel.show('test-id', 'test-item', 1);

      // Should not return false (which means it processed)
      expect(result).not.toBe(false);

      // After fadeIn completes, isWorking should be set back to false
      expect(global.$exeFX.carousel.isWorking).toBe(false);

      // Restore original mock
      global.$ = mockJQuery;
      global.jQuery = mockJQuery;
    });
  });

  describe('h5pResize function', () => {
    it('should process h5p.org iframes', () => {
      const mockIframe = {
        src: 'https://h5p.org/embed/12345',
        style: { height: '' }
      };

      const eachCallback = vi.fn();
      const mockIframes = {
        each: vi.fn((callback) => {
          callback.call(mockIframe);
          return mockIframes;
        })
      };

      const mockBlock = {};

      // Mock $ to return the iframes when called with 'iframe' selector
      const originalMock = global.$;
      global.$ = vi.fn((selector, context) => {
        if (selector === 'iframe') {
          return mockIframes;
        }
        return originalMock(selector, context);
      });
      global.$.extend = mockJQuery.extend;
      global.$.map = mockJQuery.map;
      global.$.each = mockJQuery.each;
      global.$.timeliner = mockJQuery.timeliner;

      global.$exeFX.h5pResize(mockBlock);

      expect(mockIframes.each).toHaveBeenCalled();

      // Restore
      global.$ = originalMock;
      global.jQuery = originalMock;
    });

    it('should process wp-admin h5p iframes', () => {
      const mockIframe = {
        src: 'http://example.com/wp-admin/admin-ajax.php?action=h5p_embed',
        style: { height: '' }
      };

      const mockIframes = {
        each: vi.fn((callback) => {
          callback.call(mockIframe);
          return mockIframes;
        })
      };

      const mockBlock = {};

      // Mock $ to return the iframes when called with 'iframe' selector
      const originalMock = global.$;
      global.$ = vi.fn((selector, context) => {
        if (selector === 'iframe') {
          return mockIframes;
        }
        return originalMock(selector, context);
      });
      global.$.extend = mockJQuery.extend;
      global.$.map = mockJQuery.map;
      global.$.each = mockJQuery.each;
      global.$.timeliner = mockJQuery.timeliner;

      global.$exeFX.h5pResize(mockBlock);

      expect(mockIframes.each).toHaveBeenCalled();

      // Restore
      global.$ = originalMock;
      global.jQuery = originalMock;
    });
  });
});
