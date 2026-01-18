/**
 * LinkValidationAdapter
 *
 * Client-side link validation adapter for static/offline mode.
 * Extracts links from HTML content and validates them where possible.
 *
 * This adapter ports the server-side link-validator.ts logic to run in the browser,
 * allowing link validation to work without a backend server.
 */

export default class LinkValidationAdapter {
    /**
     * Extract links from idevices HTML content (client-side)
     * Port of src/services/link-validator.ts extractLinksFromIdevices()
     *
     * @param {Object} params - Parameters containing idevices array
     * @param {Array<{html: string, pageName?: string, blockName?: string, ideviceType?: string, order?: number}>} params.idevices
     * @returns {Object} Response with extracted links
     */
    extractLinks(params) {
        const { idevices = [] } = params;
        const allLinks = [];

        for (const idevice of idevices) {
            if (!idevice.html) continue;

            // Extract raw links from HTML
            let links = this._extractLinksFromHtml(idevice.html);

            // Clean and count duplicates
            links = this._cleanAndCountLinks(links);

            // Remove invalid/non-validatable links
            links = this._removeInvalidLinks(links);

            // Deduplicate keeping highest count
            links = this._deduplicateLinks(links);

            // Filter to only validatable links and add metadata
            for (const link of links) {
                if (this._shouldValidateLink(link.url)) {
                    allLinks.push({
                        id: this._generateUUID(),
                        url: link.url,
                        count: link.count,
                        pageName: idevice.pageName || '',
                        blockName: idevice.blockName || '',
                        ideviceType: idevice.ideviceType || '',
                        order: String(idevice.order ?? ''),
                    });
                }
            }
        }

        return {
            responseMessage: 'OK',
            links: allLinks,
            totalLinks: allLinks.length,
        };
    }

    /**
     * Get validation stream URL - returns null for client-side validation
     * Returning null signals to LinkValidationManager that it should use client-side validation
     *
     * @returns {null}
     */
    getValidationStreamUrl() {
        return null;
    }

    /**
     * Validate a single link (called by LinkValidationManager for client-side validation)
     *
     * @param {string} url - The URL to validate
     * @returns {Promise<{status: 'valid'|'broken', error: string|null}>}
     */
    async validateLink(url) {
        // Skip non-validatable URLs (internal links like exe-node:, asset://, files/)
        if (!this._shouldValidateLinkStrict(url)) {
            return { status: 'valid', error: null };
        }

        // External URLs - try to validate via fetch
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
            return this._validateExternalUrl(url);
        }

        // Other URLs - assume valid
        return { status: 'valid', error: null };
    }

    // =====================================================
    // Private: Link Extraction Methods
    // =====================================================

    /**
     * Extract links (href/src attributes) from HTML content
     * @param {string} html
     * @returns {Array<{url: string, count: number}>}
     * @private
     */
    _extractLinksFromHtml(html) {
        if (!html) return [];

        const links = [];
        const regex = /(href|src)="([^"]*)"/gi;
        let match;

        while ((match = regex.exec(html)) !== null) {
            const url = match[2];
            if (url) {
                links.push({ url, count: 1 });
            }
        }

        return links;
    }

    /**
     * Clean URLs and count duplicates
     * @param {Array<{url: string, count: number}>} links
     * @returns {Array<{url: string, count: number}>}
     * @private
     */
    _cleanAndCountLinks(links) {
        const urlCounts = new Map();

        for (const link of links) {
            const cleanUrl = link.url.replace(/"/g, '');
            urlCounts.set(cleanUrl, (urlCounts.get(cleanUrl) || 0) + 1);
        }

        return Array.from(urlCounts.entries()).map(([url, count]) => ({ url, count }));
    }

    /**
     * Remove invalid/non-validatable links
     * Filters out: empty, anchors (#), javascript:, data: URLs
     * @param {Array<{url: string, count: number}>} links
     * @returns {Array<{url: string, count: number}>}
     * @private
     */
    _removeInvalidLinks(links) {
        return links.filter((link) => {
            if (!link.url || link.url.trim() === '') return false;
            if (link.url.startsWith('#')) return false;
            if (link.url.startsWith('javascript:')) return false;
            if (link.url.startsWith('data:')) return false;
            return true;
        });
    }

    /**
     * Deduplicate links, keeping the one with highest count
     * @param {Array<{url: string, count: number}>} links
     * @returns {Array<{url: string, count: number}>}
     * @private
     */
    _deduplicateLinks(links) {
        const uniqueLinks = new Map();

        for (const link of links) {
            const existing = uniqueLinks.get(link.url);
            if (!existing || link.count > existing.count) {
                uniqueLinks.set(link.url, link);
            }
        }

        return Array.from(uniqueLinks.values());
    }

    /**
     * Check if a URL should be included in the validation list
     * (used during extraction phase)
     * @param {string} url
     * @returns {boolean}
     * @private
     */
    _shouldValidateLink(url) {
        // Internal page links - skip validation (they're handled by the app)
        if (url.startsWith('exe-node:')) return false;

        // Asset URLs - skip validation (internal project assets)
        if (url.startsWith('asset://')) return false;

        // Internal file links - skip validation (legacy format, internal)
        if (url.startsWith('files/') || url.startsWith('files\\')) return false;

        // External HTTP(S) links - should validate
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return true;

        // Other relative URLs - skip validation
        return false;
    }

    /**
     * Check if a URL should actually be validated (stricter check for validation phase)
     * @param {string} url
     * @returns {boolean}
     * @private
     */
    _shouldValidateLinkStrict(url) {
        // exe-node: internal page links - always valid (skip validation)
        if (url.startsWith('exe-node:')) return false;

        // Asset URLs - always valid (internal project assets, skip validation)
        if (url.startsWith('asset://')) return false;

        // Internal file links - always valid (legacy format, internal, skip validation)
        if (url.startsWith('files/') || url.startsWith('files\\')) return false;

        // External HTTP(S) links - should validate
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return true;

        // Other URLs - don't validate
        return false;
    }

    // =====================================================
    // Private: Link Validation Methods
    // =====================================================

    /**
     * Validate an external HTTP(S) URL
     * Note: CORS restrictions may prevent validation of many external URLs
     * @param {string} url
     * @returns {Promise<{status: 'valid'|'broken', error: string|null}>}
     * @private
     */
    async _validateExternalUrl(url) {
        try {
            let normalizedUrl = url;

            // Handle protocol-relative URLs
            if (url.startsWith('//')) {
                normalizedUrl = 'https:' + url;
            }

            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                // Try HEAD request first (lighter, but may be blocked by CORS)
                const response = await fetch(normalizedUrl, {
                    method: 'HEAD',
                    mode: 'no-cors', // Use no-cors to avoid CORS errors
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                // In no-cors mode, we can't read the response status
                // A successful fetch (no network error) suggests the URL is reachable
                // This is the best we can do from browser without CORS cooperation

                // If we got here without error, consider it valid
                return { status: 'valid', error: null };
            } catch (fetchError) {
                clearTimeout(timeoutId);

                // Check for specific error types
                if (fetchError.name === 'AbortError') {
                    return { status: 'broken', error: _('Timeout') };
                }

                // Network errors (DNS failure, connection refused, etc.)
                // These indicate the URL is genuinely broken
                return { status: 'broken', error: fetchError.message || _('Network error') };
            }
        } catch (error) {
            // URL parsing or other errors
            return { status: 'broken', error: _('Invalid URL') };
        }
    }

    // =====================================================
    // Private: Utility Methods
    // =====================================================

    /**
     * Generate a UUID for link identification
     * Uses crypto.randomUUID if available, falls back to simple implementation
     * @returns {string}
     * @private
     */
    _generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }

        // Fallback implementation
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
}
