/**
 * Tests for the dynamic base path computation in EdiCuaTeX.
 * The base path script ensures relative paths resolve correctly
 * regardless of URL structure (versioned, with basePath, etc.).
 */

describe('EdiCuaTeX Base Path Computation', () => {
    let originalPathname;
    let originalHead;

    beforeEach(() => {
        // Save original values
        originalPathname = window.location.pathname;
        originalHead = document.head.innerHTML;

        // Remove any existing base tag
        const existingBase = document.querySelector('base');
        if (existingBase) {
            existingBase.remove();
        }
    });

    afterEach(() => {
        // Restore document head
        document.head.innerHTML = originalHead;

        // Remove any base tag created by tests
        const base = document.querySelector('base');
        if (base) {
            base.remove();
        }
    });

    /**
     * Helper function that replicates the base path computation logic
     * from index.html for testing purposes.
     */
    function computeBasePath(pathname) {
        let path = pathname;
        let edicuatexIndex = path.indexOf('/edicuatex/');
        if (edicuatexIndex === -1) {
            // Fallback: if path ends with /edicuatex (no trailing slash)
            const lastIndex = path.lastIndexOf('/edicuatex');
            if (lastIndex !== -1 && path.length === lastIndex + 10) {
                path = path + '/';
                edicuatexIndex = path.indexOf('/edicuatex/');
            }
        }
        if (edicuatexIndex !== -1) {
            return path.substring(0, edicuatexIndex + 11); // Include '/edicuatex/'
        }
        return null;
    }

    describe('computeBasePath', () => {
        it('should return correct base path for simple path', () => {
            const result = computeBasePath('/app/common/edicuatex/index.html');
            expect(result).toBe('/app/common/edicuatex/');
        });

        it('should return correct base path for versioned URL', () => {
            const result = computeBasePath('/v0.0.3-rc/app/common/edicuatex/index.html');
            expect(result).toBe('/v0.0.3-rc/app/common/edicuatex/');
        });

        it('should return correct base path for basePath with version', () => {
            const result = computeBasePath('/mybase/v1.2.3/app/common/edicuatex/index.html');
            expect(result).toBe('/mybase/v1.2.3/app/common/edicuatex/');
        });

        it('should return correct base path when path ends without trailing slash', () => {
            const result = computeBasePath('/app/common/edicuatex');
            expect(result).toBe('/app/common/edicuatex/');
        });

        it('should return correct base path for path with just edicuatex/', () => {
            const result = computeBasePath('/edicuatex/');
            expect(result).toBe('/edicuatex/');
        });

        it('should return correct base path for root path with edicuatex', () => {
            const result = computeBasePath('/edicuatex/index.html');
            expect(result).toBe('/edicuatex/');
        });

        it('should return null when edicuatex is not in path', () => {
            const result = computeBasePath('/app/common/other/index.html');
            expect(result).toBeNull();
        });

        it('should return null for empty path', () => {
            const result = computeBasePath('/');
            expect(result).toBeNull();
        });

        it('should handle deep nested paths with versioning', () => {
            const result = computeBasePath('/prefix/v3.1.0-beta/app/common/edicuatex/menus/editor.html');
            expect(result).toBe('/prefix/v3.1.0-beta/app/common/edicuatex/');
        });

        it('should handle path with multiple slashes', () => {
            const result = computeBasePath('/a/b/c/d/edicuatex/index.html');
            expect(result).toBe('/a/b/c/d/edicuatex/');
        });

        it('should not match partial edicuatex names', () => {
            const result = computeBasePath('/app/edicuatex2/index.html');
            expect(result).toBeNull();
        });

        it('should handle path ending exactly with /edicuatex', () => {
            const result = computeBasePath('/v1.0.0/app/common/edicuatex');
            expect(result).toBe('/v1.0.0/app/common/edicuatex/');
        });

        it('should return first occurrence when edicuatex appears multiple times', () => {
            const result = computeBasePath('/edicuatex/nested/edicuatex/index.html');
            expect(result).toBe('/edicuatex/');
        });
    });

    describe('Base tag injection', () => {
        it('should create base element with correct href', () => {
            // Simulate the script behavior
            const basePath = computeBasePath('/v0.0.3-rc/app/common/edicuatex/index.html');
            if (basePath) {
                const base = document.createElement('base');
                base.href = basePath;
                document.head.appendChild(base);
            }

            const baseTag = document.querySelector('base');
            expect(baseTag).not.toBeNull();
            expect(baseTag.getAttribute('href')).toBe('/v0.0.3-rc/app/common/edicuatex/');
        });

        it('should not create base element when edicuatex not in path', () => {
            const basePath = computeBasePath('/other/path/index.html');
            if (basePath) {
                const base = document.createElement('base');
                base.href = basePath;
                document.head.appendChild(base);
            }

            const baseTag = document.querySelector('base');
            expect(baseTag).toBeNull();
        });
    });

    describe('MathJax URL basePath detection', () => {
        /**
         * Helper function that replicates the basePath detection logic
         * from edicuatex-tools.js for MathJax URL resolution.
         * This detects the deployment subdirectory from the iframe URL.
         */
        function computeAppBasePath(pathname) {
            let appBasePath = '';
            const appIndex = pathname.indexOf('/app/');
            if (appIndex > 0) {
                appBasePath = pathname.substring(0, appIndex);
            }
            return appBasePath;
        }

        /**
         * Helper function that replicates the MathJax URL resolution logic
         * from edicuatex-tools.js.
         * In online mode, getAssetURL() already adds the base path to the URL,
         * so we need to check if the URL already contains appBasePath before prepending.
         */
        function resolveMathJaxUrl(mathjaxUrl, iframePathname, origin = 'http://localhost') {
            const appBasePath = computeAppBasePath(iframePathname);

            if (mathjaxUrl && mathjaxUrl.startsWith('/')) {
                // Check if URL already starts with appBasePath (online mode)
                if (appBasePath && mathjaxUrl.startsWith(appBasePath)) {
                    // URL already has base path, just prepend origin
                    return origin + mathjaxUrl;
                }
                // URL is root-relative, prepend origin + basePath
                return origin + appBasePath + mathjaxUrl;
            } else if (mathjaxUrl && mathjaxUrl.startsWith('./')) {
                return origin + appBasePath + '/' + mathjaxUrl.substring(2);
            }
            return mathjaxUrl;
        }

        it('should return empty basePath for root deployment', () => {
            const result = computeAppBasePath('/app/common/edicuatex/index.html');
            expect(result).toBe('');
        });

        it('should detect basePath for subdirectory deployment', () => {
            const result = computeAppBasePath('/dist/static/app/common/edicuatex/index.html');
            expect(result).toBe('/dist/static');
        });

        it('should detect basePath for deep subdirectory deployment', () => {
            const result = computeAppBasePath('/org/project/v1/app/common/edicuatex/index.html');
            expect(result).toBe('/org/project/v1');
        });

        it('should resolve absolute MathJax URL for root deployment', () => {
            const url = resolveMathJaxUrl(
                '/app/common/exe_math/tex-mml-svg.js',
                '/app/common/edicuatex/index.html'
            );
            expect(url).toBe('http://localhost/app/common/exe_math/tex-mml-svg.js');
        });

        it('should resolve absolute MathJax URL for subdirectory deployment', () => {
            const url = resolveMathJaxUrl(
                '/app/common/exe_math/tex-mml-svg.js',
                '/dist/static/app/common/edicuatex/index.html'
            );
            expect(url).toBe('http://localhost/dist/static/app/common/exe_math/tex-mml-svg.js');
        });

        it('should resolve relative MathJax URL with ./ prefix for root deployment', () => {
            const url = resolveMathJaxUrl(
                './app/common/exe_math/tex-mml-svg.js',
                '/app/common/edicuatex/index.html'
            );
            expect(url).toBe('http://localhost/app/common/exe_math/tex-mml-svg.js');
        });

        it('should resolve relative MathJax URL with ./ prefix for subdirectory deployment', () => {
            const url = resolveMathJaxUrl(
                './app/common/exe_math/tex-mml-svg.js',
                '/dist/static/app/common/edicuatex/index.html'
            );
            expect(url).toBe('http://localhost/dist/static/app/common/exe_math/tex-mml-svg.js');
        });

        it('should not modify CDN URLs (https://)', () => {
            const cdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.min.js';
            const url = resolveMathJaxUrl(
                cdnUrl,
                '/dist/static/app/common/edicuatex/index.html'
            );
            expect(url).toBe(cdnUrl);
        });

        it('should handle path without /app/ marker', () => {
            const result = computeAppBasePath('/some/other/path/index.html');
            expect(result).toBe('');
        });

        describe('Online mode (URL already contains basePath)', () => {
            // In online mode, getAssetURL() in tinymce_5_settings.js already adds
            // the base path to the URL. We must NOT duplicate it.

            it('should NOT duplicate basePath when URL already contains it', () => {
                // Online mode: URL from getAssetURL() already has /web/exelearning1/tres/v0.0.0-alpha
                // iframe is at /web/exelearning1/tres/v0.0.0-alpha/app/common/edicuatex/
                const url = resolveMathJaxUrl(
                    '/web/exelearning1/tres/v0.0.0-alpha/app/common/exe_math/tex-mml-svg.js',
                    '/web/exelearning1/tres/v0.0.0-alpha/app/common/edicuatex/index.html'
                );
                // Should be origin + URL (NOT origin + basePath + URL which would duplicate)
                expect(url).toBe('http://localhost/web/exelearning1/tres/v0.0.0-alpha/app/common/exe_math/tex-mml-svg.js');
            });

            it('should NOT duplicate simple basePath when URL already contains it', () => {
                // Another common case: /exelearning/ as base path
                const url = resolveMathJaxUrl(
                    '/exelearning/app/common/exe_math/tex-mml-svg.js',
                    '/exelearning/app/common/edicuatex/index.html'
                );
                expect(url).toBe('http://localhost/exelearning/app/common/exe_math/tex-mml-svg.js');
            });

            it('should still prepend basePath when URL does NOT contain it (static mode)', () => {
                // Static mode: URL is just /app/... but we're in /dist/static/app/...
                const url = resolveMathJaxUrl(
                    '/app/common/exe_math/tex-mml-svg.js',
                    '/dist/static/app/common/edicuatex/index.html'
                );
                // Should prepend the basePath since URL doesn't already have it
                expect(url).toBe('http://localhost/dist/static/app/common/exe_math/tex-mml-svg.js');
            });

            it('should handle root deployment (empty basePath) correctly', () => {
                // Root deployment: no basePath, URL starts with /app/
                const url = resolveMathJaxUrl(
                    '/app/common/exe_math/tex-mml-svg.js',
                    '/app/common/edicuatex/index.html'
                );
                // Empty basePath means just prepend origin
                expect(url).toBe('http://localhost/app/common/exe_math/tex-mml-svg.js');
            });
        });
    });

    describe('Real-world URL scenarios', () => {
        it('should handle localhost development URL', () => {
            const result = computeBasePath('/app/common/edicuatex/index.html');
            expect(result).toBe('/app/common/edicuatex/');
        });

        it('should handle production URL with version', () => {
            const result = computeBasePath('/v3.1.0/app/common/edicuatex/index.html');
            expect(result).toBe('/v3.1.0/app/common/edicuatex/');
        });

        it('should handle URL with basePath configuration', () => {
            const result = computeBasePath('/exelearning/v2.0.0/app/common/edicuatex/index.html');
            expect(result).toBe('/exelearning/v2.0.0/app/common/edicuatex/');
        });

        it('should handle URL with release candidate version', () => {
            const result = computeBasePath('/v0.0.3-rc/app/common/edicuatex/index.html');
            expect(result).toBe('/v0.0.3-rc/app/common/edicuatex/');
        });

        it('should handle URL with alpha/beta versions', () => {
            const result = computeBasePath('/v1.0.0-alpha.1/app/common/edicuatex/index.html');
            expect(result).toBe('/v1.0.0-alpha.1/app/common/edicuatex/');
        });

        it('should handle nested page within edicuatex', () => {
            const result = computeBasePath('/v1.0.0/app/common/edicuatex/menus/editor.html');
            expect(result).toBe('/v1.0.0/app/common/edicuatex/');
        });
    });
});
