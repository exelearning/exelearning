import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { WebSocket as WsWebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { AssetsService } from '../../assets/services/assets.service';
import { ProjectsService } from '../../projects/services/projects.service';

/**
 * Asset coordination message types
 */
export type AssetMessageType =
    | 'awareness-update'
    | 'request-asset'
    | 'asset-uploaded'
    | 'prefetch-progress'
    | 'bulk-upload-progress'
    | 'upload-request'
    | 'bulk-upload-request'
    | 'asset-ready'
    | 'asset-not-found'
    | 'request-prefetch'
    | 'asset-available';

/**
 * Base asset message structure
 */
export interface AssetMessage {
    type: AssetMessageType;
    projectId?: string;
    clientId?: string;
    data: any;
}

/**
 * AssetCoordinatorService
 *
 * Manages intelligent asset prefetching and peer-to-peer coordination
 * for collaborative document editing.
 *
 * Key responsibilities:
 * 1. Track which clients have which assets (Awareness)
 * 2. Detect when clients need assets
 * 3. Coordinate upload requests to peers
 * 4. Trigger background prefetch
 * 5. Handle asset request routing
 *
 * Protocol Messages:
 * - awareness-update: Client announces available assets
 * - request-asset: Client requests an asset
 * - upload-request: Server asks client to upload asset
 * - asset-ready: Server notifies asset is available
 * - asset-not-found: Asset unavailable
 * - request-prefetch: Server triggers background prefetch
 */
@Injectable()
export class AssetCoordinatorService {
    private readonly logger = new Logger(AssetCoordinatorService.name);

    /**
     * Asset availability tracking
     * Structure: projectUuid -> assetId -> Set<clientId>
     */
    private assetAvailability = new Map<string, Map<string, Set<string>>>();

    /**
     * Client socket mapping
     * Structure: projectUuid -> clientId -> WebSocket
     */
    private clientSockets = new Map<string, Map<string, WsWebSocket>>();

    /**
     * Pending asset requests
     * Structure: projectUuid:assetId -> Array<{ clientId, timestamp, priority }>
     */
    private pendingRequests = new Map<
        string,
        Array<{ clientId: string; timestamp: number; priority: 'high' | 'low' }>
    >();

    constructor(
        @Inject(forwardRef(() => AssetsService))
        private readonly assetsService: AssetsService,
        @Inject(forwardRef(() => ProjectsService))
        private readonly projectsService: ProjectsService,
    ) {}

    /**
     * Check if a message is an asset-related message
     */
    isAssetMessage(type: string): boolean {
        return [
            'awareness-update',
            'request-asset',
            'asset-uploaded',
            'prefetch-progress',
            'bulk-upload-progress',
        ].includes(type);
    }

    /**
     * Register a new client for asset coordination
     */
    registerClient(projectUuid: string, clientId: string, socket: WsWebSocket): void {
        if (!this.clientSockets.has(projectUuid)) {
            this.clientSockets.set(projectUuid, new Map());
        }
        this.clientSockets.get(projectUuid)!.set(clientId, socket);

        this.logger.log(
            `Registered client ${clientId} for asset coordination in project ${projectUuid}`,
        );
    }

    /**
     * Unregister a client
     */
    unregisterClient(projectUuid: string, clientId: string): void {
        const projectSockets = this.clientSockets.get(projectUuid);
        if (projectSockets) {
            projectSockets.delete(clientId);
        }

        // Remove from availability tracking
        const projectAssets = this.assetAvailability.get(projectUuid);
        if (projectAssets) {
            projectAssets.forEach((clients) => {
                clients.delete(clientId);
            });
        }

        this.logger.log(
            `Unregistered client ${clientId} from asset coordination in project ${projectUuid}`,
        );
    }

    /**
     * Clean up project when all clients disconnect
     */
    cleanupProject(projectUuid: string): void {
        this.assetAvailability.delete(projectUuid);
        this.clientSockets.delete(projectUuid);

        // Clean up pending requests for this project
        const keysToDelete: string[] = [];
        this.pendingRequests.forEach((_, key) => {
            if (key.startsWith(`${projectUuid}:`)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach((key) => this.pendingRequests.delete(key));

        this.logger.log(`Cleaned up asset coordination for project ${projectUuid}`);
    }

    /**
     * Handle asset-related message from client
     */
    async handleMessage(
        projectUuid: string,
        clientId: string,
        message: AssetMessage,
    ): Promise<void> {
        const { type, data } = message;

        try {
            switch (type) {
                case 'awareness-update':
                    await this.handleAwarenessUpdate(projectUuid, clientId, data);
                    break;

                case 'request-asset':
                    await this.handleAssetRequest(projectUuid, clientId, data);
                    break;

                case 'asset-uploaded':
                    await this.handleAssetUploaded(projectUuid, clientId, data);
                    break;

                case 'prefetch-progress':
                    this.handlePrefetchProgress(projectUuid, clientId, data);
                    break;

                case 'bulk-upload-progress':
                    await this.handleBulkUploadProgress(projectUuid, clientId, data);
                    break;

                default:
                    this.logger.warn(`Unknown asset message type: ${type}`);
            }
        } catch (error) {
            this.logger.error(`Error handling message type ${type}:`, error);
        }
    }

    /**
     * Handle awareness update from client
     * Client announces which assets it has in IndexedDB
     */
    private async handleAwarenessUpdate(
        projectUuid: string,
        clientId: string,
        data: { availableAssets: string[]; totalAssets: number } | undefined,
    ): Promise<void> {
        // Validate data structure
        if (!data || !Array.isArray(data.availableAssets)) {
            this.logger.warn(
                `Invalid awareness update data from client ${clientId}: ${JSON.stringify(data)}`,
            );
            return;
        }

        const { availableAssets, totalAssets = availableAssets.length } = data;

        this.logger.log(
            `Client ${clientId} has ${availableAssets.length}/${totalAssets} assets for project ${projectUuid}`,
        );

        // Initialize project tracking if needed
        if (!this.assetAvailability.has(projectUuid)) {
            this.assetAvailability.set(projectUuid, new Map());
        }

        const projectAssets = this.assetAvailability.get(projectUuid)!;

        // Update availability map
        availableAssets.forEach((assetId) => {
            if (!projectAssets.has(assetId)) {
                projectAssets.set(assetId, new Set());
            }
            projectAssets.get(assetId)!.add(clientId);
        });

        // Check if any pending requests can now be fulfilled
        await this.checkPendingRequests(projectUuid, availableAssets);
    }

    /**
     * Check if newly available assets can fulfill pending requests
     */
    private async checkPendingRequests(
        projectUuid: string,
        newlyAvailableAssets: string[],
    ): Promise<void> {
        for (const assetId of newlyAvailableAssets) {
            const key = `${projectUuid}:${assetId}`;
            const pending = this.pendingRequests.get(key);
            if (!pending || pending.length === 0) continue;

            this.logger.log(
                `Asset ${assetId} now available, fulfilling ${pending.length} pending requests`,
            );

            // Get highest priority request
            const highestPriority = pending.reduce((prev, curr) =>
                curr.priority === 'high' ? curr : prev,
            );

            await this.requestUploadFromPeer(projectUuid, assetId, highestPriority.clientId);

            // Clear pending for this asset
            this.pendingRequests.delete(key);
        }
    }

    /**
     * Handle asset request from client
     */
    private async handleAssetRequest(
        projectUuid: string,
        clientId: string,
        data:
            | { assetId: string; priority: 'high' | 'low'; reason: 'render' | 'prefetch' }
            | undefined,
    ): Promise<void> {
        // Validate data structure
        if (!data || !data.assetId) {
            this.logger.warn(
                `Invalid asset request data from client ${clientId}: ${JSON.stringify(data)}`,
            );
            return;
        }

        const { assetId, priority = 'low', reason = 'render' } = data;

        this.logger.log(
            `Client ${clientId} requested asset ${assetId} (priority: ${priority}, reason: ${reason})`,
        );

        // 1. Check if asset exists in database
        try {
            // Get project by UUID to get numeric ID
            const project = await this.projectsService.findByUuid(projectUuid);
            if (!project) {
                this.sendAssetNotFound(projectUuid, clientId, assetId, 'Project not found');
                return;
            }

            const asset = await this.assetsService.findByClientId(assetId);

            if (asset && asset.projectId === project.id) {
                // Asset exists in DB, send URL immediately
                this.logger.log(`Asset ${assetId} found in database, sending URL`);

                this.sendToClient(projectUuid, clientId, {
                    type: 'asset-ready',
                    projectId: projectUuid,
                    data: {
                        assetId,
                        url: `/projects/${projectUuid}/assets/by-client-id/${assetId}`,
                        fromCache: true,
                        size: parseInt(asset.fileSize || '0', 10),
                        mimeType: asset.mimeType,
                        filename: asset.filename,
                    },
                });
                return;
            }
        } catch (error) {
            this.logger.error(`Error checking database for asset ${assetId}:`, error);
        }

        // 2. Check if any peer has it
        const projectAssets = this.assetAvailability.get(projectUuid);
        const peersWithAsset = projectAssets?.get(assetId);

        if (!peersWithAsset || peersWithAsset.size === 0) {
            // No one has it yet
            this.logger.warn(`Asset ${assetId} not found in DB and no peer has it`);

            // Add to pending queue
            const key = `${projectUuid}:${assetId}`;
            if (!this.pendingRequests.has(key)) {
                this.pendingRequests.set(key, []);
            }
            this.pendingRequests.get(key)!.push({
                clientId,
                timestamp: Date.now(),
                priority,
            });

            // Notify client
            this.sendAssetNotFound(
                projectUuid,
                clientId,
                assetId,
                'Asset not available. Original creator must save first.',
            );
            return;
        }

        // 3. Request upload from peer
        await this.requestUploadFromPeer(projectUuid, assetId, clientId);
    }

    /**
     * Request a peer to upload an asset
     */
    private async requestUploadFromPeer(
        projectUuid: string,
        assetId: string,
        requestedBy: string,
    ): Promise<void> {
        const projectAssets = this.assetAvailability.get(projectUuid);
        const peersWithAsset = projectAssets?.get(assetId);

        if (!peersWithAsset || peersWithAsset.size === 0) {
            this.logger.error(`No peer has asset ${assetId}`);
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
            // Only the requester has it (shouldn't happen)
            this.logger.warn(`Only requester ${requestedBy} has asset ${assetId}`);
            return;
        }

        this.logger.log(
            `Requesting client ${peerClientId} to upload asset ${assetId} for client ${requestedBy}`,
        );

        // Generate a unique request ID for tracking
        const requestId = randomUUID();

        // Send upload request to peer (use projectUuid, not numeric ID)
        this.sendToClient(projectUuid, peerClientId, {
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
     * Handle asset uploaded notification from peer
     */
    private async handleAssetUploaded(
        projectUuid: string,
        clientId: string,
        data:
            | {
                  assetId: string;
                  requestedBy?: string;
                  success: boolean;
                  size?: number;
                  error?: string;
              }
            | undefined,
    ): Promise<void> {
        // Validate data structure
        if (!data || !data.assetId) {
            this.logger.warn(
                `Invalid asset uploaded data from client ${clientId}: ${JSON.stringify(data)}`,
            );
            return;
        }

        const { assetId, requestedBy, success = false, size, error } = data;

        if (!success) {
            this.logger.error(`Client ${clientId} failed to upload asset ${assetId}: ${error}`);
            return;
        }

        this.logger.log(
            `Client ${clientId} successfully uploaded asset ${assetId} (${size} bytes)`,
        );

        // Notify the specific requester (use projectUuid, not numeric ID)
        if (requestedBy) {
            this.sendToClient(projectUuid, requestedBy, {
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

        // Broadcast availability to all clients in project
        this.broadcastToProject(projectUuid, {
            type: 'asset-available',
            projectId: projectUuid,
            data: {
                assetId,
                size,
            },
        });
    }

    /**
     * Handle prefetch progress update from client
     */
    private handlePrefetchProgress(
        projectUuid: string,
        clientId: string,
        data: { total: number; completed: number; failed: number } | undefined,
    ): void {
        // Validate data structure
        if (!data || typeof data.total !== 'number') {
            this.logger.warn(
                `Invalid prefetch progress data from client ${clientId}: ${JSON.stringify(data)}`,
            );
            return;
        }

        const { total, completed = 0, failed = 0 } = data;
        this.logger.debug(
            `Client ${clientId} prefetch progress: ${completed}/${total} (${failed} failed)`,
        );
    }

    /**
     * Handle bulk upload progress from reference client
     * This tracks the progress of assets being uploaded to the server
     */
    private async handleBulkUploadProgress(
        projectUuid: string,
        clientId: string,
        data:
            | {
                  status: 'started' | 'in-progress' | 'completed';
                  total: number;
                  completed: number;
                  failed: number;
                  failedAssets?: Array<{ assetId: string; error: string }>;
              }
            | undefined,
    ): Promise<void> {
        // Validate data structure
        if (!data || !data.status) {
            this.logger.warn(
                `Invalid bulk upload progress data from client ${clientId}: ${JSON.stringify(data)}`,
            );
            return;
        }

        const { status, total, completed = 0, failed = 0, failedAssets } = data;

        this.logger.log(
            `Client ${clientId} bulk upload ${status}: ${completed}/${total} completed, ${failed} failed`,
        );

        // When bulk upload completes, notify other clients that they can start downloading
        if (status === 'completed') {
            this.logger.log(
                `Bulk upload completed by ${clientId}: ${completed} assets now available on server`,
            );

            if (failedAssets && failedAssets.length > 0) {
                this.logger.warn(
                    `Failed to upload ${failedAssets.length} assets: ${failedAssets.map((a) => a.assetId.substring(0, 8)).join(', ')}`,
                );
            }

            // Broadcast to all other clients that assets are ready for download
            // This allows them to start prefetching immediately instead of waiting for the delay
            const projectSockets = this.clientSockets.get(projectUuid);
            if (projectSockets) {
                projectSockets.forEach((socket, otherClientId) => {
                    if (otherClientId !== clientId) {
                        try {
                            socket.send(
                                JSON.stringify({
                                    type: 'bulk-upload-complete',
                                    projectId: projectUuid,
                                    data: {
                                        uploadedBy: clientId,
                                        totalAvailable: completed,
                                        failedCount: failed,
                                    },
                                }),
                            );
                        } catch (error) {
                            this.logger.error(
                                `Failed to notify client ${otherClientId} of bulk upload completion`,
                                error,
                            );
                        }
                    }
                });
            }
        }
    }

    /**
     * Trigger when collaboration is detected (2nd+ client joins)
     * Flow:
     * 1. Find reference client (has most assets)
     * 2. Request reference client to upload all its assets to server
     * 3. Other clients can then download from server
     */
    async onCollaborationDetected(projectUuid: string): Promise<void> {
        this.logger.log(
            `Analyzing asset distribution for project ${projectUuid} to trigger smart prefetch`,
        );

        const projectAssets = this.assetAvailability.get(projectUuid);
        if (!projectAssets) {
            this.logger.warn(`No asset awareness data for project ${projectUuid}`);
            return;
        }

        // Build per-client asset lists
        const clientAssets = new Map<string, Set<string>>();

        projectAssets.forEach((clients, assetId) => {
            clients.forEach((clientId) => {
                if (!clientAssets.has(clientId)) {
                    clientAssets.set(clientId, new Set());
                }
                clientAssets.get(clientId)!.add(assetId);
            });
        });

        // Find reference client (has most assets)
        let maxAssets = 0;
        let referenceClientId: string | null = null;

        clientAssets.forEach((assets, clientId) => {
            if (assets.size > maxAssets) {
                maxAssets = assets.size;
                referenceClientId = clientId;
            }
        });

        if (!referenceClientId) {
            this.logger.warn('No reference client found');
            return;
        }

        const referenceAssets = clientAssets.get(referenceClientId)!;
        const referenceAssetIds = Array.from(referenceAssets);

        this.logger.log(
            `Reference client ${referenceClientId} has ${referenceAssets.size} assets, will sync to other clients`,
        );

        // STEP 1: Request reference client to upload ALL its assets to server
        // This ensures assets are available on server before other clients try to download
        // Use projectUuid, not numeric ID
        if (referenceAssetIds.length > 0) {
            this.logger.log(
                `Requesting reference client ${referenceClientId} to upload ${referenceAssetIds.length} assets`,
            );

            this.sendToClient(projectUuid, referenceClientId, {
                type: 'bulk-upload-request',
                projectId: projectUuid,
                data: {
                    assetIds: referenceAssetIds,
                    uploadUrl: `/projects/${projectUuid}/assets`,
                    reason: 'collaboration-sync',
                },
            });
        }

        // STEP 2: For each other client, calculate missing assets and send prefetch request
        // Note: These clients will try to download from server - the reference client
        // should be uploading assets in parallel, so they might need to retry
        clientAssets.forEach((assets, clientId) => {
            if (clientId === referenceClientId) return;

            const missingAssets = Array.from(referenceAssets).filter(
                (assetId) => !assets.has(assetId),
            );

            if (missingAssets.length === 0) {
                this.logger.log(`Client ${clientId} has all assets, no prefetch needed`);
                return;
            }

            this.logger.log(
                `Client ${clientId} is missing ${missingAssets.length} assets, triggering background prefetch`,
            );

            // Send prefetch request with a small delay hint so reference client can upload first
            this.sendToClient(projectUuid, clientId, {
                type: 'request-prefetch',
                projectId: projectUuid,
                data: {
                    assetIds: missingAssets,
                    priority: 'background',
                    reason: 'collaboration-detected',
                    referenceClient: referenceClientId,
                    delayMs: 2000, // Wait 2s for reference client to start uploading
                },
            });
        });
    }

    /**
     * Send asset not found message
     */
    private sendAssetNotFound(
        projectUuid: string,
        clientId: string,
        assetId: string,
        error: string,
    ): void {
        this.sendToClient(projectUuid, clientId, {
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
     * Send message to specific client
     */
    private sendToClient(projectUuid: string, clientId: string, message: AssetMessage): void {
        const socket = this.getClientSocket(projectUuid, clientId);
        if (!socket) {
            this.logger.warn(`Cannot send to client ${clientId}: socket not found`);
            return;
        }

        try {
            socket.send(JSON.stringify(message));
        } catch (error) {
            this.logger.error(`Failed to send message to client ${clientId}`, error);
        }
    }

    /**
     * Broadcast message to all clients in project
     */
    private broadcastToProject(projectUuid: string, message: AssetMessage): void {
        const projectSockets = this.clientSockets.get(projectUuid);
        if (!projectSockets) return;

        const json = JSON.stringify(message);
        projectSockets.forEach((socket, clientId) => {
            try {
                socket.send(json);
            } catch (error) {
                this.logger.error(`Failed to broadcast to client ${clientId}`, error);
            }
        });
    }

    /**
     * Get WebSocket for specific client
     */
    private getClientSocket(projectUuid: string, clientId: string): WsWebSocket | null {
        return this.clientSockets.get(projectUuid)?.get(clientId) || null;
    }

    /**
     * Get coordination stats for debugging
     */
    getStats(): {
        projects: number;
        totalClients: number;
        totalAssets: number;
        pendingRequests: number;
    } {
        let totalClients = 0;
        let totalAssets = 0;

        this.clientSockets.forEach((clients) => {
            totalClients += clients.size;
        });

        this.assetAvailability.forEach((assets) => {
            totalAssets += assets.size;
        });

        return {
            projects: this.clientSockets.size,
            totalClients,
            totalAssets,
            pendingRequests: this.pendingRequests.size,
        };
    }
}
