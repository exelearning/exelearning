/**
 * Tests for Bun MySQL Dialect
 */
import { describe, it, expect, afterEach } from 'bun:test';
import {
    BunMysqlDialect,
    type BunMysqlDialectConfig,
    setMysqlSqlConstructorForTesting,
    resetMysqlSqlConstructorForTesting,
} from './bun-mysql-dialect';
import { MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from 'kysely';

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

    setMysqlSqlConstructorForTesting(FakeSQL);

    return {
        getConnectionString: () => connectionString,
        getOptions: () => options,
        wasClosed: () => closed,
    };
}

describe('BunMysqlDialect', () => {
    const config: BunMysqlDialectConfig = {
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
    };

    afterEach(() => {
        resetMysqlSqlConstructorForTesting();
    });

    describe('constructor', () => {
        it('should create dialect with required config', () => {
            const dialect = new BunMysqlDialect(config);
            expect(dialect).toBeDefined();
        });

        it('should accept optional config values', () => {
            const fullConfig: BunMysqlDialectConfig = {
                ...config,
                max: 20,
                idleTimeout: 60,
                charset: 'utf8mb4',
            };
            const dialect = new BunMysqlDialect(fullConfig);
            expect(dialect).toBeDefined();
        });
    });

    describe('createDriver', () => {
        it('should create a driver instance', () => {
            const dialect = new BunMysqlDialect(config);
            const driver = dialect.createDriver();
            expect(driver).toBeDefined();
            expect(typeof driver.init).toBe('function');
            expect(typeof driver.acquireConnection).toBe('function');
            expect(typeof driver.releaseConnection).toBe('function');
            expect(typeof driver.destroy).toBe('function');
        });
    });

    describe('createQueryCompiler', () => {
        it('should return MysqlQueryCompiler', () => {
            const dialect = new BunMysqlDialect(config);
            const compiler = dialect.createQueryCompiler();
            expect(compiler).toBeInstanceOf(MysqlQueryCompiler);
        });
    });

    describe('createAdapter', () => {
        it('should return MysqlAdapter', () => {
            const dialect = new BunMysqlDialect(config);
            const adapter = dialect.createAdapter();
            expect(adapter).toBeInstanceOf(MysqlAdapter);
        });
    });

    describe('createIntrospector', () => {
        it('should return MysqlIntrospector', () => {
            const dialect = new BunMysqlDialect(config);
            const placeholderDb = {} as Parameters<typeof dialect.createIntrospector>[0];
            const introspector = dialect.createIntrospector(placeholderDb);
            expect(introspector).toBeInstanceOf(MysqlIntrospector);
        });
    });

    describe('driver and connection behavior', () => {
        it('should throw if acquireConnection is called before init', async () => {
            const dialect = new BunMysqlDialect(config);
            const driver = dialect.createDriver();
            await expect(driver.acquireConnection()).rejects.toThrow('Driver not initialized');
        });

        it('should map array rows with field metadata', async () => {
            const reserved: ReservedConnection = {
                unsafe: async () => [
                    [
                        [1, 'Alice'],
                        [2, 'Bob'],
                    ],
                    [{ name: 'id' }, { name: 'name' }],
                ],
                release: () => {},
            };
            setupSqlHarness(reserved);

            const dialect = new BunMysqlDialect(config);
            const driver = dialect.createDriver();
            await driver.init();
            const connection = await driver.acquireConnection();

            const result = await connection.executeQuery<{ id: number; name: string }>({
                sql: 'SELECT id, name FROM users',
                parameters: [],
            });

            expect(result.rows).toEqual([
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
            ]);
        });

        it('should return rows when metadata is missing', async () => {
            const reserved: ReservedConnection = {
                unsafe: async () => [[{ id: 7 }], { meta: true }],
                release: () => {},
            };
            setupSqlHarness(reserved);

            const dialect = new BunMysqlDialect(config);
            const driver = dialect.createDriver();
            await driver.init();
            const connection = await driver.acquireConnection();

            const result = await connection.executeQuery<{ id: number }>({
                sql: 'SELECT id FROM users',
                parameters: [],
            });

            expect(result.rows).toEqual([{ id: 7 }]);
        });

        it('should map insert and affected row metadata from array result', async () => {
            const resultArray: unknown[] = [];
            (resultArray as { insertId: number }).insertId = 12;
            (resultArray as { affectedRows: number }).affectedRows = 2;
            (resultArray as { changedRows: number }).changedRows = 1;

            const reserved: ReservedConnection = {
                unsafe: async () => resultArray,
                release: () => {},
            };
            setupSqlHarness(reserved);

            const dialect = new BunMysqlDialect(config);
            const driver = dialect.createDriver();
            await driver.init();
            const connection = await driver.acquireConnection();

            const result = await connection.executeQuery({
                sql: 'INSERT INTO users (email) VALUES (?)',
                parameters: ['test@example.com'],
            });

            expect(result.insertId).toBe(12n);
            expect(result.numAffectedRows).toBe(2n);
            expect(result.numChangedRows).toBe(1n);
        });

        it('should return rows from { rows } result and handle ok packets', async () => {
            const results = [{ rows: [{ id: 3 }] }, { insertId: 5, affectedRows: 1, changedRows: 0 }];
            let callIndex = 0;

            const reserved: ReservedConnection = {
                unsafe: async () => results[callIndex++],
                release: () => {},
            };
            setupSqlHarness(reserved);

            const dialect = new BunMysqlDialect(config);
            const driver = dialect.createDriver();
            await driver.init();
            const connection = await driver.acquireConnection();

            const selectResult = await connection.executeQuery<{ id: number }>({
                sql: 'SELECT id FROM users',
                parameters: [],
            });
            expect(selectResult.rows).toEqual([{ id: 3 }]);

            const insertResult = await connection.executeQuery({
                sql: 'INSERT INTO users (email) VALUES (?)',
                parameters: ['another@example.com'],
            });
            expect(insertResult.rows).toEqual([]);
            expect(insertResult.insertId).toBe(5n);
            expect(insertResult.numAffectedRows).toBe(1n);
            expect(insertResult.numChangedRows).toBe(0n);
        });

        it('should stream query results', async () => {
            const reserved: ReservedConnection = {
                unsafe: async () => ({ rows: [{ id: 9 }] }),
                release: () => {},
            };
            setupSqlHarness(reserved);

            const dialect = new BunMysqlDialect(config);
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
            const dialect = new BunMysqlDialect(config);
            const driver = dialect.createDriver();
            const calls: string[] = [];
            const connection = {
                executeQuery: async ({ sql }: { sql: string }) => {
                    calls.push(sql);
                    return { rows: [] };
                },
            } as Parameters<typeof driver.beginTransaction>[0];

            await driver.beginTransaction(connection, { isolationLevel: 'read committed', accessMode: 'read write' });
            await driver.commitTransaction(connection);
            await driver.rollbackTransaction(connection);
            await driver.savepoint(connection, 'sp1');
            await driver.rollbackToSavepoint(connection, 'sp1');
            await driver.releaseSavepoint(connection, 'sp1');

            expect(calls).toEqual([
                'SET TRANSACTION ISOLATION LEVEL READ COMMITTED, READ WRITE',
                'BEGIN',
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

            const dialect = new BunMysqlDialect(config);
            const driver = dialect.createDriver();
            await driver.init();
            const connection = await driver.acquireConnection();

            await driver.releaseConnection(connection);
            expect(released).toBe(true);

            await driver.destroy();
            expect(sqlState.wasClosed()).toBe(true);
        });

        it('should construct connection string and options on init', async () => {
            const reserved: ReservedConnection = {
                unsafe: async () => [],
                release: () => {},
            };
            const sqlState = setupSqlHarness(reserved);

            const dialect = new BunMysqlDialect(config);
            const driver = dialect.createDriver();
            await driver.init();

            expect(sqlState.getConnectionString()).toBe('mysql://testuser:testpass@localhost:3306/testdb');
            expect(sqlState.getOptions()).toEqual({ max: 10, idleTimeout: 30 });
        });
    });
});
