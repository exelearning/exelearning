/**
 * Yjs Update Broadcaster Tests
 *
 * Tests for broadcasting Yjs updates to WebSocket clients.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
    configure,
    resetDependencies,
    encodeYjsUpdate,
    broadcastUpdate,
    hasActiveConnections,
    getConnectionCount,
} from './broadcaster';

describe('broadcaster', () => {
    // Track broadcasts for testing
    let broadcasts: Array<{ docName: string; message: Buffer }> = [];
    let mockRooms: Map<string, { conns: Map<unknown, unknown> }> = new Map();

    beforeEach(() => {
        broadcasts = [];
        mockRooms = new Map();

        // Configure with mock room manager
        configure({
            roomManager: {
                broadcastToRoom: (docName: string, message: Buffer) => {
                    broadcasts.push({ docName, message });
                },
                getRoomByProjectUuid: (uuid: string) => {
                    return mockRooms.get(`project-${uuid}`);
                },
                getRoom: (docName: string) => {
                    return mockRooms.get(docName);
                },
            },
        });
    });

    afterEach(() => {
        resetDependencies();
    });

    describe('encodeYjsUpdate', () => {
        it('should encode update with correct VarUint protocol format', () => {
            const update = new Uint8Array([1, 2, 3, 4, 5]);
            const encoded = encodeYjsUpdate(update);

            // Message format: [MESSAGE_SYNC(VarUint), SYNC_STEP_UPDATE(VarUint), length(VarUint), ...update]
            // For small values (< 128), VarUint is a single byte
            expect(encoded[0]).toBe(0); // MESSAGE_SYNC
            expect(encoded[1]).toBe(2); // SYNC_STEP_UPDATE
            expect(encoded[2]).toBe(5); // Length (VarUint, single byte since < 128)
            expect(encoded.slice(3)).toEqual(Buffer.from([1, 2, 3, 4, 5]));
            expect(encoded.length).toBe(3 + 5); // header + data
        });

        it('should handle empty update', () => {
            const update = new Uint8Array([]);
            const encoded = encodeYjsUpdate(update);

            expect(encoded[0]).toBe(0); // MESSAGE_SYNC
            expect(encoded[1]).toBe(2); // SYNC_STEP_UPDATE
            expect(encoded[2]).toBe(0); // Length = 0
            expect(encoded.length).toBe(3);
        });

        it('should handle update with length >= 128 (multi-byte VarUint)', () => {
            const update = new Uint8Array(200);
            update.fill(42);

            const encoded = encodeYjsUpdate(update);

            expect(encoded[0]).toBe(0); // MESSAGE_SYNC
            expect(encoded[1]).toBe(2); // SYNC_STEP_UPDATE
            // VarUint(200) = [200 & 0x7F | 0x80, 200 >> 7] = [72 | 128, 1] = [200, 1]
            // Actually: 200 = 0xC8, 200 & 0x7F = 72 = 0x48, with continuation: 72 | 0x80 = 200
            // 200 >> 7 = 1
            expect(encoded[2]).toBe(200); // Low 7 bits + continuation flag
            expect(encoded[3]).toBe(1); // High bits
            // Update starts at byte 4
            expect(encoded[4]).toBe(42);
            expect(encoded.length).toBe(4 + 200); // header (4 bytes for 2-byte VarUint length) + data
        });

        it('should handle large update (10000 bytes)', () => {
            const update = new Uint8Array(10000);
            update.fill(42);

            const encoded = encodeYjsUpdate(update);

            expect(encoded[0]).toBe(0); // MESSAGE_SYNC
            expect(encoded[1]).toBe(2); // SYNC_STEP_UPDATE
            // VarUint(10000):
            // 10000 = 0x2710
            // 10000 & 0x7F = 16, with continuation: 16 | 0x80 = 144
            // 10000 >> 7 = 78, which is < 128
            expect(encoded[2]).toBe(144); // Low 7 bits + continuation
            expect(encoded[3]).toBe(78); // High bits
            // Update starts at byte 4
            expect(encoded[4]).toBe(42);
            expect(encoded.length).toBe(4 + 10000); // header + data
        });
    });

    describe('broadcastUpdate', () => {
        it('should broadcast to room when clients connected', () => {
            // Setup mock room with connections
            mockRooms.set('project-uuid-1', {
                conns: new Map([
                    ['conn1', {}],
                    ['conn2', {}],
                ]),
            });

            const update = new Uint8Array([10, 20, 30]);
            const result = broadcastUpdate('uuid-1', update);

            expect(result).toBe(true);
            expect(broadcasts.length).toBe(1);
            expect(broadcasts[0].docName).toBe('project-uuid-1');
            expect(broadcasts[0].message[0]).toBe(0); // MESSAGE_SYNC
            expect(broadcasts[0].message[1]).toBe(2); // SYNC_STEP_UPDATE
            expect(broadcasts[0].message[2]).toBe(3); // Length (VarUint)
            expect(broadcasts[0].message.slice(3)).toEqual(Buffer.from([10, 20, 30])); // Update data
        });

        it('should return false when room does not exist', () => {
            const update = new Uint8Array([10, 20, 30]);
            const result = broadcastUpdate('non-existent', update);

            expect(result).toBe(false);
            expect(broadcasts.length).toBe(0);
        });

        it('should return false when room has no connections', () => {
            mockRooms.set('project-uuid-1', {
                conns: new Map(), // Empty connections
            });

            const update = new Uint8Array([10, 20, 30]);
            const result = broadcastUpdate('uuid-1', update);

            expect(result).toBe(false);
            expect(broadcasts.length).toBe(0);
        });
    });

    describe('hasActiveConnections', () => {
        it('should return true when connections exist', () => {
            mockRooms.set('project-uuid-1', {
                conns: new Map([['conn1', {}]]),
            });

            expect(hasActiveConnections('uuid-1')).toBe(true);
        });

        it('should return false when no connections', () => {
            mockRooms.set('project-uuid-1', {
                conns: new Map(),
            });

            expect(hasActiveConnections('uuid-1')).toBe(false);
        });

        it('should return false when room does not exist', () => {
            expect(hasActiveConnections('non-existent')).toBe(false);
        });
    });

    describe('getConnectionCount', () => {
        it('should return correct count', () => {
            mockRooms.set('project-uuid-1', {
                conns: new Map([
                    ['conn1', {}],
                    ['conn2', {}],
                    ['conn3', {}],
                ]),
            });

            expect(getConnectionCount('uuid-1')).toBe(3);
        });

        it('should return 0 when no connections', () => {
            mockRooms.set('project-uuid-1', {
                conns: new Map(),
            });

            expect(getConnectionCount('uuid-1')).toBe(0);
        });

        it('should return 0 when room does not exist', () => {
            expect(getConnectionCount('non-existent')).toBe(0);
        });
    });
});
