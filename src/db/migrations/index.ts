/**
 * Kysely Migrations
 * Programmatic migrations for SQLite, PostgreSQL, and MySQL
 */
import { Kysely, Migrator, sql, type Migration, type MigrationProvider } from 'kysely';
import { tableExists as tableExistsHelper } from '../helpers';

// Import all migrations
import * as migration000 from './000_legacy_symfony';
import * as migration001 from './001_initial';

// ============================================================================
// MIGRATION REGISTRY
// ============================================================================

const migrations: Record<string, Migration> = {
    '000_legacy_symfony': migration000,
    '001_initial': migration001,
};

// ============================================================================
// MIGRATION PROVIDER
// ============================================================================

class StaticMigrationProvider implements MigrationProvider {
    async getMigrations(): Promise<Record<string, Migration>> {
        return migrations;
    }
}

// ============================================================================
// MIGRATOR FACTORY
// ============================================================================

export function createMigrator(db: Kysely<unknown>): Migrator {
    return new Migrator({
        db,
        provider: new StaticMigrationProvider(),
    });
}

// ============================================================================
// DEPENDENCY INJECTION FOR TESTING
// ============================================================================

export interface MigrationDependencies {
    createMigrator: (db: Kysely<unknown>) => Migrator;
}

const defaultDependencies: MigrationDependencies = {
    createMigrator,
};

// ============================================================================
// LEGACY DATABASE DETECTION
// ============================================================================

/**
 * Check if a table exists in the database (cross-database compatible)
 */
export async function tableExists(db: Kysely<unknown>, tableName: string): Promise<boolean> {
    return tableExistsHelper(db, tableName);
}

/**
 * Check if this is a legacy database with tables but no migration tracking.
 * If so, register existing migrations as already applied.
 *
 * Database states:
 * 1. Fresh DB: No tables at all → Run 001_initial, skip 002_legacy_symfony
 * 2. Symfony legacy DB: users exists, projects doesn't → Run 001_initial (creates new tables), run 002_legacy_symfony
 * 3. Elysia DB without tracking: users+projects exist, no kysely_migration → Mark 001_initial as applied
 * 4. Normal DB with tracking: Run pending migrations as normal
 */
async function syncLegacyMigrations(db: Kysely<unknown>): Promise<void> {
    const usersTableExists = await tableExists(db, 'users');
    const projectsTableExists = await tableExists(db, 'projects');
    const migrationTableExists = await tableExists(db, 'kysely_migration');

    // State 1: Fresh DB - nothing to sync, migrations will create everything
    if (!usersTableExists) {
        return;
    }

    // State 2: Symfony legacy DB (has users but no projects table)
    // 001_initial will create new tables (uses ifNotExists)
    // 002_legacy_symfony will clean up old Symfony schema
    if (usersTableExists && !projectsTableExists) {
        console.log('[DB] Detected Symfony legacy database...');

        if (!migrationTableExists) {
            // Create migration tracking tables
            await db.schema
                .createTable('kysely_migration')
                .ifNotExists()
                .addColumn('name', 'varchar(255)', col => col.primaryKey())
                .addColumn('timestamp', 'varchar(255)', col => col.notNull())
                .execute();

            await db.schema
                .createTable('kysely_migration_lock')
                .ifNotExists()
                .addColumn('id', 'varchar(255)', col => col.primaryKey())
                .addColumn('is_locked', 'integer', col => col.notNull().defaultTo(0))
                .execute();

            // Initialize lock
            await sql`
                INSERT INTO kysely_migration_lock (id, is_locked)
                VALUES ('migration_lock', 0)
            `.execute(db);
        }

        // Let migrations run normally - 001_initial will create missing tables,
        // 002_legacy_symfony will clean up Symfony-specific schema
        console.log('[DB] Migration tracking created, will run schema updates');
        return;
    }

    // State 3: Elysia DB without tracking (users+projects exist but no migration table)
    if (usersTableExists && projectsTableExists && !migrationTableExists) {
        console.log('[DB] Detected existing Elysia database without migration tracking...');

        // Create migration tables
        await db.schema
            .createTable('kysely_migration')
            .ifNotExists()
            .addColumn('name', 'varchar(255)', col => col.primaryKey())
            .addColumn('timestamp', 'varchar(255)', col => col.notNull())
            .execute();

        await db.schema
            .createTable('kysely_migration_lock')
            .ifNotExists()
            .addColumn('id', 'varchar(255)', col => col.primaryKey())
            .addColumn('is_locked', 'integer', col => col.notNull().defaultTo(0))
            .execute();

        // Mark both migrations as already applied (schema is already correct)
        const timestamp = new Date().toISOString();
        await sql`
            INSERT INTO kysely_migration (name, timestamp)
            VALUES ('000_legacy_symfony', ${timestamp})
        `.execute(db);
        await sql`
            INSERT INTO kysely_migration (name, timestamp)
            VALUES ('001_initial', ${timestamp})
        `.execute(db);

        // Initialize lock
        await sql`
            INSERT INTO kysely_migration_lock (id, is_locked)
            VALUES ('migration_lock', 0)
        `.execute(db);

        console.log('[DB] Migration tracking created, both migrations marked as applied');
        return;
    }

    // State 4: Normal DB with tracking - check for missing initial migration record
    if (migrationTableExists) {
        const initialMigrationRecord = await sql<{ name: string }>`
            SELECT name FROM kysely_migration WHERE name = '001_initial'
        `.execute(db);

        if (initialMigrationRecord.rows.length === 0 && projectsTableExists) {
            // Schema exists but migration not recorded
            console.log('[DB] Syncing migration record for existing schema...');
            const timestamp = new Date().toISOString();
            await sql`
                INSERT INTO kysely_migration (name, timestamp)
                VALUES ('000_legacy_symfony', ${timestamp})
            `.execute(db);
            await sql`
                INSERT INTO kysely_migration (name, timestamp)
                VALUES ('001_initial', ${timestamp})
            `.execute(db);
            console.log('[DB] Migrations marked as applied');
        }
    }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Run all pending migrations
 */
export async function migrateToLatest(
    db: Kysely<unknown>,
    deps: MigrationDependencies = defaultDependencies,
): Promise<{
    success: boolean;
    executedMigrations: string[];
    error?: Error;
}> {
    // Sync legacy databases first (detect existing tables without migration tracking)
    await syncLegacyMigrations(db);

    const migrator = deps.createMigrator(db);
    const { error, results } = await migrator.migrateToLatest();

    const executedMigrations = results?.filter(r => r.status === 'Success').map(r => r.migrationName) || [];

    if (error) {
        console.error('Migration failed:', error);
        return { success: false, executedMigrations, error };
    }

    if (executedMigrations.length > 0) {
        console.log('Migrations executed:', executedMigrations.join(', '));
    } else {
        console.log('No pending migrations');
    }

    return { success: true, executedMigrations };
}

/**
 * Rollback the last migration
 */
export async function migrateDown(
    db: Kysely<unknown>,
    deps: MigrationDependencies = defaultDependencies,
): Promise<{
    success: boolean;
    rolledBack?: string;
    error?: Error;
}> {
    const migrator = deps.createMigrator(db);
    const { error, results } = await migrator.migrateDown();

    const rolledBack = results?.find(r => r.status === 'Success')?.migrationName;

    if (error) {
        console.error('Rollback failed:', error);
        return { success: false, error };
    }

    if (rolledBack) {
        console.log('Rolled back:', rolledBack);
    } else {
        console.log('No migrations to rollback');
    }

    return { success: true, rolledBack };
}

/**
 * Get migration status
 */
export async function getMigrationStatus(
    db: Kysely<unknown>,
    deps: MigrationDependencies = defaultDependencies,
): Promise<{
    executed: string[];
    pending: string[];
}> {
    const migrator = deps.createMigrator(db);
    const allMigrations = await migrator.getMigrations();

    const executed: string[] = [];
    const pending: string[] = [];

    for (const migration of allMigrations) {
        if (migration.executedAt) {
            executed.push(migration.name);
        } else {
            pending.push(migration.name);
        }
    }

    return { executed, pending };
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

/**
 * CLI dependencies for testing
 */
export interface CliDependencies {
    db: Kysely<unknown>;
    argv: string[];
    exit: (code: number) => void;
}

/**
 * Run migrations from command line (exported for testing)
 */
export async function runCli(deps: CliDependencies): Promise<void> {
    const { db, argv, exit } = deps;
    const command = argv[2] || 'up';

    try {
        switch (command) {
            case 'up':
                await migrateToLatest(db);
                break;
            case 'down':
                await migrateDown(db);
                break;
            case 'status': {
                const status = await getMigrationStatus(db);
                console.log('Executed migrations:', status.executed);
                console.log('Pending migrations:', status.pending);
                break;
            }
            default:
                console.error('Unknown command:', command);
                console.log('Usage: bun run migrations/index.ts [up|down|status]');
                exit(1);
                return;
        }
    } finally {
        await db.destroy();
    }
}

/**
 * Main dependencies for testing
 */
export interface MainDependencies {
    getDb: () => Promise<Kysely<unknown>>;
    argv: string[];
    exit: (code: number) => void;
}

const defaultMainDeps: MainDependencies = {
    getDb: async () => {
        const { db } = await import('../client');
        return db;
    },
    argv: process.argv,
    exit: process.exit,
};

/**
 * Run migrations from command line
 * Usage: bun run src/db/migrations/index.ts [up|down|status]
 */
export async function main(deps: MainDependencies = defaultMainDeps) {
    const db = await deps.getDb();

    await runCli({
        db,
        argv: deps.argv,
        exit: deps.exit,
    });
}

// Run if executed directly
if (import.meta.main) {
    main().catch(console.error);
}
