import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { isProductionEnv, isInsecureJwtSecret, isInsecureAppSecret, jwtSecretBootError, secretsBootError } from './env';

describe('isProductionEnv', () => {
    it('treats APP_ENV=prod as production even when NODE_ENV is unset', () => {
        expect(isProductionEnv({ APP_ENV: 'prod' } as NodeJS.ProcessEnv)).toBe(true);
    });

    it('treats NODE_ENV=production as production', () => {
        expect(isProductionEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
    });

    it('is false in development', () => {
        expect(isProductionEnv({ APP_ENV: 'dev' } as NodeJS.ProcessEnv)).toBe(false);
        expect(isProductionEnv({} as NodeJS.ProcessEnv)).toBe(false);
    });
});

describe('isInsecureJwtSecret', () => {
    it('flags missing and known in-repo default secrets', () => {
        expect(isInsecureJwtSecret('')).toBe(true);
        expect(isInsecureJwtSecret(undefined)).toBe(true);
        expect(isInsecureJwtSecret('dev_secret_change_me')).toBe(true);
        expect(isInsecureJwtSecret('elysia-dev-secret-change-me')).toBe(true);
    });

    it('accepts a strong custom secret', () => {
        expect(isInsecureJwtSecret('b9f1c0c8e3a14e7d8f2a6c0b5e9d1a3c')).toBe(false);
    });
});

describe('jwtSecretBootError', () => {
    it('refuses to boot with the default secret under APP_ENV=prod (NODE_ENV unset)', () => {
        const env = { APP_ENV: 'prod', API_JWT_SECRET: 'dev_secret_change_me' } as NodeJS.ProcessEnv;
        expect(jwtSecretBootError(env)).not.toBeNull();
    });

    it('refuses to boot with a missing secret under APP_ENV=prod', () => {
        expect(jwtSecretBootError({ APP_ENV: 'prod' } as NodeJS.ProcessEnv)).not.toBeNull();
    });

    it('still fires for the Docker path (NODE_ENV=production)', () => {
        const env = { NODE_ENV: 'production', API_JWT_SECRET: 'dev_secret_change_me' } as NodeJS.ProcessEnv;
        expect(jwtSecretBootError(env)).not.toBeNull();
    });

    it('allows boot in production with a strong secret', () => {
        const env = { APP_ENV: 'prod', API_JWT_SECRET: 'b9f1c0c8e3a14e7d8f2a6c0b5e9d1a3c' } as NodeJS.ProcessEnv;
        expect(jwtSecretBootError(env)).toBeNull();
    });

    it('does not block non-production boot even with the default secret', () => {
        const env = { APP_ENV: 'dev', API_JWT_SECRET: 'dev_secret_change_me' } as NodeJS.ProcessEnv;
        expect(jwtSecretBootError(env)).toBeNull();
    });
});

describe('isInsecureAppSecret', () => {
    it('flags missing and the shipped default APP_SECRET', () => {
        expect(isInsecureAppSecret('')).toBe(true);
        expect(isInsecureAppSecret(undefined)).toBe(true);
        expect(isInsecureAppSecret('CHANGE_THIS_TO_A_SECRET')).toBe(true);
    });

    it('accepts a strong custom APP_SECRET', () => {
        expect(isInsecureAppSecret('b9f1c0c8e3a14e7d8f2a6c0b5e9d1a3c')).toBe(false);
    });
});

describe('secretsBootError', () => {
    const STRONG = 'b9f1c0c8e3a14e7d8f2a6c0b5e9d1a3c';

    it('refuses to boot in production with a strong JWT secret but the default APP_SECRET', () => {
        // APP_SECRET is the effective platform-JWT verification key (getProviderSecret
        // fallback); a default value lets anyone forge platform JWTs even when the
        // API JWT secret is set. This is the audit gap secretsBootError closes.
        const env = {
            APP_ENV: 'prod',
            API_JWT_SECRET: STRONG,
            APP_SECRET: 'CHANGE_THIS_TO_A_SECRET',
        } as NodeJS.ProcessEnv;
        const err = secretsBootError(env);
        expect(err).not.toBeNull();
        expect(err).toContain('APP_SECRET');
    });

    it('refuses to boot in production when APP_SECRET is missing', () => {
        const env = { APP_ENV: 'prod', API_JWT_SECRET: STRONG } as NodeJS.ProcessEnv;
        expect(secretsBootError(env)).not.toBeNull();
    });

    it('still refuses when the JWT secret is insecure (surfaces the JWT error first)', () => {
        const env = {
            APP_ENV: 'prod',
            API_JWT_SECRET: 'dev_secret_change_me',
            APP_SECRET: STRONG,
        } as NodeJS.ProcessEnv;
        expect(secretsBootError(env)).not.toBeNull();
    });

    it('allows boot in production when both secrets are strong', () => {
        const env = { APP_ENV: 'prod', API_JWT_SECRET: STRONG, APP_SECRET: STRONG } as NodeJS.ProcessEnv;
        expect(secretsBootError(env)).toBeNull();
    });

    it('does not block a development boot even with both defaults', () => {
        const env = {
            APP_ENV: 'dev',
            API_JWT_SECRET: 'dev_secret_change_me',
            APP_SECRET: 'CHANGE_THIS_TO_A_SECRET',
        } as NodeJS.ProcessEnv;
        expect(secretsBootError(env)).toBeNull();
    });

    // Regression guard: a fresh clone runs `cp .env.dist .env && make up-local`.
    // If .env.dist ever regresses to APP_ENV=prod without shipping real secrets,
    // that first-run boot would refuse. Assert the shipped template boots as-is.
    it('does not refuse boot with the values shipped in .env.dist', () => {
        const raw = fs.readFileSync(path.join(process.cwd(), '.env.dist'), 'utf-8');
        const env: Record<string, string> = {};
        for (const line of raw.split('\n')) {
            const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
            if (m) {
                env[m[1]] = m[2];
            }
        }
        expect(secretsBootError(env as NodeJS.ProcessEnv)).toBeNull();
    });
});
