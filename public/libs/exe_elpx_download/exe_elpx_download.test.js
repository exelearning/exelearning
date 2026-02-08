/**
 * exe_elpx_download.js Tests
 *
 * Unit tests for the client-side ELPX generator that creates .elpx files
 * on-the-fly from exported HTML sites using a manifest-based approach.
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

        // Mock fflate (no global options — per-file options are inline)
        global.fflate = {
            zip: vi.fn((files, callback) => {
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
                protocol: 'http:',
            },
            writable: true,
            configurable: true,
        });

        // Mock URL.createObjectURL and revokeObjectURL
        global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();

        // Mock alert
        global.alert = vi.fn();

        // Reset downloadElpx and manifest
        delete global.downloadElpx;
        delete window.__ELPX_MANIFEST__;
    });

    afterEach(() => {
        // Restore originals
        global.fflate = originalFflate;
        global.fetch = originalFetch;
        delete global.downloadElpx;
        delete window.__ELPX_MANIFEST__;
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
            expect(scriptContent).toContain('sanitizeFilename');
            expect(scriptContent).toContain('getBasePath');
            expect(scriptContent).toContain('isFileProtocol');
        });
    });

    describe('i18n helper', () => {
        it('has i18n helper function', () => {
            expect(scriptContent).toContain('function i18n(key, fallback)');
        });

        it('reads from $exe_i18n global', () => {
            expect(scriptContent).toContain('$exe_i18n[key]');
        });

        it('falls back when $exe_i18n is unavailable', () => {
            expect(scriptContent).toContain("typeof $exe_i18n !== 'undefined'");
        });
    });

    describe('manifest-based approach', () => {
        it('reads manifest from window.__ELPX_MANIFEST__', () => {
            expect(scriptContent).toContain('window.__ELPX_MANIFEST__');
        });

        it('throws error when manifest is not found', () => {
            expect(scriptContent).toContain('ELPX manifest not found');
        });

        it('uses manifest.basePath for fetching files', () => {
            expect(scriptContent).toContain('manifest.basePath');
        });

        it('uses manifest.files for file list', () => {
            expect(scriptContent).toContain('manifest.files');
        });

        it('uses manifest.projectTitle for filename', () => {
            expect(scriptContent).toContain('manifest.projectTitle');
        });

        it('handles manifest.isPreview for preview mode', () => {
            expect(scriptContent).toContain('manifest.isPreview');
        });
    });

    describe('file:// protocol detection', () => {
        it('has isFileProtocol function', () => {
            expect(scriptContent).toContain('function isFileProtocol()');
        });

        it('checks for file:// protocol', () => {
            expect(scriptContent).toContain("window.location.protocol === 'file:'");
        });

        it('calls folder picker for file:// protocol', () => {
            expect(scriptContent).toContain('downloadElpxViaFolderPicker(options)');
        });
    });

    describe('file:// protocol warning tooltip', () => {
        it('has addFileProtocolWarning function', () => {
            expect(scriptContent).toContain('function addFileProtocolWarning()');
        });

        it('only adds warning in file:// context', () => {
            expect(scriptContent).toContain('if (!isFileProtocol()) return');
        });

        it('targets download-source-file iDevice buttons', () => {
            expect(scriptContent).toContain('.exe-download-package-link a, .exe-download-package-link button');
        });

        it('uses $exe_i18n for file protocol warning translation', () => {
            expect(scriptContent).toContain("i18n('elpxFileProtocolWarning'");
        });

        it('adds native tooltip to entire button', () => {
            expect(scriptContent).toContain('btn.title = warningMessage');
        });

        it('prevents duplicate warnings with data attribute', () => {
            expect(scriptContent).toContain("btn.hasAttribute('data-file-protocol-warning')");
            expect(scriptContent).toContain("btn.setAttribute('data-file-protocol-warning', 'true')");
        });

        it('adds warning icon with emoji', () => {
            expect(scriptContent).toContain("warning.innerHTML = ' ⚠️'");
        });

        it('has CSS class for warning icon', () => {
            expect(scriptContent).toContain("warning.className = 'exe-file-protocol-warning'");
        });

        it('adds Bootstrap tooltip attributes to warning icon', () => {
            expect(scriptContent).toContain("data-bs-toggle', 'tooltip'");
            expect(scriptContent).toContain("data-bs-placement', 'right'");
        });

        it('inserts warning icon after button', () => {
            expect(scriptContent).toContain('btn.parentNode.insertBefore(warning, btn.nextSibling)');
            expect(scriptContent).toContain('btn.parentNode.appendChild(warning)');
        });

        it('initializes Bootstrap tooltip if available', () => {
            expect(scriptContent).toContain("typeof bootstrap !== 'undefined'");
            expect(scriptContent).toContain('new bootstrap.Tooltip(warning)');
        });

        it('is called on DOMContentLoaded', () => {
            expect(scriptContent).toContain("document.addEventListener('DOMContentLoaded', addFileProtocolWarning)");
        });

        it('handles already loaded DOM', () => {
            expect(scriptContent).toContain("document.readyState === 'loading'");
            expect(scriptContent).toContain('setTimeout(addFileProtocolWarning, 100)');
        });
    });

    describe('folder picker (webkitdirectory)', () => {
        it('has downloadElpxViaFolderPicker function', () => {
            expect(scriptContent).toContain('function downloadElpxViaFolderPicker(options)');
        });

        it('creates input with webkitdirectory attribute', () => {
            expect(scriptContent).toContain('input.webkitdirectory = true');
        });

        it('sets input type to file', () => {
            expect(scriptContent).toContain("input.type = 'file'");
        });

        it('enables multiple file selection', () => {
            expect(scriptContent).toContain('input.multiple = true');
        });

        it('opens folder picker immediately without alert', () => {
            // Verify no alert is shown before input.click() (would consume user activation in Chrome)
            expect(scriptContent).toContain('// Open folder picker immediately (no alert - would consume user activation)');
            expect(scriptContent).toContain('input.click()');
        });

        it('strips folder prefix from webkitRelativePath', () => {
            expect(scriptContent).toContain('webkitRelativePath');
            expect(scriptContent).toContain('folderPrefix');
        });

        it('skips hidden files and system files', () => {
            expect(scriptContent).toContain("relativePath.startsWith('.')");
            expect(scriptContent).toContain("relativePath.includes('/.')");
        });

        it('reads files in parallel with Promise.all', () => {
            expect(scriptContent).toContain('var readPromises = fileArray');
            expect(scriptContent).toContain('await Promise.all(readPromises)');
        });

        it('reads files as arrayBuffer', () => {
            expect(scriptContent).toContain('file.arrayBuffer()');
        });

        it('handles cancel event', () => {
            expect(scriptContent).toContain("'cancel'");
        });

        it('cleans up input element after use', () => {
            expect(scriptContent).toContain('document.body.removeChild(input)');
        });

        it('exports downloadElpxViaFolderPicker for testing', () => {
            expect(scriptContent).toContain('downloadElpxViaFolderPicker: downloadElpxViaFolderPicker');
        });

        it('has a timeout mechanism for folder picker dialog', () => {
            expect(scriptContent).toContain('FOLDER_PICKER_TIMEOUT');
        });

        it('provides helpful error when webkitdirectory returns empty files in file:// context', () => {
            expect(scriptContent).toContain("i18n('elpxFolderPickerEmpty'");
            expect(scriptContent).toContain('No files were returned by the folder picker');
        });

        it('cleans up timeout on successful selection or cancel', () => {
            expect(scriptContent).toContain('clearTimeout(timeoutId)');
        });

        it('uses $exe_i18n for timeout error messages', () => {
            expect(scriptContent).toContain("i18n('elpxFolderPickerTimeout'");
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

    describe('preview mode handling', () => {
        it('captures current HTML as index.html in preview mode', () => {
            expect(scriptContent).toContain('document.documentElement.cloneNode(true)');
        });

        it('removes manifest script from captured HTML', () => {
            expect(scriptContent).toContain("'__ELPX_MANIFEST__'");
            expect(scriptContent).toContain('script.remove()');
        });

        it('skips HTML files in preview (already captured)', () => {
            expect(scriptContent).toContain("path === 'index.html'");
            expect(scriptContent).toContain("path.startsWith('html/')");
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
            expect(scriptContent).toContain('/html/');
            expect(scriptContent).toContain("'../'");
        });

        it('returns empty string for root', () => {
            expect(scriptContent).toContain("return ''");
        });
    });

    describe('fetchAllAssets', () => {
        it('limits concurrent requests to 10', () => {
            expect(scriptContent).toContain('var concurrency = 10');
        });

        it('handles failed fetches gracefully', () => {
            expect(scriptContent).toContain("[ELPX Download] Failed to fetch:");
            expect(scriptContent).toContain('return null');
        });

        it('tracks progress', () => {
            expect(scriptContent).toContain('updateProgress(completed, total)');
        });

        it('uses a sliding worker pool pattern', () => {
            expect(scriptContent).toContain('async function fetchWorker()');
            expect(scriptContent).toContain('Math.min(concurrency, fileEntries.length)');
        });
    });

    describe('createZipAndDownload', () => {
        it('uses per-file compression: STORE for compressed formats, level 6 for others', () => {
            expect(scriptContent).toContain('STORE_EXTENSIONS');
            expect(scriptContent).toContain('{ level: 0 }');
            expect(scriptContent).toContain('{ level: 6 }');
            expect(scriptContent).toContain('fflate.zip(zipInput,');
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
        it('uses TextEncoder', () => {
            expect(scriptContent).toContain('TextEncoder');
            expect(scriptContent).toContain('.encode(str)');
        });
    });

    describe('showLoadingIndicator', () => {
        it('targets download-source-file iDevice buttons', () => {
            expect(scriptContent).toContain('.exe-download-package-link');
        });

        it('stores original text', () => {
            expect(scriptContent).toContain('data-original-text');
        });

        it('shows generating message via i18n', () => {
            expect(scriptContent).toContain("i18n('elpxGenerating', 'Generating...')");
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
    });

    describe('full workflow execution', () => {
        it('executes downloadElpx function successfully with manifest', async () => {
            // Setup DOM for loading indicator
            document.body.innerHTML = `
        <p class="exe-download-package-link">
          <a href="#">Download</a>
        </p>
      `;

            // Setup manifest
            window.__ELPX_MANIFEST__ = {
                version: 1,
                files: ['content.xml', 'libs/jquery.js', 'theme/content.css'],
                projectTitle: 'Test Project',
                basePath: '',
            };

            // Mock successful file fetches
            global.fetch.mockResolvedValue({
                ok: true,
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
            });

            // Execute script
            // eslint-disable-next-line no-eval
            eval(scriptContent);

            // Call downloadElpx
            await window.downloadElpx();

            // Verify fetch was called for manifest files
            expect(global.fetch).toHaveBeenCalled();

            // Verify fflate.zip was called
            expect(global.fflate.zip).toHaveBeenCalled();

            // Verify blob URL was created
            expect(global.URL.createObjectURL).toHaveBeenCalled();
        });

        it('shows alert when manifest is missing', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Execute script (no manifest set)
            // eslint-disable-next-line no-eval
            eval(scriptContent);

            // Call downloadElpx - should show alert
            await window.downloadElpx();

            // Verify alert was called
            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('ELPX manifest not found'));

            consoleSpy.mockRestore();
        });

        it('accepts options with custom filename', async () => {
            document.body.innerHTML = `<p class="exe-download-package-link"><a href="#">Download</a></p>`;

            window.__ELPX_MANIFEST__ = {
                version: 1,
                files: ['content.xml'],
                projectTitle: 'Default Name',
                basePath: '',
            };

            global.fetch.mockResolvedValue({
                ok: true,
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
            });

            // eslint-disable-next-line no-eval
            eval(scriptContent);

            await window.downloadElpx({ filename: 'custom-name' });

            // The filename option should be used
            expect(global.fflate.zip).toHaveBeenCalled();
        });

        it('uses folder picker for file:// protocol', async () => {
            // Simulate file:// protocol
            Object.defineProperty(window, 'location', {
                value: {
                    pathname: '/index.html',
                    href: 'file:///path/to/index.html',
                    protocol: 'file:',
                },
                writable: true,
                configurable: true,
            });

            window.__ELPX_MANIFEST__ = {
                version: 1,
                files: ['content.xml'],
                projectTitle: 'Test',
                basePath: '',
            };

            // Mock createElement to capture the input element
            const originalCreateElement = document.createElement.bind(document);
            let folderInput = null;
            vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                const el = originalCreateElement(tag);
                if (tag === 'input') {
                    folderInput = el;
                    // Mock click to prevent actual file dialog
                    el.click = vi.fn();
                }
                return el;
            });

            // eslint-disable-next-line no-eval
            eval(scriptContent);

            // Start downloadElpx (won't complete because we mock the click)
            const downloadPromise = window.downloadElpx();

            // Wait a tick for the promise to set up
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Verify NO alert was shown (removed to fix Chrome user activation issue)
            expect(global.alert).not.toHaveBeenCalled();

            // Verify input element was created with webkitdirectory
            expect(folderInput).not.toBeNull();
            expect(folderInput.webkitdirectory).toBe(true);
            expect(folderInput.type).toBe('file');

            // Verify fetch was NOT called (folder picker is used instead)
            expect(global.fetch).not.toHaveBeenCalled();

            // Simulate cancel to resolve the promise
            if (folderInput) {
                folderInput.dispatchEvent(new Event('cancel'));
            }

            await downloadPromise;
        });
    });
});
