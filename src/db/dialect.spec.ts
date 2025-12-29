/**
 * Tests for Kysely Dialect Factory
 * Covers SQLite, MySQL/MariaDB, and PostgreSQL
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
    getDbConfig,
    getDialectFromEnv,
    createDialect,
    configure,
    resetDependencies,
    type DbDialect,
    type DbConfig,
} from './dialect';
import * as fs from 'fs';
import * as path from 'path';

describe('Kysely Dialect Factory', () => {
    const originalEnv = { ...process.env };
    const testDbDir = path.join(process.cwd(), 'test', 'temp', 'dialect-test');

    beforeEach(() => {
        // Reset environment
        process.env = { ...originalEnv };
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

    // =========================================================================
    // getDialectFromEnv - Driver mapping tests
    // =========================================================================

    describe('getDialectFromEnv', () => {
        it('should return sqlite by default', () => {
            delete process.env.DB_DRIVER;
            expect(getDialectFromEnv()).toBe('sqlite');
        });

        it('should return sqlite for pdo_sqlite', () => {
            process.env.DB_DRIVER = 'pdo_sqlite';
            expect(getDialectFromEnv()).toBe('sqlite');
        });

        it('should return sqlite for sqlite', () => {
            process.env.DB_DRIVER = 'sqlite';
            expect(getDialectFromEnv()).toBe('sqlite');
        });

        it('should return sqlite for sqlite3', () => {
            process.env.DB_DRIVER = 'sqlite3';
            expect(getDialectFromEnv()).toBe('sqlite');
        });

        it('should return mysql for pdo_mysql', () => {
            process.env.DB_DRIVER = 'pdo_mysql';
            expect(getDialectFromEnv()).toBe('mysql');
        });

        it('should return mysql for mysql', () => {
            process.env.DB_DRIVER = 'mysql';
            expect(getDialectFromEnv()).toBe('mysql');
        });

        it('should return mysql for mysql2', () => {
            process.env.DB_DRIVER = 'mysql2';
            expect(getDialectFromEnv()).toBe('mysql');
        });

        it('should return mysql for mariadb', () => {
            process.env.DB_DRIVER = 'mariadb';
            expect(getDialectFromEnv()).toBe('mysql');
        });

        it('should return postgres for pdo_pgsql', () => {
            process.env.DB_DRIVER = 'pdo_pgsql';
            expect(getDialectFromEnv()).toBe('postgres');
        });

        it('should return postgres for pgsql', () => {
            process.env.DB_DRIVER = 'pgsql';
            expect(getDialectFromEnv()).toBe('postgres');
        });

        it('should return postgres for postgres', () => {
            process.env.DB_DRIVER = 'postgres';
            expect(getDialectFromEnv()).toBe('postgres');
        });

        it('should return postgres for postgresql', () => {
            process.env.DB_DRIVER = 'postgresql';
            expect(getDialectFromEnv()).toBe('postgres');
        });

        it('should be case insensitive', () => {
            process.env.DB_DRIVER = 'PDO_MYSQL';
            expect(getDialectFromEnv()).toBe('mysql');

            process.env.DB_DRIVER = 'PDO_PGSQL';
            expect(getDialectFromEnv()).toBe('postgres');

            process.env.DB_DRIVER = 'SQLITE';
            expect(getDialectFromEnv()).toBe('sqlite');
        });

        it('should default to sqlite for unknown drivers', () => {
            process.env.DB_DRIVER = 'unknown_driver';
            expect(getDialectFromEnv()).toBe('sqlite');
        });
    });

    // =========================================================================
    // getDbConfig - Configuration tests
    // =========================================================================

    describe('getDbConfig', () => {
        describe('SQLite configuration', () => {
            it('should return default SQLite configuration', () => {
                delete process.env.DB_DRIVER;
                delete process.env.DB_PATH;
                const config = getDbConfig();

                expect(config.dialect).toBe('sqlite');
                expect(config.sqlitePath).toBe('data/exelearning.db');
            });

            it('should use DB_PATH from environment', () => {
                process.env.DB_DRIVER = 'pdo_sqlite';
                process.env.DB_PATH = '/custom/path/test.db';
                const config = getDbConfig();

                expect(config.dialect).toBe('sqlite');
                expect(config.sqlitePath).toBe('/custom/path/test.db');
            });

            it('should include pool settings', () => {
                process.env.DB_POOL_MIN = '2';
                process.env.DB_POOL_MAX = '20';
                const config = getDbConfig();

                expect(config.poolMin).toBe(2);
                expect(config.poolMax).toBe(20);
            });

            it('should use default pool settings when not specified', () => {
                delete process.env.DB_POOL_MIN;
                delete process.env.DB_POOL_MAX;
                const config = getDbConfig();

                expect(config.poolMin).toBe(0);
                expect(config.poolMax).toBe(10);
            });
        });

        describe('MySQL configuration', () => {
            beforeEach(() => {
                process.env.DB_DRIVER = 'pdo_mysql';
            });

            it('should return MySQL configuration with defaults', () => {
                const config = getDbConfig();

                expect(config.dialect).toBe('mysql');
                expect(config.host).toBe('localhost');
                expect(config.port).toBe(3306);
                expect(config.database).toBe('exelearning');
                expect(config.user).toBe('exelearning');
                expect(config.password).toBe('');
                expect(config.charset).toBe('utf8mb4');
            });

            it('should use environment variables for MySQL', () => {
                process.env.DB_HOST = 'mariadb.local';
                process.env.DB_PORT = '3307';
                process.env.DB_NAME = 'mydb';
                process.env.DB_USER = 'myuser';
                process.env.DB_PASSWORD = 'secret123';
                process.env.DB_CHARSET = 'utf8';

                const config = getDbConfig();

                expect(config.dialect).toBe('mysql');
                expect(config.host).toBe('mariadb.local');
                expect(config.port).toBe(3307);
                expect(config.database).toBe('mydb');
                expect(config.user).toBe('myuser');
                expect(config.password).toBe('secret123');
                expect(config.charset).toBe('utf8');
            });

            it('should not include sqlitePath for MySQL', () => {
                const config = getDbConfig();

                expect(config.sqlitePath).toBeUndefined();
            });
        });

        describe('PostgreSQL configuration', () => {
            beforeEach(() => {
                process.env.DB_DRIVER = 'pdo_pgsql';
            });

            it('should return PostgreSQL configuration with defaults', () => {
                const config = getDbConfig();

                expect(config.dialect).toBe('postgres');
                expect(config.host).toBe('localhost');
                expect(config.port).toBe(5432);
                expect(config.database).toBe('exelearning');
                expect(config.user).toBe('exelearning');
                expect(config.password).toBe('');
            });

            it('should use environment variables for PostgreSQL', () => {
                process.env.DB_HOST = 'postgres.local';
                process.env.DB_PORT = '5433';
                process.env.DB_NAME = 'pgdb';
                process.env.DB_USER = 'pguser';
                process.env.DB_PASSWORD = 'pgsecret';

                const config = getDbConfig();

                expect(config.dialect).toBe('postgres');
                expect(config.host).toBe('postgres.local');
                expect(config.port).toBe(5433);
                expect(config.database).toBe('pgdb');
                expect(config.user).toBe('pguser');
                expect(config.password).toBe('pgsecret');
            });

            it('should use default port 5432 for PostgreSQL', () => {
                delete process.env.DB_PORT;
                const config = getDbConfig();

                expect(config.port).toBe(5432);
            });
        });
    });

    // =========================================================================
    // createDialect - Dialect creation tests
    // =========================================================================

    describe('createDialect', () => {
        describe('SQLite dialect', () => {
            it('should create SQLite dialect with default config', () => {
                process.env.DB_PATH = path.join(testDbDir, 'default.db');
                const dialect = createDialect();

                expect(dialect).toBeDefined();
            });

            it('should create SQLite dialect with custom config', () => {
                const config: DbConfig = {
                    dialect: 'sqlite',
                    sqlitePath: path.join(testDbDir, 'custom.db'),
                };
                const dialect = createDialect(config);

                expect(dialect).toBeDefined();
            });

            it('should create parent directory if not exists', () => {
                const nestedPath = path.join(testDbDir, 'nested', 'deep', 'test.db');
                const config: DbConfig = {
                    dialect: 'sqlite',
                    sqlitePath: nestedPath,
                };

                createDialect(config);

                const dir = path.dirname(nestedPath);
                expect(fs.existsSync(dir)).toBe(true);
            });

            it('should handle absolute paths', () => {
                const absolutePath = path.join(testDbDir, 'absolute.db');
                const config: DbConfig = {
                    dialect: 'sqlite',
                    sqlitePath: absolutePath,
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should handle relative paths', () => {
                const relativePath = 'test/temp/dialect-test/relative.db';
                const config: DbConfig = {
                    dialect: 'sqlite',
                    sqlitePath: relativePath,
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should handle :memory: database without creating directories', () => {
                const config: DbConfig = {
                    dialect: 'sqlite',
                    sqlitePath: ':memory:',
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should use default sqlitePath when not provided', () => {
                const config: DbConfig = {
                    dialect: 'sqlite',
                    // sqlitePath not provided
                };

                // Should not throw
                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });
        });

        describe('MySQL dialect', () => {
            it('should create MySQL dialect with config', () => {
                const config: DbConfig = {
                    dialect: 'mysql',
                    host: 'localhost',
                    port: 3306,
                    database: 'testdb',
                    user: 'testuser',
                    password: 'testpass',
                    charset: 'utf8mb4',
                    poolMax: 5,
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should create MySQL dialect with minimal config', () => {
                const config: DbConfig = {
                    dialect: 'mysql',
                    host: 'localhost',
                    database: 'testdb',
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should use default poolMax when not specified', () => {
                const config: DbConfig = {
                    dialect: 'mysql',
                    host: 'localhost',
                    database: 'testdb',
                };

                // Should not throw
                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should create MySQL dialect from environment', () => {
                process.env.DB_DRIVER = 'pdo_mysql';
                process.env.DB_HOST = 'localhost';
                process.env.DB_NAME = 'envdb';
                process.env.DB_USER = 'envuser';
                process.env.DB_PASSWORD = 'envpass';

                const dialect = createDialect();
                expect(dialect).toBeDefined();
            });
        });

        describe('PostgreSQL dialect', () => {
            it('should create PostgreSQL dialect with config', () => {
                const config: DbConfig = {
                    dialect: 'postgres',
                    host: 'localhost',
                    port: 5432,
                    database: 'testdb',
                    user: 'testuser',
                    password: 'testpass',
                    poolMin: 2,
                    poolMax: 10,
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should create PostgreSQL dialect with minimal config', () => {
                const config: DbConfig = {
                    dialect: 'postgres',
                    host: 'localhost',
                    database: 'testdb',
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should use default pool settings when not specified', () => {
                const config: DbConfig = {
                    dialect: 'postgres',
                    host: 'localhost',
                    database: 'testdb',
                };

                // Should not throw
                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });

            it('should create PostgreSQL dialect from environment', () => {
                process.env.DB_DRIVER = 'pdo_pgsql';
                process.env.DB_HOST = 'localhost';
                process.env.DB_NAME = 'pgenvdb';
                process.env.DB_USER = 'pgenvuser';
                process.env.DB_PASSWORD = 'pgenvpass';

                const dialect = createDialect();
                expect(dialect).toBeDefined();
            });
        });

        describe('unknown dialect fallback', () => {
            it('should fallback to SQLite for unknown dialect', () => {
                const config = {
                    dialect: 'unknown' as DbDialect,
                    sqlitePath: path.join(testDbDir, 'fallback.db'),
                };

                const dialect = createDialect(config);
                expect(dialect).toBeDefined();
            });
        });
    });

    // =========================================================================
    // Dependency injection tests
    // =========================================================================

    describe('dependency injection', () => {
        it('should allow configuring isBun to false for Node.js branch', () => {
            configure({ isBun: false });

            const config: DbConfig = {
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
            const config: DbConfig = {
                dialect: 'sqlite',
                sqlitePath: ':memory:',
            };
            const dialect = createDialect(config);
            expect(dialect).toBeDefined();
        });

        it('should use Node.js dialect with file-based database', () => {
            configure({ isBun: false });

            const config: DbConfig = {
                dialect: 'sqlite',
                sqlitePath: path.join(testDbDir, 'node-file.db'),
            };

            // In Bun environment, better-sqlite3 is not available
            expect(() => createDialect(config)).toThrow();
        });
    });

    // =========================================================================
    // Integration tests - config to dialect flow
    // =========================================================================

    describe('config to dialect flow', () => {
        it('should create SQLite dialect from full environment setup', () => {
            process.env.DB_DRIVER = 'sqlite';
            process.env.DB_PATH = path.join(testDbDir, 'flow-sqlite.db');

            const config = getDbConfig();
            expect(config.dialect).toBe('sqlite');

            const dialect = createDialect(config);
            expect(dialect).toBeDefined();
        });

        it('should create MySQL dialect from full environment setup', () => {
            process.env.DB_DRIVER = 'pdo_mysql';
            process.env.DB_HOST = '127.0.0.1';
            process.env.DB_PORT = '3306';
            process.env.DB_NAME = 'flowdb';
            process.env.DB_USER = 'flowuser';
            process.env.DB_PASSWORD = 'flowpass';

            const config = getDbConfig();
            expect(config.dialect).toBe('mysql');
            expect(config.host).toBe('127.0.0.1');

            const dialect = createDialect(config);
            expect(dialect).toBeDefined();
        });

        it('should create PostgreSQL dialect from full environment setup', () => {
            process.env.DB_DRIVER = 'pdo_pgsql';
            process.env.DB_HOST = '127.0.0.1';
            process.env.DB_PORT = '5432';
            process.env.DB_NAME = 'pgflowdb';
            process.env.DB_USER = 'pgflowuser';
            process.env.DB_PASSWORD = 'pgflowpass';

            const config = getDbConfig();
            expect(config.dialect).toBe('postgres');
            expect(config.host).toBe('127.0.0.1');

            const dialect = createDialect(config);
            expect(dialect).toBeDefined();
        });
    });
});
