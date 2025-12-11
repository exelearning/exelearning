/**
 * Test Database Helper
 * Creates in-memory SQLite databases for testing
 * Uses bun:sqlite via kysely-bun-worker (no native compilation required)
 */
import { Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import type { Database } from '../../src/db/types';
import { up, down } from '../../src/db/migrations/001_initial';

/**
 * Create a fresh in-memory test database
 * Each call creates a new isolated database instance
 */
export async function createTestDb(): Promise<Kysely<Database>> {
    const db = new Kysely<Database>({
        dialect: new BunSqliteDialect({ url: ':memory:' }),
    });
    await up(db);
    return db;
}

/**
 * Clean all data from test database (keeps schema)
 * Call in beforeEach() to ensure test isolation
 */
export async function cleanTestDb(db: Kysely<Database>): Promise<void> {
    // Delete in reverse FK order
    await db.deleteFrom('yjs_updates').execute();
    await db.deleteFrom('yjs_documents').execute();
    await db.deleteFrom('assets').execute();
    await db.deleteFrom('project_collaborators').execute();
    await db.deleteFrom('projects').execute();
    await db.deleteFrom('users_preferences').execute();
    await db.deleteFrom('users').execute();
}

/**
 * Destroy test database
 * Call in afterAll() to clean up resources
 */
export async function destroyTestDb(db: Kysely<Database>): Promise<void> {
    await db.destroy();
}

/**
 * Create a test user and return their ID
 * Useful for tests that need a user reference
 */
export async function seedTestUser(
    db: Kysely<Database>,
    overrides: Partial<{
        email: string;
        user_id: string;
        password: string;
        roles: string;
    }> = {}
): Promise<number> {
    const now = new Date().toISOString();
    const result = await db.insertInto('users')
        .values({
            email: overrides.email ?? `test-${Date.now()}@example.com`,
            user_id: overrides.user_id ?? `user-${Date.now()}`,
            password: overrides.password ?? 'hashed-password',
            roles: overrides.roles ?? '["ROLE_USER"]',
            is_lopd_accepted: 1,
            is_active: 1,
            created_at: now,
            updated_at: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

    return result.id;
}

/**
 * Create a test project and return its ID
 */
export async function seedTestProject(
    db: Kysely<Database>,
    ownerId: number,
    overrides: Partial<{
        uuid: string;
        title: string;
        description: string;
    }> = {}
): Promise<number> {
    const now = new Date().toISOString();
    const result = await db.insertInto('projects')
        .values({
            uuid: overrides.uuid ?? `proj-${Date.now()}`,
            title: overrides.title ?? 'Test Project',
            description: overrides.description ?? 'A test project',
            owner_id: ownerId,
            status: 'active',
            visibility: 'private',
            saved_once: 0,
            is_active: 1,
            created_at: now,
            updated_at: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

    return result.id;
}
