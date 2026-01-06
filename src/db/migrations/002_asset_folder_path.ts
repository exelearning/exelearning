/**
 * Migration: Add folder_path to assets table
 *
 * This migration adds folder support to the file manager by adding a folder_path
 * column to the assets table. The folder_path stores the relative folder path
 * from the project root (e.g., "", "website", "website/css").
 *
 * Folders are "virtual" - they are derived from the folder_path values of assets.
 * An empty folder_path means the asset is at the project root.
 */
import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Add folder_path column to assets table
    // Empty string = project root, "website/css" = nested folder
    await db.schema
        .alterTable('assets')
        .addColumn('folder_path', 'varchar(500)', col => col.notNull().defaultTo(''))
        .execute();

    // Add index for folder queries (list assets in a folder, get subfolders)
    await db.schema
        .createIndex('idx_assets_folder_path')
        .ifNotExists()
        .on('assets')
        .columns(['project_id', 'folder_path'])
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Remove index first
    await db.schema.dropIndex('idx_assets_folder_path').ifExists().execute();

    // Remove column
    await db.schema.alterTable('assets').dropColumn('folder_path').execute();
}
