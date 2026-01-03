/**
 * AssetPriorityQueue Tests
 *
 * Unit tests for the binary max-heap priority queue for asset uploads.
 *
 * Run with: make test-frontend
 */

// Mock Logger BEFORE requiring AssetPriorityQueue
global.Logger = { log: vi.fn() };

const AssetPriorityQueue = require('./AssetPriorityQueue.js');

describe('AssetPriorityQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('static PRIORITY', () => {
    it('defines CRITICAL as 100', () => {
      expect(AssetPriorityQueue.PRIORITY.CRITICAL).toBe(100);
    });

    it('defines HIGH as 75', () => {
      expect(AssetPriorityQueue.PRIORITY.HIGH).toBe(75);
    });

    it('defines MEDIUM as 50', () => {
      expect(AssetPriorityQueue.PRIORITY.MEDIUM).toBe(50);
    });

    it('defines LOW as 25', () => {
      expect(AssetPriorityQueue.PRIORITY.LOW).toBe(25);
    });

    it('defines IDLE as 0', () => {
      expect(AssetPriorityQueue.PRIORITY.IDLE).toBe(0);
    });
  });

  describe('constructor', () => {
    it('sets projectId', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.projectId).toBe('project-123');
    });

    it('initializes empty heap', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.heap).toEqual([]);
    });

    it('initializes empty assetIndex map', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.assetIndex.size).toBe(0);
    });

    it('initializes empty inProgress map', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.inProgress.size).toBe(0);
    });

    it('initializes empty listeners set', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.listeners.size).toBe(0);
    });

    it('sets preemptionThreshold to 50', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.preemptionThreshold).toBe(50);
    });

    it('sets preemptionMinTime to 2000', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.preemptionMinTime).toBe(2000);
    });
  });

  describe('enqueue', () => {
    it('adds item to queue', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      expect(queue.size()).toBe(1);
    });

    it('returns true when adding new item', () => {
      const queue = new AssetPriorityQueue('project-123');
      const result = queue.enqueue('asset-1', 50);
      expect(result).toBe(true);
    });

    it('stores metadata', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50, { reason: 'render', pageId: 'page-1' });
      const item = queue.peek();
      expect(item.reason).toBe('render');
      expect(item.pageId).toBe('page-1');
    });

    it('sets default reason to save', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      expect(queue.peek().reason).toBe('save');
    });

    it('updates priority when new priority is higher', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.enqueue('asset-1', 75);
      expect(queue.getPriority('asset-1')).toBe(75);
    });

    it('does not update when new priority is lower', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 75);
      const result = queue.enqueue('asset-1', 50);
      expect(result).toBe(false);
      expect(queue.getPriority('asset-1')).toBe(75);
    });

    it('maintains max-heap property', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-low', 25);
      queue.enqueue('asset-high', 100);
      queue.enqueue('asset-medium', 50);

      expect(queue.peek().assetId).toBe('asset-high');
      expect(queue.peek().priority).toBe(100);
    });

    it('notifies listeners', () => {
      const queue = new AssetPriorityQueue('project-123');
      const listener = vi.fn();
      queue.onChange(listener);

      queue.enqueue('asset-1', 50);

      expect(listener).toHaveBeenCalledWith('enqueue', 'asset-1', 50, queue);
    });
  });

  describe('updatePriority', () => {
    it('updates existing item priority', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.updatePriority('asset-1', 75);
      expect(queue.getPriority('asset-1')).toBe(75);
    });

    it('returns true on success', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      const result = queue.updatePriority('asset-1', 75);
      expect(result).toBe(true);
    });

    it('returns false for non-existent item', () => {
      const queue = new AssetPriorityQueue('project-123');
      const result = queue.updatePriority('non-existent', 50);
      expect(result).toBe(false);
    });

    it('rebalances heap when priority increases', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 100);
      queue.enqueue('asset-2', 50);
      queue.updatePriority('asset-2', 150);
      expect(queue.peek().assetId).toBe('asset-2');
    });

    it('rebalances heap when priority decreases', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 100);
      queue.enqueue('asset-2', 50);
      queue.updatePriority('asset-1', 25);
      expect(queue.peek().assetId).toBe('asset-2');
    });
  });

  describe('peek', () => {
    it('returns highest priority item', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 25);
      queue.enqueue('asset-2', 100);
      queue.enqueue('asset-3', 50);

      const item = queue.peek();
      expect(item.assetId).toBe('asset-2');
      expect(item.priority).toBe(100);
    });

    it('does not remove item', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.peek();
      expect(queue.size()).toBe(1);
    });

    it('returns null for empty queue', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.peek()).toBeNull();
    });
  });

  describe('dequeue', () => {
    it('removes and returns highest priority item', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 25);
      queue.enqueue('asset-2', 100);

      const item = queue.dequeue();
      expect(item.assetId).toBe('asset-2');
      expect(queue.size()).toBe(1);
    });

    it('returns null for empty queue', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.dequeue()).toBeNull();
    });

    it('maintains heap property after removal', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 100);
      queue.enqueue('asset-2', 75);
      queue.enqueue('asset-3', 50);
      queue.enqueue('asset-4', 25);

      queue.dequeue(); // Remove 100
      expect(queue.peek().priority).toBe(75);

      queue.dequeue(); // Remove 75
      expect(queue.peek().priority).toBe(50);

      queue.dequeue(); // Remove 50
      expect(queue.peek().priority).toBe(25);
    });

    it('removes from assetIndex', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.dequeue();
      expect(queue.has('asset-1')).toBe(false);
    });
  });

  describe('remove', () => {
    it('removes specific item from queue', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.enqueue('asset-2', 75);

      queue.remove('asset-1');

      expect(queue.has('asset-1')).toBe(false);
      expect(queue.has('asset-2')).toBe(true);
    });

    it('returns true on success', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      expect(queue.remove('asset-1')).toBe(true);
    });

    it('returns false for non-existent item', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.remove('non-existent')).toBe(false);
    });
  });

  describe('getPriority', () => {
    it('returns priority for queued item', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 75);
      expect(queue.getPriority('asset-1')).toBe(75);
    });

    it('returns 0 for non-existent item', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.getPriority('non-existent')).toBe(0);
    });
  });

  describe('has', () => {
    it('returns true for queued item', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      expect(queue.has('asset-1')).toBe(true);
    });

    it('returns false for non-queued item', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.has('asset-1')).toBe(false);
    });
  });

  describe('size and isEmpty', () => {
    it('returns 0 for empty queue', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.size()).toBe(0);
    });

    it('returns correct count', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.enqueue('asset-2', 75);
      queue.enqueue('asset-3', 25);
      expect(queue.size()).toBe(3);
    });

    it('isEmpty returns true for empty queue', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.isEmpty()).toBe(true);
    });

    it('isEmpty returns false for non-empty queue', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      expect(queue.isEmpty()).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all items', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.enqueue('asset-2', 75);
      queue.clear();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    it('clears assetIndex', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.clear();
      expect(queue.assetIndex.size).toBe(0);
    });
  });

  describe('markInProgress', () => {
    it('adds to inProgress map', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.markInProgress('asset-1');
      expect(queue.inProgress.has('asset-1')).toBe(true);
    });

    it('removes from queue', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.markInProgress('asset-1');
      expect(queue.has('asset-1')).toBe(false);
    });

    it('stores startTime', () => {
      const queue = new AssetPriorityQueue('project-123');
      const now = Date.now();
      queue.enqueue('asset-1', 50);
      queue.markInProgress('asset-1');
      const item = queue.inProgress.get('asset-1');
      expect(item.startTime).toBeGreaterThanOrEqual(now);
    });
  });

  describe('markCompleted', () => {
    it('removes from inProgress', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.markInProgress('asset-1');
      queue.markCompleted('asset-1');
      expect(queue.inProgress.has('asset-1')).toBe(false);
    });
  });

  describe('markFailed', () => {
    it('removes from inProgress', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.markInProgress('asset-1');
      queue.markFailed('asset-1');
      expect(queue.inProgress.has('asset-1')).toBe(false);
    });

    it('re-queues with LOW priority by default', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 100);
      queue.markInProgress('asset-1');
      queue.markFailed('asset-1');
      expect(queue.has('asset-1')).toBe(true);
      expect(queue.getPriority('asset-1')).toBe(AssetPriorityQueue.PRIORITY.LOW);
    });

    it('does not re-queue when requeue is false', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.markInProgress('asset-1');
      queue.markFailed('asset-1', false);
      expect(queue.has('asset-1')).toBe(false);
    });
  });

  describe('shouldPreempt', () => {
    it('returns false when asset not in progress', () => {
      const queue = new AssetPriorityQueue('project-123');
      const result = queue.shouldPreempt('asset-1');
      expect(result.shouldPreempt).toBe(false);
      expect(result.preemptingAsset).toBeNull();
    });

    it('returns false when queue is empty', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.inProgress.set('asset-1', { startTime: Date.now() - 3000, priority: 25 });
      const result = queue.shouldPreempt('asset-1');
      expect(result.shouldPreempt).toBe(false);
    });

    it('returns true when priority difference exceeds threshold', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.inProgress.set('asset-1', { startTime: Date.now() - 3000, priority: 25 });
      queue.enqueue('asset-2', 100);

      const result = queue.shouldPreempt('asset-1');
      expect(result.shouldPreempt).toBe(true);
      expect(result.preemptingAsset.assetId).toBe('asset-2');
    });
  });

  describe('abortUpload', () => {
    it('returns false for non-in-progress asset', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.abortUpload('asset-1')).toBe(false);
    });

    it('re-queues with LOW priority', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 100);
      queue.markInProgress('asset-1');
      queue.abortUpload('asset-1');
      expect(queue.getPriority('asset-1')).toBe(AssetPriorityQueue.PRIORITY.LOW);
    });
  });

  describe('getInProgressUploads', () => {
    it('returns array of in-progress items', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.enqueue('asset-2', 75);
      queue.markInProgress('asset-1');
      queue.markInProgress('asset-2');

      const uploads = queue.getInProgressUploads();
      expect(uploads).toHaveLength(2);
      expect(uploads.map((u) => u.assetId)).toContain('asset-1');
    });
  });

  describe('peekMultiple', () => {
    it('returns items sorted by priority', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 25);
      queue.enqueue('asset-2', 100);
      queue.enqueue('asset-3', 50);

      const items = queue.peekMultiple(3);
      expect(items[0].priority).toBe(100);
      expect(items[1].priority).toBe(50);
      expect(items[2].priority).toBe(25);
    });
  });

  describe('enqueueMultiple', () => {
    it('adds all items to queue', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueueMultiple([
        { assetId: 'asset-1', priority: 50 },
        { assetId: 'asset-2', priority: 75 },
      ]);
      expect(queue.size()).toBe(2);
    });
  });

  describe('getByPriorityTier', () => {
    it('groups items by tier', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('critical', 100);
      queue.enqueue('high', 60);
      queue.enqueue('medium', 40);
      queue.enqueue('low', 10);
      queue.enqueue('idle', 0);

      const tiers = queue.getByPriorityTier();
      expect(tiers.critical).toHaveLength(1);
      expect(tiers.high).toHaveLength(1);
      expect(tiers.medium).toHaveLength(1);
      expect(tiers.low).toHaveLength(1);
      expect(tiers.idle).toHaveLength(1);
    });
  });

  describe('onChange', () => {
    it('adds listener', () => {
      const queue = new AssetPriorityQueue('project-123');
      const listener = vi.fn();
      queue.onChange(listener);
      expect(queue.listeners.has(listener)).toBe(true);
    });

    it('returns unsubscribe function', () => {
      const queue = new AssetPriorityQueue('project-123');
      const listener = vi.fn();
      const unsubscribe = queue.onChange(listener);
      unsubscribe();
      expect(queue.listeners.has(listener)).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('serializes queue state', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50, { reason: 'save', pageId: 'page-1' });

      const json = queue.toJSON();

      expect(json.projectId).toBe('project-123');
      expect(json.items).toHaveLength(1);
      expect(json.items[0].assetId).toBe('asset-1');
      expect(json.savedAt).toBeGreaterThan(0);
    });
  });

  describe('fromJSON', () => {
    it('restores queue state', () => {
      const queue = new AssetPriorityQueue('project-123');
      const data = {
        projectId: 'project-123',
        items: [
          { assetId: 'asset-1', priority: 50, reason: 'save' },
          { assetId: 'asset-2', priority: 75, reason: 'render' },
        ],
      };

      queue.fromJSON(data);

      expect(queue.size()).toBe(2);
      expect(queue.peek().assetId).toBe('asset-2');
    });

    it('returns false for mismatched projectId', () => {
      const queue = new AssetPriorityQueue('project-123');
      const data = { projectId: 'different-project', items: [] };
      expect(queue.fromJSON(data)).toBe(false);
    });

    it('returns false for null data', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.fromJSON(null)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('returns queue statistics', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('critical', 100);
      queue.enqueue('high', 60);
      queue.enqueue('inprogress', 75);
      queue.markInProgress('inprogress');

      const stats = queue.getStats();

      expect(stats.total).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.highestPriority).toBe(100);
    });

    it('returns 0 for highest priority when empty', () => {
      const queue = new AssetPriorityQueue('project-123');
      expect(queue.getStats().highestPriority).toBe(0);
    });
  });

  describe('heap operations', () => {
    it('maintains heap property with many operations', () => {
      const queue = new AssetPriorityQueue('project-123');

      const priorities = [50, 100, 25, 75, 10, 90, 60, 30];
      priorities.forEach((p, i) => queue.enqueue(`asset-${i}`, p));

      const extracted = [];
      while (!queue.isEmpty()) {
        extracted.push(queue.dequeue().priority);
      }

      expect(extracted).toEqual([100, 90, 75, 60, 50, 30, 25, 10]);
    });

    it('handles duplicate priorities', () => {
      const queue = new AssetPriorityQueue('project-123');
      queue.enqueue('asset-1', 50);
      queue.enqueue('asset-2', 50);
      queue.enqueue('asset-3', 50);

      expect(queue.size()).toBe(3);
      queue.dequeue();
      queue.dequeue();
      queue.dequeue();
      expect(queue.isEmpty()).toBe(true);
    });
  });
});
