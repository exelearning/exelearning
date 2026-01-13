import ThemesManager from './themesManager.js';
import ThemeList from './themeList.js';

// Mock ThemeList class
vi.mock('./themeList.js', () => {
  return {
    default: vi.fn().mockImplementation(function(manager) {
      this.manager = manager;
      this.installed = {};
      this.load = vi.fn().mockResolvedValue(undefined);
      this.getThemeInstalled = vi.fn((id) => {
        return this.installed[id] || null;
      });
    })
  };
});

describe('ThemesManager', () => {
  let themesManager;
  let mockApp;
  let mockMetadata;
  let mockDocumentManager;
  let mockDoc;
  let mockBridge;

  beforeEach(() => {
    // Mock AppLogger
    window.AppLogger = {
      log: vi.fn(),
    };

    // Mock metadata
    mockMetadata = new Map();
    mockMetadata.observe = vi.fn();
    mockMetadata.get = vi.fn((key) => mockMetadata._data?.get(key));
    mockMetadata.set = vi.fn((key, value) => {
      if (!mockMetadata._data) mockMetadata._data = new Map();
      mockMetadata._data.set(key, value);
    });
    mockMetadata._data = new Map();

    // Mock Yjs document
    mockDoc = {
      clientID: 12345,
      transact: vi.fn((fn, origin) => fn()),
    };

    // Mock document manager
    mockDocumentManager = {
      getMetadata: vi.fn(() => mockMetadata),
      getDoc: vi.fn(() => mockDoc),
    };

    // Mock bridge
    mockBridge = {
      getDocumentManager: vi.fn(() => mockDocumentManager),
    };

    // Mock app
    mockApp = {
      eXeLearning: {
        config: {
          basePath: 'http://localhost:8080',
        },
      },
      project: {
        _yjsBridge: mockBridge,
      },
      menus: {
        navbar: {
          styles: {
            updateSelectedTheme: vi.fn(),
          },
        },
      },
    };

    window.eXeLearning = {
      config: {
        defaultTheme: 'default-theme',
      },
    };

    themesManager = new ThemesManager(mockApp);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete window.AppLogger;
    delete window.eXeLearning;
  });

  describe('constructor', () => {
    it('should store app reference', () => {
      expect(themesManager.app).toBe(mockApp);
    });

    it('should create ThemeList instance', () => {
      expect(ThemeList).toHaveBeenCalledWith(themesManager);
      expect(themesManager.list).toBeDefined();
    });

    it('should set symfonyURL from app', () => {
      expect(themesManager.symfonyURL).toBe('http://localhost:8080');
    });

    it('should initialize selected as null', () => {
      expect(themesManager.selected).toBeNull();
    });

    it('should initialize metadataObserver as null', () => {
      expect(themesManager.metadataObserver).toBeNull();
    });

    it('should initialize isApplyingRemoteTheme as false', () => {
      expect(themesManager.isApplyingRemoteTheme).toBe(false);
    });
  });

  describe('initYjsBinding', () => {
    beforeEach(() => {
      // Set up a theme in the list
      themesManager.list.installed['test-theme'] = {
        id: 'test-theme',
        select: vi.fn().mockResolvedValue(undefined),
      };
    });

    it('should get document manager from bridge', () => {
      themesManager.initYjsBinding();

      expect(mockBridge.getDocumentManager).toHaveBeenCalled();
    });

    it('should get metadata from document manager', () => {
      themesManager.initYjsBinding();

      expect(mockDocumentManager.getMetadata).toHaveBeenCalled();
    });

    it('should load initial theme from metadata', () => {
      mockMetadata._data.set('theme', 'test-theme');
      const spy = vi.spyOn(themesManager, 'selectTheme');

      themesManager.initYjsBinding();

      expect(spy).toHaveBeenCalledWith('test-theme', false, false, false);
    });

    it('should not load theme if already selected', () => {
      themesManager.selected = { id: 'test-theme' };
      mockMetadata._data.set('theme', 'test-theme');
      const spy = vi.spyOn(themesManager, 'selectTheme');

      themesManager.initYjsBinding();

      expect(spy).not.toHaveBeenCalled();
    });

    it('should observe metadata changes', () => {
      themesManager.initYjsBinding();

      expect(mockMetadata.observe).toHaveBeenCalled();
      expect(themesManager.metadataObserver).not.toBeNull();
    });

    it('should complete initialization successfully', () => {
      themesManager.initYjsBinding();

      expect(mockMetadata.observe).toHaveBeenCalled();
      expect(themesManager.metadataObserver).not.toBeNull();
    });

    it('should handle missing bridge', () => {
      themesManager.app.project._yjsBridge = null;

      expect(() => themesManager.initYjsBinding()).not.toThrow();
    });

    it('should handle missing document manager', () => {
      mockBridge.getDocumentManager.mockReturnValue(null);

      expect(() => themesManager.initYjsBinding()).not.toThrow();
    });
  });

  describe('onRemoteThemeChange', () => {
    beforeEach(() => {
      themesManager.list.installed['remote-theme'] = {
        id: 'remote-theme',
        select: vi.fn().mockResolvedValue(undefined),
      };
    });

    it('should set isApplyingRemoteTheme flag', async () => {
      const selectSpy = vi.spyOn(themesManager, 'selectTheme').mockResolvedValue(undefined);

      const promise = themesManager.onRemoteThemeChange('remote-theme');
      expect(themesManager.isApplyingRemoteTheme).toBe(true);

      await promise;
    });

    it('should call selectTheme with correct params', async () => {
      const spy = vi.spyOn(themesManager, 'selectTheme').mockResolvedValue(undefined);

      await themesManager.onRemoteThemeChange('remote-theme');

      expect(spy).toHaveBeenCalledWith('remote-theme', false, false, true);
    });

    it('should update UI when navbar styles available', async () => {
      vi.spyOn(themesManager, 'selectTheme').mockResolvedValue(undefined);

      await themesManager.onRemoteThemeChange('remote-theme');

      expect(themesManager.app.menus.navbar.styles.updateSelectedTheme).toHaveBeenCalledWith('remote-theme');
    });

    it('should not throw if navbar styles unavailable', async () => {
      themesManager.app.menus = null;
      vi.spyOn(themesManager, 'selectTheme').mockResolvedValue(undefined);

      await expect(themesManager.onRemoteThemeChange('remote-theme')).resolves.not.toThrow();
    });

    it('should reset isApplyingRemoteTheme after completion', async () => {
      vi.spyOn(themesManager, 'selectTheme').mockResolvedValue(undefined);

      await themesManager.onRemoteThemeChange('remote-theme');

      expect(themesManager.isApplyingRemoteTheme).toBe(false);
    });

    it('should reset flag even if selectTheme fails', async () => {
      vi.spyOn(themesManager, 'selectTheme').mockRejectedValue(new Error('Failed'));

      await expect(themesManager.onRemoteThemeChange('remote-theme')).rejects.toThrow('Failed');
      expect(themesManager.isApplyingRemoteTheme).toBe(false);
    });

    it('should complete remote theme change successfully', async () => {
      vi.spyOn(themesManager, 'selectTheme').mockResolvedValue(undefined);

      await themesManager.onRemoteThemeChange('remote-theme');

      expect(themesManager.isApplyingRemoteTheme).toBe(false);
      expect(themesManager.app.menus.navbar.styles.updateSelectedTheme).toHaveBeenCalledWith('remote-theme');
    });
  });

  describe('saveThemeToYjs', () => {
    it('should get document manager from bridge', () => {
      themesManager.saveThemeToYjs('test-theme');

      expect(mockBridge.getDocumentManager).toHaveBeenCalled();
    });

    it('should set theme in metadata', () => {
      themesManager.saveThemeToYjs('test-theme');

      expect(mockMetadata.set).toHaveBeenCalledWith('theme', 'test-theme');
    });

    it('should set modifiedAt timestamp', () => {
      vi.setSystemTime(new Date('2025-12-17T10:30:45.123'));

      themesManager.saveThemeToYjs('test-theme');

      expect(mockMetadata.set).toHaveBeenCalledWith('modifiedAt', expect.any(Number));
    });

    it('should use transaction with clientID', () => {
      themesManager.saveThemeToYjs('test-theme');

      expect(mockDoc.transact).toHaveBeenCalledWith(expect.any(Function), 12345);
    });

    it('should complete save successfully', () => {
      themesManager.saveThemeToYjs('test-theme');

      expect(mockMetadata.set).toHaveBeenCalledWith('theme', 'test-theme');
      expect(mockDoc.transact).toHaveBeenCalled();
    });

    it('should handle missing bridge', () => {
      themesManager.app.project._yjsBridge = null;

      expect(() => themesManager.saveThemeToYjs('test-theme')).not.toThrow();
    });

    it('should handle missing document manager', () => {
      mockBridge.getDocumentManager.mockReturnValue(null);

      expect(() => themesManager.saveThemeToYjs('test-theme')).not.toThrow();
    });
  });

  describe('selectTheme', () => {
    let mockTheme;
    let mockPrevTheme;

    beforeEach(() => {
      mockTheme = {
        id: 'test-theme',
        select: vi.fn().mockResolvedValue(undefined),
      };

      mockPrevTheme = {
        id: 'prev-theme',
        select: vi.fn().mockResolvedValue(undefined),
      };

      themesManager.list.installed['test-theme'] = mockTheme;
      themesManager.list.installed['default-theme'] = {
        id: 'default-theme',
        select: vi.fn().mockResolvedValue(undefined),
      };
      themesManager.list.getThemeInstalled.mockImplementation((id) => themesManager.list.installed[id] || null);
    });

    it('should get theme from list', async () => {
      await themesManager.selectTheme('test-theme');

      expect(themesManager.list.getThemeInstalled).toHaveBeenCalledWith('test-theme');
    });

    it('should set selected theme', async () => {
      await themesManager.selectTheme('test-theme');

      expect(themesManager.selected).toBe(mockTheme);
    });

    it('should call select on theme', async () => {
      await themesManager.selectTheme('test-theme');

      expect(mockTheme.select).toHaveBeenCalled();
    });

    it('should pass isSync to theme select', async () => {
      await themesManager.selectTheme('test-theme', false, false, true);

      expect(mockTheme.select).toHaveBeenCalledWith(true);
    });

    it('should not pass isSync when false', async () => {
      await themesManager.selectTheme('test-theme', false, false, false);

      expect(mockTheme.select).toHaveBeenCalledWith();
    });

    it('should save to Yjs when save is true', async () => {
      const spy = vi.spyOn(themesManager, 'saveThemeToYjs');

      await themesManager.selectTheme('test-theme', true);

      expect(spy).toHaveBeenCalledWith('test-theme');
    });

    it('should not save to Yjs when save is false', async () => {
      const spy = vi.spyOn(themesManager, 'saveThemeToYjs');

      await themesManager.selectTheme('test-theme', false);

      expect(spy).not.toHaveBeenCalled();
    });

    it('should fallback to default theme if requested theme not found', async () => {
      await themesManager.selectTheme('non-existent-theme');

      expect(themesManager.selected.id).toBe('default-theme');
    });

    it('should select theme when forceReload is true', async () => {
      themesManager.selected = mockTheme;

      await themesManager.selectTheme('test-theme', false, true);

      expect(mockTheme.select).toHaveBeenCalled();
    });

    it('should select theme when previous theme is different', async () => {
      themesManager.selected = mockPrevTheme;

      await themesManager.selectTheme('test-theme');

      expect(mockTheme.select).toHaveBeenCalled();
    });

    it('should not select theme when same theme and no forceReload', async () => {
      themesManager.selected = mockTheme;
      mockTheme.select.mockClear();

      await themesManager.selectTheme('test-theme', false, false);

      expect(mockTheme.select).not.toHaveBeenCalled();
    });

    it('should select theme when no previous theme', async () => {
      themesManager.selected = null;

      await themesManager.selectTheme('test-theme');

      expect(mockTheme.select).toHaveBeenCalled();
    });
  });

  describe('getThemeIcons', () => {
    it('should return theme icons when available', () => {
      themesManager.selected = {
        icons: { icon1: 'path1', icon2: 'path2' },
      };

      const result = themesManager.getThemeIcons();

      expect(result).toEqual({ icon1: 'path1', icon2: 'path2' });
    });

    it('should return empty object when no icons', () => {
      themesManager.selected = {};

      const result = themesManager.getThemeIcons();

      expect(result).toEqual({});
    });

    it('should return empty object when icons is undefined', () => {
      themesManager.selected = { icons: undefined };

      const result = themesManager.getThemeIcons();

      expect(result).toEqual({});
    });
  });

  describe('getTheme', () => {
    beforeEach(() => {
      themesManager.list.installed['theme-a'] = { id: 'theme-a' };
      themesManager.list.getThemeInstalled.mockImplementation((id) => themesManager.list.installed[id] || null);
    });

    it('should return theme from list', () => {
      const result = themesManager.getTheme('theme-a');

      expect(result).toBe(themesManager.list.installed['theme-a']);
    });

    it('should call list.getThemeInstalled', () => {
      themesManager.getTheme('theme-a');

      expect(themesManager.list.getThemeInstalled).toHaveBeenCalledWith('theme-a');
    });

    it('should return null for non-existent theme', () => {
      const result = themesManager.getTheme('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('loadThemesFromAPI', () => {
    it('should call list.load', async () => {
      await themesManager.loadThemesFromAPI();

      expect(themesManager.list.load).toHaveBeenCalled();
    });
  });

  describe('_ensureUserThemeInYjs', () => {
    let mockThemeFilesMap;
    let mockResourceCache;

    beforeEach(() => {
      mockThemeFilesMap = new Map();
      mockThemeFilesMap.has = vi.fn((key) => mockThemeFilesMap._data?.has(key));
      mockThemeFilesMap.set = vi.fn((key, value) => {
        if (!mockThemeFilesMap._data) mockThemeFilesMap._data = new Map();
        mockThemeFilesMap._data.set(key, value);
      });
      mockThemeFilesMap._data = new Map();

      mockDocumentManager.getThemeFiles = vi.fn(() => mockThemeFilesMap);

      mockResourceCache = {
        getUserThemeRaw: vi.fn(),
      };

      mockBridge.resourceCache = mockResourceCache;
      mockBridge._uint8ArrayToBase64 = vi.fn((arr) => 'base64data');
    });

    it('should not throw when bridge is not available', async () => {
      themesManager.app.project._yjsBridge = null;

      await expect(themesManager._ensureUserThemeInYjs('user-theme', {})).resolves.not.toThrow();
    });

    it('should not throw when documentManager is not available', async () => {
      mockBridge.getDocumentManager.mockReturnValue(null);

      await expect(themesManager._ensureUserThemeInYjs('user-theme', {})).resolves.not.toThrow();
    });

    it('should not copy if theme already in Yjs', async () => {
      mockThemeFilesMap._data.set('user-theme', 'existing-data');
      mockThemeFilesMap.has.mockReturnValue(true);

      await themesManager._ensureUserThemeInYjs('user-theme', {});

      expect(mockResourceCache.getUserThemeRaw).not.toHaveBeenCalled();
    });

    it('should not copy if resourceCache is not available', async () => {
      mockBridge.resourceCache = null;

      await themesManager._ensureUserThemeInYjs('user-theme', {});

      expect(mockThemeFilesMap.set).not.toHaveBeenCalled();
    });

    it('should not copy if theme not found in IndexedDB', async () => {
      mockResourceCache.getUserThemeRaw.mockResolvedValue(null);

      await themesManager._ensureUserThemeInYjs('user-theme', {});

      expect(mockThemeFilesMap.set).not.toHaveBeenCalled();
    });

    it('should copy theme to Yjs when not already there', async () => {
      const mockCompressed = new Uint8Array([1, 2, 3]);
      mockResourceCache.getUserThemeRaw.mockResolvedValue({
        compressedFiles: mockCompressed,
      });

      await themesManager._ensureUserThemeInYjs('user-theme', {});

      expect(mockBridge._uint8ArrayToBase64).toHaveBeenCalledWith(mockCompressed);
      expect(mockThemeFilesMap.set).toHaveBeenCalledWith('user-theme', 'base64data');
    });

    it('should handle errors gracefully', async () => {
      mockResourceCache.getUserThemeRaw.mockRejectedValue(new Error('DB error'));

      await expect(themesManager._ensureUserThemeInYjs('user-theme', {})).resolves.not.toThrow();
    });
  });

  describe('_removeUserThemeFromYjs', () => {
    let mockThemeFilesMap;

    beforeEach(() => {
      mockThemeFilesMap = new Map();
      mockThemeFilesMap.has = vi.fn((key) => mockThemeFilesMap._data?.has(key));
      mockThemeFilesMap.delete = vi.fn((key) => mockThemeFilesMap._data?.delete(key));
      mockThemeFilesMap._data = new Map();

      mockDocumentManager.getThemeFiles = vi.fn(() => mockThemeFilesMap);
    });

    it('should not throw when bridge is not available', async () => {
      themesManager.app.project._yjsBridge = null;

      await expect(themesManager._removeUserThemeFromYjs('user-theme')).resolves.not.toThrow();
    });

    it('should not throw when documentManager is not available', async () => {
      mockBridge.getDocumentManager.mockReturnValue(null);

      await expect(themesManager._removeUserThemeFromYjs('user-theme')).resolves.not.toThrow();
    });

    it('should remove theme from Yjs themeFiles', async () => {
      mockThemeFilesMap._data.set('user-theme', 'theme-data');
      mockThemeFilesMap.has.mockReturnValue(true);

      await themesManager._removeUserThemeFromYjs('user-theme');

      expect(mockThemeFilesMap.delete).toHaveBeenCalledWith('user-theme');
    });

    it('should not throw if theme not in Yjs', async () => {
      mockThemeFilesMap.has.mockReturnValue(false);

      await expect(themesManager._removeUserThemeFromYjs('non-existent')).resolves.not.toThrow();
      expect(mockThemeFilesMap.delete).not.toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('should initialize Yjs and handle theme sync', () => {
      mockMetadata._data.set('theme', 'test-theme');
      themesManager.list.installed['test-theme'] = {
        id: 'test-theme',
        select: vi.fn().mockResolvedValue(undefined),
      };

      themesManager.initYjsBinding();

      expect(mockMetadata.observe).toHaveBeenCalled();
      expect(themesManager.metadataObserver).not.toBeNull();
    });

    it('should save and load theme through Yjs', async () => {
      const mockTheme = {
        id: 'new-theme',
        select: vi.fn().mockResolvedValue(undefined),
      };
      themesManager.list.installed['new-theme'] = mockTheme;
      themesManager.list.getThemeInstalled.mockImplementation((id) => themesManager.list.installed[id] || null);

      await themesManager.selectTheme('new-theme', true);

      expect(mockTheme.select).toHaveBeenCalled();
      expect(mockMetadata.set).toHaveBeenCalledWith('theme', 'new-theme');
    });

    it('should handle remote theme change flow', async () => {
      const remoteTheme = {
        id: 'remote-theme',
        select: vi.fn().mockResolvedValue(undefined),
      };
      themesManager.list.installed['remote-theme'] = remoteTheme;
      themesManager.list.getThemeInstalled.mockImplementation((id) => themesManager.list.installed[id] || null);

      await themesManager.onRemoteThemeChange('remote-theme');

      expect(remoteTheme.select).toHaveBeenCalled();
      expect(themesManager.selected).toBe(remoteTheme);
      expect(themesManager.app.menus.navbar.styles.updateSelectedTheme).toHaveBeenCalledWith('remote-theme');
    });
  });
});
