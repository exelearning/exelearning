import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportPageAndDownload, buildPageFileName } from './pageExportHelper.js';

// Mock the downloadComponentFile import
vi.mock('../../project/idevices/content/componentDownloadHelper.js', () => ({
    downloadComponentFile: vi.fn().mockResolvedValue(undefined),
}));

import { downloadComponentFile } from '../../project/idevices/content/componentDownloadHelper.js';

describe('pageExportHelper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset window globals
        delete window.createExporter;
        delete window.SharedExporters;
        delete window.eXeLearning;
        // Mock global _ function for translations
        global._ = vi.fn((str) => str);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('buildPageFileName', () => {
        it('should generate filename from page name using sanitizePageFilename', () => {
            const mockSanitize = vi
                .fn()
                .mockImplementation((name) => name.replace(/\s+/g, '_'));
            window.SharedExporters = {
                Html5Exporter: {
                    prototype: {
                        sanitizePageFilename: mockSanitize,
                    },
                },
            };

            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Mi Página' }),
            };

            const filename = buildPageFileName('node-123', mockEngine);

            expect(mockEngine.getNode).toHaveBeenCalledWith('node-123');
            expect(mockSanitize).toHaveBeenCalledWith('Mi Página');
            expect(filename).toBe('Mi_Página.elpx');
        });

        it('should fallback to basic sanitization when sanitizePageFilename not available', () => {
            const mockEngine = {
                getNode: vi
                    .fn()
                    .mockReturnValue({ pageName: 'Page With Spaces!' }),
            };

            const filename = buildPageFileName('node-456', mockEngine);

            expect(filename).toBe('Page_With_Spaces_.elpx');
        });

        it('should return default filename when no page name exists', () => {
            const mockEngine = {
                getNode: vi.fn().mockReturnValue(null),
            };

            const filename = buildPageFileName('node-789', mockEngine);

            expect(filename).toBe('page_export.elpx');
        });

        it('should return default filename when node has no pageName property', () => {
            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ id: 'some-id' }),
            };

            const filename = buildPageFileName('node-abc', mockEngine);

            expect(filename).toBe('page_export.elpx');
        });

        it('should handle structureEngine being null', () => {
            const filename = buildPageFileName('node-xyz', null);
            expect(filename).toBe('page_export.elpx');
        });

        it('should handle structureEngine without getNode method', () => {
            const filename = buildPageFileName('node-def', {});
            expect(filename).toBe('page_export.elpx');
        });

        it('should preserve unicode characters in filename with fallback sanitization', () => {
            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Lección Básica' }),
            };

            const filename = buildPageFileName('node-uni', mockEngine);

            // Basic sanitization preserves unicode letters (\u00C0-\u024F)
            expect(filename).toBe('Lección_Básica.elpx');
        });
    });

    describe('exportPageAndDownload', () => {
        let mockExporter;
        let mockDocumentManager;
        let mockAssetCache;
        let mockAssetManager;

        let mockResourceFetcher;

        beforeEach(() => {
            // Setup mock exporter
            mockExporter = {
                export: vi.fn().mockResolvedValue({
                    success: true,
                    data: new Uint8Array([1, 2, 3]),
                }),
            };

            mockDocumentManager = { getMetadata: vi.fn() };
            mockAssetCache = {};
            mockAssetManager = {};
            mockResourceFetcher = { fetchContentCss: vi.fn() };

            // Setup window.createExporter
            window.createExporter = vi.fn().mockReturnValue(mockExporter);

            // Setup eXeLearning global
            window.eXeLearning = {
                app: {
                    project: {
                        _yjsBridge: {
                            documentManager: mockDocumentManager,
                            assetManager: mockAssetManager,
                            resourceFetcher: mockResourceFetcher,
                        },
                        _assetCache: mockAssetCache,
                    },
                },
            };

            // Mock URL methods
            window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
            window.URL.revokeObjectURL = vi.fn();
        });

        it('should throw error when createExporter is not available', async () => {
            delete window.createExporter;
            delete window.SharedExporters;

            const mockEngine = { getNode: vi.fn() };

            await expect(
                exportPageAndDownload('node-123', mockEngine)
            ).rejects.toThrow(
                'Export functionality not available. Please reload the page.'
            );
        });

        it('should use window.SharedExporters.createExporter as fallback', async () => {
            delete window.createExporter;
            window.SharedExporters = {
                createExporter: vi.fn().mockReturnValue(mockExporter),
            };

            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Test Page' }),
            };

            await exportPageAndDownload('node-123', mockEngine);

            expect(window.SharedExporters.createExporter).toHaveBeenCalledWith(
                'pageelpx',
                mockDocumentManager,
                mockAssetCache,
                mockResourceFetcher,
                mockAssetManager
            );
        });

        it('should throw error when Yjs bridge is not initialized', async () => {
            window.eXeLearning.app.project._yjsBridge = null;

            const mockEngine = { getNode: vi.fn() };

            await expect(
                exportPageAndDownload('node-123', mockEngine)
            ).rejects.toThrow('Yjs bridge not initialized');
        });

        it('should create exporter with correct parameters', async () => {
            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Test Page' }),
            };

            await exportPageAndDownload('node-123', mockEngine);

            expect(window.createExporter).toHaveBeenCalledWith(
                'pageelpx',
                mockDocumentManager,
                mockAssetCache,
                mockResourceFetcher,
                mockAssetManager
            );
        });

        it('should call exporter.export with rootPageId', async () => {
            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Test Page' }),
            };

            await exportPageAndDownload('node-456', mockEngine);

            expect(mockExporter.export).toHaveBeenCalledWith({
                rootPageId: 'node-456',
            });
        });

        it('should throw error when export fails', async () => {
            mockExporter.export.mockResolvedValue({
                success: false,
                error: 'Export error message',
            });

            const mockEngine = { getNode: vi.fn() };

            await expect(
                exportPageAndDownload('node-123', mockEngine)
            ).rejects.toThrow('Export error message');
        });

        it('should throw generic error when export fails without error message', async () => {
            mockExporter.export.mockResolvedValue({
                success: false,
            });

            const mockEngine = { getNode: vi.fn() };

            await expect(
                exportPageAndDownload('node-123', mockEngine)
            ).rejects.toThrow('Export failed');
        });

        it('should throw error when export returns no data', async () => {
            mockExporter.export.mockResolvedValue({
                success: true,
                data: null,
            });

            const mockEngine = { getNode: vi.fn() };

            await expect(
                exportPageAndDownload('node-123', mockEngine)
            ).rejects.toThrow('Export failed');
        });

        it('should create blob and call downloadComponentFile', async () => {
            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Test Page' }),
            };

            await exportPageAndDownload('node-123', mockEngine);

            expect(window.URL.createObjectURL).toHaveBeenCalledWith(
                expect.any(Blob)
            );
            expect(downloadComponentFile).toHaveBeenCalledWith(
                'blob:mock-url',
                'Test_Page.elpx',
                { typeKeySuffix: 'page', alwaysAskLocation: true }
            );
        });

        it('should revoke blob URL after download', async () => {
            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Test Page' }),
            };

            await exportPageAndDownload('node-123', mockEngine);

            expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(
                'blob:mock-url'
            );
        });

        it('should revoke blob URL even if download fails', async () => {
            downloadComponentFile.mockRejectedValueOnce(new Error('Download failed'));

            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Test Page' }),
            };

            await expect(
                exportPageAndDownload('node-123', mockEngine)
            ).rejects.toThrow('Download failed');

            expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(
                'blob:mock-url'
            );
        });

        it('should return success object on successful export', async () => {
            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Test Page' }),
            };

            const result = await exportPageAndDownload('node-123', mockEngine);

            expect(result).toEqual({ success: true });
        });

        it('should handle missing assetCache gracefully', async () => {
            window.eXeLearning.app.project._assetCache = undefined;

            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Test Page' }),
            };

            await exportPageAndDownload('node-123', mockEngine);

            expect(window.createExporter).toHaveBeenCalledWith(
                'pageelpx',
                mockDocumentManager,
                null,
                mockResourceFetcher,
                mockAssetManager
            );
        });

        it('should handle missing assetManager gracefully', async () => {
            window.eXeLearning.app.project._yjsBridge.assetManager = undefined;

            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Test Page' }),
            };

            await exportPageAndDownload('node-123', mockEngine);

            expect(window.createExporter).toHaveBeenCalledWith(
                'pageelpx',
                mockDocumentManager,
                mockAssetCache,
                mockResourceFetcher,
                null
            );
        });

        it('should handle missing resourceFetcher gracefully', async () => {
            window.eXeLearning.app.project._yjsBridge.resourceFetcher = undefined;

            const mockEngine = {
                getNode: vi.fn().mockReturnValue({ pageName: 'Test Page' }),
            };

            await exportPageAndDownload('node-123', mockEngine);

            expect(window.createExporter).toHaveBeenCalledWith(
                'pageelpx',
                mockDocumentManager,
                mockAssetCache,
                null,
                mockAssetManager
            );
        });
    });
});
