/**
 * SaveManager Tests
 *
 * Unit tests for the SaveManager class that coordinates project saving.
 *
 * Run with: make test-frontend
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('SaveManager', () => {
  let SaveManager;
  let mockBridge;
  let mockFetch;

  beforeAll(() => {
    // Mock Logger BEFORE executing script
    global.Logger = { log: vi.fn() };

    // Read and execute the script
    const scriptPath = join(__dirname, 'SaveManager.js');
    const scriptContent = readFileSync(scriptPath, 'utf-8');

    // Execute script using new Function() to properly return the class
    // eslint-disable-next-line no-new-func
    const scriptFn = new Function(scriptContent + '\n; return SaveManager;');
    SaveManager = scriptFn();
  });

  afterAll(() => {
    delete global.Logger;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve(''),
    });
    global.fetch = mockFetch;

    // Mock Y (Yjs)
    global.Y = {
      encodeStateAsUpdate: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    };

    // Mock eXeLearning global
    global.eXeLearning = {
      app: {
        toasts: {
          createToast: vi.fn().mockReturnValue({
            showProgress: vi.fn(),
            setProgress: vi.fn(),
            updateBodyWithProgress: vi.fn(),
            hideProgress: vi.fn(),
            remove: vi.fn(),
            toastBody: { innerHTML: '', classList: { add: vi.fn() } },
          }),
        },
      },
    };

    // Mock translation
    global._ = vi.fn((text) => text);

    // Mock bridge
    mockBridge = {
      projectId: 'project-123',
      isNewProject: false,
      documentManager: {
        ydoc: {},
        getMetadata: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue('Test Project'),
        }),
        markClean: vi.fn(),
      },
      assetManager: {
        projectId: 'project-123',
        getPendingAssets: vi.fn().mockResolvedValue([]),
        markAssetUploaded: vi.fn(),
      },
      updateSaveStatus: vi.fn(),
    };
  });

  afterEach(() => {
    delete global.fetch;
    delete global.Y;
    delete global.eXeLearning;
    delete global._;
  });

  describe('constructor', () => {
    it('sets bridge reference', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.bridge).toBe(mockBridge);
    });

    it('sets apiUrl from options', () => {
      const manager = new SaveManager(mockBridge, { apiUrl: 'http://api.test.com' });
      expect(manager.apiUrl).toBe('http://api.test.com');
    });

    it('sets default apiUrl from window.location', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.apiUrl).toContain('/api');
    });

    it('sets token from options', () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      expect(manager.token).toBe('test-token');
    });

    it('sets default token as empty string', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.token).toBe('');
    });

    it('initializes MAX_BATCH_FILES to 30', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.MAX_BATCH_FILES).toBe(30);
    });

    it('initializes MAX_BATCH_BYTES to 20MB', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.MAX_BATCH_BYTES).toBe(20 * 1024 * 1024);
    });

    it('initializes MAX_CONCURRENT_BATCHES to 10', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.MAX_CONCURRENT_BATCHES).toBe(10);
    });

    it('initializes CHUNK_UPLOAD_THRESHOLD to 20MB', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.CHUNK_UPLOAD_THRESHOLD).toBe(20 * 1024 * 1024);
    });

    it('initializes CHUNK_SIZE to 5MB', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.CHUNK_SIZE).toBe(5 * 1024 * 1024);
    });

    it('initializes isSaving to false', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.isSaving).toBe(false);
    });

    it('initializes priorityQueue to null', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.priorityQueue).toBeNull();
    });
  });

  describe('setPriorityQueue', () => {
    it('sets priority queue reference', () => {
      const manager = new SaveManager(mockBridge);
      const mockQueue = { getPriority: vi.fn() };
      manager.setPriorityQueue(mockQueue);
      expect(manager.priorityQueue).toBe(mockQueue);
    });
  });

  describe('setWebSocketHandler', () => {
    it('sets WebSocket handler reference', () => {
      const manager = new SaveManager(mockBridge);
      const mockHandler = { send: vi.fn() };
      manager.setWebSocketHandler(mockHandler);
      expect(manager.wsHandler).toBe(mockHandler);
    });
  });

  describe('setToken', () => {
    it('sets JWT token', () => {
      const manager = new SaveManager(mockBridge);
      manager.setToken('new-token');
      expect(manager.token).toBe('new-token');
    });
  });

  describe('sortAssetsByPriority', () => {
    it('returns original order when no priority queue', () => {
      const manager = new SaveManager(mockBridge);
      const assets = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const result = manager.sortAssetsByPriority(assets);
      expect(result).toEqual(assets);
    });

    it('sorts by priority when queue exists', () => {
      const manager = new SaveManager(mockBridge);
      manager.priorityQueue = {
        getPriority: vi.fn((id) => {
          if (id === 'a') return 25;
          if (id === 'b') return 100;
          if (id === 'c') return 50;
          return 0;
        }),
      };

      const assets = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const result = manager.sortAssetsByPriority(assets);

      expect(result[0].id).toBe('b'); // 100
      expect(result[1].id).toBe('c'); // 50
      expect(result[2].id).toBe('a'); // 25
    });
  });

  describe('createSizeLimitedBatches', () => {
    it('creates batches respecting file count limit', () => {
      const manager = new SaveManager(mockBridge);
      const assets = Array(35)
        .fill(null)
        .map((_, i) => ({ id: `asset-${i}`, blob: { size: 1000 } }));

      const batches = manager.createSizeLimitedBatches(assets);

      expect(batches.length).toBe(2);
      expect(batches[0].length).toBe(30);
      expect(batches[1].length).toBe(5);
    });

    it('creates batches respecting size limit', () => {
      const manager = new SaveManager(mockBridge);
      const assets = [
        { id: 'a', blob: { size: 15 * 1024 * 1024 } }, // 15MB
        { id: 'b', blob: { size: 15 * 1024 * 1024 } }, // 15MB - exceeds 20MB limit with 'a'
        { id: 'c', blob: { size: 5 * 1024 * 1024 } }, // 5MB - fits with 'b' (20MB total)
      ];

      const batches = manager.createSizeLimitedBatches(assets);

      // [a] is 15MB, then b+c = 20MB (exactly at limit, not exceeding)
      expect(batches.length).toBe(2);
      expect(batches[0]).toHaveLength(1); // [a]
      expect(batches[1]).toHaveLength(2); // [b, c]
    });

    it('respects custom limits', () => {
      const manager = new SaveManager(mockBridge);
      const assets = Array(10)
        .fill(null)
        .map((_, i) => ({ id: `asset-${i}`, blob: { size: 1000 } }));

      const batches = manager.createSizeLimitedBatches(assets, 3, 10 * 1024 * 1024);

      expect(batches.length).toBe(4); // 3 + 3 + 3 + 1
    });

    it('handles assets without blob', () => {
      const manager = new SaveManager(mockBridge);
      const assets = [{ id: 'a' }, { id: 'b', blob: null }, { id: 'c', blob: { size: 1000 } }];

      const batches = manager.createSizeLimitedBatches(assets);

      expect(batches.length).toBe(1);
      expect(batches[0].length).toBe(3);
    });

    it('returns empty array for empty input', () => {
      const manager = new SaveManager(mockBridge);
      const batches = manager.createSizeLimitedBatches([]);
      expect(batches).toEqual([]);
    });
  });

  describe('createPriorityBatches', () => {
    it('delegates to createSizeLimitedBatches when no queue', () => {
      const manager = new SaveManager(mockBridge);
      const assets = [{ id: 'a', blob: { size: 1000 } }];
      const spy = vi.spyOn(manager, 'createSizeLimitedBatches');

      manager.createPriorityBatches(assets);

      expect(spy).toHaveBeenCalledWith(assets);
    });

    it('separates assets by priority tier', () => {
      const manager = new SaveManager(mockBridge);

      // Mock AssetPriorityQueue.PRIORITY
      global.AssetPriorityQueue = {
        PRIORITY: { CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25, IDLE: 0 },
      };

      manager.priorityQueue = {
        getPriority: vi.fn((id) => {
          if (id === 'critical') return 100;
          if (id === 'high') return 80;
          return 25;
        }),
      };

      const assets = [
        { id: 'critical', blob: { size: 1000 } },
        { id: 'high', blob: { size: 1000 } },
        { id: 'normal', blob: { size: 1000 } },
      ];

      const batches = manager.createPriorityBatches(assets);

      // Critical should be in its own batch
      expect(batches[0]).toHaveLength(1);
      expect(batches[0][0].id).toBe('critical');

      delete global.AssetPriorityQueue;
    });
  });

  describe('createProgressToast', () => {
    it('creates toast with save title', () => {
      const manager = new SaveManager(mockBridge);
      manager.createProgressToast('Test Project');

      expect(global.eXeLearning.app.toasts.createToast).toHaveBeenCalledWith({
        title: 'Save',
        body: 'Preparing...',
        icon: 'save',
      });
    });

    it('calls showProgress on toast', () => {
      const manager = new SaveManager(mockBridge);
      const toast = manager.createProgressToast('Test Project');
      expect(toast.showProgress).toHaveBeenCalled();
    });

    it('returns null when toast creation fails', () => {
      global.eXeLearning.app.toasts.createToast = vi.fn().mockReturnValue(null);
      const manager = new SaveManager(mockBridge);
      const result = manager.createProgressToast('Test Project');
      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('returns error when save already in progress', async () => {
      const manager = new SaveManager(mockBridge);
      manager.isSaving = true;

      const result = await manager.save();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Save already in progress');
    });

    it('sets isSaving to true during save', async () => {
      const manager = new SaveManager(mockBridge);
      let wasTrue = false;

      mockFetch.mockImplementation(() => {
        wasTrue = manager.isSaving;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await manager.save();

      expect(wasTrue).toBe(true);
    });

    it('sets isSaving to false after save', async () => {
      const manager = new SaveManager(mockBridge);
      await manager.save();
      expect(manager.isSaving).toBe(false);
    });

    it('throws error when project not initialized', async () => {
      const manager = new SaveManager(mockBridge);
      mockBridge.projectId = null;

      const result = await manager.save();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not initialized');
    });

    it('calls saveYjsState', async () => {
      const manager = new SaveManager(mockBridge);
      const spy = vi.spyOn(manager, 'saveYjsState').mockResolvedValue();

      await manager.save();

      expect(spy).toHaveBeenCalledWith('project-123', mockBridge.documentManager);
    });

    it('calls updateProjectMetadata', async () => {
      const manager = new SaveManager(mockBridge);
      const spy = vi.spyOn(manager, 'updateProjectMetadata').mockResolvedValue();

      await manager.save();

      expect(spy).toHaveBeenCalled();
    });

    it('returns success on completion', async () => {
      const manager = new SaveManager(mockBridge);
      const result = await manager.save();
      expect(result.success).toBe(true);
    });

    it('calls documentManager.markClean on success', async () => {
      const manager = new SaveManager(mockBridge);
      await manager.save();
      expect(mockBridge.documentManager.markClean).toHaveBeenCalled();
    });

    it('sets isNewProject to false after first save', async () => {
      const manager = new SaveManager(mockBridge);
      mockBridge.isNewProject = true;

      await manager.save();

      expect(mockBridge.isNewProject).toBe(false);
    });

    it('uploads pending assets', async () => {
      const manager = new SaveManager(mockBridge);
      mockBridge.assetManager.getPendingAssets.mockResolvedValue([
        { id: 'asset-1', blob: new Blob(['test']), filename: 'test.txt', mime: 'text/plain' },
      ]);

      const uploadSpy = vi.spyOn(manager, 'uploadAssets').mockResolvedValue({ uploaded: 1, failed: 0 });

      await manager.save();

      expect(uploadSpy).toHaveBeenCalled();
    });

    it('handles save errors gracefully', async () => {
      const manager = new SaveManager(mockBridge);
      vi.spyOn(manager, 'saveYjsState').mockRejectedValue(new Error('Network error'));

      const result = await manager.save();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(manager.isSaving).toBe(false);
    });
  });

  describe('saveYjsState', () => {
    it('encodes Yjs state', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      await manager.saveYjsState('project-123', mockBridge.documentManager);
      expect(global.Y.encodeStateAsUpdate).toHaveBeenCalledWith(mockBridge.documentManager.ydoc);
    });

    it('sends state to server', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token', apiUrl: 'http://test.com/api' });
      await manager.saveYjsState('project-123', mockBridge.documentManager);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test.com/api/projects/uuid/project-123/yjs-document',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/octet-stream',
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('throws on server error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error'),
      });

      const manager = new SaveManager(mockBridge);
      await expect(manager.saveYjsState('project-123', mockBridge.documentManager)).rejects.toThrow(
        'Failed to save document: 500 Internal error'
      );
    });
  });

  describe('uploadAssetBatch', () => {
    it('creates FormData with files', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      const assets = [
        { id: 'asset-1', blob: new Blob(['test1']), filename: 'file1.txt', mime: 'text/plain', hash: 'hash1' },
        { id: 'asset-2', blob: new Blob(['test2']), filename: 'file2.txt', mime: 'text/plain', hash: 'hash2' },
      ];

      await manager.uploadAssetBatch('project-123', assets, mockBridge.assetManager);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects/project-123/assets/sync'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('throws on server error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 413,
        text: () => Promise.resolve('Payload too large'),
      });

      const manager = new SaveManager(mockBridge);
      const assets = [{ id: 'a', blob: new Blob(['test']), filename: 'test.txt' }];

      await expect(manager.uploadAssetBatch('project-123', assets, mockBridge.assetManager)).rejects.toThrow(
        'Failed to upload assets: 413 Payload too large'
      );
    });
  });

  describe('uploadChunk', () => {
    it('sends chunk with correct parameters', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token', apiUrl: 'http://test.com/api' });
      const asset = { id: 'asset-1', filename: 'video.mp4', mime: 'video/mp4' };
      const chunkBlob = new Blob(['chunk data']);

      await manager.uploadChunk('project-123', asset, 'upload-id-123', 1, 5, chunkBlob);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test.com/api/projects/project-123/assets/upload-chunk',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('throws on chunk upload error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      const manager = new SaveManager(mockBridge);
      const chunkBlob = new Blob(['test']);

      await expect(
        manager.uploadChunk('project-123', { id: 'a', filename: 'test.mp4' }, 'id', 1, 5, chunkBlob)
      ).rejects.toThrow('Chunk 1/5 upload failed: 500 Server error');
    });
  });

  describe('finalizeChunkedUpload', () => {
    it('sends finalize request', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token', apiUrl: 'http://test.com/api' });
      const asset = { id: 'asset-1', filename: 'video.mp4', mime: 'video/mp4' };

      await manager.finalizeChunkedUpload('project-123', asset, 'upload-id-123', 10);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test.com/api/projects/project-123/assets/upload-chunk/finalize',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
          body: expect.stringContaining('upload-id-123'),
        })
      );
    });
  });

  describe('updateProjectMetadata', () => {
    it('skips when metadata is null', async () => {
      const manager = new SaveManager(mockBridge);
      await manager.updateProjectMetadata('project-123', null);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('skips when no title', async () => {
      const manager = new SaveManager(mockBridge);
      const metadata = { get: vi.fn().mockReturnValue(null) };
      await manager.updateProjectMetadata('project-123', metadata);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends PATCH request with title', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token', apiUrl: 'http://test.com/api' });
      const metadata = { get: vi.fn().mockReturnValue('My Project') };

      await manager.updateProjectMetadata('project-123', metadata);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test.com/api/projects/uuid/project-123/metadata',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ title: 'My Project' }),
        })
      );
    });

    it('handles errors gracefully', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      const manager = new SaveManager(mockBridge);
      const metadata = { get: vi.fn().mockReturnValue('Title') };

      // Should not throw
      await expect(manager.updateProjectMetadata('project-123', metadata)).resolves.not.toThrow();
    });
  });

  describe('hasUnsavedChanges', () => {
    it('returns false when no asset manager', async () => {
      const manager = new SaveManager(mockBridge);
      mockBridge.assetManager = null;
      const result = await manager.hasUnsavedChanges();
      expect(result).toBe(false);
    });

    it('returns true when pending assets exist', async () => {
      const manager = new SaveManager(mockBridge);
      mockBridge.assetManager.getPendingAssets.mockResolvedValue([{ id: 'asset-1' }]);
      const result = await manager.hasUnsavedChanges();
      expect(result).toBe(true);
    });

    it('returns false when no pending assets', async () => {
      const manager = new SaveManager(mockBridge);
      mockBridge.assetManager.getPendingAssets.mockResolvedValue([]);
      const result = await manager.hasUnsavedChanges();
      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('returns pending assets count', async () => {
      const manager = new SaveManager(mockBridge);
      mockBridge.assetManager.getPendingAssets.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

      const status = await manager.getStatus();

      expect(status.pendingAssets).toBe(2);
    });

    it('returns isSaving state', async () => {
      const manager = new SaveManager(mockBridge);
      manager.isSaving = true;

      const status = await manager.getStatus();

      expect(status.isSaving).toBe(true);
    });

    it('handles missing asset manager', async () => {
      const manager = new SaveManager(mockBridge);
      mockBridge.assetManager = null;

      const status = await manager.getStatus();

      expect(status.pendingAssets).toBe(0);
    });
  });
});
