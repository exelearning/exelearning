/**
 * Asset Priority Queue Unit Tests
 * Tests the REAL implementation - no mock.module()
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { ServerPriorityQueue, PRIORITY, type PriorityQueueItem } from './asset-priority-queue';

describe('ServerPriorityQueue', () => {
    let queue: ServerPriorityQueue;

    beforeEach(() => {
        // Create fresh instance for each test - complete isolation
        queue = new ServerPriorityQueue();
    });

    describe('registerRequest', () => {
        it('should add item to queue sorted by priority', () => {
            const projectId = 'proj-123';

            queue.registerRequest({
                projectId,
                assetId: 'low-asset',
                priority: PRIORITY.LOW,
                clientId: 'client-1',
                reason: 'save',
                requestedAt: Date.now(),
            });

            queue.registerRequest({
                projectId,
                assetId: 'high-asset',
                priority: PRIORITY.HIGH,
                clientId: 'client-1',
                reason: 'navigation',
                requestedAt: Date.now(),
            });

            const next = queue.peekNextUpload(projectId);
            expect(next?.assetId).toBe('high-asset');
        });

        it('should update priority if higher', () => {
            const projectId = 'proj-123';
            const assetId = 'asset-1';

            queue.registerRequest({
                projectId,
                assetId,
                priority: PRIORITY.LOW,
                clientId: 'client-1',
                reason: 'save',
                requestedAt: Date.now(),
            });

            queue.registerRequest({
                projectId,
                assetId,
                priority: PRIORITY.CRITICAL,
                clientId: 'client-1',
                reason: 'render',
                requestedAt: Date.now(),
            });

            const priority = queue.getPriority(projectId, assetId);
            expect(priority).toBe(PRIORITY.CRITICAL);
        });

        it('should NOT update priority if lower', () => {
            const projectId = 'proj-123';
            const assetId = 'asset-1';

            queue.registerRequest({
                projectId,
                assetId,
                priority: PRIORITY.HIGH,
                clientId: 'client-1',
                reason: 'navigation',
                requestedAt: Date.now(),
            });

            queue.registerRequest({
                projectId,
                assetId,
                priority: PRIORITY.LOW,
                clientId: 'client-1',
                reason: 'save',
                requestedAt: Date.now(),
            });

            const priority = queue.getPriority(projectId, assetId);
            expect(priority).toBe(PRIORITY.HIGH);
        });
    });

    describe('getNextUpload', () => {
        it('should return null for empty queue', () => {
            const next = queue.getNextUpload('non-existent');
            expect(next).toBeNull();
        });

        it('should return and remove highest priority item', () => {
            const projectId = 'proj-123';

            queue.registerRequest({
                projectId,
                assetId: 'asset-1',
                priority: PRIORITY.MEDIUM,
                clientId: 'client-1',
                reason: 'prefetch',
                requestedAt: Date.now(),
            });

            queue.registerRequest({
                projectId,
                assetId: 'asset-2',
                priority: PRIORITY.CRITICAL,
                clientId: 'client-1',
                reason: 'render',
                requestedAt: Date.now(),
            });

            const first = queue.getNextUpload(projectId);
            expect(first?.assetId).toBe('asset-2');

            const second = queue.getNextUpload(projectId);
            expect(second?.assetId).toBe('asset-1');

            const third = queue.getNextUpload(projectId);
            expect(third).toBeNull();
        });

        it('should return null when max concurrent uploads reached', () => {
            const projectId = 'proj-123';

            // Add items to queue
            for (let i = 0; i < 5; i++) {
                queue.registerRequest({
                    projectId,
                    assetId: `asset-${i}`,
                    priority: PRIORITY.HIGH,
                    clientId: 'client-1',
                    reason: 'navigation',
                    requestedAt: Date.now(),
                });
            }

            // Fill up active slots (default max is 3)
            for (let i = 0; i < 3; i++) {
                queue.registerActiveSlot({
                    projectId,
                    assetId: `active-${i}`,
                    clientId: 'client-1',
                    startTime: Date.now(),
                    priority: PRIORITY.MEDIUM,
                });
            }

            // Should return null because slots are full
            const next = queue.getNextUpload(projectId);
            expect(next).toBeNull();
        });
    });

    describe('shouldPreempt', () => {
        it('should NOT preempt when queue is empty', () => {
            const projectId = 'proj-123';

            queue.registerActiveSlot({
                projectId,
                assetId: 'active-1',
                clientId: 'client-1',
                startTime: Date.now() - 10000, // 10 seconds ago
                priority: PRIORITY.LOW,
            });

            const result = queue.shouldPreempt(projectId);
            expect(result.shouldPreempt).toBe(false);
        });

        it('should NOT preempt when no active slots', () => {
            const projectId = 'proj-123';

            queue.registerRequest({
                projectId,
                assetId: 'pending-1',
                priority: PRIORITY.CRITICAL,
                clientId: 'client-1',
                reason: 'render',
                requestedAt: Date.now(),
            });

            const result = queue.shouldPreempt(projectId);
            expect(result.shouldPreempt).toBe(false);
        });

        it('should preempt when priority difference >= 50 and time >= 2s', () => {
            const projectId = 'proj-123';

            // Add low priority active slot that started 3 seconds ago
            queue.registerActiveSlot({
                projectId,
                assetId: 'low-asset',
                clientId: 'client-1',
                startTime: Date.now() - 3000, // 3 seconds ago
                priority: PRIORITY.LOW, // 25
            });

            // Add critical priority request
            queue.registerRequest({
                projectId,
                assetId: 'critical-asset',
                priority: PRIORITY.CRITICAL, // 100, diff = 75 >= 50
                clientId: 'client-2',
                reason: 'render',
                requestedAt: Date.now(),
            });

            const result = queue.shouldPreempt(projectId);
            expect(result.shouldPreempt).toBe(true);
            expect(result.targetSlot?.assetId).toBe('low-asset');
            expect(result.preemptingItem?.assetId).toBe('critical-asset');
        });

        it('should NOT preempt when priority difference < 50', () => {
            const projectId = 'proj-123';

            // Add medium priority active slot
            queue.registerActiveSlot({
                projectId,
                assetId: 'medium-asset',
                clientId: 'client-1',
                startTime: Date.now() - 5000, // 5 seconds ago
                priority: PRIORITY.MEDIUM, // 50
            });

            // Add high priority request (diff = 75 - 50 = 25 < 50)
            queue.registerRequest({
                projectId,
                assetId: 'high-asset',
                priority: PRIORITY.HIGH, // 75
                clientId: 'client-2',
                reason: 'navigation',
                requestedAt: Date.now(),
            });

            const result = queue.shouldPreempt(projectId);
            expect(result.shouldPreempt).toBe(false);
        });

        it('should NOT preempt when upload is too recent (< 2s)', () => {
            const projectId = 'proj-123';

            // Add low priority active slot that just started
            queue.registerActiveSlot({
                projectId,
                assetId: 'low-asset',
                clientId: 'client-1',
                startTime: Date.now() - 500, // 0.5 seconds ago
                priority: PRIORITY.LOW,
            });

            // Add critical priority request
            queue.registerRequest({
                projectId,
                assetId: 'critical-asset',
                priority: PRIORITY.CRITICAL,
                clientId: 'client-2',
                reason: 'render',
                requestedAt: Date.now(),
            });

            const result = queue.shouldPreempt(projectId);
            expect(result.shouldPreempt).toBe(false);
        });

        it('should check specific asset when assetId provided', () => {
            const projectId = 'proj-123';

            // Add two active slots
            queue.registerActiveSlot({
                projectId,
                assetId: 'low-asset',
                clientId: 'client-1',
                startTime: Date.now() - 5000,
                priority: PRIORITY.LOW,
            });

            queue.registerActiveSlot({
                projectId,
                assetId: 'high-asset',
                clientId: 'client-1',
                startTime: Date.now() - 5000,
                priority: PRIORITY.HIGH,
            });

            // Add critical priority request
            queue.registerRequest({
                projectId,
                assetId: 'critical-asset',
                priority: PRIORITY.CRITICAL,
                clientId: 'client-2',
                reason: 'render',
                requestedAt: Date.now(),
            });

            // Check if high-asset should be preempted (diff = 100 - 75 = 25 < 50)
            const result1 = queue.shouldPreempt(projectId, 'high-asset');
            expect(result1.shouldPreempt).toBe(false);

            // Check if low-asset should be preempted (diff = 100 - 25 = 75 >= 50)
            const result2 = queue.shouldPreempt(projectId, 'low-asset');
            expect(result2.shouldPreempt).toBe(true);
        });
    });

    describe('slot management', () => {
        it('should register and release slots', () => {
            const projectId = 'proj-123';

            queue.registerActiveSlot({
                projectId,
                assetId: 'asset-1',
                clientId: 'client-1',
                startTime: Date.now(),
                priority: PRIORITY.HIGH,
            });

            expect(queue.getActiveSlotCount(projectId)).toBe(1);

            queue.releaseSlot(projectId, 'asset-1');
            expect(queue.getActiveSlotCount(projectId)).toBe(0);
        });

        it('should replace existing slot for same asset', () => {
            const projectId = 'proj-123';

            queue.registerActiveSlot({
                projectId,
                assetId: 'asset-1',
                clientId: 'client-1',
                startTime: Date.now() - 5000,
                priority: PRIORITY.LOW,
            });

            queue.registerActiveSlot({
                projectId,
                assetId: 'asset-1',
                clientId: 'client-1',
                startTime: Date.now(),
                priority: PRIORITY.HIGH,
            });

            expect(queue.getActiveSlotCount(projectId)).toBe(1);
            const slots = queue.getActiveSlots(projectId);
            expect(slots[0].priority).toBe(PRIORITY.HIGH);
        });

        it('should return undefined for releasing non-existent slot', () => {
            const result = queue.releaseSlot('non-existent', 'asset-1');
            expect(result).toBeUndefined();
        });
    });

    describe('queue operations', () => {
        it('should update priority', () => {
            const projectId = 'proj-123';

            queue.registerRequest({
                projectId,
                assetId: 'asset-1',
                priority: PRIORITY.LOW,
                clientId: 'client-1',
                reason: 'save',
                requestedAt: Date.now(),
            });

            const updated = queue.updatePriority(projectId, 'asset-1', PRIORITY.HIGH);
            expect(updated).toBe(true);
            expect(queue.getPriority(projectId, 'asset-1')).toBe(PRIORITY.HIGH);
        });

        it('should return false for updating non-existent asset', () => {
            const updated = queue.updatePriority('non-existent', 'asset-1', PRIORITY.HIGH);
            expect(updated).toBe(false);
        });

        it('should remove from queue', () => {
            const projectId = 'proj-123';

            queue.registerRequest({
                projectId,
                assetId: 'asset-1',
                priority: PRIORITY.HIGH,
                clientId: 'client-1',
                reason: 'navigation',
                requestedAt: Date.now(),
            });

            expect(queue.getQueueLength(projectId)).toBe(1);

            const removed = queue.removeFromQueue(projectId, 'asset-1');
            expect(removed).toBe(true);
            expect(queue.getQueueLength(projectId)).toBe(0);
        });

        it('should return false for removing non-existent asset', () => {
            const removed = queue.removeFromQueue('non-existent', 'asset-1');
            expect(removed).toBe(false);
        });

        it('should peek multiple items', () => {
            const projectId = 'proj-123';

            for (let i = 0; i < 5; i++) {
                queue.registerRequest({
                    projectId,
                    assetId: `asset-${i}`,
                    priority: PRIORITY.MEDIUM,
                    clientId: 'client-1',
                    reason: 'prefetch',
                    requestedAt: Date.now() + i,
                });
            }

            const items = queue.peekMultiple(projectId, 3);
            expect(items.length).toBe(3);
            // Queue length should remain unchanged
            expect(queue.getQueueLength(projectId)).toBe(5);
        });

        it('should return empty array for peekMultiple on non-existent project', () => {
            const items = queue.peekMultiple('non-existent', 3);
            expect(items).toEqual([]);
        });
    });

    describe('statistics', () => {
        it('should return correct stats', () => {
            const projectId = 'proj-123';

            // Add items to queue
            queue.registerRequest({
                projectId,
                assetId: 'high-asset',
                priority: PRIORITY.HIGH,
                clientId: 'client-1',
                reason: 'navigation',
                requestedAt: Date.now(),
            });

            queue.registerRequest({
                projectId,
                assetId: 'low-asset',
                priority: PRIORITY.LOW,
                clientId: 'client-1',
                reason: 'save',
                requestedAt: Date.now(),
            });

            // Add active slot
            queue.registerActiveSlot({
                projectId,
                assetId: 'active-asset',
                clientId: 'client-1',
                startTime: Date.now(),
                priority: PRIORITY.MEDIUM,
            });

            const stats = queue.getStats(projectId);
            expect(stats.queueLength).toBe(2);
            expect(stats.activeSlots).toBe(1);
            expect(stats.highestPriority).toBe(PRIORITY.HIGH);
            expect(stats.lowestActivePriority).toBe(PRIORITY.MEDIUM);
        });

        it('should return 0 for non-existent project priority', () => {
            expect(queue.getPriority('non-existent', 'asset-1')).toBe(0);
        });
    });

    describe('registerRequests (batch)', () => {
        it('should register multiple requests at once', () => {
            const projectId = 'proj-123';
            const items: PriorityQueueItem[] = [
                {
                    projectId,
                    assetId: 'asset-1',
                    priority: PRIORITY.HIGH,
                    clientId: 'client-1',
                    reason: 'navigation',
                    requestedAt: Date.now(),
                },
                {
                    projectId,
                    assetId: 'asset-2',
                    priority: PRIORITY.LOW,
                    clientId: 'client-1',
                    reason: 'save',
                    requestedAt: Date.now(),
                },
                {
                    projectId,
                    assetId: 'asset-3',
                    priority: PRIORITY.CRITICAL,
                    clientId: 'client-1',
                    reason: 'render',
                    requestedAt: Date.now(),
                },
            ];

            queue.registerRequests(items);

            expect(queue.getQueueLength(projectId)).toBe(3);
            // Highest priority should be first
            const next = queue.peekNextUpload(projectId);
            expect(next?.assetId).toBe('asset-3');
        });

        it('should handle empty array', () => {
            queue.registerRequests([]);
            // Should not throw and should have no effect
            expect(queue.getQueueLength('non-existent')).toBe(0);
        });
    });

    describe('getActiveProjects', () => {
        it('should return empty array when no projects', () => {
            const projects = queue.getActiveProjects();
            expect(projects).toEqual([]);
        });

        it('should return projects with queued items', () => {
            queue.registerRequest({
                projectId: 'proj-1',
                assetId: 'asset-1',
                priority: PRIORITY.HIGH,
                clientId: 'client-1',
                reason: 'navigation',
                requestedAt: Date.now(),
            });

            queue.registerRequest({
                projectId: 'proj-2',
                assetId: 'asset-2',
                priority: PRIORITY.LOW,
                clientId: 'client-1',
                reason: 'save',
                requestedAt: Date.now(),
            });

            const projects = queue.getActiveProjects();
            expect(projects).toContain('proj-1');
            expect(projects).toContain('proj-2');
            expect(projects.length).toBe(2);
        });

        it('should return projects with active slots', () => {
            queue.registerActiveSlot({
                projectId: 'proj-1',
                assetId: 'active-1',
                clientId: 'client-1',
                startTime: Date.now(),
                priority: PRIORITY.MEDIUM,
            });

            const projects = queue.getActiveProjects();
            expect(projects).toContain('proj-1');
        });

        it('should combine projects from both queues and slots', () => {
            queue.registerRequest({
                projectId: 'proj-queue',
                assetId: 'asset-1',
                priority: PRIORITY.HIGH,
                clientId: 'client-1',
                reason: 'navigation',
                requestedAt: Date.now(),
            });

            queue.registerActiveSlot({
                projectId: 'proj-slot',
                assetId: 'active-1',
                clientId: 'client-1',
                startTime: Date.now(),
                priority: PRIORITY.MEDIUM,
            });

            const projects = queue.getActiveProjects();
            expect(projects).toContain('proj-queue');
            expect(projects).toContain('proj-slot');
        });

        it('should not duplicate projects', () => {
            const projectId = 'proj-123';

            queue.registerRequest({
                projectId,
                assetId: 'asset-1',
                priority: PRIORITY.HIGH,
                clientId: 'client-1',
                reason: 'navigation',
                requestedAt: Date.now(),
            });

            queue.registerActiveSlot({
                projectId,
                assetId: 'active-1',
                clientId: 'client-1',
                startTime: Date.now(),
                priority: PRIORITY.MEDIUM,
            });

            const projects = queue.getActiveProjects();
            const projectCount = projects.filter(p => p === projectId).length;
            expect(projectCount).toBe(1);
        });
    });

    describe('cleanup', () => {
        it('should clear project data', () => {
            const projectId = 'proj-123';

            queue.registerRequest({
                projectId,
                assetId: 'asset-1',
                priority: PRIORITY.HIGH,
                clientId: 'client-1',
                reason: 'navigation',
                requestedAt: Date.now(),
            });

            queue.registerActiveSlot({
                projectId,
                assetId: 'active-1',
                clientId: 'client-1',
                startTime: Date.now(),
                priority: PRIORITY.MEDIUM,
            });

            queue.clearProject(projectId);

            expect(queue.getQueueLength(projectId)).toBe(0);
            expect(queue.getActiveSlotCount(projectId)).toBe(0);
        });

        it('should cleanup stale slots', () => {
            const projectId = 'proj-123';

            // Add a stale slot (older than 5 minutes)
            queue.registerActiveSlot({
                projectId,
                assetId: 'stale-asset',
                clientId: 'client-1',
                startTime: Date.now() - 6 * 60 * 1000, // 6 minutes ago
                priority: PRIORITY.LOW,
            });

            // Add a fresh slot
            queue.registerActiveSlot({
                projectId,
                assetId: 'fresh-asset',
                clientId: 'client-1',
                startTime: Date.now(),
                priority: PRIORITY.HIGH,
            });

            expect(queue.getActiveSlotCount(projectId)).toBe(2);

            queue.cleanupStaleSlots();

            expect(queue.getActiveSlotCount(projectId)).toBe(1);
            const slots = queue.getActiveSlots(projectId);
            expect(slots[0].assetId).toBe('fresh-asset');
        });

        it('should clear all data', () => {
            queue.registerRequest({
                projectId: 'proj-1',
                assetId: 'asset-1',
                priority: PRIORITY.HIGH,
                clientId: 'client-1',
                reason: 'navigation',
                requestedAt: Date.now(),
            });

            queue.registerActiveSlot({
                projectId: 'proj-2',
                assetId: 'active-1',
                clientId: 'client-1',
                startTime: Date.now(),
                priority: PRIORITY.MEDIUM,
            });

            queue.clear();

            expect(queue.getActiveProjects()).toEqual([]);
        });
    });

    describe('setMaxConcurrentUploads', () => {
        it('should set max concurrent uploads', () => {
            const projectId = 'proj-123';

            queue.setMaxConcurrentUploads(2);

            // Add items to queue
            for (let i = 0; i < 5; i++) {
                queue.registerRequest({
                    projectId,
                    assetId: `asset-${i}`,
                    priority: PRIORITY.HIGH,
                    clientId: 'client-1',
                    reason: 'navigation',
                    requestedAt: Date.now(),
                });
            }

            // Fill up 2 slots
            queue.registerActiveSlot({
                projectId,
                assetId: 'active-1',
                clientId: 'client-1',
                startTime: Date.now(),
                priority: PRIORITY.MEDIUM,
            });

            queue.registerActiveSlot({
                projectId,
                assetId: 'active-2',
                clientId: 'client-1',
                startTime: Date.now(),
                priority: PRIORITY.MEDIUM,
            });

            // Should return null because 2 slots (new max) are full
            const next = queue.getNextUpload(projectId);
            expect(next).toBeNull();
        });

        it('should ensure minimum of 1 concurrent upload', () => {
            queue.setMaxConcurrentUploads(0);

            const stats = queue.getStats('any');
            expect(stats.maxSlots).toBe(1);
        });
    });

    describe('isolation', () => {
        it('should have isolated state between instances', () => {
            const queue1 = new ServerPriorityQueue();
            const queue2 = new ServerPriorityQueue();

            queue1.registerRequest({
                projectId: 'proj-1',
                assetId: 'asset-1',
                priority: PRIORITY.HIGH,
                clientId: 'client-1',
                reason: 'navigation',
                requestedAt: Date.now(),
            });

            queue1.registerRequest({
                projectId: 'proj-1',
                assetId: 'asset-2',
                priority: PRIORITY.LOW,
                clientId: 'client-1',
                reason: 'save',
                requestedAt: Date.now(),
            });

            queue2.registerRequest({
                projectId: 'proj-1',
                assetId: 'asset-3',
                priority: PRIORITY.MEDIUM,
                clientId: 'client-1',
                reason: 'prefetch',
                requestedAt: Date.now(),
            });

            expect(queue1.getQueueLength('proj-1')).toBe(2);
            expect(queue2.getQueueLength('proj-1')).toBe(1);

            queue1.clear();

            expect(queue1.getQueueLength('proj-1')).toBe(0);
            expect(queue2.getQueueLength('proj-1')).toBe(1); // Not affected
        });
    });
});
