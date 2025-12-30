/**
 * Bun PostgreSQL Dialect for Kysely
 * Uses Bun's native SQL driver instead of the 'pg' package
 */
import type { Dialect, Driver, DatabaseConnection, QueryResult, TransactionSettings, Kysely } from 'kysely';
import type { CompiledQuery } from 'kysely';
import { PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { SQL } from 'bun';

// ============================================================================
// TYPES
// ============================================================================

export interface BunPostgresDialectConfig {
    /** Database host */
    host: string;
    /** Database port (default: 5432) */
    port?: number;
    /** Database name */
    database: string;
    /** Database user */
    user: string;
    /** Database password */
    password: string;
    /** Maximum connections in pool (default: 10) */
    max?: number;
    /** Idle timeout in seconds (default: 30) */
    idleTimeout?: number;
    /** SSL mode */
    ssl?: 'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
}

type SqlConstructor = typeof SQL;
let SqlCtor: SqlConstructor = SQL;

export function setPostgresSqlConstructorForTesting(sqlConstructor: SqlConstructor): void {
    SqlCtor = sqlConstructor;
}

export function resetPostgresSqlConstructorForTesting(): void {
    SqlCtor = SQL;
}

// Symbol for private release method
const RELEASE_METHOD = Symbol('release');

// ============================================================================
// CONNECTION
// ============================================================================

/**
 * A single PostgreSQL connection using Bun.SQL reserved connection
 */
class BunPostgresConnection implements DatabaseConnection {
    readonly #reserved: ReturnType<SQL['reserve']> extends Promise<infer T> ? T : never;

    constructor(reserved: ReturnType<SQL['reserve']> extends Promise<infer T> ? T : never) {
        this.#reserved = reserved;
    }

    async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
        const { sql, parameters } = compiledQuery;

        // Use unsafe() to execute the compiled query with parameters
        // Bun.SQL returns array-like results
        const result = await this.#reserved.unsafe(sql, parameters as unknown[]);

        // Determine if this is a mutation query
        const command = sql.trim().split(/\s+/)[0]?.toUpperCase();
        const isMutation = command === 'INSERT' || command === 'UPDATE' || command === 'DELETE' || command === 'MERGE';

        return {
            rows: Array.isArray(result) ? (result as R[]) : [],
            numAffectedRows: isMutation ? BigInt(result.count ?? 0) : undefined,
            numUpdatedRows: isMutation ? BigInt(result.count ?? 0) : undefined,
        };
    }

    async *streamQuery<R>(compiledQuery: CompiledQuery, _chunkSize?: number): AsyncIterableIterator<QueryResult<R>> {
        // Bun.SQL doesn't have explicit streaming API
        // Fall back to executing the full query and yielding results
        const result = await this.executeQuery<R>(compiledQuery);
        yield result;
    }

    /**
     * Release the connection back to the pool
     */
    [RELEASE_METHOD](): void {
        this.#reserved.release();
    }
}

// ============================================================================
// DRIVER
// ============================================================================

/**
 * PostgreSQL driver using Bun's native SQL
 */
class BunPostgresDriver implements Driver {
    readonly #config: BunPostgresDialectConfig;
    #sql: SQL | null = null;
    readonly #connections = new WeakMap<DatabaseConnection, BunPostgresConnection>();

    constructor(config: BunPostgresDialectConfig) {
        this.#config = config;
    }

    async init(): Promise<void> {
        const { host, port = 5432, database, user, password, max = 10, idleTimeout = 30, ssl } = this.#config;

        // Build connection string
        let connectionString = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
        if (ssl) {
            connectionString += `?sslmode=${ssl}`;
        }

        this.#sql = new SqlCtor(connectionString, {
            max,
            idleTimeout,
        });
    }

    async acquireConnection(): Promise<DatabaseConnection> {
        if (!this.#sql) {
            throw new Error('Driver not initialized. Call init() first.');
        }

        // Reserve a dedicated connection for this transaction/query
        const reserved = await this.#sql.reserve();
        const connection = new BunPostgresConnection(reserved);
        this.#connections.set(connection, connection);
        return connection;
    }

    async beginTransaction(connection: DatabaseConnection, settings: TransactionSettings): Promise<void> {
        let sql = 'BEGIN';

        if (settings.isolationLevel || settings.accessMode) {
            const parts: string[] = [];
            if (settings.isolationLevel) {
                parts.push(`ISOLATION LEVEL ${settings.isolationLevel.toUpperCase()}`);
            }
            if (settings.accessMode) {
                parts.push(settings.accessMode.toUpperCase());
            }
            sql = `START TRANSACTION ${parts.join(' ')}`;
        }

        await connection.executeQuery({ sql, parameters: [] });
    }

    async commitTransaction(connection: DatabaseConnection): Promise<void> {
        await connection.executeQuery({ sql: 'COMMIT', parameters: [] });
    }

    async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
        await connection.executeQuery({ sql: 'ROLLBACK', parameters: [] });
    }

    async savepoint(connection: DatabaseConnection, savepointName: string): Promise<void> {
        await connection.executeQuery({
            sql: `SAVEPOINT ${savepointName}`,
            parameters: [],
        });
    }

    async rollbackToSavepoint(connection: DatabaseConnection, savepointName: string): Promise<void> {
        await connection.executeQuery({
            sql: `ROLLBACK TO SAVEPOINT ${savepointName}`,
            parameters: [],
        });
    }

    async releaseSavepoint(connection: DatabaseConnection, savepointName: string): Promise<void> {
        await connection.executeQuery({
            sql: `RELEASE SAVEPOINT ${savepointName}`,
            parameters: [],
        });
    }

    async releaseConnection(connection: DatabaseConnection): Promise<void> {
        const bunConnection = this.#connections.get(connection);
        if (bunConnection) {
            bunConnection[RELEASE_METHOD]();
            this.#connections.delete(connection);
        }
    }

    async destroy(): Promise<void> {
        if (this.#sql) {
            await this.#sql.close();
            this.#sql = null;
        }
    }
}

// ============================================================================
// DIALECT
// ============================================================================

/**
 * PostgreSQL dialect using Bun's native SQL driver
 *
 * @example
 * ```ts
 * const db = new Kysely<Database>({
 *   dialect: new BunPostgresDialect({
 *     host: 'localhost',
 *     port: 5432,
 *     database: 'mydb',
 *     user: 'myuser',
 *     password: 'mypassword',
 *   }),
 * });
 * ```
 */
export class BunPostgresDialect implements Dialect {
    readonly #config: BunPostgresDialectConfig;

    constructor(config: BunPostgresDialectConfig) {
        this.#config = config;
    }

    createDriver(): Driver {
        return new BunPostgresDriver(this.#config);
    }

    createQueryCompiler() {
        return new PostgresQueryCompiler();
    }

    createAdapter() {
        return new PostgresAdapter();
    }

    createIntrospector(db: Kysely<unknown>) {
        return new PostgresIntrospector(db);
    }
}
