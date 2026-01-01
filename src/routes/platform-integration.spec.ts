/**
 * Platform Integration Routes Tests
 * Tests for platform integration endpoints
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SignJWT } from 'jose';
import { platformIntegrationRoutes } from './platform-integration';
import {
    configure as configureService,
    resetDependencies as resetServiceDependencies,
} from '../services/platform-integration';

describe('Platform Integration Routes', () => {
    // Store original environment variables
    let originalEnv: Record<string, string | undefined>;
    // Store original fetch
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        originalEnv = {
            APP_SECRET: process.env.APP_SECRET,
            PROVIDER_URLS: process.env.PROVIDER_URLS,
            PROVIDER_TOKENS: process.env.PROVIDER_TOKENS,
            PROVIDER_IDS: process.env.PROVIDER_IDS,
            BASE_PATH: process.env.BASE_PATH,
        };
        // Set a test secret
        process.env.APP_SECRET = 'test-secret-for-jwt';
        delete process.env.BASE_PATH;
        delete process.env.PROVIDER_IDS;
        delete process.env.PROVIDER_TOKENS;
        delete process.env.PROVIDER_URLS;
    });

    afterEach(() => {
        // Restore original fetch
        globalThis.fetch = originalFetch;
        // Reset service dependencies
        resetServiceDependencies();
        // Restore original environment variables
        Object.keys(originalEnv).forEach(key => {
            if (originalEnv[key] !== undefined) {
                process.env[key] = originalEnv[key];
            } else {
                delete process.env[key];
            }
        });
    });

    const app = platformIntegrationRoutes;

    /**
     * Create a valid JWT token for testing
     */
    async function createValidToken(payload: Record<string, unknown> = {}): Promise<string> {
        const fullPayload = {
            userid: '123',
            cmid: '456',
            returnurl: 'https://moodle.example.com/mod/exescorm/view.php?id=1',
            pkgtype: 'scorm',
            ...payload,
        };

        return new SignJWT(fullPayload)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(new TextEncoder().encode(process.env.APP_SECRET));
    }

    describe('GET /new_ode', () => {
        it('should return 400 when jwt_token is missing', async () => {
            const response = await app.handle(new Request('http://localhost/new_ode'));

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.error).toBe('Bad Request');
            expect(data.message).toContain('jwt_token');
        });

        it('should return 401 for invalid token', async () => {
            const response = await app.handle(new Request('http://localhost/new_ode?jwt_token=invalid-token'));

            expect(response.status).toBe(401);

            const data = await response.json();
            expect(data.error).toBe('Unauthorized');
        });

        it('should redirect to workarea for valid token', async () => {
            const token = await createValidToken();

            const response = await app.handle(
                new Request(`http://localhost/new_ode?jwt_token=${encodeURIComponent(token)}`),
            );

            expect(response.status).toBe(302);

            const location = response.headers.get('location');
            expect(location).toContain('/workarea');
            expect(location).toContain('newOde=new');
            expect(location).toContain('jwt_token=');
        });

        it('should preserve jwt_token in redirect URL', async () => {
            const token = await createValidToken();

            const response = await app.handle(
                new Request(`http://localhost/new_ode?jwt_token=${encodeURIComponent(token)}`),
            );

            const location = response.headers.get('location');
            // The token should be URL-encoded in the redirect
            expect(location).toContain('jwt_token=');
        });

        it('should respect BASE_PATH in redirect URL', async () => {
            process.env.BASE_PATH = '/exelearning';
            const token = await createValidToken();

            const response = await app.handle(
                new Request(`http://localhost/new_ode?jwt_token=${encodeURIComponent(token)}`),
            );

            expect(response.status).toBe(302);
            const location = response.headers.get('location');
            expect(location).toContain('/exelearning/workarea');
        });
    });

    describe('GET /edit_ode', () => {
        it('should return 400 when jwt_token is missing', async () => {
            const response = await app.handle(new Request('http://localhost/edit_ode?ode_id=123'));

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.error).toBe('Bad Request');
        });

        it('should return 401 for invalid token', async () => {
            const response = await app.handle(new Request('http://localhost/edit_ode?ode_id=123&jwt_token=invalid'));

            expect(response.status).toBe(401);

            const data = await response.json();
            expect(data.error).toBe('Unauthorized');
        });

        it('should redirect to workarea for valid token with ode_id', async () => {
            const token = await createValidToken();

            const response = await app.handle(
                new Request(`http://localhost/edit_ode?ode_id=project-123&jwt_token=${encodeURIComponent(token)}`),
            );

            expect(response.status).toBe(302);

            const location = response.headers.get('location');
            expect(location).toContain('/workarea');
            expect(location).toContain('odeId=project-123');
            expect(location).toContain('jwt_token=');
        });

        it('should use cmid from JWT when ode_id not provided', async () => {
            const token = await createValidToken({ cmid: 'jwt-cmid-789' });

            const response = await app.handle(
                new Request(`http://localhost/edit_ode?jwt_token=${encodeURIComponent(token)}`),
            );

            expect(response.status).toBe(302);

            const location = response.headers.get('location');
            expect(location).toContain('odeId=jwt-cmid-789');
        });

        it('should respect BASE_PATH in redirect URL', async () => {
            process.env.BASE_PATH = '/myapp';
            const token = await createValidToken();

            const response = await app.handle(
                new Request(`http://localhost/edit_ode?ode_id=123&jwt_token=${encodeURIComponent(token)}`),
            );

            expect(response.status).toBe(302);
            const location = response.headers.get('location');
            expect(location).toContain('/myapp/workarea');
        });
    });

    describe('POST /api/platform/integration/openPlatformElp', () => {
        it('should return 401 for invalid token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/openPlatformElp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jwt_token: 'invalid-token' }),
                }),
            );

            expect(response.status).toBe(401);

            const data = await response.json();
            expect(data.responseMessage).toBe('ERROR');
            expect(data.error).toContain('Invalid token');
        });

        it('should return ELP data on success', async () => {
            const token = await createValidToken();

            // Mock fetch to return ELP data
            globalThis.fetch = async () =>
                new Response(
                    JSON.stringify({
                        ode_file: 'base64EncodedContent',
                        ode_filename: 'test-project.elp',
                        status: '0',
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                );

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/openPlatformElp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jwt_token: token }),
                }),
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.responseMessage).toBe('OK');
            expect(data.elpFile).toBe('base64EncodedContent');
            expect(data.elpFileName).toBe('test-project.elp');
        });

        it('should return 500 when platform returns error', async () => {
            const token = await createValidToken();

            // Mock fetch to return error
            globalThis.fetch = async () => new Response(null, { status: 500 });

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/openPlatformElp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jwt_token: token }),
                }),
            );

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.responseMessage).toBe('ERROR');
        });

        it('should return 500 when network error occurs', async () => {
            const token = await createValidToken();

            // Mock fetch to throw error
            globalThis.fetch = async () => {
                throw new Error('Network error');
            };

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/openPlatformElp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jwt_token: token }),
                }),
            );

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.responseMessage).toBe('ERROR');
            expect(data.error).toContain('Network error');
        });
    });

    describe('POST /api/platform/integration/set_platform_new_ode', () => {
        it('should return 401 for invalid token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/set_platform_new_ode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectUuid: 'test-uuid',
                        jwt_token: 'invalid-token',
                    }),
                }),
            );

            expect(response.status).toBe(401);

            const data = await response.json();
            expect(data.responseMessage).toContain('Invalid token');
        });

        it('should return error when project not found', async () => {
            const token = await createValidToken();

            // Configure service with mock that returns null for project
            configureService({
                findProjectByUuid: async () => null,
            });

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/set_platform_new_ode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectUuid: 'non-existent-uuid',
                        jwt_token: token,
                    }),
                }),
            );

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.responseMessage).toContain('Project not found');
        });

        it('should return success when upload succeeds', async () => {
            const token = await createValidToken();
            const mockSnapshot = createMockSnapshot();

            // Configure service with mocks
            configureService({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
                updateProjectByUuid: async () => undefined, // Mock update for platform_id
            });

            // Mock fetch to return success
            const platformResponse = { success: true, message: 'Upload complete' };
            globalThis.fetch = async () =>
                new Response(JSON.stringify(platformResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/set_platform_new_ode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectUuid: 'test-uuid',
                        jwt_token: token,
                    }),
                }),
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.responseMessage).toBe('OK');
            expect(data.returnUrl).toBeDefined();
        });

        it('should return 500 when platform returns error', async () => {
            const token = await createValidToken();
            const mockSnapshot = createMockSnapshot();

            configureService({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
            });

            // Mock fetch to return error
            globalThis.fetch = async () => new Response(null, { status: 500 });

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/set_platform_new_ode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectUuid: 'test-uuid',
                        jwt_token: token,
                    }),
                }),
            );

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.responseMessage).toBeDefined();
            expect(data.responseMessage).not.toBe('OK');
        });

        it('should return 500 when network error occurs', async () => {
            const token = await createValidToken();
            const mockSnapshot = createMockSnapshot();

            configureService({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
            });

            // Mock fetch to throw error
            globalThis.fetch = async () => {
                throw new Error('Connection refused');
            };

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/set_platform_new_ode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectUuid: 'test-uuid',
                        jwt_token: token,
                    }),
                }),
            );

            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.responseMessage).toContain('Connection refused');
        });
    });

    describe('Token validation', () => {
        it('should reject expired tokens', async () => {
            // Create an expired token
            const token = await new SignJWT({
                userid: '123',
                cmid: '456',
                returnurl: 'https://moodle.example.com/mod/exescorm/view.php',
                pkgtype: 'scorm',
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt(Date.now() / 1000 - 7200) // 2 hours ago
                .setExpirationTime(Date.now() / 1000 - 3600) // 1 hour ago
                .sign(new TextEncoder().encode(process.env.APP_SECRET));

            const response = await app.handle(
                new Request(`http://localhost/new_ode?jwt_token=${encodeURIComponent(token)}`),
            );

            expect(response.status).toBe(401);
        });

        it('should reject tokens signed with wrong secret', async () => {
            const token = await new SignJWT({
                userid: '123',
                cmid: '456',
                returnurl: 'https://moodle.example.com/mod/exescorm/view.php',
                pkgtype: 'scorm',
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('1h')
                .sign(new TextEncoder().encode('wrong-secret'));

            const response = await app.handle(
                new Request(`http://localhost/new_ode?jwt_token=${encodeURIComponent(token)}`),
            );

            expect(response.status).toBe(401);
        });
    });

    describe('Provider validation', () => {
        it('should reject tokens from unknown providers when providers are configured', async () => {
            process.env.PROVIDER_IDS = 'allowed-provider';

            const token = await createValidToken({ provider_id: 'unknown-provider' });

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/openPlatformElp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jwt_token: token }),
                }),
            );

            expect(response.status).toBe(401);
        });

        it('should reject tokens with return URLs not in allowed providers', async () => {
            process.env.PROVIDER_URLS = 'https://allowed-moodle.com';

            const token = await createValidToken({
                returnurl: 'https://other-moodle.com/mod/exescorm/view.php',
            });

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/openPlatformElp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jwt_token: token }),
                }),
            );

            expect(response.status).toBe(401);
        });

        it('should accept tokens from allowed providers', async () => {
            process.env.PROVIDER_IDS = 'my-moodle';
            process.env.PROVIDER_TOKENS = 'test-secret-for-jwt';
            process.env.PROVIDER_URLS = 'https://moodle.example.com';

            const token = await createValidToken({ provider_id: 'my-moodle' });

            // Mock fetch to return success
            globalThis.fetch = async () =>
                new Response(
                    JSON.stringify({
                        ode_file: 'content',
                        ode_filename: 'file.elp',
                        status: '0',
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                );

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/openPlatformElp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jwt_token: token }),
                }),
            );

            expect(response.status).toBe(200);
        });
    });
});

/**
 * Create a minimal mock Yjs document with the required structure
 */
function createMockYjsDocument() {
    const Y = require('yjs');
    const doc = new Y.Doc();

    const metadata = doc.getMap('metadata');
    metadata.set('title', 'Test Project');
    metadata.set('author', 'Test Author');
    metadata.set('language', 'en');
    metadata.set('license', 'CC BY-SA 4.0');

    const navigation = doc.getArray('navigation');
    const rootPage = new Y.Map();
    rootPage.set('id', 'root');
    rootPage.set('pageName', 'Home');
    rootPage.set('parentId', null);
    rootPage.set('order', 0);
    rootPage.set('blocks', new Y.Array());
    navigation.push([rootPage]);

    return doc;
}

/**
 * Create a mock snapshot object as returned by findSnapshotByProjectId
 */
function createMockSnapshot() {
    const Y = require('yjs');
    const doc = createMockYjsDocument();
    const snapshotData = Y.encodeStateAsUpdate(doc);

    return {
        id: 1,
        project_id: 1,
        snapshot_data: snapshotData,
        snapshot_version: '1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}
