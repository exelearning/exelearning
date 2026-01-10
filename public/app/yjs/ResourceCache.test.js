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

      expect(global.indexedDB.open).toHaveBeenCalledWith('exelearning-resources-v1', 3);
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

  describe('per-user theme storage', () => {
    describe('_getCurrentUserId', () => {
      it('returns user name from eXeLearning app', () => {
        global.window = {
          eXeLearning: {
            app: {
              user: { name: 'testuser' },
            },
          },
        };

        expect(cache._getCurrentUserId()).toBe('testuser');
      });

      it('returns anonymous if user not available', () => {
        global.window = {};

        expect(cache._getCurrentUserId()).toBe('anonymous');
      });

      it('returns anonymous if eXeLearning not available', () => {
        global.window = { eXeLearning: null };

        expect(cache._getCurrentUserId()).toBe('anonymous');
      });
    });

    describe('_buildUserThemeKey', () => {
      beforeEach(() => {
        global.window = {
          eXeLearning: {
            app: {
              user: { name: 'user1' },
            },
          },
        };
      });

      it('builds key with userId prefix', () => {
        expect(cache._buildUserThemeKey('my-theme')).toBe('user1:my-theme');
      });

      it('uses anonymous for missing user', () => {
        global.window = {};
        expect(cache._buildUserThemeKey('my-theme')).toBe('anonymous:my-theme');
      });
    });

    describe('user theme isolation', () => {
      let userThemesStore;

      beforeEach(async () => {
        // Create separate store for user themes
        userThemesStore = new Map();

        // Mock user themes store operations
        mockStore.put = mock((entry) => {
          const request = { onsuccess: null, onerror: null };
          setTimeout(() => {
            // Use 'id' as key (composite key with userId)
            const key = entry.id || entry.key;
            if (entry.userId !== undefined) {
              userThemesStore.set(key, entry);
            } else {
              storedResources.set(key, entry);
            }
            if (request.onsuccess) request.onsuccess();
          }, 0);
          return request;
        });

        mockStore.get = mock((key) => {
          const request = {
            result: userThemesStore.get(key) || storedResources.get(key) || null,
            onsuccess: null,
            onerror: null,
          };
          setTimeout(() => {
            if (request.onsuccess) request.onsuccess();
          }, 0);
          return request;
        });

        mockStore.delete = mock((key) => {
          const request = { onsuccess: null, onerror: null };
          setTimeout(() => {
            userThemesStore.delete(key);
            storedResources.delete(key);
            if (request.onsuccess) request.onsuccess();
          }, 0);
          return request;
        });

        mockStore.count = mock((range) => {
          const key = range ? range._value : null;
          const request = {
            result: key ? (userThemesStore.has(key) ? 1 : 0) : userThemesStore.size,
            onsuccess: null,
            onerror: null,
          };
          setTimeout(() => {
            if (request.onsuccess) request.onsuccess();
          }, 0);
          return request;
        });

        // Mock index for userId filtering
        mockStore.index = mock((indexName) => ({
          openCursor: mock((range) => {
            const userId = range ? range._value : null;
            const entries = [];
            for (const [key, value] of userThemesStore.entries()) {
              if (indexName === 'userId' && value.userId === userId) {
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
        }));

        await cache.init();
      });

      afterEach(() => {
        userThemesStore = null;
        delete global.window;
      });

      it('stores theme with userId prefix in key', async () => {
        global.window = {
          eXeLearning: { app: { user: { name: 'alice' } } },
          fflate: { unzipSync: () => ({}) },
        };

        const compressedFiles = new Uint8Array([1, 2, 3]);
        const config = { displayName: 'Test Theme' };

        await cache.setUserTheme('my-theme', compressedFiles, config);

        expect(userThemesStore.has('alice:my-theme')).toBe(true);
        const stored = userThemesStore.get('alice:my-theme');
        expect(stored.userId).toBe('alice');
        expect(stored.name).toBe('my-theme');
      });

      it('isolates themes between users', async () => {
        const compressedFiles = new Uint8Array([1, 2, 3]);
        const config = { displayName: 'Theme' };

        // User alice stores a theme
        global.window = {
          eXeLearning: { app: { user: { name: 'alice' } } },
          fflate: { unzipSync: () => ({}) },
        };
        await cache.setUserTheme('shared-name', compressedFiles, config);

        // User bob stores a theme with the same name
        global.window = {
          eXeLearning: { app: { user: { name: 'bob' } } },
          fflate: { unzipSync: () => ({}) },
        };
        await cache.setUserTheme('shared-name', compressedFiles, { displayName: 'Bob Theme' });

        // Both themes exist with different keys
        expect(userThemesStore.has('alice:shared-name')).toBe(true);
        expect(userThemesStore.has('bob:shared-name')).toBe(true);

        // Themes have correct data
        expect(userThemesStore.get('alice:shared-name').config.displayName).toBe('Theme');
        expect(userThemesStore.get('bob:shared-name').config.displayName).toBe('Bob Theme');
      });

      it('hasUserTheme only checks current user themes', async () => {
        const compressedFiles = new Uint8Array([1, 2, 3]);
        const config = { displayName: 'Theme' };

        // Alice stores a theme
        global.window = {
          eXeLearning: { app: { user: { name: 'alice' } } },
          fflate: { unzipSync: () => ({}) },
        };
        await cache.setUserTheme('alice-theme', compressedFiles, config);

        // Check as Alice - should find it
        expect(await cache.hasUserTheme('alice-theme')).toBe(true);

        // Check as Bob - should NOT find Alice's theme
        global.window = {
          eXeLearning: { app: { user: { name: 'bob' } } },
          fflate: { unzipSync: () => ({}) },
        };
        expect(await cache.hasUserTheme('alice-theme')).toBe(false);
      });

      it('listUserThemes only returns current user themes', async () => {
        const compressedFiles = new Uint8Array([1, 2, 3]);

        // Alice stores two themes
        global.window = {
          eXeLearning: { app: { user: { name: 'alice' } } },
          fflate: { unzipSync: () => ({}) },
        };
        await cache.setUserTheme('alice-theme-1', compressedFiles, { displayName: 'Alice 1' });
        await cache.setUserTheme('alice-theme-2', compressedFiles, { displayName: 'Alice 2' });

        // Bob stores one theme
        global.window = {
          eXeLearning: { app: { user: { name: 'bob' } } },
          fflate: { unzipSync: () => ({}) },
        };
        await cache.setUserTheme('bob-theme', compressedFiles, { displayName: 'Bob Theme' });

        // List as Alice - should only see Alice's themes
        global.window = {
          eXeLearning: { app: { user: { name: 'alice' } } },
          fflate: { unzipSync: () => ({}) },
        };
        const aliceThemes = await cache.listUserThemes();
        expect(aliceThemes.length).toBe(2);
        expect(aliceThemes.map((t) => t.name)).toContain('alice-theme-1');
        expect(aliceThemes.map((t) => t.name)).toContain('alice-theme-2');
        expect(aliceThemes.map((t) => t.name)).not.toContain('bob-theme');

        // List as Bob - should only see Bob's theme
        global.window = {
          eXeLearning: { app: { user: { name: 'bob' } } },
          fflate: { unzipSync: () => ({}) },
        };
        const bobThemes = await cache.listUserThemes();
        expect(bobThemes.length).toBe(1);
        expect(bobThemes[0].name).toBe('bob-theme');
      });

      it('deleteUserTheme only deletes current user theme', async () => {
        const compressedFiles = new Uint8Array([1, 2, 3]);

        // Alice stores a theme
        global.window = {
          eXeLearning: { app: { user: { name: 'alice' } } },
          fflate: { unzipSync: () => ({}) },
        };
        await cache.setUserTheme('my-theme', compressedFiles, { displayName: 'Alice' });

        // Bob stores same-named theme
        global.window = {
          eXeLearning: { app: { user: { name: 'bob' } } },
          fflate: { unzipSync: () => ({}) },
        };
        await cache.setUserTheme('my-theme', compressedFiles, { displayName: 'Bob' });

        // Bob deletes "my-theme"
        await cache.deleteUserTheme('my-theme');

        // Bob's theme is deleted
        expect(userThemesStore.has('bob:my-theme')).toBe(false);

        // Alice's theme is NOT affected
        expect(userThemesStore.has('alice:my-theme')).toBe(true);
      });

      it('updateUserThemeConfig updates config while keeping files', async () => {
        const compressedFiles = new Uint8Array([1, 2, 3, 4, 5]);
        const originalConfig = {
          displayName: 'Original Name',
          version: '1.0',
          author: 'Original Author',
        };

        global.window = {
          eXeLearning: { app: { user: { name: 'testuser' } } },
          fflate: { unzipSync: () => ({}) },
        };

        // Store theme
        await cache.setUserTheme('test-theme', compressedFiles, originalConfig);

        // Update config
        await cache.updateUserThemeConfig('test-theme', {
          displayName: 'Updated Name',
          author: 'New Author',
        });

        // Verify the update
        const stored = userThemesStore.get('testuser:test-theme');
        expect(stored.config.displayName).toBe('Updated Name');
        expect(stored.config.author).toBe('New Author');
        expect(stored.config.version).toBe('1.0'); // unchanged
        expect(stored.files).toEqual(compressedFiles); // files unchanged
        expect(stored.modifiedAt).toBeDefined();
      });

      it('updateUserThemeConfig throws error if theme not found', async () => {
        global.window = {
          eXeLearning: { app: { user: { name: 'testuser' } } },
          fflate: { unzipSync: () => ({}) },
        };

        await expect(
          cache.updateUserThemeConfig('non-existent', { displayName: 'Test' })
        ).rejects.toThrow("Theme 'non-existent' not found");
      });

      it('updateUserThemeConfig only updates current user theme', async () => {
        const compressedFiles = new Uint8Array([1, 2, 3]);

        // Store themes directly in the mock store to simulate pre-existing themes
        userThemesStore.set('alice:shared-name', {
          id: 'alice:shared-name',
          userId: 'alice',
          name: 'shared-name',
          files: compressedFiles,
          config: { displayName: 'Alice Theme' },
        });
        userThemesStore.set('bob:shared-name', {
          id: 'bob:shared-name',
          userId: 'bob',
          name: 'shared-name',
          files: compressedFiles,
          config: { displayName: 'Bob Theme' },
        });

        // Set current user to Bob
        global.window = {
          eXeLearning: { app: { user: { name: 'bob' } } },
          fflate: { unzipSync: () => ({}) },
        };

        // Bob updates his theme
        await cache.updateUserThemeConfig('shared-name', { displayName: 'Bob Updated' });

        // Bob's theme is updated
        expect(userThemesStore.get('bob:shared-name').config.displayName).toBe('Bob Updated');

        // Alice's theme is NOT affected
        expect(userThemesStore.get('alice:shared-name').config.displayName).toBe('Alice Theme');
      });

      it('getUserThemeRaw returns raw compressed data', async () => {
        const compressedFiles = new Uint8Array([1, 2, 3, 4, 5]);
        const config = { displayName: 'Raw Theme' };

        global.window = {
          eXeLearning: { app: { user: { name: 'testuser' } } },
          fflate: { unzipSync: () => ({}) },
        };

        // Store theme
        await cache.setUserTheme('raw-theme', compressedFiles, config);

        // Get raw data
        const result = await cache.getUserThemeRaw('raw-theme');

        expect(result).not.toBeNull();
        expect(result.compressedFiles).toEqual(compressedFiles);
        expect(result.config).toEqual(config);
      });

      it('getUserThemeRaw returns null for non-existent theme', async () => {
        global.window = {
          eXeLearning: { app: { user: { name: 'testuser' } } },
          fflate: { unzipSync: () => ({}) },
        };

        const result = await cache.getUserThemeRaw('non-existent');

        expect(result).toBeNull();
      });

      it('getUserThemeRaw isolates themes between users', async () => {
        const compressedFiles = new Uint8Array([1, 2, 3]);

        // Alice stores a theme
        global.window = {
          eXeLearning: { app: { user: { name: 'alice' } } },
          fflate: { unzipSync: () => ({}) },
        };
        await cache.setUserTheme('private-theme', compressedFiles, { displayName: 'Alice Theme' });

        // Bob tries to get Alice's theme
        global.window = {
          eXeLearning: { app: { user: { name: 'bob' } } },
          fflate: { unzipSync: () => ({}) },
        };
        const result = await cache.getUserThemeRaw('private-theme');

        // Bob should not get Alice's theme
        expect(result).toBeNull();
      });
    });
  });

  describe('_getMimeType', () => {
    beforeEach(async () => {
      await cache.init();
    });

    it('returns text/css for .css files', () => {
      expect(cache._getMimeType('style.css')).toBe('text/css');
    });

    it('returns application/javascript for .js files', () => {
      expect(cache._getMimeType('script.js')).toBe('application/javascript');
    });

    it('returns text/html for .html files', () => {
      expect(cache._getMimeType('page.html')).toBe('text/html');
    });

    it('returns application/xml for .xml files', () => {
      expect(cache._getMimeType('config.xml')).toBe('application/xml');
    });

    it('returns application/json for .json files', () => {
      expect(cache._getMimeType('data.json')).toBe('application/json');
    });

    it('returns image/png for .png files', () => {
      expect(cache._getMimeType('image.png')).toBe('image/png');
    });

    it('returns image/jpeg for .jpg and .jpeg files', () => {
      expect(cache._getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(cache._getMimeType('photo.jpeg')).toBe('image/jpeg');
    });

    it('returns image/gif for .gif files', () => {
      expect(cache._getMimeType('anim.gif')).toBe('image/gif');
    });

    it('returns image/svg+xml for .svg files', () => {
      expect(cache._getMimeType('icon.svg')).toBe('image/svg+xml');
    });

    it('returns font/woff for .woff files', () => {
      expect(cache._getMimeType('font.woff')).toBe('font/woff');
    });

    it('returns font/woff2 for .woff2 files', () => {
      expect(cache._getMimeType('font.woff2')).toBe('font/woff2');
    });

    it('returns font/ttf for .ttf files', () => {
      expect(cache._getMimeType('font.ttf')).toBe('font/ttf');
    });

    it('returns application/vnd.ms-fontobject for .eot files', () => {
      expect(cache._getMimeType('font.eot')).toBe('application/vnd.ms-fontobject');
    });

    it('returns application/octet-stream for unknown extensions', () => {
      expect(cache._getMimeType('file.xyz')).toBe('application/octet-stream');
      expect(cache._getMimeType('file.unknown')).toBe('application/octet-stream');
    });

    it('handles files with no extension', () => {
      expect(cache._getMimeType('noextension')).toBe('application/octet-stream');
    });

    it('handles files with multiple dots', () => {
      expect(cache._getMimeType('file.name.css')).toBe('text/css');
      expect(cache._getMimeType('my.script.js')).toBe('application/javascript');
    });
  });

  describe('_decompressThemeFiles', () => {
    beforeEach(async () => {
      await cache.init();
    });

    it('throws error when fflate is not loaded', () => {
      global.window = {};

      expect(() => cache._decompressThemeFiles(new Uint8Array([1]))).toThrow(
        'fflate library not loaded'
      );
    });

    it('decompresses ZIP and returns Map of files', () => {
      global.window = {
        fflate: {
          unzipSync: mock(() => ({
            'style.css': new Uint8Array([99, 115, 115]),
            'script.js': new Uint8Array([106, 115]),
          })),
        },
      };

      const result = cache._decompressThemeFiles(new Uint8Array([1, 2, 3]));

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.has('style.css')).toBe(true);
      expect(result.has('script.js')).toBe(true);
    });

    it('converts Uint8Array to Blob with correct MIME type', () => {
      global.window = {
        fflate: {
          unzipSync: mock(() => ({
            'style.css': new Uint8Array([99, 115, 115]),
            'image.png': new Uint8Array([1, 2, 3]),
          })),
        },
      };

      const result = cache._decompressThemeFiles(new Uint8Array([1, 2, 3]));

      expect(result.get('style.css')).toBeInstanceOf(Blob);
      expect(result.get('style.css').type).toBe('text/css');
      expect(result.get('image.png').type).toBe('image/png');
    });
  });
});
