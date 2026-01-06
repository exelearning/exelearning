/**
 * Asset Coordinator Service for Elysia
 * Manages intelligent asset prefetching and peer-to-peer coordination
 * for collaborative document editing.
 *
 * Uses dependency injection pattern for testability:
 * - createAssetCoordinator() factory creates isolated instances
 * - Default export provides singleton for production use
 *
 * Key responsibilities:
 * 1. Track which clients have which assets (Awareness)
 * 2. Detect when clients need assets
 * 3. Coordinate upload requests to peers
 * 4. Trigger background prefetch
 * 5. Handle asset request routing
 */
import { WebSocket as WsWebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { Kysely } from 'kysely';
import {
    AssetMessage,
    AssetMessageType,
    AwarenessUpdateData,
    AssetRequestData,
    AssetUploadedData,
    PrefetchProgressData,
    BulkUploadProgressData,
    PendingRequest,
    AssetCoordinatorStats,
    PriorityUpdateData,
    NavigationHintData,
} from './types';
import type { Database, Project, Asset } from '../db/types';
import {
    findProjectByUuid as defaultFindProjectByUuid,
    findAssetByClientId as defaultFindAssetByClientId,
} from '../db/queries';
import { db } from '../db/client';
import {
    serverPriorityQueue as defaultPriorityQueue,
    PRIORITY,
    type PriorityQueueRequest,
    type ActiveSlot,
    type PreemptResult,
    type QueueStats,
} from '../services/asset-priority-queue';

const DEBUG = process.env.APP_DEBUG === '1';

/**
 * Asset message prefix byte (0xFF)
 * This distinguishes asset messages from Yjs messages (which use 0, 1, 2)
 */
const ASSET_MESSAGE_PREFIX = 0xff;

/**
 * Asset message types that this coordinator handles
 */
const ASSET_MESSAGE_TYPES: AssetMessageType[] = [
    'awareness-update',
    'request-asset',
    'asset-uploaded',
    'prefetch-progress',
    'bulk-upload-progress',
    'priority-update',
    'navigation-hint',
];

/**
 * Dependencies for AssetCoordinator
 */
export interface AssetCoordinatorDeps {
    findProjectByUuid?: (db: Kysely<Database>, uuid: string) => Promise<Project | undefined>;
    findAssetByClientId?: (db: Kysely<Database>, clientId: string, projectId: number) => Promise<Asset | undefined>;
    priorityQueue?: {
        registerRequest: (request: PriorityQueueRequest) => void;
        registerActiveSlot: (slot: ActiveSlot) => void;
        releaseSlot: (projectId: string, assetId: string) => void;
        clearProject: (projectId: string) => void;
        shouldPreempt: (projectId: string) => PreemptResult;
        getStats: (projectId: string) => QueueStats;
        peekNextUpload: (projectId: string) => PriorityQueueRequest | null;
    };
    generateId?: () => string;
}

/**
 * AssetCoordinator interface
 */
export interface AssetCoordinator {
    isAssetMessage: (type: string) => boolean;
    registerClient: (projectUuid: string, clientId: string, socket: WsWebSocket) => void;
    unregisterClient: (projectUuid: string, clientId: string) => void;
    cleanupProject: (projectUuid: string) => void;
    handleMessage: (projectUuid: string, clientId: string, message: AssetMessage) => Promise<void>;
    onCollaborationDetected: (projectUuid: string) => Promise<void>;
    getStats: () => AssetCoordinatorStats;
}

/**
 * Factory function to create an asset coordinator instance
 * Each instance has its own isolated state (Maps)
 */
export function createAssetCoordinator(deps: AssetCoordinatorDeps = {}): AssetCoordinator {
    const {
        findProjectByUuid = defaultFindProjectByUuid,
        findAssetByClientId = defaultFindAssetByClientId,
        priorityQueue = defaultPriorityQueue,
        generateId = randomUUID,
    } = deps;

    // Internal state - isolated per instance
    const assetAvailability = new Map<string, Map<string, Set<string>>>();
    const clientSockets = new Map<string, Map<string, WsWebSocket>>();
    const pendingRequests = new Map<string, PendingRequest[]>();

    /**
     * Check if a message is an asset-related message
     */
    function isAssetMessage(type: string): boolean {
        return ASSET_MESSAGE_TYPES.includes(type as AssetMessageType);
    }

    /**
     * Encode asset message as binary with prefix byte
     * Returns Buffer for proper binary handling in Bun WebSocket
     */
    function encodeAssetMessage(message: AssetMessage): Buffer {
        const jsonStr = JSON.stringify(message);
        const jsonBytes = Buffer.from(jsonStr, 'utf-8');
        const result = Buffer.alloc(1 + jsonBytes.length);
        result[0] = ASSET_MESSAGE_PREFIX;
        jsonBytes.copy(result, 1);
        return result;
    }

    /**
     * Get WebSocket for specific client
     */
    function getClientSocket(projectUuid: string, clientId: string): WsWebSocket | null {
        return clientSockets.get(projectUuid)?.get(clientId) || null;
    }

    /**
     * Send message to specific client
     */
    function sendToClient(projectUuid: string, clientId: string, message: AssetMessage): void {
        const socket = getClientSocket(projectUuid, clientId);
        if (!socket) {
            console.warn(`[AssetCoordinator] Cannot send to ${clientId}: socket not found`);
            return;
        }

        try {
            const binaryMessage = encodeAssetMessage(message);
            socket.send(binaryMessage);
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : String(err);
            console.error(`[AssetCoordinator] Failed to send to ${clientId}:`, errMessage);
        }
    }

    /**
     * Broadcast message to all clients in project
     */
    function broadcastToProject(projectUuid: string, message: AssetMessage): void {
        const projectSocketsMap = clientSockets.get(projectUuid);
        if (!projectSocketsMap) return;

        const binaryMessage = encodeAssetMessage(message);
        projectSocketsMap.forEach((socket, cId) => {
            try {
                socket.send(binaryMessage);
            } catch (err: unknown) {
                const errMessage = err instanceof Error ? err.message : String(err);
                console.error(`[AssetCoordinator] Failed to broadcast to ${cId}:`, errMessage);
            }
        });
    }

    /**
     * Broadcast message to all clients in project except one (the sender)
     */
    function broadcastToProjectExcept(projectUuid: string, excludeClientId: string, message: AssetMessage): void {
        const projectSocketsMap = clientSockets.get(projectUuid);
        if (!projectSocketsMap) return;

        const binaryMessage = encodeAssetMessage(message);
        projectSocketsMap.forEach((socket, cId) => {
            if (cId !== excludeClientId) {
                try {
                    socket.send(binaryMessage);
                } catch (err: unknown) {
                    const errMessage = err instanceof Error ? err.message : String(err);
                    console.error(`[AssetCoordinator] Failed to broadcast to ${cId}:`, errMessage);
                }
            }
        });
    }

    /**
     * Send asset not found message
     */
    function sendAssetNotFound(projectUuid: string, clientId: string, assetId: string, error: string): void {
        sendToClient(projectUuid, clientId, {
            type: 'asset-not-found',
            projectId: projectUuid,
            data: {
                assetId,
                error,
                suggestions: [
                    'Ask collaborator to click Save button',
                    'Wait for auto-save to complete',
                    'Continue editing (asset will load when available)',
                ],
            },
        });
    }

    /**
     * Request a peer to upload an asset
     */
    async function requestUploadFromPeer(projectUuid: string, assetId: string, requestedBy: string): Promise<void> {
        const projectAssets = assetAvailability.get(projectUuid);
        const peersWithAsset = projectAssets?.get(assetId);

        if (!peersWithAsset || peersWithAsset.size === 0) {
            console.error(`[AssetCoordinator] No peer has asset ${assetId}`);
            return;
        }

        // Pick first available peer (excluding requester)
        let peerClientId: string | null = null;
        for (const peer of peersWithAsset) {
            if (peer !== requestedBy) {
                peerClientId = peer;
                break;
            }
        }

        if (!peerClientId) {
            console.warn(`[AssetCoordinator] Only requester ${requestedBy} has asset ${assetId}`);
            return;
        }

        if (DEBUG) {
            console.log(`[AssetCoordinator] Requesting ${peerClientId} to upload asset ${assetId}`);
        }

        const requestId = generateId();

        sendToClient(projectUuid, peerClientId, {
            type: 'upload-request',
            projectId: projectUuid,
            data: {
                assetId,
                requestId,
                requestedBy,
                urgency: 'normal',
                uploadUrl: `/projects/${projectUuid}/assets?clientId=${assetId}`,
            },
        });
    }

    /**
     * Check if newly available assets can fulfill pending requests
     */
    async function checkPendingRequests(projectUuid: string, newlyAvailableAssets: string[]): Promise<void> {
        for (const assetId of newlyAvailableAssets) {
            const key = `${projectUuid}:${assetId}`;
            const pending = pendingRequests.get(key);
            if (!pending || pending.length === 0) continue;

            if (DEBUG) {
                console.log(`[AssetCoordinator] Asset ${assetId} available, fulfilling ${pending.length} requests`);
            }

            // Get highest priority request
            const highestPriority = pending.reduce((prev, curr) => (curr.priority === 'high' ? curr : prev));

            await requestUploadFromPeer(projectUuid, assetId, highestPriority.clientId);

            // Clear pending for this asset
            pendingRequests.delete(key);
        }
    }

    /**
     * Request a peer to upload an asset with priority consideration
     */
    async function requestUploadFromPeerWithPriority(
        projectUuid: string,
        assetId: string,
        requestedBy: string,
        priority: number,
    ): Promise<void> {
        const projectAssets = assetAvailability.get(projectUuid);
        const peersWithAsset = projectAssets?.get(assetId);

        if (!peersWithAsset || peersWithAsset.size === 0) {
            if (DEBUG) {
                console.log(
                    `[AssetCoordinator] No peer has asset ${assetId.substring(0, 8)}... (priority=${priority})`,
                );
            }

            // Add to pending requests
            const key = `${projectUuid}:${assetId}`;
            if (!pendingRequests.has(key)) {
                pendingRequests.set(key, []);
            }
            pendingRequests.get(key)!.push({
                clientId: requestedBy,
                timestamp: Date.now(),
                priority: priority >= PRIORITY.HIGH ? 'high' : 'low',
            });
            return;
        }

        // Pick first available peer (excluding requester)
        let peerClientId: string | null = null;
        for (const peer of peersWithAsset) {
            if (peer !== requestedBy) {
                peerClientId = peer;
                break;
            }
        }

        if (!peerClientId) {
            if (DEBUG) {
                console.warn(`[AssetCoordinator] Only requester has asset ${assetId.substring(0, 8)}...`);
            }
            return;
        }

        if (DEBUG) {
            console.log(
                `[AssetCoordinator] Requesting ${peerClientId.substring(0, 8)}... to upload ` +
                    `asset ${assetId.substring(0, 8)}... with priority=${priority}`,
            );
        }

        const requestId = generateId();

        // Register active slot in priority queue
        priorityQueue.registerActiveSlot({
            assetId,
            clientId: peerClientId,
            startTime: Date.now(),
            priority,
            projectId: projectUuid,
        });

        // Determine urgency based on priority
        const urgency = priority >= PRIORITY.CRITICAL ? 'critical' : priority >= PRIORITY.HIGH ? 'high' : 'normal';

        sendToClient(projectUuid, peerClientId, {
            type: 'upload-request',
            projectId: projectUuid,
            data: {
                assetId,
                requestId,
                requestedBy,
                urgency,
                priority,
                uploadUrl: `/projects/${projectUuid}/assets?clientId=${assetId}`,
            },
        });
    }

    // ==========================================
    // Message Handlers
    // ==========================================

    /**
     * Handle awareness update from client
     */
    async function handleAwarenessUpdate(
        projectUuid: string,
        clientId: string,
        data: AwarenessUpdateData | undefined,
    ): Promise<void> {
        if (!data || !Array.isArray(data.availableAssets)) {
            console.warn(`[AssetCoordinator] Invalid awareness update from ${clientId}`);
            return;
        }

        const { availableAssets, totalAssets = availableAssets.length } = data;

        if (DEBUG) {
            console.log(
                `[AssetCoordinator] Client ${clientId} has ${availableAssets.length}/${totalAssets} assets for project ${projectUuid}`,
            );
        }

        // Initialize project tracking if needed
        if (!assetAvailability.has(projectUuid)) {
            assetAvailability.set(projectUuid, new Map());
        }

        const projectAssets = assetAvailability.get(projectUuid)!;

        // Update availability map
        availableAssets.forEach(assetId => {
            if (!projectAssets.has(assetId)) {
                projectAssets.set(assetId, new Set());
            }
            projectAssets.get(assetId)!.add(clientId);
        });

        // Check if any pending requests can now be fulfilled
        await checkPendingRequests(projectUuid, availableAssets);
    }

    /**
     * Handle asset request from client
     */
    async function handleAssetRequest(
        projectUuid: string,
        clientId: string,
        data: AssetRequestData | undefined,
    ): Promise<void> {
        if (!data || !data.assetId) {
            console.warn(`[AssetCoordinator] Invalid asset request from ${clientId}`);
            return;
        }

        const { assetId, priority = 'low', reason = 'render' } = data;

        if (DEBUG) {
            console.log(`[AssetCoordinator] Client ${clientId} requested asset ${assetId} (${priority}, ${reason})`);
        }

        // 1. Check if asset exists in database
        try {
            const project = await findProjectByUuid(db, projectUuid);
            if (!project) {
                sendAssetNotFound(projectUuid, clientId, assetId, 'Project not found');
                return;
            }

            const asset = await findAssetByClientId(db, assetId, project.id);

            if (asset) {
                // Asset exists in DB, send URL immediately
                if (DEBUG) {
                    console.log(`[AssetCoordinator] Asset ${assetId} found in database`);
                }

                sendToClient(projectUuid, clientId, {
                    type: 'asset-ready',
                    projectId: projectUuid,
                    data: {
                        assetId,
                        url: `/projects/${projectUuid}/assets/by-client-id/${assetId}`,
                        fromCache: true,
                        size: parseInt(asset.file_size || '0', 10),
                        mimeType: asset.mime_type,
                        filename: asset.filename,
                    },
                });
                return;
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[AssetCoordinator] Error checking database for asset ${assetId}:`, errorMessage);
        }

        // 2. Check if any peer has it
        const projectAssets = assetAvailability.get(projectUuid);
        const peersWithAsset = projectAssets?.get(assetId);

        if (!peersWithAsset || peersWithAsset.size === 0) {
            // No one has it yet
            console.warn(`[AssetCoordinator] Asset ${assetId} not found in DB and no peer has it`);

            // Add to pending queue
            const key = `${projectUuid}:${assetId}`;
            if (!pendingRequests.has(key)) {
                pendingRequests.set(key, []);
            }
            pendingRequests.get(key)!.push({
                clientId,
                timestamp: Date.now(),
                priority,
            });

            sendAssetNotFound(projectUuid, clientId, assetId, 'Asset not available. Original creator must save first.');
            return;
        }

        // 3. Request upload from peer
        await requestUploadFromPeer(projectUuid, assetId, clientId);
    }

    /**
     * Handle asset uploaded notification from peer
     */
    async function handleAssetUploaded(
        projectUuid: string,
        clientId: string,
        data: AssetUploadedData | undefined,
    ): Promise<void> {
        if (!data || !data.assetId) {
            console.warn(`[AssetCoordinator] Invalid asset uploaded from ${clientId}`);
            return;
        }

        const { assetId, requestedBy, success = false, size, error } = data;

        if (!success) {
            console.error(`[AssetCoordinator] Client ${clientId} failed to upload ${assetId}: ${error}`);
            return;
        }

        if (DEBUG) {
            console.log(`[AssetCoordinator] Client ${clientId} uploaded asset ${assetId} (${size} bytes)`);
        }

        // Notify the specific requester
        if (requestedBy) {
            sendToClient(projectUuid, requestedBy, {
                type: 'asset-ready',
                projectId: projectUuid,
                data: {
                    assetId,
                    url: `/projects/${projectUuid}/assets/by-client-id/${assetId}`,
                    fromCache: false,
                    size,
                },
            });
        }

        // Broadcast availability to all clients
        broadcastToProject(projectUuid, {
            type: 'asset-available',
            projectId: projectUuid,
            data: { assetId, size },
        });
    }

    /**
     * Handle prefetch progress update from client
     */
    function handlePrefetchProgress(
        projectUuid: string,
        clientId: string,
        data: PrefetchProgressData | undefined,
    ): void {
        if (!data || typeof data.total !== 'number') {
            console.warn(`[AssetCoordinator] Invalid prefetch progress from ${clientId}`);
            return;
        }

        if (DEBUG) {
            console.log(
                `[AssetCoordinator] Client ${clientId} prefetch: ${data.completed}/${data.total} (${data.failed} failed)`,
            );
        }
    }

    /**
     * Handle bulk upload progress from reference client
     */
    async function handleBulkUploadProgress(
        projectUuid: string,
        clientId: string,
        data: BulkUploadProgressData | undefined,
    ): Promise<void> {
        if (!data || !data.status) {
            console.warn(`[AssetCoordinator] Invalid bulk upload progress from ${clientId}`);
            return;
        }

        const { status, total, completed = 0, failed = 0, failedAssets } = data;

        if (DEBUG) {
            console.log(`[AssetCoordinator] Bulk upload ${status}: ${completed}/${total}, ${failed} failed`);
        }

        if (status === 'completed') {
            console.log(`[AssetCoordinator] Bulk upload by ${clientId}: ${completed} assets available`);

            if (failedAssets && failedAssets.length > 0) {
                console.warn(
                    `[AssetCoordinator] Failed: ${failedAssets.map(a => a.assetId.substring(0, 8)).join(', ')}`,
                );
            }

            // Notify other clients using binary encoding with 0xFF prefix
            const projectSocketsMap = clientSockets.get(projectUuid);
            if (projectSocketsMap) {
                const message: AssetMessage = {
                    type: 'bulk-upload-complete',
                    projectId: projectUuid,
                    data: {
                        uploadedBy: clientId,
                        totalAvailable: completed,
                        failedCount: failed,
                    },
                };
                const binaryMessage = encodeAssetMessage(message);

                projectSocketsMap.forEach((socket, otherClientId) => {
                    if (otherClientId !== clientId) {
                        try {
                            socket.send(binaryMessage);
                        } catch (err: unknown) {
                            const errMessage = err instanceof Error ? err.message : String(err);
                            console.error(`[AssetCoordinator] Failed to notify ${otherClientId}:`, errMessage);
                        }
                    }
                });
            }
        }
    }

    /**
     * Handle priority update from client
     */
    async function handlePriorityUpdate(
        projectUuid: string,
        clientId: string,
        data: PriorityUpdateData | undefined,
    ): Promise<void> {
        if (!data || !data.assetId) {
            console.warn(`[AssetCoordinator] Invalid priority update from ${clientId}`);
            return;
        }

        const { assetId, priority, reason, pageId } = data;

        if (DEBUG) {
            console.log(
                `[AssetCoordinator] Priority update: ${assetId.substring(0, 8)}... ` +
                    `priority=${priority} reason=${reason} from=${clientId.substring(0, 8)}...`,
            );
        }

        // Register in server priority queue
        priorityQueue.registerRequest({
            assetId,
            clientId,
            priority,
            reason: reason as PriorityQueueRequest['reason'],
            requestedAt: data.timestamp || Date.now(),
            pageId,
            projectId: projectUuid,
        });

        // Check if asset already exists in database
        try {
            const project = await findProjectByUuid(db, projectUuid);
            if (project) {
                const asset = await findAssetByClientId(db, assetId, project.id);
                if (asset) {
                    // Asset exists, notify client immediately
                    sendToClient(projectUuid, clientId, {
                        type: 'asset-ready',
                        projectId: projectUuid,
                        data: {
                            assetId,
                            url: `/projects/${projectUuid}/assets/by-client-id/${assetId}`,
                            fromCache: true,
                            size: parseInt(asset.file_size || '0', 10),
                            mimeType: asset.mime_type,
                        },
                    });
                    return;
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[AssetCoordinator] Error checking asset ${assetId}:`, errorMessage);
        }

        // Check if we should preempt any current uploads
        const preemptResult = priorityQueue.shouldPreempt(projectUuid);
        if (preemptResult.shouldPreempt && preemptResult.targetSlot) {
            const { targetSlot, preemptingItem } = preemptResult;

            if (DEBUG) {
                console.log(
                    `[AssetCoordinator] Preempting upload ${targetSlot.assetId.substring(0, 8)}... ` +
                        `for higher priority ${preemptingItem?.assetId.substring(0, 8)}...`,
                );
            }

            // Send preempt message to the uploading client
            sendToClient(projectUuid, targetSlot.clientId, {
                type: 'preempt-upload',
                projectId: projectUuid,
                data: {
                    assetId: targetSlot.assetId,
                    reason: `Higher priority request: ${reason}`,
                    preemptedBy: assetId,
                    retryAfter: 1000,
                },
            });

            // Release the slot
            priorityQueue.releaseSlot(projectUuid, targetSlot.assetId);
        }

        // Send acknowledgment to requesting client
        const stats = priorityQueue.getStats(projectUuid);
        sendToClient(projectUuid, clientId, {
            type: 'priority-ack',
            projectId: projectUuid,
            data: {
                assetId,
                queuePosition: stats.queueLength,
                estimatedWait: stats.queueLength * 500, // Rough estimate
            },
        });

        // Request upload from peer if available
        await requestUploadFromPeerWithPriority(projectUuid, assetId, clientId, priority);
    }

    /**
     * Handle navigation hint from client
     */
    async function handleNavigationHint(
        projectUuid: string,
        clientId: string,
        data: NavigationHintData | undefined,
    ): Promise<void> {
        if (!data || !data.assetIds || data.assetIds.length === 0) {
            return;
        }

        const { targetPageId, assetIds } = data;

        if (DEBUG) {
            console.log(
                `[AssetCoordinator] Navigation hint: page=${targetPageId.substring(0, 8)}... ` +
                    `assets=${assetIds.length} from=${clientId.substring(0, 8)}...`,
            );
        }

        // Boost priority for all navigation assets
        for (const assetId of assetIds) {
            priorityQueue.registerRequest({
                assetId,
                clientId,
                priority: PRIORITY.HIGH,
                reason: 'navigation',
                requestedAt: data.timestamp || Date.now(),
                pageId: targetPageId,
                projectId: projectUuid,
            });
        }

        // Find which assets we don't have and need to fetch
        const missingAssets: string[] = [];

        try {
            const project = await findProjectByUuid(db, projectUuid);
            if (project) {
                for (const assetId of assetIds) {
                    const asset = await findAssetByClientId(db, assetId, project.id);
                    if (!asset) {
                        missingAssets.push(assetId);
                    }
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[AssetCoordinator] Error checking navigation assets:`, errorMessage);
        }

        if (missingAssets.length === 0) {
            if (DEBUG) {
                console.log(`[AssetCoordinator] All navigation assets already available`);
            }
            return;
        }

        if (DEBUG) {
            console.log(`[AssetCoordinator] ${missingAssets.length} navigation assets need fetching`);
        }

        // Request upload from peers for missing assets
        for (const assetId of missingAssets) {
            await requestUploadFromPeerWithPriority(projectUuid, assetId, clientId, PRIORITY.HIGH);
        }
    }

    // ==========================================
    // Public API
    // ==========================================

    /**
     * Register a new client for asset coordination
     */
    function registerClient(projectUuid: string, clientId: string, socket: WsWebSocket): void {
        if (!clientSockets.has(projectUuid)) {
            clientSockets.set(projectUuid, new Map());
        }
        clientSockets.get(projectUuid)!.set(clientId, socket);

        if (DEBUG) {
            console.log(`[AssetCoordinator] Registered client ${clientId} for project ${projectUuid}`);
        }
    }

    /**
     * Unregister a client
     */
    function unregisterClient(projectUuid: string, clientId: string): void {
        const projectSocketsMap = clientSockets.get(projectUuid);
        if (projectSocketsMap) {
            projectSocketsMap.delete(clientId);
        }

        // Remove from availability tracking
        const projectAssets = assetAvailability.get(projectUuid);
        if (projectAssets) {
            projectAssets.forEach(clients => {
                clients.delete(clientId);
            });
        }

        if (DEBUG) {
            console.log(`[AssetCoordinator] Unregistered client ${clientId} from project ${projectUuid}`);
        }
    }

    /**
     * Clean up project when all clients disconnect
     */
    function cleanupProject(projectUuid: string): void {
        assetAvailability.delete(projectUuid);
        clientSockets.delete(projectUuid);

        // Clean up pending requests for this project
        const keysToDelete: string[] = [];
        pendingRequests.forEach((_, key) => {
            if (key.startsWith(`${projectUuid}:`)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => pendingRequests.delete(key));

        // Clean up priority queue for this project
        priorityQueue.clearProject(projectUuid);

        if (DEBUG) {
            console.log(`[AssetCoordinator] Cleaned up project ${projectUuid}`);
        }
    }

    /**
     * Handle asset-related message from client
     */
    async function handleMessage(projectUuid: string, clientId: string, message: AssetMessage): Promise<void> {
        const { type, data } = message;

        try {
            switch (type) {
                case 'awareness-update':
                    await handleAwarenessUpdate(projectUuid, clientId, data as AwarenessUpdateData);
                    break;

                case 'request-asset':
                    await handleAssetRequest(projectUuid, clientId, data as AssetRequestData);
                    break;

                case 'asset-uploaded':
                    await handleAssetUploaded(projectUuid, clientId, data as AssetUploadedData);
                    break;

                case 'prefetch-progress':
                    handlePrefetchProgress(projectUuid, clientId, data as PrefetchProgressData);
                    break;

                case 'bulk-upload-progress':
                    await handleBulkUploadProgress(projectUuid, clientId, data as BulkUploadProgressData);
                    break;

                case 'priority-update':
                    await handlePriorityUpdate(projectUuid, clientId, data as PriorityUpdateData);
                    break;

                case 'navigation-hint':
                    await handleNavigationHint(projectUuid, clientId, data as NavigationHintData);
                    break;

                default:
                    console.warn(`[AssetCoordinator] Unknown message type: ${type}`);
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[AssetCoordinator] Error handling message type ${type}:`, errorMessage);
        }
    }

    /**
     * Trigger when collaboration is detected (2nd+ client joins)
     */
    async function onCollaborationDetected(projectUuid: string): Promise<void> {
        if (DEBUG) {
            console.log(`[AssetCoordinator] Collaboration detected for project ${projectUuid}`);
        }

        const projectAssets = assetAvailability.get(projectUuid);
        if (!projectAssets) {
            console.warn(`[AssetCoordinator] No asset awareness for project ${projectUuid}`);
            return;
        }

        // Build per-client asset lists
        const clientAssetMap = new Map<string, Set<string>>();

        projectAssets.forEach((clients, assetId) => {
            clients.forEach(cId => {
                if (!clientAssetMap.has(cId)) {
                    clientAssetMap.set(cId, new Set());
                }
                clientAssetMap.get(cId)!.add(assetId);
            });
        });

        // Find reference client (has most assets)
        let maxAssets = 0;
        let referenceClientId: string | null = null;

        clientAssetMap.forEach((assetsSet, cId) => {
            if (assetsSet.size > maxAssets) {
                maxAssets = assetsSet.size;
                referenceClientId = cId;
            }
        });

        if (!referenceClientId) {
            console.warn('[AssetCoordinator] No reference client found');
            return;
        }

        const referenceAssets = clientAssetMap.get(referenceClientId)!;
        const referenceAssetIds = Array.from(referenceAssets);

        if (DEBUG) {
            console.log(`[AssetCoordinator] Reference client ${referenceClientId} has ${referenceAssets.size} assets`);
        }

        // Request reference client to upload ALL assets
        if (referenceAssetIds.length > 0) {
            sendToClient(projectUuid, referenceClientId, {
                type: 'bulk-upload-request',
                projectId: projectUuid,
                data: {
                    assetIds: referenceAssetIds,
                    uploadUrl: `/projects/${projectUuid}/assets`,
                    reason: 'collaboration-sync',
                },
            });
        }

        // For each other client, calculate missing assets and send prefetch request
        clientAssetMap.forEach((assetsSet, cId) => {
            if (cId === referenceClientId) return;

            const missingAssets = Array.from(referenceAssets).filter(assetId => !assetsSet.has(assetId));

            if (missingAssets.length === 0) {
                if (DEBUG) console.log(`[AssetCoordinator] Client ${cId} has all assets`);
                return;
            }

            if (DEBUG) {
                console.log(`[AssetCoordinator] Client ${cId} missing ${missingAssets.length} assets`);
            }

            sendToClient(projectUuid, cId, {
                type: 'request-prefetch',
                projectId: projectUuid,
                data: {
                    assetIds: missingAssets,
                    priority: 'background',
                    reason: 'collaboration-detected',
                    referenceClient: referenceClientId,
                    delayMs: 2000,
                },
            });
        });
    }

    /**
     * Get coordination stats for debugging
     */
    function getStats(): AssetCoordinatorStats {
        let totalClients = 0;
        let totalAssets = 0;

        clientSockets.forEach(clients => {
            totalClients += clients.size;
        });

        assetAvailability.forEach(assetsMap => {
            totalAssets += assetsMap.size;
        });

        return {
            projects: clientSockets.size,
            totalClients,
            totalAssets,
            pendingRequests: pendingRequests.size,
        };
    }

    return {
        isAssetMessage,
        registerClient,
        unregisterClient,
        cleanupProject,
        handleMessage,
        onCollaborationDetected,
        getStats,
    };
}

// Default singleton instance for production use
const defaultCoordinator = createAssetCoordinator();

// Re-export individual functions for backwards compatibility
export const isAssetMessage = defaultCoordinator.isAssetMessage;
export const registerClient = defaultCoordinator.registerClient;
export const unregisterClient = defaultCoordinator.unregisterClient;
export const cleanupProject = defaultCoordinator.cleanupProject;
export const handleMessage = defaultCoordinator.handleMessage;
export const onCollaborationDetected = defaultCoordinator.onCollaborationDetected;
export const getStats = defaultCoordinator.getStats;
