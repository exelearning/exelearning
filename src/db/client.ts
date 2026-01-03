/**
 * Kysely ORM Client
 * Supports SQLite (bun:sqlite), PostgreSQL, and MySQL
 *
 * Database initialization is LAZY to allow CLI commands that don't
 * need the database to run without requiring DB_PATH to be set.
 */
import { Kysely } from 'kysely';
import type { Database } from './types';
import { createDialect, getDialectFromEnv, getDbConfig, type DbDialect } from './dialect';

// ============================================================================
// DATABASE INSTANCE (LAZY)
// ============================================================================

let _db: Kysely<Database> | null = null;
let _dialect: DbDialect | null = null;
let _config: ReturnType<typeof getDbConfig> | null = null;

/**
 * Get the database instance (lazy initialization)
 * This allows CLI commands that don't need the database to run
 * without requiring valid database configuration.
 */
export function getDb(): Kysely<Database> {
    if (!_db) {
        _dialect = getDialectFromEnv();
        _config = getDbConfig();
        _db = new Kysely<Database>({
            dialect: createDialect(_config),
        });
    }
    return _db;
}

/**
 * Reset lazy client cache (testing utility)
 */
export async function resetClientCacheForTesting(): Promise<void> {
    if (_db) {
        await _db.destroy();
    }
    _db = null;
    _dialect = null;
    _config = null;
}

// Legacy export for backwards compatibility - Proxy that lazy-loads
export const db: Kysely<Database> = new Proxy({} as Kysely<Database>, {
    get(_, prop) {
        const realDb = getDb();
        const value = realDb[prop as keyof Kysely<Database>];
        // Bind functions to the real db instance
        if (typeof value === 'function') {
            return value.bind(realDb);
        }
        return value;
    },
});

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get the current dialect (lazy - only available after getDb() is called)
 */
export function getDialect(): DbDialect {
    if (!_dialect) {
        _dialect = getDialectFromEnv();
    }
    return _dialect;
}

// Legacy export for backwards compatibility
export const dialect: DbDialect = new Proxy({} as DbDialect, {
    get(_, prop) {
        return getDialect()[prop as keyof DbDialect];
    },
}) as DbDialect;

export { getDbConfig, getDialectFromEnv };
export type { Database, DbDialect };

// Re-export types for convenience
export * from './types';

// ============================================================================
// LIFECYCLE
// ============================================================================

/**
 * Close the database connection gracefully
 */
export async function closeDb(): Promise<void> {
    await db.destroy();
}

/**
 * Check if the database is connected
 */
export async function isConnected(): Promise<boolean> {
    try {
        // Simple query to check connection
        await db.selectFrom('users').select('id').limit(1).execute();
        return true;
    } catch {
        return false;
    }
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Get database info for debugging
 */
export function getDbInfo() {
    const currentDialect = getDialect();
    const config = getDbConfig();

    // Hide password for non-SQLite databases
    if ('password' in config && config.password) {
        return {
            dialect: currentDialect,
            config: {
                ...config,
                password: '***',
            },
        };
    }

    return {
        dialect: currentDialect,
        config,
    };
}
