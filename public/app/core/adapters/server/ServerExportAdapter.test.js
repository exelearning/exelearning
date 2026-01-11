import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerExportAdapter } from './ServerExportAdapter.js';

describe('ServerExportAdapter', () => {
    let adapter;
    let mockHttpClient;
    let mockEndpoints;

    beforeEach(() => {
        mockHttpClient = {
            baseUrl: 'http://localhost:8083',
            get: vi.fn(),
            post: vi.fn(),
            downloadBlob: vi.fn(),
            getText: vi.fn(),
        };

        mockEndpoints = {
            api_ode_export_preview: { path: '/api/ode/{odeSessionId}/preview' },
            api_idevices_download_ode_components: {
                path: '/api/ode/{odeSessionId}/block/{odeBlockId}/idevice/{odeIdeviceId}/download',
            },
        };

        adapter = new ServerExportAdapter(mockHttpClient, mockEndpoints, '/test');
    });

    describe('constructor', () => {
        it('should store httpClient, endpoints, and basePath', () => {
            expect(adapter.http).toBe(mockHttpClient);
            expect(adapter.endpoints).toBe(mockEndpoints);
            expect(adapter.basePath).toBe('/test');
        });

        it('should default endpoints to empty object', () => {
            const adapterWithoutEndpoints = new ServerExportAdapter(mockHttpClient);
            expect(adapterWithoutEndpoints.endpoints).toEqual({});
        });

        it('should default basePath to empty string', () => {
            const adapterWithoutPath = new ServerExportAdapter(mockHttpClient, {});
            expect(adapterWithoutPath.basePath).toBe('');
        });
    });

    describe('_getEndpoint', () => {
        it('should return endpoint path if exists', () => {
            expect(adapter._getEndpoint('api_ode_export_preview')).toBe('/api/ode/{odeSessionId}/preview');
        });

        it('should return null if endpoint not found', () => {
            expect(adapter._getEndpoint('nonexistent')).toBeNull();
        });
    });

    describe('exportAs', () => {
        it('should export in specified format', async () => {
            mockHttpClient.post.mockResolvedValue({ url: 'download-url' });

            const result = await adapter.exportAs('html5', { title: 'Test' }, { option: 'value' });

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/test/api/export/html5',
                { projectData: { title: 'Test' }, option: 'value' },
            );
            expect(result).toEqual({ url: 'download-url' });
        });
    });

    describe('getSupportedFormats', () => {
        it('should return list of supported formats', async () => {
            const formats = await adapter.getSupportedFormats();

            expect(formats).toBeInstanceOf(Array);
            expect(formats.length).toBe(6);
            expect(formats.some(f => f.id === 'html5')).toBe(true);
            expect(formats.some(f => f.id === 'scorm12')).toBe(true);
            expect(formats.some(f => f.id === 'scorm2004')).toBe(true);
            expect(formats.some(f => f.id === 'ims')).toBe(true);
            expect(formats.some(f => f.id === 'epub3')).toBe(true);
            expect(formats.some(f => f.id === 'xliff')).toBe(true);
        });

        it('should include name and extension for each format', async () => {
            const formats = await adapter.getSupportedFormats();

            formats.forEach(format => {
                expect(format).toHaveProperty('id');
                expect(format).toHaveProperty('name');
                expect(format).toHaveProperty('extension');
            });
        });
    });

    describe('isFormatSupported', () => {
        it('should return true for supported format', async () => {
            const result = await adapter.isFormatSupported('html5');
            expect(result).toBe(true);
        });

        it('should return false for unsupported format', async () => {
            const result = await adapter.isFormatSupported('unknown');
            expect(result).toBe(false);
        });
    });

    describe('generatePreview', () => {
        it('should generate preview', async () => {
            mockHttpClient.post.mockResolvedValue({ html: '<html></html>' });

            const result = await adapter.generatePreview({ title: 'Test' });

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/test/api/preview/generate',
                { title: 'Test' },
            );
            expect(result).toEqual({ html: '<html></html>' });
        });
    });

    describe('exportAsElpx', () => {
        it('should export as ELPX', async () => {
            mockHttpClient.post.mockResolvedValue({ blob: 'data' });

            const result = await adapter.exportAsElpx({ title: 'Test' }, { assets: [] });

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/test/api/export/elpx',
                { projectData: { title: 'Test' }, assets: { assets: [] } },
            );
            expect(result).toEqual({ blob: 'data' });
        });
    });

    describe('downloadExport', () => {
        it('should download export as blob', async () => {
            const mockBlob = new Blob(['data']);
            mockHttpClient.downloadBlob.mockResolvedValue(mockBlob);

            const result = await adapter.downloadExport('project-123', 'html5');

            expect(mockHttpClient.downloadBlob).toHaveBeenCalledWith(
                '/test/api/export/project-123/html5/download',
            );
            expect(result).toBe(mockBlob);
        });
    });

    describe('getExportStatus', () => {
        it('should get export status', async () => {
            mockHttpClient.get.mockResolvedValue({ status: 'complete', progress: 100 });

            const result = await adapter.getExportStatus('export-123');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/test/api/export/status/export-123');
            expect(result).toEqual({ status: 'complete', progress: 100 });
        });
    });

    describe('cancelExport', () => {
        it('should cancel export', async () => {
            mockHttpClient.post.mockResolvedValue({});

            await adapter.cancelExport('export-123');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/test/api/export/cancel/export-123',
                {},
            );
        });
    });

    describe('getPreviewUrl', () => {
        it('should use endpoint if available', async () => {
            mockHttpClient.get.mockResolvedValue({ previewUrl: 'http://preview' });

            const result = await adapter.getPreviewUrl('session-123');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/ode/session-123/preview');
            expect(result).toEqual({ previewUrl: 'http://preview' });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerExportAdapter(mockHttpClient, {}, '/test');
            mockHttpClient.get.mockResolvedValue({ previewUrl: 'http://preview' });

            await adapterWithoutEndpoints.getPreviewUrl('session-123');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/test/api/ode/session-123/preview');
        });
    });

    describe('downloadIDevice', () => {
        it('should use endpoint with replaced placeholders', async () => {
            mockHttpClient.getText.mockResolvedValue('<div>content</div>');

            const result = await adapter.downloadIDevice('session-123', 'block-456', 'idevice-789');

            expect(mockHttpClient.getText).toHaveBeenCalledWith(
                '/api/ode/session-123/block/block-456/idevice/idevice-789/download',
            );
            expect(result).toEqual({
                url: '/api/ode/session-123/block/block-456/idevice/idevice-789/download',
                response: '<div>content</div>',
            });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerExportAdapter(mockHttpClient, {}, '/test');
            mockHttpClient.getText.mockResolvedValue('content');

            await adapterWithoutEndpoints.downloadIDevice('s', 'b', 'i');

            expect(mockHttpClient.getText).toHaveBeenCalledWith(
                '/test/api/ode/s/block/b/idevice/i/download',
            );
        });
    });
});
