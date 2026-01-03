/**
 * Tests for sanitize.js - Centralized sanitization utilities
 */
import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { Window } from 'happy-dom';

// Setup DOM environment before importing sanitize.js
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// Import the module (it will attach to globalThis)
import './sanitize.js';

describe('$exeSanitize', () => {
    let $exeSanitize;

    beforeEach(() => {
        // Get the global instance
        $exeSanitize = globalThis.$exeSanitize || window.$exeSanitize;
    });

    describe('escapeHtml', () => {
        test('escapes ampersand', () => {
            expect($exeSanitize.escapeHtml('a & b')).toBe('a &amp; b');
        });

        test('escapes less than', () => {
            expect($exeSanitize.escapeHtml('a < b')).toBe('a &lt; b');
        });

        test('escapes greater than', () => {
            expect($exeSanitize.escapeHtml('a > b')).toBe('a &gt; b');
        });

        test('escapes double quotes', () => {
            expect($exeSanitize.escapeHtml('a "b" c')).toBe('a &quot;b&quot; c');
        });

        test('escapes single quotes', () => {
            expect($exeSanitize.escapeHtml("a 'b' c")).toBe('a &#39;b&#39; c');
        });

        test('escapes all special characters together', () => {
            expect($exeSanitize.escapeHtml('<script>"alert(\'xss\')&</script>'))
                .toBe('&lt;script&gt;&quot;alert(&#39;xss&#39;)&amp;&lt;/script&gt;');
        });

        test('handles null input', () => {
            expect($exeSanitize.escapeHtml(null)).toBe('');
        });

        test('handles undefined input', () => {
            expect($exeSanitize.escapeHtml(undefined)).toBe('');
        });

        test('handles numeric input', () => {
            expect($exeSanitize.escapeHtml(123)).toBe('123');
        });

        test('handles empty string', () => {
            expect($exeSanitize.escapeHtml('')).toBe('');
        });

        test('preserves normal text', () => {
            expect($exeSanitize.escapeHtml('Hello World')).toBe('Hello World');
        });

        test('handles unicode characters', () => {
            expect($exeSanitize.escapeHtml('Hola mundo')).toBe('Hola mundo');
        });

        test('prevents XSS via script tag', () => {
            const result = $exeSanitize.escapeHtml('<script>alert("xss")</script>');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        test('prevents XSS via img onerror', () => {
            const result = $exeSanitize.escapeHtml('<img src=x onerror=alert("xss")>');
            expect(result).not.toContain('<img');
            expect(result).toContain('&lt;img');
        });
    });

    describe('sanitizeHtml (without DOMPurify)', () => {
        test('falls back to escapeHtml when DOMPurify is not available', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            expect($exeSanitize.sanitizeHtml('<b>test</b>')).toBe('&lt;b&gt;test&lt;/b&gt;');
            consoleSpy.mockRestore();
        });

        test('handles null input', () => {
            expect($exeSanitize.sanitizeHtml(null)).toBe('');
        });

        test('handles undefined input', () => {
            expect($exeSanitize.sanitizeHtml(undefined)).toBe('');
        });
    });

    describe('sanitizeHtml (with DOMPurify mock)', () => {
        beforeEach(() => {
            // Mock DOMPurify globally
            globalThis.DOMPurify = {
                sanitize: (html, config) => {
                    // Simple mock that removes script tags
                    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                }
            };
        });

        afterEach(() => {
            delete globalThis.DOMPurify;
        });

        test('uses DOMPurify when available', () => {
            const result = $exeSanitize.sanitizeHtml('<b>test</b><script>alert("xss")</script>');
            expect(result).toBe('<b>test</b>');
        });

        test('passes options to DOMPurify', () => {
            let capturedConfig = null;
            globalThis.DOMPurify.sanitize = (html, config) => {
                capturedConfig = config;
                return html;
            };

            $exeSanitize.sanitizeHtml('<b>test</b>', { CUSTOM_OPTION: true });
            expect(capturedConfig.CUSTOM_OPTION).toBe(true);
        });

        test('includes default FORBID_TAGS in config', () => {
            let capturedConfig = null;
            globalThis.DOMPurify.sanitize = (html, config) => {
                capturedConfig = config;
                return html;
            };

            $exeSanitize.sanitizeHtml('<b>test</b>');
            expect(capturedConfig.FORBID_TAGS).toContain('script');
            expect(capturedConfig.FORBID_TAGS).toContain('iframe');
        });

        test('includes default FORBID_ATTR in config', () => {
            let capturedConfig = null;
            globalThis.DOMPurify.sanitize = (html, config) => {
                capturedConfig = config;
                return html;
            };

            $exeSanitize.sanitizeHtml('<b>test</b>');
            expect(capturedConfig.FORBID_ATTR).toContain('onerror');
            expect(capturedConfig.FORBID_ATTR).toContain('onclick');
        });
    });

    describe('sanitizeUrl', () => {
        test('allows http URLs', () => {
            expect($exeSanitize.sanitizeUrl('http://example.com')).toBe('http://example.com');
        });

        test('allows https URLs', () => {
            expect($exeSanitize.sanitizeUrl('https://example.com')).toBe('https://example.com');
        });

        test('allows mailto URLs', () => {
            expect($exeSanitize.sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
        });

        test('allows tel URLs', () => {
            expect($exeSanitize.sanitizeUrl('tel:+1234567890')).toBe('tel:+1234567890');
        });

        test('blocks javascript: URLs', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            expect($exeSanitize.sanitizeUrl('javascript:alert("xss")')).toBe('');
            consoleSpy.mockRestore();
        });

        test('blocks javascript: URLs with mixed case', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            expect($exeSanitize.sanitizeUrl('JavaScript:alert("xss")')).toBe('');
            consoleSpy.mockRestore();
        });

        test('blocks javascript: URLs with leading spaces', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            expect($exeSanitize.sanitizeUrl('  javascript:alert("xss")')).toBe('');
            consoleSpy.mockRestore();
        });

        test('blocks data: URLs', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            expect($exeSanitize.sanitizeUrl('data:text/html,<script>alert("xss")</script>')).toBe('');
            consoleSpy.mockRestore();
        });

        test('blocks vbscript: URLs', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            expect($exeSanitize.sanitizeUrl('vbscript:msgbox("xss")')).toBe('');
            consoleSpy.mockRestore();
        });

        test('allows relative URLs starting with /', () => {
            expect($exeSanitize.sanitizeUrl('/path/to/page')).toBe('/path/to/page');
        });

        test('allows relative URLs starting with ./', () => {
            expect($exeSanitize.sanitizeUrl('./path/to/page')).toBe('./path/to/page');
        });

        test('allows relative URLs starting with ../', () => {
            expect($exeSanitize.sanitizeUrl('../path/to/page')).toBe('../path/to/page');
        });

        test('allows anchor URLs starting with #', () => {
            expect($exeSanitize.sanitizeUrl('#section')).toBe('#section');
        });

        test('handles empty string', () => {
            expect($exeSanitize.sanitizeUrl('')).toBe('');
        });

        test('handles null input', () => {
            expect($exeSanitize.sanitizeUrl(null)).toBe('');
        });

        test('handles undefined input', () => {
            expect($exeSanitize.sanitizeUrl(undefined)).toBe('');
        });

        test('handles non-string input', () => {
            expect($exeSanitize.sanitizeUrl(123)).toBe('');
        });

        test('respects custom allowed protocols', () => {
            expect($exeSanitize.sanitizeUrl('ftp://example.com', ['ftp:'])).toBe('ftp://example.com');
        });

        test('blocks protocols not in custom allowed list', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            expect($exeSanitize.sanitizeUrl('http://example.com', ['ftp:'])).toBe('');
            consoleSpy.mockRestore();
        });
    });

    describe('escapeCss', () => {
        test('removes angle brackets', () => {
            expect($exeSanitize.escapeCss('color<>')).toBe('color');
        });

        test('removes quotes', () => {
            expect($exeSanitize.escapeCss('color"\'test')).toBe('colortest');
        });

        test('removes semicolons', () => {
            expect($exeSanitize.escapeCss('color;red')).toBe('colorred');
        });

        test('removes curly braces', () => {
            expect($exeSanitize.escapeCss('color{}')).toBe('color');
        });

        test('removes parentheses', () => {
            expect($exeSanitize.escapeCss('color()')).toBe('color');
        });

        test('removes expression()', () => {
            // expression( is stripped, parentheses and quotes are also stripped
            const result = $exeSanitize.escapeCss('expression(alert("xss"))');
            expect(result).not.toContain('expression(');
            expect(result).not.toContain('(');
            expect(result).not.toContain('"');
        });

        test('removes javascript:', () => {
            // javascript: is stripped, quotes and parentheses are also stripped
            const result = $exeSanitize.escapeCss('javascript:alert("xss")');
            expect(result).not.toContain('javascript:');
            expect(result).not.toContain('(');
            expect(result).not.toContain('"');
        });

        test('removes url()', () => {
            // url( is stripped, parentheses are also stripped
            const result = $exeSanitize.escapeCss('url(http://evil.com)');
            expect(result).not.toContain('url(');
            expect(result).not.toContain('(');
        });

        test('handles null input', () => {
            expect($exeSanitize.escapeCss(null)).toBe('');
        });

        test('handles undefined input', () => {
            expect($exeSanitize.escapeCss(undefined)).toBe('');
        });

        test('preserves valid CSS color values', () => {
            expect($exeSanitize.escapeCss('#ff0000')).toBe('#ff0000');
            expect($exeSanitize.escapeCss('red')).toBe('red');
        });

        test('preserves valid CSS dimension values', () => {
            expect($exeSanitize.escapeCss('10px')).toBe('10px');
            expect($exeSanitize.escapeCss('100%')).toBe('100%');
        });
    });
});
