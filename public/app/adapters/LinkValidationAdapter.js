/**
 * LinkValidationAdapter
 *
 * Client-side link validation adapter for static/offline mode.
 * Extracts links from HTML content (a port of the server-side
 * link-validator.ts extraction logic) and validates them where possible:
 *
 * - Electron desktop app: external links are checked by the main process
 *   (window.electronAPI.checkLink), where CORS does not apply, so the report
 *   shows real HTTP statuses just like online mode.
 * - Plain browser (static web, embeds): CORS makes cross-origin responses
 *   opaque, so external links cannot be checked at all and are reported as
 *   needing a manual review.
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
     * @returns {Promise<{status: 'valid'|'broken'|'unknown', error: string|null}>}
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
     * Validate an external HTTP(S) URL.
     *
     * A web page cannot read the HTTP status of a cross-origin response: CORS
     * makes it opaque, so a 200 and a 404 are indistinguishable from the
     * browser. In the desktop app the check is delegated to the Electron main
     * process, where CORS does not apply and the real status is available. In
     * a plain browser (static/offline flavors) no automatic check is possible,
     * so the link is reported as needing a manual review.
     *
     * @param {string} url
     * @returns {Promise<{status: 'valid'|'broken'|'unknown', error: string|null}>}
     * @private
     */
    async _validateExternalUrl(url) {
        const normalizedUrl = url.startsWith('//') ? `https:${url}` : url;

        const electronCheck = this._getElectronLinkChecker();
        if (electronCheck) {
            try {
                const result = await electronCheck(normalizedUrl);
                if (result?.status === 'valid' || result?.status === 'broken') {
                    return { status: result.status, error: result.error ?? null };
                }
                if (result?.status === 'unknown') {
                    return { status: 'unknown', error: this._describeUnknownReason(result) };
                }
            } catch (_e) {
                // IPC unavailable (e.g. outdated desktop shell): fall through
                // to the browser-limited outcome below.
            }
        }

        return {
            status: 'unknown',
            error: _('Not checked automatically: open the link to review it'),
        };
    }

    /**
     * Translate a main-process "needs manual review" result into the message
     * shown in the report's Error column.
     * @param {{reason?: string, detail?: string}} result
     * @returns {string}
     * @private
     */
    _describeUnknownReason(result) {
        switch (result.reason) {
            case 'private-address':
                // Never probed automatically: LAN-scan protection.
                return _('Local or private address: open the link to review it manually');
            case 'cross-host-redirect': {
                // 2xx answered by another host (consent gate, captive portal,
                // login wall, URL shortener target): a human must confirm it.
                const message = _('Redirects to another site — open the link to verify it');
                return result.detail ? `${message} (${result.detail})` : message;
            }
            case 'unverified-proxy':
                // Answered only through the system proxy, where the final host
                // cannot be attributed.
                return _('Could not be fully verified: open the link to confirm it');
            case 'unresolved-redirect':
                return _('Redirects could not be followed: open the link to review it');
            default:
                return _('Not checked automatically: open the link to review it');
        }
    }

    /**
     * Main-process link checker exposed by the Electron preload, or null when
     * running in a plain browser.
     * @returns {Function|null}
     * @private
     */
    _getElectronLinkChecker() {
        const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
        return typeof api?.checkLink === 'function' ? api.checkLink : null;
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
