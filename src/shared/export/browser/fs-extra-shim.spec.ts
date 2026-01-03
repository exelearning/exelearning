/**
 * Tests for fs-extra browser shim
 */
import { describe, it, expect } from 'bun:test';
import { ensureDir, writeFile, readFile, pathExists, remove, copy, mkdtemp } from './fs-extra-shim';

describe('fs-extra-shim', () => {
    describe('ensureDir', () => {
        it('should be a no-op function', async () => {
            // Should not throw
            await ensureDir('/some/path');
        });
    });

    describe('writeFile', () => {
        it('should be a no-op function', async () => {
            // Should not throw
            await writeFile('/some/path', 'content');
        });
    });

    describe('readFile', () => {
        it('should throw an error', async () => {
            await expect(readFile('/some/path')).rejects.toThrow('fs-extra is not available in browser');
        });
    });

    describe('pathExists', () => {
        it('should always return false', async () => {
            const result = await pathExists('/some/path');
            expect(result).toBe(false);
        });
    });

    describe('remove', () => {
        it('should be a no-op function', async () => {
            // Should not throw
            await remove('/some/path');
        });
    });

    describe('copy', () => {
        it('should be a no-op function', async () => {
            // Should not throw
            await copy('/src', '/dest');
        });
    });

    describe('mkdtemp', () => {
        it('should return a placeholder path', async () => {
            const result = await mkdtemp('prefix-');
            expect(result).toBe('/tmp/browser-shim');
        });
    });
});
