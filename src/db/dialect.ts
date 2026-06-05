/**
 * Kysely Dialect Factory
 * Supports SQLite, PostgreSQL, and MySQL using Bun's native drivers
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
const defaultIsBun = typeof (globalThis as any).Bun !== 'undefined';

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

export interface DialectDependencies {
    isBun: boolean;
    /** Platform identifier (e.g., 'darwin', 'linux', 'win32') */
    platform: NodeJS.Platform;
    /** Check if a path exists */
    existsSync: typeof existsSync;
    /** Create a directory */
    mkdirSync: typeof mkdirSync;
}

const defaultDeps: DialectDependencies = {
    isBun: defaultIsBun,
    platform: process.platform,
    existsSync,
    mkdirSync,
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
 * Get database configuration from environment variables
 */
export function getDbConfig(): DbConfig {
    const driver = process.env.DB_DRIVER || 'pdo_sqlite';
    const dialect = mapDriverToDialect(driver);

    const poolMin = Number.parseInt(process.env.DB_POOL_MIN || '0', 10);
    const poolMax = Number.parseInt(process.env.DB_POOL_MAX || '10', 10);

    if (dialect === 'sqlite') {
        return {
            dialect: 'sqlite',
            sqlitePath: process.env.DB_PATH || 'data/exelearning.db',
            poolMin,
            poolMax,
        };
    }

    if (dialect === 'postgres') {
        return {
            dialect: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: Number.parseInt(process.env.DB_PORT || '5432', 10),
            database: process.env.DB_NAME || 'exelearning',
            user: process.env.DB_USER || 'exelearning',
            password: process.env.DB_PASSWORD || '',
            charset: process.env.DB_CHARSET || 'utf8',
            poolMin,
            poolMax,
        };
    }

    // MySQL
    return {
        dialect: 'mysql',
        host: process.env.DB_HOST || 'localhost',
        port: Number.parseInt(process.env.DB_PORT || '3306', 10),
        database: process.env.DB_NAME || 'exelearning',
        user: process.env.DB_USER || 'exelearning',
        password: process.env.DB_PASSWORD || '',
        charset: process.env.DB_CHARSET || 'utf8mb4',
        poolMin,
        poolMax,
    };
}

/**
 * Get the dialect type from environment
 */
export function getDialectFromEnv(): DbDialect {
    const driver = process.env.DB_DRIVER || 'pdo_sqlite';
    return mapDriverToDialect(driver);
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

        // Check if we're trying to use a Docker-style path on non-Linux
        // Common Docker paths: /mnt/data/, /var/lib/, /app/data/
        if (fullPath.startsWith('/mnt/') && deps.platform !== 'linux') {
            throw new Error(
                `DB_PATH "${dbPath}" appears to be a Docker/Linux path but you're running on ${deps.platform}.\n` +
                    'For local development, set DB_PATH in your .env file to a local path:\n' +
                    '  DB_PATH=data/exelearning.db\n\n' +
                    'Or use the Makefile which sets correct paths automatically:\n' +
                    '  make create-user EMAIL=x PASSWORD=y',
            );
        }

        if (!deps.existsSync(dir)) {
            try {
                deps.mkdirSync(dir, { recursive: true });
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                throw new Error(
                    `Failed to create database directory "${dir}": ${errMsg}\n\n` +
                        'Please ensure DB_PATH is set to a writable location in your .env file.\n' +
                        'For local development, use: DB_PATH=data/exelearning.db',
                );
            }
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
