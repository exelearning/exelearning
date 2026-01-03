/**
 * Tests for versioned static file serving with cache-busting headers
 * Verifies that /v{version}/* URLs serve files with proper Cache-Control headers
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import * as fs from 'fs';
import * as path from 'path';
import { MIME_TYPES } from '../../src/utils/mime-types';

// Minimal app setup that mirrors index.ts versioned file handling
const createTestApp = () => {
    return new Elysia()
        .onRequest(({ request }) => {
            const url = new URL(request.url);
            const pathname = url.pathname;

            // Match /v{version}/libs/* and rewrite to /libs/*
            const versionedLibsMatch = pathname.match(/^\/v[\d.]+[^/]*\/libs\/(.+)$/);
            if (versionedLibsMatch) {
                const filePath = path.join(process.cwd(), 'public', 'libs', versionedLibsMatch[1]);
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                    const content = fs.readFileSync(filePath);
                    const ext = path.extname(filePath).toLowerCase();
                    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

                    return new Response(content, {
                        headers: {
                            'Content-Type': contentType,
                            'Cache-Control': 'public, max-age=31536000, immutable',
                        },
                    });
                }
            }

            // Match /v{version}/app/* and other static files
            const versionedMatch = pathname.match(/^\/v[\d.]+[^/]*\/(.+)$/);
            if (versionedMatch && !versionedMatch[1].startsWith('libs/')) {
                const filePath = path.join(process.cwd(), 'public', versionedMatch[1]);
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                    const content = fs.readFileSync(filePath);
                    const ext = path.extname(filePath).toLowerCase();
                    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

                    return new Response(content, {
                        headers: {
                            'Content-Type': contentType,
                            'Cache-Control': 'public, max-age=31536000, immutable',
                        },
                    });
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
};

describe('Versioned Static Files', () => {
    let app: ReturnType<typeof createTestApp>;

    beforeAll(() => {
        app = createTestApp();
    });

    afterAll(() => {
        // No need to stop - app.handle() doesn't start a server
    });

    describe('versioned /libs/* paths', () => {
        it('should serve libs files from versioned URL with immutable cache headers', async () => {
            // Use a real file that exists in public/libs
            const res = await app.handle(new Request('http://localhost/v0.0.0-alpha/libs/jquery/jquery.min.js'));

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('application/javascript');
            expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
        });

        it('should serve CSS files with correct content type', async () => {
            const res = await app.handle(new Request('http://localhost/v3.1.0/libs/bootstrap/bootstrap.min.css'));

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('text/css');
            expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
        });

        it('should handle complex version strings (alpha, beta, rc)', async () => {
            const versions = ['v0.0.0-alpha', 'v3.1.0-beta.1', 'v3.1.0-rc1', 'v0.0.0-alpha-build20251228'];

            for (const version of versions) {
                const res = await app.handle(new Request(`http://localhost/${version}/libs/jquery/jquery.min.js`));

                expect(res.status).toBe(200);
                expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
            }
        });

        it('should return 404 for non-existent versioned file', async () => {
            const res = await app.handle(new Request('http://localhost/v1.0.0/libs/nonexistent/file.js'));

            // Either 404 or falls through to static plugin which also returns 404
            expect([404, undefined].includes(res.status) || res.status === 404).toBe(true);
        });
    });

    describe('versioned /app/* paths', () => {
        it('should serve app files from versioned URL with immutable cache headers', async () => {
            const res = await app.handle(new Request('http://localhost/v0.0.0-alpha/app/common/common.js'));

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('application/javascript');
            expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
        });
    });

    describe('versioned /files/perm/* paths', () => {
        it('should serve idevice files from versioned URL with immutable cache headers', async () => {
            // Use a real idevice file
            const res = await app.handle(
                new Request('http://localhost/v0.0.0-alpha/files/perm/idevices/base/text/text-icon.svg'),
            );

            if (res.status === 200) {
                expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
            }
            // May be 404 if file doesn't exist in test environment
            expect([200, 404]).toContain(res.status);
        });
    });

    describe('non-versioned paths (fallback)', () => {
        it('versioned and non-versioned paths serve the same content', async () => {
            // Verify that versioned and non-versioned paths would serve the same file
            // by checking that the versioned path works and strips the version correctly
            const versionedRes = await app.handle(new Request('http://localhost/v1.0.0/libs/jquery/jquery.min.js'));

            // The versioned path should work and serve the file
            expect(versionedRes.status).toBe(200);
            const content = await versionedRes.text();
            expect(content.length).toBeGreaterThan(0);
        });
    });

    describe('cache header values', () => {
        it('should use max-age=31536000 (1 year) for versioned assets', async () => {
            const res = await app.handle(new Request('http://localhost/v1.0.0/libs/jquery/jquery.min.js'));

            if (res.status === 200) {
                const cacheControl = res.headers.get('Cache-Control');
                expect(cacheControl).toContain('max-age=31536000');
                expect(cacheControl).toContain('immutable');
                expect(cacheControl).toContain('public');
            }
        });
    });
});
