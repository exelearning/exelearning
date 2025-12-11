/**
 * Scorm2004Exporter
 * Exports a Yjs document to SCORM 2004 (4th Edition) package format (ZIP).
 *
 * SCORM 2004 export creates:
 * - imsmanifest.xml (SCORM 2004 manifest with sequencing)
 * - imslrm.xml (LOM metadata)
 * - index.html (first page)
 * - html/*.html (other pages)
 * - libs/ (JavaScript libraries + SCORM 2004 API wrapper)
 * - theme/ (theme CSS/JS)
 * - idevices/ (iDevice-specific CSS/JS)
 * - content/resources/ (project assets)
 * - content/css/ (base CSS)
 *
 * @extends Html5Exporter
 */

// Get generators (works in both browser and Node.js)
const _Scorm2004ManifestGenerator =
  typeof Scorm2004ManifestGenerator !== 'undefined'
    ? Scorm2004ManifestGenerator
    : typeof require !== 'undefined'
      ? require('./generators/Scorm2004ManifestGenerator')
      : null;

const _LomMetadataGenerator2004 =
  typeof LomMetadataGenerator !== 'undefined'
    ? LomMetadataGenerator
    : typeof require !== 'undefined'
      ? require('./generators/LomMetadataGenerator')
      : null;

class Scorm2004Exporter extends Html5Exporter {
  /**
   * @param {YjsDocumentManager} documentManager - The Yjs document manager
   * @param {AssetCacheManager} assetCacheManager - Asset cache manager for retrieving assets
   * @param {ResourceFetcher} resourceFetcher - Resource fetcher for server resources
   */
  constructor(documentManager, assetCacheManager = null, resourceFetcher = null) {
    super(documentManager, assetCacheManager, resourceFetcher);

    // Initialize SCORM-specific generators
    this.manifestGenerator = null;
    this.lomGenerator = null;
  }

  /**
   * Get file extension for SCORM 2004 format
   * @returns {string}
   */
  getFileExtension() {
    return '.zip';
  }

  /**
   * Get file suffix for SCORM 2004 format
   * @returns {string}
   */
  getFileSuffix() {
    return '_scorm2004';
  }

  /**
   * Export to SCORM 2004 ZIP file and trigger download
   * @param {string} filename - Optional filename override
   * @returns {Promise<{success: boolean, filename: string}>}
   */
  async export(filename = null) {
    const exportFilename = filename || this.buildFilename();
    Logger.log(`[Scorm2004Exporter] Exporting to ${exportFilename}...`);

    try {
      const zip = this.createZip();
      let pages = this.buildPageList();
      const meta = this.getMetadata();
      const themeName = meta.get('theme') || 'base';
      const projectId = this.generateProjectId();

      // Pre-process pages: add filenames to asset URLs
      Logger.log('[Scorm2004Exporter] Pre-processing asset URLs...');
      pages = await this.preprocessPagesForExport(pages);

      // Initialize generators
      this.manifestGenerator = new _Scorm2004ManifestGenerator(projectId, pages, {
        title: meta.get('title') || 'eXeLearning',
        language: meta.get('language') || 'en',
        author: meta.get('author') || '',
        description: meta.get('description') || '',
        license: meta.get('license') || '',
      });

      this.lomGenerator = new _LomMetadataGenerator2004(projectId, {
        title: meta.get('title') || 'eXeLearning',
        language: meta.get('language') || 'en',
        author: meta.get('author') || '',
        description: meta.get('description') || '',
        license: meta.get('license') || '',
      });

      // Track files for manifest
      const commonFiles = [];
      const pageFiles = {};

      // 1. Generate HTML pages (with SCORM 2004 support)
      Logger.log(`[Scorm2004Exporter] Generating ${pages.length} HTML pages...`);
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const html = this.generateScorm2004PageHtml(page, pages, meta);
        const isIndex = i === 0;
        const pageFilename = isIndex ? 'index.html' : `html/${this.sanitizePageFilename(page.title)}.html`;
        zip.file(pageFilename, html);

        pageFiles[page.id] = {
          fileUrl: pageFilename,
          files: [],
        };
      }

      // 2. Add base CSS
      Logger.log('[Scorm2004Exporter] Adding base CSS...');
      zip.file('content/css/base.css', this.getBaseCss());
      commonFiles.push('content/css/base.css');

      // 3. Fetch and add theme
      if (this.resourceFetcher) {
        Logger.log(`[Scorm2004Exporter] Fetching theme: ${themeName}...`);
        try {
          const themeFiles = await this.resourceFetcher.fetchTheme(themeName);
          for (const [path, content] of themeFiles) {
            zip.file(`theme/${path}`, content);
            commonFiles.push(`theme/${path}`);
          }
        } catch (e) {
          console.warn(`[Scorm2004Exporter] Could not load theme ${themeName}:`, e);
          zip.file('theme/content.css', this.getFallbackThemeCss());
          zip.file('theme/default.js', this.getFallbackThemeJs());
          commonFiles.push('theme/content.css', 'theme/default.js');
        }

        // 4. Fetch and add base libraries
        Logger.log('[Scorm2004Exporter] Fetching base libraries...');
        try {
          const baseLibs = await this.resourceFetcher.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            zip.file(`libs/${path}`, content);
            commonFiles.push(`libs/${path}`);
          }
        } catch (e) {
          console.warn('[Scorm2004Exporter] Could not load base libraries:', e);
        }

        // 5. Fetch SCORM 2004 API wrapper files
        Logger.log('[Scorm2004Exporter] Fetching SCORM 2004 API files...');
        try {
          const scormFiles = await this.resourceFetcher.fetchScormApiFiles('2004');
          for (const [path, content] of scormFiles) {
            zip.file(`libs/${path}`, content);
            commonFiles.push(`libs/${path}`);
          }
        } catch (e) {
          console.warn('[Scorm2004Exporter] Could not load SCORM 2004 API files:', e);
          // Add fallback SCORM files
          zip.file('libs/SCORM_API_wrapper.js', this.getScorm2004ApiWrapper());
          zip.file('libs/SCOFunctions.js', this.getSco2004Functions());
          commonFiles.push('libs/SCORM_API_wrapper.js', 'libs/SCOFunctions.js');
        }

        // 6. Fetch and add iDevice assets
        const usedIdevices = this.getUsedIdevices(pages);
        if (usedIdevices.length > 0) {
          Logger.log(`[Scorm2004Exporter] Fetching iDevice assets: ${usedIdevices.join(', ')}...`);
          for (const idevice of usedIdevices) {
            try {
              const ideviceFiles = await this.resourceFetcher.fetchIdevice(idevice);
              for (const [path, content] of ideviceFiles) {
                zip.file(`idevices/${idevice}/${path}`, content);
                commonFiles.push(`idevices/${idevice}/${path}`);
              }
            } catch (e) {
              // Many iDevices don't have extra files
            }
          }
        }
      } else {
        // Add fallback files
        zip.file('theme/content.css', this.getFallbackThemeCss());
        zip.file('theme/default.js', this.getFallbackThemeJs());
        zip.file('libs/SCORM_API_wrapper.js', this.getScorm2004ApiWrapper());
        zip.file('libs/SCOFunctions.js', this.getSco2004Functions());
        commonFiles.push('theme/content.css', 'theme/default.js', 'libs/SCORM_API_wrapper.js', 'libs/SCOFunctions.js');
      }

      // 7. Add project assets from cache
      Logger.log('[Scorm2004Exporter] Adding project assets...');
      await this.addAssetsToZipWithResourcePath(zip);

      // 8. Generate imsmanifest.xml
      Logger.log('[Scorm2004Exporter] Generating imsmanifest.xml...');
      const manifestXml = this.manifestGenerator.generate({
        commonFiles,
        pageFiles,
      });
      zip.file('imsmanifest.xml', manifestXml);

      // 9. Generate imslrm.xml (LOM metadata)
      Logger.log('[Scorm2004Exporter] Generating imslrm.xml...');
      const lomXml = this.lomGenerator.generate();
      zip.file('imslrm.xml', lomXml);

      // 10. Generate and download ZIP
      Logger.log('[Scorm2004Exporter] Generating ZIP...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });

      this.downloadBlob(blob, exportFilename);

      Logger.log(`[Scorm2004Exporter] Export complete: ${exportFilename}`);
      return { success: true, filename: exportFilename };
    } catch (error) {
      console.error('[Scorm2004Exporter] Export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate project ID for SCORM package
   * @returns {string}
   */
  generateProjectId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Generate SCORM 2004-enabled HTML page
   * @param {Object} page - Page data
   * @param {Array} allPages - All pages
   * @param {Y.Map} meta - Project metadata
   * @returns {string}
   */
  generateScorm2004PageHtml(page, allPages, meta) {
    const lang = meta.get('language') || 'en';
    const projectTitle = meta.get('title') || 'eXeLearning';
    const customStyles = meta.get('customStyles') || '';
    const isIndex = allPages.indexOf(page) === 0;
    const basePath = isIndex ? '' : '../';
    const author = meta.get('author') || '';
    const license = meta.get('license') || 'CC-BY-SA';
    const usedIdevices = this.getUsedIdevicesForPage(page);

    // Use PageHtmlRenderer with SCORM 2004 options
    return this.pageRenderer.render(page, {
      projectTitle,
      language: lang,
      theme: meta.get('theme') || 'base',
      customStyles,
      allPages,
      basePath,
      isIndex,
      usedIdevices,
      author,
      license,
      // SCORM 2004-specific options
      isScorm: true,
      scormVersion: '2004',
      bodyClass: 'exe-scorm exe-scorm2004',
      extraHeadScripts: this.getScorm2004HeadScripts(basePath),
      onLoadScript: 'loadPage()',
      onUnloadScript: 'unloadPage()',
    });
  }

  /**
   * Get SCORM 2004-specific head scripts
   * @param {string} basePath
   * @returns {string}
   */
  getScorm2004HeadScripts(basePath) {
    return `<script src="${basePath}libs/SCORM_API_wrapper.js"></script>
<script src="${basePath}libs/SCOFunctions.js"></script>`;
  }

  /**
   * Get SCORM 2004 API wrapper (fallback)
   * @returns {string}
   */
  getScorm2004ApiWrapper() {
    return `/**
 * SCORM 2004 API Wrapper
 * Minimal implementation for SCORM 2004 communication
 */
var pipwerks = pipwerks || {};

pipwerks.SCORM = {
  version: "2004",
  API: { handle: null, isFound: false },
  data: { completionStatus: null, exitStatus: null },
  debug: { isActive: true }
};

pipwerks.SCORM.API.find = function(win) {
  var findAttempts = 0, findAttemptLimit = 500;
  while (!win.API_1484_11 && win.parent && win.parent !== win && findAttempts < findAttemptLimit) {
    findAttempts++;
    win = win.parent;
  }
  return win.API_1484_11 || null;
};

pipwerks.SCORM.API.get = function() {
  var win = window;
  if (win.parent && win.parent !== win) { this.handle = this.find(win.parent); }
  if (!this.handle && win.opener) { this.handle = this.find(win.opener); }
  if (this.handle) { this.isFound = true; }
  return this.handle;
};

pipwerks.SCORM.API.getHandle = function() {
  if (!this.handle) { this.get(); }
  return this.handle;
};

pipwerks.SCORM.connection = { isActive: false };

pipwerks.SCORM.init = function() {
  var success = false, API = this.API.getHandle();
  if (API) {
    success = API.Initialize("");
    if (success === "true" || success === true) {
      this.connection.isActive = true;
      success = true;
    }
  }
  return success;
};

pipwerks.SCORM.quit = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.Terminate("");
    if (success === "true" || success === true) {
      this.connection.isActive = false;
      success = true;
    }
  }
  return success;
};

pipwerks.SCORM.get = function(parameter) {
  var value = "", API = this.API.getHandle();
  if (API && this.connection.isActive) {
    value = API.GetValue(parameter);
  }
  return value;
};

pipwerks.SCORM.set = function(parameter, value) {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.SetValue(parameter, value);
    success = (success === "true" || success === true);
  }
  return success;
};

pipwerks.SCORM.save = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.Commit("");
    success = (success === "true" || success === true);
  }
  return success;
};

// Shorthand
var scorm = pipwerks.SCORM;
`;
  }

  /**
   * Get SCO Functions for SCORM 2004 (fallback)
   * @returns {string}
   */
  getSco2004Functions() {
    return `/**
 * SCO Functions for SCORM 2004
 * Page load/unload handlers for SCORM 2004 communication
 */

var startTimeStamp = null;
var exitPageStatus = false;

function loadPage() {
  startTimeStamp = new Date();
  var result = scorm.init();
  if (result) {
    var status = scorm.get("cmi.completion_status");
    if (status === "not attempted" || status === "unknown" || status === "") {
      scorm.set("cmi.completion_status", "incomplete");
    }
  }
  return result;
}

function unloadPage() {
  if (!exitPageStatus) {
    exitPageStatus = true;
    computeTime();
    scorm.set("cmi.exit", "suspend");
    scorm.save();
    scorm.quit();
  }
}

function computeTime() {
  if (startTimeStamp != null) {
    var now = new Date();
    var elapsed = now.getTime() - startTimeStamp.getTime();
    // SCORM 2004 uses ISO 8601 duration format
    var seconds = Math.round(elapsed / 1000);
    var hours = Math.floor(seconds / 3600);
    var mins = Math.floor((seconds - hours * 3600) / 60);
    var secs = seconds - hours * 3600 - mins * 60;
    // Format: PT#H#M#S
    var sessionTime = "PT" + hours + "H" + mins + "M" + secs + "S";
    scorm.set("cmi.session_time", sessionTime);
  }
}

function setComplete() {
  scorm.set("cmi.completion_status", "completed");
  scorm.set("cmi.success_status", "passed");
  scorm.save();
}

function setIncomplete() {
  scorm.set("cmi.completion_status", "incomplete");
  scorm.save();
}

function setScore(score, maxScore, minScore) {
  // SCORM 2004 score must be between 0 and 1
  var scaledScore = maxScore ? score / maxScore : score / 100;
  scorm.set("cmi.score.scaled", scaledScore);
  scorm.set("cmi.score.raw", score);
  if (maxScore !== undefined) scorm.set("cmi.score.max", maxScore);
  if (minScore !== undefined) scorm.set("cmi.score.min", minScore);
  scorm.save();
}
`;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scorm2004Exporter;
} else {
  window.Scorm2004Exporter = Scorm2004Exporter;
}
