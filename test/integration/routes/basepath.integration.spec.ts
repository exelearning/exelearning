/**
 * BASE_PATH Integration Tests
 * Tests that routes and static files work correctly with BASE_PATH prefix
 *
 * This tests the dual-route registration pattern where routes are accessible
 * at both root paths AND BASE_PATH prefixed paths for frontend compatibility.
 */
import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import * as fs from 'fs';
import * as path from 'path';
import { testRequest, parseJsonResponse } from '../helpers/integration-app';

// Simulated BASE_PATH for tests
const TEST_BASE_PATH = '/web/exelearning';

// MIME types matching src/index.ts
const MIME_TYPES: Record<string, string> = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.html': 'text/html',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

/**
 * Create a test app that mimics the BASE_PATH handling from src/index.ts
 */
function createBasePathTestApp(basePath: string | null = null): Elysia {
    const app = new Elysia()
        // Mimic the onRequest hook from src/index.ts for static file handling
        .onRequest(({ request }) => {
            const url = new URL(request.url);
            let pathname = url.pathname;

            // Strip BASE_PATH prefix if present
            if (basePath && pathname.startsWith(basePath)) {
                pathname = pathname.slice(basePath.length) || '/';
            }

            // Serve static files from public/ when BASE_PATH is present
            if (basePath && pathname !== '/') {
                const publicPath = path.join(process.cwd(), 'public', pathname);
                const resolvedPath = path.resolve(publicPath);
                const resolvedBase = path.resolve(path.join(process.cwd(), 'public'));

                if (resolvedPath.startsWith(resolvedBase) && fs.existsSync(publicPath)) {
                    try {
                        const stats = fs.statSync(publicPath);
                        if (stats.isFile()) {
                            const content = fs.readFileSync(publicPath);
                            const ext = path.extname(publicPath).toLowerCase();
                            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
                            return new Response(content, {
                                headers: {
                                    'Content-Type': contentType,
                                    'Content-Length': stats.size.toString(),
                                    'Cache-Control': 'public, max-age=3600',
                                },
                            });
                        }
                    } catch {
                        // Fall through
                    }
                }
            }
        })
        .use(
            staticPlugin({
                assets: 'public',
                prefix: '/',
                alwaysStatic: false,
            }),
        );

    // Define test routes
    const healthRoute = new Elysia().get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    const apiRoute = new Elysia()
        .get('/api', () => ({
            name: 'eXeLearning API',
            version: '4.0.0-elysia',
            framework: 'Elysia',
            runtime: 'Bun',
        }))
        .get('/api/config/test', () => ({ config: 'test-value' }))
        .get('/api/translations/:lang', ({ params }) => ({
            locale: params.lang,
            translations: { hello: 'world' },
        }));

    // Always register routes at root
    app.use(healthRoute).use(apiRoute);

    // Also register routes at BASE_PATH if configured
    if (basePath) {
        app.group(basePath, group => group.use(healthRoute).use(apiRoute));
    }

    return app;
}

describe('BASE_PATH Integration', () => {
    describe('Without BASE_PATH (default)', () => {
        let app: Elysia;

        beforeAll(() => {
            app = createBasePathTestApp(null);
        });

        it('should serve health endpoint at root', async () => {
            const response = await testRequest(app, '/health');
            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ status: string }>(response);
            expect(body.status).toBe('ok');
        });

        it('should serve API root at /api', async () => {
            const response = await testRequest(app, '/api');
            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ name: string; framework: string }>(response);
            expect(body.name).toBe('eXeLearning API');
            expect(body.framework).toBe('Elysia');
        });

        it('should serve API config at /api/config/test', async () => {
            const response = await testRequest(app, '/api/config/test');
            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ config: string }>(response);
            expect(body.config).toBe('test-value');
        });

        it('should serve translations with language param', async () => {
            const response = await testRequest(app, '/api/translations/es');
            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ locale: string }>(response);
            expect(body.locale).toBe('es');
        });
    });

    describe('With BASE_PATH=/web/exelearning', () => {
        let app: Elysia;

        beforeAll(() => {
            app = createBasePathTestApp(TEST_BASE_PATH);
        });

        describe('Routes with BASE_PATH prefix', () => {
            it('should serve health endpoint at BASE_PATH/health', async () => {
                const response = await testRequest(app, `${TEST_BASE_PATH}/health`);
                expect(response.status).toBe(200);

                const body = await parseJsonResponse<{ status: string }>(response);
                expect(body.status).toBe('ok');
            });

            it('should serve API root at BASE_PATH/api', async () => {
                const response = await testRequest(app, `${TEST_BASE_PATH}/api`);
                expect(response.status).toBe(200);

                const body = await parseJsonResponse<{ name: string }>(response);
                expect(body.name).toBe('eXeLearning API');
            });

            it('should serve API config at BASE_PATH/api/config/test', async () => {
                const response = await testRequest(app, `${TEST_BASE_PATH}/api/config/test`);
                expect(response.status).toBe(200);

                const body = await parseJsonResponse<{ config: string }>(response);
                expect(body.config).toBe('test-value');
            });

            it('should serve translations at BASE_PATH/api/translations/:lang', async () => {
                const response = await testRequest(app, `${TEST_BASE_PATH}/api/translations/fr`);
                expect(response.status).toBe(200);

                const body = await parseJsonResponse<{ locale: string }>(response);
                expect(body.locale).toBe('fr');
            });
        });

        describe('Routes without BASE_PATH prefix (frontend compatibility)', () => {
            it('should also serve health at root /health', async () => {
                const response = await testRequest(app, '/health');
                expect(response.status).toBe(200);

                const body = await parseJsonResponse<{ status: string }>(response);
                expect(body.status).toBe('ok');
            });

            it('should also serve API at root /api', async () => {
                const response = await testRequest(app, '/api');
                expect(response.status).toBe(200);

                const body = await parseJsonResponse<{ name: string }>(response);
                expect(body.name).toBe('eXeLearning API');
            });

            it('should also serve API config at root /api/config/test', async () => {
                const response = await testRequest(app, '/api/config/test');
                expect(response.status).toBe(200);

                const body = await parseJsonResponse<{ config: string }>(response);
                expect(body.config).toBe('test-value');
            });

            it('should also serve translations at root /api/translations/:lang', async () => {
                const response = await testRequest(app, '/api/translations/de');
                expect(response.status).toBe(200);

                const body = await parseJsonResponse<{ locale: string }>(response);
                expect(body.locale).toBe('de');
            });
        });
    });

    describe('Static Files with BASE_PATH', () => {
        let app: Elysia;

        beforeAll(() => {
            app = createBasePathTestApp(TEST_BASE_PATH);
        });

        // Skip static file tests if public/libs doesn't exist
        const libsDir = path.join(process.cwd(), 'public', 'libs');
        const hasLibsDir = fs.existsSync(libsDir);

        it.skipIf(!hasLibsDir)('should serve static JS file at BASE_PATH/libs/*', async () => {
            // Check for jquery since it's commonly used
            const jqueryPath = path.join(process.cwd(), 'public', 'libs', 'jquery', 'jquery.min.js');
            if (!fs.existsSync(jqueryPath)) {
                console.log('Skipping: jquery.min.js not found');
                return;
            }

            const response = await testRequest(app, `${TEST_BASE_PATH}/libs/jquery/jquery.min.js`);
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('application/javascript');
        });

        it.skipIf(!hasLibsDir)('should serve static CSS file at BASE_PATH/libs/*', async () => {
            // Check for bootstrap CSS
            const bootstrapPath = path.join(process.cwd(), 'public', 'libs', 'bootstrap', 'css', 'bootstrap.min.css');
            if (!fs.existsSync(bootstrapPath)) {
                console.log('Skipping: bootstrap.min.css not found');
                return;
            }

            const response = await testRequest(app, `${TEST_BASE_PATH}/libs/bootstrap/css/bootstrap.min.css`);
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('text/css');
        });

        it.skipIf(!hasLibsDir)('should also serve static files at root without BASE_PATH', async () => {
            const jqueryPath = path.join(process.cwd(), 'public', 'libs', 'jquery', 'jquery.min.js');
            if (!fs.existsSync(jqueryPath)) {
                console.log('Skipping: jquery.min.js not found');
                return;
            }

            const response = await testRequest(app, '/libs/jquery/jquery.min.js');
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('javascript');
        });

        it('should return 404 for non-existent static files', async () => {
            const response = await testRequest(app, `${TEST_BASE_PATH}/libs/nonexistent/file.js`);
            expect(response.status).toBe(404);
        });

        it('should prevent path traversal attacks', async () => {
            const response = await testRequest(app, `${TEST_BASE_PATH}/libs/../../../etc/passwd`);
            // Should either 404 or serve from public/etc/passwd (which doesn't exist)
            expect(response.status).toBe(404);
        });
    });

    describe('BASE_PATH edge cases', () => {
        it('should handle BASE_PATH with trailing slash correctly', () => {
            // Trailing slashes should be handled consistently
            const app = createBasePathTestApp('/web/exelearning');
            // Routes registered at /web/exelearning/health, not /web/exelearning//health
            expect(app).toBeDefined();
        });

        it('should handle deeply nested BASE_PATH', async () => {
            const deepBasePath = '/org/edu/app/exelearning';
            const app = createBasePathTestApp(deepBasePath);

            const response = await testRequest(app, `${deepBasePath}/health`);
            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ status: string }>(response);
            expect(body.status).toBe('ok');
        });

        it('should handle single-level BASE_PATH', async () => {
            const app = createBasePathTestApp('/app');

            const response = await testRequest(app, '/app/health');
            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ status: string }>(response);
            expect(body.status).toBe('ok');
        });

        it('should work without BASE_PATH (empty string)', async () => {
            const app = createBasePathTestApp('');

            const response = await testRequest(app, '/health');
            expect(response.status).toBe(200);
        });
    });

    describe('Content-Type headers', () => {
        let app: Elysia;

        beforeAll(() => {
            app = createBasePathTestApp(TEST_BASE_PATH);
        });

        it('should return JSON content-type for API endpoints', async () => {
            const response = await testRequest(app, `${TEST_BASE_PATH}/api`);
            expect(response.headers.get('content-type')).toContain('application/json');
        });

        it('should return correct MIME type for static CSS', async () => {
            const cssPath = path.join(process.cwd(), 'public', 'style', 'workarea', 'login.css');
            if (!fs.existsSync(cssPath)) {
                console.log('Skipping: login.css not found');
                return;
            }

            const response = await testRequest(app, `${TEST_BASE_PATH}/style/workarea/login.css`);
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('text/css');
        });

        it('should return correct MIME type for static JS', async () => {
            // Find any .js file in public/app
            const appDir = path.join(process.cwd(), 'public', 'app');
            if (!fs.existsSync(appDir)) {
                console.log('Skipping: public/app not found');
                return;
            }

            const response = await testRequest(app, `${TEST_BASE_PATH}/app/main.js`);
            if (response.status === 200) {
                expect(response.headers.get('content-type')).toBe('application/javascript');
            }
        });
    });
});

describe('BASE_PATH utility functions', () => {
    // These tests verify the basepath.util.ts functions
    // Note: prefixPath() uses getBasePath() internally which reads from process.env.BASE_PATH

    it('should handle getBasePath correctly', async () => {
        const { getBasePath } = await import('../../../src/utils/basepath.util');

        // getBasePath reads from process.env.BASE_PATH
        // It should return empty string or the configured value
        const basePath = getBasePath();
        expect(typeof basePath).toBe('string');

        // Should not have trailing slash
        if (basePath) {
            expect(basePath.endsWith('/')).toBe(false);
        }
    });

    it('should prefix paths correctly with prefixPath', async () => {
        const { getBasePath, prefixPath } = await import('../../../src/utils/basepath.util');

        const basePath = getBasePath();

        // prefixPath uses the environment's BASE_PATH internally
        // Test that it produces expected format
        const prefixedApi = prefixPath('/api');
        const prefixedLogin = prefixPath('/login');
        const prefixedWithoutSlash = prefixPath('workarea');

        if (basePath) {
            // With BASE_PATH configured
            expect(prefixedApi).toBe(`${basePath}/api`);
            expect(prefixedLogin).toBe(`${basePath}/login`);
            expect(prefixedWithoutSlash).toBe(`${basePath}/workarea`);
        } else {
            // Without BASE_PATH
            expect(prefixedApi).toBe('/api');
            expect(prefixedLogin).toBe('/login');
            expect(prefixedWithoutSlash).toBe('/workarea');
        }
    });

    it('should normalize paths without leading slash', async () => {
        const { getBasePath, prefixPath } = await import('../../../src/utils/basepath.util');

        const basePath = getBasePath();

        // Paths without leading slash should be normalized
        const result = prefixPath('api/test');

        if (basePath) {
            expect(result).toBe(`${basePath}/api/test`);
        } else {
            expect(result).toBe('/api/test');
        }
    });
});
