/**
 * Scorm12Exporter Bun Tests
 *
 * Tests for SCORM 1.2 package export functionality.
 */

/* eslint-disable no-undef */

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

const Scorm12ManifestGenerator = require('./generators/Scorm12ManifestGenerator');
const LomMetadataGenerator = require('./generators/LomMetadataGenerator');
global.Scorm12ManifestGenerator = Scorm12ManifestGenerator;
global.LomMetadataGenerator = LomMetadataGenerator;

const Html5Exporter = require('./Html5Exporter');
global.Html5Exporter = Html5Exporter;

const Scorm12Exporter = require('./Scorm12Exporter');

describe('Scorm12Exporter', () => {
  // Helper to create a mock document manager
  const createMockDocManager = (overrides = {}) => {
    const metadata = new MockYMap({
      title: 'Test SCORM Project',
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
      createMockPage('page2', 'Quiz Page', null, 1, [
        createMockBlock('block2', 'Quiz Block', 0, [
          createMockComponent('comp2', 'MultipleChoiceIdevice', 0, '<div>Quiz</div>'),
        ]),
      ]),
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
      const exporter = new Scorm12Exporter(mockDoc);

      expect(exporter.manager).toBe(mockDoc);
    });

    it('inherits from Html5Exporter', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);

      expect(exporter instanceof Html5Exporter).toBe(true);
    });

    it('initializes manifest and lom generators as null', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);

      expect(exporter.manifestGenerator).toBeNull();
      expect(exporter.lomGenerator).toBeNull();
    });
  });

  describe('getFileExtension', () => {
    it('returns .zip extension', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);

      expect(exporter.getFileExtension()).toBe('.zip');
    });
  });

  describe('getFileSuffix', () => {
    it('returns _scorm12 suffix', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);

      expect(exporter.getFileSuffix()).toBe('_scorm12');
    });
  });

  describe('buildFilename', () => {
    it('generates filename with _scorm12 suffix', () => {
      const mockDoc = createMockDocManager({
        metadata: { title: 'My SCORM' },
      });
      const exporter = new Scorm12Exporter(mockDoc);

      const filename = exporter.buildFilename();

      expect(filename).toBe('my-scorm_scorm12.zip');
    });
  });

  describe('generateProjectId', () => {
    it('generates unique ID', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);

      const id1 = exporter.generateProjectId();
      const id2 = exporter.generateProjectId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });
  });

  describe('getScormHeadScripts', () => {
    it('includes SCORM API wrapper script', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);

      const scripts = exporter.getScormHeadScripts('');

      expect(scripts).toContain('SCORM_API_wrapper.js');
      expect(scripts).toContain('SCOFunctions.js');
    });

    it('uses basePath for scripts', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);

      const scripts = exporter.getScormHeadScripts('../');

      expect(scripts).toContain('../libs/SCORM_API_wrapper.js');
    });
  });

  describe('getScormApiWrapper', () => {
    it('returns SCORM API wrapper code', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);

      const code = exporter.getScormApiWrapper();

      expect(code).toContain('pipwerks.SCORM');
      expect(code).toContain('LMSInitialize');
      expect(code).toContain('LMSGetValue');
      expect(code).toContain('LMSSetValue');
    });
  });

  describe('getScoFunctions', () => {
    it('returns SCO functions code', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);

      const code = exporter.getScoFunctions();

      expect(code).toContain('loadPage');
      expect(code).toContain('unloadPage');
      expect(code).toContain('computeTime');
      expect(code).toContain('setComplete');
      expect(code).toContain('cmi.core.lesson_status');
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
      const exporter = new Scorm12Exporter(mockDoc);
      exporter.downloadBlob = mock(() => undefined);

      const result = await exporter.export('test_scorm12.zip');

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test_scorm12.zip');
    });

    it('includes imsmanifest.xml in ZIP', async () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);
      exporter.downloadBlob = mock(() => undefined);

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

      expect(zipFiles).toContain('imsmanifest.xml');
    });

    it('includes imslrm.xml in ZIP', async () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);
      exporter.downloadBlob = mock(() => undefined);

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

      expect(zipFiles).toContain('imslrm.xml');
    });

    it('includes SCORM API files in libs', async () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);
      exporter.downloadBlob = mock(() => undefined);

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

      expect(zipFiles).toContain('libs/SCORM_API_wrapper.js');
      expect(zipFiles).toContain('libs/SCOFunctions.js');
    });

    it('generates HTML pages', async () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);
      exporter.downloadBlob = mock(() => undefined);

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
      expect(zipFiles.some((f) => f.startsWith('html/'))).toBe(true);
    });

    it('initializes generators during export', async () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);
      exporter.downloadBlob = mock(() => undefined);

      await exporter.export('test.zip');

      expect(exporter.manifestGenerator).not.toBeNull();
      expect(exporter.lomGenerator).not.toBeNull();
    });
  });

  describe('generateScormPageHtml', () => {
    it('includes SCORM body class', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();

      const html = exporter.generateScormPageHtml(pages[0], pages, meta);

      expect(html).toContain('exe-scorm');
      expect(html).toContain('exe-scorm12');
    });

    it('includes onload and onunload handlers', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();

      const html = exporter.generateScormPageHtml(pages[0], pages, meta);

      expect(html).toContain('onload="loadPage()"');
      expect(html).toContain('onunload="unloadPage()"');
    });

    it('includes SCORM scripts in head', () => {
      const mockDoc = createMockDocManager();
      const exporter = new Scorm12Exporter(mockDoc);
      const pages = exporter.buildPageList();
      const meta = mockDoc.getMetadata();

      const html = exporter.generateScormPageHtml(pages[0], pages, meta);

      expect(html).toContain('SCORM_API_wrapper.js');
      expect(html).toContain('SCOFunctions.js');
    });
  });
});
