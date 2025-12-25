/**
 * ResourceCache Tests
 *
 * Unit tests for ResourceCache - IndexedDB cache for static resources.
 *
 * Run with: make test-frontend
 */

const ResourceCache = require('./ResourceCache');

describe('ResourceCache', () => {
  let cache;
  let mockDB;
  let mockStore;
  let storedResources;

  beforeEach(() => {
    // Reset stored data
    storedResources = new Map();

    // Create mock IndexedDB store
    mockStore = {
      put: mock((entry) => {
        const request = { onsuccess: null, onerror: null };
        setTimeout(() => {
          storedResources.set(entry.key, entry);
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      }),
      get: mock((key) => {
        const request = {
          result: storedResources.get(key) || null,
          onsuccess: null,
          onerror: null,
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      }),
      delete: mock((key) => {
        const request = { onsuccess: null, onerror: null };
        setTimeout(() => {
          storedResources.delete(key);
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      }),
      clear: mock(() => {
        const request = { onsuccess: null, onerror: null };
        setTimeout(() => {
          storedResources.clear();
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      }),
      count: mock((range) => {
        const key = range ? range._value : null;
        const request = {
          result: key ? (storedResources.has(key) ? 1 : 0) : storedResources.size,
          onsuccess: null,
          onerror: null,
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      }),
      index: mock((indexName) => ({
        openCursor: mock((range) => {
          const version = range ? range._value : null;
          const entries = [];
          for (const [key, value] of storedResources.entries()) {
            if (indexName === 'version' && value.version === version) {
              entries.push({ primaryKey: key, value });
            }
          }
          let idx = 0;
          const request = { onsuccess: null, onerror: null };
          setTimeout(() => {
            const emitNext = () => {
              if (idx < entries.length) {
                const entry = entries[idx++];
                if (request.onsuccess) {
                  request.onsuccess({
                    target: {
                      result: {
                        primaryKey: entry.primaryKey,
                        value: entry.value,
                        continue: () => setTimeout(emitNext, 0),
                      },
                    },
                  });
                }
              } else {
                if (request.onsuccess) {
                  request.onsuccess({ target: { result: null } });
                }
              }
            };
            emitNext();
          }, 0);
          return request;
        }),
      })),
      openCursor: mock(() => {
        const entries = Array.from(storedResources.entries());
        let idx = 0;
        const request = { onsuccess: null, onerror: null };
        setTimeout(() => {
          const emitNext = () => {
            if (idx < entries.length) {
              const [key, value] = entries[idx++];
              if (request.onsuccess) {
                request.onsuccess({
                  target: {
                    result: {
                      primaryKey: key,
                      value,
                      continue: () => setTimeout(emitNext, 0),
                    },
                  },
                });
              }
            } else {
              if (request.onsuccess) {
                request.onsuccess({ target: { result: null } });
              }
            }
          };
          emitNext();
        }, 0);
        return request;
      }),
      createIndex: mock(() => undefined),
      indexNames: { contains: mock(() => false) },
    };

    mockDB = {
      transaction: mock(() => ({
        objectStore: mock(() => mockStore),
        oncomplete: null,
        onerror: null,
      })),
      objectStoreNames: { contains: mock(() => false) },
      createObjectStore: mock(() => mockStore),
      close: mock(() => undefined),
    };

    global.indexedDB = {
      open: mock(() => {
        const request = {
          result: mockDB,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };
        setTimeout(() => {
          // Simulate upgrade for fresh DB
          if (request.onupgradeneeded) {
            request.onupgradeneeded({ target: { result: mockDB } });
          }
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      }),
    };

    // Mock IDBKeyRange
    global.IDBKeyRange = {
      only: mock((value) => ({ _value: value })),
    };

    // Mock Logger
    global.Logger = { log: mock(() => {}) };

    cache = new ResourceCache();

    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (cache) {
      cache.close();
    }
    cache = null;
    mockDB = null;
    mockStore = null;
    storedResources = null;

    delete global.indexedDB;
    delete global.IDBKeyRange;
    delete global.Logger;
  });

  describe('static buildKey', () => {
    it('builds key from type, name, and version', () => {
      expect(ResourceCache.buildKey('theme', 'base', 'v3.1.0')).toBe('theme:base:v3.1.0');
    });

    it('handles special characters', () => {
      expect(ResourceCache.buildKey('idevice', 'FreeTextIdevice', 'v3.1.0')).toBe(
        'idevice:FreeTextIdevice:v3.1.0'
      );
    });
  });

  describe('init', () => {
    it('opens IndexedDB database', async () => {
      await cache.init();

      expect(global.indexedDB.open).toHaveBeenCalledWith('exelearning-resources-v1', 1);
      expect(cache.db).toBe(mockDB);
    });

    it('only initializes once', async () => {
      await cache.init();
      await cache.init();

      expect(global.indexedDB.open).toHaveBeenCalledTimes(1);
    });

    it('creates object store on upgrade', async () => {
      await cache.init();

      expect(mockDB.createObjectStore).toHaveBeenCalledWith('resources', { keyPath: 'key' });
    });

    it('rejects on database error', async () => {
      global.indexedDB.open = mock(() => {
        const request = {
          error: new Error('Database error'),
          onsuccess: null,
          onerror: null,
        };
        setTimeout(() => {
          if (request.onerror) request.onerror();
        }, 0);
        return request;
      });

      await expect(cache.init()).rejects.toThrow();
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      await cache.init();
    });

    it('stores files in IndexedDB', async () => {
      const files = new Map([
        ['style.css', new Blob(['css content'])],
        ['script.js', new Blob(['js content'])],
      ]);

      await cache.set('theme', 'base', 'v3.1.0', files);

      const stored = storedResources.get('theme:base:v3.1.0');
      expect(stored).toBeDefined();
      expect(stored.type).toBe('theme');
      expect(stored.name).toBe('base');
      expect(stored.version).toBe('v3.1.0');
      expect(stored.files.length).toBe(2);
    });

    it('converts Map to array for storage', async () => {
      const files = new Map([['style.css', new Blob(['css'])]]);

      await cache.set('theme', 'test', 'v1.0.0', files);

      const stored = storedResources.get('theme:test:v1.0.0');
      expect(Array.isArray(stored.files)).toBe(true);
      expect(stored.files[0].path).toBe('style.css');
    });

    it('includes cachedAt timestamp', async () => {
      const before = Date.now();
      await cache.set('theme', 'base', 'v3.1.0', new Map());
      const after = Date.now();

      const stored = storedResources.get('theme:base:v3.1.0');
      expect(stored.cachedAt).toBeGreaterThanOrEqual(before);
      expect(stored.cachedAt).toBeLessThanOrEqual(after);
    });

    it('throws if database not initialized', async () => {
      const uninitCache = new ResourceCache();
      await expect(uninitCache.set('theme', 'base', 'v1.0.0', new Map())).rejects.toThrow(
        'Database not initialized'
      );
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await cache.init();
    });

    it('returns null for cache miss', async () => {
      const result = await cache.get('theme', 'nonexistent', 'v3.1.0');
      expect(result).toBeNull();
    });

    it('returns Map for cache hit', async () => {
      // Pre-populate cache
      storedResources.set('theme:base:v3.1.0', {
        key: 'theme:base:v3.1.0',
        type: 'theme',
        name: 'base',
        version: 'v3.1.0',
        files: [
          { path: 'style.css', blob: new Blob(['css']) },
          { path: 'script.js', blob: new Blob(['js']) },
        ],
        cachedAt: Date.now(),
      });

      const result = await cache.get('theme', 'base', 'v3.1.0');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.has('style.css')).toBe(true);
      expect(result.has('script.js')).toBe(true);
    });

    it('reconstructs Map from stored array', async () => {
      const originalBlob = new Blob(['test content']);
      storedResources.set('libs:base:v1.0.0', {
        key: 'libs:base:v1.0.0',
        files: [{ path: 'jquery.js', blob: originalBlob }],
      });

      const result = await cache.get('libs', 'base', 'v1.0.0');

      expect(result.get('jquery.js')).toBe(originalBlob);
    });

    it('throws if database not initialized', async () => {
      const uninitCache = new ResourceCache();
      await expect(uninitCache.get('theme', 'base', 'v1.0.0')).rejects.toThrow(
        'Database not initialized'
      );
    });
  });

  describe('has', () => {
    beforeEach(async () => {
      await cache.init();
    });

    it('returns false for cache miss', async () => {
      const result = await cache.has('theme', 'nonexistent', 'v3.1.0');
      expect(result).toBe(false);
    });

    it('returns true for cache hit', async () => {
      storedResources.set('theme:base:v3.1.0', { key: 'theme:base:v3.1.0' });

      const result = await cache.has('theme', 'base', 'v3.1.0');
      expect(result).toBe(true);
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await cache.init();
    });

    it('removes entry from cache', async () => {
      storedResources.set('theme:base:v3.1.0', { key: 'theme:base:v3.1.0' });

      await cache.delete('theme', 'base', 'v3.1.0');

      expect(storedResources.has('theme:base:v3.1.0')).toBe(false);
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await cache.init();
    });

    it('removes all entries', async () => {
      storedResources.set('theme:base:v3.1.0', { key: 'theme:base:v3.1.0' });
      storedResources.set('libs:base:v3.1.0', { key: 'libs:base:v3.1.0' });

      await cache.clear();

      expect(storedResources.size).toBe(0);
    });
  });

  describe('clearByVersion', () => {
    beforeEach(async () => {
      await cache.init();
    });

    it('removes entries matching version', async () => {
      storedResources.set('theme:base:v3.0.0', { key: 'theme:base:v3.0.0', version: 'v3.0.0' });
      storedResources.set('theme:base:v3.1.0', { key: 'theme:base:v3.1.0', version: 'v3.1.0' });
      storedResources.set('libs:base:v3.0.0', { key: 'libs:base:v3.0.0', version: 'v3.0.0' });

      const deleted = await cache.clearByVersion('v3.0.0');

      expect(deleted).toBe(2);
      expect(storedResources.has('theme:base:v3.0.0')).toBe(false);
      expect(storedResources.has('libs:base:v3.0.0')).toBe(false);
      expect(storedResources.has('theme:base:v3.1.0')).toBe(true);
    });
  });

  describe('clearOldVersions', () => {
    beforeEach(async () => {
      await cache.init();
    });

    it('keeps only current version entries', async () => {
      storedResources.set('theme:base:v3.0.0', { key: 'theme:base:v3.0.0', version: 'v3.0.0' });
      storedResources.set('theme:base:v3.1.0', { key: 'theme:base:v3.1.0', version: 'v3.1.0' });
      storedResources.set('theme:flux:v3.1.0', { key: 'theme:flux:v3.1.0', version: 'v3.1.0' });

      const deleted = await cache.clearOldVersions('v3.1.0');

      expect(deleted).toBe(1);
      expect(storedResources.has('theme:base:v3.0.0')).toBe(false);
      expect(storedResources.has('theme:base:v3.1.0')).toBe(true);
      expect(storedResources.has('theme:flux:v3.1.0')).toBe(true);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await cache.init();
    });

    it('returns empty stats for empty cache', async () => {
      const stats = await cache.getStats();

      expect(stats.count).toBe(0);
      expect(Object.keys(stats.types).length).toBe(0);
    });

    it('counts entries by type', async () => {
      storedResources.set('theme:base:v3.1.0', { type: 'theme' });
      storedResources.set('theme:flux:v3.1.0', { type: 'theme' });
      storedResources.set('libs:base:v3.1.0', { type: 'libs' });

      const stats = await cache.getStats();

      expect(stats.count).toBe(3);
      expect(stats.types.theme).toBe(2);
      expect(stats.types.libs).toBe(1);
    });
  });

  describe('close', () => {
    it('closes database connection', async () => {
      await cache.init();

      cache.close();

      expect(mockDB.close).toHaveBeenCalled();
      expect(cache.db).toBeNull();
    });

    it('does nothing if not initialized', () => {
      cache.close();
      // Should not throw
    });
  });

  describe('integration: set then get', () => {
    beforeEach(async () => {
      await cache.init();
    });

    it('retrieves what was stored', async () => {
      const originalFiles = new Map([
        ['style.css', new Blob(['body { color: red; }'])],
        ['img/logo.png', new Blob(['PNG data'])],
      ]);

      await cache.set('theme', 'base', 'v3.1.0', originalFiles);
      const retrieved = await cache.get('theme', 'base', 'v3.1.0');

      expect(retrieved.size).toBe(2);
      expect(retrieved.has('style.css')).toBe(true);
      expect(retrieved.has('img/logo.png')).toBe(true);
    });

    it('version mismatch returns null', async () => {
      await cache.set('theme', 'base', 'v3.0.0', new Map([['a.css', new Blob(['old'])]]));

      const result = await cache.get('theme', 'base', 'v3.1.0');
      expect(result).toBeNull();
    });
  });
});
