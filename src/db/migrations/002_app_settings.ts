/**
 * Migration: Add app_settings table
 * Stores admin-configurable application settings
 */
import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable('app_settings')
        .ifNotExists()
        .addColumn('key', 'varchar(255)', col => col.primaryKey())
        .addColumn('value', 'text', col => col.notNull())
        .addColumn('type', 'varchar(20)', col => col.notNull().defaultTo('string'))
        .addColumn('updated_at', 'text')
        .addColumn('updated_by', 'integer')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('app_settings').execute();
}
