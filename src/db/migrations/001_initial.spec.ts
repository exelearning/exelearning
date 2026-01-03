/**
 * Tests for Initial Migration
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import * as fs from 'fs-extra';
import { up, down } from './001_initial';

// Test database path
const TEST_DB_PATH = '/tmp/migration-test.db';

// Use in-memory database for testing
let db: Kysely<any>;

// Helper to get table info
async function getTableInfo(tableName: string) {
    const result = await sql`PRAGMA table_info(${sql.raw(tableName)})`.execute(db);
    return result.rows as any[];
}

// Helper to check if table exists
async function tableExists(tableName: string): Promise<boolean> {
    const result = await sql`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name=${tableName}
    `.execute(db);
    return (result.rows as any[]).length > 0;
}

// Helper to get indexes for a table
async function getIndexes(tableName: string) {
    const result = await sql`PRAGMA index_list(${sql.raw(tableName)})`.execute(db);
    return result.rows as any[];
}

describe('001_initial Migration', () => {
    beforeEach(async () => {
        // Clean up any existing test database
        if (await fs.pathExists(TEST_DB_PATH)) {
            await fs.remove(TEST_DB_PATH);
        }

        // Create database using the project's dialect
        db = new Kysely({
            dialect: new BunSqliteDialect({
                url: TEST_DB_PATH,
            }),
        });
    });

    afterEach(async () => {
        await db.destroy();
        // Clean up test database
        if (await fs.pathExists(TEST_DB_PATH)) {
            await fs.remove(TEST_DB_PATH);
        }
    });

    describe('up migration', () => {
        beforeEach(async () => {
            await up(db);
        });

        describe('users table', () => {
            it('should create users table', async () => {
                expect(await tableExists('users')).toBe(true);
            });

            it('should have required columns', async () => {
                const columns = await getTableInfo('users');
                const columnNames = columns.map(c => c.name);

                expect(columnNames).toContain('id');
                expect(columnNames).toContain('email');
                expect(columnNames).toContain('user_id');
                expect(columnNames).toContain('password');
                expect(columnNames).toContain('roles');
                expect(columnNames).toContain('is_lopd_accepted');
                expect(columnNames).toContain('quota_mb');
                expect(columnNames).toContain('external_identifier');
                expect(columnNames).toContain('api_token');
                expect(columnNames).toContain('is_active');
                expect(columnNames).toContain('created_at');
                expect(columnNames).toContain('updated_at');
            });

            it('should have id as primary key', async () => {
                const columns = await getTableInfo('users');
                const idColumn = columns.find(c => c.name === 'id');

                expect(idColumn.pk).toBe(1);
            });

            it('should have email as unique', async () => {
                // Try to insert duplicate email
                await db
                    .insertInto('users')
                    .values({
                        email: 'test@test.com',
                        user_id: 'user-1',
                        password: 'hash',
                        roles: '[]',
                    })
                    .execute();

                await expect(
                    db
                        .insertInto('users')
                        .values({
                            email: 'test@test.com',
                            user_id: 'user-2',
                            password: 'hash2',
                            roles: '[]',
                        })
                        .execute(),
                ).rejects.toThrow();
            });

            it('should have default values', async () => {
                await db
                    .insertInto('users')
                    .values({
                        email: 'default@test.com',
                        user_id: 'user-default',
                        password: 'hash',
                    })
                    .execute();

                const user = await db
                    .selectFrom('users')
                    .selectAll()
                    .where('email', '=', 'default@test.com')
                    .executeTakeFirst();

                expect(user!.roles).toBe('[]');
                expect(user!.is_lopd_accepted).toBe(0);
                expect(user!.is_active).toBe(1);
            });
        });

        describe('users_preferences table', () => {
            it('should create users_preferences table', async () => {
                expect(await tableExists('users_preferences')).toBe(true);
            });

            it('should have required columns', async () => {
                const columns = await getTableInfo('users_preferences');
                const columnNames = columns.map(c => c.name);

                expect(columnNames).toContain('id');
                expect(columnNames).toContain('user_id');
                expect(columnNames).toContain('preference_key');
                expect(columnNames).toContain('value');
                expect(columnNames).toContain('description');
                expect(columnNames).toContain('is_active');
            });

            it('should have index on user_id', async () => {
                const indexes = await getIndexes('users_preferences');
                const indexNames = indexes.map(i => i.name);

                expect(indexNames).toContain('idx_users_preferences_user_id');
            });
        });

        describe('projects table', () => {
            it('should create projects table', async () => {
                expect(await tableExists('projects')).toBe(true);
            });

            it('should have required columns', async () => {
                const columns = await getTableInfo('projects');
                const columnNames = columns.map(c => c.name);

                expect(columnNames).toContain('id');
                expect(columnNames).toContain('uuid');
                expect(columnNames).toContain('title');
                expect(columnNames).toContain('description');
                expect(columnNames).toContain('owner_id');
                expect(columnNames).toContain('status');
                expect(columnNames).toContain('visibility');
                expect(columnNames).toContain('language');
                expect(columnNames).toContain('author');
                expect(columnNames).toContain('license');
                expect(columnNames).toContain('last_accessed_at');
                expect(columnNames).toContain('saved_once');
                // Note: is_active was removed - use status instead
            });

            it('should have uuid as unique', async () => {
                // Create user first
                await db
                    .insertInto('users')
                    .values({
                        email: 'owner@test.com',
                        user_id: 'owner',
                        password: 'hash',
                    })
                    .execute();

                // Insert project
                await db
                    .insertInto('projects')
                    .values({
                        uuid: 'test-uuid',
                        title: 'Test Project',
                        owner_id: 1,
                    })
                    .execute();

                // Try duplicate uuid
                await expect(
                    db
                        .insertInto('projects')
                        .values({
                            uuid: 'test-uuid',
                            title: 'Another Project',
                            owner_id: 1,
                        })
                        .execute(),
                ).rejects.toThrow();
            });

            it('should have default values', async () => {
                await db
                    .insertInto('users')
                    .values({
                        email: 'owner@test.com',
                        user_id: 'owner',
                        password: 'hash',
                    })
                    .execute();

                await db
                    .insertInto('projects')
                    .values({
                        uuid: 'defaults-test',
                        title: 'Defaults Test',
                        owner_id: 1,
                    })
                    .execute();

                const project = await db
                    .selectFrom('projects')
                    .selectAll()
                    .where('uuid', '=', 'defaults-test')
                    .executeTakeFirst();

                expect(project!.status).toBe('active');
                expect(project!.visibility).toBe('private');
                expect(project!.saved_once).toBe(0);
                // Note: is_active was removed - use status instead
            });

            it('should reference users table', async () => {
                // Enable foreign keys
                await sql`PRAGMA foreign_keys = ON`.execute(db);

                // Try to insert project with non-existent owner
                await expect(
                    db
                        .insertInto('projects')
                        .values({
                            uuid: 'orphan-project',
                            title: 'Orphan',
                            owner_id: 999,
                        })
                        .execute(),
                ).rejects.toThrow();
            });
        });

        describe('project_collaborators table', () => {
            it('should create project_collaborators table', async () => {
                expect(await tableExists('project_collaborators')).toBe(true);
            });

            it('should have required columns', async () => {
                const columns = await getTableInfo('project_collaborators');
                const columnNames = columns.map(c => c.name);

                expect(columnNames).toContain('project_id');
                expect(columnNames).toContain('user_id');
            });

            it('should have unique composite index', async () => {
                const indexes = await getIndexes('project_collaborators');
                const pkIndex = indexes.find(i => i.name === 'idx_project_collaborators_pk');

                expect(pkIndex).toBeDefined();
                expect(pkIndex.unique).toBe(1);
            });

            it('should enforce foreign keys', async () => {
                // Enable foreign keys for SQLite
                await sql`PRAGMA foreign_keys = ON`.execute(db);

                await expect(
                    db
                        .insertInto('project_collaborators')
                        .values({
                            project_id: 999,
                            user_id: 999,
                        })
                        .execute(),
                ).rejects.toThrow();
            });
        });

        describe('assets table', () => {
            it('should create assets table', async () => {
                expect(await tableExists('assets')).toBe(true);
            });

            it('should have required columns', async () => {
                const columns = await getTableInfo('assets');
                const columnNames = columns.map(c => c.name);

                expect(columnNames).toContain('id');
                expect(columnNames).toContain('project_id');
                expect(columnNames).toContain('filename');
                expect(columnNames).toContain('storage_path');
                expect(columnNames).toContain('mime_type');
                expect(columnNames).toContain('file_size');
                expect(columnNames).toContain('client_id');
                expect(columnNames).toContain('component_id');
                expect(columnNames).toContain('content_hash');
            });

            it('should have unique index on client_id and project_id', async () => {
                const indexes = await getIndexes('assets');
                const clientIndex = indexes.find(i => i.name === 'idx_asset_client_project');

                expect(clientIndex).toBeDefined();
                expect(clientIndex.unique).toBe(1);
            });
        });

        describe('yjs_documents table', () => {
            it('should create yjs_documents table', async () => {
                expect(await tableExists('yjs_documents')).toBe(true);
            });

            it('should have required columns', async () => {
                const columns = await getTableInfo('yjs_documents');
                const columnNames = columns.map(c => c.name);

                expect(columnNames).toContain('id');
                expect(columnNames).toContain('project_id');
                expect(columnNames).toContain('snapshot_data');
                expect(columnNames).toContain('snapshot_version');
            });

            it('should have project_id as unique', async () => {
                // Enable foreign keys
                await sql`PRAGMA foreign_keys = ON`.execute(db);

                // Create user and project first
                await db
                    .insertInto('users')
                    .values({
                        email: 'yjs@test.com',
                        user_id: 'yjs-user',
                        password: 'hash',
                    })
                    .execute();

                await db
                    .insertInto('projects')
                    .values({
                        uuid: 'yjs-project',
                        title: 'Yjs Project',
                        owner_id: 1,
                    })
                    .execute();

                // Insert first document
                await db
                    .insertInto('yjs_documents')
                    .values({
                        project_id: 1,
                        snapshot_data: Buffer.from([1, 2, 3]),
                    })
                    .execute();

                // Try duplicate project_id
                await expect(
                    db
                        .insertInto('yjs_documents')
                        .values({
                            project_id: 1,
                            snapshot_data: Buffer.from([4, 5, 6]),
                        })
                        .execute(),
                ).rejects.toThrow();
            });
        });

        describe('yjs_updates table', () => {
            it('should create yjs_updates table', async () => {
                expect(await tableExists('yjs_updates')).toBe(true);
            });

            it('should have required columns', async () => {
                const columns = await getTableInfo('yjs_updates');
                const columnNames = columns.map(c => c.name);

                expect(columnNames).toContain('id');
                expect(columnNames).toContain('project_id');
                expect(columnNames).toContain('update_data');
                expect(columnNames).toContain('version');
                expect(columnNames).toContain('client_id');
            });

            it('should have index on project_id and version', async () => {
                const indexes = await getIndexes('yjs_updates');
                const versionIndex = indexes.find(i => i.name === 'idx_yjs_updates_project_version');

                expect(versionIndex).toBeDefined();
            });

            it('should allow multiple updates per project', async () => {
                // Enable foreign keys
                await sql`PRAGMA foreign_keys = ON`.execute(db);

                // Create user and project
                await db
                    .insertInto('users')
                    .values({
                        email: 'updates@test.com',
                        user_id: 'updates-user',
                        password: 'hash',
                    })
                    .execute();

                await db
                    .insertInto('projects')
                    .values({
                        uuid: 'updates-project',
                        title: 'Updates Project',
                        owner_id: 1,
                    })
                    .execute();

                // Insert multiple updates
                await db
                    .insertInto('yjs_updates')
                    .values({
                        project_id: 1,
                        update_data: Buffer.from([1]),
                        version: '1',
                    })
                    .execute();

                await db
                    .insertInto('yjs_updates')
                    .values({
                        project_id: 1,
                        update_data: Buffer.from([2]),
                        version: '2',
                    })
                    .execute();

                const updates = await db.selectFrom('yjs_updates').selectAll().where('project_id', '=', 1).execute();

                expect(updates.length).toBe(2);
            });
        });
    });

    describe('down migration', () => {
        beforeEach(async () => {
            // First run up migration
            await up(db);
        });

        it('should drop all tables', async () => {
            // Verify tables exist
            expect(await tableExists('users')).toBe(true);
            expect(await tableExists('users_preferences')).toBe(true);
            expect(await tableExists('projects')).toBe(true);
            expect(await tableExists('project_collaborators')).toBe(true);
            expect(await tableExists('assets')).toBe(true);
            expect(await tableExists('yjs_documents')).toBe(true);
            expect(await tableExists('yjs_updates')).toBe(true);

            // Run down migration
            await down(db);

            // Verify tables are dropped
            expect(await tableExists('users')).toBe(false);
            expect(await tableExists('users_preferences')).toBe(false);
            expect(await tableExists('projects')).toBe(false);
            expect(await tableExists('project_collaborators')).toBe(false);
            expect(await tableExists('assets')).toBe(false);
            expect(await tableExists('yjs_documents')).toBe(false);
            expect(await tableExists('yjs_updates')).toBe(false);
        });

        it('should be idempotent (can run multiple times)', async () => {
            await down(db);
            await down(db); // Should not throw

            expect(await tableExists('users')).toBe(false);
        });
    });

    describe('migration integrity', () => {
        it('should support full CRUD operations after migration', async () => {
            await up(db);

            // Create user
            const insertedUser = await db
                .insertInto('users')
                .values({
                    email: 'crud@test.com',
                    user_id: 'crud-user',
                    password: 'hash',
                })
                .returning(['id'])
                .executeTakeFirst();

            expect(insertedUser!.id).toBeDefined();

            // Create project
            const insertedProject = await db
                .insertInto('projects')
                .values({
                    uuid: 'crud-project',
                    title: 'CRUD Test',
                    owner_id: insertedUser!.id,
                })
                .returning(['id'])
                .executeTakeFirst();

            expect(insertedProject!.id).toBeDefined();

            // Update project
            await db
                .updateTable('projects')
                .set({ title: 'Updated CRUD Test' })
                .where('id', '=', insertedProject!.id)
                .execute();

            const updated = await db
                .selectFrom('projects')
                .select('title')
                .where('id', '=', insertedProject!.id)
                .executeTakeFirst();

            expect(updated!.title).toBe('Updated CRUD Test');

            // Delete project (will cascade to yjs_documents, etc)
            await db.deleteFrom('projects').where('id', '=', insertedProject!.id).execute();

            const deleted = await db
                .selectFrom('projects')
                .selectAll()
                .where('id', '=', insertedProject!.id)
                .executeTakeFirst();

            expect(deleted).toBeUndefined();
        });

        it('should maintain referential integrity', async () => {
            await up(db);
            await sql`PRAGMA foreign_keys = ON`.execute(db);

            // Create user
            await db
                .insertInto('users')
                .values({
                    email: 'ref@test.com',
                    user_id: 'ref-user',
                    password: 'hash',
                })
                .execute();

            // Create project
            await db
                .insertInto('projects')
                .values({
                    uuid: 'ref-project',
                    title: 'Ref Test',
                    owner_id: 1,
                })
                .execute();

            // Create asset
            await db
                .insertInto('assets')
                .values({
                    project_id: 1,
                    filename: 'test.jpg',
                    storage_path: '/path/to/test.jpg',
                })
                .execute();

            // Delete project should cascade to assets
            await db.deleteFrom('projects').where('id', '=', 1).execute();

            const assets = await db.selectFrom('assets').selectAll().where('project_id', '=', 1).execute();

            expect(assets.length).toBe(0);
        });
    });
});
