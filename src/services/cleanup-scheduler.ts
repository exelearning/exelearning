/**
 * Cleanup Scheduler Service
 * Runs project cleanup on a schedule (daily by default)
 *
 * Cleans up:
 * - Unsaved projects (saved_once=0) older than configurable age
 * - Guest user projects older than configurable age
 *
 * Uses dependency injection pattern for testability.
 */
import { db as defaultDb } from '../db/client';
import {
    findUnsavedProjectsOlderThan,
    findGuestProjectsOlderThan,
    deleteProjectWithRelatedData,
} from '../db/queries/projects';
import { getFilesDir, remove, fileExists } from './file-helper';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import * as path from 'path';

/**
 * Configuration for the cleanup scheduler
 */
export interface CleanupSchedulerConfig {
    /** Whether the scheduler is enabled */
    enabled: boolean;
    /** Interval between cleanup runs in milliseconds (default: 24 hours) */
    intervalMs: number;
    /** Age in hours after which unsaved projects are deleted (default: 24) */
    unsavedAgeHours: number;
    /** Age in days after which guest user projects are deleted (default: 7) */
    guestAgeDays: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: CleanupSchedulerConfig = {
    enabled: false,
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    unsavedAgeHours: 24,
    guestAgeDays: 7,
};

/**
 * Query functions for cleanup
 */
export interface CleanupQueries {
    findUnsavedProjectsOlderThan: typeof findUnsavedProjectsOlderThan;
    findGuestProjectsOlderThan: typeof findGuestProjectsOlderThan;
    deleteProjectWithRelatedData: typeof deleteProjectWithRelatedData;
}

/**
 * File helper functions for cleanup
 */
export interface CleanupFileHelper {
    getFilesDir: typeof getFilesDir;
    remove: typeof remove;
    fileExists: typeof fileExists;
}

/**
 * Dependencies for cleanup scheduler
 */
export interface CleanupSchedulerDeps {
    db: Kysely<Database>;
    queries: CleanupQueries;
    fileHelper: CleanupFileHelper;
    runCleanup?: (deps: CleanupSchedulerDeps, config: CleanupSchedulerConfig) => Promise<CleanupResult>;
    /** Custom timer functions for testing */
    timers?: {
        setInterval: typeof setInterval;
        clearInterval: typeof clearInterval;
    };
}

/**
 * Default dependencies
 */
const defaultDeps: CleanupSchedulerDeps = {
    db: defaultDb,
    queries: {
        findUnsavedProjectsOlderThan,
        findGuestProjectsOlderThan,
        deleteProjectWithRelatedData,
    },
    fileHelper: {
        getFilesDir,
        remove,
        fileExists,
    },
};

/**
 * Result of a cleanup run
 */
export interface CleanupResult {
    success: boolean;
    unsavedDeleted: number;
    guestDeleted: number;
    diskCleaned: number;
    errors: string[];
}

/**
 * Cleanup scheduler state
 */
interface SchedulerState {
    timer: ReturnType<typeof setInterval> | null;
    config: CleanupSchedulerConfig;
    deps: CleanupSchedulerDeps;
    lastRun: Date | null;
    isRunning: boolean;
}

// Singleton state
let state: SchedulerState = {
    timer: null,
    config: DEFAULT_CONFIG,
    deps: defaultDeps,
    lastRun: null,
    isRunning: false,
};

/**
 * Clean up project assets from disk
 */
async function cleanupProjectAssets(
    projectUuid: string,
    fileHelper: CleanupFileHelper,
): Promise<{ cleaned: boolean; error?: string }> {
    const assetsDir = path.join(fileHelper.getFilesDir(), 'assets', projectUuid);

    try {
        const exists = await fileHelper.fileExists(assetsDir);
        if (!exists) {
            return { cleaned: false };
        }
        await fileHelper.remove(assetsDir);
        return { cleaned: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { cleaned: false, error: `${assetsDir}: ${message}` };
    }
}

/**
 * Run cleanup task
 */
export async function runCleanup(
    deps: CleanupSchedulerDeps = state.deps,
    config: CleanupSchedulerConfig = state.config,
): Promise<CleanupResult> {
    if (state.isRunning) {
        console.log('[CleanupScheduler] Cleanup already in progress, skipping');
        return { success: true, unsavedDeleted: 0, guestDeleted: 0, diskCleaned: 0, errors: [] };
    }

    state.isRunning = true;
    const startTime = Date.now();
    console.log('[CleanupScheduler] Starting cleanup...');

    const result: CleanupResult = {
        success: true,
        unsavedDeleted: 0,
        guestDeleted: 0,
        diskCleaned: 0,
        errors: [],
    };

    try {
        const unsavedAgeMs = config.unsavedAgeHours * 60 * 60 * 1000;
        const guestAgeMs = config.guestAgeDays * 24 * 60 * 60 * 1000;

        // Find projects to delete
        const unsavedProjects = await deps.queries.findUnsavedProjectsOlderThan(deps.db, unsavedAgeMs);
        const guestProjects = await deps.queries.findGuestProjectsOlderThan(deps.db, guestAgeMs);

        // Deduplicate (guest project might also be unsaved)
        const unsavedIds = new Set(unsavedProjects.map(p => p.id));
        const uniqueGuestProjects = guestProjects.filter(p => !unsavedIds.has(p.id));

        console.log(
            `[CleanupScheduler] Found ${unsavedProjects.length} unsaved and ${uniqueGuestProjects.length} guest projects to delete`,
        );

        // Delete unsaved projects
        for (const project of unsavedProjects) {
            try {
                await deps.queries.deleteProjectWithRelatedData(deps.db, project.id);
                result.unsavedDeleted++;

                const assetResult = await cleanupProjectAssets(project.uuid, deps.fileHelper);
                if (assetResult.cleaned) {
                    result.diskCleaned++;
                } else if (assetResult.error) {
                    result.errors.push(assetResult.error);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                result.errors.push(`Failed to delete project ${project.uuid}: ${message}`);
            }
        }

        // Delete guest projects
        for (const project of uniqueGuestProjects) {
            try {
                await deps.queries.deleteProjectWithRelatedData(deps.db, project.id);
                result.guestDeleted++;

                const assetResult = await cleanupProjectAssets(project.uuid, deps.fileHelper);
                if (assetResult.cleaned) {
                    result.diskCleaned++;
                } else if (assetResult.error) {
                    result.errors.push(assetResult.error);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                result.errors.push(`Failed to delete guest project ${project.uuid}: ${message}`);
            }
        }

        if (result.errors.length > 0) {
            result.success = false;
        }

        state.lastRun = new Date();
        const elapsed = Date.now() - startTime;
        console.log(
            `[CleanupScheduler] Cleanup completed in ${elapsed}ms: ` +
                `${result.unsavedDeleted} unsaved, ${result.guestDeleted} guest deleted, ` +
                `${result.diskCleaned} asset dirs cleaned` +
                (result.errors.length ? `, ${result.errors.length} errors` : ''),
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.success = false;
        result.errors.push(`Cleanup failed: ${message}`);
        console.error('[CleanupScheduler] Cleanup failed:', err);
    } finally {
        state.isRunning = false;
    }

    return result;
}

/**
 * Start the cleanup scheduler
 */
export function startScheduler(
    config: Partial<CleanupSchedulerConfig> = {},
    deps: Partial<CleanupSchedulerDeps> = {},
): void {
    // Stop existing scheduler if running
    stopScheduler();

    state.config = { ...DEFAULT_CONFIG, ...config };
    state.deps = { ...defaultDeps, ...deps };

    if (!state.config.enabled) {
        console.log('[CleanupScheduler] Scheduler is disabled');
        return;
    }

    const timers = state.deps.timers || { setInterval, clearInterval };
    const cleanupRunner = state.deps.runCleanup || runCleanup;

    console.log(
        `[CleanupScheduler] Starting scheduler with interval ${state.config.intervalMs}ms ` +
            `(unsaved: ${state.config.unsavedAgeHours}h, guest: ${state.config.guestAgeDays}d)`,
    );

    // Run immediately on startup
    cleanupRunner(state.deps, state.config).catch(err => {
        console.error('[CleanupScheduler] Initial cleanup failed:', err);
    });

    // Schedule periodic runs
    state.timer = timers.setInterval(() => {
        cleanupRunner(state.deps, state.config).catch(err => {
            console.error('[CleanupScheduler] Scheduled cleanup failed:', err);
        });
    }, state.config.intervalMs);

    console.log('[CleanupScheduler] Scheduler started');
}

/**
 * Stop the cleanup scheduler
 */
export function stopScheduler(): void {
    if (state.timer) {
        const timers = state.deps.timers || { setInterval, clearInterval };
        timers.clearInterval(state.timer);
        state.timer = null;
        console.log('[CleanupScheduler] Scheduler stopped');
    }
}

/**
 * Check if the scheduler is running
 */
export function isSchedulerRunning(): boolean {
    return state.timer !== null;
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
    running: boolean;
    config: CleanupSchedulerConfig;
    lastRun: Date | null;
    isCleanupInProgress: boolean;
} {
    return {
        running: state.timer !== null,
        config: { ...state.config },
        lastRun: state.lastRun,
        isCleanupInProgress: state.isRunning,
    };
}

/**
 * Reset scheduler state (for testing)
 */
export function resetSchedulerState(): void {
    stopScheduler();
    state = {
        timer: null,
        config: DEFAULT_CONFIG,
        deps: defaultDeps,
        lastRun: null,
        isRunning: false,
    };
}

/**
 * Get configuration from environment variables
 */
export function getConfigFromEnv(): Partial<CleanupSchedulerConfig> {
    return {
        enabled: process.env.CLEANUP_ENABLED === 'true',
        intervalMs: process.env.CLEANUP_INTERVAL_HOURS
            ? Number(process.env.CLEANUP_INTERVAL_HOURS) * 60 * 60 * 1000
            : undefined,
        unsavedAgeHours: process.env.CLEANUP_UNSAVED_AGE_HOURS
            ? Number(process.env.CLEANUP_UNSAVED_AGE_HOURS)
            : undefined,
        guestAgeDays: process.env.CLEANUP_GUEST_AGE_DAYS ? Number(process.env.CLEANUP_GUEST_AGE_DAYS) : undefined,
    };
}
