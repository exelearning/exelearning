/**
 * AssetWebSocketHandler
 *
 * Handles the asset coordination protocol over WebSocket.
 * Works alongside y-websocket's WebsocketProvider to enable
 * peer-to-peer asset synchronization.
 *
 * Protocol Messages (JSON):
 * - awareness-update: Announce which assets we have
 * - request-asset: Ask server to coordinate getting an asset
 * - upload-request: Server asking us to upload an asset we have
 * - asset-ready: Server notifying that an asset is now available
 * - asset-not-found: Asset not available from any peer
 *
 * Binary Yjs messages are NOT handled here - they're handled by y-websocket.
 *
 * Usage:
 *   const handler = new AssetWebSocketHandler(assetManager, wsProvider, config);
 *   await handler.initialize();
 *   // Handler will auto-announce availability on connect
 *   // And respond to asset requests from server/peers
 */
class AssetWebSocketHandler {
  /**
   * @param {AssetManager} assetManager - Asset manager instance
   * @param {WebsocketProvider} wsProvider - y-websocket provider
   * @param {Object} config - Configuration
   * @param {string} config.projectId - Project UUID
   * @param {string} config.apiUrl - API base URL
   * @param {string} config.token - JWT token
   */
  constructor(assetManager, wsProvider, config) {
    this.assetManager = assetManager;
    this.wsProvider = wsProvider;
    this.config = config;

    // Pending asset requests (assetId -> { resolve, reject, timeout })
    this.pendingRequests = new Map();

    // Track connection state
    this.connected = false;

    // Track if we've announced assets (for fallback mechanism)
    this._hasAnnounced = false;

    // Pending prefetch support (for bulk-upload-complete coordination)
    this._pendingPrefetchAssetIds = null;
    this._prefetchDelayTimeout = null;

    // Priority queue reference (set externally)
    this.priorityQueue = null;

    // Active uploads being tracked for preemption (assetId -> AbortController)
    this.activeUploads = new Map();

    // Event listeners
    this.listeners = {
      assetReceived: [],
      assetNotFound: [],
      error: [],
      priorityAck: [],
      preemptUpload: [],
      slotAvailable: [],
    };

    // Bound handlers for cleanup
    this._onMessage = this._handleMessage.bind(this);
    this._onStatus = this._handleStatus.bind(this);
  }

  /**
   * Initialize the handler
   * Sets up status listener - message handler is installed when connection is established
   * This is designed to work with deferred WebSocket connections (connect: false)
   */
  async initialize() {
    if (!this.wsProvider) {
      console.warn('[AssetWebSocketHandler] No WebSocket provider available');
      return;
    }

    // IMPORTANT: Attach status listener FIRST
    // The message handler will be installed when 'connected' status fires
    // This ensures the handler is in place before any messages can arrive
    this.wsProvider.on('status', this._onStatus);

    // If already connected (shouldn't happen with connect:false, but handle it)
    if (this.wsProvider.wsconnected && this.wsProvider.ws) {
      this.connected = true;
      this._setupMessageHandler();
      Logger.log('[AssetWebSocketHandler] WebSocket already connected, handler installed');
    }

    Logger.log('[AssetWebSocketHandler] Initialized (waiting for connection)');
  }

  /**
   * Wait for WebSocket connection
   * @param {number} timeout - Connection timeout in ms (default: 10000)
   * @returns {Promise<void>}
   */
  _waitForConnection(timeout = 10000) {
    return new Promise((resolve) => {
      if (this.wsProvider.wsconnected) {
        resolve();
        return;
      }

      const checkConnection = ({ status }) => {
        if (status === 'connected') {
          this.wsProvider.off('status', checkConnection);
          resolve();
        }
      };

      this.wsProvider.on('status', checkConnection);

      // Timeout after specified duration
      setTimeout(() => {
        this.wsProvider.off('status', checkConnection);
        resolve();
      }, timeout);
    });
  }

  /**
   * Setup message handler on WebSocket
   * Intercepts JSON messages for asset protocol
   */
  _setupMessageHandler() {
    // y-websocket's WebSocket instance
    const ws = this.wsProvider.ws;
    if (!ws) return;

    // Store original onmessage
    const originalOnMessage = ws.onmessage;

    // Asset message prefix byte - must match server's ASSET_MESSAGE_PREFIX
    const ASSET_MESSAGE_PREFIX = 0xff;

    // Wrap onmessage to intercept asset protocol messages
    // Asset messages from server are binary with 0xFF prefix byte
    // Format: [0xFF][JSON bytes]
    ws.onmessage = (event) => {
      const data = event.data;

      // Handle ArrayBuffer (binary messages)
      if (data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(data);
        // Check for asset message prefix (0xFF)
        if (bytes.length > 0 && bytes[0] === ASSET_MESSAGE_PREFIX) {
          // Asset message - decode JSON after prefix
          try {
            const jsonStr = new TextDecoder().decode(bytes.slice(1));
            const parsed = JSON.parse(jsonStr);
            if (this._isAssetMessage(parsed.type)) {
              this._handleAssetMessage(parsed);
              return;
            }
          } catch (err) {
            console.warn('[AssetWebSocketHandler] Failed to decode asset message:', err);
          }
          return; // Don't pass asset messages to y-websocket
        }
        // Regular Yjs binary message - pass to y-websocket
        if (originalOnMessage) {
          originalOnMessage.call(ws, event);
        }
        return;
      }

      // Handle Uint8Array (less common, but possible)
      if (data instanceof Uint8Array) {
        if (data.length > 0 && data[0] === ASSET_MESSAGE_PREFIX) {
          try {
            const jsonStr = new TextDecoder().decode(data.slice(1));
            const parsed = JSON.parse(jsonStr);
            if (this._isAssetMessage(parsed.type)) {
              this._handleAssetMessage(parsed);
              return;
            }
          } catch (err) {
            console.warn('[AssetWebSocketHandler] Failed to decode asset message:', err);
          }
          return;
        }
        if (originalOnMessage) {
          originalOnMessage.call(ws, event);
        }
        return;
      }

      // Handle Blob (convert to ArrayBuffer and check)
      if (data instanceof Blob) {
        data.arrayBuffer().then((buffer) => {
          const bytes = new Uint8Array(buffer);
          if (bytes.length > 0 && bytes[0] === ASSET_MESSAGE_PREFIX) {
            try {
              const jsonStr = new TextDecoder().decode(bytes.slice(1));
              const parsed = JSON.parse(jsonStr);
              if (this._isAssetMessage(parsed.type)) {
                this._handleAssetMessage(parsed);
                return;
              }
            } catch (err) {
              console.warn('[AssetWebSocketHandler] Failed to decode asset message:', err);
            }
          } else if (originalOnMessage) {
            // Create a new MessageEvent with ArrayBuffer for y-websocket
            const newEvent = new MessageEvent('message', { data: buffer });
            originalOnMessage.call(ws, newEvent);
          }
        });
        return;
      }

      // String/text messages - NEVER pass to y-websocket (it only handles binary)
      // This handles legacy JSON messages (should not happen with updated server)
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (this._isAssetMessage(parsed.type)) {
            this._handleAssetMessage(parsed);
            return;
          }
          // Handle server request to sync state (triggered when collaboration starts on unsaved project)
          if (parsed.type === 'request-sync-state') {
            this._handleRequestSyncState(parsed);
            return;
          }
          Logger.log('[AssetWebSocketHandler] Ignoring unknown JSON message:', parsed.type || 'no type');
        } catch {
          Logger.log('[AssetWebSocketHandler] Ignoring non-JSON string message');
        }
        return; // Never pass string messages to y-websocket
      }

      // Unknown message type - pass through as fallback
      if (originalOnMessage) {
        originalOnMessage.call(ws, event);
      }
    };

    Logger.log('[AssetWebSocketHandler] Message handler installed');
  }

  /**
   * Check if message type is asset-related
   * @param {string} type
   * @returns {boolean}
   */
  _isAssetMessage(type) {
    const assetTypes = [
      'awareness-update',
      'request-asset',
      'upload-request',
      'bulk-upload-request',
      'bulk-upload-complete',
      'asset-ready',
      'asset-not-found',
      'prefetch-assets',
      // Priority-related message types
      'priority-update',
      'priority-request',
      'priority-ack',
      'preempt-upload',
      'resume-upload',
      'slot-available',
      'navigation-hint',
    ];
    return assetTypes.includes(type);
  }

  /**
   * Handle WebSocket connection status changes
   * @param {{status: string}} param
   */
  async _handleStatus({ status }) {
    if (status === 'connected') {
      this.connected = true;
      Logger.log('[AssetWebSocketHandler] Connected, announcing assets...');

      // Re-setup message handler (WebSocket may be new)
      this._setupMessageHandler();

      // Announce our assets
      await this.announceAssetAvailability();

      // Sync asset metadata from server (for collaborative projects)
      // This ensures we have metadata for assets uploaded by other clients
      await this.syncAssetsMetadataFromServer();
    } else if (status === 'disconnected') {
      this.connected = false;
      Logger.log('[AssetWebSocketHandler] Disconnected');
    }
  }

  /**
   * Sync asset metadata from server to local IndexedDB
   * This fetches asset metadata (filename, folderPath, mime, etc.) for all project assets
   * without downloading the binary blobs. Essential for File Manager to display assets
   * uploaded by other clients.
   * @returns {Promise<void>}
   */
  async syncAssetsMetadataFromServer() {
    if (!this.config?.projectId || !this.assetManager) {
      Logger.log('[AssetWebSocketHandler] Cannot sync metadata: missing projectId or assetManager');
      return;
    }

    try {
      Logger.log('[AssetWebSocketHandler] Syncing asset metadata from server...');

      // Fetch all asset metadata from server
      const response = await fetch(
        `${this.config.apiUrl}/projects/${this.config.projectId}/assets`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
          },
        }
      );

      if (!response.ok) {
        console.warn(`[AssetWebSocketHandler] Failed to fetch assets metadata: ${response.status}`);
        return;
      }

      const result = await response.json();
      const serverAssets = result.data || [];

      if (serverAssets.length === 0) {
        Logger.log('[AssetWebSocketHandler] No assets on server');
        return;
      }

      Logger.log(`[AssetWebSocketHandler] Found ${serverAssets.length} assets on server`);

      // Update local IndexedDB with metadata (without overwriting existing blobs)
      let syncedCount = 0;
      for (const serverAsset of serverAssets) {
        const assetId = serverAsset.clientId;
        if (!assetId) continue;

        // Check if we already have this asset locally
        const localAsset = await this.assetManager.getAsset(assetId);

        if (localAsset && localAsset.projectId === this.assetManager.projectId) {
          // Asset exists locally - update metadata if missing (e.g., folderPath)
          let needsUpdate = false;

          if (!localAsset.filename && serverAsset.filename) {
            localAsset.filename = serverAsset.filename;
            needsUpdate = true;
          }
          if (localAsset.folderPath === undefined && serverAsset.folderPath !== undefined) {
            localAsset.folderPath = serverAsset.folderPath;
            needsUpdate = true;
          }
          if (!localAsset.mime && serverAsset.mimeType) {
            localAsset.mime = serverAsset.mimeType;
            needsUpdate = true;
          }
          if (!localAsset.size && serverAsset.size) {
            localAsset.size = serverAsset.size;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await this.assetManager.putAsset(localAsset);
            syncedCount++;
          }
        } else {
          // Asset doesn't exist locally - create metadata entry (without blob)
          // The blob will be fetched on-demand when needed
          const metadataEntry = {
            id: assetId,
            projectId: this.assetManager.projectId,
            filename: serverAsset.filename,
            mime: serverAsset.mimeType,
            size: serverAsset.size,
            folderPath: serverAsset.folderPath || '',
            uploaded: true, // It's on the server
            createdAt: serverAsset.createdAt || new Date().toISOString(),
            // No blob yet - will be fetched when needed
            blob: null,
          };
          await this.assetManager.putAsset(metadataEntry);
          syncedCount++;
        }
      }

      Logger.log(`[AssetWebSocketHandler] Synced metadata for ${syncedCount} assets`);
    } catch (error) {
      console.error('[AssetWebSocketHandler] Failed to sync asset metadata:', error);
    }
  }

  /**
   * Handle incoming message
   * @param {MessageEvent} event
   */
  _handleMessage(event) {
    // This is called from the wrapped onmessage above
  }

  /**
   * Handle asset protocol message
   * @param {Object} message
   */
  async _handleAssetMessage(message) {
    const { type, data } = message;

    Logger.log(`[AssetWebSocketHandler] Received: ${type}`, data);

    switch (type) {
      case 'upload-request':
        await this._handleUploadRequest(data);
        break;

      case 'bulk-upload-request':
        await this._handleBulkUploadRequest(data);
        break;

      case 'asset-ready':
        await this._handleAssetReady(data);
        break;

      case 'asset-not-found':
        this._handleAssetNotFound(data);
        break;

      case 'prefetch-assets':
      case 'request-prefetch':
        await this._handlePrefetchRequest(data);
        break;

      case 'bulk-upload-complete':
        await this._handleBulkUploadComplete(data);
        break;

      // Priority-related message handlers
      case 'priority-ack':
        this._handlePriorityAck(data);
        break;

      case 'preempt-upload':
        await this._handlePreemptUpload(data);
        break;

      case 'resume-upload':
        this._handleResumeUpload(data);
        break;

      case 'slot-available':
        this._handleSlotAvailable(data);
        break;

      // Access control messages
      case 'access-revoked':
        this._handleAccessRevoked(data);
        break;

      default:
        console.warn(`[AssetWebSocketHandler] Unknown message type: ${type}`);
    }
  }

  /**
   * Handle server request to sync state (triggered when collaboration starts on unsaved project)
   * This ensures the project is persisted before multiple users start editing
   * @param {Object} message - The request message
   * @param {string} message.reason - Why sync is requested (e.g., 'collaboration-started')
   * @param {string} message.projectUuid - Project UUID to sync
   */
  async _handleRequestSyncState(message) {
    const { reason, projectUuid } = message;
    Logger.log(`[AssetWebSocketHandler] Server requested sync-state, reason: ${reason}`);

    // Get the save manager from the bridge
    const saveManager = eXeLearning?.app?.project?._yjsBridge?.saveManager;
    if (!saveManager) {
      console.warn('[AssetWebSocketHandler] Cannot sync state: SaveManager not available');
      return;
    }

    // Get the document manager from the bridge
    const documentManager = eXeLearning?.app?.project?._yjsBridge?.documentManager;
    if (!documentManager) {
      console.warn('[AssetWebSocketHandler] Cannot sync state: DocumentManager not available');
      return;
    }

    try {
      // Save the Yjs state to the server
      // This will also mark the project as saved_once=1
      await saveManager.saveYjsState(projectUuid, documentManager);
      Logger.log('[AssetWebSocketHandler] Project state synced due to collaboration');
    } catch (error) {
      console.error('[AssetWebSocketHandler] Failed to sync project state:', error);
    }
  }

  /**
   * Announce which assets we have to the server
   * Called on connect and after importing new assets
   */
  async announceAssetAvailability() {
    // Use wsProvider.wsconnected directly to avoid race conditions with internal flag
    if (!this.wsProvider?.wsconnected || !this.assetManager) {
      Logger.log('[AssetWebSocketHandler] Cannot announce: not connected or no asset manager');
      return;
    }

    try {
      // Get only assets with local blobs - don't announce assets we can't serve
      const assetIds = await this.assetManager.getAllLocalBlobIds();

      // Mark as announced even if no assets (to prevent unnecessary retries)
      this._hasAnnounced = true;

      if (assetIds.length === 0) {
        Logger.log('[AssetWebSocketHandler] No assets to announce');
        // Still send awareness update with empty array so server knows we're ready
        this._sendMessage({
          type: 'awareness-update',
          data: {
            availableAssets: [],
            totalAssets: 0,
          },
        });
        return;
      }

      this._sendMessage({
        type: 'awareness-update',
        data: {
          availableAssets: assetIds,
          totalAssets: assetIds.length,
        },
      });

      Logger.log(`[AssetWebSocketHandler] Announced ${assetIds.length} assets`);
    } catch (error) {
      console.error('[AssetWebSocketHandler] Failed to announce assets:', error);
    }
  }

  /**
   * Request an asset from peers
   * @param {string} assetId - Asset UUID to request
   * @param {number} timeout - Timeout in ms (default 30s)
   * @returns {Promise<boolean>} - True if asset was retrieved
   */
  async requestAsset(assetId, timeout = 30000) {
    // Check if we already have the blob locally (not just metadata)
    const hasBlob = await this.assetManager.hasLocalBlob(assetId);
    if (hasBlob) {
      Logger.log(`[AssetWebSocketHandler] Asset ${assetId.substring(0, 8)}... already has local blob`);
      return true;
    }

    if (!this.connected) {
      console.warn('[AssetWebSocketHandler] Not connected, cannot request asset');
      return false;
    }

    // Check if already requesting
    if (this.pendingRequests.has(assetId)) {
      Logger.log(`[AssetWebSocketHandler] Already requesting ${assetId.substring(0, 8)}...`);
      return this.pendingRequests.get(assetId).promise;
    }

    // Create pending request
    const pendingRequest = {};
    pendingRequest.promise = new Promise((resolve, reject) => {
      pendingRequest.resolve = resolve;
      pendingRequest.reject = reject;
    });

    // Setup timeout
    pendingRequest.timeout = setTimeout(() => {
      this.pendingRequests.delete(assetId);
      pendingRequest.resolve(false);
    }, timeout);

    this.pendingRequests.set(assetId, pendingRequest);

    // Send request
    this._sendMessage({
      type: 'request-asset',
      data: {
        assetId,
        priority: 'high',
        reason: 'render',
      },
    });

    Logger.log(`[AssetWebSocketHandler] Requested asset ${assetId.substring(0, 8)}...`);

    return pendingRequest.promise;
  }

  /**
   * Handle upload request from server
   * Server is asking us to upload an asset we have
   * @param {Object} payload
   */
  async _handleUploadRequest(payload) {
    const { assetId, requestId, requestedBy, uploadUrl } = payload;

    Logger.log(`[AssetWebSocketHandler] Upload request for ${assetId.substring(0, 8)}...`);

    try {
      // Get asset data
      const assetData = await this.assetManager.getAssetForUpload(assetId);

      if (!assetData) {
        console.warn(`[AssetWebSocketHandler] Don't have asset ${assetId.substring(0, 8)}...`);
        // Notify server that we don't have the asset
        this._sendMessage({
          type: 'asset-uploaded',
          data: {
            assetId,
            requestId,
            requestedBy,
            success: false,
            error: 'Asset not found in local storage',
          },
        });
        return;
      }

      // Upload to server via REST API
      const formData = new FormData();
      formData.append('file', assetData.blob, assetData.filename);

      // Use server-provided uploadUrl (includes clientId as query param)
      // Fall back to constructing URL if not provided
      const url = uploadUrl
        ? `${this.config.apiUrl}${uploadUrl}`
        : `${this.config.apiUrl}/projects/${this.config.projectId}/assets?clientId=${assetId}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        Logger.log(`[AssetWebSocketHandler] Uploaded asset ${assetId.substring(0, 8)}...`, result);

        // Notify server that upload is complete
        this._sendMessage({
          type: 'asset-uploaded',
          data: {
            assetId,
            requestId,
            requestedBy,
            success: true,
            size: assetData.blob.size,
          },
        });
      } else {
        const errorText = await response.text();
        console.error(`[AssetWebSocketHandler] Upload failed: ${response.status}`, errorText);

        // Notify server about the failure
        this._sendMessage({
          type: 'asset-uploaded',
          data: {
            assetId,
            requestId,
            requestedBy,
            success: false,
            error: `HTTP ${response.status}: ${errorText}`,
          },
        });
      }
    } catch (error) {
      console.error(`[AssetWebSocketHandler] Upload error:`, error);

      // Notify server about the exception
      this._sendMessage({
        type: 'asset-uploaded',
        data: {
          assetId,
          requestId,
          requestedBy,
          success: false,
          error: error.message || 'Unknown error',
        },
      });
    }
  }

  /**
   * Handle bulk upload request from server
   * Server is asking us to upload multiple assets for collaboration sync
   * @param {Object} payload
   */
  async _handleBulkUploadRequest(payload) {
    const { assetIds, uploadUrl, reason } = payload;

    if (!assetIds || assetIds.length === 0) {
      Logger.log('[AssetWebSocketHandler] Bulk upload request with no assets');
      return;
    }

    Logger.log(`[AssetWebSocketHandler] Bulk upload request for ${assetIds.length} assets (reason: ${reason || 'unknown'})`);

    // Report starting bulk upload
    this._sendMessage({
      type: 'bulk-upload-progress',
      data: {
        status: 'started',
        total: assetIds.length,
        completed: 0,
        failed: 0,
      },
    });

    let completed = 0;
    let failed = 0;
    const failedAssets = [];

    // Upload assets sequentially with small delays to avoid overwhelming server
    for (const assetId of assetIds) {
      try {
        // Small delay between uploads
        if (completed > 0 || failed > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Get asset data
        const assetData = await this.assetManager.getAssetForUpload(assetId);

        if (!assetData) {
          console.warn(`[AssetWebSocketHandler] Bulk upload: Don't have asset ${assetId.substring(0, 8)}...`);
          failed++;
          failedAssets.push({ assetId, error: 'Asset not found in local storage' });
          continue;
        }

        // Upload to server
        const formData = new FormData();
        formData.append('file', assetData.blob, assetData.filename);

        // Use server-provided uploadUrl (includes clientId as query param)
        const url = uploadUrl
          ? `${this.config.apiUrl}${uploadUrl}?clientId=${assetId}`
          : `${this.config.apiUrl}/projects/${this.config.projectId}/assets?clientId=${assetId}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
          },
          body: formData,
        });

        if (response.ok) {
          completed++;
          Logger.log(`[AssetWebSocketHandler] Bulk uploaded ${assetId.substring(0, 8)}... (${completed}/${assetIds.length})`);

          // Report progress every 5 uploads or on last one
          if (completed % 5 === 0 || completed + failed === assetIds.length) {
            this._sendMessage({
              type: 'bulk-upload-progress',
              data: {
                status: 'in-progress',
                total: assetIds.length,
                completed,
                failed,
              },
            });
          }
        } else {
          const errorText = await response.text();
          console.error(`[AssetWebSocketHandler] Bulk upload failed for ${assetId.substring(0, 8)}...: ${response.status}`);
          failed++;
          failedAssets.push({ assetId, error: `HTTP ${response.status}: ${errorText}` });
        }
      } catch (error) {
        console.error(`[AssetWebSocketHandler] Bulk upload error for ${assetId}:`, error);
        failed++;
        failedAssets.push({ assetId, error: error.message || 'Unknown error' });
      }
    }

    // Report completion
    this._sendMessage({
      type: 'bulk-upload-progress',
      data: {
        status: 'completed',
        total: assetIds.length,
        completed,
        failed,
        failedAssets: failedAssets.length > 0 ? failedAssets : undefined,
      },
    });

    Logger.log(`[AssetWebSocketHandler] Bulk upload complete: ${completed} uploaded, ${failed} failed`);
  }

  /**
   * Handle bulk upload complete notification from server
   * Another client has finished uploading assets - we can now download them
   * @param {Object} payload
   */
  async _handleBulkUploadComplete(payload) {
    const { uploadedBy, totalAvailable, failedCount } = payload || {};

    Logger.log(`[AssetWebSocketHandler] Bulk upload complete notification: ${totalAvailable} assets available from ${uploadedBy || 'peer'}`);

    if (failedCount > 0) {
      console.warn(`[AssetWebSocketHandler] ${failedCount} assets failed to upload`);
    }

    // Check if we have a pending prefetch request that was delayed
    // If so, we can trigger it now since assets are available
    if (this._pendingPrefetchAssetIds && this._pendingPrefetchAssetIds.length > 0) {
      Logger.log(`[AssetWebSocketHandler] Triggering delayed prefetch for ${this._pendingPrefetchAssetIds.length} assets`);

      // Cancel any pending delay timeout
      if (this._prefetchDelayTimeout) {
        clearTimeout(this._prefetchDelayTimeout);
        this._prefetchDelayTimeout = null;
      }

      // Start prefetch immediately
      const missing = await this.assetManager.getMissingAssetIds(this._pendingPrefetchAssetIds);
      if (missing.length > 0) {
        this._prefetchAssets(missing);
      }

      this._pendingPrefetchAssetIds = null;
    }
  }

  /**
   * Handle asset-ready notification from server
   * Asset is now available on server, download it
   * @param {Object} payload
   */
  async _handleAssetReady(payload) {
    const { assetId, url } = payload;

    Logger.log(`[AssetWebSocketHandler] Asset ready: ${assetId.substring(0, 8)}...`);

    try {
      // Use server-provided URL or construct fallback
      const downloadUrl = url
        ? `${this.config.apiUrl}${url}`
        : `${this.config.apiUrl}/api/projects/${this.config.projectId}/assets/by-client-id/${assetId}`;

      // Download from server
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      // Get metadata from headers
      const mime = response.headers.get('X-Original-Mime') || 'application/octet-stream';
      const hash = response.headers.get('X-Asset-Hash') || '';
      const filename = response.headers.get('X-Filename') || undefined;
      const folderPath = response.headers.get('X-Folder-Path') || '';
      const size = parseInt(response.headers.get('X-File-Size') || '0', 10);

      // Get blob
      const blob = await response.blob();

      // Store in AssetManager
      await this.assetManager.storeAssetFromServer(assetId, blob, {
        mime,
        hash,
        filename,
        folderPath,
        size: size || blob.size,
      });

      // Resolve pending request if any
      const pending = this.pendingRequests.get(assetId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(assetId);
        pending.resolve(true);
      }

      // Emit event
      this._emit('assetReceived', { assetId });

      Logger.log(`[AssetWebSocketHandler] Downloaded and stored ${assetId.substring(0, 8)}...`);
    } catch (error) {
      console.error(`[AssetWebSocketHandler] Failed to download asset:`, error);
    }
  }

  /**
   * Handle asset-not-found notification
   * @param {Object} payload
   */
  _handleAssetNotFound(payload) {
    const { assetId } = payload;

    console.warn(`[AssetWebSocketHandler] Asset not found: ${assetId.substring(0, 8)}...`);

    // Resolve pending request as failed
    const pending = this.pendingRequests.get(assetId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(assetId);
      pending.resolve(false);
    }

    // Emit event
    this._emit('assetNotFound', { assetId });
  }

  /**
   * Handle prefetch request from server
   * Server is asking us to prefetch assets in background
   * @param {Object} payload
   */
  async _handlePrefetchRequest(payload) {
    const { assetIds, delayMs } = payload;

    if (!assetIds || assetIds.length === 0) {
      return;
    }

    Logger.log(`[AssetWebSocketHandler] Prefetch request for ${assetIds.length} assets`);

    // Find which ones we're missing
    const missing = await this.assetManager.getMissingAssetIds(assetIds);

    if (missing.length === 0) {
      Logger.log('[AssetWebSocketHandler] All prefetch assets already cached');
      return;
    }

    // Respect server-provided delay hint (e.g., wait for bulk uploads to complete)
    if (delayMs && delayMs > 0) {
      Logger.log(`[AssetWebSocketHandler] Waiting ${delayMs}ms before prefetching (server hint)`);

      // Store pending assets so bulk-upload-complete can trigger early
      this._pendingPrefetchAssetIds = missing;

      // Set a timeout to trigger prefetch after delay (in case bulk-upload-complete doesn't arrive)
      this._prefetchDelayTimeout = setTimeout(async () => {
        this._prefetchDelayTimeout = null;
        if (this._pendingPrefetchAssetIds && this._pendingPrefetchAssetIds.length > 0) {
          Logger.log(`[AssetWebSocketHandler] Delay expired, starting prefetch...`);
          const toFetch = this._pendingPrefetchAssetIds;
          this._pendingPrefetchAssetIds = null;
          this._prefetchAssets(toFetch);
        }
      }, delayMs);

      return; // Will be triggered by timeout or bulk-upload-complete
    }

    Logger.log(`[AssetWebSocketHandler] Prefetching ${missing.length} missing assets...`);

    // Download missing assets in background (don't await)
    this._prefetchAssets(missing);
  }

  /**
   * Prefetch assets in background
   * @param {string[]} assetIds
   */
  async _prefetchAssets(assetIds) {
    for (const assetId of assetIds) {
      try {
        // Small delay between requests to avoid overwhelming server
        await new Promise(resolve => setTimeout(resolve, 100));

        const response = await fetch(
          `${this.config.apiUrl}/projects/${this.config.projectId}/assets/by-client-id/${assetId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.config.token}`,
            },
          }
        );

        if (!response.ok) {
          console.warn(`[AssetWebSocketHandler] Prefetch failed for ${assetId.substring(0, 8)}...`);
          continue;
        }

        const mime = response.headers.get('X-Original-Mime') || 'application/octet-stream';
        const hash = response.headers.get('X-Asset-Hash') || '';
        const filename = response.headers.get('X-Filename') || undefined;
        const folderPath = response.headers.get('X-Folder-Path') || '';
        const size = parseInt(response.headers.get('X-File-Size') || '0', 10);
        const blob = await response.blob();

        await this.assetManager.storeAssetFromServer(assetId, blob, {
          mime,
          hash,
          filename,
          folderPath,
          size: size || blob.size,
        });

        Logger.log(`[AssetWebSocketHandler] Prefetched ${assetId.substring(0, 8)}...`);
      } catch (error) {
        console.warn(`[AssetWebSocketHandler] Prefetch error for ${assetId}:`, error);
      }
    }
  }

  /**
   * Request missing assets that are referenced in HTML
   * Call this after loading content that may reference assets
   * @param {string} html - HTML content to scan
   * @returns {Promise<string[]>} - List of asset IDs that were requested
   */
  async requestMissingAssetsFromHTML(html) {
    if (!html) return [];

    // Find all asset:// references
    // Also handles corrupted URLs like asset://asset//uuid/filename
    const assetRegex = /asset:\/\/(?:asset\/+)?([a-f0-9-]+)/gi;
    const matches = [...html.matchAll(assetRegex)];

    if (matches.length === 0) return [];

    const assetIds = matches.map(m => m[1]);
    const uniqueIds = [...new Set(assetIds)];

    // Find missing ones
    const missing = await this.assetManager.getMissingAssetIds(uniqueIds);

    if (missing.length === 0) return [];

    Logger.log(`[AssetWebSocketHandler] Requesting ${missing.length} missing assets from HTML`);

    // Request each missing asset
    for (const assetId of missing) {
      this.requestAsset(assetId).catch(err => {
        console.warn(`[AssetWebSocketHandler] Failed to request ${assetId}:`, err);
      });
    }

    return missing;
  }

  /**
   * Send asset message over WebSocket
   * Messages are encoded as binary with 0xFF prefix to avoid y-websocket conflicts
   * Format: [0xFF][JSON bytes]
   * @param {Object} message
   */
  _sendMessage(message) {
    if (!this.wsProvider?.ws || this.wsProvider.ws.readyState !== WebSocket.OPEN) {
      console.warn('[AssetWebSocketHandler] Cannot send - WebSocket not open');
      return;
    }

    // Encode as binary with 0xFF prefix
    const ASSET_MESSAGE_PREFIX = 0xff;
    const jsonStr = JSON.stringify(message);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const binaryMessage = new Uint8Array(1 + jsonBytes.length);
    binaryMessage[0] = ASSET_MESSAGE_PREFIX;
    binaryMessage.set(jsonBytes, 1);

    this.wsProvider.ws.send(binaryMessage);
  }

  // ===== Priority System Methods =====

  /**
   * Set the priority queue reference
   * @param {AssetPriorityQueue} queue
   */
  setPriorityQueue(queue) {
    this.priorityQueue = queue;
    Logger.log('[AssetWebSocketHandler] Priority queue attached');
  }

  /**
   * Send priority update to server
   * Call this when an asset becomes high priority (e.g., needed for render)
   * @param {string} assetId - Asset UUID
   * @param {number} priority - Priority level (0-100)
   * @param {string} reason - Why this priority ('render', 'navigation', 'prefetch', 'save')
   * @param {string} [pageId] - Associated page ID
   */
  sendPriorityUpdate(assetId, priority, reason, pageId = null) {
    if (!this.connected) {
      console.warn('[AssetWebSocketHandler] Cannot send priority update - not connected');
      return;
    }

    this._sendMessage({
      type: 'priority-update',
      data: {
        assetId,
        priority,
        reason,
        pageId,
        timestamp: Date.now(),
      },
    });

    Logger.log(
      `[AssetWebSocketHandler] Sent priority update: ${assetId.substring(0, 8)}... ` +
        `priority=${priority} reason=${reason}`
    );
  }

  /**
   * Send navigation hint to server
   * Call when user navigates to a new page to boost priority of page assets
   * @param {string} targetPageId - Target page UUID
   * @param {string[]} assetIds - Asset IDs on the target page
   */
  sendNavigationHint(targetPageId, assetIds) {
    if (!this.connected) {
      console.warn('[AssetWebSocketHandler] Cannot send navigation hint - not connected');
      return;
    }

    if (!assetIds || assetIds.length === 0) {
      return;
    }

    this._sendMessage({
      type: 'navigation-hint',
      data: {
        targetPageId,
        assetIds,
        timestamp: Date.now(),
      },
    });

    Logger.log(
      `[AssetWebSocketHandler] Sent navigation hint: page=${targetPageId.substring(0, 8)}... ` +
        `assets=${assetIds.length}`
    );
  }

  /**
   * Handle priority acknowledgment from server
   * @param {Object} data - { assetId, queuePosition, estimatedWait }
   */
  _handlePriorityAck(data) {
    const { assetId, queuePosition, estimatedWait } = data;

    Logger.log(
      `[AssetWebSocketHandler] Priority ack: ${assetId.substring(0, 8)}... ` +
        `position=${queuePosition}${estimatedWait ? ` wait=${estimatedWait}ms` : ''}`
    );

    // Emit event for UI updates
    this._emit('priorityAck', data);
  }

  /**
   * Handle preempt-upload message from server
   * Server is asking us to pause current upload for higher priority item
   * @param {Object} data - { assetId, reason, preemptedBy, retryAfter }
   */
  async _handlePreemptUpload(data) {
    const { assetId, reason, preemptedBy, retryAfter } = data;

    Logger.log(
      `[AssetWebSocketHandler] Preempt upload: ${assetId.substring(0, 8)}... ` +
        `reason=${reason} preemptedBy=${preemptedBy?.substring(0, 8)}...`
    );

    // Abort the active upload if we have an AbortController
    const abortController = this.activeUploads.get(assetId);
    if (abortController) {
      abortController.abort();
      this.activeUploads.delete(assetId);
    }

    // Re-queue with lower priority if we have a priority queue
    if (this.priorityQueue) {
      this.priorityQueue.enqueue(assetId, AssetPriorityQueue.PRIORITY.LOW, {
        reason: 'preempted',
        preemptedBy,
      });
    }

    // Emit event
    this._emit('preemptUpload', data);
  }

  /**
   * Handle resume-upload message from server
   * Server is telling us we can resume a previously paused upload
   * @param {Object} data - { assetId, newPriority }
   */
  _handleResumeUpload(data) {
    const { assetId, newPriority } = data;

    Logger.log(
      `[AssetWebSocketHandler] Resume upload: ${assetId.substring(0, 8)}... ` +
        `newPriority=${newPriority || 'default'}`
    );

    // Update priority queue if we have one
    if (this.priorityQueue && newPriority !== undefined) {
      this.priorityQueue.updatePriority(assetId, newPriority, { reason: 'resumed' });
    }
  }

  /**
   * Handle slot-available message from server
   * Server is notifying that an upload slot is free
   * @param {Object} data - { nextAssetId, availableSlots }
   */
  _handleSlotAvailable(data) {
    const { nextAssetId, availableSlots } = data;

    Logger.log(
      `[AssetWebSocketHandler] Slot available: next=${nextAssetId?.substring(0, 8) || 'none'}... ` +
        `slots=${availableSlots}`
    );

    // Emit event for SaveManager to potentially start next upload
    this._emit('slotAvailable', data);
  }

  /**
   * Handle access-revoked message from server
   * Server is notifying that user's access has been revoked
   * @param {Object} data - { reason: 'visibility_changed' | 'collaborator_removed', revokedAt }
   */
  _handleAccessRevoked(data) {
    const { reason } = data;

    console.warn(`[AssetWebSocketHandler] Access revoked: ${reason}`);

    // Disconnect WebSocket to prevent further reconnection attempts
    if (this.wsProvider) {
      // Mark as intentionally disconnecting to prevent reconnect
      this.wsProvider.shouldConnect = false;
      this.wsProvider.disconnect();
    }

    // Emit event for other components
    this._emit('accessRevoked', data);

    // Redirect to access denied page
    const basePath = window.eXeLearning?.config?.basePath || '';
    const accessDeniedUrl = `${basePath}/access-denied`;

    // Small delay to allow disconnect to complete
    setTimeout(() => {
      window.location.href = accessDeniedUrl;
    }, 100);
  }

  /**
   * Register an active upload (for preemption tracking)
   * @param {string} assetId - Asset being uploaded
   * @param {AbortController} abortController - Controller to abort upload
   */
  registerActiveUpload(assetId, abortController) {
    this.activeUploads.set(assetId, abortController);
  }

  /**
   * Unregister an active upload
   * @param {string} assetId - Asset that finished uploading
   */
  unregisterActiveUpload(assetId) {
    this.activeUploads.delete(assetId);
  }

  /**
   * Request asset with priority (enhanced version of requestAsset)
   * @param {string} assetId - Asset UUID
   * @param {number} priority - Priority level (0-100)
   * @param {string} reason - Why this priority
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<boolean>} - True if asset was retrieved
   */
  async requestAssetWithPriority(assetId, priority, reason = 'render', timeout = 30000) {
    // Check if we already have it
    const exists = await this.assetManager.hasAsset(assetId);
    if (exists) {
      Logger.log(`[AssetWebSocketHandler] Asset ${assetId.substring(0, 8)}... already exists`);
      return true;
    }

    if (!this.connected) {
      console.warn('[AssetWebSocketHandler] Not connected, cannot request asset');
      return false;
    }

    // Check if already requesting
    if (this.pendingRequests.has(assetId)) {
      // Update priority if higher
      this.sendPriorityUpdate(assetId, priority, reason);
      return this.pendingRequests.get(assetId).promise;
    }

    // Create pending request
    const pendingRequest = {};
    pendingRequest.promise = new Promise((resolve, reject) => {
      pendingRequest.resolve = resolve;
      pendingRequest.reject = reject;
    });

    // Setup timeout
    pendingRequest.timeout = setTimeout(() => {
      this.pendingRequests.delete(assetId);
      pendingRequest.resolve(false);
    }, timeout);

    this.pendingRequests.set(assetId, pendingRequest);

    // Send request with priority
    this._sendMessage({
      type: 'request-asset',
      data: {
        assetId,
        priority,
        reason,
      },
    });

    // Also send priority update to ensure server knows priority
    this.sendPriorityUpdate(assetId, priority, reason);

    Logger.log(
      `[AssetWebSocketHandler] Requested asset with priority: ${assetId.substring(0, 8)}... ` +
        `priority=${priority} reason=${reason}`
    );

    return pendingRequest.promise;
  }

  // ===== Event Handling =====

  /**
   * Subscribe to event
   * @param {string} event - Event name
   * @param {Function} callback
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * Unsubscribe from event
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit event
   * @param {string} event
   * @param {Object} data
   */
  _emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    // Clear pending requests
    for (const [assetId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.resolve(false);
    }
    this.pendingRequests.clear();

    // Clear prefetch delay timeout
    if (this._prefetchDelayTimeout) {
      clearTimeout(this._prefetchDelayTimeout);
      this._prefetchDelayTimeout = null;
    }
    this._pendingPrefetchAssetIds = null;

    // Remove status listener
    if (this.wsProvider) {
      this.wsProvider.off('status', this._onStatus);
    }

    this.listeners = {
      assetReceived: [],
      assetNotFound: [],
      error: [],
    };

    Logger.log('[AssetWebSocketHandler] Destroyed');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssetWebSocketHandler;
} else {
  window.AssetWebSocketHandler = AssetWebSocketHandler;
}
