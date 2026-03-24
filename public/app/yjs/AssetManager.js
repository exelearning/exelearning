/**
 * AssetManager
 *
 * In-memory + Cache API asset management for eXeLearning.
 *
 * Key features:
 * - Assets referenced with asset:// URLs in HTML (not base64 or http://)
 * - Blobs stored in-memory (blobCache) + Cache API (persistent across reloads)
 * - Metadata synced via Yjs Y.Map
 * - Deduplication by SHA-256 hash
 * - Assets downloaded from server on project open, uploaded on save
 *
 * Architecture:
 *   Metadata: Yjs Y.Map (synced between clients)
 *       ↓
 *   Blobs: blobCache Map<assetId, Blob> (in-memory, fast)
 *       ↓
 *   Blobs: Cache API (persistent, survives page reload)
 *       ↓
 *   Display: blobURLCache Map<assetId, blob://>
 *
 * Cache API Persistence:
 * - putAsset() and putBlob() write to both memory and Cache API
 * - getBlob() checks memory first, then falls back to Cache API
 * - deleteAsset() removes from both memory and Cache API
 * - cleanup() clears the entire project cache
 * - Per-project isolation via cache name: exe-assets-{projectId}
 *
 * Benefits:
 * - Assets survive page reload (before saving to server)
 * - No server traffic for local persistence
 * - Works offline
 *
 * Usage:
 *   const manager = new AssetManager(projectId);
 *   await manager.init();
 *   const assetUrl = await manager.insertImage(file);  // Returns "asset://uuid"
 *   const blobUrl = await manager.resolveAssetURL(assetUrl);  // Returns "blob://..."
 */

// Logger is defined globally by yjs-loader.js before this file loads

class AssetManager {
  /**
   * @param {string} projectId - Project UUID
   */
  constructor(projectId) {
    this.projectId = projectId;

    // In-memory blob storage (replaces IndexedDB)
    // Map: assetId -> Blob
    this.blobCache = new Map();

    // Cache of blob URLs: assetId -> blob:// URL
    this.blobURLCache = new Map();

    // Reverse cache: blob:// URL -> assetId
    this.reverseBlobCache = new Map();

    // Priority queue reference (set externally)
    this.priorityQueue = null;

    // WebSocket handler reference (set externally)
    this.wsHandler = null;

    // Yjs bridge reference (set externally) - source of truth for metadata
    this.yjsBridge = null;

    // Cache API persistence may be unavailable under custom schemes such as
    // app:// in Electron. Disable repeated attempts after the first hard failure
    // to avoid thousands of slow exceptions during large imports.
    this.cachePersistenceDisabled = false;
  }

  /**
   * Cache API only accepts HTTP(S) requests. In Electron app:// mode we use a
   * synthetic HTTPS URL so the same cache can still be used when supported.
   * @param {string} id
   * @returns {string}
   * @private
   */
  _getCacheRequestUrl(id) {
    const path = `/asset/${id}`;
    const protocol = window.location?.protocol || '';
    if (protocol === 'http:' || protocol === 'https:') {
      return path;
    }
    return `https://cache.exelearning.invalid${path}`;
  }

  /**
   * Disable Cache API persistence after an unrecoverable runtime failure.
   * @param {Error} error
   * @private
   */
  _disableCachePersistence(error) {
    if (this.cachePersistenceDisabled) {
      return;
    }
    this.cachePersistenceDisabled = true;
    console.warn('[AssetManager] Cache API persistence disabled:', error.message);
  }

  /**
   * Set the priority queue reference
   * @param {AssetPriorityQueue} queue
   */
  setPriorityQueue(queue) {
    this.priorityQueue = queue;
    Logger.log('[AssetManager] Priority queue attached');
  }

  /**
   * Set the WebSocket handler reference
   * @param {AssetWebSocketHandler} handler
   */
  setWebSocketHandler(handler) {
    this.wsHandler = handler;
    Logger.log('[AssetManager] WebSocket handler attached');
  }

  /**
   * Set the Yjs bridge reference for metadata storage
   * @param {YjsProjectBridge} bridge
   */
  setYjsBridge(bridge) {
    this.yjsBridge = bridge;
    Logger.log('[AssetManager] Yjs bridge attached');
  }

  /**
   * Announce locally available blobs to peers via WebSocket.
   * Safe no-op when collaboration handler is unavailable.
   * @param {string} reason - Debug context
   * @returns {Promise<void>}
   * @private
   */
  async _announceAssetAvailability(reason = 'asset update') {
    if (!this.wsHandler || typeof this.wsHandler.announceAssetAvailability !== 'function') {
      return;
    }

    try {
      await this.wsHandler.announceAssetAvailability();
    } catch (err) {
      console.warn(`[AssetManager] Failed to announce assets (${reason}):`, err);
    }
  }

  /**
   * Schedule asset availability announcement without blocking caller flow.
   * @param {string} reason - Debug context
   * @param {number} delayMs - Delay before announcement
   * @private
   */
  _scheduleAssetAvailabilityAnnouncement(reason = 'asset update', delayMs = 100) {
    setTimeout(() => {
      this._announceAssetAvailability(reason);
    }, delayMs);
  }

  // ===== Cache API Methods (persistent storage across page reloads) =====

  /**
   * Get Cache API cache name for this project
   * @returns {string}
   */
  getCacheName() {
    return `exe-assets-${this.projectId}`;
  }

  /**
   * Store blob in Cache API for persistence across page reloads
   * @param {string} id - Asset UUID
   * @param {Blob} blob - Asset blob
   * @private
   */
  async _putToCache(id, blob) {
    if (!('caches' in window) || this.cachePersistenceDisabled) return; // Cache API not supported

    try {
      const cache = await caches.open(this.getCacheName());
      const response = new Response(blob, {
        headers: { 'Content-Type': blob.type || 'application/octet-stream' }
      });
      await cache.put(this._getCacheRequestUrl(id), response);
    } catch (e) {
      console.warn('[AssetManager] Cache API write failed:', e.message);
      if (/unsupported|scheme|Failed to execute/i.test(e.message || '')) {
        this._disableCachePersistence(e);
      }
    }
  }

  /**
   * Get blob from Cache API
   * @param {string} id - Asset UUID
   * @returns {Promise<Blob|null>}
   * @private
   */
  async _getFromCache(id) {
    if (!('caches' in window) || this.cachePersistenceDisabled) return null;

    try {
      const cache = await caches.open(this.getCacheName());
      const response = await cache.match(this._getCacheRequestUrl(id));
      if (response) {
        return await response.blob();
      }
    } catch (e) {
      console.warn('[AssetManager] Cache API read failed:', e.message);
      if (/unsupported|scheme|Failed to execute/i.test(e.message || '')) {
        this._disableCachePersistence(e);
      }
    }
    return null;
  }

  /**
   * Delete blob from Cache API
   * @param {string} id - Asset UUID
   * @private
   */
  async _deleteFromCache(id) {
    if (!('caches' in window) || this.cachePersistenceDisabled) return;

    try {
      const cache = await caches.open(this.getCacheName());
      await cache.delete(this._getCacheRequestUrl(id));
    } catch (e) {
      // Ignore delete errors
    }
  }

  /**
   * Clear entire cache for this project
   * Called on project close or after successful save
   */
  async clearCache() {
    if (!('caches' in window) || this.cachePersistenceDisabled) return;

    try {
      await caches.delete(this.getCacheName());
      Logger.log('[AssetManager] Cache cleared');
    } catch (e) {
      console.warn('[AssetManager] Cache clear failed:', e.message);
    }
  }

  /**
   * Get the Yjs assets Y.Map (metadata storage)
   * @returns {Y.Map|null}
   */
  getAssetsYMap() {
    if (!this.yjsBridge) {
      return null;
    }
    try {
      return this.yjsBridge.getAssetsMap();
    } catch (e) {
      console.warn('[AssetManager] Failed to get assets Y.Map:', e.message);
      return null;
    }
  }

  /**
   * Get asset metadata from Yjs
   * @param {string} assetId
   * @returns {Object|null} Asset metadata {filename, folderPath, mime, size, hash, uploaded, createdAt}
   */
  getAssetMetadata(assetId) {
    const assetsMap = this.getAssetsYMap();
    if (!assetsMap) return null;
    const meta = assetsMap.get(assetId);
    return meta ? { ...meta, id: assetId } : null;
  }

  /**
   * Set asset metadata in Yjs
   * @param {string} assetId
   * @param {Object} metadata - {filename, folderPath, mime, size, hash, uploaded, createdAt}
   */
  setAssetMetadata(assetId, metadata) {
    const assetsMap = this.getAssetsYMap();
    if (!assetsMap) {
      return;
    }
    // Store as plain object (Yjs will serialize it)
    assetsMap.set(assetId, {
      filename: metadata.filename,
      folderPath: metadata.folderPath || '',
      mime: metadata.mime,
      size: metadata.size,
      hash: metadata.hash,
      uploaded: metadata.uploaded || false,
      createdAt: metadata.createdAt || new Date().toISOString()
    });
    Logger.log(`[AssetManager] Set metadata for ${assetId.substring(0, 8)}... in Yjs`);
  }

  /**
   * Delete asset metadata from Yjs
   * @param {string} assetId
   */
  deleteAssetMetadata(assetId) {
    const assetsMap = this.getAssetsYMap();
    if (!assetsMap) return;
    assetsMap.delete(assetId);
    Logger.log(`[AssetManager] Deleted metadata for ${assetId.substring(0, 8)}... from Yjs`);
  }

  /**
   * Get all assets metadata from Yjs for this project
   * @returns {Array<Object>} Array of asset metadata objects with id
   */
  getAllAssetsMetadata() {
    const assetsMap = this.getAssetsYMap();
    if (!assetsMap) return [];
    const assets = [];
    assetsMap.forEach((meta, id) => {
      assets.push({ ...meta, id });
    });
    return assets;
  }

  /**
   * Generate asset URL in simplified format: asset://uuid.ext
   *
   * This format stores only the UUID and extension, making URLs:
   * - Shorter and cleaner
   * - Rename-friendly (filename not in URL)
   * - Move-friendly (folderPath not in URL)
   * - Free of path separator issues
   *
   * The full path (folderPath/filename) is resolved at export time.
   *
   * @param {string} assetId - UUID of the asset
   * @param {string} filename - Original filename (for extension extraction)
   * @returns {string} asset://uuid.ext format (e.g., "asset://abc123-uuid.jpg")
   */
  getAssetUrl(assetId, filename) {
    const ext = filename?.includes('.') ? filename.split('.').pop().toLowerCase() : '';
    return ext ? `asset://${assetId}.${ext}` : `asset://${assetId}`;
  }

  /**
   * Initialize asset manager
   * Must be called before any other operations.
   *
   * Architecture (in-memory):
   * - Blobs stored in blobCache Map (in-memory only)
   * - Metadata stored in Yjs Y.Map for instant sync
   * - On page reload, blobs are re-fetched via downloadMissingAssets()
   *
   * @returns {Promise<void>}
   */
  async init() {
    // No-op: blobs stored in memory, no database needed
    Logger.log(`[AssetManager] Initialized (in-memory) for project ${this.projectId}`);
  }

  /**
   * Generate UUID v4
   * @returns {string}
   */
  generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Calculate SHA-256 hash of blob
   * Falls back to a simple hash if crypto.subtle is not available
   * (crypto.subtle requires secure context - HTTPS or localhost)
   * @param {Blob} blob
   * @returns {Promise<string>} Hex string hash
   */
  async calculateHash(blob) {
    const arrayBuffer = await blob.arrayBuffer();

    // crypto.subtle is only available in secure contexts (HTTPS or localhost)
    // In non-secure contexts (HTTP on IP address), use a fallback hash
    if (crypto.subtle?.digest) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback: Simple FNV-1a hash (32-bit) expanded to 64 chars
    // Not cryptographically secure, but sufficient for asset deduplication
    const data = new Uint8Array(arrayBuffer);
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < data.length; i++) {
      hash ^= data[i];
      hash = (hash * 16777619) >>> 0; // FNV prime, keep as 32-bit unsigned
    }
    // Expand to 64 hex chars by combining hash with size and sampling
    const sizeHash = (data.length * 2654435761) >>> 0;
    const sample1 = data.length > 0 ? data[0] : 0;
    const sample2 = data.length > 100 ? data[100] : 0;
    const sample3 = data.length > 1000 ? data[1000] : 0;
    const combined = [
      hash.toString(16).padStart(8, '0'),
      sizeHash.toString(16).padStart(8, '0'),
      (hash ^ sizeHash).toString(16).padStart(8, '0'),
      ((hash + sample1 + sample2 + sample3) >>> 0).toString(16).padStart(8, '0'),
      data.length.toString(16).padStart(8, '0'),
      ((hash * 31 + sizeHash) >>> 0).toString(16).padStart(8, '0'),
      ((sizeHash ^ sample1 ^ sample2 ^ sample3) >>> 0).toString(16).padStart(8, '0'),
      ((hash ^ data.length) >>> 0).toString(16).padStart(8, '0'),
    ].join('');
    return combined;
  }

  /**
   * Convert SHA-256 hash to UUID format
   * Takes first 32 hex chars and formats as UUID
   * @param {string} hash - SHA-256 hex string (64 chars)
   * @returns {string} UUID format (8-4-4-4-12)
   */
  hashToUUID(hash) {
    // Use first 32 hex characters of the hash
    const h = hash.substring(0, 32);
    return `${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20, 32)}`;
  }

  /**
   * Create a displayable URL for a blob
   * Uses createObjectURL if available, falls back to data URL if blocked
   * (Some browser extensions like Malwarebytes block createObjectURL)
   * @param {Blob} blob
   * @returns {Promise<string>} blob:// URL or data:// URL
   */
  async createBlobURL(blob) {
    try {
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn('[AssetManager] createObjectURL blocked, using data URL fallback');
      // Fallback to data URL (base64)
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
        reader.readAsDataURL(blob);
      });
    }
  }

  /**
   * Create a displayable URL for a blob (sync version, no fallback)
   * @param {Blob} blob
   * @returns {string} blob:// URL
   */
  createBlobURLSync(blob) {
    try {
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn('[AssetManager] createObjectURL blocked');
      return null;
    }
  }

  /**
   * Store asset - metadata to Yjs, blob to in-memory cache
   * @param {Object} asset - Full asset object with blob and metadata
   * @returns {Promise<void>}
   */
  async putAsset(asset) {
    // 1. Store metadata in Yjs (instant sync to other clients)
    this.setAssetMetadata(asset.id, {
      filename: asset.filename,
      folderPath: asset.folderPath || '',
      mime: asset.mime,
      size: asset.size,
      hash: asset.hash,
      uploaded: asset.uploaded || false,
      createdAt: asset.createdAt || new Date().toISOString()
    });

    // 2. Store blob in memory
    this.blobCache.set(asset.id, asset.blob);

    // 3. Persist to Cache API (background, non-blocking)
    this._putToCache(asset.id, asset.blob).catch(() => {});
  }

  /**
   * Store only blob in memory (without updating Yjs metadata)
   * Used when receiving blob from peer/server
   * @param {string} id - Asset UUID
   * @param {Blob} blob - Asset blob
   * @returns {Promise<void>}
   */
  async putBlob(id, blob) {
    this.blobCache.set(id, blob);
    // Also persist to Cache API
    this._putToCache(id, blob).catch(() => {});
  }

  /**
   * Get blob from memory or Cache API.
   * @param {string} id - Asset UUID
   * @param {Object} options
   * @param {boolean} options.restoreToMemory - Rehydrate blobCache from Cache API (default: true)
   * @returns {Promise<Blob|null>}
   */
  async getBlob(id, options = {}) {
    const { restoreToMemory = true } = options;

    // 1. Check in-memory cache first (fastest)
    const memBlob = this.blobCache.get(id);
    if (memBlob) return memBlob;

    // 2. Fallback to Cache API (survives page reload)
    const cachedBlob = await this._getFromCache(id);
    if (cachedBlob) {
      // Restore to memory cache for faster subsequent access unless this is an
      // export/preview-only read that must not repopulate the editor working set.
      if (restoreToMemory) {
        this.blobCache.set(id, cachedBlob);
      }
      return cachedBlob;
    }

    return null;
  }

  /**
   * Get blob for export/preview without repopulating blobCache from Cache API.
   * This keeps the editor working set bounded after save().
   * @param {string} id - Asset UUID
   * @returns {Promise<Blob|null>}
   */
  async getBlobForExport(id) {
    return this.getBlob(id, { restoreToMemory: false });
  }

  /**
   * Get raw blob record from memory (includes projectId)
   * Unlike getBlob() which returns just the blob, this returns the full record
   * with id, projectId, and blob - useful for checking which project owns the blob.
   * @param {string} id - Asset UUID
   * @returns {Promise<{id: string, projectId: string, blob: Blob}|null>}
   */
  async getBlobRecord(id) {
    // Use getBlob() to benefit from Cache API fallback
    const blob = await this.getBlob(id);
    if (!blob) return null;
    return {
      id,
      projectId: this.projectId,
      blob
    };
  }

  /**
   * Get asset by ID - combines Yjs metadata + in-memory blob
   * @param {string} id - Asset UUID
   * @returns {Promise<Object|null>}
   */
  async getAsset(id) {
    // Get metadata from Yjs
    const metadata = this.getAssetMetadata(id);

    // Get blob from memory (with Cache API fallback for static mode)
    const blob = await this.getBlob(id);

    // If we have metadata, return combined object
    if (metadata) {
      return {
        ...metadata,
        id,
        projectId: this.projectId,
        blob: blob || null // may be null if blob not cached locally
      };
    }

    // Fallback: if no Yjs metadata but blob exists
    // With in-memory storage, all blobs belong to current project
    if (blob) {
      return {
        id,
        projectId: this.projectId,
        blob: blob,
        // Minimal metadata from blob alone - filename is undefined (not 'unknown')
        // so callers can derive a proper name from MIME type or asset ID
        filename: undefined,
        folderPath: '',
        mime: blob.type || 'application/octet-stream',
        size: blob.size,
        uploaded: false
      };
    }

    return null;
  }

  /**
   * Get all assets for the project - reads from Yjs, optionally with blobs
   * @param {Object} options
   * @param {boolean} options.includeBlobs - Include blobs from memory (default: true)
   * @returns {Promise<Array>}
   */
  async getProjectAssets(options = {}) {
    const { includeBlobs = true } = options;

    // Get metadata from Yjs (instant, synced)
    const metadataList = this.getAllAssetsMetadata();

    if (!includeBlobs) {
      // Return metadata only (fast path for File Manager UI)
      return metadataList.map(meta => ({
        ...meta,
        projectId: this.projectId,
        blob: null
      }));
    }

    Logger.log(`[AssetManager] getProjectAssets: ${metadataList.length} assets from Yjs`);

    // Count how many blobs are cached in memory
    let blobCount = 0;

    // Join metadata with blobs from memory (with Cache API fallback for static mode)
    const assets = await Promise.all(metadataList.map(async meta => {
      const blob = await this.getBlob(meta.id);
      if (blob) blobCount++;
      return {
        ...meta,
        projectId: this.projectId,
        blob: blob || null
      };
    }));

    Logger.log(`[AssetManager] getProjectAssets: ${assets.length} assets (${blobCount} blobs in memory)`);
    return assets;
  }

  /**
   * Get ALL blobs from memory.
   * Used for debugging.
   * @returns {Promise<Array>}
   */
  async getAllBlobsRaw() {
    const blobs = [];
    for (const [id, blob] of this.blobCache.entries()) {
      blobs.push({ id, projectId: this.projectId, blob });
    }
    Logger.log(`[AssetManager] getAllBlobsRaw: Found ${blobs.length} total blobs in memory`);
    return blobs;
  }

  /**
   * @deprecated Use getAllBlobsRaw() instead
   */
  async getAllAssetsRaw() {
    return this.getAllBlobsRaw();
  }

  // =========================================================================
  // Folder Operations (for File Manager)
  // Now use Yjs metadata for instant sync - no blobs needed for folder ops
  // =========================================================================

  /**
   * Get assets in a specific folder (non-recursive)
   * @param {string} folderPath - Folder path ('' for root)
   * @returns {Promise<Array>}
   */
  async getAssetsInFolder(folderPath = '') {
    // Use metadata-only for fast folder browsing
    const assets = await this.getProjectAssets({ includeBlobs: false });
    return assets.filter(a => (a.folderPath || '') === folderPath);
  }

  /**
   * Get unique subfolders at a given path
   * @param {string} parentPath - Parent folder path ('' for root)
   * @returns {Promise<string[]>} Array of subfolder names (not full paths)
   */
  async getSubfolders(parentPath = '') {
    // Use metadata-only for fast folder browsing
    const assets = await this.getProjectAssets({ includeBlobs: false });
    const subfolders = new Set();
    const prefix = parentPath ? parentPath + '/' : '';

    for (const asset of assets) {
      const assetPath = asset.folderPath || '';
      if (!assetPath.startsWith(prefix)) continue;

      const remainingPath = assetPath.slice(prefix.length);
      if (!remainingPath) continue;

      const firstSegment = remainingPath.split('/')[0];
      if (firstSegment) {
        subfolders.add(firstSegment);
      }
    }

    return Array.from(subfolders).sort();
  }

  /**
   * Update an asset's folder path (move to different folder)
   * Updates Yjs metadata directly for instant sync
   * @param {string} assetId - Asset UUID
   * @param {string} newFolderPath - New folder path
   * @returns {Promise<boolean>} True if updated
   */
  async updateAssetFolderPath(assetId, newFolderPath) {
    const metadata = this.getAssetMetadata(assetId);
    if (!metadata) {
      return false;
    }

    // Update metadata in Yjs (instant sync to other clients)
    this.setAssetMetadata(assetId, {
      ...metadata,
      folderPath: newFolderPath,
      uploaded: false // Mark as needing re-upload
    });

    Logger.log(`[AssetManager] Moved asset ${assetId} to folder: ${newFolderPath}`);
    return true;
  }

  /**
   * Rename a folder (update all assets with that folder prefix)
   * Updates Yjs metadata directly for instant sync
   * @param {string} oldPath - Old folder path
   * @param {string} newPath - New folder path
   * @returns {Promise<number>} Number of assets updated
   */
  async renameFolder(oldPath, newPath) {
    if (!oldPath) throw new Error('Cannot rename root folder');

    const assetsMap = this.getAssetsYMap();
    if (!assetsMap) {
      throw new Error('Yjs bridge not available');
    }

    let count = 0;

    // Update in a Yjs transaction for batching
    assetsMap.doc?.transact(() => {
      assetsMap.forEach((meta, assetId) => {
        const assetPath = meta.folderPath || '';
        if (assetPath === oldPath || assetPath.startsWith(oldPath + '/')) {
          // Replace the old prefix with new prefix
          const newFolderPath = assetPath === oldPath
            ? newPath
            : newPath + assetPath.slice(oldPath.length);

          assetsMap.set(assetId, {
            ...meta,
            folderPath: newFolderPath,
            uploaded: false // Mark as needing re-upload
          });
          count++;
        }
      });
    });

    Logger.log(`[AssetManager] Renamed folder ${oldPath} → ${newPath}, updated ${count} assets via Yjs`);

    // No need to broadcast via WebSocket - Yjs handles sync automatically!
    return count;
  }

  /**
   * Delete all assets in a folder recursively
   * @param {string} folderPath - Folder path to delete
   * @returns {Promise<number>} Number of assets deleted
   */
  async deleteFolderContents(folderPath) {
    if (!folderPath) throw new Error('Cannot delete root folder contents');

    const assetsMap = this.getAssetsYMap();
    if (!assetsMap) {
      throw new Error('Yjs bridge not available');
    }

    const toDelete = [];

    // Find assets to delete
    assetsMap.forEach((meta, assetId) => {
      const assetPath = meta.folderPath || '';
      if (assetPath === folderPath || assetPath.startsWith(folderPath + '/')) {
        toDelete.push(assetId);
      }
    });

    // Delete assets locally (skip individual server deletes - we'll do bulk)
    for (const assetId of toDelete) {
      await this.deleteAsset(assetId, { skipServerDelete: true });
    }

    // Bulk delete from server (single HTTP request for efficiency)
    if (toDelete.length > 0) {
      this._deleteMultipleFromServer(toDelete).catch(() => {}); // Fire-and-forget
    }

    Logger.log(`[AssetManager] Deleted folder ${folderPath}, removed ${toDelete.length} assets`);
    return toDelete.length;
  }

  /**
   * Move a folder to a new location
   * Updates Yjs metadata directly for instant sync
   * @param {string} folderPath - Current folder path
   * @param {string} destination - Destination parent path (empty for root)
   * @returns {Promise<number>} Number of assets updated
   */
  async moveFolder(folderPath, destination) {
    if (!folderPath) throw new Error('Cannot move root folder');

    const assetsMap = this.getAssetsYMap();
    if (!assetsMap) {
      throw new Error('Yjs bridge not available');
    }

    // Get folder name
    const folderName = folderPath.split('/').pop();

    // Build new path
    const newPath = destination ? `${destination}/${folderName}` : folderName;

    // If moving to same location, nothing to do
    if (folderPath === newPath) {
      return 0;
    }

    // Prevent moving into itself or a subfolder of itself
    if (newPath.startsWith(folderPath + '/')) {
      throw new Error('Cannot move folder into itself');
    }

    let count = 0;

    // Update in a Yjs transaction for batching
    assetsMap.doc?.transact(() => {
      assetsMap.forEach((meta, assetId) => {
        const assetPath = meta.folderPath || '';
        if (assetPath === folderPath || assetPath.startsWith(folderPath + '/')) {
          // Replace old prefix with new prefix
          const newFolderPath = assetPath === folderPath
            ? newPath
            : newPath + assetPath.slice(folderPath.length);

          assetsMap.set(assetId, {
            ...meta,
            folderPath: newFolderPath,
            uploaded: false // Mark as needing re-upload
          });
          count++;
        }
      });
    });

    Logger.log(`[AssetManager] Moved folder ${folderPath} → ${newPath}, updated ${count} assets via Yjs`);
    return count;
  }

  /**
   * @deprecated Kept for backward compatibility - moveFolder now uses Yjs
   */
  async _moveFolderLegacy(folderPath, destination) {
    // This was the old implementation using getProjectAssets
    const assets = await this.getProjectAssets();
    let count = 0;

    for (const asset of assets) {
      const assetPath = asset.folderPath || '';
      if (assetPath === folderPath || assetPath.startsWith(folderPath + '/')) {
        // Replace old prefix with new prefix
        asset.folderPath = assetPath === folderPath
          ? newPath
          : newPath + assetPath.slice(folderPath.length);
        asset.uploaded = false; // Mark as needing re-upload
        await this.putAsset(asset);
        count++;
      }
    }

    Logger.log(`[AssetManager] Moved folder ${folderPath} → ${newPath}, updated ${count} assets`);
    return count;
  }

  /**
   * Extract folderPath from an imported asset path
   * Handles various path formats:
   * - "mywebsite/css/style.css" → "mywebsite/css" (folder structure)
   * - "content/resources/mywebsite/css/style.css" → "mywebsite/css" (with prefix)
   * - "uuid/image.jpg" or "content/resources/uuid/image.jpg" → "" (legacy format, UUID folder)
   *
   * @param {string} path - Asset path from ZIP
   * @param {string} assetId - The asset's UUID
   * @returns {string} Folder path, or empty string if asset should be in root
   * @private
   */
  _extractFolderPathFromImport(path, assetId) {
    // Remove common prefixes
    let cleanPath = path;
    if (cleanPath.startsWith('content/resources/')) {
      cleanPath = cleanPath.slice('content/resources/'.length);
    } else if (cleanPath.startsWith('resources/')) {
      cleanPath = cleanPath.slice('resources/'.length);
    }

    // Split into parts
    const parts = cleanPath.split('/');

    // Remove the filename (last part)
    parts.pop();

    // If no parts left, it's at root
    if (parts.length === 0) {
      return '';
    }

    // Check if the first part is a UUID (legacy format: uuid/filename)
    // A UUID looks like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx or shorter 8+ char hex
    const firstPart = parts[0];
    const isUuidLike = /^[a-f0-9-]{8,}$/i.test(firstPart);

    // If first part is UUID-like AND it's the only part, it's legacy format (uuid/file.jpg)
    if (isUuidLike && parts.length === 1) {
      // Check if it matches the asset's UUID (meaning it's just uuid/filename)
      if (firstPart === assetId || firstPart.startsWith(assetId.split('-')[0])) {
        return ''; // Legacy format - treat as root
      }
    }

    // If first part is UUID-like but there are more parts (uuid/folder/file.jpg)
    // This is a legacy format where the UUID was the top folder
    if (isUuidLike && parts.length > 1) {
      // Skip the UUID, use rest as folder path
      return parts.slice(1).join('/');
    }

    // Normal folder structure (folder/subfolder/file.jpg)
    return parts.join('/');
  }

  /**
   * Rename an asset's filename
   * @param {string} assetId - Asset UUID
   * @param {string} newFilename - New filename
   * @returns {Promise<boolean>} True if updated
   */
  async renameAsset(assetId, newFilename) {
    const metadata = this.getAssetMetadata(assetId);
    if (!metadata) {
      return false;
    }

    const oldFilename = metadata.filename;

    // Update metadata in Yjs (instant sync to other clients)
    this.setAssetMetadata(assetId, {
      ...metadata,
      filename: newFilename,
      uploaded: false // Mark as needing re-upload
    });

    Logger.log(`[AssetManager] Renamed asset ${assetId} to: ${newFilename} via Yjs`);

    // No need for WebSocket broadcast - Yjs handles sync automatically!

    // Update asset:// references in Y.Doc (will sync via Yjs to other clients)
    // Note: With new asset://uuid.ext format, references don't include filename
    // So this is now mostly for legacy format compatibility
    this.updateAssetReferencesInYjs(assetId, oldFilename, newFilename);

    return true;
  }

  /**
   * Update asset:// references in Y.Doc when an asset is renamed
   * This updates all htmlContent fields that contain references to this asset
   * @param {string} assetId - Asset UUID
   * @param {string} oldFilename - Previous filename
   * @param {string} newFilename - New filename
   * @returns {number} Number of components updated
   */
  updateAssetReferencesInYjs(assetId, oldFilename, newFilename) {
    const bridge = window.eXeLearning?.app?.project?._yjsBridge;
    if (!bridge?.documentManager) {
      Logger.log('[AssetManager] Cannot update Y.Doc references: no document manager');
      return 0;
    }

    const Y = window.Y;
    if (!Y) {
      Logger.log('[AssetManager] Cannot update Y.Doc references: Yjs not loaded');
      return 0;
    }
    const navigation = bridge.documentManager.getNavigation();
    if (!navigation) {
      Logger.log('[AssetManager] Cannot update Y.Doc references: no navigation');
      return 0;
    }

    // Build the old and new reference patterns using getAssetUrl
    // Format: asset://uuid.ext - no filename in URL, so rename doesn't affect references
    const oldRef = this.getAssetUrl(assetId, oldFilename);
    const newRef = this.getAssetUrl(assetId, newFilename);

    let updatedCount = 0;

    // Use a transaction to batch all updates
    bridge.documentManager.getDoc().transact(() => {
      // Helper function to process a component's htmlContent
      const processComponent = (compMap) => {
        if (!compMap || !(compMap instanceof Y.Map)) return;

        const htmlContent = compMap.get('htmlContent');
        if (!htmlContent) return;

        // Get current content as string
        let content = '';
        if (htmlContent instanceof Y.Text) {
          content = htmlContent.toString();
        } else if (typeof htmlContent === 'string') {
          content = htmlContent;
        }

        if (!content) return;

        // Check if this content contains the old reference
        if (!content.includes(oldRef)) {
          return;
        }

        // Replace all occurrences
        const newContent = content.split(oldRef).join(newRef);

        // Update the Y.Text
        if (htmlContent instanceof Y.Text) {
          htmlContent.delete(0, htmlContent.length);
          htmlContent.insert(0, newContent);
          updatedCount++;
          Logger.log(`[AssetManager] Updated asset reference in component`);
        }
      };

      // Helper to recursively process pages (including subpages)
      const processPage = (pageMap) => {
        if (!pageMap || !(pageMap instanceof Y.Map)) return;

        const blocks = pageMap.get('blocks');
        if (blocks instanceof Y.Array) {
          blocks.forEach((blockMap) => {
            if (!(blockMap instanceof Y.Map)) return;

            const components = blockMap.get('components');
            if (components instanceof Y.Array) {
              components.forEach((compMap) => {
                processComponent(compMap);
              });
            }
          });
        }

        // Process subpages if any
        const subpages = pageMap.get('subpages');
        if (subpages instanceof Y.Array) {
          subpages.forEach((subpageMap) => {
            processPage(subpageMap);
          });
        }
      };

      // Iterate over all pages in navigation
      navigation.forEach((pageMap) => {
        processPage(pageMap);
      });
    });

    if (updatedCount > 0) {
      Logger.log(`[AssetManager] Updated ${updatedCount} asset references in Y.Doc`);
    }

    return updatedCount;
  }

  // =========================================================================
  // HTML Asset Resolution (for iframe preview with relative URLs)
  // =========================================================================

  /**
   * Normalize a relative path against a base folder
   * Handles: ./path, ../path, and bare paths
   *
   * @param {string} baseFolder - Base folder path (e.g., "mywebsite")
   * @param {string} relativePath - Relative path (e.g., "./libs/jquery.min.js")
   * @returns {string} Normalized full path
   * @private
   */
  _normalizeRelativePath(baseFolder, relativePath) {
    // Skip absolute URLs and data URLs
    if (/^(https?:|data:|blob:|asset:|\/\/)/i.test(relativePath)) {
      return relativePath;
    }

    // Remove leading ./ if present
    let cleanPath = relativePath.replace(/^\.\//, '');

    // Combine with base folder
    let fullPath = baseFolder ? `${baseFolder}/${cleanPath}` : cleanPath;

    // Handle ../ by resolving path segments
    const segments = fullPath.split('/');
    const resolved = [];

    for (const segment of segments) {
      if (segment === '..') {
        // Go up one level (remove last segment)
        if (resolved.length > 0) {
          resolved.pop();
        }
      } else if (segment !== '.' && segment !== '') {
        resolved.push(segment);
      }
    }

    return resolved.join('/');
  }

  /**
   * Find asset by relative path within folder structure
   *
   * @param {string} baseFolder - Base folder path (e.g., "mywebsite")
   * @param {string} relativePath - Relative path (e.g., "./libs/jquery.min.js")
   * @returns {Object|null} Asset metadata with id, or null if not found
   */
  findAssetByRelativePath(baseFolder, relativePath) {
    // Skip absolute URLs and data URLs
    if (/^(https?:|data:|blob:|asset:|\/\/)/i.test(relativePath)) {
      return null;
    }

    const normalizedPath = this._normalizeRelativePath(baseFolder, relativePath);
    const assetsMap = this.getAssetsYMap();
    if (!assetsMap) return null;

    for (const [id, meta] of assetsMap.entries()) {
      // Build full path for comparison
      const assetFullPath = meta.folderPath
        ? `${meta.folderPath}/${meta.filename}`
        : meta.filename;

      if (assetFullPath === normalizedPath) {
        return { id, ...meta };
      }
    }

    return null;
  }

  /**
   * Check if a MIME type or filename indicates HTML content
   * @param {string} mimeType - MIME type
   * @param {string} filename - Filename
   * @returns {boolean} True if HTML
   * @private
   */
  _isHtmlAsset(mimeType, filename) {
    if (mimeType === 'text/html') return true;
    if (filename) {
      const ext = filename.toLowerCase().split('.').pop();
      return ext === 'html' || ext === 'htm';
    }
    return false;
  }

  /**
   * @private
   */
  static IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif', 'tiff', 'tif']);

  /**
   * Check if a MIME type or filename indicates an image
   * @param {string} mimeType - MIME type
   * @param {string} filename - Filename
   * @returns {boolean} True if image
   * @private
   */
  _isImageAsset(mimeType, filename) {
    if (mimeType && mimeType.startsWith('image/')) return true;
    if (filename) {
      const ext = filename.toLowerCase().split('.').pop();
      return AssetManager.IMAGE_EXTENSIONS.has(ext);
    }
    return false;
  }

  /**
   * Resolve an HTML asset with all its internal relative URLs converted to blob URLs
   *
   * This method:
   * 1. Fetches the HTML content from the asset
   * 2. Parses it and finds all relative URLs (src, href)
   * 3. Resolves each to a blob URL
   * 4. Returns a new blob URL with the resolved HTML
   *
   * @param {string} assetId - HTML asset UUID
   * @returns {Promise<string>} Blob URL of resolved HTML
   */
  async resolveHtmlWithAssets(assetId) {
    // 1. Get HTML asset metadata
    const metadata = this.getAssetMetadata(assetId);
    if (!metadata) {
      Logger.log(`[AssetManager] resolveHtmlWithAssets: Asset ${assetId} not found`);
      return null;
    }

    // 2. Fetch HTML blob and read as text
    const blob = await this.getBlob(assetId);
    if (!blob) {
      Logger.log(`[AssetManager] resolveHtmlWithAssets: No blob for ${assetId}`);
      return null;
    }

    const htmlText = await blob.text();
    const baseFolder = metadata.folderPath || '';

    // 3. Parse HTML and collect all relative URLs
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Elements and attributes to process
    const urlAttributes = [
      { selector: '[src]', attr: 'src' },
      { selector: 'link[href]', attr: 'href' },
      { selector: 'a[href]', attr: 'href' },
    ];

    // Collect all relative URLs and their elements
    const urlsToResolve = [];

    for (const { selector, attr } of urlAttributes) {
      const elements = doc.querySelectorAll(selector);
      for (const el of elements) {
        const url = el.getAttribute(attr);
        if (url && !url.match(/^(https?:|data:|blob:|asset:|javascript:|#|\/\/)/i)) {
          urlsToResolve.push({ element: el, attr, url });
        }
      }
    }

    // Also handle inline style url() references
    const styleElements = doc.querySelectorAll('style');
    const inlineStyleElements = doc.querySelectorAll('[style]');

    // 4. Batch resolve all URLs
    const resolvedUrls = new Map();

    await Promise.all(
      urlsToResolve.map(async ({ url }) => {
        if (resolvedUrls.has(url)) return;

        const asset = this.findAssetByRelativePath(baseFolder, url);
        if (asset) {
          const blobUrl = await this.resolveAssetURL(`asset://${asset.id}`);
          if (blobUrl) {
            resolvedUrls.set(url, blobUrl);
          }
        }
      })
    );

    // 4.5 Process external CSS files BEFORE replacing URLs
    // This must happen BEFORE step 5 because once URLs are replaced with blob://,
    // we can't resolve relative url() references inside the CSS files.
    // External CSS files loaded via <link> can't resolve relative url() from blob:// URLs
    // So we fetch them, resolve internal URLs, and convert to inline <style>
    const processedCssLinks = new Set();
    for (const { element, attr, url } of urlsToResolve) {
      // Only process <link rel="stylesheet"> elements
      if (element.tagName !== 'LINK' || attr !== 'href') continue;
      if (element.getAttribute('rel') !== 'stylesheet') continue;
      if (!url.match(/\.css$/i)) continue;

      const cssAsset = this.findAssetByRelativePath(baseFolder, url);
      if (!cssAsset) continue;

      try {
        // Get CSS content
        const cssBlob = await this.getBlob(cssAsset.id);
        if (!cssBlob) continue;

        const cssText = await cssBlob.text();

        // Calculate the CSS file's folder for resolving its internal relative URLs
        const cssFolder = cssAsset.folderPath || '';

        // Resolve url() references in the CSS content
        const resolvedCss = await this._resolveUrlsInCss(cssText, cssFolder, new Map());

        // Replace <link> with <style> containing resolved CSS
        const styleEl = doc.createElement('style');
        styleEl.textContent = resolvedCss;
        // Copy media attribute if present
        const media = element.getAttribute('media');
        if (media) styleEl.setAttribute('media', media);
        element.parentNode.replaceChild(styleEl, element);
        processedCssLinks.add(element);
      } catch (e) {
        Logger.log(`[AssetManager] resolveHtmlWithAssets: Error processing CSS ${url}: ${e.message}`);
        // Keep original link on error - will be resolved to blob URL in step 5
      }
    }

    // 5. Replace URLs in the document (skip processed CSS links and HTML anchor links)
    for (const { element, attr, url } of urlsToResolve) {
      // Skip CSS links that were already converted to inline <style>
      if (processedCssLinks.has(element)) continue;

      // Skip <a href> links to HTML files - let the link handler manage navigation
      // This allows the injected script to intercept clicks and use postMessage
      if (element.tagName === 'A' && attr === 'href' && url.match(/\.html?$/i)) {
        continue;
      }

      const blobUrl = resolvedUrls.get(url);
      if (blobUrl) {
        element.setAttribute(attr, blobUrl);
      }
    }

    // 5.5 Add target="_blank" to external links
    const externalLinks = doc.querySelectorAll('a[href^="http://"], a[href^="https://"]');
    for (const link of externalLinks) {
      if (!link.getAttribute('target')) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    }

    // Process inline styles with url() references
    for (const styleEl of styleElements) {
      styleEl.textContent = await this._resolveUrlsInCss(styleEl.textContent, baseFolder, resolvedUrls);
    }

    for (const el of inlineStyleElements) {
      const style = el.getAttribute('style');
      if (style && style.includes('url(')) {
        el.setAttribute('style', await this._resolveUrlsInCss(style, baseFolder, resolvedUrls));
      }
    }

    // 6. Inject link handler script for internal navigation
    const linkHandlerScript = this._generateLinkHandlerScript(assetId, baseFolder);
    const bodyEl = doc.body;
    if (bodyEl) {
      // Insert script before </body>
      const scriptContainer = doc.createElement('div');
      scriptContainer.innerHTML = linkHandlerScript;
      const scriptEl = scriptContainer.querySelector('script');
      if (scriptEl) {
        bodyEl.appendChild(scriptEl);
      }
    }

    // 7. Create new blob with resolved HTML (preserving DOCTYPE)
    // DOMParser loses the DOCTYPE when we get outerHTML, so we need to add it back
    let resolvedHtml = '';
    if (doc.doctype) {
      resolvedHtml = new XMLSerializer().serializeToString(doc.doctype) + '\n';
    } else {
      // Default to HTML5 DOCTYPE if original didn't have one
      resolvedHtml = '<!DOCTYPE html>\n';
    }
    resolvedHtml += doc.documentElement.outerHTML;
    const resolvedBlob = new Blob([resolvedHtml], { type: 'text/html' });
    const resolvedBlobUrl = URL.createObjectURL(resolvedBlob);

    Logger.log(`[AssetManager] resolveHtmlWithAssets: Resolved ${resolvedUrls.size} URLs for ${assetId}`);

    return resolvedBlobUrl;
  }

  /**
   * Resolve HTML asset with all internal assets as DATA URLs (for standalone/export use).
   *
   * Similar to resolveHtmlWithAssets but returns HTML string with data URLs instead of blob URLs.
   * This is needed for standalone preview (open in new tab) where the page must work
   * independently without access to the parent window or IndexedDB.
   *
   * @param {string} assetId - HTML asset UUID
   * @param {Set<string>} [resolvedHtmlAssetsSet] - Set of already-resolved HTML asset IDs (for recursive calls to avoid infinite loops)
   * @returns {Promise<string|null>} Resolved HTML string with data URLs
   */
  async resolveHtmlWithAssetsAsDataUrls(assetId, resolvedHtmlAssetsSet) {
    // 1. Get HTML asset metadata
    const metadata = this.getAssetMetadata(assetId);
    if (!metadata) {
      Logger.log(`[AssetManager] resolveHtmlWithAssetsAsDataUrls: Asset ${assetId} not found`);
      return null;
    }

    // 2. Fetch HTML blob and read as text
    const blob = await this.getBlob(assetId);
    if (!blob) {
      Logger.log(`[AssetManager] resolveHtmlWithAssetsAsDataUrls: No blob for ${assetId}`);
      return null;
    }

    const htmlText = await blob.text();
    const baseFolder = metadata.folderPath || '';

    // 3. Parse HTML and collect all relative URLs
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Elements and attributes to process
    const urlAttributes = [
      { selector: '[src]', attr: 'src' },
      { selector: 'link[href]', attr: 'href' },
      { selector: 'a[href]', attr: 'href' },
    ];

    // Collect all relative URLs and their elements
    const urlsToResolve = [];

    for (const { selector, attr } of urlAttributes) {
      const elements = doc.querySelectorAll(selector);
      for (const el of elements) {
        const url = el.getAttribute(attr);
        if (url && !url.match(/^(https?:|data:|blob:|asset:|javascript:|#|\/\/)/i)) {
          urlsToResolve.push({ element: el, attr, url });
        }
      }
    }

    // Also handle inline style url() references
    const styleElements = doc.querySelectorAll('style');
    const inlineStyleElements = doc.querySelectorAll('[style]');

    // 4. Batch resolve all URLs to DATA URLs (for non-HTML assets)
    // For HTML links, we store the resolved content in a map and inject a navigation handler
    // (to avoid Chrome's 2MB limit on data URLs in href attributes)
    //
    // Track resolved HTML assets to avoid infinite loops (for circular references)
    const resolvedHtmlAssets = resolvedHtmlAssetsSet || new Set();
    resolvedHtmlAssets.add(assetId); // Mark current asset as being processed

    const resolvedUrls = new Map();
    const resolvedHtmlPages = new Map(); // Map<relativeUrl, resolvedHtmlContent>

    await Promise.all(
      urlsToResolve.map(async ({ url }) => {
        if (resolvedUrls.has(url) || resolvedHtmlPages.has(url)) return;

        const asset = this.findAssetByRelativePath(baseFolder, url);
        if (asset) {
          // Check if this is an HTML file that needs recursive resolution
          const assetMeta = this.getAssetMetadata(asset.id);
          const isHtmlLink = assetMeta && this._isHtmlAsset(assetMeta.mime, assetMeta.filename);

          if (isHtmlLink && !resolvedHtmlAssets.has(asset.id)) {
            // Recursively resolve HTML with all its assets
            // Store as HTML content (not data URL) to avoid Chrome's 2MB limit
            const resolvedHtml = await this.resolveHtmlWithAssetsAsDataUrls(asset.id, resolvedHtmlAssets);
            if (resolvedHtml) {
              resolvedHtmlPages.set(url, resolvedHtml);
            }
          } else {
            // Non-HTML asset or already processed HTML - use simple data URL
            const dataUrl = await this._getAssetAsDataUrl(asset.id);
            if (dataUrl) {
              resolvedUrls.set(url, dataUrl);
            }
          }
        }
      })
    );

    // 4.5 Process external CSS files - convert to inline <style> with data URLs
    const processedCssLinks = new Set();
    for (const { element, attr, url } of urlsToResolve) {
      if (element.tagName !== 'LINK' || attr !== 'href') continue;
      if (element.getAttribute('rel') !== 'stylesheet') continue;
      if (!url.match(/\.css$/i)) continue;

      const cssAsset = this.findAssetByRelativePath(baseFolder, url);
      if (!cssAsset) continue;

      try {
        const cssBlob = await this.getBlob(cssAsset.id);
        if (!cssBlob) continue;

        const cssText = await cssBlob.text();
        const cssFolder = cssAsset.folderPath || '';

        // Resolve url() references using data URLs
        const resolvedCss = await this._resolveUrlsInCssAsDataUrls(cssText, cssFolder);

        const styleEl = doc.createElement('style');
        styleEl.textContent = resolvedCss;
        const media = element.getAttribute('media');
        if (media) styleEl.setAttribute('media', media);
        element.parentNode.replaceChild(styleEl, element);
        processedCssLinks.add(element);
      } catch (e) {
        Logger.log(`[AssetManager] resolveHtmlWithAssetsAsDataUrls: Error processing CSS ${url}: ${e.message}`);
      }
    }

    // 5. Replace URLs in the document
    // For HTML links, mark them with data-exe-nav attribute (will be handled by injected script)
    // For other assets, use data URLs directly
    const htmlNavPages = []; // Array of {index, url, content} for the navigation handler

    for (const { element, attr, url } of urlsToResolve) {
      if (processedCssLinks.has(element)) continue;

      // Check if this is an HTML link with pre-resolved content
      const htmlContent = resolvedHtmlPages.get(url);
      if (htmlContent && element.tagName === 'A' && attr === 'href') {
        // Store the page content and set up navigation marker
        const pageIndex = htmlNavPages.length;
        htmlNavPages.push({ index: pageIndex, url, content: htmlContent });

        // Set href to a special navigation marker
        element.setAttribute('href', `#exe-nav-${pageIndex}`);
        element.setAttribute('data-exe-nav', String(pageIndex));
        continue;
      }

      // For non-HTML assets, use data URLs directly
      const dataUrl = resolvedUrls.get(url);
      if (dataUrl) {
        element.setAttribute(attr, dataUrl);
      }
    }

    // 5.5 Add target="_blank" to external links
    const externalLinks = doc.querySelectorAll('a[href^="http://"], a[href^="https://"]');
    for (const link of externalLinks) {
      if (!link.getAttribute('target')) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    }

    // Process inline styles with url() references (using data URLs)
    for (const styleEl of styleElements) {
      styleEl.textContent = await this._resolveUrlsInCssAsDataUrls(styleEl.textContent, baseFolder);
    }

    for (const el of inlineStyleElements) {
      const style = el.getAttribute('style');
      if (style && style.includes('url(')) {
        el.setAttribute('style', await this._resolveUrlsInCssAsDataUrls(style, baseFolder));
      }
    }

    // 6. Return resolved HTML string with DOCTYPE preserved
    // DOMParser loses the DOCTYPE when we get outerHTML, so we need to add it back
    let resolvedHtml = '';
    if (doc.doctype) {
      resolvedHtml = new XMLSerializer().serializeToString(doc.doctype) + '\n';
    } else {
      // Default to HTML5 DOCTYPE if original didn't have one
      resolvedHtml = '<!DOCTYPE html>\n';
    }
    resolvedHtml += doc.documentElement.outerHTML;

    // 7. Inject navigation handler script if there are HTML links
    // This script handles clicks on internal HTML links by replacing the document content
    // with the pre-resolved HTML (avoiding Chrome's 2MB data URL limit)
    if (htmlNavPages.length > 0) {
      resolvedHtml = this._injectStandaloneNavigationHandler(resolvedHtml, htmlNavPages);
    }

    Logger.log(`[AssetManager] resolveHtmlWithAssetsAsDataUrls: Resolved ${resolvedUrls.size} URLs, ${htmlNavPages.length} HTML pages for ${assetId}`);

    return resolvedHtml;
  }

  /**
   * Get an asset as a data URL
   * @param {string} assetId - Asset UUID
   * @returns {Promise<string|null>} Data URL or null
   * @private
   */
  async _getAssetAsDataUrl(assetId) {
    const blob = await this.getBlob(assetId);
    if (!blob) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Resolve url() references in CSS content to data URLs (for standalone/export use)
   * @param {string} cssText - CSS text content
   * @param {string} baseFolder - Base folder for resolution
   * @returns {Promise<string>} CSS with resolved data URLs
   * @private
   */
  async _resolveUrlsInCssAsDataUrls(cssText, baseFolder) {
    const urlPattern = /url\(["']?([^"')]+)["']?\)/g;
    let result = cssText;
    let match;

    // Collect all matches first (to avoid issues with lastIndex during replacement)
    const matches = [];
    while ((match = urlPattern.exec(cssText)) !== null) {
      matches.push({ fullMatch: match[0], url: match[1] });
    }

    for (const { fullMatch, url } of matches) {
      // Skip absolute URLs, data URLs, etc.
      if (url.match(/^(https?:|data:|blob:|asset:|\/\/)/i)) continue;

      const asset = this.findAssetByRelativePath(baseFolder, url);
      if (asset) {
        const dataUrl = await this._getAssetAsDataUrl(asset.id);
        if (dataUrl) {
          result = result.replace(fullMatch, `url("${dataUrl}")`);
        }
      }
    }

    return result;
  }

  /**
   * Generate a link handler script for HTML iframes to enable internal navigation
   * @param {string} assetId - Current HTML asset ID
   * @param {string} baseFolder - Base folder path for relative URL resolution
   * @returns {string} Script tag to inject into HTML
   * @private
   */
  _generateLinkHandlerScript(assetId, baseFolder) {
    // Escape special characters for safe embedding in script
    const escapedAssetId = assetId.replace(/'/g, "\\'");
    const escapedBaseFolder = baseFolder.replace(/'/g, "\\'");

    return `
<script>
(function() {
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href) return;

    // Skip external links, asset://, blob:// and data:// URLs
    if (/^(https?:|mailto:|javascript:|data:|asset:|blob:)/i.test(href)) return;

    // Handle anchor links within same page (scroll to element)
    if (href.charAt(0) === '#') {
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    // Handle relative HTML links - request parent to resolve
    e.preventDefault();
    window.parent.postMessage({
      type: 'exe-resolve-html-link',
      href: href,
      assetId: '${escapedAssetId}',
      baseFolder: '${escapedBaseFolder}'
    }, '*');
  });
})();
</script>`;
  }

  /**
   * Inject a standalone navigation handler for HTML pages.
   * Used in standalone preview (new tab) where the page must work independently.
   *
   * This stores pre-resolved HTML pages in a JavaScript variable and handles
   * navigation by replacing the entire document content when internal links are clicked.
   * This avoids Chrome's 2MB limit on data URLs in href attributes.
   *
   * @param {string} html - HTML content to inject script into
   * @param {Array<{index: number, url: string, content: string}>} htmlPages - Pre-resolved HTML pages
   * @returns {string} HTML with injected navigation handler
   * @private
   */
  _injectStandaloneNavigationHandler(html, htmlPages) {
    // Serialize pages as JSON for embedding in script
    // Use base64 encoding to avoid issues with quotes/escaping in HTML content
    const pagesData = htmlPages.map(p => ({
      index: p.index,
      url: p.url,
      // Base64 encode the content to avoid escaping issues
      contentBase64: btoa(unescape(encodeURIComponent(p.content)))
    }));

    const pagesJson = JSON.stringify(pagesData);

    const navScript = `
<script>
(function() {
  // Pre-resolved HTML pages (base64 encoded to avoid escaping issues)
  var exeNavPages = ${pagesJson};

  // Decode base64 content
  function decodeContent(base64) {
    return decodeURIComponent(escape(atob(base64)));
  }

  // Navigate to a pre-resolved page by replacing document content
  function navigateToPage(pageIndex) {
    var page = exeNavPages.find(function(p) { return p.index === pageIndex; });
    if (!page) {
      console.warn('[StandaloneNav] Page not found:', pageIndex);
      return false;
    }

    var content = decodeContent(page.contentBase64);
    console.log('[StandaloneNav] Navigating to:', page.url);

    // Replace the entire document with the new content
    // Using document.open/write/close to completely replace the page
    document.open();
    document.write(content);
    document.close();

    return true;
  }

  // Handle clicks on internal navigation links
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[data-exe-nav]');
    if (!link) return;

    var pageIndex = parseInt(link.getAttribute('data-exe-nav'), 10);
    if (isNaN(pageIndex)) return;

    e.preventDefault();
    e.stopPropagation();

    navigateToPage(pageIndex);
  });

  // Handle hash-based navigation (for back button support)
  window.addEventListener('hashchange', function() {
    var hash = window.location.hash;
    var match = hash.match(/^#exe-nav-(\\d+)$/);
    if (match) {
      var pageIndex = parseInt(match[1], 10);
      navigateToPage(pageIndex);
    }
  });

  console.log('[StandaloneNav] Navigation handler initialized with', exeNavPages.length, 'pages');
})();
</script>`;

    // Inject before </body> or at the end
    if (html.includes('</body>')) {
      return html.replace('</body>', navScript + '</body>');
    }
    return html + navScript;
  }

  /**
   * Resolve url() references in CSS content
   * @param {string} cssText - CSS text content
   * @param {string} baseFolder - Base folder for resolution
   * @param {Map} resolvedUrls - Map of already resolved URLs
   * @returns {Promise<string>} CSS with resolved URLs
   * @private
   */
  async _resolveUrlsInCss(cssText, baseFolder, resolvedUrls) {
    const urlPattern = /url\(["']?([^"')]+)["']?\)/g;
    let result = cssText;
    let match;

    while ((match = urlPattern.exec(cssText)) !== null) {
      const url = match[1];

      // Skip absolute URLs and data URLs
      if (url.match(/^(https?:|data:|blob:|asset:|\/\/)/i)) {
        continue;
      }

      let blobUrl = resolvedUrls.get(url);

      if (!blobUrl) {
        const asset = this.findAssetByRelativePath(baseFolder, url);
        if (asset) {
          blobUrl = await this.resolveAssetURL(`asset://${asset.id}`);
          if (blobUrl) {
            resolvedUrls.set(url, blobUrl);
          }
        }
      }

      if (blobUrl) {
        result = result.replace(match[0], `url("${blobUrl}")`);
      }
    }

    return result;
  }

  // =========================================================================
  // Hash and Deduplication
  // =========================================================================

  /**
   * Find asset by hash (for deduplication)
   * Uses Yjs metadata for fast lookup
   * @param {string} hash - SHA-256 hash
   * @returns {Promise<Object|null>}
   */
  async findByHash(hash) {
    // Search in Yjs metadata
    const assets = this.getAllAssetsMetadata();
    const match = assets.find(a => a.hash === hash);

    if (match) {
      // Get blob from memory if needed
      const blob = await this.getBlob(match.id);
      return {
        ...match,
        projectId: this.projectId,
        blob
      };
    }

    return null;
  }

  /**
   * Get metadata for assets pending upload (no blobs loaded).
   * Use this for quota checks and progress estimation without loading all blobs into memory.
   * @returns {Array} Array of metadata objects (without blob property)
   */
  getPendingAssetsMetadata() {
    const allMetadata = this.getAllAssetsMetadata();
    return allMetadata.filter(a => a.uploaded === false);
  }

  /**
   * Get assets pending upload with blobs loaded.
   * Loads blobs for ALL pending assets. For memory-efficient uploads,
   * prefer getPendingAssetsMetadata() + getPendingAssetsBatch().
   * @returns {Promise<Array>}
   */
  async getPendingAssets() {
    const pendingMetadata = this.getPendingAssetsMetadata();
    if (pendingMetadata.length === 0) return [];
    return this.getPendingAssetsBatch(pendingMetadata);
  }

  /**
   * Load blobs for a specific batch of asset IDs.
   * Used for memory-efficient streaming uploads — load blobs only when needed.
   * @param {Array<Object>} metadataList - Array of metadata objects (from getPendingAssetsMetadata)
   * @returns {Promise<Array>} Array of assets with blobs loaded
   */
  async getPendingAssetsBatch(metadataList, options = {}) {
    const { restoreToMemory = true } = options;
    const assets = [];
    for (const meta of metadataList) {
      const blob = await this.getBlob(meta.id, { restoreToMemory });
      if (blob) {
        assets.push({
          ...meta,
          projectId: this.projectId,
          blob
        });
      } else {
        Logger.log(`[AssetManager] Pending asset ${meta.id.substring(0, 8)}... has no local blob (batch)`);
      }
    }
    return assets;
  }

  /**
   * Mark asset as uploaded in Yjs metadata
   * @param {string} id - Asset UUID
   * @returns {Promise<void>}
   */
  async markAssetUploaded(id) {
    const metadata = this.getAssetMetadata(id);
    if (!metadata) {
      console.warn(`[AssetManager] Cannot mark asset ${id} as uploaded: not found in Yjs`);
      return;
    }

    // Update metadata in Yjs
    this.setAssetMetadata(id, {
      ...metadata,
      uploaded: true
    });

    // Release the raw in-memory blob after successful upload.
    // Local cached access is still preserved through Cache API / blob URLs
    // for post-save rendering, preview, and export in the current session.
    this.releaseUploadedBlob(id);

    Logger.log(`[AssetManager] Marked ${id.substring(0, 8)}... as uploaded via Yjs`);
  }

  /**
   * Release a blob from the in-memory blobCache after successful upload.
   * Keeps blobURLCache intact so existing blob:// URLs in the editor remain valid.
   * Cache API entry is intentionally preserved — getBlob() needs it as fallback
   * for post-save operations (export, preview, re-rendering).
   * Cache API is cleaned up on project close via cleanup().
   * @param {string} id - Asset UUID
   */
  releaseUploadedBlob(id) {
    if (this.blobCache.has(id)) {
      this.blobCache.delete(id);
      Logger.log(`[AssetManager] Released blob from memory for ${id.substring(0, 8)}...`);
    }
  }

  /**
   * Insert image file
   *
   * Flow:
   * 1. Read file as blob
   * 2. Calculate SHA-256 hash
   * 3. Generate deterministic ID from hash (content-addressable)
   * 4. Check if already exists (same content = same ID)
   * 5. Store in memory with uploaded=false
   * 6. Return asset:// URL
   *
   * @param {File} file - Image file
   * @param {Object} [options] - Optional settings
   * @param {string} [options.folderPath=''] - Folder path for organizing assets
   * @param {boolean} [options.forceNewId=false] - Force a new random ID (for duplicates)
   * @returns {Promise<string>} asset:// URL
   */
  async insertImage(file, options = {}) {
    const folderPath = options.folderPath || '';
    const forceNewId = options.forceNewId || false;
    Logger.log(`[AssetManager] Inserting image: ${file.name} (${file.size} bytes, ${file.type})${folderPath ? ` in folder: ${folderPath}` : ''}${forceNewId ? ' (forceNewId)' : ''}`);
    Logger.log(`[AssetManager] Current projectId: ${this.projectId}`);

    // 1. Create blob
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });

    // 2. Calculate hash
    const hash = await this.calculateHash(blob);
    Logger.log(`[AssetManager] Hash: ${hash.substring(0, 16)}...`);

    // 3. Generate ID - random for duplicates, content-addressable otherwise
    const assetId = forceNewId ? crypto.randomUUID() : this.hashToUUID(hash);
    Logger.log(`[AssetManager] ${forceNewId ? 'Random' : 'Content-addressable'} ID: ${assetId}`);

    // 4. Check if already exists (same content = same ID) - skip for forceNewId
    const existing = forceNewId ? null : await this.getAsset(assetId);
    if (existing) {
      // Check if blob ACTUALLY belongs to current project (not just metadata)
      // getAsset() always returns projectId: this.projectId, so we need to check the raw record
      const blobRecord = await this.getBlobRecord(assetId);
      const blobIsForCurrentProject = blobRecord && blobRecord.projectId === this.projectId;

      if (blobIsForCurrentProject && existing.blob) {
        // Asset with blob exists for THIS project - safe to skip
        // Ensure blob URL is in cache for immediate availability
        if (!this.blobURLCache.has(assetId)) {
          const blobUrl = URL.createObjectURL(existing.blob);
          this.blobURLCache.set(assetId, blobUrl);
          this.reverseBlobCache.set(blobUrl, assetId);
          Logger.log(`[AssetManager] Cached existing blob URL for ${assetId}`);
        }
        // Update folder path if needed
        if (folderPath && existing.folderPath !== folderPath) {
          existing.folderPath = folderPath;
          await this.putAsset(existing);
          Logger.log(`[AssetManager] Updated folderPath for existing asset: ${assetId}`);
        }
        Logger.log(`[AssetManager] Asset already exists for this project: ${assetId}`);
        return this.getAssetUrl(assetId, existing.filename || file.name);
      }

      // Asset exists but blob is NOT for current project (or no blob at all)
      // Store blob for current project (putAsset will overwrite with new projectId)
      Logger.log(`[AssetManager] Storing blob for current project: ${assetId.substring(0, 8)}... (was: ${blobRecord?.projectId?.substring(0, 8) || 'none'})`);
      const newAsset = {
        id: assetId,
        projectId: this.projectId,
        blob: existing.blob || blob, // Use existing blob if available, else new blob
        mime: file.type || this.getMimeType(file.name),
        hash: hash,
        size: blob.size,
        uploaded: false,
        createdAt: new Date().toISOString(),
        filename: file.name,
        folderPath: folderPath || ''
      };
      await this.putAsset(newAsset);

      // Cache blob URL
      const blobUrl = URL.createObjectURL(newAsset.blob);
      this.blobURLCache.set(assetId, blobUrl);
      this.reverseBlobCache.set(blobUrl, assetId);

      // Announce to peers
      this._scheduleAssetAvailabilityAnnouncement('insertImage:reused-asset');

      return this.getAssetUrl(assetId, file.name);
    }

    // 5. Create new asset
    const asset = {
      id: assetId,
      projectId: this.projectId,
      blob: blob,
      mime: file.type || this.getMimeType(file.name),
      hash: hash,
      size: blob.size,
      uploaded: false,
      createdAt: new Date().toISOString(),
      filename: file.name,
      folderPath: folderPath
    };

    await this.putAsset(asset);
    Logger.log(`[AssetManager] Stored new asset ${assetId}`);

    // 6. Add to blob URL cache immediately for instant availability
    const blobUrl = URL.createObjectURL(blob);
    this.blobURLCache.set(assetId, blobUrl);
    this.reverseBlobCache.set(blobUrl, assetId);
    Logger.log(`[AssetManager] Cached blob URL for ${assetId}`);

    // 7. Announce new asset to server so peers can request it
    // Use deferred call to keep insert flow responsive.
    this._scheduleAssetAvailabilityAnnouncement('insertImage:new-asset');

    // 8. Return asset:// URL with extension only (e.g., asset://uuid.jpg)
    return this.getAssetUrl(assetId, file.name);
  }

  /**
   * Extract asset ID from asset:// URL
   * Handles multiple formats:
   * - New format: asset://uuid.ext (e.g., asset://abc123.jpg)
   * - Legacy format: asset://uuid/path (e.g., asset://abc123/images/photo.jpg)
   * - Simple format: asset://uuid
   *
   * @param {string} assetUrl
   * @returns {string} Asset UUID
   */
  extractAssetId(assetUrl) {
    let path = assetUrl.replace('asset://', '');

    // Handle corrupted URLs like "asset//uuid/file.png" (double protocol, missing colon)
    // These can occur from buggy import code that double-prefixes asset URLs
    if (path.startsWith('asset//') || path.startsWith('asset/')) {
      // Extract UUID from corrupted path: skip the "asset/" or "asset//" prefix
      const match = path.match(/asset\/+([a-f0-9-]{36})/i);
      if (match) {
        console.warn(`[AssetManager] Sanitizing corrupted asset URL: asset://${path}`);
        return match[1];
      }
    }

    // Check for new format: uuid.ext (dot before slash means extension, not path)
    // UUID pattern: 36 chars with hyphens (e.g., abc12345-1234-1234-1234-123456789012)
    const uuidMatch = path.match(/^([a-f0-9-]{36})(?:\.[a-z0-9]+)?$/i);
    if (uuidMatch) {
      return uuidMatch[1];
    }

    // Legacy format: uuid/path - take first part before slash
    const slashIndex = path.indexOf('/');
    if (slashIndex > 0) {
      return path.substring(0, slashIndex);
    }

    // Simple format: just uuid (may include extension like uuid.jpg)
    const dotIndex = path.indexOf('.');
    return dotIndex > 0 ? path.substring(0, dotIndex) : path;
  }

  /**
   * Sanitize a potentially corrupted asset URL
   * Handles cases like "asset://asset//uuid/file.png" that occur from buggy imports
   * @param {string} assetUrl - Potentially corrupted asset URL
   * @returns {string} Sanitized asset URL or original if already valid
   */
  sanitizeAssetUrl(assetUrl) {
    if (!assetUrl || !assetUrl.startsWith('asset://')) {
      return assetUrl;
    }

    const path = assetUrl.replace('asset://', '');

    // Check for corrupted URLs with double protocol (asset://asset//...)
    if (path.startsWith('asset//') || path.startsWith('asset/')) {
      // Extract UUID and filename from corrupted path
      const match = path.match(/asset\/+([a-f0-9-]{36})(?:\/(.+))?/i);
      if (match) {
        const uuid = match[1];
        const filename = match[2] || '';
        // Use new simplified format: asset://uuid.ext
        const sanitized = this.getAssetUrl(uuid, filename);
        console.warn(`[AssetManager] Sanitized corrupted URL: ${assetUrl} -> ${sanitized}`);
        return sanitized;
      }
    }

    return assetUrl;
  }

  /**
   * Resolve asset:// URL to blob:// URL for display
   * @param {string} assetUrl - asset://uuid or asset://uuid/filename
   * @returns {Promise<string|null>} blob:// URL or null
   */
  async resolveAssetURL(assetUrl) {
    // Extract ID from asset://uuid or asset://uuid/filename
    const assetId = this.extractAssetId(assetUrl);
    if (!assetId) {
      console.warn('[AssetManager] Invalid asset URL:', assetUrl);
      return null;
    }

    // Check cache first (using synced method to ensure reverseBlobCache consistency)
    const cachedBlobUrl = this.getBlobURLSynced(assetId);
    if (cachedBlobUrl) {
      return cachedBlobUrl;
    }

    // Load from memory
    const asset = await this.getAsset(assetId);
    if (!asset) {
      console.warn(`[AssetManager] Asset not found: ${assetId}`);
      return null;
    }
    if (!asset.blob || typeof asset.blob.arrayBuffer !== 'function') {
      Logger.log(`[AssetManager] Asset ${assetId.substring(0, 8)}... has metadata but no local blob`);
      return null;
    }

    // Create blob URL (with fallback to data URL if blocked by extensions)
    const blobURL = await this.createBlobURL(asset.blob);

    // Cache both directions
    this.blobURLCache.set(assetId, blobURL);
    this.reverseBlobCache.set(blobURL, assetId);

    Logger.log(`[AssetManager] Resolved ${assetId.substring(0, 8)}... → blob URL`);
    return blobURL;
  }

  /**
   * Resolve asset:// URL synchronously (from cache only)
   * @param {string} assetUrl - asset://uuid or asset://uuid/filename
   * @returns {string|null} blob:// URL or null
   */
  resolveAssetURLSync(assetUrl) {
    const assetId = this.extractAssetId(assetUrl);
    return this.getBlobURLSynced(assetId) || null;
  }

  /**
   * Get blob URL from cache, ensuring reverseBlobCache is synced.
   * This is critical for convertBlobUrlsToAssetUrls to work correctly.
   * @param {string} assetId - Asset ID
   * @returns {string|undefined} Blob URL or undefined
   */
  getBlobURLSynced(assetId) {
    const blobUrl = this.blobURLCache.get(assetId);
    if (blobUrl && !this.reverseBlobCache.has(blobUrl)) {
      // Sync reverseBlobCache - ensures convertBlobUrlsToAssetUrls can find it
      this.reverseBlobCache.set(blobUrl, assetId);
      Logger.log(`[AssetManager] Synced reverseBlobCache for ${assetId.substring(0, 8)}...`);
    }
    return blobUrl;
  }

  /**
   * Resolve all asset:// URLs in HTML string
   * @param {string} html - HTML with asset:// references
   * @param {Object} options - Options
   * @param {AssetWebSocketHandler} options.wsHandler - WebSocket handler for fetching missing assets
   * @param {boolean} options.addTrackingAttrs - Add data-asset-id attributes for DOM updates
   * @returns {Promise<string>} HTML with blob:// URLs
   */
  async resolveHTMLAssets(html, options = {}) {
    if (!html) return html;

    const { wsHandler = null, addTrackingAttrs = false } = options;

    // Find all asset:// references
    // Supports formats:
    //   - asset://uuid (plain UUID)
    //   - asset://uuid.ext (new simplified format)
    //   - asset://uuid/path/file.ext (legacy format with path)
    //   - asset://asset//uuid/file (corrupted URLs from buggy imports)
    // NOTE: Filename part can contain spaces, so we match until quote character
    // Note: [^"'\\&] excludes quotes, backslash, AND ampersand to avoid matching:
    //   - JSON escape sequences (backslash)
    //   - HTML entities like &quot; in data-idevice-json-data attributes (ampersand)
    const assetRegex = /asset:\/\/(?:asset\/+)?([a-f0-9-]+)(?:\.[a-z0-9]+|\/[^"'\\&]+)?/gi;
    const matches = [...html.matchAll(assetRegex)];

    if (matches.length === 0) return html;

    Logger.log(`[AssetManager] Resolving ${matches.length} asset references`);

    // OPTIMIZATION: Resolve all assets IN PARALLEL instead of sequentially
    const resolutions = await Promise.all(
      matches.map(async (match) => {
        const assetUrl = match[0]; // Full URL: asset://uuid or asset://uuid/filename (possibly corrupted)
        const assetId = match[1];  // Just the UUID (extracted from possibly corrupted URL)
        const blobURL = await this.resolveAssetURL(assetUrl);
        return { assetUrl, assetId, blobURL };
      })
    );

    // Build replacement map and track missing assets
    const replacements = new Map();
    const placeholder = this.generatePlaceholder('Loading...', 'loading');
    const trackingAssetIds = new Set();

    for (const { assetUrl, assetId, blobURL } of resolutions) {
      if (blobURL) {
        replacements.set(assetUrl, blobURL);
      } else {
        // Asset not found - use loading placeholder
        replacements.set(assetUrl, placeholder);

        // Trigger background fetch if handler available
        if (wsHandler && !this.pendingFetches.has(assetId)) {
          this.pendingFetches.add(assetId);
          wsHandler.requestAsset(assetId).finally(() => {
            this.pendingFetches.delete(assetId);
          });
        }
      }

      // Collect asset IDs for tracking attributes
      if (addTrackingAttrs) {
        trackingAssetIds.add(assetId);
      }
    }

    // OPTIMIZATION: Single-pass replacement using regex instead of multiple split/join
    let resolvedHTML = html;
    if (replacements.size > 0) {
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        Array.from(replacements.keys()).map(escapeRegex).join('|'),
        'g'
      );
      resolvedHTML = resolvedHTML.replace(pattern, (match) => replacements.get(match) || match);
    }

    // Add tracking attributes for DOM updates (for img tags)
    if (addTrackingAttrs && trackingAssetIds.size > 0) {
      // Single regex to find all img tags and add data-asset-id if missing
      for (const assetId of trackingAssetIds) {
        const imgRegex = new RegExp(`<img([^>]*)(src=["'][^"']*${assetId}[^"']*["'])`, 'gi');
        resolvedHTML = resolvedHTML.replace(imgRegex, (fullMatch, before, srcAttr) => {
          // Check if already has data-asset-id
          if (before.includes('data-asset-id')) {
            return fullMatch;
          }
          return `<img${before}data-asset-id="${assetId}" ${srcAttr}`;
        });
      }
    }

    // Preserve data-asset-url for anchor elements linking to HTML assets
    // This allows the preview panel to detect HTML links and show a warning
    // Look for <a> tags with href pointing to blob:// URLs that were originally HTML assets
    for (const { assetUrl, blobURL } of resolutions) {
      if (!blobURL) continue;
      // Check if this was an HTML asset by looking at the original URL
      if (/\.html?$/i.test(assetUrl)) {
        // Find anchor elements with this blob URL and add data-asset-url if not present
        const escapedBlobUrl = blobURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match: <a ... href="blob:..." ...> but NOT already having data-asset-url
        const anchorRegex = new RegExp(
          `(<a\\s[^>]*href=["'])${escapedBlobUrl}(["'][^>]*)(>)`,
          'gi'
        );
        resolvedHTML = resolvedHTML.replace(anchorRegex, (fullMatch, before, afterHref, closeTag) => {
          // Check if already has data-asset-url
          if (fullMatch.includes('data-asset-url')) {
            return fullMatch;
          }
          // Add data-asset-url attribute before closing >
          return `${before}${blobURL}${afterHref} data-asset-url="${assetUrl}"${closeTag}`;
        });
      }
    }

    return resolvedHTML;
  }

  /**
   * Track assets that need to be fetched from server
   * @type {Set<string>}
   */
  missingAssets = new Set();

  /**
   * Track failed asset downloads to prevent infinite retry loops
   * Maps assetId -> { count: number, lastAttempt: number, permanent: boolean }
   * @type {Map<string, {count: number, lastAttempt: number, permanent: boolean}>}
   */
  failedAssets = new Map();

  /**
   * Maximum retry attempts for failed downloads
   */
  static MAX_DOWNLOAD_RETRIES = 3;

  /**
   * Minimum time between retry attempts (ms)
   */
  static RETRY_COOLDOWN = 30000; // 30 seconds

  /**
   * Resolve all asset:// URLs synchronously (from cache only)
   * If asset is missing, uses a placeholder and marks it for download
   * @param {string} html
   * @param {Object} options
   * @param {boolean} options.usePlaceholder - Use placeholder for missing (default true)
   * @param {boolean} options.addTracking - Add data-asset-id for DOM updates (default true)
   * @returns {string}
   */
  resolveHTMLAssetsSync(html, options = {}) {
    if (!html) return html;

    const { usePlaceholder = true, addTracking = true } = options;

    let resolvedHTML = html;

    // Phase 1: Handle <img> tags with asset:// src specially (to add correct tracking per asset)
    // This regex captures: beforeSrc, quote, full assetUrl, assetId, afterSrc
    // Also handles corrupted URLs like asset://asset//uuid/filename
    // Supports both formats: asset://uuid.ext (new) and asset://uuid/path (legacy)
    // Note: [^"'&] excludes ampersand for HTML entities in JSON data attributes
    const imgAssetRegex = /(<img[^>]*?)src=(["'])(asset:\/\/(?:asset\/+)?([a-f0-9-]+)(?:\.[a-z0-9]+)?(?:\/[^"'&]+)?)\2([^>]*>)/gi;

    resolvedHTML = resolvedHTML.replace(imgAssetRegex, (fullMatch, beforeSrc, quote, assetUrl, assetId, afterSrc) => {
      const blobURL = this.blobURLCache.get(assetId);

      if (blobURL) {
        // Asset available - just replace URL
        return `${beforeSrc}src=${quote}${blobURL}${quote}${afterSrc}`;
      }

      // Asset not in cache - mark as missing
      this.missingAssets.add(assetId);

      if (usePlaceholder) {
        const placeholder = this.generatePlaceholder('Loading...', 'loading');

        if (addTracking) {
          // Add tracking only if not already present
          const hasTracking = beforeSrc.includes('data-asset-id') || afterSrc.includes('data-asset-id');
          if (!hasTracking) {
            return `${beforeSrc}src=${quote}${placeholder}${quote} data-asset-id="${assetId}" data-asset-loading="true"${afterSrc}`;
          }
        }
        return `${beforeSrc}src=${quote}${placeholder}${quote}${afterSrc}`;
      }

      return fullMatch;
    });

    // Phase 1.5: Handle iframe HTML assets specially
    // HTML iframes need resolveHtmlWithAssets() to resolve internal CSS/JS/images.
    // Since this is a sync method and resolveHtmlWithAssets() is async, we mark them
    // with data-mce-html and keep the asset:// URL for MutationObserver to handle.
    // Pattern: <iframe ... src="asset://uuid.html" ...>
    const iframeHtmlRegex = /(<iframe[^>]*?)src=(["'])(asset:\/\/(?:asset\/+)?([a-f0-9-]+)(?:\.html?)(?:\/[^"'&]+)?)\2([^>]*>)/gi;

    resolvedHTML = resolvedHTML.replace(iframeHtmlRegex, (fullMatch, beforeSrc, quote, assetUrl, assetId, afterSrc) => {
      // Check if this is really an HTML asset
      const metadata = this.getAssetMetadata(assetId);
      const isHtml = metadata && this._isHtmlAsset(metadata.mime, metadata.filename);

      if (isHtml) {
        // Keep asset:// URL - MutationObserver in asset_url_resolver.js will handle it
        // Add data-mce-html attribute to signal it's an HTML iframe
        const hasHtmlAttr = beforeSrc.includes('data-mce-html') || afterSrc.includes('data-mce-html');
        if (!hasHtmlAttr) {
          return `${beforeSrc}src=${quote}${assetUrl}${quote} data-mce-html="true"${afterSrc}`;
        }
        return fullMatch; // Already marked, keep as-is
      }

      // Not HTML, let Phase 2 handle it
      return fullMatch;
    });

    // Phase 1.75: Handle <a> tags with asset:// hrefs
    // Add download="filename" for non-image files so the browser uses the original name.
    // Images are skipped to preserve lightbox behavior.
    // Pattern: <a ... href="asset://uuid/filename" ...>...</a>  (self-closing not valid for <a>)
    const anchorAssetRegex = /(<a\b[^>]*?)href=(["'])(asset:\/\/(?:asset\/+)?([a-f0-9-]+)(?:\.[a-z0-9]+)?(?:\/([^"'&]+))?)\2([^>]*>)([\s\S]*?)(<\/a>)/gi;

    resolvedHTML = resolvedHTML.replace(anchorAssetRegex, (fullMatch, beforeHref, quote, assetUrl, assetId, urlFilename, afterHref, content, closingTag) => {
      const blobURL = this.blobURLCache.get(assetId);
      const resolvedUrl = blobURL || (usePlaceholder ? this.generatePlaceholder('Loading...', 'loading') : assetUrl);

      if (!blobURL) {
        this.missingAssets.add(assetId);
      }

      // Determine filename: prefer metadata, fallback to URL path
      const metadata = this.getAssetMetadata(assetId);
      let filename = metadata?.filename;
      if (!filename && urlFilename) {
        try { filename = decodeURIComponent(urlFilename); } catch { filename = urlFilename; }
      }

      // Add download attribute for non-image files
      let downloadAttr = '';
      if (filename && !this._isImageAsset(metadata?.mime, filename)) {
        downloadAttr = ` download="${filename.replace(/"/g, '&quot;')}"`;
      }

      // Fix corrupted text content: if anchor text is an asset:// URL (no child HTML elements),
      // replace it with the filename. This recovers documents where blob URLs were saved as text.
      let resolvedContent = content;
      if (filename && !content.includes('<') && /^\s*asset:\/\//.test(content)) {
        resolvedContent = filename;
      }

      return `${beforeHref}href=${quote}${resolvedUrl}${quote}${downloadAttr}${afterHref}${resolvedContent}${closingTag}`;
    });

    // Phase 2: Handle any remaining asset:// URLs (video, audio, background-image, etc.)
    // These won't have img-specific tracking but will still be resolved
    // Also handles corrupted URLs like asset://asset//uuid/filename
    // Supports both formats: asset://uuid.ext (new) and asset://uuid/path (legacy)
    // Note: [^"'\\] excludes quotes AND backslash to avoid matching JSON escape sequences
    const assetRegex = /asset:\/\/(?:asset\/+)?([a-f0-9-]+)(?:\.[a-z0-9]+)?(\/[^"'\\]+)?/gi;

    resolvedHTML = resolvedHTML.replace(assetRegex, (fullMatch, assetId) => {
      // Skip if this URL was already handled in Phase 1.5 (HTML iframe)
      // Check if it's part of a preserved iframe src attribute
      const metadata = this.getAssetMetadata(assetId);
      if (metadata && this._isHtmlAsset(metadata.mime, metadata.filename)) {
        // This is an HTML asset - keep asset:// URL for MutationObserver
        return fullMatch;
      }

      const blobURL = this.blobURLCache.get(assetId);
      if (blobURL) {
        return blobURL;
      }

      // Mark as missing for download
      this.missingAssets.add(assetId);

      if (usePlaceholder) {
        return this.generatePlaceholder('Loading...', 'loading');
      }
      return fullMatch;
    });

    return resolvedHTML;
  }

  /**
   * Convert blob:// URLs back to asset:// references
   * Called before saving to Y.Doc
   *
   * Uses data-asset-id attribute as the primary source for asset ID.
   * Falls back to reverseBlobCache if data-asset-id is not present.
   *
   * @param {string} html
   * @returns {string}
   */
  convertBlobURLsToAssetRefs(html) {
    if (!html || typeof html !== 'string') return html;

    let convertedHTML = html;
    let conversions = 0;

    // Strategy 1: Find img/video/audio tags with blob: src and data-asset-id attribute
    // This is the RELIABLE way - data-asset-id is set when inserting from MediaLibrary
    // Use \s+ after tag name and non-greedy ([^>]*?) to properly match attributes before src
    const tagRegex = /<(img|video|audio|source)\s+([^>]*?)src=(["'])(blob:[^"']+)\3([^>]*)>/gi;

    // Use arrow function to preserve 'this' context for reverseBlobCache access
    const replaceCallback = (match, tagName, before, quote, blobUrl, after) => {
      // Look for data-asset-id in the attributes
      const fullAttrs = before + after;
      const assetIdMatch = fullAttrs.match(/data-asset-id=(["'])([^"']+)\1/i);

      if (assetIdMatch) {
        const assetId = assetIdMatch[2];
        // Use 'file' as default filename - the actual filename will be resolved on load
        conversions++;
        Logger.log(`[AssetManager] Converted blob→asset via data-asset-id: ${assetId.substring(0, 8)}...`);
        return `<${tagName}${before} src=${quote}asset://${assetId}${quote}${after}>`;
      }

      // Strategy 2: Fall back to reverseBlobCache lookup
      const assetId = this.reverseBlobCache.get(blobUrl);
      if (assetId) {
        conversions++;
        Logger.log(`[AssetManager] Converted blob→asset via cache: ${assetId.substring(0, 8)}...`);
        return match.replace(blobUrl, `asset://${assetId}`);
      }

      // Could not convert - log warning
      console.warn(`[AssetManager] FAILED to convert blob URL (no data-asset-id, not in cache): ${blobUrl.substring(0, 50)}...`);
      return match;
    };

    convertedHTML = convertedHTML.replace(tagRegex, replaceCallback);

    // Strategy 3: Handle any remaining blob URLs not in img/video/audio tags (e.g., in CSS or other attributes)
    // Use reverseBlobCache for these
    for (const [blobURL, assetId] of this.reverseBlobCache.entries()) {
      if (convertedHTML.includes(blobURL)) {
        const escapedBlobURL = blobURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        convertedHTML = convertedHTML.replace(new RegExp(escapedBlobURL, 'g'), `asset://${assetId}`);
        conversions++;
      }
    }

    if (conversions > 0) {
      Logger.log(`[AssetManager] convertBlobURLsToAssetRefs: ${conversions} conversion(s) made`);
    }

    return convertedHTML;
  }

  /**
   * Convert data-asset-url attributes to src
   * When assets are inserted via FileManager, they use:
   *   <img src="data:..." data-asset-url="asset://uuid">
   * This converts them to:
   *   <img src="asset://uuid">
   * @param {string} html
   * @returns {string}
   */
  convertDataAssetUrlToSrc(html) {
    if (!html) return html;

    // Match elements with data-asset-url attribute
    // Handles img, video, audio, a tags
    const regex = /(<(?:img|video|audio|source)[^>]*?)(?:src|href)=(["'])([^"']*)\2([^>]*?)data-asset-url=(["'])([^"']+)\5([^>]*>)/gi;

    return html.replace(regex, (match, beforeSrc, quote1, oldSrc, middle, quote2, assetUrl, afterAttr) => {
      // Replace src with asset URL and remove data-asset-url attribute
      return `${beforeSrc}src=${quote1}${assetUrl}${quote1}${middle}${afterAttr}`;
    });
  }

  /**
   * Prepare HTML content for syncing to Yjs
   * Converts blob:// URLs and data-asset-url attributes to asset:// references
   * @param {string} html - HTML with blob:// or data: URLs
   * @returns {string} HTML with asset:// references
   */
  prepareHtmlForSync(html) {
    if (!html) return html;

    // Step 1: Convert data-asset-url attributes to src
    let prepared = this.convertDataAssetUrlToSrc(html);

    // Step 2: Convert any remaining blob:// URLs to asset:// refs
    prepared = this.convertBlobURLsToAssetRefs(prepared);

    return prepared;
  }

  /**
   * Prepare JSON content for syncing to Yjs
   * Converts blob:// URLs to asset:// references in JSON strings (jsonProperties)
   *
   * This centralizes blob URL recovery that was previously done in individual iDevices
   * (e.g., image-gallery, map, quick-questions). When iDevices save their data,
   * blob:// URLs may be incorrectly stored instead of asset:// URLs. Since blob://
   * URLs are ephemeral (expire when page reloads), this method converts them back
   * to persistent asset:// URLs before saving to Yjs.
   *
   * @param {string} json - JSON string that may contain blob:// URLs
   * @returns {string} JSON with asset:// references
   */
  prepareJsonForSync(json) {
    if (!json || typeof json !== 'string') return json;

    // Pattern to match blob:// URLs inside JSON string values (quoted strings)
    // Matches: "blob:http://..." or "blob:https://..."
    // This captures blob URLs within JSON property values
    const blobUrlPattern = /"(blob:https?:\/\/[^"]+)"/g;

    return json.replace(blobUrlPattern, (match, blobUrl) => {
      // Try to recover asset ID from reverseBlobCache
      const assetId = this.reverseBlobCache.get(blobUrl);
      if (assetId) {
        Logger.log(`[AssetManager] JSON: Converted blob→asset: ${assetId.substring(0, 8)}...`);
        return `"asset://${assetId}"`;
      }

      // If we can't recover, return empty string to avoid persisting broken blob URL
      // This is safer than leaving a blob URL that will definitely break after reload
      Logger.warn(`[AssetManager] JSON: Cannot recover blob URL, clearing: ${blobUrl.substring(0, 50)}...`);
      return '""';
    });
  }

  /**
   * Extract assets from ZIP file (for .elp/.elpx import)
   *
   * Supports two formats:
   * - Legacy .elp (contentv3.xml): Assets at root level (e.g., image.jpg)
   * - New .elpx (content.xml): Assets in content/resources/ folders
   *
   * @param {Object} zip - fflate extracted ZIP object {path: Uint8Array}
   * @param {Function} [onAssetProgress] - Optional callback for progress reporting (current, total, filename)
   * @returns {Promise<Map<string, string>>} Map of originalPath -> assetId
   */
  async extractAssetsFromZip(zip, onAssetProgress = null) {
    const assetMap = new Map();
    const assetFiles = [];
    let storedAssetsCount = 0;

    // Detect format: legacy .elp has contentv3.xml, new .elpx has content.xml
    const isLegacyFormat = Object.keys(zip).some(path => path === 'contentv3.xml' || path.endsWith('/contentv3.xml'));
    Logger.log(`[AssetManager] Detected format: ${isLegacyFormat ? 'legacy .elp (contentv3.xml)' : 'new .elpx (content.xml)'}`);

    // Find all asset files (zip is an object with path -> Uint8Array)
    for (const [relativePath, fileData] of Object.entries(zip)) {
      // Skip directories (they end with /)
      if (relativePath.endsWith('/')) continue;
      if (relativePath.startsWith('__MACOSX')) continue;
      if (relativePath.endsWith('.xml')) continue;
      if (relativePath.endsWith('.xsd')) continue;
      if (relativePath.endsWith('.data')) continue;

      // Skip system folders - these are bundled with the export, not user assets
      const isSystemFile = relativePath.startsWith('idevices/') ||
                          relativePath.startsWith('libs/') ||
                          relativePath.startsWith('theme/') ||
                          relativePath.startsWith('content/css/') ||
                          relativePath.startsWith('content/img/') ||
                          relativePath.startsWith('html/') ||
                          relativePath === 'index.html' ||
                          relativePath === 'base.css' ||
                          relativePath === 'common_i18n.js' ||
                          relativePath === 'common.js';

      if (isSystemFile) continue;

      let shouldInclude = false;

      // UUID pattern for detecting asset folders (standard UUID or custom IDs like block-xxx-xxx)
      const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
      const customIdPattern = /^(idevice|block|page)-[a-z0-9]+-[a-z0-9]+$/i;

      if (isLegacyFormat) {
        // Legacy format: Assets are at root level (e.g., "image.jpg", "document.pdf")
        // Include files that are NOT in any subfolder (no "/" in path)
        const isRootFile = !relativePath.includes('/');
        if (isRootFile) {
          shouldInclude = true;
        }
      } else {
        // New format: Assets are in resources/ folders
        // Patterns: "resources/file.jpg", "content/resources/uuid/file.jpg"
        const isResourceFile = relativePath.startsWith('resources/') ||
                              relativePath.startsWith('content/resources/') ||
                              relativePath.includes('/resources/');
        if (isResourceFile) {
          shouldInclude = true;
        }

        // Also detect UUID-style folder paths: "{uuid}/{filename}"
        // This handles component exports (.idevice/.block files) that store assets
        // in folders named by their asset UUID
        if (!shouldInclude) {
          const pathParts = relativePath.split('/');
          if (pathParts.length >= 2) {
            const firstFolder = pathParts[0];
            // Check if first folder looks like a UUID or custom ID
            const isUuidFolder = uuidPattern.test(firstFolder) || customIdPattern.test(firstFolder);
            if (isUuidFolder) {
              shouldInclude = true;
              Logger.log(`[AssetManager] Detected UUID-style asset path: ${relativePath}`);
            }
          }
        }

        // =====================================================================
        // FIX FOR v3.0 ELP BUG: custom/ folder asset detection
        //
        // In eXeLearning v3.0 (PHP/Symfony), the File Manager stored user-uploaded
        // assets in the custom/ folder. These files need to be detected during import.
        //
        // IMPORTANT: There's also a filename normalization bug where:
        // - Files in custom/ keep original names with SPACES (e.g., "11 A1.png")
        // - XML references use UNDERSCORES (e.g., "11_A1.png")
        // This is handled by adding normalized path mappings below.
        // =====================================================================
        if (!shouldInclude) {
          const isCustomFolderFile = relativePath.startsWith('custom/') &&
                                     !relativePath.endsWith('/');
          const customFilename = isCustomFolderFile ? relativePath.split('/').pop() : '';
          const isCustomPlaceholder = Boolean(customFilename) && customFilename.startsWith('.');
          if (isCustomFolderFile && !isCustomPlaceholder) {
            shouldInclude = true;
            Logger.log(`[AssetManager] Detected custom/ folder asset: ${relativePath}`);
          }
        }
      }

      if (shouldInclude) {
        assetFiles.push({ path: relativePath, fileData });
      }
    }

    Logger.log(`[AssetManager] Found ${assetFiles.length} assets in ZIP`);

    const totalAssets = assetFiles.length;
    let currentAsset = 0;

    for (const { path, fileData } of assetFiles) {
      currentAsset++;

      // Report progress if callback provided
      if (onAssetProgress) {
        const filename = path.split('/').pop();
        onAssetProgress(currentAsset, totalAssets, filename);
      }

      try {
        // fileData is already a Uint8Array from fflate
        const arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
        const mime = this.getMimeType(path);
        const blob = new Blob([arrayBuffer], { type: mime });

        // Calculate hash
        const hash = await this.calculateHash(blob);

        // Generate deterministic ID from hash (content-addressable)
        const assetId = this.hashToUUID(hash);

        // Extract filename and folderPath from the path
        // Path can be: "mywebsite/css/style.css", "content/resources/uuid/file.jpg", "uuid/file.jpg"
        const filename = path.split('/').pop();
        const folderPath = this._extractFolderPathFromImport(path, assetId);

        // Check if already exists (same content = same ID)
        const existing = await this.getAsset(assetId);
        if (existing) {
          // Check if asset belongs to current project
          if (existing.projectId === this.projectId) {
            assetMap.set(path, assetId);
            Logger.log(`[AssetManager] Asset already exists for this project ${path} → ${assetId.substring(0, 8)}...`);
            continue;
          }
          // Asset exists but for different project - reuse blob, create entry for this project
          Logger.log(`[AssetManager] Asset exists in other project, creating for ${this.projectId.substring(0, 8)}...`);
          const reusedAsset = {
            id: assetId,
            projectId: this.projectId,
            blob: existing.blob,
            mime: existing.mime,
            hash: existing.hash,
            size: existing.size,
            uploaded: false,
            createdAt: new Date().toISOString(),
            filename,
            originalPath: path,
            folderPath
          };
          await this.putAsset(reusedAsset);
          storedAssetsCount++;
          assetMap.set(path, assetId);
          continue;
        }

        // Create new asset
        const asset = {
          id: assetId,
          projectId: this.projectId,
          blob: blob,
          mime: mime,
          hash: hash,
          size: blob.size,
          uploaded: false,
          createdAt: new Date().toISOString(),
          filename,
          originalPath: path,  // Store original path for {{context_path}} mapping
          folderPath
        };

        await this.putAsset(asset);
        storedAssetsCount++;
        assetMap.set(path, assetId);

        // =====================================================================
        // FIX FOR v3.0 ELP BUG: Normalized filename mapping
        //
        // v3.0 had a bug where files uploaded via File Manager kept spaces in
        // filenames on disk (e.g., "11 A1.png") but XML references used
        // underscores (e.g., "11_A1.png"). We add BOTH mappings so lookups work.
        // =====================================================================
        if (path.startsWith('custom/') && path.includes(' ')) {
          const normalizedPath = path.replace(/ /g, '_');
          assetMap.set(normalizedPath, assetId);
          Logger.log(`[AssetManager] Added normalized mapping: ${normalizedPath} → ${assetId.substring(0, 8)}...`);
        }

        Logger.log(`[AssetManager] Extracted ${path} → ${assetId.substring(0, 8)}... (folder: ${folderPath || 'root'})`);
      } catch (e) {
        console.error(`[AssetManager] Failed to extract ${path}:`, e);
      }
    }

    // Announce once after batch import so peers can request newly available blobs.
    if (storedAssetsCount > 0) {
      await this._announceAssetAvailability('extractAssetsFromZip');
    }

    return assetMap;
  }

  /**
   * Convert {{context_path}} references in HTML to asset:// URLs
   * @param {string} html
   * @param {Map<string, string>} assetMap - Map of originalPath -> assetId
   * @returns {string}
   */
  convertContextPathToAssetRefs(html, assetMap) {
    if (!html) return html;

    let convertedHTML = html;

    // Helper function to find asset and return URL
    const findAssetUrl = (assetPath) => {
      // Clean up path - remove trailing backslash/special chars and normalize
      const cleanPath = assetPath.replace(/[\\\s]+$/, '').trim();

      // Try to find asset by exact path
      if (assetMap.has(cleanPath)) {
        const assetId = assetMap.get(cleanPath);
        return this.getAssetUrl(assetId, cleanPath.split('/').pop());
      }

      // Try with common prefixes (ZIP structure varies)
      const prefixes = ['', 'content/', 'content/resources/', 'resources/'];
      for (const prefix of prefixes) {
        const fullPath = prefix + cleanPath;
        if (assetMap.has(fullPath)) {
          return this.getAssetUrl(assetMap.get(fullPath), cleanPath.split('/').pop());
        }
      }

      // Try without leading directory (iDevices sometimes use just filename)
      const filename = cleanPath.split('/').pop();
      for (const [path, assetId] of assetMap.entries()) {
        if (path.endsWith('/' + filename) || path === filename) {
          return this.getAssetUrl(assetId, filename);
        }
      }

      // Try matching just the last part of the path (e.g., UUID/file.ext)
      const pathParts = cleanPath.split('/');
      if (pathParts.length >= 2) {
        const shortPath = pathParts.slice(-2).join('/');
        for (const [path, assetId] of assetMap.entries()) {
          if (path.endsWith(shortPath)) {
            return this.getAssetUrl(assetId, pathParts[pathParts.length - 1]);
          }
        }
      }

      // =====================================================================
      // FIX FOR v3.0 ELP BUG: Try custom/ folder lookup
      //
      // v3.0 XML references like "uuid/11_A1.png" may actually map to
      // "custom/11 A1.png" (with space). Try multiple lookup strategies.
      // =====================================================================

      // Strategy 1: Try with custom/ prefix
      const customPath = 'custom/' + filename;
      if (assetMap.has(customPath)) {
        return this.getAssetUrl(assetMap.get(customPath), filename);
      }

      // Strategy 2: Try denormalized (underscores → spaces) in custom/
      const denormalizedFilename = filename.replace(/_/g, ' ');
      if (denormalizedFilename !== filename) {
        const customDenormalized = 'custom/' + denormalizedFilename;
        if (assetMap.has(customDenormalized)) {
          return this.getAssetUrl(assetMap.get(customDenormalized), denormalizedFilename);
        }
      }

      // Strategy 3: Search custom/ folder for matching denormalized filename
      for (const [mapPath, assetId] of assetMap.entries()) {
        if (mapPath.startsWith('custom/')) {
          const mapFilename = mapPath.split('/').pop();
          if (mapFilename === denormalizedFilename || mapFilename === filename) {
            return this.getAssetUrl(assetId, mapFilename);
          }
        }
      }

      return null;
    };

    // Pattern 1: {{context_path}}/path/to/file.jpg
    const contextPathRegex = /\{\{context_path\}\}\/([^"'<>]+)/g;
    convertedHTML = convertedHTML.replace(contextPathRegex, (fullMatch, assetPath) => {
      const url = findAssetUrl(assetPath);
      if (url) return url;
      console.warn(`[AssetManager] Asset not found for path: ${assetPath}`);
      return fullMatch;
    });

    // Pattern 2: Direct resources/ paths (legacy ELP files)
    // Match: src="resources/file.jpg" or href="resources/file.jpg"
    const directResourcesRegex = /(src|href)=(["'])resources\/([^"']+)\2/gi;
    convertedHTML = convertedHTML.replace(directResourcesRegex, (fullMatch, attr, quote, assetPath) => {
      const url = findAssetUrl(`resources/${assetPath}`);
      if (url) return `${attr}=${quote}${url}${quote}`;
      // Also try without the resources/ prefix
      const urlWithoutPrefix = findAssetUrl(assetPath);
      if (urlWithoutPrefix) return `${attr}=${quote}${urlWithoutPrefix}${quote}`;
      console.warn(`[AssetManager] Asset not found for direct resources path: resources/${assetPath}`);
      return fullMatch;
    });

    return convertedHTML;
  }

  /**
   * Preload all project assets into memory (create blob URLs)
   * Call after import to have all URLs ready for sync resolution
   * @returns {Promise<number>} Number of assets preloaded
   */
  async preloadAllAssets() {
    const assets = await this.getProjectAssets();
    let count = 0;
    let skipped = 0;

    for (const asset of assets) {
      if (!this.blobURLCache.has(asset.id)) {
        // Check if asset has a valid blob
        if (!asset.blob || !(asset.blob instanceof Blob)) {
          Logger.warn(`[AssetManager] Asset ${asset.id} (${asset.filename}) has no valid blob, skipping`);
          skipped++;
          continue;
        }
        // Use createBlobURL with fallback for blocked extensions
        const blobURL = await this.createBlobURL(asset.blob);
        this.blobURLCache.set(asset.id, blobURL);
        this.reverseBlobCache.set(blobURL, asset.id);
        count++;
      }
    }

    Logger.log(`[AssetManager] Preloaded ${count} assets${skipped > 0 ? `, skipped ${skipped} without blob` : ''}`);
    return count;
  }

  /**
   * Upload pending assets to server
   * @param {string} apiBaseUrl
   * @param {string} token
   * @returns {Promise<{uploaded: number, failed: number, bytes: number}>}
   */
  async uploadPendingAssets(apiBaseUrl, token) {
    const pending = await this.getPendingAssets();

    if (pending.length === 0) {
      Logger.log('[AssetManager] No pending assets to upload');
      return { uploaded: 0, failed: 0, bytes: 0 };
    }

    Logger.log(`[AssetManager] Uploading ${pending.length} pending assets...`);

    const formData = new FormData();
    let totalBytes = 0;

    for (const asset of pending) {
      formData.append('assets', asset.blob, asset.id);
      formData.append(`${asset.id}_mime`, asset.mime);
      formData.append(`${asset.id}_hash`, asset.hash);
      formData.append(`${asset.id}_size`, asset.size.toString());
      if (asset.filename) {
        formData.append(`${asset.id}_filename`, asset.filename);
      }
      totalBytes += asset.size;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/projects/${this.projectId}/assets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Mark as uploaded
      for (const asset of pending) {
        await this.markAssetUploaded(asset.id);
      }

      Logger.log(`[AssetManager] Uploaded ${result.uploaded} assets`);
      return { uploaded: result.uploaded, failed: 0, bytes: totalBytes };
    } catch (error) {
      console.error('[AssetManager] Upload failed:', error);
      return { uploaded: 0, failed: pending.length, bytes: 0 };
    }
  }

  /**
   * Download missing assets from server
   * @param {string} apiBaseUrl
   * @param {string} token
   * @returns {Promise<number>} Number of assets downloaded
   */
  async downloadMissingAssets(apiBaseUrl, token) {
    Logger.log('[AssetManager] Checking for missing assets...');

    try {
      // Get list from server
      const response = await fetch(`${apiBaseUrl}/projects/${this.projectId}/assets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.warn('[AssetManager] Failed to fetch asset list from server');
        return 0;
      }

      const responseData = await response.json();
      // API returns { success: true, data: [...] }
      const serverAssets = responseData.data || responseData.assets || responseData || [];
      Logger.log(`[AssetManager] Server has ${serverAssets.length} assets`);

      // Find missing locally
      // Note: server returns {id: numeric_db_id, clientId: uuid_hash, ...}
      // We use clientId as the asset identifier
      const missing = [];
      for (const serverAsset of serverAssets) {
        const assetId = serverAsset.clientId;
        if (!assetId) continue;
        const local = await this.getAsset(assetId);
        if (!local) {
          missing.push(assetId);
        }
      }

      if (missing.length === 0) {
        Logger.log('[AssetManager] All assets cached locally');
        return 0;
      }

      Logger.log(`[AssetManager] Downloading ${missing.length} missing assets...`);

      let downloaded = 0;
      for (const assetId of missing) {
        try {
          const assetResponse = await fetch(
            `${apiBaseUrl}/projects/${this.projectId}/assets/${assetId}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );

          if (!assetResponse.ok) continue;

          const blob = await assetResponse.blob();
          const mime = assetResponse.headers.get('X-Original-Mime') || 'application/octet-stream';
          const hash = assetResponse.headers.get('X-Asset-Hash') || '';
          const size = parseInt(assetResponse.headers.get('X-Original-Size') || '0');
          const filename = assetResponse.headers.get('X-Filename') || undefined;

          const asset = {
            id: assetId,
            projectId: this.projectId,
            blob: blob,
            mime: mime,
            hash: hash,
            size: size,
            uploaded: true,
            createdAt: new Date().toISOString(),
            filename: filename,
            folderPath: '' // Downloaded assets go to root by default
          };

          await this.putAsset(asset);
          downloaded++;
        } catch (e) {
          console.error(`[AssetManager] Failed to download ${assetId}:`, e);
        }
      }

      Logger.log(`[AssetManager] Downloaded ${downloaded}/${missing.length} assets`);
      return downloaded;
    } catch (error) {
      console.error('[AssetManager] Download check failed:', error);
      return 0;
    }
  }

  /**
   * Get MIME type from filename
   * @param {string} filename
   * @returns {string}
   */
  getMimeType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes = {
      // Images
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
      tif: 'image/tiff',
      tiff: 'image/tiff',
      // Video
      mp4: 'video/mp4',
      m4v: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      ogg: 'video/ogg',
      // Audio
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      wav: 'audio/wav',
      aac: 'audio/aac',
      flac: 'audio/flac',
      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Archives
      zip: 'application/zip',
      rar: 'application/vnd.rar',
      '7z': 'application/x-7z-compressed',
      // 3D Models
      gltf: 'model/gltf+json',
      glb: 'model/gltf-binary',
      stl: 'model/stl',
      // Code
      css: 'text/css',
      js: 'application/javascript',
      // eXeLearning
      elp: 'application/zip',
      elpx: 'application/zip',
      // Text
      txt: 'text/plain',
      html: 'text/html',
      htm: 'text/html',
      json: 'application/json',
      csv: 'text/csv',
      rtf: 'application/rtf',
      // Open Document
      odt: 'application/vnd.oasis.opendocument.text',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
      odp: 'application/vnd.oasis.opendocument.presentation',
      // eBooks
      epub: 'application/epub+zip',
      mobi: 'application/x-mobipocket-ebook'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Generate placeholder SVG data URL
   * @param {string} text
   * @param {string} type - 'loading' | 'error' | 'notfound'
   * @returns {string}
   */
  generatePlaceholder(text, type = 'notfound') {
    // For loading type, use animated spinner (matching app loading screen)
    if (type === 'loading') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
        <rect width="300" height="200" fill="#f8f9fa"/>
        <g transform="translate(150, 100)">
          <circle cx="0" cy="0" r="24" fill="none" stroke="#26DDC7" stroke-width="3" stroke-linecap="round"
                  stroke-dasharray="1 200" stroke-dashoffset="0">
            <animate attributeName="stroke-dasharray"
                     values="1 200; 100 200; 1 200"
                     dur="1.5s"
                     repeatCount="indefinite"
                     keyTimes="0;0.5;1"
                     calcMode="spline"
                     keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"/>
            <animate attributeName="stroke-dashoffset"
                     values="0; -45; -180"
                     dur="1.5s"
                     repeatCount="indefinite"
                     keyTimes="0;0.5;1"
                     calcMode="spline"
                     keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"/>
          </circle>
          <animateTransform attributeName="transform"
                            attributeType="XML"
                            type="rotate"
                            from="0 0 0"
                            to="360 0 0"
                            dur="2s"
                            repeatCount="indefinite"
                            additive="sum"/>
        </g>
      </svg>`;
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    // For other types, use static placeholder with icon
    const colors = {
      error: { bg: '#ffebee', text: '#c62828', icon: '&#9888;' },   // Red, warning
      notfound: { bg: '#f0f0f0', text: '#999', icon: '&#128247;' }, // Gray, camera
    };

    const style = colors[type] || colors.notfound;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
      <rect width="300" height="200" fill="${style.bg}"/>
      <text x="150" y="85" text-anchor="middle" fill="${style.text}" font-size="32">${style.icon}</text>
      <text x="150" y="120" text-anchor="middle" fill="${style.text}" font-size="14">${text}</text>
    </svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  /**
   * Generate a loading placeholder for an asset being fetched
   * @param {string} assetId - Asset UUID
   * @returns {string} Data URL for loading placeholder
   */
  generateLoadingPlaceholder(assetId) {
    return this.generatePlaceholder('Loading...', 'loading');
  }

  /**
   * Track assets that are currently being fetched
   * @type {Set<string>}
   */
  pendingFetches = new Set();

  /**
   * Update all images in the DOM that reference a specific asset
   * Called when an asset becomes available (after peer fetch)
   * @param {string} assetId - Asset UUID
   * @returns {Promise<number>} Number of images updated
   */
  async updateDomImagesForAsset(assetId) {
    const assetUrl = `asset://${assetId}`;

    // Get the actual blob URL
    const blobUrl = await this.resolveAssetURL(assetUrl);
    if (!blobUrl) {
      console.warn(`[AssetManager] Cannot update DOM: asset ${assetId.substring(0, 8)}... not found`);
      return 0;
    }

    let count = 0;
    const updatedElements = new Set();
    const markUpdated = (element) => {
      if (!updatedElements.has(element)) {
        updatedElements.add(element);
        count++;
      }
    };
    const matchesAssetUrl = (value) => {
      return (
        typeof value === 'string' &&
        value.startsWith('asset://') &&
        this.extractAssetId(value) === assetId
      );
    };

    // Find all images with data-asset-id attribute matching this asset
    const images = document.querySelectorAll(`img[data-asset-id="${assetId}"]`);
    for (const img of images) {
      img.src = blobUrl;
      img.removeAttribute('data-asset-loading');
      markUpdated(img);
    }

    // Also check for background images in style attributes
    const elements = document.querySelectorAll(`[data-asset-id="${assetId}"]`);
    for (const el of elements) {
      if (el.style.backgroundImage && el.style.backgroundImage.includes('data:image')) {
        el.style.backgroundImage = `url(${blobUrl})`;
        el.removeAttribute('data-asset-loading');
        markUpdated(el);
      }
    }

    // Handle iframes that were waiting for this asset to download (guest users / late asset fetch)
    const iframes = document.querySelectorAll(`iframe[data-asset-id="${assetId}"][data-asset-loading="true"]`);
    if (iframes.length > 0) {
      const metadata = this.getAssetMetadata(assetId);
      let iframeUrl = blobUrl;

      // HTML iframes need resolveHtmlWithAssets() to fix internal relative URLs
      if (metadata && this._isHtmlAsset(metadata.mime, metadata.filename)) {
        const resolvedHtmlUrl = await this.resolveHtmlWithAssets(assetId);
        if (resolvedHtmlUrl) {
          iframeUrl = resolvedHtmlUrl;
        }
      }

      for (const iframe of iframes) {
        iframe.src = iframeUrl;
        iframe.removeAttribute('data-asset-loading');
        iframe.removeAttribute('data-asset-id');
        markUpdated(iframe);
      }
    }

    // Fallback matching for renderers that only preserve data-asset-url/data-asset-src.
    // This is common for async MutationObserver resolution when the blob is not local yet.
    const fallbackElements = document.querySelectorAll(
      `[data-asset-url*="${assetId}"],[data-asset-src*="${assetId}"],[data-asset-origin*="${assetId}"]`
    );
    for (const el of fallbackElements) {
      if (updatedElements.has(el)) {
        continue;
      }
      const assetUrlAttr = el.getAttribute?.('data-asset-url');
      const assetSrcAttr = el.getAttribute?.('data-asset-src');
      const assetOriginAttr = el.getAttribute?.('data-asset-origin');
      const matches =
        matchesAssetUrl(assetUrlAttr) ||
        matchesAssetUrl(assetSrcAttr) ||
        matchesAssetUrl(assetOriginAttr);
      if (!matches) continue;

      const tagName = (el.tagName || '').toUpperCase();
      let updated = false;

      if (matchesAssetUrl(assetOriginAttr)) {
        el.setAttribute('origin', blobUrl);
        updated = true;
      }

      if (tagName === 'A') {
        el.setAttribute('href', blobUrl);
        updated = true;
      } else if (['IMG', 'IFRAME', 'VIDEO', 'AUDIO', 'SOURCE'].includes(tagName)) {
        el.src = blobUrl;
        updated = true;

        if (tagName === 'VIDEO' || tagName === 'AUDIO') {
          if (typeof el.load === 'function') {
            el.load();
          }
        } else if (tagName === 'SOURCE') {
          const parent = el.parentElement;
          if (parent && (parent.tagName === 'VIDEO' || parent.tagName === 'AUDIO') && typeof parent.load === 'function') {
            parent.load();
          }
        }
      }

      if (updated) {
        el.removeAttribute('data-asset-loading');
        markUpdated(el);
      }
    }

    Logger.log(`[AssetManager] Updated ${count} DOM elements for asset ${assetId.substring(0, 8)}...`);
    return count;
  }

  /**
   * Resolve asset:// URL with loading placeholder support
   * If asset is missing but a WebSocket handler is available, returns a loading placeholder
   * and triggers background fetch
   * @param {string} assetUrl - asset://uuid
   * @param {Object} options - Options
   * @param {AssetWebSocketHandler} options.wsHandler - WebSocket handler for fetching
   * @param {boolean} options.returnPlaceholder - Return loading placeholder if missing
   * @returns {Promise<{url: string, isPlaceholder: boolean, assetId: string}>}
   */
  async resolveAssetURLWithPlaceholder(assetUrl, options = {}) {
    const assetId = this.extractAssetId(assetUrl);
    if (!assetId) {
      return {
        url: this.generatePlaceholder('Image not found', 'notfound'),
        isPlaceholder: true,
        assetId: '',
      };
    }
    const { wsHandler = null, returnPlaceholder = true } = options;

    // Check cache first
    if (this.blobURLCache.has(assetId)) {
      return {
        url: this.blobURLCache.get(assetId),
        isPlaceholder: false,
        assetId,
      };
    }

    // Try to load from memory
    const asset = await this.getAsset(assetId);
    if (asset?.blob && typeof asset.blob.arrayBuffer === 'function') {
      const blobURL = await this.createBlobURL(asset.blob);
      this.blobURLCache.set(assetId, blobURL);
      this.reverseBlobCache.set(blobURL, assetId);
      return {
        url: blobURL,
        isPlaceholder: false,
        assetId,
      };
    }

    // Asset not found locally
    if (returnPlaceholder) {
      // Trigger background fetch if handler available and not already fetching
      if (wsHandler && !this.pendingFetches.has(assetId)) {
        this.pendingFetches.add(assetId);
        wsHandler.requestAsset(assetId).finally(() => {
          this.pendingFetches.delete(assetId);
        });
      }

      return {
        url: this.generateLoadingPlaceholder(assetId),
        isPlaceholder: true,
        assetId,
      };
    }

    return {
      url: this.generatePlaceholder('Image not found', 'notfound'),
      isPlaceholder: true,
      assetId,
    };
  }

  /**
   * Resolve asset:// URL with priority queue integration
   * If asset is missing, marks it as CRITICAL priority and triggers fetch
   * @param {string} assetUrl - asset://uuid or asset://uuid/filename
   * @param {Object} options - Options
   * @param {string} options.pageId - Current page ID for priority context
   * @param {string} options.reason - Why this asset is needed ('render', 'navigation')
   * @returns {Promise<{url: string, isPlaceholder: boolean, assetId: string}>}
   */
  async resolveAssetURLWithPriority(assetUrl, options = {}) {
    const assetId = this.extractAssetId(assetUrl);
    if (!assetId) {
      return {
        url: this.generatePlaceholder('Image not found', 'notfound'),
        isPlaceholder: true,
        assetId: '',
      };
    }
    const { pageId = null, reason = 'render' } = options;

    // Check cache first
    if (this.blobURLCache.has(assetId)) {
      return {
        url: this.blobURLCache.get(assetId),
        isPlaceholder: false,
        assetId,
      };
    }

    // Try to load from memory
    const asset = await this.getAsset(assetId);
    if (asset?.blob && typeof asset.blob.arrayBuffer === 'function') {
      const blobURL = await this.createBlobURL(asset.blob);
      this.blobURLCache.set(assetId, blobURL);
      this.reverseBlobCache.set(blobURL, assetId);
      return {
        url: blobURL,
        isPlaceholder: false,
        assetId,
      };
    }

    // Asset not found locally - mark as high priority
    const priority =
      reason === 'render'
        ? (window.AssetPriorityQueue?.PRIORITY?.CRITICAL || 100)
        : (window.AssetPriorityQueue?.PRIORITY?.HIGH || 75);

    // Add to priority queue if available
    if (this.priorityQueue) {
      this.priorityQueue.enqueue(assetId, priority, {
        reason,
        pageId,
      });
      Logger.log(
        `[AssetManager] Asset ${assetId.substring(0, 8)}... missing, queued with priority=${priority}`
      );
    }

    // Send priority update via WebSocket
    if (this.wsHandler) {
      this.wsHandler.sendPriorityUpdate(assetId, priority, reason, pageId);

      // Also trigger fetch
      if (!this.pendingFetches.has(assetId)) {
        this.pendingFetches.add(assetId);
        this.wsHandler.requestAssetWithPriority(assetId, priority, reason).finally(() => {
          this.pendingFetches.delete(assetId);
        });
      }
    }

    return {
      url: this.generateLoadingPlaceholder(assetId),
      isPlaceholder: true,
      assetId,
    };
  }

  /**
   * Scan HTML content for asset references and boost their priority
   * Call this when navigating to a new page to prefetch needed assets
   * @param {string} html - HTML content to scan
   * @param {string} pageId - Page ID for context
   * @returns {Promise<string[]>} - Array of asset IDs that were prioritized
   */
  async boostAssetsInHTML(html, pageId) {
    if (!html) return [];

    // Find all asset:// references
    const assetRegex = /asset:\/\/([a-f0-9-]+)/gi;
    const matches = [...html.matchAll(assetRegex)];

    if (matches.length === 0) return [];

    const assetIds = [...new Set(matches.map((m) => m[1]))];
    const missingAssets = [];

    // Check which assets we don't have
    for (const assetId of assetIds) {
      if (!this.blobURLCache.has(assetId)) {
        const asset = await this.getAsset(assetId);
        if (!asset?.blob) {
          missingAssets.push(assetId);
        }
      }
    }

    if (missingAssets.length === 0) {
      return [];
    }

    Logger.log(
      `[AssetManager] Boosting priority for ${missingAssets.length} missing assets on page ${pageId?.substring(0, 8) || 'unknown'}...`
    );

    const priority = window.AssetPriorityQueue?.PRIORITY?.HIGH || 75;

    // Boost priority for missing assets
    for (const assetId of missingAssets) {
      if (this.priorityQueue) {
        this.priorityQueue.enqueue(assetId, priority, {
          reason: 'navigation',
          pageId,
        });
      }
    }

    // Send navigation hint via WebSocket
    if (this.wsHandler && missingAssets.length > 0) {
      this.wsHandler.sendNavigationHint(pageId, missingAssets);
    }

    return missingAssets;
  }

  /**
   * Get statistics - uses Yjs metadata for instant results
   * @returns {Promise<{total: number, pending: number, uploaded: number, totalSize: number}>}
   */
  async getStats() {
    // Use metadata-only for fast stats (no blob access needed)
    const all = this.getAllAssetsMetadata();
    const pending = all.filter(a => !a.uploaded);
    const uploaded = all.filter(a => a.uploaded);
    const totalSize = all.reduce((sum, a) => sum + (a.size || 0), 0);

    return {
      total: all.length,
      pending: pending.length,
      uploaded: uploaded.length,
      totalSize
    };
  }

  /**
   * Update asset filename in Yjs metadata
   * @param {string} id - Asset UUID
   * @param {string} newFilename - New filename
   * @returns {Promise<void>}
   */
  async updateAssetFilename(id, newFilename) {
    const metadata = this.getAssetMetadata(id);
    if (!metadata) {
      console.warn(`[AssetManager] Cannot update filename for ${id}: not found in Yjs`);
      return;
    }

    // Update metadata in Yjs
    this.setAssetMetadata(id, {
      ...metadata,
      filename: newFilename
    });

    Logger.log(`[AssetManager] Updated filename for ${id} to ${newFilename} via Yjs`);
  }

  /**
   * Get image dimensions (width, height)
   * @param {string} id - Asset UUID
   * @returns {Promise<{width: number, height: number}|null>}
   */
  async getImageDimensions(id) {
    const asset = await this.getAsset(id);
    if (!asset || !asset.blob) {
      return null;
    }

    // Only process images
    if (!asset.mime || !asset.mime.startsWith('image/')) {
      return null;
    }

    // Use createBlobURL with fallback for blocked extensions
    const blobURL = await this.createBlobURL(asset.blob);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        // Only revoke if it's a blob URL (not a data URL)
        if (blobURL.startsWith('blob:')) {
          URL.revokeObjectURL(img.src);
        }
      };
      img.onerror = () => {
        resolve(null);
        if (blobURL.startsWith('blob:')) {
          URL.revokeObjectURL(img.src);
        }
      };
      img.src = blobURL;
    });
  }

  /**
   * Check if asset is an image
   * @param {Object} asset
   * @returns {boolean}
   */
  isImage(asset) {
    if (!asset || !asset.mime) return false;
    return asset.mime.startsWith('image/');
  }

  /**
   * Check if asset is a video
   * @param {Object} asset
   * @returns {boolean}
   */
  isVideo(asset) {
    if (!asset || !asset.mime) return false;
    return asset.mime.startsWith('video/');
  }

  /**
   * Check if asset is audio
   * @param {Object} asset
   * @returns {boolean}
   */
  isAudio(asset) {
    if (!asset || !asset.mime) return false;
    return asset.mime.startsWith('audio/');
  }

  /**
   * Format file size to human readable
   * @param {number} bytes
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Delete asset - removes metadata from Yjs, blob from memory, and file from server
   * @param {string} id
   * @param {Object} options - Optional configuration
   * @param {boolean} options.skipServerDelete - If true, skip server deletion (used by bulk operations)
   * @returns {Promise<void>}
   */
  async deleteAsset(id, options = {}) {
    // 1. Delete metadata from Yjs (instant sync to other clients)
    this.deleteAssetMetadata(id);

    // 2. Revoke blob URL if exists
    const blobURL = this.blobURLCache.get(id);
    if (blobURL) {
      URL.revokeObjectURL(blobURL);
      this.blobURLCache.delete(id);
      this.reverseBlobCache.delete(blobURL);
    }

    // 3. Delete blob from memory
    this.blobCache.delete(id);

    // 4. Delete from Cache API (non-blocking)
    this._deleteFromCache(id).catch(() => {});

    Logger.log(`[AssetManager] Deleted asset ${id.substring(0, 8)}... from Yjs, memory, and cache`);

    // 5. Delete from server (fire-and-forget, don't block local deletion)
    if (!options.skipServerDelete) {
      this._deleteFromServer(id).catch(() => {}); // Errors are logged inside _deleteFromServer
    }
  }

  /**
   * Invalidate local blob/cache for an asset while keeping Yjs metadata.
   * Used when metadata hash changes remotely but assetId remains stable.
   *
   * @param {string} assetId
   * @param {Object} options
   * @param {boolean} options.markAsMissing - Mark asset as missing for re-fetch (default true)
   * @param {boolean} options.markDomAsLoading - Reset matching DOM elements to loading state (default false)
   * @param {string} options.reason - Debug reason
   * @returns {Promise<void>}
   */
  async invalidateLocalBlob(assetId, options = {}) {
    if (!assetId) return;

    const {
      markAsMissing = true,
      markDomAsLoading = false,
      reason = 'metadata-update',
    } = options;

    const existingBlobUrl = this.blobURLCache.get(assetId);
    if (existingBlobUrl && typeof existingBlobUrl === 'string' && existingBlobUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(existingBlobUrl);
      } catch (e) {
        console.warn(`[AssetManager] Failed to revoke stale blob URL for ${assetId.substring(0, 8)}...`, e);
      }
    }

    if (existingBlobUrl) {
      this.blobURLCache.delete(assetId);
      this.reverseBlobCache.delete(existingBlobUrl);
    }

    this.blobCache.delete(assetId);
    await this._deleteFromCache(assetId).catch(() => {});

    this.pendingFetches.delete(assetId);
    this.failedAssets.delete(assetId);

    if (markAsMissing) {
      this.missingAssets.add(assetId);
    }

    if (markDomAsLoading) {
      const placeholder = this.generatePlaceholder('Loading...', 'loading');
      const elements = document.querySelectorAll(
        `[data-asset-id="${assetId}"],[data-asset-url*="${assetId}"],[data-asset-src*="${assetId}"],[data-asset-origin*="${assetId}"]`
      );

      for (const el of elements) {
        const tagName = (el.tagName || '').toUpperCase();

        if (tagName === 'IMG') {
          el.src = placeholder;
        } else if (tagName === 'IFRAME') {
          el.src = 'about:blank';
        } else if (tagName === 'A') {
          const original = el.getAttribute('data-asset-url');
          if (original && original.startsWith('asset://')) {
            el.setAttribute('href', original);
          }
        } else if (tagName === 'VIDEO' || tagName === 'AUDIO' || tagName === 'SOURCE') {
          el.removeAttribute('src');
        }

        el.setAttribute('data-asset-id', assetId);
        el.setAttribute('data-asset-loading', 'true');
      }
    }

    Logger.log(
      `[AssetManager] Invalidated local blob for ${assetId.substring(0, 8)}... (reason: ${reason})`
    );
  }

  /**
   * Delete asset from server by clientId (UUID)
   * Non-blocking fire-and-forget operation - failure is logged but doesn't affect local deletion
   * @param {string} assetId - Client-side asset ID (UUID)
   * @private
   */
  async _deleteFromServer(assetId) {
    // Get API config
    const config = window.eXeLearning?.config || {};
    const apiBaseUrl = config.apiUrl || `${window.location.origin}/api`;
    const token = config.token || '';
    const projectUuid = this.projectId;

    if (!projectUuid || !token) {
      // Not in collaborative session, nothing to delete from server
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/projects/${projectUuid}/assets/by-client-id/${assetId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        Logger.log(`[AssetManager] Deleted asset ${assetId.substring(0, 8)}... from server`);
      } else {
        const result = await response.json().catch(() => ({}));
        console.warn(`[AssetManager] Server delete failed for ${assetId.substring(0, 8)}...:`, result.error || response.status);
      }
    } catch (error) {
      // Non-critical - log but don't fail the local deletion
      console.warn(`[AssetManager] Failed to delete ${assetId.substring(0, 8)}... from server:`, error.message);
    }
  }

  /**
   * Delete multiple assets from server by clientIds (UUIDs)
   * Used for efficient folder deletion - single HTTP request instead of N
   * Non-blocking fire-and-forget operation
   * @param {string[]} assetIds - Array of client-side asset IDs (UUIDs)
   * @private
   */
  async _deleteMultipleFromServer(assetIds) {
    if (!assetIds || assetIds.length === 0) {
      return;
    }

    // Get API config
    const config = window.eXeLearning?.config || {};
    const apiBaseUrl = config.apiUrl || `${window.location.origin}/api`;
    const token = config.token || '';
    const projectUuid = this.projectId;

    if (!projectUuid || !token) {
      // Not in collaborative session, nothing to delete from server
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/projects/${projectUuid}/assets/bulk`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ clientIds: assetIds }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        Logger.log(`[AssetManager] Bulk deleted ${result.deleted} assets from server`);
      } else {
        const result = await response.json().catch(() => ({}));
        console.warn(`[AssetManager] Server bulk delete failed:`, result.error || response.status);
      }
    } catch (error) {
      // Non-critical - log but don't fail the local deletion
      console.warn(`[AssetManager] Failed to bulk delete from server:`, error.message);
    }
  }

  /**
   * Clear all assets for the project
   * @returns {Promise<void>}
   */
  async clearProjectAssets() {
    const assets = await this.getProjectAssets();

    for (const asset of assets) {
      await this.deleteAsset(asset.id);
    }

    Logger.log(`[AssetManager] Cleared ${assets.length} assets`);
  }

  // ===== Server Download Methods =====

  /**
   * Download missing assets from server by clientId
   * Uses the by-client-id endpoint to fetch assets that were uploaded by other clients
   * @param {string} apiBaseUrl - Base API URL (e.g., http://localhost:3001/api)
   * @param {string} token - JWT token
   * @param {string} projectUuid - Project UUID
   * @returns {Promise<{downloaded: number, failed: number}>}
   */
  async downloadMissingAssetsFromServer(apiBaseUrl, token, projectUuid) {
    if (this.missingAssets.size === 0) {
      Logger.log('[AssetManager] No missing assets to download');
      return { downloaded: 0, failed: 0 };
    }

    let assetIds = [...this.missingAssets];
    const now = Date.now();
    Logger.log(`[AssetManager] Checking ${assetIds.length} missing assets...`);

    let downloaded = 0;
    let failed = 0;
    let skipped = 0;

    // ===== STEP 1: Try P2P first if WebSocket is connected =====
    // This allows assets from other connected clients to be retrieved
    // without needing them to be saved to the server first
    if (this.wsHandler?.connected && assetIds.length > 0) {
      Logger.log(`[AssetManager] Attempting P2P retrieval for ${assetIds.length} assets...`);

      const p2pResults = await this._requestAssetsFromPeers(assetIds);

      if (p2pResults.received > 0) {
        Logger.log(`[AssetManager] P2P: ${p2pResults.received} assets retrieved from peers`);
        downloaded += p2pResults.received;
      }

      if (p2pResults.pending > 0) {
        Logger.log(`[AssetManager] P2P: ${p2pResults.pending} assets pending (peers are uploading)`);
      }

      // Update asset list - remove those that were successfully retrieved via P2P
      assetIds = [...this.missingAssets];
      Logger.log(`[AssetManager] ${assetIds.length} assets remaining after P2P attempt`);

      if (assetIds.length === 0) {
        return { downloaded, failed: 0, skipped: 0, p2p: p2pResults.received };
      }
    }

    // ===== STEP 2: Fall back to REST API for remaining assets =====
    for (const assetId of assetIds) {
      // Skip if already fetching
      if (this.pendingFetches.has(assetId)) {
        continue;
      }

      // Check if this asset has permanently failed (404 = doesn't exist)
      const failInfo = this.failedAssets.get(assetId);
      if (failInfo) {
        if (failInfo.permanent) {
          // Permanently failed (404) - remove from missing and skip
          this.missingAssets.delete(assetId);
          skipped++;
          continue;
        }
        // Check retry count and cooldown
        if (failInfo.count >= AssetManager.MAX_DOWNLOAD_RETRIES) {
          // Max retries reached - remove from missing
          this.missingAssets.delete(assetId);
          skipped++;
          continue;
        }
        if (now - failInfo.lastAttempt < AssetManager.RETRY_COOLDOWN) {
          // Still in cooldown period
          skipped++;
          continue;
        }
      }

      // Skip if already in cache (was loaded after being marked as missing)
      if (this.blobURLCache.has(assetId)) {
        this.missingAssets.delete(assetId);
        this.failedAssets.delete(assetId); // Clear failure tracking
        continue;
      }

      // Skip if already in memory (just not loaded to URL cache yet)
      const existingAsset = await this.getAsset(assetId);
      if (existingAsset?.blob) {
        // Load it to URL cache (use createBlobURL with fallback)
        const blobURL = await this.createBlobURL(existingAsset.blob);
        this.blobURLCache.set(assetId, blobURL);
        this.reverseBlobCache.set(blobURL, assetId);
        this.missingAssets.delete(assetId);
        this.failedAssets.delete(assetId); // Clear failure tracking
        // Update DOM
        await this.updateDomImagesForAsset(assetId);
        Logger.log(`[AssetManager] Found ${assetId.substring(0, 8)}... in memory, loaded to URL cache`);
        continue;
      }

      this.pendingFetches.add(assetId);

      try {
        const url = `${apiBaseUrl}/projects/${projectUuid}/assets/by-client-id/${assetId}`;
        Logger.log(`[AssetManager] Fetching from server: ${assetId.substring(0, 8)}...`);

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // Track failure
          const currentFail = this.failedAssets.get(assetId) || { count: 0, lastAttempt: 0, permanent: false };
          currentFail.count++;
          currentFail.lastAttempt = now;

          // 404 = asset doesn't exist on server - mark as permanent failure
          if (response.status === 404) {
            currentFail.permanent = true;
            console.warn(`[AssetManager] Asset ${assetId.substring(0, 8)}... not found on server (404) - will not retry`);
          } else {
            console.warn(`[AssetManager] Failed to fetch ${assetId.substring(0, 8)}...: ${response.status} (attempt ${currentFail.count}/${AssetManager.MAX_DOWNLOAD_RETRIES})`);
          }

          this.failedAssets.set(assetId, currentFail);

          // Remove from missing if max retries or permanent
          if (currentFail.permanent || currentFail.count >= AssetManager.MAX_DOWNLOAD_RETRIES) {
            this.missingAssets.delete(assetId);
          }

          failed++;
          continue;
        }

        const blob = await response.blob();
        const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
        const contentDisposition = response.headers.get('Content-Disposition') || '';

        // Extract filename from Content-Disposition
        let filename = `asset-${assetId}`;
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
        }

        // Calculate hash
        const hash = await this.calculateHash(blob);

        // Store in memory
        const asset = {
          id: assetId,
          projectId: this.projectId,
          blob: blob,
          mime: contentType,
          hash: hash,
          size: blob.size,
          uploaded: true, // Already on server
          createdAt: new Date().toISOString(),
          filename: filename,
          folderPath: '' // Downloaded assets go to root by default
        };

        await this.putAsset(asset);

        // Create blob URL and update cache (with fallback for blocked extensions)
        const blobURL = await this.createBlobURL(blob);
        this.blobURLCache.set(assetId, blobURL);
        this.reverseBlobCache.set(blobURL, assetId);

        // Remove from missing set and clear any failure tracking
        this.missingAssets.delete(assetId);
        this.failedAssets.delete(assetId);

        // Update DOM images
        await this.updateDomImagesForAsset(assetId);

        Logger.log(`[AssetManager] Downloaded and cached: ${assetId.substring(0, 8)}...`);
        downloaded++;
      } catch (error) {
        console.error(`[AssetManager] Error downloading ${assetId}:`, error);

        // Track failure for network errors
        const currentFail = this.failedAssets.get(assetId) || { count: 0, lastAttempt: 0, permanent: false };
        currentFail.count++;
        currentFail.lastAttempt = Date.now();
        this.failedAssets.set(assetId, currentFail);

        if (currentFail.count >= AssetManager.MAX_DOWNLOAD_RETRIES) {
          this.missingAssets.delete(assetId);
          console.warn(`[AssetManager] Max retries reached for ${assetId.substring(0, 8)}... - giving up`);
        }

        failed++;
      } finally {
        this.pendingFetches.delete(assetId);
      }
    }

    if (skipped > 0) {
      Logger.log(`[AssetManager] Download complete: ${downloaded} downloaded, ${failed} failed, ${skipped} skipped (already failed)`);
    } else {
      Logger.log(`[AssetManager] Download complete: ${downloaded} downloaded, ${failed} failed`);
    }
    return { downloaded, failed, skipped };
  }

  /**
   * Get missing asset IDs that need to be downloaded
   * @returns {string[]}
   */
  getMissingAssetsList() {
    return [...this.missingAssets];
  }

  /**
   * Check if there are missing assets waiting to be downloaded
   * @returns {boolean}
   */
  hasMissingAssets() {
    return this.missingAssets.size > 0;
  }

  // ===== Peer Coordination Methods =====

  /**
   * Get all asset IDs for this project (from Yjs metadata)
   * Note: Returns all assets regardless of local blob availability
   * For announcing to peers, use getAllLocalBlobIds() instead
   * @returns {Promise<string[]>} Array of asset UUIDs
   */
  async getAllAssetIds() {
    const assets = await this.getProjectAssets();
    return assets.map(a => a.id);
  }

  /**
   * Get asset IDs that have local blobs in memory
   * Used to announce asset availability to peers - only announces assets we can actually serve
   * @returns {Promise<string[]>} Array of asset UUIDs with local blobs
   */
  async getAllLocalBlobIds() {
    const allAssets = await this.getProjectAssets();
    const localBlobIds = [];

    for (const asset of allAssets) {
      // Check if we have the blob locally in memory
      if (asset.blob) {
        localBlobIds.push(asset.id);
      } else {
        // Double-check memory directly
        const hasBlob = await this.hasLocalBlob(asset.id);
        if (hasBlob) {
          localBlobIds.push(asset.id);
        }
      }
    }

    return localBlobIds;
  }

  /**
   * Check if an asset exists locally (metadata or blob)
   * Note: Returns true if Yjs metadata exists, even without local blob
   * Use hasLocalBlob() to check for actual blob availability
   * @param {string} assetId - Asset UUID
   * @returns {Promise<boolean>}
   */
  async hasAsset(assetId) {
    const asset = await this.getAsset(assetId);
    return asset !== null;
  }

  /**
   * Check if asset blob exists in memory (not just metadata)
   * Unlike hasAsset(), this returns true only if the actual binary blob is available locally.
   * Used to determine if we need to fetch the blob from peers or server.
   * @param {string} assetId - Asset UUID
   * @returns {Promise<boolean>}
   */
  async hasLocalBlob(assetId) {
    const blob = await this.getBlob(assetId);
    return blob !== null && blob !== undefined;
  }

  /**
   * Get asset blob by ID (for uploading to server/sending to peer)
   * @param {string} assetId - Asset UUID
   * @returns {Promise<{blob: Blob, mime: string, hash: string, filename: string}|null>}
   */
  async getAssetForUpload(assetId) {
    const asset = await this.getAsset(assetId);
    if (!asset) return null;

    return {
      blob: asset.blob,
      mime: asset.mime,
      hash: asset.hash,
      filename: asset.filename || `asset-${assetId}`,
      size: asset.size,
    };
  }

  /**
   * Store asset received from server (after peer uploaded it)
   * @param {string} assetId - Asset UUID
   * @param {Blob} blob - Asset blob
   * @param {Object} metadata - Asset metadata
   * @returns {Promise<void>}
   */
  async storeAssetFromServer(assetId, blob, metadata = {}) {
    // Check if we already have it
    const existing = await this.getAsset(assetId);
    if (existing) {
      // Check if asset belongs to current project AND has blob
      if (existing.projectId === this.projectId && existing.blob) {
        Logger.log(`[AssetManager] Asset ${assetId.substring(0, 8)}... already exists with blob for this project`);
        return;
      }
      // Asset exists in current project but without blob - update with downloaded blob
      if (existing.projectId === this.projectId && !existing.blob) {
        Logger.log(`[AssetManager] Asset ${assetId.substring(0, 8)}... exists without blob, storing blob`);
        const updatedAsset = {
          ...existing,
          blob: blob,
          mime: metadata.mime || existing.mime || 'application/octet-stream',
          hash: metadata.hash || existing.hash,
          size: metadata.size || existing.size || blob.size,
          filename: metadata.filename || existing.filename,
          folderPath: metadata.folderPath !== undefined ? metadata.folderPath : (existing.folderPath || ''),
          uploaded: true
        };
        await this.putAsset(updatedAsset);

        // Create blob URL and cache it
        try {
          const blobUrl = URL.createObjectURL(blob);
          this.blobURLCache.set(assetId, blobUrl);
          this.reverseBlobCache.set(blobUrl, assetId);
        } catch (e) {
          Logger.log(`[AssetManager] createObjectURL blocked, using data URL fallback`);
        }

        Logger.log(`[AssetManager] Stored blob for existing asset: ${assetId.substring(0, 8)}...`);
        return;
      }
      // Asset exists but for different project - create entry for this project reusing blob
      Logger.log(`[AssetManager] Asset exists in other project, creating for ${this.projectId.substring(0, 8)}...`);
      const reusedAsset = {
        id: assetId,
        projectId: this.projectId,
        blob: existing.blob,
        mime: metadata.mime || existing.mime,
        hash: metadata.hash || existing.hash,
        size: metadata.size || existing.size,
        uploaded: true,
        createdAt: new Date().toISOString(),
        filename: metadata.filename || existing.filename,
        folderPath: metadata.folderPath !== undefined ? metadata.folderPath : (existing.folderPath || '')
      };
      await this.putAsset(reusedAsset);
      Logger.log(`[AssetManager] Stored asset from server (reused): ${assetId.substring(0, 8)}...`);
      return;
    }

    const hash = metadata.hash || await this.calculateHash(blob);

    const asset = {
      id: assetId,
      projectId: this.projectId,
      blob: blob,
      mime: metadata.mime || 'application/octet-stream',
      hash: hash,
      size: metadata.size || blob.size,
      uploaded: true, // Already on server
      createdAt: new Date().toISOString(),
      filename: metadata.filename,
      folderPath: metadata.folderPath || '' // Use folderPath from server, default to root
    };

    await this.putAsset(asset);
    Logger.log(`[AssetManager] Stored asset from server: ${assetId.substring(0, 8)}...`);
  }

  /**
   * Get list of missing asset IDs
   * Compares given list against local assets
   * @param {string[]} assetIds - List of asset IDs to check
   * @returns {Promise<string[]>} List of missing asset IDs
   */
  async getMissingAssetIds(assetIds) {
    const missing = [];
    for (const assetId of assetIds) {
      const exists = await this.hasAsset(assetId);
      if (!exists) {
        missing.push(assetId);
      }
    }
    return missing;
  }

  /**
   * Request assets from peers via WebSocket P2P coordination
   * This is the primary method for getting assets before falling back to REST API
   *
   * @param {string[]} assetIds - Array of asset IDs to request
   * @param {Object} options - Request options
   * @param {number} options.timeout - Timeout per asset in ms (default 10000)
   * @param {number} options.concurrency - Max concurrent requests (default 5)
   * @returns {Promise<{received: number, failed: number, pending: number}>}
   * @private
   */
  async _requestAssetsFromPeers(assetIds, options = {}) {
    const timeout = options.timeout || 10000;
    const concurrency = options.concurrency || 5;

    const results = {
      received: 0,
      failed: 0,
      pending: 0,
    };

    if (!this.wsHandler?.connected || assetIds.length === 0) {
      results.failed = assetIds.length;
      return results;
    }

    // Filter out assets we already have or are already pending
    const toRequest = [];
    for (const assetId of assetIds) {
      // Skip if already in cache
      if (this.blobURLCache.has(assetId)) {
        this.missingAssets.delete(assetId);
        results.received++;
        continue;
      }

      // Skip if blob already exists in memory
      // Note: Use hasLocalBlob() not hasAsset() - the latter returns true for Yjs-only metadata
      const hasBlob = await this.hasLocalBlob(assetId);
      if (hasBlob) {
        // Load to cache
        const asset = await this.getAsset(assetId);
        if (asset && asset.blob) {
          const blobURL = await this.createBlobURL(asset.blob);
          this.blobURLCache.set(assetId, blobURL);
          this.reverseBlobCache.set(blobURL, assetId);
          this.missingAssets.delete(assetId);
          await this.updateDomImagesForAsset(assetId);
          results.received++;
          continue;
        }
      }

      toRequest.push(assetId);
    }

    if (toRequest.length === 0) {
      Logger.log('[AssetManager] All requested assets already available locally');
      return results;
    }

    Logger.log(`[AssetManager] Requesting ${toRequest.length} assets from peers via WebSocket...`);

    // Process in batches for concurrency control
    const batches = [];
    for (let i = 0; i < toRequest.length; i += concurrency) {
      batches.push(toRequest.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      // Request all assets in batch concurrently
      const promises = batch.map(async (assetId) => {
        try {
          // wsHandler.requestAsset returns true if asset was retrieved
          const success = await this.wsHandler.requestAsset(assetId, timeout);

          if (success) {
            // Asset should now be in memory - load to URL cache
            const asset = await this.getAsset(assetId);
            if (asset && asset.blob) {
              const blobURL = await this.createBlobURL(asset.blob);
              this.blobURLCache.set(assetId, blobURL);
              this.reverseBlobCache.set(blobURL, assetId);
              this.missingAssets.delete(assetId);
              this.failedAssets.delete(assetId);
              await this.updateDomImagesForAsset(assetId);
              Logger.log(`[AssetManager] P2P: Retrieved ${assetId.substring(0, 8)}... from peer`);
              return { assetId, status: 'received' };
            }
          }

          // Request was sent but no asset received yet
          // The peer might be uploading - we'll count this as pending
          return { assetId, status: 'pending' };
        } catch (error) {
          console.warn(`[AssetManager] P2P request failed for ${assetId.substring(0, 8)}...:`, error.message);
          return { assetId, status: 'failed' };
        }
      });

      const batchResults = await Promise.all(promises);

      for (const result of batchResults) {
        if (result.status === 'received') {
          results.received++;
        } else if (result.status === 'pending') {
          results.pending++;
        } else {
          results.failed++;
        }
      }
    }

    Logger.log(
      `[AssetManager] P2P results: ${results.received} received, ${results.pending} pending, ${results.failed} failed`
    );

    return results;
  }

  /**
   * Get asset:// URL from a blob:// URL
   * Uses the reverseBlobCache to find the assetId, then constructs asset:// URL
   *
   * @param {string} blobUrl - Blob URL to look up
   * @returns {string|null} Asset URL (asset://assetId) or null if not found
   */
  getAssetUrlFromBlobUrl(blobUrl) {
    if (!blobUrl || !blobUrl.startsWith('blob:')) {
      return null;
    }
    const assetId = this.reverseBlobCache.get(blobUrl);
    if (assetId) {
      Logger.log(`[AssetManager] Recovered asset URL from blob: ${blobUrl.substring(0, 50)}... -> asset://${assetId}`);
      return `asset://${assetId}`;
    }
    return null;
  }

  /**
   * Cleanup blob URLs and clear memory
   * MUST be called when done
   */
  cleanup() {
    // Revoke all blob URLs
    for (const blobURL of this.blobURLCache.values()) {
      URL.revokeObjectURL(blobURL);
    }
    this.blobURLCache.clear();
    this.reverseBlobCache.clear();

    // Clear blob cache (releases memory)
    this.blobCache.clear();

    // Clear Cache API storage
    this.clearCache().catch(() => {});

    Logger.log('[AssetManager] Cleaned up');
  }

  /**
   * Check if there are unsaved assets (blobs in memory that haven't been uploaded)
   * Used by beforeunload handler to warn users
   * @returns {boolean} True if there are unsaved local blobs
   */
  hasUnsavedAssets() {
    // Check if any assets with local blobs have not been uploaded
    const allMetadata = this.getAllAssetsMetadata();
    for (const meta of allMetadata) {
      if (!meta.uploaded && this.blobCache.has(meta.id)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get count of unsaved assets (for UI display)
   * @returns {number} Number of assets with local blobs not yet uploaded
   */
  getUnsavedAssetCount() {
    const allMetadata = this.getAllAssetsMetadata();
    let count = 0;
    for (const meta of allMetadata) {
      if (!meta.uploaded && this.blobCache.has(meta.id)) {
        count++;
      }
    }
    return count;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssetManager;
} else {
  window.AssetManager = AssetManager;
}

/**
 * Global helper to add MIME type attributes to media elements.
 * Must be called BEFORE resolving asset URLs (while extensions are still in URLs).
 * Handles elements with missing, empty, or invalid type attributes.
 *
 * @param {string} html - HTML content with asset:// URLs (containing filenames)
 * @returns {string} - HTML with type attributes added to source/video/audio elements
 */
window.addMediaTypes = function(html) {
  if (!html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const mimeTypes = {
    // Video
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    ogg: 'video/ogg',
    ogv: 'video/ogg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    // Audio
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    oga: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
    // WebM can be audio or video - determine by element tag
    webm: null, // Special handling below
  };

  // Special handling for webm - can be audio or video
  const getWebmType = (tagName) => {
    return tagName.toLowerCase() === 'audio' ? 'audio/webm' : 'video/webm';
  };

  // Extract file extension from URL
  const getExtension = (url) => {
    if (!url) return null;
    let path = url.split('?')[0]; // Remove query string
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash !== -1) path = path.substring(lastSlash + 1);
    const dotIndex = path.lastIndexOf('.');
    return dotIndex !== -1 && dotIndex < path.length - 1
      ? path.substring(dotIndex + 1).toLowerCase()
      : null;
  };

  // Check if element needs a type attribute
  // Returns true if type is missing, empty, or invalid (doesn't contain /)
  const needsType = (el) => {
    const currentType = el.getAttribute('type') || '';
    return !currentType || !currentType.includes('/');
  };

  let modified = 0;

  // Process all source, video[src], audio[src] elements
  doc.querySelectorAll('source, video[src], audio[src]').forEach((el) => {
    if (!needsType(el)) return;

    const src = el.getAttribute('src') || '';
    const ext = getExtension(src);
    if (ext) {
      let mimeType;
      if (ext === 'webm') {
        // Determine parent element for webm - could be audio or video
        const parentTag = el.tagName === 'SOURCE'
          ? el.parentElement?.tagName || 'video'
          : el.tagName;
        mimeType = getWebmType(parentTag);
      } else {
        mimeType = mimeTypes[ext];
      }

      if (mimeType) {
        el.setAttribute('type', mimeType);
        modified++;
      }
    }
  });

  if (modified > 0) {
    Logger.log(`[addMediaTypes] Added MIME types to ${modified} media element(s)`);
  }

  // Check if input was a full document (has DOCTYPE or html/head tags)
  // If so, preserve the document structure. Otherwise, return body content only.
  const isFullDocument = html.trim().startsWith('<!DOCTYPE') ||
                         html.trim().startsWith('<html') ||
                         html.includes('<head>');
  if (isFullDocument) {
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  // For fragments, return only the body content
  return doc.body.innerHTML;
};

/**
 * Global helper to simplify MediaElement.js video structures to native HTML5 video.
 * Converts complex <video class="mediaelement"><source src="..."></video> structures
 * to simple <video src="..." controls> that browsers handle natively.
 * This fixes playback issues with large videos and certain formats.
 *
 * @param {string} html - HTML content
 * @returns {string} - HTML with simplified video elements
 */
window.simplifyMediaElements = function(html) {
  if (!html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  let modified = 0;

  // Mark video elements that have <source> children (avoids :has() which is unsupported in Chrome < 105)
  doc.querySelectorAll('video').forEach((video) => {
    if (video.querySelector('source')) {
      video.classList.add('exe-video-with-source');
    }
  });

  // Find all video elements with class "mediaelement" or with source children
  doc.querySelectorAll('video.mediaelement, video.exe-video-with-source').forEach((video) => {
    // Get the source URL - either from <source> child or from video.src
    let src = video.getAttribute('src') || '';
    const sourceEl = video.querySelector('source');
    if (sourceEl) {
      src = sourceEl.getAttribute('src') || src;
    }

    // Skip if no source found
    if (!src) return;

    // Get type from source if available
    const type = sourceEl?.getAttribute('type') || '';

    // Preserve important attributes
    const width = video.getAttribute('width') || '';
    const height = video.getAttribute('height') || '';
    const poster = video.getAttribute('poster') || '';
    const className = video.className.replace('mediaelement', '').replace('exe-video-with-source', '').trim();

    // Create simple video element
    const newVideo = doc.createElement('video');
    newVideo.setAttribute('src', src);
    newVideo.setAttribute('controls', '');

    if (type) newVideo.setAttribute('type', type);
    if (width) newVideo.setAttribute('width', width);
    if (height) newVideo.setAttribute('height', height);
    if (poster) newVideo.setAttribute('poster', poster);
    if (className) newVideo.className = className;

    // Style for responsive sizing
    newVideo.style.maxWidth = '100%';
    newVideo.style.height = 'auto';

    // Replace the old video with the new simple one
    video.parentNode.replaceChild(newVideo, video);
    modified++;
  });

  // Also simplify audio elements with source children (avoids :has() which is unsupported in Chrome < 105)
  doc.querySelectorAll('audio').forEach((audio) => {
    if (audio.querySelector('source')) {
      audio.classList.add('exe-audio-with-source');
    }
  });

  doc.querySelectorAll('audio.exe-audio-with-source').forEach((audio) => {
    let src = audio.getAttribute('src') || '';
    const sourceEl = audio.querySelector('source');
    if (sourceEl) {
      src = sourceEl.getAttribute('src') || src;
    }

    if (!src) return;

    const type = sourceEl?.getAttribute('type') || '';
    const className = audio.className.replace('exe-audio-with-source', '').trim();

    const newAudio = doc.createElement('audio');
    newAudio.setAttribute('src', src);
    newAudio.setAttribute('controls', '');

    if (type) newAudio.setAttribute('type', type);
    if (className) newAudio.className = className;

    audio.parentNode.replaceChild(newAudio, audio);
    modified++;
  });

  if (modified > 0) {
    Logger.log(`[simplifyMediaElements] Simplified ${modified} media element(s)`);
  }

  // Check if input was a full document (has DOCTYPE or html/head tags)
  // If so, preserve the document structure. Otherwise, return body content only.
  const isFullDocument = html.trim().startsWith('<!DOCTYPE') ||
                         html.trim().startsWith('<html') ||
                         html.includes('<head>');
  if (isFullDocument) {
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  // For fragments, return only the body content
  return doc.body.innerHTML;
};

/**
 * Helper to unescape HTML entities
 * Used by escapePreCodeContent to avoid double-escaping
 *
 * @param {string} str - String with HTML entities
 * @returns {string} - Unescaped string
 */
function unescapeHtml(str) {
  if (!str) return '';
  const map = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&#39;': "'",
  };
  return String(str).replace(/&(amp|lt|gt|quot|#0?39);/gi, m => map[m.toLowerCase()] || m);
}

/**
 * Helper to escape HTML special characters
 *
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Global helper to escape HTML entities inside <pre><code>...</code></pre> blocks.
 * This prevents script tags and other HTML from being executed
 * when shown as example code in the editor view.
 *
 * @param {string} html - HTML content
 * @returns {string} - HTML with escaped content inside pre>code blocks
 */
window.escapePreCodeContent = function(html) {
  if (!html) return html;

  // Match <pre><code>...</code></pre> blocks (with optional attributes/whitespace)
  const PRE_CODE_REGEX = /(<pre[^>]*>\s*<code[^>]*>)([\s\S]*?)(<\/code>\s*<\/pre>)/gi;

  return html.replace(PRE_CODE_REGEX, (match, openTags, innerContent, closeTags) => {
    if (!innerContent.trim()) return openTags + innerContent + closeTags;

    // First decode any existing entities to avoid double-escaping
    const decoded = unescapeHtml(innerContent);
    // Then escape properly
    const escaped = escapeHtml(decoded);
    return openTags + escaped + closeTags;
  });
};

/**
 * Global helper function to resolve asset:// URLs
 * Searches for active AssetManager and resolves
 *
 * @param {string} html - HTML content with asset:// URLs
 * @param {Object} options - Options
 * @param {boolean} options.fetchMissing - If true, triggers fetch for missing assets (default true)
 * @returns {string} - HTML with blob:// URLs (or placeholders for missing)
 */
window.resolveAssetUrls = function(html, options = {}) {
  if (!html) return html;

  const { fetchMissing = true } = options;

  // Try to find active AssetManager from YjsProjectBridge
  const bridge = window.eXeLearning?.app?.project?._yjsBridge;
  const assetManager = bridge?.assetManager;

  if (assetManager && typeof assetManager.resolveHTMLAssetsSync === 'function') {
    const resolved = assetManager.resolveHTMLAssetsSync(html);

    // Trigger async download of missing assets from server
    if (fetchMissing && assetManager.hasMissingAssets()) {
      // Get API config
      const config = window.eXeLearning?.config || {};
      const apiBaseUrl = config.apiUrl || `${window.location.origin}/api`;
      const token = window.eXeLearning?.config?.token || '';
      const projectUuid = bridge?.projectId || '';

      if (token && projectUuid) {
        // Trigger download in background (don't await)
        assetManager.downloadMissingAssetsFromServer(apiBaseUrl, token, projectUuid)
          .then(result => {
            if (result.downloaded > 0) {
              Logger.log(`[AssetManager] Downloaded ${result.downloaded} missing assets`);
            }
          })
          .catch(err => {
            console.warn('[resolveAssetUrls] Failed to download missing assets:', err);
          });
      } else {
        console.warn('[resolveAssetUrls] Missing token or projectUuid for asset download');
      }
    }

    return resolved;
  }

  // Legacy fallback: try AssetCacheManager
  const assetCache = bridge?.assetCache;
  if (assetCache && typeof assetCache.resolveHtmlAssetUrlsSync === 'function') {
    return assetCache.resolveHtmlAssetUrlsSync(html);
  }

  // No manager available - return original
  return html;
};

/**
 * Convert blob:// URL to data: URL for cross-window compatibility.
 * blob: URLs are specific to the window context where they were created,
 * so they don't work in popup/preview windows. data: URLs work everywhere.
 *
 * @param {string} blobUrl - blob:// URL
 * @returns {Promise<string>} - data: URL or original URL if conversion failed
 */
async function blobUrlToDataUrl(blobUrl) {
  try {
    const response = await fetch(blobUrl);
    if (!response.ok) {
      console.warn('[AssetManager] Failed to fetch blob URL:', blobUrl, response.status);
      return blobUrl;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => {
        console.warn('[AssetManager] FileReader error for blob:', blobUrl);
        // Return original URL on error instead of rejecting
        resolve(blobUrl);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[AssetManager] Failed to convert blob URL to data URL:', blobUrl, error);
    return blobUrl;
  }
}

/**
 * Global async helper function to resolve asset:// URLs
 * Waits for assets to be fetched if missing
 * Also converts blob:// URLs to data:// URLs for cross-window compatibility (preview popup)
 *
 * @param {string} html - HTML content with asset:// URLs
 * @param {Object} options - Options
 * @param {boolean} options.addTrackingAttrs - Add data-asset-id for DOM updates
 * @param {boolean} options.convertBlobUrls - Convert blob:// to data:// (default: true)
 * @returns {Promise<string>} - HTML with resolved URLs
 */
window.resolveAssetUrlsAsync = async function(html, options = {}) {
  if (!html) return html;

  const bridge = window.eXeLearning?.app?.project?._yjsBridge;
  const assetManager = bridge?.assetManager;
  const wsHandler = bridge?.assetWebSocketHandler;

  let result = html;
  let iframePlaceholders = [];

  // If skipIframeSrc is true, temporarily replace iframe asset:// URLs with placeholders
  // This allows PDFs to be handled separately in the preview (accessing AssetManager directly)
  if (options.skipIframeSrc) {
    const iframeAssetPattern = /(<iframe[^>]*\ssrc=["'])(asset:\/\/[^"']+)(["'][^>]*>)/gi;
    let placeholderIndex = 0;
    result = result.replace(iframeAssetPattern, (match, before, assetUrl, after) => {
      const placeholder = `__IFRAME_ASSET_PLACEHOLDER_${placeholderIndex}__`;
      iframePlaceholders.push({ placeholder, before, assetUrl, after });
      placeholderIndex++;
      return `${before}${placeholder}${after}`;
    });
  }

  // First: resolve asset:// URLs to blob:// URLs
  if (assetManager && typeof assetManager.resolveHTMLAssets === 'function') {
    result = await assetManager.resolveHTMLAssets(result, {
      wsHandler,
      addTrackingAttrs: options.addTrackingAttrs,
    });
  } else {
    // Legacy fallback
    const assetCache = bridge?.assetCache;
    if (assetCache && typeof assetCache.resolveHtmlAssetUrls === 'function') {
      result = await assetCache.resolveHtmlAssetUrls(result);
    }
  }

  // Restore iframe asset:// URLs from placeholders
  for (const { placeholder, before, assetUrl, after } of iframePlaceholders) {
    result = result.replace(`${before}${placeholder}${after}`, `${before}${assetUrl}${after}`);
  }

  // Second: Convert blob:// URLs to data:// URLs for cross-window compatibility
  // This is needed for preview popups where blob: URLs from the main window don't work
  const convertBlobUrls = options.convertBlobUrls !== false;
  const convertIframeBlobUrls = options.convertIframeBlobUrls !== false;

  if (convertBlobUrls) {
    // Find all blob: URLs in src and href attributes
    const blobUrlPattern = /(?:src|href)="(blob:[^"]+)"/g;
    const matches = [...result.matchAll(blobUrlPattern)];
    const blobUrls = matches.map(m => m[1]);
    const uniqueBlobUrls = [...new Set(blobUrls)];

    if (uniqueBlobUrls.length > 0) {
      // Convert all unique blob URLs to data URLs in parallel
      const conversions = await Promise.all(
        uniqueBlobUrls.map(async url => ({
          original: url,
          converted: await blobUrlToDataUrl(url),
        })),
      );

      // OPTIMIZATION: Single-pass replacement using regex instead of multiple split/join
      const blobReplacements = new Map(
        conversions.filter(c => c.original !== c.converted)
                   .map(c => [c.original, c.converted])
      );
      if (blobReplacements.size > 0) {
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(
          Array.from(blobReplacements.keys()).map(escapeRegex).join('|'),
          'g'
        );
        result = result.replace(pattern, (m) => blobReplacements.get(m) || m);
      }
    }
  } else if (convertIframeBlobUrls) {
    // When convertBlobUrls is false (to avoid memory issues with large videos),
    // we still need to convert iframe blob URLs to data URLs because:
    // - Nested blob:// URLs in iframes can't access the parent window's blob cache
    // - PDFs embedded as iframes will show ERR_BLOCKED_BY_CLIENT otherwise
    // - PDFs are typically smaller than videos, so data URLs are acceptable
    const iframeBlobPattern = /<iframe[^>]*\ssrc="(blob:[^"]+)"[^>]*>/gi;
    const matches = [...result.matchAll(iframeBlobPattern)];
    const blobUrls = matches.map(m => m[1]);
    const uniqueBlobUrls = [...new Set(blobUrls)];

    if (uniqueBlobUrls.length > 0) {
      // Convert all unique iframe blob URLs to data URLs in parallel
      const conversions = await Promise.all(
        uniqueBlobUrls.map(async url => ({
          original: url,
          converted: await blobUrlToDataUrl(url),
        })),
      );

      // Replace only in iframe elements
      const blobReplacements = new Map(
        conversions.filter(c => c.original !== c.converted)
                   .map(c => [c.original, c.converted])
      );
      if (blobReplacements.size > 0) {
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(
          Array.from(blobReplacements.keys()).map(escapeRegex).join('|'),
          'g'
        );
        result = result.replace(pattern, (m) => blobReplacements.get(m) || m);
      }
    }
  }

  return result;
};
