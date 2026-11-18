import { randomBytes } from 'node:crypto';

const MIN_PRODUCTION_SECRET_BYTES = 32;

export const INSECURE_JWT_SECRETS = new Set([
    'dev_secret_change_me',
    'elysia-dev-secret-change-me',
    'ChangeThisToASecretForSQLiteDeployment',
    'ChangeThisToASecretForPostgresDeployment',
    'ChangeThisToASecretForMariaDBDeployment',
    'ChangeThisToASecretForHADeployment',
    'ChangeThisSecretForINTEF',
    'CHANGE_THIS_TO_A_SECRET',
]);

let generatedDevelopmentSecret: string | undefined;
let developmentWarningEmitted = false;

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
    const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
    const appEnv = env.APP_ENV?.trim().toLowerCase();
    return nodeEnv === 'production' || appEnv === 'prod' || appEnv === 'production';
}

export function getConfiguredJwtSecret(env: NodeJS.ProcessEnv = process.env): string | null {
    if (env.API_JWT_SECRET?.trim()) return env.API_JWT_SECRET;
    if (env.JWT_SECRET?.trim()) return env.JWT_SECRET;
    return null;
}

export function validateProductionJwtSecret(secret: string | null): string {
    if (!secret) {
        throw new Error(
            '[SECURITY] API_JWT_SECRET is required in production. Generate a unique random value of at least 32 bytes.',
        );
    }
    if (INSECURE_JWT_SECRETS.has(secret)) {
        throw new Error('[SECURITY] Refusing to use a published JWT secret in production. Rotate API_JWT_SECRET.');
    }
    if (Buffer.byteLength(secret, 'utf8') < MIN_PRODUCTION_SECRET_BYTES) {
        throw new Error('[SECURITY] API_JWT_SECRET must contain at least 32 bytes in production.');
    }
    return secret;
}

export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
    const configuredSecret = getConfiguredJwtSecret(env);
    if (isProductionRuntime(env)) {
        return validateProductionJwtSecret(configuredSecret);
    }
    if (configuredSecret) return configuredSecret;

    generatedDevelopmentSecret ??= randomBytes(32).toString('base64url');
    if (env.NODE_ENV !== 'test' && !developmentWarningEmitted) {
        console.warn(
            '[SECURITY] API_JWT_SECRET is not configured. Using an ephemeral development secret; sessions will not ' +
                'survive a restart.',
        );
        developmentWarningEmitted = true;
    }
    return generatedDevelopmentSecret;
}

/**
 * APP_SECRET signs platform-integration tokens (LMS plugins share it), so rotating it must be coordinated and no
 * minimum length is imposed on existing installs. Production only refuses an empty or published value.
 */
export function getAppSecret(env: NodeJS.ProcessEnv = process.env): string {
    const secret = env.APP_SECRET?.trim() ? env.APP_SECRET : '';
    if (isProductionRuntime(env)) {
        if (!secret) {
            throw new Error('[SECURITY] APP_SECRET is required in production. Generate a unique random value.');
        }
        if (INSECURE_JWT_SECRETS.has(secret)) {
            throw new Error('[SECURITY] Refusing to use a published APP_SECRET in production. Rotate APP_SECRET.');
        }
    }
    return secret;
}

export function resetDevelopmentJwtSecretForTests(): void {
    generatedDevelopmentSecret = undefined;
    developmentWarningEmitted = false;
}
