/**
 * AccessNotifier
 * Broadcasts access revocation messages to affected WebSocket clients.
 *
 * Used when:
 * - Project visibility changes to private (kicks non-owner/non-collaborator users)
 * - A collaborator is removed from a project (kicks that specific user)
 */
import type { ServerWebSocket } from 'bun';
import * as roomManagerDefault from './room-manager';

const DEBUG = process.env.APP_DEBUG === '1';

/**
 * Asset message prefix byte (0xFF)
 * Distinguishes asset/control messages from Yjs sync messages
 */
const ASSET_MESSAGE_PREFIX = 0xff;

/**
 * WebSocket close code for access revoked
 */
const CLOSE_CODE_ACCESS_REVOKED = 4003;

/**
 * Reason types for access revocation
 */
export type AccessRevokedReason = 'visibility_changed' | 'collaborator_removed';

/**
 * Access revoked message structure
 */
export interface AccessRevokedMessage {
    type: 'access-revoked';
    projectId: string;
    data: {
        reason: AccessRevokedReason;
        revokedAt: string;
    };
}

/**
 * Room manager dependency interface
 */
export interface AccessNotifierRoomManager {
    getRoomByProjectUuid: typeof roomManagerDefault.getRoomByProjectUuid;
    getConnectionsByUserId: typeof roomManagerDefault.getConnectionsByUserId;
    getConnectedUserIds: typeof roomManagerDefault.getConnectedUserIds;
}

/**
 * Dependencies for AccessNotifier
 */
export interface AccessNotifierDependencies {
    roomManager: AccessNotifierRoomManager;
}

// Default dependencies
const defaultDependencies: AccessNotifierDependencies = {
    roomManager: {
        getRoomByProjectUuid: roomManagerDefault.getRoomByProjectUuid,
        getConnectionsByUserId: roomManagerDefault.getConnectionsByUserId,
        getConnectedUserIds: roomManagerDefault.getConnectedUserIds,
    },
};

// Module-level dependencies (set via configure function)
let deps: AccessNotifierDependencies = defaultDependencies;

/**
 * Configure dependencies for this module (for testing)
 */
export function configure(newDeps: Partial<AccessNotifierDependencies>): void {
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

/**
 * Encode access-revoked message as binary with 0xFF prefix
 */
function encodeMessage(message: AccessRevokedMessage): Uint8Array {
    const jsonStr = JSON.stringify(message);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const result = new Uint8Array(1 + jsonBytes.length);
    result[0] = ASSET_MESSAGE_PREFIX;
    result.set(jsonBytes, 1);
    return result;
}

/**
 * Create an access-revoked message
 */
function createAccessRevokedMessage(projectUuid: string, reason: AccessRevokedReason): AccessRevokedMessage {
    return {
        type: 'access-revoked',
        projectId: projectUuid,
        data: {
            reason,
            revokedAt: new Date().toISOString(),
        },
    };
}

/**
 * Send access-revoked message to a WebSocket connection and close it
 */
function sendAndClose(ws: ServerWebSocket<unknown>, message: Uint8Array, reason: string): void {
    try {
        // Send the message first
        ws.send(message);

        // Close with access revoked code after a brief delay to ensure message delivery
        setTimeout(() => {
            try {
                ws.close(CLOSE_CODE_ACCESS_REVOKED, reason);
            } catch {
                // Connection may already be closed
            }
        }, 100);
    } catch (err) {
        if (DEBUG) {
            console.error('[AccessNotifier] Error sending message:', err);
        }
        // Try to close anyway
        try {
            ws.close(CLOSE_CODE_ACCESS_REVOKED, reason);
        } catch {
            // Ignore close errors
        }
    }
}

/**
 * Notify users when project visibility changes to private
 * Kicks out users who are not owner or collaborators
 *
 * @param projectUuid - The project UUID
 * @param ownerId - The owner's user ID (will NOT be kicked)
 * @param collaboratorIds - Array of collaborator user IDs (will NOT be kicked)
 * @returns Number of users kicked
 */
export function notifyVisibilityChanged(projectUuid: string, ownerId: number, collaboratorIds: number[]): number {
    const docName = `project-${projectUuid}`;

    // Get all connected user IDs
    const connectedUserIds = deps.roomManager.getConnectedUserIds(docName);

    if (connectedUserIds.length === 0) {
        if (DEBUG) {
            console.log(`[AccessNotifier] No users connected to project ${projectUuid}`);
        }
        return 0;
    }

    // Build set of authorized users (owner + collaborators)
    const authorizedUsers = new Set<number>([ownerId, ...collaboratorIds]);

    // Find users to kick (connected but not authorized)
    const usersToKick = connectedUserIds.filter(userId => !authorizedUsers.has(userId));

    if (usersToKick.length === 0) {
        if (DEBUG) {
            console.log(`[AccessNotifier] All connected users are authorized for project ${projectUuid}`);
        }
        return 0;
    }

    // Create and encode message
    const message = createAccessRevokedMessage(projectUuid, 'visibility_changed');
    const encodedMessage = encodeMessage(message);

    // Kick each unauthorized user
    let kickedCount = 0;
    for (const userId of usersToKick) {
        const connections = deps.roomManager.getConnectionsByUserId(docName, userId);
        for (const ws of connections) {
            sendAndClose(ws, encodedMessage, 'Project visibility changed to private');
            kickedCount++;
        }

        if (DEBUG) {
            console.log(
                `[AccessNotifier] Kicked user ${userId} from project ${projectUuid} (${connections.length} connections)`,
            );
        }
    }

    if (DEBUG) {
        console.log(
            `[AccessNotifier] Visibility change: kicked ${usersToKick.length} users (${kickedCount} connections) from project ${projectUuid}`,
        );
    }

    return usersToKick.length;
}

/**
 * Notify a specific user when they are removed as collaborator
 *
 * @param projectUuid - The project UUID
 * @param removedUserId - The user ID being removed
 * @returns Number of connections closed
 */
export function notifyCollaboratorRemoved(projectUuid: string, removedUserId: number): number {
    const docName = `project-${projectUuid}`;

    // Get connections for this specific user
    const connections = deps.roomManager.getConnectionsByUserId(docName, removedUserId);

    if (connections.length === 0) {
        if (DEBUG) {
            console.log(`[AccessNotifier] User ${removedUserId} not connected to project ${projectUuid}`);
        }
        return 0;
    }

    // Create and encode message
    const message = createAccessRevokedMessage(projectUuid, 'collaborator_removed');
    const encodedMessage = encodeMessage(message);

    // Close all connections for this user
    for (const ws of connections) {
        sendAndClose(ws, encodedMessage, 'Collaborator access removed');
    }

    if (DEBUG) {
        console.log(
            `[AccessNotifier] Collaborator removed: kicked user ${removedUserId} from project ${projectUuid} (${connections.length} connections)`,
        );
    }

    return connections.length;
}
