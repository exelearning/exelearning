import { afterEach, describe, expect, it } from 'bun:test';
import {
    getAppSecret,
    getConfiguredJwtSecret,
    getJwtSecret,
    INSECURE_JWT_SECRETS,
    isProductionRuntime,
    resetDevelopmentJwtSecretForTests,
    validateProductionJwtSecret,
} from './jwt-secret';

const SECURE_TEST_SECRET = 'secure-test-secret-with-at-least-thirty-two-bytes';

afterEach(() => resetDevelopmentJwtSecretForTests());

describe('JWT secret configuration', () => {
    it('prefers API_JWT_SECRET over the legacy JWT_SECRET variable', () => {
        const env = { API_JWT_SECRET: 'api-secret', JWT_SECRET: 'legacy-secret' } as NodeJS.ProcessEnv;
        expect(getConfiguredJwtSecret(env)).toBe('api-secret');
    });

    it('uses JWT_SECRET when API_JWT_SECRET is absent', () => {
        const env = { JWT_SECRET: 'legacy-secret' } as NodeJS.ProcessEnv;
        expect(getConfiguredJwtSecret(env)).toBe('legacy-secret');
    });

    it('treats empty values as unconfigured and falls back to the legacy variable', () => {
        expect(getConfiguredJwtSecret({ API_JWT_SECRET: '   ' } as NodeJS.ProcessEnv)).toBeNull();
        expect(
            getConfiguredJwtSecret({ API_JWT_SECRET: '   ', JWT_SECRET: 'legacy-secret' } as NodeJS.ProcessEnv),
        ).toBe('legacy-secret');
    });

    it('recognizes both NODE_ENV and APP_ENV production modes', () => {
        expect(isProductionRuntime({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
        expect(isProductionRuntime({ APP_ENV: 'prod' } as NodeJS.ProcessEnv)).toBe(true);
        expect(isProductionRuntime({ APP_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
        expect(isProductionRuntime({ NODE_ENV: 'test', APP_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(false);
    });

    it('generates one process-local secret when development has no configured value', () => {
        const env = { NODE_ENV: 'test', APP_ENV: 'test' } as NodeJS.ProcessEnv;
        const first = getJwtSecret(env);
        const second = getJwtSecret(env);

        expect(first).toBe(second);
        expect(Buffer.byteLength(first, 'utf8')).toBeGreaterThanOrEqual(32);
        expect(INSECURE_JWT_SECRETS.has(first)).toBe(false);
    });

    it('rejects a missing production secret', () => {
        expect(() => getJwtSecret({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(
            'API_JWT_SECRET is required',
        );
    });

    it('rejects every published secret in production', () => {
        for (const secret of INSECURE_JWT_SECRETS) {
            expect(() => validateProductionJwtSecret(secret)).toThrow('published JWT secret');
        }
    });

    it('rejects production secrets shorter than 32 bytes', () => {
        expect(() => validateProductionJwtSecret('too-short')).toThrow('at least 32 bytes');
    });

    it('accepts a sufficiently long explicit production secret', () => {
        const env = { APP_ENV: 'prod', API_JWT_SECRET: SECURE_TEST_SECRET } as NodeJS.ProcessEnv;
        expect(getJwtSecret(env)).toBe(SECURE_TEST_SECRET);
    });

    it('returns APP_SECRET as configured outside production, including empty', () => {
        expect(getAppSecret({ NODE_ENV: 'test', APP_SECRET: 'short' } as NodeJS.ProcessEnv)).toBe('short');
        expect(getAppSecret({ NODE_ENV: 'test', APP_SECRET: '  ' } as NodeJS.ProcessEnv)).toBe('');
        expect(getAppSecret({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe('');
    });

    it('rejects an empty or published APP_SECRET in production', () => {
        expect(() => getAppSecret({ APP_ENV: 'prod' } as NodeJS.ProcessEnv)).toThrow('APP_SECRET is required');
        expect(() => getAppSecret({ APP_ENV: 'prod', APP_SECRET: ' ' } as NodeJS.ProcessEnv)).toThrow(
            'APP_SECRET is required',
        );
        for (const secret of INSECURE_JWT_SECRETS) {
            expect(() => getAppSecret({ NODE_ENV: 'production', APP_SECRET: secret } as NodeJS.ProcessEnv)).toThrow(
                'published APP_SECRET',
            );
        }
    });

    it('accepts an existing short APP_SECRET in production so platform integrations keep working', () => {
        expect(getAppSecret({ APP_ENV: 'prod', APP_SECRET: 'existing-lms-secret' } as NodeJS.ProcessEnv)).toBe(
            'existing-lms-secret',
        );
    });
});
