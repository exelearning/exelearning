/**
 * Global Asset URL Resolver for eXeLearning
 *
 * Intercepts image src assignments that use the asset:// protocol
 * and automatically resolves them to blob URLs via AssetManager.
 *
 * This allows iDevices to work with asset:// URLs without modification.
 *
 * @author eXeLearning Team
 * @license AGPL-3.0
 */
(function() {
    'use strict';

    // Wait for jQuery to be available
    if (!window.jQuery) {
        console.warn('[AssetResolver] jQuery not found, skipping initialization');
        return;
    }

    const $ = window.jQuery;
    const originalAttr = $.fn.attr;
    const originalProp = $.fn.prop;

    // Cache de URLs resueltas para evitar múltiples resoluciones
    const resolvedCache = new Map();
    // Reverse cache: blobUrl → assetUrl
    const blobToAssetCache = new Map();
    // Deduplicate in-flight peer requests for missing assets
    const pendingPeerRequests = new Map();

    /**
     * Get Yjs bridge instance
     * @returns {Object|null}
     */
    function getYjsBridge() {
        return window.eXeLearning?.app?.project?._yjsBridge || null;
    }

    /**
     * Get the AssetManager instance
     * @returns {Object|null} AssetManager or null if not available
     */
    function getAssetManager() {
        return getYjsBridge()?.assetManager || null;
    }

    /**
     * Get the AssetWebSocketHandler instance
     * @returns {Object|null} handler or null if not available
     */
    function getAssetWebSocketHandler() {
        return getYjsBridge()?.assetWebSocketHandler || null;
    }

    /**
     * Check if a URL is an asset:// URL
     * @param {*} url - The URL to check
     * @returns {boolean} True if it's an asset:// URL
     */
    function isAssetUrl(url) {
        return url && typeof url === 'string' && url.startsWith('asset://');
    }

    /**
     * Extract asset ID from an asset:// URL.
     * Supports simplified and legacy/corrupted formats.
     *
     * @param {string} assetUrl
     * @returns {string|null}
     */
    function extractAssetId(assetUrl) {
        if (!isAssetUrl(assetUrl)) return null;
        const match = assetUrl.match(/asset:\/\/(?:asset\/+)?([a-z0-9-]+)/i);
        return match ? match[1] : null;
    }

    /**
     * Extract the filename from an asset:// URL path component.
     * e.g. "asset://uuid/report.docx" → "report.docx"
     * e.g. "asset://uuid.pdf" → null (no path separator, extension-only format)
     *
     * @param {string} assetUrl
     * @returns {string|null}
     */
    function extractFilenameFromAssetUrl(assetUrl) {
        if (!assetUrl) return null;
        const match = assetUrl.match(/asset:\/\/(?:asset\/+)?[a-z0-9-]+(?:\.[a-z0-9]+)?\/(.+)/i);
        if (!match) return null;
        try { return decodeURIComponent(match[1]); } catch { return match[1]; }
    }

    const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif', 'tiff', 'tif']);

    /**
     * Check whether a filename has an image extension.
     *
     * @param {string|undefined} filename
     * @returns {boolean}
     */
    function isImageFilename(filename) {
        if (!filename) return false;
        const ext = filename.toLowerCase().split('.').pop();
        return IMAGE_EXTENSIONS.has(ext);
    }

    /**
     * Request missing asset from peers (deduplicated by assetId).
     * Fire-and-forget: resolver still returns null immediately.
     *
     * @param {string} assetUrl
     */
    function requestMissingAssetFromPeers(assetUrl) {
        const assetId = extractAssetId(assetUrl);
        if (!assetId) return;

        const wsHandler = getAssetWebSocketHandler();
        if (!wsHandler || typeof wsHandler.requestAsset !== 'function') {
            return;
        }

        if (pendingPeerRequests.has(assetId)) {
            return;
        }

        const requestPromise = Promise.resolve()
            .then(() => wsHandler.requestAsset(assetId))
            .catch((err) => {
                console.warn('[AssetResolver] Failed requesting missing asset from peers:', assetId, err);
            })
            .finally(() => {
                pendingPeerRequests.delete(assetId);
            });

        pendingPeerRequests.set(assetId, requestPromise);
    }

    /**
     * Store tracking attributes so AssetManager can update DOM when blob arrives later.
     *
     * @param {Element} element
     * @param {string} assetUrl
     * @param {Object} [options]
     * @param {boolean} [options.loading=true]
     * @returns {string|null} assetId
     */
    function trackElementAsset(element, assetUrl, options = {}) {
        if (!element || typeof element.setAttribute !== 'function' || !isAssetUrl(assetUrl)) {
            return null;
        }

        const { loading = true } = options;
        const assetId = extractAssetId(assetUrl);
        if (!assetId) return null;

        if (element.tagName === 'IFRAME') {
            element.setAttribute('data-asset-src', assetUrl);
            // Keep compatibility with existing consumers expecting data-asset-url.
            element.setAttribute('data-asset-url', assetUrl);
        } else {
            element.setAttribute('data-asset-url', assetUrl);
        }
        element.setAttribute('data-asset-id', assetId);
        if (loading) {
            element.setAttribute('data-asset-loading', 'true');
        }
        return assetId;
    }

    /**
     * Resolve an asset:// URL to a blob URL
     * @param {string} url - URL with format asset://...
     * @returns {Promise<string|null>} - Blob URL or null if can't resolve
     */
    async function resolveAssetUrl(url) {
        if (!isAssetUrl(url)) {
            return url;
        }

        // Return from cache if exists
        if (resolvedCache.has(url)) {
            return resolvedCache.get(url);
        }

        const assetManager = getAssetManager();
        if (assetManager && typeof assetManager.resolveAssetURL === 'function') {
            try {
                const blobUrl = await assetManager.resolveAssetURL(url);
                if (blobUrl) {
                    resolvedCache.set(url, blobUrl);
                    blobToAssetCache.set(blobUrl, url);
                    return blobUrl;
                }
            } catch (e) {
                console.warn('[AssetResolver] Error resolving:', url, e);
            }
        }

        // If not resolved locally, ask peers to provide the blob (deduplicated).
        requestMissingAssetFromPeers(url);

        // Return null instead of invalid asset:// URL to prevent browser errors
        console.warn('[AssetResolver] Could not resolve asset URL:', url);
        return null;
    }

    // List of media element tag names that should have src resolved
    const MEDIA_TAGS = ['IMG', 'SOURCE', 'VIDEO', 'AUDIO', 'IFRAME'];

    /**
     * Interceptor for $.fn.attr('src', value) - handles both forms:
     * - .attr('src', 'asset://...')
     * - .attr({ src: 'asset://...', ... })
     */
    $.fn.attr = function(name, value) {
        // Handle object form: .attr({ src: 'asset://...', ... })
        if (arguments.length === 1 && typeof name === 'object' && name !== null) {
            const attrs = name;
            if (attrs.src && isAssetUrl(attrs.src)) {
                const $elements = this;
                const assetSrc = attrs.src;

                // Set other attributes immediately (excluding src)
                const otherAttrs = { ...attrs };
                delete otherAttrs.src;
                if (Object.keys(otherAttrs).length > 0) {
                    originalAttr.call($elements, otherAttrs);
                }

                // Add tracking attrs so late asset arrivals can patch already-rendered DOM
                $elements.each(function() {
                    if (MEDIA_TAGS.includes(this.tagName)) {
                        trackElementAsset(this, assetSrc, { loading: true });
                    }
                });

                // Resolve src asynchronously
                resolveAssetUrl(assetSrc).then(resolved => {
                    if (resolved) {
                        $elements.each(function() {
                            if (MEDIA_TAGS.includes(this.tagName)) {
                                originalAttr.call($(this), 'src', resolved);
                                if (typeof this.removeAttribute === 'function') {
                                    this.removeAttribute('data-asset-loading');
                                }
                            }
                        });
                    }
                });

                return this;
            }
        }

        // Handle string form: .attr('src', 'asset://...')
        if (arguments.length > 1 && name === 'src' && isAssetUrl(value)) {
            const $elements = this;

            $elements.each(function() {
                if (MEDIA_TAGS.includes(this.tagName)) {
                    trackElementAsset(this, value, { loading: true });
                }
            });

            // Resolve asynchronously and apply
            resolveAssetUrl(value).then(resolved => {
                // Only set src if we got a valid resolved URL (not null)
                if (resolved) {
                    $elements.each(function() {
                        if (MEDIA_TAGS.includes(this.tagName)) {
                            originalAttr.call($(this), 'src', resolved);
                            if (typeof this.removeAttribute === 'function') {
                                this.removeAttribute('data-asset-loading');
                            }
                        }
                    });
                }
                // If resolved is null, don't set src - the asset isn't available yet
            });

            // Return this for chaining
            return this;
        }

        return originalAttr.apply(this, arguments);
    };

    /**
     * Interceptor for $.fn.prop('src', value) - handles both forms:
     * - .prop('src', 'asset://...')
     * - .prop({ src: 'asset://...', ... })
     */
    $.fn.prop = function(name, value) {
        // Handle object form: .prop({ src: 'asset://...', ... })
        if (arguments.length === 1 && typeof name === 'object' && name !== null) {
            const props = name;
            if (props.src && isAssetUrl(props.src)) {
                const $elements = this;
                const assetSrc = props.src;

                // Set other properties immediately (excluding src)
                const otherProps = { ...props };
                delete otherProps.src;
                if (Object.keys(otherProps).length > 0) {
                    originalProp.call($elements, otherProps);
                }

                // Add tracking attrs so late asset arrivals can patch already-rendered DOM
                $elements.each(function() {
                    if (MEDIA_TAGS.includes(this.tagName)) {
                        trackElementAsset(this, assetSrc, { loading: true });
                    }
                });

                // Resolve src asynchronously
                resolveAssetUrl(assetSrc).then(resolved => {
                    if (resolved) {
                        $elements.each(function() {
                            if (MEDIA_TAGS.includes(this.tagName)) {
                                originalProp.call($(this), 'src', resolved);
                                if (typeof this.removeAttribute === 'function') {
                                    this.removeAttribute('data-asset-loading');
                                }
                            }
                        });
                    }
                });

                return this;
            }
        }

        // Handle string form: .prop('src', 'asset://...')
        if (arguments.length > 1 && name === 'src' && isAssetUrl(value)) {
            const $elements = this;

            $elements.each(function() {
                if (MEDIA_TAGS.includes(this.tagName)) {
                    trackElementAsset(this, value, { loading: true });
                }
            });

            resolveAssetUrl(value).then(resolved => {
                // Only set src if we got a valid resolved URL (not null)
                if (resolved) {
                    $elements.each(function() {
                        if (MEDIA_TAGS.includes(this.tagName)) {
                            originalProp.call($(this), 'src', resolved);
                            if (typeof this.removeAttribute === 'function') {
                                this.removeAttribute('data-asset-loading');
                            }
                        }
                    });
                }
                // If resolved is null, don't set src - the asset isn't available yet
            });

            return this;
        }

        return originalProp.apply(this, arguments);
    };

    /**
     * Intercept vanilla JS property assignments: img.src = 'asset://...'
     * This catches libraries like mojomagnify.js that set src directly.
     */
    const mediaElements = ['HTMLImageElement', 'HTMLVideoElement', 'HTMLAudioElement', 'HTMLSourceElement', 'HTMLIFrameElement'];

    mediaElements.forEach(elementType => {
        const ElementClass = window[elementType];
        if (!ElementClass) return;

        const originalDescriptor = Object.getOwnPropertyDescriptor(ElementClass.prototype, 'src');
        if (!originalDescriptor) return;

        Object.defineProperty(ElementClass.prototype, 'src', {
            get: originalDescriptor.get,
            set: function(value) {
                if (isAssetUrl(value)) {
                    const element = this;
                    trackElementAsset(element, value, { loading: true });

                    // Set appropriate placeholder based on element type to prevent browser errors
                    // Videos and audios need empty string (no placeholder), images use transparent GIF
                    const tagName = element.tagName;
                    if (tagName === 'VIDEO' || tagName === 'AUDIO' || tagName === 'SOURCE') {
                        // Don't set a placeholder for video/audio - just wait for resolution
                        // Setting an invalid source would cause NotSupportedError
                    } else if (tagName === 'IFRAME') {
                        originalDescriptor.set.call(element, 'about:blank');
                    } else {
                        // Images and other elements: use transparent 1x1 GIF
                        originalDescriptor.set.call(element, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
                    }

                    // Resolve and set real src
                    resolveAssetUrl(value).then(resolved => {
                        if (resolved) {
                            originalDescriptor.set.call(element, resolved);
                            if (typeof element.removeAttribute === 'function') {
                                element.removeAttribute('data-asset-loading');
                            }
                            // Trigger load on media elements after setting src
                            if (tagName === 'VIDEO' || tagName === 'AUDIO') {
                                element.load();
                            } else if (tagName === 'SOURCE') {
                                const parent = element.parentElement;
                                if (parent && (parent.tagName === 'VIDEO' || parent.tagName === 'AUDIO')) {
                                    parent.load();
                                }
                            }
                        }
                    });
                } else {
                    originalDescriptor.set.call(this, value);
                }
            },
            enumerable: originalDescriptor.enumerable,
            configurable: originalDescriptor.configurable
        });
    });

    function processAddedNode(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // Find all media elements with asset:// src (including the node itself)
        const mediaSelector = 'img[src^="asset://"], video[src^="asset://"], audio[src^="asset://"], source[src^="asset://"], iframe[src^="asset://"]';
        const mediaElementsList = [];

        // Check if the node itself matches
        if (node.matches && node.matches(mediaSelector)) {
            mediaElementsList.push(node);
        }

        // Check descendants
        if (node.querySelectorAll) {
            mediaElementsList.push(...node.querySelectorAll(mediaSelector));
        }

        // Resolve each asset:// URL for media elements
        mediaElementsList.forEach((el) => {
            const assetUrl = el.getAttribute('src');
            if (!assetUrl) return;

            const assetId = trackElementAsset(el, assetUrl, { loading: true });

            // Clear the invalid src immediately to prevent error events
            // Use a transparent 1x1 GIF as placeholder for images, about:blank for iframes
            if (el.tagName === 'IFRAME') {
                el.src = 'about:blank';

                // For iframes, check if it's an HTML file and resolve with relative URLs
                const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
                if (assetManager) {
                    // Extract asset ID from URL
                    if (assetId) {
                        const metadata = assetManager.getAssetMetadata(assetId);
                        if (metadata && assetManager._isHtmlAsset(metadata.mime, metadata.filename)) {
                            // Resolve HTML with all its relative URLs
                            assetManager
                                .resolveHtmlWithAssets(assetId)
                                .then(resolved => {
                                    if (resolved) {
                                        el.src = resolved;
                                        el.removeAttribute('data-asset-loading');
                                        el.removeAttribute('data-asset-id');
                                    } else {
                                        // Fallback to regular resolution
                                        resolveAssetUrl(assetUrl).then(fallback => {
                                            if (fallback) {
                                                el.src = fallback;
                                                el.removeAttribute('data-asset-loading');
                                                el.removeAttribute('data-asset-id');
                                            }
                                        });
                                    }
                                })
                                .catch(() => {
                                    // Fallback on error
                                    resolveAssetUrl(assetUrl).then(fallback => {
                                        if (fallback) {
                                            el.src = fallback;
                                            el.removeAttribute('data-asset-loading');
                                            el.removeAttribute('data-asset-id');
                                        }
                                    });
                                });
                            return; // Early return, already handled
                        }
                    }
                }

                // For non-HTML iframes (PDFs, etc.), use regular resolution
                resolveAssetUrl(assetUrl).then(resolved => {
                    if (resolved) {
                        el.src = resolved;
                        el.removeAttribute('data-asset-loading');
                        el.removeAttribute('data-asset-id');
                    }
                });
            } else if (el.tagName === 'VIDEO' || el.tagName === 'AUDIO' || el.tagName === 'SOURCE') {
                // For video/audio/source elements, remove the invalid src immediately
                // Don't set a placeholder - just clear it and wait for resolution
                el.removeAttribute('src');

                // Resolve asynchronously and set the real src
                resolveAssetUrl(assetUrl).then(resolved => {
                    if (resolved) {
                        el.src = resolved;
                        el.removeAttribute('data-asset-loading');
                        // Trigger load on the media element
                        if (el.tagName === 'VIDEO' || el.tagName === 'AUDIO') {
                            el.load();
                        } else if (el.tagName === 'SOURCE') {
                            const parent = el.parentElement;
                            if (parent && (parent.tagName === 'VIDEO' || parent.tagName === 'AUDIO')) {
                                parent.load();
                            }
                        }
                    }
                });
            } else {
                // Images: use transparent 1x1 GIF as placeholder
                el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

                // Resolve asynchronously and set the real src
                resolveAssetUrl(assetUrl).then(resolved => {
                    if (resolved) {
                        el.src = resolved;
                        el.removeAttribute('data-asset-loading');
                    }
                });
            }
        });

        // Also handle images with asset:// in the 'origin' attribute (used by image-gallery)
        const originSelector = 'img[origin^="asset://"]';
        const originElements = [];

        if (node.matches && node.matches(originSelector)) {
            originElements.push(node);
        }

        if (node.querySelectorAll) {
            originElements.push(...node.querySelectorAll(originSelector));
        }

        // Resolve each asset:// URL for origin attributes
        originElements.forEach((el) => {
            const assetUrl = el.getAttribute('origin');
            if (!assetUrl || !isAssetUrl(assetUrl)) return;

            // Store the original asset URL in a separate data attribute
            el.setAttribute('data-asset-origin', assetUrl);

            // Resolve asynchronously and set the real origin
            resolveAssetUrl(assetUrl).then(resolved => {
                if (resolved) {
                    el.setAttribute('origin', resolved);
                }
            });
        });

        // Also handle anchor elements with asset:// hrefs (for lightbox, etc.)
        const anchorSelector = 'a[href^="asset://"]';
        const anchorElements = [];

        if (node.matches && node.matches(anchorSelector)) {
            anchorElements.push(node);
        }

        if (node.querySelectorAll) {
            anchorElements.push(...node.querySelectorAll(anchorSelector));
        }

        // Resolve each asset:// URL for anchor elements
        anchorElements.forEach((el) => {
            const assetUrl = el.getAttribute('href');
            if (!assetUrl) return;

            // Store the original asset URL as data attribute for reference
            trackElementAsset(el, assetUrl, { loading: true });

            // Don't set a placeholder - keep the asset:// URL in href
            // SimpleLightbox and other libraries need a valid href when they initialize
            // The resolved blob:// URL will be set once available

            // Resolve asynchronously and set the real href
            resolveAssetUrl(assetUrl).then(resolved => {
                if (resolved) {
                    el.setAttribute('href', resolved);
                    el.removeAttribute('data-asset-loading');

                    // Set download attribute for non-image files so the browser
                    // uses the original filename instead of the blob UUID.
                    // Skip images to avoid breaking lightbox galleries.
                    const filename = extractFilenameFromAssetUrl(assetUrl);
                    if (filename && !isImageFilename(filename)) {
                        el.setAttribute('download', filename);
                    }
                }
            });
        });
    }

    /**
     * MutationObserver to automatically resolve asset:// URLs in newly added elements.
     * This handles cases where HTML is inserted directly (e.g., via .html()) rather than
     * through jQuery's .attr() or .prop() methods.
     */
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach(processAddedNode);
        });
    });

    // Start observing once DOM is ready
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    /**
     * Intercept Element.getAttribute('src'/'href'/'origin') to return asset:// URL for persistence.
     * When we resolve asset:// to blob://, we store the original in data-asset-url/data-asset-origin.
     * This interception ensures that code reading these attributes for saving gets the
     * persistent asset:// URL, not the ephemeral blob:// URL.
     */
    const originalGetAttribute = Element.prototype.getAttribute;
    Element.prototype.getAttribute = function(name) {
        const value = originalGetAttribute.call(this, name);

        // For media elements reading 'src', check if we have a stored asset URL
        if (name === 'src' && MEDIA_TAGS.includes(this.tagName)) {
            // If we have an asset URL stored and current value is a blob:// URL
            // return the persistent asset URL instead
            const assetUrl = originalGetAttribute.call(this, 'data-asset-url');
            if (assetUrl && value && value.startsWith('blob:')) {
                return assetUrl;
            }
        }

        // For media elements reading 'origin' (used by image-gallery for full-size image)
        if (name === 'origin' && MEDIA_TAGS.includes(this.tagName)) {
            // If value is a blob:// URL and we have the original asset:// URL stored
            const assetOrigin = originalGetAttribute.call(this, 'data-asset-origin');
            if (assetOrigin && value && value.startsWith('blob:')) {
                return assetOrigin;
            }
        }

        // For anchor elements reading 'href'
        if (name === 'href' && this.tagName === 'A') {
            // If href is still asset://, try to return the resolved blob:// from cache
            // This helps SimpleLightbox and similar libraries get the real URL
            if (value && value.startsWith('asset://') && resolvedCache.has(value)) {
                return resolvedCache.get(value);
            }
            // For persistence: return the original asset:// URL if we have one stored
            const assetUrl = originalGetAttribute.call(this, 'data-asset-url');
            if (assetUrl && value && value.startsWith('blob:')) {
                return assetUrl;
            }
        }

        return value;
    };

    // Expose the resolver globally
    const assetResolverApi = {
        /**
         * Resolve an asset:// URL to blob URL
         * @param {string} url - The asset:// URL
         * @returns {Promise<string>} Resolved blob URL
         */
        resolve: resolveAssetUrl,

        /**
         * Clear the resolution cache
         */
        clearCache: function() {
            resolvedCache.clear();
            blobToAssetCache.clear();
            pendingPeerRequests.clear();
        },

        /**
         * Get cache size
         * @returns {number} Number of cached URLs
         */
        getCacheSize: function() {
            return resolvedCache.size;
        },

        /**
         * Check if a URL is an asset:// URL
         * @param {string} url - URL to check
         * @returns {boolean} True if asset:// URL
         */
        isAssetUrl: isAssetUrl,

        /**
         * Get the asset:// URL that was resolved to a given blob:// URL.
         * e.g. "blob:http://localhost:8080/d3519ead-..." → "asset://2d982eb3-....png"
         *
         * @param {string} blobUrl
         * @returns {string|null} asset:// URL or null if not found
         */
        getAssetUrlFromBlob: function(blobUrl) {
            if (!blobUrl || !blobUrl.startsWith('blob:')) return null;

            // Fast path: blob was resolved through this resolver
            const cached = blobToAssetCache.get(blobUrl);
            if (cached) return cached;

            // Fallback: ask AssetManager (covers blobs resolved by other means)
            const assetManager = getAssetManager();
            if (!assetManager) return null;
            const assetId = assetManager.reverseBlobCache?.get(blobUrl);
            if (!assetId) return null;
            const metadata = assetManager.getAssetMetadata(assetId);
            return metadata?.filename
                ? `asset://${assetId}/${metadata.filename}`
                : `asset://${assetId}`;
        },

        /**
         * Extract the filename from an asset:// URL path component.
         * e.g. "asset://uuid/report.docx" → "report.docx"
         * e.g. "asset://uuid.pdf" → null (no path separator, extension-only format)
         *
         * @param {string} assetUrl
         * @returns {string|null}
         */
        extractFilenameFromAssetUrl: extractFilenameFromAssetUrl,

        /**
         * Extract the filename from a blob:// URL by looking it up in the AssetManager cache.
         * e.g. "blob:http://localhost:8080/2f2738f5-90c8-4dc9-8076-8c06fa6c39c1" → "report.docx"
         *
         * @param {string} blobUrl
         * @returns {string|null} Filename or null if not found
         */
        extractFilenameFromBlob: function(blobUrl) {
            if (!blobUrl || !blobUrl.startsWith('blob:')) return null;
            const assetManager = getAssetManager();
            if (!assetManager) return null;
            const assetId = assetManager.reverseBlobCache?.get(blobUrl);
            if (!assetId) return null;
            return assetManager.getAssetMetadata(assetId)?.filename ?? null;
        },

        /**
         * Stop observing (for cleanup/testing)
         */
        disconnect: function() {
            observer.disconnect();
        },
    };

    // Test hook: allow unit tests to invoke MutationObserver logic without DOM insertion.
    // Only exposed when Vitest has installed its globals.
    if (typeof globalThis.vi !== 'undefined') {
        assetResolverApi.__processAddedNodeForTests = processAddedNode;
    }

    window.eXeLearningAssetResolver = assetResolverApi;

    /**
     * Intercept clicks on HTML asset links in the editor/workarea
     * HTML websites from the Resources folder cannot be navigated - they need to be exported.
     * This handler blocks clicks on anchor elements linking to HTML assets.
     */
    function getHtmlLinkWarningMessage() {
        // Use translation if available
        if (typeof window._ === 'function') {
            return window._('HTML websites from the Resources folder cannot be navigated in preview. Please export the project to view this content correctly.');
        }
        return 'HTML websites from the Resources folder cannot be navigated in preview. Please export the project to view this content correctly.';
    }

    document.addEventListener('click', function(e) {
        const link = e.target.closest('a[href]');
        if (!link) return;

        // Skip links inside TinyMCE editors — the editor handles its own clicks
        if (link.closest('.tox-tinymce, .mce-content-body')) return;

        const href = link.getAttribute('href');
        if (!href) return;

        const dataAssetUrl = link.getAttribute('data-asset-url');

        // Check if it's an HTML asset link by data-asset-url attribute
        const isHtmlLink = dataAssetUrl && /\.html?$/i.test(dataAssetUrl);

        // Block HTML asset link navigation
        if (isHtmlLink) {
            e.preventDefault();
            e.stopPropagation();
            alert(getHtmlLinkWarningMessage());
            return;
        }

        // External links (http/https) and blob URLs (asset files like PDFs):
        // open in new tab to prevent overwriting the editor
        if (/^(https?:\/\/|blob:)/i.test(href)) {
            // Skip links that use lightbox (rel="lightbox", "lightbox[X]", or combined values)
            const rel = link.getAttribute('rel') || '';
            if (/\blightbox(\[[^\]]*\])?\b/i.test(rel)) {
                return;
            }
            // For blob URLs, add download attribute with original filename for non-image assets.
            // This ensures the browser uses the original filename instead of the blob UUID.
            if (href.startsWith('blob:') && !link.hasAttribute('download')) {
                const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
                if (assetManager) {
                    const assetId = assetManager.reverseBlobCache?.get(href);
                    if (assetId) {
                        const metadata = assetManager.getAssetMetadata(assetId);
                        if (metadata?.filename && !isImageFilename(metadata.filename)) {
                            link.setAttribute('download', metadata.filename);
                        }
                    }
                }
            }

            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            return;
        }
    }, true); // Use capture phase to intercept before navigation

    /**
     * Listen for link resolution requests from HTML iframes
     * When a user clicks a relative link inside an HTML iframe, the injected script
     * sends a postMessage to request the parent resolve the linked HTML file.
     */
    window.addEventListener('message', async function(event) {
        if (event.data?.type !== 'exe-resolve-html-link') return;

        const { href, baseFolder } = event.data;
        const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
        if (!assetManager) {
            console.warn('[AssetResolver] Cannot resolve HTML link - assetManager not available');
            return;
        }

        // Find the linked HTML asset by relative path
        const linkedAsset = assetManager.findAssetByRelativePath(baseFolder, href);
        if (!linkedAsset) {
            console.warn('[AssetResolver] Could not find linked asset:', href, 'from baseFolder:', baseFolder);
            return;
        }

        // Resolve the linked HTML with all its internal assets
        const resolvedUrl = await assetManager.resolveHtmlWithAssets(linkedAsset.id);
        if (!resolvedUrl) {
            console.warn('[AssetResolver] Failed to resolve HTML asset:', linkedAsset.id);
            return;
        }

        // Find the iframe that sent the message and update its src
        // event.source is the contentWindow of the iframe
        const iframes = document.querySelectorAll('iframe[data-asset-src], iframe[data-mce-html]');
        for (const iframe of iframes) {
            if (iframe.contentWindow === event.source) {
                iframe.src = resolvedUrl;
                break;
            }
        }
    });

    console.log('[AssetResolver] Initialized - asset:// URLs will be auto-resolved (with MutationObserver)');
})();
