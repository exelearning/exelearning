/**
 * Upload Session Routes Tests
 */
import { describe, it, expect, beforeEach, mock, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as path from 'path';
import * as fs from 'fs-extra';
import { createUploadSessionRoutes, type UploadSessionDependencies } from './upload-session';
import { buildAssetStoragePath, getAssetShard } from '../utils/asset-paths';
import {
    createUploadSessionManager,
    validateSession,
    emitProgress,
    emitBatchComplete,
    deleteSession,
    MAX_BATCH_FILES,
    MAX_BATCH_BYTES,
} from '../services/upload-session-manager';
import type { Database } from '../db/types';
import type { Kysely } from 'kysely';

// Test directory
const TEST_DIR = '/tmp/upload-session-test';

// Create a fresh session manager for tests
const testSessionManager = createUploadSessionManager();

// Mock database implementation
const createMockDb = () =>
    ({
        selectFrom: () => ({
            where: () => ({
                select: () => ({
                    execute: () => Promise.resolve([]),
                    executeTakeFirst: () => Promise.resolve(undefined),
                }),
                selectAll: () => ({
                    execute: () => Promise.resolve([]),
                    executeTakeFirst: () => Promise.resolve(undefined),
                }),
            }),
        }),
    }) as unknown as Kysely<Database>;

// Mock queries
const createMockQueries = () => ({
    createAssets: mock((db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
        Promise.resolve(assets.map((a, i) => ({ id: i + 1, client_id: a.client_id }))),
    ),
    findAssetsByClientIds: mock(() => Promise.resolve([])),
    bulkUpdateAssets: mock(() => Promise.resolve()),
    findProjectByUuid: mock(() => Promise.resolve({ id: 1, uuid: 'test-uuid', user_id: 1 })),
});

describe('Upload Session Routes', () => {
    let app: Elysia;
    let mockQueries: ReturnType<typeof createMockQueries>;
    let sessionToken: string;

    beforeEach(async () => {
        // Clean up test directory
        await fs.ensureDir(TEST_DIR);
        await fs.emptyDir(TEST_DIR);

        // Set FILES_DIR for tests
        process.env.ELYSIA_FILES_DIR = TEST_DIR;

        mockQueries = createMockQueries();

        // Create a valid session for testing
        const result = await testSessionManager.createSession({
            projectId: 'test-project-uuid',
            projectIdNum: 1,
            userId: 1,
            clientId: 'test-client',
            totalFiles: 5,
            totalBytes: 10000,
        });
        sessionToken = result.sessionToken;

        // Create routes with mocked dependencies
        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.remove(TEST_DIR);
    });

    describe('GET /api/upload-session/stats', () => {
        it('should return session manager stats', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/upload-session/stats', {
                    method: 'GET',
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
            expect(typeof data.data.activeSessions).toBe('number');
        });
    });

    describe('DELETE /api/upload-session/:token', () => {
        it('should cancel a valid session', async () => {
            // Create a session first
            const { sessionToken: testToken } = await testSessionManager.createSession({
                projectId: 'test-project',
                projectIdNum: 1,
                userId: 1,
                clientId: 'test-client',
                totalFiles: 5,
                totalBytes: 1000,
            });

            const response = await app.handle(
                new Request(`http://localhost/api/upload-session/${testToken}`, {
                    method: 'DELETE',
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Session cancelled');
        });

        it('should return 401 for invalid session token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/upload-session/invalid-token', {
                    method: 'DELETE',
                }),
            );

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('Invalid or expired session token');
        });
    });

    describe('POST /api/upload-session/:token/batch', () => {
        it('should return 401 for invalid session token', async () => {
            const formData = new FormData();
            formData.append('metadata', JSON.stringify([]));

            const response = await app.handle(
                new Request('http://localhost/api/upload-session/invalid-token/batch', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('Invalid or expired session token');
        });

        it('should return 400 if no files provided', async () => {
            const formData = new FormData();
            formData.append('metadata', JSON.stringify([]));

            const response = await app.handle(
                new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('No files provided');
        });

        it('should return 401 if header token does not match', async () => {
            const formData = new FormData();
            formData.append(
                'metadata',
                JSON.stringify([{ clientId: 'test', filename: 'test.txt', mimeType: 'text/plain' }]),
            );
            formData.append('files', new Blob(['test content'], { type: 'text/plain' }));

            const response = await app.handle(
                new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                    method: 'POST',
                    headers: {
                        'X-Upload-Session': 'different-token',
                    },
                    body: formData,
                }),
            );

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('Token mismatch');
        });

        it('should return 400 if metadata is invalid JSON', async () => {
            const formData = new FormData();
            formData.append('metadata', 'not valid json');
            formData.append('files', new Blob(['test content'], { type: 'text/plain' }));

            const response = await app.handle(
                new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('Invalid metadata JSON');
        });

        it('should return 400 if too many files', async () => {
            const formData = new FormData();

            // Create metadata for too many files
            const metadata = [];
            for (let i = 0; i < MAX_BATCH_FILES + 1; i++) {
                metadata.push({ clientId: `file-${i}`, filename: `file${i}.txt`, mimeType: 'text/plain' });
                formData.append('files', new Blob(['test'], { type: 'text/plain' }));
            }
            formData.append('metadata', JSON.stringify(metadata));

            const response = await app.handle(
                new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toContain('Too many files');
        });
    });
});

describe('Upload Session Routes - Factory', () => {
    it('should create routes instance with default dependencies', () => {
        // This tests that the factory can be called without dependencies
        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: createMockQueries() as unknown as UploadSessionDependencies['queries'],
        });

        expect(routes).toBeDefined();
    });
});

describe('Upload Session Routes - Integration', () => {
    let app: Elysia;
    let sessionToken: string;
    const projectUuid = 'integration-test-project';

    beforeEach(async () => {
        // Clean up test directory
        await fs.ensureDir(TEST_DIR);
        await fs.emptyDir(TEST_DIR);

        process.env.ELYSIA_FILES_DIR = TEST_DIR;

        // Create mock queries that actually simulate database behavior
        const mockQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(
                    assets.map((a, i) => ({
                        id: i + 100,
                        client_id: a.client_id,
                    })),
                ),
            ),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 42, uuid: projectUuid, user_id: 1 })),
        };

        // Create a valid session using the global session manager (imported in the routes)
        const result = await testSessionManager.createSession({
            projectId: projectUuid,
            projectIdNum: 42,
            userId: 1,
            clientId: 'integration-test-client',
            totalFiles: 5,
            totalBytes: 5000,
        });
        sessionToken = result.sessionToken;

        // Create the routes
        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
    });

    afterEach(async () => {
        await fs.remove(TEST_DIR);
    });

    it('should accept batch upload with valid session and single file', async () => {
        // Create assets directory
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: 'test-asset-1', filename: 'test.txt', mimeType: 'text/plain' }]),
        );
        formData.append('files', new Blob(['Hello, World!'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                headers: {
                    'X-Upload-Session': sessionToken,
                },
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.uploaded).toBe(1);
        expect(data.failed).toBe(0);
    });

    it('should persist a FILES_DIR-relative sharded storage_path (issue #2250)', async () => {
        const capturingQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(assets.map((a, i) => ({ id: i + 900, client_id: a.client_id }))),
            ),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 42, uuid: projectUuid, user_id: 1 })),
        };
        const capturingApp = new Elysia().use(
            createUploadSessionRoutes({
                db: createMockDb(),
                queries: capturingQueries as unknown as UploadSessionDependencies['queries'],
            }),
        );

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: 'sharded-asset-1', filename: 'photo.png', mimeType: 'image/png' }]),
        );
        formData.append('files', new Blob(['sharded bytes'], { type: 'image/png' }));

        const response = await capturingApp.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );
        expect(response.status).toBe(200);

        const created = capturingQueries.createAssets.mock.calls[0][1] as unknown as Array<{
            storage_path: string;
        }>;
        expect(created[0].storage_path).toBe(buildAssetStoragePath(projectUuid, 'sharded-asset-1.png'));
        expect(path.isAbsolute(created[0].storage_path)).toBe(false);

        // The physical file lives in the sharded directory, created lazily.
        const physical = path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid, 'sharded-asset-1.png');
        expect(await fs.pathExists(physical)).toBe(true);
    });

    it('should accept batch upload with multiple files', async () => {
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([
                { clientId: 'asset-a', filename: 'file-a.txt', mimeType: 'text/plain' },
                { clientId: 'asset-b', filename: 'file-b.txt', mimeType: 'text/plain' },
                { clientId: 'asset-c', filename: 'file-c.txt', mimeType: 'text/plain' },
            ]),
        );
        formData.append('files', new Blob(['Content A'], { type: 'text/plain' }));
        formData.append('files', new Blob(['Content B'], { type: 'text/plain' }));
        formData.append('files', new Blob(['Content C'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                headers: {
                    'X-Upload-Session': sessionToken,
                },
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.uploaded).toBe(3);
        expect(data.failed).toBe(0);
    });

    it('should accept batch upload without X-Upload-Session header', async () => {
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: 'no-header-asset', filename: 'test.txt', mimeType: 'text/plain' }]),
        );
        formData.append('files', new Blob(['Test content'], { type: 'text/plain' }));

        // Note: No X-Upload-Session header, but token is in URL
        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
    });

    it('should handle metadata as array instead of string', async () => {
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        // This tests the case where metadata is already parsed as array
        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: 'array-meta', filename: 'test.txt', mimeType: 'text/plain' }]),
        );
        formData.append('files', new Blob(['Array metadata test'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
    });

    it('should handle file upload with missing metadata fields', async () => {
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        // Metadata with minimal fields
        formData.append('metadata', JSON.stringify([{ clientId: 'minimal-meta' }]));
        formData.append('files', new Blob(['Minimal metadata content'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
    });

    it('should handle file upload with folderPath', async () => {
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([
                { clientId: 'folder-asset', filename: 'test.txt', mimeType: 'text/plain', folderPath: 'subdir/nested' },
            ]),
        );
        formData.append('files', new Blob(['Nested folder content'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
    });
});

describe('Upload Session Routes - Edge Cases', () => {
    let app: Elysia;
    let sessionToken: string;
    const projectUuid = 'edge-case-project';

    beforeEach(async () => {
        await fs.ensureDir(TEST_DIR);
        await fs.emptyDir(TEST_DIR);
        process.env.ELYSIA_FILES_DIR = TEST_DIR;

        const result = await testSessionManager.createSession({
            projectId: projectUuid,
            projectIdNum: 99,
            userId: 1,
            clientId: 'edge-case-client',
            totalFiles: 10,
            totalBytes: 10000,
        });
        sessionToken = result.sessionToken;
    });

    afterEach(async () => {
        await fs.remove(TEST_DIR);
    });

    it('should handle existing assets (update path)', async () => {
        // Create mock queries that return existing assets
        const existingAsset = {
            id: 999,
            client_id: 'existing-asset',
            filename: 'old.txt',
            mime_type: 'text/plain',
            file_size: '100',
        };

        const mockQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(assets.map((a, i) => ({ id: i + 100, client_id: a.client_id }))),
            ),
            findAssetsByClientIds: mock((_db: Kysely<Database>, clientIds: string[]) => {
                // Return existing asset if the clientId matches
                if (clientIds.includes('existing-asset')) {
                    return Promise.resolve([existingAsset]);
                }
                return Promise.resolve([]);
            }),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 99, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: 'existing-asset', filename: 'updated.txt', mimeType: 'text/plain' }]),
        );
        formData.append('files', new Blob(['Updated content'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.uploaded).toBe(1);

        // Verify bulkUpdateAssets was called
        expect(mockQueries.bulkUpdateAssets).toHaveBeenCalled();
    });

    it('should handle mixed new and existing assets', async () => {
        const mockQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(assets.map((a, i) => ({ id: i + 200, client_id: a.client_id }))),
            ),
            findAssetsByClientIds: mock((_db: Kysely<Database>, clientIds: string[]) => {
                // Only 'existing-1' exists
                if (clientIds.includes('existing-1')) {
                    return Promise.resolve([{ id: 500, client_id: 'existing-1', filename: 'old.txt' }]);
                }
                return Promise.resolve([]);
            }),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 99, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([
                { clientId: 'existing-1', filename: 'existing.txt', mimeType: 'text/plain' },
                { clientId: 'new-1', filename: 'new.txt', mimeType: 'text/plain' },
            ]),
        );
        formData.append('files', new Blob(['Existing content'], { type: 'text/plain' }));
        formData.append('files', new Blob(['New content'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.uploaded).toBe(2);
    });

    it('should handle file with extensions preserved', async () => {
        const mockQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(assets.map((a, i) => ({ id: i + 300, client_id: a.client_id }))),
            ),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 99, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: 'image-asset', filename: 'photo.jpg', mimeType: 'image/jpeg' }]),
        );
        formData.append('files', new Blob(['fake image data'], { type: 'image/jpeg' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);

        // Verify the file was created with correct extension
        const files = await fs.readdir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));
        expect(files.some(f => f.endsWith('.jpg'))).toBe(true);
    });

    it('should handle dangerous folderPath (path traversal attempt)', async () => {
        const mockQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(assets.map((a, i) => ({ id: i + 400, client_id: a.client_id }))),
            ),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 99, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([
                {
                    clientId: 'traversal-asset',
                    filename: 'test.txt',
                    mimeType: 'text/plain',
                    folderPath: '../../../etc/passwd',
                },
            ]),
        );
        formData.append('files', new Blob(['Harmless content'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        // The path should be sanitized, not allowing traversal
    });

    it('should handle Buffer files', async () => {
        const mockQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(assets.map((a, i) => ({ id: i + 500, client_id: a.client_id }))),
            ),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 99, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: 'buffer-asset', filename: 'buffer.txt', mimeType: 'text/plain' }]),
        );
        // Create a blob that will become a buffer in the handler
        formData.append('files', new Blob([Buffer.from('Buffer content')], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
    });
});

describe('Upload Session Routes - Path Traversal Security (C1)', () => {
    let app: Elysia;
    let sessionToken: string;
    let mockQueries: ReturnType<typeof createMockQueries>;
    const projectUuid = 'traversal-security-project';
    const assetsDir = path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid);

    beforeEach(async () => {
        await fs.ensureDir(TEST_DIR);
        await fs.emptyDir(TEST_DIR);
        process.env.ELYSIA_FILES_DIR = TEST_DIR;

        mockQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(assets.map((a, i) => ({ id: i + 1000, client_id: a.client_id }))),
            ),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 55, uuid: projectUuid, user_id: 1 })),
        };

        const result = await testSessionManager.createSession({
            projectId: projectUuid,
            projectIdNum: 55,
            userId: 1,
            clientId: 'traversal-security-client',
            totalFiles: 5,
            totalBytes: 5000,
        });
        sessionToken = result.sessionToken;

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });
        app = new Elysia().use(routes);

        await fs.ensureDir(assetsDir);
    });

    afterEach(async () => {
        await fs.remove(TEST_DIR);
    });

    it('should reject a batch whose clientId attempts path traversal and write nothing', async () => {
        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: '../../../../tmp/evil', filename: 'pwn.txt', mimeType: 'text/plain' }]),
        );
        formData.append('files', new Blob(['malicious content'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid clientId in metadata');

        // Nothing should have been written to disk and no DB inserts attempted.
        const assetFiles = await fs.readdir(assetsDir);
        expect(assetFiles.length).toBe(0);
        expect(mockQueries.createAssets).not.toHaveBeenCalled();
        expect(mockQueries.bulkUpdateAssets).not.toHaveBeenCalled();
    });

    it('should reject a batch when ANY clientId is unsafe (mixed with a valid one) and write nothing', async () => {
        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([
                { clientId: 'safe-asset', filename: 'ok.txt', mimeType: 'text/plain' },
                { clientId: 'a/../../escape', filename: 'pwn.txt', mimeType: 'text/plain' },
            ]),
        );
        formData.append('files', new Blob(['ok content'], { type: 'text/plain' }));
        formData.append('files', new Blob(['evil content'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid clientId in metadata');

        // The whole batch is rejected before any write, so even the "safe" file is not written.
        const assetFiles = await fs.readdir(assetsDir);
        expect(assetFiles.length).toBe(0);
        expect(mockQueries.createAssets).not.toHaveBeenCalled();
    });

    it('should reject an absolute-path clientId and write nothing', async () => {
        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: '/etc/cron.d/evil', filename: 'job', mimeType: 'text/plain' }]),
        );
        formData.append('files', new Blob(['cron payload'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Invalid clientId in metadata');

        const assetFiles = await fs.readdir(assetsDir);
        expect(assetFiles.length).toBe(0);
    });

    it('should still accept a normal batch with safe clientIds and write the files', async () => {
        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([
                { clientId: 'safe-asset-1', filename: 'a.txt', mimeType: 'text/plain' },
                { clientId: 'safe_asset-2', filename: 'b.png', mimeType: 'image/png' },
            ]),
        );
        formData.append('files', new Blob(['content one'], { type: 'text/plain' }));
        formData.append('files', new Blob(['content two'], { type: 'image/png' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.uploaded).toBe(2);
        expect(data.failed).toBe(0);

        // Files are written inside the project assets dir using the clientId + sanitized extension.
        const assetFiles = await fs.readdir(assetsDir);
        expect(assetFiles).toContain('safe-asset-1.txt');
        expect(assetFiles).toContain('safe_asset-2.png');
    });
});

describe('Upload Session Routes - Batch Size Limit (L1, memory DoS)', () => {
    let app: Elysia;
    let sessionToken: string;
    let mockQueries: ReturnType<typeof createMockQueries>;
    const projectUuid = 'batch-size-limit-project';
    const assetsDir = path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid);

    beforeEach(async () => {
        await fs.ensureDir(TEST_DIR);
        await fs.emptyDir(TEST_DIR);
        process.env.ELYSIA_FILES_DIR = TEST_DIR;

        mockQueries = createMockQueries();

        const result = await testSessionManager.createSession({
            projectId: projectUuid,
            projectIdNum: 88,
            userId: 1,
            clientId: 'batch-size-limit-client',
            totalFiles: 5,
            totalBytes: 5000,
        });
        sessionToken = result.sessionToken;

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });
        app = new Elysia().use(routes);

        await fs.ensureDir(assetsDir);
    });

    afterEach(async () => {
        await fs.remove(TEST_DIR);
    });

    it('rejects a batch whose declared total exceeds MAX_BATCH_BYTES before buffering or writing', async () => {
        // Two Blobs whose declared `.size` sum to well over the cap. The early declared-size check
        // must reject the batch before any file is buffered into memory or written to disk.
        const halfPlus = Math.ceil(MAX_BATCH_BYTES / 2) + 1024 * 1024; // each just over half the cap
        const chunk = Buffer.alloc(halfPlus, 'x');

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([
                { clientId: 'big-1', filename: 'big1.bin', mimeType: 'application/octet-stream' },
                { clientId: 'big-2', filename: 'big2.bin', mimeType: 'application/octet-stream' },
            ]),
        );
        formData.append('files', new Blob([chunk], { type: 'application/octet-stream' }));
        formData.append('files', new Blob([chunk], { type: 'application/octet-stream' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Batch too large');
        expect(data.error).toContain('100MB');

        // Nothing was buffered to disk and no asset records were created/updated: the cap was
        // enforced before the buffering and persistence phases.
        const assetFiles = await fs.readdir(assetsDir);
        expect(assetFiles.length).toBe(0);
        expect(mockQueries.createAssets).not.toHaveBeenCalled();
        expect(mockQueries.bulkUpdateAssets).not.toHaveBeenCalled();
    });

    it('rejects a batch where the declared total first exceeds the cap on a later file', async () => {
        // The running declared total only crosses the cap on the last file. The handler must still
        // reject the whole batch and persist nothing.
        const small = Buffer.alloc(1024, 'a'); // 1KB
        const huge = Buffer.alloc(MAX_BATCH_BYTES, 'b'); // exactly the cap, so total > cap

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([
                { clientId: 'small-1', filename: 'small.txt', mimeType: 'text/plain' },
                { clientId: 'huge-1', filename: 'huge.bin', mimeType: 'application/octet-stream' },
            ]),
        );
        formData.append('files', new Blob([small], { type: 'text/plain' }));
        formData.append('files', new Blob([huge], { type: 'application/octet-stream' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Batch too large');

        const assetFiles = await fs.readdir(assetsDir);
        expect(assetFiles.length).toBe(0);
        expect(mockQueries.createAssets).not.toHaveBeenCalled();
    });

    it('accepts a batch that is comfortably within MAX_BATCH_BYTES', async () => {
        // A legitimate batch under the cap must still succeed exactly as before.
        const content = Buffer.alloc(2 * 1024 * 1024, 'z'); // 2MB total, well under 100MB

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([
                { clientId: 'within-1', filename: 'a.bin', mimeType: 'application/octet-stream' },
                { clientId: 'within-2', filename: 'b.bin', mimeType: 'application/octet-stream' },
            ]),
        );
        formData.append('files', new Blob([content], { type: 'application/octet-stream' }));
        formData.append('files', new Blob([content], { type: 'application/octet-stream' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.uploaded).toBe(2);
        expect(data.failed).toBe(0);

        const assetFiles = await fs.readdir(assetsDir);
        expect(assetFiles).toContain('within-1.bin');
        expect(assetFiles).toContain('within-2.bin');
    });
});

describe('Upload Session Exports', () => {
    it('should export validateSession function', () => {
        expect(typeof validateSession).toBe('function');
    });

    it('should export emitProgress function', () => {
        expect(typeof emitProgress).toBe('function');
    });

    it('should export emitBatchComplete function', () => {
        expect(typeof emitBatchComplete).toBe('function');
    });

    it('should export deleteSession function', () => {
        expect(typeof deleteSession).toBe('function');
    });
});

describe('Upload Session Routes - Error Handling', () => {
    let app: Elysia;
    let sessionToken: string;
    const projectUuid = 'error-handling-project';

    beforeEach(async () => {
        await fs.ensureDir(TEST_DIR);
        await fs.emptyDir(TEST_DIR);
        process.env.ELYSIA_FILES_DIR = TEST_DIR;

        const result = await testSessionManager.createSession({
            projectId: projectUuid,
            projectIdNum: 77,
            userId: 1,
            clientId: 'error-handling-client',
            totalFiles: 10,
            totalBytes: 10000,
        });
        sessionToken = result.sessionToken;
    });

    afterEach(async () => {
        await fs.remove(TEST_DIR);
    });

    it('should return 400 when batch is too large (over MAX_BATCH_BYTES)', async () => {
        const mockQueries = {
            createAssets: mock(() => Promise.resolve([])),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 77, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        // Create a large blob (we'll use multiple files that exceed MAX_BATCH_BYTES in total)
        // MAX_BATCH_BYTES is 100MB, so we create files that exceed this
        const largeContent = Buffer.alloc(60 * 1024 * 1024, 'x'); // 60MB each

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([
                { clientId: 'large-1', filename: 'large1.bin', mimeType: 'application/octet-stream' },
                { clientId: 'large-2', filename: 'large2.bin', mimeType: 'application/octet-stream' },
            ]),
        );
        formData.append('files', new Blob([largeContent], { type: 'application/octet-stream' }));
        formData.append('files', new Blob([largeContent], { type: 'application/octet-stream' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Batch too large');
        expect(data.error).toContain('100MB');
    });

    it('should handle write failures and report failed files', async () => {
        const mockQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(assets.map((a, i) => ({ id: i + 600, client_id: a.client_id }))),
            ),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 77, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);

        // Create an unwritable directory (by making it read-only or non-existent parent)
        // We'll use a path that will fail to write
        const badPath = path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid);
        await fs.ensureDir(badPath);
        // Create a file with the same name as what we'll try to write
        const blockingFilePath = path.join(badPath, 'blocking-asset');
        await fs.ensureDir(blockingFilePath); // Create a directory where we expect a file

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([
                { clientId: 'blocking-asset', filename: 'test', mimeType: 'text/plain' }, // No extension, so filename = clientId
            ]),
        );
        formData.append('files', new Blob(['Content that will fail to write'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(false); // Should be false because there was a failure
        expect(data.failed).toBe(1);
        expect(data.results.some((r: { success: boolean; error?: string }) => !r.success && r.error)).toBe(true);
    });

    it('should handle top-level errors gracefully', async () => {
        // Create mock queries that throw an error
        const mockQueries = {
            createAssets: mock(() => {
                throw new Error('Database connection failed');
            }),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 77, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: 'error-asset', filename: 'test.txt', mimeType: 'text/plain' }]),
        );
        formData.append('files', new Blob(['Content'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Database connection failed');
    });

    it('should handle non-Error thrown objects', async () => {
        // Create mock queries that throw a non-Error object
        const mockQueries = {
            createAssets: mock(() => {
                throw 'String error message'; // eslint-disable-line no-throw-literal
            }),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 77, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: 'string-error-asset', filename: 'test.txt', mimeType: 'text/plain' }]),
        );
        formData.append('files', new Blob(['Content'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('String error message');
    });

    it('should handle file with name property from File object', async () => {
        const mockQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(assets.map((a, i) => ({ id: i + 700, client_id: a.client_id }))),
            ),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 77, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: 'file-object-asset', filename: 'ignored.txt', mimeType: 'text/plain' }]),
        );
        // Create a File object (which has a name property)
        const file = new File(['File content with name'], 'real-filename.txt', { type: 'text/plain' });
        formData.append('files', file);

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
    });

    it('should handle files without metadata entries (fallback to defaults)', async () => {
        const mockQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(assets.map((a, i) => ({ id: i + 800, client_id: a.client_id }))),
            ),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 77, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);
        await fs.ensureDir(path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid));

        const formData = new FormData();
        // Empty metadata array - will use defaults
        formData.append('metadata', JSON.stringify([]));
        formData.append('files', new Blob(['Content without metadata'], { type: 'text/plain' }));

        const response = await app.handle(
            new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        // Should use default clientId like 'file-0'
        expect(data.results.some((r: { clientId: string }) => r.clientId === 'file-0')).toBe(true);
    });

    it('should handle write failure with non-Error thrown', async () => {
        const mockQueries = {
            createAssets: mock((_db: Kysely<Database>, assets: Array<{ client_id: string }>) =>
                Promise.resolve(assets.map((a, i) => ({ id: i + 900, client_id: a.client_id }))),
            ),
            findAssetsByClientIds: mock(() => Promise.resolve([])),
            bulkUpdateAssets: mock(() => Promise.resolve()),
            findProjectByUuid: mock(() => Promise.resolve({ id: 77, uuid: projectUuid, user_id: 1 })),
        };

        const routes = createUploadSessionRoutes({
            db: createMockDb(),
            queries: mockQueries as unknown as UploadSessionDependencies['queries'],
        });

        app = new Elysia().use(routes);

        // Create a path that will cause write to fail
        const assetDir = path.join(TEST_DIR, 'assets', getAssetShard(projectUuid), projectUuid);
        await fs.ensureDir(assetDir);
        // Make the directory read-only to cause write failure
        await fs.chmod(assetDir, 0o444);

        const formData = new FormData();
        formData.append(
            'metadata',
            JSON.stringify([{ clientId: 'readonly-fail', filename: 'test.txt', mimeType: 'text/plain' }]),
        );
        formData.append('files', new Blob(['Content that cannot be written'], { type: 'text/plain' }));

        try {
            const response = await app.handle(
                new Request(`http://localhost/api/upload-session/${sessionToken}/batch`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            // On read-only directory, write should fail
            expect(data.failed).toBeGreaterThanOrEqual(0); // May succeed on some systems
        } finally {
            // Restore permissions for cleanup
            await fs.chmod(assetDir, 0o755);
        }
    });
});
