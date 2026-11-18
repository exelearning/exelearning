/**
 * Environment helpers - single source of truth for "are we in production?".
 *
 * The codebase signals production via `APP_ENV=prod` (used by routes, templates
 * and Redis config) while the official Docker image also sets `NODE_ENV=production`
 * (Dockerfile). Treating either as production keeps the security guards (default
 * JWT secret check and cookie `Secure` flag) consistent across both the Docker and
 * the non-Docker (systemd / PaaS / bare `bun`) deployment paths.
 */

import {
    getAppSecret,
    getConfiguredJwtSecret,
    INSECURE_JWT_SECRETS,
    isProductionRuntime,
    validateProductionJwtSecret,
} from './jwt-secret';

/** True when the app is running in a production deployment. */
export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
    return isProductionRuntime(env);
}

/**
 * True when the configured JWT secret is missing, a published example value or too short for production.
 * The rules live in `jwt-secret.ts` so the boot check and token signing cannot disagree.
 */
export function isInsecureJwtSecret(secret: string | undefined | null): boolean {
    try {
        validateProductionJwtSecret(secret?.trim() ? secret : null);
        return false;
    } catch {
        return true;
    }
}

/**
 * True when APP_SECRET is missing or a published example value. APP_SECRET is the
 * effective signing/verification key for platform-integration JWTs
 * (`getProviderSecret()` falls back to it, and with an empty PROVIDER_IDS the
 * provider allow-list accepts anything), so a default value lets anyone who
 * reads the open-source repository forge platform JWTs — the auth gate for the
 * SSRF/IDOR-sensitive platform callbacks.
 */
export function isInsecureAppSecret(secret: string | undefined | null): boolean {
    return !secret?.trim() || INSECURE_JWT_SECRETS.has(secret);
}

/**
 * Returns an error message when the deployment must refuse to boot because it is
 * running in production with a missing, published or too short JWT signing secret; otherwise
 * `null`. Pure (no side effects) so it can be unit-tested without booting the server.
 */
export function jwtSecretBootError(env: NodeJS.ProcessEnv = process.env): string | null {
    if (!isProductionEnv(env)) {
        return null;
    }
    try {
        validateProductionJwtSecret(getConfiguredJwtSecret(env));
        return null;
    } catch (error) {
        return `${(error as Error).message} Refusing to start in production (APP_ENV=prod or NODE_ENV=production).`;
    }
}

/**
 * Returns an error message when the deployment must refuse to boot because it is
 * running in production with a missing or published APP_SECRET; otherwise `null`.
 * APP_SECRET verifies platform-integration JWTs, so the default must be rejected
 * in production just like the JWT signing secret. Pure (no side effects).
 */
export function appSecretBootError(env: NodeJS.ProcessEnv = process.env): string | null {
    if (!isProductionEnv(env)) {
        return null;
    }
    try {
        getAppSecret(env);
        return null;
    } catch (error) {
        return `${(error as Error).message} Refusing to start in production (APP_ENV=prod or NODE_ENV=production).`;
    }
}

/**
 * Single boot-time secrets check: refuses production startup when EITHER the JWT
 * signing secret OR APP_SECRET is missing/default. Returns the first error found,
 * or `null` when it is safe to boot. This is the guard the server should call.
 */
export function secretsBootError(env: NodeJS.ProcessEnv = process.env): string | null {
    return jwtSecretBootError(env) || appSecretBootError(env);
}
