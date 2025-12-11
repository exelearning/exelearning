/**
 * AssetPriorityQueue
 *
 * Client-side priority queue for asset uploads using a binary max-heap.
 *
 * Priority Levels (higher = more urgent):
 *   100 - CRITICAL: Asset needed for current render (blocking UI)
 *   75  - HIGH: Asset on current page being viewed
 *   50  - MEDIUM: Asset on pages in navigation path
 *   25  - LOW: Background prefetch
 *   0   - IDLE: Normal upload during save
 *
 * Features:
 * - O(log n) insert/extract using binary heap
 * - Dynamic reprioritization without restart
 * - Support for preemption of in-progress uploads
 * - Change listeners for reactive updates
 */

class AssetPriorityQueue {
  /**
   * Priority levels
   */
  static PRIORITY = {
    CRITICAL: 100, // Blocking render
    HIGH: 75, // Current page
    MEDIUM: 50, // Adjacent pages
    LOW: 25, // Background
    IDLE: 0, // Normal save
  };

  /**
   * @param {string} projectId - Project UUID
   */
  constructor(projectId) {
    this.projectId = projectId;

    /**
     * Binary max-heap array
     * Each item: { assetId, priority, enqueuedAt, reason, pageId, metadata }
     * @type {Array<QueueItem>}
     */
    this.heap = [];

    /**
     * Index map for O(1) lookup: assetId -> heap index
     * @type {Map<string, number>}
     */
    this.assetIndex = new Map();

    /**
     * In-progress uploads: assetId -> { startTime, priority, abortController }
     * @type {Map<string, InProgressItem>}
     */
    this.inProgress = new Map();

    /**
     * Change listeners for reactive updates
     * @type {Set<Function>}
     */
    this.listeners = new Set();

    /**
     * Minimum priority difference required for preemption
     */
    this.preemptionThreshold = 50;

    /**
     * Minimum time (ms) before an upload can be preempted
     */
    this.preemptionMinTime = 2000;
  }

  /**
   * Add or update asset priority in the queue
   * @param {string} assetId - Asset UUID
   * @param {number} priority - Priority level (0-100)
   * @param {Object} metadata - Additional metadata
   * @param {string} metadata.reason - Why this priority ('render', 'navigation', 'prefetch', 'save')
   * @param {string} [metadata.pageId] - Associated page ID
   * @returns {boolean} True if added/updated, false if already at higher priority
   */
  enqueue(assetId, priority, metadata = {}) {
    const existingIndex = this.assetIndex.get(assetId);

    if (existingIndex !== undefined) {
      // Already in queue - only update if new priority is higher
      const existingPriority = this.heap[existingIndex].priority;
      if (priority > existingPriority) {
        return this.updatePriority(assetId, priority, metadata);
      }
      return false;
    }

    // Create new queue item
    const item = {
      assetId,
      priority,
      enqueuedAt: Date.now(),
      reason: metadata.reason || 'save',
      pageId: metadata.pageId || null,
      ...metadata,
    };

    // Add to heap
    this.heap.push(item);
    const index = this.heap.length - 1;
    this.assetIndex.set(assetId, index);

    // Restore heap property
    this._bubbleUp(index);

    // Notify listeners
    this._notifyChange('enqueue', assetId, priority);

    Logger.log(
      `[PriorityQueue] Enqueued ${assetId.substring(0, 8)}... priority=${priority} reason=${item.reason}`
    );
    return true;
  }

  /**
   * Update priority of an existing item
   * @param {string} assetId - Asset UUID
   * @param {number} newPriority - New priority level
   * @param {Object} [metadata] - Optional metadata updates
   * @returns {boolean} True if updated, false if not found
   */
  updatePriority(assetId, newPriority, metadata = {}) {
    const index = this.assetIndex.get(assetId);
    if (index === undefined) {
      return false;
    }

    const item = this.heap[index];
    const oldPriority = item.priority;

    // Update item
    item.priority = newPriority;
    item.updatedAt = Date.now();
    if (metadata.reason) item.reason = metadata.reason;
    if (metadata.pageId) item.pageId = metadata.pageId;
    Object.assign(item, metadata);

    // Rebalance heap
    if (newPriority > oldPriority) {
      this._bubbleUp(index);
    } else if (newPriority < oldPriority) {
      this._bubbleDown(index);
    }

    // Notify listeners
    this._notifyChange('update', assetId, newPriority);

    Logger.log(
      `[PriorityQueue] Updated ${assetId.substring(0, 8)}... priority=${oldPriority}→${newPriority}`
    );
    return true;
  }

  /**
   * Get highest priority item without removing
   * @returns {QueueItem|null}
   */
  peek() {
    return this.heap[0] || null;
  }

  /**
   * Remove and return highest priority item
   * @returns {QueueItem|null}
   */
  dequeue() {
    if (this.heap.length === 0) {
      return null;
    }

    const top = this.heap[0];
    const last = this.heap.pop();
    this.assetIndex.delete(top.assetId);

    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.assetIndex.set(last.assetId, 0);
      this._bubbleDown(0);
    }

    // Notify listeners
    this._notifyChange('dequeue', top.assetId, top.priority);

    Logger.log(
      `[PriorityQueue] Dequeued ${top.assetId.substring(0, 8)}... priority=${top.priority}`
    );
    return top;
  }

  /**
   * Remove specific asset from queue
   * @param {string} assetId - Asset UUID
   * @returns {boolean} True if removed
   */
  remove(assetId) {
    const index = this.assetIndex.get(assetId);
    if (index === undefined) {
      return false;
    }

    // Swap with last element and remove
    const lastIndex = this.heap.length - 1;
    if (index !== lastIndex) {
      this._swap(index, lastIndex);
      this.heap.pop();
      this.assetIndex.delete(assetId);

      // Rebalance
      if (index < this.heap.length) {
        this._bubbleUp(index);
        this._bubbleDown(index);
      }
    } else {
      this.heap.pop();
      this.assetIndex.delete(assetId);
    }

    this._notifyChange('remove', assetId, 0);
    return true;
  }

  /**
   * Get priority for an asset
   * @param {string} assetId - Asset UUID
   * @returns {number} Priority or 0 if not found
   */
  getPriority(assetId) {
    const index = this.assetIndex.get(assetId);
    if (index === undefined) {
      return 0;
    }
    return this.heap[index].priority;
  }

  /**
   * Check if asset is in queue
   * @param {string} assetId - Asset UUID
   * @returns {boolean}
   */
  has(assetId) {
    return this.assetIndex.has(assetId);
  }

  /**
   * Get queue size
   * @returns {number}
   */
  size() {
    return this.heap.length;
  }

  /**
   * Check if queue is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.heap.length === 0;
  }

  /**
   * Clear the queue
   */
  clear() {
    this.heap = [];
    this.assetIndex.clear();
    this._notifyChange('clear', null, 0);
  }

  // ==========================================
  // In-Progress Upload Management
  // ==========================================

  /**
   * Mark asset as in-progress (being uploaded)
   * @param {string} assetId - Asset UUID
   * @param {AbortController} [abortController] - For cancellation
   */
  markInProgress(assetId, abortController = null) {
    const priority = this.getPriority(assetId);

    this.inProgress.set(assetId, {
      startTime: Date.now(),
      priority,
      abortController,
    });

    // Remove from queue since it's now being processed
    this.remove(assetId);

    Logger.log(
      `[PriorityQueue] Marked in-progress: ${assetId.substring(0, 8)}... priority=${priority}`
    );
  }

  /**
   * Mark asset as completed (upload finished)
   * @param {string} assetId - Asset UUID
   */
  markCompleted(assetId) {
    this.inProgress.delete(assetId);
    Logger.log(`[PriorityQueue] Completed: ${assetId.substring(0, 8)}...`);
  }

  /**
   * Mark asset as failed (will be re-queued with lower priority)
   * @param {string} assetId - Asset UUID
   * @param {boolean} [requeue=true] - Whether to re-add to queue
   */
  markFailed(assetId, requeue = true) {
    const inProgressItem = this.inProgress.get(assetId);
    this.inProgress.delete(assetId);

    if (requeue) {
      // Re-queue with LOW priority
      this.enqueue(assetId, AssetPriorityQueue.PRIORITY.LOW, {
        reason: 'retry',
        previousPriority: inProgressItem?.priority,
      });
    }

    Logger.log(
      `[PriorityQueue] Failed: ${assetId.substring(0, 8)}... requeued=${requeue}`
    );
  }

  /**
   * Check if a higher priority asset should preempt a current upload
   * @param {string} currentAssetId - Asset currently being uploaded
   * @returns {{ shouldPreempt: boolean, preemptingAsset: QueueItem|null }}
   */
  shouldPreempt(currentAssetId) {
    const current = this.inProgress.get(currentAssetId);
    if (!current) {
      return { shouldPreempt: false, preemptingAsset: null };
    }

    const top = this.peek();
    if (!top) {
      return { shouldPreempt: false, preemptingAsset: null };
    }

    const elapsed = Date.now() - current.startTime;
    const priorityDiff = top.priority - current.priority;

    // Only preempt if:
    // 1. Priority difference is significant (>= threshold)
    // 2. Current upload has been running for minimum time
    const shouldPreempt =
      priorityDiff >= this.preemptionThreshold &&
      elapsed >= this.preemptionMinTime;

    if (shouldPreempt) {
      Logger.log(
        `[PriorityQueue] Preemption check: ${currentAssetId.substring(0, 8)}... ` +
          `(priority=${current.priority}, elapsed=${elapsed}ms) ` +
          `preempted by ${top.assetId.substring(0, 8)}... (priority=${top.priority})`
      );
    }

    return { shouldPreempt, preemptingAsset: shouldPreempt ? top : null };
  }

  /**
   * Abort an in-progress upload
   * @param {string} assetId - Asset UUID
   * @returns {boolean} True if aborted
   */
  abortUpload(assetId) {
    const inProgressItem = this.inProgress.get(assetId);
    if (!inProgressItem) {
      return false;
    }

    if (inProgressItem.abortController) {
      inProgressItem.abortController.abort();
    }

    // Re-queue with original or lower priority
    this.enqueue(assetId, AssetPriorityQueue.PRIORITY.LOW, {
      reason: 'preempted',
      previousPriority: inProgressItem.priority,
    });

    this.inProgress.delete(assetId);
    Logger.log(`[PriorityQueue] Aborted: ${assetId.substring(0, 8)}...`);
    return true;
  }

  /**
   * Get all in-progress uploads
   * @returns {Array<{assetId: string, startTime: number, priority: number}>}
   */
  getInProgressUploads() {
    return Array.from(this.inProgress.entries()).map(([assetId, item]) => ({
      assetId,
      startTime: item.startTime,
      priority: item.priority,
      elapsed: Date.now() - item.startTime,
    }));
  }

  // ==========================================
  // Batch Operations
  // ==========================================

  /**
   * Get multiple items by priority (without removing)
   * @param {number} count - Number of items to get
   * @returns {Array<QueueItem>}
   */
  peekMultiple(count) {
    // Create a copy and sort by priority (already sorted in heap order for top)
    const sorted = [...this.heap].sort((a, b) => b.priority - a.priority);
    return sorted.slice(0, count);
  }

  /**
   * Enqueue multiple assets at once
   * @param {Array<{assetId: string, priority: number, metadata?: Object}>} items
   */
  enqueueMultiple(items) {
    for (const item of items) {
      this.enqueue(item.assetId, item.priority, item.metadata || {});
    }
  }

  /**
   * Get all items grouped by priority tier
   * @returns {{ critical: QueueItem[], high: QueueItem[], medium: QueueItem[], low: QueueItem[], idle: QueueItem[] }}
   */
  getByPriorityTier() {
    const tiers = {
      critical: [], // >= 75
      high: [], // 50-74
      medium: [], // 25-49
      low: [], // 1-24
      idle: [], // 0
    };

    for (const item of this.heap) {
      if (item.priority >= 75) {
        tiers.critical.push(item);
      } else if (item.priority >= 50) {
        tiers.high.push(item);
      } else if (item.priority >= 25) {
        tiers.medium.push(item);
      } else if (item.priority > 0) {
        tiers.low.push(item);
      } else {
        tiers.idle.push(item);
      }
    }

    // Sort each tier by priority descending
    for (const tier of Object.values(tiers)) {
      tier.sort((a, b) => b.priority - a.priority);
    }

    return tiers;
  }

  // ==========================================
  // Listeners
  // ==========================================

  /**
   * Add change listener
   * @param {Function} callback - Called with (event, assetId, priority, queue)
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of a change
   * @param {string} event - Event type
   * @param {string|null} assetId - Affected asset
   * @param {number} priority - Priority value
   * @private
   */
  _notifyChange(event, assetId, priority) {
    for (const listener of this.listeners) {
      try {
        listener(event, assetId, priority, this);
      } catch (e) {
        console.error('[PriorityQueue] Listener error:', e);
      }
    }
  }

  // ==========================================
  // Serialization (for persistence)
  // ==========================================

  /**
   * Serialize queue state for persistence
   * @returns {Object}
   */
  toJSON() {
    return {
      projectId: this.projectId,
      items: this.heap.map((item) => ({
        assetId: item.assetId,
        priority: item.priority,
        reason: item.reason,
        pageId: item.pageId,
        enqueuedAt: item.enqueuedAt,
      })),
      inProgress: Array.from(this.inProgress.entries()).map(
        ([assetId, item]) => ({
          assetId,
          priority: item.priority,
          startTime: item.startTime,
        })
      ),
      savedAt: Date.now(),
    };
  }

  /**
   * Restore queue state from serialized data
   * @param {Object} data - Serialized state
   */
  fromJSON(data) {
    if (!data || data.projectId !== this.projectId) {
      return false;
    }

    // Clear current state
    this.clear();

    // Restore queued items
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        this.enqueue(item.assetId, item.priority, {
          reason: item.reason,
          pageId: item.pageId,
        });
      }
    }

    // Note: We don't restore in-progress items as they would need
    // to be restarted anyway after a page refresh

    Logger.log(
      `[PriorityQueue] Restored ${this.heap.length} items from saved state`
    );
    return true;
  }

  // ==========================================
  // Statistics
  // ==========================================

  /**
   * Get queue statistics
   * @returns {Object}
   */
  getStats() {
    const tiers = this.getByPriorityTier();
    return {
      total: this.heap.length,
      inProgress: this.inProgress.size,
      byTier: {
        critical: tiers.critical.length,
        high: tiers.high.length,
        medium: tiers.medium.length,
        low: tiers.low.length,
        idle: tiers.idle.length,
      },
      highestPriority: this.peek()?.priority || 0,
    };
  }

  // ==========================================
  // Binary Heap Operations (private)
  // ==========================================

  /**
   * Bubble up an element to restore heap property
   * @param {number} index - Starting index
   * @private
   */
  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      // Max-heap: parent should have higher or equal priority
      if (this.heap[parentIndex].priority >= this.heap[index].priority) {
        break;
      }

      this._swap(index, parentIndex);
      index = parentIndex;
    }
  }

  /**
   * Bubble down an element to restore heap property
   * @param {number} index - Starting index
   * @private
   */
  _bubbleDown(index) {
    const length = this.heap.length;

    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let largest = index;

      // Check left child
      if (
        leftChild < length &&
        this.heap[leftChild].priority > this.heap[largest].priority
      ) {
        largest = leftChild;
      }

      // Check right child
      if (
        rightChild < length &&
        this.heap[rightChild].priority > this.heap[largest].priority
      ) {
        largest = rightChild;
      }

      // If no swap needed, we're done
      if (largest === index) {
        break;
      }

      this._swap(index, largest);
      index = largest;
    }
  }

  /**
   * Swap two elements in the heap
   * @param {number} i - First index
   * @param {number} j - Second index
   * @private
   */
  _swap(i, j) {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;

    // Update index map
    this.assetIndex.set(this.heap[i].assetId, i);
    this.assetIndex.set(this.heap[j].assetId, j);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssetPriorityQueue;
} else {
  window.AssetPriorityQueue = AssetPriorityQueue;
}
