/**
 * Tests for File Helper Service
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { createFileHelper, type FileHelper } from './file-helper';

describe('File Helper Service', () => {
    const testDir = path.join(process.cwd(), 'test', 'temp', 'file-helper-test');
    let fileHelper: FileHelper;

    beforeEach(async () => {
        await fs.ensureDir(testDir);
        // Create a fresh FileHelper instance for each test
        // This ensures tests don't pollute each other
        fileHelper = createFileHelper({
            getEnv: (key: string) => {
                if (key === 'ELYSIA_FILES_DIR') return testDir;
                if (key === 'PUBLIC_DIR') return path.join(process.cwd(), 'public');
                return undefined;
            },
            getCwd: () => process.cwd(),
        });
    });

    afterEach(async () => {
        await fs.remove(testDir);
    });

    describe('getFilesDir', () => {
        it('should return ELYSIA_FILES_DIR if set', () => {
            const helper = createFileHelper({
                getEnv: key => (key === 'ELYSIA_FILES_DIR' ? '/custom/elysia/files' : undefined),
            });
            expect(helper.getFilesDir()).toBe('/custom/elysia/files');
        });

        it('should return FILES_DIR if set', () => {
            const helper = createFileHelper({
                getEnv: key => (key === 'FILES_DIR' ? '/custom/files' : undefined),
            });
            expect(helper.getFilesDir()).toBe('/custom/files');
        });

        it('should return FILES_DIR even if it starts with /mnt (Docker)', () => {
            const helper = createFileHelper({
                getEnv: key => (key === 'FILES_DIR' ? '/mnt/data/' : undefined),
                getCwd: () => '/test/cwd',
            });
            expect(helper.getFilesDir()).toBe('/mnt/data/');
        });

        it('should return default data directory if no env vars', () => {
            const helper = createFileHelper({
                getEnv: () => undefined,
                getCwd: () => '/test/cwd',
            });
            const result = helper.getFilesDir();
            expect(result).toBe('/test/cwd/data');
        });

        it('should prefer ELYSIA_FILES_DIR over FILES_DIR', () => {
            const helper = createFileHelper({
                getEnv: key => {
                    if (key === 'ELYSIA_FILES_DIR') return '/elysia/path';
                    if (key === 'FILES_DIR') return '/files/path';
                    return undefined;
                },
            });
            expect(helper.getFilesDir()).toBe('/elysia/path');
        });
    });

    describe('getTempPath', () => {
        it('should return temp base path without subPath', () => {
            const result = fileHelper.getTempPath();
            expect(result).toContain('tmp');
            expect(result).toBe(path.join(testDir, 'tmp'));
        });

        it('should return path with subPath', () => {
            const result = fileHelper.getTempPath('sessions/123');
            expect(result).toContain('tmp');
            expect(result).toContain('sessions');
            expect(result).toContain('123');
        });
    });

    describe('getOdeSessionDistDir', () => {
        it('should return date-based path for valid session ID', () => {
            const result = fileHelper.getOdeSessionDistDir('20250116abc123');
            expect(result).toContain('dist');
            expect(result).toContain('2025');
            expect(result).toContain('01');
            expect(result).toContain('16');
        });

        it('should return fallback path for invalid session ID', () => {
            const result = fileHelper.getOdeSessionDistDir('invalid-session');
            expect(result).toContain('dist');
            expect(result).toContain('invalid-session');
        });
    });

    describe('getOdeSessionTempDir', () => {
        it('should return date-based path for valid session ID', () => {
            const result = fileHelper.getOdeSessionTempDir('20250116abc123');
            expect(result).toContain('tmp');
            expect(result).toContain('2025');
        });

        it('should return fallback path for invalid session ID', () => {
            const result = fileHelper.getOdeSessionTempDir('simple-id');
            expect(result).toContain('tmp');
            expect(result).toContain('simple-id');
        });
    });

    describe('getPublicDirectory', () => {
        it('should return public directory path', () => {
            const result = fileHelper.getPublicDirectory();
            expect(result).toContain('public');
        });

        it('should use PUBLIC_DIR env if set', () => {
            const helper = createFileHelper({
                getEnv: key => (key === 'PUBLIC_DIR' ? '/custom/public' : undefined),
            });
            expect(helper.getPublicDirectory()).toBe('/custom/public');
        });
    });

    describe('getLibsDir', () => {
        it('should return libs directory path', () => {
            const result = fileHelper.getLibsDir();
            expect(result).toContain('libs');
        });
    });

    describe('getThemesDir', () => {
        it('should return themes directory path', () => {
            const result = fileHelper.getThemesDir();
            expect(result).toContain('themes');
        });
    });

    describe('getIdevicesDir', () => {
        it('should return idevices directory path', () => {
            const result = fileHelper.getIdevicesDir();
            expect(result).toContain('idevice');
        });
    });

    describe('getProjectAssetsDir', () => {
        it('should return UUID-based path for project assets', () => {
            const projectUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            const result = fileHelper.getProjectAssetsDir(projectUuid);
            expect(result).toContain('assets');
            expect(result).toContain(projectUuid);
            expect(result).toBe(path.join(testDir, 'assets', projectUuid));
        });

        it('should handle different UUID formats', () => {
            const uuid1 = 'simple-uuid-123';
            const uuid2 = 'another-project-uuid';

            const result1 = fileHelper.getProjectAssetsDir(uuid1);
            const result2 = fileHelper.getProjectAssetsDir(uuid2);

            expect(result1).toContain(uuid1);
            expect(result2).toContain(uuid2);
            expect(result1).not.toBe(result2);
        });
    });

    describe('isPathSafe', () => {
        it('should return true for safe paths', () => {
            expect(fileHelper.isPathSafe('/base', 'subdir/file.txt')).toBe(true);
            expect(fileHelper.isPathSafe('/base', './subdir/file.txt')).toBe(true);
            expect(fileHelper.isPathSafe('/base', 'a/b/c/d.txt')).toBe(true);
        });

        it('should return false for path traversal attempts', () => {
            expect(fileHelper.isPathSafe('/base', '../outside')).toBe(false);
            expect(fileHelper.isPathSafe('/base', 'subdir/../../outside')).toBe(false);
            expect(fileHelper.isPathSafe('/base/sub', '../../../etc/passwd')).toBe(false);
        });

        it('should handle absolute paths', () => {
            expect(fileHelper.isPathSafe('/base', '/base/subdir')).toBe(true);
            expect(fileHelper.isPathSafe('/base', '/other/path')).toBe(false);
        });
    });

    describe('getContentXmlPath', () => {
        it('should return content.xml path', () => {
            const result = fileHelper.getContentXmlPath('20250116abc');
            expect(result).toContain('content.xml');
        });
    });

    describe('fileExists', () => {
        it('should return true for existing file', async () => {
            const filePath = path.join(testDir, 'exists.txt');
            await fs.writeFile(filePath, 'test');
            expect(await fileHelper.fileExists(filePath)).toBe(true);
        });

        it('should return false for non-existent file', async () => {
            const filePath = path.join(testDir, 'not-exists.txt');
            expect(await fileHelper.fileExists(filePath)).toBe(false);
        });
    });

    describe('readFile', () => {
        it('should read file as buffer', async () => {
            const filePath = path.join(testDir, 'read-test.txt');
            await fs.writeFile(filePath, 'test content');
            const result = await fileHelper.readFile(filePath);
            expect(Buffer.isBuffer(result)).toBe(true);
            expect(result.toString()).toBe('test content');
        });
    });

    describe('readFileAsString', () => {
        it('should read file as string', async () => {
            const filePath = path.join(testDir, 'read-string.txt');
            await fs.writeFile(filePath, 'hello world');
            const result = await fileHelper.readFileAsString(filePath);
            expect(result).toBe('hello world');
        });

        it('should handle different encodings', async () => {
            const filePath = path.join(testDir, 'encoding.txt');
            await fs.writeFile(filePath, 'test', 'utf-8');
            const result = await fileHelper.readFileAsString(filePath, 'utf-8');
            expect(result).toBe('test');
        });
    });

    describe('writeFile', () => {
        it('should write file and create parent directories', async () => {
            const filePath = path.join(testDir, 'nested', 'deep', 'file.txt');
            await fileHelper.writeFile(filePath, 'written content');
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('written content');
        });

        it('should write buffer content', async () => {
            const filePath = path.join(testDir, 'buffer.bin');
            const buffer = Buffer.from([0x01, 0x02, 0x03]);
            await fileHelper.writeFile(filePath, buffer);
            const result = await fs.readFile(filePath);
            expect(result).toEqual(buffer);
        });
    });

    describe('appendFile', () => {
        it('should append to existing file', async () => {
            const filePath = path.join(testDir, 'append.txt');
            await fs.writeFile(filePath, 'start');
            await fileHelper.appendFile(filePath, '-end');
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('start-end');
        });

        it('should create file if not exists', async () => {
            const filePath = path.join(testDir, 'new-append.txt');
            await fileHelper.appendFile(filePath, 'new content');
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('new content');
        });
    });

    describe('copyFile', () => {
        it('should copy file', async () => {
            const src = path.join(testDir, 'src.txt');
            const dest = path.join(testDir, 'dest.txt');
            await fs.writeFile(src, 'copy me');
            await fileHelper.copyFile(src, dest);
            const content = await fs.readFile(dest, 'utf-8');
            expect(content).toBe('copy me');
        });

        it('should create destination directories', async () => {
            const src = path.join(testDir, 'src2.txt');
            const dest = path.join(testDir, 'nested', 'dest2.txt');
            await fs.writeFile(src, 'copy');
            await fileHelper.copyFile(src, dest);
            expect(await fs.pathExists(dest)).toBe(true);
        });
    });

    describe('copyDir', () => {
        it('should copy directory recursively', async () => {
            const srcDir = path.join(testDir, 'srcDir');
            const destDir = path.join(testDir, 'destDir');
            await fs.ensureDir(srcDir);
            await fs.writeFile(path.join(srcDir, 'file1.txt'), 'content1');
            await fs.ensureDir(path.join(srcDir, 'sub'));
            await fs.writeFile(path.join(srcDir, 'sub', 'file2.txt'), 'content2');

            await fileHelper.copyDir(srcDir, destDir);

            expect(await fs.pathExists(path.join(destDir, 'file1.txt'))).toBe(true);
            expect(await fs.pathExists(path.join(destDir, 'sub', 'file2.txt'))).toBe(true);
        });
    });

    describe('remove', () => {
        it('should remove file', async () => {
            const filePath = path.join(testDir, 'to-remove.txt');
            await fs.writeFile(filePath, 'remove me');
            await fileHelper.remove(filePath);
            expect(await fs.pathExists(filePath)).toBe(false);
        });

        it('should remove directory recursively', async () => {
            const dirPath = path.join(testDir, 'removeDir');
            await fs.ensureDir(dirPath);
            await fs.writeFile(path.join(dirPath, 'file.txt'), 'content');
            await fileHelper.remove(dirPath);
            expect(await fs.pathExists(dirPath)).toBe(false);
        });
    });

    describe('listFiles', () => {
        it('should list files in directory', async () => {
            const dirPath = path.join(testDir, 'listDir');
            await fs.ensureDir(dirPath);
            await fs.writeFile(path.join(dirPath, 'a.txt'), 'a');
            await fs.writeFile(path.join(dirPath, 'b.txt'), 'b');

            const files = await fileHelper.listFiles(dirPath);
            expect(files).toContain('a.txt');
            expect(files).toContain('b.txt');
        });

        it('should return empty array for non-existent directory', async () => {
            const files = await fileHelper.listFiles(path.join(testDir, 'not-exists'));
            expect(files).toEqual([]);
        });
    });

    describe('getStats', () => {
        it('should return stats for existing file', async () => {
            const filePath = path.join(testDir, 'stats.txt');
            await fs.writeFile(filePath, 'test content');
            const stats = await fileHelper.getStats(filePath);
            expect(stats).not.toBeNull();
            expect(stats!.isFile()).toBe(true);
        });

        it('should return null for non-existent file', async () => {
            const stats = await fileHelper.getStats(path.join(testDir, 'not-exists'));
            expect(stats).toBeNull();
        });
    });

    describe('generateUniqueFilename', () => {
        it('should generate unique filename preserving extension', () => {
            const result = fileHelper.generateUniqueFilename('document.pdf');
            expect(result).toContain('document');
            expect(result).toEndWith('.pdf');
            expect(result).not.toBe('document.pdf');
        });

        it('should generate different names on each call', () => {
            const names = new Set<string>();
            for (let i = 0; i < 100; i++) {
                names.add(fileHelper.generateUniqueFilename('file.txt'));
            }
            expect(names.size).toBe(100);
        });

        it('should handle files without extension', () => {
            const result = fileHelper.generateUniqueFilename('README');
            expect(result).toContain('README');
            expect(result).not.toBe('README');
        });

        it('should handle files with multiple dots', () => {
            const result = fileHelper.generateUniqueFilename('file.tar.gz');
            expect(result).toEndWith('.gz');
        });
    });

    describe('createSessionDirectories and cleanupSessionDirectories', () => {
        it('should create and cleanup session directories', async () => {
            const sessionId = '20250116test123';

            await fileHelper.createSessionDirectories(sessionId);

            const tempDir = fileHelper.getOdeSessionTempDir(sessionId);
            const distDir = fileHelper.getOdeSessionDistDir(sessionId);

            expect(await fs.pathExists(tempDir)).toBe(true);
            expect(await fs.pathExists(distDir)).toBe(true);

            await fileHelper.cleanupSessionDirectories(sessionId);

            expect(await fs.pathExists(tempDir)).toBe(false);
            expect(await fs.pathExists(distDir)).toBe(false);
        });
    });

    describe('getPreviewExportPath', () => {
        it('should return preview export path', () => {
            const result = fileHelper.getPreviewExportPath('20250116abc', 'random123/');
            expect(result).toContain('export');
            expect(result).toContain('random123');
        });
    });

    describe('dependency injection', () => {
        it('should use injected fs module', async () => {
            let ensureDirCalled = false;
            const mockFs = {
                ensureDir: async () => {
                    ensureDirCalled = true;
                },
                remove: async () => {},
            } as any;

            const helper = createFileHelper({
                fs: mockFs,
                getEnv: () => '/test',
            });

            await helper.createSessionDirectories('20250116test');
            expect(ensureDirCalled).toBe(true);
        });

        it('should use injected path module', () => {
            const mockPath = {
                join: (...args: string[]) => args.join('|'),
                resolve: (...args: string[]) => args.join('/'),
                dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
                extname: (p: string) => '.' + p.split('.').pop(),
                basename: (p: string, ext?: string) =>
                    p
                        .split('/')
                        .pop()
                        ?.replace(ext || '', '') || '',
            } as any;

            const helper = createFileHelper({
                path: mockPath,
                getEnv: () => '/test',
            });

            const result = helper.getTempPath('sub');
            expect(result).toBe('/test|tmp|sub');
        });
    });
});
