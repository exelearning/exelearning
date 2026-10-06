/**
 * Tests for 009_project_public_view_enabled migration
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up as up001 } from './001_initial';
import { up as up008 } from './008_project_public_view_id';
import { up as up009, down as down009 } from './009_project_public_view_enabled';

describe('009_project_public_view_enabled migration', () => {
    let db: Kysely<any>;

    beforeEach(async () => {
        db = new Kysely<any>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });
        await up001(db);
        await up008(db);
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

    it('adds the public_view_enabled column defaulting to 0', async () => {
        await up009(db);
        await insertUser();

        await db
            .insertInto('projects')
            .values({
                uuid: 'uuid-1',
                title: 'Test',
                owner_id: 1,
                status: 'active',
                visibility: 'private',
                saved_once: 0,
                created_at: Date.now(),
                updated_at: Date.now(),
            })
            .execute();

        const row = await db
            .selectFrom('projects')
            .select(['uuid', 'public_view_enabled'])
            .where('uuid', '=', 'uuid-1')
            .executeTakeFirst();

        expect(row?.public_view_enabled).toBe(0);
    });

    it('drops the column on down()', async () => {
        await up009(db);
        await down009(db);

        const cols = await sql<{ name: string }>`PRAGMA table_info(projects)`.execute(db);
        expect(cols.rows.some(c => c.name === 'public_view_enabled')).toBe(false);
    });
});
