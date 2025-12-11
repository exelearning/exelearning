/**
 * Kysely Dialect Factory
 * SQLite only (using bun:sqlite)
 */
import type { Dialect } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { resolve, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';

// ============================================================================
// TYPES
// ============================================================================

export type DbDialect = 'sqlite';

export interface DbConfig {
    dialect: DbDialect;
    sqlitePath: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get database configuration from environment variables
 */
export function getDbConfig(): DbConfig {
    return {
        dialect: 'sqlite',
        sqlitePath: process.env.DB_PATH || 'data/exelearning.db',
    };
}

/**
 * Get the dialect type from environment
 */
export function getDialectFromEnv(): DbDialect {
    return 'sqlite';
}

// ============================================================================
// DIALECT FACTORY
// ============================================================================

/**
 * Create a Kysely dialect based on configuration
 */
export function createDialect(config?: DbConfig): Dialect {
    const cfg = config || getDbConfig();
    return createSqliteDialect(cfg.sqlitePath);
}

// ============================================================================
// SQLITE DIALECT
// ============================================================================

function createSqliteDialect(dbPath: string): Dialect {
    // Special case: in-memory database (no directory creation needed)
    if (dbPath === ':memory:') {
        return new BunSqliteDialect({ url: ':memory:' });
    }

    // Resolve path for file-based database
    const fullPath = dbPath.startsWith('/') ? dbPath : resolve(process.cwd(), dbPath);

    // Ensure directory exists (only for file-based)
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    return new BunSqliteDialect({ url: fullPath });
}
