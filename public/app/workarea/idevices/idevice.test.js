/**
 * Idevice class Tests
 *
 * Unit tests for the Idevice class that handles iDevice configuration.
 *
 * Run with: make test-frontend
 */

 

import Idevice from './idevice.js';

describe('Idevice', () => {
  let mockManager;
  let mockIdeviceData;

  beforeEach(() => {
    // Mock AppLogger
    window.AppLogger = {
      log: vi.fn(),
    };

    // Mock translation function
    window._ = vi.fn((text) => `translated:${text}`);

    // Mock manager
    mockManager = {
      symfonyURL: 'http://localhost:8080',
      app: {
        api: {
          endpoints: {
            api_idevices_download_file_resources: {
              path: '/api/idevices/resources',
            },
          },
        },
        project: {
          idevices: {
            loadScriptDynamically: vi.fn(() => document.createElement('script')),
            loadStyleByInsertingIt: vi.fn(() =>
              Promise.resolve(document.createElement('link'))
            ),
          },
        },
      },
    };

    // Mock idevice data with all required fields
    mockIdeviceData = {
      name: 'text-idevice',
      url: '/files/perm/idevices/base/text-idevice',
      title: 'Text',
      category: 'Basic',
      author: 'eXeLearning',
      version: '2.0',
      editionJs: ['text-idevice.js'],
      editionCss: ['text-idevice.css'],
      exportJs: ['text-idevice.js'],
      exportCss: ['text-idevice.css'],
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete window.AppLogger;
    delete window._;
  });

  describe('constructor', () => {
    it('sets manager reference', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.manager).toBe(mockManager);
    });

    it('sets id from data.name', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.id).toBe('text-idevice');
    });

    it('constructs path from manager URL and data URL', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.path).toBe(
        'http://localhost:8080/files/perm/idevices/base/text-idevice'
      );
    });

    it('constructs pathEdition', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.pathEdition).toBe(
        'http://localhost:8080/files/perm/idevices/base/text-idevice/edition/'
      );
    });

    it('constructs pathExport', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.pathExport).toBe(
        'http://localhost:8080/files/perm/idevices/base/text-idevice/export/'
      );
    });

    it('sets exportObject when exportJs has items', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.exportObject).toBe('$textidevice');
    });

    it('sets exportObject to null when exportJs is empty', () => {
      mockIdeviceData.exportJs = [];
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.exportObject).toBeNull();
    });
  });

  describe('configParams', () => {
    it('contains all expected parameters', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      const expectedParams = [
        'apiVersion',
        'author',
        'authorUrl',
        'category',
        'componentType',
        'cssClass',
        'description',
        'editionCss',
        'editionJs',
        'exportCss',
        'exportJs',
        'icon',
        'license',
        'licenseUrl',
        'location',
        'locationType',
        'title',
        'version',
        'downloadable',
      ];

      expectedParams.forEach((param) => {
        expect(idevice.configParams).toContain(param);
      });
    });
  });

  describe('configParamsTranslatables', () => {
    it('contains only title (category is NOT translated for matching purposes)', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.configParamsTranslatables).toContain('title');
      expect(idevice.configParamsTranslatables).not.toContain('category');
    });

    it('has exactly 1 item', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.configParamsTranslatables).toHaveLength(1);
    });
  });

  describe('default values', () => {
    it('has default apiVersion of 3.0', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.default.apiVersion).toBe('3.0');
    });

    it('has default category of Others', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.default.category).toBe('Others');
    });

    it('has default componentType of html', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.default.componentType).toBe('html');
    });

    it('has default cssClass of default', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.default.cssClass).toBe('default');
    });

    it('has default title of Unknown', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.default.title).toBe('Unknown');
    });

    it('has default version of 1.0', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.default.version).toBe('1.0');
    });
  });

  describe('getIdeviceObjectKey', () => {
    it('converts hyphenated id to camelCase with $ prefix', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.getIdeviceObjectKey()).toBe('$textidevice');
    });

    it('handles multiple hyphens', () => {
      mockIdeviceData.name = 'my-custom-idevice';
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.getIdeviceObjectKey()).toBe('$mycustomidevice');
    });

    it('handles id without hyphens', () => {
      mockIdeviceData.name = 'simpleidevice';
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.getIdeviceObjectKey()).toBe('$simpleidevice');
    });
  });

  describe('setConfigValues', () => {
    it('sets values from data', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.author).toBe('eXeLearning');
      expect(idevice.version).toBe('2.0');
    });

    it('translates translatable params (only title, not category)', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(window._).toHaveBeenCalledWith('Text', 'text-idevice');
      // Category is NOT translated - it stays in English for matching
      expect(window._).not.toHaveBeenCalledWith('Basic', 'text-idevice');
    });

    it('sets translated value for title but NOT for category', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.title).toBe('translated:Text');
      // Category stays in English for matching with known category keys
      expect(idevice.category).toBe('Basic');
    });
  });

  describe('isTranslatable', () => {
    it('returns false for category (kept in English for matching)', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.isTranslatable('category')).toBe(false);
    });

    it('returns true for title', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.isTranslatable('title')).toBe(true);
    });

    it('returns false for author', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.isTranslatable('author')).toBe(false);
    });

    it('returns false for version', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.isTranslatable('version')).toBe(false);
    });
  });

  describe('isValid', () => {
    it('returns true when id is set', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      expect(idevice.isValid()).toBe(true);
    });

    it('returns false when id is null', () => {
      // Creating with null name throws, so we test by manually setting id after creation
      const idevice = new Idevice(mockManager, mockIdeviceData);
      idevice.id = null;
      expect(idevice.isValid()).toBe(false);
    });
  });

  describe('loadScriptsEdition', () => {
    it('loads edition scripts', () => {
      mockIdeviceData.editionJs = ['script1.js', 'script2.js'];
      const idevice = new Idevice(mockManager, mockIdeviceData);

      const result = idevice.loadScriptsEdition();

      expect(result).toHaveLength(2);
      expect(mockManager.app.project.idevices.loadScriptDynamically).toHaveBeenCalledTimes(2);
    });

    it('constructs correct paths for scripts', () => {
      mockIdeviceData.editionJs = ['test.js'];
      const idevice = new Idevice(mockManager, mockIdeviceData);

      idevice.loadScriptsEdition();

      expect(
        mockManager.app.project.idevices.loadScriptDynamically
      ).toHaveBeenCalledWith(expect.stringContaining('test.js'), false);
    });

    it('returns empty array when no scripts', () => {
      mockIdeviceData.editionJs = [];
      const idevice = new Idevice(mockManager, mockIdeviceData);

      const result = idevice.loadScriptsEdition();

      expect(result).toHaveLength(0);
    });
  });

  describe('loadScriptsExport', () => {
    it('loads export scripts', () => {
      mockIdeviceData.exportJs = ['export1.js', 'export2.js'];
      const idevice = new Idevice(mockManager, mockIdeviceData);

      const result = idevice.loadScriptsExport();

      expect(result).toHaveLength(2);
      expect(mockManager.app.project.idevices.loadScriptDynamically).toHaveBeenCalledTimes(2);
    });

    it('uses pathExport for export scripts', () => {
      mockIdeviceData.exportJs = ['export.js'];
      const idevice = new Idevice(mockManager, mockIdeviceData);

      idevice.loadScriptsExport();

      expect(
        mockManager.app.project.idevices.loadScriptDynamically
      ).toHaveBeenCalledWith(expect.stringContaining('export.js'), false);
    });
  });

  describe('loadStylesEdition', () => {
    it('loads edition styles', async () => {
      mockIdeviceData.editionCss = ['style1.css', 'style2.css'];
      const idevice = new Idevice(mockManager, mockIdeviceData);

      const result = await idevice.loadStylesEdition();

      expect(result).toHaveLength(2);
      expect(mockManager.app.project.idevices.loadStyleByInsertingIt).toHaveBeenCalledTimes(2);
    });

    it('passes idevice and edition mode', async () => {
      mockIdeviceData.editionCss = ['style.css'];
      const idevice = new Idevice(mockManager, mockIdeviceData);

      await idevice.loadStylesEdition();

      expect(
        mockManager.app.project.idevices.loadStyleByInsertingIt
      ).toHaveBeenCalledWith(expect.any(String), idevice, 'edition');
    });
  });

  describe('loadStylesExport', () => {
    it('loads export styles', async () => {
      mockIdeviceData.exportCss = ['export1.css', 'export2.css'];
      const idevice = new Idevice(mockManager, mockIdeviceData);

      const result = await idevice.loadStylesExport();

      expect(result).toHaveLength(2);
      expect(mockManager.app.project.idevices.loadStyleByInsertingIt).toHaveBeenCalledTimes(2);
    });

    it('passes idevice and export mode', async () => {
      mockIdeviceData.exportCss = ['export.css'];
      const idevice = new Idevice(mockManager, mockIdeviceData);

      await idevice.loadStylesExport();

      expect(
        mockManager.app.project.idevices.loadStyleByInsertingIt
      ).toHaveBeenCalledWith(expect.any(String), idevice, 'export');
    });
  });

  describe('getResourceServicePath', () => {
    it('returns path as-is for static mode iDevice paths', () => {
      // Static mode: paths containing /files/perm/idevices/ are served directly
      const idevice = new Idevice(mockManager, mockIdeviceData);
      const result = idevice.getResourceServicePath('/files/perm/idevices/test/style.css');

      expect(result).toBe('/files/perm/idevices/test/style.css');
    });

    it('handles paths without /files/ prefix via API', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);
      const result = idevice.getResourceServicePath('some/other/path.js');

      expect(result).toBe('/api/idevices/resources?resource=some/other/path.js');
    });

    it('returns correct path for various inputs', () => {
      const idevice = new Idevice(mockManager, mockIdeviceData);

      // Test with /files/perm/idevices/ prefix - static mode returns as-is
      expect(idevice.getResourceServicePath('/files/perm/idevices/text/style.css')).toBe(
        '/files/perm/idevices/text/style.css'
      );

      // Test empty input - goes through API
      expect(idevice.getResourceServicePath('')).toBe('/api/idevices/resources?resource=');
    });
  });
});
