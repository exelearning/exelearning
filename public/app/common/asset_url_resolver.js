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
     * @returns {Promise<string>} - Blob URL or original URL
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
        return url;
    }

    /**
     * Interceptor for $.fn.attr('src', value)
     */
    $.fn.attr = function(name, value) {
        // Only intercept when setting 'src' with asset://
        if (arguments.length > 1 && name === 'src' && isAssetUrl(value)) {
            const $elements = this;

            // Resolve asynchronously and apply
            resolveAssetUrl(value).then(resolved => {
                $elements.each(function() {
                    if (this.tagName === 'IMG' || this.tagName === 'SOURCE' || this.tagName === 'VIDEO' || this.tagName === 'AUDIO') {
                        originalAttr.call($(this), 'src', resolved);
                    }
                });
            });

            // Return this for chaining
            return this;
        }

        return originalAttr.apply(this, arguments);
    };

    /**
     * Interceptor for $.fn.prop('src', value)
     */
    $.fn.prop = function(name, value) {
        if (arguments.length > 1 && name === 'src' && isAssetUrl(value)) {
            const $elements = this;

            resolveAssetUrl(value).then(resolved => {
                $elements.each(function() {
                    if (this.tagName === 'IMG' || this.tagName === 'SOURCE' || this.tagName === 'VIDEO' || this.tagName === 'AUDIO') {
                        originalProp.call($(this), 'src', resolved);
                    }
                });
            });

            return this;
        }

        return originalProp.apply(this, arguments);
    };

    // Expose functions for direct use if needed
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
        isAssetUrl: isAssetUrl
    };

    console.log('[AssetResolver] Initialized - asset:// URLs will be auto-resolved');
})();
