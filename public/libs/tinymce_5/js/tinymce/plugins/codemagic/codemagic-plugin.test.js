/**
 * Unit tests for codemagic TinyMCE plugin path handling
 *
 * Tests the path computation logic for:
 * - Dialog URL selection (static vs online mode with basePath support)
 * - Static mode detection with multiple fallbacks
 */

describe('codemagic plugin - Path Handling', () => {
    describe('Dialog URL selection', () => {
        // Mirror plugin.min.js: in server mode, route through composeUrl() so that
        // BASE_PATH is prepended (issue #1802). Static mode still wins when its
        // flags are set. Reading basePath directly from config is gone — composeUrl
        // is the single source of truth, identical to the rest of the client.
        function getCodemagicUrl(config, capabilities, staticModeGlobal, app) {
            let isStaticMode = config?.isStaticMode || config?.isOfflineInstallation;
            if (!isStaticMode) {
                isStaticMode = capabilities ? !capabilities.storage.remote : staticModeGlobal;
            }

            if (isStaticMode) {
                return './libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html';
            }
            return app && typeof app.composeUrl === 'function'
                ? app.composeUrl('/api/codemagic-editor/codemagic.html')
                : '/api/codemagic-editor/codemagic.html';
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

        describe('Server mode', () => {
            it('returns bare API URL when no host app is available (back-compat)', () => {
                expect(getCodemagicUrl(null, null, false)).toBe('/api/codemagic-editor/codemagic.html');
                expect(getCodemagicUrl(undefined, null, false)).toBe('/api/codemagic-editor/codemagic.html');
                expect(getCodemagicUrl({}, null, false)).toBe('/api/codemagic-editor/codemagic.html');
            });

            it('prefixes BASE_PATH via composeUrl when host app is wired (issue #1802)', () => {
                const app = makeApp('/aplicaciones/medusa/exelearning');
                expect(getCodemagicUrl({}, null, false, app)).toBe(
                    '/aplicaciones/medusa/exelearning/api/codemagic-editor/codemagic.html',
                );
                expect(getCodemagicUrl(null, null, false, app)).toBe(
                    '/aplicaciones/medusa/exelearning/api/codemagic-editor/codemagic.html',
                );
            });

            it('handles deep BASE_PATH', () => {
                const app = makeApp('/deep/nested/path');
                expect(getCodemagicUrl({}, null, false, app)).toBe(
                    '/deep/nested/path/api/codemagic-editor/codemagic.html',
                );
            });

            it('falls through to bare URL when BASE_PATH is empty', () => {
                const app = makeApp('');
                expect(getCodemagicUrl({}, null, false, app)).toBe('/api/codemagic-editor/codemagic.html');
            });

            it('respects composeUrl regardless of any (now-ignored) config.basePath', () => {
                // The plugin no longer reads config.basePath - composeUrl wins.
                const app = makeApp('/aplicaciones/medusa/exelearning');
                expect(getCodemagicUrl({ basePath: '/ignored' }, null, false, app)).toBe(
                    '/aplicaciones/medusa/exelearning/api/codemagic-editor/codemagic.html',
                );
            });
        });

        describe('Static mode (always wins over composeUrl)', () => {
            const expected = './libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html';
            const app = makeApp('/aplicaciones/medusa/exelearning');

            it('honours config.isStaticMode', () => {
                expect(getCodemagicUrl({ isStaticMode: true }, null, false)).toBe(expected);
                expect(getCodemagicUrl({ isStaticMode: true }, null, false, app)).toBe(expected);
            });

            it('honours config.isOfflineInstallation', () => {
                expect(getCodemagicUrl({ isOfflineInstallation: true }, null, false, app)).toBe(expected);
            });

            it('falls back to capabilities.storage.remote === false', () => {
                const capabilities = { storage: { remote: false } };
                expect(getCodemagicUrl({}, capabilities, false)).toBe(expected);
                expect(getCodemagicUrl({}, capabilities, false, app)).toBe(expected);
            });

            it('falls back to global staticMode flag', () => {
                expect(getCodemagicUrl({}, null, true)).toBe(expected);
                expect(getCodemagicUrl({}, null, true, app)).toBe(expected);
            });

            it('config flag takes priority over capabilities', () => {
                const capabilities = { storage: { remote: true } };
                expect(getCodemagicUrl({ isStaticMode: true }, capabilities, false, app)).toBe(expected);
            });

            it('capabilities take priority over global flag', () => {
                const capabilities = { storage: { remote: true } };
                expect(getCodemagicUrl({}, capabilities, true, app)).toBe(
                    '/aplicaciones/medusa/exelearning/api/codemagic-editor/codemagic.html',
                );
            });
        });
    });

    describe('Config parsing (JSON string handling)', () => {
        // The plugin parses config from string if needed (lines 73-76)
        function parseConfig(config) {
            if (typeof config === 'string') {
                try {
                    return JSON.parse(config);
                } catch (e) {
                    return null;
                }
            }
            return config;
        }

        it('should return object config as-is', () => {
            const config = { basePath: '/web/exe', isStaticMode: true };
            const result = parseConfig(config);
            expect(result).toEqual(config);
        });

        it('should parse valid JSON string config', () => {
            const config = '{"basePath":"/web/exe","isStaticMode":true}';
            const result = parseConfig(config);
            expect(result).toEqual({ basePath: '/web/exe', isStaticMode: true });
        });

        it('should return null for invalid JSON string', () => {
            const config = 'not valid json';
            const result = parseConfig(config);
            expect(result).toBeNull();
        });

        it('should return null for partial JSON string', () => {
            const config = '{"basePath":';
            const result = parseConfig(config);
            expect(result).toBeNull();
        });

        it('should handle null config', () => {
            const result = parseConfig(null);
            expect(result).toBeNull();
        });

        it('should handle undefined config', () => {
            const result = parseConfig(undefined);
            expect(result).toBeUndefined();
        });

        it('should handle empty string config', () => {
            const config = '';
            const result = parseConfig(config);
            expect(result).toBeNull(); // JSON.parse('') throws
        });
    });
});
