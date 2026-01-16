import { describe, it, expect, beforeEach } from 'vitest';
import { ContentPort } from './ContentPort.js';

describe('ContentPort', () => {
    let port;

    beforeEach(() => {
        port = new ContentPort();
    });

    describe('interface definition', () => {
        it('should be a class', () => {
            expect(typeof ContentPort).toBe('function');
            expect(new ContentPort()).toBeInstanceOf(ContentPort);
        });

        it('should have all required methods', () => {
            expect(typeof port.savePage).toBe('function');
            expect(typeof port.reorderPage).toBe('function');
            expect(typeof port.clonePage).toBe('function');
            expect(typeof port.deletePage).toBe('function');
            expect(typeof port.reorderBlock).toBe('function');
            expect(typeof port.deleteBlock).toBe('function');
            expect(typeof port.reorderIdevice).toBe('function');
            expect(typeof port.saveIdevice).toBe('function');
            expect(typeof port.cloneIdevice).toBe('function');
            expect(typeof port.deleteIdevice).toBe('function');
            expect(typeof port.send).toBe('function');
        });
    });

    describe('abstract methods throw not implemented errors', () => {
        it('savePage() should throw not implemented error', async () => {
            await expect(port.savePage({})).rejects.toThrow('ContentPort.savePage() not implemented');
        });

        it('reorderPage() should throw not implemented error', async () => {
            await expect(port.reorderPage({})).rejects.toThrow(
                'ContentPort.reorderPage() not implemented',
            );
        });

        it('clonePage() should throw not implemented error', async () => {
            await expect(port.clonePage({})).rejects.toThrow('ContentPort.clonePage() not implemented');
        });

        it('deletePage() should throw not implemented error', async () => {
            await expect(port.deletePage('page-id')).rejects.toThrow(
                'ContentPort.deletePage() not implemented',
            );
        });

        it('reorderBlock() should throw not implemented error', async () => {
            await expect(port.reorderBlock({})).rejects.toThrow(
                'ContentPort.reorderBlock() not implemented',
            );
        });

        it('deleteBlock() should throw not implemented error', async () => {
            await expect(port.deleteBlock('block-id')).rejects.toThrow(
                'ContentPort.deleteBlock() not implemented',
            );
        });

        it('reorderIdevice() should throw not implemented error', async () => {
            await expect(port.reorderIdevice({})).rejects.toThrow(
                'ContentPort.reorderIdevice() not implemented',
            );
        });

        it('saveIdevice() should throw not implemented error', async () => {
            await expect(port.saveIdevice({})).rejects.toThrow(
                'ContentPort.saveIdevice() not implemented',
            );
        });

        it('cloneIdevice() should throw not implemented error', async () => {
            await expect(port.cloneIdevice({})).rejects.toThrow(
                'ContentPort.cloneIdevice() not implemented',
            );
        });

        it('deleteIdevice() should throw not implemented error', async () => {
            await expect(port.deleteIdevice('idevice-id')).rejects.toThrow(
                'ContentPort.deleteIdevice() not implemented',
            );
        });

        it('send() should throw not implemented error', async () => {
            await expect(port.send('endpoint', {})).rejects.toThrow(
                'ContentPort.send() not implemented',
            );
        });
    });

    describe('default export', () => {
        it('should export ContentPort as default', async () => {
            const module = await import('./ContentPort.js');
            expect(module.default).toBe(ContentPort);
        });
    });
});
