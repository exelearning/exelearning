/**
 * PageExporter Bun Tests
 *
 * Tests for single-page HTML export functionality.
 */

 

// Test functions available globally from vitest setup

// Import required classes
const BaseExporter = require('./BaseExporter');
global.BaseExporter = BaseExporter;

const LibraryDetector = require('./LibraryDetector');
global.LibraryDetector = LibraryDetector;

const IdeviceHtmlRenderer = require('./renderers/IdeviceHtmlRenderer');
const PageHtmlRenderer = require('./renderers/PageHtmlRenderer');
global.IdeviceHtmlRenderer = IdeviceHtmlRenderer;
global.PageHtmlRenderer = PageHtmlRenderer;

const Html5Exporter = require('./Html5Exporter');
global.Html5Exporter = Html5Exporter;

const PageExporter = require('./PageExporter');

describe('PageExporter', () => {
  // Helper to create a mock document manager
  const createMockDocManager = (overrides = {}) => {
    const metadata = new MockYMap({
      title: 'Test Project',
      author: 'Test Author',
      language: 'en',
      description: 'Test description',
      license: 'CC-BY-SA',
      theme: 'base',
      ...overrides.metadata,
    });

    const pages = overrides.pages || [
      createMockPage('page1', 'Home Page', null, 0, [
        createMockBlock('block1', 'Main Block', 0, [
          createMockComponent('comp1', 'FreeTextIdevice', 0, '<p>Hello World</p>'),
        ]),
      ]),
      createMockPage('page2', 'Second Page', null, 1, []),
    ];

    const navigation = new MockYArray(pages);

    return {
      getMetadata: mock(() => metadata),
      getNavigation: mock(() => navigation),
    };
  };

  const createMockPage = (id, name, parentId, order, blocks = []) => {
    return new MockYMap({
      id,
      pageId: id,
      pageName: name,
      parentId,
      order,
      blocks: new MockYArray(blocks),
    });
  };

  const createMockBlock = (id, name, order, components = []) => {
    return new MockYMap({
      id,
      blockId: id,
      blockName: name,
      order,
      components: new MockYArray(components),
    });
  };

  const createMockComponent = (id, type, order, htmlContent = '') => {
    return new MockYMap({
      id,
      ideviceId: id,
      ideviceType: type,
      order,
      htmlContent,
    });
  };

  describe('constructor', () => {
    it('creates instance with document manager', () => {
      const mockDoc = createMockDocManager();
      const exporter = new PageExporter(mockDoc);

      expect(exporter.manager).toBe(mockDoc);
    });

    it('inherits from Html5Exporter', () => {
      const mockDoc = createMockDocManager();
      const exporter = new PageExporter(mockDoc);

      expect(exporter instanceof Html5Exporter).toBe(true);
    });
  });

  describe('getFileSuffix', () => {
    it('returns _page suffix', () => {
      const mockDoc = createMockDocManager();
      const exporter = new PageExporter(mockDoc);

      expect(exporter.getFileSuffix()).toBe('_page');
    });
  });

  describe('buildFilename', () => {
    it('generates filename with _page suffix', () => {
      const mockDoc = createMockDocManager({
        metadata: { title: 'My Project' },
      });
      const exporter = new PageExporter(mockDoc);

      const filename = exporter.buildFilename();

      expect(filename).toBe('my-project_page.zip');
    });
  });

  describe('generateSinglePageHtml', () => {
    it('generates single-page HTML with all pages', () => {
      const mockDoc = createMockDocManager();
      const exporter = new PageExporter(mockDoc);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();

      const html = exporter.generateSinglePageHtml(pages, meta, []);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('exe-single-page');
      expect(html).toContain('section-page1');
      expect(html).toContain('section-page2');
    });

    it('includes project title', () => {
      const mockDoc = createMockDocManager({
        metadata: { title: 'My Single Page' },
      });
      const exporter = new PageExporter(mockDoc);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();

      const html = exporter.generateSinglePageHtml(pages, meta, []);

      expect(html).toContain('My Single Page');
    });
  });

  describe('getSinglePageCss', () => {
    it('returns CSS for single-page layout', () => {
      const mockDoc = createMockDocManager();
      const exporter = new PageExporter(mockDoc);

      const css = exporter.getSinglePageCss();

      expect(css).toContain('.exe-single-page');
      expect(css).toContain('.single-page-section');
      expect(css).toContain('scroll-behavior');
    });

    it('includes print styles', () => {
      const mockDoc = createMockDocManager();
      const exporter = new PageExporter(mockDoc);

      const css = exporter.getSinglePageCss();

      expect(css).toContain('@media print');
    });
  });

  describe('export', () => {
    let warnSpy;

    beforeEach(() => {
      // Suppress expected "No asset cache or AssetManager available" warnings
      warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('exports to blob successfully', async () => {
      const mockDoc = createMockDocManager();
      const exporter = new PageExporter(mockDoc);
      exporter.downloadBlob = mock(() => undefined);

      const result = await exporter.export('test_page.zip');

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test_page.zip');
    });

    it('generates single index.html file', async () => {
      const mockDoc = createMockDocManager();
      const exporter = new PageExporter(mockDoc);
      exporter.downloadBlob = mock(() => undefined);

      // Spy on zip.file to verify content
      let zipFiles = [];
      const originalCreateZip = exporter.createZip.bind(exporter);
      exporter.createZip = function () {
        const zip = originalCreateZip();
        const originalFile = zip.file.bind(zip);
        zip.file = function (path, content) {
          zipFiles.push(path);
          return originalFile(path, content);
        };
        return zip;
      };

      await exporter.export('test.zip');

      expect(zipFiles).toContain('index.html');
      expect(zipFiles).toContain('content/css/single-page.css');
      // Should not have html/ directory (single page)
      expect(zipFiles.filter((f) => f.startsWith('html/')).length).toBe(0);
    });
  });
});
