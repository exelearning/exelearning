import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../test/helpers/test-db';
import { countProjectActivity, insertProjectActivity } from '../db/queries/project-activity';
import {
    getProjectActivityRetentionStatus,
    isProjectActivityRetentionRunning,
    resetProjectActivityRetentionState,
    runProjectActivityRetention,
    startProjectActivityRetention,
    stopProjectActivityRetention,
} from './project-activity-retention';
import type { ProjectActivityConfig } from '../config/project-activity';

const DAY = 24 * 60 * 60 * 1000;

describe('project activity retention', () => {
    let db: Kysely<Database>;
    let projectId: number;
    let userId: number;
    let clock: number;
    let config: ProjectActivityConfig;
    const logs: string[] = [];
    const logger = { log: (m: string) => logs.push(m), error: (m: string) => logs.push(m) };

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        resetProjectActivityRetentionState();
        logs.length = 0;
        userId = await seedTestUser(db, { email: `u-${Date.now()}@test.local` });
        projectId = await seedTestProject(db, userId, { uuid: `uuid-${Date.now()}` });
        clock = 1_700_000_000_000;
        config = { retentionDays: 30, recordingEnabled: true, editorAccess: false };
    });

    afterEach(() => {
        resetProjectActivityRetentionState();
    });

    async function seedRows(ages: number[]): Promise<void> {
        for (const ageDays of ages) {
            const at = clock - ageDays * DAY;
            await insertProjectActivity(db, {
                project_id: projectId,
                user_id: userId,
                event_type: 'save.manual',
                target_type: 'project',
                target_id: null,
                target_label: null,
                details: null,
                session_id: null,
                dedupe_key: null,
                first_occurred_at: at,
                occurred_at: at,
                created_at: at,
            });
        }
    }

    it('deletes only rows older than the retention window, in bounded batches', async () => {
        await seedRows([1, 10, 29, 31, 40, 400]);
        const result = await runProjectActivityRetention({
            db,
            getConfig: () => config,
            now: () => clock,
            logger,
            batchSize: 2,
        });
        expect(result).toEqual({ skipped: false, deleted: 3, batches: 2, truncated: false });
        expect(await countProjectActivity(db, projectId)).toBe(3);
        expect(logs.some(l => l.includes('removed 3 rows'))).toBe(true);
    });

    it('stops at the batch cap and reports that more remain', async () => {
        await seedRows([31, 32, 33, 34, 35]);
        const result = await runProjectActivityRetention({
            db,
            getConfig: () => config,
            now: () => clock,
            logger,
            batchSize: 2,
            maxBatches: 2,
        });
        expect(result.deleted).toBe(4);
        expect(result.truncated).toBe(true);
        expect(await countProjectActivity(db, projectId)).toBe(1);
    });

    it('skips entirely when recording is disabled and never deletes', async () => {
        await seedRows([400]);
        config = { retentionDays: 0, recordingEnabled: false, editorAccess: false };
        const result = await runProjectActivityRetention({ db, getConfig: () => config, now: () => clock, logger });
        expect(result.skipped).toBe(true);
        expect(await countProjectActivity(db, projectId)).toBe(1);
    });

    it('reports errors without throwing', async () => {
        const result = await runProjectActivityRetention({
            db,
            getConfig: () => config,
            now: () => clock,
            logger,
            deleteProjectActivityBefore: async () => {
                throw new Error('locked');
            },
        });
        expect(result.error).toBe('locked');
        expect(result.skipped).toBe(false);
    });

    it('does not overlap concurrent runs', async () => {
        let release!: () => void;
        const gate = new Promise<void>(resolve => {
            release = resolve;
        });
        const slow = runProjectActivityRetention({
            db,
            getConfig: () => config,
            now: () => clock,
            logger,
            deleteProjectActivityBefore: async () => {
                await gate;
                return 0;
            },
        });
        const second = await runProjectActivityRetention({ db, getConfig: () => config, now: () => clock, logger });
        expect(second.skipped).toBe(true);
        release();
        const first = await slow;
        expect(first.skipped).toBe(false);
        expect(getProjectActivityRetentionStatus().inProgress).toBe(false);
    });

    it('schedules an initial run and periodic runs with injectable timers', async () => {
        await seedRows([60]);
        const intervals: Array<{ fn: () => void; ms: number }> = [];
        const timers = {
            setInterval: ((fn: () => void, ms: number) => {
                intervals.push({ fn, ms });
                return 1 as unknown as ReturnType<typeof setInterval>;
            }) as unknown as typeof setInterval,
            clearInterval: (() => {
                intervals.length = 0;
            }) as unknown as typeof clearInterval,
        };
        startProjectActivityRetention({ db, getConfig: () => config, now: () => clock, logger, timers }, 1234);
        expect(isProjectActivityRetentionRunning()).toBe(true);
        expect(intervals[0].ms).toBe(1234);
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(await countProjectActivity(db, projectId)).toBe(0);

        await seedRows([61]);
        intervals[0].fn();
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(await countProjectActivity(db, projectId)).toBe(0);
        expect(getProjectActivityRetentionStatus().lastResult?.deleted).toBe(1);

        stopProjectActivityRetention();
        expect(isProjectActivityRetentionRunning()).toBe(false);
    });

    it('does not start when recording is disabled', () => {
        config = { retentionDays: 0, recordingEnabled: false, editorAccess: false };
        startProjectActivityRetention({ db, getConfig: () => config, now: () => clock, logger });
        expect(isProjectActivityRetentionRunning()).toBe(false);
        expect(logs.some(l => l.includes('not started'))).toBe(true);
    });
});
