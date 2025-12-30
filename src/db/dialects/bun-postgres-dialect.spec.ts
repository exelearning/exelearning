/**
 * Tests for Bun PostgreSQL Dialect
 */
import { describe, it, expect } from 'bun:test';
import { BunPostgresDialect, type BunPostgresDialectConfig } from './bun-postgres-dialect';
import { PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';

describe('BunPostgresDialect', () => {
    const config: BunPostgresDialectConfig = {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
    };

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
            // Mock db for introspector
            const mockDb = {} as Parameters<typeof dialect.createIntrospector>[0];
            const introspector = dialect.createIntrospector(mockDb);
            expect(introspector).toBeInstanceOf(PostgresIntrospector);
        });
    });
});
