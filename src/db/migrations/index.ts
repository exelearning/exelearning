/**
 * Kysely Migrations
 * Programmatic migrations for SQLite, PostgreSQL, and MySQL
 */
import { Kysely, Migrator, sql, type Migration, type MigrationProvider } from 'kysely';
import { tableExists as tableExistsHelper, getDialect } from '../helpers';

// Import all migrations
import * as migration000 from './000_legacy_symfony';
import * as migration001 from './001_initial';
import * as migration002 from './002_asset_folder_path';
import * as migration003 from './003_user_id_length';

// ============================================================================
// MIGRATION REGISTRY
// ============================================================================

const migrations: Record<string, Migration> = {
    '000_legacy_symfony': migration000,
    '001_initial': migration001,
    '002_asset_folder_path': migration002,
    '003_user_id_length': migration003,
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
 * 1. Fresh DB: No tables at all → Run both migrations (000 is no-op, 001 creates tables)
 * 2. Symfony legacy DB: users exists, projects doesn't → Run 000 (cleanup) + 001 (create)
 * 3. Normal DB with tracking: kysely_migration exists → Run pending migrations
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
    // 000_legacy_symfony will clean up old Symfony schema
    // 001_initial will create new tables (uses ifNotExists)
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

            // Initialize lock (idempotent - handles case where lock already exists)
            const dialect = getDialect();
            if (dialect === 'mysql') {
                await sql`
                    INSERT IGNORE INTO kysely_migration_lock (id, is_locked)
                    VALUES ('migration_lock', 0)
                `.execute(db);
            } else if (dialect === 'postgres') {
                await sql`
                    INSERT INTO kysely_migration_lock (id, is_locked)
                    VALUES ('migration_lock', 0)
                    ON CONFLICT (id) DO NOTHING
                `.execute(db);
            } else {
                // SQLite
                await sql`
                    INSERT OR IGNORE INTO kysely_migration_lock (id, is_locked)
                    VALUES ('migration_lock', 0)
                `.execute(db);
            }
        }

        // Let migrations run normally - 000_legacy_symfony will clean up Symfony,
        // 001_initial will create missing tables
        console.log('[DB] Migration tracking created, will run schema updates');
        return;
    }

    // State 3: Normal DB with tracking - nothing to do
    // Kysely's migrator will handle pending migrations automatically
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Check if all migrations are already executed (without acquiring lock)
 */
async function areAllMigrationsExecuted(db: Kysely<unknown>): Promise<boolean> {
    const migrationTableExists = await tableExists(db, 'kysely_migration');
    const dialect = getDialect();
    console.log('[Migration] Migration table exists:', migrationTableExists);
    if (!migrationTableExists && dialect !== 'mysql') {
        return false; // No tracking table = need to run migrations
    }

    try {
        // Get all executed migration names - more reliable than COUNT across databases
        // Use raw SQL to avoid type issues with internal Kysely tables
        const result = await sql<{ name: string }>`
            SELECT name FROM kysely_migration
        `.execute(db);

        const executedNames = new Set(result.rows.map(r => r.name));
        const allMigrationNames = Object.keys(migrations);

        console.log('[Migration] Executed migrations:', [...executedNames]);
        console.log('[Migration] Required migrations:', allMigrationNames);

        // Check if all migrations are executed
        const allDone = allMigrationNames.every(name => executedNames.has(name));
        console.log('[Migration] All migrations done:', allDone);
        return allDone;
    } catch (err) {
        if (!migrationTableExists) {
            return false; // Table genuinely missing (or not visible) = need to run migrations
        }
        console.log('[Migration] Error checking migrations:', err);
        return false; // Error = need to run migrations to be safe
    }
}

/**
 * Clean up any stale migration locks before running migrations.
 * This is necessary because Kysely uses INSERT to acquire locks,
 * which fails in MySQL if a lock row already exists from a previous run.
 */
async function cleanStaleLocks(db: Kysely<unknown>): Promise<void> {
    try {
        // Delete any existing lock rows - they're stale since we're just starting
        // We try unconditionally because tableExists() might fail for some databases
        await sql`DELETE FROM kysely_migration_lock WHERE id = 'migration_lock'`.execute(db);
        console.log('[Migration] Cleaned stale locks');
    } catch (err) {
        // Ignore errors - table might not exist yet or be empty
        console.log('[Migration] No stale locks to clean (or table does not exist)');
    }
}

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

    // If all migrations are already executed, skip the migrator entirely
    // This avoids Kysely's lock acquisition which can fail on MySQL with stale locks
    if (await areAllMigrationsExecuted(db)) {
        console.log('No pending migrations');
        return { success: true, executedMigrations: [] };
    }

    // Clean up any stale locks from previous runs (fixes MySQL duplicate key error)
    await cleanStaleLocks(db);

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
