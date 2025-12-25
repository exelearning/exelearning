/**
 * Project Routes Integration Tests
 * Tests project session management and basic operations
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { Kysely } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import {
    createTestDb,
    closeTestDb,
    testRequest,
    parseJsonResponse,
    createTestUser,
    generateTestToken,
    createTestFilesDir,
    cleanupTestFilesDir,
} from '../helpers/integration-app';
import type { Database, User } from '../../../src/db/types';

const TEST_JWT_SECRET = 'test_secret_for_integration_tests';

// In-memory session storage for tests
const testSessions = new Map<
    string,
    {
        sessionId: string;
        fileName: string;
        createdAt: Date;
        updatedAt: Date;
        projectId?: number;
    }
>();

describe('Project Routes Integration', () => {
    let db: Kysely<Database>;
    let app: Elysia;
    let testUser: User;
    let filesDir: string;

    beforeAll(async () => {
        // Create test database and files directory
        db = await createTestDb();
        filesDir = await createTestFilesDir();

        // Create test user
        testUser = await createTestUser(db, { email: 'project_test@test.local' });

        // Create project routes that use test db
        app = new Elysia({ name: 'project-test', prefix: '/api/project' })
            .use(cookie())
            .use(
                jwt({
                    name: 'jwt',
                    secret: TEST_JWT_SECRET,
                    exp: '1h',
                }),
            )
            .derive(async ({ jwt, cookie, request }) => {
                let token: string | undefined;

                const authHeader = request.headers.get('authorization');
                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.slice(7);
                } else if (cookie.auth?.value) {
                    token = cookie.auth.value;
                }

                if (!token) {
                    return { currentUser: null, testDb: db };
                }

                try {
                    const payload = (await jwt.verify(token)) as { sub: number } | false;
                    if (!payload || !payload.sub) {
                        return { currentUser: null, testDb: db };
                    }
                    const user = await db
                        .selectFrom('users')
                        .selectAll()
                        .where('id', '=', payload.sub)
                        .executeTakeFirst();
                    return {
                        currentUser: user ? { ...user, roles: JSON.parse(user.roles) } : null,
                        testDb: db,
                    };
                } catch {
                    return { currentUser: null, testDb: db };
                }
            })
            // GET /api/project/sessions - List all sessions
            .get('/sessions', () => {
                const sessions = Array.from(testSessions.values());
                return {
                    count: sessions.length,
                    sessions: sessions.map(s => ({
                        sessionId: s.sessionId,
                        fileName: s.fileName,
                        createdAt: s.createdAt.toISOString(),
                        updatedAt: s.updatedAt.toISOString(),
                    })),
                };
            })
            // GET /api/project/sessions/:id - Get session details
            .get('/sessions/:id', ({ params, set }) => {
                const session = testSessions.get(params.id);
                if (!session) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Session not found' };
                }
                return {
                    sessionId: session.sessionId,
                    fileName: session.fileName,
                    createdAt: session.createdAt.toISOString(),
                    updatedAt: session.updatedAt.toISOString(),
                };
            })
            // DELETE /api/project/sessions/:id - Delete a session
            .delete('/sessions/:id', ({ params, set }) => {
                if (!testSessions.has(params.id)) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Session not found' };
                }
                testSessions.delete(params.id);
                return { message: 'Session deleted', sessionId: params.id };
            })
            // POST /api/project/create-quick - Create a new empty project
            .post('/create-quick', async ({ currentUser, testDb, set }) => {
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Authentication required' };
                }

                const projectUuid = uuidv4();
                const sessionId = uuidv4();

                // Create project in database
                const project = await testDb
                    .insertInto('projects')
                    .values({
                        uuid: projectUuid,
                        title: 'Untitled',
                        owner_id: currentUser.id,
                        status: 'active',
                        visibility: 'private',
                        saved_once: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .returning(['id', 'uuid'])
                    .executeTakeFirstOrThrow();

                // Create session
                const session = {
                    sessionId,
                    fileName: 'Untitled.elp',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    projectId: project.id,
                };
                testSessions.set(sessionId, session);

                return {
                    responseMessage: 'OK',
                    sessionId,
                    projectUuid: project.uuid,
                    projectId: project.id,
                };
            })
            // GET /api/project/get/user/ode/list - List user's saved projects
            .get('/get/user/ode/list', async ({ currentUser, testDb, set }) => {
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Authentication required' };
                }

                const projects = await testDb
                    .selectFrom('projects')
                    .selectAll()
                    .where('owner_id', '=', currentUser.id)
                    .where('status', '=', 'active')
                    .where('saved_once', '=', 1)
                    .orderBy('updated_at', 'desc')
                    .execute();

                return {
                    total: projects.length,
                    projects: projects.map(p => ({
                        id: p.id,
                        uuid: p.uuid,
                        title: p.title,
                        visibility: p.visibility,
                        createdAt: p.created_at,
                        updatedAt: p.updated_at,
                    })),
                };
            });
    });

    beforeEach(() => {
        // Clear test sessions before each test
        testSessions.clear();
    });

    afterAll(async () => {
        await closeTestDb(db);
        await cleanupTestFilesDir(filesDir);
    });

    describe('GET /api/project/sessions', () => {
        it('should return empty sessions list initially', async () => {
            const response = await testRequest(app, '/api/project/sessions');

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ count: number; sessions: unknown[] }>(response);
            expect(body.count).toBe(0);
            expect(body.sessions).toEqual([]);
        });

        it('should list created sessions', async () => {
            // Add a test session
            const sessionId = uuidv4();
            testSessions.set(sessionId, {
                sessionId,
                fileName: 'test.elp',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const response = await testRequest(app, '/api/project/sessions');
            const body = await parseJsonResponse<{ count: number; sessions: unknown[] }>(response);

            expect(body.count).toBe(1);
            expect(body.sessions.length).toBe(1);
        });
    });

    describe('GET /api/project/sessions/:id', () => {
        it('should return 404 for non-existent session', async () => {
            const response = await testRequest(app, '/api/project/sessions/non-existent');

            expect(response.status).toBe(404);
        });

        it('should return session details', async () => {
            const sessionId = uuidv4();
            testSessions.set(sessionId, {
                sessionId,
                fileName: 'details-test.elp',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const response = await testRequest(app, `/api/project/sessions/${sessionId}`);

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ sessionId: string; fileName: string }>(response);
            expect(body.sessionId).toBe(sessionId);
            expect(body.fileName).toBe('details-test.elp');
        });
    });

    describe('DELETE /api/project/sessions/:id', () => {
        it('should return 404 for non-existent session', async () => {
            const response = await testRequest(app, '/api/project/sessions/non-existent', {
                method: 'DELETE',
            });

            expect(response.status).toBe(404);
        });

        it('should delete existing session', async () => {
            const sessionId = uuidv4();
            testSessions.set(sessionId, {
                sessionId,
                fileName: 'delete-test.elp',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const response = await testRequest(app, `/api/project/sessions/${sessionId}`, {
                method: 'DELETE',
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ message: string; sessionId: string }>(response);
            expect(body.sessionId).toBe(sessionId);

            // Verify session is deleted
            expect(testSessions.has(sessionId)).toBe(false);
        });
    });

    describe('POST /api/project/create-quick', () => {
        it('should require authentication', async () => {
            const response = await testRequest(app, '/api/project/create-quick', {
                method: 'POST',
            });

            expect(response.status).toBe(401);
        });

        it('should create a new project with authentication', async () => {
            const token = await generateTestToken(testUser);

            const response = await testRequest(app, '/api/project/create-quick', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{
                responseMessage: string;
                sessionId: string;
                projectUuid: string;
                projectId: number;
            }>(response);

            expect(body.responseMessage).toBe('OK');
            expect(body.sessionId).toBeDefined();
            expect(body.projectUuid).toBeDefined();
            expect(body.projectId).toBeGreaterThan(0);

            // Verify session was created
            expect(testSessions.has(body.sessionId)).toBe(true);
        });
    });

    describe('GET /api/project/get/user/ode/list', () => {
        it('should require authentication', async () => {
            const response = await testRequest(app, '/api/project/get/user/ode/list');

            expect(response.status).toBe(401);
        });

        it('should return empty list for user without saved projects', async () => {
            const token = await generateTestToken(testUser);

            const response = await testRequest(app, '/api/project/get/user/ode/list', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ total: number; projects: unknown[] }>(response);
            expect(body.total).toBe(0);
            expect(body.projects).toEqual([]);
        });

        it('should return saved projects for user', async () => {
            // Create a saved project
            await db
                .insertInto('projects')
                .values({
                    uuid: uuidv4(),
                    title: 'Saved Test Project',
                    owner_id: testUser.id,
                    status: 'active',
                    visibility: 'private',
                    saved_once: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .execute();

            const token = await generateTestToken(testUser);

            const response = await testRequest(app, '/api/project/get/user/ode/list', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{
                total: number;
                projects: Array<{ title: string }>;
            }>(response);

            expect(body.total).toBe(1);
            expect(body.projects[0].title).toBe('Saved Test Project');
        });
    });
});
