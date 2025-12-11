/**
 * Legacy Database Handler
 *
 * Handles detection and migration of legacy Symfony 3.0 databases
 * to the new NestJS 3.1+ schema.
 *
 * For SQLite: backs up and recreates the database file
 * For MySQL/PostgreSQL: renames legacy tables with 'old_' prefix
 */

import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';

/**
 * List of legacy tables from Symfony 3.0 that should be renamed.
 * These tables are incompatible with the new Yjs-based architecture.
 */
const LEGACY_TABLES = [
    // Doctrine/Symfony migration tracking tables
    'doctrine_migration_versions',
    'migration_versions',
    // ODE-based tables (replaced by Yjs documents)
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

/**
 * Handle legacy SQLite database.
 *
 * Checks if an existing SQLite database is from Symfony 3.0 (legacy).
 * If legacy is detected, backs up the file and returns an empty database.
 *
 * @param dbPath - Path to the SQLite database file
 * @param logger - NestJS logger instance
 * @returns Database content as Uint8Array (empty if legacy was detected)
 */
export async function handleLegacySQLite(
    dbPath: string,
    logger: Logger,
): Promise<Uint8Array> {
    if (!fs.existsSync(dbPath)) {
        logger.log('No existing database found, will create new one');
        return new Uint8Array();
    }

    try {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        const fileBuffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(fileBuffer);

        let isLegacyDb = false;
        let legacyReason = '';

        try {
            // Check users_preferences table schema
            const tableInfo = db.exec(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='users_preferences'",
            );

            if (tableInfo.length > 0 && tableInfo[0].values.length > 0) {
                const createSql = String(tableInfo[0].values[0][0] || '');
                // Legacy Symfony schema uses 'key' instead of 'preference_key'
                if (createSql && !createSql.includes('preference_key')) {
                    isLegacyDb = true;
                    legacyReason = 'users_preferences table missing preference_key column';
                }
            }

            // Check for Symfony-specific tables
            const symfonyTables = db.exec(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('doctrine_migration_versions', 'migration_versions')",
            );
            if (symfonyTables.length > 0 && symfonyTables[0].values.length > 0) {
                isLegacyDb = true;
                legacyReason = 'Found Symfony/Doctrine migration tables';
            }

            // Check for any ODE tables
            const odeTables = db.exec(
                "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ode_%'",
            );
            if (odeTables.length > 0 && odeTables[0].values.length > 0) {
                isLegacyDb = true;
                legacyReason = 'Found legacy ODE tables';
            }
        } catch (e) {
            logger.warn(`Could not inspect database schema: ${e.message}`);
        }

        db.close();

        if (isLegacyDb) {
            // Backup the legacy database
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${dbPath}.symfony-backup-${timestamp}`;

            logger.warn(`Detected legacy Symfony database (${legacyReason})`);
            logger.warn(`Backing up to: ${backupPath}`);

            fs.copyFileSync(dbPath, backupPath);
            fs.unlinkSync(dbPath);

            logger.log('Legacy database backed up, will create new NestJS-compatible database');
            return new Uint8Array();
        }

        // Database is compatible, use it
        logger.log('Existing database is compatible');
        return fileBuffer;
    } catch (error) {
        logger.error(`Error checking database compatibility: ${error.message}`);
        // If we can't read the database, backup and start fresh
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${dbPath}.corrupted-backup-${timestamp}`;

        try {
            fs.copyFileSync(dbPath, backupPath);
            fs.unlinkSync(dbPath);
            logger.warn(`Database appears corrupted, backed up to: ${backupPath}`);
        } catch (backupError) {
            logger.error(`Could not backup corrupted database: ${backupError.message}`);
        }

        return new Uint8Array();
    }
}

/**
 * Handle legacy MySQL/PostgreSQL database.
 *
 * Detects legacy Symfony 3.0 tables and renames them with 'old_' prefix.
 * This preserves the data while allowing TypeORM to create new tables.
 *
 * @param dataSource - TypeORM DataSource connected to the database
 * @param logger - NestJS logger instance
 * @returns true if legacy tables were detected and renamed
 */
export async function handleLegacyDatabaseSQL(
    dataSource: DataSource,
    logger: Logger,
): Promise<boolean> {
    const queryRunner = dataSource.createQueryRunner();

    try {
        let legacyDetected = false;
        const renamedTables: string[] = [];

        // Check and rename legacy tables
        for (const tableName of LEGACY_TABLES) {
            const tableExists = await queryRunner.hasTable(tableName);
            if (tableExists) {
                legacyDetected = true;
                const newName = `old_${tableName}`;

                // Check if old_ version already exists (idempotency)
                const oldExists = await queryRunner.hasTable(newName);
                if (!oldExists) {
                    await queryRunner.renameTable(tableName, newName);
                    renamedTables.push(tableName);
                    logger.log(`Renamed legacy table: ${tableName} → ${newName}`);
                } else {
                    logger.log(`Legacy table ${tableName} already migrated (${newName} exists)`);
                }
            }
        }

        // Check users_preferences for legacy schema (has 'key' column instead of 'preference_key')
        const userPrefsTable = await queryRunner.getTable('users_preferences');
        if (userPrefsTable) {
            const keyColumn = userPrefsTable.findColumnByName('key');
            if (keyColumn) {
                legacyDetected = true;
                const oldExists = await queryRunner.hasTable('old_users_preferences');
                if (!oldExists) {
                    await queryRunner.renameTable('users_preferences', 'old_users_preferences');
                    renamedTables.push('users_preferences');
                    logger.log('Renamed legacy table: users_preferences → old_users_preferences');
                }
            }
        }

        // Also check user_preferences (singular, pre-rename)
        const userPrefTable = await queryRunner.getTable('user_preferences');
        if (userPrefTable) {
            legacyDetected = true;
            const oldExists = await queryRunner.hasTable('old_user_preferences');
            if (!oldExists) {
                await queryRunner.renameTable('user_preferences', 'old_user_preferences');
                renamedTables.push('user_preferences');
                logger.log('Renamed legacy table: user_preferences → old_user_preferences');
            }
        }

        // Check assets table for legacy schema (has 'size' column instead of 'file_size')
        const assetsTable = await queryRunner.getTable('assets');
        if (assetsTable) {
            const sizeColumn = assetsTable.findColumnByName('size');
            if (sizeColumn) {
                legacyDetected = true;
                const oldExists = await queryRunner.hasTable('old_assets');
                if (!oldExists) {
                    await queryRunner.renameTable('assets', 'old_assets');
                    renamedTables.push('assets');
                    logger.log('Renamed legacy table: assets → old_assets');
                }
            }
        }

        if (legacyDetected) {
            logger.warn('Detected legacy Symfony 3.0 database schema');
            if (renamedTables.length > 0) {
                logger.warn(`Renamed ${renamedTables.length} legacy tables with 'old_' prefix`);
                logger.log('Legacy data preserved in old_* tables for manual migration if needed');
            }
            logger.log('TypeORM will now create new NestJS-compatible tables');
        } else {
            logger.log('Database schema is compatible with NestJS');
        }

        return legacyDetected;
    } finally {
        await queryRunner.release();
    }
}
