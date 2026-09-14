/**
 * Environment helpers - single source of truth for "are we in production?".
 *
 * The codebase signals production via `APP_ENV=prod` (used by routes, templates
 * and Redis config) while the official Docker image also sets `NODE_ENV=production`
 * (Dockerfile). Treating either as production keeps the security guards (default
 * JWT secret check and cookie `Secure` flag) consistent across both the Docker and
 * the non-Docker (systemd / PaaS / bare `bun`) deployment paths.
 */

/** Known in-repo default JWT secrets that must never sign real tokens. */
const KNOWN_DEFAULT_JWT_SECRETS = new Set(['dev_secret_change_me', 'elysia-dev-secret-change-me']);

/** Known in-repo default APP_SECRET values that must never verify real platform JWTs. */
const KNOWN_DEFAULT_APP_SECRETS = new Set(['CHANGE_THIS_TO_A_SECRET']);

/** True when the app is running in a production deployment. */
export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.APP_ENV === 'prod' || env.NODE_ENV === 'production';
}

/** True when the configured JWT secret is missing or a known in-repo default. */
export function isInsecureJwtSecret(secret: string | undefined | null): boolean {
    return !secret || KNOWN_DEFAULT_JWT_SECRETS.has(secret);
}

/**
 * True when APP_SECRET is missing or the shipped default. APP_SECRET is the
 * effective signing/verification key for platform-integration JWTs
 * (`getProviderSecret()` falls back to it, and with an empty PROVIDER_IDS the
 * provider allow-list accepts anything), so a default value lets anyone who
 * reads the open-source `.env.dist` forge platform JWTs — the auth gate for the
 * SSRF/IDOR-sensitive platform callbacks.
 */
export function isInsecureAppSecret(secret: string | undefined | null): boolean {
    return !secret || KNOWN_DEFAULT_APP_SECRETS.has(secret);
}

/**
 * Returns an error message when the deployment must refuse to boot because it is
 * running in production with a missing or default JWT signing secret; otherwise
 * `null`. Pure (no side effects) so it can be unit-tested without booting the server.
 */
export function jwtSecretBootError(env: NodeJS.ProcessEnv = process.env): string | null {
    if (!isProductionEnv(env)) {
        return null;
    }
    const secret = env.API_JWT_SECRET || env.JWT_SECRET || '';
    if (isInsecureJwtSecret(secret)) {
        return (
            '[SECURITY] Refusing to start: production mode (APP_ENV=prod or NODE_ENV=production) but no ' +
            'secure API_JWT_SECRET/JWT_SECRET is set (it is missing or still the in-repo default). ' +
            'Generate a long random string and export it as API_JWT_SECRET before starting the server.'
        );
    }
    return null;
}

/**
 * Returns an error message when the deployment must refuse to boot because it is
 * running in production with a missing or default APP_SECRET; otherwise `null`.
 * APP_SECRET verifies platform-integration JWTs, so the default must be rejected
 * in production just like the JWT signing secret. Pure (no side effects).
 */
export function appSecretBootError(env: NodeJS.ProcessEnv = process.env): string | null {
    if (!isProductionEnv(env)) {
        return null;
    }
    if (isInsecureAppSecret(env.APP_SECRET)) {
        return (
            '[SECURITY] Refusing to start: production mode (APP_ENV=prod or NODE_ENV=production) but no ' +
            'secure APP_SECRET is set (it is missing or still the in-repo default "CHANGE_THIS_TO_A_SECRET"). ' +
            'APP_SECRET verifies platform-integration JWTs; leaving it default lets anyone forge them. ' +
            'Generate a long random string (e.g. `openssl rand -hex 32`) and export it as APP_SECRET.'
        );
    }
    return null;
}

/**
 * Single boot-time secrets check: refuses production startup when EITHER the JWT
 * signing secret OR APP_SECRET is missing/default. Returns the first error found,
 * or `null` when it is safe to boot. This is the guard the server should call.
 */
export function secretsBootError(env: NodeJS.ProcessEnv = process.env): string | null {
    return jwtSecretBootError(env) || appSecretBootError(env);
}
