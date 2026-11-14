/**
 * Project Activity Queries - Kysely ORM (issue #2689, ADR-2689-01)
 * Type-safe queries for SQLite, PostgreSQL, and MySQL/MariaDB.
 * All functions accept db as first parameter for dependency injection.
 *
 * Portability notes:
 * - Plain inserts; the id is read back through RETURNING where supported and
 *   through insertId on MySQL.
 * - Coalescing is a conditional UPDATE by primary key, no upsert syntax.
 * - Retention deletes by explicit id batches (no LIMIT inside DELETE, which
 *   MySQL forbids on a subquery of the same table).
 * - bigint columns may come back as strings on PostgreSQL; callers normalise.
 */
import { sql, type Kysely } from 'kysely';
import type { Database, NewProjectActivity, ProjectActivity } from '../types';
import { supportsReturning } from '../helpers';

// ============================================================================
// INSERT / COALESCE
// ============================================================================

/**
 * Insert one activity row and return its id when the driver exposes it.
 */
export async function insertProjectActivity(
    db: Kysely<Database>,
    row: NewProjectActivity,
): Promise<number | undefined> {
    if (supportsReturning()) {
        const inserted = await db.insertInto('project_activity').values(row).returning('id').executeTakeFirst();
        return inserted?.id;
    }
    const result = await db.insertInto('project_activity').values(row).executeTakeFirst();
    return result.insertId !== undefined ? Number(result.insertId) : undefined;
}

/**
 * True when a client-reported event with this dedupe key was already stored
 * for the project (idempotent retries, see spec R8/R9).
 */
export async function hasProjectActivityDedupeKey(
    db: Kysely<Database>,
    projectId: number,
    dedupeKey: string,
): Promise<boolean> {
    const row = await db
        .selectFrom('project_activity')
        .select('id')
        .where('project_id', '=', projectId)
        .where('dedupe_key', '=', dedupeKey)
        .executeTakeFirst();
    return row !== undefined;
}

/**
 * Newest row of one event type by one actor in a project whose last
 * occurrence is not older than `since` — the candidate for coalescing a
 * repeated automatic save into a single entry.
 */
export async function findLatestProjectActivityForCoalesce(
    db: Kysely<Database>,
    projectId: number,
    userId: number,
    eventType: string,
    since: number,
): Promise<ProjectActivity | undefined> {
    return db
        .selectFrom('project_activity')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('user_id', '=', userId)
        .where('event_type', '=', eventType)
        .where('occurred_at', '>=', since)
        .orderBy('occurred_at', 'desc')
        .orderBy('id', 'desc')
        .limit(1)
        .executeTakeFirst();
}

/**
 * Fold one more occurrence into an existing row: bump the counter, move the
 * last-occurrence timestamp and replace the details.
 */
export async function incrementProjectActivity(
    db: Kysely<Database>,
    id: number,
    occurredAt: number,
    details: string | null,
): Promise<boolean> {
    const result = await db
        .updateTable('project_activity')
        .set({
            event_count: sql<number>`event_count + 1`,
            occurred_at: occurredAt,
            details,
        })
        .where('id', '=', id)
        .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0) === 1;
}

/**
 * True when this client editor session already recorded its `session.opened`
 * (reconnections must not add rows, see spec R7).
 */
export async function hasProjectSessionOpened(
    db: Kysely<Database>,
    projectId: number,
    userId: number,
    sessionId: string,
): Promise<boolean> {
    const row = await db
        .selectFrom('project_activity')
        .select('id')
        .where('project_id', '=', projectId)
        .where('user_id', '=', userId)
        .where('event_type', '=', 'session.opened')
        .where('session_id', '=', sessionId)
        .executeTakeFirst();
    return row !== undefined;
}

// ============================================================================
// READ
// ============================================================================

export interface ProjectActivityCursor {
    occurredAt: number;
    id: number;
}

export interface ListProjectActivityOptions {
    /** Only events by this actor (a null actor cannot be filtered; deleted users show as such). */
    userId?: number;
    /** Inclusive lower bound on occurred_at (ms). */
    since?: number;
    /** Exclusive upper bound on occurred_at (ms). */
    until?: number;
    /** Page size, already validated by the caller. */
    limit: number;
    /** Keyset cursor: rows strictly older than this (occurred_at, id) pair. */
    cursor?: ProjectActivityCursor;
}

export interface ProjectActivityListRow extends ProjectActivity {
    actor_email: string | null;
}

/**
 * Project-scoped chronological page, newest first, with stable keyset
 * pagination on (occurred_at desc, id desc). Fetches limit + 1 rows to know
 * whether another page exists without a COUNT.
 */
export async function listProjectActivity(
    db: Kysely<Database>,
    projectId: number,
    options: ListProjectActivityOptions,
): Promise<{ rows: ProjectActivityListRow[]; nextCursor: ProjectActivityCursor | null }> {
    let query = db
        .selectFrom('project_activity')
        .leftJoin('users', 'users.id', 'project_activity.user_id')
        .selectAll('project_activity')
        .select('users.email as actor_email')
        .where('project_activity.project_id', '=', projectId);

    if (options.userId !== undefined) {
        query = query.where('project_activity.user_id', '=', options.userId);
    }
    if (options.since !== undefined) {
        query = query.where('project_activity.occurred_at', '>=', options.since);
    }
    if (options.until !== undefined) {
        query = query.where('project_activity.occurred_at', '<', options.until);
    }
    if (options.cursor) {
        const { occurredAt, id } = options.cursor;
        query = query.where(eb =>
            eb.or([
                eb('project_activity.occurred_at', '<', occurredAt),
                eb.and([eb('project_activity.occurred_at', '=', occurredAt), eb('project_activity.id', '<', id)]),
            ]),
        );
    }

    const rows = (await query
        .orderBy('project_activity.occurred_at', 'desc')
        .orderBy('project_activity.id', 'desc')
        .limit(options.limit + 1)
        .execute()) as ProjectActivityListRow[];

    const hasMore = rows.length > options.limit;
    const page = hasMore ? rows.slice(0, options.limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? { occurredAt: Number(last.occurred_at), id: Number(last.id) } : null;
    return { rows: page, nextCursor };
}

/**
 * Distinct actors that appear in a project's log, for the user filter.
 * A null user id means at least one row belongs to a deleted account.
 */
export async function listProjectActivityActors(
    db: Kysely<Database>,
    projectId: number,
): Promise<Array<{ user_id: number | null; email: string | null }>> {
    const rows = await db
        .selectFrom('project_activity')
        .leftJoin('users', 'users.id', 'project_activity.user_id')
        .select(['project_activity.user_id as user_id', 'users.email as email'])
        .where('project_activity.project_id', '=', projectId)
        .groupBy(['project_activity.user_id', 'users.email'])
        .orderBy('users.email', 'asc')
        .execute();
    return rows.map(r => ({ user_id: r.user_id === null ? null : Number(r.user_id), email: r.email ?? null }));
}

/**
 * Users referenced as targets (sharing events) resolved for display.
 */
export async function findUserEmailsByIds(db: Kysely<Database>, ids: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (ids.length === 0) return map;
    const rows = await db.selectFrom('users').select(['id', 'email']).where('id', 'in', ids).execute();
    for (const row of rows) map.set(Number(row.id), row.email);
    return map;
}

export async function countProjectActivity(db: Kysely<Database>, projectId: number): Promise<number> {
    const result = await db
        .selectFrom('project_activity')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .where('project_id', '=', projectId)
        .executeTakeFirst();
    return Number(result?.count ?? 0);
}

// ============================================================================
// RETENTION
// ============================================================================

/**
 * Delete one bounded batch of rows whose last occurrence is older than
 * `cutoff`. Returns the number of rows removed; callers loop while the batch
 * is full. Two instances running concurrently simply race on disjoint or
 * already-deleted ids, which is harmless.
 */
export async function deleteProjectActivityBefore(
    db: Kysely<Database>,
    cutoff: number,
    batchSize: number,
): Promise<number> {
    const victims = await db
        .selectFrom('project_activity')
        .select('id')
        .where('occurred_at', '<', cutoff)
        .orderBy('id', 'asc')
        .limit(batchSize)
        .execute();
    if (victims.length === 0) return 0;
    const ids = victims.map(v => Number(v.id));
    const result = await db.deleteFrom('project_activity').where('id', 'in', ids).execute();
    return Number(result[0]?.numDeletedRows ?? 0);
}

/**
 * Delete every row of a project (explicit cleanup paths; the FK cascade covers
 * the plain project delete).
 */
export async function deleteProjectActivityForProject(db: Kysely<Database>, projectId: number): Promise<void> {
    await db.deleteFrom('project_activity').where('project_id', '=', projectId).execute();
}
