/**
 * Tests for Yjs Storage Queries
 * Uses real in-memory SQLite database with dependency injection (no mocks)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../types';
import {
    // Snapshots
    findSnapshotByProjectId,
    createSnapshot,
    updateSnapshot,
    upsertSnapshot,
    deleteSnapshot,
    snapshotExists,
    // Updates
    findUpdatesByProjectId,
    findUpdatesSince,
    createUpdate,
    deleteAllUpdates,
    deleteUpdatesBefore,
    getLatestVersion,
    countUpdates,
    documentExists,
    // Full state operations
    saveFullState,
    loadDocumentState,
    getAllUpdateBuffers,
    // Incremental operations
    getUpdateStats,
    saveIncrementalUpdate,
    deleteUpdatesUpToVersion,
    loadDocumentWithUpdates,
    // Version history
    createVersionSnapshot,
    listVersionHistory,
    getVersionById,
    countVersions,
    pruneOldVersions,
    deleteAllVersionHistory,
    getLatestVersionHistory,
} from './yjs';

describe('Yjs Queries', () => {
    let db: Kysely<Database>;
    let testUserId: number;
    let testProjectId: number;

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        testUserId = await seedTestUser(db);
        testProjectId = await seedTestProject(db, testUserId);
    });

    // ============================================================================
    // SNAPSHOT QUERIES (YJS DOCUMENTS)
    // ============================================================================

    describe('Snapshot Operations', () => {
        describe('createSnapshot', () => {
            it('should create a snapshot', async () => {
                const snapshotData = new Uint8Array([1, 2, 3, 4, 5]);
                const snapshot = await createSnapshot(db, {
                    project_id: testProjectId,
                    snapshot_data: snapshotData,
                    snapshot_version: '1',
                });

                expect(snapshot.id).toBeDefined();
                expect(snapshot.project_id).toBe(testProjectId);
                expect(snapshot.snapshot_version).toBe('1');
                expect(snapshot.snapshot_data).toEqual(snapshotData);
            });

            it('should set timestamps', async () => {
                const before = Date.now();
                const snapshot = await createSnapshot(db, {
                    project_id: testProjectId,
                    snapshot_data: new Uint8Array([1]),
                    snapshot_version: '1',
                });
                const after = Date.now();

                expect(snapshot.created_at).toBeDefined();
                expect(snapshot.updated_at).toBeDefined();
                expect(snapshot.created_at!).toBeGreaterThanOrEqual(before);
                expect(snapshot.created_at!).toBeLessThanOrEqual(after);
            });
        });

        describe('findSnapshotByProjectId', () => {
            it('should find existing snapshot', async () => {
                await createSnapshot(db, {
                    project_id: testProjectId,
                    snapshot_data: new Uint8Array([10, 20, 30]),
                    snapshot_version: '100',
                });

                const found = await findSnapshotByProjectId(db, testProjectId);

                expect(found).toBeDefined();
                expect(found?.project_id).toBe(testProjectId);
                expect(found?.snapshot_version).toBe('100');
            });

            it('should return undefined for non-existent project', async () => {
                const found = await findSnapshotByProjectId(db, 99999);
                expect(found).toBeUndefined();
            });
        });

        describe('updateSnapshot', () => {
            it('should update snapshot data and version', async () => {
                await createSnapshot(db, {
                    project_id: testProjectId,
                    snapshot_data: new Uint8Array([1, 2]),
                    snapshot_version: '1',
                });

                const newData = new Uint8Array([3, 4, 5, 6]);
                const updated = await updateSnapshot(db, testProjectId, newData, '2');

                expect(updated).toBeDefined();
                expect(updated?.snapshot_data).toEqual(newData);
                expect(updated?.snapshot_version).toBe('2');
            });

            it('should return undefined for non-existent project', async () => {
                const updated = await updateSnapshot(db, 99999, new Uint8Array([1]), '1');
                expect(updated).toBeUndefined();
            });
        });

        describe('upsertSnapshot', () => {
            it('should insert new snapshot if not exists', async () => {
                const data = new Uint8Array([1, 2, 3]);
                const snapshot = await upsertSnapshot(db, testProjectId, data, '1');

                expect(snapshot.project_id).toBe(testProjectId);
                expect(snapshot.snapshot_data).toEqual(data);
                expect(snapshot.snapshot_version).toBe('1');
            });

            it('should update existing snapshot', async () => {
                await createSnapshot(db, {
                    project_id: testProjectId,
                    snapshot_data: new Uint8Array([1]),
                    snapshot_version: '1',
                });

                const newData = new Uint8Array([4, 5, 6]);
                const updated = await upsertSnapshot(db, testProjectId, newData, '2');

                expect(updated.snapshot_data).toEqual(newData);
                expect(updated.snapshot_version).toBe('2');

                // Verify only one snapshot exists
                const found = await findSnapshotByProjectId(db, testProjectId);
                expect(found?.snapshot_version).toBe('2');
            });
        });

        describe('deleteSnapshot', () => {
            it('should delete snapshot', async () => {
                await createSnapshot(db, {
                    project_id: testProjectId,
                    snapshot_data: new Uint8Array([1]),
                    snapshot_version: '1',
                });

                await deleteSnapshot(db, testProjectId);

                const found = await findSnapshotByProjectId(db, testProjectId);
                expect(found).toBeUndefined();
            });

            it('should not throw for non-existent snapshot', async () => {
                await deleteSnapshot(db, 99999);
            });
        });

        describe('snapshotExists', () => {
            it('should return true when snapshot exists', async () => {
                await createSnapshot(db, {
                    project_id: testProjectId,
                    snapshot_data: new Uint8Array([1]),
                    snapshot_version: '1',
                });

                const exists = await snapshotExists(db, testProjectId);
                expect(exists).toBe(true);
            });

            it('should return false when snapshot does not exist', async () => {
                const exists = await snapshotExists(db, 99999);
                expect(exists).toBe(false);
            });
        });
    });

    // ============================================================================
    // UPDATE QUERIES (YJS UPDATES)
    // ============================================================================

    describe('Update Operations', () => {
        describe('createUpdate', () => {
            it('should create an update', async () => {
                const updateData = new Uint8Array([10, 20, 30]);
                const update = await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: updateData,
                    version: '100',
                    client_id: 'client-123',
                });

                expect(update.id).toBeDefined();
                expect(update.project_id).toBe(testProjectId);
                expect(update.version).toBe('100');
                expect(update.client_id).toBe('client-123');
                expect(update.update_data).toEqual(updateData);
            });

            it('should create update without client_id', async () => {
                const update = await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '1',
                    client_id: null,
                });

                expect(update.client_id).toBeNull();
            });

            it('should set created_at timestamp', async () => {
                const before = Date.now();
                const update = await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '1',
                    client_id: null,
                });
                const after = Date.now();

                expect(update.created_at).toBeDefined();
                expect(update.created_at!).toBeGreaterThanOrEqual(before);
                expect(update.created_at!).toBeLessThanOrEqual(after);
            });
        });

        describe('findUpdatesByProjectId', () => {
            it('should return all updates ordered by version', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '300',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([2]),
                    version: '100',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([3]),
                    version: '200',
                    client_id: null,
                });

                const updates = await findUpdatesByProjectId(db, testProjectId);

                expect(updates.length).toBe(3);
                expect(updates[0].version).toBe('100');
                expect(updates[1].version).toBe('200');
                expect(updates[2].version).toBe('300');
            });

            it('should return empty array for project with no updates', async () => {
                const updates = await findUpdatesByProjectId(db, testProjectId);
                expect(updates).toEqual([]);
            });
        });

        describe('findUpdatesSince', () => {
            it('should return updates after specified version', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '100',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([2]),
                    version: '200',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([3]),
                    version: '300',
                    client_id: null,
                });

                const updates = await findUpdatesSince(db, testProjectId, '150');

                expect(updates.length).toBe(2);
                expect(updates[0].version).toBe('200');
                expect(updates[1].version).toBe('300');
            });

            it('should return empty when no updates after version', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '100',
                    client_id: null,
                });

                const updates = await findUpdatesSince(db, testProjectId, '200');
                expect(updates).toEqual([]);
            });
        });

        describe('deleteAllUpdates', () => {
            it('should delete all updates for project', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '1',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([2]),
                    version: '2',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([3]),
                    version: '3',
                    client_id: null,
                });

                const count = await deleteAllUpdates(db, testProjectId);

                expect(count).toBe(3);

                const remaining = await findUpdatesByProjectId(db, testProjectId);
                expect(remaining.length).toBe(0);
            });

            it('should not delete other projects updates', async () => {
                const otherProjectId = await seedTestProject(db, testUserId, { uuid: `other-${Date.now()}` });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '1',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: otherProjectId,
                    update_data: new Uint8Array([2]),
                    version: '2',
                    client_id: null,
                });

                await deleteAllUpdates(db, testProjectId);

                const otherUpdates = await findUpdatesByProjectId(db, otherProjectId);
                expect(otherUpdates.length).toBe(1);
            });

            it('should return 0 for project with no updates', async () => {
                const count = await deleteAllUpdates(db, testProjectId);
                expect(count).toBe(0);
            });
        });

        describe('deleteUpdatesBefore', () => {
            it('should delete updates before specified version', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '100',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([2]),
                    version: '200',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([3]),
                    version: '300',
                    client_id: null,
                });

                const count = await deleteUpdatesBefore(db, testProjectId, 200);

                expect(count).toBe(1);

                const remaining = await findUpdatesByProjectId(db, testProjectId);
                expect(remaining.length).toBe(2);
                expect(remaining[0].version).toBe('200');
            });
        });

        describe('getLatestVersion', () => {
            it('should return latest version', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '100',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([2]),
                    version: '500',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([3]),
                    version: '300',
                    client_id: null,
                });

                const version = await getLatestVersion(db, testProjectId);

                expect(version).toBe('500');
            });

            it('should return 0 for project with no updates', async () => {
                const version = await getLatestVersion(db, testProjectId);
                expect(version).toBe('0');
            });
        });

        describe('countUpdates', () => {
            it('should count updates', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '1',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([2]),
                    version: '2',
                    client_id: null,
                });

                const count = await countUpdates(db, testProjectId);

                expect(count).toBe(2);
            });

            it('should return 0 for project with no updates', async () => {
                const count = await countUpdates(db, testProjectId);
                expect(count).toBe(0);
            });
        });

        describe('documentExists', () => {
            it('should return true when updates exist', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '1',
                    client_id: null,
                });

                const exists = await documentExists(db, testProjectId);
                expect(exists).toBe(true);
            });

            it('should return false when no updates', async () => {
                const exists = await documentExists(db, testProjectId);
                expect(exists).toBe(false);
            });
        });
    });

    // ============================================================================
    // FULL STATE OPERATIONS
    // ============================================================================

    describe('Full State Operations', () => {
        describe('saveFullState', () => {
            it('should replace all existing updates with new state', async () => {
                // Create some existing updates
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '1',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([2]),
                    version: '2',
                    client_id: null,
                });

                const newState = new Uint8Array([10, 20, 30]);
                const update = await saveFullState(db, testProjectId, newState, 'client-1');

                expect(update.version).toBe('1');
                expect(update.update_data).toEqual(newState);
                expect(update.client_id).toBe('client-1');

                const updates = await findUpdatesByProjectId(db, testProjectId);
                expect(updates.length).toBe(1);
            });

            it('should work without client_id', async () => {
                const state = new Uint8Array([1, 2, 3]);
                const update = await saveFullState(db, testProjectId, state);

                expect(update.client_id).toBeNull();
            });
        });

        describe('loadDocumentState', () => {
            it('should load document state', async () => {
                const state = new Uint8Array([10, 20, 30]);
                await saveFullState(db, testProjectId, state);

                const loaded = await loadDocumentState(db, testProjectId);

                expect(loaded).not.toBeNull();
                expect(loaded).toEqual(state);
            });

            it('should return null for non-existent document', async () => {
                const loaded = await loadDocumentState(db, 99999);
                expect(loaded).toBeNull();
            });

            it('should return first update when multiple exist', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '1',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([2]),
                    version: '2',
                    client_id: null,
                });

                const loaded = await loadDocumentState(db, testProjectId);

                expect(loaded).toEqual(new Uint8Array([1]));
            });
        });

        describe('getAllUpdateBuffers', () => {
            it('should return all update buffers', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1, 2]),
                    version: '1',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([3, 4]),
                    version: '2',
                    client_id: null,
                });

                const buffers = await getAllUpdateBuffers(db, testProjectId);

                expect(buffers.length).toBe(2);
                expect(buffers[0]).toEqual(new Uint8Array([1, 2]));
                expect(buffers[1]).toEqual(new Uint8Array([3, 4]));
            });

            it('should return empty array for project with no updates', async () => {
                const buffers = await getAllUpdateBuffers(db, testProjectId);
                expect(buffers).toEqual([]);
            });
        });
    });

    // ============================================================================
    // INCREMENTAL UPDATE OPERATIONS
    // ============================================================================

    describe('Incremental Update Operations', () => {
        describe('getUpdateStats', () => {
            it('should return stats for updates', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1, 2, 3]),
                    version: '100',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([4, 5]),
                    version: '200',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([6]),
                    version: '300',
                    client_id: null,
                });

                const stats = await getUpdateStats(db, testProjectId);

                expect(stats.count).toBe(3);
                expect(stats.totalBytes).toBe(6); // 3 + 2 + 1
                expect(stats.oldestVersion).toBe('100');
                expect(stats.newestVersion).toBe('300');
            });

            it('should return zero stats for project with no updates', async () => {
                const stats = await getUpdateStats(db, testProjectId);

                expect(stats.count).toBe(0);
                expect(stats.totalBytes).toBe(0);
                expect(stats.oldestVersion).toBe('0');
                expect(stats.newestVersion).toBe('0');
            });
        });

        describe('saveIncrementalUpdate', () => {
            it('should save incremental update', async () => {
                const data = new Uint8Array([1, 2, 3]);
                const result = await saveIncrementalUpdate(db, testProjectId, data, 'client-1');

                expect(result.update.project_id).toBe(testProjectId);
                expect(result.update.update_data).toEqual(data);
                expect(result.update.client_id).toBe('client-1');
                expect(result.stats.count).toBe(1);
            });

            it('should indicate compaction needed when threshold exceeded', async () => {
                // Create updates up to threshold
                for (let i = 0; i < 10; i++) {
                    await createUpdate(db, {
                        project_id: testProjectId,
                        update_data: new Uint8Array([i]),
                        version: String(i),
                        client_id: null,
                    });
                }

                const result = await saveIncrementalUpdate(db, testProjectId, new Uint8Array([99]), undefined, 10);

                expect(result.compacted).toBe(true);
            });

            it('should not indicate compaction when below threshold', async () => {
                const result = await saveIncrementalUpdate(db, testProjectId, new Uint8Array([1]), undefined, 100);

                expect(result.compacted).toBe(false);
            });
        });

        describe('deleteUpdatesUpToVersion', () => {
            it('should delete updates up to and including version', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '100',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([2]),
                    version: '200',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([3]),
                    version: '300',
                    client_id: null,
                });

                const count = await deleteUpdatesUpToVersion(db, testProjectId, '200');

                expect(count).toBe(2);

                const remaining = await findUpdatesByProjectId(db, testProjectId);
                expect(remaining.length).toBe(1);
                expect(remaining[0].version).toBe('300');
            });
        });

        describe('loadDocumentWithUpdates', () => {
            it('should return snapshot and relevant updates', async () => {
                // Create snapshot at version 100
                await createSnapshot(db, {
                    project_id: testProjectId,
                    snapshot_data: new Uint8Array([1, 2, 3]),
                    snapshot_version: '100',
                });

                // Create updates before and after snapshot
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([10]),
                    version: '50',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([20]),
                    version: '150',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([30]),
                    version: '200',
                    client_id: null,
                });

                const result = await loadDocumentWithUpdates(db, testProjectId);

                expect(result.snapshot).toBeDefined();
                expect(result.snapshot?.snapshot_version).toBe('100');
                // Only updates after snapshot version (150 and 200)
                expect(result.updates.length).toBe(2);
                expect(result.updates[0].version).toBe('150');
                expect(result.updates[1].version).toBe('200');
            });

            it('should return all updates when no snapshot exists', async () => {
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([1]),
                    version: '100',
                    client_id: null,
                });
                await createUpdate(db, {
                    project_id: testProjectId,
                    update_data: new Uint8Array([2]),
                    version: '200',
                    client_id: null,
                });

                const result = await loadDocumentWithUpdates(db, testProjectId);

                expect(result.snapshot).toBeUndefined();
                expect(result.updates.length).toBe(2);
            });

            it('should return empty when no data exists', async () => {
                const result = await loadDocumentWithUpdates(db, testProjectId);

                expect(result.snapshot).toBeUndefined();
                expect(result.updates).toEqual([]);
            });
        });
    });

    // ============================================================================
    // VERSION HISTORY OPERATIONS
    // ============================================================================

    describe('Version History Operations', () => {
        describe('createVersionSnapshot', () => {
            it('should create a version snapshot', async () => {
                const snapshotData = new Uint8Array([1, 2, 3, 4, 5]);
                const version = await createVersionSnapshot(
                    db,
                    testProjectId,
                    snapshotData,
                    'Initial version',
                    testUserId,
                );

                expect(version.id).toBeDefined();
                expect(version.project_id).toBe(testProjectId);
                expect(version.snapshot_data).toEqual(snapshotData);
                expect(version.description).toBe('Initial version');
                expect(version.created_by).toBe(testUserId);
                expect(version.version).toBeDefined();
                expect(version.created_at).toBeDefined();
            });

            it('should create version snapshot without description', async () => {
                const snapshotData = new Uint8Array([1, 2, 3]);
                const version = await createVersionSnapshot(db, testProjectId, snapshotData);

                expect(version.description).toBeNull();
                expect(version.created_by).toBeNull();
            });

            it('should create multiple version snapshots', async () => {
                await createVersionSnapshot(db, testProjectId, new Uint8Array([1]), 'Version 1');
                await createVersionSnapshot(db, testProjectId, new Uint8Array([2]), 'Version 2');
                await createVersionSnapshot(db, testProjectId, new Uint8Array([3]), 'Version 3');

                const count = await countVersions(db, testProjectId);
                expect(count).toBe(3);
            });
        });

        describe('listVersionHistory', () => {
            it('should list version history ordered by newest first', async () => {
                await createVersionSnapshot(db, testProjectId, new Uint8Array([1]), 'V1');
                // Small delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 10));
                await createVersionSnapshot(db, testProjectId, new Uint8Array([2]), 'V2');
                await new Promise(resolve => setTimeout(resolve, 10));
                await createVersionSnapshot(db, testProjectId, new Uint8Array([3]), 'V3');

                const versions = await listVersionHistory(db, testProjectId);

                expect(versions.length).toBe(3);
                expect(versions[0].description).toBe('V3'); // Newest first
                expect(versions[2].description).toBe('V1'); // Oldest last
            });

            it('should respect limit parameter', async () => {
                for (let i = 0; i < 5; i++) {
                    await createVersionSnapshot(db, testProjectId, new Uint8Array([i]), `V${i}`);
                }

                const versions = await listVersionHistory(db, testProjectId, 3);

                expect(versions.length).toBe(3);
            });

            it('should respect offset parameter', async () => {
                for (let i = 0; i < 5; i++) {
                    await createVersionSnapshot(db, testProjectId, new Uint8Array([i]), `V${i}`);
                    await new Promise(resolve => setTimeout(resolve, 5));
                }

                const versions = await listVersionHistory(db, testProjectId, 10, 2);

                expect(versions.length).toBe(3); // 5 total - 2 offset
            });

            it('should return empty array for project with no versions', async () => {
                const versions = await listVersionHistory(db, testProjectId);
                expect(versions).toEqual([]);
            });
        });

        describe('getVersionById', () => {
            it('should get version by ID', async () => {
                const created = await createVersionSnapshot(
                    db,
                    testProjectId,
                    new Uint8Array([1, 2, 3]),
                    'Test version',
                );

                const found = await getVersionById(db, created.id, testProjectId);

                expect(found).toBeDefined();
                expect(found?.id).toBe(created.id);
                expect(found?.description).toBe('Test version');
            });

            it('should return undefined for non-existent ID', async () => {
                const found = await getVersionById(db, 99999, testProjectId);
                expect(found).toBeUndefined();
            });

            it('should return undefined for wrong project ID', async () => {
                const created = await createVersionSnapshot(db, testProjectId, new Uint8Array([1]), 'Test');
                const otherProjectId = await seedTestProject(db, testUserId, { uuid: `other-${Date.now()}` });

                const found = await getVersionById(db, created.id, otherProjectId);
                expect(found).toBeUndefined();
            });
        });

        describe('countVersions', () => {
            it('should count versions', async () => {
                await createVersionSnapshot(db, testProjectId, new Uint8Array([1]), 'V1');
                await createVersionSnapshot(db, testProjectId, new Uint8Array([2]), 'V2');
                await createVersionSnapshot(db, testProjectId, new Uint8Array([3]), 'V3');

                const count = await countVersions(db, testProjectId);

                expect(count).toBe(3);
            });

            it('should return 0 for project with no versions', async () => {
                const count = await countVersions(db, testProjectId);
                expect(count).toBe(0);
            });
        });

        describe('pruneOldVersions', () => {
            it('should keep most recent N versions', async () => {
                for (let i = 0; i < 5; i++) {
                    await createVersionSnapshot(db, testProjectId, new Uint8Array([i]), `V${i}`);
                    await new Promise(resolve => setTimeout(resolve, 5));
                }

                const deleted = await pruneOldVersions(db, testProjectId, 3);

                expect(deleted).toBe(2); // 5 - 3 = 2 deleted

                const remaining = await listVersionHistory(db, testProjectId);
                expect(remaining.length).toBe(3);
            });

            it('should delete nothing when keepCount >= total versions', async () => {
                await createVersionSnapshot(db, testProjectId, new Uint8Array([1]), 'V1');
                await createVersionSnapshot(db, testProjectId, new Uint8Array([2]), 'V2');

                const deleted = await pruneOldVersions(db, testProjectId, 5);

                expect(deleted).toBe(0);
                const count = await countVersions(db, testProjectId);
                expect(count).toBe(2);
            });

            it('should delete all versions when keepCount is 0', async () => {
                await createVersionSnapshot(db, testProjectId, new Uint8Array([1]), 'V1');
                await createVersionSnapshot(db, testProjectId, new Uint8Array([2]), 'V2');

                const deleted = await pruneOldVersions(db, testProjectId, 0);

                expect(deleted).toBe(2);
                const count = await countVersions(db, testProjectId);
                expect(count).toBe(0);
            });

            it('should not affect other projects', async () => {
                const otherProjectId = await seedTestProject(db, testUserId, { uuid: `other-${Date.now()}` });
                await createVersionSnapshot(db, testProjectId, new Uint8Array([1]), 'V1');
                await createVersionSnapshot(db, otherProjectId, new Uint8Array([2]), 'V2');

                await pruneOldVersions(db, testProjectId, 0);

                const otherCount = await countVersions(db, otherProjectId);
                expect(otherCount).toBe(1);
            });
        });

        describe('deleteAllVersionHistory', () => {
            it('should delete all versions for project', async () => {
                await createVersionSnapshot(db, testProjectId, new Uint8Array([1]), 'V1');
                await createVersionSnapshot(db, testProjectId, new Uint8Array([2]), 'V2');
                await createVersionSnapshot(db, testProjectId, new Uint8Array([3]), 'V3');

                const deleted = await deleteAllVersionHistory(db, testProjectId);

                expect(deleted).toBe(3);
                const count = await countVersions(db, testProjectId);
                expect(count).toBe(0);
            });

            it('should return 0 for project with no versions', async () => {
                const deleted = await deleteAllVersionHistory(db, testProjectId);
                expect(deleted).toBe(0);
            });

            it('should not delete other projects versions', async () => {
                const otherProjectId = await seedTestProject(db, testUserId, { uuid: `other-${Date.now()}` });
                await createVersionSnapshot(db, testProjectId, new Uint8Array([1]), 'V1');
                await createVersionSnapshot(db, otherProjectId, new Uint8Array([2]), 'V2');

                await deleteAllVersionHistory(db, testProjectId);

                const otherCount = await countVersions(db, otherProjectId);
                expect(otherCount).toBe(1);
            });
        });

        describe('getLatestVersionHistory', () => {
            it('should get the most recent version', async () => {
                await createVersionSnapshot(db, testProjectId, new Uint8Array([1]), 'First');
                await new Promise(resolve => setTimeout(resolve, 10));
                await createVersionSnapshot(db, testProjectId, new Uint8Array([2]), 'Second');
                await new Promise(resolve => setTimeout(resolve, 10));
                await createVersionSnapshot(db, testProjectId, new Uint8Array([3]), 'Third');

                const latest = await getLatestVersionHistory(db, testProjectId);

                expect(latest).toBeDefined();
                expect(latest?.description).toBe('Third');
            });

            it('should return undefined for project with no versions', async () => {
                const latest = await getLatestVersionHistory(db, testProjectId);
                expect(latest).toBeUndefined();
            });

            it('should return single version when only one exists', async () => {
                await createVersionSnapshot(db, testProjectId, new Uint8Array([1]), 'Only version');

                const latest = await getLatestVersionHistory(db, testProjectId);

                expect(latest).toBeDefined();
                expect(latest?.description).toBe('Only version');
            });
        });
    });
});
