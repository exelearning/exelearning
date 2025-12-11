/**
 * Asset Priority Queue Service
 *
 * Server-side coordinator for managing asset upload priorities across clients.
 * Works in conjunction with WebSocket coordination to ensure efficient asset delivery.
 *
 * Priority Levels (higher = more urgent):
 *   100 - CRITICAL: Asset needed for current render (blocking UI)
 *   75  - HIGH: Asset on current page being viewed
 *   50  - MEDIUM: Asset on pages in navigation path
 *   25  - LOW: Background prefetch
 *   0   - IDLE: Normal upload during save
 */

export const PRIORITY = {
    CRITICAL: 100,
    HIGH: 75,
    MEDIUM: 50,
    LOW: 25,
    IDLE: 0,
} as const;

export type PriorityLevel = (typeof PRIORITY)[keyof typeof PRIORITY];

export type PriorityReason = 'render' | 'navigation' | 'prefetch' | 'save' | 'p2p-request' | 'retry';

/**
 * Priority queue item
 */
export interface PriorityQueueItem {
    assetId: string;
    clientId: string;
    priority: number;
    reason: PriorityReason;
    requestedAt: number;
    pageId?: string;
    projectId: string;
}

/**
 * Active upload slot
 */
export interface UploadSlot {
    assetId: string;
    clientId: string;
    startTime: number;
    priority: number;
    projectId: string;
}

/**
 * Preemption result
 */
export interface PreemptionResult {
    shouldPreempt: boolean;
    targetSlot?: UploadSlot;
    preemptingItem?: PriorityQueueItem;
    reason?: string;
}

/**
 * Server Priority Queue
 *
 * Manages upload priorities across all projects and clients.
 * Provides coordination for P2P asset sharing.
 */
class ServerPriorityQueue {
    /**
     * Priority queues by project: projectId -> sorted array of items
     */
    private queues: Map<string, PriorityQueueItem[]> = new Map();

    /**
     * Active upload slots by project: projectId -> array of slots
     */
    private activeSlots: Map<string, UploadSlot[]> = new Map();

    /**
     * Maximum concurrent uploads per project
     */
    private maxConcurrentUploads = 3;

    /**
     * Minimum priority difference for preemption
     */
    private preemptionThreshold = 50;

    /**
     * Minimum upload time (ms) before preemption is allowed
     */
    private preemptionMinTime = 2000;

    /**
     * Register a priority request from a client
     * @param item - Priority queue item
     */
    registerRequest(item: PriorityQueueItem): void {
        const { projectId, assetId, priority } = item;

        if (!this.queues.has(projectId)) {
            this.queues.set(projectId, []);
        }

        const queue = this.queues.get(projectId)!;
        const existingIdx = queue.findIndex(q => q.assetId === assetId);

        if (existingIdx >= 0) {
            // Update only if higher priority
            if (priority > queue[existingIdx].priority) {
                queue[existingIdx] = { ...queue[existingIdx], ...item };
                this.sortQueue(projectId);
            }
        } else {
            queue.push(item);
            this.sortQueue(projectId);
        }

        console.log(
            `[PriorityQueue] Registered: ${assetId.substring(0, 8)}... ` +
                `project=${projectId.substring(0, 8)}... priority=${priority} reason=${item.reason}`,
        );
    }

    /**
     * Register multiple priority requests at once
     * @param items - Array of priority items
     */
    registerRequests(items: PriorityQueueItem[]): void {
        for (const item of items) {
            this.registerRequest(item);
        }
    }

    /**
     * Get the next asset to upload for a project
     * @param projectId - Project UUID
     * @returns Next item or null if queue is empty
     */
    getNextUpload(projectId: string): PriorityQueueItem | null {
        const queue = this.queues.get(projectId);
        if (!queue || queue.length === 0) {
            return null;
        }

        // Check if we have available slots
        const activeCount = this.getActiveSlotCount(projectId);
        if (activeCount >= this.maxConcurrentUploads) {
            return null;
        }

        return queue.shift() || null;
    }

    /**
     * Peek at the next upload without removing it
     * @param projectId - Project UUID
     * @returns Next item or null
     */
    peekNextUpload(projectId: string): PriorityQueueItem | null {
        const queue = this.queues.get(projectId);
        return queue?.[0] || null;
    }

    /**
     * Get multiple pending items
     * @param projectId - Project UUID
     * @param count - Number of items to get
     * @returns Array of items
     */
    peekMultiple(projectId: string, count: number): PriorityQueueItem[] {
        const queue = this.queues.get(projectId);
        if (!queue) return [];
        return queue.slice(0, count);
    }

    /**
     * Remove an asset from the queue
     * @param projectId - Project UUID
     * @param assetId - Asset UUID
     * @returns True if removed
     */
    removeFromQueue(projectId: string, assetId: string): boolean {
        const queue = this.queues.get(projectId);
        if (!queue) return false;

        const idx = queue.findIndex(q => q.assetId === assetId);
        if (idx >= 0) {
            queue.splice(idx, 1);
            return true;
        }
        return false;
    }

    /**
     * Register an active upload slot
     * @param slot - Upload slot info
     */
    registerActiveSlot(slot: UploadSlot): void {
        const { projectId } = slot;

        if (!this.activeSlots.has(projectId)) {
            this.activeSlots.set(projectId, []);
        }

        const slots = this.activeSlots.get(projectId)!;

        // Remove existing slot for same asset if any
        const existingIdx = slots.findIndex(s => s.assetId === slot.assetId);
        if (existingIdx >= 0) {
            slots.splice(existingIdx, 1);
        }

        slots.push(slot);

        console.log(
            `[PriorityQueue] Active slot: ${slot.assetId.substring(0, 8)}... ` +
                `client=${slot.clientId.substring(0, 8)}... priority=${slot.priority}`,
        );
    }

    /**
     * Release an active upload slot
     * @param projectId - Project UUID
     * @param assetId - Asset UUID
     * @returns The released slot or undefined
     */
    releaseSlot(projectId: string, assetId: string): UploadSlot | undefined {
        const slots = this.activeSlots.get(projectId);
        if (!slots) return undefined;

        const idx = slots.findIndex(s => s.assetId === assetId);
        if (idx >= 0) {
            const [slot] = slots.splice(idx, 1);
            console.log(`[PriorityQueue] Released slot: ${assetId.substring(0, 8)}...`);
            return slot;
        }
        return undefined;
    }

    /**
     * Check if an upload should be preempted by a higher priority request
     * @param projectId - Project UUID
     * @param currentAssetId - Asset ID of current upload (optional, checks all if not provided)
     * @returns Preemption result
     */
    shouldPreempt(projectId: string, currentAssetId?: string): PreemptionResult {
        const queue = this.queues.get(projectId);
        const slots = this.activeSlots.get(projectId);

        if (!queue || queue.length === 0 || !slots || slots.length === 0) {
            return { shouldPreempt: false };
        }

        const topPriority = queue[0];
        const now = Date.now();

        // Find the lowest priority active slot that can be preempted
        let targetSlot: UploadSlot | undefined;

        for (const slot of slots) {
            // Skip if not checking a specific asset
            if (currentAssetId && slot.assetId !== currentAssetId) {
                continue;
            }

            const priorityDiff = topPriority.priority - slot.priority;
            const elapsed = now - slot.startTime;

            // Can preempt if priority diff is significant and has been running long enough
            if (priorityDiff >= this.preemptionThreshold && elapsed >= this.preemptionMinTime) {
                if (!targetSlot || slot.priority < targetSlot.priority) {
                    targetSlot = slot;
                }
            }
        }

        if (targetSlot) {
            return {
                shouldPreempt: true,
                targetSlot,
                preemptingItem: topPriority,
                reason: `Priority ${targetSlot.priority} preempted by ${topPriority.priority}`,
            };
        }

        return { shouldPreempt: false };
    }

    /**
     * Get number of active upload slots for a project
     * @param projectId - Project UUID
     * @returns Number of active slots
     */
    getActiveSlotCount(projectId: string): number {
        return this.activeSlots.get(projectId)?.length || 0;
    }

    /**
     * Get all active slots for a project
     * @param projectId - Project UUID
     * @returns Array of active slots
     */
    getActiveSlots(projectId: string): UploadSlot[] {
        return this.activeSlots.get(projectId) || [];
    }

    /**
     * Get queue length for a project
     * @param projectId - Project UUID
     * @returns Queue length
     */
    getQueueLength(projectId: string): number {
        return this.queues.get(projectId)?.length || 0;
    }

    /**
     * Get priority for an asset in the queue
     * @param projectId - Project UUID
     * @param assetId - Asset UUID
     * @returns Priority or 0 if not found
     */
    getPriority(projectId: string, assetId: string): number {
        const queue = this.queues.get(projectId);
        if (!queue) return 0;

        const item = queue.find(q => q.assetId === assetId);
        return item?.priority || 0;
    }

    /**
     * Update priority for an asset
     * @param projectId - Project UUID
     * @param assetId - Asset UUID
     * @param newPriority - New priority value
     * @returns True if updated
     */
    updatePriority(projectId: string, assetId: string, newPriority: number): boolean {
        const queue = this.queues.get(projectId);
        if (!queue) return false;

        const item = queue.find(q => q.assetId === assetId);
        if (!item) return false;

        item.priority = newPriority;
        this.sortQueue(projectId);
        return true;
    }

    /**
     * Get statistics for a project
     * @param projectId - Project UUID
     * @returns Statistics object
     */
    getStats(projectId: string): {
        queueLength: number;
        activeSlots: number;
        maxSlots: number;
        highestPriority: number;
        lowestActivePriority: number;
    } {
        const queue = this.queues.get(projectId) || [];
        const slots = this.activeSlots.get(projectId) || [];

        return {
            queueLength: queue.length,
            activeSlots: slots.length,
            maxSlots: this.maxConcurrentUploads,
            highestPriority: queue[0]?.priority || 0,
            lowestActivePriority: slots.length > 0 ? Math.min(...slots.map(s => s.priority)) : 0,
        };
    }

    /**
     * Clear all data for a project (e.g., when project closes)
     * @param projectId - Project UUID
     */
    clearProject(projectId: string): void {
        this.queues.delete(projectId);
        this.activeSlots.delete(projectId);
        console.log(`[PriorityQueue] Cleared project: ${projectId.substring(0, 8)}...`);
    }

    /**
     * Clear all data (for testing)
     */
    clear(): void {
        this.queues.clear();
        this.activeSlots.clear();
    }

    /**
     * Get all projects with active queues
     * @returns Array of project IDs
     */
    getActiveProjects(): string[] {
        const projects = new Set<string>();
        for (const projectId of this.queues.keys()) {
            projects.add(projectId);
        }
        for (const projectId of this.activeSlots.keys()) {
            projects.add(projectId);
        }
        return Array.from(projects);
    }

    /**
     * Set maximum concurrent uploads per project
     * @param max - Maximum concurrent uploads
     */
    setMaxConcurrentUploads(max: number): void {
        this.maxConcurrentUploads = Math.max(1, max);
    }

    /**
     * Sort queue by priority (descending) and request time (ascending)
     * @param projectId - Project UUID
     * @private
     */
    private sortQueue(projectId: string): void {
        const queue = this.queues.get(projectId);
        if (!queue) return;

        queue.sort((a, b) => {
            // Higher priority first
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            // Earlier request first (FIFO for same priority)
            return a.requestedAt - b.requestedAt;
        });
    }

    /**
     * Cleanup stale slots (uploads that have been running too long)
     * @param maxAge - Maximum age in milliseconds (default: 5 minutes)
     */
    cleanupStaleSlots(maxAge: number = 5 * 60 * 1000): void {
        const now = Date.now();

        for (const [projectId, slots] of this.activeSlots) {
            const staleSlots = slots.filter(s => now - s.startTime > maxAge);

            for (const slot of staleSlots) {
                console.log(
                    `[PriorityQueue] Cleaning stale slot: ${slot.assetId.substring(0, 8)}... ` +
                        `age=${Math.round((now - slot.startTime) / 1000)}s`,
                );
                this.releaseSlot(projectId, slot.assetId);
            }
        }
    }
}

// Singleton instance
export const serverPriorityQueue = new ServerPriorityQueue();

// Export class for testing
export { ServerPriorityQueue };

// Type aliases for AssetCoordinator compatibility
export type PriorityQueueRequest = PriorityQueueItem;
export type ActiveSlot = UploadSlot;
export type PreemptResult = PreemptionResult;
export type QueueStats = ReturnType<ServerPriorityQueue['getStats']>;
