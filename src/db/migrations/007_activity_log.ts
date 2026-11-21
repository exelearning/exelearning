/**
 * Migration 007: Add activity log table
 *
 * Activity log for dashboard analytics: auth events, project creation, impersonation.
 */

import { type UntypedKysely, addAutoIncrement, getAutoIncrementType, createIndexIfNotExists } from '../helpers';

export async function up(db: UntypedKysely): Promise<void> {
    const idType = getAutoIncrementType();

    await db.schema
        .createTable('activity_log')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('event_type', 'varchar(50)', col => col.notNull())
        .addColumn('user_id', 'integer', col => col.references('users.id').onDelete('set null'))
        .addColumn('created_at', 'bigint', col => col.notNull())
        .execute();

    await createIndexIfNotExists(db, 'idx_activity_log_type_created', 'activity_log', index =>
        index.columns(['event_type', 'created_at']),
    );

    await createIndexIfNotExists(db, 'idx_activity_log_actor_created', 'activity_log', index =>
        index.columns(['user_id', 'created_at']),
    );

    await createIndexIfNotExists(db, 'idx_activity_log_created', 'activity_log', index => index.column('created_at'));
}

export async function down(db: UntypedKysely): Promise<void> {
    console.warn('[Migration 007] Dropping activity_log table — all audit data will be lost.');
    await db.schema.dropTable('activity_log').ifExists().execute();
}
