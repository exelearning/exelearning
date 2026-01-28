/**
 * Tests for Yjs Document Routes
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { createYjsRoutes, type YjsDependencies } from './yjs';

// Mock project data
const mockProject = {
    id: 1,
    uuid: 'test-uuid-123',
    title: 'Test Project',
    created_at: new Date().toISOString(),
};

const mockSnapshot = {
    id: 1,
    project_id: 1,
    snapshot_data: new Uint8Array([1, 2, 3, 4, 5]),
    version: '1234567890',
};

describe('Yjs Document Routes', () => {
    let app: Elysia;
    let savedSnapshots: Map<number, any>;
    let projectSavedFlag: boolean;

    // Create mock dependencies for each test
    function createMockDependencies(): YjsDependencies {
        return {
            db: {} as any,
            queries: {
                findProjectByUuid: async (_db: any, uuid: string) => {
                    if (uuid === 'test-uuid-123') {
                        return mockProject;
                    }
                    if (uuid === 'no-snapshot-uuid') {
                        return { ...mockProject, uuid: 'no-snapshot-uuid', id: 2 };
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

    describe('GET /api/projects/uuid/:uuid/yjs-document', () => {
        it('should return 404 for non-existent project', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/non-existent-uuid/yjs-document'),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toBe('Not Found');
            expect(body.message).toContain('Project not found');
        });

        it('should return 404 when project has no snapshot', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/no-snapshot-uuid/yjs-document'),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.message).toContain('No document saved');
        });

        it('should return binary snapshot data for existing project', async () => {
            const res = await app.handle(new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document'));

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('application/octet-stream');

            const buffer = await res.arrayBuffer();
            const data = new Uint8Array(buffer);
            expect(data).toEqual(mockSnapshot.snapshot_data);
        });
    });

    describe('POST /api/projects/uuid/:uuid/yjs-document', () => {
        it('should return 404 for non-existent project', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/non-existent-uuid/yjs-document', {
                    method: 'POST',
                    body: new Uint8Array([1, 2, 3]),
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
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
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
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
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
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
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
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
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
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
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
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
                        'Content-Type': 'application/octet-stream',
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
            // Title with special characters: "Título con ñ y émojis 🎉"
            const encodedTitle = encodeURIComponent('Título con ñ y émojis 🎉');
            const res = await testApp.handle(
                new Request('http://localhost/api/projects/uuid/test-uuid-123/yjs-document', {
                    method: 'POST',
                    body: testData,
                    headers: {
                        'Content-Type': 'application/octet-stream',
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
                        'Content-Type': 'application/octet-stream',
                        'X-Project-Title': '',
                    },
                }),
            );

            expect(res.status).toBe(200);
            // Should use the existing project title from mockProject
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
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        // No X-Project-Title header
                    },
                }),
            );

            expect(res.status).toBe(200);
            // Should use the existing project title from mockProject
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
                        'Content-Type': 'application/octet-stream',
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
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
                }),
            );

            // Check the saved snapshot
            const saved = savedSnapshots.get(1);
            expect(saved).toBeDefined();
            expect(saved.project_id).toBe(1);
            expect(saved.snapshot_data).toBeInstanceOf(Uint8Array);
        });
    });
});
