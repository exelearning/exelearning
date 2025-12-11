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
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

import { renderTemplate as renderTemplateDefault } from '../services/template';
import {
    findUserById as findUserByIdDefault,
    findUserByEmail as findUserByEmailDefault,
    createUser as createUserDefault,
    findPreference as findPreferenceDefault,
    findProjectByUuid as findProjectByUuidDefault,
    checkProjectAccess as checkProjectAccessDefault,
    createProject as createProjectDefault,
} from '../db/queries';
import { db as dbDefault } from '../db/client';
import { createGravatarUrl as createGravatarUrlDefault } from '../utils/gravatar.util';
import { getBasePath, prefixPath } from '../utils/basepath.util';
import { isValidReturnUrl } from '../utils/redirect-validator.util';
import {
    createSession as createSessionDefault,
    generateSessionId as generateSessionIdDefault,
    getSession as getSessionDefault,
} from '../services/session-manager';
import { createSessionDirectories as createSessionDirectoriesDefault } from '../services/file-helper';
import { detectLocaleFromHeader, trans, DEFAULT_LOCALE } from '../services/translation';
import type { JwtPayload } from './types/request-payloads';

/**
 * Package.json structure (partial)
 */
interface PackageJson {
    version: string;
    name?: string;
}

/**
 * Login page query parameters
 */
interface LoginQueryParams {
    returnUrl?: string;
    error?: string;
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
    findProjectByUuid: typeof findProjectByUuidDefault;
    checkProjectAccess: typeof checkProjectAccessDefault;
    createProject: typeof createProjectDefault;
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
}

/**
 * Template functions interface
 */
export interface PagesTemplateDeps {
    renderTemplate: typeof renderTemplateDefault;
}

/**
 * Utils interface
 */
export interface PagesUtilsDeps {
    createGravatarUrl: typeof createGravatarUrlDefault;
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
}

// Default queries
const defaultQueries: PagesQueriesDeps = {
    findUserById: findUserByIdDefault,
    findUserByEmail: findUserByEmailDefault,
    createUser: createUserDefault,
    findPreference: findPreferenceDefault,
    findProjectByUuid: findProjectByUuidDefault,
    checkProjectAccess: checkProjectAccessDefault,
    createProject: createProjectDefault,
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
};

// Default template
const defaultTemplate: PagesTemplateDeps = {
    renderTemplate: renderTemplateDefault,
};

// Default utils
const defaultUtils: PagesUtilsDeps = {
    createGravatarUrl: createGravatarUrlDefault,
};

// Default dependencies
const defaultDependencies: PagesDependencies = {
    db: dbDefault,
    queries: defaultQueries,
    sessionManager: defaultSessionManager,
    fileHelper: defaultFileHelper,
    template: defaultTemplate,
    utils: defaultUtils,
};

// Find package.json
const findPackageJson = (): PackageJson => {
    let currentDir = __dirname;
    for (let i = 0; i < 10; i++) {
        const packagePath = join(currentDir, 'package.json');
        if (existsSync(packagePath)) {
            return JSON.parse(readFileSync(packagePath, 'utf-8')) as PackageJson;
        }
        currentDir = join(currentDir, '..');
    }
    return { version: 'unknown' };
};

const packageJson = findPackageJson();
const getAppVersion = () => process.env.APP_VERSION || `v${packageJson.version}`;
const isOfflineMode = () => String(process.env.APP_ONLINE_MODE ?? '1') === '0';

// Get JWT secret
const getJwtSecret = () => {
    return process.env.JWT_SECRET || process.env.APP_SECRET || 'elysia-dev-secret-change-me';
};

// Get auth methods from environment
const getAuthMethods = (): string[] => {
    const methods = process.env.APP_AUTH_METHODS || 'form,guest';
    return methods
        .split(',')
        .map(m => m.trim().toLowerCase())
        .filter(m => m);
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
        findProjectByUuid,
        checkProjectAccess,
        createProject,
    } = deps.queries ?? defaultQueries;
    const { createSession, getSession } = deps.sessionManager ?? defaultSessionManager;
    const { createSessionDirectories } = deps.fileHelper ?? defaultFileHelper;
    const { renderTemplate } = deps.template ?? defaultTemplate;
    const { createGravatarUrl } = deps.utils ?? defaultUtils;

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
                if (!token) return { currentUser: null, isGuest: false };

                try {
                    const payload = (await jwt.verify(token)) as JwtPayload | false;
                    if (!payload) return { currentUser: null, isGuest: false };

                    const isGuest = payload.isGuest || false;
                    if (isGuest) {
                        return {
                            currentUser: {
                                id: payload.sub,
                                email: payload.email || 'guest@guest.local',
                            },
                            isGuest: true,
                        };
                    }

                    const user = await findUserById(db, payload.sub);
                    return { currentUser: user || null, isGuest: false };
                } catch {
                    return { currentUser: null, isGuest: false };
                }
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
            .get('/login', async ({ currentUser, cookie, jwt, query, request }) => {
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
                                provider: 'offline-local',
                                isActive: true,
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

                const authMethods = getAuthMethods();
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
                };

                const html = renderTemplate('security/login', viewModel);
                return new Response(html, {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            })

            // =====================================================
            // Workarea Page
            // =====================================================
            .get('/workarea', async ({ currentUser, isGuest, query, set, jwt, request }) => {
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

                const projectUuid = query.project as string | undefined;

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
                    try {
                        // 1. Create project in database FIRST (ensures persistence across reloads)
                        const projectRecord = await createProject(db, {
                            title: 'New Project',
                            owner_id: currentUser.id,
                            saved_once: 0,
                        });

                        // 2. Use project UUID as session ID
                        const newSessionId = projectRecord.uuid;

                        // 3. Create session directories
                        await createSessionDirectories(newSessionId);

                        // 4. Create session in memory
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

                        // Redirect to workarea with the new project ID
                        return Response.redirect(
                            prefixPath(`/workarea?project=${newSessionId}`) || `/workarea?project=${newSessionId}`,
                            302,
                        );
                    } catch (error) {
                        console.error('[Pages] Failed to create new project:', error);
                        // Continue without project if creation fails
                    }
                }

                const userId = currentUser.id;
                const email = currentUser.email || 'user@exelearning.net';

                // Determine locale with fallback: user preference → browser Accept-Language → default
                const userLocale = await getUserLocalePreference(userId);
                const acceptLanguage = request.headers.get('accept-language');
                const browserLocale = detectLocaleFromHeader(acceptLanguage);
                const locale = userLocale || browserLocale || DEFAULT_LOCALE;

                const user = {
                    id: userId,
                    username: email,
                    usernameFirsLetter: (email[0] || 'U').toUpperCase(),
                    acceptedLopd: true,
                    odePlatformId: null,
                    newOde: null,
                    gravatarUrl: createGravatarUrl(email, null, email),
                };

                const isOfflineInstallation =
                    isOfflineMode() ||
                    (process.env.APP_AUTH_METHODS || '')
                        .split(',')
                        .map(m => m.trim().toLowerCase())
                        .includes('none');

                const config = {
                    platformName: 'exelearning',
                    platformType: 'standalone',
                    platformUrlGet: '',
                    platformUrlSet: '',
                    clientCallWaitingTime: 120000,
                    clientIntervalGetLastEdition: 5000,
                    clientIntervalUpdate: 3000,
                    defaultTheme: 'default',
                    isOfflineInstallation,
                    platformIntegration: false,
                    userStyles: 0,
                    userIdevices: 0,
                    debugJs: process.env.APP_ENV === 'dev',
                    appEnv: process.env.APP_ENV || 'prod',
                    appDebug: process.env.APP_DEBUG || '0',
                    onlineMode: String(process.env.APP_ONLINE_MODE || '1') === '1',
                };

                const basePath = getBasePath();

                // Generate auth token for WebSocket
                const authToken = await jwt.sign({
                    sub: userId,
                    email: email,
                    isGuest: isGuest,
                });

                const symfony = {
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
                    settings: trans('Settings', {}, locale),
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
                    change_title: trans('Change title', {}, locale),
                    move_up: trans('Move up', {}, locale),
                    move_down: trans('Move down', {}, locale),
                    move_left: trans('Move left (up in hierarchy)', {}, locale),
                    move_right: trans('Move right (down in hierarchy)', {}, locale),
                    page_properties: trans('Page properties', {}, locale),
                    delete_page: trans('Delete page', {}, locale),
                    clone_page: trans('Clone page', {}, locale),
                    import_idevices: trans('Import iDevices', {}, locale),
                    new_page: trans('New page', {}, locale),
                    add_subpage: trans('Add subpage', {}, locale),
                    page_options: trans('Page options', {}, locale),
                };

                const viewModel = {
                    version: getAppVersion(),
                    app_version: getAppVersion(),
                    expires: '',
                    extension: '.elp',
                    user,
                    config,
                    symfony,
                    locale,
                    projectId: projectUuid || null,
                    t,
                    basePath,
                };

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
    <script>window.eXeLearning = { version: "${getAppVersion()}", user: ${JSON.stringify(user)}, config: ${JSON.stringify(config)}, symfony: ${JSON.stringify(symfony)} };</script>
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
    );
}

// ============================================================================
// Default Instance (for backwards compatibility)
// ============================================================================

export const pagesRoutes = createPagesRoutes();
