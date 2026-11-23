/**
 * Tests for 011_project_activity migration
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up as up001 } from './001_initial';
import { up as up011, down as down011 } from './011_project_activity';

describe('011_project_activity migration', () => {
    let db: Kysely<any>;

    beforeEach(async () => {
        db = new Kysely<any>({ dialect: new BunSqliteDialect({ url: ':memory:' }) });
        await sql`PRAGMA foreign_keys = ON`.execute(db);
        await up001(db);
    });

    afterEach(async () => {
        await db.destroy();
    });

    async function seedUserAndProject(): Promise<{ userId: number; projectId: number }> {
        const now = Date.now();
        const user = await db
            .insertInto('users')
            .values({
                email: `u-${now}@test.local`,
                user_id: `owner-${now}`,
                password: 'x',
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now,
                updated_at: now,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
        const project = await db
            .insertInto('projects')
            .values({
                uuid: `p-${now}`,
                title: 'Test',
                owner_id: user.id,
                status: 'active',
                visibility: 'private',
                saved_once: 1,
                created_at: now,
                updated_at: now,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
        return { userId: user.id, projectId: project.id };
    }

    function row(projectId: number, userId: number | null, overrides: Record<string, unknown> = {}) {
        const now = Date.now();
        return {
            project_id: projectId,
            user_id: userId,
            event_type: 'page.edited',
            target_type: 'page',
            target_id: 'page-1',
            target_label: 'Intro',
            details: null,
            session_id: null,
            dedupe_key: null,
            first_occurred_at: now,
            occurred_at: now,
            created_at: now,
            ...overrides,
        };
    }

    it('creates the table with its defaults and indexes', async () => {
        await up011(db);
        const { userId, projectId } = await seedUserAndProject();

        await db.insertInto('project_activity').values(row(projectId, userId)).execute();
        const stored = await db.selectFrom('project_activity').selectAll().executeTakeFirstOrThrow();
        expect(stored.event_count).toBe(1);
        expect(stored.event_type).toBe('page.edited');

        const indexes = await sql<{ name: string }>`PRAGMA index_list(project_activity)`.execute(db);
        const names = indexes.rows.map(r => r.name);
        expect(names).toContain('idx_project_activity_project_occurred');
        expect(names).toContain('idx_project_activity_project_user');
        expect(names).toContain('idx_project_activity_occurred');
        expect(names).toContain('uq_project_activity_dedupe');
    });

    it('is idempotent when applied twice', async () => {
        await up011(db);
        await up011(db);
        const tables = await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type='table'`.execute(db);
        expect(tables.rows.filter(t => t.name === 'project_activity')).toHaveLength(1);
    });

    it('cascades with the project and nulls the actor when the user is deleted', async () => {
        await up011(db);
        const { userId, projectId } = await seedUserAndProject();
        await db.insertInto('project_activity').values(row(projectId, userId)).execute();

        // A second actor who is not the owner exercises the SET NULL path.
        const now = Date.now();
        const other = await db
            .insertInto('users')
            .values({
                email: `other-${now}@test.local`,
                user_id: `other-${now}`,
                password: 'x',
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now,
                updated_at: now,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
        await db
            .insertInto('project_activity')
            .values(row(projectId, other.id, { target_id: 'page-2' }))
            .execute();
        await db.deleteFrom('users').where('id', '=', other.id).execute();

        const anonymised = await db
            .selectFrom('project_activity')
            .selectAll()
            .where('target_id', '=', 'page-2')
            .executeTakeFirstOrThrow();
        expect(anonymised.user_id).toBeNull();

        await db.deleteFrom('projects').where('id', '=', projectId).execute();
        const remaining = await db.selectFrom('project_activity').selectAll().execute();
        expect(remaining).toHaveLength(0);
    });

    it('allows many NULL dedupe keys but rejects a duplicate key within one project', async () => {
        await up011(db);
        const { userId, projectId } = await seedUserAndProject();
        await db.insertInto('project_activity').values(row(projectId, userId)).execute();
        await db.insertInto('project_activity').values(row(projectId, userId)).execute();
        await db
            .insertInto('project_activity')
            .values(row(projectId, userId, { dedupe_key: 'k1' }))
            .execute();

        let failed = false;
        try {
            await db
                .insertInto('project_activity')
                .values(row(projectId, userId, { dedupe_key: 'k1' }))
                .execute();
        } catch {
            failed = true;
        }
        expect(failed).toBe(true);
    });

    it('drops the table on rollback', async () => {
        await up011(db);
        await down011(db);
        const tables = await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type='table'`.execute(db);
        expect(tables.rows.some(t => t.name === 'project_activity')).toBe(false);
    });
});
