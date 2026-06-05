/**
 * Tests for Yjs Persistence Service
 * Uses Dependency Injection pattern - no mock.module needed
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as Y from 'yjs';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

import {
    configure,
    resetDependencies,
    saveFullState,
    loadDocument,
    loadUpdatesSince,
    loadAllUpdates,
    getLatestVersion,
    reconstructDocument,
    deleteAllUpdates,
    documentExists,
    pruneUpdatesBefore,
    saveFullStateByUuid,
    loadDocumentByUuid,
    forceFlush,
    saveIncrementalUpdate,
    saveIncrementalUpdateByUuid,
    compactToSnapshot,
    loadDocumentEfficient,
    loadDocumentEfficientByUuid,
    type YjsPersistenceQueries,
} from './yjs-persistence';

// Mock data storage
let mockSnapshots: Map<number, any>;
let mockUpdates: Map<number, any[]>;
let mockProjects: Map<string, any>;

// Mock database (not used but required by interface)
const mockDb = {} as Kysely<Database>;

// Create mock queries
function createMockQueries(): YjsPersistenceQueries {
    return {
        saveFullState: async (_db: any, projectId: number, buffer: Buffer, _clientId?: string) => {
            mockSnapshots.set(projectId, {
                project_id: projectId,
                snapshot_data: buffer,
                version: Date.now().toString(),
            });
        },
        loadDocumentState: async (_db: any, projectId: number) => {
            const snapshot = mockSnapshots.get(projectId);
            return snapshot?.snapshot_data || null;
        },
        findUpdatesByProjectId: async (_db: any, projectId: number) => {
            return mockUpdates.get(projectId) || [];
        },
        findUpdatesSince: async (_db: any, projectId: number, sinceVersion: string) => {
            const updates = mockUpdates.get(projectId) || [];
            return updates.filter(u => u.version > sinceVersion);
        },
        deleteAllUpdates: async (_db: any, projectId: number) => {
            mockUpdates.delete(projectId);
            mockSnapshots.delete(projectId);
        },
        deleteUpdatesBefore: async (_db: any, projectId: number, beforeVersion: string) => {
            const updates = mockUpdates.get(projectId) || [];
            mockUpdates.set(
                projectId,
                updates.filter(u => u.version >= beforeVersion),
            );
        },
        countUpdates: async (_db: any, projectId: number) => {
            return (mockUpdates.get(projectId) || []).length;
        },
        getLatestVersion: async (_db: any, projectId: number) => {
            const updates = mockUpdates.get(projectId) || [];
            if (updates.length === 0) return '0';
            return updates[updates.length - 1].version;
        },
        findProjectByUuid: async (_db: any, uuid: string) => mockProjects.get(uuid),
        markProjectAsSaved: async (_db: any, projectId: number) => {
            for (const project of mockProjects.values()) {
                if (project.id === projectId) {
                    project.saved_once = 1;
                }
            }
        },
        getAllUpdateBuffers: async (_db: any, projectId: number) => {
            const updates = mockUpdates.get(projectId) || [];
            return updates.map(u => u.update_data);
        },
        documentExists: async (_db: any, projectId: number) => {
            return mockSnapshots.has(projectId) || mockUpdates.has(projectId);
        },
        saveIncrementalUpdate: async (_db: any, projectId: number, update: Uint8Array, _clientId?: string) => {
            if (!mockUpdates.has(projectId)) {
                mockUpdates.set(projectId, []);
            }
            const updates = mockUpdates.get(projectId)!;
            updates.push({
                project_id: projectId,
                update_data: Buffer.from(update),
                version: Date.now().toString(),
            });
            return {
                compacted: updates.length >= 10, // Mock compaction threshold
                stats: {
                    count: updates.length,
                    totalBytes: updates.reduce((sum, u) => sum + u.update_data.length, 0),
                },
            };
        },
        loadDocumentWithUpdates: async (_db: any, projectId: number) => {
            return {
                snapshot: mockSnapshots.get(projectId) || null,
                updates: mockUpdates.get(projectId) || [],
            };
        },
        upsertSnapshot: async (_db: any, projectId: number, state: Uint8Array, version: string) => {
            mockSnapshots.set(projectId, {
                project_id: projectId,
                snapshot_data: Buffer.from(state),
                version,
            });
        },
        deleteUpdatesUpToVersion: async (_db: any, projectId: number, _version: string) => {
            mockUpdates.set(projectId, []);
        },
        findSnapshotByProjectId: async (_db: any, projectId: number) => {
            return mockSnapshots.get(projectId) || null;
        },
    };
}

describe('Yjs Persistence Service', () => {
    beforeEach(() => {
        mockSnapshots = new Map();
        mockUpdates = new Map();
        mockProjects = new Map();

        // Setup test project
        mockProjects.set('project-uuid-1', {
            id: 1,
            uuid: 'project-uuid-1',
            saved_once: 0,
        });

        // Configure dependencies with mocks
        configure({
            db: mockDb,
            queries: createMockQueries(),
        });
    });

    afterEach(() => {
        // Reset to default dependencies
        resetDependencies();
    });

    describe('saveFullState', () => {
        it('should save document state', async () => {
            const doc = new Y.Doc();
            doc.getText('content').insert(0, 'Hello World');
            const state = Y.encodeStateAsUpdate(doc);

            await saveFullState(1, state);

            expect(mockSnapshots.has(1)).toBe(true);
            const saved = mockSnapshots.get(1);
            expect(saved.snapshot_data.length).toBeGreaterThan(0);

            doc.destroy();
        });

        it('should save with client ID', async () => {
            const doc = new Y.Doc();
            const state = Y.encodeStateAsUpdate(doc);

            await saveFullState(1, state, 'client-123');

            expect(mockSnapshots.has(1)).toBe(true);
            doc.destroy();
        });
    });

    describe('loadDocument', () => {
        it('should load existing document state', async () => {
            const doc = new Y.Doc();
            doc.getText('content').insert(0, 'Test content');
            const state = Y.encodeStateAsUpdate(doc);

            await saveFullState(1, state);
            const loaded = await loadDocument(1);

            expect(loaded).not.toBeNull();
            expect(loaded!.length).toBeGreaterThan(0);

            // Verify content can be reconstructed
            const loadedDoc = new Y.Doc();
            Y.applyUpdate(loadedDoc, loaded!);
            expect(loadedDoc.getText('content').toString()).toBe('Test content');

            doc.destroy();
            loadedDoc.destroy();
        });

        it('should return null for non-existent document', async () => {
            const loaded = await loadDocument(999);
            expect(loaded).toBeNull();
        });
    });

    describe('loadUpdatesSince', () => {
        it('should return updates after version', async () => {
            mockUpdates.set(1, [
                { project_id: 1, update_data: Buffer.from([1, 2, 3]), version: '100' },
                { project_id: 1, update_data: Buffer.from([4, 5, 6]), version: '200' },
                { project_id: 1, update_data: Buffer.from([7, 8, 9]), version: '300' },
            ]);

            const updates = await loadUpdatesSince(1, '150');

            expect(updates.length).toBe(2);
        });

        it('should return all updates when version is 0', async () => {
            mockUpdates.set(1, [
                { project_id: 1, update_data: Buffer.from([1]), version: '100' },
                { project_id: 1, update_data: Buffer.from([2]), version: '200' },
            ]);

            const updates = await loadAllUpdates(1);

            expect(updates.length).toBe(2);
        });
    });

    describe('getLatestVersion', () => {
        it('should return latest version', async () => {
            mockUpdates.set(1, [
                { project_id: 1, update_data: Buffer.from([1]), version: '100' },
                { project_id: 1, update_data: Buffer.from([2]), version: '500' },
            ]);

            const version = await getLatestVersion(1);

            expect(version).toBe('500');
        });

        it('should return 0 when no updates', async () => {
            const version = await getLatestVersion(999);
            expect(version).toBe('0');
        });
    });

    describe('reconstructDocument', () => {
        it('should reconstruct Y.Doc from saved state', async () => {
            const originalDoc = new Y.Doc();
            originalDoc.getText('content').insert(0, 'Reconstructed');
            const state = Y.encodeStateAsUpdate(originalDoc);

            await saveFullState(1, state);
            const reconstructed = await reconstructDocument(1);

            expect(reconstructed.getText('content').toString()).toBe('Reconstructed');

            originalDoc.destroy();
            reconstructed.destroy();
        });

        it('should return empty doc when no data', async () => {
            const doc = await reconstructDocument(999);

            expect(doc.getText('content').toString()).toBe('');
            doc.destroy();
        });
    });

    describe('deleteAllUpdates', () => {
        it('should delete all updates for project', async () => {
            mockSnapshots.set(1, { project_id: 1, snapshot_data: Buffer.from([1, 2, 3]) });
            mockUpdates.set(1, [{ project_id: 1, update_data: Buffer.from([1]) }]);

            await deleteAllUpdates(1);

            expect(mockSnapshots.has(1)).toBe(false);
            expect(mockUpdates.has(1)).toBe(false);
        });
    });

    describe('documentExists', () => {
        it('should return true when document exists', async () => {
            mockSnapshots.set(1, { project_id: 1, snapshot_data: Buffer.from([1]) });

            const exists = await documentExists(1);

            expect(exists).toBe(true);
        });

        it('should return false when document does not exist', async () => {
            const exists = await documentExists(999);
            expect(exists).toBe(false);
        });
    });

    describe('pruneUpdatesBefore', () => {
        it('should delete updates before version', async () => {
            mockUpdates.set(1, [
                { project_id: 1, update_data: Buffer.from([1]), version: '100' },
                { project_id: 1, update_data: Buffer.from([2]), version: '200' },
                { project_id: 1, update_data: Buffer.from([3]), version: '300' },
            ]);

            await pruneUpdatesBefore(1, '200');

            const remaining = mockUpdates.get(1)!;
            expect(remaining.length).toBe(2);
            expect(remaining[0].version).toBe('200');
        });
    });

    describe('saveFullStateByUuid', () => {
        it('should save state by UUID', async () => {
            const doc = new Y.Doc();
            const state = Y.encodeStateAsUpdate(doc);

            const result = await saveFullStateByUuid('project-uuid-1', state);

            expect(result).toBe(true);
            expect(mockSnapshots.has(1)).toBe(true);

            doc.destroy();
        });

        it('should NOT mark project as saved (auto-persistence is not explicit save)', async () => {
            const doc = new Y.Doc();
            const state = Y.encodeStateAsUpdate(doc);

            // Project starts as unsaved
            const projectBefore = mockProjects.get('project-uuid-1');
            expect(projectBefore.saved_once).toBe(0);

            await saveFullStateByUuid('project-uuid-1', state);

            // Project should still be unsaved after Yjs persistence
            // Only explicit user save or collaboration should mark as saved
            const projectAfter = mockProjects.get('project-uuid-1');
            expect(projectAfter.saved_once).toBe(0);

            doc.destroy();
        });

        it('should return false for non-existent project', async () => {
            const result = await saveFullStateByUuid('non-existent', new Uint8Array(0));
            expect(result).toBe(false);
        });
    });

    describe('loadDocumentByUuid', () => {
        it('should load document by UUID', async () => {
            const doc = new Y.Doc();
            doc.getText('content').insert(0, 'UUID content');
            const state = Y.encodeStateAsUpdate(doc);

            await saveFullState(1, state);
            const loaded = await loadDocumentByUuid('project-uuid-1');

            expect(loaded).not.toBeNull();

            doc.destroy();
        });

        it('should return null for non-existent project', async () => {
            const loaded = await loadDocumentByUuid('non-existent');
            expect(loaded).toBeNull();
        });
    });

    describe('forceFlush', () => {
        it('should be a no-op', () => {
            // Should not throw
            forceFlush(1);
        });
    });

    describe('Incremental Updates', () => {
        describe('saveIncrementalUpdate', () => {
            it('should save incremental update', async () => {
                const doc = new Y.Doc();
                doc.getText('content').insert(0, 'Update');
                const update = Y.encodeStateAsUpdate(doc);

                const result = await saveIncrementalUpdate(1, update);

                expect(result.success).toBe(true);
                expect(result.bytesStored).toBeGreaterThan(0);

                doc.destroy();
            });
        });

        describe('saveIncrementalUpdateByUuid', () => {
            it('should save incremental update by UUID', async () => {
                const doc = new Y.Doc();
                const update = Y.encodeStateAsUpdate(doc);

                const result = await saveIncrementalUpdateByUuid('project-uuid-1', update);

                expect(result).not.toBeNull();
                expect(result!.success).toBe(true);

                doc.destroy();
            });

            it('should return null for non-existent project', async () => {
                const result = await saveIncrementalUpdateByUuid('non-existent', new Uint8Array(0));
                expect(result).toBeNull();
            });
        });

        describe('compactToSnapshot', () => {
            it('should compact updates into snapshot', async () => {
                // Add some updates
                mockUpdates.set(1, [
                    { project_id: 1, update_data: Y.encodeStateAsUpdate(new Y.Doc()), version: '100' },
                    { project_id: 1, update_data: Y.encodeStateAsUpdate(new Y.Doc()), version: '200' },
                ]);

                await compactToSnapshot(1);

                expect(mockSnapshots.has(1)).toBe(true);
                expect(mockUpdates.get(1)?.length || 0).toBe(0);
            });

            it('should do nothing when no data', async () => {
                await compactToSnapshot(999);

                expect(mockSnapshots.has(999)).toBe(false);
            });
        });

        describe('loadDocumentEfficient', () => {
            it('should load from snapshot only', async () => {
                const doc = new Y.Doc();
                doc.getText('content').insert(0, 'Snapshot');
                const state = Y.encodeStateAsUpdate(doc);

                mockSnapshots.set(1, {
                    project_id: 1,
                    snapshot_data: Buffer.from(state),
                });

                const loaded = await loadDocumentEfficient(1);

                expect(loaded).not.toBeNull();

                const loadedDoc = new Y.Doc();
                Y.applyUpdate(loadedDoc, loaded!);
                expect(loadedDoc.getText('content').toString()).toBe('Snapshot');

                doc.destroy();
                loadedDoc.destroy();
            });

            it('should merge snapshot and updates', async () => {
                // Create snapshot
                const snapshotDoc = new Y.Doc();
                snapshotDoc.getText('content').insert(0, 'Base');
                const snapshotState = Y.encodeStateAsUpdate(snapshotDoc);

                mockSnapshots.set(1, {
                    project_id: 1,
                    snapshot_data: Buffer.from(snapshotState),
                });

                // Create update
                const updateDoc = new Y.Doc();
                updateDoc.getText('content').insert(0, 'Update+');
                const updateState = Y.encodeStateAsUpdate(updateDoc);

                mockUpdates.set(1, [
                    {
                        project_id: 1,
                        update_data: Buffer.from(updateState),
                        version: '100',
                    },
                ]);

                const loaded = await loadDocumentEfficient(1);

                expect(loaded).not.toBeNull();

                snapshotDoc.destroy();
                updateDoc.destroy();
            });

            it('should return null when no data', async () => {
                const loaded = await loadDocumentEfficient(999);
                expect(loaded).toBeNull();
            });
        });

        describe('loadDocumentEfficientByUuid', () => {
            it('should load document efficiently by UUID', async () => {
                const doc = new Y.Doc();
                const state = Y.encodeStateAsUpdate(doc);

                mockSnapshots.set(1, {
                    project_id: 1,
                    snapshot_data: Buffer.from(state),
                });

                const loaded = await loadDocumentEfficientByUuid('project-uuid-1');

                expect(loaded).not.toBeNull();
                doc.destroy();
            });

            it('should return null for non-existent project', async () => {
                const loaded = await loadDocumentEfficientByUuid('non-existent');
                expect(loaded).toBeNull();
            });
        });
    });

    describe('Error Handling', () => {
        it('saveFullState should throw on query error', async () => {
            configure({
                db: mockDb,
                queries: {
                    ...createMockQueries(),
                    saveFullState: async () => {
                        throw new Error('Database error');
                    },
                },
            });

            const doc = new Y.Doc();
            const state = Y.encodeStateAsUpdate(doc);

            await expect(saveFullState(1, state)).rejects.toThrow('Database error');
            doc.destroy();
        });

        it('loadDocument should return null on query error', async () => {
            configure({
                db: mockDb,
                queries: {
                    ...createMockQueries(),
                    loadDocumentState: async () => {
                        throw new Error('Load error');
                    },
                },
            });

            const result = await loadDocument(1);
            expect(result).toBeNull();
        });

        it('loadUpdatesSince should throw on query error', async () => {
            configure({
                db: mockDb,
                queries: {
                    ...createMockQueries(),
                    findUpdatesSince: async () => {
                        throw new Error('Query error');
                    },
                },
            });

            await expect(loadUpdatesSince(1, '0')).rejects.toThrow('Query error');
        });

        it('deleteAllUpdates should throw on query error', async () => {
            configure({
                db: mockDb,
                queries: {
                    ...createMockQueries(),
                    deleteAllUpdates: async () => {
                        throw new Error('Delete error');
                    },
                },
            });

            await expect(deleteAllUpdates(1)).rejects.toThrow('Delete error');
        });

        it('pruneUpdatesBefore should throw on query error', async () => {
            configure({
                db: mockDb,
                queries: {
                    ...createMockQueries(),
                    deleteUpdatesBefore: async () => {
                        throw new Error('Prune error');
                    },
                },
            });

            await expect(pruneUpdatesBefore(1, '100')).rejects.toThrow('Prune error');
        });

        it('saveIncrementalUpdate should throw on query error', async () => {
            configure({
                db: mockDb,
                queries: {
                    ...createMockQueries(),
                    saveIncrementalUpdate: async () => {
                        throw new Error('Incremental save error');
                    },
                },
            });

            const doc = new Y.Doc();
            const update = Y.encodeStateAsUpdate(doc);

            await expect(saveIncrementalUpdate(1, update)).rejects.toThrow('Incremental save error');
            doc.destroy();
        });

        it('saveIncrementalUpdate should compact when threshold reached', async () => {
            // Configure to trigger compaction
            configure({
                db: mockDb,
                queries: {
                    ...createMockQueries(),
                    saveIncrementalUpdate: async () => ({
                        compacted: true, // Signal compaction needed
                        stats: { count: 10, totalBytes: 1000 },
                    }),
                    loadDocumentWithUpdates: async () => ({
                        snapshot: null,
                        updates: [],
                    }),
                    upsertSnapshot: async () => {},
                    deleteUpdatesUpToVersion: async () => {},
                },
            });

            const doc = new Y.Doc();
            const update = Y.encodeStateAsUpdate(doc);

            const result = await saveIncrementalUpdate(1, update);
            expect(result.success).toBe(true);
            expect(result.compacted).toBe(true);
            doc.destroy();
        });

        it('compactToSnapshot should throw on query error', async () => {
            configure({
                db: mockDb,
                queries: {
                    ...createMockQueries(),
                    loadDocumentWithUpdates: async () => {
                        throw new Error('Compact error');
                    },
                },
            });

            await expect(compactToSnapshot(1)).rejects.toThrow('Compact error');
        });

        it('compactToSnapshot should apply existing snapshot', async () => {
            const snapshotDoc = new Y.Doc();
            snapshotDoc.getText('content').insert(0, 'Existing');
            const snapshotState = Y.encodeStateAsUpdate(snapshotDoc);

            configure({
                db: mockDb,
                queries: {
                    ...createMockQueries(),
                    loadDocumentWithUpdates: async () => ({
                        snapshot: {
                            project_id: 1,
                            snapshot_data: Buffer.from(snapshotState),
                            version: '100',
                        },
                        updates: [
                            {
                                project_id: 1,
                                update_data: Y.encodeStateAsUpdate(new Y.Doc()),
                                version: '200',
                            },
                        ],
                    }),
                    upsertSnapshot: async () => {},
                    deleteUpdatesUpToVersion: async () => {},
                },
            });

            await compactToSnapshot(1);
            // Should complete without error
            snapshotDoc.destroy();
        });

        it('loadDocumentEfficient should return null on query error', async () => {
            configure({
                db: mockDb,
                queries: {
                    ...createMockQueries(),
                    loadDocumentWithUpdates: async () => {
                        throw new Error('Efficient load error');
                    },
                },
            });

            const result = await loadDocumentEfficient(1);
            expect(result).toBeNull();
        });
    });

    describe('Deprecated Functions', () => {
        it('storeUpdate should call saveFullState', async () => {
            // Import the deprecated function
            const { storeUpdate } = await import('./yjs-persistence');

            const doc = new Y.Doc();
            doc.getText('content').insert(0, 'Via storeUpdate');
            const state = Y.encodeStateAsUpdate(doc);

            await storeUpdate(1, state, 'client-abc');

            expect(mockSnapshots.has(1)).toBe(true);
            doc.destroy();
        });
    });
});
