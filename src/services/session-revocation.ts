/**
 * Session revocation
 *
 * Session JWTs live for days, so their claims alone cannot tell whether the
 * account is still allowed in. Like Symfony's per-request user refresh and
 * Django's session auth hash, every verified token is re-checked against the
 * current account row:
 *
 *   - the user must still exist and be active;
 *   - the token must not claim a role the account no longer has;
 *   - a token carrying `pwh` must match the current password hash;
 *   - an impersonation token needs its administrator to still be an active admin.
 *
 * `sessionRevocationGuard()` applies the check to every HTTP request before
 * routing: a revoked token is removed from the request (Authorization header
 * or `auth` cookie), so every route sees an anonymous request and applies its
 * usual unauthenticated behaviour. `verifySessionToken()` does the same for
 * tokens that do not travel in headers (the Yjs WebSocket query token).
 */
import { Elysia } from 'elysia';
import type { Kysely } from 'kysely';
import { db as defaultDb } from '../db/client';
import { findUserById as findUserByIdDefault } from '../db/queries';
import { parseRoles, type Database } from '../db/types';
import { passwordFingerprint, verifyToken as verifyTokenDefault, type JwtPayload } from '../routes/auth';
import { ROLES } from '../utils/guards';

export interface SessionRevocationDeps {
    db: Kysely<Database>;
    findUserById: typeof findUserByIdDefault;
    verifyToken: typeof verifyTokenDefault;
}

const defaultDeps: SessionRevocationDeps = {
    db: defaultDb,
    findUserById: findUserByIdDefault,
    verifyToken: verifyTokenDefault,
};

// ponytail: per-process cache, so a revocation takes up to CACHE_TTL_MS to apply
// on each instance. It keeps static asset requests (which carry the auth
// cookie) from costing one user lookup each.
const CACHE_TTL_MS = 5_000;
const CACHE_MAX_ENTRIES = 10_000;

function rolesOf(rawRoles: string): string[] {
    const roles = parseRoles(rawRoles);
    return Array.isArray(roles) ? roles : [];
}

/**
 * Why a verified token no longer matches its account, or null when it is
 * still valid.
 */
export async function getSessionRevocationReason(
    payload: JwtPayload,
    deps: Pick<SessionRevocationDeps, 'db' | 'findUserById'> = defaultDeps,
): Promise<string | null> {
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) return 'invalid-subject';

    const user = await deps.findUserById(deps.db, userId);
    if (!user) return 'user-deleted';
    if (!user.is_active) return 'user-inactive';
    if (payload.pwh !== undefined && payload.pwh !== passwordFingerprint(user.password)) return 'password-changed';

    const currentRoles = rolesOf(user.roles);
    const claimedRoles = Array.isArray(payload.roles) ? payload.roles : [];
    if (claimedRoles.some(role => !currentRoles.includes(role))) return 'role-revoked';

    if (payload.impersonatedBy !== undefined) {
        const admin = await deps.findUserById(deps.db, Number(payload.impersonatedBy));
        if (!admin?.is_active || !rolesOf(admin.roles).includes(ROLES.ADMIN)) {
            return 'impersonator-revoked';
        }
    }
    return null;
}

/**
 * Verify a session token's signature and expiry, then its account state.
 * Returns the payload only when both hold.
 */
export async function verifySessionToken(
    token: string,
    deps: SessionRevocationDeps = defaultDeps,
): Promise<JwtPayload | null> {
    const payload = await deps.verifyToken(token);
    if (!payload) return null;
    return (await getSessionRevocationReason(payload, deps)) ? null : payload;
}

function readAuthCookie(cookieHeader: string): string | null {
    for (const part of cookieHeader.split(';')) {
        const eq = part.indexOf('=');
        if (eq !== -1 && part.slice(0, eq).trim() === 'auth') {
            return part.slice(eq + 1).trim() || null;
        }
    }
    return null;
}

function withoutAuthCookie(cookieHeader: string): string {
    return cookieHeader
        .split(';')
        .filter(part => part.slice(0, part.indexOf('=')).trim() !== 'auth')
        .join(';')
        .trim();
}

/**
 * Elysia plugin that strips revoked session tokens from every request.
 * Mount it on the root app, after the hooks that serve static files directly.
 */
export function sessionRevocationGuard(deps: SessionRevocationDeps = defaultDeps) {
    const cache = new Map<string, { revoked: boolean; expiresAt: number }>();

    // Only tokens with a valid signature are checked (and cached); a forged or
    // expired token is left for the routes to reject as they already do.
    async function isRevoked(token: string): Promise<boolean> {
        const now = Date.now();
        const hit = cache.get(token);
        if (hit && hit.expiresAt > now) return hit.revoked;

        const payload = await deps.verifyToken(token);
        if (!payload) return false;
        const revoked = (await getSessionRevocationReason(payload, deps)) !== null;

        if (cache.size >= CACHE_MAX_ENTRIES) cache.clear();
        cache.set(token, { revoked, expiresAt: now + CACHE_TTL_MS });
        return revoked;
    }

    return new Elysia({ name: 'session-revocation' }).onRequest(async ({ request }) => {
        const headers = request.headers;

        const authHeader = headers.get('authorization');
        if (authHeader?.startsWith('Bearer ') && (await isRevoked(authHeader.slice(7)))) {
            headers.delete('authorization');
        }

        const cookieHeader = headers.get('cookie');
        const cookieToken = cookieHeader ? readAuthCookie(cookieHeader) : null;
        if (cookieHeader && cookieToken && (await isRevoked(cookieToken))) {
            const remaining = withoutAuthCookie(cookieHeader);
            if (remaining) headers.set('cookie', remaining);
            else headers.delete('cookie');
        }
    });
}
