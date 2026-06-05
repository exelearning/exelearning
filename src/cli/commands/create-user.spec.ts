/**
 * Tests for Create User Command
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { execute, printHelp, runCli, type CreateUserDependencies } from './create-user';

describe('Create User Command', () => {
    let createUserCalls: any[];
    let mockUserId: number;

    // Create mock dependencies for each test
    function createMockDependencies(): CreateUserDependencies {
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
                    return undefined;
                },
                createUser: async (_db: any, data: any) => {
                    createUserCalls.push(data);
                    return {
                        id: mockUserId++,
                        ...data,
                    };
                },
            },
        };
    }

    beforeEach(() => {
        createUserCalls = [];
        mockUserId = 100;
    });

    describe('execute', () => {
        it('should fail when email is missing', async () => {
            const deps = createMockDependencies();
            const result = await execute([], {}, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Missing required arguments');
        });

        it('should fail when password is missing', async () => {
            const deps = createMockDependencies();
            const result = await execute(['test@test.com'], {}, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Missing required arguments');
        });

        it('should succeed with only email and password', async () => {
            const deps = createMockDependencies();
            const result = await execute(['test@test.com', 'password123'], {}, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('created successfully');
        });

        it('should fail when user already exists', async () => {
            const deps = createMockDependencies();
            const result = await execute(['existing@test.com', 'password'], {}, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('already exists');
        });

        it('should succeed with --no-fail when user exists', async () => {
            const deps = createMockDependencies();
            const result = await execute(
                ['existing@test.com', 'password'],
                {
                    'no-fail': true,
                },
                deps,
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('--no-fail mode');
            expect(result.userId).toBe(1);
        });

        it('should create new user successfully', async () => {
            const deps = createMockDependencies();
            const result = await execute(['new@test.com', 'password123'], {}, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('created successfully');
            expect(result.userId).toBeDefined();
        });

        it('should hash password with bcrypt', async () => {
            const deps = createMockDependencies();
            await execute(['bcrypt@test.com', 'mypassword'], {}, deps);

            expect(createUserCalls.length).toBeGreaterThan(0);
            const call = createUserCalls[createUserCalls.length - 1];
            // Password should be hashed, not plaintext
            expect(call.password).not.toBe('mypassword');
            // Bcrypt hashes start with $2
            expect(call.password).toMatch(/^\$2[aby]?\$/);
        });

        it('should use default ROLE_USER role', async () => {
            const deps = createMockDependencies();
            await execute(['role@test.com', 'pass'], {}, deps);

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.roles).toContain('ROLE_USER');
        });

        it('should accept custom roles', async () => {
            const deps = createMockDependencies();
            await execute(
                ['admin@new.com', 'pass'],
                {
                    roles: 'ROLE_USER,ROLE_ADMIN',
                },
                deps,
            );

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.roles).toContain('ROLE_USER');
            expect(call.roles).toContain('ROLE_ADMIN');
        });

        it('should normalize role names to uppercase', async () => {
            const deps = createMockDependencies();
            await execute(
                ['lower@test.com', 'pass'],
                {
                    roles: 'role_user,role_editor',
                },
                deps,
            );

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.roles).toContain('ROLE_USER');
            expect(call.roles).toContain('ROLE_EDITOR');
        });

        it('should use default quota of 4096 MB', async () => {
            const deps = createMockDependencies();
            await execute(['quota@test.com', 'pass'], {}, deps);

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.quota_mb).toBe(4096);
        });

        it('should accept custom quota', async () => {
            const deps = createMockDependencies();
            await execute(
                ['customquota@test.com', 'pass'],
                {
                    quota: '1024',
                },
                deps,
            );

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.quota_mb).toBe(1024);
        });

        it('should set is_lopd_accepted to 1', async () => {
            const deps = createMockDependencies();
            await execute(['lopd@test.com', 'pass'], {}, deps);

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.is_lopd_accepted).toBe(1);
        });

        it('should set is_active to 1', async () => {
            const deps = createMockDependencies();
            await execute(['active@test.com', 'pass'], {}, deps);

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.is_active).toBe(1);
        });

        it('should set email correctly and not set user_id for local users', async () => {
            const deps = createMockDependencies();
            await execute(['correct@test.com', 'pass'], {}, deps);

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.email).toBe('correct@test.com');
            // user_id should not be set for local users (null)
            expect(call.user_id).toBeUndefined();
        });

        it('should return userId in success result', async () => {
            const deps = createMockDependencies();
            const result = await execute(['withid@test.com', 'pass'], {}, deps);

            expect(result.success).toBe(true);
            expect(result.userId).toBeDefined();
            expect(typeof result.userId).toBe('number');
        });

        // Flag-based argument tests (docker-compose format)
        it('should accept --email and --password flags', async () => {
            const deps = createMockDependencies();
            const result = await execute(
                [],
                {
                    email: 'flag@test.com',
                    password: 'flagpass',
                },
                deps,
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('created successfully');

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.email).toBe('flag@test.com');
            // user_id should not be set for local users
            expect(call.user_id).toBeUndefined();
        });

        it('should prefer flags over positional arguments', async () => {
            const deps = createMockDependencies();
            const result = await execute(
                ['positional@test.com', 'positionalpass'],
                {
                    email: 'flag@test.com',
                    password: 'flagpass',
                },
                deps,
            );

            expect(result.success).toBe(true);

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.email).toBe('flag@test.com');
        });

        it('should allow mixed flags and positional arguments', async () => {
            const deps = createMockDependencies();
            // --email flag, positional password
            const result = await execute(
                ['ignored', 'mixedpass'],
                {
                    email: 'mixed@test.com',
                },
                deps,
            );

            expect(result.success).toBe(true);

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.email).toBe('mixed@test.com');
        });

        it('should work with --no-fail flag in flag-based format', async () => {
            const deps = createMockDependencies();
            const result = await execute(
                [],
                {
                    email: 'existing@test.com',
                    password: 'pass',
                    'no-fail': true,
                },
                deps,
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('--no-fail mode');
        });

        it('should handle multiple roles separated by comma', async () => {
            const deps = createMockDependencies();
            await execute(
                ['multi@test.com', 'pass'],
                {
                    roles: 'ROLE_USER, ROLE_ADMIN, ROLE_EDITOR',
                },
                deps,
            );

            const call = createUserCalls[createUserCalls.length - 1];
            expect(call.roles).toContain('ROLE_USER');
            expect(call.roles).toContain('ROLE_ADMIN');
            expect(call.roles).toContain('ROLE_EDITOR');
        });

        it('should trim whitespace from roles', async () => {
            const deps = createMockDependencies();
            await execute(
                ['trim@test.com', 'pass'],
                {
                    roles: '  ROLE_USER  ,  ROLE_ADMIN  ',
                },
                deps,
            );

            const call = createUserCalls[createUserCalls.length - 1];
            // Should be trimmed
            expect(call.roles).toContain('ROLE_USER');
            expect(call.roles).toContain('ROLE_ADMIN');
        });
    });

    describe('printHelp', () => {
        it('should not throw when called', () => {
            // Capture console output
            const originalLog = console.log;
            let output = '';
            console.log = (msg: string) => {
                output += msg;
            };

            expect(() => printHelp()).not.toThrow();

            // Restore
            console.log = originalLog;

            // Should contain key sections
            expect(output).toContain('create-user');
            expect(output).toContain('email');
            expect(output).toContain('password');
            expect(output).toContain('--no-fail');
            expect(output).toContain('--roles');
            expect(output).toContain('--quota');
        });
    });

    describe('runCli', () => {
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

        it('should exit with error when missing required arguments', async () => {
            const deps = createMockDependencies();
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'create-user'], deps, mockExit);

            expect(exitCode).toBe(1);
        });

        it('should exit with success when creating user', async () => {
            const deps = createMockDependencies();
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'create-user', 'cli@test.com', 'pass123'], deps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should handle errors gracefully', async () => {
            const errorDeps: CreateUserDependencies = {
                db: {} as any,
                queries: {
                    findUserByEmail: async () => {
                        throw new Error('DB error');
                    },
                    createUser: async () => ({ id: 1, email: '', username: '', roles: '[]' }),
                },
            };
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'create-user', 'error@test.com', 'pass'], errorDeps, mockExit);

            expect(exitCode).toBe(1);
        });

        it('should handle non-Error throws', async () => {
            const errorDeps: CreateUserDependencies = {
                db: {} as any,
                queries: {
                    findUserByEmail: async () => {
                        throw 'String error';
                    },
                    createUser: async () => ({ id: 1, email: '', username: '', roles: '[]' }),
                },
            };
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'create-user', 'str@test.com', 'pass'], errorDeps, mockExit);

            expect(exitCode).toBe(1);
        });
    });
});
