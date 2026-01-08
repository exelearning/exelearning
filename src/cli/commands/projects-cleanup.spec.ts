/**
 * Tests for Projects Cleanup Command
 */
import { describe, it, expect } from 'bun:test';
import {
    execute,
    printHelp,
    runCli,
    type ProjectsCleanupDependencies,
    type ProjectsCleanupQueries,
} from './projects-cleanup';
import type { Kysely } from 'kysely';
import type { Database, Project } from '../../db/types';

describe('Projects Cleanup Command', () => {
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
    const createMockQueries = (
        options: { unsavedProjects?: Project[]; guestProjects?: Project[]; deletedProjectIds?: number[] } = {},
    ): ProjectsCleanupQueries & { _deletedProjectIds: number[] } => {
        const { unsavedProjects = [], guestProjects = [], deletedProjectIds = [] } = options;
        const _deletedProjectIds = [...deletedProjectIds];

        return {
            findUnsavedProjectsOlderThan: async () => unsavedProjects,
            findGuestProjectsOlderThan: async () => guestProjects,
            deleteProjectWithRelatedData: async (_db: Kysely<Database>, projectId: number) => {
                _deletedProjectIds.push(projectId);
            },
            _deletedProjectIds,
        };
    };

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
        created_at: Date.now() - 48 * 60 * 60 * 1000, // 48 hours ago
        updated_at: Date.now() - 48 * 60 * 60 * 1000,
        platform_id: null,
        ...overrides,
    });

    describe('execute', () => {
        it('should require confirmation with --yes flag', async () => {
            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries(),
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], {}, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('--yes');
        });

        it('should proceed with --yes flag', async () => {
            const unsavedProjects = [createMockProject({ id: 1, uuid: 'uuid-1' })];
            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries({ unsavedProjects }),
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Deleted 1 unsaved');
        });

        it('should proceed with --force flag', async () => {
            const unsavedProjects = [createMockProject()];
            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries({ unsavedProjects }),
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], { force: true }, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Deleted 1 unsaved');
        });

        it('should support dry-run mode without --yes', async () => {
            const unsavedProjects = [
                createMockProject({ id: 1, uuid: 'uuid-1' }),
                createMockProject({ id: 2, uuid: 'uuid-2' }),
            ];
            const guestProjects = [createMockProject({ id: 3, uuid: 'uuid-3' })];

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries({ unsavedProjects, guestProjects }),
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], { 'dry-run': true }, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Would delete 2 unsaved');
            expect(result.message).toContain('1 guest');
            expect(result.stats.unsavedDeleted).toBe(2);
            expect(result.stats.guestDeleted).toBe(1);
        });

        it('should delete unsaved projects older than specified age', async () => {
            const unsavedProjects = [
                createMockProject({ id: 1, uuid: 'uuid-1' }),
                createMockProject({ id: 2, uuid: 'uuid-2' }),
            ];

            const queries = createMockQueries({ unsavedProjects });
            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], { yes: true, 'unsaved-age': '24' }, deps);

            expect(result.success).toBe(true);
            expect(queries._deletedProjectIds).toContain(1);
            expect(queries._deletedProjectIds).toContain(2);
            expect(result.stats.unsavedDeleted).toBe(2);
        });

        it('should delete guest projects older than specified age', async () => {
            const guestProjects = [
                createMockProject({ id: 1, uuid: 'guest-uuid-1' }),
                createMockProject({ id: 2, uuid: 'guest-uuid-2' }),
            ];

            const queries = createMockQueries({ guestProjects });
            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], { yes: true, 'guest-age': '7' }, deps);

            expect(result.success).toBe(true);
            expect(queries._deletedProjectIds).toContain(1);
            expect(queries._deletedProjectIds).toContain(2);
            expect(result.stats.guestDeleted).toBe(2);
        });

        it('should not count guest projects that are also unsaved twice', async () => {
            // Same project is both unsaved AND owned by guest
            const sharedProject = createMockProject({ id: 1, uuid: 'shared-uuid' });

            const queries = createMockQueries({
                unsavedProjects: [sharedProject],
                guestProjects: [sharedProject], // Same project appears in both lists
            });

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries,
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(true);
            // Should only delete once
            expect(queries._deletedProjectIds).toEqual([1]);
            expect(result.stats.unsavedDeleted).toBe(1);
            expect(result.stats.guestDeleted).toBe(0); // Deduplicated
        });

        it('should remove asset directories from disk', async () => {
            const unsavedProjects = [createMockProject({ id: 1, uuid: 'uuid-1' })];
            const existingPaths = new Set(['/data/assets/uuid-1']);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths });

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries({ unsavedProjects }),
                fileHelper,
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(true);
            expect(fileHelper._removedPaths).toContain('/data/assets/uuid-1');
            expect(result.stats.diskCleaned).toBe(1);
        });

        it('should count missing asset directories correctly', async () => {
            const unsavedProjects = [createMockProject({ id: 1, uuid: 'uuid-1' })];
            const fileHelper = createMockFileHelper({
                filesDir: '/data',
                existingPaths: new Set(), // No paths exist
            });

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries({ unsavedProjects }),
                fileHelper,
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(true);
            expect(result.stats.diskMissing).toBe(1);
            expect(result.stats.diskCleaned).toBe(0);
        });

        it('should report disk removal failures', async () => {
            const unsavedProjects = [createMockProject({ id: 1, uuid: 'uuid-1' })];
            const existingPaths = new Set(['/data/assets/uuid-1']);
            const removeErrors = new Map([['/data/assets/uuid-1', new Error('Permission denied')]]);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths, removeErrors });

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries({ unsavedProjects }),
                fileHelper,
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(false);
            expect(result.stats.diskFailures).toHaveLength(1);
            expect(result.stats.diskFailures[0]).toContain('Permission denied');
        });

        it('should use default age values when not specified', async () => {
            // This test verifies that the function doesn't error with default values
            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries(),
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(true);
            expect(result.stats.unsavedDeleted).toBe(0);
            expect(result.stats.guestDeleted).toBe(0);
        });

        it('should handle empty project lists', async () => {
            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries({ unsavedProjects: [], guestProjects: [] }),
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Deleted 0 unsaved and 0 guest projects');
        });
    });

    describe('printHelp', () => {
        it('should not throw and contain key sections', () => {
            const originalLog = console.log;
            let output = '';
            console.log = (msg: string) => {
                output += msg;
            };

            expect(() => printHelp()).not.toThrow();

            console.log = originalLog;

            expect(output).toContain('projects:cleanup');
            expect(output).toContain('--yes');
            expect(output).toContain('--dry-run');
            expect(output).toContain('--unsaved-age');
            expect(output).toContain('--guest-age');
        });
    });

    describe('runCli', () => {
        it('should show help when --help flag is passed', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries(),
                fileHelper: createMockFileHelper(),
            };

            await runCli(['bun', 'cli', '--help'], deps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should show help when -h flag is passed', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries(),
                fileHelper: createMockFileHelper(),
            };

            await runCli(['bun', 'cli', '-h'], deps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with failure when not confirmed', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries(),
                fileHelper: createMockFileHelper(),
            };

            await runCli(['bun', 'cli', 'projects:cleanup'], deps, mockExit);

            expect(exitCode).toBe(1);
        });

        it('should exit with success on dry run', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries(),
                fileHelper: createMockFileHelper(),
            };

            await runCli(['bun', 'cli', 'projects:cleanup', '--dry-run'], deps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with success when confirmed with --yes', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries(),
                fileHelper: createMockFileHelper(),
            };

            await runCli(['bun', 'cli', 'projects:cleanup', '--yes'], deps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should parse custom age flags', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries(),
                fileHelper: createMockFileHelper(),
            };

            await runCli(
                ['bun', 'cli', 'projects:cleanup', '--dry-run', '--unsaved-age', '48', '--guest-age', '14'],
                deps,
                mockExit,
            );

            expect(exitCode).toBe(0);
        });

        it('should display disk failures when present', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const unsavedProjects = [createMockProject({ id: 1, uuid: 'uuid-1' })];
            const existingPaths = new Set(['/data/assets/uuid-1']);
            const removeErrors = new Map([['/data/assets/uuid-1', new Error('EACCES')]]);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths, removeErrors });

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: createMockQueries({ unsavedProjects }),
                fileHelper,
            };

            await runCli(['bun', 'cli', 'projects:cleanup', '--yes'], deps, mockExit);

            expect(exitCode).toBe(1);
        });

        it('should handle unexpected errors gracefully', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const deps: ProjectsCleanupDependencies = {
                db: {} as Kysely<Database>,
                queries: {
                    findUnsavedProjectsOlderThan: async () => {
                        throw new Error('Database connection failed');
                    },
                    findGuestProjectsOlderThan: async () => [],
                    deleteProjectWithRelatedData: async () => {},
                },
                fileHelper: createMockFileHelper(),
            };

            await runCli(['bun', 'cli', 'projects:cleanup', '--yes'], deps, mockExit);

            expect(exitCode).toBe(1);
        });
    });
});
