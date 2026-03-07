/**
 * Tests for Folder Manager Service
 * Uses real in-memory SQLite database with dependency injection
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import * as assetQueries from '../db/queries/assets';
import { createFolderManagerService, type FolderManagerService } from './folder-manager';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as fflate from 'fflate';
import * as os from 'os';

describe('Folder Manager Service', () => {
    let db: Kysely<Database>;
    let service: FolderManagerService;
    let testUserId: number;
    let testProjectId: number;
    let testProjectUuid: string;
    let tempDir: string;

    beforeAll(async () => {
        db = await createTestDb();
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-manager-test-'));
    });

    afterAll(async () => {
        await destroyTestDb(db);
        await fs.remove(tempDir);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        testUserId = await seedTestUser(db);
        testProjectUuid = `test-proj-${Date.now()}`;
        testProjectId = await seedTestProject(db, testUserId, {
            uuid: testProjectUuid,
            title: 'Test Project',
        });

        // Create service with injected dependencies
        service = createFolderManagerService({
            db,
            queries: assetQueries,
            fs,
            path,
            fflate,
            getProjectAssetsDir: (uuid: string) => path.join(tempDir, 'assets', uuid),
        });

        // Clean temp project directory
        await fs.remove(path.join(tempDir, 'assets', testProjectUuid));
        await fs.ensureDir(path.join(tempDir, 'assets', testProjectUuid));
    });

    // ============================================================================
    // VALIDATION TESTS
    // ============================================================================

    describe('isValidFolderName', () => {
        it('should accept valid folder names', () => {
            expect(service.isValidFolderName('images')).toBe(true);
            expect(service.isValidFolderName('My Folder')).toBe(true);
            expect(service.isValidFolderName('folder-name')).toBe(true);
            expect(service.isValidFolderName('folder_name')).toBe(true);
            expect(service.isValidFolderName('123')).toBe(true);
            expect(service.isValidFolderName('folder.with.dots')).toBe(true);
        });

        it('should reject empty names', () => {
            expect(service.isValidFolderName('')).toBe(false);
            expect(service.isValidFolderName('   ')).toBe(false);
        });

        it('should reject names with invalid characters', () => {
            expect(service.isValidFolderName('folder/name')).toBe(false);
            expect(service.isValidFolderName('folder\\name')).toBe(false);
            expect(service.isValidFolderName('folder:name')).toBe(false);
            expect(service.isValidFolderName('folder*name')).toBe(false);
            expect(service.isValidFolderName('folder?name')).toBe(false);
            expect(service.isValidFolderName('folder<name')).toBe(false);
            expect(service.isValidFolderName('folder>name')).toBe(false);
            expect(service.isValidFolderName('folder|name')).toBe(false);
            expect(service.isValidFolderName('folder"name')).toBe(false);
        });

        it('should reject names starting with dot or space', () => {
            expect(service.isValidFolderName('.hidden')).toBe(false);
            expect(service.isValidFolderName(' folder')).toBe(false);
        });

        it('should reject names ending with dot or space', () => {
            expect(service.isValidFolderName('folder.')).toBe(false);
            expect(service.isValidFolderName('folder ')).toBe(false);
        });

        it('should reject reserved Windows names', () => {
            expect(service.isValidFolderName('CON')).toBe(false);
            expect(service.isValidFolderName('PRN')).toBe(false);
            expect(service.isValidFolderName('AUX')).toBe(false);
            expect(service.isValidFolderName('NUL')).toBe(false);
            expect(service.isValidFolderName('COM1')).toBe(false);
            expect(service.isValidFolderName('LPT1')).toBe(false);
        });

        it('should reject . and ..', () => {
            expect(service.isValidFolderName('.')).toBe(false);
            expect(service.isValidFolderName('..')).toBe(false);
        });

        it('should reject names longer than 255 characters', () => {
            const longName = 'a'.repeat(256);
            expect(service.isValidFolderName(longName)).toBe(false);
        });
    });

    describe('isValidFolderPath', () => {
        it('should accept empty path (root)', () => {
            expect(service.isValidFolderPath('')).toBe(true);
        });

        it('should accept valid paths', () => {
            expect(service.isValidFolderPath('images')).toBe(true);
            expect(service.isValidFolderPath('images/icons')).toBe(true);
            expect(service.isValidFolderPath('website/assets/css')).toBe(true);
        });

        it('should reject paths with invalid segments', () => {
            expect(service.isValidFolderPath('images/.hidden')).toBe(false);
            expect(service.isValidFolderPath('images/CON')).toBe(false);
            expect(service.isValidFolderPath('images/folder:name')).toBe(false);
        });
    });

    describe('sanitizeFolderName', () => {
        it('should remove invalid characters', () => {
            expect(service.sanitizeFolderName('folder/name')).toBe('folder_name');
            expect(service.sanitizeFolderName('folder:name')).toBe('folder_name');
            expect(service.sanitizeFolderName('folder*name')).toBe('folder_name');
        });

        it('should remove leading dots and spaces', () => {
            expect(service.sanitizeFolderName('.hidden')).toBe('hidden');
            expect(service.sanitizeFolderName('  folder')).toBe('folder');
        });

        it('should remove trailing dots and spaces', () => {
            expect(service.sanitizeFolderName('folder.')).toBe('folder');
            expect(service.sanitizeFolderName('folder  ')).toBe('folder');
        });

        it('should prefix reserved names', () => {
            expect(service.sanitizeFolderName('CON')).toBe('_CON');
            expect(service.sanitizeFolderName('PRN')).toBe('_PRN');
        });

        it('should return "folder" for empty result', () => {
            expect(service.sanitizeFolderName('...')).toBe('folder');
            expect(service.sanitizeFolderName('   ')).toBe('folder');
        });
    });

    // ============================================================================
    // UNICODE SUPPORT TESTS
    // ============================================================================

    describe('unicode folder names', () => {
        it('should accept Japanese folder names', () => {
            expect(service.isValidFolderName('画像')).toBe(true);
            expect(service.isValidFolderName('アイコン')).toBe(true);
            expect(service.isValidFolderName('文書フォルダ')).toBe(true);
        });

        it('should accept Chinese folder names', () => {
            expect(service.isValidFolderName('图片')).toBe(true);
            expect(service.isValidFolderName('文档文件夹')).toBe(true);
        });

        it('should accept Korean folder names', () => {
            expect(service.isValidFolderName('이미지')).toBe(true);
            expect(service.isValidFolderName('문서폴더')).toBe(true);
        });

        it('should accept Arabic folder names', () => {
            expect(service.isValidFolderName('صور')).toBe(true);
            expect(service.isValidFolderName('ملفات')).toBe(true);
        });

        it('should accept Cyrillic folder names', () => {
            expect(service.isValidFolderName('изображения')).toBe(true);
            expect(service.isValidFolderName('документы')).toBe(true);
        });

        it('should accept Greek folder names', () => {
            expect(service.isValidFolderName('εικόνες')).toBe(true);
            expect(service.isValidFolderName('αρχεία')).toBe(true);
        });

        it('should accept accented Latin characters', () => {
            expect(service.isValidFolderName('imágenes')).toBe(true);
            expect(service.isValidFolderName('bibliothèque')).toBe(true);
            expect(service.isValidFolderName('Ärzte')).toBe(true);
            expect(service.isValidFolderName('naïve')).toBe(true);
        });

        it('should accept mixed scripts', () => {
            expect(service.isValidFolderName('My文档')).toBe(true);
            expect(service.isValidFolderName('图片images')).toBe(true);
        });

        it('should validate paths with unicode segments', () => {
            expect(service.isValidFolderPath('画像/アイコン')).toBe(true);
            expect(service.isValidFolderPath('documentos/imágenes')).toBe(true);
            expect(service.isValidFolderPath('ملفات/صور')).toBe(true);
        });

        it('should sanitize unicode names correctly', () => {
            // Unicode names should pass through unchanged (no invalid chars)
            expect(service.sanitizeFolderName('画像')).toBe('画像');
            expect(service.sanitizeFolderName('imágenes')).toBe('imágenes');
            // But should still sanitize invalid chars within unicode names
            expect(service.sanitizeFolderName('画像:test')).toBe('画像_test');
        });
    });

    describe('unicode folder operations', () => {
        it('should create assets in unicode folders', async () => {
            const asset = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'photo.jpg',
                storage_path: '/photo.jpg',
                folder_path: '画像/アイコン',
            });

            const contents = await service.getFolderContents(testProjectId, '画像/アイコン');
            expect(contents.files.length).toBe(1);
            expect(contents.files[0].filename).toBe('photo.jpg');
        });

        it('should rename unicode folders', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'file.txt',
                storage_path: '/file.txt',
                folder_path: '旧フォルダ',
            });

            const result = await service.renameFolder(testProjectId, '旧フォルダ', '新フォルダ');
            expect(result.success).toBe(true);

            const newExists = await service.folderExists(testProjectId, '新フォルダ');
            expect(newExists).toBe(true);
        });

        it('should move assets to unicode folders', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'doc.pdf',
                storage_path: '/doc.pdf',
                folder_path: 'source',
                client_id: 'unicode-move-test',
            });

            const result = await service.moveAssets(
                testProjectId,
                [{ type: 'file', clientId: 'unicode-move-test' }],
                '文档',
            );

            expect(result.success).toBe(true);
            const assets = await assetQueries.findAssetsInFolder(db, testProjectId, '文档');
            expect(assets.length).toBe(1);
        });
    });

    // ============================================================================
    // READING TESTS
    // ============================================================================

    describe('getFolderContents', () => {
        it('should return folder contents', async () => {
            // Create some assets in different folders
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'root.png',
                storage_path: '/root.png',
                folder_path: '',
            });
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'image.png',
                storage_path: '/image.png',
                folder_path: 'images',
            });
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'style.css',
                storage_path: '/style.css',
                folder_path: 'css',
            });

            const contents = await service.getFolderContents(testProjectId, '');

            expect(contents.currentPath).toBe('');
            expect(contents.breadcrumbs).toEqual([]);
            expect(contents.folders.sort()).toEqual(['css', 'images']);
            expect(contents.files.length).toBe(1);
            expect(contents.files[0].filename).toBe('root.png');
        });

        it('should return breadcrumbs for nested folder', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'icon.svg',
                storage_path: '/icon.svg',
                folder_path: 'website/images/icons',
            });

            const contents = await service.getFolderContents(testProjectId, 'website/images');

            expect(contents.currentPath).toBe('website/images');
            expect(contents.breadcrumbs).toEqual(['website', 'images']);
            expect(contents.folders).toEqual(['icons']);
        });

        it('should return empty for non-existent folder', async () => {
            const contents = await service.getFolderContents(testProjectId, 'nonexistent');

            expect(contents.folders).toEqual([]);
            expect(contents.files).toEqual([]);
        });
    });

    describe('folderExists', () => {
        it('should return true for folder with assets', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'file.txt',
                storage_path: '/file.txt',
                folder_path: 'docs',
            });

            const exists = await service.folderExists(testProjectId, 'docs');
            expect(exists).toBe(true);
        });

        it('should return true for folder with nested assets', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'file.txt',
                storage_path: '/file.txt',
                folder_path: 'docs/nested',
            });

            const exists = await service.folderExists(testProjectId, 'docs');
            expect(exists).toBe(true);
        });

        it('should return false for empty folder', async () => {
            const exists = await service.folderExists(testProjectId, 'empty');
            expect(exists).toBe(false);
        });
    });

    // ============================================================================
    // FOLDER OPERATIONS TESTS
    // ============================================================================

    describe('createFolder', () => {
        it('should succeed for valid path', async () => {
            const result = await service.createFolder(testProjectId, 'new-folder');
            expect(result.success).toBe(true);
        });

        it('should fail for invalid path', async () => {
            const result = await service.createFolder(testProjectId, 'invalid/path:name');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid folder path');
        });
    });

    describe('renameFolder', () => {
        it('should rename folder and all its contents', async () => {
            // Create assets in a folder structure
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a.png',
                folder_path: 'old-name',
            });
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'b.css',
                storage_path: '/b.css',
                folder_path: 'old-name/css',
            });

            const result = await service.renameFolder(testProjectId, 'old-name', 'new-name');

            expect(result.success).toBe(true);
            expect(result.affectedCount).toBe(2);

            // Verify old folder is empty
            const oldExists = await service.folderExists(testProjectId, 'old-name');
            expect(oldExists).toBe(false);

            // Verify new folder has content
            const newExists = await service.folderExists(testProjectId, 'new-name');
            expect(newExists).toBe(true);
        });

        it('should fail if source folder does not exist', async () => {
            const result = await service.renameFolder(testProjectId, 'nonexistent', 'new');
            expect(result.success).toBe(false);
            expect(result.error).toContain('does not exist');
        });

        it('should fail if destination already exists', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'a.txt',
                storage_path: '/a.txt',
                folder_path: 'source',
            });
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'b.txt',
                storage_path: '/b.txt',
                folder_path: 'dest',
            });

            const result = await service.renameFolder(testProjectId, 'source', 'dest');
            expect(result.success).toBe(false);
            expect(result.error).toContain('already exists');
        });

        it('should return success with 0 count for same path', async () => {
            const result = await service.renameFolder(testProjectId, 'same', 'same');
            expect(result.success).toBe(true);
            expect(result.affectedCount).toBe(0);
        });
    });

    describe('moveFolder', () => {
        it('should move folder to new parent', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'icon.svg',
                storage_path: '/icon.svg',
                folder_path: 'icons',
            });
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'parent.txt',
                storage_path: '/parent.txt',
                folder_path: 'images',
            });

            const result = await service.moveFolder(testProjectId, 'icons', 'images');

            expect(result.success).toBe(true);

            // Verify old folder is gone
            const oldExists = await service.folderExists(testProjectId, 'icons');
            expect(oldExists).toBe(false);

            // Verify new location
            const assets = await assetQueries.findAssetsInFolder(db, testProjectId, 'images/icons');
            expect(assets.length).toBe(1);
            expect(assets[0].filename).toBe('icon.svg');
        });

        it('should fail when moving folder into itself', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'a.txt',
                storage_path: '/a.txt',
                folder_path: 'parent',
            });
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'b.txt',
                storage_path: '/b.txt',
                folder_path: 'parent/child',
            });

            const result = await service.moveFolder(testProjectId, 'parent', 'parent/child');
            expect(result.success).toBe(false);
            expect(result.error).toContain('into itself');
        });
    });

    describe('deleteFolder', () => {
        it('should delete folder and all contents', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a.png',
                folder_path: 'delete-me',
            });
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'b.css',
                storage_path: '/b.css',
                folder_path: 'delete-me/nested',
            });
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'keep.txt',
                storage_path: '/keep.txt',
                folder_path: 'keep-me',
            });

            const result = await service.deleteFolder(testProjectId, 'delete-me');

            expect(result.success).toBe(true);
            expect(result.affectedCount).toBe(2);

            // Verify deleted
            const deleted = await service.folderExists(testProjectId, 'delete-me');
            expect(deleted).toBe(false);

            // Verify other folder untouched
            const kept = await service.folderExists(testProjectId, 'keep-me');
            expect(kept).toBe(true);
        });

        it('should not allow deleting root', async () => {
            const result = await service.deleteFolder(testProjectId, '');
            expect(result.success).toBe(false);
            expect(result.error).toContain('root');
        });
    });

    // ============================================================================
    // FILE OPERATIONS TESTS
    // ============================================================================

    describe('moveAssets', () => {
        it('should move files to destination folder', async () => {
            const asset = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'file.txt',
                storage_path: '/file.txt',
                folder_path: 'source',
                client_id: 'client-123',
            });

            const result = await service.moveAssets(
                testProjectId,
                [{ type: 'file', clientId: 'client-123' }],
                'destination',
            );

            expect(result.success).toBe(true);
            expect(result.affectedCount).toBe(1);

            // Verify moved
            const updated = await assetQueries.findAssetById(db, asset.id);
            expect(updated?.folder_path).toBe('destination');
        });

        it('should fail if destination has file with same name', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'conflict.txt',
                storage_path: '/source/conflict.txt',
                folder_path: 'source',
                client_id: 'source-file',
            });
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'conflict.txt',
                storage_path: '/dest/conflict.txt',
                folder_path: 'destination',
                client_id: 'dest-file',
            });

            const result = await service.moveAssets(
                testProjectId,
                [{ type: 'file', clientId: 'source-file' }],
                'destination',
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('already exists');
        });

        it('should move folders', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'icon.svg',
                storage_path: '/icon.svg',
                folder_path: 'icons',
            });

            const result = await service.moveAssets(testProjectId, [{ type: 'folder', path: 'icons' }], 'images');

            expect(result.success).toBe(true);

            // Verify moved
            const assets = await assetQueries.findAssetsInFolder(db, testProjectId, 'images/icons');
            expect(assets.length).toBe(1);
        });
    });

    describe('duplicateAsset', () => {
        it('should create a copy of the asset', async () => {
            // Create source file on disk
            const sourceDir = path.join(tempDir, 'assets', testProjectUuid, 'original');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'test.txt'), 'test content');

            const original = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'test.txt',
                storage_path: path.join(sourceDir, 'test.txt'),
                folder_path: 'docs',
                client_id: 'original-id',
                content_hash: 'abc123',
            });

            const result = await service.duplicateAsset(testProjectId, testProjectUuid, original.id);

            expect(result.success).toBe(true);
            expect(result.newAsset).toBeDefined();
            expect(result.newAsset!.filename).toBe('test (copy).txt');
            expect(result.newAsset!.folder_path).toBe('docs');
            expect(result.newAsset!.client_id).not.toBe('original-id');
        });

        it('should increment copy number if copy exists', async () => {
            // Create source files
            const sourceDir = path.join(tempDir, 'assets', testProjectUuid, 'original2');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'doc.txt'), 'content');

            const original = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'doc.txt',
                storage_path: path.join(sourceDir, 'doc.txt'),
                folder_path: 'docs',
                client_id: 'orig-id',
            });

            // Create existing copy
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'doc (copy).txt',
                storage_path: '/copy.txt',
                folder_path: 'docs',
            });

            const result = await service.duplicateAsset(testProjectId, testProjectUuid, original.id);

            expect(result.success).toBe(true);
            expect(result.newAsset!.filename).toBe('doc (copy 2).txt');
        });

        it('should fail for non-existent asset', async () => {
            const result = await service.duplicateAsset(testProjectId, testProjectUuid, 99999);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    // ============================================================================
    // ZIP EXTRACTION TESTS
    // ============================================================================

    describe('extractZipAsset', () => {
        it('should extract ZIP contents to target folder', async () => {
            // Create a ZIP file
            const zipContent: Record<string, Uint8Array> = {
                'index.html': new TextEncoder().encode('<html></html>'),
                'css/style.css': new TextEncoder().encode('body {}'),
                'js/app.js': new TextEncoder().encode('console.log("hello")'),
            };
            const zipped = fflate.zipSync(zipContent);

            // Save ZIP to disk
            const zipPath = path.join(tempDir, 'assets', testProjectUuid, 'website.zip');
            await fs.ensureDir(path.dirname(zipPath));
            await fs.writeFile(zipPath, Buffer.from(zipped));

            // Create ZIP asset record
            const zipAsset = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'website.zip',
                storage_path: zipPath,
                folder_path: '',
                mime_type: 'application/zip',
                client_id: 'zip-asset-id',
            });

            const result = await service.extractZipAsset(testProjectId, testProjectUuid, zipAsset.id, 'mywebsite');

            expect(result.success).toBe(true);
            expect(result.extractedCount).toBe(3);
            expect(result.folders.sort()).toEqual(['mywebsite/css', 'mywebsite/js']);

            // Verify assets were created with correct paths
            const indexAsset = await assetQueries.findAssetByPath(db, testProjectId, 'mywebsite', 'index.html');
            expect(indexAsset).toBeDefined();
            expect(indexAsset!.mime_type).toBe('text/html');

            const cssAsset = await assetQueries.findAssetByPath(db, testProjectId, 'mywebsite/css', 'style.css');
            expect(cssAsset).toBeDefined();
            expect(cssAsset!.mime_type).toBe('text/css');
        });

        it('should skip __MACOSX and hidden files', async () => {
            const zipContent: Record<string, Uint8Array> = {
                'index.html': new TextEncoder().encode('<html></html>'),
                '__MACOSX/._index.html': new TextEncoder().encode('meta'),
                '.DS_Store': new TextEncoder().encode('ds'),
            };
            const zipped = fflate.zipSync(zipContent);

            const zipPath = path.join(tempDir, 'assets', testProjectUuid, 'mac.zip');
            await fs.ensureDir(path.dirname(zipPath));
            await fs.writeFile(zipPath, Buffer.from(zipped));

            const zipAsset = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'mac.zip',
                storage_path: zipPath,
                folder_path: '',
                mime_type: 'application/zip',
                client_id: 'mac-zip',
            });

            const result = await service.extractZipAsset(testProjectId, testProjectUuid, zipAsset.id, 'extracted');

            expect(result.success).toBe(true);
            expect(result.extractedCount).toBe(1); // Only index.html
        });

        it('should fail for non-ZIP asset', async () => {
            const pngAsset = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'image.png',
                storage_path: '/image.png',
                folder_path: '',
                mime_type: 'image/png',
            });

            const result = await service.extractZipAsset(testProjectId, testProjectUuid, pngAsset.id, 'extracted');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not a ZIP file');
        });

        it('should fail for invalid target folder', async () => {
            const result = await service.extractZipAsset(testProjectId, testProjectUuid, 1, 'invalid:path');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid target folder');
        });

        it('should fail for non-existent asset', async () => {
            const result = await service.extractZipAsset(testProjectId, testProjectUuid, 99999, 'extracted');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should reject zip slip (path traversal) in zip contents', async () => {
            const evilZipContent: Record<string, Uint8Array> = {
                '../../evil.html': new TextEncoder().encode('<html>evil</html>'),
                '../other_evil.css': new TextEncoder().encode('body { background: red; }'),
            };
            const zipped = fflate.zipSync(evilZipContent);

            const zipPath = path.join(tempDir, 'assets', testProjectUuid, 'evil.zip');
            await fs.ensureDir(path.dirname(zipPath));
            await fs.writeFile(zipPath, Buffer.from(zipped));

            const zipAsset = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'evil.zip',
                storage_path: zipPath,
                folder_path: '',
                mime_type: 'application/zip',
                client_id: 'evil-zip',
            });

            const result = await service.extractZipAsset(testProjectId, testProjectUuid, zipAsset.id, 'extracted');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Security error: invalid file paths detected');
        });
    });
});
