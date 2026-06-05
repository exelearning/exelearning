/**
 * Yjs Update Broadcaster
 *
 * Broadcasts Yjs document updates to connected WebSocket clients.
 * When the REST API modifies a document, this module ensures all
 * connected real-time clients receive the updates.
 *
 * Uses the y-websocket protocol format with lib0 VarUint encoding:
 * - VarUint: Message type (0 = sync, 1 = awareness)
 * - VarUint: Sync step (0 = step1, 1 = step2, 2 = update)
 * - VarUint: Update length
 * - Bytes: Update data
 */
import * as roomManagerDefault from '../websocket/room-manager';

// ============================================================================
// Y-WEBSOCKET PROTOCOL CONSTANTS
// ============================================================================

/** Message type for sync messages */
const MESSAGE_SYNC = 0;

/** Sync step for updates */
const SYNC_STEP_UPDATE = 2;

// ============================================================================
// LIB0 VARUINT ENCODING
// ============================================================================

/**
 * Write a variable-length unsigned integer to a buffer
 * Uses lib0's VarUint encoding (7 bits per byte, MSB is continuation flag)
 */
function writeVarUint(buffer: number[], value: number): void {
    while (value > 0x7f) {
        buffer.push((value & 0x7f) | 0x80);
        value >>>= 7;
    }
    buffer.push(value & 0x7f);
}

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

export interface BroadcasterDependencies {
    roomManager: {
        broadcastToRoom: typeof roomManagerDefault.broadcastToRoom;
        getRoomByProjectUuid: typeof roomManagerDefault.getRoomByProjectUuid;
        getRoom: typeof roomManagerDefault.getRoom;
    };
}

const defaultDependencies: BroadcasterDependencies = {
    roomManager: {
        broadcastToRoom: roomManagerDefault.broadcastToRoom,
        getRoomByProjectUuid: roomManagerDefault.getRoomByProjectUuid,
        getRoom: roomManagerDefault.getRoom,
    },
};

let deps: BroadcasterDependencies = defaultDependencies;

/**
 * Configure dependencies (mainly for testing)
 */
export function configure(newDeps: Partial<BroadcasterDependencies>): void {
    deps = {
        ...defaultDependencies,
        ...newDeps,
        roomManager: {
            ...defaultDependencies.roomManager,
            ...(newDeps.roomManager || {}),
        },
    };
}

/**
 * Reset to default dependencies
 */
export function resetDependencies(): void {
    deps = defaultDependencies;
}

// ============================================================================
// BROADCAST OPERATIONS
// ============================================================================

/**
 * Encode a Yjs update as a y-websocket protocol message
 *
 * Format (lib0 VarUint encoding):
 * - VarUint: MESSAGE_SYNC (0) - 1 byte for values 0-127
 * - VarUint: SYNC_STEP_UPDATE (2) - 1 byte for values 0-127
 * - VarUint: update.length - variable length
 * - Bytes: The Yjs update data
 */
export function encodeYjsUpdate(update: Uint8Array): Buffer {
    const buffer: number[] = [];

    // Write message type (sync = 0)
    writeVarUint(buffer, MESSAGE_SYNC);

    // Write sync step (update = 2)
    writeVarUint(buffer, SYNC_STEP_UPDATE);

    // Write update as VarUint8Array (length prefix + data)
    writeVarUint(buffer, update.length);

    // Create final buffer with header + update data
    const message = Buffer.alloc(buffer.length + update.length);
    for (let i = 0; i < buffer.length; i++) {
        message[i] = buffer[i];
    }
    message.set(update, buffer.length);

    return message;
}

/**
 * Broadcast a Yjs update to all WebSocket clients in a project's room
 *
 * @param projectUuid - The project UUID
 * @param update - The Yjs update (from Y.encodeStateAsUpdate)
 * @returns true if broadcast was sent to at least one client
 */
export function broadcastUpdate(projectUuid: string, update: Uint8Array): boolean {
    const docName = `project-${projectUuid}`;
    const room = deps.roomManager.getRoom(docName);

    if (!room || room.conns.size === 0) {
        return false;
    }

    // Encode the update as a y-websocket protocol message
    const message = encodeYjsUpdate(update);

    // Broadcast to all connected clients
    deps.roomManager.broadcastToRoom(docName, message);

    return true;
}

/**
 * Check if a project has active WebSocket connections
 *
 * @param projectUuid - The project UUID
 * @returns true if there are connected clients
 */
export function hasActiveConnections(projectUuid: string): boolean {
    const room = deps.roomManager.getRoomByProjectUuid(projectUuid);
    return room !== undefined && room.conns.size > 0;
}

/**
 * Get the number of connected clients for a project
 *
 * @param projectUuid - The project UUID
 * @returns Number of connected WebSocket clients
 */
export function getConnectionCount(projectUuid: string): number {
    const room = deps.roomManager.getRoomByProjectUuid(projectUuid);
    return room?.conns.size ?? 0;
}
