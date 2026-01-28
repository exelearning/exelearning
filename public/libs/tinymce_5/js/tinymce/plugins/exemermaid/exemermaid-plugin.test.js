/**
 * Unit tests for exemermaid TinyMCE plugin path handling
 *
 * Tests the CSS path construction logic.
 * The exemermaid plugin is simpler than exemindmap/codemagic as it uses
 * TinyMCE's built-in `url` parameter for resource loading.
 */

describe('exemermaid plugin - Path Handling', () => {
    describe('CSS path construction', () => {
        // The plugin uses: editor.dom.loadCSS(url + "/css/content.css")
        // where `url` is provided by TinyMCE plugin loader
        function getCssPath(pluginUrl) {
            return pluginUrl + '/css/content.css';
        }

        it('should construct correct CSS path with root installation', () => {
            const pluginUrl = '/libs/tinymce_5/js/tinymce/plugins/exemermaid';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('/libs/tinymce_5/js/tinymce/plugins/exemermaid/css/content.css');
        });

        it('should construct correct CSS path with basePath prefix', () => {
            const pluginUrl = '/web/exe/libs/tinymce_5/js/tinymce/plugins/exemermaid';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('/web/exe/libs/tinymce_5/js/tinymce/plugins/exemermaid/css/content.css');
        });

        it('should construct correct CSS path with deep basePath', () => {
            const pluginUrl = '/deep/nested/path/libs/tinymce_5/js/tinymce/plugins/exemermaid';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('/deep/nested/path/libs/tinymce_5/js/tinymce/plugins/exemermaid/css/content.css');
        });

        it('should construct correct CSS path with version prefix', () => {
            const pluginUrl = '/v3.0/libs/tinymce_5/js/tinymce/plugins/exemermaid';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('/v3.0/libs/tinymce_5/js/tinymce/plugins/exemermaid/css/content.css');
        });

        it('should construct correct CSS path with relative URL (static mode)', () => {
            const pluginUrl = './libs/tinymce_5/js/tinymce/plugins/exemermaid';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/exemermaid/css/content.css');
        });

        it('should handle URL with trailing slash', () => {
            const pluginUrl = '/libs/tinymce_5/js/tinymce/plugins/exemermaid/';
            const result = getCssPath(pluginUrl);
            // Note: This produces a double slash, which browsers typically normalize
            expect(result).toBe('/libs/tinymce_5/js/tinymce/plugins/exemermaid//css/content.css');
        });

        it('should handle empty URL', () => {
            const pluginUrl = '';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('/css/content.css');
        });
    });

    describe('Mermaid diagram content escaping', () => {
        // The plugin escapes HTML entities in mermaid code (line 59-60)
        function escapeHtml(content) {
            return content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function unescapeHtml(content) {
            return content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        }

        it('should escape ampersand', () => {
            expect(escapeHtml('A & B')).toBe('A &amp; B');
        });

        it('should escape less-than', () => {
            expect(escapeHtml('A < B')).toBe('A &lt; B');
        });

        it('should escape greater-than', () => {
            expect(escapeHtml('A > B')).toBe('A &gt; B');
        });

        it('should escape multiple special characters', () => {
            const input = 'A-->B & B-->C';
            const result = escapeHtml(input);
            expect(result).toBe('A--&gt;B &amp; B--&gt;C');
        });

        it('should handle mermaid flowchart syntax', () => {
            const input = 'flowchart TD\n    A-->B\n    B-->C';
            const result = escapeHtml(input);
            expect(result).toBe('flowchart TD\n    A--&gt;B\n    B--&gt;C');
        });

        it('should handle empty string', () => {
            expect(escapeHtml('')).toBe('');
        });

        it('should handle string with no special characters', () => {
            expect(escapeHtml('Hello World')).toBe('Hello World');
        });

        it('should unescape ampersand', () => {
            expect(unescapeHtml('A &amp; B')).toBe('A & B');
        });

        it('should unescape less-than', () => {
            expect(unescapeHtml('A &lt; B')).toBe('A < B');
        });

        it('should unescape greater-than', () => {
            expect(unescapeHtml('A &gt; B')).toBe('A > B');
        });

        it('should round-trip escape and unescape', () => {
            const original = 'A-->B & B<--C';
            const escaped = escapeHtml(original);
            const unescaped = unescapeHtml(escaped);
            expect(unescaped).toBe(original);
        });
    });

    describe('PRE element class detection', () => {
        // The plugin detects mermaid code by checking node type and class (line 35-36)
        function isMermaidElement(nodeName, className) {
            return nodeName === 'PRE' && className.indexOf('mermaid') !== -1;
        }

        it('should return true for PRE with mermaid class', () => {
            expect(isMermaidElement('PRE', 'mermaid')).toBe(true);
        });

        it('should return true for PRE with mermaid and other classes', () => {
            expect(isMermaidElement('PRE', 'mermaid custom-class')).toBe(true);
        });

        it('should return true for PRE with mermaid in middle of class list', () => {
            expect(isMermaidElement('PRE', 'custom mermaid another')).toBe(true);
        });

        it('should return false for non-PRE elements', () => {
            expect(isMermaidElement('DIV', 'mermaid')).toBe(false);
            expect(isMermaidElement('CODE', 'mermaid')).toBe(false);
            expect(isMermaidElement('SPAN', 'mermaid')).toBe(false);
        });

        it('should return false for PRE without mermaid class', () => {
            expect(isMermaidElement('PRE', 'code highlight')).toBe(false);
        });

        it('should return false for empty class', () => {
            expect(isMermaidElement('PRE', '')).toBe(false);
        });

        it('should handle lowercase node name', () => {
            // Note: in browser, nodeName is typically uppercase
            expect(isMermaidElement('pre', 'mermaid')).toBe(false);
        });
    });
});
