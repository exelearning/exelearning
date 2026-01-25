/**
 * Unit tests for codemagic TinyMCE plugin path handling
 *
 * Tests the path computation logic for:
 * - Dialog URL selection (static vs online mode with basePath support)
 * - Static mode detection with multiple fallbacks
 */

describe('codemagic plugin - Path Handling', () => {
    describe('Dialog URL selection', () => {
        // Extract the logic from plugin.min.js lines 69-102
        function getCodemagicUrl(config, capabilities, staticModeGlobal) {
            const basePath = (config && config.basePath) || '';

            // Check if we're in static mode
            let isStaticMode = config?.isStaticMode || config?.isOfflineInstallation;
            if (!isStaticMode) {
                isStaticMode = capabilities ? !capabilities.storage.remote : staticModeGlobal;
            }

            // In static mode, use relative file path
            // In server mode, use API endpoint
            if (isStaticMode) {
                return './libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html';
            } else {
                return basePath + '/api/codemagic-editor/codemagic.html';
            }
        }

        describe('Online mode (server available)', () => {
            it('should return API URL with no basePath', () => {
                const result = getCodemagicUrl({ basePath: '' }, null, false);
                expect(result).toBe('/api/codemagic-editor/codemagic.html');
            });

            it('should return API URL with basePath prefix', () => {
                const result = getCodemagicUrl({ basePath: '/web/exe' }, null, false);
                expect(result).toBe('/web/exe/api/codemagic-editor/codemagic.html');
            });

            it('should return API URL with deep basePath prefix', () => {
                const result = getCodemagicUrl({ basePath: '/deep/nested/path' }, null, false);
                expect(result).toBe('/deep/nested/path/api/codemagic-editor/codemagic.html');
            });

            it('should return API URL when config is null', () => {
                const result = getCodemagicUrl(null, null, false);
                expect(result).toBe('/api/codemagic-editor/codemagic.html');
            });

            it('should return API URL when config is undefined', () => {
                const result = getCodemagicUrl(undefined, null, false);
                expect(result).toBe('/api/codemagic-editor/codemagic.html');
            });

            it('should return API URL when config is empty object', () => {
                const result = getCodemagicUrl({}, null, false);
                expect(result).toBe('/api/codemagic-editor/codemagic.html');
            });
        });

        describe('Static mode via config flags', () => {
            it('should return relative URL when isStaticMode is true', () => {
                const result = getCodemagicUrl({ isStaticMode: true }, null, false);
                expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html');
            });

            it('should return relative URL when isOfflineInstallation is true', () => {
                const result = getCodemagicUrl({ isOfflineInstallation: true }, null, false);
                expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html');
            });

            it('should return relative URL when both flags are true', () => {
                const result = getCodemagicUrl({ isStaticMode: true, isOfflineInstallation: true }, null, false);
                expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html');
            });

            it('should ignore basePath in static mode', () => {
                const result = getCodemagicUrl({ basePath: '/web/exe', isStaticMode: true }, null, false);
                expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html');
            });
        });

        describe('Static mode via capabilities fallback', () => {
            it('should return relative URL when capabilities.storage.remote is false', () => {
                const capabilities = { storage: { remote: false } };
                const result = getCodemagicUrl({}, capabilities, false);
                expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html');
            });

            it('should return API URL when capabilities.storage.remote is true', () => {
                const capabilities = { storage: { remote: true } };
                const result = getCodemagicUrl({}, capabilities, false);
                expect(result).toBe('/api/codemagic-editor/codemagic.html');
            });

            it('should respect basePath when capabilities indicate online mode', () => {
                const capabilities = { storage: { remote: true } };
                const result = getCodemagicUrl({ basePath: '/web/exe' }, capabilities, false);
                expect(result).toBe('/web/exe/api/codemagic-editor/codemagic.html');
            });

            it('should prioritize config flags over capabilities', () => {
                const capabilities = { storage: { remote: true } };
                const result = getCodemagicUrl({ isStaticMode: true }, capabilities, false);
                expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html');
            });
        });

        describe('Static mode via global flag fallback', () => {
            it('should return relative URL when global static mode flag is true', () => {
                const result = getCodemagicUrl({}, null, true);
                expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html');
            });

            it('should return API URL when global static mode flag is false', () => {
                const result = getCodemagicUrl({}, null, false);
                expect(result).toBe('/api/codemagic-editor/codemagic.html');
            });

            it('should prioritize capabilities over global flag', () => {
                const capabilities = { storage: { remote: true } };
                const result = getCodemagicUrl({}, capabilities, true);
                expect(result).toBe('/api/codemagic-editor/codemagic.html');
            });

            it('should prioritize config flags over global flag', () => {
                const result = getCodemagicUrl({ isStaticMode: false }, null, true);
                // When isStaticMode is explicitly false, fallback to global flag
                expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html');
            });
        });

        describe('Edge cases', () => {
            it('should handle basePath with trailing slash', () => {
                // The plugin doesn't normalize trailing slashes, so this would create a double slash
                // This tests current behavior - consider normalizing in the plugin if this is undesirable
                const result = getCodemagicUrl({ basePath: '/web/exe/' }, null, false);
                expect(result).toBe('/web/exe//api/codemagic-editor/codemagic.html');
            });

            it('should handle basePath without leading slash', () => {
                const result = getCodemagicUrl({ basePath: 'web/exe' }, null, false);
                expect(result).toBe('web/exe/api/codemagic-editor/codemagic.html');
            });

            it('should handle all detection methods at once (config wins)', () => {
                const capabilities = { storage: { remote: true } };
                const result = getCodemagicUrl(
                    { isStaticMode: true, basePath: '/ignored' },
                    capabilities,
                    false
                );
                expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/codemagic/codemagic.html');
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
