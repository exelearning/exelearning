/**
 * Platform Integration Routes Tests
 * Tests for platform integration endpoints
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SignJWT } from 'jose';
import {
    platformIntegrationRoutes,
    configurePlatformIntegrationRoutes,
    resetPlatformIntegrationRoutesDependencies,
} from './platform-integration';
import {
    configure as configureService,
    hashPlatformPackage,
    resetDependencies as resetServiceDependencies,
} from '../services/platform-integration';
import { getJwtSecret } from './auth';

describe('Platform Integration Routes', () => {
    // Store original environment variables
    let originalEnv: Record<string, string | undefined>;
    // Store original fetch
    const originalFetch = globalThis.fetch;
    // Hermetic DNS resolver so safeFetch (now used by the service) never hits
    // the network for the example returnurl hosts.
    const publicLookup = async (_host: string) => [{ address: '93.184.216.34' }];

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
        // Provider URL validation now fails closed (bug M3): an empty allow-list rejects every
        // returnurl. Configure a default allow-list matching the happy-path return URLs so the
        // many 200-expecting tests keep passing. Tests that set their own PROVIDER_URLS override this.
        process.env.PROVIDER_URLS = 'https://moodle.example.com';
        // Default hermetic DNS resolver for outbound platform fetches.
        configureService({ lookupFn: publicLookup });
    });

    afterEach(() => {
        // Restore original fetch
        globalThis.fetch = originalFetch;
        // Reset service dependencies
        resetServiceDependencies();
        // Reset route-level dependencies (ownership check lookup)
        resetPlatformIntegrationRoutesDependencies();
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

        it('tells the editor to keep the project when it already holds the platform package', async () => {
            const token = await createValidToken();
            const packageBytes = Buffer.from('PK stored package');
            configureService({
                lookupFn: publicLookup,
                findProjectByUuid: async () =>
                    makeProjectRow({
                        uuid: 'bound-uuid',
                        platform_id: '456',
                        platform_site: 'https://moodle.example.com',
                        platform_package_hash: hashPlatformPackage(packageBytes),
                    }),
            });
            globalThis.fetch = async () =>
                new Response(
                    JSON.stringify({ ode_file: packageBytes.toString('base64'), ode_filename: 'a.zip', status: '0' }),
                    { status: 200 },
                );

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/openPlatformElp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jwt_token: token, projectUuid: 'bound-uuid' }),
                }),
            );

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ responseMessage: 'OK', unchanged: true });
        });

        it('returns the package and its hash when the project does not hold it yet', async () => {
            const token = await createValidToken();
            const packageBytes = Buffer.from('PK changed package');
            configureService({
                lookupFn: publicLookup,
                findProjectByUuid: async () =>
                    makeProjectRow({
                        uuid: 'bound-uuid',
                        platform_id: '456',
                        platform_site: 'https://moodle.example.com',
                        platform_package_hash: hashPlatformPackage(Buffer.from('PK older package')),
                    }),
            });
            globalThis.fetch = async () =>
                new Response(
                    JSON.stringify({ ode_file: packageBytes.toString('base64'), ode_filename: 'a.zip', status: '0' }),
                    { status: 200 },
                );

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/openPlatformElp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jwt_token: token, projectUuid: 'bound-uuid' }),
                }),
            );

            const data = await response.json();
            expect(data.unchanged).toBeUndefined();
            expect(data.elpFile).toBe(packageBytes.toString('base64'));
            expect(data.packageHash).toBe(hashPlatformPackage(packageBytes));
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

            // Route ownership lookup also sees no project, so the gate defers
            // to the service, which returns the canonical "Project not found".
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () => undefined,
            });

            // Configure service with mock that returns null for project
            configureService({ lookupFn: publicLookup, findProjectByUuid: async () => null });

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

            // Project is already linked to the same platform module (cmid '456'
            // from the JWT), so the ownership gate must allow the export.
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () => makeProjectRow({ uuid: 'test-uuid', platform_id: '456' }),
            });

            // Configure service with mocks
            configureService({
                lookupFn: publicLookup,
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

            // Unlinked project (platform_id null) passes the ownership gate.
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () => makeProjectRow({ uuid: 'test-uuid', platform_id: null }),
            });

            configureService({
                lookupFn: publicLookup,
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

            // Unlinked project (platform_id null) passes the ownership gate.
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () => makeProjectRow({ uuid: 'test-uuid', platform_id: null }),
            });

            configureService({
                lookupFn: publicLookup,
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

        it('returns 403 and performs no export/post-back when the project belongs to another platform module (IDOR)', async () => {
            // Attacker holds a valid JWT for their own course module (cmid '456'),
            // but supplies a victim's projectUuid that is bound to a different
            // module (cmid '999'). The ownership gate must deny the request.
            const token = await createValidToken({ cmid: '456' });

            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () => makeProjectRow({ uuid: 'victim-uuid', platform_id: '999' }),
            });

            // Spy on the export/post-back dependencies. None of them must run.
            let snapshotLookupCalled = false;
            let updateCalled = false;
            configureService({
                lookupFn: publicLookup,
                findProjectByUuid: async () => {
                    throw new Error('service.findProjectByUuid must not run when access is denied');
                },
                findSnapshotByProjectId: async () => {
                    snapshotLookupCalled = true;
                    return createMockSnapshot();
                },
                updateProjectByUuid: async () => {
                    updateCalled = true;
                    return undefined;
                },
            });

            // Network must never be touched (no ZIP shipped to the platform).
            let fetchCalled = false;
            globalThis.fetch = async () => {
                fetchCalled = true;
                return new Response(JSON.stringify({ status: '0' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            };

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/set_platform_new_ode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectUuid: 'victim-uuid',
                        jwt_token: token,
                    }),
                }),
            );

            expect(response.status).toBe(403);

            const data = await response.json();
            expect(data.responseMessage).toContain('Forbidden');

            // Critically: no export was generated and nothing was posted back.
            expect(fetchCalled).toBe(false);
            expect(snapshotLookupCalled).toBe(false);
            expect(updateCalled).toBe(false);
        });

        it('proceeds when the project is bound to the same platform module as the JWT', async () => {
            // Project's platform_id matches the JWT cmid: legitimate re-save.
            const token = await createValidToken({ cmid: '456' });
            const mockSnapshot = createMockSnapshot();

            let snapshotLookupCalled = false;
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () => makeProjectRow({ uuid: 'owned-uuid', platform_id: '456' }),
            });
            configureService({
                lookupFn: publicLookup,
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'owned-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => {
                    snapshotLookupCalled = true;
                    return mockSnapshot;
                },
                updateProjectByUuid: async () => undefined,
            });

            globalThis.fetch = async () =>
                new Response(JSON.stringify({ status: '0' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });

            const response = await app.handle(
                new Request('http://localhost/api/platform/integration/set_platform_new_ode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectUuid: 'owned-uuid',
                        jwt_token: token,
                    }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.responseMessage).toBe('OK');
            // The gate let the export proceed.
            expect(snapshotLookupCalled).toBe(true);
        });
    });

    describe('POST /api/platform/integration/set_platform_new_ode (activity bindings)', () => {
        async function postServerExport(token: string): Promise<Response> {
            return app.handle(
                new Request('http://localhost/api/platform/integration/set_platform_new_ode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectUuid: 'bound-uuid', jwt_token: token }),
                }),
            );
        }

        it('accepts a project bound to the activity when Moodle signs cmid as a number', async () => {
            const token = await createValidToken({ cmid: 456 });
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () =>
                    makeProjectRow({
                        uuid: 'bound-uuid',
                        platform_id: '456',
                        platform_site: 'https://moodle.example.com',
                    }),
            });
            configureService({
                lookupFn: publicLookup,
                findProjectByUuid: async () => makeProjectRow({ uuid: 'bound-uuid' }),
                findSnapshotByProjectId: async () => createMockSnapshot(),
                updateProjectByUuid: async () => undefined,
            });
            globalThis.fetch = async () => new Response(JSON.stringify({ status: '0' }), { status: 200 });

            const response = await postServerExport(token);

            expect(response.status).toBe(200);
        });

        it('rejects a project bound to the same cmid on another platform site', async () => {
            const token = await createValidToken({ cmid: 456 });
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () =>
                    makeProjectRow({
                        uuid: 'bound-uuid',
                        platform_id: '456',
                        platform_site: 'https://other-moodle.example.com',
                    }),
            });
            let fetchCalled = false;
            globalThis.fetch = async () => {
                fetchCalled = true;
                return new Response(JSON.stringify({ status: '0' }), { status: 200 });
            };

            const response = await postServerExport(token);

            expect(response.status).toBe(403);
            expect(fetchCalled).toBe(false);
        });
    });

    describe('POST /api/platform/integration/confirmPlatformElpImport', () => {
        const packageHash = hashPlatformPackage(Buffer.from('PK imported package'));

        async function signIn(userId: number): Promise<string> {
            return new SignJWT({ sub: userId, email: `user${userId}@test.com`, roles: ['ROLE_USER'] })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('1h')
                .sign(new TextEncoder().encode(getJwtSecret()));
        }

        async function confirmImport(body: Record<string, unknown>, userId: number | null = 1): Promise<Response> {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userId !== null) {
                headers.Cookie = `auth=${await signIn(userId)}`;
            }
            return app.handle(
                new Request('http://localhost/api/platform/integration/confirmPlatformElpImport', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                }),
            );
        }

        function bindProject(overrides: Parameters<typeof makeProjectRow>[0] = {}): Record<string, unknown>[] {
            const updates: Record<string, unknown>[] = [];
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () =>
                    makeProjectRow({
                        uuid: 'bound-uuid',
                        platform_id: '456',
                        platform_site: 'https://moodle.example.com',
                        ...overrides,
                    }),
            });
            configureService({
                lookupFn: publicLookup,
                updateProjectByUuid: async (_db, _uuid, data) => {
                    updates.push(data);
                    return undefined;
                },
            });
            return updates;
        }

        it("records the imported package on the user's project for the activity", async () => {
            const updates = bindProject();
            const token = await createValidToken({ cmid: 456 });

            const response = await confirmImport({ jwt_token: token, projectUuid: 'bound-uuid', packageHash });

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ responseMessage: 'OK' });
            expect(updates).toEqual([
                { platform_id: '456', platform_site: 'https://moodle.example.com', platform_package_hash: packageHash },
            ]);
        });

        it('requires an eXeLearning session', async () => {
            const updates = bindProject();
            const token = await createValidToken({ cmid: 456 });

            const response = await confirmImport({ jwt_token: token, projectUuid: 'bound-uuid', packageHash }, null);

            expect(response.status).toBe(401);
            expect(updates).toHaveLength(0);
        });

        it("refuses to record a package on another user's project", async () => {
            const updates = bindProject({ owner_id: 2 });
            const token = await createValidToken({ cmid: 456 });

            const response = await confirmImport({ jwt_token: token, projectUuid: 'bound-uuid', packageHash });

            expect(response.status).toBe(403);
            expect(updates).toHaveLength(0);
        });

        it('refuses a project bound to another activity', async () => {
            const updates = bindProject({ platform_id: '999' });
            const token = await createValidToken({ cmid: 456 });

            const response = await confirmImport({ jwt_token: token, projectUuid: 'bound-uuid', packageHash });

            expect(response.status).toBe(403);
            expect(updates).toHaveLength(0);
        });

        it('rejects an invalid platform token, a missing project or a malformed hash', async () => {
            const updates = bindProject();
            const token = await createValidToken({ cmid: 456 });

            const invalidToken = await confirmImport({ jwt_token: 'invalid', projectUuid: 'bound-uuid', packageHash });
            const malformedHash = await confirmImport({
                jwt_token: token,
                projectUuid: 'bound-uuid',
                packageHash: 'x',
            });
            configurePlatformIntegrationRoutes({ findProjectByUuid: async () => undefined });
            const missingProject = await confirmImport({ jwt_token: token, projectUuid: 'gone-uuid', packageHash });

            expect(invalidToken.status).toBe(401);
            expect(malformedHash.status).toBe(400);
            expect(missingProject.status).toBe(404);
            expect(updates).toHaveLength(0);
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

        it('should reject valid-signature tokens when PROVIDER_URLS is unset (fail closed)', async () => {
            // Bug M3: an empty allow-list must reject every return URL instead of allowing all.
            delete process.env.PROVIDER_URLS;

            const token = await createValidToken();

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

    describe('POST /api/platform/integration/set_platform_new_ode_browser', () => {
        const ENDPOINT = 'http://localhost/api/platform/integration/set_platform_new_ode_browser';
        const ZIP_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xde, 0xad, 0xbe, 0xef]);

        function buildBrowserUploadRequest(body: FormData): Request {
            return new Request(ENDPOINT, { method: 'POST', body });
        }

        it('returns 401 when JWT cannot be validated', async () => {
            const formData = new FormData();
            formData.append('jwt_token', 'not-a-jwt');
            formData.append('projectUuid', 'p-1');
            formData.append('package', new Blob([ZIP_BYTES], { type: 'application/zip' }), 'pkg.zip');

            const response = await app.handle(buildBrowserUploadRequest(formData));

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.responseMessage).toContain('Invalid token');
        });

        it('returns 400 when no package file is provided', async () => {
            const token = await createValidToken();
            const formData = new FormData();
            formData.append('jwt_token', token);
            formData.append('projectUuid', 'p-1');

            const response = await app.handle(buildBrowserUploadRequest(formData));

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.responseMessage).toBe('Missing package file');
        });

        it('forwards the uploaded package to the platform set_ode URL and returns OK', async () => {
            const token = await createValidToken({
                returnurl: 'https://moodle.example.com/mod/exeweb/view.php?id=4',
                pkgtype: 'webzip',
            });

            // Server does not yet know this project; the ownership gate defers
            // (the realistic first-time browser-authored save).
            configurePlatformIntegrationRoutes({ findProjectByUuid: async () => undefined });

            let capturedUrl: string | null = null;
            let capturedFormData: FormData | null = null;
            globalThis.fetch = async (url, init) => {
                capturedUrl = url as string;
                capturedFormData = init?.body as FormData;
                return new Response(JSON.stringify({ status: '0' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            };

            // Capture the platform_id linkage. The endpoint should persist
            // the cmid on a project that is not bound to any activity yet.
            let linkedCmid: string | null = null;
            configureService({
                lookupFn: publicLookup,
                findProjectByUuid: async () => makeProjectRow({ uuid: 'project-uuid-123' }),
                updateProjectByUuid: async (_db, _uuid, updates) => {
                    linkedCmid = (updates.platform_id as string) ?? null;
                    return undefined;
                },
            });

            const formData = new FormData();
            formData.append('jwt_token', token);
            formData.append('projectUuid', 'project-uuid-123');
            formData.append('package', new Blob([ZIP_BYTES], { type: 'application/zip' }), 'project_web.zip');

            const response = await app.handle(buildBrowserUploadRequest(formData));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.responseMessage).toBe('OK');
            expect(data.returnUrl).toBe('https://moodle.example.com/mod/exeweb/view.php?id=4');

            expect(capturedUrl).toBe('https://moodle.example.com/mod/exeweb/set_ode.php');
            const odeData = JSON.parse((capturedFormData as FormData).get('ode_data') as string);
            expect(odeData.ode_filename).toBe('project_web.zip');
            expect(odeData.ode_id).toBe('456');
            expect(odeData.ode_user).toBe('123');
            expect(odeData.jwt_token).toBe(token);
            expect(typeof odeData.ode_file).toBe('string');
            expect(odeData.ode_file.length).toBeGreaterThan(0);

            // Linkage runs only after a successful platform reply.
            expect(linkedCmid).toBe('456');
        });

        // The next edit of the activity reopens the project as it is only when
        // the server holds its assets too, so the browser says whether it
        // saved them (#2550).
        it('records the package only when the browser saved the project with its assets', async () => {
            const token = await createValidToken();
            globalThis.fetch = async () =>
                new Response(JSON.stringify({ status: '0' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            const recordedHashes: unknown[] = [];
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () => makeProjectRow({ uuid: 'project-uuid-123' }),
            });
            configureService({
                lookupFn: publicLookup,
                findProjectByUuid: async () => makeProjectRow({ uuid: 'project-uuid-123' }),
                updateProjectByUuid: async (_db, _uuid, updates) => {
                    recordedHashes.push(updates.platform_package_hash);
                    return undefined;
                },
            });

            for (const projectSaved of ['1', undefined]) {
                const formData = new FormData();
                formData.append('jwt_token', token);
                formData.append('projectUuid', 'project-uuid-123');
                if (projectSaved) {
                    formData.append('projectSaved', projectSaved);
                }
                formData.append('package', new Blob([ZIP_BYTES], { type: 'application/zip' }), 'pkg.zip');

                const response = await app.handle(buildBrowserUploadRequest(formData));
                expect(response.status).toBe(200);
            }

            expect(recordedHashes).toEqual([hashPlatformPackage(ZIP_BYTES), null]);
        });

        it('propagates platform error descriptions back to the client as 500', async () => {
            const token = await createValidToken();
            configurePlatformIntegrationRoutes({ findProjectByUuid: async () => undefined });
            globalThis.fetch = async () =>
                new Response(JSON.stringify({ status: '1', description: 'Quota exceeded' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });

            const formData = new FormData();
            formData.append('jwt_token', token);
            formData.append('projectUuid', 'p-1');
            formData.append('package', new Blob([ZIP_BYTES], { type: 'application/zip' }), 'pkg.zip');

            const response = await app.handle(buildBrowserUploadRequest(formData));

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.responseMessage).toBe('Quota exceeded');
        });

        it('returns 500 when the platform replies with a non-OK HTTP status', async () => {
            const token = await createValidToken();
            configurePlatformIntegrationRoutes({ findProjectByUuid: async () => undefined });
            globalThis.fetch = async () => new Response(null, { status: 503 });

            const formData = new FormData();
            formData.append('jwt_token', token);
            formData.append('projectUuid', 'p-1');
            formData.append('package', new Blob([ZIP_BYTES], { type: 'application/zip' }), 'pkg.zip');

            const response = await app.handle(buildBrowserUploadRequest(formData));

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.responseMessage).toContain('503');
        });

        it('rejects browser uploads when the JWT returnurl does not map to a known platform', async () => {
            const token = await createValidToken({ returnurl: 'https://moodle.example.com/mod/exeweb/view.php?id=4' });
            // Restrict allowed providers to a different host so getPlatformIntegrationParams() rejects the JWT.
            process.env.PROVIDER_URLS = 'https://other.example.com';
            process.env.PROVIDER_TOKENS = 'shared-secret';
            process.env.PROVIDER_IDS = 'other';

            const formData = new FormData();
            formData.append('jwt_token', token);
            formData.append('projectUuid', 'p-1');
            formData.append('package', new Blob([ZIP_BYTES], { type: 'application/zip' }), 'pkg.zip');

            const response = await app.handle(buildBrowserUploadRequest(formData));

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.responseMessage).toContain('Invalid token');
        });

        it('returns 403 and forwards/rebinds nothing when projectUuid is bound to another platform module (IDOR)', async () => {
            // Attacker holds a valid JWT for their OWN course module (cmid '456')
            // but supplies a victim project already bound to a DIFFERENT module
            // (cmid '999'). The ownership gate must deny the rebind/forward.
            const token = await createValidToken({ cmid: '456' });

            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () => makeProjectRow({ uuid: 'victim-uuid', platform_id: '999' }),
            });

            // The rebind sink must never run.
            let updateCalled = false;
            configureService({
                lookupFn: publicLookup,
                updateProjectByUuid: async () => {
                    updateCalled = true;
                    return undefined;
                },
            });

            // The package must never be forwarded to any platform.
            let fetchCalled = false;
            globalThis.fetch = async () => {
                fetchCalled = true;
                return new Response(JSON.stringify({ status: '0' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            };

            const formData = new FormData();
            formData.append('jwt_token', token);
            formData.append('projectUuid', 'victim-uuid');
            formData.append('package', new Blob([ZIP_BYTES], { type: 'application/zip' }), 'pkg.zip');

            const response = await app.handle(buildBrowserUploadRequest(formData));

            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.responseMessage).toContain('Forbidden');

            // Critically: nothing forwarded and no platform_id rebind happened.
            expect(fetchCalled).toBe(false);
            expect(updateCalled).toBe(false);
        });

        it('re-saves a project already linked to the module when Moodle signs cmid as an integer', async () => {
            // mod_exescorm/mod_exeweb put `(int) $cmid` in the JWT, while
            // projects.platform_id is a varchar read back as '456'. A second
            // "Save to Moodle" in the same session must not be refused.
            const token = await createValidToken({ cmid: 456 });
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () => makeProjectRow({ uuid: 'owned-uuid', platform_id: '456' }),
            });
            configureService({ lookupFn: publicLookup, updateProjectByUuid: async () => undefined });
            let fetchCalled = false;
            globalThis.fetch = async () => {
                fetchCalled = true;
                return new Response(JSON.stringify({ status: '0' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            };

            const formData = new FormData();
            formData.append('jwt_token', token);
            formData.append('projectUuid', 'owned-uuid');
            formData.append('package', new Blob([ZIP_BYTES], { type: 'application/zip' }), 'pkg.zip');

            const response = await app.handle(buildBrowserUploadRequest(formData));

            expect(response.status).toBe(200);
            expect((await response.json()).responseMessage).toBe('OK');
            expect(fetchCalled).toBe(true);
        });

        it('still denies an integer cmid that differs from the linked module (IDOR)', async () => {
            const token = await createValidToken({ cmid: 456 });
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () => makeProjectRow({ uuid: 'victim-uuid', platform_id: '4567' }),
            });

            const formData = new FormData();
            formData.append('jwt_token', token);
            formData.append('projectUuid', 'victim-uuid');
            formData.append('package', new Blob([ZIP_BYTES], { type: 'application/zip' }), 'pkg.zip');

            const response = await app.handle(buildBrowserUploadRequest(formData));

            expect(response.status).toBe(403);
        });

        it('denies a linked project when the JWT carries no cmid', async () => {
            const token = await createValidToken({ cmid: undefined });
            configurePlatformIntegrationRoutes({
                findProjectByUuid: async () => makeProjectRow({ uuid: 'victim-uuid', platform_id: '456' }),
            });

            const formData = new FormData();
            formData.append('jwt_token', token);
            formData.append('projectUuid', 'victim-uuid');
            formData.append('package', new Blob([ZIP_BYTES], { type: 'application/zip' }), 'pkg.zip');

            const response = await app.handle(buildBrowserUploadRequest(formData));

            expect(response.status).toBe(403);
        });
    });
});

/**
 * Build a minimal project row for the route-level ownership lookup.
 *
 * Only the fields read by the ownership gate matter; the rest are filled with
 * representative defaults so the object satisfies the Project shape.
 */
function makeProjectRow(
    overrides: {
        uuid?: string;
        owner_id?: number;
        platform_id?: string | null;
        platform_site?: string | null;
        platform_package_hash?: string | null;
    } = {},
) {
    return {
        id: 1,
        uuid: overrides.uuid ?? 'test-uuid',
        title: 'Test Project',
        description: null,
        owner_id: overrides.owner_id ?? 1,
        status: 'active',
        visibility: 'private',
        public_view_id: null,
        public_view_enabled: 0,
        language: 'en',
        author: null,
        license: null,
        last_accessed_at: null,
        saved_once: 1,
        platform_id: overrides.platform_id ?? null,
        platform_site: overrides.platform_site ?? null,
        platform_package_hash: overrides.platform_package_hash ?? null,
        created_at: Date.now(),
        updated_at: Date.now(),
    };
}

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
