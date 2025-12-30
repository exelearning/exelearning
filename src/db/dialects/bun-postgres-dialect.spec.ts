/**
 * Tests for Bun PostgreSQL Dialect
 */
import { describe, it, expect, afterEach } from 'bun:test';
import {
    BunPostgresDialect,
    type BunPostgresDialectConfig,
    setPostgresSqlConstructorForTesting,
    resetPostgresSqlConstructorForTesting,
} from './bun-postgres-dialect';
import { PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';

type ReservedConnection = {
    unsafe: (sql: string, params: unknown[]) => Promise<unknown>;
    release: () => void;
};

function setupSqlHarness(reserved: ReservedConnection) {
    let connectionString: string | undefined;
    let options: { max?: number; idleTimeout?: number } | undefined;
    let closed = false;

    class FakeSQL {
        constructor(conn: string, opts: { max?: number; idleTimeout?: number }) {
            connectionString = conn;
            options = opts;
        }

        reserve() {
            return Promise.resolve(reserved);
        }

        close() {
            closed = true;
            return Promise.resolve();
        }
    }

    setPostgresSqlConstructorForTesting(FakeSQL);

    return {
        getConnectionString: () => connectionString,
        getOptions: () => options,
        wasClosed: () => closed,
    };
}

describe('BunPostgresDialect', () => {
    const config: BunPostgresDialectConfig = {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
    };

    afterEach(() => {
        resetPostgresSqlConstructorForTesting();
    });

    describe('constructor', () => {
        it('should create dialect with required config', () => {
            const dialect = new BunPostgresDialect(config);
            expect(dialect).toBeDefined();
        });

        it('should accept optional config values', () => {
            const fullConfig: BunPostgresDialectConfig = {
                ...config,
                max: 20,
                idleTimeout: 60,
                ssl: 'require',
            };
            const dialect = new BunPostgresDialect(fullConfig);
            expect(dialect).toBeDefined();
        });
    });

    describe('createDriver', () => {
        it('should create a driver instance', () => {
            const dialect = new BunPostgresDialect(config);
            const driver = dialect.createDriver();
            expect(driver).toBeDefined();
            expect(typeof driver.init).toBe('function');
            expect(typeof driver.acquireConnection).toBe('function');
            expect(typeof driver.releaseConnection).toBe('function');
            expect(typeof driver.destroy).toBe('function');
        });
    });

    describe('createQueryCompiler', () => {
        it('should return PostgresQueryCompiler', () => {
            const dialect = new BunPostgresDialect(config);
            const compiler = dialect.createQueryCompiler();
            expect(compiler).toBeInstanceOf(PostgresQueryCompiler);
        });
    });

    describe('createAdapter', () => {
        it('should return PostgresAdapter', () => {
            const dialect = new BunPostgresDialect(config);
            const adapter = dialect.createAdapter();
            expect(adapter).toBeInstanceOf(PostgresAdapter);
        });
    });

    describe('createIntrospector', () => {
        it('should return PostgresIntrospector', () => {
            const dialect = new BunPostgresDialect(config);
            const placeholderDb = {} as Parameters<typeof dialect.createIntrospector>[0];
            const introspector = dialect.createIntrospector(placeholderDb);
            expect(introspector).toBeInstanceOf(PostgresIntrospector);
        });
    });

    describe('driver and connection behavior', () => {
        it('should throw if acquireConnection is called before init', async () => {
            const dialect = new BunPostgresDialect(config);
            const driver = dialect.createDriver();
            await expect(driver.acquireConnection()).rejects.toThrow('Driver not initialized');
        });

        it('should execute select queries without affected rows', async () => {
            const reserved: ReservedConnection = {
                unsafe: async () => [{ id: 1 }],
                release: () => {},
            };
            setupSqlHarness(reserved);

            const dialect = new BunPostgresDialect(config);
            const driver = dialect.createDriver();
            await driver.init();
            const connection = await driver.acquireConnection();

            const result = await connection.executeQuery<{ id: number }>({
                sql: 'SELECT id FROM users',
                parameters: [],
            });

            expect(result.rows).toEqual([{ id: 1 }]);
            expect(result.numAffectedRows).toBeUndefined();
        });

        it('should track affected rows for mutations', async () => {
            const reserved: ReservedConnection = {
                unsafe: async () => ({ count: 2 }),
                release: () => {},
            };
            setupSqlHarness(reserved);

            const dialect = new BunPostgresDialect(config);
            const driver = dialect.createDriver();
            await driver.init();
            const connection = await driver.acquireConnection();

            const result = await connection.executeQuery({
                sql: 'INSERT INTO users (email) VALUES ($1)',
                parameters: ['test@example.com'],
            });

            expect(result.rows).toEqual([]);
            expect(result.numAffectedRows).toBe(2n);
        });

        it('should stream query results', async () => {
            const reserved: ReservedConnection = {
                unsafe: async () => [{ id: 9 }],
                release: () => {},
            };
            setupSqlHarness(reserved);

            const dialect = new BunPostgresDialect(config);
            const driver = dialect.createDriver();
            await driver.init();
            const connection = await driver.acquireConnection();

            const iterator = connection.streamQuery<{ id: number }>({
                sql: 'SELECT id FROM users',
                parameters: [],
            });

            const results: number[] = [];
            for await (const batch of iterator) {
                results.push(batch.rows[0]?.id);
            }

            expect(results).toEqual([9]);
        });

        it('should execute transaction helpers', async () => {
            const dialect = new BunPostgresDialect(config);
            const driver = dialect.createDriver();
            const calls: string[] = [];
            const connection = {
                executeQuery: async ({ sql }: { sql: string }) => {
                    calls.push(sql);
                    return { rows: [] };
                },
            } as Parameters<typeof driver.beginTransaction>[0];

            await driver.beginTransaction(connection, { isolationLevel: 'repeatable read', accessMode: 'read only' });
            await driver.commitTransaction(connection);
            await driver.rollbackTransaction(connection);
            await driver.savepoint(connection, 'sp1');
            await driver.rollbackToSavepoint(connection, 'sp1');
            await driver.releaseSavepoint(connection, 'sp1');

            expect(calls).toEqual([
                'START TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
                'COMMIT',
                'ROLLBACK',
                'SAVEPOINT sp1',
                'ROLLBACK TO SAVEPOINT sp1',
                'RELEASE SAVEPOINT sp1',
            ]);
        });

        it('should release connections and destroy the driver', async () => {
            let released = false;
            const reserved: ReservedConnection = {
                unsafe: async () => [],
                release: () => {
                    released = true;
                },
            };
            const sqlState = setupSqlHarness(reserved);

            const dialect = new BunPostgresDialect(config);
            const driver = dialect.createDriver();
            await driver.init();
            const connection = await driver.acquireConnection();

            await driver.releaseConnection(connection);
            expect(released).toBe(true);

            await driver.destroy();
            expect(sqlState.wasClosed()).toBe(true);
        });

        it('should construct connection string with ssl mode', async () => {
            const reserved: ReservedConnection = {
                unsafe: async () => [],
                release: () => {},
            };
            const sqlState = setupSqlHarness(reserved);

            const dialect = new BunPostgresDialect({
                ...config,
                ssl: 'require',
            });
            const driver = dialect.createDriver();
            await driver.init();

            expect(sqlState.getConnectionString()).toBe(
                'postgres://testuser:testpass@localhost:5432/testdb?sslmode=require',
            );
            expect(sqlState.getOptions()).toEqual({ max: 10, idleTimeout: 30 });
        });
    });
});
