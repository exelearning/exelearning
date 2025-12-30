/**
 * Bun MySQL Dialect for Kysely
 * Uses Bun's native SQL driver instead of the 'mysql2' package
 */
import type { Dialect, Driver, DatabaseConnection, QueryResult, TransactionSettings, Kysely } from 'kysely';
import type { CompiledQuery } from 'kysely';
import { MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from 'kysely';
import { SQL } from 'bun';

// ============================================================================
// TYPES
// ============================================================================

export interface BunMysqlDialectConfig {
    /** Database host */
    host: string;
    /** Database port (default: 3306) */
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
    /** Character set (default: utf8mb4) */
    charset?: string;
}

// Symbol for private release method
const RELEASE_METHOD = Symbol('release');

// ============================================================================
// CONNECTION
// ============================================================================

/**
 * A single MySQL connection using Bun.SQL reserved connection
 */
class BunMysqlConnection implements DatabaseConnection {
    readonly #reserved: ReturnType<SQL['reserve']> extends Promise<infer T> ? T : never;

    constructor(reserved: ReturnType<SQL['reserve']> extends Promise<infer T> ? T : never) {
        this.#reserved = reserved;
    }

    async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
        const { sql, parameters } = compiledQuery;

        // Use unsafe() to execute the compiled query with parameters
        const result = await this.#reserved.unsafe(sql, parameters as unknown[]);

        // Check if result is an OkPacket (INSERT/UPDATE/DELETE)
        if (result && typeof result === 'object' && 'affectedRows' in result) {
            const okPacket = result as { insertId?: number | bigint; affectedRows?: number; changedRows?: number };
            return {
                rows: [],
                insertId:
                    okPacket.insertId !== undefined &&
                    okPacket.insertId !== null &&
                    okPacket.insertId.toString() !== '0'
                        ? BigInt(okPacket.insertId)
                        : undefined,
                numAffectedRows:
                    okPacket.affectedRows !== undefined && okPacket.affectedRows !== null
                        ? BigInt(okPacket.affectedRows)
                        : undefined,
                numChangedRows:
                    okPacket.changedRows !== undefined && okPacket.changedRows !== null
                        ? BigInt(okPacket.changedRows)
                        : undefined,
            };
        }

        // Result is an array of rows
        return {
            rows: Array.isArray(result) ? (result as R[]) : [],
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
 * MySQL driver using Bun's native SQL
 */
class BunMysqlDriver implements Driver {
    readonly #config: BunMysqlDialectConfig;
    #sql: SQL | null = null;
    readonly #connections = new WeakMap<DatabaseConnection, BunMysqlConnection>();

    constructor(config: BunMysqlDialectConfig) {
        this.#config = config;
    }

    async init(): Promise<void> {
        const { host, port = 3306, database, user, password, max = 10, idleTimeout = 30 } = this.#config;

        // Build connection string for MySQL
        const connectionString = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;

        this.#sql = new SQL(connectionString, {
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
        const connection = new BunMysqlConnection(reserved);
        this.#connections.set(connection, connection);
        return connection;
    }

    async beginTransaction(connection: DatabaseConnection, settings: TransactionSettings): Promise<void> {
        // MySQL requires SET TRANSACTION before BEGIN for isolation level
        if (settings.isolationLevel || settings.accessMode) {
            const parts: string[] = [];
            if (settings.isolationLevel) {
                parts.push(`ISOLATION LEVEL ${settings.isolationLevel.toUpperCase()}`);
            }
            if (settings.accessMode) {
                parts.push(settings.accessMode.toUpperCase());
            }
            await connection.executeQuery({
                sql: `SET TRANSACTION ${parts.join(', ')}`,
                parameters: [],
            });
        }

        await connection.executeQuery({ sql: 'BEGIN', parameters: [] });
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
 * MySQL dialect using Bun's native SQL driver
 *
 * @example
 * ```ts
 * const db = new Kysely<Database>({
 *   dialect: new BunMysqlDialect({
 *     host: 'localhost',
 *     port: 3306,
 *     database: 'mydb',
 *     user: 'myuser',
 *     password: 'mypassword',
 *   }),
 * });
 * ```
 */
export class BunMysqlDialect implements Dialect {
    readonly #config: BunMysqlDialectConfig;

    constructor(config: BunMysqlDialectConfig) {
        this.#config = config;
    }

    createDriver(): Driver {
        return new BunMysqlDriver(this.#config);
    }

    createQueryCompiler() {
        return new MysqlQueryCompiler();
    }

    createAdapter() {
        return new MysqlAdapter();
    }

    createIntrospector(db: Kysely<unknown>) {
        return new MysqlIntrospector(db);
    }
}
