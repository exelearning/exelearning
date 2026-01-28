/**
 * WebSocket Types for Yjs Collaboration
 * Elysia migration - functional style
 */
import { WebSocket as WsWebSocket } from 'ws';

/**
 * Client metadata stored per connection
 */
export interface ClientMeta {
    userId: number;
    projectUuid: string;
    clientId: string;
    connectedAt: Date;
}

/**
 * Room - tracks connected clients for a document
 * No Y.Doc in memory - just connection tracking
 */
export interface Room {
    name: string;
    conns: Set<WsWebSocket>;
    projectUuid: string;
}

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
    | 'asset-available'
    | 'bulk-upload-complete'
    // Priority-related message types
    | 'priority-update'
    | 'priority-request'
    | 'priority-ack'
    | 'preempt-upload'
    | 'resume-upload'
    | 'slot-available'
    | 'navigation-hint'
    // Access control message types
    | 'access-revoked'
    // Upload session message types (optimized batch upload)
    | 'upload-session-create'
    | 'upload-session-ready'
    | 'upload-file-progress'
    | 'upload-batch-complete';

/**
 * Union type for all asset message data payloads
 */
export type AssetMessageData =
    | AwarenessUpdateData
    | AssetRequestData
    | AssetUploadedData
    | PrefetchProgressData
    | BulkUploadProgressData
    | PriorityUpdateData
    | NavigationHintData
    | PriorityAckData
    | PreemptUploadData
    | ResumeUploadData
    | SlotAvailableData
    | UploadSessionCreateData
    | UploadSessionReadyData
    | UploadFileProgressData
    | UploadBatchCompleteData
    | Record<string, unknown>; // For extensibility of future message types

/**
 * Base asset message structure
 */
export interface AssetMessage {
    type: AssetMessageType;
    projectId?: string;
    clientId?: string;
    data: AssetMessageData;
}

/**
 * Awareness update data
 */
export interface AwarenessUpdateData {
    availableAssets: string[];
    totalAssets: number;
}

/**
 * Asset request data
 */
export interface AssetRequestData {
    assetId: string;
    priority: 'high' | 'low';
    reason: 'render' | 'prefetch';
}

/**
 * Asset uploaded data
 */
export interface AssetUploadedData {
    assetId: string;
    requestedBy?: string;
    success: boolean;
    size?: number;
    error?: string;
}

/**
 * Prefetch progress data
 */
export interface PrefetchProgressData {
    total: number;
    completed: number;
    failed: number;
}

/**
 * Bulk upload progress data
 */
export interface BulkUploadProgressData {
    status: 'started' | 'in-progress' | 'completed';
    total: number;
    completed: number;
    failed: number;
    failedAssets?: Array<{ assetId: string; error: string }>;
}

/**
 * Pending asset request
 */
export interface PendingRequest {
    clientId: string;
    timestamp: number;
    priority: 'high' | 'low';
}

/**
 * WebSocket server info
 */
export interface WebSocketServerInfo {
    port: number;
    isRunning: boolean;
    roomsCount: number;
    totalConnections: number;
    mode: string;
}

/**
 * Asset coordinator stats
 */
export interface AssetCoordinatorStats {
    projects: number;
    totalClients: number;
    totalAssets: number;
    pendingRequests: number;
}

// ==========================================
// Priority System Types
// ==========================================

/**
 * Priority reason for asset requests
 */
export type PriorityReason = 'render' | 'navigation' | 'prefetch' | 'save' | 'p2p-request' | 'retry' | 'preempted';

/**
 * Priority update message data (client -> server)
 */
export interface PriorityUpdateData {
    assetId: string;
    priority: number;
    reason: PriorityReason;
    pageId?: string;
    timestamp: number;
}

/**
 * Navigation hint message data (client -> server)
 * Sent when user navigates to a new page
 */
export interface NavigationHintData {
    targetPageId: string;
    assetIds: string[];
    timestamp: number;
}

/**
 * Priority acknowledgment data (server -> client)
 */
export interface PriorityAckData {
    assetId: string;
    queuePosition: number;
    estimatedWait?: number;
}

/**
 * Preempt upload message data (server -> client)
 * Tells client to pause current upload for higher priority
 */
export interface PreemptUploadData {
    assetId: string;
    reason: string;
    preemptedBy: string;
    retryAfter?: number;
}

/**
 * Resume upload message data (server -> client)
 */
export interface ResumeUploadData {
    assetId: string;
    newPriority?: number;
}

/**
 * Slot available message data (server -> client)
 * Notifies that an upload slot is free
 */
export interface SlotAvailableData {
    nextAssetId?: string;
    availableSlots: number;
}

/**
 * Priority queue stats
 */
export interface PriorityQueueStats {
    queueLength: number;
    activeSlots: number;
    maxSlots: number;
    highestPriority: number;
    lowestActivePriority: number;
}

// ==========================================
// Upload Session Types (Optimized Batch Upload)
// ==========================================

/**
 * Asset manifest entry for upload session
 */
export interface UploadSessionManifestEntry {
    clientId: string;
    filename: string;
    size: number;
    mimeType: string;
}

/**
 * Upload session create message data (client -> server)
 */
export interface UploadSessionCreateData {
    projectId: string;
    totalFiles: number;
    totalBytes: number;
    manifest: UploadSessionManifestEntry[];
}

/**
 * Upload session ready message data (server -> client)
 */
export interface UploadSessionReadyData {
    sessionToken: string;
    expiresAt: number;
    config: {
        maxBatchSize: number;
        maxBatchBytes: number;
        endpoints: {
            batch: string;
            cancel: string;
        };
    };
}

/**
 * Upload file progress message data (server -> client)
 * Streamed in real-time as files are written to disk
 */
export interface UploadFileProgressData {
    clientId: string;
    bytesWritten: number;
    totalBytes: number;
    status: 'writing' | 'complete' | 'error';
    error?: string;
}

/**
 * Upload batch complete message data (server -> client)
 */
export interface UploadBatchCompleteData {
    uploaded: number;
    failed: number;
    results: Array<{
        clientId: string;
        success: boolean;
        serverId?: number;
        error?: string;
    }>;
}
