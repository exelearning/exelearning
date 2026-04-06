/**
 * Admin Analytics Queries - Kysely ORM
 * Type-safe queries for admin dashboard analytics
 * All functions accept db as first parameter for dependency injection
 */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../types';

const MS_PER_DAY = 86400000;
const MS_PER_HOUR = 3600000;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ============================================================================
// DAU / WAU / MAU
// ============================================================================

/**
 * Get DAU/WAU/MAU counts.
 * DAU = unique actors with auth.login in last 24h
 * WAU = unique actors with auth.login in last 7 days
 * MAU = unique actors with auth.login in last 30 days
 */
export async function getActiveUserMetrics(db: Kysely<Database>): Promise<{ dau: number; wau: number; mau: number }> {
    const now = Date.now();
    const h24 = now - MS_PER_DAY;
    const d7 = now - 7 * MS_PER_DAY;
    const d30 = now - 30 * MS_PER_DAY;

    const [dauRow, wauRow, mauRow] = await Promise.all([
        db
            .selectFrom('activity_log')
            .select(sql<number>`count(distinct user_id)`.as('count'))
            .where('event_type', '=', 'auth.login')
            .where('created_at', '>=', h24)
            .where('user_id', 'is not', null)
            .executeTakeFirst(),
        db
            .selectFrom('activity_log')
            .select(sql<number>`count(distinct user_id)`.as('count'))
            .where('event_type', '=', 'auth.login')
            .where('created_at', '>=', d7)
            .where('user_id', 'is not', null)
            .executeTakeFirst(),
        db
            .selectFrom('activity_log')
            .select(sql<number>`count(distinct user_id)`.as('count'))
            .where('event_type', '=', 'auth.login')
            .where('created_at', '>=', d30)
            .where('user_id', 'is not', null)
            .executeTakeFirst(),
    ]);

    return {
        dau: Number(dauRow?.count ?? 0),
        wau: Number(wauRow?.count ?? 0),
        mau: Number(mauRow?.count ?? 0),
    };
}

// ============================================================================
// ACTIVITY TIME-SERIES
// ============================================================================

/**
 * Get activity time-series for charts.
 * Groups activity_log by date, returns login count and project creation count per day.
 */
export async function getActivityTimeSeries(
    db: Kysely<Database>,
    days: number = 30,
): Promise<{ labels: string[]; logins: number[]; projectsCreated: number[] }> {
    const startMs = Date.now() - days * MS_PER_DAY;

    const rows = await db
        .selectFrom('activity_log')
        .select([
            sql<number>`cast(created_at / ${sql.lit(MS_PER_DAY)} as integer)`.as('day_bucket'),
            'event_type',
            sql<number>`count(id)`.as('count'),
        ])
        .where('event_type', 'in', ['auth.login', 'project.create'])
        .where('created_at', '>=', startMs)
        .groupBy([sql`cast(created_at / ${sql.lit(MS_PER_DAY)} as integer)`, 'event_type'])
        .orderBy(sql`cast(created_at / ${sql.lit(MS_PER_DAY)} as integer)`, 'asc')
        .execute();

    // Build a map: day_bucket -> { logins, projectsCreated }
    const dayMap = new Map<number, { logins: number; projectsCreated: number }>();

    for (const row of rows) {
        const bucket = Number(row.day_bucket);
        if (!dayMap.has(bucket)) {
            dayMap.set(bucket, { logins: 0, projectsCreated: 0 });
        }
        const entry = dayMap.get(bucket)!;
        const count = Number(row.count);
        if (row.event_type === 'auth.login') {
            entry.logins += count;
        } else if (row.event_type === 'project.create') {
            entry.projectsCreated += count;
        }
    }

    // Fill in all days in the range (including zeros)
    const nowBucket = Math.floor(Date.now() / MS_PER_DAY);
    const startBucket = Math.floor(startMs / MS_PER_DAY);

    const labels: string[] = [];
    const logins: number[] = [];
    const projectsCreated: number[] = [];

    for (let bucket = startBucket; bucket <= nowBucket; bucket++) {
        const date = new Date(bucket * MS_PER_DAY).toISOString().slice(0, 10);
        const entry = dayMap.get(bucket) ?? { logins: 0, projectsCreated: 0 };
        labels.push(date);
        logins.push(entry.logins);
        projectsCreated.push(entry.projectsCreated);
    }

    return { labels, logins, projectsCreated };
}

// ============================================================================
// PEAK USAGE DETECTION
// ============================================================================

/**
 * Peak detection: find the hour and day with highest activity.
 */
export async function getPeakUsage(
    db: Kysely<Database>,
    days: number = 30,
): Promise<{
    peakHour: number;
    peakDay: string;
    peakHourCount: number;
    peakDayCount: number;
}> {
    const startMs = Date.now() - days * MS_PER_DAY;

    // Group by hour-of-day (0-23): use modulo on the hour bucket
    const hourRows = await db
        .selectFrom('activity_log')
        .select([
            sql<number>`cast((created_at / ${sql.lit(MS_PER_HOUR)}) % 24 as integer)`.as('hour'),
            sql<number>`count(id)`.as('count'),
        ])
        .where('event_type', '=', 'auth.login')
        .where('created_at', '>=', startMs)
        .groupBy(sql`cast((created_at / ${sql.lit(MS_PER_HOUR)}) % 24 as integer)`)
        .orderBy('count', 'desc')
        .execute();

    // Group by day-of-week (0=Sun..6=Sat): use modulo 7 on the day bucket
    // Unix epoch (Jan 1 1970) was a Thursday → offset = 4
    const DOW_OFFSET = 4;
    const dayRows = await db
        .selectFrom('activity_log')
        .select([
            sql<number>`cast((created_at / ${sql.lit(MS_PER_DAY)} + ${sql.lit(DOW_OFFSET)}) % 7 as integer)`.as('dow'),
            sql<number>`count(id)`.as('count'),
        ])
        .where('event_type', '=', 'auth.login')
        .where('created_at', '>=', startMs)
        .groupBy(sql`cast((created_at / ${sql.lit(MS_PER_DAY)} + ${sql.lit(DOW_OFFSET)}) % 7 as integer)`)
        .orderBy('count', 'desc')
        .execute();

    const peakHour = hourRows.length > 0 ? Number(hourRows[0].hour) : 0;
    const peakHourCount = hourRows.length > 0 ? Number(hourRows[0].count) : 0;
    const peakDow = dayRows.length > 0 ? Number(dayRows[0].dow) : 0;
    const peakDayCount = dayRows.length > 0 ? Number(dayRows[0].count) : 0;

    return {
        peakHour,
        peakDay: DAY_NAMES[peakDow] ?? 'Sunday',
        peakHourCount,
        peakDayCount,
    };
}
