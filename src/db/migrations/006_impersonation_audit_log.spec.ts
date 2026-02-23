/**
 * Tests for 006_impersonation_audit_log migration
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up as up001 } from './001_initial';
import { up as up006, down as down006 } from './006_impersonation_audit_log';

describe('006_impersonation_audit_log migration', () => {
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

    it('should create impersonation_audit_logs table', async () => {
        await up006(db);

        const result = await sql<{ name: string }>`
            SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'impersonation_audit_logs'
        `.execute(db);

        expect(result.rows).toHaveLength(1);
    });

    it('should allow insert/update lifecycle rows', async () => {
        await up006(db);

        await db
            .insertInto('users')
            .values({
                email: 'admin@test.com',
                user_id: 'admin-user',
                password: 'x',
                roles: '["ROLE_USER","ROLE_ADMIN"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: Date.now(),
                updated_at: Date.now(),
            })
            .execute();

        await db
            .insertInto('users')
            .values({
                email: 'user@test.com',
                user_id: 'normal-user',
                password: 'x',
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: Date.now(),
                updated_at: Date.now(),
            })
            .execute();

        await db
            .insertInto('impersonation_audit_logs')
            .values({
                session_id: 'session-1',
                impersonator_user_id: 1,
                impersonated_user_id: 2,
                started_at: Date.now(),
                ended_at: null,
                started_by_ip: '127.0.0.1',
                started_user_agent: 'test-agent',
                ended_by_ip: null,
                ended_user_agent: null,
            })
            .execute();

        await db
            .updateTable('impersonation_audit_logs')
            .set({
                ended_at: Date.now(),
                ended_by_ip: '127.0.0.1',
                ended_user_agent: 'test-agent',
            })
            .where('session_id', '=', 'session-1')
            .execute();

        const row = await db
            .selectFrom('impersonation_audit_logs')
            .selectAll()
            .where('session_id', '=', 'session-1')
            .executeTakeFirst();

        expect(row).toBeDefined();
        expect(row?.ended_at).not.toBeNull();
        expect(row?.impersonator_user_id).toBe(1);
        expect(row?.impersonated_user_id).toBe(2);
    });

    it('should drop table on down()', async () => {
        await up006(db);
        await down006(db);

        const result = await sql<{ name: string }>`
            SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'impersonation_audit_logs'
        `.execute(db);

        expect(result.rows).toHaveLength(0);
    });
});
