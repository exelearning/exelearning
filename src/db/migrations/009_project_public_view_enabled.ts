/**
 * Migration 009: Add public_view_enabled to projects
 *
 * Controls whether a project exposes a public read-only viewer link
 * (`/view/:public_view_id`). This is intentionally independent of `visibility`
 * (which governs edit access): a project can be edit-private yet still publish
 * a public read-only link, or be edit-public without one.
 *
 * Stored as an integer flag (0/1) for cross-database portability, matching the
 * existing `saved_once` column convention.
 */
import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .alterTable('projects')
        .addColumn('public_view_enabled', 'integer', col => col.notNull().defaultTo(0))
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('projects').dropColumn('public_view_enabled').execute();
}
