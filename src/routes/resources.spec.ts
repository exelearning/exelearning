/**
 * Tests for Resources Routes
 *
 * These tests verify the API endpoints that provide file listings
 * for themes, iDevices, and libraries for client-side exports.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { resourcesRoutes, configure, resetDependencies } from './resources';
import * as fs from 'fs';

describe('Resources Routes', () => {
    let app: Elysia;

    beforeEach(() => {
        resetDependencies();
        app = new Elysia().use(resourcesRoutes);
    });

    afterEach(() => {
        resetDependencies();
    });

    describe('GET /api/resources/theme/:themeName', () => {
        it('should return theme files for existing theme', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/theme/base'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(Array.isArray(body)).toBe(true);
            expect(body.length).toBeGreaterThan(0);
        });

        it('should return files with path and url properties', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/theme/base'));

            const body = await res.json();
            const file = body[0];

            expect(file.path).toBeDefined();
            expect(file.url).toBeDefined();
            expect(typeof file.path).toBe('string');
            expect(typeof file.url).toBe('string');
        });

        it('should have URLs with version prefix', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/theme/base'));

            const body = await res.json();
            const file = body[0];

            expect(file.url).toMatch(/^\/v[\d.]+/);
        });

        it('should return 404 for non-existent theme', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/resources/theme/non-existent-theme-xyz-123'),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toBe('Not Found');
        });

        it('should include CSS files', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/theme/base'));

            const body = await res.json();
            const cssFiles = body.filter((f: any) => f.path.endsWith('.css'));

            expect(cssFiles.length).toBeGreaterThan(0);
        });

        it('should include subdirectory files', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/theme/flux'));

            const body = await res.json();
            const imgFiles = body.filter((f: any) => f.path.startsWith('img/'));

            expect(imgFiles.length).toBeGreaterThan(0);
        });

        it('should check user themes first', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath === 'public/files/perm/themes/users/custom-theme') return true;
                        if (filePath === 'public/files/perm/themes/base/custom-theme') return false;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: (dirPath: any, options?: any) => {
                        if (typeof dirPath === 'string' && dirPath.includes('users/custom-theme')) {
                            return [
                                { name: 'style.css', isFile: () => true, isDirectory: () => false },
                            ] as unknown as fs.Dirent[];
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/theme/custom-theme'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body[0].url).toContain('/themes/users/custom-theme');
        });

        it('should return admin themes from FILES_DIR', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        // User and base themes don't exist
                        if (filePath === 'public/files/perm/themes/users/site-custom-theme') return false;
                        if (filePath === 'public/files/perm/themes/base/site-custom-theme') return false;
                        // Site theme exists
                        if (filePath === '/tmp/test-files/themes/site/site-custom-theme') return true;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: (dirPath: any, options?: any) => {
                        if (typeof dirPath === 'string' && dirPath.includes('themes/site/site-custom-theme')) {
                            return [
                                { name: 'style.css', isFile: () => true, isDirectory: () => false },
                                { name: 'config.xml', isFile: () => true, isDirectory: () => false },
                            ] as unknown as fs.Dirent[];
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
                getEnv: (key: string) => {
                    if (key === 'ELYSIA_FILES_DIR' || key === 'FILES_DIR') return '/tmp/test-files';
                    return process.env[key];
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/theme/site-custom-theme'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.length).toBe(2);
            // Site themes use /site-files/themes/ URL path
            expect(body[0].url).toContain('/site-files/themes/site-custom-theme');
        });
    });

    describe('GET /api/resources/idevice/:ideviceType', () => {
        it('should return iDevice export files', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/idevice/text'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(Array.isArray(body)).toBe(true);
        });

        it('should normalize idevice type (remove Idevice suffix)', async () => {
            // Both should work - with and without suffix
            const res1 = await app.handle(new Request('http://localhost/api/resources/idevice/text'));
            const res2 = await app.handle(new Request('http://localhost/api/resources/idevice/TextIdevice'));

            // Both should resolve to same iDevice status
            expect(res1.status).toBe(res2.status);
        });

        it('should return 404 for non-existent iDevice', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/resources/idevice/non-existent-idevice-xyz'),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            // Empty array for 404 iDevices (many don't have export files)
            expect(Array.isArray(body)).toBe(true);
            expect(body.length).toBe(0);
        });

        it('should include JS and CSS files', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/idevice/text'));

            const body = await res.json();

            if (body.length > 0) {
                const jsFiles = body.filter((f: any) => f.path.endsWith('.js'));
                const cssFiles = body.filter((f: any) => f.path.endsWith('.css'));

                expect(jsFiles.length + cssFiles.length).toBeGreaterThan(0);
            }
        });

        it('should have URLs with version and correct path', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/idevice/text'));

            const body = await res.json();

            if (body.length > 0) {
                const file = body[0];
                expect(file.url).toMatch(/^\/v[\d.]+/);
                expect(file.url).toContain('/idevices/');
                expect(file.url).toContain('/export/');
            }
        });
    });

    describe('GET /api/resources/libs/base', () => {
        it('should return base library files', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/libs/base'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(Array.isArray(body)).toBe(true);
        });

        it('should include jQuery', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/libs/base'));

            const body = await res.json();
            const jqueryFile = body.find((f: any) => f.path.includes('jquery'));

            expect(jqueryFile).toBeDefined();
        });

        it('should have URLs with version prefix', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/libs/base'));

            const body = await res.json();

            if (body.length > 0) {
                expect(body[0].url).toMatch(/^\/v[\d.]+/);
            }
        });

        it('should only return files that exist', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        // jQuery exists, jQuery UI doesn't
                        if (filePath.includes('jquery-ui')) return false;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: fs.readdirSync,
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/libs/base'));

            const body = await res.json();
            const jqueryUiFile = body.find((f: any) => f.path.includes('jquery-ui'));

            expect(jqueryUiFile).toBeUndefined();
        });
    });

    describe('GET /api/resources/libs/scorm', () => {
        it('should return empty array if scorm directory does not exist', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath.includes('common/scorm')) return false;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: fs.readdirSync,
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/libs/scorm'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual([]);
        });

        it('should return SCORM files if directory exists', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath === 'public/app/common/scorm') return true;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: (dirPath: any, options?: any) => {
                        if (typeof dirPath === 'string' && dirPath.includes('common/scorm')) {
                            return [
                                { name: 'SCORM_API.js', isFile: () => true, isDirectory: () => false },
                            ] as unknown as fs.Dirent[];
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/libs/scorm'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.length).toBe(1);
            expect(body[0].path).toBe('SCORM_API.js');
        });
    });

    describe('GET /api/resources/libs/epub', () => {
        it('should return empty array if epub directory does not exist', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath.includes('common/epub')) return false;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: fs.readdirSync,
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/libs/epub'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual([]);
        });
    });

    describe('GET /api/resources/libs/directory/:libraryName', () => {
        it('should return 404 for non-existent library', async () => {
            const res = await app.handle(new Request('http://localhost/api/resources/libs/directory/non-existent-lib'));

            expect(res.status).toBe(404);
        });

        it('should check common path first, then libs path', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        // Not in common, but exists in libs
                        if (filePath === 'public/app/common/jquery') return false;
                        if (filePath === 'public/libs/jquery') return true;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: (dirPath: any, options?: any) => {
                        if (typeof dirPath === 'string' && dirPath === 'public/libs/jquery') {
                            return [
                                { name: 'jquery.min.js', isFile: () => true, isDirectory: () => false },
                            ] as unknown as fs.Dirent[];
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/libs/directory/jquery'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body[0].url).toContain('/libs/jquery');
        });

        it('should prefer common path over libs path', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        // Exists in common
                        if (filePath === 'public/app/common/exe_effects') return true;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: (dirPath: any, options?: any) => {
                        if (typeof dirPath === 'string' && dirPath === 'public/app/common/exe_effects') {
                            return [
                                { name: 'exe_effects.js', isFile: () => true, isDirectory: () => false },
                            ] as unknown as fs.Dirent[];
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/libs/directory/exe_effects'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body[0].url).toContain('/app/common/exe_effects');
        });
    });

    describe('GET /api/resources/schemas/:format', () => {
        it('should return empty array if schemas directory does not exist', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath.includes('schemas')) return false;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: fs.readdirSync,
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/schemas/scorm12'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual([]);
        });

        it('should return schema files if directory exists', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath === 'public/files/perm/schemas/scorm12') return true;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: (dirPath: any, options?: any) => {
                        if (typeof dirPath === 'string' && dirPath.includes('schemas/scorm12')) {
                            return [
                                { name: 'imscp.xsd', isFile: () => true, isDirectory: () => false },
                                { name: 'adlcp.xsd', isFile: () => true, isDirectory: () => false },
                            ] as unknown as fs.Dirent[];
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/schemas/scorm12'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.length).toBe(2);
        });
    });

    describe('APP_VERSION environment variable', () => {
        it('should use APP_VERSION when set', async () => {
            configure({
                getEnv: (key: string) => (key === 'APP_VERSION' ? 'v99.99.99' : undefined),
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/theme/base'));
            const body = await res.json();

            if (body.length > 0) {
                expect(body[0].url).toContain('/v99.99.99/');
            }
        });
    });

    describe('BASE_PATH environment variable', () => {
        it('should include BASE_PATH in URLs when set', async () => {
            configure({
                getEnv: (key: string) => {
                    if (key === 'BASE_PATH') return '/web/exelearning';
                    return undefined;
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/theme/base'));
            const body = await res.json();

            if (body.length > 0) {
                expect(body[0].url).toContain('/web/exelearning/');
            }
        });
    });

    describe('scanDirectory', () => {
        it('should skip hidden files and directories', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath === 'public/files/perm/themes/base/test-hidden') return true;
                        if (filePath === 'public/files/perm/themes/users/test-hidden') return false;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: (dirPath: any, options?: any) => {
                        if (typeof dirPath === 'string' && dirPath.includes('test-hidden')) {
                            return [
                                { name: '.hidden', isFile: () => true, isDirectory: () => false },
                                { name: '.DS_Store', isFile: () => true, isDirectory: () => false },
                                { name: 'visible.css', isFile: () => true, isDirectory: () => false },
                            ] as unknown as fs.Dirent[];
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/theme/test-hidden'));

            const body = await res.json();

            expect(body.length).toBe(1);
            expect(body[0].path).toBe('visible.css');
        });

        it('should recursively scan subdirectories', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath === 'public/files/perm/themes/base/test-recursive') return true;
                        if (filePath === 'public/files/perm/themes/users/test-recursive') return false;
                        // Also need to say the img subdirectory exists for the recursive call
                        if (filePath.includes('test-recursive/img')) return true;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: (dirPath: any, options?: any) => {
                        if (typeof dirPath === 'string') {
                            if (dirPath.endsWith('test-recursive')) {
                                return [
                                    { name: 'style.css', isFile: () => true, isDirectory: () => false },
                                    { name: 'img', isFile: () => false, isDirectory: () => true },
                                ] as unknown as fs.Dirent[];
                            }
                            if (dirPath.includes('test-recursive') && dirPath.endsWith('img')) {
                                return [
                                    { name: 'logo.png', isFile: () => true, isDirectory: () => false },
                                ] as unknown as fs.Dirent[];
                            }
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/theme/test-recursive'));

            const body = await res.json();

            expect(body.length).toBe(2);
            expect(body.map((f: any) => f.path)).toContain('style.css');
            expect(body.map((f: any) => f.path)).toContain('img/logo.png');
        });

        it('should handle readdirSync errors gracefully', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath === 'public/files/perm/themes/base/error-theme') return true;
                        if (filePath === 'public/files/perm/themes/users/error-theme') return false;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: (dirPath: any, options?: any) => {
                        if (typeof dirPath === 'string' && dirPath.includes('error-theme')) {
                            throw new Error('Permission denied');
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/theme/error-theme'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual([]);
        });
    });

    describe('getAppVersion fallback', () => {
        it('should return v0.0.0 when package.json cannot be read', async () => {
            configure({
                fs: {
                    existsSync: fs.existsSync,
                    readdirSync: fs.readdirSync,
                    statSync: fs.statSync,
                    readFileSync: (filePath: string) => {
                        if (filePath === 'package.json') {
                            throw new Error('File not found');
                        }
                        return fs.readFileSync(filePath, 'utf-8');
                    },
                },
                getEnv: () => undefined,
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/theme/base'));
            const body = await res.json();

            if (body.length > 0) {
                expect(body[0].url).toContain('/v0.0.0/');
            }
        });
    });

    describe('iDevice type normalization variations', () => {
        it('should try kebab-case variation for iDevice', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        // Only kebab-case version exists
                        if (filePath.includes('idevices/users')) return false;
                        if (filePath === 'public/files/perm/idevices/base/camelcase/export') return false;
                        if (filePath === 'public/files/perm/idevices/base/camel-case/export') return true;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: (dirPath: any, options?: any) => {
                        if (typeof dirPath === 'string' && dirPath.includes('camel-case/export')) {
                            return [
                                { name: 'script.js', isFile: () => true, isDirectory: () => false },
                            ] as unknown as fs.Dirent[];
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/idevice/camelCase'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.length).toBe(1);
        });
    });

    describe('GET /api/resources/content-css', () => {
        it('should return CSS files from workarea directory', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath === 'public/style/workarea') return true;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: (dirPath: any, options?: any) => {
                        if (typeof dirPath === 'string' && dirPath.includes('style/workarea')) {
                            return [
                                { name: 'base.css', isFile: () => true, isDirectory: () => false },
                                { name: 'main.css', isFile: () => true, isDirectory: () => false },
                                { name: 'style.js', isFile: () => true, isDirectory: () => false }, // Should be filtered
                            ] as unknown as fs.Dirent[];
                        }
                        return fs.readdirSync(dirPath, options);
                    },
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/content-css'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.length).toBe(2);
            expect(body[0].path).toBe('content/css/base.css');
            expect(body[1].path).toBe('content/css/main.css');
        });

        it('should return empty array if workarea directory does not exist', async () => {
            configure({
                fs: {
                    existsSync: (filePath: string) => {
                        if (filePath === 'public/style/workarea') return false;
                        return fs.existsSync(filePath);
                    },
                    readdirSync: fs.readdirSync,
                    statSync: fs.statSync,
                    readFileSync: fs.readFileSync,
                },
            });
            app = new Elysia().use(resourcesRoutes);

            const res = await app.handle(new Request('http://localhost/api/resources/content-css'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual([]);
        });
    });

    describe('Bundle Endpoints', () => {
        describe('GET /api/resources/bundle/manifest', () => {
            it('should return 404 if manifest does not exist', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('bundles') && filePath.includes('manifest.json')) return false;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: fs.readdirSync,
                        statSync: fs.statSync,
                        readFileSync: fs.readFileSync,
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(new Request('http://localhost/api/resources/bundle/manifest'));

                expect(res.status).toBe(404);
                const body = await res.json();
                expect(body.error).toBe('Not Found');
            });

            it('should return manifest JSON when it exists', async () => {
                const mockManifest = {
                    buildVersion: 'v0.0.0-alpha',
                    builtAt: '2024-01-01T00:00:00.000Z',
                    themes: { base: { hash: 'abc123' } },
                };

                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('bundles') && filePath.includes('manifest.json')) return true;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: fs.readdirSync,
                        statSync: fs.statSync,
                        readFileSync: (filePath: string) => {
                            if (filePath.includes('manifest.json')) {
                                return JSON.stringify(mockManifest);
                            }
                            return fs.readFileSync(filePath, 'utf-8');
                        },
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(new Request('http://localhost/api/resources/bundle/manifest'));

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.buildVersion).toBe('v0.0.0-alpha');
                expect(body.themes.base.hash).toBe('abc123');
                // runtimeVersion is added by the API from APP_VERSION or package.json
                expect(body.runtimeVersion).toBeDefined();
            });

            it('should return 500 if manifest is invalid JSON', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('bundles') && filePath.includes('manifest.json')) return true;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: fs.readdirSync,
                        statSync: fs.statSync,
                        readFileSync: (filePath: string) => {
                            if (filePath.includes('manifest.json')) {
                                return 'invalid json {{{';
                            }
                            return fs.readFileSync(filePath, 'utf-8');
                        },
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(new Request('http://localhost/api/resources/bundle/manifest'));

                expect(res.status).toBe(500);
                const body = await res.json();
                expect(body.error).toBe('Internal Error');
            });
        });

        describe('GET /api/resources/bundle/theme/:themeName', () => {
            it('should return 404 if theme bundle does not exist', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('bundles') && filePath.includes('.zip')) return false;
                            if (filePath.includes('themes/users')) return false;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: fs.readdirSync,
                        statSync: fs.statSync,
                        readFileSync: fs.readFileSync,
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(new Request('http://localhost/api/resources/bundle/theme/nonexistent'));

                expect(res.status).toBe(404);
                const body = await res.json();
                expect(body.error).toBe('Not Found');
            });

            it('should return 404 if user theme is empty', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('bundles')) return false;
                            if (filePath === 'public/files/perm/themes/users/empty-theme') return true;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: (dirPath: any, options?: any) => {
                            if (typeof dirPath === 'string' && dirPath.includes('users/empty-theme')) {
                                return [] as unknown as fs.Dirent[];
                            }
                            return fs.readdirSync(dirPath, options);
                        },
                        statSync: fs.statSync,
                        readFileSync: fs.readFileSync,
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(new Request('http://localhost/api/resources/bundle/theme/empty-theme'));

                expect(res.status).toBe(404);
                const body = await res.json();
                expect(body.message).toContain('empty');
            });

            it('should generate ZIP on-the-fly for user themes', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('bundles')) return false;
                            if (filePath === 'public/files/perm/themes/users/user-theme') return true;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: (dirPath: any, options?: any) => {
                            if (typeof dirPath === 'string' && dirPath.includes('users/user-theme')) {
                                return [
                                    { name: 'style.css', isFile: () => true, isDirectory: () => false },
                                ] as unknown as fs.Dirent[];
                            }
                            return fs.readdirSync(dirPath, options);
                        },
                        statSync: fs.statSync,
                        readFileSync: (filePath: string) => {
                            if (filePath.includes('user-theme/style.css')) {
                                return Buffer.from('body { color: red; }');
                            }
                            return fs.readFileSync(filePath, 'utf-8');
                        },
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(new Request('http://localhost/api/resources/bundle/theme/user-theme'));

                expect(res.status).toBe(200);
                expect(res.headers.get('content-type')).toBe('application/zip');
                expect(res.headers.get('cache-control')).toContain('private');
            });

            it('should skip files that cannot be read for user themes', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('bundles')) return false;
                            if (filePath === 'public/files/perm/themes/users/theme-with-error') return true;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: (dirPath: any, options?: any) => {
                            if (typeof dirPath === 'string' && dirPath.includes('theme-with-error')) {
                                return [
                                    { name: 'style.css', isFile: () => true, isDirectory: () => false },
                                    { name: 'broken.css', isFile: () => true, isDirectory: () => false },
                                ] as unknown as fs.Dirent[];
                            }
                            return fs.readdirSync(dirPath, options);
                        },
                        statSync: fs.statSync,
                        readFileSync: (filePath: string) => {
                            if (filePath.includes('style.css')) {
                                return Buffer.from('body {}');
                            }
                            if (filePath.includes('broken.css')) {
                                throw new Error('Permission denied');
                            }
                            return fs.readFileSync(filePath, 'utf-8');
                        },
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(
                    new Request('http://localhost/api/resources/bundle/theme/theme-with-error'),
                );

                // Should succeed (skips broken file)
                expect(res.status).toBe(200);
                expect(res.headers.get('content-type')).toBe('application/zip');
            });

            it('should generate ZIP on-the-fly for admin themes', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            // No prebuilt bundle
                            if (filePath.includes('bundles')) return false;
                            // No user theme
                            if (filePath.includes('themes/users')) return false;
                            // Site theme exists
                            if (filePath === '/tmp/test-files/themes/site/site-theme') return true;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: (dirPath: any, options?: any) => {
                            if (typeof dirPath === 'string' && dirPath.includes('themes/site/site-theme')) {
                                return [
                                    { name: 'style.css', isFile: () => true, isDirectory: () => false },
                                    { name: 'config.xml', isFile: () => true, isDirectory: () => false },
                                ] as unknown as fs.Dirent[];
                            }
                            return fs.readdirSync(dirPath, options);
                        },
                        statSync: fs.statSync,
                        readFileSync: (filePath: string) => {
                            if (filePath.includes('site-theme/style.css')) {
                                return Buffer.from('body { background: blue; }');
                            }
                            if (filePath.includes('site-theme/config.xml')) {
                                return Buffer.from('<theme><name>Site Theme</name></theme>');
                            }
                            return fs.readFileSync(filePath, 'utf-8');
                        },
                    },
                    getEnv: (key: string) => {
                        if (key === 'ELYSIA_FILES_DIR' || key === 'FILES_DIR') return '/tmp/test-files';
                        return process.env[key];
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(new Request('http://localhost/api/resources/bundle/theme/site-theme'));

                expect(res.status).toBe(200);
                expect(res.headers.get('content-type')).toBe('application/zip');
                expect(res.headers.get('cache-control')).toContain('private');
            });

            it('should return 404 if site theme is empty', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('bundles')) return false;
                            if (filePath.includes('themes/users')) return false;
                            if (filePath === '/tmp/test-files/themes/site/empty-site-theme') return true;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: (dirPath: any, options?: any) => {
                            if (typeof dirPath === 'string' && dirPath.includes('empty-site-theme')) {
                                return [] as unknown as fs.Dirent[];
                            }
                            return fs.readdirSync(dirPath, options);
                        },
                        statSync: fs.statSync,
                        readFileSync: fs.readFileSync,
                    },
                    getEnv: (key: string) => {
                        if (key === 'ELYSIA_FILES_DIR' || key === 'FILES_DIR') return '/tmp/test-files';
                        return process.env[key];
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(
                    new Request('http://localhost/api/resources/bundle/theme/empty-site-theme'),
                );

                expect(res.status).toBe(404);
                const body = await res.json();
                expect(body.message).toContain('empty');
            });
        });

        describe('GET /api/resources/bundle/idevices', () => {
            it('should return 404 if idevices bundle does not exist', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('idevices.zip')) return false;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: fs.readdirSync,
                        statSync: fs.statSync,
                        readFileSync: fs.readFileSync,
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(new Request('http://localhost/api/resources/bundle/idevices'));

                expect(res.status).toBe(404);
                const body = await res.json();
                expect(body.error).toBe('Not Found');
            });
        });

        describe('GET /api/resources/bundle/libs', () => {
            it('should return 404 if libs bundle does not exist', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('libs.zip')) return false;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: fs.readdirSync,
                        statSync: fs.statSync,
                        readFileSync: fs.readFileSync,
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(new Request('http://localhost/api/resources/bundle/libs'));

                expect(res.status).toBe(404);
                const body = await res.json();
                expect(body.error).toBe('Not Found');
            });
        });

        describe('GET /api/resources/bundle/common', () => {
            it('should return 404 if common bundle does not exist', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('common.zip')) return false;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: fs.readdirSync,
                        statSync: fs.statSync,
                        readFileSync: fs.readFileSync,
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(new Request('http://localhost/api/resources/bundle/common'));

                expect(res.status).toBe(404);
                const body = await res.json();
                expect(body.error).toBe('Not Found');
            });
        });

        describe('GET /api/resources/bundle/content-css', () => {
            it('should return 404 if content-css bundle does not exist', async () => {
                configure({
                    fs: {
                        existsSync: (filePath: string) => {
                            if (filePath.includes('content-css.zip')) return false;
                            return fs.existsSync(filePath);
                        },
                        readdirSync: fs.readdirSync,
                        statSync: fs.statSync,
                        readFileSync: fs.readFileSync,
                    },
                });
                app = new Elysia().use(resourcesRoutes);

                const res = await app.handle(new Request('http://localhost/api/resources/bundle/content-css'));

                expect(res.status).toBe(404);
                const body = await res.json();
                expect(body.error).toBe('Not Found');
            });
        });
    });
});
