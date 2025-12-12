/**
 * Auth Routes Integration Tests
 * Tests authentication endpoints with in-memory database
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { Kysely } from 'kysely';
import * as bcrypt from 'bcryptjs';
import {
    createTestDb,
    closeTestDb,
    testRequest,
    parseJsonResponse,
    jsonPost,
    generateTestToken,
} from '../helpers/integration-app';
import type { Database, User } from '../../../src/db/types';

const TEST_JWT_SECRET = 'test_secret_for_integration_tests';

describe('Auth Routes Integration', () => {
    let db: Kysely<Database>;
    let app: Elysia;
    let testUser: User;
    const testPassword = 'test1234';

    beforeAll(async () => {
        // Create test database
        db = await createTestDb();

        // Create auth routes that use test db
        app = new Elysia({ name: 'auth-test' })
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
                    return {
                        auth: { user: null, isAuthenticated: false, isGuest: false },
                        testDb: db,
                    };
                }

                try {
                    const payload = (await jwt.verify(token)) as { sub: number; isGuest?: boolean } | false;

                    if (!payload || !payload.sub) {
                        return {
                            auth: { user: null, isAuthenticated: false, isGuest: false },
                            testDb: db,
                        };
                    }

                    const user = await db
                        .selectFrom('users')
                        .selectAll()
                        .where('id', '=', payload.sub)
                        .executeTakeFirst();

                    if (!user) {
                        return {
                            auth: { user: null, isAuthenticated: false, isGuest: false },
                            testDb: db,
                        };
                    }

                    return {
                        auth: {
                            user: { ...user, roles: JSON.parse(user.roles) },
                            isAuthenticated: true,
                            isGuest: payload.isGuest || false,
                        },
                        testDb: db,
                    };
                } catch {
                    return {
                        auth: { user: null, isAuthenticated: false, isGuest: false },
                        testDb: db,
                    };
                }
            })
            // POST /api/auth/login
            .post(
                '/api/auth/login',
                async ({ jwt, cookie, body, set, testDb }) => {
                    const { email, password } = body as { email: string; password: string };

                    const user = await testDb
                        .selectFrom('users')
                        .selectAll()
                        .where('email', '=', email)
                        .executeTakeFirst();

                    if (!user) {
                        set.status = 401;
                        return { error: 'Unauthorized', message: 'Invalid credentials' };
                    }

                    const isValid = await bcrypt.compare(password, user.password);
                    if (!isValid) {
                        set.status = 401;
                        return { error: 'Unauthorized', message: 'Invalid credentials' };
                    }

                    const roles = JSON.parse(user.roles);
                    const payload = {
                        sub: user.id,
                        email: user.email,
                        roles,
                        isGuest: false,
                    };

                    const token = await jwt.sign(payload);

                    cookie.auth.set({
                        value: token,
                        httpOnly: true,
                        sameSite: 'lax',
                        maxAge: 7 * 24 * 60 * 60,
                        path: '/',
                    });

                    return {
                        access_token: token,
                        user: {
                            id: user.id,
                            email: user.email,
                            roles,
                        },
                    };
                },
                {
                    body: t.Object({
                        email: t.String(),
                        password: t.String(),
                    }),
                },
            )
            // POST /api/auth/logout
            .post('/api/auth/logout', async ({ cookie, auth }) => {
                cookie.auth.remove();
                return {
                    message: 'Logged out successfully',
                    wasAuthenticated: auth?.isAuthenticated || false,
                };
            })
            // GET /api/auth/check
            .get('/api/auth/check', ({ auth }) => {
                return { authenticated: auth?.isAuthenticated || false };
            })
            // GET /api/auth/user
            .get('/api/auth/user', ({ auth, set }) => {
                if (!auth?.isAuthenticated || !auth.user) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Not authenticated' };
                }
                const { password: _password, ...safeUser } = auth.user as User;
                return {
                    user: safeUser,
                    isGuest: auth.isGuest,
                };
            })
            // GET /api/session/check
            .get('/api/session/check', ({ auth }) => {
                const authenticated = auth?.isAuthenticated || false;
                return {
                    authenticated,
                    active: authenticated,
                    user:
                        authenticated && auth?.user
                            ? {
                                  id: (auth.user as User).id,
                                  email: (auth.user as User).email,
                              }
                            : null,
                };
            });
    });

    beforeEach(async () => {
        // Create a fresh test user for each test
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        const result = await db
            .insertInto('users')
            .values({
                email: `auth_test_${Date.now()}@test.local`,
                user_id: `auth_test_${Date.now()}`,
                password: hashedPassword,
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                quota_mb: 4096,
                is_active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .returning([
                'id',
                'email',
                'user_id',
                'password',
                'roles',
                'is_lopd_accepted',
                'quota_mb',
                'external_identifier',
                'api_token',
                'is_active',
                'created_at',
                'updated_at',
            ])
            .executeTakeFirstOrThrow();

        testUser = {
            ...result,
            roles: JSON.parse(result.roles),
        } as User;
    });

    afterAll(async () => {
        await closeTestDb(db);
    });

    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const response = await jsonPost(app, '/api/auth/login', {
                email: testUser.email,
                password: testPassword,
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{
                access_token: string;
                user: { id: number; email: string };
            }>(response);

            expect(body.access_token).toBeDefined();
            expect(body.user.email).toBe(testUser.email);
        });

        it('should reject invalid password', async () => {
            const response = await jsonPost(app, '/api/auth/login', {
                email: testUser.email,
                password: 'wrong_password',
            });

            expect(response.status).toBe(401);

            const body = await parseJsonResponse<{ error: string }>(response);
            expect(body.error).toBe('Unauthorized');
        });

        it('should reject non-existent user', async () => {
            const response = await jsonPost(app, '/api/auth/login', {
                email: 'nonexistent@test.local',
                password: testPassword,
            });

            expect(response.status).toBe(401);
        });

        it('should set auth cookie on login', async () => {
            const response = await jsonPost(app, '/api/auth/login', {
                email: testUser.email,
                password: testPassword,
            });

            const setCookie = response.headers.get('set-cookie');
            expect(setCookie).toContain('auth=');
        });
    });

    describe('GET /api/auth/check', () => {
        it('should return authenticated=false without token', async () => {
            const response = await testRequest(app, '/api/auth/check');

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ authenticated: boolean }>(response);
            expect(body.authenticated).toBe(false);
        });

        it('should return authenticated=true with valid token', async () => {
            const token = await generateTestToken(testUser);

            const response = await testRequest(app, '/api/auth/check', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ authenticated: boolean }>(response);
            expect(body.authenticated).toBe(true);
        });

        it('should return authenticated=false with invalid token', async () => {
            const response = await testRequest(app, '/api/auth/check', {
                headers: {
                    Authorization: 'Bearer invalid_token',
                },
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ authenticated: boolean }>(response);
            expect(body.authenticated).toBe(false);
        });
    });

    describe('GET /api/auth/user', () => {
        it('should return 401 without authentication', async () => {
            const response = await testRequest(app, '/api/auth/user');

            expect(response.status).toBe(401);
        });

        it('should return user data with valid token', async () => {
            const token = await generateTestToken(testUser);

            const response = await testRequest(app, '/api/auth/user', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{
                user: { id: number; email: string };
                isGuest: boolean;
            }>(response);

            expect(body.user.id).toBe(testUser.id);
            expect(body.user.email).toBe(testUser.email);
            expect(body.isGuest).toBe(false);
        });

        it('should not return password in user data', async () => {
            const token = await generateTestToken(testUser);

            const response = await testRequest(app, '/api/auth/user', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const body = await parseJsonResponse<{ user: Record<string, unknown> }>(response);
            expect(body.user.password).toBeUndefined();
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should logout and remove cookie', async () => {
            const token = await generateTestToken(testUser);

            const response = await testRequest(app, '/api/auth/logout', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{
                message: string;
                wasAuthenticated: boolean;
            }>(response);

            expect(body.message).toBe('Logged out successfully');
            expect(body.wasAuthenticated).toBe(true);
        });

        it('should handle logout without authentication', async () => {
            const response = await testRequest(app, '/api/auth/logout', {
                method: 'POST',
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ wasAuthenticated: boolean }>(response);
            expect(body.wasAuthenticated).toBe(false);
        });
    });

    describe('GET /api/session/check', () => {
        it('should return session status', async () => {
            const token = await generateTestToken(testUser);

            const response = await testRequest(app, '/api/session/check', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{
                authenticated: boolean;
                active: boolean;
                user: { id: number; email: string } | null;
            }>(response);

            expect(body.authenticated).toBe(true);
            expect(body.active).toBe(true);
            expect(body.user?.id).toBe(testUser.id);
        });

        it('should return null user when not authenticated', async () => {
            const response = await testRequest(app, '/api/session/check');

            const body = await parseJsonResponse<{ user: null }>(response);
            expect(body.user).toBeNull();
        });
    });
});
