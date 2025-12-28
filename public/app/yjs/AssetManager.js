/**
 * AssetManager
 *
 * Offline-first asset management for eXeLearning.
 *
 * Key features:
 * - Assets referenced with asset:// URLs in HTML (not base64 or http://)
 * - Stored in IndexedDB for offline use
 * - Deduplication by SHA-256 hash
 * - Uploaded to server only on explicit save
 *
 * Usage:
 *   const manager = new AssetManager(projectId);
 *   await manager.init();
 *   const assetUrl = await manager.insertImage(file);  // Returns "asset://uuid"
 *   const blobUrl = await manager.resolveAssetURL(assetUrl);  // Returns "blob://..."
 */

// Logger is defined globally by yjs-loader.js before this file loads

class AssetManager {
  static DB_NAME = 'exelearning-assets-v2';
  static DB_VERSION = 2; // Incremented to add projectId_uploaded index
  static STORE_NAME = 'assets';

  /**
   * @param {string} projectId - Project UUID
   */
  constructor(projectId) {
    this.projectId = projectId;
    this.db = null;

    // Cache of blob URLs: assetId -> blob:// URL
    this.blobURLCache = new Map();

    // Reverse cache: blob:// URL -> assetId
    this.reverseBlobCache = new Map();

    // Priority queue reference (set externally)
    this.priorityQueue = null;

    // WebSocket handler reference (set externally)
    this.wsHandler = null;
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
   * Initialize database connection
   * Must be called before any other operations.
   * @returns {Promise<void>}
   */
  async init() {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(AssetManager.DB_NAME, AssetManager.DB_VERSION);

      request.onerror = () => {
        console.error('[AssetManager] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        Logger.log(`[AssetManager] Initialized for project ${this.projectId}`);
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        if (!db.objectStoreNames.contains(AssetManager.STORE_NAME)) {
          // Fresh install - create store with all indexes
          const store = db.createObjectStore(AssetManager.STORE_NAME, {
            keyPath: 'id'
          });

          store.createIndex('projectId', 'projectId', { unique: false });
          store.createIndex('hash', 'hash', { unique: false });
          store.createIndex('uploaded', 'uploaded', { unique: false });
          store.createIndex('projectId_uploaded', ['projectId', 'uploaded'], { unique: false });

          Logger.log('[AssetManager] Created assets object store with all indexes');
        } else if (oldVersion < 2) {
          // Migration from v1 to v2: add projectId_uploaded index
          const transaction = event.target.transaction;
          const store = transaction.objectStore(AssetManager.STORE_NAME);

          if (!store.indexNames.contains('projectId_uploaded')) {
            store.createIndex('projectId_uploaded', ['projectId', 'uploaded'], { unique: false });
            Logger.log('[AssetManager] Added projectId_uploaded index (migration v1->v2)');
          }
        }
      };
    });
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
   * @param {Blob} blob
   * @returns {Promise<string>} Hex string hash
   */
  async calculateHash(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
   * Store asset in IndexedDB
   * @param {Object} asset
   * @returns {Promise<void>}
   */
  async putAsset(asset) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([AssetManager.STORE_NAME], 'readwrite');
      const store = tx.objectStore(AssetManager.STORE_NAME);
      store.put(asset);

      // Wait for transaction to fully commit, not just put success
      // This ensures data is available for subsequent reads
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get asset by ID
   * @param {string} id - Asset UUID
   * @returns {Promise<Object|null>}
   */
  async getAsset(id) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([AssetManager.STORE_NAME], 'readonly');
      const store = tx.objectStore(AssetManager.STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all assets for the project
   * @returns {Promise<Array>}
   */
  async getProjectAssets() {
    if (!this.db) throw new Error('Database not initialized');

    // Validate projectId is a valid IndexedDB key (string)
    if (!this.projectId || typeof this.projectId !== 'string') {
      console.warn('[AssetManager] getProjectAssets: Invalid projectId, returning empty array');
      return [];
    }

    Logger.log(`[AssetManager] getProjectAssets: Querying for projectId: ${this.projectId}`);

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([AssetManager.STORE_NAME], 'readonly');
      const store = tx.objectStore(AssetManager.STORE_NAME);
      const index = store.index('projectId');
      const request = index.getAll(this.projectId);

      request.onsuccess = () => {
        const assets = request.result || [];
        Logger.log(`[AssetManager] getProjectAssets: Found ${assets.length} assets for projectId: ${this.projectId}`);
        if (assets.length === 0) {
          // Debug: Log all assets in DB to see what projectIds exist
          const allRequest = store.getAll();
          allRequest.onsuccess = () => {
            const allAssets = allRequest.result || [];
            const projectIds = [...new Set(allAssets.map(a => a.projectId))];
            console.warn(`[AssetManager] getProjectAssets: 0 assets found. Total assets in DB: ${allAssets.length}. Unique projectIds: ${projectIds.join(', ')}`);
          };
        }
        resolve(assets);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get ALL assets from IndexedDB without filtering by projectId.
   * Used as a fallback when getProjectAssets returns 0 assets (for debugging).
   * @returns {Promise<Array>}
   */
  async getAllAssetsRaw() {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([AssetManager.STORE_NAME], 'readonly');
      const store = tx.objectStore(AssetManager.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const assets = request.result || [];
        Logger.log(`[AssetManager] getAllAssetsRaw: Found ${assets.length} total assets in DB`);
        resolve(assets);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Find asset by hash (for deduplication)
   * @param {string} hash - SHA-256 hash
   * @returns {Promise<Object|null>}
   */
  async findByHash(hash) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([AssetManager.STORE_NAME], 'readonly');
      const store = tx.objectStore(AssetManager.STORE_NAME);
      const index = store.index('hash');
      const request = index.getAll(hash);

      request.onsuccess = () => {
        const assets = request.result;
        // Find one in the same project
        const match = assets.find(a => a.projectId === this.projectId);
        resolve(match || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get assets pending upload
   * @returns {Promise<Array>}
   */
  async getPendingAssets() {
    if (!this.db) throw new Error('Database not initialized');

    // Validate projectId is a valid IndexedDB key (string)
    if (!this.projectId || typeof this.projectId !== 'string') {
      console.warn('[AssetManager] getPendingAssets: Invalid projectId:', this.projectId, 'type:', typeof this.projectId);
      return [];
    }

    // Note: We use manual filtering because IndexedDB compound index with boolean
    // doesn't work reliably (boolean is not a valid key type in IndexedDB spec)
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([AssetManager.STORE_NAME], 'readonly');
      const store = tx.objectStore(AssetManager.STORE_NAME);
      const index = store.index('projectId');
      const request = index.getAll(this.projectId);

      request.onsuccess = () => {
        const assets = request.result || [];
        const pending = assets.filter(a => a.uploaded === false);
        resolve(pending);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mark asset as uploaded
   * @param {string} id - Asset UUID
   * @returns {Promise<void>}
   */
  async markAssetUploaded(id) {
    const asset = await this.getAsset(id);
    if (!asset) {
      console.warn(`[AssetManager] Cannot mark asset ${id} as uploaded: not found`);
      return;
    }
    asset.uploaded = true;
    await this.putAsset(asset);
  }

  /**
   * Insert image file
   *
   * Flow:
   * 1. Read file as blob
   * 2. Calculate SHA-256 hash
   * 3. Generate deterministic ID from hash (content-addressable)
   * 4. Check if already exists (same content = same ID)
   * 5. Store in IndexedDB with uploaded=false
   * 6. Return asset:// URL
   *
   * @param {File} file - Image file
   * @returns {Promise<string>} asset:// URL
   */
  async insertImage(file) {
    Logger.log(`[AssetManager] Inserting image: ${file.name} (${file.size} bytes, ${file.type})`);
    Logger.log(`[AssetManager] Current projectId: ${this.projectId}`);

    // 1. Create blob
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });

    // 2. Calculate hash
    const hash = await this.calculateHash(blob);
    Logger.log(`[AssetManager] Hash: ${hash.substring(0, 16)}...`);

    // 3. Generate deterministic ID from hash (content-addressable)
    const assetId = this.hashToUUID(hash);
    Logger.log(`[AssetManager] Content-addressable ID: ${assetId}`);

    // 4. Check if already exists (same content = same ID)
    const existing = await this.getAsset(assetId);
    if (existing) {
      // Ensure blob URL is in cache for immediate availability
      if (!this.blobURLCache.has(assetId) && existing.blob) {
        const blobUrl = URL.createObjectURL(existing.blob);
        this.blobURLCache.set(assetId, blobUrl);
        this.reverseBlobCache.set(blobUrl, assetId);
        Logger.log(`[AssetManager] Cached existing blob URL for ${assetId}`);
      }

      // Check if asset belongs to current project
      if (existing.projectId === this.projectId) {
        Logger.log(`[AssetManager] Asset already exists for this project: ${assetId}`);
        const existingFilename = existing.filename || file.name;
        return `asset://${assetId}/${existingFilename}`;
      }
      // Asset exists but for different project - create entry for this project reusing blob
      Logger.log(`[AssetManager] Asset exists in other project, creating for ${this.projectId.substring(0, 8)}...`);
      const reusedAsset = {
        id: assetId,
        projectId: this.projectId,
        blob: existing.blob,
        mime: file.type || this.getMimeType(file.name),
        hash: hash,
        size: existing.size,
        uploaded: false,
        createdAt: new Date().toISOString(),
        filename: file.name
      };
      await this.putAsset(reusedAsset);
      return `asset://${assetId}/${file.name}`;
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
      filename: file.name
    };

    await this.putAsset(asset);
    Logger.log(`[AssetManager] Stored new asset ${assetId}`);

    // 6. Add to blob URL cache immediately for instant availability
    const blobUrl = URL.createObjectURL(blob);
    this.blobURLCache.set(assetId, blobUrl);
    this.reverseBlobCache.set(blobUrl, assetId);
    Logger.log(`[AssetManager] Cached blob URL for ${assetId}`);

    // 7. Return asset:// URL with filename (e.g., asset://uuid/image.jpg)
    return `asset://${assetId}/${file.name}`;
  }

  /**
   * Extract asset ID from asset:// URL
   * Handles both old format (asset://uuid) and new format (asset://uuid/filename)
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

    // If path contains /, take only the first part (UUID)
    const slashIndex = path.indexOf('/');
    return slashIndex > 0 ? path.substring(0, slashIndex) : path;
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
      // Extract UUID from corrupted path
      const match = path.match(/asset\/+([a-f0-9-]{36})(?:\/(.+))?/i);
      if (match) {
        const uuid = match[1];
        const filename = match[2] || '';
        const sanitized = filename ? `asset://${uuid}/${filename}` : `asset://${uuid}`;
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

    // Check cache first (using synced method to ensure reverseBlobCache consistency)
    const cachedBlobUrl = this.getBlobURLSynced(assetId);
    if (cachedBlobUrl) {
      return cachedBlobUrl;
    }

    // Load from IndexedDB
    const asset = await this.getAsset(assetId);
    if (!asset) {
      console.warn(`[AssetManager] Asset not found: ${assetId}`);
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

    // Find all asset:// references (supports both asset://uuid and asset://uuid/filename)
    // Also matches corrupted URLs like asset://asset//uuid/filename
    // NOTE: Filename part can contain spaces, so we match until quote character
    // Note: [^"'\\&] excludes quotes, backslash, AND ampersand to avoid matching:
    //   - JSON escape sequences (backslash)
    //   - HTML entities like &quot; in data-idevice-json-data attributes (ampersand)
    const assetRegex = /asset:\/\/(?:asset\/+)?([a-f0-9-]+)(\/[^"'\\&]+)?/gi;
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
    // Note: [^"'&] excludes ampersand for HTML entities in JSON data attributes
    const imgAssetRegex = /(<img[^>]*?)src=(["'])(asset:\/\/(?:asset\/+)?([a-f0-9-]+)(?:\/[^"'&]+)?)\2([^>]*>)/gi;

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

    // Phase 2: Handle any remaining asset:// URLs (video, audio, background-image, etc.)
    // These won't have img-specific tracking but will still be resolved
    // Also handles corrupted URLs like asset://asset//uuid/filename
    // Note: [^"'\\] excludes quotes AND backslash to avoid matching JSON escape sequences
    const assetRegex = /asset:\/\/(?:asset\/+)?([a-f0-9-]+)(\/[^"'\\]+)?/gi;

    resolvedHTML = resolvedHTML.replace(assetRegex, (fullMatch, assetId) => {
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
   * Extract assets from ZIP file (for .elpx import)
   *
   * Finds all images, stores in IndexedDB, returns mapping.
   * Also handles {{context_path}} replacement.
   *
   * @param {Object} zip - fflate extracted ZIP object {path: Uint8Array}
   * @returns {Promise<Map<string, string>>} Map of originalPath -> assetId
   */
  async extractAssetsFromZip(zip) {
    if (!this.db) {
      throw new Error('AssetManager not initialized. Call init() first before extracting assets.');
    }

    const assetMap = new Map();
    const assetFiles = [];

    // Find all asset files (zip is an object with path -> Uint8Array)
    for (const [relativePath, fileData] of Object.entries(zip)) {
      // Skip directories (they end with /)
      if (relativePath.endsWith('/')) continue;
      if (relativePath.startsWith('__MACOSX')) continue;
      if (relativePath.endsWith('.xml')) continue;

      // Include files from resources/ folder (attached files from FileAttachIdevice, etc.)
      // These can be ANY file type (.elp, .txt, custom extensions, etc.)
      const isResourceFile = relativePath.startsWith('resources/') ||
                            relativePath.includes('/resources/');

      // Include images, video, audio, documents, 3D models and common media
      const isMediaFile = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico|tiff?|mp4|m4v|webm|mov|avi|mkv|mp3|m4a|ogg|wav|aac|flac|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|gltf|glb|stl|elp|elpx|txt|html?|css|js|json|csv|tsv|rtf|odt|ods|odp|epub|mobi)$/i.test(relativePath);

      if (isResourceFile || isMediaFile) {
        assetFiles.push({ path: relativePath, fileData });
      }
    }

    Logger.log(`[AssetManager] Found ${assetFiles.length} assets in ZIP`);

    for (const { path, fileData } of assetFiles) {
      try {
        // fileData is already a Uint8Array from fflate
        const arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
        const mime = this.getMimeType(path);
        const blob = new Blob([arrayBuffer], { type: mime });

        // Calculate hash
        const hash = await this.calculateHash(blob);

        // Generate deterministic ID from hash (content-addressable)
        const assetId = this.hashToUUID(hash);

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
            filename: path.split('/').pop(),
            originalPath: path
          };
          await this.putAsset(reusedAsset);
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
          filename: path.split('/').pop(),
          originalPath: path  // Store original path for {{context_path}} mapping
        };

        await this.putAsset(asset);
        assetMap.set(path, assetId);

        Logger.log(`[AssetManager] Extracted ${path} → ${assetId.substring(0, 8)}...`);
      } catch (e) {
        console.error(`[AssetManager] Failed to extract ${path}:`, e);
      }
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

    // Pattern: {{context_path}}/path/to/file.jpg
    const contextPathRegex = /\{\{context_path\}\}\/([^"'\s<>]+)/g;

    convertedHTML = convertedHTML.replace(contextPathRegex, (fullMatch, assetPath) => {
      // Clean up path - remove trailing backslash/special chars and normalize
      let cleanPath = assetPath.replace(/[\\\s]+$/, '').trim();

      // Try to find asset by exact path
      if (assetMap.has(cleanPath)) {
        const assetId = assetMap.get(cleanPath);
        return `asset://${assetId}`;
      }

      // Try with common prefixes (ZIP structure varies)
      const prefixes = ['', 'content/', 'content/resources/', 'resources/'];
      for (const prefix of prefixes) {
        const fullPath = prefix + cleanPath;
        if (assetMap.has(fullPath)) {
          return `asset://${assetMap.get(fullPath)}`;
        }
      }

      // Try without leading directory (iDevices sometimes use just filename)
      const filename = cleanPath.split('/').pop();
      for (const [path, assetId] of assetMap.entries()) {
        if (path.endsWith('/' + filename) || path === filename) {
          return `asset://${assetId}`;
        }
      }

      // Try matching just the last part of the path (e.g., UUID/file.ext)
      const pathParts = cleanPath.split('/');
      if (pathParts.length >= 2) {
        const shortPath = pathParts.slice(-2).join('/');
        for (const [path, assetId] of assetMap.entries()) {
          if (path.endsWith(shortPath)) {
            return `asset://${assetId}`;
          }
        }
      }

      console.warn(`[AssetManager] Asset not found for path: ${cleanPath}`);
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

    for (const asset of assets) {
      if (!this.blobURLCache.has(asset.id)) {
        // Use createBlobURL with fallback for blocked extensions
        const blobURL = await this.createBlobURL(asset.blob);
        this.blobURLCache.set(asset.id, blobURL);
        this.reverseBlobCache.set(blobURL, asset.id);
        count++;
      }
    }

    Logger.log(`[AssetManager] Preloaded ${count} assets`);
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
      const response = await fetch(`${apiBaseUrl}/api/projects/${this.projectId}/assets`, {
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
      const response = await fetch(`${apiBaseUrl}/api/projects/${this.projectId}/assets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.warn('[AssetManager] Failed to fetch asset list from server');
        return 0;
      }

      const serverAssets = await response.json();
      Logger.log(`[AssetManager] Server has ${serverAssets.length} assets`);

      // Find missing locally
      const missing = [];
      for (const serverAsset of serverAssets) {
        const local = await this.getAsset(serverAsset.id);
        if (!local) {
          missing.push(serverAsset.id);
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
            `${apiBaseUrl}/api/projects/${this.projectId}/assets/${assetId}`,
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
            filename: filename
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

    // Find all images with data-asset-id attribute matching this asset
    const images = document.querySelectorAll(`img[data-asset-id="${assetId}"]`);
    for (const img of images) {
      img.src = blobUrl;
      img.removeAttribute('data-asset-loading');
      count++;
    }

    // Also check for background images in style attributes
    const elements = document.querySelectorAll(`[data-asset-id="${assetId}"]`);
    for (const el of elements) {
      if (el.style.backgroundImage && el.style.backgroundImage.includes('data:image')) {
        el.style.backgroundImage = `url(${blobUrl})`;
        el.removeAttribute('data-asset-loading');
        count++;
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
    const assetId = assetUrl.replace('asset://', '');
    const { wsHandler = null, returnPlaceholder = true } = options;

    // Check cache first
    if (this.blobURLCache.has(assetId)) {
      return {
        url: this.blobURLCache.get(assetId),
        isPlaceholder: false,
        assetId,
      };
    }

    // Try to load from IndexedDB
    const asset = await this.getAsset(assetId);
    if (asset) {
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
    const { pageId = null, reason = 'render' } = options;

    // Check cache first
    if (this.blobURLCache.has(assetId)) {
      return {
        url: this.blobURLCache.get(assetId),
        isPlaceholder: false,
        assetId,
      };
    }

    // Try to load from IndexedDB
    const asset = await this.getAsset(assetId);
    if (asset) {
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
        if (!asset) {
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
   * Get statistics
   * @returns {Promise<{total: number, pending: number, uploaded: number, totalSize: number}>}
   */
  async getStats() {
    const all = await this.getProjectAssets();
    const pending = all.filter(a => !a.uploaded);
    const uploaded = all.filter(a => a.uploaded);
    const totalSize = all.reduce((sum, a) => sum + a.size, 0);

    return {
      total: all.length,
      pending: pending.length,
      uploaded: uploaded.length,
      totalSize
    };
  }

  /**
   * Update asset filename
   * @param {string} id - Asset UUID
   * @param {string} newFilename - New filename
   * @returns {Promise<void>}
   */
  async updateAssetFilename(id, newFilename) {
    const asset = await this.getAsset(id);
    if (!asset) {
      console.warn(`[AssetManager] Cannot update filename for ${id}: not found`);
      return;
    }
    asset.filename = newFilename;
    await this.putAsset(asset);
    Logger.log(`[AssetManager] Updated filename for ${id} to ${newFilename}`);
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
   * Delete asset
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteAsset(id) {
    if (!this.db) throw new Error('Database not initialized');

    // Revoke blob URL if exists
    const blobURL = this.blobURLCache.get(id);
    if (blobURL) {
      URL.revokeObjectURL(blobURL);
      this.blobURLCache.delete(id);
      this.reverseBlobCache.delete(blobURL);
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([AssetManager.STORE_NAME], 'readwrite');
      const store = tx.objectStore(AssetManager.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
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

      // Skip if already in IndexedDB (just not loaded to cache yet)
      const existingAsset = await this.getAsset(assetId);
      if (existingAsset) {
        // Load it to cache (use createBlobURL with fallback)
        const blobURL = await this.createBlobURL(existingAsset.blob);
        this.blobURLCache.set(assetId, blobURL);
        this.reverseBlobCache.set(blobURL, assetId);
        this.missingAssets.delete(assetId);
        this.failedAssets.delete(assetId); // Clear failure tracking
        // Update DOM
        await this.updateDomImagesForAsset(assetId);
        Logger.log(`[AssetManager] Found ${assetId.substring(0, 8)}... in IndexedDB, loaded to cache`);
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

        // Store in IndexedDB
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
   * Get all asset IDs for this project
   * Used to announce asset availability to peers
   * @returns {Promise<string[]>} Array of asset UUIDs
   */
  async getAllAssetIds() {
    const assets = await this.getProjectAssets();
    return assets.map(a => a.id);
  }

  /**
   * Check if an asset exists locally
   * @param {string} assetId - Asset UUID
   * @returns {Promise<boolean>}
   */
  async hasAsset(assetId) {
    const asset = await this.getAsset(assetId);
    return asset !== null;
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
      // Check if asset belongs to current project
      if (existing.projectId === this.projectId) {
        Logger.log(`[AssetManager] Asset ${assetId.substring(0, 8)}... already exists for this project`);
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
        size: existing.size,
        uploaded: true,
        createdAt: new Date().toISOString(),
        filename: metadata.filename || existing.filename,
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
      size: blob.size,
      uploaded: true, // Already on server
      createdAt: new Date().toISOString(),
      filename: metadata.filename,
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

      // Skip if already in IndexedDB
      const exists = await this.hasAsset(assetId);
      if (exists) {
        // Load to cache
        const asset = await this.getAsset(assetId);
        if (asset) {
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
            // Asset should now be in IndexedDB - load to cache
            const asset = await this.getAsset(assetId);
            if (asset) {
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
   * Cleanup blob URLs and close database
   * MUST be called when done
   */
  cleanup() {
    // Revoke all blob URLs
    for (const blobURL of this.blobURLCache.values()) {
      URL.revokeObjectURL(blobURL);
    }
    this.blobURLCache.clear();
    this.reverseBlobCache.clear();

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    Logger.log('[AssetManager] Cleaned up');
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

  // Find all video elements with class "mediaelement" or with source children
  doc.querySelectorAll('video.mediaelement, video:has(source)').forEach((video) => {
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
    const className = video.className.replace('mediaelement', '').trim();

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

  // Also simplify audio elements with source children
  doc.querySelectorAll('audio:has(source)').forEach((audio) => {
    let src = audio.getAttribute('src') || '';
    const sourceEl = audio.querySelector('source');
    if (sourceEl) {
      src = sourceEl.getAttribute('src') || src;
    }

    if (!src) return;

    const type = sourceEl?.getAttribute('type') || '';
    const className = audio.className;

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
