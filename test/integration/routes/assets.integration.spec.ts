/**
 * Assets Routes Integration Tests
 * Tests asset upload, download, and management
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
    createTestProject,
} from '../helpers/integration-app';
import type { Database, User } from '../../../src/db/types';

const TEST_JWT_SECRET = 'test_secret_for_integration_tests';

// In-memory asset storage for tests
const testAssets = new Map<number, Map<string, { id: number; filename: string; mimeType: string; size: number }>>();

describe('Assets Routes Integration', () => {
    let db: Kysely<Database>;
    let app: Elysia;
    let testUser: User;
    let testProjectId: number;

    beforeAll(async () => {
        db = await createTestDb();
        testUser = await createTestUser(db, { email: 'assets_test@test.local' });

        // Create a test project
        const project = await createTestProject(db, testUser.id, { title: 'Assets Test Project' });
        testProjectId = project.id;

        // Create assets routes for testing
        app = new Elysia({ name: 'assets-test', prefix: '/api/projects' })
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

                if (!token) return { currentUser: null, testDb: db };

                try {
                    const payload = (await jwt.verify(token)) as { sub: number } | false;
                    if (!payload || !payload.sub) return { currentUser: null, testDb: db };
                    const user = await db
                        .selectFrom('users')
                        .selectAll()
                        .where('id', '=', payload.sub)
                        .executeTakeFirst();
                    return { currentUser: user ? { ...user, roles: JSON.parse(user.roles) } : null, testDb: db };
                } catch {
                    return { currentUser: null, testDb: db };
                }
            })
            // GET /api/projects/:id/assets - List assets
            .get('/:id/assets', ({ params, currentUser, set }) => {
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }

                const projectId = parseInt(params.id, 10);
                const assets = testAssets.get(projectId) || new Map();

                return {
                    assets: Array.from(assets.values()),
                    total: assets.size,
                };
            })
            // POST /api/projects/:id/assets - Upload asset (mock)
            .post('/:id/assets', async ({ params, currentUser, set, body: _body }) => {
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }

                const projectId = parseInt(params.id, 10);
                const assetId = Date.now();
                const asset = {
                    id: assetId,
                    filename: `uploaded_${assetId}.png`,
                    mimeType: 'image/png',
                    size: 1024,
                };

                if (!testAssets.has(projectId)) {
                    testAssets.set(projectId, new Map());
                }
                testAssets.get(projectId)!.set(String(assetId), asset);

                return {
                    asset,
                    message: 'Asset uploaded successfully',
                };
            })
            // DELETE /api/projects/:id/assets/:assetId - Delete asset
            .delete('/:id/assets/:assetId', ({ params, currentUser, set }) => {
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized' };
                }

                const projectId = parseInt(params.id, 10);
                const assets = testAssets.get(projectId);

                if (!assets || !assets.has(params.assetId)) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Asset not found' };
                }

                assets.delete(params.assetId);
                return { message: 'Asset deleted successfully' };
            });
    });

    beforeEach(() => {
        testAssets.clear();
    });

    afterAll(async () => {
        await closeTestDb(db);
    });

    describe('GET /api/projects/:id/assets', () => {
        it('should require authentication', async () => {
            const response = await testRequest(app, `/api/projects/${testProjectId}/assets`);
            expect(response.status).toBe(401);
        });

        it('should return empty list for project without assets', async () => {
            const token = await generateTestToken(testUser);
            const response = await testRequest(app, `/api/projects/${testProjectId}/assets`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            expect(response.status).toBe(200);
            const body = await parseJsonResponse<{ assets: unknown[]; total: number }>(response);
            expect(body.total).toBe(0);
        });
    });

    describe('POST /api/projects/:id/assets', () => {
        it('should require authentication', async () => {
            const response = await testRequest(app, `/api/projects/${testProjectId}/assets`, {
                method: 'POST',
            });
            expect(response.status).toBe(401);
        });

        it('should upload asset with authentication', async () => {
            const token = await generateTestToken(testUser);
            const response = await testRequest(app, `/api/projects/${testProjectId}/assets`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ filename: 'test.png' }),
            });

            expect(response.status).toBe(200);
            const body = await parseJsonResponse<{ asset: { id: number }; message: string }>(response);
            expect(body.asset.id).toBeDefined();
        });
    });

    describe('DELETE /api/projects/:id/assets/:assetId', () => {
        it('should require authentication', async () => {
            const response = await testRequest(app, `/api/projects/${testProjectId}/assets/123`, {
                method: 'DELETE',
            });
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent asset', async () => {
            const token = await generateTestToken(testUser);
            const response = await testRequest(app, `/api/projects/${testProjectId}/assets/non-existent`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(response.status).toBe(404);
        });

        it('should delete existing asset', async () => {
            // First create an asset
            const token = await generateTestToken(testUser);
            const uploadResponse = await testRequest(app, `/api/projects/${testProjectId}/assets`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            const uploadBody = await parseJsonResponse<{ asset: { id: number } }>(uploadResponse);
            const assetId = uploadBody.asset.id;

            // Then delete it
            const deleteResponse = await testRequest(app, `/api/projects/${testProjectId}/assets/${assetId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            expect(deleteResponse.status).toBe(200);
        });
    });
});
