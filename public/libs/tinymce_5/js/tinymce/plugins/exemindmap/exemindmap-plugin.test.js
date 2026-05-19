/**
 * Unit tests for exemindmap TinyMCE plugin path handling
 *
 * Tests the path computation logic for:
 * - Editor URL selection (static vs online mode)
 * - Dynamic base tag computation in editor/index.html
 */

describe('exemindmap plugin - Path Handling', () => {
    describe('Editor URL selection', () => {
        // Mirror plugin.min.js: in server mode, route through composeUrl() so
        // BASE_PATH is prepended (issue #1802). Fall back to a bare path only
        // when the eXeLearning app/composeUrl helper isn't available (early init,
        // or environments without the host app).
        function getEditorUrl(config, app) {
            let editorUrl =
                app && typeof app.composeUrl === 'function'
                    ? app.composeUrl('/api/exemindmap-editor/index.html')
                    : '/api/exemindmap-editor/index.html';
            if (config?.isStaticMode || config?.isOfflineInstallation) {
                editorUrl = './libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html';
            }
            return editorUrl;
        }

        // Mirror window.eXeLearning.app.composeUrl from public/app/app.js:849-858
        function makeApp(basePath) {
            return {
                composeUrl(p) {
                    const normalized = !basePath || basePath === '/' ? '' : basePath.replace(/\/+$/, '');
                    const path = p.startsWith('/') ? p : `/${p}`;
                    return `${normalized}${path}`;
                },
            };
        }

        it('should return bare API URL when no host app is available (back-compat fallback)', () => {
            expect(getEditorUrl(null)).toBe('/api/exemindmap-editor/index.html');
            expect(getEditorUrl(undefined)).toBe('/api/exemindmap-editor/index.html');
            expect(getEditorUrl({})).toBe('/api/exemindmap-editor/index.html');
            expect(getEditorUrl({ isStaticMode: false })).toBe('/api/exemindmap-editor/index.html');
        });

        it('should prefix BASE_PATH via composeUrl in server mode (issue #1802)', () => {
            const app = makeApp('/aplicaciones/medusa/exelearning');
            expect(getEditorUrl(null, app)).toBe(
                '/aplicaciones/medusa/exelearning/api/exemindmap-editor/index.html',
            );
            expect(getEditorUrl({}, app)).toBe(
                '/aplicaciones/medusa/exelearning/api/exemindmap-editor/index.html',
            );
            expect(getEditorUrl({ isStaticMode: false }, app)).toBe(
                '/aplicaciones/medusa/exelearning/api/exemindmap-editor/index.html',
            );
        });

        it('should fall through to bare URL when BASE_PATH is empty', () => {
            const app = makeApp('');
            expect(getEditorUrl(null, app)).toBe('/api/exemindmap-editor/index.html');
        });

        it('should return relative URL in static mode regardless of composeUrl', () => {
            const expected = './libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html';
            const app = makeApp('/aplicaciones/medusa/exelearning');
            expect(getEditorUrl({ isStaticMode: true })).toBe(expected);
            expect(getEditorUrl({ isStaticMode: true }, app)).toBe(expected);
            expect(getEditorUrl({ isOfflineInstallation: true }, app)).toBe(expected);
            expect(getEditorUrl({ isStaticMode: true, isOfflineInstallation: true }, app)).toBe(expected);
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
