/**
 * Transactional Yjs version history operations.
 */
import type { Kysely } from 'kysely';
import type { Database, YjsDocument } from '../types';
import {
    createVersionSnapshot,
    findSnapshotByProjectId,
    getVersionById,
    pruneOldVersions,
    upsertSnapshot,
} from './yjs';

export interface SaveSnapshotWithHistoryOptions {
    projectId: number;
    snapshotData: Uint8Array;
    snapshotVersion: string;
    historyLimit: number;
    createdBy?: number;
    description?: string;
}

export interface RestoreVersionSnapshotOptions {
    projectId: number;
    versionId: number;
    historyLimit: number;
    createdBy: number;
}

/**
 * Compare two binary snapshots without converting them to strings.
 */
export function binarySnapshotsEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength) {
        return false;
    }

    for (let index = 0; index < left.byteLength; index += 1) {
        if (left[index] !== right[index]) {
            return false;
        }
    }

    return true;
}

/**
 * Save a canonical Yjs snapshot and preserve the previous distinct state.
 */
export async function saveSnapshotWithHistory(
    db: Kysely<Database>,
    options: SaveSnapshotWithHistoryOptions,
): Promise<YjsDocument> {
    if (options.historyLimit <= 0) {
        return upsertSnapshot(db, options.projectId, options.snapshotData, options.snapshotVersion);
    }

    return db.transaction().execute(async transaction => {
        const current = await findSnapshotByProjectId(transaction, options.projectId);
        const shouldCreateHistory =
            current !== undefined && !binarySnapshotsEqual(current.snapshot_data, options.snapshotData);

        if (shouldCreateHistory) {
            const description =
                options.description ?? `Previous snapshot before explicit save (${current.snapshot_version})`;
            await createVersionSnapshot(
                transaction,
                options.projectId,
                current.snapshot_data,
                description,
                options.createdBy,
            );
        }

        const saved = await upsertSnapshot(
            transaction,
            options.projectId,
            options.snapshotData,
            options.snapshotVersion,
        );

        if (shouldCreateHistory) {
            await pruneOldVersions(transaction, options.projectId, options.historyLimit);
        }

        return saved;
    });
}

/**
 * Restore a historical snapshot while preserving the current canonical state.
 */
export async function restoreVersionSnapshot(
    db: Kysely<Database>,
    options: RestoreVersionSnapshotOptions,
): Promise<YjsDocument | undefined> {
    return db.transaction().execute(async transaction => {
        const target = await getVersionById(transaction, options.versionId, options.projectId);
        if (!target) {
            return undefined;
        }

        const current = await findSnapshotByProjectId(transaction, options.projectId);
        const shouldCreateSafetyVersion =
            current !== undefined && !binarySnapshotsEqual(current.snapshot_data, target.snapshot_data);

        if (shouldCreateSafetyVersion) {
            await createVersionSnapshot(
                transaction,
                options.projectId,
                current.snapshot_data,
                `Safety snapshot before restoring version ${target.version}`,
                options.createdBy,
            );
        }

        const restored = await upsertSnapshot(
            transaction,
            options.projectId,
            target.snapshot_data,
            Date.now().toString(),
        );

        if (shouldCreateSafetyVersion) {
            await pruneOldVersions(transaction, options.projectId, Math.max(1, options.historyLimit));
        }

        return restored;
    });
}
