/**
 * BaseExporter
 * Base class for all client-side export implementations.
 * Provides common utilities for XML/HTML generation, file handling, and structure navigation.
 *
 * @abstract
 */
class BaseExporter {
  /**
   * @param {YjsDocumentManager} documentManager - The Yjs document manager
   * @param {AssetCacheManager} assetCacheManager - Asset cache manager for retrieving assets
   * @param {ResourceFetcher} resourceFetcher - Resource fetcher for server resources
   */
  constructor(documentManager, assetCacheManager = null, resourceFetcher = null) {
    this.manager = documentManager;
    this.assetCache = assetCacheManager;
    this.resourceFetcher = resourceFetcher;
    this.assetManager = null; // AssetManager instance for IndexedDB assets
  }

  /**
   * Set the AssetManager instance for accessing IndexedDB assets
   * @param {AssetManager} assetManager
   */
  setAssetManager(assetManager) {
    this.assetManager = assetManager;
  }

  /**
   * Export the project - must be implemented by subclasses
   * @param {string} filename - Optional filename override
   * @returns {Promise<{success: boolean, filename?: string, error?: string}>}
   * @abstract
   */
  async export(filename = null) {
    throw new Error('export() must be implemented by subclass');
  }

  /**
   * Get file extension for this export format
   * @returns {string}
   * @abstract
   */
  getFileExtension() {
    throw new Error('getFileExtension() must be implemented by subclass');
  }

  /**
   * Get file suffix for this export format (e.g., '_web', '_scorm')
   * @returns {string}
   * @abstract
   */
  getFileSuffix() {
    throw new Error('getFileSuffix() must be implemented by subclass');
  }

  // =========================================================================
  // Structure Access Methods
  // =========================================================================

  /**
   * Get project metadata from Yjs document
   * @returns {Y.Map}
   */
  getMetadata() {
    return this.manager.getMetadata();
  }

  /**
   * Get navigation structure (pages) from Yjs document
   * @returns {Y.Array}
   */
  getNavigation() {
    return this.manager.getNavigation();
  }

  /**
   * Build a flat list of pages from the Yjs navigation structure
   * @returns {Array<{id: string, title: string, parentId: string|null, order: number, blocks: Array}>}
   */
  buildPageList() {
    const navigation = this.getNavigation();
    const pages = [];

    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      pages.push(this.extractPageData(pageMap, i));
    }

    return pages;
  }

  /**
   * Extract page data from a Y.Map
   * @param {Y.Map} pageMap
   * @param {number} index
   * @returns {Object}
   */
  extractPageData(pageMap, index) {
    const pageId = pageMap.get('id') || pageMap.get('pageId');
    const pageName = pageMap.get('pageName') || 'Page';
    const parentId = pageMap.get('parentId') || null;
    const order = pageMap.get('order') ?? index;

    // Extract blocks
    const blocksArray = pageMap.get('blocks');
    const blocks = [];
    if (blocksArray) {
      for (let i = 0; i < blocksArray.length; i++) {
        const blockMap = blocksArray.get(i);
        blocks.push(this.extractBlockData(blockMap, i));
      }
    }

    return {
      id: pageId,
      title: pageName,
      parentId,
      order,
      blocks,
    };
  }

  /**
   * Extract block data from a Y.Map
   * @param {Y.Map} blockMap
   * @param {number} index
   * @returns {Object}
   */
  extractBlockData(blockMap, index) {
    const blockId = blockMap.get('id') || blockMap.get('blockId');
    const blockName = blockMap.get('blockName') || 'Block';
    const order = blockMap.get('order') ?? index;

    // Extract components
    const componentsArray = blockMap.get('components');
    const components = [];
    if (componentsArray) {
      for (let i = 0; i < componentsArray.length; i++) {
        const compMap = componentsArray.get(i);
        components.push(this.extractComponentData(compMap, i));
      }
    }

    return {
      id: blockId,
      name: blockName,
      order,
      components,
    };
  }

  /**
   * Extract component (iDevice) data from a Y.Map
   * @param {Y.Map} compMap
   * @param {number} index
   * @returns {Object}
   */
  extractComponentData(compMap, index) {
    const compId = compMap.get('id') || compMap.get('ideviceId');
    const ideviceType = compMap.get('ideviceType') || 'FreeTextIdevice';
    const order = compMap.get('order') ?? index;

    // Get HTML content (try both 'htmlContent' and 'htmlView' for compatibility)
    let htmlContent = compMap.get('htmlContent') || compMap.get('htmlView');
    if (htmlContent && htmlContent.toString) {
      htmlContent = htmlContent.toString();
    }

    // Get properties
    const properties = {};
    const propsMap = compMap.get('properties');
    if (propsMap) {
      propsMap.forEach((value, key) => {
        properties[key] = value;
      });
    }

    // Get individual prop_ properties
    compMap.forEach((value, key) => {
      if (key.startsWith('prop_')) {
        properties[key.substring(5)] = value;
      }
    });

    return {
      id: compId,
      type: ideviceType,
      order,
      content: htmlContent || '',
      properties,
    };
  }

  /**
   * Get list of unique iDevice types used in the project
   * @param {Array} pages - List of pages from buildPageList()
   * @returns {string[]}
   */
  getUsedIdevices(pages) {
    const types = new Set();

    for (const page of pages) {
      for (const block of page.blocks || []) {
        for (const component of block.components || []) {
          if (component.type) {
            types.add(component.type);
          }
        }
      }
    }

    return Array.from(types);
  }

  /**
   * Get root pages (pages without parent)
   * @param {Array} pages
   * @returns {Array}
   */
  getRootPages(pages) {
    return pages.filter(p => !p.parentId);
  }

  /**
   * Get child pages of a given page
   * @param {string} parentId
   * @param {Array} pages
   * @returns {Array}
   */
  getChildPages(parentId, pages) {
    return pages.filter(p => p.parentId === parentId);
  }

  // =========================================================================
  // String Utilities
  // =========================================================================

  /**
   * Escape XML special characters
   * @param {string} str
   * @returns {string}
   */
  escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Escape HTML special characters
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
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
   * Sanitize string for use as filename
   * @param {string} str
   * @param {number} maxLength
   * @returns {string}
   */
  sanitizeFilename(str, maxLength = 50) {
    if (!str) return 'export';
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, maxLength);
  }

  /**
   * Generate unique identifier with optional prefix
   * @param {string} prefix
   * @returns {string}
   */
  generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}${random}`.toUpperCase();
  }

  // =========================================================================
  // File Handling
  // =========================================================================

  /**
   * Build export filename from metadata
   * @returns {string}
   */
  buildFilename() {
    const meta = this.getMetadata();
    const title = meta.get('title') || 'export';
    const sanitized = this.sanitizeFilename(title);
    return `${sanitized}${this.getFileSuffix()}${this.getFileExtension()}`;
  }

  /**
   * Download a blob as a file
   * Uses createObjectURL with fallback to data URL for browser extensions that block it
   * @param {Blob} blob
   * @param {string} filename
   */
  downloadBlob(blob, filename) {
    try {
      // Primary method: createObjectURL (faster, less memory)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      // Fallback for browser extensions that block createObjectURL
      // (e.g., "Breaking Browser Locker Behavior detected")
      console.warn('[BaseExporter] createObjectURL blocked, using data URL fallback:', error.message);
      this.downloadBlobViaDataUrl(blob, filename);
    }
  }

  /**
   * Fallback download method using FileReader and data URL
   * Slower but works when createObjectURL is blocked by browser extensions
   * @param {Blob} blob
   * @param {string} filename
   */
  downloadBlobViaDataUrl(blob, filename) {
    const reader = new FileReader();
    reader.onload = function () {
      const a = document.createElement('a');
      a.href = reader.result;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    reader.onerror = function () {
      console.error('[BaseExporter] FileReader fallback also failed');
      throw new Error('Unable to download file. Please disable browser extensions that block downloads.');
    };
    reader.readAsDataURL(blob);
  }

  /**
   * Add assets from cache to ZIP
   * Uses AssetManager (IndexedDB) as primary source, falls back to assetCache
   * @param {JSZip} zip
   * @param {string} prefix - Path prefix for assets in ZIP
   */
  async addAssetsToZip(zip, prefix = '') {
    let assetsAdded = 0;

    // 1. Try AssetManager first (primary source - IndexedDB)
    if (this.assetManager) {
      try {
        const assets = await this.assetManager.getProjectAssets();
        Logger.log(`[BaseExporter] Found ${assets.length} assets in AssetManager`);

        for (const asset of assets) {
          try {
            const assetId = asset.id || asset.assetId;
            const filename = asset.filename || asset.originalFilename || `asset-${assetId}`;
            // Use originalPath if available, otherwise construct from assetId/filename
            const originalPath = asset.originalPath || `content/resources/${assetId}/${filename}`;
            const zipPath = prefix ? `${prefix}${originalPath}` : originalPath;
            zip.file(zipPath, asset.blob);
            Logger.log(`[BaseExporter] Added asset from AssetManager: ${zipPath}`);
            assetsAdded++;
          } catch (e) {
            console.warn(`[BaseExporter] Failed to add asset from AssetManager:`, e);
          }
        }

        if (assetsAdded > 0) {
          Logger.log(`[BaseExporter] Added ${assetsAdded} assets from AssetManager`);
          return;
        }
      } catch (e) {
        console.warn('[BaseExporter] Failed to get assets from AssetManager, trying assetCache:', e);
      }
    }

    // 2. Fallback to assetCache (legacy compatibility)
    if (!this.assetCache) {
      console.warn('[BaseExporter] No asset cache or AssetManager available');
      return;
    }

    try {
      const assets = await this.assetCache.getAllAssets();

      for (const asset of assets) {
        try {
          const originalPath = asset.metadata?.originalPath ||
                              asset.metadata?.filename ||
                              `asset-${asset.assetId}`;
          const zipPath = prefix ? `${prefix}${originalPath}` : originalPath;
          zip.file(zipPath, asset.blob);
          Logger.log(`[BaseExporter] Added asset from assetCache: ${zipPath}`);
          assetsAdded++;
        } catch (e) {
          console.warn(`[BaseExporter] Failed to add asset from assetCache:`, e);
        }
      }

      if (assetsAdded > 0) {
        Logger.log(`[BaseExporter] Added ${assetsAdded} assets from assetCache`);
      }
    } catch (e) {
      console.warn('[BaseExporter] Failed to get assets from cache:', e);
    }
  }

  /**
   * Get JSZip instance, loading library if needed
   * @returns {JSZip}
   */
  getJSZip() {
    if (!window.JSZip) {
      throw new Error('JSZip library not loaded');
    }
    return window.JSZip;
  }

  /**
   * Create a new ZIP instance
   * @returns {JSZip}
   */
  createZip() {
    const JSZip = this.getJSZip();
    return new JSZip();
  }

  // =========================================================================
  // Navigation Helpers
  // =========================================================================

  /**
   * Check if a page is an ancestor of another page
   * @param {Object} potentialAncestor
   * @param {string} childId
   * @param {Array} allPages
   * @returns {boolean}
   */
  isAncestorOf(potentialAncestor, childId, allPages) {
    const child = allPages.find(p => p.id === childId);
    if (!child || !child.parentId) return false;
    if (child.parentId === potentialAncestor.id) return true;
    return this.isAncestorOf(potentialAncestor, child.parentId, allPages);
  }

  /**
   * Get page link (index.html for first page, id.html for others)
   * @param {Object} page
   * @param {Array} allPages
   * @param {string} extension
   * @returns {string}
   */
  getPageLink(page, allPages, extension = '.html') {
    if (page.id === allPages[0]?.id) {
      return `index${extension}`;
    }
    return `${page.id}${extension}`;
  }

  /**
   * Get previous page in flat list
   * @param {Object} currentPage
   * @param {Array} allPages
   * @returns {Object|null}
   */
  getPreviousPage(currentPage, allPages) {
    const currentIndex = allPages.findIndex(p => p.id === currentPage.id);
    return currentIndex > 0 ? allPages[currentIndex - 1] : null;
  }

  /**
   * Get next page in flat list
   * @param {Object} currentPage
   * @param {Array} allPages
   * @returns {Object|null}
   */
  getNextPage(currentPage, allPages) {
    const currentIndex = allPages.findIndex(p => p.id === currentPage.id);
    return currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;
  }

  // =========================================================================
  // Asset URL Transformation (shared by all exporters)
  // =========================================================================

  /**
   * Get file extension from MIME type
   * @param {string} mime - MIME type
   * @returns {string} - File extension with dot (e.g., '.jpg')
   */
  getExtensionFromMime(mime) {
    const mimeToExt = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff',
      'image/x-icon': '.ico',
      'application/pdf': '.pdf',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/ogg': '.ogv',
      'video/quicktime': '.mov',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/webm': '.weba',
      'application/zip': '.zip',
      'application/json': '.json',
      'text/plain': '.txt',
      'text/html': '.html',
      'text/css': '.css',
      'application/javascript': '.js',
      'application/octet-stream': '.bin',
    };
    return mimeToExt[mime] || '.bin';
  }

  /**
   * Add filenames to asset:// URLs without changing the protocol
   * Transforms asset://uuid to asset://uuid/filename.ext
   * This allows renderers to later add the correct basePath
   * @param {string} content - HTML content
   * @returns {Promise<string>} - Content with filenames added to asset URLs
   */
  async addFilenamesToAssetUrls(content) {
    if (!content) return '';

    // If no assetManager, return content unchanged
    if (!this.assetManager) {
      return content;
    }

    // Build asset map: uuid -> filename (only once per export)
    if (!this._assetFilenameMap) {
      this._assetFilenameMap = new Map();
      try {
        const assets = await this.assetManager.getProjectAssets();
        for (const asset of assets) {
          const id = asset.id || asset.assetId;
          // Determine filename: stored filename, or generate from mime type
          let filename = asset.filename || asset.originalFilename;
          if (!filename) {
            // Generate filename from mime type (handles svg, pdf, etc.)
            const ext = this.getExtensionFromMime(asset.mime || 'application/octet-stream');
            filename = `asset-${id.substring(0, 8)}${ext}`;
          }
          this._assetFilenameMap.set(id, filename);
        }
        Logger.log(`[BaseExporter] Built asset map with ${this._assetFilenameMap.size} entries`);
      } catch (e) {
        console.warn('[BaseExporter] Failed to build asset map:', e);
        return content;
      }
    }

    // Transform asset://uuid to asset://uuid/filename (keeping asset:// protocol)
    // The renderers will later convert asset:// to content/resources/ with basePath
    return content.replace(/asset:\/\/([a-f0-9-]+)(?![/a-zA-Z0-9._-])/gi, (match, uuid) => {
      const filename = this._assetFilenameMap.get(uuid);
      if (filename) {
        return `asset://${uuid}/${filename}`;
      }
      // Fallback if asset not found
      console.warn(`[BaseExporter] Asset not found in map for URL enrichment: ${uuid}`);
      return match;
    });
  }

  /**
   * Pre-process pages to add filenames to asset URLs in all component content
   * @param {Array} pages - Pages from buildPageList()
   * @returns {Promise<Array>} - Pages with asset URLs enriched with filenames
   */
  async preprocessPagesForExport(pages) {
    for (const page of pages) {
      for (const block of page.blocks || []) {
        for (const component of block.components || []) {
          if (component.content) {
            component.content = await this.addFilenamesToAssetUrls(component.content);
          }
        }
      }
    }
    return pages;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseExporter;
} else {
  window.BaseExporter = BaseExporter;
}
