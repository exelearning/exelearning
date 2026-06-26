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

/** True when the app is running in a production deployment. */
export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.APP_ENV === 'prod' || env.NODE_ENV === 'production';
}

/** True when the configured JWT secret is missing or a known in-repo default. */
export function isInsecureJwtSecret(secret: string | undefined | null): boolean {
    return !secret || KNOWN_DEFAULT_JWT_SECRETS.has(secret);
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
