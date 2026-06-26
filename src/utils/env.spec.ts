import { describe, it, expect } from 'bun:test';
import { isProductionEnv, isInsecureJwtSecret, jwtSecretBootError } from './env';

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
