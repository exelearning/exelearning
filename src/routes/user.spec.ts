/**
 * Tests for User Routes
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { createUserRoutes, type UserDependencies } from './user';

// Test JWT secret (must match what user.ts uses)
const TEST_JWT_SECRET = process.env.APP_SECRET || 'test-secret-for-user-routes-testing';

// Override APP_SECRET for tests
const originalAppSecret = process.env.APP_SECRET;

describe('User Routes', () => {
    let app: Elysia;
    let savedPreferences: Map<string, Map<string, string>>;
    let jwtHelper: { sign: (payload: any) => Promise<string> };

    // Create mock dependencies for each test
    function createMockDependencies(): UserDependencies {
        return {
            db: {} as any, // Not used directly, queries use it
            queries: {
                findAllPreferencesForUser: async (_db: any, userId: string) => {
                    const userPrefs = savedPreferences.get(userId);
                    if (!userPrefs) return [];

                    return Array.from(userPrefs.entries()).map(([key, value]) => ({
                        preference_key: key,
                        value: value,
                    }));
                },
                findPreference: async (_db: any, userId: string, key: string) => {
                    const userPrefs = savedPreferences.get(userId);
                    if (!userPrefs) return undefined;
                    const value = userPrefs.get(key);
                    if (value === undefined) return undefined;
                    return { preference_key: key, value };
                },
                setPreference: async (_db: any, userId: string, key: string, value: string) => {
                    if (!savedPreferences.has(userId)) {
                        savedPreferences.set(userId, new Map());
                    }
                    savedPreferences.get(userId)!.set(key, value);
                },
            },
        };
    }

    // Generate a valid JWT token for testing
    async function generateAuthCookie(userId: number, email: string = 'test@test.com'): Promise<string> {
        const token = await jwtHelper.sign({ sub: userId, email });
        return `auth=${token}`;
    }

    beforeEach(async () => {
        // Set test secret
        process.env.APP_SECRET = TEST_JWT_SECRET;

        savedPreferences = new Map();
        const mockDeps = createMockDependencies();
        app = new Elysia().use(createUserRoutes(mockDeps));

        // Create JWT helper with same secret
        const jwtApp = new Elysia()
            .use(jwt({
                name: 'jwt',
                secret: TEST_JWT_SECRET,
                exp: '7d',
            }))
            .get('/sign', async ({ jwt, query }) => {
                const token = await jwt.sign({ sub: Number(query.sub), email: query.email });
                return { token };
            });

        jwtHelper = {
            sign: async (payload: any) => {
                const res = await jwtApp.handle(
                    new Request(`http://localhost/sign?sub=${payload.sub}&email=${payload.email}`),
                );
                const body = await res.json();
                return body.token;
            },
        };
    });

    afterEach(() => {
        // Restore original APP_SECRET
        if (originalAppSecret) {
            process.env.APP_SECRET = originalAppSecret;
        } else {
            delete process.env.APP_SECRET;
        }
    });

    describe('GET /api/user/preferences', () => {
        it('should return empty preferences for unauthenticated user', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences'),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.userPreferences).toEqual({});
        });

        it('should return userPreferences wrapper object', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences'),
            );

            const body = await res.json();
            expect(Object.keys(body)).toContain('userPreferences');
        });

        it('should return saved preferences for authenticated user', async () => {
            // Pre-populate preferences for user '1'
            savedPreferences.set('1', new Map([
                ['theme', 'dark'],
                ['locale', 'en'],
            ]));

            const authCookie = await generateAuthCookie(1);
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences', {
                    headers: { Cookie: authCookie },
                }),
            );

            const body = await res.json();
            expect(body.userPreferences.theme.value).toBe('dark');
            expect(body.userPreferences.locale.value).toBe('en');
        });

        it('should return default preferences for authenticated user without saved prefs', async () => {
            const authCookie = await generateAuthCookie(1);
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences', {
                    headers: { Cookie: authCookie },
                }),
            );

            const body = await res.json();
            expect(body.userPreferences).toBeDefined();
            expect(body.userPreferences.locale.value).toBe('es'); // default
            expect(body.userPreferences.theme.value).toBe('base'); // default
        });

        it('should handle JSON-wrapped preference values', async () => {
            savedPreferences.set('1', new Map([
                ['customPref', JSON.stringify({ value: 'custom', extra: 'data' })],
            ]));

            const authCookie = await generateAuthCookie(1);
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences', {
                    headers: { Cookie: authCookie },
                }),
            );

            const body = await res.json();
            expect(body.userPreferences.customPref).toBeDefined();
            expect(body.userPreferences.customPref.value).toBe('custom');
        });
    });

    describe('POST /api/user/preferences', () => {
        it('should return 401 for unauthenticated user', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences', {
                    method: 'POST',
                    body: JSON.stringify({ theme: 'dark' }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(res.status).toBe(401);
        });

        it('should save single preference for authenticated user', async () => {
            const authCookie = await generateAuthCookie(1);
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences', {
                    method: 'POST',
                    body: JSON.stringify({ theme: 'dark' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: authCookie,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');

            // Verify preference was saved
            expect(savedPreferences.get('1')?.get('theme')).toBe('dark');
        });

        it('should save multiple preferences for authenticated user', async () => {
            const authCookie = await generateAuthCookie(1);
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences', {
                    method: 'POST',
                    body: JSON.stringify({
                        theme: 'dark',
                        locale: 'en',
                        advancedMode: 'false',
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: authCookie,
                    },
                }),
            );

            expect(res.status).toBe(200);
            expect(savedPreferences.get('1')?.get('theme')).toBe('dark');
            expect(savedPreferences.get('1')?.get('locale')).toBe('en');
            expect(savedPreferences.get('1')?.get('advancedMode')).toBe('false');
        });

        it('should handle object values by stringifying', async () => {
            const authCookie = await generateAuthCookie(1);
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences', {
                    method: 'POST',
                    body: JSON.stringify({
                        complexPref: { nested: 'value', count: 42 },
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: authCookie,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const saved = savedPreferences.get('1')?.get('complexPref');
            expect(saved).toBeDefined();
            const parsed = JSON.parse(saved!);
            expect(parsed.nested).toBe('value');
        });
    });

    describe('PUT /api/user/preferences', () => {
        it('should return 401 for unauthenticated user', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences', {
                    method: 'PUT',
                    body: JSON.stringify({ theme: 'light' }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(res.status).toBe(401);
        });

        it('should save preferences for authenticated user (Symfony compatibility)', async () => {
            const authCookie = await generateAuthCookie(1);
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences', {
                    method: 'PUT',
                    body: JSON.stringify({ theme: 'light' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: authCookie,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.responseMessage).toBe('OK');
            expect(savedPreferences.get('1')?.get('theme')).toBe('light');
        });

        it('should behave same as POST for authenticated user', async () => {
            const authCookie = await generateAuthCookie(1);

            const postRes = await app.handle(
                new Request('http://localhost/api/user/preferences', {
                    method: 'POST',
                    body: JSON.stringify({ testPref: 'postValue' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: authCookie,
                    },
                }),
            );

            const putRes = await app.handle(
                new Request('http://localhost/api/user/preferences', {
                    method: 'PUT',
                    body: JSON.stringify({ testPref2: 'putValue' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: authCookie,
                    },
                }),
            );

            const postBody = await postRes.json();
            const putBody = await putRes.json();
            expect(postBody.responseMessage).toBe(putBody.responseMessage);
        });
    });

    describe('POST /api/user/lopd-accepted', () => {
        it('should return 401 for unauthenticated user', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/user/lopd-accepted', {
                    method: 'POST',
                }),
            );

            expect(res.status).toBe(401);
        });

        it('should save LOPD acceptance for authenticated user', async () => {
            const authCookie = await generateAuthCookie(1);
            const res = await app.handle(
                new Request('http://localhost/api/user/lopd-accepted', {
                    method: 'POST',
                    headers: { Cookie: authCookie },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.message).toBe('LOPD accepted');
        });

        it('should save lopdAccepted flag for authenticated user', async () => {
            const authCookie = await generateAuthCookie(1);
            await app.handle(
                new Request('http://localhost/api/user/lopd-accepted', {
                    method: 'POST',
                    headers: { Cookie: authCookie },
                }),
            );

            const saved = savedPreferences.get('1')?.get('lopdAccepted');
            expect(saved).toBe('true');
        });

        it('should save lopdAcceptedAt timestamp for authenticated user', async () => {
            const authCookie = await generateAuthCookie(1);
            await app.handle(
                new Request('http://localhost/api/user/lopd-accepted', {
                    method: 'POST',
                    headers: { Cookie: authCookie },
                }),
            );

            const savedAt = savedPreferences.get('1')?.get('lopdAcceptedAt');
            expect(savedAt).toBeDefined();
            // Should be a valid ISO timestamp
            expect(savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });

    describe('error handling', () => {
        it('should return empty preferences when unauthenticated (regardless of db errors)', async () => {
            // Unauthenticated users always get empty preferences
            const res = await app.handle(
                new Request('http://localhost/api/user/preferences'),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.userPreferences).toEqual({});
        });

        it('should return defaults when findAllPreferencesForUser throws (authenticated)', async () => {
            // Create a mock that throws for findAllPreferencesForUser
            const errorDeps: UserDependencies = {
                db: {} as any,
                queries: {
                    findAllPreferencesForUser: async () => {
                        throw new Error('Database connection failed');
                    },
                    findPreference: async () => undefined,
                    setPreference: async () => {},
                },
            };
            const errorApp = new Elysia().use(createUserRoutes(errorDeps));

            const authCookie = await generateAuthCookie(1);
            const res = await errorApp.handle(
                new Request('http://localhost/api/user/preferences', {
                    headers: { Cookie: authCookie },
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            // Should return defaults even when query fails
            expect(body.userPreferences).toBeDefined();
            expect(body.userPreferences.locale.value).toBe('es'); // default
        });

        it('should handle setPreference errors gracefully (logged but not propagated)', async () => {
            // Create a mock where setPreference throws
            // The error is caught by saveUserPreference and logged, not propagated
            const errorDeps: UserDependencies = {
                db: {} as any,
                queries: {
                    findAllPreferencesForUser: async () => [],
                    findPreference: async () => undefined,
                    setPreference: async () => {
                        throw new Error('Failed to save');
                    },
                },
            };
            const errorApp = new Elysia().use(createUserRoutes(errorDeps));

            const authCookie = await generateAuthCookie(1);
            const res = await errorApp.handle(
                new Request('http://localhost/api/user/preferences', {
                    method: 'POST',
                    body: JSON.stringify({ theme: 'dark' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: authCookie,
                    },
                }),
            );

            // Error is silently logged, response is still 200
            expect(res.status).toBe(200);
        });

        it('should handle PUT setPreference errors gracefully', async () => {
            const errorDeps: UserDependencies = {
                db: {} as any,
                queries: {
                    findAllPreferencesForUser: async () => [],
                    findPreference: async () => undefined,
                    setPreference: async () => {
                        throw new Error('Failed to save');
                    },
                },
            };
            const errorApp = new Elysia().use(createUserRoutes(errorDeps));

            const authCookie = await generateAuthCookie(1);
            const res = await errorApp.handle(
                new Request('http://localhost/api/user/preferences', {
                    method: 'PUT',
                    body: JSON.stringify({ theme: 'dark' }),
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: authCookie,
                    },
                }),
            );

            // Error is silently logged, response is still 200
            expect(res.status).toBe(200);
        });

        it('should handle LOPD setPreference errors gracefully', async () => {
            const errorDeps: UserDependencies = {
                db: {} as any,
                queries: {
                    findAllPreferencesForUser: async () => [],
                    findPreference: async () => undefined,
                    setPreference: async () => {
                        throw new Error('Failed to save');
                    },
                },
            };
            const errorApp = new Elysia().use(createUserRoutes(errorDeps));

            const authCookie = await generateAuthCookie(1);
            const res = await errorApp.handle(
                new Request('http://localhost/api/user/lopd-accepted', {
                    method: 'POST',
                    headers: { Cookie: authCookie },
                }),
            );

            // Error is silently logged, response is still 200
            expect(res.status).toBe(200);
        });
    });
});
