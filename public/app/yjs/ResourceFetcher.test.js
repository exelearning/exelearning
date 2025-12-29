/**
 * ResourceFetcher Tests
 *
 * Unit tests for the ResourceFetcher class that fetches server resources.
 *
 * Run with: make test-frontend
 */

// Mock Logger BEFORE requiring ResourceFetcher
global.Logger = { log: vi.fn() };

const ResourceFetcher = require('./ResourceFetcher.js');

describe('ResourceFetcher', () => {
  let mockFetch;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock eXeLearning global
    global.eXeLearning = {
      config: {
        basePath: '/web/exelearning',
      },
      version: 'v3.1.0',
    };

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock console methods
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.eXeLearning;
    delete global.fetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('initializes empty cache', () => {
      const fetcher = new ResourceFetcher();
      expect(fetcher.cache).toBeInstanceOf(Map);
      expect(fetcher.cache.size).toBe(0);
    });

    it('sets basePath from eXeLearning global', () => {
      const fetcher = new ResourceFetcher();
      expect(fetcher.basePath).toBe('/web/exelearning');
    });

    it('sets default basePath when eXeLearning not available', () => {
      delete global.eXeLearning;
      const fetcher = new ResourceFetcher();
      expect(fetcher.basePath).toBe('');
    });

    it('sets apiBase with basePath', () => {
      const fetcher = new ResourceFetcher();
      expect(fetcher.apiBase).toBe('/web/exelearning/api/resources');
    });

    it('sets version from eXeLearning global', () => {
      const fetcher = new ResourceFetcher();
      expect(fetcher.version).toBe('v3.1.0');
    });

    it('sets default version when not available', () => {
      delete global.eXeLearning;
      const fetcher = new ResourceFetcher();
      expect(fetcher.version).toBe('v0.0.0');
    });
  });

  describe('fetchTheme', () => {
    it('returns cached theme if available', async () => {
      const fetcher = new ResourceFetcher();
      const cachedFiles = new Map([['style.css', new Blob(['css'])]]);
      fetcher.cache.set('theme:base', cachedFiles);

      const result = await fetcher.fetchTheme('base');

      expect(result).toBe(cachedFiles);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches theme file list from API', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ path: 'style.css', url: '/themes/base/style.css' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['css content'])),
        });

      await fetcher.fetchTheme('base');

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/theme/base');
    });

    it('fetches each file in the theme', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { path: 'style.css', url: '/themes/base/style.css' },
              { path: 'script.js', url: '/themes/base/script.js' },
            ]),
        })
        .mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(new Blob(['content'])),
        });

      const result = await fetcher.fetchTheme('base');

      expect(result.size).toBe(2);
      expect(result.has('style.css')).toBe(true);
      expect(result.has('script.js')).toBe(true);
    });

    it('caches theme after fetching', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ path: 'style.css', url: '/url' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['css'])),
        });

      await fetcher.fetchTheme('blue');

      expect(fetcher.cache.has('theme:blue')).toBe(true);
    });

    it('returns empty Map on API error', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await fetcher.fetchTheme('broken');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('skips files that fail to fetch', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { path: 'good.css', url: '/good' },
              { path: 'bad.css', url: '/bad' },
            ]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['good'])),
        })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await fetcher.fetchTheme('mixed');

      expect(result.size).toBe(1);
      expect(result.has('good.css')).toBe(true);
    });
  });

  describe('fetchIdevice', () => {
    it('returns cached iDevice if available', async () => {
      const fetcher = new ResourceFetcher();
      const cachedFiles = new Map([['script.js', new Blob(['js'])]]);
      fetcher.cache.set('idevice:text', cachedFiles);

      const result = await fetcher.fetchIdevice('text');

      expect(result).toBe(cachedFiles);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches iDevice file list from API', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      await fetcher.fetchIdevice('quiz');

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/idevice/quiz');
    });

    it('returns empty Map and caches for 404 response', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await fetcher.fetchIdevice('simple');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(fetcher.cache.has('idevice:simple')).toBe(true);
    });

    it('returns empty Map on non-404 error', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await fetcher.fetchIdevice('broken');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('fetchIdevices', () => {
    it('fetches multiple iDevices in parallel', async () => {
      const fetcher = new ResourceFetcher();
      vi.spyOn(fetcher, 'fetchIdevice')
        .mockResolvedValueOnce(new Map([['a.js', new Blob(['a'])]]))
        .mockResolvedValueOnce(new Map([['b.js', new Blob(['b'])]]));

      const result = await fetcher.fetchIdevices(['text', 'quiz']);

      expect(result.size).toBe(2);
      expect(result.has('text')).toBe(true);
      expect(result.has('quiz')).toBe(true);
    });

    it('returns empty Map for each type', async () => {
      const fetcher = new ResourceFetcher();
      vi.spyOn(fetcher, 'fetchIdevice').mockResolvedValue(new Map());

      const result = await fetcher.fetchIdevices(['a', 'b', 'c']);

      expect(result.size).toBe(3);
    });
  });

  describe('fetchBaseLibraries', () => {
    it('returns cached libraries if available', async () => {
      const fetcher = new ResourceFetcher();
      const cachedFiles = new Map([['jquery.js', new Blob(['jquery'])]]);
      fetcher.cache.set('libs:base', cachedFiles);

      const result = await fetcher.fetchBaseLibraries();

      expect(result).toBe(cachedFiles);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches base libraries from API', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetcher.fetchBaseLibraries();

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/libs/base');
    });

    it('caches result with correct key', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetcher.fetchBaseLibraries();

      expect(fetcher.cache.has('libs:base')).toBe(true);
    });
  });

  describe('fetchScormFiles', () => {
    it('returns cached SCORM files if available', async () => {
      const fetcher = new ResourceFetcher();
      const cachedFiles = new Map([['scorm.js', new Blob(['scorm'])]]);
      fetcher.cache.set('libs:scorm', cachedFiles);

      const result = await fetcher.fetchScormFiles();

      expect(result).toBe(cachedFiles);
    });

    it('fetches SCORM files from API', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetcher.fetchScormFiles();

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/libs/scorm');
    });
  });

  describe('fetchEpubFiles', () => {
    it('returns cached EPUB files if available', async () => {
      const fetcher = new ResourceFetcher();
      const cachedFiles = new Map([['container.xml', new Blob(['xml'])]]);
      fetcher.cache.set('libs:epub', cachedFiles);

      const result = await fetcher.fetchEpubFiles();

      expect(result).toBe(cachedFiles);
    });

    it('fetches EPUB files from API', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetcher.fetchEpubFiles();

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/libs/epub');
    });
  });

  describe('fetchSchemas', () => {
    it('returns cached schemas if available', async () => {
      const fetcher = new ResourceFetcher();
      const cachedFiles = new Map([['schema.xsd', new Blob(['xsd'])]]);
      fetcher.cache.set('schemas:scorm12', cachedFiles);

      const result = await fetcher.fetchSchemas('scorm12');

      expect(result).toBe(cachedFiles);
    });

    it('fetches schemas from API with format', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetcher.fetchSchemas('scorm2004');

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/schemas/scorm2004');
    });

    it('caches schemas with format-specific key', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetcher.fetchSchemas('ims');

      expect(fetcher.cache.has('schemas:ims')).toBe(true);
    });
  });

  describe('fetchLibraryFile', () => {
    it('returns cached file if available', async () => {
      const fetcher = new ResourceFetcher();
      const cachedBlob = new Blob(['cached']);
      fetcher.cache.set('lib:exe_effects/exe_effects.js', cachedBlob);

      const result = await fetcher.fetchLibraryFile('exe_effects/exe_effects.js');

      expect(result).toBe(cachedBlob);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('tries /app/common/ path first', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['content'])),
      });

      await fetcher.fetchLibraryFile('exe_effects/exe_effects.js');

      expect(mockFetch).toHaveBeenCalledWith(
        '/web/exelearning/v3.1.0/app/common/exe_effects/exe_effects.js'
      );
    });

    it('falls back to /libs/ path if /app/common/ fails for non-third-party libs', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['content'])),
        });

      // Use a non-third-party library that tries /app/common/ first
      await fetcher.fetchLibraryFile('exe_custom/custom.js');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        '/web/exelearning/v3.1.0/app/common/exe_custom/custom.js'
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/web/exelearning/v3.1.0/libs/exe_custom/custom.js'
      );
    });

    it('tries /libs/ first for third-party libraries like jquery', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['content'])),
      });

      await fetcher.fetchLibraryFile('jquery/jquery.min.js');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/web/exelearning/v3.1.0/libs/jquery/jquery.min.js'
      );
    });

    it('returns null if file not found in any path', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValue({ ok: false });

      const result = await fetcher.fetchLibraryFile('nonexistent.js');

      expect(result).toBeNull();
    });

    it('caches file after successful fetch', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['content'])),
      });

      await fetcher.fetchLibraryFile('test.js');

      expect(fetcher.cache.has('lib:test.js')).toBe(true);
    });
  });

  describe('fetchLibraryFiles', () => {
    it('fetches multiple files in parallel', async () => {
      const fetcher = new ResourceFetcher();
      vi.spyOn(fetcher, 'fetchLibraryFile')
        .mockResolvedValueOnce(new Blob(['a']))
        .mockResolvedValueOnce(new Blob(['b']));

      const result = await fetcher.fetchLibraryFiles(['a.js', 'b.js']);

      expect(result.size).toBe(2);
      expect(result.has('a.js')).toBe(true);
      expect(result.has('b.js')).toBe(true);
    });

    it('excludes null results', async () => {
      const fetcher = new ResourceFetcher();
      vi.spyOn(fetcher, 'fetchLibraryFile')
        .mockResolvedValueOnce(new Blob(['a']))
        .mockResolvedValueOnce(null);

      const result = await fetcher.fetchLibraryFiles(['exists.js', 'missing.js']);

      expect(result.size).toBe(1);
      expect(result.has('exists.js')).toBe(true);
      expect(result.has('missing.js')).toBe(false);
    });
  });

  describe('fetchLibraryDirectory', () => {
    it('returns cached directory if available', async () => {
      const fetcher = new ResourceFetcher();
      const cachedFiles = new Map([['file.js', new Blob(['js'])]]);
      fetcher.cache.set('libdir:exe_effects', cachedFiles);

      const result = await fetcher.fetchLibraryDirectory('exe_effects');

      expect(result).toBe(cachedFiles);
    });

    it('fetches directory listing from API', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetcher.fetchLibraryDirectory('exe_games');

      expect(mockFetch).toHaveBeenCalledWith(
        '/web/exelearning/api/resources/libs/directory/exe_games'
      );
    });

    it('returns empty Map when API not available', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await fetcher.fetchLibraryDirectory('unknown');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('clears all cached items', () => {
      const fetcher = new ResourceFetcher();
      fetcher.cache.set('theme:base', new Map());
      fetcher.cache.set('idevice:text', new Map());
      fetcher.cache.set('libs:base', new Map());

      fetcher.clearCache();

      expect(fetcher.cache.size).toBe(0);
    });

    it('logs cache cleared message', () => {
      const fetcher = new ResourceFetcher();
      fetcher.clearCache();
      expect(global.Logger.log).toHaveBeenCalledWith('[ResourceFetcher] In-memory cache cleared');
    });
  });

  describe('clearAllCaches', () => {
    it('clears in-memory cache', async () => {
      const fetcher = new ResourceFetcher();
      fetcher.cache.set('theme:base', new Map());
      fetcher.cache.set('idevice:text', new Map());

      await fetcher.clearAllCaches();

      expect(fetcher.cache.size).toBe(0);
    });

    it('clears IndexedDB cache when available', async () => {
      const fetcher = new ResourceFetcher();
      const mockResourceCache = {
        clear: vi.fn().mockResolvedValue(undefined),
      };
      fetcher.resourceCache = mockResourceCache;

      await fetcher.clearAllCaches();

      expect(mockResourceCache.clear).toHaveBeenCalled();
    });

    it('logs appropriate message when IndexedDB cache available', async () => {
      const fetcher = new ResourceFetcher();
      fetcher.resourceCache = {
        clear: vi.fn().mockResolvedValue(undefined),
      };

      await fetcher.clearAllCaches();

      expect(global.Logger.log).toHaveBeenCalledWith(
        '[ResourceFetcher] All caches cleared (in-memory + IndexedDB)'
      );
    });

    it('logs appropriate message when no IndexedDB cache', async () => {
      const fetcher = new ResourceFetcher();

      await fetcher.clearAllCaches();

      expect(global.Logger.log).toHaveBeenCalledWith(
        '[ResourceFetcher] In-memory cache cleared (no IndexedDB cache)'
      );
    });

    it('handles IndexedDB clear error gracefully', async () => {
      const fetcher = new ResourceFetcher();
      fetcher.resourceCache = {
        clear: vi.fn().mockRejectedValue(new Error('Clear failed')),
      };

      // Should not throw
      await fetcher.clearAllCaches();

      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('clearCacheByPattern', () => {
    it('clears only items matching pattern', () => {
      const fetcher = new ResourceFetcher();
      fetcher.cache.set('theme:base', new Map());
      fetcher.cache.set('theme:blue', new Map());
      fetcher.cache.set('idevice:text', new Map());

      fetcher.clearCacheByPattern('theme:');

      expect(fetcher.cache.size).toBe(1);
      expect(fetcher.cache.has('idevice:text')).toBe(true);
    });

    it('keeps items not matching pattern', () => {
      const fetcher = new ResourceFetcher();
      fetcher.cache.set('libs:base', new Map());
      fetcher.cache.set('libs:scorm', new Map());
      fetcher.cache.set('schemas:scorm12', new Map());

      fetcher.clearCacheByPattern('schemas:');

      expect(fetcher.cache.size).toBe(2);
    });

    it('logs cleared pattern message', () => {
      const fetcher = new ResourceFetcher();
      fetcher.clearCacheByPattern('theme:');
      expect(global.Logger.log).toHaveBeenCalledWith(
        "[ResourceFetcher] Cache cleared for pattern 'theme:'"
      );
    });
  });

  describe('getCacheStats', () => {
    it('returns cache size', () => {
      const fetcher = new ResourceFetcher();
      fetcher.cache.set('a', new Map());
      fetcher.cache.set('b', new Map());

      const stats = fetcher.getCacheStats();

      expect(stats.size).toBe(2);
    });

    it('returns cache keys', () => {
      const fetcher = new ResourceFetcher();
      fetcher.cache.set('theme:base', new Map());
      fetcher.cache.set('libs:scorm', new Map());

      const stats = fetcher.getCacheStats();

      expect(stats.keys).toContain('theme:base');
      expect(stats.keys).toContain('libs:scorm');
    });

    it('returns empty stats for empty cache', () => {
      const fetcher = new ResourceFetcher();
      const stats = fetcher.getCacheStats();

      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
    });
  });

  describe('fetchFile', () => {
    it('returns blob on success', async () => {
      const fetcher = new ResourceFetcher();
      const expectedBlob = new Blob(['content']);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(expectedBlob),
      });

      const result = await fetcher.fetchFile('http://example.com/file.txt');

      expect(result).toBe(expectedBlob);
    });

    it('returns null on failed response', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await fetcher.fetchFile('http://example.com/missing.txt');

      expect(result).toBeNull();
    });

    it('returns null on fetch error', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetcher.fetchFile('http://example.com/error.txt');

      expect(result).toBeNull();
    });
  });

  describe('fetchText', () => {
    it('returns text on success', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('Hello World'),
      });

      const result = await fetcher.fetchText('http://example.com/file.txt');

      expect(result).toBe('Hello World');
    });

    it('returns null on failed response', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await fetcher.fetchText('http://example.com/error.txt');

      expect(result).toBeNull();
    });

    it('returns null on fetch error', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetcher.fetchText('http://example.com/error.txt');

      expect(result).toBeNull();
    });
  });

  describe('fetchExeLogo', () => {
    it('returns cached logo if available', async () => {
      const fetcher = new ResourceFetcher();
      const cachedLogo = new Blob(['png']);
      fetcher.cache.set('logo:exe', cachedLogo);

      const result = await fetcher.fetchExeLogo();

      expect(result).toBe(cachedLogo);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches logo from correct path', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['png'])),
      });

      await fetcher.fetchExeLogo();

      expect(mockFetch).toHaveBeenCalledWith(
        '/web/exelearning/v3.1.0/app/common/exe_powered_logo/exe_powered_logo.png'
      );
    });

    it('caches logo after fetching', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['png'])),
      });

      await fetcher.fetchExeLogo();

      expect(fetcher.cache.has('logo:exe')).toBe(true);
    });

    it('returns null on fetch error', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetcher.fetchExeLogo();

      expect(result).toBeNull();
    });
  });

  describe('init', () => {
    it('sets resourceCache when provided', async () => {
      const fetcher = new ResourceFetcher();
      const mockResourceCache = { get: vi.fn(), set: vi.fn() };

      // Mock loadBundleManifest
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await fetcher.init(mockResourceCache);

      expect(fetcher.resourceCache).toBe(mockResourceCache);
    });

    it('does not set resourceCache when not provided', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await fetcher.init();

      expect(fetcher.resourceCache).toBeNull();
    });

    it('calls loadBundleManifest', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themes: { base: {} } }),
      });

      await fetcher.init();

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/bundle/manifest');
    });
  });

  describe('setResourceCache', () => {
    it('sets the resourceCache instance', () => {
      const fetcher = new ResourceFetcher();
      const mockCache = { get: vi.fn(), set: vi.fn() };

      fetcher.setResourceCache(mockCache);

      expect(fetcher.resourceCache).toBe(mockCache);
    });
  });

  describe('loadBundleManifest', () => {
    it('loads manifest and sets bundlesAvailable to true', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themes: { base: {}, blue: {} } }),
      });

      await fetcher.loadBundleManifest();

      expect(fetcher.bundlesAvailable).toBe(true);
      expect(fetcher.bundleManifest).toEqual({ themes: { base: {}, blue: {} } });
    });

    it('sets bundlesAvailable to false on non-ok response', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await fetcher.loadBundleManifest();

      expect(fetcher.bundlesAvailable).toBe(false);
    });

    it('sets bundlesAvailable to false on fetch error', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await fetcher.loadBundleManifest();

      expect(fetcher.bundlesAvailable).toBe(false);
    });
  });

  describe('extractZipBundle', () => {
    it('returns empty Map when fflate is not available', async () => {
      const fetcher = new ResourceFetcher();
      // Ensure fflate is not defined
      const originalFflate = window.fflate;
      delete window.fflate;

      const result = await fetcher.extractZipBundle(new ArrayBuffer(0));

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);

      // Restore if it existed
      if (originalFflate) window.fflate = originalFflate;
    });

    it('extracts files from ZIP when fflate is available', async () => {
      const fetcher = new ResourceFetcher();
      // Mock fflate on window (where ResourceFetcher looks for it)
      window.fflate = {
        unzipSync: vi.fn().mockReturnValue({
          'style.css': new Uint8Array([99, 115, 115]), // 'css'
          'script.js': new Uint8Array([106, 115]), // 'js'
          'folder/': new Uint8Array([]), // directory (should be skipped)
        }),
      };

      const result = await fetcher.extractZipBundle(new ArrayBuffer(10));

      expect(result.size).toBe(2);
      expect(result.has('style.css')).toBe(true);
      expect(result.has('script.js')).toBe(true);
      expect(result.has('folder/')).toBe(false);

      delete window.fflate;
    });

    it('detects MIME types correctly', async () => {
      const fetcher = new ResourceFetcher();
      window.fflate = {
        unzipSync: vi.fn().mockReturnValue({
          'image.png': new Uint8Array([1]),
          'image.jpg': new Uint8Array([1]),
          'font.woff2': new Uint8Array([1]),
          'data.json': new Uint8Array([1]),
          'unknown.xyz': new Uint8Array([1]),
        }),
      };

      const result = await fetcher.extractZipBundle(new ArrayBuffer(10));

      expect(result.get('image.png').type).toBe('image/png');
      expect(result.get('image.jpg').type).toBe('image/jpeg');
      expect(result.get('font.woff2').type).toBe('font/woff2');
      expect(result.get('data.json').type).toBe('application/json');
      expect(result.get('unknown.xyz').type).toBe('application/octet-stream');

      delete window.fflate;
    });

    it('returns empty Map on extraction error', async () => {
      const fetcher = new ResourceFetcher();
      window.fflate = {
        unzipSync: vi.fn().mockImplementation(() => {
          throw new Error('Corrupt ZIP');
        }),
      };

      const result = await fetcher.extractZipBundle(new ArrayBuffer(10));

      expect(result.size).toBe(0);

      delete window.fflate;
    });
  });

  describe('fetchBundle', () => {
    it('returns extracted files on success', async () => {
      const fetcher = new ResourceFetcher();
      window.fflate = {
        unzipSync: vi.fn().mockReturnValue({
          'file.txt': new Uint8Array([116, 101, 115, 116]), // 'test'
        }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '100' },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      const result = await fetcher.fetchBundle('http://example.com/bundle.zip');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(1);

      delete window.fflate;
    });

    it('returns null on non-ok response', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await fetcher.fetchBundle('http://example.com/missing.zip');

      expect(result).toBeNull();
    });

    it('returns null on fetch error', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetcher.fetchBundle('http://example.com/error.zip');

      expect(result).toBeNull();
    });
  });

  describe('loadIdevicesBundle', () => {
    it('loads and distributes iDevice files from bundle', async () => {
      const fetcher = new ResourceFetcher();
      window.fflate = {
        unzipSync: vi.fn().mockReturnValue({
          'text/script.js': new Uint8Array([1]),
          'text/style.css': new Uint8Array([2]),
          'quiz/quiz.js': new Uint8Array([3]),
        }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '100' },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      await fetcher.loadIdevicesBundle();

      expect(fetcher.cache.has('idevice:text')).toBe(true);
      expect(fetcher.cache.has('idevice:quiz')).toBe(true);
      expect(fetcher.cache.get('idevice:text').size).toBe(2);
      expect(fetcher.cache.get('idevice:quiz').size).toBe(1);

      delete window.fflate;
    });

    it('marks bundle as tried even on empty result', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await fetcher.loadIdevicesBundle();

      expect(fetcher.cache.has('idevices:all')).toBe(true);
    });

    it('skips files with less than 2 path parts', async () => {
      const fetcher = new ResourceFetcher();
      window.fflate = {
        unzipSync: vi.fn().mockReturnValue({
          'rootfile.js': new Uint8Array([1]), // should be skipped
          'idevice/file.js': new Uint8Array([2]),
        }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '100' },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      await fetcher.loadIdevicesBundle();

      expect(fetcher.cache.has('idevice:idevice')).toBe(true);
      expect(fetcher.cache.get('idevice:idevice').size).toBe(1);

      delete window.fflate;
    });
  });

  describe('fetchTheme with bundles', () => {
    it('uses bundle when bundlesAvailable is true', async () => {
      const fetcher = new ResourceFetcher();
      fetcher.bundlesAvailable = true;

      window.fflate = {
        unzipSync: vi.fn().mockReturnValue({
          'style.css': new Uint8Array([1]),
        }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '100' },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      const result = await fetcher.fetchTheme('base');

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/bundle/theme/base');
      expect(result.size).toBe(1);

      delete window.fflate;
    });

    it('falls back to individual files when bundle fails', async () => {
      const fetcher = new ResourceFetcher();
      fetcher.bundlesAvailable = true;

      // Bundle fails
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      // Fallback succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ path: 'style.css', url: '/style.css' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['css'])),
        });

      const result = await fetcher.fetchTheme('base');

      expect(result.size).toBe(1);
    });
  });

  describe('fetchIdevice with bundles', () => {
    it('loads from bundle when available', async () => {
      const fetcher = new ResourceFetcher();
      fetcher.bundlesAvailable = true;

      window.fflate = {
        unzipSync: vi.fn().mockReturnValue({
          'text/script.js': new Uint8Array([1]),
        }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '100' },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      const result = await fetcher.fetchIdevice('text');

      expect(result.size).toBe(1);

      delete window.fflate;
    });
  });

  describe('fetchBaseLibraries with bundles', () => {
    it('uses bundle when bundlesAvailable is true', async () => {
      const fetcher = new ResourceFetcher();
      fetcher.bundlesAvailable = true;

      window.fflate = {
        unzipSync: vi.fn().mockReturnValue({
          'jquery.min.js': new Uint8Array([1]),
        }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '100' },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      const result = await fetcher.fetchBaseLibraries();

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/bundle/libs');
      expect(result.size).toBe(1);

      delete window.fflate;
    });

    it('falls back when bundle is empty', async () => {
      const fetcher = new ResourceFetcher();
      fetcher.bundlesAvailable = true;

      window.fflate = {
        unzipSync: vi.fn().mockReturnValue({}),
      };
      // Bundle returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '100' },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });
      // Fallback
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetcher.fetchBaseLibraries();

      expect(mockFetch).toHaveBeenCalledTimes(2);

      delete window.fflate;
    });
  });

  describe('fetchContentCss', () => {
    it('returns cached content CSS if available', async () => {
      const fetcher = new ResourceFetcher();
      const cachedFiles = new Map([['base.css', new Blob(['css'])]]);
      fetcher.cache.set('content-css', cachedFiles);

      const result = await fetcher.fetchContentCss();

      expect(result).toBe(cachedFiles);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches content CSS from bundle when available', async () => {
      const fetcher = new ResourceFetcher();
      fetcher.bundlesAvailable = true;

      window.fflate = {
        unzipSync: vi.fn().mockReturnValue({
          'base.css': new Uint8Array([1]),
        }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '100' },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      const result = await fetcher.fetchContentCss();

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/bundle/content-css');
      expect(result.size).toBe(1);

      delete window.fflate;
    });

    it('falls back to individual files when bundle fails', async () => {
      const fetcher = new ResourceFetcher();
      fetcher.bundlesAvailable = true;

      // Bundle fails
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      // Fallback succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ path: 'base.css', url: '/base.css' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['css'])),
        });

      const result = await fetcher.fetchContentCss();

      expect(result.size).toBe(1);
    });

    it('uses fallback when bundles not available', async () => {
      const fetcher = new ResourceFetcher();
      fetcher.bundlesAvailable = false;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ path: 'base.css', url: '/base.css' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['css'])),
        });

      const result = await fetcher.fetchContentCss();

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/content-css');
      expect(result.size).toBe(1);
    });

    it('caches result after fetching', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetcher.fetchContentCss();

      expect(fetcher.cache.has('content-css')).toBe(true);
    });
  });

  describe('fetchContentCssFallback', () => {
    it('fetches CSS file list from API', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { path: 'base.css', url: '/css/base.css' },
              { path: 'content.css', url: '/css/content.css' },
            ]),
        })
        .mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(new Blob(['css'])),
        });

      const result = await fetcher.fetchContentCssFallback();

      expect(mockFetch).toHaveBeenCalledWith('/web/exelearning/api/resources/content-css');
      expect(result.size).toBe(2);
    });

    it('returns empty Map on API error', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await fetcher.fetchContentCssFallback();

      expect(result.size).toBe(0);
    });

    it('skips files that fail to fetch', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { path: 'good.css', url: '/good' },
              { path: 'bad.css', url: '/bad' },
            ]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['good'])),
        })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await fetcher.fetchContentCssFallback();

      expect(result.size).toBe(1);
      expect(result.has('good.css')).toBe(true);
    });

    it('handles fetch exceptions for individual files', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { path: 'good.css', url: '/good' },
              { path: 'error.css', url: '/error' },
            ]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['good'])),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await fetcher.fetchContentCssFallback();

      expect(result.size).toBe(1);
    });
  });

  describe('IndexedDB cache integration', () => {
    it('checks IndexedDB cache for theme', async () => {
      const fetcher = new ResourceFetcher();
      const mockResourceCache = {
        get: vi.fn().mockResolvedValue(new Map([['style.css', new Blob(['css'])]])),
        set: vi.fn(),
      };
      fetcher.resourceCache = mockResourceCache;

      const result = await fetcher.fetchTheme('cached-theme');

      expect(mockResourceCache.get).toHaveBeenCalledWith('theme', 'cached-theme', 'v3.1.0');
      expect(result.size).toBe(1);
    });

    it('saves theme to IndexedDB cache after fetch', async () => {
      const fetcher = new ResourceFetcher();
      const mockResourceCache = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn(),
      };
      fetcher.resourceCache = mockResourceCache;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ path: 'style.css', url: '/style.css' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['css'])),
        });

      await fetcher.fetchTheme('new-theme');

      expect(mockResourceCache.set).toHaveBeenCalledWith(
        'theme',
        'new-theme',
        'v3.1.0',
        expect.any(Map)
      );
    });

    it('handles IndexedDB cache read error gracefully', async () => {
      const fetcher = new ResourceFetcher();
      const mockResourceCache = {
        get: vi.fn().mockRejectedValue(new Error('IndexedDB error')),
        set: vi.fn(),
      };
      fetcher.resourceCache = mockResourceCache;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      // Should not throw
      const result = await fetcher.fetchTheme('error-theme');
      expect(result).toBeInstanceOf(Map);
    });

    it('handles IndexedDB cache write error gracefully', async () => {
      const fetcher = new ResourceFetcher();
      const mockResourceCache = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockRejectedValue(new Error('IndexedDB write error')),
      };
      fetcher.resourceCache = mockResourceCache;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ path: 'file.css', url: '/file.css' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['css'])),
        });

      // Should not throw
      const result = await fetcher.fetchTheme('write-error-theme');
      expect(result.size).toBe(1);
    });

    it('checks IndexedDB cache for iDevice', async () => {
      const fetcher = new ResourceFetcher();
      const mockResourceCache = {
        get: vi.fn().mockResolvedValue(new Map([['script.js', new Blob(['js'])]])),
        set: vi.fn(),
      };
      fetcher.resourceCache = mockResourceCache;

      const result = await fetcher.fetchIdevice('cached-idevice');

      expect(mockResourceCache.get).toHaveBeenCalledWith('idevice', 'cached-idevice', 'v3.1.0');
      expect(result.size).toBe(1);
    });

    it('checks IndexedDB cache for base libraries', async () => {
      const fetcher = new ResourceFetcher();
      const mockResourceCache = {
        get: vi.fn().mockResolvedValue(new Map([['jquery.js', new Blob(['jquery'])]])),
        set: vi.fn(),
      };
      fetcher.resourceCache = mockResourceCache;

      const result = await fetcher.fetchBaseLibraries();

      expect(mockResourceCache.get).toHaveBeenCalledWith('libs', 'base', 'v3.1.0');
      expect(result.size).toBe(1);
    });

    it('checks IndexedDB cache for content CSS', async () => {
      const fetcher = new ResourceFetcher();
      const mockResourceCache = {
        get: vi.fn().mockResolvedValue(new Map([['base.css', new Blob(['css'])]])),
        set: vi.fn(),
      };
      fetcher.resourceCache = mockResourceCache;

      const result = await fetcher.fetchContentCss();

      expect(mockResourceCache.get).toHaveBeenCalledWith('css', 'content', 'v3.1.0');
      expect(result.size).toBe(1);
    });
  });

  describe('fetchLibraryDirectory error handling', () => {
    it('returns empty Map on fetch exception', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetcher.fetchLibraryDirectory('error-lib');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('caches directory after successful fetch', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ path: 'file.js', url: '/file.js' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['js'])),
        });

      await fetcher.fetchLibraryDirectory('my-lib');

      expect(fetcher.cache.has('libdir:my-lib')).toBe(true);
      expect(fetcher.cache.get('libdir:my-lib').size).toBe(1);
    });

    it('handles file fetch exceptions in directory', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { path: 'good.js', url: '/good.js' },
              { path: 'error.js', url: '/error.js' },
            ]),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['good'])),
        })
        .mockRejectedValueOnce(new Error('File fetch error'));

      const result = await fetcher.fetchLibraryDirectory('mixed-lib');

      expect(result.size).toBe(1);
      expect(result.has('good.js')).toBe(true);
    });
  });

  describe('additional MIME types in extractZipBundle', () => {
    beforeEach(() => {
      window.fflate = {
        unzipSync: vi.fn(),
      };
    });

    afterEach(() => {
      delete window.fflate;
    });

    it('detects html MIME type', async () => {
      const fetcher = new ResourceFetcher();
      window.fflate.unzipSync.mockReturnValue({
        'page.html': new Uint8Array([1]),
        'page.htm': new Uint8Array([1]),
      });

      const result = await fetcher.extractZipBundle(new ArrayBuffer(10));

      expect(result.get('page.html').type).toBe('text/html');
      expect(result.get('page.htm').type).toBe('text/html');
    });

    it('detects media MIME types', async () => {
      const fetcher = new ResourceFetcher();
      window.fflate.unzipSync.mockReturnValue({
        'audio.mp3': new Uint8Array([1]),
        'video.mp4': new Uint8Array([1]),
        'video.webm': new Uint8Array([1]),
        'audio.ogg': new Uint8Array([1]),
      });

      const result = await fetcher.extractZipBundle(new ArrayBuffer(10));

      expect(result.get('audio.mp3').type).toBe('audio/mpeg');
      expect(result.get('video.mp4').type).toBe('video/mp4');
      expect(result.get('video.webm').type).toBe('video/webm');
      expect(result.get('audio.ogg').type).toBe('audio/ogg');
    });

    it('detects font MIME types', async () => {
      const fetcher = new ResourceFetcher();
      window.fflate.unzipSync.mockReturnValue({
        'font.woff': new Uint8Array([1]),
        'font.ttf': new Uint8Array([1]),
        'font.eot': new Uint8Array([1]),
      });

      const result = await fetcher.extractZipBundle(new ArrayBuffer(10));

      expect(result.get('font.woff').type).toBe('font/woff');
      expect(result.get('font.ttf').type).toBe('font/ttf');
      expect(result.get('font.eot').type).toBe('application/vnd.ms-fontobject');
    });

    it('detects image MIME types', async () => {
      const fetcher = new ResourceFetcher();
      window.fflate.unzipSync.mockReturnValue({
        'image.gif': new Uint8Array([1]),
        'image.webp': new Uint8Array([1]),
        'image.svg': new Uint8Array([1]),
        'image.jpeg': new Uint8Array([1]),
      });

      const result = await fetcher.extractZipBundle(new ArrayBuffer(10));

      expect(result.get('image.gif').type).toBe('image/gif');
      expect(result.get('image.webp').type).toBe('image/webp');
      expect(result.get('image.svg').type).toBe('image/svg+xml');
      expect(result.get('image.jpeg').type).toBe('image/jpeg');
    });

    it('detects xml MIME type', async () => {
      const fetcher = new ResourceFetcher();
      window.fflate.unzipSync.mockReturnValue({
        'data.xml': new Uint8Array([1]),
      });

      const result = await fetcher.extractZipBundle(new ArrayBuffer(10));

      expect(result.get('data.xml').type).toBe('text/xml');
    });
  });
});
