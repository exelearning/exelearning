/**
 * ResourceFetcher
 * Fetches server resources (themes, iDevices, libraries) for client-side exports.
 *
 * Optimized with:
 * - ZIP bundle fetching (single request instead of N+1 requests)
 * - IndexedDB persistent cache via ResourceCache
 * - Fallback to individual file fetches for user themes
 *
 * Usage:
 *   const fetcher = new ResourceFetcher();
 *   await fetcher.init();  // Initialize cache
 *   const files = await fetcher.fetchTheme('base');  // Returns Map<path, Blob>
 */

// Third-party libraries that live in /libs/ not /app/common/
// Used to determine the correct path and avoid 404 noise during exports
const THIRD_PARTY_LIBS = new Set([
  'abcjs',
  'bootstrap',
  'exe_atools',
  'exe_elpx_download',
  'fflate',
  'filegator',
  'interact',
  'jquery',
  'jquery-ui',
  'showdown',
  'simplelightbox',
  'tinymce_5',
  'yjs',
]);

class ResourceFetcher {
  constructor() {
    // In-memory cache for the session
    this.cache = new Map();
    // Get basePath from eXeLearning globals (for subdirectory installs)
    this.basePath = window.eXeLearning?.config?.basePath || '';
    // Base URL for API endpoints (includes basePath)
    this.apiBase = `${this.basePath}/api/resources`;
    // Version for cache-busting static file URLs
    this.version = window.eXeLearning?.version || 'v0.0.0';
    // Persistent IndexedDB cache (set via init() or setResourceCache())
    this.resourceCache = null;
    // Bundle manifest (loaded on init)
    this.bundleManifest = null;
    // Whether bundles are available
    this.bundlesAvailable = false;
    // Static mode detection (cached for performance)
    this._isStaticMode = null;
    // User theme files (from .elpx imports, stored in Yjs)
    // Map<themeName, Object<relativePath, Uint8Array>>
    this.userThemeFiles = new Map();
  }

  /**
   * Check if running in static (offline) mode.
   * Prefers capabilities check, falls back to direct mode detection.
   * @returns {boolean}
   */
  isStaticMode() {
    if (this._isStaticMode === null) {
      // Prefer capabilities check (new pattern)
      const capabilities = window.eXeLearning?.app?.capabilities;
      if (capabilities) {
        this._isStaticMode = !capabilities.storage.remote;
      } else {
        // Fallback to direct detection
        this._isStaticMode = window.__EXE_STATIC_MODE__ === true ||
                             window.eXeLearning?.config?.isStaticMode === true;
      }
    }
    return this._isStaticMode;
  }

  /**
   * Get the URL for a bundle file, handling static mode
   * @param {string} bundleType - Type of bundle (theme, idevices, libs, etc.)
   * @param {string} [name] - Name for named bundles (e.g., theme name)
   * @returns {string} Bundle URL
   */
  getBundleUrl(bundleType, name = null) {
    if (this.isStaticMode()) {
      // In static mode, bundles are in ./bundles/ folder
      switch (bundleType) {
        case 'theme':
          return `${this.basePath}/bundles/themes/${name}.zip`;
        case 'idevices':
          return `${this.basePath}/bundles/idevices.zip`;
        case 'libs':
          return `${this.basePath}/bundles/libs.zip`;
        case 'common':
          return `${this.basePath}/bundles/common.zip`;
        case 'content-css':
          return `${this.basePath}/bundles/content-css.zip`;
        default:
          return `${this.basePath}/bundles/${bundleType}.zip`;
      }
    }

    // Server mode: use API endpoints
    switch (bundleType) {
      case 'theme':
        return `${this.apiBase}/bundle/theme/${name}`;
      case 'idevices':
        return `${this.apiBase}/bundle/idevices`;
      case 'libs':
        return `${this.apiBase}/bundle/libs`;
      case 'common':
        return `${this.apiBase}/bundle/common`;
      case 'content-css':
        return `${this.apiBase}/bundle/content-css`;
      default:
        return `${this.apiBase}/bundle/${bundleType}`;
    }
  }

  /**
   * Initialize ResourceFetcher with optional ResourceCache
   * @param {ResourceCache} [resourceCache] - Optional ResourceCache instance
   * @returns {Promise<void>}
   */
  async init(resourceCache = null) {
    if (resourceCache) {
      this.resourceCache = resourceCache;
    }

    // Load bundle manifest to check what bundles are available
    await this.loadBundleManifest();
  }

  /**
   * Set the ResourceCache instance
   * @param {ResourceCache} resourceCache
   */
  setResourceCache(resourceCache) {
    this.resourceCache = resourceCache;
  }

  /**
   * Set user theme files imported from .elpx
   * User themes are stored client-side in Yjs and need to be registered
   * with ResourceFetcher for export functionality.
   * @param {string} themeName - Theme name/directory
   * @param {Object<string, Uint8Array>} files - Map of relativePath -> file content
   */
  async setUserThemeFiles(themeName, files) {
    this.userThemeFiles.set(themeName, files);
    Logger.log(`[ResourceFetcher] Registered user theme '${themeName}' with ${Object.keys(files).length} files`);

    // Also update the in-memory cache
    const cacheKey = `theme:${themeName}`;
    const themeFiles = new Map();

    // Convert Uint8Array to Blob for consistency with other themes
    for (const [relativePath, uint8Array] of Object.entries(files)) {
      const ext = relativePath.split('.').pop()?.toLowerCase() || '';
      const mimeTypes = {
        css: 'text/css',
        js: 'application/javascript',
        json: 'application/json',
        html: 'text/html',
        xml: 'text/xml',
        svg: 'image/svg+xml',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        woff: 'font/woff',
        woff2: 'font/woff2',
        ttf: 'font/ttf',
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      const blob = new Blob([uint8Array], { type: mimeType });
      themeFiles.set(relativePath, blob);
    }

    this.cache.set(cacheKey, themeFiles);
  }

  /**
   * Check if a theme is a user theme (stored in Yjs)
   * @param {string} themeName - Theme name
   * @returns {boolean}
   */
  hasUserTheme(themeName) {
    return this.userThemeFiles.has(themeName);
  }

  /**
   * Get user theme files (synchronous, from memory only)
   * @param {string} themeName - Theme name
   * @returns {Map<string, Blob>|null}
   */
  getUserTheme(themeName) {
    const cacheKey = `theme:${themeName}`;
    // Check if in memory cache (either from userThemeFiles registration or IndexedDB load)
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    return null;
  }

  /**
   * Get user theme files (async, fetches from IndexedDB if not in memory)
   * @param {string} themeName - Theme name
   * @returns {Promise<Map<string, Blob>|null>}
   */
  async getUserThemeAsync(themeName) {
    // First try synchronous method
    const cached = this.getUserTheme(themeName);
    if (cached) {
      return cached;
    }

    // Try to fetch from IndexedDB
    if (this.resourceCache) {
      try {
        const userTheme = await this.resourceCache.getUserTheme(themeName);
        if (userTheme) {
          const cacheKey = `theme:${themeName}`;
          this.cache.set(cacheKey, userTheme.files);
          Logger.log(`[ResourceFetcher] User theme '${themeName}' loaded from IndexedDB via getUserThemeAsync`);
          return userTheme.files;
        }
      } catch (e) {
        console.warn('[ResourceFetcher] IndexedDB lookup failed:', e.message);
      }
    }

    return null;
  }

  /**
   * Load bundle manifest from server or static data
   * @returns {Promise<void>}
   */
  async loadBundleManifest() {
    // Check if running in static mode (prefer capabilities, fallback to direct check)
    const capabilities = window.eXeLearning?.app?.capabilities;
    const isStaticMode = capabilities
      ? !capabilities.storage.remote
      : (window.__EXE_STATIC_MODE__ === true || window.eXeLearning?.config?.isStaticMode === true);

    if (isStaticMode) {
      // In static mode, use manifest from bundled data
      const staticData = window.__EXE_STATIC_DATA__;
      if (staticData?.bundleManifest) {
        this.bundleManifest = staticData.bundleManifest;
        this.bundlesAvailable = true;
        console.log('[ResourceFetcher] ✅ Using static bundle manifest');
        return;
      }

      // Try to fetch from local bundles/manifest.json
      try {
        const response = await fetch(`${this.basePath}/bundles/manifest.json`);
        if (response.ok) {
          this.bundleManifest = await response.json();
          this.bundlesAvailable = true;
          console.log('[ResourceFetcher] ✅ Loaded manifest from bundles/manifest.json');
          return;
        }
      } catch (e) {
        console.log('[ResourceFetcher] Static mode: No local manifest.json');
      }

      this.bundlesAvailable = false;
      console.log('[ResourceFetcher] Static mode: Using fallback (no bundles)');
      return;
    }

    // Server mode: fetch from API
    try {
      const manifestUrl = `${this.apiBase}/bundle/manifest`;
      console.log('[ResourceFetcher] Loading bundle manifest from:', manifestUrl);
      const response = await fetch(manifestUrl);
      if (response.ok) {
        this.bundleManifest = await response.json();
        this.bundlesAvailable = true;
        console.log('[ResourceFetcher] ✅ Bundle manifest loaded, bundles available:', Object.keys(this.bundleManifest.themes || {}));
      } else {
        this.bundlesAvailable = false;
        console.warn('[ResourceFetcher] ⚠️ No bundle manifest (status:', response.status, '), using fallback mode');
      }
    } catch (e) {
      this.bundlesAvailable = false;
      console.warn('[ResourceFetcher] ⚠️ Failed to load bundle manifest, using fallback mode:', e.message);
    }
  }

  /**
   * Extract ZIP bundle to Map<path, Blob>
   * @param {ArrayBuffer} zipBuffer - ZIP file as ArrayBuffer
   * @returns {Promise<Map<string, Blob>>}
   */
  async extractZipBundle(zipBuffer) {
    const files = new Map();

    // Use fflate (should be loaded globally via window.fflate)
    if (typeof window.fflate === 'undefined') {
      console.warn('[ResourceFetcher] fflate not available, cannot extract ZIP. Ensure fflate.umd.js is loaded.');
      return files;
    }

    try {
      const zipData = new Uint8Array(zipBuffer);
      Logger.log(`[ResourceFetcher] Extracting ZIP bundle (${zipData.length} bytes)...`);
      const unzipped = window.fflate.unzipSync(zipData);

      for (const [filePath, content] of Object.entries(unzipped)) {
        // Skip directories
        if (filePath.endsWith('/')) continue;

        // Determine MIME type from extension
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const mimeTypes = {
          css: 'text/css',
          js: 'application/javascript',
          json: 'application/json',
          html: 'text/html',
          htm: 'text/html',
          xml: 'text/xml',
          svg: 'image/svg+xml',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
          woff: 'font/woff',
          woff2: 'font/woff2',
          ttf: 'font/ttf',
          eot: 'application/vnd.ms-fontobject',
          mp3: 'audio/mpeg',
          mp4: 'video/mp4',
          webm: 'video/webm',
          ogg: 'audio/ogg',
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        const blob = new Blob([content], { type: mimeType });
        files.set(filePath, blob);
      }

      Logger.log(`[ResourceFetcher] Extracted ${files.size} files from ZIP bundle`);
    } catch (e) {
      console.error('[ResourceFetcher] Failed to extract ZIP bundle:', e);
    }

    return files;
  }

  /**
   * Fetch ZIP bundle from server
   * @param {string} bundleUrl - URL to the ZIP bundle
   * @returns {Promise<Map<string, Blob>|null>} Extracted files or null on failure
   */
  async fetchBundle(bundleUrl) {
    try {
      Logger.log(`[ResourceFetcher] Fetching bundle: ${bundleUrl}`);
      const response = await fetch(bundleUrl);

      if (!response.ok) {
        console.warn(`[ResourceFetcher] Bundle fetch failed: ${bundleUrl} (${response.status} ${response.statusText})`);
        return null;
      }

      Logger.log(`[ResourceFetcher] Bundle fetched OK (${response.headers.get('content-length') || '?'} bytes), extracting...`);
      const zipBuffer = await response.arrayBuffer();
      const result = await this.extractZipBundle(zipBuffer);
      Logger.log(`[ResourceFetcher] Bundle extracted: ${result.size} files`);
      return result;
    } catch (e) {
      console.warn(`[ResourceFetcher] Failed to fetch bundle ${bundleUrl}:`, e);
      return null;
    }
  }

  // =========================================================================
  // Theme Resources
  // =========================================================================

  /**
   * Fetch all files for a theme
   * Supports:
   * - User themes (from .elpx imports, stored in Yjs via setUserThemeFiles or IndexedDB)
   * - Server themes (base/site themes, fetched via bundle or individual files)
   *
   * Priority order:
   * 1. Memory cache (includes user themes registered via setUserThemeFiles)
   * 2. userThemeFiles (Yjs) - rebuild cache if needed
   * 3. IndexedDB user themes - persistent local storage
   * 4. IndexedDB server theme cache - version-based cache
   * 5. Server bundles
   * 6. Server fallback
   *
   * @param {string} themeName - Theme name (e.g., 'base', 'blue', 'clean', or user theme)
   * @returns {Promise<Map<string, Blob>>} Map of relative path -> blob
   */
  async fetchTheme(themeName) {
    const cacheKey = `theme:${themeName}`;

    // 1. Check in-memory cache (includes user themes registered via setUserThemeFiles)
    if (this.cache.has(cacheKey)) {
      const isUserTheme = this.userThemeFiles.has(themeName);
      Logger.log(`[ResourceFetcher] Theme '${themeName}' loaded from memory cache${isUserTheme ? ' (user theme)' : ''}`);
      return this.cache.get(cacheKey);
    }

    // 2. User themes from Yjs (registered via setUserThemeFiles)
    // If not found in cache at this point, it's not a user theme or hasn't been registered yet
    if (this.userThemeFiles.has(themeName)) {
      // This shouldn't happen normally - user themes are cached when registered
      console.warn(`[ResourceFetcher] User theme '${themeName}' registered but not in cache - rebuilding cache`);
      const files = this.userThemeFiles.get(themeName);
      await this.setUserThemeFiles(themeName, files);
      return this.cache.get(cacheKey);
    }

    // 3. Check IndexedDB for user themes (persistent local storage)
    if (this.resourceCache) {
      try {
        const userTheme = await this.resourceCache.getUserTheme(themeName);
        if (userTheme) {
          // User theme found in IndexedDB
          this.cache.set(cacheKey, userTheme.files);
          Logger.log(`[ResourceFetcher] User theme '${themeName}' loaded from IndexedDB (${userTheme.files.size} files)`);
          return userTheme.files;
        }
      } catch (e) {
        // getUserTheme may throw if method doesn't exist or fails
        console.warn('[ResourceFetcher] IndexedDB user theme lookup failed:', e.message);
      }
    }

    // 4. Check IndexedDB cache for server themes (version-based)
    if (this.resourceCache) {
      try {
        const cached = await this.resourceCache.get('theme', themeName, this.version);
        if (cached) {
          this.cache.set(cacheKey, cached);
          Logger.log(`[ResourceFetcher] Theme '${themeName}' loaded from IndexedDB cache`);
          return cached;
        }
      } catch (e) {
        console.warn('[ResourceFetcher] IndexedDB cache read failed:', e);
      }
    }

    Logger.log(`[ResourceFetcher] Fetching theme '${themeName}' from server...`);

    let themeFiles = null;

    // 5. Try ZIP bundle (faster, single request)
    if (this.bundlesAvailable) {
      const bundleUrl = this.getBundleUrl('theme', themeName);
      console.log(`[ResourceFetcher] 📦 Fetching theme '${themeName}' via bundle:`, bundleUrl);
      themeFiles = await this.fetchBundle(bundleUrl);
      if (themeFiles && themeFiles.size > 0) {
        console.log(`[ResourceFetcher] ✅ Theme '${themeName}' loaded from bundle (${themeFiles.size} files)`);
      }
    }

    // 6. Fallback to individual file fetches
    if (!themeFiles || themeFiles.size === 0) {
      console.log(`[ResourceFetcher] ⚠️ Falling back to individual file fetches for theme '${themeName}'`);
      themeFiles = await this.fetchThemeFallback(themeName);
    }

    // 7. Cache the result (cache even if empty to avoid repeated fetches)
    this.cache.set(cacheKey, themeFiles);

    // Store in IndexedDB for persistence (only if non-empty, only for server themes)
    if (themeFiles.size > 0 && this.resourceCache) {
      try {
        await this.resourceCache.set('theme', themeName, this.version, themeFiles);
      } catch (e) {
        console.warn('[ResourceFetcher] IndexedDB cache write failed:', e);
      }
    }

    Logger.log(`[ResourceFetcher] Theme '${themeName}' loaded (${themeFiles.size} files)`);
    return themeFiles;
  }

  /**
   * Fallback method to fetch theme files individually (parallel)
   * @param {string} themeName
   * @returns {Promise<Map<string, Blob>>}
   */
  async fetchThemeFallback(themeName) {
    const themeFiles = new Map();

    try {
      // Get file list from API
      const response = await fetch(`${this.apiBase}/theme/${themeName}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch theme list: ${response.status}`);
      }

      const fileList = await response.json();

      // Fetch all files in parallel
      const fetchPromises = fileList.map(async file => {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            return { path: file.path, blob };
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching theme file ${file.url}:`, e);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      for (const result of results) {
        if (result) {
          themeFiles.set(result.path, result.blob);
        }
      }
    } catch (e) {
      console.error(`[ResourceFetcher] Failed to fetch theme '${themeName}':`, e);
    }

    return themeFiles;
  }

  // =========================================================================
  // iDevice Resources
  // =========================================================================

  /**
   * Fetch all files for an iDevice type
   * Uses iDevices bundle when available, with fallback to individual files.
   * @param {string} ideviceType - iDevice type name (e.g., 'FreeTextIdevice', 'QuizActivity')
   * @returns {Promise<Map<string, Blob>>} Map of relative path -> blob
   */
  async fetchIdevice(ideviceType) {
    const cacheKey = `idevice:${ideviceType}`;

    // 1. Check in-memory cache
    if (this.cache.has(cacheKey)) {
      Logger.log(`[ResourceFetcher] iDevice '${ideviceType}' loaded from memory cache`);
      return this.cache.get(cacheKey);
    }

    // 2. Check IndexedDB cache
    if (this.resourceCache) {
      try {
        const cached = await this.resourceCache.get('idevice', ideviceType, this.version);
        if (cached) {
          this.cache.set(cacheKey, cached);
          Logger.log(`[ResourceFetcher] iDevice '${ideviceType}' loaded from IndexedDB cache`);
          return cached;
        }
      } catch (e) {
        console.warn('[ResourceFetcher] IndexedDB cache read failed:', e);
      }
    }

    // 3. Try to load from iDevices bundle (all iDevices in one ZIP)
    if (this.bundlesAvailable && !this.cache.has('idevices:all')) {
      await this.loadIdevicesBundle();
    }

    // Check if the iDevice is now in memory cache (loaded from bundle)
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 4. Fallback to individual file fetches
    Logger.log(`[ResourceFetcher] Fetching iDevice '${ideviceType}' from server...`);
    const ideviceFiles = await this.fetchIdeviceFallback(ideviceType);

    // 5. Cache the result (cache even if empty to avoid repeated fetches)
    this.cache.set(cacheKey, ideviceFiles);

    // Store in IndexedDB for persistence (only if non-empty)
    if (ideviceFiles.size > 0 && this.resourceCache) {
      try {
        await this.resourceCache.set('idevice', ideviceType, this.version, ideviceFiles);
      } catch (e) {
        console.warn('[ResourceFetcher] IndexedDB cache write failed:', e);
      }
    }

    Logger.log(`[ResourceFetcher] iDevice '${ideviceType}' loaded (${ideviceFiles.size} files)`);
    return ideviceFiles;
  }

  /**
   * Load all iDevices from bundle and distribute to individual caches
   * @returns {Promise<void>}
   */
  async loadIdevicesBundle() {
    const bundleUrl = this.getBundleUrl('idevices');
    const allFiles = await this.fetchBundle(bundleUrl);

    if (!allFiles || allFiles.size === 0) {
      this.cache.set('idevices:all', new Map()); // Mark as tried
      return;
    }

    // Distribute files to individual iDevice caches
    // Files are stored as: ideviceName/path/to/file
    const ideviceFilesMap = new Map();

    for (const [filePath, blob] of allFiles) {
      const parts = filePath.split('/');
      if (parts.length < 2) continue;

      const ideviceName = parts[0];
      const relativePath = parts.slice(1).join('/');

      if (!ideviceFilesMap.has(ideviceName)) {
        ideviceFilesMap.set(ideviceName, new Map());
      }
      ideviceFilesMap.get(ideviceName).set(relativePath, blob);
    }

    // Store in memory cache
    for (const [ideviceName, files] of ideviceFilesMap) {
      this.cache.set(`idevice:${ideviceName}`, files);
    }

    this.cache.set('idevices:all', ideviceFilesMap);
    Logger.log(`[ResourceFetcher] Loaded ${ideviceFilesMap.size} iDevices from bundle`);
  }

  /**
   * Fallback method to fetch iDevice files individually (parallel)
   * @param {string} ideviceType
   * @returns {Promise<Map<string, Blob>>}
   */
  async fetchIdeviceFallback(ideviceType) {
    const ideviceFiles = new Map();

    try {
      const response = await fetch(`${this.apiBase}/idevice/${ideviceType}`);
      if (!response.ok) {
        if (response.status === 404) {
          Logger.log(`[ResourceFetcher] iDevice '${ideviceType}' has no additional files`);
          return ideviceFiles;
        }
        throw new Error(`Failed to fetch iDevice list: ${response.status}`);
      }

      const fileList = await response.json();

      // Fetch all files in parallel
      const fetchPromises = fileList.map(async file => {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            return { path: file.path, blob };
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching iDevice file ${file.url}:`, e);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      for (const result of results) {
        if (result) {
          ideviceFiles.set(result.path, result.blob);
        }
      }
    } catch (e) {
      console.error(`[ResourceFetcher] Failed to fetch iDevice '${ideviceType}':`, e);
    }

    return ideviceFiles;
  }

  /**
   * Fetch files for multiple iDevice types
   * @param {string[]} ideviceTypes - Array of iDevice type names
   * @returns {Promise<Map<string, Map<string, Blob>>>} Map of ideviceType -> Map of path -> blob
   */
  async fetchIdevices(ideviceTypes) {
    const results = new Map();

    // Fetch in parallel for better performance
    const promises = ideviceTypes.map(async type => {
      const files = await this.fetchIdevice(type);
      return { type, files };
    });

    const resolved = await Promise.all(promises);
    for (const { type, files } of resolved) {
      results.set(type, files);
    }

    return results;
  }

  // =========================================================================
  // Base Libraries
  // =========================================================================

  /**
   * Fetch base JavaScript libraries (jQuery, common.js, etc.)
   * Uses libs bundle when available, with fallback to individual files.
   * @returns {Promise<Map<string, Blob>>} Map of relative path -> blob
   */
  async fetchBaseLibraries() {
    const cacheKey = 'libs:base';
    // Use manifest hash for cache invalidation (if available), otherwise version
    const libsHash = this.bundleManifest?.libs?.hash;
    const cacheVersion = libsHash ? `${this.version}-${libsHash.substring(0, 8)}` : this.version;

    // 1. Check in-memory cache
    if (this.cache.has(cacheKey)) {
      Logger.log('[ResourceFetcher] Base libraries loaded from memory cache');
      return this.cache.get(cacheKey);
    }

    // 2. Check IndexedDB cache (using hash-based version for proper invalidation)
    if (this.resourceCache) {
      try {
        const cached = await this.resourceCache.get('libs', 'base', cacheVersion);
        if (cached) {
          this.cache.set(cacheKey, cached);
          Logger.log('[ResourceFetcher] Base libraries loaded from IndexedDB cache');
          return cached;
        }
      } catch (e) {
        console.warn('[ResourceFetcher] IndexedDB cache read failed:', e);
      }
    }

    Logger.log('[ResourceFetcher] Fetching base libraries from server...');

    let libFiles = null;

    // 3. Try ZIP bundle (faster, single request)
    if (this.bundlesAvailable) {
      const bundleUrl = this.getBundleUrl('libs');
      libFiles = await this.fetchBundle(bundleUrl);
    }

    // 4. Fallback to individual file fetches
    if (!libFiles || libFiles.size === 0) {
      libFiles = await this.fetchBaseLibrariesFallback();
    }

    // 5. Cache the result (cache even if empty to avoid repeated fetches)
    this.cache.set(cacheKey, libFiles);

    if (libFiles.size > 0 && this.resourceCache) {
      try {
        await this.resourceCache.set('libs', 'base', cacheVersion, libFiles);
      } catch (e) {
        console.warn('[ResourceFetcher] IndexedDB cache write failed:', e);
      }
    }

    Logger.log(`[ResourceFetcher] Base libraries loaded (${libFiles.size} files)`);
    return libFiles;
  }

  /**
   * Fallback method to fetch base libraries individually (parallel)
   * @returns {Promise<Map<string, Blob>>}
   */
  async fetchBaseLibrariesFallback() {
    const libFiles = new Map();

    try {
      const response = await fetch(`${this.apiBase}/libs/base`);
      if (!response.ok) {
        throw new Error(`Failed to fetch base libraries list: ${response.status}`);
      }

      const fileList = await response.json();

      // Fetch all files in parallel
      const fetchPromises = fileList.map(async file => {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            return { path: file.path, blob };
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching library file ${file.url}:`, e);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      for (const result of results) {
        if (result) {
          libFiles.set(result.path, result.blob);
        }
      }
    } catch (e) {
      console.error('[ResourceFetcher] Failed to fetch base libraries:', e);
    }

    return libFiles;
  }

  // =========================================================================
  // SCORM Resources
  // =========================================================================

  /**
   * Fetch SCORM JavaScript files
   * @returns {Promise<Map<string, Blob>>} Map of relative path -> blob
   */
  async fetchScormFiles() {
    const cacheKey = 'libs:scorm';
    if (this.cache.has(cacheKey)) {
      Logger.log('[ResourceFetcher] SCORM files loaded from cache');
      return this.cache.get(cacheKey);
    }

    Logger.log('[ResourceFetcher] Fetching SCORM files from server...');

    try {
      const response = await fetch(`${this.apiBase}/libs/scorm`);
      if (!response.ok) {
        throw new Error(`Failed to fetch SCORM files list: ${response.status}`);
      }

      const fileList = await response.json();
      const scormFiles = new Map();

      // Fetch all files in parallel
      const fetchPromises = fileList.map(async file => {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            return { path: file.path, blob };
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching SCORM file ${file.url}:`, e);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      for (const result of results) {
        if (result) {
          scormFiles.set(result.path, result.blob);
        }
      }

      this.cache.set(cacheKey, scormFiles);
      Logger.log(`[ResourceFetcher] SCORM files loaded (${scormFiles.size} files)`);
      return scormFiles;
    } catch (e) {
      console.error('[ResourceFetcher] Failed to fetch SCORM files:', e);
      return new Map();
    }
  }

  // =========================================================================
  // EPUB Resources
  // =========================================================================

  /**
   * Fetch EPUB-specific files (container.xml template, etc.)
   * @returns {Promise<Map<string, Blob>>} Map of relative path -> blob
   */
  async fetchEpubFiles() {
    const cacheKey = 'libs:epub';
    if (this.cache.has(cacheKey)) {
      Logger.log('[ResourceFetcher] EPUB files loaded from cache');
      return this.cache.get(cacheKey);
    }

    Logger.log('[ResourceFetcher] Fetching EPUB files from server...');

    try {
      const response = await fetch(`${this.apiBase}/libs/epub`);
      if (!response.ok) {
        throw new Error(`Failed to fetch EPUB files list: ${response.status}`);
      }

      const fileList = await response.json();
      const epubFiles = new Map();

      // Fetch all files in parallel
      const fetchPromises = fileList.map(async file => {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            return { path: file.path, blob };
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching EPUB file ${file.url}:`, e);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      for (const result of results) {
        if (result) {
          epubFiles.set(result.path, result.blob);
        }
      }

      this.cache.set(cacheKey, epubFiles);
      Logger.log(`[ResourceFetcher] EPUB files loaded (${epubFiles.size} files)`);
      return epubFiles;
    } catch (e) {
      console.error('[ResourceFetcher] Failed to fetch EPUB files:', e);
      return new Map();
    }
  }

  // =========================================================================
  // Schema Resources
  // =========================================================================

  /**
   * Fetch XSD schema files for a specific format
   * @param {string} format - 'scorm12', 'scorm2004', 'ims', or 'epub3'
   * @returns {Promise<Map<string, Blob>>} Map of relative path -> blob
   */
  async fetchSchemas(format) {
    const cacheKey = `schemas:${format}`;
    if (this.cache.has(cacheKey)) {
      Logger.log(`[ResourceFetcher] Schemas for '${format}' loaded from cache`);
      return this.cache.get(cacheKey);
    }

    Logger.log(`[ResourceFetcher] Fetching schemas for '${format}' from server...`);

    try {
      const response = await fetch(`${this.apiBase}/schemas/${format}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch schemas list: ${response.status}`);
      }

      const fileList = await response.json();
      const schemaFiles = new Map();

      // Fetch all files in parallel
      const fetchPromises = fileList.map(async file => {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            return { path: file.path, blob };
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching schema file ${file.url}:`, e);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      for (const result of results) {
        if (result) {
          schemaFiles.set(result.path, result.blob);
        }
      }

      this.cache.set(cacheKey, schemaFiles);
      Logger.log(`[ResourceFetcher] Schemas for '${format}' loaded (${schemaFiles.size} files)`);
      return schemaFiles;
    } catch (e) {
      console.error(`[ResourceFetcher] Failed to fetch schemas for '${format}':`, e);
      return new Map();
    }
  }

  // =========================================================================
  // Dynamic Library Resources
  // =========================================================================

  /**
   * Fetch a single library file by path
   * Library files are served from /app/common/ or /libs/ directories
   * @param {string} path - Relative path (e.g., 'exe_effects/exe_effects.js')
   * @returns {Promise<Blob|null>}
   */
  async fetchLibraryFile(path) {
    const cacheKey = `lib:${path}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Determine correct base directory from path to avoid 404 noise
    const firstDir = path.split('/')[0];
    const isThirdParty = THIRD_PARTY_LIBS.has(firstDir);

    // Build paths based on mode
    let possiblePaths;
    if (this.isStaticMode()) {
      // Static mode: use relative paths without version prefix
      const staticBase = this.basePath || '.';
      possiblePaths = isThirdParty
        ? [
            `${staticBase}/libs/${path}`,
            `${staticBase}/app/common/${path}`,
          ]
        : [
            `${staticBase}/app/common/${path}`,
            `${staticBase}/libs/${path}`,
          ];
    } else {
      // Server mode: use versioned paths for cache busting
      possiblePaths = isThirdParty
        ? [
            `${this.basePath}/${this.version}/libs/${path}`,
            `${this.basePath}/${this.version}/app/common/${path}`,
          ]
        : [
            `${this.basePath}/${this.version}/app/common/${path}`,
            `${this.basePath}/${this.version}/libs/${path}`,
          ];
    }

    for (const url of possiblePaths) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          this.cache.set(cacheKey, blob);
          return blob;
        }
      } catch (e) {
        // Try next path
      }
    }

    console.warn(`[ResourceFetcher] Library file not found: ${path}`);
    return null;
  }

  /**
   * Fetch multiple library files
   * @param {string[]} paths - Array of relative paths
   * @returns {Promise<Map<string, Blob>>} Map of path -> blob
   */
  async fetchLibraryFiles(paths) {
    const results = new Map();

    // Fetch in parallel for performance
    const promises = paths.map(async path => {
      const blob = await this.fetchLibraryFile(path);
      return { path, blob };
    });

    const resolved = await Promise.all(promises);
    for (const { path, blob } of resolved) {
      if (blob) {
        results.set(path, blob);
      }
    }

    Logger.log(`[ResourceFetcher] Fetched ${results.size}/${paths.length} library files`);
    return results;
  }

  /**
   * Fetch all files in a library directory
   * @param {string} libraryName - Library directory name (e.g., 'exe_effects')
   * @returns {Promise<Map<string, Blob>>} Map of relative path -> blob
   */
  async fetchLibraryDirectory(libraryName) {
    const cacheKey = `libdir:${libraryName}`;
    if (this.cache.has(cacheKey)) {
      Logger.log(`[ResourceFetcher] Library '${libraryName}' loaded from cache`);
      return this.cache.get(cacheKey);
    }

    Logger.log(`[ResourceFetcher] Fetching library directory '${libraryName}' from server...`);

    try {
      // Try API endpoint first for directory listing
      const response = await fetch(`${this.apiBase}/libs/directory/${libraryName}`);
      if (!response.ok) {
        // Fallback: return empty if no API available
        console.warn(`[ResourceFetcher] No API for library directory: ${libraryName}`);
        return new Map();
      }

      const fileList = await response.json();
      const libFiles = new Map();

      // Fetch all files in parallel
      const fetchPromises = fileList.map(async file => {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            return { path: file.path, blob };
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching library file ${file.url}:`, e);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      for (const result of results) {
        if (result) {
          libFiles.set(result.path, result.blob);
        }
      }

      this.cache.set(cacheKey, libFiles);
      Logger.log(`[ResourceFetcher] Library '${libraryName}' loaded (${libFiles.size} files)`);
      return libFiles;
    } catch (e) {
      console.error(`[ResourceFetcher] Failed to fetch library '${libraryName}':`, e);
      return new Map();
    }
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Clear all cached resources (in-memory only)
   */
  clearCache() {
    this.cache.clear();
    Logger.log('[ResourceFetcher] In-memory cache cleared');
  }

  /**
   * Clear all cached resources including IndexedDB persistent cache
   * @returns {Promise<void>}
   */
  async clearAllCaches() {
    // Clear in-memory cache
    this.cache.clear();

    // Clear IndexedDB cache
    if (this.resourceCache) {
      try {
        await this.resourceCache.clear();
        Logger.log('[ResourceFetcher] All caches cleared (in-memory + IndexedDB)');
      } catch (e) {
        console.warn('[ResourceFetcher] Failed to clear IndexedDB cache:', e);
      }
    } else {
      Logger.log('[ResourceFetcher] In-memory cache cleared (no IndexedDB cache)');
    }
  }

  /**
   * Clear cached resources for a specific key pattern
   * @param {string} pattern - Pattern to match (e.g., 'theme:', 'idevice:')
   */
  clearCacheByPattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
    Logger.log(`[ResourceFetcher] Cache cleared for pattern '${pattern}'`);
  }

  /**
   * Get cache statistics
   * @returns {{size: number, keys: string[]}}
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Fetch a single file directly by URL
   * @param {string} url
   * @returns {Promise<Blob|null>}
   */
  async fetchFile(url) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.blob();
      }
      console.warn(`[ResourceFetcher] Failed to fetch file: ${url} (${response.status})`);
      return null;
    } catch (e) {
      console.error(`[ResourceFetcher] Error fetching file ${url}:`, e);
      return null;
    }
  }

  /**
   * Fetch text content of a file
   * @param {string} url
   * @returns {Promise<string|null>}
   */
  async fetchText(url) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
      return null;
    } catch (e) {
      console.error(`[ResourceFetcher] Error fetching text ${url}:`, e);
      return null;
    }
  }

  /**
   * Fetch the eXeLearning "powered by" logo
   * @returns {Promise<Blob|null>} Logo image as Blob, or null if not found
   */
  async fetchExeLogo() {
    const cacheKey = 'logo:exe';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Build path based on mode
    let logoUrl;
    if (this.isStaticMode()) {
      const staticBase = this.basePath || '.';
      logoUrl = `${staticBase}/app/common/exe_powered_logo/exe_powered_logo.png`;
    } else {
      logoUrl = `${this.basePath}/${this.version}/app/common/exe_powered_logo/exe_powered_logo.png`;
    }
    try {
      const response = await fetch(logoUrl);
      if (response.ok) {
        const blob = await response.blob();
        this.cache.set(cacheKey, blob);
        return blob;
      }
    } catch (e) {
      console.warn(`[ResourceFetcher] Error fetching eXeLearning logo:`, e);
    }
    return null;
  }

  // =========================================================================
  // Content CSS Resources
  // =========================================================================

  /**
   * Fetch content CSS files (base.css, etc.)
   * Uses content-css bundle when available, with fallback to individual files.
   * @returns {Promise<Map<string, Blob>>} Map of relative path -> blob
   */
  async fetchContentCss() {
    const cacheKey = 'content-css';

    // 1. Check in-memory cache
    if (this.cache.has(cacheKey)) {
      Logger.log('[ResourceFetcher] Content CSS loaded from memory cache');
      return this.cache.get(cacheKey);
    }

    // 2. Check IndexedDB cache
    if (this.resourceCache) {
      try {
        const cached = await this.resourceCache.get('css', 'content', this.version);
        if (cached) {
          this.cache.set(cacheKey, cached);
          Logger.log('[ResourceFetcher] Content CSS loaded from IndexedDB cache');
          return cached;
        }
      } catch (e) {
        console.warn('[ResourceFetcher] IndexedDB cache read failed:', e);
      }
    }

    Logger.log('[ResourceFetcher] Fetching content CSS from server...');

    let cssFiles = null;

    // 3. Try ZIP bundle
    if (this.bundlesAvailable) {
      const bundleUrl = this.getBundleUrl('content-css');
      cssFiles = await this.fetchBundle(bundleUrl);
    }

    // 4. Fallback to individual file fetches
    if (!cssFiles || cssFiles.size === 0) {
      cssFiles = await this.fetchContentCssFallback();
    }

    // 5. Cache the result (cache even if empty to avoid repeated fetches)
    this.cache.set(cacheKey, cssFiles);

    // Store in IndexedDB for persistence (only if non-empty)
    if (cssFiles.size > 0 && this.resourceCache) {
      try {
        await this.resourceCache.set('css', 'content', this.version, cssFiles);
      } catch (e) {
        console.warn('[ResourceFetcher] IndexedDB cache write failed:', e);
      }
    }

    Logger.log(`[ResourceFetcher] Content CSS loaded (${cssFiles.size} files)`);
    return cssFiles;
  }

  /**
   * Fallback method to fetch content CSS individually (parallel)
   * @returns {Promise<Map<string, Blob>>}
   */
  async fetchContentCssFallback() {
    const cssFiles = new Map();

    try {
      const response = await fetch(`${this.apiBase}/content-css`);
      if (!response.ok) {
        throw new Error(`Failed to fetch content CSS list: ${response.status}`);
      }

      const fileList = await response.json();

      // Fetch all files in parallel
      const fetchPromises = fileList.map(async file => {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            return { path: file.path, blob };
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching CSS file ${file.url}:`, e);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      for (const result of results) {
        if (result) {
          cssFiles.set(result.path, result.blob);
        }
      }
    } catch (e) {
      console.error('[ResourceFetcher] Failed to fetch content CSS:', e);
    }

    return cssFiles;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResourceFetcher;
} else {
  window.ResourceFetcher = ResourceFetcher;
}
