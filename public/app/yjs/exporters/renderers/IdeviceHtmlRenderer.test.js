/**
 * IdeviceHtmlRenderer Tests
 */

// Import the class
const IdeviceHtmlRenderer = require('./IdeviceHtmlRenderer');

describe('IdeviceHtmlRenderer', () => {
  let renderer;

  beforeEach(() => {
    renderer = new IdeviceHtmlRenderer();
  });

  describe('getConfig', () => {
    it('should return correct config for known iDevice types', () => {
      const textConfig = renderer.getConfig('text');
      expect(textConfig.cssClass).toBe('text');
      expect(textConfig.componentType).toBe('json');

      const formConfig = renderer.getConfig('form');
      expect(formConfig.cssClass).toBe('form');
    });

    it('should return fallback config for unknown types', () => {
      const config = renderer.getConfig('UnknownIdevice');
      expect(config.cssClass).toBe('unknown');
      expect(config.componentType).toBe('json');
    });

    it('should handle FreeTextIdevice as text type', () => {
      const config = renderer.getConfig('FreeTextIdevice');
      expect(config.cssClass).toBe('text');
    });
  });

  describe('render', () => {
    it('should render a simple iDevice with content', () => {
      const component = {
        id: 'comp1',
        type: 'text',
        content: '<p>Hello World</p>',
        properties: {},
      };

      const html = renderer.render(component);

      expect(html).toContain('id="comp1"');
      expect(html).toContain('class="idevice_node text"');
      expect(html).toContain('<p>Hello World</p>');
    });

    it('should add data attributes when includeDataAttributes is true', () => {
      const component = {
        id: 'comp1',
        type: 'form',
        content: '<p>Quiz content</p>',
        properties: { question: 'What is 2+2?' },
      };

      const html = renderer.render(component, { includeDataAttributes: true });

      expect(html).toContain('data-idevice-type="form"');
      expect(html).toContain('data-idevice-component-type="json"');
      expect(html).toContain('data-idevice-json-data');
    });

    it('should not add data attributes when includeDataAttributes is false', () => {
      const component = {
        id: 'comp1',
        type: 'text',
        content: '<p>Content</p>',
        properties: {},
      };

      const html = renderer.render(component, { includeDataAttributes: false });

      expect(html).not.toContain('data-idevice-type');
      expect(html).not.toContain('data-idevice-path');
    });

    it('should add visibility classes from properties', () => {
      const component = {
        id: 'comp1',
        type: 'text',
        content: '',
        properties: {
          visibility: 'false',
          teacherOnly: 'true',
        },
      };

      const html = renderer.render(component);

      expect(html).toContain('novisible');
      expect(html).toContain('teacher-only');
    });

    it('should add custom CSS class from properties', () => {
      const component = {
        id: 'comp1',
        type: 'text',
        content: '',
        properties: { cssClass: 'my-custom-class' },
      };

      const html = renderer.render(component);

      expect(html).toContain('my-custom-class');
    });

    it('should add db-no-data class when content is empty', () => {
      const component = {
        id: 'comp1',
        type: 'text',
        content: '',
        properties: {},
      };

      const html = renderer.render(component);

      expect(html).toContain('db-no-data');
    });
  });

  describe('renderBlock', () => {
    it('should render a block with header', () => {
      const block = {
        id: 'block1',
        name: 'My Block Title',
        components: [
          { id: 'comp1', type: 'text', content: '<p>Content 1</p>', properties: {} },
        ],
        properties: {},
      };

      const html = renderer.renderBlock(block);

      expect(html).toContain('<article id="block1"');
      expect(html).toContain('class="box"');
      expect(html).toContain('<header class="box-head no-icon">');
      expect(html).toContain('<h1 class="box-title">My Block Title</h1>');
      expect(html).toContain('<div class="box-content">');
    });

    it('should render a block without header when name is empty', () => {
      const block = {
        id: 'block1',
        name: '',
        components: [],
        properties: {},
      };

      const html = renderer.renderBlock(block);

      expect(html).toContain('class="box no-header"');
      expect(html).not.toContain('<header');
      expect(html).toContain('<div class="box-head">');
    });

    it('should include block visibility properties', () => {
      const block = {
        id: 'block1',
        name: 'Block',
        components: [],
        properties: {
          minimized: 'true',
          visibility: 'false',
        },
      };

      const html = renderer.renderBlock(block);

      expect(html).toContain('minimized');
      expect(html).toContain('novisible');
    });

    it('should render all components inside the block', () => {
      const block = {
        id: 'block1',
        name: 'Block',
        components: [
          { id: 'comp1', type: 'text', content: '<p>First</p>', properties: {} },
          { id: 'comp2', type: 'form', content: '<p>Second</p>', properties: {} },
        ],
        properties: {},
      };

      const html = renderer.renderBlock(block);

      expect(html).toContain('id="comp1"');
      expect(html).toContain('id="comp2"');
      expect(html).toContain('<p>First</p>');
      expect(html).toContain('<p>Second</p>');
    });
  });

  describe('fixAssetUrls', () => {
    describe('export mode (relative basePath)', () => {
      it('should convert asset:// URLs to content/resources/', () => {
        const content = '<img src="asset://abc123/image.png">';
        const fixed = renderer.fixAssetUrls(content, '');

        expect(fixed).toBe('<img src="content/resources/abc123/image.png">');
      });

      it('should add basePath prefix', () => {
        const content = '<img src="asset://abc123/image.png">';
        const fixed = renderer.fixAssetUrls(content, '../');

        expect(fixed).toBe('<img src="../content/resources/abc123/image.png">');
      });

      it('should handle multiple asset URLs', () => {
        const content = '<img src="asset://a/1.png"><img src="asset://b/2.png">';
        const fixed = renderer.fixAssetUrls(content, '');

        expect(fixed).toContain('content/resources/a/1.png');
        expect(fixed).toContain('content/resources/b/2.png');
      });

      it('should handle empty content', () => {
        expect(renderer.fixAssetUrls('', '')).toBe('');
        expect(renderer.fixAssetUrls(null, '')).toBe('');
      });

      it('should convert files/tmp/ paths to content/resources/', () => {
        const content = '<img src="files/tmp/session123/uuid-abc/image.png">';
        const fixed = renderer.fixAssetUrls(content, '');

        expect(fixed).toBe('<img src="content/resources/uuid-abc/image.png">');
      });

      it('should handle filenames with spaces in export mode', () => {
        const content = '<img src="asset://abc-123/my image file.jpg">';
        const fixed = renderer.fixAssetUrls(content, '');

        expect(fixed).toBe('<img src="content/resources/abc-123/my image file.jpg">');
      });

      it('should skip blob: URLs in asset paths', () => {
        const content = '<img src="asset://blob:http://localhost/uuid">';
        const fixed = renderer.fixAssetUrls(content, '');

        expect(fixed).toBe('<img src="asset://blob:http://localhost/uuid">');
      });

      it('should skip data: URLs in asset paths', () => {
        const content = '<img src="asset://data:image/png;base64,abc">';
        const fixed = renderer.fixAssetUrls(content, '');

        expect(fixed).toBe('<img src="asset://data:image/png;base64,abc">');
      });
    });

    describe('preview mode (absolute basePath with http://)', () => {
      const previewBasePath = 'http://localhost:8080/v1.0.0/files/perm/idevices/base/';

      it('should preserve asset:// URLs for blob resolution', () => {
        const content = '<img src="asset://abc-123/image.jpg">';
        const fixed = renderer.fixAssetUrls(content, previewBasePath);

        // In preview mode, asset:// URLs should be preserved (not transformed)
        expect(fixed).toBe('<img src="asset://abc-123/image.jpg">');
      });

      it('should preserve asset:// URLs with https://', () => {
        const content = '<img src="asset://abc-123/image.jpg">';
        const fixed = renderer.fixAssetUrls(content, 'https://example.com/v1.0.0/files/');

        expect(fixed).toBe('<img src="asset://abc-123/image.jpg">');
      });

      it('should NOT produce malformed basePath+asset:// URLs', () => {
        const content = '<img src="asset://abc-123/image.jpg">';
        const fixed = renderer.fixAssetUrls(content, previewBasePath);

        // This was the bug: producing http://localhost/...asset://...
        expect(fixed).not.toContain('http://localhost:8080/v1.0.0/files/perm/idevices/base/asset://');
        expect(fixed).not.toContain('http://localhost:8080/v1.0.0/files/perm/idevices/base/content/resources/');
      });

      it('should convert files/tmp/ paths to asset:// format', () => {
        const content = '<img src="files/tmp/session123/uuid-abc/image.png">';
        const fixed = renderer.fixAssetUrls(content, previewBasePath);

        expect(fixed).toBe('<img src="asset://uuid-abc/image.png">');
      });

      it('should handle multiple asset:// URLs in preview mode', () => {
        const content = '<img src="asset://a/1.png"><img src="asset://b/2.png">';
        const fixed = renderer.fixAssetUrls(content, previewBasePath);

        expect(fixed).toBe('<img src="asset://a/1.png"><img src="asset://b/2.png">');
      });
    });

    describe('edge cases', () => {
      it('should not treat relative paths as preview mode', () => {
        const content = '<img src="asset://abc/image.jpg">';

        // Relative paths should trigger export mode
        expect(renderer.fixAssetUrls(content, '')).toContain('content/resources/');
        expect(renderer.fixAssetUrls(content, '../')).toContain('content/resources/');
        expect(renderer.fixAssetUrls(content, '../../')).toContain('content/resources/');
        expect(renderer.fixAssetUrls(content, './')).toContain('content/resources/');
      });

      it('should treat http:// basePath as preview mode', () => {
        const content = '<img src="asset://abc/image.jpg">';
        const fixed = renderer.fixAssetUrls(content, 'http://localhost/');

        expect(fixed).not.toContain('content/resources/');
        expect(fixed).toBe('<img src="asset://abc/image.jpg">');
      });

      it('should treat https:// basePath as preview mode', () => {
        const content = '<img src="asset://abc/image.jpg">';
        const fixed = renderer.fixAssetUrls(content, 'https://example.com/');

        expect(fixed).not.toContain('content/resources/');
        expect(fixed).toBe('<img src="asset://abc/image.jpg">');
      });
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(renderer.escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(renderer.escapeHtml('"test"')).toBe('&quot;test&quot;');
      expect(renderer.escapeHtml("it's")).toBe('it&#039;s');
      expect(renderer.escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should handle empty strings', () => {
      expect(renderer.escapeHtml('')).toBe('');
      expect(renderer.escapeHtml(null)).toBe('');
    });
  });

  describe('getCssLinks', () => {
    it('should generate CSS link tags for iDevice types', () => {
      const links = renderer.getCssLinks(['text', 'form']);

      expect(links.length).toBe(2);
      expect(links[0]).toContain('idevices/text/text.css');
      expect(links[1]).toContain('idevices/form/form.css');
    });

    it('should add basePath to links', () => {
      const links = renderer.getCssLinks(['text'], '../');

      expect(links[0]).toContain('../idevices/text/text.css');
    });

    it('should deduplicate types', () => {
      const links = renderer.getCssLinks(['text', 'text', 'FreeTextIdevice']);

      // text and FreeTextIdevice both map to 'text', so should be deduplicated
      expect(links.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getJsScripts', () => {
    it('should generate script tags for iDevice types', () => {
      const scripts = renderer.getJsScripts(['text', 'form']);

      expect(scripts.length).toBe(2);
      expect(scripts[0]).toContain('idevices/text/text.js');
      expect(scripts[1]).toContain('idevices/form/form.js');
    });
  });

  describe('Game iDevices (crossword, puzzle)', () => {
    describe('crossword iDevice', () => {
      it('should have correct config for crossword type', () => {
        const config = renderer.getConfig('crossword');

        expect(config.cssClass).toBe('crossword');
        expect(config.componentType).toBe('json');
        expect(config.template).toBe('crossword.html');
      });

      it('should render crossword with correct wrapper class', () => {
        const component = {
          id: 'crossword-test',
          type: 'crossword',
          content: '<div class="crucigrama-IDevice"><div class="crucigrama-DataGame">test-data</div></div>',
          properties: { ideviceId: 'crossword-test' },
        };

        const html = renderer.render(component);

        expect(html).toContain('class="idevice_node crossword"');
        expect(html).toContain('crucigrama-IDevice');
        expect(html).toContain('crucigrama-DataGame');
      });

      it('should include data-idevice-type="crossword" for script initialization', () => {
        const component = {
          id: 'crossword-test',
          type: 'crossword',
          content: '<div class="crucigrama-IDevice"></div>',
          properties: {},
        };

        const html = renderer.render(component, { includeDataAttributes: true });

        expect(html).toContain('data-idevice-type="crossword"');
      });

      it('should include data-idevice-path for resource loading', () => {
        const component = {
          id: 'crossword-test',
          type: 'crossword',
          content: '<div class="crucigrama-IDevice"></div>',
          properties: {},
        };

        const html = renderer.render(component, {
          basePath: '/v1.0.0/files/perm/idevices/base/',
          includeDataAttributes: true,
        });

        expect(html).toContain('data-idevice-path="/v1.0.0/files/perm/idevices/base/crossword/export/"');
      });
    });

    describe('puzzle iDevice', () => {
      it('should have correct config for puzzle type', () => {
        const config = renderer.getConfig('puzzle');

        expect(config.cssClass).toBe('puzzle');
        expect(config.componentType).toBe('json');
        expect(config.template).toBe('puzzle.html');
      });

      it('should render puzzle with correct wrapper class', () => {
        const component = {
          id: 'puzzle-test',
          type: 'puzzle',
          content: '<div class="puzzle-IDevice"><div class="puzzle-DataGame">test-data</div></div>',
          properties: {},
        };

        const html = renderer.render(component);

        expect(html).toContain('class="idevice_node puzzle"');
        expect(html).toContain('puzzle-IDevice');
        expect(html).toContain('puzzle-DataGame');
      });

      it('should include data-idevice-type="puzzle" for script initialization', () => {
        const component = {
          id: 'puzzle-test',
          type: 'puzzle',
          content: '<div class="puzzle-IDevice"></div>',
          properties: {},
        };

        const html = renderer.render(component, { includeDataAttributes: true });

        expect(html).toContain('data-idevice-type="puzzle"');
      });
    });

    describe('JSON scripts for games', () => {
      it('should generate crossword.js script tag', () => {
        const scripts = renderer.getJsScripts(['crossword']);

        expect(scripts.length).toBe(1);
        expect(scripts[0]).toContain('idevices/crossword/crossword.js');
      });

      it('should generate puzzle.js script tag', () => {
        const scripts = renderer.getJsScripts(['puzzle']);

        expect(scripts.length).toBe(1);
        expect(scripts[0]).toContain('idevices/puzzle/puzzle.js');
      });

      it('should generate both scripts for multiple game types', () => {
        const scripts = renderer.getJsScripts(['crossword', 'puzzle', 'trivial']);

        expect(scripts.length).toBe(3);
        expect(scripts.some(s => s.includes('crossword.js'))).toBe(true);
        expect(scripts.some(s => s.includes('puzzle.js'))).toBe(true);
        expect(scripts.some(s => s.includes('trivial.js'))).toBe(true);
      });
    });
  });
});
