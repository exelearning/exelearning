/**
 * SaveManager Tests
 *
 * Unit tests for the SaveManager class that coordinates project saving.
 *
 * Run with: make test-frontend
 */

// Mock Logger BEFORE requiring SaveManager
global.Logger = { log: vi.fn() };

const SaveManager = require('./SaveManager.js');
const { ProgressTracker } = require('./SaveManager.js');

describe('SaveManager', () => {
  let mockBridge;
  let mockFetch;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve(''),
    });
    global.fetch = mockFetch;

    // Mock XMLHttpRequest for saveYjsState
    class MockXMLHttpRequest {
      constructor() {
        this.open = vi.fn();
        this.send = vi.fn(() => {
          // Simulate immediate success
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        });
        this.setRequestHeader = vi.fn();
        this.upload = { onprogress: null };
        this.status = 200;
        this.responseText = '{"success":true}';
      }
    }
    global.XMLHttpRequest = MockXMLHttpRequest;

    // Mock eXeLearning global
    global.eXeLearning = {
      config: {},
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
        ydoc: new window.Y.Doc(),
        getMetadata: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue('Test Project'),
        }),
        markClean: vi.fn(),
      },
      assetManager: {
        projectId: 'project-123',
        getPendingAssets: vi.fn().mockResolvedValue([]),
        getPendingAssetsMetadata: vi.fn().mockReturnValue([]),
        getPendingAssetsBatch: vi.fn(async (assets) => assets),
        getBlob: vi.fn().mockResolvedValue(null),
        getBlobForExport: vi.fn().mockResolvedValue(null),
        markAssetUploaded: vi.fn(),
      },
      updateSaveStatus: vi.fn(),
    };
  });

  afterEach(() => {
    delete global.fetch;
    delete global.eXeLearning;
    delete global._;
    delete global.XMLHttpRequest;
    delete window.electronAPI;
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

    it('initializes MAX_CONCURRENT_BATCHES to 2', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.MAX_CONCURRENT_BATCHES).toBe(2);
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

  describe('ProgressTracker', () => {
    describe('calculateWeights', () => {
      it('returns equal weights when no data to upload', () => {
        const weights = ProgressTracker.calculateWeights(0, 0);
        expect(weights.yjs).toBe(0.45);
        expect(weights.assets).toBe(0.45);
        expect(weights.finalize).toBe(0.10);
      });

      it('calculates weights proportional to bytes', () => {
        const yjsBytes = 2 * 1024 * 1024; // 2MB
        const assetBytes = 50 * 1024 * 1024; // 50MB
        const weights = ProgressTracker.calculateWeights(yjsBytes, assetBytes);

        // Total 52MB, reserve 5% for finalize
        // Yjs: 2/52 * 0.95 ≈ 0.0365
        // Assets: 50/52 * 0.95 ≈ 0.9135
        expect(weights.yjs).toBeCloseTo(0.0365, 2);
        expect(weights.assets).toBeCloseTo(0.9135, 2);
        expect(weights.finalize).toBe(0.05);
      });

      it('handles yjs-only scenario', () => {
        const weights = ProgressTracker.calculateWeights(1000000, 0);
        expect(weights.yjs).toBeCloseTo(0.95, 2);
        expect(weights.assets).toBe(0);
        expect(weights.finalize).toBe(0.05);
      });

      it('handles assets-only scenario', () => {
        const weights = ProgressTracker.calculateWeights(0, 1000000);
        expect(weights.yjs).toBe(0);
        expect(weights.assets).toBeCloseTo(0.95, 2);
        expect(weights.finalize).toBe(0.05);
      });
    });

    describe('phase progress tracking', () => {
      const createMockToast = () => ({ setProgress: vi.fn(), toastBody: { innerHTML: '' } });

      it('updates toast with yjs phase progress', () => {
        const mockToast = createMockToast();
        const tracker = new ProgressTracker(mockToast, { yjs: 0.5, assets: 0.45, finalize: 0.05 });

        tracker.setPhase('yjs');
        tracker.updatePhaseProgress(50); // 50% of yjs phase

        // 50% of 0.5 = 0.25 = 25%
        expect(mockToast.setProgress).toHaveBeenCalledWith(25);
      });

      it('updates toast with assets phase progress', () => {
        const mockToast = createMockToast();
        const tracker = new ProgressTracker(mockToast, { yjs: 0.10, assets: 0.85, finalize: 0.05 });

        tracker.setPhase('assets');
        tracker.updatePhaseProgress(50); // 50% of assets phase

        // yjs complete (0.10) + 50% of 0.85 = 0.10 + 0.425 = 0.525 = 53%
        expect(mockToast.setProgress).toHaveBeenCalledWith(53);
      });

      it('updates toast with finalize phase progress', () => {
        const mockToast = createMockToast();
        const tracker = new ProgressTracker(mockToast, { yjs: 0.45, assets: 0.45, finalize: 0.10 });

        tracker.setPhase('finalize');
        tracker.updatePhaseProgress(100); // 100% of finalize phase

        // yjs (0.45) + assets (0.45) + finalize (0.10) = 100%
        expect(mockToast.setProgress).toHaveBeenCalledWith(100);
      });

      it('progress never decreases', () => {
        const mockToast = createMockToast();
        const tracker = new ProgressTracker(mockToast, { yjs: 0.50, assets: 0.45, finalize: 0.05 });

        tracker.setPhase('yjs');
        tracker.updatePhaseProgress(50);
        expect(mockToast.setProgress).toHaveBeenCalledWith(25);

        // Try to set lower progress
        tracker.updatePhaseProgress(25);
        // Should not call setProgress with lower value
        expect(mockToast.setProgress).toHaveBeenCalledTimes(1);

        // Higher progress should work
        tracker.updatePhaseProgress(75);
        expect(mockToast.setProgress).toHaveBeenCalledWith(38);
      });

      it('clamps phase progress to 0-100', () => {
        const mockToast = createMockToast();
        const tracker = new ProgressTracker(mockToast, { yjs: 0.50, assets: 0.45, finalize: 0.05 });

        tracker.setPhase('yjs');
        tracker.updatePhaseProgress(150); // Over 100%
        expect(mockToast.setProgress).toHaveBeenCalledWith(50);

        tracker.updatePhaseProgress(-10); // Below 0%
        // Should not update since 50 > calculated value
        expect(mockToast.setProgress).toHaveBeenCalledTimes(1);
      });

      it('handles null toast gracefully', () => {
        const tracker = new ProgressTracker(null, { yjs: 0.45, assets: 0.45, finalize: 0.10 });
        tracker.setPhase('yjs');
        // Should not throw
        expect(() => tracker.updatePhaseProgress(50)).not.toThrow();
      });

      it('getProgress returns last reported progress', () => {
        const mockToast = createMockToast();
        const tracker = new ProgressTracker(mockToast, { yjs: 0.50, assets: 0.45, finalize: 0.05 });

        expect(tracker.getProgress()).toBe(0);

        tracker.setPhase('yjs');
        tracker.updatePhaseProgress(100);
        expect(tracker.getProgress()).toBe(50);
      });
    });
  });

  describe('estimateYjsStateBytes', () => {
    it('returns 0 when documentManager is null', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.estimateYjsStateBytes(null)).toBe(0);
    });

    it('returns 0 when ydoc is null', () => {
      const manager = new SaveManager(mockBridge);
      expect(manager.estimateYjsStateBytes({ ydoc: null })).toBe(0);
    });

    it('returns encoded state length', () => {
      const manager = new SaveManager(mockBridge);
      const bytes = manager.estimateYjsStateBytes(mockBridge.documentManager);
      expect(bytes).toBeGreaterThan(0);
    });

    it('handles encoding errors gracefully', () => {
      const manager = new SaveManager(mockBridge);
      // Pass a documentManager with a corrupted ydoc that will throw on encode
      const badDocManager = {
        ydoc: {
          // Y.encodeStateAsUpdate will fail on this invalid object
          store: null,
        },
      };

      // Should return 0 without throwing
      expect(manager.estimateYjsStateBytes(badDocManager)).toBe(0);
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

      // saveYjsState is called with projectId, documentManager, pre-encoded state, and onProgress callback
      expect(spy).toHaveBeenCalledWith('project-123', mockBridge.documentManager, expect.any(Uint8Array), expect.any(Function));
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

    it('uploads pending assets with metadata-only objects (no blob property)', async () => {
      const manager = new SaveManager(mockBridge);
      const pendingMeta = [
        { id: 'asset-1', filename: 'test.txt', mime: 'text/plain', size: 4, uploaded: false },
      ];
      mockBridge.assetManager.getPendingAssetsMetadata.mockReturnValue(pendingMeta);

      const uploadSpy = vi.spyOn(manager, 'uploadAssets').mockResolvedValue({ uploaded: 1, failed: 0 });

      await manager.save();

      expect(uploadSpy).toHaveBeenCalled();
      // Verify uploadAssets receives metadata-only objects (no blob property)
      const passedAssets = uploadSpy.mock.calls[0][2];
      expect(passedAssets).toEqual(pendingMeta);
      expect(passedAssets[0].blob).toBeUndefined();
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
    let xhrInstances;

    beforeEach(() => {
      xhrInstances = [];
      // Create mock XHR class that auto-triggers onload
      class MockXHR {
        constructor() {
          this.open = vi.fn();
          this.setRequestHeader = vi.fn();
          this.upload = { onprogress: null };
          this.status = 200;
          this.responseText = '{"success":true}';
          this.send = vi.fn(() => {
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 0);
          });
          xhrInstances.push(this);
        }
      }
      global.XMLHttpRequest = MockXHR;
    });

    it('encodes Yjs state', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      await manager.saveYjsState('project-123', mockBridge.documentManager, null);

      // Verify that the body sent to XHR is a Uint8Array (result of encoding)
      expect(xhrInstances.length).toBeGreaterThan(0);
      const xhr = xhrInstances[0];
      expect(xhr.send).toHaveBeenCalled();
      const sentData = xhr.send.mock.calls[0][0];
      expect(sentData).toBeInstanceOf(Uint8Array);
    });

    it('sends state to server with markSaved=true (explicit save)', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token', apiUrl: 'http://test.com/api' });
      await manager.saveYjsState('project-123', mockBridge.documentManager, null);

      const xhr = xhrInstances[0];
      expect(xhr.open).toHaveBeenCalledWith(
        'POST',
        'http://test.com/api/projects/uuid/project-123/yjs-document?markSaved=true'
      );
      expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
      expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer test-token');
    });

    it('sends X-Project-Title header with encoded title', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token', apiUrl: 'http://test.com/api' });
      mockBridge.documentManager.getMetadata.mockReturnValue({
        get: vi.fn().mockReturnValue('My Test Project'),
      });

      await manager.saveYjsState('project-123', mockBridge.documentManager, null);

      const xhr = xhrInstances[0];
      expect(xhr.setRequestHeader).toHaveBeenCalledWith('X-Project-Title', 'My%20Test%20Project');
    });

    it('encodes special characters in title header', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token', apiUrl: 'http://test.com/api' });
      mockBridge.documentManager.getMetadata.mockReturnValue({
        get: vi.fn().mockReturnValue('Título con ñ y émojis 🎉'),
      });

      await manager.saveYjsState('project-123', mockBridge.documentManager, null);

      const xhr = xhrInstances[0];
      const titleCall = xhr.setRequestHeader.mock.calls.find(c => c[0] === 'X-Project-Title');
      expect(titleCall).toBeTruthy();
      expect(titleCall[1]).toBe(encodeURIComponent('Título con ñ y émojis 🎉'));
      expect(decodeURIComponent(titleCall[1])).toBe('Título con ñ y émojis 🎉');
    });

    it('sends empty title header when metadata has no title', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token', apiUrl: 'http://test.com/api' });
      mockBridge.documentManager.getMetadata.mockReturnValue({
        get: vi.fn().mockReturnValue(null),
      });

      await manager.saveYjsState('project-123', mockBridge.documentManager, null);

      const xhr = xhrInstances[0];
      expect(xhr.setRequestHeader).toHaveBeenCalledWith('X-Project-Title', '');
    });

    it('handles missing getMetadata method gracefully', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token', apiUrl: 'http://test.com/api' });
      mockBridge.documentManager.getMetadata = undefined;

      await manager.saveYjsState('project-123', mockBridge.documentManager, null);

      const xhr = xhrInstances[0];
      expect(xhr.setRequestHeader).toHaveBeenCalledWith('X-Project-Title', '');
    });

    it('throws on server error', async () => {
      // Override XHR to return error status
      class ErrorXHR {
        constructor() {
          this.open = vi.fn();
          this.setRequestHeader = vi.fn();
          this.upload = { onprogress: null };
          this.status = 500;
          this.responseText = 'Internal error';
          this.send = vi.fn(() => {
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 0);
          });
        }
      }
      global.XMLHttpRequest = ErrorXHR;

      const manager = new SaveManager(mockBridge);
      await expect(manager.saveYjsState('project-123', mockBridge.documentManager, null)).rejects.toThrow(
        'Failed to save document: 500 Internal error'
      );
    });

    it('calls onProgress callback with upload progress', async () => {
      // Override XHR to trigger progress events
      class ProgressXHR {
        constructor() {
          this.open = vi.fn();
          this.setRequestHeader = vi.fn();
          this.upload = { onprogress: null };
          this.status = 200;
          this.responseText = '{"success":true}';
          this.send = vi.fn(() => {
            if (this.upload.onprogress) {
              this.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
              this.upload.onprogress({ lengthComputable: true, loaded: 100, total: 100 });
            }
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 0);
          });
        }
      }
      global.XMLHttpRequest = ProgressXHR;

      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      const progressCallback = vi.fn();

      await manager.saveYjsState('project-123', mockBridge.documentManager, null, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(0); // Initial
      expect(progressCallback).toHaveBeenCalledWith(50); // 50%
      expect(progressCallback).toHaveBeenCalledWith(100); // 100%
    });

    it('throws on network error', async () => {
      // Override XHR to trigger error
      class NetworkErrorXHR {
        constructor() {
          this.open = vi.fn();
          this.setRequestHeader = vi.fn();
          this.upload = { onprogress: null };
          this.send = vi.fn(() => {
            setTimeout(() => {
              if (this.onerror) this.onerror();
            }, 0);
          });
        }
      }
      global.XMLHttpRequest = NetworkErrorXHR;

      const manager = new SaveManager(mockBridge);
      await expect(manager.saveYjsState('project-123', mockBridge.documentManager, null)).rejects.toThrow(
        'Network error while saving document'
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

    it('loads blobs on-demand via assetManager.getBlob when asset has no blob', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      const mockBlob = new Blob(['loaded-on-demand']);
      const mockAssetManager = {
        getBlob: vi.fn().mockResolvedValue(mockBlob),
        markAssetUploaded: vi.fn(),
      };

      const assets = [
        { id: 'lazy-asset', filename: 'lazy.txt', mime: 'text/plain', hash: 'h1' },
      ];

      await manager.uploadAssetBatch('project-123', assets, mockAssetManager);

      expect(mockAssetManager.getBlob).toHaveBeenCalledWith('lazy-asset');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('skips assets when blob is not available from getBlob', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      const mockAssetManager = {
        getBlob: vi.fn().mockResolvedValue(null),
        markAssetUploaded: vi.fn(),
      };

      const assets = [
        { id: 'no-blob', filename: 'missing.txt', mime: 'text/plain', hash: 'h1' },
      ];

      await manager.uploadAssetBatch('project-123', assets, mockAssetManager);

      // FormData should have been sent but with no files (metadata-only JSON still sent)
      expect(mockFetch).toHaveBeenCalled();
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

  describe('uploadLargeAsset', () => {
    it('throws error when asset has no blob', async () => {
      const manager = new SaveManager(mockBridge);
      const asset = { id: 'asset-1', filename: 'test.mp4' };

      await expect(manager.uploadLargeAsset('project-123', asset, () => {}))
        .rejects.toThrow('Asset has no blob data');
    });

    it('uploads chunks in sequence', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_SIZE = 5; // Small chunk size for testing

      // Create a small "large" file (15 bytes = 3 chunks of 5 bytes)
      const blob = new Blob(['123451234512345']); // 15 bytes
      const asset = { id: 'asset-1', filename: 'test.mp4', mime: 'video/mp4', blob };

      let progressValues = [];
      const onProgress = (p) => progressValues.push(p);

      // Mock fetch to return complete on last chunk
      let chunkCount = 0;
      mockFetch.mockImplementation(() => {
        chunkCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            complete: chunkCount >= 3, // Complete after 3 chunks
          }),
        });
      });

      await manager.uploadLargeAsset('project-123', asset, onProgress);

      // Should have uploaded 3 chunks
      expect(chunkCount).toBe(3);
      // Progress should increase
      expect(progressValues.length).toBeGreaterThan(0);
    });

    it('calls finalize when chunks dont return complete', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_SIZE = 10; // 10 bytes per chunk

      const blob = new Blob(['12345678901234567890']); // 20 bytes = 2 chunks
      const asset = { id: 'asset-1', filename: 'test.mp4', mime: 'video/mp4', blob };

      let finalizeCallCount = 0;
      mockFetch.mockImplementation((url) => {
        if (url.includes('finalize')) {
          finalizeCallCount++;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, complete: true }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, complete: false }),
        });
      });

      await manager.uploadLargeAsset('project-123', asset, () => {});

      expect(finalizeCallCount).toBeGreaterThan(0);
    });

    it('throws after max finalize retries', async () => {
      // Use fake timers to speed up the 10 retries × 300ms delays
      vi.useFakeTimers();

      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_SIZE = 10;

      const blob = new Blob(['1234567890']); // 10 bytes = 1 chunk
      const asset = { id: 'asset-1', filename: 'test.mp4', mime: 'video/mp4', blob };

      // Mock: chunk uploads succeed but finalize always returns incomplete
      mockFetch.mockImplementation((url) => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, complete: false, progress: { received: 0 } }),
        });
      });

      // Start the upload and capture error (don't re-throw to avoid unhandled rejection)
      let caughtError = null;
      const uploadPromise = manager.uploadLargeAsset('project-123', asset, () => {})
        .catch((err) => { caughtError = err; });

      // Advance timers to complete all 10 retries (10 × 300ms = 3000ms)
      await vi.runAllTimersAsync();

      // Wait for promise to settle
      await uploadPromise;

      // Verify the error was caught with correct message
      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toBe('Chunked upload finished but server did not confirm completion after retries');

      vi.useRealTimers();
    });
  });

  describe('uploadAssets', () => {
    it('handles empty assets array', async () => {
      const manager = new SaveManager(mockBridge);
      const result = await manager.uploadAssets('project-123', mockBridge.assetManager, [], null);
      expect(result.uploaded).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('separates large and small assets', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000; // 1KB threshold for testing

      const smallAsset = { id: 'small', blob: new Blob(['small']), filename: 'small.txt', mime: 'text/plain' };
      const largeAsset = { id: 'large', blob: new Blob(['x'.repeat(2000)]), filename: 'large.bin', mime: 'application/octet-stream' };

      const uploadLargeSpy = vi.spyOn(manager, 'uploadLargeAssetsChunked').mockResolvedValue({ uploaded: 1, failed: 0 });
      const uploadBatchSpy = vi.spyOn(manager, 'uploadSmallAssetsBatched').mockResolvedValue({ uploaded: 1, failed: 0 });

      await manager.uploadAssets('project-123', mockBridge.assetManager, [smallAsset, largeAsset], null);

      expect(uploadLargeSpy).toHaveBeenCalled();
      expect(uploadBatchSpy).toHaveBeenCalled();
    });

    it('continues on batch failure', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });

      const assets = [
        { id: 'a1', blob: new Blob(['1']), filename: 'a1.txt' },
        { id: 'a2', blob: new Blob(['2']), filename: 'a2.txt' },
      ];

      // Use the batch method directly since uploadAssets now delegates to helper methods
      vi.spyOn(manager, 'uploadSmallAssetsBatched').mockResolvedValue({ uploaded: 1, failed: 1 });

      const result = await manager.uploadAssets('project-123', mockBridge.assetManager, assets, null);

      expect(result.failed).toBe(1);
      expect(result.uploaded).toBe(1);
    });

    it('uses priority batches when queue is set', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.priorityQueue = { getPriority: vi.fn().mockReturnValue(0) };

      // uploadSmallAssetsBatched is what uses priority batches now
      const batchSpy = vi.spyOn(manager, 'uploadSmallAssetsBatched').mockResolvedValue({ uploaded: 1, failed: 0 });

      await manager.uploadAssets('project-123', mockBridge.assetManager, [{ id: 'a', blob: new Blob(['1']) }], null);

      expect(batchSpy).toHaveBeenCalled();
    });

    it('updates progress via progressTracker', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      const mockProgressTracker = {
        updatePhaseProgress: vi.fn(),
        updateAssetProgress: vi.fn(),
      };

      // Mock uploadAssetBatch to succeed (called by uploadSmallAssetsBatched)
      vi.spyOn(manager, 'uploadAssetBatch').mockResolvedValue({ success: true });

      await manager.uploadAssets('project-123', mockBridge.assetManager, [
        { id: 'a', blob: new Blob(['1']), filename: 'a.txt' },
      ], null, mockProgressTracker);

      // progressTracker.updateAssetProgress is called by updateCombinedProgress
      expect(mockProgressTracker.updateAssetProgress).toHaveBeenCalled();
    });

    it('handles large asset upload failure', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 100;

      const largeAsset = { id: 'large', blob: new Blob(['x'.repeat(200)]), filename: 'large.bin' };

      vi.spyOn(manager, 'uploadLargeAssetsChunked').mockResolvedValue({ uploaded: 0, failed: 1 });

      const result = await manager.uploadAssets('project-123', mockBridge.assetManager, [largeAsset], null);

      expect(result.failed).toBe(1);
      expect(result.uploaded).toBe(0);
    });

    it('separates large and small assets using size metadata when blob is absent', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000;

      // Assets with size metadata only (no blob) - simulates lazy loading
      const smallAsset = { id: 'small', size: 50, filename: 'small.txt', mime: 'text/plain' };
      const largeAsset = { id: 'large', size: 2000, filename: 'large.bin', mime: 'application/octet-stream' };

      const uploadLargeSpy = vi.spyOn(manager, 'uploadLargeAssetsChunked').mockResolvedValue({ uploaded: 1, failed: 0 });
      const uploadBatchSpy = vi.spyOn(manager, 'uploadSmallAssetsBatched').mockResolvedValue({ uploaded: 1, failed: 0 });

      await manager.uploadAssets('project-123', mockBridge.assetManager, [smallAsset, largeAsset], null);

      // Should correctly separate based on size metadata
      expect(uploadLargeSpy).toHaveBeenCalled();
      const largeArgs = uploadLargeSpy.mock.calls[0];
      expect(largeArgs[2][0].id).toBe('large');

      expect(uploadBatchSpy).toHaveBeenCalled();
    });
  });

  describe('createPriorityBatches - additional tests', () => {
    afterEach(() => {
      delete global.window.AssetPriorityQueue;
    });

    it('creates individual batches for critical assets', () => {
      const manager = new SaveManager(mockBridge);
      global.window.AssetPriorityQueue = {
        PRIORITY: { CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25, IDLE: 0 },
      };

      manager.priorityQueue = {
        getPriority: vi.fn((id) => {
          if (id === 'c1' || id === 'c2') return 100; // Critical
          return 0;
        }),
      };

      const assets = [
        { id: 'c1', blob: { size: 1000 } },
        { id: 'c2', blob: { size: 1000 } },
        { id: 'n1', blob: { size: 1000 } },
      ];

      const batches = manager.createPriorityBatches(assets);

      // Each critical asset should be in its own batch
      expect(batches[0]).toEqual([{ id: 'c1', blob: { size: 1000 } }]);
      expect(batches[1]).toEqual([{ id: 'c2', blob: { size: 1000 } }]);
    });

    it('creates smaller batches for high priority assets', () => {
      const manager = new SaveManager(mockBridge);
      global.window.AssetPriorityQueue = {
        PRIORITY: { CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25, IDLE: 0 },
      };

      manager.priorityQueue = {
        getPriority: vi.fn((id) => {
          if (id.startsWith('h')) return 80; // High
          return 0;
        }),
      };

      // Create 10 high priority assets
      const assets = Array(10).fill(null).map((_, i) => ({
        id: `h${i}`,
        blob: { size: 1000 },
      }));

      const batches = manager.createPriorityBatches(assets);

      // High priority batches should have max 5 files
      expect(batches[0].length).toBeLessThanOrEqual(5);
    });

    it('uses default PRIORITY when window.AssetPriorityQueue not available', () => {
      const manager = new SaveManager(mockBridge);
      manager.priorityQueue = {
        getPriority: vi.fn().mockReturnValue(100),
      };

      const assets = [{ id: 'a', blob: { size: 1000 } }];
      const batches = manager.createPriorityBatches(assets);

      // Should still work with default priority values
      expect(batches.length).toBeGreaterThan(0);
    });
  });

  describe('save - additional edge cases', () => {
    it('skips asset upload when assetManager has no projectId', async () => {
      const manager = new SaveManager(mockBridge);
      mockBridge.assetManager.projectId = null;

      const uploadSpy = vi.spyOn(manager, 'uploadAssets');

      await manager.save();

      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('handles asset upload errors gracefully', async () => {
      const manager = new SaveManager(mockBridge);
      // Set up pending asset metadata
      const pendingMeta = [{ id: 'a1', filename: 'a.txt', size: 1, uploaded: false }];
      mockBridge.assetManager.getPendingAssetsMetadata.mockReturnValue(pendingMeta);
      // Mock uploadAssetBatch to fail (uploadSmallAssetsBatched loads blobs per-batch internally)
      mockBridge.assetManager.getPendingAssetsBatch.mockResolvedValue([
        { id: 'a1', blob: new Blob(['1']), filename: 'a.txt', projectId: 'project-123' },
      ]);
      vi.spyOn(manager, 'uploadAssetBatch').mockRejectedValue(new Error('Upload error'));

      const result = await manager.save();

      // Should still succeed overall (asset errors are caught in the try-catch)
      expect(result.success).toBe(true);
    });

    it('does not create toast when showProgress is false', async () => {
      const manager = new SaveManager(mockBridge);
      const createToastSpy = vi.spyOn(global.eXeLearning.app.toasts, 'createToast');

      await manager.save({ showProgress: false });

      expect(createToastSpy).not.toHaveBeenCalled();
    });

    it('updates save status on error', async () => {
      const manager = new SaveManager(mockBridge);
      vi.spyOn(manager, 'saveYjsState').mockRejectedValue(new Error('Save failed'));

      await manager.save();

      expect(mockBridge.updateSaveStatus).toHaveBeenCalledWith('error', 'Save failed');
    });

    it('handles missing documentManager', async () => {
      const manager = new SaveManager(mockBridge);
      mockBridge.documentManager = null;

      const result = await manager.save();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not initialized');
    });
  });

  describe('finalizeChunkedUpload - error handling', () => {
    it('throws on finalize error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      const manager = new SaveManager(mockBridge);
      const asset = { id: 'a', filename: 'test.mp4', mime: 'video/mp4' };

      await expect(manager.finalizeChunkedUpload('project-123', asset, 'id', 10))
        .rejects.toThrow('Finalize failed: 500 Server error');
    });

    it('uses default filename when not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const manager = new SaveManager(mockBridge, { token: 'test-token', apiUrl: 'http://test.com/api' });
      const asset = { id: 'asset-123' }; // No filename

      await manager.finalizeChunkedUpload('project-123', asset, 'upload-id', 5);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('asset-asset-123'),
        })
      );
    });
  });

  describe('createSessionChunks', () => {
    it('returns single chunk for small arrays', () => {
      const manager = new SaveManager(mockBridge);
      const assets = Array(50).fill(null).map((_, i) => ({ id: `asset-${i}` }));
      const chunks = manager.createSessionChunks(assets);

      expect(chunks.length).toBe(1);
      expect(chunks[0].length).toBe(50);
    });

    it('splits assets into chunks of SESSION_BATCH_SIZE', () => {
      const manager = new SaveManager(mockBridge);
      const assets = Array(335).fill(null).map((_, i) => ({ id: `asset-${i}` }));
      const chunks = manager.createSessionChunks(assets);

      // 335 files / 200 per batch = 2 batches (200 + 135)
      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBe(200);
      expect(chunks[1].length).toBe(135);
    });

    it('handles exact multiple of batch size', () => {
      const manager = new SaveManager(mockBridge);
      const assets = Array(400).fill(null).map((_, i) => ({ id: `asset-${i}` }));
      const chunks = manager.createSessionChunks(assets);

      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBe(200);
      expect(chunks[1].length).toBe(200);
    });

    it('respects custom maxPerBatch parameter', () => {
      const manager = new SaveManager(mockBridge);
      const assets = Array(50).fill(null).map((_, i) => ({ id: `asset-${i}` }));
      const chunks = manager.createSessionChunks(assets, 10);

      expect(chunks.length).toBe(5);
      expect(chunks[0].length).toBe(10);
    });

    it('splits session chunks by total bytes as well as file count', () => {
      const manager = new SaveManager(mockBridge);
      const mb = 1024 * 1024;
      const assets = [
        { id: 'asset-1', size: 12 * mb },
        { id: 'asset-2', size: 9 * mb },
        { id: 'asset-3', size: 4 * mb },
      ];

      const chunks = manager.createSessionChunks(assets, 200, 20 * mb);

      expect(chunks.length).toBe(2);
      expect(chunks[0].map(asset => asset.id)).toEqual(['asset-1']);
      expect(chunks[1].map(asset => asset.id)).toEqual(['asset-2', 'asset-3']);
    });

    it('returns empty array for empty input', () => {
      const manager = new SaveManager(mockBridge);
      const chunks = manager.createSessionChunks([]);
      expect(chunks).toEqual([]);
    });

    it('handles single asset', () => {
      const manager = new SaveManager(mockBridge);
      const chunks = manager.createSessionChunks([{ id: 'a' }]);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual([{ id: 'a' }]);
    });
  });

  describe('uploadWithSession - multi-batch chunking', () => {
    let mockWsHandler;

    beforeEach(() => {
      // Mock WebSocket handler with upload session support
      mockWsHandler = {
        connected: true,
        createUploadSession: vi.fn().mockResolvedValue({
          sessionToken: 'test-session-token',
          config: {
            endpoints: {
              batch: '/api/upload-session/test-session-token/batch',
            },
          },
        }),
        on: vi.fn(),
        off: vi.fn(),
      };
    });

    it('uploads files in multiple batches when exceeding SESSION_BATCH_SIZE', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.setWebSocketHandler(mockWsHandler);

      // Create 335 assets (should split into 2 batches: 200 + 135)
      const assets = Array(335).fill(null).map((_, i) => ({
        id: `asset-${i}`,
        blob: new Blob([`content-${i}`]),
        filename: `file-${i}.txt`,
        mime: 'text/plain',
      }));

      let fetchCallCount = 0;
      mockFetch.mockImplementation(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            uploaded: fetchCallCount === 1 ? 200 : 135,
            failed: 0,
          }),
        });
      });

      const onProgress = vi.fn();
      const result = await manager.uploadWithSession('project-123', mockBridge.assetManager, assets, null, { onProgress });

      // Should make 2 HTTP requests (2 batches)
      expect(fetchCallCount).toBe(2);
      expect(result.uploaded).toBe(335); // 200 + 135
      expect(result.failed).toBe(0);
      expect(mockBridge.assetManager.getPendingAssetsBatch).toHaveBeenCalledWith(
        expect.any(Array),
        { restoreToMemory: false }
      );
    });

    it('accumulates progress across batches', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.setWebSocketHandler(mockWsHandler);

      const assets = Array(300).fill(null).map((_, i) => ({
        id: `asset-${i}`,
        blob: new Blob([`content-${i}`]),
        filename: `file-${i}.txt`,
        mime: 'text/plain',
      }));

      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ uploaded: 150, failed: 0 }),
        });
      });

      const result = await manager.uploadWithSession('project-123', mockBridge.assetManager, assets, null);

      // Total should be cumulative: 150 + 150 = 300
      expect(result.uploaded).toBe(300);
    });

    it('fails fast on batch error', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.setWebSocketHandler(mockWsHandler);

      const assets = Array(400).fill(null).map((_, i) => ({
        id: `asset-${i}`,
        blob: new Blob([`content-${i}`]),
        filename: `file-${i}.txt`,
        mime: 'text/plain',
      }));

      let fetchCallCount = 0;
      mockFetch.mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount === 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Server error'),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ uploaded: 200, failed: 0 }),
        });
      });

      await expect(manager.uploadWithSession('project-123', mockBridge.assetManager, assets, null))
        .rejects.toThrow('Session batch 2/2 failed');

      // Should have stopped at first failure
      expect(fetchCallCount).toBe(2);
    });

    it('registers and unregisters WebSocket listeners', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.setWebSocketHandler(mockWsHandler);

      const assets = [{ id: 'a', blob: new Blob(['test']), filename: 'a.txt', mime: 'text/plain' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ uploaded: 1, failed: 0 }),
      });

      await manager.uploadWithSession('project-123', mockBridge.assetManager, assets, null);

      // Verify listeners were registered
      expect(mockWsHandler.on).toHaveBeenCalledWith('uploadFileProgress', expect.any(Function));
      expect(mockWsHandler.on).toHaveBeenCalledWith('uploadBatchComplete', expect.any(Function));

      // Verify listeners were unregistered
      expect(mockWsHandler.off).toHaveBeenCalledWith('uploadFileProgress', expect.any(Function));
      expect(mockWsHandler.off).toHaveBeenCalledWith('uploadBatchComplete', expect.any(Function));
    });

    it('includes session token in HTTP headers', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.setWebSocketHandler(mockWsHandler);

      const assets = [{ id: 'a', blob: new Blob(['test']), filename: 'a.txt', mime: 'text/plain' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ uploaded: 1, failed: 0 }),
      });

      await manager.uploadWithSession('project-123', mockBridge.assetManager, assets, null);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload-session/'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Upload-Session': 'test-session-token',
          }),
        })
      );
    });

    it('skips assets without blobs', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.setWebSocketHandler(mockWsHandler);

      const assets = [
        { id: 'a', blob: new Blob(['test']), filename: 'a.txt', mime: 'text/plain' },
        { id: 'b', filename: 'b.txt', mime: 'text/plain' }, // No blob
        { id: 'c', blob: null, filename: 'c.txt', mime: 'text/plain' }, // Null blob
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ uploaded: 1, failed: 0 }),
      });

      // Should not throw, just skip missing blobs
      await expect(manager.uploadWithSession('project-123', mockBridge.assetManager, assets, null))
        .resolves.toBeDefined();
    });

    it('throws on session creation failure', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      mockWsHandler.createUploadSession = vi.fn().mockRejectedValue(new Error('WebSocket error'));
      manager.setWebSocketHandler(mockWsHandler);

      const assets = [{ id: 'a', blob: new Blob(['test']), filename: 'a.txt', mime: 'text/plain' }];

      await expect(manager.uploadWithSession('project-123', mockBridge.assetManager, assets, null))
        .rejects.toThrow('WebSocket error');
    });

    it('loads blobs on-demand via assetManager.getBlob in session upload', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.setWebSocketHandler(mockWsHandler);

      const mockBlob = new Blob(['on-demand-content']);
      const mockAssetManager = {
        getBlob: vi.fn().mockResolvedValue(mockBlob),
        markAssetUploaded: vi.fn(),
      };

      // Assets with size metadata but no blob (simulates lazy loading)
      const assets = [
        { id: 'lazy-1', size: 18, filename: 'lazy1.txt', mime: 'text/plain' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ uploaded: 1, failed: 0 }),
      });

      const result = await manager.uploadWithSession('project-123', mockAssetManager, assets, null);

      expect(mockAssetManager.getBlob).toHaveBeenCalledWith('lazy-1');
      expect(result.uploaded).toBe(1);
    });

    it('uses asset.size for totalBytes when blob is not present', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.setWebSocketHandler(mockWsHandler);

      const mockAssetManager = {
        getBlob: vi.fn().mockResolvedValue(new Blob(['data'])),
        markAssetUploaded: vi.fn(),
      };

      // Assets with size metadata only
      const assets = [
        { id: 'a1', size: 500, filename: 'a1.txt', mime: 'text/plain' },
        { id: 'a2', size: 300, filename: 'a2.txt', mime: 'text/plain' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ uploaded: 2, failed: 0 }),
      });

      const result = await manager.uploadWithSession('project-123', mockAssetManager, assets, null);

      expect(result.uploaded).toBe(2);
    });
  });

  describe('uploadLargeAssetsChunked', () => {
    it('returns correct counts for successful uploads', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });

      const largeAssets = [
        { id: 'large1', blob: new Blob(['x'.repeat(100)]), filename: 'large1.bin' },
        { id: 'large2', blob: new Blob(['x'.repeat(100)]), filename: 'large2.bin' },
      ];

      vi.spyOn(manager, 'uploadLargeAsset').mockResolvedValue({ success: true });

      const result = await manager.uploadLargeAssetsChunked(
        'project-123',
        mockBridge.assetManager,
        largeAssets,
        null,
        { baseProgress: 30, progressRange: 30 }
      );

      expect(result.uploaded).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('counts failures correctly', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });

      const largeAssets = [
        { id: 'large1', blob: new Blob(['x'.repeat(100)]), filename: 'large1.bin' },
        { id: 'large2', blob: new Blob(['x'.repeat(100)]), filename: 'large2.bin' },
      ];

      vi.spyOn(manager, 'uploadLargeAsset')
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await manager.uploadLargeAssetsChunked(
        'project-123',
        mockBridge.assetManager,
        largeAssets,
        null,
        { baseProgress: 30, progressRange: 30 }
      );

      expect(result.uploaded).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('calls onProgress callback', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });

      const largeAssets = [
        { id: 'large1', blob: new Blob(['x'.repeat(100)]), filename: 'large1.bin' },
      ];

      vi.spyOn(manager, 'uploadLargeAsset').mockResolvedValue({ success: true });

      const onProgress = vi.fn();

      await manager.uploadLargeAssetsChunked(
        'project-123',
        mockBridge.assetManager,
        largeAssets,
        null,
        { baseProgress: 0, progressRange: 100, onProgress }
      );

      expect(onProgress).toHaveBeenCalled();
    });

    it('loads blobs on-demand via assetManager.getBlob when asset has no blob', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });

      // Asset with metadata only (no blob) — simulates lazy loading
      const largeAssets = [
        { id: 'lazy1', size: 100, filename: 'lazy1.bin' },
      ];

      const mockBlob = new Blob(['x'.repeat(100)]);
      const mockAssetManager = {
        getBlob: vi.fn().mockResolvedValue(mockBlob),
        markAssetUploaded: vi.fn().mockResolvedValue(),
      };

      vi.spyOn(manager, 'uploadLargeAsset').mockResolvedValue({ success: true });

      const result = await manager.uploadLargeAssetsChunked(
        'project-123',
        mockAssetManager,
        largeAssets,
        null,
        { baseProgress: 0, progressRange: 100 }
      );

      expect(mockAssetManager.getBlob).toHaveBeenCalledWith('lazy1');
      expect(result.uploaded).toBe(1);
    });

    it('skips assets when getBlob returns null', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });

      const largeAssets = [
        { id: 'missing1', size: 100, filename: 'missing1.bin' },
      ];

      const mockAssetManager = {
        getBlob: vi.fn().mockResolvedValue(null),
        markAssetUploaded: vi.fn().mockResolvedValue(),
      };

      const result = await manager.uploadLargeAssetsChunked(
        'project-123',
        mockAssetManager,
        largeAssets,
        null,
        { baseProgress: 0, progressRange: 100 }
      );

      expect(result.uploaded).toBe(0);
      expect(result.failed).toBe(1);
    });
  });

  describe('uploadSmallAssetsBatched', () => {
    it('returns correct counts for successful uploads', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });

      const smallAssets = [
        { id: 'small1', blob: new Blob(['test1']), filename: 'small1.txt' },
        { id: 'small2', blob: new Blob(['test2']), filename: 'small2.txt' },
      ];

      vi.spyOn(manager, 'uploadAssetBatch').mockResolvedValue({ success: true });

      const result = await manager.uploadSmallAssetsBatched(
        'project-123',
        mockBridge.assetManager,
        smallAssets,
        null,
        { baseProgress: 60, progressRange: 30 }
      );

      expect(result.uploaded).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('counts failures correctly', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });

      const smallAssets = [
        { id: 'small1', blob: new Blob(['test1']), filename: 'small1.txt' },
        { id: 'small2', blob: new Blob(['test2']), filename: 'small2.txt' },
      ];

      // Create 2 batches, one fails
      vi.spyOn(manager, 'createSizeLimitedBatches').mockReturnValue([
        [smallAssets[0]],
        [smallAssets[1]],
      ]);
      vi.spyOn(manager, 'uploadAssetBatch')
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await manager.uploadSmallAssetsBatched(
        'project-123',
        mockBridge.assetManager,
        smallAssets,
        null,
        { baseProgress: 60, progressRange: 30 }
      );

      expect(result.uploaded).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('uses priority batches when queue is set', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.priorityQueue = { getPriority: vi.fn().mockReturnValue(0) };

      const spy = vi.spyOn(manager, 'createPriorityBatches').mockReturnValue([]);
      vi.spyOn(manager, 'uploadAssetBatch').mockResolvedValue({ success: true });

      await manager.uploadSmallAssetsBatched(
        'project-123',
        mockBridge.assetManager,
        [{ id: 'a', blob: new Blob(['1']) }],
        null,
        { baseProgress: 60, progressRange: 30 }
      );

      expect(spy).toHaveBeenCalled();
    });

    it('calls onProgress callback', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });

      const smallAssets = [
        { id: 'small1', blob: new Blob(['test1']), filename: 'small1.txt' },
      ];

      vi.spyOn(manager, 'uploadAssetBatch').mockResolvedValue({ success: true });

      const onProgress = vi.fn();

      await manager.uploadSmallAssetsBatched(
        'project-123',
        mockBridge.assetManager,
        smallAssets,
        null,
        { baseProgress: 0, progressRange: 100, onProgress }
      );

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('uploadAssets - hybrid parallel upload', () => {
    let mockWsHandler;

    beforeEach(() => {
      mockWsHandler = {
        connected: true,
        createUploadSession: vi.fn().mockResolvedValue({
          sessionToken: 'test-session-token',
          config: {
            endpoints: {
              batch: '/api/upload-session/test-session-token/batch',
            },
          },
        }),
        on: vi.fn(),
        off: vi.fn(),
      };
    });

    it('uses session upload for small files even when large files exist', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000; // 1KB threshold for testing
      manager.setWebSocketHandler(mockWsHandler);

      const smallAsset = { id: 'small', blob: new Blob(['small']), filename: 'small.txt', mime: 'text/plain' };
      const largeAsset = { id: 'large', blob: new Blob(['x'.repeat(2000)]), filename: 'large.bin', mime: 'application/octet-stream' };

      const uploadLargeSpy = vi.spyOn(manager, 'uploadLargeAssetsChunked').mockResolvedValue({ uploaded: 1, failed: 0 });
      const uploadSessionSpy = vi.spyOn(manager, 'uploadWithSession').mockResolvedValue({ uploaded: 1, failed: 0 });

      await manager.uploadAssets('project-123', mockBridge.assetManager, [smallAsset, largeAsset], null);

      // Both should be called - chunked for large, session for small
      expect(uploadLargeSpy).toHaveBeenCalled();
      expect(uploadSessionSpy).toHaveBeenCalled();
    });

    it('runs chunked and session uploads in parallel', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000;
      manager.setWebSocketHandler(mockWsHandler);

      const smallAsset = { id: 'small', blob: new Blob(['small']), filename: 'small.txt' };
      const largeAsset = { id: 'large', blob: new Blob(['x'.repeat(2000)]), filename: 'large.bin' };

      // Track the order of calls to verify parallelism
      const callOrder = [];

      vi.spyOn(manager, 'uploadLargeAssetsChunked').mockImplementation(async () => {
        callOrder.push('large-start');
        await new Promise(r => setTimeout(r, 10));
        callOrder.push('large-end');
        return { uploaded: 1, failed: 0 };
      });

      vi.spyOn(manager, 'uploadWithSession').mockImplementation(async () => {
        callOrder.push('session-start');
        await new Promise(r => setTimeout(r, 10));
        callOrder.push('session-end');
        return { uploaded: 1, failed: 0 };
      });

      await manager.uploadAssets('project-123', mockBridge.assetManager, [smallAsset, largeAsset], null);

      // Both should start before either ends (parallel execution)
      expect(callOrder.indexOf('large-start')).toBeLessThan(callOrder.indexOf('large-end'));
      expect(callOrder.indexOf('session-start')).toBeLessThan(callOrder.indexOf('session-end'));
      // Both start calls should happen before any end calls
      expect(callOrder.indexOf('large-start')).toBeLessThan(2);
      expect(callOrder.indexOf('session-start')).toBeLessThan(2);
    });

    it('runs upload streams sequentially in Electron mode', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000;
      manager.setWebSocketHandler(mockWsHandler);
      window.electronAPI = {};

      const smallAsset = { id: 'small', blob: new Blob(['small']), filename: 'small.txt' };
      const largeAsset = { id: 'large', blob: new Blob(['x'.repeat(2000)]), filename: 'large.bin' };
      const callOrder = [];

      vi.spyOn(manager, 'uploadLargeAssetsChunked').mockImplementation(async () => {
        callOrder.push('large-start');
        await new Promise(r => setTimeout(r, 10));
        callOrder.push('large-end');
        return { uploaded: 1, failed: 0 };
      });

      vi.spyOn(manager, 'uploadSmallAssetsIndividually').mockImplementation(async () => {
        callOrder.push('single-start');
        await new Promise(r => setTimeout(r, 10));
        callOrder.push('single-end');
        return { uploaded: 1, failed: 0 };
      });

      try {
        await manager.uploadAssets('project-123', mockBridge.assetManager, [smallAsset, largeAsset], null);
      } finally {
        delete window.electronAPI;
      }

      expect(callOrder).toEqual(['large-start', 'large-end', 'single-start', 'single-end']);
    });

    it('uses single-file upload for small assets in Electron mode by default', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000;
      manager.setWebSocketHandler(mockWsHandler);
      window.electronAPI = {};

      const singleSpy = vi.spyOn(manager, 'uploadSmallAssetsIndividually').mockResolvedValue({ uploaded: 1, failed: 0 });
      const sessionSpy = vi.spyOn(manager, 'uploadWithSession').mockResolvedValue({ uploaded: 1, failed: 0 });

      await manager.uploadAssets(
        'project-123',
        mockBridge.assetManager,
        [{ id: 'small', blob: new Blob(['small']), filename: 'small.txt' }],
        null
      );

      expect(singleSpy).toHaveBeenCalled();
      expect(sessionSpy).not.toHaveBeenCalled();
    });

    it('allows restoring baseline Electron batching via experiment flag', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000;
      manager.setWebSocketHandler(mockWsHandler);
      window.electronAPI = {};
      window.eXeLearning.config.saveMemoryExperiment = 'baseline';

      const singleSpy = vi.spyOn(manager, 'uploadSmallAssetsIndividually').mockResolvedValue({ uploaded: 1, failed: 0 });
      const sessionSpy = vi.spyOn(manager, 'uploadWithSession').mockResolvedValue({ uploaded: 1, failed: 0 });

      await manager.uploadAssets(
        'project-123',
        mockBridge.assetManager,
        [{ id: 'small', blob: new Blob(['small']), filename: 'small.txt' }],
        null
      );

      expect(singleSpy).not.toHaveBeenCalled();
      expect(sessionSpy).toHaveBeenCalled();
    });

    it('falls back to batch upload when session fails', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000;
      manager.setWebSocketHandler(mockWsHandler);

      const smallAsset = { id: 'small', blob: new Blob(['small']), filename: 'small.txt' };
      const largeAsset = { id: 'large', blob: new Blob(['x'.repeat(2000)]), filename: 'large.bin' };

      vi.spyOn(manager, 'uploadLargeAssetsChunked').mockResolvedValue({ uploaded: 1, failed: 0 });
      vi.spyOn(manager, 'uploadWithSession').mockRejectedValue(new Error('WebSocket disconnected'));
      const batchSpy = vi.spyOn(manager, 'uploadSmallAssetsBatched').mockResolvedValue({ uploaded: 1, failed: 0 });

      const result = await manager.uploadAssets('project-123', mockBridge.assetManager, [smallAsset, largeAsset], null);

      // Should fallback to batch upload
      expect(batchSpy).toHaveBeenCalled();
      expect(result.uploaded).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('uses batch upload when session is unavailable', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000;
      // No WebSocket handler set

      const smallAsset = { id: 'small', blob: new Blob(['small']), filename: 'small.txt' };
      const largeAsset = { id: 'large', blob: new Blob(['x'.repeat(2000)]), filename: 'large.bin' };

      vi.spyOn(manager, 'uploadLargeAssetsChunked').mockResolvedValue({ uploaded: 1, failed: 0 });
      const batchSpy = vi.spyOn(manager, 'uploadSmallAssetsBatched').mockResolvedValue({ uploaded: 1, failed: 0 });

      await manager.uploadAssets('project-123', mockBridge.assetManager, [smallAsset, largeAsset], null);

      expect(batchSpy).toHaveBeenCalled();
    });

    it('combines results from parallel uploads', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000;
      manager.setWebSocketHandler(mockWsHandler);

      const smallAssets = [
        { id: 'small1', blob: new Blob(['small1']), filename: 'small1.txt' },
        { id: 'small2', blob: new Blob(['small2']), filename: 'small2.txt' },
      ];
      const largeAssets = [
        { id: 'large1', blob: new Blob(['x'.repeat(2000)]), filename: 'large1.bin' },
        { id: 'large2', blob: new Blob(['x'.repeat(2000)]), filename: 'large2.bin' },
      ];

      vi.spyOn(manager, 'uploadLargeAssetsChunked').mockResolvedValue({ uploaded: 2, failed: 0 });
      vi.spyOn(manager, 'uploadWithSession').mockResolvedValue({ uploaded: 2, failed: 0 });

      const result = await manager.uploadAssets(
        'project-123',
        mockBridge.assetManager,
        [...smallAssets, ...largeAssets],
        null
      );

      // Results should be combined
      expect(result.uploaded).toBe(4);
      expect(result.failed).toBe(0);
    });

    it('handles partial failures in parallel uploads', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000;
      manager.setWebSocketHandler(mockWsHandler);

      const smallAssets = [
        { id: 'small1', blob: new Blob(['small1']), filename: 'small1.txt' },
        { id: 'small2', blob: new Blob(['small2']), filename: 'small2.txt' },
      ];
      const largeAssets = [
        { id: 'large1', blob: new Blob(['x'.repeat(2000)]), filename: 'large1.bin' },
      ];

      // Large upload succeeds, session upload has failures
      vi.spyOn(manager, 'uploadLargeAssetsChunked').mockResolvedValue({ uploaded: 1, failed: 0 });
      vi.spyOn(manager, 'uploadWithSession').mockResolvedValue({ uploaded: 1, failed: 1 });

      const result = await manager.uploadAssets(
        'project-123',
        mockBridge.assetManager,
        [...smallAssets, ...largeAssets],
        null
      );

      expect(result.uploaded).toBe(2); // 1 large + 1 small
      expect(result.failed).toBe(1); // 1 small failed
    });

    it('handles only large files correctly', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000;
      manager.setWebSocketHandler(mockWsHandler);

      const largeAssets = [
        { id: 'large1', blob: new Blob(['x'.repeat(2000)]), filename: 'large1.bin' },
      ];

      const largeSpy = vi.spyOn(manager, 'uploadLargeAssetsChunked').mockResolvedValue({ uploaded: 1, failed: 0 });
      const sessionSpy = vi.spyOn(manager, 'uploadWithSession');

      const result = await manager.uploadAssets('project-123', mockBridge.assetManager, largeAssets, null);

      expect(largeSpy).toHaveBeenCalled();
      expect(sessionSpy).not.toHaveBeenCalled();
      expect(result.uploaded).toBe(1);
    });

    it('handles only small files correctly with session', async () => {
      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      manager.CHUNK_UPLOAD_THRESHOLD = 1000;
      manager.setWebSocketHandler(mockWsHandler);

      const smallAssets = [
        { id: 'small1', blob: new Blob(['small1']), filename: 'small1.txt' },
      ];

      const largeSpy = vi.spyOn(manager, 'uploadLargeAssetsChunked');
      const sessionSpy = vi.spyOn(manager, 'uploadWithSession').mockResolvedValue({ uploaded: 1, failed: 0 });

      const result = await manager.uploadAssets('project-123', mockBridge.assetManager, smallAssets, null);

      expect(largeSpy).not.toHaveBeenCalled();
      expect(sessionSpy).toHaveBeenCalled();
      expect(result.uploaded).toBe(1);
    });
  });

  describe('uploadChunk - edge cases', () => {
    it('uses default filename when not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const manager = new SaveManager(mockBridge);
      const asset = { id: 'asset-1' }; // No filename
      const chunkBlob = new Blob(['test']);

      await manager.uploadChunk('project-123', asset, 'id', 1, 1, chunkBlob);

      // Should not throw
      expect(mockFetch).toHaveBeenCalled();
    });

    it('uses default mime when not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const manager = new SaveManager(mockBridge);
      const asset = { id: 'asset-1', filename: 'test.bin' }; // No mime
      const chunkBlob = new Blob(['test']);

      await manager.uploadChunk('project-123', asset, 'id', 1, 1, chunkBlob);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('uploadAssetBatch - edge cases', () => {
    it('uses default values for missing asset properties', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const manager = new SaveManager(mockBridge);
      const assets = [
        { id: 'a', blob: new Blob(['test']) }, // No filename, mime, or hash
      ];

      await manager.uploadAssetBatch('project-123', assets, mockBridge.assetManager);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('createSizeLimitedBatches with size metadata', () => {
    it('uses asset.size when blob is not present', () => {
      const manager = new SaveManager(mockBridge);

      const assets = [
        { id: 'a1', size: 5 * 1024 * 1024, filename: 'a1.bin' },
        { id: 'a2', size: 5 * 1024 * 1024, filename: 'a2.bin' },
        { id: 'a3', size: 5 * 1024 * 1024, filename: 'a3.bin' },
      ];

      // With 15MB total across 3 files, at default 20MB batch size limit,
      // all should fit in one batch
      const batches = manager.createSizeLimitedBatches(assets);

      expect(batches.length).toBeGreaterThanOrEqual(1);
      const totalFiles = batches.reduce((sum, b) => sum + b.length, 0);
      expect(totalFiles).toBe(3);
    });
  });

  describe('estimatePendingUploadBytes prefers size over blob.size', () => {
    it('uses asset.size when available', () => {
      const manager = new SaveManager(mockBridge);

      const assets = [
        { id: 'a1', size: 1000 },
        { id: 'a2', size: 2000 },
      ];

      expect(manager.estimatePendingUploadBytes(assets)).toBe(3000);
    });

    it('falls back to blob.size when size is not set', () => {
      const manager = new SaveManager(mockBridge);

      const assets = [
        { id: 'a1', blob: { size: 500 } },
        { id: 'a2', blob: { size: 700 } },
      ];

      expect(manager.estimatePendingUploadBytes(assets)).toBe(1200);
    });
  });

  describe('save memory instrumentation', () => {
    it('collects and summarizes save memory samples when enabled', async () => {
      window.eXeLearning.config.debugSaveMemory = true;
      window.electronAPI = {
        getMemoryUsage: vi.fn().mockResolvedValue({
          process: {
            rss: 1000,
            heapTotal: 2000,
            heapUsed: 1500,
            external: 300,
            arrayBuffers: 120,
          },
          renderer: {
            workingSetSize: 4000,
            peakWorkingSetSize: 4500,
            privateBytes: 3500,
            sharedBytes: 200,
          },
        }),
      };

      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      vi.spyOn(manager, 'updateProjectMetadata').mockResolvedValue();

      const result = await manager.save({ showProgress: false });

      expect(result.success).toBe(true);
      expect(window.__lastSaveMemoryTimeline).toEqual(expect.any(Array));
      expect(window.__lastSaveMemoryTimeline.length).toBeGreaterThan(0);
      expect(window.__lastSaveMemorySummary).toEqual(expect.objectContaining({
        outcome: 'success',
      }));
      expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('[SaveManager][Memory]'));
      expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('[SaveManager][MemorySummary]'));
    });

    it('supports assets-only experiment by skipping Yjs upload', async () => {
      window.eXeLearning.config.saveMemoryExperiment = 'assets-only';

      const manager = new SaveManager(mockBridge, { token: 'test-token' });
      const saveYjsSpy = vi.spyOn(manager, 'saveYjsState').mockResolvedValue({ success: true });
      vi.spyOn(manager, 'updateProjectMetadata').mockResolvedValue();

      await manager.save({ showProgress: false });

      expect(saveYjsSpy).not.toHaveBeenCalled();
    });
  });
});
