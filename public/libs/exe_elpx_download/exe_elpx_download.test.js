/**
 * exe_elpx_download.js Tests
 *
 * Unit tests for the client-side ELPX generator that creates .elpx files
 * on-the-fly from exported HTML sites.
 *
 * This library is included in exports when the download-source-file iDevice is present.
 *
 * Run with: make test-frontend
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('exe_elpx_download', () => {
  let scriptContent;
  let originalFflate;
  let originalFetch;

  beforeAll(() => {
    // Read the script content
    const scriptPath = join(__dirname, 'exe_elpx_download.js');
    scriptContent = readFileSync(scriptPath, 'utf-8');
  });

  beforeEach(() => {
    // Store originals
    originalFflate = global.fflate;
    originalFetch = global.fetch;

    // Mock fflate
    global.fflate = {
      zip: vi.fn((files, options, callback) => {
        const mockZipData = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // ZIP magic bytes
        setTimeout(() => callback(null, mockZipData), 0);
      }),
    };

    // Mock fetch
    global.fetch = vi.fn();

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/index.html',
        href: 'http://localhost/index.html',
      },
      writable: true,
      configurable: true,
    });

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock alert
    global.alert = vi.fn();

    // Reset downloadElpx
    delete global.downloadElpx;
  });

  afterEach(() => {
    // Restore originals
    global.fflate = originalFflate;
    global.fetch = originalFetch;
    delete global.downloadElpx;
    vi.clearAllMocks();
  });

  describe('script structure', () => {
    it('is wrapped in an IIFE', () => {
      expect(scriptContent).toContain('(function (global)');
      expect(scriptContent).toMatch(/\}\)\(typeof window/);
    });

    it('uses strict mode', () => {
      expect(scriptContent).toContain("'use strict'");
    });

    it('checks for fflate availability', () => {
      expect(scriptContent).toContain("typeof fflate === 'undefined'");
    });

    it('exposes downloadElpx globally', () => {
      expect(scriptContent).toContain('global.downloadElpx = downloadElpx');
    });

    it('exports helper functions for CommonJS', () => {
      expect(scriptContent).toContain('module.exports');
      expect(scriptContent).toContain('fetchContentXml');
      expect(scriptContent).toContain('extractProjectName');
      expect(scriptContent).toContain('discoverAssets');
      expect(scriptContent).toContain('sanitizeFilename');
    });
  });

  describe('downloadElpx function', () => {
    it('is exposed on window after script execution', () => {
      // eslint-disable-next-line no-eval
      eval(scriptContent);
      expect(typeof window.downloadElpx).toBe('function');
    });

    it('is not defined when fflate is unavailable', () => {
      // Remove fflate and re-execute script
      delete global.fflate;
      delete global.downloadElpx;

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Re-execute script
      // eslint-disable-next-line no-eval
      eval(scriptContent);

      // downloadElpx should not be defined
      expect(global.downloadElpx).toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe('extractProjectName logic', () => {
    it('extracts title from ODE format in script', () => {
      // Verify the regex pattern exists (note: script has escaped slashes)
      expect(scriptContent).toContain('pp_title');
      expect(scriptContent).toContain('<value>([^<]*)');
    });

    it('has fallback for older XML format', () => {
      // The script has escaped slashes in the regex
      expect(scriptContent).toContain('<pp_title>([^<]*)');
    });

    it('returns default name as fallback', () => {
      expect(scriptContent).toContain("'eXeLearning-project'");
    });
  });

  describe('sanitizeFilename logic', () => {
    it('handles null/empty input', () => {
      expect(scriptContent).toContain("if (!str) return 'eXeLearning-project'");
    });

    it('removes invalid filename characters', () => {
      // Check for character replacement pattern
      expect(scriptContent).toContain('[<>:"/\\\\|?*]');
    });

    it('normalizes whitespace', () => {
      expect(scriptContent).toContain('\\s+');
    });

    it('truncates to 100 characters', () => {
      expect(scriptContent).toContain('.substring(0, 100)');
    });

    it('decodes HTML entities', () => {
      expect(scriptContent).toContain('textContent');
      expect(scriptContent).toContain('innerText');
    });
  });

  describe('getBasePath logic', () => {
    it('detects html subdirectory', () => {
      expect(scriptContent).toContain("/html/");
      expect(scriptContent).toContain("'../'");
    });

    it('returns empty string for root', () => {
      expect(scriptContent).toContain("return ''");
    });
  });

  describe('extractAssetsFromXml patterns', () => {
    it('handles {{context_path}} assets', () => {
      expect(scriptContent).toContain('{{context_path}}');
      expect(scriptContent).toContain('contextPathPattern');
    });

    it('handles asset:// protocol', () => {
      expect(scriptContent).toContain('asset://');
      expect(scriptContent).toContain('assetProtocolPattern');
    });

    it('handles direct resources paths', () => {
      expect(scriptContent).toContain('resourcesPattern');
      expect(scriptContent).toContain('resources/');
    });

    it('uses content/resources/ prefix', () => {
      expect(scriptContent).toContain("'content/resources/'");
    });
  });

  describe('extractAssetsFromDOM patterns', () => {
    it('extracts from img elements', () => {
      expect(scriptContent).toContain("img[src]");
    });

    it('extracts from link elements', () => {
      expect(scriptContent).toContain('link[rel="stylesheet"][href]');
    });

    it('extracts from script elements', () => {
      expect(scriptContent).toContain("script[src]");
    });

    it('extracts from audio/video sources', () => {
      expect(scriptContent).toContain('audio source[src]');
      expect(scriptContent).toContain('video source[src]');
      expect(scriptContent).toContain('audio[src]');
      expect(scriptContent).toContain('video[src]');
    });

    it('extracts from object/embed', () => {
      expect(scriptContent).toContain('object[data]');
      expect(scriptContent).toContain('embed[src]');
    });

    it('extracts background images from inline styles', () => {
      expect(scriptContent).toContain('[style*="background"]');
      expect(scriptContent).toContain("url\\(['\"");
    });
  });

  describe('addAssetFromSrc filtering', () => {
    it('skips external URLs', () => {
      expect(scriptContent).toContain("src.indexOf('http://') === 0");
      expect(scriptContent).toContain("src.indexOf('https://') === 0");
    });

    it('skips data URLs', () => {
      expect(scriptContent).toContain("src.indexOf('data:') === 0");
    });

    it('skips blob URLs', () => {
      expect(scriptContent).toContain("src.indexOf('blob:') === 0");
    });

    it('skips anchors', () => {
      expect(scriptContent).toContain("src.indexOf('#') === 0");
    });

    it('skips javascript URLs', () => {
      expect(scriptContent).toContain("src.indexOf('javascript:') === 0");
    });
  });

  describe('fetchAllAssets', () => {
    it('limits concurrent requests to 6', () => {
      expect(scriptContent).toContain('var concurrency = 6');
    });

    it('handles failed fetches gracefully', () => {
      expect(scriptContent).toContain("console.warn('[ELPX Download] Failed to fetch:");
      expect(scriptContent).toContain('return null');
    });

    it('tracks progress', () => {
      expect(scriptContent).toContain('updateProgress(completed, total)');
    });

    it('processes in batches', () => {
      expect(scriptContent).toContain('entries.slice(i, i + concurrency)');
    });
  });

  describe('createZipAndDownload', () => {
    it('uses fflate.zip with compression level 6', () => {
      expect(scriptContent).toContain('fflate.zip(files, { level: 6 }');
    });

    it('creates blob with application/zip type', () => {
      expect(scriptContent).toContain("type: 'application/zip'");
    });

    it('triggers download with .elpx extension', () => {
      expect(scriptContent).toContain("projectName + '.elpx'");
    });

    it('uses download attribute', () => {
      expect(scriptContent).toContain('a.download =');
    });

    it('cleans up blob URL after download', () => {
      expect(scriptContent).toContain('URL.revokeObjectURL');
      expect(scriptContent).toContain('setTimeout');
    });
  });

  describe('stringToUint8Array', () => {
    it('uses TextEncoder when available', () => {
      expect(scriptContent).toContain('TextEncoder');
      expect(scriptContent).toContain('.encode(str)');
    });

    it('has fallback for older browsers', () => {
      expect(scriptContent).toContain('unescape(encodeURIComponent(str))');
    });
  });

  describe('showLoadingIndicator', () => {
    it('targets download-source-file iDevice buttons', () => {
      expect(scriptContent).toContain('.exe-download-package-link');
    });

    it('stores original text', () => {
      expect(scriptContent).toContain('data-original-text');
    });

    it('shows generating message', () => {
      expect(scriptContent).toContain("'Generating...'");
    });

    it('disables button during generation', () => {
      expect(scriptContent).toContain("style.opacity = '0.7'");
      expect(scriptContent).toContain("style.pointerEvents = 'none'");
    });

    it('restores original state', () => {
      expect(scriptContent).toContain("btn.getAttribute('data-original-text')");
    });
  });

  describe('updateProgress', () => {
    it('supports debug mode', () => {
      expect(scriptContent).toContain('window.__ELPX_DEBUG__');
    });

    it('logs progress in debug mode', () => {
      // Note: there's a space after the colon in the actual script
      expect(scriptContent).toContain('[ELPX Download] Progress:');
    });
  });

  describe('error handling', () => {
    it('shows alert on error', () => {
      expect(scriptContent).toContain("alert('Error generating ELPX file:");
    });

    it('logs errors to console', () => {
      expect(scriptContent).toContain("console.error('[ELPX Download] Error:'");
    });

    it('hides loading indicator on error', () => {
      expect(scriptContent).toContain('showLoadingIndicator(false)');
    });

    it('handles missing content.xml', () => {
      expect(scriptContent).toContain('Could not fetch content.xml');
    });
  });

  describe('fetchContentXml', () => {
    it('fetches from calculated base path', () => {
      expect(scriptContent).toContain("basePath + 'content.xml'");
    });

    it('handles HTTP errors', () => {
      expect(scriptContent).toContain("'HTTP ' + response.status");
    });

    it('returns null on failure', () => {
      expect(scriptContent).toContain('return null');
    });
  });

  describe('integration requirements', () => {
    it('depends on fflate library', () => {
      expect(scriptContent).toContain('fflate.zip');
    });

    it('handles download-source-file iDevice class', () => {
      expect(scriptContent).toContain('.exe-download-package-link');
    });

    it('creates proper ELPX structure with content.xml', () => {
      expect(scriptContent).toContain("files['content.xml']");
    });
  });

  describe('full workflow execution', () => {
    it('executes downloadElpx function successfully', async () => {
      // Setup DOM for loading indicator
      document.body.innerHTML = `
        <p class="exe-download-package-link">
          <a href="#">Download</a>
        </p>
      `;

      // Mock successful content.xml fetch
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(`
            <ode>
              <key>pp_title</key>
              <value>Test Project</value>
            </ode>
          `),
        })
        // Mock asset fetches
        .mockResolvedValue({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
        });

      // Execute script
      // eslint-disable-next-line no-eval
      eval(scriptContent);

      // Call downloadElpx
      await window.downloadElpx();

      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalled();

      // Verify fflate.zip was called
      expect(global.fflate.zip).toHaveBeenCalled();

      // Verify blob URL was created
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('handles content.xml fetch failure', async () => {
      // Mock failed content.xml fetch
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Execute script
      // eslint-disable-next-line no-eval
      eval(scriptContent);

      // Call downloadElpx - should show alert
      await window.downloadElpx();

      // Verify alert was called
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Error generating ELPX'));

      consoleSpy.mockRestore();
    });

    it('accepts options with custom filename', async () => {
      document.body.innerHTML = `<p class="exe-download-package-link"><a href="#">Download</a></p>`;

      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<ode></ode>'),
      });

      // eslint-disable-next-line no-eval
      eval(scriptContent);

      await window.downloadElpx({ filename: 'custom-name' });

      // The filename option should be used
      expect(global.fflate.zip).toHaveBeenCalled();
    });
  });
});
