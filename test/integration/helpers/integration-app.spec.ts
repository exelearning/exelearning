/**
 * Tests for Integration App Helper
 */
import { describe, it, expect, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import {
    createTestDb,
    createTestFilesDir,
    cleanupTestFilesDir,
    createTestUser,
    findTestUser,
    generateTestToken,
    generateGuestToken,
    createMinimalTestApp,
    testRequest,
    authenticatedRequest,
    jsonPost,
    parseJsonResponse,
    createTestProject,
    createTestYjsDocument,
    closeTestDb,
    cleanupTestContext,
} from './integration-app';
import type { Kysely } from 'kysely';
import type { Database } from '../../../src/db/types';

describe('integration-app helpers', () => {
    let testDb: Kysely<Database> | null = null;
    let testFilesDir: string | null = null;

    afterEach(async () => {
        if (testDb) {
            await closeTestDb(testDb);
            testDb = null;
        }
        if (testFilesDir) {
            await cleanupTestFilesDir(testFilesDir);
            testFilesDir = null;
        }
    });

    describe('createTestDb', () => {
        it('should create in-memory database', async () => {
            testDb = await createTestDb();
            expect(testDb).toBeDefined();
        });

        it('should have users table', async () => {
            testDb = await createTestDb();
            // Insert a user to verify table exists
            const result = await testDb
                .insertInto('users')
                .values({
                    email: 'test@test.com',
                    user_id: 'test-user-id',
                    password: 'hashed',
                    roles: '["ROLE_USER"]',
                    is_lopd_accepted: 1,
                    quota_mb: 1024,
                    is_active: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .returning(['id'])
                .executeTakeFirst();

            expect(result?.id).toBeDefined();
        });
    });

    describe('createTestFilesDir', () => {
        it('should create directory with required subdirs', async () => {
            testFilesDir = await createTestFilesDir();

            expect(await fs.pathExists(testFilesDir)).toBe(true);
            expect(await fs.pathExists(`${testFilesDir}/tmp`)).toBe(true);
            expect(await fs.pathExists(`${testFilesDir}/dist`)).toBe(true);
            expect(await fs.pathExists(`${testFilesDir}/perm`)).toBe(true);
        });
    });

    describe('cleanupTestFilesDir', () => {
        it('should remove test directory', async () => {
            testFilesDir = await createTestFilesDir();
            expect(await fs.pathExists(testFilesDir)).toBe(true);

            await cleanupTestFilesDir(testFilesDir);
            expect(await fs.pathExists(testFilesDir)).toBe(false);
            testFilesDir = null;
        });

        it('should not remove directories outside test/temp', async () => {
            // This should not throw or delete anything
            await cleanupTestFilesDir('/some/random/path');
        });
    });

    describe('createTestUser', () => {
        it('should create user with default values', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb);

            expect(user.id).toBeDefined();
            expect(user.email).toContain('@test.local');
            expect(user.roles).toContain('ROLE_USER');
        });

        it('should create user with custom email', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb, { email: 'custom@example.com' });

            expect(user.email).toBe('custom@example.com');
        });

        it('should create user with custom roles', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb, { roles: '["ROLE_ADMIN"]' });

            expect(user.roles).toContain('ROLE_ADMIN');
        });
    });

    describe('findTestUser', () => {
        it('should find existing user', async () => {
            testDb = await createTestDb();
            const created = await createTestUser(testDb, { email: 'find@test.com' });

            const found = await findTestUser(testDb, 'find@test.com');
            expect(found).not.toBeNull();
            expect(found!.id).toBe(created.id);
        });

        it('should return null for non-existent user', async () => {
            testDb = await createTestDb();

            const found = await findTestUser(testDb, 'nonexistent@test.com');
            expect(found).toBeNull();
        });
    });

    describe('generateTestToken', () => {
        it('should generate valid JWT token', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb);

            const token = await generateTestToken(user);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.').length).toBe(3); // JWT has 3 parts
        });
    });

    describe('generateGuestToken', () => {
        it('should generate guest JWT token', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb);

            const token = await generateGuestToken(user);
            expect(token).toBeDefined();
            expect(token.split('.').length).toBe(3);
        });
    });

    describe('createMinimalTestApp', () => {
        it('should create Elysia app with auth derive', async () => {
            testDb = await createTestDb();
            const app = createMinimalTestApp(testDb);

            expect(app).toBeDefined();
        });

        it('should handle unauthenticated requests', async () => {
            testDb = await createTestDb();
            const app = createMinimalTestApp(testDb).get('/test', ({ auth }) => ({
                authenticated: auth.isAuthenticated,
                user: auth.user?.email || null,
            }));

            const response = await testRequest(app, '/test');
            const data = await parseJsonResponse<{ authenticated: boolean; user: string | null }>(response);

            expect(data.authenticated).toBe(false);
            expect(data.user).toBeNull();
        });

        it('should handle authenticated requests', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb, { email: 'auth@test.com' });
            const token = await generateTestToken(user);

            const app = createMinimalTestApp(testDb).get('/test', ({ auth }) => ({
                authenticated: auth.isAuthenticated,
                user: auth.user?.email || null,
            }));

            const response = await authenticatedRequest(app, '/test', token);
            const data = await parseJsonResponse<{ authenticated: boolean; user: string | null }>(response);

            expect(data.authenticated).toBe(true);
            expect(data.user).toBe('auth@test.com');
        });

        it('should handle invalid token', async () => {
            testDb = await createTestDb();
            const app = createMinimalTestApp(testDb).get('/test', ({ auth }) => ({
                authenticated: auth.isAuthenticated,
            }));

            const response = await authenticatedRequest(app, '/test', 'invalid-token');
            const data = await parseJsonResponse<{ authenticated: boolean }>(response);

            expect(data.authenticated).toBe(false);
        });

        it('should handle token for non-existent user', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb);
            const token = await generateTestToken(user);

            // Delete the user
            await testDb.deleteFrom('users').where('id', '=', user.id).execute();

            const app = createMinimalTestApp(testDb).get('/test', ({ auth }) => ({
                authenticated: auth.isAuthenticated,
            }));

            const response = await authenticatedRequest(app, '/test', token);
            const data = await parseJsonResponse<{ authenticated: boolean }>(response);

            expect(data.authenticated).toBe(false);
        });

        it('should handle cookie-based auth', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb, { email: 'cookie@test.com' });
            const token = await generateTestToken(user);

            const app = createMinimalTestApp(testDb).get('/test', ({ auth }) => ({
                authenticated: auth.isAuthenticated,
                user: auth.user?.email || null,
            }));

            const response = await testRequest(app, '/test', {
                headers: {
                    Cookie: `auth=${token}`,
                },
            });
            const data = await parseJsonResponse<{ authenticated: boolean; user: string | null }>(response);

            expect(data.authenticated).toBe(true);
            expect(data.user).toBe('cookie@test.com');
        });
    });

    describe('jsonPost', () => {
        it('should make POST request with JSON body', async () => {
            testDb = await createTestDb();
            const app = createMinimalTestApp(testDb).post('/echo', ({ body }) => body);

            const response = await jsonPost(app, '/echo', { message: 'hello' });
            const data = await parseJsonResponse<{ message: string }>(response);

            expect(data.message).toBe('hello');
        });

        it('should include auth token if provided', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb);
            const token = await generateTestToken(user);

            const app = createMinimalTestApp(testDb).post('/test', ({ auth }) => ({
                authenticated: auth.isAuthenticated,
            }));

            const response = await jsonPost(app, '/test', {}, { token });
            const data = await parseJsonResponse<{ authenticated: boolean }>(response);

            expect(data.authenticated).toBe(true);
        });
    });

    describe('parseJsonResponse', () => {
        it('should parse valid JSON', async () => {
            const response = new Response('{"foo":"bar"}');
            const data = await parseJsonResponse<{ foo: string }>(response);
            expect(data.foo).toBe('bar');
        });

        it('should throw for invalid JSON', async () => {
            const response = new Response('not json');
            await expect(parseJsonResponse(response)).rejects.toThrow('Failed to parse JSON');
        });
    });

    describe('createTestProject', () => {
        it('should create project in database', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb);

            const project = await createTestProject(testDb, user.id);
            expect(project.id).toBeDefined();
            expect(project.uuid).toBeDefined();
        });

        it('should create project with custom data', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb);

            const project = await createTestProject(testDb, user.id, {
                title: 'Custom Title',
                language: 'es',
            });

            // Verify by querying
            const found = await testDb
                .selectFrom('projects')
                .selectAll()
                .where('id', '=', project.id)
                .executeTakeFirst();

            expect(found?.title).toBe('Custom Title');
            expect(found?.language).toBe('es');
        });
    });

    describe('createTestYjsDocument', () => {
        it('should create Yjs document for project', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb);
            const project = await createTestProject(testDb, user.id);

            const docId = await createTestYjsDocument(testDb, project.id);
            expect(docId).toBeGreaterThan(0);
        });

        it('should create document with custom snapshot data', async () => {
            testDb = await createTestDb();
            const user = await createTestUser(testDb);
            const project = await createTestProject(testDb, user.id);
            const snapshot = new Uint8Array([1, 2, 3, 4, 5]);

            const docId = await createTestYjsDocument(testDb, project.id, snapshot);

            const found = await testDb
                .selectFrom('yjs_documents')
                .selectAll()
                .where('id', '=', docId)
                .executeTakeFirst();

            expect(found?.snapshot_data).toBeDefined();
        });
    });

    describe('cleanupTestContext', () => {
        it('should cleanup db and files dir', async () => {
            const db = await createTestDb();
            const filesDir = await createTestFilesDir();

            const ctx = {
                app: createMinimalTestApp(db),
                db,
                filesDir,
                cleanup: async () => {},
            };

            await cleanupTestContext(ctx);

            expect(await fs.pathExists(filesDir)).toBe(false);
        });
    });
});
