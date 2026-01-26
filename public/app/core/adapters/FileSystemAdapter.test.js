/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { FileSystemAdapter } from './FileSystemAdapter.js';

describe('FileSystemAdapter', () => {
    describe('abstract methods', () => {
        it('should throw for saveAs()', async () => {
            const adapter = new FileSystemAdapter();
            await expect(adapter.saveAs(new Uint8Array(), 'test.txt')).rejects.toThrow('must be implemented');
        });

        it('should throw for save()', async () => {
            const adapter = new FileSystemAdapter();
            await expect(adapter.save(new Uint8Array(), 'key', 'test.txt')).rejects.toThrow('must be implemented');
        });

        it('should throw for open()', async () => {
            const adapter = new FileSystemAdapter();
            await expect(adapter.open(['txt'])).rejects.toThrow('must be implemented');
        });

        it('should throw for readFile()', async () => {
            const adapter = new FileSystemAdapter();
            await expect(adapter.readFile('/path/to/file')).rejects.toThrow('must be implemented');
        });

        it('should throw for exportToFolder()', async () => {
            const adapter = new FileSystemAdapter();
            await expect(adapter.exportToFolder(new Uint8Array(), 'folder')).rejects.toThrow('must be implemented');
        });
    });

    describe('supports', () => {
        it('should return false for any capability', () => {
            const adapter = new FileSystemAdapter();
            expect(adapter.supports('saveToPath')).toBe(false);
            expect(adapter.supports('exportToFolder')).toBe(false);
            expect(adapter.supports('readFile')).toBe(false);
        });
    });

    describe('getCurrentPath', () => {
        it('should return null', async () => {
            const adapter = new FileSystemAdapter();
            const path = await adapter.getCurrentPath();
            expect(path).toBeNull();
        });
    });
});
