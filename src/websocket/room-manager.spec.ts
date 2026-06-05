/**
 * Tests for Room Manager
 * Uses Dependency Injection pattern - no mock.module needed
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

import {
    configure,
    resetDependencies,
    extractProjectUuid,
    getOrCreateRoom,
    getRoom,
    addConnection,
    removeConnection,
    scheduleCleanup,
    cancelCleanup,
    relayMessage,
    broadcastToRoom,
    getActiveRooms,
    getRoomStats,
    closeAllRooms,
    getConnectionsByUserId,
    getConnectedUserIds,
    getRoomByProjectUuid,
    relayToOtherInstances,
    initializeCrossInstanceHandler,
} from './room-manager';

// Mock WebSocket for testing
function createMockWebSocket(clientId: string = 'test-client', userId: number = 1) {
    return {
        data: {
            clientId,
            userId,
            projectUuid: 'test-project-uuid',
            docName: 'project-test',
        },
        readyState: 1, // OPEN
        send: mock(() => {}),
        close: mock(() => {}),
        ping: mock(() => {}),
    } as any;
}

describe('Room Manager', () => {
    beforeEach(() => {
        // Configure with mock asset coordinator to prevent DB initialization
        configure({
            assetCoordinator: {
                cleanupProject: () => {},
            },
        });
        closeAllRooms();
    });

    afterEach(() => {
        closeAllRooms();
        resetDependencies();
    });

    describe('extractProjectUuid', () => {
        it('should extract UUID from valid doc name', () => {
            const uuid = extractProjectUuid('project-a1b2c3d4-e5f6-7890-abcd-ef1234567890');
            expect(uuid).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
        });

        it('should return null for invalid doc name', () => {
            expect(extractProjectUuid('invalid')).toBeNull();
            expect(extractProjectUuid('project-short')).toBeNull();
            expect(extractProjectUuid('')).toBeNull();
        });

        it('should handle uppercase UUIDs', () => {
            const uuid = extractProjectUuid('project-A1B2C3D4-E5F6-7890-ABCD-EF1234567890');
            expect(uuid).toBe('A1B2C3D4-E5F6-7890-ABCD-EF1234567890');
        });

        it('should return null for doc name without project prefix', () => {
            expect(extractProjectUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBeNull();
        });
    });

    describe('getOrCreateRoom', () => {
        it('should create a new room', () => {
            const room = getOrCreateRoom('project-test-uuid');

            expect(room).toBeDefined();
            expect(room.name).toBe('project-test-uuid');
            expect(room.conns.size).toBe(0);
        });

        it('should return existing room if already exists', () => {
            const room1 = getOrCreateRoom('project-test');
            const room2 = getOrCreateRoom('project-test');

            expect(room1).toBe(room2);
        });

        it('should use provided projectUuid', () => {
            const room = getOrCreateRoom('doc-name', 'custom-uuid');

            expect(room.projectUuid).toBe('custom-uuid');
        });

        it('should extract UUID from doc name if not provided', () => {
            const room = getOrCreateRoom('project-a1b2c3d4-e5f6-7890-abcd-ef1234567890');

            expect(room.projectUuid).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
        });

        it('should use doc name as UUID if extraction fails', () => {
            const room = getOrCreateRoom('simple-doc');

            expect(room.projectUuid).toBe('simple-doc');
        });
    });

    describe('getRoom', () => {
        it('should return undefined for non-existent room', () => {
            expect(getRoom('non-existent')).toBeUndefined();
        });

        it('should return existing room', () => {
            getOrCreateRoom('test-room');
            const room = getRoom('test-room');

            expect(room).toBeDefined();
            expect(room!.name).toBe('test-room');
        });
    });

    describe('addConnection', () => {
        it('should add connection to room', () => {
            const ws = createMockWebSocket();
            const room = addConnection('test-doc', ws);

            expect(room.conns.size).toBe(1);
            expect(room.conns.has(ws)).toBe(true);
        });

        it('should create room if not exists', () => {
            const ws = createMockWebSocket();
            addConnection('new-room', ws);

            expect(getRoom('new-room')).toBeDefined();
        });

        it('should add multiple connections', () => {
            const ws1 = createMockWebSocket('client-1');
            const ws2 = createMockWebSocket('client-2');
            const ws3 = createMockWebSocket('client-3');

            addConnection('multi-room', ws1);
            addConnection('multi-room', ws2);
            addConnection('multi-room', ws3);

            const room = getRoom('multi-room');
            expect(room!.conns.size).toBe(3);
        });

        it('should not duplicate same connection', () => {
            const ws = createMockWebSocket();

            addConnection('test-room', ws);
            addConnection('test-room', ws);

            const room = getRoom('test-room');
            expect(room!.conns.size).toBe(1);
        });
    });

    describe('removeConnection', () => {
        it('should remove connection from room', () => {
            const ws = createMockWebSocket();
            addConnection('test-room', ws);
            removeConnection('test-room', ws);

            const room = getRoom('test-room');
            expect(room!.conns.size).toBe(0);
        });

        it('should handle removing from non-existent room', () => {
            const ws = createMockWebSocket();
            expect(() => removeConnection('non-existent', ws)).not.toThrow();
        });

        it('should keep other connections intact', () => {
            const ws1 = createMockWebSocket('client-1');
            const ws2 = createMockWebSocket('client-2');

            addConnection('test-room', ws1);
            addConnection('test-room', ws2);
            removeConnection('test-room', ws1);

            const room = getRoom('test-room');
            expect(room!.conns.size).toBe(1);
            expect(room!.conns.has(ws2)).toBe(true);
        });
    });

    describe('scheduleCleanup and cancelCleanup', () => {
        it('should schedule cleanup when room becomes empty', () => {
            const ws = createMockWebSocket();
            addConnection('cleanup-test', ws);
            removeConnection('cleanup-test', ws);

            const room = getRoom('cleanup-test');
            expect(room).toBeDefined();
            // Room still exists but has cleanupController
            expect(room!.cleanupController).toBeDefined();
        });

        it('should cancel cleanup when connection added', () => {
            const ws1 = createMockWebSocket('client-1');
            const ws2 = createMockWebSocket('client-2');

            addConnection('cancel-test', ws1);
            removeConnection('cancel-test', ws1); // Schedules cleanup

            // Add new connection - should cancel cleanup
            addConnection('cancel-test', ws2);

            const room = getRoom('cancel-test');
            expect(room!.cleanupController).toBeUndefined();
        });

        it('should not schedule cleanup if room has connections', () => {
            const ws = createMockWebSocket();
            addConnection('no-cleanup', ws);

            scheduleCleanup('no-cleanup');

            const room = getRoom('no-cleanup');
            expect(room!.cleanupController).toBeUndefined();
        });

        it('cancelCleanup should be safe for non-existent room', () => {
            expect(() => cancelCleanup('non-existent')).not.toThrow();
        });

        it('scheduleCleanup should be safe for non-existent room', () => {
            expect(() => scheduleCleanup('non-existent')).not.toThrow();
        });

        it('should execute cleanup timeout and delete room', async () => {
            const mockCleanupProject = mock(() => {});
            configure({
                assetCoordinator: { cleanupProject: mockCleanupProject },
                cleanupDelayOverride: 10, // 10ms for fast test
            });

            const ws = createMockWebSocket();
            addConnection('timeout-test', ws, 'project-uuid-123');
            removeConnection('timeout-test', ws);

            // Room should exist initially
            expect(getRoom('timeout-test')).toBeDefined();

            // Wait for cleanup timeout to fire
            await new Promise(resolve => setTimeout(resolve, 50));

            // Room should be deleted
            expect(getRoom('timeout-test')).toBeUndefined();

            // Asset coordinator cleanup should be called
            expect(mockCleanupProject).toHaveBeenCalledWith('project-uuid-123');
        });

        it('should cancel cleanup timeout when client reconnects', async () => {
            const mockCleanupProject = mock(() => {});
            configure({
                assetCoordinator: { cleanupProject: mockCleanupProject },
                cleanupDelayOverride: 50, // 50ms delay
            });

            const ws1 = createMockWebSocket('client-1');
            const ws2 = createMockWebSocket('client-2');

            addConnection('reconnect-test', ws1, 'project-reconnect');
            removeConnection('reconnect-test', ws1); // Schedules cleanup

            // Reconnect before timeout fires
            await new Promise(resolve => setTimeout(resolve, 10));
            addConnection('reconnect-test', ws2);

            // Wait longer than original timeout
            await new Promise(resolve => setTimeout(resolve, 100));

            // Room should still exist (cleanup was cancelled)
            const room = getRoom('reconnect-test');
            expect(room).toBeDefined();
            expect(room!.conns.size).toBe(1);

            // Asset coordinator should NOT have been called
            expect(mockCleanupProject).not.toHaveBeenCalled();
        });

        it('should not delete room if connections were added during timeout', async () => {
            const mockCleanupProject = mock(() => {});
            configure({
                assetCoordinator: { cleanupProject: mockCleanupProject },
                cleanupDelayOverride: 30, // 30ms delay
            });

            const ws1 = createMockWebSocket('client-1');
            addConnection('race-test', ws1);
            removeConnection('race-test', ws1); // Schedules cleanup

            // Add connection during cleanup delay
            const ws2 = createMockWebSocket('client-2');
            await new Promise(resolve => setTimeout(resolve, 10));
            addConnection('race-test', ws2);

            // Wait for timeout to fire
            await new Promise(resolve => setTimeout(resolve, 50));

            // Room should still exist with 1 connection
            const room = getRoom('race-test');
            expect(room).toBeDefined();
            expect(room!.conns.size).toBe(1);
        });

        it('should cleanup room without projectUuid', async () => {
            configure({
                assetCoordinator: { cleanupProject: () => {} },
                cleanupDelayOverride: 10,
            });

            // Create room manually to test null projectUuid edge case
            const ws = createMockWebSocket();
            addConnection('no-uuid-room', ws);

            // Manually set projectUuid to empty string
            const room = getRoom('no-uuid-room');
            (room as any).projectUuid = '';

            removeConnection('no-uuid-room', ws);

            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 50));

            // Room should be deleted without error
            expect(getRoom('no-uuid-room')).toBeUndefined();
        });
    });

    describe('relayMessage', () => {
        it('should relay message to other connections', () => {
            const sender = createMockWebSocket('sender');
            const receiver1 = createMockWebSocket('receiver1');
            const receiver2 = createMockWebSocket('receiver2');

            addConnection('relay-room', sender);
            addConnection('relay-room', receiver1);
            addConnection('relay-room', receiver2);

            relayMessage(sender, 'relay-room', 'test message');

            expect(sender.send).not.toHaveBeenCalled();
            expect(receiver1.send).toHaveBeenCalledWith('test message');
            expect(receiver2.send).toHaveBeenCalledWith('test message');
        });

        it('should handle non-existent room', () => {
            const ws = createMockWebSocket();
            expect(() => relayMessage(ws, 'non-existent', 'message')).not.toThrow();
        });

        it('should not send to closed connections', () => {
            const sender = createMockWebSocket('sender');
            const closedReceiver = createMockWebSocket('closed');
            closedReceiver.readyState = 3; // CLOSED

            addConnection('closed-test', sender);
            addConnection('closed-test', closedReceiver);

            relayMessage(sender, 'closed-test', 'message');

            expect(closedReceiver.send).not.toHaveBeenCalled();
        });

        it('should handle send errors gracefully', () => {
            const sender = createMockWebSocket('sender');
            const failingReceiver = createMockWebSocket('failing');
            failingReceiver.send = mock(() => {
                throw new Error('Send failed');
            });

            addConnection('error-test', sender);
            addConnection('error-test', failingReceiver);

            expect(() => relayMessage(sender, 'error-test', 'message')).not.toThrow();
        });
    });

    describe('broadcastToRoom', () => {
        it('should broadcast to all connections including sender', () => {
            const ws1 = createMockWebSocket('client-1');
            const ws2 = createMockWebSocket('client-2');

            addConnection('broadcast-room', ws1);
            addConnection('broadcast-room', ws2);

            broadcastToRoom('broadcast-room', 'broadcast message');

            expect(ws1.send).toHaveBeenCalledWith('broadcast message');
            expect(ws2.send).toHaveBeenCalledWith('broadcast message');
        });

        it('should handle non-existent room', () => {
            expect(() => broadcastToRoom('non-existent', 'message')).not.toThrow();
        });

        it('should handle binary messages', () => {
            const ws = createMockWebSocket();
            addConnection('binary-room', ws);

            const buffer = Buffer.from([0x01, 0x02, 0x03]);
            broadcastToRoom('binary-room', buffer);

            expect(ws.send).toHaveBeenCalledWith(buffer);
        });

        it('should not send to closed connections', () => {
            const openWs = createMockWebSocket('open');
            const closedWs = createMockWebSocket('closed');
            closedWs.readyState = 3; // CLOSED

            addConnection('mixed-room', openWs);
            addConnection('mixed-room', closedWs);

            broadcastToRoom('mixed-room', 'message');

            expect(openWs.send).toHaveBeenCalled();
            expect(closedWs.send).not.toHaveBeenCalled();
        });

        it('should handle send errors gracefully', () => {
            const failingWs = createMockWebSocket('failing');
            failingWs.send = mock(() => {
                throw new Error('Broadcast failed');
            });

            addConnection('fail-room', failingWs);

            expect(() => broadcastToRoom('fail-room', 'message')).not.toThrow();
        });
    });

    describe('getActiveRooms', () => {
        it('should return empty array when no rooms', () => {
            expect(getActiveRooms()).toEqual([]);
        });

        it('should return list of active room names', () => {
            getOrCreateRoom('room-1');
            getOrCreateRoom('room-2');
            getOrCreateRoom('room-3');

            const rooms = getActiveRooms();
            expect(rooms).toContain('room-1');
            expect(rooms).toContain('room-2');
            expect(rooms).toContain('room-3');
            expect(rooms.length).toBe(3);
        });
    });

    describe('getRoomStats', () => {
        it('should return empty stats when no rooms', () => {
            const stats = getRoomStats();

            expect(stats.totalRooms).toBe(0);
            expect(stats.totalConnections).toBe(0);
            expect(stats.rooms).toEqual([]);
        });

        it('should return correct stats for rooms with connections', () => {
            addConnection('room-a', createMockWebSocket('a1'));
            addConnection('room-a', createMockWebSocket('a2'));
            addConnection('room-b', createMockWebSocket('b1'));

            const stats = getRoomStats();

            expect(stats.totalRooms).toBe(2);
            expect(stats.totalConnections).toBe(3);
            expect(stats.rooms.length).toBe(2);

            const roomA = stats.rooms.find(r => r.name === 'room-a');
            expect(roomA!.connections).toBe(2);

            const roomB = stats.rooms.find(r => r.name === 'room-b');
            expect(roomB!.connections).toBe(1);
        });
    });

    describe('closeAllRooms', () => {
        it('should close all connections and clear rooms', () => {
            const ws1 = createMockWebSocket('client-1');
            const ws2 = createMockWebSocket('client-2');

            addConnection('room-1', ws1);
            addConnection('room-2', ws2);

            closeAllRooms();

            expect(ws1.close).toHaveBeenCalled();
            expect(ws2.close).toHaveBeenCalled();
            expect(getActiveRooms()).toEqual([]);
        });

        it('should be safe to call when no rooms', () => {
            expect(() => closeAllRooms()).not.toThrow();
        });

        it('should cancel pending cleanups', () => {
            const ws = createMockWebSocket();
            addConnection('cleanup-room', ws);
            removeConnection('cleanup-room', ws); // Schedules cleanup

            closeAllRooms();

            expect(getActiveRooms()).toEqual([]);
        });

        it('should handle close errors gracefully', () => {
            const failingWs = createMockWebSocket('failing');
            failingWs.close = mock(() => {
                throw new Error('Close failed');
            });

            addConnection('fail-close-room', failingWs);

            expect(() => closeAllRooms()).not.toThrow();
            expect(getActiveRooms()).toEqual([]);
        });
    });

    describe('getConnectionsByUserId', () => {
        it('should return empty array for non-existent room', () => {
            const connections = getConnectionsByUserId('non-existent', 1);
            expect(connections).toEqual([]);
        });

        it('should return empty array when no connections for user', () => {
            const ws1 = createMockWebSocket('client-1', 1);
            addConnection('test-room', ws1);

            const connections = getConnectionsByUserId('test-room', 999);
            expect(connections).toEqual([]);
        });

        it('should return connections for specific user', () => {
            const ws1 = createMockWebSocket('client-1', 1);
            const ws2 = createMockWebSocket('client-2', 2);
            const ws3 = createMockWebSocket('client-3', 1); // Same user

            addConnection('test-room', ws1);
            addConnection('test-room', ws2);
            addConnection('test-room', ws3);

            const connections = getConnectionsByUserId('test-room', 1);
            expect(connections).toHaveLength(2);
            expect(connections).toContain(ws1);
            expect(connections).toContain(ws3);
        });

        it('should handle undefined userId in connection data', () => {
            const ws = createMockWebSocket('client-1', 1);
            ws.data.userId = undefined;
            addConnection('test-room', ws);

            const connections = getConnectionsByUserId('test-room', 1);
            expect(connections).toEqual([]);
        });
    });

    describe('getConnectedUserIds', () => {
        it('should return empty array for non-existent room', () => {
            const userIds = getConnectedUserIds('non-existent');
            expect(userIds).toEqual([]);
        });

        it('should return unique user IDs', () => {
            const ws1 = createMockWebSocket('client-1', 1);
            const ws2 = createMockWebSocket('client-2', 2);
            const ws3 = createMockWebSocket('client-3', 1); // Same user as ws1

            addConnection('test-room', ws1);
            addConnection('test-room', ws2);
            addConnection('test-room', ws3);

            const userIds = getConnectedUserIds('test-room');
            expect(userIds).toHaveLength(2);
            expect(userIds).toContain(1);
            expect(userIds).toContain(2);
        });

        it('should handle undefined userId in connection data', () => {
            const ws = createMockWebSocket('client-1', 1);
            ws.data.userId = undefined;
            addConnection('test-room', ws);

            const userIds = getConnectedUserIds('test-room');
            expect(userIds).toEqual([]);
        });

        it('should handle zero userId', () => {
            const ws = createMockWebSocket('client-1', 0);
            addConnection('test-room', ws);

            const userIds = getConnectedUserIds('test-room');
            expect(userIds).toHaveLength(1);
            expect(userIds).toContain(0);
        });
    });

    describe('getRoomByProjectUuid', () => {
        it('should return undefined for non-existent project', () => {
            const room = getRoomByProjectUuid('non-existent-uuid');
            expect(room).toBeUndefined();
        });

        it('should return room for existing project', () => {
            const ws = createMockWebSocket('client-1');
            addConnection('project-test-uuid', ws, 'test-uuid');

            const room = getRoomByProjectUuid('test-uuid');
            expect(room).toBeDefined();
            expect(room?.conns.size).toBe(1);
        });

        it('should find room by project UUID pattern', () => {
            const ws = createMockWebSocket('client-1');
            addConnection('project-a1b2c3d4-e5f6-7890-abcd-ef1234567890', ws);

            const room = getRoomByProjectUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
            expect(room).toBeDefined();
        });
    });

    describe('pubsub relay and handlers', () => {
        it('should publish relay messages when pubsub is enabled', async () => {
            const publish = mock(async () => {});
            const isPubSubEnabled = mock(() => true);

            configure({
                pubSub: {
                    publish,
                    subscribe: mock(async () => {}),
                    unsubscribe: mock(async () => {}),
                    isPubSubEnabled,
                    setMessageHandler: mock(() => {}),
                },
            });

            await relayToOtherInstances('project-relay', 'payload', { isAsset: true, clientId: 'c1' });

            expect(publish).toHaveBeenCalledWith('project-relay', 'payload', { isAsset: true, clientId: 'c1' });
        });

        it('should skip relay when pubsub is disabled', async () => {
            const publish = mock(async () => {});
            configure({
                pubSub: {
                    publish,
                    subscribe: mock(async () => {}),
                    unsubscribe: mock(async () => {}),
                    isPubSubEnabled: mock(() => false),
                    setMessageHandler: mock(() => {}),
                },
            });

            await relayToOtherInstances('project-relay', 'payload');

            expect(publish).not.toHaveBeenCalled();
        });

        it('should subscribe on first connection and unsubscribe on cleanup', async () => {
            const subscribe = mock(async () => {});
            const unsubscribe = mock(async () => {});
            const cleanupProject = mock(() => {});

            configure({
                assetCoordinator: { cleanupProject },
                cleanupDelayOverride: 10,
                pubSub: {
                    publish: mock(async () => {}),
                    subscribe,
                    unsubscribe,
                    isPubSubEnabled: mock(() => true),
                    setMessageHandler: mock(() => {}),
                },
            });

            const ws = createMockWebSocket();
            addConnection('project-sub-test', ws, 'project-uuid-sub');

            expect(subscribe).toHaveBeenCalledWith('project-sub-test');

            removeConnection('project-sub-test', ws);

            await new Promise(resolve => setTimeout(resolve, 30));

            expect(unsubscribe).toHaveBeenCalledWith('project-sub-test');
            expect(cleanupProject).toHaveBeenCalledWith('project-uuid-sub');
        });

        it('should broadcast cross-instance messages to local room', () => {
            const setMessageHandler = mock(() => {});
            configure({
                pubSub: {
                    publish: mock(async () => {}),
                    subscribe: mock(async () => {}),
                    unsubscribe: mock(async () => {}),
                    isPubSubEnabled: mock(() => true),
                    setMessageHandler,
                },
            });

            const ws1 = createMockWebSocket('client-1');
            const ws2 = createMockWebSocket('client-2');
            addConnection('project-cross', ws1);
            addConnection('project-cross', ws2);

            initializeCrossInstanceHandler();

            const handler = setMessageHandler.mock.calls[0]?.[0];
            expect(typeof handler).toBe('function');

            handler('project-cross', 'cross-message', { isAsset: false });

            expect(ws1.send).toHaveBeenCalledWith('cross-message');
            expect(ws2.send).toHaveBeenCalledWith('cross-message');
        });
    });
});
