/**
 * Asset Queries - Kysely ORM
 * Type-safe queries for SQLite, PostgreSQL, and MySQL
 * All functions accept db as first parameter for dependency injection
 */
import type { Kysely } from 'kysely';
import type { Database, Asset, NewAsset, AssetUpdate, Project } from '../types';
import { now } from '../types';
import { sql } from 'kysely';
import { insertAndReturn, insertManyAndReturn, updateByIdAndReturn } from '../helpers';

// ============================================================================
// READ QUERIES
// ============================================================================

export async function findAssetById(db: Kysely<Database>, id: number): Promise<Asset | undefined> {
    return db.selectFrom('assets').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function findAssetByIdWithProject(
    db: Kysely<Database>,
    id: number,
): Promise<(Asset & { project: Project }) | undefined> {
    const result = await db
        .selectFrom('assets')
        .innerJoin('projects', 'assets.project_id', 'projects.id')
        .selectAll('assets')
        .select([
            'projects.id as project_id_join',
            'projects.uuid as project_uuid',
            'projects.title as project_title',
            'projects.description as project_description',
            'projects.owner_id as project_owner_id',
            'projects.status as project_status',
            'projects.visibility as project_visibility',
            'projects.language as project_language',
            'projects.author as project_author',
            'projects.license as project_license',
            'projects.last_accessed_at as project_last_accessed_at',
            'projects.saved_once as project_saved_once',
            'projects.created_at as project_created_at',
            'projects.updated_at as project_updated_at',
        ])
        .where('assets.id', '=', id)
        .executeTakeFirst();

    if (!result) return undefined;

    const project: Project = {
        id: result.project_id_join,
        uuid: result.project_uuid,
        title: result.project_title,
        description: result.project_description,
        owner_id: result.project_owner_id,
        status: result.project_status,
        visibility: result.project_visibility,
        language: result.project_language,
        author: result.project_author,
        license: result.project_license,
        last_accessed_at: result.project_last_accessed_at,
        saved_once: result.project_saved_once,
        created_at: result.project_created_at,
        updated_at: result.project_updated_at,
    };

    return {
        id: result.id,
        project_id: result.project_id,
        filename: result.filename,
        storage_path: result.storage_path,
        mime_type: result.mime_type,
        file_size: result.file_size,
        client_id: result.client_id,
        component_id: result.component_id,
        content_hash: result.content_hash,
        created_at: result.created_at,
        updated_at: result.updated_at,
        project,
    };
}

export async function findAssetByClientId(
    db: Kysely<Database>,
    clientId: string,
    projectId?: number,
): Promise<Asset | undefined> {
    let query = db.selectFrom('assets').selectAll().where('client_id', '=', clientId);

    if (projectId !== undefined) {
        query = query.where('project_id', '=', projectId);
    }

    return query.executeTakeFirst();
}

export async function findAssetsByClientIds(
    db: Kysely<Database>,
    clientIds: string[],
    projectId: number,
): Promise<Asset[]> {
    if (clientIds.length === 0) return [];

    return db
        .selectFrom('assets')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('client_id', 'in', clientIds)
        .execute();
}

export async function findAssetByHash(
    db: Kysely<Database>,
    projectId: number,
    contentHash: string,
): Promise<Asset | undefined> {
    return db
        .selectFrom('assets')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('content_hash', '=', contentHash)
        .executeTakeFirst();
}

export async function findAssetsByHashes(db: Kysely<Database>, projectId: number, hashes: string[]): Promise<Asset[]> {
    if (hashes.length === 0) return [];

    return db
        .selectFrom('assets')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('content_hash', 'in', hashes)
        .execute();
}

export async function findAllAssetsForProject(db: Kysely<Database>, projectId: number): Promise<Asset[]> {
    return db
        .selectFrom('assets')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('created_at', 'desc')
        .execute();
}

export async function getProjectStorageSize(db: Kysely<Database>, projectId: number): Promise<number> {
    const result = await db
        .selectFrom('assets')
        .select(sql<string>`SUM(CAST(file_size AS INTEGER))`.as('total_size'))
        .where('project_id', '=', projectId)
        .executeTakeFirst();

    return parseInt(result?.total_size || '0', 10);
}

/**
 * Get total storage usage for a user (sum of all their projects' assets)
 * Returns size in bytes
 */
export async function getUserStorageUsage(db: Kysely<Database>, userId: number): Promise<number> {
    const result = await db
        .selectFrom('assets')
        .innerJoin('projects', 'assets.project_id', 'projects.id')
        .select(sql<string>`SUM(CAST(assets.file_size AS INTEGER))`.as('total_size'))
        .where('projects.owner_id', '=', userId)
        .executeTakeFirst();

    return parseInt(result?.total_size || '0', 10);
}

// ============================================================================
// WRITE QUERIES
// ============================================================================

export async function createAsset(db: Kysely<Database>, data: NewAsset): Promise<Asset> {
    const timestamp = now();
    return insertAndReturn(db, 'assets', {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
    });
}

export async function createAssets(db: Kysely<Database>, data: NewAsset[]): Promise<Asset[]> {
    if (data.length === 0) return [];

    const timestamp = now();
    const withTimestamps = data.map(d => ({
        ...d,
        created_at: timestamp,
        updated_at: timestamp,
    }));

    return insertManyAndReturn(db, 'assets', withTimestamps);
}

export async function updateAsset(db: Kysely<Database>, id: number, data: AssetUpdate): Promise<Asset | undefined> {
    return updateByIdAndReturn(db, 'assets', id, {
        ...data,
        updated_at: now(),
    });
}

export async function updateAssetClientId(db: Kysely<Database>, id: number, clientId: string): Promise<void> {
    await db
        .updateTable('assets')
        .set({
            client_id: clientId,
            updated_at: now(),
        })
        .where('id', '=', id)
        .execute();
}

export async function deleteAsset(db: Kysely<Database>, id: number): Promise<void> {
    await db.deleteFrom('assets').where('id', '=', id).execute();
}

export async function deleteAllAssetsForProject(db: Kysely<Database>, projectId: number): Promise<number> {
    const result = await db
        .selectFrom('assets')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .where('project_id', '=', projectId)
        .executeTakeFirst();
    const count = Number(result?.count ?? 0);

    if (count > 0) {
        await db.deleteFrom('assets').where('project_id', '=', projectId).execute();
    }

    return count;
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

export async function bulkUpdateClientIds(
    db: Kysely<Database>,
    updates: Array<{ id: number; clientId: string }>,
): Promise<void> {
    if (updates.length === 0) return;

    const timestamp = now();
    // Parallel updates for better performance
    await Promise.all(
        updates.map(({ id, clientId }) =>
            db
                .updateTable('assets')
                .set({
                    client_id: clientId,
                    updated_at: timestamp,
                })
                .where('id', '=', id)
                .execute(),
        ),
    );
}

export async function bulkUpdateAssets(
    db: Kysely<Database>,
    updates: Array<{ id: number; data: AssetUpdate }>,
): Promise<void> {
    if (updates.length === 0) return;

    const timestamp = now();
    // Parallel updates for better performance
    await Promise.all(
        updates.map(({ id, data }) =>
            db
                .updateTable('assets')
                .set({
                    ...data,
                    updated_at: timestamp,
                })
                .where('id', '=', id)
                .execute(),
        ),
    );
}
