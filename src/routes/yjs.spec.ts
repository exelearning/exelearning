/**
 * Tests for Yjs Document Routes
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';
import * as Y from 'yjs';
import { createYjsRoutes, type YjsDependencies } from './yjs';

// A real Yjs update used to exercise the snapshot+updates reconstruction path
// (a project whose server-side state lives only in yjs_updates, e.g. edited via
// the REST API v1). Building it here keeps the mock query deterministic.
function buildUpdatesOnlyRows(): Array<{ update_data: Uint8Array; version: string }> {
    const doc = new Y.Doc();
    doc.getMap('metadata').set('title', 'From updates only');
    const update = Y.encodeStateAsUpdate(doc);
    doc.destroy();
    return [{ update_data: update, version: Date.now().toString() }];
}
const updatesOnlyRows = buildUpdatesOnlyRows();

// Use the same fallback secret that getJwtSecret() returns when no env var is
// set. We intentionally do NOT mutate process.env here — tests run in the same
// process and clobbering API_JWT_SECRET would race with other suites.
const TEST_SECRET = 'dev_secret_change_me';

// Mock project data
const mockProject = {
    id: 1,
    uuid: 'test-uuid-123',
    title: 'Test Project',
    owner_id: 42,
    visibility: 'private',
    status: 'active',
    created_at: new Date().toISOString(),
};

const mockSnapshot = {
    id: 1,
    project_id: 1,
    snapshot_data: new Uint8Array([1, 2, 3, 4, 5]),
    version: '1234567890',
};

async function signToken(sub: number, roles: string[] = ['ROLE_USER']): Promise<string> {
    const secret = new TextEncoder().encode(TEST_SECRET);
    return new SignJWT({ sub, email: `u${sub}@test.local`, roles })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

function authHeaders(token: string): Record<string, string> {
    return {
        'Content-Type': 'application/octet-stream',
        Authorization: `Bearer ${token}`,
    };
}

describe('Yjs Document Routes', () => {
    let app: Elysia;
    let savedSnapshots: Map<number, any>;
    let projectSavedFlag: boolean;
    let ownerToken: string;
    let strangerToken: string;
    let adminToken: string;

    beforeAll(async () => {
        ownerToken = await signToken(42, ['ROLE_USER']);
        strangerToken = await signToken(99, ['ROLE_USER']);
        adminToken = await signToken(7, ['ROLE_USER', 'ROLE_ADMIN']);
    });

    // Create mock dependencies for each test
    function createMockDependencies(): YjsDependencies {
        return {
            db: {} as any,
            queries: {
                findProjectByUuid: async (_db: any, uuid: string) => {
                    if (uuid === 'test-uuid-123') {
                        return mockProject as any;
                    }
                    if (uuid === 'no-snapshot-uuid') {
                        return { ...mockProject, uuid: 'no-snapshot-uuid', id: 2 } as any;
                    }
                    if (uuid === 'updates-only-uuid') {
                        return { ...mockProject, uuid: 'updates-only-uuid', id: 3 } as any;
                    }
                    return undefined;
                },
                findSnapshotByProjectId: async (_db: any, projectId: number) => {
                    if (savedSnapshots.has(projectId)) {
                        return savedSnapshots.get(projectId);
                    }
                    if (projectId === 1) {
                        return mockSnapshot;
                    }
                    return undefined;
                },
                loadDocumentWithUpdates: async (_db: any, projectId: number) => {
                    // Mirror the snapshot mock; project 3 has updates but no snapshot.
                    const snapshot = savedSnapshots.has(projectId)
                        ? savedSnapshots.get(projectId)
                        : projectId === 1
                          ? mockSnapshot
                          : undefined;
                    const updates = projectId === 3 ? updatesOnlyRows : [];
                    return { snapshot, updates } as any;
                },
                upsertSnapshot: async (_db: any, projectId: number, data: Uint8Array, version: string) => {
                    savedSnapshots.set(projectId, {
                        id: savedSnapshots.size + 1,
                        project_id: projectId,
                        snapshot_data: data,
                        version,
                    });
                },
                updateProjectTitle: async (_db: any, _projectId: number, _title: string) => {
                    // Just update title, don't mark as saved
                },
                updateProjectTitleAndSave: async (_db: any, _projectId: number, _title: string) => {
                    projectSavedFlag = true;
                },
                checkProjectAccess: async (_db: any, project: any, userId?: number) => {
                    if (!project) return { hasAccess: false, reason: 'PROJECT_NOT_FOUND' };
                    if (project.visibility === 'public') return { hasAccess: true };
                    if (!userId) return { hasAccess: false, reason: 'AUTHENTICATION_REQUIRED' };
                    if (project.owner_id === userId) return { hasAccess: true };
                    return { hasAccess: false, reason: 'ACCESS_DENIED' };
                },
            },
        };
    }

    beforeEach(() => {
        savedSnapshots = new Map();
        projectSavedFlag = false;
        const mockDeps = createMockDependencies();
        const routes = createYjsRoutes(mockDeps);
        app = new Elysia().use(routes);
    });

    describe('Authentication', () => {
        it('GET should return 401 without token', async () => {
            const res = await app.handle(new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document'));
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.error).toBe('Unauthorized');
        });

        it('POST should return 401 without token', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: new Uint8Array([1, 2, 3]),
                    headers: { 'Content-Type': 'application/octet-stream' },
                }),
            );
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.error).toBe('Unauthorized');
        });

        it('GET should return 403 for a stranger', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    headers: { Authorization: `Bearer ${strangerToken}` },
                }),
            );
            expect(res.status).toBe(403);
        });

        it('POST should return 403 for a stranger (no overwrite allowed)', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: new Uint8Array([9, 9, 9]),
                    headers: authHeaders(strangerToken),
                }),
            );
            expect(res.status).toBe(403);
            // Snapshot must NOT have been overwritten
            expect(savedSnapshots.has(1)).toBe(false);
        });

        it('GET should allow any authenticated user on a public project', async () => {
            const mockDeps = createMockDependencies();
            mockDeps.queries.findProjectByUuid = async () => ({ ...mockProject, visibility: 'public' }) as any;
            const testApp = new Elysia().use(createYjsRoutes(mockDeps));

            const res = await testApp.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    headers: { Authorization: `Bearer ${strangerToken}` },
                }),
            );
            expect(res.status).toBe(200);
        });

        it('POST should also allow any authenticated user on a public project (wiki semantics)', async () => {
            const mockDeps = createMockDependencies();
            mockDeps.queries.findProjectByUuid = async () => ({ ...mockProject, visibility: 'public' }) as any;
            const testApp = new Elysia().use(createYjsRoutes(mockDeps));

            const res = await testApp.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: new Uint8Array([1, 2, 3]),
                    headers: authHeaders(strangerToken),
                }),
            );
            expect(res.status).toBe(200);
        });

        it('POST should allow a collaborator', async () => {
            const mockDeps = createMockDependencies();
            mockDeps.queries.checkProjectAccess = async (_db: any, project: any, userId?: number) => {
                if (!project) return { hasAccess: false, reason: 'PROJECT_NOT_FOUND' };
                if (project.visibility === 'public') return { hasAccess: true };
                if (!userId) return { hasAccess: false, reason: 'AUTHENTICATION_REQUIRED' };
                if (project.owner_id === userId) return { hasAccess: true };
                if (userId === 99) return { hasAccess: true };
                return { hasAccess: false, reason: 'ACCESS_DENIED' };
            };
            const testApp = new Elysia().use(createYjsRoutes(mockDeps));

            const res = await testApp.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: new Uint8Array([1, 2, 3]),
                    headers: authHeaders(strangerToken),
                }),
            );
            expect(res.status).toBe(200);
        });

        it('GET should succeed for an admin', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/projects/uuid/:uuid/yjs-document', () => {
        it('should return 404 for non-existent project', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/non-existent-uuid/yjs-document', {
                    headers: { Authorization: `Bearer ${ownerToken}` },
                }),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toBe('Not Found');
            expect(body.message).toContain('Project not found');
        });

        it('should return 404 when project has no snapshot', async () => {
            // owner_id is 42, but uuid no-snapshot-uuid uses different id (2)
            // need a token whose sub matches that project's owner — both use owner_id 42
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/no-snapshot-uuid/yjs-document', {
                    headers: { Authorization: `Bearer ${ownerToken}` },
                }),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.message).toContain('No document saved');
        });

        it('should return binary snapshot data for existing project', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    headers: { Authorization: `Bearer ${ownerToken}` },
                }),
            );

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('application/octet-stream');

            const buffer = await res.arrayBuffer();
            const data = new Uint8Array(buffer);
            expect(data).toEqual(mockSnapshot.snapshot_data);
        });

        it('reconstructs a document that exists only as updates, with no snapshot (H5)', async () => {
            // Project 3 has no yjs_documents snapshot, only a yjs_updates row.
            // The old endpoint returned 404; it must now return the merged state.
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/updates-only-uuid/yjs-document', {
                    headers: { Authorization: `Bearer ${ownerToken}` },
                }),
            );

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('application/octet-stream');

            // The returned bytes must apply cleanly and contain the edit.
            const merged = new Uint8Array(await res.arrayBuffer());
            const doc = new Y.Doc();
            Y.applyUpdate(doc, merged);
            expect(doc.getMap('metadata').get('title')).toBe('From updates only');
            doc.destroy();
        });
    });

    describe('POST /api/projects/uuid/:uuid/yjs-document', () => {
        it('should return 404 for non-existent project', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/non-existent-uuid/yjs-document', {
                    method: 'POST',
                    body: new Uint8Array([1, 2, 3]),
                    headers: authHeaders(ownerToken),
                }),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.message).toContain('Project not found');
        });

        it('should save document snapshot', async () => {
            const testData = new Uint8Array([10, 20, 30, 40, 50]);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: testData,
                    headers: authHeaders(ownerToken),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.message).toBe('Document saved');
            expect(body.version).toBeDefined();
        });

        it('should NOT mark project as saved without markSaved parameter (auto-persistence)', async () => {
            const testData = new Uint8Array([1, 2, 3]);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: testData,
                    headers: authHeaders(ownerToken),
                }),
            );

            const body = await res.json();
            expect(body.markedAsSaved).toBe(false);
            expect(projectSavedFlag).toBe(false);
        });

        it('should mark project as saved with markSaved=true (explicit save)', async () => {
            const testData = new Uint8Array([1, 2, 3]);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document?markSaved=true', {
                    method: 'POST',
                    body: testData,
                    headers: authHeaders(ownerToken),
                }),
            );

            const body = await res.json();
            expect(body.markedAsSaved).toBe(true);
            expect(projectSavedFlag).toBe(true);
        });

        it('should return version timestamp', async () => {
            const beforeTime = Date.now();

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: new Uint8Array([1]),
                    headers: authHeaders(ownerToken),
                }),
            );

            const afterTime = Date.now();
            const body = await res.json();

            const version = parseInt(body.version, 10);
            expect(version).toBeGreaterThanOrEqual(beforeTime);
            expect(version).toBeLessThanOrEqual(afterTime);
        });

        it('should handle empty body', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: new Uint8Array([]),
                    headers: authHeaders(ownerToken),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should read title from X-Project-Title header', async () => {
            let savedTitle: string | undefined;
            const mockDeps = createMockDependencies();
            mockDeps.queries.updateProjectTitle = async (_db: any, _projectId: number, title: string) => {
                savedTitle = title;
            };
            const routes = createYjsRoutes(mockDeps);
            const testApp = new Elysia().use(routes);

            const testData = new Uint8Array([1, 2, 3]);
            const res = await testApp.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: testData,
                    headers: {
                        ...authHeaders(ownerToken),
                        'X-Project-Title': 'My%20Custom%20Title',
                    },
                }),
            );

            expect(res.status).toBe(200);
            expect(savedTitle).toBe('My Custom Title');
        });

        it('should decode URL-encoded special characters in title header', async () => {
            let savedTitle: string | undefined;
            const mockDeps = createMockDependencies();
            mockDeps.queries.updateProjectTitle = async (_db: any, _projectId: number, title: string) => {
                savedTitle = title;
            };
            const routes = createYjsRoutes(mockDeps);
            const testApp = new Elysia().use(routes);

            const testData = new Uint8Array([1, 2, 3]);
            const encodedTitle = encodeURIComponent('Título con ñ y émojis 🎉');
            const res = await testApp.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: testData,
                    headers: {
                        ...authHeaders(ownerToken),
                        'X-Project-Title': encodedTitle,
                    },
                }),
            );

            expect(res.status).toBe(200);
            expect(savedTitle).toBe('Título con ñ y émojis 🎉');
        });

        it('should use existing project title when header is empty', async () => {
            let savedTitle: string | undefined;
            const mockDeps = createMockDependencies();
            mockDeps.queries.updateProjectTitle = async (_db: any, _projectId: number, title: string) => {
                savedTitle = title;
            };
            const routes = createYjsRoutes(mockDeps);
            const testApp = new Elysia().use(routes);

            const testData = new Uint8Array([1, 2, 3]);
            const res = await testApp.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: testData,
                    headers: {
                        ...authHeaders(ownerToken),
                        'X-Project-Title': '',
                    },
                }),
            );

            expect(res.status).toBe(200);
            expect(savedTitle).toBe('Test Project');
        });

        it('should use existing project title when header is missing', async () => {
            let savedTitle: string | undefined;
            const mockDeps = createMockDependencies();
            mockDeps.queries.updateProjectTitle = async (_db: any, _projectId: number, title: string) => {
                savedTitle = title;
            };
            const routes = createYjsRoutes(mockDeps);
            const testApp = new Elysia().use(routes);

            const testData = new Uint8Array([1, 2, 3]);
            const res = await testApp.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: testData,
                    headers: authHeaders(ownerToken),
                }),
            );

            expect(res.status).toBe(200);
            expect(savedTitle).toBe('Test Project');
        });

        it('should trim whitespace from title', async () => {
            let savedTitle: string | undefined;
            const mockDeps = createMockDependencies();
            mockDeps.queries.updateProjectTitle = async (_db: any, _projectId: number, title: string) => {
                savedTitle = title;
            };
            const routes = createYjsRoutes(mockDeps);
            const testApp = new Elysia().use(routes);

            const testData = new Uint8Array([1, 2, 3]);
            const res = await testApp.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: testData,
                    headers: {
                        ...authHeaders(ownerToken),
                        'X-Project-Title': '%20%20Trimmed%20Title%20%20',
                    },
                }),
            );

            expect(res.status).toBe(200);
            expect(savedTitle).toBe('Trimmed Title');
        });

        it('should store snapshot data correctly', async () => {
            const testData = new Uint8Array([100, 200, 255]);

            await app.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: testData,
                    headers: authHeaders(ownerToken),
                }),
            );

            const saved = savedSnapshots.get(1);
            expect(saved).toBeDefined();
            expect(saved.project_id).toBe(1);
            expect(saved.snapshot_data).toBeInstanceOf(Uint8Array);
        });
    });
});
