/**
 * Tests for Filemanager Routes
 * Uses Dependency Injection pattern - no mock.module needed
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Elysia } from 'elysia';

import {
    createFilemanagerRoutes,
    type FilemanagerDependencies,
    type FilemanagerFileHelperDeps,
    type FilemanagerZipDeps,
} from './filemanager';

const testDir = path.join(process.cwd(), 'test', 'temp', 'filemanager-test');
const testSessionId = '20250116testfilemanager';

// Create mock file helper functions
function createMockFileHelper(): FilemanagerFileHelperDeps {
    return {
        getOdeSessionTempDir: (sessionId: string) => path.join(testDir, 'tmp', sessionId),
        isPathSafe: (basePath: string, targetPath: string) => {
            const resolvedBase = path.resolve(basePath);
            const resolvedTarget = path.resolve(targetPath);
            return resolvedTarget.startsWith(resolvedBase);
        },
    };
}

// Create mock zip functions
function createMockZip(): FilemanagerZipDeps {
    return {
        createZip: async (srcDir: string, destPath: string) => {
            await fs.ensureDir(path.dirname(destPath));
            await fs.writeFile(destPath, 'PK fake zip content');
        },
        extractZip: async (_zipPath: string, destDir: string) => {
            await fs.ensureDir(destDir);
            await fs.writeFile(path.join(destDir, 'extracted.txt'), 'Extracted content');
            return ['extracted.txt'];
        },
    };
}

// Create mock dependencies
function createMockDependencies(): FilemanagerDependencies {
    return {
        fs: fs,
        path: path,
        fileHelper: createMockFileHelper(),
        zip: createMockZip(),
    };
}

describe('Filemanager Routes', () => {
    let app: Elysia;
    let mockDeps: FilemanagerDependencies;

    beforeEach(async () => {
        // Create mock dependencies and app
        mockDeps = createMockDependencies();
        app = new Elysia().use(createFilemanagerRoutes(mockDeps));

        // Create test directory structure
        const sessionDir = path.join(testDir, 'tmp', testSessionId);
        const filemanagerDir = path.join(sessionDir, 'file_manager');
        await fs.ensureDir(filemanagerDir);

        // Create test files
        await fs.writeFile(path.join(filemanagerDir, 'test.txt'), 'Test content');
        await fs.ensureDir(path.join(filemanagerDir, 'subfolder'));
        await fs.writeFile(path.join(filemanagerDir, 'subfolder', 'nested.txt'), 'Nested content');
    });

    afterEach(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('GET /filemanager/index/:plugin/:sessionId', () => {
        it('should return HTML for FileGator interface', async () => {
            const res = await app.handle(
                new Request(`http://localhost/filemanager/index/plugin/${testSessionId}`),
            );

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('text/html');
            const html = await res.text();
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<div id=app></div>');
        });

        it('should include FileGator JS and CSS loader', async () => {
            const res = await app.handle(
                new Request(`http://localhost/filemanager/index/plugin/${testSessionId}`),
            );

            const html = await res.text();
            expect(html).toContain('loadFile("css/app.css")');
            expect(html).toContain('loadFile("js/app.js")');
        });
    });

    describe('GET /filemanager/getconfig', () => {
        it('should return FileGator configuration', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/getconfig'),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data).toBeDefined();
            expect(body.data.adapter).toBe('local');
            expect(body.data.multiple_uploads).toBe(true);
            expect(body.data.has_login).toBe(false);
        });

        it('should include upload configuration', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/getconfig'),
            );

            const body = await res.json();
            expect(body.data.upload_max_size).toBe(100 * 1024 * 1024);
            expect(body.data.upload_chunk_size).toBe(1 * 1024 * 1024);
        });

        it('should include editable extensions', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/getconfig'),
            );

            const body = await res.json();
            expect(body.data.editable).toContain('txt');
            expect(body.data.editable).toContain('html');
            expect(body.data.editable).toContain('js');
            expect(body.data.editable).toContain('css');
        });
    });

    describe('POST /filemanager/getdir', () => {
        it('should return directory contents with session cookie', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/getdir', {
                    method: 'POST',
                    body: JSON.stringify({ dir: '' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.location).toBe('/');
            expect(body.data.files).toBeDefined();
            expect(Array.isArray(body.data.files)).toBe(true);
        });

        it('should list files in root directory', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/getdir', {
                    method: 'POST',
                    body: JSON.stringify({ dir: '' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            const body = await res.json();
            const files = body.data.files;
            expect(files.some((f: any) => f.name === 'test.txt')).toBe(true);
            expect(files.some((f: any) => f.name === 'subfolder' && f.type === 'dir')).toBe(true);
        });

        it('should return error when no session', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/getdir', {
                    method: 'POST',
                    body: JSON.stringify({ dir: '' }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            const body = await res.json();
            expect(body.data.error).toBe('Session not found');
        });

        it('should list subdirectory contents', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/getdir', {
                    method: 'POST',
                    body: JSON.stringify({ dir: 'subfolder' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            const body = await res.json();
            expect(body.data.location).toBe('subfolder');
            expect(body.data.files.some((f: any) => f.name === 'nested.txt')).toBe(true);
        });

        it('should return empty files for non-existent directory', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/getdir', {
                    method: 'POST',
                    body: JSON.stringify({ dir: 'nonexistent' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            const body = await res.json();
            expect(body.data.files).toEqual([]);
        });
    });

    describe('POST /filemanager/changedir', () => {
        it('should change to specified directory', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/changedir', {
                    method: 'POST',
                    body: JSON.stringify({ to: 'subfolder' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.location).toBe('subfolder');
        });
    });

    describe('POST /filemanager/createnew', () => {
        it('should create new directory', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/createnew', {
                    method: 'POST',
                    body: JSON.stringify({ type: 'dir', name: 'newdir', path: '' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            const body = await res.json();
            expect(body.data).toBe('Done');

            // Verify directory was created
            const dirPath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'newdir');
            expect(await fs.pathExists(dirPath)).toBe(true);
        });

        it('should create new file', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/createnew', {
                    method: 'POST',
                    body: JSON.stringify({ type: 'file', name: 'newfile.txt', path: '' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            const body = await res.json();
            expect(body.data).toBe('Done');

            // Verify file was created
            const filePath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'newfile.txt');
            expect(await fs.pathExists(filePath)).toBe(true);
        });

        it('should create in subdirectory', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/createnew', {
                    method: 'POST',
                    body: JSON.stringify({ type: 'file', name: 'new.txt', path: 'subfolder' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            const body = await res.json();
            expect(body.data).toBe('Done');
        });

        it('should return error when no session', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/createnew', {
                    method: 'POST',
                    body: JSON.stringify({ type: 'dir', name: 'test' }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            const body = await res.json();
            expect(body.data.error).toBe('Session not found');
        });
    });

    describe('POST /filemanager/deleteitems', () => {
        it('should delete file', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/deleteitems', {
                    method: 'POST',
                    body: JSON.stringify({ items: [{ path: 'test.txt' }] }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            const body = await res.text();
            expect(body).toBe('Done');

            // Verify file was deleted
            const filePath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'test.txt');
            expect(await fs.pathExists(filePath)).toBe(false);
        });

        it('should delete directory', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/deleteitems', {
                    method: 'POST',
                    body: JSON.stringify({ items: [{ path: 'subfolder' }] }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            const body = await res.text();
            expect(body).toBe('Done');

            // Verify directory was deleted
            const dirPath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'subfolder');
            expect(await fs.pathExists(dirPath)).toBe(false);
        });

        it('should delete multiple items', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/deleteitems', {
                    method: 'POST',
                    body: JSON.stringify({
                        items: [{ path: 'test.txt' }, { path: 'subfolder' }],
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(await res.text()).toBe('Done');
        });
    });

    describe('POST /filemanager/renameitem', () => {
        it('should rename file', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/renameitem', {
                    method: 'POST',
                    body: JSON.stringify({ from: 'test.txt', to: 'renamed.txt', destination: '' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(await res.text()).toBe('Done');

            // Verify rename
            const oldPath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'test.txt');
            const newPath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'renamed.txt');
            expect(await fs.pathExists(oldPath)).toBe(false);
            expect(await fs.pathExists(newPath)).toBe(true);
        });

        it('should rename directory', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/renameitem', {
                    method: 'POST',
                    body: JSON.stringify({ from: 'subfolder', to: 'renamed_folder', destination: '' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(await res.text()).toBe('Done');
        });
    });

    describe('POST /filemanager/copyitems', () => {
        it('should copy file to destination', async () => {
            // Create destination directory
            await fs.ensureDir(path.join(testDir, 'tmp', testSessionId, 'file_manager', 'dest'));

            const res = await app.handle(
                new Request('http://localhost/filemanager/copyitems', {
                    method: 'POST',
                    body: JSON.stringify({
                        items: [{ path: 'test.txt' }],
                        destination: 'dest',
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(await res.text()).toBe('Done');

            // Verify copy - original still exists
            const originalPath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'test.txt');
            const copiedPath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'dest', 'test.txt');
            expect(await fs.pathExists(originalPath)).toBe(true);
            expect(await fs.pathExists(copiedPath)).toBe(true);
        });
    });

    describe('POST /filemanager/moveitems', () => {
        it('should move file to destination', async () => {
            // Create destination directory
            await fs.ensureDir(path.join(testDir, 'tmp', testSessionId, 'file_manager', 'dest'));

            const res = await app.handle(
                new Request('http://localhost/filemanager/moveitems', {
                    method: 'POST',
                    body: JSON.stringify({
                        items: [{ path: 'test.txt' }],
                        destination: 'dest',
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(await res.text()).toBe('Done');

            // Verify move - original should not exist
            const originalPath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'test.txt');
            const movedPath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'dest', 'test.txt');
            expect(await fs.pathExists(originalPath)).toBe(false);
            expect(await fs.pathExists(movedPath)).toBe(true);
        });
    });

    describe('GET /filemanager/download', () => {
        it('should download file with base64 encoded path', async () => {
            const encodedPath = Buffer.from('test.txt').toString('base64');
            const res = await app.handle(
                new Request(`http://localhost/filemanager/download?path=${encodedPath}`, {
                    headers: { Cookie: `odeSessionId=${testSessionId}` },
                }),
            );

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('application/octet-stream');
            expect(res.headers.get('content-disposition')).toContain('test.txt');

            const content = await res.text();
            expect(content).toBe('Test content');
        });

        it('should return 404 when no session', async () => {
            const encodedPath = Buffer.from('test.txt').toString('base64');
            const res = await app.handle(
                new Request(`http://localhost/filemanager/download?path=${encodedPath}`),
            );

            expect(res.status).toBe(404);
        });

        it('should return 404 for non-existent file', async () => {
            const encodedPath = Buffer.from('nonexistent.txt').toString('base64');
            const res = await app.handle(
                new Request(`http://localhost/filemanager/download?path=${encodedPath}`, {
                    headers: { Cookie: `odeSessionId=${testSessionId}` },
                }),
            );

            expect(res.status).toBe(404);
        });
    });

    describe('GET /filemanager/upload (chunk check)', () => {
        it('should return 204 when chunk does not exist', async () => {
            const res = await app.handle(
                new Request(
                    'http://localhost/filemanager/upload?resumableFilename=test.txt&resumableIdentifier=abc123&resumableChunkNumber=1',
                    { headers: { Cookie: `odeSessionId=${testSessionId}` } },
                ),
            );

            expect(res.status).toBe(204);
        });

        it('should return 200 when chunk exists', async () => {
            // Create a chunk file
            const chunkPath = path.join(
                testDir,
                'tmp',
                testSessionId,
                'multipart_abc123test.txt.part1',
            );
            await fs.ensureDir(path.dirname(chunkPath));
            await fs.writeFile(chunkPath, 'chunk content');

            const res = await app.handle(
                new Request(
                    'http://localhost/filemanager/upload?resumableFilename=test.txt&resumableIdentifier=abc123&resumableChunkNumber=1',
                    { headers: { Cookie: `odeSessionId=${testSessionId}` } },
                ),
            );

            expect(res.status).toBe(200);
        });

        it('should return 404 when no session', async () => {
            const res = await app.handle(
                new Request(
                    'http://localhost/filemanager/upload?resumableFilename=test.txt&resumableIdentifier=abc123&resumableChunkNumber=1',
                ),
            );

            expect(res.status).toBe(404);
        });
    });

    describe('POST /filemanager/upload', () => {
        it('should return error when no session', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.txt');

            const res = await app.handle(
                new Request('http://localhost/filemanager/upload', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(await res.text()).toBe('Session not found');
        });

        it('should return error when no file', async () => {
            const formData = new FormData();

            const res = await app.handle(
                new Request('http://localhost/filemanager/upload', {
                    method: 'POST',
                    body: formData,
                    headers: { Cookie: `odeSessionId=${testSessionId}` },
                }),
            );

            expect(await res.text()).toBe('No file uploaded');
        });

        it('should handle single chunk upload', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['test content']), 'upload.txt');
            formData.append('resumableFilename', 'upload.txt');
            formData.append('resumableIdentifier', 'single123');
            formData.append('resumableChunkNumber', '1');
            formData.append('resumableTotalChunks', '1');
            formData.append('resumableRelativePath', '/');

            const res = await app.handle(
                new Request('http://localhost/filemanager/upload', {
                    method: 'POST',
                    body: formData,
                    headers: { Cookie: `odeSessionId=${testSessionId}` },
                }),
            );

            expect(await res.text()).toBe('Stored');
        });
    });

    describe('POST /filemanager/savecontent', () => {
        it('should save file content', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/savecontent', {
                    method: 'POST',
                    body: JSON.stringify({ path: 'test.txt', content: 'New content' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(await res.text()).toBe('Done');

            // Verify content was saved
            const filePath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'test.txt');
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('New content');
        });

        it('should return error when no session', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/savecontent', {
                    method: 'POST',
                    body: JSON.stringify({ path: 'test.txt', content: 'New content' }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(await res.text()).toBe('Session not found');
        });
    });

    describe('POST /filemanager/getpath', () => {
        it('should return the path for an item', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/getpath', {
                    method: 'POST',
                    body: JSON.stringify({ item: 'test/path/file.txt' }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            const body = await res.json();
            expect(body.path).toBe('test/path/file.txt');
        });

        it('should return empty path when no item', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/getpath', {
                    method: 'POST',
                    body: JSON.stringify({}),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            const body = await res.json();
            expect(body.path).toBe('');
        });
    });

    describe('POST /filemanager/zipitems', () => {
        it('should create zip from items', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/zipitems', {
                    method: 'POST',
                    body: JSON.stringify({
                        items: [{ path: 'test.txt' }],
                        destination: '',
                        name: 'archive.zip',
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(await res.text()).toBe('Done');
        });

        it('should return error when no session', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/zipitems', {
                    method: 'POST',
                    body: JSON.stringify({ items: [{ path: 'test.txt' }] }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(await res.text()).toBe('Session not found');
        });

        it('should auto-generate zip name from first item', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/zipitems', {
                    method: 'POST',
                    body: JSON.stringify({
                        items: [{ path: 'test.txt' }],
                        destination: '',
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(await res.text()).toBe('Done');
        });
    });

    describe('POST /filemanager/unzipitem', () => {
        it('should extract zip file', async () => {
            // Create a fake zip file
            const zipPath = path.join(testDir, 'tmp', testSessionId, 'file_manager', 'archive.zip');
            await fs.writeFile(zipPath, 'PK zip content');

            const res = await app.handle(
                new Request('http://localhost/filemanager/unzipitem', {
                    method: 'POST',
                    body: JSON.stringify({ item: 'archive.zip' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(await res.text()).toBe('Done');
        });

        it('should return error for non-zip file', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/unzipitem', {
                    method: 'POST',
                    body: JSON.stringify({ item: 'test.txt' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(await res.text()).toContain('Only .zip files can be unzipped');
        });

        it('should return error when no session', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/unzipitem', {
                    method: 'POST',
                    body: JSON.stringify({ item: 'archive.zip' }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(await res.text()).toBe('Session not found');
        });

        it('should return error for non-existent file', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/unzipitem', {
                    method: 'POST',
                    body: JSON.stringify({ item: 'nonexistent.zip' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            expect(await res.text()).toContain('File not found');
        });
    });

    describe('security', () => {
        it('should prevent path traversal in getdir', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/getdir', {
                    method: 'POST',
                    body: JSON.stringify({ dir: '../../../etc' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            const body = await res.json();
            expect(body.data.error).toContain('Path traversal');
        });

        it('should prevent path traversal in createnew', async () => {
            const res = await app.handle(
                new Request('http://localhost/filemanager/createnew', {
                    method: 'POST',
                    body: JSON.stringify({ type: 'file', name: '../../../evil.txt', path: '' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `odeSessionId=${testSessionId}`,
                    },
                }),
            );

            const body = await res.json();
            expect(body.data.error).toContain('Path traversal');
        });

        it('should prevent path traversal in download', async () => {
            const encodedPath = Buffer.from('../../../etc/passwd').toString('base64');
            const res = await app.handle(
                new Request(`http://localhost/filemanager/download?path=${encodedPath}`, {
                    headers: { Cookie: `odeSessionId=${testSessionId}` },
                }),
            );

            expect(res.status).toBe(400);
        });
    });
});
