/**
 * Tests for Bun MySQL Dialect
 */
import { describe, it, expect } from 'bun:test';
import { BunMysqlDialect, type BunMysqlDialectConfig } from './bun-mysql-dialect';
import { MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from 'kysely';

describe('BunMysqlDialect', () => {
    const config: BunMysqlDialectConfig = {
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
    };

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
            // Mock db for introspector
            const mockDb = {} as Parameters<typeof dialect.createIntrospector>[0];
            const introspector = dialect.createIntrospector(mockDb);
            expect(introspector).toBeInstanceOf(MysqlIntrospector);
        });
    });
});
