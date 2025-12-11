/**
 * AssetManager Tests
 *
 * Unit tests for AssetManager - offline-first asset management for eXeLearning.
 *
 */

// Test functions available globally from vitest setup

/* eslint-disable no-undef */

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

describe('AssetManager', () => {
  let assetManager;
  let mockDB;
  let mockStore;
  let mockObjectURLs;

  beforeEach(() => {
    mockObjectURLs = new Map();
    let urlCounter = 0;

    // Create mock IndexedDB store
    const storedAssets = new Map();

    mockStore = {
      put: mock((asset) => {
        storedAssets.set(asset.id, asset);
        return { onsuccess: null, onerror: null };
      }),
      get: mock((id) => {
        const result = storedAssets.get(id) || null;
        return { result, onsuccess: null, onerror: null };
      }),
      delete: mock((id) => {
        storedAssets.delete(id);
        return { onsuccess: null, onerror: null };
      }),
      index: mock(() => ({
        getAll: mock((key) => {
          const results = [];
          for (const [id, asset] of storedAssets.entries()) {
            if (asset.projectId === key) {
              results.push(asset);
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
      expect(AssetManager.DB_NAME).toBe('exelearning-assets-v2');
    });

    it('has correct DB_VERSION', () => {
      expect(AssetManager.DB_VERSION).toBe(2);
    });

    it('has correct STORE_NAME', () => {
      expect(AssetManager.STORE_NAME).toBe('assets');
    });
  });

  describe('init', () => {
    it('opens IndexedDB database', async () => {
      await assetManager.init();
      expect(global.indexedDB.open).toHaveBeenCalledWith('exelearning-assets-v2', 2);
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

    it('stores asset in IndexedDB', async () => {
      assetManager.db = mockDB;

      const mockTx = {
        objectStore: mock(() => mockStore),
        oncomplete: null,
        onerror: null,
      };
      mockDB.transaction.mockReturnValue(mockTx);

      const putPromise = assetManager.putAsset({ id: 'asset-1', data: 'test' });

      setTimeout(() => {
        mockTx.oncomplete?.();
      }, 0);

      await putPromise;

      expect(mockStore.put).toHaveBeenCalledWith({ id: 'asset-1', data: 'test' });
    });
  });

  describe('getAsset', () => {
    it('throws if database not initialized', async () => {
      await expect(assetManager.getAsset('id')).rejects.toThrow('Database not initialized');
    });

    it('retrieves asset from IndexedDB', async () => {
      assetManager.db = mockDB;

      const mockAsset = { id: 'asset-1', data: 'test' };
      const mockGetRequest = { result: mockAsset, onsuccess: null, onerror: null };

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
      expect(result).toEqual(mockAsset);
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

      expect(url).toMatch(/^asset:\/\/[a-f0-9-]+\/test\.jpg$/);
      expect(assetManager.putAsset).toHaveBeenCalled();
    });

    it('returns existing asset URL if already exists', async () => {
      assetManager.db = mockDB;
      assetManager.calculateHash = mock(() => undefined).mockResolvedValue('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({
        id: '01234567-89ab-cdef-0123-456789abcdef',
        filename: 'existing.jpg',
        projectId: 'project-123', // Same projectId as assetManager - should skip putAsset
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
  });

  describe('convertBlobURLsToAssetRefs', () => {
    it('returns unchanged HTML when null', () => {
      const result = assetManager.convertBlobURLsToAssetRefs(null);
      expect(result).toBeNull();
    });

    it('converts blob URLs back to asset:// refs', () => {
      assetManager.reverseBlobCache.set('blob:test-url', 'asset-123');

      const html = '<img src="blob:test-url">';
      const result = assetManager.convertBlobURLsToAssetRefs(html);

      expect(result).toBe('<img src="asset://asset-123">');
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
    it('generates loading placeholder', () => {
      const placeholder = assetManager.generatePlaceholder('Loading...', 'loading');
      expect(placeholder).toContain('data:image/svg+xml');
      expect(placeholder).toContain('Loading');
    });

    it('generates error placeholder', () => {
      const placeholder = assetManager.generatePlaceholder('Error', 'error');
      expect(placeholder).toContain('data:image/svg+xml');
    });

    it('generates notfound placeholder by default', () => {
      const placeholder = assetManager.generatePlaceholder('Not found');
      expect(placeholder).toContain('data:image/svg+xml');
    });
  });

  describe('generateLoadingPlaceholder', () => {
    it('generates loading placeholder for asset', () => {
      const placeholder = assetManager.generateLoadingPlaceholder('asset-123');
      expect(placeholder).toContain('data:image/svg+xml');
      expect(placeholder).toContain('Loading');
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
    it('marks asset as uploaded', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({ id: 'a1', uploaded: false });
      assetManager.putAsset = mock(() => undefined).mockResolvedValue();

      await assetManager.markAssetUploaded('a1');

      expect(assetManager.putAsset).toHaveBeenCalledWith(
        expect.objectContaining({ uploaded: true })
      );
    });

    it('does nothing if asset not found', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue(null);
      assetManager.putAsset = mock(() => undefined);

      await assetManager.markAssetUploaded('nonexistent');

      expect(assetManager.putAsset).not.toHaveBeenCalled();
    });
  });

  describe('deleteAsset', () => {
    it('throws if database not initialized', async () => {
      await expect(assetManager.deleteAsset('id')).rejects.toThrow('Database not initialized');
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
    it('returns asset statistics', async () => {
      assetManager.db = mockDB;
      assetManager.getProjectAssets = mock(() => undefined).mockResolvedValue([
        { id: 'a1', uploaded: true, size: 1000 },
        { id: 'a2', uploaded: false, size: 2000 },
        { id: 'a3', uploaded: true, size: 500 },
      ]);

      const stats = await assetManager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.uploaded).toBe(2);
      expect(stats.totalSize).toBe(3500);
    });
  });

  describe('updateAssetFilename', () => {
    it('updates asset filename', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({ id: 'a1', filename: 'old.jpg' });
      assetManager.putAsset = mock(() => undefined).mockResolvedValue();

      await assetManager.updateAssetFilename('a1', 'new.jpg');

      expect(assetManager.putAsset).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'new.jpg' })
      );
    });

    it('does nothing if asset not found', async () => {
      assetManager.db = mockDB;
      assetManager.getAsset = mock(() => undefined).mockResolvedValue(null);
      assetManager.putAsset = mock(() => undefined);

      await assetManager.updateAssetFilename('nonexistent', 'new.jpg');

      expect(assetManager.putAsset).not.toHaveBeenCalled();
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

    it('skips if asset already exists for same project', async () => {
      assetManager.db = mockDB;
      // Mock existing asset with same projectId - should skip putAsset
      assetManager.getAsset = mock(() => undefined).mockResolvedValue({
        id: 'a1',
        projectId: 'project-123', // Same as assetManager.projectId
      });
      assetManager.putAsset = mock(() => undefined);

      await assetManager.storeAssetFromServer('a1', new Blob(['data']), {});

      expect(assetManager.putAsset).not.toHaveBeenCalled();
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

describe('window.resolveAssetUrlsAsync global function', () => {
  beforeEach(() => {
    require('./AssetManager');
  });

  afterEach(() => {
    delete window.eXeLearning;
  });

  it('returns original HTML when null', async () => {
    const result = await window.resolveAssetUrlsAsync(null);
    expect(result).toBeNull();
  });

  it('uses AssetManager when available', async () => {
    const mockResolve = mock(() => undefined).mockResolvedValue('<p>Resolved</p>');
    window.eXeLearning = {
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

    const result = await window.resolveAssetUrlsAsync('<p>Test</p>');

    expect(mockResolve).toHaveBeenCalled();
    expect(result).toBe('<p>Resolved</p>');
  });
});
