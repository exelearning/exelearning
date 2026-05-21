/**
 * Sanity test for Kysely subpath exports.
 *
 * Kysely 0.29 moved migration-related symbols (Migrator, FileMigrationProvider,
 * Migration, MigrationProvider, NO_MIGRATIONS, ...) out of the `'kysely'` root
 * and into the `'kysely/migration'` subpath. Importing them from the root now
 * resolves to a `KyselyTypeError` sentinel and throws a `SyntaxError` at
 * runtime when Bun loads the module.
 *
 * This spec exists so that any future bump that breaks the subpath contract
 * fails fast as a focused unit test, instead of cascading through the whole
 * DB-dependent suite with confusing `db.insertInto is not a function` errors.
 */
import { describe, it, expect } from 'bun:test';
import { Kysely } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { createMigrator } from './index';

describe('Kysely subpath exports (0.29+)', () => {
    it('exposes Migrator as a constructor from kysely/migration', () => {
        expect(typeof Migrator).toBe('function');
        expect(Migrator.prototype).toBeDefined();
    });

    it('allows constructing a Migrator with an in-memory database', async () => {
        const db = new Kysely<unknown>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        const provider: MigrationProvider = {
            async getMigrations(): Promise<Record<string, Migration>> {
                return {};
            },
        };

        const migrator = new Migrator({ db, provider });
        expect(migrator).toBeInstanceOf(Migrator);
        expect(typeof migrator.getMigrations).toBe('function');

        await db.destroy();
    });

    it('exposes createMigrator() that returns a working Migrator instance', async () => {
        const db = new Kysely<unknown>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        const migrator = createMigrator(db);
        expect(migrator).toBeInstanceOf(Migrator);
        expect(typeof migrator.migrateToLatest).toBe('function');

        await db.destroy();
    });
});
