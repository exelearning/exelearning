/**
 * Tests for 008_project_folders migration
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up as up001 } from './001_initial';
import { up as up008, down as down008 } from './008_project_folders';

describe('008_project_folders migration', () => {
    let db: Kysely<any>;

    beforeEach(async () => {
        db = new Kysely<any>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });
        await up001(db);
    });

    afterEach(async () => {
        await db.destroy();
    });

    async function seedUser(email: string): Promise<number> {
        const now = Date.now();
        const result = await db
            .insertInto('users')
            .values({
                email,
                user_id: email,
                password: 'x',
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now,
                updated_at: now,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
        return result.id;
    }

    async function seedProject(ownerId: number, uuid: string): Promise<number> {
        const now = Date.now();
        const result = await db
            .insertInto('projects')
            .values({
                uuid,
                title: 'Test Project',
                owner_id: ownerId,
                status: 'active',
                visibility: 'private',
                saved_once: 1,
                created_at: now,
                updated_at: now,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
        return result.id;
    }

    it('should create project_folders and project_folder_assignments tables', async () => {
        await up008(db);

        const result = await sql<{ name: string }>`
            SELECT name FROM sqlite_master WHERE type = 'table'
            AND name IN ('project_folders', 'project_folder_assignments')
        `.execute(db);

        expect(result.rows.map(r => r.name).sort()).toEqual(['project_folder_assignments', 'project_folders']);
    });

    it('should allow creating a folder and assigning a project to it', async () => {
        await up008(db);

        const userId = await seedUser('owner@test.com');
        const projectId = await seedProject(userId, 'proj-1');
        const now = Date.now();

        const folder = await db
            .insertInto('project_folders')
            .values({ uuid: 'folder-uuid-1', user_id: userId, name: 'Math 101', created_at: now, updated_at: now })
            .returning('id')
            .executeTakeFirstOrThrow();

        await db
            .insertInto('project_folder_assignments')
            .values({ project_id: projectId, user_id: userId, folder_id: folder.id, created_at: now, updated_at: now })
            .execute();

        const assignment = await db
            .selectFrom('project_folder_assignments')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('user_id', '=', userId)
            .executeTakeFirst();

        expect(assignment).toBeDefined();
        expect(assignment?.folder_id).toBe(folder.id);
    });

    it('should allow duplicate folder names at the DB level (uniqueness is enforced by the service, not a DB constraint)', async () => {
        // SQL treats every NULL as distinct in a unique index, so a DB-level
        // (user_id, parent_folder_id, name) constraint cannot catch duplicate
        // *root* folder names — see the migration's module comment. This test
        // documents that the DB intentionally allows it.
        await up008(db);
        const userId = await seedUser('owner2@test.com');
        const now = Date.now();

        await db
            .insertInto('project_folders')
            .values({ uuid: 'folder-a', user_id: userId, name: 'Duplicate', created_at: now, updated_at: now })
            .execute();

        await expect(
            db
                .insertInto('project_folders')
                .values({ uuid: 'folder-b', user_id: userId, name: 'Duplicate', created_at: now, updated_at: now })
                .execute(),
        ).resolves.toBeDefined();
    });

    it('should allow nesting a folder under another via parent_folder_id', async () => {
        await up008(db);
        const userId = await seedUser('owner-nest@test.com');
        const now = Date.now();

        const parent = await db
            .insertInto('project_folders')
            .values({ uuid: 'parent-uuid', user_id: userId, name: 'Parent', created_at: now, updated_at: now })
            .returning('id')
            .executeTakeFirstOrThrow();

        const child = await db
            .insertInto('project_folders')
            .values({
                uuid: 'child-uuid',
                user_id: userId,
                parent_folder_id: parent.id,
                name: 'Child',
                created_at: now,
                updated_at: now,
            })
            .returning(['id', 'parent_folder_id'])
            .executeTakeFirstOrThrow();

        expect(child.parent_folder_id).toBe(parent.id);
    });

    it('should default parent_folder_id to null for a top-level folder', async () => {
        await up008(db);
        const userId = await seedUser('owner-root@test.com');
        const now = Date.now();

        const folder = await db
            .insertInto('project_folders')
            .values({ uuid: 'root-uuid', user_id: userId, name: 'Root', created_at: now, updated_at: now })
            .returning('parent_folder_id')
            .executeTakeFirstOrThrow();

        expect(folder.parent_folder_id).toBeNull();
    });

    it('should reject assigning the same project to two folders for the same user', async () => {
        await up008(db);
        const userId = await seedUser('owner3@test.com');
        const projectId = await seedProject(userId, 'proj-3');
        const now = Date.now();

        const folderA = await db
            .insertInto('project_folders')
            .values({ uuid: 'folder-a3', user_id: userId, name: 'Folder A', created_at: now, updated_at: now })
            .returning('id')
            .executeTakeFirstOrThrow();
        const folderB = await db
            .insertInto('project_folders')
            .values({ uuid: 'folder-b3', user_id: userId, name: 'Folder B', created_at: now, updated_at: now })
            .returning('id')
            .executeTakeFirstOrThrow();

        await db
            .insertInto('project_folder_assignments')
            .values({
                project_id: projectId,
                user_id: userId,
                folder_id: folderA.id,
                created_at: now,
                updated_at: now,
            })
            .execute();

        await expect(
            db
                .insertInto('project_folder_assignments')
                .values({
                    project_id: projectId,
                    user_id: userId,
                    folder_id: folderB.id,
                    created_at: now,
                    updated_at: now,
                })
                .execute(),
        ).rejects.toThrow();
    });

    it('should drop tables on down()', async () => {
        await up008(db);
        await down008(db);

        const result = await sql<{ name: string }>`
            SELECT name FROM sqlite_master WHERE type = 'table'
            AND name IN ('project_folders', 'project_folder_assignments')
        `.execute(db);

        expect(result.rows).toHaveLength(0);
    });
});
