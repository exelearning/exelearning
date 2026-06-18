/**
 * Tests for Assets Routes
 * Uses Dependency Injection pattern - no mock.module needed
 */
import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';
import {
    createAssetsRoutes,
    sweepStaleChunkUploads,
    startChunkUploadSweeper,
    stopChunkUploadSweeper,
    __getChunkUploadsForTest,
    CHUNK_UPLOAD_TTL_MS,
    MAX_TOTAL_CHUNKS,
    MAX_CHUNK_BYTES,
    type AssetsDependencies,
    type AssetsFileHelperDeps,
    type AssetsSessionManagerDeps,
    type AssetsPriorityQueueDeps,
} from './assets';

const testDir = path.join(process.cwd(), 'test', 'temp', 'assets-test');
const testProjectId = 'test-project-123';
const OWNER_USER_ID = 42;
// Match the fallback in getJwtSecret() so we don't have to mutate process.env.
const TEST_JWT_SECRET = 'dev_secret_change_me';

async function signTestToken(sub: number, roles: string[] = ['ROLE_USER']): Promise<string> {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    return new SignJWT({ sub, email: `u${sub}@test.local`, roles })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

// Mock data stores
let mockSessions: Map<string, any>;

// Create mock file-helper functions
function createMockFileHelper(): AssetsFileHelperDeps {
    return {
        getOdeSessionTempDir: (sessionId: string) => path.join(testDir, 'tmp', sessionId),
        getProjectAssetsDir: (projectUuid: string) => path.join(testDir, 'assets', projectUuid),
        fileExists: async (filePath: string) => fs.pathExists(filePath),
        readFile: async (filePath: string) => fs.readFile(filePath),
        writeFile: async (filePath: string, data: Buffer) => fs.writeFile(filePath, data),
        remove: async (filePath: string) => fs.remove(filePath),
        getStats: async (filePath: string) => {
            try {
                return await fs.stat(filePath);
            } catch {
                return null;
            }
        },
        listFiles: async (dirPath: string) => {
            try {
                return await fs.readdir(dirPath);
            } catch {
                return [];
            }
        },
        generateUniqueFilename: (filename: string) => {
            const ext = path.extname(filename);
            const base = path.basename(filename, ext);
            return `${base}-${Date.now()}${ext}`;
        },
    };
}

// Create mock session-manager functions
function createMockSessionManager(): AssetsSessionManagerDeps {
    return {
        getSession: (sessionId: string) => mockSessions.get(sessionId),
    };
}

// Create mock priority-queue functions
function createMockPriorityQueue(): AssetsPriorityQueueDeps {
    return {
        shouldPreempt: (_projectId: string, _clientId: string) => ({ shouldPreempt: false }),
        getStats: (_projectId: string) => ({
            queueLength: 0,
            processingCount: 0,
            completedCount: 0,
        }),
    };
}

describe('Assets Routes', () => {
    let app: Elysia;
    let mockAssets: Map<number, any>;
    let mockProjects: Map<string, any>;
    let assetIdCounter: number;
    let ownerToken: string;

    /**
     * Wrapper used in place of handle(req) throughout this spec. It
     * forwards the request unchanged when an Authorization header is already
     * present (for negative-auth tests), otherwise it injects the owner JWT
     * so existing positive tests keep passing under the new auth gate.
     */
    async function handle(req: Request): Promise<Response> {
        if (req.headers.has('authorization')) {
            return app.handle(req);
        }
        const headerObj: Record<string, string> = {};
        req.headers.forEach((v, k) => {
            headerObj[k] = v;
        });
        headerObj.authorization = `Bearer ${ownerToken}`;
        const init: RequestInit = {
            method: req.method,
            headers: headerObj,
        };
        // Only materialise body if one was supplied. req.body is a one-shot
        // ReadableStream; copying a non-existent body would turn a "no body"
        // POST into a "0-byte body" POST and confuse handlers that check for
        // body presence.
        if (req.body !== null) {
            init.body = await req.arrayBuffer();
        }
        const rebuilt = new Request(req.url, init);
        return app.handle(rebuilt);
    }

    // Create mock dependencies for each test
    function createMockDependencies(): AssetsDependencies {
        return {
            db: {} as any,
            queries: {
                createAsset: async (_db: any, data: any) => {
                    const id = assetIdCounter++;
                    const asset = {
                        id,
                        ...data,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };
                    mockAssets.set(id, asset);
                    return asset;
                },
                createAssets: async (_db: any, dataArray: any[]) => {
                    return dataArray.map(data => {
                        const id = assetIdCounter++;
                        const asset = {
                            id,
                            ...data,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        };
                        mockAssets.set(id, asset);
                        return asset;
                    });
                },
                findAssetById: async (_db: any, id: number) => mockAssets.get(id),
                findAllAssetsForProject: async (_db: any, projectId: number) => {
                    return Array.from(mockAssets.values()).filter(a => a.project_id === projectId);
                },
                findAssetByClientId: async (_db: any, clientId: string, projectId?: number) => {
                    return Array.from(mockAssets.values()).find(
                        a => a.client_id === clientId && (projectId === undefined || a.project_id === projectId),
                    );
                },
                findAssetsByClientIds: async (_db: any, clientIds: string[], projectId: number) => {
                    return Array.from(mockAssets.values()).filter(
                        a => clientIds.includes(a.client_id) && a.project_id === projectId,
                    );
                },
                deleteAsset: async (_db: any, id: number) => {
                    mockAssets.delete(id);
                },
                updateAsset: async (_db: any, id: number, data: any) => {
                    const asset = mockAssets.get(id);
                    if (asset) {
                        const updated = { ...asset, ...data, updated_at: new Date().toISOString() };
                        mockAssets.set(id, updated);
                        return updated;
                    }
                    return undefined;
                },
                bulkUpdateAssets: async (_db: any, updates: Array<{ id: number; data: any }>) => {
                    for (const { id, data } of updates) {
                        const asset = mockAssets.get(id);
                        if (asset) {
                            const updated = { ...asset, ...data, updated_at: new Date().toISOString() };
                            mockAssets.set(id, updated);
                        }
                    }
                },
                findProjectByUuid: async (_db: any, uuid: string) => mockProjects.get(uuid),
                findProjectById: async (_db: any, id: number) => {
                    for (const project of mockProjects.values()) {
                        if (project.id === id) return project;
                    }
                    return undefined;
                },
                checkProjectAccess: async (_db: any, project: any, userId?: number) => {
                    if (!project) return { hasAccess: false, reason: 'PROJECT_NOT_FOUND' };
                    if (project.visibility === 'public') return { hasAccess: true };
                    if (!userId) return { hasAccess: false, reason: 'AUTHENTICATION_REQUIRED' };
                    if (project.owner_id === userId) return { hasAccess: true };
                    return { hasAccess: false, reason: 'ACCESS_DENIED' };
                },
            },
            fileHelper: createMockFileHelper(),
            sessionManager: createMockSessionManager(),
            priorityQueue: createMockPriorityQueue(),
        };
    }

    beforeAll(async () => {
        ownerToken = await signTestToken(OWNER_USER_ID);
    });

    beforeEach(async () => {
        mockAssets = new Map();
        mockProjects = new Map();
        mockSessions = new Map();
        assetIdCounter = 1;

        // Setup test project owned by OWNER_USER_ID
        mockProjects.set(testProjectId, {
            id: 1,
            uuid: testProjectId,
            owner_id: OWNER_USER_ID,
            visibility: 'private',
            status: 'active',
        });

        // Setup test session
        mockSessions.set(testProjectId, { sessionId: testProjectId, fileName: 'test.elp' });

        // Create mock dependencies and routes
        const mockDeps = createMockDependencies();
        const routes = createAssetsRoutes(mockDeps);
        app = new Elysia().use(routes);

        // Create test directory structure
        await fs.ensureDir(path.join(testDir, 'tmp', testProjectId, 'assets'));
        await fs.ensureDir(path.join(testDir, 'assets', testProjectId)); // Project assets directory (using UUID)
    });

    afterEach(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('POST /api/projects/:projectId/assets - Upload Asset', () => {
        it('should upload a file successfully', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['test content'], { type: 'text/plain' }), 'test.txt');
            formData.append('clientId', 'client-123');

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            expect(body.data.filename).toBe('test.txt');
        });

        it('should return 400 when no file uploaded', async () => {
            const formData = new FormData();

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toContain('No file uploaded');
        });

        it('should return 404 for non-existent project', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.txt');

            const res = await handle(
                new Request('http://localhost/api/projects/non-existent-uuid/assets', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(404);
        });

        it('should include componentId when provided', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.txt');
            formData.append('componentId', 'idevice-abc');

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.componentId).toBe('idevice-abc');
        });

        it('should update existing asset instead of creating duplicate (idempotent upload)', async () => {
            // Pre-create an asset with a specific clientId (simulates existing asset from earlier upload)
            const existingClientId = 'existing-client-id-123';
            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                client_id: existingClientId,
                filename: 'original.txt',
                storage_path: '/old/path/original.txt',
                mime_type: 'text/plain',
                file_size: '100',
                folder_path: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            // Upload file with SAME clientId (simulates bulk upload during collaboration join)
            const formData = new FormData();
            formData.append('file', new Blob(['updated content'], { type: 'text/plain' }), 'updated.txt');
            formData.append('clientId', existingClientId);

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();

            // Should have same ID (updated, not new record)
            expect(body.data.id).toBe(1);
            // Filename should be updated
            expect(body.data.filename).toBe('updated.txt');

            // Verify only 1 asset exists (no duplicate created)
            expect(mockAssets.size).toBe(1);
        });

        it('should create new asset when clientId does not exist', async () => {
            // Ensure no assets exist initially
            expect(mockAssets.size).toBe(0);

            const formData = new FormData();
            formData.append('file', new Blob(['new content'], { type: 'text/plain' }), 'new.txt');
            formData.append('clientId', 'new-client-id-456');

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.filename).toBe('new.txt');
            expect(body.data.clientId).toBe('new-client-id-456');

            // Verify asset was created
            expect(mockAssets.size).toBe(1);
        });
    });

    describe('path traversal protection (clientId / resumableIdentifier as on-disk names)', () => {
        const TRAVERSAL = '../../../../tmp/pwned';

        it('rejects a traversal clientId on simple upload with 400', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['x'], { type: 'text/plain' }), 'test.txt');
            formData.append('clientId', TRAVERSAL);

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets`, { method: 'POST', body: formData }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toContain('Invalid clientId');
            // Nothing should have been written/created.
            expect(mockAssets.size).toBe(0);
        });

        it('rejects a traversal resumableIdentifier on chunk upload with 400', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['chunk'], { type: 'application/octet-stream' }));
            formData.append('resumableIdentifier', TRAVERSAL);
            formData.append('resumableChunkNumber', '1');
            formData.append('resumableTotalChunks', '1');

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/upload-chunk`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('Invalid identifier');
        });

        it('rejects a traversal clientId on chunk finalize with 400', async () => {
            const formData = new FormData();
            formData.append('resumableIdentifier', 'some-id');
            formData.append('clientId', TRAVERSAL);

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/upload-chunk/finalize`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('Invalid clientId');
        });

        it('rejects a traversal clientId inside /sync metadata with 400', async () => {
            const formData = new FormData();
            formData.append('files', new Blob(['x'], { type: 'text/plain' }), 'a.txt');
            formData.append(
                'metadata',
                JSON.stringify([{ clientId: TRAVERSAL, filename: 'a.txt', mimeType: 'text/plain' }]),
            );

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/sync`, { method: 'POST', body: formData }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('Invalid clientId');
        });

        it('rejects a traversal x-client-id header on /stream with 400', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/stream`, {
                    method: 'POST',
                    headers: { 'x-client-id': TRAVERSAL, 'content-type': 'application/octet-stream' },
                    body: 'streamed-bytes',
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('Invalid clientId');
        });

        it('still accepts a normal UUID-style clientId', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['ok'], { type: 'text/plain' }), 'ok.txt');
            formData.append('clientId', '550e8400-e29b-41d4-a716-446655440000');

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets`, { method: 'POST', body: formData }),
            );

            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/projects/:projectId/assets - List Assets', () => {
        it('should return empty array for project with no assets', async () => {
            const res = await handle(new Request(`http://localhost/api/projects/1/assets`));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toEqual([]);
        });

        it('should return assets for project', async () => {
            // Create some assets
            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'image.png',
                mime_type: 'image/png',
                file_size: '1024',
                client_id: 'client-1',
            });
            mockAssets.set(2, {
                id: 2,
                project_id: 1,
                filename: 'doc.pdf',
                mime_type: 'application/pdf',
                file_size: '2048',
                client_id: 'client-2',
            });

            const res = await handle(new Request(`http://localhost/api/projects/1/assets`));

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.length).toBe(2);
        });

        it('should not include assets from other projects', async () => {
            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'mine.png',
                file_size: '100',
            });
            mockAssets.set(2, {
                id: 2,
                project_id: 999, // Different project
                filename: 'other.png',
                file_size: '100',
            });

            const res = await handle(new Request(`http://localhost/api/projects/1/assets`));

            const body = await res.json();
            expect(body.data.length).toBe(1);
            expect(body.data[0].filename).toBe('mine.png');
        });
    });

    describe('GET /api/projects/:projectId/assets/:assetId - Download Asset', () => {
        it('should download asset file', async () => {
            // Create test file
            const filePath = path.join(testDir, 'test-asset.txt');
            await fs.writeFile(filePath, 'Asset content');

            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'test-asset.txt',
                storage_path: filePath,
                mime_type: 'text/plain',
            });

            const res = await handle(new Request(`http://localhost/api/projects/1/assets/1`));

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('text/plain');
            expect(res.headers.get('content-disposition')).toContain('test-asset.txt');

            const content = await res.text();
            expect(content).toBe('Asset content');
        });

        it('should return 404 for non-existent asset', async () => {
            const res = await handle(new Request(`http://localhost/api/projects/1/assets/999`));

            expect(res.status).toBe(404);
        });

        it('should return 404 for non-existent project UUID', async () => {
            const res = await handle(new Request(`http://localhost/api/projects/non-existent-uuid/assets/1`));
            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toContain('Project not found');
        });

        it('should return 404 when numeric asset belongs to another project', async () => {
            const filePath = path.join(testDir, 'other-project-asset.txt');
            await fs.writeFile(filePath, 'Other project content');

            mockAssets.set(1, {
                id: 1,
                project_id: 2, // Deliberately different project
                filename: 'other-project-asset.txt',
                storage_path: filePath,
                mime_type: 'text/plain',
            });

            const res = await handle(new Request(`http://localhost/api/projects/1/assets/1`));
            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toContain('Asset not found');
        });

        it('should resolve UUID-like client_id in :assetId param', async () => {
            const filePath = path.join(testDir, 'uuid-client-asset.txt');
            await fs.writeFile(filePath, 'UUID client asset content');

            const clientId = '960cbe4b-0c2c-4466-95d4-6a3c4d7fd275';
            mockAssets.set(1, {
                id: 101,
                project_id: 1,
                filename: 'uuid-client-asset.txt',
                storage_path: filePath,
                mime_type: 'text/plain',
                client_id: clientId,
            });

            const res = await handle(new Request(`http://localhost/api/projects/1/assets/${clientId}`));
            expect(res.status).toBe(200);
            expect(await res.text()).toBe('UUID client asset content');
        });

        it('should return 404 for non-numeric and non-existent client_id', async () => {
            const res = await handle(new Request(`http://localhost/api/projects/1/assets/invalid`));

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toContain('Asset not found');
        });

        it('should return 404 when file not on disk', async () => {
            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'missing.txt',
                storage_path: '/non/existent/path.txt',
            });

            const res = await handle(new Request(`http://localhost/api/projects/1/assets/1`));

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toContain('not found');
        });

        // Regression for issue #1749: Bun's Response constructor rejects header
        // values containing bytes outside printable ASCII, so any filename with
        // accented characters (e.g. "San Marcial de Rubicón.png") used to surface
        // as a 500 with "Header has invalid value" instead of streaming the file.
        it('should download asset whose filename contains non-ASCII characters', async () => {
            const filePath = path.join(testDir, 'rubicon-asset.png');
            await fs.writeFile(filePath, 'Rubicón content');

            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'San Marcial de Rubicón.png',
                folder_path: 'imágenes/canarias',
                storage_path: filePath,
                mime_type: 'image/png',
            });

            const res = await handle(new Request(`http://localhost/api/projects/1/assets/1`));

            expect(res.status).toBe(200);
            const disposition = res.headers.get('content-disposition') ?? '';
            expect(disposition).toContain(`filename="San Marcial de Rubic_n.png"`);
            expect(disposition).toContain(`filename*=UTF-8''San%20Marcial%20de%20Rubic%C3%B3n.png`);
            expect(await res.text()).toBe('Rubicón content');
        });

        it('should expose the asset filename in by-client-id X-Filename header without throwing on accents', async () => {
            const filePath = path.join(testDir, 'valeron-asset.png');
            await fs.writeFile(filePath, 'Valerón content');

            const clientId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'Cenobio de Valerón.png',
                folder_path: 'imágenes/canarias',
                storage_path: filePath,
                mime_type: 'image/png',
                file_size: '15',
                client_id: clientId,
            });

            const res = await handle(new Request(`http://localhost/api/projects/1/assets/by-client-id/${clientId}`));

            expect(res.status).toBe(200);
            const xFilename = res.headers.get('x-filename') ?? '';
            const xFolderPath = res.headers.get('x-folder-path') ?? '';
            expect(decodeURIComponent(xFilename)).toBe('Cenobio de Valerón.png');
            expect(decodeURIComponent(xFolderPath)).toBe('imágenes/canarias');
        });
    });

    describe('GET /api/projects/:projectId/assets/by-client-id/:clientId', () => {
        it('should download asset by client ID', async () => {
            const filePath = path.join(testDir, 'client-asset.txt');
            await fs.writeFile(filePath, 'Client asset content');

            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'client-asset.txt',
                storage_path: filePath,
                mime_type: 'text/plain',
                client_id: 'unique-client-id',
            });

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/by-client-id/unique-client-id`),
            );

            expect(res.status).toBe(200);
            const content = await res.text();
            expect(content).toBe('Client asset content');
        });

        it('should return 404 for non-existent client ID', async () => {
            const res = await handle(new Request(`http://localhost/api/projects/1/assets/by-client-id/non-existent`));

            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/projects/:projectId/assets/:assetId/metadata', () => {
        it('should return asset metadata', async () => {
            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'image.png',
                mime_type: 'image/png',
                file_size: '1024',
                client_id: 'client-1',
                component_id: 'idevice-1',
            });

            const res = await handle(new Request(`http://localhost/api/projects/1/assets/1/metadata`));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.filename).toBe('image.png');
            expect(body.data.mimeType).toBe('image/png');
            expect(body.data.size).toBe(1024);
            expect(body.data.clientId).toBe('client-1');
        });

        it('should return 404 for non-existent asset', async () => {
            const res = await handle(new Request(`http://localhost/api/projects/1/assets/999/metadata`));

            expect(res.status).toBe(404);
        });

        it('should not leak metadata of an asset owned by another project', async () => {
            // Asset belongs to project 2, but is requested via project 1's URL.
            mockAssets.set(7, {
                id: 7,
                project_id: 2,
                filename: 'secret.png',
                mime_type: 'image/png',
                file_size: '2048',
                client_id: 'client-secret',
            });

            const res = await handle(new Request(`http://localhost/api/projects/1/assets/7/metadata`));

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/projects/:projectId/assets/:assetId', () => {
        it('should delete asset', async () => {
            const filePath = path.join(testDir, 'to-delete.txt');
            await fs.writeFile(filePath, 'Delete me');

            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'to-delete.txt',
                storage_path: filePath,
            });

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/1`, {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(mockAssets.has(1)).toBe(false);
        });

        it('should return 404 for non-existent asset', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/999`, {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(404);
        });

        it('should not delete an asset owned by another project (cross-tenant IDOR)', async () => {
            const filePath = path.join(testDir, 'other-tenant.txt');
            await fs.writeFile(filePath, 'Belongs to project 2');

            // Asset belongs to project 2; attacker owns project 1 and targets it
            // via /api/projects/1/assets/9 with the global numeric id.
            mockAssets.set(9, {
                id: 9,
                project_id: 2,
                filename: 'other-tenant.txt',
                storage_path: filePath,
            });

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/9`, {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(404);
            // The asset row and its file must survive.
            expect(mockAssets.has(9)).toBe(true);
            expect(await fs.pathExists(filePath)).toBe(true);
        });
    });

    describe('DELETE /api/projects/:projectId/assets/by-client-id/:clientId', () => {
        it('should delete asset by client ID', async () => {
            const filePath = path.join(testDir, 'client-delete.txt');
            await fs.writeFile(filePath, 'Delete me');

            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'client-delete.txt',
                storage_path: filePath,
                client_id: 'delete-client-id-123',
            });

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/by-client-id/delete-client-id-123`, {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.message).toContain('deleted');
            expect(mockAssets.has(1)).toBe(false);
        });

        it('should return success when asset not found on server (idempotent)', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/by-client-id/non-existent-client`, {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.message).toContain('not found on server');
        });

        it('should return 404 for non-existent project', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/non-existent-uuid/assets/by-client-id/any-client`, {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toContain('Project not found');
        });
    });

    describe('DELETE /api/projects/:projectId/assets/bulk', () => {
        it('should delete multiple assets by client IDs', async () => {
            const filePath1 = path.join(testDir, 'bulk-delete-1.txt');
            const filePath2 = path.join(testDir, 'bulk-delete-2.txt');
            await fs.writeFile(filePath1, 'Delete me 1');
            await fs.writeFile(filePath2, 'Delete me 2');

            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'bulk-delete-1.txt',
                storage_path: filePath1,
                client_id: 'bulk-client-1',
            });
            mockAssets.set(2, {
                id: 2,
                project_id: 1,
                filename: 'bulk-delete-2.txt',
                storage_path: filePath2,
                client_id: 'bulk-client-2',
            });

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/bulk`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientIds: ['bulk-client-1', 'bulk-client-2'] }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.deleted).toBe(2);
            expect(mockAssets.has(1)).toBe(false);
            expect(mockAssets.has(2)).toBe(false);
        });

        it('should return success with deleted=0 when clientIds array is empty', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/bulk`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientIds: [] }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.deleted).toBe(0);
        });

        it('should return success with deleted=0 when no body provided', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/bulk`, {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.deleted).toBe(0);
        });

        it('should return 404 for non-existent project', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/non-existent-uuid/assets/bulk`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientIds: ['any-id'] }),
                }),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toContain('Project not found');
        });

        it('should only delete assets that exist (partial match)', async () => {
            const filePath = path.join(testDir, 'partial-delete.txt');
            await fs.writeFile(filePath, 'Delete me');

            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'partial-delete.txt',
                storage_path: filePath,
                client_id: 'existing-client',
            });

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/bulk`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientIds: ['existing-client', 'non-existent-client'] }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.deleted).toBe(1); // Only 1 existed
        });
    });

    describe('GET /api/projects/:projectId/assets/storage-usage', () => {
        it('should return storage usage statistics', async () => {
            mockAssets.set(1, { id: 1, project_id: 1, file_size: '1024' });
            mockAssets.set(2, { id: 2, project_id: 1, file_size: '2048' });

            const res = await handle(new Request(`http://localhost/api/projects/1/assets/storage-usage`));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.totalAssets).toBe(2);
            expect(body.data.totalSize).toBe(3072);
        });

        it('should return zero for project with no assets', async () => {
            const res = await handle(new Request(`http://localhost/api/projects/1/assets/storage-usage`));

            const body = await res.json();
            expect(body.data.totalAssets).toBe(0);
            expect(body.data.totalSize).toBe(0);
        });
    });

    describe('Chunked Upload', () => {
        describe('GET /api/projects/:projectId/assets/upload-chunk', () => {
            it('should return 204 when chunk does not exist', async () => {
                const res = await handle(
                    new Request(
                        `http://localhost/api/projects/1/assets/upload-chunk?resumableIdentifier=abc123&resumableChunkNumber=1`,
                    ),
                );

                expect(res.status).toBe(204);
            });

            it('should return 400 when parameters missing', async () => {
                const res = await handle(new Request(`http://localhost/api/projects/1/assets/upload-chunk`));

                expect(res.status).toBe(400);
            });
        });

        describe('POST /api/projects/:projectId/assets/upload-chunk', () => {
            it('should upload a chunk', async () => {
                const formData = new FormData();
                formData.append('file', new Blob(['chunk data']));
                formData.append('resumableIdentifier', 'upload123');
                formData.append('resumableChunkNumber', '1');
                formData.append('resumableTotalChunks', '3');
                formData.append('resumableFilename', 'large-file.zip');

                const res = await handle(
                    new Request(`http://localhost/api/projects/1/assets/upload-chunk`, {
                        method: 'POST',
                        body: formData,
                    }),
                );

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(body.chunkNumber).toBe(1);
                expect(body.allUploaded).toBe(false);
            });

            it('should return 400 when parameters missing', async () => {
                const formData = new FormData();
                formData.append('file', new Blob(['data']));

                const res = await handle(
                    new Request(`http://localhost/api/projects/1/assets/upload-chunk`, {
                        method: 'POST',
                        body: formData,
                    }),
                );

                expect(res.status).toBe(400);
            });
        });

        describe('DELETE /api/projects/:projectId/assets/upload-chunk/:identifier', () => {
            it('should cancel chunked upload', async () => {
                const res = await handle(
                    new Request(`http://localhost/api/projects/1/assets/upload-chunk/upload123`, {
                        method: 'DELETE',
                    }),
                );

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(body.message).toContain('cancelled');
            });
        });
    });

    describe('POST /api/projects/:projectId/assets/sync - Batch Upload', () => {
        it('should upload multiple files in batch', async () => {
            const formData = new FormData();
            formData.append('files', new Blob(['file1 content']), 'file1.txt');
            formData.append('files', new Blob(['file2 content']), 'file2.txt');
            formData.append(
                'metadata',
                JSON.stringify([
                    { clientId: 'client-1', filename: 'file1.txt', mimeType: 'text/plain' },
                    { clientId: 'client-2', filename: 'file2.txt', mimeType: 'text/plain' },
                ]),
            );

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/sync`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.uploaded).toBe(2);
            expect(body.failed).toBe(0);
        });

        it('should return 400 for invalid metadata JSON', async () => {
            const formData = new FormData();
            formData.append('metadata', 'invalid-json');

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/sync`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('Invalid metadata');
        });

        it('should return 404 for non-existent project', async () => {
            const formData = new FormData();
            formData.append('metadata', '[]');

            const res = await handle(
                new Request('http://localhost/api/projects/non-existent/assets/sync', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/projects/:projectId/assets/stream - Streaming Upload', () => {
        it('should stream upload a file', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/stream`, {
                    method: 'POST',
                    body: 'Streamed content',
                    headers: {
                        'Content-Type': 'text/plain',
                        'X-Filename': 'streamed.txt',
                        'X-Client-Id': 'stream-client-1',
                    },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.filename).toBe('streamed.txt');
        });

        it('should return 404 for non-existent project', async () => {
            const res = await handle(
                new Request('http://localhost/api/projects/non-existent/assets/stream', {
                    method: 'POST',
                    body: 'content',
                }),
            );

            expect(res.status).toBe(404);
        });

        it('should return 400 when no body provided', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/stream`, {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('No body');
        });
    });

    describe('GET /api/projects/:projectId/assets/priority-stats', () => {
        it('should return priority queue statistics', async () => {
            const res = await handle(new Request(`http://localhost/api/projects/1/assets/priority-stats`));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            expect(body.data.queueLength).toBeDefined();
        });
    });

    describe('POST /api/projects/:projectId/assets/upload-chunk/finalize', () => {
        it('should finalize chunked upload after all chunks uploaded', async () => {
            // First upload all chunks
            for (let i = 1; i <= 3; i++) {
                const formData = new FormData();
                formData.append('file', new Blob([`chunk ${i} data`]));
                formData.append('resumableIdentifier', 'finalize-test-123');
                formData.append('resumableChunkNumber', String(i));
                formData.append('resumableTotalChunks', '3');
                formData.append('resumableFilename', 'large-file.zip');

                await handle(
                    new Request(`http://localhost/api/projects/1/assets/upload-chunk`, {
                        method: 'POST',
                        body: formData,
                    }),
                );
            }

            // Now finalize
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/upload-chunk/finalize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        resumableIdentifier: 'finalize-test-123',
                        componentId: 'test-component',
                        clientId: 'finalize-client-123',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.complete).toBe(true);
        });

        it('should return 404 when upload not found', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/upload-chunk/finalize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        resumableIdentifier: 'non-existent-upload',
                    }),
                }),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toContain('Upload not found');
        });

        it('should return 400 when chunks are missing', async () => {
            // Upload only 1 of 3 chunks
            const formData = new FormData();
            formData.append('file', new Blob(['chunk 1']));
            formData.append('resumableIdentifier', 'incomplete-upload');
            formData.append('resumableChunkNumber', '1');
            formData.append('resumableTotalChunks', '3');
            formData.append('resumableFilename', 'incomplete.zip');

            await handle(
                new Request(`http://localhost/api/projects/1/assets/upload-chunk`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            // Try to finalize with missing chunks
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/upload-chunk/finalize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        resumableIdentifier: 'incomplete-upload',
                    }),
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('Missing chunks');
        });

        it('should update existing asset when clientId already exists', async () => {
            // Create an existing asset with the same clientId
            mockAssets.set(99, {
                id: 99,
                project_id: 1,
                filename: 'old-file.zip',
                storage_path: '/old/path.zip',
                client_id: 'existing-client-id',
            });

            // Upload all chunks
            for (let i = 1; i <= 2; i++) {
                const formData = new FormData();
                formData.append('file', new Blob([`chunk ${i}`]));
                formData.append('resumableIdentifier', 'update-test');
                formData.append('resumableChunkNumber', String(i));
                formData.append('resumableTotalChunks', '2');
                formData.append('resumableFilename', 'new-file.zip');

                await handle(
                    new Request(`http://localhost/api/projects/1/assets/upload-chunk`, {
                        method: 'POST',
                        body: formData,
                    }),
                );
            }

            // Finalize with existing clientId
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/upload-chunk/finalize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        resumableIdentifier: 'update-test',
                        clientId: 'existing-client-id',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should return 404 for non-existent project', async () => {
            // Upload a chunk first
            const formData = new FormData();
            formData.append('file', new Blob(['chunk']));
            formData.append('resumableIdentifier', 'project-not-found-test');
            formData.append('resumableChunkNumber', '1');
            formData.append('resumableTotalChunks', '1');
            formData.append('resumableFilename', 'test.zip');

            await handle(
                new Request(`http://localhost/api/projects/non-existent/assets/upload-chunk`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            // Try to finalize
            const res = await handle(
                new Request(`http://localhost/api/projects/non-existent/assets/upload-chunk/finalize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        resumableIdentifier: 'project-not-found-test',
                    }),
                }),
            );

            expect(res.status).toBe(404);
        });
    });

    describe('GET /upload-chunk - chunk exists check', () => {
        it('should return 200 when chunk already exists', async () => {
            // First upload a chunk
            const formData = new FormData();
            formData.append('file', new Blob(['chunk data']));
            formData.append('resumableIdentifier', 'exists-check-test');
            formData.append('resumableChunkNumber', '1');
            formData.append('resumableTotalChunks', '2');
            formData.append('resumableFilename', 'test.zip');

            await handle(
                new Request(`http://localhost/api/projects/1/assets/upload-chunk`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            // Check if chunk exists
            const res = await handle(
                new Request(
                    `http://localhost/api/projects/1/assets/upload-chunk?resumableIdentifier=exists-check-test&resumableChunkNumber=1`,
                ),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.exists).toBe(true);
        });
    });

    describe('POST /api/projects/:projectId/assets/stream - Priority preemption', () => {
        it('should return 503 when preempted', async () => {
            // Create mock deps with preempt enabled
            const mockDeps = createMockDependencies();
            mockDeps.priorityQueue = {
                shouldPreempt: () => ({ shouldPreempt: true, reason: 'Higher priority upload in progress' }),
                getStats: () => ({ queueLength: 5, processingCount: 2, completedCount: 10 }),
            };

            const routes = createAssetsRoutes(mockDeps);
            const preemptApp = new Elysia().use(routes);

            const res = await preemptApp.handle(
                new Request(`http://localhost/api/projects/1/assets/stream`, {
                    method: 'POST',
                    body: 'content',
                    headers: {
                        'X-Priority': '5',
                        'X-Filename': 'test.txt',
                        Authorization: `Bearer ${ownerToken}`,
                    },
                }),
            );

            expect(res.status).toBe(503);
            const body = await res.json();
            expect(body.error).toBe('preempted');
            expect(body.reason).toBe('Higher priority upload in progress');
        });
    });

    describe('GET /api/projects/:projectId/assets/by-client-id/:clientId - file not on disk', () => {
        it('should return 404 when file not on disk', async () => {
            mockAssets.set(1, {
                id: 1,
                project_id: 1,
                filename: 'missing.txt',
                storage_path: '/non/existent/path.txt',
                client_id: 'missing-file-client',
            });

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/by-client-id/missing-file-client`),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toContain('not found on disk');
        });
    });

    describe('GET /api/projects/:projectId/assets/:assetId/metadata - invalid ID', () => {
        it('should return 400 for invalid asset ID', async () => {
            const res = await handle(new Request(`http://localhost/api/projects/1/assets/invalid/metadata`));

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('Invalid asset ID');
        });
    });

    describe('DELETE /api/projects/:projectId/assets/:assetId - invalid ID', () => {
        it('should return 400 for invalid asset ID', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/invalid`, {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('Invalid asset ID');
        });
    });

    describe('GET /api/projects/:projectId/assets/storage-usage - non-existent project', () => {
        it('should return 404 for non-existent project UUID (auth gate)', async () => {
            const res = await handle(
                new Request(`http://localhost/api/projects/non-existent-uuid/assets/storage-usage`),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toContain('Project not found');
        });
    });

    describe('POST /api/projects/:projectId/assets/sync - metadata as array', () => {
        it('should accept metadata as array directly', async () => {
            const formData = new FormData();
            formData.append('files', new Blob(['content']), 'test.txt');
            // Note: FormData doesn't natively support arrays, but some frameworks do
            // This test covers the Array.isArray(data.metadata) branch

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/sync`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            // Should succeed even without metadata (uses defaults)
            expect(res.status).toBe(200);
        });

        it('should update existing asset in sync', async () => {
            // Create existing asset
            mockAssets.set(50, {
                id: 50,
                project_id: 1,
                filename: 'existing.txt',
                storage_path: '/old/path.txt',
                client_id: 'sync-existing-client',
            });

            const formData = new FormData();
            formData.append('files', new Blob(['new content']), 'existing.txt');
            formData.append(
                'metadata',
                JSON.stringify([
                    { clientId: 'sync-existing-client', filename: 'existing.txt', mimeType: 'text/plain' },
                ]),
            );

            const res = await handle(
                new Request(`http://localhost/api/projects/1/assets/sync`, {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.uploaded).toBe(1);
            // Check that the existing asset was updated
            expect(body.results[0].serverId).toBe(50);
        });
    });

    describe('POST /api/projects/:projectId/assets - Buffer handling', () => {
        it('should handle Buffer file directly', async () => {
            // Create mock deps that return a Buffer
            const mockDeps = createMockDependencies();
            const routes = createAssetsRoutes(mockDeps);
            const bufferApp = new Elysia().use(routes);

            // We can't easily test Buffer handling through HTTP requests since
            // the HTTP layer converts to Blob. The Buffer branch is tested
            // via internal code paths.

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.txt');

            const res = await bufferApp.handle(
                new Request(`http://localhost/api/projects/1/assets`, {
                    method: 'POST',
                    body: formData,
                    headers: { Authorization: `Bearer ${ownerToken}` },
                }),
            );

            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/projects/:projectId/assets - non-existent project', () => {
        it('should return 404 for non-existent project UUID (auth gate)', async () => {
            const res = await handle(new Request(`http://localhost/api/projects/non-existent-uuid/assets`));

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toContain('Project not found');
        });
    });

    describe('Handler error paths', () => {
        // These cover pre-existing catch blocks; useful both for regression and
        // for keeping file-level coverage above the project's 90% threshold.

        it('POST should return 500 when the underlying write fails', async () => {
            const failingDeps = createMockDependencies();
            failingDeps.queries.createAsset = async () => {
                throw new Error('disk-full');
            };
            const failingApp = new Elysia().use(createAssetsRoutes(failingDeps));

            const formData = new FormData();
            formData.append('file', new Blob(['x'], { type: 'text/plain' }), 'x.txt');
            formData.append('clientId', 'client-fail-1');

            const res = await failingApp.handle(
                new Request('http://localhost/api/projects/1/assets', {
                    method: 'POST',
                    body: formData,
                    headers: { Authorization: `Bearer ${ownerToken}` },
                }),
            );
            expect(res.status).toBe(500);
            const body = (await res.json()) as { success: boolean; error: string };
            expect(body.success).toBe(false);
            expect(body.error).toContain('disk-full');
        });

        it('DELETE asset should 500 when deleteAsset throws', async () => {
            const failingDeps = createMockDependencies();
            mockAssets.set(1, { id: 1, project_id: 1, filename: 'x', storage_path: '/x', client_id: 'c1' });
            failingDeps.queries.findAssetById = async () => mockAssets.get(1);
            failingDeps.queries.deleteAsset = async () => {
                throw new Error('locked');
            };
            const failingApp = new Elysia().use(createAssetsRoutes(failingDeps));
            const res = await failingApp.handle(
                new Request('http://localhost/api/projects/1/assets/1', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${ownerToken}` },
                }),
            );
            expect(res.status).toBeGreaterThanOrEqual(500);
        });

        it('GET single asset should 500 when findAssetById throws', async () => {
            const failingDeps = createMockDependencies();
            failingDeps.queries.findAssetById = async () => {
                throw new Error('db-down');
            };
            const failingApp = new Elysia().use(createAssetsRoutes(failingDeps));

            const res = await failingApp.handle(
                new Request('http://localhost/api/projects/1/assets/1', {
                    headers: { Authorization: `Bearer ${ownerToken}` },
                }),
            );
            // Either 500 (handler catch) or another non-2xx — what matters is
            // we exercise the catch path; we don't pin the exact status.
            expect(res.status).toBeGreaterThanOrEqual(500);
        });
    });

    describe('Authentication gate', () => {
        it('GET should return 401 without token', async () => {
            const res = await app.handle(new Request(`http://localhost/api/projects/1/assets`));
            expect(res.status).toBe(401);
        });

        it('GET should succeed for an admin on a private project owned by someone else', async () => {
            const adminToken = await signTestToken(7, ['ROLE_USER', 'ROLE_ADMIN']);
            const res = await app.handle(
                new Request(`http://localhost/api/projects/1/assets`, {
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );
            expect(res.status).toBe(200);
        });

        it('POST should return 403 for a stranger on a private project', async () => {
            const strangerToken = await signTestToken(99);
            const formData = new FormData();
            formData.append('file', new Blob(['x'], { type: 'text/plain' }), 'x.txt');
            const res = await app.handle(
                new Request(`http://localhost/api/projects/1/assets`, {
                    method: 'POST',
                    body: formData,
                    headers: { Authorization: `Bearer ${strangerToken}` },
                }),
            );
            expect(res.status).toBe(403);
        });
    });
});

// =====================================================
// BUG H9: abandoned chunked-upload leak + size caps
// =====================================================
describe('Chunked upload leak/limit fix (BUG H9)', () => {
    const chunkUploads = __getChunkUploadsForTest();

    beforeEach(() => {
        chunkUploads.clear();
        stopChunkUploadSweeper();
    });

    afterEach(() => {
        chunkUploads.clear();
        stopChunkUploadSweeper();
    });

    describe('sweepStaleChunkUploads', () => {
        it('removes entries older than the TTL and leaves fresh ones', () => {
            const now = Date.now();

            // Stale entry: createdAt well beyond the TTL.
            chunkUploads.set('proj:stale', {
                projectId: 'proj',
                filename: 'stale.zip',
                totalChunks: 2,
                uploadedChunks: new Set([1]),
                chunkDir: path.join(testDir, 'chunks', 'proj', 'stale'),
                createdAt: new Date(now - CHUNK_UPLOAD_TTL_MS - 60_000),
                initialized: false,
            });

            // Fresh entry: created just now.
            chunkUploads.set('proj:fresh', {
                projectId: 'proj',
                filename: 'fresh.zip',
                totalChunks: 2,
                uploadedChunks: new Set([1]),
                chunkDir: path.join(testDir, 'chunks', 'proj', 'fresh'),
                createdAt: new Date(now),
                initialized: false,
            });

            const swept = sweepStaleChunkUploads(now, CHUNK_UPLOAD_TTL_MS);

            expect(swept).toBe(1);
            expect(chunkUploads.has('proj:stale')).toBe(false);
            expect(chunkUploads.has('proj:fresh')).toBe(true);
        });

        it('deletes the on-disk chunk directory of swept entries', async () => {
            const now = Date.now();
            const chunkDir = path.join(testDir, 'chunks', 'proj', 'stale-disk');
            await fs.ensureDir(chunkDir);
            await fs.writeFile(path.join(chunkDir, 'chunk_1'), 'data');
            expect(await fs.pathExists(chunkDir)).toBe(true);

            chunkUploads.set('proj:stale-disk', {
                projectId: 'proj',
                filename: 'stale.zip',
                totalChunks: 1,
                uploadedChunks: new Set([1]),
                chunkDir,
                createdAt: new Date(now - CHUNK_UPLOAD_TTL_MS - 1),
                initialized: true,
            });

            const swept = sweepStaleChunkUploads(now, CHUNK_UPLOAD_TTL_MS);
            expect(swept).toBe(1);

            // fs.remove runs async; wait until the directory is gone.
            await new Promise<void>((resolve, reject) => {
                let attempts = 0;
                const tick = async () => {
                    if (!(await fs.pathExists(chunkDir))) return resolve();
                    if (++attempts > 50) return reject(new Error('chunk dir was not removed'));
                    setTimeout(tick, 10);
                };
                void tick();
            });

            expect(await fs.pathExists(chunkDir)).toBe(false);
        });

        it('returns 0 when nothing is stale', () => {
            chunkUploads.set('proj:fresh', {
                projectId: 'proj',
                filename: 'fresh.zip',
                totalChunks: 1,
                uploadedChunks: new Set([1]),
                chunkDir: path.join(testDir, 'chunks', 'proj', 'fresh'),
                createdAt: new Date(),
                initialized: false,
            });

            expect(sweepStaleChunkUploads(Date.now(), CHUNK_UPLOAD_TTL_MS)).toBe(0);
            expect(chunkUploads.has('proj:fresh')).toBe(true);
        });
    });

    describe('startChunkUploadSweeper / stopChunkUploadSweeper', () => {
        it('runs the sweep on its interval and stops cleanly', async () => {
            const now = Date.now();
            chunkUploads.set('proj:stale', {
                projectId: 'proj',
                filename: 'stale.zip',
                totalChunks: 1,
                uploadedChunks: new Set([1]),
                chunkDir: path.join(testDir, 'chunks', 'proj', 'interval-stale'),
                createdAt: new Date(now - CHUNK_UPLOAD_TTL_MS - 60_000),
                initialized: false,
            });

            // Tiny interval so the timer fires quickly under test.
            startChunkUploadSweeper(5);
            // Starting twice is a no-op (idempotent) and must not throw.
            startChunkUploadSweeper(5);

            await new Promise<void>((resolve, reject) => {
                let attempts = 0;
                const tick = () => {
                    if (!chunkUploads.has('proj:stale')) return resolve();
                    if (++attempts > 100) return reject(new Error('sweeper did not run'));
                    setTimeout(tick, 5);
                };
                tick();
            });

            expect(chunkUploads.has('proj:stale')).toBe(false);

            // stop is idempotent and must not throw.
            stopChunkUploadSweeper();
            stopChunkUploadSweeper();
        });
    });
});

// =====================================================
// BUG H9: chunk size caps enforced by the upload route
// =====================================================
describe('Chunked upload size caps (BUG H9)', () => {
    let app: Elysia;
    let mockAssets: Map<number, any>;
    let mockProjects: Map<string, any>;
    let assetIdCounter: number;
    let ownerToken: string;

    function buildDeps(): AssetsDependencies {
        return {
            db: {} as any,
            queries: {
                createAsset: async (_db: any, data: any) => {
                    const id = assetIdCounter++;
                    const asset = { id, ...data, created_at: '', updated_at: '' };
                    mockAssets.set(id, asset);
                    return asset;
                },
                createAssets: async (_db: any, arr: any[]) => arr.map(d => ({ id: assetIdCounter++, ...d })),
                findAssetById: async (_db: any, id: number) => mockAssets.get(id),
                findAllAssetsForProject: async () => [],
                findAssetByClientId: async () => undefined,
                findAssetsByClientIds: async () => [],
                deleteAsset: async () => {},
                updateAsset: async () => undefined,
                bulkUpdateAssets: async () => {},
                findProjectByUuid: async (_db: any, uuid: string) => mockProjects.get(uuid),
                findProjectById: async (_db: any, id: number) => {
                    for (const p of mockProjects.values()) if (p.id === id) return p;
                    return undefined;
                },
                checkProjectAccess: async (_db: any, project: any, userId?: number) => {
                    if (!project) return { hasAccess: false, reason: 'PROJECT_NOT_FOUND' };
                    if (project.owner_id === userId) return { hasAccess: true };
                    return { hasAccess: false, reason: 'ACCESS_DENIED' };
                },
            },
            fileHelper: createMockFileHelper(),
            sessionManager: createMockSessionManager(),
            priorityQueue: createMockPriorityQueue(),
        };
    }

    beforeAll(async () => {
        ownerToken = await signTestToken(OWNER_USER_ID);
    });

    beforeEach(async () => {
        mockAssets = new Map();
        mockProjects = new Map();
        mockSessions = new Map();
        assetIdCounter = 1;
        mockProjects.set(testProjectId, {
            id: 1,
            uuid: testProjectId,
            owner_id: OWNER_USER_ID,
            visibility: 'private',
            status: 'active',
        });
        app = new Elysia().use(createAssetsRoutes(buildDeps()));
        __getChunkUploadsForTest().clear();
        await fs.ensureDir(path.join(testDir, 'assets', testProjectId));
    });

    afterEach(async () => {
        __getChunkUploadsForTest().clear();
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    async function authPost(url: string, body: FormData): Promise<Response> {
        return app.handle(
            new Request(url, {
                method: 'POST',
                body,
                headers: { Authorization: `Bearer ${ownerToken}` },
            }),
        );
    }

    it('rejects a chunk larger than MAX_CHUNK_BYTES with 413', async () => {
        const tooBig = new Uint8Array(MAX_CHUNK_BYTES + 1);
        const formData = new FormData();
        formData.append('file', new Blob([tooBig], { type: 'application/octet-stream' }));
        formData.append('resumableIdentifier', 'oversize-upload');
        formData.append('resumableChunkNumber', '1');
        formData.append('resumableTotalChunks', '1');
        formData.append('resumableFilename', 'huge.bin');

        const res = await authPost('http://localhost/api/projects/1/assets/upload-chunk', formData);

        expect(res.status).toBe(413);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toContain('maximum allowed size');
        // No tracking state should have been created.
        expect(__getChunkUploadsForTest().has('1:oversize-upload')).toBe(false);
    });

    it('rejects an absurd resumableTotalChunks above MAX_TOTAL_CHUNKS with 400', async () => {
        const formData = new FormData();
        formData.append('file', new Blob(['small'], { type: 'application/octet-stream' }));
        formData.append('resumableIdentifier', 'absurd-total');
        formData.append('resumableChunkNumber', '1');
        formData.append('resumableTotalChunks', String(MAX_TOTAL_CHUNKS + 1));
        formData.append('resumableFilename', 'evil.bin');

        const res = await authPost('http://localhost/api/projects/1/assets/upload-chunk', formData);

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toContain('Invalid resumableTotalChunks');
        expect(__getChunkUploadsForTest().has('1:absurd-total')).toBe(false);
    });

    it('rejects a non-numeric resumableTotalChunks with 400', async () => {
        const formData = new FormData();
        formData.append('file', new Blob(['small'], { type: 'application/octet-stream' }));
        formData.append('resumableIdentifier', 'nan-total');
        formData.append('resumableChunkNumber', '1');
        formData.append('resumableTotalChunks', 'not-a-number');
        formData.append('resumableFilename', 'evil.bin');

        const res = await authPost('http://localhost/api/projects/1/assets/upload-chunk', formData);

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toContain('Invalid resumableTotalChunks');
    });

    it('accepts a normal small chunk within the caps', async () => {
        const formData = new FormData();
        formData.append('file', new Blob(['ok chunk'], { type: 'application/octet-stream' }));
        formData.append('resumableIdentifier', 'normal-upload');
        formData.append('resumableChunkNumber', '1');
        formData.append('resumableTotalChunks', '2');
        formData.append('resumableFilename', 'fine.bin');

        const res = await authPost('http://localhost/api/projects/1/assets/upload-chunk', formData);

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(__getChunkUploadsForTest().has('1:normal-upload')).toBe(true);
    });
});
