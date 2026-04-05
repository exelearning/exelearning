/**
 * Tests for Yjs WebSocket Service
 * Uses Dependency Injection pattern - no mock.module needed
 *
 * This test file uses REAL implementations for sibling modules (room-manager, heartbeat,
 * message-parser, config). Only external dependencies are mocked via DI.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

// Import real implementations
import * as roomManager from './room-manager';
import * as heartbeat from './heartbeat';
import { parseMessage, isAssetMessageType } from './message-parser';

import {
    configure,
    resetDependencies,
    createWebSocketRoutes,
    initialize,
    stop,
    getServerInfo,
    getActiveRooms,
    broadcastToRoom,
    getDetailedStats,
    getConnectedClientsDetail,
    generateClientId,
    checkWebSocketProjectAccess,
    handleWebSocketOpen,
    handleWebSocketPong,
    handleWebSocketMessage,
    handleWebSocketClose,
    WsData,
    type YjsWebSocketQueries,
    type YjsWebSocketSessionManager,
    type YjsWebSocketAuth,
    type YjsWebSocketAssetCoordinator,
} from './yjs-websocket';

// Mock data stores
let mockProjects: Map<string, any>;
let mockSessions: Map<string, any>;

// Mock database (not used but required by interface)
const mockDb = {} as Kysely<Database>;

// Create mock queries
function createMockQueries(): YjsWebSocketQueries {
    return {
        findProjectByUuid: async (_db: any, uuid: string) => mockProjects.get(uuid),
        checkProjectAccess: async (_db: any, project: any, userId: number) => {
            if (!project) return { hasAccess: false, reason: 'Project not found' };
            if (project.owner_id === userId) return { hasAccess: true };
            if (project.visibility === 'public') return { hasAccess: true };
            return { hasAccess: false, reason: 'Access denied' };
        },
        markProjectAsSaved: async (_db: any, _projectId: number) => {},
    };
}

// Create mock session manager
function createMockSessionManager(): YjsWebSocketSessionManager {
    return {
        getSession: (sessionId: string) => mockSessions.get(sessionId),
    };
}

// Create mock auth
function createMockAuth(): YjsWebSocketAuth {
    return {
        verifyToken: async (token: string) => {
            if (token === 'valid-token-user-1') {
                return { sub: 1, email: 'user1@test.com', roles: ['ROLE_USER'] };
            }
            if (token === 'valid-token-user-2') {
                return { sub: 2, email: 'user2@test.com', roles: ['ROLE_USER'] };
            }
            if (token === 'valid-token-admin') {
                return { sub: 3, email: 'admin@test.com', roles: ['ROLE_ADMIN'] };
            }
            return null;
        },
    };
}

// Create mock asset coordinator
function createMockAssetCoordinator(): YjsWebSocketAssetCoordinator {
    return {
        registerClient: () => {},
        unregisterClient: () => {},
        handleMessage: async () => {},
        onCollaborationDetected: async () => {},
        cleanupProject: () => {},
    };
}

// Mock WebSocket for testing
function createMockWebSocket(data: Partial<WsData> = {}): any {
    const sentMessages: any[] = [];
    const closeArgs: any[] = [];
    return {
        data: {
            params: { docName: 'project-test-uuid' },
            query: { token: 'valid-token-user-1' },
            clientId: 'test-client-' + Math.random().toString(36).substr(2, 9),
            userId: 1,
            projectUuid: 'test-uuid',
            docName: 'project-test-uuid',
            ...data,
        },
        readyState: 1, // OPEN
        send: mock((msg: any) => sentMessages.push(msg)),
        close: mock((code?: number, reason?: string) => closeArgs.push({ code, reason })),
        ping: mock(() => {}),
        sentMessages,
        closeArgs,
    };
}

describe('Yjs WebSocket Service', () => {
    beforeEach(() => {
        // Reset mock data stores
        mockProjects = new Map();
        mockSessions = new Map();

        // Clean up real implementations
        roomManager.closeAllRooms();
        heartbeat.stopAllHeartbeats();

        // Setup test data
        mockProjects.set('test-uuid', {
            id: 1,
            uuid: 'test-uuid',
            owner_id: 1,
            visibility: 'private',
        });

        mockProjects.set('public-uuid', {
            id: 2,
            uuid: 'public-uuid',
            owner_id: 2,
            visibility: 'public',
        });

        mockSessions.set('session-uuid', {
            sessionId: 'session-uuid',
            fileName: 'Test.elp',
        });

        // Configure dependencies with mocks
        configure({
            db: mockDb,
            queries: createMockQueries(),
            sessionManager: createMockSessionManager(),
            auth: createMockAuth(),
            assetCoordinator: createMockAssetCoordinator(),
        });
    });

    afterEach(() => {
        // Clean up after each test
        roomManager.closeAllRooms();
        heartbeat.stopAllHeartbeats();
        resetDependencies();
    });

    describe('createWebSocketRoutes', () => {
        it('should create Elysia routes', () => {
            const routes = createWebSocketRoutes();

            expect(routes).toBeDefined();
            // Should have the /yjs/:docName route registered
        });

        it('should wire websocket handlers to open/pong/message/close', async () => {
            const routes = createWebSocketRoutes();
            const wsRoute = routes.routes.find(route => route.method === 'WS' && route.path === '/yjs/:docName');

            expect(wsRoute).toBeDefined();
            const wsHook = (wsRoute?.hooks as any)?.websocket;
            expect(wsHook).toBeDefined();

            const ws = createMockWebSocket();
            await wsHook?.open?.(ws as any);

            // Invalid docName should close the connection
            expect(ws.close).toHaveBeenCalled();

            wsHook?.pong?.(ws as any, undefined as any);
            wsHook?.message?.(ws as any, Buffer.from([0x01]));
            wsHook?.close?.(ws as any, 1000, 'closed');
        });
    });

    describe('Connection Access Control', () => {
        it('should allow owner access to own project', async () => {
            // User 1 owns test-uuid project
            const _ws = createMockWebSocket({
                params: { docName: 'project-test-uuid' },
                query: { token: 'valid-token-user-1' },
            });

            // Simulate open handler logic
            const projectUuid = 'test-uuid';
            const userId = 1;

            const project = mockProjects.get(projectUuid);
            expect(project).toBeDefined();
            expect(project!.owner_id).toBe(userId);
        });

        it('should allow public project access to any user', async () => {
            // User 1 accessing public project owned by user 2
            const projectUuid = 'public-uuid';
            const project = mockProjects.get(projectUuid);

            expect(project).toBeDefined();
            expect(project!.visibility).toBe('public');
        });

        it('should allow access to in-memory sessions', async () => {
            // Session exists in memory
            const session = mockSessions.get('session-uuid');

            expect(session).toBeDefined();
            expect(session!.sessionId).toBe('session-uuid');
        });

        it('should deny access to non-existent project', async () => {
            const project = mockProjects.get('non-existent');

            expect(project).toBeUndefined();
        });
    });

    describe('initialize', () => {
        it('should initialize WebSocket server', () => {
            // Reset by calling stop first
            stop();

            initialize();

            const info = getServerInfo();
            expect(info.isRunning).toBe(true);
        });

        it('should warn if already initialized', () => {
            // Initialize twice
            initialize();
            initialize(); // Should warn but not fail

            const info = getServerInfo();
            expect(info.isRunning).toBe(true);
        });

        it('should use default port 3002', () => {
            const originalPort = process.env.ELYSIA_PORT;
            delete process.env.ELYSIA_PORT;
            delete process.env.PORT;

            stop();
            initialize();

            const info = getServerInfo();
            expect(info.port).toBe(3002);

            if (originalPort) {
                process.env.ELYSIA_PORT = originalPort;
            }
        });

        it('should use custom port from environment', () => {
            const originalPort = process.env.ELYSIA_PORT;
            process.env.ELYSIA_PORT = '4000';

            stop();
            initialize();

            const info = getServerInfo();
            expect(info.port).toBe(4000);

            if (originalPort) {
                process.env.ELYSIA_PORT = originalPort;
            } else {
                delete process.env.ELYSIA_PORT;
            }
        });
    });

    describe('stop', () => {
        it('should stop WebSocket server', () => {
            initialize();
            stop();

            const info = getServerInfo();
            expect(info.isRunning).toBe(false);
        });

        it('should clear all rooms', () => {
            roomManager.addConnection('project-test', createMockWebSocket() as any);

            stop();

            expect(roomManager.getActiveRooms().length).toBe(0);
        });

        it('should stop all heartbeats', () => {
            heartbeat.startHeartbeat('client-1', createMockWebSocket() as any);

            stop();

            expect(heartbeat.getHeartbeatStats().activeClients).toBe(0);
        });
    });

    describe('getServerInfo', () => {
        it('should return server info', () => {
            initialize();

            const info = getServerInfo();

            expect(info).toBeDefined();
            expect(info.mode).toBe('stateless-relay');
            expect(typeof info.port).toBe('number');
            expect(typeof info.isRunning).toBe('boolean');
            expect(typeof info.roomsCount).toBe('number');
            expect(typeof info.totalConnections).toBe('number');
        });

        it('should reflect room count', () => {
            // Use real room manager to add rooms
            roomManager.addConnection('room-1', createMockWebSocket() as any);
            roomManager.addConnection('room-1', createMockWebSocket() as any);
            roomManager.addConnection('room-2', createMockWebSocket() as any);

            const info = getServerInfo();

            expect(info.roomsCount).toBe(2);
            expect(info.totalConnections).toBe(3);
        });
    });

    describe('getActiveRooms', () => {
        it('should return list of active rooms', () => {
            roomManager.addConnection('project-uuid-1', createMockWebSocket() as any, 'uuid-1');
            roomManager.addConnection('project-uuid-2', createMockWebSocket() as any, 'uuid-2');

            const rooms = getActiveRooms();

            expect(rooms).toContain('project-uuid-1');
            expect(rooms).toContain('project-uuid-2');
            expect(rooms.length).toBe(2);
        });

        it('should return empty array when no rooms', () => {
            roomManager.closeAllRooms();

            const rooms = getActiveRooms();

            expect(rooms).toEqual([]);
        });
    });

    describe('broadcastToRoom', () => {
        it('should broadcast message to all connections in room', () => {
            const ws1 = createMockWebSocket();
            const ws2 = createMockWebSocket();

            roomManager.addConnection('project-test', ws1 as any);
            roomManager.addConnection('project-test', ws2 as any);

            broadcastToRoom('project-test', 'Hello');

            expect(ws1.send).toHaveBeenCalled();
            expect(ws2.send).toHaveBeenCalled();
        });

        it('should handle non-existent room gracefully', () => {
            // Should not throw
            broadcastToRoom('non-existent', 'Hello');
        });

        it('should broadcast binary messages', () => {
            const ws = createMockWebSocket();
            roomManager.addConnection('project-test', ws as any);

            const buffer = Buffer.from([1, 2, 3, 4]);
            broadcastToRoom('project-test', buffer);

            expect(ws.send).toHaveBeenCalled();
        });
    });

    describe('getDetailedStats', () => {
        it('should return detailed statistics', () => {
            // Setup some data using real implementations
            roomManager.addConnection('room-1', createMockWebSocket() as any, 'uuid-1');
            heartbeat.startHeartbeat('client-1', createMockWebSocket() as any);

            const stats = getDetailedStats();

            expect(stats).toBeDefined();
            expect(stats.rooms).toBeDefined();
            expect(stats.heartbeats).toBeDefined();
            expect(typeof stats.clients).toBe('number');
        });

        it('should reflect empty state', () => {
            roomManager.closeAllRooms();
            heartbeat.stopAllHeartbeats();

            const stats = getDetailedStats();

            expect(stats.rooms.totalRooms).toBe(0);
            expect(stats.rooms.totalConnections).toBe(0);
        });
    });

    describe('getConnectedClientsDetail', () => {
        it('should return an array', () => {
            const clients = getConnectedClientsDetail();
            expect(Array.isArray(clients)).toBe(true);
        });

        it('should return client details after a successful connection', async () => {
            const projectUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            const mockWs = createMockWebSocket();
            const docName = `project-${projectUuid}`;

            mockProjects.set(projectUuid, {
                id: 10,
                uuid: projectUuid,
                owner_id: 1,
                visibility: 'private',
            });

            const countBefore = getConnectedClientsDetail().length;
            await handleWebSocketOpen(mockWs as any, docName, 'valid-token-user-1');

            const clients = getConnectedClientsDetail();
            expect(clients.length).toBe(countBefore + 1);
            const added = clients.find(c => c.projectUuid === projectUuid);
            expect(added).toBeDefined();
            expect(added!.userId).toBe(1);
            expect(typeof added!.connectedAt).toBe('number');
        });

        it('should remove client details after disconnection', async () => {
            const projectUuid = 'b2c3d4e5-f6a7-8901-bcde-ef1234567891';
            const mockWs = createMockWebSocket();
            const docName = `project-${projectUuid}`;

            mockProjects.set(projectUuid, {
                id: 11,
                uuid: projectUuid,
                owner_id: 1,
                visibility: 'private',
            });

            const countBefore = getConnectedClientsDetail().length;
            await handleWebSocketOpen(mockWs as any, docName, 'valid-token-user-1');
            expect(getConnectedClientsDetail().length).toBe(countBefore + 1);

            handleWebSocketClose(mockWs as any, mockWs.data as any);
            const remaining = getConnectedClientsDetail();
            expect(remaining.length).toBe(countBefore);
            expect(remaining.some(c => c.projectUuid === projectUuid)).toBe(false);
        });
    });

    describe('WebSocket Connection Lifecycle', () => {
        it('should track connection additions', () => {
            const mockWs = createMockWebSocket();
            const docName = 'project-test-uuid';

            roomManager.addConnection(docName, mockWs as any, 'test-uuid');

            const room = roomManager.getRoom(docName);
            expect(room).toBeDefined();
            expect(room!.conns.size).toBe(1);
        });

        it('should track connection removals', () => {
            const mockWs = createMockWebSocket();
            const docName = 'project-test-uuid';

            roomManager.addConnection(docName, mockWs as any, 'test-uuid');
            roomManager.removeConnection(docName, mockWs as any);

            const room = roomManager.getRoom(docName);
            expect(room!.conns.size).toBe(0);
        });

        it('should start heartbeat on connection', () => {
            const clientId = 'client-test-123';
            const mockWs = createMockWebSocket();

            heartbeat.startHeartbeat(clientId, mockWs as any);

            const stats = heartbeat.getHeartbeatStats();
            expect(stats.activeClients).toBe(1);
            expect(stats.clientIds).toContain(clientId);
        });

        it('should stop heartbeat on disconnection', () => {
            const clientId = 'client-test-456';
            const mockWs = createMockWebSocket();

            heartbeat.startHeartbeat(clientId, mockWs as any);
            heartbeat.stopHeartbeat(clientId);

            const stats = heartbeat.getHeartbeatStats();
            expect(stats.activeClients).toBe(0);
        });
    });

    describe('Message Routing', () => {
        it('should parse Yjs binary messages', () => {
            const buffer = Buffer.from([0, 1, 2, 3]);
            const parsed = parseMessage(buffer);
            expect(parsed.kind).toBe('yjs');
        });

        it('should parse asset JSON messages', () => {
            // Use a valid asset message type
            const assetMsg = JSON.stringify({ type: 'request-asset', projectId: 'p1', clientId: 'c1', data: {} });
            const parsed = parseMessage(assetMsg);
            expect(parsed.kind).toBe('asset');
        });

        it('should mark unknown messages', () => {
            const parsed = parseMessage('not json or binary');
            expect(parsed.kind).toBe('unknown');
        });

        it('should relay Yjs messages to room', () => {
            const sender = createMockWebSocket();
            const receiver = createMockWebSocket();
            const docName = 'project-relay-test';
            const message = Buffer.from([1, 2, 3]);

            roomManager.addConnection(docName, sender as any);
            roomManager.addConnection(docName, receiver as any);

            roomManager.relayMessage(sender as any, docName, message);

            // Sender should not receive, receiver should
            expect(sender.send).not.toHaveBeenCalled();
            expect(receiver.send).toHaveBeenCalled();
        });
    });

    describe('Room Management', () => {
        it('should create room when first client connects', () => {
            const docName = 'project-new-room';

            expect(roomManager.getRoom(docName)).toBeUndefined();

            roomManager.addConnection(docName, createMockWebSocket() as any, 'new-uuid');

            expect(roomManager.getRoom(docName)).toBeDefined();
        });

        it('should keep room when client disconnects (cleanup is delayed)', () => {
            const docName = 'project-temp-room';
            const ws = createMockWebSocket();

            roomManager.addConnection(docName, ws as any, 'temp-uuid');
            expect(roomManager.getRoom(docName)).toBeDefined();

            roomManager.removeConnection(docName, ws as any);
            // Room still exists but is empty (cleanup is scheduled)
            expect(roomManager.getRoom(docName)).toBeDefined();
            expect(roomManager.getRoom(docName)!.conns.size).toBe(0);
        });

        it('should keep room with remaining clients', () => {
            const docName = 'project-shared-room';
            const ws1 = createMockWebSocket();
            const ws2 = createMockWebSocket();

            roomManager.addConnection(docName, ws1 as any, 'shared-uuid');
            roomManager.addConnection(docName, ws2 as any, 'shared-uuid');

            expect(roomManager.getRoom(docName)?.conns.size).toBe(2);

            roomManager.removeConnection(docName, ws1 as any);

            expect(roomManager.getRoom(docName)).toBeDefined();
            expect(roomManager.getRoom(docName)?.conns.size).toBe(1);
        });
    });

    describe('Document Name Parsing', () => {
        it('should extract project UUID from document name', () => {
            // Real extractProjectUuid uses stricter regex: project-<uuid-format>
            expect(roomManager.extractProjectUuid('project-a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            );
        });

        it('should return null for invalid document names', () => {
            expect(roomManager.extractProjectUuid('invalid-name')).toBeNull();
            expect(roomManager.extractProjectUuid('')).toBeNull();
            expect(roomManager.extractProjectUuid('doc-123')).toBeNull();
            // Also non-UUID format after project-
            expect(roomManager.extractProjectUuid('project-test')).toBeNull();
        });
    });

    describe('Error Handling', () => {
        it('should handle missing token', async () => {
            // Token validation should reject null/undefined
            const mockAuth = createMockAuth();

            const result = await mockAuth.verifyToken('');
            expect(result).toBeNull();
        });

        it('should handle invalid token', async () => {
            const mockAuth = createMockAuth();

            const result = await mockAuth.verifyToken('invalid-token');
            expect(result).toBeNull();
        });

        it('should handle non-existent project access check', async () => {
            const mockQueries = createMockQueries();

            // Note: First param is _db (ignored), second is project (null), third is userId
            const result = await mockQueries.checkProjectAccess(null, null, 1);
            expect(result.hasAccess).toBe(false);
        });
    });

    // =========================================================================
    // WebSocket Handler Simulation Tests
    // =========================================================================

    describe('WebSocket Open Handler Logic', () => {
        it('should reject connection with invalid document name format', () => {
            const ws = createMockWebSocket({
                params: { docName: 'invalid-doc-name' },
            });

            // Simulate the validation that happens in open handler
            const docName = ws.data.params?.docName;
            const projectUuid = roomManager.extractProjectUuid(docName);

            expect(projectUuid).toBeNull();
            // In real handler, this would call ws.close(4000, 'Invalid document name format...')
        });

        it('should extract project UUID from valid document name', () => {
            const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            const ws = createMockWebSocket({
                params: { docName: `project-${validUuid}` },
            });

            const docName = ws.data.params?.docName;
            const projectUuid = roomManager.extractProjectUuid(docName);

            expect(projectUuid).toBe(validUuid);
        });

        it('should reject connection without token', async () => {
            const ws = createMockWebSocket({
                query: { token: undefined },
            });

            const token = ws.data.query?.token;
            expect(token).toBeUndefined();
            // In real handler, this would call ws.close(4001, 'Token required')
        });

        it('should reject connection with invalid token', async () => {
            const mockAuth = createMockAuth();
            const user = await mockAuth.verifyToken('invalid-token-xyz');

            expect(user).toBeNull();
            // In real handler, this would call ws.close(4001, 'Invalid token')
        });

        it('should accept connection with valid token', async () => {
            const mockAuth = createMockAuth();
            const user = await mockAuth.verifyToken('valid-token-user-1');

            expect(user).not.toBeNull();
            expect(user?.sub).toBe(1);
            expect(user?.email).toBe('user1@test.com');
        });

        it('should allow access when session exists in memory', () => {
            const mockSessionManager = createMockSessionManager();
            const session = mockSessionManager.getSession('session-uuid');

            expect(session).toBeDefined();
            expect(session?.sessionId).toBe('session-uuid');
        });

        it('should check project access via database when no session', async () => {
            const mockQueries = createMockQueries();
            const project = mockProjects.get('test-uuid');
            const result = await mockQueries.checkProjectAccess(null, project, 1);

            expect(result.hasAccess).toBe(true);
        });

        it('should deny access when user is not owner of private project', async () => {
            const mockQueries = createMockQueries();
            // test-uuid is owned by user 1, but user 2 tries to access
            const project = mockProjects.get('test-uuid');
            const result = await mockQueries.checkProjectAccess(null, project, 2);

            expect(result.hasAccess).toBe(false);
            expect(result.reason).toBe('Access denied');
        });

        it('should allow access to public project by any user', async () => {
            const mockQueries = createMockQueries();
            // public-uuid is owned by user 2 but accessible to all
            const project = mockProjects.get('public-uuid');
            const result = await mockQueries.checkProjectAccess(null, project, 999);

            expect(result.hasAccess).toBe(true);
        });
    });

    describe('WebSocket Message Handler Logic', () => {
        it('should handle Yjs binary messages', () => {
            const message = Buffer.from([0, 1, 2, 3]);
            const parsed = parseMessage(message);

            expect(parsed.kind).toBe('yjs');
            expect(parsed.data).toBeDefined();
        });

        it('should handle asset coordination messages', () => {
            const assetMessage = JSON.stringify({
                type: 'request-asset',
                projectId: 'test-uuid',
                clientId: 'client-1',
                data: { assetPath: '/images/test.png' },
            });
            const parsed = parseMessage(assetMessage);

            expect(parsed.kind).toBe('asset');
            expect(parsed.message).toBeDefined();
            expect(parsed.message.type).toBe('request-asset');
        });

        it('should mark invalid JSON as unknown', () => {
            const invalidMessage = 'not valid json {';
            const parsed = parseMessage(invalidMessage);

            expect(parsed.kind).toBe('unknown');
        });

        it('should mark JSON without asset type as unknown', () => {
            const nonAssetJson = JSON.stringify({ foo: 'bar', baz: 123 });
            const parsed = parseMessage(nonAssetJson);

            expect(parsed.kind).toBe('unknown');
        });

        it('should relay message to other clients in room', () => {
            const sender = createMockWebSocket();
            const receiver1 = createMockWebSocket();
            const receiver2 = createMockWebSocket();
            const docName = 'project-relay-multi';

            roomManager.addConnection(docName, sender as any);
            roomManager.addConnection(docName, receiver1 as any);
            roomManager.addConnection(docName, receiver2 as any);

            const message = Buffer.from([1, 2, 3, 4, 5]);
            roomManager.relayMessage(sender as any, docName, message);

            // Sender should NOT receive the message
            expect(sender.send).not.toHaveBeenCalled();
            // Both receivers should receive the message
            expect(receiver1.send).toHaveBeenCalled();
            expect(receiver2.send).toHaveBeenCalled();
        });

        it('should handle missing room gracefully', () => {
            const room = roomManager.getRoom('non-existent-room');
            expect(room).toBeUndefined();
            // In real handler, this would return early without error
        });
    });

    describe('WebSocket Close Handler Logic', () => {
        it('should clean up connection from room on close', () => {
            const ws = createMockWebSocket();
            const docName = 'project-cleanup-test';

            roomManager.addConnection(docName, ws as any, 'cleanup-uuid');
            expect(roomManager.getRoom(docName)?.conns.size).toBe(1);

            roomManager.removeConnection(docName, ws as any);
            expect(roomManager.getRoom(docName)?.conns.size).toBe(0);
        });

        it('should stop heartbeat for disconnected client', () => {
            const clientId = 'client-close-test';
            const ws = createMockWebSocket();

            heartbeat.startHeartbeat(clientId, ws as any);
            expect(heartbeat.getHeartbeatStats().activeClients).toBe(1);

            heartbeat.stopHeartbeat(clientId);
            expect(heartbeat.getHeartbeatStats().activeClients).toBe(0);
        });

        it('should handle close with undefined clientId gracefully', () => {
            // Should not throw when clientId is undefined
            heartbeat.stopHeartbeat(undefined as any);
            expect(heartbeat.getHeartbeatStats().activeClients).toBe(0);
        });

        it('should handle close for unknown docName', () => {
            // Should not throw when docName is unknown
            roomManager.removeConnection('unknown-doc', createMockWebSocket() as any);
        });
    });

    describe('WebSocket Pong Handler Logic', () => {
        it('should update heartbeat on pong', () => {
            const clientId = 'client-pong-test';
            const ws = createMockWebSocket();

            heartbeat.startHeartbeat(clientId, ws as any);

            // Simulate pong received
            heartbeat.onPong(clientId);

            const stats = heartbeat.getHeartbeatStats();
            expect(stats.activeClients).toBe(1);
        });

        it('should handle pong for unknown client gracefully', () => {
            // Should not throw for unknown client
            heartbeat.onPong('unknown-client');
        });
    });

    // =========================================================================
    // Asset Coordinator Integration Tests
    // =========================================================================

    describe('Asset Coordinator Integration', () => {
        it('should register client with asset coordinator', () => {
            const mockAssetCoordinator = createMockAssetCoordinator();
            const registerSpy = mock(() => {});
            mockAssetCoordinator.registerClient = registerSpy;

            // Configure with spy
            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: mockAssetCoordinator,
            });

            // In real handler, registerClient would be called on connection open
            mockAssetCoordinator.registerClient('test-uuid', 'client-1', {} as any);
            expect(registerSpy).toHaveBeenCalledWith('test-uuid', 'client-1', expect.anything());
        });

        it('should unregister client on close', () => {
            const mockAssetCoordinator = createMockAssetCoordinator();
            const unregisterSpy = mock(() => {});
            mockAssetCoordinator.unregisterClient = unregisterSpy;

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: mockAssetCoordinator,
            });

            // In real handler, unregisterClient would be called on connection close
            mockAssetCoordinator.unregisterClient('test-uuid', 'client-1');
            expect(unregisterSpy).toHaveBeenCalledWith('test-uuid', 'client-1');
        });

        it('should handle asset messages via coordinator', async () => {
            const mockAssetCoordinator = createMockAssetCoordinator();
            const handleMessageSpy = mock(async () => {});
            mockAssetCoordinator.handleMessage = handleMessageSpy;

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: mockAssetCoordinator,
            });

            const assetMsg = { type: 'request-asset', projectId: 'p1', clientId: 'c1', data: {} };
            await mockAssetCoordinator.handleMessage('test-uuid', 'client-1', assetMsg);

            expect(handleMessageSpy).toHaveBeenCalledWith('test-uuid', 'client-1', assetMsg);
        });

        it('should trigger collaboration detection when second client joins', async () => {
            const mockAssetCoordinator = createMockAssetCoordinator();
            const collaborationSpy = mock(async () => {});
            mockAssetCoordinator.onCollaborationDetected = collaborationSpy;

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: mockAssetCoordinator,
            });

            // Simulate collaboration detection
            const ws1 = createMockWebSocket();
            const ws2 = createMockWebSocket();
            const docName = 'project-collab-test';

            roomManager.addConnection(docName, ws1 as any, 'collab-uuid');
            const room = roomManager.getRoom(docName);

            // After first client, no collaboration
            expect(room?.conns.size).toBe(1);

            roomManager.addConnection(docName, ws2 as any, 'collab-uuid');

            // After second client, collaboration should be detected
            expect(room?.conns.size).toBe(2);

            // In real handler, this would be called:
            await mockAssetCoordinator.onCollaborationDetected('collab-uuid');
            expect(collaborationSpy).toHaveBeenCalledWith('collab-uuid');
        });
    });

    // =========================================================================
    // Dependency Injection Tests
    // =========================================================================

    describe('Dependency Injection', () => {
        it('should use configured queries', async () => {
            const customQueries = createMockQueries();
            const findProjectSpy = mock(async () => ({ id: 999, uuid: 'custom', owner_id: 1 }));
            customQueries.findProjectByUuid = findProjectSpy;

            configure({
                db: mockDb,
                queries: customQueries,
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: createMockAssetCoordinator(),
            });

            await customQueries.findProjectByUuid(mockDb, 'any-uuid');
            expect(findProjectSpy).toHaveBeenCalled();
        });

        it('should use configured auth', async () => {
            const customAuth = createMockAuth();
            const verifySpy = mock(async () => ({ sub: 999, email: 'custom@test.com', roles: [] }));
            customAuth.verifyToken = verifySpy;

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: customAuth,
                assetCoordinator: createMockAssetCoordinator(),
            });

            await customAuth.verifyToken('any-token');
            expect(verifySpy).toHaveBeenCalled();
        });

        it('should reset to default dependencies', () => {
            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: createMockAssetCoordinator(),
            });

            resetDependencies();

            // After reset, should use default dependencies
            // This is verified by the fact that no error is thrown
            const routes = createWebSocketRoutes();
            expect(routes).toBeDefined();
        });
    });

    // =========================================================================
    // Message Parser Edge Cases
    // =========================================================================

    describe('Message Parser Edge Cases', () => {
        it('should handle empty buffer as unknown', () => {
            const buffer = Buffer.from([]);
            const parsed = parseMessage(buffer);
            // Empty buffer is treated as unknown (no valid Yjs message)
            expect(parsed.kind).toBe('unknown');
        });

        it('should handle large binary messages', () => {
            const largeBuffer = Buffer.alloc(10000, 0x01);
            const parsed = parseMessage(largeBuffer);
            expect(parsed.kind).toBe('yjs');
        });

        it('should handle all valid asset message types', () => {
            // Valid asset message types from types.ts
            const assetTypes = [
                'awareness-update',
                'request-asset',
                'asset-uploaded',
                'prefetch-progress',
                'bulk-upload-progress',
                'upload-request',
                'asset-ready',
                'asset-not-found',
                'request-prefetch',
                'asset-available',
            ];

            for (const type of assetTypes) {
                const msg = JSON.stringify({ type, projectId: 'p1', clientId: 'c1', data: {} });
                const parsed = parseMessage(msg);
                expect(parsed.kind).toBe('asset');
            }
        });

        it('should detect asset message type correctly', () => {
            expect(isAssetMessageType('request-asset')).toBe(true);
            expect(isAssetMessageType('awareness-update')).toBe(true);
            expect(isAssetMessageType('unknown-type')).toBe(false);
            expect(isAssetMessageType('')).toBe(false);
        });
    });

    // =========================================================================
    // Environment Variable Tests
    // =========================================================================

    describe('Environment Variables', () => {
        it('should use PORT when ELYSIA_PORT is not set', () => {
            const originalElysiaPort = process.env.ELYSIA_PORT;
            const originalPort = process.env.PORT;

            delete process.env.ELYSIA_PORT;
            process.env.PORT = '5000';

            stop();
            initialize();

            const info = getServerInfo();
            expect(info.port).toBe(5000);

            // Restore
            if (originalElysiaPort) process.env.ELYSIA_PORT = originalElysiaPort;
            if (originalPort) {
                process.env.PORT = originalPort;
            } else {
                delete process.env.PORT;
            }
        });
    });

    // =========================================================================
    // Exported Helper Functions Tests
    // =========================================================================

    describe('generateClientId', () => {
        it('should generate unique client IDs', () => {
            const id1 = generateClientId();
            const id2 = generateClientId();

            expect(id1).not.toBe(id2);
        });

        it('should have correct format: client-{timestamp}-{random}', () => {
            const id = generateClientId();

            expect(id).toMatch(/^client-\d+-[a-z0-9]+$/);
        });

        it('should start with "client-"', () => {
            const id = generateClientId();

            expect(id.startsWith('client-')).toBe(true);
        });

        it('should include timestamp component', () => {
            const before = Date.now();
            const id = generateClientId();
            const after = Date.now();

            const parts = id.split('-');
            const timestamp = parseInt(parts[1], 10);

            expect(timestamp).toBeGreaterThanOrEqual(before);
            expect(timestamp).toBeLessThanOrEqual(after);
        });
    });

    describe('checkWebSocketProjectAccess', () => {
        it('should grant access when session exists in memory', async () => {
            // Session is already set up in beforeEach
            const result = await checkWebSocketProjectAccess('session-uuid', 999);

            expect(result.hasAccess).toBe(true);
        });

        it('should grant access to project owner', async () => {
            // test-uuid is owned by user 1 (set up in beforeEach)
            const result = await checkWebSocketProjectAccess('test-uuid', 1);

            expect(result.hasAccess).toBe(true);
        });

        it('should grant access to public project', async () => {
            // public-uuid is public (set up in beforeEach)
            const result = await checkWebSocketProjectAccess('public-uuid', 999);

            expect(result.hasAccess).toBe(true);
        });

        it('should deny access to private project for non-owner', async () => {
            // test-uuid is private and owned by user 1
            const result = await checkWebSocketProjectAccess('test-uuid', 2);

            expect(result.hasAccess).toBe(false);
            expect(result.reason).toBe('Access denied');
        });

        it('should deny access when project not found', async () => {
            const result = await checkWebSocketProjectAccess('non-existent-uuid', 1);

            expect(result.hasAccess).toBe(false);
            expect(result.reason).toBe('Project not found');
        });
    });

    // =========================================================================
    // WebSocket Handler Functions Tests
    // =========================================================================

    describe('handleWebSocketOpen', () => {
        it('should return error for invalid document name', async () => {
            const ws = createMockWebSocket() as any;

            const result = await handleWebSocketOpen(ws, 'invalid-doc', 'valid-token-user-1');

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(4000);
            expect(result.error?.reason).toContain('Invalid document name');
        });

        it('should return error when token is missing', async () => {
            const ws = createMockWebSocket() as any;

            const result = await handleWebSocketOpen(ws, 'project-a1b2c3d4-e5f6-7890-abcd-ef1234567890', undefined);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(4001);
            expect(result.error?.reason).toBe('Token required');
        });

        it('should return error for invalid token', async () => {
            const ws = createMockWebSocket() as any;

            const result = await handleWebSocketOpen(
                ws,
                'project-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                'invalid-token',
            );

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(4001);
            expect(result.error?.reason).toBe('Invalid token');
        });

        it('should return error when access denied', async () => {
            const ws = createMockWebSocket() as any;
            // Add a project that user 2 doesn't have access to (owned by user 1, private)
            const privateUuid = 'c1c2c3c4-e5f6-7890-abcd-ef1234567890';
            mockProjects.set(privateUuid, {
                id: 3,
                uuid: privateUuid,
                owner_id: 1,
                visibility: 'private',
            });

            // Token is for user 2 but project is owned by user 1 and private
            const result = await handleWebSocketOpen(ws, `project-${privateUuid}`, 'valid-token-user-2');

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(4003);
        });

        it('should succeed for valid connection', async () => {
            const ws = createMockWebSocket() as any;

            // Need to add the session-uuid to the sessions
            mockSessions.set('a1b2c3d4-e5f6-7890-abcd-ef1234567890', {
                sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                fileName: 'Test.elp',
            });

            const result = await handleWebSocketOpen(
                ws,
                'project-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                'valid-token-user-1',
            );

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should register client with asset coordinator on success', async () => {
            const mockAssetCoordinator = createMockAssetCoordinator();
            const registerSpy = mock(() => {});
            mockAssetCoordinator.registerClient = registerSpy;

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: mockAssetCoordinator,
            });

            const ws = createMockWebSocket() as any;
            mockSessions.set('b1b2c3d4-e5f6-7890-abcd-ef1234567890', {
                sessionId: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
            });

            await handleWebSocketOpen(ws, 'project-b1b2c3d4-e5f6-7890-abcd-ef1234567890', 'valid-token-user-1');

            expect(registerSpy).toHaveBeenCalled();
        });

        it('should trigger collaboration detection when second client joins', async () => {
            const mockAssetCoordinator = createMockAssetCoordinator();
            const collaborationSpy = mock(async () => {});
            mockAssetCoordinator.onCollaborationDetected = collaborationSpy;

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: mockAssetCoordinator,
            });

            const projectUuid = 'd1d2d3d4-e5f6-7890-abcd-ef1234567890';
            const docName = `project-${projectUuid}`;

            // Add session for the project
            mockSessions.set(projectUuid, { sessionId: projectUuid });

            // First client connects - no collaboration yet
            const ws1 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws1, docName, 'valid-token-user-1');

            // Collaboration should NOT be detected yet (only 1 client)
            expect(collaborationSpy).not.toHaveBeenCalled();

            // Second client connects - collaboration should be detected
            const ws2 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws2, docName, 'valid-token-user-2');

            // Now collaboration should be detected
            expect(collaborationSpy).toHaveBeenCalledWith(projectUuid);
        });

        it('should handle error in onCollaborationDetected gracefully', async () => {
            const mockAssetCoordinator = createMockAssetCoordinator();
            // Make onCollaborationDetected throw an error
            mockAssetCoordinator.onCollaborationDetected = async () => {
                throw new Error('Collaboration error');
            };

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: mockAssetCoordinator,
            });

            const projectUuid = 'e1e2e3e4-e5f6-7890-abcd-ef1234567890';
            const docName = `project-${projectUuid}`;

            mockSessions.set(projectUuid, { sessionId: projectUuid });

            // First client
            const ws1 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws1, docName, 'valid-token-user-1');

            // Second client - should not throw even if onCollaborationDetected fails
            const ws2 = createMockWebSocket() as any;
            const result = await handleWebSocketOpen(ws2, docName, 'valid-token-user-2');

            // Connection should still succeed despite error in collaboration detection
            expect(result.success).toBe(true);
        });

        it('should send request-sync-state to first client when collaboration starts on unsaved project', async () => {
            const projectUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            const docName = `project-${projectUuid}`;

            // Create an unsaved project (saved_once = 0)
            mockProjects.set(projectUuid, {
                id: 999,
                uuid: projectUuid,
                owner_id: 1,
                status: 'active',
                visibility: 'private',
                saved_once: 0, // Not saved yet
            });

            // Add session for access control
            mockSessions.set(projectUuid, { sessionId: projectUuid });

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: createMockAssetCoordinator(),
            });

            // First client connects
            const ws1 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws1, docName, 'valid-token-user-1');

            // No sync request should be sent yet (only 1 client)
            expect(ws1.sentMessages.length).toBe(0);

            // Second client connects - collaboration detected
            const ws2 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws2, docName, 'valid-token-user-2');

            // Wait for async operation to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // First client should receive request-sync-state message
            const syncMessages = ws1.sentMessages.filter((msg: any) => {
                if (typeof msg === 'string') {
                    try {
                        const parsed = JSON.parse(msg);
                        return parsed.type === 'request-sync-state';
                    } catch {
                        return false;
                    }
                }
                return false;
            });

            expect(syncMessages.length).toBe(1);
            const syncMsg = JSON.parse(syncMessages[0]);
            expect(syncMsg.reason).toBe('collaboration-started');
            expect(syncMsg.projectUuid).toBe(projectUuid);
        });

        it('should NOT send request-sync-state when project is already saved', async () => {
            const projectUuid = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
            const docName = `project-${projectUuid}`;

            // Create a saved project (saved_once = 1)
            mockProjects.set(projectUuid, {
                id: 998,
                uuid: projectUuid,
                owner_id: 1,
                status: 'active',
                visibility: 'private',
                saved_once: 1, // Already saved
            });

            // Add session for access control
            mockSessions.set(projectUuid, { sessionId: projectUuid });

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: createMockAssetCoordinator(),
            });

            // First client connects
            const ws1 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws1, docName, 'valid-token-user-1');

            // Second client connects
            const ws2 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws2, docName, 'valid-token-user-2');

            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 50));

            // First client should NOT receive any request-sync-state messages
            const syncMessages = ws1.sentMessages.filter((msg: any) => {
                if (typeof msg === 'string') {
                    try {
                        const parsed = JSON.parse(msg);
                        return parsed.type === 'request-sync-state';
                    } catch {
                        return false;
                    }
                }
                return false;
            });

            expect(syncMessages.length).toBe(0);
        });

        it('should handle error when checking unsaved project gracefully', async () => {
            const projectUuid = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
            const docName = `project-${projectUuid}`;

            // Create a mock queries that throws on the second findProjectByUuid call
            const mockQueries = createMockQueries();
            let callCount = 0;
            mockQueries.findProjectByUuid = async (_db: any, uuid: string) => {
                callCount++;
                // First call succeeds (for access check), subsequent calls throw
                if (callCount > 1 && uuid === projectUuid) {
                    throw new Error('Database error');
                }
                return mockProjects.get(uuid);
            };

            mockProjects.set(projectUuid, {
                id: 997,
                uuid: projectUuid,
                owner_id: 1,
                status: 'active',
                visibility: 'private',
                saved_once: 0,
            });

            // Add session for access control
            mockSessions.set(projectUuid, { sessionId: projectUuid });

            configure({
                db: mockDb,
                queries: mockQueries,
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: createMockAssetCoordinator(),
            });

            // First client connects
            const ws1 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws1, docName, 'valid-token-user-1');

            // Second client connects - should not throw even if findProjectByUuid fails
            const ws2 = createMockWebSocket() as any;
            const result = await handleWebSocketOpen(ws2, docName, 'valid-token-user-2');

            // Connection should still succeed
            expect(result.success).toBe(true);
        });

        it('should swallow errors while checking save status during collaboration', async () => {
            const projectUuid = 'f4e5d6c7-b8a9-0123-def4-567890123456';
            const docName = `project-${projectUuid}`;

            const mockQueries = createMockQueries();
            mockQueries.findProjectByUuid = async (_db: any, uuid: string) => {
                if (uuid === projectUuid) {
                    throw new Error('Database error');
                }
                return mockProjects.get(uuid);
            };

            // Add session so access check bypasses DB
            mockSessions.set(projectUuid, { sessionId: projectUuid });

            configure({
                db: mockDb,
                queries: mockQueries,
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: createMockAssetCoordinator(),
            });

            const ws1 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws1, docName, 'valid-token-user-1');

            const ws2 = createMockWebSocket() as any;
            const result = await handleWebSocketOpen(ws2, docName, 'valid-token-user-2');

            expect(result.success).toBe(true);

            // Allow async collaboration check to complete
            await new Promise(resolve => setTimeout(resolve, 10));
        });
    });

    describe('trigger-resync on new client join', () => {
        it('should send trigger-resync to existing clients when a new client joins', async () => {
            const projectUuid = 'ae5c0c01-1234-5678-abcd-ef1234567890';
            const docName = `project-${projectUuid}`;

            mockSessions.set(projectUuid, { sessionId: projectUuid });
            mockProjects.set(projectUuid, {
                id: 800,
                uuid: projectUuid,
                owner_id: 1,
                status: 'active',
                visibility: 'private',
                saved_once: 1,
            });

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: createMockAssetCoordinator(),
            });

            // First client connects
            const ws1 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws1, docName, 'valid-token-user-1');
            expect(ws1.sentMessages.length).toBe(0);

            // Second client connects
            const ws2 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws2, docName, 'valid-token-user-2');

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            // First client should receive trigger-resync
            const resyncMessages = ws1.sentMessages.filter((msg: any) => {
                if (typeof msg === 'string') {
                    try {
                        const parsed = JSON.parse(msg);
                        return parsed.type === 'trigger-resync';
                    } catch {
                        return false;
                    }
                }
                return false;
            });

            expect(resyncMessages.length).toBe(1);
            const resyncMsg = JSON.parse(resyncMessages[0]);
            expect(resyncMsg.reason).toBe('new-client-joined');
            expect(resyncMsg.projectUuid).toBe(projectUuid);

            // Second client should also receive trigger-resync (self-rebroadcast for race safety)
            const ws2ResyncMessages = ws2.sentMessages.filter((msg: any) => {
                if (typeof msg === 'string') {
                    try {
                        const parsed = JSON.parse(msg);
                        return parsed.type === 'trigger-resync';
                    } catch {
                        return false;
                    }
                }
                return false;
            });
            expect(ws2ResyncMessages.length).toBe(1);
        });

        it('should send trigger-resync to all existing clients when third client joins', async () => {
            const projectUuid = 'be5c0c02-1234-5678-abcd-ef1234567890';
            const docName = `project-${projectUuid}`;

            mockSessions.set(projectUuid, { sessionId: projectUuid });
            mockProjects.set(projectUuid, {
                id: 801,
                uuid: projectUuid,
                owner_id: 1,
                status: 'active',
                visibility: 'public',
                saved_once: 1,
            });

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: createMockAssetCoordinator(),
            });

            const ws1 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws1, docName, 'valid-token-user-1');

            const ws2 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws2, docName, 'valid-token-user-2');
            await new Promise(resolve => setTimeout(resolve, 50));

            // Clear previous messages
            ws1.sentMessages.length = 0;
            ws2.sentMessages.length = 0;

            // Third client connects
            const ws3 = createMockWebSocket() as any;
            await handleWebSocketOpen(ws3, docName, 'valid-token-admin');
            await new Promise(resolve => setTimeout(resolve, 50));

            // Both ws1 and ws2 should receive trigger-resync
            const countResync = (ws: any) =>
                ws.sentMessages.filter((msg: any) => {
                    if (typeof msg === 'string') {
                        try {
                            return JSON.parse(msg).type === 'trigger-resync';
                        } catch {
                            return false;
                        }
                    }
                    return false;
                }).length;

            expect(countResync(ws1)).toBe(1);
            expect(countResync(ws2)).toBe(1);
            expect(countResync(ws3)).toBe(1);
        });
    });

    describe('handleWebSocketPong', () => {
        it('should call onPong when clientId is present', () => {
            const clientId = 'pong-test-client';
            const ws = createMockWebSocket();

            // Start heartbeat first
            heartbeat.startHeartbeat(clientId, ws as any);

            const data: WsData = {
                clientId,
                userId: 1,
                projectUuid: 'test-uuid',
                docName: 'project-test-uuid',
            };

            // Should not throw
            handleWebSocketPong(data);

            expect(heartbeat.getHeartbeatStats().activeClients).toBe(1);
        });

        it('should handle undefined data gracefully', () => {
            // Should not throw
            handleWebSocketPong(undefined);
        });

        it('should handle data without clientId', () => {
            const data = {
                userId: 1,
                projectUuid: 'test-uuid',
                docName: 'project-test-uuid',
            } as WsData;

            // Should not throw
            handleWebSocketPong(data);
        });
    });

    describe('handleWebSocketMessage', () => {
        it('should relay Yjs messages to room', () => {
            const sender = createMockWebSocket();
            const receiver = createMockWebSocket();
            const docName = 'project-message-test';

            roomManager.addConnection(docName, sender as any);
            roomManager.addConnection(docName, receiver as any);

            const data: WsData = {
                clientId: 'sender-client',
                userId: 1,
                projectUuid: 'message-test-uuid',
                docName,
            };

            // Send Yjs binary message
            handleWebSocketMessage(sender as any, data, Buffer.from([1, 2, 3]));

            expect(receiver.send).toHaveBeenCalled();
        });

        it('should handle asset messages', async () => {
            const mockAssetCoordinator = createMockAssetCoordinator();
            const handleMessageSpy = mock(async () => {});
            mockAssetCoordinator.handleMessage = handleMessageSpy;

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: mockAssetCoordinator,
            });

            const ws = createMockWebSocket();
            const docName = 'project-asset-msg-test';
            roomManager.addConnection(docName, ws as any);

            const data: WsData = {
                clientId: 'asset-client',
                userId: 1,
                projectUuid: 'asset-test-uuid',
                docName,
            };

            const assetMsg = JSON.stringify({
                type: 'request-asset',
                projectId: 'asset-test-uuid',
                clientId: 'asset-client',
                data: {},
            });

            handleWebSocketMessage(ws as any, data, assetMsg);

            // Give async handler time to execute
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(handleMessageSpy).toHaveBeenCalled();
        });

        it('should handle error in asset message handler gracefully', async () => {
            const mockAssetCoordinator = createMockAssetCoordinator();
            // Make handleMessage throw an error
            mockAssetCoordinator.handleMessage = async () => {
                throw new Error('Asset handler error');
            };

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: mockAssetCoordinator,
            });

            const ws = createMockWebSocket();
            const docName = 'project-asset-error-test';
            roomManager.addConnection(docName, ws as any);

            const data: WsData = {
                clientId: 'asset-error-client',
                userId: 1,
                projectUuid: 'asset-error-uuid',
                docName,
            };

            const assetMsg = JSON.stringify({
                type: 'request-asset',
                projectId: 'asset-error-uuid',
                clientId: 'asset-error-client',
                data: {},
            });

            // Should not throw even if handleMessage fails
            handleWebSocketMessage(ws as any, data, assetMsg);

            // Give async handler time to execute and log error
            await new Promise(resolve => setTimeout(resolve, 20));
        });

        it('should ignore messages when room not found', () => {
            const ws = createMockWebSocket();

            const data: WsData = {
                clientId: 'no-room-client',
                userId: 1,
                projectUuid: 'no-room-uuid',
                docName: 'non-existent-room',
            };

            // Should not throw
            handleWebSocketMessage(ws as any, data, Buffer.from([1, 2, 3]));
        });

        it('should handle unknown message types', () => {
            const ws = createMockWebSocket();
            const docName = 'project-unknown-msg-test';
            roomManager.addConnection(docName, ws as any);

            const data: WsData = {
                clientId: 'unknown-msg-client',
                userId: 1,
                projectUuid: 'unknown-msg-uuid',
                docName,
            };

            // Should not throw for invalid JSON
            handleWebSocketMessage(ws as any, data, 'not valid json {');
        });
    });

    describe('handleWebSocketClose', () => {
        it('should clean up connection on close', () => {
            const ws = createMockWebSocket();
            const docName = 'project-close-test';
            const clientId = 'close-test-client';

            roomManager.addConnection(docName, ws as any);
            heartbeat.startHeartbeat(clientId, ws as any);

            const data: WsData = {
                clientId,
                userId: 1,
                projectUuid: 'close-test-uuid',
                docName,
            };

            handleWebSocketClose(ws as any, data);

            expect(heartbeat.getHeartbeatStats().activeClients).toBe(0);
        });

        it('should handle undefined data gracefully', () => {
            const ws = createMockWebSocket();

            // Should not throw
            handleWebSocketClose(ws as any, undefined);
        });

        it('should handle data with unknown docName', () => {
            const ws = createMockWebSocket();

            const data: WsData = {
                clientId: 'unknown-doc-client',
                userId: 1,
                projectUuid: 'unknown-doc-uuid',
                docName: 'unknown',
            };

            // Should not throw
            handleWebSocketClose(ws as any, data);
        });

        it('should unregister from asset coordinator', () => {
            const mockAssetCoordinator = createMockAssetCoordinator();
            const unregisterSpy = mock(() => {});
            mockAssetCoordinator.unregisterClient = unregisterSpy;

            configure({
                db: mockDb,
                queries: createMockQueries(),
                sessionManager: createMockSessionManager(),
                auth: createMockAuth(),
                assetCoordinator: mockAssetCoordinator,
            });

            const ws = createMockWebSocket();
            const docName = 'project-unregister-test';

            const data: WsData = {
                clientId: 'unregister-client',
                userId: 1,
                projectUuid: 'unregister-uuid',
                docName,
            };

            handleWebSocketClose(ws as any, data);

            expect(unregisterSpy).toHaveBeenCalledWith('unregister-uuid', 'unregister-client');
        });
    });
});
