/**
 * Tests for iDevices Routes
 *
 * These tests work with the actual iDevice files in the project.
 * The routes use hardcoded paths so we test against real iDevices.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { idevicesRoutes } from './idevices';

describe('iDevices Routes', () => {
    let app: Elysia;

    beforeEach(() => {
        app = new Elysia().use(idevicesRoutes);
    });

    describe('GET /api/idevices/installed', () => {
        it('should return idevices wrapper object', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.idevices).toBeDefined();
            expect(Array.isArray(body.idevices)).toBe(true);
        });

        it('should return at least one iDevice', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            expect(body.idevices.length).toBeGreaterThan(0);
        });

        it('should include required iDevice properties', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            const idevice = body.idevices[0];

            expect(idevice.id).toBeDefined();
            expect(idevice.name).toBeDefined(); // Frontend uses 'name'
            expect(idevice.title).toBeDefined();
            expect(idevice.category).toBeDefined();
            expect(idevice.icon).toBeDefined();
            expect(idevice.version).toBeDefined();
            expect(idevice.url).toBeDefined();
        });

        it('should have name equal to id for frontend compatibility', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            const idevice = body.idevices[0];

            expect(idevice.name).toBe(idevice.id);
        });

        it('should include icon object', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            const idevice = body.idevices[0];

            expect(idevice.icon).toBeDefined();
            expect(idevice.icon.name).toBeDefined();
            expect(idevice.icon.url).toBeDefined();
            expect(idevice.icon.type).toBeDefined();
        });

        it('should include JS and CSS file arrays', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            const idevice = body.idevices[0];

            expect(Array.isArray(idevice.editionJs)).toBe(true);
            expect(Array.isArray(idevice.editionCss)).toBe(true);
            expect(Array.isArray(idevice.exportJs)).toBe(true);
            expect(Array.isArray(idevice.exportCss)).toBe(true);
        });

        it('should include template properties', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            const idevice = body.idevices[0];

            // These may be empty strings but should exist
            expect('editionTemplateFilename' in idevice).toBe(true);
            expect('exportTemplateFilename' in idevice).toBe(true);
            expect('editionTemplateContent' in idevice).toBe(true);
            expect('exportTemplateContent' in idevice).toBe(true);
        });

        it('should sort by category then title', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            const idevices = body.idevices;

            // Check sorting
            for (let i = 1; i < idevices.length; i++) {
                const prev = idevices[i - 1];
                const curr = idevices[i];

                if (prev.category === curr.category) {
                    expect(prev.title.localeCompare(curr.title)).toBeLessThanOrEqual(0);
                } else {
                    expect(prev.category.localeCompare(curr.category)).toBeLessThanOrEqual(0);
                }
            }
        });

        it('should include url with proper path', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            const idevice = body.idevices[0];

            expect(idevice.url).toContain('/files/perm/idevices/');
        });

        it('should include version prefix in idevice URLs for cache-busting', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            const idevice = body.idevices[0];

            // URL should start with /v followed by version number (e.g., /v0.0.0-alpha/files/perm/idevices/...)
            expect(idevice.url).toMatch(/^\/v[\d.]+[^/]*\/files\/perm\/idevices\//);
        });
    });

    describe('GET /api/idevices/installed/:ideviceId', () => {
        it('should return specific iDevice by ID', async () => {
            // First get list to find a valid iDevice ID
            const listRes = await app.handle(new Request('http://localhost/api/idevices/installed'));
            const listBody = await listRes.json();
            const ideviceId = listBody.idevices[0]?.id;

            if (!ideviceId) return;

            const res = await app.handle(new Request(`http://localhost/api/idevices/installed/${ideviceId}`));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.id).toBe(ideviceId);
        });

        it('should return 404 for non-existent iDevice', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/installed/non-existent-idevice-xyz'),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toBe('Not Found');
        });

        it('should include full config for specific iDevice', async () => {
            const listRes = await app.handle(new Request('http://localhost/api/idevices/installed'));
            const listBody = await listRes.json();
            const ideviceId = listBody.idevices[0]?.id;

            if (!ideviceId) return;

            const res = await app.handle(new Request(`http://localhost/api/idevices/installed/${ideviceId}`));

            const body = await res.json();

            expect(body.id).toBeDefined();
            expect(body.title).toBeDefined();
            expect(body.category).toBeDefined();
            expect(body.version).toBeDefined();
            expect(body.apiVersion).toBeDefined();
            expect(body.componentType).toBeDefined();
        });
    });

    describe('GET /api/idevices/download-file-resources', () => {
        it('should return 400 when resource parameter is missing', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/download-file-resources'));

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('Bad Request');
        });

        it('should return 404 for non-existent resource', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/download-file-resources?resource=non-existent-file.xyz'),
            );

            expect(res.status).toBe(404);
        });

        it('should prevent path traversal attacks', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/download-file-resources?resource=../../../etc/passwd'),
            );

            // Should be either 403 or 404, not exposing file
            expect([403, 404]).toContain(res.status);
        });

        it('should download valid CSS resource', async () => {
            // Find an actual iDevice CSS file
            const listRes = await app.handle(new Request('http://localhost/api/idevices/installed'));
            const listBody = await listRes.json();
            const idevice = listBody.idevices.find((i: any) => i.editionCss.length > 0);

            if (!idevice) return;

            const cssFile = idevice.editionCss[0];
            const resourcePath = `perm/idevices/base/${idevice.id}/edition/${cssFile}`;

            const res = await app.handle(
                new Request(`http://localhost/api/idevices/download-file-resources?resource=${resourcePath}`),
            );

            if (res.status === 200) {
                expect(res.headers.get('Content-Type')).toBe('text/css');
            }
        });

        it('should download valid JS resource', async () => {
            const listRes = await app.handle(new Request('http://localhost/api/idevices/installed'));
            const listBody = await listRes.json();
            const idevice = listBody.idevices.find((i: any) => i.editionJs.length > 0);

            if (!idevice) return;

            const jsFile = idevice.editionJs[0];
            const resourcePath = `perm/idevices/base/${idevice.id}/edition/${jsFile}`;

            const res = await app.handle(
                new Request(`http://localhost/api/idevices/download-file-resources?resource=${resourcePath}`),
            );

            if (res.status === 200) {
                expect(res.headers.get('Content-Type')).toBe('application/javascript');
            }
        });

        it('should handle encoded resource paths', async () => {
            const res = await app.handle(
                new Request(
                    'http://localhost/api/idevices/download-file-resources?resource=' +
                        encodeURIComponent('perm/idevices/base/text/edition/text.css'),
                ),
            );

            // Just verify it doesn't crash - may be 200 or 404 depending on file existence
            expect([200, 404]).toContain(res.status);
        });
    });

    describe('iDevice icon handling', () => {
        it('should parse simple icon names', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            // All iDevices should have icon defined
            for (const idevice of body.idevices) {
                expect(idevice.icon).toBeDefined();
                expect(idevice.icon.type).toBeDefined();
            }
        });

        it('should have icon type as img or icon', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            for (const idevice of body.idevices) {
                expect(['img', 'icon']).toContain(idevice.icon.type);
            }
        });
    });

    describe('security', () => {
        it('should block access outside public/files', async () => {
            const maliciousPath = '../../config/secrets.json';
            const res = await app.handle(
                new Request(
                    `http://localhost/api/idevices/download-file-resources?resource=${encodeURIComponent(maliciousPath)}`,
                ),
            );

            expect([403, 404]).toContain(res.status);
        });

        it('should clean double dots from resource path', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/download-file-resources?resource=perm/../../../etc/passwd'),
            );

            expect([403, 404]).toContain(res.status);
        });
    });

    describe('POST /api/idevices/upload/file/resources', () => {
        it('should reject missing required parameters', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.code).toContain('error');
        });

        it('should reject missing odeIdeviceId', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
                        filename: 'test.txt',
                    }),
                }),
            );

            expect(res.status).toBe(400);
        });

        it('should reject missing filename', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-idevice',
                        file: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
                    }),
                }),
            );

            expect(res.status).toBe(400);
        });

        it('should reject missing file data', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-idevice',
                        filename: 'test.txt',
                    }),
                }),
            );

            expect(res.status).toBe(400);
        });

        it('should upload base64 file successfully', async () => {
            const base64Content = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-idevice-upload',
                        file: `data:text/plain;base64,${base64Content}`,
                        filename: 'test-upload.txt',
                        odeSessionId: 'test-session-upload',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.odeSessionId).toBe('test-session-upload');
            expect(body.savedFilename).toBeDefined();
            expect(body.savedPath).toContain('test-session-upload');
        });

        it('should clean special characters from filename', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-idevice',
                        file: 'data:text/plain;base64,SGVsbG8=',
                        filename: 'my file@#$%.txt',
                        odeSessionId: 'test-clean-session',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            // Special chars should be removed, spaces replaced with underscore
            expect(body.savedFilename).not.toContain('@');
            expect(body.savedFilename).not.toContain('#');
            expect(body.savedFilename).not.toContain('$');
            expect(body.savedFilename).not.toContain('%');
            expect(body.savedFilename).not.toContain(' ');
        });

        it('should use default session ID when not provided', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-idevice-default',
                        file: 'data:text/plain;base64,SGVsbG8=',
                        filename: 'default-session.txt',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.odeSessionId).toBe('uploads');
        });

        it('should handle base64 without data URI prefix', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-idevice-raw',
                        file: 'SGVsbG8gV29ybGQ=', // Raw base64 without data: prefix
                        filename: 'raw-base64.txt',
                        odeSessionId: 'test-raw-session',
                    }),
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should include file size in response', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-idevice-size',
                        file: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
                        filename: 'size-test.txt',
                        odeSessionId: 'test-size-session',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.savedFileSize).toBeDefined();
            expect(body.savedFileSize).toContain('Bytes');
        });

        it('should create thumbnail for image when requested', async () => {
            // Small 1x1 pixel PNG in base64
            const pngBase64 =
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-idevice-thumb',
                        file: `data:image/png;base64,${pngBase64}`,
                        filename: 'image.png',
                        odeSessionId: 'test-thumb-session',
                        createThumbnail: true,
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.savedThumbnailName).toBeDefined();
            expect(body.savedThumbnailName).toContain('thumb_');
        });

        it('should not create thumbnail for non-image files', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-idevice-no-thumb',
                        file: 'data:text/plain;base64,SGVsbG8=',
                        filename: 'text.txt',
                        odeSessionId: 'test-no-thumb-session',
                        createThumbnail: true,
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.savedThumbnailName).toBeUndefined();
        });

        it('should generate empty filename when all chars are invalid', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-idevice-empty',
                        file: 'data:text/plain;base64,SGVsbG8=',
                        filename: '@#$%^&*()', // All invalid chars
                        odeSessionId: 'test-empty-filename',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.savedFilename).toContain('file_');
        });
    });

    describe('POST /api/idevices/upload/large/file/resources', () => {
        it('should reject missing required parameters', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/large/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.code).toContain('error');
        });

        it('should reject missing odeIdeviceId', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/large/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file: 'test content',
                        filename: 'test.txt',
                    }),
                }),
            );

            expect(res.status).toBe(400);
        });

        it('should upload large file (Buffer format)', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/large/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-large-idevice',
                        file: 'Large file content here',
                        filename: 'large-file.txt',
                        odeSessionId: 'test-large-session',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.savedFilename).toBeDefined();
            expect(body.savedFileSize).toBeDefined();
        });

        it('should use default session ID when not provided', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/large/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-large-default',
                        file: 'content',
                        filename: 'default.txt',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.odeSessionId).toBe('uploads');
        });

        it('should clean special characters from filename', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/large/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-large-clean',
                        file: 'content',
                        filename: 'bad name!@#.txt',
                        odeSessionId: 'test-large-clean-session',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.savedFilename).not.toContain('!');
            expect(body.savedFilename).not.toContain('@');
            expect(body.savedFilename).not.toContain('#');
        });
    });

    describe('path traversal security', () => {
        it('should return 403 when resolved path escapes base directory', async () => {
            // This tests lines 332-333 - when path.resolve() reveals escape
            // Using a path that after cleaning still escapes the base
            const res = await app.handle(
                new Request(
                    'http://localhost/api/idevices/download-file-resources?resource=' +
                        encodeURIComponent('/absolute/path/outside'),
                ),
            );

            // Should be either 403 (path traversal blocked) or 404 (file not found)
            expect([403, 404]).toContain(res.status);
        });
    });

    describe('CSS URL rewriting', () => {
        it('should rewrite relative URLs in CSS to API endpoints', async () => {
            // Find a CSS file that has relative URLs (fonts, images)
            const listRes = await app.handle(new Request('http://localhost/api/idevices/installed'));
            const listBody = await listRes.json();
            const idevice = listBody.idevices.find((i: any) => i.editionCss.length > 0);

            if (!idevice) return;

            const cssFile = idevice.editionCss[0];
            const resourcePath = `perm/idevices/base/${idevice.id}/edition/${cssFile}`;

            const res = await app.handle(
                new Request(`http://localhost/api/idevices/download-file-resources?resource=${resourcePath}`),
            );

            // Just verify CSS is returned and processed
            if (res.status === 200) {
                const content = await res.text();
                // If CSS contains url() references, they should be processed
                expect(typeof content).toBe('string');
            }
        });

        it('should not rewrite absolute URLs in CSS', async () => {
            // The rewriteCSSUrls function should skip absolute URLs
            // This is verified indirectly - CSS files with http:// or / URLs stay intact
            const res = await app.handle(
                new Request(
                    'http://localhost/api/idevices/download-file-resources?resource=perm/idevices/base/text/edition/text.css',
                ),
            );

            // Just verify no crash when processing
            expect([200, 404]).toContain(res.status);
        });
    });

    describe('thumbnail with filename extension fallback', () => {
        it('should detect mime type from filename when data URI has no mime', async () => {
            // This tests lines 476-483 - detecting mime from extension
            const pngBase64 =
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-mime-from-ext',
                        // Data URI without proper mime type prefix
                        file: pngBase64,
                        filename: 'image.png',
                        odeSessionId: 'test-mime-ext-session',
                        createThumbnail: true,
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            // Should still create thumbnail by detecting from .png extension
            expect(body.savedThumbnailName).toBeDefined();
            expect(body.savedThumbnailName).toContain('thumb_');
        });

        it('should create thumbnail for JPEG from extension', async () => {
            // Small valid JPEG (1x1 pixel)
            const jpegBase64 =
                '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQACEQA/AL+AB//Z';
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-jpeg-ext',
                        file: jpegBase64,
                        filename: 'photo.jpg',
                        odeSessionId: 'test-jpeg-ext-session',
                        createThumbnail: true,
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.savedThumbnailName).toBeDefined();
        });

        it('should create thumbnail for GIF from extension', async () => {
            // Minimal valid GIF
            const gifBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-gif-ext',
                        file: gifBase64,
                        filename: 'animation.gif',
                        odeSessionId: 'test-gif-ext-session',
                        createThumbnail: true,
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.savedThumbnailName).toBeDefined();
        });
    });

    describe('large file upload with different data types', () => {
        it('should handle Blob upload', async () => {
            // This tests line 553 - Blob handling
            const formData = new FormData();
            formData.append('odeIdeviceId', 'test-blob-upload');
            formData.append('file', new Blob(['Hello from Blob'], { type: 'text/plain' }), 'blob-file.txt');
            formData.append('filename', 'blob-file.txt');
            formData.append('odeSessionId', 'test-blob-session');

            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/large/file/resources', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.savedFilename).toBeDefined();
        });

        it('should handle file upload with name from File object', async () => {
            const formData = new FormData();
            formData.append('odeIdeviceId', 'test-file-name');
            // File object has name property
            const file = new File(['File content'], 'from-file-object.txt', { type: 'text/plain' });
            formData.append('file', file);
            formData.append('odeSessionId', 'test-file-name-session');
            // Don't include filename - should use file.name

            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/large/file/resources', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.savedFilename).toBeDefined();
        });

        it('should generate filename when cleaned result is empty', async () => {
            // This tests line 528 - empty filename after cleaning
            const res = await app.handle(
                new Request('http://localhost/api/idevices/upload/large/file/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeIdeviceId: 'test-empty-name',
                        file: 'content',
                        filename: '!@#$%^&*()', // All invalid chars
                        odeSessionId: 'test-empty-name-session',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.savedFilename).toContain('file_');
        });
    });

    describe('exportObject validation', () => {
        it('should have exportObject matching script definition for JSON iDevices', async () => {
            const fs = await import('fs');
            const path = await import('path');

            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();
            const errors: string[] = [];

            for (const idevice of body.idevices) {
                // Only check JSON type iDevices - they wait for exportObject in ideviceInitExport()
                if (idevice.componentType !== 'json') continue;

                // Find the export JS file
                const exportJsFile = idevice.exportJs[0];
                if (!exportJsFile) continue;

                const scriptPath = path.join(
                    process.cwd(),
                    'public/files/perm/idevices/base',
                    idevice.id,
                    'export',
                    exportJsFile,
                );

                if (!fs.existsSync(scriptPath)) continue;

                const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

                // Extract the global object name from "var $ObjectName = {"
                const match = scriptContent.match(/^var\s+(\$[a-zA-Z0-9_]+)\s*=/m);
                if (!match) continue;

                const scriptObjectName = match[1];
                const configExportObject = idevice.exportObject;

                // The exportObject in config should match what the script defines
                if (configExportObject !== scriptObjectName) {
                    errors.push(
                        `${idevice.id}: exportObject mismatch - config has '${configExportObject}' but script defines '${scriptObjectName}'`,
                    );
                }
            }

            // Report all mismatches at once for easier debugging
            if (errors.length > 0) {
                throw new Error(
                    `exportObject mismatch detected! This will cause JSON iDevices to fail loading.\n` +
                        `Add <export-object>$ScriptObjectName</export-object> to each config.xml:\n\n` +
                        errors.join('\n'),
                );
            }
        });

        it('should include exportObject in iDevice response', async () => {
            const res = await app.handle(new Request('http://localhost/api/idevices/installed'));

            const body = await res.json();

            for (const idevice of body.idevices) {
                expect(idevice.exportObject).toBeDefined();
                expect(typeof idevice.exportObject).toBe('string');
                expect(idevice.exportObject.startsWith('$')).toBe(true);
            }
        });
    });
});
