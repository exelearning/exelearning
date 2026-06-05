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

import type { Kysely, Insertable, Updateable, ColumnDefinitionBuilder, DataTypeExpression } from 'kysely';
import { sql } from 'kysely';
import type { Database } from './types';
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
export async function columnExists(db: Kysely<unknown>, tableName: string, columnName: string): Promise<boolean> {
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
export function getBinaryType(): DataTypeExpression {
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
 * Insert a row, ignoring if it violates a unique constraint.
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
        // MySQL/MariaDB: Use INSERT IGNORE with raw SQL
        // Note: ON CONFLICT DO NOTHING syntax is not supported
        const keys = Object.keys(values as object);
        const vals = Object.values(values as object);

        // Build column list and value placeholders
        const columnList = keys.map(k => sql.id(k));
        const valuePlaceholders = vals.map(v => sql.lit(v));

        await sql`INSERT IGNORE INTO ${sql.table(table)} (${sql.join(columnList)}) VALUES (${sql.join(valuePlaceholders)})`.execute(
            db,
        );
    } else {
        // PostgreSQL/SQLite: Use ON CONFLICT DO NOTHING
        await db
            .insertInto(table)
            .values(values as Insertable<Database[T]>)
            .onConflict(oc => oc.doNothing())
            .execute();
    }
}

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
        .select(eb => eb.fn.max<number>('id' as keyof Database[T] & string).as('maxId'))
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
