/**
 * Migration 008: Add public_view_id to projects
 *
 * Adds an opaque, nullable public view identifier used for public read-only
 * viewer URLs (`/view/:publicViewId`). It is distinct from the internal project
 * UUID so that public links never expose the editing identifier. A unique index
 * guarantees uniqueness; multiple NULLs are allowed (private projects).
 */
import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('projects').addColumn('public_view_id', 'varchar(36)').execute();

    // Unique index. SQL unique indexes permit multiple NULL values on SQLite,
    // PostgreSQL and MariaDB, so private projects (NULL) do not collide.
    await db.schema
        .createIndex('idx_projects_public_view_id')
        .ifNotExists()
        .unique()
        .on('projects')
        .column('public_view_id')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropIndex('idx_projects_public_view_id').ifExists().execute();
    await db.schema.alterTable('projects').dropColumn('public_view_id').execute();
}
