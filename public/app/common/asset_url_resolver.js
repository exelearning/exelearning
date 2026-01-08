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

    /**
     * Get the AssetManager instance
     * @returns {Object|null} AssetManager or null if not available
     */
    function getAssetManager() {
        return window.eXeLearning?.app?.project?._yjsBridge?.assetManager || null;
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
                    return blobUrl;
                }
            } catch (e) {
                console.warn('[AssetResolver] Error resolving:', url, e);
            }
        }
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

                // Resolve src asynchronously
                resolveAssetUrl(assetSrc).then(resolved => {
                    if (resolved) {
                        $elements.each(function() {
                            if (MEDIA_TAGS.includes(this.tagName)) {
                                originalAttr.call($(this), 'src', resolved);
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

            // Resolve asynchronously and apply
            resolveAssetUrl(value).then(resolved => {
                // Only set src if we got a valid resolved URL (not null)
                if (resolved) {
                    $elements.each(function() {
                        if (MEDIA_TAGS.includes(this.tagName)) {
                            originalAttr.call($(this), 'src', resolved);
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

                // Resolve src asynchronously
                resolveAssetUrl(assetSrc).then(resolved => {
                    if (resolved) {
                        $elements.each(function() {
                            if (MEDIA_TAGS.includes(this.tagName)) {
                                originalProp.call($(this), 'src', resolved);
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

            resolveAssetUrl(value).then(resolved => {
                // Only set src if we got a valid resolved URL (not null)
                if (resolved) {
                    $elements.each(function() {
                        if (MEDIA_TAGS.includes(this.tagName)) {
                            originalProp.call($(this), 'src', resolved);
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
                    // Store original for reference
                    element.setAttribute('data-asset-url', value);

                    // Set placeholder immediately to prevent error
                    originalDescriptor.set.call(element, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');

                    // Resolve and set real src
                    resolveAssetUrl(value).then(resolved => {
                        if (resolved) {
                            originalDescriptor.set.call(element, resolved);
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

    /**
     * MutationObserver to automatically resolve asset:// URLs in newly added elements.
     * This handles cases where HTML is inserted directly (e.g., via .html()) rather than
     * through jQuery's .attr() or .prop() methods.
     */
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
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

                    // Store the original asset URL as data attribute for reference
                    if (el.tagName === 'IFRAME') {
                        el.setAttribute('data-asset-src', assetUrl);
                    } else {
                        el.setAttribute('data-asset-url', assetUrl);
                    }

                    // Clear the invalid src immediately to prevent error events
                    // Use a transparent 1x1 GIF as placeholder for images, about:blank for iframes
                    if (el.tagName === 'IFRAME') {
                        el.src = 'about:blank';

                        // For iframes, check if it's an HTML file and resolve with relative URLs
                        const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
                        if (assetManager) {
                            // Extract asset ID from URL
                            const assetIdMatch = assetUrl.match(/asset:\/\/([a-f0-9-]+)/i);
                            if (assetIdMatch) {
                                const assetId = assetIdMatch[1];
                                const metadata = assetManager.getAssetMetadata(assetId);
                                if (metadata && assetManager._isHtmlAsset(metadata.mime, metadata.filename)) {
                                    // Resolve HTML with all its relative URLs
                                    assetManager.resolveHtmlWithAssets(assetId).then(resolved => {
                                        if (resolved) {
                                            el.src = resolved;
                                        } else {
                                            // Fallback to regular resolution
                                            resolveAssetUrl(assetUrl).then(fallback => {
                                                if (fallback) el.src = fallback;
                                            });
                                        }
                                    }).catch(() => {
                                        // Fallback on error
                                        resolveAssetUrl(assetUrl).then(fallback => {
                                            if (fallback) el.src = fallback;
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
                            }
                        });
                    } else {
                        el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

                        // Resolve asynchronously and set the real src
                        resolveAssetUrl(assetUrl).then(resolved => {
                            if (resolved) {
                                el.src = resolved;
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
                    el.setAttribute('data-asset-url', assetUrl);

                    // Don't set a placeholder - keep the asset:// URL in href
                    // SimpleLightbox and other libraries need a valid href when they initialize
                    // The resolved blob:// URL will be set once available

                    // Resolve asynchronously and set the real href
                    resolveAssetUrl(assetUrl).then(resolved => {
                        if (resolved) {
                            el.setAttribute('href', resolved);
                        }
                    });
                });
            });
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
            // If value is a blob:// URL and we have the original asset:// URL stored
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

    // Expose the observer for testing
    window.eXeLearningAssetResolver = {
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
         * Stop observing (for cleanup/testing)
         */
        disconnect: function() {
            observer.disconnect();
        }
    };

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

        const dataAssetUrl = link.getAttribute('data-asset-url');

        // Check if it's an HTML asset link by data-asset-url attribute
        const isHtmlLink = dataAssetUrl && /\.html?$/i.test(dataAssetUrl);

        // Block HTML asset link navigation
        if (isHtmlLink) {
            e.preventDefault();
            e.stopPropagation();
            alert(getHtmlLinkWarningMessage());
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
