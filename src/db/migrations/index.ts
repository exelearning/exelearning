/**
 * Kysely Migrations
 * Programmatic migrations for SQLite, PostgreSQL, and MySQL
 */
import { Kysely, Migrator, sql, type Migration, type MigrationProvider } from 'kysely';

// Import all migrations
import * as migration001 from './001_initial';
import * as migration002 from './002_app_settings';

// ============================================================================
// MIGRATION REGISTRY
// ============================================================================

const migrations: Record<string, Migration> = {
    '001_initial': migration001,
    '002_app_settings': migration002,
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
    try {
        // Use information_schema for PostgreSQL/MySQL, sqlite_master for SQLite
        // We try SQLite first since it's our primary target
        const result = await sql<{ count: number }>`
            SELECT COUNT(*) as count FROM sqlite_master
            WHERE type='table' AND name=${tableName}
        `.execute(db);
        return (result.rows[0]?.count ?? 0) > 0;
    } catch {
        // If SQLite query fails, try information_schema (PostgreSQL/MySQL)
        // istanbul ignore next - requires PostgreSQL/MySQL database
        try {
            const result = await sql<{ count: number }>`
                SELECT COUNT(*) as count FROM information_schema.tables
                WHERE table_name = ${tableName}
            `.execute(db);
            return (result.rows[0]?.count ?? 0) > 0;
        } catch {
            return false;
        }
    }
}

/**
 * Check if this is a legacy database with tables but no migration tracking.
 * If so, register existing migrations as already applied.
 */
async function syncLegacyMigrations(db: Kysely<unknown>): Promise<void> {
    // 1. Check if application tables exist (users is the first one created)
    const usersTableExists = await tableExists(db, 'users');

    // If no application tables, this is a fresh database - nothing to sync
    if (!usersTableExists) {
        return;
    }

    // 2. Check if kysely_migration table exists
    const migrationTableExists = await tableExists(db, 'kysely_migration');

    // 3. If application tables exist but migration table doesn't, this is a legacy DB
    if (!migrationTableExists) {
        console.log('[DB] Detected legacy database, creating migration tracking...');

        // Create migration tables manually (Kysely does this automatically but we need to pre-populate)
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

        // Insert the initial migration as already executed
        const migrationTimestamp = new Date().toISOString();
        await sql`
            INSERT INTO kysely_migration (name, timestamp)
            VALUES ('001_initial', ${migrationTimestamp})
        `.execute(db);

        // Initialize lock
        await sql`
            INSERT INTO kysely_migration_lock (id, is_locked)
            VALUES ('migration_lock', 0)
        `.execute(db);

        console.log('[DB] Migration tracking created, 001_initial marked as applied');
        return;
    }

    // 4. If migration table exists but 001_initial not recorded, and tables exist
    const migrationRecord = await sql<{ name: string }>`
        SELECT name FROM kysely_migration WHERE name = '001_initial'
    `.execute(db);

    if (migrationRecord.rows.length === 0) {
        console.log('[DB] Detected existing tables without migration record, syncing...');
        const syncTimestamp = new Date().toISOString();
        await sql`
            INSERT INTO kysely_migration (name, timestamp)
            VALUES ('001_initial', ${syncTimestamp})
        `.execute(db);
        console.log('[DB] 001_initial marked as applied');
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
