/**
 * Tests for Set Quota Command
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { execute, printHelp, runCli, type SetQuotaDependencies } from './set-quota';

describe('Set Quota Command', () => {
    let userQuotaCalls: Array<{ userId: number; quotaMb: number | null }>;
    let allQuotaCalls: Array<number | null>;

    function createMockDependencies(
        userEmail: string | null = 'test@test.com',
        defaultQuotaMb = 4096,
        totalUsers = 3,
    ): SetQuotaDependencies {
        return {
            db: {} as any,
            queries: {
                findUserByEmail: async (_db: any, email: string) =>
                    email === userEmail ? ({ id: 7, email, quota_mb: 100 } as any) : undefined,
                updateUserQuota: async (_db: any, userId: number, quotaMb: number | null) => {
                    userQuotaCalls.push({ userId, quotaMb });
                    return { id: userId, quota_mb: quotaMb } as any;
                },
                updateAllUsersQuota: async (_db: any, quotaMb: number | null) => {
                    allQuotaCalls.push(quotaMb);
                    return totalUsers;
                },
                getDefaultQuotaMb: async () => defaultQuotaMb,
            },
        };
    }

    beforeEach(() => {
        userQuotaCalls = [];
        allQuotaCalls = [];
    });

    describe('execute', () => {
        it('should set the quota of one user from positional arguments', async () => {
            const result = await execute(['test@test.com', '2048'], {}, createMockDependencies());

            expect(result.success).toBe(true);
            expect(result.message).toBe('Quota set to 2048 MB for test@test.com');
            expect(userQuotaCalls).toEqual([{ userId: 7, quotaMb: 2048 }]);
            expect(allQuotaCalls).toHaveLength(0);
        });

        it('should accept --email and --quota flags', async () => {
            const result = await execute([], { email: 'test@test.com', quota: '512' }, createMockDependencies());

            expect(result.success).toBe(true);
            expect(userQuotaCalls).toEqual([{ userId: 7, quotaMb: 512 }]);
        });

        it('should accept --email with a positional quota', async () => {
            const result = await execute(['300'], { email: 'test@test.com' }, createMockDependencies());

            expect(result.success).toBe(true);
            expect(userQuotaCalls).toEqual([{ userId: 7, quotaMb: 300 }]);
        });

        it('should set unlimited as null', async () => {
            const result = await execute(['test@test.com', 'Unlimited'], {}, createMockDependencies());

            expect(result.success).toBe(true);
            expect(result.quotaMB).toBeNull();
            expect(result.message).toBe('Quota set to unlimited for test@test.com');
            expect(userQuotaCalls).toEqual([{ userId: 7, quotaMb: null }]);
        });

        it('should resolve "default" to the configured DEFAULT_QUOTA', async () => {
            const result = await execute(
                ['test@test.com', 'default'],
                {},
                createMockDependencies('test@test.com', 1500),
            );

            expect(result.quotaMB).toBe(1500);
            expect(userQuotaCalls).toEqual([{ userId: 7, quotaMb: 1500 }]);
        });

        it('should set the quota of every user when --all carries the value', async () => {
            const result = await execute([], { all: '1000' }, createMockDependencies());

            expect(result.success).toBe(true);
            expect(result.updatedUsers).toBe(3);
            expect(result.message).toBe('Quota set to 1000 MB for 3 user(s)');
            expect(allQuotaCalls).toEqual([1000]);
            expect(userQuotaCalls).toHaveLength(0);
        });

        it('should set the quota of every user with --all and a positional value', async () => {
            const result = await execute(['default'], { all: true }, createMockDependencies('x@test.com', 800));

            expect(result.success).toBe(true);
            expect(allQuotaCalls).toEqual([800]);
        });

        it('should reject --all together with --email', async () => {
            const result = await execute([], { all: '10', email: 'test@test.com' }, createMockDependencies());

            expect(result.success).toBe(false);
            expect(result.message).toContain('not both');
            expect(allQuotaCalls).toHaveLength(0);
        });

        it('should fail when neither email nor --all is given', async () => {
            const result = await execute([], {}, createMockDependencies());

            expect(result.success).toBe(false);
            expect(result.message).toContain('Missing required argument');
        });

        it('should fail when the quota is missing', async () => {
            const result = await execute(['test@test.com'], {}, createMockDependencies());

            expect(result.success).toBe(false);
            expect(result.message).toContain('Missing quota');
        });

        it('should reject an invalid quota', async () => {
            for (const value of ['abc', '-5', '1.5']) {
                const result = await execute(['test@test.com', value], {}, createMockDependencies());
                expect(result.success).toBe(false);
                expect(result.message).toContain('Invalid quota');
            }
            expect(userQuotaCalls).toHaveLength(0);
        });

        it('should fail when the user does not exist', async () => {
            const result = await execute(['missing@test.com', '100'], {}, createMockDependencies());

            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
            expect(userQuotaCalls).toHaveLength(0);
        });
    });

    describe('runCli', () => {
        function capture() {
            const state = { code: -1 };
            return { state, exitFn: (code: number) => (state.code = code) };
        }

        it('should exit with success after setting a quota', async () => {
            const { state, exitFn } = capture();
            await runCli(['bun', 'cli', 'set-quota', '--all', '200'], createMockDependencies(), exitFn);

            expect(state.code).toBe(0);
            expect(allQuotaCalls).toEqual([200]);
        });

        it('should exit with failure on invalid input', async () => {
            const { state, exitFn } = capture();
            await runCli(['bun', 'cli', 'set-quota'], createMockDependencies(), exitFn);

            expect(state.code).toBe(1);
        });

        it('should exit with failure when a query throws', async () => {
            const deps = createMockDependencies();
            deps.queries.updateAllUsersQuota = async () => {
                throw new Error('database is locked');
            };
            const { state, exitFn } = capture();
            await runCli(['bun', 'cli', 'set-quota', '--all', '200'], deps, exitFn);

            expect(state.code).toBe(1);
        });

        it('should exit with success when help is requested', async () => {
            const { state, exitFn } = capture();
            await runCli(['bun', 'cli', 'set-quota', '--help'], createMockDependencies(), exitFn);

            expect(state.code).toBe(0);
        });
    });

    describe('printHelp', () => {
        it('should print help without errors', () => {
            expect(() => printHelp()).not.toThrow();
        });
    });
});
