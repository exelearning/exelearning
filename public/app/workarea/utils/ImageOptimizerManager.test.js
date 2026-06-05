import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ImageOptimizerManager, { STATUS } from './ImageOptimizerManager.js';

describe('ImageOptimizerManager', () => {
    let manager;
    let mockWorker;

    beforeEach(() => {
        // Mock window.eXeLearning
        window.eXeLearning = {
            basePath: '',
        };

        // Mock Worker - must be a regular function (not arrow) for 'new' to work
        mockWorker = {
            postMessage: vi.fn(),
            terminate: vi.fn(),
            addEventListener: vi.fn(),
            onmessage: null,
            onerror: null,
        };
        vi.stubGlobal('Worker', function MockWorker() {
            return mockWorker;
        });

        manager = new ImageOptimizerManager();
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        delete window.eXeLearning;
    });

    describe('constructor', () => {
        it('should initialize with default state', () => {
            expect(manager.queue.size).toBe(0);
            expect(manager.worker).toBeNull();
            expect(manager.workerReady).toBe(false);
            expect(manager.settings.preset).toBe('medium');
            expect(manager.settings.jpegQuality).toBe(0.85);
            expect(manager.isProcessing).toBe(false);
            expect(manager.cancelled).toBe(false);
        });

        it('should have null callbacks by default', () => {
            expect(manager.onAssetUpdate).toBeNull();
            expect(manager.onProgress).toBeNull();
            expect(manager.onEstimateComplete).toBeNull();
            expect(manager.onOptimizeComplete).toBeNull();
            expect(manager.onError).toBeNull();
        });
    });

    describe('STATUS constants', () => {
        it('should export correct status values', () => {
            expect(STATUS.PENDING).toBe('pending');
            expect(STATUS.ESTIMATING).toBe('estimating');
            expect(STATUS.READY).toBe('ready');
            expect(STATUS.OPTIMIZING).toBe('optimizing');
            expect(STATUS.DONE).toBe('done');
            expect(STATUS.FAILED).toBe('failed');
        });
    });

    describe('addAsset', () => {
        it('should add an asset to the queue', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            const metadata = { filename: 'test.png', mime: 'image/png', size: 1000 };

            manager.addAsset('asset-1', blob, metadata);

            expect(manager.queue.size).toBe(1);
            const item = manager.queue.get('asset-1');
            expect(item.assetId).toBe('asset-1');
            expect(item.filename).toBe('test.png');
            expect(item.mime).toBe('image/png');
            expect(item.status).toBe(STATUS.PENDING);
            expect(item.originalSize).toBe(1000);
            expect(item.estimatedSize).toBeNull();
            expect(item.optimizedSize).toBeNull();
            expect(item.optimizedBlob).toBeNull();
            expect(item.error).toBeNull();
        });

        it('should use blob size if metadata.size is not provided', () => {
            const blob = new Blob(['test data'], { type: 'image/png' });
            const metadata = { filename: 'test.png', mime: 'image/png' };

            manager.addAsset('asset-1', blob, metadata);

            const item = manager.queue.get('asset-1');
            expect(item.originalSize).toBe(blob.size);
        });

        it('should add multiple assets', () => {
            const blob1 = new Blob(['test1'], { type: 'image/png' });
            const blob2 = new Blob(['test2'], { type: 'image/jpeg' });

            manager.addAsset('asset-1', blob1, { filename: 'img1.png', mime: 'image/png' });
            manager.addAsset('asset-2', blob2, { filename: 'img2.jpg', mime: 'image/jpeg' });

            expect(manager.queue.size).toBe(2);
        });
    });

    describe('removeAsset', () => {
        it('should remove an asset from the queue', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png' });

            expect(manager.queue.size).toBe(1);
            manager.removeAsset('asset-1');
            expect(manager.queue.size).toBe(0);
        });

        it('should not throw when removing non-existent asset', () => {
            expect(() => manager.removeAsset('non-existent')).not.toThrow();
        });
    });

    describe('clearQueue', () => {
        it('should clear all assets from the queue', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test1.png', mime: 'image/png' });
            manager.addAsset('asset-2', blob, { filename: 'test2.png', mime: 'image/png' });

            expect(manager.queue.size).toBe(2);
            manager.clearQueue();
            expect(manager.queue.size).toBe(0);
        });
    });

    describe('getQueueItem', () => {
        it('should return the queue item for a given asset ID', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png' });

            const item = manager.getQueueItem('asset-1');
            expect(item).toBeDefined();
            expect(item.assetId).toBe('asset-1');
        });

        it('should return undefined for non-existent asset', () => {
            const item = manager.getQueueItem('non-existent');
            expect(item).toBeUndefined();
        });
    });

    describe('getAllItems', () => {
        it('should return all queue items as an array', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test1.png', mime: 'image/png' });
            manager.addAsset('asset-2', blob, { filename: 'test2.png', mime: 'image/png' });

            const items = manager.getAllItems();
            expect(items).toHaveLength(2);
            expect(items[0].assetId).toBe('asset-1');
            expect(items[1].assetId).toBe('asset-2');
        });

        it('should return empty array when queue is empty', () => {
            const items = manager.getAllItems();
            expect(items).toHaveLength(0);
        });
    });

    describe('setPreset', () => {
        it('should update preset and jpegQuality for light preset', () => {
            manager.setPreset('light');
            expect(manager.settings.preset).toBe('light');
            expect(manager.settings.jpegQuality).toBe(0.90);
        });

        it('should update preset and jpegQuality for medium preset', () => {
            manager.setPreset('strong'); // First set to something else
            manager.setPreset('medium');
            expect(manager.settings.preset).toBe('medium');
            expect(manager.settings.jpegQuality).toBe(0.85);
        });

        it('should update preset and jpegQuality for strong preset', () => {
            manager.setPreset('strong');
            expect(manager.settings.preset).toBe('strong');
            expect(manager.settings.jpegQuality).toBe(0.75);
        });

        it('should not update for invalid preset', () => {
            manager.setPreset('medium');
            manager.setPreset('invalid');
            expect(manager.settings.preset).toBe('medium');
            expect(manager.settings.jpegQuality).toBe(0.85);
        });
    });

    describe('setJpegQuality', () => {
        it('should set quality in 0-1 range', () => {
            manager.setJpegQuality(0.75);
            expect(manager.settings.jpegQuality).toBe(0.75);
        });

        it('should normalize quality from 0-100 range', () => {
            manager.setJpegQuality(75);
            expect(manager.settings.jpegQuality).toBe(0.75);
        });

        it('should handle edge case of quality = 1', () => {
            manager.setJpegQuality(1);
            expect(manager.settings.jpegQuality).toBe(1);
        });

        it('should handle quality = 100', () => {
            manager.setJpegQuality(100);
            expect(manager.settings.jpegQuality).toBe(1);
        });
    });

    describe('resetEstimates', () => {
        it('should reset READY items to PENDING and clear estimate data', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });
            const item = manager.queue.get('asset-1');
            item.status = STATUS.READY;
            item.estimatedSize = 750;
            item.hasAlpha = true;
            item.outputFormat = 'image/png';

            manager.resetEstimates();

            expect(item.status).toBe(STATUS.PENDING);
            expect(item.estimatedSize).toBeNull();
            expect(item.hasAlpha).toBeNull();
            expect(item.outputFormat).toBeNull();
            expect(item.error).toBeNull();
        });

        it('should reset FAILED items to PENDING', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });
            const item = manager.queue.get('asset-1');
            item.status = STATUS.FAILED;
            item.error = 'decode error';

            manager.resetEstimates();

            expect(item.status).toBe(STATUS.PENDING);
            expect(item.error).toBeNull();
        });

        it('should reset ESTIMATING items to PENDING', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });
            manager.queue.get('asset-1').status = STATUS.ESTIMATING;

            manager.resetEstimates();

            expect(manager.queue.get('asset-1').status).toBe(STATUS.PENDING);
        });

        it('should not reset DONE items', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });
            const item = manager.queue.get('asset-1');
            item.status = STATUS.DONE;
            item.optimizedSize = 600;

            manager.resetEstimates();

            expect(item.status).toBe(STATUS.DONE);
            expect(item.optimizedSize).toBe(600);
        });

        it('should not reset OPTIMIZING items', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });
            manager.queue.get('asset-1').status = STATUS.OPTIMIZING;

            manager.resetEstimates();

            expect(manager.queue.get('asset-1').status).toBe(STATUS.OPTIMIZING);
        });

        it('should not modify PENDING items', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });

            manager.resetEstimates();

            expect(manager.queue.get('asset-1').status).toBe(STATUS.PENDING);
        });

        it('should reset only non-final items in a mixed queue', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test1.png', mime: 'image/png', size: 1000 });
            manager.addAsset('asset-2', blob, { filename: 'test2.png', mime: 'image/png', size: 2000 });

            manager.queue.get('asset-1').status = STATUS.READY;
            manager.queue.get('asset-1').estimatedSize = 750;
            manager.queue.get('asset-2').status = STATUS.DONE;
            manager.queue.get('asset-2').optimizedSize = 1500;

            manager.resetEstimates();

            expect(manager.queue.get('asset-1').status).toBe(STATUS.PENDING);
            expect(manager.queue.get('asset-1').estimatedSize).toBeNull();
            expect(manager.queue.get('asset-2').status).toBe(STATUS.DONE);
            expect(manager.queue.get('asset-2').optimizedSize).toBe(1500);
        });
    });

    describe('getSettings', () => {
        it('should return a copy of current settings', () => {
            manager.setPreset('strong');
            manager.setJpegQuality(0.80);

            const settings = manager.getSettings();
            expect(settings.preset).toBe('strong');
            expect(settings.jpegQuality).toBe(0.80);
        });

        it('should return a copy, not the original object', () => {
            const settings = manager.getSettings();
            settings.preset = 'modified';

            expect(manager.settings.preset).toBe('medium');
        });
    });

    describe('cancel', () => {
        it('should set cancelled flag to true', () => {
            expect(manager.cancelled).toBe(false);
            manager.cancel();
            expect(manager.cancelled).toBe(true);
        });
    });

    describe('isInProgress', () => {
        it('should return false initially', () => {
            expect(manager.isInProgress()).toBe(false);
        });

        it('should return true when processing', () => {
            manager.isProcessing = true;
            expect(manager.isInProgress()).toBe(true);
        });
    });

    describe('terminateWorker', () => {
        it('should terminate worker and reset state', async () => {
            // Simulate worker initialization
            manager.worker = mockWorker;
            manager.workerReady = true;

            manager.terminateWorker();

            expect(mockWorker.terminate).toHaveBeenCalled();
            expect(manager.worker).toBeNull();
            expect(manager.workerReady).toBe(false);
        });

        it('should not throw when no worker exists', () => {
            expect(() => manager.terminateWorker()).not.toThrow();
        });
    });

    describe('getStats', () => {
        it('should return correct stats for empty queue', () => {
            const stats = manager.getStats();

            expect(stats).toEqual({
                total: 0,
                estimated: 0,
                optimized: 0,
                failed: 0,
                totalOriginal: 0,
                totalEstimated: 0,
                totalOptimized: 0,
                savings: 0,
                savingsPercent: 0,
            });
        });

        it('should count items by status', () => {
            const blob = new Blob(['test'], { type: 'image/png' });

            manager.addAsset('asset-1', blob, { filename: 'test1.png', mime: 'image/png', size: 1000 });
            manager.addAsset('asset-2', blob, { filename: 'test2.png', mime: 'image/png', size: 2000 });
            manager.addAsset('asset-3', blob, { filename: 'test3.png', mime: 'image/png', size: 3000 });

            // Manually set statuses
            manager.queue.get('asset-1').status = STATUS.READY;
            manager.queue.get('asset-1').estimatedSize = 800;

            manager.queue.get('asset-2').status = STATUS.DONE;
            manager.queue.get('asset-2').optimizedSize = 1500;

            manager.queue.get('asset-3').status = STATUS.FAILED;

            const stats = manager.getStats();

            expect(stats.total).toBe(3);
            expect(stats.estimated).toBe(1);
            expect(stats.optimized).toBe(1);
            expect(stats.failed).toBe(1);
            expect(stats.totalOriginal).toBe(6000);
            expect(stats.totalEstimated).toBe(800);
            expect(stats.totalOptimized).toBe(1500);
        });

        it('should calculate savings correctly when optimized', () => {
            const blob = new Blob(['test'], { type: 'image/png' });

            manager.addAsset('asset-1', blob, { filename: 'test1.png', mime: 'image/png', size: 1000 });
            manager.queue.get('asset-1').status = STATUS.DONE;
            manager.queue.get('asset-1').optimizedSize = 600;

            const stats = manager.getStats();

            expect(stats.savings).toBe(400);
            expect(stats.savingsPercent).toBe('40.0');
        });

        it('should calculate savings correctly when only estimated', () => {
            const blob = new Blob(['test'], { type: 'image/png' });

            manager.addAsset('asset-1', blob, { filename: 'test1.png', mime: 'image/png', size: 1000 });
            manager.queue.get('asset-1').status = STATUS.READY;
            manager.queue.get('asset-1').estimatedSize = 700;

            const stats = manager.getStats();

            expect(stats.savings).toBe(300);
            expect(stats.savingsPercent).toBe('30.0');
        });
    });

    describe('getStatsForSelection', () => {
        it('should return stats for selected assets only', () => {
            const blob = new Blob(['test'], { type: 'image/png' });

            manager.addAsset('asset-1', blob, { filename: 'test1.png', mime: 'image/png', size: 1000 });
            manager.addAsset('asset-2', blob, { filename: 'test2.png', mime: 'image/png', size: 2000 });
            manager.addAsset('asset-3', blob, { filename: 'test3.png', mime: 'image/png', size: 3000 });

            manager.queue.get('asset-1').estimatedSize = 800;
            manager.queue.get('asset-2').estimatedSize = 1600;

            const stats = manager.getStatsForSelection(['asset-1', 'asset-2']);

            expect(stats.selected).toBe(2);
            expect(stats.totalOriginal).toBe(3000);
            expect(stats.totalEstimated).toBe(2400);
            expect(stats.savings).toBe(600);
            expect(stats.savingsPercent).toBe('20.0');
        });

        it('should handle non-existent asset IDs', () => {
            const stats = manager.getStatsForSelection(['non-existent']);

            expect(stats.selected).toBe(1);
            expect(stats.totalOriginal).toBe(0);
            expect(stats.totalEstimated).toBe(0);
        });

        it('should return zero savings when no estimates available', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test1.png', mime: 'image/png', size: 1000 });

            const stats = manager.getStatsForSelection(['asset-1']);

            expect(stats.savings).toBe(0);
            expect(stats.savingsPercent).toBe(0);
        });
    });

    describe('handleWorkerMessage', () => {
        it('should ignore ready messages', () => {
            manager.handleWorkerMessage({ type: 'ready' });
            // Should not throw or log warning
        });

        it('should log warning for unknown assetId', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            manager.handleWorkerMessage({ type: 'estimated', assetId: 'unknown' });

            expect(warnSpy).toHaveBeenCalledWith('[ImageOptimizerManager] Unknown assetId: unknown');
            warnSpy.mockRestore();
        });

        it('should update item status for successful estimate', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });

            manager.handleWorkerMessage({
                type: 'estimated',
                assetId: 'asset-1',
                success: true,
                estimatedSize: 750,
                hasAlpha: true,
                outputFormat: 'image/png',
            });

            const item = manager.queue.get('asset-1');
            expect(item.status).toBe(STATUS.READY);
            expect(item.estimatedSize).toBe(750);
            expect(item.hasAlpha).toBe(true);
            expect(item.outputFormat).toBe('image/png');
        });

        it('should update item status for failed estimate', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });

            manager.handleWorkerMessage({
                type: 'estimated',
                assetId: 'asset-1',
                success: false,
                error: 'Decode failed',
            });

            const item = manager.queue.get('asset-1');
            expect(item.status).toBe(STATUS.FAILED);
            expect(item.error).toBe('Decode failed');
        });

        it('should update item status for successful optimize', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            const optimizedBlob = new Blob(['optimized'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });

            manager.handleWorkerMessage({
                type: 'optimized',
                assetId: 'asset-1',
                success: true,
                optimizedSize: 600,
                optimizedBlob: optimizedBlob,
                hasAlpha: false,
                outputFormat: 'image/jpeg',
            });

            const item = manager.queue.get('asset-1');
            expect(item.status).toBe(STATUS.DONE);
            expect(item.optimizedSize).toBe(600);
            expect(item.optimizedBlob).toBe(optimizedBlob);
            expect(item.hasAlpha).toBe(false);
            expect(item.outputFormat).toBe('image/jpeg');
        });

        it('should update item status for error message', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });

            const errorCallback = vi.fn();
            manager.onError = errorCallback;

            manager.handleWorkerMessage({
                type: 'error',
                assetId: 'asset-1',
                error: 'Worker error',
            });

            const item = manager.queue.get('asset-1');
            expect(item.status).toBe(STATUS.FAILED);
            expect(item.error).toBe('Worker error');
            expect(errorCallback).toHaveBeenCalledWith('asset-1', 'Worker error');
        });

        it('should call onAssetUpdate callback', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });

            const updateCallback = vi.fn();
            manager.onAssetUpdate = updateCallback;

            manager.handleWorkerMessage({
                type: 'estimated',
                assetId: 'asset-1',
                success: true,
                estimatedSize: 750,
            });

            expect(updateCallback).toHaveBeenCalled();
            expect(updateCallback).toHaveBeenCalledWith('asset-1', expect.objectContaining({
                assetId: 'asset-1',
                status: STATUS.READY,
            }));
        });

        it('should resolve pending promise', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 1000 });

            const resolveFn = vi.fn();
            manager.pendingMessages.set('asset-1', { resolve: resolveFn, reject: vi.fn() });

            manager.handleWorkerMessage({
                type: 'estimated',
                assetId: 'asset-1',
                success: true,
                estimatedSize: 750,
            });

            expect(resolveFn).toHaveBeenCalled();
            expect(manager.pendingMessages.has('asset-1')).toBe(false);
        });
    });

    describe('processItems', () => {
        it('should throw if already processing', async () => {
            manager.isProcessing = true;

            await expect(manager.processItems(['asset-1'], 'estimate', STATUS.ESTIMATING, 'estimate'))
                .rejects.toThrow('Already processing');
        });

        it('should skip non-existent assets', async () => {
            // Mock worker initialization
            manager.worker = mockWorker;
            manager.workerReady = true;

            const progressCallback = vi.fn();
            manager.onProgress = progressCallback;

            // Process non-existent asset - should complete without error
            await manager.processItems(['non-existent'], 'estimate', STATUS.ESTIMATING, 'estimate');

            expect(progressCallback).not.toHaveBeenCalled();
        });

        it('should stop processing when cancelled', async () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test1.png', mime: 'image/png' });
            manager.addAsset('asset-2', blob, { filename: 'test2.png', mime: 'image/png' });

            manager.worker = mockWorker;
            manager.workerReady = true;

            // Set up mock to simulate message response
            mockWorker.postMessage.mockImplementation(() => {
                manager.cancelled = true; // Cancel after first message
                manager.handleWorkerMessage({
                    type: 'estimated',
                    assetId: 'asset-1',
                    success: true,
                    estimatedSize: 500,
                });
            });

            await manager.processItems(['asset-1', 'asset-2'], 'estimate', STATUS.ESTIMATING, 'estimate');

            // Only asset-1 should have been processed before cancellation
            expect(manager.queue.get('asset-1').status).toBe(STATUS.READY);
            expect(manager.queue.get('asset-2').status).toBe(STATUS.PENDING);
        });

        it('should reset isProcessing flag after completion', async () => {
            manager.worker = mockWorker;
            manager.workerReady = true;

            await manager.processItems([], 'estimate', STATUS.ESTIMATING, 'estimate');

            expect(manager.isProcessing).toBe(false);
        });
    });

    describe('estimateSelected', () => {
        it('should call onEstimateComplete callback', async () => {
            manager.worker = mockWorker;
            manager.workerReady = true;

            const completeCallback = vi.fn();
            manager.onEstimateComplete = completeCallback;

            await manager.estimateSelected([]);

            expect(completeCallback).toHaveBeenCalled();
        });

        it('should return stats after estimation', async () => {
            manager.worker = mockWorker;
            manager.workerReady = true;

            const stats = await manager.estimateSelected([]);

            expect(stats).toHaveProperty('total');
            expect(stats).toHaveProperty('estimated');
            expect(stats).toHaveProperty('savings');
        });
    });

    describe('optimizeSelected', () => {
        it('should call onOptimizeComplete callback', async () => {
            manager.worker = mockWorker;
            manager.workerReady = true;

            const completeCallback = vi.fn();
            manager.onOptimizeComplete = completeCallback;

            await manager.optimizeSelected([]);

            expect(completeCallback).toHaveBeenCalled();
        });

        it('should return stats after optimization', async () => {
            manager.worker = mockWorker;
            manager.workerReady = true;

            const stats = await manager.optimizeSelected([]);

            expect(stats).toHaveProperty('total');
            expect(stats).toHaveProperty('optimized');
            expect(stats).toHaveProperty('savings');
        });
    });

    describe('processInWorker', () => {
        it('should initialize worker if not ready', async () => {
            mockWorker.addEventListener.mockImplementation((event, handler, options) => {
                if (event === 'message') {
                    setTimeout(() => handler({ data: { type: 'ready' } }), 0);
                }
            });

            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 100 });

            // Simulate worker response after postMessage
            mockWorker.postMessage.mockImplementation(() => {
                setTimeout(() => {
                    manager.handleWorkerMessage({
                        type: 'estimated',
                        assetId: 'asset-1',
                        success: true,
                        estimatedSize: 50,
                    });
                }, 0);
            });

            const result = await manager.processInWorker('estimate', 'asset-1', blob);

            expect(result.status).toBe(STATUS.READY);
        });

        it('should send message with correct settings', async () => {
            manager.worker = mockWorker;
            manager.workerReady = true;

            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 100 });
            manager.setPreset('strong');

            // Simulate worker response
            mockWorker.postMessage.mockImplementation(() => {
                setTimeout(() => {
                    manager.handleWorkerMessage({
                        type: 'estimated',
                        assetId: 'asset-1',
                        success: true,
                        estimatedSize: 50,
                    });
                }, 0);
            });

            await manager.processInWorker('estimate', 'asset-1', blob);

            expect(mockWorker.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'estimate',
                    assetId: 'asset-1',
                    settings: expect.objectContaining({
                        preset: 'strong',
                    }),
                })
            );
        });
    });

    describe('processItems with callbacks', () => {
        it('should call onProgress callback', async () => {
            const progressCallback = vi.fn();
            manager.onProgress = progressCallback;

            manager.worker = mockWorker;
            manager.workerReady = true;

            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 100 });

            // Simulate immediate worker response
            mockWorker.postMessage.mockImplementation(() => {
                manager.handleWorkerMessage({
                    type: 'estimated',
                    assetId: 'asset-1',
                    success: true,
                    estimatedSize: 50,
                });
            });

            await manager.processItems(['asset-1'], 'estimate', STATUS.ESTIMATING, 'estimate');

            expect(progressCallback).toHaveBeenCalledWith(1, 1, 'estimate');
        });

        it('should call onAssetUpdate during processing', async () => {
            const updateCallback = vi.fn();
            manager.onAssetUpdate = updateCallback;

            manager.worker = mockWorker;
            manager.workerReady = true;

            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 100 });

            // Simulate immediate worker response
            mockWorker.postMessage.mockImplementation(() => {
                manager.handleWorkerMessage({
                    type: 'estimated',
                    assetId: 'asset-1',
                    success: true,
                    estimatedSize: 50,
                });
            });

            await manager.processItems(['asset-1'], 'estimate', STATUS.ESTIMATING, 'estimate');

            // Called twice: once for status change to ESTIMATING, once for result
            expect(updateCallback).toHaveBeenCalled();
        });
    });

    describe('handleWorkerMessage error callback', () => {
        it('should call onError callback for error type', () => {
            const errorCallback = vi.fn();
            manager.onError = errorCallback;

            const blob = new Blob(['test'], { type: 'image/png' });
            manager.addAsset('asset-1', blob, { filename: 'test.png', mime: 'image/png', size: 100 });

            manager.handleWorkerMessage({
                type: 'error',
                assetId: 'asset-1',
                error: 'Processing failed',
            });

            expect(errorCallback).toHaveBeenCalledWith('asset-1', 'Processing failed');
        });
    });

    describe('initWorker', () => {
        let workerConstructorSpy;

        beforeEach(() => {
            workerConstructorSpy = vi.fn();
            vi.stubGlobal('Worker', function MockWorker(url) {
                workerConstructorSpy(url);
                return mockWorker;
            });
        });

        it('should not create new worker if already exists', async () => {
            manager.worker = mockWorker;

            await manager.initWorker();

            expect(workerConstructorSpy).not.toHaveBeenCalled();
        });

        it('should create worker with correct path', async () => {
            window.eXeLearning.basePath = '/custom';

            // Simulate ready message
            mockWorker.addEventListener.mockImplementation((event, handler, options) => {
                if (event === 'message') {
                    setTimeout(() => handler({ data: { type: 'ready' } }), 0);
                }
            });

            const promise = manager.initWorker();
            await promise;

            expect(workerConstructorSpy).toHaveBeenCalledWith('/custom/app/workarea/utils/ImageOptimizerWorker.js');
        });

        it('should derive basePath from pathname for static mode subdirectory deployments', async () => {
            // Simulate static mode where basePath is empty
            window.eXeLearning.basePath = '';

            // Mock window.location.pathname for subdirectory deployment
            const originalPathname = window.location.pathname;
            Object.defineProperty(window, 'location', {
                value: {
                    ...window.location,
                    pathname: '/pr-preview/pr-20/workarea',
                },
                configurable: true,
            });

            // Simulate ready message
            mockWorker.addEventListener.mockImplementation((event, handler, options) => {
                if (event === 'message') {
                    setTimeout(() => handler({ data: { type: 'ready' } }), 0);
                }
            });

            const promise = manager.initWorker();
            await promise;

            // Should derive path from pathname, removing /workarea
            expect(workerConstructorSpy).toHaveBeenCalledWith('/pr-preview/pr-20/app/workarea/utils/ImageOptimizerWorker.js');

            // Restore original pathname
            Object.defineProperty(window, 'location', {
                value: { ...window.location, pathname: originalPathname },
                configurable: true,
            });
        });

        it('should handle workarea.html pathname in static mode', async () => {
            window.eXeLearning.basePath = '';

            Object.defineProperty(window, 'location', {
                value: {
                    ...window.location,
                    pathname: '/subdir/workarea.html',
                },
                configurable: true,
            });

            mockWorker.addEventListener.mockImplementation((event, handler, options) => {
                if (event === 'message') {
                    setTimeout(() => handler({ data: { type: 'ready' } }), 0);
                }
            });

            const promise = manager.initWorker();
            await promise;

            expect(workerConstructorSpy).toHaveBeenCalledWith('/subdir/app/workarea/utils/ImageOptimizerWorker.js');
        });

        it('should reject on worker error', async () => {
            mockWorker.addEventListener.mockImplementation(() => {});

            const errorPromise = manager.initWorker();

            // Simulate worker error
            mockWorker.onerror({ message: 'Load failed' });

            await expect(errorPromise).rejects.toEqual(
                expect.objectContaining({ message: 'Load failed' })
            );
        });

        it('should call onError callback on worker error', async () => {
            const errorCallback = vi.fn();
            manager.onError = errorCallback;

            mockWorker.addEventListener.mockImplementation(() => {});

            const errorPromise = manager.initWorker().catch(() => {});

            mockWorker.onerror({ message: 'Load failed' });

            await errorPromise;

            expect(errorCallback).toHaveBeenCalledWith(null, 'Load failed');
        });
    });
});
