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
                            if (this.tagName === 'IMG' || this.tagName === 'SOURCE' || this.tagName === 'VIDEO' || this.tagName === 'AUDIO') {
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
                        if (this.tagName === 'IMG' || this.tagName === 'SOURCE' || this.tagName === 'VIDEO' || this.tagName === 'AUDIO') {
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
                            if (this.tagName === 'IMG' || this.tagName === 'SOURCE' || this.tagName === 'VIDEO' || this.tagName === 'AUDIO') {
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
                        if (this.tagName === 'IMG' || this.tagName === 'SOURCE' || this.tagName === 'VIDEO' || this.tagName === 'AUDIO') {
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
    const mediaElements = ['HTMLImageElement', 'HTMLVideoElement', 'HTMLAudioElement', 'HTMLSourceElement'];

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
                const selector = 'img[src^="asset://"], video[src^="asset://"], audio[src^="asset://"], source[src^="asset://"]';
                const mediaElements = [];

                // Check if the node itself matches
                if (node.matches && node.matches(selector)) {
                    mediaElements.push(node);
                }

                // Check descendants
                if (node.querySelectorAll) {
                    mediaElements.push(...node.querySelectorAll(selector));
                }

                // Resolve each asset:// URL
                mediaElements.forEach((el) => {
                    const assetUrl = el.getAttribute('src');
                    if (!assetUrl) return;

                    // Store the original asset URL as data attribute for reference
                    el.setAttribute('data-asset-url', assetUrl);

                    // Clear the invalid src immediately to prevent error events
                    // Use a transparent 1x1 GIF as placeholder
                    el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

                    // Resolve asynchronously and set the real src
                    resolveAssetUrl(assetUrl).then(resolved => {
                        if (resolved) {
                            el.src = resolved;
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

    console.log('[AssetResolver] Initialized - asset:// URLs will be auto-resolved (with MutationObserver)');
})();
