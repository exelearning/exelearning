/**
 * Tests for Kysely Dialect Factory
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getDbConfig, getDialectFromEnv, createDialect, type DbDialect } from './dialect';
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
        // Clean up test directory
        if (fs.existsSync(testDbDir)) {
            fs.rmSync(testDbDir, { recursive: true, force: true });
        }
    });

    describe('getDbConfig', () => {
        it('should return default SQLite configuration', () => {
            delete process.env.DB_PATH;
            const config = getDbConfig();

            expect(config.dialect).toBe('sqlite');
            expect(config.sqlitePath).toBe('data/exelearning.db');
        });

        it('should use DB_PATH from environment', () => {
            process.env.DB_PATH = '/custom/path/test.db';
            const config = getDbConfig();

            expect(config.sqlitePath).toBe('/custom/path/test.db');
        });

        it('should always return sqlite dialect', () => {
            const config = getDbConfig();
            expect(config.dialect).toBe('sqlite');
        });
    });

    describe('getDialectFromEnv', () => {
        it('should always return sqlite', () => {
            const dialect = getDialectFromEnv();
            expect(dialect).toBe('sqlite');
        });

        it('should return correct type', () => {
            const dialect: DbDialect = getDialectFromEnv();
            expect(dialect).toBe('sqlite');
        });
    });

    describe('createDialect', () => {
        it('should create SQLite dialect with default config', () => {
            process.env.DB_PATH = path.join(testDbDir, 'default.db');
            const dialect = createDialect();

            expect(dialect).toBeDefined();
        });

        it('should create SQLite dialect with custom config', () => {
            const config = {
                dialect: 'sqlite' as DbDialect,
                sqlitePath: path.join(testDbDir, 'custom.db'),
            };
            const dialect = createDialect(config);

            expect(dialect).toBeDefined();
        });

        it('should create parent directory if not exists', () => {
            const nestedPath = path.join(testDbDir, 'nested', 'deep', 'test.db');
            const config = {
                dialect: 'sqlite' as DbDialect,
                sqlitePath: nestedPath,
            };

            createDialect(config);

            const dir = path.dirname(nestedPath);
            expect(fs.existsSync(dir)).toBe(true);
        });

        it('should handle absolute paths', () => {
            const absolutePath = path.join(testDbDir, 'absolute.db');
            const config = {
                dialect: 'sqlite' as DbDialect,
                sqlitePath: absolutePath,
            };

            const dialect = createDialect(config);
            expect(dialect).toBeDefined();
        });

        it('should handle relative paths', () => {
            // Set DB_PATH to a path relative to cwd that exists
            const relativePath = 'test/temp/dialect-test/relative.db';
            const config = {
                dialect: 'sqlite' as DbDialect,
                sqlitePath: relativePath,
            };

            const dialect = createDialect(config);
            expect(dialect).toBeDefined();
        });
    });
});
