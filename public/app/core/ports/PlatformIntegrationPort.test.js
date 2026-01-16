import { describe, it, expect, beforeEach } from 'vitest';
import { PlatformIntegrationPort } from './PlatformIntegrationPort.js';

describe('PlatformIntegrationPort', () => {
    let port;

    beforeEach(() => {
        port = new PlatformIntegrationPort();
    });

    describe('interface definition', () => {
        it('should be a class', () => {
            expect(typeof PlatformIntegrationPort).toBe('function');
            expect(new PlatformIntegrationPort()).toBeInstanceOf(PlatformIntegrationPort);
        });

        it('should have all required methods', () => {
            expect(typeof port.uploadElp).toBe('function');
            expect(typeof port.openElp).toBe('function');
            expect(typeof port.isSupported).toBe('function');
        });
    });

    describe('abstract methods throw not implemented errors', () => {
        it('uploadElp() should throw not implemented error', async () => {
            await expect(
                port.uploadElp({ platformId: 'moodle', projectId: 'project-id' }),
            ).rejects.toThrow('PlatformIntegrationPort.uploadElp() not implemented');
        });

        it('openElp() should throw not implemented error', async () => {
            await expect(port.openElp({ platformId: 'moodle', fileId: 'file-id' })).rejects.toThrow(
                'PlatformIntegrationPort.openElp() not implemented',
            );
        });
    });

    describe('default implementation methods', () => {
        it('isSupported() should return true by default', () => {
            expect(port.isSupported()).toBe(true);
        });
    });

    describe('default export', () => {
        it('should export PlatformIntegrationPort as default', async () => {
            const module = await import('./PlatformIntegrationPort.js');
            expect(module.default).toBe(PlatformIntegrationPort);
        });
    });
});
