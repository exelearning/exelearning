/**
 * Migration 006: Add impersonation audit log table
 *
 * Stores who impersonated whom and when the impersonation started/ended.
 */

import { type UntypedKysely, addAutoIncrement, getAutoIncrementType, createIndexIfNotExists } from '../helpers';

export async function up(db: UntypedKysely): Promise<void> {
    const idType = getAutoIncrementType();

    await db.schema
        .createTable('impersonation_audit_logs')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('session_id', 'varchar(64)', col => col.notNull().unique())
        .addColumn('impersonator_user_id', 'integer', col => col.notNull().references('users.id').onDelete('cascade'))
        .addColumn('impersonated_user_id', 'integer', col => col.notNull().references('users.id').onDelete('cascade'))
        .addColumn('started_at', 'bigint', col => col.notNull())
        .addColumn('ended_at', 'bigint')
        .addColumn('started_by_ip', 'varchar(64)')
        .addColumn('started_user_agent', 'varchar(1024)')
        .addColumn('ended_by_ip', 'varchar(64)')
        .addColumn('ended_user_agent', 'varchar(1024)')
        .execute();

    await createIndexIfNotExists(db, 'idx_impersonation_audit_impersonator', 'impersonation_audit_logs', index =>
        index.column('impersonator_user_id'),
    );

    await createIndexIfNotExists(db, 'idx_impersonation_audit_impersonated', 'impersonation_audit_logs', index =>
        index.column('impersonated_user_id'),
    );

    await createIndexIfNotExists(db, 'idx_impersonation_audit_started_at', 'impersonation_audit_logs', index =>
        index.column('started_at'),
    );
}

export async function down(db: UntypedKysely): Promise<void> {
    await db.schema.dropTable('impersonation_audit_logs').ifExists().execute();
}
