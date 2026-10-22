/**
 * Migration 010: Scope the platform binding of projects
 *
 * `platform_id` stores only the platform's course module id (Moodle cmid), which
 * is unique within one Moodle site but not across the sites that may share one
 * eXeLearning instance. These columns let each user keep a single project per
 * activity and know whether the platform's package changed since they last
 * exchanged it (issue #2549):
 *
 * - `platform_site`: base URL of the platform site the binding belongs to,
 *   derived from the platform JWT `returnurl`.
 * - `platform_package_hash`: SHA-256 (hex) of the last package received from or
 *   sent to the platform for this project.
 *
 * Existing rows keep their bare `platform_id` with both columns null; they are
 * still honoured by the post-back ownership check but not reused on edit.
 */
import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('projects').addColumn('platform_site', 'varchar(255)').execute();
    await db.schema.alterTable('projects').addColumn('platform_package_hash', 'varchar(64)').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('projects').dropColumn('platform_package_hash').execute();
    await db.schema.alterTable('projects').dropColumn('platform_site').execute();
}
