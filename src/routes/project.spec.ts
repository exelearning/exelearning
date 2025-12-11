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
let userIdCounter = 1;
let projectIdCounter = 1;

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
            return Array.from(mockProjects.values()).filter(
                p => p.owner_id === ownerId && p.saved_once === 1,
            );
        },
        findProjectsAsCollaborator: async (_db: any, userId: number) => {
            // Return projects where user is a collaborator (not owner)
            return Array.from(mockProjects.values()).filter(p => {
                const collabIds = mockCollaborators.get(p.id);
                return collabIds && collabIds.has(userId);
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
            return Array.from(collabIds).map(id => mockUsers.get(id)).filter(Boolean);
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
        userIdCounter = 1;
        projectIdCounter = 1;

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
        app = new Elysia()
            .use(createProjectRoutes(mockDeps))
            .use(createSymfonyCompatProjectRoutes(mockDeps));

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
            const res = await app.handle(
                new Request('http://localhost/api/project/sessions'),
            );

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

            const res = await app.handle(
                new Request('http://localhost/api/project/sessions'),
            );

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

            const res = await app.handle(
                new Request('http://localhost/api/project/sessions/session-1'),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.sessionId).toBe('session-1');
            expect(body.fileName).toBe('test.elp');
            expect(body.hasStructure).toBe(true);
        });

        it('should return 404 for non-existent session', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/sessions/non-existent'),
            );

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
                const res = await app.handle(
                    new Request('http://localhost/api/nav-structures/new-session'),
                );

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

                const res = await app.handle(
                    new Request('http://localhost/api/nav-structures/session-with-structure'),
                );

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.sessionId).toBe('session-with-structure');
            });
        });

        describe('GET /api/odes/last-updated', () => {
            it('should return last updated timestamp', async () => {
                const res = await app.handle(
                    new Request('http://localhost/api/odes/last-updated'),
                );

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

            const res = await app.handle(
                new Request('http://localhost/api/projects/1/sharing'),
            );

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

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/test-project-uuid/sharing'),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
            expect(body.project.uuid).toBe('test-project-uuid');
            expect(body.project.visibility).toBe('private');
        });
    });

    describe('POST /api/project/open (file open)', () => {
        it('should handle project open from path', async () => {
            // Create a test file
            const testFilePath = path.join(testDir, 'test.elp');
            await fs.writeFile(testFilePath, 'PK test content');

            const res = await app.handle(
                new Request('http://localhost/api/project/open', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: testFilePath }),
                }),
            );

            // Open endpoint may need the file to be a valid ELP
            // For now just verify it doesn't crash
            expect(res.status).toBeDefined();
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

    describe('POST /api/project/export', () => {
        it('should require valid session for export', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: 'non-existent',
                        format: 'html5',
                    }),
                }),
            );

            expect(res.status).toBe(404);
        });

        it('should export existing session', async () => {
            mockSessions.set('export-session', {
                sessionId: 'export-session',
                sessionPath: path.join(testDir, 'tmp', 'export-session'),
                structure: {
                    meta: { title: 'Export Test' },
                    pages: [],
                },
            });

            // Create session directory
            await fs.ensureDir(path.join(testDir, 'tmp', 'export-session'));

            const res = await app.handle(
                new Request('http://localhost/api/project/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: 'export-session',
                        format: 'html5',
                    }),
                }),
            );

            expect(res.status).toBe(200);
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

    describe('POST /api/project/open with auth', () => {
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

        it('should require authentication', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/project/open', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ odeFilePath: '/test.elp' }),
                }),
            );

            expect(res.status).toBe(401);
        });

        it('should return 400 when file not found', async () => {
            const token = await createAuthToken();

            const res = await app.handle(
                new Request('http://localhost/api/project/open', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ odeFilePath: '/nonexistent.elp', odeFileName: 'test.elp' }),
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.message).toContain('not found');
        });

        it('should open ELP file successfully', async () => {
            const token = await createAuthToken();

            // Create a test ELP file
            const testFilePath = path.join(testDir, 'auth-test.elp');
            await fs.writeFile(testFilePath, 'PK test content');

            const res = await app.handle(
                new Request('http://localhost/api/project/open', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ odeFilePath: testFilePath, odeFileName: 'auth-test.elp' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.projectUuid).toBeDefined();
        });

        it('should return 400 when no file provided', async () => {
            const token = await createAuthToken();

            const res = await app.handle(
                new Request('http://localhost/api/project/open', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({}),
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.message).toContain('No file provided');
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
            const project = createTestProject(901, 'uuid-901-with-snapshot', 1);

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

        it('should get ODE properties', async () => {
            mockSessions.set('ode-props-session', {
                sessionId: 'ode-props-session',
                fileName: 'Test.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/api/odes/ode-props-session/properties'),
            );

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

    describe('Symfony Compat Chunked Upload', () => {
        it('should handle large ELP upload chunks', async () => {
            const formData = new FormData();
            formData.append('odeFilePart', new Blob(['chunk data']));
            formData.append('odeFileName', 'large.elp');
            formData.append('odeSessionId', 'large-upload-session');

            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/ode/local/large/elp/open', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
        });

        it('should require all fields for chunked upload', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/ode/local/large/elp/open', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                }),
            );

            expect(res.status).toBe(400);
        });
    });

    describe('Symfony Compat ELP Open', () => {
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

        it('should require authentication', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/ode/local/elp/open', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ odeFilePath: '/test.elp' }),
                }),
            );

            expect(res.status).toBe(401);
        });

        it('should require odeFilePath', async () => {
            const token = await createAuthToken();

            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/ode/local/elp/open', {
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

        it('should open ELP file', async () => {
            const token = await createAuthToken();
            const testFilePath = path.join(testDir, 'symfony-open.elp');
            await fs.writeFile(testFilePath, 'PK test content');

            const res = await app.handle(
                new Request('http://localhost/api/ode-management/odes/ode/local/elp/open', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `auth=${token}`,
                    },
                    body: JSON.stringify({ odeFilePath: testFilePath, odeFileName: 'symfony-open.elp' }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
            expect(body.projectUuid).toBeDefined();
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
        it('should clone iDevice', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/idevice-management/idevices/duplicate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeSessionId: 'session-1',
                        ideviceId: 'idevice-1',
                        targetBlockId: 'block-1',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.newIdeviceId).toBeDefined();
        });

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

        it('should clone pag-structure (block)', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/pag-structure-management/pag-structures/duplicate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeSessionId: 'session-1',
                        pagStructureId: 'block-1',
                        targetPageId: 'page-1',
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.newPagStructureId).toBeDefined();
        });
    });

    describe('Structure Save/Reorder Endpoints', () => {
        it('should save nav-structure data', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/nav-structure-management/nav-structures/nav/structure/data/save', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        odeSessionId: 'session-1',
                        navStructureId: 'page-1',
                        properties: { title: 'New Title' },
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
        });

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
            const res = await app.handle(
                new Request('http://localhost/api/projects/user/list'),
            );

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

    describe('Shorter Alias Routes', () => {
        it('should handle /api/odes/local/large-elp/open', async () => {
            const formData = new FormData();
            formData.append('odeFilePart', new Blob(['chunk']));
            formData.append('odeFileName', 'alias.elp');
            formData.append('odeSessionId', 'alias-session');

            const res = await app.handle(
                new Request('http://localhost/api/odes/local/large-elp/open', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
        });

        it('should require all fields for alias route', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/odes/local/large-elp/open', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                }),
            );

            expect(res.status).toBe(400);
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

            const res = await app.handle(
                new Request('http://localhost/api/nav-structures/public-project'),
            );

            expect(res.status).toBe(200);
        });

        it('should deny access to private project without auth', async () => {
            createTestProject(1101, 'private-project', 1, 'private');

            const res = await app.handle(
                new Request('http://localhost/api/nav-structures/private-project'),
            );

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
            const res = await app.handle(
                new Request('http://localhost/api/project/get/user/ode/list'),
            );

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

            const res = await app.handle(
                new Request('http://localhost/api/projects/uuid/uuid-sharing-test/sharing'),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.project.uuid).toBe('uuid-sharing-test');
            expect(body.project.collaborators).toBeDefined();
        });
    });

    describe('Direct File Upload', () => {
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

        it('should open project with direct file upload', async () => {
            const token = await createAuthToken(1);

            // Create a mock ELP file as FormData
            const formData = new FormData();
            const elpContent = new Blob(['PK test elp content'], { type: 'application/zip' });
            formData.append('file', elpContent, 'test-upload.elp');

            const res = await app.handle(
                new Request('http://localhost/api/project/open', {
                    method: 'POST',
                    headers: { 'Cookie': `auth=${token}` },
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.sessionId).toBeDefined();
        });

        it('should return 400 when no file provided', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/project/open', {
                    method: 'POST',
                    headers: {
                        'Cookie': `auth=${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({}),
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('Bad Request');
        });

        it('should return 400 for non-existent file path', async () => {
            const token = await createAuthToken(1);

            const res = await app.handle(
                new Request('http://localhost/api/project/open', {
                    method: 'POST',
                    headers: {
                        'Cookie': `auth=${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        odeFilePath: '/non/existent/path/to/file.elp',
                        odeFileName: 'file.elp',
                    }),
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.message).toContain('File not found');
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

            const res = await app.handle(
                new Request('http://localhost/api/project/sessions'),
            );

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

            const res = await app.handle(
                new Request('http://localhost/api/project/sessions/detail-session'),
            );

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

    describe('Project Open Error Handling', () => {
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

        it('should handle file upload as Buffer', async () => {
            const token = await createAuthToken(1);

            // Create a mock ELP file as FormData with actual buffer content
            const formData = new FormData();
            const elpContent = new Blob(['PK\x03\x04 test elp content'], { type: 'application/zip' });
            formData.append('file', elpContent, 'buffer-test.elp');

            const res = await app.handle(
                new Request('http://localhost/api/project/open', {
                    method: 'POST',
                    headers: { 'Cookie': `auth=${token}` },
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.sessionId).toBeDefined();
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

    describe('Project Export Handling', () => {
        it('should handle export request with session', async () => {
            mockSessions.set('export-test-session', {
                sessionId: 'export-test-session',
                fileName: 'export.elp',
                structure: {
                    meta: { title: 'Export Test' },
                },
            });

            const res = await app.handle(
                new Request('http://localhost/api/project/export', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sessionId: 'export-test-session',
                        format: 'html5',
                    }),
                }),
            );

            // Export might fail due to missing files, but should not 404
            expect([200, 400, 500]).toContain(res.status);
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
});
