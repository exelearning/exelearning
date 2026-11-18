/**
 * Tests for 010_project_platform_binding migration
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up as up001 } from './001_initial';
import { up as up008 } from './008_project_public_view_id';
import { up as up009 } from './009_project_public_view_enabled';
import { up as up010, down as down010 } from './010_project_platform_binding';

describe('010_project_platform_binding migration', () => {
    let db: Kysely<any>;

    beforeEach(async () => {
        db = new Kysely<any>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });
        await up001(db);
        await up008(db);
        await up009(db);
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
    });

    afterEach(async () => {
        await db.destroy();
    });

    async function insertProject(uuid: string, platformId: string | null): Promise<void> {
        await db
            .insertInto('projects')
            .values({
                uuid,
                title: 'Test',
                owner_id: 1,
                status: 'active',
                visibility: 'private',
                saved_once: 0,
                platform_id: platformId,
                created_at: Date.now(),
                updated_at: Date.now(),
            })
            .execute();
    }

    it('adds nullable platform_site and platform_package_hash columns', async () => {
        await up010(db);
        await insertProject('uuid-1', null);

        await db
            .updateTable('projects')
            .set({
                platform_id: '1234',
                platform_site: 'https://moodle.example.com/moodle',
                platform_package_hash: 'a'.repeat(64),
            })
            .where('uuid', '=', 'uuid-1')
            .execute();

        const row = await db
            .selectFrom('projects')
            .select(['platform_id', 'platform_site', 'platform_package_hash'])
            .where('uuid', '=', 'uuid-1')
            .executeTakeFirst();

        expect(row).toEqual({
            platform_id: '1234',
            platform_site: 'https://moodle.example.com/moodle',
            platform_package_hash: 'a'.repeat(64),
        });
    });

    it('keeps existing bare-cmid bindings and leaves the new columns null', async () => {
        await insertProject('legacy-uuid', '1234');

        await up010(db);

        const row = await db
            .selectFrom('projects')
            .select(['platform_id', 'platform_site', 'platform_package_hash'])
            .where('uuid', '=', 'legacy-uuid')
            .executeTakeFirst();

        expect(row).toEqual({ platform_id: '1234', platform_site: null, platform_package_hash: null });
    });

    it('drops both columns on down()', async () => {
        await up010(db);
        await down010(db);

        const cols = await sql<{ name: string }>`PRAGMA table_info(projects)`.execute(db);
        const names = cols.rows.map(c => c.name);
        expect(names).not.toContain('platform_site');
        expect(names).not.toContain('platform_package_hash');
        expect(names).toContain('platform_id');
    });
});
