/**
 * Kysely Dialect Factory
 * Supports SQLite, PostgreSQL, and MySQL using Bun's native drivers
 *
 * Now supports ConfigContext for centralized configuration.
 * Falls back to process.env for backward compatibility.
 */
import type { Dialect } from 'kysely';
import { resolve, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { getConfig, type ConfigContext } from '../contexts/config.context';

// ============================================================================
// RUNTIME DETECTION
// ============================================================================

/**
 * Check if we're running in Bun
 */
// biome-ignore lint/suspicious/noExplicitAny: globalThis doesn't have Bun type
const defaultIsBun = typeof (globalThis as any).Bun !== 'undefined';

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

export interface DialectDependencies {
    isBun: boolean;
}

const defaultDeps: DialectDependencies = {
    isBun: defaultIsBun,
};

let deps = { ...defaultDeps };

/**
 * Configure dependencies for testing
 */
export function configure(newDeps: Partial<DialectDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

/**
 * Reset dependencies to defaults
 */
export function resetDependencies(): void {
    deps = { ...defaultDeps };
}

// ============================================================================
// TYPES
// ============================================================================

export type DbDialect = 'sqlite' | 'postgres' | 'mysql';

export interface DbConfigBase {
    dialect: DbDialect;
    /** Minimum connections in pool (default: 0) */
    poolMin?: number;
    /** Maximum connections in pool (default: 10) */
    poolMax?: number;
}

export interface SqliteConfig extends DbConfigBase {
    dialect: 'sqlite';
    /** Path to SQLite database file or ':memory:' */
    sqlitePath: string;
}

export interface PostgresConfig extends DbConfigBase {
    dialect: 'postgres';
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    charset?: string;
    ssl?: 'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
}

export interface MysqlConfig extends DbConfigBase {
    dialect: 'mysql';
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    charset?: string;
}

export type DbConfig = SqliteConfig | PostgresConfig | MysqlConfig;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Map DB_DRIVER env variable to internal dialect type
 * Supports legacy Doctrine/PDO driver names for backwards compatibility
 */
function mapDriverToDialect(driver: string): DbDialect {
    switch (driver.toLowerCase()) {
        case 'pdo_mysql':
        case 'mysql':
        case 'mysql2':
        case 'mariadb':
            return 'mysql';
        case 'pdo_pgsql':
        case 'pgsql':
        case 'postgres':
        case 'postgresql':
            return 'postgres';
        // SQLite is the default for any unrecognized driver
        // Explicit cases: pdo_sqlite, sqlite, sqlite3
        default:
            return 'sqlite';
    }
}

/**
 * Get database configuration from ConfigContext or environment variables
 *
 * @param config - Optional ConfigContext. If not provided, uses getConfig() singleton.
 */
export function getDbConfig(config?: ConfigContext): DbConfig {
    // Use ConfigContext if available, otherwise fall back to singleton
    const cfg = config ?? getConfig();
    const dbConfig = cfg.db;

    if (dbConfig.dialect === 'sqlite') {
        return {
            dialect: 'sqlite',
            sqlitePath: dbConfig.path || 'data/exelearning.db',
            poolMin: dbConfig.poolMin,
            poolMax: dbConfig.poolMax,
        };
    }

    if (dbConfig.dialect === 'postgres') {
        return {
            dialect: 'postgres',
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.name,
            user: dbConfig.user,
            password: dbConfig.password,
            charset: dbConfig.charset,
            poolMin: dbConfig.poolMin,
            poolMax: dbConfig.poolMax,
        };
    }

    // MySQL
    return {
        dialect: 'mysql',
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.name,
        user: dbConfig.user,
        password: dbConfig.password,
        charset: dbConfig.charset,
        poolMin: dbConfig.poolMin,
        poolMax: dbConfig.poolMax,
    };
}

/**
 * Get the dialect type from ConfigContext or environment
 *
 * @param config - Optional ConfigContext. If not provided, uses getConfig() singleton.
 */
export function getDialectFromEnv(config?: ConfigContext): DbDialect {
    const cfg = config ?? getConfig();
    return cfg.db.dialect;
}

// ============================================================================
// DIALECT FACTORY
// ============================================================================

/**
 * Create a Kysely dialect based on configuration
 * Uses Bun's native SQL drivers for PostgreSQL and MySQL
 */
export function createDialect(config?: DbConfig): Dialect {
    const cfg = config || getDbConfig();

    switch (cfg.dialect) {
        case 'postgres':
            return createPostgresDialect(cfg);
        case 'mysql':
            return createMysqlDialect(cfg);
        default:
            return createSqliteDialect(cfg.sqlitePath);
    }
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

    if (deps.isBun) {
        // Bun runtime: use kysely-bun-worker
        const { BunSqliteDialect } = require('kysely-bun-worker/normal');
        return new BunSqliteDialect({ url: fullPath });
    }
    // Node.js runtime: use better-sqlite3
    // Dynamic require to prevent Bun's bundler from trying to resolve these modules
    const dynamicRequire = (mod: string) => require(mod);
    const { SqliteDialect } = dynamicRequire('kysely');
    const Database = dynamicRequire('better-sqlite3');
    return new SqliteDialect({
        database: new Database(fullPath),
    });
}

// ============================================================================
// POSTGRESQL DIALECT (Bun native)
// ============================================================================

function createPostgresDialect(config: PostgresConfig): Dialect {
    if (!deps.isBun) {
        throw new Error('PostgreSQL dialect requires Bun runtime. Use pg package for Node.js.');
    }

    const { BunPostgresDialect } = require('./dialects/bun-postgres-dialect');
    return new BunPostgresDialect({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        max: config.poolMax,
    });
}

// ============================================================================
// MYSQL DIALECT (using mysql2 package)
// ============================================================================

function createMysqlDialect(config: MysqlConfig): Dialect {
    // Use mysql2 package with Kysely's native MysqlDialect
    // This is more stable than Bun's native SQL driver which has bugs with UPDATE operations
    const { MysqlDialect } = require('kysely');
    const { createPool } = require('mysql2');

    return new MysqlDialect({
        pool: createPool({
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            connectionLimit: config.poolMax || 10,
            charset: config.charset || 'utf8mb4',
        }),
    });
}
