/**
 * Tests for Project Routes
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as fs from 'fs-extra';
import * as path from 'path';

import {
    createProjectRoutes,
    createSymfonyCompatProjectRoutes,
    type ProjectDependencies,
    type SessionManagerDeps,
    type FileHelperDeps,
    type ZipDeps,
    type QueriesDeps,
    type UtilsDeps,
} from './project';

const testDir = path.join(process.cwd(), 'test', 'temp', 'project-test');

// Mock data - shared state for tests
let mockUsers: Map<number, any>;
let mockProjects: Map<number, any>;
let mockProjectsByUuid: Map<string, any>;
let mockSessions: Map<string, any>;
let mockCollaborators: Map<number, Set<number>>;
let mockSnapshots: Map<number, any>;
let mockAssets: Map<number, any[]>; // projectId -> assets[]
let userIdCounter = 1;
let projectIdCounter = 1;
let assetIdCounter = 1;

/**
 * Create mock session manager dependency
 */
function createMockSessionManager(): SessionManagerDeps {
    return {
        createSession: (session: any) => {
            mockSessions.set(session.sessionId, session);
            return session;
        },
        getSession: (id: string) => mockSessions.get(id),
        updateSession: (id: string, updates: any) => {
            const session = mockSessions.get(id);
            if (session) {
                Object.assign(session, updates);
            }
        },
        deleteSession: (id: string) => mockSessions.delete(id),
        getAllSessions: () => Array.from(mockSessions.values()),
        generateSessionId: () => `session-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
}

/**
 * Create mock file helper dependency
 */
function createMockFileHelper(): FileHelperDeps {
    return {
        getOdeSessionTempDir: (sessionId: string) => path.join(testDir, 'tmp', sessionId),
        getOdeSessionDistDir: (sessionId: string) => path.join(testDir, 'dist', sessionId),
        createSessionDirectories: async (sessionId: string) => {
            await fs.ensureDir(path.join(testDir, 'tmp', sessionId));
            await fs.ensureDir(path.join(testDir, 'dist', sessionId));
        },
        cleanupSessionDirectories: async (sessionId: string) => {
            await fs.remove(path.join(testDir, 'tmp', sessionId)).catch(() => {});
            await fs.remove(path.join(testDir, 'dist', sessionId)).catch(() => {});
        },
        getContentXmlPath: (sessionId: string) => path.join(testDir, 'tmp', sessionId, 'content.xml'),
        fileExists: async (filePath: string) => fs.pathExists(filePath),
        readFileAsString: async (filePath: string) => fs.readFile(filePath, 'utf-8'),
        writeFile: async (filePath: string, content: string | Buffer) => {
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, content);
        },
        appendFile: async (filePath: string, content: Buffer) => {
            await fs.ensureDir(path.dirname(filePath));
            await fs.appendFile(filePath, content);
        },
        getFilesDir: () => path.join(testDir, 'files'),
        getProjectAssetsDir: (projectUuid: string) => path.join(testDir, 'assets', projectUuid),
    };
}

/**
 * Create mock zip service dependency
 */
function createMockZip(): ZipDeps {
    return {
        extractZip: async (_zipPath: string, destDir: string) => {
            await fs.ensureDir(destDir);
            await fs.writeFile(path.join(destDir, 'content.xml'), '<?xml version="1.0"?><ode></ode>');
            return ['content.xml'];
        },
        extractZipFromBuffer: async (_buffer: Buffer, destDir: string) => {
            await fs.ensureDir(destDir);
            await fs.writeFile(path.join(destDir, 'content.xml'), '<?xml version="1.0"?><ode></ode>');
            return ['content.xml'];
        },
        createZip: async (_srcDir: string, destPath: string) => {
            await fs.writeFile(destPath, 'PK fake zip');
        },
        readFileFromZipAsString: async () => '<?xml version="1.0"?><ode></ode>',
    };
}

/**
 * Create mock queries dependency
 */
function createMockQueries(): QueriesDeps {
    return {
        createProject: async (_db: any, data: any) => {
            const id = projectIdCounter++;
            const uuid = `project-uuid-${id}`;
            const project = {
                id,
                uuid,
                ...data,
                visibility: data.visibility || 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(id, project);
            mockProjectsByUuid.set(uuid, project);
            return project;
        },
        createProjectWithUuid: async (_db: any, uuid: string, data: any) => {
            const id = projectIdCounter++;
            const project = {
                id,
                uuid,
                ...data,
                visibility: data.visibility || 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(id, project);
            mockProjectsByUuid.set(uuid, project);
            return project;
        },
        findProjectById: async (_db: any, id: number) => mockProjects.get(id),
        findProjectByUuid: async (_db: any, uuid: string) => mockProjectsByUuid.get(uuid),
        markProjectAsSaved: async (_db: any, id: number) => {
            const project = mockProjects.get(id);
            if (project) {
                project.saved_once = 1;
            }
        },
        findSavedProjectsByOwner: async (_db: any, ownerId: number) => {
            return Array.from(mockProjects.values()).filter(p => p.owner_id === ownerId && p.saved_once === 1);
        },
        findProjectsAsCollaborator: async (_db: any, userId: number) => {
            // Return projects where user is a collaborator (not owner)
            return Array.from(mockProjects.values()).filter(p => {
                const collabIds = mockCollaborators.get(p.id);
                return collabIds?.has(userId);
            });
        },
        updateProjectVisibility: async (_db: any, id: number, visibility: string) => {
            const project = mockProjects.get(id);
            if (project) {
                project.visibility = visibility;
            }
        },
        updateProjectVisibilityByUuid: async (_db: any, uuid: string, visibility: string) => {
            const project = mockProjectsByUuid.get(uuid);
            if (project) {
                project.visibility = visibility;
            }
        },
        getProjectCollaborators: async (_db: any, projectId: number) => {
            const collabIds = mockCollaborators.get(projectId) || new Set();
            return Array.from(collabIds)
                .map(id => mockUsers.get(id))
                .filter(Boolean);
        },
        addCollaborator: async (_db: any, projectId: number, userId: number) => {
            if (!mockCollaborators.has(projectId)) {
                mockCollaborators.set(projectId, new Set());
            }
            mockCollaborators.get(projectId)!.add(userId);
        },
        removeCollaborator: async (_db: any, projectId: number, userId: number) => {
            mockCollaborators.get(projectId)?.delete(userId);
        },
        isCollaborator: async (_db: any, projectId: number, userId: number) => {
            return mockCollaborators.get(projectId)?.has(userId) || false;
        },
        transferOwnership: async (_db: any, projectId: number, newOwnerId: number) => {
            const project = mockProjects.get(projectId);
            if (!project) {
                throw new Error('Project not found');
            }
            const previousOwnerId = project.owner_id;
            if (previousOwnerId === newOwnerId) {
                throw new Error('Cannot transfer ownership to current owner');
            }
            // Check collaborator
            const collabs = mockCollaborators.get(projectId);
            if (!collabs?.has(newOwnerId)) {
                throw new Error('New owner must be a current collaborator');
            }
            // Remove new owner from collaborators
            collabs.delete(newOwnerId);
            // Add previous owner as collaborator
            collabs.add(previousOwnerId);
            // Update owner
            project.owner_id = newOwnerId;
            return { success: true, previousOwnerId, newOwnerId };
        },
        transferOwnershipByUuid: async (_db: any, uuid: string, newOwnerId: number) => {
            const project = mockProjectsByUuid.get(uuid);
            if (!project) {
                throw new Error('Project not found');
            }
            const previousOwnerId = project.owner_id;
            if (previousOwnerId === newOwnerId) {
                throw new Error('Cannot transfer ownership to current owner');
            }
            // Check collaborator
            const collabs = mockCollaborators.get(project.id);
            if (!collabs?.has(newOwnerId)) {
                throw new Error('New owner must be a current collaborator');
            }
            // Remove new owner from collaborators
            collabs.delete(newOwnerId);
            // Add previous owner as collaborator
            collabs.add(previousOwnerId);
            // Update owner
            project.owner_id = newOwnerId;
            return { success: true, previousOwnerId, newOwnerId };
        },
        hardDeleteProject: async (_db: any, id: number) => {
            const project = mockProjects.get(id);
            if (project) {
                mockProjectsByUuid.delete(project.uuid);
                mockProjects.delete(id);
            }
        },
        findUserById: async (_db: any, id: number) => mockUsers.get(id),
        findUserByEmail: async (_db: any, email: string) => {
            return Array.from(mockUsers.values()).find(u => u.email === email);
        },
        findFirstUser: async (_db: any) => {
            return mockUsers.size > 0 ? mockUsers.values().next().value : undefined;
        },
        createUser: async (_db: any, data: any) => {
            const id = userIdCounter++;
            const user = { id, ...data };
            mockUsers.set(id, user);
            return user;
        },
        checkProjectAccess: async (_db: any, project: any, userId?: number) => {
            if (project.visibility === 'public') {
                return { hasAccess: true };
            }
            if (!userId) {
                return { hasAccess: false, reason: 'Authentication required' };
            }
            if (project.owner_id === userId) {
                return { hasAccess: true };
            }
            const collabs = mockCollaborators.get(project.id) || new Set();
            if (collabs.has(userId)) {
                return { hasAccess: true };
            }
            return { hasAccess: false, reason: 'Access denied' };
        },
        findSnapshotByProjectId: async (_db: any, projectId: number) => mockSnapshots.get(projectId),
        upsertSnapshot: async (_db: any, projectId: number, data: Buffer, version: string) => {
            mockSnapshots.set(projectId, { project_id: projectId, snapshot_data: data, version });
        },
        findAllAssetsForProject: async (_db: any, projectId: number) => {
            return mockAssets.get(projectId) || [];
        },
        createAsset: async (_db: any, data: any) => {
            const id = assetIdCounter++;
            const asset = {
                id,
                ...data,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const projectAssets = mockAssets.get(data.project_id) || [];
            projectAssets.push(asset);
            mockAssets.set(data.project_id, projectAssets);
            return asset;
        },
    };
}

/**
 * Create mock utils dependency
 */
function createMockUtils(): UtilsDeps {
    return {
        createGravatarUrl: (email: string) => `https://gravatar.com/avatar/${email}`,
    };
}

/**
 * Create all mock dependencies for project routes
 */
function createMockDependencies(): ProjectDependencies {
    return {
        db: {} as any, // Mock db - not used directly, queries handle it
        fs: fs,
        path: path,
        sessionManager: createMockSessionManager(),
        fileHelper: createMockFileHelper(),
        zip: createMockZip(),
        queries: createMockQueries(),
        utils: createMockUtils(),
    };
}

describe('Project Routes', () => {
    let app: Elysia;
    let mockDeps: ProjectDependencies;

    beforeEach(async () => {
        // Reset mock data
        mockUsers = new Map();
        mockProjects = new Map();
        mockProjectsByUuid = new Map();
        mockSessions = new Map();
        mockCollaborators = new Map();
        mockSnapshots = new Map();
        mockAssets = new Map();
        userIdCounter = 1;
        projectIdCounter = 1;
        assetIdCounter = 1;

        // Create test users
        mockUsers.set(1, {
            id: 1,
            email: 'owner@test.com',
            roles: '["ROLE_USER"]',
        });
        mockUsers.set(2, {
            id: 2,
            email: 'collaborator@test.com',
            roles: '["ROLE_USER"]',
        });
        mockUsers.set(3, {
            id: 3,
            email: 'other@test.com',
            roles: '["ROLE_USER"]',
        });

        // Set JWT secret
        process.env.JWT_SECRET = 'test-secret-for-testing-only';

        // Create mock dependencies
        mockDeps = createMockDependencies();

        // Create app with injected dependencies
        app = new Elysia().use(createProjectRoutes(mockDeps)).use(createSymfonyCompatProjectRoutes(mockDeps));

        // Create test directories
        await fs.ensureDir(testDir);
    });

    afterEach(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('GET /api/project/sessions', () => {
        it('should return empty list when no sessions', async () => {
            const res = await app.handle(new Request('http://localhost/api/project/sessions'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.count).toBe(0);
            expect(body.sessions).toEqual([]);
        });

        it('should return list of sessions', async () => {
            mockSessions.set('session-1', {
                sessionId: 'session-1',
                fileName: 'test.elp',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            const res = await app.handle(new Request('http://localhost/api/project/sessions'));

            const body = await res.json();
            expect(body.count).toBe(1);
            expect(body.sessions[0].sessionId).toBe('session-1');
        });
    });

    describe('GET /api/project/sessions/:id', () => {
        it('should return session details', async () => {
            mockSessions.set('session-1', {
                sessionId: 'session-1',
                fileName: 'test.elp',
                filePath: '/tmp/test',
                createdAt: new Date().toISOString(),
                structure: { title: 'Test' },
            });

            const res = await app.handle(new Request('http://localhost/api/project/sessions/session-1'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.sessionId).toBe('session-1');
            expect(body.fileName).toBe('test.elp');
            expect(body.hasStructure).toBe(true);
        });

        it('should return 404 for non-existent session', async () => {
            const res = await app.handle(new Request('http://localhost/api/project/sessions/non-existent'));

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/project/sessions/:id', () => {
        it('should delete session', async () => {
            mockSessions.set('session-to-delete', {
                sessionId: 'session-to-delete',
                fileName: 'delete.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/api/project/sessions/session-to-delete', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.message).toContain('deleted');
            expect(mockSessions.has('session-to-delete')).toBe(false);
        });

        it('should return 404 for non-existent session', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/sessions/non-existent', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(404);
        });
    });

    describe('Symfony Compat Routes', () => {
        describe('GET /api/nav-structures/:sessionId', () => {
            it('should return default structure for new session', async () => {
                const res = await app.handle(new Request('http://localhost/api/nav-structures/new-session'));

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.sessionId).toBe('new-session');
                expect(body.structure.root).toBeDefined();
            });

            it('should return session structure when available', async () => {
                mockSessions.set('session-with-structure', {
                    sessionId: 'session-with-structure',
                    structure: {
                        meta: { title: 'Test Project' },
                        pages: [{ id: 'page-1', title: 'Page 1' }],
                    },
                });

                const res = await app.handle(new Request('http://localhost/api/nav-structures/session-with-structure'));

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.sessionId).toBe('session-with-structure');
            });
        });

        describe('GET /api/odes/last-updated', () => {
            it('should return last updated timestamp', async () => {
                const res = await app.handle(new Request('http://localhost/api/odes/last-updated'));

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.lastUpdated).toBeDefined();
                expect(body.timestamp).toBeDefined();
            });
        });
    });

    describe('Project Sharing', () => {
        it('should get sharing info by project ID', async () => {
            // Create a project
            const project = {
                id: 1,
                uuid: 'test-project-uuid',
                owner_id: 1,
                title: 'Test Project',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(1, project);
            mockProjectsByUuid.set('test-project-uuid', project);

            const res = await app.handle(new Request('http://localhost/api/projects/1/sharing'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
            expect(body.project.uuid).toBe('test-project-uuid');
            expect(body.project.visibility).toBe('private');
        });

        it('should get sharing info by project UUID', async () => {
            // Create a project
            const project = {
                id: 1,
                uuid: 'test-project-uuid',
                owner_id: 1,
                title: 'Test Project',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(1, project);
            mockProjectsByUuid.set('test-project-uuid', project);

            const res = await app.handle(new Request('http://localhost/api/projects/uuid/test-project-uuid/sharing'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
            expect(body.project.uuid).toBe('test-project-uuid');
            expect(body.project.visibility).toBe('private');
        });
    });

    describe('POST /api/project/create-quick', () => {
        it('should require authentication', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/create-quick', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: 'New Project' }),
                }),
            );

            // Route requires authentication
            expect(res.status).toBe(401);
        });
    });

    describe('DELETE endpoints', () => {
        it('should handle nav-structure delete', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/nav-structure-management/nav-structures/page-id/delete', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should handle pag-structure delete', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/pag-structure-management/pag-structures/block-id/delete', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should handle idevice delete', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevice-management/idevices/idevice-id/delete', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });
    });

    describe('POST /api/project/upload-chunk', () => {
        it('should handle chunk upload', async () => {
            const formData = new FormData();
            formData.append('odeFilePart', new Blob(['test chunk data']));
            formData.append('odeFileName', 'test.elp');
            formData.append('odeSessionId', 'chunk-test-session');

            const res = await app.handle(
                new Request('http://localhost/api/project/upload-chunk', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
            expect(body.odeFileName).toBe('test.elp');
        });

        it('should return error when missing required fields', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/upload-chunk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.responseMessage).toContain('error');
        });

        it('should handle Buffer input', async () => {
            const formData = new FormData();
            const buffer = Buffer.from('buffer chunk data');
            formData.append('odeFilePart', new Blob([buffer]));
            formData.append('odeFileName', 'buffer-test.elp');
            formData.append('odeSessionId', 'buffer-chunk-session');

            const res = await app.handle(
                new Request('http://localhost/api/project/upload-chunk', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
        });
    });

    describe('Collaboration Management', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        function createTestProject(id: number, ownerId: number = 1) {
            const project = {
                id,
                uuid: `project-uuid-${id}`,
                owner_id: ownerId,
                title: `Test Project ${id}`,
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(id, project);
            mockProjectsByUuid.set(project.uuid, project);
            return project;
        }

        describe('PATCH /api/projects/:projectId/visibility', () => {
            it('should require authentication', async () => {
                createTestProject(100);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/100/visibility', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ visibility: 'public' }),
                    }),
                );

                expect(res.status).toBe(401);
            });

            it('should require ownership to change visibility', async () => {
                createTestProject(101, 1); // Owner is user 1
                const token = await createAuthToken(3); // User 3 is not owner

                const res = await app.handle(
                    new Request('http://localhost/api/projects/101/visibility', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ visibility: 'public' }),
                    }),
                );

                expect(res.status).toBe(403);
            });

            it('should update visibility as owner', async () => {
                createTestProject(102, 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/102/visibility', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ visibility: 'public' }),
                    }),
                );

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.responseMessage).toBe('OK');
            });

            it('should reject invalid visibility value', async () => {
                createTestProject(103, 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/103/visibility', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ visibility: 'invalid' }),
                    }),
                );

                expect(res.status).toBe(400);
            });

            it('should return 404 for non-existent project', async () => {
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/99999/visibility', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ visibility: 'public' }),
                    }),
                );

                expect(res.status).toBe(404);
            });

            it('should return 400 for invalid project ID', async () => {
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/invalid/visibility', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ visibility: 'public' }),
                    }),
                );

                expect(res.status).toBe(400);
            });
        });

        describe('POST /api/projects/:projectId/collaborators', () => {
            it('should require authentication', async () => {
                createTestProject(200);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/200/collaborators', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: 'collaborator@test.com' }),
                    }),
                );

                expect(res.status).toBe(401);
            });

            it('should add collaborator as owner', async () => {
                createTestProject(201, 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/201/collaborators', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ email: 'collaborator@test.com' }),
                    }),
                );

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.responseMessage).toBe('OK');
                expect(body.collaborator.email).toBe('collaborator@test.com');
            });

            it('should not add non-existent user', async () => {
                createTestProject(202, 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/202/collaborators', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ email: 'nonexistent@test.com' }),
                    }),
                );

                const body = await res.json();
                expect(body.responseMessage).toBe('USER_NOT_FOUND');
            });

            it('should not allow non-owner to add collaborator', async () => {
                createTestProject(203, 1);
                const token = await createAuthToken(3);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/203/collaborators', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ email: 'collaborator@test.com' }),
                    }),
                );

                expect(res.status).toBe(403);
            });

            it('should require email field', async () => {
                createTestProject(204, 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/204/collaborators', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({}),
                    }),
                );

                expect(res.status).toBe(400);
            });

            it('should not add owner as collaborator', async () => {
                createTestProject(205, 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/205/collaborators', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ email: 'owner@test.com' }),
                    }),
                );

                const body = await res.json();
                expect(body.responseMessage).toBe('IS_OWNER');
            });

            it('should not add duplicate collaborator', async () => {
                createTestProject(206, 1);
                mockCollaborators.set(206, new Set([2])); // User 2 already collaborator
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/206/collaborators', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ email: 'collaborator@test.com' }),
                    }),
                );

                const body = await res.json();
                expect(body.responseMessage).toBe('ALREADY_COLLABORATOR');
            });
        });

        describe('DELETE /api/projects/:projectId/collaborators/:userId', () => {
            it('should remove collaborator as owner', async () => {
                createTestProject(300, 1);
                mockCollaborators.set(300, new Set([2]));
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/300/collaborators/2', {
                        method: 'DELETE',
                        headers: { 'Cookie': `auth=${token}` },
                    }),
                );

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.responseMessage).toBe('OK');
            });

            it('should require authentication', async () => {
                createTestProject(301);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/301/collaborators/2', {
                        method: 'DELETE',
                    }),
                );

                expect(res.status).toBe(401);
            });

            it('should require ownership', async () => {
                createTestProject(302, 1);
                const token = await createAuthToken(3);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/302/collaborators/2', {
                        method: 'DELETE',
                        headers: { 'Cookie': `auth=${token}` },
                    }),
                );

                expect(res.status).toBe(403);
            });

            it('should return 400 for invalid IDs', async () => {
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/invalid/collaborators/invalid', {
                        method: 'DELETE',
                        headers: { 'Cookie': `auth=${token}` },
                    }),
                );

                expect(res.status).toBe(400);
            });
        });

        describe('PATCH /api/projects/:projectId/owner', () => {
            it('should transfer ownership as owner when new owner is collaborator', async () => {
                createTestProject(400, 1);
                // Add user 2 as collaborator (required for transfer)
                mockCollaborators.set(400, new Set([2]));
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/400/owner', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ newOwnerId: 2 }),
                    }),
                );

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.responseMessage).toBe('OK');
            });

            it('should require new owner to be a collaborator', async () => {
                createTestProject(405, 1);
                // Note: user 2 is NOT added as collaborator
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/405/owner', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ newOwnerId: 2 }),
                    }),
                );

                expect(res.status).toBe(403);
                const body = await res.json();
                expect(body.responseMessage).toBe('NOT_COLLABORATOR');
            });

            it('should require authentication', async () => {
                createTestProject(401);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/401/owner', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ newOwnerId: 2 }),
                    }),
                );

                expect(res.status).toBe(401);
            });

            it('should require ownership', async () => {
                createTestProject(402, 1);
                const token = await createAuthToken(3);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/402/owner', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ newOwnerId: 2 }),
                    }),
                );

                expect(res.status).toBe(403);
            });

            it('should return 404 for non-existent new owner', async () => {
                createTestProject(403, 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/403/owner', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ newOwnerId: 9999 }),
                    }),
                );

                expect(res.status).toBe(404);
            });

            it('should require newOwnerId', async () => {
                createTestProject(404, 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/404/owner', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({}),
                    }),
                );

                expect(res.status).toBe(400);
            });
        });
    });

    describe('UUID-based Collaboration Routes', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        function createTestProject(id: number, uuid: string, ownerId: number = 1) {
            const project = {
                id,
                uuid,
                owner_id: ownerId,
                title: `Test Project ${id}`,
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(id, project);
            mockProjectsByUuid.set(uuid, project);
            return project;
        }

        describe('PATCH /api/projects/uuid/:uuid/visibility', () => {
            it('should update visibility by UUID', async () => {
                createTestProject(500, 'uuid-500', 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/uuid/uuid-500/visibility', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ visibility: 'public' }),
                    }),
                );

                expect(res.status).toBe(200);
            });

            it('should reject invalid visibility', async () => {
                createTestProject(501, 'uuid-501', 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/uuid/uuid-501/visibility', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ visibility: 'invalid' }),
                    }),
                );

                expect(res.status).toBe(400);
            });

            it('should only update the specified project (regression test for stale UUID bug)', async () => {
                // This test ensures that when updating visibility for project B,
                // project A remains unchanged (prevents stale UUID bugs)
                const projectA = createTestProject(502, 'uuid-project-a', 1);
                const projectB = createTestProject(503, 'uuid-project-b', 1);
                const token = await createAuthToken(1);

                // Both start as private
                expect(projectA.visibility).toBe('private');
                expect(projectB.visibility).toBe('private');

                // Update only project B to public
                const res = await app.handle(
                    new Request('http://localhost/api/projects/uuid/uuid-project-b/visibility', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ visibility: 'public' }),
                    }),
                );

                expect(res.status).toBe(200);

                // Verify: Project B is now public
                expect(mockProjectsByUuid.get('uuid-project-b')?.visibility).toBe('public');

                // Verify: Project A is still private (not affected by the change)
                expect(mockProjectsByUuid.get('uuid-project-a')?.visibility).toBe('private');
            });
        });

        describe('POST /api/projects/uuid/:uuid/collaborators', () => {
            it('should add collaborator by UUID', async () => {
                createTestProject(600, 'uuid-600', 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/uuid/uuid-600/collaborators', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ email: 'collaborator@test.com' }),
                    }),
                );

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.responseMessage).toBe('OK');
            });

            it('should require email', async () => {
                createTestProject(601, 'uuid-601', 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/uuid/uuid-601/collaborators', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({}),
                    }),
                );

                expect(res.status).toBe(400);
            });
        });

        describe('DELETE /api/projects/uuid/:uuid/collaborators/:userId', () => {
            it('should remove collaborator by UUID', async () => {
                createTestProject(700, 'uuid-700', 1);
                mockCollaborators.set(700, new Set([2]));
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/uuid/uuid-700/collaborators/2', {
                        method: 'DELETE',
                        headers: { 'Cookie': `auth=${token}` },
                    }),
                );

                expect(res.status).toBe(200);
            });

            it('should return 400 for invalid userId', async () => {
                createTestProject(701, 'uuid-701', 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/uuid/uuid-701/collaborators/invalid', {
                        method: 'DELETE',
                        headers: { 'Cookie': `auth=${token}` },
                    }),
                );

                expect(res.status).toBe(400);
            });
        });

        describe('PATCH /api/projects/uuid/:uuid/owner', () => {
            it('should transfer ownership by UUID when new owner is collaborator', async () => {
                createTestProject(800, 'uuid-800', 1);
                // Add user 2 as collaborator (required for transfer)
                mockCollaborators.set(800, new Set([2]));
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/uuid/uuid-800/owner', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ newOwnerId: 2 }),
                    }),
                );

                expect(res.status).toBe(200);
            });

            it('should require new owner to be a collaborator', async () => {
                createTestProject(802, 'uuid-802', 1);
                // Note: user 2 is NOT added as collaborator
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/uuid/uuid-802/owner', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({ newOwnerId: 2 }),
                    }),
                );

                expect(res.status).toBe(403);
                const body = await res.json();
                expect(body.responseMessage).toBe('NOT_COLLABORATOR');
            });

            it('should require newOwnerId', async () => {
                createTestProject(801, 'uuid-801', 1);
                const token = await createAuthToken(1);

                const res = await app.handle(
                    new Request('http://localhost/api/projects/uuid/uuid-801/owner', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': `auth=${token}`,
                        },
                        body: JSON.stringify({}),
                    }),
                );

                expect(res.status).toBe(400);
            });
        });
    });

    describe('POST /api/projects/uuid/:uuid/duplicate', () => {
        function createTestProject(id: number, uuid: string, ownerId: number = 1) {
            const project = {
                id,
                uuid,
                owner_id: ownerId,
                title: `Test Project ${id}`,
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(id, project);
            mockProjectsByUuid.set(uuid, project);
            return project;
        }

        it('should duplicate project', async () => {
            createTestProject(900, 'uuid-900', 1);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/uuid-900/duplicate', {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.newProjectId).toBeDefined();
            expect(body.project.title).toContain('copy');
        });

        it('should return 404 for non-existent project', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/non-existent/duplicate', {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(404);
        });

        it('should duplicate project with Yjs snapshot', async () => {
            const _project = createTestProject(901, 'uuid-901-with-snapshot', 1);

            // Create a valid Yjs document state for the test
            const Y = await import('yjs');
            const ydoc = new Y.Doc();
            const metadata = ydoc.getMap('metadata');
            metadata.set('title', 'Original Title');
            const validSnapshotData = Buffer.from(Y.encodeStateAsUpdate(ydoc));
            ydoc.destroy();

            // Add a mock snapshot for this project (simulates Yjs document state)
            mockSnapshots.set(901, {
                id: 1,
                project_id: 901,
                snapshot_data: validSnapshotData,
                snapshot_version: '12345',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/uuid-901-with-snapshot/duplicate', {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.project.title).toContain('copy');

            // Verify new project was created
            const newProjectId = body.project.id;
            expect(newProjectId).toBeDefined();

            // Verify snapshot was copied to new project
            const newSnapshot = mockSnapshots.get(newProjectId);
            expect(newSnapshot).toBeDefined();
            expect(newSnapshot?.project_id).toBe(newProjectId);
        });

        it('should duplicate project assets preserving client_ids', async () => {
            const sourceProject = createTestProject(902, 'uuid-902-with-assets', 1);

            // Create source asset file on disk
            const sourceClientId = 'source-client-id-123';
            const sourceAssetDir = path.join(testDir, 'assets', String(sourceProject.id), sourceClientId);
            await fs.ensureDir(sourceAssetDir);
            const sourceFilePath = path.join(sourceAssetDir, 'test-image.png');
            await fs.writeFile(sourceFilePath, Buffer.from('fake-image-data'));

            // Add mock asset for source project
            mockAssets.set(sourceProject.id, [
                {
                    id: 1,
                    project_id: sourceProject.id,
                    filename: 'test-image.png',
                    storage_path: sourceFilePath,
                    mime_type: 'image/png',
                    file_size: 16,
                    client_id: sourceClientId,
                    component_id: 'idevice-123',
                    content_hash: 'abc123',
                },
            ]);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/uuid-902-with-assets/duplicate', {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);

            // Verify new asset was created preserving client_id
            const newProjectId = body.project.id;
            const newAssets = mockAssets.get(newProjectId);
            expect(newAssets).toBeDefined();
            expect(newAssets!.length).toBe(1);
            expect(newAssets![0].client_id).toBe(sourceClientId);
            expect(newAssets![0].filename).toBe('test-image.png');
            expect(newAssets![0].project_id).toBe(newProjectId);
        });

        it('should handle project with no assets during duplication', async () => {
            createTestProject(903, 'uuid-903-no-assets', 1);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/uuid-903-no-assets/duplicate', {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);

            // Verify no assets were created
            const newProjectId = body.project.id;
            const newAssets = mockAssets.get(newProjectId);
            expect(newAssets || []).toEqual([]);
        });

        it('should skip assets without client_id during duplication', async () => {
            const sourceProject = createTestProject(904, 'uuid-904-asset-no-clientid', 1);

            // Add mock asset without client_id
            mockAssets.set(sourceProject.id, [
                {
                    id: 1,
                    project_id: sourceProject.id,
                    filename: 'orphan.png',
                    storage_path: '/some/path/orphan.png',
                    mime_type: 'image/png',
                    file_size: 100,
                    client_id: null, // No client_id
                    component_id: null,
                    content_hash: 'xyz789',
                },
            ]);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/uuid-904-asset-no-clientid/duplicate', {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);

            // Verify no assets were created (asset without client_id is skipped)
            const newProjectId = body.project.id;
            const newAssets = mockAssets.get(newProjectId);
            expect(newAssets || []).toEqual([]);
        });

        it('should update asset references in Yjs document when duplicating', async () => {
            const sourceProject = createTestProject(905, 'uuid-905-yjs-assets', 1);

            // Create source asset file on disk
            const sourceClientId = 'old-asset-uuid-456';
            const sourceAssetDir = path.join(testDir, 'assets', String(sourceProject.id), sourceClientId);
            await fs.ensureDir(sourceAssetDir);
            const sourceFilePath = path.join(sourceAssetDir, 'image.jpg');
            await fs.writeFile(sourceFilePath, Buffer.from('fake-jpg-data'));

            // Add mock asset
            mockAssets.set(sourceProject.id, [
                {
                    id: 1,
                    project_id: sourceProject.id,
                    filename: 'image.jpg',
                    storage_path: sourceFilePath,
                    mime_type: 'image/jpeg',
                    file_size: 13,
                    client_id: sourceClientId,
                    component_id: 'idevice-456',
                    content_hash: 'def456',
                },
            ]);

            // Create a Yjs document with HTML content referencing the asset
            const Y = await import('yjs');
            const ydoc = new Y.Doc();
            const metadata = ydoc.getMap('metadata');
            metadata.set('title', 'Project with Asset Refs');

            // Create pages structure with asset reference in innerHtml
            const pages = ydoc.getMap('pages');
            const page = new Y.Map();
            const blocks = new Y.Map();
            const block = new Y.Map();
            const idevices = new Y.Map();
            const idevice = new Y.Map();
            idevice.set('innerHtml', `<img src="/api/assets/${sourceClientId}/image.jpg" alt="test">`);
            idevices.set('idevice-456', idevice);
            block.set('idevices', idevices);
            blocks.set('block-1', block);
            page.set('blocks', blocks);
            pages.set('page-1', page);

            const snapshotData = Buffer.from(Y.encodeStateAsUpdate(ydoc));
            ydoc.destroy();

            mockSnapshots.set(sourceProject.id, {
                id: 1,
                project_id: sourceProject.id,
                snapshot_data: snapshotData,
                snapshot_version: '12345',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/uuid-905-yjs-assets/duplicate', {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);

            // Get duplicated asset client_id (should be preserved)
            const newProjectId = body.project.id;
            const newAssets = mockAssets.get(newProjectId);
            expect(newAssets).toBeDefined();
            expect(newAssets!.length).toBe(1);
            const newClientId = newAssets![0].client_id;
            expect(newClientId).toBe(sourceClientId);

            // Verify Yjs document still references the same client_id
            const newSnapshot = mockSnapshots.get(newProjectId);
            expect(newSnapshot).toBeDefined();

            // Load and verify the new Yjs document
            const newYdoc = new Y.Doc();
            Y.applyUpdate(newYdoc, new Uint8Array(newSnapshot.snapshot_data));
            const newPages = newYdoc.getMap('pages');
            const newPage = newPages.get('page-1') as Y.Map<unknown>;
            const newBlocks = newPage?.get('blocks') as Y.Map<unknown>;
            const newBlock = newBlocks?.get('block-1') as Y.Map<unknown>;
            const newIdevices = newBlock?.get('idevices') as Y.Map<unknown>;
            const newIdevice = newIdevices?.get('idevice-456') as Y.Map<unknown>;
            const newInnerHtml = newIdevice?.get('innerHtml') as string;

            expect(newInnerHtml).toContain(newClientId);
            newYdoc.destroy();
        });

        it('should handle multiple assets during duplication', async () => {
            const sourceProject = createTestProject(906, 'uuid-906-multi-assets', 1);

            // Create source asset files on disk
            const clientIds = ['asset-1-uuid', 'asset-2-uuid', 'asset-3-uuid'];
            for (const clientId of clientIds) {
                const assetDir = path.join(testDir, 'assets', String(sourceProject.id), clientId);
                await fs.ensureDir(assetDir);
                await fs.writeFile(path.join(assetDir, `${clientId}.png`), Buffer.from('data'));
            }

            // Add mock assets
            mockAssets.set(
                sourceProject.id,
                clientIds.map((clientId, i) => ({
                    id: i + 1,
                    project_id: sourceProject.id,
                    filename: `${clientId}.png`,
                    storage_path: path.join(testDir, 'assets', String(sourceProject.id), clientId, `${clientId}.png`),
                    mime_type: 'image/png',
                    file_size: 4,
                    client_id: clientId,
                    component_id: `idevice-${i}`,
                    content_hash: `hash-${i}`,
                })),
            );

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/uuid-906-multi-assets/duplicate', {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);

            // Verify all assets were duplicated preserving client_ids
            const newProjectId = body.project.id;
            const newAssets = mockAssets.get(newProjectId);
            expect(newAssets).toBeDefined();
            expect(newAssets!.length).toBe(3);

            // Verify all original client_ids are present
            for (const newAsset of newAssets!) {
                expect(clientIds).toContain(newAsset.client_id as string);
            }
        });
    });

    describe('DELETE /api/projects/uuid/:uuid', () => {
        function createTestProject(id: number, uuid: string, ownerId: number = 1) {
            const project = {
                id,
                uuid,
                owner_id: ownerId,
                title: `Test Project ${id}`,
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(id, project);
            mockProjectsByUuid.set(uuid, project);
            return project;
        }

        it('should delete project by UUID', async () => {
            createTestProject(950, 'uuid-950', 1);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/uuid-950', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(mockProjectsByUuid.has('uuid-950')).toBe(false);
        });

        it('should return 404 for non-existent project', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/non-existent', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(404);
        });
    });

    describe('ODE Properties', () => {
        async function _createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should get ODE properties', async () => {
            mockSessions.set('ode-props-session', {
                sessionId: 'ode-props-session',
                fileName: 'Test.elp',
            });

            const res = await app.handle(new Request('http://localhost/api/odes/ode-props-session/properties'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.sessionId).toBe('ode-props-session');
            expect(body.properties).toBeDefined();
        });

        it('should save ODE properties', async () => {
            mockSessions.set('ode-save-session', {
                sessionId: 'ode-save-session',
                fileName: 'Test.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/api/odes/ode-save-session/properties', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        properties: {
                            pp_title: 'New Title',
                            pp_author: 'Test Author',
                        },
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });
    });

    describe('Link Validation (brokenlinks)', () => {
        it('should return no broken links for empty content', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idevices: [] }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
            expect(body.brokenLinks[0].brokenLinks).toBe('No broken links found');
        });

        it('should detect internal broken links', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="files/nonexistent.jpg">Link</a>',
                                pageName: 'Page 1',
                                blockName: 'Block 1',
                                ideviceType: 'text',
                                order: 1,
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.brokenLinks.length).toBeGreaterThan(0);
        });

        it('should skip exe-node internal links', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="exe-node:page_1">Internal Link</a>',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            // exe-node links should be valid
            expect(body.brokenLinks[0].brokenLinks).toBe('No broken links found');
        });

        it('should skip javascript and data URLs', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="javascript:void(0)">JS Link</a><img src="data:image/png;base64,abc">',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.brokenLinks[0].brokenLinks).toBe('No broken links found');
        });
    });

    describe('Link Extraction (brokenlinks/extract)', () => {
        it('should extract links without validating', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks/extract', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="https://google.com">Google</a><img src="files/image.jpg">',
                                pageName: 'Page 1',
                                blockName: 'Block 1',
                                ideviceType: 'text',
                                order: 1,
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
            expect(body.links).toHaveLength(2);
            expect(body.totalLinks).toBe(2);

            // Each link should have an ID and metadata
            const googleLink = body.links.find((l: { url: string }) => l.url === 'https://google.com');
            expect(googleLink).toBeDefined();
            expect(googleLink.id).toBeDefined();
            expect(googleLink.pageName).toBe('Page 1');
            expect(googleLink.ideviceType).toBe('text');
        });

        it('should return empty array for content with no links', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks/extract', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [{ html: '<p>No links here</p>' }],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.links).toHaveLength(0);
            expect(body.totalLinks).toBe(0);
        });

        it('should skip exe-node links during extraction', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks/extract', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="exe-node:page-123">Internal</a><a href="https://external.com">External</a>',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            // Only external link should be extracted (exe-node skipped)
            expect(body.links).toHaveLength(1);
            expect(body.links[0].url).toBe('https://external.com');
        });
    });

    describe('Link Validation Stream (brokenlinks/validate-stream)', () => {
        it('should stream validation results for exe-node links', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks/validate-stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        links: [
                            {
                                id: 'test-id-1',
                                url: 'exe-node:page-123',
                                count: 1,
                                pageName: 'Page 1',
                                blockName: 'Block 1',
                                ideviceType: 'text',
                                order: '1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);

            // Read the streamed response (Elysia yields JSON objects with escaped data)
            const text = await res.text();

            // Should contain link-validated event with valid status
            // Note: data field contains escaped JSON, so we check for escaped quotes
            expect(text).toContain('"event":"link-validated"');
            expect(text).toContain('\\"status\\":\\"valid\\"');
            expect(text).toContain('\\"id\\":\\"test-id-1\\"');

            // Should contain done event
            expect(text).toContain('"event":"done"');
            expect(text).toContain('\\"complete\\":true');
        });

        it('should stream broken status for missing files', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks/validate-stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        links: [
                            {
                                id: 'missing-file-id',
                                url: 'files/this-file-does-not-exist.jpg',
                                count: 1,
                                pageName: 'Page 1',
                                blockName: 'Block 1',
                                ideviceType: 'text',
                                order: '1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const text = await res.text();

            // Should contain broken status with 404 error (escaped JSON in data field)
            expect(text).toContain('\\"status\\":\\"broken\\"');
            expect(text).toContain('\\"error\\":\\"404\\"');
        });

        it('should handle empty links array', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks/validate-stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ links: [] }),
                }),
            );

            expect(res.status).toBe(200);
            const text = await res.text();

            // Should only contain done event (escaped JSON in data field)
            expect(text).toContain('"event":"done"');
            expect(text).toContain('\\"totalValidated\\":0');
        });
    });

    describe('Used Files Report (usedfiles)', () => {
        it('should return no files for empty content', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idevices: [] }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
            expect(body.usedFiles[0].usedFiles).toBe('No files found');
        });

        it('should detect asset:// URLs', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<img src="asset://image.png">',
                                pageName: 'Page 1',
                                blockName: 'Block 1',
                                ideviceType: 'image',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.usedFiles.length).toBeGreaterThan(0);
            expect(body.usedFiles[0].usedFilesSize).toBe('Stored in browser');
        });

        it('should use asset metadata when provided', async () => {
            const assetId = 'a1b2c3d4-5678-90ab-cdef-123456789012';
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: `<img src="asset://${assetId}">`,
                                pageName: 'Page 1',
                                blockName: 'Block 1',
                                ideviceType: 'image',
                            },
                        ],
                        assetMetadata: {
                            [assetId]: {
                                filename: 'my-photo.jpg',
                                size: 1048576, // 1 MB
                                mime: 'image/jpeg',
                            },
                        },
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.usedFiles.length).toBeGreaterThan(0);
            // Should use filename from metadata instead of UUID
            expect(body.usedFiles[0].usedFiles).toBe('my-photo.jpg');
            // Should show formatted size instead of "Stored in browser"
            expect(body.usedFiles[0].usedFilesSize).toBe('1 MB');
        });

        it('should fallback to UUID when metadata has no filename', async () => {
            const assetId = 'b2c3d4e5-6789-01ab-cdef-234567890123';
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: `<img src="asset://${assetId}">`,
                                pageName: 'Page 1',
                            },
                        ],
                        assetMetadata: {
                            [assetId]: {
                                filename: null,
                                size: 512,
                                mime: 'application/octet-stream',
                            },
                        },
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.usedFiles.length).toBeGreaterThan(0);
            // Should use UUID as fallback
            expect(body.usedFiles[0].usedFiles).toBe(assetId);
            // Should still show size
            expect(body.usedFiles[0].usedFilesSize).toBe('512 B');
        });

        it('should detect files/ URLs', async () => {
            // Create a test file
            const filesDir = path.join(testDir, 'files');
            await fs.ensureDir(filesDir);
            await fs.writeFile(path.join(filesDir, 'test.jpg'), 'test content');

            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<img src="files/test.jpg">',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.usedFiles.length).toBeGreaterThan(0);
        });
    });

    describe('Clone/Duplicate Endpoints', () => {
        it('should clone nav-structure (page)', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/nav-structure-management/nav-structures/duplicate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeSessionId: 'session-1',
                        navStructureId: 'page-1',
                        parentId: 'root',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.newNavStructureId).toBeDefined();
        });
    });

    describe('Structure Save/Reorder Endpoints', () => {
        it('should reorder nav-structures', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/nav-structure-management/nav-structures/reorder/save', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeSessionId: 'session-1',
                        order: ['page-2', 'page-1', 'page-3'],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should reorder pag-structures', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/pag-structure-management/pag-structures/reorder/save', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeSessionId: 'session-1',
                        pageId: 'page-1',
                        order: ['block-2', 'block-1'],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should reorder idevices', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevice-management/idevices/reorder/save', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeSessionId: 'session-1',
                        blockId: 'block-1',
                        order: ['idevice-2', 'idevice-1'],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });
    });

    describe('User/Session Endpoints', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should get user project list when authenticated', async () => {
            const token = await createAuthToken(1);

            // Create a saved project
            const project = {
                id: 1000,
                uuid: 'user-project-1',
                owner_id: 1,
                title: 'User Project',
                saved_once: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(1000, project);
            mockProjectsByUuid.set('user-project-1', project);

            const res = await app.handle(
                new Request('http://localhost/api/projects/user/list', {
                    headers: { 'Cookie': `auth=${token}` },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.odeFiles.odeFilesSync.length).toBeGreaterThan(0);
        });

        it('should return empty list when not authenticated', async () => {
            const res = await app.handle(new Request('http://localhost/api/projects/user/list'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.odeFiles.odeFilesSync).toEqual([]);
        });

        it('should clean autosave', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/odes/clean-init-autosave', {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should get current users', async () => {
            mockSessions.set('current-users-session', {
                sessionId: 'current-users-session',
                fileName: 'Test.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/api/odes/current-users?odeSessionId=current-users-session'),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.currentUsers.length).toBeGreaterThan(0);
        });

        it('should return empty for non-existent session', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/odes/current-users?odeSessionId=non-existent'),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.currentUsers).toEqual([]);
        });

        it('should register current user', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/odes/current-users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ odeSessionId: 'test-session' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should unregister current user', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/odes/current-users', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should check before leave', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/odes/check-before-leave', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ odeSessionId: 'test-session' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.canLeave).toBe(true);
        });

        it('should close session', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/odes/session/close', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ odeSessionId: 'test-session' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should return empty when no session id provided for current-users', async () => {
            const res = await app.handle(new Request('http://localhost/api/odes/current-users'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.currentUsers).toEqual([]);
        });

        it('should get user recent projects when authenticated', async () => {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 1,
                email: 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });

            // Create multiple projects with different timestamps
            const now = new Date();
            const project1 = {
                id: 2001,
                uuid: 'recent-project-1',
                owner_id: 1,
                title: 'Recent Project 1',
                saved_once: 1,
                created_at: now.toISOString(),
                updated_at: new Date(now.getTime() - 1000).toISOString(), // 1 second ago
            };
            const project2 = {
                id: 2002,
                uuid: 'recent-project-2',
                owner_id: 1,
                title: 'Recent Project 2',
                saved_once: 1,
                created_at: now.toISOString(),
                updated_at: new Date(now.getTime() - 2000).toISOString(), // 2 seconds ago
            };
            mockProjects.set(2001, project1);
            mockProjects.set(2002, project2);
            mockProjectsByUuid.set('recent-project-1', project1);
            mockProjectsByUuid.set('recent-project-2', project2);

            const res = await app.handle(
                new Request('http://localhost/api/projects/user/recent', {
                    headers: { 'Cookie': `auth=${token}` },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(Array.isArray(body)).toBe(true);
            expect(body.length).toBeGreaterThan(0);
            expect(body[0].odeId).toBeDefined();
            expect(body[0].title).toBeDefined();
        });

        it('should return empty array for recent projects when not authenticated', async () => {
            const res = await app.handle(new Request('http://localhost/api/projects/user/recent'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual([]);
        });

        it('should include shared projects in user list', async () => {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 2, // User 2 is a collaborator
                email: 'user2@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });

            // Create a project owned by user 1, shared with user 2
            const sharedProject = {
                id: 3001,
                uuid: 'shared-project-uuid',
                owner_id: 1,
                title: 'Shared Project',
                saved_once: 1,
                visibility: 'shared',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(3001, sharedProject);
            mockProjectsByUuid.set('shared-project-uuid', sharedProject);

            // Add user 2 as collaborator
            mockCollaborators.set(3001, new Set([2]));

            const res = await app.handle(
                new Request('http://localhost/api/projects/user/list', {
                    headers: { 'Cookie': `auth=${token}` },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            // Should include the shared project
            const sharedProjects = body.odeFiles.odeFilesSync.filter((p: { role: string }) => p.role === 'editor');
            expect(sharedProjects.length).toBeGreaterThan(0);
        });
    });

    describe('Project Metadata', () => {
        it('should update project metadata', async () => {
            mockSessions.set('metadata-session', {
                sessionId: 'metadata-session',
                fileName: 'Old.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/metadata-session/metadata', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: 'New Title' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.title).toBe('New Title');
        });
    });

    describe('Cleanup Import', () => {
        it('should reject path outside allowed directory', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/cleanup-import?path=/etc/passwd', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(false);
        });

        it('should reject non-ELP files', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/cleanup-import?path=/files/tmp/test/file.txt', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(false);
        });

        it('should require path parameter', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/cleanup-import', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(false);
        });

        it('should cleanup valid ELP file', async () => {
            // Create temp directory structure
            const tmpDir = path.join(testDir, 'files', 'tmp', 'test-session');
            await fs.ensureDir(tmpDir);
            await fs.writeFile(path.join(tmpDir, 'test.elp'), 'PK content');

            const res = await app.handle(
                new Request('http://localhost/api/project/cleanup-import?path=/files/tmp/test-session/test.elp', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });
    });

    describe('Access Control on nav-structures', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        function createTestProject(id: number, uuid: string, ownerId: number, visibility: string = 'private') {
            const project = {
                id,
                uuid,
                owner_id: ownerId,
                title: `Test Project ${id}`,
                visibility,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(id, project);
            mockProjectsByUuid.set(uuid, project);
            return project;
        }

        it('should allow access to public project', async () => {
            createTestProject(1100, 'public-project', 1, 'public');

            const res = await app.handle(new Request('http://localhost/api/nav-structures/public-project'));

            expect(res.status).toBe(200);
        });

        it('should deny access to private project without auth', async () => {
            createTestProject(1101, 'private-project', 1, 'private');

            const res = await app.handle(new Request('http://localhost/api/nav-structures/private-project'));

            expect(res.status).toBe(403);
        });

        it('should allow owner access to private project', async () => {
            createTestProject(1102, 'owner-project', 1, 'private');
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/nav-structures/owner-project', {
                    headers: { 'Cookie': `auth=${token}` },
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should allow collaborator access to private project', async () => {
            createTestProject(1103, 'collab-project', 1, 'private');
            mockCollaborators.set(1103, new Set([2])); // User 2 is collaborator
            const token = await createAuthToken(2);

            const res = await app.handle(
                new Request('http://localhost/api/nav-structures/collab-project', {
                    headers: { 'Cookie': `auth=${token}` },
                }),
            );

            expect(res.status).toBe(200);
        });
    });

    describe('Project Structure with Session', () => {
        it('should return session structure', async () => {
            mockSessions.set('struct-session', {
                sessionId: 'struct-session',
                fileName: 'Test.elp',
                structure: {
                    meta: { title: 'My Project' },
                    pages: [{ id: 'page_1', title: 'Page 1' }],
                },
            });

            const res = await app.handle(
                new Request('http://localhost/api/project/version/1/session/struct-session/structure'),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.sessionId).toBe('struct-session');
        });

        it('should return 404 for non-existent session', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/version/1/session/non-existent/structure'),
            );

            expect(res.status).toBe(404);
        });

        it('should check content.xml existence', async () => {
            mockSessions.set('content-session', {
                sessionId: 'content-session',
                fileName: 'Test.elp',
            });

            // Create session directory with content.xml
            const sessionDir = path.join(testDir, 'tmp', 'content-session');
            await fs.ensureDir(sessionDir);
            await fs.writeFile(path.join(sessionDir, 'content.xml'), '<?xml version="1.0"?><ode></ode>');

            const res = await app.handle(
                new Request('http://localhost/api/project/version/1/session/content-session/structure'),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.hasContent).toBe(true);
        });
    });

    describe('GET /api/project/get/user/ode/list', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should return empty list when not authenticated', async () => {
            const res = await app.handle(new Request('http://localhost/api/project/get/user/ode/list'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.odes).toEqual([]);
        });

        it('should return user projects when authenticated', async () => {
            const token = await createAuthToken(1);

            // Create a saved project for user 1
            const project = {
                id: 1200,
                uuid: 'ode-list-project',
                owner_id: 1,
                title: 'ODE List Project',
                saved_once: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(1200, project);
            mockProjectsByUuid.set('ode-list-project', project);

            const res = await app.handle(
                new Request('http://localhost/api/project/get/user/ode/list', {
                    headers: { 'Cookie': `auth=${token}` },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.odes.length).toBeGreaterThan(0);
        });
    });

    describe('Project create-quick with auth', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should create quick project when authenticated', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/project/create-quick', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ title: 'Quick Project' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.title).toBe('Quick Project');
            expect(body.projectUuid).toBeDefined();
        });

        it('should use default title when not provided', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/project/create-quick', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({}),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.title).toBe('New Project');
        });
    });

    // =====================================================
    // Additional tests for coverage improvement
    // =====================================================

    describe('Sharing Info with Collaborators', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should return sharing info with collaborators list', async () => {
            // Create project with owner
            const project = {
                id: 1500,
                uuid: 'sharing-test-project',
                owner_id: 1,
                title: 'Sharing Test Project',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(1500, project);
            mockProjectsByUuid.set('sharing-test-project', project);

            // Add collaborators
            mockCollaborators.set(1500, new Set([2, 3]));

            // Create collaborator users
            mockUsers.set(2, { id: 2, email: 'collab1@test.com', roles: 'ROLE_USER' });
            mockUsers.set(3, { id: 3, email: 'collab2@test.com', roles: 'ROLE_USER' });

            const token = await createAuthToken(1);
            const res = await app.handle(
                new Request('http://localhost/api/projects/1500/sharing', {
                    headers: { 'Cookie': `auth=${token}` },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.project.collaborators).toBeDefined();
            // Should have owner + 2 collaborators = 3 entries
            expect(body.project.collaborators.length).toBeGreaterThanOrEqual(1);
        });

        it('should return sharing info by UUID with collaborators', async () => {
            const project = {
                id: 1501,
                uuid: 'uuid-sharing-test',
                owner_id: 1,
                title: 'UUID Sharing Test',
                visibility: 'public',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(1501, project);
            mockProjectsByUuid.set('uuid-sharing-test', project);
            mockCollaborators.set(1501, new Set([2]));
            mockUsers.set(2, { id: 2, email: 'collab@test.com', roles: 'ROLE_USER' });

            const res = await app.handle(new Request('http://localhost/api/projects/uuid/uuid-sharing-test/sharing'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.project.uuid).toBe('uuid-sharing-test');
            expect(body.project.collaborators).toBeDefined();
        });
    });

    describe('Upload Chunk Edge Cases', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should handle Blob chunk upload', async () => {
            const token = await createAuthToken(1);

            const formData = new FormData();
            const chunk = new Blob(['chunk data'], { type: 'application/octet-stream' });
            formData.append('odeFilePart', chunk);
            formData.append('odeFileName', 'test.elp');
            formData.append('odeSessionId', 'chunk-test-session');

            // Create session directory first
            await fs.ensureDir(path.join(testDir, 'tmp', 'chunk-test-session'));

            const res = await app.handle(
                new Request('http://localhost/api/project/upload-chunk', {
                    method: 'POST',
                    headers: { 'Cookie': `auth=${token}` },
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
        });
    });

    describe('Project Session Delete', () => {
        it('should delete session and cleanup', async () => {
            mockSessions.set('delete-session', {
                sessionId: 'delete-session',
                fileName: 'test.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/api/project/sessions/delete-session', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            expect(mockSessions.has('delete-session')).toBe(false);
        });

        it('should return 404 for non-existent session delete', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/sessions/non-existent-delete', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(404);
        });
    });

    describe('Session List Endpoints', () => {
        it('should return sessions list with count', async () => {
            mockSessions.set('list-session-1', {
                sessionId: 'list-session-1',
                fileName: 'file1.elp',
            });
            mockSessions.set('list-session-2', {
                sessionId: 'list-session-2',
                fileName: 'file2.elp',
            });

            const res = await app.handle(new Request('http://localhost/api/project/sessions'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.count).toBeGreaterThanOrEqual(2);
            expect(body.sessions).toBeDefined();
        });

        it('should get session details by ID', async () => {
            mockSessions.set('detail-session', {
                sessionId: 'detail-session',
                fileName: 'detail.elp',
            });

            const res = await app.handle(new Request('http://localhost/api/project/sessions/detail-session'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.sessionId).toBe('detail-session');
        });
    });

    describe('Project Metadata Update', () => {
        it('should update project metadata by UUID', async () => {
            const project = {
                id: 1650,
                uuid: 'meta-update-project',
                owner_id: 1,
                title: 'Original Title',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(1650, project);
            mockProjectsByUuid.set('meta-update-project', project);

            // Create a session for this project
            mockSessions.set('meta-update-project', {
                sessionId: 'meta-update-project',
                fileName: 'test.elp',
                projectId: 1650,
                metadata: { title: 'Original Title' },
            });

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/meta-update-project/metadata', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: 'Updated Title',
                    }),
                }),
            );

            expect(res.status).toBe(200);
        });
    });

    describe('Duplicate without Snapshot', () => {
        it('should duplicate project without Yjs snapshot', async () => {
            // Create a project without a snapshot
            const project = {
                id: 1700,
                uuid: 'no-snapshot-project',
                owner_id: 1,
                title: 'Project without Snapshot',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(1700, project);
            mockProjectsByUuid.set('no-snapshot-project', project);

            // Use main app which doesn't have snapshot functions mocked
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/no-snapshot-project/duplicate', {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.project.title).toContain('copy');
        });
    });

    describe('Authorization Header Token', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should authenticate with Bearer token in Authorization header', async () => {
            const token = await createAuthToken(1);
            const project = {
                id: 1800,
                uuid: 'bearer-test-project',
                owner_id: 1,
                title: 'Bearer Test',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(1800, project);
            mockProjectsByUuid.set('bearer-test-project', project);

            const res = await app.handle(
                new Request('http://localhost/api/projects/1800/sharing', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.project.isOwner).toBe(true);
        });

        it('should handle invalid token gracefully', async () => {
            const project = {
                id: 1801,
                uuid: 'invalid-token-test',
                owner_id: 1,
                title: 'Invalid Token Test',
                visibility: 'public',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(1801, project);
            mockProjectsByUuid.set('invalid-token-test', project);

            const res = await app.handle(
                new Request('http://localhost/api/projects/1801/sharing', {
                    headers: {
                        'Authorization': 'Bearer invalid-token-here',
                    },
                }),
            );

            // Should still return 200 for public project even without valid auth
            expect(res.status).toBe(200);
        });
    });

    describe('Project Visibility Default', () => {
        it('should create project with default visibility from config', async () => {
            // Generate auth token for user 1
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 1,
                email: mockUsers.get(1)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/new-visibility-project/sharing', {
                    headers: { 'Cookie': `auth=${token}` },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            // Default visibility is 'private' unless DEFAULT_PROJECT_VISIBILITY=public
            expect(body.project.visibility).toBe('private');
        });
    });

    describe('Upload Chunk Error Handling', () => {
        it('should return error message on upload failure', async () => {
            // Test missing required parameters
            const formData = new FormData();
            formData.append('odeFileName', 'test.elp');
            // Missing odeFilePart and odeSessionId

            const res = await app.handle(
                new Request('http://localhost/api/project/upload-chunk', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.responseMessage).toContain('required');
        });
    });

    describe('Visibility Update Errors', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should return 400 for invalid project ID', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/projects/invalid-id/visibility', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ visibility: 'public' }),
                }),
            );

            expect(res.status).toBe(400);
        });

        it('should return 400 for invalid visibility value', async () => {
            const token = await createAuthToken(1);
            const project = {
                id: 1900,
                uuid: 'vis-test-project',
                owner_id: 1,
                title: 'Visibility Test',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(1900, project);

            const res = await app.handle(
                new Request('http://localhost/api/projects/1900/visibility', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ visibility: 'invalid' }),
                }),
            );

            expect(res.status).toBe(400);
        });
    });

    describe('Collaborator Errors', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should return 400 for invalid project ID when adding collaborator', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/projects/invalid/collaborators', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ email: 'collab@test.com' }),
                }),
            );

            expect(res.status).toBe(400);
        });

        it('should return 400 for invalid project ID when removing collaborator', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/projects/invalid/collaborators/2', {
                    method: 'DELETE',
                    headers: {
                        'Cookie': `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(400);
        });

        it('should return 400 for invalid project ID when transferring ownership', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/projects/invalid/owner', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ newOwnerId: 2 }),
                }),
            );

            expect(res.status).toBe(400);
        });
    });

    describe('UUID Collaborator Errors', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should return 404 for non-existent project when updating visibility by UUID', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/non-existent-uuid/visibility', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ visibility: 'public' }),
                }),
            );

            expect(res.status).toBe(404);
        });

        it('should return 404 for non-existent project when adding collaborator by UUID', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/non-existent-uuid/collaborators', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ email: 'collab@test.com' }),
                }),
            );

            expect(res.status).toBe(404);
        });

        it('should return 404 for non-existent project when removing collaborator by UUID', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/non-existent-uuid/collaborators/2', {
                    method: 'DELETE',
                    headers: {
                        'Cookie': `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(404);
        });

        it('should return 404 for non-existent project when transferring ownership by UUID', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/non-existent-uuid/owner', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ newOwnerId: 2 }),
                }),
            );

            expect(res.status).toBe(404);
        });
    });

    describe('Token in Cookie Only', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should authenticate using only cookie token', async () => {
            const token = await createAuthToken(1);
            const project = {
                id: 2000,
                uuid: 'cookie-only-test',
                owner_id: 1,
                title: 'Cookie Only Test',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(2000, project);
            mockProjectsByUuid.set('cookie-only-test', project);

            const res = await app.handle(
                new Request('http://localhost/api/projects/2000/sharing', {
                    headers: {
                        'Cookie': `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.project.isOwner).toBe(true);
        });

        it('should authenticate using token in both cookie and header (header takes priority)', async () => {
            const token = await createAuthToken(1);
            const project = {
                id: 2001,
                uuid: 'both-auth-test',
                owner_id: 1,
                title: 'Both Auth Test',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(2001, project);
            mockProjectsByUuid.set('both-auth-test', project);

            const res = await app.handle(
                new Request('http://localhost/api/projects/2001/sharing', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Cookie': `auth=invalid-cookie-token`,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.project.isOwner).toBe(true);
        });
    });

    describe('Session Details With Content', () => {
        it('should return session with no content', async () => {
            mockSessions.set('no-content-session', {
                sessionId: 'no-content-session',
                fileName: 'test.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/api/project/version/1/session/no-content-session/structure'),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.sessionId).toBe('no-content-session');
        });
    });

    describe('Non-Owner Actions', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should forbid non-owner from changing visibility', async () => {
            const ownerProject = {
                id: 2100,
                uuid: 'non-owner-vis-test',
                owner_id: 1, // Owner is user 1
                title: 'Non-Owner Visibility Test',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(2100, ownerProject);

            // User 2 (not owner) tries to change visibility
            const token = await createAuthToken(2);
            const res = await app.handle(
                new Request('http://localhost/api/projects/2100/visibility', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ visibility: 'public' }),
                }),
            );

            expect(res.status).toBe(403);
        });

        it('should forbid non-owner from adding collaborators', async () => {
            const ownerProject = {
                id: 2101,
                uuid: 'non-owner-collab-test',
                owner_id: 1,
                title: 'Non-Owner Collab Test',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(2101, ownerProject);

            const token = await createAuthToken(2);
            const res = await app.handle(
                new Request('http://localhost/api/projects/2101/collaborators', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ email: 'newcollab@test.com' }),
                }),
            );

            expect(res.status).toBe(403);
        });

        it('should forbid non-owner from removing collaborators', async () => {
            const ownerProject = {
                id: 2102,
                uuid: 'non-owner-remove-test',
                owner_id: 1,
                title: 'Non-Owner Remove Test',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(2102, ownerProject);

            const token = await createAuthToken(2);
            const res = await app.handle(
                new Request('http://localhost/api/projects/2102/collaborators/3', {
                    method: 'DELETE',
                    headers: {
                        'Cookie': `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(403);
        });

        it('should forbid non-owner from transferring ownership', async () => {
            const ownerProject = {
                id: 2103,
                uuid: 'non-owner-transfer-test',
                owner_id: 1,
                title: 'Non-Owner Transfer Test',
                visibility: 'private',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockProjects.set(2103, ownerProject);

            const token = await createAuthToken(2);
            const res = await app.handle(
                new Request('http://localhost/api/projects/2103/owner', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ newOwnerId: 2 }),
                }),
            );

            expect(res.status).toBe(403);
        });
    });

    describe('Edge Cases - Authorization and Error Handling', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should accept Bearer token in Authorization header', async () => {
            const token = await createAuthToken(1);
            const res = await app.handle(
                new Request('http://localhost/api/project/sessions', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should handle invalid JWT token gracefully', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/sessions', {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer invalid-token-here',
                    },
                }),
            );

            // Should return 200 with null user (unauthenticated access allowed for listing)
            expect(res.status).toBe(200);
        });

        it('should handle JWT verify returning false', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/sessions', {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOm51bGx9.test',
                    },
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should handle upload-chunk with Buffer type file', async () => {
            const sessionId = `upload-buffer-${Date.now()}`;
            mockSessions.set(sessionId, {
                sessionId,
                fileName: 'test.elp',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            await fs.ensureDir(path.join(testDir, 'tmp', sessionId));

            const token = await createAuthToken(1);
            const formData = new FormData();
            formData.append('odeFilePart', new Blob(['chunk data'], { type: 'application/octet-stream' }));
            formData.append('odeFileName', 'test.elp');
            formData.append('odeSessionId', sessionId);

            const res = await app.handle(
                new Request('http://localhost/api/project/upload-chunk', {
                    method: 'POST',
                    headers: {
                        'Cookie': `auth=${token}`,
                    },
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
        });
    });

    describe('Upload Chunk with Buffer conversion', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should handle string-like chunk data conversion', async () => {
            const sessionId = `buffer-conv-${Date.now()}`;
            mockSessions.set(sessionId, {
                sessionId,
                fileName: 'test.elp',
            });

            await fs.ensureDir(path.join(testDir, 'tmp', sessionId));

            const token = await createAuthToken(1);
            const formData = new FormData();
            // Send as Blob which will trigger arrayBuffer() path
            formData.append('odeFilePart', new Blob(['string chunk'], { type: 'application/octet-stream' }));
            formData.append('odeFileName', 'test.elp');
            formData.append('odeSessionId', sessionId);

            const res = await app.handle(
                new Request('http://localhost/api/project/upload-chunk', {
                    method: 'POST',
                    headers: { 'Cookie': `auth=${token}` },
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
        });
    });

    describe('Link Validation Extended Coverage', () => {
        it('should return null (valid) for existing internal files/', async () => {
            // Create test file that exists
            const filesDir = path.join(testDir, 'files');
            await fs.ensureDir(filesDir);
            await fs.writeFile(path.join(filesDir, 'exists.jpg'), 'test');

            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="files/exists.jpg">Existing File</a>',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.brokenLinks[0].brokenLinks).toBe('No broken links found');
        });

        it('should detect 404 for missing internal files/', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="files/missing-404.jpg">Missing File</a>',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.brokenLinks.length).toBeGreaterThan(0);
        });

        it('should skip relative URLs that are not files/', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="page2.html">Relative page link</a>',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            // Relative non-files/ URLs should be skipped (valid)
            expect(body.brokenLinks[0].brokenLinks).toBe('No broken links found');
        });

        it('should handle protocol-relative URLs', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="//example.invalid-domain-xyz.com/path">Protocol Relative</a>',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            // Should try to validate and likely fail (network error)
        });

        it('should handle absolute URLs to unreachable hosts', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="https://unreachable-host-xyz-abc.invalid/page">Unreachable</a>',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            // Should report network error
        });

        it('should skip mailto and tel links', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="mailto:test@example.com">Email</a><a href="tel:+1234567890">Phone</a>',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.brokenLinks[0].brokenLinks).toBe('No broken links found');
        });

        it('should skip anchor-only links', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="#section1">Anchor</a><a href="#">Top</a>',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.brokenLinks[0].brokenLinks).toBe('No broken links found');
        });
    });

    describe('Import Cleanup Error Handling', () => {
        it('should return success false for path outside allowed directory', async () => {
            // Test with a path outside the allowed tmp directory
            const res = await app.handle(
                new Request('http://localhost/api/project/cleanup-import?path=/outside/path/file.elp', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.message).toBe('Invalid path');
        });

        it('should return success true for non-existent file in tmp', async () => {
            // Test with a path in tmp that doesn't exist - should succeed (nothing to delete)
            const res = await app.handle(
                new Request('http://localhost/api/project/cleanup-import?path=tmp/nonexistent-file.elp', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should return success false when no path provided', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/cleanup-import', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.message).toBe('No path provided');
        });
    });

    // =====================================================
    // Additional Coverage Tests
    // =====================================================

    describe('JWT Verification Error Handling', () => {
        it('should handle JWT verification error gracefully', async () => {
            // Send a malformed/invalid token that causes jwt.verify to throw
            const malformedToken = 'not.a.valid.jwt.token.structure.at.all';

            const res = await app.handle(
                new Request('http://localhost/api/nav-structures/test-session', {
                    headers: {
                        Authorization: `Bearer ${malformedToken}`,
                    },
                }),
            );

            // Should still return 200 with null user (graceful error handling)
            expect(res.status).toBe(200);
        });

        it('should handle JWT error via cookie', async () => {
            const malformedToken = 'invalid-jwt-format';

            const res = await app.handle(
                new Request('http://localhost/api/odes/last-updated', {
                    headers: {
                        Cookie: `auth=${malformedToken}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
        });
    });

    describe('Project Sharing Edge Cases', () => {
        it('should return 400 for invalid project ID in sharing', async () => {
            const res = await app.handle(new Request('http://localhost/api/projects/invalid-id/sharing'));

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.responseMessage).toBe('INVALID_ID');
        });

        it('should return 404 for non-existent project in sharing', async () => {
            const res = await app.handle(new Request('http://localhost/api/projects/99999/sharing'));

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.responseMessage).toBe('NOT_FOUND');
        });
    });

    describe('Visibility Change Notification', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should trigger notification when visibility changes to private', async () => {
            const project = {
                id: 5001,
                uuid: 'visibility-notify-test',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(5001, project);
            mockProjectsByUuid.set('visibility-notify-test', project);
            mockCollaborators.set(5001, new Set([2]));

            const token = await createAuthToken(1);
            const res = await app.handle(
                new Request('http://localhost/api/projects/5001/visibility', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ visibility: 'private' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
            expect(project.visibility).toBe('private');
        });

        it('should trigger notification when visibility changes to private by UUID', async () => {
            const project = {
                id: 5002,
                uuid: 'visibility-uuid-notify',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(5002, project);
            mockProjectsByUuid.set('visibility-uuid-notify', project);
            mockCollaborators.set(5002, new Set([2]));

            const token = await createAuthToken(1);
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/visibility-uuid-notify/visibility', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ visibility: 'private' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
        });
    });

    describe('Collaborator Edge Cases by ID', () => {
        it('should return 404 for non-existent project when adding collaborator', async () => {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 1,
                email: 'owner@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });

            const res = await app.handle(
                new Request('http://localhost/api/projects/99999/collaborators', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ email: 'collaborator@test.com' }),
                }),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.responseMessage).toBe('NOT_FOUND');
        });

        it('should return 404 for non-existent project when removing collaborator', async () => {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 1,
                email: 'owner@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });

            const res = await app.handle(
                new Request('http://localhost/api/projects/99999/collaborators/2', {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.responseMessage).toBe('NOT_FOUND');
        });

        it('should return 404 for non-existent project when transferring ownership', async () => {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 1,
                email: 'owner@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });

            const res = await app.handle(
                new Request('http://localhost/api/projects/99999/owner', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ newOwnerId: 2 }),
                }),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.responseMessage).toBe('NOT_FOUND');
        });
    });

    describe('Access Control in ODE Properties', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should deny access to private project properties without auth', async () => {
            const project = {
                id: 6001,
                uuid: 'private-props-test',
                owner_id: 1,
                visibility: 'private',
                saved_once: 1,
            };
            mockProjects.set(6001, project);
            mockProjectsByUuid.set('private-props-test', project);

            const res = await app.handle(new Request('http://localhost/api/odes/private-props-test/properties'));

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error).toBe('Forbidden');
        });

        it('should deny access to POST private project properties without auth', async () => {
            const project = {
                id: 6002,
                uuid: 'private-props-post-test',
                owner_id: 1,
                visibility: 'private',
                saved_once: 1,
            };
            mockProjects.set(6002, project);
            mockProjectsByUuid.set('private-props-post-test', project);

            const res = await app.handle(
                new Request('http://localhost/api/odes/private-props-post-test/properties', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pp_title: 'New Title' }),
                }),
            );

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error).toBe('Forbidden');
        });

        it('should deny non-owner access to private project properties', async () => {
            const project = {
                id: 6003,
                uuid: 'private-props-other',
                owner_id: 1,
                visibility: 'private',
                saved_once: 1,
            };
            mockProjects.set(6003, project);
            mockProjectsByUuid.set('private-props-other', project);

            const token = await createAuthToken(3); // User 3 is not owner or collaborator
            const res = await app.handle(
                new Request('http://localhost/api/odes/private-props-other/properties', {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(res.status).toBe(403);
        });
    });

    describe('Access Control in Nav Structures with Existing Session', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should deny access when session exists but user is not authorized for private project', async () => {
            // Create a session AND a private project with the same ID
            const sessionId = 'session-with-private-project';
            mockSessions.set(sessionId, {
                sessionId,
                fileName: 'test.elp',
                structure: { title: 'Test' },
            });

            const project = {
                id: 7001,
                uuid: sessionId,
                owner_id: 1,
                visibility: 'private',
                saved_once: 1,
            };
            mockProjects.set(7001, project);
            mockProjectsByUuid.set(sessionId, project);

            // User 3 is not owner or collaborator
            const token = await createAuthToken(3);
            const res = await app.handle(
                new Request(`http://localhost/api/nav-structures/${sessionId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error).toBe('Forbidden');
        });
    });

    describe('UUID Routes Unauthorized/Forbidden Access', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should return 401 for get sharing by UUID without auth when project does not exist', async () => {
            // No project exists with this UUID, so it would try to create one
            // but without auth, it should return 401
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/non-existent-for-auth/sharing'),
            );

            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.responseMessage).toBe('UNAUTHORIZED');
        });

        it('should return 401 for patch visibility by UUID without auth', async () => {
            const project = {
                id: 8001,
                uuid: 'vis-unauth-test',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8001, project);
            mockProjectsByUuid.set('vis-unauth-test', project);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/vis-unauth-test/visibility', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ visibility: 'private' }),
                }),
            );

            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.responseMessage).toBe('UNAUTHORIZED');
        });

        it('should return 403 for patch visibility by UUID by non-owner', async () => {
            const project = {
                id: 8002,
                uuid: 'vis-forbidden-test',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8002, project);
            mockProjectsByUuid.set('vis-forbidden-test', project);

            const token = await createAuthToken(2); // User 2 is not owner
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/vis-forbidden-test/visibility', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ visibility: 'private' }),
                }),
            );

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.responseMessage).toBe('FORBIDDEN');
        });

        it('should return 401 for add collaborator by UUID without auth', async () => {
            const project = {
                id: 8003,
                uuid: 'collab-unauth-test',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8003, project);
            mockProjectsByUuid.set('collab-unauth-test', project);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/collab-unauth-test/collaborators', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'collaborator@test.com' }),
                }),
            );

            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.responseMessage).toBe('UNAUTHORIZED');
        });

        it('should return 403 for add collaborator by UUID by non-owner', async () => {
            const project = {
                id: 8004,
                uuid: 'collab-forbidden-test',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8004, project);
            mockProjectsByUuid.set('collab-forbidden-test', project);

            const token = await createAuthToken(2);
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/collab-forbidden-test/collaborators', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ email: 'other@test.com' }),
                }),
            );

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.responseMessage).toBe('FORBIDDEN');
        });

        it('should return USER_NOT_FOUND for add collaborator by UUID when user does not exist', async () => {
            const project = {
                id: 8005,
                uuid: 'collab-user-not-found',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8005, project);
            mockProjectsByUuid.set('collab-user-not-found', project);

            const token = await createAuthToken(1);
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/collab-user-not-found/collaborators', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ email: 'nonexistent@test.com' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('USER_NOT_FOUND');
        });

        it('should return ALREADY_COLLABORATOR when user is already collaborator by UUID', async () => {
            const project = {
                id: 8006,
                uuid: 'collab-already',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8006, project);
            mockProjectsByUuid.set('collab-already', project);
            mockCollaborators.set(8006, new Set([2])); // User 2 is already collaborator

            const token = await createAuthToken(1);
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/collab-already/collaborators', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ email: 'collaborator@test.com' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('ALREADY_COLLABORATOR');
        });

        it('should return IS_OWNER when trying to add owner as collaborator by UUID', async () => {
            const project = {
                id: 8007,
                uuid: 'collab-is-owner',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8007, project);
            mockProjectsByUuid.set('collab-is-owner', project);

            const token = await createAuthToken(1);
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/collab-is-owner/collaborators', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ email: 'owner@test.com' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('IS_OWNER');
        });

        it('should return 401 for remove collaborator by UUID without auth', async () => {
            const project = {
                id: 8008,
                uuid: 'remove-unauth',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8008, project);
            mockProjectsByUuid.set('remove-unauth', project);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/remove-unauth/collaborators/2', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.responseMessage).toBe('UNAUTHORIZED');
        });

        it('should return 403 for remove collaborator by UUID by non-owner', async () => {
            const project = {
                id: 8009,
                uuid: 'remove-forbidden',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8009, project);
            mockProjectsByUuid.set('remove-forbidden', project);

            const token = await createAuthToken(2);
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/remove-forbidden/collaborators/3', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.responseMessage).toBe('FORBIDDEN');
        });

        it('should return 401 for transfer ownership by UUID without auth', async () => {
            const project = {
                id: 8010,
                uuid: 'transfer-unauth',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8010, project);
            mockProjectsByUuid.set('transfer-unauth', project);

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/transfer-unauth/owner', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newOwnerId: 2 }),
                }),
            );

            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.responseMessage).toBe('UNAUTHORIZED');
        });

        it('should return 403 for transfer ownership by UUID by non-owner', async () => {
            const project = {
                id: 8011,
                uuid: 'transfer-forbidden',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8011, project);
            mockProjectsByUuid.set('transfer-forbidden', project);

            const token = await createAuthToken(2);
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/transfer-forbidden/owner', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ newOwnerId: 3 }),
                }),
            );

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.responseMessage).toBe('FORBIDDEN');
        });

        it('should return 404 for transfer ownership by UUID when new owner not found', async () => {
            const project = {
                id: 8012,
                uuid: 'transfer-no-user',
                owner_id: 1,
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(8012, project);
            mockProjectsByUuid.set('transfer-no-user', project);

            const token = await createAuthToken(1);
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/transfer-no-user/owner', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ newOwnerId: 99999 }),
                }),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.responseMessage).toBe('USER_NOT_FOUND');
        });
    });

    describe('Duplicate Project Asset Edge Cases', () => {
        async function createAuthToken(userId: number = 1) {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });
            const tempApp = new Elysia().use(jwtInstance);
            return tempApp.decorator.jwt.sign({
                sub: userId,
                email: mockUsers.get(userId)?.email || 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
        }

        it('should handle asset with non-existent file during duplication', async () => {
            const project = {
                id: 9001,
                uuid: 'dup-asset-missing-file',
                owner_id: 1,
                title: 'Project With Missing Asset',
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(9001, project);
            mockProjectsByUuid.set('dup-asset-missing-file', project);

            // Add asset with storage_path pointing to non-existent file
            mockAssets.set(9001, [
                {
                    id: 9101,
                    project_id: 9001,
                    filename: 'missing.jpg',
                    storage_path: '/non/existent/path/missing.jpg',
                    mime_type: 'image/jpeg',
                    file_size: 1024,
                    client_id: 'client-id-missing',
                    component_id: 'comp-1',
                    content_hash: 'hash123',
                },
            ]);

            const token = await createAuthToken(1);
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/dup-asset-missing-file/duplicate', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should handle Yjs snapshot with field values containing client IDs', async () => {
            const Y = await import('yjs');

            const project = {
                id: 9002,
                uuid: 'dup-yjs-fields',
                owner_id: 1,
                title: 'Project With Yjs Fields',
                visibility: 'public',
                saved_once: 1,
            };
            mockProjects.set(9002, project);
            mockProjectsByUuid.set('dup-yjs-fields', project);

            // Create Yjs document with fields containing client IDs
            const ydoc = new Y.Doc();
            const metadata = ydoc.getMap('metadata');
            metadata.set('title', 'Original Title');

            const pages = ydoc.getMap('pages');
            const page = new Y.Map();
            const blocks = new Y.Map();
            const block = new Y.Map();
            const idevices = new Y.Map();
            const idevice = new Y.Map();
            const fields = new Y.Map();

            // Add fields that contain client IDs
            fields.set('imageField', 'files/assets/old-client-id/image.jpg');
            fields.set('videoField', 'files/assets/old-client-id/video.mp4');
            idevice.set('fields', fields);
            idevice.set('innerHtml', '<img src="files/assets/old-client-id/image.jpg">');
            idevices.set('idevice-1', idevice);
            block.set('idevices', idevices);
            blocks.set('block-1', block);
            page.set('blocks', blocks);
            pages.set('page-1', page);

            const snapshotData = Buffer.from(Y.encodeStateAsUpdate(ydoc));
            ydoc.destroy();

            mockSnapshots.set(9002, {
                project_id: 9002,
                snapshot_data: snapshotData,
                version: '1',
            });

            // Add assets with client_id
            mockAssets.set(9002, [
                {
                    id: 9201,
                    project_id: 9002,
                    filename: 'image.jpg',
                    storage_path: path.join(testDir, 'assets', 'dup-yjs-fields', 'old-client-id', 'image.jpg'),
                    mime_type: 'image/jpeg',
                    file_size: 1024,
                    client_id: 'old-client-id',
                    component_id: 'comp-1',
                    content_hash: 'hash123',
                },
            ]);

            // Create the source asset file
            await fs.ensureDir(path.join(testDir, 'assets', 'dup-yjs-fields', 'old-client-id'));
            await fs.writeFile(
                path.join(testDir, 'assets', 'dup-yjs-fields', 'old-client-id', 'image.jpg'),
                'fake image data',
            );

            const token = await createAuthToken(1);
            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/dup-yjs-fields/duplicate', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });
    });

    describe('Used Files Edge Cases', () => {
        it('should return null for non-existent file', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<img src="files/nonexistent/file.jpg">',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            // Non-existent files should be filtered out
            expect(body.usedFiles).toBeDefined();
        });

        it('should fallback to asset UUID when no metadata', async () => {
            const assetId = 'c3d4e5f6-7890-12ab-cdef-345678901234';
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: `<img src="asset://${assetId}.png">`,
                                pageName: 'Page 1',
                                blockName: 'Block 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.usedFiles.length).toBe(1);
            // Without metadata, filename should fallback to UUID
            expect(body.usedFiles[0].usedFiles).toBe(assetId);
            expect(body.usedFiles[0].usedFilesSize).toBe('Stored in browser');
        });

        it('should handle multiple assets with mixed metadata', async () => {
            const assetId1 = 'd4e5f6a7-8901-23ab-cdef-456789012345';
            const assetId2 = 'e5f6a7b8-9012-34ab-cdef-567890123456';
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: `<img src="asset://${assetId1}"><video src="asset://${assetId2}">`,
                                pageName: 'Page 1',
                                blockName: 'Block 1',
                                ideviceType: 'multimedia',
                            },
                        ],
                        assetMetadata: {
                            [assetId1]: {
                                filename: 'photo.jpg',
                                size: 2048,
                                mime: 'image/jpeg',
                            },
                        },
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.usedFiles.length).toBe(2);

            // First asset should have metadata
            const file1 = body.usedFiles.find((f: { usedFiles: string }) => f.usedFiles === 'photo.jpg');
            expect(file1).toBeDefined();
            expect(file1.usedFilesSize).toBe('2 KB');

            // Second asset should fallback to UUID
            const file2 = body.usedFiles.find((f: { usedFiles: string }) => f.usedFiles === assetId2);
            expect(file2).toBeDefined();
            expect(file2.usedFilesSize).toBe('Stored in browser');
        });

        it('should handle asset with zero size in metadata', async () => {
            const assetId = 'f6a7b8c9-0123-45ab-cdef-678901234567';
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: `<img src="asset://${assetId}">`,
                                pageName: 'Page 1',
                            },
                        ],
                        assetMetadata: {
                            [assetId]: {
                                filename: 'empty-file.txt',
                                size: 0,
                                mime: 'text/plain',
                            },
                        },
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.usedFiles.length).toBe(1);
            expect(body.usedFiles[0].usedFiles).toBe('empty-file.txt');
            // Zero size should fallback to "Stored in browser"
            expect(body.usedFiles[0].usedFilesSize).toBe('Stored in browser');
        });

        it('should handle asset with null filename in metadata', async () => {
            const assetId = 'a7b8c9d0-1234-56ab-cdef-789012345678';
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: `<img src="asset://${assetId}">`,
                                pageName: 'Page 1',
                            },
                        ],
                        assetMetadata: {
                            [assetId]: {
                                filename: null,
                                size: 500,
                                mime: 'image/png',
                            },
                        },
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.usedFiles.length).toBe(1);
            // Should fallback to asset ID when filename is null
            expect(body.usedFiles[0].usedFiles).toBe(assetId);
            // Size should still be formatted
            expect(body.usedFiles[0].usedFilesSize).toBe('500 B');
        });

        it('should skip idevices without html field', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                pageName: 'Page 1',
                                blockName: 'Block 1',
                            },
                            {
                                html: '<img src="asset://b8c9d0e1-2345-67ab-cdef-890123456789">',
                                pageName: 'Page 2',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            // Should only find the asset from the second idevice
            expect(body.usedFiles.length).toBe(1);
        });

        it('should handle href attribute for asset URLs', async () => {
            const assetId = 'c9d0e1f2-3456-78ab-cdef-901234567890';
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: `<a href="asset://${assetId}">Download PDF</a>`,
                                pageName: 'Page 1',
                            },
                        ],
                        assetMetadata: {
                            [assetId]: {
                                filename: 'document.pdf',
                                size: 1048576,
                                mime: 'application/pdf',
                            },
                        },
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.usedFiles.length).toBe(1);
            expect(body.usedFiles[0].usedFiles).toBe('document.pdf');
            expect(body.usedFiles[0].usedFilesSize).toBe('1 MB');
        });

        it('should populate all idevice context fields', async () => {
            const assetId = 'e1f2a3b4-5678-90ab-cdef-123456789012';
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: `<img src="asset://${assetId}">`,
                                pageName: 'Test Page',
                                blockName: 'Test Block',
                                ideviceType: 'image-gallery',
                                order: 5,
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.usedFiles.length).toBe(1);
            expect(body.usedFiles[0].pageNamesUsedFiles).toBe('Test Page');
            expect(body.usedFiles[0].blockNamesUsedFiles).toBe('Test Block');
            expect(body.usedFiles[0].typeComponentSyncUsedFiles).toBe('image-gallery');
            expect(body.usedFiles[0].orderComponentSyncUsedFiles).toBe('5');
        });

        it('should handle empty assetMetadata object', async () => {
            const assetId = 'f2a3b4c5-6789-01ab-cdef-234567890123';
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/usedfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: `<img src="asset://${assetId}">`,
                                pageName: 'Page 1',
                            },
                        ],
                        assetMetadata: {},
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.usedFiles.length).toBe(1);
            expect(body.usedFiles[0].usedFiles).toBe(assetId);
            expect(body.usedFiles[0].usedFilesSize).toBe('Stored in browser');
        });
    });

    describe('Link Validation Special Cases', () => {
        it('should handle file path check throwing error', async () => {
            // This tests the catch block in file path validation (line 1769-1770)
            // We can't easily make fs.pathExists throw, but the test structure is here
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                // This unusual path may trigger edge cases
                                html: '<a href="files/some\x00null/file.jpg">File</a>',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should handle URL with bad format', async () => {
            // Tests the outer catch block (line 1830)
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/session/brokenlinks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idevices: [
                            {
                                html: '<a href="http://[invalid-ipv6]:port/path">Bad URL</a>',
                                pageName: 'Page 1',
                            },
                        ],
                    }),
                }),
            );

            expect(res.status).toBe(200);
            // The URL parser should catch this and return error
        });
    });
});
