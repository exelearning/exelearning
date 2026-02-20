/**
 * Migration 006: Add impersonation audit log table
 *
 * Stores who impersonated whom and when the impersonation started/ended.
 */
import { Kysely } from 'kysely';
import { addAutoIncrement, getAutoIncrementType } from '../helpers';

export async function up(db: Kysely<unknown>): Promise<void> {
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

    await db.schema
        .createIndex('idx_impersonation_audit_impersonator')
        .ifNotExists()
        .on('impersonation_audit_logs')
        .column('impersonator_user_id')
        .execute();

    await db.schema
        .createIndex('idx_impersonation_audit_impersonated')
        .ifNotExists()
        .on('impersonation_audit_logs')
        .column('impersonated_user_id')
        .execute();

    await db.schema
        .createIndex('idx_impersonation_audit_started_at')
        .ifNotExists()
        .on('impersonation_audit_logs')
        .column('started_at')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('impersonation_audit_logs').ifExists().execute();
}
