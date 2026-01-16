import { describe, it, expect, beforeEach } from 'vitest';
import { CatalogPort } from './CatalogPort.js';

describe('CatalogPort', () => {
    let port;

    beforeEach(() => {
        port = new CatalogPort();
    });

    describe('interface definition', () => {
        it('should be a class', () => {
            expect(typeof CatalogPort).toBe('function');
            expect(new CatalogPort()).toBeInstanceOf(CatalogPort);
        });

        it('should have all required methods', () => {
            expect(typeof port.getIDevices).toBe('function');
            expect(typeof port.getThemes).toBe('function');
            expect(typeof port.getLocales).toBe('function');
            expect(typeof port.getTranslations).toBe('function');
            expect(typeof port.getIDevice).toBe('function');
            expect(typeof port.getTheme).toBe('function');
            expect(typeof port.getLicenses).toBe('function');
            expect(typeof port.getExportFormats).toBe('function');
            expect(typeof port.getTemplates).toBe('function');
            expect(typeof port.getComponentHtmlTemplate).toBe('function');
            expect(typeof port.createTheme).toBe('function');
            expect(typeof port.updateTheme).toBe('function');
            expect(typeof port.getApiParameters).toBe('function');
            expect(typeof port.getChangelog).toBe('function');
            expect(typeof port.getUploadLimits).toBe('function');
            expect(typeof port.getThirdPartyCode).toBe('function');
            expect(typeof port.getLicensesList).toBe('function');
            expect(typeof port.getSaveHtmlView).toBe('function');
            expect(typeof port.getIdevicesBySessionId).toBe('function');
        });
    });

    describe('abstract methods throw not implemented errors', () => {
        it('getIDevices() should throw not implemented error', async () => {
            await expect(port.getIDevices()).rejects.toThrow('CatalogPort.getIDevices() not implemented');
        });

        it('getThemes() should throw not implemented error', async () => {
            await expect(port.getThemes()).rejects.toThrow('CatalogPort.getThemes() not implemented');
        });

        it('getLocales() should throw not implemented error', async () => {
            await expect(port.getLocales()).rejects.toThrow('CatalogPort.getLocales() not implemented');
        });

        it('getTranslations() should throw not implemented error', async () => {
            await expect(port.getTranslations('es')).rejects.toThrow(
                'CatalogPort.getTranslations() not implemented',
            );
        });

        it('getIDevice() should throw not implemented error', async () => {
            await expect(port.getIDevice('text')).rejects.toThrow(
                'CatalogPort.getIDevice() not implemented',
            );
        });

        it('getTheme() should throw not implemented error', async () => {
            await expect(port.getTheme('base')).rejects.toThrow('CatalogPort.getTheme() not implemented');
        });

        it('getLicenses() should throw not implemented error', async () => {
            await expect(port.getLicenses()).rejects.toThrow('CatalogPort.getLicenses() not implemented');
        });

        it('getExportFormats() should throw not implemented error', async () => {
            await expect(port.getExportFormats()).rejects.toThrow(
                'CatalogPort.getExportFormats() not implemented',
            );
        });

        it('getTemplates() should throw not implemented error', async () => {
            await expect(port.getTemplates('es')).rejects.toThrow(
                'CatalogPort.getTemplates() not implemented',
            );
        });

        it('getComponentHtmlTemplate() should throw not implemented error', async () => {
            await expect(port.getComponentHtmlTemplate('comp-id')).rejects.toThrow(
                'CatalogPort.getComponentHtmlTemplate() not implemented',
            );
        });

        it('createTheme() should throw not implemented error', async () => {
            await expect(port.createTheme({})).rejects.toThrow(
                'CatalogPort.createTheme() not implemented',
            );
        });

        it('updateTheme() should throw not implemented error', async () => {
            await expect(port.updateTheme('theme-dir', {})).rejects.toThrow(
                'CatalogPort.updateTheme() not implemented',
            );
        });

        it('getApiParameters() should throw not implemented error', async () => {
            await expect(port.getApiParameters()).rejects.toThrow(
                'CatalogPort.getApiParameters() not implemented',
            );
        });

        it('getChangelog() should throw not implemented error', async () => {
            await expect(port.getChangelog()).rejects.toThrow(
                'CatalogPort.getChangelog() not implemented',
            );
        });

        it('getUploadLimits() should throw not implemented error', async () => {
            await expect(port.getUploadLimits()).rejects.toThrow(
                'CatalogPort.getUploadLimits() not implemented',
            );
        });

        it('getThirdPartyCode() should throw not implemented error', async () => {
            await expect(port.getThirdPartyCode()).rejects.toThrow(
                'CatalogPort.getThirdPartyCode() not implemented',
            );
        });

        it('getLicensesList() should throw not implemented error', async () => {
            await expect(port.getLicensesList()).rejects.toThrow(
                'CatalogPort.getLicensesList() not implemented',
            );
        });

        it('getSaveHtmlView() should throw not implemented error', async () => {
            await expect(port.getSaveHtmlView('comp-id')).rejects.toThrow(
                'CatalogPort.getSaveHtmlView() not implemented',
            );
        });

        it('getIdevicesBySessionId() should throw not implemented error', async () => {
            await expect(port.getIdevicesBySessionId('session-id')).rejects.toThrow(
                'CatalogPort.getIdevicesBySessionId() not implemented',
            );
        });
    });

    describe('default export', () => {
        it('should export CatalogPort as default', async () => {
            const module = await import('./CatalogPort.js');
            expect(module.default).toBe(CatalogPort);
        });
    });
});
