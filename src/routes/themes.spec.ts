/**
 * Tests for Themes Routes
 *
 * These tests work with the actual theme files in the project.
 * Only base and site themes are served from the server.
 * User themes from .elpx files are stored client-side in Yjs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { themesRoutes, configure, resetDependencies } from './themes';
import * as fs from 'fs';

describe('Themes Routes', () => {
    let app: Elysia;

    beforeEach(() => {
        resetDependencies();
        app = new Elysia().use(themesRoutes);
    });

    afterEach(() => {
        resetDependencies();
    });

    describe('GET /api/themes/installed', () => {
        it('should return themes wrapper object', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.themes).toBeDefined();
            expect(Array.isArray(body.themes)).toBe(true);
        });

        it('should return at least one theme', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            expect(body.themes.length).toBeGreaterThan(0);
        });

        it('should include required theme properties', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            const theme = body.themes[0];

            expect(theme.name).toBeDefined();
            expect(theme.dirName).toBeDefined();
            expect(theme.displayName).toBeDefined();
            expect(theme.title).toBeDefined();
            expect(theme.url).toBeDefined();
            expect(theme.preview).toBeDefined();
            expect(theme.type).toBeDefined();
            expect(theme.version).toBeDefined();
            expect(theme.valid).toBe(true);
        });

        it('should include cssFiles array', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            const theme = body.themes[0];

            expect(Array.isArray(theme.cssFiles)).toBe(true);
            expect(theme.cssFiles.length).toBeGreaterThan(0);
        });

        it('should include js array', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            const theme = body.themes[0];

            expect(Array.isArray(theme.js)).toBe(true);
        });

        it('should include icons object', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            const theme = body.themes[0];

            expect(typeof theme.icons).toBe('object');
        });

        it('should have type as base or site only', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            for (const theme of body.themes) {
                expect(['base', 'site']).toContain(theme.type);
            }
        });

        it('should have theme URLs with version', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            const theme = body.themes[0];

            // URL should start with /v followed by version number
            expect(theme.url).toMatch(/^\/v[\d.]+/);
        });

        it('should return defaultTheme info', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            expect(body.defaultTheme).toBeDefined();
            expect(body.defaultTheme.type).toBeDefined();
            expect(body.defaultTheme.dirName).toBeDefined();
        });

        it('should return empty array when themes path does not exist', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath === 'public/files/perm/themes/base') return false;
                        return fs.existsSync(filePath);
                    },
                    readFileSync: fs.readFileSync,
                    readdirSync: fs.readdirSync,
                },
            });
            app = new Elysia().use(themesRoutes);

            const res = await app.handle(new Request('http://localhost/api/themes/installed'));
            const body = await res.json();

            expect(body.themes).toEqual([]);
        });
    });

    describe('GET /api/themes/installed/:themeId', () => {
        it('should return specific theme by ID', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed/base'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.dirName).toBe('base');
            expect(body.type).toBe('base');
        });

        it('should return 404 for non-existent theme', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed/non-existent-theme'));

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toBe('Not Found');
        });

        it('should include all theme properties', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed/base'));

            const body = await res.json();
            expect(body.name).toBeDefined();
            expect(body.dirName).toBe('base');
            expect(body.displayName).toBeDefined();
            expect(body.url).toBeDefined();
            expect(body.cssFiles).toBeDefined();
            expect(body.js).toBeDefined();
            expect(body.icons).toBeDefined();
        });
    });

    describe('GET /api/resources/theme/:themeName/bundle', () => {
        it('should return theme bundle with files', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/theme/base/bundle'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.themeName).toBe('base');
            expect(body.files).toBeDefined();
            expect(typeof body.files).toBe('object');
        });

        it('should include CSS file in bundle', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/theme/base/bundle'));

            const body = await res.json();
            // Should have at least style.css
            const hasStyleCss = Object.keys(body.files).some(f => f.endsWith('.css'));
            expect(hasStyleCss).toBe(true);
        });

        it('should return 404 for non-existent theme', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/theme/non-existent/bundle'));

            expect(res.status).toBe(404);
        });

        it('should encode files as base64', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/theme/base/bundle'));

            const body = await res.json();
            const firstFile = Object.values(body.files)[0] as string;
            // Base64 strings should not contain special characters except +, /, =
            expect(firstFile).toMatch(/^[A-Za-z0-9+/=]+$/);
        });
    });

    describe('version handling', () => {
        it('should use APP_VERSION env var when set', async () => {
            configure({
                getEnv: (key: string) => (key === 'APP_VERSION' ? 'v1.2.3' : undefined),
            });
            app = new Elysia().use(themesRoutes);

            const res = await app.handle(new Request('http://localhost/api/themes/installed'));
            const body = await res.json();

            if (body.themes.length > 0) {
                expect(body.themes[0].url).toContain('/v1.2.3/');
            }
        });

        it('should fall back to package.json version', async () => {
            configure({
                getEnv: () => undefined,
            });
            app = new Elysia().use(themesRoutes);

            const res = await app.handle(new Request('http://localhost/api/themes/installed'));
            const body = await res.json();

            if (body.themes.length > 0) {
                // Should have some version in URL
                expect(body.themes[0].url).toMatch(/^\/v[\d.]+/);
            }
        });

        it('should fall back to v0.0.0 when package.json is invalid', async () => {
            configure({
                getEnv: () => undefined,
                fs: {
                    existsSync: (p: string) => {
                        if (p.includes('package.json')) return true;
                        return fs.existsSync(p);
                    },
                    readFileSync: (p: string, encoding?: BufferEncoding) => {
                        if (typeof p === 'string' && p.includes('package.json')) {
                            return 'invalid json {{{';
                        }
                        return fs.readFileSync(p, encoding);
                    },
                    readdirSync: fs.readdirSync,
                },
            });
            app = new Elysia().use(themesRoutes);

            const res = await app.handle(new Request('http://localhost/api/themes/installed'));
            const body = await res.json();

            if (body.themes.length > 0) {
                expect(body.themes[0].url).toContain('/v0.0.0/');
            }
        });

        it('should fall back to v0.0.0 when package.json does not exist', async () => {
            configure({
                getEnv: () => undefined,
                fs: {
                    existsSync: (p: string) => {
                        if (typeof p === 'string' && p.includes('package.json')) return false;
                        return fs.existsSync(p);
                    },
                    readFileSync: fs.readFileSync,
                    readdirSync: fs.readdirSync,
                },
            });
            app = new Elysia().use(themesRoutes);

            const res = await app.handle(new Request('http://localhost/api/themes/installed'));
            const body = await res.json();

            if (body.themes.length > 0) {
                expect(body.themes[0].url).toContain('/v0.0.0/');
            }
        });
    });

    describe('edge cases', () => {
        it('should handle theme with no CSS files (falls back to style.css)', async () => {
            configure({
                fs: {
                    existsSync: fs.existsSync,
                    readFileSync: fs.readFileSync,
                    readdirSync: (dirPath: string, options?: { withFileTypes: boolean }) => {
                        // Return empty list for CSS scan
                        if (
                            typeof dirPath === 'string' &&
                            dirPath.includes('themes/base/') &&
                            !dirPath.includes('icons')
                        ) {
                            const entries = fs.readdirSync(dirPath, options);
                            // Filter out CSS files to simulate no CSS
                            if (Array.isArray(entries) && entries.length > 0 && typeof entries[0] === 'object') {
                                return (entries as fs.Dirent[]).filter(e => !e.name.endsWith('.css'));
                            }
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                },
            });
            app = new Elysia().use(themesRoutes);

            const res = await app.handle(new Request('http://localhost/api/themes/installed'));
            const body = await res.json();

            // At least one theme should have style.css as fallback
            const theme = body.themes.find((t: { cssFiles: string[] }) => t.cssFiles.includes('style.css'));
            expect(theme).toBeDefined();
        });

        it('should handle theme with no icons directory', async () => {
            configure({
                fs: {
                    existsSync: (p: string) => {
                        if (typeof p === 'string' && p.includes('/icons')) return false;
                        return fs.existsSync(p);
                    },
                    readFileSync: fs.readFileSync,
                    readdirSync: fs.readdirSync,
                },
            });
            app = new Elysia().use(themesRoutes);

            const res = await app.handle(new Request('http://localhost/api/themes/installed'));
            const body = await res.json();

            expect(body.themes.length).toBeGreaterThan(0);
            // Themes should have empty icons object
            expect(typeof body.themes[0].icons).toBe('object');
        });

        it('should handle non-directory entries in themes folder', async () => {
            configure({
                fs: {
                    existsSync: fs.existsSync,
                    readFileSync: fs.readFileSync,
                    readdirSync: (dirPath: string, options?: { withFileTypes: boolean }) => {
                        const entries = fs.readdirSync(dirPath, options);
                        if (typeof dirPath === 'string' && dirPath === 'public/files/perm/themes/base') {
                            // Add a fake file entry
                            if (Array.isArray(entries) && options?.withFileTypes) {
                                const fakeFile = {
                                    name: 'not-a-directory.txt',
                                    isDirectory: () => false,
                                    isFile: () => true,
                                };
                                return [...(entries as fs.Dirent[]), fakeFile as fs.Dirent];
                            }
                        }
                        return entries;
                    },
                },
            });
            app = new Elysia().use(themesRoutes);

            const res = await app.handle(new Request('http://localhost/api/themes/installed'));
            const body = await res.json();

            // Should not crash and should return valid themes
            expect(body.themes.length).toBeGreaterThan(0);
        });

        it('should handle hidden directories (starting with dot)', async () => {
            configure({
                fs: {
                    existsSync: fs.existsSync,
                    readFileSync: fs.readFileSync,
                    readdirSync: (dirPath: string, options?: { withFileTypes: boolean }) => {
                        const entries = fs.readdirSync(dirPath, options);
                        if (typeof dirPath === 'string' && dirPath === 'public/files/perm/themes/base') {
                            if (Array.isArray(entries) && options?.withFileTypes) {
                                const hiddenDir = {
                                    name: '.hidden-theme',
                                    isDirectory: () => true,
                                    isFile: () => false,
                                };
                                return [...(entries as fs.Dirent[]), hiddenDir as fs.Dirent];
                            }
                        }
                        return entries;
                    },
                },
            });
            app = new Elysia().use(themesRoutes);

            const res = await app.handle(new Request('http://localhost/api/themes/installed'));
            const body = await res.json();

            // Should not include hidden directory
            const hiddenTheme = body.themes.find((t: { dirName: string }) => t.dirName === '.hidden-theme');
            expect(hiddenTheme).toBeUndefined();
        });

        it('should return 500 when theme config parsing fails', async () => {
            // Create a mock that makes parseThemeConfig throw and return null
            configure({
                fs: {
                    existsSync: (p: string) => {
                        if (typeof p === 'string' && p.includes('malformed-theme')) {
                            return true;
                        }
                        return fs.existsSync(p);
                    },
                    readFileSync: (p: string, encoding?: BufferEncoding) => {
                        if (typeof p === 'string' && p.includes('malformed-theme/config.xml')) {
                            return '<theme><name>Test</name></theme>';
                        }
                        return fs.readFileSync(p, encoding);
                    },
                    readdirSync: (dirPath: string, options?: { withFileTypes: boolean }) => {
                        // Make readdirSync throw for the theme directory (inside parseThemeConfig try block)
                        if (typeof dirPath === 'string' && dirPath.includes('malformed-theme')) {
                            throw new Error('Cannot read directory');
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                },
            });
            app = new Elysia().use(themesRoutes);

            // Try to get the specific malformed theme
            const res = await app.handle(new Request('http://localhost/api/themes/installed/malformed-theme'));

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error).toBe('Parse Error');
        });

        it('should handle scanThemeFiles when path does not exist', async () => {
            // Test the scanThemeFiles early return when path doesn't exist
            configure({
                fs: {
                    existsSync: (p: string) => {
                        // config.xml exists
                        if (typeof p === 'string' && p.includes('empty-theme/config.xml')) {
                            return true;
                        }
                        // Theme directory for scanning CSS/JS doesn't exist
                        if (typeof p === 'string' && p.includes('empty-theme') && !p.includes('config.xml')) {
                            return false;
                        }
                        return fs.existsSync(p);
                    },
                    readFileSync: (p: string, encoding?: BufferEncoding) => {
                        if (typeof p === 'string' && p.includes('empty-theme/config.xml')) {
                            return '<theme><name>Empty Theme</name><version>1.0</version></theme>';
                        }
                        return fs.readFileSync(p, encoding);
                    },
                    readdirSync: (dirPath: string, options?: { withFileTypes: boolean }) => {
                        if (typeof dirPath === 'string' && dirPath === 'public/files/perm/themes/base') {
                            return [
                                {
                                    name: 'empty-theme',
                                    isDirectory: () => true,
                                    isFile: () => false,
                                },
                            ] as fs.Dirent[];
                        }
                        // For theme directory scanning, return empty
                        if (typeof dirPath === 'string' && dirPath.includes('empty-theme')) {
                            return [] as fs.Dirent[];
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                },
            });
            app = new Elysia().use(themesRoutes);

            const res = await app.handle(new Request('http://localhost/api/themes/installed'));
            const body = await res.json();

            const emptyTheme = body.themes.find((t: { dirName: string }) => t.dirName === 'empty-theme');
            expect(emptyTheme).toBeDefined();
            // Should fall back to style.css when no CSS files found
            expect(emptyTheme?.cssFiles).toContain('style.css');
        });
    });
});
