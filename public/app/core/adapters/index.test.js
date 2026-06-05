/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import {
    FileSystemAdapter,
    ElectronFileSystem,
    WebFileSystem,
    EmbeddedFileSystem,
} from './index.js';

describe('adapters/index', () => {
    describe('exports', () => {
        it('should export FileSystemAdapter', () => {
            expect(FileSystemAdapter).toBeDefined();
        });

        it('should export ElectronFileSystem', () => {
            expect(ElectronFileSystem).toBeDefined();
        });

        it('should export WebFileSystem', () => {
            expect(WebFileSystem).toBeDefined();
        });

        it('should export EmbeddedFileSystem', () => {
            expect(EmbeddedFileSystem).toBeDefined();
        });
    });
});
