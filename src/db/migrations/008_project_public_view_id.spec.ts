/**
 * Tests for 008_project_public_view_id migration
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up as up001 } from './001_initial';
import { up as up008, down as down008 } from './008_project_public_view_id';

describe('008_project_public_view_id migration', () => {
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

    async function insertUser(): Promise<void> {
        await db
            .insertInto('users')
            .values({
                email: 'owner@test.com',
                user_id: 'owner-user',
                password: 'x',
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: Date.now(),
                updated_at: Date.now(),
            })
            .execute();
    }

    function projectValues(uuid: string, publicViewId: string | null) {
        return {
            uuid,
            title: 'Test',
            owner_id: 1,
            status: 'active',
            visibility: 'private',
            saved_once: 0,
            public_view_id: publicViewId,
            created_at: Date.now(),
            updated_at: Date.now(),
        };
    }

    it('adds the public_view_id column', async () => {
        await up008(db);

        await insertUser();
        await db.insertInto('projects').values(projectValues('uuid-1', 'pv-1')).execute();

        const row = await db
            .selectFrom('projects')
            .select(['uuid', 'public_view_id'])
            .where('uuid', '=', 'uuid-1')
            .executeTakeFirst();

        expect(row?.public_view_id).toBe('pv-1');
    });

    it('allows multiple NULL public_view_id values', async () => {
        await up008(db);
        await insertUser();

        await db.insertInto('projects').values(projectValues('uuid-1', null)).execute();
        await db.insertInto('projects').values(projectValues('uuid-2', null)).execute();

        const rows = await db.selectFrom('projects').selectAll().execute();
        expect(rows).toHaveLength(2);
    });

    it('enforces uniqueness of non-null public_view_id', async () => {
        await up008(db);
        await insertUser();

        await db.insertInto('projects').values(projectValues('uuid-1', 'dup')).execute();

        let threw = false;
        try {
            await db.insertInto('projects').values(projectValues('uuid-2', 'dup')).execute();
        } catch {
            threw = true;
        }
        expect(threw).toBe(true);
    });

    it('drops the column and index on down()', async () => {
        await up008(db);
        await down008(db);

        const indexes = await sql<{ name: string }>`
            SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_projects_public_view_id'
        `.execute(db);
        expect(indexes.rows).toHaveLength(0);

        const cols = await sql<{ name: string }>`PRAGMA table_info(projects)`.execute(db);
        expect(cols.rows.some(c => c.name === 'public_view_id')).toBe(false);
    });
});
