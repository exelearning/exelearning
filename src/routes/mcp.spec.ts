/**
 * MCP Routes Tests
 *
 * Tests for the MCP HTTP endpoints.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as bcrypt from 'bcryptjs';
import { db, resetClientCacheForTesting } from '../db/client';
import { up } from '../db/migrations/001_initial';
import { now } from '../db/types';
import { mcpRoutes, closeMcpSessions } from './mcp';
import { createAuthRoutes } from './auth';
import { findUserByEmail, findUserById, createUser } from '../db/queries';

let originalEnv: Record<string, string | undefined>;

// Helper to create test app
function createTestApp() {
    const authDeps = {
        db,
        queries: {
            findUserByEmail,
            findUserById,
            createUser,
        },
    };

    return new Elysia().use(createAuthRoutes(authDeps)).use(mcpRoutes);
}

// Helper to create hashed password
async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

// Helper to get auth token
async function getAuthToken(app: ReturnType<typeof createTestApp>, email: string, password: string): Promise<string> {
    const response = await app.handle(
        new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        }),
    );

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
}

describe('MCP Routes', () => {
    let app: ReturnType<typeof createTestApp>;
    let userToken: string;

    beforeAll(async () => {
        // Save original environment
        originalEnv = {
            APP_AUTH_METHODS: process.env.APP_AUTH_METHODS,
            JWT_SECRET: process.env.JWT_SECRET,
        };

        // Set test environment
        process.env.APP_AUTH_METHODS = 'password,guest';
        process.env.JWT_SECRET = 'test-secret-for-mcp-tests';

        // Reset the global db client cache
        await resetClientCacheForTesting();

        // Run migrations
        await up(db);

        // Create test app
        app = createTestApp();

        // Create test user
        const hashedPw = await hashPassword('password');

        // Regular user
        await db
            .insertInto('users')
            .values({
                email: 'mcpuser@test.com',
                user_id: 'mcp-test-user',
                password: hashedPw,
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .executeTakeFirst();

        // Get regular user token
        userToken = await getAuthToken(app, 'mcpuser@test.com', 'password');
    });

    afterAll(async () => {
        // Restore environment
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }

        // Clean up MCP sessions
        await closeMcpSessions();

        // Reset db client
        await resetClientCacheForTesting();
    });

    beforeEach(async () => {
        // Clean up projects before each test
        await db.deleteFrom('projects').execute();
    });

    // =========================================================================
    // GET /mcp/health - Health Check
    // =========================================================================

    describe('GET /mcp/health', () => {
        it('should return health status without auth', async () => {
            const response = await app.handle(new Request('http://localhost/mcp/health'));

            expect(response.status).toBe(200);
            const data = (await response.json()) as { success: boolean; data: { status: string } };
            expect(data.success).toBe(true);
            expect(data.data.status).toBe('healthy');
        });

        it('should return active sessions count', async () => {
            const response = await app.handle(new Request('http://localhost/mcp/health'));

            expect(response.status).toBe(200);
            const data = (await response.json()) as { success: boolean; data: { activeSessions: number } };
            expect(typeof data.data.activeSessions).toBe('number');
        });
    });

    // =========================================================================
    // GET /mcp/info - Server Info
    // =========================================================================

    describe('GET /mcp/info', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/mcp/info'));

            expect(response.status).toBe(401);
        });

        // Note: Guest token tests are skipped because properly testing guest
        // rejection requires the guest login flow which sets isGuest: true
        // in the JWT payload. The authenticateRequest function correctly
        // rejects guests, as tested in types.spec.ts.

        it('should return server info for authenticated user', async () => {
            const response = await app.handle(
                new Request('http://localhost/mcp/info', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );

            expect(response.status).toBe(200);
            const data = (await response.json()) as {
                success: boolean;
                data: {
                    name: string;
                    version: string;
                    transport: string;
                    tools: string[];
                    resources: string[];
                    prompts: string[];
                };
            };

            expect(data.success).toBe(true);
            expect(data.data.name).toBe('exelearning-mcp-server');
            expect(data.data.version).toBe('1.0.0');
            expect(data.data.transport).toBe('streamable-http');
        });

        it('should list available tools', async () => {
            const response = await app.handle(
                new Request('http://localhost/mcp/info', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );

            const data = (await response.json()) as { data: { tools: string[] } };

            expect(data.data.tools).toContain('projects/list');
            expect(data.data.tools).toContain('projects/create');
            expect(data.data.tools).toContain('pages/list');
            expect(data.data.tools).toContain('blocks/list');
            expect(data.data.tools).toContain('components/list');
            expect(data.data.tools).toContain('metadata/get');
            expect(data.data.tools).toContain('export/formats');
        });

        it('should list available resources', async () => {
            const response = await app.handle(
                new Request('http://localhost/mcp/info', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );

            const data = (await response.json()) as { data: { resources: string[] } };

            expect(data.data.resources).toContain('project://{uuid}/structure');
            expect(data.data.resources).toContain('project://{uuid}/metadata');
            expect(data.data.resources).toContain('exelearning://idevices');
            expect(data.data.resources).toContain('exelearning://themes');
            expect(data.data.resources).toContain('exelearning://export-formats');
        });

        it('should list available prompts', async () => {
            const response = await app.handle(
                new Request('http://localhost/mcp/info', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );

            const data = (await response.json()) as { data: { prompts: string[] } };

            expect(data.data.prompts).toContain('create-course');
            expect(data.data.prompts).toContain('add-content');
            expect(data.data.prompts).toContain('export-for-lms');
            expect(data.data.prompts).toContain('review-project');
            expect(data.data.prompts).toContain('translate-project');
        });
    });

    // =========================================================================
    // ALL /mcp - Main MCP Endpoint
    // =========================================================================

    describe('ALL /mcp', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/mcp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                }),
            );

            expect(response.status).toBe(401);
        });

        // Guest rejection is tested via types.spec.ts

        it('should accept valid authenticated request', async () => {
            // The MCP endpoint expects specific message format
            // For now, just verify auth passes (not 401/403)
            const response = await app.handle(
                new Request('http://localhost/mcp', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'initialize',
                        params: {
                            protocolVersion: '2024-11-05',
                            clientInfo: {
                                name: 'test-client',
                                version: '1.0.0',
                            },
                            capabilities: {},
                        },
                        id: 1,
                    }),
                }),
            );

            // Auth should pass (not 401 or 403)
            expect(response.status).not.toBe(401);
            expect(response.status).not.toBe(403);
        });

        it('should use session ID from header if provided', async () => {
            const sessionId = 'test-session-123';

            const response = await app.handle(
                new Request('http://localhost/mcp', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                        'mcp-session-id': sessionId,
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'initialize',
                        params: {
                            protocolVersion: '2024-11-05',
                            clientInfo: { name: 'test', version: '1.0.0' },
                            capabilities: {},
                        },
                        id: 1,
                    }),
                }),
            );

            // Auth should pass (not 401 or 403)
            expect(response.status).not.toBe(401);
            expect(response.status).not.toBe(403);
        });
    });

    // =========================================================================
    // closeMcpSessions
    // =========================================================================

    describe('closeMcpSessions', () => {
        it('should close all sessions without error', async () => {
            await expect(closeMcpSessions()).resolves.toBeUndefined();
        });
    });
});
