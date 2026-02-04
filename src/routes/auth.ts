/**
 * Auth Routes for Elysia
 * Handles login, logout, session checks, and guest access
 */
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import type { Kysely } from 'kysely';
import { db as defaultDb } from '../db/client';
import type { User, Database } from '../db/types';
import { parseRoles } from '../db/types';
import {
    findUserByEmail as findUserByEmailDefault,
    findUserById as findUserByIdDefault,
    createUser as createUserDefault,
} from '../db/queries';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { isValidReturnUrl, getSafeRedirectUrl } from '../utils/redirect-validator.util';
import { getBasePath, prefixPath } from '../utils/basepath.util';
import { getPublicCallbackUrl, type ServerContext } from '../utils/proxy-url.util';
import type { LoginRequest, GuestLoginRequest } from './types/request-payloads';
import { getAuthMethods, getSettingString, getSettingNumber } from '../services/app-settings';

// Domain for temporary emails (CAS, OIDC, Guest users without real email)
const TEMP_EMAIL_DOMAIN = process.env.AUTH_TEMP_EMAIL_DOMAIN || 'domain.local';

/**
 * Dependency types for auth routes
 */
export interface AuthDependencies {
    db: Kysely<Database>;
    queries: {
        findUserByEmail: typeof findUserByEmailDefault;
        findUserById: typeof findUserByIdDefault;
        createUser: typeof createUserDefault;
    };
}

const defaultDeps: AuthDependencies = {
    db: defaultDb,
    queries: {
        findUserByEmail: findUserByEmailDefault,
        findUserById: findUserByIdDefault,
        createUser: createUserDefault,
    },
};

// JWT payload type
export interface JwtPayload {
    sub: number;
    email: string;
    roles: string[];
    isGuest?: boolean;
    authMethod?: 'local' | 'cas' | 'openid' | 'saml' | 'guest';
    iat?: number;
    exp?: number;
}

// Get JWT secret from environment
const getJwtSecret = (): string => {
    return process.env.API_JWT_SECRET || process.env.JWT_SECRET || 'dev_secret_change_me';
};

// Login request body schema
const loginSchema = t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 1 }),
});

/**
 * Factory function to create auth routes with dependency injection
 * @param deps - Dependencies to inject (db, queries)
 */
export function createAuthRoutes(deps: AuthDependencies = defaultDeps) {
    const { db, queries } = deps;
    const { findUserByEmail, findUserById, createUser } = queries;

    return (
        new Elysia({ name: 'auth-routes' })
            // Add cookie and JWT plugins
            .use(cookie())
            .use(
                jwt({
                    name: 'jwt',
                    secret: getJwtSecret(),
                    exp: '7d',
                }),
            )

            // Derive auth context from request
            .derive(async ({ jwt, cookie, request }) => {
                let token: string | undefined;

                // Get token from Authorization header
                const authHeader = request.headers.get('authorization');
                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.slice(7);
                } else if (cookie.auth?.value) {
                    token = cookie.auth.value;
                }

                if (!token) {
                    return {
                        auth: { user: null, isAuthenticated: false, isGuest: false },
                        jwtPayload: null as JwtPayload | null,
                    };
                }

                try {
                    const payload = (await jwt.verify(token)) as JwtPayload | false;

                    if (!payload || !payload.sub) {
                        return {
                            auth: { user: null, isAuthenticated: false, isGuest: false },
                            jwtPayload: null as JwtPayload | null,
                        };
                    }

                    const user = await findUserById(db, payload.sub);
                    return {
                        auth: {
                            user: user || null,
                            isAuthenticated: !!user,
                            isGuest: payload.isGuest || false,
                        },
                        jwtPayload: payload,
                    };
                } catch {
                    return {
                        auth: { user: null, isAuthenticated: false, isGuest: false },
                        jwtPayload: null as JwtPayload | null,
                    };
                }
            })

            // =====================================================
            // /api/auth/* routes
            // =====================================================

            // POST /api/auth/login - Login with email/password
            .post(
                '/api/auth/login',
                async ({ jwt, cookie, body, set }) => {
                    const { email, password } = body;

                    const user = await findUserByEmail(db, email);
                    if (!user) {
                        set.status = 401;
                        return { error: 'Unauthorized', message: 'Invalid credentials' };
                    }

                    const isValid = await bcrypt.compare(password, user.password);
                    if (!isValid) {
                        set.status = 401;
                        return { error: 'Unauthorized', message: 'Invalid credentials' };
                    }

                    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
                        sub: user.id,
                        email: user.email,
                        roles: parseRoles(user.roles),
                        isGuest: false,
                        authMethod: 'local',
                    };

                    const token = await jwt.sign(payload);

                    cookie.auth.set({
                        value: token,
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        maxAge: 7 * 24 * 60 * 60,
                        path: '/',
                    });

                    return {
                        access_token: token,
                        user: sanitizeUser(user),
                    };
                },
                { body: loginSchema },
            )

            // POST /api/auth/logout - Logout
            .post('/api/auth/logout', async ({ cookie, auth }) => {
                cookie.auth.remove();
                return {
                    message: 'Logged out successfully',
                    wasAuthenticated: auth?.isAuthenticated || false,
                };
            })

            // GET /api/auth/check - Check if authenticated
            .get('/api/auth/check', ({ auth }) => {
                return { authenticated: auth?.isAuthenticated || false };
            })

            // GET /api/auth/user - Get current user info
            .get('/api/auth/user', ({ auth, set }) => {
                if (!auth?.isAuthenticated || !auth.user) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Not authenticated' };
                }
                return {
                    user: sanitizeUser(auth.user),
                    isGuest: auth.isGuest,
                };
            })

            // =====================================================
            // /api/session/* routes
            // =====================================================

            // GET /api/session/check - Check session status
            .get('/api/session/check', ({ auth }) => {
                const authenticated = auth?.isAuthenticated || false;
                return {
                    authenticated,
                    active: authenticated,
                    user:
                        authenticated && auth?.user
                            ? {
                                  id: auth.user.id,
                                  email: auth.user.email,
                              }
                            : null,
                };
            })

            // =====================================================
            // Form-based login routes
            // =====================================================

            // POST /login_check - Symfony-compatible form login
            .post('/login_check', async ({ jwt, cookie, body, request }) => {
                const typedBody = body as LoginRequest;
                const email = typedBody?._username || typedBody?.email;
                const password = typedBody?._password || typedBody?.password;

                // Build base path from request URL
                const url = new URL(request.url);
                // Normalize basePath: strip trailing slash, treat '/' as empty
                let basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '');
                if (basePath === '/') basePath = '';
                const loginUrl = `${basePath}/login`;

                if (!email || !password) {
                    // Redirect back to login with error
                    return Response.redirect(
                        `${url.origin}${loginUrl}?error=${encodeURIComponent('Email and password required')}`,
                        302,
                    );
                }

                const user = await findUserByEmail(db, email);
                if (!user) {
                    // Redirect back to login with error
                    return Response.redirect(
                        `${url.origin}${loginUrl}?error=${encodeURIComponent('Invalid credentials')}`,
                        302,
                    );
                }

                const isValid = await bcrypt.compare(password, user.password);
                if (!isValid) {
                    // Redirect back to login with error
                    return Response.redirect(
                        `${url.origin}${loginUrl}?error=${encodeURIComponent('Invalid credentials')}`,
                        302,
                    );
                }

                const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
                    sub: user.id,
                    email: user.email,
                    roles: parseRoles(user.roles),
                    isGuest: false,
                    authMethod: 'local',
                };

                const token = await jwt.sign(payload);

                cookie.auth.set({
                    value: token,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 7 * 24 * 60 * 60,
                    path: '/',
                });

                // Redirect to returnUrl if valid, otherwise to workarea
                const returnUrl = typedBody?.returnUrl;
                const targetUrl = getSafeRedirectUrl(returnUrl, '/workarea');
                return Response.redirect(targetUrl, 302);
            })

            // GET /logout - Logout and redirect to login page (SSO-aware)
            .get('/logout', async ({ cookie, request, jwtPayload }) => {
                const authMethod = jwtPayload?.authMethod;

                // Remove auth cookie first
                cookie.auth.remove();

                // Build callback URL for SSO logout (include BASE_PATH)
                const url = new URL(request.url);
                const baseUrl = `${url.protocol}//${url.host}`;
                const basePath = getBasePath();
                const postLogoutUrl = `${baseUrl}${basePath}/login`;

                // Handle SSO logout based on auth method
                if (authMethod === 'cas') {
                    // CAS logout - redirect to CAS server logout endpoint
                    const casUrl = (await getSettingString(db, 'CAS_URL', process.env.CAS_URL || '')).replace(
                        /\/$/,
                        '',
                    );
                    const casLogoutPath = await getSettingString(
                        db,
                        'CAS_LOGOUT_PATH',
                        process.env.CAS_LOGOUT_PATH || '/logout',
                    );

                    if (casUrl) {
                        const casLogoutUrl = `${casUrl}${casLogoutPath}?service=${encodeURIComponent(postLogoutUrl)}`;
                        return Response.redirect(casLogoutUrl, 302);
                    }
                }

                if (authMethod === 'openid') {
                    // OpenID Connect logout - redirect to end_session endpoint
                    const endSessionEndpoint = process.env.OIDC_END_SESSION_ENDPOINT;
                    const clientId = await getSettingString(db, 'OIDC_CLIENT_ID', process.env.OIDC_CLIENT_ID || '');

                    if (endSessionEndpoint) {
                        const params = new URLSearchParams({
                            client_id: clientId || '',
                            post_logout_redirect_uri: postLogoutUrl,
                        });

                        // Get id_token from cookie for id_token_hint (required by some providers like Keycloak)
                        const idTokenCookie = request.headers
                            .get('cookie')
                            ?.split(';')
                            .find(c => c.trim().startsWith('oidc_id_token='));
                        if (idTokenCookie) {
                            const idToken = idTokenCookie.split('=')[1]?.trim();
                            if (idToken) {
                                params.set('id_token_hint', idToken);
                            }
                        }

                        const oidcLogoutUrl = `${endSessionEndpoint}?${params.toString()}`;

                        // Clear the id_token cookie along with redirect
                        return new Response(null, {
                            status: 302,
                            headers: [
                                ['Location', oidcLogoutUrl],
                                ['Set-Cookie', 'oidc_id_token=; Path=/; HttpOnly; Max-Age=0'],
                            ],
                        });
                    }
                }

                if (authMethod === 'saml') {
                    // SAML logout - redirect to IDP SingleLogoutService
                    const samlLogoutUrl = process.env.SAML_IDP_LOGOUT_URL;

                    if (samlLogoutUrl) {
                        const params = new URLSearchParams({
                            RelayState: postLogoutUrl,
                        });
                        return Response.redirect(`${samlLogoutUrl}?${params.toString()}`, 302);
                    }
                }

                // Default: redirect to login page (local auth, guest, or no auth method)
                return Response.redirect(prefixPath('/login'), 302);
            })

            // GET /login/cas - CAS (Central Authentication Service) SSO login
            .get('/login/cas', async ({ request, set, query, server }) => {
                const authMethods = await getAuthMethods(db, process.env.APP_AUTH_METHODS || 'password,guest');
                if (!authMethods.includes('cas')) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'CAS authentication is not enabled.' };
                }

                const casUrl = (await getSettingString(db, 'CAS_URL', process.env.CAS_URL || '')).replace(/\/$/, '');
                const casLoginPath = (
                    await getSettingString(db, 'CAS_LOGIN_PATH', process.env.CAS_LOGIN_PATH || '/login')
                ).replace(/^\//, '');

                if (!casUrl || !casLoginPath) {
                    set.status = 500;
                    return { error: 'Server Error', message: 'CAS authentication is misconfigured.' };
                }

                // Build callback URL (respects reverse proxy headers and BASE_PATH)
                const serverContext: ServerContext = {
                    requestIP: (req: Request) => server?.requestIP(req) ?? null,
                };
                const serviceUrl = getPublicCallbackUrl(request, '/login/cas/callback', serverContext);

                const loginUrl = `${casUrl}/${casLoginPath}?service=${encodeURIComponent(serviceUrl)}`;

                // Store returnUrl in cookie for post-login redirect
                const returnUrl = query.returnUrl as string | undefined;
                const headers: [string, string][] = [['Location', loginUrl]];
                if (returnUrl && isValidReturnUrl(returnUrl)) {
                    const isSecure = process.env.NODE_ENV === 'production';
                    headers.push([
                        'Set-Cookie',
                        `sso_return_url=${encodeURIComponent(returnUrl)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${isSecure ? '; Secure' : ''}`,
                    ]);
                }

                return new Response(null, { status: 302, headers });
            })

            // GET /login/cas/callback - CAS callback after authentication
            .get('/login/cas/callback', async ({ jwt, cookie, request, query, set, server }) => {
                const authMethods = await getAuthMethods(db, process.env.APP_AUTH_METHODS || 'password,guest');
                if (!authMethods.includes('cas')) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'CAS authentication is not enabled.' };
                }

                const ticket = query.ticket as string | undefined;
                if (!ticket) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Missing CAS ticket.' };
                }

                const casUrl = (await getSettingString(db, 'CAS_URL', process.env.CAS_URL || '')).replace(/\/$/, '');
                const casValidatePath = (
                    await getSettingString(
                        db,
                        'CAS_VALIDATE_PATH',
                        process.env.CAS_VALIDATE_PATH || '/p3/serviceValidate',
                    )
                ).replace(/^\//, '');

                if (!casUrl || !casValidatePath) {
                    set.status = 500;
                    return { error: 'Server Error', message: 'CAS authentication is misconfigured.' };
                }

                // Build callback URL (must match what was sent to CAS login)
                const serverContext: ServerContext = {
                    requestIP: (req: Request) => server?.requestIP(req) ?? null,
                };
                const serviceUrl = getPublicCallbackUrl(request, '/login/cas/callback', serverContext);

                try {
                    const validateUrl = `${casUrl}/${casValidatePath}?service=${encodeURIComponent(serviceUrl)}&ticket=${encodeURIComponent(ticket)}`;
                    const response = await fetch(validateUrl);
                    const body = await response.text();

                    // Parse CAS XML response
                    const userMatch =
                        body.match(/<cas:user>([^<]+)<\/cas:user>/i) || body.match(/<user>([^<]+)<\/user>/i);
                    const casUser = userMatch ? userMatch[1] : null;

                    if (!casUser) {
                        set.status = 401;
                        return { error: 'Unauthorized', message: 'CAS authentication failed.' };
                    }

                    // Extract email from CAS attributes if present
                    const emailMatch =
                        body.match(/<cas:mail>([^<]+)<\/cas:mail>/i) ||
                        body.match(/<mail>([^<]+)<\/mail>/i) ||
                        body.match(/<email>([^<]+)<\/email>/i);

                    // Determine email: from attributes, from casUser if already email, or fallback
                    let email: string;
                    if (emailMatch) {
                        // Use email from CAS attributes
                        email = emailMatch[1];
                    } else if (casUser.includes('@')) {
                        // casUser is already an email address
                        email = casUser;
                    } else {
                        // casUser is just a username, add temp email domain
                        email = `${casUser}@${TEMP_EMAIL_DOMAIN}`;
                    }

                    // Find or create user in database
                    let user = await findUserByEmail(db, email);
                    if (!user) {
                        const hashedPassword = await bcrypt.hash(randomBytes(16).toString('hex'), 10);
                        const defaultQuota = await getSettingNumber(
                            db,
                            'DEFAULT_QUOTA',
                            parseInt(process.env.DEFAULT_QUOTA || '4096', 10),
                        );
                        user = await createUser(db, {
                            email,
                            user_id: `cas:${casUser}`,
                            password: hashedPassword,
                            roles: ['ROLE_USER'],
                            is_lopd_accepted: 1,
                            quota_mb: defaultQuota,
                        });
                    }

                    // Create JWT token
                    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
                        sub: user.id,
                        email: user.email,
                        roles: parseRoles(user.roles),
                        isGuest: false,
                        authMethod: 'cas',
                    };

                    const token = await jwt.sign(payload);

                    cookie.auth.set({
                        value: token,
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        maxAge: 7 * 24 * 60 * 60,
                        path: '/',
                    });

                    // Get returnUrl from cookie and redirect
                    const returnUrlCookie = request.headers
                        .get('cookie')
                        ?.split(';')
                        .find(c => c.trim().startsWith('sso_return_url='));
                    let returnUrl: string | undefined;
                    if (returnUrlCookie) {
                        try {
                            returnUrl = decodeURIComponent(returnUrlCookie.split('=')[1]?.trim() || '');
                        } catch {
                            // Ignore decode errors
                        }
                    }

                    const targetUrl = getSafeRedirectUrl(returnUrl, '/workarea');

                    // Clear the sso_return_url cookie and redirect
                    return new Response(null, {
                        status: 302,
                        headers: [
                            ['Location', targetUrl],
                            ['Set-Cookie', 'sso_return_url=; Path=/; HttpOnly; Max-Age=0'],
                        ],
                    });
                } catch (error) {
                    console.error('CAS authentication error:', error);
                    set.status = 500;
                    return { error: 'Server Error', message: 'CAS authentication failed. Please try again later.' };
                }
            })

            // GET /login/openid - OpenID Connect SSO login
            .get('/login/openid', async ({ request, set, query, server }) => {
                const authMethods = await getAuthMethods(db, process.env.APP_AUTH_METHODS || 'password,guest');
                if (!authMethods.includes('openid')) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'OpenID authentication is not enabled.' };
                }

                const authorizeEndpoint = await getSettingString(
                    db,
                    'OIDC_AUTHORIZATION_ENDPOINT',
                    process.env.OIDC_AUTHORIZATION_ENDPOINT || '',
                );
                if (!authorizeEndpoint) {
                    set.status = 500;
                    return { error: 'Server Error', message: 'OpenID Connect is misconfigured.' };
                }

                // Generate PKCE challenge
                const codeVerifier = randomBytes(32).toString('hex');
                const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
                const state = randomBytes(16).toString('hex');
                const nonce = randomBytes(16).toString('hex');

                // Store in cookie for callback verification (since we don't have sessions)
                // In production, consider using a more secure method
                const oidcState = JSON.stringify({ codeVerifier, state, nonce });

                // Build callback URL (respects reverse proxy headers and BASE_PATH)
                const serverContext: ServerContext = {
                    requestIP: (req: Request) => server?.requestIP(req) ?? null,
                };
                const redirectUri = getPublicCallbackUrl(request, '/login/openid/callback', serverContext);
                const scope = await getSettingString(db, 'OIDC_SCOPE', process.env.OIDC_SCOPE || 'openid email');
                const clientId = await getSettingString(db, 'OIDC_CLIENT_ID', process.env.OIDC_CLIENT_ID || '');

                const params = new URLSearchParams({
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    response_type: 'code',
                    scope,
                    state,
                    nonce,
                    code_challenge: codeChallenge,
                    code_challenge_method: 'S256',
                    prompt: 'consent',
                });

                // Build cookies to set (OIDC state + optional returnUrl)
                const isSecure = process.env.NODE_ENV === 'production';
                const cookies: string[] = [
                    `oidc_state=${encodeURIComponent(oidcState)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${isSecure ? '; Secure' : ''}`,
                ];

                // Store returnUrl in cookie for post-login redirect
                const returnUrl = query.returnUrl as string | undefined;
                if (returnUrl && isValidReturnUrl(returnUrl)) {
                    cookies.push(
                        `sso_return_url=${encodeURIComponent(returnUrl)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${isSecure ? '; Secure' : ''}`,
                    );
                }

                // Set OIDC state cookie (and optionally returnUrl cookie)
                return new Response(null, {
                    status: 302,
                    headers: [
                        ['Location', `${authorizeEndpoint}?${params.toString()}`],
                        ...cookies.map(c => ['Set-Cookie', c] as [string, string]),
                    ],
                });
            })

            // GET /login/openid/callback - OpenID callback after authentication
            .get('/login/openid/callback', async ({ jwt, cookie, request, query, set, server }) => {
                const authMethods = await getAuthMethods(db, process.env.APP_AUTH_METHODS || 'password,guest');
                if (!authMethods.includes('openid')) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'OpenID authentication is not enabled.' };
                }

                if (query.error) {
                    // User cancelled or error occurred - redirect to login page
                    // Common errors: access_denied (user cancelled), login_required, etc.
                    const url = new URL(request.url);
                    const basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '');
                    const loginUrl = `${url.origin}${basePath}/login`;
                    // Only show error message if it's not just a cancel (access_denied)
                    if (query.error === 'access_denied') {
                        return Response.redirect(loginUrl, 302);
                    }
                    const errorMsg = query.error_description || query.error;
                    return Response.redirect(`${loginUrl}?error=${encodeURIComponent(errorMsg as string)}`, 302);
                }

                const code = query.code as string | undefined;
                if (!code) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Missing authorization code.' };
                }

                // Get OIDC state from cookie
                const oidcStateCookie = request.headers
                    .get('cookie')
                    ?.split(';')
                    .find(c => c.trim().startsWith('oidc_state='));

                let codeVerifier = '';
                if (oidcStateCookie) {
                    try {
                        const stateJson = decodeURIComponent(oidcStateCookie.split('=')[1]);
                        const stateData = JSON.parse(stateJson);
                        codeVerifier = stateData.codeVerifier || '';

                        // Verify state matches
                        if (query.state && stateData.state !== query.state) {
                            set.status = 400;
                            return { error: 'Bad Request', message: 'Invalid state parameter.' };
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }

                const tokenEndpoint = await getSettingString(
                    db,
                    'OIDC_TOKEN_ENDPOINT',
                    process.env.OIDC_TOKEN_ENDPOINT || '',
                );
                if (!tokenEndpoint) {
                    set.status = 500;
                    return { error: 'Server Error', message: 'OpenID Connect is misconfigured.' };
                }

                try {
                    // Build callback URL (must match what was sent to OIDC provider)
                    const serverContext: ServerContext = {
                        requestIP: (req: Request) => server?.requestIP(req) ?? null,
                    };
                    const redirectUri = getPublicCallbackUrl(request, '/login/openid/callback', serverContext);

                    // Exchange code for tokens
                    const clientId = await getSettingString(db, 'OIDC_CLIENT_ID', process.env.OIDC_CLIENT_ID || '');
                    const clientSecret = await getSettingString(
                        db,
                        'OIDC_CLIENT_SECRET',
                        process.env.OIDC_CLIENT_SECRET || '',
                    );
                    const userinfoEndpoint = await getSettingString(
                        db,
                        'OIDC_USERINFO_ENDPOINT',
                        process.env.OIDC_USERINFO_ENDPOINT || '',
                    );

                    const tokenResponse = await fetch(tokenEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            grant_type: 'authorization_code',
                            client_id: clientId,
                            client_secret: clientSecret,
                            redirect_uri: redirectUri,
                            code,
                            code_verifier: codeVerifier,
                        }),
                    });

                    const tokenJson = (await tokenResponse.json()) as Record<string, unknown>;
                    const accessToken = tokenJson.access_token as string | undefined;
                    const idToken = tokenJson.id_token as string | undefined;

                    // Decode ID token to get user info
                    let userEmail: string | undefined;
                    let subject: string | undefined;

                    if (idToken) {
                        try {
                            const [, payloadB64] = idToken.split('.');
                            const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
                            const payload = JSON.parse(payloadJson);
                            userEmail = payload.email || payload.preferred_username;
                            subject = payload.sub;
                        } catch {
                            // Ignore decode errors
                        }
                    }

                    // Try userinfo endpoint if email not in ID token
                    if (!userEmail && accessToken) {
                        if (userinfoEndpoint) {
                            try {
                                const userinfoResponse = await fetch(userinfoEndpoint, {
                                    headers: { Authorization: `Bearer ${accessToken}` },
                                });
                                const userinfo = (await userinfoResponse.json()) as Record<string, unknown>;
                                userEmail = (userinfo.email as string) || (userinfo.preferred_username as string);
                                subject = (userinfo.sub as string) || subject;
                            } catch {
                                // Ignore userinfo errors
                            }
                        }
                    }

                    if (!userEmail) {
                        if (subject?.includes('@')) {
                            // subject is already an email address
                            userEmail = subject;
                        } else {
                            // Generate fallback email with temp email domain
                            userEmail = `${subject || randomBytes(8).toString('hex')}@${TEMP_EMAIL_DOMAIN}`;
                        }
                    }

                    // Find or create user in database
                    let user = await findUserByEmail(db, userEmail);
                    if (!user) {
                        const hashedPassword = await bcrypt.hash(randomBytes(16).toString('hex'), 10);
                        const defaultQuota = await getSettingNumber(
                            db,
                            'DEFAULT_QUOTA',
                            parseInt(process.env.DEFAULT_QUOTA || '4096', 10),
                        );
                        user = await createUser(db, {
                            email: userEmail,
                            user_id: `oidc:${subject || userEmail}`,
                            password: hashedPassword,
                            roles: ['ROLE_USER'],
                            is_lopd_accepted: 1,
                            quota_mb: defaultQuota,
                        });
                    }

                    // Create JWT token
                    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
                        sub: user.id,
                        email: user.email,
                        roles: parseRoles(user.roles),
                        isGuest: false,
                        authMethod: 'openid',
                    };

                    const token = await jwt.sign(payload);

                    cookie.auth.set({
                        value: token,
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        maxAge: 7 * 24 * 60 * 60,
                        path: '/',
                    });

                    // Get returnUrl from cookie
                    const returnUrlCookie = request.headers
                        .get('cookie')
                        ?.split(';')
                        .find(c => c.trim().startsWith('sso_return_url='));
                    let returnUrl: string | undefined;
                    if (returnUrlCookie) {
                        try {
                            returnUrl = decodeURIComponent(returnUrlCookie.split('=')[1]?.trim() || '');
                        } catch {
                            // Ignore decode errors
                        }
                    }

                    const targetUrl = getSafeRedirectUrl(returnUrl, '/workarea');

                    // Store id_token for OpenID logout (needed for id_token_hint)
                    // This allows proper session termination at the OpenID provider
                    const setCookieHeaders: string[] = [
                        'oidc_state=; Path=/; HttpOnly; Max-Age=0', // Clear state cookie
                        'sso_return_url=; Path=/; HttpOnly; Max-Age=0', // Clear returnUrl cookie
                    ];
                    if (idToken) {
                        const isSecure = process.env.NODE_ENV === 'production';
                        setCookieHeaders.push(
                            `oidc_id_token=${idToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${isSecure ? '; Secure' : ''}`,
                        );
                    }

                    // Clear cookies and redirect to target URL
                    return new Response(null, {
                        status: 302,
                        headers: [
                            ['Location', targetUrl],
                            ...setCookieHeaders.map(c => ['Set-Cookie', c] as [string, string]),
                        ],
                    });
                } catch (error) {
                    console.error('OpenID authentication error:', error);
                    set.status = 500;
                    return { error: 'Server Error', message: 'OpenID authentication failed. Please try again later.' };
                }
            })

            // GET /login/saml - SAML SSO login
            // Placeholder - SAML requires more complex setup
            .get('/login/saml', async ({ set }) => {
                const authMethods = await getAuthMethods(db, process.env.APP_AUTH_METHODS || 'password,guest');
                if (!authMethods.includes('saml')) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'SAML authentication is not enabled.' };
                }

                // SAML requires complex setup with certificate management
                // Return proper error message instead of placeholder redirect
                set.status = 501;
                return {
                    error: 'Not Implemented',
                    message:
                        'SAML authentication is configured but not yet implemented in Elysia. Please use CAS or OpenID Connect.',
                };
            })

            // POST /login/guest - Guest login
            .post('/login/guest', async ({ jwt, cookie, set, body }) => {
                const authMethods = await getAuthMethods(db, process.env.APP_AUTH_METHODS || 'password,guest');
                if (!authMethods.includes('guest')) {
                    set.status = 403;
                    return { error: 'Forbidden', message: 'Guest login is not enabled' };
                }

                const guestId = randomBytes(16).toString('hex');
                const guestEmail = `${guestId.slice(0, 8)}@${TEMP_EMAIL_DOMAIN}`;

                let user = await findUserByEmail(db, guestEmail);
                if (!user) {
                    const hashedPassword = await bcrypt.hash(randomBytes(16).toString('hex'), 10);
                    const defaultQuota = await getSettingNumber(
                        db,
                        'DEFAULT_QUOTA',
                        parseInt(process.env.DEFAULT_QUOTA || '4096', 10),
                    );
                    user = await createUser(db, {
                        email: guestEmail,
                        // user_id: not set for guest users (null) - they're not SSO
                        password: hashedPassword,
                        roles: ['ROLE_GUEST'],
                        is_lopd_accepted: 1,
                        quota_mb: defaultQuota,
                    });
                }

                const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
                    sub: user.id,
                    email: user.email,
                    roles: parseRoles(user.roles),
                    isGuest: true,
                    authMethod: 'guest',
                };

                const token = await jwt.sign(payload);

                cookie.auth.set({
                    value: token,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 24 * 60 * 60,
                    path: '/',
                });

                // Redirect to returnUrl if valid, otherwise to workarea
                const guestBody = body as GuestLoginRequest;
                const returnUrl = guestBody?.returnUrl;
                const targetUrl = getSafeRedirectUrl(returnUrl, '/workarea');
                return Response.redirect(targetUrl, 302);
            })
    );
}

/**
 * Default auth routes instance using default dependencies
 */
export const authRoutes = createAuthRoutes();

/**
 * Helper: Remove sensitive fields from user object
 */
function sanitizeUser(user: User): Omit<User, 'password'> {
    const { password: _password, ...safeUser } = user;
    return safeUser;
}

// Keep the plugin for reuse in other routes
export { getJwtSecret };

/**
 * Verify JWT token independently (for WebSocket auth)
 * Returns the payload if valid, null otherwise
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
    try {
        // Use jose for independent token verification
        const { jwtVerify } = await import('jose');
        const secret = new TextEncoder().encode(getJwtSecret());

        const { payload } = await jwtVerify(token, secret);

        if (!payload.sub) {
            return null;
        }

        return {
            sub: typeof payload.sub === 'string' ? parseInt(payload.sub, 10) : Number(payload.sub),
            email: payload.email as string,
            roles: payload.roles as string[],
            isGuest: payload.isGuest as boolean | undefined,
            authMethod: payload.authMethod as JwtPayload['authMethod'],
            iat: payload.iat,
            exp: payload.exp,
        };
    } catch {
        return null;
    }
}
