/**
 * Room Manager for WebSocket Connections
 * Manages room lifecycle with safe cleanup using AbortController
 *
 * Purpose:
 * - Track connections per document/room
 * - Schedule cleanup when rooms become empty
 * - Cancel cleanup if client reconnects
 * - No memory leaks from orphan timers
 */
import type { ServerWebSocket } from 'bun';
import { getConfig, DEBUG } from './config';
import * as assetCoordinatorDefault from './asset-coordinator';
import * as pubSubDefault from '../redis/pubsub-manager';

// ============================================================================
// DEPENDENCY INJECTION INTERFACES
// ============================================================================

/**
 * Asset coordinator dependency interface
 */
export interface RoomManagerAssetCoordinator {
    cleanupProject: typeof assetCoordinatorDefault.cleanupProject;
}

/**
 * Pub/sub manager dependency interface
 */
export interface RoomManagerPubSub {
    publish: typeof pubSubDefault.publish;
    subscribe: typeof pubSubDefault.subscribe;
    unsubscribe: typeof pubSubDefault.unsubscribe;
    isPubSubEnabled: typeof pubSubDefault.isPubSubEnabled;
    setMessageHandler: typeof pubSubDefault.setMessageHandler;
}

/**
 * Full dependencies for room manager
 */
export interface RoomManagerDependencies {
    assetCoordinator: RoomManagerAssetCoordinator;
    pubSub: RoomManagerPubSub;
    /** Override cleanup delay for testing (in ms) */
    cleanupDelayOverride?: number;
}

// Default dependencies
const defaultDependencies: RoomManagerDependencies = {
    assetCoordinator: {
        cleanupProject: assetCoordinatorDefault.cleanupProject,
    },
    pubSub: {
        publish: pubSubDefault.publish,
        subscribe: pubSubDefault.subscribe,
        unsubscribe: pubSubDefault.unsubscribe,
        isPubSubEnabled: pubSubDefault.isPubSubEnabled,
        setMessageHandler: pubSubDefault.setMessageHandler,
    },
};

// Module-level dependencies (set via configure function)
let deps: RoomManagerDependencies = defaultDependencies;

/**
 * Configure dependencies for this module
 */
export function configure(newDeps: Partial<RoomManagerDependencies>): void {
    deps = {
        ...defaultDependencies,
        ...newDeps,
        assetCoordinator: {
            ...defaultDependencies.assetCoordinator,
            ...(newDeps.assetCoordinator || {}),
        },
        pubSub: {
            ...defaultDependencies.pubSub,
            ...(newDeps.pubSub || {}),
        },
    };
}

/**
 * Reset to default dependencies
 */
export function resetDependencies(): void {
    deps = defaultDependencies;
}

/**
 * WebSocket data interface (must match yjs-websocket.ts)
 */
interface WsData {
    clientId: string;
    userId: number;
    projectUuid: string;
    docName: string;
}

/**
 * Room with connections and cleanup state
 */
interface Room {
    name: string;
    conns: Set<ServerWebSocket<WsData>>;
    projectUuid: string;
    /** Controller to cancel pending cleanup */
    cleanupController?: AbortController;
}

/**
 * Active rooms by document name
 */
const rooms = new Map<string, Room>();

/**
 * Extract project UUID from document name
 * Expected format: project-<uuid>
 */
export function extractProjectUuid(docName: string): string | null {
    const match = docName.match(/^project-([0-9a-f-]{36})$/i);
    return match ? match[1] : null;
}

/**
 * Get or create a room for a document
 *
 * @param docName - Document/room name
 * @param projectUuid - Optional project UUID (extracted from docName if not provided)
 */
export function getOrCreateRoom(docName: string, projectUuid?: string): Room {
    let room = rooms.get(docName);

    if (!room) {
        const uuid = projectUuid || extractProjectUuid(docName) || docName;
        room = {
            name: docName,
            conns: new Set(),
            projectUuid: uuid,
        };
        rooms.set(docName, room);

        if (DEBUG) {
            console.log(`[RoomManager] Created room: ${docName} (project: ${uuid})`);
        }
    } else {
        // Cancel any pending cleanup since room is being accessed
        cancelCleanup(docName);
    }

    return room;
}

/**
 * Get existing room (doesn't create new)
 */
export function getRoom(docName: string): Room | undefined {
    return rooms.get(docName);
}

/**
 * Add connection to room
 */
export function addConnection(docName: string, ws: ServerWebSocket<WsData>, projectUuid?: string): Room {
    const room = getOrCreateRoom(docName, projectUuid);
    const wasEmpty = room.conns.size === 0;
    room.conns.add(ws);

    // Cancel any pending cleanup
    cancelCleanup(docName);

    // Subscribe to Redis channel when first client joins
    if (wasEmpty && deps.pubSub.isPubSubEnabled()) {
        deps.pubSub.subscribe(docName).catch(err => {
            console.error(`[RoomManager] Failed to subscribe to Redis channel ${docName}:`, err);
        });
    }

    if (DEBUG) {
        console.log(`[RoomManager] Added connection to ${docName} (${room.conns.size} total)`);
    }

    return room;
}

/**
 * Remove connection from room
 * Schedules cleanup if room becomes empty
 */
export function removeConnection(docName: string, ws: ServerWebSocket<WsData>): void {
    const room = rooms.get(docName);
    if (!room) return;

    room.conns.delete(ws);

    if (DEBUG) {
        console.log(`[RoomManager] Removed connection from ${docName} (${room.conns.size} remaining)`);
    }

    // Schedule cleanup if empty
    if (room.conns.size === 0) {
        scheduleCleanup(docName);
    }
}

/**
 * Schedule room cleanup after delay
 * Uses AbortController to allow cancellation if client reconnects
 */
export function scheduleCleanup(docName: string): void {
    const room = rooms.get(docName);
    if (!room) return;

    // Don't schedule if room has connections
    if (room.conns.size > 0) return;

    // Cancel any previous pending cleanup
    room.cleanupController?.abort();

    // Create new abort controller for this cleanup
    const controller = new AbortController();
    room.cleanupController = controller;

    const config = getConfig();
    const cleanupDelay = deps.cleanupDelayOverride ?? config.cleanupDelay;

    if (DEBUG) {
        console.log(`[RoomManager] Scheduled cleanup for ${docName} in ${cleanupDelay}ms`);
    }

    setTimeout(() => {
        // Check if cleanup was aborted (client reconnected)
        if (controller.signal.aborted) {
            if (DEBUG) {
                console.log(`[RoomManager] Cleanup cancelled for ${docName} (client reconnected)`);
            }
            return;
        }

        // Double-check room is still empty
        const currentRoom = rooms.get(docName);
        if (!currentRoom || currentRoom.conns.size > 0) {
            return;
        }

        // Perform cleanup
        rooms.delete(docName);

        if (DEBUG) {
            console.log(`[RoomManager] Cleaned up room ${docName}`);
        }

        // Unsubscribe from Redis channel
        if (deps.pubSub.isPubSubEnabled()) {
            deps.pubSub.unsubscribe(docName).catch(() => {
                // Ignore unsubscribe errors during cleanup
            });
        }

        // Clean up asset coordinator resources
        if (currentRoom.projectUuid) {
            deps.assetCoordinator.cleanupProject(currentRoom.projectUuid);
        }
    }, cleanupDelay);
}

/**
 * Cancel pending cleanup for a room
 * Called when a client reconnects before cleanup executes
 */
export function cancelCleanup(docName: string): void {
    const room = rooms.get(docName);
    if (room?.cleanupController) {
        room.cleanupController.abort();
        room.cleanupController = undefined;

        if (DEBUG) {
            console.log(`[RoomManager] Cancelled pending cleanup for ${docName}`);
        }
    }
}

/**
 * Relay message to all other clients in the room
 */
export function relayMessage(sender: ServerWebSocket<WsData>, docName: string, message: Buffer | string): void {
    const room = rooms.get(docName);
    if (!room) return;

    for (const conn of room.conns) {
        if (conn !== sender && conn.readyState === 1) {
            // 1 = OPEN
            try {
                conn.send(message);
            } catch (err) {
                if (DEBUG) {
                    console.error(`[RoomManager] Error relaying message:`, err);
                }
            }
        }
    }
}

/**
 * Broadcast message to ALL clients in a room (including sender)
 */
export function broadcastToRoom(docName: string, message: Buffer | string): void {
    const room = rooms.get(docName);
    if (!room) return;

    for (const conn of room.conns) {
        if (conn.readyState === 1) {
            // 1 = OPEN
            try {
                conn.send(message);
            } catch (err) {
                if (DEBUG) {
                    console.error(`[RoomManager] Error broadcasting:`, err);
                }
            }
        }
    }
}

/**
 * Get all active room names
 */
export function getActiveRooms(): string[] {
    return Array.from(rooms.keys());
}

/**
 * Get all connections for a specific user in a room
 * A user may have multiple connections (multiple tabs/devices)
 */
export function getConnectionsByUserId(docName: string, userId: number): ServerWebSocket<WsData>[] {
    const room = rooms.get(docName);
    if (!room) return [];

    const connections: ServerWebSocket<WsData>[] = [];
    for (const conn of room.conns) {
        if (conn.data?.userId === userId) {
            connections.push(conn);
        }
    }
    return connections;
}

/**
 * Get all unique userIds connected to a room
 */
export function getConnectedUserIds(docName: string): number[] {
    const room = rooms.get(docName);
    if (!room) return [];

    const userIds = new Set<number>();
    for (const conn of room.conns) {
        if (conn.data?.userId !== undefined) {
            userIds.add(conn.data.userId);
        }
    }
    return Array.from(userIds);
}

/**
 * Get room by project UUID (finds room named "project-<uuid>")
 */
export function getRoomByProjectUuid(projectUuid: string): Room | undefined {
    const docName = `project-${projectUuid}`;
    return rooms.get(docName);
}

/**
 * Get room statistics
 */
export function getRoomStats(): {
    totalRooms: number;
    totalConnections: number;
    rooms: Array<{ name: string; connections: number; projectUuid: string }>;
} {
    let totalConnections = 0;
    const roomList: Array<{ name: string; connections: number; projectUuid: string }> = [];

    for (const [name, room] of rooms) {
        totalConnections += room.conns.size;
        roomList.push({
            name,
            connections: room.conns.size,
            projectUuid: room.projectUuid,
        });
    }

    return {
        totalRooms: rooms.size,
        totalConnections,
        rooms: roomList,
    };
}

/**
 * Close all connections and clear all rooms (for graceful shutdown)
 */
export function closeAllRooms(): void {
    for (const room of rooms.values()) {
        // Cancel any pending cleanup
        room.cleanupController?.abort();

        // Close all connections
        for (const conn of room.conns) {
            try {
                conn.close(1001, 'Server shutting down');
            } catch {
                // Ignore close errors
            }
        }
    }

    rooms.clear();

    if (DEBUG) {
        console.log('[RoomManager] Closed all rooms');
    }
}

// ============================================================================
// CROSS-INSTANCE RELAY (REDIS PUB/SUB)
// ============================================================================

/**
 * Relay message to other instances via Redis
 * Called after local relay to sync with other server instances
 *
 * @param docName - Document/room name
 * @param message - Raw message (Buffer or string)
 * @param meta - Optional message metadata
 */
export async function relayToOtherInstances(
    docName: string,
    message: Buffer | string,
    meta?: { isAsset?: boolean; clientId?: string; projectUuid?: string },
): Promise<void> {
    if (!deps.pubSub.isPubSubEnabled()) {
        return; // Single-instance mode
    }

    await deps.pubSub.publish(docName, message, meta);
}

/**
 * Initialize handler for cross-instance messages from Redis
 * Must be called after Redis is connected
 */
export function initializeCrossInstanceHandler(): void {
    if (!deps.pubSub.isPubSubEnabled()) {
        return;
    }

    deps.pubSub.setMessageHandler((docName, message, meta) => {
        // Broadcast to all local clients (message came from another instance)
        broadcastToRoom(docName, message);

        if (DEBUG) {
            console.log(`[RoomManager] Received cross-instance message for ${docName} (isAsset: ${meta.isAsset})`);
        }
    });

    console.log('[RoomManager] Cross-instance handler initialized');
}
