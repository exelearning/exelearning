/**
 * Unit tests for exemindmap TinyMCE plugin path handling
 *
 * Tests the path computation logic for:
 * - Editor URL selection (static vs online mode)
 * - Dynamic base tag computation in editor/index.html
 */

describe('exemindmap plugin - Path Handling', () => {
    describe('Editor URL selection', () => {
        // Extract the logic from plugin.min.js lines 264-276
        function getEditorUrl(config) {
            let editorUrl = '/api/exemindmap-editor/index.html';
            if (config?.isStaticMode || config?.isOfflineInstallation) {
                editorUrl = './libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html';
            }
            return editorUrl;
        }

        it('should return API URL when config is null', () => {
            const result = getEditorUrl(null);
            expect(result).toBe('/api/exemindmap-editor/index.html');
        });

        it('should return API URL when config is undefined', () => {
            const result = getEditorUrl(undefined);
            expect(result).toBe('/api/exemindmap-editor/index.html');
        });

        it('should return API URL in online mode (isStaticMode: false)', () => {
            const result = getEditorUrl({ isStaticMode: false });
            expect(result).toBe('/api/exemindmap-editor/index.html');
        });

        it('should return relative URL in static mode (isStaticMode: true)', () => {
            const result = getEditorUrl({ isStaticMode: true });
            expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html');
        });

        it('should return relative URL for offline installation (isOfflineInstallation: true)', () => {
            const result = getEditorUrl({ isOfflineInstallation: true });
            expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html');
        });

        it('should return relative URL when both flags are true', () => {
            const result = getEditorUrl({ isStaticMode: true, isOfflineInstallation: true });
            expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html');
        });

        it('should return API URL when config has other properties but not mode flags', () => {
            const result = getEditorUrl({ basePath: '/web/exe', version: 'v3.0' });
            expect(result).toBe('/api/exemindmap-editor/index.html');
        });

        it('should handle config as empty object', () => {
            const result = getEditorUrl({});
            expect(result).toBe('/api/exemindmap-editor/index.html');
        });
    });

    describe('Dynamic base tag computation (editor/index.html)', () => {
        // Extract the logic from editor/index.html lines 8-27
        function computeBasePath(pathname) {
            let path = pathname;
            // Extract the path up to and including the /editor/ directory
            let editorIndex = path.lastIndexOf('/editor/');
            if (editorIndex === -1) {
                // Fallback: if path ends with /editor (no trailing slash), add it
                editorIndex = path.lastIndexOf('/editor');
                if (editorIndex !== -1 && path.length === editorIndex + 7) {
                    path = path + '/';
                }
            }
            if (editorIndex !== -1) {
                return path.substring(0, editorIndex + 8); // Include '/editor/'
            }
            return null;
        }

        it('should compute base path for root installation', () => {
            const result = computeBasePath('/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html');
            expect(result).toBe('/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/');
        });

        it('should compute base path with BASE_PATH prefix (/web/exe)', () => {
            const result = computeBasePath('/web/exe/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html');
            expect(result).toBe('/web/exe/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/');
        });

        it('should compute base path with deep BASE_PATH prefix', () => {
            const result = computeBasePath('/deep/nested/path/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html');
            expect(result).toBe('/deep/nested/path/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/');
        });

        it('should handle path ending with /editor (no trailing slash)', () => {
            const result = computeBasePath('/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor');
            expect(result).toBe('/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/');
        });

        it('should handle path ending with /editor/ (with trailing slash)', () => {
            const result = computeBasePath('/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/');
            expect(result).toBe('/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/');
        });

        it('should return null for paths without /editor/', () => {
            const result = computeBasePath('/libs/tinymce_5/js/tinymce/plugins/exemindmap/');
            expect(result).toBeNull();
        });

        it('should return null for unrelated paths', () => {
            const result = computeBasePath('/some/other/path/index.html');
            expect(result).toBeNull();
        });

        it('should handle API endpoint path (online mode)', () => {
            const result = computeBasePath('/api/exemindmap-editor/index.html');
            expect(result).toBeNull(); // No /editor/ in API path
        });

        it('should compute base path for API endpoint with editor in path', () => {
            // This tests the actual API route structure if it were to include /editor/
            const result = computeBasePath('/api/exemindmap-editor/editor/index.html');
            expect(result).toBe('/api/exemindmap-editor/editor/');
        });

        it('should handle multiple /editor/ occurrences (use last one)', () => {
            const result = computeBasePath('/editor/something/editor/index.html');
            expect(result).toBe('/editor/something/editor/');
        });

        it('should handle version prefix in path', () => {
            const result = computeBasePath('/v3.0/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html');
            expect(result).toBe('/v3.0/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/');
        });

        it('should handle empty path', () => {
            const result = computeBasePath('');
            expect(result).toBeNull();
        });

        it('should handle root path', () => {
            const result = computeBasePath('/');
            expect(result).toBeNull();
        });
    });
});
