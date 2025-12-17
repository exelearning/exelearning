/**
 * Client-side ELPX Generator for eXeLearning exports
 *
 * Generates .elpx files on-the-fly by:
 * 1. Reading content.xml from the exported site
 * 2. Dynamically discovering all assets from DOM and content.xml
 * 3. Creating a ZIP file using fflate
 * 4. Triggering the download
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning team (http://exelearning.net/)
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
(function (global) {
    'use strict';

    // Check if fflate is available
    if (typeof fflate === 'undefined') {
        console.error('[ELPX Download] fflate library is not loaded');
        return;
    }

    /**
     * Main download function - generates and downloads .elpx
     * @param {Object} options - Optional configuration
     * @param {string} options.filename - Override filename (without extension)
     * @returns {Promise<void>}
     */
    async function downloadElpx(options) {
        options = options || {};

        try {
            // Show loading indicator if available
            showLoadingIndicator(true);

            // 1. Fetch content.xml
            var contentXml = await fetchContentXml();
            if (!contentXml) {
                throw new Error('Could not fetch content.xml');
            }

            // 2. Extract project name from XML
            var projectName = options.filename || extractProjectName(contentXml);

            // 3. Discover all assets from DOM and content.xml
            var assets = discoverAssets(contentXml);

            // 4. Fetch all assets in parallel (with progress tracking)
            var files = await fetchAllAssets(assets);

            // 5. Add content.xml to files
            files['content.xml'] = stringToUint8Array(contentXml);

            // 6. Create ZIP and trigger download
            await createZipAndDownload(files, projectName);

            showLoadingIndicator(false);
        } catch (error) {
            showLoadingIndicator(false);
            console.error('[ELPX Download] Error:', error);
            alert('Error generating ELPX file: ' + error.message);
        }
    }

    /**
     * Fetch content.xml from the exported site
     * @returns {Promise<string|null>}
     */
    async function fetchContentXml() {
        // Try to fetch from current location (handles subdirectory exports)
        var basePath = getBasePath();
        var url = basePath + 'content.xml';

        try {
            var response = await fetch(url);
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return await response.text();
        } catch (e) {
            console.error('[ELPX Download] Failed to fetch content.xml from ' + url, e);
            return null;
        }
    }

    /**
     * Get base path for asset URLs
     * @returns {string}
     */
    function getBasePath() {
        // Check if we're in index.html (root) or html/ subdirectory
        var path = window.location.pathname;
        if (path.indexOf('/html/') >= 0) {
            return '../';
        }
        return '';
    }

    /**
     * Extract project name from content.xml
     * @param {string} xml - Content XML string
     * @returns {string}
     */
    function extractProjectName(xml) {
        // Try to extract pp_title from ODE format
        var titleMatch = xml.match(/<key>pp_title<\/key>\s*<value>([^<]*)<\/value>/);
        if (titleMatch && titleMatch[1]) {
            return sanitizeFilename(titleMatch[1]);
        }

        // Fallback: try older format
        titleMatch = xml.match(/<pp_title>([^<]*)<\/pp_title>/);
        if (titleMatch && titleMatch[1]) {
            return sanitizeFilename(titleMatch[1]);
        }

        return 'eXeLearning-project';
    }

    /**
     * Sanitize string for use as filename
     * @param {string} str - String to sanitize
     * @returns {string}
     */
    function sanitizeFilename(str) {
        if (!str) return 'eXeLearning-project';

        // Decode HTML entities
        var temp = document.createElement('div');
        temp.innerHTML = str;
        str = temp.textContent || temp.innerText || str;

        // Remove or replace invalid characters
        return str
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 100);
    }

    /**
     * Discover all assets from DOM and content.xml
     * @param {string} xml - Content XML string
     * @returns {Object} - Map of zipPath -> url
     */
    function discoverAssets(xml) {
        var assets = {};
        var basePath = getBasePath();

        // 1. Get assets from DOM
        extractAssetsFromDOM(assets, basePath);

        // 2. Get assets from content.xml
        extractAssetsFromXml(xml, assets, basePath);

        return assets;
    }

    /**
     * Extract assets from DOM elements
     * @param {Object} assets - Assets map to populate
     * @param {string} basePath - Base path prefix
     */
    function extractAssetsFromDOM(assets, basePath) {
        // Images
        document.querySelectorAll('img[src]').forEach(function (el) {
            addAssetFromSrc(assets, el.getAttribute('src'), basePath);
        });

        // Stylesheets
        document.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (el) {
            addAssetFromSrc(assets, el.getAttribute('href'), basePath);
        });

        // Scripts
        document.querySelectorAll('script[src]').forEach(function (el) {
            addAssetFromSrc(assets, el.getAttribute('src'), basePath);
        });

        // Audio/Video sources
        document.querySelectorAll('audio source[src], video source[src]').forEach(function (el) {
            addAssetFromSrc(assets, el.getAttribute('src'), basePath);
        });

        // Audio/Video direct src
        document.querySelectorAll('audio[src], video[src]').forEach(function (el) {
            addAssetFromSrc(assets, el.getAttribute('src'), basePath);
        });

        // Object/embed
        document.querySelectorAll('object[data], embed[src]').forEach(function (el) {
            addAssetFromSrc(assets, el.getAttribute('data') || el.getAttribute('src'), basePath);
        });

        // Background images in inline styles
        document.querySelectorAll('[style*="background"]').forEach(function (el) {
            var style = el.getAttribute('style');
            var matches = style.match(/url\(['"]?([^'")\s]+)['"]?\)/g);
            if (matches) {
                matches.forEach(function (m) {
                    var url = m.replace(/url\(['"]?([^'")\s]+)['"]?\)/, '$1');
                    addAssetFromSrc(assets, url, basePath);
                });
            }
        });
    }

    /**
     * Add an asset from a src attribute
     * @param {Object} assets - Assets map
     * @param {string} src - Source URL
     * @param {string} basePath - Base path prefix
     */
    function addAssetFromSrc(assets, src, basePath) {
        if (!src) return;

        // Skip external URLs
        if (src.indexOf('http://') === 0 || src.indexOf('https://') === 0) return;
        // Skip data URLs
        if (src.indexOf('data:') === 0) return;
        // Skip blob URLs
        if (src.indexOf('blob:') === 0) return;
        // Skip anchors
        if (src.indexOf('#') === 0) return;
        // Skip javascript
        if (src.indexOf('javascript:') === 0) return;

        // Normalize path
        var normalizedSrc = src;
        if (basePath && src.indexOf(basePath) === 0) {
            normalizedSrc = src.substring(basePath.length);
        }

        // Store in assets map (zipPath -> fetchUrl)
        var fetchUrl = basePath + normalizedSrc;
        assets[normalizedSrc] = fetchUrl;
    }

    /**
     * Extract assets from content.xml
     * @param {string} xml - Content XML string
     * @param {Object} assets - Assets map to populate
     * @param {string} basePath - Base path prefix
     */
    function extractAssetsFromXml(xml, assets, basePath) {
        // Match {{context_path}}/ID/file patterns
        var contextPathPattern = /\{\{context_path\}\}\/([^"'\s<>]+)/g;
        var match;
        while ((match = contextPathPattern.exec(xml)) !== null) {
            var assetPath = 'content/resources/' + match[1];
            assets[assetPath] = basePath + assetPath;
        }

        // Match asset://uuid/file patterns
        var assetProtocolPattern = /asset:\/\/([^"'\s<>]+)/g;
        while ((match = assetProtocolPattern.exec(xml)) !== null) {
            var assetPath2 = 'content/resources/' + match[1];
            assets[assetPath2] = basePath + assetPath2;
        }

        // Match direct resource paths: src="resources/..."
        var resourcesPattern = /(?:src|href)=["']resources\/([^"']+)["']/g;
        while ((match = resourcesPattern.exec(xml)) !== null) {
            var assetPath3 = 'content/resources/' + match[1];
            assets[assetPath3] = basePath + assetPath3;
        }
    }

    /**
     * Fetch all assets in parallel
     * @param {Object} assets - Map of zipPath -> url
     * @returns {Promise<Object>} - Map of zipPath -> Uint8Array
     */
    async function fetchAllAssets(assets) {
        var files = {};
        var entries = Object.entries(assets);
        var total = entries.length;
        var completed = 0;

        // Limit concurrent requests
        var concurrency = 6;
        var results = [];

        for (var i = 0; i < entries.length; i += concurrency) {
            var batch = entries.slice(i, i + concurrency);
            var batchResults = await Promise.all(
                batch.map(async function (entry) {
                    var zipPath = entry[0];
                    var url = entry[1];

                    try {
                        var response = await fetch(url);
                        if (!response.ok) {
                            console.warn('[ELPX Download] Failed to fetch: ' + url + ' (' + response.status + ')');
                            return null;
                        }
                        var buffer = await response.arrayBuffer();
                        completed++;
                        updateProgress(completed, total);
                        return { path: zipPath, data: new Uint8Array(buffer) };
                    } catch (e) {
                        console.warn('[ELPX Download] Error fetching: ' + url, e);
                        completed++;
                        updateProgress(completed, total);
                        return null;
                    }
                })
            );

            batchResults.forEach(function (result) {
                if (result) {
                    files[result.path] = result.data;
                }
            });
        }

        return files;
    }

    /**
     * Create ZIP and trigger download
     * @param {Object} files - Map of path -> Uint8Array
     * @param {string} projectName - Project name for filename
     */
    async function createZipAndDownload(files, projectName) {
        return new Promise(function (resolve, reject) {
            try {
                // Use fflate.zip for async compression
                fflate.zip(files, { level: 6 }, function (err, data) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Create blob and download
                    var blob = new Blob([data], { type: 'application/zip' });
                    var url = URL.createObjectURL(blob);

                    var a = document.createElement('a');
                    a.href = url;
                    a.download = projectName + '.elpx';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    // Clean up
                    setTimeout(function () {
                        URL.revokeObjectURL(url);
                    }, 1000);

                    resolve();
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Convert string to Uint8Array (UTF-8)
     * @param {string} str - String to convert
     * @returns {Uint8Array}
     */
    function stringToUint8Array(str) {
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(str);
        }
        // Fallback for older browsers
        var utf8 = unescape(encodeURIComponent(str));
        var arr = new Uint8Array(utf8.length);
        for (var i = 0; i < utf8.length; i++) {
            arr[i] = utf8.charCodeAt(i);
        }
        return arr;
    }

    /**
     * Show/hide loading indicator
     * @param {boolean} show - Whether to show the indicator
     */
    function showLoadingIndicator(show) {
        // Try to find existing button and update its state
        var buttons = document.querySelectorAll('.exe-download-package-link a, .exe-download-package-link button');
        buttons.forEach(function (btn) {
            if (show) {
                btn.setAttribute('data-original-text', btn.textContent);
                btn.textContent = 'Generating...';
                btn.style.opacity = '0.7';
                btn.style.pointerEvents = 'none';
            } else {
                var original = btn.getAttribute('data-original-text');
                if (original) {
                    btn.textContent = original;
                }
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
            }
        });
    }

    /**
     * Update progress (optional UI feedback)
     * @param {number} completed - Number of completed items
     * @param {number} total - Total number of items
     */
    function updateProgress(completed, total) {
        // Optional: Could update a progress bar here
        // For now, just log to console in debug mode
        if (window.__ELPX_DEBUG__) {
            console.log('[ELPX Download] Progress: ' + completed + '/' + total);
        }
    }

    // Expose to global scope
    global.downloadElpx = downloadElpx;

    // Also expose helper functions for testing
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            downloadElpx: downloadElpx,
            fetchContentXml: fetchContentXml,
            extractProjectName: extractProjectName,
            discoverAssets: discoverAssets,
            extractAssetsFromDOM: extractAssetsFromDOM,
            extractAssetsFromXml: extractAssetsFromXml,
            sanitizeFilename: sanitizeFilename,
        };
    }
})(typeof window !== 'undefined' ? window : this);
