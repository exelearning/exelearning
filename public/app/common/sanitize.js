/**
 * Centralized sanitization utilities for eXeLearning
 * Use these functions to prevent XSS vulnerabilities when inserting user content into DOM
 */
(function (global) {
    'use strict';

    var $exeSanitize = {

    /**
     * Escape HTML special characters for safe insertion as text content
     * Use this when inserting plain text into HTML (titles, labels, attribute values)
     *
     * @param {string} string - The string to escape
     * @returns {string} - HTML-escaped string safe for insertion
     */
    escapeHtml: function (string) {
        if (string === null || string === undefined) {
            return '';
        }
        return String(string)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Sanitize HTML content to remove dangerous elements while preserving formatting
     * Use this when inserting user-created HTML that should keep formatting (bold, lists, etc.)
     * Requires DOMPurify to be loaded (falls back to escapeHtml if not available)
     *
     * @param {string} html - The HTML string to sanitize
     * @param {Object} options - Optional DOMPurify configuration overrides
     * @returns {string} - Sanitized HTML string
     */
    sanitizeHtml: function (html, options) {
        if (html === null || html === undefined) {
            return '';
        }
        if (typeof DOMPurify !== 'undefined') {
            var defaultConfig = {
                FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout',
                              'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset',
                              'onkeydown', 'onkeyup', 'onkeypress'],
                ALLOW_DATA_ATTR: true
            };
            var config = options ? Object.assign({}, defaultConfig, options) : defaultConfig;
            return DOMPurify.sanitize(html, config);
        }
        // Fallback: escape all HTML if DOMPurify is not available
        console.warn('$exeSanitize: DOMPurify not available, falling back to escapeHtml');
        return this.escapeHtml(html);
    },

    /**
     * Validate and sanitize a URL to prevent javascript: and data: URL attacks
     * Use this when setting href, src, or other URL attributes from user input
     *
     * @param {string} url - The URL to validate
     * @param {Array} allowedProtocols - Optional list of allowed protocols (default: http, https)
     * @returns {string} - Safe URL or empty string if invalid
     */
    sanitizeUrl: function (url, allowedProtocols) {
        if (!url || typeof url !== 'string') {
            return '';
        }

        var trimmed = url.trim().toLowerCase();
        var protocols = allowedProtocols || ['http:', 'https:', 'mailto:', 'tel:'];

        // Block dangerous protocols
        if (trimmed.startsWith('javascript:') ||
            trimmed.startsWith('data:') ||
            trimmed.startsWith('vbscript:')) {
            console.warn('$exeSanitize: Blocked dangerous URL protocol');
            return '';
        }

        // Allow relative URLs
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../') || url.startsWith('#')) {
            return url;
        }

        // Validate absolute URLs
        try {
            var parsed = new URL(url);
            if (protocols.indexOf(parsed.protocol) !== -1) {
                return url;
            }
            console.warn('$exeSanitize: URL protocol not in allowed list:', parsed.protocol);
            return '';
        } catch (e) {
            // Not a valid absolute URL, treat as relative
            return url;
        }
    },

    /**
     * Escape a string for use in a CSS attribute value
     * Use this when inserting user content into style attributes
     *
     * @param {string} value - The CSS value to escape
     * @returns {string} - Escaped CSS value
     */
    escapeCss: function (value) {
        if (value === null || value === undefined) {
            return '';
        }
        // Remove or escape characters that could break out of CSS context
        return String(value)
            .replace(/[<>"'&;{}()]/g, '')
            .replace(/expression\s*\(/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/url\s*\(/gi, '');
    }
    };

    // Export to global scope (works in browser, Node, and test environments)
    if (typeof global.window !== 'undefined') {
        global.window.$exeSanitize = $exeSanitize;
    }
    if (typeof global !== 'undefined') {
        global.$exeSanitize = $exeSanitize;
    }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
