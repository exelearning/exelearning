/**
 * Kysely Dialect Factory
 * Supports SQLite, MySQL/MariaDB, and PostgreSQL
 *
 * Database is configured via environment variables:
 * - DB_DRIVER: pdo_sqlite (default), pdo_mysql, pdo_pgsql
 * - DB_PATH: SQLite file path (only for SQLite)
 * - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD: For MySQL/PostgreSQL
 */
import { type Dialect, MysqlDialect, PostgresDialect } from 'kysely';
import { resolve, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { createPool as createMysqlPool, type PoolOptions as MysqlPoolOptions } from 'mysql2';
import { Pool as PgPool, type PoolConfig as PgPoolConfig } from 'pg';

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

export type DbDialect = 'sqlite' | 'mysql' | 'postgres';

export interface DbConfig {
    dialect: DbDialect;
    // SQLite specific
    sqlitePath?: string;
    // MySQL/PostgreSQL specific
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    charset?: string;
    // Connection pool settings
    poolMin?: number;
    poolMax?: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Map DB_DRIVER env variable to internal dialect type
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
        case 'pdo_sqlite':
        case 'sqlite':
        case 'sqlite3':
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

    const baseConfig: DbConfig = {
        dialect,
        poolMin: Number.parseInt(process.env.DB_POOL_MIN || '0', 10),
        poolMax: Number.parseInt(process.env.DB_POOL_MAX || '10', 10),
    };

    if (dialect === 'sqlite') {
        return {
            ...baseConfig,
            sqlitePath: process.env.DB_PATH || 'data/exelearning.db',
        };
    }

    // MySQL or PostgreSQL
    return {
        ...baseConfig,
        host: process.env.DB_HOST || 'localhost',
        port: Number.parseInt(process.env.DB_PORT || (dialect === 'mysql' ? '3306' : '5432'), 10),
        database: process.env.DB_NAME || 'exelearning',
        user: process.env.DB_USER || 'exelearning',
        password: process.env.DB_PASSWORD || '',
        charset: process.env.DB_CHARSET || 'utf8mb4',
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
 * Automatically detects runtime (Bun or Node.js) and uses appropriate driver
 */
export function createDialect(config?: DbConfig): Dialect {
    const cfg = config || getDbConfig();

    switch (cfg.dialect) {
        case 'mysql':
            return createMysqlDialect(cfg);
        case 'postgres':
            return createPostgresDialect(cfg);
        default:
            return createSqliteDialect(cfg.sqlitePath || 'data/exelearning.db');
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
// MYSQL/MARIADB DIALECT
// ============================================================================

function createMysqlDialect(config: DbConfig): Dialect {
    const poolConfig: MysqlPoolOptions = {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        charset: config.charset,
        // Connection pool settings
        connectionLimit: config.poolMax || 10,
        // Wait for connections when pool is exhausted
        waitForConnections: true,
        queueLimit: 0,
        // Enable keep-alive
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
    };

    console.log(`[DB] Connecting to MySQL/MariaDB at ${config.host}:${config.port}/${config.database}`);

    return new MysqlDialect({
        pool: createMysqlPool(poolConfig),
    });
}

// ============================================================================
// POSTGRESQL DIALECT
// ============================================================================

function createPostgresDialect(config: DbConfig): Dialect {
    const poolConfig: PgPoolConfig = {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        // Connection pool settings
        min: config.poolMin || 0,
        max: config.poolMax || 10,
        // Idle timeout (close connections after 30s of inactivity)
        idleTimeoutMillis: 30000,
        // Connection timeout
        connectionTimeoutMillis: 5000,
    };

    console.log(`[DB] Connecting to PostgreSQL at ${config.host}:${config.port}/${config.database}`);

    return new PostgresDialect({
        pool: new PgPool(poolConfig),
    });
}
