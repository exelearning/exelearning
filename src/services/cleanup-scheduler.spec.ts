/**
 * Tests for Cleanup Scheduler Service
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
    runCleanup,
    startScheduler,
    stopScheduler,
    isSchedulerRunning,
    getSchedulerStatus,
    resetSchedulerState,
    getConfigFromEnv,
    getEffectiveConfig,
    applyPersistedConfig,
    previewCleanup,
    previewPersistedCleanup,
    normalizeConfig,
    DEFAULT_CONFIG,
    CLEANUP_LIMITS,
    type CleanupSchedulerDeps,
} from './cleanup-scheduler';
import type { Kysely } from 'kysely';
import type { Database, Project } from '../db/types';
import { getAssetShard } from '../utils/asset-paths';

describe('Cleanup Scheduler', () => {
    // Helper to create mock projects
    const createMockProject = (overrides: Partial<Project> = {}): Project => ({
        id: 1,
        uuid: 'test-uuid-1',
        title: 'Test Project',
        description: null,
        owner_id: 1,
        status: 'active',
        visibility: 'private',
        language: 'en',
        author: null,
        license: null,
        last_accessed_at: null,
        saved_once: 0,
        created_at: Date.now() - 48 * 60 * 60 * 1000,
        updated_at: Date.now() - 48 * 60 * 60 * 1000,
        platform_id: null,
        ...overrides,
    });

    // Mock file helper
    const createMockFileHelper = (
        options: { filesDir?: string; existingPaths?: Set<string>; removeErrors?: Map<string, Error> } = {},
    ) => {
        const { filesDir = '/tmp/test', existingPaths = new Set(), removeErrors = new Map() } = options;
        const removedPaths: string[] = [];

        return {
            getFilesDir: () => filesDir,
            remove: async (targetPath: string) => {
                if (removeErrors.has(targetPath)) {
                    throw removeErrors.get(targetPath);
                }
                removedPaths.push(targetPath);
            },
            fileExists: async (targetPath: string) => existingPaths.has(targetPath),
            _removedPaths: removedPaths,
        };
    };

    // Mock queries
    const createMockQueries = (options: { unsavedProjects?: Project[]; guestProjects?: Project[] } = {}) => {
        const { unsavedProjects = [], guestProjects = [] } = options;
        const deletedProjectIds: number[] = [];

        return {
            findUnsavedProjectsOlderThan: async () => unsavedProjects,
            findGuestProjectsOlderThan: async () => guestProjects,
            deleteProjectWithRelatedData: async (_db: Kysely<Database>, projectId: number) => {
                deletedProjectIds.push(projectId);
            },
            _deletedProjectIds: deletedProjectIds,
        };
    };

    // Mock timers
    const createMockTimers = () => {
        const intervals: { id: number; callback: () => void; interval: number }[] = [];
        let nextId = 1;

        return {
            setInterval: (callback: () => void, interval: number) => {
                const id = nextId++;
                intervals.push({ id, callback, interval });
                return id as unknown as ReturnType<typeof setInterval>;
            },
            clearInterval: (id: ReturnType<typeof setInterval>) => {
                const index = intervals.findIndex(i => i.id === (id as unknown as number));
                if (index >= 0) {
                    intervals.splice(index, 1);
                }
            },
            _intervals: intervals,
            triggerInterval: (id: number) => {
                const interval = intervals.find(i => i.id === id);
                if (interval) {
                    interval.callback();
                }
            },
        };
    };

    beforeEach(() => {
        resetSchedulerState();
    });

    afterEach(() => {
        resetSchedulerState();
    });

    describe('runCleanup', () => {
        it('should delete unsaved projects', async () => {
            const unsavedProjects = [
                createMockProject({ id: 1, uuid: 'uuid-1' }),
                createMockProject({ id: 2, uuid: 'uuid-2' }),
            ];
            const queries = createMockQueries({ unsavedProjects });

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper: createMockFileHelper(),
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            expect(result.success).toBe(true);
            expect(result.unsavedDeleted).toBe(2);
            expect(queries._deletedProjectIds).toContain(1);
            expect(queries._deletedProjectIds).toContain(2);
        });

        it('should delete guest projects', async () => {
            const guestProjects = [
                createMockProject({ id: 1, uuid: 'guest-uuid-1' }),
                createMockProject({ id: 2, uuid: 'guest-uuid-2' }),
            ];
            const queries = createMockQueries({ guestProjects });

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper: createMockFileHelper(),
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            expect(result.success).toBe(true);
            expect(result.guestDeleted).toBe(2);
        });

        it('should deduplicate projects that are both unsaved and guest', async () => {
            const sharedProject = createMockProject({ id: 1, uuid: 'shared-uuid' });
            const queries = createMockQueries({
                unsavedProjects: [sharedProject],
                guestProjects: [sharedProject],
            });

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper: createMockFileHelper(),
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            expect(result.success).toBe(true);
            expect(result.unsavedDeleted).toBe(1);
            expect(result.guestDeleted).toBe(0);
            expect(queries._deletedProjectIds).toEqual([1]);
        });

        it('should clean up asset directories', async () => {
            const unsavedProjects = [createMockProject({ id: 1, uuid: 'uuid-1' })];
            const existingPaths = new Set(['/data/assets/uuid-1']);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths });
            const queries = createMockQueries({ unsavedProjects });

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper,
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            expect(result.success).toBe(true);
            expect(result.diskCleaned).toBe(1);
            expect(fileHelper._removedPaths).toContain('/data/assets/uuid-1');
        });

        it('should clean up sharded asset directories', async () => {
            const shard = getAssetShard('uuid-1');
            const unsavedProjects = [createMockProject({ id: 1, uuid: 'uuid-1' })];
            const existingPaths = new Set([`/data/assets/${shard}/uuid-1`]);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths });
            const queries = createMockQueries({ unsavedProjects });

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper,
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            expect(result.success).toBe(true);
            expect(result.diskCleaned).toBe(1);
            expect(fileHelper._removedPaths).toContain(`/data/assets/${shard}/uuid-1`);
        });

        it('should clean up both sharded and legacy asset directories when both exist', async () => {
            const shard = getAssetShard('uuid-1');
            const unsavedProjects = [createMockProject({ id: 1, uuid: 'uuid-1' })];
            const existingPaths = new Set([`/data/assets/${shard}/uuid-1`, '/data/assets/uuid-1']);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths });
            const queries = createMockQueries({ unsavedProjects });

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper,
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            expect(result.success).toBe(true);
            expect(result.diskCleaned).toBe(1);
            expect(fileHelper._removedPaths).toContain(`/data/assets/${shard}/uuid-1`);
            expect(fileHelper._removedPaths).toContain('/data/assets/uuid-1');
        });

        it('should surface a legacy-directory removal error even when the sharded directory was removed', async () => {
            const shard = getAssetShard('uuid-1');
            const unsavedProjects = [createMockProject({ id: 1, uuid: 'uuid-1' })];
            const existingPaths = new Set([`/data/assets/${shard}/uuid-1`, '/data/assets/uuid-1']);
            const removeErrors = new Map([['/data/assets/uuid-1', new Error('EBUSY: locked')]]);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths, removeErrors });
            const queries = createMockQueries({ unsavedProjects });

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper,
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            // The sharded dir was removed, but the failure must not be swallowed.
            expect(result.diskCleaned).toBe(1);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('EBUSY');
            expect(result.success).toBe(false);
        });

        it('should report (not throw on) a project uuid that cannot form a safe directory path', async () => {
            const unsavedProjects = [
                createMockProject({ id: 1, uuid: '../evil' }),
                createMockProject({ id: 2, uuid: 'uuid-2' }),
            ];
            const shard2 = getAssetShard('uuid-2');
            const existingPaths = new Set([`/data/assets/${shard2}/uuid-2`]);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths });
            const queries = createMockQueries({ unsavedProjects });

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper,
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            // Both projects are deleted from the DB; the bad uuid is reported
            // as an asset-cleanup error and the second project is still cleaned.
            expect(result.unsavedDeleted).toBe(2);
            expect(result.diskCleaned).toBe(1);
            expect(result.errors.length).toBe(1);
        });

        it('should handle disk errors gracefully', async () => {
            const unsavedProjects = [createMockProject({ id: 1, uuid: 'uuid-1' })];
            const existingPaths = new Set(['/data/assets/uuid-1']);
            const removeErrors = new Map([['/data/assets/uuid-1', new Error('Permission denied')]]);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths, removeErrors });
            const queries = createMockQueries({ unsavedProjects });

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper,
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            // Project should still be deleted from DB even if disk cleanup fails
            expect(result.unsavedDeleted).toBe(1);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('Permission denied');
            expect(result.success).toBe(false);
        });

        it('should record errors when unsaved project deletion fails', async () => {
            const unsavedProjects = [createMockProject({ id: 10, uuid: 'unsaved-delete-fail' })];
            const queries = {
                findUnsavedProjectsOlderThan: async () => unsavedProjects,
                findGuestProjectsOlderThan: async () => [],
                deleteProjectWithRelatedData: async () => {
                    throw new Error('Delete failed');
                },
            };

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper: createMockFileHelper(),
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            expect(result.unsavedDeleted).toBe(0);
            expect(result.success).toBe(false);
            expect(result.errors[0]).toContain('Failed to delete project unsaved-delete-fail');
        });

        it('should handle guest project asset cleanup results', async () => {
            const guestProjects = [
                createMockProject({ id: 21, uuid: 'guest-clean-1' }),
                createMockProject({ id: 22, uuid: 'guest-clean-2' }),
            ];
            const existingPaths = new Set(['/data/assets/guest-clean-1', '/data/assets/guest-clean-2']);
            const removeErrors = new Map([['/data/assets/guest-clean-2', new Error('Permission denied')]]);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths, removeErrors });
            const queries = createMockQueries({ guestProjects });

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper,
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            expect(result.guestDeleted).toBe(2);
            expect(result.diskCleaned).toBe(1);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('Permission denied');
        });

        it('should record errors when guest project deletion fails', async () => {
            const guestProjects = [createMockProject({ id: 30, uuid: 'guest-delete-fail' })];
            const queries = {
                findUnsavedProjectsOlderThan: async () => [],
                findGuestProjectsOlderThan: async () => guestProjects,
                deleteProjectWithRelatedData: async () => {
                    throw new Error('Delete failed');
                },
            };

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper: createMockFileHelper(),
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            expect(result.guestDeleted).toBe(0);
            expect(result.success).toBe(false);
            expect(result.errors[0]).toContain('Failed to delete guest project guest-delete-fail');
        });

        it('should handle database errors gracefully', async () => {
            const queries = {
                findUnsavedProjectsOlderThan: async () => {
                    throw new Error('Database connection failed');
                },
                findGuestProjectsOlderThan: async () => [],
                deleteProjectWithRelatedData: async () => {},
            };

            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper: createMockFileHelper(),
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('Database connection failed');
        });

        it('should return success for empty project lists', async () => {
            const deps: CleanupSchedulerDeps = {
                db: {} as Kysely<Database>,
                queries: createMockQueries(),
                fileHelper: createMockFileHelper(),
            };

            const result = await runCleanup(deps, DEFAULT_CONFIG);

            expect(result.success).toBe(true);
            expect(result.unsavedDeleted).toBe(0);
            expect(result.guestDeleted).toBe(0);
        });
    });

    describe('startScheduler', () => {
        it('should not start if disabled', () => {
            const mockTimers = createMockTimers();

            startScheduler(
                { enabled: false },
                {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                },
            );

            expect(isSchedulerRunning()).toBe(false);
            expect(mockTimers._intervals.length).toBe(0);
        });

        it('should start if enabled', () => {
            const mockTimers = createMockTimers();

            startScheduler(
                { enabled: true, intervalMs: 60000 },
                {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                },
            );

            expect(isSchedulerRunning()).toBe(true);
            expect(mockTimers._intervals.length).toBe(1);
            expect(mockTimers._intervals[0].interval).toBe(60000);
        });

        // #2670: setInterval takes a 32-bit signed delay. Bun clamps anything
        // larger to 1 ms, which turns the scheduler into a tight loop.
        it('never schedules a delay a 32-bit timer cannot hold', () => {
            const mockTimers = createMockTimers();

            startScheduler(
                { enabled: true, intervalMs: CLEANUP_LIMITS.intervalHours.max * 60 * 60 * 1000 },
                {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                },
            );

            expect(mockTimers._intervals[0].interval).toBeLessThanOrEqual(2 ** 31 - 1);
        });

        it('falls back to the default interval when asked for more than the maximum', () => {
            const overTheMax = (CLEANUP_LIMITS.intervalHours.max + 1) * 60 * 60 * 1000;
            expect(normalizeConfig({ intervalMs: overTheMax }).intervalMs).toBe(DEFAULT_CONFIG.intervalMs);
        });

        it('sweeps at once when cleanup is turned on', () => {
            const mockTimers = createMockTimers();
            const runCleanupMock = mock(async () => ({
                success: true,
                unsavedDeleted: 0,
                guestDeleted: 0,
                diskCleaned: 0,
                errors: [],
            }));

            startScheduler(
                { enabled: true, intervalMs: 60000 },
                {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                    runCleanup: runCleanupMock,
                },
            );

            expect(runCleanupMock).toHaveBeenCalledTimes(1);
        });

        // Saving the settings re-schedules the timer. Deleting projects on
        // every click of Save would be a destructive surprise.
        it('does not sweep again when it is re-scheduled while already enabled', () => {
            const mockTimers = createMockTimers();
            const runCleanupMock = mock(async () => ({
                success: true,
                unsavedDeleted: 0,
                guestDeleted: 0,
                diskCleaned: 0,
                errors: [],
            }));
            const deps = {
                db: {} as Kysely<Database>,
                queries: createMockQueries(),
                fileHelper: createMockFileHelper(),
                timers: mockTimers,
                runCleanup: runCleanupMock,
            };

            startScheduler({ enabled: true, intervalMs: 60000 }, deps);
            startScheduler({ enabled: true, intervalMs: 120000 }, deps);

            expect(runCleanupMock).toHaveBeenCalledTimes(1);
            expect(mockTimers._intervals.length).toBe(1);
        });

        it('sweeps again after cleanup is turned off and back on', () => {
            const mockTimers = createMockTimers();
            const runCleanupMock = mock(async () => ({
                success: true,
                unsavedDeleted: 0,
                guestDeleted: 0,
                diskCleaned: 0,
                errors: [],
            }));
            const deps = {
                db: {} as Kysely<Database>,
                queries: createMockQueries(),
                fileHelper: createMockFileHelper(),
                timers: mockTimers,
                runCleanup: runCleanupMock,
            };

            startScheduler({ enabled: true, intervalMs: 60000 }, deps);
            startScheduler({ enabled: false }, deps);
            startScheduler({ enabled: true, intervalMs: 60000 }, deps);

            expect(runCleanupMock).toHaveBeenCalledTimes(2);
        });

        it('should catch errors from initial and scheduled cleanup runs', async () => {
            const mockTimers = createMockTimers();
            const runCleanupMock = mock(async () => {
                throw new Error('Cleanup failed');
            });

            startScheduler(
                { enabled: true, intervalMs: 1000 },
                {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                    runCleanup: runCleanupMock,
                },
            );

            await new Promise(resolve => setTimeout(resolve, 0));

            const intervalId = mockTimers._intervals[0]?.id;
            if (intervalId) {
                mockTimers.triggerInterval(intervalId);
            }

            await new Promise(resolve => setTimeout(resolve, 0));

            expect(runCleanupMock).toHaveBeenCalledTimes(2);
        });

        it('should stop previous scheduler when starting new one', () => {
            const mockTimers = createMockTimers();

            // Start first scheduler
            startScheduler(
                { enabled: true, intervalMs: 60000 },
                {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                },
            );

            const firstIntervalId = mockTimers._intervals[0]?.id;
            expect(mockTimers._intervals.length).toBe(1);

            // Start second scheduler
            startScheduler(
                { enabled: true, intervalMs: 120000 },
                {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                },
            );

            // First interval should be cleared, only second should exist
            expect(mockTimers._intervals.length).toBe(1);
            expect(mockTimers._intervals[0].id).not.toBe(firstIntervalId);
            expect(mockTimers._intervals[0].interval).toBe(120000);
        });
    });

    describe('stopScheduler', () => {
        it('should stop running scheduler', () => {
            const mockTimers = createMockTimers();

            startScheduler(
                { enabled: true },
                {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                },
            );

            expect(isSchedulerRunning()).toBe(true);

            stopScheduler();

            expect(isSchedulerRunning()).toBe(false);
            expect(mockTimers._intervals.length).toBe(0);
        });

        it('should be safe to call when not running', () => {
            expect(() => stopScheduler()).not.toThrow();
            expect(isSchedulerRunning()).toBe(false);
        });
    });

    describe('getSchedulerStatus', () => {
        it('should return correct status when not running', () => {
            const status = getSchedulerStatus();

            expect(status.running).toBe(false);
            expect(status.lastRun).toBe(null);
            expect(status.isCleanupInProgress).toBe(false);
        });

        it('should return correct status when running', () => {
            const mockTimers = createMockTimers();

            startScheduler(
                { enabled: true, unsavedAgeHours: 48, guestAgeDays: 14 },
                {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                },
            );

            const status = getSchedulerStatus();

            expect(status.running).toBe(true);
            expect(status.config.unsavedAgeHours).toBe(48);
            expect(status.config.guestAgeDays).toBe(14);
        });
    });

    describe('getConfigFromEnv', () => {
        // The admin form reads CLEANUP_ENABLED with parseBoolean. Parsing it
        // any other way here lets /admin show "Active" with cleanup off.
        it.each(['1', 'yes', 'on', 'TRUE'])('accepts %s as enabled, like the settings reader does', value => {
            const saved = process.env.CLEANUP_ENABLED;
            process.env.CLEANUP_ENABLED = value;
            try {
                expect(getConfigFromEnv().enabled).toBe(true);
            } finally {
                if (saved === undefined) delete process.env.CLEANUP_ENABLED;
                else process.env.CLEANUP_ENABLED = saved;
            }
        });

        it('should return empty config when no env vars set', () => {
            // Save and clear env vars
            const saved = {
                CLEANUP_ENABLED: process.env.CLEANUP_ENABLED,
                CLEANUP_INTERVAL_HOURS: process.env.CLEANUP_INTERVAL_HOURS,
                CLEANUP_UNSAVED_AGE_HOURS: process.env.CLEANUP_UNSAVED_AGE_HOURS,
                CLEANUP_GUEST_AGE_DAYS: process.env.CLEANUP_GUEST_AGE_DAYS,
            };

            delete process.env.CLEANUP_ENABLED;
            delete process.env.CLEANUP_INTERVAL_HOURS;
            delete process.env.CLEANUP_UNSAVED_AGE_HOURS;
            delete process.env.CLEANUP_GUEST_AGE_DAYS;

            const config = getConfigFromEnv();

            expect(config.enabled).toBe(false);
            expect(config.intervalMs).toBe(undefined);
            expect(config.unsavedAgeHours).toBe(undefined);
            expect(config.guestAgeDays).toBe(undefined);

            // Restore env vars
            Object.entries(saved).forEach(([key, value]) => {
                if (value !== undefined) {
                    process.env[key] = value;
                }
            });
        });

        it('should parse env vars correctly', () => {
            // Save current env vars
            const saved = {
                CLEANUP_ENABLED: process.env.CLEANUP_ENABLED,
                CLEANUP_INTERVAL_HOURS: process.env.CLEANUP_INTERVAL_HOURS,
                CLEANUP_UNSAVED_AGE_HOURS: process.env.CLEANUP_UNSAVED_AGE_HOURS,
                CLEANUP_GUEST_AGE_DAYS: process.env.CLEANUP_GUEST_AGE_DAYS,
            };

            // Set test values
            process.env.CLEANUP_ENABLED = 'true';
            process.env.CLEANUP_INTERVAL_HOURS = '12';
            process.env.CLEANUP_UNSAVED_AGE_HOURS = '48';
            process.env.CLEANUP_GUEST_AGE_DAYS = '14';

            const config = getConfigFromEnv();

            expect(config.enabled).toBe(true);
            expect(config.intervalMs).toBe(12 * 60 * 60 * 1000);
            expect(config.unsavedAgeHours).toBe(48);
            expect(config.guestAgeDays).toBe(14);

            // Restore env vars
            Object.entries(saved).forEach(([key, value]) => {
                if (value !== undefined) {
                    process.env[key] = value;
                } else {
                    delete process.env[key];
                }
            });
        });
    });

    describe('normalizeConfig (#2670)', () => {
        it('should ignore undefined values instead of overriding the defaults', () => {
            const config = normalizeConfig({
                enabled: true,
                intervalMs: undefined,
                unsavedAgeHours: undefined,
                guestAgeDays: undefined,
            });

            expect(config.enabled).toBe(true);
            expect(config.intervalMs).toBe(DEFAULT_CONFIG.intervalMs);
            expect(config.unsavedAgeHours).toBe(DEFAULT_CONFIG.unsavedAgeHours);
            expect(config.guestAgeDays).toBe(DEFAULT_CONFIG.guestAgeDays);
        });

        it('should fall back to the defaults for NaN or out-of-range values', () => {
            const config = normalizeConfig({
                intervalMs: Number.NaN,
                unsavedAgeHours: 0,
                guestAgeDays: -1,
            });

            expect(config.intervalMs).toBe(DEFAULT_CONFIG.intervalMs);
            expect(config.unsavedAgeHours).toBe(DEFAULT_CONFIG.unsavedAgeHours);
            expect(config.guestAgeDays).toBe(DEFAULT_CONFIG.guestAgeDays);
        });

        it('should never start a scheduler with an undefined interval', () => {
            const mockTimers = createMockTimers();

            // Exactly what getConfigFromEnv() returns with only CLEANUP_ENABLED set
            startScheduler(
                { enabled: true, intervalMs: undefined, unsavedAgeHours: undefined, guestAgeDays: undefined },
                {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                },
            );

            expect(mockTimers._intervals[0].interval).toBe(DEFAULT_CONFIG.intervalMs);
            expect(getSchedulerStatus().config.unsavedAgeHours).toBe(DEFAULT_CONFIG.unsavedAgeHours);
        });
    });

    describe('previewCleanup', () => {
        const previewDeps = (queries: ReturnType<typeof createMockQueries>): CleanupSchedulerDeps => ({
            db: {} as Kysely<Database>,
            queries,
            fileHelper: createMockFileHelper(),
        });

        it('should count eligible projects without deleting anything', async () => {
            const queries = createMockQueries({
                unsavedProjects: [createMockProject({ id: 1 }), createMockProject({ id: 2 })],
                guestProjects: [createMockProject({ id: 3 })],
            });

            const preview = await previewCleanup(previewDeps(queries), DEFAULT_CONFIG);

            expect(preview).toEqual({ unsaved: 2, guest: 1, total: 3 });
            expect(queries._deletedProjectIds).toEqual([]);
        });

        it('should not double-count a project that is both unsaved and guest', async () => {
            const queries = createMockQueries({
                unsavedProjects: [createMockProject({ id: 1 })],
                guestProjects: [createMockProject({ id: 1 }), createMockProject({ id: 2 })],
            });

            const preview = await previewCleanup(previewDeps(queries), DEFAULT_CONFIG);

            expect(preview).toEqual({ unsaved: 1, guest: 1, total: 2 });
        });
    });

    describe('getEffectiveConfig', () => {
        const savedEnv = {
            CLEANUP_ENABLED: process.env.CLEANUP_ENABLED,
            CLEANUP_INTERVAL_HOURS: process.env.CLEANUP_INTERVAL_HOURS,
            CLEANUP_UNSAVED_AGE_HOURS: process.env.CLEANUP_UNSAVED_AGE_HOURS,
            CLEANUP_GUEST_AGE_DAYS: process.env.CLEANUP_GUEST_AGE_DAYS,
        };

        /**
         * Minimal Kysely stand-in for the app_settings lookups. `execute()`
         * backs the single getAllSettings() read, `where().executeTakeFirst()`
         * the per-key readers other services still use. Passing `failWith`
         * makes the read reject, as a database blip would.
         */
        const settingsDb = (stored: Record<string, string>, failWith?: Error): Kysely<Database> =>
            ({
                selectFrom: () => ({
                    selectAll: () => ({
                        execute: async () => {
                            if (failWith) throw failWith;
                            return Object.entries(stored).map(([key, value]) => ({ key, value, type: 'string' }));
                        },
                        where: (_column: string, _op: string, key: string) => ({
                            executeTakeFirst: async () => {
                                if (failWith) throw failWith;
                                return stored[key] === undefined
                                    ? undefined
                                    : { key, value: stored[key], type: 'string' };
                            },
                        }),
                    }),
                }),
            }) as unknown as Kysely<Database>;

        beforeEach(() => {
            delete process.env.CLEANUP_ENABLED;
            delete process.env.CLEANUP_INTERVAL_HOURS;
            delete process.env.CLEANUP_UNSAVED_AGE_HOURS;
            delete process.env.CLEANUP_GUEST_AGE_DAYS;
        });

        afterEach(() => {
            for (const [key, value] of Object.entries(savedEnv)) {
                if (value === undefined) {
                    delete process.env[key];
                } else {
                    process.env[key] = value;
                }
            }
        });

        it('should use the built-in defaults when nothing is configured', async () => {
            const config = await getEffectiveConfig(settingsDb({}));

            expect(config).toEqual(DEFAULT_CONFIG);
        });

        it('should fall back to the environment variables', async () => {
            process.env.CLEANUP_ENABLED = 'true';
            process.env.CLEANUP_INTERVAL_HOURS = '6';
            process.env.CLEANUP_UNSAVED_AGE_HOURS = '12';
            process.env.CLEANUP_GUEST_AGE_DAYS = '3';

            const config = await getEffectiveConfig(settingsDb({}));

            expect(config).toEqual({
                enabled: true,
                intervalMs: 6 * 60 * 60 * 1000,
                unsavedAgeHours: 12,
                guestAgeDays: 3,
            });
        });

        it('should let the stored settings take precedence over the environment', async () => {
            process.env.CLEANUP_ENABLED = 'false';
            process.env.CLEANUP_INTERVAL_HOURS = '6';

            const config = await getEffectiveConfig(
                settingsDb({
                    CLEANUP_ENABLED: 'true',
                    CLEANUP_INTERVAL_HOURS: '48',
                    CLEANUP_UNSAVED_AGE_HOURS: '72',
                    CLEANUP_GUEST_AGE_DAYS: '30',
                }),
            );

            expect(config).toEqual({
                enabled: true,
                intervalMs: 48 * 60 * 60 * 1000,
                unsavedAgeHours: 72,
                guestAgeDays: 30,
            });
        });

        it('should ignore invalid stored values', async () => {
            const config = await getEffectiveConfig(
                settingsDb({ CLEANUP_ENABLED: 'true', CLEANUP_INTERVAL_HOURS: '0' }),
            );

            expect(config.enabled).toBe(true);
            expect(config.intervalMs).toBe(DEFAULT_CONFIG.intervalMs);
        });

        it('should preview with the effective configuration', async () => {
            const queries = createMockQueries({
                unsavedProjects: [createMockProject({ id: 1 })],
                guestProjects: [createMockProject({ id: 2 })],
            });

            const preview = await previewPersistedCleanup(
                settingsDb({ CLEANUP_UNSAVED_AGE_HOURS: '72', CLEANUP_GUEST_AGE_DAYS: '30' }),
                { queries },
            );

            expect(preview.config.unsavedAgeHours).toBe(72);
            expect(preview.config.guestAgeDays).toBe(30);
            expect(preview.total).toBe(2);
            expect(queries._deletedProjectIds).toEqual([]);
        });

        // A read failure must not look like "nothing configured": falling back
        // to the environment there can silently re-enable a cleanup an admin
        // has just switched off.
        it('propagates a settings read failure instead of falling back', async () => {
            const boom = new Error('connection reset');
            await expect(getEffectiveConfig(settingsDb({}, boom))).rejects.toThrow('connection reset');
        });

        describe('applyPersistedConfig', () => {
            // Reading the configuration from one connection and deleting
            // through another (the module-level default) makes the injection
            // seam a lie, and would delete from the wrong database.
            it('deletes through the database it read the configuration from', async () => {
                const mockTimers = createMockTimers();
                const db = settingsDb({ CLEANUP_ENABLED: 'true', CLEANUP_INTERVAL_HOURS: '2' });
                let usedDb: unknown = null;

                await applyPersistedConfig(db, {
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                    runCleanup: async deps => {
                        usedDb = deps.db;
                        return { success: true, unsavedDeleted: 0, guestDeleted: 0, diskCleaned: 0, errors: [] };
                    },
                });

                expect(usedDb).toBe(db);
            });

            // Only the replica that serves the save re-reads app_settings, so
            // every other one has to notice at its next tick.
            it('stops deleting at the next tick once the stored setting disables it', async () => {
                const mockTimers = createMockTimers();
                const runCleanupMock = mock(async () => ({
                    success: true,
                    unsavedDeleted: 0,
                    guestDeleted: 0,
                    diskCleaned: 0,
                    errors: [],
                }));
                const stored: Record<string, string> = { CLEANUP_ENABLED: 'true', CLEANUP_INTERVAL_HOURS: '2' };

                await applyPersistedConfig(settingsDb(stored), {
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                    runCleanup: runCleanupMock,
                });
                expect(runCleanupMock).toHaveBeenCalledTimes(1); // the enable sweep

                // Another instance turns cleanup off in the database.
                stored.CLEANUP_ENABLED = 'false';
                mockTimers.triggerInterval(mockTimers._intervals[0].id);
                await new Promise(resolve => setTimeout(resolve, 0));

                expect(runCleanupMock).toHaveBeenCalledTimes(1);
            });

            it('should start the scheduler when the stored setting enables it', async () => {
                const mockTimers = createMockTimers();

                const config = await applyPersistedConfig(
                    settingsDb({ CLEANUP_ENABLED: 'true', CLEANUP_INTERVAL_HOURS: '2' }),
                    {
                        db: {} as Kysely<Database>,
                        queries: createMockQueries(),
                        fileHelper: createMockFileHelper(),
                        timers: mockTimers,
                    },
                );

                expect(config.enabled).toBe(true);
                expect(isSchedulerRunning()).toBe(true);
                expect(mockTimers._intervals.length).toBe(1);
                expect(mockTimers._intervals[0].interval).toBe(2 * 60 * 60 * 1000);
            });

            it('should reschedule without leaving a duplicate timer', async () => {
                const mockTimers = createMockTimers();
                const deps = {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                };

                await applyPersistedConfig(settingsDb({ CLEANUP_ENABLED: 'true', CLEANUP_INTERVAL_HOURS: '2' }), deps);
                await applyPersistedConfig(settingsDb({ CLEANUP_ENABLED: 'true', CLEANUP_INTERVAL_HOURS: '5' }), deps);

                expect(mockTimers._intervals.length).toBe(1);
                expect(mockTimers._intervals[0].interval).toBe(5 * 60 * 60 * 1000);
            });

            it('should stop a running scheduler when the stored setting disables it', async () => {
                const mockTimers = createMockTimers();
                const deps = {
                    db: {} as Kysely<Database>,
                    queries: createMockQueries(),
                    fileHelper: createMockFileHelper(),
                    timers: mockTimers,
                };

                await applyPersistedConfig(settingsDb({ CLEANUP_ENABLED: 'true' }), deps);
                expect(isSchedulerRunning()).toBe(true);

                await applyPersistedConfig(settingsDb({ CLEANUP_ENABLED: 'false' }), deps);

                expect(isSchedulerRunning()).toBe(false);
                expect(mockTimers._intervals.length).toBe(0);
            });
        });
    });

    describe('DEFAULT_CONFIG', () => {
        it('should have reasonable defaults', () => {
            expect(DEFAULT_CONFIG.enabled).toBe(false);
            expect(DEFAULT_CONFIG.intervalMs).toBe(24 * 60 * 60 * 1000);
            expect(DEFAULT_CONFIG.unsavedAgeHours).toBe(24);
            expect(DEFAULT_CONFIG.guestAgeDays).toBe(7);
        });
    });
});
