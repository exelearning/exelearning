/**
 * Migration 008: Add project folders
 *
 * Lets each user organize the projects they can see (owned or shared with
 * them) into personal folders. Scoped per user_id (not per project) because a
 * shared project is visible to multiple users who may want to file it
 * differently — see ADR for the per-user-vs-per-project decision.
 *
 * Folders can nest up to a service-enforced depth (see MAX_FOLDER_DEPTH in
 * src/services/project-folder-manager.ts) via the self-referencing
 * parent_folder_id. There is no DB-level unique constraint on folder name:
 * SQL treats every NULL as distinct in a unique index, so a
 * (user_id, parent_folder_id, name) constraint cannot prevent duplicate
 * *root* folder names (parent_folder_id IS NULL for all of them) — sibling
 * name uniqueness is therefore validated in the service layer instead.
 */
import { Kysely } from 'kysely';
import { addAutoIncrement, getAutoIncrementType } from '../helpers';

export async function up(db: Kysely<unknown>): Promise<void> {
    const idType = getAutoIncrementType();

    // ========================================================================
    // PROJECT FOLDERS
    // ========================================================================
    await db.schema
        .createTable('project_folders')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('uuid', 'varchar(36)', col => col.notNull().unique())
        .addColumn('user_id', 'integer', col => col.notNull().references('users.id').onDelete('cascade'))
        .addColumn('parent_folder_id', 'integer', col => col.references('project_folders.id').onDelete('cascade'))
        .addColumn('name', 'varchar(255)', col => col.notNull())
        .addColumn('created_at', 'bigint') // Unix timestamp in milliseconds
        .addColumn('updated_at', 'bigint') // Unix timestamp in milliseconds
        .execute();

    // Not unique — see the module comment above. Speeds up "list this
    // folder's children" queries.
    await db.schema
        .createIndex('idx_project_folders_user_parent')
        .ifNotExists()
        .on('project_folders')
        .columns(['user_id', 'parent_folder_id'])
        .execute();

    // Speeds up descendant lookups when deleting a folder (cascade to
    // subfolders) or computing depth.
    await db.schema
        .createIndex('idx_project_folders_parent_id')
        .ifNotExists()
        .on('project_folders')
        .column('parent_folder_id')
        .execute();

    // ========================================================================
    // PROJECT FOLDER ASSIGNMENTS (Join Table)
    // A project can be in at most one folder per user; "unfiled" = no row.
    // ========================================================================
    await db.schema
        .createTable('project_folder_assignments')
        .ifNotExists()
        .addColumn('project_id', 'integer', col => col.notNull().references('projects.id').onDelete('cascade'))
        .addColumn('user_id', 'integer', col => col.notNull().references('users.id').onDelete('cascade'))
        .addColumn('folder_id', 'integer', col => col.notNull().references('project_folders.id').onDelete('cascade'))
        .addColumn('created_at', 'bigint') // Unix timestamp in milliseconds
        .addColumn('updated_at', 'bigint') // Unix timestamp in milliseconds
        .execute();

    await db.schema
        .createIndex('idx_project_folder_assignments_pk')
        .ifNotExists()
        .on('project_folder_assignments')
        .columns(['project_id', 'user_id'])
        .unique()
        .execute();

    await db.schema
        .createIndex('idx_project_folder_assignments_user_id')
        .ifNotExists()
        .on('project_folder_assignments')
        .column('user_id')
        .execute();

    await db.schema
        .createIndex('idx_project_folder_assignments_folder_id')
        .ifNotExists()
        .on('project_folder_assignments')
        .column('folder_id')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    console.warn('[Migration 008] Dropping project_folders tables — all folder organization will be lost.');
    await db.schema.dropTable('project_folder_assignments').ifExists().execute();
    await db.schema.dropTable('project_folders').ifExists().execute();
}
