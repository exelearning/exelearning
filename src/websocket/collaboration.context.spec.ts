/**
 * Tests for CollaborationContext
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
    createCollaborationContext,
    createTestCollaborationContext,
    createMockPubSub,
    createMockPriorityQueue,
    configureAllModules,
    resetAllModules,
    getCollaborationContext,
    resetCollaborationContext,
} from './collaboration.context';
import { silentLogger, CapturingLogger } from '../contexts/logger.context';
import { createTestDb, destroyTestDb } from '../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';

describe('CollaborationContext', () => {
    describe('createCollaborationContext', () => {
        it('should create context with default values', () => {
            const ctx = createCollaborationContext();

            expect(ctx.db).toBeDefined();
            expect(ctx.logger).toBeDefined();
            expect(ctx.queries).toBeDefined();
            expect(ctx.yjsQueries).toBeDefined();
            expect(ctx.auth).toBeDefined();
            expect(ctx.sessionManager).toBeDefined();
            expect(ctx.priorityQueue).toBeDefined();
            expect(ctx.pubSub).toBeDefined();
        });

        it('should create frozen/immutable context', () => {
            const ctx = createCollaborationContext();

            expect(Object.isFrozen(ctx)).toBe(true);
        });

        it('should allow overriding db', async () => {
            const testDb = await createTestDb();
            try {
                const ctx = createCollaborationContext({ db: testDb });

                expect(ctx.db).toBe(testDb);
            } finally {
                await destroyTestDb(testDb);
            }
        });

        it('should allow overriding logger', () => {
            const ctx = createCollaborationContext({ logger: silentLogger });

            expect(ctx.logger).toBe(silentLogger);
        });

        it('should allow partial query overrides', () => {
            const mockFindProject = async () => undefined;
            const ctx = createCollaborationContext({
                queries: { findProjectByUuid: mockFindProject },
            });

            expect(ctx.queries.findProjectByUuid).toBe(mockFindProject);
            // Other queries should still have defaults
            expect(ctx.queries.checkProjectAccess).toBeDefined();
            expect(ctx.queries.markProjectAsSaved).toBeDefined();
        });

        it('should allow partial Yjs query overrides', () => {
            const mockSaveFullState = async () => {};
            const ctx = createCollaborationContext({
                yjsQueries: { saveFullState: mockSaveFullState },
            });

            expect(ctx.yjsQueries.saveFullState).toBe(mockSaveFullState);
            // Other queries should still have defaults
            expect(ctx.yjsQueries.loadDocumentState).toBeDefined();
        });

        it('should allow cleanupDelayOverride', () => {
            const ctx = createCollaborationContext({ cleanupDelayOverride: 100 });

            expect(ctx.cleanupDelayOverride).toBe(100);
        });

        it('should allow partial pubSub overrides', () => {
            const mockIsPubSubEnabled = () => true;
            const ctx = createCollaborationContext({
                pubSub: { isPubSubEnabled: mockIsPubSubEnabled },
            });

            expect(ctx.pubSub.isPubSubEnabled).toBe(mockIsPubSubEnabled);
            // Other pubSub methods should still have defaults
            expect(ctx.pubSub.publish).toBeDefined();
        });
    });

    describe('createTestCollaborationContext', () => {
        it('should create context with silent logger', () => {
            const ctx = createTestCollaborationContext();

            expect(ctx.logger).toBe(silentLogger);
        });

        it('should set cleanupDelayOverride to 0', () => {
            const ctx = createTestCollaborationContext();

            expect(ctx.cleanupDelayOverride).toBe(0);
        });

        it('should allow additional overrides', async () => {
            const testDb = await createTestDb();
            try {
                const ctx = createTestCollaborationContext({ db: testDb });

                expect(ctx.db).toBe(testDb);
                expect(ctx.logger).toBe(silentLogger);
                expect(ctx.cleanupDelayOverride).toBe(0);
            } finally {
                await destroyTestDb(testDb);
            }
        });
    });

    describe('createMockPubSub', () => {
        it('should create mock pub/sub service', () => {
            const mockPubSub = createMockPubSub();

            expect(mockPubSub.isPubSubEnabled()).toBe(false);
            expect(typeof mockPubSub.publish).toBe('function');
            expect(typeof mockPubSub.subscribe).toBe('function');
            expect(typeof mockPubSub.unsubscribe).toBe('function');
            expect(typeof mockPubSub.setMessageHandler).toBe('function');
        });

        it('should have no-op implementations', async () => {
            const mockPubSub = createMockPubSub();

            // These should not throw
            await mockPubSub.publish('test', Buffer.from('test'));
            await mockPubSub.subscribe('test');
            await mockPubSub.unsubscribe('test');
            mockPubSub.setMessageHandler(() => {});
        });
    });

    describe('createMockPriorityQueue', () => {
        it('should create mock priority queue service', () => {
            const mockQueue = createMockPriorityQueue();

            expect(typeof mockQueue.registerRequest).toBe('function');
            expect(typeof mockQueue.registerActiveSlot).toBe('function');
            expect(typeof mockQueue.releaseSlot).toBe('function');
            expect(typeof mockQueue.clearProject).toBe('function');
            expect(typeof mockQueue.shouldPreempt).toBe('function');
            expect(typeof mockQueue.getStats).toBe('function');
            expect(typeof mockQueue.peekNextUpload).toBe('function');
        });

        it('should return safe defaults', () => {
            const mockQueue = createMockPriorityQueue();

            expect(mockQueue.shouldPreempt('test')).toEqual({
                shouldPreempt: false,
                reason: 'mock',
            });
            expect(mockQueue.getStats('test')).toEqual({
                pending: [],
                active: [],
                pendingCount: 0,
                activeCount: 0,
            });
            expect(mockQueue.peekNextUpload('test')).toBeNull();
        });

        it('should have no-op implementations for mutations', () => {
            const mockQueue = createMockPriorityQueue();

            // These should not throw
            mockQueue.registerRequest({
                assetId: 'test',
                clientId: 'client',
                projectId: 'project',
                priority: 1,
                reason: 'test',
            });
            mockQueue.registerActiveSlot({
                assetId: 'test',
                clientId: 'client',
                projectId: 'project',
                priority: 1,
            });
            mockQueue.releaseSlot('project', 'test');
            mockQueue.clearProject('project');
        });
    });

    describe('configureAllModules / resetAllModules', () => {
        afterEach(() => {
            resetAllModules();
        });

        it('should configure all modules without error', () => {
            const ctx = createTestCollaborationContext();

            // Should not throw
            expect(() => configureAllModules(ctx)).not.toThrow();
        });

        it('should reset all modules without error', () => {
            const ctx = createTestCollaborationContext();
            configureAllModules(ctx);

            // Should not throw
            expect(() => resetAllModules()).not.toThrow();
        });
    });

    describe('getCollaborationContext / resetCollaborationContext', () => {
        afterEach(() => {
            resetCollaborationContext();
        });

        it('should return singleton context', () => {
            const ctx1 = getCollaborationContext();
            const ctx2 = getCollaborationContext();

            expect(ctx1).toBe(ctx2);
        });

        it('should create new context after reset', () => {
            const ctx1 = getCollaborationContext();
            resetCollaborationContext();
            const ctx2 = getCollaborationContext();

            expect(ctx1).not.toBe(ctx2);
        });
    });

    describe('Query interface completeness', () => {
        it('should have all common queries', () => {
            const ctx = createCollaborationContext();

            expect(ctx.queries.findProjectByUuid).toBeDefined();
            expect(ctx.queries.checkProjectAccess).toBeDefined();
            expect(ctx.queries.markProjectAsSaved).toBeDefined();
            expect(ctx.queries.findAssetByClientId).toBeDefined();
        });

        it('should have all Yjs persistence queries', () => {
            const ctx = createCollaborationContext();

            expect(ctx.yjsQueries.saveFullState).toBeDefined();
            expect(ctx.yjsQueries.loadDocumentState).toBeDefined();
            expect(ctx.yjsQueries.findUpdatesByProjectId).toBeDefined();
            expect(ctx.yjsQueries.findUpdatesSince).toBeDefined();
            expect(ctx.yjsQueries.deleteAllUpdates).toBeDefined();
            expect(ctx.yjsQueries.deleteUpdatesBefore).toBeDefined();
            expect(ctx.yjsQueries.countUpdates).toBeDefined();
            expect(ctx.yjsQueries.getLatestVersion).toBeDefined();
            expect(ctx.yjsQueries.getAllUpdateBuffers).toBeDefined();
            expect(ctx.yjsQueries.documentExists).toBeDefined();
            expect(ctx.yjsQueries.saveIncrementalUpdate).toBeDefined();
            expect(ctx.yjsQueries.loadDocumentWithUpdates).toBeDefined();
            expect(ctx.yjsQueries.upsertSnapshot).toBeDefined();
            expect(ctx.yjsQueries.deleteUpdatesUpToVersion).toBeDefined();
            expect(ctx.yjsQueries.findSnapshotByProjectId).toBeDefined();
        });
    });

    describe('Service interface completeness', () => {
        it('should have auth service', () => {
            const ctx = createCollaborationContext();

            expect(ctx.auth.verifyToken).toBeDefined();
        });

        it('should have session manager service', () => {
            const ctx = createCollaborationContext();

            expect(ctx.sessionManager.getSession).toBeDefined();
        });

        it('should have priority queue service', () => {
            const ctx = createCollaborationContext();

            expect(ctx.priorityQueue.registerRequest).toBeDefined();
            expect(ctx.priorityQueue.registerActiveSlot).toBeDefined();
            expect(ctx.priorityQueue.releaseSlot).toBeDefined();
            expect(ctx.priorityQueue.clearProject).toBeDefined();
            expect(ctx.priorityQueue.shouldPreempt).toBeDefined();
            expect(ctx.priorityQueue.getStats).toBeDefined();
            expect(ctx.priorityQueue.peekNextUpload).toBeDefined();
        });

        it('should have pub/sub service', () => {
            const ctx = createCollaborationContext();

            expect(ctx.pubSub.publish).toBeDefined();
            expect(ctx.pubSub.subscribe).toBeDefined();
            expect(ctx.pubSub.unsubscribe).toBeDefined();
            expect(ctx.pubSub.isPubSubEnabled).toBeDefined();
            expect(ctx.pubSub.setMessageHandler).toBeDefined();
        });
    });

    describe('Integration with test database', () => {
        let testDb: Kysely<Database>;

        beforeEach(async () => {
            testDb = await createTestDb();
        });

        afterEach(async () => {
            resetAllModules();
            await destroyTestDb(testDb);
        });

        it('should work with real test database', async () => {
            const ctx = createTestCollaborationContext({ db: testDb });

            expect(ctx.db).toBe(testDb);

            // Configure modules with the test context
            configureAllModules(ctx);

            // Modules should now use the test database
            // (actual functionality tested in individual module tests)
        });

        it('should allow using CapturingLogger for assertions', () => {
            const capturingLogger = new CapturingLogger();
            const ctx = createCollaborationContext({ logger: capturingLogger });

            expect(ctx.logger).toBe(capturingLogger);

            // Can use capturing logger to verify log calls
            capturingLogger.info('test message', { key: 'value' });
            expect(capturingLogger.logs).toHaveLength(1);
            expect(capturingLogger.logs[0]).toMatchObject({
                level: 'info',
                message: 'test message',
            });
        });
    });
});
