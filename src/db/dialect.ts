/**
 * Kysely Dialect Factory
 * SQLite with automatic runtime detection (Bun or Node.js)
 */
import type { Dialect } from 'kysely';
import { resolve, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';

// ============================================================================
// RUNTIME DETECTION
// ============================================================================

/**
 * Check if we're running in Bun
 */
// biome-ignore lint/suspicious/noExplicitAny: globalThis doesn't have Bun type
const isBun = typeof (globalThis as any).Bun !== 'undefined';

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
 * Automatically detects runtime (Bun or Node.js) and uses appropriate driver
 */
export function createDialect(config?: DbConfig): Dialect {
    const cfg = config || getDbConfig();
    return createSqliteDialect(cfg.sqlitePath);
}

// ============================================================================
// SQLITE DIALECT
// ============================================================================

function createSqliteDialect(dbPath: string): Dialect {
    // Resolve path for file-based database
    const fullPath =
        dbPath === ':memory:' ? ':memory:' : dbPath.startsWith('/') ? dbPath : resolve(process.cwd(), dbPath);

    // Ensure directory exists (only for file-based)
    if (dbPath !== ':memory:') {
        const dir = dirname(fullPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }

    if (isBun) {
        // Bun runtime: use kysely-bun-worker
        const { BunSqliteDialect } = require('kysely-bun-worker/normal');
        return new BunSqliteDialect({ url: fullPath });
        /* v8 ignore start - Node.js runtime branch (not covered in Bun tests) */
    } else {
        // Node.js runtime: use better-sqlite3
        // Dynamic require to prevent Bun's bundler from trying to resolve these modules
        const dynamicRequire = (mod: string) => require(mod);
        const { SqliteDialect } = dynamicRequire('kysely');
        const Database = dynamicRequire('better-sqlite3');
        return new SqliteDialect({
            database: new Database(fullPath),
        });
    }
    /* v8 ignore stop */
}
