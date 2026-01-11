import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StaticExportAdapter } from './StaticExportAdapter.js';

describe('StaticExportAdapter', () => {
    let adapter;
    let mockExporter;

    beforeEach(() => {
        mockExporter = {
            exportToHtml5: vi.fn().mockResolvedValue({ blob: 'html5' }),
            exportToScorm12: vi.fn().mockResolvedValue({ blob: 'scorm12' }),
            exportToScorm2004: vi.fn().mockResolvedValue({ blob: 'scorm2004' }),
            exportToIms: vi.fn().mockResolvedValue({ blob: 'ims' }),
            exportToEpub3: vi.fn().mockResolvedValue({ blob: 'epub3' }),
            exportToXliff: vi.fn().mockResolvedValue({ blob: 'xliff' }),
            generatePreviewHtml: vi.fn().mockResolvedValue('<html></html>'),
            exportToElpx: vi.fn().mockResolvedValue({ blob: 'elpx' }),
        };

        adapter = new StaticExportAdapter({
            getExporter: () => mockExporter,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should accept custom getExporter function', () => {
            const customGetter = () => mockExporter;
            const customAdapter = new StaticExportAdapter({ getExporter: customGetter });
            expect(customAdapter.getExporter()).toBe(mockExporter);
        });

        it('should default to window.eXeLearning.app.elpxExporter', () => {
            window.eXeLearning = { app: { elpxExporter: mockExporter } };

            const defaultAdapter = new StaticExportAdapter();
            expect(defaultAdapter.getExporter()).toBe(mockExporter);

            delete window.eXeLearning;
        });
    });

    describe('exportAs', () => {
        it('should export as html5', async () => {
            const result = await adapter.exportAs('html5', { title: 'Test' }, { option: true });

            expect(mockExporter.exportToHtml5).toHaveBeenCalledWith(
                { title: 'Test' },
                { option: true },
            );
            expect(result).toEqual({ blob: 'html5' });
        });

        it('should export as scorm12', async () => {
            const result = await adapter.exportAs('scorm12', { title: 'Test' });

            expect(mockExporter.exportToScorm12).toHaveBeenCalled();
            expect(result).toEqual({ blob: 'scorm12' });
        });

        it('should export as scorm2004', async () => {
            const result = await adapter.exportAs('scorm2004', { title: 'Test' });

            expect(mockExporter.exportToScorm2004).toHaveBeenCalled();
            expect(result).toEqual({ blob: 'scorm2004' });
        });

        it('should export as ims', async () => {
            const result = await adapter.exportAs('ims', { title: 'Test' });

            expect(mockExporter.exportToIms).toHaveBeenCalled();
            expect(result).toEqual({ blob: 'ims' });
        });

        it('should export as epub3', async () => {
            const result = await adapter.exportAs('epub3', { title: 'Test' });

            expect(mockExporter.exportToEpub3).toHaveBeenCalled();
            expect(result).toEqual({ blob: 'epub3' });
        });

        it('should export as xliff', async () => {
            const result = await adapter.exportAs('xliff', { title: 'Test' });

            expect(mockExporter.exportToXliff).toHaveBeenCalled();
            expect(result).toEqual({ blob: 'xliff' });
        });

        it('should throw for unsupported format', async () => {
            await expect(adapter.exportAs('unknown', {})).rejects.toThrow('Unsupported export format');
        });

        it('should throw if exporter not available', async () => {
            const adapterWithoutExporter = new StaticExportAdapter({
                getExporter: () => null,
            });

            await expect(adapterWithoutExporter.exportAs('html5', {})).rejects.toThrow(
                'Exporter not available',
            );
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
        it('should generate preview using exporter', async () => {
            const result = await adapter.generatePreview({ title: 'Test' });

            expect(mockExporter.generatePreviewHtml).toHaveBeenCalledWith({ title: 'Test' });
            expect(result).toBe('<html></html>');
        });

        it('should throw if exporter not available', async () => {
            const adapterWithoutExporter = new StaticExportAdapter({
                getExporter: () => null,
            });

            await expect(adapterWithoutExporter.generatePreview({})).rejects.toThrow(
                'Exporter not available',
            );
        });
    });

    describe('exportAsElpx', () => {
        it('should export as ELPX using exporter', async () => {
            const result = await adapter.exportAsElpx({ title: 'Test' }, { assets: [] });

            expect(mockExporter.exportToElpx).toHaveBeenCalledWith(
                { title: 'Test' },
                { assets: [] },
            );
            expect(result).toEqual({ blob: 'elpx' });
        });

        it('should throw if exporter not available', async () => {
            const adapterWithoutExporter = new StaticExportAdapter({
                getExporter: () => null,
            });

            await expect(adapterWithoutExporter.exportAsElpx({}, {})).rejects.toThrow(
                'Exporter not available',
            );
        });
    });

    describe('getPreviewUrl', () => {
        it('should return client-side preview indicator', async () => {
            const result = await adapter.getPreviewUrl('session-123');

            expect(result).toEqual({
                responseMessage: 'OK',
                clientSidePreview: true,
            });
        });
    });

    describe('downloadIDevice', () => {
        it('should return NOT_SUPPORTED in static mode', async () => {
            const result = await adapter.downloadIDevice('s', 'b', 'i');

            expect(result).toEqual({
                url: '',
                response: '',
                responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE',
            });
        });
    });
});
