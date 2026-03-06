/**
 * Tests for ZIP Service
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { createZipService, type ZipService } from './zip';

describe('ZIP Service', () => {
    const testDir = path.join(process.cwd(), 'test', 'temp', 'zip-service-test');
    let zipService: ZipService;

    beforeEach(async () => {
        await fs.ensureDir(testDir);
        // Create a fresh ZipService instance for each test
        zipService = createZipService();
    });

    afterEach(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('extractZip', () => {
        it('should extract ZIP file to target directory', async () => {
            // Create a source directory with test files
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'test.txt'), 'Hello World');

            // Create ZIP file
            const zipPath = path.join(testDir, 'test.zip');
            await zipService.createZip(sourceDir, zipPath);

            // Extract
            const extractDir = path.join(testDir, 'extracted');
            const files = await zipService.extractZip(zipPath, extractDir);

            expect(files).toContain('test.txt');
            expect(await fs.pathExists(path.join(extractDir, 'test.txt'))).toBe(true);
            expect(await fs.readFile(path.join(extractDir, 'test.txt'), 'utf-8')).toBe('Hello World');
        });

        it('should handle nested directories', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(path.join(sourceDir, 'subdir', 'nested'));
            await fs.writeFile(path.join(sourceDir, 'root.txt'), 'root');
            await fs.writeFile(path.join(sourceDir, 'subdir', 'sub.txt'), 'sub');
            await fs.writeFile(path.join(sourceDir, 'subdir', 'nested', 'deep.txt'), 'deep');

            const zipPath = path.join(testDir, 'nested.zip');
            await zipService.createZip(sourceDir, zipPath);

            const extractDir = path.join(testDir, 'extracted');
            const files = await zipService.extractZip(zipPath, extractDir);

            expect(files).toContain('root.txt');
            expect(files.some(f => f.includes('sub.txt'))).toBe(true);
            expect(files.some(f => f.includes('deep.txt'))).toBe(true);
            expect(await fs.pathExists(path.join(extractDir, 'subdir', 'nested', 'deep.txt'))).toBe(true);
        });
    });

    describe('extractZipFromBuffer', () => {
        it('should extract ZIP from valid buffer', async () => {
            // Create a source directory with test files
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'test.txt'), 'Hello World');

            // Create ZIP buffer
            const zipBuffer = await zipService.createZipBuffer(sourceDir);

            // Extract from buffer
            const extractDir = path.join(testDir, 'extracted');
            const files = await zipService.extractZipFromBuffer(zipBuffer, extractDir);

            expect(files).toContain('test.txt');
            expect(await fs.pathExists(path.join(extractDir, 'test.txt'))).toBe(true);
            expect(await fs.readFile(path.join(extractDir, 'test.txt'), 'utf-8')).toBe('Hello World');
        });

        it('should handle nested directories', async () => {
            // Create source with nested structure
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(path.join(sourceDir, 'subdir', 'nested'));
            await fs.writeFile(path.join(sourceDir, 'root.txt'), 'root');
            await fs.writeFile(path.join(sourceDir, 'subdir', 'sub.txt'), 'sub');
            await fs.writeFile(path.join(sourceDir, 'subdir', 'nested', 'deep.txt'), 'deep');

            const zipBuffer = await zipService.createZipBuffer(sourceDir);

            const extractDir = path.join(testDir, 'extracted');
            const files = await zipService.extractZipFromBuffer(zipBuffer, extractDir);

            expect(files).toContain('root.txt');
            expect(files.some(f => f.includes('sub.txt'))).toBe(true);
            expect(files.some(f => f.includes('deep.txt'))).toBe(true);
            expect(await fs.pathExists(path.join(extractDir, 'subdir', 'nested', 'deep.txt'))).toBe(true);
        });

        it('should handle binary files', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            // Create a binary file (simple PNG header)
            const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            await fs.writeFile(path.join(sourceDir, 'test.bin'), binaryData);

            const zipBuffer = await zipService.createZipBuffer(sourceDir);
            const extractDir = path.join(testDir, 'extracted');
            await zipService.extractZipFromBuffer(zipBuffer, extractDir);

            const extracted = await fs.readFile(path.join(extractDir, 'test.bin'));
            expect(extracted).toEqual(binaryData);
        });

        it('should reject path traversal in zip (Zip Slip)', async () => {
            const evilZipService = createZipService({
                fflate: {
                    unzipSync: () => {
                        return {
                            '../../evil.txt': new Uint8Array([1, 2, 3]),
                        };
                    },
                } as any,
            });

            const extractDir = path.join(testDir, 'extracted_safe');
            await fs.ensureDir(extractDir);

            const dummyBuffer = Buffer.from([]);
            let errorCaught = false;
            try {
                await evilZipService.extractZipFromBuffer(dummyBuffer, extractDir);
            } catch (err: any) {
                errorCaught = true;
                expect(err.message).toContain('Security error: invalid file paths detected');
            }
            expect(errorCaught).toBe(true);

            // Ensure file was not extracted outside
            const evilPath = path.join(extractDir, '../../evil.txt');
            expect(await fs.pathExists(evilPath)).toBe(false);
        });
    });

    describe('createZip', () => {
        it('should create ZIP from directory', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
            await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'content2');

            const outputPath = path.join(testDir, 'output.zip');
            await zipService.createZip(sourceDir, outputPath);

            expect(await fs.pathExists(outputPath)).toBe(true);
            const contents = await zipService.listZipContents(outputPath);
            expect(contents).toContain('file1.txt');
            expect(contents).toContain('file2.txt');
        });

        it('should use custom compression level', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            // Create a compressible file
            await fs.writeFile(path.join(sourceDir, 'test.txt'), 'A'.repeat(10000));

            const outputHigh = path.join(testDir, 'high.zip');
            const outputLow = path.join(testDir, 'low.zip');

            await zipService.createZip(sourceDir, outputHigh, { compressionLevel: 9 });
            await zipService.createZip(sourceDir, outputLow, { compressionLevel: 1 });

            // Both should exist
            expect(await fs.pathExists(outputHigh)).toBe(true);
            expect(await fs.pathExists(outputLow)).toBe(true);

            // Higher compression should generally produce smaller file
            const highSize = (await fs.stat(outputHigh)).size;
            const lowSize = (await fs.stat(outputLow)).size;
            expect(highSize).toBeLessThanOrEqual(lowSize);
        });

        it('should handle empty directories', async () => {
            const sourceDir = path.join(testDir, 'empty');
            await fs.ensureDir(sourceDir);

            const outputPath = path.join(testDir, 'empty.zip');
            await zipService.createZip(sourceDir, outputPath);

            expect(await fs.pathExists(outputPath)).toBe(true);
        });

        it('should include subdirectories', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(path.join(sourceDir, 'subdir'));
            await fs.writeFile(path.join(sourceDir, 'root.txt'), 'root');
            await fs.writeFile(path.join(sourceDir, 'subdir', 'nested.txt'), 'nested');

            const outputPath = path.join(testDir, 'with-dirs.zip');
            await zipService.createZip(sourceDir, outputPath);

            const contents = await zipService.listZipContents(outputPath);
            expect(contents).toContain('root.txt');
            expect(contents.some(f => f.includes('nested.txt'))).toBe(true);
        });
    });

    describe('createZipBuffer', () => {
        it('should create ZIP buffer from directory', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'test.txt'), 'Hello');

            const buffer = await zipService.createZipBuffer(sourceDir);

            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(0);

            // Verify it's a valid ZIP by extracting
            const extractDir = path.join(testDir, 'extracted');
            const files = await zipService.extractZipFromBuffer(buffer, extractDir);
            expect(files).toContain('test.txt');
        });

        it('should handle deeply nested folders', async () => {
            const sourceDir = path.join(testDir, 'source');
            const deepPath = path.join(sourceDir, 'a', 'b', 'c', 'd', 'e');
            await fs.ensureDir(deepPath);
            await fs.writeFile(path.join(deepPath, 'deep.txt'), 'very deep');

            const buffer = await zipService.createZipBuffer(sourceDir);

            const extractDir = path.join(testDir, 'extracted');
            await zipService.extractZipFromBuffer(buffer, extractDir);

            expect(await fs.pathExists(path.join(extractDir, 'a', 'b', 'c', 'd', 'e', 'deep.txt'))).toBe(true);
        });

        it('should handle multiple file types', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'text.txt'), 'text content');
            await fs.writeFile(path.join(sourceDir, 'data.json'), '{"key": "value"}');
            await fs.writeFile(path.join(sourceDir, 'binary.bin'), Buffer.from([1, 2, 3, 4]));

            const buffer = await zipService.createZipBuffer(sourceDir);
            const extractDir = path.join(testDir, 'extracted');
            const files = await zipService.extractZipFromBuffer(buffer, extractDir);

            expect(files).toContain('text.txt');
            expect(files).toContain('data.json');
            expect(files).toContain('binary.bin');
        });
    });

    describe('addToZip', () => {
        it('should create new ZIP if file does not exist', async () => {
            const zipPath = path.join(testDir, 'new.zip');
            const testFile = path.join(testDir, 'test.txt');
            await fs.writeFile(testFile, 'test content');

            expect(await fs.pathExists(zipPath)).toBe(false);

            await zipService.addToZip(zipPath, [{ path: testFile, name: 'test.txt' }]);

            expect(await fs.pathExists(zipPath)).toBe(true);
            const contents = await zipService.listZipContents(zipPath);
            expect(contents).toContain('test.txt');
        });

        it('should append to existing ZIP', async () => {
            // Create initial ZIP
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'original.txt'), 'original');
            const zipPath = path.join(testDir, 'existing.zip');
            await zipService.createZip(sourceDir, zipPath);

            // Add new file
            const newFile = path.join(testDir, 'new.txt');
            await fs.writeFile(newFile, 'new content');
            await zipService.addToZip(zipPath, [{ path: newFile, name: 'new.txt' }]);

            const contents = await zipService.listZipContents(zipPath);
            expect(contents).toContain('original.txt');
            expect(contents).toContain('new.txt');
        });

        it('should add multiple files', async () => {
            const zipPath = path.join(testDir, 'multi.zip');
            const file1 = path.join(testDir, 'file1.txt');
            const file2 = path.join(testDir, 'file2.txt');
            const file3 = path.join(testDir, 'file3.txt');

            await fs.writeFile(file1, 'content1');
            await fs.writeFile(file2, 'content2');
            await fs.writeFile(file3, 'content3');

            await zipService.addToZip(zipPath, [
                { path: file1, name: 'file1.txt' },
                { path: file2, name: 'subdir/file2.txt' },
                { path: file3, name: 'file3.txt' },
            ]);

            const contents = await zipService.listZipContents(zipPath);
            expect(contents).toContain('file1.txt');
            expect(contents).toContain('subdir/file2.txt');
            expect(contents).toContain('file3.txt');
        });

        it('should overwrite existing file in ZIP', async () => {
            const zipPath = path.join(testDir, 'overwrite.zip');
            const testFile = path.join(testDir, 'test.txt');

            // Add initial file
            await fs.writeFile(testFile, 'original');
            await zipService.addToZip(zipPath, [{ path: testFile, name: 'test.txt' }]);

            // Overwrite with new content
            await fs.writeFile(testFile, 'updated');
            await zipService.addToZip(zipPath, [{ path: testFile, name: 'test.txt' }]);

            const content = await zipService.readFileFromZipAsString(zipPath, 'test.txt');
            expect(content).toBe('updated');
        });
    });

    describe('readFileFromZip', () => {
        it('should read file from ZIP', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'test.txt'), 'Hello World');

            const zipPath = path.join(testDir, 'test.zip');
            await zipService.createZip(sourceDir, zipPath);

            const buffer = await zipService.readFileFromZip(zipPath, 'test.txt');
            expect(buffer).not.toBeNull();
            expect(buffer!.toString('utf-8')).toBe('Hello World');
        });

        it('should return null for non-existent file', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'exists.txt'), 'content');

            const zipPath = path.join(testDir, 'test.zip');
            await zipService.createZip(sourceDir, zipPath);

            const buffer = await zipService.readFileFromZip(zipPath, 'nonexistent.txt');
            expect(buffer).toBeNull();
        });

        it('should read binary file correctly', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            const binaryData = Buffer.from([0x00, 0xff, 0x10, 0x20, 0x30]);
            await fs.writeFile(path.join(sourceDir, 'binary.bin'), binaryData);

            const zipPath = path.join(testDir, 'test.zip');
            await zipService.createZip(sourceDir, zipPath);

            const buffer = await zipService.readFileFromZip(zipPath, 'binary.bin');
            expect(buffer).toEqual(binaryData);
        });
    });

    describe('readFileFromZipAsString', () => {
        it('should read file as UTF-8 string', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'test.txt'), 'Hello UTF-8 World!');

            const zipPath = path.join(testDir, 'test.zip');
            await zipService.createZip(sourceDir, zipPath);

            const content = await zipService.readFileFromZipAsString(zipPath, 'test.txt');
            expect(content).toBe('Hello UTF-8 World!');
        });

        it('should return null for non-existent file', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'exists.txt'), 'content');

            const zipPath = path.join(testDir, 'test.zip');
            await zipService.createZip(sourceDir, zipPath);

            const content = await zipService.readFileFromZipAsString(zipPath, 'missing.txt');
            expect(content).toBeNull();
        });

        it('should handle unicode content', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            const unicodeContent = 'Hello 世界! Привет мир! 🌍';
            await fs.writeFile(path.join(sourceDir, 'unicode.txt'), unicodeContent);

            const zipPath = path.join(testDir, 'test.zip');
            await zipService.createZip(sourceDir, zipPath);

            const content = await zipService.readFileFromZipAsString(zipPath, 'unicode.txt');
            expect(content).toBe(unicodeContent);
        });
    });

    describe('fileExistsInZip', () => {
        it('should return true for existing file', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'exists.txt'), 'content');

            const zipPath = path.join(testDir, 'test.zip');
            await zipService.createZip(sourceDir, zipPath);

            expect(await zipService.fileExistsInZip(zipPath, 'exists.txt')).toBe(true);
        });

        it('should return false for non-existent file', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'exists.txt'), 'content');

            const zipPath = path.join(testDir, 'test.zip');
            await zipService.createZip(sourceDir, zipPath);

            expect(await zipService.fileExistsInZip(zipPath, 'missing.txt')).toBe(false);
        });
    });

    describe('listZipContents', () => {
        it('should list all files in ZIP', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(path.join(sourceDir, 'subdir'));
            await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
            await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'content2');
            await fs.writeFile(path.join(sourceDir, 'subdir', 'file3.txt'), 'content3');

            const zipPath = path.join(testDir, 'test.zip');
            await zipService.createZip(sourceDir, zipPath);

            const contents = await zipService.listZipContents(zipPath);
            expect(contents).toContain('file1.txt');
            expect(contents).toContain('file2.txt');
            expect(contents.some(f => f.includes('file3.txt'))).toBe(true);
        });

        it('should not include directory entries', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(path.join(sourceDir, 'emptydir'));
            await fs.ensureDir(path.join(sourceDir, 'subdir'));
            await fs.writeFile(path.join(sourceDir, 'subdir', 'file.txt'), 'content');

            const zipPath = path.join(testDir, 'test.zip');
            await zipService.createZip(sourceDir, zipPath);

            const contents = await zipService.listZipContents(zipPath);
            // Should only contain file, not directories
            for (const item of contents) {
                expect(item.endsWith('/')).toBe(false);
            }
        });
    });

    describe('dependency injection', () => {
        it('should use injected fs module', async () => {
            let _readFileCalled = false;
            const mockFs = {
                readFile: async () => {
                    _readFileCalled = true;
                    return Buffer.from('PK'); // Minimal ZIP signature
                },
                ensureDir: async () => {},
                writeFile: async () => {},
                pathExists: async () => true,
            } as any;

            // We can't fully test this without a proper JSZip mock,
            // but we can verify the pattern works
            const service = createZipService({ fs: mockFs });
            expect(service).toBeDefined();
            expect(typeof service.extractZip).toBe('function');
        });

        it('should use default dependencies when none provided', () => {
            const service = createZipService();
            expect(service).toBeDefined();
            expect(typeof service.extractZip).toBe('function');
            expect(typeof service.createZip).toBe('function');
            expect(typeof service.listZipContents).toBe('function');
        });

        it('should allow partial dependency override', async () => {
            // Test with only path module overridden
            const customPath = {
                join: (...args: string[]) => args.join('|'),
                dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
            } as any;

            const service = createZipService({ path: customPath });
            expect(service).toBeDefined();
        });
    });

    describe('edge cases', () => {
        it('should handle empty ZIP file creation', async () => {
            const emptyDir = path.join(testDir, 'empty');
            await fs.ensureDir(emptyDir);

            const buffer = await zipService.createZipBuffer(emptyDir);
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(0);
        });

        it('should handle files with special characters in names', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'file with spaces.txt'), 'content');
            await fs.writeFile(path.join(sourceDir, 'file-with-dashes.txt'), 'content');
            await fs.writeFile(path.join(sourceDir, 'file_with_underscores.txt'), 'content');

            const zipPath = path.join(testDir, 'special.zip');
            await zipService.createZip(sourceDir, zipPath);

            const contents = await zipService.listZipContents(zipPath);
            expect(contents).toContain('file with spaces.txt');
            expect(contents).toContain('file-with-dashes.txt');
            expect(contents).toContain('file_with_underscores.txt');
        });

        it('should handle large files', async () => {
            const sourceDir = path.join(testDir, 'source');
            await fs.ensureDir(sourceDir);
            // Create a 1MB file
            const largeContent = Buffer.alloc(1024 * 1024, 'A');
            await fs.writeFile(path.join(sourceDir, 'large.bin'), largeContent);

            const buffer = await zipService.createZipBuffer(sourceDir);

            const extractDir = path.join(testDir, 'extracted');
            await zipService.extractZipFromBuffer(buffer, extractDir);

            const extracted = await fs.readFile(path.join(extractDir, 'large.bin'));
            expect(extracted.length).toBe(largeContent.length);
        });
    });
});
