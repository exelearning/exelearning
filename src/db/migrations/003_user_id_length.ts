/**
 * Migration: Increase user_id column length
 *
 * The user_id column was originally varchar(40), but OpenID providers like Google
 * use SHA256 hashes as subject identifiers (64 characters). Combined with the
 * "oidc:" prefix, this results in 69+ characters.
 *
 * This migration increases the column to varchar(255) to accommodate all auth methods:
 * - Password auth: typically short UUIDs or usernames
 * - CAS auth: varies by institution
 * - OpenID: "oidc:" + subject (up to 64 char hash) = ~70 chars
 * - Guest: "guest:" + UUID = ~42 chars
 */
import { Kysely, sql } from 'kysely';
import { getDialectFromEnv, type DbDialect } from '../dialect';

// ============================================================================
// DEPENDENCY INJECTION FOR TESTING
// ============================================================================

export interface MigrationDependencies {
    getDialect: () => DbDialect;
}

const defaultDeps: MigrationDependencies = {
    getDialect: getDialectFromEnv,
};

let deps = { ...defaultDeps };

/**
 * Configure dependencies for testing
 */
export function configure(newDeps: Partial<MigrationDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

/**
 * Reset dependencies to defaults
 */
export function resetDependencies(): void {
    deps = { ...defaultDeps };
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

export async function up(db: Kysely<unknown>): Promise<void> {
    const dialect = deps.getDialect();

    if (dialect === 'sqlite') {
        // SQLite doesn't enforce varchar length, so no change needed
        // The column type in SQLite is effectively TEXT regardless of declared size
        // But we'll recreate the table for consistency if needed in the future
        return;
    }

    if (dialect === 'mysql') {
        // MySQL/MariaDB: Use MODIFY COLUMN
        await sql`ALTER TABLE users MODIFY COLUMN user_id VARCHAR(255) NOT NULL`.execute(db);
    } else if (dialect === 'postgres') {
        // PostgreSQL: Use ALTER COLUMN TYPE
        await sql`ALTER TABLE users ALTER COLUMN user_id TYPE VARCHAR(255)`.execute(db);
    }
}

export async function down(db: Kysely<unknown>): Promise<void> {
    const dialect = deps.getDialect();

    if (dialect === 'sqlite') {
        return;
    }

    if (dialect === 'mysql') {
        // Revert to original size (may fail if data exceeds 40 chars)
        await sql`ALTER TABLE users MODIFY COLUMN user_id VARCHAR(40) NOT NULL`.execute(db);
    } else if (dialect === 'postgres') {
        await sql`ALTER TABLE users ALTER COLUMN user_id TYPE VARCHAR(40)`.execute(db);
    }
}
