/**
 * ResourceFetcher Tests
 *
 * Unit tests for the ResourceFetcher class that fetches server resources.
 *
 * Run with: make test-frontend
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('ResourceFetcher', () => {
  let ResourceFetcher;
  let mockFetch;

  beforeAll(() => {
    // Mock Logger
    global.Logger = { log: vi.fn() };

    // Read and execute the script
    const scriptPath = join(__dirname, 'ResourceFetcher.js');
    const scriptContent = readFileSync(scriptPath, 'utf-8');

    // eslint-disable-next-line no-new-func
    const scriptFn = new Function(scriptContent + '\n; return ResourceFetcher;');
    ResourceFetcher = scriptFn();
  });

  afterAll(() => {
    delete global.Logger;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock eXeLearning global
    global.eXeLearning = {
      symfony: {
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

    it('falls back to /libs/ path if /app/common/ fails', async () => {
      const fetcher = new ResourceFetcher();
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['content'])),
        });

      await fetcher.fetchLibraryFile('jquery/jquery.min.js');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
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
      expect(global.Logger.log).toHaveBeenCalledWith('[ResourceFetcher] Cache cleared');
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
});
