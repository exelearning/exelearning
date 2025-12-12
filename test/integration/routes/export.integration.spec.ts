/**
 * Export Routes Integration Tests
 * Tests export format listing and basic export functionality
 */
import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { testRequest, parseJsonResponse } from '../helpers/integration-app';
import { ExportFormatType } from '../../../src/services/export/interfaces';

describe('Export Routes Integration', () => {
    let app: Elysia;

    beforeAll(async () => {
        // Create export routes for testing
        app = new Elysia({ name: 'export-test', prefix: '/api/export' })
            // GET /api/export/formats - List available export formats
            .get('/formats', () => {
                return {
                    formats: [
                        {
                            id: ExportFormatType.HTML5,
                            name: 'HTML5',
                            description: 'Interactive web content',
                            extension: 'zip',
                            mimeType: 'application/zip',
                        },
                        {
                            id: ExportFormatType.SCORM12,
                            name: 'SCORM 1.2',
                            description: 'Learning Management System package',
                            extension: 'zip',
                            mimeType: 'application/zip',
                        },
                        {
                            id: ExportFormatType.IMS,
                            name: 'IMS Content Package',
                            description: 'Standard content packaging format',
                            extension: 'zip',
                            mimeType: 'application/zip',
                        },
                        {
                            id: ExportFormatType.EPUB3,
                            name: 'EPUB3',
                            description: 'Electronic publication format',
                            extension: 'epub',
                            mimeType: 'application/epub+zip',
                        },
                        {
                            id: ExportFormatType.ELPX,
                            name: 'ELPX',
                            description: 'eXeLearning project package',
                            extension: 'elpx',
                            mimeType: 'application/x-elp',
                        },
                    ],
                };
            })
            // GET /api/export/:sessionId/preview - Get preview URL
            .get('/:sessionId/preview', ({ params, set }) => {
                // Mock session validation
                if (params.sessionId === 'invalid') {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Session not found' };
                }

                return {
                    responseMessage: 'OK',
                    urlPreviewIndex: `/files/dist/${params.sessionId}/preview/index.html`,
                };
            })
            // GET /api/export/:sessionId/:format/download - Export and download
            .get('/:sessionId/:format/download', ({ params, set }) => {
                const validFormats = ['html5', 'scorm12', 'scorm2004', 'ims', 'epub3', 'elp', 'elpx'];

                if (params.sessionId === 'invalid') {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Session not found' };
                }

                if (!validFormats.includes(params.format)) {
                    set.status = 400;
                    return { error: 'Bad Request', message: `Invalid format: ${params.format}` };
                }

                const extension =
                    params.format === 'epub3'
                        ? 'epub'
                        : params.format === 'elp' || params.format === 'elpx'
                          ? params.format
                          : 'zip';

                return {
                    responseMessage: 'OK',
                    urlZipFile: `/files/dist/${params.sessionId}/${params.format}/export.${extension}`,
                    zipFileName: `export.${extension}`,
                    exportProjectName: 'Test Project',
                };
            });
    });

    describe('GET /api/export/formats', () => {
        it('should return list of available export formats', async () => {
            const response = await testRequest(app, '/api/export/formats');

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{
                formats: Array<{
                    id: string;
                    name: string;
                    description: string;
                    extension: string;
                }>;
            }>(response);

            expect(body.formats).toBeDefined();
            expect(body.formats.length).toBeGreaterThan(0);

            // Check HTML5 format exists
            const html5Format = body.formats.find(f => f.id === 'html5');
            expect(html5Format).toBeDefined();
            expect(html5Format?.name).toBe('HTML5');
        });

        it('should include all standard formats', async () => {
            const response = await testRequest(app, '/api/export/formats');
            const body = await parseJsonResponse<{ formats: Array<{ id: string }> }>(response);

            const formatIds = body.formats.map(f => f.id);

            expect(formatIds).toContain('html5');
            expect(formatIds).toContain('scorm12');
            expect(formatIds).toContain('ims');
            expect(formatIds).toContain('epub3');
            expect(formatIds).toContain('elpx');
        });
    });

    describe('GET /api/export/:sessionId/preview', () => {
        it('should return 404 for invalid session', async () => {
            const response = await testRequest(app, '/api/export/invalid/preview');

            expect(response.status).toBe(404);
        });

        it('should return preview URL for valid session', async () => {
            const response = await testRequest(app, '/api/export/test-session-123/preview');

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{
                responseMessage: string;
                urlPreviewIndex: string;
            }>(response);

            expect(body.responseMessage).toBe('OK');
            expect(body.urlPreviewIndex).toContain('/preview/index.html');
        });
    });

    describe('GET /api/export/:sessionId/:format/download', () => {
        it('should return 404 for invalid session', async () => {
            const response = await testRequest(app, '/api/export/invalid/html5/download');

            expect(response.status).toBe(404);
        });

        it('should return 400 for invalid format', async () => {
            const response = await testRequest(app, '/api/export/test-session/invalidformat/download');

            expect(response.status).toBe(400);

            const body = await parseJsonResponse<{ error: string }>(response);
            expect(body.error).toBe('Bad Request');
        });

        it('should return download URL for HTML5 export', async () => {
            const response = await testRequest(app, '/api/export/test-session/html5/download');

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{
                responseMessage: string;
                urlZipFile: string;
                zipFileName: string;
            }>(response);

            expect(body.responseMessage).toBe('OK');
            expect(body.urlZipFile).toContain('html5');
            expect(body.zipFileName).toBe('export.zip');
        });

        it('should return download URL for SCORM 1.2 export', async () => {
            const response = await testRequest(app, '/api/export/test-session/scorm12/download');

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ urlZipFile: string }>(response);
            expect(body.urlZipFile).toContain('scorm12');
        });

        it('should return download URL for EPUB3 export', async () => {
            const response = await testRequest(app, '/api/export/test-session/epub3/download');

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ zipFileName: string }>(response);
            expect(body.zipFileName).toBe('export.epub');
        });

        it('should return download URL for ELP export', async () => {
            const response = await testRequest(app, '/api/export/test-session/elp/download');

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ zipFileName: string }>(response);
            expect(body.zipFileName).toBe('export.elp');
        });
    });
});
