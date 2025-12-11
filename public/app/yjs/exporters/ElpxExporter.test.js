/**
 * ElpxExporter Bun Tests
 *
 * Unit tests for the ElpxExporter class using Bun test framework.
 * Tests the ELPX export functionality including XML generation and ZIP creation.
 *
 */

/* eslint-disable no-undef */

// Test functions available globally from vitest setup

// Import BaseExporter first and make it globally available
// This simulates the browser loading order where BaseExporter.js is loaded before ElpxExporter.js
const BaseExporter = require('./BaseExporter');
global.BaseExporter = BaseExporter;

// Import renderers and make them globally available
// ElpxExporter now uses these renderers in its constructor
const IdeviceHtmlRenderer = require('./renderers/IdeviceHtmlRenderer');
const PageHtmlRenderer = require('./renderers/PageHtmlRenderer');
global.IdeviceHtmlRenderer = IdeviceHtmlRenderer;
global.PageHtmlRenderer = PageHtmlRenderer;

// Now import ElpxExporter (which expects BaseExporter and renderers to be defined)
const ElpxExporter = require('./ElpxExporter');

describe('ElpxExporter', () => {
  // Helper to create a mock document manager with configurable data
  const createMockDocManager = (overrides = {}) => {
    const metadata = new MockYMap({
      title: 'Test Project',
      author: 'Test Author',
      language: 'en',
      description: 'Test description',
      license: 'CC-BY-SA',
      createdAt: '2024-01-01T00:00:00Z',
      ...overrides.metadata,
    });

    const pages = overrides.pages || [
      createMockPage('page1', 'Home Page', null, 0, [
        createMockBlock('block1', 'Main Block', 0, [
          createMockComponent('comp1', 'FreeTextIdevice', 0, '<p>Hello World</p>'),
        ]),
      ]),
    ];

    const navigation = new MockYArray(pages);

    return {
      getMetadata: mock(() => metadata),
      getNavigation: mock(() => navigation),
    };
  };

  // Helper to create a mock page
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

  // Helper to create a mock block
  const createMockBlock = (id, name, order, components = []) => {
    return new MockYMap({
      id,
      blockId: id,
      blockName: name,
      order,
      components: new MockYArray(components),
    });
  };

  // Helper to create a mock component
  const createMockComponent = (id, type, order, htmlContent = '', props = {}) => {
    const data = {
      id,
      ideviceId: id,
      ideviceType: type,
      order,
      htmlContent,
    };
    // Add prop_ prefixed properties
    Object.entries(props).forEach(([key, value]) => {
      data[`prop_${key}`] = value;
    });
    return new MockYMap(data);
  };

  describe('constructor', () => {
    it('creates instance with document manager', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ElpxExporter(mockDoc);

      expect(exporter.manager).toBe(mockDoc);
      expect(exporter.assetCache).toBeNull();
    });

    it('accepts optional asset cache manager', () => {
      const mockDoc = createMockDocManager();
      const mockAssetCache = createMockAssetCache();
      const exporter = new ElpxExporter(mockDoc, mockAssetCache);

      expect(exporter.assetCache).toBe(mockAssetCache);
    });
  });

  describe('getFileExtension', () => {
    it('returns .elpx extension', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ElpxExporter(mockDoc);

      expect(exporter.getFileExtension()).toBe('.elpx');
    });
  });

  describe('getFileSuffix', () => {
    it('returns empty string (no suffix for ELPX)', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ElpxExporter(mockDoc);

      expect(exporter.getFileSuffix()).toBe('');
    });
  });

  describe('buildFilename', () => {
    it('generates filename from project title', () => {
      const mockDoc = createMockDocManager({
        metadata: { title: 'My Project Title' },
      });
      const exporter = new ElpxExporter(mockDoc);

      const filename = exporter.buildFilename();

      expect(filename).toBe('my-project-title.elpx');
    });

    it('sanitizes special characters in title', () => {
      const mockDoc = createMockDocManager({
        metadata: { title: 'Test: Project @#$%!' },
      });
      const exporter = new ElpxExporter(mockDoc);

      const filename = exporter.buildFilename();

      // The sanitizeFilename removes special chars and converts spaces to dashes
      // Trailing special chars may leave a trailing dash
      expect(filename).toMatch(/^test-project-?\.elpx$/);
      expect(filename).not.toContain(':');
      expect(filename).not.toContain('@');
      expect(filename).not.toContain('#');
    });

    it('uses default name when title is empty', () => {
      const mockDoc = createMockDocManager({
        metadata: { title: '' },
      });
      const exporter = new ElpxExporter(mockDoc);

      const filename = exporter.buildFilename();

      expect(filename).toBe('export.elpx');
    });
  });

  describe('generateContentXml', () => {
    it('generates valid XML with declaration', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ElpxExporter(mockDoc);

      const xml = exporter.generateContentXml();

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    });

    it('includes ODE namespace', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ElpxExporter(mockDoc);

      const xml = exporter.generateContentXml();

      expect(xml).toContain('<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">');
    });

    it('includes odeProperties section', () => {
      const mockDoc = createMockDocManager({
        metadata: { title: 'Test Title', author: 'John Doe' },
      });
      const exporter = new ElpxExporter(mockDoc);

      const xml = exporter.generateContentXml();

      expect(xml).toContain('<odeProperties>');
      expect(xml).toContain('<pp_title>Test Title</pp_title>');
      expect(xml).toContain('<pp_author>John Doe</pp_author>');
      expect(xml).toContain('</odeProperties>');
    });

    it('includes odeNavStructures with pages', () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page1', 'First Page', null, 0, []),
          createMockPage('page2', 'Second Page', null, 1, []),
        ],
      });
      const exporter = new ElpxExporter(mockDoc);

      const xml = exporter.generateContentXml();

      expect(xml).toContain('<odeNavStructures>');
      expect(xml).toContain('odeNavStructureId="page1"');
      expect(xml).toContain('odePageName="First Page"');
      expect(xml).toContain('odeNavStructureId="page2"');
      expect(xml).toContain('odePageName="Second Page"');
      expect(xml).toContain('</odeNavStructures>');
    });

    it('includes blocks within pages', () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page1', 'Page', null, 0, [
            createMockBlock('block1', 'Block One', 0, []),
          ]),
        ],
      });
      const exporter = new ElpxExporter(mockDoc);

      const xml = exporter.generateContentXml();

      expect(xml).toContain('<odePagStructure');
      expect(xml).toContain('odePagStructureId="block1"');
      expect(xml).toContain('blockName="Block One"');
    });

    it('includes components within blocks', () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page1', 'Page', null, 0, [
            createMockBlock('block1', 'Block', 0, [
              createMockComponent('comp1', 'FreeTextIdevice', 0, '<p>Content</p>'),
            ]),
          ]),
        ],
      });
      const exporter = new ElpxExporter(mockDoc);

      const xml = exporter.generateContentXml();

      expect(xml).toContain('<odeComponent');
      expect(xml).toContain('odeComponentId="comp1"');
      expect(xml).toContain('odeIdeviceTypeDirName="FreeTextIdevice"');
      expect(xml).toContain('<htmlView><![CDATA[<p>Content</p>]]></htmlView>');
    });

    it('escapes XML special characters', () => {
      const mockDoc = createMockDocManager({
        metadata: { title: 'Test <script> & "quotes"' },
      });
      const exporter = new ElpxExporter(mockDoc);

      const xml = exporter.generateContentXml();

      expect(xml).toContain('&lt;script&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;quotes&quot;');
    });

    it('includes parent reference for child pages', () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page1', 'Parent', null, 0, []),
          createMockPage('page2', 'Child', 'page1', 1, []),
        ],
      });
      const exporter = new ElpxExporter(mockDoc);

      const xml = exporter.generateContentXml();

      expect(xml).toContain('parentOdeNavStructureId="page1"');
    });
  });

  describe('generatePropertiesXml', () => {
    it('generates all required properties', () => {
      const metadata = new MockYMap({
        title: 'Test',
        author: 'Author',
        language: 'es',
        description: 'Desc',
        license: 'MIT',
        createdAt: '2024-01-01',
      });
      const mockDoc = createMockDocManager();
      const exporter = new ElpxExporter(mockDoc);

      const xml = exporter.generatePropertiesXml(metadata);

      expect(xml).toContain('<pp_title>Test</pp_title>');
      expect(xml).toContain('<pp_author>Author</pp_author>');
      expect(xml).toContain('<pp_lang>es</pp_lang>');
      expect(xml).toContain('<pp_description>Desc</pp_description>');
      expect(xml).toContain('<pp_license>MIT</pp_license>');
      expect(xml).toContain('<pp_createdAt>2024-01-01</pp_createdAt>');
    });

    it('uses defaults for missing properties', () => {
      const metadata = new MockYMap({});
      const mockDoc = createMockDocManager();
      const exporter = new ElpxExporter(mockDoc);

      const xml = exporter.generatePropertiesXml(metadata);

      expect(xml).toContain('<pp_title>Untitled</pp_title>');
      expect(xml).toContain('<pp_lang>en</pp_lang>');
    });
  });

  describe('export', () => {
    it('exports to blob successfully', async () => {
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
      const mockDoc = createMockDocManager();
      const exporter = new ElpxExporter(mockDoc);

      // Mock downloadBlob to avoid DOM manipulation
      exporter.downloadBlob = mock(() => undefined);

      const result = await exporter.export('test.elpx');

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test.elpx');
      expect(exporter.downloadBlob).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('uses buildFilename when no filename provided', async () => {
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
      const mockDoc = createMockDocManager({
        metadata: { title: 'My Export' },
      });
      const exporter = new ElpxExporter(mockDoc);
      exporter.downloadBlob = mock(() => undefined);

      const result = await exporter.export();

      expect(result.success).toBe(true);
      expect(result.filename).toBe('my-export.elpx');
      warnSpy.mockRestore();
    });

    it('includes assets in ZIP when cache provided', async () => {
      const mockDoc = createMockDocManager();
      const mockAssetCache = createMockAssetCache([
        {
          assetId: 'asset1',
          blob: new Blob(['image data'], { type: 'image/png' }),
          metadata: { originalPath: 'images/test.png' },
        },
      ]);
      const exporter = new ElpxExporter(mockDoc, mockAssetCache);
      exporter.downloadBlob = mock(() => undefined);

      await exporter.export('test.elpx');

      expect(mockAssetCache.getAllAssets).toHaveBeenCalled();
    });
  });

  describe('exportToBlob', () => {
    it('returns a Blob', async () => {
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
      const mockDoc = createMockDocManager();
      const exporter = new ElpxExporter(mockDoc);

      const blob = await exporter.exportToBlob();

      expect(blob).toBeInstanceOf(Blob);
      warnSpy.mockRestore();
    });
  });

  describe('exportToFile (legacy)', () => {
    it('calls export method for backwards compatibility', async () => {
      const mockDoc = createMockDocManager();
      const exporter = new ElpxExporter(mockDoc);
      exporter.export = vi.fn(() => Promise.resolve({ success: true }));

      await exporter.exportToFile('legacy.elpx');

      expect(exporter.export).toHaveBeenCalledWith('legacy.elpx');
    });
  });

  describe('integration: full export cycle', () => {
    it('generates complete ELPX structure', async () => {
      // Create a complex document structure
      const mockDoc = createMockDocManager({
        metadata: {
          title: 'Complete Test',
          author: 'Integration Tester',
          language: 'es',
          description: 'A complete integration test',
        },
        pages: [
          createMockPage('home', 'Home', null, 0, [
            createMockBlock('intro', 'Introduction', 0, [
              createMockComponent('text1', 'FreeTextIdevice', 0, '<h1>Welcome</h1>'),
              createMockComponent('quiz1', 'MultipleChoiceIdevice', 1, '<div class="quiz">Question</div>'),
            ]),
          ]),
          createMockPage('about', 'About', null, 1, [
            createMockBlock('info', 'Information', 0, [
              createMockComponent('text2', 'FreeTextIdevice', 0, '<p>About us</p>'),
            ]),
          ]),
          createMockPage('sub', 'Subpage', 'home', 2, []),
        ],
      });

      const exporter = new ElpxExporter(mockDoc);
      const xml = exporter.generateContentXml();

      // Verify structure completeness
      expect(xml).toContain('Complete Test');
      expect(xml).toContain('Integration Tester');
      expect(xml).toContain('es');

      // All pages present
      expect(xml).toContain('odeNavStructureId="home"');
      expect(xml).toContain('odeNavStructureId="about"');
      expect(xml).toContain('odeNavStructureId="sub"');

      // Parent-child relationship
      expect(xml).toContain('parentOdeNavStructureId="home"');

      // All components present
      expect(xml).toContain('odeComponentId="text1"');
      expect(xml).toContain('odeComponentId="quiz1"');
      expect(xml).toContain('odeComponentId="text2"');

      // iDevice types
      expect(xml).toContain('FreeTextIdevice');
      expect(xml).toContain('MultipleChoiceIdevice');

      // Content in CDATA
      expect(xml).toContain('<![CDATA[<h1>Welcome</h1>]]>');
    });
  });
});
