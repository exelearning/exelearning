/**
 * Tests for Admin Analytics Queries
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import type { Database } from '../types';
import { up as up001 } from '../migrations/001_initial';
import { up as up007 } from '../migrations/007_activity_log';
import { insertActivityEvent } from './activity-log';
import { getActiveUserMetrics, getActivityTimeSeries, getPeakUsage } from './admin-analytics';

// Helper: insert a minimal audit event
async function seedEvent(
    db: Kysely<Database>,
    overrides: Partial<Parameters<typeof insertActivityEvent>[1]> & { event_type: string },
): Promise<void> {
    await insertActivityEvent(db, {
        event_type: overrides.event_type,
        user_id: overrides.user_id ?? null,
        created_at: overrides.created_at ?? Date.now(),
    });
}

describe('admin-analytics queries', () => {
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
                user_id: 'usr_test_analytics_001',
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
    // getActiveUserMetrics
    // ========================================================================

    describe('getActiveUserMetrics', () => {
        it('returns zeros when no events exist', async () => {
            const result = await getActiveUserMetrics(db);
            expect(result).toEqual({ dau: 0, wau: 0, mau: 0 });
        });

        it('counts DAU from last 24h, WAU from last 7d, MAU from last 30d', async () => {
            const now = Date.now();

            // 2h ago — counts in DAU, WAU, MAU
            await seedEvent(db, {
                event_type: 'auth.login',
                user_id: 1,
                created_at: now - 2 * 3600000,
            });

            // 3 days ago — counts in WAU and MAU, not DAU
            await seedEvent(db, {
                event_type: 'auth.login',
                user_id: 2,
                created_at: now - 3 * 86400000,
            });

            // 15 days ago — counts in MAU only
            await seedEvent(db, {
                event_type: 'auth.login',
                user_id: 3,
                created_at: now - 15 * 86400000,
            });

            // 40 days ago — outside all windows
            await seedEvent(db, {
                event_type: 'auth.login',
                user_id: 4,
                created_at: now - 40 * 86400000,
            });

            const result = await getActiveUserMetrics(db);
            expect(result.dau).toBe(1);
            expect(result.wau).toBe(2);
            expect(result.mau).toBe(3);
        });

        it('counts distinct users (same user multiple logins counts as 1)', async () => {
            const now = Date.now();
            await seedEvent(db, { event_type: 'auth.login', user_id: 1, created_at: now - 1000 });
            await seedEvent(db, { event_type: 'auth.login', user_id: 1, created_at: now - 2000 });

            const result = await getActiveUserMetrics(db);
            expect(result.dau).toBe(1);
        });
    });

    // ========================================================================
    // getActivityTimeSeries
    // ========================================================================

    describe('getActivityTimeSeries', () => {
        it('returns arrays with equal length labels, logins, projectsCreated', async () => {
            const result = await getActivityTimeSeries(db, 7);
            expect(result.labels.length).toBe(result.logins.length);
            expect(result.labels.length).toBe(result.projectsCreated.length);
        });

        it('fills all days in range including zero days', async () => {
            const result = await getActivityTimeSeries(db, 7);
            // 7 days + today = 8 entries minimum
            expect(result.labels.length).toBeGreaterThanOrEqual(7);
        });

        it('groups login and project.create events into separate series', async () => {
            const now = Date.now();
            const todayMs = Math.floor(now / 86400000) * 86400000;

            await seedEvent(db, {
                event_type: 'auth.login',
                user_id: 1,
                created_at: todayMs + 1000,
            });
            await seedEvent(db, {
                event_type: 'auth.login',
                user_id: 2,
                created_at: todayMs + 2000,
            });
            await seedEvent(db, {
                event_type: 'project.create',
                user_id: 1,
                created_at: todayMs + 3000,
            });

            const result = await getActivityTimeSeries(db, 1);
            const totalLogins = result.logins.reduce((s, v) => s + v, 0);
            const totalProjects = result.projectsCreated.reduce((s, v) => s + v, 0);
            expect(totalLogins).toBe(2);
            expect(totalProjects).toBe(1);
        });

        it('returns empty series with zero counts when no events', async () => {
            const result = await getActivityTimeSeries(db, 3);
            const totalLogins = result.logins.reduce((s, v) => s + v, 0);
            const totalProjects = result.projectsCreated.reduce((s, v) => s + v, 0);
            expect(totalLogins).toBe(0);
            expect(totalProjects).toBe(0);
        });
    });

    // ========================================================================
    // getPeakUsage
    // ========================================================================

    describe('getPeakUsage', () => {
        it('returns zeros/Sunday when no events exist', async () => {
            const result = await getPeakUsage(db, 30);
            expect(result.peakHourCount).toBe(0);
            expect(result.peakDayCount).toBe(0);
            expect(typeof result.peakHour).toBe('number');
            expect(typeof result.peakDay).toBe('string');
        });

        it('peakHour is in range 0-23', async () => {
            const now = Date.now();
            for (let i = 0; i < 3; i++) {
                await seedEvent(db, {
                    event_type: 'auth.login',
                    user_id: 1,
                    created_at: now - i * 3600000,
                });
            }

            const result = await getPeakUsage(db, 7);
            expect(result.peakHour).toBeGreaterThanOrEqual(0);
            expect(result.peakHour).toBeLessThanOrEqual(23);
        });

        it('peakDay is a valid day name', async () => {
            const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const now = Date.now();

            const result = await getPeakUsage(db, 7);
            expect(validDays).toContain(result.peakDay);
        });

        it('identifies correct peak hour when one hour dominates', async () => {
            // Compute the start of the current hour (UTC) to get a known hour value
            const MS_PER_HOUR = 3600000;
            const MS_PER_DAY = 86400000;
            const nowMs = Date.now();
            const currentHourBucket = Math.floor(nowMs / MS_PER_HOUR);
            const currentHour = currentHourBucket % 24;
            // Anchor to the current hour boundary so we know what hour the events fall in
            const anchorMs = currentHourBucket * MS_PER_HOUR + 1000; // 1s into current hour

            // 5 events spread across past days, all in the same hour-of-day
            for (let i = 0; i < 5; i++) {
                await seedEvent(db, {
                    event_type: 'auth.login',
                    user_id: 1,
                    created_at: anchorMs - i * MS_PER_DAY,
                });
            }

            // Pick a different hour for the competing event (use hour + 1, mod 24)
            const otherHourBucket = Math.floor((anchorMs + MS_PER_HOUR) / MS_PER_HOUR);
            const otherHourMs = otherHourBucket * MS_PER_HOUR + 1000;
            await seedEvent(db, {
                event_type: 'auth.login',
                user_id: 1,
                created_at: otherHourMs,
            });

            const result = await getPeakUsage(db, 30);
            expect(result.peakHour).toBe(currentHour);
            expect(result.peakHourCount).toBe(5);
        });
    });
});
