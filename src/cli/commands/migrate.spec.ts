/**
 * Tests for Migrate Command
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect } from 'bun:test';
import { execute, printHelp, type MigrateDependencies } from './migrate';

describe('Migrate Command', () => {
    // Create mock dependencies for each test
    function createMockDependencies(
        options: {
            migrateSuccess?: boolean;
            executedMigrations?: string[];
            rolledBack?: string;
            executed?: string[];
            pending?: string[];
            error?: Error;
        } = {},
    ): MigrateDependencies {
        const {
            migrateSuccess = true,
            executedMigrations = [],
            rolledBack,
            executed = [],
            pending = [],
            error,
        } = options;

        return {
            db: {} as any,
            queries: {
                migrateToLatest: async () => ({
                    success: migrateSuccess,
                    executedMigrations,
                    error,
                }),
                migrateDown: async () => ({
                    success: migrateSuccess,
                    rolledBack,
                    error,
                }),
                getMigrationStatus: async () => ({
                    executed,
                    pending,
                }),
            },
        };
    }

    describe('execute', () => {
        describe('up subcommand', () => {
            it('should run migrations with "up" subcommand', async () => {
                const deps = createMockDependencies({
                    migrateSuccess: true,
                    executedMigrations: ['001_initial'],
                });
                const result = await execute(['up'], {}, deps);

                expect(result.success).toBe(true);
                expect(result.message).toContain('Migrations executed');
                expect(result.message).toContain('001_initial');
            });

            it('should default to "up" when no subcommand provided', async () => {
                const deps = createMockDependencies({
                    migrateSuccess: true,
                    executedMigrations: ['001_initial'],
                });
                const result = await execute([], {}, deps);

                expect(result.success).toBe(true);
                expect(result.message).toContain('001_initial');
            });

            it('should report when no pending migrations', async () => {
                const deps = createMockDependencies({
                    migrateSuccess: true,
                    executedMigrations: [],
                });
                const result = await execute(['up'], {}, deps);

                expect(result.success).toBe(true);
                expect(result.message).toBe('No pending migrations');
            });

            it('should report migration failure', async () => {
                const deps = createMockDependencies({
                    migrateSuccess: false,
                    error: new Error('Database connection failed'),
                });
                const result = await execute(['up'], {}, deps);

                expect(result.success).toBe(false);
                expect(result.message).toContain('Database connection failed');
            });

            it('should handle migration failure without error object', async () => {
                const deps = createMockDependencies({
                    migrateSuccess: false,
                });
                const result = await execute(['up'], {}, deps);

                expect(result.success).toBe(false);
                expect(result.message).toBe('Migration failed');
            });

            it('should list multiple executed migrations', async () => {
                const deps = createMockDependencies({
                    migrateSuccess: true,
                    executedMigrations: ['001_initial', '002_add_users', '003_add_projects'],
                });
                const result = await execute(['up'], {}, deps);

                expect(result.success).toBe(true);
                expect(result.message).toContain('001_initial');
                expect(result.message).toContain('002_add_users');
                expect(result.message).toContain('003_add_projects');
            });
        });

        describe('down subcommand', () => {
            it('should rollback with "down" subcommand', async () => {
                const deps = createMockDependencies({
                    migrateSuccess: true,
                    rolledBack: '001_initial',
                });
                const result = await execute(['down'], {}, deps);

                expect(result.success).toBe(true);
                expect(result.message).toContain('Rolled back');
                expect(result.message).toContain('001_initial');
            });

            it('should report when no migrations to rollback', async () => {
                const deps = createMockDependencies({
                    migrateSuccess: true,
                    rolledBack: undefined,
                });
                const result = await execute(['down'], {}, deps);

                expect(result.success).toBe(true);
                expect(result.message).toBe('No migrations to rollback');
            });

            it('should report rollback failure', async () => {
                const deps = createMockDependencies({
                    migrateSuccess: false,
                    error: new Error('Rollback constraint violation'),
                });
                const result = await execute(['down'], {}, deps);

                expect(result.success).toBe(false);
                expect(result.message).toContain('Rollback constraint violation');
            });

            it('should handle rollback failure without error object', async () => {
                const deps = createMockDependencies({
                    migrateSuccess: false,
                });
                const result = await execute(['down'], {}, deps);

                expect(result.success).toBe(false);
                expect(result.message).toBe('Rollback failed');
            });
        });

        describe('status subcommand', () => {
            it('should show migration status', async () => {
                const deps = createMockDependencies({
                    executed: ['001_initial'],
                    pending: ['002_add_users'],
                });
                const result = await execute(['status'], {}, deps);

                expect(result.success).toBe(true);
                expect(result.message).toContain('Executed');
                expect(result.message).toContain('001_initial');
                expect(result.message).toContain('Pending');
                expect(result.message).toContain('002_add_users');
            });

            it('should show (none) when no executed migrations', async () => {
                const deps = createMockDependencies({
                    executed: [],
                    pending: ['001_initial'],
                });
                const result = await execute(['status'], {}, deps);

                expect(result.success).toBe(true);
                expect(result.message).toContain('Executed: (none)');
                expect(result.message).toContain('001_initial');
            });

            it('should show (none) when no pending migrations', async () => {
                const deps = createMockDependencies({
                    executed: ['001_initial'],
                    pending: [],
                });
                const result = await execute(['status'], {}, deps);

                expect(result.success).toBe(true);
                expect(result.message).toContain('001_initial');
                expect(result.message).toContain('Pending: (none)');
            });

            it('should show all empty when database is fresh', async () => {
                const deps = createMockDependencies({
                    executed: [],
                    pending: [],
                });
                const result = await execute(['status'], {}, deps);

                expect(result.success).toBe(true);
                expect(result.message).toContain('Executed: (none)');
                expect(result.message).toContain('Pending: (none)');
            });
        });

        describe('unknown subcommand', () => {
            it('should return error for unknown subcommand', async () => {
                const deps = createMockDependencies();
                const result = await execute(['invalid'], {}, deps);

                expect(result.success).toBe(false);
                expect(result.message).toContain('Unknown subcommand');
                expect(result.message).toContain('invalid');
            });

            it('should include available subcommands in error message', async () => {
                const deps = createMockDependencies();
                const result = await execute(['foo'], {}, deps);

                expect(result.success).toBe(false);
                expect(result.message).toContain('up');
                expect(result.message).toContain('down');
                expect(result.message).toContain('status');
            });
        });
    });

    describe('printHelp', () => {
        it('should not throw when called', () => {
            const originalLog = console.log;
            let output = '';
            console.log = (msg: string) => {
                output += msg;
            };

            expect(() => printHelp()).not.toThrow();

            console.log = originalLog;

            expect(output).toContain('migrate');
            expect(output).toContain('up');
            expect(output).toContain('down');
            expect(output).toContain('status');
        });

        it('should include usage examples', () => {
            const originalLog = console.log;
            let output = '';
            console.log = (msg: string) => {
                output += msg;
            };

            printHelp();

            console.log = originalLog;

            expect(output).toContain('bun cli migrate');
            expect(output).toContain('Examples');
        });

        it('should describe all subcommands', () => {
            const originalLog = console.log;
            let output = '';
            console.log = (msg: string) => {
                output += msg;
            };

            printHelp();

            console.log = originalLog;

            expect(output).toContain('pending migrations');
            expect(output).toContain('Rollback');
            expect(output).toContain('migration status');
        });
    });
});
