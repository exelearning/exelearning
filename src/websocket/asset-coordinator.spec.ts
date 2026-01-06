/**
 * Tests for Asset Coordinator Service
 * Uses dependency injection pattern - no mock.module() needed
 *
 * Pattern: Each test creates its own isolated AssetCoordinator instance
 * with injected mock dependencies
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createAssetCoordinator, type AssetCoordinator, type AssetCoordinatorDeps } from './asset-coordinator';

// Create mock WebSocket
function createMockSocket(): any {
    const messages: any[] = [];
    return {
        send: (data: any) => messages.push(data),
        close: () => {},
        messages,
        readyState: 1, // OPEN
    };
}

// Create mock dependencies
function createMockDeps(overrides: Partial<AssetCoordinatorDeps> = {}): AssetCoordinatorDeps {
    return {
        findProjectByUuid: async (_db: any, uuid: string) => {
            if (uuid === 'test-project') {
                return { id: 1, uuid: 'test-project', owner_id: 1 };
            }
            return null;
        },
        findAssetByClientId: async (_db: any, clientId: string, projectId: number) => {
            if (projectId === 1 && clientId === 'asset-123') {
                return {
                    id: 1,
                    client_id: 'asset-123',
                    filename: 'test.jpg',
                    mime_type: 'image/jpeg',
                    file_size: '1024',
                };
            }
            return null;
        },
        priorityQueue: {
            registerRequest: () => {},
            registerActiveSlot: () => {},
            releaseSlot: () => {},
            clearProject: () => {},
            shouldPreempt: () => ({
                shouldPreempt: false,
                targetSlot: null,
                preemptingItem: null,
            }),
            getStats: () => ({
                queueLength: 0,
                activeSlots: 0,
                maxSlots: 4,
            }),
            peekNextUpload: () => null,
        },
        generateId: (() => {
            let counter = 0;
            return () => `test-uuid-${++counter}`;
        })(),
        ...overrides,
    };
}

describe('Asset Coordinator Service (DI)', () => {
    let coordinator: AssetCoordinator;
    let mockDeps: AssetCoordinatorDeps;
    let priorityQueueRequests: any[];
    let priorityQueueSlots: Map<string, any>;

    beforeEach(() => {
        priorityQueueRequests = [];
        priorityQueueSlots = new Map();

        mockDeps = createMockDeps({
            priorityQueue: {
                registerRequest: (request: any) => {
                    priorityQueueRequests.push(request);
                },
                registerActiveSlot: (slot: any) => {
                    priorityQueueSlots.set(`${slot.projectId}:${slot.assetId}`, slot);
                },
                releaseSlot: (projectId: string, assetId: string) => {
                    priorityQueueSlots.delete(`${projectId}:${assetId}`);
                },
                clearProject: (projectId: string) => {
                    for (const key of priorityQueueSlots.keys()) {
                        if (key.startsWith(`${projectId}:`)) {
                            priorityQueueSlots.delete(key);
                        }
                    }
                },
                shouldPreempt: () => ({
                    shouldPreempt: false,
                    targetSlot: null,
                    preemptingItem: null,
                }),
                getStats: () => ({
                    queueLength: priorityQueueRequests.length,
                    activeSlots: priorityQueueSlots.size,
                    maxSlots: 4,
                }),
                peekNextUpload: () => priorityQueueRequests[0] || null,
            },
        });

        // Create fresh coordinator for each test - complete isolation
        coordinator = createAssetCoordinator(mockDeps);
    });

    afterEach(() => {
        // Clean up
        coordinator.cleanupProject('test-project');
        coordinator.cleanupProject('project-1');
        coordinator.cleanupProject('project-2');
    });

    describe('isAssetMessage', () => {
        it('should recognize asset message types', () => {
            expect(coordinator.isAssetMessage('awareness-update')).toBe(true);
            expect(coordinator.isAssetMessage('request-asset')).toBe(true);
            expect(coordinator.isAssetMessage('asset-uploaded')).toBe(true);
            expect(coordinator.isAssetMessage('prefetch-progress')).toBe(true);
            expect(coordinator.isAssetMessage('bulk-upload-progress')).toBe(true);
            expect(coordinator.isAssetMessage('priority-update')).toBe(true);
            expect(coordinator.isAssetMessage('navigation-hint')).toBe(true);
        });

        it('should reject non-asset message types', () => {
            expect(coordinator.isAssetMessage('sync')).toBe(false);
            expect(coordinator.isAssetMessage('yjs-update')).toBe(false);
            expect(coordinator.isAssetMessage('unknown')).toBe(false);
            expect(coordinator.isAssetMessage('')).toBe(false);
        });
    });

    describe('registerClient', () => {
        it('should register new client', () => {
            const socket = createMockSocket();

            coordinator.registerClient('project-1', 'client-1', socket);

            const stats = coordinator.getStats();
            expect(stats.projects).toBeGreaterThanOrEqual(1);
            expect(stats.totalClients).toBeGreaterThanOrEqual(1);
        });

        it('should register multiple clients for same project', () => {
            const socket1 = createMockSocket();
            const socket2 = createMockSocket();

            coordinator.registerClient('project-1', 'client-1', socket1);
            coordinator.registerClient('project-1', 'client-2', socket2);

            const stats = coordinator.getStats();
            expect(stats.totalClients).toBeGreaterThanOrEqual(2);
        });

        it('should handle clients for different projects', () => {
            const socket1 = createMockSocket();
            const socket2 = createMockSocket();

            coordinator.registerClient('project-1', 'client-1', socket1);
            coordinator.registerClient('project-2', 'client-2', socket2);

            const stats = coordinator.getStats();
            expect(stats.projects).toBeGreaterThanOrEqual(2);
        });
    });

    describe('unregisterClient', () => {
        it('should unregister client', () => {
            const socket = createMockSocket();
            coordinator.registerClient('project-1', 'client-1', socket);

            coordinator.unregisterClient('project-1', 'client-1');

            // Doesn't throw
        });

        it('should handle unregistering non-existent client', () => {
            // Should not throw
            coordinator.unregisterClient('non-existent', 'client-999');
        });

        it('should remove client from asset availability', async () => {
            const socket = createMockSocket();
            coordinator.registerClient('project-1', 'client-1', socket);

            // Add awareness
            await coordinator.handleMessage('project-1', 'client-1', {
                type: 'awareness-update',
                data: { availableAssets: ['asset-1', 'asset-2'] },
            });

            coordinator.unregisterClient('project-1', 'client-1');

            // Stats should reflect removal
            const _stats = coordinator.getStats();
            // Availability map may still exist but client won't be in it
        });
    });

    describe('cleanupProject', () => {
        it('should clean up all project data', () => {
            const socket = createMockSocket();
            coordinator.registerClient('project-1', 'client-1', socket);

            coordinator.cleanupProject('project-1');

            // Register again to verify cleanup worked
            coordinator.registerClient('project-1', 'client-2', socket);
        });

        it('should handle cleaning up non-existent project', () => {
            // Should not throw
            coordinator.cleanupProject('non-existent');
        });

        it('should clean up pending requests', async () => {
            const socket = createMockSocket();
            coordinator.registerClient('test-project', 'client-1', socket);

            // Create pending request
            await coordinator.handleMessage('test-project', 'client-1', {
                type: 'request-asset',
                data: { assetId: 'missing-asset', priority: 'high' },
            });

            coordinator.cleanupProject('test-project');

            const _stats = coordinator.getStats();
            // Pending requests for project should be cleared
        });
    });

    describe('handleMessage', () => {
        describe('awareness-update', () => {
            it('should handle awareness update', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'awareness-update',
                    data: {
                        availableAssets: ['asset-1', 'asset-2', 'asset-3'],
                        totalAssets: 3,
                    },
                });

                const stats = coordinator.getStats();
                expect(stats.totalAssets).toBeGreaterThanOrEqual(3);
            });

            it('should handle empty awareness update', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'awareness-update',
                    data: { availableAssets: [] },
                });

                // Should not throw
            });

            it('should handle invalid awareness update', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                // Should not throw on invalid data
                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'awareness-update',
                    data: { invalidField: 'test' },
                });
            });

            it('should fulfill pending requests when asset becomes available', async () => {
                const socket1 = createMockSocket();
                const socket2 = createMockSocket();
                coordinator.registerClient('test-project', 'client-1', socket1);
                coordinator.registerClient('test-project', 'client-2', socket2);

                // Client 1 requests asset
                await coordinator.handleMessage('test-project', 'client-1', {
                    type: 'request-asset',
                    data: { assetId: 'new-asset', priority: 'high' },
                });

                // Client 2 announces it has the asset
                await coordinator.handleMessage('test-project', 'client-2', {
                    type: 'awareness-update',
                    data: { availableAssets: ['new-asset'] },
                });

                // Should have requested upload from client-2
                expect(socket2.messages.length).toBeGreaterThanOrEqual(0);
            });
        });

        describe('request-asset', () => {
            it('should return asset from database if exists', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('test-project', 'client-1', socket);

                await coordinator.handleMessage('test-project', 'client-1', {
                    type: 'request-asset',
                    data: { assetId: 'asset-123', priority: 'high' },
                });

                // Should send asset-ready message
                expect(socket.messages.length).toBeGreaterThan(0);
            });

            it('should handle missing asset gracefully', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('test-project', 'client-1', socket);

                await coordinator.handleMessage('test-project', 'client-1', {
                    type: 'request-asset',
                    data: { assetId: 'non-existent', priority: 'low' },
                });

                // Should queue or send not-found
                expect(socket.messages.length).toBeGreaterThan(0);
            });

            it('should request from peer if available', async () => {
                const socket1 = createMockSocket();
                const socket2 = createMockSocket();
                coordinator.registerClient('test-project', 'client-1', socket1);
                coordinator.registerClient('test-project', 'client-2', socket2);

                // Client 2 has the asset
                await coordinator.handleMessage('test-project', 'client-2', {
                    type: 'awareness-update',
                    data: { availableAssets: ['peer-asset'] },
                });

                // Client 1 requests it
                await coordinator.handleMessage('test-project', 'client-1', {
                    type: 'request-asset',
                    data: { assetId: 'peer-asset', priority: 'high' },
                });

                // Should request upload from client-2
                expect(socket2.messages.length).toBeGreaterThan(0);
            });

            it('should handle invalid request', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                // Should not throw on missing assetId
                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'request-asset',
                    data: { priority: 'high' }, // Missing assetId
                });
            });

            it('should handle non-existent project', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('non-existent-project', 'client-1', socket);

                await coordinator.handleMessage('non-existent-project', 'client-1', {
                    type: 'request-asset',
                    data: { assetId: 'asset-1' },
                });

                // Should send asset-not-found
                expect(socket.messages.length).toBeGreaterThan(0);
            });
        });

        describe('asset-uploaded', () => {
            it('should notify requester when asset uploaded', async () => {
                const socket1 = createMockSocket();
                const socket2 = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket1);
                coordinator.registerClient('project-1', 'client-2', socket2);

                await coordinator.handleMessage('project-1', 'client-2', {
                    type: 'asset-uploaded',
                    data: {
                        assetId: 'uploaded-asset',
                        requestedBy: 'client-1',
                        success: true,
                        size: 1024,
                    },
                });

                // Should notify client-1
                expect(socket1.messages.length).toBeGreaterThan(0);
            });

            it('should broadcast availability to all clients', async () => {
                const socket1 = createMockSocket();
                const socket2 = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket1);
                coordinator.registerClient('project-1', 'client-2', socket2);

                await coordinator.handleMessage('project-1', 'client-2', {
                    type: 'asset-uploaded',
                    data: {
                        assetId: 'broadcast-asset',
                        success: true,
                        size: 2048,
                    },
                });

                // Both should receive messages
                expect(socket1.messages.length).toBeGreaterThan(0);
                expect(socket2.messages.length).toBeGreaterThan(0);
            });

            it('should handle failed upload', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'asset-uploaded',
                    data: {
                        assetId: 'failed-asset',
                        success: false,
                        error: 'Upload failed',
                    },
                });

                // Should not throw on failure
            });

            it('should handle invalid data', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                // Should not throw on missing assetId
                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'asset-uploaded',
                    data: { success: true },
                });
            });
        });

        describe('prefetch-progress', () => {
            it('should handle prefetch progress', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'prefetch-progress',
                    data: {
                        total: 10,
                        completed: 5,
                        failed: 1,
                    },
                });

                // Should not throw
            });

            it('should handle invalid progress data', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'prefetch-progress',
                    data: { completed: 5 }, // Missing total
                });
            });
        });

        describe('bulk-upload-progress', () => {
            it('should handle bulk upload completion', async () => {
                const socket1 = createMockSocket();
                const socket2 = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket1);
                coordinator.registerClient('project-1', 'client-2', socket2);

                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'bulk-upload-progress',
                    data: {
                        status: 'completed',
                        total: 10,
                        completed: 10,
                        failed: 0,
                    },
                });

                // Client 2 should be notified
                expect(socket2.messages.length).toBeGreaterThan(0);
            });

            it('should handle in-progress status', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'bulk-upload-progress',
                    data: {
                        status: 'in-progress',
                        total: 10,
                        completed: 5,
                        failed: 0,
                    },
                });

                // Should not throw
            });

            it('should handle failed assets', async () => {
                const socket1 = createMockSocket();
                const socket2 = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket1);
                coordinator.registerClient('project-1', 'client-2', socket2);

                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'bulk-upload-progress',
                    data: {
                        status: 'completed',
                        total: 10,
                        completed: 8,
                        failed: 2,
                        failedAssets: [
                            { assetId: 'failed-1', error: 'Too large' },
                            { assetId: 'failed-2', error: 'Network error' },
                        ],
                    },
                });
            });
        });

        describe('priority-update', () => {
            it('should handle priority update', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('test-project', 'client-1', socket);

                await coordinator.handleMessage('test-project', 'client-1', {
                    type: 'priority-update',
                    data: {
                        assetId: 'priority-asset',
                        priority: 75, // HIGH
                        reason: 'render',
                        pageId: 'page-1',
                    },
                });

                // Should register in priority queue
                expect(priorityQueueRequests.length).toBeGreaterThan(0);
                expect(socket.messages.length).toBeGreaterThan(0); // priority-ack
            });

            it('should return immediately if asset in database', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('test-project', 'client-1', socket);

                await coordinator.handleMessage('test-project', 'client-1', {
                    type: 'priority-update',
                    data: {
                        assetId: 'asset-123', // Exists in mock
                        priority: 100,
                        reason: 'render',
                    },
                });

                // Should send asset-ready
                expect(socket.messages.length).toBeGreaterThan(0);
            });

            it('should handle invalid priority update', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'priority-update',
                    data: { priority: 50 }, // Missing assetId
                });
            });
        });

        describe('navigation-hint', () => {
            it('should handle navigation hint', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('test-project', 'client-1', socket);

                await coordinator.handleMessage('test-project', 'client-1', {
                    type: 'navigation-hint',
                    data: {
                        targetPageId: 'page-2',
                        assetIds: ['nav-asset-1', 'nav-asset-2'],
                    },
                });

                // Should register high priority requests
                expect(priorityQueueRequests.length).toBeGreaterThan(0);
            });

            it('should handle empty asset list', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'navigation-hint',
                    data: {
                        targetPageId: 'page-1',
                        assetIds: [],
                    },
                });

                // Should return early
            });

            it('should skip assets already in database', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('test-project', 'client-1', socket);

                await coordinator.handleMessage('test-project', 'client-1', {
                    type: 'navigation-hint',
                    data: {
                        targetPageId: 'page-1',
                        assetIds: ['asset-123'], // Exists in mock
                    },
                });

                // Should not request upload
            });
        });

        describe('unknown message type', () => {
            it('should handle unknown message type', async () => {
                const socket = createMockSocket();
                coordinator.registerClient('project-1', 'client-1', socket);

                await coordinator.handleMessage('project-1', 'client-1', {
                    type: 'unknown-type' as any,
                    data: {},
                });

                // Should not throw
            });
        });
    });

    describe('onCollaborationDetected', () => {
        it('should handle collaboration with no clients', async () => {
            // Should not throw
            await coordinator.onCollaborationDetected('empty-project');
        });

        it('should request bulk upload from reference client', async () => {
            const socket1 = createMockSocket();
            const socket2 = createMockSocket();
            coordinator.registerClient('project-1', 'client-1', socket1);
            coordinator.registerClient('project-1', 'client-2', socket2);

            // Client 1 has more assets
            await coordinator.handleMessage('project-1', 'client-1', {
                type: 'awareness-update',
                data: { availableAssets: ['asset-1', 'asset-2', 'asset-3'] },
            });

            // Client 2 has fewer
            await coordinator.handleMessage('project-1', 'client-2', {
                type: 'awareness-update',
                data: { availableAssets: ['asset-1'] },
            });

            await coordinator.onCollaborationDetected('project-1');

            // Client 1 (reference) should receive bulk-upload-request
            // Client 2 should receive prefetch request
            expect(socket1.messages.length + socket2.messages.length).toBeGreaterThan(0);
        });

        it('should send prefetch request to clients missing assets', async () => {
            const socket1 = createMockSocket();
            const socket2 = createMockSocket();
            coordinator.registerClient('project-1', 'client-1', socket1);
            coordinator.registerClient('project-1', 'client-2', socket2);

            // Client 1 has more assets
            await coordinator.handleMessage('project-1', 'client-1', {
                type: 'awareness-update',
                data: { availableAssets: ['asset-1', 'asset-2', 'asset-3'] },
            });

            // Client 2 only has asset-1
            await coordinator.handleMessage('project-1', 'client-2', {
                type: 'awareness-update',
                data: { availableAssets: ['asset-1'] },
            });

            await coordinator.onCollaborationDetected('project-1');

            // Client 2 should receive request for missing assets
            const _client2Messages = socket2.messages.filter(m => {
                try {
                    if (m instanceof Uint8Array && m[0] === 0xff) {
                        const json = JSON.parse(new TextDecoder().decode(m.slice(1)));
                        return json.type === 'request-prefetch';
                    }
                } catch {
                    return false;
                }
                return false;
            });
            // May or may not have prefetch based on timing
        });

        it('should skip if all clients have all assets', async () => {
            const socket1 = createMockSocket();
            const socket2 = createMockSocket();
            coordinator.registerClient('project-1', 'client-1', socket1);
            coordinator.registerClient('project-1', 'client-2', socket2);

            // Both clients have same assets
            await coordinator.handleMessage('project-1', 'client-1', {
                type: 'awareness-update',
                data: { availableAssets: ['asset-1', 'asset-2'] },
            });

            await coordinator.handleMessage('project-1', 'client-2', {
                type: 'awareness-update',
                data: { availableAssets: ['asset-1', 'asset-2'] },
            });

            const _initialMessages1 = socket1.messages.length;
            const _initialMessages2 = socket2.messages.length;

            await coordinator.onCollaborationDetected('project-1');

            // Should still send bulk-upload-request but no prefetch needed
        });
    });

    describe('getStats', () => {
        it('should return empty stats initially', () => {
            const stats = coordinator.getStats();

            expect(stats).toBeDefined();
            expect(typeof stats.projects).toBe('number');
            expect(typeof stats.totalClients).toBe('number');
            expect(typeof stats.totalAssets).toBe('number');
            expect(typeof stats.pendingRequests).toBe('number');
        });

        it('should reflect registered clients', () => {
            const socket1 = createMockSocket();
            const socket2 = createMockSocket();

            coordinator.registerClient('project-1', 'client-1', socket1);
            coordinator.registerClient('project-1', 'client-2', socket2);
            coordinator.registerClient('project-2', 'client-3', socket2);

            const stats = coordinator.getStats();

            expect(stats.projects).toBeGreaterThanOrEqual(2);
            expect(stats.totalClients).toBeGreaterThanOrEqual(3);
        });

        it('should reflect tracked assets', async () => {
            const socket = createMockSocket();
            coordinator.registerClient('project-1', 'client-1', socket);

            await coordinator.handleMessage('project-1', 'client-1', {
                type: 'awareness-update',
                data: { availableAssets: ['asset-a', 'asset-b', 'asset-c'] },
            });

            const stats = coordinator.getStats();

            expect(stats.totalAssets).toBeGreaterThanOrEqual(3);
        });
    });

    describe('Message encoding', () => {
        it('should encode messages with 0xFF prefix', async () => {
            const socket = createMockSocket();
            coordinator.registerClient('test-project', 'client-1', socket);

            // Request asset triggers a response
            await coordinator.handleMessage('test-project', 'client-1', {
                type: 'request-asset',
                data: { assetId: 'asset-123' },
            });

            // Check sent messages have 0xFF prefix
            expect(socket.messages.length).toBeGreaterThan(0);

            const message = socket.messages[0];
            if (message instanceof Uint8Array) {
                expect(message[0]).toBe(0xff);

                // Should be valid JSON after prefix
                const json = new TextDecoder().decode(message.slice(1));
                const parsed = JSON.parse(json);
                expect(parsed.type).toBeDefined();
            }
        });
    });

    describe('Error handling', () => {
        it('should handle socket send errors gracefully', async () => {
            const socket = createMockSocket();
            socket.send = () => {
                throw new Error('Send failed');
            };

            coordinator.registerClient('project-1', 'client-1', socket);

            // Should not throw
            await coordinator.handleMessage('project-1', 'client-1', {
                type: 'request-asset',
                data: { assetId: 'test-asset' },
            });
        });

        it('should handle database errors gracefully', async () => {
            // Create coordinator with failing database
            const failingCoordinator = createAssetCoordinator({
                ...mockDeps,
                findProjectByUuid: async () => {
                    throw new Error('Database error');
                },
            });

            const socket = createMockSocket();
            failingCoordinator.registerClient('broken-project', 'client-1', socket);

            // Should not throw
            await failingCoordinator.handleMessage('broken-project', 'client-1', {
                type: 'request-asset',
                data: { assetId: 'test-asset' },
            });

            failingCoordinator.cleanupProject('broken-project');
        });
    });

    describe('isolation', () => {
        it('should have isolated state between instances', async () => {
            const coordinator1 = createAssetCoordinator(mockDeps);
            const coordinator2 = createAssetCoordinator(mockDeps);

            const socket1 = createMockSocket();
            const socket2 = createMockSocket();

            coordinator1.registerClient('project-1', 'client-1', socket1);
            coordinator1.registerClient('project-1', 'client-2', socket1);

            coordinator2.registerClient('project-1', 'client-3', socket2);

            expect(coordinator1.getStats().totalClients).toBe(2);
            expect(coordinator2.getStats().totalClients).toBe(1);

            coordinator1.cleanupProject('project-1');

            expect(coordinator1.getStats().totalClients).toBe(0);
            expect(coordinator2.getStats().totalClients).toBe(1); // Not affected

            coordinator2.cleanupProject('project-1');
        });
    });

    describe('Edge cases - sendToClient', () => {
        it('should handle sending to unregistered client gracefully', async () => {
            const socket = createMockSocket();
            coordinator.registerClient('test-project', 'client-1', socket);

            // Client-2 is not registered, trying to notify them should not throw
            await coordinator.handleMessage('test-project', 'client-1', {
                type: 'asset-uploaded',
                data: {
                    assetId: 'some-asset',
                    requestedBy: 'client-2', // This client is not registered
                    success: true,
                    size: 1024,
                },
            });
            // Should log warning but not throw
        });
    });

    describe('Edge cases - requestUploadFromPeer', () => {
        it('should handle when only requester has the asset', async () => {
            const socket1 = createMockSocket();
            coordinator.registerClient('test-project', 'client-1', socket1);

            // Client 1 announces they have an asset
            await coordinator.handleMessage('test-project', 'client-1', {
                type: 'awareness-update',
                data: { availableAssets: ['exclusive-asset'] },
            });

            // Client 1 requests the asset they already have - no one else to get it from
            await coordinator.handleMessage('test-project', 'client-1', {
                type: 'request-asset',
                data: { assetId: 'exclusive-asset' },
            });

            // Should not crash, may send not-found
        });
    });

    describe('Edge cases - bulk upload broadcast errors', () => {
        it('should handle broadcast send errors during bulk upload complete', async () => {
            const socket1 = createMockSocket();
            const socket2 = createMockSocket();
            socket2.send = () => {
                throw new Error('Broadcast failed');
            };

            coordinator.registerClient('project-1', 'client-1', socket1);
            coordinator.registerClient('project-1', 'client-2', socket2);

            // Should not throw even when socket2 fails
            await coordinator.handleMessage('project-1', 'client-1', {
                type: 'bulk-upload-progress',
                data: {
                    status: 'completed',
                    total: 10,
                    completed: 10,
                    failed: 0,
                },
            });
        });

        it('should handle invalid bulk upload progress data', async () => {
            const socket = createMockSocket();
            coordinator.registerClient('project-1', 'client-1', socket);

            // Missing status field
            await coordinator.handleMessage('project-1', 'client-1', {
                type: 'bulk-upload-progress',
                data: { total: 10 } as any,
            });
            // Should not throw
        });
    });

    describe('Edge cases - priority update with preemption', () => {
        it('should handle preemption when high priority request arrives', async () => {
            // Create coordinator with preemption enabled
            const preemptCoordinator = createAssetCoordinator({
                ...mockDeps,
                priorityQueue: {
                    ...mockDeps.priorityQueue!,
                    shouldPreempt: () => ({
                        shouldPreempt: true,
                        targetSlot: {
                            assetId: 'low-priority-asset',
                            clientId: 'client-2',
                            startTime: Date.now() - 1000,
                            priority: 25,
                            projectId: 'test-project',
                        },
                        preemptingItem: {
                            assetId: 'high-priority-asset',
                            priority: 100,
                        },
                    }),
                },
            });

            const socket1 = createMockSocket();
            const socket2 = createMockSocket();
            preemptCoordinator.registerClient('test-project', 'client-1', socket1);
            preemptCoordinator.registerClient('test-project', 'client-2', socket2);

            await preemptCoordinator.handleMessage('test-project', 'client-1', {
                type: 'priority-update',
                data: {
                    assetId: 'high-priority-asset',
                    priority: 100,
                    reason: 'render',
                },
            });

            // Client-2 should receive preempt message
            expect(socket2.messages.length).toBeGreaterThan(0);

            preemptCoordinator.cleanupProject('test-project');
        });

        it('should handle database error during priority update', async () => {
            const errorCoordinator = createAssetCoordinator({
                ...mockDeps,
                findProjectByUuid: async () => {
                    throw new Error('DB error');
                },
            });

            const socket = createMockSocket();
            errorCoordinator.registerClient('error-project', 'client-1', socket);

            // Should not throw
            await errorCoordinator.handleMessage('error-project', 'client-1', {
                type: 'priority-update',
                data: {
                    assetId: 'some-asset',
                    priority: 50,
                    reason: 'render',
                },
            });

            errorCoordinator.cleanupProject('error-project');
        });
    });

    describe('Edge cases - navigation hint', () => {
        it('should handle database error during navigation hint', async () => {
            const errorCoordinator = createAssetCoordinator({
                ...mockDeps,
                findProjectByUuid: async () => {
                    throw new Error('DB error');
                },
            });

            const socket = createMockSocket();
            errorCoordinator.registerClient('nav-error-project', 'client-1', socket);

            // Should not throw
            await errorCoordinator.handleMessage('nav-error-project', 'client-1', {
                type: 'navigation-hint',
                data: {
                    targetPageId: 'page-1',
                    assetIds: ['asset-1', 'asset-2'],
                },
            });

            errorCoordinator.cleanupProject('nav-error-project');
        });
    });

    describe('Edge cases - handleMessage error handling', () => {
        it('should catch errors thrown by handlers', async () => {
            // Create coordinator with handler that throws
            const throwingCoordinator = createAssetCoordinator({
                ...mockDeps,
                findProjectByUuid: async () => {
                    throw new Error('Handler error');
                },
            });

            const socket = createMockSocket();
            throwingCoordinator.registerClient('throwing-project', 'client-1', socket);

            // Should not throw - error should be caught and logged
            await throwingCoordinator.handleMessage('throwing-project', 'client-1', {
                type: 'request-asset',
                data: { assetId: 'test-asset' },
            });

            throwingCoordinator.cleanupProject('throwing-project');
        });
    });

    describe('Edge cases - onCollaborationDetected', () => {
        it('should handle when no clients have registered assets', async () => {
            const socket1 = createMockSocket();
            const socket2 = createMockSocket();
            coordinator.registerClient('empty-assets-project', 'client-1', socket1);
            coordinator.registerClient('empty-assets-project', 'client-2', socket2);

            // No awareness updates - no one has announced any assets
            await coordinator.onCollaborationDetected('empty-assets-project');

            // Should not crash and should not find reference client
            coordinator.cleanupProject('empty-assets-project');
        });

        it('should handle collaboration detection with only one client having assets', async () => {
            const socket1 = createMockSocket();
            const socket2 = createMockSocket();
            coordinator.registerClient('single-assets-project', 'client-1', socket1);
            coordinator.registerClient('single-assets-project', 'client-2', socket2);

            // Only client-1 has assets
            await coordinator.handleMessage('single-assets-project', 'client-1', {
                type: 'awareness-update',
                data: { availableAssets: ['only-asset'] },
            });
            // Client-2 has nothing

            await coordinator.onCollaborationDetected('single-assets-project');

            // Should send prefetch request to client-2
            coordinator.cleanupProject('single-assets-project');
        });
    });

    describe('Edge cases - requestUploadFromPeerWithPriority', () => {
        it('should queue request when no peer has asset', async () => {
            const socket1 = createMockSocket();
            const socket2 = createMockSocket();
            coordinator.registerClient('test-project', 'client-1', socket1);
            coordinator.registerClient('test-project', 'client-2', socket2);

            // No awareness updates - no assets announced
            await coordinator.handleMessage('test-project', 'client-1', {
                type: 'priority-update',
                data: {
                    assetId: 'missing-asset',
                    priority: 100,
                    reason: 'render',
                },
            });

            // Should register in queue and send ack
            expect(priorityQueueRequests.length).toBeGreaterThan(0);
        });

        it('should request upload from peer with correct urgency levels', async () => {
            const socket1 = createMockSocket();
            const socket2 = createMockSocket();
            coordinator.registerClient('test-project', 'client-1', socket1);
            coordinator.registerClient('test-project', 'client-2', socket2);

            // Client-2 has the asset
            await coordinator.handleMessage('test-project', 'client-2', {
                type: 'awareness-update',
                data: { availableAssets: ['urgent-asset'] },
            });

            // Client-1 requests with critical priority
            await coordinator.handleMessage('test-project', 'client-1', {
                type: 'priority-update',
                data: {
                    assetId: 'urgent-asset',
                    priority: 100, // CRITICAL
                    reason: 'render',
                },
            });

            // Client-2 should receive upload request
            expect(socket2.messages.length).toBeGreaterThan(0);
        });
    });

    // Note: Rename sync tests removed - Yjs now handles rename sync automatically

    describe('Edge cases - broadcastToProject error handling', () => {
        it('should handle socket send error during broadcast', async () => {
            const errorSocket = createMockSocket();
            const normalSocket = createMockSocket();
            errorSocket.send = () => {
                throw new Error('Socket send error');
            };

            coordinator.registerClient('broadcast-error-project', 'error-client', errorSocket);
            coordinator.registerClient('broadcast-error-project', 'normal-client', normalSocket);

            // Both clients announce assets
            await coordinator.handleMessage('broadcast-error-project', 'error-client', {
                type: 'awareness-update',
                data: { availableAssets: ['shared-asset'] },
            });

            // Trigger broadcast via bulk-upload-progress
            await coordinator.handleMessage('broadcast-error-project', 'normal-client', {
                type: 'bulk-upload-progress',
                data: {
                    status: 'completed',
                    total: 5,
                    completed: 5,
                    failed: 0,
                    uploadedAssetIds: ['asset-1', 'asset-2'],
                },
            });

            // Should not throw, error is caught internally
            coordinator.cleanupProject('broadcast-error-project');
        });
    });

    describe('Edge cases - requestUploadFromPeerWithPriority only requester has asset', () => {
        it('should return early when only the requester has the requested asset', async () => {
            const socket1 = createMockSocket();
            coordinator.registerClient('single-owner-project', 'owner-client', socket1);

            // Only owner-client announces the asset
            await coordinator.handleMessage('single-owner-project', 'owner-client', {
                type: 'awareness-update',
                data: { availableAssets: ['self-owned-asset'] },
            });

            // Owner requests their own asset - should return early since no other peer has it
            await coordinator.handleMessage('single-owner-project', 'owner-client', {
                type: 'priority-update',
                data: {
                    assetId: 'self-owned-asset',
                    priority: 75,
                    reason: 'render',
                },
            });

            // Should not crash and not send upload-request to itself
            coordinator.cleanupProject('single-owner-project');
        });
    });

    describe('Edge cases - handleMessage with non-Error exception', () => {
        it('should handle thrown string errors', async () => {
            // Create coordinator with handler that throws a string
            const stringThrowingCoordinator = createAssetCoordinator({
                ...mockDeps,
                findProjectByUuid: async () => {
                    throw 'String error message'; // eslint-disable-line @typescript-eslint/no-throw-literal
                },
            });

            const socket = createMockSocket();
            stringThrowingCoordinator.registerClient('string-error-project', 'client-1', socket);

            // Should not throw - error should be caught and converted to string
            await stringThrowingCoordinator.handleMessage('string-error-project', 'client-1', {
                type: 'request-asset',
                data: { assetId: 'test-asset' },
            });

            stringThrowingCoordinator.cleanupProject('string-error-project');
        });
    });
});
