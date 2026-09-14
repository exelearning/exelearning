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
  static DB_VERSION = 3; // Bumped for per-user themes
  static STORE_NAME = 'resources';
  static USER_THEMES_STORE = 'user-themes';

  constructor() {
    this.db = null;
  }

  /**
   * Get current user ID for per-user storage
   * Falls back to 'anonymous' if user not available
   * @returns {string}
   * @private
   */
  _getCurrentUserId() {
    // Use the same pattern as iDevices favorites (menuIdevicesBottom.js)
    return window.eXeLearning?.app?.user?.name || 'anonymous';
  }

  /**
   * Build storage key for user theme (includes user ID)
   * @param {string} themeName - Theme name
   * @returns {string} Key in format "userId:themeName"
   * @private
   */
  _buildUserThemeKey(themeName) {
    const userId = this._getCurrentUserId();
    return `${userId}:${themeName}`;
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
        const oldVersion = event.oldVersion;

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

        // Version 3: Recreate user-themes store with per-user support
        // Delete old store if upgrading from version 2
        if (oldVersion === 2 && db.objectStoreNames.contains(ResourceCache.USER_THEMES_STORE)) {
          db.deleteObjectStore(ResourceCache.USER_THEMES_STORE);
          Logger.log('[ResourceCache] Deleted old user-themes store for migration');
        }

        // Create user-themes store with per-user key (userId:themeName)
        if (!db.objectStoreNames.contains(ResourceCache.USER_THEMES_STORE)) {
          const userThemesStore = db.createObjectStore(ResourceCache.USER_THEMES_STORE, {
            keyPath: 'id', // Composite key: "userId:themeName"
          });

          // Index by userId for listing user's themes
          userThemesStore.createIndex('userId', 'userId', { unique: false });
          // Index by importedAt for sorting
          userThemesStore.createIndex('importedAt', 'importedAt', { unique: false });

          Logger.log('[ResourceCache] Created user-themes object store (per-user)');
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
   * Match plain app versions and resource versions with hash or timestamp suffixes.
   * @param {string} version - Cached resource version
   * @param {string} currentVersion - Current app version
   * @returns {boolean}
   */
  static isCurrentVersion(version, currentVersion) {
    return typeof version === 'string' &&
      (version === currentVersion || version.startsWith(`${currentVersion}-`));
  }

  /**
   * Build the group key identifying a cached resource regardless of its version.
   * Composite versions embed a per-resource cache-buster, so several entries may
   * describe the same resource; they all share this key.
   * @param {Object} entry - Stored cache entry
   * @returns {string|null} Group key, or null when the entry carries no usable metadata
   */
  static buildResourceGroupKey(entry) {
    const type = entry?.type;
    const name = entry?.name;

    if (typeof type !== 'string' || typeof name !== 'string') return null;

    return `${type}:${name}`;
  }

  /**
   * Read an entry write timestamp, treating missing or invalid values as oldest.
   * @param {Object} entry - Stored cache entry
   * @returns {number}
   */
  static getCachedAt(entry) {
    const cachedAt = entry?.cachedAt;
    return typeof cachedAt === 'number' && Number.isFinite(cachedAt) ? cachedAt : 0;
  }

  /**
   * Decide whether a candidate entry supersedes the newest one seen so far for
   * the same resource. Ties keep the incumbent, so cleanup stays deterministic.
   * @param {{cachedAt: number}} candidate - Entry currently under the cursor
   * @param {{cachedAt: number}|undefined} incumbent - Newest entry kept so far
   * @returns {boolean}
   */
  static isNewerEntry(candidate, incumbent) {
    return !incumbent || candidate.cachedAt > incumbent.cachedAt;
  }

  /**
   * Clear cached resources except for the newest entry of each current-version resource.
   * Old app versions are dropped entirely; within the current version only the most
   * recently written entry per resource survives, so re-uploaded site themes and
   * rebuilt library bundles do not pile up superseded copies.
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
      const newestPerResource = new Map();

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (!ResourceCache.isCurrentVersion(cursor.value.version, currentVersion)) {
            store.delete(cursor.primaryKey);
            deletedCount++;
          } else {
            const groupKey = ResourceCache.buildResourceGroupKey(cursor.value);

            // Entries without type/name metadata cannot be grouped safely, so they
            // are kept as-is rather than risking the loss of an unrelated resource.
            if (groupKey !== null) {
              const candidate = {
                primaryKey: cursor.primaryKey,
                cachedAt: ResourceCache.getCachedAt(cursor.value),
              };
              const incumbent = newestPerResource.get(groupKey);

              if (ResourceCache.isNewerEntry(candidate, incumbent)) {
                if (incumbent) {
                  store.delete(incumbent.primaryKey);
                  deletedCount++;
                }
                newestPerResource.set(groupKey, candidate);
              } else {
                store.delete(candidate.primaryKey);
                deletedCount++;
              }
            }
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

  // ========================================
  // User Themes Methods (persistent, version-independent)
  // ========================================

  /**
   * Store a user theme in IndexedDB (per-user storage)
   * @param {string} name - Theme name
   * @param {Uint8Array} compressedFiles - ZIP compressed theme files
   * @param {Object} config - Theme configuration from config.xml
   * @param {string} config.displayName - Display name for UI
   * @param {string} config.version - Theme version
   * @param {string} config.author - Theme author
   * @param {string} config.description - Theme description
   * @param {string[]} config.cssFiles - List of CSS files
   * @returns {Promise<void>}
   */
  async setUserTheme(name, compressedFiles, config) {
    if (!this.db) throw new Error('Database not initialized');

    const userId = this._getCurrentUserId();
    const id = this._buildUserThemeKey(name);

    const entry = {
      id, // Composite key: "userId:themeName"
      userId, // For index-based queries
      name, // Theme name (for display)
      files: compressedFiles, // ZIP compressed Uint8Array
      config,
      importedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.USER_THEMES_STORE], 'readwrite');
      const store = transaction.objectStore(ResourceCache.USER_THEMES_STORE);
      const request = store.put(entry);

      request.onerror = () => {
        console.error('[ResourceCache] setUserTheme failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        Logger.log(`[ResourceCache] Saved user theme: ${name} (user: ${userId})`);
        resolve();
      };
    });
  }

  /**
   * Get a user theme from IndexedDB (per-user storage)
   * @param {string} name - Theme name
   * @returns {Promise<{files: Map<string, Blob>, config: Object}|null>} Theme data or null if not found
   */
  async getUserTheme(name) {
    if (!this.db) throw new Error('Database not initialized');

    const id = this._buildUserThemeKey(name);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.USER_THEMES_STORE], 'readonly');
      const store = transaction.objectStore(ResourceCache.USER_THEMES_STORE);
      const request = store.get(id);

      request.onerror = () => {
        console.error('[ResourceCache] getUserTheme failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Decompress ZIP to Map<path, Blob>
        try {
          const files = this._decompressThemeFiles(result.files);
          Logger.log(`[ResourceCache] Retrieved user theme: ${name} (${files.size} files)`);
          resolve({ files, config: result.config });
        } catch (error) {
          console.error('[ResourceCache] Failed to decompress theme:', error);
          reject(error);
        }
      };
    });
  }

  /**
   * Get raw compressed data for a user theme (for Yjs sync, per-user storage)
   * @param {string} name - Theme name
   * @returns {Promise<{compressedFiles: Uint8Array, config: Object}|null>} Raw compressed data or null
   */
  async getUserThemeRaw(name) {
    if (!this.db) throw new Error('Database not initialized');

    const id = this._buildUserThemeKey(name);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.USER_THEMES_STORE], 'readonly');
      const store = transaction.objectStore(ResourceCache.USER_THEMES_STORE);
      const request = store.get(id);

      request.onerror = () => {
        console.error('[ResourceCache] getUserThemeRaw failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        resolve({
          compressedFiles: result.files,
          config: result.config,
        });
      };
    });
  }

  /**
   * Check if a user theme exists in IndexedDB (per-user storage)
   * @param {string} name - Theme name
   * @returns {Promise<boolean>}
   */
  async hasUserTheme(name) {
    if (!this.db) throw new Error('Database not initialized');

    const id = this._buildUserThemeKey(name);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.USER_THEMES_STORE], 'readonly');
      const store = transaction.objectStore(ResourceCache.USER_THEMES_STORE);
      const request = store.count(IDBKeyRange.only(id));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result > 0);
    });
  }

  /**
   * Update a user theme's config in IndexedDB (per-user storage)
   * Only updates the config fields, keeps the theme files unchanged
   * @param {string} name - Theme name
   * @param {Object} configUpdates - Fields to update in config
   * @returns {Promise<void>}
   */
  async updateUserThemeConfig(name, configUpdates) {
    if (!this.db) throw new Error('Database not initialized');

    const id = this._buildUserThemeKey(name);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.USER_THEMES_STORE], 'readwrite');
      const store = transaction.objectStore(ResourceCache.USER_THEMES_STORE);
      const getRequest = store.get(id);

      getRequest.onerror = () => {
        console.error('[ResourceCache] updateUserThemeConfig get failed:', getRequest.error);
        reject(getRequest.error);
      };

      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          reject(new Error(`Theme '${name}' not found`));
          return;
        }

        // Merge config updates
        const updatedEntry = {
          ...existing,
          config: {
            ...existing.config,
            ...configUpdates,
          },
          modifiedAt: Date.now(),
        };

        const putRequest = store.put(updatedEntry);

        putRequest.onerror = () => {
          console.error('[ResourceCache] updateUserThemeConfig put failed:', putRequest.error);
          reject(putRequest.error);
        };

        putRequest.onsuccess = () => {
          Logger.log(`[ResourceCache] Updated user theme config: ${name}`);
          resolve();
        };
      };
    });
  }

  /**
   * Delete a user theme from IndexedDB (per-user storage)
   * @param {string} name - Theme name
   * @returns {Promise<void>}
   */
  async deleteUserTheme(name) {
    if (!this.db) throw new Error('Database not initialized');

    const id = this._buildUserThemeKey(name);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.USER_THEMES_STORE], 'readwrite');
      const store = transaction.objectStore(ResourceCache.USER_THEMES_STORE);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        Logger.log(`[ResourceCache] Deleted user theme: ${name}`);
        resolve();
      };
    });
  }

  /**
   * List all user themes in IndexedDB for the current user
   * @returns {Promise<Array<{name: string, config: Object, importedAt: number}>>}
   */
  async listUserThemes() {
    if (!this.db) throw new Error('Database not initialized');

    const userId = this._getCurrentUserId();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ResourceCache.USER_THEMES_STORE], 'readonly');
      const store = transaction.objectStore(ResourceCache.USER_THEMES_STORE);
      const index = store.index('userId');
      const request = index.openCursor(IDBKeyRange.only(userId));

      const themes = [];

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          // Only return metadata, not the actual files
          themes.push({
            name: cursor.value.name,
            config: cursor.value.config,
            importedAt: cursor.value.importedAt,
          });
          cursor.continue();
        } else {
          // Sort by importedAt descending (most recent first)
          themes.sort((a, b) => b.importedAt - a.importedAt);
          resolve(themes);
        }
      };
    });
  }

  /**
   * Decompress ZIP file to Map<path, Blob>
   * Uses fflate library (must be loaded globally)
   * @param {Uint8Array} compressed - ZIP compressed data
   * @returns {Map<string, Blob>}
   * @private
   */
  _decompressThemeFiles(compressed) {
    if (!window.fflate) {
      throw new Error('fflate library not loaded');
    }

    const decompressed = window.fflate.unzipSync(compressed);
    const files = new Map();

    for (const [path, data] of Object.entries(decompressed)) {
      // Convert Uint8Array to Blob with appropriate MIME type
      const mimeType = this._getMimeType(path);
      const blob = new Blob([data], { type: mimeType });
      files.set(path, blob);
    }

    return files;
  }

  /**
   * Get MIME type for file path
   * @param {string} path - File path
   * @returns {string} MIME type
   * @private
   */
  _getMimeType(path) {
    const ext = path.split('.').pop()?.toLowerCase();
    const mimeTypes = {
      css: 'text/css',
      js: 'application/javascript',
      html: 'text/html',
      xml: 'application/xml',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      eot: 'application/vnd.ms-fontobject',
    };
    return mimeTypes[ext] || 'application/octet-stream';
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
