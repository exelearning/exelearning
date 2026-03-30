/**
 * Migration 007: Add activity log table
 *
 * Activity log for dashboard analytics: auth events, project creation, impersonation.
 */
import { Kysely } from 'kysely';
import { addAutoIncrement, getAutoIncrementType } from '../helpers';

export async function up(db: Kysely<unknown>): Promise<void> {
    const idType = getAutoIncrementType();

    await db.schema
        .createTable('activity_log')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('event_type', 'varchar(50)', col => col.notNull())
        .addColumn('user_id', 'integer', col => col.references('users.id').onDelete('set null'))
        .addColumn('created_at', 'bigint', col => col.notNull())
        .execute();

    await db.schema
        .createIndex('idx_activity_log_type_created')
        .ifNotExists()
        .on('activity_log')
        .columns(['event_type', 'created_at'])
        .execute();

    await db.schema
        .createIndex('idx_activity_log_actor_created')
        .ifNotExists()
        .on('activity_log')
        .columns(['user_id', 'created_at'])
        .execute();

    await db.schema
        .createIndex('idx_activity_log_created')
        .ifNotExists()
        .on('activity_log')
        .column('created_at')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    console.warn('[Migration 007] Dropping activity_log table — all audit data will be lost.');
    await db.schema.dropTable('activity_log').ifExists().execute();
}
