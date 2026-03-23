---
name: database-migration
description: Changing database schema with Kysely migrations across SQLite, PostgreSQL, and MariaDB.
---

# Skill: Database Migration

> Parent: [AGENTS.md](../../../AGENTS.md) | Related: [backend-service](../backend-service/SKILL.md), [backend-route](../backend-route/SKILL.md)

## When to Use

Changing database schema — adding tables, columns, indexes, or modifying existing structures.

## Key Files

- `src/db/migrations/*.ts` — numbered migration files (000_, 001_, 002_, etc.)
- `src/db/migrations/*.spec.ts` — colocated migration tests
- `src/db/queries/*.ts` — query functions to update after schema changes
- `src/db/client.ts` — database client
- `src/db/dialect/` — multi-DB dialect support (SQLite, PostgreSQL, MariaDB)

## Pattern

```typescript
// src/db/migrations/00N_my_migration.ts
import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.createTable('my_table')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('name', 'varchar(255)', (col) => col.notNull())
        .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable('my_table').execute();
}
```

### Test Pattern

Use `DB_PATH=:memory:` for fast, isolated tests:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

let db: Kysely<any>;
beforeEach(async () => {
    db = createTestDb(); // in-memory SQLite
    await up(db);
});
afterEach(async () => { await db.destroy(); });

it('creates table with expected columns', async () => {
    const result = await db.selectFrom('my_table').selectAll().execute();
    expect(result).toEqual([]);
});

it('down removes the table', async () => {
    await down(db);
    // Verify table no longer exists
});
```

## Commands

```bash
bun test src/db/migrations/00N_my_migration.spec.ts     # Run migration test
make fix                                                 # Lint
```

## Gotchas

- **Multi-DB compatibility is non-negotiable** — must work on SQLite, PostgreSQL, AND MariaDB. No DB-specific syntax (`AUTOINCREMENT` vs `AUTO_INCREMENT`, `TEXT` vs `VARCHAR`, etc.). Use Kysely's schema builder which abstracts these differences.
- **Sequential numbering** — check existing files and use the next number. Gaps or duplicates break the migration runner.
- **Always provide both `up()` and `down()`** — `down()` is needed for rollbacks and testing.
- **Update query functions** — after adding/modifying columns, update related functions in `src/db/queries/`. A migration without query updates is incomplete.
- **Never use file-based DBs in tests** — always `DB_PATH=:memory:` for speed and isolation.
- **Soft deletes** — some tables use soft deletes (`deleted_at` column). Queries must include `WHERE deleted_at IS NULL` or results will include deactivated records.

## Done When

- [ ] Migration numbered correctly (next in sequence)
- [ ] `up()` and `down()` both implemented
- [ ] Works across all three DB drivers (no DB-specific syntax)
- [ ] `.spec.ts` colocated, tests both `up()` and `down()`
- [ ] Related query files in `src/db/queries/` updated
- [ ] `make fix` passes clean
