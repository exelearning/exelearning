import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { Kysely } from 'kysely';
import { cleanTestDb, createTestDb, destroyTestDb, seedTestProject, seedTestUser } from '../../../test/helpers/test-db';
import type { Database } from '../types';
import {
    countVersions,
    createVersionSnapshot,
    findSnapshotByProjectId,
    listVersionHistory,
    upsertSnapshot,
} from './yjs';
import { binarySnapshotsEqual, restoreVersionSnapshot, saveSnapshotWithHistory } from './yjs-history';

describe('Yjs version history queries', () => {
    let db: Kysely<Database>;
    let userId: number;
    let projectId: number;

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        userId = await seedTestUser(db);
        projectId = await seedTestProject(db, userId);
    });

    it('compares binary snapshots', () => {
        expect(binarySnapshotsEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
        expect(binarySnapshotsEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
        expect(binarySnapshotsEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    });

    it('does not create history for the first save', async () => {
        await saveSnapshotWithHistory(db, {
            projectId,
            snapshotData: new Uint8Array([1]),
            snapshotVersion: '1',
            historyLimit: 5,
            createdBy: userId,
        });

        expect(await countVersions(db, projectId)).toBe(0);
    });

    it('preserves the previous distinct snapshot', async () => {
        await upsertSnapshot(db, projectId, new Uint8Array([1, 2]), '1');

        await saveSnapshotWithHistory(db, {
            projectId,
            snapshotData: new Uint8Array([3, 4]),
            snapshotVersion: '2',
            historyLimit: 5,
            createdBy: userId,
            description: 'Manual save backup',
        });

        const versions = await listVersionHistory(db, projectId);
        expect(versions).toHaveLength(1);
        expect(versions[0].snapshot_data).toEqual(new Uint8Array([1, 2]));
        expect(versions[0].created_by).toBe(userId);
        expect(versions[0].description).toBe('Manual save backup');
    });

    it('does not store duplicate consecutive snapshots', async () => {
        const data = new Uint8Array([1, 2, 3]);
        await upsertSnapshot(db, projectId, data, '1');

        await saveSnapshotWithHistory(db, {
            projectId,
            snapshotData: data,
            snapshotVersion: '2',
            historyLimit: 5,
            createdBy: userId,
        });

        expect(await countVersions(db, projectId)).toBe(0);
    });

    it('keeps only the configured number of previous versions', async () => {
        await upsertSnapshot(db, projectId, new Uint8Array([0]), '0');

        for (let version = 1; version <= 7; version += 1) {
            await saveSnapshotWithHistory(db, {
                projectId,
                snapshotData: new Uint8Array([version]),
                snapshotVersion: String(version),
                historyLimit: 5,
                createdBy: userId,
            });
        }

        expect(await countVersions(db, projectId)).toBe(5);
    });

    it('disables automatic history creation when the limit is zero', async () => {
        await upsertSnapshot(db, projectId, new Uint8Array([1]), '1');

        await saveSnapshotWithHistory(db, {
            projectId,
            snapshotData: new Uint8Array([2]),
            snapshotVersion: '2',
            historyLimit: 0,
            createdBy: userId,
        });

        expect(await countVersions(db, projectId)).toBe(0);
    });

    it('rolls back the canonical save when history creation fails', async () => {
        await upsertSnapshot(db, projectId, new Uint8Array([1]), '1');

        await expect(
            saveSnapshotWithHistory(db, {
                projectId,
                snapshotData: new Uint8Array([2]),
                snapshotVersion: '2',
                historyLimit: 5,
                createdBy: 999_999,
            }),
        ).rejects.toThrow();

        const current = await findSnapshotByProjectId(db, projectId);
        expect(current?.snapshot_data).toEqual(new Uint8Array([1]));
        expect(current?.snapshot_version).toBe('1');
    });

    it('restores a version and preserves the current state as a safety snapshot', async () => {
        await upsertSnapshot(db, projectId, new Uint8Array([9]), 'current');
        const target = await createVersionSnapshot(db, projectId, new Uint8Array([4]), 'Target', userId);

        const restored = await restoreVersionSnapshot(db, {
            projectId,
            versionId: target.id,
            historyLimit: 5,
            createdBy: userId,
        });

        expect(restored?.snapshot_data).toEqual(new Uint8Array([4]));
        const versions = await listVersionHistory(db, projectId);
        expect(versions.some(version => binarySnapshotsEqual(version.snapshot_data, new Uint8Array([9])))).toBe(true);
    });

    it('restores a historical version when no canonical snapshot exists', async () => {
        const target = await createVersionSnapshot(db, projectId, new Uint8Array([5]), 'Target', userId);

        const restored = await restoreVersionSnapshot(db, {
            projectId,
            versionId: target.id,
            historyLimit: 5,
            createdBy: userId,
        });

        expect(restored?.snapshot_data).toEqual(new Uint8Array([5]));
        expect(await countVersions(db, projectId)).toBe(1);
    });

    it('does not create a safety version when the target matches the current snapshot', async () => {
        const data = new Uint8Array([6]);
        await upsertSnapshot(db, projectId, data, 'current');
        const target = await createVersionSnapshot(db, projectId, data, 'Target', userId);

        await restoreVersionSnapshot(db, {
            projectId,
            versionId: target.id,
            historyLimit: 5,
            createdBy: userId,
        });

        expect(await countVersions(db, projectId)).toBe(1);
    });

    it('returns undefined without changing state when the requested version does not exist', async () => {
        await upsertSnapshot(db, projectId, new Uint8Array([7]), '1');

        const restored = await restoreVersionSnapshot(db, {
            projectId,
            versionId: 999_999,
            historyLimit: 5,
            createdBy: userId,
        });

        expect(restored).toBeUndefined();
        expect((await findSnapshotByProjectId(db, projectId))?.snapshot_data).toEqual(new Uint8Array([7]));
    });
});
