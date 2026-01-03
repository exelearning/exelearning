/**
 * Tests for Check Quota Command
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { execute, printHelp, runCli, type CheckQuotaDependencies } from './check-quota';

describe('Check Quota Command', () => {
    let getUserStorageUsageCalls: Array<{ userId: number }>;

    // Create mock dependencies for each test
    function createMockDependencies(
        userEmail: string | null = 'test@test.com',
        quotaMB: number | null = 4096,
        storageBytes: number = 0,
    ): CheckQuotaDependencies {
        return {
            db: {} as any,
            queries: {
                findUserByEmail: async (_db: any, email: string) => {
                    if (email === userEmail) {
                        return {
                            id: 1,
                            email,
                            quota_mb: quotaMB,
                        } as any;
                    }
                    return undefined;
                },
                getUserStorageUsage: async (_db: any, userId: number) => {
                    getUserStorageUsageCalls.push({ userId });
                    return storageBytes;
                },
            },
        };
    }

    beforeEach(() => {
        getUserStorageUsageCalls = [];
    });

    describe('execute', () => {
        it('should fail when email is missing', async () => {
            const deps = createMockDependencies();
            const result = await execute([], {}, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Missing required argument');
        });

        it('should fail when user is not found', async () => {
            const deps = createMockDependencies('other@test.com');
            const result = await execute(['notfound@test.com'], {}, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('should show quota with 0 usage', async () => {
            const deps = createMockDependencies('test@test.com', 4096, 0);
            const result = await execute(['test@test.com'], {}, deps);

            expect(result.success).toBe(true);
            expect(result.message).toBe('quota = 0/4096');
            expect(result.usedMB).toBe(0);
            expect(result.quotaMB).toBe(4096);
        });

        it('should show quota with usage in MB', async () => {
            const storageBytes = 500 * 1024 * 1024; // 500 MB
            const deps = createMockDependencies('test@test.com', 4096, storageBytes);
            const result = await execute(['test@test.com'], {}, deps);

            expect(result.success).toBe(true);
            expect(result.message).toBe('quota = 500/4096');
            expect(result.usedMB).toBe(500);
            expect(result.quotaMB).toBe(4096);
        });

        it('should show unlimited when quota is null', async () => {
            const storageBytes = 1024 * 1024 * 1024; // 1 GB = 1024 MB
            const deps = createMockDependencies('test@test.com', null, storageBytes);
            const result = await execute(['test@test.com'], {}, deps);

            expect(result.success).toBe(true);
            expect(result.message).toBe('quota = 1024/unlimited');
            expect(result.usedMB).toBe(1024);
            expect(result.quotaMB).toBeNull();
        });

        it('should round bytes to nearest MB', async () => {
            const storageBytes = 500.7 * 1024 * 1024; // 500.7 MB
            const deps = createMockDependencies('test@test.com', 4096, Math.floor(storageBytes));
            const result = await execute(['test@test.com'], {}, deps);

            expect(result.success).toBe(true);
            expect(result.message).toBe('quota = 501/4096');
            expect(result.usedMB).toBe(501);
        });

        it('should accept email as flag', async () => {
            const deps = createMockDependencies('flag@test.com', 2048, 0);
            const result = await execute([], { email: 'flag@test.com' }, deps);

            expect(result.success).toBe(true);
            expect(result.message).toBe('quota = 0/2048');
        });

        it('should accept email as positional argument', async () => {
            const deps = createMockDependencies('positional@test.com', 2048, 0);
            const result = await execute(['positional@test.com'], {}, deps);

            expect(result.success).toBe(true);
            expect(result.message).toBe('quota = 0/2048');
        });

        it('should call getUserStorageUsage with correct userId', async () => {
            const deps = createMockDependencies('test@test.com', 4096, 0);
            await execute(['test@test.com'], {}, deps);

            expect(getUserStorageUsageCalls).toHaveLength(1);
            expect(getUserStorageUsageCalls[0].userId).toBe(1);
        });
    });

    describe('runCli', () => {
        it('should exit with success when user exists', async () => {
            const deps = createMockDependencies('test@test.com', 4096, 0);
            let exitCode = -1;
            const exitFn = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'check-quota', 'test@test.com'], deps, exitFn);

            expect(exitCode).toBe(0);
        });

        it('should exit with failure when user not found', async () => {
            const deps = createMockDependencies('other@test.com');
            let exitCode = -1;
            const exitFn = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'check-quota', 'notfound@test.com'], deps, exitFn);

            expect(exitCode).toBe(1);
        });

        it('should exit with success when help is requested', async () => {
            const deps = createMockDependencies();
            let exitCode = -1;
            const exitFn = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'check-quota', '--help'], deps, exitFn);

            expect(exitCode).toBe(0);
        });

        it('should exit with failure when email is missing', async () => {
            const deps = createMockDependencies();
            let exitCode = -1;
            const exitFn = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'check-quota'], deps, exitFn);

            expect(exitCode).toBe(1);
        });
    });

    describe('printHelp', () => {
        it('should print help without errors', () => {
            expect(() => printHelp()).not.toThrow();
        });
    });
});
