/**
 * Cross-Database Compatible Query Helpers
 *
 * MySQL/MariaDB doesn't support RETURNING clauses in INSERT/UPDATE/DELETE statements.
 * This module provides helpers that work across SQLite, PostgreSQL, and MySQL.
 *
 * Strategy:
 * - SQLite/PostgreSQL: Use native RETURNING support
 * - MySQL: Use two-step approach (execute + SELECT)
 */

import type { Kysely, Insertable, Updateable, Selectable, ColumnDefinitionBuilder } from 'kysely';
import { sql } from 'kysely';
import type { Database } from './types';
import { getDialectFromEnv, type DbDialect } from './dialect';

/**
 * Schema-erased Kysely handle for migrations (schema is in flux).
 */
// biome-ignore lint/suspicious/noExplicitAny: generic-table fluent API is uncallable under TS 7
export type UntypedKysely = Kysely<any>;

// Cache the dialect to avoid repeated environment lookups
let cachedDialect: DbDialect | null = null;

/** Row type returned for rows of an arbitrary table of the database. */
type TableRow<T extends keyof Database> = Selectable<Database[T]>;

/**
 * Executes a dynamic table operation against Kysely.
 * Kysely's query builders are distributive over union types (keyof Database), causing call signature
 * incompatibility in TypeScript strict mode when chaining methods like .where() or .set() on generic tables.
 * This helper isolates dynamic query execution to internal helpers while all public helpers maintain strongly-typed signatures.
 */
// biome-ignore lint/suspicious/noExplicitAny: internal dynamic query builder for generic table operations
function dynamicDb(db: Kysely<Database>): any {
    return db;
}

/**
 * Get the current database dialect (cached)
 */
export function getDialect(): DbDialect {
    if (cachedDialect === null) {
        cachedDialect = getDialectFromEnv();
    }
    return cachedDialect;
}

/**
 * Check if current dialect supports RETURNING
 */
export function supportsReturning(): boolean {
    return getDialect() !== 'mysql';
}

/**
 * Reset dialect cache (for testing)
 */
export function resetDialectCache(): void {
    cachedDialect = null;
}

/**
 * Convert binary data to the correct format for database storage.
 * - MySQL (mysql2): requires Buffer (Uint8Array causes "Unknown column '0'" error)
 * - SQLite/PostgreSQL: accept Uint8Array directly
 */
export function toBinaryData(data: Uint8Array | Buffer): Buffer | Uint8Array {
    if (getDialect() === 'mysql') {
        // mysql2 requires Buffer for binary data, not Uint8Array
        return Buffer.isBuffer(data) ? data : Buffer.from(data);
    }
    // SQLite and PostgreSQL work with Uint8Array
    return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/**
 * Convert data read from database back to Uint8Array.
 * Handles Buffers and Uint8Arrays.
 */
export function fromBinaryData(data: unknown): Uint8Array {
    if (data instanceof Uint8Array) {
        return data;
    }
    if (Buffer.isBuffer(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    console.warn(`[fromBinaryData] Unknown data type: ${typeof data}`);
    return new Uint8Array(0);
}

// ============================================================================
// CROSS-DATABASE TABLE EXISTENCE CHECK
// ============================================================================

/**
 * Check if a table exists (cross-database compatible)
 * Uses the appropriate query for each database type
 */
export async function tableExists<DB>(db: Kysely<DB>, tableName: string): Promise<boolean> {
    const dialect = getDialect();

    try {
        if (dialect === 'sqlite') {
            // SQLite uses sqlite_master
            const result = await sql<{ count: number }>`
                SELECT COUNT(*) as count FROM sqlite_master
                WHERE type='table' AND name=${tableName}
            `.execute(db);
            return (result.rows[0]?.count ?? 0) > 0;
        }

        if (dialect === 'postgres') {
            // PostgreSQL uses information_schema with specific schema
            const result = await sql<{ count: string }>`
                SELECT COUNT(*)::text as count FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = ${tableName}
            `.execute(db);
            return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
        }

        if (dialect === 'mysql') {
            // MySQL/MariaDB: avoid information_schema permission issues
            await sql`SELECT 1 FROM ${sql.table(tableName)} WHERE 1=0`.execute(db);
            return true;
        }

        // Fallback (shouldn't be reached with known dialects)
        return false;
    } catch {
        return false;
    }
}

/**
 * Check if a column exists in a table (cross-database compatible)
 */
export async function columnExists<DB>(db: Kysely<DB>, tableName: string, columnName: string): Promise<boolean> {
    const dialect = getDialect();

    try {
        if (dialect === 'sqlite') {
            // SQLite: Use PRAGMA table_info
            const result = await sql<{ name: string }>`
                PRAGMA table_info(${sql.raw(tableName)})
            `.execute(db);
            return result.rows.some(row => row.name === columnName);
        }

        if (dialect === 'postgres') {
            // PostgreSQL: Use information_schema.columns
            const result = await sql<{ count: string }>`
                SELECT COUNT(*)::text as count FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = ${tableName}
                  AND column_name = ${columnName}
            `.execute(db);
            return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
        }

        if (dialect === 'mysql') {
            // MySQL/MariaDB: avoid information_schema permission issues
            await sql`SELECT ${sql.ref(columnName)} FROM ${sql.table(tableName)} WHERE 1=0`.execute(db);
            return true;
        }

        // Fallback (shouldn't be reached with known dialects)
        return false;
    } catch {
        return false;
    }
}

// ============================================================================
// CROSS-DATABASE SCHEMA HELPERS
// ============================================================================

/**
 * Get the correct data type for auto-incrementing primary key.
 * - PostgreSQL: 'serial' (which is an alias for integer + sequence)
 * - MySQL/SQLite: 'integer' (with autoIncrement() modifier)
 */
export function getAutoIncrementType(): 'serial' | 'integer' {
    return getDialect() === 'postgres' ? 'serial' : 'integer';
}

/**
 * Add auto-increment modifier if needed (not needed for PostgreSQL 'serial')
 */
export function addAutoIncrement(col: ColumnDefinitionBuilder): ColumnDefinitionBuilder {
    // PostgreSQL 'serial' type already handles auto-increment
    if (getDialect() === 'postgres') {
        return col;
    }
    return col.autoIncrement();
}

/**
 * Get the correct data type for binary/blob columns.
 * - PostgreSQL: 'bytea'
 * - MySQL/MariaDB: 'longblob' (4GB max - needed for large Yjs documents 20MB+)
 * - SQLite: 'blob'
 *
 * Note: MySQL blob types have different size limits:
 * - TINYBLOB: 255 bytes
 * - BLOB: 64KB
 * - MEDIUMBLOB: 16MB
 * - LONGBLOB: 4GB
 *
 * We use LONGBLOB for MySQL to support large Yjs documents (20MB+).
 */
export function getBinaryType(): 'bytea' | 'blob' | ReturnType<typeof sql> {
    const dialect = getDialect();
    if (dialect === 'postgres') {
        return 'bytea';
    }
    if (dialect === 'mysql') {
        // Use sql tag to allow MySQL-specific type not in Kysely's ColumnDataType
        return sql`longblob`;
    }
    // SQLite: Use 'blob'
    return 'blob';
}

// ============================================================================
// INSERT HELPERS
// ============================================================================

/**
 * Insert a row, ignoring conflicts on unique constraints.
 * - PostgreSQL/SQLite: ON CONFLICT DO NOTHING
 * - MySQL/MariaDB: INSERT IGNORE
 *
 * This is useful for upsert-like operations where we want to silently skip
 * duplicates without throwing an error.
 */
export async function insertIgnore<T extends keyof Database>(
    db: Kysely<Database>,
    table: T,
    values: Insertable<Database[T]>,
): Promise<void> {
    if (getDialect() === 'mysql') {
        // MySQL/MariaDB: INSERT IGNORE with bound parameters (not sql.lit)
        const entries = Object.entries(values as object).filter(([, v]) => v !== undefined);
        const columnList = entries.map(([k]) => sql.id(k));
        const valuePlaceholders = entries.map(([, v]) => sql`${v}`);

        await sql`INSERT IGNORE INTO ${sql.table(table)} (${sql.join(columnList)}) VALUES (${sql.join(valuePlaceholders)})`.execute(
            db,
        );
        return;
    }

    await dynamicDb(db)
        .insertInto(table)
        .values(values)
        .onConflict((oc: { doNothing: () => unknown }) => oc.doNothing())
        .execute();
}

/**
 * Insert a row and return the complete inserted row
 * Works across SQLite, PostgreSQL, and MySQL
 */
export async function insertAndReturn<T extends keyof Database>(
    db: Kysely<Database>,
    table: T,
    values: Insertable<Database[T]>,
): Promise<TableRow<T>> {
    const qdb = dynamicDb(db);

    if (supportsReturning()) {
        return qdb.insertInto(table).values(values).returningAll().executeTakeFirstOrThrow() as Promise<TableRow<T>>;
    }

    // MySQL: Insert then SELECT
    const result = await qdb.insertInto(table).values(values).executeTakeFirstOrThrow();
    const insertId = Number(result.insertId);

    return qdb.selectFrom(table).selectAll().where('id', '=', insertId).executeTakeFirstOrThrow() as Promise<
        TableRow<T>
    >;
}

/**
 * Insert multiple rows and return all inserted rows
 */
export async function insertManyAndReturn<T extends keyof Database>(
    db: Kysely<Database>,
    table: T,
    values: Insertable<Database[T]>[],
): Promise<TableRow<T>[]> {
    if (values.length === 0) {
        return [];
    }

    const qdb = dynamicDb(db);

    if (supportsReturning()) {
        return qdb.insertInto(table).values(values).returningAll().execute() as Promise<TableRow<T>[]>;
    }

    // MySQL: Insert then SELECT by range
    const maxIdResult = await qdb
        .selectFrom(table)
        .select((eb: { fn: { max: (col: string) => { as: (alias: string) => unknown } } }) =>
            eb.fn.max('id').as('maxId'),
        )
        .executeTakeFirst();

    const startId = ((maxIdResult as { maxId: number | null } | undefined)?.maxId ?? 0) + 1;

    await qdb.insertInto(table).values(values).execute();

    return qdb.selectFrom(table).selectAll().where('id', '>=', startId).execute() as Promise<TableRow<T>[]>;
}

// ============================================================================
// UPDATE HELPERS
// ============================================================================

/**
 * Update a row by ID and return the updated row
 */
export async function updateByIdAndReturn<T extends keyof Database>(
    db: Kysely<Database>,
    table: T,
    id: number,
    values: Updateable<Database[T]>,
): Promise<TableRow<T> | undefined> {
    return updateWhereAndReturn(db, table, 'id', id, values);
}

/**
 * Update rows by a column value and return the updated row
 */
export async function updateByColumnAndReturn<T extends keyof Database, C extends keyof Database[T] & string>(
    db: Kysely<Database>,
    table: T,
    column: C,
    columnValue: Database[T][C],
    values: Updateable<Database[T]>,
): Promise<TableRow<T> | undefined> {
    return updateWhereAndReturn(db, table, column, columnValue, values);
}

async function updateWhereAndReturn<T extends keyof Database>(
    db: Kysely<Database>,
    table: T,
    whereColumn: string,
    whereValue: unknown,
    values: Updateable<Database[T]>,
): Promise<TableRow<T> | undefined> {
    const qdb = dynamicDb(db);

    if (supportsReturning()) {
        return qdb
            .updateTable(table)
            .set(values)
            .where(whereColumn, '=', whereValue)
            .returningAll()
            .executeTakeFirst() as Promise<TableRow<T> | undefined>;
    }

    const result = await qdb.updateTable(table).set(values).where(whereColumn, '=', whereValue).executeTakeFirst();

    if (!result || result.numUpdatedRows === 0n) {
        return undefined;
    }

    return qdb.selectFrom(table).selectAll().where(whereColumn, '=', whereValue).executeTakeFirst() as Promise<
        TableRow<T> | undefined
    >;
}

// ============================================================================
// DELETE HELPERS
// ============================================================================

async function deleteWhereAndReturn<T extends keyof Database>(
    db: Kysely<Database>,
    table: T,
    whereColumn: string,
    whereValue: unknown,
): Promise<TableRow<T>[]> {
    const qdb = dynamicDb(db);

    if (supportsReturning()) {
        return qdb.deleteFrom(table).where(whereColumn, '=', whereValue).returningAll().execute() as Promise<
            TableRow<T>[]
        >;
    }

    const rows = (await qdb
        .selectFrom(table)
        .selectAll()
        .where(whereColumn, '=', whereValue)
        .execute()) as TableRow<T>[];

    if (rows.length > 0) {
        await qdb.deleteFrom(table).where(whereColumn, '=', whereValue).execute();
    }

    return rows;
}

/**
 * Delete rows matching a column value and return the deleted rows
 */
export async function deleteByColumnAndReturn<T extends keyof Database, C extends keyof Database[T] & string>(
    db: Kysely<Database>,
    table: T,
    column: C,
    columnValue: Database[T][C],
): Promise<TableRow<T>[]> {
    return deleteWhereAndReturn(db, table, column, columnValue);
}

/**
 * Delete a single row by ID and return it
 */
export async function deleteByIdAndReturn<T extends keyof Database>(
    db: Kysely<Database>,
    table: T,
    id: number,
): Promise<TableRow<T> | undefined> {
    const rows = await deleteWhereAndReturn(db, table, 'id', id);
    return rows[0];
}
