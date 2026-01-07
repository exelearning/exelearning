/**
 * ElpxExporter Tests
 *
 * Unit tests for ElpxExporter - exports to .elpx format (ZIP containing content.xml).
 *
 */

// Test functions available globally from vitest setup

 

// Clear window.ElpxExporter to test the fallback implementation
delete window.ElpxExporter;

const ElpxExporter = require('./ElpxExporter');

// Mock fflate library
const createMockFflate = () => ({
  strToU8: (str) => new TextEncoder().encode(str),
  strFromU8: (data) => new TextDecoder().decode(data),
  zip: (files, callback) => {
    const mockZip = new Uint8Array([80, 75, 3, 4]); // ZIP magic bytes
    setTimeout(() => callback(null, mockZip), 0);
  },
  zipSync: (files) => new Uint8Array([80, 75, 3, 4]),
  unzipSync: (data) => ({ 'content.xml': new TextEncoder().encode('<?xml?>') }),
});

// Mock document manager with full properties support
const createMockDocumentManager = () => {
  // Mock Y.Map-like properties for page
  const pageProperties = {
    get: mock((key) => {
      const props = {
        visibility: 'true',
        highlight: 'false',
        hidePageTitle: 'true',
        editableInPage: 'false',
        titlePage: 'Custom Page Title',
        titleNode: 'Custom Title Node',
      };
      return props[key];
    }),
  };

  // Mock Y.Map-like properties for block
  const blockProperties = {
    get: mock((key) => {
      const props = {
        visibility: 'true',
        teacherOnly: 'false',
        allowToggle: 'true',
        minimized: 'false',
        identifier: 'my-block-id',
        cssClass: 'custom-class',
      };
      return props[key];
    }),
  };

  // Mock Y.Map-like properties for component
  const componentProperties = {
    get: mock((key) => {
      const props = {
        visibility: 'true',
        teacherOnly: 'true',
        identifier: 'my-comp-id',
        cssClass: 'comp-class',
      };
      return props[key];
    }),
    forEach: mock((cb) => {
      cb('true', 'visibility');
      cb('true', 'teacherOnly');
      cb('my-comp-id', 'identifier');
      cb('comp-class', 'cssClass');
    }),
  };

  const navigation = {
    length: 2,
    get: mock((index) => {
      const pages = [
        {
          get: mock((key) => {
            const data = {
              id: 'page-1',
              pageId: 'page-1',
              pageName: 'Introduction',
              parentId: null,
              order: 0,
              properties: pageProperties,
              blocks: {
                length: 1,
                get: mock((i) => ({
                  get: mock((k) => {
                    const blockData = {
                      id: 'block-1',
                      blockId: 'block-1',
                      blockName: 'Main Block',
                      iconName: 'objectives',
                      order: 0,
                      properties: blockProperties,
                      components: {
                        length: 1,
                        get: mock((j) => ({
                          get: mock((ck) => {
                            const compData = {
                              id: 'comp-1',
                              ideviceId: 'comp-1',
                              ideviceType: 'FreeTextIdevice',
                              order: 0,
                              htmlContent: {
                                toString: () => '<p>Hello World</p>',
                              },
                              properties: componentProperties,
                              ideviceProperties: componentProperties,
                            };
                            return compData[ck];
                          }),
                          forEach: mock((cb) => {
                            cb('value', 'prop_custom');
                          }),
                        })),
                      },
                    };
                    return blockData[k];
                  }),
                })),
              },
            };
            return data[key];
          }),
        },
        {
          get: mock((key) => {
            const data = {
              id: 'page-2',
              pageId: 'page-2',
              pageName: 'Chapter 1',
              parentId: 'page-1',
              order: 1,
              properties: null,
              blocks: { length: 0, get: mock(() => undefined) },
            };
            return data[key];
          }),
        },
      ];
      return pages[index];
    }),
  };

  const metadata = {
    get: mock((key) => {
      const data = {
        title: 'Test Project',
        author: 'Test Author',
        language: 'es',
        description: 'Test description',
        license: 'CC BY-SA 4.0',
        theme: 'base',
        addPagination: 'true',
        addSearchBox: 'true',
        addExeLink: 'false',
        addAccessibilityToolbar: 'true',
        extraHeadContent: '<meta name="test">',
        footer: '<footer>Test</footer>',
        exportSource: 'false',
        exelearning_version: 'v4.0-test',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      return data[key];
    }),
  };

  return {
    getNavigation: mock(() => navigation),
    getMetadata: mock(() => metadata),
  };
};

// Mock asset cache manager
const createMockAssetCache = () => ({
  getAllAssets: mock(() => undefined).mockResolvedValue([
    {
      assetId: 'asset-1',
      blob: new Blob(['image data']),
      metadata: { originalPath: 'images/test.jpg', filename: 'test.jpg' },
    },
    {
      assetId: 'asset-2',
      blob: new Blob(['video data']),
      metadata: { filename: 'video.mp4' },
    },
  ]),
});

describe('ElpxExporter', () => {
  let exporter;
  let mockDocManager;
  let mockAssetCache;
  let originalURL;
  let originalDocument;

  beforeEach(() => {
    mockDocManager = createMockDocumentManager();
    mockAssetCache = createMockAssetCache();

    window.fflate = createMockFflate();

    // Store original globals for restoration
    originalURL = global.URL;
    originalDocument = global.document;

    // Mock URL.createObjectURL/revokeObjectURL
    global.URL = {
      createObjectURL: mock(() => 'blob:mock-url'),
      revokeObjectURL: mock(() => undefined),
    };

    // Mock document for download
    global.document = {
      createElement: mock(() => ({
        href: '',
        download: '',
        click: mock(() => undefined),
      })),
      body: {
        appendChild: mock(() => undefined),
        removeChild: mock(() => undefined),
      },
    };

    exporter = new ElpxExporter(mockDocManager, mockAssetCache);

    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original globals
    global.URL = originalURL;
    global.document = originalDocument;
  });

  describe('constructor', () => {
    it('initializes with document manager', () => {
      expect(exporter.manager).toBe(mockDocManager);
    });

    it('initializes with asset cache manager', () => {
      expect(exporter.assetCache).toBe(mockAssetCache);
    });

    it('initializes without asset cache', () => {
      const exporterNoCache = new ElpxExporter(mockDocManager);
      expect(exporterNoCache.assetCache).toBeNull();
    });
  });

  describe('getFileExtension', () => {
    it('returns .elpx', () => {
      expect(exporter.getFileExtension()).toBe('.elpx');
    });
  });

  describe('getFileSuffix', () => {
    it('returns empty string', () => {
      expect(exporter.getFileSuffix()).toBe('');
    });
  });

  describe('buildFilename', () => {
    it('builds filename from title', () => {
      const filename = exporter.buildFilename();

      expect(filename).toBe('test-project.elpx');
    });

    it('sanitizes special characters', () => {
      mockDocManager.getMetadata().get.mockImplementation((key) => {
        if (key === 'title') return 'Test! @Project# $Name%';
        return null;
      });

      const filename = exporter.buildFilename();

      expect(filename).toMatch(/^[a-z0-9-]+\.elpx$/);
    });

    it('truncates long titles', () => {
      mockDocManager.getMetadata().get.mockImplementation((key) => {
        if (key === 'title') return 'A'.repeat(100);
        return null;
      });

      const filename = exporter.buildFilename();

      expect(filename.length).toBeLessThanOrEqual(55); // 50 chars + '.elpx'
    });

    it('uses default for missing title', () => {
      mockDocManager.getMetadata().get.mockImplementation(() => null);

      const filename = exporter.buildFilename();

      expect(filename).toBe('export.elpx');
    });
  });

  describe('export', () => {
    it('exports with generated filename when none provided', async () => {
      exporter.exportToFile = mock(() => undefined).mockResolvedValue({ success: true });

      await exporter.export();

      expect(exporter.exportToFile).toHaveBeenCalledWith('test-project.elpx');
    });

    it('exports with provided filename', async () => {
      exporter.exportToFile = mock(() => undefined).mockResolvedValue({ success: true });

      await exporter.export('custom.elpx');

      expect(exporter.exportToFile).toHaveBeenCalledWith('custom.elpx');
    });
  });

  describe('exportToFile', () => {
    it('throws when fflate not loaded', async () => {
      const savedFflate = window.fflate;
      delete window.fflate;

      await expect(exporter.exportToFile('test.elpx')).rejects.toThrow(
        'fflate library not loaded'
      );

      window.fflate = savedFflate; // Restore for other tests
    });

    it('creates ZIP with content.xml', async () => {
      const result = await exporter.exportToFile('test.elpx');

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test.elpx');
    });

    it('triggers download', async () => {
      await exporter.exportToFile('test.elpx');

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.document.createElement).toHaveBeenCalledWith('a');
    });

    it('includes assets when cache available', async () => {
      await exporter.exportToFile('test.elpx');

      expect(mockAssetCache.getAllAssets).toHaveBeenCalled();
    });
  });

  describe('exportToBlob', () => {
    it('throws when fflate not loaded', async () => {
      const savedFflate = window.fflate;
      delete window.fflate;

      await expect(exporter.exportToBlob()).rejects.toThrow(
        'fflate library not loaded'
      );

      window.fflate = savedFflate; // Restore for other tests
    });

    it('returns blob without triggering download', async () => {
      const blob = await exporter.exportToBlob();

      expect(blob).toBeInstanceOf(Blob);
      expect(global.document.createElement).not.toHaveBeenCalled();
    });
  });

  describe('generateContentXml', () => {
    it('generates valid XML structure with exe_document format', () => {
      const xml = exporter.generateContentXml();

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<!DOCTYPE exe_document SYSTEM "content.dtd">');
      expect(xml).toContain('<exe_document>');
      expect(xml).toContain('</exe_document>');
    });

    it('includes meta section with metadata', () => {
      const xml = exporter.generateContentXml();

      expect(xml).toContain('<meta>');
      expect(xml).toContain('<title>Test Project</title>');
      expect(xml).toContain('<author>Test Author</author>');
      expect(xml).toContain('<language>es</language>');
      expect(xml).toContain('</meta>');
    });

    it('includes navigation section', () => {
      const xml = exporter.generateContentXml();

      expect(xml).toContain('<navigation>');
      expect(xml).toContain('</navigation>');
    });

    it('includes pages from navigation with page element format', () => {
      const xml = exporter.generateContentXml();

      expect(xml).toContain('id="page-1"');
      expect(xml).toContain('title="Introduction"');
    });

    it('includes components in page elements', () => {
      const xml = exporter.generateContentXml();

      // Component with type and id attributes
      expect(xml).toContain('<component');
      expect(xml).toContain('type="FreeTextIdevice"');
      expect(xml).toContain('id="comp-1"');
      expect(xml).toContain('<content>');
    });
  });

  describe('generateMetaXml', () => {
    it('generates meta XML with metadata elements', () => {
      const metadata = mockDocManager.getMetadata();
      const xml = exporter.generateMetaXml(metadata);

      expect(xml).toContain('<meta>');
      expect(xml).toContain('<title>Test Project</title>');
      expect(xml).toContain('<author>Test Author</author>');
      expect(xml).toContain('<language>es</language>');
      expect(xml).toContain('<theme>base</theme>');
      expect(xml).toContain('</meta>');
    });

    it('includes export settings', () => {
      const metadata = mockDocManager.getMetadata();
      const xml = exporter.generateMetaXml(metadata);

      expect(xml).toContain('<addPagination>true</addPagination>');
      expect(xml).toContain('<addSearchBox>true</addSearchBox>');
      expect(xml).toContain('<addAccessibilityToolbar>true</addAccessibilityToolbar>');
    });

    it('uses defaults for missing values', () => {
      const emptyMetadata = { get: mock(() => null) };
      const xml = exporter.generateMetaXml(emptyMetadata);

      expect(xml).toContain('<title>Untitled</title>');
      expect(xml).toContain('<language>en</language>');
    });
  });

  describe('generatePageXml', () => {
    it('generates page XML with attributes', () => {
      // Build page tree first (as generatePageXml expects hierarchical structure)
      const pageTree = exporter.buildPageTree(mockDocManager.getNavigation());
      const xml = exporter.generatePageXml(pageTree[0], 2);

      expect(xml).toContain('<page');
      expect(xml).toContain('id="page-1"');
      expect(xml).toContain('title="Introduction"');
      expect(xml).toContain('</page>');
    });

    it('includes nested child pages', () => {
      const pageTree = exporter.buildPageTree(mockDocManager.getNavigation());
      const xml = exporter.generatePageXml(pageTree[0], 2);

      // Child page should be nested inside parent
      expect(xml).toContain('id="page-2"');
      expect(xml).toContain('title="Chapter 1"');
    });

    it('includes components in pages', () => {
      const pageTree = exporter.buildPageTree(mockDocManager.getNavigation());
      const xml = exporter.generatePageXml(pageTree[0], 2);

      expect(xml).toContain('<component');
      expect(xml).toContain('type="FreeTextIdevice"');
    });
  });

  describe('generateComponentXml', () => {
    it('generates component XML with attributes', () => {
      const pageMap = mockDocManager.getNavigation().get(0);
      const blockMap = pageMap.get('blocks').get(0);
      const compMap = blockMap.get('components').get(0);
      const xml = exporter.generateComponentXml(compMap, 0, 3);

      expect(xml).toContain('<component');
      expect(xml).toContain('type="FreeTextIdevice"');
      expect(xml).toContain('id="comp-1"');
      expect(xml).toContain('position="0"');
      expect(xml).toContain('</component>');
    });

    it('includes content in CDATA', () => {
      const pageMap = mockDocManager.getNavigation().get(0);
      const blockMap = pageMap.get('blocks').get(0);
      const compMap = blockMap.get('components').get(0);
      const xml = exporter.generateComponentXml(compMap, 0, 3);

      expect(xml).toContain('<content><![CDATA[<p>Hello World</p>]]></content>');
    });

    it('includes properties as JSON when available', () => {
      const pageMap = mockDocManager.getNavigation().get(0);
      const blockMap = pageMap.get('blocks').get(0);
      const compMap = blockMap.get('components').get(0);
      const xml = exporter.generateComponentXml(compMap, 0, 3);

      expect(xml).toContain('<properties>');
    });
  });

  describe('addAssetsToFiles', () => {
    it('adds all assets to files object', async () => {
      const files = {};
      await exporter.addAssetsToFiles(files);

      expect(mockAssetCache.getAllAssets).toHaveBeenCalled();
      expect(Object.keys(files).length).toBe(2);
    });

    it('uses originalPath when available', async () => {
      const files = {};
      await exporter.addAssetsToFiles(files);

      expect('images/test.jpg' in files).toBe(true);
    });

    it('handles assets without originalPath', async () => {
      const files = {};
      await exporter.addAssetsToFiles(files);

      expect('video.mp4' in files).toBe(true);
    });

    it('handles errors gracefully', async () => {
      mockAssetCache.getAllAssets.mockResolvedValue([
        {
          assetId: 'bad-asset',
          blob: {
            arrayBuffer: () => Promise.reject(new Error('Failed to read blob'))
          },
          metadata: { filename: 'bad.png' },
        },
      ]);

      const files = {};

      // Should not throw
      await exporter.addAssetsToFiles(files);

      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('escapeXml', () => {
    it('escapes XML special characters', () => {
      expect(exporter.escapeXml('a & b')).toBe('a &amp; b');
      expect(exporter.escapeXml('a < b')).toBe('a &lt; b');
      expect(exporter.escapeXml('a > b')).toBe('a &gt; b');
      expect(exporter.escapeXml('a "quote" b')).toBe('a &quot;quote&quot; b');
      expect(exporter.escapeXml("a 'apos' b")).toBe('a &apos;apos&apos; b');
    });

    it('handles null/undefined', () => {
      expect(exporter.escapeXml(null)).toBe('');
      expect(exporter.escapeXml(undefined)).toBe('');
    });

    it('converts non-strings', () => {
      expect(exporter.escapeXml(123)).toBe('123');
    });
  });

  describe('downloadBlob', () => {
    it('creates download link and triggers click', () => {
      const mockLink = {
        href: '',
        download: '',
        click: mock(() => undefined),
      };
      global.document.createElement.mockReturnValue(mockLink);

      const blob = new Blob(['test']);
      exporter.downloadBlob(blob, 'test.elpx');

      expect(mockLink.href).toBe('blob:mock-url');
      expect(mockLink.download).toBe('test.elpx');
      expect(mockLink.click).toHaveBeenCalled();
      expect(global.document.body.appendChild).toHaveBeenCalled();
      expect(global.document.body.removeChild).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});

describe('ElpxExporter compatibility layer', () => {
  beforeEach(() => {
    // Clear require cache
    // Mock: clear module state;

    // Suppress console
    spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // jest.restoreAllMocks();
    delete window.ElpxExporter;
  });

  it('uses existing ElpxExporter if already loaded', () => {
    // Pre-set window.ElpxExporter
    const existingExporter = class MockExporter {};
    window.ElpxExporter = existingExporter;

    // Re-require the module
    require('./ElpxExporter');

    // Should still be the existing one
    expect(window.ElpxExporter).toBe(existingExporter);
  });
});
