/**
 * Html5Exporter Tests
 *
 * Unit tests for Html5Exporter - exports content to HTML5 format.
 */

/* eslint-disable no-undef */

// Import BaseExporter first and make it globally available
// This simulates the browser loading order where BaseExporter.js is loaded before Html5Exporter.js
const BaseExporter = require('./BaseExporter');
global.BaseExporter = BaseExporter;

// Import renderers and make them globally available
// Html5Exporter uses these renderers in its constructor
const IdeviceHtmlRenderer = require('./renderers/IdeviceHtmlRenderer');
const PageHtmlRenderer = require('./renderers/PageHtmlRenderer');
const LibraryDetector = require('./LibraryDetector');
global.IdeviceHtmlRenderer = IdeviceHtmlRenderer;
global.PageHtmlRenderer = PageHtmlRenderer;
global.LibraryDetector = LibraryDetector;

// Now import Html5Exporter (which expects BaseExporter and renderers to be defined)
const Html5Exporter = require('./Html5Exporter');

// Mock dependencies for testing
const createMockYjsDocument = () => {
  // Simulated Y.Map with basic get/set functionality
  class MockMap {
    constructor(data = {}) {
      this._data = new Map(Object.entries(data));
    }
    get(key) { return this._data.get(key); }
    set(key, value) { this._data.set(key, value); }
    forEach(callback) { this._data.forEach((v, k) => callback(v, k)); }
    entries() { return this._data.entries(); }
    toJSON() { return Object.fromEntries(this._data); }
  }

  // Simulated Y.Array
  class MockArray {
    constructor(items = []) {
      this._items = items;
    }
    get length() { return this._items.length; }
    get(index) { return this._items[index]; }
    push(items) { this._items.push(...items); }
    toJSON() { return this._items.map(i => i.toJSON ? i.toJSON() : i); }
  }

  // Create mock document manager
  return {
    getMetadata: () => new MockMap({
      title: 'Test Project',
      author: 'Test Author',
      language: 'es',
      description: 'Test description',
      license: 'CC-BY-SA',
      theme: 'ultrathink',
      customStyles: '.custom { color: red; }',
    }),
    getNavigation: () => new MockArray([
      new MockMap({
        id: 'page1',
        pageId: 'page1',
        pageName: 'Página Principal',
        parentId: null,
        order: 0,
        blocks: new MockArray([
          new MockMap({
            id: 'block1',
            blockId: 'block1',
            blockName: 'Block 1',
            order: 0,
            components: new MockArray([
              new MockMap({
                id: 'comp1',
                ideviceId: 'comp1',
                ideviceType: 'FreeTextIdevice',
                order: 0,
                htmlContent: '<div class="exe-text"><p>Este es el contenido del iDevice.</p><img src="asset://assetId123/image.png" alt="Test image"></div>',
              }),
            ]),
          }),
        ]),
      }),
      new MockMap({
        id: 'page2',
        pageId: 'page2',
        pageName: 'Segunda Página',
        parentId: null,
        order: 1,
        blocks: new MockArray([
          new MockMap({
            id: 'block2',
            blockId: 'block2',
            blockName: 'Block 2',
            order: 0,
            components: new MockArray([
              new MockMap({
                id: 'comp2',
                ideviceId: 'comp2',
                ideviceType: 'MultipleChoiceIdevice',
                order: 0,
                htmlContent: '<div class="quiz"><p>¿Cuál es la respuesta correcta?</p></div>',
              }),
            ]),
          }),
        ]),
      }),
      new MockMap({
        id: 'page3',
        pageId: 'page3',
        pageName: 'Subpágina',
        parentId: 'page1',
        order: 2,
        blocks: new MockArray([]),
      }),
    ]),
  };
};

const createMockAssetCache = () => ({
  getAllAssets: async () => [
    {
      assetId: 'assetId123',
      blob: new Blob(['test image data'], { type: 'image/png' }),
      metadata: {
        assetId: 'assetId123',
        filename: 'image.png',
        originalPath: 'assetId123/image.png',
      },
    },
  ],
});

const createMockResourceFetcher = () => ({
  fetchTheme: async (themeName) => {
    return new Map([
      ['content.css', new Blob([`/* Theme: ${themeName} */`], { type: 'text/css' })],
      ['default.js', new Blob([`// Theme: ${themeName}`], { type: 'application/javascript' })],
    ]);
  },
  fetchBaseLibraries: async () => {
    return new Map([
      ['jquery/jquery.min.js', new Blob(['// jQuery'], { type: 'application/javascript' })],
      ['common.js', new Blob(['// Common'], { type: 'application/javascript' })],
      ['common_i18n.js', new Blob(['// i18n'], { type: 'application/javascript' })],
      ['bootstrap/bootstrap.min.css', new Blob(['/* Bootstrap */'], { type: 'text/css' })],
    ]);
  },
  fetchIdevice: async (ideviceType) => {
    return new Map([
      [`${ideviceType}.js`, new Blob([`// ${ideviceType}`], { type: 'application/javascript' })],
      [`${ideviceType}.css`, new Blob([`/* ${ideviceType} */`], { type: 'text/css' })],
    ]);
  },
});

// Export mocks for other tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createMockYjsDocument, createMockAssetCache, createMockResourceFetcher };
} else if (typeof window !== 'undefined') {
  window.Html5ExporterTestHelpers = { createMockYjsDocument, createMockAssetCache, createMockResourceFetcher };
}

describe('Html5Exporter', () => {
  let mockDoc;

  beforeEach(() => {
    mockDoc = createMockYjsDocument();
  });

  describe('getFileExtension', () => {
    it('returns .zip', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      expect(exporter.getFileExtension()).toBe('.zip');
    });
  });

  describe('getFileSuffix', () => {
    it('returns _web', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      expect(exporter.getFileSuffix()).toBe('_web');
    });
  });

  describe('buildFilename', () => {
    it('generates correct name with _web.zip suffix', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const filename = exporter.buildFilename();
      expect(filename).toMatch(/_web\.zip$/);
    });

    it('includes sanitized title in filename', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const filename = exporter.buildFilename();
      expect(filename.toLowerCase()).toContain('test');
    });
  });

  describe('buildPageList', () => {
    it('extracts pages correctly', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      expect(pages.length).toBe(3);
    });

    it('extracts first page title correctly', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      expect(pages[0].title).toBe('Página Principal');
    });

    it('extracts second page title correctly', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      expect(pages[1].title).toBe('Segunda Página');
    });

    it('preserves parent relationship', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      expect(pages[2].parentId).toBe('page1');
    });
  });

  describe('getRootPages', () => {
    it('filters root pages correctly', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const rootPages = exporter.getRootPages(pages);
      expect(rootPages.length).toBe(2);
    });
  });

  describe('getChildPages', () => {
    it('finds children of page1', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const children = exporter.getChildPages('page1', pages);
      expect(children.length).toBe(1);
      expect(children[0].id).toBe('page3');
    });
  });

  describe('getUsedIdevices', () => {
    it('extracts FreeTextIdevice', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const idevices = exporter.getUsedIdevices(pages);
      expect(idevices).toContain('FreeTextIdevice');
    });

    it('extracts MultipleChoiceIdevice', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const idevices = exporter.getUsedIdevices(pages);
      expect(idevices).toContain('MultipleChoiceIdevice');
    });
  });

  describe('sanitizePageFilename', () => {
    it('removes accents', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const sanitized = exporter.sanitizePageFilename('Página Principal 🎉');
      expect(sanitized).not.toContain('á');
    });

    it('removes emojis', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const sanitized = exporter.sanitizePageFilename('Página Principal 🎉');
      expect(sanitized).not.toContain('🎉');
    });

    it('normalizes to lowercase', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const sanitized = exporter.sanitizePageFilename('Página Principal 🎉');
      expect(sanitized).toContain('pagina');
    });
  });

  describe('getIdevicePath', () => {
    it('maps FreeTextIdevice to text', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      expect(exporter.getIdevicePath('FreeTextIdevice')).toBe('text');
    });

    it('maps MultipleChoiceIdevice to form', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      expect(exporter.getIdevicePath('MultipleChoiceIdevice')).toBe('form');
    });
  });

  describe('fixAssetUrls', () => {
    it('converts asset:// URLs to relative paths', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const content = '<img src="asset://abc123/image.png">';
      const fixed = exporter.fixAssetUrls(content, '');
      expect(fixed).toContain('content/resources/abc123/image.png');
    });
  });

  describe('generatePageHtml', () => {
    it('includes iDevice content', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);
      expect(html).toContain('Este es el contenido del iDevice');
    });

    it('includes idevice_node class', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);
      expect(html).toContain('idevice_node');
    });

    it('includes text class for FreeTextIdevice', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);
      expect(html).toContain('class="idevice_node text"');
    });

    it('includes theme CSS', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);
      expect(html).toContain('theme/content.css');
    });

    it('includes theme JS', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);
      expect(html).toContain('theme/default.js');
    });

    it('includes custom styles', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);
      expect(html).toContain('.custom { color: red; }');
    });

    it('uses correct basePath for subpages', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();
      const html = exporter.generatePageHtml(pages[1], pages, meta);
      expect(html).toContain('../libs/');
      expect(html).toContain('../theme/');
    });
  });

  describe('generateNavigation', () => {
    it('creates nav element', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const nav = exporter.generateNavigation(pages, 'page1', '');
      expect(nav).toContain('<nav id="siteNav">');
    });

    it('includes first page in navigation', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const nav = exporter.generateNavigation(pages, 'page1', '');
      expect(nav).toContain('Página Principal');
    });

    it('includes second page in navigation', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const nav = exporter.generateNavigation(pages, 'page1', '');
      expect(nav).toContain('Segunda Página');
    });

    it('marks current page as active', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const nav = exporter.generateNavigation(pages, 'page1', '');
      expect(nav).toContain('class="active"');
    });
  });

  describe('generateContentXml', () => {
    it('creates valid XML declaration', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const xml = exporter.generateContentXml();
      expect(xml).toContain('<?xml version="1.0"');
    });

    it('includes ODE namespace', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const xml = exporter.generateContentXml();
      expect(xml).toContain('<ode xmlns="http://www.intef.es/xsd/ode"');
    });

    it('includes project title', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const xml = exporter.generateContentXml();
      expect(xml).toContain('Test Project');
    });

    it('includes page structures', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const xml = exporter.generateContentXml();
      expect(xml).toContain('odeNavStructure');
    });
  });

  describe('generatePagination', () => {
    it('creates prev link for middle page', () => {
      const exporter = new Html5Exporter(mockDoc, null, null);
      const pages = exporter.buildPageList();
      const pagination = exporter.generatePagination(pages[1], pages, '../');
      expect(pagination).toContain('class="prev"');
    });
  });
});
