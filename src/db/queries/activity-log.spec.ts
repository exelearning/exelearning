/**
 * Tests for Activity Log Queries
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import type { Database } from '../types';
import { up as up001 } from '../migrations/001_initial';
import { up as up007 } from '../migrations/007_activity_log';
import { insertActivityEvent } from './activity-log';

describe('activity-log queries', () => {
    let db: Kysely<Database>;

    beforeEach(async () => {
        db = new Kysely<Database>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });
        await up001(db);
        await up007(db);

        // Insert a test user for user_id references
        await db
            .insertInto('users')
            .values({
                email: 'admin@test.com',
                user_id: 'usr_test_audit_001',
                password: 'x',
                roles: '["ROLE_USER","ROLE_ADMIN"]',
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

    // ========================================================================
    // insertActivityEvent
    // ========================================================================

    describe('insertActivityEvent', () => {
        it('inserts an event with all fields', async () => {
            const ts = Date.now();
            await insertActivityEvent(db, {
                event_type: 'auth.login',
                user_id: 1,
                created_at: ts,
            });

            const row = await db.selectFrom('activity_log').selectAll().executeTakeFirst();
            expect(row).toBeDefined();
            expect(row!.event_type).toBe('auth.login');
            expect(row!.user_id).toBe(1);
        });

        it('inserts an event with minimal fields (all nullable)', async () => {
            await insertActivityEvent(db, {
                event_type: 'auth.login',
                user_id: null,
                created_at: Date.now(),
            });

            const row = await db.selectFrom('activity_log').selectAll().executeTakeFirst();
            expect(row).toBeDefined();
            expect(row!.user_id).toBeNull();
        });
    });
});
