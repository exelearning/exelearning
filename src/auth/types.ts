/**
 * Canonical authentication types.
 *
 * Two representations live here and only here:
 *
 *   - {@link JwtPayload}: the token as it travels on the wire (`sub` is a
 *     string per RFC 7519 §4.1.2). It exists at the JWT boundary — signing,
 *     verifying — and nowhere else.
 *   - {@link AuthenticatedIdentity}: the internal identity used by the rest
 *     of the application. `sub` has been parsed to the numeric `userId`
 *     exactly once, by {@link toAuthenticatedIdentity}.
 */

/** Raw JWT payload as carried inside the signed token. */
export interface JwtPayload {
    /** Subject: user id, as string per RFC 7519 section 4.1.2 */
    sub: string;
    email: string;
    roles: string[];
    isGuest?: boolean;
    authMethod?: 'local' | 'cas' | 'openid' | 'saml' | 'guest';
    isImpersonated?: boolean;
    impersonatedBy?: number;
    impersonationSessionId?: string;
    iat?: number;
    exp?: number;
}

/**
 * Identity of an authenticated caller, with `sub` already parsed to the
 * numeric user id. Everything downstream of JWT verification works with this.
 */
export interface AuthenticatedIdentity {
    userId: number;
    email: string;
    roles: string[];
    isGuest: boolean;
    authMethod?: 'local' | 'cas' | 'openid' | 'saml' | 'guest';
    isImpersonated?: boolean;
    impersonatedBy?: number;
    impersonationSessionId?: string;
}

/**
 * Parse JWT `sub` (RFC 7519 string) to the numeric user id.
 * Accepts a number as well so tokens signed before the string-sub change still work.
 * Returns null when the payload is missing, empty, or `sub` is not a positive safe integer.
 */
export function userIdFromJwt(payload: { sub?: string | number } | null | undefined): number | null {
    if (payload?.sub == null || payload.sub === '') {
        return null;
    }
    const raw = typeof payload.sub === 'string' ? payload.sub.trim() : payload.sub;
    if (typeof raw === 'string') {
        if (!/^\d+$/.test(raw)) {
            return null;
        }
    }
    const id = typeof raw === 'number' ? raw : Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Convert a verified JWT payload into an {@link AuthenticatedIdentity}.
 * Returns null when the payload is missing or `sub` cannot be parsed to a
 * valid user id — i.e. the single place where "is this token a real user?"
 * is decided.
 */
export function toAuthenticatedIdentity(payload: JwtPayload | null | undefined): AuthenticatedIdentity | null {
    const userId = userIdFromJwt(payload);
    if (!payload || userId == null) {
        return null;
    }
    return {
        userId,
        email: payload.email ?? '',
        roles: Array.isArray(payload.roles) ? payload.roles : [],
        isGuest: payload.isGuest === true,
        authMethod: payload.authMethod,
        isImpersonated: payload.isImpersonated,
        impersonatedBy: payload.impersonatedBy,
        impersonationSessionId: payload.impersonationSessionId,
    };
}
