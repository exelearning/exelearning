/**
 * Platform Integration Routes Tests
 * Tests for platform integration endpoints
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SignJWT } from 'jose';
import { platformIntegrationRoutes } from './platform-integration';

describe('Platform Integration Routes', () => {
    // Store original environment variables
    let originalEnv: Record<string, string | undefined>;

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
    });

    afterEach(() => {
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

        // Note: Testing successful fetch would require mocking the platform HTTP call
        // This is better suited for integration tests
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
            expect(data.success).toBe(false);
            expect(data.error).toContain('Invalid token');
        });

        // Note: Testing successful upload would require:
        // 1. A project in the database
        // 2. Yjs document with content
        // 3. Mock platform server to receive the upload
        // This is better suited for integration tests
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
    });
});
