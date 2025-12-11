/**
 * LibraryDetector
 * Detects required JavaScript/CSS libraries by scanning HTML content for patterns.
 *
 * This replicates the behavior of Symfony's ExportXmlUtil::getPathForLibrariesInIdevices()
 * to ensure exports include all necessary libraries based on content patterns.
 *
 * Usage:
 *   const detector = new LibraryDetector();
 *   const allHtml = pages.map(p => p.content).join('');
 *   const libraries = detector.detectLibraries(allHtml);
 *   // Returns: [{ name: 'exe_effects', files: [...] }, ...]
 */
class LibraryDetector {
  /**
   * Library detection patterns
   * Each entry: { name, type, pattern, files }
   * - name: Library identifier
   * - type: 'class', 'rel', or 'regex'
   * - pattern: Pattern to match (class name, rel value, or regex)
   * - files: Array of file paths relative to libs/
   */
  static LIBRARY_PATTERNS = [
    // Effects library (animations, transitions)
    {
      name: 'exe_effects',
      type: 'class',
      pattern: 'exe-fx',
      files: ['exe_effects/exe_effects.js', 'exe_effects/exe_effects.css'],
    },
    // Games library
    {
      name: 'exe_games',
      type: 'class',
      pattern: 'exe-game',
      files: ['exe_games/exe_games.js', 'exe_games/exe_games.css'],
    },
    // Code highlighting
    {
      name: 'exe_highlighter',
      type: 'class',
      pattern: 'highlighted-code',
      files: ['exe_highlighter/exe_highlighter.js', 'exe_highlighter/exe_highlighter.css'],
    },
    // Lightbox for images
    {
      name: 'exe_lightbox',
      type: 'rel',
      pattern: 'lightbox',
      files: ['exe_lightbox/exe_lightbox.js', 'exe_lightbox/exe_lightbox.css'],
    },
    // Lightbox for image galleries (same files as lightbox)
    {
      name: 'exe_lightbox_gallery',
      type: 'class',
      pattern: 'imageGallery',
      files: ['exe_lightbox/exe_lightbox.js', 'exe_lightbox/exe_lightbox.css'],
    },
    // Tooltips (qTip2)
    {
      name: 'exe_tooltips',
      type: 'class',
      pattern: 'exe-tooltip',
      files: ['exe_tooltips/exe_tooltips.js', 'exe_tooltips/jquery.qtip.min.js', 'exe_tooltips/jquery.qtip.min.css', 'exe_tooltips/imagesloaded.pkg.min.js'],
    },
    // Image magnifier
    {
      name: 'exe_magnify',
      type: 'class',
      pattern: 'ImageMagnifierIdevice',
      files: ['exe_magnify/mojomagnify.js'],
    },
    // Wikipedia content styling
    {
      name: 'exe_wikipedia',
      type: 'class',
      pattern: 'exe-wikipedia-content',
      files: ['exe_wikipedia/exe_wikipedia.css'],
    },
    // Media player (MediaElement.js)
    {
      name: 'exe_media',
      type: 'class',
      pattern: 'mediaelement',
      files: [
        'exe_media/exe_media.js',
        'exe_media/exe_media.css',
        'exe_media/exe_media_background.png',
        'exe_media/exe_media_bigplay.png',
        'exe_media/exe_media_bigplay.svg',
        'exe_media/exe_media_controls.png',
        'exe_media/exe_media_controls.svg',
        'exe_media/exe_media_loading.gif',
      ],
    },
    // Media player via audio/video file links with lightbox
    {
      name: 'exe_media_link',
      type: 'regex',
      pattern: /href="[^"]*\.(mp3|mp4|flv|ogg|ogv)"[^>]*rel="[^"]*lightbox/i,
      files: [
        'exe_media/exe_media.js',
        'exe_media/exe_media.css',
        'exe_media/exe_media_background.png',
        'exe_media/exe_media_bigplay.png',
        'exe_media/exe_media_bigplay.svg',
        'exe_media/exe_media_controls.png',
        'exe_media/exe_media_controls.svg',
        'exe_media/exe_media_loading.gif',
      ],
    },
    // ABC Music notation (abcjs)
    {
      name: 'abcjs',
      type: 'class',
      pattern: 'abc-music',
      files: ['abcjs/abcjs-basic-min.js', 'abcjs/exe_abc_music.js', 'abcjs/abcjs-audio.css'],
    },
    // LaTeX math expressions (MathJax)
    {
      name: 'exe_math',
      type: 'regex',
      pattern: /\\\(|\\\[/,
      files: ['exe_math/tex-mml-svg.js'],
    },
    // DataGame with encrypted LaTeX (special case)
    {
      name: 'exe_math_datagame',
      type: 'class',
      pattern: 'DataGame',
      files: ['exe_math/tex-mml-svg.js'],
      requiresLatexCheck: true,
    },
    // Mermaid diagrams
    {
      name: 'mermaid',
      type: 'class',
      pattern: 'mermaid',
      files: ['mermaid/mermaid.min.js'],
    },
    // jQuery UI for sortable/draggable iDevices
    {
      name: 'jquery_ui_ordena',
      type: 'class',
      pattern: 'ordena-IDevice',
      files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
      name: 'jquery_ui_clasifica',
      type: 'class',
      pattern: 'clasifica-IDevice',
      files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
      name: 'jquery_ui_relaciona',
      type: 'class',
      pattern: 'relaciona-IDevice',
      files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
      name: 'jquery_ui_dragdrop',
      type: 'class',
      pattern: 'dragdrop-IDevice',
      files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
      name: 'jquery_ui_completa',
      type: 'class',
      pattern: 'completa-IDevice',
      files: ['jquery-ui/jquery-ui.min.js'],
    },
    // Accessibility toolbar
    {
      name: 'exe_atools',
      type: 'class',
      pattern: 'exe-atools',
      files: ['exe_atools/exe_atools.js', 'exe_atools/exe_atools.css'],
    },
  ];

  /**
   * Base libraries (always included in exports)
   * Order matters: jQuery must load before Bootstrap
   */
  static BASE_LIBRARIES = [
    // jQuery
    'jquery/jquery.min.js',
    // Common eXe scripts
    'common_i18n.js',
    'common.js',
    'exe_export.js',
    // Bootstrap (JS bundle includes Popper)
    'bootstrap/bootstrap.bundle.min.js',
    'bootstrap/bootstrap.bundle.min.js.map',
    'bootstrap/bootstrap.min.css',
    'bootstrap/bootstrap.min.css.map',
  ];

  /**
   * SCORM-specific libraries
   */
  static SCORM_LIBRARIES = [
    'scorm/SCORM_API_wrapper.js',
    'scorm/SCOFunctions.js',
  ];

  constructor() {
    // Track which libraries have been detected
    this.detectedLibraries = new Set();
    // Track unique file paths
    this.filesToInclude = new Set();
  }

  /**
   * Detect all required libraries by scanning HTML content
   * @param {string} html - HTML content to scan
   * @param {Object} options - Detection options
   * @param {boolean} options.includeAccessibilityToolbar - Include accessibility toolbar
   * @returns {Object} Detected libraries info
   */
  detectLibraries(html, options = {}) {
    this.detectedLibraries.clear();
    this.filesToInclude.clear();

    if (!html || typeof html !== 'string') {
      return this._buildResult();
    }

    // Scan for each pattern
    for (const lib of LibraryDetector.LIBRARY_PATTERNS) {
      if (this._matchesPattern(html, lib)) {
        // Special case: DataGame requires LaTeX check in decrypted content
        if (lib.requiresLatexCheck) {
          if (!this._hasLatexInDataGame(html)) {
            continue;
          }
        }
        this._addLibrary(lib);
      }
    }

    // Add accessibility toolbar if requested
    if (options.includeAccessibilityToolbar) {
      const atoolsLib = LibraryDetector.LIBRARY_PATTERNS.find(l => l.name === 'exe_atools');
      if (atoolsLib) {
        this._addLibrary(atoolsLib);
      }
    }

    return this._buildResult();
  }

  /**
   * Check if HTML matches a library pattern
   * @param {string} html
   * @param {Object} lib - Library pattern definition
   * @returns {boolean}
   */
  _matchesPattern(html, lib) {
    switch (lib.type) {
      case 'class':
        // Match class="...pattern..." (with possible other classes)
        return new RegExp(`class="[^"]*${this._escapeRegex(lib.pattern)}[^"]*"`, 'i').test(html);

      case 'rel':
        // Match rel="...pattern..."
        return new RegExp(`rel="[^"]*${this._escapeRegex(lib.pattern)}[^"]*"`, 'i').test(html);

      case 'regex':
        // Use provided regex pattern
        return lib.pattern.test(html);

      default:
        return false;
    }
  }

  /**
   * Check if DataGame content contains LaTeX after decryption
   * @param {string} html
   * @returns {boolean}
   */
  _hasLatexInDataGame(html) {
    // Extract DataGame div content
    const match = html.match(/<div[^>]*class="[^"]*DataGame[^"]*"[^>]*>(.*?)<\/div>/s);
    if (!match) return false;

    // Decrypt the content (same algorithm as Symfony)
    const decrypted = this._decrypt(match[1]);

    // Check for LaTeX patterns
    return /\\\(|\\\[/.test(decrypted);
  }

  /**
   * Decrypt XOR-encoded string (matches Symfony's decrypt method)
   * @param {string} str
   * @returns {string}
   */
  _decrypt(str) {
    if (!str || str === 'undefined' || str === 'null') return '';

    try {
      str = decodeURIComponent(str);
      const key = 146;
      let result = '';
      for (let i = 0; i < str.length; i++) {
        result += String.fromCharCode(key ^ str.charCodeAt(i));
      }
      return result;
    } catch (e) {
      return '';
    }
  }

  /**
   * Add a library and its files to the detected set
   * @param {Object} lib
   */
  _addLibrary(lib) {
    // Avoid duplicates by library name
    if (this.detectedLibraries.has(lib.name)) return;

    this.detectedLibraries.add(lib.name);

    // Add all files for this library
    for (const file of lib.files) {
      this.filesToInclude.add(file);
    }
  }

  /**
   * Build the result object
   * @returns {Object}
   */
  _buildResult() {
    const libraries = [];

    // Group files by library name
    for (const lib of LibraryDetector.LIBRARY_PATTERNS) {
      if (this.detectedLibraries.has(lib.name)) {
        libraries.push({
          name: lib.name,
          files: lib.files,
        });
      }
    }

    return {
      libraries,
      files: Array.from(this.filesToInclude),
      count: libraries.length,
    };
  }

  /**
   * Get base libraries (always included)
   * @returns {string[]}
   */
  getBaseLibraries() {
    return [...LibraryDetector.BASE_LIBRARIES];
  }

  /**
   * Get SCORM-specific libraries
   * @returns {string[]}
   */
  getScormLibraries() {
    return [...LibraryDetector.SCORM_LIBRARIES];
  }

  /**
   * Get all files needed for export (base + detected)
   * @param {string} html - HTML content to scan
   * @param {Object} options - Options
   * @param {boolean} options.includeScorm - Include SCORM libraries
   * @param {boolean} options.includeAccessibilityToolbar - Include accessibility toolbar
   * @returns {string[]} Array of file paths
   */
  getAllRequiredFiles(html, options = {}) {
    const detected = this.detectLibraries(html, options);
    const files = new Set(this.getBaseLibraries());

    // Add detected library files
    for (const file of detected.files) {
      files.add(file);
    }

    // Add SCORM files if requested
    if (options.includeScorm) {
      for (const file of this.getScormLibraries()) {
        files.add(file);
      }
    }

    return Array.from(files);
  }

  /**
   * Group files by type for HTML head generation
   * @param {string[]} files - Array of file paths
   * @returns {{js: string[], css: string[]}}
   */
  groupFilesByType(files) {
    const js = [];
    const css = [];

    for (const file of files) {
      const ext = file.split('.').pop()?.toLowerCase();
      if (ext === 'js') {
        js.push(file);
      } else if (ext === 'css') {
        css.push(file);
      }
    }

    return { js, css };
  }

  /**
   * Escape special regex characters in a string
   * @param {string} str
   * @returns {string}
   */
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LibraryDetector;
} else {
  window.LibraryDetector = LibraryDetector;
}
