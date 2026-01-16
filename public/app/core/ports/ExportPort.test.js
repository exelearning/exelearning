import { describe, it, expect, beforeEach } from 'vitest';
import { ExportPort } from './ExportPort.js';

describe('ExportPort', () => {
    let port;

    beforeEach(() => {
        port = new ExportPort();
    });

    describe('interface definition', () => {
        it('should be a class', () => {
            expect(typeof ExportPort).toBe('function');
            expect(new ExportPort()).toBeInstanceOf(ExportPort);
        });

        it('should have all required methods', () => {
            expect(typeof port.exportAs).toBe('function');
            expect(typeof port.getSupportedFormats).toBe('function');
            expect(typeof port.isFormatSupported).toBe('function');
            expect(typeof port.generatePreview).toBe('function');
            expect(typeof port.exportAsElpx).toBe('function');
            expect(typeof port.getPreviewUrl).toBe('function');
            expect(typeof port.downloadIDevice).toBe('function');
        });
    });

    describe('abstract methods throw not implemented errors', () => {
        it('exportAs() should throw not implemented error', async () => {
            await expect(port.exportAs('html5', {})).rejects.toThrow(
                'ExportPort.exportAs() not implemented',
            );
        });

        it('exportAs() with options should throw not implemented error', async () => {
            await expect(port.exportAs('scorm12', {}, { version: '1.2' })).rejects.toThrow(
                'ExportPort.exportAs() not implemented',
            );
        });

        it('getSupportedFormats() should throw not implemented error', async () => {
            await expect(port.getSupportedFormats()).rejects.toThrow(
                'ExportPort.getSupportedFormats() not implemented',
            );
        });

        it('isFormatSupported() should throw not implemented error', async () => {
            await expect(port.isFormatSupported('html5')).rejects.toThrow(
                'ExportPort.isFormatSupported() not implemented',
            );
        });

        it('generatePreview() should throw not implemented error', async () => {
            await expect(port.generatePreview({})).rejects.toThrow(
                'ExportPort.generatePreview() not implemented',
            );
        });

        it('exportAsElpx() should throw not implemented error', async () => {
            await expect(port.exportAsElpx({}, {})).rejects.toThrow(
                'ExportPort.exportAsElpx() not implemented',
            );
        });

        it('getPreviewUrl() should throw not implemented error', async () => {
            await expect(port.getPreviewUrl('session-id')).rejects.toThrow(
                'ExportPort.getPreviewUrl() not implemented',
            );
        });

        it('downloadIDevice() should throw not implemented error', async () => {
            await expect(port.downloadIDevice('session-id', 'block-id', 'idevice-id')).rejects.toThrow(
                'ExportPort.downloadIDevice() not implemented',
            );
        });
    });

    describe('default export', () => {
        it('should export ExportPort as default', async () => {
            const module = await import('./ExportPort.js');
            expect(module.default).toBe(ExportPort);
        });
    });
});
