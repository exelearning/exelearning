/**
 * ElpxExporter Tests
 *
 * Unit tests for ElpxExporter - exports to .elpx format (ZIP containing content.xml).
 *
 */

// Test functions available globally from vitest setup

/* eslint-disable no-undef */

// Clear window.ElpxExporter to test the fallback implementation
delete window.ElpxExporter;

const ElpxExporter = require('./ElpxExporter');

// Mock JSZip
class MockJSZip {
  constructor() {
    this.files = new Map();
  }

  file(name, content) {
    this.files.set(name, content);
    return this;
  }

  async generateAsync(options) {
    return new Blob(['mock zip content'], { type: 'application/zip' });
  }
}

// Mock document manager
const createMockDocumentManager = () => {
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
              blocks: {
                length: 1,
                get: mock((i) => ({
                  get: mock((k) => {
                    const blockData = {
                      id: 'block-1',
                      blockId: 'block-1',
                      blockName: 'Main Block',
                      order: 0,
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
                              properties: {
                                forEach: mock((cb) => {
                                  cb('value1', 'prop1');
                                }),
                              },
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

    window.JSZip = MockJSZip;

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
    // Restore original globals (don't delete JSZip - it's needed by other tests)
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
    it('throws when JSZip not loaded', async () => {
      const savedJSZip = window.JSZip;
      delete window.JSZip;

      await expect(exporter.exportToFile('test.elpx')).rejects.toThrow(
        'JSZip library not loaded'
      );

      window.JSZip = savedJSZip; // Restore for other tests
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
    it('throws when JSZip not loaded', async () => {
      const savedJSZip = window.JSZip;
      delete window.JSZip;

      await expect(exporter.exportToBlob()).rejects.toThrow(
        'JSZip library not loaded'
      );

      window.JSZip = savedJSZip; // Restore for other tests
    });

    it('returns blob without triggering download', async () => {
      const blob = await exporter.exportToBlob();

      expect(blob).toBeInstanceOf(Blob);
      expect(global.document.createElement).not.toHaveBeenCalled();
    });
  });

  describe('generateContentXml', () => {
    it('generates valid XML structure', () => {
      const xml = exporter.generateContentXml();

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">');
      expect(xml).toContain('</ode>');
    });

    it('includes odeProperties', () => {
      const xml = exporter.generateContentXml();

      expect(xml).toContain('<odeProperties>');
      expect(xml).toContain('<pp_title>Test Project</pp_title>');
      expect(xml).toContain('<pp_author>Test Author</pp_author>');
      expect(xml).toContain('<pp_lang>es</pp_lang>');
      expect(xml).toContain('</odeProperties>');
    });

    it('includes odeNavStructures', () => {
      const xml = exporter.generateContentXml();

      expect(xml).toContain('<odeNavStructures>');
      expect(xml).toContain('</odeNavStructures>');
    });

    it('includes pages from navigation', () => {
      const xml = exporter.generateContentXml();

      expect(xml).toContain('odeNavStructureId="page-1"');
      expect(xml).toContain('odePageName="Introduction"');
    });
  });

  describe('generatePropertiesXml', () => {
    it('generates properties XML', () => {
      const metadata = mockDocManager.getMetadata();
      const xml = exporter.generatePropertiesXml(metadata);

      expect(xml).toContain('<odeProperties>');
      expect(xml).toContain('<pp_title>Test Project</pp_title>');
      expect(xml).toContain('<pp_author>Test Author</pp_author>');
      expect(xml).toContain('<pp_lang>es</pp_lang>');
      expect(xml).toContain('<pp_description>Test description</pp_description>');
      expect(xml).toContain('<pp_license>CC BY-SA 4.0</pp_license>');
      expect(xml).toContain('</odeProperties>');
    });

    it('uses defaults for missing values', () => {
      const emptyMetadata = { get: mock(() => null) };
      const xml = exporter.generatePropertiesXml(emptyMetadata);

      expect(xml).toContain('<pp_title>Untitled</pp_title>');
      expect(xml).toContain('<pp_lang>en</pp_lang>');
    });
  });

  describe('generatePageXml', () => {
    it('generates page XML with blocks', () => {
      const pageMap = mockDocManager.getNavigation().get(0);
      const xml = exporter.generatePageXml(pageMap, 0);

      expect(xml).toContain('odeNavStructureId="page-1"');
      expect(xml).toContain('odePageName="Introduction"');
      expect(xml).toContain('odeNavStructureOrder="0"');
      expect(xml).toContain('</odeNavStructure>');
    });

    it('includes parentId when present', () => {
      const pageMap = mockDocManager.getNavigation().get(1);
      const xml = exporter.generatePageXml(pageMap, 1);

      expect(xml).toContain('parentOdeNavStructureId="page-1"');
    });
  });

  describe('generateBlockXml', () => {
    it('generates block XML with components', () => {
      const pageMap = mockDocManager.getNavigation().get(0);
      const blockMap = pageMap.get('blocks').get(0);
      const xml = exporter.generateBlockXml(blockMap, 0);

      expect(xml).toContain('odePagStructureId="block-1"');
      expect(xml).toContain('blockName="Main Block"');
      expect(xml).toContain('</odePagStructure>');
    });
  });

  describe('generateComponentXml', () => {
    it('generates component XML', () => {
      const pageMap = mockDocManager.getNavigation().get(0);
      const blockMap = pageMap.get('blocks').get(0);
      const compMap = blockMap.get('components').get(0);
      const xml = exporter.generateComponentXml(compMap, 0);

      expect(xml).toContain('odeComponentId="comp-1"');
      expect(xml).toContain('odeIdeviceTypeDirName="FreeTextIdevice"');
      expect(xml).toContain('<htmlView><![CDATA[<p>Hello World</p>]]></htmlView>');
      expect(xml).toContain('</odeComponent>');
    });

    it('includes properties when present', () => {
      const pageMap = mockDocManager.getNavigation().get(0);
      const blockMap = pageMap.get('blocks').get(0);
      const compMap = blockMap.get('components').get(0);
      const xml = exporter.generateComponentXml(compMap, 0);

      expect(xml).toContain('<jsonProperties>');
    });

    it('includes prop_ prefixed properties', () => {
      const pageMap = mockDocManager.getNavigation().get(0);
      const blockMap = pageMap.get('blocks').get(0);
      const compMap = blockMap.get('components').get(0);
      const xml = exporter.generateComponentXml(compMap, 0);

      expect(xml).toContain('<odeComponentProperty key="custom">');
    });
  });

  describe('addAssetsToZip', () => {
    it('adds all assets to zip', async () => {
      const zip = new MockJSZip();
      await exporter.addAssetsToZip(zip);

      expect(mockAssetCache.getAllAssets).toHaveBeenCalled();
      expect(zip.files.size).toBe(2);
    });

    it('uses originalPath when available', async () => {
      const zip = new MockJSZip();
      await exporter.addAssetsToZip(zip);

      expect(zip.files.has('images/test.jpg')).toBe(true);
    });

    it('handles assets without originalPath', async () => {
      const zip = new MockJSZip();
      await exporter.addAssetsToZip(zip);

      expect(zip.files.has('video.mp4')).toBe(true);
    });

    it('handles errors gracefully', async () => {
      mockAssetCache.getAllAssets.mockResolvedValue([
        {
          assetId: 'bad-asset',
          blob: null, // Will cause error when adding to zip
          metadata: {},
        },
      ]);

      const zip = new MockJSZip();
      zip.file = mock(() => {
        throw new Error('Failed to add');
      });

      // Should not throw
      await exporter.addAssetsToZip(zip);

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
