/**
 * ResourceFetcher
 * Fetches server resources (themes, iDevices, libraries) for client-side exports.
 * Uses an API endpoint that returns file lists, then fetches each file individually.
 * Implements in-memory caching to avoid redundant fetches within a session.
 */
class ResourceFetcher {
  constructor() {
    // In-memory cache for the session
    this.cache = new Map();
    // Base URL for API endpoints
    this.apiBase = '/api/resources';
    // Base URL for static files
    this.filesBase = '/files';
  }

  // =========================================================================
  // Theme Resources
  // =========================================================================

  /**
   * Fetch all files for a theme
   * @param {string} themeName - Theme name (e.g., 'base', 'blue', 'clean')
   * @returns {Promise<Map<string, Blob>>} Map of relative path -> blob
   */
  async fetchTheme(themeName) {
    const cacheKey = `theme:${themeName}`;
    if (this.cache.has(cacheKey)) {
      Logger.log(`[ResourceFetcher] Theme '${themeName}' loaded from cache`);
      return this.cache.get(cacheKey);
    }

    Logger.log(`[ResourceFetcher] Fetching theme '${themeName}' from server...`);

    try {
      // Get file list from API
      const response = await fetch(`${this.apiBase}/theme/${themeName}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch theme list: ${response.status}`);
      }

      const fileList = await response.json();
      const themeFiles = new Map();

      // Fetch each file
      for (const file of fileList) {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            themeFiles.set(file.path, blob);
          } else {
            console.warn(`[ResourceFetcher] Failed to fetch theme file: ${file.url}`);
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching theme file ${file.url}:`, e);
        }
      }

      this.cache.set(cacheKey, themeFiles);
      Logger.log(`[ResourceFetcher] Theme '${themeName}' loaded (${themeFiles.size} files)`);
      return themeFiles;
    } catch (e) {
      console.error(`[ResourceFetcher] Failed to fetch theme '${themeName}':`, e);
      return new Map();
    }
  }

  // =========================================================================
  // iDevice Resources
  // =========================================================================

  /**
   * Fetch all files for an iDevice type
   * @param {string} ideviceType - iDevice type name (e.g., 'FreeTextIdevice', 'QuizActivity')
   * @returns {Promise<Map<string, Blob>>} Map of relative path -> blob
   */
  async fetchIdevice(ideviceType) {
    const cacheKey = `idevice:${ideviceType}`;
    if (this.cache.has(cacheKey)) {
      Logger.log(`[ResourceFetcher] iDevice '${ideviceType}' loaded from cache`);
      return this.cache.get(cacheKey);
    }

    Logger.log(`[ResourceFetcher] Fetching iDevice '${ideviceType}' from server...`);

    try {
      const response = await fetch(`${this.apiBase}/idevice/${ideviceType}`);
      if (!response.ok) {
        // Many iDevices may not have additional files - this is normal
        if (response.status === 404) {
          Logger.log(`[ResourceFetcher] iDevice '${ideviceType}' has no additional files`);
          const emptyMap = new Map();
          this.cache.set(cacheKey, emptyMap);
          return emptyMap;
        }
        throw new Error(`Failed to fetch iDevice list: ${response.status}`);
      }

      const fileList = await response.json();
      const ideviceFiles = new Map();

      for (const file of fileList) {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            ideviceFiles.set(file.path, blob);
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching iDevice file ${file.url}:`, e);
        }
      }

      this.cache.set(cacheKey, ideviceFiles);
      Logger.log(`[ResourceFetcher] iDevice '${ideviceType}' loaded (${ideviceFiles.size} files)`);
      return ideviceFiles;
    } catch (e) {
      console.error(`[ResourceFetcher] Failed to fetch iDevice '${ideviceType}':`, e);
      return new Map();
    }
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
   * @returns {Promise<Map<string, Blob>>} Map of relative path -> blob
   */
  async fetchBaseLibraries() {
    const cacheKey = 'libs:base';
    if (this.cache.has(cacheKey)) {
      Logger.log('[ResourceFetcher] Base libraries loaded from cache');
      return this.cache.get(cacheKey);
    }

    Logger.log('[ResourceFetcher] Fetching base libraries from server...');

    try {
      const response = await fetch(`${this.apiBase}/libs/base`);
      if (!response.ok) {
        throw new Error(`Failed to fetch base libraries list: ${response.status}`);
      }

      const fileList = await response.json();
      const libFiles = new Map();

      for (const file of fileList) {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            libFiles.set(file.path, blob);
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching library file ${file.url}:`, e);
        }
      }

      this.cache.set(cacheKey, libFiles);
      Logger.log(`[ResourceFetcher] Base libraries loaded (${libFiles.size} files)`);
      return libFiles;
    } catch (e) {
      console.error('[ResourceFetcher] Failed to fetch base libraries:', e);
      return new Map();
    }
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

      for (const file of fileList) {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            scormFiles.set(file.path, blob);
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching SCORM file ${file.url}:`, e);
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

      for (const file of fileList) {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            epubFiles.set(file.path, blob);
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching EPUB file ${file.url}:`, e);
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

      for (const file of fileList) {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            schemaFiles.set(file.path, blob);
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching schema file ${file.url}:`, e);
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

    // Try /app/common/ first, then /libs/
    const possiblePaths = [
      `/app/common/${path}`,
      `/libs/${path}`,
    ];

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

      for (const file of fileList) {
        try {
          const fileResponse = await fetch(file.url);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            libFiles.set(file.path, blob);
          }
        } catch (e) {
          console.warn(`[ResourceFetcher] Error fetching library file ${file.url}:`, e);
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
   * Clear all cached resources
   */
  clearCache() {
    this.cache.clear();
    Logger.log('[ResourceFetcher] Cache cleared');
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
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResourceFetcher;
} else {
  window.ResourceFetcher = ResourceFetcher;
}
