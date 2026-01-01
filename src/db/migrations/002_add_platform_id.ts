/**
 * Migration: Add platform_id column to projects table
 *
 * This column stores the external platform identifier (e.g., Moodle cmid)
 * when a project is saved to an LMS platform. This allows looking up
 * existing projects when users return from the platform.
 */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('projects').addColumn('platform_id', 'varchar(64)').execute();

    // Create index for platform_id lookups
    await db.schema.createIndex('idx_projects_platform_id').on('projects').column('platform_id').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropIndex('idx_projects_platform_id').execute();

    await db.schema.alterTable('projects').dropColumn('platform_id').execute();
}
