/**
 * Tests for Export Interfaces
 * Validates interface type definitions and enum values
 */
import { describe, it, expect } from 'bun:test';
import {
    ExportFormatType,
    ExportFormat,
    ThemeDto,
    ExportOptions,
    Html5ExportOptions,
    ExportContext,
    ExportResult,
    PreviewResponse,
    DownloadResponse,
    OrchestratorExportResult,
} from './interfaces';

describe('Export Interfaces', () => {
    describe('ExportFormatType enum', () => {
        it('should have HTML5 format', () => {
            expect(ExportFormatType.HTML5).toBe('html5');
        });

        it('should have PAGE format', () => {
            expect(ExportFormatType.PAGE).toBe('page');
        });

        it('should have SCORM12 format', () => {
            expect(ExportFormatType.SCORM12).toBe('scorm12');
        });

        it('should have IMS format', () => {
            expect(ExportFormatType.IMS).toBe('ims');
        });

        it('should have EPUB3 format', () => {
            expect(ExportFormatType.EPUB3).toBe('epub3');
        });

        it('should have ELPX format', () => {
            expect(ExportFormatType.ELPX).toBe('elpx');
        });

        it('should have all expected values', () => {
            const formats = Object.values(ExportFormatType);
            expect(formats).toContain('html5');
            expect(formats).toContain('page');
            expect(formats).toContain('scorm12');
            expect(formats).toContain('ims');
            expect(formats).toContain('epub3');
            expect(formats).toContain('elpx');
        });
    });

    describe('ExportFormat enum', () => {
        it('should have HTML5 format', () => {
            expect(ExportFormat.HTML5).toBe('html5');
        });

        it('should have SCORM12 format', () => {
            expect(ExportFormat.SCORM12).toBe('scorm12');
        });

        it('should have SCORM2004 format', () => {
            expect(ExportFormat.SCORM2004).toBe('scorm2004');
        });

        it('should have EPUB3 format', () => {
            expect(ExportFormat.EPUB3).toBe('epub3');
        });

        it('should have ELP format', () => {
            expect(ExportFormat.ELP).toBe('elp');
        });

        it('should have ELPX format', () => {
            expect(ExportFormat.ELPX).toBe('elpx');
        });
    });

    describe('ThemeDto', () => {
        it('should accept minimal theme', () => {
            const theme: ThemeDto = {
                id: 'base',
                name: 'Base Theme',
                path: '/themes/base',
            };

            expect(theme.id).toBe('base');
            expect(theme.name).toBe('Base Theme');
            expect(theme.path).toBe('/themes/base');
        });

        it('should accept theme with CSS and JS files', () => {
            const theme: ThemeDto = {
                id: 'custom',
                name: 'Custom Theme',
                path: '/themes/custom',
                cssFile: 'style.css',
                jsFile: 'script.js',
            };

            expect(theme.cssFile).toBe('style.css');
            expect(theme.jsFile).toBe('script.js');
        });
    });

    describe('ExportOptions', () => {
        it('should accept empty options', () => {
            const options: ExportOptions = {};

            expect(options.includeNavigation).toBeUndefined();
        });

        it('should accept all options', () => {
            const options: ExportOptions = {
                includeNavigation: true,
                responsive: true,
                theme: { id: 'base', name: 'Base', path: '/base' },
                customCss: '.custom { color: red; }',
                preview: false,
                tempPath: '/tmp/export',
                resourcePrefix: '/resources/',
                compressionLevel: 9,
                scormOrganization: 'hierarchical',
                epubIncludeCover: true,
                language: 'es',
            };

            expect(options.includeNavigation).toBe(true);
            expect(options.compressionLevel).toBe(9);
            expect(options.scormOrganization).toBe('hierarchical');
        });

        it('should accept flat SCORM organization', () => {
            const options: ExportOptions = {
                scormOrganization: 'flat',
            };

            expect(options.scormOrganization).toBe('flat');
        });
    });

    describe('Html5ExportOptions', () => {
        it('should accept minimal options', () => {
            const options: Html5ExportOptions = {};

            expect(options.preview).toBeUndefined();
        });

        it('should accept all HTML5 options', () => {
            const options: Html5ExportOptions = {
                includeNavigation: true,
                responsive: true,
                theme: 'modern',
                customCss: 'body { margin: 0; }',
                preview: true,
                tempPath: '/tmp/preview',
                resourcePrefix: '/assets/',
                compressionLevel: 5,
            };

            expect(options.theme).toBe('modern');
            expect(options.preview).toBe(true);
        });
    });

    describe('ExportContext', () => {
        it('should accept complete context', () => {
            const context: ExportContext = {
                sessionId: 'session-123',
                structure: {
                    meta: { title: 'Test' },
                    pages: [],
                    navigation: { page: { id: '0', title: 'Root' } },
                    raw: { ode: {} },
                },
                sessionPath: '/tmp/sessions/123',
                exportDir: '/tmp/export/123',
                options: {},
            };

            expect(context.sessionId).toBe('session-123');
            expect(context.structure.meta.title).toBe('Test');
        });

        it('should accept context with theme and assets URL', () => {
            const context: ExportContext = {
                sessionId: 'session-456',
                structure: {
                    meta: {},
                    pages: [],
                    navigation: { page: { id: '0', title: 'Root' } },
                    raw: { ode: {} },
                },
                sessionPath: '/tmp/sessions/456',
                exportDir: '/tmp/export/456',
                options: {},
                theme: { id: 'custom', name: 'Custom', path: '/themes/custom' },
                assetsBaseUrl: 'https://cdn.example.com/assets/',
            };

            expect(context.theme?.id).toBe('custom');
            expect(context.assetsBaseUrl).toBe('https://cdn.example.com/assets/');
        });
    });

    describe('ExportResult', () => {
        it('should accept download result', () => {
            const result: ExportResult = {
                filePath: '/tmp/export/document.zip',
                fileName: 'document_html5.zip',
                fileSize: 1024000,
                format: ExportFormat.HTML5,
                success: true,
            };

            expect(result.filePath).toBe('/tmp/export/document.zip');
            expect(result.fileSize).toBe(1024000);
            expect(result.success).toBe(true);
        });

        it('should accept preview result', () => {
            const result: ExportResult = {
                filePath: '/tmp/preview/abc123',
                fileName: 'index.html',
                fileSize: 0,
                format: ExportFormat.HTML5,
                previewUrl: '/preview/abc123/index.html',
                success: true,
            };

            expect(result.previewUrl).toBe('/preview/abc123/index.html');
            expect(result.fileSize).toBe(0);
        });

        it('should accept error result', () => {
            const result: ExportResult = {
                filePath: '',
                fileName: '',
                fileSize: 0,
                format: ExportFormat.HTML5,
                success: false,
                error: 'Export failed: session not found',
            };

            expect(result.success).toBe(false);
            expect(result.error).toContain('session not found');
        });

        it('should accept ExportFormatType as format', () => {
            const result: ExportResult = {
                filePath: '/tmp/export/scorm.zip',
                fileName: 'scorm_package.zip',
                fileSize: 2048000,
                format: ExportFormatType.SCORM12,
                success: true,
            };

            expect(result.format).toBe('scorm12');
        });
    });

    describe('PreviewResponse', () => {
        it('should accept success response', () => {
            const response: PreviewResponse = {
                responseMessage: 'Preview generated successfully',
                urlPreviewIndex: '/preview/session-123/index.html',
            };

            expect(response.responseMessage).toBe('Preview generated successfully');
            expect(response.urlPreviewIndex).toContain('index.html');
        });

        it('should accept error response', () => {
            const response: PreviewResponse = {
                responseMessage: 'Preview failed',
                error: 'Session not found',
            };

            expect(response.error).toBe('Session not found');
        });
    });

    describe('DownloadResponse', () => {
        it('should accept success response', () => {
            const response: DownloadResponse = {
                responseMessage: 'Export completed successfully',
                urlZipFile: '/download/export-123.zip',
                zipFileName: 'MyProject_html5.zip',
                exportProjectName: 'MyProject',
            };

            expect(response.urlZipFile).toContain('.zip');
            expect(response.exportProjectName).toBe('MyProject');
        });

        it('should accept error response', () => {
            const response: DownloadResponse = {
                responseMessage: 'Export failed',
                error: 'Invalid format specified',
            };

            expect(response.error).toBe('Invalid format specified');
        });
    });

    describe('OrchestratorExportResult', () => {
        it('should accept successful result', () => {
            const result: OrchestratorExportResult = {
                success: true,
                filePath: '/tmp/export/result.zip',
                fileName: 'result.zip',
                fileSize: 512000,
                format: ExportFormatType.HTML5,
            };

            expect(result.success).toBe(true);
            expect(result.format).toBe(ExportFormatType.HTML5);
        });

        it('should accept preview result', () => {
            const result: OrchestratorExportResult = {
                success: true,
                previewUrl: '/preview/session/index.html',
                format: ExportFormatType.PAGE,
            };

            expect(result.previewUrl).toContain('preview');
        });

        it('should accept failed result', () => {
            const result: OrchestratorExportResult = {
                success: false,
                format: ExportFormatType.EPUB3,
                error: 'EPUB generation failed',
            };

            expect(result.success).toBe(false);
            expect(result.error).toBe('EPUB generation failed');
        });

        it('should work with all format types', () => {
            const formats = [
                ExportFormatType.HTML5,
                ExportFormatType.PAGE,
                ExportFormatType.SCORM12,
                ExportFormatType.IMS,
                ExportFormatType.EPUB3,
                ExportFormatType.ELPX,
            ];

            for (const format of formats) {
                const result: OrchestratorExportResult = {
                    success: true,
                    format,
                };
                expect(result.format).toBe(format);
            }
        });
    });
});
