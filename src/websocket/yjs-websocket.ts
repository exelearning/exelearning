/**
 * Yjs WebSocket Service for Elysia/Bun
 * Stateless Relay Architecture with Authentication
 *
 * Uses Bun's native WebSocket support for same-port WebSocket handling
 *
 * Key characteristics:
 * - No server-side Y.Doc (zero memory per document)
 * - No server-side persistence (client saves via REST API)
 * - Just forwards messages between connected clients
 * - Client is the source of truth (IndexedDB + in-memory Y.Doc)
 *
 * Security:
 * - JWT token required in query string (?token=...)
 * - Project access validated before allowing connection
 * - User ID tracked per connection for audit/coordination
 *
 * Protocol:
 * - Binary messages: Yjs sync/awareness (relayed to room)
 * - JSON messages: Asset coordination protocol (handled separately)
 *
 * Clients connect using y-websocket's WebsocketProvider:
 * ws://localhost:3002/yjs/project-<uuid>?token=<jwt>
 */
import type { ServerWebSocket } from 'bun';
import type { WebSocket as WsWebSocket } from 'ws';
import { Elysia } from 'elysia';
import { ClientMeta, WebSocketServerInfo } from './types';
import * as assetCoordinatorDefault from './asset-coordinator';
import { verifyToken as verifyTokenDefault } from '../routes/auth';
import {
    findProjectByUuid as findProjectByUuidDefault,
    checkProjectAccess as checkProjectAccessDefault,
    markProjectAsSaved as markProjectAsSavedDefault,
} from '../db/queries';
import { db as defaultDb } from '../db/client';
import { getSession as getSessionDefault } from '../services/session-manager';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

// Import new modules
import { DEBUG } from './config';
import { startHeartbeat, stopHeartbeat, onPong, stopAllHeartbeats, getHeartbeatStats } from './heartbeat';
import * as roomManager from './room-manager';
import { parseMessage } from './message-parser';

// ============================================================================
// DEPENDENCY INJECTION INTERFACES
// ============================================================================

/**
 * Query dependencies for WebSocket service
 */
export interface YjsWebSocketQueries {
    findProjectByUuid: typeof findProjectByUuidDefault;
    checkProjectAccess: typeof checkProjectAccessDefault;
    markProjectAsSaved: typeof markProjectAsSavedDefault;
}

/**
 * Session manager dependencies
 */
export interface YjsWebSocketSessionManager {
    getSession: typeof getSessionDefault;
}

/**
 * Auth dependencies
 */
export interface YjsWebSocketAuth {
    verifyToken: typeof verifyTokenDefault;
}

/**
 * Asset coordinator dependencies
 */
export interface YjsWebSocketAssetCoordinator {
    registerClient: typeof assetCoordinatorDefault.registerClient;
    unregisterClient: typeof assetCoordinatorDefault.unregisterClient;
    handleMessage: typeof assetCoordinatorDefault.handleMessage;
    onCollaborationDetected: typeof assetCoordinatorDefault.onCollaborationDetected;
    cleanupProject: typeof assetCoordinatorDefault.cleanupProject;
}

/**
 * Full dependencies for WebSocket service
 */
export interface YjsWebSocketDependencies {
    db: Kysely<Database>;
    queries: YjsWebSocketQueries;
    sessionManager: YjsWebSocketSessionManager;
    auth: YjsWebSocketAuth;
    assetCoordinator: YjsWebSocketAssetCoordinator;
}

// Default dependencies
const defaultDependencies: YjsWebSocketDependencies = {
    db: defaultDb,
    queries: {
        findProjectByUuid: findProjectByUuidDefault,
        checkProjectAccess: checkProjectAccessDefault,
        markProjectAsSaved: markProjectAsSavedDefault,
    },
    sessionManager: {
        getSession: getSessionDefault,
    },
    auth: {
        verifyToken: verifyTokenDefault,
    },
    assetCoordinator: {
        registerClient: assetCoordinatorDefault.registerClient,
        unregisterClient: assetCoordinatorDefault.unregisterClient,
        handleMessage: assetCoordinatorDefault.handleMessage,
        onCollaborationDetected: assetCoordinatorDefault.onCollaborationDetected,
        cleanupProject: assetCoordinatorDefault.cleanupProject,
    },
};

// Module-level dependencies (set via configure function)
let deps: YjsWebSocketDependencies = defaultDependencies;

/**
 * Configure dependencies for this module
 */
export function configure(newDeps: Partial<YjsWebSocketDependencies>): void {
    deps = {
        ...defaultDependencies,
        ...newDeps,
        queries: {
            ...defaultDependencies.queries,
            ...(newDeps.queries || {}),
        },
        sessionManager: {
            ...defaultDependencies.sessionManager,
            ...(newDeps.sessionManager || {}),
        },
        auth: {
            ...defaultDependencies.auth,
            ...(newDeps.auth || {}),
        },
        assetCoordinator: {
            ...defaultDependencies.assetCoordinator,
            ...(newDeps.assetCoordinator || {}),
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
 * Client metadata store - tracks user info per connection
 * Uses connection id as key since ServerWebSocket doesn't work well with WeakMap
 */
const clientMetaMap = new Map<string, ClientMeta>();

let initialized = false;

/**
 * Generate unique client ID
 * Exported for testing
 */
export function generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * WebSocket data stored per connection
 */
export interface WsData {
    clientId: string;
    userId: number;
    projectUuid: string;
    docName: string;
}

/**
 * Elysia WebSocket raw data structure (before we populate WsData)
 */
interface ElysiaWsRawData {
    params?: { docName?: string };
    query?: { token?: string };
}

/**
 * Check if user has access to project via WebSocket
 * Uses the centralized checkProjectAccess from db/queries
 * but first checks for in-memory sessions (unsaved projects)
 * Exported for testing
 */
export async function checkWebSocketProjectAccess(
    projectUuid: string,
    userId: number,
): Promise<{ hasAccess: boolean; reason?: string }> {
    // First, check if it's an in-memory session
    // In-memory sessions are created for new projects before they're saved to DB
    const session = deps.sessionManager.getSession(projectUuid);
    if (session) {
        // Session exists in memory - allow access
        if (DEBUG) console.log(`[YjsWebSocket] Access granted via in-memory session: ${projectUuid}`);
        return { hasAccess: true };
    }

    // Fall back to database check for persisted projects using centralized function
    const project = await deps.queries.findProjectByUuid(deps.db, projectUuid);

    if (!project) {
        // Neither in session nor in database - deny access
        if (DEBUG)
            console.log(`[YjsWebSocket] Project ${projectUuid} not found in session or database, denying access`);
        return { hasAccess: false, reason: 'Project not found' };
    }

    // Use centralized access check
    return deps.queries.checkProjectAccess(deps.db, project, userId);
}

/**
 * Handle WebSocket connection open
 * Extracted for testability
 */
export async function handleWebSocketOpen(
    ws: ServerWebSocket<WsData>,
    docName: string,
    token: string | undefined,
): Promise<{ success: boolean; error?: { code: number; reason: string } }> {
    // Extract project UUID from document name
    const projectUuid = roomManager.extractProjectUuid(docName);
    if (!projectUuid) {
        console.error(`[YjsWebSocket] Invalid document name format: ${docName}`);
        return {
            success: false,
            error: { code: 4000, reason: 'Invalid document name format. Expected: project-<uuid>' },
        };
    }

    // Validate JWT token
    if (!token) {
        console.error('[YjsWebSocket] Token required');
        return { success: false, error: { code: 4001, reason: 'Token required' } };
    }

    const user = await deps.auth.verifyToken(token);
    if (!user) {
        console.error('[YjsWebSocket] Invalid token');
        return { success: false, error: { code: 4001, reason: 'Invalid token' } };
    }

    // Check project access
    const access = await checkWebSocketProjectAccess(projectUuid, user.sub);
    if (!access.hasAccess) {
        console.error(`[YjsWebSocket] Access denied: ${access.reason}`);
        return { success: false, error: { code: 4003, reason: access.reason || 'Access denied' } };
    }

    const userId = user.sub;
    const clientId = generateClientId();

    // Store metadata
    const meta: ClientMeta = {
        userId,
        projectUuid,
        clientId,
        connectedAt: new Date(),
    };
    clientMetaMap.set(clientId, meta);

    // Update ws data
    (ws.data as WsData).clientId = clientId;
    (ws.data as WsData).userId = userId;
    (ws.data as WsData).projectUuid = projectUuid;
    (ws.data as WsData).docName = docName;

    // Add connection to room (uses room-manager)
    const room = roomManager.addConnection(docName, ws, projectUuid);

    // Start heartbeat for this connection
    startHeartbeat(clientId, ws);

    // Register with asset coordinator
    deps.assetCoordinator.registerClient(projectUuid, clientId, ws as unknown as WsWebSocket);

    const clientCount = room.conns.size;
    console.log(`[YjsWebSocket] Client ${clientId} (user ${userId}) connected to ${docName} (${clientCount} total)`);

    // Detect collaboration and trigger asset prefetch
    if (clientCount > 1) {
        console.log(`[YjsWebSocket] Collaboration detected in ${projectUuid}`);

        // Auto-save unsaved projects when collaboration starts
        // This ensures documents aren't lost when multiple users work together
        (async () => {
            try {
                const project = await deps.queries.findProjectByUuid(deps.db, projectUuid);
                if (project && !project.saved_once) {
                    console.log(
                        `[YjsWebSocket] Project ${projectUuid} not saved yet, requesting sync from first client`,
                    );

                    // Find the first (oldest) client in the room to request state
                    const firstClient = Array.from(room.conns)[0];
                    if (firstClient) {
                        // Send JSON message to request sync-state
                        const syncRequestMsg = JSON.stringify({
                            type: 'request-sync-state',
                            reason: 'collaboration-started',
                            projectUuid,
                        });
                        firstClient.send(syncRequestMsg);
                        console.log(`[YjsWebSocket] Sent request-sync-state to first client for ${projectUuid}`);
                    }
                }
            } catch (err) {
                console.error('[YjsWebSocket] Error checking project save status:', err);
            }
        })();

        // Ask existing clients to re-broadcast awareness when a new client joins.
        // This keeps presence UI in sync without forcing reconnects.
        for (const existingConn of room.conns) {
            if (existingConn.readyState === 1) {
                try {
                    existingConn.send(
                        JSON.stringify({
                            type: 'trigger-resync',
                            reason: 'new-client-joined',
                            projectUuid,
                        }),
                    );
                } catch {
                    /* ignore individual send errors */
                }
            }
        }

        deps.assetCoordinator.onCollaborationDetected(projectUuid).catch(err => {
            console.error('[YjsWebSocket] Error in collaboration detection:', err);
        });
    }

    return { success: true };
}

/**
 * Handle WebSocket pong response
 * Extracted for testability
 */
export function handleWebSocketPong(data: WsData | undefined): void {
    if (data?.clientId) {
        onPong(data.clientId);
    }
}

/**
 * Handle WebSocket message
 * Extracted for testability
 */
export function handleWebSocketMessage(ws: ServerWebSocket<WsData>, data: WsData, message: Buffer | string): void {
    const room = roomManager.getRoom(data.docName);
    if (!room) return;

    // Use robust message parser
    const parsed = parseMessage(message);

    switch (parsed.kind) {
        case 'asset':
            // Handle asset coordination message
            deps.assetCoordinator.handleMessage(data.projectUuid, data.clientId, parsed.message).catch(err => {
                console.error('[YjsWebSocket] Error handling asset message:', err);
            });

            // Relay asset message to other instances via Redis
            roomManager
                .relayToOtherInstances(data.docName, message, {
                    isAsset: true,
                    clientId: data.clientId,
                    projectUuid: data.projectUuid,
                })
                .catch(() => {
                    // Ignore relay errors (Redis may be down)
                });
            break;

        case 'yjs': {
            // Relay Yjs message to other clients in the room
            const yjsBuffer = Buffer.from(parsed.data);
            roomManager.relayMessage(ws, data.docName, yjsBuffer);

            // Relay to other instances via Redis
            roomManager
                .relayToOtherInstances(data.docName, yjsBuffer, {
                    isAsset: false,
                })
                .catch(() => {
                    // Ignore relay errors (Redis may be down)
                });
            break;
        }

        case 'unknown':
            // Unknown message type - log and ignore
            if (DEBUG) {
                console.log(`[YjsWebSocket] Unknown message type from ${data.clientId}`);
            }
            break;
    }
}

/**
 * Handle WebSocket connection close
 * Extracted for testability
 */
export function handleWebSocketClose(ws: ServerWebSocket<WsData>, data: WsData | undefined): void {
    // Use safe values for logging (data may be undefined if connection was rejected early)
    const clientId = data?.clientId || 'unknown';
    const docName = data?.docName || 'unknown';
    const projectUuid = data?.projectUuid;

    // Stop heartbeat for this connection
    if (data?.clientId) {
        stopHeartbeat(data.clientId);
    }

    // Remove connection from room (uses room-manager with safe cleanup)
    if (docName !== 'unknown') {
        roomManager.removeConnection(docName, ws);
    }

    if (DEBUG) {
        const room = docName !== 'unknown' ? roomManager.getRoom(docName) : null;
        console.log(
            `[YjsWebSocket] Client ${clientId} disconnected from ${docName} ` + `(${room?.conns.size ?? 0} remaining)`,
        );
    }

    // Unregister from asset coordinator
    if (data?.clientId && projectUuid) {
        deps.assetCoordinator.unregisterClient(projectUuid, data.clientId);
        clientMetaMap.delete(data.clientId);
    }
}

/**
 * Create Elysia WebSocket routes for Yjs
 */
export function createWebSocketRoutes() {
    return new Elysia({ name: 'yjs-websocket' }).ws('/yjs/:docName', {
        // Connection opened - validate token here since beforeHandle doesn't pass data to open
        async open(ws) {
            const rawData = ws.data as ElysiaWsRawData;
            const docName = rawData.params?.docName;
            const token = rawData.query?.token as string;

            const result = await handleWebSocketOpen(ws as ServerWebSocket<WsData>, docName, token);
            if (!result.success && result.error) {
                ws.close(result.error.code, result.error.reason);
            }
        },

        // Handle pong response (Bun WebSocket native support)
        pong(ws) {
            handleWebSocketPong(ws.data as WsData);
        },

        // Message received
        message(ws, message) {
            handleWebSocketMessage(ws as ServerWebSocket<WsData>, ws.data as WsData, message as Buffer | string);
        },

        // Connection closed
        close(ws) {
            handleWebSocketClose(ws as ServerWebSocket<WsData>, ws.data as WsData | undefined);
        },
    });
}

/**
 * Initialize the WebSocket server (called for compatibility)
 */
export function initialize(_httpServer?: unknown): void {
    if (initialized) {
        console.warn('[YjsWebSocket] Already initialized');
        return;
    }

    initialized = true;
    const port = parseInt(process.env.ELYSIA_PORT || process.env.PORT || '3002', 10);
    console.log(`[YjsWebSocket] WebSocket routes ready on port ${port}`);
    console.log(`[YjsWebSocket] Connect to: ws://localhost:${port}/yjs/project-<uuid>?token=<jwt>`);
    console.log('[YjsWebSocket] Mode: stateless-relay with heartbeat');
}

/**
 * Stop the WebSocket server
 */
export function stop(): void {
    console.log('[YjsWebSocket] Stopping server...');

    // Stop all heartbeats
    stopAllHeartbeats();

    // Close all rooms and connections
    roomManager.closeAllRooms();

    // Clear client metadata
    clientMetaMap.clear();
    initialized = false;

    console.log('[YjsWebSocket] Server stopped');
}

/**
 * Get server info for debugging/monitoring
 */
export function getServerInfo(): WebSocketServerInfo {
    const roomStats = roomManager.getRoomStats();
    const _heartbeatStats = getHeartbeatStats();

    const port = parseInt(process.env.ELYSIA_PORT || process.env.PORT || '3002', 10);
    return {
        port,
        isRunning: initialized,
        roomsCount: roomStats.totalRooms,
        totalConnections: roomStats.totalConnections,
        mode: 'stateless-relay',
    };
}

/**
 * Get room names currently active
 */
export function getActiveRooms(): string[] {
    return roomManager.getActiveRooms();
}

/**
 * Broadcast message to a specific room
 */
export function broadcastToRoom(docName: string, message: Buffer | string): void {
    roomManager.broadcastToRoom(docName, message);
}

/**
 * Get details of all connected WebSocket clients.
 * Used by admin dashboard to show online users.
 */
export function getConnectedClientsDetail(): Array<{
    userId: number;
    projectUuid: string;
    connectedAt: number;
}> {
    const clients: Array<{ userId: number; projectUuid: string; connectedAt: number }> = [];
    for (const meta of clientMetaMap.values()) {
        clients.push({
            userId: meta.userId,
            projectUuid: meta.projectUuid,
            connectedAt: meta.connectedAt instanceof Date ? meta.connectedAt.getTime() : Number(meta.connectedAt),
        });
    }
    return clients;
}

/**
 * Get detailed stats for monitoring
 */
export function getDetailedStats(): {
    rooms: ReturnType<typeof roomManager.getRoomStats>;
    heartbeats: ReturnType<typeof getHeartbeatStats>;
    clients: number;
} {
    return {
        rooms: roomManager.getRoomStats(),
        heartbeats: getHeartbeatStats(),
        clients: clientMetaMap.size,
    };
}
