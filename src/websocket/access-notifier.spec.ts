/**
 * AccessNotifier Tests
 *
 * Tests for access revocation notifications via WebSocket
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { configure, resetDependencies, notifyVisibilityChanged, notifyCollaboratorRemoved } from './access-notifier';

/**
 * Create a mock WebSocket
 */
function createMockWebSocket() {
    return {
        send: mock(() => {}),
        close: mock(() => {}),
        readyState: 1,
        data: { userId: 1, clientId: 'client-1', projectUuid: 'test-uuid', docName: 'project-test-uuid' },
    };
}

describe('AccessNotifier', () => {
    let mockRoomManager: {
        getRoomByProjectUuid: ReturnType<typeof mock>;
        getConnectionsByUserId: ReturnType<typeof mock>;
        getConnectedUserIds: ReturnType<typeof mock>;
    };

    beforeEach(() => {
        mockRoomManager = {
            getRoomByProjectUuid: mock(() => undefined),
            getConnectionsByUserId: mock(() => []),
            getConnectedUserIds: mock(() => []),
        };

        configure({
            roomManager: mockRoomManager,
        });
    });

    afterEach(() => {
        resetDependencies();
    });

    describe('notifyVisibilityChanged', () => {
        it('should return 0 when no users are connected', () => {
            mockRoomManager.getConnectedUserIds.mockReturnValue([]);

            const result = notifyVisibilityChanged('test-uuid', 1, [2, 3]);

            expect(result).toBe(0);
            expect(mockRoomManager.getConnectedUserIds).toHaveBeenCalledWith('project-test-uuid');
            expect(mockRoomManager.getConnectionsByUserId).not.toHaveBeenCalled();
        });

        it('should return 0 when all connected users are authorized (owner)', () => {
            mockRoomManager.getConnectedUserIds.mockReturnValue([1]); // Only owner

            const result = notifyVisibilityChanged('test-uuid', 1, []);

            expect(result).toBe(0);
        });

        it('should return 0 when all connected users are authorized (collaborators)', () => {
            mockRoomManager.getConnectedUserIds.mockReturnValue([1, 2, 3]); // Owner + collaborators
            mockRoomManager.getConnectionsByUserId.mockReturnValue([]);

            const result = notifyVisibilityChanged('test-uuid', 1, [2, 3]);

            expect(result).toBe(0);
        });

        it('should kick unauthorized users and return count', () => {
            const mockWs = createMockWebSocket();
            mockRoomManager.getConnectedUserIds.mockReturnValue([1, 2, 5]); // Owner=1, collab=2, unauthorized=5
            mockRoomManager.getConnectionsByUserId.mockImplementation((docName, userId) => {
                if (userId === 5) return [mockWs];
                return [];
            });

            const result = notifyVisibilityChanged('test-uuid', 1, [2]);

            expect(result).toBe(1); // 1 user kicked
            expect(mockRoomManager.getConnectionsByUserId).toHaveBeenCalledWith('project-test-uuid', 5);
            expect(mockWs.send).toHaveBeenCalled();
        });

        it('should send properly encoded message with 0xFF prefix', async () => {
            const mockWs = createMockWebSocket();
            mockRoomManager.getConnectedUserIds.mockReturnValue([5]);
            mockRoomManager.getConnectionsByUserId.mockReturnValue([mockWs]);

            notifyVisibilityChanged('test-uuid', 1, []);

            // Check message was sent
            expect(mockWs.send).toHaveBeenCalled();
            const sentMessage = mockWs.send.mock.calls[0][0] as Uint8Array;

            // Verify 0xFF prefix
            expect(sentMessage[0]).toBe(0xff);

            // Decode and verify JSON content
            const jsonPart = new TextDecoder().decode(sentMessage.slice(1));
            const parsed = JSON.parse(jsonPart);
            expect(parsed.type).toBe('access-revoked');
            expect(parsed.projectId).toBe('test-uuid');
            expect(parsed.data.reason).toBe('visibility_changed');
            expect(parsed.data.revokedAt).toBeDefined();
        });

        it('should close connection with code 4003 after sending message', async () => {
            const mockWs = createMockWebSocket();
            mockRoomManager.getConnectedUserIds.mockReturnValue([5]);
            mockRoomManager.getConnectionsByUserId.mockReturnValue([mockWs]);

            notifyVisibilityChanged('test-uuid', 1, []);

            // Wait for the setTimeout to execute
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockWs.close).toHaveBeenCalledWith(4003, 'Project visibility changed to private');
        });

        it('should kick multiple unauthorized users', () => {
            const mockWs1 = createMockWebSocket();
            const mockWs2 = createMockWebSocket();
            mockRoomManager.getConnectedUserIds.mockReturnValue([1, 4, 5]); // Owner=1, unauthorized=4,5
            mockRoomManager.getConnectionsByUserId.mockImplementation((docName, userId) => {
                if (userId === 4) return [mockWs1];
                if (userId === 5) return [mockWs2];
                return [];
            });

            const result = notifyVisibilityChanged('test-uuid', 1, []);

            expect(result).toBe(2); // 2 users kicked
            expect(mockWs1.send).toHaveBeenCalled();
            expect(mockWs2.send).toHaveBeenCalled();
        });

        it('should handle user with multiple connections', () => {
            const mockWs1 = createMockWebSocket();
            const mockWs2 = createMockWebSocket();
            mockRoomManager.getConnectedUserIds.mockReturnValue([5]); // One user with multiple connections
            mockRoomManager.getConnectionsByUserId.mockReturnValue([mockWs1, mockWs2]);

            const result = notifyVisibilityChanged('test-uuid', 1, []);

            expect(result).toBe(1); // 1 user kicked (but 2 connections)
            expect(mockWs1.send).toHaveBeenCalled();
            expect(mockWs2.send).toHaveBeenCalled();
        });

        it('should not kick owner even if not in collaborator list', () => {
            const mockWs = createMockWebSocket();
            mockRoomManager.getConnectedUserIds.mockReturnValue([1, 5]);
            mockRoomManager.getConnectionsByUserId.mockImplementation((docName, userId) => {
                if (userId === 5) return [mockWs];
                return [];
            });

            const result = notifyVisibilityChanged('test-uuid', 1, [2, 3]); // Owner=1, collabs=2,3

            expect(result).toBe(1); // Only user 5 kicked
            // Should not call getConnectionsByUserId for owner
            expect(mockRoomManager.getConnectionsByUserId).not.toHaveBeenCalledWith('project-test-uuid', 1);
        });

        it('should handle WebSocket send errors gracefully', async () => {
            const mockWs = createMockWebSocket();
            mockWs.send.mockImplementation(() => {
                throw new Error('Connection reset');
            });
            mockRoomManager.getConnectedUserIds.mockReturnValue([5]);
            mockRoomManager.getConnectionsByUserId.mockReturnValue([mockWs]);

            // Should not throw
            const result = notifyVisibilityChanged('test-uuid', 1, []);

            expect(result).toBe(1);

            // Wait for close attempt
            await new Promise(resolve => setTimeout(resolve, 150));

            // Should still attempt to close
            expect(mockWs.close).toHaveBeenCalled();
        });
    });

    describe('notifyCollaboratorRemoved', () => {
        it('should return 0 when user is not connected', () => {
            mockRoomManager.getConnectionsByUserId.mockReturnValue([]);

            const result = notifyCollaboratorRemoved('test-uuid', 5);

            expect(result).toBe(0);
            expect(mockRoomManager.getConnectionsByUserId).toHaveBeenCalledWith('project-test-uuid', 5);
        });

        it('should kick specific user and return connection count', () => {
            const mockWs = createMockWebSocket();
            mockRoomManager.getConnectionsByUserId.mockReturnValue([mockWs]);

            const result = notifyCollaboratorRemoved('test-uuid', 5);

            expect(result).toBe(1);
            expect(mockWs.send).toHaveBeenCalled();
        });

        it('should send properly encoded message with collaborator_removed reason', async () => {
            const mockWs = createMockWebSocket();
            mockRoomManager.getConnectionsByUserId.mockReturnValue([mockWs]);

            notifyCollaboratorRemoved('test-uuid', 5);

            // Check message was sent
            expect(mockWs.send).toHaveBeenCalled();
            const sentMessage = mockWs.send.mock.calls[0][0] as Uint8Array;

            // Verify 0xFF prefix
            expect(sentMessage[0]).toBe(0xff);

            // Decode and verify JSON content
            const jsonPart = new TextDecoder().decode(sentMessage.slice(1));
            const parsed = JSON.parse(jsonPart);
            expect(parsed.type).toBe('access-revoked');
            expect(parsed.projectId).toBe('test-uuid');
            expect(parsed.data.reason).toBe('collaborator_removed');
            expect(parsed.data.revokedAt).toBeDefined();
        });

        it('should close connection with code 4003', async () => {
            const mockWs = createMockWebSocket();
            mockRoomManager.getConnectionsByUserId.mockReturnValue([mockWs]);

            notifyCollaboratorRemoved('test-uuid', 5);

            // Wait for the setTimeout to execute
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockWs.close).toHaveBeenCalledWith(4003, 'Collaborator access removed');
        });

        it('should close all connections for user with multiple tabs', () => {
            const mockWs1 = createMockWebSocket();
            const mockWs2 = createMockWebSocket();
            const mockWs3 = createMockWebSocket();
            mockRoomManager.getConnectionsByUserId.mockReturnValue([mockWs1, mockWs2, mockWs3]);

            const result = notifyCollaboratorRemoved('test-uuid', 5);

            expect(result).toBe(3);
            expect(mockWs1.send).toHaveBeenCalled();
            expect(mockWs2.send).toHaveBeenCalled();
            expect(mockWs3.send).toHaveBeenCalled();
        });

        it('should handle WebSocket send errors gracefully', async () => {
            const mockWs = createMockWebSocket();
            mockWs.send.mockImplementation(() => {
                throw new Error('Connection reset');
            });
            mockRoomManager.getConnectionsByUserId.mockReturnValue([mockWs]);

            // Should not throw
            const result = notifyCollaboratorRemoved('test-uuid', 5);

            expect(result).toBe(1);

            // Wait for close attempt
            await new Promise(resolve => setTimeout(resolve, 150));

            // Should still attempt to close
            expect(mockWs.close).toHaveBeenCalled();
        });

        it('should handle WebSocket close errors gracefully', async () => {
            const mockWs = createMockWebSocket();
            mockWs.close.mockImplementation(() => {
                throw new Error('Already closed');
            });
            mockRoomManager.getConnectionsByUserId.mockReturnValue([mockWs]);

            // Should not throw
            const result = notifyCollaboratorRemoved('test-uuid', 5);

            expect(result).toBe(1);

            // Wait for close attempt - should not throw
            await new Promise(resolve => setTimeout(resolve, 150));
        });
    });

    describe('edge cases', () => {
        it('should handle empty collaborator list', () => {
            const mockWs = createMockWebSocket();
            mockRoomManager.getConnectedUserIds.mockReturnValue([5]);
            mockRoomManager.getConnectionsByUserId.mockReturnValue([mockWs]);

            const result = notifyVisibilityChanged('test-uuid', 1, []);

            expect(result).toBe(1);
        });

        it('should handle owner ID being 0 (valid edge case)', () => {
            const mockWs = createMockWebSocket();
            mockRoomManager.getConnectedUserIds.mockReturnValue([0, 5]);
            mockRoomManager.getConnectionsByUserId.mockImplementation((docName, userId) => {
                if (userId === 5) return [mockWs];
                return [];
            });

            const result = notifyVisibilityChanged('test-uuid', 0, []);

            expect(result).toBe(1); // Only user 5 kicked, owner 0 stays
        });

        it('should handle duplicate collaborator IDs', () => {
            const mockWs = createMockWebSocket();
            mockRoomManager.getConnectedUserIds.mockReturnValue([1, 2, 5]);
            mockRoomManager.getConnectionsByUserId.mockImplementation((docName, userId) => {
                if (userId === 5) return [mockWs];
                return [];
            });

            const result = notifyVisibilityChanged('test-uuid', 1, [2, 2, 2]);

            expect(result).toBe(1); // Only user 5 kicked
        });

        it('should handle owner being in collaborator list too', () => {
            mockRoomManager.getConnectedUserIds.mockReturnValue([1, 2]);

            const result = notifyVisibilityChanged('test-uuid', 1, [1, 2]);

            expect(result).toBe(0); // No one kicked
        });
    });
});
