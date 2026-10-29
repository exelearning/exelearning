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
import { getSettingBoolean, getSettingNumber } from './app-settings';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { getProjectAssetsDirCandidates } from '../utils/asset-paths';

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
 * Accepted range for each configurable value. Shared with the admin API so the
 * UI, the API validation and the scheduler agree on what is a sane value.
 */
export const CLEANUP_LIMITS = {
    intervalHours: { min: 1, max: 8760 },
    unsavedAgeHours: { min: 1, max: 8760 },
    guestAgeDays: { min: 1, max: 3650 },
} as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Database/admin setting keys, which mirror the environment variable names. */
export const CLEANUP_SETTING_KEYS = {
    enabled: 'CLEANUP_ENABLED',
    intervalHours: 'CLEANUP_INTERVAL_HOURS',
    unsavedAgeHours: 'CLEANUP_UNSAVED_AGE_HOURS',
    guestAgeDays: 'CLEANUP_GUEST_AGE_DAYS',
} as const;

function pickNumber(value: unknown, fallback: number, limits: { min: number; max: number }): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= limits.min && value <= limits.max
        ? value
        : fallback;
}

/**
 * Complete a partial configuration with the defaults, ignoring missing or
 * out-of-range values (#2670: an unset `CLEANUP_*` variable used to override
 * the default with `undefined`, which produced a `setInterval` without delay
 * and a `NaN` age cutoff).
 */
export function normalizeConfig(config: Partial<CleanupSchedulerConfig> = {}): CleanupSchedulerConfig {
    return {
        enabled: typeof config.enabled === 'boolean' ? config.enabled : DEFAULT_CONFIG.enabled,
        // Any positive delay is accepted here (tests drive the timer with a few
        // seconds); /admin validates whole hours against CLEANUP_LIMITS.
        intervalMs: pickNumber(config.intervalMs, DEFAULT_CONFIG.intervalMs, {
            min: 1,
            max: CLEANUP_LIMITS.intervalHours.max * HOUR_MS,
        }),
        unsavedAgeHours: pickNumber(
            config.unsavedAgeHours,
            DEFAULT_CONFIG.unsavedAgeHours,
            CLEANUP_LIMITS.unsavedAgeHours,
        ),
        guestAgeDays: pickNumber(config.guestAgeDays, DEFAULT_CONFIG.guestAgeDays, CLEANUP_LIMITS.guestAgeDays),
    };
}

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
    // Remove both the sharded directory and the legacy unsharded directory,
    // so projects created before the sharding migration are fully cleaned up.
    // Candidate computation can reject an unsafe project uuid; report that as
    // a cleanup error instead of letting it abort the caller's loop.
    let candidates: string[];
    try {
        candidates = getProjectAssetsDirCandidates(fileHelper.getFilesDir(), projectUuid);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { cleaned: false, error: `${projectUuid}: ${message}` };
    }
    let cleaned = false;
    const errors: string[] = [];

    for (const assetsDir of candidates) {
        try {
            const exists = await fileHelper.fileExists(assetsDir);
            if (!exists) {
                continue;
            }
            await fileHelper.remove(assetsDir);
            cleaned = true;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`${assetsDir}: ${message}`);
        }
    }

    return { cleaned, error: errors.length > 0 ? errors.join('; ') : undefined };
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
                }
                // A partial failure (e.g. sharded dir removed, legacy dir
                // locked) reports both cleaned=true AND an error.
                if (assetResult.error) {
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
                }
                // A partial failure (e.g. sharded dir removed, legacy dir
                // locked) reports both cleaned=true AND an error.
                if (assetResult.error) {
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

    state.config = normalizeConfig(config);
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

/**
 * Read-only count of the projects the next run would delete.
 *
 * Uses the very same queries and deduplication as `runCleanup()`, so the number
 * matches what a run right now would remove. It deletes nothing.
 */
export interface CleanupPreview {
    unsaved: number;
    guest: number;
    total: number;
}

export async function previewCleanup(
    deps: CleanupSchedulerDeps = state.deps,
    config: CleanupSchedulerConfig = state.config,
): Promise<CleanupPreview> {
    const unsavedProjects = await deps.queries.findUnsavedProjectsOlderThan(deps.db, config.unsavedAgeHours * HOUR_MS);
    const guestProjects = await deps.queries.findGuestProjectsOlderThan(deps.db, config.guestAgeDays * DAY_MS);

    // A guest project can also be unsaved: count it once, as runCleanup does.
    const unsavedIds = new Set(unsavedProjects.map(p => p.id));
    const uniqueGuestProjects = guestProjects.filter(p => !unsavedIds.has(p.id));

    return {
        unsaved: unsavedProjects.length,
        guest: uniqueGuestProjects.length,
        total: unsavedProjects.length + uniqueGuestProjects.length,
    };
}

/**
 * Effective configuration: `app_settings` (set from /admin) takes precedence,
 * the `CLEANUP_*` environment variables are the fallback, and `DEFAULT_CONFIG`
 * applies when neither is configured.
 */
export async function getEffectiveConfig(db: Kysely<Database> = defaultDb): Promise<CleanupSchedulerConfig> {
    const fromEnv = normalizeConfig(getConfigFromEnv());

    const [enabled, intervalHours, unsavedAgeHours, guestAgeDays] = await Promise.all([
        getSettingBoolean(db, CLEANUP_SETTING_KEYS.enabled, fromEnv.enabled),
        getSettingNumber(db, CLEANUP_SETTING_KEYS.intervalHours, fromEnv.intervalMs / HOUR_MS),
        getSettingNumber(db, CLEANUP_SETTING_KEYS.unsavedAgeHours, fromEnv.unsavedAgeHours),
        getSettingNumber(db, CLEANUP_SETTING_KEYS.guestAgeDays, fromEnv.guestAgeDays),
    ]);

    return normalizeConfig({ enabled, intervalMs: intervalHours * HOUR_MS, unsavedAgeHours, guestAgeDays });
}

/**
 * Start, stop or re-schedule the singleton scheduler from the effective
 * configuration. Called at boot and again whenever an administrator saves the
 * cleanup settings, so changes apply without restarting the application.
 * `startScheduler()` clears the previous timer first, so no duplicate timers.
 */
export async function applyPersistedConfig(
    db: Kysely<Database> = defaultDb,
    deps: Partial<CleanupSchedulerDeps> = {},
): Promise<CleanupSchedulerConfig> {
    const config = await getEffectiveConfig(db);
    startScheduler(config, deps);
    return config;
}

/**
 * Read-only preview for the effective (persisted) configuration.
 */
export async function previewPersistedCleanup(
    db: Kysely<Database> = defaultDb,
    deps: Partial<CleanupSchedulerDeps> = {},
): Promise<CleanupPreview & { config: CleanupSchedulerConfig }> {
    const config = await getEffectiveConfig(db);
    const preview = await previewCleanup({ ...defaultDeps, db, ...deps }, config);
    return { ...preview, config };
}
