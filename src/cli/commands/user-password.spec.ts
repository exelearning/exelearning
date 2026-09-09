/**
 * Tests for User Password Command
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as bcrypt from 'bcryptjs';
import { execute, printHelp, runCli, type UserPasswordDependencies } from './user-password';
import { PromptAbortedError } from '../utils/prompt';

const USERS: Record<string, Record<string, unknown>> = {
    'local@test.com': { id: 1, email: 'local@test.com', roles: '["ROLE_USER"]', user_id: null },
    'admin@test.com': {
        id: 2,
        email: 'admin@test.com',
        roles: '["ROLE_USER","ROLE_ADMIN"]',
        user_id: null,
    },
    'cas@test.com': { id: 3, email: 'cas@test.com', roles: '["ROLE_USER"]', user_id: 'cas:jdoe' },
    'oidc@test.com': { id: 4, email: 'oidc@test.com', roles: '["ROLE_USER"]', user_id: 'oidc:abc-123' },
    'guest@test.com': { id: 5, email: 'guest@test.com', roles: '["ROLE_GUEST"]', user_id: null },
    'saml@test.com': {
        id: 6,
        email: 'saml@test.com',
        roles: '["ROLE_USER"]',
        user_id: null,
        external_identifier: 'saml:abc-123',
    },
};

describe('User Password Command', () => {
    let updateCalls: Array<{ id: number; password: string }>;
    let prompts: string[];

    /**
     * @param answers - the values promptHidden returns, in order
     */
    function createMockDependencies(
        answers: string[] = ['new-secret', 'new-secret'],
        options: { interactive?: boolean; stdin?: string; updateReturnsNothing?: boolean } = {},
    ): UserPasswordDependencies {
        const queue = [...answers];

        return {
            db: {} as any,
            queries: {
                findUserByEmail: async (_db: any, email: string) => USERS[email] as any,
                updateUserPassword: async (_db: any, id: number, password: string) => {
                    updateCalls.push({ id, password });
                    if (options.updateReturnsNothing) return undefined;
                    return { id, password } as any;
                },
            },
            prompt: {
                promptHidden: async (question: string) => {
                    prompts.push(question);
                    return queue.shift() ?? '';
                },
                readSecretFromStdin: async () => options.stdin ?? '',
                isInteractive: () => options.interactive ?? true,
            },
        };
    }

    beforeEach(() => {
        updateCalls = [];
        prompts = [];
    });

    describe('execute', () => {
        it('should fail when email is missing', async () => {
            const result = await execute([], {}, createMockDependencies());

            expect(result.success).toBe(false);
            expect(result.message).toContain('Missing required argument');
            expect(updateCalls).toHaveLength(0);
        });

        it('should fail when the user does not exist', async () => {
            const result = await execute(['nobody@test.com'], {}, createMockDependencies());

            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
            expect(updateCalls).toHaveLength(0);
        });

        it('should change the password of a local user', async () => {
            const result = await execute(['local@test.com'], {}, createMockDependencies());

            expect(result.success).toBe(true);
            expect(result.message).toContain('Password updated for local@test.com');
            expect(result.userId).toBe(1);
            expect(updateCalls).toHaveLength(1);
            expect(updateCalls[0].id).toBe(1);
        });

        it('should change the password of a local admin', async () => {
            const result = await execute(['admin@test.com'], {}, createMockDependencies());

            expect(result.success).toBe(true);
            expect(updateCalls[0].id).toBe(2);
        });

        it('should store a bcrypt hash, never the plaintext', async () => {
            await execute(['local@test.com'], {}, createMockDependencies());

            const stored = updateCalls[0].password;
            expect(stored).not.toBe('new-secret');
            expect(stored).toMatch(/^\$2[aby]\$10\$/);
            expect(await bcrypt.compare('new-secret', stored)).toBe(true);
        });

        it('should ask for the password twice', async () => {
            await execute(['local@test.com'], {}, createMockDependencies());

            expect(prompts).toEqual(['New password: ', 'Confirm new password: ']);
        });

        it('should reject a guest account', async () => {
            const result = await execute(['guest@test.com'], {}, createMockDependencies());

            expect(result.success).toBe(false);
            expect(result.message).toContain('external authentication provider');
            expect(updateCalls).toHaveLength(0);
        });

        it('should reject a CAS account', async () => {
            const result = await execute(['cas@test.com'], {}, createMockDependencies());

            expect(result.success).toBe(false);
            expect(result.message).toContain('cas@test.com');
            expect(updateCalls).toHaveLength(0);
        });

        it('should reject an OIDC account', async () => {
            const result = await execute(['oidc@test.com'], {}, createMockDependencies());

            expect(result.success).toBe(false);
            expect(updateCalls).toHaveLength(0);
        });

        it('should reject an account with an external identifier', async () => {
            const result = await execute(['saml@test.com'], {}, createMockDependencies());

            expect(result.success).toBe(false);
            expect(updateCalls).toHaveLength(0);
        });

        it('should refuse an external account before asking for a password', async () => {
            await execute(['cas@test.com'], {}, createMockDependencies());

            expect(prompts).toHaveLength(0);
        });

        it('should fail when the confirmation does not match', async () => {
            const result = await execute(
                ['local@test.com'],
                {},
                createMockDependencies(['new-secret', 'different-secret']),
            );

            expect(result.success).toBe(false);
            expect(result.message).toContain('Passwords do not match');
            expect(updateCalls).toHaveLength(0);
        });

        it('should fail on an empty password', async () => {
            const result = await execute(['local@test.com'], {}, createMockDependencies(['', '']));

            expect(result.success).toBe(false);
            expect(result.message).toContain('cannot be empty');
            expect(updateCalls).toHaveLength(0);
        });

        it('should fail on a too-short password', async () => {
            const result = await execute(['local@test.com'], {}, createMockDependencies(['ab', 'ab']));

            expect(result.success).toBe(false);
            expect(result.message).toContain('at least');
            expect(updateCalls).toHaveLength(0);
        });

        it('should report a failed database update', async () => {
            const result = await execute(
                ['local@test.com'],
                {},
                createMockDependencies(undefined, { updateReturnsNothing: true }),
            );

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to update the password');
        });

        it('should never include the password in the result message', async () => {
            const result = await execute(['local@test.com'], {}, createMockDependencies());

            expect(result.message).not.toContain('new-secret');
        });

        describe('--password-stdin', () => {
            it('should read the password from stdin without prompting', async () => {
                const deps = createMockDependencies([], { interactive: false, stdin: 'piped-secret' });
                const result = await execute(['local@test.com'], { 'password-stdin': true }, deps);

                expect(result.success).toBe(true);
                expect(prompts).toHaveLength(0);
                expect(await bcrypt.compare('piped-secret', updateCalls[0].password)).toBe(true);
            });

            it('should validate a password read from stdin', async () => {
                const deps = createMockDependencies([], { interactive: false, stdin: '' });
                const result = await execute(['local@test.com'], { 'password-stdin': true }, deps);

                expect(result.success).toBe(false);
                expect(updateCalls).toHaveLength(0);
            });

            it('should still reject external accounts', async () => {
                const deps = createMockDependencies([], { interactive: false, stdin: 'piped-secret' });
                const result = await execute(['cas@test.com'], { 'password-stdin': true }, deps);

                expect(result.success).toBe(false);
                expect(updateCalls).toHaveLength(0);
            });
        });

        it('should fail with guidance when there is no terminal to prompt on', async () => {
            const deps = createMockDependencies([], { interactive: false });
            const result = await execute(['local@test.com'], {}, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('--password-stdin');
            expect(updateCalls).toHaveLength(0);
        });
    });

    describe('printHelp', () => {
        it('should print usage without suggesting a --password argument', () => {
            const logs: string[] = [];
            const originalLog = console.log;
            console.log = (message: string) => logs.push(message);

            try {
                printHelp();
            } finally {
                console.log = originalLog;
            }

            const output = logs.join('\n');
            expect(output).toContain('user:password');
            expect(output).toContain('bun cli user:password user@example.com');
            expect(output).not.toContain('--password ');
        });
    });

    describe('runCli', () => {
        it('should exit 0 on success', async () => {
            const codes: number[] = [];
            await runCli(['bun', 'cli', 'user:password', 'local@test.com'], createMockDependencies(), code =>
                codes.push(code),
            );

            expect(codes).toEqual([0]);
        });

        it('should exit 1 on failure', async () => {
            const codes: number[] = [];
            await runCli(['bun', 'cli', 'user:password', 'cas@test.com'], createMockDependencies(), code =>
                codes.push(code),
            );

            expect(codes).toEqual([1]);
        });

        it('should exit 0 for --help', async () => {
            const codes: number[] = [];
            const originalLog = console.log;
            console.log = () => undefined;

            try {
                await runCli(['bun', 'cli', 'user:password', '--help'], createMockDependencies(), code =>
                    codes.push(code),
                );
            } finally {
                console.log = originalLog;
            }

            expect(codes).toEqual([0]);
        });

        it('should exit 1 and report an abort when the user presses Ctrl+C', async () => {
            const codes: number[] = [];
            const errors: string[] = [];
            const originalError = console.error;
            console.error = (message: string) => errors.push(message);

            const deps = createMockDependencies();
            deps.prompt.promptHidden = async () => {
                throw new PromptAbortedError();
            };

            try {
                await runCli(['bun', 'cli', 'user:password', 'local@test.com'], deps, code => codes.push(code));
            } finally {
                console.error = originalError;
            }

            expect(codes).toEqual([1]);
            expect(errors.join(' ')).toContain('Aborted');
            expect(updateCalls).toHaveLength(0);
        });

        it('should exit 1 on an unexpected error', async () => {
            const codes: number[] = [];
            const originalError = console.error;
            console.error = () => undefined;

            const deps = createMockDependencies();
            deps.queries.findUserByEmail = async () => {
                throw new Error('database is down');
            };

            try {
                await runCli(['bun', 'cli', 'user:password', 'local@test.com'], deps, code => codes.push(code));
            } finally {
                console.error = originalError;
            }

            expect(codes).toEqual([1]);
        });
    });
});
