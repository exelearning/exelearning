/**
 * Project activity retention (issue #2689)
 *
 * Deletes activity rows whose last occurrence is older than
 * PROJECT_ACTIVITY_RETENTION_DAYS, in bounded batches, once a day. Retention
 * `0` means recording is disabled and nothing is pruned (existing rows stay
 * readable, see spec R12). Independent of the project cleanup scheduler
 * (CLEANUP_ENABLED) and of YJS_VERSION_HISTORY_LIMIT.
 *
 * Multi-instance deployments may run the job on every instance: deleting by
 * explicit id batches is idempotent, so concurrent runs are harmless.
 */
import type { Kysely } from 'kysely';
import { db as defaultDb } from '../db/client';
import type { Database } from '../db/types';
import { deleteProjectActivityBefore as deleteProjectActivityBeforeDefault } from '../db/queries/project-activity';
import {
    getProjectActivityConfig as getProjectActivityConfigDefault,
    type ProjectActivityConfig,
} from '../config/project-activity';

export const PROJECT_ACTIVITY_RETENTION_BATCH_SIZE = 1000;
/** Upper bound on batches per run so one run never monopolises the database. */
export const PROJECT_ACTIVITY_RETENTION_MAX_BATCHES = 100;
export const PROJECT_ACTIVITY_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ProjectActivityRetentionDeps {
    db: Kysely<Database>;
    deleteProjectActivityBefore: typeof deleteProjectActivityBeforeDefault;
    getConfig: () => ProjectActivityConfig;
    now: () => number;
    logger: Pick<Console, 'log' | 'error'>;
    timers: { setInterval: typeof setInterval; clearInterval: typeof clearInterval };
    batchSize: number;
    maxBatches: number;
}

export interface ProjectActivityRetentionResult {
    /** True when retention is disabled or another run was in progress. */
    skipped: boolean;
    deleted: number;
    batches: number;
    /** True when the run stopped at maxBatches with rows possibly remaining. */
    truncated: boolean;
    error?: string;
}

const defaultDeps: ProjectActivityRetentionDeps = {
    db: defaultDb,
    deleteProjectActivityBefore: deleteProjectActivityBeforeDefault,
    getConfig: () => getProjectActivityConfigDefault(),
    now: () => Date.now(),
    logger: console,
    timers: { setInterval, clearInterval },
    batchSize: PROJECT_ACTIVITY_RETENTION_BATCH_SIZE,
    maxBatches: PROJECT_ACTIVITY_RETENTION_MAX_BATCHES,
};

interface RetentionState {
    timer: ReturnType<typeof setInterval> | null;
    deps: ProjectActivityRetentionDeps;
    isRunning: boolean;
    lastResult: ProjectActivityRetentionResult | null;
}

let state: RetentionState = { timer: null, deps: defaultDeps, isRunning: false, lastResult: null };

function resolveDeps(overrides: Partial<ProjectActivityRetentionDeps>): ProjectActivityRetentionDeps {
    return { ...defaultDeps, ...overrides };
}

/**
 * Run one pruning pass. Safe to call concurrently: overlapping calls are skipped.
 */
export async function runProjectActivityRetention(
    overrides: Partial<ProjectActivityRetentionDeps> = {},
): Promise<ProjectActivityRetentionResult> {
    const deps = Object.keys(overrides).length > 0 ? resolveDeps(overrides) : state.deps;
    const config = deps.getConfig();
    if (!config.recordingEnabled || config.retentionDays <= 0) {
        return { skipped: true, deleted: 0, batches: 0, truncated: false };
    }
    if (state.isRunning) {
        deps.logger.log('[project-activity] Retention already in progress, skipping');
        return { skipped: true, deleted: 0, batches: 0, truncated: false };
    }

    state.isRunning = true;
    const result: ProjectActivityRetentionResult = { skipped: false, deleted: 0, batches: 0, truncated: false };
    try {
        const cutoff = deps.now() - config.retentionDays * MS_PER_DAY;
        for (let batch = 0; batch < deps.maxBatches; batch++) {
            const deleted = await deps.deleteProjectActivityBefore(deps.db, cutoff, deps.batchSize);
            if (deleted === 0) break;
            result.deleted += deleted;
            result.batches++;
            if (deleted < deps.batchSize) break;
            if (batch === deps.maxBatches - 1) result.truncated = true;
        }
        if (result.deleted > 0 || result.truncated) {
            deps.logger.log(
                `[project-activity] Retention removed ${result.deleted} rows older than ${config.retentionDays} days` +
                    (result.truncated ? ' (more remain for the next run)' : ''),
            );
        }
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        deps.logger.error('[project-activity] Retention failed:', error);
    } finally {
        state.isRunning = false;
        state.lastResult = result;
    }
    return result;
}

/**
 * Start the daily retention job. Does nothing when recording is disabled.
 */
export function startProjectActivityRetention(
    overrides: Partial<ProjectActivityRetentionDeps> = {},
    intervalMs: number = PROJECT_ACTIVITY_RETENTION_INTERVAL_MS,
): void {
    stopProjectActivityRetention();
    state.deps = resolveDeps(overrides);
    const config = state.deps.getConfig();
    if (!config.recordingEnabled) {
        state.deps.logger.log(
            '[project-activity] Recording disabled (PROJECT_ACTIVITY_RETENTION_DAYS=0); retention job not started',
        );
        return;
    }

    state.deps.logger.log(
        `[project-activity] Retention job started (${config.retentionDays} days, every ${Math.round(intervalMs / 3600000)}h)`,
    );
    runProjectActivityRetention().catch(error => {
        state.deps.logger.error('[project-activity] Initial retention run failed:', error);
    });
    state.timer = state.deps.timers.setInterval(() => {
        runProjectActivityRetention().catch(error => {
            state.deps.logger.error('[project-activity] Scheduled retention run failed:', error);
        });
    }, intervalMs);
}

export function stopProjectActivityRetention(): void {
    if (state.timer) {
        state.deps.timers.clearInterval(state.timer);
        state.timer = null;
    }
}

export function isProjectActivityRetentionRunning(): boolean {
    return state.timer !== null;
}

export function getProjectActivityRetentionStatus(): {
    running: boolean;
    inProgress: boolean;
    lastResult: ProjectActivityRetentionResult | null;
} {
    return { running: state.timer !== null, inProgress: state.isRunning, lastResult: state.lastResult };
}

/** Reset module state (tests). */
export function resetProjectActivityRetentionState(): void {
    stopProjectActivityRetention();
    state = { timer: null, deps: defaultDeps, isRunning: false, lastResult: null };
}
