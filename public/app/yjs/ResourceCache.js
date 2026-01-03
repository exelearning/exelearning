/**
 * ResourceCache
 *
 * Persistent cache for static resources (themes, iDevices, libraries) using IndexedDB.
 * Caches ZIP bundles extracted from the server to avoid re-fetching on page reload.
 *
 * Key features:
 * - Version-based cache invalidation (new app version = new cache entries)
 * - Stores Map<path, Blob> as serialized entries per resource type
 * - Follows AssetManager pattern for IndexedDB operations
 *
 * Usage:
 *   const cache = new ResourceCache();
 *   await cache.init();
 *   const files = await cache.get('theme', 'base', 'v3.1.0');
 *   if (!files) {
 *     const fetched = await fetchThemeFromServer();
 *     await cache.set('theme', 'base', 'v3.1.0', fetched);
 *   }
 */

// Logger is defined globally by yjs-loader.js before this file loads

class ResourceCache {
  static DB_NAME = 'exelearning-resources-v1';
  static DB_VERSION = 1;
  static STORE_NAME = 'resources';

  constructor() {
    this.db = null;
  }

  /**
   * Build cache key from type, name, and version
   * @param {string} type - Resource type ('theme', 'idevice', 'libs', etc.)
   * @param {string} name - Resource name (e.g., 'base', 'FreeTextIdevice')
   * @param {string} version - App version (e.g., 'v3.1.0')
   * @returns {string}
   */
  static buildKey(type, name, version) {
    return `${type}:${name}:${version}`;
  }

  /**
   * Initialize database connection
   * Must be called before any other operations.
   * @returns {Promise<void>}
   */
  async init() {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ResourceCache.DB_NAME, ResourceCache.DB_VERSION);

      request.onerror = () => {
        console.error('[ResourceCache] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        Logger.log('[ResourceCache] Initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(ResourceCache.STORE_NAME)) {
          const store = db.createObjectStore(ResourceCache.STORE_NAME, {
            keyPath: 'key',
          });

          // Index by type for bulk operations
          store.createIndex('type', 'type', { unique: false });
          // Index by version for cleanup
          store.createIndex('version', 'version', { unique: false });

          Logger.log('[ResourceCache] Created resources object store');
        }
      };
    });
  }

  /**
   * Get cached resource files
   * @param {string} type - Resource type
   * @param {string} name - Resource name
   * @param {string} version - App version
   * @returns {Promise<Map<string, Blob>|null>} Map of path -> Blob, or null if not cached
   */
  async get(type, name, version) {
    if (!this.db) throw new Error('Database not initialized');

    const key = ResourceCache.buildKey(type, name, version);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.STORE_NAME], 'readonly');
      const store = transaction.objectStore(ResourceCache.STORE_NAME);
      const request = store.get(key);

      request.onerror = () => {
        console.error('[ResourceCache] Get failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Reconstruct Map from stored entries
        const files = new Map();
        for (const entry of result.files) {
          files.set(entry.path, entry.blob);
        }

        Logger.log(`[ResourceCache] Cache hit: ${key} (${files.size} files)`);
        resolve(files);
      };
    });
  }

  /**
   * Store resource files in cache
   * @param {string} type - Resource type
   * @param {string} name - Resource name
   * @param {string} version - App version
   * @param {Map<string, Blob>} files - Map of path -> Blob
   * @returns {Promise<void>}
   */
  async set(type, name, version, files) {
    if (!this.db) throw new Error('Database not initialized');

    const key = ResourceCache.buildKey(type, name, version);

    // Convert Map to array of {path, blob} for storage
    const filesArray = [];
    for (const [path, blob] of files) {
      filesArray.push({ path, blob });
    }

    const entry = {
      key,
      type,
      name,
      version,
      files: filesArray,
      cachedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(ResourceCache.STORE_NAME);
      const request = store.put(entry);

      request.onerror = () => {
        console.error('[ResourceCache] Set failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        Logger.log(`[ResourceCache] Cached: ${key} (${files.size} files)`);
        resolve();
      };
    });
  }

  /**
   * Check if resource is cached
   * @param {string} type - Resource type
   * @param {string} name - Resource name
   * @param {string} version - App version
   * @returns {Promise<boolean>}
   */
  async has(type, name, version) {
    if (!this.db) throw new Error('Database not initialized');

    const key = ResourceCache.buildKey(type, name, version);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.STORE_NAME], 'readonly');
      const store = transaction.objectStore(ResourceCache.STORE_NAME);
      const request = store.count(IDBKeyRange.only(key));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result > 0);
    });
  }

  /**
   * Delete specific cached resource
   * @param {string} type - Resource type
   * @param {string} name - Resource name
   * @param {string} version - App version
   * @returns {Promise<void>}
   */
  async delete(type, name, version) {
    if (!this.db) throw new Error('Database not initialized');

    const key = ResourceCache.buildKey(type, name, version);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(ResourceCache.STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        Logger.log(`[ResourceCache] Deleted: ${key}`);
        resolve();
      };
    });
  }

  /**
   * Clear all cached resources
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(ResourceCache.STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        Logger.log('[ResourceCache] All cache cleared');
        resolve();
      };
    });
  }

  /**
   * Clear cached resources for a specific version (cleanup old versions)
   * @param {string} version - Version to clear
   * @returns {Promise<number>} Number of entries deleted
   */
  async clearByVersion(version) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(ResourceCache.STORE_NAME);
      const index = store.index('version');
      const request = index.openCursor(IDBKeyRange.only(version));

      let deletedCount = 0;

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          deletedCount++;
          cursor.continue();
        } else {
          Logger.log(`[ResourceCache] Cleared ${deletedCount} entries for version ${version}`);
          resolve(deletedCount);
        }
      };
    });
  }

  /**
   * Clear cached resources except for current version
   * @param {string} currentVersion - Version to keep
   * @returns {Promise<number>} Number of entries deleted
   */
  async clearOldVersions(currentVersion) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(ResourceCache.STORE_NAME);
      const request = store.openCursor();

      let deletedCount = 0;

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.version !== currentVersion) {
            store.delete(cursor.primaryKey);
            deletedCount++;
          }
          cursor.continue();
        } else {
          Logger.log(`[ResourceCache] Cleared ${deletedCount} old version entries`);
          resolve(deletedCount);
        }
      };
    });
  }

  /**
   * Get cache statistics
   * @returns {Promise<{count: number, types: Object<string, number>}>}
   */
  async getStats() {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.STORE_NAME], 'readonly');
      const store = transaction.objectStore(ResourceCache.STORE_NAME);
      const request = store.openCursor();

      const stats = { count: 0, types: {} };

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          stats.count++;
          const type = cursor.value.type;
          stats.types[type] = (stats.types[type] || 0) + 1;
          cursor.continue();
        } else {
          resolve(stats);
        }
      };
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      Logger.log('[ResourceCache] Closed');
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResourceCache;
} else {
  window.ResourceCache = ResourceCache;
}
