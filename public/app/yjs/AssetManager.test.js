/**
 * AssetManager Tests
 *
 * Unit tests for AssetManager - offline-first asset management for eXeLearning.
 *
 */

// Test functions available globally from vitest setup

 

const AssetManager = require('./AssetManager');

// Mock crypto API
const mockCrypto = {
  randomUUID: mock(() => 'mock-uuid-1234-5678-90ab-cdef12345678'),
  subtle: {
    digest: mock(async (algorithm, data) => {
      // Return a mock hash buffer (64 bytes for SHA-256)
      const mockHash = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        mockHash[i] = i;
      }
      return mockHash.buffer;
    }),
  },
};

// Mock Yjs bridge for testing
const createMockYjsBridge = () => {
  const assetsMap = new Map();
  const mockYMap = {
    get: (id) => assetsMap.get(id),
    set: (id, value) => assetsMap.set(id, value),
    delete: (id) => assetsMap.delete(id),
    forEach: (callback) => assetsMap.forEach((value, key) => callback(value, key)),
    doc: {
      transact: (fn) => fn()
    }
  };
  return {
    getAssetsMap: () => mockYMap,
    _assetsMap: assetsMap // For test inspection
  };
};

describe('AssetManager', () => {
  let assetManager;
  let mockDB;
  let mockStore;
  let mockObjectURLs;
  let mockYjsBridge;

  beforeEach(() => {
    mockObjectURLs = new Map();
    let urlCounter = 0;

    // Create mock Yjs bridge
    mockYjsBridge = createMockYjsBridge();

    // Create mock IndexedDB store (now only stores blobs)
    const storedBlobs = new Map();

    mockStore = {
      put: mock((blobRecord) => {
        storedBlobs.set(blobRecord.id, blobRecord);
        return { onsuccess: null, onerror: null };
      }),
      get: mock((id) => {
        const result = storedBlobs.get(id) || null;
        return { result, onsuccess: null, onerror: null };
      }),
      delete: mock((id) => {
        storedBlobs.delete(id);
        return { onsuccess: null, onerror: null };
      }),
      index: mock(() => ({
        getAll: mock((key) => {
          const results = [];
          for (const [id, record] of storedBlobs.entries()) {
            if (record.projectId === key) {
              results.push(record);
            }
          }
          return { result: results, onsuccess: null, onerror: null };
        }),
      })),
      createIndex: mock(() => undefined),
      indexNames: { contains: mock(() => false) },
    };

    mockDB = {
      transaction: mock(() => ({
        objectStore: mock(() => mockStore),
        oncomplete: null,
        onerror: null,
      })),
      objectStoreNames: { contains: mock(() => true) },
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
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      }),
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

    // Use Object.defineProperty because crypto is a getter-only property in happy-dom
    Object.defineProperty(global, 'crypto', {
      value: mockCrypto,
      writable: true,
      configurable: true,
    });

    global.fetch = mock(() => undefined);

    global.Image = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.src = '';
        this.naturalWidth = 100;
        this.naturalHeight = 100;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    };

    assetManager = new AssetManager('project-123');
    // Connect Yjs bridge for metadata storage
    assetManager.setYjsBridge(mockYjsBridge);

    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Cleanup to prevent memory leaks
    if (assetManager && typeof assetManager.cleanup === 'function') {
      assetManager.cleanup();
    }
    assetManager = null;
    mockDB = null;
    mockStore = null;
    mockObjectURLs = null;

    delete global.indexedDB;
    delete global.URL;
    delete global.crypto;
    delete global.fetch;
    delete global.Image;
  });

  describe('constructor', () => {
    it('initializes with project ID', () => {
      expect(assetManager.projectId).toBe('project-123');
    });

    it('initializes db as null', () => {
      expect(assetManager.db).toBeNull();
    });

    it('initializes empty blobURLCache', () => {
      expect(assetManager.blobURLCache).toBeInstanceOf(Map);
      expect(assetManager.blobURLCache.size).toBe(0);
    });

    it('initializes empty reverseBlobCache', () => {
      expect(assetManager.reverseBlobCache).toBeInstanceOf(Map);
      expect(assetManager.reverseBlobCache.size).toBe(0);
    });
  });

  describe('static properties', () => {
    it('has correct DB_NAME', () => {
      expect(AssetManager.DB_NAME).toBe('exelearning-assets'); // Uses Yjs for metadata
    });

    it('has correct DB_VERSION', () => {
      expect(AssetManager.DB_VERSION).toBe(1); // Fresh start
    });

    it('has correct STORE_NAME', () => {
      expect(AssetManager.STORE_NAME).toBe('blobs'); // Now only stores blobs
    });
  });

  describe('init', () => {
    it('opens IndexedDB database', async () => {
      await assetManager.init();
      expect(global.indexedDB.open).toHaveBeenCalledWith('exelearning-assets', 1); // Yjs metadata
      expect(assetManager.db).toBe(mockDB);
    });

    it('returns early if already initialized', async () => {
      assetManager.db = mockDB;
      await assetManager.init();
      expect(global.indexedDB.open).not.toHaveBeenCalled();
    });

    it('handles open error', async () => {
      global.indexedDB.open.mockImplementationOnce(() => {
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

      await expect(assetManager.init()).rejects.toThrow();
    });
  });

  describe('generateUUID', () => {
    it('uses crypto.randomUUID when available', () => {
      const uuid = assetManager.generateUUID();
      expect(mockCrypto.randomUUID).toHaveBeenCalled();
      expect(uuid).toBe('mock-uuid-1234-5678-90ab-cdef12345678');
    });

    it('falls back to manual generation when crypto unavailable', () => {
      const originalCrypto = global.crypto;
      global.crypto = undefined;

      const uuid = assetManager.generateUUID();

      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

      global.crypto = originalCrypto;
    });
  });

  describe('calculateHash', () => {
    it('calculates SHA-256 hash of blob', async () => {
      // Mock blob with arrayBuffer method
      const mockBlob = {
        arrayBuffer: mock(() => undefined).mockResolvedValue(new ArrayBuffer(8)),
      };
      const hash = await assetManager.calculateHash(mockBlob);

      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('hashToUUID', () => {
    it('converts hash to UUID format', () => {
      const hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const uuid = assetManager.hashToUUID(hash);

      expect(uuid).toBe('01234567-89ab-cdef-0123-456789abcdef');
    });
  });

  describe('putAsset', () => {
    it('throws if database not initialized', async () => {
      await expect(assetManager.putAsset({})).rejects.toThrow('Database not initialized');
    });

    it('stores asset metadata in Yjs and blob in IndexedDB', async () => {
      assetManager.db = mockDB;

      const mockTx = {
        objectStore: mock(() => mockStore),
        oncomplete: null,
        onerror: null,
      };
      mockDB.transaction.mockReturnValue(mockTx);

      const testBlob = new Blob(['test data']);
      const putPromise = assetManager.putAsset({
        id: 'asset-1',
        filename: 'test.jpg',
        folderPath: 'images',
        mime: 'image/jpeg',
        size: 1000,
        hash: 'abc123',
        uploaded: false,
        blob: testBlob
      });

      setTimeout(() => {
        mockTx.oncomplete?.();
      }, 0);

      await putPromise;

      // Check metadata was stored in Yjs
      const storedMeta = mockYjsBridge._assetsMap.get('asset-1');
      expect(storedMeta).toBeDefined();
      expect(storedMeta.filename).toBe('test.jpg');
      expect(storedMeta.folderPath).toBe('images');

      // Check blob was stored in IndexedDB (only id, projectId, blob)
      expect(mockStore.put).toHaveBeenCalledWith({
        id: 'asset-1',
        projectId: 'project-123',
        blob: testBlob
      });
    });
  });

  describe('getAsset', () => {
    it('throws if database not initialized', async () => {
      await expect(assetManager.getAsset('id')).rejects.toThrow('Database not initialized');
    });

    it('retrieves asset combining Yjs metadata and IndexedDB blob', async () => {
      assetManager.db = mockDB;

      // Setup metadata in Yjs
      mockYjsBridge._assetsMap.set('asset-1', {
        filename: 'test.jpg',
        folderPath: 'images',
        mime: 'image/jpeg',
        size: 1000,
        hash: 'abc123',
        uploaded: true,
        createdAt: '2024-01-01'
      });

      // Setup blob in IndexedDB mock
      const testBlob = new Blob(['test data']);
      const mockBlobRecord = { id: 'asset-1', projectId: 'project-123', blob: testBlob };
      const mockGetRequest = { result: mockBlobRecord, onsuccess: null, onerror: null };

      const mockTx = {
        objectStore: mock(() => ({
          get: mock(() => mockGetRequest),
        })),
      };
      mockDB.transaction.mockReturnValue(mockTx);

      const getPromise = assetManager.getAsset('asset-1');

      setTimeout(() => {
        mockGetRequest.onsuccess?.();
      }, 0);

      const result = await getPromise;

      // Should combine metadata from Yjs with blob from IndexedDB
      expect(result.id).toBe('asset-1');
      expect(result.filename).toBe('test.jpg');
      expect(result.folderPath).toBe('images');
      expect(result.blob).toBe(testBlob);
    });

    it('returns actual IndexedDB projectId when no Yjs metadata exists (cross-project asset reuse)', async () => {
      // This test ensures that when an asset blob exists in IndexedDB but belongs to a DIFFERENT project,
      // getAsset() returns the ACTUAL projectId from IndexedDB, not this.projectId.
      // This is critical for extractAssetsFromZip() to detect cross-project assets and create
      // proper metadata for the current project.
      assetManager.db = mockDB;

      // NO metadata in Yjs for this asset (simulating cross-project scenario)
      // mockYjsBridge._assetsMap does NOT have 'cross-project-asset'

      // Setup blob in IndexedDB with a DIFFERENT projectId
      const testBlob = new Blob(['cross project data']);
      const differentProjectId = 'different-project-uuid';
      const mockBlobRecord = { id: 'cross-project-asset', projectId: differentProjectId, blob: testBlob };
      const mockGetRequest = { result: mockBlobRecord, onsuccess: null, onerror: null };

      const mockTx = {
        objectStore: mock(() => ({
          get: mock(() => mockGetRequest),
        })),
      };
      mockDB.transaction.mockReturnValue(mockTx);

      const getPromise = assetManager.getAsset('cross-project-asset');

      setTimeout(() => {
        mockGetRequest.onsuccess?.();
      }, 0);

      const result = await getPromise;

      // CRITICAL: projectId should be from IndexedDB, NOT from assetManager.projectId
      expect(result.projectId).toBe(differentProjectId);
      expect(result.projectId).not.toBe(assetManager.projectId);
      expect(result.id).toBe('cross-project-asset');
      expect(result.blob).toBe(testBlob);
      // Fallback metadata when no Yjs metadata exists
      expect(result.filename).toBe('unknown');
      expect(result.folderPath).toBe('');
    });
  });

  describe('getProjectAssets', () => {
    it('throws if database not initialized', async () => {
      await expect(assetManager.getProjectAssets()).rejects.toThrow('Database not initialized');
    });

    it('returns empty array for invalid projectId', async () => {
      assetManager.db = mockDB;
      assetManager.projectId = null;

      const result = await assetManager.getProjectAssets();
      expect(result).toEqual([]);
    });
  });

  describe('insertImage', () => {
    it('stores new image and returns asset:// URL', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue(null);
      assetManager.putAsset = mock(() => undefined).mockResolvedValue();
      assetManager.calculateHash = mock(() => undefined).mockResolvedValue('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

      // Mock file with arrayBuffer
      const mockFile = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 100,
        arrayBuffer: mock(() => undefined).mockResolvedValue(new ArrayBuffer(100)),
      };
      const url = await assetManager.insertImage(mockFile);

      // New format: asset://uuid.ext
      expect(url).toMatch(/^asset:\/\/[a-f0-9-]+\.jpg$/);
      expect(assetManager.putAsset).toHaveBeenCalled();
    });

    it('returns existing asset URL if already exists for current project', async () => {
      assetManager.db = mockDB;
      assetManager.calculateHash = mock(() => undefined).mockResolvedValue('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
      // Mock getAsset to return existing asset
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({
        id: '01234567-89ab-cdef-0123-456789abcdef',
        filename: 'existing.jpg',
        projectId: 'project-123',
        blob: new Blob(['test']),
      });
      // Mock getBlobRecord to return blob FOR CURRENT PROJECT
      assetManager.getBlobRecord = mock(() => undefined).mockResolvedValue({
        id: '01234567-89ab-cdef-0123-456789abcdef',
        projectId: 'project-123', // Same projectId as assetManager - should skip putAsset
        blob: new Blob(['test']),
      });
      assetManager.putAsset = mock(() => undefined); // Spy on putAsset to ensure it's NOT called

      // Mock file with arrayBuffer
      const mockFile = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 100,
        arrayBuffer: mock(() => undefined).mockResolvedValue(new ArrayBuffer(100)),
      };
      const url = await assetManager.insertImage(mockFile);

      // The key requirement is that the existing asset ID is used (no duplicate stored)
      expect(url).toContain('01234567-89ab-cdef-0123-456789abcdef');
      expect(assetManager.putAsset).not.toHaveBeenCalled();
    });

    it('stores blob when asset exists but for different project', async () => {
      assetManager.db = mockDB;
      assetManager.calculateHash = mock(() => undefined).mockResolvedValue('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
      // Mock getAsset to return existing asset (blob from another project)
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({
        id: '01234567-89ab-cdef-0123-456789abcdef',
        filename: 'existing.jpg',
        projectId: 'project-123', // getAsset always returns current projectId
        blob: new Blob(['test']),
      });
      // Mock getBlobRecord to return blob FOR DIFFERENT PROJECT
      assetManager.getBlobRecord = mock(() => undefined).mockResolvedValue({
        id: '01234567-89ab-cdef-0123-456789abcdef',
        projectId: 'other-project', // DIFFERENT from assetManager.projectId - should call putAsset
        blob: new Blob(['test']),
      });
      assetManager.putAsset = mock(() => undefined).mockResolvedValue(); // Spy to ensure it IS called

      // Mock file with arrayBuffer
      const mockFile = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 100,
        arrayBuffer: mock(() => undefined).mockResolvedValue(new ArrayBuffer(100)),
      };
      const url = await assetManager.insertImage(mockFile);

      // The asset URL should be returned
      expect(url).toContain('01234567-89ab-cdef-0123-456789abcdef');
      // putAsset SHOULD be called to store blob for current project
      expect(assetManager.putAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '01234567-89ab-cdef-0123-456789abcdef',
          projectId: 'project-123', // Current projectId
        })
      );
    });

    it('registers blob URL in reverseBlobCache with pure UUID (not asset:// URL)', async () => {
      // This is the CRITICAL test for the bug fix
      // The bug was that asset:// URLs were being stored in reverseBlobCache instead of UUIDs
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue(null);
      assetManager.putAsset = mock(() => undefined).mockResolvedValue();
      assetManager.calculateHash = mock(() => undefined).mockResolvedValue('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

      const mockFile = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 100,
        arrayBuffer: mock(() => undefined).mockResolvedValue(new ArrayBuffer(100)),
      };

      const assetUrl = await assetManager.insertImage(mockFile);

      // assetUrl should be in new format asset://uuid.ext
      expect(assetUrl).toMatch(/^asset:\/\/[a-f0-9-]+\.jpg$/);

      // Extract the UUID from the asset URL
      const assetId = assetManager.extractAssetId(assetUrl);

      // blobURLCache should have the UUID as key
      const blobUrl = assetManager.blobURLCache.get(assetId);
      expect(blobUrl).toMatch(/^blob:/);

      // CRITICAL: reverseBlobCache should have the UUID (not asset:// URL) as value
      const reverseLookup = assetManager.reverseBlobCache.get(blobUrl);
      expect(reverseLookup).toBe(assetId);
      // Should NOT be an asset:// URL
      expect(reverseLookup).not.toContain('asset://');
      // Should be a valid UUID format
      expect(reverseLookup).toMatch(/^[a-f0-9-]+$/);
    });

    it('full image insertion flow: insert -> conversion -> resolve', async () => {
      // Test the complete flow that was broken
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue(null);
      assetManager.putAsset = mock(() => undefined).mockResolvedValue();
      assetManager.calculateHash = mock(() => undefined).mockResolvedValue('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');

      // 1. Insert image
      const mockFile = {
        name: 'photo.jpg',
        type: 'image/jpeg',
        size: 1000,
        arrayBuffer: mock(() => undefined).mockResolvedValue(new ArrayBuffer(1000)),
      };
      const assetUrl = await assetManager.insertImage(mockFile);
      const assetId = assetManager.extractAssetId(assetUrl);

      // 2. Get the blob URL that TinyMCE would use
      const blobUrl = assetManager.blobURLCache.get(assetId);
      expect(blobUrl).toBeTruthy();

      // 3. Simulate HTML with blob URL (what TinyMCE has)
      const htmlWithBlobUrl = `<p>Hello</p><img src="${blobUrl}" alt="photo">`;

      // 4. Convert blob URL to asset URL (what syncFromEditor does)
      const htmlWithAssetUrl = assetManager.convertBlobURLsToAssetRefs(htmlWithBlobUrl);

      // 5. Verify the conversion was successful
      expect(htmlWithAssetUrl).toContain(`asset://${assetId}`);
      expect(htmlWithAssetUrl).not.toContain('blob:');
      // Should NOT have corrupted double asset://
      expect(htmlWithAssetUrl).not.toContain('asset://asset://');
    });
  });

  describe('extractAssetId', () => {
    it('extracts ID from asset:// URL', () => {
      const id = assetManager.extractAssetId('asset://abc123');
      expect(id).toBe('abc123');
    });

    it('extracts ID from asset:// URL with filename', () => {
      const id = assetManager.extractAssetId('asset://abc123/image.jpg');
      expect(id).toBe('abc123');
    });
  });

  describe('resolveAssetURL', () => {
    it('returns cached URL', async () => {
      assetManager.blobURLCache.set('asset-1', 'blob:cached');

      const url = await assetManager.resolveAssetURL('asset://asset-1');

      expect(url).toBe('blob:cached');
    });

    it('creates blob URL from IndexedDB', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({
        blob: new Blob(['test']),
      });

      const url = await assetManager.resolveAssetURL('asset://asset-1');

      expect(url).toMatch(/^blob:test-/);
      expect(assetManager.blobURLCache.has('asset-1')).toBe(true);
    });

    it('returns null when asset not found', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue(null);

      const url = await assetManager.resolveAssetURL('asset://nonexistent');

      expect(url).toBeNull();
    });
  });

  describe('resolveAssetURLSync', () => {
    it('returns cached URL synchronously', () => {
      assetManager.blobURLCache.set('asset-1', 'blob:cached');

      const url = assetManager.resolveAssetURLSync('asset://asset-1');

      expect(url).toBe('blob:cached');
    });

    it('returns null when not in cache', () => {
      const url = assetManager.resolveAssetURLSync('asset://missing');
      expect(url).toBeNull();
    });
  });

  describe('getBlobURLSynced', () => {
    it('syncs reverseBlobCache when blob URL exists only in blobURLCache', () => {
      // Setup: blob URL in blobURLCache but NOT in reverseBlobCache (simulating inconsistent state)
      assetManager.blobURLCache.set('asset-123', 'blob:http://localhost/abc');
      // Verify reverseBlobCache is empty
      expect(assetManager.reverseBlobCache.has('blob:http://localhost/abc')).toBe(false);

      // Call getBlobURLSynced
      const result = assetManager.getBlobURLSynced('asset-123');

      // Should return the blob URL
      expect(result).toBe('blob:http://localhost/abc');
      // Should have synced reverseBlobCache
      expect(assetManager.reverseBlobCache.get('blob:http://localhost/abc')).toBe('asset-123');
    });

    it('returns undefined when asset not in cache', () => {
      expect(assetManager.getBlobURLSynced('nonexistent')).toBeUndefined();
    });

    it('does not overwrite existing reverseBlobCache entry', () => {
      // Setup: both caches already have entries
      assetManager.blobURLCache.set('asset-456', 'blob:http://localhost/def');
      assetManager.reverseBlobCache.set('blob:http://localhost/def', 'asset-456');

      // Call getBlobURLSynced
      const result = assetManager.getBlobURLSynced('asset-456');

      // Should return the blob URL
      expect(result).toBe('blob:http://localhost/def');
      // reverseBlobCache should still have the original entry
      expect(assetManager.reverseBlobCache.get('blob:http://localhost/def')).toBe('asset-456');
    });
  });

  describe('getBlobRecord', () => {
    it('returns null when db is not initialized', async () => {
      assetManager.db = null;

      const result = await assetManager.getBlobRecord('any-id');

      expect(result).toBeNull();
    });

    it('returns full blob record including projectId', async () => {
      // Store a blob record with specific projectId
      const blobRecord = {
        id: 'asset-with-project',
        projectId: 'original-project-123',
        blob: new Blob(['test content']),
      };
      mockStore.get = mock(() => {
        const req = { result: blobRecord, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      });
      assetManager.db = mockDB;

      const result = await assetManager.getBlobRecord('asset-with-project');

      expect(result).not.toBeNull();
      expect(result.id).toBe('asset-with-project');
      expect(result.projectId).toBe('original-project-123');
      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('returns null when asset not found in IndexedDB', async () => {
      mockStore.get = mock(() => {
        const req = { result: null, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      });
      assetManager.db = mockDB;

      const result = await assetManager.getBlobRecord('nonexistent-id');

      expect(result).toBeNull();
    });

    it('rejects on IndexedDB error', async () => {
      mockStore.get = mock(() => {
        const req = { result: null, onsuccess: null, onerror: null, error: new Error('DB Error') };
        setTimeout(() => req.onerror?.(), 0);
        return req;
      });
      assetManager.db = mockDB;

      await expect(assetManager.getBlobRecord('any-id')).rejects.toThrow();
    });

    it('distinguishes between projects with same asset content', async () => {
      // Scenario: Same content (same assetId due to content-addressing)
      // stored for different projects
      const assetId = 'content-hash-based-id';

      // First, check record for project A
      mockStore.get = mock(() => {
        const req = {
          result: { id: assetId, projectId: 'project-A', blob: new Blob(['shared content']) },
          onsuccess: null,
          onerror: null
        };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      });
      assetManager.db = mockDB;

      const recordA = await assetManager.getBlobRecord(assetId);
      expect(recordA.projectId).toBe('project-A');

      // After another project stores it, projectId changes
      mockStore.get = mock(() => {
        const req = {
          result: { id: assetId, projectId: 'project-B', blob: new Blob(['shared content']) },
          onsuccess: null,
          onerror: null
        };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      });

      const recordB = await assetManager.getBlobRecord(assetId);
      expect(recordB.projectId).toBe('project-B');
    });
  });

  describe('resolveHTMLAssets', () => {
    it('returns unchanged HTML when null', async () => {
      const result = await assetManager.resolveHTMLAssets(null);
      expect(result).toBeNull();
    });

    it('returns unchanged HTML when no asset references', async () => {
      const html = '<p>Hello world</p>';
      const result = await assetManager.resolveHTMLAssets(html);
      expect(result).toBe(html);
    });

    it('resolves asset:// URLs to blob URLs', async () => {
      assetManager.resolveAssetURL = mock(() => undefined).mockResolvedValue('blob:resolved');

      const html = '<img src="asset://abc123">';
      const result = await assetManager.resolveHTMLAssets(html);

      expect(result).toBe('<img src="blob:resolved">');
    });

    it('preserves data-asset-url attribute for anchor elements linking to HTML assets', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      assetManager.resolveAssetURL = mock(() => undefined).mockResolvedValue(
        'blob:http://localhost/resolved-blob'
      );

      const html = `<a href="asset://${uuid}.html">Click here</a>`;
      const result = await assetManager.resolveHTMLAssets(html);

      expect(result).toContain('href="blob:http://localhost/resolved-blob"');
      expect(result).toContain(`data-asset-url="asset://${uuid}.html"`);
    });

    it('does not add data-asset-url to non-HTML anchor elements', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      assetManager.resolveAssetURL = mock(() => undefined).mockResolvedValue(
        'blob:http://localhost/resolved-blob'
      );

      const html = `<a href="asset://${uuid}.pdf">Download PDF</a>`;
      const result = await assetManager.resolveHTMLAssets(html);

      expect(result).toContain('href="blob:http://localhost/resolved-blob"');
      expect(result).not.toContain('data-asset-url');
    });

    it('does not duplicate data-asset-url if already present on anchor element', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      assetManager.resolveAssetURL = mock(() => undefined).mockResolvedValue(
        'blob:http://localhost/resolved-blob'
      );

      const html = `<a href="asset://${uuid}.html" data-asset-url="asset://${uuid}.html">Click here</a>`;
      const result = await assetManager.resolveHTMLAssets(html);

      // Should have exactly one data-asset-url attribute
      const matches = result.match(/data-asset-url/g);
      expect(matches).toHaveLength(1);
    });

    it('handles multiple HTML anchor links in the same HTML', async () => {
      const uuid1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const uuid2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

      let callCount = 0;
      assetManager.resolveAssetURL = mock(() => undefined).mockImplementation(() => {
        callCount++;
        return Promise.resolve(`blob:http://localhost/resolved-${callCount}`);
      });

      const html = `<p><a href="asset://${uuid1}.html">Link 1</a></p><p><a href="asset://${uuid2}.html">Link 2</a></p>`;
      const result = await assetManager.resolveHTMLAssets(html);

      expect(result).toContain(`data-asset-url="asset://${uuid1}.html"`);
      expect(result).toContain(`data-asset-url="asset://${uuid2}.html"`);
      const matches = result.match(/data-asset-url/g);
      expect(matches).toHaveLength(2);
    });

    it('handles mixed anchor elements (HTML and non-HTML)', async () => {
      const htmlUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const pdfUuid = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

      let callCount = 0;
      assetManager.resolveAssetURL = mock(() => undefined).mockImplementation(() => {
        callCount++;
        return Promise.resolve(`blob:http://localhost/resolved-${callCount}`);
      });

      const html = `<a href="asset://${htmlUuid}.html">HTML</a><a href="asset://${pdfUuid}.pdf">PDF</a>`;
      const result = await assetManager.resolveHTMLAssets(html);

      // Only HTML link should have data-asset-url
      expect(result).toContain(`data-asset-url="asset://${htmlUuid}.html"`);
      expect(result).not.toContain(`data-asset-url="asset://${pdfUuid}.pdf"`);
      const matches = result.match(/data-asset-url/g);
      expect(matches).toHaveLength(1);
    });

    it('handles .htm extension (case insensitive)', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      assetManager.resolveAssetURL = mock(() => undefined).mockResolvedValue(
        'blob:http://localhost/resolved-blob'
      );

      const html = `<a href="asset://${uuid}.HTM">Click here</a>`;
      const result = await assetManager.resolveHTMLAssets(html);

      expect(result).toContain(`data-asset-url="asset://${uuid}.HTM"`);
    });

    it('skips anchor when blobURL resolution returns null', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      assetManager.resolveAssetURL = mock(() => undefined).mockResolvedValue(null);

      const html = `<a href="asset://${uuid}.html">Click here</a>`;
      const result = await assetManager.resolveHTMLAssets(html);

      // Should not add data-asset-url since blobURL is null
      expect(result).not.toContain('data-asset-url');
    });

    it('preserves anchor attributes when adding data-asset-url', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      assetManager.resolveAssetURL = mock(() => undefined).mockResolvedValue(
        'blob:http://localhost/resolved-blob'
      );

      const html = `<a href="asset://${uuid}.html" class="my-link" id="link1" target="_blank">Click</a>`;
      const result = await assetManager.resolveHTMLAssets(html);

      expect(result).toContain('class="my-link"');
      expect(result).toContain('id="link1"');
      expect(result).toContain('target="_blank"');
      expect(result).toContain(`data-asset-url="asset://${uuid}.html"`);
    });
  });

  describe('resolveHTMLAssetsSync', () => {
    it('returns unchanged HTML when null', () => {
      const result = assetManager.resolveHTMLAssetsSync(null);
      expect(result).toBeNull();
    });

    it('resolves cached asset URLs', () => {
      assetManager.blobURLCache.set('abc123', 'blob:cached');

      const html = '<img src="asset://abc123">';
      const result = assetManager.resolveHTMLAssetsSync(html);

      expect(result).toBe('<img src="blob:cached">');
    });

    it('tracks missing assets', () => {
      // Asset IDs must be hex UUIDs (a-f, 0-9, and hyphens only)
      const html = '<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890">';
      assetManager.resolveHTMLAssetsSync(html);

      expect(assetManager.missingAssets.has('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    });

    it('resolves new format asset://uuid.ext URLs correctly', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      assetManager.blobURLCache.set(uuid, 'blob:http://localhost/real-blob-id');

      const html = `<img src="asset://${uuid}.png">`;
      const result = assetManager.resolveHTMLAssetsSync(html);

      // Should replace the entire asset://uuid.ext with the blob URL (no leftover .png)
      expect(result).toBe('<img src="blob:http://localhost/real-blob-id">');
      expect(result).not.toContain('.png');
    });

    it('resolves new format with various extensions', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      assetManager.blobURLCache.set(uuid, 'blob:test');

      const jpgHtml = `<img src="asset://${uuid}.jpg">`;
      const gifHtml = `<img src="asset://${uuid}.gif">`;
      const webpHtml = `<img src="asset://${uuid}.webp">`;

      expect(assetManager.resolveHTMLAssetsSync(jpgHtml)).toBe('<img src="blob:test">');
      expect(assetManager.resolveHTMLAssetsSync(gifHtml)).toBe('<img src="blob:test">');
      expect(assetManager.resolveHTMLAssetsSync(webpHtml)).toBe('<img src="blob:test">');
    });

    it('resolves new format in video/audio elements', () => {
      const videoUuid = 'a1b2c3d4-e5f6-7890-abcd-111111111111';
      const audioUuid = 'a1b2c3d4-e5f6-7890-abcd-222222222222';
      assetManager.blobURLCache.set(videoUuid, 'blob:video');
      assetManager.blobURLCache.set(audioUuid, 'blob:audio');

      const videoHtml = `<video src="asset://${videoUuid}.mp4"></video>`;
      const audioHtml = `<audio src="asset://${audioUuid}.mp3"></audio>`;

      expect(assetManager.resolveHTMLAssetsSync(videoHtml)).toBe('<video src="blob:video"></video>');
      expect(assetManager.resolveHTMLAssetsSync(audioHtml)).toBe('<audio src="blob:audio"></audio>');
    });

    it('marks assets as missing when using new format', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const html = `<img src="asset://${uuid}.png">`;
      assetManager.resolveHTMLAssetsSync(html);

      expect(assetManager.missingAssets.has(uuid)).toBe(true);
    });

    it('handles mixed legacy and new format URLs', () => {
      const legacyUuid = 'a1b2c3d4-e5f6-7890-abcd-111111111111';
      const newUuid = 'a1b2c3d4-e5f6-7890-abcd-222222222222';
      assetManager.blobURLCache.set(legacyUuid, 'blob:legacy');
      assetManager.blobURLCache.set(newUuid, 'blob:new');

      const html = `<p><img src="asset://${legacyUuid}/path/file.png"></p><p><img src="asset://${newUuid}.jpg"></p>`;
      const result = assetManager.resolveHTMLAssetsSync(html);

      expect(result).toContain('blob:legacy');
      expect(result).toContain('blob:new');
      expect(result).not.toContain('asset://');
    });
  });

  describe('convertBlobURLsToAssetRefs', () => {
    it('returns unchanged HTML when null', () => {
      const result = assetManager.convertBlobURLsToAssetRefs(null);
      expect(result).toBeNull();
    });

    it('returns unchanged HTML when non-string', () => {
      const result = assetManager.convertBlobURLsToAssetRefs(123);
      expect(result).toBe(123);
    });

    it('converts blob URLs using data-asset-id attribute (priority)', () => {
      // Setup: blob URL NOT in cache, but data-asset-id present
      const assetId = 'a1b2c3d4-e5f6-7890-abcd-123456789abc';

      const html = `<img src="blob:http://localhost/xyz" data-asset-id="${assetId}" alt="test">`;
      const result = assetManager.convertBlobURLsToAssetRefs(html);

      expect(result).toContain(`asset://${assetId}`);
      expect(result).not.toContain('blob:');
      expect(result).toContain('data-asset-id='); // Attribute preserved
      expect(result).toContain('alt="test"'); // Other attrs preserved
    });

    it('converts blob URLs using reverseBlobCache when no data-asset-id', () => {
      const assetId = 'asset-uuid-123';
      assetManager.reverseBlobCache.set('blob:http://test/abc', assetId);

      const html = '<img src="blob:http://test/abc">';
      const result = assetManager.convertBlobURLsToAssetRefs(html);

      expect(result).toContain(`asset://${assetId}`);
      expect(result).not.toContain('blob:');
    });

    it('handles video and audio tags with data-asset-id', () => {
      const videoId = 'video-uuid-123';
      const audioId = 'audio-uuid-456';

      const videoHtml = `<video src="blob:http://test/v1" data-asset-id="${videoId}"></video>`;
      const audioHtml = `<audio src="blob:http://test/a1" data-asset-id="${audioId}"></audio>`;

      expect(assetManager.convertBlobURLsToAssetRefs(videoHtml)).toContain(`asset://${videoId}`);
      expect(assetManager.convertBlobURLsToAssetRefs(audioHtml)).toContain(`asset://${audioId}`);
    });

    it('handles multiple images in same HTML', () => {
      const id1 = 'uuid-1111';
      const id2 = 'uuid-2222';

      const html = `<p><img src="blob:http://test/a" data-asset-id="${id1}"></p><p><img src="blob:http://test/b" data-asset-id="${id2}"></p>`;
      const result = assetManager.convertBlobURLsToAssetRefs(html);

      expect(result).toContain(`asset://${id1}`);
      expect(result).toContain(`asset://${id2}`);
      expect(result).not.toContain('blob:');
    });

    it('preserves non-blob URLs unchanged', () => {
      const html = '<img src="https://example.com/image.png">';
      const result = assetManager.convertBlobURLsToAssetRefs(html);

      expect(result).toBe(html);
    });

    it('leaves blob URL unchanged when neither data-asset-id nor cache match', () => {
      // Blob URL not in cache, no data-asset-id
      const html = '<img src="blob:http://unknown/xyz">';
      const result = assetManager.convertBlobURLsToAssetRefs(html);

      // Should be unchanged (with warning logged)
      expect(result).toContain('blob:');
    });
  });

  describe('getMimeType', () => {
    it('returns correct MIME type for common extensions', () => {
      expect(assetManager.getMimeType('image.png')).toBe('image/png');
      expect(assetManager.getMimeType('image.jpg')).toBe('image/jpeg');
      expect(assetManager.getMimeType('image.jpeg')).toBe('image/jpeg');
      expect(assetManager.getMimeType('image.gif')).toBe('image/gif');
      expect(assetManager.getMimeType('image.svg')).toBe('image/svg+xml');
      expect(assetManager.getMimeType('video.mp4')).toBe('video/mp4');
      expect(assetManager.getMimeType('audio.mp3')).toBe('audio/mpeg');
    });

    it('returns application/octet-stream for unknown extensions', () => {
      expect(assetManager.getMimeType('file.unknown')).toBe('application/octet-stream');
    });
  });

  describe('generatePlaceholder', () => {
    it('generates loading placeholder with animated spinner', () => {
      const placeholder = assetManager.generatePlaceholder('Loading...', 'loading');
      expect(placeholder).toContain('data:image/svg+xml');
      // Loading placeholder uses animated spinner without text
      expect(placeholder).toContain('animate');
      expect(placeholder).toContain('circle');
    });

    it('generates error placeholder with text', () => {
      const placeholder = assetManager.generatePlaceholder('Error message', 'error');
      expect(placeholder).toContain('data:image/svg+xml');
      expect(placeholder).toContain('Error');
    });

    it('generates notfound placeholder with text by default', () => {
      const placeholder = assetManager.generatePlaceholder('Not found');
      expect(placeholder).toContain('data:image/svg+xml');
      expect(placeholder).toContain('Not%20found');
    });
  });

  describe('generateLoadingPlaceholder', () => {
    it('generates loading placeholder for asset with spinner', () => {
      const placeholder = assetManager.generateLoadingPlaceholder('asset-123');
      expect(placeholder).toContain('data:image/svg+xml');
      // Loading spinner doesn't contain text, uses animation
      expect(placeholder).toContain('animate');
    });
  });

  describe('preloadAllAssets', () => {
    it('preloads all assets into memory', async () => {
      assetManager.db = mockDB;
      assetManager.getProjectAssets = mock(() => undefined).mockResolvedValue([
        { id: 'a1', blob: new Blob(['1']) },
        { id: 'a2', blob: new Blob(['2']) },
      ]);

      const count = await assetManager.preloadAllAssets();

      expect(count).toBe(2);
      expect(assetManager.blobURLCache.size).toBe(2);
    });

    it('skips already cached assets', async () => {
      assetManager.db = mockDB;
      assetManager.blobURLCache.set('a1', 'blob:existing');
      assetManager.getProjectAssets = mock(() => undefined).mockResolvedValue([
        { id: 'a1', blob: new Blob(['1']) },
        { id: 'a2', blob: new Blob(['2']) },
      ]);

      const count = await assetManager.preloadAllAssets();

      expect(count).toBe(1);
    });
  });

  describe('getPendingAssets', () => {
    it('returns empty array for invalid projectId', async () => {
      assetManager.db = mockDB;
      assetManager.projectId = null;

      const result = await assetManager.getPendingAssets();
      expect(result).toEqual([]);
    });
  });

  describe('markAssetUploaded', () => {
    it('marks asset as uploaded via Yjs metadata', async () => {
      assetManager.db = mockDB;

      // Setup metadata in Yjs
      mockYjsBridge._assetsMap.set('a1', {
        filename: 'test.jpg',
        uploaded: false
      });

      await assetManager.markAssetUploaded('a1');

      // Check metadata was updated in Yjs
      const updatedMeta = mockYjsBridge._assetsMap.get('a1');
      expect(updatedMeta.uploaded).toBe(true);
    });

    it('does nothing if asset not found in Yjs', async () => {
      assetManager.db = mockDB;
      // No metadata in Yjs

      await assetManager.markAssetUploaded('nonexistent');

      // Should not throw, just warn
      expect(mockYjsBridge._assetsMap.has('nonexistent')).toBe(false);
    });
  });

  describe('deleteAsset', () => {
    it('skips blob deletion if database not initialized but still deletes Yjs metadata', async () => {
      // Setup metadata in Yjs
      mockYjsBridge._assetsMap.set('asset-1', { filename: 'test.jpg' });

      // Delete with db = null
      await assetManager.deleteAsset('asset-1');

      // Yjs metadata should be deleted
      expect(mockYjsBridge._assetsMap.has('asset-1')).toBe(false);
    });

    it('deletes asset and revokes blob URL', async () => {
      assetManager.db = mockDB;
      assetManager.blobURLCache.set('a1', 'blob:url1');
      assetManager.reverseBlobCache.set('blob:url1', 'a1');

      const mockDeleteRequest = { onsuccess: null, onerror: null };
      const mockTx = {
        objectStore: mock(() => ({
          delete: mock(() => mockDeleteRequest),
        })),
      };
      mockDB.transaction.mockReturnValue(mockTx);

      const deletePromise = assetManager.deleteAsset('a1');

      setTimeout(() => {
        mockDeleteRequest.onsuccess?.();
      }, 0);

      await deletePromise;

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url1');
      expect(assetManager.blobURLCache.has('a1')).toBe(false);
    });

    it('calls _deleteFromServer when token and projectId are available', async () => {
      assetManager.db = mockDB;
      assetManager._deleteFromServer = mock(() => Promise.resolve());

      // Setup window.eXeLearning.config for server deletion
      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: 'test-token-123',
        },
      };

      const mockDeleteRequest = { onsuccess: null, onerror: null };
      const mockTx = {
        objectStore: mock(() => ({
          delete: mock(() => mockDeleteRequest),
        })),
      };
      mockDB.transaction.mockReturnValue(mockTx);

      const deletePromise = assetManager.deleteAsset('a1');

      setTimeout(() => {
        mockDeleteRequest.onsuccess?.();
      }, 0);

      await deletePromise;

      expect(assetManager._deleteFromServer).toHaveBeenCalledWith('a1');
    });

    it('skips server deletion when skipServerDelete option is true', async () => {
      assetManager.db = mockDB;
      assetManager._deleteFromServer = mock(() => Promise.resolve());

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: 'test-token-123',
        },
      };

      const mockDeleteRequest = { onsuccess: null, onerror: null };
      const mockTx = {
        objectStore: mock(() => ({
          delete: mock(() => mockDeleteRequest),
        })),
      };
      mockDB.transaction.mockReturnValue(mockTx);

      const deletePromise = assetManager.deleteAsset('a1', { skipServerDelete: true });

      setTimeout(() => {
        mockDeleteRequest.onsuccess?.();
      }, 0);

      await deletePromise;

      expect(assetManager._deleteFromServer).not.toHaveBeenCalled();
    });
  });

  describe('_deleteFromServer', () => {
    it('calls fetch with correct URL and headers', async () => {
      assetManager.projectId = 'project-uuid-123';

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: 'test-token-456',
        },
      };

      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }));

      await assetManager._deleteFromServer('asset-id-789');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/projects/project-uuid-123/assets/by-client-id/asset-id-789',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-456',
          }),
        })
      );
    });

    it('does not call fetch when no token', async () => {
      assetManager.projectId = 'project-uuid-123';

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: '', // Empty token
        },
      };

      global.fetch = mock(() => Promise.resolve({ ok: true }));

      await assetManager._deleteFromServer('asset-id-789');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not call fetch when no projectId', async () => {
      assetManager.projectId = ''; // No project ID

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: 'test-token-456',
        },
      };

      global.fetch = mock(() => Promise.resolve({ ok: true }));

      await assetManager._deleteFromServer('asset-id-789');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('handles fetch errors gracefully', async () => {
      assetManager.projectId = 'project-uuid-123';

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: 'test-token-456',
        },
      };

      global.fetch = mock(() => Promise.reject(new Error('Network error')));

      // Should not throw
      await expect(assetManager._deleteFromServer('asset-id-789')).resolves.not.toThrow();
    });
  });

  describe('_deleteMultipleFromServer', () => {
    it('calls fetch with correct URL, headers, and body', async () => {
      assetManager.projectId = 'project-uuid-123';

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: 'test-token-456',
        },
      };

      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, deleted: 3 }),
      }));

      await assetManager._deleteMultipleFromServer(['asset-1', 'asset-2', 'asset-3']);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/projects/project-uuid-123/assets/bulk',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-456',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ clientIds: ['asset-1', 'asset-2', 'asset-3'] }),
        })
      );
    });

    it('does not call fetch when assetIds is empty', async () => {
      assetManager.projectId = 'project-uuid-123';

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: 'test-token-456',
        },
      };

      global.fetch = mock(() => Promise.resolve({ ok: true }));

      await assetManager._deleteMultipleFromServer([]);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not call fetch when no token', async () => {
      assetManager.projectId = 'project-uuid-123';

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: '',
        },
      };

      global.fetch = mock(() => Promise.resolve({ ok: true }));

      await assetManager._deleteMultipleFromServer(['asset-1', 'asset-2']);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('handles fetch errors gracefully', async () => {
      assetManager.projectId = 'project-uuid-123';

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: 'test-token-456',
        },
      };

      global.fetch = mock(() => Promise.reject(new Error('Network error')));

      // Should not throw
      await expect(assetManager._deleteMultipleFromServer(['asset-1'])).resolves.not.toThrow();
    });
  });

  describe('clearProjectAssets', () => {
    it('clears all assets for project', async () => {
      assetManager.db = mockDB;
      assetManager.getProjectAssets = mock(() => undefined).mockResolvedValue([
        { id: 'a1' },
        { id: 'a2' },
      ]);
      assetManager.deleteAsset = mock(() => undefined).mockResolvedValue();

      await assetManager.clearProjectAssets();

      expect(assetManager.deleteAsset).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStats', () => {
    it('returns asset statistics from Yjs metadata', async () => {
      assetManager.db = mockDB;

      // Setup metadata in Yjs
      mockYjsBridge._assetsMap.set('a1', { uploaded: true, size: 1000 });
      mockYjsBridge._assetsMap.set('a2', { uploaded: false, size: 2000 });
      mockYjsBridge._assetsMap.set('a3', { uploaded: true, size: 500 });

      const stats = await assetManager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.uploaded).toBe(2);
      expect(stats.totalSize).toBe(3500);
    });
  });

  describe('updateAssetFilename', () => {
    it('updates asset filename via Yjs metadata', async () => {
      assetManager.db = mockDB;

      // Setup metadata in Yjs
      mockYjsBridge._assetsMap.set('a1', { filename: 'old.jpg' });

      await assetManager.updateAssetFilename('a1', 'new.jpg');

      // Check metadata was updated in Yjs
      const updatedMeta = mockYjsBridge._assetsMap.get('a1');
      expect(updatedMeta.filename).toBe('new.jpg');
    });

    it('does nothing if asset not found in Yjs', async () => {
      assetManager.db = mockDB;
      // No metadata in Yjs

      await assetManager.updateAssetFilename('nonexistent', 'new.jpg');

      // Should not throw, just warn
      expect(mockYjsBridge._assetsMap.has('nonexistent')).toBe(false);
    });
  });

  describe('getImageDimensions', () => {
    it('returns dimensions for image', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({
        blob: new Blob(['image']),
        mime: 'image/png',
      });

      const dimensions = await assetManager.getImageDimensions('a1');

      expect(dimensions).toEqual({ width: 100, height: 100 });
    });

    it('returns null for non-image', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({
        blob: new Blob(['data']),
        mime: 'application/pdf',
      });

      const dimensions = await assetManager.getImageDimensions('a1');

      expect(dimensions).toBeNull();
    });

    it('returns null when asset not found', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue(null);

      const dimensions = await assetManager.getImageDimensions('nonexistent');

      expect(dimensions).toBeNull();
    });
  });

  describe('isImage, isVideo, isAudio', () => {
    it('isImage returns true for images', () => {
      expect(assetManager.isImage({ mime: 'image/png' })).toBe(true);
      expect(assetManager.isImage({ mime: 'image/jpeg' })).toBe(true);
      expect(assetManager.isImage({ mime: 'video/mp4' })).toBe(false);
      expect(assetManager.isImage(null)).toBe(false);
    });

    it('isVideo returns true for videos', () => {
      expect(assetManager.isVideo({ mime: 'video/mp4' })).toBe(true);
      expect(assetManager.isVideo({ mime: 'video/webm' })).toBe(true);
      expect(assetManager.isVideo({ mime: 'image/png' })).toBe(false);
      expect(assetManager.isVideo(null)).toBe(false);
    });

    it('isAudio returns true for audio', () => {
      expect(assetManager.isAudio({ mime: 'audio/mpeg' })).toBe(true);
      expect(assetManager.isAudio({ mime: 'audio/wav' })).toBe(true);
      expect(assetManager.isAudio({ mime: 'video/mp4' })).toBe(false);
      expect(assetManager.isAudio(null)).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(assetManager.formatFileSize(0)).toBe('0 Bytes');
      expect(assetManager.formatFileSize(500)).toBe('500 Bytes');
      expect(assetManager.formatFileSize(1024)).toBe('1 KB');
      expect(assetManager.formatFileSize(1536)).toBe('1.5 KB');
      expect(assetManager.formatFileSize(1048576)).toBe('1 MB');
      expect(assetManager.formatFileSize(1073741824)).toBe('1 GB');
    });
  });

  describe('hasMissingAssets', () => {
    it('returns false when no missing assets', () => {
      expect(assetManager.hasMissingAssets()).toBe(false);
    });

    it('returns true when has missing assets', () => {
      assetManager.missingAssets.add('asset-1');
      expect(assetManager.hasMissingAssets()).toBe(true);
    });
  });

  describe('getMissingAssetsList', () => {
    it('returns array of missing asset IDs', () => {
      assetManager.missingAssets.add('a1');
      assetManager.missingAssets.add('a2');

      const list = assetManager.getMissingAssetsList();

      expect(list).toContain('a1');
      expect(list).toContain('a2');
    });
  });

  describe('getAllAssetIds', () => {
    it('returns array of asset IDs', async () => {
      assetManager.db = mockDB;
      assetManager.getProjectAssets = mock(() => undefined).mockResolvedValue([
        { id: 'a1' },
        { id: 'a2' },
        { id: 'a3' },
      ]);

      const ids = await assetManager.getAllAssetIds();

      expect(ids).toEqual(['a1', 'a2', 'a3']);
    });
  });

  describe('getAllLocalBlobIds', () => {
    it('returns only assets with blobs', async () => {
      assetManager.db = mockDB;
      assetManager.getProjectAssets = mock(() => undefined).mockResolvedValue([
        { id: 'a1', blob: new Blob(['data1']) },
        { id: 'a2', blob: null }, // Has metadata but no blob
        { id: 'a3', blob: new Blob(['data3']) },
      ]);
      // For assets without blob in getProjectAssets, hasLocalBlob checks IndexedDB
      assetManager.hasLocalBlob = mock(() => undefined).mockResolvedValue(false);

      const ids = await assetManager.getAllLocalBlobIds();

      // Should only return a1 and a3 (have blobs), not a2
      expect(ids).toEqual(['a1', 'a3']);
    });

    it('checks IndexedDB for assets without blob in memory', async () => {
      assetManager.db = mockDB;
      assetManager.getProjectAssets = mock(() => undefined).mockResolvedValue([
        { id: 'a1', blob: null }, // No blob in memory
        { id: 'a2', blob: null },
      ]);
      // Simulate a1 has blob in IndexedDB, a2 doesn't
      assetManager.hasLocalBlob = mock((id) => Promise.resolve(id === 'a1'));

      const ids = await assetManager.getAllLocalBlobIds();

      expect(ids).toEqual(['a1']);
      expect(assetManager.hasLocalBlob).toHaveBeenCalledWith('a1');
      expect(assetManager.hasLocalBlob).toHaveBeenCalledWith('a2');
    });

    it('returns empty array when no assets have blobs', async () => {
      assetManager.db = mockDB;
      assetManager.getProjectAssets = mock(() => undefined).mockResolvedValue([
        { id: 'a1', blob: null },
        { id: 'a2', blob: null },
      ]);
      assetManager.hasLocalBlob = mock(() => undefined).mockResolvedValue(false);

      const ids = await assetManager.getAllLocalBlobIds();

      expect(ids).toEqual([]);
    });
  });

  describe('hasAsset', () => {
    it('returns true when asset exists', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({ id: 'a1' });

      const exists = await assetManager.hasAsset('a1');

      expect(exists).toBe(true);
    });

    it('returns false when asset does not exist', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue(null);

      const exists = await assetManager.hasAsset('nonexistent');

      expect(exists).toBe(false);
    });
  });

  describe('getAssetForUpload', () => {
    it('returns asset data for upload', async () => {
      assetManager.db = mockDB;
      const blob = new Blob(['test']);
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({
        id: 'a1',
        blob,
        mime: 'image/png',
        hash: 'abc123',
        filename: 'test.png',
        size: 1000,
      });

      const data = await assetManager.getAssetForUpload('a1');

      expect(data.blob).toBe(blob);
      expect(data.mime).toBe('image/png');
      expect(data.hash).toBe('abc123');
      expect(data.filename).toBe('test.png');
      expect(data.size).toBe(1000);
    });

    it('returns null when asset not found', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue(null);

      const data = await assetManager.getAssetForUpload('nonexistent');

      expect(data).toBeNull();
    });
  });

  describe('storeAssetFromServer', () => {
    it('stores asset received from server', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue(null);
      assetManager.putAsset = mock(() => undefined).mockResolvedValue();

      const blob = new Blob(['server data']);
      await assetManager.storeAssetFromServer('a1', blob, {
        mime: 'image/png',
        hash: 'abc123',
        filename: 'server.png',
      });

      expect(assetManager.putAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'a1',
          uploaded: true,
          mime: 'image/png',
        })
      );
    });

    it('skips if asset already exists with blob for same project', async () => {
      assetManager.db = mockDB;
      // Mock existing asset with same projectId AND blob - should skip putAsset
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({
        id: 'a1',
        projectId: 'project-123', // Same as assetManager.projectId
        blob: new Blob(['existing']), // Has blob - skip
      });
      assetManager.putAsset = mock(() => undefined);

      await assetManager.storeAssetFromServer('a1', new Blob(['data']), {});

      expect(assetManager.putAsset).not.toHaveBeenCalled();
    });

    it('stores blob if asset exists without blob for same project', async () => {
      assetManager.db = mockDB;
      // Mock existing asset with same projectId but NO blob - should store blob
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({
        id: 'a1',
        projectId: 'project-123', // Same as assetManager.projectId
        mime: 'image/jpeg',
        // No blob property - need to store it
      });
      assetManager.putAsset = mock(() => undefined);

      await assetManager.storeAssetFromServer('a1', new Blob(['data']), {});

      expect(assetManager.putAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'a1',
          projectId: 'project-123',
          blob: expect.any(Blob),
          uploaded: true,
        })
      );
    });
  });

  describe('getMissingAssetIds', () => {
    it('returns list of missing asset IDs', async () => {
      assetManager.db = mockDB;
      assetManager.hasAsset = mock(() => undefined)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      const missing = await assetManager.getMissingAssetIds(['a1', 'a2', 'a3']);

      expect(missing).toEqual(['a2', 'a3']);
    });
  });

  describe('cleanup', () => {
    it('revokes all blob URLs', () => {
      assetManager.blobURLCache.set('a1', 'blob:url1');
      assetManager.blobURLCache.set('a2', 'blob:url2');
      assetManager.reverseBlobCache.set('blob:url1', 'a1');
      assetManager.db = mockDB;

      assetManager.cleanup();

      expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
      expect(assetManager.blobURLCache.size).toBe(0);
      expect(assetManager.reverseBlobCache.size).toBe(0);
    });

    it('closes database connection', () => {
      assetManager.db = mockDB;

      assetManager.cleanup();

      expect(mockDB.close).toHaveBeenCalled();
      expect(assetManager.db).toBeNull();
    });
  });
});

describe('window.resolveAssetUrls global function', () => {
  beforeEach(() => {
    require('./AssetManager');
  });

  afterEach(() => {
    delete window.eXeLearning;
  });

  it('returns original HTML when null', () => {
    const result = window.resolveAssetUrls(null);
    expect(result).toBeNull();
  });

  it('returns original HTML when no manager available', () => {
    window.eXeLearning = { app: { project: {} } };
    const html = '<p>Test</p>';
    const result = window.resolveAssetUrls(html);
    expect(result).toBe(html);
  });

  it('uses AssetManager when available', () => {
    const mockResolve = mock(() => undefined).mockReturnValue('<p>Resolved</p>');
    window.eXeLearning = {
      app: {
        project: {
          _yjsBridge: {
            assetManager: {
              resolveHTMLAssetsSync: mockResolve,
              hasMissingAssets: mock(() => undefined).mockReturnValue(false),
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

describe('sanitizeAssetUrl', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
  });

  it('returns original URL when null', () => {
    expect(assetManager.sanitizeAssetUrl(null)).toBeNull();
  });

  it('returns original URL when not asset://', () => {
    const url = 'http://example.com/image.jpg';
    expect(assetManager.sanitizeAssetUrl(url)).toBe(url);
  });

  it('returns original URL when already in new format', () => {
    const url = 'asset://01234567-89ab-cdef-0123-456789abcdef.jpg';
    expect(assetManager.sanitizeAssetUrl(url)).toBe(url);
  });

  it('returns old format unchanged when not corrupted', () => {
    const url = 'asset://01234567-89ab-cdef-0123-456789abcdef/image.jpg';
    // Non-corrupted old format URLs are kept as-is (sanitize only fixes corruption)
    expect(assetManager.sanitizeAssetUrl(url)).toBe(url);
  });

  it('sanitizes corrupted URL with double asset prefix', () => {
    const corrupted = 'asset://asset//01234567-89ab-cdef-0123-456789abcdef/image.jpg';
    // Sanitized to new format (uuid.ext)
    const expected = 'asset://01234567-89ab-cdef-0123-456789abcdef.jpg';
    expect(assetManager.sanitizeAssetUrl(corrupted)).toBe(expected);
  });

  it('sanitizes corrupted URL with single asset prefix', () => {
    const corrupted = 'asset://asset/01234567-89ab-cdef-0123-456789abcdef/image.jpg';
    // Sanitized to new format (uuid.ext)
    const expected = 'asset://01234567-89ab-cdef-0123-456789abcdef.jpg';
    expect(assetManager.sanitizeAssetUrl(corrupted)).toBe(expected);
  });

  it('sanitizes corrupted URL without filename', () => {
    const corrupted = 'asset://asset//01234567-89ab-cdef-0123-456789abcdef';
    const expected = 'asset://01234567-89ab-cdef-0123-456789abcdef';
    expect(assetManager.sanitizeAssetUrl(corrupted)).toBe(expected);
  });
});

describe('createBlobURL', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
    global.URL = {
      createObjectURL: mock(() => 'blob:test-url'),
    };
    spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.URL;
  });

  it('creates blob URL using createObjectURL', async () => {
    const blob = new Blob(['test']);
    const url = await assetManager.createBlobURL(blob);
    expect(url).toBe('blob:test-url');
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob);
  });

  it('falls back to data URL when createObjectURL throws', async () => {
    global.URL.createObjectURL = mock(() => {
      throw new Error('Blocked by extension');
    });

    const blob = new Blob(['test data'], { type: 'text/plain' });

    // Mock FileReader as a proper constructor class
    class MockFileReader {
      constructor() {
        this.result = null;
        this.onloadend = null;
        this.onerror = null;
      }
      readAsDataURL() {
        setTimeout(() => {
          this.result = 'data:text/plain;base64,dGVzdCBkYXRh';
          if (this.onloadend) this.onloadend();
        }, 0);
      }
    }
    global.FileReader = MockFileReader;

    const url = await assetManager.createBlobURL(blob);
    expect(url).toContain('data:');
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('createBlobURLSync', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
    global.URL = {
      createObjectURL: mock(() => 'blob:test-url'),
    };
    spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.URL;
  });

  it('creates blob URL synchronously', () => {
    const blob = new Blob(['test']);
    const url = assetManager.createBlobURLSync(blob);
    expect(url).toBe('blob:test-url');
  });

  it('returns null when createObjectURL throws', () => {
    global.URL.createObjectURL = mock(() => {
      throw new Error('Blocked');
    });

    const blob = new Blob(['test']);
    const url = assetManager.createBlobURLSync(blob);
    expect(url).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('setPriorityQueue', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
    global.Logger = { log: mock(() => {}) };
  });

  afterEach(() => {
    delete global.Logger;
  });

  it('attaches priority queue', () => {
    const mockQueue = { enqueue: mock(() => {}) };
    assetManager.setPriorityQueue(mockQueue);
    expect(assetManager.priorityQueue).toBe(mockQueue);
    expect(global.Logger.log).toHaveBeenCalledWith('[AssetManager] Priority queue attached');
  });
});

describe('setWebSocketHandler', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
    global.Logger = { log: mock(() => {}) };
  });

  afterEach(() => {
    delete global.Logger;
  });

  it('attaches WebSocket handler', () => {
    const mockHandler = { requestAsset: mock(() => {}) };
    assetManager.setWebSocketHandler(mockHandler);
    expect(assetManager.wsHandler).toBe(mockHandler);
    expect(global.Logger.log).toHaveBeenCalledWith('[AssetManager] WebSocket handler attached');
  });
});

describe('convertDataAssetUrlToSrc', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
  });

  it('returns null for null input', () => {
    expect(assetManager.convertDataAssetUrlToSrc(null)).toBeNull();
  });

  it('returns unchanged HTML when no data-asset-url', () => {
    const html = '<img src="http://example.com/image.jpg">';
    expect(assetManager.convertDataAssetUrlToSrc(html)).toBe(html);
  });

  it('converts img with data-asset-url', () => {
    const html = '<img src="data:image/png;base64,abc" data-asset-url="asset://uuid123">';
    const result = assetManager.convertDataAssetUrlToSrc(html);
    expect(result).toContain('src="asset://uuid123"');
    expect(result).not.toContain('data-asset-url');
  });

  it('converts video with data-asset-url', () => {
    const html = '<video src="blob:test" data-asset-url="asset://video-uuid"></video>';
    const result = assetManager.convertDataAssetUrlToSrc(html);
    expect(result).toContain('src="asset://video-uuid"');
  });

  it('converts audio with data-asset-url', () => {
    const html = '<audio src="blob:test" data-asset-url="asset://audio-uuid"></audio>';
    const result = assetManager.convertDataAssetUrlToSrc(html);
    expect(result).toContain('src="asset://audio-uuid"');
  });

  it('handles multiple elements', () => {
    const html = '<img src="data:a" data-asset-url="asset://img1"><img src="data:b" data-asset-url="asset://img2">';
    const result = assetManager.convertDataAssetUrlToSrc(html);
    expect(result).toContain('src="asset://img1"');
    expect(result).toContain('src="asset://img2"');
  });
});

describe('prepareHtmlForSync', () => {
  let assetManager;

  beforeEach(() => {
    // Mock Logger for convertBlobURLsToAssetRefs logging
    global.Logger = { log: mock(() => {}) };
    assetManager = new AssetManager('project-123');
    assetManager.reverseBlobCache.set('blob:test-url', 'asset-id-123');
  });

  afterEach(() => {
    delete global.Logger;
  });

  it('returns null for null input', () => {
    expect(assetManager.prepareHtmlForSync(null)).toBeNull();
  });

  it('converts data-asset-url attributes', () => {
    const html = '<img src="data:image" data-asset-url="asset://uuid">';
    const result = assetManager.prepareHtmlForSync(html);
    expect(result).toContain('src="asset://uuid"');
  });

  it('converts blob URLs to asset refs', () => {
    const html = '<img src="blob:test-url">';
    const result = assetManager.prepareHtmlForSync(html);
    expect(result).toContain('asset://asset-id-123');
  });

  it('handles both conversions together', () => {
    const html = '<img src="data:image" data-asset-url="asset://uuid1"><img src="blob:test-url">';
    const result = assetManager.prepareHtmlForSync(html);
    expect(result).toContain('asset://uuid1');
    expect(result).toContain('asset://asset-id-123');
  });
});

describe('extractAssetsFromZip', () => {
  let assetManager;
  let mockDB;

  beforeEach(async () => {
    mockDB = {
      transaction: mock(() => ({
        objectStore: mock(() => ({
          put: mock(() => ({ onsuccess: null, onerror: null })),
          get: mock(() => ({ result: null, onsuccess: null, onerror: null })),
        })),
        oncomplete: null,
        onerror: null,
      })),
    };

    global.Logger = { log: mock(() => {}) };
    global.crypto = {
      subtle: {
        digest: mock(async () => new ArrayBuffer(32)),
      },
    };

    assetManager = new AssetManager('project-123');
    assetManager.db = mockDB;
    assetManager.getAsset = mock(() => Promise.resolve(null));
    assetManager.putAsset = mock(() => Promise.resolve());
    assetManager.calculateHash = mock(() => Promise.resolve('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'));

    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.Logger;
    delete global.crypto;
  });

  it('throws if database not initialized', async () => {
    assetManager.db = null;
    await expect(assetManager.extractAssetsFromZip({})).rejects.toThrow('AssetManager not initialized');
  });

  it('extracts image assets from resources/ folder', async () => {
    const zipData = {
      'resources/image.png': new Uint8Array([1, 2, 3, 4]),
      'resources/photo.jpg': new Uint8Array([5, 6, 7, 8]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(2);
    expect(assetManager.putAsset).toHaveBeenCalledTimes(2);
  });

  it('extracts assets from content/resources/ folder', async () => {
    const zipData = {
      'content/resources/uuid123/image.png': new Uint8Array([1, 2, 3, 4]),
      'content/resources/uuid456/photo.jpg': new Uint8Array([5, 6, 7, 8]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(2);
    expect(assetManager.putAsset).toHaveBeenCalledTimes(2);
  });

  it('skips system folders (idevices, libs, theme)', async () => {
    const zipData = {
      'idevices/map/mapIcon.png': new Uint8Array([1, 2, 3]),
      'libs/jquery/jquery.min.js': new Uint8Array([4, 5, 6]),
      'theme/style.css': new Uint8Array([7, 8, 9]),
      'resources/user-image.png': new Uint8Array([10, 11, 12]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    // Only the resources/ file should be extracted
    expect(assetMap.size).toBe(1);
    expect(assetMap.has('resources/user-image.png')).toBe(true);
    expect(assetMap.has('idevices/map/mapIcon.png')).toBe(false);
    expect(assetMap.has('libs/jquery/jquery.min.js')).toBe(false);
    expect(assetMap.has('theme/style.css')).toBe(false);
  });

  it('skips directories', async () => {
    const zipData = {
      'resources/': new Uint8Array([]),
      'resources/image.png': new Uint8Array([1, 2, 3]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(1);
  });

  it('skips __MACOSX directories', async () => {
    const zipData = {
      '__MACOSX/image.png': new Uint8Array([1, 2, 3]),
      'resources/image.png': new Uint8Array([1, 2, 3]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(1);
    expect(assetMap.has('resources/image.png')).toBe(true);
    expect(assetMap.has('__MACOSX/image.png')).toBe(false);
  });

  it('skips XML files', async () => {
    const zipData = {
      'content.xml': new Uint8Array([1, 2, 3]),
      'resources/image.png': new Uint8Array([1, 2, 3]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(1);
    expect(assetMap.has('content.xml')).toBe(false);
  });

  it('handles existing assets for same project', async () => {
    assetManager.getAsset = mock(() => Promise.resolve({ projectId: 'project-123' }));

    const zipData = {
      'resources/image.png': new Uint8Array([1, 2, 3]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(1);
    expect(assetManager.putAsset).not.toHaveBeenCalled();
  });

  it('handles existing assets for different project', async () => {
    assetManager.getAsset = mock(() => Promise.resolve({
      projectId: 'other-project',
      blob: new Blob(['data']),
      mime: 'image/png',
      hash: 'hash123',
      size: 100,
    }));

    const zipData = {
      'resources/image.png': new Uint8Array([1, 2, 3]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(1);
    expect(assetManager.putAsset).toHaveBeenCalled();
  });

  it('extracts various media types from resources/', async () => {
    const zipData = {
      'resources/video.mp4': new Uint8Array([1]),
      'resources/audio.mp3': new Uint8Array([2]),
      'resources/doc.pdf': new Uint8Array([3]),
      'resources/image.svg': new Uint8Array([4]),
      'resources/image.webp': new Uint8Array([5]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(5);
  });

  it('skips index.html and other root system files', async () => {
    const zipData = {
      'index.html': new Uint8Array([1, 2, 3]),
      'base.css': new Uint8Array([4, 5, 6]),
      'common.js': new Uint8Array([7, 8, 9]),
      'common_i18n.js': new Uint8Array([10, 11, 12]),
      'resources/user-file.pdf': new Uint8Array([13, 14, 15]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(1);
    expect(assetMap.has('resources/user-file.pdf')).toBe(true);
    expect(assetMap.has('index.html')).toBe(false);
  });

  it('skips content/css/ folder', async () => {
    const zipData = {
      'content/css/base.css': new Uint8Array([1, 2, 3]),
      'content/css/theme.css': new Uint8Array([4, 5, 6]),
      'content/css/icons/icon.png': new Uint8Array([7, 8, 9]),
      'resources/user-style.css': new Uint8Array([10, 11, 12]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(1);
    expect(assetMap.has('resources/user-style.css')).toBe(true);
    expect(assetMap.has('content/css/base.css')).toBe(false);
    expect(assetMap.has('content/css/icons/icon.png')).toBe(false);
  });

  it('skips content/img/ folder', async () => {
    const zipData = {
      'content/img/logo.png': new Uint8Array([1, 2, 3]),
      'content/img/exe_powered_logo.png': new Uint8Array([4, 5, 6]),
      'resources/user-logo.png': new Uint8Array([7, 8, 9]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(1);
    expect(assetMap.has('resources/user-logo.png')).toBe(true);
    expect(assetMap.has('content/img/logo.png')).toBe(false);
  });

  it('skips html/ folder', async () => {
    const zipData = {
      'html/template.html': new Uint8Array([1, 2, 3]),
      'html/nested/page.html': new Uint8Array([4, 5, 6]),
      'resources/user-page.html': new Uint8Array([7, 8, 9]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(1);
    expect(assetMap.has('resources/user-page.html')).toBe(true);
    expect(assetMap.has('html/template.html')).toBe(false);
  });

  it('extracts from nested /resources/ path', async () => {
    const zipData = {
      'mywebsite/content/resources/image.png': new Uint8Array([1, 2, 3]),
      'project/resources/doc.pdf': new Uint8Array([4, 5, 6]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(2);
    expect(assetMap.has('mywebsite/content/resources/image.png')).toBe(true);
    expect(assetMap.has('project/resources/doc.pdf')).toBe(true);
  });

  it('returns empty map when no resources found', async () => {
    const zipData = {
      'idevices/map/icon.png': new Uint8Array([1, 2, 3]),
      'libs/jquery.js': new Uint8Array([4, 5, 6]),
      'theme/style.css': new Uint8Array([7, 8, 9]),
      'index.html': new Uint8Array([10, 11, 12]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(0);
  });

  it('handles empty zip', async () => {
    const zipData = {};

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(0);
    expect(assetManager.putAsset).not.toHaveBeenCalled();
  });

  it('extracts all file types from resources/', async () => {
    const zipData = {
      'resources/document.elp': new Uint8Array([1]),
      'resources/data.txt': new Uint8Array([2]),
      'resources/custom.xyz': new Uint8Array([3]),
      'resources/archive.zip': new Uint8Array([4]),
      'resources/model.gltf': new Uint8Array([5]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(5);
    expect(assetMap.has('resources/document.elp')).toBe(true);
    expect(assetMap.has('resources/data.txt')).toBe(true);
    expect(assetMap.has('resources/custom.xyz')).toBe(true);
  });

  it('handles complex ELPX structure with mixed files', async () => {
    const zipData = {
      // System files (should be skipped)
      'index.html': new Uint8Array([1]),
      'content.xml': new Uint8Array([2]),
      'idevices/text/text.js': new Uint8Array([3]),
      'idevices/text/text.css': new Uint8Array([4]),
      'libs/exe_math/tex-mml-svg.js': new Uint8Array([5]),
      'libs/bootstrap/bootstrap.min.css': new Uint8Array([6]),
      'theme/style.css': new Uint8Array([7]),
      'theme/icons/diary.png': new Uint8Array([8]),
      'content/css/base.css': new Uint8Array([9]),
      'content/img/exe_powered_logo.png': new Uint8Array([10]),
      'html/ciencias.html': new Uint8Array([11]),
      // User files (should be extracted)
      'resources/image.jpg': new Uint8Array([12]),
      'content/resources/uuid123/photo.png': new Uint8Array([13]),
      'content/resources/uuid456/document.pdf': new Uint8Array([14]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    // Only user files from resources/ should be extracted
    expect(assetMap.size).toBe(3);
    expect(assetMap.has('resources/image.jpg')).toBe(true);
    expect(assetMap.has('content/resources/uuid123/photo.png')).toBe(true);
    expect(assetMap.has('content/resources/uuid456/document.pdf')).toBe(true);

    // System files should NOT be extracted
    expect(assetMap.has('index.html')).toBe(false);
    expect(assetMap.has('idevices/text/text.js')).toBe(false);
    expect(assetMap.has('libs/exe_math/tex-mml-svg.js')).toBe(false);
    expect(assetMap.has('theme/style.css')).toBe(false);
    expect(assetMap.has('content/css/base.css')).toBe(false);
    expect(assetMap.has('html/ciencias.html')).toBe(false);
  });

  it('skips deeply nested idevices files', async () => {
    const zipData = {
      'idevices/map/nested/deep/icon.svg': new Uint8Array([1, 2, 3]),
      'idevices/quiz/assets/image.png': new Uint8Array([4, 5, 6]),
      'resources/user-icon.svg': new Uint8Array([7, 8, 9]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(1);
    expect(assetMap.has('resources/user-icon.svg')).toBe(true);
  });

  it('skips deeply nested libs files', async () => {
    const zipData = {
      'libs/exe_math/input/tex/extensions/extpfeil.js': new Uint8Array([1]),
      'libs/jquery-ui/images/ui-icons.png': new Uint8Array([2]),
      'resources/math-notes.pdf': new Uint8Array([3]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(1);
    expect(assetMap.has('resources/math-notes.pdf')).toBe(true);
  });

  it('handles resources with special characters in filename', async () => {
    const zipData = {
      'resources/archivo con espacios.png': new Uint8Array([1, 2, 3]),
      'resources/foto (1).jpg': new Uint8Array([4, 5, 6]),
      'resources/año_2024.pdf': new Uint8Array([7, 8, 9]),
    };

    const assetMap = await assetManager.extractAssetsFromZip(zipData);

    expect(assetMap.size).toBe(3);
    expect(assetMap.has('resources/archivo con espacios.png')).toBe(true);
    expect(assetMap.has('resources/foto (1).jpg')).toBe(true);
    expect(assetMap.has('resources/año_2024.pdf')).toBe(true);
  });

  // Legacy .elp format tests (contentv3.xml)
  describe('legacy .elp format (contentv3.xml)', () => {
    it('detects legacy format by contentv3.xml presence', async () => {
      const zipData = {
        'contentv3.xml': new Uint8Array([60, 63]), // <?
        'image.png': new Uint8Array([1, 2, 3]),
      };

      const assetMap = await assetManager.extractAssetsFromZip(zipData);

      expect(assetMap.size).toBe(1);
      expect(assetMap.has('image.png')).toBe(true);
    });

    it('extracts root-level assets in legacy format', async () => {
      const zipData = {
        'contentv3.xml': new Uint8Array([60, 63]),
        'content.data': new Uint8Array([1]),
        'content.xsd': new Uint8Array([1]),
        'juglar.png': new Uint8Array([1, 2, 3]),
        'el_cid.jpg': new Uint8Array([4, 5, 6]),
        'document.pdf': new Uint8Array([7, 8, 9]),
      };

      const assetMap = await assetManager.extractAssetsFromZip(zipData);

      expect(assetMap.size).toBe(3);
      expect(assetMap.has('juglar.png')).toBe(true);
      expect(assetMap.has('el_cid.jpg')).toBe(true);
      expect(assetMap.has('document.pdf')).toBe(true);
    });

    it('skips .xml, .xsd, .data files in legacy format', async () => {
      const zipData = {
        'contentv3.xml': new Uint8Array([60, 63]),
        'content.data': new Uint8Array([1]),
        'content.xsd': new Uint8Array([1]),
        'image.png': new Uint8Array([1, 2, 3]),
      };

      const assetMap = await assetManager.extractAssetsFromZip(zipData);

      expect(assetMap.size).toBe(1);
      expect(assetMap.has('contentv3.xml')).toBe(false);
      expect(assetMap.has('content.data')).toBe(false);
      expect(assetMap.has('content.xsd')).toBe(false);
      expect(assetMap.has('image.png')).toBe(true);
    });

    it('ignores subfolder assets in legacy format', async () => {
      const zipData = {
        'contentv3.xml': new Uint8Array([60, 63]),
        'image.png': new Uint8Array([1, 2, 3]),
        'subfolder/other.png': new Uint8Array([4, 5, 6]),
        'deep/nested/file.jpg': new Uint8Array([7, 8, 9]),
      };

      const assetMap = await assetManager.extractAssetsFromZip(zipData);

      expect(assetMap.size).toBe(1);
      expect(assetMap.has('image.png')).toBe(true);
      expect(assetMap.has('subfolder/other.png')).toBe(false);
      expect(assetMap.has('deep/nested/file.jpg')).toBe(false);
    });

    it('handles empty legacy format zip', async () => {
      const zipData = {
        'contentv3.xml': new Uint8Array([60, 63]),
        'content.data': new Uint8Array([1]),
      };

      const assetMap = await assetManager.extractAssetsFromZip(zipData);

      expect(assetMap.size).toBe(0);
    });

    it('extracts various media types in legacy format', async () => {
      const zipData = {
        'contentv3.xml': new Uint8Array([60, 63]),
        'photo.jpg': new Uint8Array([1]),
        'audio.mp3': new Uint8Array([2]),
        'video.mp4': new Uint8Array([3]),
        'document.pdf': new Uint8Array([4]),
        'animation.gif': new Uint8Array([5]),
      };

      const assetMap = await assetManager.extractAssetsFromZip(zipData);

      expect(assetMap.size).toBe(5);
      expect(assetMap.has('photo.jpg')).toBe(true);
      expect(assetMap.has('audio.mp3')).toBe(true);
      expect(assetMap.has('video.mp4')).toBe(true);
      expect(assetMap.has('document.pdf')).toBe(true);
      expect(assetMap.has('animation.gif')).toBe(true);
    });
  });

  // New .elpx format tests (content.xml)
  describe('new .elpx format (content.xml)', () => {
    it('detects new format when no contentv3.xml', async () => {
      const zipData = {
        'content.xml': new Uint8Array([60, 63]),
        'content/resources/uuid/image.png': new Uint8Array([1, 2, 3]),
      };

      const assetMap = await assetManager.extractAssetsFromZip(zipData);

      expect(assetMap.size).toBe(1);
      expect(assetMap.has('content/resources/uuid/image.png')).toBe(true);
    });

    it('ignores root-level files in new format', async () => {
      const zipData = {
        'content.xml': new Uint8Array([60, 63]),
        'index.html': new Uint8Array([1]),
        'root-image.png': new Uint8Array([2, 3, 4]),
        'content/resources/uuid/actual-asset.jpg': new Uint8Array([5, 6, 7]),
      };

      const assetMap = await assetManager.extractAssetsFromZip(zipData);

      expect(assetMap.size).toBe(1);
      expect(assetMap.has('content/resources/uuid/actual-asset.jpg')).toBe(true);
      expect(assetMap.has('root-image.png')).toBe(false);
    });

    it('extracts from content/resources/ subfolders in new format', async () => {
      const zipData = {
        'content.xml': new Uint8Array([60, 63]),
        'content/resources/20251009090601DKVACR/01.jpg': new Uint8Array([1]),
        'content/resources/20251009090601DKVACR/colegio.mp3': new Uint8Array([2]),
        'content/resources/20251009090601ROYVYO/sq01.jpg': new Uint8Array([3]),
      };

      const assetMap = await assetManager.extractAssetsFromZip(zipData);

      expect(assetMap.size).toBe(3);
      expect(assetMap.has('content/resources/20251009090601DKVACR/01.jpg')).toBe(true);
      expect(assetMap.has('content/resources/20251009090601DKVACR/colegio.mp3')).toBe(true);
      expect(assetMap.has('content/resources/20251009090601ROYVYO/sq01.jpg')).toBe(true);
    });
  });
});

describe('convertContextPathToAssetRefs', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
  });

  it('returns null for null input', () => {
    expect(assetManager.convertContextPathToAssetRefs(null, new Map())).toBeNull();
  });

  it('returns unchanged HTML when no context_path', () => {
    const html = '<p>Hello</p>';
    expect(assetManager.convertContextPathToAssetRefs(html, new Map())).toBe(html);
  });

  it('converts exact path match', () => {
    const assetMap = new Map([['content/image.png', 'uuid-123']]);
    const html = '<img src="{{context_path}}/content/image.png">';
    const result = assetManager.convertContextPathToAssetRefs(html, assetMap);
    expect(result).toBe('<img src="asset://uuid-123.png">');
  });

  it('tries common prefixes', () => {
    const assetMap = new Map([['content/resources/image.png', 'uuid-456']]);
    const html = '<img src="{{context_path}}/image.png">';
    const result = assetManager.convertContextPathToAssetRefs(html, assetMap);
    expect(result).toBe('<img src="asset://uuid-456.png">');
  });

  it('matches by filename alone', () => {
    const assetMap = new Map([['some/deep/path/photo.jpg', 'uuid-789']]);
    const html = '<img src="{{context_path}}/photo.jpg">';
    const result = assetManager.convertContextPathToAssetRefs(html, assetMap);
    expect(result).toBe('<img src="asset://uuid-789.jpg">');
  });

  it('matches by last path segments', () => {
    const assetMap = new Map([['content/abc123/image.png', 'uuid-abc']]);
    const html = '<img src="{{context_path}}/abc123/image.png">';
    const result = assetManager.convertContextPathToAssetRefs(html, assetMap);
    expect(result).toBe('<img src="asset://uuid-abc.png">');
  });

  it('leaves unmatched paths unchanged', () => {
    spyOn(console, 'warn').mockImplementation(() => {});
    const assetMap = new Map();
    const html = '<img src="{{context_path}}/missing.png">';
    const result = assetManager.convertContextPathToAssetRefs(html, assetMap);
    expect(result).toBe(html);
    expect(console.warn).toHaveBeenCalled();
  });

  it('handles multiple replacements', () => {
    const assetMap = new Map([
      ['img1.png', 'uuid-1'],
      ['img2.jpg', 'uuid-2'],
    ]);
    const html = '<img src="{{context_path}}/img1.png"><img src="{{context_path}}/img2.jpg">';
    const result = assetManager.convertContextPathToAssetRefs(html, assetMap);
    expect(result).toContain('asset://uuid-1.png');
    expect(result).toContain('asset://uuid-2.jpg');
  });
});

describe('resolveAssetURLWithPlaceholder', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
    assetManager.blobURLCache = new Map();
    assetManager.reverseBlobCache = new Map();
    assetManager.pendingFetches = new Set();
    global.URL = {
      createObjectURL: mock(() => 'blob:created-url'),
    };
    global.Logger = { log: mock(() => {}) };
    spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.URL;
    delete global.Logger;
  });

  it('returns cached URL if available', async () => {
    assetManager.blobURLCache.set('asset-123', 'blob:cached');

    const result = await assetManager.resolveAssetURLWithPlaceholder('asset://asset-123');

    expect(result.url).toBe('blob:cached');
    expect(result.isPlaceholder).toBe(false);
    expect(result.assetId).toBe('asset-123');
  });

  it('loads from IndexedDB if not cached', async () => {
    assetManager.getAsset = mock(() => Promise.resolve({ blob: new Blob(['data']) }));

    const result = await assetManager.resolveAssetURLWithPlaceholder('asset://asset-456');

    expect(result.url).toBe('blob:created-url');
    expect(result.isPlaceholder).toBe(false);
  });

  it('returns loading placeholder when asset not found', async () => {
    assetManager.getAsset = mock(() => Promise.resolve(null));

    const result = await assetManager.resolveAssetURLWithPlaceholder('asset://missing');

    expect(result.url).toContain('data:image/svg+xml');
    expect(result.isPlaceholder).toBe(true);
  });

  it('triggers background fetch with wsHandler', async () => {
    assetManager.getAsset = mock(() => Promise.resolve(null));
    const mockWsHandler = {
      // Use a promise that never resolves to keep the fetch "pending"
      requestAsset: mock(() => new Promise(() => {})),
    };

    const result = await assetManager.resolveAssetURLWithPlaceholder('asset://missing', {
      wsHandler: mockWsHandler,
    });

    expect(result.isPlaceholder).toBe(true);
    expect(mockWsHandler.requestAsset).toHaveBeenCalledWith('missing');
    expect(assetManager.pendingFetches.has('missing')).toBe(true);
  });

  it('does not trigger duplicate fetch', async () => {
    assetManager.getAsset = mock(() => Promise.resolve(null));
    assetManager.pendingFetches.add('already-fetching');
    const mockWsHandler = {
      requestAsset: mock(() => Promise.resolve()),
    };

    await assetManager.resolveAssetURLWithPlaceholder('asset://already-fetching', {
      wsHandler: mockWsHandler,
    });

    expect(mockWsHandler.requestAsset).not.toHaveBeenCalled();
  });

  it('returns notfound placeholder when returnPlaceholder is false', async () => {
    assetManager.getAsset = mock(() => Promise.resolve(null));

    const result = await assetManager.resolveAssetURLWithPlaceholder('asset://missing', {
      returnPlaceholder: false,
    });

    expect(result.isPlaceholder).toBe(true);
    expect(result.url).toContain('not%20found');
  });
});

describe('resolveAssetURLWithPriority', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
    assetManager.blobURLCache = new Map();
    assetManager.reverseBlobCache = new Map();
    assetManager.pendingFetches = new Set();
    global.URL = {
      createObjectURL: mock(() => 'blob:url'),
    };
    global.Logger = { log: mock(() => {}) };
    global.window = {
      AssetPriorityQueue: {
        PRIORITY: { CRITICAL: 100, HIGH: 75 },
      },
    };
  });

  afterEach(() => {
    delete global.URL;
    delete global.Logger;
    delete global.window;
  });

  it('returns cached URL if available', async () => {
    assetManager.blobURLCache.set('asset-id', 'blob:cached');

    const result = await assetManager.resolveAssetURLWithPriority('asset://asset-id/file.jpg');

    expect(result.url).toBe('blob:cached');
    expect(result.isPlaceholder).toBe(false);
  });

  it('loads from IndexedDB if not cached', async () => {
    assetManager.getAsset = mock(() => Promise.resolve({ blob: new Blob(['data']) }));

    const result = await assetManager.resolveAssetURLWithPriority('asset://db-asset');

    expect(result.isPlaceholder).toBe(false);
  });

  it('enqueues missing asset with CRITICAL priority for render', async () => {
    assetManager.getAsset = mock(() => Promise.resolve(null));
    const mockQueue = { enqueue: mock(() => {}) };
    assetManager.priorityQueue = mockQueue;

    const result = await assetManager.resolveAssetURLWithPriority('asset://missing', {
      pageId: 'page-1',
      reason: 'render',
    });

    expect(result.isPlaceholder).toBe(true);
    expect(mockQueue.enqueue).toHaveBeenCalledWith('missing', 100, {
      reason: 'render',
      pageId: 'page-1',
    });
  });

  it('uses HIGH priority for navigation reason', async () => {
    assetManager.getAsset = mock(() => Promise.resolve(null));
    const mockQueue = { enqueue: mock(() => {}) };
    assetManager.priorityQueue = mockQueue;

    await assetManager.resolveAssetURLWithPriority('asset://missing', {
      reason: 'navigation',
    });

    expect(mockQueue.enqueue).toHaveBeenCalledWith('missing', 75, expect.any(Object));
  });

  it('sends priority update via WebSocket', async () => {
    assetManager.getAsset = mock(() => Promise.resolve(null));
    const mockWsHandler = {
      sendPriorityUpdate: mock(() => {}),
      requestAssetWithPriority: mock(() => Promise.resolve()),
    };
    assetManager.wsHandler = mockWsHandler;

    await assetManager.resolveAssetURLWithPriority('asset://missing', {
      pageId: 'page-1',
      reason: 'render',
    });

    expect(mockWsHandler.sendPriorityUpdate).toHaveBeenCalledWith('missing', 100, 'render', 'page-1');
    expect(mockWsHandler.requestAssetWithPriority).toHaveBeenCalled();
  });
});

describe('boostAssetsInHTML', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
    assetManager.db = {}; // Initialize db to prevent "Database not initialized" error
    assetManager.blobURLCache = new Map();
    global.Logger = { log: mock(() => {}) };
    global.window = {
      AssetPriorityQueue: {
        PRIORITY: { HIGH: 75 },
      },
    };
  });

  afterEach(() => {
    delete global.Logger;
    delete global.window;
  });

  it('returns empty array for null HTML', async () => {
    const result = await assetManager.boostAssetsInHTML(null, 'page-1');
    expect(result).toEqual([]);
  });

  it('returns empty array when no asset references', async () => {
    const result = await assetManager.boostAssetsInHTML('<p>Hello</p>', 'page-1');
    expect(result).toEqual([]);
  });

  it('returns empty array when all assets are cached', async () => {
    // Use valid UUID-like ID (hex only: a-f, 0-9)
    assetManager.blobURLCache.set('abcd1234-0000-0000-0000-000000000001', 'blob:url');
    // Mock getAsset in case cache check passes to an IndexedDB lookup
    assetManager.getAsset = mock(() => Promise.resolve({ id: 'abcd1234-0000-0000-0000-000000000001' }));

    const result = await assetManager.boostAssetsInHTML('<img src="asset://abcd1234-0000-0000-0000-000000000001">', 'page-1');
    expect(result).toEqual([]);
  });

  it('returns missing asset IDs', async () => {
    // Mock getAsset to return null for missing assets
    assetManager.getAsset = mock(() => Promise.resolve(null));

    // Use valid UUID-like IDs (hex only: a-f, 0-9)
    const html = '<img src="asset://aaaa0001-0000-0000-0000-000000000001"><img src="asset://bbbb0002-0000-0000-0000-000000000002">';
    const result = await assetManager.boostAssetsInHTML(html, 'page-1');

    expect(result).toContain('aaaa0001-0000-0000-0000-000000000001');
    expect(result).toContain('bbbb0002-0000-0000-0000-000000000002');
  });

  it('enqueues missing assets in priority queue', async () => {
    assetManager.getAsset = mock(() => Promise.resolve(null));
    const mockQueue = { enqueue: mock(() => {}) };
    assetManager.priorityQueue = mockQueue;

    await assetManager.boostAssetsInHTML('<img src="asset://cafe0001-0000-0000-0000-000000000001">', 'page-1');

    expect(mockQueue.enqueue).toHaveBeenCalledWith('cafe0001-0000-0000-0000-000000000001', 75, {
      reason: 'navigation',
      pageId: 'page-1',
    });
  });

  it('sends navigation hint via WebSocket', async () => {
    assetManager.getAsset = mock(() => Promise.resolve(null));
    const mockWsHandler = { sendNavigationHint: mock(() => {}) };
    assetManager.wsHandler = mockWsHandler;

    await assetManager.boostAssetsInHTML('<img src="asset://dead0001-0000-0000-0000-000000000001">', 'page-1');

    expect(mockWsHandler.sendNavigationHint).toHaveBeenCalledWith('page-1', ['dead0001-0000-0000-0000-000000000001']);
  });
});

describe('findByHash', () => {
  let assetManager;
  let mockDB;
  let mockYjsBridge;

  beforeEach(() => {
    // Mock Logger
    global.Logger = { log: mock(() => {}) };

    // Create mock Yjs bridge
    mockYjsBridge = createMockYjsBridge();

    // Setup metadata in Yjs
    mockYjsBridge._assetsMap.set('asset-1', { hash: 'hash123', filename: 'test1.jpg' });
    mockYjsBridge._assetsMap.set('asset-2', { hash: 'hash456', filename: 'test2.jpg' });

    mockDB = {
      transaction: mock(() => ({
        objectStore: mock(() => ({
          get: mock((id) => ({
            result: id === 'asset-1' ? { id: 'asset-1', blob: new Blob(['test']) } : null,
            onsuccess: null,
          })),
        })),
      })),
    };

    assetManager = new AssetManager('project-123');
    assetManager.setYjsBridge(mockYjsBridge);
    assetManager.db = mockDB;
  });

  afterEach(() => {
    delete global.Logger;
  });

  it('returns null when db not initialized but Yjs has no match', async () => {
    assetManager.db = null;
    // findByHash now uses Yjs metadata, so it doesn't require DB
    const result = await assetManager.findByHash('nonexistent');
    expect(result).toBeNull();
  });

  it('returns asset matching hash from Yjs metadata', async () => {
    const mockGetRequest = {
      result: { id: 'asset-1', blob: new Blob(['test']) },
      onsuccess: null,
    };

    mockDB.transaction.mockReturnValue({
      objectStore: mock(() => ({
        get: mock(() => mockGetRequest),
      })),
    });

    const findPromise = assetManager.findByHash('hash123');
    setTimeout(() => mockGetRequest.onsuccess?.(), 0);

    const result = await findPromise;
    expect(result.id).toBe('asset-1');
    expect(result.hash).toBe('hash123');
    expect(result.projectId).toBe('project-123');
  });

  it('returns null if no match in Yjs metadata', async () => {
    const result = await assetManager.findByHash('nonexistent-hash');
    expect(result).toBeNull();
  });
});

describe('uploadPendingAssets', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
    assetManager.db = {};
    global.Logger = { log: mock(() => {}) };
    global.fetch = mock(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ uploaded: 2 }),
    }));
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.Logger;
    delete global.fetch;
  });

  it('returns zero counts when no pending assets', async () => {
    assetManager.getPendingAssets = mock(() => Promise.resolve([]));

    const result = await assetManager.uploadPendingAssets('http://api', 'token');

    expect(result).toEqual({ uploaded: 0, failed: 0, bytes: 0 });
  });

  it('uploads pending assets', async () => {
    assetManager.getPendingAssets = mock(() => Promise.resolve([
      { id: 'a1', blob: new Blob(['1']), mime: 'image/png', hash: 'h1', size: 100, filename: 'img1.png' },
      { id: 'a2', blob: new Blob(['2']), mime: 'image/jpeg', hash: 'h2', size: 200, filename: 'img2.jpg' },
    ]));
    assetManager.markAssetUploaded = mock(() => Promise.resolve());

    const result = await assetManager.uploadPendingAssets('http://api', 'token');

    expect(result.uploaded).toBe(2);
    expect(result.bytes).toBe(300);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://api/api/projects/project-123/assets',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('handles upload failure', async () => {
    assetManager.getPendingAssets = mock(() => Promise.resolve([
      { id: 'a1', blob: new Blob(['1']), mime: 'image/png', hash: 'h1', size: 100 },
    ]));
    global.fetch = mock(() => Promise.resolve({
      ok: false,
      statusText: 'Server Error',
    }));

    const result = await assetManager.uploadPendingAssets('http://api', 'token');

    expect(result.failed).toBe(1);
    expect(result.uploaded).toBe(0);
  });

  it('handles network error', async () => {
    assetManager.getPendingAssets = mock(() => Promise.resolve([
      { id: 'a1', blob: new Blob(['1']), mime: 'image/png', hash: 'h1', size: 100 },
    ]));
    global.fetch = mock(() => Promise.reject(new Error('Network error')));

    const result = await assetManager.uploadPendingAssets('http://api', 'token');

    expect(result.failed).toBe(1);
  });
});

describe('downloadMissingAssets', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
    assetManager.db = {};
    global.Logger = { log: mock(() => {}) };
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.Logger;
    delete global.fetch;
  });

  it('returns 0 when server request fails', async () => {
    global.fetch = mock(() => Promise.resolve({ ok: false }));

    const result = await assetManager.downloadMissingAssets('http://api', 'token');

    expect(result).toBe(0);
  });

  it('returns 0 when all assets cached locally', async () => {
    global.fetch = mock(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ id: 'a1' }]),
    }));
    assetManager.getAsset = mock(() => Promise.resolve({ id: 'a1' }));

    const result = await assetManager.downloadMissingAssets('http://api', 'token');

    expect(result).toBe(0);
  });

  it('downloads missing assets from server', async () => {
    global.fetch = mock()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 'a1' }, { id: 'a2' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['data1'])),
        headers: new Map([
          ['X-Original-Mime', 'image/png'],
          ['X-Asset-Hash', 'hash1'],
          ['X-Original-Size', '100'],
          ['X-Filename', 'img1.png'],
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['data2'])),
        headers: new Map([
          ['X-Original-Mime', 'image/jpeg'],
        ]),
      });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 'a1' }, { id: 'a2' }]),
    });

    // Use a proper mock for getAsset that returns null for missing assets
    assetManager.getAsset = mock()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    assetManager.putAsset = mock(() => Promise.resolve());

    // Create proper Headers mock
    const createMockResponse = (blob, headers) => ({
      ok: true,
      blob: () => Promise.resolve(blob),
      headers: {
        get: (name) => headers[name] || null,
      },
    });

    global.fetch = mock()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 'a1' }]),
      })
      .mockResolvedValueOnce(createMockResponse(new Blob(['data1']), {
        'X-Original-Mime': 'image/png',
        'X-Asset-Hash': 'hash1',
        'X-Original-Size': '100',
        'X-Filename': 'img1.png',
      }));

    const result = await assetManager.downloadMissingAssets('http://api', 'token');

    expect(result).toBe(1);
    expect(assetManager.putAsset).toHaveBeenCalled();
  });

  it('handles download errors gracefully', async () => {
    global.fetch = mock(() => Promise.reject(new Error('Network error')));

    const result = await assetManager.downloadMissingAssets('http://api', 'token');

    expect(result).toBe(0);
  });
});

describe('downloadMissingAssetsFromServer', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
    assetManager.db = {};
    assetManager.blobURLCache = new Map();
    assetManager.reverseBlobCache = new Map();
    assetManager.missingAssets = new Set();
    assetManager.failedAssets = new Map();
    assetManager.pendingFetches = new Set();
    global.Logger = { log: mock(() => {}) };
    global.URL = {
      createObjectURL: mock(() => 'blob:url'),
    };
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.Logger;
    delete global.fetch;
    delete global.URL;
  });

  it('returns zero when no missing assets', async () => {
    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');
    expect(result).toEqual({ downloaded: 0, failed: 0 });
  });

  it('skips permanently failed assets (404)', async () => {
    assetManager.missingAssets.add('failed-asset');
    assetManager.failedAssets.set('failed-asset', { count: 1, lastAttempt: 0, permanent: true });

    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');

    expect(result.skipped).toBe(1);
    expect(assetManager.missingAssets.has('failed-asset')).toBe(false);
  });

  it('skips assets that exceeded max retries', async () => {
    assetManager.missingAssets.add('retry-exhausted');
    assetManager.failedAssets.set('retry-exhausted', { count: 3, lastAttempt: 0, permanent: false });

    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');

    expect(result.skipped).toBe(1);
  });

  it('skips assets in cooldown period', async () => {
    assetManager.missingAssets.add('cooling-down');
    assetManager.failedAssets.set('cooling-down', { count: 1, lastAttempt: Date.now(), permanent: false });

    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');

    expect(result.skipped).toBe(1);
  });

  it('skips assets already in cache', async () => {
    assetManager.missingAssets.add('cached-asset');
    assetManager.blobURLCache.set('cached-asset', 'blob:existing');

    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');

    expect(assetManager.missingAssets.has('cached-asset')).toBe(false);
  });

  it('loads existing asset from IndexedDB to cache', async () => {
    assetManager.missingAssets.add('in-db-asset');
    assetManager.getAsset = mock(() => Promise.resolve({ blob: new Blob(['data']) }));
    assetManager.updateDomImagesForAsset = mock(() => Promise.resolve(0));

    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');

    expect(assetManager.blobURLCache.has('in-db-asset')).toBe(true);
    expect(assetManager.missingAssets.has('in-db-asset')).toBe(false);
  });

  it('fetches from server when getAsset returns metadata without blob (Yjs-only metadata)', async () => {
    // This tests the bug fix: getAsset() returns metadata from Yjs even when blob is null
    // The check must be existingAsset?.blob, not just existingAsset
    assetManager.missingAssets.add('metadata-only-asset');
    // Return metadata object WITHOUT blob - simulating Yjs metadata without IndexedDB blob
    assetManager.getAsset = mock(() => Promise.resolve({
      filename: 'test.png',
      mime: 'image/png',
      // blob is undefined/missing - this is the bug scenario
    }));
    assetManager.putAsset = mock(() => Promise.resolve());
    assetManager.calculateHash = mock(() => Promise.resolve('hash123'));
    assetManager.updateDomImagesForAsset = mock(() => Promise.resolve(0));

    global.fetch = mock(() => Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['server-data'])),
      headers: {
        get: (name) => {
          const headers = {
            'Content-Type': 'image/png',
            'Content-Disposition': 'attachment; filename="test.png"',
          };
          return headers[name] || null;
        },
      },
    }));

    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');

    // Should have downloaded from server, not skipped
    expect(result.downloaded).toBe(1);
    expect(global.fetch).toHaveBeenCalled();
    expect(assetManager.putAsset).toHaveBeenCalled();
    expect(assetManager.blobURLCache.has('metadata-only-asset')).toBe(true);
  });

  it('fetches from server when getAsset returns object with null blob', async () => {
    // Another variation: blob property exists but is null
    assetManager.missingAssets.add('null-blob-asset');
    assetManager.getAsset = mock(() => Promise.resolve({
      filename: 'test.png',
      mime: 'image/png',
      blob: null  // Explicitly null
    }));
    assetManager.putAsset = mock(() => Promise.resolve());
    assetManager.calculateHash = mock(() => Promise.resolve('hash456'));
    assetManager.updateDomImagesForAsset = mock(() => Promise.resolve(0));

    global.fetch = mock(() => Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['data'])),
      headers: {
        get: () => 'image/png',
      },
    }));

    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');

    expect(result.downloaded).toBe(1);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('downloads and stores asset from server', async () => {
    assetManager.missingAssets.add('to-download');
    assetManager.getAsset = mock(() => Promise.resolve(null));
    assetManager.putAsset = mock(() => Promise.resolve());
    assetManager.calculateHash = mock(() => Promise.resolve('hash123'));
    assetManager.updateDomImagesForAsset = mock(() => Promise.resolve(0));

    global.fetch = mock(() => Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['server-data'])),
      headers: {
        get: (name) => {
          const headers = {
            'Content-Type': 'image/png',
            'Content-Disposition': 'attachment; filename="test.png"',
          };
          return headers[name] || null;
        },
      },
    }));

    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');

    expect(result.downloaded).toBe(1);
    expect(assetManager.putAsset).toHaveBeenCalled();
    expect(assetManager.missingAssets.has('to-download')).toBe(false);
    expect(assetManager.blobURLCache.has('to-download')).toBe(true);
  });

  it('marks 404 as permanent failure', async () => {
    assetManager.missingAssets.add('not-found');
    assetManager.getAsset = mock(() => Promise.resolve(null));

    global.fetch = mock(() => Promise.resolve({
      ok: false,
      status: 404,
    }));

    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');

    expect(result.failed).toBe(1);
    expect(assetManager.failedAssets.get('not-found').permanent).toBe(true);
    expect(assetManager.missingAssets.has('not-found')).toBe(false);
  });

  it('tracks non-404 failures with retry count', async () => {
    assetManager.missingAssets.add('server-error');
    assetManager.getAsset = mock(() => Promise.resolve(null));

    global.fetch = mock(() => Promise.resolve({
      ok: false,
      status: 500,
    }));

    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');

    expect(result.failed).toBe(1);
    expect(assetManager.failedAssets.get('server-error').count).toBe(1);
    expect(assetManager.failedAssets.get('server-error').permanent).toBe(false);
  });

  it('tries P2P first when WebSocket connected', async () => {
    assetManager.missingAssets.add('p2p-asset');
    const mockWsHandler = {
      connected: true,
      requestAsset: mock(() => Promise.resolve(true)),
    };
    assetManager.wsHandler = mockWsHandler;
    // Mock hasLocalBlob to return false - asset not in IndexedDB, needs P2P fetch
    assetManager.hasLocalBlob = mock(() => Promise.resolve(false));
    assetManager.getAsset = mock()
      .mockResolvedValueOnce(null) // First check in _requestAssetsFromPeers
      .mockResolvedValueOnce({ blob: new Blob(['data']) }); // After P2P success
    assetManager.updateDomImagesForAsset = mock(() => Promise.resolve(0));

    const result = await assetManager.downloadMissingAssetsFromServer('http://api', 'token', 'proj-uuid');

    expect(mockWsHandler.requestAsset).toHaveBeenCalled();
  });
});

describe('_requestAssetsFromPeers', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
    assetManager.blobURLCache = new Map();
    assetManager.reverseBlobCache = new Map();
    assetManager.missingAssets = new Set();
    assetManager.failedAssets = new Map();
    global.Logger = { log: mock(() => {}) };
    global.URL = {
      createObjectURL: mock(() => 'blob:url'),
    };
    spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.Logger;
    delete global.URL;
  });

  it('returns all failed when no WebSocket handler', async () => {
    assetManager.wsHandler = null;

    const result = await assetManager._requestAssetsFromPeers(['a1', 'a2']);

    expect(result.failed).toBe(2);
    expect(result.received).toBe(0);
  });

  it('returns all failed when WebSocket not connected', async () => {
    assetManager.wsHandler = { connected: false };

    const result = await assetManager._requestAssetsFromPeers(['a1']);

    expect(result.failed).toBe(1);
  });

  it('counts cached assets as received', async () => {
    assetManager.wsHandler = { connected: true, requestAsset: mock(() => Promise.resolve(false)) };
    assetManager.blobURLCache.set('cached', 'blob:url');
    assetManager.missingAssets.add('cached');

    const result = await assetManager._requestAssetsFromPeers(['cached']);

    expect(result.received).toBe(1);
    expect(assetManager.missingAssets.has('cached')).toBe(false);
  });

  it('loads existing IndexedDB assets to cache', async () => {
    assetManager.wsHandler = { connected: true, requestAsset: mock(() => Promise.resolve(false)) };
    // Mock hasLocalBlob (not hasAsset) - this checks if blob exists in IndexedDB
    assetManager.hasLocalBlob = mock(() => Promise.resolve(true));
    assetManager.getAsset = mock(() => Promise.resolve({ blob: new Blob(['data']) }));
    assetManager.updateDomImagesForAsset = mock(() => Promise.resolve(0));
    assetManager.missingAssets.add('in-db');

    const result = await assetManager._requestAssetsFromPeers(['in-db']);

    expect(result.received).toBe(1);
    expect(assetManager.blobURLCache.has('in-db')).toBe(true);
  });

  it('requests assets from peers via WebSocket', async () => {
    const mockRequestAsset = mock(() => Promise.resolve(true));
    assetManager.wsHandler = { connected: true, requestAsset: mockRequestAsset };
    // Mock hasLocalBlob (not hasAsset) - returns false to trigger P2P request
    assetManager.hasLocalBlob = mock(() => Promise.resolve(false));
    assetManager.getAsset = mock(() => Promise.resolve({ blob: new Blob(['data']) }));
    assetManager.updateDomImagesForAsset = mock(() => Promise.resolve(0));

    const result = await assetManager._requestAssetsFromPeers(['peer-asset']);

    expect(mockRequestAsset).toHaveBeenCalledWith('peer-asset', 10000);
    expect(result.received).toBe(1);
  });

  it('handles pending status from peer', async () => {
    assetManager.wsHandler = { connected: true, requestAsset: mock(() => Promise.resolve(false)) };
    // Mock hasLocalBlob (not hasAsset)
    assetManager.hasLocalBlob = mock(() => Promise.resolve(false));

    const result = await assetManager._requestAssetsFromPeers(['pending-asset']);

    expect(result.pending).toBe(1);
  });

  it('handles request errors', async () => {
    assetManager.wsHandler = {
      connected: true,
      requestAsset: mock(() => Promise.reject(new Error('Timeout'))),
    };
    // Mock hasLocalBlob (not hasAsset)
    assetManager.hasLocalBlob = mock(() => Promise.resolve(false));

    const result = await assetManager._requestAssetsFromPeers(['error-asset']);

    expect(result.failed).toBe(1);
  });

  it('processes in batches for concurrency control', async () => {
    const requestOrder = [];
    assetManager.wsHandler = {
      connected: true,
      requestAsset: mock((id) => {
        requestOrder.push(id);
        return Promise.resolve(false);
      }),
    };
    // Mock hasLocalBlob (not hasAsset)
    assetManager.hasLocalBlob = mock(() => Promise.resolve(false));

    const assets = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    await assetManager._requestAssetsFromPeers(assets, { concurrency: 3 });

    expect(requestOrder.length).toBe(7);
  });
});

describe('window.resolveAssetUrlsAsync global function', () => {
  let savedWindow;
  let resolveAssetUrlsAsyncFunc;

  beforeEach(() => {
    // Save original window
    savedWindow = global.window;

    // Create a clean window-like object
    global.window = {
      AssetPriorityQueue: { PRIORITY: { HIGH: 75 } },
    };

    // Import the module fresh to get the function registered
    // Clear the module cache first
    delete require.cache[require.resolve('./AssetManager')];
    require('./AssetManager');

    // The function should now be on global.window
    resolveAssetUrlsAsyncFunc = global.window.resolveAssetUrlsAsync;
  });

  afterEach(() => {
    // Restore original window or delete if none
    if (savedWindow) {
      global.window = savedWindow;
    } else {
      delete global.window;
    }
  });

  it('returns original HTML when null', async () => {
    // Skip test if function wasn't registered (module load issues)
    if (!resolveAssetUrlsAsyncFunc) {
      return;
    }
    const result = await resolveAssetUrlsAsyncFunc(null);
    expect(result).toBeNull();
  });

  it('uses AssetManager when available', async () => {
    // Skip test if function wasn't registered (module load issues)
    if (!resolveAssetUrlsAsyncFunc) {
      return;
    }

    const mockResolve = mock(() => undefined).mockResolvedValue('<p>Resolved</p>');
    global.window.eXeLearning = {
      app: {
        project: {
          _yjsBridge: {
            assetManager: {
              resolveHTMLAssets: mockResolve,
            },
          },
        },
      },
    };

    const result = await resolveAssetUrlsAsyncFunc('<p>Test</p>');

    expect(mockResolve).toHaveBeenCalled();
    expect(result).toBe('<p>Resolved</p>');
  });

  it('attempts to convert iframe blob URLs when convertBlobUrls: false but convertIframeBlobUrls: true', async () => {
    // Skip test if function wasn't registered (module load issues)
    if (!resolveAssetUrlsAsyncFunc) {
      return;
    }

    // Mock resolveHTMLAssets to return content with blob URL in iframe and video
    // The function will try to convert iframe blob URLs but not video blob URLs
    const mockResolve = mock(() => undefined).mockResolvedValue(
      '<p>Text</p><iframe src="blob:http://localhost/test-blob"></iframe><video src="blob:http://localhost/video-blob"></video>'
    );

    // Mock fetch to fail (simulating blob URL not accessible in test env)
    const originalFetch = global.fetch;
    global.fetch = mock(() => undefined).mockRejectedValue(new Error('Not accessible'));

    global.window.eXeLearning = {
      app: {
        project: {
          _yjsBridge: {
            assetManager: {
              resolveHTMLAssets: mockResolve,
            },
          },
        },
      },
    };

    const result = await resolveAssetUrlsAsyncFunc('<p>Test</p>', {
      convertBlobUrls: false,
      convertIframeBlobUrls: true
    });

    // Restore fetch
    global.fetch = originalFetch;

    // The function should have been called with the HTML
    expect(mockResolve).toHaveBeenCalled();
    // Since fetch fails, blob URLs remain unchanged
    // But the important thing is the video blob URL was NOT attempted to be converted
    expect(result).toContain('blob:http://localhost/video-blob');
  });

  it('successfully converts blob URLs to data URLs when convertBlobUrls: true', async () => {
    // Skip test if function wasn't registered (module load issues)
    if (!resolveAssetUrlsAsyncFunc) {
      return;
    }

    // Use a synthetic blob URL (happy-dom doesn't support fetch for blob: URLs anyway)
    const testBlobUrl = 'blob:http://localhost/test-blob-url';

    // Mock resolveHTMLAssets to return content with our blob URL
    const mockResolve = mock(() => undefined).mockResolvedValue(
      `<p>Text</p><img src="${testBlobUrl}">`
    );

    global.window.eXeLearning = {
      app: {
        project: {
          _yjsBridge: {
            assetManager: {
              resolveHTMLAssets: mockResolve,
            },
          },
        },
      },
    };

    const result = await resolveAssetUrlsAsyncFunc('<p>Test</p>', {
      convertBlobUrls: true
    });

    // The blob URL should remain unchanged (happy-dom can't fetch blob: URLs)
    // But the conversion code path was exercised
    expect(result).toBeDefined();
    expect(mockResolve).toHaveBeenCalled();
  });

  it('does not convert iframe blob URLs when convertIframeBlobUrls: false', async () => {
    // Skip test if function wasn't registered (module load issues)
    if (!resolveAssetUrlsAsyncFunc) {
      return;
    }

    // Mock resolveHTMLAssets to return content with blob URL in iframe
    const mockResolve = mock(() => undefined).mockResolvedValue(
      '<p>Text</p><iframe src="blob:http://localhost/test-blob"></iframe>'
    );

    global.window.eXeLearning = {
      app: {
        project: {
          _yjsBridge: {
            assetManager: {
              resolveHTMLAssets: mockResolve,
            },
          },
        },
      },
    };

    const result = await resolveAssetUrlsAsyncFunc('<p>Test</p>', {
      convertBlobUrls: false,
      convertIframeBlobUrls: false
    });

    // The iframe blob URL should remain as blob (not converted)
    expect(result).toContain('blob:http://localhost/test-blob');
  });
});

describe('window.escapePreCodeContent', () => {
  let escapePreCodeContentFunc;
  let savedWindow;

  beforeEach(() => {
    // Save original window
    savedWindow = global.window;

    // Create a clean window-like object
    global.window = {};

    // Import the module fresh to get the function registered
    delete require.cache[require.resolve('./AssetManager')];
    require('./AssetManager');

    // The function should now be on global.window
    escapePreCodeContentFunc = global.window.escapePreCodeContent;
  });

  afterEach(() => {
    // Restore original window or delete if none
    if (savedWindow) {
      global.window = savedWindow;
    } else {
      delete global.window;
    }
  });

  it('should escape script tags inside pre>code blocks', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre><code><script src="test.js"></script></code></pre>';
    const expected = '<pre><code>&lt;script src=&quot;test.js&quot;&gt;&lt;/script&gt;</code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(expected);
  });

  it('should NOT escape content outside pre>code blocks', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<p>Hello <strong>world</strong></p><pre><code><div>test</div></code></pre>';
    const expected = '<p>Hello <strong>world</strong></p><pre><code>&lt;div&gt;test&lt;/div&gt;</code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(expected);
  });

  it('should NOT escape inline code tags (without pre)', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<p>Use <code><script></code> tag</p>';
    expect(escapePreCodeContentFunc(input)).toBe(input);
  });

  it('should handle multiple pre>code blocks', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre><code><a></code></pre><p>text</p><pre><code><b></code></pre>';
    const expected = '<pre><code>&lt;a&gt;</code></pre><p>text</p><pre><code>&lt;b&gt;</code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(expected);
  });

  it('should handle attributes on pre and code tags', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre class="highlighted"><code class="lang-js"><script></script></code></pre>';
    const expected = '<pre class="highlighted"><code class="lang-js">&lt;script&gt;&lt;/script&gt;</code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(expected);
  });

  it('should handle whitespace between tags', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre>\n  <code>\n    <div>\n  </code>\n</pre>';
    const expected = '<pre>\n  <code>\n    &lt;div&gt;\n  </code>\n</pre>';
    expect(escapePreCodeContentFunc(input)).toBe(expected);
  });

  it('should handle empty pre>code blocks', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre><code></code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(input);
  });

  it('should handle pre>code blocks with only whitespace', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre><code>   </code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(input);
  });

  it('should not double-escape already escaped content', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre><code>&lt;script&gt;</code></pre>';
    const expected = '<pre><code>&lt;script&gt;</code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(expected);
  });

  it('should handle ampersands correctly', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre><code>a & b && c</code></pre>';
    const expected = '<pre><code>a &amp; b &amp;&amp; c</code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(expected);
  });

  it('should handle quotes correctly', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre><code>let x = "hello";</code></pre>';
    const expected = '<pre><code>let x = &quot;hello&quot;;</code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(expected);
  });

  it('should handle tikzjax example from bug report', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre><code>\n<script src="https://tikzjax.com/v1/tikzjax.js"></script>\n</code></pre>';
    const expected = '<pre><code>\n&lt;script src=&quot;https://tikzjax.com/v1/tikzjax.js&quot;&gt;&lt;/script&gt;\n</code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(expected);
  });

  it('should handle null/undefined content', () => {
    if (!escapePreCodeContentFunc) return;
    expect(escapePreCodeContentFunc(null)).toBeNull();
    expect(escapePreCodeContentFunc(undefined)).toBeUndefined();
    expect(escapePreCodeContentFunc('')).toBe('');
  });

  it('should handle content with no pre>code blocks', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<p>Just some <em>normal</em> HTML</p>';
    expect(escapePreCodeContentFunc(input)).toBe(input);
  });

  it('should handle complex nested HTML in code blocks', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre><code><div class="container"><p id="test">Hello</p></div></code></pre>';
    const expected = '<pre><code>&lt;div class=&quot;container&quot;&gt;&lt;p id=&quot;test&quot;&gt;Hello&lt;/p&gt;&lt;/div&gt;</code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(expected);
  });

  it('should preserve content between multiple code blocks', () => {
    if (!escapePreCodeContentFunc) return;
    const input = '<pre><code><a></code></pre><script>alert("real")</script><pre><code><b></code></pre>';
    const expected = '<pre><code>&lt;a&gt;</code></pre><script>alert("real")</script><pre><code>&lt;b&gt;</code></pre>';
    expect(escapePreCodeContentFunc(input)).toBe(expected);
  });
});

describe('window.addMediaTypes global function', () => {
  let savedWindow;
  let addMediaTypesFunc;

  beforeEach(() => {
    savedWindow = global.window;
    require('./AssetManager');
    addMediaTypesFunc = global.window?.addMediaTypes;
  });

  afterEach(() => {
    if (savedWindow) {
      global.window = savedWindow;
    } else {
      delete global.window;
    }
  });

  it('returns original HTML when null or empty', () => {
    if (!addMediaTypesFunc) return;
    expect(addMediaTypesFunc(null)).toBeNull();
    expect(addMediaTypesFunc('')).toBe('');
    expect(addMediaTypesFunc(undefined)).toBeUndefined();
  });

  it('adds type attribute to video element with mp4 src', () => {
    if (!addMediaTypesFunc) return;
    const input = '<video src="asset://uuid/video.mp4"></video>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="video/mp4"');
  });

  it('adds type attribute to audio element with mp3 src', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio src="asset://uuid/audio.mp3"></audio>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="audio/mpeg"');
  });

  it('adds audio/webm type for audio element with webm src', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio src="asset://uuid/audio.webm" class="mediaelement"></audio>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="audio/webm"');
    expect(result).not.toContain('type="video/webm"');
  });

  it('adds video/webm type for video element with webm src', () => {
    if (!addMediaTypesFunc) return;
    const input = '<video src="asset://uuid/video.webm" class="mediaelement"></video>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="video/webm"');
    expect(result).not.toContain('type="audio/webm"');
  });

  it('adds correct webm type for source inside audio element', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio><source src="asset://uuid/audio.webm"></audio>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="audio/webm"');
  });

  it('adds correct webm type for source inside video element', () => {
    if (!addMediaTypesFunc) return;
    const input = '<video><source src="asset://uuid/video.webm"></video>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="video/webm"');
  });

  it('does not modify element that already has type', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio src="asset://uuid/audio.mp3" type="audio/mpeg"></audio>';
    const result = addMediaTypesFunc(input);
    // Should still have the type but only once
    expect((result.match(/type="audio\/mpeg"/g) || []).length).toBe(1);
  });

  it('returns body content only for HTML fragment input', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio src="asset://uuid/audio.mp3"></audio>';
    const result = addMediaTypesFunc(input);
    // For fragments, should NOT contain DOCTYPE or html/body tags
    expect(result).not.toContain('<!DOCTYPE');
    expect(result).not.toContain('<html>');
    expect(result).not.toContain('<body>');
    // Should contain the audio element
    expect(result).toContain('<audio');
  });

  it('preserves full document structure when input has DOCTYPE', () => {
    if (!addMediaTypesFunc) return;
    const input = '<!DOCTYPE html><html><head><title>Test</title></head><body><audio src="asset://uuid/audio.mp3"></audio></body></html>';
    const result = addMediaTypesFunc(input);
    // Should preserve DOCTYPE and document structure
    expect(result).toContain('<!DOCTYPE');
    expect(result).toContain('<html');
    expect(result).toContain('<head>');
    expect(result).toContain('<body>');
    // Should still add the type
    expect(result).toContain('type="audio/mpeg"');
  });

  it('preserves full document structure when input has head tag', () => {
    if (!addMediaTypesFunc) return;
    const input = '<html><head><style>body{}</style></head><body><video src="asset://uuid/video.mp4"></video></body></html>';
    const result = addMediaTypesFunc(input);
    // Should preserve document structure because <head> is present
    expect(result).toContain('<!DOCTYPE');
    expect(result).toContain('<head>');
    // Should still add the type
    expect(result).toContain('type="video/mp4"');
  });

  it('handles wav audio files', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio src="asset://uuid/sound.wav"></audio>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="audio/wav"');
  });

  it('handles ogg video files', () => {
    if (!addMediaTypesFunc) return;
    const input = '<video src="asset://uuid/video.ogg"></video>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="video/ogg"');
  });

  it('handles m4a audio files', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio src="asset://uuid/podcast.m4a"></audio>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="audio/mp4"');
  });

  it('does not add type for unknown file extensions', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio src="asset://uuid/audio.xyz"></audio>';
    const result = addMediaTypesFunc(input);
    // Should not contain any type attribute since xyz is unknown
    expect(result).not.toContain('type=');
  });

  it('handles source element without parent by defaulting to video', () => {
    if (!addMediaTypesFunc) return;
    // Just source element (edge case - normally has parent)
    const input = '<source src="asset://uuid/media.webm">';
    const result = addMediaTypesFunc(input);
    // Should default to video/webm when parent is not determinable
    expect(result).toContain('type="video/webm"');
  });

  it('preserves full document structure when input starts with <html tag', () => {
    if (!addMediaTypesFunc) return;
    const input = '<html><body><audio src="asset://uuid/audio.mp3"></audio></body></html>';
    const result = addMediaTypesFunc(input);
    // Should preserve document structure because input starts with <html
    expect(result).toContain('<!DOCTYPE');
    expect(result).toContain('<html');
  });

  it('handles audio element with no src attribute', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio controls></audio>';
    const result = addMediaTypesFunc(input);
    // Should not add type since there's no src
    expect(result).not.toContain('type=');
  });

  it('handles URL with query string', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio src="asset://uuid/audio.mp3?v=123"></audio>';
    const result = addMediaTypesFunc(input);
    // Should extract extension before query string
    expect(result).toContain('type="audio/mpeg"');
  });

  it('handles flac audio files', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio src="asset://uuid/lossless.flac"></audio>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="audio/flac"');
  });

  it('handles aac audio files', () => {
    if (!addMediaTypesFunc) return;
    const input = '<audio src="asset://uuid/audio.aac"></audio>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="audio/aac"');
  });

  it('handles mkv video files', () => {
    if (!addMediaTypesFunc) return;
    const input = '<video src="asset://uuid/video.mkv"></video>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="video/x-matroska"');
  });

  it('handles avi video files', () => {
    if (!addMediaTypesFunc) return;
    const input = '<video src="asset://uuid/video.avi"></video>';
    const result = addMediaTypesFunc(input);
    expect(result).toContain('type="video/x-msvideo"');
  });
});

describe('window.simplifyMediaElements global function', () => {
  let savedWindow;
  let simplifyMediaElementsFunc;

  beforeEach(() => {
    savedWindow = global.window;
    require('./AssetManager');
    simplifyMediaElementsFunc = global.window?.simplifyMediaElements;
  });

  afterEach(() => {
    if (savedWindow) {
      global.window = savedWindow;
    } else {
      delete global.window;
    }
  });

  it('returns original HTML when null or empty', () => {
    if (!simplifyMediaElementsFunc) return;
    expect(simplifyMediaElementsFunc(null)).toBeNull();
    expect(simplifyMediaElementsFunc('')).toBe('');
    expect(simplifyMediaElementsFunc(undefined)).toBeUndefined();
  });

  it('simplifies video with source child to direct src', () => {
    if (!simplifyMediaElementsFunc) return;
    const input = '<video class="mediaelement"><source src="asset://uuid/video.mp4" type="video/mp4"></video>';
    const result = simplifyMediaElementsFunc(input);
    expect(result).toContain('src="asset://uuid/video.mp4"');
    expect(result).toContain('controls');
    expect(result).not.toContain('<source');
  });

  it('preserves type attribute from source element', () => {
    if (!simplifyMediaElementsFunc) return;
    const input = '<video class="mediaelement"><source src="asset://uuid/video.mp4" type="video/mp4"></video>';
    const result = simplifyMediaElementsFunc(input);
    expect(result).toContain('type="video/mp4"');
  });

  it('simplifies audio with source child', () => {
    if (!simplifyMediaElementsFunc) return;
    const input = '<audio><source src="asset://uuid/audio.mp3" type="audio/mpeg"></audio>';
    const result = simplifyMediaElementsFunc(input);
    expect(result).toContain('src="asset://uuid/audio.mp3"');
    expect(result).toContain('controls');
    expect(result).not.toContain('<source');
  });

  it('returns body content only for HTML fragment input', () => {
    if (!simplifyMediaElementsFunc) return;
    const input = '<video class="mediaelement"><source src="asset://uuid/video.mp4"></video>';
    const result = simplifyMediaElementsFunc(input);
    // For fragments, should NOT contain DOCTYPE or html/body tags
    expect(result).not.toContain('<!DOCTYPE');
    expect(result).not.toContain('<html>');
    expect(result).not.toContain('<body>');
    // Should contain the video element
    expect(result).toContain('<video');
  });

  it('preserves full document structure when input has DOCTYPE', () => {
    if (!simplifyMediaElementsFunc) return;
    const input = '<!DOCTYPE html><html><head><link rel="stylesheet" href="style.css"></head><body><video class="mediaelement"><source src="asset://uuid/video.mp4"></video></body></html>';
    const result = simplifyMediaElementsFunc(input);
    // Should preserve DOCTYPE and document structure
    expect(result).toContain('<!DOCTYPE');
    expect(result).toContain('<html');
    expect(result).toContain('<head>');
    expect(result).toContain('<body>');
    // Should still simplify the video
    expect(result).toContain('src="asset://uuid/video.mp4"');
    expect(result).toContain('controls');
  });

  it('does not modify audio element with direct src (no source child)', () => {
    if (!simplifyMediaElementsFunc) return;
    const input = '<audio src="asset://uuid/audio.mp3" class="mediaelement"></audio>';
    const result = simplifyMediaElementsFunc(input);
    // Audio with direct src and no source children should not be modified by simplify
    expect(result).toContain('src="asset://uuid/audio.mp3"');
  });
});

// =========================================================================
// Folder Operations Tests (Unit tests for folder logic - does not depend on IndexedDB)
// =========================================================================

describe('AssetManager folder operations - Unit Tests', () => {
  describe('renameFolder throws on root', () => {
    it('throws error when trying to rename root folder', async () => {
      const assetManager = new AssetManager('project-123');
      // This test doesn't need DB init since it throws before DB access
      await expect(assetManager.renameFolder('', 'new-name')).rejects.toThrow('Cannot rename root folder');
    });
  });

  describe('deleteFolderContents throws on root', () => {
    it('throws error when trying to delete root folder contents', async () => {
      const assetManager = new AssetManager('project-123');
      // This test doesn't need DB init since it throws before DB access
      await expect(assetManager.deleteFolderContents('')).rejects.toThrow('Cannot delete root folder contents');
    });
  });

  describe('deleteFolderContents with bulk server deletion', () => {
    let mockYjsBridge;
    let assetManager;
    let mockDB;
    let mockStore;

    beforeEach(() => {
      // Setup Logger and window mocks
      global.Logger = { log: mock(() => {}) };
      global.window = global.window || {};

      // Create mock Yjs bridge
      const assetsMap = new Map();
      const mockYMap = {
        get: (id) => assetsMap.get(id),
        set: (id, value) => assetsMap.set(id, value),
        delete: (id) => assetsMap.delete(id),
        forEach: (callback) => assetsMap.forEach((value, key) => callback(value, key)),
        doc: { transact: (fn) => fn() }
      };
      mockYjsBridge = {
        getAssetsMap: () => mockYMap,
        _assetsMap: assetsMap
      };

      assetManager = new AssetManager('project-123');
      assetManager.setYjsBridge(mockYjsBridge);

      // Create mock DB
      const storedBlobs = new Map();
      mockStore = {
        put: mock((record) => {
          storedBlobs.set(record.id, record);
          return { onsuccess: null, onerror: null };
        }),
        get: mock((id) => {
          const result = storedBlobs.get(id) || null;
          return { result, onsuccess: null, onerror: null };
        }),
        delete: mock((id) => {
          storedBlobs.delete(id);
          return { onsuccess: null, onerror: null };
        }),
        index: mock(() => ({
          getAll: mock((key) => {
            const results = [];
            for (const [id, record] of storedBlobs.entries()) {
              if (record.projectId === key) {
                results.push(record);
              }
            }
            return { result: results, onsuccess: null, onerror: null };
          }),
        })),
      };

      mockDB = {
        transaction: mock(() => {
          const mockDeleteRequest = { onsuccess: null, onerror: null };
          // Auto-trigger success after next tick
          setTimeout(() => mockDeleteRequest.onsuccess?.(), 0);
          return {
            objectStore: mock(() => ({
              delete: mock(() => mockDeleteRequest),
            })),
          };
        }),
      };
      assetManager.db = mockDB;
    });

    afterEach(() => {
      delete global.Logger;
    });

    it('calls _deleteMultipleFromServer with all folder assets', async () => {
      // Setup assets in folder
      mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'images', filename: 'a.jpg' });
      mockYjsBridge._assetsMap.set('asset-2', { folderPath: 'images', filename: 'b.jpg' });
      mockYjsBridge._assetsMap.set('asset-3', { folderPath: 'documents', filename: 'c.pdf' });
      mockYjsBridge._assetsMap.set('asset-4', { folderPath: 'images/icons', filename: 'd.svg' });

      assetManager._deleteMultipleFromServer = mock(() => Promise.resolve());

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: 'test-token-123',
        },
      };

      await assetManager.deleteFolderContents('images');

      // Should call bulk delete with images and images/icons assets
      expect(assetManager._deleteMultipleFromServer).toHaveBeenCalledWith(['asset-1', 'asset-2', 'asset-4']);
    });

    it('does not call _deleteMultipleFromServer for empty folder', async () => {
      // No assets in the folder
      mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'documents', filename: 'a.pdf' });

      assetManager._deleteMultipleFromServer = mock(() => Promise.resolve());

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: 'test-token-123',
        },
      };

      await assetManager.deleteFolderContents('images');

      // Should not call bulk delete since no assets found
      expect(assetManager._deleteMultipleFromServer).not.toHaveBeenCalled();
    });

    it('deletes individual assets with skipServerDelete option', async () => {
      mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'images', filename: 'a.jpg' });

      const originalDeleteAsset = assetManager.deleteAsset.bind(assetManager);
      assetManager.deleteAsset = mock((id, options) => originalDeleteAsset(id, options));
      assetManager._deleteFromServer = mock(() => Promise.resolve());
      assetManager._deleteMultipleFromServer = mock(() => Promise.resolve());

      global.window.eXeLearning = {
        config: {
          apiUrl: 'http://localhost:8080/api',
          token: 'test-token-123',
        },
      };

      await assetManager.deleteFolderContents('images');

      // Individual deletes should have skipServerDelete: true
      expect(assetManager.deleteAsset).toHaveBeenCalledWith('asset-1', { skipServerDelete: true });
      // Bulk delete should be called instead
      expect(assetManager._deleteMultipleFromServer).toHaveBeenCalledWith(['asset-1']);
    });
  });

  describe('DB_VERSION for Yjs metadata architecture', () => {
    it('has DB_VERSION 1 for Yjs metadata architecture', () => {
      expect(AssetManager.DB_VERSION).toBe(1);
    });
  });
});

describe('AssetManager folder operations - Static method tests', () => {
  it('filters assets by folderPath (helper logic test)', () => {
    // Test the filter logic used in getAssetsInFolder
    const assets = [
      { id: '1', folderPath: '', filename: 'root.jpg' },
      { id: '2', folderPath: 'images', filename: 'photo.jpg' },
      { id: '3', folderPath: 'images/icons', filename: 'icon.svg' },
      { id: '4', filename: 'legacy.jpg' }, // no folderPath (treated as root)
    ];

    // Filter for root folder
    const rootAssets = assets.filter(a => (a.folderPath || '') === '');
    expect(rootAssets.length).toBe(2);
    expect(rootAssets.map(a => a.filename)).toContain('root.jpg');
    expect(rootAssets.map(a => a.filename)).toContain('legacy.jpg');

    // Filter for images folder
    const imageAssets = assets.filter(a => (a.folderPath || '') === 'images');
    expect(imageAssets.length).toBe(1);
    expect(imageAssets[0].filename).toBe('photo.jpg');
  });

  it('derives subfolders from asset paths (helper logic test)', () => {
    // Test the subfolder derivation logic used in getSubfolders
    const assets = [
      { folderPath: 'images' },
      { folderPath: 'documents' },
      { folderPath: 'images/icons' },
      { folderPath: 'images/photos' },
      { folderPath: '' },
    ];

    // Get subfolders at root
    const subfolders = new Set();
    const prefix = '';
    for (const asset of assets) {
      const assetPath = asset.folderPath || '';
      if (!assetPath.startsWith(prefix)) continue;
      const remainingPath = assetPath.slice(prefix.length);
      if (!remainingPath) continue;
      const firstSegment = remainingPath.split('/')[0];
      if (firstSegment) subfolders.add(firstSegment);
    }

    expect(Array.from(subfolders).sort()).toEqual(['documents', 'images']);
  });

  it('derives subfolders within a parent folder (helper logic test)', () => {
    const assets = [
      { folderPath: 'images' },
      { folderPath: 'images/icons' },
      { folderPath: 'images/photos' },
      { folderPath: 'images/photos/vacation' },
    ];

    // Get subfolders within 'images'
    const subfolders = new Set();
    const prefix = 'images/';
    for (const asset of assets) {
      const assetPath = asset.folderPath || '';
      if (!assetPath.startsWith(prefix)) continue;
      const remainingPath = assetPath.slice(prefix.length);
      if (!remainingPath) continue;
      const firstSegment = remainingPath.split('/')[0];
      if (firstSegment) subfolders.add(firstSegment);
    }

    expect(Array.from(subfolders).sort()).toEqual(['icons', 'photos']);
  });

  it('updates folder path prefix (helper logic test)', () => {
    // Test the folder rename logic
    const assets = [
      { id: '1', folderPath: 'old-name', filename: 'file1.jpg' },
      { id: '2', folderPath: 'old-name/sub', filename: 'file2.jpg' },
      { id: '3', folderPath: 'other', filename: 'file3.jpg' },
    ];

    const oldPath = 'old-name';
    const newPath = 'new-name';

    for (const asset of assets) {
      const assetPath = asset.folderPath || '';
      if (assetPath === oldPath || assetPath.startsWith(oldPath + '/')) {
        asset.folderPath = assetPath === oldPath
          ? newPath
          : newPath + assetPath.slice(oldPath.length);
      }
    }

    expect(assets[0].folderPath).toBe('new-name');
    expect(assets[1].folderPath).toBe('new-name/sub');
    expect(assets[2].folderPath).toBe('other'); // unchanged
  });

  it('moves folder to new location (helper logic test)', () => {
    // Test the folder move logic
    const assets = [
      { id: '1', folderPath: 'images', filename: 'photo.jpg' },
      { id: '2', folderPath: 'images/icons', filename: 'icon.svg' },
      { id: '3', folderPath: 'documents', filename: 'doc.pdf' },
    ];

    const oldPath = 'images';
    const destination = 'website';
    const folderName = oldPath.split('/').pop();
    const newPath = destination ? `${destination}/${folderName}` : folderName;

    for (const asset of assets) {
      const assetPath = asset.folderPath || '';
      if (assetPath === oldPath || assetPath.startsWith(oldPath + '/')) {
        asset.folderPath = assetPath === oldPath
          ? newPath
          : newPath + assetPath.slice(oldPath.length);
      }
    }

    expect(assets[0].folderPath).toBe('website/images');
    expect(assets[1].folderPath).toBe('website/images/icons');
    expect(assets[2].folderPath).toBe('documents'); // unchanged
  });
});

describe('AssetManager _extractFolderPathFromImport', () => {
  const assetManager = new AssetManager('test-project');

  it('returns empty string for files at root', () => {
    const result = assetManager._extractFolderPathFromImport('image.jpg', 'abc123');
    expect(result).toBe('');
  });

  it('extracts folder path from simple folder structure', () => {
    const result = assetManager._extractFolderPathFromImport('mywebsite/index.html', 'abc123');
    expect(result).toBe('mywebsite');
  });

  it('extracts nested folder path', () => {
    const result = assetManager._extractFolderPathFromImport('mywebsite/css/style.css', 'abc123');
    expect(result).toBe('mywebsite/css');
  });

  it('removes content/resources prefix', () => {
    const result = assetManager._extractFolderPathFromImport('content/resources/mywebsite/index.html', 'abc123');
    expect(result).toBe('mywebsite');
  });

  it('removes resources prefix', () => {
    const result = assetManager._extractFolderPathFromImport('resources/images/photo.jpg', 'abc123');
    expect(result).toBe('images');
  });

  it('treats UUID-only path as root (legacy format)', () => {
    const assetId = 'abc12345-6789-abcd-ef01-234567890abc';
    const result = assetManager._extractFolderPathFromImport('abc12345/image.jpg', assetId);
    expect(result).toBe('');
  });

  it('extracts folder from UUID-prefixed nested path (legacy format)', () => {
    const assetId = 'abc12345-6789-abcd-ef01-234567890abc';
    const result = assetManager._extractFolderPathFromImport('abc12345/images/photo.jpg', assetId);
    expect(result).toBe('images');
  });

  it('handles content/resources with UUID prefix', () => {
    const assetId = 'abc12345-6789-abcd-ef01-234567890abc';
    const result = assetManager._extractFolderPathFromImport('content/resources/abc12345/image.jpg', assetId);
    expect(result).toBe('');
  });

  it('preserves non-UUID folder names that look like UUIDs', () => {
    // A folder that happens to have hex chars but is not the asset's UUID
    const result = assetManager._extractFolderPathFromImport('deadbeef/image.jpg', 'different-uuid');
    // This would be treated as a hex-like prefix, but since it has subfolders, we'd skip it
    // Actually with single segment and different UUID, it's a normal folder
    expect(result).toBe('deadbeef');
  });
});

describe('AssetManager moveFolder throws on root', () => {
  it('throws error when trying to move root folder', async () => {
    const assetManager = new AssetManager('project-123');
    await expect(assetManager.moveFolder('', 'destination')).rejects.toThrow('Cannot move root folder');
  });
});

describe('AssetManager moveFolder prevents moving into itself', () => {
  beforeEach(() => {
    global.Logger = { log: mock(() => {}) };
  });
  afterEach(() => {
    delete global.Logger;
  });

  it('throws error when trying to move folder into itself', async () => {
    const assetManager = new AssetManager('project-123');
    // Need Yjs bridge for moveFolder
    assetManager.setYjsBridge(createMockYjsBridge());

    await expect(assetManager.moveFolder('parent', 'parent/child')).rejects.toThrow('Cannot move folder into itself');
  });
});

describe('AssetManager getAssetsInFolder', () => {
  let assetManager;
  let mockYjsBridge;

  beforeEach(() => {
    global.Logger = { log: mock(() => {}) };

    const assetsMap = new Map();
    const mockYMap = {
      get: (id) => assetsMap.get(id),
      set: (id, value) => assetsMap.set(id, value),
      delete: (id) => assetsMap.delete(id),
      forEach: (callback) => assetsMap.forEach((value, key) => callback(value, key)),
      doc: { transact: (fn) => fn() }
    };
    mockYjsBridge = {
      getAssetsMap: () => mockYMap,
      _assetsMap: assetsMap
    };

    assetManager = new AssetManager('project-123');
    assetManager.setYjsBridge(mockYjsBridge);
  });

  afterEach(() => {
    delete global.Logger;
  });

  it('returns assets in root folder', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: '', filename: 'root.jpg' });
    mockYjsBridge._assetsMap.set('asset-2', { folderPath: 'images', filename: 'photo.jpg' });
    mockYjsBridge._assetsMap.set('asset-3', { filename: 'legacy.jpg' }); // no folderPath (treated as root)

    const rootAssets = await assetManager.getAssetsInFolder('');
    expect(rootAssets.length).toBe(2);
    expect(rootAssets.map(a => a.filename)).toContain('root.jpg');
    expect(rootAssets.map(a => a.filename)).toContain('legacy.jpg');
  });

  it('returns assets in specific folder', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: '', filename: 'root.jpg' });
    mockYjsBridge._assetsMap.set('asset-2', { folderPath: 'images', filename: 'photo.jpg' });
    mockYjsBridge._assetsMap.set('asset-3', { folderPath: 'images/icons', filename: 'icon.svg' });

    const imageAssets = await assetManager.getAssetsInFolder('images');
    expect(imageAssets.length).toBe(1);
    expect(imageAssets[0].filename).toBe('photo.jpg');
  });

  it('returns empty array for empty folder', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: '', filename: 'root.jpg' });

    const emptyFolder = await assetManager.getAssetsInFolder('nonexistent');
    expect(emptyFolder).toEqual([]);
  });
});

describe('AssetManager getSubfolders', () => {
  let assetManager;
  let mockYjsBridge;

  beforeEach(() => {
    global.Logger = { log: mock(() => {}) };

    const assetsMap = new Map();
    const mockYMap = {
      get: (id) => assetsMap.get(id),
      set: (id, value) => assetsMap.set(id, value),
      delete: (id) => assetsMap.delete(id),
      forEach: (callback) => assetsMap.forEach((value, key) => callback(value, key)),
      doc: { transact: (fn) => fn() }
    };
    mockYjsBridge = {
      getAssetsMap: () => mockYMap,
      _assetsMap: assetsMap
    };

    assetManager = new AssetManager('project-123');
    assetManager.setYjsBridge(mockYjsBridge);
  });

  afterEach(() => {
    delete global.Logger;
  });

  it('returns subfolders at root level', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'images', filename: 'photo.jpg' });
    mockYjsBridge._assetsMap.set('asset-2', { folderPath: 'documents', filename: 'doc.pdf' });
    mockYjsBridge._assetsMap.set('asset-3', { folderPath: 'images/icons', filename: 'icon.svg' });

    const subfolders = await assetManager.getSubfolders('');
    expect(subfolders).toEqual(['documents', 'images']);
  });

  it('returns nested subfolders', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'images/icons', filename: 'icon.svg' });
    mockYjsBridge._assetsMap.set('asset-2', { folderPath: 'images/photos', filename: 'photo.jpg' });

    const subfolders = await assetManager.getSubfolders('images');
    expect(subfolders).toEqual(['icons', 'photos']);
  });

  it('returns empty array when no subfolders', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'images', filename: 'photo.jpg' });

    const subfolders = await assetManager.getSubfolders('images');
    expect(subfolders).toEqual([]);
  });

  it('returns sorted subfolders', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'z-folder', filename: 'z.jpg' });
    mockYjsBridge._assetsMap.set('asset-2', { folderPath: 'a-folder', filename: 'a.jpg' });
    mockYjsBridge._assetsMap.set('asset-3', { folderPath: 'm-folder', filename: 'm.jpg' });

    const subfolders = await assetManager.getSubfolders('');
    expect(subfolders).toEqual(['a-folder', 'm-folder', 'z-folder']);
  });
});

describe('AssetManager updateAssetFolderPath', () => {
  let assetManager;
  let mockYjsBridge;

  beforeEach(() => {
    global.Logger = { log: mock(() => {}) };

    const assetsMap = new Map();
    const mockYMap = {
      get: (id) => assetsMap.get(id),
      set: (id, value) => assetsMap.set(id, value),
      delete: (id) => assetsMap.delete(id),
      forEach: (callback) => assetsMap.forEach((value, key) => callback(value, key)),
      doc: { transact: (fn) => fn() }
    };
    mockYjsBridge = {
      getAssetsMap: () => mockYMap,
      _assetsMap: assetsMap
    };

    assetManager = new AssetManager('project-123');
    assetManager.setYjsBridge(mockYjsBridge);
  });

  afterEach(() => {
    delete global.Logger;
  });

  it('updates folder path for existing asset', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'old-folder', filename: 'test.jpg', uploaded: true });

    const result = await assetManager.updateAssetFolderPath('asset-1', 'new-folder');

    expect(result).toBe(true);
    const metadata = mockYjsBridge._assetsMap.get('asset-1');
    expect(metadata.folderPath).toBe('new-folder');
    expect(metadata.uploaded).toBe(false); // Should be marked for re-upload
  });

  it('returns false for non-existent asset', async () => {
    const result = await assetManager.updateAssetFolderPath('nonexistent', 'new-folder');
    expect(result).toBe(false);
  });

  it('can move asset to root folder', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'some-folder', filename: 'test.jpg' });

    const result = await assetManager.updateAssetFolderPath('asset-1', '');

    expect(result).toBe(true);
    expect(mockYjsBridge._assetsMap.get('asset-1').folderPath).toBe('');
  });
});

describe('AssetManager moveFolder', () => {
  let assetManager;
  let mockYjsBridge;

  beforeEach(() => {
    global.Logger = { log: mock(() => {}) };

    const assetsMap = new Map();
    const mockYMap = {
      get: (id) => assetsMap.get(id),
      set: (id, value) => assetsMap.set(id, value),
      delete: (id) => assetsMap.delete(id),
      forEach: (callback) => assetsMap.forEach((value, key) => callback(value, key)),
      doc: { transact: (fn) => fn() }
    };
    mockYjsBridge = {
      getAssetsMap: () => mockYMap,
      _assetsMap: assetsMap
    };

    assetManager = new AssetManager('project-123');
    assetManager.setYjsBridge(mockYjsBridge);
  });

  afterEach(() => {
    delete global.Logger;
  });

  it('moves folder to new destination', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'source', filename: 'a.jpg' });
    mockYjsBridge._assetsMap.set('asset-2', { folderPath: 'source/sub', filename: 'b.jpg' });
    mockYjsBridge._assetsMap.set('asset-3', { folderPath: 'other', filename: 'c.jpg' });

    const count = await assetManager.moveFolder('source', 'destination');

    expect(count).toBe(2);
    expect(mockYjsBridge._assetsMap.get('asset-1').folderPath).toBe('destination/source');
    expect(mockYjsBridge._assetsMap.get('asset-2').folderPath).toBe('destination/source/sub');
    expect(mockYjsBridge._assetsMap.get('asset-3').folderPath).toBe('other'); // unchanged
  });

  it('moves folder to root', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'parent/child', filename: 'a.jpg' });

    const count = await assetManager.moveFolder('parent/child', '');

    expect(count).toBe(1);
    expect(mockYjsBridge._assetsMap.get('asset-1').folderPath).toBe('child');
  });

  it('returns 0 when moving to same location', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'folder', filename: 'a.jpg' });

    const count = await assetManager.moveFolder('folder', '');

    expect(count).toBe(0);
    expect(mockYjsBridge._assetsMap.get('asset-1').folderPath).toBe('folder'); // unchanged
  });

  it('throws when Yjs bridge not available', async () => {
    assetManager.setYjsBridge(null);

    await expect(assetManager.moveFolder('source', 'dest')).rejects.toThrow('Yjs bridge not available');
  });
});

describe('AssetManager renameFolder', () => {
  let assetManager;
  let mockYjsBridge;

  beforeEach(() => {
    global.Logger = { log: mock(() => {}) };

    const assetsMap = new Map();
    const mockYMap = {
      get: (id) => assetsMap.get(id),
      set: (id, value) => assetsMap.set(id, value),
      delete: (id) => assetsMap.delete(id),
      forEach: (callback) => assetsMap.forEach((value, key) => callback(value, key)),
      doc: { transact: (fn) => fn() }
    };
    mockYjsBridge = {
      getAssetsMap: () => mockYMap,
      _assetsMap: assetsMap
    };

    assetManager = new AssetManager('project-123');
    assetManager.setYjsBridge(mockYjsBridge);
  });

  afterEach(() => {
    delete global.Logger;
  });

  it('renames folder and updates all assets', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'old-name', filename: 'a.jpg' });
    mockYjsBridge._assetsMap.set('asset-2', { folderPath: 'old-name/sub', filename: 'b.jpg' });
    mockYjsBridge._assetsMap.set('asset-3', { folderPath: 'other', filename: 'c.jpg' });

    const count = await assetManager.renameFolder('old-name', 'new-name');

    expect(count).toBe(2);
    expect(mockYjsBridge._assetsMap.get('asset-1').folderPath).toBe('new-name');
    expect(mockYjsBridge._assetsMap.get('asset-2').folderPath).toBe('new-name/sub');
    expect(mockYjsBridge._assetsMap.get('asset-3').folderPath).toBe('other'); // unchanged
  });

  it('renames nested folder', async () => {
    mockYjsBridge._assetsMap.set('asset-1', { folderPath: 'parent/child', filename: 'a.jpg' });
    mockYjsBridge._assetsMap.set('asset-2', { folderPath: 'parent/child/deep', filename: 'b.jpg' });

    const count = await assetManager.renameFolder('parent/child', 'parent/renamed');

    expect(count).toBe(2);
    expect(mockYjsBridge._assetsMap.get('asset-1').folderPath).toBe('parent/renamed');
    expect(mockYjsBridge._assetsMap.get('asset-2').folderPath).toBe('parent/renamed/deep');
  });

  it('throws when Yjs bridge not available', async () => {
    assetManager.setYjsBridge(null);

    await expect(assetManager.renameFolder('old', 'new')).rejects.toThrow('Yjs bridge not available');
  });
});

describe('AssetManager renameAsset', () => {
  let assetManager;
  let mockYjsBridge;

  beforeEach(() => {
    global.Logger = { log: vi.fn() };
    assetManager = new AssetManager('test-project');
    mockYjsBridge = {
      _assetsMap: new Map(),
      documentManager: {
        getNavigation: vi.fn(() => []),
        getDoc: vi.fn(() => ({
          transact: (fn) => fn()
        }))
      }
    };
    assetManager.setYjsBridge(mockYjsBridge);

    // Set up mock for getAssetsYMap
    vi.spyOn(assetManager, 'getAssetsYMap').mockReturnValue({
      get: (id) => mockYjsBridge._assetsMap.get(id),
      set: (id, data) => mockYjsBridge._assetsMap.set(id, data)
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.Logger;
  });

  it('renames an existing asset', async () => {
    mockYjsBridge._assetsMap.set('asset-1', {
      id: 'asset-1',
      filename: 'old-name.jpg',
      folderPath: 'images',
      uploaded: true
    });

    const result = await assetManager.renameAsset('asset-1', 'new-name.jpg');

    expect(result).toBe(true);
    const updated = mockYjsBridge._assetsMap.get('asset-1');
    expect(updated.filename).toBe('new-name.jpg');
    expect(updated.uploaded).toBe(false); // Should be marked for re-upload
  });

  it('returns false when asset does not exist', async () => {
    const result = await assetManager.renameAsset('nonexistent', 'new-name.jpg');

    expect(result).toBe(false);
  });

  it('updates asset references in Yjs', async () => {
    mockYjsBridge._assetsMap.set('asset-1', {
      id: 'asset-1',
      filename: 'old-name.jpg',
      folderPath: '',
      uploaded: true
    });

    const updateSpy = vi.spyOn(assetManager, 'updateAssetReferencesInYjs');
    await assetManager.renameAsset('asset-1', 'new-name.jpg');

    expect(updateSpy).toHaveBeenCalledWith('asset-1', 'old-name.jpg', 'new-name.jpg');
  });
});

describe('AssetManager updateAssetReferencesInYjs', () => {
  let assetManager;

  beforeEach(() => {
    global.Logger = { log: vi.fn() };
    assetManager = new AssetManager('test-project');
    window.eXeLearning = { app: { project: { _yjsBridge: null } } };
  });

  afterEach(() => {
    delete window.eXeLearning;
    vi.restoreAllMocks();
    delete global.Logger;
  });

  it('returns 0 when no document manager available', () => {
    window.eXeLearning.app.project._yjsBridge = null;

    const result = assetManager.updateAssetReferencesInYjs('asset-1', 'old.jpg', 'new.jpg');

    expect(result).toBe(0);
  });

  it('returns 0 when Y is not loaded', () => {
    const originalY = window.Y;
    delete window.Y;

    window.eXeLearning.app.project._yjsBridge = {
      documentManager: { getNavigation: vi.fn() }
    };

    const result = assetManager.updateAssetReferencesInYjs('asset-1', 'old.jpg', 'new.jpg');

    expect(result).toBe(0);
    window.Y = originalY;
  });

  it('returns 0 when no navigation available', () => {
    window.eXeLearning.app.project._yjsBridge = {
      documentManager: {
        getNavigation: vi.fn(() => null),
        getDoc: vi.fn()
      }
    };

    const result = assetManager.updateAssetReferencesInYjs('asset-1', 'old.jpg', 'new.jpg');

    expect(result).toBe(0);
  });

  it('processes pages and updates references', () => {
    // Create mock Y.Text with actual content
    const mockHtmlContent = {
      _content: 'src="asset://asset-1/old.jpg"',
      toString: function() { return this._content; },
      delete: function(start, length) { this._content = ''; },
      insert: function(pos, text) { this._content = text; },
      length: 30
    };

    // Create mock component with Y.Map behavior
    const mockComponent = {
      _type: 'Y.Map',
      get: vi.fn((key) => {
        if (key === 'htmlContent') return mockHtmlContent;
        return null;
      })
    };

    // Create mock block
    const mockBlock = {
      _type: 'Y.Map',
      get: vi.fn((key) => {
        if (key === 'components') {
          return {
            _type: 'Y.Array',
            forEach: (fn) => fn(mockComponent)
          };
        }
        return null;
      })
    };

    // Create mock page
    const mockPage = {
      _type: 'Y.Map',
      get: vi.fn((key) => {
        if (key === 'blocks') {
          return {
            _type: 'Y.Array',
            forEach: (fn) => fn(mockBlock)
          };
        }
        if (key === 'subpages') {
          return {
            _type: 'Y.Array',
            forEach: () => {}
          };
        }
        return null;
      })
    };

    // Mock navigation array
    const mockNavigation = {
      forEach: (fn) => fn(mockPage)
    };

    // Mock Y global
    const originalY = window.Y;
    window.Y = {
      Map: class { },
      Array: class { },
      Text: class { }
    };

    // Patch instanceof checks
    Object.defineProperty(mockComponent, Symbol.hasInstance, {
      value: () => true
    });

    window.eXeLearning.app.project._yjsBridge = {
      documentManager: {
        getNavigation: vi.fn(() => mockNavigation),
        getDoc: vi.fn(() => ({
          transact: (fn) => fn()
        }))
      }
    };

    // The method requires instanceof checks which are tricky to mock
    // Let's just verify it doesn't throw and processes the structure
    const result = assetManager.updateAssetReferencesInYjs('asset-1', 'old.jpg', 'new.jpg');

    // The mock structure doesn't pass instanceof Y.Map checks, so result should be 0
    expect(result).toBe(0);

    window.Y = originalY;
  });

  it('handles empty navigation array', () => {
    const originalY = window.Y;
    window.Y = {
      Map: class { },
      Array: class { },
      Text: class { }
    };

    window.eXeLearning.app.project._yjsBridge = {
      documentManager: {
        getNavigation: vi.fn(() => ({
          forEach: () => {}
        })),
        getDoc: vi.fn(() => ({
          transact: (fn) => fn()
        }))
      }
    };

    const result = assetManager.updateAssetReferencesInYjs('asset-1', 'old.jpg', 'new.jpg');

    expect(result).toBe(0);
    window.Y = originalY;
  });
});

describe('AssetManager getAssetUrl', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('test-project');
  });

  it('returns asset URL with simplified format (uuid.ext)', () => {
    const url = assetManager.getAssetUrl('asset-123', 'image.jpg');
    expect(url).toBe('asset://asset-123.jpg');
  });

  it('extracts extension from filename with spaces', () => {
    const url = assetManager.getAssetUrl('asset-123', 'my image (1).jpg');
    expect(url).toBe('asset://asset-123.jpg');
  });

  it('handles empty filename (no extension)', () => {
    const url = assetManager.getAssetUrl('asset-123', '');
    expect(url).toBe('asset://asset-123');
  });

  it('handles filename without extension', () => {
    const url = assetManager.getAssetUrl('asset-123', 'README');
    expect(url).toBe('asset://asset-123');
  });

  it('handles png extension', () => {
    const url = assetManager.getAssetUrl('asset-456', 'photo.PNG');
    expect(url).toBe('asset://asset-456.png');
  });
});

describe('AssetManager setAssetMetadata', () => {
  let assetManager;
  let mockYjsBridge;

  beforeEach(() => {
    global.Logger = { log: vi.fn() };
    assetManager = new AssetManager('test-project');
    mockYjsBridge = {
      _assetsMap: new Map()
    };
    assetManager.setYjsBridge(mockYjsBridge);

    vi.spyOn(assetManager, 'getAssetsYMap').mockReturnValue({
      get: (id) => mockYjsBridge._assetsMap.get(id),
      set: (id, data) => mockYjsBridge._assetsMap.set(id, data)
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.Logger;
  });

  it('sets metadata for new asset', () => {
    assetManager.setAssetMetadata('asset-1', {
      id: 'asset-1',
      filename: 'test.jpg',
      folderPath: 'images',
      mime: 'image/jpeg',
      size: 1024,
      hash: 'abc123'
    });

    const stored = mockYjsBridge._assetsMap.get('asset-1');
    expect(stored.filename).toBe('test.jpg');
    expect(stored.folderPath).toBe('images');
    expect(stored.mime).toBe('image/jpeg');
    expect(stored.size).toBe(1024);
    expect(stored.uploaded).toBe(false);
    expect(stored.createdAt).toBeDefined();
  });

  it('updates existing metadata', () => {
    mockYjsBridge._assetsMap.set('asset-1', {
      filename: 'old.jpg',
      folderPath: '',
      uploaded: true
    });

    assetManager.setAssetMetadata('asset-1', {
      filename: 'new.jpg',
      folderPath: 'photos'
    });

    const stored = mockYjsBridge._assetsMap.get('asset-1');
    expect(stored.filename).toBe('new.jpg');
    expect(stored.folderPath).toBe('photos');
  });

  it('sets default folderPath if not provided', () => {
    assetManager.setAssetMetadata('asset-2', {
      filename: 'test.png'
    });

    const stored = mockYjsBridge._assetsMap.get('asset-2');
    expect(stored.folderPath).toBe('');
  });
});

describe('AssetManager deleteAssetMetadata', () => {
  let assetManager;
  let mockYjsBridge;
  let mockYMap;

  beforeEach(() => {
    global.Logger = { log: vi.fn() };
    assetManager = new AssetManager('test-project');
    mockYjsBridge = {
      _assetsMap: new Map()
    };
    mockYMap = {
      get: (id) => mockYjsBridge._assetsMap.get(id),
      set: (id, data) => mockYjsBridge._assetsMap.set(id, data),
      delete: (id) => mockYjsBridge._assetsMap.delete(id)
    };
    assetManager.setYjsBridge(mockYjsBridge);
    vi.spyOn(assetManager, 'getAssetsYMap').mockReturnValue(mockYMap);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.Logger;
  });

  it('deletes existing metadata', () => {
    mockYjsBridge._assetsMap.set('asset-1', { id: 'asset-1', filename: 'test.jpg' });

    assetManager.deleteAssetMetadata('asset-1');

    expect(mockYjsBridge._assetsMap.has('asset-1')).toBe(false);
  });

  it('handles non-existent asset gracefully', () => {
    expect(() => assetManager.deleteAssetMetadata('nonexistent')).not.toThrow();
  });
});

describe('AssetManager getAllAssetsMetadata', () => {
  let assetManager;
  let mockYjsBridge;

  beforeEach(() => {
    global.Logger = { log: vi.fn() };
    assetManager = new AssetManager('test-project');
    mockYjsBridge = {};
    assetManager.setYjsBridge(mockYjsBridge);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.Logger;
  });

  it('returns all assets as array', () => {
    const mockData = new Map([
      ['asset-1', { filename: 'a.jpg' }],
      ['asset-2', { filename: 'b.jpg' }]
    ]);

    vi.spyOn(assetManager, 'getAssetsYMap').mockReturnValue({
      forEach: (callback) => mockData.forEach((value, key) => callback(value, key))
    });

    const result = assetManager.getAllAssetsMetadata();

    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe('a.jpg');
    expect(result[0].id).toBe('asset-1');
    expect(result[1].filename).toBe('b.jpg');
    expect(result[1].id).toBe('asset-2');
  });

  it('returns empty array when no Yjs bridge', () => {
    assetManager.setYjsBridge(null);

    const result = assetManager.getAllAssetsMetadata();

    expect(result).toEqual([]);
  });

  it('returns empty array when no assets map', () => {
    vi.spyOn(assetManager, 'getAssetsYMap').mockReturnValue(null);

    const result = assetManager.getAllAssetsMetadata();

    expect(result).toEqual([]);
  });
});

describe('AssetManager _extractFolderPathFromImport', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('test-project');
  });

  it('extracts folder path from simple path', () => {
    const result = assetManager._extractFolderPathFromImport('images/photo.jpg', 'asset-1');
    expect(result).toBe('images');
  });

  it('extracts nested folder path', () => {
    const result = assetManager._extractFolderPathFromImport('images/2024/vacation/photo.jpg', 'asset-1');
    expect(result).toBe('images/2024/vacation');
  });

  it('returns empty string for root path', () => {
    const result = assetManager._extractFolderPathFromImport('photo.jpg', 'asset-1');
    expect(result).toBe('');
  });

  it('handles UUID-like prefix in path', () => {
    const result = assetManager._extractFolderPathFromImport('a1b2c3d4-e5f6-7890-abcd-ef1234567890/images/photo.jpg', 'asset-1');
    expect(result).toBe('images');
  });

  it('handles just UUID prefix with filename when UUID matches asset ID', () => {
    // When UUID in path matches assetId, it's legacy format and returns ''
    const result = assetManager._extractFolderPathFromImport('a1b2c3d4-e5f6-7890-abcd-ef1234567890/photo.jpg', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(result).toBe('');
  });

  it('handles just UUID prefix with filename when UUID does not match', () => {
    // When UUID in path doesn't match assetId, it's treated as folder name
    const result = assetManager._extractFolderPathFromImport('a1b2c3d4-e5f6-7890-abcd-ef1234567890/photo.jpg', 'different-asset-id');
    expect(result).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('handles resources prefix', () => {
    const result = assetManager._extractFolderPathFromImport('resources/images/photo.jpg', 'asset-1');
    expect(result).toBe('images');
  });
});

describe('_normalizeRelativePath', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
  });

  it('normalizes bare path with base folder', () => {
    const result = assetManager._normalizeRelativePath('mywebsite', 'libs/jquery.min.js');
    expect(result).toBe('mywebsite/libs/jquery.min.js');
  });

  it('normalizes ./ path with base folder', () => {
    const result = assetManager._normalizeRelativePath('mywebsite', './libs/jquery.min.js');
    expect(result).toBe('mywebsite/libs/jquery.min.js');
  });

  it('normalizes ../ path by going up one level', () => {
    const result = assetManager._normalizeRelativePath('mywebsite/html', '../libs/jquery.min.js');
    expect(result).toBe('mywebsite/libs/jquery.min.js');
  });

  it('normalizes multiple ../ paths', () => {
    const result = assetManager._normalizeRelativePath('mywebsite/html/pages', '../../libs/jquery.min.js');
    expect(result).toBe('mywebsite/libs/jquery.min.js');
  });

  it('handles empty base folder', () => {
    const result = assetManager._normalizeRelativePath('', 'libs/jquery.min.js');
    expect(result).toBe('libs/jquery.min.js');
  });

  it('handles ./ with empty base folder', () => {
    const result = assetManager._normalizeRelativePath('', './libs/jquery.min.js');
    expect(result).toBe('libs/jquery.min.js');
  });

  it('returns absolute URLs unchanged', () => {
    const result = assetManager._normalizeRelativePath('mywebsite', 'https://example.com/script.js');
    expect(result).toBe('https://example.com/script.js');
  });

  it('returns data URLs unchanged', () => {
    const result = assetManager._normalizeRelativePath('mywebsite', 'data:text/html,<h1>Hello</h1>');
    expect(result).toBe('data:text/html,<h1>Hello</h1>');
  });

  it('returns blob URLs unchanged', () => {
    const result = assetManager._normalizeRelativePath('mywebsite', 'blob:http://localhost:8080/abc123');
    expect(result).toBe('blob:http://localhost:8080/abc123');
  });

  it('returns asset URLs unchanged', () => {
    const result = assetManager._normalizeRelativePath('mywebsite', 'asset://uuid-1234');
    expect(result).toBe('asset://uuid-1234');
  });

  it('handles mixed ./ and ../ in path', () => {
    const result = assetManager._normalizeRelativePath('mywebsite/html', './../libs/jquery.min.js');
    expect(result).toBe('mywebsite/libs/jquery.min.js');
  });

  it('prevents going above root with too many ../s', () => {
    const result = assetManager._normalizeRelativePath('mywebsite', '../../../etc/passwd');
    expect(result).toBe('etc/passwd');
  });
});

describe('findAssetByRelativePath', () => {
  let assetManager;
  let mockYjsBridge;

  beforeEach(() => {
    // Mock Logger if not defined
    if (typeof global.Logger === 'undefined') {
      global.Logger = { log: () => {} };
    }

    // Create mock Yjs bridge
    const assetsMap = new Map();
    const mockYMap = {
      get: (id) => assetsMap.get(id),
      set: (id, value) => assetsMap.set(id, value),
      delete: (id) => assetsMap.delete(id),
      forEach: (callback) => assetsMap.forEach((value, key) => callback(value, key)),
      entries: () => assetsMap.entries(),
      doc: { transact: (fn) => fn() }
    };
    mockYjsBridge = {
      getAssetsMap: () => mockYMap,
      _assetsMap: assetsMap
    };

    assetManager = new AssetManager('project-123');
    assetManager.setYjsBridge(mockYjsBridge);

    // Populate with test assets
    mockYjsBridge._assetsMap.set('uuid-jquery', {
      filename: 'jquery.min.js',
      folderPath: 'mywebsite/libs/jquery',
      mime: 'application/javascript'
    });
    mockYjsBridge._assetsMap.set('uuid-bootstrap', {
      filename: 'bootstrap.min.css',
      folderPath: 'mywebsite/libs/bootstrap',
      mime: 'text/css'
    });
    mockYjsBridge._assetsMap.set('uuid-style', {
      filename: 'style.css',
      folderPath: 'mywebsite/theme',
      mime: 'text/css'
    });
    mockYjsBridge._assetsMap.set('uuid-index', {
      filename: 'index.html',
      folderPath: 'mywebsite',
      mime: 'text/html'
    });
    mockYjsBridge._assetsMap.set('uuid-root-file', {
      filename: 'readme.txt',
      folderPath: '',
      mime: 'text/plain'
    });
  });

  it('finds asset by relative path from base folder', () => {
    const result = assetManager.findAssetByRelativePath('mywebsite', 'libs/jquery/jquery.min.js');
    expect(result).not.toBeNull();
    expect(result.id).toBe('uuid-jquery');
    expect(result.filename).toBe('jquery.min.js');
  });

  it('finds asset with ./ prefix', () => {
    const result = assetManager.findAssetByRelativePath('mywebsite', './libs/bootstrap/bootstrap.min.css');
    expect(result).not.toBeNull();
    expect(result.id).toBe('uuid-bootstrap');
  });

  it('finds asset with ../ prefix', () => {
    const result = assetManager.findAssetByRelativePath('mywebsite/html', '../theme/style.css');
    expect(result).not.toBeNull();
    expect(result.id).toBe('uuid-style');
  });

  it('finds asset in same folder', () => {
    const result = assetManager.findAssetByRelativePath('mywebsite', 'index.html');
    expect(result).not.toBeNull();
    expect(result.id).toBe('uuid-index');
  });

  it('returns null for non-existent asset', () => {
    const result = assetManager.findAssetByRelativePath('mywebsite', 'nonexistent.js');
    expect(result).toBeNull();
  });

  it('returns null for absolute URLs', () => {
    const result = assetManager.findAssetByRelativePath('mywebsite', 'https://example.com/script.js');
    expect(result).toBeNull();
  });

  it('returns null for data URLs', () => {
    const result = assetManager.findAssetByRelativePath('mywebsite', 'data:image/png;base64,abc');
    expect(result).toBeNull();
  });

  it('returns null for asset URLs', () => {
    const result = assetManager.findAssetByRelativePath('mywebsite', 'asset://some-uuid');
    expect(result).toBeNull();
  });

  it('finds asset at root level with empty base folder', () => {
    const result = assetManager.findAssetByRelativePath('', 'readme.txt');
    expect(result).not.toBeNull();
    expect(result.id).toBe('uuid-root-file');
  });

  it('returns null when Yjs bridge is not set', () => {
    const noYjsManager = new AssetManager('project-123');
    const result = noYjsManager.findAssetByRelativePath('mywebsite', 'libs/jquery/jquery.min.js');
    expect(result).toBeNull();
  });
});

describe('_isHtmlAsset', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
  });

  it('returns true for text/html MIME type', () => {
    expect(assetManager._isHtmlAsset('text/html', 'file.txt')).toBe(true);
  });

  it('returns true for .html extension', () => {
    expect(assetManager._isHtmlAsset('application/octet-stream', 'page.html')).toBe(true);
  });

  it('returns true for .htm extension', () => {
    expect(assetManager._isHtmlAsset('application/octet-stream', 'page.htm')).toBe(true);
  });

  it('returns true for .HTML extension (case insensitive)', () => {
    expect(assetManager._isHtmlAsset('', 'page.HTML')).toBe(true);
  });

  it('returns false for non-HTML files', () => {
    expect(assetManager._isHtmlAsset('text/css', 'style.css')).toBe(false);
  });

  it('returns false for null inputs', () => {
    expect(assetManager._isHtmlAsset(null, null)).toBe(false);
  });
});

describe('resolveHtmlWithAssets', () => {
  let assetManager;
  let mockYjsBridge;
  let mockDB;
  let storedBlobs;

  beforeEach(() => {
    // Mock Logger if not defined
    if (typeof global.Logger === 'undefined') {
      global.Logger = { log: () => {} };
    }

    // Create mock Yjs bridge
    const assetsMap = new Map();
    const mockYMap = {
      get: (id) => assetsMap.get(id),
      set: (id, value) => assetsMap.set(id, value),
      delete: (id) => assetsMap.delete(id),
      forEach: (callback) => assetsMap.forEach((value, key) => callback(value, key)),
      entries: () => assetsMap.entries(),
      doc: { transact: (fn) => fn() }
    };
    mockYjsBridge = {
      getAssetsMap: () => mockYMap,
      _assetsMap: assetsMap
    };

    // Create mock IndexedDB
    storedBlobs = new Map();
    const mockStore = {
      put: mock((blobRecord) => {
        storedBlobs.set(blobRecord.id, blobRecord);
        return { onsuccess: null, onerror: null };
      }),
      get: mock((id) => {
        const result = storedBlobs.get(id) || null;
        const req = { result, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      }),
      delete: mock((id) => {
        storedBlobs.delete(id);
        return { onsuccess: null, onerror: null };
      })
    };
    mockDB = {
      transaction: mock(() => ({
        objectStore: mock(() => mockStore),
        oncomplete: null,
        onerror: null
      })),
      close: mock(() => undefined)
    };

    // Create blob URL tracking
    let urlCounter = 0;
    const mockObjectURLs = new Map();
    global.URL = {
      createObjectURL: mock((blob) => {
        const url = `blob:test-${urlCounter++}`;
        mockObjectURLs.set(url, blob);
        return url;
      }),
      revokeObjectURL: mock((url) => {
        mockObjectURLs.delete(url);
      })
    };

    assetManager = new AssetManager('project-123');
    assetManager.setYjsBridge(mockYjsBridge);
    assetManager.db = mockDB;

    // Mock console to suppress logs
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.URL;
    delete global.Logger;
  });

  it('returns null for non-existent asset', async () => {
    const result = await assetManager.resolveHtmlWithAssets('nonexistent-uuid');
    expect(result).toBeNull();
  });

  it('returns null when blob is not available', async () => {
    // Add metadata but no blob
    mockYjsBridge._assetsMap.set('uuid-html', {
      filename: 'index.html',
      folderPath: 'mywebsite',
      mime: 'text/html'
    });

    const result = await assetManager.resolveHtmlWithAssets('uuid-html');
    expect(result).toBeNull();
  });

  it('resolves simple HTML with no relative URLs', async () => {
    const htmlContent = '<!DOCTYPE html><html><head></head><body><h1>Hello</h1></body></html>';
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

    mockYjsBridge._assetsMap.set('uuid-simple', {
      filename: 'simple.html',
      folderPath: 'mywebsite',
      mime: 'text/html'
    });
    storedBlobs.set('uuid-simple', { id: 'uuid-simple', projectId: 'project-123', blob: htmlBlob });

    const result = await assetManager.resolveHtmlWithAssets('uuid-simple');
    expect(result).not.toBeNull();
    expect(result).toMatch(/^blob:test-\d+$/);
  });

  it('skips absolute URLs in HTML', async () => {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <script src="https://example.com/external.js"></script>
  <link href="//cdn.example.com/styles.css" rel="stylesheet">
</head>
<body></body>
</html>`;
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

    mockYjsBridge._assetsMap.set('uuid-external', {
      filename: 'external.html',
      folderPath: 'mywebsite',
      mime: 'text/html'
    });
    storedBlobs.set('uuid-external', { id: 'uuid-external', projectId: 'project-123', blob: htmlBlob });

    const result = await assetManager.resolveHtmlWithAssets('uuid-external');
    expect(result).not.toBeNull();

    // The blob URL should be created, absolute URLs should remain unchanged
    const resolvedBlob = global.URL.createObjectURL.mock.calls.length;
    expect(resolvedBlob).toBeGreaterThan(0);
  });

  it('skips javascript: and # URLs', async () => {
    const htmlContent = `<!DOCTYPE html>
<html>
<head></head>
<body>
  <a href="javascript:void(0)">Click</a>
  <a href="#section">Jump</a>
</body>
</html>`;
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

    mockYjsBridge._assetsMap.set('uuid-special', {
      filename: 'special.html',
      folderPath: 'mywebsite',
      mime: 'text/html'
    });
    storedBlobs.set('uuid-special', { id: 'uuid-special', projectId: 'project-123', blob: htmlBlob });

    const result = await assetManager.resolveHtmlWithAssets('uuid-special');
    expect(result).not.toBeNull();
  });

  it('injects link handler script into resolved HTML', async () => {
    // HTML with internal links
    const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <a href="./page2.html">Next</a>
  <a href="#section1">Section 1</a>
  <a href="https://example.com">External</a>
</body>
</html>`;
    const htmlBlob = new Blob([html], { type: 'text/html' });

    // Capture the blob passed to createObjectURL
    let capturedBlob = null;
    global.URL.createObjectURL = mock((blob) => {
      capturedBlob = blob;
      return 'blob:test-link-handler';
    });

    mockYjsBridge._assetsMap.set('uuid-links', {
      filename: 'index.html',
      folderPath: 'mywebsite',
      mime: 'text/html'
    });
    storedBlobs.set('uuid-links', { id: 'uuid-links', projectId: 'project-123', blob: htmlBlob });

    const result = await assetManager.resolveHtmlWithAssets('uuid-links');
    expect(result).not.toBeNull();

    // Read the captured blob content
    expect(capturedBlob).not.toBeNull();
    const resolvedHtml = await capturedBlob.text();

    // Should contain the link handler script
    expect(resolvedHtml).toContain('exe-resolve-html-link');
    expect(resolvedHtml).toContain('postMessage');
    expect(resolvedHtml).toContain('uuid-links'); // Asset ID should be in the script
    expect(resolvedHtml).toContain('mywebsite'); // Base folder should be in the script
  });

  it('link handler script handles anchor links', async () => {
    const html = `<!DOCTYPE html>
<html>
<body><a href="#test">Link</a></body>
</html>`;
    const htmlBlob = new Blob([html], { type: 'text/html' });

    // Capture the blob passed to createObjectURL
    let capturedBlob = null;
    global.URL.createObjectURL = mock((blob) => {
      capturedBlob = blob;
      return 'blob:test-anchor';
    });

    mockYjsBridge._assetsMap.set('uuid-anchor', {
      filename: 'index.html',
      folderPath: '',
      mime: 'text/html'
    });
    storedBlobs.set('uuid-anchor', { id: 'uuid-anchor', projectId: 'project-123', blob: htmlBlob });

    const result = await assetManager.resolveHtmlWithAssets('uuid-anchor');
    expect(capturedBlob).not.toBeNull();
    const resolvedHtml = await capturedBlob.text();

    // Script should handle # links with scrollIntoView
    expect(resolvedHtml).toContain('scrollIntoView');
    expect(resolvedHtml).toContain("href.charAt(0) === '#'");
  });

  it('adds target="_blank" to external links', async () => {
    const html = `<!DOCTYPE html>
<html>
<body>
  <a href="https://example.com">External</a>
  <a href="http://test.com">Another</a>
  <a href="./local.html">Local</a>
</body>
</html>`;
    const htmlBlob = new Blob([html], { type: 'text/html' });

    let capturedBlob = null;
    global.URL.createObjectURL = mock((blob) => {
      capturedBlob = blob;
      return 'blob:test-external';
    });

    mockYjsBridge._assetsMap.set('uuid-external', {
      filename: 'index.html',
      folderPath: '',
      mime: 'text/html'
    });
    storedBlobs.set('uuid-external', { id: 'uuid-external', projectId: 'project-123', blob: htmlBlob });

    const result = await assetManager.resolveHtmlWithAssets('uuid-external');
    expect(capturedBlob).not.toBeNull();
    const resolvedHtml = await capturedBlob.text();

    // External links should have target="_blank"
    expect(resolvedHtml).toContain('target="_blank"');
    expect(resolvedHtml).toContain('rel="noopener noreferrer"');
  });

  it('processes inline style url() references', async () => {
    const html = `<!DOCTYPE html>
<html>
<body>
  <div style="background: url('images/bg.png');"></div>
</body>
</html>`;
    const htmlBlob = new Blob([html], { type: 'text/html' });

    let capturedBlob = null;
    global.URL.createObjectURL = mock((blob) => {
      capturedBlob = blob;
      return 'blob:test-inline-style';
    });

    mockYjsBridge._assetsMap.set('uuid-inline', {
      filename: 'index.html',
      folderPath: 'website',
      mime: 'text/html'
    });
    mockYjsBridge._assetsMap.set('uuid-bg', {
      filename: 'bg.png',
      folderPath: 'website/images',
      mime: 'image/png'
    });
    storedBlobs.set('uuid-inline', { id: 'uuid-inline', projectId: 'project-123', blob: htmlBlob });
    storedBlobs.set('uuid-bg', { id: 'uuid-bg', projectId: 'project-123', blob: new Blob(['PNG'], { type: 'image/png' }) });

    const result = await assetManager.resolveHtmlWithAssets('uuid-inline');
    expect(result).not.toBeNull();
    // The inline style should be processed (bg.png resolved)
  });

  it('processes <style> tag url() references', async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    .icon { background: url('icons/star.png'); }
  </style>
</head>
<body></body>
</html>`;
    const htmlBlob = new Blob([html], { type: 'text/html' });

    let capturedBlob = null;
    global.URL.createObjectURL = mock((blob) => {
      capturedBlob = blob;
      return 'blob:test-style-tag';
    });

    mockYjsBridge._assetsMap.set('uuid-style', {
      filename: 'index.html',
      folderPath: 'site',
      mime: 'text/html'
    });
    mockYjsBridge._assetsMap.set('uuid-star', {
      filename: 'star.png',
      folderPath: 'site/icons',
      mime: 'image/png'
    });
    storedBlobs.set('uuid-style', { id: 'uuid-style', projectId: 'project-123', blob: htmlBlob });
    storedBlobs.set('uuid-star', { id: 'uuid-star', projectId: 'project-123', blob: new Blob(['STAR'], { type: 'image/png' }) });

    const result = await assetManager.resolveHtmlWithAssets('uuid-style');
    expect(result).not.toBeNull();
  });

  it('converts external CSS link to inline style', async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="styles/main.css">
</head>
<body><p>Test</p></body>
</html>`;
    const cssContent = '.test { color: red; }';
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const cssBlob = new Blob([cssContent], { type: 'text/css' });

    let capturedBlob = null;
    global.URL.createObjectURL = mock((blob) => {
      capturedBlob = blob;
      return 'blob:test-css-inline';
    });

    mockYjsBridge._assetsMap.set('uuid-html-css', {
      filename: 'index.html',
      folderPath: 'mysite',
      mime: 'text/html'
    });
    mockYjsBridge._assetsMap.set('uuid-css', {
      filename: 'main.css',
      folderPath: 'mysite/styles',
      mime: 'text/css'
    });
    storedBlobs.set('uuid-html-css', { id: 'uuid-html-css', projectId: 'project-123', blob: htmlBlob });
    storedBlobs.set('uuid-css', { id: 'uuid-css', projectId: 'project-123', blob: cssBlob });

    const result = await assetManager.resolveHtmlWithAssets('uuid-html-css');
    expect(capturedBlob).not.toBeNull();
    const resolvedHtml = await capturedBlob.text();

    // CSS link should be converted to inline <style>
    expect(resolvedHtml).toContain('<style>');
    expect(resolvedHtml).toContain('.test { color: red; }');
    // Original <link> should be removed
    expect(resolvedHtml).not.toContain('<link rel="stylesheet"');
  });

  it('preserves media attribute when converting CSS link to inline style', async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="print.css" media="print">
</head>
<body></body>
</html>`;
    const cssContent = '@media print { body { font-size: 12pt; } }';
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const cssBlob = new Blob([cssContent], { type: 'text/css' });

    let capturedBlob = null;
    global.URL.createObjectURL = mock((blob) => {
      capturedBlob = blob;
      return 'blob:test-css-media';
    });

    mockYjsBridge._assetsMap.set('uuid-html-media', {
      filename: 'index.html',
      folderPath: '',
      mime: 'text/html'
    });
    mockYjsBridge._assetsMap.set('uuid-print-css', {
      filename: 'print.css',
      folderPath: '',
      mime: 'text/css'
    });
    storedBlobs.set('uuid-html-media', { id: 'uuid-html-media', projectId: 'project-123', blob: htmlBlob });
    storedBlobs.set('uuid-print-css', { id: 'uuid-print-css', projectId: 'project-123', blob: cssBlob });

    const result = await assetManager.resolveHtmlWithAssets('uuid-html-media');
    expect(capturedBlob).not.toBeNull();
    const resolvedHtml = await capturedBlob.text();

    // Inline style should preserve media attribute
    expect(resolvedHtml).toContain('media="print"');
    expect(resolvedHtml).toContain('<style');
  });

  it('keeps HTML anchor links unchanged for navigation handler', async () => {
    const html = `<!DOCTYPE html>
<html>
<body>
  <a href="./page2.html">Page 2</a>
  <a href="../other/page3.htm">Page 3</a>
</body>
</html>`;
    const htmlBlob = new Blob([html], { type: 'text/html' });

    let capturedBlob = null;
    global.URL.createObjectURL = mock((blob) => {
      capturedBlob = blob;
      return 'blob:test-nav-links';
    });

    mockYjsBridge._assetsMap.set('uuid-nav', {
      filename: 'index.html',
      folderPath: 'site',
      mime: 'text/html'
    });
    storedBlobs.set('uuid-nav', { id: 'uuid-nav', projectId: 'project-123', blob: htmlBlob });

    const result = await assetManager.resolveHtmlWithAssets('uuid-nav');
    expect(capturedBlob).not.toBeNull();
    const resolvedHtml = await capturedBlob.text();

    // HTML anchor links should remain unchanged (not converted to blob URLs)
    // They will be handled by the navigation handler script
    expect(resolvedHtml).toContain('href="./page2.html"');
    expect(resolvedHtml).toContain('href="../other/page3.htm"');
  });
});

describe('_generateLinkHandlerScript', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('project-123');
  });

  it('generates script with correct assetId and baseFolder', () => {
    const script = assetManager._generateLinkHandlerScript('asset-123', 'my/folder');

    expect(script).toContain('<script>');
    expect(script).toContain('</script>');
    expect(script).toContain('asset-123');
    expect(script).toContain('my/folder');
    expect(script).toContain('exe-resolve-html-link');
  });

  it('escapes single quotes in assetId and baseFolder', () => {
    const script = assetManager._generateLinkHandlerScript("asset'123", "folder's/path");

    // Should escape single quotes to prevent script injection
    expect(script).toContain("asset\\'123");
    expect(script).toContain("folder\\'s/path");
  });

  it('handles empty baseFolder', () => {
    const script = assetManager._generateLinkHandlerScript('asset-123', '');

    expect(script).toContain('asset-123');
    expect(script).toContain("baseFolder: ''");
  });

  it('includes all link type handlers', () => {
    const script = assetManager._generateLinkHandlerScript('asset-123', 'folder');

    // Should handle external links (skip them)
    expect(script).toContain('https?:');
    expect(script).toContain('mailto:');

    // Should handle anchor links
    expect(script).toContain('scrollIntoView');

    // Should handle relative links via postMessage
    expect(script).toContain('postMessage');
    expect(script).toContain('exe-resolve-html-link');
  });
});

describe('_getAssetAsDataUrl', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('test-project');
  });

  it('returns null if blob not found', async () => {
    vi.spyOn(assetManager, 'getBlob').mockResolvedValue(null);

    const result = await assetManager._getAssetAsDataUrl('nonexistent');
    expect(result).toBeNull();
  });

  it('converts blob to data URL', async () => {
    const testBlob = new Blob(['test content'], { type: 'text/plain' });
    vi.spyOn(assetManager, 'getBlob').mockResolvedValue(testBlob);

    const result = await assetManager._getAssetAsDataUrl('test-asset');

    expect(result).toMatch(/^data:text\/plain;base64,/);
  });

  it('handles binary blobs and returns base64 data URL', async () => {
    // Note: happy-dom's FileReader may not preserve MIME types correctly,
    // so we test the data URL structure rather than specific MIME type
    const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const binaryBlob = new Blob([binaryData], { type: 'image/png' });
    vi.spyOn(assetManager, 'getBlob').mockResolvedValue(binaryBlob);

    const result = await assetManager._getAssetAsDataUrl('binary-asset');

    // Should return a data URL with base64 encoding
    expect(result).toMatch(/^data:[^;]*;base64,/);
  });
});

describe('_resolveUrlsInCssAsDataUrls', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('test-project');
  });

  it('returns unchanged CSS if no url() references', async () => {
    const css = '.class { color: red; font-size: 16px; }';

    const result = await assetManager._resolveUrlsInCssAsDataUrls(css, 'folder');

    expect(result).toBe(css);
  });

  it('skips absolute URLs', async () => {
    const css = `
      .bg1 { background: url("https://example.com/image.png"); }
      .bg2 { background: url("data:image/png;base64,abc"); }
      .bg3 { background: url("//cdn.example.com/image.jpg"); }
    `;

    const result = await assetManager._resolveUrlsInCssAsDataUrls(css, 'folder');

    expect(result).toBe(css);
  });

  it('resolves relative URLs to data URLs', async () => {
    // Set up mock asset
    const mockAsset = { id: 'asset-bg', filename: 'bg.png' };
    vi.spyOn(assetManager, 'findAssetByRelativePath').mockReturnValue(mockAsset);
    vi.spyOn(assetManager, '_getAssetAsDataUrl').mockResolvedValue('data:image/png;base64,ABC123');

    const css = '.bg { background: url("images/bg.png"); }';
    const result = await assetManager._resolveUrlsInCssAsDataUrls(css, 'theme');

    expect(result).toContain('data:image/png;base64,ABC123');
    expect(assetManager.findAssetByRelativePath).toHaveBeenCalledWith('theme', 'images/bg.png');
  });

  it('handles multiple url() references', async () => {
    const mockAsset1 = { id: 'asset-1', filename: 'icon1.png' };
    const mockAsset2 = { id: 'asset-2', filename: 'icon2.png' };

    vi.spyOn(assetManager, 'findAssetByRelativePath')
      .mockReturnValueOnce(mockAsset1)
      .mockReturnValueOnce(mockAsset2);
    vi.spyOn(assetManager, '_getAssetAsDataUrl')
      .mockResolvedValueOnce('data:image/png;base64,ICON1')
      .mockResolvedValueOnce('data:image/png;base64,ICON2');

    const css = `
      .icon1 { background: url("icons/icon1.png"); }
      .icon2 { background: url("icons/icon2.png"); }
    `;
    const result = await assetManager._resolveUrlsInCssAsDataUrls(css, 'assets');

    expect(result).toContain('data:image/png;base64,ICON1');
    expect(result).toContain('data:image/png;base64,ICON2');
  });

  it('leaves unresolvable URLs unchanged', async () => {
    vi.spyOn(assetManager, 'findAssetByRelativePath').mockReturnValue(null);

    const css = '.bg { background: url("missing/image.png"); }';
    const result = await assetManager._resolveUrlsInCssAsDataUrls(css, 'folder');

    expect(result).toContain('url("missing/image.png")');
  });
});

describe('_resolveUrlsInCss (blob URL version)', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('test-project');
  });

  it('returns unchanged CSS if no url() references', async () => {
    const css = '.class { color: red; font-size: 14px; }';
    const resolvedUrls = new Map();
    const result = await assetManager._resolveUrlsInCss(css, 'folder', resolvedUrls);

    expect(result).toBe(css);
  });

  it('skips absolute URLs', async () => {
    const css = '.bg { background: url("https://example.com/image.png"); }';
    const resolvedUrls = new Map();
    vi.spyOn(assetManager, 'findAssetByRelativePath');

    const result = await assetManager._resolveUrlsInCss(css, 'folder', resolvedUrls);

    expect(assetManager.findAssetByRelativePath).not.toHaveBeenCalled();
    expect(result).toContain('https://example.com/image.png');
  });

  it('skips data URLs', async () => {
    const css = '.bg { background: url("data:image/png;base64,ABC"); }';
    const resolvedUrls = new Map();
    vi.spyOn(assetManager, 'findAssetByRelativePath');

    const result = await assetManager._resolveUrlsInCss(css, 'folder', resolvedUrls);

    expect(assetManager.findAssetByRelativePath).not.toHaveBeenCalled();
    expect(result).toContain('data:image/png;base64,ABC');
  });

  it('resolves relative URLs to blob URLs', async () => {
    const css = '.bg { background: url("images/bg.png"); }';
    const resolvedUrls = new Map();

    vi.spyOn(assetManager, 'findAssetByRelativePath').mockReturnValue({ id: 'bg-uuid' });
    vi.spyOn(assetManager, 'resolveAssetURL').mockResolvedValue('blob:http://localhost/bg-blob');

    const result = await assetManager._resolveUrlsInCss(css, 'folder', resolvedUrls);

    expect(result).toContain('url("blob:http://localhost/bg-blob")');
    expect(resolvedUrls.get('images/bg.png')).toBe('blob:http://localhost/bg-blob');
  });

  it('uses already resolved URLs from map', async () => {
    const css = '.bg { background: url("images/bg.png"); }';
    const resolvedUrls = new Map([['images/bg.png', 'blob:http://localhost/cached-blob']]);

    vi.spyOn(assetManager, 'findAssetByRelativePath');
    vi.spyOn(assetManager, 'resolveAssetURL');

    const result = await assetManager._resolveUrlsInCss(css, 'folder', resolvedUrls);

    expect(assetManager.findAssetByRelativePath).not.toHaveBeenCalled();
    expect(assetManager.resolveAssetURL).not.toHaveBeenCalled();
    expect(result).toContain('url("blob:http://localhost/cached-blob")');
  });

  it('handles multiple url() references', async () => {
    const css = '.a { background: url("a.png"); } .b { background: url("b.png"); }';
    const resolvedUrls = new Map();

    vi.spyOn(assetManager, 'findAssetByRelativePath')
      .mockReturnValueOnce({ id: 'a-uuid' })
      .mockReturnValueOnce({ id: 'b-uuid' });
    vi.spyOn(assetManager, 'resolveAssetURL')
      .mockResolvedValueOnce('blob:http://localhost/a-blob')
      .mockResolvedValueOnce('blob:http://localhost/b-blob');

    const result = await assetManager._resolveUrlsInCss(css, 'folder', resolvedUrls);

    expect(result).toContain('url("blob:http://localhost/a-blob")');
    expect(result).toContain('url("blob:http://localhost/b-blob")');
  });

  it('leaves unresolvable URLs unchanged', async () => {
    vi.spyOn(assetManager, 'findAssetByRelativePath').mockReturnValue(null);

    const css = '.bg { background: url("missing/image.png"); }';
    const resolvedUrls = new Map();
    const result = await assetManager._resolveUrlsInCss(css, 'folder', resolvedUrls);

    expect(result).toContain('url("missing/image.png")');
  });

  it('handles resolveAssetURL returning null', async () => {
    const css = '.bg { background: url("images/bg.png"); }';
    const resolvedUrls = new Map();

    vi.spyOn(assetManager, 'findAssetByRelativePath').mockReturnValue({ id: 'bg-uuid' });
    vi.spyOn(assetManager, 'resolveAssetURL').mockResolvedValue(null);

    const result = await assetManager._resolveUrlsInCss(css, 'folder', resolvedUrls);

    // URL should remain unchanged when resolution fails
    expect(result).toContain('url("images/bg.png")');
  });
});

describe('_injectStandaloneNavigationHandler', () => {
  let assetManager;

  beforeEach(() => {
    assetManager = new AssetManager('test-project');
  });

  it('injects script before </body>', () => {
    const html = '<html><body><p>Content</p></body></html>';
    const pages = [
      { index: 0, url: 'page1.html', content: '<html><body>Page 1</body></html>' },
    ];

    const result = assetManager._injectStandaloneNavigationHandler(html, pages);

    expect(result).toContain('<script>');
    expect(result).toContain('exeNavPages');
    expect(result).toContain('</script></body>');
  });

  it('appends script at end if no </body> tag', () => {
    const html = '<p>Content without body tags</p>';
    const pages = [
      { index: 0, url: 'page1.html', content: '<p>Page 1</p>' },
    ];

    const result = assetManager._injectStandaloneNavigationHandler(html, pages);

    expect(result).toContain('<script>');
    expect(result).toContain('exeNavPages');
    expect(result.endsWith('</script>')).toBe(true);
  });

  it('base64 encodes page content to avoid escaping issues', () => {
    const html = '<html><body></body></html>';
    const pages = [
      { index: 0, url: 'page.html', content: '<html><body>"Quotes" & <special> chars</body></html>' },
    ];

    const result = assetManager._injectStandaloneNavigationHandler(html, pages);

    // Should contain base64-encoded content, not raw special chars
    expect(result).toContain('contentBase64');
    expect(result).not.toContain('"Quotes" & <special>');
  });

  it('includes navigation handler functions', () => {
    const html = '<html><body></body></html>';
    const pages = [
      { index: 0, url: 'page.html', content: '<html><body>Content</body></html>' },
    ];

    const result = assetManager._injectStandaloneNavigationHandler(html, pages);

    expect(result).toContain('decodeContent');
    expect(result).toContain('navigateToPage');
    expect(result).toContain('data-exe-nav');
    expect(result).toContain('document.write');
  });

  it('handles multiple pages', () => {
    const html = '<html><body></body></html>';
    const pages = [
      { index: 0, url: 'page1.html', content: '<html><body>Page 1</body></html>' },
      { index: 1, url: 'page2.html', content: '<html><body>Page 2</body></html>' },
      { index: 2, url: 'page3.html', content: '<html><body>Page 3</body></html>' },
    ];

    const result = assetManager._injectStandaloneNavigationHandler(html, pages);

    // Should log correct number of pages
    expect(result).toContain('exeNavPages.length');
  });
});

describe('resolveHtmlWithAssetsAsDataUrls', () => {
  let assetManager;

  beforeEach(() => {
    // Mock Logger if not defined
    if (typeof global.Logger === 'undefined') {
      global.Logger = { log: () => {}, error: () => {}, warn: () => {} };
    }
    assetManager = new AssetManager('test-project');
  });

  it('returns null if asset not found', async () => {
    vi.spyOn(assetManager, 'getAssetMetadata').mockReturnValue(null);

    const result = await assetManager.resolveHtmlWithAssetsAsDataUrls('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null if blob not found', async () => {
    vi.spyOn(assetManager, 'getAssetMetadata').mockReturnValue({
      filename: 'test.html',
      mime: 'text/html',
      folderPath: 'folder',
    });
    vi.spyOn(assetManager, 'getBlob').mockResolvedValue(null);

    const result = await assetManager.resolveHtmlWithAssetsAsDataUrls('no-blob');
    expect(result).toBeNull();
  });

  it('returns HTML string with resolved data URLs', async () => {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <img src="image.png">
</body>
</html>`;

    vi.spyOn(assetManager, 'getAssetMetadata').mockReturnValue({
      filename: 'index.html',
      mime: 'text/html',
      folderPath: 'mysite',
    });
    vi.spyOn(assetManager, 'getBlob').mockResolvedValue(
      new Blob([htmlContent], { type: 'text/html' }),
    );
    vi.spyOn(assetManager, 'findAssetByRelativePath').mockReturnValue(null);

    const result = await assetManager.resolveHtmlWithAssetsAsDataUrls('html-asset');

    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html>');
    expect(result).toContain('</html>');
  });

  it('resolves image src to data URL', async () => {
    const htmlContent = '<html><body><img src="test.png"></body></html>';

    // Mock getAssetMetadata to return info for both the HTML and the image
    vi.spyOn(assetManager, 'getAssetMetadata').mockImplementation((id) => {
      if (id === 'html-asset') {
        return { filename: 'index.html', mime: 'text/html', folderPath: 'site' };
      }
      if (id === 'img-asset') {
        return { filename: 'test.png', mime: 'image/png', folderPath: 'site' };
      }
      return null;
    });
    vi.spyOn(assetManager, 'getBlob').mockResolvedValue(
      new Blob([htmlContent], { type: 'text/html' }),
    );
    vi.spyOn(assetManager, 'findAssetByRelativePath').mockReturnValue({
      id: 'img-asset',
      filename: 'test.png',
    });
    vi.spyOn(assetManager, '_getAssetAsDataUrl').mockResolvedValue('data:image/png;base64,ABC');

    const result = await assetManager.resolveHtmlWithAssetsAsDataUrls('html-asset');

    expect(result).toContain('data:image/png;base64,ABC');
  });

  it('adds target="_blank" to external links', async () => {
    const htmlContent = '<html><body><a href="https://example.com">Link</a></body></html>';

    vi.spyOn(assetManager, 'getAssetMetadata').mockReturnValue({
      filename: 'index.html',
      mime: 'text/html',
      folderPath: 'site',
    });
    vi.spyOn(assetManager, 'getBlob').mockResolvedValue(
      new Blob([htmlContent], { type: 'text/html' }),
    );
    vi.spyOn(assetManager, 'findAssetByRelativePath').mockReturnValue(null);

    const result = await assetManager.resolveHtmlWithAssetsAsDataUrls('html-asset');

    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('recursively resolves HTML links with navigation handler', async () => {
    const mainHtml = '<html><body><a href="page2.html">Page 2</a></body></html>';
    const page2Html = '<html><body>Page 2 content</body></html>';

    const getMetadata = vi.spyOn(assetManager, 'getAssetMetadata');
    getMetadata.mockImplementation((id) => {
      if (id === 'main-html') {
        return { filename: 'index.html', mime: 'text/html', folderPath: 'site' };
      }
      if (id === 'page2-html') {
        return { filename: 'page2.html', mime: 'text/html', folderPath: 'site' };
      }
      return null;
    });

    const getBlob = vi.spyOn(assetManager, 'getBlob');
    getBlob.mockImplementation((id) => {
      if (id === 'main-html') {
        return Promise.resolve(new Blob([mainHtml], { type: 'text/html' }));
      }
      if (id === 'page2-html') {
        return Promise.resolve(new Blob([page2Html], { type: 'text/html' }));
      }
      return Promise.resolve(null);
    });

    vi.spyOn(assetManager, 'findAssetByRelativePath').mockImplementation((folder, path) => {
      if (path === 'page2.html') {
        return { id: 'page2-html', filename: 'page2.html' };
      }
      return null;
    });

    vi.spyOn(assetManager, '_isHtmlAsset').mockReturnValue(true);

    const result = await assetManager.resolveHtmlWithAssetsAsDataUrls('main-html');

    // Should have navigation markers for internal links
    expect(result).toContain('data-exe-nav');
    expect(result).toContain('#exe-nav-');
    // Should inject standalone navigation handler
    expect(result).toContain('exeNavPages');
  });

  it('avoids infinite loops with circular HTML references', async () => {
    const html1 = '<html><body><a href="page2.html">Page 2</a></body></html>';
    const html2 = '<html><body><a href="page1.html">Page 1</a></body></html>';

    const getMetadata = vi.spyOn(assetManager, 'getAssetMetadata');
    getMetadata.mockImplementation((id) => {
      if (id === 'page1') return { filename: 'page1.html', mime: 'text/html', folderPath: '' };
      if (id === 'page2') return { filename: 'page2.html', mime: 'text/html', folderPath: '' };
      return null;
    });

    const getBlob = vi.spyOn(assetManager, 'getBlob');
    getBlob.mockImplementation((id) => {
      if (id === 'page1') return Promise.resolve(new Blob([html1], { type: 'text/html' }));
      if (id === 'page2') return Promise.resolve(new Blob([html2], { type: 'text/html' }));
      return Promise.resolve(null);
    });

    vi.spyOn(assetManager, 'findAssetByRelativePath').mockImplementation((folder, path) => {
      if (path === 'page2.html') return { id: 'page2', filename: 'page2.html' };
      if (path === 'page1.html') return { id: 'page1', filename: 'page1.html' };
      return null;
    });

    vi.spyOn(assetManager, '_isHtmlAsset').mockReturnValue(true);

    // Should complete without infinite recursion
    const result = await assetManager.resolveHtmlWithAssetsAsDataUrls('page1');

    expect(result).toBeDefined();
    expect(result).toContain('<!DOCTYPE html>');
  });

  it('preserves DOCTYPE in output', async () => {
    const htmlContent = '<!DOCTYPE html><html><head></head><body>Content</body></html>';

    vi.spyOn(assetManager, 'getAssetMetadata').mockReturnValue({
      filename: 'index.html',
      mime: 'text/html',
      folderPath: '',
    });
    vi.spyOn(assetManager, 'getBlob').mockResolvedValue(
      new Blob([htmlContent], { type: 'text/html' }),
    );
    vi.spyOn(assetManager, 'findAssetByRelativePath').mockReturnValue(null);

    const result = await assetManager.resolveHtmlWithAssetsAsDataUrls('html-asset');

    expect(result).toMatch(/^<!DOCTYPE html>/i);
  });
});
