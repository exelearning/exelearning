/**
 * Project Auth Tests
 * Tests for project owner assignment and sharing authorization
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import type { Database, User } from '../db/types';
import { up } from '../db/migrations/001_initial';
import { now } from '../db/types';
import { v4 as uuidv4 } from 'uuid';

let testDb: Kysely<Database>;
let user1: User;
let user2: User;
let testProject: { id: number; uuid: string; owner_id: number };

// Helper to create test app with project routes
function createTestProjectApp(db: Kysely<Database>) {
    return (
        new Elysia()
            .use(cookie())
            .use(
                jwt({
                    name: 'jwt',
                    secret: 'test-secret-key-for-testing-only',
                    exp: '7d',
                }),
            )
            .derive(async ({ jwt: jwtPlugin, cookie, request }) => {
                const authHeader = request.headers.get('Authorization');
                let token: string | undefined;

                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.slice(7);
                } else if (cookie.auth?.value) {
                    token = cookie.auth.value;
                }

                if (!token) {
                    return { currentUser: null };
                }

                try {
                    const payload = (await jwtPlugin.verify(token)) as { sub: number } | false;
                    if (!payload || !payload.sub) {
                        return { currentUser: null };
                    }
                    const user = await db
                        .selectFrom('users')
                        .selectAll()
                        .where('id', '=', payload.sub)
                        .executeTakeFirst();
                    return { currentUser: user || null };
                } catch {
                    return { currentUser: null };
                }
            })
            // Create project endpoint
            .post('/api/project/create-quick', async ({ body, set, currentUser }) => {
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Authentication required' };
                }

                const data = body as any;
                const title = data.title || 'New Project';
                const projectUuid = uuidv4();
                const timestamp = now();

                const project = await db
                    .insertInto('projects')
                    .values({
                        uuid: projectUuid,
                        title,
                        owner_id: currentUser.id,
                        saved_once: 0,
                        status: 'active',
                        visibility: 'private',
                        created_at: timestamp,
                        updated_at: timestamp,
                    })
                    .returningAll()
                    .executeTakeFirstOrThrow();

                return { success: true, projectId: project.id, projectUuid: project.uuid };
            })
            // Get project sharing info
            .get('/api/projects/:projectId/sharing', async ({ params, set, currentUser }) => {
                const projectId = parseInt(params.projectId, 10);
                const project = await db
                    .selectFrom('projects')
                    .selectAll()
                    .where('id', '=', projectId)
                    .executeTakeFirst();

                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND' };
                }

                return {
                    responseMessage: 'OK',
                    project: {
                        id: project.id,
                        isOwner: currentUser ? project.owner_id === currentUser.id : false,
                    },
                };
            })
            // Add collaborator
            .post('/api/projects/:projectId/collaborators', async ({ params, body, set, currentUser }) => {
                const projectId = parseInt(params.projectId, 10);
                const { email } = body as { email: string };

                const project = await db
                    .selectFrom('projects')
                    .selectAll()
                    .where('id', '=', projectId)
                    .executeTakeFirst();

                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND' };
                }

                if (!currentUser) {
                    set.status = 401;
                    return { responseMessage: 'UNAUTHORIZED' };
                }

                if (project.owner_id !== currentUser.id) {
                    set.status = 403;
                    return { responseMessage: 'FORBIDDEN' };
                }

                const user = await db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();

                if (!user) {
                    return { responseMessage: 'USER_NOT_FOUND' };
                }

                if (project.owner_id === user.id) {
                    return { responseMessage: 'IS_OWNER' };
                }

                await db
                    .insertInto('project_collaborators')
                    .values({ project_id: projectId, user_id: user.id })
                    .onConflict(oc => oc.doNothing())
                    .execute();

                return { responseMessage: 'OK' };
            })
            // Update visibility
            .patch('/api/projects/:projectId/visibility', async ({ params, body, set, currentUser }) => {
                const projectId = parseInt(params.projectId, 10);
                const { visibility } = body as { visibility: 'public' | 'private' };

                const project = await db
                    .selectFrom('projects')
                    .selectAll()
                    .where('id', '=', projectId)
                    .executeTakeFirst();

                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND' };
                }

                if (!currentUser) {
                    set.status = 401;
                    return { responseMessage: 'UNAUTHORIZED' };
                }

                if (project.owner_id !== currentUser.id) {
                    set.status = 403;
                    return { responseMessage: 'FORBIDDEN' };
                }

                await db
                    .updateTable('projects')
                    .set({ visibility, updated_at: now() })
                    .where('id', '=', projectId)
                    .execute();

                return { responseMessage: 'OK' };
            })
    );
}

describe('Project Owner Assignment', () => {
    let app: ReturnType<typeof createTestProjectApp>;

    beforeAll(async () => {
        // Create in-memory SQLite database
        testDb = new Kysely<Database>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        // Run migrations
        await up(testDb);

        // Create test users
        const timestamp = now();
        const hashedPassword = await Bun.password.hash('test123', 'bcrypt');

        user1 = await testDb
            .insertInto('users')
            .values({
                email: 'owner@test.com',
                user_id: 'user-owner-001',
                password: hashedPassword,
                roles: JSON.stringify(['ROLE_USER']),
                is_active: 1,
                created_at: timestamp,
                updated_at: timestamp,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        user2 = await testDb
            .insertInto('users')
            .values({
                email: 'other@test.com',
                user_id: 'user-other-002',
                password: hashedPassword,
                roles: JSON.stringify(['ROLE_USER']),
                is_active: 1,
                created_at: timestamp,
                updated_at: timestamp,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        app = createTestProjectApp(testDb);
    });

    afterAll(async () => {
        await testDb.destroy();
    });

    beforeEach(async () => {
        // Clean projects before each test
        await testDb.deleteFrom('project_collaborators').execute();
        await testDb.deleteFrom('projects').execute();
    });

    async function getToken(userId: number): Promise<string> {
        // Create a token using the same JWT setup
        const tempApp = new Elysia()
            .use(jwt({ name: 'jwt', secret: 'test-secret-key-for-testing-only', exp: '7d' }))
            .get('/token/:userId', async ({ jwt, params }) => {
                return jwt.sign({ sub: parseInt(params.userId, 10) });
            });

        const res = await tempApp.handle(new Request(`http://localhost/token/${userId}`));
        return await res.text();
    }

    it('should assign authenticated user as owner when creating project', async () => {
        const token = await getToken(user1.id);

        const res = await app.handle(
            new Request('http://localhost/api/project/create-quick', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ title: 'My Project' }),
            }),
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);

        // Verify owner in database
        const project = await testDb
            .selectFrom('projects')
            .selectAll()
            .where('id', '=', data.projectId)
            .executeTakeFirst();

        expect(project?.owner_id).toBe(user1.id);
    });

    it('should reject project creation without authentication', async () => {
        const res = await app.handle(
            new Request('http://localhost/api/project/create-quick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'My Project' }),
            }),
        );

        expect(res.status).toBe(401);
    });

    it('should not default owner to userId=1', async () => {
        // Login as user2 (not user1)
        const token = await getToken(user2.id);

        const res = await app.handle(
            new Request('http://localhost/api/project/create-quick', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ title: 'User2 Project' }),
            }),
        );

        expect(res.status).toBe(200);
        const data = await res.json();

        // Verify owner is user2, NOT user1 (which would be id=1 in many setups)
        const project = await testDb
            .selectFrom('projects')
            .selectAll()
            .where('id', '=', data.projectId)
            .executeTakeFirst();

        expect(project?.owner_id).toBe(user2.id);
        expect(project?.owner_id).not.toBe(1); // Ensure not hardcoded to 1
    });
});

describe('Project Sharing Authorization', () => {
    let app: ReturnType<typeof createTestProjectApp>;

    beforeAll(async () => {
        testDb = new Kysely<Database>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        await up(testDb);

        const timestamp = now();
        const hashedPassword = await Bun.password.hash('test123', 'bcrypt');

        user1 = await testDb
            .insertInto('users')
            .values({
                email: 'owner2@test.com',
                user_id: 'user-owner2-001',
                password: hashedPassword,
                roles: JSON.stringify(['ROLE_USER']),
                is_active: 1,
                created_at: timestamp,
                updated_at: timestamp,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        user2 = await testDb
            .insertInto('users')
            .values({
                email: 'collaborator@test.com',
                user_id: 'user-collab-002',
                password: hashedPassword,
                roles: JSON.stringify(['ROLE_USER']),
                is_active: 1,
                created_at: timestamp,
                updated_at: timestamp,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        app = createTestProjectApp(testDb);
    });

    afterAll(async () => {
        await testDb.destroy();
    });

    beforeEach(async () => {
        await testDb.deleteFrom('project_collaborators').execute();
        await testDb.deleteFrom('projects').execute();

        // Create a test project owned by user1
        const timestamp = now();
        testProject = await testDb
            .insertInto('projects')
            .values({
                uuid: uuidv4(),
                title: 'Test Project',
                owner_id: user1.id,
                saved_once: 1,
                status: 'active',
                visibility: 'private',
                created_at: timestamp,
                updated_at: timestamp,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    });

    async function getToken(userId: number): Promise<string> {
        const tempApp = new Elysia()
            .use(jwt({ name: 'jwt', secret: 'test-secret-key-for-testing-only', exp: '7d' }))
            .get('/token/:userId', async ({ jwt, params }) => {
                return jwt.sign({ sub: parseInt(params.userId, 10) });
            });

        const res = await tempApp.handle(new Request(`http://localhost/token/${userId}`));
        return await res.text();
    }

    it('should allow owner to add collaborators', async () => {
        const token = await getToken(user1.id);

        const res = await app.handle(
            new Request(`http://localhost/api/projects/${testProject.id}/collaborators`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ email: user2.email }),
            }),
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.responseMessage).toBe('OK');
    });

    it('should reject non-owner adding collaborators', async () => {
        const token = await getToken(user2.id); // user2 is NOT the owner

        const res = await app.handle(
            new Request(`http://localhost/api/projects/${testProject.id}/collaborators`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ email: 'anyone@test.com' }),
            }),
        );

        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.responseMessage).toBe('FORBIDDEN');
    });

    it('should return correct isOwner flag for owner', async () => {
        const token = await getToken(user1.id);

        const res = await app.handle(
            new Request(`http://localhost/api/projects/${testProject.id}/sharing`, {
                headers: { 'Authorization': `Bearer ${token}` },
            }),
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.project.isOwner).toBe(true);
    });

    it('should return correct isOwner flag for non-owner', async () => {
        const token = await getToken(user2.id);

        const res = await app.handle(
            new Request(`http://localhost/api/projects/${testProject.id}/sharing`, {
                headers: { 'Authorization': `Bearer ${token}` },
            }),
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.project.isOwner).toBe(false);
    });

    it('should return isOwner=false for unauthenticated users', async () => {
        const res = await app.handle(new Request(`http://localhost/api/projects/${testProject.id}/sharing`));

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.project.isOwner).toBe(false);
    });

    it('should reject adding owner as collaborator', async () => {
        const token = await getToken(user1.id);

        const res = await app.handle(
            new Request(`http://localhost/api/projects/${testProject.id}/collaborators`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ email: user1.email }), // owner's own email
            }),
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.responseMessage).toBe('IS_OWNER');
    });

    it('should reject unauthenticated users from adding collaborators', async () => {
        const res = await app.handle(
            new Request(`http://localhost/api/projects/${testProject.id}/collaborators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user2.email }),
            }),
        );

        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.responseMessage).toBe('UNAUTHORIZED');
    });

    it('should reject non-owner from changing visibility', async () => {
        const token = await getToken(user2.id);

        const res = await app.handle(
            new Request(`http://localhost/api/projects/${testProject.id}/visibility`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ visibility: 'public' }),
            }),
        );

        expect(res.status).toBe(403);
    });

    it('should allow owner to change visibility', async () => {
        const token = await getToken(user1.id);

        const res = await app.handle(
            new Request(`http://localhost/api/projects/${testProject.id}/visibility`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ visibility: 'public' }),
            }),
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.responseMessage).toBe('OK');
    });
});
