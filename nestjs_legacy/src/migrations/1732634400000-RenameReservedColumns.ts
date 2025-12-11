import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Rename reserved SQL word columns
 *
 * This migration renames columns that use SQL reserved words to avoid
 * compatibility issues across different database engines (SQLite, PostgreSQL, MariaDB).
 *
 * Changes:
 * - assets.size -> assets.file_size
 * - users_preferences.key -> users_preferences.preference_key
 *
 * Also drops legacy ODE*Sync tables that are no longer used (Yjs is now source of truth).
 */
export class RenameReservedColumns1732634400000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if assets table exists and rename column
        const assetsTable = await queryRunner.getTable('assets');
        if (assetsTable) {
            const sizeColumn = assetsTable.findColumnByName('size');
            if (sizeColumn) {
                // SQLite doesn't support ALTER COLUMN RENAME directly
                // For SQLite, we need to use PRAGMA and recreate
                // TypeORM handles this automatically with changeColumn
                await queryRunner.changeColumn(
                    'assets',
                    'size',
                    new TableColumn({
                        name: 'file_size',
                        type: 'bigint',
                        isNullable: true,
                    }),
                );
            }
        }

        // Check if users_preferences table exists and rename column
        const userPrefsTable = await queryRunner.getTable('users_preferences');
        if (userPrefsTable) {
            const keyColumn = userPrefsTable.findColumnByName('key');
            if (keyColumn) {
                await queryRunner.changeColumn(
                    'users_preferences',
                    'key',
                    new TableColumn({
                        name: 'preference_key',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    }),
                );
            }
        }

        // Drop legacy ODE*Sync tables if they exist
        // These are replaced by Yjs document storage
        const legacyTables = [
            'ode_files',
            'ode_operations_log',
            'ode_properties_sync',
            'ode_nav_structure_sync',
            'ode_nav_structure_sync_properties',
            'ode_pag_structure_sync',
            'ode_pag_structure_sync_properties',
            'ode_components_sync',
            'ode_components_sync_properties',
            'current_ode_users',
        ];

        for (const tableName of legacyTables) {
            const tableExists = await queryRunner.getTable(tableName);
            if (tableExists) {
                await queryRunner.dropTable(tableName, true, true, true);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse the column renames
        const assetsTable = await queryRunner.getTable('assets');
        if (assetsTable) {
            const fileSizeColumn = assetsTable.findColumnByName('file_size');
            if (fileSizeColumn) {
                await queryRunner.changeColumn(
                    'assets',
                    'file_size',
                    new TableColumn({
                        name: 'size',
                        type: 'bigint',
                        isNullable: true,
                    }),
                );
            }
        }

        const userPrefsTable = await queryRunner.getTable('users_preferences');
        if (userPrefsTable) {
            const prefKeyColumn = userPrefsTable.findColumnByName('preference_key');
            if (prefKeyColumn) {
                await queryRunner.changeColumn(
                    'users_preferences',
                    'preference_key',
                    new TableColumn({
                        name: 'key',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    }),
                );
            }
        }

        // Note: ODE*Sync tables are not recreated in down migration
        // They are permanently deprecated
    }
}
