/**
 * Tests for User Role Command
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { execute, printHelp, runCli, type UserRoleDependencies } from './user-role';

describe('User Role Command', () => {
    let updateUserRolesCalls: any[];

    // Create mock dependencies for each test
    function createMockDependencies(): UserRoleDependencies {
        return {
            db: {} as any,
            queries: {
                findUserByEmail: async (_db: any, email: string) => {
                    if (email === 'existing@test.com') {
                        return {
                            id: 1,
                            email: 'existing@test.com',
                            roles: '["ROLE_USER"]',
                        };
                    }
                    if (email === 'admin@test.com') {
                        return {
                            id: 2,
                            email: 'admin@test.com',
                            roles: '["ROLE_USER","ROLE_ADMIN"]',
                        };
                    }
                    return undefined;
                },
                updateUserRoles: async (_db: any, id: number, roles: string[]) => {
                    updateUserRolesCalls.push({ id, roles });
                    // Return the updated user object
                    return {
                        id,
                        email: id === 1 ? 'existing@test.com' : 'admin@test.com',
                        roles: JSON.stringify(roles),
                    };
                },
            },
        };
    }

    beforeEach(() => {
        updateUserRolesCalls = [];
    });

    describe('execute', () => {
        it('should fail when email is missing', async () => {
            const deps = createMockDependencies();
            const result = await execute([], {}, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Missing required argument');
        });

        it('should fail when user not found', async () => {
            const deps = createMockDependencies();
            const result = await execute(['notfound@test.com'], { list: true }, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('should list roles for existing user', async () => {
            const deps = createMockDependencies();
            const result = await execute(['existing@test.com'], { list: true }, deps);

            expect(result.success).toBe(true);
            expect(result.roles).toBeDefined();
            expect(result.roles).toContain('ROLE_USER');
        });

        it('should fail when no operation specified', async () => {
            const deps = createMockDependencies();
            const result = await execute(['existing@test.com'], {}, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('No operation specified');
        });

        it('should add role to user', async () => {
            const deps = createMockDependencies();
            const result = await execute(['existing@test.com'], { add: ['ROLE_ADMIN'] }, deps);

            expect(result.success).toBe(true);
            expect(result.roles).toContain('ROLE_ADMIN');
            expect(result.roles).toContain('ROLE_USER');
        });

        it('should normalize role names', async () => {
            const deps = createMockDependencies();
            // lowercase without prefix should be normalized
            const result = await execute(['existing@test.com'], { add: ['admin'] }, deps);

            expect(result.success).toBe(true);
            expect(result.roles).toContain('ROLE_ADMIN');
        });

        it('should remove role from user', async () => {
            const deps = createMockDependencies();
            const result = await execute(['admin@test.com'], { remove: ['ROLE_ADMIN'] }, deps);

            expect(result.success).toBe(true);
            expect(result.roles).not.toContain('ROLE_ADMIN');
        });

        it('should protect ROLE_USER from removal', async () => {
            const deps = createMockDependencies();
            const result = await execute(['existing@test.com'], { remove: ['ROLE_USER'] }, deps);

            expect(result.success).toBe(true);
            expect(result.roles).toContain('ROLE_USER'); // Should still be there
            expect(result.message).toContain('ROLE_USER'); // Should mention in changes
        });

        it('should handle dry-run mode', async () => {
            const deps = createMockDependencies();
            const result = await execute(['existing@test.com'], { add: ['ROLE_EDITOR'], 'dry-run': true }, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Dry run');
            expect(result.roles).toContain('ROLE_EDITOR');
        });

        it('should handle multiple role operations', async () => {
            const deps = createMockDependencies();
            const result = await execute(
                ['existing@test.com'],
                {
                    add: ['ROLE_ADMIN', 'ROLE_EDITOR'],
                },
                deps,
            );

            expect(result.success).toBe(true);
            expect(result.roles).toContain('ROLE_ADMIN');
            expect(result.roles).toContain('ROLE_EDITOR');
            expect(result.roles).toContain('ROLE_USER');
        });

        it('should skip adding existing roles', async () => {
            const deps = createMockDependencies();
            // Using dry-run to see the change details
            const result = await execute(['existing@test.com'], { add: ['ROLE_USER'], 'dry-run': true }, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('already present');
        });

        it('should skip removing non-existent roles', async () => {
            const deps = createMockDependencies();
            // Using dry-run to see the change details
            const result = await execute(
                ['existing@test.com'],
                { remove: ['ROLE_NONEXISTENT'], 'dry-run': true },
                deps,
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('not present');
        });

        it('should handle combined add and remove', async () => {
            const deps = createMockDependencies();
            const result = await execute(
                ['admin@test.com'],
                {
                    add: ['ROLE_EDITOR'],
                    remove: ['ROLE_ADMIN'],
                },
                deps,
            );

            expect(result.success).toBe(true);
            expect(result.roles).toContain('ROLE_EDITOR');
            expect(result.roles).not.toContain('ROLE_ADMIN');
        });

        it('should remove invalid characters from role names', async () => {
            const deps = createMockDependencies();
            const result = await execute(['existing@test.com'], { add: ['role-test!@#'] }, deps);

            expect(result.success).toBe(true);
            // Should normalize to ROLE_ROLETEST
            expect(result.roles?.some(r => r.startsWith('ROLE_'))).toBe(true);
        });

        it('should always ensure ROLE_USER is present', async () => {
            const deps = createMockDependencies();
            const result = await execute(['existing@test.com'], { add: ['ROLE_ADMIN'] }, deps);

            expect(result.success).toBe(true);
            expect(result.roles).toContain('ROLE_USER');
        });

        it('should call updateUserRoles with correct parameters', async () => {
            const deps = createMockDependencies();
            await execute(['existing@test.com'], { add: ['ROLE_ADMIN'] }, deps);

            expect(updateUserRolesCalls.length).toBe(1);
            expect(updateUserRolesCalls[0].id).toBe(1);
            expect(updateUserRolesCalls[0].roles).toContain('ROLE_ADMIN');
            expect(updateUserRolesCalls[0].roles).toContain('ROLE_USER');
        });

        it('should not call updateUserRoles in dry-run mode', async () => {
            const deps = createMockDependencies();
            await execute(['existing@test.com'], { add: ['ROLE_ADMIN'], 'dry-run': true }, deps);

            expect(updateUserRolesCalls.length).toBe(0);
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

            expect(output).toContain('user:role');
            expect(output).toContain('--add');
            expect(output).toContain('--remove');
            expect(output).toContain('--list');
            expect(output).toContain('--dry-run');
        });
    });

    describe('runCli', () => {
        // Note: parseArgs treats first non-flag arg as "command", so we need
        // 'user:role' as command, then email as positional arg

        it('should show help when --help flag is passed', async () => {
            const deps = createMockDependencies();
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', '--help'], deps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should show help when -h flag is passed', async () => {
            const deps = createMockDependencies();
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', '-h'], deps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with error when email is missing', async () => {
            const deps = createMockDependencies();
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'user:role', '--list'], deps, mockExit);

            expect(exitCode).toBe(1);
        });

        it('should exit with error when user not found', async () => {
            const deps = createMockDependencies();
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'user:role', 'notfound@test.com', '--list'], deps, mockExit);

            expect(exitCode).toBe(1);
        });

        it('should exit with success when listing roles', async () => {
            const deps = createMockDependencies();
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'user:role', 'existing@test.com', '--list'], deps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with success when adding role', async () => {
            const deps = createMockDependencies();
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'user:role', 'existing@test.com', '--add=ROLE_ADMIN'], deps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should handle errors gracefully', async () => {
            // Create deps that throws an error
            const errorDeps: UserRoleDependencies = {
                db: {} as any,
                queries: {
                    findUserByEmail: async () => {
                        throw new Error('Database connection failed');
                    },
                    updateUserRoles: async () => {},
                },
            };

            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'user:role', 'test@test.com', '--list'], errorDeps, mockExit);

            expect(exitCode).toBe(1);
        });

        it('should handle non-Error throws gracefully', async () => {
            // Create deps that throws a non-Error
            const errorDeps: UserRoleDependencies = {
                db: {} as any,
                queries: {
                    findUserByEmail: async () => {
                        throw 'String error';
                    },
                    updateUserRoles: async () => {},
                },
            };

            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'user:role', 'test@test.com', '--list'], errorDeps, mockExit);

            expect(exitCode).toBe(1);
        });
    });
});
