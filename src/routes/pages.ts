/**
 * Pages Routes for Elysia
 * Handles HTML page rendering (login, workarea, etc.)
 *
 * Uses Dependency Injection pattern for testability
 */
import { Elysia } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { randomBytes } from 'crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

import { renderTemplate as renderTemplateDefault, setRenderLocale } from '../services/template';
import {
    findUserById as findUserByIdDefault,
    findUserByEmail as findUserByEmailDefault,
    createUser as createUserDefault,
    findPreference as findPreferenceDefault,
    setPreference as setPreferenceDefault,
    findProjectByUuid as findProjectByUuidDefault,
    findProjectByPlatformId as findProjectByPlatformIdDefault,
    checkProjectAccess as checkProjectAccessDefault,
    createProject as createProjectDefault,
} from '../db/queries';
import { db as dbDefault } from '../db/client';
import { createGravatarUrl as createGravatarUrlDefault } from '../utils/gravatar.util';
import { getBasePath, prefixPath } from '../utils/basepath.util';
import { isValidReturnUrl } from '../utils/redirect-validator.util';
import { getAppVersion } from '../utils/version';
import { getAllSettings as getAllSettingsDefault } from '../db/queries/admin';
import { buildAdminTranslations } from './admin';
import {
    getAuthMethods as getAuthMethodsFromSettings,
    getSettingBoolean as getSettingBooleanFromSettings,
    getSettingString as getSettingStringFromSettings,
    parseBoolean as parseAppSettingBoolean,
} from '../services/app-settings';
type AppSettingsTable = {
    key: string;
    value: string;
    type: string;
    updated_at: number | null; // Unix timestamp in milliseconds
    updated_by: number | null;
};

type AppSettingsDb = Kysely<Database & { app_settings: AppSettingsTable }>;
import {
    createSession as createSessionDefault,
    generateSessionId as generateSessionIdDefault,
    getSession as getSessionDefault,
} from '../services/session-manager';
import {
    createSessionDirectories as createSessionDirectoriesDefault,
    getFilesDir,
    readFile as readFileFromDisk,
    fileExists as fileExistsOnDisk,
} from '../services/file-helper';
import * as pathModule from 'path';
import { detectLocaleFromHeader, trans, DEFAULT_LOCALE } from '../services/translation';
import { decodePlatformJWT } from '../utils/platform-jwt';
import type { JwtPayload } from './types/request-payloads';
import { getDefaultTheme as getDefaultThemeDefault } from '../db/queries/themes';

const CUSTOMIZATION_MIME_TYPES: Record<string, string> = {
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
};

/**
 * Login page query parameters
 */
interface LoginQueryParams {
    returnUrl?: string;
    error?: string;
}

interface ImpersonationContext {
    isActive: boolean;
    sessionId: string | null;
    impersonatorId: number;
    impersonatorEmail: string;
    impersonatedId: number;
    impersonatedEmail: string;
}

// ============================================================================
// Types and Interfaces for Dependency Injection
// ============================================================================

/**
 * Query functions interface
 */
export interface PagesQueriesDeps {
    findUserById: typeof findUserByIdDefault;
    findUserByEmail: typeof findUserByEmailDefault;
    createUser: typeof createUserDefault;
    findPreference: typeof findPreferenceDefault;
    setPreference: typeof setPreferenceDefault;
    findProjectByUuid: typeof findProjectByUuidDefault;
    findProjectByPlatformId: typeof findProjectByPlatformIdDefault;
    checkProjectAccess: typeof checkProjectAccessDefault;
    createProject: typeof createProjectDefault;
    getDefaultTheme: typeof getDefaultThemeDefault;
}

/**
 * Session manager functions interface
 */
export interface PagesSessionManagerDeps {
    createSession: typeof createSessionDefault;
    generateSessionId: typeof generateSessionIdDefault;
    getSession: typeof getSessionDefault;
}

/**
 * File helper functions interface
 */
export interface PagesFileHelperDeps {
    createSessionDirectories: typeof createSessionDirectoriesDefault;
    fileExists: typeof fileExistsOnDisk;
    readFile: typeof readFileFromDisk;
}

/**
 * Template functions interface
 */
export interface PagesTemplateDeps {
    renderTemplate: typeof renderTemplateDefault;
    setRenderLocale: typeof setRenderLocale;
}

/**
 * Utils interface
 */
// ... (existing code, added new interface)
/**
 * Settings functions interface
 */
export interface PagesSettingsDeps {
    getAuthMethods: typeof getAuthMethodsFromSettings;
    getSettingBoolean: typeof getSettingBooleanFromSettings;
    getSettingString: typeof getSettingStringFromSettings;
}

/**
 * Pages routes dependencies
 */
export interface PagesDependencies {
    db: Kysely<Database>;
    queries?: PagesQueriesDeps;
    sessionManager?: PagesSessionManagerDeps;
    fileHelper?: PagesFileHelperDeps;
    template?: PagesTemplateDeps;
    utils?: PagesUtilsDeps;
    settings?: PagesSettingsDeps;
}

// Default queries
const defaultQueries: PagesQueriesDeps = {
    findUserById: findUserByIdDefault,
    findUserByEmail: findUserByEmailDefault,
    createUser: createUserDefault,
    findPreference: findPreferenceDefault,
    setPreference: setPreferenceDefault,
    findProjectByUuid: findProjectByUuidDefault,
    findProjectByPlatformId: findProjectByPlatformIdDefault,
    checkProjectAccess: checkProjectAccessDefault,
    createProject: createProjectDefault,
    getDefaultTheme: getDefaultThemeDefault,
};

// Default session manager
const defaultSessionManager: PagesSessionManagerDeps = {
    createSession: createSessionDefault,
    generateSessionId: generateSessionIdDefault,
    getSession: getSessionDefault,
};

// Default file helper
const defaultFileHelper: PagesFileHelperDeps = {
    createSessionDirectories: createSessionDirectoriesDefault,
    fileExists: fileExistsOnDisk,
    readFile: readFileFromDisk,
};

// Default template
const defaultTemplate: PagesTemplateDeps = {
    renderTemplate: renderTemplateDefault,
    setRenderLocale,
};

// Default utils
const defaultUtils: PagesUtilsDeps = {
    createGravatarUrl: createGravatarUrlDefault,
};

// Default settings
const defaultSettings: PagesSettingsDeps = {
    getAuthMethods: getAuthMethodsFromSettings,
    getSettingBoolean: getSettingBooleanFromSettings,
    getSettingString: getSettingStringFromSettings,
};

// Default dependencies
const defaultDependencies: PagesDependencies = {
    db: dbDefault,
    queries: defaultQueries,
    sessionManager: defaultSessionManager,
    fileHelper: defaultFileHelper,
    template: defaultTemplate,
    utils: defaultUtils,
    settings: defaultSettings,
};

const isOfflineMode = () => String(process.env.APP_ONLINE_MODE ?? '1') === '0';

// Get JWT secret
const getJwtSecret = () => {
    return process.env.JWT_SECRET || process.env.APP_SECRET || 'elysia-dev-secret-change-me';
};

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create pages routes with injected dependencies
 */
export function createPagesRoutes(deps: PagesDependencies = defaultDependencies) {
    // Extract dependencies with variable shadowing
    const db = deps.db;
    const {
        findUserById,
        findUserByEmail,
        createUser,
        findPreference,
        setPreference,
        findProjectByUuid,
        findProjectByPlatformId,
        checkProjectAccess,
        createProject,
        getDefaultTheme,
    } = deps.queries ?? defaultQueries;
    const { createSession, getSession } = deps.sessionManager ?? defaultSessionManager;
    const { renderTemplate, setRenderLocale: setLocale } = deps.template ?? defaultTemplate;
    const { createGravatarUrl } = deps.utils ?? defaultUtils;
    const { getAuthMethods, getSettingBoolean, getSettingString } = deps.settings ?? defaultSettings;
    const { fileExists, readFile } = deps.fileHelper ?? defaultFileHelper;

    /**
     * Get user's locale preference from database
     * Returns null if not found
     */
    async function getUserLocalePreference(userId: number | string): Promise<string | null> {
        try {
            const userIdStr = String(userId);
            const pref = await findPreference(db, userIdStr, 'locale');

            if (pref?.value) {
                // Value might be JSON or plain string
                try {
                    const parsed = JSON.parse(pref.value);
                    return typeof parsed === 'object' && parsed.value ? parsed.value : parsed;
                } catch {
                    return pref.value;
                }
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Reads APP_NAME, APP_FAVICON_PATH and CUSTOM_HEAD_HTML from settings.
     * Returns values ready to pass to any page viewModel.
     */
    async function getCustomizationSettings(): Promise<{
        customHeadHtml: string;
        appName: string;
        customFaviconUrl: string;
    }> {
        const basePath = getBasePath();
        const [customHeadHtml, appName, appFaviconPath] = await Promise.all([
            getSettingString(db, 'CUSTOM_HEAD_HTML', ''),
            getSettingString(db, 'APP_NAME', ''),
            getSettingString(db, 'APP_FAVICON_PATH', ''),
        ]);
        const customFaviconUrl = appFaviconPath ? `${basePath}/customization/favicon` : '';
        return { customHeadHtml, appName, customFaviconUrl };
    }

    /**
     * Pages routes
     */
    return (
        new Elysia({ name: 'pages-routes' })
            .use(cookie())
            .use(
                jwt({
                    name: 'jwt',
                    secret: getJwtSecret(),
                    exp: '7d',
                }),
            )

            // Derive user from JWT token
            .derive(async ({ jwt, cookie }) => {
                const token = cookie.auth?.value;
                if (!token) {
                    if (cookie.impersonator_auth?.value) {
                        cookie.impersonator_auth.remove();
                        cookie.impersonation_session.remove();
                    }
                    return { currentUser: null, isGuest: false, impersonation: null as ImpersonationContext | null };
                }

                let impersonationBase: {
                    sessionId: string | null;
                    impersonatorId: number;
                    impersonatorEmail: string;
                } | null = null;

                const impersonatorToken = cookie.impersonator_auth?.value;
                if (impersonatorToken) {
                    try {
                        const originalPayload = (await jwt.verify(impersonatorToken)) as JwtPayload | false;
                        if (originalPayload?.sub) {
                            const impersonatorUser = await findUserById(db, Number(originalPayload.sub));
                            impersonationBase = {
                                sessionId: cookie.impersonation_session?.value || null,
                                impersonatorId: Number(originalPayload.sub),
                                impersonatorEmail:
                                    impersonatorUser?.email || originalPayload.email || `user-${originalPayload.sub}`,
                            };
                        }
                    } catch {
                        cookie.impersonator_auth.remove();
                        cookie.impersonation_session.remove();
                    }
                }

                try {
                    const payload = (await jwt.verify(token)) as JwtPayload | false;
                    if (!payload) return { currentUser: null, isGuest: false, impersonation: null };

                    const isGuest = payload.isGuest || false;
                    if (isGuest) {
                        return {
                            currentUser: {
                                id: payload.sub,
                                email: payload.email || 'guest@guest.local',
                                roles: JSON.stringify(['ROLE_GUEST']),
                            },
                            isGuest: true,
                            impersonation: null,
                        };
                    }

                    const user = await findUserById(db, payload.sub);
                    const impersonation: ImpersonationContext | null =
                        impersonationBase && user
                            ? {
                                  isActive: true,
                                  sessionId: impersonationBase.sessionId,
                                  impersonatorId: impersonationBase.impersonatorId,
                                  impersonatorEmail: impersonationBase.impersonatorEmail,
                                  impersonatedId: Number(user.id),
                                  impersonatedEmail: user.email || payload.email || `user-${user.id}`,
                              }
                            : null;

                    return { currentUser: user || null, isGuest: false, impersonation };
                } catch {
                    return { currentUser: null, isGuest: false, impersonation: null };
                }
            })

            // =====================================================
            // Public: Serve custom favicon (no auth required)
            // =====================================================
            .get('/customization/favicon', async ({ set }) => {
                const faviconFilename = await getSettingString(db, 'APP_FAVICON_PATH', '');
                if (!faviconFilename) {
                    return new Response(null, {
                        status: 302,
                        headers: { Location: `${getBasePath()}/favicon.ico` },
                    });
                }
                const faviconDir = pathModule.join(getFilesDir(), 'customization', 'favicon');
                const filePath = pathModule.resolve(faviconDir, faviconFilename);
                const resolvedDir = pathModule.resolve(faviconDir);
                if (!filePath.startsWith(resolvedDir + pathModule.sep) && filePath !== resolvedDir) {
                    set.status = 400;
                    return;
                }
                if (!(await fileExists(filePath))) {
                    return new Response(null, {
                        status: 302,
                        headers: { Location: `${getBasePath()}/favicon.ico` },
                    });
                }
                const content = await readFile(filePath);
                const ext = pathModule.extname(faviconFilename).toLowerCase();
                return new Response(content as unknown as BodyInit, {
                    headers: {
                        'Content-Type': CUSTOMIZATION_MIME_TYPES[ext] ?? 'application/octet-stream',
                        'Cache-Control': 'public, max-age=3600',
                    },
                });
            })

            // =====================================================
            // Public: Serve custom assets (no auth required)
            // =====================================================
            .get('/customization/assets/:filename', async ({ params, set }) => {
                const assetsDir = pathModule.join(getFilesDir(), 'customization', 'assets');
                const filePath = pathModule.resolve(assetsDir, params.filename);
                const resolvedDir = pathModule.resolve(assetsDir);
                if (!filePath.startsWith(resolvedDir + pathModule.sep) && filePath !== resolvedDir) {
                    set.status = 400;
                    return;
                }
                if (!(await fileExists(filePath))) {
                    set.status = 404;
                    return;
                }
                const content = await readFile(filePath);
                const ext = pathModule.extname(params.filename).toLowerCase();
                return new Response(content as unknown as BodyInit, {
                    headers: {
                        'Content-Type': CUSTOMIZATION_MIME_TYPES[ext] ?? 'application/octet-stream',
                        'Cache-Control': 'public, max-age=3600',
                    },
                });
            })

            // =====================================================
            // Root - Redirect to workarea (which redirects to login if no session)
            // =====================================================
            .get('/', () => {
                return Response.redirect(prefixPath('/workarea') || '/workarea', 302);
            })

            // =====================================================
            // Login Page
            // =====================================================
            .get('/login', async ({ currentUser, cookie, jwt, query, request, impersonation }) => {
                const offline = isOfflineMode();
                const defaultEmail =
                    process.env.DEFAULT_USER_EMAIL || process.env.TEST_USER_EMAIL || 'user@exelearning.net';

                // Offline mode: auto-login with default user and redirect to workarea
                if (offline) {
                    if (!currentUser) {
                        let user = await findUserByEmail(db, defaultEmail);
                        if (!user) {
                            // Create the user
                            user = await createUser(db, {
                                email: defaultEmail,
                                password: '', // No password needed for offline
                                roles: JSON.stringify(['ROLE_USER']),
                                is_active: 1,
                            });
                        }

                        if (user) {
                            // Generate JWT token
                            const token = await jwt.sign({
                                sub: user.id,
                                email: user.email,
                                roles: JSON.parse(user.roles || '["ROLE_USER"]'),
                                isGuest: false,
                            });
                            cookie.auth.set({
                                value: token,
                                httpOnly: true,
                                secure: process.env.NODE_ENV === 'production',
                                sameSite: 'lax',
                                maxAge: 7 * 24 * 60 * 60, // 7 days
                                path: '/',
                            });
                        }
                    }
                    return Response.redirect(prefixPath('/workarea') || '/workarea', 302);
                }

                const authMethods = await getAuthMethods(db, process.env.APP_AUTH_METHODS || 'password,guest');
                const guestLoginNonce = authMethods.includes('guest') ? randomBytes(8).toString('hex') : null;

                // Store nonce in cookie for guest login verification
                if (guestLoginNonce) {
                    cookie.guestNonce.set({
                        value: guestLoginNonce,
                        httpOnly: true,
                        maxAge: 300, // 5 minutes
                        path: '/',
                    });
                }

                let user = null;
                if (currentUser) {
                    const email = currentUser.email || 'user@exelearning.net';
                    user = {
                        id: currentUser.id,
                        username: email,
                        usernameFirsLetter: (email[0] || 'U').toUpperCase(),
                        gravatarUrl: createGravatarUrl(email, null, email),
                    };
                }

                // Detect locale from Accept-Language header
                const acceptLanguage = request.headers.get('accept-language');
                const locale = detectLocaleFromHeader(acceptLanguage);

                // Server-side translations using XLF files
                const t = {
                    sign_in: trans('Sign in', {}, locale),
                    hello_again: trans('Hello again! Please enter your credentials.', {}, locale),
                    email: trans('Email', {}, locale),
                    password: trans('Password', {}, locale),
                    logout: trans('Logout', {}, locale),
                    work_area: trans('Work area', {}, locale),
                    logged_in_as: trans('Logged in as', {}, locale),
                    close: trans('Close', {}, locale),
                    version: trans('Version:', {}, locale),
                    guest: trans('Guest', {}, locale),
                    other_auth_methods: trans('Other authentication methods:', {}, locale),
                    auth_methods: trans('Authentication methods:', {}, locale),
                };

                // Get and validate returnUrl from query params
                const typedQuery = query as LoginQueryParams;
                const rawReturnUrl = typedQuery?.returnUrl || '';
                const returnUrl = isValidReturnUrl(rawReturnUrl) ? rawReturnUrl : '';

                const { customHeadHtml, appName, customFaviconUrl } = await getCustomizationSettings();

                const viewModel = {
                    app_version: getAppVersion(),
                    auth_methods: authMethods,
                    user,
                    error: typedQuery?.error || null,
                    last_username: currentUser?.email || '',
                    csrf_token: 'temp-csrf-token',
                    guest_login_nonce: guestLoginNonce,
                    locale,
                    t,
                    basePath: getBasePath(),
                    returnUrl,
                    impersonation,
                    customHeadHtml,
                    appName,
                    customFaviconUrl,
                };

                const html = renderTemplate('security/login', viewModel);
                return new Response(html, {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            })

            // =====================================================
            // Workarea Page
            // =====================================================
            .get('/workarea', async ({ currentUser, isGuest, query, set, jwt, request, impersonation }) => {
                // Check if user is authenticated
                if (!currentUser) {
                    // Preserve the original URL for post-login redirect
                    const url = new URL(request.url);
                    const basePath = getBasePath();
                    // Build returnUrl without the basePath prefix (will be added later)
                    let returnUrl = url.pathname + url.search;
                    // Remove basePath from returnUrl if present, to store the canonical path
                    if (basePath && returnUrl.startsWith(basePath)) {
                        returnUrl = returnUrl.slice(basePath.length) || '/workarea';
                    }
                    const loginUrl = prefixPath('/login');
                    return Response.redirect(`${loginUrl}?returnUrl=${encodeURIComponent(returnUrl)}`, 302);
                }

                const { customHeadHtml, appName, customFaviconUrl } = await getCustomizationSettings();

                let projectUuid = query.project as string | undefined;
                const odeId = query.odeId as string | undefined;
                const jwtTokenParam = query.jwt_token as string | undefined;

                // =====================================================
                // PLATFORM INTEGRATION: Handle odeId parameter from Moodle
                // =====================================================
                // When coming from /edit_ode or /new_ode, we have odeId (not project)
                // The odeId can be either:
                // - A valid project UUID (if editing existing project)
                // - A Moodle cmid stored as platform_id (if previously saved to Moodle)
                // - A new Moodle cmid (if new project - need to create one)
                if (!projectUuid && odeId) {
                    // First try: Check if odeId is a valid project UUID
                    let existingProject = await findProjectByUuid(db, odeId);

                    // Second try: Check if odeId matches a platform_id (Moodle cmid)
                    if (!existingProject) {
                        existingProject = await findProjectByPlatformId(db, odeId);
                        if (existingProject) {
                            console.log(
                                `[Pages] Platform integration: Found project by platform_id ${odeId} -> ${existingProject.uuid}`,
                            );
                        }
                    }

                    if (existingProject) {
                        // Found existing project - use it
                        projectUuid = existingProject.uuid;
                        console.log(`[Pages] Platform integration: Using existing project ${projectUuid}`);
                    } else {
                        // odeId is not a valid project UUID or platform_id (new content from Moodle)
                        // Create a new project and redirect, preserving jwt_token
                        try {
                            const projectRecord = await createProject(db, {
                                title: 'New Project',
                                owner_id: currentUser.id,
                                saved_once: 0,
                            });

                            const newSessionId = projectRecord.uuid;

                            createSession({
                                sessionId: newSessionId,
                                fileName: 'New Project.elp',
                                filePath: '',
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                structure: null,
                                userId: currentUser.id,
                            });

                            console.log(
                                `[Pages] Platform integration: Created new project ${newSessionId} for Moodle cmid ${odeId}`,
                            );

                            // Redirect with jwt_token preserved
                            const basePath = getBasePath();
                            let redirectUrl = `${basePath}/workarea?project=${newSessionId}`;
                            if (jwtTokenParam) {
                                redirectUrl += `&jwt_token=${encodeURIComponent(jwtTokenParam)}`;
                            }
                            return Response.redirect(redirectUrl, 302);
                        } catch (error) {
                            console.error('[Pages] Platform integration: Failed to create new project:', error);
                            // Continue - will fall through to normal flow
                        }
                    }
                }

                // =====================================================
                // ACCESS CONTROL: Verify user has access to the project
                // =====================================================
                if (projectUuid) {
                    const session = getSession(projectUuid);
                    const project = await findProjectByUuid(db, projectUuid);
                    const basePath = getBasePath();

                    if (session) {
                        // Session exists in memory
                        if (project) {
                            // Project saved in DB - verify access via DB (owner or collaborator)
                            const accessCheck = await checkProjectAccess(db, project, currentUser.id);
                            if (!accessCheck.hasAccess) {
                                console.log(
                                    `[Pages] Access denied to project ${projectUuid} for user ${currentUser.id}: ${accessCheck.reason}`,
                                );
                                const html = renderTemplate('workarea/access-denied', {
                                    basePath,
                                    projectId: projectUuid,
                                    reason: accessCheck.reason,
                                    locale: 'en',
                                    impersonation,
                                    customHeadHtml,
                                    appName,
                                    customFaviconUrl,
                                });
                                set.status = 403;
                                return new Response(html, {
                                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                                });
                            }
                        } else if (session.userId && session.userId !== currentUser.id) {
                            // Session in memory from ANOTHER user - deny access
                            console.log(
                                `[Pages] Access denied to in-memory session ${projectUuid}: created by user ${session.userId}, accessed by ${currentUser.id}`,
                            );
                            const html = renderTemplate('workarea/access-denied', {
                                basePath,
                                projectId: projectUuid,
                                reason: 'ACCESS_DENIED',
                                locale: 'en',
                                impersonation,
                                customHeadHtml,
                                appName,
                                customFaviconUrl,
                            });
                            set.status = 403;
                            return new Response(html, {
                                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                            });
                        }
                        // Session created by current user (or legacy session without userId) - allow
                    } else {
                        // No session in memory
                        if (project) {
                            // Project exists in DB - verify access
                            const accessCheck = await checkProjectAccess(db, project, currentUser.id);
                            if (!accessCheck.hasAccess) {
                                console.log(
                                    `[Pages] Access denied to project ${projectUuid} for user ${currentUser.id}: ${accessCheck.reason}`,
                                );
                                const html = renderTemplate('workarea/access-denied', {
                                    basePath,
                                    projectId: projectUuid,
                                    reason: accessCheck.reason,
                                    locale: 'en',
                                    impersonation,
                                    customHeadHtml,
                                    appName,
                                    customFaviconUrl,
                                });
                                set.status = 403;
                                return new Response(html, {
                                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                                });
                            }
                        } else {
                            // Project doesn't exist in DB nor in session - 404
                            console.log(`[Pages] Project not found: ${projectUuid}`);
                            const html = renderTemplate('security/error', {
                                basePath,
                                error: 'Project Not Found',
                                message: 'The requested project does not exist.',
                                impersonation,
                                customHeadHtml,
                                appName,
                                customFaviconUrl,
                            });
                            set.status = 404;
                            return new Response(html, {
                                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                            });
                        }
                    }
                }

                // If no project UUID, create a new project and redirect
                if (!projectUuid) {
                    // Helper function to build redirect URL with preserved jwt_token
                    const buildRedirectUrl = (sessionId: string): string => {
                        const basePath = getBasePath();
                        let url = `${basePath}/workarea?project=${sessionId}`;
                        if (jwtTokenParam) {
                            url += `&jwt_token=${encodeURIComponent(jwtTokenParam)}`;
                        }
                        return url;
                    };

                    // Offline mode: create in-memory session only (no DB persistence)
                    if (isOfflineMode()) {
                        const newSessionId = crypto.randomUUID();

                        createSession({
                            sessionId: newSessionId,
                            fileName: 'New Project.elp',
                            filePath: '',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            structure: null,
                            userId: currentUser.id,
                        });

                        console.log(`[Pages] Created ephemeral session ${newSessionId} for offline mode`);

                        return Response.redirect(buildRedirectUrl(newSessionId), 302);
                    }

                    // Online mode: create project in DB (ensures persistence across reloads)
                    try {
                        const projectRecord = await createProject(db, {
                            title: 'New Project',
                            owner_id: currentUser.id,
                            saved_once: 0,
                        });

                        const newSessionId = projectRecord.uuid;

                        createSession({
                            sessionId: newSessionId,
                            fileName: 'New Project.elp',
                            filePath: '',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            structure: null,
                            userId: currentUser.id,
                        });

                        console.log(`[Pages] Created new project ${newSessionId} for user ${currentUser.id}`);

                        return Response.redirect(buildRedirectUrl(newSessionId), 302);
                    } catch (error) {
                        console.error('[Pages] Failed to create new project:', error);
                        // Continue without project if creation fails
                    }
                }

                const userId = currentUser.id;
                const email = currentUser.email || 'user@exelearning.net';

                // Determine locale with fallback: user preference → APP_LOCALE → browser Accept-Language → default
                const userLocale = await getUserLocalePreference(userId);
                const appLocale = process.env.APP_LOCALE || null;
                const acceptLanguage = request.headers.get('accept-language');
                const browserLocale = detectLocaleFromHeader(acceptLanguage);
                const locale = userLocale || appLocale || browserLocale || DEFAULT_LOCALE;

                // First time: auto-save locale as user preference for consistency
                if (!userLocale) {
                    try {
                        await setPreference(db, Number(userId), 'locale', JSON.stringify({ value: locale }));
                        console.log(`[Pages] Auto-saved locale preference '${locale}' for user ${userId}`);
                    } catch (e) {
                        // Non-critical - log and continue
                        console.warn('[Pages] Failed to auto-save locale preference:', e);
                    }
                }

                const user = {
                    id: userId,
                    username: email,
                    usernameFirsLetter: (email[0] || 'U').toUpperCase(),
                    acceptedLopd: true,
                    odePlatformId: null,
                    newOde: null,
                    gravatarUrl: createGravatarUrl(email, null, email),
                };

                const appAuthMethods = await getAuthMethods(
                    db,
                    process.env.APP_AUTH_METHODS || 'password,cas,openid,guest',
                );
                const isOfflineInstallation = isOfflineMode() || appAuthMethods.includes('none');

                const basePath = getBasePath();

                // Generate auth token for WebSocket
                const authToken = await jwt.sign({
                    sub: userId,
                    email: email,
                    isGuest: isGuest,
                });

                // Get default theme from database
                let defaultThemeDirName = 'base';
                try {
                    const defaultThemeSetting = await getDefaultTheme(db);
                    defaultThemeDirName = defaultThemeSetting.dirName;
                } catch {
                    // If table doesn't exist yet (pre-migration), use 'base'
                }

                // Get user styles/idevices settings from DB or env
                // SECURITY NOTE: When userStyles is enabled (ONLINE_THEMES_INSTALL=1),
                // users can import custom themes from ELP files. Themes may contain
                // JavaScript code that runs in the exported content context.
                // This is intentional for custom interactivity but administrators
                // should be aware of this when enabling the feature.
                const userStylesEnabled = await getSettingBoolean(
                    db,
                    'ONLINE_THEMES_INSTALL',
                    parseAppSettingBoolean(process.env.ONLINE_THEMES_INSTALL, false),
                );

                // Check for platform integration (jwt_token in URL means user came from platform)
                const jwtToken = query.jwt_token as string | undefined;
                let platformIntegrationEnabled = false;
                let platformName = 'exelearning'; // Default when not coming from platform

                if (jwtToken) {
                    const platformPayload = await decodePlatformJWT(jwtToken);
                    if (platformPayload) {
                        platformIntegrationEnabled = true;
                        // Extract platform name from provider, or use 'Moodle' as default for platform integration
                        platformName = platformPayload.provider?.name || 'Moodle';
                    }
                }

                // Unified config object (replaces legacy 'symfony' object)
                const config = {
                    // Version for cache busting in preview and asset URLs
                    version: getAppVersion(),
                    // Platform settings
                    platformName: platformName,
                    platformType: 'standalone',
                    platformUrlGet: '',
                    platformUrlSet: '',
                    clientCallWaitingTime: 120000,
                    clientIntervalGetLastEdition: 5000,
                    clientIntervalUpdate: 3000,
                    defaultTheme: defaultThemeDirName,
                    isOfflineInstallation,
                    platformIntegration: platformIntegrationEnabled,
                    userStyles: userStylesEnabled ? 1 : 0,
                    userIdevices: 0,
                    debugJs: process.env.APP_ENV === 'dev',
                    appEnv: process.env.APP_ENV || 'prod',
                    appDebug: process.env.APP_DEBUG || '0',
                    onlineMode: String(process.env.APP_ONLINE_MODE || '1') === '1',
                    // URL and path settings (formerly in 'symfony' object)
                    odeSessionId: null,
                    environment: process.env.APP_ENV || 'prod',
                    baseURL: '', // Will be set client-side
                    basePath,
                    fullURL: basePath,
                    changelogURL: prefixPath('/CHANGELOG.md'),
                    filesDirPermission: { checked: true },
                    locale,
                    themeTypeBase: 'base',
                    themeTypeUser: 'user',
                    ideviceTypeBase: 'base',
                    ideviceTypeUser: 'user',
                    ideviceVisibilityPreferencePre: 'exe_',
                    token: authToken,
                };

                // Server-side translations using XLF files
                const t = {
                    file: trans('File', {}, locale),
                    new: trans('New', {}, locale),
                    new_from_template: trans('New from Template...', {}, locale),
                    open: trans('Open', {}, locale),
                    recent_projects: trans('Recent projects', {}, locale),
                    import_elpx: trans('Import (.elpx...)', {}, locale),
                    save: trans('Save', {}, locale),
                    save_as: trans('Save as', {}, locale),
                    download_as: trans('Download as...', {}, locale),
                    export_as: trans('Export as...', {}, locale),
                    exelearning_content: trans('eXeLearning content (.elpx)', {}, locale),
                    website: trans('Website', {}, locale),
                    single_page: trans('Single page', {}, locale),
                    export_to_folder: trans('Export to Folder (Unzipped Website)', {}, locale),
                    print: trans('Print', {}, locale),
                    upload_to: trans('Upload to', {}, locale),
                    metadata: trans('Metadata', {}, locale),
                    import: trans('Import', {}, locale),
                    export: trans('Export', {}, locale),
                    utilities: trans('Utilities', {}, locale),
                    preview: trans('Preview', {}, locale),
                    idevice_manager: trans('iDevice manager', {}, locale),
                    resources_report: trans('Resources report', {}, locale),
                    link_validation: trans('Link validation', {}, locale),
                    file_manager: trans('File manager', {}, locale),
                    image_optimizer: trans('Image optimizer', {}, locale),
                    search: trans('Search...', {}, locale),
                    help: trans('Help', {}, locale),
                    assistant: trans('Assistant', {}, locale),
                    user_manual: trans('User manual', {}, locale),
                    api_reference: trans('API Reference (Swagger)', {}, locale),
                    about_exelearning: trans('About eXeLearning', {}, locale),
                    release_notes: trans('Release notes', {}, locale),
                    legal_notes: trans('Legal notes', {}, locale),
                    exelearning_website: trans('eXeLearning website', {}, locale),
                    report_bug: trans('Report a bug', {}, locale),
                    download: trans('Download', {}, locale),
                    styles: trans('Styles', {}, locale),
                    project_properties: trans('Project Properties', {}, locale),
                    share: trans('Share', {}, locale),
                    private: trans('Private', {}, locale),
                    public: trans('Public', {}, locale),
                    preferences: trans('Preferences', {}, locale),
                    logout: trans('Logout', {}, locale),
                    toggle_panels: trans('Toggle panels', {}, locale),
                    structure_panel: trans('Structure panel', {}, locale),
                    idevices_panel: trans('iDevices panel', {}, locale),
                    undo: trans('Undo', {}, locale),
                    redo: trans('Redo', {}, locale),
                    user_menu: trans('User menu', {}, locale),
                    users_online: trans('Users online', {}, locale),
                    exit: trans('Exit', {}, locale),
                    change_title: trans('Edit title', {}, locale),
                    move_up: trans('Move up', {}, locale),
                    move_down: trans('Move down', {}, locale),
                    move_left: trans('Move left (up in hierarchy)', {}, locale),
                    move_right: trans('Move right (down in hierarchy)', {}, locale),
                    page_properties: trans('Page properties', {}, locale),
                    delete_page: trans('Delete page', {}, locale),
                    clone_page: trans('Clone page', {}, locale),
                    import_content: trans('Import', {}, locale),
                    new_page: trans('New page', {}, locale),
                    add_subpage: trans('Add subpage', {}, locale),
                    page_options: trans('Page options', {}, locale),
                };

                const viewModel = {
                    version: getAppVersion(),
                    app_version: getAppVersion(),
                    expires: '',
                    extension: 'elpx',
                    user,
                    config,
                    locale,
                    projectId: projectUuid || null,
                    t,
                    basePath,
                    impersonation,
                    customHeadHtml,
                    appName,
                    customFaviconUrl,
                };

                // Set locale for Nunjucks template rendering (fixes | trans filter)
                setLocale(locale);

                try {
                    const html = renderTemplate('workarea/workarea', viewModel);
                    return new Response(html, {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    });
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    // Fallback HTML if template fails
                    const fallbackHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>eXeLearning Workarea</title>
    <script>window.eXeLearning = { version: "${getAppVersion()}", user: ${JSON.stringify(user)}, config: ${JSON.stringify(config)} };</script>
  </head>
  <body>
    <div id="root">eXeLearning workarea - Template error: ${errorMessage}</div>
  </body>
</html>`;
                    return new Response(fallbackHtml, {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    });
                }
            })

            // =====================================================
            // Admin Panel
            // =====================================================
            .get('/admin', async ({ currentUser, request, set, impersonation }) => {
                // Require authentication
                if (!currentUser) {
                    return Response.redirect(prefixPath('/login?returnUrl=/admin') || '/login?returnUrl=/admin', 302);
                }

                // Check for ROLE_ADMIN
                const userRoles: string[] =
                    typeof currentUser.roles === 'string'
                        ? JSON.parse(currentUser.roles || '[]')
                        : currentUser.roles || [];

                if (!userRoles.includes('ROLE_ADMIN')) {
                    set.status = 403;
                    const html = renderTemplate('security/error', {
                        error: 'You do not have permission to access the admin panel.',
                        is_authenticated: true,
                        basePath: getBasePath(),
                        impersonation,
                    });
                    return new Response(html, {
                        status: 403,
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    });
                }

                // Detect locale from user preference → APP_LOCALE → Accept-Language header
                const adminUserLocale = await getUserLocalePreference(currentUser.id);
                const acceptLanguage = request.headers.get('accept-language');
                const locale = adminUserLocale || process.env.APP_LOCALE || detectLocaleFromHeader(acceptLanguage);

                const email = currentUser.email || 'admin@exelearning.net';
                const user = {
                    id: currentUser.id,
                    email,
                    username: email,
                    usernameFirsLetter: (email[0] || 'A').toUpperCase(),
                    gravatarUrl: createGravatarUrl(email, null, email),
                    roles: userRoles,
                };

                const t = buildAdminTranslations(locale);

                let defaultQuota = process.env.DEFAULT_QUOTA ? parseInt(process.env.DEFAULT_QUOTA, 10) : 4096;
                const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
                    if (value === undefined) return fallback;
                    const normalized = value.toLowerCase().trim();
                    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
                    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
                    return fallback;
                };
                const parseNumber = (value: string | undefined, fallback: number): number => {
                    if (value === undefined) return fallback;
                    const parsed = parseInt(value, 10);
                    return Number.isNaN(parsed) ? fallback : parsed;
                };
                const adminSettings = {
                    general: {
                        online_themes_install: parseBoolean(process.env.ONLINE_THEMES_INSTALL, false),
                        online_idevices_install: parseBoolean(process.env.ONLINE_IDEVICES_INSTALL, false),
                        app_auth_methods: process.env.APP_AUTH_METHODS || 'password,cas,openid,guest',
                        version_control: parseBoolean(process.env.VERSION_CONTROL, true),
                        default_project_visibility: process.env.DEFAULT_PROJECT_VISIBILITY || 'private',
                        user_recent_ode_files_amount: parseNumber(process.env.USER_RECENT_ODE_FILES_AMOUNT, 3),
                        collaborative_block_level: process.env.COLLABORATIVE_BLOCK_LEVEL || 'idevice',
                    },
                    storage: {
                        user_storage_max_disk_space: parseNumber(process.env.USER_STORAGE_MAX_DISK_SPACE, 1024),
                        default_quota: parseNumber(process.env.DEFAULT_QUOTA, 4096),
                        count_user_autosave_space_ode_files: parseBoolean(
                            process.env.COUNT_USER_AUTOSAVE_SPACE_ODE_FILES,
                            true,
                        ),
                        file_upload_max_size: parseNumber(process.env.FILE_UPLOAD_MAX_SIZE, 1024),
                    },
                    autosave: {
                        permanent_save_autosave_time_interval: parseNumber(
                            process.env.PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL,
                            600,
                        ),
                        permanent_save_autosave_max_number_of_files: parseNumber(
                            process.env.PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES,
                            10,
                        ),
                        autosave_ode_files_function: parseBoolean(process.env.AUTOSAVE_ODE_FILES_FUNCTION, true),
                    },
                    cas: {
                        url: process.env.CAS_URL || 'https://casserverpac4j.herokuapp.com',
                        validate_path: process.env.CAS_VALIDATE_PATH || '/p3/serviceValidate',
                        login_path: process.env.CAS_LOGIN_PATH || '/login',
                        logout_path: process.env.CAS_LOGOUT_PATH || '/logout',
                    },
                    oidc: {
                        issuer: process.env.OIDC_ISSUER || 'https://demo.duendesoftware.com',
                        authorization_endpoint:
                            process.env.OIDC_AUTHORIZATION_ENDPOINT ||
                            'https://demo.duendesoftware.com/connect/authorize',
                        token_endpoint:
                            process.env.OIDC_TOKEN_ENDPOINT || 'https://demo.duendesoftware.com/connect/token',
                        userinfo_endpoint:
                            process.env.OIDC_USERINFO_ENDPOINT || 'https://demo.duendesoftware.com/connect/userinfo',
                        scope: process.env.OIDC_SCOPE || 'openid email',
                        client_id: process.env.OIDC_CLIENT_ID || 'interactive.confidential',
                        client_secret: process.env.OIDC_CLIENT_SECRET || 'secret',
                    },
                    storage_integrations: {
                        google_client_id: process.env.GOOGLE_CLIENT_ID || 'example.com.apps.googleusercontent.com',
                        google_client_secret: process.env.GOOGLE_CLIENT_SECRET || 'example.com',
                        dropbox_client_id: process.env.DROPBOX_CLIENT_ID || 'example.com',
                        dropbox_client_secret: process.env.DROPBOX_CLIENT_SECRET || 'example.com',
                        openequella_client_id: process.env.OPENEQUELLA_CLIENT_ID || 'example.com',
                        openequella_client_secret: process.env.OPENEQUELLA_CLIENT_SECRET || 'example.com',
                    },
                    presentation: {
                        custom_head_html: '',
                        app_name: '',
                        app_favicon_path: '',
                    },
                    maintenance: {
                        maintenance_mode: false,
                    },
                };

                const adminSettingsMap: Record<
                    string,
                    { path: string[]; type: 'string' | 'number' | 'boolean' | 'json' }
                > = {
                    ONLINE_THEMES_INSTALL: { path: ['general', 'online_themes_install'], type: 'boolean' },
                    ONLINE_IDEVICES_INSTALL: { path: ['general', 'online_idevices_install'], type: 'boolean' },
                    APP_AUTH_METHODS: { path: ['general', 'app_auth_methods'], type: 'string' },
                    VERSION_CONTROL: { path: ['general', 'version_control'], type: 'boolean' },
                    DEFAULT_PROJECT_VISIBILITY: { path: ['general', 'default_project_visibility'], type: 'string' },
                    USER_RECENT_ODE_FILES_AMOUNT: { path: ['general', 'user_recent_ode_files_amount'], type: 'number' },
                    COLLABORATIVE_BLOCK_LEVEL: { path: ['general', 'collaborative_block_level'], type: 'string' },
                    USER_STORAGE_MAX_DISK_SPACE: { path: ['storage', 'user_storage_max_disk_space'], type: 'number' },
                    DEFAULT_QUOTA: { path: ['storage', 'default_quota'], type: 'number' },
                    COUNT_USER_AUTOSAVE_SPACE_ODE_FILES: {
                        path: ['storage', 'count_user_autosave_space_ode_files'],
                        type: 'boolean',
                    },
                    FILE_UPLOAD_MAX_SIZE: { path: ['storage', 'file_upload_max_size'], type: 'number' },
                    PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL: {
                        path: ['autosave', 'permanent_save_autosave_time_interval'],
                        type: 'number',
                    },
                    PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES: {
                        path: ['autosave', 'permanent_save_autosave_max_number_of_files'],
                        type: 'number',
                    },
                    AUTOSAVE_ODE_FILES_FUNCTION: {
                        path: ['autosave', 'autosave_ode_files_function'],
                        type: 'boolean',
                    },
                    CAS_URL: { path: ['cas', 'url'], type: 'string' },
                    CAS_VALIDATE_PATH: { path: ['cas', 'validate_path'], type: 'string' },
                    CAS_LOGIN_PATH: { path: ['cas', 'login_path'], type: 'string' },
                    CAS_LOGOUT_PATH: { path: ['cas', 'logout_path'], type: 'string' },
                    OIDC_ISSUER: { path: ['oidc', 'issuer'], type: 'string' },
                    OIDC_AUTHORIZATION_ENDPOINT: { path: ['oidc', 'authorization_endpoint'], type: 'string' },
                    OIDC_TOKEN_ENDPOINT: { path: ['oidc', 'token_endpoint'], type: 'string' },
                    OIDC_USERINFO_ENDPOINT: { path: ['oidc', 'userinfo_endpoint'], type: 'string' },
                    OIDC_SCOPE: { path: ['oidc', 'scope'], type: 'string' },
                    OIDC_CLIENT_ID: { path: ['oidc', 'client_id'], type: 'string' },
                    OIDC_CLIENT_SECRET: { path: ['oidc', 'client_secret'], type: 'string' },
                    GOOGLE_CLIENT_ID: { path: ['storage_integrations', 'google_client_id'], type: 'string' },
                    GOOGLE_CLIENT_SECRET: { path: ['storage_integrations', 'google_client_secret'], type: 'string' },
                    DROPBOX_CLIENT_ID: { path: ['storage_integrations', 'dropbox_client_id'], type: 'string' },
                    DROPBOX_CLIENT_SECRET: { path: ['storage_integrations', 'dropbox_client_secret'], type: 'string' },
                    OPENEQUELLA_CLIENT_ID: { path: ['storage_integrations', 'openequella_client_id'], type: 'string' },
                    OPENEQUELLA_CLIENT_SECRET: {
                        path: ['storage_integrations', 'openequella_client_secret'],
                        type: 'string',
                    },
                    CUSTOM_HEAD_HTML: { path: ['presentation', 'custom_head_html'], type: 'string' },
                    APP_NAME: { path: ['presentation', 'app_name'], type: 'string' },
                    APP_FAVICON_PATH: { path: ['presentation', 'app_favicon_path'], type: 'string' },
                    MAINTENANCE_MODE: { path: ['maintenance', 'maintenance_mode'], type: 'boolean' },
                };

                try {
                    const storedSettings = await getAllSettingsDefault(db as unknown as AppSettingsDb);
                    for (const setting of storedSettings) {
                        const mapping = adminSettingsMap[setting.key];
                        if (!mapping) continue;

                        let parsedValue: string | number | boolean = setting.value;
                        if (mapping.type === 'boolean') {
                            parsedValue = parseBoolean(setting.value, false);
                        } else if (mapping.type === 'number') {
                            parsedValue = parseNumber(setting.value, 0);
                        } else if (mapping.type === 'json') {
                            try {
                                parsedValue = JSON.parse(setting.value);
                            } catch {
                                parsedValue = setting.value;
                            }
                        }

                        let target: Record<string, unknown> = adminSettings as Record<string, unknown>;
                        for (let i = 0; i < mapping.path.length - 1; i++) {
                            target = target[mapping.path[i]] as Record<string, unknown>;
                        }
                        target[mapping.path[mapping.path.length - 1]] = parsedValue;
                    }
                } catch (error) {
                    console.warn('[Admin] Failed to load stored settings:', error);
                }
                defaultQuota = parseNumber(adminSettings.storage.default_quota, defaultQuota);

                const viewModel = {
                    version: getAppVersion(),
                    app_version: getAppVersion(),
                    user,
                    locale,
                    t,
                    basePath: getBasePath(),
                    defaultQuota,
                    adminSettings,
                    impersonation,
                };

                try {
                    const html = renderTemplate('admin/index', viewModel);
                    return new Response(html, {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    });
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    // Fallback HTML if template fails
                    const fallbackHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>eXeLearning Admin</title>
  </head>
  <body>
    <div id="root">eXeLearning Admin - Template error: ${errorMessage}</div>
  </body>
</html>`;
                    return new Response(fallbackHtml, {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    });
                }
            })

            // =====================================================
            // Access Denied Page (standalone route for redirects)
            // =====================================================
            .get('/access-denied', async ({ impersonation }) => {
                const basePath = getBasePath();
                const { customHeadHtml, appName, customFaviconUrl } = await getCustomizationSettings();
                const html = renderTemplate('workarea/access-denied', {
                    basePath,
                    locale: 'en',
                    impersonation,
                    customHeadHtml,
                    appName,
                    customFaviconUrl,
                });
                return new Response(html, {
                    status: 403,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            })
    );
}

// ============================================================================
// Default Instance (for backwards compatibility)
// ============================================================================

export const pagesRoutes = createPagesRoutes();
