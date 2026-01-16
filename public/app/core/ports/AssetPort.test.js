import { describe, it, expect } from 'vitest';
import { AssetPort } from './AssetPort.js';

describe('AssetPort', () => {
    let port;

    beforeEach(() => {
        port = new AssetPort();
    });

    describe('interface definition', () => {
        it('should be a class', () => {
            expect(typeof AssetPort).toBe('function');
            expect(new AssetPort()).toBeInstanceOf(AssetPort);
        });

        it('should have all required methods', () => {
            expect(typeof port.upload).toBe('function');
            expect(typeof port.getUrl).toBe('function');
            expect(typeof port.getBlob).toBe('function');
            expect(typeof port.delete).toBe('function');
            expect(typeof port.list).toBe('function');
            expect(typeof port.exists).toBe('function');
            expect(typeof port.copy).toBe('function');
            expect(typeof port.move).toBe('function');
        });
    });

    describe('abstract methods throw not implemented errors', () => {
        it('upload() should throw not implemented error', async () => {
            await expect(port.upload('project-id', new Blob(), '/path')).rejects.toThrow(
                'AssetPort.upload() not implemented',
            );
        });

        it('getUrl() should throw not implemented error', async () => {
            await expect(port.getUrl('project-id', '/path')).rejects.toThrow(
                'AssetPort.getUrl() not implemented',
            );
        });

        it('getBlob() should throw not implemented error', async () => {
            await expect(port.getBlob('project-id', '/path')).rejects.toThrow(
                'AssetPort.getBlob() not implemented',
            );
        });

        it('delete() should throw not implemented error', async () => {
            await expect(port.delete('project-id', '/path')).rejects.toThrow(
                'AssetPort.delete() not implemented',
            );
        });

        it('list() should throw not implemented error', async () => {
            await expect(port.list('project-id')).rejects.toThrow('AssetPort.list() not implemented');
        });

        it('list() with directory should throw not implemented error', async () => {
            await expect(port.list('project-id', '/subdir')).rejects.toThrow(
                'AssetPort.list() not implemented',
            );
        });

        it('exists() should throw not implemented error', async () => {
            await expect(port.exists('project-id', '/path')).rejects.toThrow(
                'AssetPort.exists() not implemented',
            );
        });

        it('copy() should throw not implemented error', async () => {
            await expect(port.copy('project-id', '/src', '/dest')).rejects.toThrow(
                'AssetPort.copy() not implemented',
            );
        });

        it('move() should throw not implemented error', async () => {
            await expect(port.move('project-id', '/src', '/dest')).rejects.toThrow(
                'AssetPort.move() not implemented',
            );
        });
    });

    describe('default export', () => {
        it('should export AssetPort as default', async () => {
            const module = await import('./AssetPort.js');
            expect(module.default).toBe(AssetPort);
        });
    });
});
