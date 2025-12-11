/**
 * IdeviceNode Tests
 *
 * Tests for setParams method - ensures jsonProperties handling works
 * with both string and object inputs.
 */

/* eslint-disable no-undef */

// Mock minimal dependencies for IdeviceNode
const originalWindow = global.window;

// Mock IdeviceNode class for testing setParams only
// We create a minimal mock since full IdeviceNode has many dependencies
class MockIdeviceNode {
  constructor() {
    // Parameters from api
    this.params = [
      'id',
      'odeIdeviceId',
      'odeIdeviceTypeName',
      'odePagStructureSyncId',
      'blockId',
      'parent',
      'order',
      'mode',
      'htmlView',
      'jsonProperties',
    ];

    // Default values of params
    this.default = { order: 0, mode: 'edition', htmlView: '', jsonProperties: '{}' };

    // Parameters that need to be parsed
    this.parseParams = ['jsonProperties'];
  }

  /**
   * Set values of api object - this is the method we're testing
   * @param {Object} data
   */
  setParams(data) {
    for (let [i, param] of Object.entries(this.params)) {
      let defaultValue =
        this.default[param] != undefined ? this.default[param] : null;
      let value = data[param] ? data[param] : defaultValue;
      // Handle parseParams (like jsonProperties) - support both string and object
      if (this.parseParams.includes(param)) {
        if (typeof value === 'object' && value !== null) {
          // Already an object, use directly
          this[param] = value;
        } else if (typeof value === 'string') {
          // Parse JSON string
          try {
            this[param] = JSON.parse(value);
          } catch (e) {
            console.warn(`[IdeviceNode] Failed to parse ${param}:`, e.message);
            this[param] = {};
          }
        } else {
          this[param] = {};
        }
      } else {
        this[param] = value;
      }
    }
  }
}

describe('IdeviceNode', () => {
  let node;

  beforeEach(() => {
    node = new MockIdeviceNode();
    // Suppress console.warn during tests
    spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    node = null;
  });

  describe('setParams', () => {
    it('parses jsonProperties when passed as valid JSON string', () => {
      const jsonStr = JSON.stringify({ title: 'My Crossword', words: 5, active: true });
      const data = {
        id: 'comp-1',
        odeIdeviceId: 'comp-1',
        odeIdeviceTypeName: 'crossword',
        jsonProperties: jsonStr,
      };

      node.setParams(data);

      expect(typeof node.jsonProperties).toBe('object');
      expect(node.jsonProperties.title).toBe('My Crossword');
      expect(node.jsonProperties.words).toBe(5);
      expect(node.jsonProperties.active).toBe(true);
    });

    it('handles jsonProperties when already an object', () => {
      const propsObj = { title: 'Test', count: 10 };
      const data = {
        id: 'comp-2',
        odeIdeviceId: 'comp-2',
        odeIdeviceTypeName: 'trueorfalse',
        jsonProperties: propsObj,
      };

      node.setParams(data);

      expect(typeof node.jsonProperties).toBe('object');
      expect(node.jsonProperties.title).toBe('Test');
      expect(node.jsonProperties.count).toBe(10);
    });

    it('handles empty jsonProperties string "{}"', () => {
      const data = {
        id: 'comp-3',
        odeIdeviceId: 'comp-3',
        odeIdeviceTypeName: 'text',
        jsonProperties: '{}',
      };

      node.setParams(data);

      expect(typeof node.jsonProperties).toBe('object');
      expect(Object.keys(node.jsonProperties).length).toBe(0);
    });

    it('uses default "{}" when jsonProperties is missing', () => {
      const data = {
        id: 'comp-4',
        odeIdeviceId: 'comp-4',
        odeIdeviceTypeName: 'text',
      };

      node.setParams(data);

      expect(typeof node.jsonProperties).toBe('object');
      expect(Object.keys(node.jsonProperties).length).toBe(0);
    });

    it('handles invalid JSON string gracefully', () => {
      const data = {
        id: 'comp-5',
        odeIdeviceId: 'comp-5',
        jsonProperties: 'not valid json',
      };

      node.setParams(data);

      expect(typeof node.jsonProperties).toBe('object');
      expect(Object.keys(node.jsonProperties).length).toBe(0);
      expect(console.warn).toHaveBeenCalled();
    });

    it('handles null jsonProperties', () => {
      const data = {
        id: 'comp-6',
        odeIdeviceId: 'comp-6',
        jsonProperties: null,
      };

      node.setParams(data);

      // When null, it falls back to default which is '{}' string, then parsed
      expect(typeof node.jsonProperties).toBe('object');
    });

    it('handles nested object in jsonProperties', () => {
      const complexObj = {
        title: 'Complex',
        settings: {
          difficulty: 'hard',
          timer: 60,
        },
        items: [1, 2, 3],
      };
      const jsonStr = JSON.stringify(complexObj);

      const data = {
        id: 'comp-7',
        odeIdeviceId: 'comp-7',
        jsonProperties: jsonStr,
      };

      node.setParams(data);

      expect(node.jsonProperties.title).toBe('Complex');
      expect(node.jsonProperties.settings.difficulty).toBe('hard');
      expect(node.jsonProperties.settings.timer).toBe(60);
      expect(node.jsonProperties.items).toEqual([1, 2, 3]);
    });

    it('sets non-parseParams normally', () => {
      const data = {
        id: 'comp-8',
        odeIdeviceId: 'comp-8',
        htmlView: '<p>Hello World</p>',
        order: 5,
        mode: 'preview',
      };

      node.setParams(data);

      expect(node.id).toBe('comp-8');
      expect(node.odeIdeviceId).toBe('comp-8');
      expect(node.htmlView).toBe('<p>Hello World</p>');
      expect(node.order).toBe(5);
      expect(node.mode).toBe('preview');
    });

    it('handles Y.Map-like object with forEach (converted to regular object)', () => {
      // This simulates a Y.Map that was incorrectly passed
      // After our fix, it should be converted to string before reaching setParams
      // But if it somehow arrives as an object, setParams should handle it
      const yMapLike = {
        title: 'From Y.Map',
        value: 42,
      };

      const data = {
        id: 'comp-9',
        odeIdeviceId: 'comp-9',
        jsonProperties: yMapLike,
      };

      node.setParams(data);

      expect(typeof node.jsonProperties).toBe('object');
      expect(node.jsonProperties.title).toBe('From Y.Map');
      expect(node.jsonProperties.value).toBe(42);
    });
  });

  describe('htmlView fallback for hybrid iDevices', () => {
    /**
     * Test the htmlView fallback logic used in exportProcessIdeviceJson().
     * For hybrid iDevices (crossword, puzzle, dragdrop), $exeDevice.save() returns
     * HTML with embedded encrypted data. When switching pages, htmlView may be empty
     * but jsonProperties contains the HTML content.
     */

    /**
     * Simulates the fallback logic from exportProcessIdeviceJson() lines 1780-1786
     */
    function applyHtmlViewFallback(node) {
      if (!node.htmlView || node.htmlView.trim() === '') {
        if (typeof node.jsonProperties === 'string' && node.jsonProperties.includes('<')) {
          node.htmlView = node.jsonProperties;
        }
      }
    }

    it('uses jsonProperties as htmlView when htmlView is empty and jsonProperties contains HTML', () => {
      const htmlContent = '<div class="crucigrama-DataGame" data-encrypted="abc123"></div>';
      node.htmlView = '';
      node.jsonProperties = htmlContent;

      applyHtmlViewFallback(node);

      expect(node.htmlView).toBe(htmlContent);
    });

    it('uses jsonProperties as htmlView when htmlView is whitespace only', () => {
      const htmlContent = '<div class="puzzle-DataGame">encrypted data</div>';
      node.htmlView = '   \n\t  ';
      node.jsonProperties = htmlContent;

      applyHtmlViewFallback(node);

      expect(node.htmlView).toBe(htmlContent);
    });

    it('keeps existing htmlView when it has content', () => {
      const existingHtml = '<div class="existing">Content</div>';
      const jsonHtml = '<div class="different">Other</div>';
      node.htmlView = existingHtml;
      node.jsonProperties = jsonHtml;

      applyHtmlViewFallback(node);

      expect(node.htmlView).toBe(existingHtml);
    });

    it('does not use jsonProperties when it does not contain HTML', () => {
      node.htmlView = '';
      node.jsonProperties = 'plain text without html tags';

      applyHtmlViewFallback(node);

      expect(node.htmlView).toBe('');
    });

    it('does not use jsonProperties when it is an object (not string)', () => {
      node.htmlView = '';
      node.jsonProperties = { title: 'Test', data: 'value' };

      applyHtmlViewFallback(node);

      expect(node.htmlView).toBe('');
    });

    it('handles crossword-style HTML with encrypted game data', () => {
      const crosswordHtml = `
        <div class="crucigrama-IDevice">
          <div class="crucigrama-DataGame" id="crucigramaEData0" data-data="W3siYWNyb3NzIjp0cnVlfV0="></div>
          <div class="game-container"></div>
        </div>
      `;
      node.htmlView = '';
      node.jsonProperties = crosswordHtml;

      applyHtmlViewFallback(node);

      expect(node.htmlView).toBe(crosswordHtml);
      expect(node.htmlView).toContain('crucigrama-DataGame');
    });

    it('handles puzzle-style HTML', () => {
      const puzzleHtml = '<div class="puzzlee-IDevice"><div class="puzzlee-DataGame" data-encrypted="xyz"></div></div>';
      node.htmlView = '';
      node.jsonProperties = puzzleHtml;

      applyHtmlViewFallback(node);

      expect(node.htmlView).toBe(puzzleHtml);
    });

    it('handles dragdrop-style HTML', () => {
      const dragdropHtml = '<div class="dragnddrop-IDevice"><div class="dragnddrop-DataGame"></div></div>';
      node.htmlView = '';
      node.jsonProperties = dragdropHtml;

      applyHtmlViewFallback(node);

      expect(node.htmlView).toBe(dragdropHtml);
    });
  });
});
