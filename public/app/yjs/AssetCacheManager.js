/**
 * AssetCacheManager
 * Handles caching of project assets in IndexedDB for offline support.
 * Assets (images, videos, etc.) are stored as blobs and served locally when offline.
 */
class AssetCacheManager {
  static DB_NAME = 'exelearning-assets';
  static DB_VERSION = 2; // Bumped for path index
  static STORE_NAME = 'assets';
  static MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB per project

  /**
   * @param {string|number} projectId - The project ID (can be odeSessionId string)
   */
  constructor(projectId) {
    this.projectId = projectId;
    this.db = null;
    this.objectURLs = new Map(); // Track created object URLs for cleanup
    this.pathToUrlCache = new Map(); // In-memory cache: originalPath -> blobURL
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
      console.warn('[AssetCacheManager] createObjectURL blocked, using data URL fallback');
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
   * Open the IndexedDB database
   * @returns {Promise<IDBDatabase>}
   */
  async openDB() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(AssetCacheManager.DB_NAME, AssetCacheManager.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      // Handle blocked event - occurs when another tab has an older version open
      request.onblocked = () => {
        console.warn('[AssetCacheManager] Database upgrade blocked by another tab. Rejecting with empty result.');
        reject(new Error('Database blocked by another tab'));
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(AssetCacheManager.STORE_NAME)) {
          const store = db.createObjectStore(AssetCacheManager.STORE_NAME, {
            keyPath: ['projectId', 'assetId'],
          });
          store.createIndex('projectId', 'projectId', { unique: false });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          store.createIndex('originalPath', ['projectId', 'metadata.originalPath'], { unique: false });
        } else {
          // Upgrade existing store to add originalPath index
          const tx = event.target.transaction;
          const store = tx.objectStore(AssetCacheManager.STORE_NAME);
          if (!store.indexNames.contains('originalPath')) {
            store.createIndex('originalPath', ['projectId', 'metadata.originalPath'], { unique: false });
          }
        }
      };
    });
  }

  /**
   * Cache an asset blob
   * @param {number} assetId - The asset ID
   * @param {Blob} blob - The asset data
   * @param {Object} metadata - Asset metadata (filename, mimeType, etc.)
   */
  async cacheAsset(assetId, blob, metadata = {}) {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(AssetCacheManager.STORE_NAME, 'readwrite');
      const store = tx.objectStore(AssetCacheManager.STORE_NAME);

      const record = {
        projectId: this.projectId,
        assetId,
        blob,
        metadata,
        size: blob.size,
        cachedAt: Date.now(),
      };

      const request = store.put(record);
      request.onsuccess = () => {
        Logger.log(`[AssetCacheManager] Cached asset ${assetId} (${blob.size} bytes)`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a cached asset
   * @param {number} assetId
   * @returns {Promise<{blob: Blob, metadata: Object}|null>}
   */
  async getAsset(assetId) {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(AssetCacheManager.STORE_NAME, 'readonly');
      const store = tx.objectStore(AssetCacheManager.STORE_NAME);
      const request = store.get([this.projectId, assetId]);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({ blob: result.blob, metadata: result.metadata });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get an asset as an object URL
   * @param {number} assetId
   * @returns {Promise<string|null>}
   */
  async getAssetUrl(assetId) {
    const cached = await this.getAsset(assetId);
    if (!cached) return null;

    // Create and track object URL (with fallback for blocked extensions)
    const url = await this.createBlobURL(cached.blob);
    this.objectURLs.set(assetId, url);
    return url;
  }

  /**
   * Get an asset by its original file path
   * @param {string} originalPath - The original path (e.g., "20251009090601ROYVYO/sq01.jpg")
   * @returns {Promise<{blob: Blob, metadata: Object}|null>}
   */
  async getAssetByPath(originalPath) {
    // Check in-memory cache first
    if (this.pathToUrlCache.has(originalPath)) {
      const cachedUrl = this.pathToUrlCache.get(originalPath);
      // Return a dummy structure - the URL is already available
      return { url: cachedUrl, fromCache: true };
    }

    const db = await this.openDB();
    const assets = await this.getAllAssets();

    // Find asset with matching originalPath in metadata
    const asset = assets.find(a =>
      a.metadata && a.metadata.originalPath === originalPath
    );

    return asset ? { blob: asset.blob, metadata: asset.metadata } : null;
  }

  /**
   * Resolve an asset URL from path - returns blob URL if cached, null otherwise
   * This is the main method for resolving {{context_path}} URLs to local blob URLs
   *
   * @param {string} assetPath - Path like "ideviceId/image.jpg" or full "{{context_path}}/ideviceId/image.jpg"
   * @returns {Promise<string|null>} - Blob URL if found, null if not cached
   */
  async resolveAssetUrl(assetPath) {
    // Normalize path - remove {{context_path}}/ prefix if present
    let normalizedPath = assetPath;
    if (assetPath.includes('{{context_path}}/')) {
      normalizedPath = assetPath.replace('{{context_path}}/', '');
    }
    // Also handle URL-encoded version
    if (assetPath.includes('%7B%7Bcontext_path%7D%7D/')) {
      normalizedPath = assetPath.replace('%7B%7Bcontext_path%7D%7D/', '');
    }

    // Check in-memory cache first (fastest)
    if (this.pathToUrlCache.has(normalizedPath)) {
      return this.pathToUrlCache.get(normalizedPath);
    }

    // Try to get from IndexedDB
    const cached = await this.getAssetByPath(normalizedPath);
    if (cached && cached.blob) {
      const url = await this.createBlobURL(cached.blob);
      this.pathToUrlCache.set(normalizedPath, url);
      this.objectURLs.set(normalizedPath, url);
      Logger.log(`[AssetCacheManager] Resolved ${normalizedPath} -> blob URL`);
      return url;
    }

    return null;
  }

  /**
   * Resolve all asset URLs in an HTML string
   * Replaces {{context_path}}/path/to/asset.jpg with blob URLs
   *
   * @param {string} html - HTML content with {{context_path}} URLs
   * @returns {Promise<string>} - HTML with resolved blob URLs
   */
  async resolveHtmlAssetUrls(html) {
    if (!html) return html;

    // Find all {{context_path}} references
    const contextPathRegex = /\{\{context_path\}\}\/([^"'\s<>]+)/g;
    const matches = [...html.matchAll(contextPathRegex)];

    if (matches.length === 0) return html;

    let resolvedHtml = html;

    for (const match of matches) {
      const fullMatch = match[0]; // {{context_path}}/path/to/file.jpg
      const assetPath = match[1]; // path/to/file.jpg

      const blobUrl = await this.resolveAssetUrl(assetPath);
      if (blobUrl) {
        resolvedHtml = resolvedHtml.split(fullMatch).join(blobUrl);
      }
    }

    return resolvedHtml;
  }

  /**
   * Preload all assets for the project into memory (blob URLs)
   * Call this after importing to have all URLs ready
   * @returns {Promise<number>} - Number of assets preloaded
   */
  async preloadAllAssets() {
    const assets = await this.getAllAssets();
    let count = 0;

    for (const asset of assets) {
      if (asset.metadata && asset.metadata.originalPath && asset.blob) {
        const url = await this.createBlobURL(asset.blob);
        this.pathToUrlCache.set(asset.metadata.originalPath, url);
        this.objectURLs.set(asset.metadata.originalPath, url);
        count++;
      }
    }

    Logger.log(`[AssetCacheManager] Preloaded ${count} assets as blob URLs`);
    return count;
  }

  /**
   * Synchronously resolve an asset URL from in-memory cache
   * Use this after preloadAllAssets() has been called
   * @param {string} assetPath - Path like "ideviceId/image.jpg"
   * @returns {string|null} - Blob URL if found in memory, null otherwise
   */
  resolveAssetUrlSync(assetPath) {
    // Normalize path
    let normalizedPath = assetPath;
    if (assetPath.includes('{{context_path}}/')) {
      normalizedPath = assetPath.replace('{{context_path}}/', '');
    }
    if (assetPath.includes('%7B%7Bcontext_path%7D%7D/')) {
      normalizedPath = assetPath.replace('%7B%7Bcontext_path%7D%7D/', '');
    }

    return this.pathToUrlCache.get(normalizedPath) || null;
  }

  /**
   * Synchronously resolve all asset URLs in an HTML string
   * Uses in-memory cache only (call preloadAllAssets first)
   *
   * Searches for both patterns:
   * 1. {{context_path}}/ideviceId/file.jpg - original XML format
   * 2. files/tmp/YYYY/MM/DD/sessionId/ideviceId/file.jpg - server URL format
   *
   * @param {string} html - HTML content with asset URLs
   * @returns {string} - HTML with resolved blob URLs (or original if not cached)
   */
  resolveHtmlAssetUrlsSync(html) {
    if (!html) return html;

    let resolvedHtml = html;

    // Pattern 1: {{context_path}}/path/to/file.jpg
    const contextPathRegex = /\{\{context_path\}\}\/([^"'\s<>]+)/g;
    resolvedHtml = resolvedHtml.replace(contextPathRegex, (fullMatch, assetPath) => {
      const blobUrl = this.resolveAssetUrlSync(assetPath);
      return blobUrl || fullMatch;
    });

    // Pattern 2: files/tmp/YYYY/MM/DD/sessionId/path/to/file.jpg
    // Extract the asset path after the sessionId directory
    const serverUrlRegex = /files\/tmp\/\d{4}\/\d{2}\/\d{2}\/([^/]+)\/([^"'\s<>]+)/g;
    resolvedHtml = resolvedHtml.replace(serverUrlRegex, (fullMatch, sessionId, assetPath) => {
      // The asset path in cache includes the ideviceId folder
      const fullAssetPath = assetPath;
      const blobUrl = this.resolveAssetUrlSync(fullAssetPath);
      return blobUrl || fullMatch;
    });

    return resolvedHtml;
  }

  /**
   * Fetch an asset from server and cache it
   * @param {number} assetId
   * @param {string} apiUrl
   * @param {string} token
   * @returns {Promise<string>} - Object URL to the cached asset
   */
  async fetchAndCache(assetId, apiUrl, token) {
    // Check cache first
    const cached = await this.getAsset(assetId);
    if (cached) {
      const url = await this.createBlobURL(cached.blob);
      this.objectURLs.set(assetId, url);
      return url;
    }

    // Fetch from server
    const response = await fetch(`${apiUrl}/projects/${this.projectId}/assets/${assetId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch asset: ${response.status}`);
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('content-disposition') || '';
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    const filename = filenameMatch ? filenameMatch[1] : `asset-${assetId}`;

    const metadata = {
      filename,
      mimeType: response.headers.get('content-type') || 'application/octet-stream',
      size: blob.size,
    };

    // Cache the asset
    await this.cacheAsset(assetId, blob, metadata);

    // Return object URL (with fallback for blocked extensions)
    const url = await this.createBlobURL(blob);
    this.objectURLs.set(assetId, url);
    return url;
  }

  /**
   * Delete a cached asset
   * @param {number} assetId
   */
  async deleteAsset(assetId) {
    const db = await this.openDB();

    // Revoke object URL if exists
    const url = this.objectURLs.get(assetId);
    if (url) {
      URL.revokeObjectURL(url);
      this.objectURLs.delete(assetId);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(AssetCacheManager.STORE_NAME, 'readwrite');
      const store = tx.objectStore(AssetCacheManager.STORE_NAME);
      const request = store.delete([this.projectId, assetId]);

      request.onsuccess = () => {
        Logger.log(`[AssetCacheManager] Deleted cached asset ${assetId}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all cached assets for the project
   * @returns {Promise<Array>}
   */
  async getAllAssets() {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(AssetCacheManager.STORE_NAME, 'readonly');
      const store = tx.objectStore(AssetCacheManager.STORE_NAME);
      const index = store.index('projectId');
      const request = index.getAll(this.projectId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get total cache size for the project
   * @returns {Promise<number>} - Size in bytes
   */
  async getCacheSize() {
    const assets = await this.getAllAssets();
    return assets.reduce((total, asset) => total + (asset.size || 0), 0);
  }

  /**
   * Clear all cached assets for the project
   */
  async clearCache() {
    // Revoke all object URLs
    for (const url of this.objectURLs.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectURLs.clear();

    const db = await this.openDB();
    const assets = await this.getAllAssets();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(AssetCacheManager.STORE_NAME, 'readwrite');
      const store = tx.objectStore(AssetCacheManager.STORE_NAME);

      let deleted = 0;
      assets.forEach((asset) => {
        store.delete([this.projectId, asset.assetId]);
        deleted++;
      });

      tx.oncomplete = () => {
        Logger.log(`[AssetCacheManager] Cleared ${deleted} assets from cache`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Prune old assets if cache exceeds max size
   */
  async pruneIfNeeded() {
    const size = await this.getCacheSize();
    if (size <= AssetCacheManager.MAX_CACHE_SIZE) return;

    Logger.log(`[AssetCacheManager] Cache size (${size}) exceeds max, pruning...`);

    const assets = await this.getAllAssets();
    // Sort by cachedAt (oldest first)
    assets.sort((a, b) => a.cachedAt - b.cachedAt);

    let currentSize = size;
    for (const asset of assets) {
      if (currentSize <= AssetCacheManager.MAX_CACHE_SIZE * 0.8) break;
      await this.deleteAsset(asset.assetId);
      currentSize -= asset.size || 0;
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Revoke all object URLs
    for (const url of this.objectURLs.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectURLs.clear();

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    Logger.log('[AssetCacheManager] Destroyed');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssetCacheManager;
} else {
  window.AssetCacheManager = AssetCacheManager;
}

/**
 * Global helper function to resolve asset URLs
 * Searches for an active AssetCacheManager and resolves {{context_path}} URLs
 *
 * @param {string} html - HTML content that may contain {{context_path}} URLs
 * @returns {string} - HTML with resolved blob URLs (or original if no cache available)
 */
window.resolveAssetUrls = function(html) {
  if (!html) return html;

  // Try to find active asset cache from YjsProjectBridge
  const assetCache = window.eXeLearning?.app?.project?._yjsBridge?.assetCache;

  if (assetCache && typeof assetCache.resolveHtmlAssetUrlsSync === 'function') {
    return assetCache.resolveHtmlAssetUrlsSync(html);
  }

  // Fallback: return original HTML if no cache available
  return html;
};
