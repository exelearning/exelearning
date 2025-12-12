/**
 * IdeviceHtmlRenderer
 * Renders iDevice components to HTML for export.
 *
 * Generates HTML structure matching legacy Symfony exports:
 * - <div class="idevice_node {cssClass}"> wrapper with data attributes
 * - Loads template from /export/{type}.html if available
 * - Injects content and JSON properties
 *
 * Configs are loaded dynamically from /api/idevices instead of being hardcoded.
 */
class IdeviceHtmlRenderer {
  /**
   * @param {ResourceFetcher} resourceFetcher - Optional resource fetcher for templates
   */
  constructor(resourceFetcher = null) {
    this.resourceFetcher = resourceFetcher;
    // Cache for iDevice configurations (loaded from API)
    this.configCache = null;
    // Cache for templates
    this.templateCache = new Map();
    // Base path for iDevice files
    this.idevicesBasePath = '/files/perm/idevices/base';
    // Loading promise to avoid multiple parallel loads
    this._loadingPromise = null;
  }

  /**
   * Load iDevice configurations from API
   * Call this before rendering to ensure configs are available
   * @returns {Promise<void>}
   */
  async loadConfigs() {
    // Return cached configs if already loaded
    if (this.configCache) {
      return;
    }

    // Avoid multiple parallel loads
    if (this._loadingPromise) {
      return this._loadingPromise;
    }

    this._loadingPromise = (async () => {
      try {
        const response = await fetch('/api/idevices');
        if (!response.ok) {
          console.warn('[IdeviceHtmlRenderer] Failed to load iDevice configs from API, using fallback');
          this.configCache = new Map();
          return;
        }

        const idevices = await response.json();
        this.configCache = new Map();

        for (const idev of idevices) {
          const config = {
            cssClass: idev.cssClass || idev.id,
            componentType: idev.componentType || 'html',
            template: idev.exportTemplateFilename || `${idev.id}.html`,
          };
          // Store by id (lowercase and original)
          this.configCache.set(idev.id, config);
          this.configCache.set(idev.id.toLowerCase(), config);
        }

        console.log(`[IdeviceHtmlRenderer] Loaded ${this.configCache.size} iDevice configs`);
      } catch (err) {
        console.warn('[IdeviceHtmlRenderer] Error loading iDevice configs:', err);
        this.configCache = new Map();
      }
    })();

    await this._loadingPromise;
    this._loadingPromise = null;
  }

  /**
   * Get iDevice configuration
   * @param {string} ideviceType - Type name of the iDevice
   * @returns {{cssClass: string, componentType: string, template: string}}
   */
  getConfig(ideviceType) {
    // Try to get from loaded configs
    if (this.configCache) {
      const config = this.configCache.get(ideviceType) || this.configCache.get(ideviceType.toLowerCase());
      if (config) {
        return config;
      }
    }

    // Fallback: derive from type name (default to HTML for unknown iDevices)
    const typeName = ideviceType.toLowerCase().replace('idevice', '');
    return {
      cssClass: typeName,
      componentType: 'html',
      template: `${typeName}.html`,
    };
  }

  /**
   * Render a single iDevice component to HTML
   * @param {Object} component - Component data from extractComponentData()
   * @param {Object} options - Rendering options
   * @param {string} options.basePath - Base path for resources (e.g., '../')
   * @param {boolean} options.includeDataAttributes - Include data-* attributes for JS
   * @returns {string} HTML string
   */
  render(component, options = {}) {
    const {
      basePath = '',
      includeDataAttributes = true,
    } = options;

    const type = component.type || 'text';
    const config = this.getConfig(type);
    const ideviceId = component.id;
    const htmlContent = component.content || '';
    const properties = component.properties || {};

    // Build CSS classes
    const classes = ['idevice_node', config.cssClass];
    if (!htmlContent) {
      classes.push('db-no-data');
    }
    if (properties.visibility === 'false') {
      classes.push('novisible');
    }
    if (properties.teacherOnly === 'true' || properties.visibilityType === 'teacher') {
      classes.push('teacher-only');
    }
    if (properties.cssClass) {
      classes.push(properties.cssClass);
    }

    // Build data attributes
    let dataAttrs = '';
    if (includeDataAttributes) {
      // Determine iDevice path based on basePath context:
      // - Preview mode (basePath contains /files/perm/idevices/): use basePath + type + /export/
      // - Export mode (relative basePath): use basePath + idevices/ + type + /
      let idevicePath;
      if (basePath && basePath.includes('/files/perm/idevices/')) {
        // Preview mode: basePath already points to idevices base, add type + /export/
        idevicePath = `${basePath}${type}/export/`;
      } else {
        // Export mode: standard path with idevices prefix
        idevicePath = `${basePath}idevices/${type}/`;
      }
      dataAttrs = ` data-idevice-path="${this.escapeAttr(idevicePath)}"`;
      dataAttrs += ` data-idevice-type="${this.escapeAttr(type)}"`;

      if (config.componentType === 'json') {
        dataAttrs += ` data-idevice-component-type="json"`;

        // Add JSON data for non-text iDevices
        if (type !== 'text' && Object.keys(properties).length > 0) {
          const jsonData = JSON.stringify(properties);
          dataAttrs += ` data-idevice-json-data="${this.escapeAttr(jsonData)}"`;
          dataAttrs += ` data-idevice-template="${this.escapeAttr(config.template)}"`;
        }
      }
    }

    // Fix asset URLs in content
    const fixedContent = this.fixAssetUrls(htmlContent, basePath);

    // Wrap text iDevice content in exe-text div (as per legacy format)
    const isTextIdevice = type === 'text' || type === 'FreeTextIdevice' || type === 'TextIdevice';
    const contentHtml = isTextIdevice && fixedContent
      ? `<div class="exe-text">${fixedContent}</div>`
      : fixedContent;

    // Generate HTML
    return `<div id="${this.escapeAttr(ideviceId)}" class="${classes.join(' ')}"${dataAttrs}>
${contentHtml}
</div>`;
  }

  /**
   * Render a block with multiple iDevices
   * @param {Object} block - Block data from extractBlockData()
   * @param {Object} options - Rendering options
   * @returns {string} HTML string
   */
  renderBlock(block, options = {}) {
    const { basePath = '', includeDataAttributes = true } = options;

    const blockId = block.id;
    const blockName = block.name || '';
    const components = block.components || [];
    const properties = block.properties || {};

    // Build CSS classes for block
    const classes = ['box'];
    const hasHeader = blockName && blockName.trim() !== '';

    if (!hasHeader) {
      classes.push('no-header');
    }
    if (properties.minimized === 'true') {
      classes.push('minimized');
    }
    if (properties.visibility === 'false') {
      classes.push('novisible');
    }
    if (properties.teacherOnly === 'true' || properties.visibilityType === 'teacher') {
      classes.push('teacher-only');
    }
    if (properties.cssClass) {
      classes.push(properties.cssClass);
    }

    // Build block header
    let headerHtml = '';
    if (hasHeader) {
      headerHtml = `<header class="box-head no-icon">
<h1 class="box-title">${this.escapeHtml(blockName)}</h1>
</header>`;
    } else {
      headerHtml = '<div class="box-head"></div>';
    }

    // Render all iDevices in the block
    let contentHtml = '';
    for (const component of components) {
      contentHtml += this.render(component, { basePath, includeDataAttributes });
    }

    return `<article id="${this.escapeAttr(blockId)}" class="${classes.join(' ')}">
${headerHtml}
<div class="box-content">
${contentHtml}
</div>
</article>`;
  }

  /**
   * Fix asset URLs in HTML content
   *
   * Behavior differs based on basePath:
   * - Preview mode (http:// or https:// basePath): Preserve asset:// URLs for AssetManager resolution
   * - Export mode (relative basePath): Transform asset:// to content/resources/ for static export
   *
   * @param {string} content - HTML content
   * @param {string} basePath - Base path prefix
   * @returns {string} Fixed HTML content
   */
  fixAssetUrls(content, basePath) {
    if (!content) return '';

    // Detect preview mode - when basePath starts with http:// or https://
    // In preview mode, asset:// URLs should be preserved for AssetManager to resolve to blob URLs
    const isPreviewMode = basePath && (basePath.startsWith('http://') || basePath.startsWith('https://'));

    if (isPreviewMode) {
      // Preview mode: Convert files/tmp/ paths to asset:// format for AssetManager
      content = content.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (match, relativePath) => {
        return `asset://${relativePath}`;
      });
      // asset:// URLs are preserved as-is for AssetManager to resolve
      return content;
    }

    // Export mode: Transform asset:// to content/resources/
    // Skip blob: and data: URLs inside asset:// (shouldn't be transformed)
    content = content.replace(/asset:\/\/([^"']+)/g, (match, assetPath) => {
      // Skip blob: and data: URLs
      if (assetPath.startsWith('blob:') || assetPath.startsWith('data:')) {
        return match;
      }
      return `${basePath}content/resources/${assetPath}`;
    });

    // Fix files/tmp/ paths (from server temp paths)
    content = content.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (match, relativePath) => {
      return `${basePath}content/resources/${relativePath}`;
    });

    // Fix relative paths that start with /files/
    content = content.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (match, path) => {
      return `"${basePath}content/resources/${path}"`;
    });

    return content;
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
   * Escape attribute value
   * @param {string} str
   * @returns {string}
   */
  escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Get list of CSS files needed for given iDevice types
   * @param {string[]} ideviceTypes - Array of iDevice type names
   * @param {string} basePath - Base path prefix
   * @returns {string[]} Array of CSS link tags
   */
  getCssLinks(ideviceTypes, basePath = '') {
    const links = [];
    const seen = new Set();

    for (const type of ideviceTypes) {
      const config = this.getConfig(type);
      const typeName = type.toLowerCase().replace('idevice', '') || config.cssClass;

      if (!seen.has(typeName)) {
        seen.add(typeName);
        links.push(`<link rel="stylesheet" href="${basePath}idevices/${typeName}/${typeName}.css">`);
      }
    }

    return links;
  }

  /**
   * Get list of JS files needed for given iDevice types
   * @param {string[]} ideviceTypes - Array of iDevice type names
   * @param {string} basePath - Base path prefix
   * @returns {string[]} Array of script tags
   */
  getJsScripts(ideviceTypes, basePath = '') {
    const scripts = [];
    const seen = new Set();

    for (const type of ideviceTypes) {
      const config = this.getConfig(type);
      const typeName = type.toLowerCase().replace('idevice', '') || config.cssClass;

      if (!seen.has(typeName)) {
        seen.add(typeName);
        scripts.push(`<script src="${basePath}idevices/${typeName}/${typeName}.js"></script>`);
      }
    }

    return scripts;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IdeviceHtmlRenderer;
} else {
  window.IdeviceHtmlRenderer = IdeviceHtmlRenderer;
}
