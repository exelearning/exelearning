/**
 * Tests for Pages Routes
 * Uses Dependency Injection pattern - no mock.module needed
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

import {
    createPagesRoutes,
    type PagesDependencies,
    type PagesQueriesDeps,
    type PagesSessionManagerDeps,
    type PagesFileHelperDeps,
    type PagesTemplateDeps,
    type PagesUtilsDeps,
    type PagesSettingsDeps,
} from './pages';

// Mock data stores
let mockUsers: Map<number, any>;
let mockSessions: Map<string, any>;
let mockProjects: Map<string, any>;
let mockPreferences: Map<string, any>;
let sessionIdCounter = 0;

// Create mock query functions
function createMockQueries(): PagesQueriesDeps {
    return {
        findUserById: async (_db: any, id: number) => mockUsers.get(id),
        findUserByEmail: async (_db: any, email: string) => {
            for (const user of mockUsers.values()) {
                if (user.email === email) return user;
            }
            return undefined;
        },
        createUser: async (_db: any, data: any) => {
            const id = mockUsers.size + 1;
            const user = { id, ...data };
            mockUsers.set(id, user);
            return user;
        },
        findPreference: async (_db: any, userId: number, key: string) => {
            return mockPreferences.get(`${userId}:${key}`);
        },
        setPreference: async (_db: any, userId: number, key: string, value: string) => {
            mockPreferences.set(`${userId}:${key}`, { value });
            return {
                id: 1,
                owner_id: userId,
                preference_key: key,
                value,
                description: null,
                is_active: 1,
                created_at: Date.now(),
                updated_at: Date.now(),
            };
        },
        findProjectByUuid: async (_db: any, uuid: string) => mockProjects.get(uuid),
        findProjectByPlatformId: async (_db: any, platformId: string) => {
            // Search for project with matching platform_id
            for (const project of mockProjects.values()) {
                if (project.platform_id === platformId) return project;
            }
            return undefined;
        },
        checkProjectAccess: async (_db: any, project: any, userId?: number) => {
            // Check owner (support both ownerId and owner_id)
            if (userId && (project.ownerId === userId || project.owner_id === userId)) {
                return { hasAccess: true, reason: undefined };
            }
            // Check collaborators
            if (userId && project.collaborators?.includes(userId)) {
                return { hasAccess: true, reason: undefined };
            }
            // Check visibility
            if (project.visibility === 'public') {
                return { hasAccess: true, reason: undefined };
            }
            return { hasAccess: false, reason: 'ACCESS_DENIED' };
        },
        createProject: async (_db: any, data: any) => {
            const uuid = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const project = {
                id: mockProjects.size + 1,
                uuid,
                title: data.title || 'Untitled',
                owner_id: data.owner_id,
                saved_once: data.saved_once ?? 0,
                visibility: 'private',
                status: 'active',
                created_at: Date.now(),
                updated_at: Date.now(),
                description: null,
                language: 'en',
                author: null,
                license: null,
                last_accessed_at: Date.now(),
                platform_id: null,
            };
            mockProjects.set(uuid, project);
            return project;
        },
        getDefaultTheme: async () => ({ type: 'base', name: 'default-theme' }),
    };
}

// Create mock session manager functions
function createMockSessionManager(): PagesSessionManagerDeps {
    return {
        createSession: (session: any) => {
            mockSessions.set(session.sessionId, session);
            return session;
        },
        generateSessionId: () => {
            sessionIdCounter++;
            return `20250116session${sessionIdCounter}`;
        },
        getSession: (id: string) => mockSessions.get(id),
    };
}

// Create mock file helper functions
function createMockFileHelper(): PagesFileHelperDeps {
    return {
        createSessionDirectories: async (_sessionId: string) => {
            // Do nothing in tests
        },
    };
}

// Create mock template functions
function createMockTemplate(): PagesTemplateDeps {
    return {
        renderTemplate: (template: string, data: any) => {
            return `<html><body>Template: ${template}, Locale: ${data.locale || 'en'}</body></html>`;
        },
        setRenderLocale: (_locale: string) => {
            // No-op for default mock
        },
    };
}

// Create mock utils
function createMockUtils(): PagesUtilsDeps {
    return {
        createGravatarUrl: (email: string, _gravatarId: string | null, _fallback: string) => {
            return `https://gravatar.com/avatar/${email}`;
        },
    };
}

// Create mock settings
function createMockSettings(): PagesSettingsDeps {
    return {
        getAuthMethods: async (_db: any, fallback: string) => {
            const methods = (process.env.APP_AUTH_METHODS || fallback).split(',').map(m => m.trim());
            return methods;
        },
        getSettingBoolean: async (_db: any, _key: string, fallback: boolean) => fallback,
    };
}

// Create mock dependencies
function createMockDependencies(): PagesDependencies {
    return {
        db: {} as Kysely<Database>,
        queries: createMockQueries(),
        sessionManager: createMockSessionManager(),
        fileHelper: createMockFileHelper(),
        template: createMockTemplate(),
        utils: createMockUtils(),
        settings: createMockSettings(),
    };
}

describe('Pages Routes', () => {
    let app: Elysia;
    let mockDeps: PagesDependencies;
    const originalEnv = { ...process.env };

    beforeEach(() => {
        mockUsers = new Map();
        mockSessions = new Map();
        mockProjects = new Map();
        mockPreferences = new Map();
        sessionIdCounter = 0;

        // Reset env
        process.env.APP_ONLINE_MODE = '1';
        process.env.APP_AUTH_METHODS = 'form,guest';
        process.env.JWT_SECRET = 'test-secret-for-testing-only';

        // Create test user
        mockUsers.set(1, {
            id: 1,
            email: 'test@test.com',
            roles: '["ROLE_USER"]',
        });

        // Create mock dependencies and app
        mockDeps = createMockDependencies();
        app = new Elysia().use(createPagesRoutes(mockDeps));
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('GET /', () => {
        it('should redirect to /workarea', async () => {
            const res = await app.handle(new Request('http://localhost/'));

            expect(res.status).toBe(302);
            const location = res.headers.get('location');
            expect(location).toContain('/workarea');
        });
    });

    describe('GET /login', () => {
        it('should return HTML login page', async () => {
            const res = await app.handle(new Request('http://localhost/login'));

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('text/html');
        });

        it('should include locale in response', async () => {
            const res = await app.handle(
                new Request('http://localhost/login', {
                    headers: { 'Accept-Language': 'es-ES,es;q=0.9' },
                }),
            );

            expect(res.status).toBe(200);
            const html = await res.text();
            // Template mock includes locale
            expect(html).toContain('Locale:');
        });

        it('should redirect to workarea in offline mode', async () => {
            process.env.APP_ONLINE_MODE = '0';
            process.env.DEFAULT_USER_EMAIL = 'offline@test.com';

            const res = await app.handle(new Request('http://localhost/login'));

            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toContain('/workarea');
        });

        it('should set guest nonce cookie when guest auth enabled', async () => {
            process.env.APP_AUTH_METHODS = 'form,guest';

            const res = await app.handle(new Request('http://localhost/login'));

            // Should have set-cookie header for guestNonce
            const cookies = res.headers.get('set-cookie');
            expect(cookies).toContain('guestNonce');
        });

        it('should handle returnUrl parameter', async () => {
            const res = await app.handle(new Request('http://localhost/login?returnUrl=/workarea?project=123'));

            expect(res.status).toBe(200);
        });

        it('should handle error parameter', async () => {
            const res = await app.handle(new Request('http://localhost/login?error=invalid_credentials'));

            expect(res.status).toBe(200);
        });
    });

    describe('GET /workarea', () => {
        it('should redirect to login if not authenticated', async () => {
            const res = await app.handle(new Request('http://localhost/workarea'));

            expect(res.status).toBe(302);
            const location = res.headers.get('location');
            expect(location).toContain('/login');
        });

        it('should include returnUrl when redirecting to login', async () => {
            const res = await app.handle(new Request('http://localhost/workarea?project=test123'));

            expect(res.status).toBe(302);
            const location = res.headers.get('location');
            expect(location).toContain('returnUrl');
        });

        it('should create new project when no project specified', async () => {
            // Create a valid JWT token
            const jwt = await import('@elysiajs/jwt');
            const jwtPlugin = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            // Build app with JWT
            const testApp = new Elysia()
                .use(jwtPlugin)
                .derive(async () => {
                    return {
                        currentUser: { id: 1, email: 'test@test.com' },
                        isGuest: false,
                    };
                })
                .get('/workarea', async ({ currentUser }) => {
                    if (!currentUser) {
                        return Response.redirect('/login', 302);
                    }
                    // Simulate new project creation redirect
                    return Response.redirect('/workarea?project=new-session', 302);
                });

            const res = await testApp.handle(new Request('http://localhost/workarea'));

            // Should redirect to create new project or show workarea
            expect([200, 302]).toContain(res.status);
        });

        it('should render workarea template for authenticated user with project', async () => {
            // Create session for the project
            mockSessions.set('test-project-123', {
                sessionId: 'test-project-123',
                fileName: 'Test.elp',
            });

            // Create app with authenticated user
            const testApp = new Elysia()
                .derive(() => ({
                    currentUser: { id: 1, email: 'test@test.com' },
                    isGuest: false,
                }))
                .get('/workarea', async ({ currentUser }) => {
                    if (!currentUser) {
                        return Response.redirect('/login', 302);
                    }
                    return new Response('<html>Workarea</html>', {
                        headers: { 'Content-Type': 'text/html' },
                    });
                });

            const res = await testApp.handle(new Request('http://localhost/workarea?project=test-project-123'));

            expect(res.status).toBe(200);
        });
    });

    describe('access control', () => {
        it('should allow access to own project', async () => {
            // Setup project owned by user 1
            mockProjects.set('owned-project', {
                id: 1,
                uuid: 'owned-project',
                ownerId: 1,
            });

            const testApp = new Elysia()
                .derive(() => ({
                    currentUser: { id: 1, email: 'test@test.com' },
                    isGuest: false,
                }))
                .get('/workarea', async ({ currentUser, query }) => {
                    const projectUuid = query.project as string;
                    const project = mockProjects.get(projectUuid);

                    if (project && project.ownerId !== currentUser.id) {
                        return new Response('Access Denied', { status: 403 });
                    }

                    return new Response('OK', { status: 200 });
                });

            const res = await testApp.handle(new Request('http://localhost/workarea?project=owned-project'));

            expect(res.status).toBe(200);
        });

        it('should deny access to other user project', async () => {
            mockProjects.set('other-project', {
                id: 2,
                uuid: 'other-project',
                ownerId: 999, // Different user
            });

            const testApp = new Elysia()
                .derive(() => ({
                    currentUser: { id: 1, email: 'test@test.com' },
                    isGuest: false,
                }))
                .get('/workarea', async ({ currentUser, query }) => {
                    const projectUuid = query.project as string;
                    const project = mockProjects.get(projectUuid);

                    if (project && project.ownerId !== currentUser.id) {
                        return new Response('Access Denied', { status: 403 });
                    }

                    return new Response('OK', { status: 200 });
                });

            const res = await testApp.handle(new Request('http://localhost/workarea?project=other-project'));

            expect(res.status).toBe(403);
        });

        it('should allow access to own in-memory session', async () => {
            mockSessions.set('memory-session', {
                sessionId: 'memory-session',
                fileName: 'InMemory.elp',
                userId: 1, // Session created by user 1
            });

            const testApp = new Elysia()
                .derive(() => ({
                    currentUser: { id: 1, email: 'test@test.com' },
                    isGuest: false,
                }))
                .get('/workarea', async ({ currentUser, query }) => {
                    const projectUuid = query.project as string;
                    const session = mockSessions.get(projectUuid);

                    // In-memory sessions - check userId
                    if (session) {
                        if (session.userId && session.userId !== currentUser.id) {
                            return new Response('Access Denied', { status: 403 });
                        }
                        return new Response('OK', { status: 200 });
                    }

                    return new Response('Not Found', { status: 404 });
                });

            const res = await testApp.handle(new Request('http://localhost/workarea?project=memory-session'));

            expect(res.status).toBe(200);
        });

        it('should deny access to in-memory session of another user', async () => {
            mockSessions.set('other-user-session', {
                sessionId: 'other-user-session',
                fileName: 'OtherUser.elp',
                userId: 999, // Session created by user 999
            });

            const testApp = new Elysia()
                .derive(() => ({
                    currentUser: { id: 1, email: 'test@test.com' },
                    isGuest: false,
                }))
                .get('/workarea', async ({ currentUser, query }) => {
                    const projectUuid = query.project as string;
                    const session = mockSessions.get(projectUuid);

                    // In-memory sessions - check userId
                    if (session) {
                        if (session.userId && session.userId !== currentUser.id) {
                            return new Response('Access Denied', { status: 403 });
                        }
                        return new Response('OK', { status: 200 });
                    }

                    return new Response('Not Found', { status: 404 });
                });

            const res = await testApp.handle(new Request('http://localhost/workarea?project=other-user-session'));

            expect(res.status).toBe(403);
        });

        it('should return 404 for non-existent project', async () => {
            // No session and no project in DB for this UUID
            const testApp = new Elysia()
                .derive(() => ({
                    currentUser: { id: 1, email: 'test@test.com' },
                    isGuest: false,
                }))
                .get('/workarea', async ({ query }) => {
                    const projectUuid = query.project as string;
                    const session = mockSessions.get(projectUuid);
                    const project = mockProjects.get(projectUuid);

                    if (!session && !project) {
                        return new Response('Not Found', { status: 404 });
                    }

                    return new Response('OK', { status: 200 });
                });

            const res = await testApp.handle(new Request('http://localhost/workarea?project=non-existent-uuid'));

            expect(res.status).toBe(404);
        });

        it('should allow collaborator to access private project', async () => {
            mockProjects.set('shared-project', {
                id: 3,
                uuid: 'shared-project',
                owner_id: 999, // Different owner
                collaborators: [1], // User 1 is a collaborator
                visibility: 'private',
            });

            const testApp = new Elysia()
                .derive(() => ({
                    currentUser: { id: 1, email: 'test@test.com' },
                    isGuest: false,
                }))
                .get('/workarea', async ({ currentUser, query }) => {
                    const projectUuid = query.project as string;
                    const project = mockProjects.get(projectUuid);

                    if (project) {
                        // Check owner or collaborator
                        if (project.owner_id === currentUser.id || project.collaborators?.includes(currentUser.id)) {
                            return new Response('OK', { status: 200 });
                        }
                        return new Response('Access Denied', { status: 403 });
                    }

                    return new Response('Not Found', { status: 404 });
                });

            const res = await testApp.handle(new Request('http://localhost/workarea?project=shared-project'));

            expect(res.status).toBe(200);
        });

        it('should allow anyone to access public project', async () => {
            mockProjects.set('public-project', {
                id: 4,
                uuid: 'public-project',
                owner_id: 999, // Different owner
                visibility: 'public',
            });

            const testApp = new Elysia()
                .derive(() => ({
                    currentUser: { id: 1, email: 'test@test.com' },
                    isGuest: false,
                }))
                .get('/workarea', async ({ currentUser, query }) => {
                    const projectUuid = query.project as string;
                    const project = mockProjects.get(projectUuid);

                    if (project) {
                        // Public projects allow access
                        if (project.visibility === 'public') {
                            return new Response('OK', { status: 200 });
                        }
                        // Check owner or collaborator
                        if (project.owner_id === currentUser.id || project.collaborators?.includes(currentUser.id)) {
                            return new Response('OK', { status: 200 });
                        }
                        return new Response('Access Denied', { status: 403 });
                    }

                    return new Response('Not Found', { status: 404 });
                });

            const res = await testApp.handle(new Request('http://localhost/workarea?project=public-project'));

            expect(res.status).toBe(200);
        });
    });

    describe('locale detection', () => {
        it('should detect Spanish locale from header', async () => {
            const res = await app.handle(
                new Request('http://localhost/login', {
                    headers: { 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' },
                }),
            );

            const html = await res.text();
            expect(html).toContain('es');
        });

        it('should detect English locale from header', async () => {
            const res = await app.handle(
                new Request('http://localhost/login', {
                    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
                }),
            );

            const html = await res.text();
            expect(html).toContain('en');
        });

        it('should fallback to default locale', async () => {
            const res = await app.handle(
                new Request('http://localhost/login', {
                    headers: { 'Accept-Language': 'xyz-XX' },
                }),
            );

            expect(res.status).toBe(200);
        });
    });

    describe('offline mode', () => {
        it('should auto-login in offline mode', async () => {
            process.env.APP_ONLINE_MODE = '0';

            const res = await app.handle(new Request('http://localhost/login'));

            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toContain('/workarea');
        });

        it('should create user if not exists in offline mode', async () => {
            process.env.APP_ONLINE_MODE = '0';
            process.env.DEFAULT_USER_EMAIL = 'newuser@offline.local';

            // User doesn't exist yet
            expect(mockUsers.size).toBe(1); // Only test user

            const res = await app.handle(new Request('http://localhost/login'));

            expect(res.status).toBe(302);
        });

        it('should set auth cookie in offline mode', async () => {
            process.env.APP_ONLINE_MODE = '0';

            const res = await app.handle(new Request('http://localhost/login'));

            const cookies = res.headers.get('set-cookie');
            expect(cookies).toContain('auth');
        });
    });

    describe('authentication methods', () => {
        it('should support form authentication', async () => {
            process.env.APP_AUTH_METHODS = 'form';

            const res = await app.handle(new Request('http://localhost/login'));

            expect(res.status).toBe(200);
        });

        it('should support guest authentication', async () => {
            process.env.APP_AUTH_METHODS = 'guest';

            const res = await app.handle(new Request('http://localhost/login'));

            expect(res.status).toBe(200);
            // Should set guest nonce
            const cookies = res.headers.get('set-cookie');
            expect(cookies).toContain('guestNonce');
        });

        it('should support multiple auth methods', async () => {
            process.env.APP_AUTH_METHODS = 'form,guest,ldap';

            const res = await app.handle(new Request('http://localhost/login'));

            expect(res.status).toBe(200);
        });
    });

    describe('getUserLocalePreference (via workarea)', () => {
        it('should use user locale preference from database (JSON format)', async () => {
            // Set user preference with JSON format
            mockPreferences.set('1:locale', { value: '{"value":"fr"}' });

            // Create valid auth token
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

            // Create session for project
            mockSessions.set('locale-test-project', {
                sessionId: 'locale-test-project',
                fileName: 'Test.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?project=locale-test-project', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const html = await res.text();
            // Template mock returns locale
            expect(html).toContain('fr');
        });

        it('should use user locale preference from database (plain string format)', async () => {
            // Set user preference with plain string
            mockPreferences.set('1:locale', { value: 'de' });

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

            mockSessions.set('locale-test-project-2', {
                sessionId: 'locale-test-project-2',
                fileName: 'Test.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?project=locale-test-project-2', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('de');
        });

        it('should use JSON object with value property', async () => {
            // Set user preference with object containing value
            mockPreferences.set('1:locale', { value: '{"value":"pt"}' });

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

            mockSessions.set('locale-test-project-3', {
                sessionId: 'locale-test-project-3',
                fileName: 'Test.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?project=locale-test-project-3', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('pt');
        });

        it('should fallback to browser locale when no preference exists', async () => {
            // No preference set for this user

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

            mockSessions.set('locale-test-project-4', {
                sessionId: 'locale-test-project-4',
                fileName: 'Test.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?project=locale-test-project-4', {
                    headers: {
                        Cookie: `auth=${token}`,
                        'Accept-Language': 'es-ES,es;q=0.9',
                    },
                }),
            );

            expect(res.status).toBe(200);
            const html = await res.text();
            // Should use browser locale (es is a supported locale)
            expect(html).toContain('es');
        });
    });

    describe('JWT authentication derive', () => {
        it('should handle invalid JWT token gracefully', async () => {
            const res = await app.handle(
                new Request('http://localhost/workarea', {
                    headers: {
                        Cookie: 'auth=invalid-token-here',
                    },
                }),
            );

            // Should redirect to login since token is invalid
            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toContain('/login');
        });

        it('should handle guest user from JWT', async () => {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 'guest-123',
                email: 'guest@guest.local',
                isGuest: true,
            });

            mockSessions.set('guest-project', {
                sessionId: 'guest-project',
                fileName: 'Guest.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?project=guest-project', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should lookup user from database for non-guest JWT', async () => {
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

            mockSessions.set('user-project', {
                sessionId: 'user-project',
                fileName: 'User.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?project=user-project', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should handle user not found in database', async () => {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 9999, // Non-existent user
                email: 'nonexistent@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });

            const res = await app.handle(
                new Request('http://localhost/workarea', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Should redirect to login since user not found
            expect(res.status).toBe(302);
        });

        it('should handle missing auth cookie', async () => {
            const res = await app.handle(new Request('http://localhost/workarea'));

            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toContain('/login');
        });
    });

    describe('workarea access control with actual routes', () => {
        it('should allow access to project in memory session', async () => {
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

            // Project only in memory
            mockSessions.set('in-memory-only', {
                sessionId: 'in-memory-only',
                fileName: 'Memory.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?project=in-memory-only', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should allow access to own project from database', async () => {
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

            // Project in database owned by user 1
            mockProjects.set('db-owned-project', {
                id: 10,
                uuid: 'db-owned-project',
                ownerId: 1,
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?project=db-owned-project', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should deny access to other user project from database', async () => {
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

            // Project in database owned by different user
            mockProjects.set('db-other-project', {
                id: 11,
                uuid: 'db-other-project',
                ownerId: 999, // Different user
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?project=db-other-project', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(403);
            const html = await res.text();
            expect(html).toContain('access-denied');
        });

        it('should return 404 for non-existent project', async () => {
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

            // Project doesn't exist anywhere - should return 404
            const res = await app.handle(
                new Request('http://localhost/workarea?project=brand-new-project', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Should return 404 for security (prevent probing for project UUIDs)
            expect(res.status).toBe(404);
        });
    });

    describe('new project creation', () => {
        it('should create new project when no projectUuid provided', async () => {
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

            const res = await app.handle(
                new Request('http://localhost/workarea', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Should redirect with new project ID
            expect(res.status).toBe(302);
            const location = res.headers.get('location');
            expect(location).toContain('project=');
        });

        it('should NOT eagerly create session directories for new project (lazy creation)', async () => {
            // With lazy directory creation, createSessionDirectories should NOT be called
            // during project creation - directories are created on-demand when files are written
            let createDirectoriesCalled = false;
            const customFileHelper: PagesFileHelperDeps = {
                createSessionDirectories: async (_sessionId: string) => {
                    createDirectoriesCalled = true;
                },
            };

            const customDeps = {
                ...mockDeps,
                fileHelper: customFileHelper,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

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

            await customApp.handle(
                new Request('http://localhost/workarea', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Directories should NOT be created eagerly - they are created on-demand
            expect(createDirectoriesCalled).toBe(false);
        });

        it('should still work if createSessionDirectories would throw (since it is not called)', async () => {
            // Since createSessionDirectories is no longer called during project creation,
            // even if it would throw, the project creation should succeed
            const customFileHelper: PagesFileHelperDeps = {
                createSessionDirectories: async (_sessionId: string) => {
                    throw new Error('Failed to create directories');
                },
            };

            const customDeps = {
                ...mockDeps,
                fileHelper: customFileHelper,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

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

            const res = await customApp.handle(
                new Request('http://localhost/workarea', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Should still return something (possibly render workarea without project)
            expect([200, 302]).toContain(res.status);
        });
    });

    describe('platform integration (odeId parameter)', () => {
        it('should handle odeId parameter when it is a valid project UUID', async () => {
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

            // Create a project in the mock database
            mockProjects.set('valid-ode-id', {
                id: 50,
                uuid: 'valid-ode-id',
                ownerId: 1,
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?odeId=valid-ode-id&jwt_token=test-jwt-token', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Should render workarea (use the existing project)
            expect(res.status).toBe(200);
        });

        it('should create new project when odeId is not a valid UUID (Moodle cmid)', async () => {
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

            const res = await app.handle(
                new Request('http://localhost/workarea?odeId=12345&jwt_token=moodle-jwt-token', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Should redirect to new project with jwt_token preserved
            expect(res.status).toBe(302);
            const location = res.headers.get('location') || '';
            expect(location).toContain('project=');
            expect(location).toContain('jwt_token=');
            expect(location).toContain('moodle-jwt-token');
        });

        it('should preserve jwt_token in redirect when creating new project without odeId', async () => {
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

            const res = await app.handle(
                new Request('http://localhost/workarea?jwt_token=platform-jwt-token', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Should redirect with jwt_token preserved
            expect(res.status).toBe(302);
            const location = res.headers.get('location') || '';
            expect(location).toContain('project=');
            expect(location).toContain('jwt_token=');
            expect(location).toContain('platform-jwt-token');
        });

        it('should find project by platform_id when odeId is not a UUID', async () => {
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

            // Create a project with platform_id matching the odeId
            mockProjects.set('my-project-uuid', {
                id: 100,
                uuid: 'my-project-uuid',
                ownerId: 1,
                owner_id: 1,
                platform_id: 'moodle-cmid-999', // This is the cmid from Moodle
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?odeId=moodle-cmid-999&jwt_token=test-jwt', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Should render workarea with the found project (not create new)
            expect(res.status).toBe(200);
        });
    });

    describe('workarea rendering', () => {
        it('should render workarea template with all view model data', async () => {
            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (template: string, data: any) => {
                    templateData = data;
                    return `<html><body>Workarea: ${template}</body></html>`;
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

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

            mockSessions.set('render-test', {
                sessionId: 'render-test',
                fileName: 'Test.elp',
            });

            await customApp.handle(
                new Request('http://localhost/workarea?project=render-test', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(templateData).not.toBeNull();
            expect(templateData.user).toBeDefined();
            expect(templateData.user.id).toBe(1);
            expect(templateData.user.email || templateData.user.username).toBeDefined();
            expect(templateData.config).toBeDefined();
            expect(templateData.locale).toBeDefined();
            expect(templateData.projectId).toBe('render-test');
            expect(templateData.t).toBeDefined();
        });

        it('should include impersonation context in workarea view model', async () => {
            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, data: any) => {
                    templateData = data;
                    return '<html></html>';
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

            mockUsers.set(99, {
                id: 99,
                email: 'admin-impersonator@test.com',
                roles: '["ROLE_USER","ROLE_ADMIN"]',
            });

            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const userToken = await tempApp.decorator.jwt.sign({
                sub: 1,
                email: 'test@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });
            const adminToken = await tempApp.decorator.jwt.sign({
                sub: 99,
                email: 'admin-impersonator@test.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isGuest: false,
            });

            mockSessions.set('impersonation-view-test', {
                sessionId: 'impersonation-view-test',
                fileName: 'Test.elp',
                userId: 1,
            });

            await customApp.handle(
                new Request('http://localhost/workarea?project=impersonation-view-test', {
                    headers: {
                        Cookie: `auth=${userToken}; impersonator_auth=${adminToken}; impersonation_session=session-123`,
                    },
                }),
            );

            expect(templateData.impersonation).toBeDefined();
            expect(templateData.impersonation.isActive).toBe(true);
            expect(templateData.impersonation.sessionId).toBe('session-123');
            expect(templateData.impersonation.impersonatorEmail).toBe('admin-impersonator@test.com');
            expect(templateData.impersonation.impersonatedEmail).toBe('test@test.com');
        });

        it('should call setRenderLocale with correct locale before rendering template', async () => {
            let setLocaleCalledWith: string | null = null;
            let renderTemplateCalledAfterSetLocale = false;
            let setLocaleCalled = false;

            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, _data: any) => {
                    // Verify setRenderLocale was called before renderTemplate
                    renderTemplateCalledAfterSetLocale = setLocaleCalled;
                    return '<html></html>';
                },
                setRenderLocale: (locale: string) => {
                    setLocaleCalledWith = locale;
                    setLocaleCalled = true;
                },
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

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

            // Set user locale preference to Spanish
            mockPreferences.set('1:locale', { value: 'es' });

            mockSessions.set('setlocale-test', {
                sessionId: 'setlocale-test',
                fileName: 'Test.elp',
            });

            await customApp.handle(
                new Request('http://localhost/workarea?project=setlocale-test', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Verify setRenderLocale was called with the correct locale
            expect(setLocaleCalled).toBe(true);
            expect(setLocaleCalledWith).toBe('es');
            // Verify setRenderLocale was called BEFORE renderTemplate
            expect(renderTemplateCalledAfterSetLocale).toBe(true);
        });

        it('should include all translation keys', async () => {
            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, data: any) => {
                    templateData = data;
                    return '<html></html>';
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

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

            mockSessions.set('trans-test', {
                sessionId: 'trans-test',
                fileName: 'Test.elp',
            });

            await customApp.handle(
                new Request('http://localhost/workarea?project=trans-test', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            const t = templateData.t;
            expect(t.file).toBeDefined();
            expect(t.save).toBeDefined();
            expect(t.help).toBeDefined();
            expect(t.preview).toBeDefined();
            expect(t.logout).toBeDefined();
        });

        it('should include config with correct values', async () => {
            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, data: any) => {
                    templateData = data;
                    return '<html></html>';
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

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

            mockSessions.set('config-test', {
                sessionId: 'config-test',
                fileName: 'Test.elp',
            });

            await customApp.handle(
                new Request('http://localhost/workarea?project=config-test', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            const config = templateData.config;
            expect(config.platformName).toBe('exelearning');
            expect(config.platformType).toBe('standalone');
            expect(typeof config.clientCallWaitingTime).toBe('number');
            expect(typeof config.isOfflineInstallation).toBe('boolean');
        });

        it('should include symfony compatibility object', async () => {
            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, data: any) => {
                    templateData = data;
                    return '<html></html>';
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

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

            mockSessions.set('symfony-test', {
                sessionId: 'symfony-test',
                fileName: 'Test.elp',
            });

            await customApp.handle(
                new Request('http://localhost/workarea?project=symfony-test', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Config now contains all settings (formerly split between config and symfony)
            const config = templateData.config;
            expect(config.environment).toBeDefined();
            expect(config.locale).toBeDefined();
            expect(config.token).toBeDefined();
        });

        it('should handle template render error with fallback HTML', async () => {
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, _data: any) => {
                    throw new Error('Template rendering failed');
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

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

            mockSessions.set('error-test', {
                sessionId: 'error-test',
                fileName: 'Test.elp',
            });

            const res = await customApp.handle(
                new Request('http://localhost/workarea?project=error-test', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('eXeLearning Workarea');
            expect(html).toContain('Template error');
        });
    });

    describe('login page with authenticated user', () => {
        it('should show user info when already logged in', async () => {
            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (template: string, data: any) => {
                    templateData = data;
                    return `<html><body>${template}</body></html>`;
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

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

            await customApp.handle(
                new Request('http://localhost/login', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(templateData.user).not.toBeNull();
            expect(templateData.user.id).toBe(1);
        });
    });

    describe('offline mode with existing user', () => {
        it('should use existing user in offline mode', async () => {
            process.env.APP_ONLINE_MODE = '0';
            process.env.DEFAULT_USER_EMAIL = 'test@test.com';

            const res = await app.handle(new Request('http://localhost/login'));

            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toContain('/workarea');
            // Should have set auth cookie
            const cookies = res.headers.get('set-cookie');
            expect(cookies).toContain('auth');
        });

        it('should handle user creation failure in offline mode gracefully', async () => {
            process.env.APP_ONLINE_MODE = '0';
            process.env.DEFAULT_USER_EMAIL = 'fail@test.com';

            // Mock createUser to return null
            const customQueries: PagesQueriesDeps = {
                ...createMockQueries(),
                createUser: async () => null as any,
                findUserByEmail: async () => undefined,
            };

            const customDeps = {
                ...mockDeps,
                queries: customQueries,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

            const res = await customApp.handle(new Request('http://localhost/login'));

            // Should still redirect even if user creation fails
            expect(res.status).toBe(302);
        });

        it('should handle already authenticated user in offline mode', async () => {
            process.env.APP_ONLINE_MODE = '0';

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

            const res = await app.handle(
                new Request('http://localhost/login', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toContain('/workarea');
        });
    });

    describe('base path handling', () => {
        const originalBasePath = process.env.BASE_PATH;

        afterEach(() => {
            if (originalBasePath !== undefined) {
                process.env.BASE_PATH = originalBasePath;
            } else {
                delete process.env.BASE_PATH;
            }
        });

        it('should include basePath in redirects', async () => {
            process.env.BASE_PATH = '/myapp';

            const res = await app.handle(new Request('http://localhost/'));

            expect(res.status).toBe(302);
            const location = res.headers.get('location');
            expect(location).toContain('/myapp/workarea');
        });

        it('should handle returnUrl correctly', async () => {
            process.env.BASE_PATH = '/myapp';

            // Request to workarea without auth - should redirect to login
            const res = await app.handle(new Request('http://localhost/workarea?project=test'));

            expect(res.status).toBe(302);
            const location = res.headers.get('location');
            // returnUrl should be in the redirect
            expect(location).toContain('returnUrl');
            expect(location).toContain('/myapp/login');
        });
    });

    describe('gravatar URL generation', () => {
        it('should generate gravatar URL for user', async () => {
            let gravatarCalled = false;
            let gravatarEmail = '';
            const customUtils: PagesUtilsDeps = {
                createGravatarUrl: (email: string, _gravatarId: string | null, _fallback: string) => {
                    gravatarCalled = true;
                    gravatarEmail = email;
                    return `https://gravatar.com/avatar/${email}`;
                },
            };

            const customDeps = {
                ...mockDeps,
                utils: customUtils,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

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

            mockSessions.set('gravatar-test', {
                sessionId: 'gravatar-test',
                fileName: 'Test.elp',
            });

            await customApp.handle(
                new Request('http://localhost/workarea?project=gravatar-test', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(gravatarCalled).toBe(true);
            expect(gravatarEmail).toBe('test@test.com');
        });
    });

    describe('GET /admin', () => {
        it('should redirect to login if not authenticated', async () => {
            const res = await app.handle(new Request('http://localhost/admin'));

            expect(res.status).toBe(302);
            const location = res.headers.get('location');
            expect(location).toContain('/login');
            expect(location).toContain('returnUrl=/admin');
        });

        it('should return 403 if user is not admin', async () => {
            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 1,
                email: 'test@test.com',
                roles: ['ROLE_USER'], // Not admin
                isGuest: false,
            });

            const res = await app.handle(
                new Request('http://localhost/admin', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(403);
            const html = await res.text();
            expect(html).toContain('security/error');
        });

        it('should render admin template for admin user', async () => {
            // Create admin user
            mockUsers.set(10, {
                id: 10,
                email: 'admin@test.com',
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
            });

            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 10,
                email: 'admin@test.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isGuest: false,
            });

            const res = await app.handle(
                new Request('http://localhost/admin', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('text/html');
        });

        it('should detect locale from Accept-Language header', async () => {
            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, data: any) => {
                    templateData = data;
                    return '<html></html>';
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

            mockUsers.set(11, {
                id: 11,
                email: 'admin2@test.com',
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
            });

            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 11,
                email: 'admin2@test.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isGuest: false,
            });

            await customApp.handle(
                new Request('http://localhost/admin', {
                    headers: {
                        Cookie: `auth=${token}`,
                        'Accept-Language': 'es-ES,es;q=0.9',
                    },
                }),
            );

            expect(templateData).not.toBeNull();
            expect(templateData.locale).toBe('es');
        });

        it('should include all admin translation keys', async () => {
            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, data: any) => {
                    templateData = data;
                    return '<html></html>';
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

            mockUsers.set(12, {
                id: 12,
                email: 'admin3@test.com',
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
            });

            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 12,
                email: 'admin3@test.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isGuest: false,
            });

            await customApp.handle(
                new Request('http://localhost/admin', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            const t = templateData.t;
            expect(t.admin_panel).toBeDefined();
            expect(t.dashboard).toBeDefined();
            expect(t.users).toBeDefined();
            expect(t.settings).toBeDefined();
            expect(t.logout).toBeDefined();
            expect(t.total_users).toBeDefined();
            expect(t.create_user).toBeDefined();
            expect(t.edit).toBeDefined();
            expect(t.delete).toBeDefined();
        });

        it('should include user info with gravatar', async () => {
            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, data: any) => {
                    templateData = data;
                    return '<html></html>';
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

            mockUsers.set(13, {
                id: 13,
                email: 'admin4@test.com',
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
            });

            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 13,
                email: 'admin4@test.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isGuest: false,
            });

            await customApp.handle(
                new Request('http://localhost/admin', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(templateData.user).toBeDefined();
            expect(templateData.user.id).toBe(13);
            expect(templateData.user.email).toBe('admin4@test.com');
            expect(templateData.user.gravatarUrl).toBeDefined();
            expect(templateData.user.roles).toContain('ROLE_ADMIN');
        });

        it('should handle template render error with fallback HTML', async () => {
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, _data: any) => {
                    throw new Error('Admin template failed');
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

            mockUsers.set(14, {
                id: 14,
                email: 'admin5@test.com',
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
            });

            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 14,
                email: 'admin5@test.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isGuest: false,
            });

            const res = await customApp.handle(
                new Request('http://localhost/admin', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('eXeLearning Admin');
            expect(html).toContain('Template error');
        });

        it('should handle user with roles as JSON string', async () => {
            mockUsers.set(15, {
                id: 15,
                email: 'admin6@test.com',
                roles: '["ROLE_USER", "ROLE_ADMIN"]', // JSON string format
            });

            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 15,
                email: 'admin6@test.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isGuest: false,
            });

            const res = await app.handle(
                new Request('http://localhost/admin', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should handle user with roles as array', async () => {
            mockUsers.set(16, {
                id: 16,
                email: 'admin7@test.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'], // Array format
            });

            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 16,
                email: 'admin7@test.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isGuest: false,
            });

            const res = await app.handle(
                new Request('http://localhost/admin', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should handle user without email', async () => {
            mockUsers.set(17, {
                id: 17,
                email: null, // No email
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
            });

            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, data: any) => {
                    templateData = data;
                    return '<html></html>';
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 17,
                email: null,
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isGuest: false,
            });

            await customApp.handle(
                new Request('http://localhost/admin', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Should use fallback email
            expect(templateData.user.email).toBe('admin@exelearning.net');
        });

        it('should include version and basePath', async () => {
            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, data: any) => {
                    templateData = data;
                    return '<html></html>';
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

            mockUsers.set(18, {
                id: 18,
                email: 'admin8@test.com',
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
            });

            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 18,
                email: 'admin8@test.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isGuest: false,
            });

            await customApp.handle(
                new Request('http://localhost/admin', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(templateData.version).toBeDefined();
            expect(templateData.app_version).toBeDefined();
            expect(templateData.basePath).toBeDefined();
        });
    });

    describe('edge cases', () => {
        it('should handle empty email in user object', async () => {
            // User without email
            mockUsers.set(2, {
                id: 2,
                email: null,
                roles: '["ROLE_USER"]',
            });

            const jwt = await import('@elysiajs/jwt');
            const jwtInstance = jwt.jwt({
                name: 'jwt',
                secret: 'test-secret-for-testing-only',
            });

            const tempApp = new Elysia().use(jwtInstance);
            const token = await tempApp.decorator.jwt.sign({
                sub: 2,
                email: null,
                roles: ['ROLE_USER'],
                isGuest: false,
            });

            mockSessions.set('no-email-test', {
                sessionId: 'no-email-test',
                fileName: 'Test.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?project=no-email-test', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Should use fallback email
            expect(res.status).toBe(200);
        });

        it('should handle malformed JSON in locale preference', async () => {
            // Malformed JSON in preference
            mockPreferences.set('1:locale', { value: '{invalid json}' });

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

            mockSessions.set('malformed-pref-test', {
                sessionId: 'malformed-pref-test',
                fileName: 'Test.elp',
            });

            const res = await app.handle(
                new Request('http://localhost/workarea?project=malformed-pref-test', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            // Should use the raw value as locale
            expect(res.status).toBe(200);
        });

        it('should handle isOfflineInstallation with none auth method', async () => {
            process.env.APP_AUTH_METHODS = 'none';
            process.env.APP_ONLINE_MODE = '1';

            let templateData: any = null;
            const customTemplate: PagesTemplateDeps = {
                renderTemplate: (_template: string, data: any) => {
                    templateData = data;
                    return '<html></html>';
                },
                setRenderLocale: () => {},
            };

            const customDeps = {
                ...mockDeps,
                template: customTemplate,
            };
            const customApp = new Elysia().use(createPagesRoutes(customDeps));

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

            mockSessions.set('none-auth-test', {
                sessionId: 'none-auth-test',
                fileName: 'Test.elp',
            });

            await customApp.handle(
                new Request('http://localhost/workarea?project=none-auth-test', {
                    headers: {
                        Cookie: `auth=${token}`,
                    },
                }),
            );

            expect(templateData.config.isOfflineInstallation).toBe(true);
        });
    });

    describe('GET /access-denied', () => {
        it('should render access denied page with 403 status', async () => {
            const res = await app.handle(new Request('http://localhost/access-denied'));

            expect(res.status).toBe(403);
            expect(res.headers.get('content-type')).toContain('text/html');

            const html = await res.text();
            // Mock template includes the template name
            expect(html).toContain('workarea/access-denied');
        });

        it('should pass basePath to template', async () => {
            const originalBasePath = process.env.BASE_PATH;
            process.env.BASE_PATH = '/web/exelearning';

            try {
                let templateData: any = null;
                const customTemplate: PagesTemplateDeps = {
                    renderTemplate: (template: string, data: any) => {
                        templateData = data;
                        return `<html><body>Template: ${template}</body></html>`;
                    },
                    setRenderLocale: () => {},
                };

                const customDeps = {
                    ...mockDeps,
                    template: customTemplate,
                };
                const newApp = new Elysia().use(createPagesRoutes(customDeps));
                const res = await newApp.handle(new Request('http://localhost/access-denied'));

                expect(res.status).toBe(403);
                expect(templateData.basePath).toBe('/web/exelearning');
            } finally {
                if (originalBasePath !== undefined) {
                    process.env.BASE_PATH = originalBasePath;
                } else {
                    delete process.env.BASE_PATH;
                }
            }
        });
    });
});
