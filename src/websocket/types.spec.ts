/**
 * Tests for WebSocket Types
 * These are type definitions, so we test that the exports are correctly defined
 */
import { describe, it, expect } from 'bun:test';
import type {
    ClientMeta,
    Room,
    AssetMessageType,
    AssetMessage,
    AwarenessUpdateData,
    AssetRequestData,
    AssetUploadedData,
    PrefetchProgressData,
    BulkUploadProgressData,
    PendingRequest,
    WebSocketServerInfo,
    AssetCoordinatorStats,
    PriorityReason,
    PriorityUpdateData,
    NavigationHintData,
    PriorityAckData,
    PreemptUploadData,
    ResumeUploadData,
    SlotAvailableData,
    PriorityQueueStats,
} from './types';

describe('WebSocket types', () => {
    describe('ClientMeta', () => {
        it('should define client metadata structure', () => {
            const meta: ClientMeta = {
                userId: 1,
                projectUuid: 'abc-123',
                clientId: 'client-1',
                connectedAt: new Date(),
            };
            expect(meta.userId).toBe(1);
            expect(meta.projectUuid).toBe('abc-123');
            expect(meta.clientId).toBe('client-1');
            expect(meta.connectedAt).toBeInstanceOf(Date);
        });
    });

    describe('Room', () => {
        it('should define room structure', () => {
            const room: Room = {
                name: 'project-abc',
                conns: new Set(),
                projectUuid: 'abc-123',
            };
            expect(room.name).toBe('project-abc');
            expect(room.conns).toBeInstanceOf(Set);
            expect(room.projectUuid).toBe('abc-123');
        });
    });

    describe('AssetMessageType', () => {
        it('should include all message types', () => {
            const types: AssetMessageType[] = [
                'awareness-update',
                'request-asset',
                'asset-uploaded',
                'prefetch-progress',
                'bulk-upload-progress',
                'upload-request',
                'bulk-upload-request',
                'asset-ready',
                'asset-not-found',
                'request-prefetch',
                'asset-available',
                'bulk-upload-complete',
                'priority-update',
                'priority-request',
                'priority-ack',
                'preempt-upload',
                'resume-upload',
                'slot-available',
                'navigation-hint',
            ];
            expect(types.length).toBe(19);
        });
    });

    describe('AssetMessage', () => {
        it('should define asset message structure', () => {
            const message: AssetMessage = {
                type: 'request-asset',
                projectId: 'proj-1',
                clientId: 'client-1',
                data: { assetId: 'asset-1' },
            };
            expect(message.type).toBe('request-asset');
            expect(message.projectId).toBe('proj-1');
            expect(message.clientId).toBe('client-1');
            expect(message.data.assetId).toBe('asset-1');
        });

        it('should allow optional projectId and clientId', () => {
            const message: AssetMessage = {
                type: 'awareness-update',
                data: { availableAssets: [] },
            };
            expect(message.projectId).toBeUndefined();
            expect(message.clientId).toBeUndefined();
        });
    });

    describe('AwarenessUpdateData', () => {
        it('should define awareness update structure', () => {
            const data: AwarenessUpdateData = {
                availableAssets: ['asset-1', 'asset-2'],
                totalAssets: 5,
            };
            expect(data.availableAssets).toEqual(['asset-1', 'asset-2']);
            expect(data.totalAssets).toBe(5);
        });
    });

    describe('AssetRequestData', () => {
        it('should define asset request structure', () => {
            const data: AssetRequestData = {
                assetId: 'asset-1',
                priority: 'high',
                reason: 'render',
            };
            expect(data.assetId).toBe('asset-1');
            expect(data.priority).toBe('high');
            expect(data.reason).toBe('render');
        });
    });

    describe('AssetUploadedData', () => {
        it('should define asset uploaded structure with success', () => {
            const data: AssetUploadedData = {
                assetId: 'asset-1',
                requestedBy: 'client-2',
                success: true,
                size: 1024,
            };
            expect(data.assetId).toBe('asset-1');
            expect(data.success).toBe(true);
            expect(data.size).toBe(1024);
        });

        it('should define asset uploaded structure with error', () => {
            const data: AssetUploadedData = {
                assetId: 'asset-1',
                success: false,
                error: 'Upload failed',
            };
            expect(data.success).toBe(false);
            expect(data.error).toBe('Upload failed');
        });
    });

    describe('PrefetchProgressData', () => {
        it('should define prefetch progress structure', () => {
            const data: PrefetchProgressData = {
                total: 10,
                completed: 7,
                failed: 1,
            };
            expect(data.total).toBe(10);
            expect(data.completed).toBe(7);
            expect(data.failed).toBe(1);
        });
    });

    describe('BulkUploadProgressData', () => {
        it('should define bulk upload progress structure', () => {
            const data: BulkUploadProgressData = {
                status: 'in-progress',
                total: 20,
                completed: 15,
                failed: 2,
                failedAssets: [{ assetId: 'asset-1', error: 'Network error' }],
            };
            expect(data.status).toBe('in-progress');
            expect(data.total).toBe(20);
            expect(data.completed).toBe(15);
            expect(data.failed).toBe(2);
            expect(data.failedAssets).toHaveLength(1);
        });
    });

    describe('PendingRequest', () => {
        it('should define pending request structure', () => {
            const request: PendingRequest = {
                clientId: 'client-1',
                timestamp: Date.now(),
                priority: 'high',
            };
            expect(request.clientId).toBe('client-1');
            expect(typeof request.timestamp).toBe('number');
            expect(request.priority).toBe('high');
        });
    });

    describe('WebSocketServerInfo', () => {
        it('should define server info structure', () => {
            const info: WebSocketServerInfo = {
                port: 3000,
                isRunning: true,
                roomsCount: 5,
                totalConnections: 10,
                mode: 'server',
            };
            expect(info.port).toBe(3000);
            expect(info.isRunning).toBe(true);
            expect(info.roomsCount).toBe(5);
            expect(info.totalConnections).toBe(10);
            expect(info.mode).toBe('server');
        });
    });

    describe('AssetCoordinatorStats', () => {
        it('should define coordinator stats structure', () => {
            const stats: AssetCoordinatorStats = {
                projects: 3,
                totalClients: 15,
                totalAssets: 100,
                pendingRequests: 5,
            };
            expect(stats.projects).toBe(3);
            expect(stats.totalClients).toBe(15);
            expect(stats.totalAssets).toBe(100);
            expect(stats.pendingRequests).toBe(5);
        });
    });

    describe('PriorityReason', () => {
        it('should include all priority reasons', () => {
            const reasons: PriorityReason[] = [
                'render',
                'navigation',
                'prefetch',
                'save',
                'p2p-request',
                'retry',
                'preempted',
            ];
            expect(reasons.length).toBe(7);
        });
    });

    describe('PriorityUpdateData', () => {
        it('should define priority update structure', () => {
            const data: PriorityUpdateData = {
                assetId: 'asset-1',
                priority: 100,
                reason: 'render',
                pageId: 'page-1',
                timestamp: Date.now(),
            };
            expect(data.assetId).toBe('asset-1');
            expect(data.priority).toBe(100);
            expect(data.reason).toBe('render');
            expect(data.pageId).toBe('page-1');
        });
    });

    describe('NavigationHintData', () => {
        it('should define navigation hint structure', () => {
            const data: NavigationHintData = {
                targetPageId: 'page-2',
                assetIds: ['asset-1', 'asset-2'],
                timestamp: Date.now(),
            };
            expect(data.targetPageId).toBe('page-2');
            expect(data.assetIds).toEqual(['asset-1', 'asset-2']);
        });
    });

    describe('PriorityAckData', () => {
        it('should define priority ack structure', () => {
            const data: PriorityAckData = {
                assetId: 'asset-1',
                queuePosition: 3,
                estimatedWait: 1500,
            };
            expect(data.assetId).toBe('asset-1');
            expect(data.queuePosition).toBe(3);
            expect(data.estimatedWait).toBe(1500);
        });
    });

    describe('PreemptUploadData', () => {
        it('should define preempt upload structure', () => {
            const data: PreemptUploadData = {
                assetId: 'asset-1',
                reason: 'Higher priority request',
                preemptedBy: 'asset-2',
                retryAfter: 1000,
            };
            expect(data.assetId).toBe('asset-1');
            expect(data.reason).toBe('Higher priority request');
            expect(data.preemptedBy).toBe('asset-2');
            expect(data.retryAfter).toBe(1000);
        });
    });

    describe('ResumeUploadData', () => {
        it('should define resume upload structure', () => {
            const data: ResumeUploadData = {
                assetId: 'asset-1',
                newPriority: 50,
            };
            expect(data.assetId).toBe('asset-1');
            expect(data.newPriority).toBe(50);
        });
    });

    describe('SlotAvailableData', () => {
        it('should define slot available structure', () => {
            const data: SlotAvailableData = {
                nextAssetId: 'asset-2',
                availableSlots: 2,
            };
            expect(data.nextAssetId).toBe('asset-2');
            expect(data.availableSlots).toBe(2);
        });
    });

    describe('PriorityQueueStats', () => {
        it('should define priority queue stats structure', () => {
            const stats: PriorityQueueStats = {
                queueLength: 10,
                activeSlots: 3,
                maxSlots: 5,
                highestPriority: 100,
                lowestActivePriority: 30,
            };
            expect(stats.queueLength).toBe(10);
            expect(stats.activeSlots).toBe(3);
            expect(stats.maxSlots).toBe(5);
            expect(stats.highestPriority).toBe(100);
            expect(stats.lowestActivePriority).toBe(30);
        });
    });
});
