/**
 * Migration 011: Per-project activity log (issue #2689, ADR-2689-01)
 *
 * Records who performed a meaningful action in a project (sharing and access
 * changes, editing sessions, saves, content changes reported by the browser,
 * imports, restorations), what it affected and when.
 *
 * Design notes:
 * - `project_id` cascades with the project; `user_id` becomes NULL when the
 *   user is deleted so the row stays readable with anonymised attribution.
 * - `details` is JSON stored as text for cross-database portability.
 * - Timestamps are millisecond Unix integers like every other table.
 * - `occurred_at` is the last occurrence of an aggregated entry and the
 *   ordering key; `first_occurred_at` opens the aggregation window.
 * - `dedupe_key` makes client-reported batches idempotent on retry. Every
 *   supported engine allows multiple NULLs in a unique index.
 */
import { Kysely } from 'kysely';
import { addAutoIncrement, getAutoIncrementType } from '../helpers';

export async function up(db: Kysely<unknown>): Promise<void> {
    const idType = getAutoIncrementType();

    await db.schema
        .createTable('project_activity')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('project_id', 'integer', col => col.notNull().references('projects.id').onDelete('cascade'))
        .addColumn('user_id', 'integer', col => col.references('users.id').onDelete('set null'))
        .addColumn('event_type', 'varchar(50)', col => col.notNull())
        .addColumn('target_type', 'varchar(20)')
        .addColumn('target_id', 'varchar(64)')
        .addColumn('target_label', 'varchar(160)')
        .addColumn('details', 'text')
        .addColumn('session_id', 'varchar(64)')
        .addColumn('dedupe_key', 'varchar(96)')
        .addColumn('event_count', 'integer', col => col.notNull().defaultTo(1))
        .addColumn('first_occurred_at', 'bigint', col => col.notNull())
        .addColumn('occurred_at', 'bigint', col => col.notNull())
        .addColumn('created_at', 'bigint', col => col.notNull())
        .execute();

    // Project-scoped chronological pagination (keyset on occurred_at, id).
    await db.schema
        .createIndex('idx_project_activity_project_occurred')
        .ifNotExists()
        .on('project_activity')
        .columns(['project_id', 'occurred_at', 'id'])
        .execute();

    // Filter by actor inside a project.
    await db.schema
        .createIndex('idx_project_activity_project_user')
        .ifNotExists()
        .on('project_activity')
        .columns(['project_id', 'user_id', 'occurred_at'])
        .execute();

    // Retention pruning across projects.
    await db.schema
        .createIndex('idx_project_activity_occurred')
        .ifNotExists()
        .on('project_activity')
        .column('occurred_at')
        .execute();

    // Idempotent client-reported batches.
    await db.schema
        .createIndex('uq_project_activity_dedupe')
        .ifNotExists()
        .unique()
        .on('project_activity')
        .columns(['project_id', 'dedupe_key'])
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    console.warn('[Migration 011] Dropping project_activity table — all project activity history will be lost.');
    await db.schema.dropTable('project_activity').ifExists().execute();
}
