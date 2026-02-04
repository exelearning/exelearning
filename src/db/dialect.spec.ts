/**
 * Tests for Kysely Dialect Factory
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
    getDbConfig,
    getDialectFromEnv,
    createDialect,
    configure,
    resetDependencies,
    type DbDialect,
    type SqliteConfig,
    type PostgresConfig,
    type MysqlConfig,
} from './dialect';
import * as fs from 'fs';
import * as path from 'path';

describe('Kysely Dialect Factory', () => {
    const originalEnv = { ...process.env };
    const testDbDir = path.join(process.cwd(), 'test', 'temp', 'dialect-test');

    beforeEach(() => {
        // Ensure test directory exists
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        resetDependencies();
        // Clean up test directory
        if (fs.existsSync(testDbDir)) {
            fs.rmSync(testDbDir, { recursive: true, force: true });
        }
    });

    describe('getDbConfig', () => {
        describe('SQLite configuration', () => {
            it('should return default SQLite configuration', () => {
                delete process.env.DB_DRIVER;
                delete process.env.DB_PATH;
                const config = getDbConfig();

                expect(config.dialect).toBe('sqlite');
                expect((config as SqliteConfig).sqlitePath).toBe('data/exelearning.db');
            });

            it('should use DB_PATH from environment', () => {
                delete process.env.DB_DRIVER;
                process.env.DB_PATH = '/custom/path/test.db';
                const config = getDbConfig();

                expect((config as SqliteConfig).sqlitePath).toBe('/custom/path/test.db');
            });

            it('should return sqlite for pdo_sqlite driver', () => {
                process.env.DB_DRIVER = 'pdo_sqlite';
                const config = getDbConfig();
                expect(config.dialect).toBe('sqlite');
            });
        });

        describe('PostgreSQL configuration', () => {
            it('should return postgres config for pdo_pgsql driver', () => {
                process.env.DB_DRIVER = 'pdo_pgsql';
                process.env.DB_HOST = 'pg-host';
                process.env.DB_PORT = '5433';
                process.env.DB_NAME = 'testdb';
                process.env.DB_USER = 'testuser';
                process.env.DB_PASSWORD = 'testpass';

                const config = getDbConfig() as PostgresConfig;

                expect(config.dialect).toBe('postgres');
                expect(config.host).toBe('pg-host');
                expect(config.port).toBe(5433);
                expect(config.database).toBe('testdb');
                expect(config.user).toBe('testuser');
                expect(config.password).toBe('testpass');
            });

            it('should use default postgres port', () => {
                process.env.DB_DRIVER = 'postgres';
                delete process.env.DB_PORT;

                const config = getDbConfig() as PostgresConfig;

                expect(config.port).toBe(5432);
            });

            it('should recognize postgresql alias', () => {
                process.env.DB_DRIVER = 'postgresql';
                const config = getDbConfig();
                expect(config.dialect).toBe('postgres');
            });

            it('should recognize pgsql alias', () => {
                process.env.DB_DRIVER = 'pgsql';
                const config = getDbConfig();
                expect(config.dialect).toBe('postgres');
            });
        });

        describe('MySQL configuration', () => {
            it('should return mysql config for pdo_mysql driver', () => {
                process.env.DB_DRIVER = 'pdo_mysql';
                process.env.DB_HOST = 'mysql-host';
                process.env.DB_PORT = '3307';
                process.env.DB_NAME = 'testdb';
                process.env.DB_USER = 'testuser';
                process.env.DB_PASSWORD = 'testpass';

                const config = getDbConfig() as MysqlConfig;

                expect(config.dialect).toBe('mysql');
                expect(config.host).toBe('mysql-host');
                expect(config.port).toBe(3307);
                expect(config.database).toBe('testdb');
                expect(config.user).toBe('testuser');
                expect(config.password).toBe('testpass');
                expect(config.charset).toBe('utf8mb4');
            });

            it('should use default mysql port', () => {
                process.env.DB_DRIVER = 'mysql';
                delete process.env.DB_PORT;

                const config = getDbConfig() as MysqlConfig;

                expect(config.port).toBe(3306);
            });

            it('should recognize mysql2 alias', () => {
                process.env.DB_DRIVER = 'mysql2';
                const config = getDbConfig();
                expect(config.dialect).toBe('mysql');
            });

            it('should recognize mariadb alias', () => {
                process.env.DB_DRIVER = 'mariadb';
                const config = getDbConfig();
                expect(config.dialect).toBe('mysql');
            });
        });

        describe('pool configuration', () => {
            it('should use default pool settings', () => {
                const config = getDbConfig();
                expect(config.poolMin).toBe(0);
                expect(config.poolMax).toBe(10);
            });

            it('should use custom pool settings from env', () => {
                process.env.DB_POOL_MIN = '2';
                process.env.DB_POOL_MAX = '20';

                const config = getDbConfig();
                expect(config.poolMin).toBe(2);
                expect(config.poolMax).toBe(20);
            });
        });
    });

    describe('getDialectFromEnv', () => {
        it('should return sqlite by default', () => {
            delete process.env.DB_DRIVER;
            const dialect = getDialectFromEnv();
            expect(dialect).toBe('sqlite');
        });

        it('should return postgres for pdo_pgsql', () => {
            process.env.DB_DRIVER = 'pdo_pgsql';
            const dialect = getDialectFromEnv();
            expect(dialect).toBe('postgres');
        });

        it('should return mysql for pdo_mysql', () => {
            process.env.DB_DRIVER = 'pdo_mysql';
            const dialect = getDialectFromEnv();
            expect(dialect).toBe('mysql');
        });

        it('should be case insensitive', () => {
            process.env.DB_DRIVER = 'POSTGRES';
            expect(getDialectFromEnv()).toBe('postgres');

            process.env.DB_DRIVER = 'MySQL';
            expect(getDialectFromEnv()).toBe('mysql');
        });

        it('should return correct type', () => {
            const dialect: DbDialect = getDialectFromEnv();
            expect(['sqlite', 'postgres', 'mysql']).toContain(dialect);
        });
    });

    describe('createDialect', () => {
        describe('SQLite dialect', () => {
            it('should create SQLite dialect with default config', () => {
                process.env.DB_PATH = path.join(testDbDir, 'default.db');
                const dialect = createDialect();

                expect(dialect).toBeDefined();
            });

            it('should create SQLite dialect with custom config', () => {
                const config: SqliteConfig = {
                    dialect: 'sqlite',
                    sqlitePath: path.join(testDbDir, 'custom.db'),
                };
                const dialect = createDialect(config);

                expect(dialect).toBeDefined();
            });

            it('should create parent directory if not exists', () => {
                const nestedPath = path.join(testDbDir, 'nested', 'deep', 'test.db');
                const config: SqliteConfig = {
                    dialect: 'sqlite',
                    sqlitePath: nestedPath,
                };

                createDialect(config);

                const dir = path.dirname(nestedPath);
                expect(fs.existsSync(dir)).toBe(true);
            });

            it('should handle absolute paths', () => {
                const absolutePath = path.join(testDbDir, 'absolute.db');
                const config: SqliteConfig = {
                    dialect: 'sqlite',
                    sqlitePath: absolutePath,
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should handle relative paths', () => {
                const relativePath = 'test/temp/dialect-test/relative.db';
                const config: SqliteConfig = {
                    dialect: 'sqlite',
                    sqlitePath: relativePath,
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should handle :memory: database without creating directories', () => {
                const config: SqliteConfig = {
                    dialect: 'sqlite',
                    sqlitePath: ':memory:',
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should throw helpful error when using /mnt/ path on non-Linux (using DI)', () => {
                // Mock platform as darwin to test the error path
                configure({
                    platform: 'darwin',
                    existsSync: () => false,
                    mkdirSync: () => undefined,
                });

                const config: SqliteConfig = {
                    dialect: 'sqlite',
                    sqlitePath: '/mnt/data/exelearning.db',
                };

                expect(() => createDialect(config)).toThrow(/appears to be a Docker\/Linux path/);
                expect(() => createDialect(config)).toThrow(/darwin/);
            });

            it('should include helpful instructions in /mnt/ path error message', () => {
                // Mock platform as win32 to test different platform in error
                configure({
                    platform: 'win32',
                    existsSync: () => false,
                    mkdirSync: () => undefined,
                });

                const config: SqliteConfig = {
                    dialect: 'sqlite',
                    sqlitePath: '/mnt/data/test.db',
                };

                try {
                    createDialect(config);
                    // Should have thrown
                    expect(true).toBe(false);
                } catch (err) {
                    const message = (err as Error).message;
                    expect(message).toContain('DB_PATH=data/exelearning.db');
                    expect(message).toContain('make create-user EMAIL=x PASSWORD=y');
                    expect(message).toContain('win32');
                }
            });

            it('should allow /mnt/ paths on Linux', () => {
                // Mock platform as linux - /mnt/ paths should be allowed
                configure({
                    platform: 'linux',
                    existsSync: () => true, // Pretend directory exists
                    mkdirSync: () => undefined,
                });

                const config: SqliteConfig = {
                    dialect: 'sqlite',
                    sqlitePath: '/mnt/data/exelearning.db',
                };

                // Should not throw on Linux
                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should throw helpful error when directory creation fails', () => {
                // Mock mkdirSync to throw an error
                configure({
                    platform: 'darwin',
                    existsSync: () => false,
                    mkdirSync: () => {
                        throw new Error('EACCES: permission denied');
                    },
                });

                const config: SqliteConfig = {
                    dialect: 'sqlite',
                    sqlitePath: path.join(testDbDir, 'subdir', 'test.db'),
                };

                try {
                    createDialect(config);
                    expect(true).toBe(false); // Should have thrown
                } catch (err) {
                    const message = (err as Error).message;
                    expect(message).toContain('Failed to create database directory');
                    expect(message).toContain('EACCES: permission denied');
                    expect(message).toContain('DB_PATH=data/exelearning.db');
                }
            });

            it('should handle non-Error throws in mkdirSync', () => {
                // Mock mkdirSync to throw a string (not an Error object)
                configure({
                    platform: 'darwin',
                    existsSync: () => false,
                    mkdirSync: () => {
                        throw 'String error message';
                    },
                });

                const config: SqliteConfig = {
                    dialect: 'sqlite',
                    sqlitePath: path.join(testDbDir, 'another', 'test.db'),
                };

                try {
                    createDialect(config);
                    expect(true).toBe(false);
                } catch (err) {
                    const message = (err as Error).message;
                    expect(message).toContain('String error message');
                }
            });
        });

        describe('PostgreSQL dialect', () => {
            it('should create PostgreSQL dialect', () => {
                const config: PostgresConfig = {
                    dialect: 'postgres',
                    host: 'localhost',
                    port: 5432,
                    database: 'test',
                    user: 'test',
                    password: 'test',
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should throw error when not running in Bun for postgres', () => {
                configure({ isBun: false });

                const config: PostgresConfig = {
                    dialect: 'postgres',
                    host: 'localhost',
                    port: 5432,
                    database: 'test',
                    user: 'test',
                    password: 'test',
                };

                expect(() => createDialect(config)).toThrow('PostgreSQL dialect requires Bun runtime');
            });
        });

        describe('MySQL dialect', () => {
            it('should create MySQL dialect', () => {
                const config: MysqlConfig = {
                    dialect: 'mysql',
                    host: 'localhost',
                    port: 3306,
                    database: 'test',
                    user: 'test',
                    password: 'test',
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should work in any runtime with mysql2', () => {
                // mysql2 works in any runtime, not just Bun
                configure({ isBun: false });

                const config: MysqlConfig = {
                    dialect: 'mysql',
                    host: 'localhost',
                    port: 3306,
                    database: 'test',
                    user: 'test',
                    password: 'test',
                };

                // Should not throw - mysql2 works everywhere
                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });
        });
    });

    describe('dependency injection', () => {
        it('should allow configuring isBun to false for Node.js branch', () => {
            configure({ isBun: false });

            const config: SqliteConfig = {
                dialect: 'sqlite',
                sqlitePath: ':memory:',
            };

            // In Bun environment, better-sqlite3 is not available
            // So this should throw when trying to require it
            expect(() => createDialect(config)).toThrow();
        });

        it('should reset dependencies after test', () => {
            configure({ isBun: false });
            resetDependencies();

            // After reset, should use Bun dialect again
            const config: SqliteConfig = {
                dialect: 'sqlite',
                sqlitePath: ':memory:',
            };
            const dialect = createDialect(config);
            expect(dialect).toBeDefined();
        });

        it('should use Node.js dialect with file-based database', () => {
            configure({ isBun: false });

            const config: SqliteConfig = {
                dialect: 'sqlite',
                sqlitePath: path.join(testDbDir, 'node-file.db'),
            };

            // In Bun environment, better-sqlite3 is not available
            expect(() => createDialect(config)).toThrow();
        });
    });
});
