import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import type { Database } from '../types';
import { up as up001 } from '../migrations/001_initial';
import { up as up006 } from '../migrations/006_impersonation_audit_log';
import {
    createImpersonationAuditSession,
    endImpersonationAuditSession,
    findImpersonationAuditSessionBySessionId,
} from './impersonation';

describe('impersonation queries', () => {
    let db: Kysely<Database>;

    beforeEach(async () => {
        db = new Kysely<Database>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });
        await up001(db);
        await up006(db);

        await db
            .insertInto('users')
            .values([
                {
                    email: 'admin@test.com',
                    user_id: 'admin-user',
                    password: 'x',
                    roles: '["ROLE_USER","ROLE_ADMIN"]',
                    is_lopd_accepted: 1,
                    is_active: 1,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                },
                {
                    email: 'user@test.com',
                    user_id: 'normal-user',
                    password: 'x',
                    roles: '["ROLE_USER"]',
                    is_lopd_accepted: 1,
                    is_active: 1,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                },
            ])
            .execute();
    });

    afterEach(async () => {
        await db.destroy();
    });

    it('should create and find an impersonation audit session', async () => {
        await createImpersonationAuditSession(db, {
            sessionId: 'session-a',
            impersonatorUserId: 1,
            impersonatedUserId: 2,
            startedByIp: '127.0.0.1',
            startedUserAgent: 'bun-test',
        });

        const row = await findImpersonationAuditSessionBySessionId(db, 'session-a');
        expect(row).toBeDefined();
        expect(row?.ended_at).toBeNull();
        expect(row?.impersonator_user_id).toBe(1);
        expect(row?.impersonated_user_id).toBe(2);
    });

    it('should end an active impersonation session only once', async () => {
        await createImpersonationAuditSession(db, {
            sessionId: 'session-b',
            impersonatorUserId: 1,
            impersonatedUserId: 2,
        });

        const endedFirst = await endImpersonationAuditSession(db, {
            sessionId: 'session-b',
            endedByIp: '127.0.0.1',
            endedUserAgent: 'bun-test',
        });
        const endedSecond = await endImpersonationAuditSession(db, {
            sessionId: 'session-b',
        });

        expect(endedFirst).toBe(true);
        expect(endedSecond).toBe(false);
    });
});
