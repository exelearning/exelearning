/**
 * Tests for Projects Purge Command
 */
import { describe, it, expect } from 'bun:test';
import { execute, printHelp, runCli, type ProjectsPurgeDependencies } from './projects-purge';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';

describe('Projects Purge Command', () => {
    // Mock file helper
    const createMockFileHelper = (
        options: { filesDir?: string; existingPaths?: Set<string>; removeErrors?: Map<string, Error> } = {},
    ) => {
        const { filesDir = '/tmp/test', existingPaths = new Set(), removeErrors = new Map() } = options;
        const removedPaths: string[] = [];

        return {
            getFilesDir: () => filesDir,
            getOdeSessionTempDir: (uuid: string) => `${filesDir}/tmp/${uuid}`,
            getOdeSessionDistDir: (uuid: string) => `${filesDir}/dist/${uuid}`,
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

    // Mock database
    const createMockDb = (
        options: {
            projects?: Array<{ uuid: string }>;
            counts?: {
                projects?: number;
                assets?: number;
                yjs_documents?: number;
                yjs_updates?: number;
                yjs_version_history?: number;
                project_collaborators?: number;
            };
        } = {},
    ) => {
        const { projects = [], counts = {} } = options;
        const deletedTables: string[] = [];

        const mockDeleteQuery = (table: string) => ({
            execute: async () => {
                deletedTables.push(table);
                return [];
            },
        });

        const mockTransaction = {
            deleteFrom: (table: string) => mockDeleteQuery(table),
        };

        const mockDb = {
            selectFrom: (table: string) => {
                if (table === 'projects') {
                    return {
                        select: (colOrFn: string | ((eb: unknown) => unknown)) => {
                            // Check if it's the uuid select or count select
                            if (typeof colOrFn === 'string' && colOrFn === 'uuid') {
                                return {
                                    execute: async () => projects,
                                };
                            }
                            // It's the count select with callback
                            return {
                                executeTakeFirst: async () => ({
                                    count: counts[table as keyof typeof counts] ?? 0,
                                }),
                            };
                        },
                    };
                }
                // For other tables, it's always a count query
                return {
                    select: () => ({
                        executeTakeFirst: async () => ({
                            count: counts[table as keyof typeof counts] ?? 0,
                        }),
                    }),
                };
            },
            transaction: () => ({
                execute: async (fn: (trx: typeof mockTransaction) => Promise<void>) => {
                    await fn(mockTransaction);
                },
            }),
            _deletedTables: deletedTables,
        };

        return mockDb as unknown as Kysely<Database> & { _deletedTables: string[] };
    };

    describe('execute', () => {
        it('should require confirmation with --yes flag', async () => {
            const deps: ProjectsPurgeDependencies = {
                db: createMockDb(),
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], {}, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('--yes');
        });

        it('should proceed with --yes flag', async () => {
            const deps: ProjectsPurgeDependencies = {
                db: createMockDb({ counts: { projects: 5, assets: 10 } }),
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Deleted 5 projects');
            expect(result.message).toContain('10 assets');
        });

        it('should proceed with --force flag', async () => {
            const deps: ProjectsPurgeDependencies = {
                db: createMockDb({ counts: { projects: 3 } }),
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], { force: true }, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Deleted 3 projects');
        });

        it('should support dry-run mode without --yes', async () => {
            const deps: ProjectsPurgeDependencies = {
                db: createMockDb({
                    projects: [{ uuid: 'uuid-1' }, { uuid: 'uuid-2' }],
                    counts: { projects: 2, assets: 5, yjs_documents: 3 },
                }),
                fileHelper: createMockFileHelper({ filesDir: '/data' }),
            };

            const result = await execute([], { 'dry-run': true }, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Would delete 2 projects');
            expect(result.message).toContain('5 assets');
            expect(result.stats?.projects).toBe(2);
            expect(result.stats?.assets).toBe(5);
            expect(result.stats?.yjsDocuments).toBe(3);
        });

        it('should delete all related tables in transaction', async () => {
            const mockDb = createMockDb({
                counts: {
                    projects: 1,
                    assets: 2,
                    yjs_documents: 3,
                    yjs_updates: 4,
                    yjs_version_history: 5,
                    project_collaborators: 6,
                },
            });

            const deps: ProjectsPurgeDependencies = {
                db: mockDb,
                fileHelper: createMockFileHelper(),
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(true);
            expect(result.stats?.projects).toBe(1);
            expect(result.stats?.assets).toBe(2);
            expect(result.stats?.yjsDocuments).toBe(3);
            expect(result.stats?.yjsUpdates).toBe(4);
            expect(result.stats?.yjsVersions).toBe(5);
            expect(result.stats?.collaborators).toBe(6);
        });

        it('should remove assets directory from disk', async () => {
            const existingPaths = new Set(['/data/assets']);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths });

            const deps: ProjectsPurgeDependencies = {
                db: createMockDb(),
                fileHelper,
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(true);
            expect(fileHelper._removedPaths).toContain('/data/assets');
            expect(result.stats?.diskRemoved).toBe(1);
        });

        it('should remove session directories for each project', async () => {
            const existingPaths = new Set([
                '/data/tmp/uuid-1',
                '/data/dist/uuid-1',
                '/data/tmp/uuid-2',
                '/data/dist/uuid-2',
            ]);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths });

            const deps: ProjectsPurgeDependencies = {
                db: createMockDb({ projects: [{ uuid: 'uuid-1' }, { uuid: 'uuid-2' }] }),
                fileHelper,
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(true);
            expect(fileHelper._removedPaths).toContain('/data/tmp/uuid-1');
            expect(fileHelper._removedPaths).toContain('/data/dist/uuid-1');
            expect(fileHelper._removedPaths).toContain('/data/tmp/uuid-2');
            expect(fileHelper._removedPaths).toContain('/data/dist/uuid-2');
            expect(result.stats?.diskRemoved).toBe(4);
        });

        it('should count missing paths correctly', async () => {
            const fileHelper = createMockFileHelper({
                filesDir: '/data',
                existingPaths: new Set(), // No paths exist
            });

            const deps: ProjectsPurgeDependencies = {
                db: createMockDb({ projects: [{ uuid: 'uuid-1' }] }),
                fileHelper,
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(true);
            expect(result.stats?.diskMissing).toBeGreaterThan(0);
            expect(result.stats?.diskRemoved).toBe(0);
        });

        it('should report disk removal failures', async () => {
            const existingPaths = new Set(['/data/assets']);
            const removeErrors = new Map([['/data/assets', new Error('Permission denied')]]);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths, removeErrors });

            const deps: ProjectsPurgeDependencies = {
                db: createMockDb(),
                fileHelper,
            };

            const result = await execute([], { yes: true }, deps);

            expect(result.success).toBe(false);
            expect(result.stats?.diskFailures).toHaveLength(1);
            expect(result.stats?.diskFailures[0]).toContain('Permission denied');
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

            expect(output).toContain('projects:purge');
            expect(output).toContain('--yes');
            expect(output).toContain('--dry-run');
        });
    });

    describe('runCli', () => {
        it('should show help when --help flag is passed', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const deps: ProjectsPurgeDependencies = {
                db: createMockDb(),
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

            const deps: ProjectsPurgeDependencies = {
                db: createMockDb(),
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

            const deps: ProjectsPurgeDependencies = {
                db: createMockDb(),
                fileHelper: createMockFileHelper(),
            };

            await runCli(['bun', 'cli', 'projects:purge'], deps, mockExit);

            expect(exitCode).toBe(1);
        });

        it('should exit with success on dry run', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const deps: ProjectsPurgeDependencies = {
                db: createMockDb(),
                fileHelper: createMockFileHelper(),
            };

            await runCli(['bun', 'cli', 'projects:purge', '--dry-run'], deps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with success when confirmed with --yes', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const deps: ProjectsPurgeDependencies = {
                db: createMockDb(),
                fileHelper: createMockFileHelper(),
            };

            await runCli(['bun', 'cli', 'projects:purge', '--yes'], deps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should display disk failures when present', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const existingPaths = new Set(['/data/assets']);
            const removeErrors = new Map([['/data/assets', new Error('EACCES')]]);
            const fileHelper = createMockFileHelper({ filesDir: '/data', existingPaths, removeErrors });

            const deps: ProjectsPurgeDependencies = {
                db: createMockDb(),
                fileHelper,
            };

            await runCli(['bun', 'cli', 'projects:purge', '--yes'], deps, mockExit);

            expect(exitCode).toBe(1);
        });

        it('should handle unexpected errors gracefully', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            const deps: ProjectsPurgeDependencies = {
                db: {
                    selectFrom: () => {
                        throw new Error('Database connection failed');
                    },
                } as unknown as Kysely<Database>,
                fileHelper: createMockFileHelper(),
            };

            await runCli(['bun', 'cli', 'projects:purge', '--yes'], deps, mockExit);

            expect(exitCode).toBe(1);
        });
    });
});
