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
    DEFAULT_CONFIG,
    type CleanupSchedulerDeps,
} from './cleanup-scheduler';
import type { Kysely } from 'kysely';
import type { Database, Project } from '../db/types';

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

    describe('DEFAULT_CONFIG', () => {
        it('should have reasonable defaults', () => {
            expect(DEFAULT_CONFIG.enabled).toBe(false);
            expect(DEFAULT_CONFIG.intervalMs).toBe(24 * 60 * 60 * 1000);
            expect(DEFAULT_CONFIG.unsavedAgeHours).toBe(24);
            expect(DEFAULT_CONFIG.guestAgeDays).toBe(7);
        });
    });
});
