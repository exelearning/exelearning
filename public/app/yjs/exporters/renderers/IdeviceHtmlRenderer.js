/**
 * IdeviceHtmlRenderer
 * Renders iDevice components to HTML for export.
 *
 * Generates HTML structure matching legacy Symfony exports:
 * - <div class="idevice_node {cssClass}"> wrapper with data attributes
 * - Loads template from /export/{type}.html if available
 * - Injects content and JSON properties
 */
class IdeviceHtmlRenderer {
  /**
   * @param {ResourceFetcher} resourceFetcher - Optional resource fetcher for templates
   */
  constructor(resourceFetcher = null) {
    this.resourceFetcher = resourceFetcher;
    // Cache for iDevice configurations
    this.configCache = new Map();
    // Cache for templates
    this.templateCache = new Map();
    // Base path for iDevice files
    this.idevicesBasePath = '/files/perm/idevices/base';
  }

  /**
   * iDevice type configurations
   * Maps iDevice type names to their CSS class and component type
   */
  static IDEVICE_CONFIGS = {
    // Text and content
    'text': { cssClass: 'text', componentType: 'json', template: 'text.html' },
    'FreeTextIdevice': { cssClass: 'text', componentType: 'json', template: 'text.html' },
    'TextIdevice': { cssClass: 'text', componentType: 'json', template: 'text.html' },

    // Forms and quizzes
    'form': { cssClass: 'form', componentType: 'json', template: 'form.html' },
    'QuizActivity': { cssClass: 'form', componentType: 'json', template: 'form.html' },
    'MultipleChoiceIdevice': { cssClass: 'form', componentType: 'json', template: 'form.html' },

    // Interactive activities
    'guess': { cssClass: 'guess', componentType: 'json', template: 'guess.html' },
    'checklist': { cssClass: 'checklist', componentType: 'json', template: 'checklist.html' },
    'rubric': { cssClass: 'rubric', componentType: 'json', template: 'rubric.html' },
    'casestudy': { cssClass: 'casestudy', componentType: 'json', template: 'casestudy.html' },
    'challenge': { cssClass: 'challenge', componentType: 'json', template: 'challenge.html' },
    'flipcards': { cssClass: 'flipcards', componentType: 'json', template: 'flipcards.html' },
    'crossword': { cssClass: 'crossword', componentType: 'json', template: 'crossword.html' },
    'trivial': { cssClass: 'trivial', componentType: 'json', template: 'trivial.html' },
    'trueorfalse': { cssClass: 'trueorfalse', componentType: 'json', template: 'trueorfalse.html' },

    // Media
    'image-gallery': { cssClass: 'image-gallery', componentType: 'json', template: 'image-gallery.html' },
    'interactive-video': { cssClass: 'interactive-video', componentType: 'json', template: 'interactive-video.html' },
    'select-media-files': { cssClass: 'select-media-files', componentType: 'json', template: 'select-media-files.html' },

    // Games
    'az-quiz-game': { cssClass: 'az-quiz-game', componentType: 'json', template: 'az-quiz-game.html' },
    'word-search': { cssClass: 'word-search', componentType: 'json', template: 'word-search.html' },
    'puzzle': { cssClass: 'puzzle', componentType: 'json', template: 'puzzle.html' },
    'padlock': { cssClass: 'padlock', componentType: 'json', template: 'padlock.html' },

    // External content
    'external-website': { cssClass: 'external-website', componentType: 'json', template: 'external-website.html' },
    'geogebra-activity': { cssClass: 'geogebra-activity', componentType: 'json', template: 'geogebra-activity.html' },
    'map': { cssClass: 'map', componentType: 'json', template: 'map.html' },

    // Utilities
    'attached-files': { cssClass: 'attached-files', componentType: 'json', template: 'attached-files.html' },
    'download-source-file': { cssClass: 'download-source-file', componentType: 'json', template: 'download-source-file.html' },
    'progress-report': { cssClass: 'progress-report', componentType: 'json', template: 'progress-report.html' },

    // Learning design
    'udl-content': { cssClass: 'udl-content', componentType: 'json', template: 'udl-content.html' },
    'discover': { cssClass: 'discover', componentType: 'json', template: 'discover.html' },
    'example': { cssClass: 'example', componentType: 'json', template: 'example.html' },
  };

  /**
   * Get iDevice configuration
   * @param {string} ideviceType - Type name of the iDevice
   * @returns {{cssClass: string, componentType: string, template: string}}
   */
  getConfig(ideviceType) {
    if (IdeviceHtmlRenderer.IDEVICE_CONFIGS[ideviceType]) {
      return IdeviceHtmlRenderer.IDEVICE_CONFIGS[ideviceType];
    }

    // Fallback: derive from type name
    const typeName = ideviceType.toLowerCase().replace('idevice', '');
    return {
      cssClass: typeName,
      componentType: 'json',
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
      // For preview mode (server paths), basePath already contains /files/perm/idevices/base/
      // For export mode (ZIP), basePath is empty or relative and we need to add idevices/
      const isPreviewPath = basePath.includes('/files/perm/idevices/base/');
      const idevicePath = isPreviewPath
        ? `${basePath}${type}/export/`
        : `${basePath}idevices/${type}/`;
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
   * IMPORTANT: This method behaves differently in preview vs export mode:
   *
   * - Preview mode (basePath is absolute URL like http://...):
   *   Preserves asset:// URLs so they can be resolved to blob:// URLs later
   *   by AssetManager.resolveHTMLAssetsSync()
   *
   * - Export mode (basePath is relative like '' or '../'):
   *   Transforms asset:// URLs to content/resources/ paths for ZIP export
   *
   * @param {string} content - HTML content
   * @param {string} basePath - Base path prefix
   * @returns {string} Fixed HTML content
   */
  fixAssetUrls(content, basePath) {
    if (!content) return '';

    let result = content;

    // Detect preview mode: basePath is an absolute URL (http:// or https://)
    // In preview mode, preserve asset:// URLs - they'll be resolved to blob:// later
    const isPreviewMode = basePath.startsWith('http://') || basePath.startsWith('https://');

    if (isPreviewMode) {
      // Preview mode: preserve asset:// URLs for blob resolution
      // Only convert files/tmp/ paths to asset:// format
      result = result.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (match, relativePath) => {
        if (relativePath.startsWith('blob:') || relativePath.startsWith('data:')) {
          return match;
        }
        return `asset://${relativePath}`;
      });
      return result;
    }

    // Export mode: transform asset:// to content/resources/
    // Skip blob: and data: URLs (shouldn't happen, but defensive)
    result = result.replace(/asset:\/\/([^"']+)/g, (match, assetPath) => {
      if (assetPath.startsWith('blob:') || assetPath.startsWith('data:')) {
        return match; // Keep original, don't transform
      }
      return `${basePath}content/resources/${assetPath}`;
    });

    // Fix files/tmp/ paths (from server temp paths)
    result = result.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (match, relativePath) => {
      if (relativePath.startsWith('blob:') || relativePath.startsWith('data:')) {
        return match;
      }
      return `${basePath}content/resources/${relativePath}`;
    });

    // Fix relative paths that start with /files/
    result = result.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (match, path) => {
      if (path.startsWith('blob:') || path.startsWith('data:')) {
        return match;
      }
      return `"${basePath}content/resources/${path}"`;
    });

    return result;
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
