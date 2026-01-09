import ThemeList from './themeList.js';
import Theme from './theme.js';

// Mock Theme class
vi.mock('./theme.js', () => {
  return {
    default: vi.fn().mockImplementation(function(manager, data) {
      this.manager = manager;
      this.id = data.name || data.dirName;
      this.title = data.title || 'Unknown';
      this.valid = data.valid !== false;
    })
  };
});

describe('ThemeList', () => {
  let themeList;
  let mockManager;
  let mockApi;

  beforeEach(() => {
    // Mock API
    mockApi = {
      getThemesInstalled: vi.fn().mockResolvedValue({
        themes: [
          { name: 'theme-a', title: 'Theme A', valid: true, dirName: 'theme-a' },
          { name: 'theme-c', title: 'Theme C', valid: true, dirName: 'theme-c' },
          { name: 'theme-b', title: 'Theme B', valid: true, dirName: 'theme-b' },
        ],
      }),
    };

    // Mock manager
    mockManager = {
      app: {
        api: mockApi,
      },
      selected: { id: 'theme-a' },
      selectTheme: vi.fn(),
    };

    // Mock eXeLearning global
    window.eXeLearning = {
      config: {
        defaultTheme: 'default-theme',
      },
    };

    themeList = new ThemeList(mockManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete window.eXeLearning;
  });

  describe('constructor', () => {
    it('should store manager reference', () => {
      expect(themeList.manager).toBe(mockManager);
    });

    it('should initialize installed as empty object', () => {
      expect(themeList.installed).toEqual({});
    });
  });

  describe('load', () => {
    it('should call loadThemesInstalled', async () => {
      const spy = vi.spyOn(themeList, 'loadThemesInstalled');
      await themeList.load();

      expect(spy).toHaveBeenCalled();
    });

    it('should call loadUserThemesFromIndexedDB after loadThemesInstalled', async () => {
      const installedSpy = vi.spyOn(themeList, 'loadThemesInstalled');
      const userThemesSpy = vi.spyOn(themeList, 'loadUserThemesFromIndexedDB').mockResolvedValue(undefined);

      await themeList.load();

      expect(installedSpy).toHaveBeenCalled();
      expect(userThemesSpy).toHaveBeenCalled();
    });
  });

  describe('loadThemesInstalled', () => {
    it('should fetch themes from API', async () => {
      await themeList.loadThemesInstalled();

      expect(mockApi.getThemesInstalled).toHaveBeenCalled();
    });

    it('should create Theme instances for each theme', async () => {
      await themeList.loadThemesInstalled();

      expect(Theme).toHaveBeenCalledTimes(3);
    });

    it('should store themes in installed object', async () => {
      await themeList.loadThemesInstalled();

      expect(themeList.installed['theme-a']).toBeDefined();
      expect(themeList.installed['theme-b']).toBeDefined();
      expect(themeList.installed['theme-c']).toBeDefined();
    });

    it('should order themes alphabetically', async () => {
      await themeList.loadThemesInstalled();

      const keys = Object.keys(themeList.installed);
      expect(keys).toEqual(['theme-a', 'theme-b', 'theme-c']);
    });

    it('should clear installed object before loading', async () => {
      themeList.installed = { 'old-theme': {} };

      await themeList.loadThemesInstalled();

      expect(themeList.installed['old-theme']).toBeUndefined();
    });

    it('should return installed themes', async () => {
      const result = await themeList.loadThemesInstalled();

      expect(result).toBe(themeList.installed);
    });

    it('should handle null API response', async () => {
      mockApi.getThemesInstalled.mockResolvedValue(null);

      await themeList.loadThemesInstalled();

      expect(themeList.installed).toEqual({});
    });

    it('should handle missing themes property', async () => {
      mockApi.getThemesInstalled.mockResolvedValue({});

      await themeList.loadThemesInstalled();

      expect(themeList.installed).toEqual({});
    });
  });

  describe('loadThemeInstalled', () => {
    it('should fetch themes from API', async () => {
      await themeList.loadThemeInstalled('theme-b');

      expect(mockApi.getThemesInstalled).toHaveBeenCalled();
    });

    it('should load only the specified theme', async () => {
      await themeList.loadThemeInstalled('theme-b');

      expect(themeList.installed['theme-b']).toBeDefined();
      expect(themeList.installed['theme-a']).toBeUndefined();
      expect(themeList.installed['theme-c']).toBeUndefined();
    });

    it('should create Theme instance for matching theme', async () => {
      vi.clearAllMocks();
      await themeList.loadThemeInstalled('theme-b');

      expect(Theme).toHaveBeenCalledTimes(1);
      expect(Theme).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ name: 'theme-b' })
      );
    });

    it('should order themes after loading', async () => {
      const spy = vi.spyOn(themeList, 'orderThemesInstalled');
      await themeList.loadThemeInstalled('theme-b');

      expect(spy).toHaveBeenCalled();
    });

    it('should return installed themes', async () => {
      const result = await themeList.loadThemeInstalled('theme-b');

      expect(result).toBe(themeList.installed);
    });

    it('should handle theme not found', async () => {
      await themeList.loadThemeInstalled('non-existent-theme');

      expect(Object.keys(themeList.installed)).toHaveLength(0);
    });
  });

  describe('loadThemes', () => {
    it('should clear installed object', () => {
      themeList.installed = { 'old-theme': {} };

      themeList.loadThemes([
        { name: 'new-theme', title: 'New Theme' },
      ]);

      expect(themeList.installed['old-theme']).toBeUndefined();
    });

    it('should create Theme instances for all themes', () => {
      vi.clearAllMocks();

      themeList.loadThemes([
        { name: 'theme-1', title: 'Theme 1' },
        { name: 'theme-2', title: 'Theme 2' },
      ]);

      expect(Theme).toHaveBeenCalledTimes(2);
    });

    it('should store themes in installed object', () => {
      themeList.loadThemes([
        { name: 'theme-1', title: 'Theme 1' },
        { name: 'theme-2', title: 'Theme 2' },
      ]);

      expect(themeList.installed['theme-1']).toBeDefined();
      expect(themeList.installed['theme-2']).toBeDefined();
    });

    it('should order themes alphabetically', () => {
      themeList.loadThemes([
        { name: 'zebra', title: 'Zebra' },
        { name: 'apple', title: 'Apple' },
        { name: 'mango', title: 'Mango' },
      ]);

      const keys = Object.keys(themeList.installed);
      expect(keys).toEqual(['apple', 'mango', 'zebra']);
    });
  });

  describe('loadTheme', () => {
    it('should create new Theme instance', () => {
      vi.clearAllMocks();

      themeList.loadTheme({ name: 'test-theme', title: 'Test' });

      expect(Theme).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ name: 'test-theme' })
      );
    });

    it('should store theme in installed object', () => {
      themeList.loadTheme({ name: 'test-theme', title: 'Test' });

      expect(themeList.installed['test-theme']).toBeDefined();
    });
  });

  describe('newTheme', () => {
    it('should create and return Theme instance', () => {
      vi.clearAllMocks();

      const themeData = { name: 'new-theme', title: 'New Theme' };
      const result = themeList.newTheme(themeData);

      expect(Theme).toHaveBeenCalledWith(mockManager, themeData);
      expect(result).toBeDefined();
    });
  });

  describe('getThemeInstalled', () => {
    beforeEach(() => {
      themeList.installed = {
        'theme-a': { id: 'theme-a', title: 'Theme A' },
        'theme-b': { id: 'theme-b', title: 'Theme B' },
      };
    });

    it('should return theme by id', () => {
      const result = themeList.getThemeInstalled('theme-a');

      expect(result).toBe(themeList.installed['theme-a']);
    });

    it('should return null if theme not found', () => {
      const result = themeList.getThemeInstalled('non-existent');

      expect(result).toBeNull();
    });

    it('should handle exact id match', () => {
      const result = themeList.getThemeInstalled('theme-b');

      expect(result.id).toBe('theme-b');
    });
  });

  describe('orderThemesInstalled', () => {
    it('should sort themes alphabetically by key', () => {
      themeList.installed = {
        'zebra': { id: 'zebra' },
        'apple': { id: 'apple' },
        'mango': { id: 'mango' },
      };

      themeList.orderThemesInstalled();

      const keys = Object.keys(themeList.installed);
      expect(keys).toEqual(['apple', 'mango', 'zebra']);
    });

    it('should preserve theme objects', () => {
      const appleTheme = { id: 'apple', title: 'Apple' };
      const zebraTheme = { id: 'zebra', title: 'Zebra' };

      themeList.installed = {
        'zebra': zebraTheme,
        'apple': appleTheme,
      };

      themeList.orderThemesInstalled();

      expect(themeList.installed['apple']).toBe(appleTheme);
      expect(themeList.installed['zebra']).toBe(zebraTheme);
    });

    it('should handle empty installed object', () => {
      themeList.installed = {};

      expect(() => themeList.orderThemesInstalled()).not.toThrow();
      expect(themeList.installed).toEqual({});
    });

    it('should handle single theme', () => {
      themeList.installed = {
        'solo': { id: 'solo' },
      };

      themeList.orderThemesInstalled();

      expect(Object.keys(themeList.installed)).toEqual(['solo']);
    });
  });

  describe('removeTheme', () => {
    beforeEach(() => {
      themeList.installed = {
        'theme-a': { id: 'theme-a' },
        'theme-b': { id: 'theme-b' },
        'theme-c': { id: 'theme-c' },
      };
    });

    it('should remove theme from installed', async () => {
      await themeList.removeTheme('theme-b');

      expect(themeList.installed['theme-b']).toBeUndefined();
      expect(themeList.installed['theme-a']).toBeDefined();
      expect(themeList.installed['theme-c']).toBeDefined();
    });

    it('should select default theme if removing currently selected theme', async () => {
      mockManager.selected = { id: 'theme-a' };

      await themeList.removeTheme('theme-a');

      expect(mockManager.selectTheme).toHaveBeenCalledWith('default-theme', true);
    });

    it('should not change selection if removing non-selected theme', async () => {
      mockManager.selected = { id: 'theme-a' };

      await themeList.removeTheme('theme-b');

      expect(mockManager.selectTheme).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent theme', async () => {
      await themeList.removeTheme('non-existent');

      expect(Object.keys(themeList.installed)).toHaveLength(3);
    });
  });

  describe('loadUserThemesFromIndexedDB', () => {
    let mockResourceCache;

    beforeEach(() => {
      mockResourceCache = {
        listUserThemes: vi.fn(),
      };
    });

    it('should return early if no resourceCache available', async () => {
      mockManager.app.project = null;

      await expect(themeList.loadUserThemesFromIndexedDB()).resolves.not.toThrow();
    });

    it('should return early if no user themes in IndexedDB', async () => {
      mockManager.app.project = {
        _yjsBridge: {
          resourceCache: mockResourceCache,
        },
      };
      mockResourceCache.listUserThemes.mockResolvedValue([]);

      const spy = vi.spyOn(themeList, 'addUserTheme');
      await themeList.loadUserThemesFromIndexedDB();

      expect(spy).not.toHaveBeenCalled();
    });

    it('should load user themes from IndexedDB', async () => {
      mockManager.app.project = {
        _yjsBridge: {
          resourceCache: mockResourceCache,
        },
      };
      mockResourceCache.listUserThemes.mockResolvedValue([
        { name: 'user-theme-1', config: { name: 'user-theme-1', dirName: 'user-theme-1' } },
        { name: 'user-theme-2', config: { name: 'user-theme-2', dirName: 'user-theme-2' } },
      ]);

      const spy = vi.spyOn(themeList, 'addUserTheme').mockReturnValue({});
      await themeList.loadUserThemesFromIndexedDB();

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should use provided cache parameter', async () => {
      await themeList.loadUserThemesFromIndexedDB(mockResourceCache);

      expect(mockResourceCache.listUserThemes).toHaveBeenCalled();
    });

    it('should skip already loaded themes', async () => {
      themeList.installed['user-theme-1'] = { id: 'user-theme-1' };

      mockManager.app.project = {
        _yjsBridge: {
          resourceCache: mockResourceCache,
        },
      };
      mockResourceCache.listUserThemes.mockResolvedValue([
        { name: 'user-theme-1', config: { name: 'user-theme-1' } },
        { name: 'user-theme-2', config: { name: 'user-theme-2', dirName: 'user-theme-2' } },
      ]);

      const spy = vi.spyOn(themeList, 'addUserTheme').mockReturnValue({});
      await themeList.loadUserThemesFromIndexedDB();

      expect(spy).toHaveBeenCalledTimes(1); // Only user-theme-2
    });

    it('should handle errors gracefully', async () => {
      mockManager.app.project = {
        _yjsBridge: {
          resourceCache: mockResourceCache,
        },
      };
      mockResourceCache.listUserThemes.mockRejectedValue(new Error('DB error'));

      await expect(themeList.loadUserThemesFromIndexedDB()).resolves.not.toThrow();
    });

    it('should order themes after loading', async () => {
      mockManager.app.project = {
        _yjsBridge: {
          resourceCache: mockResourceCache,
        },
      };
      mockResourceCache.listUserThemes.mockResolvedValue([
        { name: 'user-theme', config: { name: 'user-theme', dirName: 'user-theme' } },
      ]);

      vi.spyOn(themeList, 'addUserTheme').mockReturnValue({});
      const orderSpy = vi.spyOn(themeList, 'orderThemesInstalled');

      await themeList.loadUserThemesFromIndexedDB();

      expect(orderSpy).toHaveBeenCalled();
    });
  });

  describe('addUserTheme', () => {
    it('should create theme with user-theme:// URL', () => {
      const config = {
        name: 'my-user-theme',
        dirName: 'my-user-theme',
        title: 'My User Theme',
        cssFiles: ['style.css'],
      };

      themeList.addUserTheme(config);

      expect(Theme).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          url: 'user-theme://my-user-theme',
          valid: true,
        })
      );
    });

    it('should mark theme as isUserTheme', () => {
      const config = {
        name: 'my-user-theme',
        dirName: 'my-user-theme',
      };

      const result = themeList.addUserTheme(config);

      expect(result.isUserTheme).toBe(true);
    });

    it('should add theme to installed object', () => {
      const config = {
        name: 'my-user-theme',
        dirName: 'my-user-theme',
      };

      themeList.addUserTheme(config);

      expect(themeList.installed['my-user-theme']).toBeDefined();
    });

    it('should order themes after adding', () => {
      const spy = vi.spyOn(themeList, 'orderThemesInstalled');

      themeList.addUserTheme({
        name: 'my-user-theme',
        dirName: 'my-user-theme',
      });

      expect(spy).toHaveBeenCalled();
    });

    it('should return the created theme', () => {
      const result = themeList.addUserTheme({
        name: 'my-user-theme',
        dirName: 'my-user-theme',
      });

      expect(result).toBeDefined();
      expect(result.isUserTheme).toBe(true);
    });

    it('should preserve config properties', () => {
      const config = {
        name: 'my-user-theme',
        dirName: 'my-user-theme',
        title: 'My Theme Title',
        cssFiles: ['style.css', 'layout.css'],
        author: 'Test Author',
      };

      themeList.addUserTheme(config);

      expect(Theme).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          name: 'my-user-theme',
          title: 'My Theme Title',
          cssFiles: ['style.css', 'layout.css'],
          author: 'Test Author',
        })
      );
    });
  });

  describe('integration', () => {
    it('should load and order themes from API', async () => {
      await themeList.load();

      const keys = Object.keys(themeList.installed);
      expect(keys).toEqual(['theme-a', 'theme-b', 'theme-c']);
      expect(themeList.installed['theme-a']).toBeDefined();
      expect(themeList.installed['theme-b']).toBeDefined();
      expect(themeList.installed['theme-c']).toBeDefined();
    });

    it('should reload and replace themes', async () => {
      await themeList.load();
      expect(Object.keys(themeList.installed)).toHaveLength(3);

      mockApi.getThemesInstalled.mockResolvedValue({
        themes: [
          { name: 'new-theme', title: 'New Theme', valid: true, dirName: 'new-theme' },
        ],
      });

      await themeList.load();

      expect(Object.keys(themeList.installed)).toHaveLength(1);
      expect(themeList.installed['new-theme']).toBeDefined();
    });
  });
});
