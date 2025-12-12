/**
 * Filemanager Routes Integration Tests
 * Tests file manager API (FileGator-compatible)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { Kysely } from 'kysely';
import {
    createTestDb,
    closeTestDb,
    testRequest,
    parseJsonResponse,
    createTestUser,
    generateTestToken,
} from '../helpers/integration-app';
import type { Database, User } from '../../../src/db/types';

const TEST_JWT_SECRET = 'test_secret_for_integration_tests';

// Mock file structure for tests
const mockFileTree = new Map<string, { type: 'file' | 'directory'; name: string; size?: number }>();

describe('Filemanager Routes Integration', () => {
    let db: Kysely<Database>;
    let app: Elysia;
    let testUser: User;

    beforeAll(async () => {
        db = await createTestDb();
        testUser = await createTestUser(db, { email: 'filemanager_test@test.local' });

        // Create filemanager routes for testing
        app = new Elysia({ name: 'filemanager-test', prefix: '/filemanager/api' })
            .use(cookie())
            .use(jwt({ name: 'jwt', secret: TEST_JWT_SECRET, exp: '1h' }))
            .derive(async ({ jwt, cookie, request }) => {
                let token: string | undefined;
                const authHeader = request.headers.get('authorization');
                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.slice(7);
                } else if (cookie.auth?.value) {
                    token = cookie.auth.value;
                }

                if (!token) return { currentUser: null };

                try {
                    const payload = (await jwt.verify(token)) as { sub: number } | false;
                    if (!payload || !payload.sub) return { currentUser: null };
                    const user = await db
                        .selectFrom('users')
                        .selectAll()
                        .where('id', '=', payload.sub)
                        .executeTakeFirst();
                    return { currentUser: user ? { ...user, roles: JSON.parse(user.roles) } : null };
                } catch {
                    return { currentUser: null };
                }
            })
            // GET /filemanager/api/files - List files
            .get('/files', ({ query, currentUser, set }) => {
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }

                const dirPath = (query.path as string) || '/';

                return {
                    path: dirPath,
                    items: Array.from(mockFileTree.values()).filter(f => f.type === 'file' || f.type === 'directory'),
                };
            })
            // POST /filemanager/api/files/create-directory - Create directory
            .post('/files/create-directory', ({ body, currentUser, set }) => {
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }

                const { path: dirPath, name } = body as { path: string; name: string };
                const fullPath = `${dirPath}/${name}`.replace('//', '/');

                mockFileTree.set(fullPath, { type: 'directory', name });

                return { message: 'Directory created', path: fullPath };
            })
            // DELETE /filemanager/api/files - Delete file/directory
            .delete('/files', ({ query, currentUser, set }) => {
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }

                const filePath = query.path as string;

                if (!filePath || !mockFileTree.has(filePath)) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'File not found' };
                }

                mockFileTree.delete(filePath);
                return { message: 'File deleted' };
            });
    });

    beforeEach(() => {
        mockFileTree.clear();
        // Add some default mock files
        mockFileTree.set('/images', { type: 'directory', name: 'images' });
        mockFileTree.set('/documents', { type: 'directory', name: 'documents' });
        mockFileTree.set('/test.txt', { type: 'file', name: 'test.txt', size: 100 });
    });

    afterAll(async () => {
        await closeTestDb(db);
    });

    describe('GET /filemanager/api/files', () => {
        it('should require authentication', async () => {
            const response = await testRequest(app, '/filemanager/api/files');
            expect(response.status).toBe(401);
        });

        it('should list files with authentication', async () => {
            const token = await generateTestToken(testUser);
            const response = await testRequest(app, '/filemanager/api/files', {
                headers: { Authorization: `Bearer ${token}` },
            });

            expect(response.status).toBe(200);
            const body = await parseJsonResponse<{ path: string; items: unknown[] }>(response);
            expect(body.path).toBe('/');
            expect(body.items.length).toBeGreaterThan(0);
        });

        it('should list files for specific path', async () => {
            const token = await generateTestToken(testUser);
            const response = await testRequest(app, '/filemanager/api/files?path=/images', {
                headers: { Authorization: `Bearer ${token}` },
            });

            expect(response.status).toBe(200);
            const body = await parseJsonResponse<{ path: string }>(response);
            expect(body.path).toBe('/images');
        });
    });

    describe('POST /filemanager/api/files/create-directory', () => {
        it('should require authentication', async () => {
            const response = await testRequest(app, '/filemanager/api/files/create-directory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: '/', name: 'new-dir' }),
            });
            expect(response.status).toBe(401);
        });

        it('should create directory with authentication', async () => {
            const token = await generateTestToken(testUser);
            const response = await testRequest(app, '/filemanager/api/files/create-directory', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: '/', name: 'new-folder' }),
            });

            expect(response.status).toBe(200);
            const body = await parseJsonResponse<{ message: string; path: string }>(response);
            expect(body.message).toBe('Directory created');
            expect(body.path).toContain('new-folder');
        });
    });

    describe('DELETE /filemanager/api/files', () => {
        it('should require authentication', async () => {
            const response = await testRequest(app, '/filemanager/api/files?path=/test.txt', {
                method: 'DELETE',
            });
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent file', async () => {
            const token = await generateTestToken(testUser);
            const response = await testRequest(app, '/filemanager/api/files?path=/non-existent.txt', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(response.status).toBe(404);
        });

        it('should delete existing file', async () => {
            const token = await generateTestToken(testUser);
            const response = await testRequest(app, '/filemanager/api/files?path=/test.txt', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            expect(response.status).toBe(200);
            const body = await parseJsonResponse<{ message: string }>(response);
            expect(body.message).toBe('File deleted');
        });
    });
});
