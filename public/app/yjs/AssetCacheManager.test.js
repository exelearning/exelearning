/**
 * AssetCacheManager Tests
 *
 * Unit tests for AssetCacheManager - handles caching of project assets in IndexedDB.
 *
 */

// Test functions available globally from vitest setup

 

const AssetCacheManager = require('./AssetCacheManager');

// Mock IndexedDB
const createMockIndexedDB = () => {
  const stores = new Map();
  const mockStore = {
    put: mock((record) => {
      const key = JSON.stringify([record.projectId, record.assetId]);
      stores.set(key, record);
      return { onsuccess: null, onerror: null };
    }),
    get: mock((key) => {
      const keyStr = JSON.stringify(key);
      const result = stores.get(keyStr) || null;
      return { result, onsuccess: null, onerror: null };
    }),
    delete: mock((key) => {
      const keyStr = JSON.stringify(key);
      stores.delete(keyStr);
      return { onsuccess: null, onerror: null };
    }),
    index: mock(() => ({
      getAll: mock((projectId) => {
        const results = [];
        for (const [key, value] of stores.entries()) {
          if (value.projectId === projectId) {
            results.push(value);
          }
        }
        return { result: results, onsuccess: null, onerror: null };
      }),
    })),
    createIndex: mock(() => undefined),
    indexNames: { contains: mock(() => false) },
  };

  const mockTransaction = {
    objectStore: mock(() => mockStore),
    oncomplete: null,
    onerror: null,
  };

  const mockDB = {
    transaction: mock(() => mockTransaction),
    objectStoreNames: { contains: mock(() => false) },
    createObjectStore: mock(() => mockStore),
    close: mock(() => undefined),
  };

  return {
    db: mockDB,
    stores,
    open: mock((name, version) => {
      const request = {
        result: mockDB,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      setTimeout(() => {
        if (request.onupgradeneeded) {
          request.onupgradeneeded({ target: { result: mockDB, transaction: mockTransaction } });
        }
        if (request.onsuccess) {
          request.onsuccess();
        }
      }, 0);
      return request;
    }),
  };
};

describe('AssetCacheManager', () => {
  let cacheManager;
  let mockIndexedDB;
  let mockObjectURLs;

  beforeEach(() => {
    mockIndexedDB = createMockIndexedDB();
    mockObjectURLs = new Map();
    let urlCounter = 0;

    global.indexedDB = {
      open: mockIndexedDB.open,
    };

    global.URL = {
      createObjectURL: mock((blob) => {
        const url = `blob:test-${urlCounter++}`;
        mockObjectURLs.set(url, blob);
        return url;
      }),
      revokeObjectURL: mock((url) => {
        mockObjectURLs.delete(url);
      }),
    };

    global.fetch = mock(() => undefined);

    cacheManager = new AssetCacheManager('project-123');

    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Cleanup to prevent memory leaks
    if (cacheManager && typeof cacheManager.destroy === 'function') {
      cacheManager.destroy();
    }
    cacheManager = null;
    mockIndexedDB = null;
    mockObjectURLs = null;

    delete global.indexedDB;
    delete global.URL;
    delete global.fetch;
  });

  describe('constructor', () => {
    it('initializes with project ID', () => {
      expect(cacheManager.projectId).toBe('project-123');
    });

    it('initializes db as null', () => {
      expect(cacheManager.db).toBeNull();
    });

    it('initializes empty objectURLs map', () => {
      expect(cacheManager.objectURLs).toBeInstanceOf(Map);
      expect(cacheManager.objectURLs.size).toBe(0);
    });

    it('initializes empty pathToUrlCache map', () => {
      expect(cacheManager.pathToUrlCache).toBeInstanceOf(Map);
      expect(cacheManager.pathToUrlCache.size).toBe(0);
    });
  });

  describe('static properties', () => {
    it('has correct DB_NAME', () => {
      expect(AssetCacheManager.DB_NAME).toBe('exelearning-assets');
    });

    it('has correct DB_VERSION', () => {
      expect(AssetCacheManager.DB_VERSION).toBe(2);
    });

    it('has correct STORE_NAME', () => {
      expect(AssetCacheManager.STORE_NAME).toBe('assets');
    });

    it('has correct MAX_CACHE_SIZE', () => {
      expect(AssetCacheManager.MAX_CACHE_SIZE).toBe(100 * 1024 * 1024);
    });
  });

  describe('openDB', () => {
    it('opens IndexedDB database', async () => {
      const db = await cacheManager.openDB();
      expect(mockIndexedDB.open).toHaveBeenCalledWith('exelearning-assets', 2);
      expect(db).toBeDefined();
    });

    it('returns cached db on subsequent calls', async () => {
      const db1 = await cacheManager.openDB();
      const db2 = await cacheManager.openDB();
      expect(db1).toBe(db2);
      expect(mockIndexedDB.open).toHaveBeenCalledTimes(1);
    });

    it('handles open error', async () => {
      mockIndexedDB.open.mockImplementationOnce(() => {
        const request = {
          error: new Error('Open failed'),
          onsuccess: null,
          onerror: null,
        };
        setTimeout(() => {
          if (request.onerror) request.onerror();
        }, 0);
        return request;
      });

      await expect(cacheManager.openDB()).rejects.toThrow();
    });
  });

  describe('cacheAsset', () => {
    it('stores asset in IndexedDB', async () => {
      const blob = new Blob(['test data'], { type: 'text/plain' });
      const metadata = { filename: 'test.txt' };

      // Mock the openDB to return a proper db with transaction
      cacheManager.db = mockIndexedDB.db;

      // Mock the transaction flow
      const mockPutRequest = { onsuccess: null, onerror: null };
      const mockStore = {
        put: mock(() => mockPutRequest),
      };
      const mockTx = {
        objectStore: mock(() => mockStore),
      };
      mockIndexedDB.db.transaction.mockReturnValue(mockTx);

      const cachePromise = cacheManager.cacheAsset('asset-1', blob, metadata);

      // Trigger success
      setTimeout(() => {
        mockPutRequest.onsuccess?.();
      }, 0);

      await cachePromise;

      expect(mockStore.put).toHaveBeenCalled();
      const record = mockStore.put.mock.calls[0][0];
      expect(record.projectId).toBe('project-123');
      expect(record.assetId).toBe('asset-1');
      expect(record.blob).toBe(blob);
      expect(record.metadata).toBe(metadata);
    });
  });

  describe('getAsset', () => {
    it('retrieves asset from IndexedDB', async () => {
      cacheManager.db = mockIndexedDB.db;

      const mockResult = {
        blob: new Blob(['test']),
        metadata: { filename: 'test.txt' },
      };

      const mockGetRequest = { result: mockResult, onsuccess: null, onerror: null };
      const mockStore = {
        get: mock(() => mockGetRequest),
      };
      const mockTx = {
        objectStore: mock(() => mockStore),
      };
      mockIndexedDB.db.transaction.mockReturnValue(mockTx);

      const getPromise = cacheManager.getAsset('asset-1');

      setTimeout(() => {
        mockGetRequest.onsuccess?.();
      }, 0);

      const result = await getPromise;

      expect(mockStore.get).toHaveBeenCalledWith(['project-123', 'asset-1']);
      expect(result.blob).toBe(mockResult.blob);
      expect(result.metadata).toBe(mockResult.metadata);
    });

    it('returns null when asset not found', async () => {
      cacheManager.db = mockIndexedDB.db;

      const mockGetRequest = { result: null, onsuccess: null, onerror: null };
      const mockStore = {
        get: mock(() => mockGetRequest),
      };
      const mockTx = {
        objectStore: mock(() => mockStore),
      };
      mockIndexedDB.db.transaction.mockReturnValue(mockTx);

      const getPromise = cacheManager.getAsset('nonexistent');

      setTimeout(() => {
        mockGetRequest.onsuccess?.();
      }, 0);

      const result = await getPromise;
      expect(result).toBeNull();
    });
  });

  describe('getAssetUrl', () => {
    it('creates object URL for cached asset', async () => {
      const blob = new Blob(['test']);
      cacheManager.getAsset = mock(() => undefined).mockResolvedValue({ blob, metadata: {} });

      const url = await cacheManager.getAssetUrl('asset-1');

      expect(url).toMatch(/^blob:test-/);
      expect(cacheManager.objectURLs.has('asset-1')).toBe(true);
    });

    it('returns null when asset not found', async () => {
      cacheManager.getAsset = mock(() => undefined).mockResolvedValue(null);

      const url = await cacheManager.getAssetUrl('nonexistent');

      expect(url).toBeNull();
    });
  });

  describe('resolveAssetUrl', () => {
    it('returns cached URL from memory', async () => {
      cacheManager.pathToUrlCache.set('image.jpg', 'blob:cached-url');

      const url = await cacheManager.resolveAssetUrl('image.jpg');

      expect(url).toBe('blob:cached-url');
    });

    it('normalizes path with {{context_path}}', async () => {
      cacheManager.pathToUrlCache.set('image.jpg', 'blob:cached-url');

      const url = await cacheManager.resolveAssetUrl('{{context_path}}/image.jpg');

      expect(url).toBe('blob:cached-url');
    });

    it('normalizes URL-encoded context path', async () => {
      cacheManager.pathToUrlCache.set('image.jpg', 'blob:cached-url');

      const url = await cacheManager.resolveAssetUrl('%7B%7Bcontext_path%7D%7D/image.jpg');

      expect(url).toBe('blob:cached-url');
    });

    it('returns null when asset not found', async () => {
      cacheManager.getAssetByPath = mock(() => undefined).mockResolvedValue(null);

      const url = await cacheManager.resolveAssetUrl('nonexistent.jpg');

      expect(url).toBeNull();
    });
  });

  describe('resolveAssetUrlSync', () => {
    it('returns URL from memory cache synchronously', () => {
      cacheManager.pathToUrlCache.set('image.jpg', 'blob:cached-url');

      const url = cacheManager.resolveAssetUrlSync('image.jpg');

      expect(url).toBe('blob:cached-url');
    });

    it('normalizes path with {{context_path}}', () => {
      cacheManager.pathToUrlCache.set('image.jpg', 'blob:cached-url');

      const url = cacheManager.resolveAssetUrlSync('{{context_path}}/image.jpg');

      expect(url).toBe('blob:cached-url');
    });

    it('returns null when not in memory cache', () => {
      const url = cacheManager.resolveAssetUrlSync('nonexistent.jpg');
      expect(url).toBeNull();
    });
  });

  describe('resolveHtmlAssetUrls', () => {
    it('returns unchanged HTML when no context_path references', async () => {
      const html = '<p>Hello world</p>';
      const result = await cacheManager.resolveHtmlAssetUrls(html);
      expect(result).toBe(html);
    });

    it('returns unchanged HTML when null', async () => {
      const result = await cacheManager.resolveHtmlAssetUrls(null);
      expect(result).toBeNull();
    });

    it('replaces {{context_path}} references with blob URLs', async () => {
      cacheManager.resolveAssetUrl = mock(() => undefined).mockResolvedValue('blob:resolved-url');

      const html = '<img src="{{context_path}}/images/test.jpg">';
      const result = await cacheManager.resolveHtmlAssetUrls(html);

      expect(result).toBe('<img src="blob:resolved-url">');
    });
  });

  describe('resolveHtmlAssetUrlsSync', () => {
    it('returns unchanged HTML when null', () => {
      const result = cacheManager.resolveHtmlAssetUrlsSync(null);
      expect(result).toBeNull();
    });

    it('replaces context_path references from cache', () => {
      cacheManager.pathToUrlCache.set('images/test.jpg', 'blob:cached-url');

      const html = '<img src="{{context_path}}/images/test.jpg">';
      const result = cacheManager.resolveHtmlAssetUrlsSync(html);

      expect(result).toBe('<img src="blob:cached-url">');
    });

    it('keeps original reference when not in cache', () => {
      const html = '<img src="{{context_path}}/missing.jpg">';
      const result = cacheManager.resolveHtmlAssetUrlsSync(html);

      expect(result).toBe(html);
    });
  });

  describe('preloadAllAssets', () => {
    it('preloads all assets into memory', async () => {
      const assets = [
        { metadata: { originalPath: 'img1.jpg' }, blob: new Blob(['1']) },
        { metadata: { originalPath: 'img2.jpg' }, blob: new Blob(['2']) },
      ];
      cacheManager.getAllAssets = mock(() => undefined).mockResolvedValue(assets);

      const count = await cacheManager.preloadAllAssets();

      expect(count).toBe(2);
      expect(cacheManager.pathToUrlCache.size).toBe(2);
      expect(cacheManager.objectURLs.size).toBe(2);
    });

    it('skips assets without originalPath', async () => {
      const assets = [
        { metadata: {}, blob: new Blob(['1']) },
        { metadata: { originalPath: 'img.jpg' }, blob: new Blob(['2']) },
      ];
      cacheManager.getAllAssets = mock(() => undefined).mockResolvedValue(assets);

      const count = await cacheManager.preloadAllAssets();

      expect(count).toBe(1);
    });
  });

  describe('fetchAndCache', () => {
    it('returns cached URL if asset exists', async () => {
      const blob = new Blob(['cached']);
      cacheManager.getAsset = mock(() => undefined).mockResolvedValue({ blob, metadata: {} });

      const url = await cacheManager.fetchAndCache('asset-1', 'http://api', 'token');

      expect(url).toMatch(/^blob:test-/);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetches from server when not cached', async () => {
      cacheManager.getAsset = mock(() => undefined).mockResolvedValue(null);
      cacheManager.cacheAsset = mock(() => undefined).mockResolvedValue();

      const blob = new Blob(['fetched']);
      global.fetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(blob),
        headers: {
          get: mock((name) => {
            if (name === 'content-disposition') return 'filename="test.jpg"';
            if (name === 'content-type') return 'image/jpeg';
            return null;
          }),
        },
      });

      const url = await cacheManager.fetchAndCache('asset-1', 'http://api', 'token');

      expect(global.fetch).toHaveBeenCalled();
      expect(url).toMatch(/^blob:test-/);
    });

    it('throws on fetch error', async () => {
      cacheManager.getAsset = mock(() => undefined).mockResolvedValue(null);
      global.fetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(
        cacheManager.fetchAndCache('asset-1', 'http://api', 'token')
      ).rejects.toThrow('Failed to fetch asset: 404');
    });
  });

  describe('deleteAsset', () => {
    it('deletes asset and revokes URL', async () => {
      cacheManager.db = mockIndexedDB.db;
      cacheManager.objectURLs.set('asset-1', 'blob:to-revoke');

      const mockDeleteRequest = { onsuccess: null, onerror: null };
      const mockStore = {
        delete: mock(() => mockDeleteRequest),
      };
      const mockTx = {
        objectStore: mock(() => mockStore),
      };
      mockIndexedDB.db.transaction.mockReturnValue(mockTx);

      const deletePromise = cacheManager.deleteAsset('asset-1');

      setTimeout(() => {
        mockDeleteRequest.onsuccess?.();
      }, 0);

      await deletePromise;

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:to-revoke');
      expect(cacheManager.objectURLs.has('asset-1')).toBe(false);
    });
  });

  describe('getAllAssets', () => {
    it('retrieves all assets for project', async () => {
      cacheManager.db = mockIndexedDB.db;

      const mockAssets = [
        { projectId: 'project-123', assetId: 'a1' },
        { projectId: 'project-123', assetId: 'a2' },
      ];

      const mockGetAllRequest = { result: mockAssets, onsuccess: null, onerror: null };
      const mockIndex = {
        getAll: mock(() => mockGetAllRequest),
      };
      const mockStore = {
        index: mock(() => mockIndex),
      };
      const mockTx = {
        objectStore: mock(() => mockStore),
      };
      mockIndexedDB.db.transaction.mockReturnValue(mockTx);

      const assetsPromise = cacheManager.getAllAssets();

      setTimeout(() => {
        mockGetAllRequest.onsuccess?.();
      }, 0);

      const assets = await assetsPromise;

      expect(assets).toHaveLength(2);
      expect(mockIndex.getAll).toHaveBeenCalledWith('project-123');
    });
  });

  describe('getCacheSize', () => {
    it('calculates total cache size', async () => {
      cacheManager.getAllAssets = mock(() => undefined).mockResolvedValue([
        { size: 1000 },
        { size: 2000 },
        { size: 500 },
      ]);

      const size = await cacheManager.getCacheSize();

      expect(size).toBe(3500);
    });

    it('handles assets without size', async () => {
      cacheManager.getAllAssets = mock(() => undefined).mockResolvedValue([
        { size: 1000 },
        {},
        { size: 500 },
      ]);

      const size = await cacheManager.getCacheSize();

      expect(size).toBe(1500);
    });
  });

  describe('clearCache', () => {
    it('clears all cached assets and URLs', async () => {
      cacheManager.db = mockIndexedDB.db;
      cacheManager.objectURLs.set('a1', 'blob:url1');
      cacheManager.objectURLs.set('a2', 'blob:url2');

      cacheManager.getAllAssets = mock(() => undefined).mockResolvedValue([
        { projectId: 'project-123', assetId: 'a1' },
        { projectId: 'project-123', assetId: 'a2' },
      ]);

      const mockStore = {
        delete: mock(() => undefined),
      };
      const mockTx = {
        objectStore: mock(() => mockStore),
        oncomplete: null,
        onerror: null,
      };
      mockIndexedDB.db.transaction.mockReturnValue(mockTx);

      const clearPromise = cacheManager.clearCache();

      setTimeout(() => {
        mockTx.oncomplete?.();
      }, 0);

      await clearPromise;

      expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
      expect(cacheManager.objectURLs.size).toBe(0);
    });
  });

  describe('pruneIfNeeded', () => {
    it('does nothing when under max size', async () => {
      cacheManager.getCacheSize = mock(() => undefined).mockResolvedValue(1000);
      cacheManager.getAllAssets = mock(() => undefined);
      cacheManager.deleteAsset = mock(() => undefined);

      await cacheManager.pruneIfNeeded();

      expect(cacheManager.getAllAssets).not.toHaveBeenCalled();
      expect(cacheManager.deleteAsset).not.toHaveBeenCalled();
    });

    it('prunes oldest assets when over max size', async () => {
      cacheManager.getCacheSize = mock(() => undefined).mockResolvedValue(150 * 1024 * 1024);
      cacheManager.getAllAssets = mock(() => undefined).mockResolvedValue([
        { assetId: 'old', cachedAt: 1000, size: 50 * 1024 * 1024 },
        { assetId: 'newer', cachedAt: 2000, size: 50 * 1024 * 1024 },
        { assetId: 'newest', cachedAt: 3000, size: 50 * 1024 * 1024 },
      ]);
      cacheManager.deleteAsset = mock(() => undefined);

      await cacheManager.pruneIfNeeded();

      expect(cacheManager.deleteAsset).toHaveBeenCalledWith('old');
    });
  });

  describe('destroy', () => {
    it('revokes all object URLs', () => {
      cacheManager.objectURLs.set('a1', 'blob:url1');
      cacheManager.objectURLs.set('a2', 'blob:url2');
      cacheManager.db = mockIndexedDB.db;

      cacheManager.destroy();

      expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
      expect(cacheManager.objectURLs.size).toBe(0);
    });

    it('closes database connection', () => {
      cacheManager.db = mockIndexedDB.db;

      cacheManager.destroy();

      expect(mockIndexedDB.db.close).toHaveBeenCalled();
      expect(cacheManager.db).toBeNull();
    });

    it('handles destroy when db is null', () => {
      cacheManager.db = null;

      expect(() => cacheManager.destroy()).not.toThrow();
    });
  });

  describe('getAssetByPath', () => {
    it('returns from memory cache first', async () => {
      cacheManager.pathToUrlCache.set('test.jpg', 'blob:cached');

      const result = await cacheManager.getAssetByPath('test.jpg');

      expect(result.url).toBe('blob:cached');
      expect(result.fromCache).toBe(true);
    });

    it('searches IndexedDB when not in memory', async () => {
      cacheManager.getAllAssets = mock(() => undefined).mockResolvedValue([
        { metadata: { originalPath: 'other.jpg' }, blob: new Blob(['1']) },
        { metadata: { originalPath: 'test.jpg' }, blob: new Blob(['2']) },
      ]);
      cacheManager.db = mockIndexedDB.db;

      const result = await cacheManager.getAssetByPath('test.jpg');

      expect(result.metadata.originalPath).toBe('test.jpg');
    });

    it('returns null when not found', async () => {
      cacheManager.getAllAssets = mock(() => undefined).mockResolvedValue([]);
      cacheManager.db = mockIndexedDB.db;

      const result = await cacheManager.getAssetByPath('nonexistent.jpg');

      expect(result).toBeNull();
    });
  });
});

describe('window.resolveAssetUrls', () => {
  beforeEach(() => {
    // Load the module to set up window.resolveAssetUrls
    require('./AssetCacheManager');
  });

  afterEach(() => {
    delete window.eXeLearning;
  });

  it('returns original HTML when null', () => {
    const result = window.resolveAssetUrls(null);
    expect(result).toBeNull();
  });

  it('returns original HTML when no asset cache available', () => {
    window.eXeLearning = { app: { project: {} } };
    const html = '<p>Test</p>';
    const result = window.resolveAssetUrls(html);
    expect(result).toBe(html);
  });

  it('uses asset cache when available', () => {
    const mockResolve = mock(() => undefined).mockReturnValue('<p>Resolved</p>');
    window.eXeLearning = {
      app: {
        project: {
          _yjsBridge: {
            assetCache: {
              resolveHtmlAssetUrlsSync: mockResolve,
            },
          },
        },
      },
    };

    const result = window.resolveAssetUrls('<p>Test</p>');

    expect(mockResolve).toHaveBeenCalledWith('<p>Test</p>');
    expect(result).toBe('<p>Resolved</p>');
  });
});
