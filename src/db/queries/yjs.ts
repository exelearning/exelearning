/**
 * Yjs Storage Queries - Kysely ORM
 * Type-safe queries for SQLite, PostgreSQL, and MySQL
 * All functions accept db as first parameter for dependency injection
 */
import { sql, type Kysely } from 'kysely';
import type { Database, YjsDocument, NewYjsDocument, YjsUpdate, NewYjsUpdate, YjsVersionHistory } from '../types';
import { now } from '../types';
import { supportsReturning, updateByColumnAndReturn, toBinaryData } from '../helpers';

/** version column is varchar — cast for numeric operations */
const versionAsInt = sql<number>`CAST(version AS INTEGER)`;

// ============================================================================
// YJS DOCUMENTS (SNAPSHOTS)
// ============================================================================

export async function findSnapshotByProjectId(
    db: Kysely<Database>,
    projectId: number,
): Promise<YjsDocument | undefined> {
    return db.selectFrom('yjs_documents').selectAll().where('project_id', '=', projectId).executeTakeFirst();
}

export async function createSnapshot(db: Kysely<Database>, data: NewYjsDocument): Promise<YjsDocument> {
    const timestamp = now();
    const values = {
        ...data,
        snapshot_data: toBinaryData(data.snapshot_data),
        created_at: timestamp,
        updated_at: timestamp,
    };

    if (supportsReturning()) {
        return db.insertInto('yjs_documents').values(values).returningAll().executeTakeFirstOrThrow();
    }

    await db.insertInto('yjs_documents').values(values).executeTakeFirstOrThrow();
    return db
        .selectFrom('yjs_documents')
        .selectAll()
        .where('project_id', '=', values.project_id)
        .executeTakeFirstOrThrow();
}

export async function updateSnapshot(
    db: Kysely<Database>,
    projectId: number,
    snapshotData: Uint8Array,
    snapshotVersion: string,
): Promise<YjsDocument | undefined> {
    return updateByColumnAndReturn(db, 'yjs_documents', 'project_id', projectId, {
        snapshot_data: toBinaryData(snapshotData),
        snapshot_version: snapshotVersion,
        updated_at: now(),
    });
}

export async function upsertSnapshot(
    db: Kysely<Database>,
    projectId: number,
    snapshotData: Uint8Array,
    snapshotVersion: string,
): Promise<YjsDocument> {
    const existing = await findSnapshotByProjectId(db, projectId);
    const timestamp = now();
    // Convert binary data for MySQL compatibility (requires Buffer, not Uint8Array)
    const binaryData = toBinaryData(snapshotData);

    if (existing) {
        const updated = await updateByColumnAndReturn(db, 'yjs_documents', 'project_id', projectId, {
            snapshot_data: binaryData,
            snapshot_version: snapshotVersion,
            updated_at: timestamp,
        });
        return updated!;
    }

    const values = {
        project_id: projectId,
        snapshot_data: binaryData,
        snapshot_version: snapshotVersion,
        created_at: timestamp,
        updated_at: timestamp,
    };

    if (supportsReturning()) {
        return db.insertInto('yjs_documents').values(values).returningAll().executeTakeFirstOrThrow();
    }

    await db.insertInto('yjs_documents').values(values).executeTakeFirstOrThrow();
    return db.selectFrom('yjs_documents').selectAll().where('project_id', '=', projectId).executeTakeFirstOrThrow();
}

export async function deleteSnapshot(db: Kysely<Database>, projectId: number): Promise<void> {
    await db.deleteFrom('yjs_documents').where('project_id', '=', projectId).execute();
}

export async function snapshotExists(db: Kysely<Database>, projectId: number): Promise<boolean> {
    const result = await db
        .selectFrom('yjs_documents')
        .select('id')
        .where('project_id', '=', projectId)
        .executeTakeFirst();
    return !!result;
}

// ============================================================================
// YJS UPDATES (INCREMENTAL)
// ============================================================================

export async function findUpdatesByProjectId(db: Kysely<Database>, projectId: number): Promise<YjsUpdate[]> {
    return db
        .selectFrom('yjs_updates')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy(versionAsInt, 'asc')
        .execute();
}

export async function findUpdatesSince(
    db: Kysely<Database>,
    projectId: number,
    sinceVersion: string,
): Promise<YjsUpdate[]> {
    const sinceVersionNum = parseInt(sinceVersion, 10);
    return db
        .selectFrom('yjs_updates')
        .selectAll()
        .where('project_id', '=', projectId)
        .where(versionAsInt, '>', sinceVersionNum)
        .orderBy(versionAsInt, 'asc')
        .execute();
}

export async function createUpdate(db: Kysely<Database>, data: NewYjsUpdate): Promise<YjsUpdate> {
    const timestamp = now();
    const values = {
        ...data,
        update_data: toBinaryData(data.update_data),
        created_at: timestamp,
    };

    if (supportsReturning()) {
        return db.insertInto('yjs_updates').values(values).returningAll().executeTakeFirstOrThrow();
    }

    await db.insertInto('yjs_updates').values(values).executeTakeFirstOrThrow();
    return db
        .selectFrom('yjs_updates')
        .selectAll()
        .where('project_id', '=', values.project_id)
        .where('version', '=', values.version)
        .orderBy('id', 'desc')
        .limit(1)
        .executeTakeFirstOrThrow();
}

export async function deleteAllUpdates(db: Kysely<Database>, projectId: number): Promise<number> {
    const count = await countUpdates(db, projectId);
    await db.deleteFrom('yjs_updates').where('project_id', '=', projectId).execute();
    return count;
}

export async function deleteUpdatesBefore(
    db: Kysely<Database>,
    projectId: number,
    beforeVersion: string,
): Promise<number> {
    const beforeVersionNum = parseInt(beforeVersion, 10);
    const result = await db
        .deleteFrom('yjs_updates')
        .where('project_id', '=', projectId)
        .where(versionAsInt, '<', beforeVersionNum)
        .execute();
    return Number(result[0]?.numDeletedRows ?? 0);
}

export async function getLatestVersion(db: Kysely<Database>, projectId: number): Promise<string> {
    const result = await db
        .selectFrom('yjs_updates')
        .select(sql<number>`MAX(${versionAsInt})`.as('maxVersion'))
        .where('project_id', '=', projectId)
        .executeTakeFirst();

    return result?.maxVersion != null ? String(result.maxVersion) : '0';
}

export async function countUpdates(db: Kysely<Database>, projectId: number): Promise<number> {
    const result = await db
        .selectFrom('yjs_updates')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .where('project_id', '=', projectId)
        .executeTakeFirst();
    return result?.count ?? 0;
}

export async function documentExists(db: Kysely<Database>, projectId: number): Promise<boolean> {
    const count = await countUpdates(db, projectId);
    return count > 0;
}

// ============================================================================
// FULL STATE OPERATIONS (Stateless Relay Mode)
// ============================================================================

/**
 * Save full document state - replaces all existing updates
 * Used in stateless relay mode where client sends full state
 */
export async function saveFullState(
    db: Kysely<Database>,
    projectId: number,
    state: Uint8Array,
    clientId?: string,
): Promise<YjsUpdate> {
    // Delete all existing updates for this project
    await deleteAllUpdates(db, projectId);

    // Save new full state as version 1
    return createUpdate(db, {
        project_id: projectId,
        update_data: state,
        version: '1',
        client_id: clientId || null,
    });
}

/**
 * Load full document state
 * Returns combined state from all updates
 */
export async function loadDocumentState(db: Kysely<Database>, projectId: number): Promise<Uint8Array | null> {
    const updates = await findUpdatesByProjectId(db, projectId);

    if (updates.length === 0) {
        return null;
    }

    // If only one update, return it directly
    if (updates.length === 1) {
        return updates[0].update_data;
    }

    // Multiple updates - need to be merged by caller using Yjs
    // Return the first one and let the caller handle merging
    // This is a simplified approach; for full merging, use Y.Doc
    return updates[0].update_data;
}

/**
 * Get all update buffers for a project
 * Used when caller needs to merge updates manually with Yjs
 */
export async function getAllUpdateBuffers(db: Kysely<Database>, projectId: number): Promise<Uint8Array[]> {
    const updates = await findUpdatesByProjectId(db, projectId);
    return updates.map(u => u.update_data);
}

// ============================================================================
// INCREMENTAL UPDATE OPERATIONS (Optimized for large documents)
// ============================================================================

/**
 * Statistics about stored updates for a project
 */
export interface UpdateStats {
    count: number;
    totalBytes: number;
    oldestVersion: string;
    newestVersion: string;
}

/**
 * Get statistics about stored updates
 * Used to determine when compaction is needed
 */
export async function getUpdateStats(db: Kysely<Database>, projectId: number): Promise<UpdateStats> {
    const result = await db
        .selectFrom('yjs_updates')
        .select(eb => [
            eb.fn.count<number>('id').as('count'),
            eb.fn.sum<number>(eb.fn('length', ['update_data'])).as('totalBytes'),
        ])
        .select(sql<number>`MIN(${versionAsInt})`.as('oldestVersion'))
        .select(sql<number>`MAX(${versionAsInt})`.as('newestVersion'))
        .where('project_id', '=', projectId)
        .executeTakeFirst();

    const count = Number(result?.count ?? 0);
    if (count === 0) {
        return { count: 0, totalBytes: 0, oldestVersion: '0', newestVersion: '0' };
    }

    return {
        count,
        totalBytes: Number(result?.totalBytes ?? 0),
        oldestVersion: String(result?.oldestVersion ?? '0'),
        newestVersion: String(result?.newestVersion ?? '0'),
    };
}

/**
 * Result of saving an incremental update
 */
export interface SaveIncrementalResult {
    update: YjsUpdate;
    compacted: boolean;
    stats: UpdateStats;
}

/**
 * Save an incremental update
 * Checks if compaction is needed based on thresholds
 *
 * @param db - Database instance
 * @param projectId - Project to save update for
 * @param updateData - Yjs update binary data
 * @param clientId - Optional client identifier
 * @param compactThresholdUpdates - Number of updates before compacting (default: 50)
 * @param compactThresholdBytes - Bytes of updates before compacting (default: 512KB)
 */
export async function saveIncrementalUpdate(
    db: Kysely<Database>,
    projectId: number,
    updateData: Uint8Array,
    clientId?: string,
    compactThresholdUpdates: number = 50,
    compactThresholdBytes: number = 512 * 1024,
): Promise<SaveIncrementalResult> {
    // Generate version as timestamp
    const version = Date.now().toString();

    // Save the incremental update
    const update = await createUpdate(db, {
        project_id: projectId,
        update_data: updateData,
        version,
        client_id: clientId || null,
    });

    // Get current stats to check if compaction needed
    const stats = await getUpdateStats(db, projectId);

    // Check if compaction is needed
    const needsCompaction = stats.count >= compactThresholdUpdates || stats.totalBytes >= compactThresholdBytes;

    return {
        update,
        compacted: needsCompaction, // Caller should compact if true
        stats,
    };
}

/**
 * Delete updates up to and including a specific version
 * Used after compaction to remove old incremental updates
 */
export async function deleteUpdatesUpToVersion(
    db: Kysely<Database>,
    projectId: number,
    upToVersion: string,
): Promise<number> {
    const upToVersionNum = parseInt(upToVersion, 10);
    const result = await db
        .deleteFrom('yjs_updates')
        .where('project_id', '=', projectId)
        .where(versionAsInt, '<=', upToVersionNum)
        .execute();
    return Number(result[0]?.numDeletedRows ?? 0);
}

/**
 * Load document state efficiently using snapshot + incremental updates
 * Returns snapshot data and any updates since the snapshot
 */
export async function loadDocumentWithUpdates(
    db: Kysely<Database>,
    projectId: number,
): Promise<{
    snapshot: YjsDocument | undefined;
    updates: YjsUpdate[];
}> {
    const [snapshot, updates] = await Promise.all([
        findSnapshotByProjectId(db, projectId),
        findUpdatesByProjectId(db, projectId),
    ]);

    // Filter updates to only those since snapshot
    const sinceVersion = snapshot?.snapshot_version || '0';
    const sinceVersionNum = parseInt(sinceVersion, 10);
    const relevantUpdates = updates.filter(u => parseInt(u.version, 10) > sinceVersionNum);

    return {
        snapshot,
        updates: relevantUpdates,
    };
}

// ============================================================================
// VERSION HISTORY (Rollback support)
// ============================================================================

/**
 * Create a version snapshot for rollback
 * Captures the current state of the document
 */
export async function createVersionSnapshot(
    db: Kysely<Database>,
    projectId: number,
    snapshotData: Uint8Array,
    description?: string,
    createdBy?: number,
): Promise<YjsVersionHistory> {
    const timestamp = now();
    const version = Date.now().toString();
    const values = {
        project_id: projectId,
        snapshot_data: toBinaryData(snapshotData),
        version,
        description: description || null,
        created_by: createdBy || null,
        created_at: timestamp,
    };

    if (supportsReturning()) {
        return db.insertInto('yjs_version_history').values(values).returningAll().executeTakeFirstOrThrow();
    }

    await db.insertInto('yjs_version_history').values(values).executeTakeFirstOrThrow();
    return db
        .selectFrom('yjs_version_history')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('version', '=', version)
        .orderBy('id', 'desc')
        .limit(1)
        .executeTakeFirstOrThrow();
}

/**
 * List version history for a project
 * Returns versions ordered by newest first
 */
export async function listVersionHistory(
    db: Kysely<Database>,
    projectId: number,
    limit: number = 20,
    offset: number = 0,
): Promise<YjsVersionHistory[]> {
    return db
        .selectFrom('yjs_version_history')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();
}

/**
 * Get a specific version by ID
 */
export async function getVersionById(
    db: Kysely<Database>,
    versionId: number,
    projectId: number,
): Promise<YjsVersionHistory | undefined> {
    return db
        .selectFrom('yjs_version_history')
        .selectAll()
        .where('id', '=', versionId)
        .where('project_id', '=', projectId)
        .executeTakeFirst();
}

/**
 * Count versions for a project
 */
export async function countVersions(db: Kysely<Database>, projectId: number): Promise<number> {
    const result = await db
        .selectFrom('yjs_version_history')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .where('project_id', '=', projectId)
        .executeTakeFirst();
    return result?.count ?? 0;
}

/**
 * Delete old versions, keeping the most recent N
 * Useful for limiting storage usage
 */
export async function pruneOldVersions(db: Kysely<Database>, projectId: number, keepCount: number): Promise<number> {
    // Get IDs of versions to keep (most recent N)
    const versionsToKeep = await db
        .selectFrom('yjs_version_history')
        .select('id')
        .where('project_id', '=', projectId)
        .orderBy('created_at', 'desc')
        .limit(keepCount)
        .execute();

    const keepIds = versionsToKeep.map(v => v.id);

    // Delete all versions for this project that are NOT in the keep list
    let query = db.deleteFrom('yjs_version_history').where('project_id', '=', projectId);

    if (keepIds.length > 0) {
        query = query.where('id', 'not in', keepIds);
    }

    const result = await query.execute();
    return Number(result[0]?.numDeletedRows ?? 0);
}

/**
 * Delete all version history for a project
 */
export async function deleteAllVersionHistory(db: Kysely<Database>, projectId: number): Promise<number> {
    const count = await countVersions(db, projectId);
    await db.deleteFrom('yjs_version_history').where('project_id', '=', projectId).execute();
    return count;
}

/**
 * Get the most recent version for a project
 */
export async function getLatestVersionHistory(
    db: Kysely<Database>,
    projectId: number,
): Promise<YjsVersionHistory | undefined> {
    return db
        .selectFrom('yjs_version_history')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst();
}
