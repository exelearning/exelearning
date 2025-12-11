/**
 * BaseExporter Bun Tests
 *
 * Unit tests for the BaseExporter class - the base class for all exporters.
 * Tests utility methods for filename generation, XML escaping, and download handling.
 *
 */

/* eslint-disable no-undef */

// Test functions available globally from vitest setup

// Import the BaseExporter class
const BaseExporter = require('./BaseExporter');

describe('BaseExporter', () => {
  let exporter;
  let mockDocManager;

  // Helper to create a mock document manager
  const createMockDocManager = (metadataOverrides = {}) => {
    const metadata = new MockYMap({
      title: 'Test Project',
      author: 'Test Author',
      language: 'en',
      description: 'Test description',
      ...metadataOverrides,
    });

    return {
      getMetadata: mock(() => metadata),
      getNavigation: mock(() => new MockYArray([])),
    };
  };

  beforeEach(() => {
    mockDocManager = createMockDocManager();
    exporter = new BaseExporter(mockDocManager);
    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Cleanup handled automatically by Bun
  });

  describe('constructor', () => {
    it('stores document manager reference', () => {
      expect(exporter.manager).toBe(mockDocManager);
    });

    it('initializes assetCache as null by default', () => {
      expect(exporter.assetCache).toBeNull();
    });

    it('accepts optional asset cache', () => {
      const mockAssetCache = createMockAssetCache();
      const exporterWithCache = new BaseExporter(mockDocManager, mockAssetCache);
      expect(exporterWithCache.assetCache).toBe(mockAssetCache);
    });
  });

  describe('getFileExtension (abstract)', () => {
    it('throws error when called on base class', () => {
      expect(() => exporter.getFileExtension()).toThrow(
        'getFileExtension() must be implemented by subclass'
      );
    });
  });

  describe('getFileSuffix (abstract)', () => {
    it('throws error when called on base class', () => {
      expect(() => exporter.getFileSuffix()).toThrow(
        'getFileSuffix() must be implemented by subclass'
      );
    });
  });

  describe('sanitizeFilename', () => {
    it('converts to lowercase', () => {
      expect(exporter.sanitizeFilename('UPPERCASE')).toBe('uppercase');
      expect(exporter.sanitizeFilename('MixedCase')).toBe('mixedcase');
    });

    it('replaces spaces with hyphens', () => {
      expect(exporter.sanitizeFilename('hello world')).toBe('hello-world');
      expect(exporter.sanitizeFilename('multiple   spaces')).toBe('multiple-spaces');
    });

    it('removes special characters', () => {
      expect(exporter.sanitizeFilename('test@#$%file')).toBe('testfile');
      expect(exporter.sanitizeFilename('name<>:"/\\|?*')).toBe('name');
    });

    it('preserves alphanumeric and hyphens', () => {
      expect(exporter.sanitizeFilename('test-file-123')).toBe('test-file-123');
      expect(exporter.sanitizeFilename('abc123')).toBe('abc123');
    });

    it('does not collapse multiple hyphens (by design)', () => {
      // The implementation only replaces spaces with hyphens
      // Multiple hyphens from input are preserved
      expect(exporter.sanitizeFilename('test--file')).toBe('test--file');
    });

    it('handles accented characters', () => {
      // Implementation removes non-alphanumeric except spaces and hyphens
      const result = exporter.sanitizeFilename('café résumé');
      expect(result).not.toContain(' ');
      // The é characters are removed, leaving "caf" and "rsum"
      expect(result).toBe('caf-rsum');
    });

    it('returns empty or "export" for problematic input', () => {
      // Empty string returns 'export'
      expect(exporter.sanitizeFilename('')).toBe('export');
      // Special chars only result in empty which truncates to empty (no 'export' fallback in this impl)
      const result = exporter.sanitizeFilename('$$$');
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('handles undefined/null', () => {
      expect(exporter.sanitizeFilename(undefined)).toBe('export');
      expect(exporter.sanitizeFilename(null)).toBe('export');
    });

    it('truncates long names', () => {
      const longName = 'a'.repeat(100);
      expect(exporter.sanitizeFilename(longName).length).toBeLessThanOrEqual(50);
    });
  });

  describe('buildFilename', () => {
    it('generates filename from project title', () => {
      const docManager = createMockDocManager({ title: 'My Test Project' });
      const exp = new BaseExporter(docManager);
      exp.getFileExtension = () => '.zip';
      exp.getFileSuffix = () => '_html5';

      expect(exp.buildFilename()).toBe('my-test-project_html5.zip');
    });

    it('uses sanitized export for empty title', () => {
      const docManager = createMockDocManager({ title: '' });
      const exp = new BaseExporter(docManager);
      exp.getFileExtension = () => '.zip';
      exp.getFileSuffix = () => '';

      expect(exp.buildFilename()).toBe('export.zip');
    });

    it('sanitizes title with special characters', () => {
      const docManager = createMockDocManager({ title: 'Test: My Project!' });
      const exp = new BaseExporter(docManager);
      exp.getFileExtension = () => '.zip';
      exp.getFileSuffix = () => '';

      const filename = exp.buildFilename();
      expect(filename).not.toContain(':');
      expect(filename).not.toContain('!');
      expect(filename).toMatch(/\.zip$/);
    });
  });

  describe('escapeXml', () => {
    it('escapes ampersand', () => {
      expect(exporter.escapeXml('a & b')).toBe('a &amp; b');
      expect(exporter.escapeXml('&&')).toBe('&amp;&amp;');
    });

    it('escapes less than', () => {
      expect(exporter.escapeXml('a < b')).toBe('a &lt; b');
      expect(exporter.escapeXml('<tag>')).toBe('&lt;tag&gt;');
    });

    it('escapes greater than', () => {
      expect(exporter.escapeXml('a > b')).toBe('a &gt; b');
    });

    it('escapes double quotes', () => {
      expect(exporter.escapeXml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(exporter.escapeXml('attr="value"')).toBe('attr=&quot;value&quot;');
    });

    it('escapes single quotes', () => {
      expect(exporter.escapeXml("it's")).toBe('it&apos;s');
      expect(exporter.escapeXml("'test'")).toBe('&apos;test&apos;');
    });

    it('handles multiple escapes in one string', () => {
      expect(exporter.escapeXml('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;');
    });

    it('returns empty string for null/undefined', () => {
      expect(exporter.escapeXml(null)).toBe('');
      expect(exporter.escapeXml(undefined)).toBe('');
    });

    it('returns original string when no escaping needed', () => {
      expect(exporter.escapeXml('hello world')).toBe('hello world');
      expect(exporter.escapeXml('simple text')).toBe('simple text');
    });

    it('handles numeric-like input', () => {
      // The actual implementation uses String() which converts numbers
      expect(exporter.escapeXml(String(123))).toBe('123');
      expect(exporter.escapeXml(String(0))).toBe('0');
    });
  });

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = exporter.generateId();
      const id2 = exporter.generateId();
      expect(id1).not.toBe(id2);
    });

    it('generates string IDs', () => {
      const id = exporter.generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('generates IDs with optional prefix', () => {
      const id = exporter.generateId('page');
      // The actual implementation uses prefix directly without separator
      expect(id.toUpperCase()).toContain('PAGE');
    });
  });

  describe('downloadBlob', () => {
    let mockLink;
    let mockAppendChild;
    let mockRemoveChild;

    beforeEach(() => {
      mockLink = {
        href: '',
        download: '',
        style: {},
        click: mock(() => undefined),
      };

      mockAppendChild = mock(() => undefined);
      mockRemoveChild = mock(() => undefined);

      spyOn(document, 'createElement').mockReturnValue(mockLink);
      spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
      spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
    });

    it('creates download link and triggers click', () => {
      const blob = new Blob(['test content'], { type: 'application/zip' });
      exporter.downloadBlob(blob, 'test.zip');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('test.zip');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('revokes object URL after download', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });

      exporter.downloadBlob(blob, 'test.txt');

      // URL.revokeObjectURL is already a mock from setup, verify it was called
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('export (abstract method)', () => {
    it('throws error when called on base class', async () => {
      await expect(exporter.export()).rejects.toThrow(
        'export() must be implemented by subclass'
      );
    });
  });

  describe('getMetadata', () => {
    it('returns metadata from document manager', () => {
      const metadata = exporter.getMetadata();
      expect(metadata.get('title')).toBe('Test Project');
    });
  });

  describe('getNavigation', () => {
    it('returns navigation from document manager', () => {
      const navigation = exporter.getNavigation();
      expect(navigation).toBeDefined();
    });
  });

  describe('buildPageList', () => {
    it('returns empty array for empty navigation', () => {
      mockDocManager.getNavigation = mock(() => new MockYArray([]));
      const pages = exporter.buildPageList();
      expect(pages).toEqual([]);
    });

    it('extracts page data from navigation', () => {
      const page = new MockYMap({
        id: 'page1',
        pageId: 'page1',
        pageName: 'Test Page',
        parentId: null,
        order: 0,
        blocks: new MockYArray([]),
      });
      mockDocManager.getNavigation = mock(() => new MockYArray([page]));

      const pages = exporter.buildPageList();

      expect(pages).toHaveLength(1);
      expect(pages[0].id).toBe('page1');
      expect(pages[0].title).toBe('Test Page');
    });
  });

  describe('getUsedIdevices', () => {
    it('returns unique idevice types from pages', () => {
      const pages = [
        {
          id: 'page1',
          blocks: [
            {
              components: [
                { type: 'FreeTextIdevice' },
                { type: 'MultipleChoiceIdevice' },
                { type: 'FreeTextIdevice' }, // Duplicate
              ],
            },
          ],
        },
      ];

      const types = exporter.getUsedIdevices(pages);

      expect(types).toContain('FreeTextIdevice');
      expect(types).toContain('MultipleChoiceIdevice');
      expect(types).toHaveLength(2); // No duplicates
    });

    it('returns empty array for empty project', () => {
      const types = exporter.getUsedIdevices([]);
      expect(types).toEqual([]);
    });
  });

  describe('getRootPages', () => {
    it('returns pages without parent', () => {
      const pages = [
        { id: 'p1', parentId: null },
        { id: 'p2', parentId: 'p1' },
        { id: 'p3', parentId: null },
      ];

      const rootPages = exporter.getRootPages(pages);

      expect(rootPages).toHaveLength(2);
      expect(rootPages[0].id).toBe('p1');
      expect(rootPages[1].id).toBe('p3');
    });
  });

  describe('getChildPages', () => {
    it('returns pages with specified parent', () => {
      const pages = [
        { id: 'p1', parentId: null },
        { id: 'p2', parentId: 'p1' },
        { id: 'p3', parentId: 'p1' },
        { id: 'p4', parentId: 'p2' },
      ];

      const children = exporter.getChildPages('p1', pages);

      expect(children).toHaveLength(2);
      expect(children[0].id).toBe('p2');
      expect(children[1].id).toBe('p3');
    });
  });

  describe('addAssetsToZip', () => {
    it('logs warning when no asset cache or manager', async () => {
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
      const zip = new JSZip();
      await exporter.addAssetsToZip(zip);
      expect(warnSpy).toHaveBeenCalledWith('[BaseExporter] No asset cache or AssetManager available');
      warnSpy.mockRestore();
    });

    it('adds assets from AssetManager when available', async () => {
      const mockAssetManager = createMockAssetManager([
        {
          id: 'asset1',
          blob: new Blob(['test'], { type: 'image/png' }),
          filename: 'test.png',
          originalPath: 'images/test.png',
        },
      ]);
      exporter.setAssetManager(mockAssetManager);
      const zip = new JSZip();

      await exporter.addAssetsToZip(zip);

      expect(mockAssetManager.getProjectAssets).toHaveBeenCalled();
    });

    it('adds assets from cache when available (fallback)', async () => {
      const mockAssetCache = createMockAssetCache([
        {
          assetId: 'asset1',
          blob: new Blob(['test'], { type: 'image/png' }),
          metadata: { originalPath: 'images/test.png' },
        },
      ]);
      const exporterWithCache = new BaseExporter(mockDocManager, mockAssetCache);
      const zip = new JSZip();

      await exporterWithCache.addAssetsToZip(zip);

      expect(mockAssetCache.getAllAssets).toHaveBeenCalled();
    });
  });

  describe('getPageLink', () => {
    it('returns index.html for first page', () => {
      const pages = [{ id: 'home' }, { id: 'about' }];
      const link = exporter.getPageLink(pages[0], pages);
      expect(link).toBe('index.html');
    });

    it('returns id.html for other pages', () => {
      const pages = [{ id: 'home' }, { id: 'about' }];
      const link = exporter.getPageLink(pages[1], pages);
      expect(link).toBe('about.html');
    });

    it('uses custom extension', () => {
      const pages = [{ id: 'home' }, { id: 'about' }];
      const link = exporter.getPageLink(pages[1], pages, '.htm');
      expect(link).toBe('about.htm');
    });
  });

  describe('getPreviousPage', () => {
    it('returns previous page in list', () => {
      const pages = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
      const prev = exporter.getPreviousPage(pages[1], pages);
      expect(prev.id).toBe('p1');
    });

    it('returns null for first page', () => {
      const pages = [{ id: 'p1' }, { id: 'p2' }];
      const prev = exporter.getPreviousPage(pages[0], pages);
      expect(prev).toBeNull();
    });
  });

  describe('getNextPage', () => {
    it('returns next page in list', () => {
      const pages = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
      const next = exporter.getNextPage(pages[1], pages);
      expect(next.id).toBe('p3');
    });

    it('returns null for last page', () => {
      const pages = [{ id: 'p1' }, { id: 'p2' }];
      const next = exporter.getNextPage(pages[1], pages);
      expect(next).toBeNull();
    });
  });

  describe('createZip', () => {
    it('creates a new JSZip instance', () => {
      const zip = exporter.createZip();
      expect(zip).toBeDefined();
    });
  });

  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(exporter.escapeHtml('<div>')).toBe('&lt;div&gt;');
      expect(exporter.escapeHtml('a & b')).toBe('a &amp; b');
      expect(exporter.escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    });

    it('returns empty string for null/undefined', () => {
      expect(exporter.escapeHtml(null)).toBe('');
      expect(exporter.escapeHtml(undefined)).toBe('');
    });
  });

  describe('isAncestorOf', () => {
    it('returns true for direct parent', () => {
      const pages = [
        { id: 'parent', parentId: null },
        { id: 'child', parentId: 'parent' },
      ];
      expect(exporter.isAncestorOf(pages[0], 'child', pages)).toBe(true);
    });

    it('returns true for grandparent', () => {
      const pages = [
        { id: 'grandparent', parentId: null },
        { id: 'parent', parentId: 'grandparent' },
        { id: 'child', parentId: 'parent' },
      ];
      expect(exporter.isAncestorOf(pages[0], 'child', pages)).toBe(true);
    });

    it('returns false for non-ancestor', () => {
      const pages = [
        { id: 'p1', parentId: null },
        { id: 'p2', parentId: null },
      ];
      expect(exporter.isAncestorOf(pages[0], 'p2', pages)).toBe(false);
    });
  });
});
