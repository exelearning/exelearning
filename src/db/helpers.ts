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

import type { Kysely, Insertable, Updateable, ColumnDefinitionBuilder } from 'kysely';
import { sql } from 'kysely';
import type { Database } from './schema';
import { getDialectFromEnv, type DbDialect } from './dialect';

// Cache the dialect to avoid repeated environment lookups
let cachedDialect: DbDialect | null = null;

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
 * Convert binary data to the correct format for the current database.
 * MySQL requires Buffer, SQLite/PostgreSQL work with Uint8Array.
 */
export function toBinaryData(data: Uint8Array | Buffer): Uint8Array | Buffer {
    if (getDialect() === 'mysql') {
        // MySQL requires Buffer for blob columns
        return Buffer.from(data);
    }
    // SQLite and PostgreSQL work with Uint8Array
    return data instanceof Uint8Array ? data : new Uint8Array(data);
}

// ============================================================================
// CROSS-DATABASE TABLE EXISTENCE CHECK
// ============================================================================

/**
 * Check if a table exists (cross-database compatible)
 * Uses the appropriate query for each database type
 */
export async function tableExists(db: Kysely<unknown>, tableName: string): Promise<boolean> {
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

        // MySQL/MariaDB uses information_schema
        const result = await sql<{ count: string }>`
            SELECT COUNT(*) as count FROM information_schema.tables
            WHERE table_name = ${tableName}
        `.execute(db);
        return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
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
 * - MySQL/SQLite: 'blob'
 */
export function getBinaryType(): 'bytea' | 'blob' {
    return getDialect() === 'postgres' ? 'bytea' : 'blob';
}

// ============================================================================
// INSERT HELPERS
// ============================================================================

/**
 * Insert a row and return the complete inserted row
 * Works across SQLite, PostgreSQL, and MySQL
 */
export async function insertAndReturn<T extends keyof Database>(
    db: Kysely<Database>,
    table: T,
    values: Insertable<Database[T]>,
): Promise<Database[T]> {
    if (supportsReturning()) {
        // SQLite and PostgreSQL support RETURNING
        return db
            .insertInto(table)
            .values(values as Insertable<Database[T]>)
            .returningAll()
            .executeTakeFirstOrThrow() as Promise<Database[T]>;
    }

    // MySQL: Insert then SELECT
    const result = await db
        .insertInto(table)
        .values(values as Insertable<Database[T]>)
        .executeTakeFirstOrThrow();

    // Get the inserted row by ID
    const insertId = Number(result.insertId);

    return db
        .selectFrom(table)
        .selectAll()
        .where('id' as keyof Database[T] & string, '=', insertId as Database[T][keyof Database[T]])
        .executeTakeFirstOrThrow() as Promise<Database[T]>;
}

/**
 * Insert multiple rows and return all inserted rows
 */
export async function insertManyAndReturn<T extends keyof Database>(
    db: Kysely<Database>,
    table: T,
    values: Insertable<Database[T]>[],
): Promise<Database[T][]> {
    if (values.length === 0) {
        return [];
    }

    if (supportsReturning()) {
        return db
            .insertInto(table)
            .values(values as Insertable<Database[T]>[])
            .returningAll()
            .execute() as Promise<Database[T][]>;
    }

    // MySQL: Insert then SELECT by range
    // First, get the current max ID
    const maxIdResult = await db
        .selectFrom(table)
        .select(db.fn.max('id' as keyof Database[T] & string).as('maxId'))
        .executeTakeFirst();

    const startId = ((maxIdResult as { maxId: number | null })?.maxId ?? 0) + 1;

    // Insert all rows
    await db
        .insertInto(table)
        .values(values as Insertable<Database[T]>[])
        .execute();

    // Select all newly inserted rows
    return db
        .selectFrom(table)
        .selectAll()
        .where('id' as keyof Database[T] & string, '>=', startId as Database[T][keyof Database[T]])
        .execute() as Promise<Database[T][]>;
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
): Promise<Database[T] | undefined> {
    if (supportsReturning()) {
        return db
            .updateTable(table)
            .set(values as Updateable<Database[T]>)
            .where('id' as keyof Database[T] & string, '=', id as Database[T][keyof Database[T]])
            .returningAll()
            .executeTakeFirst() as Promise<Database[T] | undefined>;
    }

    // MySQL: Update then SELECT
    const result = await db
        .updateTable(table)
        .set(values as Updateable<Database[T]>)
        .where('id' as keyof Database[T] & string, '=', id as Database[T][keyof Database[T]])
        .executeTakeFirst();

    if (!result || result.numUpdatedRows === 0n) {
        return undefined;
    }

    return db
        .selectFrom(table)
        .selectAll()
        .where('id' as keyof Database[T] & string, '=', id as Database[T][keyof Database[T]])
        .executeTakeFirst() as Promise<Database[T] | undefined>;
}

/**
 * Update rows by a string column (like uuid) and return the updated row
 */
export async function updateByColumnAndReturn<T extends keyof Database, C extends keyof Database[T] & string>(
    db: Kysely<Database>,
    table: T,
    column: C,
    columnValue: Database[T][C],
    values: Updateable<Database[T]>,
): Promise<Database[T] | undefined> {
    if (supportsReturning()) {
        return db
            .updateTable(table)
            .set(values as Updateable<Database[T]>)
            .where(column, '=', columnValue)
            .returningAll()
            .executeTakeFirst() as Promise<Database[T] | undefined>;
    }

    // MySQL: Update then SELECT
    const result = await db
        .updateTable(table)
        .set(values as Updateable<Database[T]>)
        .where(column, '=', columnValue)
        .executeTakeFirst();

    if (!result || result.numUpdatedRows === 0n) {
        return undefined;
    }

    return db.selectFrom(table).selectAll().where(column, '=', columnValue).executeTakeFirst() as Promise<
        Database[T] | undefined
    >;
}

// ============================================================================
// DELETE HELPERS
// ============================================================================

/**
 * Delete rows and return the deleted rows
 */
export async function deleteByColumnAndReturn<T extends keyof Database, C extends keyof Database[T] & string>(
    db: Kysely<Database>,
    table: T,
    column: C,
    columnValue: Database[T][C],
): Promise<Database[T][]> {
    if (supportsReturning()) {
        return db.deleteFrom(table).where(column, '=', columnValue).returningAll().execute() as Promise<Database[T][]>;
    }

    // MySQL: SELECT first, then DELETE
    const rows = (await db.selectFrom(table).selectAll().where(column, '=', columnValue).execute()) as Database[T][];

    if (rows.length > 0) {
        await db.deleteFrom(table).where(column, '=', columnValue).execute();
    }

    return rows;
}

/**
 * Delete a single row by ID and return it
 */
export async function deleteByIdAndReturn<T extends keyof Database>(
    db: Kysely<Database>,
    table: T,
    id: number,
): Promise<Database[T] | undefined> {
    const rows = await deleteByColumnAndReturn(
        db,
        table,
        'id' as keyof Database[T] & string,
        id as Database[T][keyof Database[T]],
    );
    return rows[0];
}
