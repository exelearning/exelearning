import { describe, it, expect, beforeEach } from 'vitest';
import { LinkValidationPort } from './LinkValidationPort.js';

describe('LinkValidationPort', () => {
    let port;

    beforeEach(() => {
        port = new LinkValidationPort();
    });

    describe('interface definition', () => {
        it('should be a class', () => {
            expect(typeof LinkValidationPort).toBe('function');
            expect(new LinkValidationPort()).toBeInstanceOf(LinkValidationPort);
        });

        it('should have all required methods', () => {
            expect(typeof port.getSessionBrokenLinks).toBe('function');
            expect(typeof port.extractLinks).toBe('function');
            expect(typeof port.getValidationStreamUrl).toBe('function');
            expect(typeof port.getPageBrokenLinks).toBe('function');
            expect(typeof port.getBlockBrokenLinks).toBe('function');
            expect(typeof port.getIdeviceBrokenLinks).toBe('function');
            expect(typeof port.isSupported).toBe('function');
        });
    });

    describe('abstract methods throw not implemented errors', () => {
        it('getSessionBrokenLinks() should throw not implemented error', async () => {
            await expect(port.getSessionBrokenLinks({ odeSessionId: 'session-id' })).rejects.toThrow(
                'LinkValidationPort.getSessionBrokenLinks() not implemented',
            );
        });

        it('extractLinks() should throw not implemented error', async () => {
            await expect(
                port.extractLinks({ odeSessionId: 'session-id', idevices: [] }),
            ).rejects.toThrow('LinkValidationPort.extractLinks() not implemented');
        });

        it('getValidationStreamUrl() should throw not implemented error', () => {
            expect(() => port.getValidationStreamUrl()).toThrow(
                'LinkValidationPort.getValidationStreamUrl() not implemented',
            );
        });

        it('getPageBrokenLinks() should throw not implemented error', async () => {
            await expect(port.getPageBrokenLinks('page-id')).rejects.toThrow(
                'LinkValidationPort.getPageBrokenLinks() not implemented',
            );
        });

        it('getBlockBrokenLinks() should throw not implemented error', async () => {
            await expect(port.getBlockBrokenLinks('block-id')).rejects.toThrow(
                'LinkValidationPort.getBlockBrokenLinks() not implemented',
            );
        });

        it('getIdeviceBrokenLinks() should throw not implemented error', async () => {
            await expect(port.getIdeviceBrokenLinks('idevice-id')).rejects.toThrow(
                'LinkValidationPort.getIdeviceBrokenLinks() not implemented',
            );
        });
    });

    describe('default implementation methods', () => {
        it('isSupported() should return true by default', () => {
            expect(port.isSupported()).toBe(true);
        });
    });

    describe('default export', () => {
        it('should export LinkValidationPort as default', async () => {
            const module = await import('./LinkValidationPort.js');
            expect(module.default).toBe(LinkValidationPort);
        });
    });
});
