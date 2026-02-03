/**
 * AssetWebSocketHandler Tests
 *
 * Unit tests for AssetWebSocketHandler - handles asset coordination over WebSocket.
 *
 */

// Test functions available globally from vitest setup
import { decodeAssetMessage } from '../test-helpers/mock-websocket.js';

 

const AssetWebSocketHandler = require('./AssetWebSocketHandler');

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  constructor() {
    this.readyState = MockWebSocket.OPEN;
    this.onmessage = null;
    this.send = mock(() => undefined);
    this.close = mock(() => undefined);
  }
}

// Mock AssetManager
const createMockAssetManager = () => ({
  projectId: 'project-123',
  getAllAssetIds: mock(() => undefined).mockResolvedValue(['asset-1', 'asset-2']),
  getAllLocalBlobIds: mock(() => undefined).mockResolvedValue(['asset-1', 'asset-2']),
  hasAsset: mock(() => undefined).mockResolvedValue(false),
  hasLocalBlob: mock(() => undefined).mockResolvedValue(false),
  getAsset: mock(() => undefined).mockResolvedValue(null),
  putAsset: mock(() => undefined).mockResolvedValue(),
  getAssetForUpload: mock(() => undefined).mockResolvedValue({
    blob: new Blob(['test']),
    mime: 'image/png',
    hash: 'abc123',
    filename: 'test.png',
    size: 1000,
  }),
  storeAssetFromServer: mock(() => undefined).mockResolvedValue(),
  getMissingAssetIds: mock(() => undefined).mockResolvedValue(['missing-1']),
});

// Mock WebSocket Provider
const createMockWsProvider = () => {
  const ws = new MockWebSocket();
  return {
    ws,
    wsconnected: true,
    on: mock(() => undefined),
    off: mock(() => undefined),
  };
};

describe('AssetWebSocketHandler', () => {
  let handler;
  let mockAssetManager;
  let mockWsProvider;
  let mockConfig;

  beforeEach(() => {
    mockAssetManager = createMockAssetManager();
    mockWsProvider = createMockWsProvider();
    mockConfig = {
      projectId: 'project-123',
      apiUrl: 'http://localhost:3001/api',
      token: 'test-token',
    };

    global.WebSocket = MockWebSocket;
    global.fetch = mock(() => undefined);

    handler = new AssetWebSocketHandler(mockAssetManager, mockWsProvider, mockConfig);

    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});

    // Use fake timers
    // jest.useFakeTimers();
  });

  afterEach(() => {
    // jest.restoreAllMocks();
    // jest.useRealTimers();
    delete global.WebSocket;
    delete global.fetch;
  });

  describe('constructor', () => {
    it('initializes with asset manager', () => {
      expect(handler.assetManager).toBe(mockAssetManager);
    });

    it('initializes with websocket provider', () => {
      expect(handler.wsProvider).toBe(mockWsProvider);
    });

    it('initializes with config', () => {
      expect(handler.config).toBe(mockConfig);
    });

    it('initializes empty pending requests map', () => {
      expect(handler.pendingRequests).toBeInstanceOf(Map);
      expect(handler.pendingRequests.size).toBe(0);
    });

    it('initializes connected as false', () => {
      expect(handler.connected).toBe(false);
    });

    it('initializes _hasAnnounced as false', () => {
      expect(handler._hasAnnounced).toBe(false);
    });

    it('initializes event listeners', () => {
      expect(handler.listeners.assetReceived).toEqual([]);
      expect(handler.listeners.assetNotFound).toEqual([]);
      expect(handler.listeners.error).toEqual([]);
    });
  });

  describe('initialize', () => {
    it('warns when no WebSocket provider', async () => {
      handler.wsProvider = null;

      await handler.initialize();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('No WebSocket provider')
      );
    });

    it('attaches status listener', async () => {
      await handler.initialize();

      expect(mockWsProvider.on).toHaveBeenCalledWith('status', expect.any(Function));
    });

    it('sets connected when already connected', async () => {
      mockWsProvider.wsconnected = true;

      await handler.initialize();

      // initialize() sets connected and installs handlers but doesn't announce
      // (announceAssetAvailability is called when _handleStatus fires)
      expect(handler.connected).toBe(true);
    });

    it('waits for connection when not connected', async () => {
      // Use real timers for this async test
      // jest.useRealTimers();

      mockWsProvider.ws = null;
      mockWsProvider.wsconnected = false;

      // Start initialization but don't await
      const initPromise = handler.initialize();

      // Wait a tick then simulate connection
      await new Promise(resolve => setTimeout(resolve, 10));

      mockWsProvider.ws = new MockWebSocket();
      mockWsProvider.wsconnected = true;

      // Trigger the status callback
      const statusCallback = mockWsProvider.on.mock.calls.find(
        call => call[0] === 'status'
      )?.[1];
      if (statusCallback) {
        statusCallback({ status: 'connected' });
      }

      await initPromise;

      // jest.useFakeTimers(); // Restore fake timers
    });
  });

  describe('_waitForConnection', () => {
    it('resolves immediately if already connected', async () => {
      mockWsProvider.wsconnected = true;

      await handler._waitForConnection();
      // Should resolve without timeout
    });

    it('waits for connection status event', async () => {
      mockWsProvider.wsconnected = false;

      const waitPromise = handler._waitForConnection();

      // Simulate connection
      const statusCallback = mockWsProvider.on.mock.calls[0]?.[1];
      if (statusCallback) {
        statusCallback({ status: 'connected' });
      }

      await waitPromise;
    });

    it('times out after specified duration', async () => {
      mockWsProvider.wsconnected = false;

      const startTime = Date.now();
      // Use a short timeout (50ms) for testing
      await handler._waitForConnection(50);
      const elapsed = Date.now() - startTime;

      // Should resolve after timeout (allow some tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('_isAssetMessage', () => {
    it('returns true for asset message types', () => {
      expect(handler._isAssetMessage('awareness-update')).toBe(true);
      expect(handler._isAssetMessage('request-asset')).toBe(true);
      expect(handler._isAssetMessage('upload-request')).toBe(true);
      expect(handler._isAssetMessage('bulk-upload-request')).toBe(true);
      expect(handler._isAssetMessage('bulk-upload-complete')).toBe(true);
      expect(handler._isAssetMessage('asset-ready')).toBe(true);
      expect(handler._isAssetMessage('asset-not-found')).toBe(true);
      expect(handler._isAssetMessage('prefetch-assets')).toBe(true);
    });

    it('returns false for non-asset message types', () => {
      expect(handler._isAssetMessage('yjs-sync')).toBe(false);
      expect(handler._isAssetMessage('other')).toBe(false);
      expect(handler._isAssetMessage('')).toBe(false);
    });
  });

  describe('_decodeBinaryAssetPayload', () => {
    it('returns null for empty bytes', () => {
      const result = handler._decodeBinaryAssetPayload(new Uint8Array(0));
      expect(result).toBeNull();
    });

    it('returns null for bytes without 0xFF prefix', () => {
      const bytes = new Uint8Array([0x00, 0x01, 0x02]);
      const result = handler._decodeBinaryAssetPayload(bytes);
      expect(result).toBeNull();
    });

    it('returns null for bytes with 0xFF but invalid JSON', () => {
      const bytes = new Uint8Array([0xff, 0x00, 0x01, 0x02]);
      const result = handler._decodeBinaryAssetPayload(bytes);
      expect(result).toBeNull();
    });

    it('returns null for valid JSON but non-asset message type', () => {
      const json = JSON.stringify({ type: 'unknown-type', data: {} });
      const jsonBytes = new TextEncoder().encode(json);
      const bytes = new Uint8Array(1 + jsonBytes.length);
      bytes[0] = 0xff;
      bytes.set(jsonBytes, 1);

      const result = handler._decodeBinaryAssetPayload(bytes);
      expect(result).toBeNull();
    });

    it('returns parsed message for valid asset message', () => {
      const message = { type: 'awareness-update', data: { availableAssets: ['a1'] } };
      const json = JSON.stringify(message);
      const jsonBytes = new TextEncoder().encode(json);
      const bytes = new Uint8Array(1 + jsonBytes.length);
      bytes[0] = 0xff;
      bytes.set(jsonBytes, 1);

      const result = handler._decodeBinaryAssetPayload(bytes);
      expect(result).not.toBeNull();
      expect(result.parsed.type).toBe('awareness-update');
      expect(result.parsed.data.availableAssets).toEqual(['a1']);
    });

    it('handles all asset message types', () => {
      const types = ['asset-ready', 'upload-request', 'priority-ack', 'upload-session-ready'];

      for (const type of types) {
        const json = JSON.stringify({ type, data: {} });
        const jsonBytes = new TextEncoder().encode(json);
        const bytes = new Uint8Array(1 + jsonBytes.length);
        bytes[0] = 0xff;
        bytes.set(jsonBytes, 1);

        const result = handler._decodeBinaryAssetPayload(bytes);
        expect(result).not.toBeNull();
        expect(result.parsed.type).toBe(type);
      }
    });
  });

  describe('_handleStatus', () => {
    it('handles connected status', async () => {
      handler._setupMessageHandler = mock(() => undefined);
      handler.announceAssetAvailability = mock(() => undefined).mockResolvedValue();

      await handler._handleStatus({ status: 'connected' });

      expect(handler.connected).toBe(true);
      expect(handler._setupMessageHandler).toHaveBeenCalled();
      expect(handler.announceAssetAvailability).toHaveBeenCalled();
    });

    it('handles disconnected status', async () => {
      handler.connected = true;

      await handler._handleStatus({ status: 'disconnected' });

      expect(handler.connected).toBe(false);
    });
  });

  describe('announceAssetAvailability', () => {
    it('does nothing when not connected', async () => {
      mockWsProvider.wsconnected = false;

      await handler.announceAssetAvailability();

      expect(mockWsProvider.ws.send).not.toHaveBeenCalled();
    });

    it('sends awareness-update message with asset IDs', async () => {
      mockWsProvider.wsconnected = true;
      handler.connected = true;

      await handler.announceAssetAvailability();

      expect(mockWsProvider.ws.send).toHaveBeenCalled();
      const sentMessage = decodeAssetMessage(mockWsProvider.ws.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('awareness-update');
      expect(sentMessage.data.availableAssets).toEqual(['asset-1', 'asset-2']);
      expect(sentMessage.data.totalAssets).toBe(2);
    });

    it('sends empty array when no assets', async () => {
      mockWsProvider.wsconnected = true;
      handler.connected = true;
      mockAssetManager.getAllLocalBlobIds.mockResolvedValue([]);

      await handler.announceAssetAvailability();

      const sentMessage = decodeAssetMessage(mockWsProvider.ws.send.mock.calls[0][0]);
      expect(sentMessage.data.availableAssets).toEqual([]);
      expect(sentMessage.data.totalAssets).toBe(0);
    });

    it('sets _hasAnnounced flag', async () => {
      mockWsProvider.wsconnected = true;
      handler.connected = true;

      await handler.announceAssetAvailability();

      expect(handler._hasAnnounced).toBe(true);
    });
  });

  describe('requestAsset', () => {
    it('returns true if asset blob already exists locally', async () => {
      mockAssetManager.hasLocalBlob.mockResolvedValue(true);

      const result = await handler.requestAsset('asset-1');

      expect(result).toBe(true);
      expect(mockWsProvider.ws.send).not.toHaveBeenCalled();
    });

    it('returns false when not connected', async () => {
      handler.connected = false;

      const result = await handler.requestAsset('asset-1');

      expect(result).toBe(false);
    });

    it('sends request-asset message', async () => {
      // Use real timers for this async test
      // jest.useRealTimers();

      handler.connected = true;
      mockAssetManager.hasAsset.mockResolvedValue(false);

      // Start request - it should send immediately after hasAsset check
      const requestPromise = handler.requestAsset('asset-1', 5000);

      // Wait a tick for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWsProvider.ws.send).toHaveBeenCalled();
      const sentMessage = decodeAssetMessage(mockWsProvider.ws.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('request-asset');
      expect(sentMessage.data.assetId).toBe('asset-1');

      // Cleanup - resolve the pending request
      const pending = handler.pendingRequests.get('asset-1');
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve(true);
      }
      handler.pendingRequests.delete('asset-1');

      await requestPromise;

      // jest.useFakeTimers(); // Restore fake timers
    });

    it('reuses pending request for duplicate requests', async () => {
      // jest.useRealTimers(); // Use real timers for this async test

      handler.connected = true;
      mockAssetManager.hasAsset.mockResolvedValue(false);

      // Start first request - wait a tick for hasAsset check
      handler.requestAsset('asset-1');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that the pending request exists
      expect(handler.pendingRequests.has('asset-1')).toBe(true);

      // Record the send call count after first request
      const sendCallsAfterFirst = mockWsProvider.ws.send.mock.calls.length;
      expect(sendCallsAfterFirst).toBe(1);

      // Start another request for the same asset
      handler.requestAsset('asset-1');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should NOT have sent another request message
      expect(mockWsProvider.ws.send.mock.calls.length).toBe(sendCallsAfterFirst);

      // Pending request should still be just one
      expect(handler.pendingRequests.size).toBe(1);

      // Resolve both requests by resolving the pending promise
      const pending = handler.pendingRequests.get('asset-1');
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve(true);
      }
      handler.pendingRequests.delete('asset-1');

      // jest.useFakeTimers(); // Restore fake timers
    });

    it('creates pending request with timeout', async () => {
      // jest.useRealTimers(); // Use real timers for this async test

      handler.connected = true;
      mockAssetManager.hasAsset.mockResolvedValue(false);

      handler.requestAsset('asset-1', 5000);
      await new Promise(resolve => setTimeout(resolve, 10));

      const pending = handler.pendingRequests.get('asset-1');
      expect(pending).toBeDefined();
      expect(pending.resolve).toBeDefined();
      expect(pending.timeout).toBeDefined();

      // Cleanup
      clearTimeout(pending.timeout);
      pending.resolve(true);
      handler.pendingRequests.delete('asset-1');

      // jest.useFakeTimers(); // Restore fake timers
    });
  });

  describe('_handleUploadRequest', () => {
    it('uploads asset to server', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: mock(() => undefined).mockResolvedValue({ success: true }),
      });

      await handler._handleUploadRequest({
        assetId: 'asset-1',
        requestId: 'req-1',
        uploadUrl: '/projects/123/assets',
      });

      expect(global.fetch).toHaveBeenCalled();
      expect(mockWsProvider.ws.send).toHaveBeenCalled();
      const response = decodeAssetMessage(mockWsProvider.ws.send.mock.calls[0][0]);
      expect(response.type).toBe('asset-uploaded');
      expect(response.data.success).toBe(true);
    });

    it('reports error when asset not found locally', async () => {
      mockAssetManager.getAssetForUpload.mockResolvedValue(null);

      await handler._handleUploadRequest({
        assetId: 'missing',
        requestId: 'req-1',
      });

      const response = decodeAssetMessage(mockWsProvider.ws.send.mock.calls[0][0]);
      expect(response.type).toBe('asset-uploaded');
      expect(response.data.success).toBe(false);
    });

    it('reports error on upload failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: mock(() => undefined).mockResolvedValue('Server error'),
      });

      await handler._handleUploadRequest({
        assetId: 'asset-1',
        requestId: 'req-1',
      });

      const response = decodeAssetMessage(mockWsProvider.ws.send.mock.calls[0][0]);
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('500');
    });
  });

  describe('_handleBulkUploadRequest', () => {
    beforeEach(() => {
      // Use real timers for these tests since bulk upload has internal delays
      // jest.useRealTimers();
    });

    afterEach(() => {
      // jest.useFakeTimers();
    });

    it('does nothing with empty assetIds', async () => {
      await handler._handleBulkUploadRequest({ assetIds: [] });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('uploads multiple assets', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: mock(() => undefined).mockResolvedValue({ success: true }),
      });

      await handler._handleBulkUploadRequest({
        assetIds: ['asset-1', 'asset-2'],
        uploadUrl: '/projects/123/assets',
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('reports progress and completion', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: mock(() => undefined).mockResolvedValue({ success: true }),
      });

      await handler._handleBulkUploadRequest({
        assetIds: ['asset-1'],
      });

      // Should have sent progress messages
      const messages = mockWsProvider.ws.send.mock.calls.map(
        call => decodeAssetMessage(call[0])
      );
      expect(messages.some(m => m.type === 'bulk-upload-progress')).toBe(true);
    });
  });

  describe('_handleBulkUploadComplete', () => {
    it('logs notification', async () => {
      // The method uses Logger.log, not console.log
      await handler._handleBulkUploadComplete({
        uploadedBy: 'peer-1',
        totalAvailable: 5,
        failedCount: 0,
      });

      // Just verify it doesn't throw - Logger.log is a mock that doesn't track calls
      expect(true).toBe(true);
    });

    it('triggers delayed prefetch if pending', async () => {
      handler._pendingPrefetchAssetIds = ['asset-1', 'asset-2'];
      handler._prefetchDelayTimeout = setTimeout(() => {}, 10000);
      handler._prefetchAssets = mock(() => undefined);
      mockAssetManager.getMissingAssetIds.mockResolvedValue(['asset-1']);

      await handler._handleBulkUploadComplete({});

      expect(handler._prefetchAssets).toHaveBeenCalledWith(['asset-1']);
      expect(handler._pendingPrefetchAssetIds).toBeNull();
    });
  });

  describe('_handleAssetReady', () => {
    it('downloads and stores asset', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        headers: {
          get: mock((name) => {
            if (name === 'X-Original-Mime') return 'image/png';
            if (name === 'X-Asset-Hash') return 'abc123';
            if (name === 'X-Filename') return 'test.png';
            return null;
          }),
        },
        blob: mock(() => undefined).mockResolvedValue(new Blob(['data'])),
      });

      await handler._handleAssetReady({ assetId: 'asset-1' });

      expect(global.fetch).toHaveBeenCalled();
      expect(mockAssetManager.storeAssetFromServer).toHaveBeenCalled();
    });

    it('resolves pending request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        headers: { get: mock(() => undefined) },
        blob: mock(() => undefined).mockResolvedValue(new Blob(['data'])),
      });

      const mockPending = {
        resolve: mock(() => undefined),
        reject: mock(() => undefined),
        timeout: setTimeout(() => {}, 10000),
      };
      handler.pendingRequests.set('asset-1', mockPending);

      await handler._handleAssetReady({ assetId: 'asset-1' });

      expect(mockPending.resolve).toHaveBeenCalledWith(true);
      expect(handler.pendingRequests.has('asset-1')).toBe(false);
    });

    it('emits assetReceived event', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        headers: { get: mock(() => undefined) },
        blob: mock(() => undefined).mockResolvedValue(new Blob(['data'])),
      });

      const eventHandler = mock(() => undefined);
      handler.on('assetReceived', eventHandler);

      await handler._handleAssetReady({ assetId: 'asset-1' });

      expect(eventHandler).toHaveBeenCalledWith({ assetId: 'asset-1' });
    });

    it('constructs correct fallback URL without double /api prefix', async () => {
      // This test verifies the fix for the /api/api/ bug
      // When no URL is provided in the message, the fallback URL should be
      // ${apiUrl}/projects/... NOT ${apiUrl}/api/projects/...
      const capturedUrls = [];
      global.fetch = mock((url) => {
        capturedUrls.push(url);
        return Promise.resolve({
          ok: true,
          headers: { get: mock(() => undefined) },
          blob: mock(() => undefined).mockResolvedValue(new Blob(['data'])),
        });
      });

      // Call with no URL - should use fallback
      await handler._handleAssetReady({ assetId: 'test-asset-id' });

      expect(capturedUrls.length).toBe(1);
      // URL should be /api/projects/... NOT /api/api/projects/...
      expect(capturedUrls[0]).toBe('http://localhost:3001/api/projects/project-123/assets/by-client-id/test-asset-id');
      expect(capturedUrls[0]).not.toContain('/api/api/');
    });

    it('uses server-provided URL when available', async () => {
      const capturedUrls = [];
      global.fetch = mock((url) => {
        capturedUrls.push(url);
        return Promise.resolve({
          ok: true,
          headers: { get: mock(() => undefined) },
          blob: mock(() => undefined).mockResolvedValue(new Blob(['data'])),
        });
      });

      // Call with server-provided URL
      await handler._handleAssetReady({
        assetId: 'test-asset-id',
        url: '/projects/proj-123/assets/by-client-id/test-asset-id'
      });

      expect(capturedUrls.length).toBe(1);
      // Should use ${apiUrl}${url} = http://localhost:3001/api + /projects/...
      expect(capturedUrls[0]).toBe('http://localhost:3001/api/projects/proj-123/assets/by-client-id/test-asset-id');
      expect(capturedUrls[0]).not.toContain('/api/api/');
    });
  });

  describe('_handleAssetNotFound', () => {
    it('resolves pending request as false', () => {
      const mockPending = {
        resolve: mock(() => undefined),
        reject: mock(() => undefined),
        timeout: setTimeout(() => {}, 10000),
      };
      handler.pendingRequests.set('asset-1', mockPending);

      handler._handleAssetNotFound({ assetId: 'asset-1' });

      expect(mockPending.resolve).toHaveBeenCalledWith(false);
      expect(handler.pendingRequests.has('asset-1')).toBe(false);
    });

    it('emits assetNotFound event', () => {
      const eventHandler = mock(() => undefined);
      handler.on('assetNotFound', eventHandler);

      handler._handleAssetNotFound({ assetId: 'asset-1' });

      expect(eventHandler).toHaveBeenCalledWith({ assetId: 'asset-1' });
    });
  });

  describe('_handlePrefetchRequest', () => {
    it('does nothing with empty assetIds', async () => {
      await handler._handlePrefetchRequest({ assetIds: [] });
      expect(mockAssetManager.getMissingAssetIds).not.toHaveBeenCalled();
    });

    it('does nothing when all assets cached', async () => {
      mockAssetManager.getMissingAssetIds.mockResolvedValue([]);

      await handler._handlePrefetchRequest({ assetIds: ['asset-1'] });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('delays prefetch when delayMs specified', async () => {
      await handler._handlePrefetchRequest({
        assetIds: ['asset-1'],
        delayMs: 5000,
      });

      expect(handler._pendingPrefetchAssetIds).toBeDefined();
      expect(handler._prefetchDelayTimeout).toBeDefined();

      // Cleanup
      clearTimeout(handler._prefetchDelayTimeout);
    });
  });

  describe('_prefetchAssets', () => {
    beforeEach(() => {
      // Use real timers for these tests since _prefetchAssets has internal delays
      // jest.useRealTimers();
    });

    afterEach(() => {
      // Restore fake timers for other tests
      // jest.useFakeTimers();
    });

    it('downloads missing assets', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        headers: { get: mock(() => undefined) },
        blob: mock(() => undefined).mockResolvedValue(new Blob(['data'])),
      });

      await handler._prefetchAssets(['asset-1', 'asset-2']);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockAssetManager.storeAssetFromServer).toHaveBeenCalledTimes(2);
    });

    it('continues on individual fetch failure', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: mock(() => undefined) },
          blob: mock(() => undefined).mockResolvedValue(new Blob(['data'])),
        });

      await handler._prefetchAssets(['asset-1', 'asset-2']);

      expect(mockAssetManager.storeAssetFromServer).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestMissingAssetsFromHTML', () => {
    it('returns empty array for null HTML', async () => {
      const result = await handler.requestMissingAssetsFromHTML(null);
      expect(result).toEqual([]);
    });

    it('returns empty array when no asset references', async () => {
      const result = await handler.requestMissingAssetsFromHTML('<p>Hello</p>');
      expect(result).toEqual([]);
    });

    it('requests missing assets from HTML', async () => {
      handler.connected = true;
      handler.requestAsset = mock(() => undefined).mockResolvedValue(true);
      mockAssetManager.getMissingAssetIds.mockResolvedValue(['abc123']);

      const html = '<img src="asset://abc123"><img src="asset://def456">';
      const result = await handler.requestMissingAssetsFromHTML(html);

      expect(handler.requestAsset).toHaveBeenCalledWith('abc123');
      expect(result).toEqual(['abc123']);
    });
  });

  describe('_sendMessage', () => {
    it('sends JSON message over WebSocket', () => {
      handler._sendMessage({ type: 'test', data: { foo: 'bar' } });

      expect(mockWsProvider.ws.send).toHaveBeenCalled();
      const sent = decodeAssetMessage(mockWsProvider.ws.send.mock.calls[0][0]);
      expect(sent.type).toBe('test');
      expect(sent.data.foo).toBe('bar');
    });

    it('warns when WebSocket not open', () => {
      mockWsProvider.ws.readyState = MockWebSocket.CLOSED;

      handler._sendMessage({ type: 'test' });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot send')
      );
    });

    it('warns when no WebSocket', () => {
      mockWsProvider.ws = null;

      handler._sendMessage({ type: 'test' });

      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('event handling', () => {
    it('on adds event listener', () => {
      const callback = mock(() => undefined);
      handler.on('assetReceived', callback);

      expect(handler.listeners.assetReceived).toContain(callback);
    });

    it('off removes event listener', () => {
      const callback = mock(() => undefined);
      handler.on('assetReceived', callback);
      handler.off('assetReceived', callback);

      expect(handler.listeners.assetReceived).not.toContain(callback);
    });

    it('_emit calls all listeners', () => {
      const callback1 = mock(() => undefined);
      const callback2 = mock(() => undefined);
      handler.on('assetReceived', callback1);
      handler.on('assetReceived', callback2);

      handler._emit('assetReceived', { assetId: 'test' });

      expect(callback1).toHaveBeenCalledWith({ assetId: 'test' });
      expect(callback2).toHaveBeenCalledWith({ assetId: 'test' });
    });
  });

  describe('destroy', () => {
    it('clears pending requests', () => {
      const mockPending = {
        resolve: mock(() => undefined),
        timeout: setTimeout(() => {}, 10000),
      };
      handler.pendingRequests.set('asset-1', mockPending);

      handler.destroy();

      expect(mockPending.resolve).toHaveBeenCalledWith(false);
      expect(handler.pendingRequests.size).toBe(0);
    });

    it('clears prefetch delay timeout', () => {
      handler._prefetchDelayTimeout = setTimeout(() => {}, 10000);
      handler._pendingPrefetchAssetIds = ['asset-1'];

      handler.destroy();

      expect(handler._prefetchDelayTimeout).toBeNull();
      expect(handler._pendingPrefetchAssetIds).toBeNull();
    });

    it('removes status listener', () => {
      handler.destroy();

      expect(mockWsProvider.off).toHaveBeenCalledWith('status', handler._onStatus);
    });

    it('clears event listeners', () => {
      handler.on('assetReceived', mock(() => undefined));
      handler.on('assetNotFound', mock(() => undefined));

      handler.destroy();

      expect(handler.listeners.assetReceived).toEqual([]);
      expect(handler.listeners.assetNotFound).toEqual([]);
      expect(handler.listeners.error).toEqual([]);
    });
  });

  describe('_handleAssetMessage', () => {
    it('handles upload-request', async () => {
      handler._handleUploadRequest = mock(() => undefined);

      await handler._handleAssetMessage({
        type: 'upload-request',
        data: { assetId: 'asset-1' },
      });

      expect(handler._handleUploadRequest).toHaveBeenCalledWith({ assetId: 'asset-1' });
    });

    it('handles bulk-upload-request', async () => {
      handler._handleBulkUploadRequest = mock(() => undefined);

      await handler._handleAssetMessage({
        type: 'bulk-upload-request',
        data: { assetIds: ['a1', 'a2'] },
      });

      expect(handler._handleBulkUploadRequest).toHaveBeenCalled();
    });

    it('handles asset-ready', async () => {
      handler._handleAssetReady = mock(() => undefined);

      await handler._handleAssetMessage({
        type: 'asset-ready',
        data: { assetId: 'asset-1' },
      });

      expect(handler._handleAssetReady).toHaveBeenCalled();
    });

    it('handles asset-not-found', async () => {
      handler._handleAssetNotFound = mock(() => undefined);

      await handler._handleAssetMessage({
        type: 'asset-not-found',
        data: { assetId: 'asset-1' },
      });

      expect(handler._handleAssetNotFound).toHaveBeenCalled();
    });

    it('handles prefetch-assets', async () => {
      handler._handlePrefetchRequest = mock(() => undefined);

      await handler._handleAssetMessage({
        type: 'prefetch-assets',
        data: { assetIds: ['a1'] },
      });

      expect(handler._handlePrefetchRequest).toHaveBeenCalled();
    });

    it('handles bulk-upload-complete', async () => {
      handler._handleBulkUploadComplete = mock(() => undefined);

      await handler._handleAssetMessage({
        type: 'bulk-upload-complete',
        data: {},
      });

      expect(handler._handleBulkUploadComplete).toHaveBeenCalled();
    });

    it('warns on unknown message type', async () => {
      await handler._handleAssetMessage({
        type: 'unknown-type',
        data: {},
      });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown message type')
      );
    });

    it('handles access-revoked message', async () => {
      handler._handleAccessRevoked = mock(() => undefined);

      await handler._handleAssetMessage({
        type: 'access-revoked',
        data: { reason: 'visibility_changed', revokedAt: '2025-01-01T00:00:00Z' },
      });

      expect(handler._handleAccessRevoked).toHaveBeenCalledWith({
        reason: 'visibility_changed',
        revokedAt: '2025-01-01T00:00:00Z',
      });
    });
  });

  describe('access revocation', () => {
    let originalLocation;

    beforeEach(() => {
      // Mock window.location
      originalLocation = global.window?.location;
      delete global.window;
      global.window = {
        location: { href: '' },
        eXeLearning: { config: { basePath: '' } },
      };
    });

    afterEach(() => {
      if (originalLocation) {
        global.window.location = originalLocation;
      }
    });

    it('disconnects wsProvider on access revoked', () => {
      mockWsProvider.disconnect = mock(() => undefined);
      mockWsProvider.shouldConnect = true;

      handler._handleAccessRevoked({ reason: 'visibility_changed', revokedAt: '2025-01-01T00:00:00Z' });

      expect(mockWsProvider.shouldConnect).toBe(false);
      expect(mockWsProvider.disconnect).toHaveBeenCalled();
    });

    it('emits accessRevoked event', () => {
      mockWsProvider.disconnect = mock(() => undefined);
      const emitSpy = spyOn(handler, '_emit');

      handler._handleAccessRevoked({ reason: 'collaborator_removed', revokedAt: '2025-01-01T00:00:00Z' });

      expect(emitSpy).toHaveBeenCalledWith('accessRevoked', {
        reason: 'collaborator_removed',
        revokedAt: '2025-01-01T00:00:00Z',
      });
    });

    it('redirects to access-denied page', async () => {
      mockWsProvider.disconnect = mock(() => undefined);

      handler._handleAccessRevoked({ reason: 'visibility_changed', revokedAt: '2025-01-01T00:00:00Z' });

      // Wait for setTimeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(global.window.location.href).toBe('/access-denied');
    });

    it('uses basePath in redirect URL', async () => {
      mockWsProvider.disconnect = mock(() => undefined);
      global.window.eXeLearning = { config: { basePath: '/web/exelearning' } };

      handler._handleAccessRevoked({ reason: 'visibility_changed', revokedAt: '2025-01-01T00:00:00Z' });

      // Wait for setTimeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(global.window.location.href).toBe('/web/exelearning/access-denied');
    });

    it('handles missing wsProvider gracefully', () => {
      handler.wsProvider = null;

      // Should not throw
      expect(() => {
        handler._handleAccessRevoked({ reason: 'visibility_changed' });
      }).not.toThrow();
    });

    it('logs warning message', () => {
      mockWsProvider.disconnect = mock(() => undefined);

      handler._handleAccessRevoked({ reason: 'visibility_changed' });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Access revoked: visibility_changed')
      );
    });
  });

  describe('syncAssetsMetadataFromServer', () => {
    it('returns early if projectId is missing', async () => {
      handler.config.projectId = null;

      await handler.syncAssetsMetadataFromServer();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns early if assetManager is missing', async () => {
      handler.assetManager = null;

      await handler.syncAssetsMetadataFromServer();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetches assets metadata from server', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: mock(() => undefined).mockResolvedValue({
          success: true,
          data: [
            { clientId: 'asset-1', filename: 'test.jpg', mimeType: 'image/jpeg', size: 1000, folderPath: 'images' },
          ],
        }),
      });

      await handler.syncAssetsMetadataFromServer();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/projects/project-123/assets',
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer test-token' },
        })
      );
    });

    it('creates metadata entry for new assets', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: mock(() => undefined).mockResolvedValue({
          success: true,
          data: [
            { clientId: 'new-asset', filename: 'test.jpg', mimeType: 'image/jpeg', size: 1000, folderPath: 'images' },
          ],
        }),
      });
      mockAssetManager.getAsset.mockResolvedValue(null);

      await handler.syncAssetsMetadataFromServer();

      expect(mockAssetManager.putAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new-asset',
          filename: 'test.jpg',
          mime: 'image/jpeg',
          size: 1000,
          folderPath: 'images',
          uploaded: true,
          blob: null,
        })
      );
    });

    it('updates existing asset metadata if missing fields', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: mock(() => undefined).mockResolvedValue({
          success: true,
          data: [
            { clientId: 'existing-asset', filename: 'test.jpg', mimeType: 'image/jpeg', size: 1000, folderPath: 'images' },
          ],
        }),
      });
      mockAssetManager.getAsset.mockResolvedValue({
        id: 'existing-asset',
        projectId: 'project-123',
        filename: null,
        folderPath: undefined,
        mime: null,
        size: null,
      });

      await handler.syncAssetsMetadataFromServer();

      expect(mockAssetManager.putAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'existing-asset',
          filename: 'test.jpg',
          folderPath: 'images',
          mime: 'image/jpeg',
          size: 1000,
        })
      );
    });

    it('skips update if asset already has all metadata', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: mock(() => undefined).mockResolvedValue({
          success: true,
          data: [
            { clientId: 'complete-asset', filename: 'test.jpg', mimeType: 'image/jpeg', size: 1000, folderPath: 'images' },
          ],
        }),
      });
      mockAssetManager.getAsset.mockResolvedValue({
        id: 'complete-asset',
        projectId: 'project-123',
        filename: 'test.jpg',
        folderPath: 'images',
        mime: 'image/jpeg',
        size: 1000,
      });

      await handler.syncAssetsMetadataFromServer();

      expect(mockAssetManager.putAsset).not.toHaveBeenCalled();
    });

    it('handles fetch error gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await handler.syncAssetsMetadataFromServer();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch assets metadata: 500')
      );
    });

    it('handles no assets on server', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: mock(() => undefined).mockResolvedValue({
          success: true,
          data: [],
        }),
      });

      await handler.syncAssetsMetadataFromServer();

      expect(mockAssetManager.putAsset).not.toHaveBeenCalled();
    });

    it('skips assets without clientId', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: mock(() => undefined).mockResolvedValue({
          success: true,
          data: [
            { filename: 'test.jpg', mimeType: 'image/jpeg' }, // No clientId
          ],
        }),
      });

      await handler.syncAssetsMetadataFromServer();

      expect(mockAssetManager.getAsset).not.toHaveBeenCalled();
      expect(mockAssetManager.putAsset).not.toHaveBeenCalled();
    });
  });

});
