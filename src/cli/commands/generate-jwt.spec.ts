/**
 * Tests for Generate JWT Command
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { execute, printHelp, runCli, type GenerateJwtDependencies } from './generate-jwt';
import * as jose from 'jose';
import type { Kysely } from 'kysely';

// Mock user for testing
const mockUser = {
    id: 42,
    email: 'user@test.com',
    user_id: 'testuser',
    roles: '["ROLE_USER","ROLE_ADMIN"]',
    password: 'hashed',
    is_active: 1,
    is_lopd_accepted: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    api_token: null,
    external_identifier: null,
};

// Mock dependencies for database user lookup
const mockDeps: GenerateJwtDependencies = {
    findUserByEmail: async (_db: Kysely<any>, email: string) => {
        if (email === 'user@test.com' || email === 'admin@example.com') {
            return { ...mockUser, email };
        }
        return undefined;
    },
};

describe('Generate JWT Command', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Set a test secret
        process.env.API_JWT_SECRET = 'test-secret-key-for-testing-only';
    });

    afterEach(() => {
        // Restore original env
        process.env = { ...originalEnv };
    });

    describe('execute with --raw-sub (legacy mode)', () => {
        it('should generate a valid JWT with subject', async () => {
            const result = await execute(['admin@example.com'], { 'raw-sub': true });

            expect(result.success).toBe(true);
            expect(result.token).toBeDefined();
            expect(typeof result.token).toBe('string');

            // Verify the token structure
            const parts = result.token!.split('.');
            expect(parts.length).toBe(3);
        });

        it('should include sub claim in payload', async () => {
            const result = await execute(['user123'], { 'raw-sub': true });

            expect(result.success).toBe(true);

            // Decode and verify payload
            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.sub).toBe('user123');
        });

        it('should include iat and nbf by default', async () => {
            const result = await execute(['user@test.com'], { 'raw-sub': true });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.iat).toBeDefined();
            expect(payload.nbf).toBeDefined();
            expect(payload.exp).toBeDefined();
        });

        it('should omit iat and nbf when --no-iat is set', async () => {
            const result = await execute(['user@test.com'], { 'no-iat': true, 'raw-sub': true });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.iat).toBeUndefined();
            expect(payload.nbf).toBeUndefined();
            expect(payload.exp).toBeDefined(); // exp is always set
        });

        it('should set custom TTL', async () => {
            const result = await execute(['user@test.com'], { ttl: '86400', 'raw-sub': true });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            const expectedExp = payload.iat + 86400;
            expect(payload.exp).toBe(expectedExp);
        });

        it('should enforce minimum TTL of 1 second', async () => {
            const result = await execute(['user@test.com'], { ttl: '0', 'raw-sub': true });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.exp).toBeGreaterThan(payload.iat);
        });

        it('should set issuer claim', async () => {
            const result = await execute(['user@test.com'], { issuer: 'exelearning', 'raw-sub': true });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.iss).toBe('exelearning');
        });

        it('should set audience claim', async () => {
            const result = await execute(['user@test.com'], { audience: 'api', 'raw-sub': true });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.aud).toBe('api');
        });

        it('should add custom claims with --claim flag', async () => {
            const result = await execute(['user@test.com'], { claim: ['role=admin', 'org=acme'], 'raw-sub': true });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.role).toBe('admin');
            expect(payload.org).toBe('acme');
        });

        it('should add custom claims with -c flag', async () => {
            const result = await execute(['user@test.com'], { c: ['level=5'], 'raw-sub': true });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.level).toBe(5); // Should be parsed as number
        });

        it('should parse boolean claim values', async () => {
            const result = await execute(['user@test.com'], { claim: ['admin=true', 'guest=false'], 'raw-sub': true });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.admin).toBe(true);
            expect(payload.guest).toBe(false);
        });

        it('should parse numeric claim values', async () => {
            const result = await execute(['user@test.com'], { claim: ['quota=100', 'rate=1.5'], 'raw-sub': true });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.quota).toBe(100);
            expect(payload.rate).toBe(1.5);
        });

        it('should keep string claim values as strings', async () => {
            const result = await execute(['user@test.com'], {
                claim: ['name=John Doe', 'note=test123'],
                'raw-sub': true,
            });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.name).toBe('John Doe');
            expect(payload.note).toBe('test123');
        });

        it('should ignore reserved claims', async () => {
            const result = await execute(['user@test.com'], {
                claim: ['exp=9999999999', 'iat=0', 'sub=hacker'],
                'raw-sub': true,
            });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            // Reserved claims should not be overridden
            expect(payload.sub).toBe('user@test.com');
            expect(payload.exp).not.toBe(9999999999);
        });

        it('should ignore invalid claim formats', async () => {
            const result = await execute(['user@test.com'], {
                claim: ['invalid-no-equals', '=nokey', 'valid=value'],
                'raw-sub': true,
            });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.valid).toBe('value');
            expect(payload['invalid-no-equals']).toBeUndefined();
            expect(payload['']).toBeUndefined();
        });

        it('should generate verifiable JWT', async () => {
            const result = await execute(['verifyuser@test.com'], {
                issuer: 'test-issuer',
                audience: 'test-audience',
                'raw-sub': true,
            });

            expect(result.success).toBe(true);

            // Verify the token with jose
            const secretKey = new TextEncoder().encode(process.env.API_JWT_SECRET);
            const { payload } = await jose.jwtVerify(result.token!, secretKey);

            expect(payload.sub).toBe('verifyuser@test.com');
            expect(payload.iss).toBe('test-issuer');
            expect(payload.aud).toBe('test-audience');
        });

        it('should handle claims with equals sign in value', async () => {
            const result = await execute(['user@test.com'], {
                claim: ['query=foo=bar&baz=qux'],
                'raw-sub': true,
            });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.query).toBe('foo=bar&baz=qux');
        });

        it('should combine --claim and -c flags', async () => {
            const result = await execute(['user@test.com'], {
                claim: ['a=1'],
                c: ['b=2'],
                'raw-sub': true,
            });

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.a).toBe(1);
            expect(payload.b).toBe(2);
        });
    });

    describe('execute with user lookup (default mode)', () => {
        it('should look up user by email and use numeric ID as sub', async () => {
            const result = await execute(['user@test.com'], {}, mockDeps);

            expect(result.success).toBe(true);
            expect(result.token).toBeDefined();

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.sub).toBe('42'); // Numeric user ID as string
            expect(payload.email).toBe('user@test.com');
            expect(payload.roles).toEqual(['ROLE_USER', 'ROLE_ADMIN']);
            expect(payload.isGuest).toBe(false);
        });

        it('should fail when user not found', async () => {
            const result = await execute(['unknown@test.com'], {}, mockDeps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('User not found');
        });

        it('should include timing claims', async () => {
            const result = await execute(['user@test.com'], {}, mockDeps);

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            expect(payload.iat).toBeDefined();
            expect(payload.nbf).toBeDefined();
            expect(payload.exp).toBeDefined();
        });

        it('should set custom TTL with user lookup', async () => {
            const result = await execute(['user@test.com'], { ttl: '86400' }, mockDeps);

            expect(result.success).toBe(true);

            const payload = JSON.parse(atob(result.token!.split('.')[1]));
            const expectedExp = payload.iat + 86400;
            expect(payload.exp).toBe(expectedExp);
        });

        it('should generate verifiable JWT with user data', async () => {
            const result = await execute(
                ['user@test.com'],
                {
                    issuer: 'test-issuer',
                    audience: 'test-audience',
                },
                mockDeps,
            );

            expect(result.success).toBe(true);

            // Verify the token with jose
            const secretKey = new TextEncoder().encode(process.env.API_JWT_SECRET);
            const { payload } = await jose.jwtVerify(result.token!, secretKey);

            expect(payload.sub).toBe('42');
            expect(payload.email).toBe('user@test.com');
            expect(payload.iss).toBe('test-issuer');
            expect(payload.aud).toBe('test-audience');
        });
    });

    describe('execute common validation', () => {
        it('should fail when email is missing', async () => {
            const result = await execute([], {});

            expect(result.success).toBe(false);
            expect(result.message).toContain('Missing required argument');
        });

        it('should fail when JWT secret is not configured', async () => {
            delete process.env.API_JWT_SECRET;
            delete process.env.JWT_SECRET;
            delete process.env.APP_SECRET;

            const result = await execute(['user@test.com'], { 'raw-sub': true });

            expect(result.success).toBe(false);
            expect(result.message).toContain('JWT secret not configured');
        });

        it('should use JWT_SECRET as fallback', async () => {
            delete process.env.API_JWT_SECRET;
            process.env.JWT_SECRET = 'fallback-secret';

            const result = await execute(['user@test.com'], { 'raw-sub': true });

            expect(result.success).toBe(true);
            expect(result.token).toBeDefined();
        });

        it('should use APP_SECRET as last fallback', async () => {
            delete process.env.API_JWT_SECRET;
            delete process.env.JWT_SECRET;
            process.env.APP_SECRET = 'app-secret-fallback';

            const result = await execute(['user@test.com'], { 'raw-sub': true });

            expect(result.success).toBe(true);
            expect(result.token).toBeDefined();
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

            expect(output).toContain('jwt:generate');
            expect(output).toContain('--ttl');
            expect(output).toContain('--issuer');
            expect(output).toContain('--claim');
            expect(output).toContain('--no-iat');
        });
    });

    describe('runCli', () => {
        it('should show help when --help flag is passed', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', '--help'], mockDeps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should show help when -h flag is passed', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', '-h'], mockDeps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with error when email is missing', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'jwt:generate'], mockDeps, mockExit);

            expect(exitCode).toBe(1);
        });

        it('should exit with success when generating token with user lookup', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'jwt:generate', 'user@test.com'], mockDeps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with error when user not found', async () => {
            const noUserDeps: GenerateJwtDependencies = {
                findUserByEmail: async () => undefined,
            };
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'jwt:generate', 'unknown@test.com'], noUserDeps, mockExit);

            // Should fail - user not found
            expect(exitCode).toBe(1);
        });

        it('should exit with success when using --raw-sub mode', async () => {
            const noUserDeps: GenerateJwtDependencies = {
                findUserByEmail: async () => undefined,
            };
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'jwt:generate', 'any@test.com', '--raw-sub'], noUserDeps, mockExit);

            // Should succeed - raw-sub mode doesn't need user lookup
            expect(exitCode).toBe(0);
        });
    });
});
