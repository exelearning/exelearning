/**
 * Tests for legacy Symfony migration
 * Uses an isolated in-memory SQLite database (no global migrations).
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up } from './000_legacy_symfony';
import { tableExists, resetDialectCache } from '../helpers';

describe('000_legacy_symfony migration', () => {
    let db: Kysely<unknown>;

    beforeEach(async () => {
        db = new Kysely({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });
        resetDialectCache();
    });

    afterEach(async () => {
        await db.destroy();
        resetDialectCache();
    });

    it('should skip when no Symfony legacy indicators exist', async () => {
        await db.schema.createTable('users').addColumn('id', 'integer').execute();
        await db.schema
            .createTable('users_preferences')
            .addColumn('id', 'integer')
            .addColumn('preference_key', 'varchar(255)')
            .execute();

        await up(db);

        expect(await tableExists(db, 'users')).toBe(true);
        expect(await tableExists(db, 'users_legacy')).toBe(false);
        expect(await tableExists(db, 'users_preferences')).toBe(true);
        expect(await tableExists(db, 'users_preferences_legacy')).toBe(false);
    });

    it('should rename legacy tables and drop obsolete ones', async () => {
        await db.schema.createTable('users').addColumn('id', 'integer').execute();
        await db.schema
            .createTable('users_preferences')
            .addColumn('id', 'integer')
            .addColumn('user_preferences_key', 'varchar(255)')
            .execute();
        await db.schema.createTable('ode_files').addColumn('id', 'integer').execute();
        await db.schema.createTable('ode_operations_log').addColumn('id', 'integer').execute();

        await up(db);

        expect(await tableExists(db, 'users')).toBe(false);
        expect(await tableExists(db, 'users_legacy')).toBe(true);
        expect(await tableExists(db, 'users_preferences')).toBe(false);
        expect(await tableExists(db, 'users_preferences_legacy')).toBe(true);
        expect(await tableExists(db, 'ode_files')).toBe(false);
        expect(await tableExists(db, 'ode_operations_log')).toBe(false);
    });
});
