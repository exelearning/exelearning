/**
 * MCP Server Tests
 *
 * Tests for the MCP server factory and session management.
 */
import { describe, it, expect, afterEach } from 'bun:test';
import {
    createMcpServer,
    createMcpTransport,
    getOrCreateSession,
    getSession,
    closeSession,
    getActiveSessions,
    closeAllSessions,
    configureMcpDeps,
    resetMcpDeps,
    getMcpDeps,
} from './server';
import type { McpDependencies } from './types';

// ============================================================================
// TEST DATA
// ============================================================================

const mockDeps: McpDependencies = {
    authToken: 'test-token',
    user: {
        userId: 1,
        email: 'test@example.com',
        roles: ['ROLE_USER'],
    },
};

const adminDeps: McpDependencies = {
    authToken: 'admin-token',
    user: {
        userId: 2,
        email: 'admin@example.com',
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
    },
};

// ============================================================================
// TESTS
// ============================================================================

describe('MCP Server', () => {
    afterEach(async () => {
        // Clean up sessions after each test
        await closeAllSessions();
        resetMcpDeps();
    });

    // =========================================================================
    // createMcpServer
    // =========================================================================

    describe('createMcpServer', () => {
        it('should create an MCP server instance', () => {
            const server = createMcpServer(mockDeps);

            expect(server).toBeDefined();
            // McpServer has these methods
            expect(typeof server.registerTool).toBe('function');
            expect(typeof server.registerResource).toBe('function');
            expect(typeof server.registerPrompt).toBe('function');
            expect(typeof server.connect).toBe('function');
            expect(typeof server.close).toBe('function');
        });

        it('should create server with admin dependencies', () => {
            const server = createMcpServer(adminDeps);

            expect(server).toBeDefined();
        });
    });

    // =========================================================================
    // createMcpTransport
    // =========================================================================

    describe('createMcpTransport', () => {
        it('should create a transport with default options', () => {
            const transport = createMcpTransport();

            expect(transport).toBeDefined();
            expect(typeof transport.handleRequest).toBe('function');
            expect(typeof transport.close).toBe('function');
        });

        it('should create a transport with custom session ID generator', () => {
            const customId = 'custom-session-id';
            const transport = createMcpTransport({
                sessionIdGenerator: () => customId,
            });

            expect(transport).toBeDefined();
        });

        it('should create a transport with JSON response enabled', () => {
            const transport = createMcpTransport({
                enableJsonResponse: true,
            });

            expect(transport).toBeDefined();
        });
    });

    // =========================================================================
    // Session Management
    // =========================================================================

    describe('Session Management', () => {
        describe('getOrCreateSession', () => {
            it('should create a new session', () => {
                const sessionId = 'test-session-1';
                const session = getOrCreateSession(sessionId, mockDeps);

                expect(session).toBeDefined();
                expect(session.server).toBeDefined();
                expect(session.transport).toBeDefined();
                expect(session.deps).toEqual(mockDeps);
                expect(session.createdAt).toBeGreaterThan(0);
            });

            it('should return existing session if already created', () => {
                const sessionId = 'test-session-2';
                const session1 = getOrCreateSession(sessionId, mockDeps);
                const session2 = getOrCreateSession(sessionId, mockDeps);

                expect(session1).toBe(session2);
                expect(session1.createdAt).toBe(session2.createdAt);
            });

            it('should create different sessions for different IDs', () => {
                const session1 = getOrCreateSession('session-a', mockDeps);
                const session2 = getOrCreateSession('session-b', mockDeps);

                expect(session1).not.toBe(session2);
            });
        });

        describe('getSession', () => {
            it('should return existing session', () => {
                const sessionId = 'get-session-test';
                const created = getOrCreateSession(sessionId, mockDeps);
                const retrieved = getSession(sessionId);

                expect(retrieved).toBe(created);
            });

            it('should return undefined for non-existent session', () => {
                const retrieved = getSession('non-existent');

                expect(retrieved).toBeUndefined();
            });
        });

        describe('closeSession', () => {
            it('should close and remove a session', async () => {
                const sessionId = 'close-session-test';
                getOrCreateSession(sessionId, mockDeps);

                await closeSession(sessionId);

                const retrieved = getSession(sessionId);
                expect(retrieved).toBeUndefined();
            });

            it('should handle closing non-existent session gracefully', async () => {
                await expect(closeSession('non-existent')).resolves.toBeUndefined();
            });
        });

        describe('getActiveSessions', () => {
            it('should return empty array when no sessions', () => {
                const sessions = getActiveSessions();

                expect(sessions).toEqual([]);
            });

            it('should return all active session IDs', () => {
                getOrCreateSession('session-x', mockDeps);
                getOrCreateSession('session-y', mockDeps);
                getOrCreateSession('session-z', mockDeps);

                const sessions = getActiveSessions();

                expect(sessions.length).toBe(3);
                expect(sessions).toContain('session-x');
                expect(sessions).toContain('session-y');
                expect(sessions).toContain('session-z');
            });
        });

        describe('closeAllSessions', () => {
            it('should close all active sessions', async () => {
                getOrCreateSession('all-1', mockDeps);
                getOrCreateSession('all-2', mockDeps);
                getOrCreateSession('all-3', mockDeps);

                await closeAllSessions();

                const sessions = getActiveSessions();
                expect(sessions.length).toBe(0);
            });

            it('should handle empty sessions gracefully', async () => {
                await expect(closeAllSessions()).resolves.toBeUndefined();
            });
        });
    });

    // =========================================================================
    // Dependency Injection
    // =========================================================================

    describe('Dependency Injection', () => {
        describe('configureMcpDeps', () => {
            it('should configure dependencies', () => {
                const mockCreateServer = () => ({}) as ReturnType<typeof createMcpServer>;

                configureMcpDeps({
                    createMcpServer: mockCreateServer,
                });

                const deps = getMcpDeps();
                expect(deps.createMcpServer).toBe(mockCreateServer);
            });

            it('should preserve other dependencies when configuring partial', () => {
                const originalDeps = getMcpDeps();
                const originalCreateTransport = originalDeps.createMcpTransport;

                configureMcpDeps({
                    createMcpServer: () => ({}) as ReturnType<typeof createMcpServer>,
                });

                const deps = getMcpDeps();
                expect(deps.createMcpTransport).toBe(originalCreateTransport);
            });
        });

        describe('resetMcpDeps', () => {
            it('should reset dependencies to defaults', () => {
                const originalDeps = getMcpDeps();

                configureMcpDeps({
                    createMcpServer: () => ({}) as ReturnType<typeof createMcpServer>,
                });

                resetMcpDeps();

                const deps = getMcpDeps();
                expect(deps.createMcpServer).toBe(originalDeps.createMcpServer);
            });
        });

        describe('getMcpDeps', () => {
            it('should return current dependencies', () => {
                const deps = getMcpDeps();

                expect(deps).toBeDefined();
                expect(typeof deps.createMcpServer).toBe('function');
                expect(typeof deps.createMcpTransport).toBe('function');
            });
        });
    });
});
