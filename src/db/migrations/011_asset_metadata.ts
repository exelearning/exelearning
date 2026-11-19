/**
 * Migration: Add centralized metadata columns to assets table
 *
 * Adds reusable, asset-level metadata so the File Manager can act as the single
 * source of truth for an image's description, name/title, license, author, author
 * link and source URL. These are the values that must NOT be re-entered on every
 * insertion. Per-instance, context-specific values (alternative text, accessibility
 * title, caption heading/notes) stay on the TinyMCE/iDevice insertion and are never
 * centralized here.
 *
 * All columns are nullable and have no default: existing assets keep behaving as
 * before (treated as empty metadata). Only portable `text` types are used so the
 * migration runs unchanged on SQLite, PostgreSQL and MariaDB/MySQL.
 *
 * Related issues: #1244 (searchable image descriptions), #1243 (centralized
 * "global" metadata), #1087 (Resources iDevice foundation).
 */
import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('assets').addColumn('description', 'text').execute();
    await db.schema.alterTable('assets').addColumn('title', 'text').execute();
    await db.schema.alterTable('assets').addColumn('license', 'text').execute();
    await db.schema.alterTable('assets').addColumn('author', 'text').execute();
    await db.schema.alterTable('assets').addColumn('author_url', 'text').execute();
    await db.schema.alterTable('assets').addColumn('source_url', 'text').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('assets').dropColumn('source_url').execute();
    await db.schema.alterTable('assets').dropColumn('author_url').execute();
    await db.schema.alterTable('assets').dropColumn('author').execute();
    await db.schema.alterTable('assets').dropColumn('license').execute();
    await db.schema.alterTable('assets').dropColumn('title').execute();
    await db.schema.alterTable('assets').dropColumn('description').execute();
}
