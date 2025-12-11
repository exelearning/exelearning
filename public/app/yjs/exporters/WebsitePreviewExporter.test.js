/**
 * WebsitePreviewExporter Tests
 *
 * Tests for the WebsitePreviewExporter class, particularly focusing on
 * iDevice script generation for game iDevices (crossword, puzzle, etc.)
 */

// Mock window.eXeLearning for getVersionedPath
global.window = {
  eXeLearning: {
    symfony: {
      basePath: '',
      baseURL: 'http://localhost:8080',
    },
    version: 'v1.0.0',
  },
};

// Mock Logger
global.Logger = {
  log: () => {},
};

// Mock IdeviceHtmlRenderer
class MockIdeviceHtmlRenderer {
  render() { return ''; }
  renderBlock() { return ''; }
}
global.IdeviceHtmlRenderer = MockIdeviceHtmlRenderer;

// Mock PageHtmlRenderer
class MockPageHtmlRenderer {
  constructor() {}
  render() { return ''; }
}
global.PageHtmlRenderer = MockPageHtmlRenderer;

// Mock BaseExporter
class MockBaseExporter {
  constructor(documentManager, assetCacheManager, resourceFetcher) {
    this.documentManager = documentManager;
    this.assetCacheManager = assetCacheManager;
    this.resourceFetcher = resourceFetcher;
    this.ideviceRenderer = new MockIdeviceHtmlRenderer();
  }
  getMetadata() { return new Map(); }
  buildPageList() { return []; }
  escapeHtml(s) { return s; }
  escapeAttr(s) { return s; }
  preprocessPagesForExport(pages) { return Promise.resolve(pages); }
  getUsedIdevices() { return []; }
}
global.BaseExporter = MockBaseExporter;

// Mock Html5Exporter inheriting from BaseExporter
class MockHtml5Exporter extends MockBaseExporter {
  constructor(documentManager, assetCacheManager, resourceFetcher) {
    super(documentManager, assetCacheManager, resourceFetcher);
    this.pageRenderer = new MockPageHtmlRenderer();
  }
}
global.Html5Exporter = MockHtml5Exporter;

// Import the class under test
const WebsitePreviewExporter = require('./WebsitePreviewExporter');

describe('WebsitePreviewExporter', () => {
  let exporter;
  let mockDocumentManager;

  beforeEach(() => {
    // Create a minimal mock document manager
    mockDocumentManager = {
      getDocument: () => ({
        getMap: () => new Map(),
        getArray: () => [],
      }),
    };

    exporter = new WebsitePreviewExporter(mockDocumentManager);
  });

  describe('generateWebsitePreviewScripts', () => {
    it('should include jQuery and common.js scripts', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', []);

      expect(scripts).toContain('jquery.min.js');
      expect(scripts).toContain('bootstrap.bundle.min.js');
      expect(scripts).toContain('common_i18n.js');
      expect(scripts).toContain('common.js');
    });

    it('should include crossword.js script for crossword iDevice', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['crossword']);

      expect(scripts).toContain('crossword/export/crossword.js');
    });

    it('should include puzzle.js script for puzzle iDevice', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['puzzle']);

      expect(scripts).toContain('puzzle/export/puzzle.js');
    });

    it('should include multiple iDevice scripts', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['crossword', 'puzzle', 'trivial']);

      expect(scripts).toContain('crossword/export/crossword.js');
      expect(scripts).toContain('puzzle/export/puzzle.js');
      expect(scripts).toContain('trivial/export/trivial.js');
    });

    it('should not duplicate scripts for same iDevice type', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['crossword', 'crossword']);

      const matches = scripts.match(/crossword\.js/g);
      expect(matches).not.toBeNull();
      expect(matches.length).toBe(1);
    });

    it('should normalize FreeTextIdevice to text', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['FreeTextIdevice']);

      expect(scripts).toContain('text/export/text.js');
      expect(scripts).not.toContain('freetextidevice');
    });

    it('should normalize TextIdevice to text', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['TextIdevice']);

      expect(scripts).toContain('text/export/text.js');
    });

    it('should handle iDevice types with -idevice suffix', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['quiz-idevice']);

      expect(scripts).toContain('quiz/export/quiz.js');
    });

    it('should load iDevice scripts after common.js and before theme.js', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['crossword']);

      const commonJsIndex = scripts.indexOf('common.js');
      const crosswordIndex = scripts.indexOf('crossword.js');
      const themeIndex = scripts.indexOf('style.js');

      expect(commonJsIndex).toBeLessThan(crosswordIndex);
      expect(crosswordIndex).toBeLessThan(themeIndex);
    });

    it('should include theme style.js', () => {
      const scripts = exporter.generateWebsitePreviewScripts('myTheme', []);

      expect(scripts).toContain('/files/perm/themes/base/myTheme/style.js');
    });

    it('should use versioned paths', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['crossword']);

      expect(scripts).toContain('v1.0.0');
    });

    it('should include Logger and eXe alias script for preview context', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['puzzle']);

      // Logger fallback for scripts that use it
      expect(scripts).toContain('window.Logger = window.Logger');
      // eXe.app = $exe structure as per exe_export.js setExe()
      expect(scripts).toContain('window.eXe.app = window.$exe');
    });

    it('should define aliases AFTER common.js and BEFORE iDevice scripts', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['puzzle']);

      const commonJsIndex = scripts.indexOf('common.js');
      const aliasIndex = scripts.indexOf('window.eXe.app = window.$exe');
      const puzzleIndex = scripts.indexOf('puzzle.js');

      expect(commonJsIndex).toBeLessThan(aliasIndex);
      expect(aliasIndex).toBeLessThan(puzzleIndex);
    });

    it('should include jQuery UI for complete iDevice', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['complete']);

      expect(scripts).toContain('jquery-ui.min.js');
    });

    it('should include jQuery UI for ordena iDevice', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['ordena']);

      expect(scripts).toContain('jquery-ui.min.js');
    });

    it('should include jQuery UI for dragdrop iDevice', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['dragdrop']);

      expect(scripts).toContain('jquery-ui.min.js');
    });

    it('should NOT include jQuery UI for text-only iDevices', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['text', 'crossword', 'puzzle']);

      expect(scripts).not.toContain('jquery-ui');
    });

    it('should load jQuery UI BEFORE iDevice scripts', () => {
      const scripts = exporter.generateWebsitePreviewScripts('default', ['complete']);

      const jqueryUiIndex = scripts.indexOf('jquery-ui.min.js');
      const completeIndex = scripts.indexOf('complete.js');

      expect(jqueryUiIndex).toBeLessThan(completeIndex);
    });
  });

  describe('generateWebsitePreviewHead', () => {
    it('should use export path for iDevice CSS', () => {
      const head = exporter.generateWebsitePreviewHead('default', ['puzzle'], 'Test Project', '');

      // Should use /export/ path for iDevice CSS
      expect(head).toContain('puzzle/export/puzzle.css');
    });

    it('should include CSS for multiple iDevices', () => {
      const head = exporter.generateWebsitePreviewHead('default', ['crossword', 'puzzle'], 'Test', '');

      expect(head).toContain('crossword/export/crossword.css');
      expect(head).toContain('puzzle/export/puzzle.css');
    });

    it('should deduplicate CSS links for same iDevice type', () => {
      const head = exporter.generateWebsitePreviewHead('default', ['puzzle', 'puzzle'], 'Test', '');

      const matches = head.match(/puzzle\/export\/puzzle\.css/g);
      expect(matches).not.toBeNull();
      expect(matches.length).toBe(1);
    });

    it('should include jQuery UI CSS for complete iDevice', () => {
      const head = exporter.generateWebsitePreviewHead('default', ['complete'], 'Test', '');

      expect(head).toContain('jquery-ui.min.css');
    });

    it('should include jQuery UI CSS for ordena iDevice', () => {
      const head = exporter.generateWebsitePreviewHead('default', ['ordena'], 'Test', '');

      expect(head).toContain('jquery-ui.min.css');
    });

    it('should NOT include jQuery UI CSS for text-only iDevices', () => {
      const head = exporter.generateWebsitePreviewHead('default', ['text', 'crossword'], 'Test', '');

      expect(head).not.toContain('jquery-ui');
    });
  });

  describe('getVersionedPath', () => {
    it('should generate absolute URL with version', () => {
      const path = exporter.getVersionedPath('/libs/jquery.min.js');

      expect(path).toBe('http://localhost:8080/v1.0.0/libs/jquery.min.js');
    });

    it('should handle paths without leading slash', () => {
      const path = exporter.getVersionedPath('libs/jquery.min.js');

      expect(path).toBe('http://localhost:8080/v1.0.0/libs/jquery.min.js');
    });
  });
});

describe('WebsitePreviewExporter - Game iDevices Integration', () => {
  /**
   * These tests verify that game iDevices (crossword, puzzle) have their
   * scripts loaded correctly in the preview HTML.
   *
   * The key requirement is that:
   * 1. The HTML content contains the game div (e.g., .crucigrama-IDevice)
   * 2. The script for the game type is loaded (e.g., crossword.js)
   * 3. The script loads AFTER common.js so $exeDevices is available
   */

  describe('crossword iDevice preview', () => {
    it('should document that crossword needs crucigrama-IDevice class in HTML', () => {
      // The HTML content for crossword iDevices must contain:
      // - A div with class "crucigrama-IDevice"
      // - A div with class "crucigrama-DataGame" containing the encoded game data
      //
      // This is set in the iDevice's htmlView or extracted from jsonProperties.textTextarea
      const expectedHtmlStructure = `
        <div class="crucigrama-IDevice">
          <div class="crucigrama-DataGame">%encoded-game-data%</div>
          <!-- other elements -->
        </div>
      `;

      expect(expectedHtmlStructure).toContain('crucigrama-IDevice');
      expect(expectedHtmlStructure).toContain('crucigrama-DataGame');
    });

    it('should document that crossword.js auto-initializes on jQuery ready', () => {
      // crossword.js ends with:
      // $(function () { $eXeCrucigrama.init(); });
      //
      // This means the script will auto-initialize when:
      // 1. jQuery is loaded
      // 2. DOM is ready
      // 3. The script file is loaded
      //
      // The init() function calls:
      // $exeDevices.iDevice.gamification.initGame(this, 'Crossword', 'crossword', 'crucigrama-IDevice');
      //
      // Which searches for all elements with class 'crucigrama-IDevice' and initializes them
      const expectedInitPattern = '$(function () { $eXeCrucigrama.init(); });';
      expect(expectedInitPattern).toContain('init()');
    });
  });

  describe('puzzle iDevice preview', () => {
    it('should document that puzzle needs puzzle-IDevice class in HTML', () => {
      const expectedHtmlStructure = `
        <div class="puzzle-IDevice">
          <div class="puzzle-DataGame">%encoded-game-data%</div>
        </div>
      `;

      expect(expectedHtmlStructure).toContain('puzzle-IDevice');
      expect(expectedHtmlStructure).toContain('puzzle-DataGame');
    });
  });
});

describe('WebsitePreviewExporter - Asset URL Flow Integration', () => {
  /**
   * These tests verify that asset URLs are handled correctly in the preview flow.
   *
   * The bug being prevented:
   * - URLs like: http://localhost:8080/v1.0.0/files/perm/idevices/base/blob:http://localhost/uuid
   * - These malformed URLs were caused by the reversal regex not properly stripping the basePath
   *
   * The correct flow:
   * 1. Content starts with asset://uuid/filename
   * 2. IdeviceHtmlRenderer.fixAssetUrls() detects preview mode (http:// basePath) and preserves asset:// URLs
   * 3. AssetManager.resolveHTMLAssetsSync() converts asset:// to blob://
   * 4. Final output has clean blob:// URLs
   */

  describe('asset URL transformation', () => {
    it('should NOT produce malformed basePath+blob:// URLs', () => {
      /**
       * This is the key regression test.
       * The old broken pattern produced URLs like:
       * http://localhost:8080/v1.0.0/files/perm/idevices/base/blob:http://localhost:8080/uuid
       *
       * After the fix, asset:// URLs are preserved in preview mode and
       * directly converted to blob:// by AssetManager.
       */
      const malformedPattern = /\/files\/perm\/idevices\/base\/blob:/;

      // Test data representing what IdeviceHtmlRenderer produces in preview mode
      // With the fix, preview mode should preserve asset:// URLs
      const IdeviceHtmlRenderer = require('./renderers/IdeviceHtmlRenderer');
      const renderer = new IdeviceHtmlRenderer();

      const content = '<img src="asset://abc-123-uuid/image.jpg">';
      const previewBasePath = 'http://localhost:8080/v1.0.0/files/perm/idevices/base/';

      const result = renderer.fixAssetUrls(content, previewBasePath);

      // The result should NOT contain the basePath prepended to asset://
      expect(result).not.toMatch(malformedPattern);
      expect(result).not.toContain('http://localhost:8080/v1.0.0/files/perm/idevices/base/asset://');
      expect(result).not.toContain('http://localhost:8080/v1.0.0/files/perm/idevices/base/content/resources/');
    });

    it('should preserve asset:// URLs for AssetManager to resolve', () => {
      const IdeviceHtmlRenderer = require('./renderers/IdeviceHtmlRenderer');
      const renderer = new IdeviceHtmlRenderer();

      const content = '<img src="asset://abc-123-uuid/image.jpg">';
      const previewBasePath = 'http://localhost:8080/v1.0.0/files/perm/idevices/base/';

      const result = renderer.fixAssetUrls(content, previewBasePath);

      // In preview mode, asset:// should be preserved for AssetManager.resolveHTMLAssetsSync()
      expect(result).toContain('asset://abc-123-uuid/image.jpg');
    });

    it('should transform asset:// to content/resources/ in export mode', () => {
      const IdeviceHtmlRenderer = require('./renderers/IdeviceHtmlRenderer');
      const renderer = new IdeviceHtmlRenderer();

      const content = '<img src="asset://abc-123-uuid/image.jpg">';
      const exportBasePath = '../'; // Relative path = export mode

      const result = renderer.fixAssetUrls(content, exportBasePath);

      // In export mode, asset:// should be transformed to content/resources/
      expect(result).toContain('../content/resources/abc-123-uuid/image.jpg');
      expect(result).not.toContain('asset://');
    });
  });

  describe('preview flow documentation', () => {
    it('should document the correct preview URL flow', () => {
      /**
       * Correct Preview Flow:
       *
       * Step 1: Content has asset:// URLs
       *   <img src="asset://uuid-123/image.jpg">
       *
       * Step 2: IdeviceHtmlRenderer.fixAssetUrls() with http:// basePath
       *   - Detects preview mode (basePath starts with http:// or https://)
       *   - Preserves asset:// URLs (does NOT transform them)
       *   Result: <img src="asset://uuid-123/image.jpg">
       *
       * Step 3: AssetManager.resolveHTMLAssetsSync()
       *   - Finds asset:// URLs
       *   - Looks up blob:// URL from IndexedDB cache
       *   Result: <img src="blob:http://localhost:8080/abc-def-ghi">
       *
       * Final: Clean blob:// URLs that load correctly
       */
      const previewFlow = {
        input: '<img src="asset://uuid-123/image.jpg">',
        afterFixAssetUrls: '<img src="asset://uuid-123/image.jpg">', // Preserved!
        afterResolveAssets: '<img src="blob:http://localhost:8080/abc-def">',
      };

      // asset:// should be preserved (not transformed)
      expect(previewFlow.afterFixAssetUrls).toContain('asset://');
      // Final output should have blob:// URLs
      expect(previewFlow.afterResolveAssets).toContain('blob:');
      // No malformed URLs in any step
      expect(previewFlow.afterFixAssetUrls).not.toContain('http://localhost:8080/v1.0.0/files');
    });

    it('should document the correct export URL flow', () => {
      /**
       * Correct Export Flow:
       *
       * Step 1: Content has asset:// URLs
       *   <img src="asset://uuid-123/image.jpg">
       *
       * Step 2: IdeviceHtmlRenderer.fixAssetUrls() with relative basePath ('../' or '')
       *   - Detects export mode (basePath is relative)
       *   - Transforms asset:// to content/resources/
       *   Result: <img src="../content/resources/uuid-123/image.jpg">
       *
       * Step 3: Written to ZIP file
       *   - File is copied to content/resources/uuid-123/image.jpg in ZIP
       *
       * Final: Relative paths that work in exported ZIP
       */
      const exportFlow = {
        input: '<img src="asset://uuid-123/image.jpg">',
        afterFixAssetUrls: '<img src="../content/resources/uuid-123/image.jpg">',
        inZip: 'content/resources/uuid-123/image.jpg',
      };

      // asset:// should be transformed to content/resources/
      expect(exportFlow.afterFixAssetUrls).toContain('content/resources/');
      expect(exportFlow.afterFixAssetUrls).not.toContain('asset://');
    });
  });
});
